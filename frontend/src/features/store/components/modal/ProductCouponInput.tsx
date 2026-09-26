import React from 'react';
import { Tag, X } from 'lucide-react';
import { ValidateCouponResponse } from '../../../../types';

interface ProductCouponInputProps {
  couponInput: string;
  appliedCoupon: ValidateCouponResponse | null;
  couponLoading: boolean;
  couponMessage: { type: 'success' | 'error'; text: string } | null;
  onCouponInputChange: (value: string) => void;
  onApplyCoupon: (e?: React.FormEvent) => void;
  onRemoveCoupon: () => void;
}

export const ProductCouponInput: React.FC<ProductCouponInputProps> = ({
  couponInput,
  appliedCoupon,
  couponLoading,
  couponMessage,
  onCouponInputChange,
  onApplyCoupon,
  onRemoveCoupon,
}) => {
  return (
    <div className="border-t border-chumbo-800 pt-3">
      {!appliedCoupon ? (
        <form onSubmit={onApplyCoupon} className="flex gap-2">
          <div className="relative flex-1">
            <Tag className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              value={couponInput}
              onChange={(e) => onCouponInputChange(e.target.value.toUpperCase())}
              placeholder="Cupom de desconto (ex: PROMO10)"
              className="w-full rounded-xl border border-chumbo-700 bg-chumbo-900 py-2 pl-9 pr-3 text-xs uppercase text-white placeholder-slate-500 focus:border-laser-400 focus:outline-none font-mono"
            />
          </div>
          <button
            type="submit"
            disabled={couponLoading || !couponInput.trim()}
            className="rounded-xl border border-laser-400/40 bg-laser-400/10 px-3.5 py-2 text-xs font-bold text-laser-300 hover:bg-laser-400/20 disabled:opacity-40"
          >
            {couponLoading ? '...' : 'Aplicar'}
          </button>
        </form>
      ) : (
        <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-300">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-emerald-400" />
            <div>
              <span className="font-mono font-bold">{appliedCoupon.code}</span> ({appliedCoupon.discount_percent}% OFF)
              {appliedCoupon.applies_to_shipping && (
                <span className="ml-1 text-[10px] text-emerald-400 font-semibold">• Válido no frete</span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onRemoveCoupon}
            className="rounded p-1 text-slate-400 hover:bg-emerald-500/20 hover:text-white"
            aria-label="Remover cupom"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {couponMessage && (
        <p
          className={`mt-1.5 text-[11px] ${
            couponMessage.type === 'error' ? 'text-rose-400' : 'text-emerald-400'
          }`}
        >
          {couponMessage.text}
        </p>
      )}
    </div>
  );
};
