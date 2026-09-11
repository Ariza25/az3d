package database

import (
	"fmt"
	"log"
	"time"

	"az3d-backend/config"

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
	"filament_spools",
	"custom3_d_quotes",
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
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger:                                   logger.Default.LogMode(logger.Warn),
		DisableForeignKeyConstraintWhenMigrating: true,
	})
	if err != nil {
		return nil, err
	}
	if sqlDB, err := db.DB(); err == nil {
		sqlDB.SetMaxOpenConns(25)
		sqlDB.SetMaxIdleConns(10)
		sqlDB.SetConnMaxLifetime(10 * time.Minute)
		sqlDB.SetConnMaxIdleTime(5 * time.Minute)
	}
	return db, nil
}

func InitDB(cfg *config.Config) *gorm.DB {
	var db *gorm.DB
	var err error

	// 1. DATABASE_URL e o formato preferencial para provedores gerenciados como Neon.
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

	// 2. Se o banco nao existir, tenta criar automaticamente no PostgreSQL
	if err != nil && cfg.DatabaseURL == "" {
		log.Printf("Tentando verificar/criar o banco de dados '%s' no PostgreSQL...", cfg.DBName)
		dsnRoot := fmt.Sprintf(
			"host=%s user=%s password=%s dbname=postgres port=%s sslmode=%s TimeZone=UTC",
			cfg.DBHost, cfg.DBUser, cfg.DBPassword, cfg.DBPort, cfg.DBSSLMode,
		)

		rootDB, rootErr := gorm.Open(postgres.Open(dsnRoot), &gorm.Config{})
		if rootErr == nil {
			rootDB.Exec(fmt.Sprintf("CREATE DATABASE %s;", cfg.DBName))
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

	if sqlDB, err := db.DB(); err == nil {
		sqlDB.SetMaxOpenConns(25)
		sqlDB.SetMaxIdleConns(10)
		sqlDB.SetConnMaxLifetime(10 * time.Minute)
		sqlDB.SetConnMaxIdleTime(5 * time.Minute)
	}

	if err := runAutoMigrate(db); err != nil {
		log.Fatalf("Erro na migração do banco de dados: %v", err)
	}

	DB = db

	bootstrapData(db, cfg)

	return DB
}
