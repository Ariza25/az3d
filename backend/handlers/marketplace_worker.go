package handlers

import (
	"context"
	"log"
	"strconv"
	"strings"
	"time"

	"az3d-backend/config"
	"az3d-backend/database"
	"az3d-backend/internal/marketplaces"
	"az3d-backend/models"
)

// StartMarketplaceSyncJob consumes the durable database outbox and periodically
// reconciles connected accounts. Webhook handlers stay fast and never trust the
// notification body as the source of catalog/order data.
func StartMarketplaceSyncJob(cfg *config.Config, handler *MarketplaceHandler) {
	if cfg == nil || handler == nil || cfg.MarketplaceSyncIntervalMin <= 0 || database.DB == nil {
		return
	}
	interval := time.Duration(cfg.MarketplaceSyncIntervalMin) * time.Minute
	go func() {
		// Do not wait for the first periodic reconciliation after a deploy/cold
		// start. This also backfills catalog details added by newer importer
		// versions, such as the complete image gallery for each variation.
		startupCtx, startupCancel := context.WithTimeout(context.Background(), 4*time.Minute)
		accounts, products, failed := handler.ReconcileMarketplaceCatalogs(startupCtx)
		startupCancel()
		log.Printf("[marketplace-sync] startup catalog reconciliation accounts=%d products=%d failed=%d", accounts, products, failed)

		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		cycles := 0
		for range ticker.C {
			ctx, cancel := context.WithTimeout(context.Background(), 4*time.Minute)
			processed, failed := handler.ProcessMarketplaceQueue(ctx, 100)
			cycles++
			if cycles%15 == 0 {
				handler.ReconcileMarketplaceAccounts(ctx)
			}
			cancel()
			if processed > 0 || failed > 0 {
				log.Printf("[marketplace-sync] processed=%d failed=%d", processed, failed)
			}
		}
	}()
}

// ReconcileMarketplaceCatalogs refreshes every connected account configured to
// publish its marketplace catalog. It is intentionally independent from order
// reconciliation so it can safely run at startup to repair storefront data.
func (h *MarketplaceHandler) ReconcileMarketplaceCatalogs(ctx context.Context) (int, int, int) {
	var accounts []models.MarketplaceAccount
	if err := database.DB.Where("is_active = true AND is_connected = true AND sync_catalog = true").Find(&accounts).Error; err != nil {
		return 0, 0, 1
	}

	registry := marketplaceConnectorRegistry()
	syncedAccounts, syncedProducts, failed := 0, 0, 0
	for i := range accounts {
		if err := ctx.Err(); err != nil {
			failed += len(accounts) - i
			break
		}
		connector, ok := registry.Get(accounts[i].Provider)
		if !ok {
			failed++
			continue
		}
		if err := h.ensureFreshMarketplaceToken(ctx, &accounts[i]); err != nil {
			failed++
			continue
		}
		outcome := h.syncMarketplaceCatalogAccount(ctx, accounts[i].TenantID, &accounts[i], connector)
		if strings.HasSuffix(outcome.Status, "error") {
			log.Printf("[marketplace-sync] catalog reconciliation provider=%s account_id=%d status=%s message=%s", accounts[i].Provider, accounts[i].ID, outcome.Status, outcome.Message)
			failed++
			continue
		}
		if outcome.Status != "catalog_synced" {
			log.Printf("[marketplace-sync] catalog reconciliation provider=%s account_id=%d status=%s message=%s", accounts[i].Provider, accounts[i].ID, outcome.Status, outcome.Message)
		}
		syncedAccounts++
		syncedProducts += outcome.Created + outcome.Updated
	}
	return syncedAccounts, syncedProducts, failed
}

func (h *MarketplaceHandler) ProcessMarketplaceQueue(ctx context.Context, limit int) (int, int) {
	if limit <= 0 {
		limit = 100
	}
	now := time.Now()
	var events []models.MarketplaceWebhookEvent
	if err := database.DB.Where("tenant_id > 0 AND status IN ? AND (next_attempt_at IS NULL OR next_attempt_at <= ?)", []string{"pending", "failed"}, now).Order("received_at asc").Limit(limit).Find(&events).Error; err != nil {
		return 0, 1
	}
	processed, failed := 0, 0
	seen := map[string]struct{}{}
	for _, event := range events {
		key := strconv.FormatUint(uint64(event.TenantID), 10) + ":" + event.Provider + ":" + event.EventType
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		var account models.MarketplaceAccount
		if err := database.DB.Where("tenant_id = ? AND provider = ? AND is_active = true AND is_connected = true", event.TenantID, event.Provider).First(&account).Error; err != nil {
			markMarketplaceEventRetry(event, "Conta conectada não encontrada")
			failed++
			continue
		}
		connector, ok := marketplaceConnectorRegistry().Get(account.Provider)
		if !ok {
			markMarketplaceEventRetry(event, "Conector não encontrado")
			failed++
			continue
		}
		if err := h.ensureFreshMarketplaceToken(ctx, &account); err != nil {
			markMarketplaceEventRetry(event, err.Error())
			failed++
			continue
		}
		topic := strings.ToLower(event.EventType)
		var err error
		if strings.Contains(topic, "order") && account.SyncOrders {
			err = h.syncMarketplaceOrdersAccount(ctx, &account, connector, 7)
		} else if account.SyncCatalog {
			outcome := h.syncMarketplaceCatalogAccount(ctx, account.TenantID, &account, connector)
			if strings.HasSuffix(outcome.Status, "error") {
				err = marketplaceWorkerError(outcome.Message)
			}
		}
		if err != nil {
			markMarketplaceEventRetry(event, err.Error())
			failed++
			continue
		}
		completed := time.Now()
		database.DB.Model(&models.MarketplaceWebhookEvent{}).Where("tenant_id = ? AND provider = ? AND event_type = ? AND status IN ?", event.TenantID, event.Provider, event.EventType, []string{"pending", "failed"}).Updates(map[string]any{"status": "processed", "processed_at": &completed, "error_message": "", "next_attempt_at": nil})
		processed++
	}
	return processed, failed
}

type marketplaceWorkerMessage string

func (e marketplaceWorkerMessage) Error() string { return string(e) }
func marketplaceWorkerError(message string) error {
	if strings.TrimSpace(message) == "" {
		message = "Falha na sincronização"
	}
	return marketplaceWorkerMessage(message)
}

func markMarketplaceEventRetry(event models.MarketplaceWebhookEvent, message string) {
	retries := event.RetryCount + 1
	delay := time.Duration(1<<minInt(retries, 6)) * time.Minute
	next := time.Now().Add(delay)
	database.DB.Model(&models.MarketplaceWebhookEvent{}).Where("id = ?", event.ID).Updates(map[string]any{"status": "failed", "retry_count": retries, "next_attempt_at": &next, "error_message": strings.TrimSpace(message)})
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func (h *MarketplaceHandler) syncMarketplaceOrdersAccount(ctx context.Context, account *models.MarketplaceAccount, connector marketplaces.Connector, days int) error {
	settings, err := getOrCreateTenantMarketplaceSettings(account.TenantID)
	if err != nil {
		return err
	}
	result, err := connector.FetchOrders(ctx, marketplaceAccountFromModel(*account), marketplaces.OrderSyncInput{Days: days})
	if err != nil {
		return err
	}
	for _, order := range result.Orders {
		if _, err := importMarketplaceOrder(account.TenantID, account.Provider, order, settings); err != nil {
			return err
		}
	}
	now := time.Now()
	account.SyncStatus = "orders_synced"
	account.LastSyncAt = &now
	account.LastError = ""
	return database.DB.Save(account).Error
}

func (h *MarketplaceHandler) ReconcileMarketplaceAccounts(ctx context.Context) {
	var accounts []models.MarketplaceAccount
	if err := database.DB.Where("is_active = true AND is_connected = true").Find(&accounts).Error; err != nil {
		return
	}
	registry := marketplaceConnectorRegistry()
	for i := range accounts {
		connector, ok := registry.Get(accounts[i].Provider)
		if !ok {
			continue
		}
		if err := h.ensureFreshMarketplaceToken(ctx, &accounts[i]); err != nil {
			continue
		}
		if accounts[i].SyncCatalog {
			h.syncMarketplaceCatalogAccount(ctx, accounts[i].TenantID, &accounts[i], connector)
		}
		if accounts[i].SyncOrders {
			_ = h.syncMarketplaceOrdersAccount(ctx, &accounts[i], connector, 7)
		}
	}
}
