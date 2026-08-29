package handlers

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"az3d-backend/database"
	"az3d-backend/internal/marketplaces"
	"az3d-backend/internal/marketplaces/mercadolivre"
	"az3d-backend/models"
	"az3d-backend/utils"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	mercadoLivreProvider         = "mercadolivre"
	marketplaceOAuthSessionTTL   = 10 * time.Minute
	mercadoLivreAuthorizationURL = "https://auth.mercadolivre.com.br/authorization"
)

type mercadoLivrePlatformConfigInput struct {
	ClientID     string `json:"client_id" binding:"required"`
	ClientSecret string `json:"client_secret"`
	RedirectURI  string `json:"redirect_uri" binding:"required"`
}

type decryptedMercadoLivrePlatformConfig struct {
	Model        models.MercadoLivrePlatformConfig
	ClientSecret string
}

func (h *MarketplaceHandler) GetMercadoLivrePlatformConfig(c *gin.Context) {
	if !isMasterAdmin(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Apenas master_admin pode configurar a aplicacao Mercado Livre"})
		return
	}
	var stored models.MercadoLivrePlatformConfig
	err := database.DB.First(&stored, 1).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusOK, models.MercadoLivrePlatformConfig{})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Nao foi possivel carregar a configuracao Mercado Livre"})
		return
	}
	stored.ClientSecretConfigured = strings.TrimSpace(stored.EncryptedClientSecret) != ""
	c.JSON(http.StatusOK, stored)
}

func (h *MarketplaceHandler) SaveMercadoLivrePlatformConfig(c *gin.Context) {
	if !isMasterAdmin(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Apenas master_admin pode configurar a aplicacao Mercado Livre"})
		return
	}
	secret := h.credentialEncryptionKey()
	if len(secret) < 32 {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Configure uma CREDENTIAL_ENCRYPTION_KEY forte antes de salvar credenciais"})
		return
	}
	var input mercadoLivrePlatformConfigInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Configuracao Mercado Livre invalida"})
		return
	}
	input.ClientID = strings.TrimSpace(input.ClientID)
	input.RedirectURI = strings.TrimSpace(input.RedirectURI)
	environment := strings.TrimSpace(os.Getenv("ENV"))
	if h != nil && h.cfg != nil {
		environment = h.cfg.Env
	}
	if err := validateOAuthRedirectURI(input.RedirectURI, environment); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	stored := models.MercadoLivrePlatformConfig{ID: 1}
	result := database.DB.First(&stored, 1)
	if result.Error != nil && !errors.Is(result.Error, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Nao foi possivel carregar a configuracao atual"})
		return
	}
	if clientSecret := strings.TrimSpace(input.ClientSecret); clientSecret != "" {
		encrypted, err := utils.EncryptString(clientSecret, secret)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Nao foi possivel proteger o Client Secret"})
			return
		}
		stored.EncryptedClientSecret = encrypted
	}
	if stored.EncryptedClientSecret == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Client Secret obrigatorio"})
		return
	}
	stored.ClientID = input.ClientID
	stored.RedirectURI = input.RedirectURI
	if err := database.DB.Save(&stored).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Nao foi possivel salvar a aplicacao Mercado Livre"})
		return
	}
	stored.ClientSecretConfigured = true
	c.JSON(http.StatusOK, stored)
}

func (h *MarketplaceHandler) StartMercadoLivreOAuthForTenant(c *gin.Context) {
	tenantID64, err := strconv.ParseUint(strings.TrimSpace(c.Param("tenant_id")), 10, 64)
	if err != nil || tenantID64 == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tenant invalido"})
		return
	}
	h.startMercadoLivreOAuth(c, uint(tenantID64))
}

func (h *MarketplaceHandler) startMercadoLivreOAuth(c *gin.Context, tenantID uint) {
	if !tenantExists(tenantID) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Tenant nao encontrado"})
		return
	}
	platform, err := h.loadMercadoLivrePlatformConfig()
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "A aplicacao OAuth do Mercado Livre ainda nao foi configurada pelo master_admin"})
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
	encryptedVerifier, err := utils.EncryptString(verifier, h.credentialEncryptionKey())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Nao foi possivel proteger a sessao OAuth"})
		return
	}
	_ = database.DB.Where("expires_at < ? OR used_at IS NOT NULL", time.Now().UTC()).Delete(&models.MarketplaceOAuthSession{}).Error
	session := models.MarketplaceOAuthSession{
		StateHash:             hashMarketplaceOAuthState(state),
		TenantID:              tenantID,
		Provider:              mercadoLivreProvider,
		EncryptedCodeVerifier: encryptedVerifier,
		ExpiresAt:             time.Now().UTC().Add(marketplaceOAuthSessionTTL),
	}
	if err := database.DB.Create(&session).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Nao foi possivel salvar a sessao OAuth"})
		return
	}
	authorizationEndpoint := strings.TrimSpace(os.Getenv("MELI_OAUTH_AUTH_URL"))
	if authorizationEndpoint == "" {
		authorizationEndpoint = mercadoLivreAuthorizationURL
	}
	endpoint, _ := url.Parse(authorizationEndpoint)
	params := endpoint.Query()
	params.Set("response_type", "code")
	params.Set("client_id", platform.Model.ClientID)
	params.Set("redirect_uri", platform.Model.RedirectURI)
	params.Set("state", state)
	params.Set("code_challenge", paymentPKCEChallenge(verifier))
	params.Set("code_challenge_method", "S256")
	endpoint.RawQuery = params.Encode()
	c.JSON(http.StatusOK, gin.H{
		"provider": mercadoLivreProvider, "state": state,
		"auth_url": endpoint.String(), "authorization_url": endpoint.String(),
		"missing_config": []string{}, "mode": "oauth_url",
	})
}

func (h *MarketplaceHandler) MercadoLivreOAuthCallback(c *gin.Context) {
	state := strings.TrimSpace(c.Query("state"))
	code := strings.TrimSpace(c.Query("code"))
	if oauthErr := strings.TrimSpace(c.Query("error")); oauthErr != "" {
		session, _ := consumeMarketplaceOAuthSession(state, mercadoLivreProvider)
		h.redirectMarketplaceOAuthResult(c, "denied", session.TenantID)
		return
	}
	if state == "" || code == "" {
		h.redirectMarketplaceOAuthResult(c, "error", 0)
		return
	}
	session, err := consumeMarketplaceOAuthSession(state, mercadoLivreProvider)
	if err != nil {
		h.redirectMarketplaceOAuthResult(c, "error", 0)
		return
	}
	verifier, err := utils.DecryptString(session.EncryptedCodeVerifier, h.credentialEncryptionKey())
	if err != nil {
		h.recordMercadoLivreOAuthError(session.TenantID, "Sessao OAuth invalida")
		h.redirectMarketplaceOAuthResult(c, "error", session.TenantID)
		return
	}
	platform, err := h.loadMercadoLivrePlatformConfig()
	if err != nil {
		h.recordMercadoLivreOAuthError(session.TenantID, "Aplicacao Mercado Livre indisponivel")
		h.redirectMarketplaceOAuthResult(c, "error", session.TenantID)
		return
	}
	account, err := getOrCreateMercadoLivreAccount(session.TenantID)
	if err != nil {
		h.redirectMarketplaceOAuthResult(c, "error", session.TenantID)
		return
	}
	connectorAccount := marketplaceAccountFromModel(account)
	connectorAccount.OAuthClientID = platform.Model.ClientID
	connectorAccount.OAuthClientSecret = platform.ClientSecret
	token, err := mercadolivre.New().ExchangeAuthCode(c.Request.Context(), connectorAccount, marketplaces.TokenRequest{
		Code: code, RedirectURI: platform.Model.RedirectURI, CodeVerifier: verifier,
	})
	if err != nil {
		h.recordMercadoLivreOAuthError(session.TenantID, marketplaceConnectorErrorMessage(err))
		h.redirectMarketplaceOAuthResult(c, "error", session.TenantID)
		return
	}
	applyMarketplaceTokenResult(&account, token)
	account.IsActive = true
	account.SyncStatus = "connected"
	account.LastError = ""
	if err := database.DB.Save(&account).Error; err != nil {
		h.redirectMarketplaceOAuthResult(c, "error", session.TenantID)
		return
	}
	syncLegacyIntegration(session.TenantID, account)
	h.redirectMarketplaceOAuthResult(c, "connected", session.TenantID)
}

func (h *MarketplaceHandler) loadMercadoLivrePlatformConfig() (decryptedMercadoLivrePlatformConfig, error) {
	secret := h.credentialEncryptionKey()
	if len(secret) < 32 {
		return decryptedMercadoLivrePlatformConfig{}, fmt.Errorf("credential encryption key is not configured")
	}
	var stored models.MercadoLivrePlatformConfig
	if err := database.DB.First(&stored, 1).Error; err != nil {
		return decryptedMercadoLivrePlatformConfig{}, err
	}
	clientSecret, err := utils.DecryptString(stored.EncryptedClientSecret, secret)
	if err != nil {
		return decryptedMercadoLivrePlatformConfig{}, err
	}
	if strings.TrimSpace(stored.ClientID) == "" || strings.TrimSpace(clientSecret) == "" || strings.TrimSpace(stored.RedirectURI) == "" {
		return decryptedMercadoLivrePlatformConfig{}, fmt.Errorf("mercado livre platform config is incomplete")
	}
	return decryptedMercadoLivrePlatformConfig{Model: stored, ClientSecret: clientSecret}, nil
}

func (h *MarketplaceHandler) mercadoLivreConnectorAccount(account models.MarketplaceAccount) (marketplaces.Account, error) {
	result := marketplaceAccountFromModel(account)
	platform, err := h.loadMercadoLivrePlatformConfig()
	if err != nil {
		return result, err
	}
	result.OAuthClientID = platform.Model.ClientID
	result.OAuthClientSecret = platform.ClientSecret
	return result, nil
}

func (h *MarketplaceHandler) credentialEncryptionKey() string {
	if h != nil && h.cfg != nil && strings.TrimSpace(h.cfg.CredentialEncryptionKey) != "" {
		return strings.TrimSpace(h.cfg.CredentialEncryptionKey)
	}
	return strings.TrimSpace(os.Getenv("CREDENTIAL_ENCRYPTION_KEY"))
}

func getOrCreateMercadoLivreAccount(tenantID uint) (models.MarketplaceAccount, error) {
	var account models.MarketplaceAccount
	err := database.DB.Where("tenant_id = ? AND provider = ?", tenantID, mercadoLivreProvider).First(&account).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		account = models.MarketplaceAccount{
			TenantID: tenantID, Provider: mercadoLivreProvider, AccountName: "Mercado Livre",
			Marketplace: "MLB", IsActive: true, SyncOrders: true, SyncStock: true,
		}
		return account, nil
	}
	return account, err
}

func consumeMarketplaceOAuthSession(state, provider string) (models.MarketplaceOAuthSession, error) {
	var session models.MarketplaceOAuthSession
	if strings.TrimSpace(state) == "" {
		return session, fmt.Errorf("oauth state ausente")
	}
	err := database.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("state_hash = ? AND provider = ? AND used_at IS NULL AND expires_at > ?", hashMarketplaceOAuthState(state), provider, time.Now().UTC()).
			First(&session).Error; err != nil {
			return err
		}
		now := time.Now().UTC()
		return tx.Model(&session).Update("used_at", &now).Error
	})
	return session, err
}

func hashMarketplaceOAuthState(value string) string {
	sum := sha256.Sum256([]byte(value))
	return hex.EncodeToString(sum[:])
}

func tenantExists(tenantID uint) bool {
	if tenantID == 0 {
		return false
	}
	var count int64
	database.DB.Model(&models.Tenant{}).Where("id = ?", tenantID).Count(&count)
	return count == 1
}

func (h *MarketplaceHandler) recordMercadoLivreOAuthError(tenantID uint, message string) {
	account, err := getOrCreateMercadoLivreAccount(tenantID)
	if err != nil {
		return
	}
	account.IsConnected = false
	account.SyncStatus = "oauth_error"
	account.LastError = message
	_ = database.DB.Save(&account).Error
}

func (h *MarketplaceHandler) redirectMarketplaceOAuthResult(c *gin.Context, result string, tenantID uint) {
	baseURL := "http://localhost:5173"
	if h != nil && h.cfg != nil && strings.TrimSpace(h.cfg.FrontendBaseURL) != "" {
		baseURL = strings.TrimRight(h.cfg.FrontendBaseURL, "/")
	}
	params := url.Values{"marketplace_oauth": {result}, "provider": {mercadoLivreProvider}}
	if tenantID > 0 {
		params.Set("tenant_id", strconv.FormatUint(uint64(tenantID), 10))
	}
	http.Redirect(c.Writer, c.Request, baseURL+"/admin?"+params.Encode(), http.StatusSeeOther)
}
