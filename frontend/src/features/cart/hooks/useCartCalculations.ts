import { useMemo } from 'react';
import { ValidateCouponResponse, CartItem } from '../../../types';
import { getWholesaleDiscount } from '../../../shared/storePresentation';
import { CartItemWithPricing } from '../components';

export interface UseCartCalculationsProps {
  cart: CartItem[];
  appliedCoupon: ValidateCouponResponse | null;
  deliveryMethod: 'shipping' | 'pickup';
  selectedFreight: {
    code: string;
    name: string;
    price: number;
    deliveryDays: number;
  } | null;
}

export function useCartCalculations({
  cart,
  appliedCoupon,
  deliveryMethod,
  selectedFreight,
}: UseCartCalculationsProps) {
  const calculations = useMemo(() => {
    let rawSubtotal = 0;
    let totalWholesaleDiscount = 0;

    const itemsWithPricing: CartItemWithPricing[] = cart.map((item) => {
      const wholesale = getWholesaleDiscount(item.quantity);
      const discountedUnit =
        wholesale.percent > 0 ? wholesale.calculateUnitPrice(item.product.price) : item.product.price;
      const itemRaw = item.product.price * item.quantity;
      const itemFinal = discountedUnit * item.quantity;
      const itemDiscount = Math.round((itemRaw - itemFinal) * 100) / 100;

      rawSubtotal += itemRaw;
      totalWholesaleDiscount += itemDiscount;

      return {
        ...item,
        wholesale,
        discountedUnit,
        itemDiscount,
        itemFinal,
      };
    });

    const subtotalAfterWholesale = Math.round((rawSubtotal - totalWholesaleDiscount) * 100) / 100;
    const couponPercent = appliedCoupon?.discount_percent || 0;
    const couponProductDiscount = appliedCoupon
      ? Math.round(subtotalAfterWholesale * (couponPercent / 100) * 100) / 100
      : 0;

    const freightAmount = deliveryMethod === 'shipping' && selectedFreight ? selectedFreight.price : 0;
    const couponShippingDiscount =
      appliedCoupon?.applies_to_shipping && freightAmount > 0
        ? Math.round(freightAmount * (couponPercent / 100) * 100) / 100
        : 0;

    const finalFreight = Math.max(0, freightAmount - couponShippingDiscount);
    const cartGrandTotal =
      Math.round((Math.max(0, subtotalAfterWholesale - couponProductDiscount) + finalFreight) * 100) / 100;
    const totalDiscountAll =
      Math.round((totalWholesaleDiscount + couponProductDiscount + couponShippingDiscount) * 100) / 100;

    return {
      itemsWithPricing,
      rawSubtotal,
      totalWholesaleDiscount,
      subtotalAfterWholesale,
      couponProductDiscount,
      freightAmount,
      couponShippingDiscount,
      finalFreight,
      cartGrandTotal,
      totalDiscountAll,
    };
  }, [cart, appliedCoupon, deliveryMethod, selectedFreight]);

  const installmentOptions = useMemo(() => {
    const total = calculations.cartGrandTotal;
    const maxInstallments = Math.min(12, Math.max(1, Math.floor(total / 10)));
    const list = [];
    for (let i = 1; i <= Math.max(1, maxInstallments); i++) {
      const val = total / i;
      list.push({
        times: i,
        label: `${i}x de R$ ${val.toFixed(2).replace('.', ',')} ${i === 1 ? 'à vista' : 'sem juros'}`,
      });
    }
    return list;
  }, [calculations.cartGrandTotal]);

  return {
    cartCalculations: calculations,
    cartGrandTotal: calculations.cartGrandTotal,
    installmentOptions,
  };
}
