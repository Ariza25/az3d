package shopee

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
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
	return "shopee"
}

func (c *Connector) ExchangeAuthCode(ctx context.Context, account mp.Account, request mp.TokenRequest) (mp.TokenResult, error) {
	partnerID := strings.TrimSpace(os.Getenv("SHOPEE_PARTNER_ID"))
	partnerKey := strings.TrimSpace(os.Getenv("SHOPEE_PARTNER_KEY"))
	shopID := strings.TrimSpace(account.ShopID)
	if partnerID == "" || partnerKey == "" || shopID == "" || strings.TrimSpace(request.Code) == "" {
		return mp.TokenResult{}, mp.ErrNotConfigured
	}
	partnerIDInt, err := strconv.ParseInt(partnerID, 10, 64)
	if err != nil {
		return mp.TokenResult{}, err
	}
	shopIDInt, err := strconv.ParseInt(shopID, 10, 64)
	if err != nil {
		return mp.TokenResult{}, err
	}
	body := map[string]any{
		"code":       strings.TrimSpace(request.Code),
		"shop_id":    shopIDInt,
		"partner_id": partnerIDInt,
	}
	return c.postToken(ctx, "/api/v2/auth/token/get", partnerID, partnerKey, body)
}

func (c *Connector) RefreshAccessToken(ctx context.Context, account mp.Account) (mp.TokenResult, error) {
	partnerID := strings.TrimSpace(os.Getenv("SHOPEE_PARTNER_ID"))
	partnerKey := strings.TrimSpace(os.Getenv("SHOPEE_PARTNER_KEY"))
	if partnerID == "" || partnerKey == "" || strings.TrimSpace(account.ShopID) == "" || strings.TrimSpace(account.RefreshToken) == "" {
		return mp.TokenResult{}, mp.ErrMissingCredentials
	}
	partnerIDInt, err := strconv.ParseInt(partnerID, 10, 64)
	if err != nil {
		return mp.TokenResult{}, err
	}
	shopIDInt, err := strconv.ParseInt(account.ShopID, 10, 64)
	if err != nil {
		return mp.TokenResult{}, err
	}
	body := map[string]any{
		"refresh_token": strings.TrimSpace(account.RefreshToken),
		"shop_id":       shopIDInt,
		"partner_id":    partnerIDInt,
	}
	return c.postToken(ctx, "/api/v2/auth/access_token/get", partnerID, partnerKey, body)
}

func (c *Connector) TestConnection(ctx context.Context, account mp.Account) error {
	if strings.TrimSpace(account.AccessToken) == "" || strings.TrimSpace(account.ShopID) == "" {
		return mp.ErrMissingCredentials
	}
	partnerID := strings.TrimSpace(os.Getenv("SHOPEE_PARTNER_ID"))
	partnerKey := strings.TrimSpace(os.Getenv("SHOPEE_PARTNER_KEY"))
	if partnerID == "" || partnerKey == "" {
		return mp.ErrNotConfigured
	}
	host := strings.TrimRight(os.Getenv("SHOPEE_API_BASE_URL"), "/")
	if host == "" {
		host = "https://partner.shopeemobile.com"
	}
	endpoint := c.signedURL(host, "/api/v2/shop/get_shop_info", partnerID, partnerKey, account)
	var response map[string]any
	return c.getJSON(ctx, endpoint.String(), &response)
}

func (c *Connector) postToken(ctx context.Context, path string, partnerID string, partnerKey string, body map[string]any) (mp.TokenResult, error) {
	host := strings.TrimRight(os.Getenv("SHOPEE_API_BASE_URL"), "/")
	if host == "" {
		host = "https://partner.shopeemobile.com"
	}
	timestamp := strconv.FormatInt(time.Now().Unix(), 10)
	base := partnerID + path + timestamp
	mac := hmac.New(sha256.New, []byte(partnerKey))
	mac.Write([]byte(base))

	endpoint, _ := url.Parse(host + path)
	query := endpoint.Query()
	query.Set("partner_id", partnerID)
	query.Set("timestamp", timestamp)
	query.Set("sign", hex.EncodeToString(mac.Sum(nil)))
	endpoint.RawQuery = query.Encode()

	payload, err := json.Marshal(body)
	if err != nil {
		return mp.TokenResult{}, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint.String(), bytes.NewReader(payload))
	if err != nil {
		return mp.TokenResult{}, err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/json")
	res, err := c.client.Do(req)
	if err != nil {
		return mp.TokenResult{}, err
	}
	defer res.Body.Close()
	if res.StatusCode >= 300 {
		return mp.TokenResult{}, fmt.Errorf("shopee token HTTP %d", res.StatusCode)
	}
	var response shopeeTokenResponse
	if err := json.NewDecoder(res.Body).Decode(&response); err != nil {
		return mp.TokenResult{}, err
	}
	if response.Error != "" {
		return mp.TokenResult{}, fmt.Errorf("shopee token error: %s", response.Message)
	}
	return mp.TokenResult{
		AccessToken:  response.AccessToken,
		RefreshToken: response.RefreshToken,
		ShopID:       strconv.FormatInt(response.ShopID, 10),
		ExpiresIn:    response.ExpireIn,
		ExpiresAt:    time.Now().Add(time.Duration(response.ExpireIn) * time.Second),
	}, nil
}

func (c *Connector) FetchCatalog(ctx context.Context, account mp.Account) (mp.CatalogSyncResult, error) {
	if strings.TrimSpace(account.AccessToken) == "" || strings.TrimSpace(account.ShopID) == "" {
		return mp.CatalogSyncResult{Provider: c.Provider()}, mp.ErrMissingCredentials
	}
	partnerID := strings.TrimSpace(os.Getenv("SHOPEE_PARTNER_ID"))
	partnerKey := strings.TrimSpace(os.Getenv("SHOPEE_PARTNER_KEY"))
	if partnerID == "" || partnerKey == "" {
		return mp.CatalogSyncResult{Provider: c.Provider()}, mp.ErrNotConfigured
	}

	host := strings.TrimRight(os.Getenv("SHOPEE_API_BASE_URL"), "/")
	if host == "" {
		host = "https://partner.shopeemobile.com"
	}

	itemIDs, err := c.fetchItemIDs(ctx, host, partnerID, partnerKey, account)
	if err != nil {
		return mp.CatalogSyncResult{Provider: c.Provider()}, err
	}
	items, err := c.fetchBaseInfo(ctx, host, partnerID, partnerKey, account, itemIDs)
	if err != nil {
		return mp.CatalogSyncResult{Provider: c.Provider()}, err
	}

	return mp.CatalogSyncResult{
		Provider: c.Provider(),
		Items:    items,
		Message:  fmt.Sprintf("%d anuncio(s) encontrados na Shopee", len(items)),
	}, nil
}

func (c *Connector) FetchOrders(ctx context.Context, account mp.Account, input mp.OrderSyncInput) (mp.OrderSyncResult, error) {
	if strings.TrimSpace(account.AccessToken) == "" || strings.TrimSpace(account.ShopID) == "" {
		return mp.OrderSyncResult{Provider: c.Provider()}, mp.ErrMissingCredentials
	}
	partnerID := strings.TrimSpace(os.Getenv("SHOPEE_PARTNER_ID"))
	partnerKey := strings.TrimSpace(os.Getenv("SHOPEE_PARTNER_KEY"))
	if partnerID == "" || partnerKey == "" {
		return mp.OrderSyncResult{Provider: c.Provider()}, mp.ErrNotConfigured
	}
	if input.Days <= 0 {
		input.Days = 7
	}

	host := strings.TrimRight(os.Getenv("SHOPEE_API_BASE_URL"), "/")
	if host == "" {
		host = "https://partner.shopeemobile.com"
	}

	orderSNs, err := c.fetchOrderSNs(ctx, host, partnerID, partnerKey, account, input.Days)
	if err != nil {
		return mp.OrderSyncResult{Provider: c.Provider()}, err
	}
	orders, err := c.fetchOrderDetails(ctx, host, partnerID, partnerKey, account, orderSNs)
	if err != nil {
		return mp.OrderSyncResult{Provider: c.Provider()}, err
	}
	return mp.OrderSyncResult{
		Provider: c.Provider(),
		Orders:   orders,
		Message:  fmt.Sprintf("%d pedido(s) encontrados na Shopee", len(orders)),
	}, nil
}

func (c *Connector) fetchItemIDs(ctx context.Context, host string, partnerID string, partnerKey string, account mp.Account) ([]int64, error) {
	endpoint := c.signedURL(host, "/api/v2/product/get_item_list", partnerID, partnerKey, account)
	query := endpoint.Query()
	query.Set("offset", "0")
	query.Set("page_size", "50")
	query.Set("item_status", "NORMAL")
	endpoint.RawQuery = query.Encode()

	var response shopeeItemListResponse
	if err := c.getJSON(ctx, endpoint.String(), &response); err != nil {
		return nil, err
	}
	ids := []int64{}
	for _, item := range response.Response.Item {
		if item.ItemID > 0 {
			ids = append(ids, item.ItemID)
		}
	}
	for _, item := range response.Response.ItemList {
		if item.ItemID > 0 {
			ids = append(ids, item.ItemID)
		}
	}
	return ids, nil
}

func (c *Connector) fetchBaseInfo(ctx context.Context, host string, partnerID string, partnerKey string, account mp.Account, itemIDs []int64) ([]mp.CatalogItem, error) {
	items := []mp.CatalogItem{}
	for start := 0; start < len(itemIDs); start += 50 {
		end := start + 50
		if end > len(itemIDs) {
			end = len(itemIDs)
		}

		ids := make([]string, 0, end-start)
		for _, id := range itemIDs[start:end] {
			ids = append(ids, strconv.FormatInt(id, 10))
		}
		endpoint := c.signedURL(host, "/api/v2/product/get_item_base_info", partnerID, partnerKey, account)
		query := endpoint.Query()
		query.Set("item_id_list", strings.Join(ids, ","))
		query.Set("need_tax_info", "false")
		query.Set("need_complaint_policy", "false")
		endpoint.RawQuery = query.Encode()

		var response shopeeBaseInfoResponse
		if err := c.getJSON(ctx, endpoint.String(), &response); err != nil {
			return nil, err
		}
		for _, item := range response.Response.ItemList {
			items = append(items, normalizeItem(item))
		}
	}
	return items, nil
}

func (c *Connector) fetchOrderSNs(ctx context.Context, host string, partnerID string, partnerKey string, account mp.Account, days int) ([]string, error) {
	endpoint := c.signedURL(host, "/api/v2/order/get_order_list", partnerID, partnerKey, account)
	query := endpoint.Query()
	query.Set("time_range_field", "create_time")
	query.Set("time_from", strconv.FormatInt(time.Now().AddDate(0, 0, -days).Unix(), 10))
	query.Set("time_to", strconv.FormatInt(time.Now().Unix(), 10))
	query.Set("page_size", "50")
	endpoint.RawQuery = query.Encode()

	var response shopeeOrderListResponse
	if err := c.getJSON(ctx, endpoint.String(), &response); err != nil {
		return nil, err
	}
	sns := make([]string, 0, len(response.Response.OrderList))
	for _, item := range response.Response.OrderList {
		if strings.TrimSpace(item.OrderSN) != "" {
			sns = append(sns, item.OrderSN)
		}
	}
	return sns, nil
}

func (c *Connector) fetchOrderDetails(ctx context.Context, host string, partnerID string, partnerKey string, account mp.Account, orderSNs []string) ([]mp.Order, error) {
	orders := []mp.Order{}
	for start := 0; start < len(orderSNs); start += 50 {
		end := start + 50
		if end > len(orderSNs) {
			end = len(orderSNs)
		}
		endpoint := c.signedURL(host, "/api/v2/order/get_order_detail", partnerID, partnerKey, account)
		query := endpoint.Query()
		query.Set("order_sn_list", strings.Join(orderSNs[start:end], ","))
		query.Set("response_optional_fields", "buyer_username,item_list,total_amount,estimated_shipping_fee,actual_shipping_fee,buyer_paid_shipping_fee,order_status,create_time,currency")
		endpoint.RawQuery = query.Encode()

		var response shopeeOrderDetailResponse
		if err := c.getJSON(ctx, endpoint.String(), &response); err != nil {
			return nil, err
		}
		for _, order := range response.Response.OrderList {
			orders = append(orders, normalizeOrder(order))
		}
	}
	return orders, nil
}

func (c *Connector) signedURL(host string, path string, partnerID string, partnerKey string, account mp.Account) url.URL {
	timestamp := strconv.FormatInt(time.Now().Unix(), 10)
	base := partnerID + path + timestamp + account.AccessToken + account.ShopID
	mac := hmac.New(sha256.New, []byte(partnerKey))
	mac.Write([]byte(base))

	endpoint, _ := url.Parse(host + path)
	query := endpoint.Query()
	query.Set("partner_id", partnerID)
	query.Set("timestamp", timestamp)
	query.Set("access_token", account.AccessToken)
	query.Set("shop_id", account.ShopID)
	query.Set("sign", hex.EncodeToString(mac.Sum(nil)))
	endpoint.RawQuery = query.Encode()
	return *endpoint
}

func (c *Connector) getJSON(ctx context.Context, endpoint string, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/json")
	res, err := c.client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode >= 300 {
		return fmt.Errorf("shopee retornou HTTP %d", res.StatusCode)
	}
	if err := json.NewDecoder(res.Body).Decode(out); err != nil {
		return err
	}
	return nil
}

type shopeeItemListResponse struct {
	Response struct {
		Item     []shopeeItemRef `json:"item"`
		ItemList []shopeeItemRef `json:"item_list"`
	} `json:"response"`
}

type shopeeItemRef struct {
	ItemID int64 `json:"item_id"`
}

type shopeeTokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpireIn     int    `json:"expire_in"`
	ShopID       int64  `json:"shop_id"`
	Error        string `json:"error"`
	Message      string `json:"message"`
}

type shopeeBaseInfoResponse struct {
	Response struct {
		ItemList []shopeeItem `json:"item_list"`
	} `json:"response"`
}

type shopeeItem struct {
	ItemID        int64           `json:"item_id"`
	ItemSKU       string          `json:"item_sku"`
	ItemName      string          `json:"item_name"`
	Description   string          `json:"description"`
	PriceInfo     []shopeePrice   `json:"price_info"`
	StockInfo     []shopeeStock   `json:"stock_info_v2"`
	Image         shopeeImage     `json:"image"`
	ItemStatus    string          `json:"item_status"`
	AttributeList []shopeeAttrib  `json:"attribute_list"`
	VariationList []shopeeVariant `json:"variation_list"`
}

type shopeePrice struct {
	CurrentPrice  float64 `json:"current_price"`
	OriginalPrice float64 `json:"original_price"`
}

type shopeeStock struct {
	SummaryInfo struct {
		TotalAvailableStock int `json:"total_available_stock"`
		TotalReservedStock  int `json:"total_reserved_stock"`
	} `json:"summary_info"`
}

type shopeeImage struct {
	ImageURLList []string `json:"image_url_list"`
	ImageIDList  []string `json:"image_id_list"`
}

type shopeeAttrib struct {
	AttributeName string `json:"attribute_name"`
	OriginalValue string `json:"original_value_name"`
}

type shopeeVariant struct {
	ModelID   int64         `json:"model_id"`
	ModelSKU  string        `json:"model_sku"`
	ModelName string        `json:"model_name"`
	PriceInfo []shopeePrice `json:"price_info"`
	StockInfo []shopeeStock `json:"stock_info_v2"`
}

type shopeeOrderListResponse struct {
	Response struct {
		OrderList []struct {
			OrderSN string `json:"order_sn"`
		} `json:"order_list"`
	} `json:"response"`
}

type shopeeOrderDetailResponse struct {
	Response struct {
		OrderList []shopeeOrder `json:"order_list"`
	} `json:"response"`
}

type shopeeOrder struct {
	OrderSN              string            `json:"order_sn"`
	OrderStatus          string            `json:"order_status"`
	Currency             string            `json:"currency"`
	TotalAmount          float64           `json:"total_amount"`
	EstimatedShippingFee float64           `json:"estimated_shipping_fee"`
	ActualShippingFee    float64           `json:"actual_shipping_fee"`
	BuyerPaidShippingFee float64           `json:"buyer_paid_shipping_fee"`
	BuyerUsername        string            `json:"buyer_username"`
	CreateTime           int64             `json:"create_time"`
	ItemList             []shopeeOrderItem `json:"item_list"`
}

type shopeeOrderItem struct {
	ItemID                 int64   `json:"item_id"`
	ItemName               string  `json:"item_name"`
	ItemSKU                string  `json:"item_sku"`
	ModelID                int64   `json:"model_id"`
	ModelName              string  `json:"model_name"`
	ModelSKU               string  `json:"model_sku"`
	ModelQuantityPurchased int     `json:"model_quantity_purchased"`
	ModelDiscountedPrice   float64 `json:"model_discounted_price"`
	ModelOriginalPrice     float64 `json:"model_original_price"`
}

func normalizeItem(item shopeeItem) mp.CatalogItem {
	imageURL := ""
	if len(item.Image.ImageURLList) > 0 {
		imageURL = item.Image.ImageURLList[0]
	}
	price := firstPrice(item.PriceInfo)
	stock := firstStock(item.StockInfo)
	material := ""
	for _, attr := range item.AttributeList {
		if strings.Contains(strings.ToLower(attr.AttributeName), "material") {
			material = attr.OriginalValue
			break
		}
	}
	status := "active"
	if strings.ToUpper(item.ItemStatus) != "NORMAL" {
		status = "paused"
	}

	variants := make([]mp.CatalogVariant, 0, len(item.VariationList))
	for index, variation := range item.VariationList {
		variants = append(variants, mp.CatalogVariant{
			ColorName: variation.ModelName,
			Price:     firstPrice(variation.PriceInfo),
			IsActive:  true,
			SortOrder: index,
		})
	}

	externalID := strconv.FormatInt(item.ItemID, 10)
	return mp.CatalogItem{
		ExternalItemID: externalID,
		ExternalSKU:    item.ItemSKU,
		ExternalTitle:  item.ItemName,
		Title:          item.ItemName,
		Description:    item.Description,
		Price:          price,
		ImageURL:       imageURL,
		Material:       material,
		StockQty:       stock,
		Status:         status,
		ColorImages:    []mp.CatalogColorImage{{ColorName: "Padrao", ImageURL: imageURL, SortOrder: 0}},
		ColorStocks:    []mp.CatalogColorStock{{ColorName: "Padrao", StockQty: stock}},
		Variants:       variants,
	}
}

func normalizeOrder(order shopeeOrder) mp.Order {
	shippingCost := order.ActualShippingFee
	if shippingCost <= 0 {
		shippingCost = order.BuyerPaidShippingFee
	}
	if shippingCost <= 0 {
		shippingCost = order.EstimatedShippingFee
	}

	items := make([]mp.OrderItem, 0, len(order.ItemList))
	itemsAmount := 0.0
	for _, item := range order.ItemList {
		quantity := item.ModelQuantityPurchased
		if quantity <= 0 {
			quantity = 1
		}
		unitPrice := item.ModelDiscountedPrice
		if unitPrice <= 0 {
			unitPrice = item.ModelOriginalPrice
		}
		gross := unitPrice * float64(quantity)
		sku := strings.TrimSpace(item.ModelSKU)
		if sku == "" {
			sku = strings.TrimSpace(item.ItemSKU)
		}
		itemsAmount += gross
		items = append(items, mp.OrderItem{
			ExternalItemID: strconv.FormatInt(item.ItemID, 10),
			ExternalSKU:    sku,
			Title:          item.ItemName,
			Quantity:       quantity,
			UnitPrice:      unitPrice,
			GrossAmount:    gross,
			ColorName:      item.ModelName,
		})
	}
	grossAmount := order.TotalAmount
	if grossAmount <= 0 {
		grossAmount = itemsAmount + shippingCost
	}

	orderedAt := time.Unix(order.CreateTime, 0)
	if order.CreateTime <= 0 {
		orderedAt = time.Now()
	}
	return mp.Order{
		ExternalOrderID: order.OrderSN,
		Status:          normalizeOrderStatus(order.OrderStatus),
		Currency:        defaultCurrency(order.Currency),
		GrossAmount:     grossAmount,
		ItemsAmount:     itemsAmount,
		ShippingCost:    shippingCost,
		NetAmount:       grossAmount - shippingCost,
		BuyerNickname:   order.BuyerUsername,
		OrderedAt:       orderedAt,
		Items:           items,
	}
}

func normalizeOrderStatus(status string) string {
	switch strings.ToUpper(strings.TrimSpace(status)) {
	case "COMPLETED", "READY_TO_SHIP", "SHIPPED", "PROCESSED":
		return "paid"
	case "CANCELLED":
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

func firstPrice(prices []shopeePrice) float64 {
	for _, price := range prices {
		if price.CurrentPrice > 0 {
			return price.CurrentPrice
		}
		if price.OriginalPrice > 0 {
			return price.OriginalPrice
		}
	}
	return 0
}

func firstStock(stocks []shopeeStock) int {
	for _, stock := range stocks {
		if stock.SummaryInfo.TotalAvailableStock > 0 {
			return stock.SummaryInfo.TotalAvailableStock
		}
	}
	return 0
}
