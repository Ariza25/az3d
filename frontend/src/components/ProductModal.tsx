import React, { useEffect, useMemo, useState } from 'react';
import { Product } from '../types';
import { Check, Heart, Layers, Minus, Plus, ShoppingBag, Star, X } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { getAvailableColors, getColorVisual, getDefaultColor, getStockStatus, getStoreVariantProduct, getTotalStock, money } from '../shared/storePresentation';

interface ProductModalProps {
  product: Product | null;
  onClose: () => void;
}

export const ProductModal: React.FC<ProductModalProps> = ({ product, onClose }) => {
  const { addToCart } = useCart();
  const { isAuthenticated } = useAuth();
  const [selectedColor, setSelectedColor] = useState('Padrão');
  const [quantity, setQuantity] = useState(1);
  const [isFavorite, setIsFavorite] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [selectedImageUrl, setSelectedImageUrl] = useState('');

  const availableColors = useMemo(() => {
    if (!product) return [];
    const names = getAvailableColors(product);
    const normalizedNames = names.length > 0 ? names : [getDefaultColor(product)];
    return normalizedNames.map((name) => {
      const variantProduct = getStoreVariantProduct(product, name);
      const image = variantProduct.color_images?.[0]?.image_url || variantProduct.image_url;
      return { name, imageUrl: image || product.image_url, ...getColorVisual(name) };
    });
  }, [product]);

  const activeProduct = useMemo(() => product ? getStoreVariantProduct(product, selectedColor) : null, [product, selectedColor]);

  const imageChoices = useMemo(() => {
    const seen = new Set<string>();
    if (!activeProduct) return [];
    const choices = (activeProduct.color_images || [])
      .filter((image) => product?.store_variants?.length || image.color_name === selectedColor)
      .map((image) => image.image_url);
    if (choices.length === 0 && activeProduct.image_url) choices.push(activeProduct.image_url);
    return choices.filter((imageUrl) => {
      if (!imageUrl || seen.has(imageUrl)) return false;
      seen.add(imageUrl);
      return true;
    });
  }, [activeProduct, product?.store_variants, selectedColor]);

  useEffect(() => {
    setSelectedColor(availableColors[0]?.name || 'Padrão');
    setQuantity(1);
    setFeedback(null);
  }, [product?.id]);

  useEffect(() => {
    setSelectedImageUrl(imageChoices[0] || activeProduct?.image_url || product?.image_url || '');
  }, [activeProduct?.id, imageChoices.join('|')]);

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
  const stockLimit = product.store_variants?.length ? getTotalStock(activeProduct || product) : (selectedStock?.stock_qty ?? product.stock_qty);
  const hasRealReviews = Boolean(activeProduct?.review_summary?.review_count || product.review_summary?.review_count);
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
          <div className="relative min-h-[260px] overflow-hidden bg-chumbo-950 sm:min-h-[440px] lg:min-h-0">
            <img src={selectedImageUrl} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-20 blur-2xl" aria-hidden="true" />
            <div className="absolute inset-0 bg-gradient-to-br from-chumbo-950/35 via-chumbo-950/55 to-chumbo-950" />
            <div className={`relative z-10 grid h-full w-full ${imageChoices.length > 1 ? 'sm:grid-cols-[76px_minmax(0,1fr)]' : ''}`}>
              {imageChoices.length > 1 && (
                <div className="order-2 flex max-w-full gap-2 overflow-x-auto border-t border-white/10 bg-chumbo-950/70 p-3 backdrop-blur-md sm:order-1 sm:flex-col sm:overflow-x-hidden sm:overflow-y-auto sm:border-r sm:border-t-0 sm:p-2.5">
                  {imageChoices.map((imageUrl, index) => (
                    <button
                      type="button"
                      key={imageUrl}
                      onClick={() => setSelectedImageUrl(imageUrl)}
                      className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 bg-white p-0.5 transition ${imageUrl === selectedImageUrl ? 'border-laser-400 shadow-[0_0_0_1px_rgba(34,211,238,0.25)]' : 'border-chumbo-700 opacity-70 hover:border-chumbo-500 hover:opacity-100'}`}
                      aria-label={`Ver foto ${index + 1} da cor ${selectedColor}`}
                    >
                      <img src={imageUrl} alt="" className="h-full w-full rounded-md object-cover" />
                    </button>
                  ))}
                </div>
              )}
              <div className="order-1 flex min-h-0 items-center justify-center sm:order-2">
                <img src={selectedImageUrl} alt={product.title} className="h-52 w-full object-contain p-4 sm:h-80 sm:p-7 lg:h-full lg:max-h-[700px] lg:p-10" />
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-col bg-chumbo-900 p-5 sm:p-8 lg:overflow-y-auto lg:p-10">
            <div className="flex-1">
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

              <h2 id="product-modal-title" className="mt-5 text-2xl font-extrabold leading-tight text-white sm:text-3xl lg:text-[2rem]">{product.title}</h2>

              {hasRealReviews && (
                <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1 text-amber-300">
                      <Star className="h-3.5 w-3.5 fill-amber-300" />
                      <strong>{(activeProduct?.review_summary || product.review_summary)!.average_rating.toFixed(1)}</strong>
                      <span className="text-slate-500">({(activeProduct?.review_summary || product.review_summary)!.review_count})</span>
                    </span>
                </div>
              )}

              <p className="mt-6 whitespace-pre-line text-[15px] leading-7 text-slate-300">{activeProduct?.description || product.description}</p>

              {feedback && <div className="mt-5 rounded-xl border border-chumbo-700 bg-chumbo-950 p-3 text-xs text-slate-300">{feedback}</div>}

              <div className="mt-7 border-t border-chumbo-800 pt-6">
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
                          className={`relative h-16 w-16 overflow-hidden rounded-xl border-2 bg-white p-1 transition ${selectedColor === color.name ? 'border-laser-400 shadow-[0_0_0_2px_rgba(34,211,238,0.16)]' : 'border-chumbo-700 hover:border-chumbo-500'}`}
                          title={color.name}
                          aria-label={`Selecionar cor ${color.name}`}
                          aria-pressed={selectedColor === color.name}
                        >
                          <img src={color.imageUrl} alt="" className="h-full w-full rounded-lg object-cover" />
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

                <div className={`mt-4 inline-flex items-center gap-2 text-xs font-semibold ${stockTextTone}`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {stockCopy}
                </div>
              </div>
            </div>

            <div className="mt-7 border-t border-chumbo-800 pt-6">
              <div className="grid grid-cols-[1fr_auto] items-end gap-4 lg:grid-cols-[minmax(150px,1fr)_auto_minmax(220px,1.2fr)]">
                <div aria-live="polite" aria-label="Total da compra">
                  <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total</span>
                  <span className="mt-1 block whitespace-nowrap text-3xl font-extrabold text-white">{money(purchaseTotal)}</span>
                  {quantity > 1 && (
                    <span className="mt-1 block whitespace-nowrap text-[11px] text-slate-500">{quantity} × {money(selectedPrice)} cada</span>
                  )}
                </div>

                <div className="flex h-12 items-center rounded-xl border border-chumbo-700 bg-chumbo-950 p-1" aria-label="Quantidade">
                  <button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-chumbo-800 hover:text-white" aria-label="Diminuir quantidade">
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-8 text-center text-sm font-bold text-white">{quantity}</span>
                  <button type="button" onClick={() => setQuantity(Math.min(stockLimit || 1, quantity + 1))} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-chumbo-800 hover:text-white" aria-label="Aumentar quantidade">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={stockLimit <= 0}
                  className="col-span-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-extrabold text-chumbo-950 shadow-xl transition hover:bg-slate-200 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 lg:col-span-1"
                >
                  <ShoppingBag className="h-4 w-4" />
                  {stockLimit > 0 ? (isAuthenticated ? 'Adicionar' : 'Entrar para comprar') : 'Sem estoque'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
