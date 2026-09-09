package handlers

import (
	"az3d-backend/config"
	"az3d-backend/internal/marketplaces"
	"az3d-backend/internal/marketplaces/amazon"
	"az3d-backend/internal/marketplaces/mercadolivre"
	"az3d-backend/internal/marketplaces/shopee"
)

type MarketplaceHandler struct {
	cfg *config.Config
}

func NewMarketplaceHandler(configs ...*config.Config) *MarketplaceHandler {
	var cfg *config.Config
	if len(configs) > 0 {
		cfg = configs[0]
	}
	return &MarketplaceHandler{cfg: cfg}
}

func marketplaceConnectorRegistry() marketplaces.Registry {
	return marketplaces.NewRegistry(
		shopee.New(),
		mercadolivre.New(),
		amazon.New(),
	)
}
