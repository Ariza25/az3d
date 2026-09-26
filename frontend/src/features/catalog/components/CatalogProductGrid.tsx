import React from 'react';
import { Layers, Loader2 } from 'lucide-react';
import { Product } from '../../../types';
import { CatalogProductCard } from './CatalogProductCard';
import {
  extractProductDimensions,
  getStockStatus,
  money,
  optimizeImageUrl,
} from '../../../shared/storePresentation';

export interface CatalogProductGridProps {
  products: Product[];
  viewMode: 'grid' | 'compact';
  isLoading: boolean;
  isLoadingMore: boolean;
  hasFilterActive: boolean;
  onOpenDetail: (product: Product, initialImageIndex?: number) => void;
  onClearFilters: () => void;
  sentinelRef: React.RefObject<HTMLDivElement>;
}

export const CatalogProductGrid: React.FC<CatalogProductGridProps> = ({
  products,
  viewMode,
  isLoading,
  isLoadingMore,
  hasFilterActive,
  onOpenDetail,
  onClearFilters,
  sentinelRef,
}) => {
  if (isLoading && products.length === 0) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-4 lg:gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="animate-pulse rounded-2xl border border-slate-200 dark:border-chumbo-800 bg-white/60 dark:bg-chumbo-900/40 p-2.5 sm:p-3 space-y-2.5 sm:space-y-3"
          >
            <div className="aspect-square w-full rounded-xl bg-slate-200 dark:bg-chumbo-800/60" />
            <div className="h-4 w-3/4 rounded bg-slate-200 dark:bg-chumbo-800/60" />
            <div className="h-4 w-1/3 rounded bg-slate-200 dark:bg-chumbo-800/60" />
          </div>
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="py-16 sm:py-20 text-center space-y-3 border border-dashed border-slate-300 dark:border-chumbo-800 rounded-3xl p-6 sm:p-8 bg-white/50 dark:bg-chumbo-900/20">
        <Layers className="w-10 h-10 sm:w-12 sm:h-12 text-slate-400 dark:text-slate-600 mx-auto" />
        <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
          {hasFilterActive ? 'Nenhum item encontrado' : 'Nenhum produto cadastrado nesta loja'}
        </h3>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
          {hasFilterActive
            ? 'Tente buscar por outro termo ou mude os filtros de categoria e material.'
            : 'Esta loja ainda não possui produtos ativos disponíveis no catálogo.'}
        </p>
        {hasFilterActive && (
          <button
            type="button"
            onClick={onClearFilters}
            className="mt-2 px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white dark:bg-chumbo-800 dark:hover:bg-chumbo-700 shadow-sm cursor-pointer"
          >
            Limpar filtros
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      {viewMode === 'grid' ? (
        /* Grade Visual Ampla (Mobile: 1 coluna para não quebrar / Tablet: 2-3 colunas / PC: 4 colunas) */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-4 lg:gap-6">
          {products.map((product) => (
            <CatalogProductCard
              key={product.id}
              product={product}
              onOpenDetail={onOpenDetail}
            />
          ))}

          {/* Esqueletos de loading das novas peças para o scroll infinito (Grade) */}
          {isLoadingMore && (
            <>
              {Array.from({ length: 4 }).map((_, idx) => (
                <div
                  key={`loading-more-card-${idx}`}
                  className="flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 dark:border-chumbo-800/80 bg-white/70 dark:bg-chumbo-900/40 p-2.5 sm:p-3 space-y-2.5 sm:space-y-3 animate-pulse"
                >
                  <div className="relative aspect-square w-full rounded-xl bg-slate-200/80 dark:bg-chumbo-800/60 flex items-center justify-center">
                    {idx === 0 && (
                      <Loader2 className="w-7 h-7 text-cyan-500 animate-spin" />
                    )}
                  </div>
                  <div className="h-4 w-3/4 rounded bg-slate-200/80 dark:bg-chumbo-800/60" />
                  <div className="h-4 w-1/3 rounded bg-slate-200/80 dark:bg-chumbo-800/60" />
                </div>
              ))}
            </>
          )}
        </div>
      ) : (
        /* Lista Compacta */
        <div className="space-y-2">
          {products.map((product) => {
            const cover = optimizeImageUrl(product.color_images?.[0]?.image_url || product.image_url);
            const status = getStockStatus(product);
            const dim = extractProductDimensions(product);

            return (
              <div
                key={product.id}
                onClick={() => onOpenDetail(product, 0)}
                className="group flex items-center justify-between gap-2.5 sm:gap-3 p-2.5 sm:p-3 rounded-2xl border border-slate-200/90 dark:border-chumbo-800 bg-white dark:bg-chumbo-900/40 hover:bg-slate-50 dark:hover:bg-chumbo-900/80 hover:border-slate-300 dark:hover:border-chumbo-700 transition-all cursor-pointer shadow-xs"
              >
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                  <img
                    src={cover}
                    alt={product.title}
                    loading="lazy"
                    decoding="async"
                    className="h-14 w-14 sm:h-16 sm:w-16 rounded-xl object-cover bg-slate-100 dark:bg-chumbo-950 border border-slate-200 dark:border-chumbo-800 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-cyan-600 dark:group-hover:text-cyan-300">
                      {product.title}
                    </h4>
                    {dim && (
                      <p className="text-[11px] sm:text-[13px] font-medium text-slate-700 dark:text-slate-300 truncate">
                        Dimensões do produto: <span className="font-bold text-slate-900 dark:text-slate-100">{dim}</span>
                      </p>
                    )}
                    <span className={`inline-block mt-0.5 px-2 py-0.2 rounded-md text-[9px] font-bold border ${status.tone}`}>
                      {status.label}
                    </span>
                  </div>
                </div>

                <div className="shrink-0 text-right pl-2">
                  <span className="text-[10px] sm:text-xs font-bold uppercase text-slate-500 dark:text-slate-400 block">Preço:</span>
                  <span className="text-sm sm:text-lg font-black text-cyan-700 dark:text-cyan-400">
                    {money(product.price)}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Esqueleto de loading na lista compacta */}
          {isLoadingMore && (
            <div className="flex items-center gap-3 p-4 rounded-2xl border border-slate-200/80 dark:border-chumbo-800/80 bg-white/70 dark:bg-chumbo-900/40 animate-pulse">
              <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-xl bg-slate-200/80 dark:bg-chumbo-800/60 flex items-center justify-center shrink-0">
                <Loader2 className="w-5 h-5 text-cyan-500 animate-spin" />
              </div>
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/2 rounded bg-slate-200/80 dark:bg-chumbo-800/60" />
                <div className="h-3 w-1/4 rounded bg-slate-200/80 dark:bg-chumbo-800/60" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Loading de Paginação no Scroll Sentinel */}
      <div ref={sentinelRef} className={`flex flex-col items-center justify-center ${isLoadingMore ? 'py-6 min-h-[90px]' : 'py-2 min-h-[20px]'}`}>
        {isLoadingMore && (
          <div className="flex items-center gap-3 py-3 px-5 rounded-2xl bg-white dark:bg-chumbo-900 border border-slate-200 dark:border-chumbo-700/80 text-cyan-600 dark:text-cyan-400 shadow-md animate-in fade-in duration-200">
            <Loader2 className="w-5 h-5 animate-spin text-cyan-500" />
            <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
              Carregando mais peças...
            </span>
          </div>
        )}
      </div>
    </>
  );
};
