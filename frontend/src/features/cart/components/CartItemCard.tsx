import React from 'react';
import { Layers, Minus, Plus, Trash2 } from 'lucide-react';
import { Product } from '../../../types';
import { money } from '../../../shared/storePresentation';

export interface CartItemWithPricing {
  product: Product;
  quantity: number;
  color: string;
  wholesale: {
    percent: number;
    badge: string | null;
  };
  discountedUnit: number;
  itemDiscount: number;
  itemFinal: number;
}

interface CartItemCardProps {
  item: CartItemWithPricing;
  onUpdateQuantity: (productId: number, color: string, qty: number) => void;
  onRemoveItem: (productId: number, color: string) => void;
}

export const CartItemCard: React.FC<CartItemCardProps> = ({
  item,
  onUpdateQuantity,
  onRemoveItem,
}) => {
  const imageUrl =
    item.product.color_images?.find((img) => img.color_name === item.color)?.image_url ||
    item.product.image_url;

  return (
    <article className="rounded-2xl border border-chumbo-800 bg-chumbo-900/65 p-2.5 sm:p-4">
      <div className="flex gap-3 sm:gap-4">
        <img
          src={imageUrl}
          alt={item.product.title}
          className="h-20 w-20 sm:h-28 sm:w-28 shrink-0 rounded-xl border border-chumbo-700 object-cover"
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2 sm:gap-3">
            <div className="min-w-0">
              <h4 className="line-clamp-2 text-xs sm:text-base font-bold leading-snug sm:leading-5 text-white">
                {item.product.title}
              </h4>
              <span className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
                <Layers className="h-3.5 w-3.5 text-laser-400" />
                {item.color}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onRemoveItem(item.product.id, item.color)}
              className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
              aria-label={`Remover ${item.product.title}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          {/* Preço Unitário & Desconto Atacado */}
          {item.wholesale.percent > 0 ? (
            <div className="mt-1.5 flex items-center gap-2 flex-wrap">
              <span className="line-through text-xs text-slate-500">{money(item.product.price)}</span>
              <span className="text-xs font-bold text-emerald-400">{money(item.discountedUnit)} cada</span>
              <span className="rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-extrabold text-emerald-300">
                -{item.wholesale.percent}% Atacado
              </span>
            </div>
          ) : (
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-xs text-slate-400">{money(item.product.price)} cada</span>
              <span className="text-[10px] text-laser-400 font-medium">3+ un ganha atacado</span>
            </div>
          )}

          <div className="mt-2.5 sm:mt-3 flex items-end justify-between gap-2 sm:gap-3">
            <div
              className="flex h-8 sm:h-10 items-center rounded-xl border border-chumbo-700 bg-chumbo-950"
              aria-label={`Quantidade de ${item.product.title}`}
            >
              <button
                type="button"
                onClick={() => onUpdateQuantity(item.product.id, item.color, item.quantity - 1)}
                className="flex h-full w-8 sm:w-10 items-center justify-center text-slate-400 transition-colors hover:text-white"
                aria-label={`Diminuir quantidade de ${item.product.title}`}
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="min-w-6 sm:min-w-7 text-center font-mono text-xs sm:text-sm font-bold text-white">
                {item.quantity}
              </span>
              <button
                type="button"
                onClick={() => onUpdateQuantity(item.product.id, item.color, item.quantity + 1)}
                className="flex h-full w-8 sm:w-10 items-center justify-center text-slate-400 transition-colors hover:text-white"
                aria-label={`Aumentar quantidade de ${item.product.title}`}
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="text-right shrink-0">
              <span className="block text-[10px] uppercase tracking-wider text-slate-500">Subtotal</span>
              {item.wholesale.percent > 0 ? (
                <div>
                  <span className="line-through text-xs text-slate-500 block leading-tight">
                    {money(item.product.price * item.quantity)}
                  </span>
                  <strong className="block text-base font-extrabold text-emerald-400">
                    {money(item.itemFinal)}
                  </strong>
                </div>
              ) : (
                <strong className="mt-0.5 block text-base font-extrabold text-white">
                  {money(item.product.price * item.quantity)}
                </strong>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
};
