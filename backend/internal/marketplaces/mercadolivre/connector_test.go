package mercadolivre

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	mp "az3d-backend/internal/marketplaces"
)

func TestExchangeAuthCodeSendsPKCEVerifier(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := r.ParseForm(); err != nil {
			t.Fatal(err)
		}
		if got := r.Form.Get("code_verifier"); got != "pkce-verifier" {
			t.Fatalf("code_verifier = %q", got)
		}
		if got := r.Form.Get("redirect_uri"); got != "https://az3d.example/oauth/callback" {
			t.Fatalf("redirect_uri = %q", got)
		}
		if got := r.Form.Get("client_id"); got != "database-client" {
			t.Fatalf("client_id = %q", got)
		}
		if got := r.Form.Get("client_secret"); got != "database-secret" {
			t.Fatalf("client_secret = %q", got)
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"access_token": "access-secret", "refresh_token": "refresh-secret",
			"expires_in": 21600, "user_id": 12345,
		})
	}))
	defer server.Close()
	t.Setenv("MELI_API_BASE_URL", server.URL)
	token, err := New().ExchangeAuthCode(context.Background(), mp.Account{
		OAuthClientID: "database-client", OAuthClientSecret: "database-secret",
	}, mp.TokenRequest{
		Code: "authorization-code", RedirectURI: "https://az3d.example/oauth/callback", CodeVerifier: "pkce-verifier",
	})
	if err != nil {
		t.Fatal(err)
	}
	if token.SellerID != "12345" || token.AccessToken == "" || token.RefreshToken == "" {
		t.Fatalf("unexpected token result: %#v", token)
	}
}

func TestUnauthorizedResponseIsTypedAndDoesNotExposeCredentials(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, `{"message":"token secret-token invalid"}`, http.StatusUnauthorized)
	}))
	defer server.Close()
	t.Setenv("MELI_API_BASE_URL", server.URL)

	err := New().TestConnection(context.Background(), mp.Account{AccessToken: "secret-token"})
	if !IsUnauthorized(err) {
		t.Fatalf("error should be typed as unauthorized: %v", err)
	}
	if strings.Contains(err.Error(), "secret-token") {
		t.Fatalf("credential leaked in error: %v", err)
	}
}
