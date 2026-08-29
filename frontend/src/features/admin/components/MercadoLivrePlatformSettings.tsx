import React, { useEffect, useState } from 'react';
import { Store } from 'lucide-react';
import { api } from '../../../services/api';
import { MercadoLivrePlatformConfigInput } from '../../../types';
import { Button, Card } from '../../../components/ui';

const emptyConfig: MercadoLivrePlatformConfigInput = {
  client_id: '',
  client_secret: '',
  redirect_uri: '',
};

export const MercadoLivrePlatformSettings: React.FC = () => {
  const [config, setConfig] = useState(emptyConfig);
  const [secretSaved, setSecretSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    void api.getMercadoLivrePlatformConfig()
      .then((current) => {
        setConfig((value) => ({ ...value, client_id: current.client_id || '', redirect_uri: current.redirect_uri || '' }));
        setSecretSaved(current.client_secret_configured);
      })
      .catch((error) => setFeedback({ tone: 'error', text: error instanceof Error ? error.message : 'Erro ao carregar OAuth global' }));
  }, []);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setFeedback(null);
    try {
      const saved = await api.saveMercadoLivrePlatformConfig(config);
      setSecretSaved(saved.client_secret_configured);
      setConfig((value) => ({ ...value, client_secret: '' }));
      setFeedback({ tone: 'success', text: 'Aplicacao OAuth global do Mercado Livre atualizada.' });
    } catch (error) {
      setFeedback({ tone: 'error', text: error instanceof Error ? error.message : 'Erro ao salvar OAuth global' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card asForm onSubmit={save}>
      <div className="flex items-start gap-3">
        <Store className="mt-0.5 h-5 w-5 text-yellow-300" />
        <div>
          <h3 className="text-sm font-bold text-white">OAuth global do Mercado Livre</h3>
          <p className="mt-1 text-xs text-slate-500">Cadastre uma vez a aplicacao da plataforma. Cada tenant autoriza somente a propria conta.</p>
        </div>
      </div>

      {feedback && <div className={`mt-4 rounded-xl border p-3 text-xs ${feedback.tone === 'success' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-rose-500/30 bg-rose-500/10 text-rose-200'}`}>{feedback.text}</div>}

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <Field label="Client ID" value={config.client_id} onChange={(value) => setConfig((current) => ({ ...current, client_id: value }))} />
        <Field label="Redirect URI" value={config.redirect_uri} onChange={(value) => setConfig((current) => ({ ...current, redirect_uri: value }))} />
        <Field
          label="Client Secret"
          password
          value={config.client_secret}
          placeholder={secretSaved ? 'Segredo salvo; preencha para trocar' : 'Client Secret'}
          onChange={(value) => setConfig((current) => ({ ...current, client_secret: value }))}
        />
      </div>
      <Button className="mt-4" loading={isSaving} type="submit" variant="primary">Salvar configuracao global</Button>
    </Card>
  );
};

const Field = ({ label, value, onChange, placeholder, password = false }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  password?: boolean;
}) => (
  <label className="space-y-1.5">
    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">{label}</span>
    <input
      type={password ? 'password' : 'text'}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="w-full rounded-xl border border-chumbo-800 bg-chumbo-950 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-laser-400"
    />
  </label>
);
