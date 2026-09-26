import React from 'react';

interface ProductQuickSpecsProps {
  dimensions: string | null;
  material: string;
  stockStatus: {
    canBuy: boolean;
    label: string;
    tone: string;
  };
}

export const ProductQuickSpecs: React.FC<ProductQuickSpecsProps> = ({
  dimensions,
  material,
  stockStatus,
}) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 p-3 sm:p-3.5 rounded-xl bg-chumbo-950/80 border border-chumbo-800 text-xs">
      <div className="min-w-0">
        <span className="text-[10px] text-slate-400 uppercase font-mono block">Dimensões</span>
        <span className="font-semibold text-slate-100 truncate block" title={dimensions || 'Sob medida'}>
          {dimensions || 'Sob medida'}
        </span>
      </div>
      <div className="min-w-0">
        <span className="text-[10px] text-slate-400 uppercase font-mono block">Material</span>
        <span className="font-semibold text-slate-100 truncate block" title={material}>
          {material}
        </span>
      </div>
      <div className="min-w-0 col-span-2 sm:col-span-1">
        <span className="text-[10px] text-slate-400 uppercase font-mono block">Disponibilidade</span>
        <span className={`font-semibold truncate block ${stockStatus.canBuy ? 'text-emerald-400' : 'text-rose-400'}`}>
          {stockStatus.label}
        </span>
      </div>
    </div>
  );
};
