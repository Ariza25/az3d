package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"strings"
	"time"

	"az3d-backend/database"
	"az3d-backend/models"
	"az3d-backend/utils"

	"github.com/gin-gonic/gin"
)

// POST /api/auth/forgot-password
func (h *AuthHandler) ForgotPassword(c *gin.Context) {
	var input models.ForgotPasswordInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Informe um endereço de e-mail válido"})
		return
	}

	email := strings.ToLower(strings.TrimSpace(input.Email))

	// Resposta padronizada de sucesso mesmo se o e-mail não existir (boa prática contra enumeração)
	genericResponse := gin.H{
		"message": "Se o e-mail informado estiver cadastrado na plataforma, você receberá as instruções para redefinir sua senha em instantes.",
	}

	var user models.User
	query := database.DB.Where("LOWER(email) = ?", email)
	if input.AccountType == "seller" {
		query = query.Where("role IN ?", []string{"admin", "tenant_admin", "master_admin"})
	} else if input.AccountType == "customer" {
		query = query.Where("role = ?", "customer")
	}

	if err := query.First(&user).Error; err != nil {
		// Se não encontrou com filtro específico, tenta busca genérica por e-mail
		if err := database.DB.Where("LOWER(email) = ?", email).First(&user).Error; err != nil {
			c.JSON(http.StatusOK, genericResponse)
			return
		}
	}

	// Invalida tokens anteriores não utilizados
	database.DB.Model(&models.PasswordResetToken{}).
		Where("user_id = ? AND used = ?", user.ID, false).
		Update("used", true)

	// Gera token criptograficamente seguro (32 bytes = 64 chars hex)
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro interno ao gerar chave de recuperação"})
		return
	}
	token := hex.EncodeToString(bytes)

	resetToken := models.PasswordResetToken{
		UserID:    user.ID,
		TenantID:  user.TenantID,
		Token:     token,
		ExpiresAt: time.Now().Add(30 * time.Minute),
		Used:      false,
	}

	if err := database.DB.Create(&resetToken).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao registrar solicitação de redefinição"})
		return
	}

	baseURL := strings.TrimRight(h.cfg.FrontendBaseURL, "/")
	if baseURL == "" {
		baseURL = "http://localhost:5173"
	}
	resetURL := baseURL + "/recuperar-senha?token=" + token

	// Envia o e-mail assincronamente para não prender a resposta HTTP
	go func(targetEmail, userName, url string) {
		_ = h.mailer.SendPasswordResetEmail(targetEmail, userName, url)
	}(user.Email, user.Name, resetURL)

	c.JSON(http.StatusOK, genericResponse)
}

// GET /api/auth/verify-reset-token
func (h *AuthHandler) VerifyResetToken(c *gin.Context) {
	token := strings.TrimSpace(c.Query("token"))
	if token == "" {
		c.JSON(http.StatusBadRequest, gin.H{"valid": false, "error": "Token de verificação ausente"})
		return
	}

	var resetToken models.PasswordResetToken
	err := database.DB.Preload("User").
		Where("token = ? AND used = ? AND expires_at > ?", token, false, time.Now()).
		First(&resetToken).Error

	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"valid": false,
			"error": "O link de recuperação é inválido ou já expirou. Solicite um novo link.",
		})
		return
	}

	email := ""
	if resetToken.User != nil {
		email = maskEmail(resetToken.User.Email)
	}

	c.JSON(http.StatusOK, gin.H{
		"valid": true,
		"email": email,
	})
}

// POST /api/auth/reset-password
func (h *AuthHandler) ResetPassword(c *gin.Context) {
	var input models.ResetPasswordInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Dados inválidos: " + err.Error()})
		return
	}

	token := strings.TrimSpace(input.Token)
	if token == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Token de redefinição é obrigatório"})
		return
	}

	if len(strings.TrimSpace(input.NewPassword)) < 6 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "A nova senha deve ter no mínimo 6 caracteres"})
		return
	}

	var resetToken models.PasswordResetToken
	err := database.DB.Where("token = ? AND used = ? AND expires_at > ?", token, false, time.Now()).First(&resetToken).Error
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Link de redefinição inválido, expirado ou já utilizado"})
		return
	}

	var user models.User
	if err := database.DB.First(&user, resetToken.UserID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Usuário não encontrado"})
		return
	}

	hashedPassword, err := utils.HashPassword(input.NewPassword)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao processar nova senha"})
		return
	}

	tx := database.DB.Begin()
	user.Password = hashedPassword
	if err := tx.Save(&user).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao atualizar senha no banco de dados"})
		return
	}

	resetToken.Used = true
	if err := tx.Save(&resetToken).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao finalizar validação do token"})
		return
	}

	tx.Commit()

	c.JSON(http.StatusOK, gin.H{
		"message": "Sua senha foi redefinida com sucesso! Você já pode entrar com a nova senha.",
	})
}

func maskEmail(email string) string {
	parts := strings.Split(email, "@")
	if len(parts) != 2 {
		return email
	}
	name, domain := parts[0], parts[1]
	if len(name) <= 2 {
		return name + "***@" + domain
	}
	return string(name[0]) + strings.Repeat("*", len(name)-2) + string(name[len(name)-1]) + "@" + domain
}
