package handlers

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"az3d-backend/database"
	"az3d-backend/models"

	"github.com/gin-gonic/gin"
)

type ChatHandler struct{}

func NewChatHandler() *ChatHandler {
	return &ChatHandler{}
}

// GET /api/chat/tenant/:tenant_id/conversation
// Retorna ou inicia a conversa do comprador autenticado com o tenant informado
func (h *ChatHandler) GetCustomerConversation(c *gin.Context) {
	val, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Não autenticado"})
		return
	}
	userID := val.(uint)

	tenantIDStr := c.Param("tenant_id")
	tenantIDUint, err := strconv.ParseUint(tenantIDStr, 10, 32)
	if err != nil || tenantIDUint == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID do tenant inválido"})
		return
	}
	tenantID := uint(tenantIDUint)

	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Usuário não encontrado"})
		return
	}

	var conversation models.ChatConversation
	err = database.DB.Where("tenant_id = ? AND customer_id = ?", tenantID, userID).First(&conversation).Error
	if err != nil {
		conversation = models.ChatConversation{
			TenantID:            tenantID,
			CustomerID:          userID,
			CustomerName:        user.Name,
			CustomerEmail:       user.Email,
			LastMessage:         "",
			LastMessageAt:       time.Now(),
			UnreadTenantCount:   0,
			UnreadCustomerCount: 0,
		}
		if err := database.DB.Create(&conversation).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao iniciar conversa de chat"})
			return
		}
	}

	var messages []models.ChatMessage
	database.DB.Where("conversation_id = ?", conversation.ID).
		Order("created_at asc").
		Limit(100).
		Find(&messages)

	// Marca mensagens do lojista como lidas pelo cliente
	database.DB.Model(&models.ChatMessage{}).
		Where("conversation_id = ? AND sender_type = ? AND read = ?", conversation.ID, "tenant", false).
		Update("read", true)

	if conversation.UnreadCustomerCount > 0 {
		database.DB.Model(&conversation).Update("unread_customer_count", 0)
		conversation.UnreadCustomerCount = 0
	}

	c.JSON(http.StatusOK, models.ChatConversationResponse{
		Conversation: conversation,
		Messages:     messages,
	})
}

// POST /api/chat/tenant/:tenant_id/messages
// Envia mensagem do comprador para o tenant
func (h *ChatHandler) SendCustomerMessage(c *gin.Context) {
	val, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Não autenticado"})
		return
	}
	userID := val.(uint)

	tenantIDStr := c.Param("tenant_id")
	tenantIDUint, err := strconv.ParseUint(tenantIDStr, 10, 32)
	if err != nil || tenantIDUint == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID do tenant inválido"})
		return
	}
	tenantID := uint(tenantIDUint)

	var input models.SendChatMessageInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Mensagem inválida"})
		return
	}

	msgText := strings.TrimSpace(input.Message)
	if msgText == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "O texto da mensagem não pode ser vazio"})
		return
	}

	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Usuário não encontrado"})
		return
	}

	var conversation models.ChatConversation
	err = database.DB.Where("tenant_id = ? AND customer_id = ?", tenantID, userID).First(&conversation).Error
	if err != nil {
		conversation = models.ChatConversation{
			TenantID:            tenantID,
			CustomerID:          userID,
			CustomerName:        user.Name,
			CustomerEmail:       user.Email,
			LastMessage:         msgText,
			LastMessageAt:       time.Now(),
			UnreadTenantCount:   1,
			UnreadCustomerCount: 0,
		}
		if err := database.DB.Create(&conversation).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao criar conversa de chat"})
			return
		}
	} else {
		conversation.LastMessage = msgText
		conversation.LastMessageAt = time.Now()
		conversation.UnreadTenantCount++
		if user.Name != "" {
			conversation.CustomerName = user.Name
		}
		_ = database.DB.Save(&conversation)
	}

	chatMsg := models.ChatMessage{
		ConversationID: conversation.ID,
		TenantID:       tenantID,
		SenderID:       userID,
		SenderType:     "customer",
		SenderName:     user.Name,
		Message:        msgText,
		Read:           false,
		CreatedAt:      time.Now(),
	}

	if err := database.DB.Create(&chatMsg).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao registrar mensagem"})
		return
	}

	c.JSON(http.StatusCreated, chatMsg)
}

// GET /api/admin/chat/conversations
// Lista conversas de clientes para o tenant
func (h *ChatHandler) GetTenantConversations(c *gin.Context) {
	tenantID := getTenantID(c)

	var conversations []models.ChatConversation
	if err := database.DB.
		Where("tenant_id = ?", tenantID).
		Order("last_message_at desc").
		Find(&conversations).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao buscar conversas do lojista"})
		return
	}

	c.JSON(http.StatusOK, conversations)
}

// GET /api/admin/chat/conversations/:id/messages
// Carrega mensagens de uma conversa específica e marca as mensagens de clientes como lidas
func (h *ChatHandler) GetTenantConversationMessages(c *gin.Context) {
	tenantID := getTenantID(c)
	convID := c.Param("id")

	var conversation models.ChatConversation
	if err := database.DB.Where("id = ? AND tenant_id = ?", convID, tenantID).First(&conversation).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Conversa não encontrada"})
		return
	}

	var messages []models.ChatMessage
	database.DB.Where("conversation_id = ?", conversation.ID).
		Order("created_at asc").
		Limit(200).
		Find(&messages)

	// Marca mensagens do cliente como lidas
	database.DB.Model(&models.ChatMessage{}).
		Where("conversation_id = ? AND sender_type = ? AND read = ?", conversation.ID, "customer", false).
		Update("read", true)

	if conversation.UnreadTenantCount > 0 {
		database.DB.Model(&conversation).Update("unread_tenant_count", 0)
		conversation.UnreadTenantCount = 0
	}

	c.JSON(http.StatusOK, models.ChatConversationResponse{
		Conversation: conversation,
		Messages:     messages,
	})
}

// POST /api/admin/chat/conversations/:id/messages
// Responde à conversa do cliente em nome do tenant
func (h *ChatHandler) SendTenantMessage(c *gin.Context) {
	tenantID := getTenantID(c)
	convID := c.Param("id")

	val, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Não autenticado"})
		return
	}
	userID := val.(uint)

	var conversation models.ChatConversation
	if err := database.DB.Where("id = ? AND tenant_id = ?", convID, tenantID).First(&conversation).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Conversa não encontrada"})
		return
	}

	var input models.SendChatMessageInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Mensagem inválida"})
		return
	}

	msgText := strings.TrimSpace(input.Message)
	if msgText == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "O texto da resposta não pode ser vazio"})
		return
	}

	// Obtém o nome da loja ou do operador
	senderName := "Atendimento da Loja"
	var tenant models.Tenant
	if err := database.DB.First(&tenant, tenantID).Error; err == nil && tenant.Name != "" {
		senderName = tenant.Name
	}

	chatMsg := models.ChatMessage{
		ConversationID: conversation.ID,
		TenantID:       tenantID,
		SenderID:       userID,
		SenderType:     "tenant",
		SenderName:     senderName,
		Message:        msgText,
		Read:           false,
		CreatedAt:      time.Now(),
	}

	if err := database.DB.Create(&chatMsg).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao salvar mensagem de resposta"})
		return
	}

	conversation.LastMessage = msgText
	conversation.LastMessageAt = time.Now()
	conversation.UnreadCustomerCount++
	_ = database.DB.Save(&conversation)

	c.JSON(http.StatusCreated, chatMsg)
}

// GET /api/admin/chat/unread-count
// Retorna a soma de mensagens não lidas para o lojista
func (h *ChatHandler) GetTenantUnreadChatCount(c *gin.Context) {
	tenantID := getTenantID(c)

	var total int64
	database.DB.Model(&models.ChatConversation{}).
		Where("tenant_id = ?", tenantID).
		Select("COALESCE(SUM(unread_tenant_count), 0)").
		Scan(&total)

	c.JSON(http.StatusOK, gin.H{
		"unread_count": total,
	})
}
