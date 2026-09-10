package models

import (
	"time"

	"gorm.io/gorm"
)

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
	VideoURL    string              `gorm:"size:500" json:"video_url"`
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
	VideoURL  string    `gorm:"size:500" json:"video_url"`
	SortOrder int       `gorm:"default:0" json:"sort_order"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type ProductVariant struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	TenantID      uint      `gorm:"not null;index" json:"tenant_id"`
	ProductID     uint      `gorm:"not null;index" json:"product_id"`
	Product       *Product  `gorm:"foreignKey:ProductID" json:"product,omitempty"`
	ColorName     string    `gorm:"size:80;not null" json:"color_name"`
	VariationName string    `gorm:"size:180" json:"variation_name"`
	Attributes    string    `gorm:"type:jsonb;default:'[]'" json:"attributes"`
	Price         float64   `gorm:"not null" json:"price"`
	Material      string    `gorm:"size:100" json:"material"`
	LayerHeight   string    `gorm:"size:50" json:"layer_height"`
	PrintTime     string    `gorm:"size:50" json:"print_time"`
	Weight        string    `gorm:"size:50" json:"weight"`
	IsActive      bool      `gorm:"default:true" json:"is_active"`
	SortOrder     int       `gorm:"default:0" json:"sort_order"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
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

type ProductReviewSummary struct {
	AverageRating float64 `json:"average_rating"`
	ReviewCount   int64   `json:"review_count"`
}

type FilamentSpool struct {
	ID               uint      `gorm:"primaryKey" json:"id"`
	TenantID         uint      `gorm:"not null;index" json:"tenant_id"`
	Tenant           *Tenant   `gorm:"foreignKey:TenantID" json:"tenant,omitempty"`
	Name             string    `gorm:"size:120;not null" json:"name"`
	MaterialType     string    `gorm:"size:30;not null" json:"material_type"`
	ColorName        string    `gorm:"size:60;not null" json:"color_name"`
	ColorHex         string    `gorm:"size:20;default:'#3b82f6'" json:"color_hex"`
	SpoolWeightG     float64   `gorm:"default:1000" json:"spool_weight_g"`
	RemainingWeightG float64   `gorm:"default:1000" json:"remaining_weight_g"`
	PricePerKG       float64   `gorm:"default:120" json:"price_per_kg"`
	Vendor           string    `gorm:"size:100" json:"vendor"`
	IsActive         bool      `gorm:"default:true" json:"is_active"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

type FilamentSpoolInput struct {
	Name             string  `json:"name" binding:"required"`
	MaterialType     string  `json:"material_type" binding:"required"`
	ColorName        string  `json:"color_name" binding:"required"`
	ColorHex         string  `json:"color_hex"`
	SpoolWeightG     float64 `json:"spool_weight_g"`
	RemainingWeightG float64 `json:"remaining_weight_g"`
	PricePerKG       float64 `json:"price_per_kg"`
	Vendor           string  `json:"vendor"`
	IsActive         *bool   `json:"is_active"`
}

type Custom3DQuote struct {
	ID               uint      `gorm:"primaryKey" json:"id"`
	TenantID         uint      `gorm:"not null;index" json:"tenant_id"`
	Tenant           *Tenant   `gorm:"foreignKey:TenantID" json:"tenant,omitempty"`
	FileName         string    `gorm:"size:255;not null" json:"file_name"`
	FileSizeMB       float64   `json:"file_size_mb"`
	MaterialType     string    `gorm:"size:30;not null" json:"material_type"`
	InfillPercent    int       `gorm:"default:20" json:"infill_percent"`
	EstimatedWeightG float64   `json:"estimated_weight_g"`
	EstimatedHours   float64   `json:"estimated_hours"`
	EstimatedPrice   float64   `json:"estimated_price"`
	CustomerEmail    string    `gorm:"size:150" json:"customer_email"`
	Status           string    `gorm:"size:30;default:'pending'" json:"status"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

type Custom3DQuoteInput struct {
	FileName         string  `json:"file_name" binding:"required"`
	FileSizeMB       float64 `json:"file_size_mb"`
	MaterialType     string  `json:"material_type"`
	InfillPercent    int     `json:"infill_percent"`
	EstimatedWeightG float64 `json:"estimated_weight_g"`
	EstimatedHours   float64 `json:"estimated_hours"`
	EstimatedPrice   float64 `json:"estimated_price"`
	CustomerEmail    string  `json:"customer_email"`
}

type ProductInput struct {
	Title       string                   `json:"title" binding:"required"`
	Slug        string                   `json:"slug"`
	SKU         string                   `json:"sku"`
	Description string                   `json:"description"`
	Price       float64                  `json:"price" binding:"required"`
	ImageURL    string                   `json:"image_url"`
	VideoURL    string                   `json:"video_url"`
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
	VideoURL  string `json:"video_url"`
	SortOrder int    `json:"sort_order"`
}

type ProductReviewInput struct {
	Rating  int    `json:"rating" binding:"required,min=1,max=5"`
	Comment string `json:"comment"`
}

type ProductVariantInput struct {
	ColorName     string  `json:"color_name"`
	VariationName string  `json:"variation_name"`
	Attributes    string  `json:"attributes"`
	Price         float64 `json:"price"`
	Material      string  `json:"material"`
	LayerHeight   string  `json:"layer_height"`
	PrintTime     string  `json:"print_time"`
	Weight        string  `json:"weight"`
	IsActive      bool    `json:"is_active"`
	SortOrder     int     `json:"sort_order"`
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

type CategoryInput struct {
	Name        string `json:"name" binding:"required"`
	Slug        string `json:"slug"`
	Description string `json:"description"`
	Icon        string `json:"icon"`
}
