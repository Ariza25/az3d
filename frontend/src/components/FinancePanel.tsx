import React, { useEffect, useState } from 'react';
import { FinancialSummary, Product } from '../types';
import { api } from '../services/api';
import { currencyBRL } from '../utils/printingPricing';

interface FinancePanelProps {
  tenantId?: number;
  products: Product[];
}

export const FinancePanel: React.FC<FinancePanelProps> = ({ tenantId }) => {
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    if (!tenantId) return;
    setSummary(await api.getFinancialSummary(tenantId));
  };

  useEffect(() => {
    loadData().catch((err) => setError(err.message || 'Erro ao carregar financeiro'));
  }, [tenantId]);

  return (
    <div className="space-y-5">
      {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">{error}</div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Receita bruta" value={currencyBRL(summary?.gross_revenue || 0)} />
        <Metric label="Lucro estimado" value={currencyBRL(summary?.estimated_net_profit || 0)} accent />
        <Metric label="Custos fixos/mes" value={currencyBRL(summary?.fixed_costs_monthly || 0)} />
        <Metric label="Margem estimada" value={`${(summary?.estimated_margin_percent || 0).toFixed(1)}%`} />
        <Metric label="Taxas estimadas" value={currencyBRL(summary?.estimated_fees || 0)} />
        <Metric label="Custo operacional" value={currencyBRL(summary?.estimated_operational_cost || 0)} />
        <Metric label="Custo real lancado" value={currencyBRL(summary?.actual_costs || 0)} />
        <Metric label="Ticket medio" value={currencyBRL(summary?.average_ticket || 0)} />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-chumbo-800 dark:bg-chumbo-950/60">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Resultado por canal</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[10px] uppercase font-mono font-bold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-chumbo-800">
              <tr>
                <th className="py-2 pr-3">Canal</th>
                <th className="py-2 pr-3">Pedidos</th>
                <th className="py-2 pr-3">Unidades</th>
                <th className="py-2 pr-3">Bruto</th>
                <th className="py-2 pr-3">Taxas</th>
                <th className="py-2 pr-3">Liquido</th>
                <th className="py-2 pr-3">Margem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700 dark:divide-chumbo-800 dark:text-slate-300">
              {(summary?.channels || []).map((channel) => (
                <tr key={channel.provider} className="hover:bg-slate-50 dark:hover:bg-chumbo-850/50">
                  <td className="py-2 pr-3 font-semibold text-slate-900 dark:text-white">{channel.provider}</td>
                  <td className="py-2 pr-3">{channel.orders_count}</td>
                  <td className="py-2 pr-3">{channel.units_sold}</td>
                  <td className="py-2 pr-3 font-mono font-bold text-slate-900 dark:text-white">{currencyBRL(channel.gross_revenue)}</td>
                  <td className="py-2 pr-3 font-mono">{currencyBRL(channel.marketplace_fees)}</td>
                  <td className="py-2 pr-3 font-mono font-bold text-cyan-700 dark:text-laser-300">{currencyBRL(channel.net_revenue)}</td>
                  <td className="py-2 pr-3 font-mono">{channel.margin_percent.toFixed(1)}%</td>
                </tr>
              ))}
              {(summary?.channels || []).length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-500">
                    Nenhum pedido externo sincronizado ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-chumbo-800 dark:bg-chumbo-950/60">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Produtos mais rentaveis</h3>
          <ProductSummaryTable rows={summary?.top_products || []} />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-chumbo-800 dark:bg-chumbo-950/60">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Alertas de margem</h3>
          <ProductSummaryTable rows={summary?.low_margin_products || []} />
        </div>
      </div>

    </div>
  );
};

const Metric = ({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) => (
  <div className={`rounded-2xl border p-4 shadow-sm ${accent ? 'border-cyan-300 bg-cyan-50 dark:border-laser-500/30 dark:bg-laser-500/10' : 'border-slate-200 bg-white dark:border-chumbo-800 dark:bg-chumbo-950/70'}`}>
    <span className={`block text-[10px] font-mono uppercase font-bold ${accent ? 'text-cyan-800 dark:text-laser-300' : 'text-slate-500 dark:text-slate-400'}`}>{label}</span>
    <strong className={`mt-1 block text-lg font-extrabold ${accent ? 'text-cyan-950 dark:text-white' : 'text-slate-900 dark:text-white'}`}>{value}</strong>
  </div>
);

const ProductSummaryTable = ({ rows }: { rows: FinancialSummary['top_products'] }) => (
  <div className="mt-3 space-y-2">
    {rows.map((row) => (
      <div key={row.product_id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs dark:border-chumbo-800 dark:bg-chumbo-900/60">
        <div className="flex items-center justify-between gap-3">
          <strong className="truncate text-slate-900 dark:text-white">{row.product_title}</strong>
          <span className="font-bold text-cyan-700 dark:text-laser-300">{currencyBRL(row.estimated_profit)}</span>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-slate-500 dark:text-slate-400">
          <span>{row.units_sold} un.</span>
          <span>{currencyBRL(row.gross_revenue)}</span>
          <span>{row.estimated_margin_percent.toFixed(1)}%</span>
        </div>
      </div>
    ))}
    {rows.length === 0 && <p className="py-8 text-center text-xs text-slate-500">Sem dados suficientes.</p>}
  </div>
);
