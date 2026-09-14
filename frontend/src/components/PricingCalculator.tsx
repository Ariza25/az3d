import React, { useEffect, useState } from 'react';
import { Calculator, Clock, DollarSign, Loader2, PackageCheck, Percent, Save, Zap } from 'lucide-react';
import { Product, TenantSettings } from '../types';
import {
  DEFAULT_PRINTING_PRICING,
  EXCEL_BASE_PRODUCTS,
  PrintingPricingInput,
  PrintingPricingResult,
  currencyBRL,
  formatPrintDuration,
  parsePrintMinutes,
  parseWeightGrams,
} from '../utils/printingPricing';
import { api } from '../services/api';

interface PricingCalculatorProps {
  products?: Product[];
  tenantId?: number;
  tenantSettings?: TenantSettings | null;
  onSettingsSaved?: (settings: TenantSettings) => void;
  onProductPricingApplied?: (product: Product) => void;
}

interface ExcelCalculatedRow {
  name: string;
  weight: number;
  minutes: number;
  result: PrintingPricingResult;
}

const inputFromTenantSettings = (settings?: TenantSettings | null): PrintingPricingInput => ({
  ...DEFAULT_PRINTING_PRICING,
  spoolPrice: settings?.default_spool_price ?? DEFAULT_PRINTING_PRICING.spoolPrice,
  spoolWeightGrams: settings?.default_spool_weight ?? DEFAULT_PRINTING_PRICING.spoolWeightGrams,
  printerPowerKw: settings?.default_printer_power_kw ?? DEFAULT_PRINTING_PRICING.printerPowerKw,
  energyTariffPerKwh: settings?.default_energy_tariff ?? DEFAULT_PRINTING_PRICING.energyTariffPerKwh,
  packagingCost: settings?.default_packaging_cost ?? DEFAULT_PRINTING_PRICING.packagingCost,
  laborCost: settings?.default_labor_cost ?? DEFAULT_PRINTING_PRICING.laborCost,
  extraCost: settings?.default_extra_cost ?? DEFAULT_PRINTING_PRICING.extraCost,
  failureRatePercent: settings?.default_failure_rate_percent ?? DEFAULT_PRINTING_PRICING.failureRatePercent,
  marginPercent: settings?.default_margin_percent ?? DEFAULT_PRINTING_PRICING.marginPercent,
  platformFeePercent: settings?.default_platform_fee_percent ?? DEFAULT_PRINTING_PRICING.platformFeePercent,
  paymentFeePercent: settings?.default_payment_fee_percent ?? DEFAULT_PRINTING_PRICING.paymentFeePercent,
  fixedFee: settings?.default_fixed_fee ?? DEFAULT_PRINTING_PRICING.fixedFee,
});

export const PricingCalculator: React.FC<PricingCalculatorProps> = ({
  products = [],
  tenantId,
  tenantSettings,
  onSettingsSaved,
  onProductPricingApplied,
}) => {
  const [input, setInput] = useState<PrintingPricingInput>(() => inputFromTenantSettings(tenantSettings));
  const [selectedProductId, setSelectedProductId] = useState('');
  const [result, setResult] = useState<PrintingPricingResult | null>(null);
  const [excelRows, setExcelRows] = useState<ExcelCalculatedRow[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setInput((prev) => ({
      ...inputFromTenantSettings(tenantSettings),
      productWeightGrams: prev.productWeightGrams,
      supportWeightGrams: prev.supportWeightGrams,
      printMinutes: prev.printMinutes,
    }));
    setResult(null);
    setExcelRows([]);
  }, [tenantSettings]);

  const updateNumber = (field: keyof PrintingPricingInput, value: string) => {
    setInput((prev) => ({ ...prev, [field]: Number(value) || 0 }));
    setResult(null);
    setExcelRows([]);
    setSaved(false);
  };

  const runCalculation = async (nextInput = input) => {
    setIsCalculating(true);
    setError(null);
    try {
      const response = await api.calculatePricing(nextInput, tenantId);
      setInput(response.input);
      setResult(response.result);

      const rows = await Promise.all(
        EXCEL_BASE_PRODUCTS.map(async (item) => {
          const itemResponse = await api.calculatePricing(
            {
              ...response.input,
              productWeightGrams: item.weight,
              supportWeightGrams: 0,
              printMinutes: item.minutes,
            },
            tenantId
          );
          return { ...item, result: itemResponse.result };
        })
      );
      setExcelRows(rows);
      return response;
    } catch (err: any) {
      setError(err.message || 'Erro ao calcular precificacao');
      throw err;
    } finally {
      setIsCalculating(false);
    }
  };

  const saveDefaults = async () => {
    if (!tenantSettings) return;
    setIsSaving(true);
    setError(null);
    try {
      const updated = await api.updateAdminTenantSettings(
        {
          ...tenantSettings,
          default_spool_price: input.spoolPrice,
          default_spool_weight: input.spoolWeightGrams,
          default_printer_power_kw: input.printerPowerKw,
          default_energy_tariff: input.energyTariffPerKwh,
          default_packaging_cost: input.packagingCost,
          default_labor_cost: input.laborCost,
          default_extra_cost: input.extraCost,
          default_failure_rate_percent: input.failureRatePercent,
          default_margin_percent: input.marginPercent,
          default_platform_fee_percent: input.platformFeePercent,
          default_payment_fee_percent: input.paymentFeePercent,
          default_fixed_fee: input.fixedFee,
        },
        tenantId
      );
      onSettingsSaved?.(updated);
      setSaved(true);
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar parametros');
    } finally {
      setIsSaving(false);
    }
  };

  const applyToSelectedProduct = async () => {
    const productId = Number(selectedProductId);
    if (!productId || !result) return;
    setIsApplying(true);
    setError(null);
    try {
      const response = await api.applyProductPricing(productId, input, tenantId);
      setResult(response.result);
      onProductPricingApplied?.(response.product);
    } catch (err: any) {
      setError(err.message || 'Erro ao aplicar preco ao produto');
    } finally {
      setIsApplying(false);
    }
  };

  const loadProduct = (productId: string) => {
    setSelectedProductId(productId);
    const product = products.find((item) => String(item.id) === productId);
    if (!product) return;
    setInput((prev) => ({
      ...prev,
      productWeightGrams: parseWeightGrams(product.weight),
      printMinutes: parsePrintMinutes(product.print_time),
    }));
    setResult(null);
    setExcelRows([]);
    setSaved(false);
  };

  const applyBaseProduct = (name: string) => {
    const item = EXCEL_BASE_PRODUCTS.find((product) => product.name === name);
    if (!item) return;
    const nextInput = {
      ...input,
      productWeightGrams: item.weight,
      supportWeightGrams: 0,
      printMinutes: item.minutes,
    };
    setInput(nextInput);
    setSelectedProductId('');
    setResult(null);
    setExcelRows([]);
    setSaved(false);
  };

  const Field = ({
    label,
    field,
    step = '0.01',
    suffix,
  }: {
    label: string;
    field: keyof PrintingPricingInput;
    step?: string;
    suffix?: string;
  }) => (
    <label className="space-y-1.5">
      <span className="text-[10px] font-mono font-bold uppercase text-slate-600 dark:text-slate-400">{label}</span>
      <div className="flex items-center rounded-xl border border-slate-300 bg-white shadow-sm focus-within:border-cyan-700 dark:border-chumbo-800 dark:bg-chumbo-950 dark:focus-within:border-laser-400">
        <input
          type="number"
          step={step}
          value={Number(input[field] || 0)}
          onChange={(event) => updateNumber(field, event.target.value)}
          className="w-full bg-transparent px-3 py-2 text-sm text-slate-900 focus:outline-none dark:text-white"
        />
        {suffix && <span className="pr-3 text-[10px] font-mono text-slate-500">{suffix}</span>}
      </div>
    </label>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
            <Calculator className="h-4 w-4 text-cyan-700 dark:text-laser-400" />
            <span>Calculadora de precificação 3D</span>
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            O backend calcula custos, margem e taxas do tenant. O painel apenas envia os dados de peso e tempo.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => runCalculation()}
            disabled={isCalculating}
            className="flex items-center justify-center gap-2 rounded-xl bg-cyan-700 px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-cyan-800 disabled:opacity-60 dark:bg-laser-400 dark:text-chumbo-950 dark:hover:bg-laser-300"
          >
            {isCalculating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
            <span>Calcular no backend</span>
          </button>
          <button
            type="button"
            onClick={saveDefaults}
            disabled={isSaving || !tenantSettings}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-100 dark:border-chumbo-700 dark:bg-chumbo-950 dark:text-slate-200 dark:hover:bg-chumbo-800 disabled:opacity-60"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            <span>{saved ? 'Parâmetros salvos' : 'Salvar no tenant'}</span>
          </button>
          <button
            type="button"
            onClick={applyToSelectedProduct}
            disabled={isApplying || !selectedProductId || !result}
            className="flex items-center justify-center gap-2 rounded-xl border border-cyan-300 bg-cyan-50 px-4 py-2 text-xs font-bold text-cyan-800 shadow-sm transition-colors hover:bg-cyan-100 dark:border-laser-500/40 dark:bg-laser-500/10 dark:text-laser-200 dark:hover:bg-laser-500/20 disabled:opacity-40"
          >
            {isApplying ? <Loader2 className="h-4 w-4 animate-spin" /> : <DollarSign className="h-4 w-4" />}
            <span>Aplicar ao produto</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-chumbo-800 dark:bg-chumbo-900/60 lg:col-span-2">
          <label className="block space-y-1.5">
            <span className="text-[10px] font-mono font-bold uppercase text-slate-600 dark:text-slate-400">Carregar produto cadastrado</span>
            <select
              value={selectedProductId}
              onChange={(e) => loadProduct(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-cyan-700 focus:outline-none dark:border-chumbo-800 dark:bg-chumbo-950 dark:text-white dark:focus:border-laser-400"
            >
              <option value="">Selecionar produto...</option>
              {products.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title} ({item.sku || 'sem sku'})
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field label="Peso modelo" field="productWeightGrams" step="0.1" suffix="g" />
            <Field label="Peso suporte" field="supportWeightGrams" step="0.1" suffix="g" />
            <Field label="Tempo total" field="printMinutes" step="1" suffix="min" />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field label="Preco do rolo" field="spoolPrice" suffix="R$" />
            <Field label="Peso do rolo" field="spoolWeightGrams" step="1" suffix="g" />
            <Field label="Potencia media" field="printerPowerKw" step="0.001" suffix="kW" />
            <Field label="Tarifa energia" field="energyTariffPerKwh" suffix="R$/kWh" />
            <Field label="Embalagem" field="packagingCost" suffix="R$" />
            <Field label="Mao de obra" field="laborCost" suffix="R$" />
            <Field label="Custos extras" field="extraCost" suffix="R$" />
            <Field label="Perdas" field="failureRatePercent" suffix="%" />
            <Field label="Margem desejada" field="marginPercent" suffix="%" />
            <Field label="Taxa plataforma" field="platformFeePercent" suffix="%" />
            <Field label="Taxa pagamento" field="paymentFeePercent" suffix="%" />
            <Field label="Taxa fixa" field="fixedFee" suffix="R$" />
          </div>
        </div>

        <div className="space-y-4 rounded-2xl border border-cyan-300 bg-cyan-50/70 p-4 shadow-sm dark:border-laser-500/30 dark:bg-laser-500/10">
          <div>
            <span className="text-[10px] font-mono font-bold uppercase text-cyan-800 dark:text-laser-300">Preço sugerido</span>
            <div className="mt-1 text-3xl font-extrabold text-cyan-950 dark:text-white">
              {result ? currencyBRL(result.suggestedPrice) : '--'}
            </div>
            <p className="mt-1 text-xs text-slate-700 dark:text-slate-300 font-medium">
              {result
                ? `Líquido após taxas: ${currencyBRL(result.netAfterFees)} | Lucro: ${currencyBRL(result.profit)}`
                : 'Execute o cálculo para ver o resultado atualizado.'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <Metric icon={<PackageCheck className="h-4 w-4" />} label="Custo PLA" value={result ? currencyBRL(result.materialCost) : '--'} />
            <Metric icon={<Zap className="h-4 w-4" />} label="Energia" value={result ? currencyBRL(result.energyCost) : '--'} />
            <Metric icon={<Clock className="h-4 w-4" />} label="Tempo" value={formatPrintDuration(input.printMinutes)} />
            <Metric icon={<Percent className="h-4 w-4" />} label="Taxas" value={result ? currencyBRL(result.totalFees) : '--'} />
            <Metric icon={<DollarSign className="h-4 w-4" />} label="Custo direto" value={result ? currencyBRL(result.directCost) : '--'} />
            <Metric icon={<Percent className="h-4 w-4" />} label="Margem real" value={result ? `${result.profitMarginPercent.toFixed(1)}%` : '--'} />
          </div>

          {result && (
            <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700 shadow-sm dark:border-chumbo-800 dark:bg-chumbo-950/70 dark:text-slate-300">
              <div className="flex justify-between">
                <span>Material total</span>
                <strong className="text-slate-900 dark:text-white">{result.totalMaterialGrams.toFixed(2)} g</strong>
              </div>
              <div className="mt-1 flex justify-between">
                <span>Custo por grama</span>
                <strong className="text-slate-900 dark:text-white">{currencyBRL(result.materialCostPerGram)}</strong>
              </div>
              <div className="mt-1 flex justify-between">
                <span>Energia estimada</span>
                <strong className="text-slate-900 dark:text-white">{result.energyKwh.toFixed(3)} kWh</strong>
              </div>
              <div className="mt-1 flex justify-between">
                <span>Reserva de perda</span>
                <strong className="text-slate-900 dark:text-white">{currencyBRL(result.failureReserve)}</strong>
              </div>
              <div className="mt-1 flex justify-between">
                <span>Custo operacional</span>
                <strong className="text-slate-900 dark:text-white">{currencyBRL(result.operationalCost)}</strong>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-chumbo-800 dark:bg-chumbo-950/60">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-chumbo-800">
          <h4 className="text-xs font-bold text-slate-900 dark:text-white">Base inicial do Excel</h4>
          <span className="text-[10px] font-mono text-slate-500">calculada pela API</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase text-slate-600 dark:bg-chumbo-950 dark:text-slate-400">
              <tr>
                <th className="p-3">Produto</th>
                <th className="p-3">Peso</th>
                <th className="p-3">Tempo</th>
                <th className="p-3">Custo direto</th>
                <th className="p-3">Preço sugerido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 dark:divide-chumbo-850 dark:text-slate-300">
              {EXCEL_BASE_PRODUCTS.map((item) => {
                const calculated = excelRows.find((row) => row.name === item.name);
                return (
                  <tr
                    key={item.name}
                    className="cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-chumbo-850/60"
                    onClick={() => applyBaseProduct(item.name)}
                  >
                    <td className="p-3 font-semibold text-slate-900 dark:text-white">{item.name}</td>
                    <td className="p-3 font-mono">{item.weight.toFixed(2)} g</td>
                    <td className="p-3 font-mono">{formatPrintDuration(item.minutes)}</td>
                    <td className="p-3 font-mono">{calculated ? currencyBRL(calculated.result.directCost) : '--'}</td>
                    <td className="p-3 font-bold text-cyan-700 dark:text-laser-300">
                      {calculated ? currencyBRL(calculated.result.suggestedPrice) : '--'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const Metric = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-chumbo-800 dark:bg-chumbo-950/70">
    <div className="mb-2 text-cyan-700 dark:text-laser-300">{icon}</div>
    <span className="block text-[10px] font-mono font-bold uppercase text-slate-500 dark:text-slate-400">{label}</span>
    <strong className="mt-1 block text-sm text-slate-900 dark:text-white">{value}</strong>
  </div>
);
