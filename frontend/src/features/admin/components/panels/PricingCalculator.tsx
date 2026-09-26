import React, { useEffect, useState } from 'react';
import {
  Calculator,
  CheckCircle2,
  DollarSign,
  Loader2,
  Save,
} from 'lucide-react';
import { Parsed3MFResult, Product, TenantSettings, FilamentSpool } from '../../../../types';
import { SlicerSettingsModal } from '../SlicerSettingsModal';
import {
  DEFAULT_PRINTING_PRICING,
  EXCEL_BASE_PRODUCTS,
  PrintingPricingInput,
  PrintingPricingResult,
  parsePrintMinutes,
  parseWeightGrams,
} from '../../../../utils/printingPricing';
import { api } from '../../../../services/api';
import {
  ExcelCalculatedRow,
  Pricing3MFUploader,
  PricingExcelTable,
  PricingInputsGrid,
  PricingResultsCard,
} from './pricing-calculator';

interface PricingCalculatorProps {
  products?: Product[];
  tenantId?: number;
  tenantSettings?: TenantSettings | null;
  onSettingsSaved?: (settings: TenantSettings) => void;
  onProductPricingApplied?: (product: Product) => void;
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
  const [parsed3MFInfo, setParsed3MFInfo] = useState<Parsed3MFResult | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [registeredSpools, setRegisteredSpools] = useState<FilamentSpool[]>([]);
  const [selectedSpoolId, setSelectedSpoolId] = useState<number | ''>('');

  useEffect(() => {
    api.getFilamentSpools(tenantId)
      .then((data: FilamentSpool[]) => setRegisteredSpools(data || []))
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

  const handleSelectSpool = (id: number | '') => {
    setSelectedSpoolId(id);
    if (id) {
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
    }
  };

  const selectedProduct = products.find((item) => String(item.id) === selectedProductId);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
            <Calculator className="h-4 w-4 text-cyan-700 dark:text-laser-400" />
            <span>Calculadora de precificação 3D</span>
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            O backend calcula custos, margem e taxas da loja. O painel apenas envia os dados de peso e tempo.
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
            <span>{saved ? 'Parâmetros salvos' : 'Salvar na loja'}</span>
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
          {/* Seção 3MF e Inputs */}
          <Pricing3MFUploader
            isParsing3MF={isParsing3MF}
            parsed3MFInfo={parsed3MFInfo}
            onUploadFile={handle3MFUpload}
            onClearParsedInfo={() => setParsed3MFInfo(null)}
            onOpenDetails={() => setIsDetailsModalOpen(true)}
          />

          <PricingInputsGrid
            products={products}
            selectedProductId={selectedProductId}
            onSelectProduct={loadProduct}
            onOpenProductDetails={() => setIsDetailsModalOpen(true)}
            input={input}
            onChangeField={updateNumber}
            registeredSpools={registeredSpools}
            selectedSpoolId={selectedSpoolId}
            onSelectSpool={handleSelectSpool}
          />
        </div>

        {/* Card Lateral de Resultados */}
        <PricingResultsCard
          result={result}
          printMinutes={input.printMinutes}
        />
      </div>

      {/* Tabela de Referência Excel */}
      <PricingExcelTable
        excelRows={excelRows}
        onApplyBaseProduct={applyBaseProduct}
      />

      {/* Modal Ficha Técnica / Fatiamento */}
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
