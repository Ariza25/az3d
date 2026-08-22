import React from 'react';
import { Product } from '../types';
import { ShoppingBag, Clock, Layers, Maximize2 } from 'lucide-react';
import { useCart } from '../context/CartContext';

interface ProductCardProps {
  product: Product;
  onOpenModal: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onOpenModal }) => {
  const { addToCart } = useCart();
  const coverImage = product.color_images?.[0]?.image_url || product.image_url;

  return (
    <div className="glass-card rounded-2xl overflow-hidden group flex flex-col justify-between border border-chumbo-800 hover:border-chumbo-600 transition-all duration-300">
      <div
        className="relative h-64 overflow-hidden bg-chumbo-950 cursor-pointer"
        onClick={() => onOpenModal(product)}
      >
        <img
          src={coverImage}
          alt={product.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-chumbo-950 via-transparent to-transparent opacity-80" />

        <div className="absolute top-3 left-3 bg-chumbo-950/80 backdrop-blur-md border border-chumbo-700/80 px-2.5 py-1 rounded-lg flex items-center space-x-1.5 text-[11px] font-mono text-slate-200">
          <Layers className="w-3.5 h-3.5 text-laser-400" />
          <span>{product.material}</span>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenModal(product);
          }}
          className="absolute top-3 right-3 p-2 rounded-xl bg-chumbo-950/80 hover:bg-chumbo-800 text-slate-300 hover:text-white border border-chumbo-700/80 opacity-0 group-hover:opacity-100 transition-all duration-200"
          title="Ver especificacoes tecnicas completas"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
        <div>
          <h3
            onClick={() => onOpenModal(product)}
            className="text-base font-bold text-white group-hover:text-slate-200 transition-colors line-clamp-1 cursor-pointer"
          >
            {product.title}
          </h3>
          <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
            {product.description}
          </p>
        </div>

        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 bg-chumbo-900/80 px-3 py-2 rounded-xl border border-chumbo-800">
          <div className="flex items-center space-x-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>{product.print_time}</span>
          </div>
          <span className="text-slate-500">/</span>
          <span>{product.layer_height}</span>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-chumbo-850">
          <div>
            <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block">
              Preco
            </span>
            <span className="text-xl font-extrabold text-white">
              R$ {product.price.toFixed(2).replace('.', ',')}
            </span>
          </div>

          <button
            onClick={() => addToCart(product)}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-200 text-chumbo-950 font-bold text-xs transition-all active:scale-95 shadow-md"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Adicionar</span>
          </button>
        </div>
      </div>
    </div>
  );
};
