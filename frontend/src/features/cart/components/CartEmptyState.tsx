import React from 'react';
import { ArrowRight, ShoppingBag } from 'lucide-react';

interface CartEmptyStateProps {
  onClose: () => void;
}

export const CartEmptyState: React.FC<CartEmptyStateProps> = ({ onClose }) => {
  return (
    <div className="flex h-full min-h-[420px] flex-col items-center justify-center px-4 py-16 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-chumbo-700 bg-chumbo-900 text-laser-400 shadow-xl shadow-black/20">
        <ShoppingBag className="h-9 w-9 stroke-[1.7]" />
      </div>
      <h3 className="mt-6 text-xl font-extrabold text-white">Seu carrinho está vazio</h3>
      <p className="mt-2 max-w-xs text-sm leading-6 text-slate-400">
        Encontre uma peça, escolha a cor e ela aparece aqui para você revisar.
      </p>
      <button
        type="button"
        onClick={onClose}
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-extrabold text-chumbo-950 transition-colors hover:bg-slate-200"
      >
        Explorar catálogo
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
};
