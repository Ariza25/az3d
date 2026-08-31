package handlers

import (
	"testing"
	"time"

	"az3d-backend/internal/marketplaces"
	"az3d-backend/models"
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
