package app

import (
	"log"
	"time"

	"az3d-backend/config"
	"az3d-backend/middleware"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

// BuildRouter configures the Gin engine, global middlewares, and registers all API route groups.
func BuildRouter(cfg *config.Config, h *Handlers) *gin.Engine {
	if cfg.Env == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()
	r.Use(gin.Recovery(), middleware.StructuredLogger())
	r.MaxMultipartMemory = cfg.MaxUploadBytes

	if err := r.SetTrustedProxies(cfg.TrustedProxies); err != nil {
		log.Printf("Aviso: nao foi possivel configurar trusted proxies: %v", err)
	}

	r.Use(cors.New(cors.Config{
		AllowOrigins:     cfg.CORSOrigins,
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization", "X-Tenant-ID"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	r.OPTIONS("/*path", func(c *gin.Context) {
		c.Status(204)
	})

	r.Static("/uploads", "./uploads")
	r.GET("/health", h.Platform.PublicHealth)

	api := r.Group("/api")
	api.Use(middleware.RateLimiterMiddleware(180, 40))
	{
		registerPublicRoutes(api, h)
		registerAuthRoutes(api, h)
		registerCustomerRoutes(api, h, cfg)
		registerAdminRoutes(api, h, cfg)
		registerPlatformRoutes(api, h, cfg)
		registerWebhookRoutes(api, h)
	}

	return r
}

func registerPublicRoutes(api *gin.RouterGroup, h *Handlers) {
	api.GET("/tenants", h.Tenant.GetTenants)
	api.GET("/tenants/:identifier", h.Tenant.GetTenantByIdentifier)
	api.GET("/categories", h.Product.GetCategories)
	api.GET("/products", h.Product.GetProducts)
	api.GET("/products/:id", h.Product.GetProductByID)
	api.GET("/products/:id/reviews", h.Product.GetProductReviews)
	api.GET("/tenant/settings", h.TenantSettings.GetTenantSettings)
	api.POST("/coupons/validate", h.Coupon.ValidateCoupon)
	api.POST("/shipping/calculate-quote", h.Quote.CalculateShippingQuote)
	api.POST("/quotes/custom-3d", h.Quote.CreateCustom3DQuote)
	api.POST("/quotes/parse-stl", h.Quote.ParseSTLFile)
	api.GET("/payments/mercadopago/oauth/callback", h.MercadoPago.OAuthCallback)
	api.GET("/marketplaces/mercadolivre/oauth/callback", h.Marketplace.MercadoLivreOAuthCallback)
	api.GET("/orders/:id/payment-status", h.Order.GetOrderPaymentStatus)
}

func registerAuthRoutes(api *gin.RouterGroup, h *Handlers) {
	auth := api.Group("/auth")
	auth.Use(middleware.RateLimiterMiddleware(25, 10))
	{
		auth.POST("/customer/register", h.Auth.CustomerRegister)
		auth.POST("/customer/login", h.Auth.CustomerLogin)
		auth.POST("/seller/register", h.Auth.SellerRegister)
		auth.POST("/admin/login", h.Auth.AdminLogin)
		auth.POST("/register", h.Auth.Register)
		auth.POST("/login", h.Auth.Login)
		auth.POST("/forgot-password", h.Auth.ForgotPassword)
		auth.GET("/verify-reset-token", h.Auth.VerifyResetToken)
		auth.POST("/reset-password", h.Auth.ResetPassword)
		auth.GET("/google/start", h.Auth.StartGoogleOAuth)
		auth.GET("/google/callback", h.Auth.CompleteGoogleOAuth)
	}
}

func registerCustomerRoutes(api *gin.RouterGroup, h *Handlers, cfg *config.Config) {
	protected := api.Group("")
	protected.Use(middleware.AuthMiddleware(cfg.JWTSecret))
	{
		protected.GET("/auth/me", h.Auth.Me)
		protected.PUT("/auth/me", h.Auth.UpdateMe)
		protected.POST("/orders", h.Order.CreateOrder)
		protected.GET("/orders/my-orders", h.Order.GetMyOrders)
		protected.GET("/favorites", h.Product.GetMyFavorites)
		protected.GET("/products/:id/review-eligibility", h.Product.GetReviewEligibility)
		protected.POST("/products/:id/reviews", h.Product.UpsertProductReview)
		protected.POST("/products/:id/favorite", h.Product.AddProductFavorite)
		protected.DELETE("/products/:id/favorite", h.Product.RemoveProductFavorite)
		protected.GET("/chat/tenant/:tenant_id/conversation", h.Chat.GetCustomerConversation)
		protected.POST("/chat/tenant/:tenant_id/messages", h.Chat.SendCustomerMessage)
	}
}

func registerAdminRoutes(api *gin.RouterGroup, h *Handlers, cfg *config.Config) {
	admin := api.Group("/admin")
	admin.Use(middleware.AuthMiddleware(cfg.JWTSecret), middleware.TenantAdminMiddleware())
	{
		admin.GET("/products", h.Product.GetAdminProducts)
		admin.POST("/products", h.Product.CreateProduct)
		admin.PUT("/products/:id", h.Product.UpdateProduct)
		admin.DELETE("/products/:id", h.Product.DeleteProduct)
		admin.GET("/stock-alerts", h.Product.GetStockAlerts)
		admin.GET("/stock-movements", h.Product.GetStockMovements)
		admin.POST("/stock-adjustments", h.Product.AdjustStock)
		admin.POST("/uploads/products", h.Product.UploadProductImage)
		admin.POST("/categories", h.Product.CreateCategory)
		admin.GET("/tenant/settings", h.TenantSettings.GetTenantSettings)
		admin.PATCH("/tenant/settings", h.TenantSettings.UpdateTenantSettings)
		admin.GET("/pricing/settings", h.Pricing.GetPricingSettings)
		admin.POST("/pricing/calculate", h.Pricing.Calculate)
		admin.POST("/pricing/scenario", h.Pricing.CalculateScenario)
		admin.GET("/pricing/financial-summary", h.Pricing.GetFinancialSummary)
		admin.GET("/pricing/fixed-costs", h.Pricing.GetFixedCosts)
		admin.POST("/pricing/fixed-costs", h.Pricing.SaveFixedCost)
		admin.PUT("/pricing/fixed-costs/:cost_id", h.Pricing.UpdateFixedCost)
		admin.DELETE("/pricing/fixed-costs/:cost_id", h.Pricing.DeleteFixedCost)
		admin.GET("/pricing/actual-costs", h.Pricing.GetActualCosts)
		admin.POST("/pricing/actual-costs", h.Pricing.SaveActualCost)
		admin.POST("/pricing/material-presets", h.Pricing.SaveMaterialPreset)
		admin.PUT("/pricing/material-presets/:preset_id", h.Pricing.UpdateMaterialPreset)
		admin.DELETE("/pricing/material-presets/:preset_id", h.Pricing.DeleteMaterialPreset)
		admin.POST("/pricing/printer-presets", h.Pricing.SavePrinterPreset)
		admin.PUT("/pricing/printer-presets/:preset_id", h.Pricing.UpdatePrinterPreset)
		admin.DELETE("/pricing/printer-presets/:preset_id", h.Pricing.DeletePrinterPreset)
		admin.POST("/pricing/platform-presets", h.Pricing.SavePlatformPreset)
		admin.PUT("/pricing/platform-presets/:preset_id", h.Pricing.UpdatePlatformPreset)
		admin.DELETE("/pricing/platform-presets/:preset_id", h.Pricing.DeletePlatformPreset)
		admin.POST("/pricing/parse-3mf", h.Pricing.Parse3MFFile)
		admin.POST("/products/:id/pricing/apply", h.Pricing.ApplyToProduct)
		admin.GET("/products/:id/pricing/snapshots", h.Pricing.GetProductSnapshots)
		admin.GET("/products/:id/financials", h.Pricing.GetProductFinancials)
		admin.GET("/orders", h.Order.GetAllOrders)
		admin.PATCH("/orders/:id/status", h.Order.UpdateOrderStatus)
		admin.GET("/payments/mercadopago/status", h.MercadoPago.GetTenantStatus)
		admin.POST("/payments/mercadopago/oauth/start", h.MercadoPago.StartOAuth)
		admin.POST("/payments/mercadopago/oauth/refresh", h.MercadoPago.RefreshOAuth)
		admin.DELETE("/payments/mercadopago/oauth", h.MercadoPago.DisconnectOAuth)

		admin.GET("/coupons", h.Coupon.GetTenantCoupons)
		admin.POST("/coupons", h.Coupon.CreateTenantCoupon)
		admin.PUT("/coupons/:id", h.Coupon.UpdateTenantCoupon)
		admin.DELETE("/coupons/:id", h.Coupon.DeleteTenantCoupon)

		admin.GET("/marketplaces/settings", h.Marketplace.GetMarketplaceSettings)
		admin.PATCH("/marketplaces/settings", h.Marketplace.UpdateMarketplaceSettings)
		admin.GET("/marketplaces/accounts", h.Marketplace.GetMarketplaceAccounts)
		admin.POST("/marketplaces/accounts", h.Marketplace.SaveMarketplaceAccount)
		admin.POST("/marketplaces/oauth/start", h.Marketplace.StartMarketplaceOAuth)
		admin.POST("/marketplaces/oauth/callback", h.Marketplace.CompleteMarketplaceOAuth)
		admin.POST("/marketplaces/disconnect", h.Marketplace.DisconnectMarketplaceAccount)
		admin.DELETE("/marketplaces/accounts", h.Marketplace.DisconnectMarketplaceAccount)
		admin.POST("/marketplaces/refresh-tokens", h.Marketplace.RefreshMarketplaceTokens)
		admin.POST("/marketplaces/test", h.Marketplace.TestMarketplaceConnection)
		admin.GET("/marketplaces/mappings", h.Marketplace.GetProductMappings)
		admin.POST("/marketplaces/sync-products", h.Marketplace.SyncMarketplaceProducts)
		admin.POST("/marketplaces/sync-orders", h.Marketplace.SyncMarketplaceOrders)
		admin.GET("/marketplaces/external-orders", h.Marketplace.GetExternalOrders)
		admin.GET("/marketplaces/webhook-events", h.Marketplace.GetMarketplaceWebhookEvents)
		admin.GET("/marketplaces/trends", h.Marketplace.GetMLTrends)
		admin.POST("/marketplaces/trends/refresh", h.Marketplace.RefreshMarketplaceTrends)
		admin.GET("/marketplaces/search-insights", h.Marketplace.GetMLSearchInsights)
		admin.GET("/marketplaces/listing-audit", h.Marketplace.AuditMLListing)
		admin.GET("/marketplaces/product-opportunities", h.Marketplace.GetMLProductOpportunities)

		admin.GET("/carrier-accounts", h.Carrier.GetCarrierAccounts)
		admin.POST("/carrier-accounts", h.Carrier.SaveCarrierAccount)
		admin.PATCH("/carrier-accounts/:id/toggle", h.Carrier.ToggleCarrierAccount)
		admin.GET("/carrier-health", h.Shipment.GetCarrierHealth)
		admin.GET("/shipments", h.Shipment.GetShipments)
		admin.POST("/shipments", h.Shipment.SaveShipment)
		admin.POST("/shipments/:id/sync", h.Shipment.SyncShipment)
		admin.POST("/shipments/sync", h.Shipment.SyncTracking)

		admin.GET("/filaments", h.Filament.GetFilamentSpools)
		admin.POST("/filaments", h.Filament.CreateFilamentSpool)
		admin.PUT("/filaments/:id", h.Filament.UpdateFilamentSpool)
		admin.DELETE("/filaments/:id", h.Filament.DeleteFilamentSpool)
		admin.GET("/filaments/:id/logs", h.Filament.GetFilamentSpoolLogs)
		admin.POST("/filaments/deduct", h.Filament.DeductFilament)
		admin.GET("/filaments/check-order/:orderId", h.Filament.CheckOrderFilament)
		admin.GET("/quotes/custom-3d", h.Quote.GetCustom3DQuotes)
		admin.GET("/chat/conversations", h.Chat.GetTenantConversations)
		admin.GET("/chat/conversations/:id/messages", h.Chat.GetTenantConversationMessages)
		admin.POST("/chat/conversations/:id/messages", h.Chat.SendTenantMessage)
		admin.GET("/chat/unread-count", h.Chat.GetTenantUnreadChatCount)
	}
}

func registerPlatformRoutes(api *gin.RouterGroup, h *Handlers, cfg *config.Config) {
	platform := api.Group("/admin/platform")
	platform.Use(middleware.AuthMiddleware(cfg.JWTSecret), middleware.MasterAdminMiddleware())
	{
		platform.GET("/overview", h.Platform.GetPlatformOverview)
		platform.DELETE("/tenants/:tenant_id", h.Platform.DeleteTenant)
		platform.GET("/environment", h.Platform.GetPlatformEnvironment)
		platform.GET("/observability", h.Platform.GetObservabilityHealth)
		platform.GET("/outbox", h.Platform.GetWebhookLogs)
		platform.GET("/payments/mercadopago", h.MercadoPago.GetPlatformConfig)
		platform.POST("/tenants/:tenant_id/payments/mercadopago/oauth/start", h.MercadoPago.StartOAuthForTenant)
		platform.GET("/marketplaces/mercadolivre", h.Marketplace.GetMercadoLivrePlatformConfig)
		platform.POST("/tenants/:tenant_id/marketplaces/mercadolivre/oauth/start", h.Marketplace.StartMercadoLivreOAuthForTenant)
	}
}

func registerWebhookRoutes(api *gin.RouterGroup, h *Handlers) {
	api.POST("/webhooks/marketplaces/:provider", h.Marketplace.ReceiveMarketplaceWebhook)
	api.POST("/webhooks/payments/mercadopago/:tenant_id", h.Order.ReceiveMercadoPagoWebhook)
}
