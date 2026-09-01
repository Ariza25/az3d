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

type decryptedMercadoLivrePlatformConfig struct {
	ClientID     string
	ClientSecret string
	RedirectURI  string
}

type mercadoLivrePlatformConfigStatus struct {
	Source                 string   `json:"source"`
	Configured             bool     `json:"configured"`
	ClientIDConfigured     bool     `json:"client_id_configured"`
	ClientSecretConfigured bool     `json:"client_secret_configured"`
	RedirectURIConfigured  bool     `json:"redirect_uri_configured"`
	Missing                []string `json:"missing"`
}

func (h *MarketplaceHandler) GetMercadoLivrePlatformConfig(c *gin.Context) {
	if !isMasterAdmin(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Apenas master_admin pode consultar a aplicacao Mercado Livre"})
		return
	}
	c.JSON(http.StatusOK, h.mercadoLivrePlatformConfigStatus())
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
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "A aplicacao OAuth do Mercado Livre nao esta configurada no ambiente da plataforma"})
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
	params.Set("client_id", platform.ClientID)
	params.Set("redirect_uri", platform.RedirectURI)
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
	connectorAccount.OAuthClientID = platform.ClientID
	connectorAccount.OAuthClientSecret = platform.ClientSecret
	token, err := mercadolivre.New().ExchangeAuthCode(c.Request.Context(), connectorAccount, marketplaces.TokenRequest{
		Code: code, RedirectURI: platform.RedirectURI, CodeVerifier: verifier,
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
	if h == nil || h.cfg == nil {
		return decryptedMercadoLivrePlatformConfig{}, fmt.Errorf("platform config is unavailable")
	}
	platform := decryptedMercadoLivrePlatformConfig{
		ClientID: strings.TrimSpace(h.cfg.MercadoLivreClientID), ClientSecret: strings.TrimSpace(h.cfg.MercadoLivreClientSecret),
		RedirectURI: strings.TrimSpace(h.cfg.MercadoLivreRedirectURI),
	}
	if platform.ClientID == "" || platform.ClientSecret == "" || platform.RedirectURI == "" {
		return decryptedMercadoLivrePlatformConfig{}, fmt.Errorf("mercado livre platform config is incomplete")
	}
	if err := validateOAuthRedirectURI(platform.RedirectURI, h.cfg.Env); err != nil {
		return decryptedMercadoLivrePlatformConfig{}, err
	}
	return platform, nil
}

func (h *MarketplaceHandler) mercadoLivrePlatformConfigStatus() mercadoLivrePlatformConfigStatus {
	status := mercadoLivrePlatformConfigStatus{Source: "environment", Missing: []string{}}
	if h == nil || h.cfg == nil {
		status.Missing = []string{"MELI_CLIENT_ID", "MELI_CLIENT_SECRET", "MELI_REDIRECT_URI"}
		return status
	}
	status.ClientIDConfigured = strings.TrimSpace(h.cfg.MercadoLivreClientID) != ""
	status.ClientSecretConfigured = strings.TrimSpace(h.cfg.MercadoLivreClientSecret) != ""
	status.RedirectURIConfigured = strings.TrimSpace(h.cfg.MercadoLivreRedirectURI) != ""
	if !status.ClientIDConfigured {
		status.Missing = append(status.Missing, "MELI_CLIENT_ID")
	}
	if !status.ClientSecretConfigured {
		status.Missing = append(status.Missing, "MELI_CLIENT_SECRET")
	}
	if !status.RedirectURIConfigured {
		status.Missing = append(status.Missing, "MELI_REDIRECT_URI")
	}
	status.Configured = len(status.Missing) == 0
	return status
}

func (h *MarketplaceHandler) mercadoLivreConnectorAccount(account models.MarketplaceAccount) (marketplaces.Account, error) {
	result := marketplaceAccountFromModel(account)
	platform, err := h.loadMercadoLivrePlatformConfig()
	if err != nil {
		return result, err
	}
	result.OAuthClientID = platform.ClientID
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
			Marketplace: "MLB", IsActive: true, SyncCatalog: true, SyncOrders: true, SyncStock: true,
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
