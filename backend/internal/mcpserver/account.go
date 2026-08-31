package mcpserver

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"
	"sync"
	"time"

	"az3d-backend/internal/marketplaces"
	"az3d-backend/models"
	"gorm.io/gorm"
)

var (
	ErrMELIAccountMissing   = errors.New("conta Mercado Livre nao autorizada para o tenant selecionado")
	ErrShopeeAccountMissing = errors.New("conta Shopee nao autorizada para o tenant selecionado")
)

type AccountSource interface {
	Account(context.Context) (marketplaces.Account, error)
}

type RefreshingAccountSource interface {
	AccountSource
	Refresh(context.Context) (marketplaces.Account, error)
}

// DatabaseAccountSource uses the same tenant-scoped OAuth grant as the AZ3D
// backend. The MCP never owns a second token store or asks for OAuth secrets.
type DatabaseAccountSource struct {
	mu        sync.Mutex
	store     accountStore
	connector marketplaces.Connector
	tenantID  uint
	secret    string
	now       func() time.Time
	provider  string
	missing   error
}

func NewDatabaseAccountSource(db *gorm.DB, connector marketplaces.Connector, tenantID uint, encryptionKey string) *DatabaseAccountSource {
	return newProviderDatabaseAccountSource(db, connector, tenantID, encryptionKey, "mercadolivre", ErrMELIAccountMissing)
}

func NewShopeeDatabaseAccountSource(db *gorm.DB, connector marketplaces.Connector, tenantID uint, encryptionKey string) *DatabaseAccountSource {
	return newProviderDatabaseAccountSource(db, connector, tenantID, encryptionKey, "shopee", ErrShopeeAccountMissing)
}

func newProviderDatabaseAccountSource(db *gorm.DB, connector marketplaces.Connector, tenantID uint, encryptionKey, provider string, missing error) *DatabaseAccountSource {
	var store accountStore
	if db != nil {
		store = gormAccountStore{db: db}
	}
	return newDatabaseAccountSourceForProvider(store, connector, tenantID, encryptionKey, provider, missing)
}

func newDatabaseAccountSource(store accountStore, connector marketplaces.Connector, tenantID uint, encryptionKey string) *DatabaseAccountSource {
	return newDatabaseAccountSourceForProvider(store, connector, tenantID, encryptionKey, "mercadolivre", ErrMELIAccountMissing)
}

func newShopeeDatabaseAccountSource(store accountStore, connector marketplaces.Connector, tenantID uint, encryptionKey string) *DatabaseAccountSource {
	return newDatabaseAccountSourceForProvider(store, connector, tenantID, encryptionKey, "shopee", ErrShopeeAccountMissing)
}

func newDatabaseAccountSourceForProvider(store accountStore, connector marketplaces.Connector, tenantID uint, encryptionKey, provider string, missing error) *DatabaseAccountSource {
	return &DatabaseAccountSource{
		store: store, connector: connector, tenantID: tenantID,
		secret: strings.TrimSpace(encryptionKey), now: time.Now,
		provider: strings.TrimSpace(provider), missing: missing,
	}
}

type accountStore interface {
	LoadMarketplaceAccount(context.Context, uint, string) (models.MarketplaceAccount, error)
	SaveMarketplaceAccount(context.Context, *models.MarketplaceAccount) error
}

type gormAccountStore struct {
	db *gorm.DB
}

func (s gormAccountStore) LoadMarketplaceAccount(ctx context.Context, tenantID uint, provider string) (models.MarketplaceAccount, error) {
	var model models.MarketplaceAccount
	err := s.db.WithContext(ctx).
		Where("tenant_id = ? AND provider = ? AND is_active = ?", tenantID, provider, true).
		First(&model).Error
	return model, err
}

func (s gormAccountStore) SaveMarketplaceAccount(ctx context.Context, model *models.MarketplaceAccount) error {
	return s.db.WithContext(ctx).Save(model).Error
}

func (s *DatabaseAccountSource) Account(ctx context.Context) (marketplaces.Account, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	model, account, err := s.load(ctx)
	if err != nil {
		return marketplaces.Account{}, err
	}
	if model.TokenExpiresAt != nil && !model.TokenExpiresAt.After(s.now().UTC().Add(10*time.Minute)) {
		return s.refreshLocked(ctx, &model, account)
	}
	return account, nil
}

func (s *DatabaseAccountSource) Refresh(ctx context.Context) (marketplaces.Account, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	model, account, err := s.load(ctx)
	if err != nil {
		return marketplaces.Account{}, err
	}
	return s.refreshLocked(ctx, &model, account)
}

func (s *DatabaseAccountSource) load(ctx context.Context) (models.MarketplaceAccount, marketplaces.Account, error) {
	if s.store == nil || s.tenantID == 0 || len(s.secret) < 32 {
		return models.MarketplaceAccount{}, marketplaces.Account{}, s.missingError()
	}
	model, err := s.store.LoadMarketplaceAccount(ctx, s.tenantID, s.provider)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return model, marketplaces.Account{}, s.missingError()
		}
		return model, marketplaces.Account{}, err
	}
	if !model.IsConnected || !s.hasAccountIdentifier(model) {
		return model, marketplaces.Account{}, s.missingError()
	}

	account := marketplaces.Account{
		Provider: model.Provider, AccountName: model.AccountName, SellerID: model.SellerID,
		ShopID: model.ShopID, Marketplace: model.Marketplace, AccessToken: model.AccessToken,
		RefreshToken: model.RefreshToken,
	}
	if s.provider == "mercadolivre" {
		account.OAuthClientID = strings.TrimSpace(os.Getenv("MELI_CLIENT_ID"))
		account.OAuthClientSecret = strings.TrimSpace(os.Getenv("MELI_CLIENT_SECRET"))
		if account.OAuthClientID == "" || account.OAuthClientSecret == "" {
			return model, marketplaces.Account{}, errors.New("aplicacao Mercado Livre nao configurada no ambiente")
		}
	}
	if strings.TrimSpace(account.AccessToken) == "" && strings.TrimSpace(account.RefreshToken) == "" {
		return model, marketplaces.Account{}, s.missingError()
	}
	return model, account, nil
}

func (s *DatabaseAccountSource) missingError() error {
	if s.missing != nil {
		return s.missing
	}
	return errors.New("conta de marketplace nao autorizada para o tenant selecionado")
}

func (s *DatabaseAccountSource) hasAccountIdentifier(model models.MarketplaceAccount) bool {
	if s.provider == "shopee" {
		return strings.TrimSpace(model.ShopID) != ""
	}
	return strings.TrimSpace(model.SellerID) != ""
}

func (s *DatabaseAccountSource) refreshLocked(ctx context.Context, model *models.MarketplaceAccount, account marketplaces.Account) (marketplaces.Account, error) {
	if s.connector == nil || strings.TrimSpace(account.RefreshToken) == "" {
		return marketplaces.Account{}, s.missingError()
	}
	token, err := s.connector.RefreshAccessToken(ctx, account)
	if err != nil {
		return marketplaces.Account{}, err
	}
	if token.AccessToken != "" {
		account.AccessToken = token.AccessToken
		model.AccessToken = token.AccessToken
	}
	if token.RefreshToken != "" {
		account.RefreshToken = token.RefreshToken
		model.RefreshToken = token.RefreshToken
	}
	if token.SellerID != "" {
		account.SellerID = token.SellerID
		model.SellerID = token.SellerID
	}
	if token.ShopID != "" {
		account.ShopID = token.ShopID
		model.ShopID = token.ShopID
	}
	if token.Marketplace != "" {
		account.Marketplace = token.Marketplace
		model.Marketplace = token.Marketplace
	}
	expiresAt := token.ExpiresAt
	if expiresAt.IsZero() && token.ExpiresIn > 0 {
		expiresAt = s.now().UTC().Add(time.Duration(token.ExpiresIn) * time.Second)
	}
	if !expiresAt.IsZero() {
		model.TokenExpiresAt = &expiresAt
	}
	model.IsConnected = true
	model.SyncStatus = "connected"
	model.LastError = ""
	if err := s.store.SaveMarketplaceAccount(ctx, model); err != nil {
		return marketplaces.Account{}, fmt.Errorf("token renovado, mas nao foi salvo no tenant: %w", err)
	}
	return account, nil
}

type DoctorResult struct {
	Provider    string
	SellerID    string
	ShopID      string
	Marketplace string
}

func RunDoctor(ctx context.Context, connector marketplaces.Connector, accounts AccountSource) (DoctorResult, error) {
	account, err := accounts.Account(ctx)
	if err != nil {
		return DoctorResult{}, err
	}
	if err := connector.TestConnection(ctx, account); err != nil {
		if !marketplaces.IsUnauthorized(connector, err) {
			return DoctorResult{}, err
		}
		refresher, ok := accounts.(RefreshingAccountSource)
		if !ok {
			return DoctorResult{}, err
		}
		account, err = refresher.Refresh(ctx)
		if err != nil {
			return DoctorResult{}, err
		}
		if err = connector.TestConnection(ctx, account); err != nil {
			return DoctorResult{}, err
		}
	}
	return DoctorResult{Provider: connector.Provider(), SellerID: account.SellerID, ShopID: account.ShopID, Marketplace: account.Marketplace}, nil
}
