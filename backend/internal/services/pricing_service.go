package services

import (
	"errors"
	"math"
	"sort"
	"strings"
	"time"

	"az3d-backend/models"

	"gorm.io/gorm"
)

type PricingService struct {
	db *gorm.DB
}

func NewPricingService(db *gorm.DB) *PricingService {
	return &PricingService{db: db}
}

// CalculatePrintingPricing is a pure domain function that calculates the detailed 3D print costs.
func CalculatePrintingPricing(input models.PricingCalculationInput) models.PricingCalculationResult {
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

func (s *PricingService) GetOrCreateTenantPricingSettings(tenantID uint) (models.TenantPricingSettings, error) {
	var pricing models.TenantPricingSettings
	if s.db == nil {
		return pricing, errors.New("db connection is nil")
	}
	err := s.db.Where("tenant_id = ?", tenantID).First(&pricing).Error
	if err == nil {
		return pricing, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return pricing, err
	}

	var legacy models.TenantSettings
	_ = s.db.Where("tenant_id = ?", tenantID).First(&legacy).Error

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
	if pricing.DefaultSpoolPrice <= 0 {
		pricing.DefaultSpoolPrice = 120
	}
	if pricing.DefaultSpoolWeight <= 0 {
		pricing.DefaultSpoolWeight = 1000
	}
	if pricing.DefaultPrinterPowerKW <= 0 {
		pricing.DefaultPrinterPowerKW = 0.07
	}
	if pricing.DefaultEnergyTariff <= 0 {
		pricing.DefaultEnergyTariff = 1
	}
	if pricing.DefaultFailureRatePct <= 0 {
		pricing.DefaultFailureRatePct = 8
	}
	if pricing.DefaultMarginPct <= 0 {
		pricing.DefaultMarginPct = 60
	}

	err = s.db.Create(&pricing).Error
	return pricing, err
}

func (s *PricingService) ApplyTenantPricingDefaults(tenantID uint, input models.PricingCalculationInput) models.PricingCalculationInput {
	pricing, _ := s.GetOrCreateTenantPricingSettings(tenantID)

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

	if s.db != nil {
		if input.MaterialPresetID > 0 {
			var material models.MaterialPreset
			if err := s.db.Where("tenant_id = ? AND id = ? AND is_active = ?", tenantID, input.MaterialPresetID, true).First(&material).Error; err == nil {
				input.SpoolPrice = material.SpoolPrice
				input.SpoolWeightGrams = material.SpoolWeightGrams
			}
		}
		if input.PrinterPresetID > 0 {
			var printer models.PrinterPreset
			if err := s.db.Where("tenant_id = ? AND id = ? AND is_active = ?", tenantID, input.PrinterPresetID, true).First(&printer).Error; err == nil {
				input.PrinterPowerKW = printer.PowerKW
			}
		}
		if input.PlatformFeePresetID > 0 {
			var platform models.PlatformFeePreset
			if err := s.db.Where("tenant_id = ? AND id = ? AND is_active = ?", tenantID, input.PlatformFeePresetID, true).First(&platform).Error; err == nil {
				input.PlatformFeePercent = platform.PlatformFeePercent
				input.PaymentFeePercent = platform.PaymentFeePercent
				input.FixedFee = platform.FixedFee
			}
		}
	}

	return input
}

func (s *PricingService) CalculatePricingForTenant(tenantID uint, input models.PricingCalculationInput) (models.PricingCalculationInput, models.PricingCalculationResult) {
	normalizedInput := s.ApplyTenantPricingDefaults(tenantID, input)
	return normalizedInput, CalculatePrintingPricing(normalizedInput)
}

func (s *PricingService) CreateProductPricingSnapshot(tenantID uint, productID uint, input models.PricingCalculationInput) error {
	if s.db == nil {
		return errors.New("db connection is nil")
	}
	normalizedInput, result := s.CalculatePricingForTenant(tenantID, input)
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
	return s.db.Create(&snapshot).Error
}

func (s *PricingService) LatestSnapshotsByProduct(tenantID uint, productIDs []uint) map[uint]models.ProductPricingSnapshot {
	snapshots := map[uint]models.ProductPricingSnapshot{}
	if len(productIDs) == 0 || s.db == nil {
		return snapshots
	}

	var rows []models.ProductPricingSnapshot
	s.db.Where("tenant_id = ? AND product_id IN ?", tenantID, productIDs).Order("created_at desc").Find(&rows)
	for _, row := range rows {
		if _, exists := snapshots[row.ProductID]; !exists {
			snapshots[row.ProductID] = row
		}
	}
	return snapshots
}

func (s *PricingService) SummarizeFinancials(tenantID uint) (models.FinancialSummary, error) {
	if s.db == nil {
		return models.FinancialSummary{}, errors.New("db connection is nil")
	}

	var orders []models.Order
	s.db.Preload("Items.Product").Where("tenant_id = ? AND status <> ?", tenantID, "cancelled").Find(&orders)
	var externalOrders []models.ExternalMarketplaceOrder
	s.db.Preload("Items.Product").Where("tenant_id = ? AND external_status <> ?", tenantID, "cancelled").Find(&externalOrders)

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

	snapshots := s.LatestSnapshotsByProduct(tenantID, productIDs)
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

	normalizeProvider := func(p string) string {
		p = strings.TrimSpace(strings.ToLower(p))
		if strings.Contains(p, "mercadolivre") || strings.Contains(p, "meli") {
			return "mercadolivre"
		}
		if strings.Contains(p, "shopee") {
			return "shopee"
		}
		if strings.Contains(p, "amazon") {
			return "amazon"
		}
		return p
	}

	parseSummaryDate := func(val string) time.Time {
		t, _ := time.Parse(time.RFC3339, val)
		return t
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
	s.db.Where("tenant_id = ?", tenantID).Find(&actualCosts)
	for _, actual := range actualCosts {
		summary.ActualCosts += actual.TotalCost
		if productSummary, exists := products[actual.ProductID]; exists {
			productSummary.ActualCost += actual.TotalCost
		}
	}

	var fixedCosts []models.TenantFixedCost
	s.db.Where("tenant_id = ? AND is_active = ?", tenantID, true).Find(&fixedCosts)
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
	summary.Channels = channelSummaries

	return summary, nil
}
