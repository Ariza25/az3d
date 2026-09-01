package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"az3d-backend/config"
	"az3d-backend/database"
	"az3d-backend/utils"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func installMarketplaceOAuthMockDB(t *testing.T) sqlmock.Sqlmock {
	t.Helper()
	sqlDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	gormDB, err := gorm.Open(postgres.New(postgres.Config{Conn: sqlDB}), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatal(err)
	}
	previous := database.DB
	database.DB = gormDB
	t.Cleanup(func() {
		database.DB = previous
		_ = sqlDB.Close()
	})
	return mock
}

func expectOAuthSessionFound(mock sqlmock.Sqlmock, stateHash, encryptedVerifier string, tenantID uint) {
	now := time.Now().UTC()
	mock.ExpectBegin()
	mock.ExpectQuery(`SELECT .* FROM "marketplace_o_auth_sessions"`).
		WillReturnRows(sqlmock.NewRows([]string{
			"state_hash", "tenant_id", "provider", "encrypted_code_verifier", "expires_at", "used_at", "created_at",
		}).AddRow(stateHash, tenantID, mercadoLivreProvider, encryptedVerifier, now.Add(time.Minute), nil, now))
	mock.ExpectExec(`UPDATE "marketplace_o_auth_sessions" SET`).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()
}

func expectOAuthSessionMissing(mock sqlmock.Sqlmock) {
	mock.ExpectBegin()
	mock.ExpectQuery(`SELECT .* FROM "marketplace_o_auth_sessions"`).
		WillReturnError(gorm.ErrRecordNotFound)
	mock.ExpectRollback()
}

func TestMercadoLivreOAuthCallbackConsumesPKCEAndPersistsConnectedAccount(t *testing.T) {
	gin.SetMode(gin.TestMode)
	key := "12345678901234567890123456789012"
	t.Setenv("CREDENTIAL_ENCRYPTION_KEY", key)
	state := "single-use-state"
	verifier := "pkce-verifier"
	encryptedVerifier, err := utils.EncryptString(verifier, key)
	if err != nil {
		t.Fatal(err)
	}
	tokenServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/oauth/token" {
			http.NotFound(w, r)
			return
		}
		if err := r.ParseForm(); err != nil {
			t.Errorf("parse token form: %v", err)
			return
		}
		if r.Form.Get("code") != "authorization-code" || r.Form.Get("code_verifier") != verifier {
			t.Errorf("callback did not preserve code/PKCE: %#v", r.Form)
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"access_token": "seller-access", "refresh_token": "seller-refresh",
			"expires_in": 21600, "user_id": 12345,
		})
	}))
	defer tokenServer.Close()
	t.Setenv("MELI_API_BASE_URL", tokenServer.URL)

	mock := installMarketplaceOAuthMockDB(t)
	expectOAuthSessionFound(mock, hashMarketplaceOAuthState(state), encryptedVerifier, 7)
	mock.ExpectQuery(`SELECT .* FROM "marketplace_accounts"`).
		WillReturnError(gorm.ErrRecordNotFound)
	mock.ExpectBegin()
	mock.ExpectQuery(`INSERT INTO "marketplace_accounts"`).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(99))
	mock.ExpectCommit()
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/marketplaces/mercadolivre/oauth/callback?state="+state+"&code=authorization-code", nil)
	handler := NewMarketplaceHandler(&config.Config{
		CredentialEncryptionKey: key, FrontendBaseURL: "https://app.az3d.test", Env: "production",
		MercadoLivreClientID: "client-id", MercadoLivreClientSecret: "client-secret",
		MercadoLivreRedirectURI: "https://api.az3d.test/api/marketplaces/mercadolivre/oauth/callback",
	})
	handler.MercadoLivreOAuthCallback(ctx)

	if recorder.Code != http.StatusSeeOther {
		t.Fatalf("callback status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
	expectationErr := mock.ExpectationsWereMet()
	if location := recorder.Header().Get("Location"); !strings.Contains(location, "marketplace_oauth=connected") || !strings.Contains(location, "tenant_id=7") {
		t.Fatalf("unexpected callback redirect: %q; SQL expectations: %v", location, expectationErr)
	}
	if expectationErr != nil {
		t.Fatal(expectationErr)
	}
}

func TestMarketplaceOAuthSessionCannotBeReused(t *testing.T) {
	key := "12345678901234567890123456789012"
	verifier, err := utils.EncryptString("verifier", key)
	if err != nil {
		t.Fatal(err)
	}
	mock := installMarketplaceOAuthMockDB(t)
	state := "one-time-state"
	expectOAuthSessionFound(mock, hashMarketplaceOAuthState(state), verifier, 7)
	expectOAuthSessionMissing(mock)

	if _, err := consumeMarketplaceOAuthSession(state, mercadoLivreProvider); err != nil {
		t.Fatalf("first consumption failed: %v", err)
	}
	if _, err := consumeMarketplaceOAuthSession(state, mercadoLivreProvider); err == nil {
		t.Fatal("OAuth state was reusable")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestMarketplaceOAuthSessionRejectsExpiredState(t *testing.T) {
	mock := installMarketplaceOAuthMockDB(t)
	expectOAuthSessionMissing(mock)
	if _, err := consumeMarketplaceOAuthSession("expired-state", mercadoLivreProvider); err == nil {
		t.Fatal("expired OAuth state was accepted")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}
