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
  const color = getMarketplaceVariantColor(product);
  if (!color) return `product:${product.id}`;
  const familyTitle = getMarketplaceFamilyTitle(product);
  if (!familyTitle) return `product:${product.id}`;
  return `family:${normalizeText(familyTitle)}`;
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
      .map((sibling) => {
        const color = getMarketplaceVariantColor(sibling) || 'Padrao';
        const images = sibling.color_images?.length
          ? sibling.color_images.map((img, idx) => ({ ...img, color_name: color, sort_order: idx, video_url: img.video_url || sibling.video_url }))
          : [{ image_url: sibling.image_url, video_url: sibling.video_url, color_name: color, sort_order: 0 }];
        return {
          ...sibling,
          store_variant_color: color,
          color_images: images,
        };
      })
      .sort((a, b) => colorOrder(a.store_variant_color || '') - colorOrder(b.store_variant_color || '') || a.id - b.id);

    const defaultProduct = variants.find((variant) => normalizeText(variant.store_variant_color || '') === 'branco') || variants[0];
    const colorImages = variants.flatMap((variant) => variant.color_images || []);
    const colorStocks = variants.map((variant) => ({
      color_name: variant.store_variant_color || 'Padrao',
      stock_qty: getTotalStock(variant),
    }));

    const mainVideoUrl = variants.find((v) => v.video_url)?.video_url || defaultProduct.video_url;

    return {
      ...defaultProduct,
      title: getMarketplaceFamilyTitle(defaultProduct),
      image_url: defaultProduct.color_images?.[0]?.image_url || defaultProduct.image_url,
      video_url: mainVideoUrl,
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

export const getStoreCategoryName = (category?: { name?: string; slug?: string }) => {
  if (category?.slug === 'importados-mercadolivre') return 'Produtos 3D';
  return category?.name || 'Catálogo';
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
      tone: 'border-rose-800 bg-rose-700 text-white dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200',
      canBuy: false,
    };
  }
  if (totalStock <= 3) {
    return {
      label: 'Baixo estoque',
      tone: 'border-amber-800 bg-amber-700 text-white dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200',
      canBuy: true,
    };
  }
  return {
    label: 'Disponivel',
    tone: 'border-emerald-800 bg-emerald-700 text-white dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200',
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

export const optimizeImageUrl = (url?: string): string => {
  if (!url) return '';
  let trimmed = url.trim();
  if (!trimmed) return '';

  // Use HTTPS for faster CDN responses without redirects
  if (trimmed.startsWith('http://')) {
    trimmed = 'https://' + trimmed.slice(7);
  }

  // Mercado Livre CDN (mlstatic.com / mercadolibre.com) serves WebP when extension is changed
  if (/mlstatic\.com|mercadolibre\.com/i.test(trimmed)) {
    return trimmed.replace(/\.(jpg|jpeg|png)(\?.*)?$/i, '.webp$2');
  }

  return trimmed;
};

export interface WholesaleTierInfo {
  percent: number;
  label: string;
  badge: string | null;
  discountedUnitPrice: (originalPrice: number) => number;
}

export const getWholesaleDiscount = (qty: number) => {
  if (qty >= 10) {
    return {
      percent: 7,
      label: '7% OFF Atacado (10+ un)',
      badge: '7% OFF Atacado',
      calculateUnitPrice: (originalPrice: number) => Math.round(originalPrice * (1 - 0.07) * 100) / 100,
    };
  }
  if (qty >= 6) {
    return {
      percent: 5,
      label: '5% OFF Atacado (6 a 9 un)',
      badge: '5% OFF Atacado',
      calculateUnitPrice: (originalPrice: number) => Math.round(originalPrice * (1 - 0.05) * 100) / 100,
    };
  }
  if (qty >= 3) {
    return {
      percent: 2,
      label: '2% OFF Atacado (3 a 5 un)',
      badge: '2% OFF Atacado',
      calculateUnitPrice: (originalPrice: number) => Math.round(originalPrice * (1 - 0.02) * 100) / 100,
    };
  }
  return {
    percent: 0,
    label: '',
    badge: null,
    calculateUnitPrice: (originalPrice: number) => originalPrice,
  };
};

/**
 * Converte strings de dimensões em milímetros (mm) para centímetros (cm)
 * Ex: "68.5 x 65.0 x 72.2 mm" -> "6,9 x 6,5 x 7,2 cm"
 * Ex: "120 x 120 x 150 mm" -> "12 x 12 x 15 cm"
 * Ex: "12 x 12 x 15 cm" -> "12 x 12 x 15 cm" (inalterado)
 */
export const formatDimensionsToCm = (raw?: string | null): string => {
  if (!raw || typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '--' || trimmed.toLowerCase() === 'a confirmar') return '';

  // Se já estiver explicitamente em cm e não contiver mm, preserva
  if (/\bcm\b/i.test(trimmed) && !/\bmm\b/i.test(trimmed)) {
    return trimmed;
  }

  const formatMmNum = (numStr: string): string => {
    const clean = numStr.replace(',', '.');
    const val = parseFloat(clean);
    if (isNaN(val)) return numStr;
    const cm = val / 10;
    // Inteiro exato
    if (Math.round(cm) === cm || Math.abs(cm - Math.round(cm)) < 0.001) {
      return Math.round(cm).toString();
    }
    // 1 casa decimal arredondada (ex: 6.85 -> 6.9; 6.5 -> 6.5)
    const rounded = cm >= 1 
      ? Math.round(cm * 10) / 10 
      : Math.round(cm * 100) / 100;
    return rounded.toString().replace('.', ',');
  };

  // Padrão 1: Dimensões compostas: "68.5 x 65.0 x 72.2 mm", "120 × 120 × 150 mm", "120 x 80 mm"
  const multiMatch = trimmed.match(
    /\b(\d+(?:[.,]\d+)?)\s*(?:mm)?\s*[xX×*]\s*(\d+(?:[.,]\d+)?)\s*(?:mm)?(?:\s*[xX×*]\s*(\d+(?:[.,]\d+)?))?\s*(?:mm)?\b/i
  );

  if (multiMatch) {
    const [, n1, n2, n3] = multiMatch;
    const fullMatch = multiMatch[0];
    const hasMm = /\bmm\b/i.test(trimmed) || /mm/i.test(fullMatch);
    const val1 = parseFloat(n1.replace(',', '.'));
    const val2 = parseFloat(n2.replace(',', '.'));
    const val3 = n3 ? parseFloat(n3.replace(',', '.')) : 0;

    // Se tiver 'mm' explícito ou valores típicos de mm de impressão 3D (>= 20)
    if (hasMm || val1 >= 20 || val2 >= 20 || val3 >= 20) {
      const c1 = formatMmNum(n1);
      const c2 = formatMmNum(n2);
      const c3 = n3 ? formatMmNum(n3) : null;
      const convertedPart = c3 ? `${c1} x ${c2} x ${c3} cm` : `${c1} x ${c2} cm`;

      if (trimmed === fullMatch || trimmed.toLowerCase() === fullMatch.toLowerCase()) {
        return convertedPart;
      }
      return trimmed.replace(fullMatch, convertedPart);
    }
  }

  // Padrão 2: Formatos com Alt / Larg / Prof ou mm isolado (ex: "Alt: 150mm • Larg: 120mm • Prof: 120mm")
  if (/\bmm\b/i.test(trimmed)) {
    return trimmed.replace(/(\d+(?:[.,]\d+)?)\s*mm\b/gi, (_, n) => `${formatMmNum(n)} cm`);
  }

  return trimmed;
};

/**
 * Extração de dimensões a partir da descrição ou campo dimensions do produto,
 * convertendo automaticamente para centímetros (cm) para exibição a clientes.
 */
export const extractProductDimensions = (product?: { description?: string; dimensions?: string } | null): string => {
  if (!product) return '';
  const desc = product.description || '';

  let raw = '';

  if (desc) {
    // 1. Linhas com "Dimensões", "Medidas", "Tamanho"
    const lineMatch = desc.match(
      /(?:dimens[õo]es|medidas?|tamanho|dimensao)(?:\s*(?:aproximadas?|totais?|do produto|\([^)]*\)))?\s*[:\-–]\s*([^\n\r]+)/i
    );
    if (lineMatch && lineMatch[1]) {
      let r = lineMatch[1].trim();
      const dotIdx = r.indexOf('.');
      if (dotIdx > 0 && (r.slice(dotIdx).includes(' ') || dotIdx > 8)) {
        r = r.slice(0, dotIdx).trim();
      }
      r = r.replace(/[;,.\-]+$/, '').trim();
      if (r.length >= 2 && r.length <= 50) {
        raw = r;
      }
    }

    // 2. Altura, Largura e Comprimento/Profundidade estruturados
    if (!raw) {
      const altMatch = desc.match(/(?:alt(?:ura)?)\s*[:\-–]?\s*(\d+(?:[.,]\d+)?\s*(?:cm|mm|m)?)/i);
      const largMatch = desc.match(/(?:larg(?:ura)?)\s*[:\-–]?\s*(\d+(?:[.,]\d+)?\s*(?:cm|mm|m)?)/i);
      const profMatch = desc.match(/(?:prof(?:undidade)?|comp(?:rimento)?)\s*[:\-–]?\s*(\d+(?:[.,]\d+)?\s*(?:cm|mm|m)?)/i);
      if (altMatch && largMatch) {
        const parts = [
          altMatch[1] ? `Alt: ${altMatch[1]}` : null,
          largMatch[1] ? `Larg: ${largMatch[1]}` : null,
          profMatch ? `Prof: ${profMatch[1]}` : null,
        ].filter(Boolean);
        raw = parts.join(' • ');
      }
    }

    // 3. Padrão numérico clássico: ex: "12 x 10 x 8 cm" ou "120 × 120 × 150 mm" ou "15 x 10 cm"
    if (!raw) {
      const numMatch = desc.match(
        /\b\d+(?:[.,]\d+)?\s*(?:cm|mm|m)?\s*[xX×*]\s*\d+(?:[.,]\d+)?\s*(?:cm|mm|m)?(?:\s*[xX×*]\s*\d+(?:[.,]\d+)?\s*(?:cm|mm|m)?)?\b/
      );
      if (numMatch && numMatch[0]) {
        raw = numMatch[0].trim();
      }
    }
  }

  // 4. Fallback para campo dimensions do produto se preenchido e não genérico
  if (!raw && product.dimensions && product.dimensions.trim() && product.dimensions !== 'A confirmar' && product.dimensions !== '--') {
    raw = product.dimensions.trim();
  }

  if (!raw) return '';

  return formatDimensionsToCm(raw);
};



