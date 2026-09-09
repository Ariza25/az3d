package handlers

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"az3d-backend/database"
	"az3d-backend/models"

	"github.com/gin-gonic/gin"
)

// POST /api/webhooks/marketplaces/:provider
func (h *MarketplaceHandler) ReceiveMarketplaceWebhook(c *gin.Context) {
	provider := normalizeProvider(c.Param("provider"))
	if provider == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Marketplace obrigatorio"})
		return
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 1<<20)
	body, err := c.GetRawData()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Payload invalido"})
		return
	}
	payload := map[string]any{}
	if err := json.Unmarshal(body, &payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Payload JSON invalido"})
		return
	}
	if !h.validMarketplaceWebhookSignature(c, body) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Assinatura do webhook invalida"})
		return
	}
	if provider == mercadoLivreProvider && !h.validMercadoLivreWebhookApplication(payload) {
		c.JSON(http.StatusOK, gin.H{"message": "Notificacao ignorada: aplicacao nao reconhecida."})
		return
	}
	tenantID := resolveWebhookTenantID(c, provider, payload)
	if tenantID == 0 {
		c.JSON(http.StatusOK, gin.H{"message": "Notificacao ignorada: conta do marketplace nao reconhecida."})
		return
	}
	headersPayload, _ := json.Marshal(webhookHeaders(c))
	dedupKey := marketplaceWebhookDedupKey(provider, payload)
	var existing models.MarketplaceWebhookEvent
	if err := database.DB.Where("dedup_key = ?", dedupKey).First(&existing).Error; err == nil {
		c.JSON(http.StatusOK, gin.H{"message": "Webhook ja registrado.", "event_id": existing.ID})
		return
	}

	event := models.MarketplaceWebhookEvent{
		TenantID:         tenantID,
		Provider:         provider,
		EventType:        webhookEventType(payload),
		ExternalID:       webhookExternalID(payload),
		ExternalResource: webhookExternalResource(payload),
		DedupKey:         dedupKey,
		Status:           "pending",
		Payload:          string(body),
		Headers:          string(headersPayload),
		ReceivedAt:       time.Now(),
	}
	if err := database.DB.Create(&event).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao registrar webhook"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":  "Webhook registrado para processamento.",
		"event_id": event.ID,
	})
	go h.ProcessMarketplaceQueue(context.Background(), 20)
}

func (h *MarketplaceHandler) validMercadoLivreWebhookApplication(payload map[string]any) bool {
	if h == nil || h.cfg == nil || strings.TrimSpace(h.cfg.MercadoLivreClientID) == "" {
		return true
	}
	applicationID := webhookStringValue(payload, "application_id")
	return applicationID == "" || applicationID == strings.TrimSpace(h.cfg.MercadoLivreClientID)
}

func (h *MarketplaceHandler) validMarketplaceWebhookSignature(c *gin.Context, body []byte) bool {
	if h == nil || h.cfg == nil || strings.TrimSpace(h.cfg.MercadoLivreWebhookSecret) == "" {
		return true
	}
	received := strings.TrimPrefix(strings.ToLower(strings.TrimSpace(c.GetHeader("X-Signature"))), "sha256=")
	decoded, err := hex.DecodeString(received)
	if err != nil {
		return false
	}
	mac := hmac.New(sha256.New, []byte(h.cfg.MercadoLivreWebhookSecret))
	_, _ = mac.Write(body)
	return hmac.Equal(decoded, mac.Sum(nil))
}

func marketplaceWebhookDedupKey(provider string, payload map[string]any) string {
	id := webhookStringValue(payload, "_id")
	if id == "" {
		id = webhookEventType(payload) + "|" + webhookExternalResource(payload) + "|" + webhookStringValue(payload, "sent")
	}
	sum := sha256.Sum256([]byte(normalizeProvider(provider) + "|" + id))
	return hex.EncodeToString(sum[:])
}

// GET /api/admin/marketplaces/webhook-events
func (h *MarketplaceHandler) GetMarketplaceWebhookEvents(c *gin.Context) {
	tenantID := getTenantID(c)
	provider := normalizeProvider(c.Query("provider"))
	query := database.DB.Where("tenant_id = ?", tenantID)
	if provider != "" {
		query = query.Where("provider = ?", provider)
	}
	var events []models.MarketplaceWebhookEvent
	if err := query.Order("received_at desc").Limit(100).Find(&events).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao carregar webhooks"})
		return
	}
	c.JSON(http.StatusOK, events)
}

func resolveWebhookTenantID(c *gin.Context, provider string, payload map[string]any) uint {
	_ = c
	for _, key := range []string{"shop_id", "seller_id", "user_id", "merchant_id"} {
		value := webhookStringValue(payload, key)
		if value == "" {
			continue
		}
		var account models.MarketplaceAccount
		if err := database.DB.Where("provider = ? AND (shop_id = ? OR seller_id = ?)", provider, value, value).First(&account).Error; err == nil {
			return account.TenantID
		}
	}
	return 0
}

func webhookHeaders(c *gin.Context) map[string]string {
	allowed := []string{"User-Agent", "X-Shopee-Shopid", "X-Topic", "X-Notification-Type", "X-Request-Id", "X-Signature"}
	headers := map[string]string{}
	for _, key := range allowed {
		if value := strings.TrimSpace(c.GetHeader(key)); value != "" {
			headers[key] = value
		}
	}
	return headers
}

func webhookEventType(payload map[string]any) string {
	for _, key := range []string{"topic", "code", "event", "event_type", "notificationType"} {
		if value := webhookStringValue(payload, key); value != "" {
			return value
		}
	}
	return "marketplace_notification"
}

func webhookExternalID(payload map[string]any) string {
	for _, key := range []string{"order_id", "order_sn", "item_id", "resource_id", "id"} {
		if value := webhookStringValue(payload, key); value != "" {
			return value
		}
	}
	resource := webhookExternalResource(payload)
	if resource == "" {
		return ""
	}
	parts := strings.Split(strings.Trim(resource, "/"), "/")
	if len(parts) == 0 {
		return resource
	}
	return parts[len(parts)-1]
}

func webhookExternalResource(payload map[string]any) string {
	for _, key := range []string{"resource", "resource_url", "path"} {
		if value := webhookStringValue(payload, key); value != "" {
			return value
		}
	}
	return ""
}

func webhookStringValue(payload map[string]any, key string) string {
	value, ok := payload[key]
	if !ok || value == nil {
		return ""
	}
	switch typed := value.(type) {
	case string:
		return strings.TrimSpace(typed)
	case float64:
		return strconv.FormatInt(int64(typed), 10)
	case int:
		return strconv.Itoa(typed)
	default:
		return strings.TrimSpace(fmt.Sprint(typed))
	}
}
