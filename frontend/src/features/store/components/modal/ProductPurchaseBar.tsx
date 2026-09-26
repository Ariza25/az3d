import React from 'react';
import { Minus, Plus, ShoppingBag } from 'lucide-react';
import { money } from '../../../../shared/storePresentation';

interface ProductPurchaseBarProps {
  finalTotal: number;
  selectedPrice: number;
  unitPrice: number;
  quantity: number;
  stockLimit: number;
  isAuthenticated: boolean;
  wholesalePercent: number;
  wholesaleDiscount: number;
  couponProductDiscount: number;
  couponShippingDiscount: number;
  freightPrice: number;
  finalFreight: number;
  selectedFreight: { name: string; price: number } | null;
  onQuantityChange: (qty: number) => void;
  onAddToCart: () => void;
}

export const ProductPurchaseBar: React.FC<ProductPurchaseBarProps> = ({
  finalTotal,
  selectedPrice,
  unitPrice,
  quantity,
  stockLimit,
  isAuthenticated,
  wholesalePercent,
  wholesaleDiscount,
  couponProductDiscount,
  couponShippingDiscount,
  freightPrice,
  finalFreight,
  selectedFreight,
  onQuantityChange,
  onAddToCart,
}) => {
  return (
    <div className="border-t border-chumbo-800 pt-4">
      <div className="grid grid-cols-[1fr_auto] items-end gap-3 sm:gap-4 lg:grid-cols-[minmax(140px,1fr)_auto_minmax(180px,1.2fr)]">
        <div aria-live="polite" aria-label="Total da compra">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total</span>
          <span className="mt-1 block whitespace-nowrap text-2xl sm:text-3xl font-extrabold text-white">
            {money(finalTotal)}
          </span>
          <div className="mt-1 flex flex-col gap-0.5 text-[11px] text-slate-400">
            {wholesalePercent > 0 ? (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="line-through text-slate-500">{money(selectedPrice)}</span>
                <span className="font-bold text-emerald-400">{money(unitPrice)} un</span>
                <span className="rounded bg-emerald-500/20 px-1 py-0.2 text-[10px] font-bold text-emerald-400">
                  -{wholesalePercent}%
                </span>
              </div>
            ) : (
              quantity > 1 && <span>{quantity} × {money(selectedPrice)} cada</span>
            )}
            {wholesaleDiscount > 0 && (
              <span className="text-emerald-400 font-semibold">Atacado: -{money(wholesaleDiscount)}</span>
            )}
            {couponProductDiscount > 0 && (
              <span className="text-emerald-400 font-semibold">Cupom: -{money(couponProductDiscount)}</span>
            )}
            {selectedFreight && (
              <span className="font-mono text-laser-400 font-bold">
                + Frete ({selectedFreight.name}):{' '}
                {couponShippingDiscount > 0 ? (
                  <>
                    <span className="line-through text-slate-500 mr-1">{money(freightPrice)}</span>
                    <span>{money(finalFreight)}</span>
                  </>
                ) : (
                  money(selectedFreight.price)
                )}
              </span>
            )}
          </div>
        </div>

        <div className="flex h-11 items-center rounded-xl border border-chumbo-700 bg-chumbo-900 p-1" aria-label="Quantidade">
          <button
            type="button"
            onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-chumbo-800 hover:text-white"
            aria-label="Diminuir quantidade"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-8 text-center text-sm font-bold text-white">{quantity}</span>
          <button
            type="button"
            onClick={() => onQuantityChange(Math.min(stockLimit || 1, quantity + 1))}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-chumbo-800 hover:text-white"
            aria-label="Aumentar quantidade"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={onAddToCart}
          disabled={stockLimit <= 0}
          className="col-span-2 flex h-11 sm:h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-extrabold text-chumbo-950 shadow-xl transition hover:bg-slate-200 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 lg:col-span-1"
        >
          <ShoppingBag className="h-4 w-4" />
          {stockLimit > 0 ? (isAuthenticated ? 'Adicionar' : 'Entrar para comprar') : 'Sem estoque'}
        </button>
      </div>
    </div>
  );
};
