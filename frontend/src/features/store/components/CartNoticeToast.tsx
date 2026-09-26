import React from 'react';
import { X } from 'lucide-react';

interface CartNoticeToastProps {
  notice: { title: string; text: string } | null;
  onClose: () => void;
  onOpenCart: () => void;
}

export const CartNoticeToast: React.FC<CartNoticeToastProps> = ({
  notice,
  onClose,
  onOpenCart,
}) => {
  if (!notice) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded-2xl border border-emerald-500/30 bg-chumbo-950 p-4 shadow-2xl sm:left-auto sm:right-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-white">{notice.title}</h3>
          <p className="mt-1 line-clamp-1 text-xs text-slate-400">{notice.text}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-slate-500 hover:text-white"
          aria-label="Fechar notificação"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-chumbo-700 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-chumbo-800"
        >
          Continuar comprando
        </button>
        <button
          type="button"
          onClick={() => {
            onClose();
            onOpenCart();
          }}
          className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-chumbo-950 hover:bg-slate-200"
        >
          Finalizar compra
        </button>
      </div>
    </div>
  );
};
