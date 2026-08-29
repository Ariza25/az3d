import React, { useState } from 'react';
import { Boxes, Building2, CircleAlert, CreditCard, ShoppingBag, Store } from 'lucide-react';
import { PlatformOverview } from '../../../types';
import { Card, SectionHeader, StatCard } from '../../../components/ui';
import { api } from '../../../services/api';

interface AdminMasterOverviewProps {
  platformOverview: PlatformOverview | null;
}

export const AdminMasterOverview: React.FC<AdminMasterOverviewProps> = ({ platformOverview }) => {
  const [busyKey, setBusyKey] = useState('');
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const authorize = async (tenantId: number, provider: 'mercadolivre' | 'mercadopago') => {
    const popup = window.open('', '_blank');
    const key = `${tenantId}:${provider}`;
    setBusyKey(key);
    setFeedback(null);
    try {
      const response = provider === 'mercadolivre'
        ? await api.startMasterMercadoLivreOAuth(tenantId)
        : await api.startMasterMercadoPagoOAuth(tenantId);
      const authorizationUrl = response.authorization_url || response.auth_url;
      if (!authorizationUrl) throw new Error('A API não retornou a URL de autorização');
      if (popup) {
        popup.opener = null;
        popup.location.href = authorizationUrl;
      } else {
        window.location.assign(authorizationUrl);
      }
      setFeedback({ tone: 'success', text: 'Autorização aberta. O titular deve entrar na conta e conceder o acesso.' });
    } catch (error) {
      popup?.close();
      setFeedback({ tone: 'error', text: error instanceof Error ? error.message : 'Erro ao iniciar autorização' });
    } finally {
      setBusyKey('');
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader title="Visão da plataforma" description="Monitore os tenants e inicie a autorização das contas externas sem cadastrar tokens manualmente." />

      {feedback && (
        <div className={`rounded-xl border p-3 text-xs ${feedback.tone === 'success' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-rose-500/30 bg-rose-500/10 text-rose-200'}`}>{feedback.text}</div>
      )}

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
              <p className="mt-1 text-xs text-slate-500">A autorização sempre é concluída pelo titular da conta externa.</p>
            </div>
            <span className="rounded-full border border-chumbo-700 bg-chumbo-900 px-2.5 py-1 text-[10px] font-mono uppercase text-slate-400">{platformOverview?.tenants.length || 0} tenants</span>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-xs">
              <thead className="border-b border-chumbo-800 text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="pb-3 pr-4">Tenant</th><th className="pb-3 pr-4">Catálogo</th><th className="pb-3 pr-4">Pedidos</th>
                  <th className="pb-3 pr-4">Marketplaces</th><th className="pb-3 pr-4">Transportadoras</th><th className="pb-3 pr-4">Autorizar contas</th><th className="pb-3">Última venda</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-chumbo-800 text-slate-300">
                {(platformOverview?.tenants || []).map((tenant) => (
                  <tr key={tenant.tenant_id} className="transition-colors hover:bg-chumbo-900/60">
                    <td className="py-3.5 pr-4"><strong className="block text-white">{tenant.tenant_name}</strong><span className="font-mono text-[10px] text-slate-500">/{tenant.tenant_slug} · #{tenant.tenant_id}</span></td>
                    <td className="py-3.5 pr-4"><strong className="text-white">{tenant.active_products_count}</strong><span className="text-slate-500"> / {tenant.products_count}</span></td>
                    <td className="py-3.5 pr-4"><strong className={tenant.open_orders_count > 0 ? 'text-amber-300' : 'text-white'}>{tenant.open_orders_count}</strong><span className="text-slate-500"> / {tenant.orders_count}</span></td>
                    <td className="py-3.5 pr-4"><span className={tenant.marketplace_errors_count > 0 ? 'text-rose-300' : 'text-slate-300'}>{tenant.active_marketplace_count}/{tenant.marketplace_accounts}</span></td>
                    <td className="py-3.5 pr-4"><span className={tenant.carrier_errors_count > 0 ? 'text-rose-300' : 'text-slate-300'}>{tenant.connected_carrier_count}/{tenant.carrier_accounts}</span></td>
                    <td className="py-3.5 pr-4"><div className="flex min-w-[210px] flex-wrap gap-2">
                      <OAuthButton label="Mercado Livre" connected={tenant.mercadolivre_connected} busy={busyKey === `${tenant.tenant_id}:mercadolivre`} icon={Store} onClick={() => void authorize(tenant.tenant_id, 'mercadolivre')} />
                      <OAuthButton label="Mercado Pago" connected={tenant.mercadopago_connected} busy={busyKey === `${tenant.tenant_id}:mercadopago`} icon={CreditCard} onClick={() => void authorize(tenant.tenant_id, 'mercadopago')} />
                    </div></td>
                    <td className="py-3.5 text-slate-500">{tenant.last_order_at ? new Date(tenant.last_order_at).toLocaleDateString('pt-BR') : 'Sem vendas'}</td>
                  </tr>
                ))}
                {!platformOverview && <tr><td colSpan={7} className="py-10 text-center text-slate-500">Carregando visão de plataforma...</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-bold text-white">Plano de controle</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">As credenciais do aplicativo são globais; consentimentos e tokens pertencem a cada tenant.</p>
          <div className="mt-4 space-y-2.5">
            <ControlRow icon={Building2} label="Tenants monitorados" value={platformOverview?.tenants_count ?? '—'} />
            <ControlRow icon={ShoppingBag} label="Pedidos totais" value={platformOverview?.orders_count ?? '—'} />
            <ControlRow icon={Boxes} label="Contas integradas" value={(platformOverview?.marketplace_accounts_count || 0) + (platformOverview?.carrier_accounts_count || 0)} />
            <ControlRow icon={CircleAlert} label="Integrações com erro" value={(platformOverview?.tenants || []).reduce((total, tenant) => total + tenant.marketplace_errors_count + tenant.carrier_errors_count, 0)} warning />
          </div>
        </Card>
      </div>
    </div>
  );
};

const OAuthButton = ({ label, connected, busy, icon: Icon, onClick }: { label: string; connected: boolean; busy: boolean; icon: React.ComponentType<{ className?: string }>; onClick: () => void }) => (
  <button type="button" onClick={onClick} disabled={busy} className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold transition-colors disabled:opacity-60 ${connected ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-chumbo-700 bg-chumbo-950 text-slate-200 hover:bg-chumbo-800'}`} title={connected ? `${label} conectado; clique para reautorizar` : `Autorizar ${label}`}>
    <Icon className="h-3.5 w-3.5" />{busy ? 'Abrindo...' : connected ? `${label} conectado` : label}
  </button>
);

const ControlRow = ({ icon: Icon, label, value, warning = false }: { icon: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode; warning?: boolean }) => (
  <div className="flex items-center justify-between rounded-xl border border-chumbo-800 bg-chumbo-950/60 p-3">
    <span className="flex items-center gap-2 text-xs text-slate-400"><Icon className="h-4 w-4 text-slate-500" />{label}</span>
    <strong className={warning && Number(value) > 0 ? 'text-amber-300' : 'text-white'}>{value}</strong>
  </div>
);
