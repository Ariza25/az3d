package models

import (
	"time"
)

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
