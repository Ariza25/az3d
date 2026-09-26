import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { ProductColorStock } from '../../../../types';

interface ProductColorStockManagerProps {
  colorStocks: ProductColorStock[];
  onAddColorStock: () => void;
  onRemoveColorStock: (index: number) => void;
  onUpdateColorStock: (index: number, field: 'color_name' | 'stock_qty', value: string) => void;
}

export const ProductColorStockManager: React.FC<ProductColorStockManagerProps> = ({
  colorStocks,
  onAddColorStock,
  onRemoveColorStock,
  onUpdateColorStock,
}) => {
  return (
    <div className="space-y-3 rounded-xl border border-chumbo-800 bg-chumbo-950/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <label className="text-xs font-mono text-slate-300 block uppercase">Estoque por cor</label>
        <button
          type="button"
          onClick={onAddColorStock}
          className="flex items-center gap-1.5 rounded-lg border border-chumbo-700 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-chumbo-800"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Adicionar estoque</span>
        </button>
      </div>

      {colorStocks.map((stock, index) => (
        <div key={index} className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_120px_auto]">
          <input
            type="text"
            value={stock.color_name}
            onChange={(e) => onUpdateColorStock(index, 'color_name', e.target.value)}
            placeholder="Ex: Preto Slate"
            className="w-full bg-chumbo-950 border border-chumbo-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-laser-400"
          />
          <input
            type="number"
            value={stock.stock_qty}
            onChange={(e) => onUpdateColorStock(index, 'stock_qty', e.target.value)}
            className="w-full bg-chumbo-950 border border-chumbo-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-laser-400"
          />
          <button
            type="button"
            onClick={() => onRemoveColorStock(index)}
            className="flex h-10 items-center justify-center rounded-xl border border-chumbo-700 px-3 text-slate-400 hover:bg-rose-500/10 hover:text-rose-300"
            title="Remover estoque de cor"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
};
