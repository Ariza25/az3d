import React from 'react';
import { Boxes, Building2, CircleAlert, ShoppingBag } from 'lucide-react';
import { PlatformOverview } from '../../../types';
import { Card, SectionHeader, StatCard } from '../../../components/ui';

interface AdminMasterOverviewProps {
  platformOverview: PlatformOverview | null;
}

export const AdminMasterOverview: React.FC<AdminMasterOverviewProps> = ({ platformOverview }) => (
  <div className="space-y-6">
    <SectionHeader
      title="Visão da plataforma"
      description="Leitura operacional dos tenants. O controle master não altera catálogo, pedidos ou configurações das lojas."
    />

    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <StatCard label="Tenants ativos" value={platformOverview?.tenants_count ?? '—'} />
      <StatCard label="Produtos publicados" value={platformOverview?.products_count ?? '—'} />
      <StatCard label="Pedidos abertos" value={platformOverview?.open_orders_count ?? '—'} tone={(platformOverview?.open_orders_count || 0) > 0 ? 'warning' : 'default'} />
      <StatCard label="Alertas de estoque" value={platformOverview?.low_stock_count ?? '—'} tone={(platformOverview?.low_stock_count || 0) > 0 ? 'warning' : 'default'} />
    </div>

    <div className="grid gap-4 xl:grid-cols-[1.65fr_0.75fr]">
      <Card className="overflow-hidden">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-white">Saúde dos tenants</h3>
            <p className="mt-1 text-xs text-slate-500">Resumo somente leitura por operação.</p>
          </div>
          <span className="rounded-full border border-chumbo-700 bg-chumbo-900 px-2.5 py-1 text-[10px] font-mono uppercase text-slate-400">
            {platformOverview?.tenants.length || 0} tenants
          </span>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-xs">
            <thead className="border-b border-chumbo-800 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="pb-3 pr-4">Tenant</th>
                <th className="pb-3 pr-4">Catálogo</th>
                <th className="pb-3 pr-4">Pedidos</th>
                <th className="pb-3 pr-4">Marketplaces</th>
                <th className="pb-3 pr-4">Transportadoras</th>
                <th className="pb-3">Última venda</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-chumbo-800 text-slate-300">
              {(platformOverview?.tenants || []).map((tenant) => (
                <tr key={tenant.tenant_id} className="transition-colors hover:bg-chumbo-900/60">
                  <td className="py-3.5 pr-4">
                    <strong className="block text-white">{tenant.tenant_name}</strong>
                    <span className="font-mono text-[10px] text-slate-500">/{tenant.tenant_slug} · #{tenant.tenant_id}</span>
                  </td>
                  <td className="py-3.5 pr-4">
                    <strong className="text-white">{tenant.active_products_count}</strong>
                    <span className="text-slate-500"> / {tenant.products_count}</span>
                  </td>
                  <td className="py-3.5 pr-4">
                    <strong className={tenant.open_orders_count > 0 ? 'text-amber-300' : 'text-white'}>{tenant.open_orders_count}</strong>
                    <span className="text-slate-500"> / {tenant.orders_count}</span>
                  </td>
                  <td className="py-3.5 pr-4">
                    <span className={tenant.marketplace_errors_count > 0 ? 'text-rose-300' : 'text-slate-300'}>
                      {tenant.active_marketplace_count}/{tenant.marketplace_accounts}
                    </span>
                  </td>
                  <td className="py-3.5 pr-4">
                    <span className={tenant.carrier_errors_count > 0 ? 'text-rose-300' : 'text-slate-300'}>
                      {tenant.connected_carrier_count}/{tenant.carrier_accounts}
                    </span>
                  </td>
                  <td className="py-3.5 text-slate-500">
                    {tenant.last_order_at ? new Date(tenant.last_order_at).toLocaleDateString('pt-BR') : 'Sem vendas'}
                  </td>
                </tr>
              ))}
              {!platformOverview && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500">Carregando visão de plataforma...</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="space-y-4">
        <Card>
          <h3 className="text-sm font-bold text-white">Plano de controle</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">Ações disponíveis para o master ficam isoladas da operação comercial.</p>
          <div className="mt-4 space-y-2.5">
            <ControlRow icon={Building2} label="Tenants monitorados" value={platformOverview?.tenants_count ?? '—'} />
            <ControlRow icon={ShoppingBag} label="Pedidos totais" value={platformOverview?.orders_count ?? '—'} />
            <ControlRow icon={Boxes} label="Contas integradas" value={(platformOverview?.marketplace_accounts_count || 0) + (platformOverview?.carrier_accounts_count || 0)} />
            <ControlRow
              icon={CircleAlert}
              label="Integrações com erro"
              value={(platformOverview?.tenants || []).reduce((total, tenant) => total + tenant.marketplace_errors_count + tenant.carrier_errors_count, 0)}
              warning
            />
          </div>
        </Card>
      </div>
    </div>
  </div>
);

const ControlRow = ({
  icon: Icon,
  label,
  value,
  warning = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  warning?: boolean;
}) => (
  <div className="flex items-center justify-between rounded-xl border border-chumbo-800 bg-chumbo-950/60 p-3">
    <span className="flex items-center gap-2 text-xs text-slate-400">
      <Icon className="h-4 w-4 text-slate-500" />
      {label}
    </span>
    <strong className={warning && Number(value) > 0 ? 'text-amber-300' : 'text-white'}>{value}</strong>
  </div>
);
