import React, { useMemo, useState } from 'react';
import { CheckCircle2, CircleAlert, Inbox, RefreshCw } from 'lucide-react';
import { WebhookLogItem } from '../../../types';
import { Button, Card, SectionHeader, StatCard } from '../../../components/ui';

interface AdminOutboxProps {
  events: WebhookLogItem[];
  onRefresh: () => void;
}

export const AdminOutbox: React.FC<AdminOutboxProps> = ({ events, onRefresh }) => {
  const [status, setStatus] = useState<'all' | 'failed' | 'processed'>('all');
  const visibleEvents = useMemo(
    () => status === 'all' ? events : events.filter((event) => event.status === status),
    [events, status],
  );
  const failed = events.filter((event) => event.status === 'failed').length;
  const pending = events.filter((event) => event.status !== 'failed' && event.status !== 'processed').length;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Outbox de integrações"
        description="Eventos recebidos, processados e rejeitados pelos canais externos da plataforma."
        action={<Button type="button" variant="secondary" icon={<RefreshCw className="h-4 w-4" />} onClick={onRefresh}>Atualizar</Button>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Eventos recentes" value={events.length} />
        <StatCard label="Pendentes" value={pending} tone={pending > 0 ? 'warning' : 'default'} />
        <StatCard label="Falhos" value={failed} tone={failed > 0 ? 'danger' : 'success'} />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-chumbo-800 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Inbox className="h-4 w-4 text-laser-400" />
            <h3 className="text-sm font-bold text-white">Fluxo de eventos</h3>
          </div>
          <div className="flex rounded-xl border border-chumbo-800 bg-chumbo-950 p-1">
            {([
              ['all', 'Todos'],
              ['processed', 'Processados'],
              ['failed', 'Falhos'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatus(value)}
                className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition-colors ${status === value ? 'bg-chumbo-700 text-white' : 'text-slate-500 hover:text-slate-200'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3 pr-4">Origem</th>
                <th className="py-3 pr-4">Evento</th>
                <th className="py-3 pr-4">Tenant</th>
                <th className="py-3">Recebido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-chumbo-800 text-slate-300">
              {visibleEvents.map((event) => (
                <tr key={`${event.source}-${event.id}`} className="hover:bg-chumbo-900/60">
                  <td className="py-3.5 pr-4">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-bold uppercase ${event.status === 'failed' ? 'bg-rose-500/10 text-rose-300' : event.status === 'processed' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-300'}`}>
                      {event.status === 'failed' ? <CircleAlert className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                      {event.status}
                    </span>
                  </td>
                  <td className="py-3.5 pr-4">
                    <strong className="block text-white">{event.provider}</strong>
                    <span className="text-[10px] text-slate-500">{event.source}</span>
                  </td>
                  <td className="py-3.5 pr-4">
                    <span className="block">{event.event_type || 'Evento sem tipo'}</span>
                    <span className="font-mono text-[10px] text-slate-500">{event.external_id || '—'}</span>
                    {event.error && <span className="mt-1 block max-w-md text-rose-300">{event.error}</span>}
                  </td>
                  <td className="py-3.5 pr-4 font-mono text-slate-400">#{event.tenant_id || '—'}</td>
                  <td className="py-3.5 text-slate-500">{new Date(event.received_at).toLocaleString('pt-BR')}</td>
                </tr>
              ))}
              {visibleEvents.length === 0 && (
                <tr><td colSpan={5} className="py-12 text-center text-slate-500">Nenhum evento neste filtro.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
