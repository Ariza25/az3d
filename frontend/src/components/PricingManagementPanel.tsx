import React, { useEffect, useState } from 'react';
import { History, Plus, Trash2 } from 'lucide-react';
import {
  PlatformFeePreset,
  PresetInput,
  Product,
  ProductPricingSnapshot,
  PricingScenarioResponse,
  TenantPricingBundle,
} from '../types';
import { api } from '../services/api';
import {
  DEFAULT_PRINTING_PRICING,
  currencyBRL,
  formatPrintDuration,
  parsePrintMinutes,
  parseWeightGrams,
} from '../utils/printingPricing';

interface PricingManagementPanelProps {
  tenantId?: number;
  products: Product[];
}

const blankPreset: PresetInput = {
  name: '',
  spool_price: 120,
  spool_weight_grams: 1000,
  power_kw: 0.07,
  platform_fee_percent: 12,
  payment_fee_percent: 4.99,
  fixed_fee: 0,
  is_default: false,
  is_active: true,
};

export const PricingManagementPanel: React.FC<PricingManagementPanelProps> = ({ tenantId, products }) => {
  const [bundle, setBundle] = useState<TenantPricingBundle | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<number | ''>(products[0]?.id || '');
  const [snapshots, setSnapshots] = useState<ProductPricingSnapshot[]>([]);
  const [materialForm, setMaterialForm] = useState<PresetInput>({ ...blankPreset, name: 'Novo material' });
  const [printerForm, setPrinterForm] = useState<PresetInput>({ ...blankPreset, name: 'Nova impressora' });
  const [platformForm, setPlatformForm] = useState<PresetInput>({ ...blankPreset, name: 'Novo canal' });
  const [scenario, setScenario] = useState<PricingScenarioResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadBundle = async () => {
    if (!tenantId) return;
    const data = await api.getAdminPricingSettings(tenantId);
    setBundle(data);
  };

  const loadSnapshots = async (productId: number | '') => {
    if (!tenantId || !productId) {
      setSnapshots([]);
      return;
    }
    setSnapshots(await api.getProductPricingSnapshots(productId, tenantId));
  };

  useEffect(() => {
    loadBundle().catch((err) => setError(err.message));
  }, [tenantId]);

  useEffect(() => {
    if (!selectedProductId && products[0]) {
      setSelectedProductId(products[0].id);
      return;
    }
    loadSnapshots(selectedProductId).catch((err) => setError(err.message));
  }, [selectedProductId, tenantId, products]);

  const savePreset = async (kind: 'material' | 'printer' | 'platform') => {
    if (!tenantId) return;
    setError(null);
    try {
      if (kind === 'material') {
        await api.saveMaterialPreset(materialForm, tenantId);
        setMaterialForm({ ...blankPreset, name: 'Novo material' });
      }
      if (kind === 'printer') {
        await api.savePrinterPreset(printerForm, tenantId);
        setPrinterForm({ ...blankPreset, name: 'Nova impressora' });
      }
      if (kind === 'platform') {
        await api.savePlatformPreset(platformForm, tenantId);
        setPlatformForm({ ...blankPreset, name: 'Novo canal' });
      }
      await loadBundle();
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar preset');
    }
  };

  const removePreset = async (kind: 'material' | 'printer' | 'platform', id: number) => {
    if (!tenantId) return;
    try {
      if (kind === 'material') await api.deleteMaterialPreset(id, tenantId);
      if (kind === 'printer') await api.deletePrinterPreset(id, tenantId);
      if (kind === 'platform') await api.deletePlatformPreset(id, tenantId);
      await loadBundle();
    } catch (err: any) {
      setError(err.message || 'Erro ao remover preset');
    }
  };

  const calculateScenarios = async () => {
    if (!tenantId || !selectedProductId || !bundle) return;
    const product = products.find((item) => item.id === selectedProductId);
    if (!product) return;
    const response = await api.calculatePricingScenario(
      {
        product_id: product.id,
        quantity: 1,
        base: {
          ...DEFAULT_PRINTING_PRICING,
          productWeightGrams: parseWeightGrams(product.weight),
          printMinutes: parsePrintMinutes(product.print_time),
          spoolPrice: bundle.pricing.default_spool_price,
          spoolWeightGrams: bundle.pricing.default_spool_weight,
          printerPowerKw: bundle.pricing.default_printer_power_kw,
          energyTariffPerKwh: bundle.pricing.default_energy_tariff,
          packagingCost: bundle.pricing.default_packaging_cost,
          laborCost: bundle.pricing.default_labor_cost,
          extraCost: bundle.pricing.default_extra_cost,
          failureRatePercent: bundle.pricing.default_failure_rate_percent,
          marginPercent: bundle.pricing.default_margin_percent,
          platformFeePercent: bundle.pricing.default_platform_fee_percent,
          paymentFeePercent: bundle.pricing.default_payment_fee_percent,
          fixedFee: bundle.pricing.default_fixed_fee,
        },
        platform_fee_scenarios: bundle.platform_fee_presets as PlatformFeePreset[],
      },
      tenantId
    );
    setScenario(response);
  };

  return (
    <div className="space-y-5">
      {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">{error}</div>}

      <div className="grid gap-4 lg:grid-cols-3">
        <PresetCard title="Materiais" items={bundle?.material_presets || []} kind="material" onRemove={removePreset}>
          <PresetInputFields form={materialForm} setForm={setMaterialForm} mode="material" />
          <SaveButton onClick={() => savePreset('material')} />
        </PresetCard>
        <PresetCard title="Impressoras" items={bundle?.printer_presets || []} kind="printer" onRemove={removePreset}>
          <PresetInputFields form={printerForm} setForm={setPrinterForm} mode="printer" />
          <SaveButton onClick={() => savePreset('printer')} />
        </PresetCard>
        <PresetCard title="Canais e taxas" items={bundle?.platform_fee_presets || []} kind="platform" onRemove={removePreset}>
          <PresetInputFields form={platformForm} setForm={setPlatformForm} mode="platform" />
          <SaveButton onClick={() => savePreset('platform')} />
        </PresetCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-2xl border border-chumbo-800 bg-chumbo-950/60 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-bold text-white">
              <History className="h-4 w-4 text-laser-300" />
              Historico de precificacao
            </h3>
            <select
              value={selectedProductId}
              onChange={(event) => setSelectedProductId(Number(event.target.value) || '')}
              className="rounded-xl border border-chumbo-800 bg-chumbo-950 px-3 py-2 text-xs text-white"
            >
              <option value="">Produto...</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.title}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            {snapshots.map((snapshot) => (
              <div key={snapshot.id} className="rounded-xl border border-chumbo-800 bg-chumbo-900/60 p-3 text-xs">
                <div className="flex items-center justify-between">
                  <strong className="text-white">{currencyBRL(snapshot.suggested_price)}</strong>
                  <span className="font-mono text-slate-500">{new Date(snapshot.created_at).toLocaleString('pt-BR')}</span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-slate-400">
                  <span>Custo {currencyBRL(snapshot.operational_cost)}</span>
                  <span>Taxas {currencyBRL(snapshot.total_fees)}</span>
                  <span>Margem {snapshot.profit_margin_percent.toFixed(1)}%</span>
                </div>
              </div>
            ))}
            {snapshots.length === 0 && <p className="py-6 text-center text-xs text-slate-500">Nenhum snapshot salvo para este produto.</p>}
          </div>
        </div>

        <div className="rounded-2xl border border-chumbo-800 bg-chumbo-950/60 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Cenarios por canal</h3>
            <button onClick={calculateScenarios} className="rounded-xl bg-white px-4 py-2 text-xs font-bold text-chumbo-950">
              Simular canais
            </button>
          </div>
          <div className="space-y-2">
            {scenario?.scenarios.map((item) => (
              <div key={item.name} className="rounded-xl border border-chumbo-800 bg-chumbo-900/60 p-3 text-xs">
                <div className="flex items-center justify-between">
                  <strong className="text-white">{item.name}</strong>
                  <span className="font-bold text-laser-300">{currencyBRL(item.result.suggestedPrice)}</span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-slate-400">
                  <span>Lucro {currencyBRL(item.result.profit)}</span>
                  <span>Taxas {currencyBRL(item.result.totalFees)}</span>
                  <span>{formatPrintDuration(item.input.printMinutes)}</span>
                </div>
              </div>
            ))}
            {!scenario && <p className="py-6 text-center text-xs text-slate-500">Selecione um produto e simule para comparar loja propria e marketplaces.</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

const SaveButton = ({ onClick }: { onClick: () => void }) => (
  <button onClick={onClick} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-bold text-chumbo-950">
    <Plus className="h-4 w-4" />
    Salvar preset
  </button>
);

const PresetCard = ({
  title,
  items,
  kind,
  onRemove,
  children,
}: {
  title: string;
  items: any[];
  kind: 'material' | 'printer' | 'platform';
  onRemove: (kind: 'material' | 'printer' | 'platform', id: number) => void;
  children: React.ReactNode;
}) => (
  <div className="rounded-2xl border border-chumbo-800 bg-chumbo-950/60 p-4">
    <h3 className="text-sm font-bold text-white">{title}</h3>
    <div className="mt-3 space-y-2">
      {items.map((item) => (
        <div key={item.id} className="flex items-center justify-between gap-2 rounded-xl border border-chumbo-800 bg-chumbo-900/60 p-3 text-xs">
          <div className="min-w-0">
            <strong className="block truncate text-white">{item.name}</strong>
            <span className="text-slate-500">{item.is_default ? 'Padrao' : 'Opcional'} | {item.is_active ? 'Ativo' : 'Inativo'}</span>
          </div>
          <button onClick={() => onRemove(kind, item.id)} className="rounded-lg border border-chumbo-700 p-2 text-slate-400 hover:text-rose-300">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
    <div className="mt-4 border-t border-chumbo-800 pt-4">{children}</div>
  </div>
);

const PresetInputFields = ({
  form,
  setForm,
  mode,
}: {
  form: PresetInput;
  setForm: React.Dispatch<React.SetStateAction<PresetInput>>;
  mode: 'material' | 'printer' | 'platform';
}) => (
  <div className="space-y-2">
    <input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} className="w-full rounded-xl border border-chumbo-800 bg-chumbo-950 px-3 py-2 text-xs text-white" />
    {mode === 'material' && (
      <div className="grid grid-cols-2 gap-2">
        <input placeholder="Material" value={form.material_type || ''} onChange={(e) => setForm((prev) => ({ ...prev, material_type: e.target.value }))} className="rounded-xl border border-chumbo-800 bg-chumbo-950 px-3 py-2 text-xs text-white" />
        <input placeholder="Cor" value={form.color_name || ''} onChange={(e) => setForm((prev) => ({ ...prev, color_name: e.target.value }))} className="rounded-xl border border-chumbo-800 bg-chumbo-950 px-3 py-2 text-xs text-white" />
        <NumberInput value={form.spool_price || 0} onChange={(value) => setForm((prev) => ({ ...prev, spool_price: value }))} />
        <NumberInput value={form.spool_weight_grams || 0} onChange={(value) => setForm((prev) => ({ ...prev, spool_weight_grams: value }))} />
      </div>
    )}
    {mode === 'printer' && <NumberInput value={form.power_kw || 0} onChange={(value) => setForm((prev) => ({ ...prev, power_kw: value }))} />}
    {mode === 'platform' && (
      <div className="grid grid-cols-3 gap-2">
        <NumberInput value={form.platform_fee_percent || 0} onChange={(value) => setForm((prev) => ({ ...prev, platform_fee_percent: value }))} />
        <NumberInput value={form.payment_fee_percent || 0} onChange={(value) => setForm((prev) => ({ ...prev, payment_fee_percent: value }))} />
        <NumberInput value={form.fixed_fee || 0} onChange={(value) => setForm((prev) => ({ ...prev, fixed_fee: value }))} />
      </div>
    )}
    <div className="flex gap-3 text-xs text-slate-300">
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={form.is_default} onChange={(e) => setForm((prev) => ({ ...prev, is_default: e.target.checked }))} />
        Padrao
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))} />
        Ativo
      </label>
    </div>
  </div>
);

const NumberInput = ({ value, onChange }: { value: number; onChange: (value: number) => void }) => (
  <input type="number" step="0.01" value={value} onChange={(e) => onChange(Number(e.target.value) || 0)} className="min-w-0 rounded-xl border border-chumbo-800 bg-chumbo-950 px-3 py-2 text-xs text-white" />
);
