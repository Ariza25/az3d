package mcpserver

import (
	"context"
	"errors"
	"testing"
	"time"

	"az3d-backend/internal/marketplaces"
	"az3d-backend/models"
	"az3d-backend/utils"
)

type memoryAccountStore struct {
	account   models.MarketplaceAccount
	platform  models.MercadoLivrePlatformConfig
	loadErr   error
	configErr error
	saveErr   error
	saved     models.MarketplaceAccount
	saveCalls int
	provider  string
}

func (s *memoryAccountStore) LoadMarketplaceAccount(_ context.Context, _ uint, provider string) (models.MarketplaceAccount, error) {
	s.provider = provider
	return s.account, s.loadErr
}

func (s *memoryAccountStore) LoadMercadoLivrePlatformConfig(context.Context) (models.MercadoLivrePlatformConfig, error) {
	return s.platform, s.configErr
}

func (s *memoryAccountStore) SaveMarketplaceAccount(_ context.Context, account *models.MarketplaceAccount) error {
	s.saveCalls++
	s.saved = *account
	return s.saveErr
}

func TestDatabaseAccountSourceDecryptsConfigRefreshesAndPersistsExpiringToken(t *testing.T) {
	key := "12345678901234567890123456789012"
	encryptedSecret, err := utils.EncryptString("meli-client-secret", key)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 8, 30, 12, 0, 0, 0, time.UTC)
	expiresAt := now.Add(5 * time.Minute)
	store := &memoryAccountStore{
		account: models.MarketplaceAccount{
			ID: 9, TenantID: 7, Provider: "mercadolivre", SellerID: "12345", Marketplace: "MLB",
			AccessToken: "old-access", RefreshToken: "old-refresh", TokenExpiresAt: &expiresAt,
			IsActive: true, IsConnected: true,
		},
		platform: models.MercadoLivrePlatformConfig{ID: 1, ClientID: "meli-client", EncryptedClientSecret: encryptedSecret},
	}
	connector := &fakeConnector{refreshToken: marketplaces.TokenResult{
		AccessToken: "new-access", RefreshToken: "new-refresh", SellerID: "12345", ExpiresIn: 21600,
	}}
	source := newDatabaseAccountSource(store, connector, 7, key)
	source.now = func() time.Time { return now }

	account, err := source.Account(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if connector.refreshCalls != 1 || store.saveCalls != 1 {
		t.Fatalf("refresh calls = %d, save calls = %d", connector.refreshCalls, store.saveCalls)
	}
	if connector.refreshAccount.OAuthClientID != "meli-client" || connector.refreshAccount.OAuthClientSecret != "meli-client-secret" {
		t.Fatalf("OAuth config was not decrypted for refresh: %#v", connector.refreshAccount)
	}
	if account.AccessToken != "new-access" || account.RefreshToken != "new-refresh" {
		t.Fatalf("refreshed account = %#v", account)
	}
	if store.saved.AccessToken != "new-access" || store.saved.RefreshToken != "new-refresh" || store.saved.TokenExpiresAt == nil {
		t.Fatalf("refreshed credentials were not persisted: %#v", store.saved)
	}
}

func TestDatabaseAccountSourceKeepsFreshTokenWithoutRefresh(t *testing.T) {
	key := "12345678901234567890123456789012"
	encryptedSecret, err := utils.EncryptString("meli-client-secret", key)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 8, 30, 12, 0, 0, 0, time.UTC)
	expiresAt := now.Add(time.Hour)
	store := &memoryAccountStore{
		account: models.MarketplaceAccount{
			TenantID: 7, Provider: "mercadolivre", SellerID: "12345", Marketplace: "MLB",
			AccessToken: "fresh-access", RefreshToken: "refresh", TokenExpiresAt: &expiresAt,
			IsActive: true, IsConnected: true,
		},
		platform: models.MercadoLivrePlatformConfig{ID: 1, ClientID: "meli-client", EncryptedClientSecret: encryptedSecret},
	}
	connector := &fakeConnector{}
	source := newDatabaseAccountSource(store, connector, 7, key)
	source.now = func() time.Time { return now }

	account, err := source.Account(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if account.AccessToken != "fresh-access" || connector.refreshCalls != 0 || store.saveCalls != 0 {
		t.Fatalf("fresh account unexpectedly refreshed: %#v", account)
	}
}

func TestShopeeDatabaseAccountSourceUsesShopGrantAndPersistsRefresh(t *testing.T) {
	key := "12345678901234567890123456789012"
	now := time.Date(2026, 8, 30, 12, 0, 0, 0, time.UTC)
	expiresAt := now.Add(5 * time.Minute)
	store := &memoryAccountStore{account: models.MarketplaceAccount{
		ID: 12, TenantID: 7, Provider: "shopee", ShopID: "98765", Marketplace: "BR",
		AccessToken: "old-access", RefreshToken: "old-refresh", TokenExpiresAt: &expiresAt,
		IsActive: true, IsConnected: true,
	}}
	connector := &fakeConnector{provider: "shopee", refreshToken: marketplaces.TokenResult{
		AccessToken: "new-access", RefreshToken: "new-refresh", ShopID: "98765", ExpiresIn: 14400,
	}}
	source := newShopeeDatabaseAccountSource(store, connector, 7, key)
	source.now = func() time.Time { return now }

	account, err := source.Account(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if store.provider != "shopee" || account.ShopID != "98765" {
		t.Fatalf("wrong provider/shop grant loaded: provider=%q account=%#v", store.provider, account)
	}
	if connector.refreshCalls != 1 || store.saveCalls != 1 || store.saved.AccessToken != "new-access" || store.saved.ShopID != "98765" {
		t.Fatalf("Shopee refresh was not persisted: calls=%d saves=%d saved=%#v", connector.refreshCalls, store.saveCalls, store.saved)
	}
}

type refreshingStaticAccountSource struct {
	current      marketplaces.Account
	refreshed    marketplaces.Account
	refreshCalls int
}

func (s *refreshingStaticAccountSource) Account(context.Context) (marketplaces.Account, error) {
	return s.current, nil
}

func (s *refreshingStaticAccountSource) Refresh(context.Context) (marketplaces.Account, error) {
	s.refreshCalls++
	return s.refreshed, nil
}

func TestRunDoctorRefreshesAfterUnauthorized(t *testing.T) {
	unauthorized := errors.New("unauthorized")
	connector := &fakeConnector{unauthorized: unauthorized, testErrors: []error{unauthorized, nil}}
	accounts := &refreshingStaticAccountSource{
		current:   marketplaces.Account{SellerID: "12345", AccessToken: "expired", Marketplace: "MLB"},
		refreshed: marketplaces.Account{SellerID: "12345", AccessToken: "fresh", Marketplace: "MLB"},
	}

	result, err := RunDoctor(context.Background(), connector, accounts)
	if err != nil {
		t.Fatal(err)
	}
	if result.SellerID != "12345" || connector.testCalls != 2 || accounts.refreshCalls != 1 {
		t.Fatalf("doctor did not refresh and retry: result=%#v tests=%d refresh=%d", result, connector.testCalls, accounts.refreshCalls)
	}
}

func TestRunDoctorDoesNotHideNonAuthorizationFailure(t *testing.T) {
	want := errors.New("network unavailable")
	connector := &fakeConnector{testErr: want}
	accounts := &refreshingStaticAccountSource{current: marketplaces.Account{AccessToken: "token"}}
	_, err := RunDoctor(context.Background(), connector, accounts)
	if !errors.Is(err, want) || accounts.refreshCalls != 0 {
		t.Fatalf("unexpected doctor failure handling: %v", err)
	}
}
