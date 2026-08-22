import React from 'react';
import { Product } from '../types';
import { ShoppingBag, Layers, Maximize2, Star } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { getAvailableColors, getColorVisual, getDefaultColor, getStockStatus, money } from '../shared/storePresentation';

interface ProductCardProps {
  product: Product;
  onOpenModal: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onOpenModal }) => {
  const { addToCart } = useCart();
  const coverImage = product.color_images?.[0]?.image_url || product.image_url;
  const stockStatus = getStockStatus(product);
  const colors = getAvailableColors(product).slice(0, 5);
  const rating = product.review_summary?.average_rating || product.rating;
  const reviewCount = product.review_summary?.review_count || product.review_count || 0;

  return (
    <div className="glass-card rounded-xl overflow-hidden group flex flex-col justify-between border border-chumbo-800 hover:border-chumbo-600 transition-all duration-300">
      <div
        className="relative h-64 overflow-hidden bg-chumbo-950 cursor-pointer"
        onClick={() => onOpenModal(product)}
      >
        <img
          src={coverImage}
          alt={product.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-chumbo-950 via-transparent to-transparent opacity-80" />

        <div className="absolute top-3 left-3 flex flex-col gap-2">
          <div className={`border px-2.5 py-1 rounded-lg text-[11px] font-bold ${stockStatus.tone}`}>
            {stockStatus.label}
          </div>
          <div className="bg-chumbo-950/80 backdrop-blur-md border border-chumbo-700/80 px-2.5 py-1 rounded-lg flex items-center space-x-1.5 text-[11px] font-mono text-slate-200">
            <Layers className="w-3.5 h-3.5 text-laser-400" />
            <span>{product.material}</span>
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenModal(product);
          }}
          className="absolute top-3 right-3 p-2 rounded-xl bg-chumbo-950/80 hover:bg-chumbo-800 text-slate-300 hover:text-white border border-chumbo-700/80 opacity-0 group-hover:opacity-100 transition-all duration-200"
          title="Ver detalhes do produto"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
        <div>
          <h3
            onClick={() => onOpenModal(product)}
            className="text-base font-bold text-white group-hover:text-slate-200 transition-colors line-clamp-1 cursor-pointer"
          >
            {product.title}
          </h3>
          <div className="mt-1 flex items-center justify-between gap-3">
            <span className="text-[11px] font-mono uppercase text-slate-500">SKU {product.sku || product.slug}</span>
            {rating && reviewCount > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-300">
                <Star className="h-3.5 w-3.5 fill-amber-300" />
                {rating.toFixed(1)}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
            {product.description}
          </p>
        </div>

        <div className="flex items-center justify-between gap-3 text-[11px] font-mono text-slate-400 bg-chumbo-900/80 px-3 py-2 rounded-xl border border-chumbo-800">
          <span className="truncate">{product.category?.name || 'Catalogo'}</span>
          <div className="flex items-center -space-x-1.5">
            {colors.map((color) => {
              const visual = getColorVisual(color);
              return (
                <span
                  key={color}
                  title={color}
                  className="h-4 w-4 rounded-full border border-chumbo-950 ring-1 ring-chumbo-700"
                  style={{ backgroundColor: visual.hex, borderColor: visual.border }}
                />
              );
            })}
            {colors.length === 0 && <span className="text-slate-500">Cor padrao</span>}
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-chumbo-850">
          <div>
            <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block">
              Preco
            </span>
            <span className="text-2xl font-extrabold text-white">{money(product.price)}</span>
          </div>

          <button
            onClick={() => addToCart(product, 1, getDefaultColor(product))}
            disabled={!stockStatus.canBuy}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-200 text-chumbo-950 font-bold text-xs transition-all active:scale-95 shadow-md disabled:cursor-not-allowed disabled:opacity-45"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>{stockStatus.canBuy ? 'Adicionar' : 'Indisponivel'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
