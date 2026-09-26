import React from 'react';
import { FileText, Heart, Layers, Star, X } from 'lucide-react';
import { Product, ProductReview, ValidateCouponResponse } from '../../../../types';
import { FreightCalculatorWidget } from '../../../../components/FreightCalculatorWidget';
import { ProductGallery, ProductMedia } from './ProductGallery';
import { ProductQuickSpecs } from './ProductQuickSpecs';
import { AvailableColorOption, ProductColorSelector } from './ProductColorSelector';
import { ProductWholesaleBanner } from './ProductWholesaleBanner';
import { ProductCouponInput } from './ProductCouponInput';
import { ProductPurchaseBar } from './ProductPurchaseBar';
import { ProductReviewsSection } from './ProductReviewsSection';

export interface ProductModalViewProps {
  product: Product;
  activeProduct: Product;
  onClose: () => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  feedback: string | null;
  reviewSummary: { average_rating: number; review_count: number };
  hasRealReviews: boolean;
  mediaChoices: ProductMedia[];
  activeMedia: ProductMedia | null;
  selectedMediaId: string;
  onSelectMedia: (id: string) => void;
  mainImageUrl: string;
  blurImageUrl: string;
  dimensions: string | null;
  material: string;
  stockStatus: { canBuy: boolean; label: string; tone: string };
  availableColors: AvailableColorOption[];
  selectedColor: string;
  onSelectColor: (color: string) => void;
  stockTextTone: string;
  stockCopy: string;
  wholesale: { percent: number; badge: string | null };
  selectedFreight: { code: string; name: string; price: number; deliveryDays: number } | null;
  onSelectFreight: (opt: any) => void;
  couponInput: string;
  appliedCoupon: ValidateCouponResponse | null;
  couponLoading: boolean;
  couponMessage: { type: 'success' | 'error'; text: string } | null;
  onCouponInputChange: (value: string) => void;
  onApplyCoupon: (e?: React.FormEvent) => void;
  onRemoveCoupon: () => void;
  finalTotal: number;
  selectedPrice: number;
  unitPrice: number;
  quantity: number;
  stockLimit: number;
  isAuthenticated: boolean;
  wholesaleDiscount: number;
  couponProductDiscount: number;
  couponShippingDiscount: number;
  freightPrice: number;
  finalFreight: number;
  onQuantityChange: (qty: number) => void;
  onAddToCart: () => void;
  formattedDescription: string;
  reviews: ProductReview[];
  loadingReviews: boolean;
  canReview: boolean;
  submittingReview: boolean;
  newRating: number;
  newComment: string;
  newImageUrl: string;
  reviewMsg: { type: 'success' | 'error'; text: string } | null;
  onRatingChange: (rating: number) => void;
  onCommentChange: (comment: string) => void;
  onImageUrlChange: (url: string) => void;
  onSubmitReview: (e: React.FormEvent) => void;
}

export const ProductModalView: React.FC<ProductModalViewProps> = ({
  product,
  activeProduct: _activeProduct,
  onClose,
  isFavorite,
  onToggleFavorite,
  feedback,
  reviewSummary,
  hasRealReviews,
  mediaChoices,
  activeMedia,
  selectedMediaId: _selectedMediaId,
  onSelectMedia,
  mainImageUrl,
  blurImageUrl,
  dimensions,
  material,
  stockStatus,
  availableColors,
  selectedColor,
  onSelectColor,
  stockTextTone,
  stockCopy,
  wholesale,
  selectedFreight,
  onSelectFreight,
  couponInput,
  appliedCoupon,
  couponLoading,
  couponMessage,
  onCouponInputChange,
  onApplyCoupon,
  onRemoveCoupon,
  finalTotal,
  selectedPrice,
  unitPrice,
  quantity,
  stockLimit,
  isAuthenticated,
  wholesaleDiscount,
  couponProductDiscount,
  couponShippingDiscount,
  freightPrice,
  finalFreight,
  onQuantityChange,
  onAddToCart,
  formattedDescription,
  reviews,
  loadingReviews,
  canReview,
  submittingReview,
  newRating,
  newComment,
  newImageUrl,
  reviewMsg,
  onRatingChange,
  onCommentChange,
  onImageUrlChange,
  onSubmitReview,
}) => {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-3 backdrop-blur-md sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-modal-title"
    >
      <div
        className="glass-panel relative max-h-[calc(100vh-1rem)] w-full max-w-[1400px] overflow-y-auto rounded-3xl border border-chumbo-700 shadow-2xl animate-in fade-in zoom-in-95 duration-200 sm:max-h-[calc(100vh-2rem)] lg:overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-30 rounded-full border border-white/10 bg-chumbo-950/85 p-2.5 text-slate-400 transition-colors hover:border-white/20 hover:text-white"
          aria-label="Fechar detalhes do produto"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="grid lg:h-[700px] lg:max-h-[calc(100vh-2rem)] lg:grid-cols-[54fr_46fr]">
          {/* Gallery Dumb Component */}
          <ProductGallery
            mediaChoices={mediaChoices}
            activeMedia={activeMedia}
            selectedColor={selectedColor}
            mainImageUrl={mainImageUrl}
            blurImageUrl={blurImageUrl}
            productTitle={product.title}
            onSelectMedia={onSelectMedia}
          />

          <div className="flex min-h-0 flex-col bg-chumbo-900 p-4 sm:p-8 lg:overflow-y-auto lg:p-10">
            <div className="space-y-4 sm:space-y-6">
              {/* 1. Header & Title */}
              <div>
                <div className="flex items-center justify-between gap-3 pr-12">
                  <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-laser-400">
                    <Layers className="h-4 w-4" />
                    Detalhes do produto
                  </div>
                  <button
                    type="button"
                    onClick={onToggleFavorite}
                    className={`rounded-xl border p-2.5 transition-colors ${
                      isFavorite
                        ? 'border-rose-400/50 bg-rose-500/10 text-rose-300'
                        : 'border-chumbo-700 bg-chumbo-950/70 text-slate-300 hover:border-chumbo-600 hover:text-white'
                    }`}
                    aria-label={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                  >
                    <Heart className={`h-4 w-4 ${isFavorite ? 'fill-rose-300' : ''}`} />
                  </button>
                </div>

                <div className="mt-3">
                  <h2
                    id="product-modal-title"
                    className="text-xl font-extrabold leading-tight text-white sm:text-3xl lg:text-[2rem]"
                  >
                    {product.title}
                  </h2>
                  <div className="mt-2 flex items-center justify-end">
                    {hasRealReviews ? (
                      <div className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                        <div className="flex items-center gap-0.5 text-amber-300">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`h-4 w-4 ${
                                star <= Math.round(reviewSummary.average_rating)
                                  ? 'fill-amber-300 text-amber-300'
                                  : 'text-slate-700'
                              }`}
                            />
                          ))}
                        </div>
                        <strong className="text-white text-sm">
                          {reviewSummary.average_rating.toFixed(1)}
                        </strong>
                        <span className="text-slate-500">
                          ({reviewSummary.review_count}{' '}
                          {reviewSummary.review_count === 1 ? 'avaliação' : 'avaliações'})
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500">Ainda sem avaliações</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Especificações Rápidas (Dimensões em cm e Material) */}
              <ProductQuickSpecs
                dimensions={dimensions}
                material={material}
                stockStatus={stockStatus}
              />

              {feedback && (
                <div className="rounded-xl border border-chumbo-700 bg-chumbo-950 p-3 text-xs text-slate-300">
                  {feedback}
                </div>
              )}

              {/* 2. SEÇÃO DE COMPRA (Cores, Estoque, Frete, Total e Comprar) */}
              <div className="rounded-2xl border border-chumbo-800 bg-chumbo-950/60 p-3.5 sm:p-5 space-y-4 sm:space-y-5">
                <ProductColorSelector
                  availableColors={availableColors}
                  selectedColor={selectedColor}
                  onSelectColor={onSelectColor}
                />

                <div className={`inline-flex items-center gap-2 text-xs font-semibold ${stockTextTone}`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {stockCopy}
                </div>

                <ProductWholesaleBanner
                  quantity={quantity}
                  wholesale={wholesale}
                />

                <div className="border-t border-chumbo-800 pt-4">
                  <FreightCalculatorWidget
                    compact
                    tenantId={product.tenant_id}
                    selectedOptionCode={selectedFreight?.code}
                    onSelectOption={onSelectFreight}
                  />
                </div>

                <ProductCouponInput
                  couponInput={couponInput}
                  appliedCoupon={appliedCoupon}
                  couponLoading={couponLoading}
                  couponMessage={couponMessage}
                  onCouponInputChange={onCouponInputChange}
                  onApplyCoupon={onApplyCoupon}
                  onRemoveCoupon={onRemoveCoupon}
                />

                <ProductPurchaseBar
                  finalTotal={finalTotal}
                  selectedPrice={selectedPrice}
                  unitPrice={unitPrice}
                  quantity={quantity}
                  stockLimit={stockLimit}
                  isAuthenticated={isAuthenticated}
                  wholesalePercent={wholesale.percent}
                  wholesaleDiscount={wholesaleDiscount}
                  couponProductDiscount={couponProductDiscount}
                  couponShippingDiscount={couponShippingDiscount}
                  freightPrice={freightPrice}
                  finalFreight={finalFreight}
                  selectedFreight={selectedFreight}
                  onQuantityChange={onQuantityChange}
                  onAddToCart={onAddToCart}
                />
              </div>

              {/* 3. SEÇÃO DE DESCRIÇÃO DO PRODUTO */}
              <div className="border-t border-chumbo-800 pt-6">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <FileText className="h-4 w-4 text-laser-400" />
                  Descrição do produto
                </h3>
                <p className="mt-3 whitespace-pre-line text-[14px] sm:text-[15px] leading-7 text-slate-300">
                  {formattedDescription}
                </p>
              </div>

              {/* 4. SEÇÃO DE AVALIAÇÕES E FOTOS DOS CLIENTES */}
              <ProductReviewsSection
                reviews={reviews}
                loadingReviews={loadingReviews}
                isAuthenticated={isAuthenticated}
                canReview={canReview}
                submittingReview={submittingReview}
                newRating={newRating}
                newComment={newComment}
                newImageUrl={newImageUrl}
                reviewMsg={reviewMsg}
                onRatingChange={onRatingChange}
                onCommentChange={onCommentChange}
                onImageUrlChange={onImageUrlChange}
                onSubmitReview={onSubmitReview}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
