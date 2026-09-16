package models

import "time"

type Coupon struct {
	ID                uint      `gorm:"primaryKey" json:"id"`
	TenantID          uint      `gorm:"index;not null" json:"tenant_id"`
	Code              string    `gorm:"size:50;not null;index" json:"code"` // NOMEDAPROMOÇÃO em maiúsculas
	DiscountPercent   float64   `gorm:"not null" json:"discount_percent"`   // Ex: 10 para 10%
	AppliesToShipping bool      `gorm:"default:false" json:"applies_to_shipping"`
	IsActive          bool      `gorm:"default:true" json:"is_active"`
	UsageLimit        int       `gorm:"default:0" json:"usage_limit"` // 0 = ilimitado
	UsageCount        int       `gorm:"default:0" json:"usage_count"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

type CouponInput struct {
	Code              string  `json:"code" binding:"required"`
	DiscountPercent   float64 `json:"discount_percent" binding:"required,gt=0,lte=100"`
	AppliesToShipping bool    `json:"applies_to_shipping"`
	IsActive          *bool   `json:"is_active"`
	UsageLimit        int     `json:"usage_limit"`
}

type ValidateCouponInput struct {
	Code     string  `json:"code" binding:"required"`
	Subtotal float64 `json:"subtotal"`
	Shipping float64 `json:"shipping"`
}

type ValidateCouponResponse struct {
	Valid             bool    `json:"valid"`
	Code              string  `json:"code"`
	DiscountPercent   float64 `json:"discount_percent"`
	AppliesToShipping bool    `json:"applies_to_shipping"`
	DiscountAmount    float64 `json:"discount_amount"`
	ShippingDiscount  float64 `json:"shipping_discount"`
	TotalDiscount     float64 `json:"total_discount"`
	Message           string  `json:"message,omitempty"`
}
