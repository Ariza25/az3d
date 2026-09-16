import React, { useEffect, useMemo, useState } from 'react';
import { Product, ProductReview } from '../types';
import { Check, Heart, Layers, Minus, Play, Plus, ShoppingBag, Star, X, FileText, MessageSquare, Image as ImageIcon, Send, ShieldCheck, User } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { getAvailableColors, getColorVisual, getDefaultColor, getStockStatus, getStoreVariantProduct, getTotalStock, money, optimizeImageUrl } from '../shared/storePresentation';
import { FreightCalculatorWidget } from './FreightCalculatorWidget';

interface ProductModalProps {
  product: Product | null;
  onClose: () => void;
}

interface ProductMedia {
  id: string;
  type: 'image' | 'video';
  url: string;
  thumbnailUrl: string;
}

const getYouTubeEmbedUrl = (url: string): string | null => {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? `https://www.youtube.com/embed/${match[2]}?autoplay=1&rel=0` : null;
};

const getYouTubeThumbnail = (url: string): string | null => {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? `https://img.youtube.com/vi/${match[2]}/hqdefault.jpg` : null;
};

export const ProductModal: React.FC<ProductModalProps> = ({ product, onClose }) => {
  const { addToCart } = useCart();
  const { isAuthenticated } = useAuth();
  const [selectedColor, setSelectedColor] = useState('Padrão');
  const [quantity, setQuantity] = useState(1);
  const [isFavorite, setIsFavorite] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [selectedMediaId, setSelectedMediaId] = useState('');
  const [selectedFreight, setSelectedFreight] = useState<{ code: string; name: string; price: number; deliveryDays: number } | null>(null);

  // Avaliações e Comentários
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewMsg, setReviewMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [canReview, setCanReview] = useState(false);

  useEffect(() => {
    if (!product?.id) return;
    setLoadingReviews(true);
    api.getProductReviews(product.id, product.tenant_id)
      .then((data) => setReviews(data || []))
      .catch(() => setReviews([]))
      .finally(() => setLoadingReviews(false));
  }, [product?.id, product?.tenant_id]);

  useEffect(() => {
    if (!product?.id || !isAuthenticated) {
      setCanReview(false);
      return;
    }
    api.checkReviewEligibility(product.id, product.tenant_id)
      .then((res) => setCanReview(Boolean(res.can_review)))
      .catch(() => setCanReview(false));
  }, [product?.id, product?.tenant_id, isAuthenticated]);

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product?.id) return;
    setSubmittingReview(true);
    setReviewMsg(null);
    try {
      const created = await api.saveProductReview(product.id, newRating, newComment, newImageUrl, product.tenant_id);
      setReviews((prev) => [created, ...prev.filter((r) => r.id !== created.id)]);
      setNewComment('');
      setNewImageUrl('');
      setReviewMsg({ type: 'success', text: 'Avaliação enviada com sucesso!' });
    } catch (err: any) {
      setReviewMsg({ type: 'error', text: err.message || 'Erro ao enviar avaliação' });
    } finally {
      setSubmittingReview(false);
    }
  };

  const availableColors = useMemo(() => {
    if (!product) return [];
    const names = getAvailableColors(product);
    const normalizedNames = names.length > 0 ? names : [getDefaultColor(product)];
    return normalizedNames.map((name) => {
      const variantProduct = getStoreVariantProduct(product, name);
      const image = variantProduct.color_images?.[0]?.image_url || variantProduct.image_url;
      return { name, imageUrl: optimizeImageUrl(image || product.image_url), ...getColorVisual(name) };
    });
  }, [product]);

  const activeProduct = useMemo(() => product ? getStoreVariantProduct(product, selectedColor) : null, [product, selectedColor]);

  const mediaChoices = useMemo<ProductMedia[]>(() => {
    if (!product) return [];
    const norm = (s: string) => (s || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const selectedKey = norm(selectedColor);

    const candidateList = [
      ...(activeProduct?.color_images || []),
      ...(product.color_images || []),
    ];

    const specificPhotos: string[] = [];
    const sharedPhotos: string[] = [];
    const seenUrls = new Set<string>();

    candidateList.forEach((img) => {
      if (!img || !img.image_url) return;
      const key = norm(img.color_name);
      if (key === selectedKey) {
        if (!seenUrls.has(img.image_url)) {
          seenUrls.add(img.image_url);
          specificPhotos.push(img.image_url);
        }
      } else if (key === 'padrao' || !img.color_name) {
        if (!seenUrls.has(img.image_url)) {
          seenUrls.add(img.image_url);
          sharedPhotos.push(img.image_url);
        }
      }
    });

    let chosenPhotos = specificPhotos.length > 0 ? specificPhotos : sharedPhotos;
    if (chosenPhotos.length === 0 && activeProduct?.image_url) {
      chosenPhotos = [activeProduct.image_url];
    }
    if (chosenPhotos.length === 0 && product.image_url) {
      chosenPhotos = [product.image_url];
    }

    // Detectar vídeo da cor ativa ou produto
    const videoUrl = activeProduct?.video_url || product.video_url || candidateList.find((c) => norm(c.color_name) === selectedKey && c.video_url)?.video_url || candidateList.find((c) => c.video_url)?.video_url;

    const mediaList: ProductMedia[] = [];
    chosenPhotos.forEach((url, idx) => {
      const optUrl = optimizeImageUrl(url);
      mediaList.push({
        id: `img-${idx}-${optUrl}`,
        type: 'image',
        url: optUrl,
        thumbnailUrl: optUrl,
      });

      // No Mercado Livre, o vídeo fica logo após a foto principal (2ª posição)
      if (idx === 0 && videoUrl) {
        const ytThumb = getYouTubeThumbnail(videoUrl);
        mediaList.push({
          id: `vid-${videoUrl}`,
          type: 'video',
          url: videoUrl,
          thumbnailUrl: ytThumb || optUrl,
        });
      }
    });

    if (videoUrl && !mediaList.some((m) => m.type === 'video')) {
      const ytThumb = getYouTubeThumbnail(videoUrl);
      const fallbackThumb = mediaList[0]?.thumbnailUrl || optimizeImageUrl(activeProduct?.image_url || product.image_url);
      mediaList.push({
        id: `vid-${videoUrl}`,
        type: 'video',
        url: videoUrl,
        thumbnailUrl: ytThumb || fallbackThumb,
      });
    }

    return mediaList;
  }, [activeProduct, product, selectedColor]);

  const activeMedia = useMemo(() => {
    return mediaChoices.find((m) => m.id === selectedMediaId) || mediaChoices[0] || null;
  }, [mediaChoices, selectedMediaId]);

  useEffect(() => {
    setSelectedColor(availableColors[0]?.name || 'Padrão');
    setQuantity(1);
    setFeedback(null);
  }, [product?.id]);

  useEffect(() => {
    if (mediaChoices.length > 0) {
      setSelectedMediaId(mediaChoices[0].id);
    }
  }, [activeProduct?.id, selectedColor, mediaChoices.map((m) => m.id).join('|')]);

  useEffect(() => {
    if (!activeProduct) return;
    if (isAuthenticated) {
      api.getMyFavorites(activeProduct.tenant_id)
        .then((favorites) => setIsFavorite(favorites.some((favorite) => favorite.product_id === activeProduct.id)))
        .catch(() => setIsFavorite(false));
    } else {
      setIsFavorite(false);
    }
  }, [activeProduct?.id, activeProduct?.tenant_id, isAuthenticated]);

  useEffect(() => {
    if (!product) return;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [product, onClose]);

  if (!product) return null;

  const selectedVariant = activeProduct?.variants?.find(
    (variant) => variant.color_name === selectedColor && variant.is_active
  );
  const selectedStock = activeProduct?.color_stocks?.find((stock) => stock.color_name === selectedColor);
  const selectedPrice = selectedVariant?.price ?? activeProduct?.price ?? product.price;
  const purchaseTotal = selectedPrice * quantity;
  const finalTotal = purchaseTotal + (selectedFreight?.price || 0);
  const stockLimit = product.store_variants?.length ? getTotalStock(activeProduct || product) : (selectedStock?.stock_qty ?? product.stock_qty);
  const reviewSummary = useMemo(() => {
    if (reviews.length > 0) {
      const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
      return {
        average_rating: avg,
        review_count: reviews.length,
      };
    }
    if (activeProduct?.review_summary && activeProduct.review_summary.review_count > 0) {
      return activeProduct.review_summary;
    }
    if (product.review_summary && product.review_summary.review_count > 0) {
      return product.review_summary;
    }
    return { average_rating: 0, review_count: 0 };
  }, [reviews, activeProduct?.review_summary, product.review_summary]);
  const hasRealReviews = reviewSummary.review_count > 0;
  const stockStatus = getStockStatus({ ...(activeProduct || product), color_stocks: undefined, stock_qty: stockLimit, in_stock: stockLimit > 0 && Boolean(activeProduct?.in_stock ?? product.in_stock) });
  const stockTextTone = !stockStatus.canBuy ? 'text-red-300' : stockLimit <= 3 ? 'text-amber-300' : 'text-emerald-300';
  const stockCopy = stockLimit <= 0
    ? 'Sem estoque no momento'
    : stockLimit <= 3
      ? `${stockLimit} ${stockLimit === 1 ? 'unidade disponível' : 'unidades disponíveis'}`
      : `${stockLimit} unidades disponíveis`;

  const handleAddToCart = () => {
    if (addToCart({ ...(activeProduct || product), price: selectedPrice }, quantity, selectedColor)) {
      onClose();
    }
  };

  const toggleFavorite = async () => {
    if (!isAuthenticated) {
      setFeedback('Entre como comprador para favoritar este item.');
      return;
    }

    try {
      if (isFavorite) {
        await api.removeProductFavorite((activeProduct || product).id, (activeProduct || product).tenant_id);
        setIsFavorite(false);
      } else {
        await api.addProductFavorite((activeProduct || product).id, (activeProduct || product).tenant_id);
        setIsFavorite(true);
      }
    } catch (error: any) {
      setFeedback(error.message || 'Não foi possível atualizar o favorito.');
    }
  };

  const selectColor = (colorName: string) => {
    setSelectedColor(colorName);
    setQuantity(1);
  };

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
          <div className="relative min-h-[340px] overflow-hidden bg-chumbo-950 p-3 sm:min-h-[440px] lg:min-h-0">
            <img src={activeMedia?.thumbnailUrl || product.image_url} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-20 blur-2xl" aria-hidden="true" />
            <div className="absolute inset-0 bg-gradient-to-br from-chumbo-950/35 via-chumbo-950/55 to-chumbo-950" />
            <div className={`relative z-10 grid h-full w-full p-3 sm:p-5 ${mediaChoices.length > 1 ? 'grid-cols-[76px_minmax(0,1fr)]' : ''}`}>
              {mediaChoices.length > 1 && (
                <div className="flex max-h-full flex-col gap-2 overflow-y-auto border-r border-white/10 bg-chumbo-950/80 p-2 backdrop-blur-md">
                  {mediaChoices.map((media, index) => {
                    const isCurrent = media.id === activeMedia?.id;
                    return (
                      <button
                        type="button"
                        key={media.id}
                        onClick={() => setSelectedMediaId(media.id)}
                        onMouseEnter={() => setSelectedMediaId(media.id)}
                        className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border-2 bg-chumbo-900 p-0.5 transition-all duration-150 ${
                          isCurrent
                            ? 'border-laser-400 shadow-[0_0_0_2px_rgba(34,211,238,0.25)] scale-105'
                            : 'border-chumbo-700 opacity-70 hover:border-chumbo-500 hover:opacity-100'
                        }`}
                        aria-label={media.type === 'video' ? 'Ver vídeo do produto' : `Ver foto ${index + 1} da cor ${selectedColor}`}
                      >
                        <img src={media.thumbnailUrl} alt="" className="h-full w-full rounded-lg object-cover" />
                        {media.type === 'video' && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/45 backdrop-blur-[1px]">
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-laser-400 text-chumbo-950 shadow-md">
                              <Play className="h-3 w-3 fill-chumbo-950 translate-x-0.5" />
                            </div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="flex min-h-0 items-center justify-center p-2 sm:p-4">
                <div className="relative aspect-square w-full max-w-[580px] overflow-hidden rounded-2xl border border-chumbo-800 bg-chumbo-950 shadow-2xl flex items-center justify-center">
                  {activeMedia?.type === 'video' ? (
                    getYouTubeEmbedUrl(activeMedia.url) ? (
                      <iframe
                        src={getYouTubeEmbedUrl(activeMedia.url)!}
                        title={product.title}
                        className="h-full w-full rounded-2xl border-0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : (
                      <video
                        src={activeMedia.url}
                        controls
                        autoPlay
                        className="h-full w-full rounded-2xl object-cover bg-black"
                      />
                    )
                  ) : (
                    <>
                      <img
                        src={activeMedia?.url || activeProduct?.image_url || product.image_url}
                        alt=""
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-20 blur-xl scale-110"
                      />
                      <img
                        src={activeMedia?.url || activeProduct?.image_url || product.image_url}
                        alt={product.title}
                        className="relative z-10 h-full w-full object-contain p-2 transition-transform duration-300 hover:scale-[1.02]"
                      />
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-col bg-chumbo-900 p-5 sm:p-8 lg:overflow-y-auto lg:p-10">
            <div className="space-y-6">
              {/* 1. Header & Title */}
              <div>
                <div className="flex items-center justify-between gap-3 pr-12">
                  <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-laser-400">
                    <Layers className="h-4 w-4" />
                    Detalhes do produto
                  </div>
                  <button
                    type="button"
                    onClick={toggleFavorite}
                    className={`rounded-xl border p-2.5 transition-colors ${isFavorite ? 'border-rose-400/50 bg-rose-500/10 text-rose-300' : 'border-chumbo-700 bg-chumbo-950/70 text-slate-300 hover:border-chumbo-600 hover:text-white'}`}
                    aria-label={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                  >
                    <Heart className={`h-4 w-4 ${isFavorite ? 'fill-rose-300' : ''}`} />
                  </button>
                </div>

                <div className="mt-4">
                  <h2 id="product-modal-title" className="text-2xl font-extrabold leading-tight text-white sm:text-3xl lg:text-[2rem]">{product.title}</h2>
                  <div className="mt-2 flex items-center justify-end">
                    {hasRealReviews ? (
                      <div className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                        <div className="flex items-center gap-0.5 text-amber-300">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`h-4 w-4 ${star <= Math.round(reviewSummary.average_rating) ? 'fill-amber-300 text-amber-300' : 'text-slate-700'}`}
                            />
                          ))}
                        </div>
                        <strong className="text-white text-sm">{reviewSummary.average_rating.toFixed(1)}</strong>
                        <span className="text-slate-500">({reviewSummary.review_count} {reviewSummary.review_count === 1 ? 'avaliação' : 'avaliações'})</span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500">
                        Ainda sem avaliações
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {feedback && <div className="rounded-xl border border-chumbo-700 bg-chumbo-950 p-3 text-xs text-slate-300">{feedback}</div>}

              {/* 2. SEÇÃO DE COMPRA (Cores, Estoque, Frete, Total e Comprar) */}
              <div className="rounded-2xl border border-chumbo-800 bg-chumbo-950/60 p-4 sm:p-5 space-y-5">
                {/* Seleção de cor */}
                {availableColors.length > 1 ? (
                  <div>
                    <p className="text-sm text-slate-300">
                      Cor: <strong className="font-bold text-white">{selectedColor}</strong>
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2.5" role="group" aria-label="Escolha a cor">
                      {availableColors.map((color) => (
                        <button
                          type="button"
                          key={color.name}
                          onClick={() => selectColor(color.name)}
                          onMouseEnter={() => selectColor(color.name)}
                          className={`relative h-16 w-16 overflow-hidden rounded-xl border-2 bg-chumbo-950 p-0.5 transition ${selectedColor === color.name ? 'border-laser-400 shadow-[0_0_0_2px_rgba(34,211,238,0.16)] scale-105' : 'border-chumbo-700 hover:border-chumbo-500'}`}
                          title={color.name}
                          aria-label={`Selecionar cor ${color.name}`}
                          aria-pressed={selectedColor === color.name}
                        >
                          <img src={color.imageUrl} alt="" loading="lazy" className="h-full w-full rounded-lg object-cover" />
                          <span
                            className="absolute bottom-1.5 left-1.5 h-3 w-3 rounded-full border shadow-sm"
                            style={{ backgroundColor: color.hex, borderColor: color.border }}
                            aria-hidden="true"
                          />
                          {selectedColor === color.name && (
                            <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-laser-400 text-chumbo-950 shadow-md">
                              <Check className="h-3.5 w-3.5" />
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Cor</span>
                    <span className="inline-flex items-center gap-2 text-sm font-bold text-white">
                      <span className="h-4 w-4 rounded-full border" style={{ backgroundColor: availableColors[0]?.hex, borderColor: availableColors[0]?.border }} />
                      {selectedColor}
                    </span>
                  </div>
                )}

                {/* Estoque */}
                <div className={`inline-flex items-center gap-2 text-xs font-semibold ${stockTextTone}`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {stockCopy}
                </div>

                {/* Simulador de Frete */}
                <div className="border-t border-chumbo-800 pt-4">
                  <FreightCalculatorWidget
                    compact
                    tenantId={product.tenant_id}
                    selectedOptionCode={selectedFreight?.code}
                    onSelectOption={(opt) => setSelectedFreight(opt)}
                  />
                </div>

                {/* Barra de Preço Total + Quantidade + Botão de Compra */}
                <div className="border-t border-chumbo-800 pt-4">
                  <div className="grid grid-cols-[1fr_auto] items-end gap-3 sm:gap-4 lg:grid-cols-[minmax(130px,1fr)_auto_minmax(180px,1.2fr)]">
                    <div aria-live="polite" aria-label="Total da compra">
                      <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total</span>
                      <span className="mt-1 block whitespace-nowrap text-2xl sm:text-3xl font-extrabold text-white">{money(finalTotal)}</span>
                      <div className="mt-0.5 flex flex-col text-[11px] text-slate-400">
                        {quantity > 1 && <span>{quantity} × {money(selectedPrice)} cada</span>}
                        {selectedFreight && <span className="font-mono text-laser-400 font-bold">+ Frete ({selectedFreight.name}): {money(selectedFreight.price)}</span>}
                      </div>
                    </div>

                    <div className="flex h-11 items-center rounded-xl border border-chumbo-700 bg-chumbo-900 p-1" aria-label="Quantidade">
                      <button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-chumbo-800 hover:text-white" aria-label="Diminuir quantidade">
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="w-8 text-center text-sm font-bold text-white">{quantity}</span>
                      <button type="button" onClick={() => setQuantity(Math.min(stockLimit || 1, quantity + 1))} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-chumbo-800 hover:text-white" aria-label="Aumentar quantidade">
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddToCart}
                      disabled={stockLimit <= 0}
                      className="col-span-2 flex h-11 sm:h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-extrabold text-chumbo-950 shadow-xl transition hover:bg-slate-200 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 lg:col-span-1"
                    >
                      <ShoppingBag className="h-4 w-4" />
                      {stockLimit > 0 ? (isAuthenticated ? 'Adicionar' : 'Entrar para comprar') : 'Sem estoque'}
                    </button>
                  </div>
                </div>
              </div>

              {/* 3. SEÇÃO DE DESCRIÇÃO DO PRODUTO (ABAIXO DA COMPRA) */}
              <div className="border-t border-chumbo-800 pt-6">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <FileText className="h-4 w-4 text-laser-400" />
                  Descrição do produto
                </h3>
                <p className="mt-3 whitespace-pre-line text-[14px] sm:text-[15px] leading-7 text-slate-300">
                  {activeProduct?.description || product.description}
                </p>
              </div>

              {/* 4. SEÇÃO DE AVALIAÇÕES, COMENTÁRIOS E FOTOS DOS CLIENTES (ABAIXO DA DESCRIÇÃO) */}
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

                {/* Formulário de avaliação */}
                {isAuthenticated ? (
                  canReview ? (
                    <form onSubmit={handleReviewSubmit} className="rounded-2xl border border-chumbo-800 bg-chumbo-950/60 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-300">Sua nota:</span>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              type="button"
                              key={star}
                              onClick={() => setNewRating(star)}
                              className="p-1 text-amber-300 transition-transform hover:scale-110"
                            >
                              <Star className={`h-5 w-5 ${star <= newRating ? 'fill-amber-300 text-amber-300' : 'text-slate-600'}`} />
                            </button>
                          ))}
                        </div>
                      </div>

                      <textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
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
                            onChange={(e) => setNewImageUrl(e.target.value)}
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
                        <p className={`text-xs ${reviewMsg.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
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
                    <div key={rev.id} className="rounded-xl border border-chumbo-800/80 bg-chumbo-950/50 p-3.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-chumbo-800 text-slate-300">
                            <User className="h-3.5 w-3.5" />
                          </div>
                          <span className="font-semibold text-white">{rev.user?.name || rev.user?.email?.split('@')[0] || 'Cliente'}</span>
                          {rev.is_verified_buyer && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
                              <ShieldCheck className="h-3 w-3" /> Compra verificada
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500">{new Date(rev.created_at).toLocaleDateString('pt-BR')}</span>
                      </div>

                      <div className="mt-1.5 flex items-center gap-1 text-amber-300">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star key={star} className={`h-3 w-3 ${star <= rev.rating ? 'fill-amber-300 text-amber-300' : 'text-slate-700'}`} />
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

