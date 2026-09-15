package handlers

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
)

func TestMarketplaceImportedProductStatusUsesConfiguredStatusForNewInactiveProduct(t *testing.T) {
	tests := []struct {
		name              string
		marketplaceStatus string
		configuredStatus  string
		want              string
	}{
		{name: "paused becomes draft", marketplaceStatus: "paused", configuredStatus: "draft", want: "draft"},
		{name: "closed becomes draft", marketplaceStatus: "closed", configuredStatus: "draft", want: "draft"},
		{name: "inactive becomes draft", marketplaceStatus: "inactive", configuredStatus: "draft", want: "draft"},
		{name: "active honors configured active", marketplaceStatus: "active", configuredStatus: "active", want: "active"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got := marketplaceImportedProductStatus("shopee", false, test.marketplaceStatus, test.configuredStatus)
			if got != test.want {
				t.Fatalf("status = %q, want %q", got, test.want)
			}
		})
	}
}

func TestMarketplaceImportedProductStatusPublishesEveryMercadoLivreItem(t *testing.T) {
	for _, productFound := range []bool{false, true} {
		for _, externalStatus := range []string{"active", "paused", "draft", "closed", "inactive", ""} {
			if got := marketplaceImportedProductStatus("mercadolivre", productFound, externalStatus, "draft"); got != "active" {
				t.Fatalf("Mercado Livre status with productFound=%v and externalStatus=%q = %q, want active", productFound, externalStatus, got)
			}
		}
	}
}

func TestDisconnectMarketplaceAccount(t *testing.T) {
	gin.SetMode(gin.TestMode)
	mock := installMarketplaceOAuthMockDB(t)

	// Expect UPDATE
	mock.ExpectBegin()
	mock.ExpectExec(`UPDATE "marketplace_accounts" SET`).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	// Expect SELECT First
	mock.ExpectQuery(`SELECT .* FROM "marketplace_accounts"`).
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "provider", "is_connected", "sync_status", "seller_id"}).
			AddRow(1, 1, "mercadolivre", false, "pending_credentials", ""))

	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)
	ctx.Set("tenant_id", uint(1))
	ctx.Request = httptest.NewRequest("POST", "/api/admin/marketplaces/disconnect", strings.NewReader(`{"provider":"mercadolivre"}`))
	ctx.Request.Header.Set("Content-Type", "application/json")

	h := &MarketplaceHandler{}
	h.DisconnectMarketplaceAccount(ctx)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "pending_credentials") {
		t.Fatalf("response body expected pending_credentials: %s", w.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet sqlmock expectations: %v", err)
	}
}

