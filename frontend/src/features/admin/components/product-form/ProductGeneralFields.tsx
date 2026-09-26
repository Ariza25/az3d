import React from 'react';
import { Category, ProductInput } from '../../../../types';

interface ProductGeneralFieldsProps {
  formData: ProductInput;
  categories: Category[];
  onChangeField: <K extends keyof ProductInput>(field: K, value: ProductInput[K]) => void;
  onUploadMainImage: (file: File) => void;
}

export const ProductGeneralFields: React.FC<ProductGeneralFieldsProps> = ({
  formData,
  categories,
  onChangeField,
  onUploadMainImage,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="md:col-span-2 space-y-1.5">
        <label className="text-xs font-mono text-slate-300 block uppercase">Título do Produto *</label>
        <input
          type="text"
          required
          value={formData.title}
          onChange={(e) => onChangeField('title', e.target.value)}
          placeholder="Ex: Dragão Articulado Guardião Ember"
          className="w-full bg-chumbo-950 border border-chumbo-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-laser-400 transition-colors"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-mono text-slate-300 block uppercase">Preço (R$) *</label>
        <input
          type="number"
          step="0.01"
          required
          value={formData.price}
          onChange={(e) => onChangeField('price', parseFloat(e.target.value) || 0)}
          className="w-full bg-chumbo-950 border border-chumbo-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-laser-400 transition-colors"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-mono text-slate-300 block uppercase">SKU interno</label>
        <input
          type="text"
          value={formData.sku || ''}
          onChange={(e) => onChangeField('sku', e.target.value)}
          placeholder="Ex: AZ3D-VASO-001"
          className="w-full bg-chumbo-950 border border-chumbo-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-laser-400 transition-colors"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-mono text-slate-300 block uppercase">Categoria *</label>
        <select
          value={formData.category_id}
          onChange={(e) => onChangeField('category_id', parseInt(e.target.value, 10))}
          className="w-full bg-chumbo-950 border border-chumbo-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-laser-400 transition-colors"
        >
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-mono text-slate-300 block uppercase">Status do Produto</label>
        <select
          value={formData.status || 'active'}
          onChange={(e) => onChangeField('status', e.target.value)}
          className="w-full bg-chumbo-950 border border-chumbo-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-laser-400 transition-colors"
        >
          <option value="active">Ativo na loja</option>
          <option value="draft">Rascunho</option>
          <option value="paused">Pausado</option>
        </select>
      </div>

      <div className="md:col-span-2 space-y-1.5">
        <label className="text-xs font-mono text-slate-300 block uppercase">Descrição Detalhada *</label>
        <textarea
          rows={3}
          required
          value={formData.description}
          onChange={(e) => onChangeField('description', e.target.value)}
          placeholder="Descreva as características técnicas, detalhes e uso recomendado..."
          className="w-full bg-chumbo-950 border border-chumbo-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-laser-400 transition-colors"
        />
      </div>

      <div className="md:col-span-2 space-y-1.5">
        <label className="text-xs font-mono text-slate-300 block uppercase">URL da Imagem Principal *</label>
        <input
          type="url"
          required
          value={formData.image_url}
          onChange={(e) => onChangeField('image_url', e.target.value)}
          placeholder="https://images.unsplash.com/..."
          className="w-full bg-chumbo-950 border border-chumbo-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-laser-400 transition-colors"
        />
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onUploadMainImage(file);
          }}
          className="block w-full text-xs text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-chumbo-800 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white hover:file:bg-chumbo-700"
        />
      </div>

      <div className="md:col-span-2 space-y-1.5">
        <label className="text-xs font-mono text-slate-300 block uppercase">
          URL do Vídeo (YouTube ou arquivo direto)
        </label>
        <input
          type="url"
          value={formData.video_url || ''}
          onChange={(e) => onChangeField('video_url', e.target.value)}
          placeholder="https://www.youtube.com/watch?v=... ou link direto .mp4"
          className="w-full bg-chumbo-950 border border-chumbo-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-laser-400 transition-colors font-mono"
        />
        <p className="text-[11px] text-slate-400">
          O vídeo aparecerá com player integrado nas miniaturas da galeria do produto na loja.
        </p>
      </div>
    </div>
  );
};
