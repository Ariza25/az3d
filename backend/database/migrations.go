package database

import (
	"fmt"
	"log"

	"az3d-backend/models"

	"gorm.io/gorm"
)

// runAutoMigrate performs GORM schema migrations and configures tenant integrity constraints.
func runAutoMigrate(db *gorm.DB) error {
	// Limpeza preventiva: zeramos tenant_id de linhas órfãs antes de criar FK constraints
	// (evita erro SQLSTATE 23503 ao reiniciar após mudança de schema)
	if err := cleanupOrphanedRows(db); err != nil {
		return fmt.Errorf("remover registros orfaos antes da migracao: %w", err)
	}
	db.Exec("DROP INDEX IF EXISTS idx_marketplace_account_provider")
	db.Exec("DROP INDEX IF EXISTS idx_external_order")

	// Auto Migration das tabelas
	err := db.AutoMigrate(
		&models.Tenant{},
		&models.TenantSettings{},
		&models.TenantStoreSettings{},
		&models.TenantPricingSettings{},
		&models.TenantFulfillmentSettings{},
		&models.TenantMarketplaceSettings{},
		&models.MaterialPreset{},
		&models.PrinterPreset{},
		&models.PlatformFeePreset{},
		&models.User{},
		&models.Category{},
		&models.Product{},
		&models.ProductColorImage{},
		&models.ProductVariant{},
		&models.ProductColorStock{},
		&models.StockMovement{},
		&models.TenantCarrierAccount{},
		&models.OrderShipment{},
		&models.ShipmentEvent{},
		&models.ProductReview{},
		&models.ProductFavorite{},
		&models.ProductPricingSnapshot{},
		&models.ProductActualCost{},
		&models.TenantFixedCost{},
		&models.Order{},
		&models.OrderItem{},
		&models.MarketplaceProductMapping{},
		&models.MarketplaceAccount{},
		&models.ExternalMarketplaceOrder{},
		&models.ExternalMarketplaceOrderItem{},
		&models.MarketplaceWebhookEvent{},
		&models.PaymentWebhookEvent{},
		&models.MercadoPagoPlatformConfig{},
		&models.TenantPaymentAccount{},
		&models.PaymentOAuthSession{},
		&models.MercadoLivrePlatformConfig{},
		&models.MarketplaceOAuthSession{},
		&models.FilamentSpool{},
		&models.Custom3DQuote{},
	)
	if err != nil {
		return err
	}

	// Backfill automation fields before enforcing webhook idempotency.
	db.Exec("UPDATE marketplace_accounts SET sync_catalog = true WHERE sync_catalog IS NULL")
	db.Exec("UPDATE marketplace_webhook_events SET dedup_key = 'legacy-' || id::text WHERE dedup_key IS NULL OR dedup_key = ''")
	db.Exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_marketplace_webhook_dedup_key ON marketplace_webhook_events (dedup_key)")

	if err := ensureTenantCascadeConstraints(db); err != nil {
		return fmt.Errorf("configurar exclusao em cascata por tenant: %w", err)
	}

	return nil
}

// cleanupOrphanedRows removes rows whose tenant no longer exists before the
// database starts enforcing tenant foreign keys.
func cleanupOrphanedRows(db *gorm.DB) error {
	var tenantsTableExists bool
	if err := db.Raw(
		"SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'tenants')",
	).Scan(&tenantsTableExists).Error; err != nil {
		return err
	}
	if !tenantsTableExists {
		return nil
	}

	for _, table := range tenantScopedTables {
		var colExists int64
		if err := db.Raw(
			"SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = ? AND column_name = 'tenant_id'",
			table,
		).Scan(&colExists).Error; err != nil {
			return err
		}
		if colExists == 0 {
			continue
		}

		result := db.Exec(fmt.Sprintf(
			`DELETE FROM "%s" AS scoped WHERE scoped.tenant_id IS NULL OR NOT EXISTS (SELECT 1 FROM "tenants" AS tenant WHERE tenant.id = scoped.tenant_id)`,
			table,
		))
		if result.Error != nil {
			return fmt.Errorf("limpar tabela %s: %w", table, result.Error)
		}
		if result.RowsAffected > 0 {
			log.Printf("[cleanup] Removidos %d registros orfaos da tabela '%s'", result.RowsAffected, table)
		}
	}
	return nil
}

func ensureTenantCascadeConstraints(db *gorm.DB) error {
	return db.Transaction(func(tx *gorm.DB) error {
		for _, table := range tenantScopedTables {
			constraint := "fk_" + table + "_tenant_cascade"
			if err := tx.Exec(fmt.Sprintf(
				`ALTER TABLE "%s" DROP CONSTRAINT IF EXISTS "%s"`,
				table,
				constraint,
			)).Error; err != nil {
				return fmt.Errorf("remover constraint %s: %w", constraint, err)
			}
			if err := tx.Exec(fmt.Sprintf(
				`ALTER TABLE "%s" ADD CONSTRAINT "%s" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON UPDATE CASCADE ON DELETE CASCADE`,
				table,
				constraint,
			)).Error; err != nil {
				return fmt.Errorf("criar constraint %s: %w", constraint, err)
			}
		}

		if err := tx.Exec(`DELETE FROM "order_items" AS item WHERE NOT EXISTS (SELECT 1 FROM "orders" AS parent_order WHERE parent_order.id = item.order_id)`).Error; err != nil {
			return fmt.Errorf("limpar itens de pedido orfaos: %w", err)
		}
		const orderItemsConstraint = "fk_order_items_order_cascade"
		if err := tx.Exec(`ALTER TABLE "order_items" DROP CONSTRAINT IF EXISTS "` + orderItemsConstraint + `"`).Error; err != nil {
			return fmt.Errorf("remover constraint %s: %w", orderItemsConstraint, err)
		}
		if err := tx.Exec(`ALTER TABLE "order_items" ADD CONSTRAINT "` + orderItemsConstraint + `" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON UPDATE CASCADE ON DELETE CASCADE`).Error; err != nil {
			return fmt.Errorf("criar constraint %s: %w", orderItemsConstraint, err)
		}
		return nil
	})
}
