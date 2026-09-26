import React from 'react';
import { AlertCircle, Save } from 'lucide-react';
import { Category, Parsed3MFResult, ProductColorImage, ProductInput } from '../../../../types';
import { SlicerSettingsModal } from '../../../../components/SlicerSettingsModal';
import { ProductFormHeader } from './ProductFormHeader';
import { ProductGeneralFields } from './ProductGeneralFields';
import { ProductColorGalleryManager } from './ProductColorGalleryManager';
import { ProductColorStockManager } from './ProductColorStockManager';
import { ProductVariantsManager } from './ProductVariantsManager';
import { ProductThreeMfUploader } from './ProductThreeMfUploader';
import { ProductTechnicalSpecsFields } from './ProductTechnicalSpecsFields';

export interface ProductFormViewProps {
  isOpen: boolean;
  isEditing: boolean;
  error: string | null;
  isSubmitting: boolean;
  formData: ProductInput;
  categories: Category[];
  isParsing3MF: boolean;
  isDragging3MF: boolean;
  parsed3MF: Parsed3MFResult | null;
  isDetailsModalOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onChangeField: <K extends keyof ProductInput>(field: K, value: ProductInput[K]) => void;
  onUploadMainImage: (file: File) => void;
  onAddColorImage: () => void;
  onDuplicateColorImage: (image: ProductColorImage) => void;
  onRemoveColorImage: (index: number) => void;
  onUpdateColorImage: (index: number, field: 'color_name' | 'image_url', value: string) => void;
  onUploadImageFiles: (index: number, colorName: string, files: File[]) => void;
  onAddColorStock: () => void;
  onRemoveColorStock: (index: number) => void;
  onUpdateColorStock: (index: number, field: 'color_name' | 'stock_qty', value: string) => void;
  onAddVariant: () => void;
  onRemoveVariant: (index: number) => void;
  onUpdateVariant: (index: number, field: string, value: string | boolean) => void;
  onDragOver3MF: (e: React.DragEvent) => void;
  onDragLeave3MF: () => void;
  onDrop3MF: (e: React.DragEvent) => void;
  onFileSelect3MF: (file: File) => void;
  onOpenDetailsModal: () => void;
  onCloseDetailsModal: () => void;
  formatPrintDuration: (minutes: number) => string;
}

export const ProductFormView: React.FC<ProductFormViewProps> = ({
  isOpen,
  isEditing,
  error,
  isSubmitting,
  formData,
  categories,
  isParsing3MF,
  isDragging3MF,
  parsed3MF,
  isDetailsModalOpen,
  onClose,
  onSubmit,
  onChangeField,
  onUploadMainImage,
  onAddColorImage,
  onDuplicateColorImage,
  onRemoveColorImage,
  onUpdateColorImage,
  onUploadImageFiles,
  onAddColorStock,
  onRemoveColorStock,
  onUpdateColorStock,
  onAddVariant,
  onRemoveVariant,
  onUpdateVariant,
  onDragOver3MF,
  onDragLeave3MF,
  onDrop3MF,
  onFileSelect3MF,
  onOpenDetailsModal,
  onCloseDetailsModal,
  formatPrintDuration,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-black/80 backdrop-blur-md">
      <div
        className="glass-panel w-full max-w-3xl rounded-3xl overflow-hidden border border-chumbo-700 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <ProductFormHeader isEditing={isEditing} onClose={onClose} />

        <form onSubmit={onSubmit} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto bg-chumbo-900">
          {error && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center space-x-3 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <ProductGeneralFields
            formData={formData}
            categories={categories}
            onChangeField={onChangeField}
            onUploadMainImage={onUploadMainImage}
          />

          <ProductColorGalleryManager
            colorImages={formData.color_images || []}
            onAddColorImage={onAddColorImage}
            onDuplicateColorImage={onDuplicateColorImage}
            onRemoveColorImage={onRemoveColorImage}
            onUpdateColorImage={onUpdateColorImage}
            onUploadImageFiles={onUploadImageFiles}
          />

          <ProductColorStockManager
            colorStocks={formData.color_stocks || []}
            onAddColorStock={onAddColorStock}
            onRemoveColorStock={onRemoveColorStock}
            onUpdateColorStock={onUpdateColorStock}
          />

          <ProductVariantsManager
            variants={formData.variants || []}
            onAddVariant={onAddVariant}
            onRemoveVariant={onRemoveVariant}
            onUpdateVariant={onUpdateVariant}
          />

          <ProductThreeMfUploader
            isParsing3MF={isParsing3MF}
            isDragging3MF={isDragging3MF}
            parsed3MF={parsed3MF}
            hasSlicerSettings={Boolean(formData.slicer_settings)}
            onDragOver={onDragOver3MF}
            onDragLeave={onDragLeave3MF}
            onDrop={onDrop3MF}
            onFileSelect={onFileSelect3MF}
            onOpenDetailsModal={onOpenDetailsModal}
            formatPrintDuration={formatPrintDuration}
          />

          <ProductTechnicalSpecsFields
            formData={formData}
            onChangeField={onChangeField}
          />

          <div className="pt-6 border-t border-chumbo-800 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-chumbo-700 text-slate-300 hover:text-white hover:bg-chumbo-800 transition-colors text-sm font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-white hover:bg-slate-200 text-chumbo-950 font-bold text-sm transition-all shadow-xl active:scale-95 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSubmitting ? 'Salvando...' : 'Salvar Produto'}</span>
            </button>
          </div>
        </form>
      </div>

      <SlicerSettingsModal
        isOpen={isDetailsModalOpen}
        onClose={onCloseDetailsModal}
        settings={parsed3MF?.settings}
        rawJson={formData.slicer_settings}
        title={formData.title ? `Configurações: ${formData.title}` : 'Configurações de Fatiamento (.3MF)'}
        slicerName={parsed3MF?.slicer_detected || 'Fatiador 3MF'}
      />
    </div>
  );
};
