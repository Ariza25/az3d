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
	"time"

	"az3d-backend/database"
	"az3d-backend/models"
	"az3d-backend/utils"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

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
		"client_id": platform.ClientID, "client_secret": platform.ClientSecret,
		"grant_type": "authorization_code", "code": code, "redirect_uri": platform.RedirectURI,
		"code_verifier": verifier,
	})
}

func (h *MercadoPagoHandler) exchangeRefreshToken(ctx context.Context, platform decryptedMercadoPagoPlatformConfig, refreshToken string) (mercadoPagoOAuthToken, error) {
	return h.postOAuthToken(ctx, map[string]any{
		"client_id": platform.ClientID, "client_secret": platform.ClientSecret,
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
