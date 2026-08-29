package models

import (
	"encoding/json"
	"os"
	"strings"
	"time"

	"az3d-backend/utils"

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

type TenantPricingSettings struct {
	ID                    uint      `gorm:"primaryKey" json:"id"`
	TenantID              uint      `gorm:"not null;uniqueIndex" json:"tenant_id"`
	Tenant                *Tenant   `gorm:"foreignKey:TenantID" json:"tenant,omitempty"`
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
	CreatedAt             time.Time `json:"created_at"`
	UpdatedAt             time.Time `json:"updated_at"`
}

type TenantFulfillmentSettings struct {
	ID                    uint      `gorm:"primaryKey" json:"id"`
	TenantID              uint      `gorm:"not null;uniqueIndex" json:"tenant_id"`
	Tenant                *Tenant   `gorm:"foreignKey:TenantID" json:"tenant,omitempty"`
	DeliveryPickupEnabled bool      `gorm:"default:true" json:"delivery_pickup_enabled"`
	DeliveryShipEnabled   bool      `gorm:"default:true" json:"delivery_ship_enabled"`
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

type MaterialPreset struct {
	ID               uint      `gorm:"primaryKey" json:"id"`
	TenantID         uint      `gorm:"not null;index" json:"tenant_id"`
	Tenant           *Tenant   `gorm:"foreignKey:TenantID" json:"tenant,omitempty"`
	Name             string    `gorm:"size:100;not null" json:"name"`
	MaterialType     string    `gorm:"size:80" json:"material_type"`
	ColorName        string    `gorm:"size:80" json:"color_name"`
	SpoolPrice       float64   `gorm:"default:120" json:"spool_price"`
	SpoolWeightGrams float64   `gorm:"default:1000" json:"spool_weight_grams"`
	IsDefault        bool      `gorm:"default:false" json:"is_default"`
	IsActive         bool      `gorm:"default:true" json:"is_active"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

type PrinterPreset struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	TenantID  uint      `gorm:"not null;index" json:"tenant_id"`
	Tenant    *Tenant   `gorm:"foreignKey:TenantID" json:"tenant,omitempty"`
	Name      string    `gorm:"size:100;not null" json:"name"`
	PowerKW   float64   `gorm:"default:0.07" json:"power_kw"`
	IsDefault bool      `gorm:"default:false" json:"is_default"`
	IsActive  bool      `gorm:"default:true" json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type PlatformFeePreset struct {
	ID                 uint      `gorm:"primaryKey" json:"id"`
	TenantID           uint      `gorm:"not null;index" json:"tenant_id"`
	Tenant             *Tenant   `gorm:"foreignKey:TenantID" json:"tenant,omitempty"`
	Name               string    `gorm:"size:100;not null" json:"name"`
	PlatformFeePercent float64   `gorm:"default:12" json:"platform_fee_percent"`
	PaymentFeePercent  float64   `gorm:"default:4.99" json:"payment_fee_percent"`
	FixedFee           float64   `gorm:"default:0" json:"fixed_fee"`
	IsDefault          bool      `gorm:"default:false" json:"is_default"`
	IsActive           bool      `gorm:"default:true" json:"is_active"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
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

type Category struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	TenantID    uint      `gorm:"default:1;index" json:"tenant_id"`
	Tenant      *Tenant   `gorm:"foreignKey:TenantID" json:"tenant,omitempty"`
	Name        string    `gorm:"size:100;not null" json:"name"`
	Slug        string    `gorm:"size:100;not null" json:"slug"`
	Description string    `gorm:"size:255" json:"description"`
	Icon        string    `gorm:"size:50;default:'box'" json:"icon"`
	Products    []Product `gorm:"foreignKey:CategoryID" json:"products,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type Product struct {
	ID          uint                `gorm:"primaryKey" json:"id"`
	TenantID    uint                `gorm:"default:1;index" json:"tenant_id"`
	Tenant      *Tenant             `gorm:"foreignKey:TenantID" json:"tenant,omitempty"`
	Title       string              `gorm:"size:150;not null" json:"title"`
	Slug        string              `gorm:"size:150;not null" json:"slug"`
	SKU         string              `gorm:"size:80;index" json:"sku"`
	Description string              `gorm:"type:text" json:"description"`
	Price       float64             `gorm:"not null" json:"price"`
	Rating      float64             `gorm:"default:0" json:"-"`
	ReviewCount int                 `gorm:"default:0" json:"-"`
	ImageURL    string              `gorm:"size:500" json:"image_url"`
	CategoryID  uint                `gorm:"not null" json:"category_id"`
	Category    *Category           `gorm:"foreignKey:CategoryID" json:"category,omitempty"`
	ColorImages []ProductColorImage `gorm:"foreignKey:ProductID" json:"color_images,omitempty"`
	Variants    []ProductVariant    `gorm:"foreignKey:ProductID" json:"variants,omitempty"`
	ColorStocks []ProductColorStock `gorm:"foreignKey:ProductID" json:"color_stocks,omitempty"`

	// Especificações Técnicas de Impressão 3D
	Material    string `gorm:"size:100;default:'PLA Premium'" json:"material"`
	LayerHeight string `gorm:"size:50;default:'0.16mm'" json:"layer_height"`
	PrintTime   string `gorm:"size:50;default:'8 horas'" json:"print_time"`
	Dimensions  string `gorm:"size:100;default:'120 x 120 x 150 mm'" json:"dimensions"`
	Weight      string `gorm:"size:50;default:'180g'" json:"weight"`
	InStock     bool   `gorm:"default:true" json:"in_stock"`
	StockQty    int    `gorm:"default:10" json:"stock_qty"`
	Status      string `gorm:"size:20;default:'active';index" json:"status"`

	SourceProvider   string     `gorm:"size:50;index" json:"source_provider"`
	SourceExternalID string     `gorm:"size:120;index" json:"source_external_id"`
	SourceSyncedAt   *time.Time `json:"source_synced_at,omitempty"`

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	ReviewSummary *ProductReviewSummary `gorm:"-" json:"review_summary,omitempty"`
}

type ProductColorImage struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	TenantID  uint      `gorm:"not null;index" json:"tenant_id"`
	ProductID uint      `gorm:"not null;index" json:"product_id"`
	Product   *Product  `gorm:"foreignKey:ProductID" json:"product,omitempty"`
	ColorName string    `gorm:"size:80;not null" json:"color_name"`
	ImageURL  string    `gorm:"size:500;not null" json:"image_url"`
	SortOrder int       `gorm:"default:0" json:"sort_order"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type ProductVariant struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	TenantID    uint      `gorm:"not null;index" json:"tenant_id"`
	ProductID   uint      `gorm:"not null;index" json:"product_id"`
	Product     *Product  `gorm:"foreignKey:ProductID" json:"product,omitempty"`
	ColorName   string    `gorm:"size:80;not null" json:"color_name"`
	Price       float64   `gorm:"not null" json:"price"`
	Material    string    `gorm:"size:100" json:"material"`
	LayerHeight string    `gorm:"size:50" json:"layer_height"`
	PrintTime   string    `gorm:"size:50" json:"print_time"`
	Weight      string    `gorm:"size:50" json:"weight"`
	IsActive    bool      `gorm:"default:true" json:"is_active"`
	SortOrder   int       `gorm:"default:0" json:"sort_order"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type ProductColorStock struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	TenantID  uint      `gorm:"not null;index" json:"tenant_id"`
	ProductID uint      `gorm:"not null;index" json:"product_id"`
	Product   *Product  `gorm:"foreignKey:ProductID" json:"product,omitempty"`
	ColorName string    `gorm:"size:80;not null" json:"color_name"`
	StockQty  int       `gorm:"default:0" json:"stock_qty"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type StockMovement struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	TenantID      uint      `gorm:"not null;index" json:"tenant_id"`
	ProductID     uint      `gorm:"not null;index" json:"product_id"`
	Product       *Product  `gorm:"foreignKey:ProductID" json:"product,omitempty"`
	OrderID       *uint     `gorm:"index" json:"order_id,omitempty"`
	ColorName     string    `gorm:"size:80" json:"color_name"`
	MovementType  string    `gorm:"size:40;not null;index" json:"movement_type"`
	QuantityDelta int       `gorm:"not null" json:"quantity_delta"`
	QuantityAfter int       `gorm:"not null" json:"quantity_after"`
	Reason        string    `gorm:"size:255" json:"reason"`
	CreatedAt     time.Time `json:"created_at"`
}

type TenantCarrierAccount struct {
	ID                   uint       `gorm:"primaryKey" json:"id"`
	TenantID             uint       `gorm:"not null;index;uniqueIndex:idx_carrier_account_tenant_provider" json:"tenant_id"`
	Tenant               *Tenant    `gorm:"foreignKey:TenantID" json:"tenant,omitempty"`
	Provider             string     `gorm:"size:50;not null;uniqueIndex:idx_carrier_account_tenant_provider" json:"provider"`
	AccountName          string     `gorm:"size:120" json:"account_name"`
	AuthType             string     `gorm:"size:40;default:'contract_credentials'" json:"auth_type"`
	EncryptedCredentials string     `gorm:"type:text" json:"-"`
	TokenExpiresAt       *time.Time `json:"token_expires_at,omitempty"`
	IsActive             bool       `gorm:"default:true" json:"is_active"`
	IsConnected          bool       `gorm:"default:false" json:"is_connected"`
	SyncTracking         bool       `gorm:"default:true" json:"sync_tracking"`
	LastSyncAt           *time.Time `json:"last_sync_at,omitempty"`
	LastError            string     `gorm:"type:text" json:"last_error,omitempty"`
	CreatedAt            time.Time  `json:"created_at"`
	UpdatedAt            time.Time  `json:"updated_at"`
}

type OrderShipment struct {
	ID           uint            `gorm:"primaryKey" json:"id"`
	TenantID     uint            `gorm:"not null;index" json:"tenant_id"`
	Tenant       *Tenant         `gorm:"foreignKey:TenantID" json:"tenant,omitempty"`
	OrderID      uint            `gorm:"not null;index" json:"order_id"`
	Order        *Order          `gorm:"foreignKey:OrderID" json:"order,omitempty"`
	Carrier      string          `gorm:"size:50;not null;index" json:"carrier"`
	TrackingCode string          `gorm:"size:80;index" json:"tracking_code"`
	Status       string          `gorm:"size:40;default:'pending'" json:"status"`
	PostedAt     *time.Time      `json:"posted_at,omitempty"`
	DeliveredAt  *time.Time      `json:"delivered_at,omitempty"`
	LastSyncAt   *time.Time      `json:"last_sync_at,omitempty"`
	LastError    string          `gorm:"type:text" json:"last_error,omitempty"`
	Events       []ShipmentEvent `gorm:"foreignKey:ShipmentID" json:"events,omitempty"`
	CreatedAt    time.Time       `json:"created_at"`
	UpdatedAt    time.Time       `json:"updated_at"`
}

type ShipmentEvent struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	TenantID    uint           `gorm:"not null;index" json:"tenant_id"`
	ShipmentID  uint           `gorm:"not null;index" json:"shipment_id"`
	Shipment    *OrderShipment `gorm:"foreignKey:ShipmentID" json:"shipment,omitempty"`
	OrderID     uint           `gorm:"not null;index" json:"order_id"`
	Carrier     string         `gorm:"size:50;not null;index" json:"carrier"`
	EventCode   string         `gorm:"size:80" json:"event_code"`
	Description string         `gorm:"type:text" json:"description"`
	Location    string         `gorm:"size:160" json:"location"`
	OccurredAt  time.Time      `json:"occurred_at"`
	CreatedAt   time.Time      `json:"created_at"`
}

type ProductReview struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	TenantID  uint      `gorm:"not null;index" json:"tenant_id"`
	ProductID uint      `gorm:"not null;uniqueIndex:idx_review_product_user" json:"product_id"`
	Product   *Product  `gorm:"foreignKey:ProductID" json:"product,omitempty"`
	UserID    uint      `gorm:"not null;uniqueIndex:idx_review_product_user" json:"user_id"`
	User      *User     `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Rating    int       `gorm:"not null" json:"rating"`
	Comment   string    `gorm:"type:text" json:"comment"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type ProductFavorite struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	TenantID  uint      `gorm:"not null;index" json:"tenant_id"`
	ProductID uint      `gorm:"not null;uniqueIndex:idx_favorite_product_user" json:"product_id"`
	Product   *Product  `gorm:"foreignKey:ProductID" json:"product,omitempty"`
	UserID    uint      `gorm:"not null;uniqueIndex:idx_favorite_product_user" json:"user_id"`
	User      *User     `gorm:"foreignKey:UserID" json:"user,omitempty"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type ProductPricingSnapshot struct {
	ID                  uint      `gorm:"primaryKey" json:"id"`
	TenantID            uint      `gorm:"not null;index" json:"tenant_id"`
	ProductID           uint      `gorm:"not null;index" json:"product_id"`
	Product             *Product  `gorm:"foreignKey:ProductID" json:"product,omitempty"`
	ProductWeightGrams  float64   `json:"product_weight_grams"`
	SupportWeightGrams  float64   `json:"support_weight_grams"`
	PrintMinutes        float64   `json:"print_minutes"`
	SpoolPrice          float64   `json:"spool_price"`
	SpoolWeightGrams    float64   `json:"spool_weight_grams"`
	PrinterPowerKW      float64   `json:"printer_power_kw"`
	EnergyTariffPerKWh  float64   `json:"energy_tariff_per_kwh"`
	PackagingCost       float64   `json:"packaging_cost"`
	LaborCost           float64   `json:"labor_cost"`
	ExtraCost           float64   `json:"extra_cost"`
	FailureRatePercent  float64   `json:"failure_rate_percent"`
	MarginPercent       float64   `json:"margin_percent"`
	PlatformFeePercent  float64   `json:"platform_fee_percent"`
	PaymentFeePercent   float64   `json:"payment_fee_percent"`
	FixedFee            float64   `json:"fixed_fee"`
	TotalMaterialGrams  float64   `json:"total_material_grams"`
	MaterialCostPerGram float64   `json:"material_cost_per_gram"`
	MaterialCost        float64   `json:"material_cost"`
	EnergyKWh           float64   `json:"energy_kwh"`
	EnergyCost          float64   `json:"energy_cost"`
	DirectCost          float64   `json:"direct_cost"`
	FailureReserve      float64   `json:"failure_reserve"`
	OperationalCost     float64   `json:"operational_cost"`
	TargetNetRevenue    float64   `json:"target_net_revenue"`
	VariableFeeRate     float64   `json:"variable_fee_rate"`
	VariableFeeValue    float64   `json:"variable_fee_value"`
	TotalFees           float64   `json:"total_fees"`
	SuggestedPrice      float64   `json:"suggested_price"`
	NetAfterFees        float64   `json:"net_after_fees"`
	Profit              float64   `json:"profit"`
	ProfitMarginPercent float64   `json:"profit_margin_percent"`
	CreatedAt           time.Time `json:"created_at"`
}

type ProductActualCost struct {
	ID                   uint       `gorm:"primaryKey" json:"id"`
	TenantID             uint       `gorm:"not null;index" json:"tenant_id"`
	ProductID            uint       `gorm:"not null;index" json:"product_id"`
	Product              *Product   `gorm:"foreignKey:ProductID" json:"product,omitempty"`
	OrderID              *uint      `gorm:"index" json:"order_id,omitempty"`
	OrderItemID          *uint      `gorm:"index" json:"order_item_id,omitempty"`
	ActualPrintMinutes   float64    `json:"actual_print_minutes"`
	ActualMaterialGrams  float64    `json:"actual_material_grams"`
	FailedMaterialGrams  float64    `json:"failed_material_grams"`
	MaterialCost         float64    `json:"material_cost"`
	EnergyCost           float64    `json:"energy_cost"`
	PackagingCost        float64    `json:"packaging_cost"`
	LaborCost            float64    `json:"labor_cost"`
	ExtraCost            float64    `json:"extra_cost"`
	ShippingCost         float64    `json:"shipping_cost"`
	MarketplaceFeeAmount float64    `json:"marketplace_fee_amount"`
	DiscountAmount       float64    `json:"discount_amount"`
	TotalCost            float64    `json:"total_cost"`
	Notes                string     `gorm:"type:text" json:"notes"`
	OccurredAt           *time.Time `json:"occurred_at,omitempty"`
	CreatedAt            time.Time  `json:"created_at"`
	UpdatedAt            time.Time  `json:"updated_at"`
}

type TenantFixedCost struct {
	ID              uint      `gorm:"primaryKey" json:"id"`
	TenantID        uint      `gorm:"not null;index" json:"tenant_id"`
	Tenant          *Tenant   `gorm:"foreignKey:TenantID" json:"tenant,omitempty"`
	Name            string    `gorm:"size:120;not null" json:"name"`
	MonthlyAmount   float64   `gorm:"not null" json:"monthly_amount"`
	AllocationBasis string    `gorm:"size:30;default:'print_hours'" json:"allocation_basis"`
	IsActive        bool      `gorm:"default:true" json:"is_active"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

type ProductReviewSummary struct {
	AverageRating float64 `json:"average_rating"`
	ReviewCount   int64   `json:"review_count"`
}

type Order struct {
	ID              uint            `gorm:"primaryKey" json:"id"`
	TenantID        uint            `gorm:"default:1;index" json:"tenant_id"`
	Tenant          *Tenant         `gorm:"foreignKey:TenantID" json:"tenant,omitempty"`
	UserID          uint            `gorm:"not null" json:"user_id"`
	User            *User           `gorm:"foreignKey:UserID" json:"user,omitempty"`
	TotalAmount     float64         `gorm:"not null" json:"total_amount"`
	Status          string          `gorm:"size:30;default:'pending_confirmation'" json:"status"` // pending_confirmation, pending_payment, paid, preparing, delivered, cancelled
	Items           []OrderItem     `gorm:"foreignKey:OrderID" json:"items"`
	Shipments       []OrderShipment `gorm:"foreignKey:OrderID" json:"shipments,omitempty"`
	ShippingAddress string          `gorm:"type:text" json:"shipping_address"`
	DeliveryMethod  string          `gorm:"size:30;default:'shipping'" json:"delivery_method"`
	RecipientName   string          `gorm:"size:120" json:"recipient_name"`
	RecipientPhone  string          `gorm:"size:40" json:"recipient_phone"`
	ZipCode         string          `gorm:"size:20" json:"zip_code"`
	City            string          `gorm:"size:80" json:"city"`
	State           string          `gorm:"size:40" json:"state"`
	Notes           string          `gorm:"type:text" json:"notes"`
	PaymentProvider string          `gorm:"size:40" json:"payment_provider"`
	PaymentStatus   string          `gorm:"size:40;index" json:"payment_status"`
	PaymentID       string          `gorm:"size:120;index" json:"payment_id"`
	PaymentDetail   string          `gorm:"size:120" json:"payment_detail"`
	MPPreferenceID  string          `gorm:"size:120;index" json:"mp_preference_id"`
	MPInitPoint     string          `gorm:"type:text" json:"mp_init_point"`
	MPSandboxPoint  string          `gorm:"type:text" json:"mp_sandbox_init_point"`
	PaidAt          *time.Time      `json:"paid_at,omitempty"`
	CreatedAt       time.Time       `json:"created_at"`
	UpdatedAt       time.Time       `json:"updated_at"`
}

type OrderItem struct {
	ID        uint     `gorm:"primaryKey" json:"id"`
	OrderID   uint     `gorm:"not null" json:"order_id"`
	ProductID uint     `gorm:"not null" json:"product_id"`
	Product   *Product `gorm:"foreignKey:ProductID" json:"product,omitempty"`
	Quantity  int      `gorm:"not null" json:"quantity"`
	UnitPrice float64  `gorm:"not null" json:"unit_price"`
	Color     string   `gorm:"size:50;default:'Preto Slate'" json:"color"`
}

// Structs para requisições/respostas API

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

type CreateOrderItemInput struct {
	ProductID uint   `json:"product_id" binding:"required"`
	Quantity  int    `json:"quantity" binding:"required,min=1"`
	Color     string `json:"color"`
}

type CreateOrderInput struct {
	Items           []CreateOrderItemInput `json:"items" binding:"required,min=1"`
	ShippingAddress string                 `json:"shipping_address"`
	DeliveryMethod  string                 `json:"delivery_method"`
	RecipientName   string                 `json:"recipient_name"`
	RecipientPhone  string                 `json:"recipient_phone"`
	ZipCode         string                 `json:"zip_code"`
	City            string                 `json:"city"`
	State           string                 `json:"state"`
	Notes           string                 `json:"notes"`
}

type ProductInput struct {
	Title       string                   `json:"title" binding:"required"`
	Slug        string                   `json:"slug"`
	SKU         string                   `json:"sku"`
	Description string                   `json:"description"`
	Price       float64                  `json:"price" binding:"required"`
	ImageURL    string                   `json:"image_url"`
	CategoryID  uint                     `json:"category_id" binding:"required"`
	Material    string                   `json:"material"`
	LayerHeight string                   `json:"layer_height"`
	PrintTime   string                   `json:"print_time"`
	Dimensions  string                   `json:"dimensions"`
	Weight      string                   `json:"weight"`
	InStock     bool                     `json:"in_stock"`
	StockQty    int                      `json:"stock_qty"`
	Status      string                   `json:"status"`
	ColorImages []ProductColorImageInput `json:"color_images"`
	Variants    []ProductVariantInput    `json:"variants"`
	ColorStocks []ProductColorStockInput `json:"color_stocks"`
	Pricing     *PricingCalculationInput `json:"pricing_snapshot"`
}

type ProductColorImageInput struct {
	ColorName string `json:"color_name"`
	ImageURL  string `json:"image_url"`
	SortOrder int    `json:"sort_order"`
}

type ProductReviewInput struct {
	Rating  int    `json:"rating" binding:"required,min=1,max=5"`
	Comment string `json:"comment"`
}

type ProductVariantInput struct {
	ColorName   string  `json:"color_name"`
	Price       float64 `json:"price"`
	Material    string  `json:"material"`
	LayerHeight string  `json:"layer_height"`
	PrintTime   string  `json:"print_time"`
	Weight      string  `json:"weight"`
	IsActive    bool    `json:"is_active"`
	SortOrder   int     `json:"sort_order"`
}

type ProductColorStockInput struct {
	ColorName string `json:"color_name"`
	StockQty  int    `json:"stock_qty"`
}

type StockAdjustmentInput struct {
	ProductID uint   `json:"product_id" binding:"required"`
	ColorName string `json:"color_name"`
	StockQty  int    `json:"stock_qty" binding:"min=0"`
	Reason    string `json:"reason"`
}

type TenantCarrierAccountInput struct {
	Provider     string         `json:"provider" binding:"required"`
	AccountName  string         `json:"account_name"`
	AuthType     string         `json:"auth_type"`
	IsActive     bool           `json:"is_active"`
	SyncTracking bool           `json:"sync_tracking"`
	Credentials  map[string]any `json:"credentials"`
}

type OrderShipmentInput struct {
	OrderID      uint   `json:"order_id" binding:"required"`
	Carrier      string `json:"carrier"`
	TrackingCode string `json:"tracking_code" binding:"required"`
	Status       string `json:"status"`
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
}

type TenantMarketplaceSettingsInput struct {
	MarketplaceControlsPrice   bool   `json:"marketplace_controls_price"`
	MarketplaceControlsStock   bool   `json:"marketplace_controls_stock"`
	ContentSyncPolicy          string `json:"content_sync_policy"`
	NewImportedProductStatus   string `json:"new_imported_product_status"`
	AutoCreateInternalOrders   bool   `json:"auto_create_internal_orders"`
	AutoCreateFinancialEntries bool   `json:"auto_create_financial_entries"`
}

type PricingCalculationInput struct {
	ProductWeightGrams  float64 `json:"productWeightGrams"`
	SupportWeightGrams  float64 `json:"supportWeightGrams"`
	PrintMinutes        float64 `json:"printMinutes"`
	SpoolPrice          float64 `json:"spoolPrice"`
	SpoolWeightGrams    float64 `json:"spoolWeightGrams"`
	PrinterPowerKW      float64 `json:"printerPowerKw"`
	EnergyTariffPerKWh  float64 `json:"energyTariffPerKwh"`
	PackagingCost       float64 `json:"packagingCost"`
	LaborCost           float64 `json:"laborCost"`
	ExtraCost           float64 `json:"extraCost"`
	FailureRatePercent  float64 `json:"failureRatePercent"`
	MarginPercent       float64 `json:"marginPercent"`
	PlatformFeePercent  float64 `json:"platformFeePercent"`
	PaymentFeePercent   float64 `json:"paymentFeePercent"`
	FixedFee            float64 `json:"fixedFee"`
	MaterialPresetID    uint    `json:"materialPresetId"`
	PrinterPresetID     uint    `json:"printerPresetId"`
	PlatformFeePresetID uint    `json:"platformFeePresetId"`
}

type PricingCalculationResult struct {
	TotalMaterialGrams  float64 `json:"totalMaterialGrams"`
	MaterialCostPerGram float64 `json:"materialCostPerGram"`
	MaterialCost        float64 `json:"materialCost"`
	EnergyKWh           float64 `json:"energyKwh"`
	EnergyCost          float64 `json:"energyCost"`
	DirectCost          float64 `json:"directCost"`
	FailureReserve      float64 `json:"failureReserve"`
	OperationalCost     float64 `json:"operationalCost"`
	TargetNetRevenue    float64 `json:"targetNetRevenue"`
	VariableFeeRate     float64 `json:"variableFeeRate"`
	VariableFeeValue    float64 `json:"variableFeeValue"`
	FixedFee            float64 `json:"fixedFee"`
	TotalFees           float64 `json:"totalFees"`
	SuggestedPrice      float64 `json:"suggestedPrice"`
	NetAfterFees        float64 `json:"netAfterFees"`
	Profit              float64 `json:"profit"`
	ProfitMarginPercent float64 `json:"profitMarginPercent"`
}

type TenantPricingBundle struct {
	Store              TenantStoreSettings       `json:"store"`
	Pricing            TenantPricingSettings     `json:"pricing"`
	Fulfillment        TenantFulfillmentSettings `json:"fulfillment"`
	MaterialPresets    []MaterialPreset          `json:"material_presets"`
	PrinterPresets     []PrinterPreset           `json:"printer_presets"`
	PlatformFeePresets []PlatformFeePreset       `json:"platform_fee_presets"`
}

type PresetInput struct {
	Name               string  `json:"name" binding:"required"`
	MaterialType       string  `json:"material_type"`
	ColorName          string  `json:"color_name"`
	SpoolPrice         float64 `json:"spool_price"`
	SpoolWeightGrams   float64 `json:"spool_weight_grams"`
	PowerKW            float64 `json:"power_kw"`
	PlatformFeePercent float64 `json:"platform_fee_percent"`
	PaymentFeePercent  float64 `json:"payment_fee_percent"`
	FixedFee           float64 `json:"fixed_fee"`
	IsDefault          bool    `json:"is_default"`
	IsActive           bool    `json:"is_active"`
}

type TenantFixedCostInput struct {
	Name            string  `json:"name" binding:"required"`
	MonthlyAmount   float64 `json:"monthly_amount" binding:"required"`
	AllocationBasis string  `json:"allocation_basis"`
	IsActive        bool    `json:"is_active"`
}

type ProductActualCostInput struct {
	ProductID            uint    `json:"product_id" binding:"required"`
	OrderID              *uint   `json:"order_id"`
	OrderItemID          *uint   `json:"order_item_id"`
	ActualPrintMinutes   float64 `json:"actual_print_minutes"`
	ActualMaterialGrams  float64 `json:"actual_material_grams"`
	FailedMaterialGrams  float64 `json:"failed_material_grams"`
	MaterialCost         float64 `json:"material_cost"`
	EnergyCost           float64 `json:"energy_cost"`
	PackagingCost        float64 `json:"packaging_cost"`
	LaborCost            float64 `json:"labor_cost"`
	ExtraCost            float64 `json:"extra_cost"`
	ShippingCost         float64 `json:"shipping_cost"`
	MarketplaceFeeAmount float64 `json:"marketplace_fee_amount"`
	DiscountAmount       float64 `json:"discount_amount"`
	Notes                string  `json:"notes"`
}

type PricingScenarioInput struct {
	ProductID            uint                    `json:"product_id"`
	Quantity             int                     `json:"quantity"`
	Base                 PricingCalculationInput `json:"base"`
	PlatformFeeScenarios []PlatformFeePreset     `json:"platform_fee_scenarios"`
}

type FinancialProductSummary struct {
	ProductID              uint    `json:"product_id"`
	ProductTitle           string  `json:"product_title"`
	UnitsSold              int     `json:"units_sold"`
	GrossRevenue           float64 `json:"gross_revenue"`
	EstimatedCost          float64 `json:"estimated_cost"`
	EstimatedFees          float64 `json:"estimated_fees"`
	EstimatedProfit        float64 `json:"estimated_profit"`
	EstimatedMarginPercent float64 `json:"estimated_margin_percent"`
	ActualCost             float64 `json:"actual_cost"`
	ActualProfit           float64 `json:"actual_profit"`
	ActualMarginPercent    float64 `json:"actual_margin_percent"`
}

type FinancialChannelSummary struct {
	Provider          string  `json:"provider"`
	OrdersCount       int     `json:"orders_count"`
	UnitsSold         int     `json:"units_sold"`
	GrossRevenue      float64 `json:"gross_revenue"`
	MarketplaceFees   float64 `json:"marketplace_fees"`
	ShippingCost      float64 `json:"shipping_cost"`
	DiscountAmount    float64 `json:"discount_amount"`
	NetRevenue        float64 `json:"net_revenue"`
	EstimatedCost     float64 `json:"estimated_cost"`
	EstimatedProfit   float64 `json:"estimated_profit"`
	MarginPercent     float64 `json:"margin_percent"`
	LastExternalOrder string  `json:"last_external_order"`
}

type FinancialSummary struct {
	GrossRevenue           float64                   `json:"gross_revenue"`
	EstimatedOperational   float64                   `json:"estimated_operational_cost"`
	EstimatedFees          float64                   `json:"estimated_fees"`
	FixedCostsMonthly      float64                   `json:"fixed_costs_monthly"`
	EstimatedNetProfit     float64                   `json:"estimated_net_profit"`
	EstimatedMarginPercent float64                   `json:"estimated_margin_percent"`
	ActualCosts            float64                   `json:"actual_costs"`
	ActualNetProfit        float64                   `json:"actual_net_profit"`
	ActualMarginPercent    float64                   `json:"actual_margin_percent"`
	OrdersCount            int                       `json:"orders_count"`
	UnitsSold              int                       `json:"units_sold"`
	AverageTicket          float64                   `json:"average_ticket"`
	TopProducts            []FinancialProductSummary `json:"top_products"`
	LowMarginProducts      []FinancialProductSummary `json:"low_margin_products"`
	Channels               []FinancialChannelSummary `json:"channels"`
}

type CategoryInput struct {
	Name        string `json:"name" binding:"required"`
	Slug        string `json:"slug"`
	Description string `json:"description"`
	Icon        string `json:"icon"`
}

type UpdateOrderStatusInput struct {
	Status string `json:"status" binding:"required"`
}

// Entidades de Integração de Marketplaces (Mercado Livre, Shopee, Amazon)

type MarketplaceIntegration struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	TenantID     uint      `gorm:"not null;index" json:"tenant_id"`
	Tenant       *Tenant   `gorm:"foreignKey:TenantID" json:"tenant,omitempty"`
	Provider     string    `gorm:"size:50;not null" json:"provider"` // mercadolivre, shopee, amazon
	SellerID     string    `gorm:"size:100" json:"seller_id"`
	SellerName   string    `gorm:"size:150" json:"seller_name"`
	AccessToken  string    `gorm:"type:text" json:"-"`
	RefreshToken string    `gorm:"type:text" json:"-"`
	ExpiresAt    time.Time `json:"expires_at"`
	IsActive     bool      `gorm:"default:true" json:"is_active"`
	SyncOrders   bool      `gorm:"default:true" json:"sync_orders"`
	SyncStock    bool      `gorm:"default:true" json:"sync_stock"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type MarketplaceProductMapping struct {
	ID             uint       `gorm:"primaryKey" json:"id"`
	TenantID       uint       `gorm:"not null;index" json:"tenant_id"`
	ProductID      uint       `gorm:"not null;index" json:"product_id"`
	Product        *Product   `gorm:"foreignKey:ProductID" json:"product,omitempty"`
	Provider       string     `gorm:"size:50;not null" json:"provider"` // mercadolivre, shopee, amazon
	InternalSKU    string     `gorm:"size:100;index" json:"internal_sku"`
	ExternalSKU    string     `gorm:"size:100;index" json:"external_sku"`
	ExternalTitle  string     `gorm:"size:180" json:"external_title"`
	ExternalItemID string     `gorm:"size:100;not null" json:"external_item_id"`
	ExternalURL    string     `gorm:"size:500" json:"external_url"`
	SyncStatus     string     `gorm:"size:30;default:'synced'" json:"sync_status"` // synced, pending, error
	LastSyncedAt   *time.Time `json:"last_synced_at"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

type MarketplaceAccount struct {
	ID                   uint       `gorm:"primaryKey" json:"id"`
	TenantID             uint       `gorm:"not null;index;uniqueIndex:idx_marketplace_account_tenant_provider" json:"tenant_id"`
	Tenant               *Tenant    `gorm:"foreignKey:TenantID" json:"tenant,omitempty"`
	Provider             string     `gorm:"size:50;not null;uniqueIndex:idx_marketplace_account_tenant_provider" json:"provider"`
	AccountName          string     `gorm:"size:150" json:"account_name"`
	SellerID             string     `gorm:"size:120" json:"seller_id"`
	ShopID               string     `gorm:"size:120" json:"shop_id"`
	Marketplace          string     `gorm:"size:40" json:"marketplace"`
	AccessToken          string     `gorm:"type:text" json:"-"`
	RefreshToken         string     `gorm:"type:text" json:"-"`
	AuthCode             string     `gorm:"type:text" json:"-"`
	EncryptedCredentials string     `gorm:"type:text" json:"-"`
	TokenExpiresAt       *time.Time `json:"token_expires_at,omitempty"`
	IsActive             bool       `gorm:"default:true" json:"is_active"`
	IsConnected          bool       `gorm:"default:false" json:"is_connected"`
	SyncOrders           bool       `gorm:"default:true" json:"sync_orders"`
	SyncStock            bool       `gorm:"default:true" json:"sync_stock"`
	SyncStatus           string     `gorm:"size:30;default:'pending_credentials'" json:"sync_status"`
	LastSyncAt           *time.Time `json:"last_sync_at,omitempty"`
	LastError            string     `gorm:"type:text" json:"last_error"`
	CreatedAt            time.Time  `json:"created_at"`
	UpdatedAt            time.Time  `json:"updated_at"`
}

type marketplaceAccountCredentials struct {
	AccessToken  string `json:"access_token,omitempty"`
	RefreshToken string `json:"refresh_token,omitempty"`
	AuthCode     string `json:"auth_code,omitempty"`
}

func marketplaceCredentialSecret() string {
	return strings.TrimSpace(os.Getenv("CREDENTIAL_ENCRYPTION_KEY"))
}

func (account *MarketplaceAccount) AfterFind(tx *gorm.DB) error {
	secret := marketplaceCredentialSecret()
	if secret == "" || strings.TrimSpace(account.EncryptedCredentials) == "" {
		return nil
	}

	decrypted, err := utils.DecryptString(account.EncryptedCredentials, secret)
	if err != nil {
		return nil
	}

	var credentials marketplaceAccountCredentials
	if err := json.Unmarshal([]byte(decrypted), &credentials); err != nil {
		return nil
	}
	account.AccessToken = credentials.AccessToken
	account.RefreshToken = credentials.RefreshToken
	account.AuthCode = credentials.AuthCode
	return nil
}

func (account *MarketplaceAccount) BeforeSave(tx *gorm.DB) error {
	secret := marketplaceCredentialSecret()
	if secret == "" {
		return nil
	}

	credentials := marketplaceAccountCredentials{
		AccessToken:  strings.TrimSpace(account.AccessToken),
		RefreshToken: strings.TrimSpace(account.RefreshToken),
		AuthCode:     strings.TrimSpace(account.AuthCode),
	}
	if credentials.AccessToken == "" && credentials.RefreshToken == "" && credentials.AuthCode == "" {
		return nil
	}

	raw, err := json.Marshal(credentials)
	if err != nil {
		return err
	}
	encrypted, err := utils.EncryptString(string(raw), secret)
	if err != nil {
		return err
	}
	account.EncryptedCredentials = encrypted
	account.AccessToken = ""
	account.RefreshToken = ""
	account.AuthCode = ""
	return nil
}

type ExternalMarketplaceOrder struct {
	ID              uint                           `gorm:"primaryKey" json:"id"`
	TenantID        uint                           `gorm:"not null;index;uniqueIndex:idx_external_order_tenant_provider" json:"tenant_id"`
	Provider        string                         `gorm:"size:50;not null;uniqueIndex:idx_external_order_tenant_provider" json:"provider"`
	ExternalOrderID string                         `gorm:"size:120;not null;uniqueIndex:idx_external_order_tenant_provider" json:"external_order_id"`
	ExternalStatus  string                         `gorm:"size:60;index" json:"external_status"`
	Currency        string                         `gorm:"size:10;default:'BRL'" json:"currency"`
	GrossAmount     float64                        `json:"gross_amount"`
	ItemsAmount     float64                        `json:"items_amount"`
	ShippingCost    float64                        `json:"shipping_cost"`
	MarketplaceFees float64                        `json:"marketplace_fees"`
	DiscountAmount  float64                        `json:"discount_amount"`
	NetAmount       float64                        `json:"net_amount"`
	BuyerNickname   string                         `gorm:"size:120" json:"buyer_nickname"`
	InternalOrderID *uint                          `gorm:"index" json:"internal_order_id,omitempty"`
	Items           []ExternalMarketplaceOrderItem `gorm:"foreignKey:ExternalOrderIDRef" json:"items,omitempty"`
	OrderedAt       time.Time                      `json:"ordered_at"`
	SyncedAt        time.Time                      `json:"synced_at"`
	RawPayload      string                         `gorm:"type:text" json:"raw_payload,omitempty"`
	CreatedAt       time.Time                      `json:"created_at"`
	UpdatedAt       time.Time                      `json:"updated_at"`
}

type ExternalMarketplaceOrderItem struct {
	ID                 uint      `gorm:"primaryKey" json:"id"`
	TenantID           uint      `gorm:"not null;index" json:"tenant_id"`
	ExternalOrderIDRef uint      `gorm:"not null;index" json:"external_order_id_ref"`
	ProductID          *uint     `gorm:"index" json:"product_id,omitempty"`
	Product            *Product  `gorm:"foreignKey:ProductID" json:"product,omitempty"`
	Provider           string    `gorm:"size:50;not null" json:"provider"`
	ExternalItemID     string    `gorm:"size:120;index" json:"external_item_id"`
	ExternalSKU        string    `gorm:"size:120;index" json:"external_sku"`
	Title              string    `gorm:"size:180" json:"title"`
	Quantity           int       `json:"quantity"`
	UnitPrice          float64   `json:"unit_price"`
	GrossAmount        float64   `json:"gross_amount"`
	FeeAmount          float64   `json:"fee_amount"`
	DiscountAmount     float64   `json:"discount_amount"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
}

type MarketplaceWebhookEvent struct {
	ID               uint       `gorm:"primaryKey" json:"id"`
	TenantID         uint       `gorm:"index" json:"tenant_id"`
	Tenant           *Tenant    `gorm:"foreignKey:TenantID" json:"tenant,omitempty"`
	Provider         string     `gorm:"size:50;not null;index" json:"provider"`
	EventType        string     `gorm:"size:100;index" json:"event_type"`
	ExternalID       string     `gorm:"size:160;index" json:"external_id"`
	ExternalResource string     `gorm:"size:500" json:"external_resource"`
	Status           string     `gorm:"size:30;default:'pending'" json:"status"`
	Payload          string     `gorm:"type:text" json:"payload"`
	Headers          string     `gorm:"type:text" json:"headers,omitempty"`
	ReceivedAt       time.Time  `json:"received_at"`
	ProcessedAt      *time.Time `json:"processed_at,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

type PaymentWebhookEvent struct {
	ID           uint       `gorm:"primaryKey" json:"id"`
	TenantID     uint       `gorm:"index" json:"tenant_id"`
	Tenant       *Tenant    `gorm:"foreignKey:TenantID" json:"tenant,omitempty"`
	Provider     string     `gorm:"size:50;not null;index" json:"provider"`
	EventType    string     `gorm:"size:100;index" json:"event_type"`
	ExternalID   string     `gorm:"size:160;index" json:"external_id"`
	OrderID      *uint      `gorm:"index" json:"order_id,omitempty"`
	Status       string     `gorm:"size:30;default:'received'" json:"status"`
	Payload      string     `gorm:"type:text" json:"payload"`
	Headers      string     `gorm:"type:text" json:"headers,omitempty"`
	ErrorMessage string     `gorm:"type:text" json:"error_message,omitempty"`
	ReceivedAt   time.Time  `json:"received_at"`
	ProcessedAt  *time.Time `json:"processed_at,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

// MercadoPagoPlatformConfig guarda as credenciais da aplicacao OAuth da AZ3D.
// Segredos permanecem criptografados no banco e nunca sao serializados.
type MercadoPagoPlatformConfig struct {
	ID                      uint      `gorm:"primaryKey" json:"id"`
	ClientID                string    `gorm:"size:120;not null" json:"client_id"`
	EncryptedClientSecret   string    `gorm:"type:text;not null" json:"-"`
	RedirectURI             string    `gorm:"size:500;not null" json:"redirect_uri"`
	EncryptedWebhookSecret  string    `gorm:"type:text" json:"-"`
	ClientSecretConfigured  bool      `gorm:"-" json:"client_secret_configured"`
	WebhookSecretConfigured bool      `gorm:"-" json:"webhook_secret_configured"`
	CreatedAt               time.Time `json:"created_at"`
	UpdatedAt               time.Time `json:"updated_at"`
}

// TenantPaymentAccount representa a autorizacao concedida pelo vendedor.
// O access token usado no checkout pertence a esta conta, nunca a plataforma.
type TenantPaymentAccount struct {
	ID                    uint       `gorm:"primaryKey" json:"id"`
	TenantID              uint       `gorm:"not null;index;uniqueIndex:idx_tenant_payment_provider" json:"tenant_id"`
	Tenant                *Tenant    `gorm:"foreignKey:TenantID" json:"tenant,omitempty"`
	Provider              string     `gorm:"size:40;not null;uniqueIndex:idx_tenant_payment_provider" json:"provider"`
	SellerID              string     `gorm:"size:120;index" json:"seller_id"`
	PublicKey             string     `gorm:"size:220" json:"public_key,omitempty"`
	EncryptedAccessToken  string     `gorm:"type:text" json:"-"`
	EncryptedRefreshToken string     `gorm:"type:text" json:"-"`
	TokenExpiresAt        *time.Time `json:"token_expires_at,omitempty"`
	Scope                 string     `gorm:"size:255" json:"scope,omitempty"`
	LiveMode              bool       `json:"live_mode"`
	Status                string     `gorm:"size:30;not null;default:'disconnected';index" json:"status"`
	LastError             string     `gorm:"type:text" json:"last_error,omitempty"`
	ConnectedAt           *time.Time `json:"connected_at,omitempty"`
	CreatedAt             time.Time  `json:"created_at"`
	UpdatedAt             time.Time  `json:"updated_at"`
}

// PaymentOAuthSession mantem state e PKCE no servidor e torna o callback
// de uso unico. O state publico nunca carrega tenant_id ou outro dado sensivel.
type PaymentOAuthSession struct {
	StateHash             string     `gorm:"primaryKey;size:64" json:"-"`
	TenantID              uint       `gorm:"not null;index" json:"-"`
	EncryptedCodeVerifier string     `gorm:"type:text;not null" json:"-"`
	ExpiresAt             time.Time  `gorm:"not null;index" json:"-"`
	UsedAt                *time.Time `gorm:"index" json:"-"`
	CreatedAt             time.Time  `json:"-"`
}

// MercadoLivrePlatformConfig guarda uma unica aplicacao OAuth da plataforma.
// Cada seller concede seu proprio grant, salvo em MarketplaceAccount por tenant.
type MercadoLivrePlatformConfig struct {
	ID                     uint      `gorm:"primaryKey" json:"id"`
	ClientID               string    `gorm:"size:120;not null" json:"client_id"`
	EncryptedClientSecret  string    `gorm:"type:text;not null" json:"-"`
	RedirectURI            string    `gorm:"size:500;not null" json:"redirect_uri"`
	ClientSecretConfigured bool      `gorm:"-" json:"client_secret_configured"`
	CreatedAt              time.Time `json:"created_at"`
	UpdatedAt              time.Time `json:"updated_at"`
}

// MarketplaceOAuthSession vincula state/PKCE a um tenant sem expor tenant_id
// na URL publica. A sessao e curta e consumida uma unica vez no callback.
type MarketplaceOAuthSession struct {
	StateHash             string     `gorm:"primaryKey;size:64" json:"-"`
	TenantID              uint       `gorm:"not null;index" json:"-"`
	Provider              string     `gorm:"size:50;not null;index" json:"-"`
	EncryptedCodeVerifier string     `gorm:"type:text;not null" json:"-"`
	ExpiresAt             time.Time  `gorm:"not null;index" json:"-"`
	UsedAt                *time.Time `gorm:"index" json:"-"`
	CreatedAt             time.Time  `json:"-"`
}

type MarketplaceIntegrationInput struct {
	Provider   string `json:"provider" binding:"required"`
	SellerID   string `json:"seller_id"`
	SellerName string `json:"seller_name"`
	IsActive   bool   `json:"is_active"`
	SyncOrders bool   `json:"sync_orders"`
	SyncStock  bool   `json:"sync_stock"`
}

type MarketplaceProductSyncInput struct {
	ProductID uint   `json:"product_id" binding:"required"`
	Provider  string `json:"provider" binding:"required"`
}

type MarketplaceAccountInput struct {
	Provider     string `json:"provider" binding:"required"`
	AccountName  string `json:"account_name"`
	SellerID     string `json:"seller_id"`
	ShopID       string `json:"shop_id"`
	Marketplace  string `json:"marketplace"`
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	IsActive     bool   `json:"is_active"`
	SyncOrders   bool   `json:"sync_orders"`
	SyncStock    bool   `json:"sync_stock"`
}

type MarketplaceOAuthStartInput struct {
	Provider    string `json:"provider" binding:"required"`
	RedirectURI string `json:"redirect_uri"`
}

type MarketplaceOAuthCallbackInput struct {
	Provider    string `json:"provider" binding:"required"`
	Code        string `json:"code" binding:"required"`
	State       string `json:"state"`
	ShopID      string `json:"shop_id"`
	SellerID    string `json:"seller_id"`
	RedirectURI string `json:"redirect_uri"`
}

type MarketplaceSyncInput struct {
	Provider string `json:"provider"`
	Days     int    `json:"days"`
}

type MarketplaceCatalogSyncInput struct {
	Provider string `json:"provider"`
}

type MarketplaceCatalogItemInput struct {
	ExternalItemID string                   `json:"external_item_id" binding:"required"`
	ExternalSKU    string                   `json:"external_sku"`
	ExternalTitle  string                   `json:"external_title"`
	ExternalURL    string                   `json:"external_url"`
	Title          string                   `json:"title" binding:"required"`
	Description    string                   `json:"description"`
	Price          float64                  `json:"price" binding:"required"`
	ImageURL       string                   `json:"image_url"`
	CategoryID     uint                     `json:"category_id"`
	Material       string                   `json:"material"`
	LayerHeight    string                   `json:"layer_height"`
	PrintTime      string                   `json:"print_time"`
	Dimensions     string                   `json:"dimensions"`
	Weight         string                   `json:"weight"`
	StockQty       int                      `json:"stock_qty"`
	Status         string                   `json:"status"`
	ColorImages    []ProductColorImageInput `json:"color_images"`
	Variants       []ProductVariantInput    `json:"variants"`
	ColorStocks    []ProductColorStockInput `json:"color_stocks"`
}

type MarketplaceProductImportInput struct {
	Provider          string                        `json:"provider" binding:"required"`
	DefaultCategoryID uint                          `json:"default_category_id"`
	OverwriteLocal    bool                          `json:"overwrite_local"`
	Products          []MarketplaceCatalogItemInput `json:"products" binding:"required,min=1"`
}

type MarketplaceProductImportResult struct {
	Action  string                    `json:"action"`
	Product Product                   `json:"product"`
	Mapping MarketplaceProductMapping `json:"mapping"`
}

type MarketplaceProductMappingInput struct {
	ProductID      uint   `json:"product_id" binding:"required"`
	Provider       string `json:"provider" binding:"required"`
	InternalSKU    string `json:"internal_sku"`
	ExternalSKU    string `json:"external_sku"`
	ExternalTitle  string `json:"external_title"`
	ExternalItemID string `json:"external_item_id" binding:"required"`
	ExternalURL    string `json:"external_url"`
}
