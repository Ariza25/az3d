import React from 'react';
import { ArrowRight, Sparkles, Tag } from 'lucide-react';
import { ValidateCouponResponse } from '../../../types';
import { money } from '../../../shared/storePresentation';
import { CartCouponBar } from './CartCouponBar';

interface CartPriceSummaryProps {
  checkoutStep: 'items' | 'delivery';
  totalItems: number;
  rawSubtotal: number;
  totalWholesaleDiscount: number;
  couponProductDiscount: number;
  couponShippingDiscount: number;
  freightAmount: number;
  finalFreight: number;
  cartGrandTotal: number;
  totalDiscountAll: number;
  selectedFreight: { name: string; price: number } | null;
  deliveryMethod: 'shipping' | 'pickup';
  canSubmit: boolean;
  isSubmitting: boolean;
  paymentMethod: 'pix' | 'credit_card';
  appliedCoupon: ValidateCouponResponse | null;
  couponInput: string;
  couponLoading: boolean;
  couponMessage: { type: 'success' | 'error'; text: string } | null;
  onCouponInputChange: (val: string) => void;
  onApplyCoupon: (e?: React.FormEvent) => void;
  onRemoveCoupon: () => void;
  onContinueToDelivery: () => void;
  onCheckout: () => void;
  onContinueShopping: () => void;
  isAuthenticated: boolean;
}

export const CartPriceSummary: React.FC<CartPriceSummaryProps> = ({
  checkoutStep,
  totalItems,
  rawSubtotal,
  totalWholesaleDiscount,
  couponProductDiscount,
  couponShippingDiscount,
  freightAmount,
  finalFreight,
  cartGrandTotal,
  totalDiscountAll,
  selectedFreight,
  deliveryMethod,
  canSubmit,
  isSubmitting,
  paymentMethod,
  appliedCoupon,
  couponInput,
  couponLoading,
  couponMessage,
  onCouponInputChange,
  onApplyCoupon,
  onRemoveCoupon,
  onContinueToDelivery,
  onCheckout,
  onContinueShopping,
  isAuthenticated,
}) => {
  if (checkoutStep === 'items') {
    return (
      <footer className="space-y-3.5 border-t border-chumbo-800 bg-chumbo-900/90 px-5 py-5 sm:px-7">
        <CartCouponBar
          couponInput={couponInput}
          appliedCoupon={appliedCoupon}
          couponLoading={couponLoading}
          couponMessage={couponMessage}
          onCouponInputChange={onCouponInputChange}
          onApplyCoupon={onApplyCoupon}
          onRemoveCoupon={onRemoveCoupon}
        />

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Subtotal produtos ({totalItems} {totalItems === 1 ? 'item' : 'itens'})</span>
            <span className="font-mono text-slate-300">{money(rawSubtotal)}</span>
          </div>
          {totalWholesaleDiscount > 0 && (
            <div className="flex items-center justify-between text-xs text-emerald-400">
              <span className="flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                Desconto de Atacado
              </span>
              <span className="font-mono font-semibold">-{money(totalWholesaleDiscount)}</span>
            </div>
          )}
          {couponProductDiscount > 0 && (
            <div className="flex items-center justify-between text-xs text-emerald-400">
              <span className="flex items-center gap-1">
                <Tag className="h-3 w-3" />
                Cupom ({appliedCoupon?.code})
              </span>
              <span className="font-mono font-semibold">-{money(couponProductDiscount)}</span>
            </div>
          )}
          {selectedFreight && (
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Frete ({selectedFreight.name})</span>
              <span className="font-mono font-bold text-laser-400">
                {couponShippingDiscount > 0 ? (
                  <>
                    <span className="line-through text-slate-500 mr-1">{money(freightAmount)}</span>
                    <span>{money(finalFreight)}</span>
                  </>
                ) : (
                  money(selectedFreight.price)
                )}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between pt-2 border-t border-chumbo-800">
            <div>
              <span className="text-sm font-bold text-slate-200">Subtotal com frete</span>
              {totalDiscountAll > 0 && (
                <span className="block text-[11px] font-semibold text-emerald-400">
                  Economia: {money(totalDiscountAll)}
                </span>
              )}
            </div>
            <span className="text-2xl font-extrabold text-white">{money(cartGrandTotal)}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onContinueToDelivery}
          disabled={!canSubmit}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 py-3.5 text-sm font-extrabold shadow-xl transition-colors disabled:opacity-50"
        >
          <span>{isAuthenticated ? 'Continuar para entrega' : 'Entrar para continuar'}</span>
          <ArrowRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onContinueShopping}
          className="w-full text-xs font-semibold text-slate-400 transition-colors hover:text-white"
        >
          Continuar comprando
        </button>
      </footer>
    );
  }

  return (
    <footer className="border-t border-chumbo-850 bg-chumbo-900/90 px-5 py-5 sm:px-7 space-y-2.5">
      <CartCouponBar
        couponInput={couponInput}
        appliedCoupon={appliedCoupon}
        couponLoading={couponLoading}
        couponMessage={couponMessage}
        onCouponInputChange={onCouponInputChange}
        onApplyCoupon={onApplyCoupon}
        onRemoveCoupon={onRemoveCoupon}
      />

      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>Subtotal produtos</span>
        <span className="font-mono font-semibold text-white">{money(rawSubtotal)}</span>
      </div>
      {totalWholesaleDiscount > 0 && (
        <div className="flex items-center justify-between text-xs text-emerald-400">
          <span className="flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            Desconto de Atacado
          </span>
          <span className="font-mono font-semibold">-{money(totalWholesaleDiscount)}</span>
        </div>
      )}
      {couponProductDiscount > 0 && (
        <div className="flex items-center justify-between text-xs text-emerald-400">
          <span className="flex items-center gap-1">
            <Tag className="h-3 w-3" />
            Cupom ({appliedCoupon?.code})
          </span>
          <span className="font-mono font-semibold">-{money(couponProductDiscount)}</span>
        </div>
      )}
      {deliveryMethod === 'shipping' && (
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Frete ({selectedFreight?.name || 'A definir'})</span>
          <span className="font-mono font-bold text-laser-400">
            {selectedFreight ? (
              couponShippingDiscount > 0 ? (
                <>
                  <span className="line-through text-slate-500 mr-1">{money(freightAmount)}</span>
                  <span>{money(finalFreight)}</span>
                </>
              ) : (
                money(selectedFreight.price)
              )
            ) : (
              'Grátis / A calcular'
            )}
          </span>
        </div>
      )}
      <div className="flex items-center justify-between pt-2 border-t border-chumbo-800">
        <div>
          <span className="text-sm font-bold text-slate-200">Total do pedido</span>
          {totalDiscountAll > 0 && (
            <span className="block text-[11px] font-semibold text-emerald-400">
              Economia: {money(totalDiscountAll)}
            </span>
          )}
        </div>
        <span className="text-2xl font-extrabold text-white">{money(cartGrandTotal)}</span>
      </div>
      <button
        type="button"
        onClick={onCheckout}
        disabled={isSubmitting || !canSubmit}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-laser-400 to-emerald-400 py-3.5 text-sm font-extrabold text-chumbo-950 shadow-xl shadow-laser-500/10 transition-all hover:from-laser-300 hover:to-emerald-300 disabled:opacity-50"
      >
        <span>
          {isSubmitting
            ? 'Processando pagamento...'
            : paymentMethod === 'pix'
            ? `Gerar PIX e Pagar (${money(cartGrandTotal)})`
            : `Pagar com Cartão (${money(cartGrandTotal)})`}
        </span>
        <ArrowRight className="h-4 w-4" />
      </button>
      <p className="mt-2 text-center text-[10px] leading-4 text-slate-500">
        Processado com segurança via Checkout Transparente.
      </p>
    </footer>
  );
};
