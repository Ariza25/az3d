package handlers

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"az3d-backend/config"
	"az3d-backend/models"

	"github.com/gin-gonic/gin"
)

func TestMercadoPagoAuthorizationCodeExchangeUsesPKCE(t *testing.T) {
	var requestPayload map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/oauth/token" {
			http.NotFound(w, r)
			return
		}
		if err := json.NewDecoder(r.Body).Decode(&requestPayload); err != nil {
			t.Errorf("decode request: %v", err)
			http.Error(w, "invalid body", http.StatusBadRequest)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"access_token":"seller-access","refresh_token":"seller-refresh","expires_in":15552000,"scope":"read write offline_access","user_id":12345,"public_key":"seller-public","live_mode":true}`))
	}))
	defer server.Close()
	t.Setenv("MERCADO_PAGO_API_BASE_URL", server.URL)

	handler := NewMercadoPagoHandler(&config.Config{})
	platform := decryptedMercadoPagoPlatformConfig{
		Model: models.MercadoPagoPlatformConfig{
			ClientID:    "client-id",
			RedirectURI: "https://api.az3d.test/api/payments/mercadopago/oauth/callback",
		},
		ClientSecret: "client-secret",
	}
	token, err := handler.exchangeAuthorizationCode(context.Background(), platform, "authorization-code", "pkce-verifier")
	if err != nil {
		t.Fatal(err)
	}
	if token.AccessToken != "seller-access" || mercadoPagoUserID(token.UserID) != "12345" {
		t.Fatalf("unexpected seller token: %#v", token)
	}
	if requestPayload["grant_type"] != "authorization_code" || requestPayload["code_verifier"] != "pkce-verifier" {
		t.Fatalf("authorization code exchange without PKCE: %#v", requestPayload)
	}
	if requestPayload["client_secret"] != "client-secret" || requestPayload["redirect_uri"] != platform.Model.RedirectURI {
		t.Fatalf("platform OAuth credentials missing: %#v", requestPayload)
	}
}

func TestPaymentOAuthStateAndPKCEAreOpaque(t *testing.T) {
	state, err := randomPaymentOAuthValue(32)
	if err != nil {
		t.Fatal(err)
	}
	verifier, err := randomPaymentOAuthValue(48)
	if err != nil {
		t.Fatal(err)
	}
	if len(state) < 40 || strings.ContainsAny(state, "+/=") {
		t.Fatalf("state is not base64url without padding: %q", state)
	}
	if hashPaymentOAuthState(state) == state || paymentPKCEChallenge(verifier) == verifier {
		t.Fatal("state hash or PKCE challenge did not transform the secret")
	}
}

func TestMercadoPagoWebhookSignatureUsesStoredSecret(t *testing.T) {
	gin.SetMode(gin.TestMode)
	paymentID := "987654"
	requestID := "request-123"
	timestamp := "1710000000"
	secret := "tenant-platform-webhook-secret"
	manifest := "id:" + paymentID + ";request-id:" + requestID + ";ts:" + timestamp + ";"
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(manifest))
	signature := hex.EncodeToString(mac.Sum(nil))

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/webhooks/payments/mercadopago/1", nil)
	ctx.Request.Header.Set("x-request-id", requestID)
	ctx.Request.Header.Set("x-signature", "ts="+timestamp+",v1="+signature)
	if err := validateMercadoPagoWebhookSignature(ctx, paymentID, secret); err != nil {
		t.Fatalf("valid signature rejected: %v", err)
	}
	if err := validateMercadoPagoWebhookSignature(ctx, paymentID, "another-secret"); err == nil {
		t.Fatal("signature made with another secret was accepted")
	}
}

func TestProductionOAuthRedirectRequiresHTTPS(t *testing.T) {
	if err := validateOAuthRedirectURI("http://api.az3d.test/callback", "production"); err == nil {
		t.Fatal("production accepted an insecure OAuth redirect")
	}
	if err := validateOAuthRedirectURI("https://api.az3d.test/callback", "production"); err != nil {
		t.Fatalf("production rejected an HTTPS OAuth redirect: %v", err)
	}
}
