import React from 'react';
import { Activity, CheckCircle2, CircleAlert, Database, RefreshCw, Webhook } from 'lucide-react';
import { ObservabilityHealth } from '../../../types';
import { Button, Card, SectionHeader, StatCard } from '../../../components/ui';

interface AdminObservabilityProps {
  health: ObservabilityHealth | null;
  onRefresh: () => void;
}

export const AdminObservability: React.FC<AdminObservabilityProps> = ({ health, onRefresh }) => {
  const webhookFailures = (health?.failed_payment_webhooks_24h || 0) + (health?.failed_marketplace_webhooks_24h || 0);
  const integrationErrors = (health?.marketplace_errors || 0) + (health?.carrier_errors || 0);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Observabilidade"
        description="Saúde técnica da API, banco e integrações em todos os tenants."
        action={<Button type="button" variant="secondary" icon={<RefreshCw className="h-4 w-4" />} onClick={onRefresh}>Atualizar sinais</Button>}
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Plataforma" value={health?.status || '—'} tone={health?.status === 'ok' ? 'success' : 'warning'} />
        <StatCard label="Banco de dados" value={health?.database || '—'} tone={health?.database === 'online' ? 'success' : 'danger'} />
        <StatCard label="Webhooks falhos · 24h" value={webhookFailures} tone={webhookFailures > 0 ? 'danger' : 'success'} />
        <StatCard label="Erros de integração" value={integrationErrors} tone={integrationErrors > 0 ? 'warning' : 'success'} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-laser-400" />
            <h3 className="text-sm font-bold text-white">Sinais operacionais</h3>
          </div>
          <div className="mt-4 space-y-2.5">
            <SignalRow icon={Database} label="Conexão com o banco" value={health?.database || 'verificando'} ok={health?.database === 'online'} />
            <SignalRow icon={Webhook} label="Webhooks de pagamento com falha" value={health?.failed_payment_webhooks_24h ?? '—'} ok={(health?.failed_payment_webhooks_24h || 0) === 0} />
            <SignalRow icon={Webhook} label="Webhooks de marketplace com falha" value={health?.failed_marketplace_webhooks_24h ?? '—'} ok={(health?.failed_marketplace_webhooks_24h || 0) === 0} />
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-bold text-white">Dependências críticas</h3>
          <p className="mt-1 text-xs text-slate-500">Presença das configurações exigidas em runtime.</p>
          <div className="mt-4 space-y-2.5">
            <Dependency label="Mercado Pago · conta conectada" ok={health?.mercado_pago_configured} />
            <Dependency label="Mercado Pago · webhook secret" ok={health?.mercado_pago_webhook_secret} />
            <Dependency label="Correios · endpoint base" ok={health?.correios_base_configured} />
          </div>
        </Card>
      </div>

      {health?.checked_at && (
        <p className="text-right text-[10px] font-mono text-slate-600">Última verificação: {new Date(health.checked_at).toLocaleString('pt-BR')}</p>
      )}
    </div>
  );
};

const SignalRow = ({ icon: Icon, label, value, ok }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  ok: boolean;
}) => (
  <div className="flex items-center justify-between gap-4 rounded-xl border border-chumbo-800 bg-chumbo-950/60 p-3.5">
    <span className="flex items-center gap-2 text-xs text-slate-400"><Icon className="h-4 w-4 text-slate-500" />{label}</span>
    <strong className={ok ? 'text-emerald-300' : 'text-rose-300'}>{value}</strong>
  </div>
);

const Dependency = ({ label, ok }: { label: string; ok?: boolean }) => (
  <div className="flex items-center justify-between rounded-xl border border-chumbo-800 bg-chumbo-950/60 p-3.5">
    <span className="text-xs text-slate-400">{label}</span>
    <span className={`flex items-center gap-1.5 text-xs font-bold ${ok ? 'text-emerald-300' : 'text-amber-300'}`}>
      {ok ? <CheckCircle2 className="h-4 w-4" /> : <CircleAlert className="h-4 w-4" />}
      {ok ? 'configurado' : 'pendente'}
    </span>
  </div>
);
