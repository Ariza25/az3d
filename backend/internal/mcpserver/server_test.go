package mcpserver

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"az3d-backend/internal/marketplaces"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

type fakeConnector struct {
	testErr        error
	testErrors     []error
	testCalls      int
	catalog        marketplaces.CatalogSyncResult
	orders         marketplaces.OrderSyncResult
	refreshToken   marketplaces.TokenResult
	refreshAccount marketplaces.Account
	refreshCalls   int
}

func (f *fakeConnector) Provider() string { return "mercadolivre" }
func (f *fakeConnector) ExchangeAuthCode(context.Context, marketplaces.Account, marketplaces.TokenRequest) (marketplaces.TokenResult, error) {
	return marketplaces.TokenResult{}, nil
}
func (f *fakeConnector) RefreshAccessToken(_ context.Context, account marketplaces.Account) (marketplaces.TokenResult, error) {
	f.refreshCalls++
	f.refreshAccount = account
	return f.refreshToken, nil
}
func (f *fakeConnector) TestConnection(context.Context, marketplaces.Account) error {
	f.testCalls++
	if f.testCalls <= len(f.testErrors) {
		return f.testErrors[f.testCalls-1]
	}
	return f.testErr
}
func (f *fakeConnector) FetchCatalog(context.Context, marketplaces.Account) (marketplaces.CatalogSyncResult, error) {
	return f.catalog, nil
}
func (f *fakeConnector) FetchOrders(context.Context, marketplaces.Account, marketplaces.OrderSyncInput) (marketplaces.OrderSyncResult, error) {
	return f.orders, nil
}

type staticAccountSource struct{ account marketplaces.Account }

func (s staticAccountSource) Account(context.Context) (marketplaces.Account, error) {
	return s.account, nil
}

func TestMCPExposesOnlyReadToolsAndRedactsBuyerData(t *testing.T) {
	connector := &fakeConnector{
		catalog: marketplaces.CatalogSyncResult{Items: []marketplaces.CatalogItem{{
			ExternalItemID: "MLB123", ExternalSKU: "VASO-01", Title: "Vaso Ondulado",
			Price: 31.90, StockQty: 10, Status: "active",
		}}},
		orders: marketplaces.OrderSyncResult{Orders: []marketplaces.Order{{
			ExternalOrderID: "2000001", Status: "paid", Currency: "BRL",
			GrossAmount: 63.80, NetAmount: 54.00, BuyerNickname: "dado-pessoal", FinancialComplete: true,
			OrderedAt: time.Date(2026, 8, 29, 12, 0, 0, 0, time.UTC),
			Items: []marketplaces.OrderItem{{
				ExternalItemID: "MLB123", ExternalSKU: "VASO-01", Title: "Vaso Ondulado",
				Quantity: 2, UnitPrice: 31.90,
			}},
		}}},
	}
	service := New(connector, staticAccountSource{account: marketplaces.Account{
		SellerID: "12345", AccessToken: "secret-token",
	}})

	serverTransport, clientTransport := mcp.NewInMemoryTransports()
	serverSession, err := service.MCPServer().Connect(context.Background(), serverTransport, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer serverSession.Close()

	client := mcp.NewClient(&mcp.Implementation{Name: "az3d-test", Version: "1"}, nil)
	clientSession, err := client.Connect(context.Background(), clientTransport, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer clientSession.Close()

	tools, err := clientSession.ListTools(context.Background(), nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(tools.Tools) != 4 {
		t.Fatalf("tools = %d, want 4", len(tools.Tools))
	}
	for _, tool := range tools.Tools {
		if tool.Annotations == nil || !tool.Annotations.ReadOnlyHint {
			t.Fatalf("tool %s is not marked read-only", tool.Name)
		}
	}

	result, err := clientSession.CallTool(context.Background(), &mcp.CallToolParams{
		Name: "meli_list_orders", Arguments: map[string]any{"days": 7, "limit": 10},
	})
	if err != nil {
		t.Fatal(err)
	}
	if result.IsError {
		t.Fatalf("tool returned error: %#v", result.Content)
	}
	raw, err := json.Marshal(result.StructuredContent)
	if err != nil {
		t.Fatal(err)
	}
	payload := string(raw)
	if strings.Contains(payload, "dado-pessoal") || strings.Contains(payload, "buyer") {
		t.Fatalf("buyer data leaked in MCP output: %s", payload)
	}
	if !strings.Contains(payload, "2000001") || !strings.Contains(payload, "Vaso Ondulado") {
		t.Fatalf("expected operational order fields missing: %s", payload)
	}
}

func TestToolRejectsUnsafeQueryRanges(t *testing.T) {
	service := New(&fakeConnector{}, staticAccountSource{account: marketplaces.Account{
		SellerID: "12345", AccessToken: "token",
	}})
	_, _, err := service.listOrders(context.Background(), nil, ListOrdersInput{Days: 365, Limit: 10})
	if err == nil || !strings.Contains(err.Error(), "days") {
		t.Fatalf("invalid days accepted: %v", err)
	}
	_, _, err = service.listItems(context.Background(), nil, ListItemsInput{Limit: 500})
	if err == nil || !strings.Contains(err.Error(), "limit") {
		t.Fatalf("invalid limit accepted: %v", err)
	}
}

func TestSalesSummaryAggregatesAllFinancialFieldsAndReportsIncompleteOrders(t *testing.T) {
	connector := &fakeConnector{orders: marketplaces.OrderSyncResult{Orders: []marketplaces.Order{
		{
			ExternalOrderID: "1", Currency: "BRL", GrossAmount: 100, NetAmount: 84,
			MarketplaceFees: 10, ShippingCost: 6, DiscountAmount: 7, FinancialComplete: true,
			Items: []marketplaces.OrderItem{{ExternalItemID: "MLB1", Title: "Produto A", Quantity: 2}},
		},
		{
			ExternalOrderID: "2", Currency: "BRL", GrossAmount: 50, NetAmount: 45,
			MarketplaceFees: 5, FinancialComplete: false,
			Items: []marketplaces.OrderItem{{ExternalItemID: "MLB2", Title: "Produto B", Quantity: 1}},
		},
	}}}
	service := New(connector, staticAccountSource{account: marketplaces.Account{SellerID: "12345", AccessToken: "token"}})

	_, summary, err := service.salesSummary(context.Background(), nil, SalesSummaryInput{Days: 30})
	if err != nil {
		t.Fatal(err)
	}
	if summary.OrderCount != 2 || summary.UnitsSold != 3 || summary.GrossAmount != 150 || summary.NetAmount != 129 {
		t.Fatalf("unexpected summary totals: %#v", summary)
	}
	if summary.MarketplaceFees != 15 || summary.ShippingCost != 6 || summary.DiscountAmount != 7 {
		t.Fatalf("unexpected summary deductions: %#v", summary)
	}
	if summary.FinancialComplete || summary.IncompleteOrders != 1 || !strings.Contains(summary.Message, "1 pedido") {
		t.Fatalf("incomplete financials were not reported: %#v", summary)
	}
}
