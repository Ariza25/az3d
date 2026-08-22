package database

import (
	"fmt"
	"log"

	"az3d-backend/config"
	"az3d-backend/models"
	"az3d-backend/utils"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func InitDB(cfg *config.Config) *gorm.DB {
	var db *gorm.DB
	var err error

	// 1. DSN do PostgreSQL para a base de dados do projeto
	dsn := fmt.Sprintf(
		"host=%s user=%s password=%s dbname=%s port=%s sslmode=%s TimeZone=UTC",
		cfg.DBHost, cfg.DBUser, cfg.DBPassword, cfg.DBName, cfg.DBPort, cfg.DBSSLMode,
	)

	log.Printf("Conectando ao banco de dados PostgreSQL (%s:%s/%s)...", cfg.DBHost, cfg.DBPort, cfg.DBName)
	db, err = gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger:                                   logger.Default.LogMode(logger.Warn),
		DisableForeignKeyConstraintWhenMigrating: true,
	})

	// 2. Se o banco 'az3d_db' ainda não existir, tenta conectar ao banco padrão 'postgres' para criá-lo automaticamente
	if err != nil {
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
	cleanupOrphanedRows(db)
	_ = db.Migrator().DropIndex(&models.MarketplaceAccount{}, "idx_marketplace_account_provider")
	_ = db.Migrator().DropIndex(&models.ExternalMarketplaceOrder{}, "idx_external_order")

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
	)

	if err != nil {
		log.Fatalf("Erro na migração do banco de dados: %v", err)
	}

	DB = db

	// Seed de Dados Iniciais
	seedData(db)

	return DB
}

// cleanupOrphanedRows limpa linhas com tenant_id inválido (0 ou NULL) antes de AutoMigrate
// para evitar erro de violação de FK constraint ao reiniciar o servidor após mudanças de schema.
func cleanupOrphanedRows(db *gorm.DB) {
	tables := []string{"tenant_settings", "tenant_store_settings", "tenant_pricing_settings", "tenant_fulfillment_settings", "material_presets", "printer_presets", "platform_fee_presets", "users", "categories", "products", "product_color_images", "product_variants", "product_color_stocks", "stock_movements", "tenant_carrier_accounts", "order_shipments", "shipment_events", "product_reviews", "product_favorites", "product_pricing_snapshots", "product_actual_costs", "tenant_fixed_costs", "orders", "marketplace_integrations", "marketplace_product_mappings", "marketplace_accounts", "external_marketplace_orders", "external_marketplace_order_items"}
	for _, table := range tables {
		// Verifica se a coluna tenant_id existe antes de tentar limpar
		var colExists int64
		db.Raw(
			"SELECT COUNT(*) FROM information_schema.columns WHERE table_name = ? AND column_name = 'tenant_id'",
			table,
		).Scan(&colExists)

		if colExists > 0 {
			result := db.Exec(fmt.Sprintf("UPDATE %s SET tenant_id = NULL WHERE tenant_id = 0", table))
			if result.RowsAffected > 0 {
				log.Printf("[cleanup] Corrigidos %d registros com tenant_id=0 na tabela '%s'", result.RowsAffected, table)
			}
		}
	}
}

func seedData(db *gorm.DB) {
	// 1. Criar Tenants de exemplo se não existirem
	var tenantCount int64
	db.Model(&models.Tenant{}).Count(&tenantCount)

	tenant1 := models.Tenant{Name: "AZ3D Print Studio", Slug: "az3d", Domain: "az3d.local", LogoURL: ""}
	tenant2 := models.Tenant{Name: "MakerLab 3D Tech", Slug: "makerlab", Domain: "makerlab.local", LogoURL: ""}

	if tenantCount == 0 {
		db.Create(&tenant1)
		db.Create(&tenant2)
	} else {
		db.First(&tenant1, 1)
		db.First(&tenant2, 2)
	}
	ensureTenantSettings(db, tenant1)
	ensureTenantSettings(db, tenant2)
	ensureMasterAdmin(db, tenant1.ID)

	// Verificar se já temos categorias cadastradas
	var count int64
	db.Model(&models.Category{}).Count(&count)
	if count > 0 {
		return
	}

	log.Println("Semeando dados iniciais Multi-Tenant do catálogo 3D...")

	// 2. Criar Usuários (Admin e Cliente)
	hashedPassword, _ := utils.HashPassword("123456")

	adminUser := models.User{
		TenantID: tenant1.ID,
		Name:     "Administrador AZ3D",
		Username: "admin-az3d",
		Email:    "admin@az3d.com.br",
		Password: hashedPassword,
		Role:     "admin",
	}
	db.Create(&adminUser)

	demoUser := models.User{
		TenantID: tenant1.ID,
		Name:     "Cliente AZ3D",
		Username: "cliente-az3d",
		Email:    "cliente@az3d.com.br",
		Password: hashedPassword,
		Role:     "customer",
	}
	db.Create(&demoUser)

	// 3. Criar Categorias para o Tenant 1 (AZ3D)
	categoriesTenant1 := []models.Category{
		{
			TenantID:    tenant1.ID,
			Name:        "Colecionáveis & Geek",
			Slug:        "colecionaveis-geek",
			Description: "Estátuas, bustos e action figures em resina 8K e PLA Silk.",
			Icon:        "shield",
		},
		{
			TenantID:    tenant1.ID,
			Name:        "Setup Tech & Organização",
			Slug:        "setup-tech",
			Description: "Suportes para headphone, cabos, notebooks e acessórios de mesa.",
			Icon:        "cpu",
		},
		{
			TenantID:    tenant1.ID,
			Name:        "Decoração Minimalista",
			Slug:        "decoracao",
			Description: "Vasos geométricos, luminárias articuladas e arte de parede.",
			Icon:        "sparkles",
		},
		{
			TenantID:    tenant1.ID,
			Name:        "Utilitários & Ferramentas",
			Slug:        "utilitarios",
			Description: "Peças mecânicas, gabaritos, engrenagens e peças funcionais.",
			Icon:        "wrench",
		},
		{
			TenantID:    tenant1.ID,
			Name:        "Cosplay & Props",
			Slug:        "cosplay-props",
			Description: "Capacetes, réplicas em tamanho real e acessórios para cosplay.",
			Icon:        "sword",
		},
	}

	for i := range categoriesTenant1 {
		db.Create(&categoriesTenant1[i])
	}

	// Categorias para o Tenant 2 (MakerLab)
	categoriesTenant2 := []models.Category{
		{
			TenantID:    tenant2.ID,
			Name:        "Robótica & Prototipagem",
			Slug:        "robotica-prototipagem",
			Description: "Chassis, engrenagens e suportes de sensores para projetos Maker.",
			Icon:        "cpu",
		},
		{
			TenantID:    tenant2.ID,
			Name:        "Acessórios Industriais",
			Slug:        "acessorios-industriais",
			Description: "Gabaritos, guias e organizadores de bancada técnica.",
			Icon:        "wrench",
		},
	}
	for i := range categoriesTenant2 {
		db.Create(&categoriesTenant2[i])
	}

	// 4. Criar Produtos para Tenant 1 (AZ3D)
	productsTenant1 := []models.Product{
		{
			TenantID:    tenant1.ID,
			Title:       "Dragão Articulado Guardião Ember",
			Slug:        "dragao-articulado-guardiao-ember",
			Description: "Dragão totalmente articulado impresso em uma única peça sem suportes. Possui movimento dinâmico fluido e acabamento gradiente bicromático em PLA Silk Dual-Color.",
			Price:       149.90,
			ImageURL:    "https://images.unsplash.com/photo-1563089145-599997674d42?q=80&w=800&auto=format&fit=crop",
			CategoryID:  categoriesTenant1[0].ID,
			Material:    "PLA Silk Dupla Cor",
			LayerHeight: "0.12mm (Ultra Detalhe)",
			PrintTime:   "18 horas",
			Dimensions:  "450 x 80 x 60 mm",
			Weight:      "220g",
			InStock:     true,
			StockQty:    15,
		},
		{
			TenantID:    tenant1.ID,
			Title:       "Suporte Cyberspace para Headphone",
			Slug:        "suporte-cyberspace-headphone",
			Description: "Design futurista minimalista e estruturalmente reforçado para suportar headphones de alta fidelidade. Passagem de cabo oculta e base antiderrapante.",
			Price:       89.90,
			ImageURL:    "https://images.unsplash.com/photo-1546435770-a3e426bf472b?q=80&w=800&auto=format&fit=crop",
			CategoryID:  categoriesTenant1[1].ID,
			Material:    "PETG Carbon Fiber",
			LayerHeight: "0.20mm (Resistência Mecânica)",
			PrintTime:   "9 horas",
			Dimensions:  "140 x 130 x 260 mm",
			Weight:      "310g",
			InStock:     true,
			StockQty:    20,
		},
		{
			TenantID:    tenant1.ID,
			Title:       "Vaso Poligonal Voronoi V1",
			Slug:        "vaso-poligonal-voronoi-v1",
			Description: "Vaso decorativo moderno com padrão matemático Voronoi. Ideal para arranjos secos ou plantas suculentas em ambientes corporativos e residenciais.",
			Price:       74.90,
			ImageURL:    "https://images.unsplash.com/photo-1581783342308-f792dbdd27c5?q=80&w=800&auto=format&fit=crop",
			CategoryID:  categoriesTenant1[2].ID,
			Material:    "PLA Matte Slate",
			LayerHeight: "0.16mm",
			PrintTime:   "11 horas",
			Dimensions:  "120 x 120 x 200 mm",
			Weight:      "190g",
			InStock:     true,
			StockQty:    12,
		},
		{
			TenantID:    tenant1.ID,
			Title:       "Capacete Cyberpunk Neon Protocol",
			Slug:        "capacete-cyberpunk-neon-protocol",
			Description: "Réplica impressionante em tamanho real (1:1) com acabamento texturizado, viseira adaptável e encaixes para iluminação LED interna.",
			Price:       499.00,
			ImageURL:    "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?q=80&w=800&auto=format&fit=crop",
			CategoryID:  categoriesTenant1[4].ID,
			Material:    "ABS / PETG Alta Tenacidade",
			LayerHeight: "0.16mm",
			PrintTime:   "42 horas",
			Dimensions:  "280 x 260 x 300 mm",
			Weight:      "850g",
			InStock:     true,
			StockQty:    5,
		},
		{
			TenantID:    tenant1.ID,
			Title:       "Organizador Modular de Cabos DeskFlow",
			Slug:        "organizador-modular-cabos-deskflow",
			Description: "Kit com 5 presilhas magnéticas ajustáveis para gerenciamento limpo de cabos de carregador, monitor e periféricos em mesas de trabalho.",
			Price:       45.00,
			ImageURL:    "https://images.unsplash.com/photo-1586953208448-b95a79798f07?q=80&w=800&auto=format&fit=crop",
			CategoryID:  categoriesTenant1[1].ID,
			Material:    "PETG Flexível",
			LayerHeight: "0.20mm",
			PrintTime:   "3 horas",
			Dimensions:  "90 x 25 x 15 mm (cada)",
			Weight:      "65g",
			InStock:     true,
			StockQty:    30,
		},
		{
			TenantID:    tenant1.ID,
			Title:       "Busto Mecha Samurai 8K",
			Slug:        "busto-mecha-samurai-8k",
			Description: "Miniatura hiperdetalhada impressa em Resina UV de alta precisão 8K. Acabamento cinza fosco perfeito para pintura artesanal ou coleção imediata.",
			Price:       189.90,
			ImageURL:    "https://images.unsplash.com/photo-1563089145-599997674d42?q=80&w=800&auto=format&fit=crop",
			CategoryID:  categoriesTenant1[0].ID,
			Material:    "Resina UV 8K High Detail",
			LayerHeight: "0.03mm (Precisão Cirúrgica)",
			PrintTime:   "15 horas",
			Dimensions:  "110 x 90 x 170 mm",
			Weight:      "280g",
			InStock:     true,
			StockQty:    8,
		},
		{
			TenantID:    tenant1.ID,
			Title:       "Luminária de Mesa Lua Texturizada Lunar-3D",
			Slug:        "luminaria-mesa-lua-texturizada-lunar-3d",
			Description: "Esfera de iluminação com relevo topográfico exato da Lua obtido via dados da NASA. Acompanha base de madeira minimalista e soquete USB.",
			Price:       129.90,
			ImageURL:    "https://images.unsplash.com/photo-1532693322450-2cb5c511067d?q=80&w=800&auto=format&fit=crop",
			CategoryID:  categoriesTenant1[2].ID,
			Material:    "PLA Lithophane Translúcido",
			LayerHeight: "0.12mm",
			PrintTime:   "16 horas",
			Dimensions:  "160 x 160 x 180 mm",
			Weight:      "210g",
			InStock:     true,
			StockQty:    14,
		},
		{
			TenantID:    tenant1.ID,
			Title:       "Gabarito Angular Mecânico Regulável",
			Slug:        "gabarito-angular-mecanico-regulavel",
			Description: "Ferramenta de medição rápida para marcenaria e bricolagem com escala gravada a laser e parafusos de travamento em PETG reforçado.",
			Price:       59.90,
			ImageURL:    "https://images.unsplash.com/photo-1581092160607-ee22621dd758?q=80&w=800&auto=format&fit=crop",
			CategoryID:  categoriesTenant1[3].ID,
			Material:    "PETG Industrial",
			LayerHeight: "0.20mm",
			PrintTime:   "5 horas",
			Dimensions:  "200 x 40 x 12 mm",
			Weight:      "140g",
			InStock:     true,
			StockQty:    25,
		},
	}

	for i := range productsTenant1 {
		db.Create(&productsTenant1[i])
	}

	// Produtos para Tenant 2 (MakerLab)
	productsTenant2 := []models.Product{
		{
			TenantID:    tenant2.ID,
			Title:       "Chassis Robótico 4WD Prototipagem",
			Slug:        "chassis-robotico-4wd",
			Description: "Chassis modular reforçado impresso em ABS para robôs móveis de competição.",
			Price:       119.00,
			ImageURL:    "https://images.unsplash.com/photo-1581092160607-ee22621dd758?q=80&w=800&auto=format&fit=crop",
			CategoryID:  categoriesTenant2[0].ID,
			Material:    "ABS Reforçado",
			LayerHeight: "0.20mm",
			PrintTime:   "12 horas",
			Dimensions:  "220 x 180 x 60 mm",
			Weight:      "350g",
			InStock:     true,
			StockQty:    10,
		},
	}

	for i := range productsTenant2 {
		db.Create(&productsTenant2[i])
	}

	// 5. Criar Integrações Iniciais de Marketplace
	marketplaceSeed := []models.MarketplaceIntegration{
		{
			TenantID:   tenant1.ID,
			Provider:   "mercadolivre",
			SellerID:   "AZ3D_PRINT_MELI_BR",
			SellerName: "AZ3D Oficial (Mercado Livre)",
			IsActive:   true,
			SyncOrders: true,
			SyncStock:  true,
		},
		{
			TenantID:   tenant1.ID,
			Provider:   "shopee",
			SellerID:   "az3d_shopee_store",
			SellerName: "AZ3D Print (Shopee BR)",
			IsActive:   true,
			SyncOrders: true,
			SyncStock:  true,
		},
		{
			TenantID:   tenant1.ID,
			Provider:   "amazon",
			SellerID:   "A23D_AMZ_SELLER_ID",
			SellerName: "AZ3D Studio (Amazon Seller)",
			IsActive:   false,
			SyncOrders: true,
			SyncStock:  false,
		},
	}

	for i := range marketplaceSeed {
		db.Create(&marketplaceSeed[i])
	}

	log.Println("Seeding do banco concluído com sucesso!")
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

	db.Model(&models.TenantFixedCost{}).Where("tenant_id = ?", tenant.ID).Count(&count)
	if count == 0 {
		db.Create(&models.TenantFixedCost{
			TenantID:        tenant.ID,
			Name:            "Manutencao e depreciacao",
			MonthlyAmount:   120,
			AllocationBasis: "print_hours",
			IsActive:        true,
		})
		db.Create(&models.TenantFixedCost{
			TenantID:        tenant.ID,
			Name:            "Assinaturas e ferramentas",
			MonthlyAmount:   80,
			AllocationBasis: "monthly",
			IsActive:        true,
		})
	}

	accounts := []models.MarketplaceAccount{
		{
			TenantID:    tenant.ID,
			Provider:    "shopee",
			AccountName: "Shopee",
			Marketplace: "BR",
			IsActive:    true,
			IsConnected: false,
			SyncOrders:  true,
			SyncStock:   true,
			SyncStatus:  "pending_credentials",
		},
		{
			TenantID:    tenant.ID,
			Provider:    "mercadolivre",
			AccountName: "Mercado Livre",
			Marketplace: "MLB",
			IsActive:    true,
			IsConnected: false,
			SyncOrders:  true,
			SyncStock:   true,
			SyncStatus:  "pending_credentials",
		},
		{
			TenantID:    tenant.ID,
			Provider:    "amazon",
			AccountName: "Amazon Seller",
			Marketplace: "BR",
			IsActive:    false,
			IsConnected: false,
			SyncOrders:  true,
			SyncStock:   false,
			SyncStatus:  "pending_credentials",
		},
	}
	for _, account := range accounts {
		db.Where("tenant_id = ? AND provider = ?", tenant.ID, account.Provider).FirstOrCreate(&account)
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
