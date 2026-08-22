import React, { useEffect, useState } from 'react';
import { Heart, X, ShoppingBag } from 'lucide-react';
import { ProductFavorite } from '../types';
import { api } from '../services/api';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';

interface FavoritesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenLogin: () => void;
}

export const FavoritesModal: React.FC<FavoritesModalProps> = ({ isOpen, onClose, onOpenLogin }) => {
  const { isAuthenticated } = useAuth();
  const { addToCart } = useCart();
  const [favorites, setFavorites] = useState<ProductFavorite[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    if (!isAuthenticated) {
      setFavorites([]);
      return;
    }

    api.getMyFavorites().then(setFavorites).catch(() => setFavorites([]));
  }, [isOpen, isAuthenticated]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className="glass-panel w-full max-w-3xl overflow-hidden rounded-3xl border border-chumbo-700 bg-chumbo-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-chumbo-800 bg-chumbo-950 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300">
              <Heart className="h-5 w-5 fill-rose-300" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-white">Meus favoritos</h2>
              <p className="text-xs text-slate-400">Produtos salvos na sua conta de comprador</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full border border-chumbo-700 bg-chumbo-900 p-2 text-slate-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[65vh] overflow-y-auto p-5">
          {!isAuthenticated ? (
            <div className="py-12 text-center">
              <p className="text-sm text-slate-300">Entre como comprador para ver seus favoritos.</p>
              <button onClick={onOpenLogin} className="mt-4 rounded-xl bg-white px-5 py-2 text-sm font-bold text-chumbo-950">Entrar</button>
            </div>
          ) : favorites.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">Nenhum produto favoritado ainda.</div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {favorites.map((favorite) => {
                const product = favorite.product;
                if (!product) return null;
                const cover = product.color_images?.[0]?.image_url || product.image_url;
                return (
                  <div key={favorite.id} className="rounded-2xl border border-chumbo-800 bg-chumbo-950/70 p-3">
                    <div className="flex gap-3">
                      <img src={cover} alt={product.title} className="h-20 w-20 shrink-0 rounded-xl border border-chumbo-800 object-cover" />
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-sm font-bold text-white">{product.title}</h3>
                        <p className="mt-1 line-clamp-2 text-xs text-slate-400">{product.description}</p>
                        <div className="mt-3 flex items-center justify-between">
                          <span className="text-sm font-extrabold text-white">R$ {product.price.toFixed(2).replace('.', ',')}</span>
                          <button onClick={() => addToCart(product)} className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-chumbo-950">
                            <ShoppingBag className="mr-1 inline h-3.5 w-3.5" />
                            Adicionar
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
