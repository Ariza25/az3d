package handlers

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"net/http/httptest"
	"testing"
	"time"

	"az3d-backend/config"
	"az3d-backend/internal/marketplaces"
	"az3d-backend/models"

	"github.com/gin-gonic/gin"
)

func TestPendingMarketplaceItemIDsDeduplicatesNotifications(t *testing.T) {
	events := []models.MarketplaceWebhookEvent{
		{ExternalID: " MLB1 ", ReceivedAt: time.Now()},
		{ExternalID: "MLB2", ReceivedAt: time.Now()},
		{ExternalID: "MLB1", ReceivedAt: time.Now()},
		{ExternalID: "", ReceivedAt: time.Now()},
	}

	got := pendingMarketplaceItemIDs(events)
	if len(got) != 2 || got[0] != "MLB1" || got[1] != "MLB2" {
		t.Fatalf("IDs = %#v, want [MLB1 MLB2]", got)
	}
}

func TestMarketplaceWebhookDedupKeyIsStable(t *testing.T) {
	payload := map[string]any{"_id": "notification-123", "topic": "items", "resource": "/items/MLB1"}
	first := marketplaceWebhookDedupKey("meli", payload)
	second := marketplaceWebhookDedupKey("mercadolivre", payload)
	if first == "" || first != second { t.Fatalf("dedup keys differ: %q != %q", first, second) }
}

func TestMercadoLivreWebhookApplicationMustMatchConfiguredApp(t *testing.T) {
	handler := NewMarketplaceHandler(&config.Config{MercadoLivreClientID: "12345"})
	if handler.validMercadoLivreWebhookApplication(map[string]any{"application_id": "999"}) { t.Fatal("unexpected application acceptance") }
	if !handler.validMercadoLivreWebhookApplication(map[string]any{"application_id": float64(12345)}) { t.Fatal("configured application should be accepted") }
}

func TestMarketplaceWebhookSignature(t *testing.T) {
	gin.SetMode(gin.TestMode)
	body := []byte(`{"topic":"items"}`); secret := "test-webhook-secret"
	mac := hmac.New(sha256.New, []byte(secret)); _, _ = mac.Write(body)
	request := httptest.NewRequest("POST", "/api/webhooks/marketplaces/mercadolivre", nil)
	request.Header.Set("X-Signature", "sha256="+hex.EncodeToString(mac.Sum(nil)))
	context, _ := gin.CreateTestContext(httptest.NewRecorder()); context.Request = request
	handler := NewMarketplaceHandler(&config.Config{MercadoLivreWebhookSecret: secret})
	if !handler.validMarketplaceWebhookSignature(context, body) { t.Fatal("valid signature rejected") }
	if handler.validMarketplaceWebhookSignature(context, []byte(`{"topic":"orders"}`)) { t.Fatal("tampered body accepted") }
}

func TestUniqueMarketplaceCatalogItemsKeepsLatestItemWithoutChangingOrder(t *testing.T) {
	items := []marketplaces.CatalogItem{
		{ExternalItemID: "MLB1", Title: "old"},
		{ExternalItemID: "MLB2", Title: "second"},
		{ExternalItemID: "MLB1", Title: "new"},
		{ExternalItemID: "", Title: "invalid"},
	}

	got := uniqueMarketplaceCatalogItems(items)
	if len(got) != 2 {
		t.Fatalf("items = %#v", got)
	}
	if got[0].ExternalItemID != "MLB1" || got[0].Title != "new" || got[1].ExternalItemID != "MLB2" {
		t.Fatalf("unexpected deduplication: %#v", got)
	}
}
