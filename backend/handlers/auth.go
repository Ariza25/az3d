package handlers

import (
	"net/http"
	"strconv"
	"strings"
	"unicode"

	"az3d-backend/config"
	"az3d-backend/database"
	"az3d-backend/models"
	"az3d-backend/utils"

	"github.com/gin-gonic/gin"
)

type AuthHandler struct {
	cfg *config.Config
}

func NewAuthHandler(cfg *config.Config) *AuthHandler {
	return &AuthHandler{cfg: cfg}
}

// POST /api/auth/customer/register
func (h *AuthHandler) CustomerRegister(c *gin.Context) {
	var input models.RegisterInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Dados invalidos: " + err.Error()})
		return
	}

	var existingUser models.User
	if err := database.DB.Where("email = ?", input.Email).First(&existingUser).Error; err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Este e-mail ja esta cadastrado em nosso sistema"})
		return
	}

	hashedPassword, err := utils.HashPassword(input.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao processar senha de acesso"})
		return
	}

	tenantID := input.TenantID
	if tenantID == 0 {
		tenantID = 1
	}

	user := models.User{
		TenantID: tenantID,
		Name:     input.Name,
		Email:    input.Email,
		Password: hashedPassword,
		Role:     "customer",
	}

	if err := database.DB.Create(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao salvar usuario no banco de dados"})
		return
	}

	token, err := utils.GenerateJWT(user.ID, user.Email, user.Role, user.TenantID, h.cfg.JWTSecret)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao gerar token de acesso"})
		return
	}

	c.JSON(http.StatusCreated, models.AuthResponse{
		Token: token,
		User:  user,
	})
}

// POST /api/auth/seller/register
func (h *AuthHandler) SellerRegister(c *gin.Context) {
	var input models.RegisterInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Dados invalidos: " + err.Error()})
		return
	}

	storeName := strings.TrimSpace(input.StoreName)
	if storeName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Informe o nome da loja para criar uma conta de vendedor"})
		return
	}

	var existingUser models.User
	if err := database.DB.Where("email = ?", input.Email).First(&existingUser).Error; err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Este e-mail ja esta cadastrado em nosso sistema"})
		return
	}

	hashedPassword, err := utils.HashPassword(input.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao processar senha de acesso"})
		return
	}

	tenant := models.Tenant{
		Name: storeName,
		Slug: uniqueTenantSlug(storeName),
	}

	if err := database.DB.Create(&tenant).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao criar loja do vendedor"})
		return
	}

	user := models.User{
		TenantID: tenant.ID,
		Name:     input.Name,
		Email:    input.Email,
		Password: hashedPassword,
		Role:     "tenant_admin",
	}

	if err := database.DB.Create(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao salvar usuario vendedor"})
		return
	}

	token, err := utils.GenerateJWT(user.ID, user.Email, user.Role, user.TenantID, h.cfg.JWTSecret)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao gerar token de acesso"})
		return
	}

	c.JSON(http.StatusCreated, models.AuthResponse{
		Token: token,
		User:  user,
	})
}

// Register keeps the old /api/auth/register route as a customer alias.
func (h *AuthHandler) Register(c *gin.Context) {
	h.CustomerRegister(c)
}

// POST /api/auth/customer/login
func (h *AuthHandler) CustomerLogin(c *gin.Context) {
	h.loginWithAllowedRoles(c, map[string]bool{"customer": true}, "Use uma conta de cliente para entrar na loja")
}

// POST /api/auth/admin/login
func (h *AuthHandler) AdminLogin(c *gin.Context) {
	h.loginWithAllowedRoles(c, map[string]bool{"admin": true, "tenant_admin": true}, "Use uma conta administrativa para acessar o painel")
}

// Login keeps the old /api/auth/login route as a customer alias.
func (h *AuthHandler) Login(c *gin.Context) {
	h.CustomerLogin(c)
}

func (h *AuthHandler) loginWithAllowedRoles(c *gin.Context, allowedRoles map[string]bool, invalidRoleMessage string) {
	var input models.LoginInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Por favor, forneca um e-mail e senha validos"})
		return
	}

	var user models.User
	if err := database.DB.Where("email = ?", input.Email).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Credenciais de acesso incorretas"})
		return
	}

	if !utils.CheckPasswordHash(input.Password, user.Password) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Credenciais de acesso incorretas"})
		return
	}

	if !allowedRoles[user.Role] {
		c.JSON(http.StatusForbidden, gin.H{"error": invalidRoleMessage})
		return
	}

	token, err := utils.GenerateJWT(user.ID, user.Email, user.Role, user.TenantID, h.cfg.JWTSecret)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao gerar token de acesso"})
		return
	}

	c.JSON(http.StatusOK, models.AuthResponse{
		Token: token,
		User:  user,
	})
}

// GET /api/auth/me
func (h *AuthHandler) Me(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Nao autenticado"})
		return
	}

	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Usuario nao encontrado"})
		return
	}

	c.JSON(http.StatusOK, user)
}

func uniqueTenantSlug(name string) string {
	base := slugify(name)
	if base == "" {
		base = "loja"
	}

	slug := base
	for suffix := 2; ; suffix++ {
		var count int64
		database.DB.Model(&models.Tenant{}).Where("slug = ?", slug).Count(&count)
		if count == 0 {
			return slug
		}
		slug = base + "-" + strconv.Itoa(suffix)
	}
}

func slugify(value string) string {
	var builder strings.Builder
	lastDash := false

	for _, r := range strings.ToLower(value) {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			builder.WriteRune(r)
			lastDash = false
			continue
		}
		if !lastDash && builder.Len() > 0 {
			builder.WriteByte('-')
			lastDash = true
		}
	}

	return strings.Trim(builder.String(), "-")
}
