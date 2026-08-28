import React, { useState, useEffect } from 'react';
import { Product, Category, ProductInput, TenantSettings } from '../types';
import { X, Layers, Save, PackagePlus, AlertCircle, Calculator, DollarSign, Zap, Plus, Trash2, Loader2 } from 'lucide-react';
import { api, resolveApiAssetUrl } from '../services/api';
import {
  DEFAULT_PRINTING_PRICING,
  PrintingPricingInput,
  PrintingPricingResult,
  currencyBRL,
  formatPrintDuration,
  formatWeight,
  parsePrintMinutes,
  parseWeightGrams,
} from '../utils/printingPricing';

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (productData: ProductInput) => Promise<void>;
  productToEdit?: Product | null;
  categories: Category[];
}

const DEFAULT_PRODUCT_IMAGE_URL =
  'https://images.unsplash.com/photo-1563089145-599997674d42?q=80&w=800&auto=format&fit=crop';

const mergeTenantPricingDefaults = (input: PrintingPricingInput, settings: TenantSettings): PrintingPricingInput => ({
  ...input,
  spoolPrice: settings.default_spool_price ?? input.spoolPrice,
  spoolWeightGrams: settings.default_spool_weight ?? input.spoolWeightGrams,
  printerPowerKw: settings.default_printer_power_kw ?? input.printerPowerKw,
  energyTariffPerKwh: settings.default_energy_tariff ?? input.energyTariffPerKwh,
  packagingCost: settings.default_packaging_cost ?? input.packagingCost,
  laborCost: settings.default_labor_cost ?? input.laborCost,
  extraCost: settings.default_extra_cost ?? input.extraCost,
  failureRatePercent: settings.default_failure_rate_percent ?? input.failureRatePercent,
  marginPercent: settings.default_margin_percent ?? input.marginPercent,
  platformFeePercent: settings.default_platform_fee_percent ?? input.platformFeePercent,
  paymentFeePercent: settings.default_payment_fee_percent ?? input.paymentFeePercent,
  fixedFee: settings.default_fixed_fee ?? input.fixedFee,
});

const createDefaultProductInput = (categoryId: number): ProductInput => ({
  title: '',
  slug: '',
  sku: '',
  description: '',
  price: 99.90,
  image_url: DEFAULT_PRODUCT_IMAGE_URL,
  color_images: [
    {
      color_name: 'Preto Slate',
      image_url: DEFAULT_PRODUCT_IMAGE_URL,
      sort_order: 0,
    },
  ],
  category_id: categoryId,
  material: 'PLA Premium',
  layer_height: '0.16mm (Alta Definicao)',
  print_time: '8 horas',
  dimensions: '120 x 120 x 150 mm',
  weight: '180g',
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

  const [pricingInput, setPricingInput] = useState<PrintingPricingInput>(DEFAULT_PRINTING_PRICING);
  const [pricingResult, setPricingResult] = useState<PrintingPricingResult | null>(null);
  const [isPricingCalculating, setIsPricingCalculating] = useState(false);
  const [pricingSnapshotApplied, setPricingSnapshotApplied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (productToEdit) {
      const editWeight = parseWeightGrams(productToEdit.weight);
      const editMinutes = parsePrintMinutes(productToEdit.print_time);
      setFormData({
        title: productToEdit.title,
        slug: productToEdit.slug,
        sku: productToEdit.sku || '',
        description: productToEdit.description,
        price: productToEdit.price,
        image_url: productToEdit.image_url,
        color_images: productToEdit.color_images?.length
          ? productToEdit.color_images.map((image, index) => ({
              color_name: image.color_name,
              image_url: image.image_url,
              sort_order: image.sort_order ?? index,
            }))
          : [
              {
                color_name: 'Preto Slate',
                image_url: productToEdit.image_url,
                sort_order: 0,
              },
            ],
        category_id: productToEdit.category_id,
        material: productToEdit.material,
        layer_height: productToEdit.layer_height,
        print_time: productToEdit.print_time,
        dimensions: productToEdit.dimensions,
        weight: productToEdit.weight,
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
      setPricingInput((prev) => ({
        ...prev,
        productWeightGrams: editWeight || prev.productWeightGrams,
        printMinutes: editMinutes || prev.printMinutes,
      }));
    } else {
      setFormData(createDefaultProductInput(categories[0]?.id || 1));
      setPricingInput(DEFAULT_PRINTING_PRICING);
    }
    setPricingResult(null);
    setPricingSnapshotApplied(false);
    setError(null);
  }, [productToEdit, categories, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    let mounted = true;
    api
      .getAdminTenantSettings()
      .then((settings) => {
        if (!mounted) return;
        setPricingInput((prev) => mergeTenantPricingDefaults(prev, settings));
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, [isOpen]);

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

  const updatePricingNumber = (field: keyof PrintingPricingInput, value: string) => {
    setPricingInput((prev) => ({ ...prev, [field]: Number(value) || 0 }));
    setPricingResult(null);
    setPricingSnapshotApplied(false);
  };

  const calculatePricing = async () => {
    setIsPricingCalculating(true);
    setError(null);
    try {
      const response = await api.calculatePricing(pricingInput);
      setPricingInput(response.input);
      setPricingResult(response.result);
      return response;
    } catch (err: any) {
      setError(err.message || 'Erro ao calcular precificacao');
      return null;
    } finally {
      setIsPricingCalculating(false);
    }
  };

  const applySuggestedPrice = async () => {
    const response = pricingResult ? { input: pricingInput, result: pricingResult } : await calculatePricing();
    if (!response) return;

    setFormData((prev) => ({
      ...prev,
      price: Number(response.result.suggestedPrice.toFixed(2)),
      weight: formatWeight(response.input.productWeightGrams + response.input.supportWeightGrams),
      print_time: formatPrintDuration(response.input.printMinutes),
      pricing_snapshot: response.input,
    }));
    setPricingSnapshotApplied(true);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-black/80 backdrop-blur-md">
      <div 
        className="glass-panel w-full max-w-3xl rounded-3xl overflow-hidden border border-chumbo-700 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="bg-chumbo-950 p-6 border-b border-chumbo-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-laser-500/20 text-laser-400 border border-laser-500/30 flex items-center justify-center">
              <PackagePlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                {productToEdit ? 'Editar Produto' : 'Novo Produto 3D'}
              </h2>
              <p className="text-xs text-slate-400">
                Preencha os detalhes e especificações de fatiamento 3D
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full bg-chumbo-900 text-slate-400 hover:text-white border border-chumbo-700 transition-colors"
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
                onChange={(e) => {
                  setFormData({ ...formData, price: parseFloat(e.target.value) || 0, pricing_snapshot: undefined });
                  setPricingSnapshotApplied(false);
                }}
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

            <div className="md:col-span-2 space-y-3 rounded-xl border border-chumbo-800 bg-chumbo-950/40 p-4">
              <div className="flex items-center justify-between gap-3">
                <label className="text-xs font-mono text-slate-300 block uppercase">
                  Imagens por cor / acabamento
                </label>
                <button
                  type="button"
                  onClick={addColorImage}
                  className="flex items-center gap-1.5 rounded-lg border border-chumbo-700 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-chumbo-800"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Adicionar cor</span>
                </button>
              </div>

              <div className="space-y-3">
                {(formData.color_images || []).map((image, index) => (
                  <div key={index} className="grid grid-cols-1 gap-3 md:grid-cols-[180px_1fr_auto]">
                    <input
                      type="text"
                      value={image.color_name}
                      onChange={(e) => updateColorImage(index, 'color_name', e.target.value)}
                      placeholder="Ex: Preto Slate"
                      className="w-full bg-chumbo-950 border border-chumbo-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-laser-400"
                    />
                    <input
                      type="url"
                      value={image.image_url}
                      onChange={(e) => updateColorImage(index, 'image_url', e.target.value)}
                      placeholder="URL da foto para essa cor"
                      className="w-full bg-chumbo-950 border border-chumbo-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-laser-400"
                    />
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleUploadImage(file, (url) => updateColorImage(index, 'image_url', url));
                        }
                      }}
                      className="md:col-span-2 block w-full text-xs text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-chumbo-800 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white hover:file:bg-chumbo-700"
                    />
                    <button
                      type="button"
                      onClick={() => removeColorImage(index)}
                      className="flex h-10 items-center justify-center rounded-xl border border-chumbo-700 px-3 text-slate-400 hover:bg-rose-500/10 hover:text-rose-300"
                      title="Remover cor"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
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
                  <input value={variant.color_name} onChange={(e) => updateVariant(index, 'color_name', e.target.value)} placeholder="Cor/acabamento" className="w-full bg-chumbo-950 border border-chumbo-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-laser-400" />
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

          {/* Botões de Ação */}
          <div className="pt-4 border-t border-chumbo-800 space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center space-x-2 text-xs font-mono text-laser-400">
                <Calculator className="w-4 h-4" />
                <span className="uppercase tracking-widest font-bold">Calculo de custo e taxas</span>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={calculatePricing}
                  disabled={isPricingCalculating}
                  className="flex items-center justify-center space-x-2 rounded-xl border border-chumbo-700 bg-chumbo-950 px-4 py-2 text-xs font-bold text-slate-200 transition-all hover:bg-chumbo-800 disabled:opacity-60"
                >
                  {isPricingCalculating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
                  <span>Calcular</span>
                </button>
                <button
                  type="button"
                  onClick={applySuggestedPrice}
                  disabled={isPricingCalculating}
                  className="flex items-center justify-center space-x-2 rounded-xl bg-laser-400 px-4 py-2 text-xs font-bold text-chumbo-950 transition-all hover:bg-laser-300 active:scale-95 disabled:opacity-60"
                >
                  {isPricingCalculating ? <Loader2 className="h-4 w-4 animate-spin" /> : <DollarSign className="h-4 w-4" />}
                  <span>{pricingSnapshotApplied ? 'Preco aplicado' : 'Aplicar preco sugerido'}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-400 block uppercase">Peso modelo</label>
                <input
                  type="number"
                  step="0.01"
                  value={pricingInput.productWeightGrams}
                  onChange={(e) => updatePricingNumber('productWeightGrams', e.target.value)}
                  className="w-full bg-chumbo-950 border border-chumbo-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-laser-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-400 block uppercase">Suporte (g)</label>
                <input
                  type="number"
                  step="0.01"
                  value={pricingInput.supportWeightGrams}
                  onChange={(e) => updatePricingNumber('supportWeightGrams', e.target.value)}
                  className="w-full bg-chumbo-950 border border-chumbo-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-laser-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-400 block uppercase">Tempo total (min)</label>
                <input
                  type="number"
                  value={pricingInput.printMinutes}
                  onChange={(e) => updatePricingNumber('printMinutes', e.target.value)}
                  className="w-full bg-chumbo-950 border border-chumbo-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-laser-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-400 block uppercase">Taxa plataforma (%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={pricingInput.platformFeePercent}
                  onChange={(e) => updatePricingNumber('platformFeePercent', e.target.value)}
                  className="w-full bg-chumbo-950 border border-chumbo-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-laser-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-xl border border-chumbo-800 bg-chumbo-950/70 p-3">
                <Zap className="mb-2 h-4 w-4 text-laser-300" />
                <span className="block text-[10px] font-mono uppercase text-slate-500">Custo direto</span>
                <strong className="text-sm text-white">{pricingResult ? currencyBRL(pricingResult.directCost) : '--'}</strong>
              </div>
              <div className="rounded-xl border border-chumbo-800 bg-chumbo-950/70 p-3">
                <DollarSign className="mb-2 h-4 w-4 text-laser-300" />
                <span className="block text-[10px] font-mono uppercase text-slate-500">Taxas</span>
                <strong className="text-sm text-white">{pricingResult ? currencyBRL(pricingResult.totalFees) : '--'}</strong>
              </div>
              <div className="rounded-xl border border-laser-500/30 bg-laser-500/10 p-3 md:col-span-2">
                <span className="block text-[10px] font-mono font-bold uppercase text-laser-300">Preco sugerido</span>
                <strong className="text-xl text-white">{pricingResult ? currencyBRL(pricingResult.suggestedPrice) : '--'}</strong>
                {pricingResult && (
                  <span className="ml-2 text-xs text-slate-300">
                    lucro {currencyBRL(pricingResult.profit)}
                  </span>
                )}
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
    </div>
  );
};
