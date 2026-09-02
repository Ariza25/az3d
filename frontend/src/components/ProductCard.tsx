import React from 'react';
import { Product } from '../types';
import { ShoppingBag, Layers, Maximize2, Star } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { getAvailableColors, getColorVisual, getDefaultColor, getStockStatus, getStoreVariantProduct, money } from '../shared/storePresentation';

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
  const defaultColor = getDefaultColor(product);
  const defaultProduct = getStoreVariantProduct(product, defaultColor);

  return (
    <article className="glass-card group flex h-full flex-col overflow-hidden rounded-2xl border border-chumbo-800 transition-all duration-300 hover:border-chumbo-600">
      <div
        className="relative aspect-square cursor-pointer overflow-hidden bg-chumbo-950"
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

      <div className="flex flex-1 flex-col p-5">
        <div className="flex-1">
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
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-400">
            {product.description}
          </p>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 text-[11px] font-mono text-slate-500">
          <span className="truncate">{product.category?.name || 'Catálogo'}</span>
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
            {colors.length === 1 && <span className="ml-2 text-slate-500">{colors[0]}</span>}
            {colors.length === 0 && <span className="text-slate-500">Cor padrao</span>}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 border-t border-chumbo-800 pt-4">
          <div className="min-w-0">
            <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block">
              {product.store_variants?.some((variant) => variant.price !== product.price) ? 'A partir de' : 'Preço'}
            </span>
            <span className="block whitespace-nowrap text-xl font-extrabold text-white">{money(product.price)}</span>
          </div>

          <button
            onClick={() => addToCart(defaultProduct, 1, defaultColor)}
            disabled={!stockStatus.canBuy}
            className="flex h-11 items-center space-x-2 rounded-xl bg-white px-4 text-chumbo-950 shadow-md transition-all hover:bg-slate-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <ShoppingBag className="w-4 h-4" />
            <span className="text-xs font-extrabold">{stockStatus.canBuy ? 'Adicionar' : 'Indisponível'}</span>
          </button>
        </div>
      </div>
    </article>
  );
};
