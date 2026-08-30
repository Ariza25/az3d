package mcpserver

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"az3d-backend/internal/marketplaces"
	"az3d-backend/internal/marketplaces/mercadolivre"
	"az3d-backend/models"
	"az3d-backend/utils"

	"gorm.io/gorm"
)

var ErrMELIAccountMissing = errors.New("conta Mercado Livre nao autorizada para o tenant selecionado")

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
}

func NewDatabaseAccountSource(db *gorm.DB, connector marketplaces.Connector, tenantID uint, encryptionKey string) *DatabaseAccountSource {
	var store accountStore
	if db != nil {
		store = gormAccountStore{db: db}
	}
	return newDatabaseAccountSource(store, connector, tenantID, encryptionKey)
}

func newDatabaseAccountSource(store accountStore, connector marketplaces.Connector, tenantID uint, encryptionKey string) *DatabaseAccountSource {
	return &DatabaseAccountSource{
		store: store, connector: connector, tenantID: tenantID,
		secret: strings.TrimSpace(encryptionKey), now: time.Now,
	}
}

type accountStore interface {
	LoadMarketplaceAccount(context.Context, uint) (models.MarketplaceAccount, error)
	LoadMercadoLivrePlatformConfig(context.Context) (models.MercadoLivrePlatformConfig, error)
	SaveMarketplaceAccount(context.Context, *models.MarketplaceAccount) error
}

type gormAccountStore struct {
	db *gorm.DB
}

func (s gormAccountStore) LoadMarketplaceAccount(ctx context.Context, tenantID uint) (models.MarketplaceAccount, error) {
	var model models.MarketplaceAccount
	err := s.db.WithContext(ctx).
		Where("tenant_id = ? AND provider = ? AND is_active = ?", tenantID, "mercadolivre", true).
		First(&model).Error
	return model, err
}

func (s gormAccountStore) LoadMercadoLivrePlatformConfig(ctx context.Context) (models.MercadoLivrePlatformConfig, error) {
	var platform models.MercadoLivrePlatformConfig
	err := s.db.WithContext(ctx).First(&platform, 1).Error
	return platform, err
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
		return models.MarketplaceAccount{}, marketplaces.Account{}, ErrMELIAccountMissing
	}
	model, err := s.store.LoadMarketplaceAccount(ctx, s.tenantID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return model, marketplaces.Account{}, ErrMELIAccountMissing
		}
		return model, marketplaces.Account{}, err
	}
	if !model.IsConnected || strings.TrimSpace(model.SellerID) == "" {
		return model, marketplaces.Account{}, ErrMELIAccountMissing
	}

	platform, err := s.store.LoadMercadoLivrePlatformConfig(ctx)
	if err != nil {
		return model, marketplaces.Account{}, fmt.Errorf("aplicacao Mercado Livre nao configurada: %w", err)
	}
	clientSecret, err := utils.DecryptString(platform.EncryptedClientSecret, s.secret)
	if err != nil {
		return model, marketplaces.Account{}, errors.New("nao foi possivel descriptografar a aplicacao Mercado Livre")
	}
	account := marketplaces.Account{
		Provider: model.Provider, AccountName: model.AccountName, SellerID: model.SellerID,
		ShopID: model.ShopID, Marketplace: model.Marketplace, AccessToken: model.AccessToken,
		RefreshToken: model.RefreshToken, OAuthClientID: platform.ClientID, OAuthClientSecret: clientSecret,
	}
	if strings.TrimSpace(account.AccessToken) == "" && strings.TrimSpace(account.RefreshToken) == "" {
		return model, marketplaces.Account{}, ErrMELIAccountMissing
	}
	return model, account, nil
}

func (s *DatabaseAccountSource) refreshLocked(ctx context.Context, model *models.MarketplaceAccount, account marketplaces.Account) (marketplaces.Account, error) {
	if s.connector == nil || strings.TrimSpace(account.RefreshToken) == "" {
		return marketplaces.Account{}, ErrMELIAccountMissing
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
	SellerID    string
	Marketplace string
}

func RunDoctor(ctx context.Context, connector marketplaces.Connector, accounts AccountSource) (DoctorResult, error) {
	account, err := accounts.Account(ctx)
	if err != nil {
		return DoctorResult{}, err
	}
	if err := connector.TestConnection(ctx, account); err != nil {
		if !mercadolivre.IsUnauthorized(err) {
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
	return DoctorResult{SellerID: account.SellerID, Marketplace: account.Marketplace}, nil
}
