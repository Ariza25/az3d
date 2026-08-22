package handlers

import (
	"database/sql"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"

	"az3d-backend/database"
	"az3d-backend/models"

	"github.com/gin-gonic/gin"
)

type PlatformHandler struct{}

func NewPlatformHandler() *PlatformHandler {
	return &PlatformHandler{}
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

	overview := PlatformOverview{
		TenantsCount:             int64(len(tenants)),
		PaymentGatewayConfigured: strings.TrimSpace(os.Getenv("MERCADO_PAGO_ACCESS_TOKEN")) != "",
		WebhookSecretConfigured:  strings.TrimSpace(os.Getenv("MERCADO_PAGO_WEBHOOK_SECRET")) != "",
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
			ReceivedAt: event.ReceivedAt, ProcessedAt: event.ProcessedAt,
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

	c.JSON(http.StatusOK, gin.H{
		"status":                          status,
		"database":                        dbStatus,
		"scope":                           map[string]any{"all_tenants": allTenants, "tenant_id": tenantID},
		"failed_payment_webhooks_24h":     failedPaymentWebhooks,
		"failed_marketplace_webhooks_24h": failedMarketplaceWebhooks,
		"marketplace_errors":              marketplaceErrors,
		"carrier_errors":                  carrierErrors,
		"mercado_pago_configured":         strings.TrimSpace(os.Getenv("MERCADO_PAGO_ACCESS_TOKEN")) != "",
		"mercado_pago_webhook_secret":     strings.TrimSpace(os.Getenv("MERCADO_PAGO_WEBHOOK_SECRET")) != "",
		"correios_base_configured":        strings.TrimSpace(os.Getenv("CORREIOS_API_BASE_URL")) != "",
		"checked_at":                      time.Now(),
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
