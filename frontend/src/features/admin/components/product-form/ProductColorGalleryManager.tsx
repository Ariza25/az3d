import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { ProductColorImage } from '../../../../types';

interface ProductColorGalleryManagerProps {
  colorImages: ProductColorImage[];
  onAddColorImage: () => void;
  onDuplicateColorImage: (image: ProductColorImage) => void;
  onRemoveColorImage: (index: number) => void;
  onUpdateColorImage: (index: number, field: 'color_name' | 'image_url', value: string) => void;
  onUploadImageFiles: (index: number, colorName: string, files: File[]) => void;
}

export const ProductColorGalleryManager: React.FC<ProductColorGalleryManagerProps> = ({
  colorImages,
  onAddColorImage,
  onDuplicateColorImage,
  onRemoveColorImage,
  onUpdateColorImage,
  onUploadImageFiles,
}) => {
  return (
    <div className="space-y-3 rounded-xl border border-chumbo-800 bg-chumbo-950/40 p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-chumbo-800/80 pb-3">
        <div>
          <label className="text-xs font-mono text-slate-300 block uppercase font-bold">
            Galeria de Fotos por Cor (Múltiplas Fotos — Padrão Mercado Livre)
          </label>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Você pode adicionar várias fotos com o mesmo nome de cor. Elas serão exibidas nas miniaturas à esquerda no modal do produto.
          </p>
        </div>
        <button
          type="button"
          onClick={onAddColorImage}
          className="flex items-center gap-1.5 shrink-0 rounded-lg border border-chumbo-700 bg-chumbo-900 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-chumbo-800 hover:text-white transition"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>+ Adicionar foto / cor</span>
        </button>
      </div>

      <div className="space-y-3 pt-2">
        {colorImages.map((image, index) => (
          <div
            key={index}
            className="grid grid-cols-1 gap-2.5 rounded-xl border border-chumbo-850 bg-chumbo-950 p-3 md:grid-cols-[160px_1fr_auto]"
          >
            <div>
              <span className="block text-[10px] font-mono text-slate-400 mb-1">Nome da Cor</span>
              <input
                type="text"
                value={image.color_name}
                onChange={(e) => onUpdateColorImage(index, 'color_name', e.target.value)}
                placeholder="Ex: Preto Slate"
                className="w-full bg-chumbo-900 border border-chumbo-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-laser-400 font-medium"
              />
            </div>
            <div>
              <span className="block text-[10px] font-mono text-slate-400 mb-1">URL da Imagem ou Arquivo</span>
              <input
                type="url"
                value={image.image_url}
                onChange={(e) => onUpdateColorImage(index, 'image_url', e.target.value)}
                placeholder="https://... ou faça upload abaixo"
                className="w-full bg-chumbo-900 border border-chumbo-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-laser-400 font-mono"
              />
              <input
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  if (files.length > 0) {
                    onUploadImageFiles(index, image.color_name, files);
                  }
                }}
                className="mt-2 block w-full text-[11px] text-slate-400 file:mr-2 file:rounded-md file:border-0 file:bg-chumbo-800 file:px-2.5 file:py-1 file:text-[11px] file:font-bold file:text-white hover:file:bg-chumbo-700"
              />
            </div>
            <div className="flex items-center justify-end md:items-start pt-1 gap-1">
              <button
                type="button"
                onClick={() => onDuplicateColorImage(image)}
                className="rounded-lg border border-chumbo-700 p-2 text-xs text-slate-300 hover:bg-chumbo-800 hover:text-laser-400 transition"
                title="Duplicar esta cor para adicionar mais 1 foto"
              >
                <Plus className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onRemoveColorImage(index)}
                className="rounded-lg border border-chumbo-700 p-2 text-slate-400 hover:bg-rose-500/10 hover:text-rose-300 transition"
                title="Remover imagem"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
