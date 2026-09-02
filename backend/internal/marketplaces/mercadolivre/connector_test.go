package mercadolivre

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync"
	"testing"

	mp "az3d-backend/internal/marketplaces"
)

func TestExchangeAuthCodeSendsPKCEVerifier(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := r.ParseForm(); err != nil {
			t.Fatal(err)
		}
		if got := r.Form.Get("code_verifier"); got != "pkce-verifier" {
			t.Fatalf("code_verifier = %q", got)
		}
		if got := r.Form.Get("redirect_uri"); got != "https://az3d.example/oauth/callback" {
			t.Fatalf("redirect_uri = %q", got)
		}
		if got := r.Form.Get("client_id"); got != "database-client" {
			t.Fatalf("client_id = %q", got)
		}
		if got := r.Form.Get("client_secret"); got != "database-secret" {
			t.Fatalf("client_secret = %q", got)
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"access_token": "access-secret", "refresh_token": "refresh-secret",
			"expires_in": 21600, "user_id": 12345,
		})
	}))
	defer server.Close()
	t.Setenv("MELI_API_BASE_URL", server.URL)
	token, err := New().ExchangeAuthCode(context.Background(), mp.Account{
		OAuthClientID: "database-client", OAuthClientSecret: "database-secret",
	}, mp.TokenRequest{
		Code: "authorization-code", RedirectURI: "https://az3d.example/oauth/callback", CodeVerifier: "pkce-verifier",
	})
	if err != nil {
		t.Fatal(err)
	}
	if token.SellerID != "12345" || token.AccessToken == "" || token.RefreshToken == "" {
		t.Fatalf("unexpected token result: %#v", token)
	}
}

func TestNormalizeVariationsPreservesStructuredAttributes(t *testing.T) {
	item := mercadoItem{Price: 42, Variations: []mercadoVariation{{ID: 10, Price: 45, AvailableQuantity: 3, AttributeCombinations: []mercadoAttribute{{ID: "COLOR", Name: "Cor", ValueName: "Preto"}, {ID: "SIZE", Name: "Tamanho", ValueName: "G"}}}}}
	variants, stocks, _ := normalizeVariations(item, "", true)
	if len(variants) != 1 || variants[0].VariationName != "Preto / G" {
		t.Fatalf("unexpected variants: %#v", variants)
	}
	if variants[0].ColorName != variants[0].VariationName {
		t.Fatalf("legacy label was not preserved: %#v", variants[0])
	}
	var attributes []map[string]string
	if err := json.Unmarshal([]byte(variants[0].Attributes), &attributes); err != nil || len(attributes) != 2 {
		t.Fatalf("attributes = %q, err=%v", variants[0].Attributes, err)
	}
	if len(stocks) != 1 || stocks[0].StockQty != 3 {
		t.Fatalf("unexpected stock: %#v", stocks)
	}
}

func TestUnauthorizedResponseIsTypedAndDoesNotExposeCredentials(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, `{"message":"token secret-token invalid"}`, http.StatusUnauthorized)
	}))
	defer server.Close()
	t.Setenv("MELI_API_BASE_URL", server.URL)

	err := New().TestConnection(context.Background(), mp.Account{AccessToken: "secret-token"})
	if !IsUnauthorized(err) {
		t.Fatalf("error should be typed as unauthorized: %v", err)
	}
	if strings.Contains(err.Error(), "secret-token") {
		t.Fatalf("credential leaked in error: %v", err)
	}
}

func TestResolveIdentityAndOrderAccessUseSellerOwnedByToken(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/users/me":
			_ = json.NewEncoder(w).Encode(map[string]any{"id": 3624201494})
		case "/orders/search":
			if got := r.URL.Query().Get("seller"); got != "3624201494" {
				t.Errorf("seller = %q", got)
			}
			if r.URL.Query().Get("limit") != "1" || r.URL.Query().Get("offset") != "0" {
				t.Errorf("unexpected probe query: %s", r.URL.RawQuery)
			}
			_ = json.NewEncoder(w).Encode(map[string]any{
				"paging":  map[string]any{"total": 0, "offset": 0, "limit": 1},
				"results": []any{},
			})
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()
	t.Setenv("MELI_API_BASE_URL", server.URL)
	connector := New()
	account := mp.Account{AccessToken: "access-token", SellerID: "wrong-seller"}

	identity, err := connector.ResolveAccountIdentity(context.Background(), account)
	if err != nil {
		t.Fatal(err)
	}
	if identity.SellerID != "3624201494" {
		t.Fatalf("seller identity = %q", identity.SellerID)
	}
	account.SellerID = identity.SellerID
	if err := connector.TestOrderAccess(context.Background(), account); err != nil {
		t.Fatal(err)
	}
}

func TestOrderAccessForbiddenIsClassified(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/orders/search" {
			http.NotFound(w, r)
			return
		}
		http.Error(w, `{"message":"not_owned_order"}`, http.StatusForbidden)
	}))
	defer server.Close()
	t.Setenv("MELI_API_BASE_URL", server.URL)

	err := New().TestOrderAccess(context.Background(), mp.Account{AccessToken: "access-token", SellerID: "123"})
	if !IsOrderAccessForbidden(err) {
		t.Fatalf("error should be classified as forbidden order access: %v", err)
	}
}

func TestFetchCatalogIncludesInactiveItemsAndPaginates(t *testing.T) {
	var mu sync.Mutex
	requests := []string{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/users/12345/items/search":
			if limit := r.URL.Query().Get("limit"); limit != strconv.Itoa(catalogPageSize) {
				t.Errorf("limit = %q", limit)
			}
			status := r.URL.Query().Get("status")
			offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
			mu.Lock()
			requests = append(requests, fmt.Sprintf("%s:%d", status, offset))
			mu.Unlock()
			results := []string{}
			total := 0
			switch status {
			case "":
				results, total = []string{"MLB-ACTIVE"}, 1
			case "paused":
				results, total = []string{"MLB-PAUSED", "MLB-ACTIVE"}, 3
				if offset > 0 {
					results = []string{"MLB-CLOSED"}
				}
			case "closed":
				results, total = []string{"MLB-CLOSED"}, 1
			case "inactive":
				http.Error(w, `{"message":"invalid status"}`, http.StatusBadRequest)
				return
			}
			_ = json.NewEncoder(w).Encode(map[string]any{
				"paging":  map[string]any{"total": total, "offset": offset, "limit": catalogPageSize},
				"results": results,
			})
		case "/items":
			ids := strings.Split(r.URL.Query().Get("ids"), ",")
			statuses := map[string]string{
				"MLB-PAUSED": "paused",
				"MLB-ACTIVE": "active",
				"MLB-CLOSED": "closed",
			}
			response := make([]map[string]any, 0, len(ids))
			for _, id := range ids {
				response = append(response, map[string]any{
					"code": http.StatusOK,
					"body": map[string]any{
						"id": id, "title": id, "price": 10,
						"available_quantity": 0, "status": statuses[id],
					},
				})
			}
			_ = json.NewEncoder(w).Encode(response)
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()
	t.Setenv("MELI_API_BASE_URL", server.URL)

	result, err := New().FetchCatalog(context.Background(), mp.Account{
		SellerID: "12345", AccessToken: "access-token",
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Items) != 3 {
		t.Fatalf("items = %d, want 3: %#v", len(result.Items), result.Items)
	}
	mu.Lock()
	gotRequests := append([]string(nil), requests...)
	mu.Unlock()
	wantRequests := "[:0 paused:0 paused:2 closed:0 pending:0 not_yet_active:0 inactive:0]"
	if fmt.Sprint(gotRequests) != wantRequests {
		t.Fatalf("requests = %v, want %s", gotRequests, wantRequests)
	}
	if result.Items[0].Status != "active" || result.Items[1].Status != "paused" || result.Items[2].Status != "paused" {
		t.Fatalf("unexpected normalized statuses: %#v", result.Items)
	}
	if result.Message != "3 anuncio(s) encontrados no Mercado Livre" {
		t.Fatalf("message = %q", result.Message)
	}
}

func TestNormalizeItemKeepsMercadoLivreVariationsGrouped(t *testing.T) {
	item := normalizeItem(mercadoItem{
		ID: "MLB-123", Title: "Produto com variacoes", Price: 90, AvailableQuantity: 5, Status: "active",
		Pictures: []mercadoPicture{
			{ID: "PIC-BLACK", SecureURL: "https://img.example/preto.jpg"},
			{ID: "PIC-WHITE", SecureURL: "https://img.example/branco.jpg"},
		},
		Variations: []mercadoVariation{
			{ID: 1, Price: 90, AvailableQuantity: 2, PictureIDs: []string{"PIC-BLACK"}, AttributeCombinations: []mercadoAttribute{{ID: "COLOR", ValueName: "Preto"}}},
			{ID: 2, Price: 95, AvailableQuantity: 3, PictureIDs: []string{"PIC-WHITE"}, AttributeCombinations: []mercadoAttribute{{ID: "COLOR", ValueName: "Branco"}}},
		},
	})

	if len(item.Variants) != 2 || len(item.ColorStocks) != 2 || len(item.ColorImages) != 2 {
		t.Fatalf("variation relations were not preserved: %#v", item)
	}
	if item.StockQty != 5 || item.Variants[0].ColorName != "Preto" || item.Variants[1].Price != 95 {
		t.Fatalf("unexpected normalized variations: %#v", item)
	}
	if item.ColorStocks[1].ColorName != "Branco" || item.ColorStocks[1].StockQty != 3 {
		t.Fatalf("unexpected variation stocks: %#v", item.ColorStocks)
	}
	if item.ColorImages[0].ImageURL != "https://img.example/preto.jpg" {
		t.Fatalf("unexpected variation image: %#v", item.ColorImages[0])
	}
}

func TestNormalizeItemKeepsAllPicturesAndInfersColorForSeparateListing(t *testing.T) {
	item := normalizeItem(mercadoItem{
		ID: "MLB-456", Title: "Vasinho Leitor Branco", SellerCustomField: "VL01-BRA",
		Price: 35.9, AvailableQuantity: 10, Status: "active",
		Pictures: []mercadoPicture{
			{ID: "PIC-1", SecureURL: "https://img.example/branco-1.jpg"},
			{ID: "PIC-2", SecureURL: "https://img.example/branco-2.jpg"},
		},
	})

	if len(item.Variants) != 0 || len(item.ColorStocks) != 1 || len(item.ColorImages) != 2 {
		t.Fatalf("separate listing media was not preserved: %#v", item)
	}
	if item.ColorStocks[0].ColorName != "Branco" || item.ColorStocks[0].StockQty != 10 {
		t.Fatalf("unexpected inferred stock color: %#v", item.ColorStocks)
	}
	if item.ColorImages[0].ColorName != "Branco" || item.ColorImages[1].ImageURL != "https://img.example/branco-2.jpg" {
		t.Fatalf("unexpected listing gallery: %#v", item.ColorImages)
	}
}

func TestFetchCatalogItemsDeduplicatesAndRejectsAnotherSeller(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/items" {
			http.NotFound(w, r)
			return
		}
		if got := r.URL.Query().Get("ids"); got != "MLB-OWNED,MLB-FOREIGN" {
			t.Fatalf("ids = %q", got)
		}
		if !strings.Contains(r.URL.Query().Get("attributes"), "seller_id") {
			t.Fatal("seller_id was not requested")
		}
		_ = json.NewEncoder(w).Encode([]map[string]any{
			{"code": http.StatusOK, "body": map[string]any{
				"id": "MLB-OWNED", "seller_id": 12345, "title": "Owned", "price": 15, "status": "paused",
			}},
			{"code": http.StatusOK, "body": map[string]any{
				"id": "MLB-FOREIGN", "seller_id": 99999, "title": "Foreign", "price": 25, "status": "active",
			}},
		})
	}))
	defer server.Close()
	t.Setenv("MELI_API_BASE_URL", server.URL)

	result, err := New().FetchCatalogItems(context.Background(), mp.Account{
		SellerID: "12345", AccessToken: "access-token",
	}, []string{"MLB-OWNED", "MLB-OWNED", "", "MLB-FOREIGN"})
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Items) != 1 || result.Items[0].ExternalItemID != "MLB-OWNED" {
		t.Fatalf("unexpected owned items: %#v", result.Items)
	}
	if result.Items[0].Status != "paused" {
		t.Fatalf("status = %q", result.Items[0].Status)
	}
}

func TestFetchOrdersPaginatesAndUsesAuthoritativeFinancialFields(t *testing.T) {
	var mu sync.Mutex
	offsets := []int{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.URL.Path == "/orders/search":
			offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
			mu.Lock()
			offsets = append(offsets, offset)
			mu.Unlock()
			if r.URL.Query().Get("limit") != strconv.Itoa(orderPageSize) {
				t.Errorf("limit = %q", r.URL.Query().Get("limit"))
			}
			orders := []map[string]any{}
			if offset < 2 {
				id := 1001 + offset
				unitPrice := 100.0
				quantity := 1
				marketplaceFee := 10.0
				saleFee := 10.0
				shippingID := int64(9001)
				if offset == 1 {
					unitPrice = 25
					quantity = 2
					marketplaceFee = 0
					saleFee = 5
					shippingID = 0
				}
				orders = append(orders, map[string]any{
					"id": id, "status": "paid", "date_closed": "2026-08-29T12:00:00Z",
					"total_amount": 120, "paid_amount": 130, "currency_id": "BRL",
					"shipping": map[string]any{"id": shippingID},
					"payments": []map[string]any{{"marketplace_fee": marketplaceFee}},
					"order_items": []map[string]any{{
						"item":     map[string]any{"id": fmt.Sprintf("MLB%d", id), "title": "Produto", "seller_custom_field": "SKU"},
						"quantity": quantity, "unit_price": unitPrice, "sale_fee": saleFee,
					}},
				})
			}
			_ = json.NewEncoder(w).Encode(map[string]any{
				"paging":  map[string]any{"total": 2, "offset": offset, "limit": 1},
				"results": orders,
			})
		case r.URL.Path == "/shipments/9001/costs":
			if r.Header.Get("x-format-new") != "true" {
				t.Error("shipment costs request missing x-format-new header")
			}
			_ = json.NewEncoder(w).Encode(map[string]any{
				"senders": []map[string]any{
					{"user_id": 99999, "cost": 20.0},
					{"user_id": 12345, "cost": 5.5},
				},
			})
		case r.URL.Path == "/orders/1001/discounts":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"details": []map[string]any{{
					"items": []map[string]any{{"amounts": map[string]any{"seller": 7.0}}},
				}},
			})
		case r.URL.Path == "/orders/1002/discounts":
			_ = json.NewEncoder(w).Encode(map[string]any{"details": []any{}})
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()
	t.Setenv("MELI_API_BASE_URL", server.URL)

	result, err := New().FetchOrders(context.Background(), mp.Account{
		SellerID: "12345", AccessToken: "access-token",
	}, mp.OrderSyncInput{Days: 90})
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Orders) != 2 {
		t.Fatalf("orders = %d, want 2", len(result.Orders))
	}
	mu.Lock()
	gotOffsets := append([]int(nil), offsets...)
	mu.Unlock()
	if fmt.Sprint(gotOffsets) != "[0 1]" {
		t.Fatalf("offsets = %v, want [0 1]", gotOffsets)
	}

	first := result.Orders[0]
	if first.GrossAmount != 100 || first.MarketplaceFees != 10 || first.ShippingCost != 5.5 || first.DiscountAmount != 7 {
		t.Fatalf("unexpected first order financials: %#v", first)
	}
	if first.NetAmount != 84.5 {
		t.Fatalf("net amount = %.2f, want 84.50", first.NetAmount)
	}
	if !first.FinancialComplete {
		t.Fatalf("first order should be complete: %#v", first.FinancialNotes)
	}

	second := result.Orders[1]
	if second.GrossAmount != 50 || second.MarketplaceFees != 10 || second.NetAmount != 40 || second.Items[0].FeeAmount != 10 {
		t.Fatalf("sale_fee fallback or item gross is wrong: %#v", second)
	}
}

func TestFetchOrdersMarksOptionalFinancialDetailsAsIncomplete(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.URL.Path == "/orders/search":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"paging": map[string]any{"total": 1, "offset": 0, "limit": 50},
				"results": []map[string]any{{
					"id": 2001, "status": "paid", "currency_id": "BRL",
					"shipping": map[string]any{"id": 9901},
					"order_items": []map[string]any{{
						"item":     map[string]any{"id": "MLB2001", "title": "Produto"},
						"quantity": 1, "unit_price": 20, "sale_fee": 2,
						"discounts": []map[string]any{{"amounts": map[string]any{"seller": 3.0}}},
					}},
				}},
			})
		case strings.HasSuffix(r.URL.Path, "/discounts"), strings.HasSuffix(r.URL.Path, "/costs"):
			http.NotFound(w, r)
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()
	t.Setenv("MELI_API_BASE_URL", server.URL)

	result, err := New().FetchOrders(context.Background(), mp.Account{
		SellerID: "12345", AccessToken: "access-token",
	}, mp.OrderSyncInput{Days: 7})
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Orders) != 1 || result.Orders[0].FinancialComplete {
		t.Fatalf("expected incomplete financial details: %#v", result.Orders)
	}
	if result.Orders[0].DiscountAmount != 3 {
		t.Fatalf("embedded seller discount fallback = %.2f, want 3.00", result.Orders[0].DiscountAmount)
	}
	if len(result.Orders[0].FinancialNotes) != 2 || !strings.Contains(result.Message, "incompletos") {
		t.Fatalf("missing incomplete detail diagnostics: %#v / %q", result.Orders[0], result.Message)
	}
}
