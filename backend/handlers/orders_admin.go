package handlers

import (
	"net/http"

	"az3d-backend/database"
	"az3d-backend/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func (h *OrderHandler) GetAllOrders(c *gin.Context) {
	tenantID := getTenantID(c)

	var orders []models.Order
	if err := database.DB.
		Preload("User").
		Preload("Items.Product").
		Preload("Shipments.Events", func(db *gorm.DB) *gorm.DB { return db.Order("occurred_at desc") }).
		Where("tenant_id = ?", tenantID).
		Order("created_at desc").
		Find(&orders).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao carregar lista de pedidos do tenant"})
		return
	}

	c.JSON(http.StatusOK, orders)
}

func (h *OrderHandler) UpdateOrderStatus(c *gin.Context) {
	tenantID := getTenantID(c)
	idStr := c.Param("id")

	var order models.Order
	if err := database.DB.Where("tenant_id = ?", tenantID).First(&order, idStr).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Pedido nao encontrado"})
		return
	}

	var input models.UpdateOrderStatusInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Status invalido"})
		return
	}
	validStatuses := map[string]bool{
		"pending_confirmation": true,
		"pending_payment":      true,
		"paid":                 true,
		"preparing":            true,
		"delivered":            true,
		"cancelled":            true,
	}
	if !validStatuses[input.Status] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Status de pedido nao suportado"})
		return
	}

	order.Status = input.Status
	if err := database.DB.Save(&order).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao atualizar status do pedido"})
		return
	}

	c.JSON(http.StatusOK, order)
}
