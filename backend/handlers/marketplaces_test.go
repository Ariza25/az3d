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

func TestMarketplaceImportedProductStatusNormalizesExistingExternalStatus(t *testing.T) {
	if got := marketplaceImportedProductStatus("mercadolivre", true, "closed", "draft"); got != "paused" {
		t.Fatalf("closed existing product status = %q, want paused", got)
	}
	if got := marketplaceImportedProductStatus("mercadolivre", true, "active", "draft"); got != "active" {
		t.Fatalf("active existing product status = %q, want active", got)
	}
}

func TestMarketplaceImportedProductStatusPublishesNewMercadoLivreItem(t *testing.T) {
	if got := marketplaceImportedProductStatus("mercadolivre", false, "active", "draft"); got != "active" {
		t.Fatalf("new Mercado Livre product status = %q, want active", got)
	}
}
