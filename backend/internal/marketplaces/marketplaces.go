package marketplaces

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"
)

var (
	ErrMissingCredentials = errors.New("credenciais do marketplace incompletas")
	ErrNotConfigured      = errors.New("conector do marketplace nao configurado")
)

type Account struct {
	TenantID     uint
	Provider     string
	AccountName  string
	SellerID     string
	ShopID       string
	Marketplace  string
	AccessToken  string
	RefreshToken string
	AuthCode     string
}

type CatalogItem struct {
	ExternalItemID string
	ExternalSKU    string
	ExternalTitle  string
	ExternalURL    string
	Title          string
	Description    string
	Price          float64
	ImageURL       string
	Material       string
	LayerHeight    string
	PrintTime      string
	Dimensions     string
	Weight         string
	StockQty       int
	Status         string
	ColorImages    []CatalogColorImage
	ColorStocks    []CatalogColorStock
	Variants       []CatalogVariant
	Raw            map[string]any
}

type CatalogColorImage struct {
	ColorName string
	ImageURL  string
	SortOrder int
}

type CatalogColorStock struct {
	ColorName string
	StockQty  int
}

type CatalogVariant struct {
	ColorName   string
	Price       float64
	Material    string
	LayerHeight string
	PrintTime   string
	Weight      string
	IsActive    bool
	SortOrder   int
}

type CatalogSyncResult struct {
	Provider string
	Items    []CatalogItem
	Message  string
}

type OrderSyncInput struct {
	Days int
}

type OrderSyncResult struct {
	Provider string
	Orders   []Order
	Message  string
}

type TokenRequest struct {
	Code        string
	RedirectURI string
}

type TokenResult struct {
	AccessToken  string
	RefreshToken string
	SellerID     string
	ShopID       string
	Marketplace  string
	ExpiresIn    int
	ExpiresAt    time.Time
}

type Order struct {
	ExternalOrderID string
	Status          string
	Currency        string
	GrossAmount     float64
	ItemsAmount     float64
	ShippingCost    float64
	MarketplaceFees float64
	DiscountAmount  float64
	NetAmount       float64
	BuyerNickname   string
	OrderedAt       time.Time
	Items           []OrderItem
	Raw             map[string]any
}

type OrderItem struct {
	ExternalItemID string
	ExternalSKU    string
	Title          string
	Quantity       int
	UnitPrice      float64
	GrossAmount    float64
	FeeAmount      float64
	DiscountAmount float64
	ColorName      string
}

type Connector interface {
	Provider() string
	ExchangeAuthCode(ctx context.Context, account Account, request TokenRequest) (TokenResult, error)
	RefreshAccessToken(ctx context.Context, account Account) (TokenResult, error)
	TestConnection(ctx context.Context, account Account) error
	FetchCatalog(ctx context.Context, account Account) (CatalogSyncResult, error)
	FetchOrders(ctx context.Context, account Account, input OrderSyncInput) (OrderSyncResult, error)
}

type Registry struct {
	connectors map[string]Connector
}

func NewRegistry(connectors ...Connector) Registry {
	registry := Registry{connectors: map[string]Connector{}}
	for _, connector := range connectors {
		if connector == nil {
			continue
		}
		registry.connectors[NormalizeProvider(connector.Provider())] = connector
	}
	return registry
}

func (r Registry) Get(provider string) (Connector, bool) {
	connector, ok := r.connectors[NormalizeProvider(provider)]
	return connector, ok
}

func NormalizeProvider(provider string) string {
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

func HTTPClient() *http.Client {
	return &http.Client{Timeout: 25 * time.Second}
}
