import React, { useEffect, useState } from 'react';
import { CheckCircle2, CircleAlert, ShieldCheck } from 'lucide-react';
import { api } from '../../../services/api';
import { MercadoPagoPlatformConfig } from '../../../types';
import { Card } from '../../../components/ui';

export const MercadoPagoPlatformSettings: React.FC = () => {
  const [config, setConfig] = useState<MercadoPagoPlatformConfig | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    void api.getMercadoPagoPlatformConfig()
      .then(setConfig)
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Erro ao carregar OAuth global'));
  }, []);

  return (
    <Card>
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 text-laser-400" />
        <div>
          <h3 className="text-sm font-bold text-white">OAuth global do Mercado Pago</h3>
          <p className="mt-1 text-xs text-slate-500">Credenciais globais lidas das variáveis do Cloud Run. Cada tenant autoriza e mantém somente a própria conta recebedora.</p>
        </div>
      </div>

      {error && <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">{error}</div>}
      {config && (
        <div className="mt-5 space-y-3">
          <Status configured={config.configured} label={config.configured ? 'Aplicação pronta para OAuth' : 'Configuração incompleta no Cloud Run'} />
          <div className="grid gap-2 text-xs md:grid-cols-2">
            <Status configured={config.client_id_configured} label="MERCADO_PAGO_CLIENT_ID" />
            <Status configured={config.client_secret_configured} label="MERCADO_PAGO_CLIENT_SECRET" />
            <Status configured={config.redirect_uri_configured} label="MERCADO_PAGO_REDIRECT_URI" />
            <Status configured={config.webhook_secret_configured} label="MERCADO_PAGO_WEBHOOK_SECRET" />
          </div>
          <p className="text-[11px] text-slate-600">Os valores não são exibidos nem editados por este console.</p>
        </div>
      )}
    </Card>
  );
};

const Status = ({ configured, label }: { configured: boolean; label: string }) => (
  <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${configured ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-300' : 'border-amber-500/20 bg-amber-500/5 text-amber-300'}`}>
    {configured ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <CircleAlert className="h-4 w-4 shrink-0" />}
    <span className="font-mono">{label}</span>
  </div>
);
