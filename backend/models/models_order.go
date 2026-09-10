package models

import (
	"time"
)

type TenantCarrierAccount struct {
	ID                   uint       `gorm:"primaryKey" json:"id"`
	TenantID             uint       `gorm:"not null;index;uniqueIndex:idx_carrier_account_tenant_provider" json:"tenant_id"`
	Tenant               *Tenant    `gorm:"foreignKey:TenantID" json:"tenant,omitempty"`
	Provider             string     `gorm:"size:50;not null;uniqueIndex:idx_carrier_account_tenant_provider" json:"provider"`
	AccountName          string     `gorm:"size:120" json:"account_name"`
	AuthType             string     `gorm:"size:40;default:'contract_credentials'" json:"auth_type"`
	OriginCEP            string     `gorm:"size:10" json:"origin_cep"`
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

type Order struct {
	ID              uint            `gorm:"primaryKey" json:"id"`
	TenantID        uint            `gorm:"default:1;index" json:"tenant_id"`
	Tenant          *Tenant         `gorm:"foreignKey:TenantID" json:"tenant,omitempty"`
	UserID          uint            `gorm:"not null" json:"user_id"`
	User            *User           `gorm:"foreignKey:UserID" json:"user,omitempty"`
	TotalAmount     float64         `gorm:"not null" json:"total_amount"`
	Status          string          `gorm:"size:30;default:'pending_confirmation'" json:"status"`
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

type TenantCarrierAccountInput struct {
	Provider     string         `json:"provider" binding:"required"`
	AccountName  string         `json:"account_name"`
	AuthType     string         `json:"auth_type"`
	OriginCEP    string         `json:"origin_cep"`
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

type UpdateOrderStatusInput struct {
	Status string `json:"status" binding:"required"`
}

type ShippingQuoteInput struct {
	ZipCode   string `json:"zip_code" binding:"required"`
	TenantID  *uint  `json:"tenant_id,omitempty"`
	ProductID *uint  `json:"product_id,omitempty"`
}

type ShippingQuoteOption struct {
	Code         string  `json:"code"`
	Name         string  `json:"name"`
	Price        float64 `json:"price"`
	DeliveryDays int     `json:"delivery_days"`
}
