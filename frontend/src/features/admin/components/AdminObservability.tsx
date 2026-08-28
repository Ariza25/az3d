import React from 'react';
import { RefreshCw } from 'lucide-react';
import { CarrierHealthItem, ObservabilityHealth, WebhookLogItem } from '../../../types';
import { Button, Card, SectionHeader, StatCard } from '../../../components/ui';

interface AdminObservabilityProps {
  health: ObservabilityHealth | null;
  webhookLogs: WebhookLogItem[];
  carrierHealth: CarrierHealthItem[];
  onRefresh: () => void;
}

export const AdminObservability: React.FC<AdminObservabilityProps> = ({ health, webhookLogs, carrierHealth, onRefresh }) => (
  <div className="space-y-5">
    <SectionHeader
      title="Observabilidade"
      description="Healthcheck administrativo, webhooks recebidos e erros de integracao."
      action={<Button type="button" variant="secondary" icon={<RefreshCw className="h-4 w-4" />} onClick={onRefresh}>Atualizar</Button>}
    />

    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <StatCard label="API" value={health?.status || '...'} tone={health?.status === 'ok' ? 'success' : 'warning'} />
      <StatCard label="Banco" value={health?.database || '...'} tone={health?.database === 'online' ? 'success' : 'danger'} />
      <StatCard label="Webhooks falhos 24h" value={(health?.failed_payment_webhooks_24h || 0) + (health?.failed_marketplace_webhooks_24h || 0)} />
      <StatCard label="Erros integracao" value={(health?.marketplace_errors || 0) + (health?.carrier_errors || 0)} />
    </div>

    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <Card>
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-sm font-bold text-white">Webhooks recentes</h4>
          <span className="text-[10px] font-mono text-slate-500">{webhookLogs.length} evento(s)</span>
        </div>
        <div className="mt-3 max-h-96 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[10px] uppercase text-slate-500">
              <tr>
                <th className="py-2 pr-3">Origem</th>
                <th className="py-2 pr-3">Evento</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Recebido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-chumbo-800 text-slate-300">
              {webhookLogs.map((event) => (
                <tr key={`${event.source}-${event.id}`}>
                  <td className="py-3 pr-3">
                    <strong className="block text-white">{event.provider}</strong>
                    <span className="font-mono text-slate-500">tenant #{event.tenant_id || '-'}</span>
                  </td>
                  <td className="py-3 pr-3">
                    <span className="block">{event.event_type || '-'}</span>
                    <span className="font-mono text-slate-500">{event.external_id || '-'}</span>
                    {event.error && <span className="mt-1 block text-rose-300">{event.error}</span>}
                  </td>
                  <td className="py-3 pr-3">
                    <span className={event.status === 'failed' ? 'text-rose-300' : event.status === 'processed' ? 'text-emerald-300' : 'text-amber-300'}>
                      {event.status}
                    </span>
                  </td>
                  <td className="py-3 pr-3 text-slate-500">{new Date(event.received_at).toLocaleString('pt-BR')}</td>
                </tr>
              ))}
              {webhookLogs.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-500">Nenhum webhook recebido ainda.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <h4 className="text-sm font-bold text-white">Configuracoes criticas</h4>
        <div className="mt-3 space-y-2 text-xs">
          {[
            ['Mercado Pago token', health?.mercado_pago_configured],
            ['Mercado Pago webhook secret', health?.mercado_pago_webhook_secret],
            ['Correios API base', health?.correios_base_configured],
          ].map(([label, ok]) => (
            <div key={String(label)} className="flex items-center justify-between rounded-xl border border-chumbo-800 bg-chumbo-900/60 p-3">
              <span>{label}</span>
              <span className={ok ? 'text-emerald-300' : 'text-amber-300'}>{ok ? 'ok' : 'pendente'}</span>
            </div>
          ))}
          {carrierHealth.filter((item) => item.last_error).map((item) => (
            <div key={item.provider} className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3">
              <strong className="text-rose-200">{item.account_name || item.provider}</strong>
              <p className="mt-1 text-slate-400">{item.last_error}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  </div>
);
