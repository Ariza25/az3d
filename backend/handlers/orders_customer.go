package handlers

import (
	"errors"
	"net/http"
	"strings"

	"az3d-backend/database"
	"az3d-backend/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type OrderHandler struct {
	payments *MercadoPagoHandler
}

func NewOrderHandler(payments ...*MercadoPagoHandler) *OrderHandler {
	handler := &OrderHandler{}
	if len(payments) > 0 {
		handler.payments = payments[0]
	}
	return handler
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

	if h.payments == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Mercado Pago indisponivel"})
		return
	}
	paymentAccessToken, err := h.payments.AccessTokenForTenant(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "A loja ainda nao conectou a conta Mercado Pago"})
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
			productQuery := publishedProductQuery(tx.Clauses(clause.Locking{Strength: "UPDATE"}), tenantID)
			if err := productQuery.Where("in_stock = ?", true).First(&product, itemInput.ProductID).Error; err != nil {
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

	paymentPreference, err := createMercadoPagoPreference(c.Request.Context(), order, paymentAccessToken)
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
	if err := database.DB.
		Preload("Items.Product").
		Preload("Shipments.Events", func(db *gorm.DB) *gorm.DB { return db.Order("occurred_at desc") }).
		Where("user_id = ? AND tenant_id = ?", userID, tenantID).
		Order("created_at desc").
		Find(&orders).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao buscar historico de pedidos"})
		return
	}

	c.JSON(http.StatusOK, orders)
}
