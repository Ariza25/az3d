package database

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"log"
	"strings"

	"az3d-backend/config"
	"az3d-backend/models"
	"az3d-backend/utils"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

var tenantScopedTables = []string{
	"tenant_settings",
	"tenant_store_settings",
	"tenant_pricing_settings",
	"tenant_fulfillment_settings",
	"tenant_marketplace_settings",
	"material_presets",
	"printer_presets",
	"platform_fee_presets",
	"users",
	"categories",
	"products",
	"product_color_images",
	"product_variants",
	"product_color_stocks",
	"stock_movements",
	"tenant_carrier_accounts",
	"order_shipments",
	"shipment_events",
	"product_reviews",
	"product_favorites",
	"product_pricing_snapshots",
	"product_actual_costs",
	"tenant_fixed_costs",
	"orders",
	"marketplace_integrations",
	"marketplace_product_mappings",
	"marketplace_accounts",
	"external_marketplace_orders",
	"external_marketplace_order_items",
	"marketplace_webhook_events",
	"payment_webhook_events",
	"tenant_payment_accounts",
	"payment_o_auth_sessions",
	"marketplace_o_auth_sessions",
}

// OpenExistingDB opens the platform database without migrations or bootstrap.
// It is intended for auxiliary processes such as the tenant-scoped MCP server.
func OpenExistingDB(cfg *config.Config) (*gorm.DB, error) {
	dsn := cfg.DatabaseURL
	if dsn == "" {
		dsn = fmt.Sprintf(
			"host=%s user=%s password=%s dbname=%s port=%s sslmode=%s TimeZone=UTC",
			cfg.DBHost, cfg.DBUser, cfg.DBPassword, cfg.DBName, cfg.DBPort, cfg.DBSSLMode,
		)
	}
	return gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger:                                   logger.Default.LogMode(logger.Warn),
		DisableForeignKeyConstraintWhenMigrating: true,
	})
}

func InitDB(cfg *config.Config) *gorm.DB {
	var db *gorm.DB
	var err error

	// 1. DATABASE_URL e o formato preferencial para provedores gerenciados como Neon.
	// As variaveis DB_* continuam disponiveis para desenvolvimento local e Docker Compose.
	dsn := cfg.DatabaseURL
	if dsn == "" {
		dsn = fmt.Sprintf(
			"host=%s user=%s password=%s dbname=%s port=%s sslmode=%s TimeZone=UTC",
			cfg.DBHost, cfg.DBUser, cfg.DBPassword, cfg.DBName, cfg.DBPort, cfg.DBSSLMode,
		)
	}

	if cfg.DatabaseURL != "" {
		log.Println("Conectando ao banco de dados PostgreSQL via DATABASE_URL...")
	} else {
		log.Printf("Conectando ao banco de dados PostgreSQL (%s:%s/%s)...", cfg.DBHost, cfg.DBPort, cfg.DBName)
	}
	db, err = gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger:                                   logger.Default.LogMode(logger.Warn),
		DisableForeignKeyConstraintWhenMigrating: true,
	})

	// 2. Se o banco 'az3d_db' ainda não existir, tenta conectar ao banco padrão 'postgres' para criá-lo automaticamente
	if err != nil && cfg.DatabaseURL == "" {
		log.Printf("Tentando verificar/criar o banco de dados '%s' no PostgreSQL...", cfg.DBName)
		dsnRoot := fmt.Sprintf(
			"host=%s user=%s password=%s dbname=postgres port=%s sslmode=%s TimeZone=UTC",
			cfg.DBHost, cfg.DBUser, cfg.DBPassword, cfg.DBPort, cfg.DBSSLMode,
		)

		rootDB, rootErr := gorm.Open(postgres.Open(dsnRoot), &gorm.Config{})
		if rootErr == nil {
			// Executa CREATE DATABASE
			rootDB.Exec(fmt.Sprintf("CREATE DATABASE %s;", cfg.DBName))
			// Tenta conectar novamente
			db, err = gorm.Open(postgres.Open(dsn), &gorm.Config{
				Logger:                                   logger.Default.LogMode(logger.Error),
				DisableForeignKeyConstraintWhenMigrating: true,
			})
		}
	}

	if err != nil {
		log.Printf("=================================================================================")
		log.Printf("ERRO DE CONEXÃO AO POSTGRESQL: %v", err)
		log.Printf("Por favor, verifique a senha/usuário do seu PostgreSQL no arquivo 'backend/.env'")
		log.Printf("Configurações atuais: DB_HOST=%s | DB_PORT=%s | DB_USER=%s | DB_NAME=%s", cfg.DBHost, cfg.DBPort, cfg.DBUser, cfg.DBName)
		log.Printf("=================================================================================")
		log.Fatalf("Erro fatal: Não foi possível conectar ao banco PostgreSQL.")
	}

	log.Println("=> Conexão com PostgreSQL estabelecida com sucesso!")

	// Limpeza preventiva: zeramos tenant_id de linhas órfãs antes de criar FK constraints
	// (evita erro SQLSTATE 23503 ao reiniciar após mudança de schema)
	if err := cleanupOrphanedRows(db); err != nil {
		log.Fatalf("Erro ao remover registros orfaos antes da migracao: %v", err)
	}
	db.Exec("DROP INDEX IF EXISTS idx_marketplace_account_provider")
	db.Exec("DROP INDEX IF EXISTS idx_external_order")

	// Auto Migration das tabelas (sem FK constraints — adicionados manualmente após limpeza)
	err = db.AutoMigrate(
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
		&models.MarketplaceIntegration{},
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
	)

	if err != nil {
		log.Fatalf("Erro na migração do banco de dados: %v", err)
	}

	// Backfill automation fields before enforcing webhook idempotency.
	db.Exec("UPDATE marketplace_accounts SET sync_catalog = true WHERE sync_catalog IS NULL")
	db.Exec("UPDATE marketplace_webhook_events SET dedup_key = 'legacy-' || id::text WHERE dedup_key IS NULL OR dedup_key = ''")
	db.Exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_marketplace_webhook_dedup_key ON marketplace_webhook_events (dedup_key)")

	if err := ensureTenantCascadeConstraints(db); err != nil {
		log.Fatalf("Erro ao configurar exclusao em cascata por tenant: %v", err)
	}

	DB = db

	// Seed de Dados Iniciais
	bootstrapData(db, cfg)

	return DB
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

func bootstrapData(db *gorm.DB, cfg *config.Config) {
	var tenant models.Tenant
	if err := db.Where("slug = ?", "az3d").First(&tenant).Error; err != nil {
		tenant = models.Tenant{Name: "AZ3D", Slug: "az3d"}
		db.Create(&tenant)
	} else if tenant.Name == "AZ3D Print Studio" {
		db.Model(&tenant).Update("name", "AZ3D")
		tenant.Name = "AZ3D"
	}

	ensureTenantSettings(db, tenant)
	if strings.EqualFold(strings.TrimSpace(cfg.Env), "production") {
		if err := neutralizeDefaultProductionPasswords(db); err != nil {
			log.Fatalf("Erro ao remover senhas padrao em producao: %v", err)
		}
	} else {
		ensureMasterAdmin(db, tenant.ID)
		ensureTenantSeedAccount(db, tenant.ID)
	}
	if strings.TrimSpace(cfg.AdminLogin) != "" {
		if err := ensureConfiguredMasterAdmin(db, tenant.ID, cfg.AdminLogin, cfg.AdminPassword); err != nil {
			log.Fatalf("Erro ao configurar conta master: %v", err)
		}
	}
	cleanupLegacySeedArtifacts(db)
}

func ensureConfiguredMasterAdmin(db *gorm.DB, tenantID uint, login string, password string) error {
	login = strings.ToLower(strings.TrimSpace(login))
	passwordHash, err := utils.HashPassword(password)
	if err != nil {
		return err
	}

	var user models.User
	result := db.Where("LOWER(email) = ?", login).First(&user)
	if result.Error != nil {
		if result.Error != gorm.ErrRecordNotFound {
			return result.Error
		}
		result = db.Where("role = ?", "master_admin").Order("id ASC").First(&user)
	}

	if result.Error == nil {
		return db.Model(&user).Updates(map[string]any{
			"tenant_id":     tenantID,
			"name":          "Admin Master",
			"email":         login,
			"password":      passwordHash,
			"role":          "master_admin",
			"auth_provider": "password",
		}).Error
	}
	if result.Error != gorm.ErrRecordNotFound {
		return result.Error
	}

	return db.Create(&models.User{
		TenantID:     tenantID,
		Name:         "Admin Master",
		Email:        login,
		Password:     passwordHash,
		Role:         "master_admin",
		AuthProvider: "password",
	}).Error
}

func neutralizeDefaultProductionPasswords(db *gorm.DB) error {
	accounts := []struct {
		username        string
		email           string
		defaultPassword string
	}{
		{username: "admin", email: "admin@az3d.local", defaultPassword: "Admin@123"},
		{username: "teste", email: "teste@gmail.com", defaultPassword: "Teste@123"},
	}

	for _, account := range accounts {
		var user models.User
		err := db.Where("username = ? OR email = ?", account.username, account.email).First(&user).Error
		if err != nil {
			if err == gorm.ErrRecordNotFound {
				continue
			}
			return err
		}
		if !utils.CheckPasswordHash(account.defaultPassword, user.Password) {
			continue
		}

		randomPassword := make([]byte, 48)
		if _, err := rand.Read(randomPassword); err != nil {
			return err
		}
		hash, err := utils.HashPassword(base64.RawURLEncoding.EncodeToString(randomPassword))
		if err != nil {
			return err
		}
		if err := db.Model(&user).Update("password", hash).Error; err != nil {
			return err
		}
		log.Printf("Senha padrao desativada para a conta %q em producao", account.username)
	}

	return nil
}

func cleanupLegacySeedArtifacts(db *gorm.DB) {
	legacyProductSlugs := []string{
		"dragao-articulado-guardiao-ember",
		"suporte-cyberspace-headphone",
		"vaso-poligonal-voronoi-v1",
		"capacete-cyberpunk-neon-protocol",
		"organizador-modular-cabos-deskflow",
		"busto-mecha-samurai-8k",
		"luminaria-mesa-lua-texturizada-lunar-3d",
		"gabarito-angular-mecanico-regulavel",
		"chassis-robotico-4wd",
	}
	var legacyProducts []models.Product
	db.Unscoped().Where("slug IN ?", legacyProductSlugs).Find(&legacyProducts)
	productIDs := make([]uint, 0, len(legacyProducts))
	for _, product := range legacyProducts {
		productIDs = append(productIDs, product.ID)
	}
	if len(productIDs) > 0 {
		db.Unscoped().Where("product_id IN ?", productIDs).Delete(&models.ProductColorImage{})
		db.Unscoped().Where("product_id IN ?", productIDs).Delete(&models.ProductVariant{})
		db.Unscoped().Where("product_id IN ?", productIDs).Delete(&models.ProductColorStock{})
		db.Unscoped().Where("product_id IN ?", productIDs).Delete(&models.ProductReview{})
		db.Unscoped().Where("product_id IN ?", productIDs).Delete(&models.ProductFavorite{})
		db.Unscoped().Where("product_id IN ?", productIDs).Delete(&models.ProductPricingSnapshot{})
		db.Unscoped().Where("product_id IN ?", productIDs).Delete(&models.ProductActualCost{})
		db.Unscoped().Where("product_id IN ?", productIDs).Delete(&models.MarketplaceProductMapping{})
		db.Unscoped().Where("id IN ?", productIDs).Delete(&models.Product{})
	}

	legacyCategorySlugs := []string{
		"colecionaveis-geek",
		"setup-tech",
		"decoracao",
		"utilitarios",
		"cosplay-props",
		"robotica-prototipagem",
		"acessorios-industriais",
	}
	db.Unscoped().Where("slug IN ?", legacyCategorySlugs).Delete(&models.Category{})

	db.Unscoped().Where("username IN ? OR email IN ?", []string{"admin-az3d", "cliente-az3d"}, []string{"admin@az3d.com.br", "cliente@az3d.com.br"}).Delete(&models.User{})
	db.Unscoped().Where("seller_id IN ?", []string{"AZ3D_PRINT_MELI_BR", "az3d_shopee_store", "A23D_AMZ_SELLER_ID"}).Delete(&models.MarketplaceIntegration{})
	db.Unscoped().Where("external_order_id LIKE ? OR raw_payload = ?", "SIM-%", `{"source":"admin_simulation"}`).Delete(&models.ExternalMarketplaceOrder{})
	db.Unscoped().Where("external_item_id LIKE ?", "ITEM-%").Delete(&models.ExternalMarketplaceOrderItem{})
	db.Unscoped().Where("name IN ?", []string{"Manutencao e depreciacao", "Assinaturas e ferramentas"}).Delete(&models.TenantFixedCost{})
	db.Unscoped().
		Where("is_connected = ? AND access_token = ? AND refresh_token = ? AND auth_code = ? AND account_name IN ?", false, "", "", "", []string{"Shopee", "Mercado Livre", "Amazon Seller"}).
		Delete(&models.MarketplaceAccount{})

	var makerlab models.Tenant
	if result := db.Where("slug = ? AND name = ?", "makerlab", "MakerLab 3D Tech").Limit(1).Find(&makerlab); result.RowsAffected > 0 {
		db.Unscoped().Where("tenant_id = ?", makerlab.ID).Delete(&models.TenantSettings{})
		db.Unscoped().Where("tenant_id = ?", makerlab.ID).Delete(&models.TenantStoreSettings{})
		db.Unscoped().Where("tenant_id = ?", makerlab.ID).Delete(&models.TenantPricingSettings{})
		db.Unscoped().Where("tenant_id = ?", makerlab.ID).Delete(&models.TenantFulfillmentSettings{})
		db.Unscoped().Where("tenant_id = ?", makerlab.ID).Delete(&models.TenantMarketplaceSettings{})
		db.Unscoped().Where("tenant_id = ?", makerlab.ID).Delete(&models.MaterialPreset{})
		db.Unscoped().Where("tenant_id = ?", makerlab.ID).Delete(&models.PrinterPreset{})
		db.Unscoped().Where("tenant_id = ?", makerlab.ID).Delete(&models.PlatformFeePreset{})
		db.Unscoped().Where("tenant_id = ?", makerlab.ID).Delete(&models.MarketplaceAccount{})
		db.Unscoped().Delete(&makerlab)
	}
}

func ensureTenantSettings(db *gorm.DB, tenant models.Tenant) {
	if tenant.ID == 0 {
		return
	}

	settings := models.TenantSettings{
		TenantID:              tenant.ID,
		StoreName:             tenant.Name,
		LogoURL:               tenant.LogoURL,
		PrimaryColor:          "#22d3ee",
		AccentColor:           "#ffffff",
		DefaultSpoolPrice:     120,
		DefaultSpoolWeight:    1000,
		DefaultPrinterPowerKW: 0.07,
		DefaultEnergyTariff:   1,
		DefaultPackagingCost:  1.5,
		DefaultLaborCost:      0,
		DefaultExtraCost:      0,
		DefaultFailureRatePct: 8,
		DefaultMarginPct:      60,
		DefaultPlatformFeePct: 12,
		DefaultPaymentFeePct:  4.99,
		DefaultFixedFee:       0,
		DeliveryPickupEnabled: true,
		DeliveryShipEnabled:   true,
	}

	var count int64
	db.Model(&models.TenantSettings{}).Where("tenant_id = ?", tenant.ID).Count(&count)
	if count == 0 {
		db.Create(&settings)
	} else {
		db.Where("tenant_id = ?", tenant.ID).First(&settings)
	}

	db.Model(&models.TenantStoreSettings{}).Where("tenant_id = ?", tenant.ID).Count(&count)
	if count == 0 {
		db.Create(&models.TenantStoreSettings{
			TenantID:     tenant.ID,
			StoreName:    settings.StoreName,
			LogoURL:      settings.LogoURL,
			PrimaryColor: settings.PrimaryColor,
			AccentColor:  settings.AccentColor,
		})
	}

	db.Model(&models.TenantPricingSettings{}).Where("tenant_id = ?", tenant.ID).Count(&count)
	if count == 0 {
		db.Create(&models.TenantPricingSettings{
			TenantID:              tenant.ID,
			DefaultSpoolPrice:     settings.DefaultSpoolPrice,
			DefaultSpoolWeight:    settings.DefaultSpoolWeight,
			DefaultPrinterPowerKW: settings.DefaultPrinterPowerKW,
			DefaultEnergyTariff:   settings.DefaultEnergyTariff,
			DefaultPackagingCost:  settings.DefaultPackagingCost,
			DefaultLaborCost:      settings.DefaultLaborCost,
			DefaultExtraCost:      settings.DefaultExtraCost,
			DefaultFailureRatePct: settings.DefaultFailureRatePct,
			DefaultMarginPct:      settings.DefaultMarginPct,
			DefaultPlatformFeePct: settings.DefaultPlatformFeePct,
			DefaultPaymentFeePct:  settings.DefaultPaymentFeePct,
			DefaultFixedFee:       settings.DefaultFixedFee,
		})
	}

	db.Model(&models.TenantFulfillmentSettings{}).Where("tenant_id = ?", tenant.ID).Count(&count)
	if count == 0 {
		db.Create(&models.TenantFulfillmentSettings{
			TenantID:              tenant.ID,
			DeliveryPickupEnabled: settings.DeliveryPickupEnabled,
			DeliveryShipEnabled:   settings.DeliveryShipEnabled,
		})
	}

	db.Model(&models.MaterialPreset{}).Where("tenant_id = ?", tenant.ID).Count(&count)
	if count == 0 {
		db.Create(&models.MaterialPreset{
			TenantID:         tenant.ID,
			Name:             "PLA padrao",
			MaterialType:     "PLA",
			ColorName:        "Preto Slate",
			SpoolPrice:       settings.DefaultSpoolPrice,
			SpoolWeightGrams: settings.DefaultSpoolWeight,
			IsDefault:        true,
			IsActive:         true,
		})
	}

	db.Model(&models.PrinterPreset{}).Where("tenant_id = ?", tenant.ID).Count(&count)
	if count == 0 {
		db.Create(&models.PrinterPreset{
			TenantID:  tenant.ID,
			Name:      "Impressora padrao",
			PowerKW:   settings.DefaultPrinterPowerKW,
			IsDefault: true,
			IsActive:  true,
		})
	}

	db.Model(&models.PlatformFeePreset{}).Where("tenant_id = ?", tenant.ID).Count(&count)
	if count == 0 {
		db.Create(&models.PlatformFeePreset{
			TenantID:           tenant.ID,
			Name:               "Loja propria",
			PlatformFeePercent: settings.DefaultPlatformFeePct,
			PaymentFeePercent:  settings.DefaultPaymentFeePct,
			FixedFee:           settings.DefaultFixedFee,
			IsDefault:          true,
			IsActive:           true,
		})
	}

}

func ensureMasterAdmin(db *gorm.DB, tenantID uint) {
	password, err := utils.HashPassword("Admin@123")
	if err != nil {
		log.Printf("Erro ao gerar senha do admin master: %v", err)
		return
	}

	user := models.User{
		TenantID: tenantID,
		Name:     "Admin Master",
		Username: "admin",
		Email:    "admin@az3d.local",
		Password: password,
		Role:     "master_admin",
	}

	var existing models.User
	err = db.Where("username = ? OR email = ?", user.Username, user.Email).First(&existing).Error
	if err == nil {
		updates := map[string]any{
			"tenant_id": tenantID,
			"name":      user.Name,
			"username":  user.Username,
			"role":      user.Role,
		}
		if existing.Email == "" {
			updates["email"] = user.Email
		}
		db.Model(&existing).Updates(updates)
		return
	}

	db.Create(&user)
}

func ensureTenantSeedAccount(db *gorm.DB, tenantID uint) {
	password, err := utils.HashPassword("Teste@123")
	if err != nil {
		log.Printf("Erro ao gerar senha da conta tenant inicial: %v", err)
		return
	}

	user := models.User{
		TenantID: tenantID,
		Name:     "Tenant AZ3D",
		Username: "teste",
		Email:    "teste@gmail.com",
		Password: password,
		Role:     "tenant_admin",
	}

	var existing models.User
	err = db.Where("username = ? OR email = ?", user.Username, user.Email).First(&existing).Error
	if err == nil {
		db.Model(&existing).Updates(map[string]any{
			"tenant_id": tenantID,
			"name":      user.Name,
			"username":  user.Username,
			"email":     user.Email,
			"password":  user.Password,
			"role":      user.Role,
		})
		return
	}

	db.Create(&user)
}
