import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { ProductVariant } from '../../../../types';

interface ProductVariantsManagerProps {
  variants: ProductVariant[];
  onAddVariant: () => void;
  onRemoveVariant: (index: number) => void;
  onUpdateVariant: (index: number, field: string, value: string | boolean) => void;
}

export const ProductVariantsManager: React.FC<ProductVariantsManagerProps> = ({
  variants,
  onAddVariant,
  onRemoveVariant,
  onUpdateVariant,
}) => {
  return (
    <div className="space-y-3 rounded-xl border border-chumbo-800 bg-chumbo-950/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <label className="text-xs font-mono text-slate-300 block uppercase">
          Variações por cor/acabamento
        </label>
        <button
          type="button"
          onClick={onAddVariant}
          className="flex items-center gap-1.5 rounded-lg border border-chumbo-700 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-chumbo-800"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Adicionar variação</span>
        </button>
      </div>

      {variants.map((variant, index) => (
        <div
          key={index}
          className="grid grid-cols-1 gap-3 rounded-xl border border-chumbo-800 p-3 md:grid-cols-3"
        >
          <input
            value={variant.variation_name || variant.color_name}
            onChange={(e) => {
              onUpdateVariant(index, 'variation_name', e.target.value);
              onUpdateVariant(index, 'color_name', e.target.value);
            }}
            placeholder="Variação (cor, tamanho, voltagem...)"
            className="w-full bg-chumbo-950 border border-chumbo-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-laser-400"
          />
          <input
            type="number"
            step="0.01"
            value={variant.price}
            onChange={(e) => onUpdateVariant(index, 'price', e.target.value)}
            placeholder="Preço"
            className="w-full bg-chumbo-950 border border-chumbo-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-laser-400"
          />
          <input
            value={variant.print_time || ''}
            onChange={(e) => onUpdateVariant(index, 'print_time', e.target.value)}
            placeholder="Tempo"
            className="w-full bg-chumbo-950 border border-chumbo-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-laser-400"
          />
          <input
            value={variant.material || ''}
            onChange={(e) => onUpdateVariant(index, 'material', e.target.value)}
            placeholder="Material"
            className="w-full bg-chumbo-950 border border-chumbo-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-laser-400"
          />
          <input
            value={variant.layer_height || ''}
            onChange={(e) => onUpdateVariant(index, 'layer_height', e.target.value)}
            placeholder="Resolução"
            className="w-full bg-chumbo-950 border border-chumbo-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-laser-400"
          />
          <div className="flex items-center gap-2">
            <input
              value={variant.weight || ''}
              onChange={(e) => onUpdateVariant(index, 'weight', e.target.value)}
              placeholder="Peso"
              className="min-w-0 flex-1 bg-chumbo-950 border border-chumbo-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-laser-400"
            />
            <button
              type="button"
              onClick={() => onRemoveVariant(index)}
              className="flex h-10 items-center justify-center rounded-xl border border-chumbo-700 px-3 text-slate-400 hover:bg-rose-500/10 hover:text-rose-300"
              title="Remover variação"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
