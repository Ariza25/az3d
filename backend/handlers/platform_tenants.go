package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"az3d-backend/database"
	"az3d-backend/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// DELETE /api/admin/platform/tenants/:tenant_id?confirm_slug=:slug
func (h *PlatformHandler) DeleteTenant(c *gin.Context) {
	if !isMasterAdmin(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Apenas master_admin pode excluir tenants"})
		return
	}

	tenantID64, err := strconv.ParseUint(strings.TrimSpace(c.Param("tenant_id")), 10, 64)
	if err != nil || tenantID64 == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tenant invalido"})
		return
	}
	tenantID := uint(tenantID64)

	var tenant models.Tenant
	if err := database.DB.First(&tenant, tenantID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Tenant nao encontrado"})
		return
	}
	if confirmSlug := strings.TrimSpace(c.Query("confirm_slug")); confirmSlug == "" || !strings.EqualFold(confirmSlug, tenant.Slug) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Confirme a exclusao informando confirm_slug com o slug exato do tenant"})
		return
	}

	var masterAdmins int64
	if err := database.DB.Model(&models.User{}).
		Where("tenant_id = ? AND role = ?", tenantID, "master_admin").
		Count(&masterAdmins).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao validar administradores do tenant"})
		return
	}
	if masterAdmins > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "Reassocie os usuarios master_admin a outro tenant antes da exclusao"})
		return
	}

	var tenantsCount int64
	if err := database.DB.Model(&models.Tenant{}).Count(&tenantsCount).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao validar quantidade de tenants"})
		return
	}
	if tenantsCount <= 1 {
		c.JSON(http.StatusConflict, gin.H{"error": "O ultimo tenant da plataforma nao pode ser excluido"})
		return
	}

	if err := database.DB.Transaction(func(tx *gorm.DB) error {
		return tx.Delete(&models.Tenant{}, tenantID).Error
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao excluir tenant e seus dados relacionados"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"deleted":     true,
		"tenant_id":   tenant.ID,
		"tenant_slug": tenant.Slug,
	})
}
