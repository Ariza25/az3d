import React from 'react';
import { ArrowRight, ShoppingBag } from 'lucide-react';
import { money } from '../../../shared/storePresentation';

interface MobileCartBarProps {
  totalItems: number;
  totalPrice: number;
  onOpenCart: () => void;
}

export const MobileCartBar: React.FC<MobileCartBarProps> = ({
  totalItems,
  totalPrice,
  onOpenCart,
}) => {
  if (totalItems <= 0) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-40 sm:hidden">
      <button
        type="button"
        onClick={onOpenCart}
        className="flex w-full items-center justify-between rounded-2xl border border-laser-500/40 bg-chumbo-950/95 p-3.5 shadow-2xl backdrop-blur-md transition-all active:scale-[0.98]"
        aria-label={`Ver carrinho com ${totalItems} itens, total ${money(totalPrice)}`}
      >
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-laser-400 text-chumbo-950">
            <ShoppingBag className="h-5 w-5 stroke-[2.2]" />
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-extrabold text-chumbo-950 shadow">
              {totalItems}
            </span>
          </div>
          <div className="text-left">
            <p className="text-xs font-bold text-slate-300">Ver carrinho</p>
            <p className="text-sm font-extrabold text-white">{money(totalPrice)}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-xl bg-laser-400 px-3.5 py-2 text-xs font-extrabold text-chumbo-950">
          <span>Checkout</span>
          <ArrowRight className="h-4 w-4" />
        </div>
      </button>
    </div>
  );
};
