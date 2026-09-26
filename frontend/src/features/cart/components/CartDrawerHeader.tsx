import React from 'react';
import { ArrowLeft, ShoppingBag, X } from 'lucide-react';

interface CartDrawerHeaderProps {
  title: string;
  subtitle: string;
  isSubPage: boolean;
  onBack: () => void;
  onClose: () => void;
}

export const CartDrawerHeader: React.FC<CartDrawerHeaderProps> = ({
  title,
  subtitle,
  isSubPage,
  onBack,
  onClose,
}) => {
  return (
    <header className="flex min-h-20 items-center justify-between border-b border-chumbo-850 bg-chumbo-900/70 px-5 py-4 sm:px-7 shrink-0">
      <div className="flex min-w-0 items-center gap-3">
        {isSubPage ? (
          <button
            type="button"
            onClick={onBack}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-chumbo-700 text-slate-300 transition-colors hover:bg-chumbo-800 hover:text-white"
            aria-label="Voltar ao carrinho"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-chumbo-700 bg-chumbo-800 text-laser-400">
            <ShoppingBag className="h-5 w-5" />
          </div>
        )}
        <div className="min-w-0">
          <h2 id="cart-drawer-title" className="truncate text-lg font-extrabold text-white">
            {title}
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={onClose}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-chumbo-800 hover:text-white"
        aria-label="Fechar carrinho"
      >
        <X className="h-5 w-5" />
      </button>
    </header>
  );
};
