package handlers

import (
	"net/http"
	"strconv"

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
