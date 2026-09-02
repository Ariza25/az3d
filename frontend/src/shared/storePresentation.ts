import { Product } from '../types';

const marketplaceColors = [
  'Branco', 'Preto', 'Cinza', 'Bege', 'Vermelho', 'Azul', 'Verde', 'Amarelo',
  'Rosa', 'Roxo', 'Laranja', 'Marrom', 'Natural', 'Dourado', 'Prata',
];

const skuColorNames: Record<string, string> = {
  BRA: 'Branco', BR: 'Branco', PRE: 'Preto', PT: 'Preto', CIN: 'Cinza', CZ: 'Cinza',
  BEG: 'Bege', BG: 'Bege', VER: 'Vermelho', VM: 'Vermelho', AZU: 'Azul', AZ: 'Azul',
  VRD: 'Verde', VD: 'Verde', AMA: 'Amarelo', AM: 'Amarelo', ROS: 'Rosa', RX: 'Roxo',
};

const normalizeText = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

export const getMarketplaceVariantColor = (product: Product) => {
  if (product.store_variant_color) return product.store_variant_color;

  const explicitColor = [
    ...(product.variants || []).map((variant) => variant.color_name),
    ...(product.color_images || []).map((image) => image.color_name),
    ...(product.color_stocks || []).map((stock) => stock.color_name),
  ].find((name) => name && normalizeText(name) !== 'padrao');
  if (explicitColor) return explicitColor;

  const normalizedTitle = normalizeText(product.title);
  const titleColor = marketplaceColors.find((color) => normalizedTitle.endsWith(` ${normalizeText(color)}`));
  if (titleColor) return titleColor;

  const skuSuffix = (product.sku || '').toUpperCase().split(/[-_]/).filter(Boolean).pop() || '';
  return skuColorNames[skuSuffix] || '';
};

export const getMarketplaceFamilyTitle = (product: Product) => {
  const color = getMarketplaceVariantColor(product);
  if (!color) return product.title.trim();
  const suffix = new RegExp(`\\s+${color.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i');
  return product.title.replace(suffix, '').replace(/\s{2,}/g, ' ').trim();
};

const marketplaceFamilyKey = (product: Product) => {
  if (normalizeText(product.source_provider || '') !== 'mercadolivre') return `product:${product.id}`;
  const color = getMarketplaceVariantColor(product);
  if (!color) return `product:${product.id}`;
  return `mercadolivre:${normalizeText(getMarketplaceFamilyTitle(product))}`;
};

const colorOrder = (color: string) => {
  const index = marketplaceColors.findIndex((item) => normalizeText(item) === normalizeText(color));
  return index < 0 ? marketplaceColors.length : index;
};

export const groupMarketplaceProducts = (products: Product[]) => {
  const groups = new Map<string, Product[]>();
  products.forEach((product) => {
    const key = marketplaceFamilyKey(product);
    groups.set(key, [...(groups.get(key) || []), product]);
  });

  return Array.from(groups.values()).map((siblings) => {
    if (siblings.length === 1) return siblings[0];

    const variants = siblings
      .map((sibling) => ({ ...sibling, store_variant_color: getMarketplaceVariantColor(sibling) || 'Padrao' }))
      .sort((a, b) => colorOrder(a.store_variant_color || '') - colorOrder(b.store_variant_color || '') || a.id - b.id);
    const defaultProduct = variants.find((variant) => normalizeText(variant.store_variant_color || '') === 'branco') || variants[0];
    const colorImages = variants.flatMap((variant) => {
      const color = variant.store_variant_color || 'Padrao';
      const images = variant.color_images?.length
        ? variant.color_images
        : [{ image_url: variant.image_url, color_name: color, sort_order: 0 }];
      return images.map((image, index) => ({ ...image, color_name: color, sort_order: index }));
    });
    const colorStocks = variants.map((variant) => ({
      color_name: variant.store_variant_color || 'Padrao',
      stock_qty: getTotalStock(variant),
    }));

    return {
      ...defaultProduct,
      title: getMarketplaceFamilyTitle(defaultProduct),
      image_url: defaultProduct.color_images?.[0]?.image_url || defaultProduct.image_url,
      price: Math.min(...variants.map((variant) => variant.price)),
      in_stock: variants.some((variant) => getStockStatus(variant).canBuy),
      stock_qty: colorStocks.reduce((total, stock) => total + stock.stock_qty, 0),
      color_images: colorImages,
      color_stocks: colorStocks,
      store_variants: variants,
    };
  });
};

export const getStoreVariantProduct = (product: Product, color?: string) => {
  if (!product.store_variants?.length) return product;
  const normalizedColor = normalizeText(color || '');
  return product.store_variants.find((variant) => normalizeText(getMarketplaceVariantColor(variant)) === normalizedColor)
    || product.store_variants[0];
};

export const money = (value: number) => `R$ ${value.toFixed(2).replace('.', ',')}`;

export const getTotalStock = (product: Product) => {
  if (product.color_stocks?.length) {
    return product.color_stocks.reduce((total, stock) => total + Math.max(0, stock.stock_qty), 0);
  }
  return Math.max(0, product.stock_qty || 0);
};

export const getStockStatus = (product: Product) => {
  const totalStock = getTotalStock(product);
  if (!product.in_stock || totalStock <= 0) {
    return {
      label: 'Esgotado',
      tone: 'border-red-500/40 bg-red-500/10 text-red-200',
      canBuy: false,
    };
  }
  if (totalStock <= 3) {
    return {
      label: 'Baixo estoque',
      tone: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
      canBuy: true,
    };
  }
  return {
    label: 'Disponivel',
    tone: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
    canBuy: true,
  };
};

export const getAvailableColors = (product: Product) => {
  const names = new Set<string>();
  product.color_stocks?.forEach((stock) => {
    if (stock.stock_qty > 0) names.add(stock.color_name);
  });
  product.color_images?.forEach((image) => {
    if (image.color_name) names.add(image.color_name);
  });
  product.variants?.forEach((variant) => {
    if (variant.is_active) names.add(variant.color_name);
  });
  return Array.from(names);
};

export const getDefaultColor = (product: Product) => {
  const stockColor = product.color_stocks?.find((stock) => stock.stock_qty > 0)?.color_name;
  return stockColor || getAvailableColors(product)[0] || 'Padrao';
};

export const getColorVisual = (name: string) => {
  const normalized = name.toLowerCase();
  if (normalized.includes('preto') || normalized.includes('black')) return { hex: '#18181b', border: '#3f3f46' };
  if (normalized.includes('branco') || normalized.includes('white')) return { hex: '#f8fafc', border: '#e2e8f0' };
  if (normalized.includes('bege') || normalized.includes('beige')) return { hex: '#d6b98c', border: '#ead7b7' };
  if (normalized.includes('cinza') || normalized.includes('gray') || normalized.includes('chumbo')) return { hex: '#475569', border: '#94a3b8' };
  if (normalized.includes('azul') || normalized.includes('blue')) return { hex: '#2563eb', border: '#60a5fa' };
  if (normalized.includes('verde') || normalized.includes('green')) return { hex: '#16a34a', border: '#4ade80' };
  if (normalized.includes('vermelho') || normalized.includes('red')) return { hex: '#dc2626', border: '#f87171' };
  if (normalized.includes('amarelo') || normalized.includes('yellow')) return { hex: '#facc15', border: '#fde047' };
  if (normalized.includes('bronze') || normalized.includes('laranja') || normalized.includes('orange')) return { hex: '#d97706', border: '#f59e0b' };
  if (normalized.includes('rosa') || normalized.includes('pink')) return { hex: '#db2777', border: '#f472b6' };
  if (normalized.includes('roxo') || normalized.includes('purple')) return { hex: '#7c3aed', border: '#a78bfa' };
  return { hex: '#64748b', border: '#94a3b8' };
};
