import React from 'react';
import { Layers, SlidersHorizontal } from 'lucide-react';
import { FilamentSpool, Product } from '../../../../../types';
import { PrintingPricingInput, currencyBRL } from '../../../../../utils/printingPricing';

interface PricingInputsGridProps {
  products: Product[];
  selectedProductId: string;
  onSelectProduct: (productId: string) => void;
  onOpenProductDetails: () => void;
  input: PrintingPricingInput;
  onChangeField: (field: keyof PrintingPricingInput, value: string) => void;
  registeredSpools: FilamentSpool[];
  selectedSpoolId: number | '';
  onSelectSpool: (spoolId: number | '') => void;
}

export const PricingInputsGrid: React.FC<PricingInputsGridProps> = ({
  products,
  selectedProductId,
  onSelectProduct,
  onOpenProductDetails,
  input,
  onChangeField,
  registeredSpools,
  selectedSpoolId,
  onSelectSpool,
}) => {
  const selectedProduct = products.find((item) => String(item.id) === selectedProductId);

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
          onChange={(event) => onChangeField(field, event.target.value)}
          className="w-full bg-transparent px-3 py-2 text-sm text-slate-900 focus:outline-none dark:text-white"
        />
        {suffix && <span className="pr-3 text-[10px] font-mono text-slate-500">{suffix}</span>}
      </div>
    </label>
  );

  return (
    <div className="space-y-4">
      {/* 1. Selecionar Produto Cadastrado */}
      <label className="block space-y-1.5">
        <span className="text-[10px] font-mono font-bold uppercase text-slate-600 dark:text-slate-400">
          1. Carregar produto cadastrado
        </span>
        <select
          value={selectedProductId}
          onChange={(e) => onSelectProduct(e.target.value)}
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
                  onClick={onOpenProductDetails}
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

      {/* Dimensões do Modelo */}
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
              onChange={(e) => onSelectSpool(e.target.value ? Number(e.target.value) : '')}
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

      {/* Custos e Taxas */}
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
  );
};
