package handlers

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"az3d-backend/config"
	"az3d-backend/database"
	"az3d-backend/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type ShipmentHandler struct {
	cfg *config.Config
}

func NewShipmentHandler(cfg *config.Config) *ShipmentHandler {
	return &ShipmentHandler{cfg: cfg}
}

func (h *ShipmentHandler) GetShipments(c *gin.Context) {
	tenantID := getTenantID(c)
	query := database.DB.Where("tenant_id = ?", tenantID)
	if orderID := strings.TrimSpace(c.Query("order_id")); orderID != "" {
		query = query.Where("order_id = ?", orderID)
	}

	var shipments []models.OrderShipment
	if err := query.
		Preload("Order").
		Preload("Order.User").
		Preload("Events", func(db *gorm.DB) *gorm.DB { return db.Order("occurred_at desc") }).
		Order("created_at desc").
		Find(&shipments).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao carregar envios"})
		return
	}

	c.JSON(http.StatusOK, shipments)
}

func (h *ShipmentHandler) SaveShipment(c *gin.Context) {
	tenantID := getTenantID(c)
	var input models.OrderShipmentInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Dados do envio invalidos: " + err.Error()})
		return
	}

	carrier := strings.ToLower(strings.TrimSpace(input.Carrier))
	if carrier == "" {
		carrier = "correios"
	}
	trackingCode := strings.ToUpper(strings.TrimSpace(input.TrackingCode))
	if trackingCode == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Informe o codigo de rastreio"})
		return
	}

	var order models.Order
	if err := database.DB.Where("tenant_id = ?", tenantID).First(&order, input.OrderID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Pedido nao encontrado para este tenant"})
		return
	}

	status := strings.TrimSpace(input.Status)
	if status == "" {
		status = "pending"
	}

	var shipment models.OrderShipment
	err := database.DB.Where(
		"tenant_id = ? AND order_id = ? AND carrier = ? AND tracking_code = ?",
		tenantID,
		input.OrderID,
		carrier,
		trackingCode,
	).First(&shipment).Error
	if err != nil && err != gorm.ErrRecordNotFound {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao consultar envio"})
		return
	}
	if err == gorm.ErrRecordNotFound {
		shipment = models.OrderShipment{
			TenantID:     tenantID,
			OrderID:      input.OrderID,
			Carrier:      carrier,
			TrackingCode: trackingCode,
		}
	}
	shipment.Status = status

	if err := database.DB.Save(&shipment).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao salvar envio"})
		return
	}
	database.DB.Preload("Events", func(db *gorm.DB) *gorm.DB { return db.Order("occurred_at desc") }).First(&shipment, shipment.ID)
	c.JSON(http.StatusOK, shipment)
}

func (h *ShipmentHandler) SyncShipment(c *gin.Context) {
	tenantID := getTenantID(c)
	shipmentID, err := strconv.Atoi(c.Param("id"))
	if err != nil || shipmentID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Envio invalido"})
		return
	}

	var shipment models.OrderShipment
	if err := database.DB.Where("tenant_id = ?", tenantID).First(&shipment, shipmentID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Envio nao encontrado"})
		return
	}

	var account models.TenantCarrierAccount
	if err := database.DB.Where(
		"tenant_id = ? AND provider = ? AND is_active = true AND sync_tracking = true",
		tenantID,
		shipment.Carrier,
	).First(&account).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Conta de transportadora ativa nao encontrada para este tenant"})
		return
	}

	entry := syncOneShipment(c.Request.Context(), h.cfg, &account, &shipment)
	status := http.StatusOK
	if entry.Error != "" {
		status = http.StatusBadGateway
	}
	c.JSON(status, entry)
}

func (h *ShipmentHandler) SyncTracking(c *gin.Context) {
	tenantID := getTenantID(c)
	summary := SyncActiveTracking(c.Request.Context(), h.cfg, tenantID)
	c.JSON(http.StatusOK, summary)
}

func (h *ShipmentHandler) GetCarrierHealth(c *gin.Context) {
	tenantID := getTenantID(c)
	var accounts []models.TenantCarrierAccount
	if err := database.DB.Where("tenant_id = ?", tenantID).Order("provider asc").Find(&accounts).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao carregar saude das transportadoras"})
		return
	}

	type healthItem struct {
		Provider        string     `json:"provider"`
		AccountName     string     `json:"account_name"`
		IsActive        bool       `json:"is_active"`
		IsConnected     bool       `json:"is_connected"`
		SyncTracking    bool       `json:"sync_tracking"`
		ActiveShipments int64      `json:"active_shipments"`
		LastSyncAt      *time.Time `json:"last_sync_at,omitempty"`
		LastError       string     `json:"last_error,omitempty"`
	}

	items := make([]healthItem, 0, len(accounts))
	for _, account := range accounts {
		var activeShipments int64
		database.DB.Model(&models.OrderShipment{}).
			Where("tenant_id = ? AND carrier = ? AND status NOT IN ?", tenantID, account.Provider, []string{"delivered", "cancelled"}).
			Count(&activeShipments)
		items = append(items, healthItem{
			Provider:        account.Provider,
			AccountName:     account.AccountName,
			IsActive:        account.IsActive,
			IsConnected:     account.IsConnected,
			SyncTracking:    account.SyncTracking,
			ActiveShipments: activeShipments,
			LastSyncAt:      account.LastSyncAt,
			LastError:       account.LastError,
		})
	}

	c.JSON(http.StatusOK, items)
}
