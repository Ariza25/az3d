import React, { useEffect, useMemo, useState } from 'react';
import { Product } from '../types';
import { Check, Heart, Layers, Minus, Plus, ShoppingBag, Star, X } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { getAvailableColors, getColorVisual, getDefaultColor, getStockStatus, money } from '../shared/storePresentation';

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

  const availableColors = useMemo(() => {
    if (!product) return [];
    const names = getAvailableColors(product);
    const normalizedNames = names.length > 0 ? names : [getDefaultColor(product)];
    return normalizedNames.map((name) => {
      const image = product.color_images?.find((item) => item.color_name === name)?.image_url;
      return { name, imageUrl: image || product.image_url, ...getColorVisual(name) };
    });
  }, [product]);

  const imageChoices = useMemo(() => {
    const seen = new Set<string>();
    return availableColors.filter((color) => {
      if (!color.imageUrl || seen.has(color.imageUrl)) return false;
      seen.add(color.imageUrl);
      return true;
    });
  }, [availableColors]);

  useEffect(() => {
    setSelectedColor(availableColors[0]?.name || 'Padrão');
    setQuantity(1);
    setFeedback(null);
  }, [availableColors, product?.id]);

  useEffect(() => {
    if (!product) return;
    if (isAuthenticated) {
      api.getMyFavorites(product.tenant_id)
        .then((favorites) => setIsFavorite(favorites.some((favorite) => favorite.product_id === product.id)))
        .catch(() => setIsFavorite(false));
    } else {
      setIsFavorite(false);
    }
  }, [product, isAuthenticated]);

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

  const selectedVariant = product.variants?.find(
    (variant) => variant.color_name === selectedColor && variant.is_active
  );
  const selectedStock = product.color_stocks?.find((stock) => stock.color_name === selectedColor);
  const selectedImageUrl = availableColors.find((color) => color.name === selectedColor)?.imageUrl || product.image_url;
  const selectedPrice = selectedVariant?.price || product.price;
  const stockLimit = selectedStock?.stock_qty ?? product.stock_qty;
  const hasRealReviews = Boolean(product.review_summary?.review_count);
  const stockStatus = getStockStatus({ ...product, color_stocks: undefined, stock_qty: stockLimit, in_stock: stockLimit > 0 && product.in_stock });
  const stockTextTone = !stockStatus.canBuy ? 'text-red-300' : stockLimit <= 3 ? 'text-amber-300' : 'text-emerald-300';
  const stockCopy = stockLimit <= 0
    ? 'Sem estoque no momento'
    : stockLimit <= 3
      ? `${stockLimit} ${stockLimit === 1 ? 'unidade disponível' : 'unidades disponíveis'}`
      : `${stockLimit} unidades disponíveis`;

  const handleAddToCart = () => {
    if (addToCart({ ...product, price: selectedPrice }, quantity, selectedColor)) {
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
        await api.removeProductFavorite(product.id, product.tenant_id);
        setIsFavorite(false);
      } else {
        await api.addProductFavorite(product.id, product.tenant_id);
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
        className="glass-panel relative max-h-[calc(100vh-1.5rem)] w-full max-w-6xl overflow-y-auto rounded-3xl border border-chumbo-700 shadow-2xl animate-in fade-in zoom-in-95 duration-200 sm:max-h-[calc(100vh-3rem)] lg:overflow-hidden"
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

        <div className="grid lg:h-[620px] lg:max-h-[calc(100vh-3rem)] lg:grid-cols-[52fr_48fr]">
          <div className="relative flex min-h-[200px] items-center justify-center overflow-hidden bg-chumbo-950 sm:min-h-[440px] lg:min-h-0">
            <img src={selectedImageUrl} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-20 blur-2xl" aria-hidden="true" />
            <div className="absolute inset-0 bg-gradient-to-br from-chumbo-950/35 via-chumbo-950/55 to-chumbo-950" />
            <img src={selectedImageUrl} alt={product.title} className="relative z-10 h-48 w-full object-contain p-3 sm:h-80 sm:p-6 lg:h-full lg:max-h-[620px] lg:p-10" />

            {imageChoices.length > 1 && (
              <div className="absolute bottom-5 left-5 z-20 flex gap-2 rounded-2xl border border-white/10 bg-chumbo-950/75 p-2 backdrop-blur-md">
                {imageChoices.map((choice) => (
                  <button
                    type="button"
                    key={`${choice.name}-${choice.imageUrl}`}
                    onClick={() => selectColor(choice.name)}
                    className={`h-14 w-14 overflow-hidden rounded-xl border bg-chumbo-900 transition ${choice.imageUrl === selectedImageUrl ? 'border-white ring-1 ring-white' : 'border-chumbo-700 opacity-70 hover:opacity-100'}`}
                    aria-label={`Ver imagem da cor ${choice.name}`}
                  >
                    <img src={choice.imageUrl} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
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

              <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                <span>{product.category?.name || 'Catálogo'}</span>
                {product.sku && <><span aria-hidden="true">·</span><span>SKU {product.sku}</span></>}
                {hasRealReviews && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1 text-amber-300">
                      <Star className="h-3.5 w-3.5 fill-amber-300" />
                      <strong>{product.review_summary!.average_rating.toFixed(1)}</strong>
                      <span className="text-slate-500">({product.review_summary!.review_count})</span>
                    </span>
                  </>
                )}
              </div>

              <p className="mt-6 whitespace-pre-line text-[15px] leading-7 text-slate-300">{product.description}</p>

              {feedback && <div className="mt-5 rounded-xl border border-chumbo-700 bg-chumbo-950 p-3 text-xs text-slate-300">{feedback}</div>}

              <div className="mt-7 border-t border-chumbo-800 pt-6">
                {availableColors.length > 1 ? (
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Escolha a cor</span>
                      <span className="text-sm font-bold text-white">{selectedColor}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      {availableColors.map((color) => (
                        <button
                          type="button"
                          key={color.name}
                          onClick={() => selectColor(color.name)}
                          className={`flex h-10 w-10 items-center justify-center rounded-full transition ${selectedColor === color.name ? 'ring-2 ring-white ring-offset-2 ring-offset-chumbo-900' : 'hover:scale-110'}`}
                          style={{ backgroundColor: color.hex, border: `1px solid ${color.border}` }}
                          title={color.name}
                          aria-label={`Selecionar cor ${color.name}`}
                        >
                          {selectedColor === color.name && <Check className={`h-4 w-4 ${color.hex === '#f8fafc' ? 'text-black' : 'text-white'}`} />}
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
              <div className="grid grid-cols-[1fr_auto] items-end gap-4 lg:grid-cols-[auto_auto_minmax(180px,1fr)]">
                <div>
                  <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Preço</span>
                  <span className="mt-1 block whitespace-nowrap text-3xl font-extrabold text-white">{money(selectedPrice)}</span>
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
