package handlers

import (
	"errors"
	"math"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"az3d-backend/database"
	"az3d-backend/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type PricingHandler struct{}

func NewPricingHandler() *PricingHandler {
	return &PricingHandler{}
}

func getOrCreateTenantStoreSettings(tenantID uint) (models.TenantStoreSettings, error) {
	var store models.TenantStoreSettings
	err := database.DB.Where("tenant_id = ?", tenantID).First(&store).Error
	if err == nil {
		return store, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return store, err
	}

	legacy, _ := getOrCreateTenantSettings(tenantID)
	store = models.TenantStoreSettings{
		TenantID:     tenantID,
		StoreName:    legacy.StoreName,
		LogoURL:      legacy.LogoURL,
		PrimaryColor: legacy.PrimaryColor,
		AccentColor:  legacy.AccentColor,
	}
	err = database.DB.Create(&store).Error
	return store, err
}

func getOrCreateTenantPricingSettings(tenantID uint) (models.TenantPricingSettings, error) {
	var pricing models.TenantPricingSettings
	err := database.DB.Where("tenant_id = ?", tenantID).First(&pricing).Error
	if err == nil {
		return pricing, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return pricing, err
	}

	legacy, _ := getOrCreateTenantSettings(tenantID)
	pricing = models.TenantPricingSettings{
		TenantID:              tenantID,
		DefaultSpoolPrice:     legacy.DefaultSpoolPrice,
		DefaultSpoolWeight:    legacy.DefaultSpoolWeight,
		DefaultPrinterPowerKW: legacy.DefaultPrinterPowerKW,
		DefaultEnergyTariff:   legacy.DefaultEnergyTariff,
		DefaultPackagingCost:  legacy.DefaultPackagingCost,
		DefaultLaborCost:      legacy.DefaultLaborCost,
		DefaultExtraCost:      legacy.DefaultExtraCost,
		DefaultFailureRatePct: legacy.DefaultFailureRatePct,
		DefaultMarginPct:      legacy.DefaultMarginPct,
		DefaultPlatformFeePct: legacy.DefaultPlatformFeePct,
		DefaultPaymentFeePct:  legacy.DefaultPaymentFeePct,
		DefaultFixedFee:       legacy.DefaultFixedFee,
	}
	err = database.DB.Create(&pricing).Error
	return pricing, err
}

func getOrCreateTenantFulfillmentSettings(tenantID uint) (models.TenantFulfillmentSettings, error) {
	var fulfillment models.TenantFulfillmentSettings
	err := database.DB.Where("tenant_id = ?", tenantID).First(&fulfillment).Error
	if err == nil {
		return fulfillment, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return fulfillment, err
	}

	legacy, _ := getOrCreateTenantSettings(tenantID)
	fulfillment = models.TenantFulfillmentSettings{
		TenantID:              tenantID,
		DeliveryPickupEnabled: legacy.DeliveryPickupEnabled,
		DeliveryShipEnabled:   legacy.DeliveryShipEnabled,
	}
	err = database.DB.Create(&fulfillment).Error
	return fulfillment, err
}

func tenantPricingBundle(tenantID uint) (models.TenantPricingBundle, error) {
	store, err := getOrCreateTenantStoreSettings(tenantID)
	if err != nil {
		return models.TenantPricingBundle{}, err
	}
	pricing, err := getOrCreateTenantPricingSettings(tenantID)
	if err != nil {
		return models.TenantPricingBundle{}, err
	}
	fulfillment, err := getOrCreateTenantFulfillmentSettings(tenantID)
	if err != nil {
		return models.TenantPricingBundle{}, err
	}

	var materials []models.MaterialPreset
	var printers []models.PrinterPreset
	var platforms []models.PlatformFeePreset
	database.DB.Where("tenant_id = ? AND is_active = ?", tenantID, true).Order("is_default desc, name asc").Find(&materials)
	database.DB.Where("tenant_id = ? AND is_active = ?", tenantID, true).Order("is_default desc, name asc").Find(&printers)
	database.DB.Where("tenant_id = ? AND is_active = ?", tenantID, true).Order("is_default desc, name asc").Find(&platforms)

	return models.TenantPricingBundle{
		Store:              store,
		Pricing:            pricing,
		Fulfillment:        fulfillment,
		MaterialPresets:    materials,
		PrinterPresets:     printers,
		PlatformFeePresets: platforms,
	}, nil
}

func tenantSettingsFromDomains(tenantID uint) (models.TenantSettings, error) {
	store, err := getOrCreateTenantStoreSettings(tenantID)
	if err != nil {
		return models.TenantSettings{}, err
	}
	pricing, err := getOrCreateTenantPricingSettings(tenantID)
	if err != nil {
		return models.TenantSettings{}, err
	}
	fulfillment, err := getOrCreateTenantFulfillmentSettings(tenantID)
	if err != nil {
		return models.TenantSettings{}, err
	}

	settings, _ := getOrCreateTenantSettings(tenantID)
	settings.TenantID = tenantID
	settings.StoreName = store.StoreName
	settings.LogoURL = store.LogoURL
	settings.PrimaryColor = store.PrimaryColor
	settings.AccentColor = store.AccentColor
	settings.DefaultSpoolPrice = pricing.DefaultSpoolPrice
	settings.DefaultSpoolWeight = pricing.DefaultSpoolWeight
	settings.DefaultPrinterPowerKW = pricing.DefaultPrinterPowerKW
	settings.DefaultEnergyTariff = pricing.DefaultEnergyTariff
	settings.DefaultPackagingCost = pricing.DefaultPackagingCost
	settings.DefaultLaborCost = pricing.DefaultLaborCost
	settings.DefaultExtraCost = pricing.DefaultExtraCost
	settings.DefaultFailureRatePct = pricing.DefaultFailureRatePct
	settings.DefaultMarginPct = pricing.DefaultMarginPct
	settings.DefaultPlatformFeePct = pricing.DefaultPlatformFeePct
	settings.DefaultPaymentFeePct = pricing.DefaultPaymentFeePct
	settings.DefaultFixedFee = pricing.DefaultFixedFee
	settings.DeliveryPickupEnabled = fulfillment.DeliveryPickupEnabled
	settings.DeliveryShipEnabled = fulfillment.DeliveryShipEnabled
	_ = database.DB.Save(&settings).Error

	return settings, nil
}

func syncTenantSettingsDomains(tenantID uint, input models.TenantSettingsInput) (models.TenantSettings, error) {
	legacy, err := getOrCreateTenantSettings(tenantID)
	if err != nil {
		return legacy, err
	}
	store, err := getOrCreateTenantStoreSettings(tenantID)
	if err != nil {
		return legacy, err
	}
	pricing, err := getOrCreateTenantPricingSettings(tenantID)
	if err != nil {
		return legacy, err
	}
	fulfillment, err := getOrCreateTenantFulfillmentSettings(tenantID)
	if err != nil {
		return legacy, err
	}

	store.StoreName = input.StoreName
	store.LogoURL = input.LogoURL
	store.PrimaryColor = input.PrimaryColor
	store.AccentColor = input.AccentColor

	pricing.DefaultSpoolPrice = input.DefaultSpoolPrice
	pricing.DefaultSpoolWeight = input.DefaultSpoolWeight
	pricing.DefaultPrinterPowerKW = input.DefaultPrinterPowerKW
	pricing.DefaultEnergyTariff = input.DefaultEnergyTariff
	pricing.DefaultPackagingCost = input.DefaultPackagingCost
	pricing.DefaultLaborCost = input.DefaultLaborCost
	pricing.DefaultExtraCost = input.DefaultExtraCost
	pricing.DefaultFailureRatePct = input.DefaultFailureRatePct
	pricing.DefaultMarginPct = input.DefaultMarginPct
	pricing.DefaultPlatformFeePct = input.DefaultPlatformFeePct
	pricing.DefaultPaymentFeePct = input.DefaultPaymentFeePct
	pricing.DefaultFixedFee = input.DefaultFixedFee

	fulfillment.DeliveryPickupEnabled = input.DeliveryPickupEnabled
	fulfillment.DeliveryShipEnabled = input.DeliveryShipEnabled

	if err := database.DB.Save(&store).Error; err != nil {
		return legacy, err
	}
	if err := database.DB.Save(&pricing).Error; err != nil {
		return legacy, err
	}
	if err := database.DB.Save(&fulfillment).Error; err != nil {
		return legacy, err
	}

	return tenantSettingsFromDomains(tenantID)
}

func applyTenantPricingDefaults(tenantID uint, input models.PricingCalculationInput) models.PricingCalculationInput {
	pricing, _ := getOrCreateTenantPricingSettings(tenantID)

	if input.SpoolPrice <= 0 {
		input.SpoolPrice = pricing.DefaultSpoolPrice
	}
	if input.SpoolWeightGrams <= 0 {
		input.SpoolWeightGrams = pricing.DefaultSpoolWeight
	}
	if input.PrinterPowerKW <= 0 {
		input.PrinterPowerKW = pricing.DefaultPrinterPowerKW
	}
	if input.EnergyTariffPerKWh <= 0 {
		input.EnergyTariffPerKWh = pricing.DefaultEnergyTariff
	}
	if input.PackagingCost <= 0 {
		input.PackagingCost = pricing.DefaultPackagingCost
	}
	if input.LaborCost <= 0 {
		input.LaborCost = pricing.DefaultLaborCost
	}
	if input.ExtraCost <= 0 {
		input.ExtraCost = pricing.DefaultExtraCost
	}
	if input.FailureRatePercent <= 0 {
		input.FailureRatePercent = pricing.DefaultFailureRatePct
	}
	if input.MarginPercent <= 0 {
		input.MarginPercent = pricing.DefaultMarginPct
	}
	if input.PlatformFeePercent <= 0 {
		input.PlatformFeePercent = pricing.DefaultPlatformFeePct
	}
	if input.PaymentFeePercent <= 0 {
		input.PaymentFeePercent = pricing.DefaultPaymentFeePct
	}
	if input.FixedFee <= 0 {
		input.FixedFee = pricing.DefaultFixedFee
	}

	if input.MaterialPresetID > 0 {
		var material models.MaterialPreset
		if err := database.DB.Where("tenant_id = ? AND id = ? AND is_active = ?", tenantID, input.MaterialPresetID, true).First(&material).Error; err == nil {
			input.SpoolPrice = material.SpoolPrice
			input.SpoolWeightGrams = material.SpoolWeightGrams
		}
	}
	if input.PrinterPresetID > 0 {
		var printer models.PrinterPreset
		if err := database.DB.Where("tenant_id = ? AND id = ? AND is_active = ?", tenantID, input.PrinterPresetID, true).First(&printer).Error; err == nil {
			input.PrinterPowerKW = printer.PowerKW
		}
	}
	if input.PlatformFeePresetID > 0 {
		var platform models.PlatformFeePreset
		if err := database.DB.Where("tenant_id = ? AND id = ? AND is_active = ?", tenantID, input.PlatformFeePresetID, true).First(&platform).Error; err == nil {
			input.PlatformFeePercent = platform.PlatformFeePercent
			input.PaymentFeePercent = platform.PaymentFeePercent
			input.FixedFee = platform.FixedFee
		}
	}

	return input
}

func calculatePrintingPricing(input models.PricingCalculationInput) models.PricingCalculationResult {
	totalMaterialGrams := math.Max(0, input.ProductWeightGrams) + math.Max(0, input.SupportWeightGrams)
	materialCostPerGram := 0.0
	if input.SpoolWeightGrams > 0 {
		materialCostPerGram = input.SpoolPrice / input.SpoolWeightGrams
	}
	materialCost := totalMaterialGrams * materialCostPerGram
	energyKWh := math.Max(0, input.PrinterPowerKW) * (math.Max(0, input.PrintMinutes) / 60)
	energyCost := energyKWh * math.Max(0, input.EnergyTariffPerKWh)
	directCost := materialCost + energyCost
	failureReserve := directCost * (math.Max(0, input.FailureRatePercent) / 100)
	operationalCost := directCost + failureReserve + math.Max(0, input.PackagingCost) + math.Max(0, input.LaborCost) + math.Max(0, input.ExtraCost)
	targetNetRevenue := operationalCost * (1 + math.Max(0, input.MarginPercent)/100)
	variableFeeRate := math.Min(0.95, (math.Max(0, input.PlatformFeePercent)+math.Max(0, input.PaymentFeePercent))/100)
	fixedFee := math.Max(0, input.FixedFee)
	suggestedPrice := 0.0
	if variableFeeRate < 1 {
		suggestedPrice = (targetNetRevenue + fixedFee) / (1 - variableFeeRate)
	}
	variableFeeValue := suggestedPrice * variableFeeRate
	totalFees := variableFeeValue + fixedFee
	netAfterFees := suggestedPrice - totalFees
	profit := netAfterFees - operationalCost
	profitMarginPercent := 0.0
	if suggestedPrice > 0 {
		profitMarginPercent = (profit / suggestedPrice) * 100
	}

	return models.PricingCalculationResult{
		TotalMaterialGrams:  totalMaterialGrams,
		MaterialCostPerGram: materialCostPerGram,
		MaterialCost:        materialCost,
		EnergyKWh:           energyKWh,
		EnergyCost:          energyCost,
		DirectCost:          directCost,
		FailureReserve:      failureReserve,
		OperationalCost:     operationalCost,
		TargetNetRevenue:    targetNetRevenue,
		VariableFeeRate:     variableFeeRate,
		VariableFeeValue:    variableFeeValue,
		FixedFee:            fixedFee,
		TotalFees:           totalFees,
		SuggestedPrice:      suggestedPrice,
		NetAfterFees:        netAfterFees,
		Profit:              profit,
		ProfitMarginPercent: profitMarginPercent,
	}
}

func calculatePricingForTenant(tenantID uint, input models.PricingCalculationInput) (models.PricingCalculationInput, models.PricingCalculationResult) {
	normalizedInput := applyTenantPricingDefaults(tenantID, input)
	return normalizedInput, calculatePrintingPricing(normalizedInput)
}

func createProductPricingSnapshot(tenantID uint, productID uint, input models.PricingCalculationInput) error {
	normalizedInput, result := calculatePricingForTenant(tenantID, input)
	snapshot := models.ProductPricingSnapshot{
		TenantID:            tenantID,
		ProductID:           productID,
		ProductWeightGrams:  normalizedInput.ProductWeightGrams,
		SupportWeightGrams:  normalizedInput.SupportWeightGrams,
		PrintMinutes:        normalizedInput.PrintMinutes,
		SpoolPrice:          normalizedInput.SpoolPrice,
		SpoolWeightGrams:    normalizedInput.SpoolWeightGrams,
		PrinterPowerKW:      normalizedInput.PrinterPowerKW,
		EnergyTariffPerKWh:  normalizedInput.EnergyTariffPerKWh,
		PackagingCost:       normalizedInput.PackagingCost,
		LaborCost:           normalizedInput.LaborCost,
		ExtraCost:           normalizedInput.ExtraCost,
		FailureRatePercent:  normalizedInput.FailureRatePercent,
		MarginPercent:       normalizedInput.MarginPercent,
		PlatformFeePercent:  normalizedInput.PlatformFeePercent,
		PaymentFeePercent:   normalizedInput.PaymentFeePercent,
		FixedFee:            normalizedInput.FixedFee,
		TotalMaterialGrams:  result.TotalMaterialGrams,
		MaterialCostPerGram: result.MaterialCostPerGram,
		MaterialCost:        result.MaterialCost,
		EnergyKWh:           result.EnergyKWh,
		EnergyCost:          result.EnergyCost,
		DirectCost:          result.DirectCost,
		FailureReserve:      result.FailureReserve,
		OperationalCost:     result.OperationalCost,
		TargetNetRevenue:    result.TargetNetRevenue,
		VariableFeeRate:     result.VariableFeeRate,
		VariableFeeValue:    result.VariableFeeValue,
		TotalFees:           result.TotalFees,
		SuggestedPrice:      result.SuggestedPrice,
		NetAfterFees:        result.NetAfterFees,
		Profit:              result.Profit,
		ProfitMarginPercent: result.ProfitMarginPercent,
	}
	return database.DB.Create(&snapshot).Error
}

func latestSnapshotsByProduct(tenantID uint, productIDs []uint) map[uint]models.ProductPricingSnapshot {
	snapshots := map[uint]models.ProductPricingSnapshot{}
	if len(productIDs) == 0 {
		return snapshots
	}

	var rows []models.ProductPricingSnapshot
	database.DB.Where("tenant_id = ? AND product_id IN ?", tenantID, productIDs).Order("created_at desc").Find(&rows)
	for _, row := range rows {
		if _, exists := snapshots[row.ProductID]; !exists {
			snapshots[row.ProductID] = row
		}
	}
	return snapshots
}

func summarizeFinancials(tenantID uint) models.FinancialSummary {
	var orders []models.Order
	database.DB.Preload("Items.Product").Where("tenant_id = ? AND status <> ?", tenantID, "cancelled").Find(&orders)
	var externalOrders []models.ExternalMarketplaceOrder
	database.DB.Preload("Items.Product").Where("tenant_id = ? AND external_status <> ?", tenantID, "cancelled").Find(&externalOrders)

	productIDsMap := map[uint]bool{}
	for _, order := range orders {
		for _, item := range order.Items {
			productIDsMap[item.ProductID] = true
		}
	}
	for _, order := range externalOrders {
		for _, item := range order.Items {
			if item.ProductID != nil {
				productIDsMap[*item.ProductID] = true
			}
		}
	}
	productIDs := make([]uint, 0, len(productIDsMap))
	for id := range productIDsMap {
		productIDs = append(productIDs, id)
	}

	snapshots := latestSnapshotsByProduct(tenantID, productIDs)
	products := map[uint]*models.FinancialProductSummary{}
	summary := models.FinancialSummary{OrdersCount: len(orders)}
	channels := map[string]*models.FinancialChannelSummary{}

	for _, order := range orders {
		summary.GrossRevenue += order.TotalAmount
		for _, item := range order.Items {
			quantity := item.Quantity
			revenue := item.UnitPrice * float64(quantity)
			summary.UnitsSold += quantity

			if _, exists := products[item.ProductID]; !exists {
				title := "Produto removido"
				if item.Product != nil {
					title = item.Product.Title
				}
				products[item.ProductID] = &models.FinancialProductSummary{ProductID: item.ProductID, ProductTitle: title}
			}
			productSummary := products[item.ProductID]
			productSummary.UnitsSold += quantity
			productSummary.GrossRevenue += revenue

			if snapshot, exists := snapshots[item.ProductID]; exists {
				estimatedCost := snapshot.OperationalCost * float64(quantity)
				estimatedFees := snapshot.TotalFees * float64(quantity)
				productSummary.EstimatedCost += estimatedCost
				productSummary.EstimatedFees += estimatedFees
				summary.EstimatedOperational += estimatedCost
				summary.EstimatedFees += estimatedFees
			}
		}
	}

	for _, externalOrder := range externalOrders {
		provider := normalizeProvider(externalOrder.Provider)
		if provider == "" {
			provider = "marketplace"
		}
		if _, exists := channels[provider]; !exists {
			channels[provider] = &models.FinancialChannelSummary{Provider: provider}
		}
		channel := channels[provider]
		channel.OrdersCount++
		channel.GrossRevenue += externalOrder.GrossAmount
		channel.MarketplaceFees += externalOrder.MarketplaceFees
		channel.ShippingCost += externalOrder.ShippingCost
		channel.DiscountAmount += externalOrder.DiscountAmount
		channel.NetRevenue += externalOrder.NetAmount
		if channel.LastExternalOrder == "" || externalOrder.OrderedAt.After(parseSummaryDate(channel.LastExternalOrder)) {
			channel.LastExternalOrder = externalOrder.OrderedAt.Format(time.RFC3339)
		}

		includeInConsolidatedTotals := externalOrder.InternalOrderID == nil
		if includeInConsolidatedTotals {
			summary.OrdersCount++
			summary.GrossRevenue += externalOrder.GrossAmount
			summary.EstimatedFees += externalOrder.MarketplaceFees
		}

		for _, item := range externalOrder.Items {
			quantity := item.Quantity
			if quantity <= 0 {
				quantity = 1
			}
			channel.UnitsSold += quantity
			if includeInConsolidatedTotals {
				summary.UnitsSold += quantity
			}
			if item.ProductID == nil {
				continue
			}

			if _, exists := products[*item.ProductID]; !exists {
				title := item.Title
				if item.Product != nil {
					title = item.Product.Title
				}
				if title == "" {
					title = "Produto externo"
				}
				products[*item.ProductID] = &models.FinancialProductSummary{ProductID: *item.ProductID, ProductTitle: title}
			}
			if snapshot, exists := snapshots[*item.ProductID]; exists {
				estimatedCost := snapshot.OperationalCost * float64(quantity)
				channel.EstimatedCost += estimatedCost
				if includeInConsolidatedTotals {
					products[*item.ProductID].UnitsSold += quantity
					products[*item.ProductID].GrossRevenue += item.GrossAmount
					products[*item.ProductID].EstimatedCost += estimatedCost
					summary.EstimatedOperational += estimatedCost
				}
			}
		}
	}

	var actualCosts []models.ProductActualCost
	database.DB.Where("tenant_id = ?", tenantID).Find(&actualCosts)
	for _, actual := range actualCosts {
		summary.ActualCosts += actual.TotalCost
		if productSummary, exists := products[actual.ProductID]; exists {
			productSummary.ActualCost += actual.TotalCost
		}
	}

	var fixedCosts []models.TenantFixedCost
	database.DB.Where("tenant_id = ? AND is_active = ?", tenantID, true).Find(&fixedCosts)
	for _, fixed := range fixedCosts {
		summary.FixedCostsMonthly += fixed.MonthlyAmount
	}

	if summary.OrdersCount > 0 {
		summary.AverageTicket = summary.GrossRevenue / float64(summary.OrdersCount)
	}
	summary.EstimatedNetProfit = summary.GrossRevenue - summary.EstimatedOperational - summary.EstimatedFees - summary.FixedCostsMonthly
	if summary.GrossRevenue > 0 {
		summary.EstimatedMarginPercent = (summary.EstimatedNetProfit / summary.GrossRevenue) * 100
	}
	summary.ActualNetProfit = summary.GrossRevenue - summary.ActualCosts - summary.FixedCostsMonthly
	if summary.GrossRevenue > 0 {
		summary.ActualMarginPercent = (summary.ActualNetProfit / summary.GrossRevenue) * 100
	}

	summaries := make([]models.FinancialProductSummary, 0, len(products))
	for _, productSummary := range products {
		productSummary.EstimatedProfit = productSummary.GrossRevenue - productSummary.EstimatedCost - productSummary.EstimatedFees
		if productSummary.GrossRevenue > 0 {
			productSummary.EstimatedMarginPercent = (productSummary.EstimatedProfit / productSummary.GrossRevenue) * 100
		}
		productSummary.ActualProfit = productSummary.GrossRevenue - productSummary.ActualCost
		if productSummary.GrossRevenue > 0 {
			productSummary.ActualMarginPercent = (productSummary.ActualProfit / productSummary.GrossRevenue) * 100
		}
		summaries = append(summaries, *productSummary)
	}

	sort.Slice(summaries, func(i, j int) bool {
		return summaries[i].EstimatedProfit > summaries[j].EstimatedProfit
	})
	if len(summaries) > 5 {
		summary.TopProducts = summaries[:5]
	} else {
		summary.TopProducts = summaries
	}

	lowMargin := append([]models.FinancialProductSummary{}, summaries...)
	sort.Slice(lowMargin, func(i, j int) bool {
		return lowMargin[i].EstimatedMarginPercent < lowMargin[j].EstimatedMarginPercent
	})
	for _, item := range lowMargin {
		if item.GrossRevenue > 0 && item.EstimatedMarginPercent < 25 {
			summary.LowMarginProducts = append(summary.LowMarginProducts, item)
		}
		if len(summary.LowMarginProducts) >= 5 {
			break
		}
	}

	channelSummaries := make([]models.FinancialChannelSummary, 0, len(channels))
	for _, channel := range channels {
		channel.EstimatedProfit = channel.NetRevenue - channel.EstimatedCost
		if channel.GrossRevenue > 0 {
			channel.MarginPercent = (channel.EstimatedProfit / channel.GrossRevenue) * 100
		}
		channelSummaries = append(channelSummaries, *channel)
	}
	sort.Slice(channelSummaries, func(i, j int) bool {
		return channelSummaries[i].GrossRevenue > channelSummaries[j].GrossRevenue
	})
	summary.Channels = channelSummaries

	return summary
}

func parseSummaryDate(value string) time.Time {
	parsed, err := time.Parse(time.RFC3339, value)
	if err != nil {
		return time.Time{}
	}
	return parsed
}

func parseIDParam(c *gin.Context, name string) (uint, bool) {
	id, err := strconv.Atoi(c.Param(name))
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalido"})
		return 0, false
	}
	return uint(id), true
}

func setDefaultPreset(tenantID uint, presetType string, id uint) {
	switch presetType {
	case "material":
		database.DB.Model(&models.MaterialPreset{}).Where("tenant_id = ?", tenantID).Update("is_default", false)
		database.DB.Model(&models.MaterialPreset{}).Where("tenant_id = ? AND id = ?", tenantID, id).Update("is_default", true)
	case "printer":
		database.DB.Model(&models.PrinterPreset{}).Where("tenant_id = ?", tenantID).Update("is_default", false)
		database.DB.Model(&models.PrinterPreset{}).Where("tenant_id = ? AND id = ?", tenantID, id).Update("is_default", true)
	case "platform":
		database.DB.Model(&models.PlatformFeePreset{}).Where("tenant_id = ?", tenantID).Update("is_default", false)
		database.DB.Model(&models.PlatformFeePreset{}).Where("tenant_id = ? AND id = ?", tenantID, id).Update("is_default", true)
	}
}

func (h *PricingHandler) GetPricingSettings(c *gin.Context) {
	tenantID := getTenantID(c)
	bundle, err := tenantPricingBundle(tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao carregar configuracoes de precificacao"})
		return
	}

	c.JSON(http.StatusOK, bundle)
}

func (h *PricingHandler) Calculate(c *gin.Context) {
	tenantID := getTenantID(c)
	var input models.PricingCalculationInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Dados invalidos para calculo: " + err.Error()})
		return
	}

	normalizedInput, result := calculatePricingForTenant(tenantID, input)
	c.JSON(http.StatusOK, gin.H{
		"input":  normalizedInput,
		"result": result,
	})
}

func (h *PricingHandler) ApplyToProduct(c *gin.Context) {
	tenantID := getTenantID(c)
	productID, ok := parseProductIDParam(c)
	if !ok {
		return
	}

	var product models.Product
	if err := database.DB.Where("tenant_id = ? AND id = ?", tenantID, productID).First(&product).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Produto nao encontrado"})
		return
	}

	var input models.PricingCalculationInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Dados invalidos para calculo: " + err.Error()})
		return
	}

	normalizedInput, result := calculatePricingForTenant(tenantID, input)
	product.Price = math.Round(result.SuggestedPrice*100) / 100
	if err := database.DB.Save(&product).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao atualizar preco do produto"})
		return
	}
	if err := createProductPricingSnapshot(tenantID, productID, normalizedInput); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao salvar historico de calculo"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"product": product,
		"input":   normalizedInput,
		"result":  result,
	})
}

func (h *PricingHandler) GetProductSnapshots(c *gin.Context) {
	tenantID := getTenantID(c)
	productID, ok := parseProductIDParam(c)
	if !ok {
		return
	}

	var snapshots []models.ProductPricingSnapshot
	if err := database.DB.Where("tenant_id = ? AND product_id = ?", tenantID, productID).Order("created_at desc").Limit(30).Find(&snapshots).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao carregar historico de precificacao"})
		return
	}
	c.JSON(http.StatusOK, snapshots)
}

func (h *PricingHandler) GetProductFinancials(c *gin.Context) {
	tenantID := getTenantID(c)
	productID, ok := parseProductIDParam(c)
	if !ok {
		return
	}

	var snapshots []models.ProductPricingSnapshot
	var actualCosts []models.ProductActualCost
	database.DB.Where("tenant_id = ? AND product_id = ?", tenantID, productID).Order("created_at desc").Limit(30).Find(&snapshots)
	database.DB.Where("tenant_id = ? AND product_id = ?", tenantID, productID).Order("created_at desc").Limit(30).Find(&actualCosts)

	summary := summarizeFinancials(tenantID)
	var productSummary *models.FinancialProductSummary
	for _, item := range append(summary.TopProducts, summary.LowMarginProducts...) {
		if item.ProductID == productID {
			copied := item
			productSummary = &copied
			break
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"snapshots":    snapshots,
		"actual_costs": actualCosts,
		"summary":      productSummary,
	})
}

func (h *PricingHandler) GetFinancialSummary(c *gin.Context) {
	c.JSON(http.StatusOK, summarizeFinancials(getTenantID(c)))
}

func (h *PricingHandler) GetFixedCosts(c *gin.Context) {
	tenantID := getTenantID(c)
	var fixedCosts []models.TenantFixedCost
	if err := database.DB.Where("tenant_id = ?", tenantID).Order("is_active desc, name asc").Find(&fixedCosts).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao carregar custos fixos"})
		return
	}
	c.JSON(http.StatusOK, fixedCosts)
}

func (h *PricingHandler) SaveFixedCost(c *gin.Context) {
	tenantID := getTenantID(c)
	var input models.TenantFixedCostInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Dados invalidos: " + err.Error()})
		return
	}
	if strings.TrimSpace(input.AllocationBasis) == "" {
		input.AllocationBasis = "print_hours"
	}

	fixedCost := models.TenantFixedCost{
		TenantID:        tenantID,
		Name:            strings.TrimSpace(input.Name),
		MonthlyAmount:   input.MonthlyAmount,
		AllocationBasis: input.AllocationBasis,
		IsActive:        input.IsActive,
	}
	if err := database.DB.Create(&fixedCost).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao salvar custo fixo"})
		return
	}
	c.JSON(http.StatusCreated, fixedCost)
}

func (h *PricingHandler) UpdateFixedCost(c *gin.Context) {
	tenantID := getTenantID(c)
	id, ok := parseIDParam(c, "cost_id")
	if !ok {
		return
	}
	var fixedCost models.TenantFixedCost
	if err := database.DB.Where("tenant_id = ? AND id = ?", tenantID, id).First(&fixedCost).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Custo fixo nao encontrado"})
		return
	}
	var input models.TenantFixedCostInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Dados invalidos: " + err.Error()})
		return
	}
	fixedCost.Name = strings.TrimSpace(input.Name)
	fixedCost.MonthlyAmount = input.MonthlyAmount
	fixedCost.AllocationBasis = input.AllocationBasis
	fixedCost.IsActive = input.IsActive
	if fixedCost.AllocationBasis == "" {
		fixedCost.AllocationBasis = "print_hours"
	}
	if err := database.DB.Save(&fixedCost).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao atualizar custo fixo"})
		return
	}
	c.JSON(http.StatusOK, fixedCost)
}

func (h *PricingHandler) DeleteFixedCost(c *gin.Context) {
	tenantID := getTenantID(c)
	id, ok := parseIDParam(c, "cost_id")
	if !ok {
		return
	}
	if err := database.DB.Where("tenant_id = ? AND id = ?", tenantID, id).Delete(&models.TenantFixedCost{}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao remover custo fixo"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Custo fixo removido"})
}

func (h *PricingHandler) GetActualCosts(c *gin.Context) {
	tenantID := getTenantID(c)
	query := database.DB.Preload("Product").Where("tenant_id = ?", tenantID)
	if productID := c.Query("product_id"); productID != "" {
		query = query.Where("product_id = ?", productID)
	}
	var costs []models.ProductActualCost
	if err := query.Order("created_at desc").Limit(100).Find(&costs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao carregar custos reais"})
		return
	}
	c.JSON(http.StatusOK, costs)
}

func (h *PricingHandler) SaveActualCost(c *gin.Context) {
	tenantID := getTenantID(c)
	var input models.ProductActualCostInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Dados invalidos: " + err.Error()})
		return
	}
	if !ensureTenantProduct(tenantID, input.ProductID) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Produto nao encontrado"})
		return
	}

	pricing, _ := getOrCreateTenantPricingSettings(tenantID)
	materialGrams := math.Max(0, input.ActualMaterialGrams) + math.Max(0, input.FailedMaterialGrams)
	materialCost := input.MaterialCost
	if materialCost <= 0 && pricing.DefaultSpoolWeight > 0 {
		materialCost = materialGrams * (pricing.DefaultSpoolPrice / pricing.DefaultSpoolWeight)
	}
	energyCost := input.EnergyCost
	if energyCost <= 0 {
		energyCost = math.Max(0, input.ActualPrintMinutes) / 60 * math.Max(0, pricing.DefaultPrinterPowerKW) * math.Max(0, pricing.DefaultEnergyTariff)
	}
	totalCost := materialCost + energyCost + math.Max(0, input.PackagingCost) + math.Max(0, input.LaborCost) + math.Max(0, input.ExtraCost) + math.Max(0, input.ShippingCost) + math.Max(0, input.MarketplaceFeeAmount) + math.Max(0, input.DiscountAmount)

	actual := models.ProductActualCost{
		TenantID:             tenantID,
		ProductID:            input.ProductID,
		OrderID:              input.OrderID,
		OrderItemID:          input.OrderItemID,
		ActualPrintMinutes:   input.ActualPrintMinutes,
		ActualMaterialGrams:  input.ActualMaterialGrams,
		FailedMaterialGrams:  input.FailedMaterialGrams,
		MaterialCost:         materialCost,
		EnergyCost:           energyCost,
		PackagingCost:        input.PackagingCost,
		LaborCost:            input.LaborCost,
		ExtraCost:            input.ExtraCost,
		ShippingCost:         input.ShippingCost,
		MarketplaceFeeAmount: input.MarketplaceFeeAmount,
		DiscountAmount:       input.DiscountAmount,
		TotalCost:            totalCost,
		Notes:                input.Notes,
	}
	if err := database.DB.Create(&actual).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao salvar custo real"})
		return
	}
	c.JSON(http.StatusCreated, actual)
}

func (h *PricingHandler) CalculateScenario(c *gin.Context) {
	tenantID := getTenantID(c)
	var input models.PricingScenarioInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Dados invalidos: " + err.Error()})
		return
	}
	quantity := input.Quantity
	if quantity <= 0 {
		quantity = 1
	}
	base := input.Base
	if input.ProductID > 0 {
		var product models.Product
		if err := database.DB.Where("tenant_id = ? AND id = ?", tenantID, input.ProductID).First(&product).Error; err == nil {
			base.ProductWeightGrams = math.Max(base.ProductWeightGrams, parseWeightString(product.Weight))
			base.PrintMinutes = math.Max(base.PrintMinutes, parsePrintTimeString(product.PrintTime))
		}
	}

	scenarios := make([]gin.H, 0, len(input.PlatformFeeScenarios)+1)
	defaultInput, defaultResult := calculatePricingForTenant(tenantID, base)
	scenarios = append(scenarios, gin.H{
		"name":             "Padrao do tenant",
		"input":            defaultInput,
		"result":           defaultResult,
		"quantity":         quantity,
		"projected_profit": defaultResult.Profit * float64(quantity),
	})
	for _, platform := range input.PlatformFeeScenarios {
		scenarioInput := base
		scenarioInput.PlatformFeePercent = platform.PlatformFeePercent
		scenarioInput.PaymentFeePercent = platform.PaymentFeePercent
		scenarioInput.FixedFee = platform.FixedFee
		normalized, result := calculatePricingForTenant(tenantID, scenarioInput)
		scenarios = append(scenarios, gin.H{
			"name":             platform.Name,
			"input":            normalized,
			"result":           result,
			"quantity":         quantity,
			"projected_profit": result.Profit * float64(quantity),
		})
	}
	c.JSON(http.StatusOK, gin.H{"scenarios": scenarios})
}

func parseWeightString(value string) float64 {
	value = strings.ReplaceAll(value, ",", ".")
	for _, suffix := range []string{"gramas", "grams", "g"} {
		value = strings.ReplaceAll(strings.ToLower(value), suffix, "")
	}
	result, _ := strconv.ParseFloat(strings.TrimSpace(value), 64)
	return result
}

func parsePrintTimeString(value string) float64 {
	value = strings.ToLower(strings.TrimSpace(value))
	if strings.Contains(value, "h") {
		parts := strings.Split(value, "h")
		hours, _ := strconv.ParseFloat(strings.TrimSpace(parts[0]), 64)
		minutes := 0.0
		if len(parts) > 1 {
			minutes, _ = strconv.ParseFloat(strings.TrimSpace(strings.ReplaceAll(parts[1], "min", "")), 64)
		}
		return hours*60 + minutes
	}
	fields := strings.Fields(value)
	if len(fields) > 0 {
		number, _ := strconv.ParseFloat(strings.ReplaceAll(fields[0], ",", "."), 64)
		if strings.Contains(value, "hora") {
			return number * 60
		}
		return number
	}
	return 0
}

func (h *PricingHandler) SaveMaterialPreset(c *gin.Context) {
	tenantID := getTenantID(c)
	var input models.PresetInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Dados invalidos: " + err.Error()})
		return
	}
	preset := models.MaterialPreset{TenantID: tenantID, Name: input.Name, MaterialType: input.MaterialType, ColorName: input.ColorName, SpoolPrice: input.SpoolPrice, SpoolWeightGrams: input.SpoolWeightGrams, IsDefault: input.IsDefault, IsActive: input.IsActive}
	if preset.SpoolWeightGrams <= 0 {
		preset.SpoolWeightGrams = 1000
	}
	if err := database.DB.Create(&preset).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao salvar preset de material"})
		return
	}
	if preset.IsDefault {
		setDefaultPreset(tenantID, "material", preset.ID)
	}
	c.JSON(http.StatusCreated, preset)
}

func (h *PricingHandler) UpdateMaterialPreset(c *gin.Context) {
	tenantID := getTenantID(c)
	id, ok := parseIDParam(c, "preset_id")
	if !ok {
		return
	}
	var preset models.MaterialPreset
	if err := database.DB.Where("tenant_id = ? AND id = ?", tenantID, id).First(&preset).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Preset nao encontrado"})
		return
	}
	var input models.PresetInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Dados invalidos: " + err.Error()})
		return
	}
	preset.Name, preset.MaterialType, preset.ColorName = input.Name, input.MaterialType, input.ColorName
	preset.SpoolPrice, preset.SpoolWeightGrams, preset.IsActive, preset.IsDefault = input.SpoolPrice, input.SpoolWeightGrams, input.IsActive, input.IsDefault
	if err := database.DB.Save(&preset).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao atualizar preset"})
		return
	}
	if preset.IsDefault {
		setDefaultPreset(tenantID, "material", preset.ID)
	}
	c.JSON(http.StatusOK, preset)
}

func (h *PricingHandler) DeleteMaterialPreset(c *gin.Context) {
	tenantID := getTenantID(c)
	id, ok := parseIDParam(c, "preset_id")
	if !ok {
		return
	}
	database.DB.Where("tenant_id = ? AND id = ?", tenantID, id).Delete(&models.MaterialPreset{})
	c.JSON(http.StatusOK, gin.H{"message": "Preset removido"})
}

func (h *PricingHandler) SavePrinterPreset(c *gin.Context) {
	tenantID := getTenantID(c)
	var input models.PresetInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Dados invalidos: " + err.Error()})
		return
	}
	preset := models.PrinterPreset{TenantID: tenantID, Name: input.Name, PowerKW: input.PowerKW, IsDefault: input.IsDefault, IsActive: input.IsActive}
	if err := database.DB.Create(&preset).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao salvar impressora"})
		return
	}
	if preset.IsDefault {
		setDefaultPreset(tenantID, "printer", preset.ID)
	}
	c.JSON(http.StatusCreated, preset)
}

func (h *PricingHandler) UpdatePrinterPreset(c *gin.Context) {
	tenantID := getTenantID(c)
	id, ok := parseIDParam(c, "preset_id")
	if !ok {
		return
	}
	var preset models.PrinterPreset
	if err := database.DB.Where("tenant_id = ? AND id = ?", tenantID, id).First(&preset).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Preset nao encontrado"})
		return
	}
	var input models.PresetInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Dados invalidos: " + err.Error()})
		return
	}
	preset.Name, preset.PowerKW, preset.IsActive, preset.IsDefault = input.Name, input.PowerKW, input.IsActive, input.IsDefault
	if err := database.DB.Save(&preset).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao atualizar impressora"})
		return
	}
	if preset.IsDefault {
		setDefaultPreset(tenantID, "printer", preset.ID)
	}
	c.JSON(http.StatusOK, preset)
}

func (h *PricingHandler) DeletePrinterPreset(c *gin.Context) {
	tenantID := getTenantID(c)
	id, ok := parseIDParam(c, "preset_id")
	if !ok {
		return
	}
	database.DB.Where("tenant_id = ? AND id = ?", tenantID, id).Delete(&models.PrinterPreset{})
	c.JSON(http.StatusOK, gin.H{"message": "Preset removido"})
}

func (h *PricingHandler) SavePlatformPreset(c *gin.Context) {
	tenantID := getTenantID(c)
	var input models.PresetInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Dados invalidos: " + err.Error()})
		return
	}
	preset := models.PlatformFeePreset{TenantID: tenantID, Name: input.Name, PlatformFeePercent: input.PlatformFeePercent, PaymentFeePercent: input.PaymentFeePercent, FixedFee: input.FixedFee, IsDefault: input.IsDefault, IsActive: input.IsActive}
	if err := database.DB.Create(&preset).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao salvar canal"})
		return
	}
	if preset.IsDefault {
		setDefaultPreset(tenantID, "platform", preset.ID)
	}
	c.JSON(http.StatusCreated, preset)
}

func (h *PricingHandler) UpdatePlatformPreset(c *gin.Context) {
	tenantID := getTenantID(c)
	id, ok := parseIDParam(c, "preset_id")
	if !ok {
		return
	}
	var preset models.PlatformFeePreset
	if err := database.DB.Where("tenant_id = ? AND id = ?", tenantID, id).First(&preset).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Preset nao encontrado"})
		return
	}
	var input models.PresetInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Dados invalidos: " + err.Error()})
		return
	}
	preset.Name, preset.PlatformFeePercent, preset.PaymentFeePercent, preset.FixedFee, preset.IsActive, preset.IsDefault = input.Name, input.PlatformFeePercent, input.PaymentFeePercent, input.FixedFee, input.IsActive, input.IsDefault
	if err := database.DB.Save(&preset).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao atualizar canal"})
		return
	}
	if preset.IsDefault {
		setDefaultPreset(tenantID, "platform", preset.ID)
	}
	c.JSON(http.StatusOK, preset)
}

func (h *PricingHandler) DeletePlatformPreset(c *gin.Context) {
	tenantID := getTenantID(c)
	id, ok := parseIDParam(c, "preset_id")
	if !ok {
		return
	}
	database.DB.Where("tenant_id = ? AND id = ?", tenantID, id).Delete(&models.PlatformFeePreset{})
	c.JSON(http.StatusOK, gin.H{"message": "Preset removido"})
}
