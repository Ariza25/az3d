package handlers

import "testing"

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
