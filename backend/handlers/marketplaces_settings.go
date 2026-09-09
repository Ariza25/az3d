package handlers

import (
	"context"
	"crypto/hmac"
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

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

var marketplaceLabels = map[string]string{
	"mercadolivre": "Mercado Livre",
	"shopee":       "Shopee",
	"amazon":       "Amazon Seller",
}

func defaultTenantMarketplaceSettings(tenantID uint) models.TenantMarketplaceSettings {
	return models.TenantMarketplaceSettings{
		TenantID:                   tenantID,
		MarketplaceControlsPrice:   true,
		MarketplaceControlsStock:   true,
		ContentSyncPolicy:          "imported_only",
		NewImportedProductStatus:   "draft",
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
		return "draft"
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

	if time.Until(*account.TokenExpiresAt) > 10*time.Minute {
		return nil
	}

	return h.refreshMarketplaceAccountToken(ctx, account, true)
}

func (h *MarketplaceHandler) refreshMarketplaceAccountToken(ctx context.Context, account *models.MarketplaceAccount, force bool) error {
	if account == nil {
		return errors.New("Conta de marketplace invalida")
	}
	connector, ok := marketplaceConnectorRegistry().Get(account.Provider)
	if !ok {
		account.SyncStatus = "connector_missing"
		account.LastError = "Conector nao encontrado."
		_ = database.DB.Save(account).Error
		return errors.New(account.LastError)
	}

	token, err := connector.RefreshAccessToken(ctx, marketplaceAccountFromModel(*account))
	if err != nil {
		if errors.Is(err, marketplaces.ErrMissingCredentials) || errors.Is(err, marketplaces.ErrNotConfigured) {
			if strings.TrimSpace(account.AccessToken) != "" {
				return nil
			}
			account.SyncStatus = "pending_credentials"
			account.LastError = "Modo simulacao ativado (sem credenciais de API do marketplace)."
			_ = database.DB.Save(account).Error
			return nil
		}

		account.IsConnected = false
		account.SyncStatus = "refresh_token_error"
		account.LastError = marketplaceConnectorErrorMessage(err)
		_ = database.DB.Save(account).Error
		return errors.New(account.LastError)
	}

	applyMarketplaceTokenResult(account, token)
	account.SyncStatus = "connected"
	account.LastError = ""
	return database.DB.Save(account).Error
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
	if err == nil {
		return ""
	}
	if errors.Is(err, marketplaces.ErrMissingCredentials) || errors.Is(err, marketplaces.ErrNotConfigured) {
		return "Credenciais do aplicativo/parceiro nao configuradas no servidor."
	}
	var meliErr *mercadolivre.APIError
	if errors.As(err, &meliErr) {
		return fmt.Sprintf("API Mercado Livre retornou erro HTTP %d na operacao %s.", meliErr.StatusCode, meliErr.Operation)
	}
	return err.Error()
}

func marketplaceOrderAccessErrorMessage(account models.MarketplaceAccount, err error) string {
	if err == nil {
		return ""
	}
	if mercadolivre.IsOrderAccessForbidden(err) {
		return fmt.Sprintf("Integracao autorizada, mas a API /orders do Mercado Livre recusou a consulta para o Seller ID '%s'. Reconecte a conta do vendedor para atualizar as permissoes de pedidos.", account.SellerID)
	}
	return marketplaceConnectorErrorMessage(err)
}
