package models

import (
	"time"
)

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
	Scope                 string     `gorm:"type:text" json:"scope,omitempty"`
	LiveMode              bool       `json:"live_mode"`
	Status                string     `gorm:"size:30;not null;default:'disconnected';index" json:"status"`
	LastError             string     `gorm:"type:text" json:"last_error,omitempty"`
	ConnectedAt           *time.Time `json:"connected_at,omitempty"`
	CreatedAt             time.Time  `json:"created_at"`
	UpdatedAt             time.Time  `json:"updated_at"`
}

type PaymentOAuthSession struct {
	StateHash             string     `gorm:"primaryKey;size:64" json:"-"`
	TenantID              uint       `gorm:"not null;index" json:"-"`
	EncryptedCodeVerifier string     `gorm:"type:text;not null" json:"-"`
	ExpiresAt             time.Time  `gorm:"not null;index" json:"-"`
	UsedAt                *time.Time `gorm:"index" json:"-"`
	CreatedAt             time.Time  `json:"-"`
}
