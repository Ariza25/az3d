package services_test

import (
	"math"
	"testing"

	"az3d-backend/internal/services"
	"az3d-backend/models"
)

func TestCalculatePrintingPricing_StandardValues(t *testing.T) {
	input := models.PricingCalculationInput{
		ProductWeightGrams:  100, // 100g
		SupportWeightGrams:  20,  // 20g support
		PrintMinutes:        120, // 2 hours
		SpoolPrice:          120, // R$ 120 / kg
		SpoolWeightGrams:    1000,
		PrinterPowerKW:      0.10, // 100W printer
		EnergyTariffPerKWh:  1.0,  // R$ 1.00 / kWh
		PackagingCost:       2.0,  // R$ 2.00
		LaborCost:           5.0,  // R$ 5.00
		ExtraCost:           1.0,  // R$ 1.00
		FailureRatePercent:  10,   // 10%
		MarginPercent:       50,   // 50%
		PlatformFeePercent:  10,   // 10%
		PaymentFeePercent:   5,    // 5%
		FixedFee:            2.0,  // R$ 2.00
	}

	result := services.CalculatePrintingPricing(input)

	// Material: 120g * (120/1000) = R$ 14.40
	expectedMaterialCost := 14.40
	if math.Abs(result.MaterialCost-expectedMaterialCost) > 0.01 {
		t.Errorf("expected MaterialCost %.2f, got %.2f", expectedMaterialCost, result.MaterialCost)
	}

	// Energy: (0.10 kW * 2 h) * R$ 1.00 = R$ 0.20
	expectedEnergyCost := 0.20
	if math.Abs(result.EnergyCost-expectedEnergyCost) > 0.01 {
		t.Errorf("expected EnergyCost %.2f, got %.2f", expectedEnergyCost, result.EnergyCost)
	}

	// Direct Cost: 14.40 + 0.20 = R$ 14.60
	expectedDirectCost := 14.60
	if math.Abs(result.DirectCost-expectedDirectCost) > 0.01 {
		t.Errorf("expected DirectCost %.2f, got %.2f", expectedDirectCost, result.DirectCost)
	}

	// Failure Reserve: 14.60 * 10% = R$ 1.46
	expectedFailureReserve := 1.46
	if math.Abs(result.FailureReserve-expectedFailureReserve) > 0.01 {
		t.Errorf("expected FailureReserve %.2f, got %.2f", expectedFailureReserve, result.FailureReserve)
	}

	// Operational Cost: 14.60 + 1.46 + 2.0 + 5.0 + 1.0 = R$ 24.06
	expectedOperationalCost := 24.06
	if math.Abs(result.OperationalCost-expectedOperationalCost) > 0.01 {
		t.Errorf("expected OperationalCost %.2f, got %.2f", expectedOperationalCost, result.OperationalCost)
	}

	// Target Net Revenue: 24.06 * (1 + 0.50) = R$ 36.09
	expectedTargetNetRevenue := 36.09
	if math.Abs(result.TargetNetRevenue-expectedTargetNetRevenue) > 0.01 {
		t.Errorf("expected TargetNetRevenue %.2f, got %.2f", expectedTargetNetRevenue, result.TargetNetRevenue)
	}

	// Variable Fee Rate: (10% + 5%) = 15% (0.15)
	// Suggested Price: (36.09 + 2.00) / (1 - 0.15) = 38.09 / 0.85 = R$ 44.81176...
	expectedSuggestedPrice := 38.09 / 0.85
	if math.Abs(result.SuggestedPrice-expectedSuggestedPrice) > 0.01 {
		t.Errorf("expected SuggestedPrice %.2f, got %.2f", expectedSuggestedPrice, result.SuggestedPrice)
	}

	if result.Profit <= 0 {
		t.Errorf("expected positive profit, got %.2f", result.Profit)
	}
}

func TestCalculatePrintingPricing_ZeroAndNegativeClamping(t *testing.T) {
	input := models.PricingCalculationInput{
		ProductWeightGrams: -50,
		SupportWeightGrams: -10,
		PrintMinutes:       -60,
		SpoolPrice:         -100,
		SpoolWeightGrams:   1000,
	}

	result := services.CalculatePrintingPricing(input)

	if result.TotalMaterialGrams != 0 {
		t.Errorf("expected clamped TotalMaterialGrams 0, got %.2f", result.TotalMaterialGrams)
	}
	if result.EnergyCost != 0 {
		t.Errorf("expected clamped EnergyCost 0, got %.2f", result.EnergyCost)
	}
	if result.DirectCost != 0 {
		t.Errorf("expected DirectCost 0, got %.2f", result.DirectCost)
	}
}
