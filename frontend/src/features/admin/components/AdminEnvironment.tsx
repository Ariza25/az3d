import React from 'react';
import { CheckCircle2, CircleAlert, RefreshCw, ServerCog } from 'lucide-react';
import { PlatformEnvironment } from '../../../types';
import { Button, Card, SectionHeader, StatCard } from '../../../components/ui';
import { MercadoPagoPlatformSettings } from './MercadoPagoPlatformSettings';

interface AdminEnvironmentProps {
  environment: PlatformEnvironment | null;
  onRefresh: () => void;
}

export const AdminEnvironment: React.FC<AdminEnvironmentProps> = ({ environment, onRefresh }) => {
  const missingRequired = environment?.variables.filter((variable) => variable.required && !variable.configured).length || 0;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Ambiente e variáveis"
        description="Visibilidade segura da configuração da plataforma. Valores sensíveis nunca são retornados pela API."
        action={<Button type="button" variant="secondary" icon={<RefreshCw className="h-4 w-4" />} onClick={onRefresh}>Verificar novamente</Button>}
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Ambiente" value={environment?.environment || '—'} />
        <StatCard label="Versão da API" value={environment?.version || '—'} />
        <StatCard label="Upload máximo" value={environment ? `${environment.max_upload_mb} MB` : '—'} />
        <StatCard label="Obrigatórias ausentes" value={missingRequired} tone={missingRequired > 0 ? 'danger' : 'success'} />
      </div>

      <Card>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-chumbo-700 bg-chumbo-900 text-laser-400">
            <ServerCog className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Checklist de configuração</h3>
            <p className="mt-1 text-xs text-slate-500">Somente presença e validade mínima; nenhum segredo é exibido.</p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {(environment?.variables || []).map((variable) => (
            <div key={variable.key} className="flex items-start justify-between gap-4 rounded-2xl border border-chumbo-800 bg-chumbo-950/60 p-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="font-mono text-xs text-white">{variable.key}</strong>
                  <span className="rounded bg-chumbo-800 px-1.5 py-0.5 text-[9px] uppercase text-slate-500">{variable.category}</span>
                  {variable.required && <span className="text-[9px] font-bold uppercase text-amber-300">obrigatória</span>}
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500">{variable.description}</p>
              </div>
              {variable.configured
                ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
                : <CircleAlert className={`h-5 w-5 shrink-0 ${variable.required ? 'text-rose-400' : 'text-amber-400'}`} />}
            </div>
          ))}
        </div>
      </Card>

      <MercadoPagoPlatformSettings />
    </div>
  );
};
