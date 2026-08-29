package mcpserver

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"az3d-backend/internal/marketplaces"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

type fakeConnector struct {
	testErr      error
	catalog      marketplaces.CatalogSyncResult
	orders       marketplaces.OrderSyncResult
	refreshToken marketplaces.TokenResult
	refreshCalls int
}

func (f *fakeConnector) Provider() string { return "mercadolivre" }
func (f *fakeConnector) ExchangeAuthCode(context.Context, marketplaces.Account, marketplaces.TokenRequest) (marketplaces.TokenResult, error) {
	return marketplaces.TokenResult{}, nil
}
func (f *fakeConnector) RefreshAccessToken(context.Context, marketplaces.Account) (marketplaces.TokenResult, error) {
	f.refreshCalls++
	return f.refreshToken, nil
}
func (f *fakeConnector) TestConnection(context.Context, marketplaces.Account) error {
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
			GrossAmount: 63.80, NetAmount: 54.00, BuyerNickname: "dado-pessoal",
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

func TestEnvironmentAccountSourceSerializesRefreshAndRotatesToken(t *testing.T) {
	storePath := filepath.Join(t.TempDir(), "meli-token.enc")
	t.Setenv("MELI_SELLER_ID", "12345")
	t.Setenv("MELI_ACCESS_TOKEN", "expired")
	t.Setenv("MELI_REFRESH_TOKEN", "refresh-once")
	t.Setenv("MELI_TOKEN_EXPIRES_AT", "2026-01-01T00:00:00Z")
	t.Setenv("MELI_TOKEN_STORE_PATH", storePath)
	t.Setenv("CREDENTIAL_ENCRYPTION_KEY", "0123456789abcdef0123456789abcdef")

	connector := &fakeConnector{refreshToken: marketplaces.TokenResult{
		AccessToken: "fresh", RefreshToken: "refresh-next", SellerID: "12345",
		ExpiresAt: time.Now().Add(6 * time.Hour),
	}}
	source := NewEnvironmentAccountSource(connector)

	type accountResult struct {
		account marketplaces.Account
		err     error
	}
	results := make(chan accountResult, 12)
	for range 12 {
		go func() {
			account, err := source.Account(context.Background())
			results <- accountResult{account: account, err: err}
		}()
	}
	var account marketplaces.Account
	for range 12 {
		result := <-results
		if result.err != nil {
			t.Fatal(result.err)
		}
		account = result.account
	}
	if account.AccessToken != "fresh" || account.RefreshToken != "refresh-next" {
		t.Fatalf("token rotation not applied: %#v", account)
	}
	if connector.refreshCalls != 1 {
		t.Fatalf("refresh calls = %d, want 1", connector.refreshCalls)
	}

	if _, err := source.Account(context.Background()); err != nil {
		t.Fatal(err)
	}
	if connector.refreshCalls != 1 {
		t.Fatalf("fresh token was refreshed again: %d calls", connector.refreshCalls)
	}

	raw, err := os.ReadFile(storePath)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(raw), "fresh") || strings.Contains(string(raw), "refresh-next") {
		t.Fatalf("token store contains plaintext credentials: %s", raw)
	}

	t.Setenv("MELI_ACCESS_TOKEN", "")
	t.Setenv("MELI_REFRESH_TOKEN", "")
	reloaded := NewEnvironmentAccountSource(connector)
	account, err = reloaded.Account(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if account.AccessToken != "fresh" || account.RefreshToken != "refresh-next" {
		t.Fatalf("persisted credentials were not reloaded: %#v", account)
	}
}

func TestEnvironmentAccountSourceRefusesUnpersistedRefresh(t *testing.T) {
	t.Setenv("MELI_SELLER_ID", "12345")
	t.Setenv("MELI_ACCESS_TOKEN", "expired")
	t.Setenv("MELI_REFRESH_TOKEN", "refresh-once")
	t.Setenv("MELI_TOKEN_EXPIRES_AT", "2026-01-01T00:00:00Z")
	t.Setenv("MELI_TOKEN_STORE_PATH", "")
	t.Setenv("CREDENTIAL_ENCRYPTION_KEY", "")

	connector := &fakeConnector{}
	_, err := NewEnvironmentAccountSource(connector).Account(context.Background())
	if !errors.Is(err, ErrTokenPersistenceMissing) {
		t.Fatalf("unpersisted refresh should be rejected: %v", err)
	}
	if connector.refreshCalls != 0 {
		t.Fatalf("refresh consumed without persistence: %d calls", connector.refreshCalls)
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
