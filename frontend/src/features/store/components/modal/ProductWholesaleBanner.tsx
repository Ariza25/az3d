import React from 'react';
import { Sparkles } from 'lucide-react';

interface ProductWholesaleBannerProps {
  quantity: number;
  wholesale: {
    percent: number;
    badge: string | null;
  };
}

export const ProductWholesaleBanner: React.FC<ProductWholesaleBannerProps> = ({
  quantity,
  wholesale,
}) => {
  return (
    <div className="rounded-2xl border border-laser-400/20 bg-laser-400/5 p-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-bold text-laser-300">
          <Sparkles className="h-3.5 w-3.5 text-laser-400" />
          Desconto de Atacado
        </span>
        {wholesale.percent > 0 ? (
          <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-[11px] font-extrabold text-emerald-300 animate-pulse">
            {wholesale.badge} ativo!
          </span>
        ) : (
          <span className="text-[10px] text-slate-400">Compre mais e pague menos</span>
        )}
      </div>
      <div className="mt-2.5 grid grid-cols-3 gap-2 text-center text-[11px]">
        <div
          className={`rounded-xl border p-2 transition ${
            quantity >= 3 && quantity <= 5
              ? 'border-emerald-400 bg-emerald-500/20 font-bold text-emerald-300 shadow-sm'
              : 'border-chumbo-800 bg-chumbo-900/60 text-slate-400'
          }`}
        >
          <span className="block text-[10px]">3 a 5 un</span>
          <span className="text-xs font-extrabold text-white">2% OFF</span>
        </div>
        <div
          className={`rounded-xl border p-2 transition ${
            quantity >= 6 && quantity <= 9
              ? 'border-emerald-400 bg-emerald-500/20 font-bold text-emerald-300 shadow-sm'
              : 'border-chumbo-800 bg-chumbo-900/60 text-slate-400'
          }`}
        >
          <span className="block text-[10px]">6 a 9 un</span>
          <span className="text-xs font-extrabold text-white">5% OFF</span>
        </div>
        <div
          className={`rounded-xl border p-2 transition ${
            quantity >= 10
              ? 'border-emerald-400 bg-emerald-500/20 font-bold text-emerald-300 shadow-sm'
              : 'border-chumbo-800 bg-chumbo-900/60 text-slate-400'
          }`}
        >
          <span className="block text-[10px]">10+ un</span>
          <span className="text-xs font-extrabold text-white">7% OFF</span>
        </div>
      </div>
    </div>
  );
};
