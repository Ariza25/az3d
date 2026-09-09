package handlers

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
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
	ClientID      string
	ClientSecret  string
	RedirectURI   string
	WebhookSecret string
}

type mercadoPagoPlatformConfigStatus struct {
	Source                  string   `json:"source"`
	Configured              bool     `json:"configured"`
	ClientIDConfigured      bool     `json:"client_id_configured"`
	ClientSecretConfigured  bool     `json:"client_secret_configured"`
	RedirectURIConfigured   bool     `json:"redirect_uri_configured"`
	WebhookSecretConfigured bool     `json:"webhook_secret_configured"`
	Missing                 []string `json:"missing"`
}

func NewMercadoPagoHandler(cfg *config.Config) *MercadoPagoHandler {
	return &MercadoPagoHandler{cfg: cfg, httpClient: &http.Client{Timeout: 20 * time.Second}}
}

func (h *MercadoPagoHandler) GetPlatformConfig(c *gin.Context) {
	if !isMasterAdmin(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Apenas master_admin pode consultar a aplicacao Mercado Pago"})
		return
	}
	c.JSON(http.StatusOK, h.platformConfigStatus())
}

func (h *MercadoPagoHandler) GetTenantStatus(c *gin.Context) {
	c.JSON(http.StatusOK, h.statusForTenant(getTenantID(c)))
}

func (h *MercadoPagoHandler) StartOAuth(c *gin.Context) {
	h.startOAuthForTenant(c, getTenantID(c))
}

func (h *MercadoPagoHandler) StartOAuthForTenant(c *gin.Context) {
	tenantID64, err := strconv.ParseUint(strings.TrimSpace(c.Param("tenant_id")), 10, 64)
	if err != nil || tenantID64 == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tenant invalido"})
		return
	}
	h.startOAuthForTenant(c, uint(tenantID64))
}

func (h *MercadoPagoHandler) startOAuthForTenant(c *gin.Context, tenantID uint) {
	if tenantID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tenant invalido"})
		return
	}
	if !tenantExists(tenantID) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Tenant nao encontrado"})
		return
	}
	platform, err := h.loadPlatformConfig()
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "A aplicacao OAuth do Mercado Pago nao esta configurada no ambiente da plataforma"})
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
		"client_id":             {platform.ClientID},
		"response_type":         {"code"},
		"platform_id":           {"mp"},
		"state":                 {state},
		"redirect_uri":          {platform.RedirectURI},
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
	if h == nil || h.cfg == nil {
		return decryptedMercadoPagoPlatformConfig{}, fmt.Errorf("platform config is unavailable")
	}
	platform := decryptedMercadoPagoPlatformConfig{
		ClientID: strings.TrimSpace(h.cfg.MercadoPagoClientID), ClientSecret: strings.TrimSpace(h.cfg.MercadoPagoClientSecret),
		RedirectURI: strings.TrimSpace(h.cfg.MercadoPagoRedirectURI), WebhookSecret: strings.TrimSpace(h.cfg.MercadoPagoWebhookSecret),
	}
	if platform.ClientID == "" || platform.ClientSecret == "" || platform.RedirectURI == "" || platform.WebhookSecret == "" {
		return decryptedMercadoPagoPlatformConfig{}, fmt.Errorf("mercado pago platform config is incomplete")
	}
	if err := validateOAuthRedirectURI(platform.RedirectURI, h.cfg.Env); err != nil {
		return decryptedMercadoPagoPlatformConfig{}, err
	}
	return platform, nil
}

func (h *MercadoPagoHandler) platformConfigStatus() mercadoPagoPlatformConfigStatus {
	status := mercadoPagoPlatformConfigStatus{Source: "environment", Missing: []string{}}
	if h == nil || h.cfg == nil {
		status.Missing = []string{"MERCADO_PAGO_CLIENT_ID", "MERCADO_PAGO_CLIENT_SECRET", "MERCADO_PAGO_REDIRECT_URI", "MERCADO_PAGO_WEBHOOK_SECRET"}
		return status
	}
	status.ClientIDConfigured = strings.TrimSpace(h.cfg.MercadoPagoClientID) != ""
	status.ClientSecretConfigured = strings.TrimSpace(h.cfg.MercadoPagoClientSecret) != ""
	status.RedirectURIConfigured = strings.TrimSpace(h.cfg.MercadoPagoRedirectURI) != ""
	status.WebhookSecretConfigured = strings.TrimSpace(h.cfg.MercadoPagoWebhookSecret) != ""
	if !status.ClientIDConfigured {
		status.Missing = append(status.Missing, "MERCADO_PAGO_CLIENT_ID")
	}
	if !status.ClientSecretConfigured {
		status.Missing = append(status.Missing, "MERCADO_PAGO_CLIENT_SECRET")
	}
	if !status.RedirectURIConfigured {
		status.Missing = append(status.Missing, "MERCADO_PAGO_REDIRECT_URI")
	}
	if !status.WebhookSecretConfigured {
		status.Missing = append(status.Missing, "MERCADO_PAGO_WEBHOOK_SECRET")
	}
	status.Configured = len(status.Missing) == 0
	return status
}

type mercadoPagoPreferenceResponse struct {
	ID               string `json:"id"`
	InitPoint        string `json:"init_point"`
	SandboxInitPoint string `json:"sandbox_init_point"`
}

type mercadoPagoPreferenceRequest struct {
	Items             []mercadoPagoPreferenceItem `json:"items"`
	Payer             mercadoPagoPayer            `json:"payer,omitempty"`
	ExternalReference string                      `json:"external_reference"`
	BackURLs          mercadoPagoBackURLs         `json:"back_urls"`
	AutoReturn        string                      `json:"auto_return,omitempty"`
	NotificationURL   string                      `json:"notification_url,omitempty"`
	StatementDesc     string                      `json:"statement_descriptor,omitempty"`
}

type mercadoPagoPreferenceItem struct {
	ID         string  `json:"id,omitempty"`
	Title      string  `json:"title"`
	Quantity   int     `json:"quantity"`
	UnitPrice  float64 `json:"unit_price"`
	CurrencyID string  `json:"currency_id"`
}

type mercadoPagoPayer struct {
	Name  string             `json:"name,omitempty"`
	Email string             `json:"email,omitempty"`
	Phone mercadoPagoPhone   `json:"phone,omitempty"`
	Addr  mercadoPagoAddress `json:"address,omitempty"`
}

type mercadoPagoPhone struct {
	Number string `json:"number,omitempty"`
}

type mercadoPagoAddress struct {
	ZipCode      string `json:"zip_code,omitempty"`
	StreetName   string `json:"street_name,omitempty"`
	StreetNumber string `json:"street_number,omitempty"`
}

type mercadoPagoBackURLs struct {
	Success string `json:"success"`
	Pending string `json:"pending"`
	Failure string `json:"failure"`
}

type mercadoPagoPaymentResponse struct {
	ID                 int64   `json:"id"`
	Status             string  `json:"status"`
	StatusDetail       string  `json:"status_detail"`
	ExternalReference  string  `json:"external_reference"`
	TransactionAmount  float64 `json:"transaction_amount"`
	DateApproved       string  `json:"date_approved"`
	PaymentMethodID    string  `json:"payment_method_id"`
	PaymentTypeID      string  `json:"payment_type_id"`
	MerchantOrderIDRaw any     `json:"order"`
}

type mercadoPagoWebhookPayload struct {
	ID     any    `json:"id"`
	Type   string `json:"type"`
	Action string `json:"action"`
	Data   struct {
		ID string `json:"id"`
	} `json:"data"`
}

func createMercadoPagoPreference(ctx context.Context, order models.Order, sellerAccessToken string) (*mercadoPagoPreferenceResponse, error) {
	accessToken := strings.TrimSpace(sellerAccessToken)
	if accessToken == "" {
		return nil, fmt.Errorf("access token OAuth do tenant nao configurado")
	}

	var user models.User
	_ = database.DB.First(&user, order.UserID).Error

	var tenant models.Tenant
	_ = database.DB.First(&tenant, order.TenantID).Error

	frontendBaseURL := strings.TrimRight(getEnv("FRONTEND_BASE_URL", "http://localhost:5173"), "/")
	apiPublicBaseURL := strings.TrimRight(getEnv("API_PUBLIC_BASE_URL", "http://localhost:8080"), "/")
	mpBaseURL := strings.TrimRight(getEnv("MERCADO_PAGO_API_BASE_URL", "https://api.mercadopago.com"), "/")
	storePath := fmt.Sprintf("%s/%s/store", frontendBaseURL, url.PathEscape(tenant.Slug))
	orderID := strconv.FormatUint(uint64(order.ID), 10)

	requestPayload := mercadoPagoPreferenceRequest{
		Items:             make([]mercadoPagoPreferenceItem, 0, len(order.Items)),
		ExternalReference: mercadoPagoExternalReference(order.ID),
		BackURLs: mercadoPagoBackURLs{
			Success: storePath + "?payment=success&order_id=" + orderID,
			Pending: storePath + "?payment=pending&order_id=" + orderID,
			Failure: storePath + "?payment=failure&order_id=" + orderID,
		},
		AutoReturn:    "approved",
		StatementDesc: "AZ3D",
		Payer: mercadoPagoPayer{
			Name:  firstNonEmpty(order.RecipientName, user.Name),
			Email: user.Email,
			Phone: mercadoPagoPhone{Number: order.RecipientPhone},
			Addr: mercadoPagoAddress{
				ZipCode:    order.ZipCode,
				StreetName: order.ShippingAddress,
			},
		},
	}

	if apiPublicBaseURL != "" {
		requestPayload.NotificationURL = fmt.Sprintf("%s/api/webhooks/payments/mercadopago/%d", apiPublicBaseURL, order.TenantID)
	}

	for _, item := range order.Items {
		title := fmt.Sprintf("Produto #%d", item.ProductID)
		if item.Product != nil && item.Product.Title != "" {
			title = item.Product.Title
		}
		requestPayload.Items = append(requestPayload.Items, mercadoPagoPreferenceItem{
			ID:         strconv.FormatUint(uint64(item.ProductID), 10),
			Title:      title,
			Quantity:   item.Quantity,
			UnitPrice:  item.UnitPrice,
			CurrencyID: "BRL",
		})
	}

	body, err := json.Marshal(requestPayload)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, mpBaseURL+"/checkout/preferences", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+accessToken)

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	resBody, _ := io.ReadAll(res.Body)
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return nil, fmt.Errorf("Mercado Pago retornou HTTP %d: %s", res.StatusCode, string(resBody))
	}

	var preference mercadoPagoPreferenceResponse
	if err := json.Unmarshal(resBody, &preference); err != nil {
		return nil, err
	}
	if preference.ID == "" || (preference.InitPoint == "" && preference.SandboxInitPoint == "") {
		return nil, fmt.Errorf("preferencia criada sem URL de checkout")
	}

	return &preference, nil
}

func (h *OrderHandler) ReceiveMercadoPagoWebhook(c *gin.Context) {
	tenantIDValue, err := strconv.ParseUint(strings.TrimSpace(c.Param("tenant_id")), 10, 64)
	if err != nil || tenantIDValue == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Webhook Mercado Pago sem tenant"})
		return
	}
	tenantID := uint(tenantIDValue)
	body, err := c.GetRawData()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Payload Mercado Pago invalido"})
		return
	}

	var payload mercadoPagoWebhookPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		savePaymentWebhookEvent(c, tenantID, nil, "mercadopago", "", "", "failed", body, "payload invalido")
		c.JSON(http.StatusBadRequest, gin.H{"error": "Webhook Mercado Pago invalido"})
		return
	}

	paymentID := firstNonEmpty(payload.Data.ID, c.Query("data.id"), c.Query("id"))
	eventType := firstNonEmpty(payload.Type, c.Query("type"), c.Query("topic"))
	event := savePaymentWebhookEvent(c, tenantID, nil, "mercadopago", eventType, paymentID, "received", body, "")
	if paymentID == "" || eventType != "payment" {
		markPaymentWebhookEvent(event, "ignored", nil, "")
		c.Status(http.StatusOK)
		return
	}

	if h.payments == nil {
		markPaymentWebhookEvent(event, "failed", nil, "integracao Mercado Pago indisponivel")
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Integracao Mercado Pago indisponivel"})
		return
	}
	webhookSecret, err := h.payments.WebhookSecret()
	if err != nil {
		markPaymentWebhookEvent(event, "failed", nil, "segredo do webhook indisponivel")
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Webhook Mercado Pago nao configurado"})
		return
	}
	if err := validateMercadoPagoWebhookSignature(c, paymentID, webhookSecret); err != nil {
		markPaymentWebhookEvent(event, "failed", nil, err.Error())
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	accessToken, err := h.payments.AccessTokenForTenant(c.Request.Context(), tenantID)
	if err != nil {
		markPaymentWebhookEvent(event, "failed", nil, "credencial OAuth do tenant indisponivel")
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Conta Mercado Pago do tenant indisponivel"})
		return
	}
	payment, err := getMercadoPagoPayment(c.Request.Context(), paymentID, accessToken)
	if err != nil {
		markPaymentWebhookEvent(event, "failed", nil, err.Error())
		c.JSON(http.StatusBadGateway, gin.H{"error": "Nao foi possivel consultar pagamento no Mercado Pago"})
		return
	}

	orderID, err := orderIDFromMercadoPagoReference(payment.ExternalReference)
	if err != nil {
		markPaymentWebhookEvent(event, "ignored", nil, "referencia externa sem pedido AZ3D")
		c.Status(http.StatusOK)
		return
	}
	var referencedOrder models.Order
	if err := database.DB.Select("tenant_id").First(&referencedOrder, orderID).Error; err != nil || referencedOrder.TenantID != tenantID {
		markPaymentWebhookEvent(event, "failed", &orderID, "pedido nao pertence ao tenant do webhook")
		c.JSON(http.StatusForbidden, gin.H{"error": "Pagamento nao pertence a este tenant"})
		return
	}

	if err := applyMercadoPagoPaymentToOrder(orderID, payment); err != nil {
		markPaymentWebhookEvent(event, "failed", &orderID, err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Nao foi possivel atualizar pedido"})
		return
	}

	var order models.Order
	if err := database.DB.Select("tenant_id").First(&order, orderID).Error; err == nil {
		database.DB.Model(&models.PaymentWebhookEvent{}).Where("id = ?", event.ID).Updates(map[string]any{"tenant_id": order.TenantID})
	}
	markPaymentWebhookEvent(event, "processed", &orderID, "")
	c.Status(http.StatusOK)
}

func savePaymentWebhookEvent(c *gin.Context, tenantID uint, orderID *uint, provider string, eventType string, externalID string, status string, body []byte, errorMessage string) models.PaymentWebhookEvent {
	headersPayload, _ := json.Marshal(webhookHeaders(c))
	event := models.PaymentWebhookEvent{
		TenantID:     tenantID,
		Provider:     provider,
		EventType:    eventType,
		ExternalID:   externalID,
		OrderID:      orderID,
		Status:       status,
		Payload:      string(body),
		Headers:      string(headersPayload),
		ErrorMessage: errorMessage,
		ReceivedAt:   time.Now(),
	}
	_ = database.DB.Create(&event).Error
	return event
}

func markPaymentWebhookEvent(event models.PaymentWebhookEvent, status string, orderID *uint, errorMessage string) {
	if event.ID == 0 {
		return
	}
	now := time.Now()
	updates := map[string]any{
		"status":        status,
		"processed_at":  &now,
		"error_message": errorMessage,
	}
	if orderID != nil {
		updates["order_id"] = *orderID
	}
	_ = database.DB.Model(&models.PaymentWebhookEvent{}).Where("id = ?", event.ID).Updates(updates).Error
}

func getMercadoPagoPayment(ctx context.Context, paymentID string, sellerAccessToken string) (*mercadoPagoPaymentResponse, error) {
	accessToken := strings.TrimSpace(sellerAccessToken)
	if accessToken == "" {
		return nil, fmt.Errorf("access token OAuth do tenant nao configurado")
	}

	mpBaseURL := strings.TrimRight(getEnv("MERCADO_PAGO_API_BASE_URL", "https://api.mercadopago.com"), "/")
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, mpBaseURL+"/v1/payments/"+url.PathEscape(paymentID), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	resBody, _ := io.ReadAll(res.Body)
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return nil, fmt.Errorf("Mercado Pago retornou HTTP %d: %s", res.StatusCode, string(resBody))
	}

	var payment mercadoPagoPaymentResponse
	if err := json.Unmarshal(resBody, &payment); err != nil {
		return nil, err
	}
	return &payment, nil
}

func applyMercadoPagoPaymentToOrder(orderID uint, payment *mercadoPagoPaymentResponse) error {
	return database.DB.Transaction(func(tx *gorm.DB) error {
		var order models.Order
		if err := tx.Preload("Items").Where("payment_provider = ? AND id = ?", "mercadopago", orderID).First(&order).Error; err != nil {
			return err
		}

		previousStatus := order.Status
		order.PaymentID = strconv.FormatInt(payment.ID, 10)
		order.PaymentStatus = payment.Status
		order.PaymentDetail = payment.StatusDetail

		switch payment.Status {
		case "approved":
			now := time.Now()
			order.Status = "paid"
			order.PaidAt = &now
		case "pending", "in_process", "in_mediation":
			order.Status = "pending_payment"
		case "rejected", "cancelled", "refunded", "charged_back":
			order.Status = "cancelled"
			if previousStatus != "cancelled" && previousStatus != "paid" {
				if err := releaseOrderStock(tx, order, "Liberacao automatica por pagamento "+payment.Status); err != nil {
					return err
				}
			}
		}

		return tx.Save(&order).Error
	})
}

func cancelOrderAndReleaseStock(orderID uint, reason string) error {
	return database.DB.Transaction(func(tx *gorm.DB) error {
		var order models.Order
		if err := tx.Preload("Items").First(&order, orderID).Error; err != nil {
			return err
		}
		if order.Status != "cancelled" {
			if err := releaseOrderStock(tx, order, reason); err != nil {
				return err
			}
		}
		order.Status = "cancelled"
		order.PaymentStatus = "failed"
		order.PaymentDetail = reason
		return tx.Save(&order).Error
	})
}

func releaseOrderStock(tx *gorm.DB, order models.Order, reason string) error {
	for _, item := range order.Items {
		var quantityAfter int
		var colorStock models.ProductColorStock
		colorStockErr := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("tenant_id = ? AND product_id = ? AND color_name = ?", order.TenantID, item.ProductID, item.Color).
			First(&colorStock).Error
		if colorStockErr == nil {
			colorStock.StockQty += item.Quantity
			quantityAfter = colorStock.StockQty
			if err := tx.Save(&colorStock).Error; err != nil {
				return err
			}

			var totalColorStock int64
			if err := tx.Model(&models.ProductColorStock{}).Where("tenant_id = ? AND product_id = ?", order.TenantID, item.ProductID).Select("COALESCE(SUM(stock_qty), 0)").Scan(&totalColorStock).Error; err != nil {
				return err
			}
			if err := tx.Model(&models.Product{}).Where("tenant_id = ? AND id = ?", order.TenantID, item.ProductID).Updates(map[string]any{
				"stock_qty": int(totalColorStock),
				"in_stock":  totalColorStock > 0,
			}).Error; err != nil {
				return err
			}
		} else if errors.Is(colorStockErr, gorm.ErrRecordNotFound) {
			var product models.Product
			if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("tenant_id = ?", order.TenantID).First(&product, item.ProductID).Error; err != nil {
				return err
			}
			product.StockQty += item.Quantity
			product.InStock = product.StockQty > 0
			quantityAfter = product.StockQty
			if err := tx.Save(&product).Error; err != nil {
				return err
			}
		} else {
			return colorStockErr
		}

		movement := models.StockMovement{
			TenantID:      order.TenantID,
			ProductID:     item.ProductID,
			OrderID:       &order.ID,
			ColorName:     item.Color,
			MovementType:  "order_release",
			QuantityDelta: item.Quantity,
			QuantityAfter: quantityAfter,
			Reason:        reason,
		}
		if err := tx.Create(&movement).Error; err != nil {
			return err
		}
	}

	return nil
}

func validateMercadoPagoWebhookSignature(c *gin.Context, paymentID string, webhookSecret string) error {
	secret := strings.TrimSpace(webhookSecret)
	if secret == "" {
		return nil
	}

	signatureHeader := c.GetHeader("x-signature")
	requestID := c.GetHeader("x-request-id")
	if signatureHeader == "" || requestID == "" {
		return fmt.Errorf("assinatura Mercado Pago ausente")
	}

	parts := map[string]string{}
	for _, rawPart := range strings.Split(signatureHeader, ",") {
		keyValue := strings.SplitN(strings.TrimSpace(rawPart), "=", 2)
		if len(keyValue) == 2 {
			parts[keyValue[0]] = keyValue[1]
		}
	}

	ts := parts["ts"]
	receivedSignature := parts["v1"]
	if ts == "" || receivedSignature == "" {
		return fmt.Errorf("assinatura Mercado Pago incompleta")
	}

	manifest := fmt.Sprintf("id:%s;request-id:%s;ts:%s;", paymentID, requestID, ts)
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(manifest))
	expectedSignature := hex.EncodeToString(mac.Sum(nil))
	if subtle.ConstantTimeCompare([]byte(expectedSignature), []byte(receivedSignature)) != 1 {
		return fmt.Errorf("assinatura Mercado Pago invalida")
	}

	return nil
}

func mercadoPagoExternalReference(orderID uint) string {
	return fmt.Sprintf("az3d_order_%d", orderID)
}

func orderIDFromMercadoPagoReference(reference string) (uint, error) {
	value := strings.TrimPrefix(reference, "az3d_order_")
	parsed, err := strconv.ParseUint(value, 10, 64)
	if err != nil {
		return 0, err
	}
	return uint(parsed), nil
}
