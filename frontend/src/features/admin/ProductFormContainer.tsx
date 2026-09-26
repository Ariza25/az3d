import React, { useEffect, useState } from 'react';
import { Category, Parsed3MFResult, Product, ProductColorImage, ProductInput } from '../../types';
import { api, resolveApiAssetUrl } from '../../services/api';
import { ProductFormView } from './components/product-form';

export interface ProductFormModalProps {
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
  price: 99.9,
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

const formatPrintDuration = (minutes: number) => {
  if (!minutes || minutes <= 0) return '';
  const rounded = Math.round(minutes);
  const hours = Math.floor(rounded / 60);
  const mins = rounded % 60;
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours} horas`;
  return `${hours}h ${mins}min`;
};

export const ProductFormContainer: React.FC<ProductFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  productToEdit,
  categories,
}) => {
  const [formData, setFormData] = useState<ProductInput>(() =>
    createDefaultProductInput(categories[0]?.id || 1)
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isParsing3MF, setIsParsing3MF] = useState(false);
  const [isDragging3MF, setIsDragging3MF] = useState(false);
  const [parsed3MF, setParsed3MF] = useState<Parsed3MFResult | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

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
        pricing_snapshot: productToEdit.pricing_snapshot,
        color_stocks: productToEdit.color_stocks?.length
          ? productToEdit.color_stocks.map((stock) => ({
              color_name: stock.color_name,
              stock_qty: stock.stock_qty,
            }))
          : [{ color_name: 'Preto Slate', stock_qty: productToEdit.stock_qty || 10 }],
        variants: productToEdit.variants?.length
          ? productToEdit.variants.map((variant) => ({
              color_name: variant.color_name,
              price: variant.price,
              material: variant.material || productToEdit.material,
              layer_height: variant.layer_height || productToEdit.layer_height,
              print_time: variant.print_time || productToEdit.print_time,
              weight: variant.weight || productToEdit.weight,
              is_active: variant.is_active,
              sort_order: variant.sort_order,
              variation_name: variant.variation_name || variant.color_name,
            }))
          : [],
      });
    } else {
      setFormData(createDefaultProductInput(categories[0]?.id || 1));
    }
    setParsed3MF(null);
    setError(null);
  }, [productToEdit, categories, isOpen]);

  const handleUploadImage = async (file: File, onUrl: (url: string) => void) => {
    try {
      const result = await api.uploadProductImage(file);
      onUrl(resolveApiAssetUrl(result.url));
    } catch (err: any) {
      setError(err.message || 'Erro ao enviar imagem');
    }
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
          next.weight = `${Math.max(1, Math.round(data.product_weight_grams))}g`;
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
        if (next.variants && next.variants.length > 0) {
          next.variants = next.variants.map((v) => ({
            ...v,
            weight:
              (!v.weight || v.weight === '0g' || v.weight === 'A confirmar') && data.product_weight_grams > 0
                ? `${Math.max(1, Math.round(data.product_weight_grams))}g`
                : v.weight,
            print_time:
              (!v.print_time || v.print_time === 'A confirmar') && data.print_minutes > 0
                ? formatPrintDuration(data.print_minutes)
                : v.print_time,
          }));
        }
        return next;
      });
    } catch (err: any) {
      setError(err.message || 'Falha ao processar arquivo .3mf');
    } finally {
      setIsParsing3MF(false);
    }
  };

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

  const updateField = <K extends keyof ProductInput>(field: K, value: ProductInput[K]) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
      ...(field === 'price' ? { pricing_snapshot: undefined } : {}),
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

  const duplicateColorImage = (image: ProductColorImage) => {
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
  };

  const removeColorImage = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      color_images: (prev.color_images || []).filter((_, imageIndex) => imageIndex !== index),
    }));
  };

  const updateColorImage = (index: number, field: 'color_name' | 'image_url', value: string) => {
    setFormData((prev) => ({
      ...prev,
      color_images: (prev.color_images || []).map((image, imageIndex) =>
        imageIndex === index ? { ...image, [field]: value } : image
      ),
    }));
  };

  const uploadImageFiles = async (index: number, colorName: string, files: File[]) => {
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
                color_name: colorName || 'Padrão',
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

  const updateVariant = (index: number, field: string, value: string | boolean) => {
    setFormData((prev) => ({
      ...prev,
      variants: (prev.variants || []).map((variant, variantIndex) =>
        variantIndex === index
          ? {
              ...variant,
              [field]: field === 'price' ? parseFloat(value as string) || 0 : value,
            }
          : variant
      ),
    }));
  };

  return (
    <ProductFormView
      isOpen={isOpen}
      isEditing={Boolean(productToEdit)}
      error={error}
      isSubmitting={isSubmitting}
      formData={formData}
      categories={categories}
      isParsing3MF={isParsing3MF}
      isDragging3MF={isDragging3MF}
      parsed3MF={parsed3MF}
      isDetailsModalOpen={isDetailsModalOpen}
      onClose={onClose}
      onSubmit={handleSubmit}
      onChangeField={updateField}
      onUploadMainImage={(file) =>
        handleUploadImage(file, (url) => setFormData((prev) => ({ ...prev, image_url: url })))
      }
      onAddColorImage={addColorImage}
      onDuplicateColorImage={duplicateColorImage}
      onRemoveColorImage={removeColorImage}
      onUpdateColorImage={updateColorImage}
      onUploadImageFiles={uploadImageFiles}
      onAddColorStock={addColorStock}
      onRemoveColorStock={removeColorStock}
      onUpdateColorStock={updateColorStock}
      onAddVariant={addVariant}
      onRemoveVariant={removeVariant}
      onUpdateVariant={updateVariant}
      onDragOver3MF={(e) => {
        e.preventDefault();
        setIsDragging3MF(true);
      }}
      onDragLeave3MF={() => setIsDragging3MF(false)}
      onDrop3MF={(e) => {
        e.preventDefault();
        setIsDragging3MF(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          handle3MFUpload(e.dataTransfer.files[0]);
        }
      }}
      onFileSelect3MF={handle3MFUpload}
      onOpenDetailsModal={() => setIsDetailsModalOpen(true)}
      onCloseDetailsModal={() => setIsDetailsModalOpen(false)}
      formatPrintDuration={formatPrintDuration}
    />
  );
};
