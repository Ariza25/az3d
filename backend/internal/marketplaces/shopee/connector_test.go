package shopee

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	mp "az3d-backend/internal/marketplaces"
)

func setShopeeTestCredentials(t *testing.T, baseURL string) {
	t.Helper()
	t.Setenv("SHOPEE_PARTNER_ID", "12345")
	t.Setenv("SHOPEE_PARTNER_KEY", "partner-secret")
	t.Setenv("SHOPEE_API_BASE_URL", baseURL)
}

func TestUnauthorizedResponseIsTypedAndDoesNotExposeCredentials(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, `{"message":"secret-token invalid"}`, http.StatusUnauthorized)
	}))
	defer server.Close()
	setShopeeTestCredentials(t, server.URL)

	err := New().TestConnection(context.Background(), mp.Account{ShopID: "98765", AccessToken: "secret-token"})
	if !IsUnauthorized(err) {
		t.Fatalf("expected typed unauthorized error, got %v", err)
	}
	if strings.Contains(fmt.Sprint(err), "secret-token") {
		t.Fatalf("credential leaked in error: %v", err)
	}
}

func TestFetchCatalogPaginatesAllActiveItems(t *testing.T) {
	var mu sync.Mutex
	offsets := []int{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("sign") == "" || r.URL.Query().Get("shop_id") != "98765" {
			t.Errorf("request was not signed for the shop: %s", r.URL.String())
		}
		switch r.URL.Path {
		case "/api/v2/product/get_item_list":
			offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
			mu.Lock()
			offsets = append(offsets, offset)
			mu.Unlock()
			if offset == 0 {
				_ = json.NewEncoder(w).Encode(map[string]any{"response": map[string]any{
					"item": []map[string]any{{"item_id": 1}, {"item_id": 2}}, "has_next_page": true, "next_offset": 2,
				}})
				return
			}
			_ = json.NewEncoder(w).Encode(map[string]any{"response": map[string]any{
				"item": []map[string]any{{"item_id": 3}}, "has_next_page": false,
			}})
		case "/api/v2/product/get_item_base_info":
			ids := strings.Split(r.URL.Query().Get("item_id_list"), ",")
			items := make([]map[string]any, 0, len(ids))
			for _, id := range ids {
				itemID, _ := strconv.ParseInt(id, 10, 64)
				items = append(items, map[string]any{
					"item_id": itemID, "item_sku": "SKU-" + id, "item_name": "Produto " + id,
					"item_status": "NORMAL", "price_info": []map[string]any{{"current_price": 10}},
				})
			}
			_ = json.NewEncoder(w).Encode(map[string]any{"response": map[string]any{"item_list": items}})
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()
	setShopeeTestCredentials(t, server.URL)

	result, err := New().FetchCatalog(context.Background(), mp.Account{ShopID: "98765", AccessToken: "token"})
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Items) != 3 {
		t.Fatalf("items = %d, want 3", len(result.Items))
	}
	mu.Lock()
	gotOffsets := append([]int(nil), offsets...)
	mu.Unlock()
	if fmt.Sprint(gotOffsets) != "[0 2]" {
		t.Fatalf("offsets = %v, want [0 2]", gotOffsets)
	}
}

func TestFetchOrdersSplitsWindowsPaginatesAndUsesEscrowFinancials(t *testing.T) {
	now := time.Date(2026, 8, 30, 12, 0, 0, 0, time.UTC)
	firstStart := now.AddDate(0, 0, -20).Unix()
	firstEnd := now.AddDate(0, 0, -5).Unix()
	var mu sync.Mutex
	listCalls := []url.Values{}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/v2/order/get_order_list":
			query := r.URL.Query()
			mu.Lock()
			listCalls = append(listCalls, query)
			mu.Unlock()
			from, _ := strconv.ParseInt(query.Get("time_from"), 10, 64)
			to, _ := strconv.ParseInt(query.Get("time_to"), 10, 64)
			if from == firstStart && to == firstEnd && query.Get("cursor") == "" {
				_ = json.NewEncoder(w).Encode(map[string]any{"response": map[string]any{
					"order_list": []map[string]any{{"order_sn": "ORDER-A"}}, "more": true, "next_cursor": "cursor-2",
				}})
				return
			}
			if query.Get("cursor") == "cursor-2" {
				_ = json.NewEncoder(w).Encode(map[string]any{"response": map[string]any{
					"order_list": []map[string]any{{"order_sn": "ORDER-B"}}, "more": false,
				}})
				return
			}
			_ = json.NewEncoder(w).Encode(map[string]any{"response": map[string]any{
				"order_list": []map[string]any{{"order_sn": "ORDER-C"}, {"order_sn": "ORDER-CANCELLED"}}, "more": false,
			}})
		case "/api/v2/order/get_order_detail":
			_ = json.NewEncoder(w).Encode(map[string]any{"response": map[string]any{"order_list": []map[string]any{
				shopeeOrderJSON("ORDER-A", "COMPLETED", now.Add(-72*time.Hour), 40, 2, 12, 10),
				shopeeOrderJSON("ORDER-B", "SHIPPED", now.Add(-48*time.Hour), 20, 1, 5, 3),
				shopeeOrderJSON("ORDER-C", "COMPLETED", now.Add(-24*time.Hour), 30, 1, 4, 4),
				shopeeOrderJSON("ORDER-CANCELLED", "CANCELLED", now.Add(-time.Hour), 99, 1, 0, 0),
			}}})
		case "/api/v2/payment/get_escrow_detail":
			if r.URL.Query().Get("order_sn") == "ORDER-A" {
				_ = json.NewEncoder(w).Encode(map[string]any{"response": map[string]any{"order_income": map[string]any{
					"escrow_amount": 69, "commission_fee": 5, "service_fee": 2, "seller_transaction_fee": 1,
					"final_shipping_fee": -3, "seller_discount": 4, "voucher_from_seller": 2, "seller_coin_cash_back": 1,
				}}})
				return
			}
			_ = json.NewEncoder(w).Encode(map[string]any{"error": "error_not_found", "message": "not released"})
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()
	setShopeeTestCredentials(t, server.URL)
	connector := New()
	connector.now = func() time.Time { return now }

	result, err := connector.FetchOrders(context.Background(), mp.Account{ShopID: "98765", AccessToken: "token"}, mp.OrderSyncInput{Days: 20})
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Orders) != 3 {
		t.Fatalf("paid orders = %d, want 3: %#v", len(result.Orders), result.Orders)
	}
	mu.Lock()
	callCount := len(listCalls)
	mu.Unlock()
	if callCount != 3 {
		t.Fatalf("order-list calls = %d, want 3 (two windows plus cursor)", callCount)
	}

	byID := map[string]mp.Order{}
	for _, order := range result.Orders {
		byID[order.ExternalOrderID] = order
	}
	completed := byID["ORDER-A"]
	if !completed.FinancialComplete || completed.GrossAmount != 80 || completed.NetAmount != 69 || completed.MarketplaceFees != 8 || completed.ShippingCost != 3 || completed.DiscountAmount != 7 {
		t.Fatalf("unexpected escrow financials: %#v", completed)
	}
	if byID["ORDER-B"].FinancialComplete || byID["ORDER-C"].FinancialComplete {
		t.Fatalf("unreleased/unavailable financials were marked complete: %#v", byID)
	}
	orderedIDs := []string{result.Orders[0].ExternalOrderID, result.Orders[1].ExternalOrderID, result.Orders[2].ExternalOrderID}
	if fmt.Sprint(orderedIDs) != "[ORDER-C ORDER-B ORDER-A]" {
		t.Fatalf("orders are not newest first: %v", orderedIDs)
	}
}

func shopeeOrderJSON(orderSN, status string, createdAt time.Time, price float64, quantity int, actualShipping, buyerShipping float64) map[string]any {
	return map[string]any{
		"order_sn": orderSN, "order_status": status, "currency": "BRL", "create_time": createdAt.Unix(),
		"actual_shipping_fee": actualShipping, "buyer_paid_shipping_fee": buyerShipping,
		"item_list": []map[string]any{{
			"item_id": 1, "item_name": "Produto", "item_sku": "SKU", "model_quantity_purchased": quantity,
			"model_discounted_price": price,
		}},
	}
}
