import React from 'react';
import { Flame, ChevronLeft, ChevronRight } from 'lucide-react';
import { Product } from '../../../types';
import {
  extractProductDimensions,
  money,
  optimizeImageUrl,
} from '../../../shared/storePresentation';

export interface CatalogSpotlightCarouselProps {
  products: Product[];
  activeCarouselIndex: number;
  canScrollLeft: boolean;
  canScrollRight: boolean;
  visibleCards: number;
  carouselRef: React.RefObject<HTMLDivElement>;
  onScroll: () => void;
  onScrollDirection: (direction: 'left' | 'right') => void;
  onScrollToIndex: (index: number) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onTouchStart: () => void;
  onTouchEnd: () => void;
  onSelectProduct: (product: Product) => void;
}

export const CatalogSpotlightCarousel: React.FC<CatalogSpotlightCarouselProps> = ({
  products,
  activeCarouselIndex,
  canScrollLeft,
  canScrollRight,
  visibleCards,
  carouselRef,
  onScroll,
  onScrollDirection,
  onScrollToIndex,
  onMouseEnter,
  onMouseLeave,
  onTouchStart,
  onTouchEnd,
  onSelectProduct,
}) => {
  if (products.length === 0) return null;

  const totalDots = Math.max(1, products.length - visibleCards + 1);

  return (
    <section className="space-y-3 sm:space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-500/15 text-amber-500 border border-amber-500/20">
            <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />
          </div>
          <div>
            <h3 className="text-sm sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
              Destaques da Coleção
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
              Peças mais procuradas e recomendadas para você
            </p>
          </div>
        </div>

        {/* Controles de Navegação do Carrossel */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => onScrollDirection('left')}
            disabled={!canScrollLeft}
            className={`p-2 rounded-xl border transition-all ${
              canScrollLeft
                ? 'bg-white dark:bg-chumbo-900 border-slate-300 dark:border-chumbo-700 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-chumbo-800 shadow-sm active:scale-95'
                : 'bg-slate-100 dark:bg-chumbo-900/40 border-slate-200 dark:border-chumbo-800 text-slate-400 dark:text-slate-600 opacity-40 cursor-not-allowed'
            }`}
            title="Anterior"
            aria-label="Item anterior do carrossel"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onScrollDirection('right')}
            disabled={!canScrollRight}
            className={`p-2 rounded-xl border transition-all ${
              canScrollRight
                ? 'bg-white dark:bg-chumbo-900 border-slate-300 dark:border-chumbo-700 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-chumbo-800 shadow-sm active:scale-95'
                : 'bg-slate-100 dark:bg-chumbo-900/40 border-slate-200 dark:border-chumbo-800 text-slate-400 dark:text-slate-600 opacity-40 cursor-not-allowed'
            }`}
            title="Próximo"
            aria-label="Próximo item do carrossel"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Trilho do Carrossel com Snap suave e Rotação Automática */}
      <div
        ref={carouselRef}
        onScroll={onScroll}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className="flex gap-3 sm:gap-4 overflow-x-auto pb-3 pt-1 no-scrollbar scroll-smooth snap-x snap-mandatory touch-pan-x -mx-1 px-1"
      >
        {products.map((product) => {
          const cover = optimizeImageUrl(product.color_images?.[0]?.image_url || product.image_url);
          const dim = extractProductDimensions(product);

          return (
            <div
              key={`spotlight-${product.id}`}
              onClick={() => onSelectProduct(product)}
              className="carousel-spotlight-item w-[78vw] min-[420px]:w-[65vw] sm:w-[calc(50%-10px)] md:w-[calc(33.333%-12px)] lg:w-[calc(25%-12px)] shrink-0 snap-start group relative cursor-pointer overflow-hidden rounded-2xl border border-slate-200/90 dark:border-chumbo-800 bg-white dark:bg-chumbo-900/70 p-2.5 sm:p-3 hover:border-cyan-500/50 dark:hover:border-cyan-500/40 transition-all duration-300 shadow-sm hover:shadow-xl hover:-translate-y-0.5"
            >
              <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-slate-100 dark:bg-chumbo-950">
                <img
                  src={cover}
                  alt={product.title}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>

              <div className="mt-2 space-y-1">
                <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-cyan-600 dark:group-hover:text-cyan-300 transition-colors">
                  {product.title}
                </h4>
                {dim && (
                  <p className="text-xs sm:text-[13px] font-medium text-slate-700 dark:text-slate-300 truncate">
                    Dimensões do produto: <span className="font-bold text-slate-900 dark:text-slate-100">{dim}</span>
                  </p>
                )}
                <div className="flex items-baseline gap-1.5 pt-0.5">
                  <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Preço:</span>
                  <span className="text-base sm:text-lg lg:text-xl font-black text-cyan-700 dark:text-cyan-400">
                    {money(product.price)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Indicador de Bolinhas do Carrossel */}
      {totalDots > 1 && (
        <div className="flex items-center justify-center gap-1.5 pt-1">
          {Array.from({ length: totalDots }).map((_, idx) => (
            <button
              key={`spotlight-dot-${idx}`}
              type="button"
              onClick={() => onScrollToIndex(idx)}
              className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                activeCarouselIndex === idx
                  ? 'w-6 bg-cyan-600 dark:bg-cyan-400'
                  : 'w-1.5 bg-slate-300 dark:bg-chumbo-700 hover:bg-slate-400 dark:hover:bg-chumbo-600'
              }`}
              aria-label={`Ir para posição de destaque ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  );
};
