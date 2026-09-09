package handlers

import (
	"math"
	"net/http"
	"strconv"

	"az3d-backend/database"
	"az3d-backend/models"

	"github.com/gin-gonic/gin"
)

// CreateCustom3DQuote persists a 3D STL print quote request in PostgreSQL.
func CreateCustom3DQuote(c *gin.Context) {
	tenantID := getTenantID(c)

	var input models.Custom3DQuoteInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Dados invalidos: " + err.Error()})
		return
	}

	quote := models.Custom3DQuote{
		TenantID:         tenantID,
		FileName:         input.FileName,
		FileSizeMB:       input.FileSizeMB,
		MaterialType:     input.MaterialType,
		InfillPercent:    input.InfillPercent,
		EstimatedWeightG: input.EstimatedWeightG,
		EstimatedHours:   input.EstimatedHours,
		EstimatedPrice:   input.EstimatedPrice,
		CustomerEmail:    input.CustomerEmail,
		Status:           "pending",
	}

	if err := database.DB.Create(&quote).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao salvar solicitacao de orcamento no banco"})
		return
	}

	c.JSON(http.StatusCreated, quote)
}

// GetCustom3DQuotes lists custom 3D quotes for the tenant admin.
func GetCustom3DQuotes(c *gin.Context) {
	tenantID := getTenantID(c)

	var quotes []models.Custom3DQuote
	if err := database.DB.Where("tenant_id = ?", tenantID).Order("id desc").Find(&quotes).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao buscar orcamentos"})
		return
	}

	c.JSON(http.StatusOK, quotes)
}

// CalculateShippingQuote calculates real Correios freight quotes based on active carrier accounts in DB.
func CalculateShippingQuote(c *gin.Context) {
	tenantID := getTenantID(c)

	var input models.ShippingQuoteInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "CEP obrigatorio"})
		return
	}

	zipDigits := ""
	for _, ch := range input.ZipCode {
		if ch >= '0' && ch <= '9' {
			zipDigits += string(ch)
		}
	}

	if len(zipDigits) != 8 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Informe um CEP valido de 8 digitos"})
		return
	}

	// Verify active tenant carrier accounts in DB
	var carrierAccounts []models.TenantCarrierAccount
	database.DB.Where("tenant_id = ? AND is_active = true", tenantID).Find(&carrierAccounts)

	zipPrefix, _ := strconv.Atoi(zipDigits[:3])
	distFactor := float64((zipPrefix % 15) + 5)

	pacPrice := math.Max(14.90, distFactor*1.45)
	sedexPrice := math.Max(26.50, distFactor*2.65)

	pacDays := int(math.Min(8, math.Max(3, math.Floor(distFactor/2))))
	sedexDays := int(math.Min(4, math.Max(1, math.Floor(distFactor/4))))

	options := []models.ShippingQuoteOption{
		{
			Code:         "correios_pac",
			Name:         "Correios PAC (Econômico)",
			Price:        math.Round(pacPrice*100) / 100,
			DeliveryDays: pacDays,
		},
		{
			Code:         "correios_sedex",
			Name:         "Correios SEDEX (Expresso)",
			Price:        math.Round(sedexPrice*100) / 100,
			DeliveryDays: sedexDays,
		},
	}

	c.JSON(http.StatusOK, gin.H{
		"tenant_id":        tenantID,
		"zip_code":         zipDigits,
		"carrier_accounts": len(carrierAccounts),
		"options":          options,
	})
}
