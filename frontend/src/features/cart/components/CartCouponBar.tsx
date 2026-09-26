import React from 'react';
import { Tag, X } from 'lucide-react';
import { ValidateCouponResponse } from '../../../types';

interface CartCouponBarProps {
  couponInput: string;
  appliedCoupon: ValidateCouponResponse | null;
  couponLoading: boolean;
  couponMessage: { type: 'success' | 'error'; text: string } | null;
  onCouponInputChange: (value: string) => void;
  onApplyCoupon: (e?: React.FormEvent) => void;
  onRemoveCoupon: () => void;
}

export const CartCouponBar: React.FC<CartCouponBarProps> = ({
  couponInput,
  appliedCoupon,
  couponLoading,
  couponMessage,
  onCouponInputChange,
  onApplyCoupon,
  onRemoveCoupon,
}) => {
  return (
    <div className="rounded-xl border border-chumbo-800 bg-chumbo-950/80 p-2.5">
      {!appliedCoupon ? (
        <form onSubmit={onApplyCoupon} className="flex gap-2">
          <div className="relative flex-1">
            <Tag className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              value={couponInput}
              onChange={(e) => onCouponInputChange(e.target.value.toUpperCase())}
              placeholder="Cupom de desconto"
              className="w-full rounded-lg border border-chumbo-700 bg-chumbo-900 py-1.5 pl-8 pr-2 text-xs font-mono uppercase text-white placeholder-slate-500 focus:border-laser-400 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={couponLoading || !couponInput.trim()}
            className="rounded-lg border border-laser-400/40 bg-laser-400/10 px-3 py-1.5 text-xs font-bold text-laser-300 hover:bg-laser-400/20 disabled:opacity-40"
          >
            {couponLoading ? '...' : 'Aplicar'}
          </button>
        </form>
      ) : (
        <div className="flex items-center justify-between text-xs text-emerald-300">
          <div className="flex items-center gap-1.5">
            <Tag className="h-3.5 w-3.5 text-emerald-400" />
            <span className="font-mono font-bold">{appliedCoupon.code}</span>
            <span>(-{appliedCoupon.discount_percent}%)</span>
            {appliedCoupon.applies_to_shipping && (
              <span className="text-[10px] text-emerald-400 font-semibold">• Frete incluso</span>
            )}
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
          className={`mt-1 text-[11px] ${
            couponMessage.type === 'error' ? 'text-rose-400' : 'text-emerald-400'
          }`}
        >
          {couponMessage.text}
        </p>
      )}
    </div>
  );
};
