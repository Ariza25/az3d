package amazon

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"

	mp "az3d-backend/internal/marketplaces"
)

type Connector struct {
	client *http.Client
}

func New() *Connector {
	return &Connector{client: mp.HTTPClient()}
}

func (c *Connector) Provider() string {
	return "amazon"
}

func (c *Connector) ExchangeAuthCode(ctx context.Context, account mp.Account, request mp.TokenRequest) (mp.TokenResult, error) {
	clientID := strings.TrimSpace(os.Getenv("AMAZON_LWA_CLIENT_ID"))
	clientSecret := strings.TrimSpace(os.Getenv("AMAZON_LWA_CLIENT_SECRET"))
	if clientID == "" {
		clientID = strings.TrimSpace(os.Getenv("AMAZON_APP_ID"))
	}
	if clientID == "" || clientSecret == "" || strings.TrimSpace(request.Code) == "" || strings.TrimSpace(request.RedirectURI) == "" {
		return mp.TokenResult{}, mp.ErrNotConfigured
	}
	form := url.Values{}
	form.Set("grant_type", "authorization_code")
	form.Set("code", strings.TrimSpace(request.Code))
	form.Set("redirect_uri", strings.TrimSpace(request.RedirectURI))
	form.Set("client_id", clientID)
	form.Set("client_secret", clientSecret)
	return c.postLWA(ctx, form, account)
}

func (c *Connector) RefreshAccessToken(ctx context.Context, account mp.Account) (mp.TokenResult, error) {
	clientID := strings.TrimSpace(os.Getenv("AMAZON_LWA_CLIENT_ID"))
	clientSecret := strings.TrimSpace(os.Getenv("AMAZON_LWA_CLIENT_SECRET"))
	if clientID == "" {
		clientID = strings.TrimSpace(os.Getenv("AMAZON_APP_ID"))
	}
	if clientID == "" || clientSecret == "" || strings.TrimSpace(account.RefreshToken) == "" {
		return mp.TokenResult{}, mp.ErrMissingCredentials
	}
	form := url.Values{}
	form.Set("grant_type", "refresh_token")
	form.Set("refresh_token", strings.TrimSpace(account.RefreshToken))
	form.Set("client_id", clientID)
	form.Set("client_secret", clientSecret)
	return c.postLWA(ctx, form, account)
}

func (c *Connector) TestConnection(ctx context.Context, account mp.Account) error {
	if strings.TrimSpace(account.AccessToken) == "" {
		return mp.ErrMissingCredentials
	}
	baseURL := strings.TrimRight(os.Getenv("AMAZON_SP_API_BASE_URL"), "/")
	if baseURL == "" {
		baseURL = "https://sellingpartnerapi-na.amazon.com"
	}
	var response map[string]any
	return c.getSignedJSON(ctx, baseURL+"/sellers/v1/marketplaceParticipations", account.AccessToken, &response)
}

func (c *Connector) postLWA(ctx context.Context, form url.Values, account mp.Account) (mp.TokenResult, error) {
	endpoint := strings.TrimSpace(os.Getenv("AMAZON_LWA_TOKEN_URL"))
	if endpoint == "" {
		endpoint = "https://api.amazon.com/auth/o2/token"
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, strings.NewReader(form.Encode()))
	if err != nil {
		return mp.TokenResult{}, err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded;charset=UTF-8")
	res, err := c.client.Do(req)
	if err != nil {
		return mp.TokenResult{}, err
	}
	defer res.Body.Close()
	if res.StatusCode >= 300 {
		return mp.TokenResult{}, fmt.Errorf("amazon LWA token HTTP %d", res.StatusCode)
	}
	var response amazonTokenResponse
	if err := json.NewDecoder(res.Body).Decode(&response); err != nil {
		return mp.TokenResult{}, err
	}
	refreshToken := response.RefreshToken
	if refreshToken == "" {
		refreshToken = account.RefreshToken
	}
	return mp.TokenResult{
		AccessToken:  response.AccessToken,
		RefreshToken: refreshToken,
		SellerID:     account.SellerID,
		Marketplace:  account.Marketplace,
		ExpiresIn:    response.ExpiresIn,
		ExpiresAt:    time.Now().Add(time.Duration(response.ExpiresIn) * time.Second),
	}, nil
}

func (c *Connector) FetchCatalog(ctx context.Context, account mp.Account) (mp.CatalogSyncResult, error) {
	if strings.TrimSpace(account.AccessToken) == "" || strings.TrimSpace(account.SellerID) == "" || strings.TrimSpace(account.Marketplace) == "" {
		return mp.CatalogSyncResult{Provider: c.Provider()}, mp.ErrMissingCredentials
	}

	baseURL := strings.TrimRight(os.Getenv("AMAZON_SP_API_BASE_URL"), "/")
	if baseURL == "" {
		baseURL = "https://sellingpartnerapi-na.amazon.com"
	}

	endpoint, _ := url.Parse(baseURL + "/listings/2021-08-01/items/" + url.PathEscape(account.SellerID))
	query := endpoint.Query()
	query.Set("marketplaceIds", account.Marketplace)
	query.Set("includedData", "summaries,attributes,offers,fulfillmentAvailability")
	query.Set("pageSize", "20")
	endpoint.RawQuery = query.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint.String(), nil)
	if err != nil {
		return mp.CatalogSyncResult{Provider: c.Provider()}, err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("x-amz-access-token", account.AccessToken)
	applyAmazonSigV4(req)

	res, err := c.client.Do(req)
	if err != nil {
		return mp.CatalogSyncResult{Provider: c.Provider()}, err
	}
	defer res.Body.Close()
	if res.StatusCode >= 300 {
		return mp.CatalogSyncResult{Provider: c.Provider()}, fmt.Errorf("amazon SP-API retornou HTTP %d; confirme assinatura SigV4 e roles da app", res.StatusCode)
	}

	var response amazonListingsResponse
	if err := json.NewDecoder(res.Body).Decode(&response); err != nil {
		return mp.CatalogSyncResult{Provider: c.Provider()}, err
	}
	items := make([]mp.CatalogItem, 0, len(response.Items))
	for _, item := range response.Items {
		items = append(items, normalizeItem(item))
	}

	return mp.CatalogSyncResult{
		Provider: c.Provider(),
		Items:    items,
		Message:  fmt.Sprintf("%d listing(s) encontrados na Amazon", len(items)),
	}, nil
}

func (c *Connector) FetchOrders(ctx context.Context, account mp.Account, input mp.OrderSyncInput) (mp.OrderSyncResult, error) {
	if strings.TrimSpace(account.AccessToken) == "" || strings.TrimSpace(account.Marketplace) == "" {
		return mp.OrderSyncResult{Provider: c.Provider()}, mp.ErrMissingCredentials
	}
	if input.Days <= 0 {
		input.Days = 7
	}

	baseURL := strings.TrimRight(os.Getenv("AMAZON_SP_API_BASE_URL"), "/")
	if baseURL == "" {
		baseURL = "https://sellingpartnerapi-na.amazon.com"
	}

	endpoint, _ := url.Parse(baseURL + "/orders/v0/orders")
	query := endpoint.Query()
	query.Set("MarketplaceIds", account.Marketplace)
	query.Set("CreatedAfter", time.Now().AddDate(0, 0, -input.Days).Format(time.RFC3339))
	query.Set("MaxResultsPerPage", "50")
	endpoint.RawQuery = query.Encode()

	var response amazonOrdersResponse
	if err := c.getSignedJSON(ctx, endpoint.String(), account.AccessToken, &response); err != nil {
		return mp.OrderSyncResult{Provider: c.Provider()}, err
	}

	orders := make([]mp.Order, 0, len(response.Payload.Orders))
	for _, order := range response.Payload.Orders {
		items, err := c.fetchOrderItems(ctx, baseURL, account.AccessToken, order.AmazonOrderID)
		if err != nil {
			return mp.OrderSyncResult{Provider: c.Provider()}, err
		}
		orders = append(orders, normalizeOrder(order, items))
	}
	return mp.OrderSyncResult{
		Provider: c.Provider(),
		Orders:   orders,
		Message:  fmt.Sprintf("%d pedido(s) encontrados na Amazon", len(orders)),
	}, nil
}

func (c *Connector) fetchOrderItems(ctx context.Context, baseURL string, token string, orderID string) ([]amazonOrderItem, error) {
	endpoint := baseURL + "/orders/v0/orders/" + url.PathEscape(orderID) + "/orderItems"
	var response amazonOrderItemsResponse
	if err := c.getSignedJSON(ctx, endpoint, token, &response); err != nil {
		return nil, err
	}
	return response.Payload.OrderItems, nil
}

func (c *Connector) getSignedJSON(ctx context.Context, endpoint string, token string, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("x-amz-access-token", token)
	applyAmazonSigV4(req)
	res, err := c.client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode >= 300 {
		return fmt.Errorf("amazon SP-API retornou HTTP %d; confirme assinatura SigV4 e roles da app", res.StatusCode)
	}
	return json.NewDecoder(res.Body).Decode(out)
}

type amazonListingsResponse struct {
	Items []amazonListingItem `json:"items"`
}

type amazonTokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"`
}

type amazonListingItem struct {
	SKU                     string                    `json:"sku"`
	Summaries               []amazonSummary           `json:"summaries"`
	Attributes              map[string]any            `json:"attributes"`
	Offers                  []amazonOffer             `json:"offers"`
	FulfillmentAvailability []amazonFulfillmentStatus `json:"fulfillmentAvailability"`
}

type amazonSummary struct {
	ItemName  string   `json:"itemName"`
	Status    []string `json:"status"`
	MainImage struct {
		Link string `json:"link"`
	} `json:"mainImage"`
}

type amazonOffer struct {
	Price struct {
		Amount float64 `json:"amount"`
	} `json:"price"`
}

type amazonFulfillmentStatus struct {
	Quantity int `json:"quantity"`
}

type amazonOrdersResponse struct {
	Payload struct {
		Orders []amazonOrder `json:"Orders"`
	} `json:"payload"`
}

type amazonOrder struct {
	AmazonOrderID string      `json:"AmazonOrderId"`
	OrderStatus   string      `json:"OrderStatus"`
	PurchaseDate  string      `json:"PurchaseDate"`
	OrderTotal    amazonMoney `json:"OrderTotal"`
	BuyerInfo     struct {
		BuyerEmail string `json:"BuyerEmail"`
	} `json:"BuyerInfo"`
	ShippingAddress struct {
		Name string `json:"Name"`
	} `json:"ShippingAddress"`
}

type amazonOrderItemsResponse struct {
	Payload struct {
		OrderItems []amazonOrderItem `json:"OrderItems"`
	} `json:"payload"`
}

type amazonOrderItem struct {
	ASIN              string      `json:"ASIN"`
	SellerSKU         string      `json:"SellerSKU"`
	Title             string      `json:"Title"`
	QuantityOrdered   int         `json:"QuantityOrdered"`
	ItemPrice         amazonMoney `json:"ItemPrice"`
	ShippingPrice     amazonMoney `json:"ShippingPrice"`
	PromotionDiscount amazonMoney `json:"PromotionDiscount"`
}

type amazonMoney struct {
	CurrencyCode string  `json:"CurrencyCode"`
	Amount       float64 `json:"Amount,string"`
}

func normalizeItem(item amazonListingItem) mp.CatalogItem {
	title := item.SKU
	imageURL := ""
	status := "active"
	if len(item.Summaries) > 0 {
		if item.Summaries[0].ItemName != "" {
			title = item.Summaries[0].ItemName
		}
		imageURL = item.Summaries[0].MainImage.Link
		if len(item.Summaries[0].Status) > 0 && strings.ToUpper(item.Summaries[0].Status[0]) != "BUYABLE" {
			status = "paused"
		}
	}

	price := 0.0
	if len(item.Offers) > 0 {
		price = item.Offers[0].Price.Amount
	}
	stock := 0
	if len(item.FulfillmentAvailability) > 0 {
		stock = item.FulfillmentAvailability[0].Quantity
	}
	material := stringAttribute(item.Attributes, "material")

	return mp.CatalogItem{
		ExternalItemID: item.SKU,
		ExternalSKU:    item.SKU,
		ExternalTitle:  title,
		Title:          title,
		Description:    title,
		Price:          price,
		ImageURL:       imageURL,
		Material:       material,
		StockQty:       stock,
		Status:         status,
		ColorImages:    []mp.CatalogColorImage{{ColorName: "Padrao", ImageURL: imageURL, SortOrder: 0}},
		ColorStocks:    []mp.CatalogColorStock{{ColorName: "Padrao", StockQty: stock}},
		Raw: map[string]any{
			"stock": strconv.Itoa(stock),
		},
	}
}

func normalizeOrder(order amazonOrder, orderItems []amazonOrderItem) mp.Order {
	orderedAt, err := time.Parse(time.RFC3339, order.PurchaseDate)
	if err != nil {
		orderedAt = time.Now()
	}

	items := make([]mp.OrderItem, 0, len(orderItems))
	itemsAmount := 0.0
	shippingCost := 0.0
	discount := 0.0
	currency := order.OrderTotal.CurrencyCode
	for _, item := range orderItems {
		quantity := item.QuantityOrdered
		if quantity <= 0 {
			quantity = 1
		}
		unitPrice := item.ItemPrice.Amount
		gross := unitPrice
		if quantity > 0 && unitPrice > 0 {
			gross = unitPrice
		}
		itemsAmount += gross
		shippingCost += item.ShippingPrice.Amount
		discount += item.PromotionDiscount.Amount
		if currency == "" {
			currency = item.ItemPrice.CurrencyCode
		}
		items = append(items, mp.OrderItem{
			ExternalItemID: item.ASIN,
			ExternalSKU:    item.SellerSKU,
			Title:          item.Title,
			Quantity:       quantity,
			UnitPrice:      unitPrice / float64(quantity),
			GrossAmount:    gross,
			DiscountAmount: item.PromotionDiscount.Amount,
		})
	}

	grossAmount := order.OrderTotal.Amount
	if grossAmount <= 0 {
		grossAmount = itemsAmount + shippingCost - discount
	}
	buyer := order.BuyerInfo.BuyerEmail
	if buyer == "" {
		buyer = order.ShippingAddress.Name
	}

	return mp.Order{
		ExternalOrderID: order.AmazonOrderID,
		Status:          normalizeOrderStatus(order.OrderStatus),
		Currency:        defaultCurrency(currency),
		GrossAmount:     grossAmount,
		ItemsAmount:     itemsAmount,
		ShippingCost:    shippingCost,
		DiscountAmount:  discount,
		NetAmount:       grossAmount - shippingCost - discount,
		BuyerNickname:   buyer,
		OrderedAt:       orderedAt,
		Items:           items,
	}
}

func normalizeOrderStatus(status string) string {
	switch strings.ToUpper(strings.TrimSpace(status)) {
	case "SHIPPED", "UNSHIPPED", "PARTIALLYSHIPPED":
		return "paid"
	case "CANCELED", "CANCELLED":
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

func applyAmazonSigV4(req *http.Request) {
	accessKey := strings.TrimSpace(os.Getenv("AMAZON_AWS_ACCESS_KEY_ID"))
	secretKey := strings.TrimSpace(os.Getenv("AMAZON_AWS_SECRET_ACCESS_KEY"))
	sessionToken := strings.TrimSpace(os.Getenv("AMAZON_AWS_SESSION_TOKEN"))
	if accessKey == "" {
		accessKey = strings.TrimSpace(os.Getenv("AWS_ACCESS_KEY_ID"))
	}
	if secretKey == "" {
		secretKey = strings.TrimSpace(os.Getenv("AWS_SECRET_ACCESS_KEY"))
	}
	if sessionToken == "" {
		sessionToken = strings.TrimSpace(os.Getenv("AWS_SESSION_TOKEN"))
	}
	if accessKey == "" || secretKey == "" {
		if auth := strings.TrimSpace(os.Getenv("AMAZON_SP_API_AUTHORIZATION")); auth != "" {
			req.Header.Set("Authorization", auth)
		}
		return
	}

	region := strings.TrimSpace(os.Getenv("AMAZON_SP_API_REGION"))
	if region == "" {
		region = "us-east-1"
	}
	service := "execute-api"
	now := time.Now().UTC()
	amzDate := now.Format("20060102T150405Z")
	dateStamp := now.Format("20060102")
	req.Header.Set("Host", req.URL.Host)
	req.Header.Set("x-amz-date", amzDate)
	if sessionToken != "" {
		req.Header.Set("x-amz-security-token", sessionToken)
	}

	payloadHash := hashHex("")
	canonicalHeaders, signedHeaders := canonicalAmazonHeaders(req)
	canonicalRequest := strings.Join([]string{
		req.Method,
		canonicalPath(req.URL),
		canonicalQuery(req.URL),
		canonicalHeaders,
		signedHeaders,
		payloadHash,
	}, "\n")
	credentialScope := dateStamp + "/" + region + "/" + service + "/aws4_request"
	stringToSign := strings.Join([]string{
		"AWS4-HMAC-SHA256",
		amzDate,
		credentialScope,
		hashHex(canonicalRequest),
	}, "\n")
	signingKey := amazonSigningKey(secretKey, dateStamp, region, service)
	signature := hex.EncodeToString(hmacSHA256(signingKey, stringToSign))
	req.Header.Set("Authorization", fmt.Sprintf("AWS4-HMAC-SHA256 Credential=%s/%s, SignedHeaders=%s, Signature=%s", accessKey, credentialScope, signedHeaders, signature))
}

func canonicalAmazonHeaders(req *http.Request) (string, string) {
	keys := []string{"host", "x-amz-access-token", "x-amz-date"}
	if req.Header.Get("x-amz-security-token") != "" {
		keys = append(keys, "x-amz-security-token")
	}
	sort.Strings(keys)
	lines := make([]string, 0, len(keys))
	for _, key := range keys {
		value := req.Header.Get(key)
		if key == "host" {
			value = req.URL.Host
		}
		lines = append(lines, key+":"+strings.Join(strings.Fields(value), " "))
	}
	return strings.Join(lines, "\n") + "\n", strings.Join(keys, ";")
}

func canonicalPath(rawURL *url.URL) string {
	path := rawURL.EscapedPath()
	if path == "" {
		return "/"
	}
	return path
}

func canonicalQuery(rawURL *url.URL) string {
	values, _ := url.ParseQuery(rawURL.RawQuery)
	return values.Encode()
}

func hashHex(value string) string {
	sum := sha256.Sum256([]byte(value))
	return hex.EncodeToString(sum[:])
}

func amazonSigningKey(secret string, date string, region string, service string) []byte {
	kDate := hmacSHA256([]byte("AWS4"+secret), date)
	kRegion := hmacSHA256(kDate, region)
	kService := hmacSHA256(kRegion, service)
	return hmacSHA256(kService, "aws4_request")
}

func hmacSHA256(key []byte, value string) []byte {
	mac := hmac.New(sha256.New, key)
	mac.Write([]byte(value))
	return mac.Sum(nil)
}

func stringAttribute(attributes map[string]any, key string) string {
	value, ok := attributes[key]
	if !ok {
		return ""
	}
	items, ok := value.([]any)
	if !ok || len(items) == 0 {
		return ""
	}
	first, ok := items[0].(map[string]any)
	if !ok {
		return ""
	}
	if typed, ok := first["value"].(string); ok {
		return typed
	}
	return ""
}
