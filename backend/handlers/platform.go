package handlers

import (
	"database/sql"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"

	"az3d-backend/config"
	"az3d-backend/database"
	"az3d-backend/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type PlatformHandler struct {
	cfg *config.Config
}

func NewPlatformHandler(cfg *config.Config) *PlatformHandler {
	return &PlatformHandler{cfg: cfg}
}

type EnvironmentVariableStatus struct {
	Key         string `json:"key"`
	Category    string `json:"category"`
	Configured  bool   `json:"configured"`
	Required    bool   `json:"required"`
	Description string `json:"description"`
}

type PlatformEnvironment struct {
	Environment      string                      `json:"environment"`
	Service          string                      `json:"service"`
	Version          string                      `json:"version"`
	DatabaseRequired bool                        `json:"database_required"`
	MaxUploadMB      int64                       `json:"max_upload_mb"`
	TrackingInterval int                         `json:"tracking_sync_interval_minutes"`
	Variables        []EnvironmentVariableStatus `json:"variables"`
	CheckedAt        time.Time                   `json:"checked_at"`
}

type PlatformTenantOverview struct {
	TenantID               uint       `json:"tenant_id"`
	TenantName             string     `json:"tenant_name"`
	TenantSlug             string     `json:"tenant_slug"`
	ProductsCount          int64      `json:"products_count"`
	ActiveProductsCount    int64      `json:"active_products_count"`
	OrdersCount            int64      `json:"orders_count"`
	OpenOrdersCount        int64      `json:"open_orders_count"`
	LowStockCount          int64      `json:"low_stock_count"`
	MarketplaceAccounts    int64      `json:"marketplace_accounts"`
	ActiveMarketplaceCount int64      `json:"active_marketplace_count"`
	CarrierAccounts        int64      `json:"carrier_accounts"`
	ActiveCarrierCount     int64      `json:"active_carrier_count"`
	ConnectedCarrierCount  int64      `json:"connected_carrier_count"`
	ExternalOrdersCount    int64      `json:"external_orders_count"`
	MarketplaceErrorsCount int64      `json:"marketplace_errors_count"`
	CarrierErrorsCount     int64      `json:"carrier_errors_count"`
	MercadoLivreConnected  bool       `json:"mercadolivre_connected"`
	MercadoPagoConnected   bool       `json:"mercadopago_connected"`
	LastOrderAt            *time.Time `json:"last_order_at,omitempty"`
	LastMarketplaceSyncAt  *time.Time `json:"last_marketplace_sync_at,omitempty"`
	LastCarrierSyncAt      *time.Time `json:"last_carrier_sync_at,omitempty"`
}

type PlatformOverview struct {
	TenantsCount             int64                    `json:"tenants_count"`
	ProductsCount            int64                    `json:"products_count"`
	OrdersCount              int64                    `json:"orders_count"`
	OpenOrdersCount          int64                    `json:"open_orders_count"`
	LowStockCount            int64                    `json:"low_stock_count"`
	MarketplaceAccountsCount int64                    `json:"marketplace_accounts_count"`
	CarrierAccountsCount     int64                    `json:"carrier_accounts_count"`
	PaymentGatewayConfigured bool                     `json:"payment_gateway_configured"`
	WebhookSecretConfigured  bool                     `json:"webhook_secret_configured"`
	GeneratedAt              time.Time                `json:"generated_at"`
	Tenants                  []PlatformTenantOverview `json:"tenants"`
}

type WebhookLogItem struct {
	ID          uint       `json:"id"`
	TenantID    uint       `json:"tenant_id"`
	Provider    string     `json:"provider"`
	Source      string     `json:"source"`
	EventType   string     `json:"event_type"`
	ExternalID  string     `json:"external_id"`
	Status      string     `json:"status"`
	Error       string     `json:"error,omitempty"`
	ReceivedAt  time.Time  `json:"received_at"`
	ProcessedAt *time.Time `json:"processed_at,omitempty"`
}

func (h *PlatformHandler) GetPlatformOverview(c *gin.Context) {
	if !isMasterAdmin(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Apenas master_admin pode acessar a visao de plataforma"})
		return
	}

	var tenants []models.Tenant
	if err := database.DB.Order("name asc").Find(&tenants).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao carregar tenants"})
		return
	}

	var connectedPaymentAccounts int64
	database.DB.Model(&models.TenantPaymentAccount{}).Where("provider = ? AND status = ?", mercadoPagoProvider, mercadoPagoConnectedState).Count(&connectedPaymentAccounts)
	overview := PlatformOverview{
		TenantsCount:             int64(len(tenants)),
		PaymentGatewayConfigured: connectedPaymentAccounts > 0,
		WebhookSecretConfigured:  h.cfg != nil && strings.TrimSpace(h.cfg.MercadoPagoWebhookSecret) != "",
		GeneratedAt:              time.Now(),
		Tenants:                  make([]PlatformTenantOverview, 0, len(tenants)),
	}

	openStatuses := []string{"pending_confirmation", "pending_payment", "paid", "preparing", "printing", "pending"}
	for _, tenant := range tenants {
		row := PlatformTenantOverview{TenantID: tenant.ID, TenantName: tenant.Name, TenantSlug: tenant.Slug}
		database.DB.Model(&models.Product{}).Where("tenant_id = ?", tenant.ID).Count(&row.ProductsCount)
		database.DB.Model(&models.Product{}).Where("tenant_id = ? AND status = ?", tenant.ID, "active").Count(&row.ActiveProductsCount)
		database.DB.Model(&models.Order{}).Where("tenant_id = ?", tenant.ID).Count(&row.OrdersCount)
		database.DB.Model(&models.Order{}).Where("tenant_id = ? AND status IN ?", tenant.ID, openStatuses).Count(&row.OpenOrdersCount)
		database.DB.Model(&models.Product{}).Where("tenant_id = ? AND stock_qty <= ?", tenant.ID, 3).Count(&row.LowStockCount)
		var lowColorStock int64
		database.DB.Model(&models.ProductColorStock{}).Where("tenant_id = ? AND stock_qty <= ?", tenant.ID, 3).Count(&lowColorStock)
		row.LowStockCount += lowColorStock
		database.DB.Model(&models.MarketplaceAccount{}).Where("tenant_id = ?", tenant.ID).Count(&row.MarketplaceAccounts)
		database.DB.Model(&models.MarketplaceAccount{}).Where("tenant_id = ? AND is_active = ?", tenant.ID, true).Count(&row.ActiveMarketplaceCount)
		var mercadoLivreCount int64
		database.DB.Model(&models.MarketplaceAccount{}).
			Where("tenant_id = ? AND provider = ? AND is_connected = ?", tenant.ID, mercadoLivreProvider, true).
			Count(&mercadoLivreCount)
		row.MercadoLivreConnected = mercadoLivreCount > 0
		var mercadoPagoCount int64
		database.DB.Model(&models.TenantPaymentAccount{}).
			Where("tenant_id = ? AND provider = ? AND status = ?", tenant.ID, mercadoPagoProvider, mercadoPagoConnectedState).
			Count(&mercadoPagoCount)
		row.MercadoPagoConnected = mercadoPagoCount > 0
		database.DB.Model(&models.TenantCarrierAccount{}).Where("tenant_id = ?", tenant.ID).Count(&row.CarrierAccounts)
		database.DB.Model(&models.TenantCarrierAccount{}).Where("tenant_id = ? AND is_active = ?", tenant.ID, true).Count(&row.ActiveCarrierCount)
		database.DB.Model(&models.TenantCarrierAccount{}).Where("tenant_id = ? AND is_connected = ?", tenant.ID, true).Count(&row.ConnectedCarrierCount)
		database.DB.Model(&models.ExternalMarketplaceOrder{}).Where("tenant_id = ?", tenant.ID).Count(&row.ExternalOrdersCount)
		database.DB.Model(&models.MarketplaceAccount{}).Where("tenant_id = ? AND last_error <> ''", tenant.ID).Count(&row.MarketplaceErrorsCount)
		database.DB.Model(&models.TenantCarrierAccount{}).Where("tenant_id = ? AND last_error <> ''", tenant.ID).Count(&row.CarrierErrorsCount)
		var lastOrderAt sql.NullTime
		var lastMarketplaceSyncAt sql.NullTime
		var lastCarrierSyncAt sql.NullTime
		database.DB.Model(&models.Order{}).Where("tenant_id = ?", tenant.ID).Select("MAX(created_at)").Scan(&lastOrderAt)
		database.DB.Model(&models.MarketplaceAccount{}).Where("tenant_id = ?", tenant.ID).Select("MAX(last_sync_at)").Scan(&lastMarketplaceSyncAt)
		database.DB.Model(&models.TenantCarrierAccount{}).Where("tenant_id = ?", tenant.ID).Select("MAX(last_sync_at)").Scan(&lastCarrierSyncAt)
		if lastOrderAt.Valid {
			row.LastOrderAt = &lastOrderAt.Time
		}
		if lastMarketplaceSyncAt.Valid {
			row.LastMarketplaceSyncAt = &lastMarketplaceSyncAt.Time
		}
		if lastCarrierSyncAt.Valid {
			row.LastCarrierSyncAt = &lastCarrierSyncAt.Time
		}

		overview.ProductsCount += row.ProductsCount
		overview.OrdersCount += row.OrdersCount
		overview.OpenOrdersCount += row.OpenOrdersCount
		overview.LowStockCount += row.LowStockCount
		overview.MarketplaceAccountsCount += row.MarketplaceAccounts
		overview.CarrierAccountsCount += row.CarrierAccounts
		overview.Tenants = append(overview.Tenants, row)
	}

	c.JSON(http.StatusOK, overview)
}

// DELETE /api/admin/platform/tenants/:tenant_id?confirm_slug=:slug
func (h *PlatformHandler) DeleteTenant(c *gin.Context) {
	if !isMasterAdmin(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Apenas master_admin pode excluir tenants"})
		return
	}

	tenantID64, err := strconv.ParseUint(strings.TrimSpace(c.Param("tenant_id")), 10, 64)
	if err != nil || tenantID64 == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tenant invalido"})
		return
	}
	tenantID := uint(tenantID64)

	var tenant models.Tenant
	if err := database.DB.First(&tenant, tenantID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Tenant nao encontrado"})
		return
	}
	if confirmSlug := strings.TrimSpace(c.Query("confirm_slug")); confirmSlug == "" || !strings.EqualFold(confirmSlug, tenant.Slug) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Confirme a exclusao informando confirm_slug com o slug exato do tenant"})
		return
	}

	var masterAdmins int64
	if err := database.DB.Model(&models.User{}).
		Where("tenant_id = ? AND role = ?", tenantID, "master_admin").
		Count(&masterAdmins).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao validar administradores do tenant"})
		return
	}
	if masterAdmins > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "Reassocie os usuarios master_admin a outro tenant antes da exclusao"})
		return
	}

	var tenantsCount int64
	if err := database.DB.Model(&models.Tenant{}).Count(&tenantsCount).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao validar quantidade de tenants"})
		return
	}
	if tenantsCount <= 1 {
		c.JSON(http.StatusConflict, gin.H{"error": "O ultimo tenant da plataforma nao pode ser excluido"})
		return
	}

	if err := database.DB.Transaction(func(tx *gorm.DB) error {
		return tx.Delete(&models.Tenant{}, tenantID).Error
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao excluir tenant e seus dados relacionados"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"deleted":     true,
		"tenant_id":   tenant.ID,
		"tenant_slug": tenant.Slug,
	})
}

func (h *PlatformHandler) GetWebhookLogs(c *gin.Context) {
	tenantID, allTenants := observabilityTenantScope(c)
	limit := parsePositiveInt(c.Query("limit"), 100)
	if limit > 300 {
		limit = 300
	}

	items := make([]WebhookLogItem, 0, limit)

	var paymentEvents []models.PaymentWebhookEvent
	paymentQuery := database.DB.Order("received_at desc").Limit(limit)
	if !allTenants {
		paymentQuery = paymentQuery.Where("tenant_id = ?", tenantID)
	}
	_ = paymentQuery.Find(&paymentEvents).Error
	for _, event := range paymentEvents {
		items = append(items, WebhookLogItem{
			ID: event.ID, TenantID: event.TenantID, Provider: event.Provider, Source: "payment",
			EventType: event.EventType, ExternalID: event.ExternalID, Status: event.Status,
			Error: event.ErrorMessage, ReceivedAt: event.ReceivedAt, ProcessedAt: event.ProcessedAt,
		})
	}

	var marketplaceEvents []models.MarketplaceWebhookEvent
	marketplaceQuery := database.DB.Order("received_at desc").Limit(limit)
	if !allTenants {
		marketplaceQuery = marketplaceQuery.Where("tenant_id = ?", tenantID)
	}
	_ = marketplaceQuery.Find(&marketplaceEvents).Error
	for _, event := range marketplaceEvents {
		items = append(items, WebhookLogItem{
			ID: event.ID, TenantID: event.TenantID, Provider: event.Provider, Source: "marketplace",
			EventType: event.EventType, ExternalID: event.ExternalID, Status: event.Status,
			Error: event.ErrorMessage, ReceivedAt: event.ReceivedAt, ProcessedAt: event.ProcessedAt,
		})
	}

	sort.Slice(items, func(i, j int) bool {
		return items[i].ReceivedAt.After(items[j].ReceivedAt)
	})
	if len(items) > limit {
		items = items[:limit]
	}

	c.JSON(http.StatusOK, items)
}

func (h *PlatformHandler) GetObservabilityHealth(c *gin.Context) {
	tenantID, allTenants := observabilityTenantScope(c)
	dbStatus := "online"
	if sqlDB, err := database.DB.DB(); err != nil || sqlDB.Ping() != nil {
		dbStatus = "offline"
	}

	scope := database.DB
	if !allTenants {
		scope = scope.Where("tenant_id = ?", tenantID)
	}

	var failedPaymentWebhooks int64
	var failedMarketplaceWebhooks int64
	var marketplaceErrors int64
	var carrierErrors int64
	since := time.Now().Add(-24 * time.Hour)
	scope.Model(&models.PaymentWebhookEvent{}).Where("status = ? AND received_at >= ?", "failed", since).Count(&failedPaymentWebhooks)
	scope.Model(&models.MarketplaceWebhookEvent{}).Where("status = ? AND received_at >= ?", "failed", since).Count(&failedMarketplaceWebhooks)
	scope.Model(&models.MarketplaceAccount{}).Where("last_error <> ''").Count(&marketplaceErrors)
	scope.Model(&models.TenantCarrierAccount{}).Where("last_error <> ''").Count(&carrierErrors)

	status := "ok"
	if dbStatus != "online" || failedPaymentWebhooks > 0 || failedMarketplaceWebhooks > 0 || marketplaceErrors > 0 || carrierErrors > 0 {
		status = "attention"
	}

	var connectedPaymentAccounts int64
	database.DB.Model(&models.TenantPaymentAccount{}).Where("provider = ? AND status = ?", mercadoPagoProvider, mercadoPagoConnectedState).Count(&connectedPaymentAccounts)
	c.JSON(http.StatusOK, gin.H{
		"status":                          status,
		"database":                        dbStatus,
		"scope":                           map[string]any{"all_tenants": allTenants, "tenant_id": tenantID},
		"failed_payment_webhooks_24h":     failedPaymentWebhooks,
		"failed_marketplace_webhooks_24h": failedMarketplaceWebhooks,
		"marketplace_errors":              marketplaceErrors,
		"carrier_errors":                  carrierErrors,
		"mercado_pago_configured":         connectedPaymentAccounts > 0,
		"mercado_pago_webhook_secret":     h.cfg != nil && strings.TrimSpace(h.cfg.MercadoPagoWebhookSecret) != "",
		"correios_base_configured":        strings.TrimSpace(os.Getenv("CORREIOS_API_BASE_URL")) != "",
		"checked_at":                      time.Now(),
	})
}

func (h *PlatformHandler) GetPlatformEnvironment(c *gin.Context) {
	if !isMasterAdmin(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Apenas master_admin pode acessar o ambiente da plataforma"})
		return
	}

	cfg := h.cfg
	if cfg == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Configuracao da plataforma indisponivel"})
		return
	}

	jwtConfigured := strings.TrimSpace(cfg.JWTSecret) != "" && cfg.JWTSecret != "az3d_default_jwt_secret_key"
	variables := []EnvironmentVariableStatus{
		{Key: "DATABASE_URL", Category: "database", Configured: strings.TrimSpace(cfg.DatabaseURL) != "", Required: cfg.DatabaseRequired, Description: "Conexao principal com o banco de dados"},
		{Key: "JWT_SECRET", Category: "security", Configured: jwtConfigured, Required: true, Description: "Assinatura das sessoes administrativas"},
		{Key: "CREDENTIAL_ENCRYPTION_KEY", Category: "security", Configured: len(strings.TrimSpace(cfg.CredentialEncryptionKey)) >= 32, Required: true, Description: "Criptografia de credenciais de integracoes"},
		{Key: "CORS_ALLOWED_ORIGINS", Category: "network", Configured: len(cfg.CORSOrigins) > 0, Required: true, Description: "Origens autorizadas a consumir a API"},
		{Key: "FRONTEND_BASE_URL", Category: "network", Configured: strings.TrimSpace(cfg.FrontendBaseURL) != "", Required: true, Description: "URL publica usada nos retornos OAuth"},
		{Key: "GOOGLE_OAUTH", Category: "authentication", Configured: strings.TrimSpace(cfg.GoogleOAuthClientID) != "" && strings.TrimSpace(cfg.GoogleOAuthClientSecret) != "", Required: false, Description: "Login administrativo via Google"},
		{Key: "CORREIOS_API_BASE_URL", Category: "integrations", Configured: strings.TrimSpace(cfg.CorreiosAPIBaseURL) != "", Required: false, Description: "Endpoint base para rastreamento"},
		{Key: "MELI_OAUTH", Category: "integrations", Configured: strings.TrimSpace(cfg.MercadoLivreClientID) != "" && strings.TrimSpace(cfg.MercadoLivreClientSecret) != "" && strings.TrimSpace(cfg.MercadoLivreRedirectURI) != "", Required: false, Description: "Aplicacao OAuth global do Mercado Livre"},
		{Key: "MERCADO_PAGO_OAUTH", Category: "integrations", Configured: strings.TrimSpace(cfg.MercadoPagoClientID) != "" && strings.TrimSpace(cfg.MercadoPagoClientSecret) != "" && strings.TrimSpace(cfg.MercadoPagoRedirectURI) != "", Required: false, Description: "Aplicacao OAuth global do Mercado Pago"},
		{Key: "MERCADO_PAGO_WEBHOOK_SECRET", Category: "integrations", Configured: strings.TrimSpace(cfg.MercadoPagoWebhookSecret) != "", Required: false, Description: "Assinatura dos webhooks globais do Mercado Pago"},
		{Key: "ADM_LOGIN", Category: "bootstrap", Configured: strings.TrimSpace(cfg.AdminLogin) != "" && cfg.AdminPassword != "", Required: false, Description: "Conta master criada no bootstrap"},
	}

	c.JSON(http.StatusOK, PlatformEnvironment{
		Environment:      cfg.Env,
		Service:          "AZ3D API",
		Version:          "1.0.0",
		DatabaseRequired: cfg.DatabaseRequired,
		MaxUploadMB:      cfg.MaxUploadBytes / (1024 * 1024),
		TrackingInterval: cfg.TrackingSyncIntervalMin,
		Variables:        variables,
		CheckedAt:        time.Now(),
	})
}

func (h *PlatformHandler) PublicHealth(c *gin.Context) {
	dbStatus := "online"
	if database.DB == nil {
		dbStatus = "offline"
	} else if sqlDB, err := database.DB.DB(); err != nil || sqlDB.Ping() != nil {
		dbStatus = "offline"
	}
	status := "online"
	if dbStatus != "online" {
		status = "degraded"
	}
	c.JSON(http.StatusOK, gin.H{
		"status":   status,
		"service":  "AZ3D API",
		"version":  "1.0.0",
		"database": dbStatus,
		"time":     time.Now(),
	})
}

func observabilityTenantScope(c *gin.Context) (uint, bool) {
	if isMasterAdmin(c) {
		if raw := strings.TrimSpace(c.Query("tenant_id")); raw != "" {
			if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 {
				return uint(parsed), false
			}
		}
		return 0, true
	}
	return getTenantID(c), false
}

func isMasterAdmin(c *gin.Context) bool {
	role, exists := c.Get("userRole")
	return exists && role == "master_admin"
}

func parsePositiveInt(raw string, fallback int) int {
	parsed, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil || parsed <= 0 {
		return fallback
	}
	return parsed
}
