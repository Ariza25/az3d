package main

import (
	"fmt"
	"log"
	"time"

	"az3d-backend/config"
	"az3d-backend/database"
	"az3d-backend/handlers"
	"az3d-backend/middleware"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	cfg := config.LoadConfig()

	database.InitDB(cfg)

	if cfg.Env == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.Default()
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

	authHandler := handlers.NewAuthHandler(cfg)
	productHandler := handlers.NewProductHandler(cfg)
	orderHandler := handlers.NewOrderHandler()
	tenantHandler := handlers.NewTenantHandler()
	tenantSettingsHandler := handlers.NewTenantSettingsHandler()
	pricingHandler := handlers.NewPricingHandler()
	marketplaceHandler := handlers.NewMarketplaceHandler()

	r.Static("/uploads", "./uploads")

	api := r.Group("/api")
	{
		api.GET("/tenants", tenantHandler.GetTenants)
		api.GET("/tenants/:identifier", tenantHandler.GetTenantByIdentifier)

		auth := api.Group("/auth")
		{
			auth.POST("/customer/register", authHandler.CustomerRegister)
			auth.POST("/customer/login", authHandler.CustomerLogin)
			auth.POST("/seller/register", authHandler.SellerRegister)
			auth.POST("/admin/login", authHandler.AdminLogin)
			auth.POST("/register", authHandler.Register)
			auth.POST("/login", authHandler.Login)
		}

		api.GET("/categories", productHandler.GetCategories)
		api.GET("/products", productHandler.GetProducts)
		api.GET("/products/:id", productHandler.GetProductByID)
		api.GET("/products/:id/reviews", productHandler.GetProductReviews)
		api.GET("/tenant/settings", tenantSettingsHandler.GetTenantSettings)

		protected := api.Group("")
		protected.Use(middleware.AuthMiddleware(cfg.JWTSecret))
		{
			protected.GET("/auth/me", authHandler.Me)
			protected.POST("/orders", orderHandler.CreateOrder)
			protected.GET("/orders/my-orders", orderHandler.GetMyOrders)
			protected.GET("/favorites", productHandler.GetMyFavorites)
			protected.POST("/products/:id/reviews", productHandler.UpsertProductReview)
			protected.POST("/products/:id/favorite", productHandler.AddProductFavorite)
			protected.DELETE("/products/:id/favorite", productHandler.RemoveProductFavorite)
		}

		admin := api.Group("/admin")
		admin.Use(middleware.AuthMiddleware(cfg.JWTSecret), middleware.AdminMiddleware())
		{
			admin.GET("/products", productHandler.GetAdminProducts)
			admin.POST("/products", productHandler.CreateProduct)
			admin.PUT("/products/:id", productHandler.UpdateProduct)
			admin.DELETE("/products/:id", productHandler.DeleteProduct)
			admin.GET("/stock-movements", productHandler.GetStockMovements)
			admin.POST("/stock-adjustments", productHandler.AdjustStock)
			admin.POST("/uploads/products", productHandler.UploadProductImage)
			admin.POST("/categories", productHandler.CreateCategory)
			admin.GET("/tenant/settings", tenantSettingsHandler.GetTenantSettings)
			admin.PATCH("/tenant/settings", tenantSettingsHandler.UpdateTenantSettings)
			admin.GET("/pricing/settings", pricingHandler.GetPricingSettings)
			admin.POST("/pricing/calculate", pricingHandler.Calculate)
			admin.POST("/pricing/scenario", pricingHandler.CalculateScenario)
			admin.GET("/pricing/financial-summary", pricingHandler.GetFinancialSummary)
			admin.GET("/pricing/fixed-costs", pricingHandler.GetFixedCosts)
			admin.POST("/pricing/fixed-costs", pricingHandler.SaveFixedCost)
			admin.PUT("/pricing/fixed-costs/:cost_id", pricingHandler.UpdateFixedCost)
			admin.DELETE("/pricing/fixed-costs/:cost_id", pricingHandler.DeleteFixedCost)
			admin.GET("/pricing/actual-costs", pricingHandler.GetActualCosts)
			admin.POST("/pricing/actual-costs", pricingHandler.SaveActualCost)
			admin.POST("/pricing/material-presets", pricingHandler.SaveMaterialPreset)
			admin.PUT("/pricing/material-presets/:preset_id", pricingHandler.UpdateMaterialPreset)
			admin.DELETE("/pricing/material-presets/:preset_id", pricingHandler.DeleteMaterialPreset)
			admin.POST("/pricing/printer-presets", pricingHandler.SavePrinterPreset)
			admin.PUT("/pricing/printer-presets/:preset_id", pricingHandler.UpdatePrinterPreset)
			admin.DELETE("/pricing/printer-presets/:preset_id", pricingHandler.DeletePrinterPreset)
			admin.POST("/pricing/platform-presets", pricingHandler.SavePlatformPreset)
			admin.PUT("/pricing/platform-presets/:preset_id", pricingHandler.UpdatePlatformPreset)
			admin.DELETE("/pricing/platform-presets/:preset_id", pricingHandler.DeletePlatformPreset)
			admin.POST("/products/:id/pricing/apply", pricingHandler.ApplyToProduct)
			admin.GET("/products/:id/pricing/snapshots", pricingHandler.GetProductSnapshots)
			admin.GET("/products/:id/financials", pricingHandler.GetProductFinancials)
			admin.GET("/orders", orderHandler.GetAllOrders)
			admin.PATCH("/orders/:id/status", orderHandler.UpdateOrderStatus)

			admin.GET("/marketplaces", marketplaceHandler.GetMarketplaceIntegrations)
			admin.POST("/marketplaces", marketplaceHandler.SaveMarketplaceIntegration)
			admin.PATCH("/marketplaces/:id/toggle", marketplaceHandler.ToggleMarketplaceStatus)
			admin.GET("/marketplaces/settings", marketplaceHandler.GetMarketplaceSettings)
			admin.PATCH("/marketplaces/settings", marketplaceHandler.UpdateMarketplaceSettings)
			admin.GET("/marketplaces/accounts", marketplaceHandler.GetMarketplaceAccounts)
			admin.POST("/marketplaces/accounts", marketplaceHandler.SaveMarketplaceAccount)
			admin.POST("/marketplaces/oauth/start", marketplaceHandler.StartMarketplaceOAuth)
			admin.POST("/marketplaces/oauth/callback", marketplaceHandler.CompleteMarketplaceOAuth)
			admin.POST("/marketplaces/refresh-tokens", marketplaceHandler.RefreshMarketplaceTokens)
			admin.POST("/marketplaces/test", marketplaceHandler.TestMarketplaceConnection)
			admin.GET("/marketplaces/mappings", marketplaceHandler.GetProductMappings)
			admin.POST("/marketplaces/mappings", marketplaceHandler.SaveProductMapping)
			admin.POST("/marketplaces/import-products", marketplaceHandler.ImportMarketplaceProducts)
			admin.POST("/marketplaces/sync-product", marketplaceHandler.SyncProductToMarketplace)
			admin.POST("/marketplaces/sync-products", marketplaceHandler.SyncMarketplaceProducts)
			admin.POST("/marketplaces/sync-orders", marketplaceHandler.SyncMarketplaceOrders)
			admin.GET("/marketplaces/external-orders", marketplaceHandler.GetExternalOrders)
			admin.GET("/marketplaces/webhook-events", marketplaceHandler.GetMarketplaceWebhookEvents)
			admin.POST("/marketplaces/simulate-order", marketplaceHandler.SimulateMarketplaceOrder)
		}

		api.POST("/webhooks/marketplaces/:provider", marketplaceHandler.ReceiveMarketplaceWebhook)
		api.POST("/webhooks/payments/mercadopago", orderHandler.ReceiveMercadoPagoWebhook)
	}

	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":  "online",
			"service": "AZ3D Printing API Engine",
			"version": "1.0.0",
		})
	})

	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("Servidor Go AZ3D escutando na porta %s (http://localhost:%s)", cfg.Port, cfg.Port)
	if err := r.Run(addr); err != nil {
		log.Fatalf("Erro ao iniciar servidor HTTP Go: %v", err)
	}
}
