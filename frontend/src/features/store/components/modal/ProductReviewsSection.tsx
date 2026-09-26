import React from 'react';
import { MessageSquare, Star, User, ShieldCheck, ImageIcon, Send } from 'lucide-react';
import { ProductReview } from '../../../../types';

interface ProductReviewsSectionProps {
  reviews: ProductReview[];
  loadingReviews: boolean;
  isAuthenticated: boolean;
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

export const ProductReviewsSection: React.FC<ProductReviewsSectionProps> = ({
  reviews,
  loadingReviews,
  isAuthenticated,
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
    <div className="border-t border-chumbo-800 pt-6 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-laser-400" />
          Avaliações e Fotos dos Clientes
        </h3>
        <span className="text-xs text-slate-400">
          {reviews.length} {reviews.length === 1 ? 'avaliação' : 'avaliações'}
        </span>
      </div>

      {isAuthenticated ? (
        canReview ? (
          <form onSubmit={onSubmitReview} className="rounded-2xl border border-chumbo-800 bg-chumbo-950/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">Sua nota:</span>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    type="button"
                    key={star}
                    onClick={() => onRatingChange(star)}
                    className="p-1 text-amber-300 transition-transform hover:scale-110"
                    aria-label={`Avaliar com ${star} estrela${star > 1 ? 's' : ''}`}
                  >
                    <Star
                      className={`h-5 w-5 ${
                        star <= newRating ? 'fill-amber-300 text-amber-300' : 'text-slate-600'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            <textarea
              value={newComment}
              onChange={(e) => onCommentChange(e.target.value)}
              placeholder="O que achou do produto? Deixe sua opinião sobre o acabamento, material e entrega..."
              rows={3}
              className="w-full rounded-xl border border-chumbo-700 bg-chumbo-900 p-3 text-xs text-white placeholder-slate-500 focus:border-laser-400 focus:outline-none"
            />

            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <ImageIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  type="url"
                  value={newImageUrl}
                  onChange={(e) => onImageUrlChange(e.target.value)}
                  placeholder="Link da foto do produto recebido (opcional)"
                  className="w-full rounded-xl border border-chumbo-700 bg-chumbo-900 py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:border-laser-400 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={submittingReview}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-laser-400 px-4 py-2 text-xs font-bold text-chumbo-950 transition hover:bg-laser-300 disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                {submittingReview ? 'Enviando...' : 'Publicar avaliação'}
              </button>
            </div>

            {reviewMsg && (
              <p
                className={`text-xs ${
                  reviewMsg.type === 'success' ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {reviewMsg.text}
              </p>
            )}
          </form>
        ) : (
          <div className="rounded-xl border border-chumbo-800 bg-chumbo-950/40 p-3.5 text-center text-xs text-slate-400">
            <div className="flex items-center justify-center gap-1.5 font-semibold text-slate-300 mb-1">
              <ShieldCheck className="h-4 w-4 text-laser-400" />
              Avaliação exclusiva para compradores
            </div>
            <p>Apenas clientes autenticados que compraram este produto podem publicar avaliações e fotos.</p>
          </div>
        )
      ) : (
        <div className="rounded-xl border border-chumbo-800 bg-chumbo-950/40 p-3 text-center text-xs text-slate-400">
          Faça login com a conta utilizada na compra para avaliar este produto.
        </div>
      )}

      {/* Lista de Avaliações */}
      <div className="space-y-3">
        {reviews.map((rev) => (
          <div
            key={rev.id}
            className="rounded-xl border border-chumbo-800/80 bg-chumbo-950/50 p-3.5 text-xs"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-chumbo-800 text-slate-300">
                  <User className="h-3.5 w-3.5" />
                </div>
                <span className="font-semibold text-white">
                  {rev.user?.name || rev.user?.email?.split('@')[0] || 'Cliente'}
                </span>
                {rev.is_verified_buyer && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
                    <ShieldCheck className="h-3 w-3" /> Compra verificada
                  </span>
                )}
              </div>
              <span className="text-[10px] text-slate-500">
                {new Date(rev.created_at).toLocaleDateString('pt-BR')}
              </span>
            </div>

            <div className="mt-1.5 flex items-center gap-1 text-amber-300">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`h-3 w-3 ${
                    star <= rev.rating ? 'fill-amber-300 text-amber-300' : 'text-slate-700'
                  }`}
                />
              ))}
            </div>

            {rev.comment && <p className="mt-2 leading-relaxed text-slate-300">{rev.comment}</p>}

            {rev.image_url && (
              <div className="mt-2.5">
                <img
                  src={rev.image_url}
                  alt="Foto do cliente"
                  loading="lazy"
                  className="h-24 w-24 rounded-lg object-cover border border-chumbo-700 cursor-pointer transition hover:scale-105"
                  onClick={() => window.open(rev.image_url, '_blank')}
                />
              </div>
            )}
          </div>
        ))}

        {!loadingReviews && reviews.length === 0 && (
          <p className="py-4 text-center text-xs text-slate-500">
            Ainda não há avaliações para este produto. Seja o primeiro a avaliar!
          </p>
        )}
      </div>
    </div>
  );
};
