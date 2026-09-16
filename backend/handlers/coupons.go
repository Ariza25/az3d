package handlers

import (
	"math"
	"net/http"
	"strconv"
	"strings"

	"az3d-backend/database"
	"az3d-backend/models"
	"github.com/gin-gonic/gin"
)

type CouponHandler struct{}

func NewCouponHandler() *CouponHandler {
	return &CouponHandler{}
}

// GET /api/admin/coupons
func (h *CouponHandler) GetTenantCoupons(c *gin.Context) {
	tenantID := getTenantID(c)

	var coupons []models.Coupon
	if err := database.DB.Where("tenant_id = ?", tenantID).Order("created_at desc").Find(&coupons).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao listar cupons"})
		return
	}

	c.JSON(http.StatusOK, coupons)
}

// POST /api/admin/coupons
func (h *CouponHandler) CreateTenantCoupon(c *gin.Context) {
	tenantID := getTenantID(c)

	var input models.CouponInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Dados invalidos: " + err.Error()})
		return
	}

	cleanCode := strings.ToUpper(strings.TrimSpace(input.Code))
	if cleanCode == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "O codigo da promocao e obrigatorio"})
		return
	}

	if input.DiscountPercent <= 0 || input.DiscountPercent > 100 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "A porcentagem de desconto deve ser entre 0.01% e 100%"})
		return
	}

	// Verificar se já existe um cupom com esse código para o tenant
	var existing models.Coupon
	if err := database.DB.Where("tenant_id = ? AND code = ?", tenantID, cleanCode).First(&existing).Error; err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Ja existe um cupom cadastrado com este codigo"})
		return
	}

	isActive := true
	if input.IsActive != nil {
		isActive = *input.IsActive
	}

	coupon := models.Coupon{
		TenantID:          tenantID,
		Code:              cleanCode,
		DiscountPercent:   input.DiscountPercent,
		AppliesToShipping: input.AppliesToShipping,
		IsActive:          isActive,
		UsageLimit:        input.UsageLimit,
		UsageCount:        0,
	}

	if err := database.DB.Create(&coupon).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao salvar cupom"})
		return
	}

	c.JSON(http.StatusCreated, coupon)
}

// PUT /api/admin/coupons/:id
func (h *CouponHandler) UpdateTenantCoupon(c *gin.Context) {
	tenantID := getTenantID(c)
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalido"})
		return
	}

	var coupon models.Coupon
	if err := database.DB.Where("tenant_id = ? AND id = ?", tenantID, id).First(&coupon).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Cupom nao encontrado"})
		return
	}

	var input models.CouponInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Dados invalidos: " + err.Error()})
		return
	}

	cleanCode := strings.ToUpper(strings.TrimSpace(input.Code))
	if cleanCode != "" {
		// Checar duplicidade caso o código tenha sido alterado
		var existing models.Coupon
		if err := database.DB.Where("tenant_id = ? AND code = ? AND id <> ?", tenantID, cleanCode, id).First(&existing).Error; err == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Ja existe outro cupom com este codigo"})
			return
		}
		coupon.Code = cleanCode
	}

	if input.DiscountPercent > 0 && input.DiscountPercent <= 100 {
		coupon.DiscountPercent = input.DiscountPercent
	}
	coupon.AppliesToShipping = input.AppliesToShipping
	if input.IsActive != nil {
		coupon.IsActive = *input.IsActive
	}
	coupon.UsageLimit = input.UsageLimit

	if err := database.DB.Save(&coupon).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao atualizar cupom"})
		return
	}

	c.JSON(http.StatusOK, coupon)
}

// DELETE /api/admin/coupons/:id
func (h *CouponHandler) DeleteTenantCoupon(c *gin.Context) {
	tenantID := getTenantID(c)
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalido"})
		return
	}

	if err := database.DB.Where("tenant_id = ? AND id = ?", tenantID, id).Delete(&models.Coupon{}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao excluir cupom"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Cupom excluido com sucesso"})
}

// POST /api/coupons/validate (Público na loja)
func (h *CouponHandler) ValidateCoupon(c *gin.Context) {
	tenantID := getTenantID(c)

	var input models.ValidateCouponInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Dados invalidos: " + err.Error()})
		return
	}

	cleanCode := strings.ToUpper(strings.TrimSpace(input.Code))
	if cleanCode == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Informe o codigo do cupom"})
		return
	}

	var coupon models.Coupon
	if err := database.DB.Where("tenant_id = ? AND code = ?", tenantID, cleanCode).First(&coupon).Error; err != nil {
		c.JSON(http.StatusOK, models.ValidateCouponResponse{
			Valid:   false,
			Message: "Cupom inválido ou não encontrado",
		})
		return
	}

	if !coupon.IsActive {
		c.JSON(http.StatusOK, models.ValidateCouponResponse{
			Valid:   false,
			Message: "Este cupom foi desativado pela loja",
		})
		return
	}

	if coupon.UsageLimit > 0 && coupon.UsageCount >= coupon.UsageLimit {
		c.JSON(http.StatusOK, models.ValidateCouponResponse{
			Valid:   false,
			Message: "Este cupom atingiu o limite maximo de utilizacoes",
		})
		return
	}

	// Calcular descontos
	discountAmount := math.Round((input.Subtotal*(coupon.DiscountPercent/100.0))*100) / 100
	var shippingDiscount float64
	if coupon.AppliesToShipping && input.Shipping > 0 {
		shippingDiscount = math.Round((input.Shipping*(coupon.DiscountPercent/100.0))*100) / 100
	}
	totalDiscount := discountAmount + shippingDiscount

	c.JSON(http.StatusOK, models.ValidateCouponResponse{
		Valid:             true,
		Code:              coupon.Code,
		DiscountPercent:   coupon.DiscountPercent,
		AppliesToShipping: coupon.AppliesToShipping,
		DiscountAmount:    discountAmount,
		ShippingDiscount:  shippingDiscount,
		TotalDiscount:     totalDiscount,
	})
}
