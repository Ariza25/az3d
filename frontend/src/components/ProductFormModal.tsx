import React, { useState, useEffect, useRef } from 'react';
import { Product, Category, ProductInput, Parsed3MFResult } from '../types';
import {
  X,
  Layers,
  Save,
  PackagePlus,
  AlertCircle,
  Plus,
  Trash2,
  UploadCloud,
  Loader2,
  CheckCircle2,
  SlidersHorizontal,
} from 'lucide-react';
import { api, resolveApiAssetUrl } from '../services/api';
import { SlicerSettingsModal } from './SlicerSettingsModal';

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (productData: ProductInput) => Promise<void>;
  productToEdit?: Product | null;
  categories: Category[];
}

const DEFAULT_PRODUCT_IMAGE_URL =
  'https://images.unsplash.com/photo-1563089145-599997674d42?q=80&w=800&auto=format&fit=crop';

const createDefaultProductInput = (categoryId: number): ProductInput => ({
  title: '',
  slug: '',
  sku: '',
  description: '',
  price: 99.90,
  image_url: DEFAULT_PRODUCT_IMAGE_URL,
  video_url: '',
  color_images: [
    {
      color_name: 'Preto Slate',
      image_url: DEFAULT_PRODUCT_IMAGE_URL,
      video_url: '',
      sort_order: 0,
    },
  ],
  category_id: categoryId,
  material: 'PLA Premium',
  layer_height: '0.16mm (Alta Definicao)',
  print_time: '8 horas',
  dimensions: '120 x 120 x 150 mm',
  weight: '180g',
  slicer_settings: '',
  in_stock: true,
  stock_qty: 10,
  status: 'active',
  color_stocks: [{ color_name: 'Preto Slate', stock_qty: 10 }],
  variants: [],
});

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  productToEdit,
  categories,
}) => {
  const [formData, setFormData] = useState<ProductInput>(() => createDefaultProductInput(categories[0]?.id || 1));

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isParsing3MF, setIsParsing3MF] = useState(false);
  const [isDragging3MF, setIsDragging3MF] = useState(false);
  const [parsed3MF, setParsed3MF] = useState<Parsed3MFResult | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const fileInput3MFRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (productToEdit) {
      setFormData({
        title: productToEdit.title,
        slug: productToEdit.slug,
        sku: productToEdit.sku || '',
        description: productToEdit.description,
        price: productToEdit.price,
        image_url: productToEdit.image_url,
        video_url: productToEdit.video_url || '',
        color_images: productToEdit.color_images?.length
          ? productToEdit.color_images.map((image, index) => ({
              color_name: image.color_name,
              image_url: image.image_url,
              video_url: image.video_url || '',
              sort_order: image.sort_order ?? index,
            }))
          : [
              {
                color_name: 'Preto Slate',
                image_url: productToEdit.image_url,
                video_url: productToEdit.video_url || '',
                sort_order: 0,
              },
            ],
        category_id: productToEdit.category_id,
        material: productToEdit.material,
        layer_height: productToEdit.layer_height,
        print_time: productToEdit.print_time,
        dimensions: productToEdit.dimensions,
        weight: productToEdit.weight,
        slicer_settings: productToEdit.slicer_settings || '',
        in_stock: productToEdit.in_stock,
        stock_qty: productToEdit.stock_qty,
        status: productToEdit.status || 'active',
        color_stocks: productToEdit.color_stocks?.length
          ? productToEdit.color_stocks.map((stock) => ({
              color_name: stock.color_name,
              stock_qty: stock.stock_qty,
            }))
          : [{ color_name: 'Preto Slate', stock_qty: productToEdit.stock_qty }],
        variants: productToEdit.variants?.length
          ? productToEdit.variants.map((variant, index) => ({
              color_name: variant.color_name,
              price: variant.price,
              material: variant.material || productToEdit.material,
              layer_height: variant.layer_height || productToEdit.layer_height,
              print_time: variant.print_time || productToEdit.print_time,
              weight: variant.weight || productToEdit.weight,
              is_active: variant.is_active,
              sort_order: variant.sort_order ?? index,
            }))
          : [],
      });
    } else {
      setFormData(createDefaultProductInput(categories[0]?.id || 1));
    }
    setParsed3MF(null);
    setError(null);
  }, [productToEdit, categories, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.title.trim()) {
      setError('Por favor, informe o título do produto');
      return;
    }
    if (!formData.price || formData.price <= 0) {
      setError('Informe um preço válido maior que R$ 0');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave(formData);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar produto');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateColorImage = (index: number, field: 'color_name' | 'image_url', value: string) => {
    setFormData((prev) => ({
      ...prev,
      color_images: (prev.color_images || []).map((image, imageIndex) =>
        imageIndex === index ? { ...image, [field]: value } : image
      ),
    }));
  };

  const addColorImage = () => {
    setFormData((prev) => ({
      ...prev,
      color_images: [
        ...(prev.color_images || []),
        {
          color_name: '',
          image_url: prev.image_url,
          sort_order: prev.color_images?.length || 0,
        },
      ],
    }));
  };

  const removeColorImage = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      color_images: (prev.color_images || []).filter((_, imageIndex) => imageIndex !== index),
    }));
  };

  const handleUploadImage = async (file: File, onUrl: (url: string) => void) => {
    try {
      const result = await api.uploadProductImage(file);
      onUrl(resolveApiAssetUrl(result.url));
    } catch (err: any) {
      setError(err.message || 'Erro ao enviar imagem');
    }
  };

  const updateColorStock = (index: number, field: 'color_name' | 'stock_qty', value: string) => {
    setFormData((prev) => ({
      ...prev,
      color_stocks: (prev.color_stocks || []).map((stock, stockIndex) =>
        stockIndex === index
          ? { ...stock, [field]: field === 'stock_qty' ? Number(value) || 0 : value }
          : stock
      ),
    }));
  };

  const addColorStock = () => {
    setFormData((prev) => ({
      ...prev,
      color_stocks: [...(prev.color_stocks || []), { color_name: '', stock_qty: 0 }],
    }));
  };

  const removeColorStock = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      color_stocks: (prev.color_stocks || []).filter((_, stockIndex) => stockIndex !== index),
    }));
  };

  const updateVariant = (index: number, field: string, value: string | boolean) => {
    setFormData((prev) => ({
      ...prev,
      variants: (prev.variants || []).map((variant, variantIndex) =>
        variantIndex === index
          ? {
              ...variant,
              [field]: field === 'price' ? Number(value) || 0 : value,
            }
          : variant
      ),
    }));
  };

  const addVariant = () => {
    setFormData((prev) => ({
      ...prev,
      variants: [
        ...(prev.variants || []),
        {
          color_name: '',
          price: prev.price,
          material: prev.material,
          layer_height: prev.layer_height,
          print_time: prev.print_time,
          weight: prev.weight,
          is_active: true,
          sort_order: prev.variants?.length || 0,
        },
      ],
    }));
  };

  const removeVariant = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      variants: (prev.variants || []).filter((_, variantIndex) => variantIndex !== index),
    }));
  };

  const formatPrintDuration = (minutes: number) => {
    if (!minutes || minutes <= 0) return '';
    const rounded = Math.round(minutes);
    const hours = Math.floor(rounded / 60);
    const mins = rounded % 60;
    if (hours === 0) return `${mins} min`;
    if (mins === 0) return `${hours} horas`;
    return `${hours}h ${mins}m`;
  };

  const handle3MFUpload = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.3mf')) {
      setError('Por favor envie um arquivo com extensão .3mf.');
      return;
    }

    setIsParsing3MF(true);
    setError(null);

    try {
      const data = await api.parse3MF(file);
      setParsed3MF(data);

      setFormData((prev) => {
        const next = { ...prev };
        if (data.product_weight_grams > 0) {
          next.weight = `${Math.round(data.product_weight_grams)}g`;
        }
        if (data.print_minutes > 0) {
          next.print_time = formatPrintDuration(data.print_minutes);
        }
        if (data.dimensions) {
          next.dimensions = data.dimensions;
        }
        if (data.material) {
          next.material = data.material;
        }
        if (data.layer_height) {
          next.layer_height = data.layer_height;
        }
        if (data.raw_settings_json) {
          next.slicer_settings = data.raw_settings_json;
        }
        if (data.thumbnail_base64 && (!prev.image_url || prev.image_url === DEFAULT_PRODUCT_IMAGE_URL)) {
          next.image_url = data.thumbnail_base64;
          if (next.color_images && next.color_images.length > 0) {
            next.color_images = next.color_images.map((img, idx) =>
              idx === 0 ? { ...img, image_url: data.thumbnail_base64! } : img
            );
          }
        }
        return next;
      });
    } catch (err: any) {
      setError(err.message || 'Falha ao processar arquivo .3mf');
    } finally {
      setIsParsing3MF(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-black/80 backdrop-blur-md">
      <div 
        className="glass-panel w-full max-w-3xl rounded-3xl overflow-hidden border border-chumbo-700 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="bg-slate-100 dark:bg-chumbo-950 p-6 border-b border-slate-200 dark:border-chumbo-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-700 text-white border border-cyan-600 dark:bg-laser-500/20 dark:text-laser-400 dark:border-laser-500/30 flex items-center justify-center">
              <PackagePlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {productToEdit ? 'Editar Produto' : 'Novo Produto 3D'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Preencha os detalhes e especificações de fatiamento 3D
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white text-slate-500 hover:text-slate-900 border border-slate-200 dark:bg-chumbo-900 dark:text-slate-400 dark:hover:text-white dark:border-chumbo-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto bg-chumbo-900">
          
          {error && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center space-x-3 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Dados Gerais */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-xs font-mono text-slate-300 block uppercase">Título do Produto *</label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
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
                onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0, pricing_snapshot: undefined })}
                className="w-full bg-chumbo-950 border border-chumbo-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-laser-400 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-300 block uppercase">SKU interno</label>
              <input
                type="text"
                value={formData.sku || ''}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                placeholder="Ex: AZ3D-VASO-001"
                className="w-full bg-chumbo-950 border border-chumbo-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-laser-400 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-300 block uppercase">Categoria *</label>
              <select
                value={formData.category_id}
                onChange={(e) => setFormData({ ...formData, category_id: parseInt(e.target.value) })}
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
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
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
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descreva as características técnicas, detalhes e uso recomendado..."
                className="w-full bg-chumbo-950 border border-chumbo-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-laser-400 transition-colors"
              />
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <label className="text-xs font-mono text-slate-300 block uppercase">URL da Imagem *</label>
              <input
                type="url"
                required
                value={formData.image_url}
                onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                placeholder="https://images.unsplash.com/..."
                className="w-full bg-chumbo-950 border border-chumbo-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-laser-400 transition-colors"
              />
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleUploadImage(file, (url) => setFormData((prev) => ({ ...prev, image_url: url })));
                  }
                }}
                className="block w-full text-xs text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-chumbo-800 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white hover:file:bg-chumbo-700"
              />
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <label className="text-xs font-mono text-slate-300 block uppercase">URL do Vídeo (YouTube ou arquivo de vídeo)</label>
              <input
                type="url"
                value={formData.video_url || ''}
                onChange={(e) => setFormData({ ...formData, video_url: e.target.value })}
                placeholder="https://www.youtube.com/watch?v=... ou link direto .mp4"
                className="w-full bg-chumbo-950 border border-chumbo-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-laser-400 transition-colors font-mono"
              />
              <p className="text-[11px] text-slate-400">
                O vídeo aparecerá com player integrado nas miniaturas da galeria do produto na loja.
              </p>
            </div>

            <div className="md:col-span-2 space-y-3 rounded-xl border border-chumbo-800 bg-chumbo-950/40 p-4">
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
                  onClick={addColorImage}
                  className="flex items-center gap-1.5 shrink-0 rounded-lg border border-chumbo-700 bg-chumbo-900 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-chumbo-800 hover:text-white transition"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>+ Adicionar foto / cor</span>
                </button>
              </div>

              <div className="space-y-3 pt-2">
                {(formData.color_images || []).map((image, index) => (
                  <div key={index} className="grid grid-cols-1 gap-2.5 rounded-xl border border-chumbo-850 bg-chumbo-950 p-3 md:grid-cols-[160px_1fr_auto]">
                    <div>
                      <span className="block text-[10px] font-mono text-slate-400 mb-1">Nome da Cor</span>
                      <input
                        type="text"
                        value={image.color_name}
                        onChange={(e) => updateColorImage(index, 'color_name', e.target.value)}
                        placeholder="Ex: Preto Slate"
                        className="w-full bg-chumbo-900 border border-chumbo-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-laser-400 font-medium"
                      />
                    </div>
                    <div>
                      <span className="block text-[10px] font-mono text-slate-400 mb-1">URL da Imagem ou Arquivo</span>
                      <input
                        type="url"
                        value={image.image_url}
                        onChange={(e) => updateColorImage(index, 'image_url', e.target.value)}
                        placeholder="https://... ou faça upload abaixo"
                        className="w-full bg-chumbo-900 border border-chumbo-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-laser-400 font-mono"
                      />
                      <input
                        type="file"
                        multiple
                        accept="image/png,image/jpeg,image/webp"
                        onChange={async (e) => {
                          const files = Array.from(e.target.files || []);
                          if (files.length === 0) return;
                          for (let i = 0; i < files.length; i++) {
                            const file = files[i];
                            if (i === 0) {
                              handleUploadImage(file, (url) => updateColorImage(index, 'image_url', url));
                            } else {
                              try {
                                const result = await api.uploadProductImage(file);
                                const uploadedUrl = resolveApiAssetUrl(result.url);
                                setFormData((prev) => ({
                                  ...prev,
                                  color_images: [
                                    ...(prev.color_images || []),
                                    {
                                      color_name: image.color_name || 'Padrão',
                                      image_url: uploadedUrl,
                                      sort_order: prev.color_images?.length || 0,
                                    },
                                  ],
                                }));
                              } catch (err: any) {
                                setError(err.message || 'Erro ao enviar imagem');
                              }
                            }
                          }
                        }}
                        className="mt-2 block w-full text-[11px] text-slate-400 file:mr-2 file:rounded-md file:border-0 file:bg-chumbo-800 file:px-2.5 file:py-1 file:text-[11px] file:font-bold file:text-white hover:file:bg-chumbo-700"
                      />
                    </div>
                    <div className="flex items-center justify-end md:items-start pt-1 gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setFormData((prev) => ({
                            ...prev,
                            color_images: [
                              ...(prev.color_images || []),
                              {
                                color_name: image.color_name || 'Padrão',
                                image_url: image.image_url,
                                sort_order: prev.color_images?.length || 0,
                              },
                            ],
                          }));
                        }}
                        className="rounded-lg border border-chumbo-700 p-2 text-xs text-slate-300 hover:bg-chumbo-800 hover:text-laser-400 transition"
                        title="Duplicar esta cor para adicionar mais 1 foto"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeColorImage(index)}
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

            <div className="md:col-span-2 space-y-3 rounded-xl border border-chumbo-800 bg-chumbo-950/40 p-4">
              <div className="flex items-center justify-between gap-3">
                <label className="text-xs font-mono text-slate-300 block uppercase">Estoque por cor</label>
                <button type="button" onClick={addColorStock} className="flex items-center gap-1.5 rounded-lg border border-chumbo-700 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-chumbo-800">
                  <Plus className="h-3.5 w-3.5" />
                  <span>Adicionar estoque</span>
                </button>
              </div>
              {(formData.color_stocks || []).map((stock, index) => (
                <div key={index} className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_120px_auto]">
                  <input
                    type="text"
                    value={stock.color_name}
                    onChange={(e) => updateColorStock(index, 'color_name', e.target.value)}
                    placeholder="Ex: Preto Slate"
                    className="w-full bg-chumbo-950 border border-chumbo-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-laser-400"
                  />
                  <input
                    type="number"
                    value={stock.stock_qty}
                    onChange={(e) => updateColorStock(index, 'stock_qty', e.target.value)}
                    className="w-full bg-chumbo-950 border border-chumbo-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-laser-400"
                  />
                  <button type="button" onClick={() => removeColorStock(index)} className="flex h-10 items-center justify-center rounded-xl border border-chumbo-700 px-3 text-slate-400 hover:bg-rose-500/10 hover:text-rose-300">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="md:col-span-2 space-y-3 rounded-xl border border-chumbo-800 bg-chumbo-950/40 p-4">
              <div className="flex items-center justify-between gap-3">
                <label className="text-xs font-mono text-slate-300 block uppercase">Variacoes por cor/acabamento</label>
                <button type="button" onClick={addVariant} className="flex items-center gap-1.5 rounded-lg border border-chumbo-700 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-chumbo-800">
                  <Plus className="h-3.5 w-3.5" />
                  <span>Adicionar variacao</span>
                </button>
              </div>
              {(formData.variants || []).map((variant, index) => (
                <div key={index} className="grid grid-cols-1 gap-3 rounded-xl border border-chumbo-800 p-3 md:grid-cols-3">
                  <input value={variant.variation_name || variant.color_name} onChange={(e) => { updateVariant(index, 'variation_name', e.target.value); updateVariant(index, 'color_name', e.target.value); }} placeholder="Variação (cor, tamanho, voltagem...)" className="w-full bg-chumbo-950 border border-chumbo-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-laser-400" />
                  <input type="number" step="0.01" value={variant.price} onChange={(e) => updateVariant(index, 'price', e.target.value)} placeholder="Preco" className="w-full bg-chumbo-950 border border-chumbo-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-laser-400" />
                  <input value={variant.print_time || ''} onChange={(e) => updateVariant(index, 'print_time', e.target.value)} placeholder="Tempo" className="w-full bg-chumbo-950 border border-chumbo-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-laser-400" />
                  <input value={variant.material || ''} onChange={(e) => updateVariant(index, 'material', e.target.value)} placeholder="Material" className="w-full bg-chumbo-950 border border-chumbo-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-laser-400" />
                  <input value={variant.layer_height || ''} onChange={(e) => updateVariant(index, 'layer_height', e.target.value)} placeholder="Resolucao" className="w-full bg-chumbo-950 border border-chumbo-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-laser-400" />
                  <div className="flex items-center gap-2">
                    <input value={variant.weight || ''} onChange={(e) => updateVariant(index, 'weight', e.target.value)} placeholder="Peso" className="min-w-0 flex-1 bg-chumbo-950 border border-chumbo-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-laser-400" />
                    <button type="button" onClick={() => removeVariant(index)} className="flex h-10 items-center justify-center rounded-xl border border-chumbo-700 px-3 text-slate-400 hover:bg-rose-500/10 hover:text-rose-300">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Especificações de Impressão 3D */}
          <div className="pt-4 border-t border-chumbo-800 space-y-4">
            <div className="flex items-center space-x-2 text-xs font-mono text-laser-400">
              <Layers className="w-4 h-4" />
              <span className="uppercase tracking-widest font-bold">Especificações Técnicas de Fatiamento 3D</span>
            </div>

            {/* Assistente de Fatiamento .3MF (Opcional) */}
            <div className="rounded-2xl border border-cyan-800/40 bg-cyan-950/20 p-4 space-y-3 dark:border-laser-500/30 dark:bg-laser-950/20">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold uppercase text-cyan-400 dark:text-laser-400">
                    Importar Arquivo .3MF do Fatiador
                  </span>
                  <span className="rounded-md bg-cyan-900/50 px-2 py-0.5 text-[10px] font-mono font-semibold text-cyan-300 border border-cyan-700/50 dark:bg-laser-500/20 dark:text-laser-300 dark:border-laser-500/30">
                    Opcional
                  </span>
                </div>
                {formData.slicer_settings && (
                  <button
                    type="button"
                    onClick={() => setIsDetailsModalOpen(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-400 hover:text-cyan-300 underline underline-offset-4 dark:text-laser-300 dark:hover:text-laser-200 transition-colors"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    <span>Ver ficha técnica salva</span>
                  </button>
                )}
              </div>

              <p className="text-xs text-slate-400">
                Se desejar preencher automaticamente peso, tempo, resolução, dimensões e configurações técnicas, arraste ou selecione o arquivo <strong>.3MF</strong> (Bambu Studio, OrcaSlicer ou PrusaSlicer) abaixo:
              </p>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging3MF(true);
                }}
                onDragLeave={() => setIsDragging3MF(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging3MF(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handle3MFUpload(e.dataTransfer.files[0]);
                  }
                }}
                onClick={() => fileInput3MFRef.current?.click()}
                className={`relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 text-center transition-all ${
                  isDragging3MF
                    ? 'border-cyan-400 bg-cyan-900/30 dark:border-laser-400 dark:bg-laser-500/20'
                    : 'border-chumbo-700 bg-chumbo-950/60 hover:border-cyan-500/60 hover:bg-chumbo-950/90 dark:border-chumbo-700 dark:hover:border-laser-500/60'
                }`}
              >
                <input
                  ref={fileInput3MFRef}
                  type="file"
                  accept=".3mf"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handle3MFUpload(e.target.files[0]);
                    }
                  }}
                />
                {isParsing3MF ? (
                  <div className="flex items-center gap-2 text-xs font-semibold text-cyan-400 dark:text-laser-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Lendo dados e configurações do arquivo .3MF...</span>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row items-center gap-2">
                    <UploadCloud className="h-5 w-5 text-cyan-400 dark:text-laser-400" />
                    <span className="text-xs text-slate-300">
                      Clique ou arraste o <strong>.3MF</strong> para auto-preencher os dados técnicos
                    </span>
                  </div>
                )}
              </div>

              {parsed3MF && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cyan-700/40 bg-cyan-950/40 p-3 shadow-inner dark:border-laser-500/30 dark:bg-laser-950/40">
                  <div className="flex items-center gap-3">
                    {parsed3MF.thumbnail_base64 ? (
                      <img
                        src={parsed3MF.thumbnail_base64}
                        alt="Miniatura .3MF"
                        className="h-12 w-12 rounded-lg object-cover border border-cyan-600/40 shadow-sm shrink-0"
                      />
                    ) : (
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
                    )}
                    <div className="text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">
                          {parsed3MF.file_name}
                        </span>
                        <span className="rounded-md bg-cyan-900/60 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-cyan-300 dark:bg-laser-500/20 dark:text-laser-300">
                          {parsed3MF.slicer_detected || 'Fatiador 3MF'}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-mono text-slate-300">
                        {parsed3MF.product_weight_grams > 0 && (
                          <span>Peso: <strong className="text-white">{Math.round(parsed3MF.product_weight_grams)}g</strong></span>
                        )}
                        {parsed3MF.print_minutes > 0 && (
                          <span>• Tempo: <strong className="text-white">{formatPrintDuration(parsed3MF.print_minutes)}</strong></span>
                        )}
                        {parsed3MF.dimensions && (
                          <span>• Dimensões: <strong className="text-white">{parsed3MF.dimensions}</strong></span>
                        )}
                        {parsed3MF.material && (
                          <span>• Material: <strong className="text-white">{parsed3MF.material}</strong></span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsDetailsModalOpen(true)}
                    className="flex items-center gap-1.5 rounded-xl border border-cyan-500/50 bg-cyan-500/20 px-3 py-1.5 text-xs font-bold text-cyan-200 hover:bg-cyan-500/30 dark:border-laser-400/40 dark:bg-laser-500/20 dark:text-laser-200 dark:hover:bg-laser-500/30 transition-colors"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    <span>Ver detalhes</span>
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-400 block uppercase">Material Utilizado</label>
                <input
                  type="text"
                  value={formData.material}
                  onChange={(e) => setFormData({ ...formData, material: e.target.value })}
                  placeholder="Ex: PLA Silk, PETG Carbon Fiber, Resina 8K"
                  className="w-full bg-chumbo-950 border border-chumbo-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-laser-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-400 block uppercase">Resolução de Camada</label>
                <input
                  type="text"
                  value={formData.layer_height}
                  onChange={(e) => setFormData({ ...formData, layer_height: e.target.value })}
                  placeholder="Ex: 0.12mm (Ultra Detalhe)"
                  className="w-full bg-chumbo-950 border border-chumbo-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-laser-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-400 block uppercase">Tempo de Impressão</label>
                <input
                  type="text"
                  value={formData.print_time}
                  onChange={(e) => setFormData({ ...formData, print_time: e.target.value })}
                  placeholder="Ex: 12 horas"
                  className="w-full bg-chumbo-950 border border-chumbo-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-laser-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-400 block uppercase">Dimensões (XYZ)</label>
                <input
                  type="text"
                  value={formData.dimensions}
                  onChange={(e) => setFormData({ ...formData, dimensions: e.target.value })}
                  placeholder="Ex: 150 x 150 x 200 mm"
                  className="w-full bg-chumbo-950 border border-chumbo-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-laser-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-400 block uppercase">Peso da Peça</label>
                <input
                  type="text"
                  value={formData.weight}
                  onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                  placeholder="Ex: 250g"
                  className="w-full bg-chumbo-950 border border-chumbo-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-laser-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-400 block uppercase">Qtd em Estoque</label>
                <input
                  type="number"
                  value={formData.stock_qty}
                  onChange={(e) => setFormData({ ...formData, stock_qty: parseInt(e.target.value) || 0 })}
                  className="w-full bg-chumbo-950 border border-chumbo-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-laser-400"
                />
              </div>
            </div>
          </div>

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
        onClose={() => setIsDetailsModalOpen(false)}
        settings={parsed3MF?.settings}
        rawJson={formData.slicer_settings}
        title={formData.title ? `Configurações: ${formData.title}` : 'Configurações de Fatiamento (.3MF)'}
        slicerName={parsed3MF?.slicer_detected || 'Fatiador 3MF'}
      />
    </div>
  );
};
