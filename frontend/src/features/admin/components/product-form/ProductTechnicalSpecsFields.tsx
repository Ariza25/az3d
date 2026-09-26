import React from 'react';
import { Layers } from 'lucide-react';
import { ProductInput } from '../../../../types';

interface ProductTechnicalSpecsFieldsProps {
  formData: ProductInput;
  onChangeField: <K extends keyof ProductInput>(field: K, value: ProductInput[K]) => void;
}

export const ProductTechnicalSpecsFields: React.FC<ProductTechnicalSpecsFieldsProps> = ({
  formData,
  onChangeField,
}) => {
  return (
    <div className="pt-4 border-t border-chumbo-800 space-y-4">
      <div className="flex items-center space-x-2 text-xs font-mono text-laser-400">
        <Layers className="w-4 h-4" />
        <span className="uppercase tracking-widest font-bold">
          Especificações Técnicas de Fatiamento 3D
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-mono text-slate-400 block uppercase">Material Utilizado</label>
          <input
            type="text"
            value={formData.material}
            onChange={(e) => onChangeField('material', e.target.value)}
            placeholder="Ex: PLA Silk, PETG Carbon Fiber, Resina 8K"
            className="w-full bg-chumbo-950 border border-chumbo-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-laser-400"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-mono text-slate-400 block uppercase">Resolução de Camada</label>
          <input
            type="text"
            value={formData.layer_height}
            onChange={(e) => onChangeField('layer_height', e.target.value)}
            placeholder="Ex: 0.12mm (Ultra Detalhe)"
            className="w-full bg-chumbo-950 border border-chumbo-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-laser-400"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-mono text-slate-400 block uppercase">Tempo de Impressão</label>
          <input
            type="text"
            value={formData.print_time}
            onChange={(e) => onChangeField('print_time', e.target.value)}
            placeholder="Ex: 12 horas"
            className="w-full bg-chumbo-950 border border-chumbo-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-laser-400"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-mono text-slate-400 block uppercase">Dimensões (XYZ)</label>
          <input
            type="text"
            value={formData.dimensions}
            onChange={(e) => onChangeField('dimensions', e.target.value)}
            placeholder="Ex: 150 x 150 x 200 mm"
            className="w-full bg-chumbo-950 border border-chumbo-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-laser-400"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-mono text-slate-400 block uppercase">Peso da Peça</label>
          <input
            type="text"
            value={formData.weight}
            onChange={(e) => onChangeField('weight', e.target.value)}
            placeholder="Ex: 250g"
            className="w-full bg-chumbo-950 border border-chumbo-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-laser-400"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-mono text-slate-400 block uppercase">Qtd em Estoque</label>
          <input
            type="number"
            value={formData.stock_qty}
            onChange={(e) => onChangeField('stock_qty', parseInt(e.target.value, 10) || 0)}
            className="w-full bg-chumbo-950 border border-chumbo-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-laser-400"
          />
        </div>
      </div>
    </div>
  );
};
