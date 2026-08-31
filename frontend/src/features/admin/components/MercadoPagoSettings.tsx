import React, { useEffect, useState } from 'react';
import { CreditCard, Link2, RefreshCw, Unplug } from 'lucide-react';
import { api } from '../../../services/api';
import type { TenantPaymentAccountStatus } from '../../../types';
import { Button, Card } from '../../../components/ui';

interface MercadoPagoSettingsProps {
  tenantId: number;
}

export const MercadoPagoSettings: React.FC<MercadoPagoSettingsProps> = ({ tenantId }) => {
  const [status, setStatus] = useState<TenantPaymentAccountStatus | null>(null);
  const [busy, setBusy] = useState('');
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    void load();
  }, [tenantId]);

  async function load() {
    setFeedback(null);
    try {
      setStatus(await api.getTenantMercadoPagoStatus(tenantId));
    } catch (error) {
      setFeedback({ tone: 'error', text: error instanceof Error ? error.message : 'Erro ao carregar Mercado Pago' });
    }
  }

  async function connect() {
    setBusy('connect');
    setFeedback(null);
    try {
      const authorization = await api.startTenantMercadoPagoOAuth(tenantId);
      window.location.assign(authorization.authorization_url);
    } catch (error) {
      setBusy('');
      setFeedback({ tone: 'error', text: error instanceof Error ? error.message : 'Erro ao conectar Mercado Pago' });
    }
  }

  async function refresh() {
    setBusy('refresh');
    try {
      setStatus(await api.refreshTenantMercadoPagoOAuth(tenantId));
      setFeedback({ tone: 'success', text: 'Credenciais do tenant renovadas.' });
    } catch (error) {
      setFeedback({ tone: 'error', text: error instanceof Error ? error.message : 'Erro ao renovar Mercado Pago' });
    } finally {
      setBusy('');
    }
  }

  async function disconnect() {
    if (!window.confirm('Desconectar a conta Mercado Pago desta loja? Novos checkouts ficarao indisponiveis.')) return;
    setBusy('disconnect');
    try {
      setStatus(await api.disconnectTenantMercadoPagoOAuth(tenantId));
      setFeedback({ tone: 'success', text: 'Conta Mercado Pago desconectada.' });
    } catch (error) {
      setFeedback({ tone: 'error', text: error instanceof Error ? error.message : 'Erro ao desconectar Mercado Pago' });
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-bold text-white"><CreditCard className="h-4 w-4 text-laser-400" /> Pagamentos Mercado Pago</h3>
        <p className="mt-1 text-xs text-slate-400">O tenant autoriza a propria conta. Pix e cartao do Checkout Pro sao cobrados diretamente nessa conta.</p>
      </div>

      {feedback && (
        <div className={`rounded-xl border p-3 text-xs ${feedback.tone === 'success' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-rose-500/30 bg-rose-500/10 text-rose-200'}`}>
          {feedback.text}
        </div>
      )}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-bold text-white">Conta recebedora deste tenant</h4>
            <p className="mt-1 text-xs text-slate-400">
              {status?.connected
                ? `Conectada ao vendedor ${status.seller_id || 'Mercado Pago'} (${status.live_mode ? 'producao' : 'teste'}).`
                : status?.oauth_available
                  ? 'Pronta para o titular da loja autorizar no Mercado Pago.'
                  : 'A aplicação OAuth precisa ser configurada no ambiente da plataforma.'}
            </p>
            {status?.token_expires_at && <p className="mt-1 text-[10px] font-mono text-slate-500">Token valido ate {new Date(status.token_expires_at).toLocaleString('pt-BR')}</p>}
            {status?.last_error && <p className="mt-2 text-xs text-rose-300">{status.last_error}</p>}
          </div>
          <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase ${status?.connected ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}>
            {status?.connected ? 'conectado' : status?.status || 'desconectado'}
          </span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button disabled={!status?.oauth_available} icon={<Link2 className="h-4 w-4" />} loading={busy === 'connect'} onClick={() => void connect()} variant="accent">
            {status?.connected ? 'Reconectar conta' : 'Conectar Mercado Pago'}
          </Button>
          {status?.connected && (
            <>
              <Button icon={<RefreshCw className="h-4 w-4" />} loading={busy === 'refresh'} onClick={() => void refresh()}>Renovar agora</Button>
              <Button icon={<Unplug className="h-4 w-4" />} loading={busy === 'disconnect'} onClick={() => void disconnect()} variant="danger">Desconectar</Button>
            </>
          )}
        </div>
      </Card>
    </div>
  );
};
