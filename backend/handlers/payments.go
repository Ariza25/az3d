package handlers

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"az3d-backend/config"
	"az3d-backend/database"
	"az3d-backend/models"
	"az3d-backend/utils"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	mercadoPagoProvider       = "mercadopago"
	paymentOAuthSessionTTL    = 10 * time.Minute
	paymentTokenRefreshAhead  = 24 * time.Hour
	mercadoPagoAuthorizeURL   = "https://auth.mercadopago.com/authorization"
	mercadoPagoConnectedState = "connected"
)

type MercadoPagoHandler struct {
	cfg        *config.Config
	httpClient *http.Client
	refreshMu  sync.Mutex
}

type mercadoPagoPlatformConfigInput struct {
	ClientID      string `json:"client_id" binding:"required"`
	ClientSecret  string `json:"client_secret"`
	RedirectURI   string `json:"redirect_uri" binding:"required"`
	WebhookSecret string `json:"webhook_secret"`
}

type mercadoPagoOAuthToken struct {
	AccessToken  string `json:"access_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int    `json:"expires_in"`
	Scope        string `json:"scope"`
	UserID       any    `json:"user_id"`
	RefreshToken string `json:"refresh_token"`
	PublicKey    string `json:"public_key"`
	LiveMode     bool   `json:"live_mode"`
}

type paymentAccountStatus struct {
	Provider       string     `json:"provider"`
	OAuthAvailable bool       `json:"oauth_available"`
	Connected      bool       `json:"connected"`
	Status         string     `json:"status"`
	SellerID       string     `json:"seller_id,omitempty"`
	PublicKey      string     `json:"public_key,omitempty"`
	LiveMode       bool       `json:"live_mode"`
	TokenExpiresAt *time.Time `json:"token_expires_at,omitempty"`
	ConnectedAt    *time.Time `json:"connected_at,omitempty"`
	LastError      string     `json:"last_error,omitempty"`
}

type decryptedMercadoPagoPlatformConfig struct {
	Model         models.MercadoPagoPlatformConfig
	ClientSecret  string
	WebhookSecret string
}

func NewMercadoPagoHandler(cfg *config.Config) *MercadoPagoHandler {
	return &MercadoPagoHandler{cfg: cfg, httpClient: &http.Client{Timeout: 20 * time.Second}}
}

func (h *MercadoPagoHandler) GetPlatformConfig(c *gin.Context) {
	if !isMasterAdmin(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Apenas master_admin pode configurar a aplicacao Mercado Pago"})
		return
	}
	var stored models.MercadoPagoPlatformConfig
	err := database.DB.First(&stored, 1).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusOK, models.MercadoPagoPlatformConfig{})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Nao foi possivel carregar a configuracao Mercado Pago"})
		return
	}
	stored.ClientSecretConfigured = strings.TrimSpace(stored.EncryptedClientSecret) != ""
	stored.WebhookSecretConfigured = strings.TrimSpace(stored.EncryptedWebhookSecret) != ""
	c.JSON(http.StatusOK, stored)
}

func (h *MercadoPagoHandler) SavePlatformConfig(c *gin.Context) {
	if !isMasterAdmin(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Apenas master_admin pode configurar a aplicacao Mercado Pago"})
		return
	}
	if h == nil || h.cfg == nil || len(strings.TrimSpace(h.cfg.CredentialEncryptionKey)) < 32 {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Configure uma CREDENTIAL_ENCRYPTION_KEY forte antes de salvar credenciais"})
		return
	}
	var input mercadoPagoPlatformConfigInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Configuracao Mercado Pago invalida"})
		return
	}
	input.ClientID = strings.TrimSpace(input.ClientID)
	input.RedirectURI = strings.TrimSpace(input.RedirectURI)
	if err := validateOAuthRedirectURI(input.RedirectURI, h.cfg.Env); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	stored := models.MercadoPagoPlatformConfig{ID: 1}
	result := database.DB.First(&stored, 1)
	if result.Error != nil && !errors.Is(result.Error, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Nao foi possivel carregar a configuracao atual"})
		return
	}

	if secret := strings.TrimSpace(input.ClientSecret); secret != "" {
		encrypted, err := utils.EncryptString(secret, h.cfg.CredentialEncryptionKey)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Nao foi possivel proteger o Client Secret"})
			return
		}
		stored.EncryptedClientSecret = encrypted
	}
	if secret := strings.TrimSpace(input.WebhookSecret); secret != "" {
		encrypted, err := utils.EncryptString(secret, h.cfg.CredentialEncryptionKey)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Nao foi possivel proteger o segredo do webhook"})
			return
		}
		stored.EncryptedWebhookSecret = encrypted
	}
	if stored.EncryptedClientSecret == "" || stored.EncryptedWebhookSecret == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Client Secret e segredo do webhook sao obrigatorios"})
		return
	}
	stored.ClientID = input.ClientID
	stored.RedirectURI = input.RedirectURI
	if err := database.DB.Save(&stored).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Nao foi possivel salvar a configuracao Mercado Pago"})
		return
	}
	stored.ClientSecretConfigured = true
	stored.WebhookSecretConfigured = true
	c.JSON(http.StatusOK, stored)
}

func (h *MercadoPagoHandler) GetTenantStatus(c *gin.Context) {
	c.JSON(http.StatusOK, h.statusForTenant(getTenantID(c)))
}

func (h *MercadoPagoHandler) StartOAuth(c *gin.Context) {
	tenantID := getTenantID(c)
	if tenantID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tenant invalido"})
		return
	}
	platform, err := h.loadPlatformConfig()
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "A aplicacao OAuth do Mercado Pago ainda nao foi configurada pelo master_admin"})
		return
	}
	state, err := randomPaymentOAuthValue(32)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Nao foi possivel iniciar a autorizacao"})
		return
	}
	verifier, err := randomPaymentOAuthValue(64)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Nao foi possivel iniciar a autorizacao"})
		return
	}
	encryptedVerifier, err := utils.EncryptString(verifier, h.cfg.CredentialEncryptionKey)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Nao foi possivel proteger a sessao OAuth"})
		return
	}
	_ = database.DB.Where("expires_at < ? OR used_at IS NOT NULL", time.Now()).Delete(&models.PaymentOAuthSession{}).Error
	session := models.PaymentOAuthSession{
		StateHash:             hashPaymentOAuthState(state),
		TenantID:              tenantID,
		EncryptedCodeVerifier: encryptedVerifier,
		ExpiresAt:             time.Now().UTC().Add(paymentOAuthSessionTTL),
	}
	if err := database.DB.Create(&session).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Nao foi possivel salvar a sessao OAuth"})
		return
	}
	params := url.Values{
		"client_id":             {platform.Model.ClientID},
		"response_type":         {"code"},
		"platform_id":           {"mp"},
		"state":                 {state},
		"redirect_uri":          {platform.Model.RedirectURI},
		"code_challenge":        {paymentPKCEChallenge(verifier)},
		"code_challenge_method": {"S256"},
	}
	c.JSON(http.StatusOK, gin.H{"authorization_url": mercadoPagoAuthorizeURL + "?" + params.Encode()})
}

func (h *MercadoPagoHandler) OAuthCallback(c *gin.Context) {
	state := strings.TrimSpace(c.Query("state"))
	code := strings.TrimSpace(c.Query("code"))
	if oauthErr := strings.TrimSpace(c.Query("error")); oauthErr != "" {
		session, _ := consumePaymentOAuthSession(state)
		h.redirectOAuthResult(c, "denied", session.TenantID)
		return
	}
	if state == "" || code == "" {
		h.redirectOAuthResult(c, "error", 0)
		return
	}

	session, err := consumePaymentOAuthSession(state)
	if err != nil {
		h.redirectOAuthResult(c, "error", 0)
		return
	}
	verifier, err := utils.DecryptString(session.EncryptedCodeVerifier, h.cfg.CredentialEncryptionKey)
	if err != nil {
		h.redirectOAuthResult(c, "error", session.TenantID)
		return
	}
	platform, err := h.loadPlatformConfig()
	if err != nil {
		h.redirectOAuthResult(c, "error", session.TenantID)
		return
	}
	token, err := h.exchangeAuthorizationCode(c.Request.Context(), platform, code, verifier)
	if err != nil {
		h.recordTenantPaymentError(session.TenantID, err)
		h.redirectOAuthResult(c, "error", session.TenantID)
		return
	}
	if err := h.saveTenantOAuthToken(session.TenantID, token, ""); err != nil {
		h.recordTenantPaymentError(session.TenantID, err)
		h.redirectOAuthResult(c, "error", session.TenantID)
		return
	}
	h.redirectOAuthResult(c, mercadoPagoConnectedState, session.TenantID)
}

func (h *MercadoPagoHandler) RefreshOAuth(c *gin.Context) {
	tenantID := getTenantID(c)
	if _, err := h.refreshTenantToken(c.Request.Context(), tenantID, true); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "Nao foi possivel renovar a conexao Mercado Pago"})
		return
	}
	c.JSON(http.StatusOK, h.statusForTenant(tenantID))
}

func (h *MercadoPagoHandler) DisconnectOAuth(c *gin.Context) {
	tenantID := getTenantID(c)
	updates := map[string]any{
		"encrypted_access_token": "", "encrypted_refresh_token": "", "token_expires_at": nil,
		"status": "disconnected", "last_error": "", "connected_at": nil,
	}
	result := database.DB.Model(&models.TenantPaymentAccount{}).Where("tenant_id = ? AND provider = ?", tenantID, mercadoPagoProvider).Updates(updates)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Nao foi possivel desconectar o Mercado Pago"})
		return
	}
	c.JSON(http.StatusOK, h.statusForTenant(tenantID))
}

func (h *MercadoPagoHandler) AccessTokenForTenant(ctx context.Context, tenantID uint) (string, error) {
	account, err := h.refreshTenantToken(ctx, tenantID, false)
	if err != nil {
		return "", err
	}
	accessToken, err := utils.DecryptString(account.EncryptedAccessToken, h.cfg.CredentialEncryptionKey)
	if err != nil || strings.TrimSpace(accessToken) == "" {
		return "", fmt.Errorf("credencial Mercado Pago do tenant indisponivel")
	}
	return accessToken, nil
}

func (h *MercadoPagoHandler) WebhookSecret() (string, error) {
	platform, err := h.loadPlatformConfig()
	if err != nil {
		return "", err
	}
	return platform.WebhookSecret, nil
}

func (h *MercadoPagoHandler) statusForTenant(tenantID uint) paymentAccountStatus {
	status := paymentAccountStatus{Provider: mercadoPagoProvider, Status: "disconnected"}
	if _, err := h.loadPlatformConfig(); err == nil {
		status.OAuthAvailable = true
	}
	var account models.TenantPaymentAccount
	if err := database.DB.Where("tenant_id = ? AND provider = ?", tenantID, mercadoPagoProvider).First(&account).Error; err != nil {
		return status
	}
	status.Connected = account.Status == mercadoPagoConnectedState && account.EncryptedAccessToken != ""
	status.Status = account.Status
	status.SellerID = account.SellerID
	status.PublicKey = account.PublicKey
	status.LiveMode = account.LiveMode
	status.TokenExpiresAt = account.TokenExpiresAt
	status.ConnectedAt = account.ConnectedAt
	status.LastError = account.LastError
	return status
}

func (h *MercadoPagoHandler) loadPlatformConfig() (decryptedMercadoPagoPlatformConfig, error) {
	if h == nil || h.cfg == nil || len(strings.TrimSpace(h.cfg.CredentialEncryptionKey)) < 32 {
		return decryptedMercadoPagoPlatformConfig{}, fmt.Errorf("credential encryption key is not configured")
	}
	var stored models.MercadoPagoPlatformConfig
	if err := database.DB.First(&stored, 1).Error; err != nil {
		return decryptedMercadoPagoPlatformConfig{}, err
	}
	clientSecret, err := utils.DecryptString(stored.EncryptedClientSecret, h.cfg.CredentialEncryptionKey)
	if err != nil {
		return decryptedMercadoPagoPlatformConfig{}, err
	}
	webhookSecret, err := utils.DecryptString(stored.EncryptedWebhookSecret, h.cfg.CredentialEncryptionKey)
	if err != nil {
		return decryptedMercadoPagoPlatformConfig{}, err
	}
	if strings.TrimSpace(stored.ClientID) == "" || strings.TrimSpace(clientSecret) == "" || strings.TrimSpace(stored.RedirectURI) == "" || strings.TrimSpace(webhookSecret) == "" {
		return decryptedMercadoPagoPlatformConfig{}, fmt.Errorf("mercado pago platform config is incomplete")
	}
	return decryptedMercadoPagoPlatformConfig{Model: stored, ClientSecret: clientSecret, WebhookSecret: webhookSecret}, nil
}

func (h *MercadoPagoHandler) refreshTenantToken(ctx context.Context, tenantID uint, force bool) (models.TenantPaymentAccount, error) {
	if tenantID == 0 {
		return models.TenantPaymentAccount{}, fmt.Errorf("tenant is required")
	}
	h.refreshMu.Lock()
	defer h.refreshMu.Unlock()

	var account models.TenantPaymentAccount
	if err := database.DB.Where("tenant_id = ? AND provider = ?", tenantID, mercadoPagoProvider).First(&account).Error; err != nil {
		return account, err
	}
	if account.Status != mercadoPagoConnectedState || account.EncryptedAccessToken == "" {
		return account, fmt.Errorf("tenant Mercado Pago account is not connected")
	}
	if !force && account.TokenExpiresAt != nil && account.TokenExpiresAt.After(time.Now().UTC().Add(paymentTokenRefreshAhead)) {
		return account, nil
	}
	if !force && account.TokenExpiresAt == nil {
		return account, nil
	}
	refreshToken, err := utils.DecryptString(account.EncryptedRefreshToken, h.cfg.CredentialEncryptionKey)
	if err != nil || strings.TrimSpace(refreshToken) == "" {
		return account, fmt.Errorf("refresh token do tenant indisponivel")
	}
	platform, err := h.loadPlatformConfig()
	if err != nil {
		return account, err
	}
	token, err := h.exchangeRefreshToken(ctx, platform, refreshToken)
	if err != nil {
		h.recordTenantPaymentError(tenantID, err)
		return account, err
	}
	if err := h.saveTenantOAuthToken(tenantID, token, refreshToken); err != nil {
		return account, err
	}
	if err := database.DB.Where("tenant_id = ? AND provider = ?", tenantID, mercadoPagoProvider).First(&account).Error; err != nil {
		return account, err
	}
	return account, nil
}

func (h *MercadoPagoHandler) exchangeAuthorizationCode(ctx context.Context, platform decryptedMercadoPagoPlatformConfig, code string, verifier string) (mercadoPagoOAuthToken, error) {
	return h.postOAuthToken(ctx, map[string]any{
		"client_id": platform.Model.ClientID, "client_secret": platform.ClientSecret,
		"grant_type": "authorization_code", "code": code, "redirect_uri": platform.Model.RedirectURI,
		"code_verifier": verifier,
	})
}

func (h *MercadoPagoHandler) exchangeRefreshToken(ctx context.Context, platform decryptedMercadoPagoPlatformConfig, refreshToken string) (mercadoPagoOAuthToken, error) {
	return h.postOAuthToken(ctx, map[string]any{
		"client_id": platform.Model.ClientID, "client_secret": platform.ClientSecret,
		"grant_type": "refresh_token", "refresh_token": refreshToken,
	})
}

func (h *MercadoPagoHandler) postOAuthToken(ctx context.Context, payload map[string]any) (mercadoPagoOAuthToken, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return mercadoPagoOAuthToken{}, err
	}
	baseURL := strings.TrimRight(getEnv("MERCADO_PAGO_API_BASE_URL", "https://api.mercadopago.com"), "/")
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, baseURL+"/oauth/token", bytes.NewReader(body))
	if err != nil {
		return mercadoPagoOAuthToken{}, err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/json")
	res, err := h.httpClient.Do(req)
	if err != nil {
		return mercadoPagoOAuthToken{}, err
	}
	defer res.Body.Close()
	responseBody, err := io.ReadAll(io.LimitReader(res.Body, 2<<20))
	if err != nil {
		return mercadoPagoOAuthToken{}, err
	}
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return mercadoPagoOAuthToken{}, fmt.Errorf("Mercado Pago OAuth retornou HTTP %d", res.StatusCode)
	}
	var token mercadoPagoOAuthToken
	decoder := json.NewDecoder(bytes.NewReader(responseBody))
	decoder.UseNumber()
	if err := decoder.Decode(&token); err != nil {
		return token, err
	}
	if strings.TrimSpace(token.AccessToken) == "" || strings.TrimSpace(token.RefreshToken) == "" {
		return token, fmt.Errorf("Mercado Pago OAuth retornou credenciais incompletas")
	}
	return token, nil
}

func (h *MercadoPagoHandler) saveTenantOAuthToken(tenantID uint, token mercadoPagoOAuthToken, previousRefreshToken string) error {
	accessToken := strings.TrimSpace(token.AccessToken)
	refreshToken := strings.TrimSpace(token.RefreshToken)
	if refreshToken == "" {
		refreshToken = strings.TrimSpace(previousRefreshToken)
	}
	if accessToken == "" || refreshToken == "" {
		return fmt.Errorf("oauth token incompleto")
	}
	encryptedAccess, err := utils.EncryptString(accessToken, h.cfg.CredentialEncryptionKey)
	if err != nil {
		return err
	}
	encryptedRefresh, err := utils.EncryptString(refreshToken, h.cfg.CredentialEncryptionKey)
	if err != nil {
		return err
	}
	now := time.Now().UTC()
	expiresAt := now.Add(time.Duration(token.ExpiresIn) * time.Second)
	account := models.TenantPaymentAccount{}
	result := database.DB.Where("tenant_id = ? AND provider = ?", tenantID, mercadoPagoProvider).First(&account)
	if result.Error != nil && !errors.Is(result.Error, gorm.ErrRecordNotFound) {
		return result.Error
	}
	account.TenantID = tenantID
	account.Provider = mercadoPagoProvider
	if sellerID := mercadoPagoUserID(token.UserID); sellerID != "" {
		account.SellerID = sellerID
	}
	if publicKey := strings.TrimSpace(token.PublicKey); publicKey != "" {
		account.PublicKey = publicKey
	}
	account.EncryptedAccessToken = encryptedAccess
	account.EncryptedRefreshToken = encryptedRefresh
	account.TokenExpiresAt = &expiresAt
	if scope := strings.TrimSpace(token.Scope); scope != "" {
		account.Scope = scope
	}
	account.LiveMode = token.LiveMode
	account.Status = mercadoPagoConnectedState
	account.LastError = ""
	if account.ConnectedAt == nil {
		account.ConnectedAt = &now
	}
	return database.DB.Save(&account).Error
}

func consumePaymentOAuthSession(state string) (models.PaymentOAuthSession, error) {
	var session models.PaymentOAuthSession
	if strings.TrimSpace(state) == "" {
		return session, fmt.Errorf("oauth state ausente")
	}
	err := database.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("state_hash = ? AND used_at IS NULL AND expires_at > ?", hashPaymentOAuthState(state), time.Now().UTC()).First(&session).Error; err != nil {
			return err
		}
		now := time.Now().UTC()
		return tx.Model(&session).Update("used_at", &now).Error
	})
	return session, err
}

func (h *MercadoPagoHandler) recordTenantPaymentError(tenantID uint, cause error) {
	message := "Falha ao conectar ou renovar Mercado Pago"
	if cause != nil {
		message = cause.Error()
	}
	account := models.TenantPaymentAccount{TenantID: tenantID, Provider: mercadoPagoProvider}
	result := database.DB.Where("tenant_id = ? AND provider = ?", tenantID, mercadoPagoProvider).First(&account)
	if errors.Is(result.Error, gorm.ErrRecordNotFound) {
		account.Status = "error"
		account.LastError = message
		_ = database.DB.Create(&account).Error
		return
	}
	_ = database.DB.Model(&account).Updates(map[string]any{"status": "error", "last_error": message}).Error
}

func (h *MercadoPagoHandler) redirectOAuthResult(c *gin.Context, result string, tenantID uint) {
	baseURL := "http://localhost:5173"
	if h != nil && h.cfg != nil && strings.TrimSpace(h.cfg.FrontendBaseURL) != "" {
		baseURL = strings.TrimRight(h.cfg.FrontendBaseURL, "/")
	}
	params := url.Values{"payment_oauth": {result}}
	if tenantID > 0 {
		params.Set("tenant_id", strconv.FormatUint(uint64(tenantID), 10))
	}
	http.Redirect(c.Writer, c.Request, baseURL+"/admin?"+params.Encode(), http.StatusSeeOther)
}

func validateOAuthRedirectURI(value string, environment string) error {
	parsed, err := url.ParseRequestURI(value)
	if err != nil || parsed.Host == "" || (parsed.Scheme != "https" && parsed.Scheme != "http") {
		return fmt.Errorf("Redirect URI invalida")
	}
	if strings.EqualFold(strings.TrimSpace(environment), "production") && parsed.Scheme != "https" {
		return fmt.Errorf("Redirect URI deve usar HTTPS em producao")
	}
	return nil
}

func randomPaymentOAuthValue(size int) (string, error) {
	value := make([]byte, size)
	if _, err := rand.Read(value); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(value), nil
}

func hashPaymentOAuthState(value string) string {
	sum := sha256.Sum256([]byte(value))
	return hex.EncodeToString(sum[:])
}

func paymentPKCEChallenge(verifier string) string {
	sum := sha256.Sum256([]byte(verifier))
	return base64.RawURLEncoding.EncodeToString(sum[:])
}

func mercadoPagoUserID(value any) string {
	switch typed := value.(type) {
	case json.Number:
		return typed.String()
	case string:
		return strings.TrimSpace(typed)
	case float64:
		return strconv.FormatInt(int64(typed), 10)
	case int64:
		return strconv.FormatInt(typed, 10)
	case int:
		return strconv.Itoa(typed)
	default:
		return ""
	}
}
