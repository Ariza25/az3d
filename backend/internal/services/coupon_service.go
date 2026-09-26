package services

import (
	"math"

	"az3d-backend/models"
)

// CalculateCouponDiscount computes the discounts on subtotal and shipping for a given coupon.
func CalculateCouponDiscount(subtotal, shipping float64, coupon *models.Coupon) (discountAmount, shippingDiscount, totalDiscount float64) {
	if coupon == nil || !coupon.IsActive || coupon.DiscountPercent <= 0 {
		return 0, 0, 0
	}

	rate := coupon.DiscountPercent / 100.0
	discountAmount = math.Round(math.Max(0, subtotal)*rate*100) / 100

	if coupon.AppliesToShipping && shipping > 0 {
		shippingDiscount = math.Round(math.Max(0, shipping)*rate*100) / 100
	}

	totalDiscount = discountAmount + shippingDiscount
	return discountAmount, shippingDiscount, totalDiscount
}
