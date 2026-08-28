import React from 'react';
import { PlatformOverview, Tenant } from '../../../types';
import { Card, SectionHeader, StatCard } from '../../../components/ui';

interface AdminMasterOverviewProps {
  activeTenant: Tenant | null;
  tenants: Tenant[];
  platformOverview: PlatformOverview | null;
  pendingOrders: number;
  lowStockCount: number;
  marketplaceAccountsCount: number;
  carrierAccountsCount: number;
  integrationProblems: number;
  onSelectTenant: (tenant: Tenant) => void;
}

export const AdminMasterOverview: React.FC<AdminMasterOverviewProps> = ({
  activeTenant,
  tenants,
  platformOverview,
  pendingOrders,
  lowStockCount,
  marketplaceAccountsCount,
  carrierAccountsCount,
  integrationProblems,
  onSelectTenant,
}) => (
  <div className="space-y-5">
    <SectionHeader
      title="Visao plataforma"
      description="Operacao multi-tenant, integracoes e pontos de atencao globais."
    />

    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <StatCard label="Tenants" value={platformOverview?.tenants_count ?? tenants.length} />
      <StatCard label="Pedidos abertos" value={platformOverview?.open_orders_count ?? pendingOrders} />
      <StatCard label="Baixo estoque" value={platformOverview?.low_stock_count ?? lowStockCount} tone={(platformOverview?.low_stock_count ?? lowStockCount) > 0 ? 'warning' : 'default'} />
      <StatCard
        label="Contas integradas"
        value={(platformOverview?.marketplace_accounts_count ?? marketplaceAccountsCount) + (platformOverview?.carrier_accounts_count ?? carrierAccountsCount)}
      />
    </div>

    <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-sm font-bold text-white">Tenants</h4>
          <span className="text-[10px] font-mono text-slate-500">produtos / pedidos / integracoes</span>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="text-[10px] uppercase text-slate-500">
              <tr>
                <th className="py-2 pr-3">Loja</th>
                <th className="py-2 pr-3">Produtos</th>
                <th className="py-2 pr-3">Pedidos</th>
                <th className="py-2 pr-3">Estoque</th>
                <th className="py-2 pr-3">Marketplace</th>
                <th className="py-2 pr-3">Correios</th>
                <th className="py-2 pr-3">Ultima venda</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-chumbo-800 text-slate-300">
              {(platformOverview?.tenants || []).map((tenant) => {
                const tenantRef = tenants.find((item) => item.id === tenant.tenant_id);
                return (
                  <tr key={tenant.tenant_id} className={activeTenant?.id === tenant.tenant_id ? 'bg-laser-500/5' : ''}>
                    <td className="py-3 pr-3">
                      <button onClick={() => tenantRef && onSelectTenant(tenantRef)} className="text-left">
                        <strong className="block text-white">{tenant.tenant_name}</strong>
                        <span className="font-mono text-slate-500">/{tenant.tenant_slug} - #{tenant.tenant_id}</span>
                      </button>
                    </td>
                    <td className="py-3 pr-3 font-mono">{tenant.active_products_count}/{tenant.products_count}</td>
                    <td className="py-3 pr-3 font-mono">{tenant.open_orders_count}/{tenant.orders_count}</td>
                    <td className="py-3 pr-3">
                      <span className={tenant.low_stock_count > 0 ? 'text-amber-300 font-bold' : 'text-emerald-300'}>{tenant.low_stock_count} alerta(s)</span>
                    </td>
                    <td className="py-3 pr-3">
                      <span className={tenant.marketplace_errors_count > 0 ? 'text-rose-300' : 'text-slate-300'}>
                        {tenant.active_marketplace_count}/{tenant.marketplace_accounts}
                      </span>
                    </td>
                    <td className="py-3 pr-3">
                      <span className={tenant.carrier_errors_count > 0 ? 'text-rose-300' : 'text-slate-300'}>
                        {tenant.connected_carrier_count}/{tenant.carrier_accounts}
                      </span>
                    </td>
                    <td className="py-3 pr-3 text-slate-500">
                      {tenant.last_order_at ? new Date(tenant.last_order_at).toLocaleDateString('pt-BR') : '-'}
                    </td>
                  </tr>
                );
              })}
              {!platformOverview && (
                <tr>
                  <td className="py-6 text-center text-slate-500" colSpan={7}>Carregando visao de plataforma...</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <h4 className="text-sm font-bold text-white">Status global</h4>
        <div className="mt-3 space-y-2 text-xs">
          <StatusRow label="Mercado Pago" ok={platformOverview?.payment_gateway_configured} okText="configurado" fallbackText="pendente" />
          <StatusRow label="Webhook secreto" ok={platformOverview?.webhook_secret_configured} okText="ativo" fallbackText="recomendado" />
          <div className="flex items-center justify-between rounded-xl border border-chumbo-800 bg-chumbo-900/60 p-3">
            <span>Erros de integracao</span>
            <span className={integrationProblems > 0 ? 'text-rose-300 font-bold' : 'text-emerald-300'}>{integrationProblems}</span>
          </div>
          <div className="rounded-xl border border-chumbo-800 bg-chumbo-900/60 p-3">
            <strong className="block text-white">Permissoes por tenant</strong>
            <span className="text-slate-500">Estrutura preparada para evoluir usuarios e perfis por loja.</span>
          </div>
        </div>
      </Card>
    </div>
  </div>
);

const StatusRow: React.FC<{ label: string; ok?: boolean; okText: string; fallbackText: string }> = ({ label, ok, okText, fallbackText }) => (
  <div className="flex items-center justify-between rounded-xl border border-chumbo-800 bg-chumbo-900/60 p-3">
    <span>{label}</span>
    <span className={ok ? 'text-emerald-300' : 'text-amber-300'}>{ok ? okText : fallbackText}</span>
  </div>
);
