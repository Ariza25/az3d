import React, { useEffect, useMemo, useState } from 'react';
import { Product, ProductReview } from '../types';
import { X, Layers, Clock, Ruler, Weight, ShoppingBag, Check, Heart, Star } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { getStockStatus, money } from '../shared/storePresentation';

interface ProductModalProps {
  product: Product | null;
  onClose: () => void;
}

const COLOR_OPTIONS = [
  { name: 'Preto Slate', hex: '#18181b', border: '#3f3f46' },
  { name: 'Branco Marmore', hex: '#f4f4f5', border: '#e4e4e7' },
  { name: 'Cinza Chumbo', hex: '#3f3f46', border: '#71717a' },
  { name: 'PLA Silk Dupla Cor', hex: '#06b6d4', border: '#22d3ee' },
  { name: 'Bronze Metalizado', hex: '#d97706', border: '#f59e0b' },
];

const getColorVisual = (name: string) => {
  const normalized = name.toLowerCase();
  return (
    COLOR_OPTIONS.find((color) => color.name.toLowerCase() === normalized) ||
    COLOR_OPTIONS.find((color) => normalized.includes(color.name.toLowerCase())) ||
    { name, hex: '#64748b', border: '#94a3b8' }
  );
};

export const ProductModal: React.FC<ProductModalProps> = ({ product, onClose }) => {
  const { addToCart } = useCart();
  const { isAuthenticated } = useAuth();
  const [selectedColor, setSelectedColor] = useState('Preto Slate');
  const [quantity, setQuantity] = useState(1);
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const availableColors = useMemo(() => {
    const colorImages = product?.color_images?.filter((image) => image.color_name && image.image_url) || [];
    if (colorImages.length > 0) {
      return colorImages.map((image) => ({
        ...getColorVisual(image.color_name),
        name: image.color_name,
        imageUrl: image.image_url,
      }));
    }

    return COLOR_OPTIONS.map((color) => ({
      ...color,
      imageUrl: product?.image_url || '',
    }));
  }, [product]);

  useEffect(() => {
    setSelectedColor(availableColors[0]?.name || 'Preto Slate');
    setQuantity(1);
    setFeedback(null);
  }, [availableColors, product?.id]);

  useEffect(() => {
    if (!product) return;

    api.getProductReviews(product.id).then(setReviews).catch(() => setReviews([]));
    if (isAuthenticated) {
      api.getMyFavorites(product.tenant_id)
        .then((favorites) => setIsFavorite(favorites.some((favorite) => favorite.product_id === product.id)))
        .catch(() => setIsFavorite(false));
    } else {
      setIsFavorite(false);
    }
  }, [product, isAuthenticated]);

  if (!product) return null;

  const selectedVariant = product.variants?.find(
    (variant) => variant.color_name === selectedColor && variant.is_active
  );
  const selectedStock = product.color_stocks?.find((stock) => stock.color_name === selectedColor);
  const selectedImageUrl =
    availableColors.find((color) => color.name === selectedColor)?.imageUrl || product.image_url;
  const selectedPrice = selectedVariant?.price || product.price;
  const selectedMaterial = selectedVariant?.material || product.material;
  const selectedLayerHeight = selectedVariant?.layer_height || product.layer_height;
  const selectedPrintTime = selectedVariant?.print_time || product.print_time;
  const stockLimit = selectedStock?.stock_qty ?? product.stock_qty;
  const hasRealReviews = Boolean(product.review_summary?.review_count);
  const stockStatus = getStockStatus({ ...product, color_stocks: undefined, stock_qty: stockLimit, in_stock: stockLimit > 0 && product.in_stock });

  const handleAddToCart = () => {
    if (addToCart({ ...product, price: selectedPrice }, quantity, selectedColor)) {
      onClose();
    }
  };

  const toggleFavorite = async () => {
    if (!isAuthenticated) {
      setFeedback('Entre como comprador para favoritar.');
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
    } catch (err: any) {
      setFeedback(err.message || 'Nao foi possivel atualizar favorito.');
    }
  };

  const submitReview = async () => {
    if (!isAuthenticated) {
      setFeedback('Entre como comprador para avaliar.');
      return;
    }

    try {
      await api.saveProductReview(product.id, reviewRating, reviewComment, product.tenant_id);
      const updatedReviews = await api.getProductReviews(product.id, product.tenant_id);
      setReviews(updatedReviews);
      setReviewComment('');
      setFeedback('Avaliacao salva.');
    } catch (err: any) {
      setFeedback(err.message || 'Avaliacao disponivel apenas para compradores deste produto.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-black/80 backdrop-blur-md">
      <div
        className="glass-panel w-full max-w-4xl rounded-3xl overflow-hidden border border-chumbo-700 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 z-10 p-2.5 rounded-full bg-chumbo-950/80 text-slate-400 hover:text-white border border-chumbo-700 transition-colors">
          <X className="w-5 h-5" />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2">
          <div className="relative bg-chumbo-950 p-6 flex items-center justify-center min-h-[320px]">
            <img src={selectedImageUrl} alt={product.title} className="w-full h-80 object-cover rounded-2xl border border-chumbo-800 shadow-xl" />
          </div>

          <div className="p-6 md:p-8 flex flex-col justify-between space-y-6 bg-chumbo-900">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center space-x-2 text-xs font-mono text-laser-400">
                  <Layers className="w-4 h-4" />
                  <span className="uppercase tracking-widest font-bold">Detalhes do produto</span>
                </div>
                <button type="button" onClick={toggleFavorite} className={`rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${isFavorite ? 'border-rose-400/50 bg-rose-500/10 text-rose-300' : 'border-chumbo-700 bg-chumbo-950 text-slate-300 hover:text-white'}`}>
                  <Heart className={`inline h-4 w-4 ${isFavorite ? 'fill-rose-300' : ''}`} />
                </button>
              </div>

              <h2 className="text-2xl font-extrabold text-white">{product.title}</h2>

              {hasRealReviews && (
                <div className="flex items-center gap-2 text-sm text-amber-300">
                  <Star className="h-4 w-4 fill-amber-300" />
                  <span className="font-bold">{product.review_summary!.average_rating.toFixed(1)}</span>
                  <span className="text-slate-500">({product.review_summary!.review_count} avaliacoes)</span>
                </div>
              )}

              {feedback && <div className="rounded-xl border border-chumbo-700 bg-chumbo-950 p-3 text-xs text-slate-300">{feedback}</div>}

              <p className="text-sm text-slate-300 leading-relaxed font-normal">{product.description}</p>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <Spec icon={<Layers className="w-4 h-4 text-slate-400" />} label="Material" value={selectedMaterial} />
                <Spec icon={<Clock className="w-4 h-4 text-slate-400" />} label="Prazo estimado" value={selectedPrintTime} />
                <Spec icon={<Ruler className="w-4 h-4 text-slate-400" />} label="Dimensoes (XYZ)" value={product.dimensions} />
                <Spec icon={<Weight className="w-4 h-4 text-slate-400" />} label="Acabamento / Peso" value={selectedLayerHeight} />
              </div>

              <div className="space-y-2 pt-2">
                <label className="text-xs font-mono text-slate-400 uppercase tracking-wider block">
                  Cor selecionada: <span className="text-white font-bold">{selectedColor}</span>
                </label>
                <div className="flex items-center space-x-3">
                  {availableColors.map((col) => (
                    <button
                      key={col.name}
                      onClick={() => setSelectedColor(col.name)}
                      className={`w-7 h-7 rounded-full flex items-center justify-center transition-transform ${selectedColor === col.name ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-chumbo-900' : 'hover:scale-110'}`}
                      style={{ backgroundColor: col.hex, border: `1px solid ${col.border}` }}
                      title={col.name}
                    >
                      {selectedColor === col.name && <Check className={`w-3.5 h-3.5 ${col.hex === '#f4f4f5' ? 'text-black' : 'text-white'}`} />}
                    </button>
                  ))}
                </div>
                <div className={`rounded-xl border px-3 py-2 text-xs ${stockStatus.tone}`}>
                  {stockLimit > 0
                    ? `${stockLimit <= 3 ? 'Ultimas unidades: ' : ''}${stockLimit} unidade${stockLimit === 1 ? '' : 's'} disponivel${stockLimit === 1 ? '' : 's'} nesta cor.`
                    : 'Esta cor esta sem estoque no momento.'}
                </div>
              </div>

              <div className="rounded-xl border border-chumbo-800 bg-chumbo-950/70 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono uppercase text-slate-400">Avaliar produto</span>
                  <select value={reviewRating} onChange={(e) => setReviewRating(Number(e.target.value))} className="rounded-lg border border-chumbo-700 bg-chumbo-900 px-2 py-1 text-xs text-white">
                    {[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating} estrelas</option>)}
                  </select>
                </div>
                <textarea value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} rows={2} placeholder="Conte como foi sua compra" className="mt-2 w-full rounded-lg border border-chumbo-800 bg-chumbo-950 px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-laser-400" />
                <button type="button" onClick={submitReview} className="mt-2 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-chumbo-950 hover:bg-slate-200">Salvar avaliacao</button>
              </div>

              {reviews.length > 0 && (
                <div className="max-h-24 space-y-2 overflow-y-auto pr-1">
                  {reviews.slice(0, 3).map((review) => (
                    <div key={review.id} className="rounded-lg border border-chumbo-800 bg-chumbo-950/60 p-2 text-xs text-slate-300">
                      <span className="font-bold text-amber-300">{review.rating}/5</span>
                      {review.comment && <span className="ml-2">{review.comment}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-chumbo-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-mono text-slate-400 block">Preco unitario</span>
                <span className="text-2xl font-extrabold text-white">{money(selectedPrice)}</span>
              </div>

              <div className="flex items-center space-x-3">
                <div className="flex items-center bg-chumbo-950 border border-chumbo-800 rounded-xl p-1">
                  <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-8 h-8 rounded-lg text-slate-400 hover:text-white flex items-center justify-center hover:bg-chumbo-800">-</button>
                  <span className="w-8 text-center font-mono font-bold text-sm text-white">{quantity}</span>
                  <button onClick={() => setQuantity(Math.min(stockLimit || 1, quantity + 1))} className="w-8 h-8 rounded-lg text-slate-400 hover:text-white flex items-center justify-center hover:bg-chumbo-800">+</button>
                </div>

                <button onClick={handleAddToCart} disabled={stockLimit <= 0} className="flex items-center space-x-2 px-6 py-3 rounded-xl bg-white hover:bg-slate-200 text-chumbo-950 font-extrabold text-sm transition-all shadow-xl active:scale-95 disabled:cursor-not-allowed disabled:opacity-50">
                  <ShoppingBag className="w-4 h-4" />
                  <span>{stockLimit > 0 ? isAuthenticated ? 'Adicionar ao carrinho' : 'Entrar para comprar' : 'Sem estoque'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Spec = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="bg-chumbo-950/80 p-3 rounded-xl border border-chumbo-800 flex items-center space-x-3">
    {icon}
    <div>
      <span className="text-[10px] text-slate-400 block uppercase font-mono">{label}</span>
      <span className="text-xs font-bold text-slate-100">{value}</span>
    </div>
  </div>
);
