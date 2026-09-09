package mercadolivre

import (
	"context"
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
