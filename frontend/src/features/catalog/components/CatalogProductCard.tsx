import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, Star } from 'lucide-react';
import { Product } from '../../../types';
import {
  extractProductDimensions,
  getAvailableColors,
  getColorVisual,
  getStockStatus,
  money,
  optimizeImageUrl,
} from '../../../shared/storePresentation';

// Coleta todas as imagens associadas ao produto (foto principal, fotos de cores e variações irmãs)
export const getProductImages = (product?: Product | null): string[] => {
  if (!product) return [];
  const urls: string[] = [];
  const add = (u?: string) => {
    if (u && !urls.includes(u)) urls.push(u);
  };
  add(product.image_url);
  product.color_images?.forEach((ci) => add(ci.image_url));
  product.store_variants?.forEach((v) => {
    add(v.image_url);
    v.color_images?.forEach((ci) => add(ci.image_url));
  });
  return urls.filter(Boolean);
};

export interface CatalogProductCardProps {
  product: Product;
  onOpenDetail: (product: Product, initialImageIndex?: number) => void;
}

export const CatalogProductCard: React.FC<CatalogProductCardProps> = ({ product, onOpenDetail }) => {
  const images = useMemo(() => getProductImages(product), [product]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const activeImage = optimizeImageUrl(images[currentImageIndex] || images[0] || product.image_url);
  const status = getStockStatus(product);
  const colors = getAvailableColors(product).slice(0, 4);
  const rating = product.review_summary?.average_rating || product.rating;
  const dim = extractProductDimensions(product);

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200/90 dark:border-chumbo-800/90 bg-white dark:bg-chumbo-900/50 hover:border-slate-300 dark:hover:border-chumbo-700 transition-all duration-300 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-black/40">
      {/* Imagem do Produto com Carrossel de Setas estilo Mercado Livre */}
      <div
        className="relative aspect-square w-full cursor-pointer overflow-hidden bg-slate-100 dark:bg-chumbo-950 select-none"
        onClick={() => onOpenDetail(product, currentImageIndex)}
      >
        <img
          src={activeImage}
          alt={product.title}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 dark:from-chumbo-950/80 via-transparent to-transparent opacity-50 pointer-events-none" />

        {/* Badge de Disponibilidade */}
        <div className="absolute left-2.5 top-2.5 z-10 pointer-events-none">
          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${status.tone}`}>
            {status.label}
          </span>
        </div>

        {/* Setas de navegação do carrossel no card (estilo Mercado Livre - giram sem abrir o modal) */}
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={handlePrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white/95 dark:bg-chumbo-900/95 text-slate-800 dark:text-slate-100 flex items-center justify-center shadow-lg hover:bg-white dark:hover:bg-chumbo-800 hover:scale-110 active:scale-95 transition-all opacity-0 group-hover:opacity-100 max-sm:opacity-90 border border-slate-200/80 dark:border-chumbo-700/80 cursor-pointer"
              title="Foto anterior"
              aria-label="Foto anterior"
            >
              <ChevronLeft className="w-4.5 h-4.5" />
            </button>

            <button
              type="button"
              onClick={handleNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white/95 dark:bg-chumbo-900/95 text-slate-800 dark:text-slate-100 flex items-center justify-center shadow-lg hover:bg-white dark:hover:bg-chumbo-800 hover:scale-110 active:scale-95 transition-all opacity-0 group-hover:opacity-100 max-sm:opacity-90 border border-slate-200/80 dark:border-chumbo-700/80 cursor-pointer"
              title="Próxima foto"
              aria-label="Próxima foto"
            >
              <ChevronRight className="w-4.5 h-4.5" />
            </button>

            {/* Indicador de Bolinhas do Card estilo Mercado Livre com Contador Dinâmico */}
            <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-xs pointer-events-none transition-all shadow-sm">
              {images.length <= 6 ? (
                images.map((_, idx) => (
                  <span
                    key={idx}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      currentImageIndex === idx ? 'w-4 bg-white' : 'w-1.5 bg-white/50'
                    }`}
                  />
                ))
              ) : (
                (() => {
                  const maxDots = 5;
                  let start = currentImageIndex - Math.floor(maxDots / 2);
                  if (start < 0) start = 0;
                  if (start + maxDots > images.length) start = Math.max(0, images.length - maxDots);
                  const windowIndices = Array.from({ length: Math.min(maxDots, images.length) }, (_, i) => start + i);

                  return (
                    <>
                      <span className="text-[10px] font-bold text-white/90 font-mono tracking-tight mr-0.5">
                        {currentImageIndex + 1}/{images.length}
                      </span>
                      <div className="flex items-center gap-1">
                        {windowIndices.map((imgIdx) => (
                          <span
                            key={imgIdx}
                            className={`h-1.5 rounded-full transition-all duration-300 ${
                              currentImageIndex === imgIdx ? 'w-3.5 bg-white' : 'w-1.5 bg-white/50'
                            }`}
                          />
                        ))}
                      </div>
                    </>
                  );
                })()
              )}
            </div>
          </>
        )}

        {/* Botão de Zoom/Detalhes Rápido */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenDetail(product, currentImageIndex);
          }}
          className="absolute bottom-2.5 right-2.5 z-20 p-2 rounded-xl bg-white/90 dark:bg-chumbo-950/80 text-slate-700 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-white border border-slate-200/60 dark:border-chumbo-700/80 opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-sm cursor-pointer"
          title="Ver detalhes da peça"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Informações da Peça */}
      <div className="p-3 sm:p-4 flex flex-1 flex-col justify-between space-y-3">
        <div className="space-y-1.5">
          <div className="flex items-start justify-between gap-1">
            <h4
              onClick={() => onOpenDetail(product, currentImageIndex)}
              className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-300 transition-colors line-clamp-2 cursor-pointer leading-tight"
            >
              {product.title}
            </h4>
            {rating && rating > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-500 dark:text-amber-300 shrink-0">
                <Star className="w-3 h-3 fill-amber-400 dark:fill-amber-300" />
                {rating.toFixed(1)}
              </span>
            )}
          </div>

          {dim && (
            <p className="text-xs sm:text-[13px] font-medium text-slate-700 dark:text-slate-300">
              Dimensões do produto: <span className="font-bold text-slate-900 dark:text-slate-100">{dim}</span>
            </p>
          )}

          {/* Swatches de Cores: clicar na cor troca para a foto da cor no card */}
          {colors.length > 0 && (
            <div className="flex items-center gap-1 pt-1">
              {colors.map((c) => {
                const visual = getColorVisual(c);
                return (
                  <button
                    key={c}
                    type="button"
                    title={c}
                    onClick={(e) => {
                      e.stopPropagation();
                      const matched = product.color_images?.find(
                        (ci) => ci.color_name?.toLowerCase() === c.toLowerCase()
                      );
                      if (matched && matched.image_url) {
                        const targetIdx = images.indexOf(matched.image_url);
                        if (targetIdx >= 0) setCurrentImageIndex(targetIdx);
                      }
                    }}
                    className="h-3.5 w-3.5 rounded-full border border-white dark:border-chumbo-900 ring-1 ring-slate-300 dark:ring-chumbo-700 shadow-xs hover:scale-125 transition-transform cursor-pointer"
                    style={{ backgroundColor: visual.hex }}
                  />
                );
              })}
              {colors.length > 1 && (
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                  +{colors.length} cores
                </span>
              )}
            </div>
          )}
        </div>

        {/* Preço */}
        <div className="pt-2.5 border-t border-slate-200 dark:border-chumbo-800/80 flex items-center justify-between gap-2">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              Preço:
            </span>
            <span className="text-base sm:text-lg lg:text-xl font-black text-cyan-700 dark:text-cyan-400">
              {money(product.price)}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
};
