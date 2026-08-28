import React, { useEffect, useState } from 'react';
import { CreditCard, Link2, RefreshCw, ShieldCheck, Unplug } from 'lucide-react';
import { api } from '../../../services/api';
import type { MercadoPagoPlatformConfigInput, TenantPaymentAccountStatus } from '../../../types';
import { Button, Card } from '../../../components/ui';

interface MercadoPagoSettingsProps {
  tenantId: number;
  isMasterAdmin: boolean;
}

const emptyPlatformConfig: MercadoPagoPlatformConfigInput = {
  client_id: '',
  client_secret: '',
  redirect_uri: '',
  webhook_secret: '',
};

export const MercadoPagoSettings: React.FC<MercadoPagoSettingsProps> = ({ tenantId, isMasterAdmin }) => {
  const [status, setStatus] = useState<TenantPaymentAccountStatus | null>(null);
  const [platform, setPlatform] = useState(emptyPlatformConfig);
  const [savedSecrets, setSavedSecrets] = useState({ client: false, webhook: false });
  const [busy, setBusy] = useState('');
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    void load();
  }, [tenantId, isMasterAdmin]);

  async function load() {
    setFeedback(null);
    try {
      const [tenantStatus, platformConfig] = await Promise.all([
        api.getTenantMercadoPagoStatus(tenantId),
        isMasterAdmin ? api.getMercadoPagoPlatformConfig().catch(() => null) : Promise.resolve(null),
      ]);
      setStatus(tenantStatus);
      if (platformConfig) {
        setPlatform((current) => ({
          ...current,
          client_id: platformConfig.client_id || '',
          redirect_uri: platformConfig.redirect_uri || '',
          client_secret: '',
          webhook_secret: '',
        }));
        setSavedSecrets({
          client: platformConfig.client_secret_configured,
          webhook: platformConfig.webhook_secret_configured,
        });
      }
    } catch (error) {
      setFeedback({ tone: 'error', text: error instanceof Error ? error.message : 'Erro ao carregar Mercado Pago' });
    }
  }

  async function savePlatform(event: React.FormEvent) {
    event.preventDefault();
    setBusy('platform');
    setFeedback(null);
    try {
      const saved = await api.saveMercadoPagoPlatformConfig(platform);
      setSavedSecrets({ client: saved.client_secret_configured, webhook: saved.webhook_secret_configured });
      setPlatform((current) => ({ ...current, client_secret: '', webhook_secret: '' }));
      setFeedback({ tone: 'success', text: 'Aplicacao OAuth do Mercado Pago salva com seguranca.' });
      await load();
    } catch (error) {
      setFeedback({ tone: 'error', text: error instanceof Error ? error.message : 'Erro ao salvar Mercado Pago' });
    } finally {
      setBusy('');
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

      {isMasterAdmin && (
        <Card asForm onSubmit={savePlatform}>
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 text-laser-400" />
            <div>
              <h4 className="text-sm font-bold text-white">Aplicacao OAuth da plataforma</h4>
              <p className="mt-1 text-xs text-slate-400">Configuracao global visivel apenas ao master_admin. Os segredos sao criptografados no banco.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Field label="Client ID" value={platform.client_id} onChange={(value) => setPlatform((current) => ({ ...current, client_id: value }))} />
            <Field label="Redirect URI" value={platform.redirect_uri} placeholder="https://api.seudominio.com/api/payments/mercadopago/oauth/callback" onChange={(value) => setPlatform((current) => ({ ...current, redirect_uri: value }))} />
            <Field label="Client Secret" password value={platform.client_secret} placeholder={savedSecrets.client ? 'Segredo salvo; preencha apenas para trocar' : 'Client Secret da aplicacao'} onChange={(value) => setPlatform((current) => ({ ...current, client_secret: value }))} />
            <Field label="Segredo do webhook" password value={platform.webhook_secret} placeholder={savedSecrets.webhook ? 'Segredo salvo; preencha apenas para trocar' : 'Secret das notificacoes Mercado Pago'} onChange={(value) => setPlatform((current) => ({ ...current, webhook_secret: value }))} />
          </div>
          <Button className="mt-4" loading={busy === 'platform'} type="submit" variant="primary">Salvar aplicacao OAuth</Button>
        </Card>
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
                  : 'A aplicacao OAuth precisa ser configurada pelo master_admin.'}
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

const Field: React.FC<{ label: string; value: string; onChange: (value: string) => void; placeholder?: string; password?: boolean }> = ({ label, value, onChange, placeholder, password }) => (
  <label className="space-y-1.5">
    <span className="text-xs font-mono uppercase text-slate-400">{label}</span>
    <input
      className="w-full rounded-xl border border-chumbo-800 bg-chumbo-950 px-4 py-2.5 text-sm text-white focus:border-laser-400 focus:outline-none"
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      type={password ? 'password' : 'text'}
      value={value}
    />
  </label>
);
