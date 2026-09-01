import React, { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Product, ProductActualCost, ProductActualCostInput, TenantFixedCost } from '../types';
import { api } from '../services/api';
import { currencyBRL } from '../utils/printingPricing';

interface ProductionCostsPanelProps {
  tenantId?: number;
  products: Product[];
}

const emptyActualCost: ProductActualCostInput = {
  product_id: 0,
  actual_print_minutes: 0,
  actual_material_grams: 0,
  failed_material_grams: 0,
  material_cost: 0,
  energy_cost: 0,
  packaging_cost: 0,
  labor_cost: 0,
  extra_cost: 0,
  shipping_cost: 0,
  marketplace_fee_amount: 0,
  discount_amount: 0,
  notes: '',
};

export const ProductionCostsPanel: React.FC<ProductionCostsPanelProps> = ({ tenantId, products }) => {
  const [fixedCosts, setFixedCosts] = useState<TenantFixedCost[]>([]);
  const [actualCosts, setActualCosts] = useState<ProductActualCost[]>([]);
  const [fixedForm, setFixedForm] = useState({ name: 'Novo custo fixo', monthly_amount: 0, allocation_basis: 'print_hours', is_active: true });
  const [actualForm, setActualForm] = useState<ProductActualCostInput>({ ...emptyActualCost, product_id: products[0]?.id || 0 });
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    if (!tenantId) return;
    const [fixedData, actualData] = await Promise.all([
      api.getFixedCosts(tenantId),
      api.getActualCosts(tenantId),
    ]);
    setFixedCosts(fixedData);
    setActualCosts(actualData);
  };

  useEffect(() => {
    setActualForm((prev) => ({ ...prev, product_id: prev.product_id || products[0]?.id || 0 }));
  }, [products]);

  useEffect(() => {
    loadData().catch((err) => setError(err.message || 'Erro ao carregar custos de producao'));
  }, [tenantId]);

  const saveFixedCost = async () => {
    if (!tenantId) return;
    try {
      await api.saveFixedCost(fixedForm, tenantId);
      setFixedForm({ name: 'Novo custo fixo', monthly_amount: 0, allocation_basis: 'print_hours', is_active: true });
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar custo fixo');
    }
  };

  const deleteFixedCost = async (id: number) => {
    if (!tenantId) return;
    try {
      await api.deleteFixedCost(id, tenantId);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Erro ao remover custo fixo');
    }
  };

  const saveActualCost = async () => {
    if (!tenantId || !actualForm.product_id) return;
    try {
      await api.saveActualCost(actualForm, tenantId);
      setActualForm({ ...emptyActualCost, product_id: actualForm.product_id });
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar custo real');
    }
  };

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-sm font-bold text-white">Custos de producao</h3>
        <p className="mt-1 text-xs text-slate-400">Central de custos fixos, consumo real de filamento, tempo e demais insumos.</p>
      </div>
      {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">{error}</div>}

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-2xl border border-chumbo-800 bg-chumbo-950/60 p-4">
          <h4 className="text-sm font-bold text-white">Custos fixos do tenant</h4>
          <div className="mt-3 space-y-2">
            {fixedCosts.map((cost) => (
              <div key={cost.id} className="flex items-center justify-between rounded-xl border border-chumbo-800 bg-chumbo-900/60 p-3 text-xs">
                <div>
                  <strong className="block text-white">{cost.name}</strong>
                  <span className="text-slate-500">{cost.allocation_basis} | {cost.is_active ? 'ativo' : 'inativo'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <strong className="text-laser-300">{currencyBRL(cost.monthly_amount)}</strong>
                  <button onClick={() => deleteFixedCost(cost.id)} className="rounded-lg border border-chumbo-700 p-2 text-slate-400 hover:text-rose-300">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-2 border-t border-chumbo-800 pt-4">
            <input value={fixedForm.name} onChange={(e) => setFixedForm((prev) => ({ ...prev, name: e.target.value }))} className="rounded-xl border border-chumbo-800 bg-chumbo-950 px-3 py-2 text-xs text-white" />
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <NumberField value={fixedForm.monthly_amount} onChange={(value) => setFixedForm((prev) => ({ ...prev, monthly_amount: value }))} />
              <select value={fixedForm.allocation_basis} onChange={(e) => setFixedForm((prev) => ({ ...prev, allocation_basis: e.target.value }))} className="rounded-xl border border-chumbo-800 bg-chumbo-950 px-3 py-2 text-xs text-white">
                <option value="print_hours">Horas de impressao</option>
                <option value="orders">Pedidos</option>
                <option value="monthly">Mensal</option>
              </select>
              <button onClick={saveFixedCost} className="rounded-xl bg-white px-3 text-chumbo-950"><Plus className="h-4 w-4" /></button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-chumbo-800 bg-chumbo-950/60 p-4">
          <h4 className="text-sm font-bold text-white">Lancamento de custo real</h4>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            <select value={actualForm.product_id} onChange={(e) => setActualForm((prev) => ({ ...prev, product_id: Number(e.target.value) }))} className="md:col-span-3 rounded-xl border border-chumbo-800 bg-chumbo-950 px-3 py-2 text-xs text-white">
              <option value={0}>Produto...</option>
              {products.map((product) => <option key={product.id} value={product.id}>{product.title}</option>)}
            </select>
            <LabeledNumber label="Min reais" value={actualForm.actual_print_minutes} onChange={(value) => setActualForm((prev) => ({ ...prev, actual_print_minutes: value }))} />
            <LabeledNumber label="Filamento real (g)" value={actualForm.actual_material_grams} onChange={(value) => setActualForm((prev) => ({ ...prev, actual_material_grams: value }))} />
            <LabeledNumber label="Refugo (g)" value={actualForm.failed_material_grams} onChange={(value) => setActualForm((prev) => ({ ...prev, failed_material_grams: value }))} />
            <LabeledNumber label="Custo material" value={actualForm.material_cost} onChange={(value) => setActualForm((prev) => ({ ...prev, material_cost: value }))} />
            <LabeledNumber label="Energia" value={actualForm.energy_cost} onChange={(value) => setActualForm((prev) => ({ ...prev, energy_cost: value }))} />
            <LabeledNumber label="Embalagem" value={actualForm.packaging_cost} onChange={(value) => setActualForm((prev) => ({ ...prev, packaging_cost: value }))} />
            <LabeledNumber label="Mao de obra" value={actualForm.labor_cost} onChange={(value) => setActualForm((prev) => ({ ...prev, labor_cost: value }))} />
            <LabeledNumber label="Extras" value={actualForm.extra_cost} onChange={(value) => setActualForm((prev) => ({ ...prev, extra_cost: value }))} />
            <LabeledNumber label="Frete" value={actualForm.shipping_cost} onChange={(value) => setActualForm((prev) => ({ ...prev, shipping_cost: value }))} />
            <LabeledNumber label="Taxa canal" value={actualForm.marketplace_fee_amount} onChange={(value) => setActualForm((prev) => ({ ...prev, marketplace_fee_amount: value }))} />
            <LabeledNumber label="Desconto" value={actualForm.discount_amount} onChange={(value) => setActualForm((prev) => ({ ...prev, discount_amount: value }))} />
            <textarea value={actualForm.notes} onChange={(e) => setActualForm((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Observacoes" className="md:col-span-3 rounded-xl border border-chumbo-800 bg-chumbo-950 px-3 py-2 text-xs text-white" />
          </div>
          <button onClick={saveActualCost} className="mt-3 rounded-xl bg-white px-4 py-2 text-xs font-bold text-chumbo-950">Salvar custo real</button>
          <div className="mt-4 space-y-2">
            {actualCosts.slice(0, 6).map((cost) => (
              <div key={cost.id} className="flex items-center justify-between rounded-xl border border-chumbo-800 bg-chumbo-900/60 p-3 text-xs">
                <span className="truncate text-slate-300">{cost.product?.title || `Produto #${cost.product_id}`}</span>
                <strong className="text-white">{currencyBRL(cost.total_cost)}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const NumberField = ({ value, onChange }: { value: number; onChange: (value: number) => void }) => (
  <input type="number" step="0.01" value={value} onChange={(e) => onChange(Number(e.target.value) || 0)} className="min-w-0 rounded-xl border border-chumbo-800 bg-chumbo-950 px-3 py-2 text-xs text-white" />
);

const LabeledNumber = ({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) => (
  <label className="space-y-1">
    <span className="block text-[10px] font-mono uppercase text-slate-500">{label}</span>
    <NumberField value={value} onChange={onChange} />
  </label>
);
