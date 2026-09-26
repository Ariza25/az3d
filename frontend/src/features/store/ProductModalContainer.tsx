import React, { useEffect, useMemo, useState } from 'react';
import { Product, ProductReview, ValidateCouponResponse } from '../../types';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import {
  extractProductDimensions,
  formatDimensionsToCm,
  getAvailableColors,
  getColorVisual,
  getDefaultColor,
  getStockStatus,
  getStoreVariantProduct,
  getTotalStock,
  optimizeImageUrl,
  getWholesaleDiscount,
} from '../../shared/storePresentation';
import { ProductMedia, ProductModalView } from './components/modal';

export interface ProductModalProps {
  product: Product | null;
  onClose: () => void;
}

const getYouTubeThumbnail = (url: string): string | null => {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? `https://img.youtube.com/vi/${match[2]}/hqdefault.jpg` : null;
};

export const ProductModalContainer: React.FC<ProductModalProps> = ({ product, onClose }) => {
  const { addToCart } = useCart();
  const { isAuthenticated } = useAuth();
  const [selectedColor, setSelectedColor] = useState('Padrão');
  const [quantity, setQuantity] = useState(1);
  const [isFavorite, setIsFavorite] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [selectedMediaId, setSelectedMediaId] = useState('');
  const [selectedFreight, setSelectedFreight] = useState<{
    code: string;
    name: string;
    price: number;
    deliveryDays: number;
  } | null>(null);

  // Reviews
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewMsg, setReviewMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [canReview, setCanReview] = useState(false);

  // Coupon
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<ValidateCouponResponse | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponMessage, setCouponMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleApplyCoupon = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = couponInput.trim();
    if (!clean) return;
    setCouponLoading(true);
    setCouponMessage(null);
    try {
      const res = await api.validateCoupon(clean, 0, 0, product?.tenant_id);
      if (res.valid && res.code) {
        setAppliedCoupon(res);
        setCouponMessage({ type: 'success', text: `Cupom ${res.code} aplicado (-${res.discount_percent || 0}%)!` });
      } else {
        setAppliedCoupon(null);
        setCouponMessage({ type: 'error', text: res.message || 'Cupom inválido ou expirado' });
      }
    } catch (err: any) {
      setAppliedCoupon(null);
      setCouponMessage({ type: 'error', text: err.message || 'Erro ao validar cupom' });
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput('');
    setCouponMessage(null);
  };

  useEffect(() => {
    if (!product?.id) return;
    setLoadingReviews(true);
    api.getProductReviews(product.id, product.tenant_id)
      .then((data) => setReviews(Array.isArray(data) ? data : []))
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

  const activeProduct = useMemo(
    () => (product ? getStoreVariantProduct(product, selectedColor) : null),
    [product, selectedColor]
  );

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

    const videoUrl =
      activeProduct?.video_url ||
      product.video_url ||
      candidateList.find((c) => norm(c.color_name) === selectedKey && c.video_url)?.video_url ||
      candidateList.find((c) => c.video_url)?.video_url;

    const mediaList: ProductMedia[] = [];
    chosenPhotos.forEach((url, idx) => {
      const optUrl = optimizeImageUrl(url);
      mediaList.push({
        id: `img-${idx}-${optUrl}`,
        type: 'image',
        url: optUrl,
        thumbnailUrl: optUrl,
      });

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

  const wholesale = useMemo(() => getWholesaleDiscount(quantity), [quantity]);
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
    if (product?.review_summary && product.review_summary.review_count > 0) {
      return product.review_summary;
    }
    return { average_rating: 0, review_count: 0 };
  }, [reviews, activeProduct?.review_summary, product?.review_summary]);

  if (!product) return null;

  const targetProduct = activeProduct || product;
  const selectedVariant = activeProduct?.variants?.find(
    (variant) => variant.color_name === selectedColor && variant.is_active
  );
  const selectedStock = activeProduct?.color_stocks?.find((stock) => stock.color_name === selectedColor);
  const selectedPrice = selectedVariant?.price ?? activeProduct?.price ?? product.price;
  const unitPrice = wholesale.percent > 0 ? wholesale.calculateUnitPrice(selectedPrice) : selectedPrice;
  const rawSubtotal = selectedPrice * quantity;
  const wholesaleSubtotal = unitPrice * quantity;
  const wholesaleDiscount = Math.round((rawSubtotal - wholesaleSubtotal) * 100) / 100;

  const couponPercent = appliedCoupon?.discount_percent || 0;
  const couponProductDiscount = appliedCoupon
    ? Math.round(wholesaleSubtotal * (couponPercent / 100) * 100) / 100
    : 0;

  const freightPrice = selectedFreight?.price || 0;
  const couponShippingDiscount =
    appliedCoupon?.applies_to_shipping && freightPrice > 0
      ? Math.round(freightPrice * (couponPercent / 100) * 100) / 100
      : 0;

  const finalFreight = Math.max(0, freightPrice - couponShippingDiscount);
  const finalTotal = Math.max(0, wholesaleSubtotal - couponProductDiscount) + finalFreight;
  const stockLimit = product.store_variants?.length
    ? getTotalStock(targetProduct)
    : (selectedStock?.stock_qty ?? product.stock_qty);
  const hasRealReviews = reviewSummary.review_count > 0;
  const stockStatus = getStockStatus({
    ...targetProduct,
    color_stocks: undefined,
    stock_qty: stockLimit,
    in_stock: stockLimit > 0 && Boolean(activeProduct?.in_stock ?? product.in_stock),
  });
  const stockTextTone = !stockStatus.canBuy ? 'text-red-300' : stockLimit <= 3 ? 'text-amber-300' : 'text-emerald-300';
  const stockCopy =
    stockLimit <= 0
      ? 'Sem estoque no momento'
      : stockLimit <= 3
      ? `${stockLimit} ${stockLimit === 1 ? 'unidade disponível' : 'unidades disponíveis'}`
      : `${stockLimit} unidades disponíveis`;

  const handleAddToCart = () => {
    if (addToCart({ ...targetProduct, price: selectedPrice }, quantity, selectedColor)) {
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
        await api.removeProductFavorite(targetProduct.id, targetProduct.tenant_id);
        setIsFavorite(false);
      } else {
        await api.addProductFavorite(targetProduct.id, targetProduct.tenant_id);
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

  const mainImageUrl = activeMedia?.url || activeProduct?.image_url || product.image_url || '';
  const blurImageUrl = activeMedia?.thumbnailUrl || product.image_url || mainImageUrl || '';
  const dimensions = extractProductDimensions(targetProduct);
  const material = targetProduct.material || 'PLA Premium';
  const formattedDescription = formatDimensionsToCm(activeProduct?.description || product.description);

  return (
    <ProductModalView
      product={product}
      activeProduct={targetProduct}
      onClose={onClose}
      isFavorite={isFavorite}
      onToggleFavorite={toggleFavorite}
      feedback={feedback}
      reviewSummary={reviewSummary}
      hasRealReviews={hasRealReviews}
      mediaChoices={mediaChoices}
      activeMedia={activeMedia}
      selectedMediaId={selectedMediaId}
      onSelectMedia={setSelectedMediaId}
      mainImageUrl={mainImageUrl}
      blurImageUrl={blurImageUrl}
      dimensions={dimensions}
      material={material}
      stockStatus={stockStatus}
      availableColors={availableColors}
      selectedColor={selectedColor}
      onSelectColor={selectColor}
      stockTextTone={stockTextTone}
      stockCopy={stockCopy}
      wholesale={wholesale}
      selectedFreight={selectedFreight}
      onSelectFreight={setSelectedFreight}
      couponInput={couponInput}
      appliedCoupon={appliedCoupon}
      couponLoading={couponLoading}
      couponMessage={couponMessage}
      onCouponInputChange={setCouponInput}
      onApplyCoupon={handleApplyCoupon}
      onRemoveCoupon={handleRemoveCoupon}
      finalTotal={finalTotal}
      selectedPrice={selectedPrice}
      unitPrice={unitPrice}
      quantity={quantity}
      stockLimit={stockLimit}
      isAuthenticated={isAuthenticated}
      wholesaleDiscount={wholesaleDiscount}
      couponProductDiscount={couponProductDiscount}
      couponShippingDiscount={couponShippingDiscount}
      freightPrice={freightPrice}
      finalFreight={finalFreight}
      onQuantityChange={setQuantity}
      onAddToCart={handleAddToCart}
      formattedDescription={formattedDescription}
      reviews={reviews}
      loadingReviews={loadingReviews}
      canReview={canReview}
      submittingReview={submittingReview}
      newRating={newRating}
      newComment={newComment}
      newImageUrl={newImageUrl}
      reviewMsg={reviewMsg}
      onRatingChange={setNewRating}
      onCommentChange={setNewComment}
      onImageUrlChange={setNewImageUrl}
      onSubmitReview={handleReviewSubmit}
    />
  );
};
