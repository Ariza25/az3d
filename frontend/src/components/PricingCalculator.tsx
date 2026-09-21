import React, { useEffect, useRef, useState } from 'react';
import {
  Calculator,
  CheckCircle2,
  Clock,
  DollarSign,
  Loader2,
  PackageCheck,
  Percent,
  Save,
  SlidersHorizontal,
  UploadCloud,
  X,
  Zap,
  Layers,
} from 'lucide-react';
import { Parsed3MFResult, Product, TenantSettings, FilamentSpool } from '../types';
import { SlicerSettingsModal } from './SlicerSettingsModal';
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
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [isParsing3MF, setIsParsing3MF] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [parsed3MFInfo, setParsed3MFInfo] = useState<Parsed3MFResult | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [registeredSpools, setRegisteredSpools] = useState<FilamentSpool[]>([]);
  const [selectedSpoolId, setSelectedSpoolId] = useState<number | ''>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    api.getFilamentSpools(tenantId)
      .then((data) => setRegisteredSpools(data || []))
      .catch(() => setRegisteredSpools([]));
  }, [tenantId]);

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
    setSuccessMsg(null);
    try {
      const response = await api.applyProductPricing(
        productId,
        {
          ...input,
          dimensions: parsed3MFInfo?.dimensions || input.dimensions,
          material: parsed3MFInfo?.material || input.material,
          layerHeight: parsed3MFInfo?.layer_height || input.layerHeight,
          slicerSettings: parsed3MFInfo?.raw_settings_json || input.slicerSettings,
        },
        tenantId
      );
      setResult(response.result);
      onProductPricingApplied?.(response.product);
      setSuccessMsg(`Configurações e preço sugerido aplicados ao item "${response.product.title}" com sucesso!`);
    } catch (err: any) {
      setError(err.message || 'Erro ao aplicar preco ao produto');
    } finally {
      setIsApplying(false);
    }
  };

  const loadProduct = (productId: string) => {
    setSelectedProductId(productId);
    setParsed3MFInfo(null);
    setSuccessMsg(null);
    const product = products.find((item) => String(item.id) === productId);
    if (!product) return;
    setInput((prev) => ({
      ...prev,
      productWeightGrams: parseWeightGrams(product.weight),
      printMinutes: parsePrintMinutes(product.print_time),
      dimensions: product.dimensions || '',
      material: product.material || '',
      layerHeight: product.layer_height || '',
      slicerSettings: product.slicer_settings || '',
    }));
    setResult(null);
    setExcelRows([]);
    setSaved(false);
  };

  const handle3MFUpload = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.3mf')) {
      setError('Por favor envie um arquivo com extensão .3mf.');
      return;
    }

    setIsParsing3MF(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const data = await api.parse3MF(file, tenantId);
      setParsed3MFInfo(data);

      const nextInput: PrintingPricingInput = {
        ...input,
        productWeightGrams: data.product_weight_grams > 0 ? data.product_weight_grams : input.productWeightGrams,
        supportWeightGrams: data.support_weight_grams > 0 ? data.support_weight_grams : 0,
        printMinutes: data.print_minutes > 0 ? data.print_minutes : input.printMinutes,
        dimensions: data.dimensions || input.dimensions,
        material: data.material || input.material,
        layerHeight: data.layer_height || input.layerHeight,
        slicerSettings: data.raw_settings_json || input.slicerSettings,
      };

      setInput(nextInput);
      await runCalculation(nextInput);
    } catch (err: any) {
      setError(err.message || 'Falha ao processar arquivo .3mf');
    } finally {
      setIsParsing3MF(false);
    }
  };

  const selectedProduct = products.find((item) => String(item.id) === selectedProductId);

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
    setParsed3MFInfo(null);
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

      {successMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-chumbo-800 dark:bg-chumbo-900/60 lg:col-span-2">
          {/* Seção de Seleção de Produto e Importação .3MF */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-[10px] font-mono font-bold uppercase text-slate-600 dark:text-slate-400">
                1. Carregar produto cadastrado
              </span>
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
              {selectedProduct && (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  <span>Peso: <strong className="text-slate-700 dark:text-slate-200">{selectedProduct.weight || '--'}</strong></span>
                  <span>•</span>
                  <span>Tempo: <strong className="text-slate-700 dark:text-slate-200">{selectedProduct.print_time || '--'}</strong></span>
                  <span>•</span>
                  <span>Dimensões: <strong className="text-slate-700 dark:text-slate-200">{selectedProduct.dimensions || '--'}</strong></span>
                  {selectedProduct.slicer_settings && (
                    <>
                      <span>•</span>
                      <button
                        type="button"
                        onClick={() => setIsDetailsModalOpen(true)}
                        className="inline-flex items-center gap-1 font-bold text-cyan-700 hover:underline dark:text-laser-300"
                      >
                        <SlidersHorizontal className="h-3 w-3" />
                        <span>Ver detalhes de fatiamento</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </label>

            <div className="space-y-1.5">
              <span className="text-[10px] font-mono font-bold uppercase text-slate-600 dark:text-slate-400">
                2. Importar arquivo .3MF (Bambu / Orca / Prusa)
              </span>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handle3MFUpload(e.dataTransfer.files[0]);
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-3 text-center transition-all ${
                  isDragging
                    ? 'border-cyan-500 bg-cyan-50/50 dark:border-laser-400 dark:bg-laser-500/10'
                    : 'border-slate-300 bg-slate-50/60 hover:bg-slate-100/80 dark:border-chumbo-800 dark:bg-chumbo-950/40 dark:hover:bg-chumbo-900/40'
                }`}
              >
                <input
                  ref={fileInputRef}
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
                  <div className="flex items-center gap-2 text-xs font-semibold text-cyan-700 dark:text-laser-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Lendo dados de fatiamento do .3MF...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <UploadCloud className="h-4 w-4 text-cyan-600 dark:text-laser-400" />
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      Clique ou arraste o <strong>.3MF</strong> para auto-preencher
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Banner com informações extraídas do .3MF */}
          {parsed3MFInfo && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cyan-300 bg-cyan-50/80 p-3 shadow-sm dark:border-laser-500/40 dark:bg-laser-500/10">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <div className="text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-white">
                      {parsed3MFInfo.file_name}
                    </span>
                    <span className="rounded-md bg-cyan-100 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-cyan-800 dark:bg-laser-500/20 dark:text-laser-300">
                      {parsed3MFInfo.slicer_detected || 'Fatiador 3MF'}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-mono text-slate-600 dark:text-slate-300">
                    {parsed3MFInfo.product_weight_grams > 0 && (
                      <span>Filamento: <strong className="text-slate-900 dark:text-white">{parsed3MFInfo.product_weight_grams} g</strong></span>
                    )}
                    {parsed3MFInfo.print_minutes > 0 && (
                      <span>• Tempo: <strong className="text-slate-900 dark:text-white">{formatPrintDuration(parsed3MFInfo.print_minutes)}</strong></span>
                    )}
                    {parsed3MFInfo.dimensions && (
                      <span>• Dimensões: <strong className="text-slate-900 dark:text-white">{parsed3MFInfo.dimensions}</strong></span>
                    )}
                    {parsed3MFInfo.layer_height && (
                      <span>• Camada: <strong className="text-slate-900 dark:text-white">{parsed3MFInfo.layer_height}</strong></span>
                    )}
                    {parsed3MFInfo.material && (
                      <span>• Material: <strong className="text-slate-900 dark:text-white">{parsed3MFInfo.material}</strong></span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsDetailsModalOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-cyan-300 bg-white px-2.5 py-1 text-xs font-semibold text-cyan-800 shadow-xs hover:bg-cyan-100/70 dark:border-laser-500/40 dark:bg-chumbo-950 dark:text-laser-300 dark:hover:bg-chumbo-900 transition-colors"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  <span>Ver detalhes</span>
                </button>
                <button
                  type="button"
                  onClick={() => setParsed3MFInfo(null)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-200/50 hover:text-slate-600 dark:hover:bg-chumbo-800 dark:hover:text-slate-200"
                  title="Fechar resumo do 3MF"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field label="Peso modelo" field="productWeightGrams" step="0.1" suffix="g" />
            <Field label="Peso suporte" field="supportWeightGrams" step="0.1" suffix="g" />
            <Field label="Tempo total" field="printMinutes" step="1" suffix="min" />
          </div>

          {/* Selecionar Carretel Ativo do Estoque */}
          {registeredSpools.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-chumbo-800 dark:bg-chumbo-950/40">
              <label className="block space-y-1">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-cyan-600 dark:text-laser-400" />
                    <span>Usar Carretel Cadastrado (Preço e Material do Estoque)</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {registeredSpools.length} carretéis disponíveis
                  </span>
                </div>
                <select
                  value={selectedSpoolId}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    setSelectedSpoolId(id || '');
                    const spool = registeredSpools.find((s) => s.id === id);
                    if (spool) {
                      const nextInput = {
                        ...input,
                        spoolPrice: spool.price_per_kg,
                        spoolWeightGrams: spool.spool_weight_g || 1000,
                        material: spool.material_type,
                      };
                      setInput(nextInput);
                      void runCalculation(nextInput);
                    }
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-cyan-600 focus:outline-none dark:border-chumbo-700 dark:bg-chumbo-900 dark:text-white"
                >
                  <option value="">Selecione um carretel para precificar...</option>
                  {registeredSpools.map((spool) => (
                    <option key={spool.id} value={spool.id}>
                      {spool.name} ({spool.vendor ? `${spool.vendor} · ` : ''}{spool.material_type} {spool.color_name}) - {currencyBRL(spool.price_per_kg)}/kg (Restante: {Math.round(spool.remaining_weight_g)}g)
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

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

      <SlicerSettingsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        settings={parsed3MFInfo?.settings}
        rawJson={parsed3MFInfo?.raw_settings_json || selectedProduct?.slicer_settings}
        title={parsed3MFInfo ? `Fatiamento: ${parsed3MFInfo.file_name}` : `Ficha Técnica: ${selectedProduct?.title || 'Produto'}`}
        slicerName={parsed3MFInfo?.slicer_detected || 'Bambu Studio / OrcaSlicer'}
      />
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
