package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"az3d-backend/database"
	"az3d-backend/models"

	"github.com/gin-gonic/gin"
)

type TenantHandler struct{}

func NewTenantHandler() *TenantHandler {
	return &TenantHandler{}
}

// GET /api/tenants
func (h *TenantHandler) GetTenants(c *gin.Context) {
	var tenants []models.Tenant
	if err := database.DB.Find(&tenants).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao buscar lista de tenants"})
		return
	}
	c.JSON(http.StatusOK, tenants)
}

// GET /api/tenants/:identifier
func (h *TenantHandler) GetTenantByIdentifier(c *gin.Context) {
	identifier := strings.TrimSpace(strings.ToLower(c.Param("identifier")))
	if identifier == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Identificador da loja nao informado"})
		return
	}

	var tenant models.Tenant
	query := database.DB.Where("LOWER(slug) = ? OR LOWER(domain) = ?", identifier, identifier)
	if id, err := strconv.ParseUint(identifier, 10, 64); err == nil {
		query = database.DB.Where("LOWER(slug) = ? OR LOWER(domain) = ? OR id = ?", identifier, identifier, id)
	}

	if err := query.First(&tenant).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Loja nao encontrada"})
		return
	}

	c.JSON(http.StatusOK, tenant)
}
