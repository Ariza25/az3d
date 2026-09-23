package handlers

import (
	"math"
	"net/http"
	"strconv"
	"strings"

	"az3d-backend/database"
	"az3d-backend/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func (h *OrderHandler) GetAllOrders(c *gin.Context) {
	tenantID := getTenantID(c)

	_ = CancelExpiredPixOrders(database.DB, tenantID)

	// Sincroniza pedidos cujo pagamento ja foi aprovado mas o status ainda constava como aguardando pagamento
	_ = database.DB.Model(&models.Order{}).
		Where("tenant_id = ? AND (payment_status IN ('approved', 'paid') OR paid_at IS NOT NULL) AND status IN ('pending_payment', 'pending_confirmation', 'pending')", tenantID).
		Update("status", "queued_printing").Error

	pageStr := strings.TrimSpace(c.Query("page"))
	limitStr := strings.TrimSpace(c.Query("limit"))
	isPaginated := c.Query("paginated") == "true" || pageStr != ""

	query := database.DB.
		Preload("User").
		Preload("Items.Product").
		Preload("Shipments.Events", func(db *gorm.DB) *gorm.DB { return db.Order("occurred_at desc") }).
		Where("tenant_id = ?", tenantID).
		Order("created_at desc")

	var totalCount int64
	if err := database.DB.Model(&models.Order{}).Where("tenant_id = ?", tenantID).Count(&totalCount).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao contar pedidos do tenant"})
		return
	}

	c.Header("X-Total-Count", strconv.FormatInt(totalCount, 10))

	if isPaginated {
		page := 1
		if p, err := strconv.Atoi(pageStr); err == nil && p > 0 {
			page = p
		}
		limit := 20
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
			limit = l
			if limit > 100 {
				limit = 100
			}
		}

		offset := (page - 1) * limit
		totalPages := int(math.Ceil(float64(totalCount) / float64(limit)))
		if totalPages == 0 {
			totalPages = 1
		}
		hasMore := page < totalPages

		c.Header("X-Total-Pages", strconv.Itoa(totalPages))
		c.Header("X-Current-Page", strconv.Itoa(page))
		c.Header("X-Page-Size", strconv.Itoa(limit))
		c.Header("X-Has-More", strconv.FormatBool(hasMore))

		var orders []models.Order
		if err := query.Offset(offset).Limit(limit).Find(&orders).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao carregar lista de pedidos do tenant"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"items":       orders,
			"total":       totalCount,
			"page":        page,
			"limit":       limit,
			"total_pages": totalPages,
			"has_more":    hasMore,
		})
		return
	}

	var orders []models.Order
	if err := query.Find(&orders).Error; err != nil {
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
		"confirmed":            true,
		"queued_printing":      true,
		"in_printing":          true,
		"post_processing":      true,
		"ready_shipping":       true,
		"shipped":              true,
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
