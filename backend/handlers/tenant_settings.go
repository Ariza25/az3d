package handlers

import (
	"errors"
	"net/http"

	"az3d-backend/database"
	"az3d-backend/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type TenantSettingsHandler struct{}

func NewTenantSettingsHandler() *TenantSettingsHandler {
	return &TenantSettingsHandler{}
}

func defaultTenantSettings(tenantID uint) models.TenantSettings {
	return models.TenantSettings{
		TenantID:              tenantID,
		PrimaryColor:          "#22d3ee",
		AccentColor:           "#ffffff",
		DefaultSpoolPrice:     120,
		DefaultSpoolWeight:    1000,
		DefaultPrinterPowerKW: 0.07,
		DefaultEnergyTariff:   1,
		DefaultPackagingCost:  1.5,
		DefaultLaborCost:      0,
		DefaultExtraCost:      0,
		DefaultFailureRatePct: 8,
		DefaultMarginPct:      60,
		DefaultPlatformFeePct: 12,
		DefaultPaymentFeePct:  4.99,
		DefaultFixedFee:       0,
		DeliveryPickupEnabled: true,
		DeliveryShipEnabled:   true,
	}
}

func getOrCreateTenantSettings(tenantID uint) (models.TenantSettings, error) {
	var settings models.TenantSettings
	err := database.DB.Where("tenant_id = ?", tenantID).First(&settings).Error
	if err == nil {
		return settings, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return settings, err
	}

	settings = defaultTenantSettings(tenantID)
	err = database.DB.Create(&settings).Error
	return settings, err
}

func (h *TenantSettingsHandler) GetTenantSettings(c *gin.Context) {
	tenantID := getTenantID(c)
	settings, err := tenantSettingsFromDomains(tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao carregar configuracoes da loja"})
		return
	}

	c.JSON(http.StatusOK, settings)
}

func (h *TenantSettingsHandler) UpdateTenantSettings(c *gin.Context) {
	tenantID := getTenantID(c)
	var input models.TenantSettingsInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Dados invalidos: " + err.Error()})
		return
	}

	settings, err := syncTenantSettingsDomains(tenantID, input)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao salvar configuracoes da loja"})
		return
	}

	if settings.StoreName != "" || settings.LogoURL != "" {
		updates := map[string]interface{}{}
		if settings.StoreName != "" {
			updates["name"] = settings.StoreName
		}
		if settings.LogoURL != "" {
			updates["logo_url"] = settings.LogoURL
		}
		database.DB.Model(&models.Tenant{}).Where("id = ?", tenantID).Updates(updates)
	}

	c.JSON(http.StatusOK, settings)
}
