package mcpserver

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"az3d-backend/internal/marketplaces"
	"az3d-backend/internal/marketplaces/mercadolivre"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

const Version = "0.1.0"

type Service struct {
	connector marketplaces.Connector
	accounts  AccountSource
}

func New(connector marketplaces.Connector, accounts AccountSource) *Service {
	return &Service{connector: connector, accounts: accounts}
}

func (s *Service) MCPServer() *mcp.Server {
	server := mcp.NewServer(
		&mcp.Implementation{Name: "az3d-seller", Version: Version},
		&mcp.ServerOptions{
			Instructions: "Ferramentas somente leitura da conta vendedora AZ 3D Studio. Nunca solicite ou revele tokens. Pedidos retornam apenas dados operacionais, sem dados pessoais do comprador.",
			Capabilities: &mcp.ServerCapabilities{},
		},
	)

	mcp.AddTool(server, readOnlyTool(
		"meli_connection_status",
		"Verifica se a conta vendedora configurada consegue acessar a API oficial do Mercado Livre.",
	), s.connectionStatus)
	mcp.AddTool(server, readOnlyTool(
		"meli_list_items",
		"Lista anuncios ativos da conta vendedora, com ID, SKU, titulo, preco, estoque e URL. Retorna no maximo 50 itens.",
	), s.listItems)
	mcp.AddTool(server, readOnlyTool(
		"meli_list_orders",
		"Lista pedidos pagos recentes sem nome, endereco, documento ou outros dados pessoais do comprador.",
	), s.listOrders)
	mcp.AddTool(server, readOnlyTool(
		"meli_sales_summary",
		"Resume pedidos pagos por periodo, incluindo faturamento, taxas, frete, descontos e unidades vendidas.",
	), s.salesSummary)

	return server
}

func readOnlyTool(name, description string) *mcp.Tool {
	openWorld := true
	return &mcp.Tool{
		Name:        name,
		Description: description,
		Annotations: &mcp.ToolAnnotations{
			Title:         name,
			ReadOnlyHint:  true,
			OpenWorldHint: &openWorld,
		},
	}
}

type EmptyInput struct{}

type ConnectionStatusOutput struct {
	Connected bool   `json:"connected" jsonschema:"whether the configured seller account is reachable"`
	Provider  string `json:"provider" jsonschema:"marketplace provider"`
	SellerID  string `json:"seller_id" jsonschema:"configured seller identifier"`
	Message   string `json:"message" jsonschema:"human-readable connection status"`
}

func (s *Service) connectionStatus(ctx context.Context, _ *mcp.CallToolRequest, _ EmptyInput) (*mcp.CallToolResult, ConnectionStatusOutput, error) {
	account, err := s.account(ctx)
	if err != nil {
		return nil, ConnectionStatusOutput{}, err
	}
	err = s.connector.TestConnection(ctx, account)
	if err != nil && mercadolivre.IsUnauthorized(err) {
		if account, err = s.refresh(ctx); err == nil {
			err = s.connector.TestConnection(ctx, account)
		}
	}
	if err != nil {
		return nil, ConnectionStatusOutput{}, err
	}
	return nil, ConnectionStatusOutput{
		Connected: true,
		Provider:  s.connector.Provider(),
		SellerID:  account.SellerID,
		Message:   "Conexao com a API oficial do Mercado Livre validada.",
	}, nil
}

type ListItemsInput struct {
	Limit int `json:"limit,omitempty" jsonschema:"maximum number of active listings to return, from 1 to 50"`
}

type ItemSummary struct {
	ItemID   string  `json:"item_id"`
	SKU      string  `json:"sku,omitempty"`
	Title    string  `json:"title"`
	Price    float64 `json:"price"`
	StockQty int     `json:"stock_qty"`
	Status   string  `json:"status"`
	URL      string  `json:"url,omitempty"`
	ImageURL string  `json:"image_url,omitempty"`
}

type ListItemsOutput struct {
	Count   int           `json:"count"`
	Items   []ItemSummary `json:"items"`
	Message string        `json:"message"`
}

func (s *Service) listItems(ctx context.Context, _ *mcp.CallToolRequest, input ListItemsInput) (*mcp.CallToolResult, ListItemsOutput, error) {
	limit, err := normalizedLimit(input.Limit, 25, 50)
	if err != nil {
		return nil, ListItemsOutput{}, err
	}
	account, err := s.account(ctx)
	if err != nil {
		return nil, ListItemsOutput{}, err
	}
	catalog, err := s.connector.FetchCatalog(ctx, account)
	if err != nil && mercadolivre.IsUnauthorized(err) {
		if account, err = s.refresh(ctx); err == nil {
			catalog, err = s.connector.FetchCatalog(ctx, account)
		}
	}
	if err != nil {
		return nil, ListItemsOutput{}, err
	}

	items := make([]ItemSummary, 0, minInt(limit, len(catalog.Items)))
	for _, item := range catalog.Items {
		if len(items) == limit {
			break
		}
		items = append(items, ItemSummary{
			ItemID:   item.ExternalItemID,
			SKU:      item.ExternalSKU,
			Title:    item.Title,
			Price:    item.Price,
			StockQty: item.StockQty,
			Status:   item.Status,
			URL:      item.ExternalURL,
			ImageURL: item.ImageURL,
		})
	}
	return nil, ListItemsOutput{Count: len(items), Items: items, Message: catalog.Message}, nil
}

type ListOrdersInput struct {
	Days  int `json:"days,omitempty" jsonschema:"number of recent days to query, from 1 to 90"`
	Limit int `json:"limit,omitempty" jsonschema:"maximum number of paid orders to return, from 1 to 50"`
}

type OrderItemSummary struct {
	ItemID    string  `json:"item_id"`
	SKU       string  `json:"sku,omitempty"`
	Title     string  `json:"title"`
	Quantity  int     `json:"quantity"`
	UnitPrice float64 `json:"unit_price"`
}

type OrderSummary struct {
	OrderID        string             `json:"order_id"`
	Status         string             `json:"status"`
	Currency       string             `json:"currency"`
	GrossAmount    float64            `json:"gross_amount"`
	NetAmount      float64            `json:"net_amount"`
	MarketplaceFee float64            `json:"marketplace_fee"`
	ShippingCost   float64            `json:"shipping_cost"`
	DiscountAmount float64            `json:"discount_amount"`
	OrderedAt      time.Time          `json:"ordered_at"`
	Items          []OrderItemSummary `json:"items"`
}

type ListOrdersOutput struct {
	Count   int            `json:"count"`
	Orders  []OrderSummary `json:"orders"`
	Message string         `json:"message"`
}

func (s *Service) listOrders(ctx context.Context, _ *mcp.CallToolRequest, input ListOrdersInput) (*mcp.CallToolResult, ListOrdersOutput, error) {
	days, limit, err := normalizedOrderInput(input)
	if err != nil {
		return nil, ListOrdersOutput{}, err
	}
	orders, message, err := s.fetchOrders(ctx, days)
	if err != nil {
		return nil, ListOrdersOutput{}, err
	}
	result := make([]OrderSummary, 0, minInt(limit, len(orders)))
	for _, order := range orders {
		if len(result) == limit {
			break
		}
		items := make([]OrderItemSummary, 0, len(order.Items))
		for _, item := range order.Items {
			items = append(items, OrderItemSummary{
				ItemID: item.ExternalItemID, SKU: item.ExternalSKU, Title: item.Title,
				Quantity: item.Quantity, UnitPrice: item.UnitPrice,
			})
		}
		result = append(result, OrderSummary{
			OrderID: order.ExternalOrderID, Status: order.Status, Currency: order.Currency,
			GrossAmount: order.GrossAmount, NetAmount: order.NetAmount,
			MarketplaceFee: order.MarketplaceFees, ShippingCost: order.ShippingCost,
			DiscountAmount: order.DiscountAmount, OrderedAt: order.OrderedAt, Items: items,
		})
	}
	return nil, ListOrdersOutput{Count: len(result), Orders: result, Message: message}, nil
}

type SalesSummaryInput struct {
	Days int `json:"days,omitempty" jsonschema:"number of recent days to summarize, from 1 to 90"`
}

type ProductSalesSummary struct {
	ItemID   string `json:"item_id"`
	SKU      string `json:"sku,omitempty"`
	Title    string `json:"title"`
	Quantity int    `json:"quantity"`
}

type SalesSummaryOutput struct {
	Days            int                   `json:"days"`
	OrderCount      int                   `json:"order_count"`
	UnitsSold       int                   `json:"units_sold"`
	Currency        string                `json:"currency"`
	GrossAmount     float64               `json:"gross_amount"`
	NetAmount       float64               `json:"net_amount"`
	MarketplaceFees float64               `json:"marketplace_fees"`
	ShippingCost    float64               `json:"shipping_cost"`
	DiscountAmount  float64               `json:"discount_amount"`
	Products        []ProductSalesSummary `json:"products"`
}

func (s *Service) salesSummary(ctx context.Context, _ *mcp.CallToolRequest, input SalesSummaryInput) (*mcp.CallToolResult, SalesSummaryOutput, error) {
	days := input.Days
	if days == 0 {
		days = 7
	}
	if days < 1 || days > 90 {
		return nil, SalesSummaryOutput{}, errors.New("days deve estar entre 1 e 90")
	}
	orders, _, err := s.fetchOrders(ctx, days)
	if err != nil {
		return nil, SalesSummaryOutput{}, err
	}

	output := SalesSummaryOutput{Days: days, OrderCount: len(orders), Currency: "BRL"}
	type productKey struct{ itemID, sku, title string }
	quantities := map[productKey]int{}
	for _, order := range orders {
		if order.Currency != "" {
			output.Currency = order.Currency
		}
		output.GrossAmount += order.GrossAmount
		output.NetAmount += order.NetAmount
		output.MarketplaceFees += order.MarketplaceFees
		output.ShippingCost += order.ShippingCost
		output.DiscountAmount += order.DiscountAmount
		for _, item := range order.Items {
			output.UnitsSold += item.Quantity
			quantities[productKey{item.ExternalItemID, item.ExternalSKU, item.Title}] += item.Quantity
		}
	}
	for key, quantity := range quantities {
		output.Products = append(output.Products, ProductSalesSummary{
			ItemID: key.itemID, SKU: key.sku, Title: key.title, Quantity: quantity,
		})
	}
	sort.Slice(output.Products, func(i, j int) bool {
		if output.Products[i].Quantity == output.Products[j].Quantity {
			return strings.Compare(output.Products[i].Title, output.Products[j].Title) < 0
		}
		return output.Products[i].Quantity > output.Products[j].Quantity
	})
	return nil, output, nil
}

func (s *Service) fetchOrders(ctx context.Context, days int) ([]marketplaces.Order, string, error) {
	account, err := s.account(ctx)
	if err != nil {
		return nil, "", err
	}
	result, err := s.connector.FetchOrders(ctx, account, marketplaces.OrderSyncInput{Days: days})
	if err != nil && mercadolivre.IsUnauthorized(err) {
		if account, err = s.refresh(ctx); err == nil {
			result, err = s.connector.FetchOrders(ctx, account, marketplaces.OrderSyncInput{Days: days})
		}
	}
	return result.Orders, result.Message, err
}

func (s *Service) account(ctx context.Context) (marketplaces.Account, error) {
	if s.connector == nil || s.accounts == nil {
		return marketplaces.Account{}, errors.New("servidor MCP sem conector ou fonte de credenciais")
	}
	return s.accounts.Account(ctx)
}

func (s *Service) refresh(ctx context.Context) (marketplaces.Account, error) {
	refresher, ok := s.accounts.(RefreshingAccountSource)
	if !ok {
		return marketplaces.Account{}, errors.New("access token expirado e refresh nao configurado")
	}
	return refresher.Refresh(ctx)
}

func normalizedOrderInput(input ListOrdersInput) (int, int, error) {
	days := input.Days
	if days == 0 {
		days = 7
	}
	if days < 1 || days > 90 {
		return 0, 0, errors.New("days deve estar entre 1 e 90")
	}
	limit, err := normalizedLimit(input.Limit, 25, 50)
	return days, limit, err
}

func normalizedLimit(value, fallback, maximum int) (int, error) {
	if value == 0 {
		return fallback, nil
	}
	if value < 1 || value > maximum {
		return 0, fmt.Errorf("limit deve estar entre 1 e %d", maximum)
	}
	return value, nil
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}
