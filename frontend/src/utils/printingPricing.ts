import type { PrintingPricingInput, PrintingPricingResult } from '../types';

export type { PrintingPricingInput, PrintingPricingResult };

export const DEFAULT_PRINTING_PRICING: PrintingPricingInput = {
  productWeightGrams: 84.84,
  supportWeightGrams: 0,
  printMinutes: 338,
  spoolPrice: 120,
  spoolWeightGrams: 1000,
  printerPowerKw: 0.07,
  energyTariffPerKwh: 1,
  packagingCost: 1.5,
  laborCost: 0,
  extraCost: 0,
  failureRatePercent: 8,
  marginPercent: 60,
  platformFeePercent: 12,
  paymentFeePercent: 4.99,
  fixedFee: 0,
};

export const EXCEL_BASE_PRODUCTS = [
  { name: 'Pote Trico', weight: 84.84, minutes: 338 },
  { name: 'Pote Cha', weight: 49.06, minutes: 193 },
  { name: 'Pote Coracao', weight: 46.81, minutes: 163 },
  { name: 'Porta Presente/Joia', weight: 113.62, minutes: 447 },
  { name: 'Porta Terco completo', weight: 69.95, minutes: 212 },
  { name: 'Porta Terco 15 cm', weight: 68.15, minutes: 187 },
  { name: 'Kit Vasos', weight: 89.2, minutes: 404 },
  { name: 'Vaso Cacto', weight: 79.89, minutes: 352 },
];

export const parseWeightGrams = (value: string): number => {
  const normalized = value.replace(',', '.').match(/[\d.]+/);
  return normalized ? Number(normalized[0]) || 0 : 0;
};

export const parsePrintMinutes = (value: string): number => {
  const lower = value.toLowerCase();
  const hourMinute = lower.match(/(\d+)\s*h(?:\s*(\d+))?/);
  if (hourMinute) {
    return (Number(hourMinute[1]) || 0) * 60 + (Number(hourMinute[2]) || 0);
  }
  const hours = lower.match(/(\d+(?:[,.]\d+)?)\s*hora/);
  if (hours) {
    return Math.round(Number(hours[1].replace(',', '.')) * 60);
  }
  const minutes = lower.match(/(\d+)\s*min/);
  return minutes ? Number(minutes[1]) || 0 : 0;
};

export const formatPrintDuration = (minutes: number): string => {
  const safeMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;
  return hours > 0 ? `${hours}h${String(mins).padStart(2, '0')}` : `${mins}min`;
};

export const formatWeight = (grams: number): string => `${Number(grams.toFixed(2))}g`;

export const currencyBRL = (value: number): string =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
