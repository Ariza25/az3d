package handlers

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
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

type googleOAuthState struct {
	Scope     string `json:"scope"`
	TenantID  uint   `json:"tenant_id"`
	ReturnTo  string `json:"return_to"`
	StoreName string `json:"store_name"`
	Nonce     string `json:"nonce"`
	Expires   int64  `json:"expires"`
}

type googleTokenResponse struct {
	AccessToken      string `json:"access_token"`
	IDToken          string `json:"id_token"`
	TokenType        string `json:"token_type"`
	ExpiresIn        int    `json:"expires_in"`
	Error            string `json:"error"`
	ErrorDescription string `json:"error_description"`
}

type googleUserInfo struct {
	Sub           string `json:"sub"`
	Name          string `json:"name"`
	Email         string `json:"email"`
	EmailVerified bool   `json:"email_verified"`
	Picture       string `json:"picture"`
	Aud           string `json:"aud"`
	Iss           string `json:"iss"`
}

type googleTokenInfo struct {
	Aud string `json:"aud"`
	Iss string `json:"iss"`
}

func NewAuthHandler(cfg *config.Config) *AuthHandler {
	return &AuthHandler{cfg: cfg}
}

func (h *AuthHandler) StartGoogleOAuth(c *gin.Context) {
	if h.cfg.GoogleOAuthClientID == "" || h.cfg.GoogleOAuthClientSecret == "" {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Login Google nao configurado no backend"})
		return
	}

	scope := strings.ToLower(strings.TrimSpace(c.DefaultQuery("scope", "customer")))
	if scope != "customer" && scope != "admin" && scope != "seller" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Escopo Google invalido"})
		return
	}

	tenantID := getTenantIDFromRequest(c)
	returnTo := sanitizeReturnPath(c.Query("return_to"), scope)
	state := googleOAuthState{
		Scope:     scope,
		TenantID:  tenantID,
		ReturnTo:  returnTo,
		StoreName: strings.TrimSpace(c.Query("store_name")),
		Nonce:     randomHex(16),
		Expires:   time.Now().Add(10 * time.Minute).Unix(),
	}
	if scope == "seller" && state.StoreName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Informe o nome da loja para cadastro com Google"})
		return
	}

	signedState, err := h.signGoogleState(state)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao iniciar login Google"})
		return
	}

	redirectURL := h.googleRedirectURL(c)
	params := url.Values{}
	params.Set("client_id", h.cfg.GoogleOAuthClientID)
	params.Set("redirect_uri", redirectURL)
	params.Set("response_type", "code")
	params.Set("scope", "openid profile email")
	params.Set("state", signedState)
	params.Set("prompt", "select_account")

	c.JSON(http.StatusOK, gin.H{
		"auth_url": h.cfg.GoogleOAuthAuthURL + "?" + params.Encode(),
	})
}

func (h *AuthHandler) CompleteGoogleOAuth(c *gin.Context) {
	if errText := strings.TrimSpace(c.Query("error")); errText != "" {
		h.redirectGoogleError(c, "Google recusou o login: "+errText, "customer", "/")
		return
	}

	code := strings.TrimSpace(c.Query("code"))
	rawState := strings.TrimSpace(c.Query("state"))
	state, err := h.verifyGoogleState(rawState)
	if err != nil {
		h.redirectGoogleError(c, "Sessao Google invalida ou expirada", "customer", "/")
		return
	}
	if code == "" {
		h.redirectGoogleError(c, "Codigo Google ausente", state.Scope, state.ReturnTo)
		return
	}

	token, err := h.exchangeGoogleCode(c.Request.Context(), code, h.googleRedirectURL(c))
	if err != nil {
		h.redirectGoogleError(c, err.Error(), state.Scope, state.ReturnTo)
		return
	}
	profile, err := h.fetchGoogleUser(c.Request.Context(), token)
	if err != nil {
		h.redirectGoogleError(c, err.Error(), state.Scope, state.ReturnTo)
		return
	}
	if profile.Email == "" || !profile.EmailVerified {
		h.redirectGoogleError(c, "Conta Google sem e-mail verificado", state.Scope, state.ReturnTo)
		return
	}

	user, err := h.userFromGoogleProfile(profile, state)
	if err != nil {
		h.redirectGoogleError(c, err.Error(), state.Scope, state.ReturnTo)
		return
	}

	jwtToken, err := utils.GenerateJWT(user.ID, user.Email, user.Role, user.TenantID, h.cfg.JWTSecret, h.cfg.JWTTTLHours)
	if err != nil {
		h.redirectGoogleError(c, "Erro ao gerar token AZ3D", state.Scope, state.ReturnTo)
		return
	}

	h.redirectGoogleSuccess(c, jwtToken, state.Scope, state.ReturnTo)
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

	token, err := utils.GenerateJWT(user.ID, user.Email, user.Role, user.TenantID, h.cfg.JWTSecret, h.cfg.JWTTTLHours)
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

	token, err := utils.GenerateJWT(user.ID, user.Email, user.Role, user.TenantID, h.cfg.JWTSecret, h.cfg.JWTTTLHours)
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
	h.loginWithAllowedRoles(c, map[string]bool{"customer": true}, "Essa conta e administrativa. Acesse /admin para entrar no painel")
}

// POST /api/auth/admin/login
func (h *AuthHandler) AdminLogin(c *gin.Context) {
	h.loginWithAllowedRoles(c, map[string]bool{"admin": true, "tenant_admin": true, "master_admin": true}, "Use uma conta administrativa para acessar o painel")
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

	identifier := strings.ToLower(strings.TrimSpace(input.Email))
	var user models.User
	if err := database.DB.Where("LOWER(email) = ? OR LOWER(username) = ?", identifier, identifier).First(&user).Error; err != nil {
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

	token, err := utils.GenerateJWT(user.ID, user.Email, user.Role, user.TenantID, h.cfg.JWTSecret, h.cfg.JWTTTLHours)
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

func (h *AuthHandler) exchangeGoogleCode(ctx context.Context, code string, redirectURL string) (*googleTokenResponse, error) {
	form := url.Values{}
	form.Set("code", code)
	form.Set("client_id", h.cfg.GoogleOAuthClientID)
	form.Set("client_secret", h.cfg.GoogleOAuthClientSecret)
	form.Set("redirect_uri", redirectURL)
	form.Set("grant_type", "authorization_code")

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, h.cfg.GoogleOAuthTokenURL, strings.NewReader(form.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("Nao foi possivel conectar ao Google OAuth")
	}
	defer res.Body.Close()

	body, _ := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	var token googleTokenResponse
	if err := json.Unmarshal(body, &token); err != nil {
		return nil, fmt.Errorf("Resposta Google OAuth invalida")
	}
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		msg := firstNonEmpty(token.ErrorDescription, token.Error, strings.TrimSpace(string(body)))
		return nil, fmt.Errorf("Google OAuth HTTP %d: %s", res.StatusCode, msg)
	}
	if token.AccessToken == "" {
		return nil, fmt.Errorf("Google OAuth nao retornou access_token")
	}
	return &token, nil
}

func (h *AuthHandler) fetchGoogleUser(ctx context.Context, token *googleTokenResponse) (*googleUserInfo, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, h.cfg.GoogleOAuthUserInfoURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token.AccessToken)
	req.Header.Set("Accept", "application/json")

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("Nao foi possivel consultar perfil Google")
	}
	defer res.Body.Close()

	body, _ := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return nil, fmt.Errorf("Google UserInfo HTTP %d: %s", res.StatusCode, strings.TrimSpace(string(body)))
	}

	var profile googleUserInfo
	if err := json.Unmarshal(body, &profile); err != nil {
		return nil, fmt.Errorf("Resposta Google UserInfo invalida")
	}
	if token.IDToken != "" {
		if err := h.validateGoogleIDToken(ctx, token.IDToken); err != nil {
			return nil, err
		}
	}
	return &profile, nil
}

func (h *AuthHandler) validateGoogleIDToken(ctx context.Context, idToken string) error {
	endpoint := "https://oauth2.googleapis.com/tokeninfo?id_token=" + url.QueryEscape(idToken)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return err
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return fmt.Errorf("id_token Google invalido")
	}
	var info googleTokenInfo
	if err := json.NewDecoder(res.Body).Decode(&info); err != nil {
		return err
	}
	if info.Aud != "" && info.Aud != h.cfg.GoogleOAuthClientID {
		return fmt.Errorf("audiencia Google invalida")
	}
	if info.Iss != "" && info.Iss != "https://accounts.google.com" && info.Iss != "accounts.google.com" {
		return fmt.Errorf("emissor Google invalido")
	}
	return nil
}

func (h *AuthHandler) userFromGoogleProfile(profile *googleUserInfo, state googleOAuthState) (*models.User, error) {
	email := strings.ToLower(strings.TrimSpace(profile.Email))
	name := firstNonEmpty(strings.TrimSpace(profile.Name), email)

	var user models.User
	err := database.DB.Where("LOWER(email) = ?", email).First(&user).Error
	if err == nil {
		if state.Scope == "customer" && user.Role != "customer" {
			return nil, fmt.Errorf("Este e-mail pertence a uma conta administrativa")
		}
		if state.Scope == "admin" && user.Role != "admin" && user.Role != "tenant_admin" && user.Role != "master_admin" {
			return nil, fmt.Errorf("Este e-mail nao possui acesso administrativo")
		}
		if state.Scope == "seller" && user.Role != "tenant_admin" && user.Role != "admin" && user.Role != "master_admin" {
			return nil, fmt.Errorf("Este e-mail ja existe como comprador")
		}
		database.DB.Model(&user).Updates(map[string]any{
			"google_id":     profile.Sub,
			"avatar_url":    profile.Picture,
			"auth_provider": "google",
		})
		user.GoogleID = profile.Sub
		user.AvatarURL = profile.Picture
		user.AuthProvider = "google"
		return &user, nil
	}

	if state.Scope == "admin" {
		return nil, fmt.Errorf("Conta administrativa nao encontrada para este e-mail")
	}

	tenantID := state.TenantID
	role := "customer"
	if state.Scope == "seller" {
		storeName := strings.TrimSpace(state.StoreName)
		if storeName == "" {
			return nil, fmt.Errorf("Informe o nome da loja para criar o tenant")
		}
		tenant := models.Tenant{Name: storeName, Slug: uniqueTenantSlug(storeName)}
		if err := database.DB.Create(&tenant).Error; err != nil {
			return nil, fmt.Errorf("Erro ao criar loja do vendedor")
		}
		tenantID = tenant.ID
		role = "tenant_admin"
	} else if tenantID == 0 {
		tenantID = 1
	}

	password, err := utils.HashPassword(randomHex(32))
	if err != nil {
		return nil, fmt.Errorf("Erro ao preparar conta Google")
	}
	user = models.User{
		TenantID:     tenantID,
		Name:         name,
		Email:        email,
		Password:     password,
		Role:         role,
		GoogleID:     profile.Sub,
		AvatarURL:    profile.Picture,
		AuthProvider: "google",
	}
	if err := database.DB.Create(&user).Error; err != nil {
		return nil, fmt.Errorf("Erro ao criar usuario Google")
	}
	return &user, nil
}

func (h *AuthHandler) signGoogleState(state googleOAuthState) (string, error) {
	raw, err := json.Marshal(state)
	if err != nil {
		return "", err
	}
	payload := base64.RawURLEncoding.EncodeToString(raw)
	mac := hmac.New(sha256.New, []byte(h.cfg.JWTSecret))
	mac.Write([]byte(payload))
	signature := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	return payload + "." + signature, nil
}

func (h *AuthHandler) verifyGoogleState(value string) (googleOAuthState, error) {
	var state googleOAuthState
	parts := strings.Split(value, ".")
	if len(parts) != 2 {
		return state, fmt.Errorf("state invalido")
	}
	mac := hmac.New(sha256.New, []byte(h.cfg.JWTSecret))
	mac.Write([]byte(parts[0]))
	expected := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	if !hmac.Equal([]byte(expected), []byte(parts[1])) {
		return state, fmt.Errorf("assinatura state invalida")
	}
	raw, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return state, err
	}
	if err := json.Unmarshal(raw, &state); err != nil {
		return state, err
	}
	if time.Now().Unix() > state.Expires {
		return state, fmt.Errorf("state expirado")
	}
	return state, nil
}

func (h *AuthHandler) googleRedirectURL(c *gin.Context) string {
	if strings.TrimSpace(h.cfg.GoogleOAuthRedirectURL) != "" {
		return strings.TrimSpace(h.cfg.GoogleOAuthRedirectURL)
	}
	scheme := "http"
	if c.Request.TLS != nil || c.GetHeader("X-Forwarded-Proto") == "https" {
		scheme = "https"
	}
	return fmt.Sprintf("%s://%s/api/auth/google/callback", scheme, c.Request.Host)
}

func (h *AuthHandler) redirectGoogleSuccess(c *gin.Context, token string, scope string, returnTo string) {
	frontend := strings.TrimRight(h.cfg.FrontendBaseURL, "/")
	target := frontend + "/auth/google/callback#token=" + url.QueryEscape(token) +
		"&scope=" + url.QueryEscape(scope) +
		"&return_to=" + url.QueryEscape(sanitizeReturnPath(returnTo, scope))
	c.Redirect(http.StatusFound, target)
}

func (h *AuthHandler) redirectGoogleError(c *gin.Context, message string, scope string, returnTo string) {
	frontend := strings.TrimRight(h.cfg.FrontendBaseURL, "/")
	target := frontend + "/auth/google/callback#error=" + url.QueryEscape(message) +
		"&scope=" + url.QueryEscape(scope) +
		"&return_to=" + url.QueryEscape(sanitizeReturnPath(returnTo, scope))
	c.Redirect(http.StatusFound, target)
}

func getTenantIDFromRequest(c *gin.Context) uint {
	if tenantHeader := strings.TrimSpace(c.GetHeader("X-Tenant-ID")); tenantHeader != "" {
		if parsed, err := strconv.Atoi(tenantHeader); err == nil && parsed > 0 {
			return uint(parsed)
		}
	}
	if tenantQuery := strings.TrimSpace(c.Query("tenant_id")); tenantQuery != "" {
		if parsed, err := strconv.Atoi(tenantQuery); err == nil && parsed > 0 {
			return uint(parsed)
		}
	}
	return 1
}

func sanitizeReturnPath(returnTo string, scope string) string {
	returnTo = strings.TrimSpace(returnTo)
	if returnTo == "" {
		if scope == "admin" || scope == "seller" {
			return "/admin"
		}
		return "/"
	}
	if !strings.HasPrefix(returnTo, "/") || strings.HasPrefix(returnTo, "//") {
		return "/"
	}
	if strings.HasPrefix(returnTo, "/auth/google/callback") {
		return "/"
	}
	return returnTo
}

func randomHex(size int) string {
	buf := make([]byte, size)
	if _, err := rand.Read(buf); err != nil {
		return hex.EncodeToString([]byte(strconv.FormatInt(time.Now().UnixNano(), 10)))
	}
	return hex.EncodeToString(buf)
}
