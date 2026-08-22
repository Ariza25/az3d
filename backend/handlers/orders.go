package handlers

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"az3d-backend/database"
	"az3d-backend/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type OrderHandler struct{}

func NewOrderHandler() *OrderHandler {
	return &OrderHandler{}
}

func (h *OrderHandler) CreateOrder(c *gin.Context) {
	userIDVal, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Usuario nao autenticado"})
		return
	}
	userID := userIDVal.(uint)
	tenantID := getTenantID(c)

	var input models.CreateOrderInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Dados do pedido invalidos: " + err.Error()})
		return
	}

	if len(input.Items) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "O carrinho nao contem itens para finalizar o pedido"})
		return
	}

	if strings.TrimSpace(os.Getenv("MERCADO_PAGO_ACCESS_TOKEN")) == "" {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Mercado Pago nao configurado. Defina MERCADO_PAGO_ACCESS_TOKEN no backend."})
		return
	}

	deliveryMethod := strings.TrimSpace(input.DeliveryMethod)
	if deliveryMethod == "" {
		deliveryMethod = "shipping"
	}

	var order models.Order
	if err := database.DB.Transaction(func(tx *gorm.DB) error {
		var totalAmount float64
		var orderItems []models.OrderItem

		for _, itemInput := range input.Items {
			var product models.Product
			if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("tenant_id = ? AND in_stock = ? AND (status = ? OR status = '')", tenantID, true, "active").First(&product, itemInput.ProductID).Error; err != nil {
				return err
			}

			color := strings.TrimSpace(itemInput.Color)
			if color == "" {
				color = "Preto Slate"
			}

			unitPrice := product.Price
			var variant models.ProductVariant
			if err := tx.Where("tenant_id = ? AND product_id = ? AND color_name = ? AND is_active = ?", tenantID, product.ID, color, true).First(&variant).Error; err == nil && variant.Price > 0 {
				unitPrice = variant.Price
			}

			var colorStock models.ProductColorStock
			colorStockErr := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("tenant_id = ? AND product_id = ? AND color_name = ?", tenantID, product.ID, color).First(&colorStock).Error
			if colorStockErr == nil {
				if colorStock.StockQty < itemInput.Quantity {
					return errInsufficientStock("Estoque insuficiente para a cor " + color)
				}
				colorStock.StockQty -= itemInput.Quantity
				if err := tx.Save(&colorStock).Error; err != nil {
					return err
				}
				var totalColorStock int64
				if err := tx.Model(&models.ProductColorStock{}).Where("tenant_id = ? AND product_id = ?", tenantID, product.ID).Select("COALESCE(SUM(stock_qty), 0)").Scan(&totalColorStock).Error; err != nil {
					return err
				}
				product.StockQty = int(totalColorStock)
				product.InStock = product.StockQty > 0
				if err := tx.Save(&product).Error; err != nil {
					return err
				}
			} else if errors.Is(colorStockErr, gorm.ErrRecordNotFound) {
				if product.StockQty < itemInput.Quantity {
					return errInsufficientStock("Estoque insuficiente para o produto " + product.Title)
				}
				product.StockQty -= itemInput.Quantity
				product.InStock = product.StockQty > 0
				if err := tx.Save(&product).Error; err != nil {
					return err
				}
				colorStock.StockQty = product.StockQty
			} else {
				return colorStockErr
			}

			totalAmount += unitPrice * float64(itemInput.Quantity)
			orderItems = append(orderItems, models.OrderItem{
				ProductID: product.ID,
				Quantity:  itemInput.Quantity,
				UnitPrice: unitPrice,
				Color:     color,
			})
		}

		order = models.Order{
			TenantID:        tenantID,
			UserID:          userID,
			TotalAmount:     totalAmount,
			Status:          "pending_payment",
			Items:           orderItems,
			ShippingAddress: input.ShippingAddress,
			DeliveryMethod:  deliveryMethod,
			RecipientName:   input.RecipientName,
			RecipientPhone:  input.RecipientPhone,
			ZipCode:         input.ZipCode,
			City:            input.City,
			State:           input.State,
			Notes:           input.Notes,
			PaymentProvider: "mercadopago",
			PaymentStatus:   "pending",
		}

		if err := tx.Create(&order).Error; err != nil {
			return err
		}

		for _, item := range orderItems {
			reason := "Baixa automatica no pedido"
			var quantityAfter int
			var stock models.ProductColorStock
			if err := tx.Where("tenant_id = ? AND product_id = ? AND color_name = ?", tenantID, item.ProductID, item.Color).First(&stock).Error; err == nil {
				quantityAfter = stock.StockQty
			} else {
				var product models.Product
				_ = tx.Select("stock_qty").Where("tenant_id = ?", tenantID).First(&product, item.ProductID).Error
				quantityAfter = product.StockQty
			}
			movement := models.StockMovement{
				TenantID:      tenantID,
				ProductID:     item.ProductID,
				OrderID:       &order.ID,
				ColorName:     item.Color,
				MovementType:  "order_reservation",
				QuantityDelta: -item.Quantity,
				QuantityAfter: quantityAfter,
				Reason:        reason,
			}
			if err := tx.Create(&movement).Error; err != nil {
				return err
			}
		}

		return nil
	}); err != nil {
		if stockErr, ok := err.(stockError); ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": stockErr.message})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": "Produto nao encontrado ou indisponivel"})
		return
	}

	if order.ID == 0 {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao registrar o pedido de impressao 3D"})
		return
	}

	database.DB.Preload("Items.Product").First(&order, order.ID)

	paymentPreference, err := createMercadoPagoPreference(c.Request.Context(), order)
	if err != nil {
		_ = cancelOrderAndReleaseStock(order.ID, "Falha ao criar preferencia Mercado Pago")
		c.JSON(http.StatusBadGateway, gin.H{"error": "Nao foi possivel iniciar pagamento no Mercado Pago: " + err.Error()})
		return
	}

	order.MPPreferenceID = paymentPreference.ID
	order.MPInitPoint = paymentPreference.InitPoint
	order.MPSandboxPoint = paymentPreference.SandboxInitPoint
	if err := database.DB.Save(&order).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Pagamento criado, mas nao foi possivel salvar dados do checkout"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Pedido criado. Redirecione o comprador para o Mercado Pago para concluir o pagamento.",
		"order":   order,
		"payment": gin.H{
			"provider":             "mercadopago",
			"preference_id":        paymentPreference.ID,
			"checkout_url":         paymentPreference.InitPoint,
			"sandbox_checkout_url": paymentPreference.SandboxInitPoint,
			"status":               order.PaymentStatus,
		},
	})
}

type stockError struct {
	message string
}

func (e stockError) Error() string {
	return e.message
}

func errInsufficientStock(message string) error {
	return stockError{message: message}
}

func (h *OrderHandler) GetMyOrders(c *gin.Context) {
	userIDVal, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Usuario nao autenticado"})
		return
	}
	userID := userIDVal.(uint)
	tenantID := getTenantID(c)

	var orders []models.Order
	if err := database.DB.Preload("Items.Product").Where("user_id = ? AND tenant_id = ?", userID, tenantID).Order("created_at desc").Find(&orders).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao buscar historico de pedidos"})
		return
	}

	c.JSON(http.StatusOK, orders)
}

func (h *OrderHandler) GetAllOrders(c *gin.Context) {
	tenantID := getTenantID(c)

	var orders []models.Order
	if err := database.DB.Preload("User").Preload("Items.Product").Where("tenant_id = ?", tenantID).Order("created_at desc").Find(&orders).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao carregar lista de pedidos do tenant"})
		return
	}

	c.JSON(http.StatusOK, orders)
}

func (h *OrderHandler) UpdateOrderStatus(c *gin.Context) {
	tenantID := getTenantID(c)
	idStr := c.Param("id")

	var order models.Order
	if err := database.DB.Where("tenant_id = ?", tenantID).First(&order, idStr).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Pedido nao encontrado"})
		return
	}

	var input models.UpdateOrderStatusInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Status invalido"})
		return
	}
	validStatuses := map[string]bool{
		"pending_confirmation": true,
		"pending_payment":      true,
		"paid":                 true,
		"preparing":            true,
		"delivered":            true,
		"cancelled":            true,
	}
	if !validStatuses[input.Status] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Status de pedido nao suportado"})
		return
	}

	order.Status = input.Status
	if err := database.DB.Save(&order).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao atualizar status do pedido"})
		return
	}

	c.JSON(http.StatusOK, order)
}

type mercadoPagoPreferenceResponse struct {
	ID               string `json:"id"`
	InitPoint        string `json:"init_point"`
	SandboxInitPoint string `json:"sandbox_init_point"`
}

type mercadoPagoPreferenceRequest struct {
	Items             []mercadoPagoPreferenceItem `json:"items"`
	Payer             mercadoPagoPayer            `json:"payer,omitempty"`
	ExternalReference string                      `json:"external_reference"`
	BackURLs          mercadoPagoBackURLs         `json:"back_urls"`
	AutoReturn        string                      `json:"auto_return,omitempty"`
	NotificationURL   string                      `json:"notification_url,omitempty"`
	StatementDesc     string                      `json:"statement_descriptor,omitempty"`
}

type mercadoPagoPreferenceItem struct {
	ID         string  `json:"id,omitempty"`
	Title      string  `json:"title"`
	Quantity   int     `json:"quantity"`
	UnitPrice  float64 `json:"unit_price"`
	CurrencyID string  `json:"currency_id"`
}

type mercadoPagoPayer struct {
	Name  string             `json:"name,omitempty"`
	Email string             `json:"email,omitempty"`
	Phone mercadoPagoPhone   `json:"phone,omitempty"`
	Addr  mercadoPagoAddress `json:"address,omitempty"`
}

type mercadoPagoPhone struct {
	Number string `json:"number,omitempty"`
}

type mercadoPagoAddress struct {
	ZipCode      string `json:"zip_code,omitempty"`
	StreetName   string `json:"street_name,omitempty"`
	StreetNumber string `json:"street_number,omitempty"`
}

type mercadoPagoBackURLs struct {
	Success string `json:"success"`
	Pending string `json:"pending"`
	Failure string `json:"failure"`
}

type mercadoPagoPaymentResponse struct {
	ID                 int64   `json:"id"`
	Status             string  `json:"status"`
	StatusDetail       string  `json:"status_detail"`
	ExternalReference  string  `json:"external_reference"`
	TransactionAmount  float64 `json:"transaction_amount"`
	DateApproved       string  `json:"date_approved"`
	PaymentMethodID    string  `json:"payment_method_id"`
	PaymentTypeID      string  `json:"payment_type_id"`
	MerchantOrderIDRaw any     `json:"order"`
}

type mercadoPagoWebhookPayload struct {
	ID     any    `json:"id"`
	Type   string `json:"type"`
	Action string `json:"action"`
	Data   struct {
		ID string `json:"id"`
	} `json:"data"`
}

func createMercadoPagoPreference(ctx context.Context, order models.Order) (*mercadoPagoPreferenceResponse, error) {
	accessToken := strings.TrimSpace(os.Getenv("MERCADO_PAGO_ACCESS_TOKEN"))
	if accessToken == "" {
		return nil, fmt.Errorf("access token nao configurado")
	}

	var user models.User
	_ = database.DB.First(&user, order.UserID).Error

	var tenant models.Tenant
	_ = database.DB.First(&tenant, order.TenantID).Error

	frontendBaseURL := strings.TrimRight(getEnv("FRONTEND_BASE_URL", "http://localhost:5173"), "/")
	apiPublicBaseURL := strings.TrimRight(getEnv("API_PUBLIC_BASE_URL", "http://localhost:8080"), "/")
	mpBaseURL := strings.TrimRight(getEnv("MERCADO_PAGO_API_BASE_URL", "https://api.mercadopago.com"), "/")
	storePath := fmt.Sprintf("%s/loja/%s", frontendBaseURL, url.PathEscape(tenant.Slug))
	orderID := strconv.FormatUint(uint64(order.ID), 10)

	requestPayload := mercadoPagoPreferenceRequest{
		Items:             make([]mercadoPagoPreferenceItem, 0, len(order.Items)),
		ExternalReference: mercadoPagoExternalReference(order.ID),
		BackURLs: mercadoPagoBackURLs{
			Success: storePath + "?payment=success&order_id=" + orderID,
			Pending: storePath + "?payment=pending&order_id=" + orderID,
			Failure: storePath + "?payment=failure&order_id=" + orderID,
		},
		AutoReturn:    "approved",
		StatementDesc: "AZ3D",
		Payer: mercadoPagoPayer{
			Name:  firstNonEmpty(order.RecipientName, user.Name),
			Email: user.Email,
			Phone: mercadoPagoPhone{Number: order.RecipientPhone},
			Addr: mercadoPagoAddress{
				ZipCode:    order.ZipCode,
				StreetName: order.ShippingAddress,
			},
		},
	}

	if apiPublicBaseURL != "" {
		requestPayload.NotificationURL = apiPublicBaseURL + "/api/webhooks/payments/mercadopago"
	}

	for _, item := range order.Items {
		title := fmt.Sprintf("Produto #%d", item.ProductID)
		if item.Product != nil && item.Product.Title != "" {
			title = item.Product.Title
		}
		requestPayload.Items = append(requestPayload.Items, mercadoPagoPreferenceItem{
			ID:         strconv.FormatUint(uint64(item.ProductID), 10),
			Title:      title,
			Quantity:   item.Quantity,
			UnitPrice:  item.UnitPrice,
			CurrencyID: "BRL",
		})
	}

	body, err := json.Marshal(requestPayload)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, mpBaseURL+"/checkout/preferences", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+accessToken)

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	resBody, _ := io.ReadAll(res.Body)
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return nil, fmt.Errorf("Mercado Pago retornou HTTP %d: %s", res.StatusCode, string(resBody))
	}

	var preference mercadoPagoPreferenceResponse
	if err := json.Unmarshal(resBody, &preference); err != nil {
		return nil, err
	}
	if preference.ID == "" || (preference.InitPoint == "" && preference.SandboxInitPoint == "") {
		return nil, fmt.Errorf("preferencia criada sem URL de checkout")
	}

	return &preference, nil
}

func (h *OrderHandler) ReceiveMercadoPagoWebhook(c *gin.Context) {
	var payload mercadoPagoWebhookPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Webhook Mercado Pago invalido"})
		return
	}

	paymentID := firstNonEmpty(payload.Data.ID, c.Query("data.id"), c.Query("id"))
	eventType := firstNonEmpty(payload.Type, c.Query("type"), c.Query("topic"))
	if paymentID == "" || eventType != "payment" {
		c.Status(http.StatusOK)
		return
	}

	if err := validateMercadoPagoWebhookSignature(c, paymentID); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	payment, err := getMercadoPagoPayment(c.Request.Context(), paymentID)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "Nao foi possivel consultar pagamento no Mercado Pago"})
		return
	}

	orderID, err := orderIDFromMercadoPagoReference(payment.ExternalReference)
	if err != nil {
		c.Status(http.StatusOK)
		return
	}

	if err := applyMercadoPagoPaymentToOrder(orderID, payment); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Nao foi possivel atualizar pedido"})
		return
	}

	c.Status(http.StatusOK)
}

func getMercadoPagoPayment(ctx context.Context, paymentID string) (*mercadoPagoPaymentResponse, error) {
	accessToken := strings.TrimSpace(os.Getenv("MERCADO_PAGO_ACCESS_TOKEN"))
	if accessToken == "" {
		return nil, fmt.Errorf("access token nao configurado")
	}

	mpBaseURL := strings.TrimRight(getEnv("MERCADO_PAGO_API_BASE_URL", "https://api.mercadopago.com"), "/")
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, mpBaseURL+"/v1/payments/"+url.PathEscape(paymentID), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	resBody, _ := io.ReadAll(res.Body)
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return nil, fmt.Errorf("Mercado Pago retornou HTTP %d: %s", res.StatusCode, string(resBody))
	}

	var payment mercadoPagoPaymentResponse
	if err := json.Unmarshal(resBody, &payment); err != nil {
		return nil, err
	}
	return &payment, nil
}

func applyMercadoPagoPaymentToOrder(orderID uint, payment *mercadoPagoPaymentResponse) error {
	return database.DB.Transaction(func(tx *gorm.DB) error {
		var order models.Order
		if err := tx.Preload("Items").Where("payment_provider = ? AND id = ?", "mercadopago", orderID).First(&order).Error; err != nil {
			return err
		}

		previousStatus := order.Status
		order.PaymentID = strconv.FormatInt(payment.ID, 10)
		order.PaymentStatus = payment.Status
		order.PaymentDetail = payment.StatusDetail

		switch payment.Status {
		case "approved":
			now := time.Now()
			order.Status = "paid"
			order.PaidAt = &now
		case "pending", "in_process", "in_mediation":
			order.Status = "pending_payment"
		case "rejected", "cancelled", "refunded", "charged_back":
			order.Status = "cancelled"
			if previousStatus != "cancelled" && previousStatus != "paid" {
				if err := releaseOrderStock(tx, order, "Liberacao automatica por pagamento "+payment.Status); err != nil {
					return err
				}
			}
		}

		return tx.Save(&order).Error
	})
}

func cancelOrderAndReleaseStock(orderID uint, reason string) error {
	return database.DB.Transaction(func(tx *gorm.DB) error {
		var order models.Order
		if err := tx.Preload("Items").First(&order, orderID).Error; err != nil {
			return err
		}
		if order.Status != "cancelled" {
			if err := releaseOrderStock(tx, order, reason); err != nil {
				return err
			}
		}
		order.Status = "cancelled"
		order.PaymentStatus = "failed"
		order.PaymentDetail = reason
		return tx.Save(&order).Error
	})
}

func releaseOrderStock(tx *gorm.DB, order models.Order, reason string) error {
	for _, item := range order.Items {
		var quantityAfter int
		var colorStock models.ProductColorStock
		colorStockErr := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("tenant_id = ? AND product_id = ? AND color_name = ?", order.TenantID, item.ProductID, item.Color).
			First(&colorStock).Error
		if colorStockErr == nil {
			colorStock.StockQty += item.Quantity
			quantityAfter = colorStock.StockQty
			if err := tx.Save(&colorStock).Error; err != nil {
				return err
			}

			var totalColorStock int64
			if err := tx.Model(&models.ProductColorStock{}).Where("tenant_id = ? AND product_id = ?", order.TenantID, item.ProductID).Select("COALESCE(SUM(stock_qty), 0)").Scan(&totalColorStock).Error; err != nil {
				return err
			}
			if err := tx.Model(&models.Product{}).Where("tenant_id = ? AND id = ?", order.TenantID, item.ProductID).Updates(map[string]any{
				"stock_qty": int(totalColorStock),
				"in_stock":  totalColorStock > 0,
			}).Error; err != nil {
				return err
			}
		} else if errors.Is(colorStockErr, gorm.ErrRecordNotFound) {
			var product models.Product
			if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("tenant_id = ?", order.TenantID).First(&product, item.ProductID).Error; err != nil {
				return err
			}
			product.StockQty += item.Quantity
			product.InStock = product.StockQty > 0
			quantityAfter = product.StockQty
			if err := tx.Save(&product).Error; err != nil {
				return err
			}
		} else {
			return colorStockErr
		}

		movement := models.StockMovement{
			TenantID:      order.TenantID,
			ProductID:     item.ProductID,
			OrderID:       &order.ID,
			ColorName:     item.Color,
			MovementType:  "order_release",
			QuantityDelta: item.Quantity,
			QuantityAfter: quantityAfter,
			Reason:        reason,
		}
		if err := tx.Create(&movement).Error; err != nil {
			return err
		}
	}

	return nil
}

func validateMercadoPagoWebhookSignature(c *gin.Context, paymentID string) error {
	secret := strings.TrimSpace(os.Getenv("MERCADO_PAGO_WEBHOOK_SECRET"))
	if secret == "" {
		return nil
	}

	signatureHeader := c.GetHeader("x-signature")
	requestID := c.GetHeader("x-request-id")
	if signatureHeader == "" || requestID == "" {
		return fmt.Errorf("assinatura Mercado Pago ausente")
	}

	parts := map[string]string{}
	for _, rawPart := range strings.Split(signatureHeader, ",") {
		keyValue := strings.SplitN(strings.TrimSpace(rawPart), "=", 2)
		if len(keyValue) == 2 {
			parts[keyValue[0]] = keyValue[1]
		}
	}

	ts := parts["ts"]
	receivedSignature := parts["v1"]
	if ts == "" || receivedSignature == "" {
		return fmt.Errorf("assinatura Mercado Pago incompleta")
	}

	manifest := fmt.Sprintf("id:%s;request-id:%s;ts:%s;", paymentID, requestID, ts)
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(manifest))
	expectedSignature := hex.EncodeToString(mac.Sum(nil))
	if subtle.ConstantTimeCompare([]byte(expectedSignature), []byte(receivedSignature)) != 1 {
		return fmt.Errorf("assinatura Mercado Pago invalida")
	}

	return nil
}

func mercadoPagoExternalReference(orderID uint) string {
	return fmt.Sprintf("az3d_order_%d", orderID)
}

func orderIDFromMercadoPagoReference(reference string) (uint, error) {
	value := strings.TrimPrefix(reference, "az3d_order_")
	parsed, err := strconv.ParseUint(value, 10, 64)
	if err != nil {
		return 0, err
	}
	return uint(parsed), nil
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func getEnv(key, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
}
