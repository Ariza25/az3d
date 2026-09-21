package handlers

import (
	"fmt"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"az3d-backend/database"
	"az3d-backend/models"

	"github.com/gin-gonic/gin"
)

// GetFilamentSpools returns filament spools for the authenticated tenant.
func GetFilamentSpools(c *gin.Context) {
	tenantID := getTenantID(c)

	var spools []models.FilamentSpool
	if err := database.DB.Where("tenant_id = ?", tenantID).Order("id desc").Find(&spools).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao buscar insumos/filamentos do tenant"})
		return
	}

	c.JSON(http.StatusOK, spools)
}

// CreateFilamentSpool creates a new filament spool in PostgreSQL.
func CreateFilamentSpool(c *gin.Context) {
	tenantID := getTenantID(c)

	var input models.FilamentSpoolInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Dados invalidos: " + err.Error()})
		return
	}

	isActive := true
	if input.IsActive != nil {
		isActive = *input.IsActive
	}

	spool := models.FilamentSpool{
		TenantID:         tenantID,
		Name:             input.Name,
		MaterialType:     input.MaterialType,
		ColorName:        input.ColorName,
		ColorHex:         input.ColorHex,
		SpoolWeightG:     input.SpoolWeightG,
		RemainingWeightG: input.RemainingWeightG,
		PricePerKG:       input.PricePerKG,
		Vendor:           input.Vendor,
		IsActive:         isActive,
	}

	if spool.SpoolWeightG <= 0 {
		spool.SpoolWeightG = 1000
	}
	if spool.RemainingWeightG <= 0 {
		spool.RemainingWeightG = spool.SpoolWeightG
	}
	if spool.ColorHex == "" {
		spool.ColorHex = "#3b82f6"
	}

	if err := database.DB.Create(&spool).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao cadastrar insumo no banco: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, spool)
}

// UpdateFilamentSpool updates a filament spool in PostgreSQL.
func UpdateFilamentSpool(c *gin.Context) {
	tenantID := getTenantID(c)

	idParam := c.Param("id")
	spoolID, err := strconv.ParseUint(idParam, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID de insumo invalido"})
		return
	}

	var spool models.FilamentSpool
	if err := database.DB.Where("id = ? AND tenant_id = ?", spoolID, tenantID).First(&spool).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Insumo nao encontrado"})
		return
	}

	var input models.FilamentSpoolInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Dados invalidos: " + err.Error()})
		return
	}

	if input.Name != "" {
		spool.Name = input.Name
	}
	if input.MaterialType != "" {
		spool.MaterialType = input.MaterialType
	}
	if input.ColorName != "" {
		spool.ColorName = input.ColorName
	}
	if input.ColorHex != "" {
		spool.ColorHex = input.ColorHex
	}
	if input.SpoolWeightG > 0 {
		spool.SpoolWeightG = input.SpoolWeightG
	}
	if input.RemainingWeightG >= 0 {
		spool.RemainingWeightG = input.RemainingWeightG
	}
	if input.PricePerKG > 0 {
		spool.PricePerKG = input.PricePerKG
	}
	if input.Vendor != "" {
		spool.Vendor = input.Vendor
	}
	if input.IsActive != nil {
		spool.IsActive = *input.IsActive
	}

	if err := database.DB.Save(&spool).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao atualizar insumo"})
		return
	}

	c.JSON(http.StatusOK, spool)
}

// DeleteFilamentSpool deletes a filament spool from PostgreSQL.
func DeleteFilamentSpool(c *gin.Context) {
	tenantID := getTenantID(c)

	idParam := c.Param("id")
	spoolID, err := strconv.ParseUint(idParam, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID de insumo invalido"})
		return
	}

	if err := database.DB.Where("id = ? AND tenant_id = ?", spoolID, tenantID).Delete(&models.FilamentSpool{}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao excluir insumo do banco"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Insumo excluido com sucesso"})
}

// OrderFilamentItemCheck holds comparison between order item requirement and matching spool.
type OrderFilamentItemCheck struct {
	OrderItemID         uint    `json:"order_item_id"`
	ProductID           uint    `json:"product_id"`
	ProductTitle        string  `json:"product_title"`
	ProductImage        string  `json:"product_image"`
	Color               string  `json:"color"`
	Material            string  `json:"material"`
	Quantity            int     `json:"quantity"`
	UnitWeightGrams     float64 `json:"unit_weight_grams"`
	TotalRequiredGrams  float64 `json:"total_required_grams"`
	MatchingSpoolID     *uint   `json:"matching_spool_id"`
	MatchingSpoolName   string  `json:"matching_spool_name"`
	MatchingSpoolVendor string  `json:"matching_spool_vendor"`
	SpoolRemainingGrams float64 `json:"spool_remaining_grams"`
	IsSufficient        bool    `json:"is_sufficient"`
	MissingGrams        float64 `json:"missing_grams"`
}

// OrderFilamentCheckResponse represents pre-flight filament inventory check for an order.
type OrderFilamentCheckResponse struct {
	OrderID    uint                     `json:"order_id"`
	CanProduce bool                     `json:"can_produce"`
	Items      []OrderFilamentItemCheck `json:"items"`
	Warnings   []string                 `json:"warnings"`
}

// CheckOrderFilament evaluates whether the tenant has enough active filament to print this order.
func CheckOrderFilament(c *gin.Context) {
	tenantID := getTenantID(c)
	orderIDStr := c.Param("orderId")

	var order models.Order
	if err := database.DB.
		Preload("Items.Product").
		Where("id = ? AND tenant_id = ?", orderIDStr, tenantID).
		First(&order).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Pedido não encontrado"})
		return
	}

	var spools []models.FilamentSpool
	_ = database.DB.Where("tenant_id = ? AND is_active = true", tenantID).Find(&spools)

	response := OrderFilamentCheckResponse{
		OrderID:    order.ID,
		CanProduce: true,
		Items:      make([]OrderFilamentItemCheck, 0, len(order.Items)),
		Warnings:   make([]string, 0),
	}

	for _, item := range order.Items {
		unitWeight := 100.0
		productTitle := "Produto 3D"
		productImg := ""
		itemMaterial := "PLA"

		if item.Product != nil {
			productTitle = item.Product.Title
			productImg = item.Product.ImageURL
			if item.Product.Material != "" {
				itemMaterial = item.Product.Material
			}
			if parsed := parseWeightString(item.Product.Weight); parsed > 0 {
				unitWeight = parsed
			}
		}

		qty := item.Quantity
		if qty <= 0 {
			qty = 1
		}
		totalGrams := unitWeight * float64(qty)

		// Search matching spool
		var matched *models.FilamentSpool
		itemColorLower := strings.ToLower(strings.TrimSpace(item.Color))
		itemMaterialLower := strings.ToLower(strings.TrimSpace(itemMaterial))

		// 1. Exact or partial color + material match
		if itemColorLower != "" {
			for i := range spools {
				sColor := strings.ToLower(strings.TrimSpace(spools[i].ColorName))
				sMat := strings.ToLower(strings.TrimSpace(spools[i].MaterialType))
				if (strings.Contains(sColor, itemColorLower) || strings.Contains(itemColorLower, sColor)) &&
					(strings.Contains(sMat, itemMaterialLower) || strings.Contains(itemMaterialLower, sMat)) {
					matched = &spools[i]
					break
				}
			}

			// 2. Color match only (if material didn't match exactly)
			if matched == nil {
				for i := range spools {
					sColor := strings.ToLower(strings.TrimSpace(spools[i].ColorName))
					if strings.Contains(sColor, itemColorLower) || strings.Contains(itemColorLower, sColor) {
						matched = &spools[i]
						break
					}
				}
			}
		} else {
			// If no specific color was requested on the order item, match by material
			for i := range spools {
				sMat := strings.ToLower(strings.TrimSpace(spools[i].MaterialType))
				if strings.Contains(sMat, itemMaterialLower) || strings.Contains(itemMaterialLower, sMat) {
					matched = &spools[i]
					break
				}
			}
		}

		itemCheck := OrderFilamentItemCheck{
			OrderItemID:        item.ID,
			ProductID:          item.ProductID,
			ProductTitle:       productTitle,
			ProductImage:       productImg,
			Color:              item.Color,
			Material:           itemMaterial,
			Quantity:           qty,
			UnitWeightGrams:    unitWeight,
			TotalRequiredGrams: totalGrams,
		}

		if matched != nil {
			spoolCopyID := matched.ID
			itemCheck.MatchingSpoolID = &spoolCopyID
			itemCheck.MatchingSpoolName = matched.Name
			itemCheck.MatchingSpoolVendor = matched.Vendor
			itemCheck.SpoolRemainingGrams = matched.RemainingWeightG

			if matched.RemainingWeightG >= totalGrams {
				itemCheck.IsSufficient = true
				itemCheck.MissingGrams = 0
			} else {
				itemCheck.IsSufficient = false
				itemCheck.MissingGrams = totalGrams - matched.RemainingWeightG
				response.CanProduce = false

				warn := fmt.Sprintf("Atenção: filamento insuficiente no carretel ativo '%s'! Necessário: %.0fg | Disponível: %.0fg (Faltam %.0fg)",
					matched.Name, totalGrams, matched.RemainingWeightG, itemCheck.MissingGrams)
				response.Warnings = append(response.Warnings, warn)
			}
		} else {
			itemCheck.IsSufficient = false
			itemCheck.MissingGrams = totalGrams
			response.CanProduce = false

			warn := fmt.Sprintf("Nenhum carretel ativo cadastrado para '%s' (%s). Necessário: %.0fg.", item.Color, itemMaterial, totalGrams)
			response.Warnings = append(response.Warnings, warn)
		}

		response.Items = append(response.Items, itemCheck)
	}

	c.JSON(http.StatusOK, response)
}

// DeductFilament deducts weight from a spool and creates an audit usage log.
func DeductFilament(c *gin.Context) {
	tenantID := getTenantID(c)

	var input models.DeductFilamentInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Dados inválidos: " + err.Error()})
		return
	}

	if input.Grams <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Quantidade de gramas deve ser maior que 0"})
		return
	}

	var spool models.FilamentSpool
	if err := database.DB.Where("id = ? AND tenant_id = ?", input.SpoolID, tenantID).First(&spool).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Carretel não encontrado"})
		return
	}

	tx := database.DB.Begin()
	newRemaining := math.Max(0, spool.RemainingWeightG-input.Grams)
	if err := tx.Model(&spool).Update("remaining_weight_g", newRemaining).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao abater peso do carretel"})
		return
	}

	desc := input.Description
	if desc == "" {
		if input.OrderID != nil {
			desc = fmt.Sprintf("Abate de produção - Pedido #%d", *input.OrderID)
		} else {
			desc = "Abate manual de filamento"
		}
	}

	usageLog := models.FilamentUsageLog{
		TenantID:    tenantID,
		SpoolID:     spool.ID,
		OrderID:     input.OrderID,
		GramsUsed:   input.Grams,
		Description: desc,
		CreatedAt:   time.Now(),
	}
	if err := tx.Create(&usageLog).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao salvar log de consumo"})
		return
	}

	tx.Commit()
	spool.RemainingWeightG = newRemaining

	c.JSON(http.StatusOK, gin.H{
		"message": "Filamento abatido com sucesso",
		"spool":   spool,
		"log":     usageLog,
	})
}

// GetFilamentSpoolLogs returns consumption history for a given spool.
func GetFilamentSpoolLogs(c *gin.Context) {
	tenantID := getTenantID(c)
	spoolIDParam := c.Param("id")

	spoolID, err := strconv.ParseUint(spoolIDParam, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID de carretel inválido"})
		return
	}

	var logs []models.FilamentUsageLog
	if err := database.DB.Where("spool_id = ? AND tenant_id = ?", spoolID, tenantID).
		Order("id desc").
		Limit(50).
		Find(&logs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao buscar histórico de consumo"})
		return
	}

	c.JSON(http.StatusOK, logs)
}
