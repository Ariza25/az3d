package services

import (
	"testing"

	"az3d-backend/models"
)

func TestCalculateCouponDiscount(t *testing.T) {
	t.Run("calcula desconto percentual padrão sem frete", func(t *testing.T) {
		coupon := &models.Coupon{
			DiscountPercent:   10,
			AppliesToShipping: false,
			IsActive:          true,
		}

		subtotal := 100.0
		shipping := 25.0

		discount, shippingDiscount, total := CalculateCouponDiscount(subtotal, shipping, coupon)

		if discount != 10.0 {
			t.Errorf("expected discount 10.0, got %v", discount)
		}
		if shippingDiscount != 0.0 {
			t.Errorf("expected shipping discount 0.0, got %v", shippingDiscount)
		}
		if total != 10.0 {
			t.Errorf("expected total discount 10.0, got %v", total)
		}
	})

	t.Run("calcula desconto incluindo frete quando habilitado", func(t *testing.T) {
		coupon := &models.Coupon{
			DiscountPercent:   20,
			AppliesToShipping: true,
			IsActive:          true,
		}

		subtotal := 200.0
		shipping := 30.0

		discount, shippingDiscount, total := CalculateCouponDiscount(subtotal, shipping, coupon)

		if discount != 40.0 {
			t.Errorf("expected discount 40.0, got %v", discount)
		}
		if shippingDiscount != 6.0 {
			t.Errorf("expected shipping discount 6.0, got %v", shippingDiscount)
		}
		if total != 46.0 {
			t.Errorf("expected total discount 46.0, got %v", total)
		}
	})

	t.Run("retorna zeros para cupom inativo", func(t *testing.T) {
		coupon := &models.Coupon{
			DiscountPercent:   15,
			AppliesToShipping: true,
			IsActive:          false,
		}

		discount, shippingDiscount, total := CalculateCouponDiscount(100.0, 20.0, coupon)
		if discount != 0 || shippingDiscount != 0 || total != 0 {
			t.Errorf("expected zeros for inactive coupon, got %v, %v, %v", discount, shippingDiscount, total)
		}
	})

	t.Run("retorna zeros para cupom nulo", func(t *testing.T) {
		discount, shippingDiscount, total := CalculateCouponDiscount(100.0, 20.0, nil)
		if discount != 0 || shippingDiscount != 0 || total != 0 {
			t.Errorf("expected zeros for nil coupon, got %v, %v, %v", discount, shippingDiscount, total)
		}
	})
}
