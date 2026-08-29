package mcpserver

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"az3d-backend/internal/marketplaces"
	"az3d-backend/utils"
)

var ErrMELICredentialsMissing = errors.New("configure MELI_ACCESS_TOKEN e MELI_SELLER_ID antes de usar o MCP")
var ErrTokenPersistenceMissing = errors.New("configure MELI_TOKEN_STORE_PATH e CREDENTIAL_ENCRYPTION_KEY antes de renovar tokens")

type AccountSource interface {
	Account(context.Context) (marketplaces.Account, error)
}

type RefreshingAccountSource interface {
	AccountSource
	Refresh(context.Context) (marketplaces.Account, error)
}

// EnvironmentAccountSource keeps credentials in memory and serializes token
// refreshes. It never writes tokens to stdout, logs or the repository.
type EnvironmentAccountSource struct {
	mu        sync.Mutex
	connector marketplaces.Connector
	account   marketplaces.Account
	expiresAt time.Time
	storePath string
	secret    string
	loadErr   error
}

func NewEnvironmentAccountSource(connector marketplaces.Connector) *EnvironmentAccountSource {
	var expiresAt time.Time
	if raw := strings.TrimSpace(os.Getenv("MELI_TOKEN_EXPIRES_AT")); raw != "" {
		expiresAt, _ = time.Parse(time.RFC3339, raw)
	}
	source := &EnvironmentAccountSource{
		connector: connector,
		account: marketplaces.Account{
			Provider:     "mercadolivre",
			AccountName:  "AZ 3D Studio",
			SellerID:     strings.TrimSpace(os.Getenv("MELI_SELLER_ID")),
			Marketplace:  "MLB",
			AccessToken:  strings.TrimSpace(os.Getenv("MELI_ACCESS_TOKEN")),
			RefreshToken: strings.TrimSpace(os.Getenv("MELI_REFRESH_TOKEN")),
		},
		expiresAt: expiresAt,
		storePath: strings.TrimSpace(os.Getenv("MELI_TOKEN_STORE_PATH")),
		secret:    strings.TrimSpace(os.Getenv("CREDENTIAL_ENCRYPTION_KEY")),
	}
	source.loadPersistedCredentials()
	return source
}

func (s *EnvironmentAccountSource) Account(ctx context.Context) (marketplaces.Account, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.loadErr != nil {
		return marketplaces.Account{}, s.loadErr
	}
	if strings.TrimSpace(s.account.SellerID) == "" {
		return marketplaces.Account{}, ErrMELICredentialsMissing
	}
	if strings.TrimSpace(s.account.AccessToken) == "" {
		return s.refreshLocked(ctx)
	}
	if !s.expiresAt.IsZero() && !s.expiresAt.After(time.Now().Add(10*time.Minute)) {
		return s.refreshLocked(ctx)
	}
	return s.account, nil
}

func (s *EnvironmentAccountSource) Refresh(ctx context.Context) (marketplaces.Account, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.refreshLocked(ctx)
}

func (s *EnvironmentAccountSource) refreshLocked(ctx context.Context) (marketplaces.Account, error) {
	if s.connector == nil || strings.TrimSpace(s.account.RefreshToken) == "" {
		return marketplaces.Account{}, ErrMELICredentialsMissing
	}
	if s.storePath == "" || len(s.secret) < 32 {
		return marketplaces.Account{}, ErrTokenPersistenceMissing
	}
	token, err := s.connector.RefreshAccessToken(ctx, s.account)
	if err != nil {
		return marketplaces.Account{}, err
	}
	if token.AccessToken != "" {
		s.account.AccessToken = token.AccessToken
	}
	if token.RefreshToken != "" {
		s.account.RefreshToken = token.RefreshToken
	}
	if token.SellerID != "" {
		s.account.SellerID = token.SellerID
	}
	s.expiresAt = token.ExpiresAt
	if err := s.persistCredentialsLocked(); err != nil {
		return marketplaces.Account{}, fmt.Errorf("token renovado, mas nao foi possivel persisti-lo com seguranca: %w", err)
	}
	return s.account, nil
}

type persistedMELICredentials struct {
	AccessToken  string    `json:"access_token"`
	RefreshToken string    `json:"refresh_token"`
	SellerID     string    `json:"seller_id"`
	ExpiresAt    time.Time `json:"expires_at"`
}

func (s *EnvironmentAccountSource) loadPersistedCredentials() {
	if s.storePath == "" {
		return
	}
	if len(s.secret) < 32 {
		s.loadErr = ErrTokenPersistenceMissing
		return
	}
	raw, err := os.ReadFile(s.storePath)
	if errors.Is(err, os.ErrNotExist) {
		return
	}
	if err != nil {
		s.loadErr = fmt.Errorf("erro ao ler token store: %w", err)
		return
	}
	decrypted, err := utils.DecryptString(strings.TrimSpace(string(raw)), s.secret)
	if err != nil {
		s.loadErr = errors.New("nao foi possivel descriptografar o token store")
		return
	}
	var persisted persistedMELICredentials
	if err := json.Unmarshal([]byte(decrypted), &persisted); err != nil {
		s.loadErr = errors.New("token store possui formato invalido")
		return
	}
	if persisted.AccessToken != "" {
		s.account.AccessToken = persisted.AccessToken
	}
	if persisted.RefreshToken != "" {
		s.account.RefreshToken = persisted.RefreshToken
	}
	if persisted.SellerID != "" {
		s.account.SellerID = persisted.SellerID
	}
	if !persisted.ExpiresAt.IsZero() {
		s.expiresAt = persisted.ExpiresAt
	}
}

func (s *EnvironmentAccountSource) persistCredentialsLocked() error {
	persisted := persistedMELICredentials{
		AccessToken:  s.account.AccessToken,
		RefreshToken: s.account.RefreshToken,
		SellerID:     s.account.SellerID,
		ExpiresAt:    s.expiresAt,
	}
	raw, err := json.Marshal(persisted)
	if err != nil {
		return err
	}
	encrypted, err := utils.EncryptString(string(raw), s.secret)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(s.storePath), 0o700); err != nil {
		return err
	}
	return os.WriteFile(s.storePath, []byte(encrypted), 0o600)
}
