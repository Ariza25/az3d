package models

import (
	"encoding/json"
	"os"
	"strings"
	"time"

	"az3d-backend/utils"

	"gorm.io/gorm"
)

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
	SyncCatalog          bool       `gorm:"default:true" json:"sync_catalog"`
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
	DedupKey         string     `gorm:"size:190;index" json:"dedup_key"`
	Status           string     `gorm:"size:30;default:'pending'" json:"status"`
	RetryCount       int        `gorm:"default:0" json:"retry_count"`
	NextAttemptAt    *time.Time `gorm:"index" json:"next_attempt_at,omitempty"`
	Payload          string     `gorm:"type:text" json:"payload"`
	Headers          string     `gorm:"type:text" json:"headers,omitempty"`
	ErrorMessage     string     `gorm:"type:text" json:"error_message,omitempty"`
	ReceivedAt       time.Time  `json:"received_at"`
	ProcessedAt      *time.Time `json:"processed_at,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

type MercadoLivrePlatformConfig struct {
	ID                     uint      `gorm:"primaryKey" json:"id"`
	ClientID               string    `gorm:"size:120;not null" json:"client_id"`
	EncryptedClientSecret  string    `gorm:"type:text;not null" json:"-"`
	RedirectURI            string    `gorm:"size:500;not null" json:"redirect_uri"`
	ClientSecretConfigured bool      `gorm:"-" json:"client_secret_configured"`
	CreatedAt              time.Time `json:"created_at"`
	UpdatedAt              time.Time `json:"updated_at"`
}

type MarketplaceOAuthSession struct {
	StateHash             string     `gorm:"primaryKey;size:64" json:"-"`
	TenantID              uint       `gorm:"not null;index" json:"-"`
	Provider              string     `gorm:"size:50;not null;index" json:"-"`
	EncryptedCodeVerifier string     `gorm:"type:text;not null" json:"-"`
	ExpiresAt             time.Time  `gorm:"not null;index" json:"-"`
	UsedAt                *time.Time `gorm:"index" json:"-"`
	CreatedAt             time.Time  `json:"-"`
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
	SyncCatalog  *bool  `json:"sync_catalog"`
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
	VideoURL       string                   `json:"video_url"`
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

type MarketplaceProductImportResult struct {
	Action  string                    `json:"action"`
	Product Product                   `json:"product"`
	Mapping MarketplaceProductMapping `json:"mapping"`
}
