import { Product } from '../types';

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
