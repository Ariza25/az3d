package models

import "time"

type ChatConversation struct {
	ID                  uint          `gorm:"primaryKey" json:"id"`
	TenantID            uint          `gorm:"not null;index" json:"tenant_id"`
	Tenant              *Tenant       `gorm:"foreignKey:TenantID" json:"tenant,omitempty"`
	CustomerID          uint          `gorm:"not null;index" json:"customer_id"`
	Customer            *User         `gorm:"foreignKey:CustomerID" json:"customer,omitempty"`
	CustomerName        string        `gorm:"size:120" json:"customer_name"`
	CustomerEmail       string        `gorm:"size:120" json:"customer_email"`
	LastMessage         string        `gorm:"type:text" json:"last_message"`
	LastMessageAt       time.Time     `gorm:"index" json:"last_message_at"`
	UnreadTenantCount   int           `gorm:"default:0" json:"unread_tenant_count"`
	UnreadCustomerCount int           `gorm:"default:0" json:"unread_customer_count"`
	Messages            []ChatMessage `gorm:"foreignKey:ConversationID" json:"messages,omitempty"`
	CreatedAt           time.Time     `json:"created_at"`
	UpdatedAt           time.Time     `json:"updated_at"`
}

type ChatMessage struct {
	ID             uint      `gorm:"primaryKey" json:"id"`
	ConversationID uint      `gorm:"not null;index" json:"conversation_id"`
	TenantID       uint      `gorm:"not null;index" json:"tenant_id"`
	SenderID       uint      `gorm:"not null;index" json:"sender_id"`
	SenderType     string    `gorm:"size:20;not null" json:"sender_type"` // "customer" | "tenant"
	SenderName     string    `gorm:"size:120" json:"sender_name"`
	Message        string    `gorm:"type:text;not null" json:"message"`
	Read           bool      `gorm:"default:false;index" json:"read"`
	CreatedAt      time.Time `gorm:"index" json:"created_at"`
}

type SendChatMessageInput struct {
	Message string `json:"message" binding:"required"`
}

type ChatConversationResponse struct {
	Conversation ChatConversation `json:"conversation"`
	Messages     []ChatMessage    `json:"messages"`
}
