import React from 'react';
import { X, ChevronLeft, ChevronRight, MessageCircle, ShoppingBag } from 'lucide-react';
import { Product } from '../../../types';
import {
  extractProductDimensions,
  formatDimensionsToCm,
  getStockStatus,
  money,
  optimizeImageUrl,
} from '../../../shared/storePresentation';

export interface CatalogQuickDetailModalProps {
  product: Product | null;
  activeImageIndex: number;
  allImages: string[];
  storeName: string;
  onClose: () => void;
  onSelectImageIndex: (index: number) => void;
  onPrevImage: () => void;
  onNextImage: () => void;
  onGoToStore: (slugOrId: string | number) => void;
  onWhatsAppClick: (product: Product) => void;
}

export const CatalogQuickDetailModal: React.FC<CatalogQuickDetailModalProps> = ({
  product,
  activeImageIndex,
  allImages,
  onClose,
  onSelectImageIndex,
  onPrevImage,
  onNextImage,
  onGoToStore,
  onWhatsAppClick,
}) => {
  if (!product) return null;

  const currentImage = allImages[activeImageIndex] || product.image_url;
  const dimensions = extractProductDimensions(product);
  const status = getStockStatus(product);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Detalhes de ${product.title}`}
    >
      <div
        className="relative w-full max-w-xl md:max-w-5xl lg:max-w-6xl xl:max-w-7xl overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-chumbo-700 bg-white dark:bg-chumbo-950 text-slate-900 dark:text-slate-100 p-3.5 sm:p-6 md:p-8 lg:p-10 shadow-2xl max-h-[94vh] md:max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Fechar sem sobreposição */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 sm:top-5 sm:right-5 z-30 p-2 sm:p-2.5 rounded-xl bg-white/95 dark:bg-chumbo-900/95 hover:bg-slate-100 dark:hover:bg-chumbo-800 text-slate-700 dark:text-slate-200 border border-slate-300/80 dark:border-chumbo-700 transition-all shadow-md active:scale-95 cursor-pointer"
          aria-label="Fechar detalhes"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6 lg:gap-10 items-start">
          {/* Coluna Esquerda: Galeria de Fotos Ampliada */}
          <div className="min-w-0 w-full space-y-2.5 sm:space-y-3 flex flex-col">
            <div className="relative h-56 min-[390px]:h-64 sm:h-80 md:h-[420px] lg:h-[480px] w-full overflow-hidden rounded-2xl bg-slate-50 dark:bg-chumbo-900/60 border border-slate-200 dark:border-chumbo-800 flex items-center justify-center group/modalimg">
              <img
                src={optimizeImageUrl(currentImage)}
                alt={product.title}
                decoding="async"
                className="w-full h-full object-contain p-2 sm:p-4 transition-all duration-300"
              />

              {/* Setas de navegação na galeria do modal */}
              {allImages.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPrevImage();
                    }}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 z-20 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/95 dark:bg-chumbo-900/95 text-slate-800 dark:text-slate-100 shadow-md flex items-center justify-center hover:scale-110 active:scale-95 transition-all border border-slate-200/80 dark:border-chumbo-700/80 cursor-pointer"
                    title="Foto anterior"
                    aria-label="Foto anterior"
                  >
                    <ChevronLeft className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onNextImage();
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 z-20 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/95 dark:bg-chumbo-900/95 text-slate-800 dark:text-slate-100 shadow-md flex items-center justify-center hover:scale-110 active:scale-95 transition-all border border-slate-200/80 dark:border-chumbo-700/80 cursor-pointer"
                    title="Próxima foto"
                    aria-label="Próxima foto"
                  >
                    <ChevronRight className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
                  </button>
                </>
              )}
            </div>

            {/* Miniaturas de Cores/Ângulos com rolagem horizontal contida */}
            {allImages.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar pt-1 w-full max-w-full touch-pan-x">
                {allImages.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onSelectImageIndex(idx)}
                    className={`relative h-12 w-12 min-[380px]:h-14 min-[380px]:w-14 sm:h-16 sm:w-16 rounded-xl overflow-hidden border shrink-0 transition-all cursor-pointer ${
                      activeImageIndex === idx
                        ? 'border-cyan-500 ring-2 ring-cyan-500/40 scale-105'
                        : 'border-slate-200 dark:border-chumbo-800 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={optimizeImageUrl(img)} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Coluna Direita: Informações & Ações */}
          <div className="min-w-0 w-full flex flex-col justify-between space-y-4">
            <div className="space-y-3.5 sm:space-y-4">
              {/* Cabeçalho do Produto: Título e Preço */}
              <div className="space-y-1.5 md:pr-10">
                <h3 className="text-lg sm:text-2xl lg:text-3xl font-extrabold text-slate-900 dark:text-white leading-tight break-words">
                  {product.title}
                </h3>
                <div className="flex items-baseline gap-2 pt-0.5">
                  <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Preço:</span>
                  <span className="text-2xl sm:text-3xl lg:text-4xl font-black text-cyan-700 dark:text-cyan-400">
                    {money(product.price)}
                  </span>
                </div>
              </div>

              {/* Especificações da Peça 3D */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3 p-3 sm:p-4 rounded-xl bg-slate-50 dark:bg-chumbo-900/70 border border-slate-200 dark:border-chumbo-800 text-xs sm:text-sm">
                <div className="min-w-0">
                  <span className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 block uppercase font-mono">Material</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block text-[11px] sm:text-xs md:text-sm" title={product.material || 'PLA'}>{product.material || 'PLA'}</span>
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 block uppercase font-mono">Dimensões</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block text-[11px] sm:text-xs md:text-sm" title={dimensions || 'Sob medida'}>{dimensions || 'Sob medida'}</span>
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 block uppercase font-mono">Status</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400 truncate block text-[11px] sm:text-xs md:text-sm">{status.label}</span>
                </div>
              </div>

              {product.description && (
                <div className="space-y-1.5 sm:space-y-2">
                  <h5 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Detalhes da Peça</h5>
                  <p className="text-xs sm:text-sm md:text-base text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line max-h-44 sm:max-h-60 overflow-y-auto pr-2">
                    {formatDimensionsToCm(product.description)}
                  </p>
                </div>
              )}
            </div>

            {/* Ações no Modal fixadas na base */}
            <div className="pt-3 sm:pt-4 border-t border-slate-200 dark:border-chumbo-800 grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 mt-3 sm:mt-4">
              <button
                type="button"
                onClick={() => onWhatsAppClick(product)}
                className="flex items-center justify-center gap-2 py-3 sm:py-3.5 px-4 rounded-xl text-xs sm:text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md active:scale-95 cursor-pointer"
              >
                <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                <span className="truncate">Tirar dúvidas no WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={() => onGoToStore(product.slug || product.id)}
                className="flex items-center justify-center gap-2 py-3 sm:py-3.5 px-4 rounded-xl text-xs sm:text-sm font-bold bg-slate-950 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 !text-white dark:!text-slate-950 transition-all shadow-md active:scale-95 cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5 !text-white dark:!text-slate-950 shrink-0" />
                <span className="truncate !text-white dark:!text-slate-950 font-bold">Ver na Loja Oficial</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
