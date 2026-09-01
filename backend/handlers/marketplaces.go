package handlers

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"az3d-backend/config"
	"az3d-backend/database"
	"az3d-backend/internal/marketplaces"
	"az3d-backend/internal/marketplaces/amazon"
	"az3d-backend/internal/marketplaces/mercadolivre"
	"az3d-backend/internal/marketplaces/shopee"
	"az3d-backend/models"
	"az3d-backend/utils"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type MarketplaceHandler struct {
	cfg *config.Config
}

func NewMarketplaceHandler(configs ...*config.Config) *MarketplaceHandler {
	var cfg *config.Config
	if len(configs) > 0 {
		cfg = configs[0]
	}
	return &MarketplaceHandler{cfg: cfg}
}

func marketplaceConnectorRegistry() marketplaces.Registry {
	return marketplaces.NewRegistry(
		shopee.New(),
		mercadolivre.New(),
		amazon.New(),
	)
}

func defaultTenantMarketplaceSettings(tenantID uint) models.TenantMarketplaceSettings {
	return models.TenantMarketplaceSettings{
		TenantID:                   tenantID,
		MarketplaceControlsPrice:   true,
		MarketplaceControlsStock:   true,
		ContentSyncPolicy:          "imported_only",
		NewImportedProductStatus:   "active",
		AutoCreateInternalOrders:   true,
		AutoCreateFinancialEntries: true,
	}
}

func getOrCreateTenantMarketplaceSettings(tenantID uint) (models.TenantMarketplaceSettings, error) {
	var settings models.TenantMarketplaceSettings
	err := database.DB.Where("tenant_id = ?", tenantID).First(&settings).Error
	if err == nil {
		return normalizeTenantMarketplaceSettings(settings), nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return settings, err
	}

	settings = defaultTenantMarketplaceSettings(tenantID)
	err = database.DB.Create(&settings).Error
	return normalizeTenantMarketplaceSettings(settings), err
}

func normalizeTenantMarketplaceSettings(settings models.TenantMarketplaceSettings) models.TenantMarketplaceSettings {
	settings.ContentSyncPolicy = normalizeContentSyncPolicy(settings.ContentSyncPolicy)
	settings.NewImportedProductStatus = normalizeImportedProductStatus(settings.NewImportedProductStatus)
	return settings
}

func normalizeContentSyncPolicy(policy string) string {
	switch strings.ToLower(strings.TrimSpace(policy)) {
	case "always", "never", "imported_only":
		return strings.ToLower(strings.TrimSpace(policy))
	default:
		return "imported_only"
	}
}

func normalizeImportedProductStatus(status string) string {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "active", "draft":
		return strings.ToLower(strings.TrimSpace(status))
	default:
		return "active"
	}
}

// GET /api/admin/marketplaces/settings
func (h *MarketplaceHandler) GetMarketplaceSettings(c *gin.Context) {
	settings, err := getOrCreateTenantMarketplaceSettings(getTenantID(c))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao carregar configuracoes de marketplace"})
		return
	}
	c.JSON(http.StatusOK, settings)
}

// PATCH /api/admin/marketplaces/settings
func (h *MarketplaceHandler) UpdateMarketplaceSettings(c *gin.Context) {
	tenantID := getTenantID(c)
	var input models.TenantMarketplaceSettingsInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Dados invalidos: " + err.Error()})
		return
	}

	settings, err := getOrCreateTenantMarketplaceSettings(tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao carregar configuracoes de marketplace"})
		return
	}
	settings.MarketplaceControlsPrice = input.MarketplaceControlsPrice
	settings.MarketplaceControlsStock = input.MarketplaceControlsStock
	settings.ContentSyncPolicy = normalizeContentSyncPolicy(input.ContentSyncPolicy)
	settings.NewImportedProductStatus = normalizeImportedProductStatus(input.NewImportedProductStatus)
	settings.AutoCreateInternalOrders = input.AutoCreateInternalOrders
	settings.AutoCreateFinancialEntries = input.AutoCreateFinancialEntries

	if err := database.DB.Save(&settings).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao salvar configuracoes de marketplace"})
		return
	}
	c.JSON(http.StatusOK, normalizeTenantMarketplaceSettings(settings))
}

var marketplaceLabels = map[string]string{
	"mercadolivre": "Mercado Livre",
	"shopee":       "Shopee",
	"amazon":       "Amazon Seller",
}

func normalizeProvider(provider string) string {
	provider = strings.ToLower(strings.TrimSpace(provider))
	switch provider {
	case "meli", "mercado_livre", "mercado-livre", "ml":
		return "mercadolivre"
	case "amazonbr", "amazon_br", "amazon-seller":
		return "amazon"
	default:
		return provider
	}
}

func marketplaceLabel(provider string) string {
	if label, ok := marketplaceLabels[provider]; ok {
		return label
	}
	return "Marketplace"
}

func providerDefaultMarketplace(provider string) string {
	switch provider {
	case "mercadolivre":
		return "MLB"
	case "amazon", "shopee":
		return "BR"
	default:
		return ""
	}
}

func safeState(tenantID uint, provider string) string {
	return fmt.Sprintf("tenant_%d_%s_%d", tenantID, provider, time.Now().Unix())
}

func syncLegacyIntegration(tenantID uint, account models.MarketplaceAccount) {
	var integration models.MarketplaceIntegration
	err := database.DB.Where("tenant_id = ? AND provider = ?", tenantID, account.Provider).First(&integration).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		integration = models.MarketplaceIntegration{
			TenantID:   tenantID,
			Provider:   account.Provider,
			SellerID:   account.SellerID,
			SellerName: account.AccountName,
			IsActive:   account.IsActive,
			SyncOrders: account.SyncOrders,
			SyncStock:  account.SyncStock,
			ExpiresAt:  time.Now().Add(30 * 24 * time.Hour),
		}
		_ = database.DB.Create(&integration).Error
		return
	}
	if err != nil {
		return
	}

	integration.SellerID = account.SellerID
	if strings.TrimSpace(account.AccountName) != "" {
		integration.SellerName = account.AccountName
	}
	integration.IsActive = account.IsActive
	integration.SyncOrders = account.SyncOrders
	integration.SyncStock = account.SyncStock
	_ = database.DB.Save(&integration).Error
}

func ensureMarketplaceAccounts(tenantID uint) {
	for _, provider := range []string{"mercadolivre"} {
		account := models.MarketplaceAccount{
			TenantID:    tenantID,
			Provider:    provider,
			AccountName: marketplaceLabel(provider),
			Marketplace: providerDefaultMarketplace(provider),
			IsActive:    provider != "amazon",
			SyncOrders:  true,
			SyncCatalog: true,
			SyncStock:   true,
			SyncStatus:  "pending_credentials",
		}
		database.DB.Where("tenant_id = ? AND provider = ?", tenantID, provider).FirstOrCreate(&account)
	}
}

// GET /api/admin/marketplaces
func (h *MarketplaceHandler) GetMarketplaceIntegrations(c *gin.Context) {
	tenantID := getTenantID(c)

	var integrations []models.MarketplaceIntegration
	if err := database.DB.Where("tenant_id = ?", tenantID).Find(&integrations).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao buscar integracoes de marketplaces"})
		return
	}

	c.JSON(http.StatusOK, integrations)
}

// POST /api/admin/marketplaces
func (h *MarketplaceHandler) SaveMarketplaceIntegration(c *gin.Context) {
	tenantID := getTenantID(c)

	var input models.MarketplaceIntegrationInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Dados invalidos: " + err.Error()})
		return
	}
	input.Provider = normalizeProvider(input.Provider)

	var integration models.MarketplaceIntegration
	err := database.DB.Where("tenant_id = ? AND provider = ?", tenantID, input.Provider).First(&integration).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		integration = models.MarketplaceIntegration{
			TenantID:   tenantID,
			Provider:   input.Provider,
			SellerID:   input.SellerID,
			SellerName: input.SellerName,
			IsActive:   input.IsActive,
			SyncOrders: input.SyncOrders,
			SyncStock:  input.SyncStock,
			ExpiresAt:  time.Now().Add(30 * 24 * time.Hour),
		}
		if err := database.DB.Create(&integration).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao salvar integracao"})
			return
		}
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao buscar integracao"})
		return
	} else {
		integration.SellerID = input.SellerID
		if input.SellerName != "" {
			integration.SellerName = input.SellerName
		}
		integration.IsActive = input.IsActive
		integration.SyncOrders = input.SyncOrders
		integration.SyncStock = input.SyncStock
		if err := database.DB.Save(&integration).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao atualizar integracao"})
			return
		}
	}

	account := models.MarketplaceAccount{
		TenantID:    tenantID,
		Provider:    input.Provider,
		AccountName: input.SellerName,
		SellerID:    input.SellerID,
		Marketplace: providerDefaultMarketplace(input.Provider),
		IsActive:    input.IsActive,
		SyncOrders:  input.SyncOrders,
		SyncStock:   input.SyncStock,
		IsConnected: false,
		SyncStatus:  "pending_credentials",
	}
	database.DB.Where("tenant_id = ? AND provider = ?", tenantID, input.Provider).Assign(account).FirstOrCreate(&account)

	c.JSON(http.StatusOK, integration)
}

// PATCH /api/admin/marketplaces/:id/toggle
func (h *MarketplaceHandler) ToggleMarketplaceStatus(c *gin.Context) {
	tenantID := getTenantID(c)
	idStr := c.Param("id")

	var integration models.MarketplaceIntegration
	if err := database.DB.Where("tenant_id = ?", tenantID).First(&integration, idStr).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Integracao nao encontrada"})
		return
	}

	integration.IsActive = !integration.IsActive
	if err := database.DB.Save(&integration).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao alternar status da integracao"})
		return
	}
	database.DB.Model(&models.MarketplaceAccount{}).
		Where("tenant_id = ? AND provider = ?", tenantID, integration.Provider).
		Update("is_active", integration.IsActive)

	c.JSON(http.StatusOK, integration)
}

// GET /api/admin/marketplaces/accounts
func (h *MarketplaceHandler) GetMarketplaceAccounts(c *gin.Context) {
	tenantID := getTenantID(c)
	ensureMarketplaceAccounts(tenantID)

	var accounts []models.MarketplaceAccount
	if err := database.DB.Where("tenant_id = ?", tenantID).Order("provider asc").Find(&accounts).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao buscar contas de marketplace"})
		return
	}
	c.JSON(http.StatusOK, accounts)
}

// POST /api/admin/marketplaces/accounts
func (h *MarketplaceHandler) SaveMarketplaceAccount(c *gin.Context) {
	tenantID := getTenantID(c)

	var input models.MarketplaceAccountInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Dados invalidos: " + err.Error()})
		return
	}
	provider := normalizeProvider(input.Provider)
	if provider == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Marketplace obrigatorio"})
		return
	}

	var account models.MarketplaceAccount
	err := database.DB.Where("tenant_id = ? AND provider = ?", tenantID, provider).First(&account).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		account = models.MarketplaceAccount{TenantID: tenantID, Provider: provider, SyncCatalog: true}
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao buscar conta"})
		return
	}

	account.AccountName = strings.TrimSpace(input.AccountName)
	if account.AccountName == "" {
		account.AccountName = marketplaceLabel(provider)
	}
	// The Mercado Livre seller is owned by the OAuth token. Once connected,
	// never let an editable form replace that server-resolved identity.
	if provider != mercadoLivreProvider || !account.IsConnected || strings.TrimSpace(account.SellerID) == "" {
		account.SellerID = strings.TrimSpace(input.SellerID)
	}
	account.ShopID = strings.TrimSpace(input.ShopID)
	account.Marketplace = strings.TrimSpace(input.Marketplace)
	if account.Marketplace == "" {
		account.Marketplace = providerDefaultMarketplace(provider)
	}
	if strings.TrimSpace(input.AccessToken) != "" {
		account.AccessToken = strings.TrimSpace(input.AccessToken)
		account.IsConnected = true
		account.SyncStatus = "connected"
	}
	if strings.TrimSpace(input.RefreshToken) != "" {
		account.RefreshToken = strings.TrimSpace(input.RefreshToken)
	}
	account.IsActive = input.IsActive
	account.SyncOrders = input.SyncOrders
	if input.SyncCatalog == nil {
		account.SyncCatalog = true
	} else {
		account.SyncCatalog = *input.SyncCatalog
	}
	account.SyncStock = input.SyncStock
	if account.SyncStatus == "" {
		account.SyncStatus = "pending_credentials"
	}

	if err := database.DB.Save(&account).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao salvar conta de marketplace"})
		return
	}
	c.JSON(http.StatusOK, account)
}

// POST /api/admin/marketplaces/oauth/start
func (h *MarketplaceHandler) StartMarketplaceOAuth(c *gin.Context) {
	tenantID := getTenantID(c)

	var input models.MarketplaceOAuthStartInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Dados invalidos: " + err.Error()})
		return
	}
	provider := normalizeProvider(input.Provider)
	if provider == mercadoLivreProvider {
		h.startMercadoLivreOAuth(c, tenantID)
		return
	}
	redirectURI := strings.TrimSpace(input.RedirectURI)
	state := safeState(tenantID, provider)

	authURL, missing := buildMarketplaceAuthURL(provider, redirectURI, state)
	if len(missing) > 0 {
		c.JSON(http.StatusOK, gin.H{
			"provider":       provider,
			"state":          state,
			"auth_url":       "",
			"missing_config": missing,
			"mode":           "missing_credentials",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"provider":       provider,
		"state":          state,
		"auth_url":       authURL,
		"missing_config": []string{},
		"mode":           "oauth_url",
	})
}

func buildMarketplaceAuthURL(provider string, redirectURI string, state string) (string, []string) {
	switch provider {
	case "shopee":
		partnerID := os.Getenv("SHOPEE_PARTNER_ID")
		partnerKey := os.Getenv("SHOPEE_PARTNER_KEY")
		if partnerID == "" || partnerKey == "" || redirectURI == "" {
			return "", missingEnv(map[string]string{"SHOPEE_PARTNER_ID": partnerID, "SHOPEE_PARTNER_KEY": partnerKey, "redirect_uri": redirectURI})
		}
		path := "/api/v2/shop/auth_partner"
		timestamp := strconv.FormatInt(time.Now().Unix(), 10)
		base := partnerID + path + timestamp
		mac := hmac.New(sha256.New, []byte(partnerKey))
		mac.Write([]byte(base))
		params := url.Values{}
		params.Set("partner_id", partnerID)
		params.Set("timestamp", timestamp)
		params.Set("sign", hex.EncodeToString(mac.Sum(nil)))
		params.Set("redirect", redirectURI)
		return "https://partner.shopeemobile.com" + path + "?" + params.Encode(), nil
	case "amazon":
		appID := os.Getenv("AMAZON_LWA_CLIENT_ID")
		if appID == "" {
			appID = os.Getenv("AMAZON_APP_ID")
		}
		if appID == "" {
			return "", missingEnv(map[string]string{"AMAZON_LWA_CLIENT_ID": appID})
		}
		sellerCentralURL := strings.TrimRight(os.Getenv("AMAZON_SELLER_CENTRAL_URL"), "/")
		if sellerCentralURL == "" {
			sellerCentralURL = "https://sellercentral.amazon.com"
		}
		params := url.Values{}
		params.Set("application_id", appID)
		params.Set("state", state)
		return sellerCentralURL + "/apps/authorize/consent?" + params.Encode(), nil
	default:
		return "", []string{"provider"}
	}
}

func missingEnv(values map[string]string) []string {
	missing := []string{}
	for key, value := range values {
		if strings.TrimSpace(value) == "" {
			missing = append(missing, key)
		}
	}
	return missing
}

// POST /api/admin/marketplaces/oauth/callback
func (h *MarketplaceHandler) CompleteMarketplaceOAuth(c *gin.Context) {
	tenantID := getTenantID(c)

	var input models.MarketplaceOAuthCallbackInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Dados invalidos: " + err.Error()})
		return
	}
	provider := normalizeProvider(input.Provider)
	if provider == mercadoLivreProvider {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Use o callback OAuth seguro do Mercado Livre; o codigo nao pode ser registrado manualmente"})
		return
	}

	var account models.MarketplaceAccount
	err := database.DB.Where("tenant_id = ? AND provider = ?", tenantID, provider).First(&account).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		account = models.MarketplaceAccount{TenantID: tenantID, Provider: provider, AccountName: marketplaceLabel(provider), Marketplace: providerDefaultMarketplace(provider), SyncCatalog: true}
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao buscar conta"})
		return
	}

	account.AuthCode = strings.TrimSpace(input.Code)
	if strings.TrimSpace(input.ShopID) != "" {
		account.ShopID = strings.TrimSpace(input.ShopID)
	}
	if strings.TrimSpace(input.SellerID) != "" {
		account.SellerID = strings.TrimSpace(input.SellerID)
	}
	account.IsActive = true

	connector, ok := marketplaceConnectorRegistry().Get(provider)
	if !ok {
		account.IsConnected = false
		account.SyncStatus = "connector_missing"
		account.LastError = "Conector nao implementado para este marketplace."
	} else {
		token, err := connector.ExchangeAuthCode(c.Request.Context(), marketplaceAccountFromModel(account), marketplaces.TokenRequest{
			Code:        account.AuthCode,
			RedirectURI: strings.TrimSpace(input.RedirectURI),
		})
		if err != nil {
			account.IsConnected = false
			account.SyncStatus = "token_exchange_error"
			account.LastError = marketplaceConnectorErrorMessage(err)
		} else {
			applyMarketplaceTokenResult(&account, token)
			account.SyncStatus = "connected"
			account.LastError = ""
		}
	}
	if err := database.DB.Save(&account).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao salvar callback OAuth"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"account": account,
		"message": marketplaceOAuthCallbackMessage(account),
	})
}

func applyMarketplaceTokenResult(account *models.MarketplaceAccount, token marketplaces.TokenResult) {
	if strings.TrimSpace(token.AccessToken) != "" {
		account.AccessToken = strings.TrimSpace(token.AccessToken)
	}
	if strings.TrimSpace(token.RefreshToken) != "" {
		account.RefreshToken = strings.TrimSpace(token.RefreshToken)
	}
	if strings.TrimSpace(token.SellerID) != "" {
		account.SellerID = strings.TrimSpace(token.SellerID)
	}
	if strings.TrimSpace(token.ShopID) != "" {
		account.ShopID = strings.TrimSpace(token.ShopID)
	}
	if strings.TrimSpace(token.Marketplace) != "" {
		account.Marketplace = strings.TrimSpace(token.Marketplace)
	}
	if !token.ExpiresAt.IsZero() {
		account.TokenExpiresAt = &token.ExpiresAt
	} else if token.ExpiresIn > 0 {
		expiresAt := time.Now().Add(time.Duration(token.ExpiresIn) * time.Second)
		account.TokenExpiresAt = &expiresAt
	}
	account.IsConnected = strings.TrimSpace(account.AccessToken) != ""
}

func marketplaceOAuthCallbackMessage(account models.MarketplaceAccount) string {
	if account.IsConnected {
		return "OAuth concluido e access token salvo com seguranca."
	}
	if account.SyncStatus == "token_exchange_error" {
		return "Codigo OAuth salvo, mas a troca por token falhou. Confira as credenciais do provider."
	}
	return "Codigo OAuth salvo."
}

// POST /api/admin/marketplaces/refresh-tokens
func (h *MarketplaceHandler) RefreshMarketplaceTokens(c *gin.Context) {
	tenantID := getTenantID(c)
	var input models.MarketplaceSyncInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Dados invalidos"})
		return
	}
	provider := normalizeProvider(input.Provider)

	query := database.DB.Where("tenant_id = ? AND is_active = ?", tenantID, true)
	if provider != "" {
		query = query.Where("provider = ?", provider)
	}
	var accounts []models.MarketplaceAccount
	if err := query.Find(&accounts).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao buscar contas de marketplace"})
		return
	}

	results := make([]gin.H, 0, len(accounts))
	refreshed := 0
	for i := range accounts {
		if err := h.refreshMarketplaceAccountToken(c.Request.Context(), &accounts[i], true); err != nil {
			results = append(results, gin.H{"provider": accounts[i].Provider, "status": accounts[i].SyncStatus, "message": accounts[i].LastError})
			continue
		}
		refreshed++
		results = append(results, gin.H{"provider": accounts[i].Provider, "status": accounts[i].SyncStatus, "message": "Token renovado."})
	}
	c.JSON(http.StatusOK, gin.H{"refreshed": refreshed, "results": results})
}

// POST /api/admin/marketplaces/test
func (h *MarketplaceHandler) TestMarketplaceConnection(c *gin.Context) {
	tenantID := getTenantID(c)
	var input models.MarketplaceSyncInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Dados invalidos"})
		return
	}
	provider := normalizeProvider(input.Provider)
	if provider == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Marketplace obrigatorio"})
		return
	}

	var account models.MarketplaceAccount
	if err := database.DB.Where("tenant_id = ? AND provider = ?", tenantID, provider).First(&account).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Conta de marketplace nao encontrada"})
		return
	}
	if err := h.ensureFreshMarketplaceToken(c.Request.Context(), &account); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": account.LastError})
		return
	}

	connector, ok := marketplaceConnectorRegistry().Get(provider)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Conector nao implementado"})
		return
	}
	now := time.Now()
	identityCorrected := false
	var testErr error
	if _, resolvesIdentity := connector.(marketplaces.AccountIdentityResolver); resolvesIdentity {
		identityCorrected, testErr = h.reconcileMarketplaceAccountIdentity(c.Request.Context(), &account, connector)
	} else {
		testErr = connector.TestConnection(c.Request.Context(), marketplaceAccountFromModel(account))
	}
	if testErr == nil {
		if tester, testsOrders := connector.(marketplaces.OrderAccessTester); testsOrders {
			testErr = tester.TestOrderAccess(c.Request.Context(), marketplaceAccountFromModel(account))
		}
	}
	if testErr != nil {
		account.SyncStatus = "connection_error"
		if mercadolivre.IsOrderAccessForbidden(testErr) {
			account.SyncStatus = "orders_permission_error"
		}
		account.LastSyncAt = &now
		account.LastError = marketplaceOrderAccessErrorMessage(account, testErr)
		_ = database.DB.Save(&account).Error
		c.JSON(http.StatusBadRequest, gin.H{"error": account.LastError, "account": account})
		return
	}
	account.SyncStatus = "connected"
	account.LastSyncAt = &now
	account.LastError = ""
	account.IsConnected = true
	_ = database.DB.Save(&account).Error
	message := "Conexao e acesso a pedidos testados com sucesso."
	if identityCorrected {
		message = "Conexao testada e Seller ID corrigido a partir do token OAuth; acesso a pedidos confirmado."
	}
	c.JSON(http.StatusOK, gin.H{"message": message, "account": account, "seller_id_corrected": identityCorrected})
}

func (h *MarketplaceHandler) reconcileMarketplaceAccountIdentity(ctx context.Context, account *models.MarketplaceAccount, connector marketplaces.Connector) (bool, error) {
	resolver, ok := connector.(marketplaces.AccountIdentityResolver)
	if !ok {
		return false, nil
	}
	identity, err := resolver.ResolveAccountIdentity(ctx, marketplaceAccountFromModel(*account))
	if err != nil && marketplaces.IsUnauthorized(connector, err) {
		if refreshErr := h.refreshMarketplaceAccountToken(ctx, account, true); refreshErr != nil {
			return false, refreshErr
		}
		identity, err = resolver.ResolveAccountIdentity(ctx, marketplaceAccountFromModel(*account))
	}
	if err != nil {
		return false, err
	}
	sellerID := strings.TrimSpace(identity.SellerID)
	if sellerID == "" {
		return false, errors.New("O token OAuth nao informou o Seller ID")
	}
	changed := strings.TrimSpace(account.SellerID) != sellerID
	account.SellerID = sellerID
	account.IsConnected = true
	if changed {
		if err := database.DB.Save(account).Error; err != nil {
			return false, err
		}
	}
	return changed, nil
}

func (h *MarketplaceHandler) ensureFreshMarketplaceToken(ctx context.Context, account *models.MarketplaceAccount) error {
	if account.TokenExpiresAt == nil {
		if strings.TrimSpace(account.AccessToken) == "" {
			account.SyncStatus = "pending_credentials"
			account.LastError = "Configure OAuth/access token antes de sincronizar."
			_ = database.DB.Save(account).Error
			return errors.New(account.LastError)
		}
		if strings.TrimSpace(account.RefreshToken) != "" {
			return h.refreshMarketplaceAccountToken(ctx, account, true)
		}
		return nil
	}
	if account.TokenExpiresAt.After(time.Now().Add(10 * time.Minute)) {
		return nil
	}
	return h.refreshMarketplaceAccountToken(ctx, account, false)
}

func (h *MarketplaceHandler) refreshMarketplaceAccountToken(ctx context.Context, account *models.MarketplaceAccount, force bool) error {
	if !force && account.TokenExpiresAt != nil && account.TokenExpiresAt.After(time.Now().Add(10*time.Minute)) {
		return nil
	}
	connector, ok := marketplaceConnectorRegistry().Get(account.Provider)
	if !ok {
		account.SyncStatus = "connector_missing"
		account.LastError = "Conector nao implementado para este marketplace."
		_ = database.DB.Save(account).Error
		return errors.New(account.LastError)
	}
	connectorAccount := marketplaceAccountFromModel(*account)
	if account.Provider == mercadoLivreProvider {
		var credentialsErr error
		connectorAccount, credentialsErr = h.mercadoLivreConnectorAccount(*account)
		if credentialsErr != nil {
			account.SyncStatus = "platform_config_error"
			account.LastError = "Aplicacao Mercado Livre nao configurada no ambiente da plataforma."
			_ = database.DB.Save(account).Error
			return credentialsErr
		}
	}
	token, err := connector.RefreshAccessToken(ctx, connectorAccount)
	if err != nil {
		account.SyncStatus = "token_refresh_error"
		account.LastError = marketplaceConnectorErrorMessage(err)
		_ = database.DB.Save(account).Error
		return err
	}
	applyMarketplaceTokenResult(account, token)
	account.SyncStatus = "connected"
	account.LastError = ""
	account.IsConnected = true
	return database.DB.Save(account).Error
}

// GET /api/admin/marketplaces/mappings
func (h *MarketplaceHandler) GetProductMappings(c *gin.Context) {
	tenantID := getTenantID(c)

	var mappings []models.MarketplaceProductMapping
	if err := database.DB.Preload("Product").Where("tenant_id = ?", tenantID).Order("updated_at desc").Find(&mappings).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao buscar mapeamento de produtos"})
		return
	}

	c.JSON(http.StatusOK, mappings)
}

// POST /api/admin/marketplaces/mappings
func (h *MarketplaceHandler) SaveProductMapping(c *gin.Context) {
	tenantID := getTenantID(c)

	var input models.MarketplaceProductMappingInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Dados invalidos: " + err.Error()})
		return
	}
	provider := normalizeProvider(input.Provider)

	var product models.Product
	if err := database.DB.Where("tenant_id = ? AND id = ?", tenantID, input.ProductID).First(&product).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Produto nao encontrado"})
		return
	}
	internalSKU := strings.TrimSpace(input.InternalSKU)
	if internalSKU == "" {
		internalSKU = product.SKU
	}

	now := time.Now()
	var mapping models.MarketplaceProductMapping
	err := database.DB.Where("tenant_id = ? AND provider = ? AND external_item_id = ?", tenantID, provider, input.ExternalItemID).First(&mapping).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		err = database.DB.Where("tenant_id = ? AND provider = ? AND product_id = ?", tenantID, provider, input.ProductID).First(&mapping).Error
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		mapping = models.MarketplaceProductMapping{TenantID: tenantID, Provider: provider}
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao buscar mapeamento"})
		return
	}

	mapping.ProductID = input.ProductID
	mapping.InternalSKU = internalSKU
	mapping.ExternalSKU = strings.TrimSpace(input.ExternalSKU)
	mapping.ExternalTitle = strings.TrimSpace(input.ExternalTitle)
	mapping.ExternalItemID = strings.TrimSpace(input.ExternalItemID)
	mapping.ExternalURL = strings.TrimSpace(input.ExternalURL)
	mapping.SyncStatus = "mapped"
	mapping.LastSyncedAt = &now
	if err := database.DB.Save(&mapping).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao salvar mapeamento"})
		return
	}

	database.DB.Preload("Product").First(&mapping, mapping.ID)
	c.JSON(http.StatusOK, mapping)
}

// POST /api/admin/marketplaces/import-products
func (h *MarketplaceHandler) ImportMarketplaceProducts(c *gin.Context) {
	tenantID := getTenantID(c)

	var input models.MarketplaceProductImportInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Dados invalidos: " + err.Error()})
		return
	}
	provider := normalizeProvider(input.Provider)
	if provider == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Marketplace obrigatorio"})
		return
	}

	results := make([]models.MarketplaceProductImportResult, 0, len(input.Products))
	created := 0
	updated := 0
	for _, item := range input.Products {
		result, err := importMarketplaceCatalogItem(tenantID, provider, input.DefaultCategoryID, input.OverwriteLocal, item)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if result.Action == "created" {
			created++
		} else {
			updated++
		}
		results = append(results, result)
	}

	c.JSON(http.StatusOK, gin.H{
		"provider": provider,
		"created":  created,
		"updated":  updated,
		"results":  results,
	})
}

func importMarketplaceCatalogItem(tenantID uint, provider string, defaultCategoryID uint, overwriteLocal bool, item models.MarketplaceCatalogItemInput) (models.MarketplaceProductImportResult, error) {
	now := time.Now()
	settings, err := getOrCreateTenantMarketplaceSettings(tenantID)
	if err != nil {
		return models.MarketplaceProductImportResult{}, fmt.Errorf("erro ao carregar regras de marketplace: %w", err)
	}
	externalID := strings.TrimSpace(item.ExternalItemID)
	if externalID == "" {
		return models.MarketplaceProductImportResult{}, errors.New("ID externo do anuncio e obrigatorio")
	}
	title := strings.TrimSpace(item.Title)
	if title == "" {
		title = strings.TrimSpace(item.ExternalTitle)
	}
	if title == "" {
		return models.MarketplaceProductImportResult{}, errors.New("Titulo do produto e obrigatorio")
	}
	if item.Price <= 0 {
		return models.MarketplaceProductImportResult{}, errors.New("Preco do produto deve ser maior que zero")
	}

	sku := strings.TrimSpace(item.ExternalSKU)
	if sku == "" {
		sku = fmt.Sprintf("%s-%s", strings.ToUpper(provider), externalID)
	}

	var product models.Product
	action := "updated"
	productFound := false
	shouldSyncImages := false
	shouldSyncVariants := false
	shouldSyncStocks := false

	var mapping models.MarketplaceProductMapping
	if err := database.DB.Where("tenant_id = ? AND provider = ? AND external_item_id = ?", tenantID, provider, externalID).First(&mapping).Error; err == nil {
		if err := database.DB.Where("tenant_id = ? AND id = ?", tenantID, mapping.ProductID).First(&product).Error; err == nil {
			productFound = true
		}
	}
	if !productFound {
		if err := database.DB.Where("tenant_id = ? AND sku = ?", tenantID, sku).First(&product).Error; err == nil {
			productFound = true
		}
	}

	categoryID := item.CategoryID
	if categoryID == 0 {
		categoryID = defaultCategoryID
	}
	if categoryID == 0 {
		categoryID = importedMarketplaceCategoryID(tenantID, provider)
	}
	if categoryID == 0 {
		return models.MarketplaceProductImportResult{}, errors.New("Cadastre uma categoria antes de importar produtos do marketplace")
	}

	imageURL := strings.TrimSpace(item.ImageURL)
	if imageURL == "" && len(item.ColorImages) > 0 {
		imageURL = strings.TrimSpace(item.ColorImages[0].ImageURL)
	}
	if imageURL == "" {
		imageURL = "https://images.unsplash.com/photo-1563089145-599997674d42?q=80&w=800&auto=format&fit=crop"
	}

	status := marketplaceImportedProductStatus(provider, productFound, item.Status, settings.NewImportedProductStatus)
	inStock := item.StockQty > 0

	if !productFound {
		action = "created"
		shouldSyncImages = true
		shouldSyncVariants = true
		shouldSyncStocks = true
		product = models.Product{
			TenantID:         tenantID,
			Title:            title,
			Slug:             marketplaceProductSlug(provider, externalID, title),
			SKU:              sku,
			Description:      strings.TrimSpace(item.Description),
			Price:            item.Price,
			ImageURL:         imageURL,
			CategoryID:       categoryID,
			Material:         defaultString(item.Material, "Material informado no marketplace"),
			LayerHeight:      defaultString(item.LayerHeight, "0.16mm"),
			PrintTime:        defaultString(item.PrintTime, "A confirmar"),
			Dimensions:       defaultString(item.Dimensions, "A confirmar"),
			Weight:           defaultString(item.Weight, "0g"),
			InStock:          inStock,
			StockQty:         item.StockQty,
			Status:           status,
			SourceProvider:   provider,
			SourceExternalID: externalID,
			SourceSyncedAt:   &now,
		}
		if err := database.DB.Create(&product).Error; err != nil {
			return models.MarketplaceProductImportResult{}, fmt.Errorf("erro ao criar produto importado: %w", err)
		}
	} else {
		marketplaceOwnsProduct := product.SourceProvider == provider
		contentSyncAllowed := settings.ContentSyncPolicy == "always" ||
			(settings.ContentSyncPolicy == "imported_only" && marketplaceOwnsProduct)
		if overwriteLocal && marketplaceOwnsProduct {
			contentSyncAllowed = true
		}
		shouldSyncImages = contentSyncAllowed
		shouldSyncVariants = contentSyncAllowed || settings.MarketplaceControlsPrice
		shouldSyncStocks = settings.MarketplaceControlsStock
		if settings.MarketplaceControlsPrice {
			product.Price = item.Price
		}
		if settings.MarketplaceControlsStock {
			product.StockQty = item.StockQty
			product.InStock = inStock
		}
		if product.SKU == "" {
			product.SKU = sku
		}
		if contentSyncAllowed {
			product.SourceProvider = provider
			product.SourceExternalID = externalID
			product.SourceSyncedAt = &now
			product.Title = title
			product.Description = strings.TrimSpace(item.Description)
			if imageURL != "" {
				product.ImageURL = imageURL
			}
			product.CategoryID = categoryID
			product.Material = defaultString(item.Material, product.Material)
			product.LayerHeight = defaultString(item.LayerHeight, product.LayerHeight)
			product.PrintTime = defaultString(item.PrintTime, product.PrintTime)
			product.Dimensions = defaultString(item.Dimensions, product.Dimensions)
			product.Weight = defaultString(item.Weight, product.Weight)
		}
		if err := database.DB.Save(&product).Error; err != nil {
			return models.MarketplaceProductImportResult{}, fmt.Errorf("erro ao atualizar produto importado: %w", err)
		}
	}

	if shouldSyncImages {
		colorImages := item.ColorImages
		if len(colorImages) == 0 {
			colorImages = []models.ProductColorImageInput{{ColorName: "Padrao", ImageURL: imageURL, SortOrder: 0}}
		}
		if err := syncProductColorImages(tenantID, product.ID, colorImages); err != nil {
			return models.MarketplaceProductImportResult{}, fmt.Errorf("erro ao salvar imagens do produto importado: %w", err)
		}
	}
	if shouldSyncVariants && len(item.Variants) > 0 {
		if err := syncProductVariants(tenantID, product.ID, item.Variants); err != nil {
			return models.MarketplaceProductImportResult{}, fmt.Errorf("erro ao salvar variacoes do produto importado: %w", err)
		}
	}
	if shouldSyncStocks {
		colorStocks := item.ColorStocks
		if len(colorStocks) == 0 {
			colorStocks = []models.ProductColorStockInput{{ColorName: "Padrao", StockQty: item.StockQty}}
		}
		if err := syncProductColorStocks(tenantID, product.ID, colorStocks); err != nil {
			return models.MarketplaceProductImportResult{}, fmt.Errorf("erro ao salvar estoque por cor do produto importado: %w", err)
		}
	}

	if mapping.ID == 0 {
		if err := database.DB.Where("tenant_id = ? AND provider = ? AND external_item_id = ?", tenantID, provider, externalID).First(&mapping).Error; errors.Is(err, gorm.ErrRecordNotFound) {
			mapping = models.MarketplaceProductMapping{TenantID: tenantID, Provider: provider}
		}
	}
	mapping.ProductID = product.ID
	mapping.InternalSKU = product.SKU
	mapping.ExternalSKU = sku
	mapping.ExternalTitle = defaultString(item.ExternalTitle, title)
	mapping.ExternalItemID = externalID
	mapping.ExternalURL = strings.TrimSpace(item.ExternalURL)
	mapping.SyncStatus = "catalog_imported"
	mapping.LastSyncedAt = &now
	if err := database.DB.Save(&mapping).Error; err != nil {
		return models.MarketplaceProductImportResult{}, fmt.Errorf("erro ao salvar mapeamento do produto importado: %w", err)
	}

	withProductRelations(database.DB).First(&product, product.ID)
	database.DB.Preload("Product").First(&mapping, mapping.ID)
	return models.MarketplaceProductImportResult{Action: action, Product: product, Mapping: mapping}, nil
}

func marketplaceImportedProductStatus(provider string, productFound bool, marketplaceStatus string, newImportedProductStatus string) string {
	// Anuncios ativos importados do Mercado Livre sao produtos prontos para venda:
	// eles entram diretamente no catalogo publico do tenant, sem etapa de curadoria.
	if normalizeProvider(provider) == "mercadolivre" && strings.EqualFold(strings.TrimSpace(marketplaceStatus), "active") {
		return "active"
	}
	if !productFound {
		return normalizeImportedProductStatus(newImportedProductStatus)
	}

	status := strings.ToLower(strings.TrimSpace(marketplaceStatus))
	if status == "" {
		return "active"
	}
	if status != "active" && status != "draft" && status != "paused" {
		return "paused"
	}
	return status
}

func importedMarketplaceCategoryID(tenantID uint, provider string) uint {
	provider = normalizeProvider(provider)
	name := "Importados do " + marketplaceLabel(provider)
	slug := "importados-" + provider
	var category models.Category
	if err := database.DB.Where("tenant_id = ? AND slug = ?", tenantID, slug).First(&category).Error; err == nil {
		return category.ID
	}
	category = models.Category{TenantID: tenantID, Name: name, Slug: slug, Description: "Categoria criada automaticamente para produtos importados.", Icon: "shopping-bag"}
	if err := database.DB.Create(&category).Error; err != nil {
		return 0
	}
	return category.ID
}

func defaultString(value string, fallback string) string {
	value = strings.TrimSpace(value)
	if value != "" {
		return value
	}
	return fallback
}

func marketplaceProductSlug(provider string, externalID string, title string) string {
	base := strings.ToLower(strings.TrimSpace(title))
	var builder strings.Builder
	lastDash := false
	for _, r := range base {
		if r >= 'a' && r <= 'z' || r >= '0' && r <= '9' {
			builder.WriteRune(r)
			lastDash = false
			continue
		}
		if !lastDash {
			builder.WriteByte('-')
			lastDash = true
		}
	}
	slug := strings.Trim(builder.String(), "-")
	if slug == "" {
		slug = "produto"
	}
	return fmt.Sprintf("%s-%s-%s", provider, externalID, slug)
}

// POST /api/admin/marketplaces/sync-product
func (h *MarketplaceHandler) SyncProductToMarketplace(c *gin.Context) {
	tenantID := getTenantID(c)

	var input models.MarketplaceProductSyncInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Dados invalidos"})
		return
	}
	input.Provider = normalizeProvider(input.Provider)

	var product models.Product
	if err := database.DB.Where("tenant_id = ?", tenantID).First(&product, input.ProductID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Produto nao encontrado"})
		return
	}
	if product.SKU == "" {
		product.SKU = fmt.Sprintf("AZ3D-%d-%d", tenantID, product.ID)
		_ = database.DB.Save(&product).Error
	}

	var account models.MarketplaceAccount
	if err := database.DB.Where("tenant_id = ? AND provider = ? AND is_active = ?", tenantID, input.Provider, true).First(&account).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Conta do marketplace nao esta ativa ou configurada"})
		return
	}

	now := time.Now()
	extID := fmt.Sprintf("DRAFT-%s-%d", strings.ToUpper(input.Provider), product.ID)
	extURL := ""

	var mapping models.MarketplaceProductMapping
	err := database.DB.Where("tenant_id = ? AND product_id = ? AND provider = ?", tenantID, product.ID, input.Provider).First(&mapping).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		mapping = models.MarketplaceProductMapping{TenantID: tenantID, ProductID: product.ID, Provider: input.Provider}
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao buscar mapeamento"})
		return
	}

	mapping.InternalSKU = product.SKU
	mapping.ExternalSKU = product.SKU
	mapping.ExternalTitle = product.Title
	mapping.ExternalItemID = extID
	mapping.ExternalURL = extURL
	mapping.SyncStatus = "pending_publish"
	mapping.LastSyncedAt = &now
	if err := database.DB.Save(&mapping).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao preparar mapeamento do produto"})
		return
	}

	database.DB.Preload("Product").First(&mapping, mapping.ID)
	c.JSON(http.StatusOK, gin.H{
		"message": fmt.Sprintf("Mapeamento de '%s' preparado para %s. No MVP, a publicacao real do anuncio fica fora da sincronizacao automatica.", product.Title, marketplaceLabel(input.Provider)),
		"mapping": mapping,
		"account": account,
	})
}

// POST /api/admin/marketplaces/sync-products
func (h *MarketplaceHandler) SyncMarketplaceProducts(c *gin.Context) {
	tenantID := getTenantID(c)

	var input models.MarketplaceCatalogSyncInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Dados invalidos"})
		return
	}
	provider := normalizeProvider(input.Provider)

	query := database.DB.Where("tenant_id = ? AND is_active = ? AND sync_catalog = ?", tenantID, true, true)
	if provider != "" {
		query = query.Where("provider = ?", provider)
	}

	var accounts []models.MarketplaceAccount
	if err := query.Find(&accounts).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao buscar contas para sincronizacao de catalogo"})
		return
	}

	registry := marketplaceConnectorRegistry()
	results := make([]gin.H, 0, len(accounts))
	totalCreated := 0
	totalUpdated := 0
	totalEventsProcessed := 0
	for i := range accounts {
		connector, ok := registry.Get(accounts[i].Provider)
		if !ok {
			now := time.Now()
			accounts[i].SyncStatus = "connector_missing"
			accounts[i].LastSyncAt = &now
			accounts[i].LastError = "Conector nao implementado para este marketplace."
			_ = database.DB.Save(&accounts[i]).Error
			results = append(results, gin.H{
				"provider": accounts[i].Provider,
				"status":   accounts[i].SyncStatus,
				"imported": 0,
				"updated":  0,
				"message":  accounts[i].LastError,
			})
			continue
		}
		if err := h.ensureFreshMarketplaceToken(c.Request.Context(), &accounts[i]); err != nil {
			results = append(results, gin.H{
				"provider": accounts[i].Provider,
				"status":   accounts[i].SyncStatus,
				"imported": 0,
				"updated":  0,
				"message":  accounts[i].LastError,
			})
			continue
		}
		if _, err := h.reconcileMarketplaceAccountIdentity(c.Request.Context(), &accounts[i], connector); err != nil {
			accounts[i].SyncStatus = "identity_sync_error"
			accounts[i].LastError = marketplaceConnectorErrorMessage(err)
			_ = database.DB.Save(&accounts[i]).Error
			results = append(results, gin.H{
				"provider": accounts[i].Provider,
				"status":   accounts[i].SyncStatus,
				"imported": 0,
				"updated":  0,
				"message":  accounts[i].LastError,
			})
			continue
		}

		outcome := h.syncMarketplaceCatalogAccount(c.Request.Context(), tenantID, &accounts[i], connector)
		totalCreated += outcome.Created
		totalUpdated += outcome.Updated
		totalEventsProcessed += outcome.EventsProcessed
		results = append(results, gin.H{
			"provider":         accounts[i].Provider,
			"status":           outcome.Status,
			"imported":         outcome.Created,
			"updated":          outcome.Updated,
			"events_processed": outcome.EventsProcessed,
			"message":          outcome.Message,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"results":          results,
		"imported":         totalCreated,
		"updated":          totalUpdated,
		"events_processed": totalEventsProcessed,
	})
}

type marketplaceCatalogSyncOutcome struct {
	Created         int
	Updated         int
	EventsProcessed int
	Status          string
	Message         string
}

func (h *MarketplaceHandler) syncMarketplaceCatalogAccount(ctx context.Context, tenantID uint, account *models.MarketplaceAccount, connector marketplaces.Connector) marketplaceCatalogSyncOutcome {
	outcome := marketplaceCatalogSyncOutcome{Status: "catalog_synced"}
	now := time.Now()
	catalog, catalogErr := connector.FetchCatalog(ctx, marketplaceAccountFromModel(*account))

	events, eventsErr := pendingMarketplaceItemEvents(tenantID, account.Provider)
	if eventsErr != nil {
		outcome.Status = "catalog_sync_error"
		outcome.Message = "Erro ao carregar eventos pendentes do marketplace: " + eventsErr.Error()
		account.SyncStatus = outcome.Status
		account.LastSyncAt = &now
		account.LastError = outcome.Message
		_ = database.DB.Save(account).Error
		return outcome
	}

	items := uniqueMarketplaceCatalogItems(catalog.Items)
	knownItemIDs := marketplaceCatalogItemIDs(items)
	pendingIDs := pendingMarketplaceItemIDs(events)
	missingIDs := make([]string, 0, len(pendingIDs))
	for _, externalID := range pendingIDs {
		if _, found := knownItemIDs[externalID]; !found {
			missingIDs = append(missingIDs, externalID)
		}
	}

	var eventFetchErr error
	if len(missingIDs) > 0 {
		if fetcher, ok := connector.(marketplaces.CatalogItemFetcher); ok {
			var eventCatalog marketplaces.CatalogSyncResult
			eventCatalog, eventFetchErr = fetcher.FetchCatalogItems(ctx, marketplaceAccountFromModel(*account), missingIDs)
			if eventFetchErr == nil {
				items = uniqueMarketplaceCatalogItems(append(items, eventCatalog.Items...))
				knownItemIDs = marketplaceCatalogItemIDs(items)
			}
		} else {
			eventFetchErr = errors.New("conector nao permite buscar anuncios recebidos por webhook")
		}
	}

	failures := make([]string, 0)
	for _, externalID := range pendingIDs {
		if _, found := knownItemIDs[externalID]; found {
			continue
		}
		reason := "Anuncio nao retornado pelo marketplace ou nao pertence ao vendedor conectado"
		if eventFetchErr != nil {
			reason = marketplaceConnectorErrorMessage(eventFetchErr)
		}
		_, _ = updateMarketplaceItemEventStatus(tenantID, account.Provider, externalID, "failed", reason)
		failures = append(failures, externalID+": "+reason)
	}

	defaultCategoryID := importedMarketplaceCategoryID(tenantID, account.Provider)
	for _, item := range items {
		importResult, err := importMarketplaceCatalogItem(
			tenantID,
			account.Provider,
			defaultCategoryID,
			true,
			catalogItemToModelInput(item),
		)
		if err != nil {
			reason := err.Error()
			_, _ = updateMarketplaceItemEventStatus(tenantID, account.Provider, item.ExternalItemID, "failed", reason)
			failures = append(failures, item.ExternalItemID+": "+reason)
			continue
		}
		if importResult.Action == "created" {
			outcome.Created++
		} else {
			outcome.Updated++
		}
		processed, _ := updateMarketplaceItemEventStatus(tenantID, account.Provider, item.ExternalItemID, "processed", "")
		outcome.EventsProcessed += int(processed)
	}

	messageParts := make([]string, 0, 4)
	if catalogErr == nil && strings.TrimSpace(catalog.Message) != "" {
		messageParts = append(messageParts, catalog.Message)
	} else if catalogErr != nil {
		messageParts = append(messageParts, "Busca geral do catalogo falhou: "+marketplaceConnectorErrorMessage(catalogErr))
	}
	if len(pendingIDs) > 0 {
		messageParts = append(messageParts, fmt.Sprintf("%d anuncio(s) unico(s) identificado(s) no Outbox", len(pendingIDs)))
	}
	if outcome.EventsProcessed > 0 {
		messageParts = append(messageParts, fmt.Sprintf("%d evento(s) do Outbox processado(s)", outcome.EventsProcessed))
	}
	if len(failures) > 0 {
		messageParts = append(messageParts, fmt.Sprintf("%d anuncio(s) com falha; consulte o Outbox", len(failures)))
	}
	if len(messageParts) == 0 {
		messageParts = append(messageParts, "Nenhum anuncio encontrado para sincronizacao")
	}
	outcome.Message = strings.Join(messageParts, "; ")

	switch {
	case catalogErr != nil && len(items) == 0:
		outcome.Status = "catalog_sync_error"
	case len(failures) > 0 || catalogErr != nil:
		outcome.Status = "catalog_sync_warning"
	default:
		outcome.Status = "catalog_synced"
	}
	account.SyncStatus = outcome.Status
	account.LastSyncAt = &now
	if outcome.Status == "catalog_synced" {
		account.LastError = ""
	} else {
		account.LastError = outcome.Message
	}
	_ = database.DB.Save(account).Error
	return outcome
}

func pendingMarketplaceItemEvents(tenantID uint, provider string) ([]models.MarketplaceWebhookEvent, error) {
	var events []models.MarketplaceWebhookEvent
	err := database.DB.
		Where("tenant_id = ? AND provider = ? AND event_type = ? AND status IN ? AND external_id <> ''", tenantID, normalizeProvider(provider), "items", []string{"pending", "failed"}).
		Order("received_at asc").
		Limit(500).
		Find(&events).Error
	return events, err
}

func pendingMarketplaceItemIDs(events []models.MarketplaceWebhookEvent) []string {
	values := make([]string, 0, len(events))
	for _, event := range events {
		values = append(values, event.ExternalID)
	}
	result := make([]string, 0, len(values))
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if _, found := seen[value]; found {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	return result
}

func uniqueMarketplaceCatalogItems(items []marketplaces.CatalogItem) []marketplaces.CatalogItem {
	result := make([]marketplaces.CatalogItem, 0, len(items))
	indexes := make(map[string]int, len(items))
	for _, item := range items {
		externalID := strings.TrimSpace(item.ExternalItemID)
		if externalID == "" {
			continue
		}
		if index, found := indexes[externalID]; found {
			result[index] = item
			continue
		}
		indexes[externalID] = len(result)
		result = append(result, item)
	}
	return result
}

func marketplaceCatalogItemIDs(items []marketplaces.CatalogItem) map[string]struct{} {
	result := make(map[string]struct{}, len(items))
	for _, item := range items {
		if externalID := strings.TrimSpace(item.ExternalItemID); externalID != "" {
			result[externalID] = struct{}{}
		}
	}
	return result
}

func updateMarketplaceItemEventStatus(tenantID uint, provider string, externalID string, status string, errorMessage string) (int64, error) {
	processedAt := time.Now()
	updates := map[string]any{"status": status, "error_message": strings.TrimSpace(errorMessage), "processed_at": &processedAt, "next_attempt_at": nil}
	if status == "failed" {
		next := time.Now().Add(2 * time.Minute)
		updates["retry_count"] = gorm.Expr("retry_count + 1")
		updates["next_attempt_at"] = &next
		updates["processed_at"] = nil
	}
	result := database.DB.Model(&models.MarketplaceWebhookEvent{}).
		Where("tenant_id = ? AND provider = ? AND event_type = ? AND external_id = ? AND status IN ?", tenantID, normalizeProvider(provider), "items", strings.TrimSpace(externalID), []string{"pending", "failed"}).
		Updates(updates)
	return result.RowsAffected, result.Error
}

func marketplaceAccountFromModel(account models.MarketplaceAccount) marketplaces.Account {
	return marketplaces.Account{
		TenantID:     account.TenantID,
		Provider:     normalizeProvider(account.Provider),
		AccountName:  account.AccountName,
		SellerID:     account.SellerID,
		ShopID:       account.ShopID,
		Marketplace:  account.Marketplace,
		AccessToken:  account.AccessToken,
		RefreshToken: account.RefreshToken,
		AuthCode:     account.AuthCode,
	}
}

func marketplaceConnectorErrorMessage(err error) string {
	switch {
	case errors.Is(err, marketplaces.ErrMissingCredentials):
		return "Configure access token, seller/shop id e marketplace antes de importar catalogo real."
	case errors.Is(err, marketplaces.ErrNotConfigured):
		return "Configure a aplicacao global do marketplace no painel master antes de importar catalogo real."
	default:
		return err.Error()
	}
}

func marketplaceOrderAccessErrorMessage(account models.MarketplaceAccount, err error) string {
	if mercadolivre.IsOrderAccessForbidden(err) {
		return fmt.Sprintf(
			"Mercado Livre negou acesso aos pedidos do seller %s. O Seller ID foi conferido pelo token; refaca o OAuth usando a conta administradora proprietaria da loja e confirme que o aplicativo tem permissao de leitura.",
			strings.TrimSpace(account.SellerID),
		)
	}
	return marketplaceConnectorErrorMessage(err)
}

func catalogItemToModelInput(item marketplaces.CatalogItem) models.MarketplaceCatalogItemInput {
	return models.MarketplaceCatalogItemInput{
		ExternalItemID: item.ExternalItemID,
		ExternalSKU:    item.ExternalSKU,
		ExternalTitle:  item.ExternalTitle,
		ExternalURL:    item.ExternalURL,
		Title:          item.Title,
		Description:    item.Description,
		Price:          item.Price,
		ImageURL:       item.ImageURL,
		Material:       item.Material,
		LayerHeight:    item.LayerHeight,
		PrintTime:      item.PrintTime,
		Dimensions:     item.Dimensions,
		Weight:         item.Weight,
		StockQty:       item.StockQty,
		Status:         item.Status,
		ColorImages:    catalogColorImagesToModel(item.ColorImages),
		ColorStocks:    catalogColorStocksToModel(item.ColorStocks),
		Variants:       catalogVariantsToModel(item.Variants),
	}
}

func catalogColorImagesToModel(items []marketplaces.CatalogColorImage) []models.ProductColorImageInput {
	inputs := make([]models.ProductColorImageInput, 0, len(items))
	for _, item := range items {
		inputs = append(inputs, models.ProductColorImageInput{
			ColorName: item.ColorName,
			ImageURL:  item.ImageURL,
			SortOrder: item.SortOrder,
		})
	}
	return inputs
}

func catalogColorStocksToModel(items []marketplaces.CatalogColorStock) []models.ProductColorStockInput {
	inputs := make([]models.ProductColorStockInput, 0, len(items))
	for _, item := range items {
		inputs = append(inputs, models.ProductColorStockInput{
			ColorName: item.ColorName,
			StockQty:  item.StockQty,
		})
	}
	return inputs
}

func catalogVariantsToModel(items []marketplaces.CatalogVariant) []models.ProductVariantInput {
	inputs := make([]models.ProductVariantInput, 0, len(items))
	for _, item := range items {
		inputs = append(inputs, models.ProductVariantInput{
			ColorName:     item.ColorName,
			VariationName: defaultString(item.VariationName, item.ColorName),
			Attributes:    defaultString(item.Attributes, "[]"),
			Price:         item.Price,
			Material:      item.Material,
			LayerHeight:   item.LayerHeight,
			PrintTime:     item.PrintTime,
			Weight:        item.Weight,
			IsActive:      item.IsActive,
			SortOrder:     item.SortOrder,
		})
	}
	return inputs
}

// POST /api/admin/marketplaces/sync-orders
func (h *MarketplaceHandler) SyncMarketplaceOrders(c *gin.Context) {
	tenantID := getTenantID(c)

	var input models.MarketplaceSyncInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Dados invalidos"})
		return
	}
	provider := normalizeProvider(input.Provider)
	if input.Days <= 0 {
		input.Days = 7
	}

	query := database.DB.Where("tenant_id = ? AND is_active = ? AND sync_orders = ?", tenantID, true, true)
	if provider != "" {
		query = query.Where("provider = ?", provider)
	}

	var accounts []models.MarketplaceAccount
	if err := query.Find(&accounts).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao buscar contas para sincronizacao"})
		return
	}

	now := time.Now()
	settings, err := getOrCreateTenantMarketplaceSettings(tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao carregar configuracoes de marketplace"})
		return
	}
	registry := marketplaceConnectorRegistry()
	results := make([]gin.H, 0, len(accounts))
	totalImported := 0
	totalInternalOrders := 0
	for i := range accounts {
		connector, ok := registry.Get(accounts[i].Provider)
		if !ok {
			accounts[i].SyncStatus = "connector_missing"
			accounts[i].LastSyncAt = &now
			accounts[i].LastError = "Conector nao implementado para este marketplace."
			_ = database.DB.Save(&accounts[i]).Error
			results = append(results, gin.H{
				"provider":        accounts[i].Provider,
				"status":          accounts[i].SyncStatus,
				"imported":        0,
				"internal_orders": 0,
				"message":         accounts[i].LastError,
			})
			continue
		}
		if err := h.ensureFreshMarketplaceToken(c.Request.Context(), &accounts[i]); err != nil {
			results = append(results, gin.H{
				"provider":        accounts[i].Provider,
				"status":          accounts[i].SyncStatus,
				"imported":        0,
				"internal_orders": 0,
				"message":         accounts[i].LastError,
			})
			continue
		}
		if _, err := h.reconcileMarketplaceAccountIdentity(c.Request.Context(), &accounts[i], connector); err != nil {
			accounts[i].SyncStatus = "identity_sync_error"
			accounts[i].LastSyncAt = &now
			accounts[i].LastError = marketplaceConnectorErrorMessage(err)
			_ = database.DB.Save(&accounts[i]).Error
			results = append(results, gin.H{
				"provider":        accounts[i].Provider,
				"status":          accounts[i].SyncStatus,
				"imported":        0,
				"internal_orders": 0,
				"message":         accounts[i].LastError,
			})
			continue
		}

		orderResult, err := connector.FetchOrders(c.Request.Context(), marketplaceAccountFromModel(accounts[i]), marketplaces.OrderSyncInput{Days: input.Days})
		if err != nil {
			accounts[i].SyncStatus = "orders_sync_error"
			if mercadolivre.IsOrderAccessForbidden(err) {
				accounts[i].SyncStatus = "orders_permission_error"
			}
			accounts[i].LastSyncAt = &now
			accounts[i].LastError = marketplaceOrderAccessErrorMessage(accounts[i], err)
			_ = database.DB.Save(&accounts[i]).Error
			results = append(results, gin.H{
				"provider":        accounts[i].Provider,
				"status":          accounts[i].SyncStatus,
				"imported":        0,
				"internal_orders": 0,
				"message":         accounts[i].LastError,
			})
			continue
		}

		imported := 0
		internalOrders := 0
		failed := false
		for _, externalOrder := range orderResult.Orders {
			createdInternal, err := importMarketplaceOrder(tenantID, accounts[i].Provider, externalOrder, settings)
			if err != nil {
				accounts[i].SyncStatus = "orders_import_error"
				accounts[i].LastSyncAt = &now
				accounts[i].LastError = err.Error()
				_ = database.DB.Save(&accounts[i]).Error
				results = append(results, gin.H{
					"provider":        accounts[i].Provider,
					"status":          accounts[i].SyncStatus,
					"imported":        imported,
					"internal_orders": internalOrders,
					"message":         err.Error(),
				})
				failed = true
				break
			}
			imported++
			if createdInternal {
				internalOrders++
			}
		}
		if failed {
			continue
		}

		totalImported += imported
		totalInternalOrders += internalOrders
		accounts[i].SyncStatus = "orders_synced"
		accounts[i].LastSyncAt = &now
		accounts[i].LastError = ""
		_ = database.DB.Save(&accounts[i]).Error
		results = append(results, gin.H{
			"provider":        accounts[i].Provider,
			"status":          accounts[i].SyncStatus,
			"imported":        imported,
			"internal_orders": internalOrders,
			"message":         orderResult.Message,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"days":            input.Days,
		"results":         results,
		"imported":        totalImported,
		"internal_orders": totalInternalOrders,
	})
}

func importMarketplaceOrder(tenantID uint, provider string, source marketplaces.Order, settings models.TenantMarketplaceSettings) (bool, error) {
	externalID := strings.TrimSpace(source.ExternalOrderID)
	if externalID == "" {
		return false, errors.New("ID externo do pedido e obrigatorio")
	}
	now := time.Now()
	if source.OrderedAt.IsZero() {
		source.OrderedAt = now
	}
	if source.Currency == "" {
		source.Currency = "BRL"
	}
	if source.NetAmount == 0 {
		source.NetAmount = source.GrossAmount - source.MarketplaceFees - source.ShippingCost - source.DiscountAmount
	}

	rawPayload := marshalMarketplacePayload(source.Raw, source)
	var external models.ExternalMarketplaceOrder
	err := database.DB.Where("tenant_id = ? AND provider = ? AND external_order_id = ?", tenantID, provider, externalID).First(&external).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		external = models.ExternalMarketplaceOrder{TenantID: tenantID, Provider: provider, ExternalOrderID: externalID}
	} else if err != nil {
		return false, err
	}

	external.ExternalStatus = defaultString(source.Status, "paid")
	external.Currency = source.Currency
	external.GrossAmount = source.GrossAmount
	external.ItemsAmount = source.ItemsAmount
	external.ShippingCost = source.ShippingCost
	external.MarketplaceFees = source.MarketplaceFees
	external.DiscountAmount = source.DiscountAmount
	external.NetAmount = source.NetAmount
	external.BuyerNickname = source.BuyerNickname
	external.OrderedAt = source.OrderedAt
	external.SyncedAt = now
	external.RawPayload = rawPayload
	if err := database.DB.Save(&external).Error; err != nil {
		return false, err
	}

	if err := database.DB.Where("tenant_id = ? AND external_order_id_ref = ?", tenantID, external.ID).Delete(&models.ExternalMarketplaceOrderItem{}).Error; err != nil {
		return false, err
	}
	externalItems := make([]models.ExternalMarketplaceOrderItem, 0, len(source.Items))
	for _, item := range source.Items {
		productID := resolveMarketplaceOrderProductID(tenantID, provider, item)
		quantity := item.Quantity
		if quantity <= 0 {
			quantity = 1
		}
		unitPrice := item.UnitPrice
		if unitPrice <= 0 && quantity > 0 {
			unitPrice = item.GrossAmount / float64(quantity)
		}
		externalItem := models.ExternalMarketplaceOrderItem{
			TenantID:           tenantID,
			ExternalOrderIDRef: external.ID,
			ProductID:          productID,
			Provider:           provider,
			ExternalItemID:     item.ExternalItemID,
			ExternalSKU:        item.ExternalSKU,
			Title:              item.Title,
			Quantity:           quantity,
			UnitPrice:          unitPrice,
			GrossAmount:        item.GrossAmount,
			FeeAmount:          item.FeeAmount,
			DiscountAmount:     item.DiscountAmount,
		}
		if err := database.DB.Create(&externalItem).Error; err != nil {
			return false, err
		}
		externalItems = append(externalItems, externalItem)
	}
	external.Items = externalItems

	if !settings.AutoCreateInternalOrders || external.InternalOrderID != nil || external.ExternalStatus == "cancelled" {
		return false, nil
	}
	internalOrder, created, err := createInternalOrderFromExternal(tenantID, external, externalItems)
	if err != nil || !created {
		return created, err
	}
	external.InternalOrderID = &internalOrder.ID
	if err := database.DB.Save(&external).Error; err != nil {
		return true, err
	}
	if settings.AutoCreateFinancialEntries {
		if err := createMarketplaceFinancialEntries(tenantID, external, externalItems, internalOrder); err != nil {
			return true, err
		}
	}
	return true, nil
}

func marshalMarketplacePayload(raw map[string]any, fallback marketplaces.Order) string {
	if raw != nil {
		if payload, err := json.Marshal(raw); err == nil {
			return string(payload)
		}
	}
	payload, err := json.Marshal(fallback)
	if err != nil {
		return "{}"
	}
	return string(payload)
}

func resolveMarketplaceOrderProductID(tenantID uint, provider string, item marketplaces.OrderItem) *uint {
	var mapping models.MarketplaceProductMapping
	query := database.DB.Where("tenant_id = ? AND provider = ?", tenantID, provider)
	if strings.TrimSpace(item.ExternalItemID) != "" {
		if err := query.Where("external_item_id = ?", strings.TrimSpace(item.ExternalItemID)).First(&mapping).Error; err == nil {
			return &mapping.ProductID
		}
	}
	if strings.TrimSpace(item.ExternalSKU) != "" {
		sku := strings.TrimSpace(item.ExternalSKU)
		if err := database.DB.Where("tenant_id = ? AND provider = ? AND (external_sku = ? OR internal_sku = ?)", tenantID, provider, sku, sku).First(&mapping).Error; err == nil {
			return &mapping.ProductID
		}
		var product models.Product
		if err := database.DB.Where("tenant_id = ? AND sku = ?", tenantID, sku).First(&product).Error; err == nil {
			return &product.ID
		}
	}
	return nil
}

func createInternalOrderFromExternal(tenantID uint, external models.ExternalMarketplaceOrder, externalItems []models.ExternalMarketplaceOrderItem) (models.Order, bool, error) {
	orderItems := []models.OrderItem{}
	totalAmount := 0.0
	for _, item := range externalItems {
		if item.ProductID == nil {
			continue
		}
		quantity := item.Quantity
		if quantity <= 0 {
			quantity = 1
		}
		unitPrice := item.UnitPrice
		if unitPrice <= 0 && quantity > 0 {
			unitPrice = item.GrossAmount / float64(quantity)
		}
		color := "Marketplace"
		orderItems = append(orderItems, models.OrderItem{
			ProductID: *item.ProductID,
			Quantity:  quantity,
			UnitPrice: unitPrice,
			Color:     color,
		})
		totalAmount += unitPrice * float64(quantity)
	}
	if len(orderItems) == 0 {
		return models.Order{}, false, nil
	}

	customer, err := getOrCreateMarketplaceCustomer(tenantID)
	if err != nil {
		return models.Order{}, false, err
	}
	order := models.Order{
		TenantID:        tenantID,
		UserID:          customer.ID,
		TotalAmount:     totalAmount,
		Status:          "printing",
		Items:           orderItems,
		ShippingAddress: fmt.Sprintf("[%s] Pedido externo %s - comprador: %s", marketplaceLabel(external.Provider), external.ExternalOrderID, external.BuyerNickname),
		DeliveryMethod:  "marketplace",
		RecipientName:   external.BuyerNickname,
		Notes:           "Pedido criado automaticamente pela sincronizacao de marketplace.",
	}
	if err := database.DB.Create(&order).Error; err != nil {
		return models.Order{}, false, err
	}
	database.DB.Preload("Items.Product").First(&order, order.ID)
	return order, true, nil
}

func getOrCreateMarketplaceCustomer(tenantID uint) (models.User, error) {
	email := fmt.Sprintf("marketplace+tenant%d@az3d.local", tenantID)
	var user models.User
	err := database.DB.Where("tenant_id = ? AND email = ?", tenantID, email).First(&user).Error
	if err == nil {
		return user, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return user, err
	}
	password, err := utils.HashPassword(fmt.Sprintf("marketplace-%d", tenantID))
	if err != nil {
		return user, err
	}
	user = models.User{
		TenantID: tenantID,
		Name:     "Comprador Marketplace",
		Email:    email,
		Password: password,
		Role:     "customer",
	}
	return user, database.DB.Create(&user).Error
}

func createMarketplaceFinancialEntries(tenantID uint, external models.ExternalMarketplaceOrder, externalItems []models.ExternalMarketplaceOrderItem, internalOrder models.Order) error {
	itemsAmount := external.ItemsAmount
	if itemsAmount <= 0 {
		for _, item := range externalItems {
			itemsAmount += item.GrossAmount
		}
	}
	for _, orderItem := range internalOrder.Items {
		externalItem, ok := findExternalItemByProductID(externalItems, orderItem.ProductID)
		if !ok {
			continue
		}
		var existing int64
		database.DB.Model(&models.ProductActualCost{}).Where("tenant_id = ? AND order_item_id = ?", tenantID, orderItem.ID).Count(&existing)
		if existing > 0 {
			continue
		}
		ratio := 0.0
		if itemsAmount > 0 {
			ratio = externalItem.GrossAmount / itemsAmount
		}
		fee := externalItem.FeeAmount
		if fee <= 0 {
			fee = external.MarketplaceFees * ratio
		}
		discount := externalItem.DiscountAmount
		if discount <= 0 {
			discount = external.DiscountAmount * ratio
		}
		shipping := external.ShippingCost * ratio
		occurredAt := external.OrderedAt
		actual := models.ProductActualCost{
			TenantID:             tenantID,
			ProductID:            orderItem.ProductID,
			OrderID:              &internalOrder.ID,
			OrderItemID:          &orderItem.ID,
			ShippingCost:         shipping,
			MarketplaceFeeAmount: fee,
			DiscountAmount:       discount,
			TotalCost:            shipping + fee + discount,
			Notes:                fmt.Sprintf("Custos importados do pedido %s %s", marketplaceLabel(external.Provider), external.ExternalOrderID),
			OccurredAt:           &occurredAt,
		}
		if err := database.DB.Create(&actual).Error; err != nil {
			return err
		}
	}
	return nil
}

func findExternalItemByProductID(items []models.ExternalMarketplaceOrderItem, productID uint) (models.ExternalMarketplaceOrderItem, bool) {
	for _, item := range items {
		if item.ProductID != nil && *item.ProductID == productID {
			return item, true
		}
	}
	return models.ExternalMarketplaceOrderItem{}, false
}

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
		"message":   "Webhook registrado para processamento.",
		"event_id":  event.ID,
		"tenant_id": tenantID,
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
	_ = c // Tenant identity must never come from public headers or query params.
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

// GET /api/admin/marketplaces/external-orders
func (h *MarketplaceHandler) GetExternalOrders(c *gin.Context) {
	tenantID := getTenantID(c)
	provider := normalizeProvider(c.Query("provider"))

	query := database.DB.Preload("Items.Product").Where("tenant_id = ?", tenantID)
	if provider != "" {
		query = query.Where("provider = ?", provider)
	}

	var orders []models.ExternalMarketplaceOrder
	if err := query.Order("ordered_at desc, created_at desc").Limit(200).Find(&orders).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao buscar pedidos externos"})
		return
	}

	c.JSON(http.StatusOK, orders)
}
