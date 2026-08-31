package mercadolivre

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	mp "az3d-backend/internal/marketplaces"
)

type Connector struct {
	client *http.Client
}

const (
	catalogPageSize            = 50
	orderPageSize              = 50
	financialEnrichmentWorkers = 5
)

// APIError exposes only the HTTP status and operation. Response bodies are
// intentionally omitted because Mercado Livre responses may contain sensitive
// seller or buyer data.
type APIError struct {
	Operation  string
	StatusCode int
}

func (e *APIError) Error() string {
	return fmt.Sprintf("mercado livre %s retornou HTTP %d", e.Operation, e.StatusCode)
}

func IsUnauthorized(err error) bool {
	var apiErr *APIError
	return errors.As(err, &apiErr) && apiErr.StatusCode == http.StatusUnauthorized
}

func (c *Connector) IsUnauthorized(err error) bool {
	return IsUnauthorized(err)
}

func New() *Connector {
	return &Connector{client: mp.HTTPClient()}
}

func (c *Connector) Provider() string {
	return "mercadolivre"
}

func (c *Connector) ExchangeAuthCode(ctx context.Context, account mp.Account, request mp.TokenRequest) (mp.TokenResult, error) {
	clientID, clientSecret := oauthCredentials(account)
	if clientID == "" || clientSecret == "" || strings.TrimSpace(request.Code) == "" || strings.TrimSpace(request.RedirectURI) == "" {
		return mp.TokenResult{}, mp.ErrNotConfigured
	}
	form := url.Values{}
	form.Set("grant_type", "authorization_code")
	form.Set("client_id", clientID)
	form.Set("client_secret", clientSecret)
	form.Set("code", strings.TrimSpace(request.Code))
	form.Set("redirect_uri", strings.TrimSpace(request.RedirectURI))
	if verifier := strings.TrimSpace(request.CodeVerifier); verifier != "" {
		form.Set("code_verifier", verifier)
	}
	return c.postToken(ctx, form)
}

func (c *Connector) RefreshAccessToken(ctx context.Context, account mp.Account) (mp.TokenResult, error) {
	clientID, clientSecret := oauthCredentials(account)
	if clientID == "" || clientSecret == "" || strings.TrimSpace(account.RefreshToken) == "" {
		return mp.TokenResult{}, mp.ErrMissingCredentials
	}
	form := url.Values{}
	form.Set("grant_type", "refresh_token")
	form.Set("client_id", clientID)
	form.Set("client_secret", clientSecret)
	form.Set("refresh_token", strings.TrimSpace(account.RefreshToken))
	return c.postToken(ctx, form)
}

func oauthCredentials(account mp.Account) (string, string) {
	return strings.TrimSpace(account.OAuthClientID), strings.TrimSpace(account.OAuthClientSecret)
}

func (c *Connector) TestConnection(ctx context.Context, account mp.Account) error {
	if strings.TrimSpace(account.AccessToken) == "" {
		return mp.ErrMissingCredentials
	}
	baseURL := strings.TrimRight(os.Getenv("MELI_API_BASE_URL"), "/")
	if baseURL == "" {
		baseURL = "https://api.mercadolibre.com"
	}
	var response struct {
		ID int64 `json:"id"`
	}
	return c.getJSON(ctx, baseURL+"/users/me", account.AccessToken, &response)
}

func (c *Connector) postToken(ctx context.Context, form url.Values) (mp.TokenResult, error) {
	baseURL := strings.TrimRight(os.Getenv("MELI_API_BASE_URL"), "/")
	if baseURL == "" {
		baseURL = "https://api.mercadolibre.com"
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, baseURL+"/oauth/token", strings.NewReader(form.Encode()))
	if err != nil {
		return mp.TokenResult{}, err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	res, err := c.client.Do(req)
	if err != nil {
		return mp.TokenResult{}, err
	}
	defer res.Body.Close()
	if res.StatusCode >= 300 {
		return mp.TokenResult{}, &APIError{Operation: "oauth/token", StatusCode: res.StatusCode}
	}
	var response mercadoTokenResponse
	if err := json.NewDecoder(res.Body).Decode(&response); err != nil {
		return mp.TokenResult{}, err
	}
	return mp.TokenResult{
		AccessToken:  response.AccessToken,
		RefreshToken: response.RefreshToken,
		SellerID:     strconv.FormatInt(response.UserID, 10),
		ExpiresIn:    response.ExpiresIn,
		ExpiresAt:    time.Now().Add(time.Duration(response.ExpiresIn) * time.Second),
	}, nil
}

func (c *Connector) FetchCatalog(ctx context.Context, account mp.Account) (mp.CatalogSyncResult, error) {
	if strings.TrimSpace(account.AccessToken) == "" || strings.TrimSpace(account.SellerID) == "" {
		return mp.CatalogSyncResult{Provider: c.Provider()}, mp.ErrMissingCredentials
	}

	baseURL := strings.TrimRight(os.Getenv("MELI_API_BASE_URL"), "/")
	if baseURL == "" {
		baseURL = "https://api.mercadolibre.com"
	}

	itemIDs, err := c.fetchItemIDs(ctx, baseURL, account)
	if err != nil {
		return mp.CatalogSyncResult{Provider: c.Provider()}, err
	}
	items, err := c.fetchItems(ctx, baseURL, account.AccessToken, itemIDs)
	if err != nil {
		return mp.CatalogSyncResult{Provider: c.Provider()}, err
	}

	return mp.CatalogSyncResult{
		Provider: c.Provider(),
		Items:    items,
		Message:  fmt.Sprintf("%d anuncio(s) encontrados no Mercado Livre", len(items)),
	}, nil
}

func (c *Connector) FetchOrders(ctx context.Context, account mp.Account, input mp.OrderSyncInput) (mp.OrderSyncResult, error) {
	if strings.TrimSpace(account.AccessToken) == "" || strings.TrimSpace(account.SellerID) == "" {
		return mp.OrderSyncResult{Provider: c.Provider()}, mp.ErrMissingCredentials
	}
	if input.Days <= 0 {
		input.Days = 7
	}

	baseURL := strings.TrimRight(os.Getenv("MELI_API_BASE_URL"), "/")
	if baseURL == "" {
		baseURL = "https://api.mercadolibre.com"
	}

	rawOrders := make([]mercadoOrder, 0, orderPageSize)
	for offset := 0; ; {
		endpoint, _ := url.Parse(baseURL + "/orders/search")
		query := endpoint.Query()
		query.Set("seller", account.SellerID)
		query.Set("order.status", "paid")
		query.Set("sort", "date_desc")
		query.Set("limit", strconv.Itoa(orderPageSize))
		query.Set("offset", strconv.Itoa(offset))
		query.Set("order.date_closed.from", time.Now().AddDate(0, 0, -input.Days).Format(time.RFC3339))
		endpoint.RawQuery = query.Encode()

		var response mercadoOrdersSearchResponse
		if err := c.getJSON(ctx, endpoint.String(), account.AccessToken, &response); err != nil {
			return mp.OrderSyncResult{Provider: c.Provider()}, err
		}
		rawOrders = append(rawOrders, response.Results...)
		offset += len(response.Results)
		if len(response.Results) == 0 {
			break
		}
		if response.Paging.Total > 0 {
			if offset >= response.Paging.Total {
				break
			}
			continue
		}
		if len(response.Results) < orderPageSize {
			break
		}
	}

	incomplete, err := c.enrichOrderFinancials(ctx, baseURL, account, rawOrders)
	if err != nil {
		return mp.OrderSyncResult{Provider: c.Provider()}, err
	}

	orders := make([]mp.Order, 0, len(rawOrders))
	for _, order := range rawOrders {
		orders = append(orders, normalizeOrder(order))
	}
	message := fmt.Sprintf("%d pedido(s) encontrados no Mercado Livre", len(orders))
	if incomplete > 0 {
		message += fmt.Sprintf("; detalhes financeiros incompletos em %d pedido(s)", incomplete)
	}
	return mp.OrderSyncResult{
		Provider: c.Provider(),
		Orders:   orders,
		Message:  message,
	}, nil
}

func (c *Connector) enrichOrderFinancials(ctx context.Context, baseURL string, account mp.Account, orders []mercadoOrder) (int, error) {
	if len(orders) == 0 {
		return 0, nil
	}
	workerCount := financialEnrichmentWorkers
	if workerCount > len(orders) {
		workerCount = len(orders)
	}

	workCtx, cancel := context.WithCancel(ctx)
	defer cancel()
	jobs := make(chan int)
	errorsFound := make(chan error, 1)
	var wg sync.WaitGroup
	for range workerCount {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for index := range jobs {
				if err := c.enrichOrderFinancialsOne(workCtx, baseURL, account, &orders[index]); err != nil {
					select {
					case errorsFound <- err:
						cancel()
					default:
					}
					return
				}
			}
		}()
	}

sendJobs:
	for index := range orders {
		select {
		case jobs <- index:
		case <-workCtx.Done():
			break sendJobs
		}
	}
	close(jobs)
	wg.Wait()
	select {
	case err := <-errorsFound:
		return 0, err
	default:
	}

	incomplete := 0
	for _, order := range orders {
		if !order.FinancialComplete {
			incomplete++
		}
	}
	return incomplete, nil
}

func (c *Connector) enrichOrderFinancialsOne(ctx context.Context, baseURL string, account mp.Account, order *mercadoOrder) error {
	order.FinancialComplete = true
	order.SellerDiscountAmount = embeddedSellerDiscount(*order)

	if order.ID != 0 {
		var response mercadoDiscountsResponse
		endpoint := fmt.Sprintf("%s/orders/%d/discounts", baseURL, order.ID)
		if err := c.getJSON(ctx, endpoint, account.AccessToken, &response); err != nil {
			if !isOptionalFinancialDetailUnavailable(err) {
				return err
			}
			order.FinancialComplete = false
			order.FinancialNotes = append(order.FinancialNotes, "detalhes de descontos indisponiveis")
		} else {
			order.SellerDiscountAmount = response.sellerAmount()
		}
	}

	if order.Shipping.ID != 0 {
		var response mercadoShipmentCostsResponse
		endpoint := fmt.Sprintf("%s/shipments/%d/costs", baseURL, order.Shipping.ID)
		headers := map[string]string{"x-format-new": "true"}
		if err := c.getJSONWithHeaders(ctx, endpoint, account.AccessToken, headers, &response); err != nil {
			if !isOptionalFinancialDetailUnavailable(err) {
				return err
			}
			order.FinancialComplete = false
			order.FinancialNotes = append(order.FinancialNotes, "custo de envio do vendedor indisponivel")
		} else {
			order.SellerShippingCost = response.sellerCost(account.SellerID)
		}
	}
	return nil
}

func isOptionalFinancialDetailUnavailable(err error) bool {
	var apiErr *APIError
	return errors.As(err, &apiErr) && (apiErr.StatusCode == http.StatusForbidden || apiErr.StatusCode == http.StatusNotFound)
}

func (c *Connector) fetchItemIDs(ctx context.Context, baseURL string, account mp.Account) ([]string, error) {
	itemIDs := make([]string, 0, catalogPageSize)
	seen := make(map[string]struct{})
	for offset := 0; ; {
		endpoint, _ := url.Parse(baseURL + "/users/" + url.PathEscape(account.SellerID) + "/items/search")
		query := endpoint.Query()
		query.Set("limit", strconv.Itoa(catalogPageSize))
		query.Set("offset", strconv.Itoa(offset))
		endpoint.RawQuery = query.Encode()

		var response struct {
			Paging struct {
				Total int `json:"total"`
			} `json:"paging"`
			Results []string `json:"results"`
		}
		if err := c.getJSON(ctx, endpoint.String(), account.AccessToken, &response); err != nil {
			return nil, err
		}

		for _, itemID := range response.Results {
			itemID = strings.TrimSpace(itemID)
			if itemID == "" {
				continue
			}
			if _, exists := seen[itemID]; exists {
				continue
			}
			seen[itemID] = struct{}{}
			itemIDs = append(itemIDs, itemID)
		}

		pageCount := len(response.Results)
		offset += pageCount
		if pageCount == 0 || (response.Paging.Total > 0 && offset >= response.Paging.Total) {
			break
		}
		if response.Paging.Total == 0 && pageCount < catalogPageSize {
			break
		}
	}
	return itemIDs, nil
}

func (c *Connector) fetchItems(ctx context.Context, baseURL string, token string, itemIDs []string) ([]mp.CatalogItem, error) {
	items := []mp.CatalogItem{}
	for start := 0; start < len(itemIDs); start += 20 {
		end := start + 20
		if end > len(itemIDs) {
			end = len(itemIDs)
		}

		endpoint, _ := url.Parse(baseURL + "/items")
		query := endpoint.Query()
		query.Set("ids", strings.Join(itemIDs[start:end], ","))
		query.Set("attributes", "id,title,price,available_quantity,thumbnail,pictures,permalink,seller_custom_field,attributes,status")
		endpoint.RawQuery = query.Encode()

		var response []struct {
			Code int         `json:"code"`
			Body mercadoItem `json:"body"`
		}
		if err := c.getJSON(ctx, endpoint.String(), token, &response); err != nil {
			return nil, err
		}
		for _, entry := range response {
			if entry.Code >= 300 || entry.Body.ID == "" {
				continue
			}
			items = append(items, normalizeItem(entry.Body))
		}
	}
	return items, nil
}

func (c *Connector) getJSON(ctx context.Context, endpoint string, token string, out any) error {
	return c.getJSONWithHeaders(ctx, endpoint, token, nil, out)
}

func (c *Connector) getJSONWithHeaders(ctx context.Context, endpoint string, token string, headers map[string]string, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/json")
	for name, value := range headers {
		req.Header.Set(name, value)
	}

	res, err := c.client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode >= 300 {
		operation := "API"
		if parsed, parseErr := url.Parse(endpoint); parseErr == nil && parsed.Path != "" {
			operation = parsed.Path
		}
		return &APIError{Operation: operation, StatusCode: res.StatusCode}
	}
	if res.StatusCode == http.StatusNoContent {
		return nil
	}
	return json.NewDecoder(res.Body).Decode(out)
}

type mercadoItem struct {
	ID                string             `json:"id"`
	Title             string             `json:"title"`
	Price             float64            `json:"price"`
	AvailableQuantity int                `json:"available_quantity"`
	Thumbnail         string             `json:"thumbnail"`
	Pictures          []mercadoPicture   `json:"pictures"`
	Permalink         string             `json:"permalink"`
	SellerCustomField string             `json:"seller_custom_field"`
	Attributes        []mercadoAttribute `json:"attributes"`
	Status            string             `json:"status"`
}

type mercadoPicture struct {
	URL       string `json:"url"`
	SecureURL string `json:"secure_url"`
}

type mercadoAttribute struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	ValueName string `json:"value_name"`
}

type mercadoTokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"`
	UserID       int64  `json:"user_id"`
}

type mercadoOrdersSearchResponse struct {
	Results []mercadoOrder `json:"results"`
	Paging  mercadoPaging  `json:"paging"`
}

type mercadoPaging struct {
	Total  int `json:"total"`
	Offset int `json:"offset"`
	Limit  int `json:"limit"`
}

type mercadoOrder struct {
	ID                   int64              `json:"id"`
	Status               string             `json:"status"`
	DateCreated          string             `json:"date_created"`
	DateClosed           string             `json:"date_closed"`
	TotalAmount          float64            `json:"total_amount"`
	PaidAmount           float64            `json:"paid_amount"`
	CurrencyID           string             `json:"currency_id"`
	Coupon               mercadoCoupon      `json:"coupon"`
	Buyer                mercadoBuyer       `json:"buyer"`
	OrderItems           []mercadoOrderItem `json:"order_items"`
	Payments             []mercadoPayment   `json:"payments"`
	Shipping             mercadoShipping    `json:"shipping"`
	SellerShippingCost   float64            `json:"-"`
	SellerDiscountAmount float64            `json:"-"`
	FinancialComplete    bool               `json:"-"`
	FinancialNotes       []string           `json:"-"`
}

type mercadoCoupon struct {
	Amount float64 `json:"amount"`
}

type mercadoBuyer struct {
	Nickname string `json:"nickname"`
}

type mercadoShipping struct {
	ID int64 `json:"id"`
}

type mercadoPayment struct {
	MarketplaceFee float64 `json:"marketplace_fee"`
	CouponAmount   float64 `json:"coupon_amount"`
	ShippingCost   float64 `json:"shipping_cost"`
}

type mercadoOrderItem struct {
	Item          mercadoOrderItemProduct `json:"item"`
	Quantity      int                     `json:"quantity"`
	UnitPrice     float64                 `json:"unit_price"`
	SaleFee       float64                 `json:"sale_fee"`
	FullUnitPrice float64                 `json:"full_unit_price"`
	Discounts     []mercadoOrderDiscount  `json:"discounts"`
}

type mercadoOrderDiscount struct {
	Amounts struct {
		Seller float64 `json:"seller"`
	} `json:"amounts"`
}

type mercadoDiscountsResponse struct {
	Details []struct {
		Items []struct {
			Amounts struct {
				Seller float64 `json:"seller"`
			} `json:"amounts"`
		} `json:"items"`
	} `json:"details"`
}

func (r mercadoDiscountsResponse) sellerAmount() float64 {
	total := 0.0
	for _, detail := range r.Details {
		for _, item := range detail.Items {
			total += item.Amounts.Seller
		}
	}
	return total
}

type mercadoShipmentCostsResponse struct {
	Senders []struct {
		UserID int64   `json:"user_id"`
		Cost   float64 `json:"cost"`
	} `json:"senders"`
}

func (r mercadoShipmentCostsResponse) sellerCost(sellerID string) float64 {
	wanted, _ := strconv.ParseInt(strings.TrimSpace(sellerID), 10, 64)
	total := 0.0
	for _, sender := range r.Senders {
		if wanted == 0 || sender.UserID == wanted {
			total += sender.Cost
		}
	}
	return total
}

func embeddedSellerDiscount(order mercadoOrder) float64 {
	total := 0.0
	for _, item := range order.OrderItems {
		for _, discount := range item.Discounts {
			total += discount.Amounts.Seller * float64(maxInt(item.Quantity, 1))
		}
	}
	return total
}

type mercadoOrderItemProduct struct {
	ID                string `json:"id"`
	Title             string `json:"title"`
	SellerCustomField string `json:"seller_custom_field"`
}

func normalizeItem(item mercadoItem) mp.CatalogItem {
	imageURL := item.Thumbnail
	if len(item.Pictures) > 0 {
		imageURL = item.Pictures[0].SecureURL
		if imageURL == "" {
			imageURL = item.Pictures[0].URL
		}
	}
	sku := strings.TrimSpace(item.SellerCustomField)
	material := ""
	for _, attr := range item.Attributes {
		switch strings.ToUpper(attr.ID) {
		case "SELLER_SKU":
			if sku == "" {
				sku = strings.TrimSpace(attr.ValueName)
			}
		case "MATERIAL":
			material = attr.ValueName
		}
	}
	status := "active"
	if item.Status != "active" {
		status = "paused"
	}

	return mp.CatalogItem{
		ExternalItemID: item.ID,
		ExternalSKU:    sku,
		ExternalTitle:  item.Title,
		ExternalURL:    item.Permalink,
		Title:          item.Title,
		Description:    item.Title,
		Price:          item.Price,
		ImageURL:       imageURL,
		Material:       material,
		StockQty:       maxInt(item.AvailableQuantity, 0),
		Status:         status,
		ColorImages:    []mp.CatalogColorImage{{ColorName: "Padrao", ImageURL: imageURL, SortOrder: 0}},
		ColorStocks:    []mp.CatalogColorStock{{ColorName: "Padrao", StockQty: maxInt(item.AvailableQuantity, 0)}},
		Raw: map[string]any{
			"available_quantity": strconv.Itoa(item.AvailableQuantity),
		},
	}
}

func normalizeOrder(order mercadoOrder) mp.Order {
	orderedAt := parseMercadoTime(order.DateClosed)
	if orderedAt.IsZero() {
		orderedAt = parseMercadoTime(order.DateCreated)
	}
	if orderedAt.IsZero() {
		orderedAt = time.Now()
	}

	paymentMarketplaceFees := 0.0
	for _, payment := range order.Payments {
		paymentMarketplaceFees += payment.MarketplaceFee
	}

	items := make([]mp.OrderItem, 0, len(order.OrderItems))
	itemsAmount := 0.0
	itemSaleFees := 0.0
	for _, item := range order.OrderItems {
		quantity := item.Quantity
		if quantity <= 0 {
			quantity = 1
		}
		unitPrice := item.UnitPrice
		if unitPrice <= 0 {
			unitPrice = item.FullUnitPrice
		}
		gross := unitPrice * float64(quantity)
		fee := item.SaleFee * float64(quantity)
		itemsAmount += gross
		itemSaleFees += fee
		items = append(items, mp.OrderItem{
			ExternalItemID: item.Item.ID,
			ExternalSKU:    strings.TrimSpace(item.Item.SellerCustomField),
			Title:          item.Item.Title,
			Quantity:       quantity,
			UnitPrice:      unitPrice,
			GrossAmount:    gross,
			FeeAmount:      fee,
		})
	}

	marketplaceFees := paymentMarketplaceFees
	if marketplaceFees <= 0 {
		marketplaceFees = itemSaleFees
	}
	grossAmount := itemsAmount
	if grossAmount <= 0 {
		grossAmount = order.TotalAmount
	}
	if grossAmount <= 0 {
		grossAmount = order.PaidAmount
	}

	return mp.Order{
		ExternalOrderID:   strconv.FormatInt(order.ID, 10),
		Status:            normalizeOrderStatus(order.Status),
		Currency:          defaultCurrency(order.CurrencyID),
		GrossAmount:       grossAmount,
		ItemsAmount:       itemsAmount,
		ShippingCost:      order.SellerShippingCost,
		MarketplaceFees:   marketplaceFees,
		DiscountAmount:    order.SellerDiscountAmount,
		NetAmount:         grossAmount - marketplaceFees - order.SellerShippingCost,
		FinancialComplete: order.FinancialComplete,
		FinancialNotes:    append([]string(nil), order.FinancialNotes...),
		BuyerNickname:     order.Buyer.Nickname,
		OrderedAt:         orderedAt,
		Items:             items,
	}
}

func parseMercadoTime(value string) time.Time {
	if value == "" {
		return time.Time{}
	}
	parsed, err := time.Parse(time.RFC3339, value)
	if err == nil {
		return parsed
	}
	return time.Time{}
}

func normalizeOrderStatus(status string) string {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "paid":
		return "paid"
	case "cancelled", "canceled":
		return "cancelled"
	default:
		return strings.ToLower(strings.TrimSpace(status))
	}
}

func defaultCurrency(currency string) string {
	if strings.TrimSpace(currency) == "" {
		return "BRL"
	}
	return currency
}

func maxInt(value int, min int) int {
	if value < min {
		return min
	}
	return value
}
