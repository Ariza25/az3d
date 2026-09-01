package database

import (
	"reflect"
	"testing"

	"az3d-backend/models"

	"gorm.io/gorm/schema"
)

func TestTenantScopedTablesCoversPersistedTenantModels(t *testing.T) {
	persistedModels := []any{
		models.TenantSettings{},
		models.TenantStoreSettings{},
		models.TenantPricingSettings{},
		models.TenantFulfillmentSettings{},
		models.TenantMarketplaceSettings{},
		models.MaterialPreset{},
		models.PrinterPreset{},
		models.PlatformFeePreset{},
		models.User{},
		models.Category{},
		models.Product{},
		models.ProductColorImage{},
		models.ProductVariant{},
		models.ProductColorStock{},
		models.StockMovement{},
		models.TenantCarrierAccount{},
		models.OrderShipment{},
		models.ShipmentEvent{},
		models.ProductReview{},
		models.ProductFavorite{},
		models.ProductPricingSnapshot{},
		models.ProductActualCost{},
		models.TenantFixedCost{},
		models.Order{},
		models.MarketplaceProductMapping{},
		models.MarketplaceAccount{},
		models.ExternalMarketplaceOrder{},
		models.ExternalMarketplaceOrderItem{},
		models.MarketplaceWebhookEvent{},
		models.PaymentWebhookEvent{},
		models.TenantPaymentAccount{},
		models.PaymentOAuthSession{},
		models.MarketplaceOAuthSession{},
	}

	configured := make(map[string]struct{}, len(tenantScopedTables))
	for _, table := range tenantScopedTables {
		if _, duplicate := configured[table]; duplicate {
			t.Fatalf("duplicate tenant-scoped table %q", table)
		}
		configured[table] = struct{}{}
	}

	naming := schema.NamingStrategy{}
	for _, model := range persistedModels {
		modelType := reflect.TypeOf(model)
		if _, found := modelType.FieldByName("TenantID"); !found {
			t.Fatalf("test model %s is not tenant-scoped", modelType.Name())
		}
		table := naming.TableName(modelType.Name())
		if _, found := configured[table]; !found {
			t.Errorf("tenant-scoped model %s is missing table %q from cascade constraints", modelType.Name(), table)
		}
	}

	// marketplace_integrations is intentionally retained only as a historical
	// database table so tenant deletion still cleans data created by old builds.
	if len(configured) != len(persistedModels)+1 {
		t.Fatalf("cascade table count = %d, tenant model count = %d plus historical table", len(configured), len(persistedModels))
	}
}
