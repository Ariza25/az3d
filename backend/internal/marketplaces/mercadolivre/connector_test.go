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

func TestFetchCatalogIncludesInactiveItemsAndPaginates(t *testing.T) {
	var mu sync.Mutex
	offsets := []int{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/users/12345/items/search":
			if status := r.URL.Query().Get("status"); status != "" {
				t.Errorf("status filter = %q, want empty to include inactive items", status)
			}
			if limit := r.URL.Query().Get("limit"); limit != strconv.Itoa(catalogPageSize) {
				t.Errorf("limit = %q", limit)
			}
			offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
			mu.Lock()
			offsets = append(offsets, offset)
			mu.Unlock()
			results := []string{"MLB-PAUSED", "MLB-ACTIVE"}
			if offset > 0 {
				results = []string{"MLB-CLOSED"}
			}
			_ = json.NewEncoder(w).Encode(map[string]any{
				"paging":  map[string]any{"total": 3, "offset": offset, "limit": catalogPageSize},
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
	gotOffsets := append([]int(nil), offsets...)
	mu.Unlock()
	if fmt.Sprint(gotOffsets) != "[0 2]" {
		t.Fatalf("offsets = %v, want [0 2]", gotOffsets)
	}
	if result.Items[0].Status != "paused" || result.Items[1].Status != "active" || result.Items[2].Status != "paused" {
		t.Fatalf("unexpected normalized statuses: %#v", result.Items)
	}
	if result.Message != "3 anuncio(s) encontrados no Mercado Livre" {
		t.Fatalf("message = %q", result.Message)
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
