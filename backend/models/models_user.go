package models

import (
	"time"

	"gorm.io/gorm"
)

type Tenant struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Name      string    `gorm:"size:100;not null" json:"name"`
	Slug      string    `gorm:"size:100;not null;uniqueIndex" json:"slug"`
	Domain    string    `gorm:"size:150" json:"domain"`
	LogoURL   string    `gorm:"size:500" json:"logo_url"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type TenantSettings struct {
	ID                    uint      `gorm:"primaryKey" json:"id"`
	TenantID              uint      `gorm:"not null;uniqueIndex" json:"tenant_id"`
	Tenant                *Tenant   `gorm:"foreignKey:TenantID" json:"tenant,omitempty"`
	StoreName             string    `gorm:"size:120" json:"store_name"`
	LogoURL               string    `gorm:"size:500" json:"logo_url"`
	PrimaryColor          string    `gorm:"size:20;default:'#22d3ee'" json:"primary_color"`
	AccentColor           string    `gorm:"size:20;default:'#ffffff'" json:"accent_color"`
	DefaultSpoolPrice     float64   `gorm:"default:120" json:"default_spool_price"`
	DefaultSpoolWeight    float64   `gorm:"default:1000" json:"default_spool_weight"`
	DefaultPrinterPowerKW float64   `gorm:"default:0.07" json:"default_printer_power_kw"`
	DefaultEnergyTariff   float64   `gorm:"default:1" json:"default_energy_tariff"`
	DefaultPackagingCost  float64   `gorm:"default:1.5" json:"default_packaging_cost"`
	DefaultLaborCost      float64   `gorm:"default:0" json:"default_labor_cost"`
	DefaultExtraCost      float64   `gorm:"default:0" json:"default_extra_cost"`
	DefaultFailureRatePct float64   `gorm:"default:8" json:"default_failure_rate_percent"`
	DefaultMarginPct      float64   `gorm:"default:60" json:"default_margin_percent"`
	DefaultPlatformFeePct float64   `gorm:"default:12" json:"default_platform_fee_percent"`
	DefaultPaymentFeePct  float64   `gorm:"default:4.99" json:"default_payment_fee_percent"`
	DefaultFixedFee       float64   `gorm:"default:0" json:"default_fixed_fee"`
	DeliveryPickupEnabled bool      `gorm:"default:true" json:"delivery_pickup_enabled"`
	DeliveryShipEnabled   bool      `gorm:"default:true" json:"delivery_ship_enabled"`
	OriginCEP             string    `gorm:"size:10" json:"origin_cep"`
	CreatedAt             time.Time `json:"created_at"`
	UpdatedAt             time.Time `json:"updated_at"`
}

type TenantStoreSettings struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	TenantID     uint      `gorm:"not null;uniqueIndex" json:"tenant_id"`
	Tenant       *Tenant   `gorm:"foreignKey:TenantID" json:"tenant,omitempty"`
	StoreName    string    `gorm:"size:120" json:"store_name"`
	LogoURL      string    `gorm:"size:500" json:"logo_url"`
	PrimaryColor string    `gorm:"size:20;default:'#22d3ee'" json:"primary_color"`
	AccentColor  string    `gorm:"size:20;default:'#ffffff'" json:"accent_color"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type TenantFulfillmentSettings struct {
	ID                    uint      `gorm:"primaryKey" json:"id"`
	TenantID              uint      `gorm:"not null;uniqueIndex" json:"tenant_id"`
	Tenant                *Tenant   `gorm:"foreignKey:TenantID" json:"tenant,omitempty"`
	DeliveryPickupEnabled bool      `gorm:"default:true" json:"delivery_pickup_enabled"`
	DeliveryShipEnabled   bool      `gorm:"default:true" json:"delivery_ship_enabled"`
	OriginCEP             string    `gorm:"size:10" json:"origin_cep"`
	CreatedAt             time.Time `json:"created_at"`
	UpdatedAt             time.Time `json:"updated_at"`
}

type TenantMarketplaceSettings struct {
	ID                         uint      `gorm:"primaryKey" json:"id"`
	TenantID                   uint      `gorm:"not null;uniqueIndex" json:"tenant_id"`
	Tenant                     *Tenant   `gorm:"foreignKey:TenantID" json:"tenant,omitempty"`
	MarketplaceControlsPrice   bool      `gorm:"default:true" json:"marketplace_controls_price"`
	MarketplaceControlsStock   bool      `gorm:"default:true" json:"marketplace_controls_stock"`
	ContentSyncPolicy          string    `gorm:"size:30;default:'imported_only'" json:"content_sync_policy"`
	NewImportedProductStatus   string    `gorm:"size:20;default:'draft'" json:"new_imported_product_status"`
	AutoCreateInternalOrders   bool      `gorm:"default:true" json:"auto_create_internal_orders"`
	AutoCreateFinancialEntries bool      `gorm:"default:true" json:"auto_create_financial_entries"`
	CreatedAt                  time.Time `json:"created_at"`
	UpdatedAt                  time.Time `json:"updated_at"`
}

type User struct {
	ID           uint           `gorm:"primaryKey" json:"id"`
	TenantID     uint           `gorm:"default:1;index" json:"tenant_id"`
	Tenant       *Tenant        `gorm:"foreignKey:TenantID" json:"tenant,omitempty"`
	Name         string         `gorm:"size:100;not null" json:"name"`
	Username     string         `gorm:"size:80;uniqueIndex:idx_users_username,where:username <> ''" json:"username"`
	Email        string         `gorm:"size:100;not null;uniqueIndex" json:"email"`
	Password     string         `gorm:"size:255;not null" json:"-"`
	Role         string         `gorm:"size:20;default:'customer'" json:"role"` // customer, admin, tenant_admin, master_admin
	GoogleID     string         `gorm:"size:255;index" json:"google_id,omitempty"`
	AvatarURL    string         `gorm:"size:500" json:"avatar_url,omitempty"`
	AuthProvider string         `gorm:"size:30;default:'password'" json:"auth_provider"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}

type RegisterInput struct {
	Name        string `json:"name" binding:"required,min=2"`
	Email       string `json:"email" binding:"required,email"`
	Password    string `json:"password" binding:"required,min=6"`
	TenantID    uint   `json:"tenant_id"`
	AccountType string `json:"account_type"`
	StoreName   string `json:"store_name"`
}

type LoginInput struct {
	Email    string `json:"email" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type AuthResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}

type TenantSettingsInput struct {
	StoreName             string  `json:"store_name"`
	LogoURL               string  `json:"logo_url"`
	PrimaryColor          string  `json:"primary_color"`
	AccentColor           string  `json:"accent_color"`
	DefaultSpoolPrice     float64 `json:"default_spool_price"`
	DefaultSpoolWeight    float64 `json:"default_spool_weight"`
	DefaultPrinterPowerKW float64 `json:"default_printer_power_kw"`
	DefaultEnergyTariff   float64 `json:"default_energy_tariff"`
	DefaultPackagingCost  float64 `json:"default_packaging_cost"`
	DefaultLaborCost      float64 `json:"default_labor_cost"`
	DefaultExtraCost      float64 `json:"default_extra_cost"`
	DefaultFailureRatePct float64 `json:"default_failure_rate_percent"`
	DefaultMarginPct      float64 `json:"default_margin_percent"`
	DefaultPlatformFeePct float64 `json:"default_platform_fee_percent"`
	DefaultPaymentFeePct  float64 `json:"default_payment_fee_percent"`
	DefaultFixedFee       float64 `json:"default_fixed_fee"`
	DeliveryPickupEnabled bool    `json:"delivery_pickup_enabled"`
	DeliveryShipEnabled   bool    `json:"delivery_ship_enabled"`
	OriginCEP             string  `json:"origin_cep"`
}

type TenantMarketplaceSettingsInput struct {
	MarketplaceControlsPrice   bool   `json:"marketplace_controls_price"`
	MarketplaceControlsStock   bool   `json:"marketplace_controls_stock"`
	ContentSyncPolicy          string `json:"content_sync_policy"`
	NewImportedProductStatus   string `json:"new_imported_product_status"`
	AutoCreateInternalOrders   bool   `json:"auto_create_internal_orders"`
	AutoCreateFinancialEntries bool   `json:"auto_create_financial_entries"`
}
