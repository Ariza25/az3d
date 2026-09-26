package app

import (
	"az3d-backend/config"
	"az3d-backend/handlers"
	"az3d-backend/internal/services"

	"gorm.io/gorm"
)

// Handlers encapsulates all HTTP controller handlers for the application.
type Handlers struct {
	Auth           *handlers.AuthHandler
	Product        *handlers.ProductHandler
	Order          *handlers.OrderHandler
	Tenant         *handlers.TenantHandler
	TenantSettings *handlers.TenantSettingsHandler
	Pricing        *handlers.PricingHandler
	Marketplace    *handlers.MarketplaceHandler
	Carrier        *handlers.CarrierHandler
	Shipment       *handlers.ShipmentHandler
	Platform       *handlers.PlatformHandler
	Chat           *handlers.ChatHandler
	Coupon         *handlers.CouponHandler
	Filament       *handlers.FilamentHandler
	Quote          *handlers.QuoteHandler
	MercadoPago    *handlers.MercadoPagoHandler
}

// NewHandlers creates and initializes all handlers with their required dependencies.
func NewHandlers(cfg *config.Config, db *gorm.DB) *Handlers {
	pricingService := services.NewPricingService(db)
	mercadoPagoHandler := handlers.NewMercadoPagoHandler(cfg)

	return &Handlers{
		Auth:           handlers.NewAuthHandler(cfg),
		Product:        handlers.NewProductHandler(cfg),
		Order:          handlers.NewOrderHandler(mercadoPagoHandler),
		Tenant:         handlers.NewTenantHandler(),
		TenantSettings: handlers.NewTenantSettingsHandler(),
		Pricing:        handlers.NewPricingHandler(db, pricingService),
		Marketplace:    handlers.NewMarketplaceHandler(cfg),
		Carrier:        handlers.NewCarrierHandler(cfg),
		Shipment:       handlers.NewShipmentHandler(cfg),
		Platform:       handlers.NewPlatformHandler(cfg),
		Chat:           handlers.NewChatHandler(),
		Coupon:         handlers.NewCouponHandler(),
		Filament:       handlers.NewFilamentHandler(),
		Quote:          handlers.NewQuoteHandler(cfg),
		MercadoPago:    mercadoPagoHandler,
	}
}
