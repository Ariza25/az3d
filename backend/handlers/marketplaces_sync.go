package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"az3d-backend/config"
	"az3d-backend/database"
	"az3d-backend/internal/marketplaces"
	"az3d-backend/internal/marketplaces/mercadolivre"
	"az3d-backend/models"
	"az3d-backend/utils"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// POST /api/admin/marketplaces/sync-products
func (h *MarketplaceHandler) SyncMarketplaceProducts(c *gin.Context) {
	tenantID := getTenantID(c)

	var input models.MarketplaceCatalogSyncInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Dados invalidos"})
		return
	}
	provider := normalizeProvider(input.Provider)

	query := database.DB.Where("tenant_id = ? AND is_active = ? AND sync_catalog = ?", tenantID, true, true)
	if provider != "" {
		query = query.Where("provider = ?", provider)
	}

	var accounts []models.MarketplaceAccount
	if err := query.Find(&accounts).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao buscar contas para sincronizacao de catalogo"})
		return
	}

	registry := marketplaceConnectorRegistry()
	results := make([]gin.H, 0, len(accounts))
	totalCreated := 0
	totalUpdated := 0
	totalEventsProcessed := 0
	for i := range accounts {
		connector, ok := registry.Get(accounts[i].Provider)
		if !ok {
			now := time.Now()
			accounts[i].SyncStatus = "connector_missing"
			accounts[i].LastSyncAt = &now
			accounts[i].LastError = "Conector nao implementado para este marketplace."
			_ = database.DB.Save(&accounts[i]).Error
			results = append(results, gin.H{
				"provider": accounts[i].Provider,
				"status":   accounts[i].SyncStatus,
				"imported": 0,
				"updated":  0,
				"message":  accounts[i].LastError,
			})
			continue
		}
		if err := h.ensureFreshMarketplaceToken(c.Request.Context(), &accounts[i]); err != nil {
			results = append(results, gin.H{
				"provider": accounts[i].Provider,
				"status":   accounts[i].SyncStatus,
				"imported": 0,
				"updated":  0,
				"message":  accounts[i].LastError,
			})
			continue
		}
		if _, err := h.reconcileMarketplaceAccountIdentity(c.Request.Context(), &accounts[i], connector); err != nil {
			accounts[i].SyncStatus = "identity_sync_error"
			accounts[i].LastError = marketplaceConnectorErrorMessage(err)
			_ = database.DB.Save(&accounts[i]).Error
			results = append(results, gin.H{
				"provider": accounts[i].Provider,
				"status":   accounts[i].SyncStatus,
				"imported": 0,
				"updated":  0,
				"message":  accounts[i].LastError,
			})
			continue
		}

		outcome := h.syncMarketplaceCatalogAccount(c.Request.Context(), tenantID, &accounts[i], connector)
		totalCreated += outcome.Created
		totalUpdated += outcome.Updated
		totalEventsProcessed += outcome.EventsProcessed
		results = append(results, gin.H{
			"provider":         accounts[i].Provider,
			"status":           outcome.Status,
			"imported":         outcome.Created,
			"updated":          outcome.Updated,
			"events_processed": outcome.EventsProcessed,
			"message":          outcome.Message,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"results":          results,
		"imported":         totalCreated,
		"updated":          totalUpdated,
		"events_processed": totalEventsProcessed,
	})
}

type marketplaceCatalogSyncOutcome struct {
	Created         int
	Updated         int
	EventsProcessed int
	Status          string
	Message         string
}

func (h *MarketplaceHandler) syncMarketplaceCatalogAccount(ctx context.Context, tenantID uint, account *models.MarketplaceAccount, connector marketplaces.Connector) marketplaceCatalogSyncOutcome {
	outcome := marketplaceCatalogSyncOutcome{Status: "catalog_synced"}
	now := time.Now()
	catalog, catalogErr := connector.FetchCatalog(ctx, marketplaceAccountFromModel(*account))

	events, eventsErr := pendingMarketplaceItemEvents(tenantID, account.Provider)
	if eventsErr != nil {
		outcome.Status = "catalog_sync_error"
		outcome.Message = "Erro ao carregar eventos pendentes do marketplace: " + eventsErr.Error()
		account.SyncStatus = outcome.Status
		account.LastSyncAt = &now
		account.LastError = outcome.Message
		_ = database.DB.Save(account).Error
		return outcome
	}
	mappedIDs, mappingsErr := mappedMarketplaceItemIDs(tenantID, account.Provider)
	if mappingsErr != nil {
		outcome.Status = "catalog_sync_error"
		outcome.Message = "Erro ao carregar anuncios mapeados do marketplace: " + mappingsErr.Error()
		account.SyncStatus = outcome.Status
		account.LastSyncAt = &now
		account.LastError = outcome.Message
		_ = database.DB.Save(account).Error
		return outcome
	}

	items := uniqueMarketplaceCatalogItems(catalog.Items)
	knownItemIDs := marketplaceCatalogItemIDs(items)
	pendingIDs := pendingMarketplaceItemIDs(events)
	lookupIDs := make([]string, 0, len(pendingIDs)+len(mappedIDs))
	lookupIDs = append(lookupIDs, pendingIDs...)
	lookupIDs = append(lookupIDs, mappedIDs...)
	missingIDs := make([]string, 0, len(lookupIDs))
	missingSeen := make(map[string]struct{}, len(lookupIDs))
	for _, externalID := range lookupIDs {
		if _, found := knownItemIDs[externalID]; !found {
			if _, alreadyAdded := missingSeen[externalID]; !alreadyAdded {
				missingSeen[externalID] = struct{}{}
				missingIDs = append(missingIDs, externalID)
			}
		}
	}

	var eventFetchErr error
	directItemsFound := 0
	if len(missingIDs) > 0 {
		if fetcher, ok := connector.(marketplaces.CatalogItemFetcher); ok {
			var eventCatalog marketplaces.CatalogSyncResult
			eventCatalog, eventFetchErr = fetcher.FetchCatalogItems(ctx, marketplaceAccountFromModel(*account), missingIDs)
			if eventFetchErr == nil {
				directItemsFound = len(eventCatalog.Items)
				items = uniqueMarketplaceCatalogItems(append(items, eventCatalog.Items...))
				knownItemIDs = marketplaceCatalogItemIDs(items)
			}
		} else {
			eventFetchErr = errors.New("conector nao permite buscar anuncios recebidos por webhook")
		}
	}

	failures := make([]string, 0)
	for _, externalID := range pendingIDs {
		if _, found := knownItemIDs[externalID]; found {
			continue
		}
		reason := "Anuncio nao retornado pelo marketplace ou nao pertence ao vendedor conectado"
		if eventFetchErr != nil {
			reason = marketplaceConnectorErrorMessage(eventFetchErr)
		}
		_, _ = updateMarketplaceItemEventStatus(tenantID, account.Provider, externalID, "failed", reason)
		failures = append(failures, externalID+": "+reason)
	}

	defaultCategoryID := importedMarketplaceCategoryID(tenantID, account.Provider)
	for _, item := range items {
		importResult, err := importMarketplaceCatalogItem(
			tenantID,
			account.Provider,
			defaultCategoryID,
			true,
			catalogItemToModelInput(item),
		)
		if err != nil {
			reason := err.Error()
			_, _ = updateMarketplaceItemEventStatus(tenantID, account.Provider, item.ExternalItemID, "failed", reason)
			failures = append(failures, item.ExternalItemID+": "+reason)
			continue
		}
		if importResult.Action == "created" {
			outcome.Created++
		} else {
			outcome.Updated++
		}
		processed, _ := updateMarketplaceItemEventStatus(tenantID, account.Provider, item.ExternalItemID, "processed", "")
		outcome.EventsProcessed += int(processed)
	}

	messageParts := make([]string, 0, 4)
	if catalogErr == nil && strings.TrimSpace(catalog.Message) != "" {
		messageParts = append(messageParts, catalog.Message)
	} else if catalogErr != nil {
		messageParts = append(messageParts, "Busca geral do catalogo falhou: "+marketplaceConnectorErrorMessage(catalogErr))
	}
	if len(pendingIDs) > 0 {
		messageParts = append(messageParts, fmt.Sprintf("%d anuncio(s) unico(s) identificado(s) no Outbox", len(pendingIDs)))
	}
	if len(mappedIDs) > 0 {
		messageParts = append(messageParts, fmt.Sprintf("%d ID(s) conhecido(s) consultado(s); %d anuncio(s) retornado(s) pela busca direta", len(mappedIDs), directItemsFound))
	}
	if outcome.EventsProcessed > 0 {
		messageParts = append(messageParts, fmt.Sprintf("%d evento(s) do Outbox processado(s)", outcome.EventsProcessed))
	}
	if len(failures) > 0 {
		messageParts = append(messageParts, fmt.Sprintf("%d anuncio(s) com falha; consulte o Outbox", len(failures)))
	}
	if len(messageParts) == 0 {
		messageParts = append(messageParts, "Nenhum anuncio encontrado para sincronizacao")
	}
	outcome.Message = strings.Join(messageParts, "; ")

	switch {
	case catalogErr != nil && len(items) == 0:
		outcome.Status = "catalog_sync_error"
	case len(failures) > 0 || catalogErr != nil:
		outcome.Status = "catalog_sync_warning"
	default:
		outcome.Status = "catalog_synced"
	}
	account.SyncStatus = outcome.Status
	account.LastSyncAt = &now
	if outcome.Status == "catalog_synced" {
		account.LastError = ""
	} else {
		account.LastError = outcome.Message
	}
	_ = database.DB.Save(account).Error
	return outcome
}

func pendingMarketplaceItemEvents(tenantID uint, provider string) ([]models.MarketplaceWebhookEvent, error) {
	var events []models.MarketplaceWebhookEvent
	err := database.DB.
		Where("tenant_id = ? AND provider = ? AND event_type = ? AND status IN ? AND external_id <> '' AND (next_attempt_at IS NULL OR next_attempt_at <= ?)", tenantID, normalizeProvider(provider), "items", []string{"pending", "failed"}, time.Now()).
		Order("received_at asc").
		Limit(500).
		Find(&events).Error
	return events, err
}

func pendingMarketplaceItemIDs(events []models.MarketplaceWebhookEvent) []string {
	values := make([]string, 0, len(events))
	for _, event := range events {
		values = append(values, event.ExternalID)
	}
	result := make([]string, 0, len(values))
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if _, found := seen[value]; found {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	return result
}

func uniqueMarketplaceCatalogItems(items []marketplaces.CatalogItem) []marketplaces.CatalogItem {
	result := make([]marketplaces.CatalogItem, 0, len(items))
	indexes := make(map[string]int, len(items))
	for _, item := range items {
		externalID := strings.TrimSpace(item.ExternalItemID)
		if externalID == "" {
			continue
		}
		if index, found := indexes[externalID]; found {
			result[index] = item
			continue
		}
		indexes[externalID] = len(result)
		result = append(result, item)
	}
	return result
}

func marketplaceCatalogItemIDs(items []marketplaces.CatalogItem) map[string]struct{} {
	result := make(map[string]struct{}, len(items))
	for _, item := range items {
		if externalID := strings.TrimSpace(item.ExternalItemID); externalID != "" {
			result[externalID] = struct{}{}
		}
	}
	return result
}

func mappedMarketplaceItemIDs(tenantID uint, provider string) ([]string, error) {
	provider = normalizeProvider(provider)
	var mappedIDs []string
	err := database.DB.Model(&models.MarketplaceProductMapping{}).
		Where("tenant_id = ? AND provider = ? AND external_item_id <> ''", tenantID, provider).
		Order("id asc").
		Pluck("external_item_id", &mappedIDs).Error
	if err != nil {
		return nil, err
	}

	var productIDs []string
	err = database.DB.Model(&models.Product{}).
		Where("tenant_id = ? AND source_provider = ? AND source_external_id <> ''", tenantID, provider).
		Order("id asc").
		Pluck("source_external_id", &productIDs).Error
	if err != nil {
		return nil, err
	}

	result := make([]string, 0, len(mappedIDs)+len(productIDs))
	seen := make(map[string]struct{}, len(mappedIDs)+len(productIDs))
	for _, externalID := range append(mappedIDs, productIDs...) {
		externalID = strings.TrimSpace(externalID)
		if externalID == "" {
			continue
		}
		if _, exists := seen[externalID]; exists {
			continue
		}
		seen[externalID] = struct{}{}
		result = append(result, externalID)
	}
	return result, nil
}

func updateMarketplaceItemEventStatus(tenantID uint, provider string, externalID string, status string, errorMessage string) (int64, error) {
	processedAt := time.Now()
	updates := map[string]any{"status": status, "error_message": strings.TrimSpace(errorMessage), "processed_at": &processedAt, "next_attempt_at": nil}
	if status == "failed" {
		next := time.Now().Add(2 * time.Minute)
		updates["retry_count"] = gorm.Expr("retry_count + 1")
		updates["next_attempt_at"] = &next
		updates["processed_at"] = nil
	}
	result := database.DB.Model(&models.MarketplaceWebhookEvent{}).
		Where("tenant_id = ? AND provider = ? AND event_type = ? AND external_id = ? AND status IN ?", tenantID, normalizeProvider(provider), "items", strings.TrimSpace(externalID), []string{"pending", "failed"}).
		Updates(updates)
	return result.RowsAffected, result.Error
}

func catalogItemToModelInput(item marketplaces.CatalogItem) models.MarketplaceCatalogItemInput {
	return models.MarketplaceCatalogItemInput{
		ExternalItemID: item.ExternalItemID,
		ExternalSKU:    item.ExternalSKU,
		ExternalTitle:  item.ExternalTitle,
		ExternalURL:    item.ExternalURL,
		Title:          item.Title,
		Description:    item.Description,
		Price:          item.Price,
		ImageURL:       item.ImageURL,
		Material:       item.Material,
		LayerHeight:    item.LayerHeight,
		PrintTime:      item.PrintTime,
		Dimensions:     item.Dimensions,
		Weight:         item.Weight,
		StockQty:       item.StockQty,
		Status:         item.Status,
		ColorImages:    catalogColorImagesToModel(item.ColorImages),
		ColorStocks:    catalogColorStocksToModel(item.ColorStocks),
		Variants:       catalogVariantsToModel(item.Variants),
	}
}

func catalogColorImagesToModel(items []marketplaces.CatalogColorImage) []models.ProductColorImageInput {
	inputs := make([]models.ProductColorImageInput, 0, len(items))
	for _, item := range items {
		inputs = append(inputs, models.ProductColorImageInput{
			ColorName: item.ColorName,
			ImageURL:  item.ImageURL,
			SortOrder: item.SortOrder,
		})
	}
	return inputs
}

func catalogColorStocksToModel(items []marketplaces.CatalogColorStock) []models.ProductColorStockInput {
	inputs := make([]models.ProductColorStockInput, 0, len(items))
	for _, item := range items {
		inputs = append(inputs, models.ProductColorStockInput{
			ColorName: item.ColorName,
			StockQty:  item.StockQty,
		})
	}
	return inputs
}

func catalogVariantsToModel(items []marketplaces.CatalogVariant) []models.ProductVariantInput {
	inputs := make([]models.ProductVariantInput, 0, len(items))
	for _, item := range items {
		inputs = append(inputs, models.ProductVariantInput{
			ColorName:     item.ColorName,
			VariationName: defaultString(item.VariationName, item.ColorName),
			Attributes:    defaultString(item.Attributes, "[]"),
			Price:         item.Price,
			Material:      item.Material,
			LayerHeight:   item.LayerHeight,
			PrintTime:     item.PrintTime,
			Weight:        item.Weight,
			IsActive:      item.IsActive,
			SortOrder:     item.SortOrder,
		})
	}
	return inputs
}

// POST /api/admin/marketplaces/sync-orders
func (h *MarketplaceHandler) SyncMarketplaceOrders(c *gin.Context) {
	tenantID := getTenantID(c)

	var input models.MarketplaceSyncInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Dados invalidos"})
		return
	}
	provider := normalizeProvider(input.Provider)
	if input.Days <= 0 {
		input.Days = 7
	}

	query := database.DB.Where("tenant_id = ? AND is_active = ? AND sync_orders = ?", tenantID, true, true)
	if provider != "" {
		query = query.Where("provider = ?", provider)
	}

	var accounts []models.MarketplaceAccount
	if err := query.Find(&accounts).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao buscar contas para sincronizacao"})
		return
	}

	now := time.Now()
	settings, err := getOrCreateTenantMarketplaceSettings(tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao carregar configuracoes de marketplace"})
		return
	}
	registry := marketplaceConnectorRegistry()
	results := make([]gin.H, 0, len(accounts))
	totalImported := 0
	totalInternalOrders := 0
	for i := range accounts {
		connector, ok := registry.Get(accounts[i].Provider)
		if !ok {
			accounts[i].SyncStatus = "connector_missing"
			accounts[i].LastSyncAt = &now
			accounts[i].LastError = "Conector nao implementado para este marketplace."
			_ = database.DB.Save(&accounts[i]).Error
			results = append(results, gin.H{
				"provider":        accounts[i].Provider,
				"status":          accounts[i].SyncStatus,
				"imported":        0,
				"internal_orders": 0,
				"message":         accounts[i].LastError,
			})
			continue
		}
		if err := h.ensureFreshMarketplaceToken(c.Request.Context(), &accounts[i]); err != nil {
			results = append(results, gin.H{
				"provider":        accounts[i].Provider,
				"status":          accounts[i].SyncStatus,
				"imported":        0,
				"internal_orders": 0,
				"message":         accounts[i].LastError,
			})
			continue
		}
		if _, err := h.reconcileMarketplaceAccountIdentity(c.Request.Context(), &accounts[i], connector); err != nil {
			accounts[i].SyncStatus = "identity_sync_error"
			accounts[i].LastSyncAt = &now
			accounts[i].LastError = marketplaceConnectorErrorMessage(err)
			_ = database.DB.Save(&accounts[i]).Error
			results = append(results, gin.H{
				"provider":        accounts[i].Provider,
				"status":          accounts[i].SyncStatus,
				"imported":        0,
				"internal_orders": 0,
				"message":         accounts[i].LastError,
			})
			continue
		}

		orderResult, err := connector.FetchOrders(c.Request.Context(), marketplaceAccountFromModel(accounts[i]), marketplaces.OrderSyncInput{Days: input.Days})
		if err != nil {
			accounts[i].SyncStatus = "orders_sync_error"
			if mercadolivre.IsOrderAccessForbidden(err) {
				accounts[i].SyncStatus = "orders_permission_error"
			}
			accounts[i].LastSyncAt = &now
			accounts[i].LastError = marketplaceOrderAccessErrorMessage(accounts[i], err)
			_ = database.DB.Save(&accounts[i]).Error
			results = append(results, gin.H{
				"provider":        accounts[i].Provider,
				"status":          accounts[i].SyncStatus,
				"imported":        0,
				"internal_orders": 0,
				"message":         accounts[i].LastError,
			})
			continue
		}

		imported := 0
		internalOrders := 0
		failed := false
		for _, externalOrder := range orderResult.Orders {
			createdInternal, err := importMarketplaceOrder(tenantID, accounts[i].Provider, externalOrder, settings)
			if err != nil {
				accounts[i].SyncStatus = "orders_import_error"
				accounts[i].LastSyncAt = &now
				accounts[i].LastError = err.Error()
				_ = database.DB.Save(&accounts[i]).Error
				results = append(results, gin.H{
					"provider":        accounts[i].Provider,
					"status":          accounts[i].SyncStatus,
					"imported":        imported,
					"internal_orders": internalOrders,
					"message":         err.Error(),
				})
				failed = true
				break
			}
			imported++
			if createdInternal {
				internalOrders++
			}
		}
		if failed {
			continue
		}

		totalImported += imported
		totalInternalOrders += internalOrders
		accounts[i].SyncStatus = "orders_synced"
		accounts[i].LastSyncAt = &now
		accounts[i].LastError = ""
		_ = database.DB.Save(&accounts[i]).Error
		results = append(results, gin.H{
			"provider":        accounts[i].Provider,
			"status":          accounts[i].SyncStatus,
			"imported":        imported,
			"internal_orders": internalOrders,
			"message":         orderResult.Message,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"days":            input.Days,
		"results":         results,
		"imported":        totalImported,
		"internal_orders": totalInternalOrders,
	})
}

func importMarketplaceOrder(tenantID uint, provider string, source marketplaces.Order, settings models.TenantMarketplaceSettings) (bool, error) {
	externalID := strings.TrimSpace(source.ExternalOrderID)
	if externalID == "" {
		return false, errors.New("ID externo do pedido e obrigatorio")
	}
	now := time.Now()
	if source.OrderedAt.IsZero() {
		source.OrderedAt = now
	}
	if source.Currency == "" {
		source.Currency = "BRL"
	}
	if source.NetAmount == 0 {
		source.NetAmount = source.GrossAmount - source.MarketplaceFees - source.ShippingCost - source.DiscountAmount
	}

	rawPayload := marshalMarketplacePayload(source.Raw, source)
	var external models.ExternalMarketplaceOrder
	err := database.DB.Where("tenant_id = ? AND provider = ? AND external_order_id = ?", tenantID, provider, externalID).First(&external).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		external = models.ExternalMarketplaceOrder{TenantID: tenantID, Provider: provider, ExternalOrderID: externalID}
	} else if err != nil {
		return false, err
	}

	external.ExternalStatus = defaultString(source.Status, "paid")
	external.Currency = source.Currency
	external.GrossAmount = source.GrossAmount
	external.ItemsAmount = source.ItemsAmount
	external.ShippingCost = source.ShippingCost
	external.MarketplaceFees = source.MarketplaceFees
	external.DiscountAmount = source.DiscountAmount
	external.NetAmount = source.NetAmount
	external.BuyerNickname = source.BuyerNickname
	external.OrderedAt = source.OrderedAt
	external.SyncedAt = now
	external.RawPayload = rawPayload
	if err := database.DB.Save(&external).Error; err != nil {
		return false, err
	}

	if err := database.DB.Where("tenant_id = ? AND external_order_id_ref = ?", tenantID, external.ID).Delete(&models.ExternalMarketplaceOrderItem{}).Error; err != nil {
		return false, err
	}
	externalItems := make([]models.ExternalMarketplaceOrderItem, 0, len(source.Items))
	for _, item := range source.Items {
		productID := resolveMarketplaceOrderProductID(tenantID, provider, item)
		quantity := item.Quantity
		if quantity <= 0 {
			quantity = 1
		}
		unitPrice := item.UnitPrice
		if unitPrice <= 0 && quantity > 0 {
			unitPrice = item.GrossAmount / float64(quantity)
		}
		externalItem := models.ExternalMarketplaceOrderItem{
			TenantID:           tenantID,
			ExternalOrderIDRef: external.ID,
			ProductID:          productID,
			Provider:           provider,
			ExternalItemID:     item.ExternalItemID,
			ExternalSKU:        item.ExternalSKU,
			Title:              item.Title,
			Quantity:           quantity,
			UnitPrice:          unitPrice,
			GrossAmount:        item.GrossAmount,
			FeeAmount:          item.FeeAmount,
			DiscountAmount:     item.DiscountAmount,
		}
		if err := database.DB.Create(&externalItem).Error; err != nil {
			return false, err
		}
		externalItems = append(externalItems, externalItem)
	}
	external.Items = externalItems

	if !settings.AutoCreateInternalOrders || external.InternalOrderID != nil || external.ExternalStatus == "cancelled" {
		return false, nil
	}
	internalOrder, created, err := createInternalOrderFromExternal(tenantID, external, externalItems)
	if err != nil || !created {
		return created, err
	}
	external.InternalOrderID = &internalOrder.ID
	if err := database.DB.Save(&external).Error; err != nil {
		return true, err
	}
	if settings.AutoCreateFinancialEntries {
		if err := createMarketplaceFinancialEntries(tenantID, external, externalItems, internalOrder); err != nil {
			return true, err
		}
	}
	return true, nil
}

func marshalMarketplacePayload(raw map[string]any, fallback marketplaces.Order) string {
	if raw != nil {
		if payload, err := json.Marshal(raw); err == nil {
			return string(payload)
		}
	}
	payload, err := json.Marshal(fallback)
	if err != nil {
		return "{}"
	}
	return string(payload)
}

func resolveMarketplaceOrderProductID(tenantID uint, provider string, item marketplaces.OrderItem) *uint {
	var mapping models.MarketplaceProductMapping
	query := database.DB.Where("tenant_id = ? AND provider = ?", tenantID, provider)
	if strings.TrimSpace(item.ExternalItemID) != "" {
		if err := query.Where("external_item_id = ?", strings.TrimSpace(item.ExternalItemID)).First(&mapping).Error; err == nil {
			return &mapping.ProductID
		}
	}
	if strings.TrimSpace(item.ExternalSKU) != "" {
		sku := strings.TrimSpace(item.ExternalSKU)
		if err := database.DB.Where("tenant_id = ? AND provider = ? AND (external_sku = ? OR internal_sku = ?)", tenantID, provider, sku, sku).First(&mapping).Error; err == nil {
			return &mapping.ProductID
		}
		var product models.Product
		if err := database.DB.Where("tenant_id = ? AND sku = ?", tenantID, sku).First(&product).Error; err == nil {
			return &product.ID
		}
	}
	return nil
}

func createInternalOrderFromExternal(tenantID uint, external models.ExternalMarketplaceOrder, externalItems []models.ExternalMarketplaceOrderItem) (models.Order, bool, error) {
	orderItems := []models.OrderItem{}
	totalAmount := 0.0
	for _, item := range externalItems {
		if item.ProductID == nil {
			continue
		}
		quantity := item.Quantity
		if quantity <= 0 {
			quantity = 1
		}
		unitPrice := item.UnitPrice
		if unitPrice <= 0 && quantity > 0 {
			unitPrice = item.GrossAmount / float64(quantity)
		}
		color := "Marketplace"
		orderItems = append(orderItems, models.OrderItem{
			ProductID: *item.ProductID,
			Quantity:  quantity,
			UnitPrice: unitPrice,
			Color:     color,
		})
		totalAmount += unitPrice * float64(quantity)
	}
	if len(orderItems) == 0 {
		return models.Order{}, false, nil
	}

	customer, err := getOrCreateMarketplaceCustomer(tenantID)
	if err != nil {
		return models.Order{}, false, err
	}
	order := models.Order{
		TenantID:        tenantID,
		UserID:          customer.ID,
		TotalAmount:     totalAmount,
		Status:          "printing",
		Items:           orderItems,
		ShippingAddress: fmt.Sprintf("[%s] Pedido externo %s - comprador: %s", marketplaceLabel(external.Provider), external.ExternalOrderID, external.BuyerNickname),
		DeliveryMethod:  "marketplace",
		RecipientName:   external.BuyerNickname,
		Notes:           "Pedido criado automaticamente pela sincronizacao de marketplace.",
	}
	if err := database.DB.Create(&order).Error; err != nil {
		return models.Order{}, false, err
	}
	database.DB.Preload("Items.Product").First(&order, order.ID)
	return order, true, nil
}

func getOrCreateMarketplaceCustomer(tenantID uint) (models.User, error) {
	email := fmt.Sprintf("marketplace+tenant%d@az3d.local", tenantID)
	var user models.User
	err := database.DB.Where("tenant_id = ? AND email = ?", tenantID, email).First(&user).Error
	if err == nil {
		return user, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return user, err
	}
	password, err := utils.HashPassword(fmt.Sprintf("marketplace-%d", tenantID))
	if err != nil {
		return user, err
	}
	user = models.User{
		TenantID: tenantID,
		Name:     "Comprador Marketplace",
		Email:    email,
		Password: password,
		Role:     "customer",
	}
	return user, database.DB.Create(&user).Error
}

func createMarketplaceFinancialEntries(tenantID uint, external models.ExternalMarketplaceOrder, externalItems []models.ExternalMarketplaceOrderItem, internalOrder models.Order) error {
	itemsAmount := external.ItemsAmount
	if itemsAmount <= 0 {
		for _, item := range externalItems {
			itemsAmount += item.GrossAmount
		}
	}
	for _, orderItem := range internalOrder.Items {
		externalItem, ok := findExternalItemByProductID(externalItems, orderItem.ProductID)
		if !ok {
			continue
		}
		var existing int64
		database.DB.Model(&models.ProductActualCost{}).Where("tenant_id = ? AND order_item_id = ?", tenantID, orderItem.ID).Count(&existing)
		if existing > 0 {
			continue
		}
		ratio := 0.0
		if itemsAmount > 0 {
			ratio = externalItem.GrossAmount / itemsAmount
		}
		fee := externalItem.FeeAmount
		if fee <= 0 {
			fee = external.MarketplaceFees * ratio
		}
		discount := externalItem.DiscountAmount
		if discount <= 0 {
			discount = external.DiscountAmount * ratio
		}
		shipping := external.ShippingCost * ratio
		occurredAt := external.OrderedAt
		actual := models.ProductActualCost{
			TenantID:             tenantID,
			ProductID:            orderItem.ProductID,
			OrderID:              &internalOrder.ID,
			OrderItemID:          &orderItem.ID,
			ShippingCost:         shipping,
			MarketplaceFeeAmount: fee,
			DiscountAmount:       discount,
			TotalCost:            shipping + fee + discount,
			Notes:                fmt.Sprintf("Custos importados do pedido %s %s", marketplaceLabel(external.Provider), external.ExternalOrderID),
			OccurredAt:           &occurredAt,
		}
		if err := database.DB.Create(&actual).Error; err != nil {
			return err
		}
	}
	return nil
}

func findExternalItemByProductID(items []models.ExternalMarketplaceOrderItem, productID uint) (models.ExternalMarketplaceOrderItem, bool) {
	for _, item := range items {
		if item.ProductID != nil && *item.ProductID == productID {
			return item, true
		}
	}
	return models.ExternalMarketplaceOrderItem{}, false
}

// GET /api/admin/marketplaces/external-orders
func (h *MarketplaceHandler) GetExternalOrders(c *gin.Context) {
	tenantID := getTenantID(c)
	provider := normalizeProvider(c.Query("provider"))

	query := database.DB.Preload("Items.Product").Where("tenant_id = ?", tenantID)
	if provider != "" {
		query = query.Where("provider = ?", provider)
	}

	var orders []models.ExternalMarketplaceOrder
	if err := query.Order("ordered_at desc, created_at desc").Limit(200).Find(&orders).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao buscar pedidos externos"})
		return
	}

	c.JSON(http.StatusOK, orders)
}

func ReconcileTenantMarketplaceData(tenantID uint) error {
	var accounts []models.MarketplaceAccount
	if err := database.DB.Where("tenant_id = ? AND is_active = ?", tenantID, true).Find(&accounts).Error; err != nil {
		return err
	}

	ctx := context.Background()
	handler := NewMarketplaceHandler(&config.Config{})
	registry := marketplaceConnectorRegistry()
	for i := range accounts {
		connector, ok := registry.Get(accounts[i].Provider)
		if !ok {
			continue
		}
		_ = handler.syncMarketplaceCatalogAccount(ctx, tenantID, &accounts[i], connector)
	}

	settings, _ := getOrCreateTenantMarketplaceSettings(tenantID)
	for i := range accounts {
		connector, ok := registry.Get(accounts[i].Provider)
		if !ok {
			continue
		}
		orderResult, err := connector.FetchOrders(ctx, marketplaceAccountFromModel(accounts[i]), marketplaces.OrderSyncInput{Days: 30})
		if err != nil {
			continue
		}
		for _, externalOrder := range orderResult.Orders {
			_, _ = importMarketplaceOrder(tenantID, accounts[i].Provider, externalOrder, settings)
		}
	}
	return nil
}
