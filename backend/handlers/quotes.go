package handlers

import (
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"strconv"
	"strings"

	"az3d-backend/config"
	"az3d-backend/database"
	"az3d-backend/internal/carriers/superfrete"
	"az3d-backend/internal/stlparser"
	"az3d-backend/models"
	"az3d-backend/utils"

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

// CalculateShippingQuote calculates real SuperFrete freight quotes (PAC, SEDEX, Mini Envios).
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

	cfg := config.LoadConfig()
	token := cfg.SuperFreteToken

	if input.TenantID != nil && *input.TenantID > 0 {
		tenantID = *input.TenantID
	} else if input.ProductID != nil && *input.ProductID > 0 {
		var prod models.Product
		if err := database.DB.Select("tenant_id").First(&prod, *input.ProductID).Error; err == nil && prod.TenantID > 0 {
			tenantID = prod.TenantID
		}
	}

	// 1. Resolver CEP de origem, token e configurações de pacote/expedição do Tenant
	originCEP := ""
	pkgFormat := "box"
	pkgHeight := 20
	pkgWidth := 20
	pkgLength := 20
	pkgWeight := 0.3
	ownHand := false
	receipt := false
	useInsurance := false
	insuranceValue := 0.0
	additionalDays := 0
	services := "1,2,17"

	// 1a. Buscar na conta de transportadora ativa do tenant (priorizando superfrete)
	var carrierAcct models.TenantCarrierAccount
	if err := database.DB.Where("tenant_id = ? AND is_active = ?", tenantID, true).
		Order("CASE WHEN provider = 'superfrete' THEN 0 ELSE 1 END").
		First(&carrierAcct).Error; err == nil {
		if carrierAcct.OriginCEP != "" {
			originCEP = cleanDigits(carrierAcct.OriginCEP)
		}
	}

	// Se a conta tiver credenciais criptografadas com configurações e token próprio, descriptografa
	if carrierAcct.ID > 0 && carrierAcct.EncryptedCredentials != "" && cfg.CredentialEncryptionKey != "" {
		if decrypted, err := utils.DecryptString(carrierAcct.EncryptedCredentials, cfg.CredentialEncryptionKey); err == nil {
			var creds map[string]any
			if json.Unmarshal([]byte(decrypted), &creds) == nil {
				if t, ok := creds["access_token"].(string); ok && strings.TrimSpace(t) != "" {
					token = strings.TrimSpace(t)
				} else if t, ok := creds["token"].(string); ok && strings.TrimSpace(t) != "" {
					token = strings.TrimSpace(t)
				}
				if originCEP == "" {
					if c, ok := creds["origin_cep"].(string); ok && strings.TrimSpace(c) != "" {
						originCEP = cleanDigits(c)
					}
				}
				if f, ok := creds["package_format"].(string); ok && strings.TrimSpace(f) != "" {
					pkgFormat = strings.TrimSpace(f)
				}
				if h := parseAnyInt(creds["package_height"]); h > 0 {
					pkgHeight = h
				} else if h := parseAnyInt(creds["height"]); h > 0 {
					pkgHeight = h
				}
				if w := parseAnyInt(creds["package_width"]); w > 0 {
					pkgWidth = w
				} else if w := parseAnyInt(creds["width"]); w > 0 {
					pkgWidth = w
				}
				if l := parseAnyInt(creds["package_length"]); l > 0 {
					pkgLength = l
				} else if l := parseAnyInt(creds["length"]); l > 0 {
					pkgLength = l
				}
				if wg := parseAnyFloat(creds["package_weight"]); wg > 0 {
					pkgWeight = wg
				} else if wgg := parseAnyFloat(creds["package_weight_grams"]); wgg > 0 {
					pkgWeight = wgg / 1000.0
				}
				if oh, ok := creds["own_hand"].(bool); ok {
					ownHand = oh
				}
				if rc, ok := creds["receipt"].(bool); ok {
					receipt = rc
				}
				if ins, ok := creds["use_insurance_value"].(bool); ok {
					useInsurance = ins
				}
				if iv := parseAnyFloat(creds["insurance_value"]); iv > 0 {
					insuranceValue = iv
				}
				if ad := parseAnyInt(creds["additional_days"]); ad > 0 {
					additionalDays = ad
				}
				if s, ok := creds["services"].(string); ok && strings.TrimSpace(s) != "" {
					services = strings.TrimSpace(s)
				}
			}
		}
	}

	// 1b. Se não encontrou na transportadora, buscar em TenantFulfillmentSettings
	if originCEP == "" {
		var fulfillment models.TenantFulfillmentSettings
		if err := database.DB.Where("tenant_id = ?", tenantID).First(&fulfillment).Error; err == nil && fulfillment.OriginCEP != "" {
			originCEP = cleanDigits(fulfillment.OriginCEP)
		}
	}

	// 1c. Se não encontrou, buscar em TenantSettings
	if originCEP == "" {
		var settings models.TenantSettings
		if err := database.DB.Where("tenant_id = ?", tenantID).First(&settings).Error; err == nil && settings.OriginCEP != "" {
			originCEP = cleanDigits(settings.OriginCEP)
		}
	}

	// 1d. Fallbacks finais: env SUPER_FRETE_ORIGIN_CEP ou padrão
	if originCEP == "" {
		originCEP = cleanDigits(cfg.SuperFreteOriginCEP)
	}
	if originCEP == "" || len(originCEP) != 8 {
		originCEP = "01310100"
	}

	// Se seguro estiver ativo e nenhum valor declarado fixado, usar valor do produto
	if useInsurance && insuranceValue <= 0 && input.ProductID != nil && *input.ProductID > 0 {
		var prod models.Product
		if err := database.DB.Select("price").First(&prod, *input.ProductID).Error; err == nil && prod.Price > 0 {
			insuranceValue = prod.Price
		}
	}

	// 2. Tentar cotação oficial em tempo real via API do SuperFrete
	if token != "" {
		sfClient := superfrete.New(cfg.SuperFreteAPIBaseURL, token)
		sfOptions, err := sfClient.CalculateQuotesAdvanced(
			c.Request.Context(),
			originCEP,
			zipDigits,
			superfrete.PackageInfo{
				Format: pkgFormat,
				Weight: pkgWeight,
				Height: pkgHeight,
				Width:  pkgWidth,
				Length: pkgLength,
			},
			superfrete.QuoteOptions{
				OwnHand:           ownHand,
				Receipt:           receipt,
				UseInsuranceValue: useInsurance,
				InsuranceValue:    insuranceValue,
				Services:          services,
				AdditionalDays:    additionalDays,
			},
		)
		if err == nil && len(sfOptions) > 0 {
			options := make([]models.ShippingQuoteOption, 0, len(sfOptions))
			for _, opt := range sfOptions {
				options = append(options, models.ShippingQuoteOption{
					Code:         opt.Code,
					Name:         opt.Name,
					Price:        opt.Price,
					DeliveryDays: opt.DeliveryDays,
				})
			}

			c.JSON(http.StatusOK, gin.H{
				"tenant_id":        tenantID,
				"zip_code":         zipDigits,
				"origin_zip_code":  originCEP,
				"provider":         "superfrete",
				"carrier_accounts": 1,
				"options":          options,
			})
			return
		}
	}

	// 2. Fallback de contingência caso a API externa sofra instabilidade
	zipPrefix, _ := strconv.Atoi(zipDigits[:3])
	distFactor := float64((zipPrefix % 15) + 5)

	pacPrice := math.Max(14.90, distFactor*1.45)
	sedexPrice := math.Max(26.50, distFactor*2.65)

	pacDays := int(math.Min(8, math.Max(3, math.Floor(distFactor/2))))
	sedexDays := int(math.Min(4, math.Max(1, math.Floor(distFactor/4))))

	options := []models.ShippingQuoteOption{
		{
			Code:         "superfrete_pac",
			Name:         "SuperFrete PAC (Correios)",
			Price:        math.Round(pacPrice*100) / 100,
			DeliveryDays: pacDays,
		},
		{
			Code:         "superfrete_sedex",
			Name:         "SuperFrete SEDEX (Correios)",
			Price:        math.Round(sedexPrice*100) / 100,
			DeliveryDays: sedexDays,
		},
	}

	c.JSON(http.StatusOK, gin.H{
		"tenant_id":        tenantID,
		"zip_code":         zipDigits,
		"origin_zip_code":  originCEP,
		"provider":         "superfrete_fallback",
		"carrier_accounts": 1,
		"options":          options,
	})
}

// ParseSTLFile analyzes uploaded .stl 3D mesh and computes volume, dimensions, weight, and price
func ParseSTLFile(c *gin.Context) {
	fileHeader, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Arquivo .STL obrigatório no campo 'file'"})
		return
	}

	file, err := fileHeader.Open()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Falha ao abrir arquivo enviado: " + err.Error()})
		return
	}
	defer file.Close()

	mesh, err := stlparser.ParseSTL(file)
	if err != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": "Não foi possível processar a malha 3D: " + err.Error()})
		return
	}

	material := c.PostForm("material_type")
	infillStr := c.PostForm("infill_percent")
	infill, _ := strconv.Atoi(infillStr)

	sliceResult := stlparser.CalculateWeightAndHours(mesh, material, infill)
	c.JSON(http.StatusOK, sliceResult)
}

func parseAnyInt(val any) int {
	if val == nil {
		return 0
	}
	switch v := val.(type) {
	case int:
		return v
	case int64:
		return int(v)
	case float64:
		return int(v)
	case string:
		var parsed int
		if _, err := fmt.Sscanf(strings.TrimSpace(v), "%d", &parsed); err == nil {
			return parsed
		}
	}
	return 0
}

func parseAnyFloat(val any) float64 {
	if val == nil {
		return 0
	}
	switch v := val.(type) {
	case float64:
		return v
	case float32:
		return float64(v)
	case int:
		return float64(v)
	case int64:
		return float64(v)
	case string:
		var parsed float64
		s := strings.ReplaceAll(strings.TrimSpace(v), ",", ".")
		if _, err := fmt.Sscanf(s, "%f", &parsed); err == nil {
			return parsed
		}
	}
	return 0
}

