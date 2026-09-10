import React, { useEffect, useState } from 'react';
import { Activity, MapPin, Save, ToggleLeft, ToggleRight, Truck } from 'lucide-react';
import { TenantCarrierAccount } from '../types';
import { api } from '../services/api';

const initialForm = {
  provider: 'superfrete',
  account_name: 'SuperFrete (Correios)',
  origin_cep: '',
  auth_type: 'bearer_token',
  is_active: true,
  sync_tracking: true,
  access_token: '',
  api_base_url: '',
  token_base_url: '',
  token_username: '',
  token_password: '',
  contract_number: '',
  contract_dr: '',
  posting_card_number: '',
};

interface Props {
  tenantId?: number;
  accounts: TenantCarrierAccount[];
  onAccountsChanged: (items: TenantCarrierAccount[]) => void;
  onMessage: (message: { type: 'success' | 'error'; text: string }) => void;
}

export const CarrierSettingsPanel: React.FC<Props> = ({
  tenantId,
  accounts,
  onAccountsChanged,
  onMessage,
}) => {
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const existing = accounts.find((a) => a.origin_cep && a.origin_cep.trim() !== '');
    if (existing && existing.origin_cep) {
      setForm((prev) => ({
        ...prev,
        origin_cep: prev.origin_cep || existing.origin_cep || '',
      }));
    }
  }, [accounts]);

  const update = (field: keyof typeof initialForm, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!tenantId) return;
    setSaving(true);

    const credentials = Object.fromEntries(
      Object.entries({
        origin_cep: form.origin_cep,
        access_token: form.access_token,
        api_base_url: form.api_base_url,
        token_base_url: form.token_base_url,
        token_username: form.token_username,
        token_password: form.token_password,
        contract_number: form.contract_number,
        contract_dr: form.contract_dr,
        posting_card_number: form.posting_card_number,
      }).filter(([, value]) => String(value).trim())
    );

    try {
      const saved = await api.saveCarrierAccount(
        {
          provider: form.provider,
          account_name: form.account_name,
          auth_type: form.auth_type,
          origin_cep: form.origin_cep,
          is_active: form.is_active,
          sync_tracking: form.sync_tracking,
          credentials,
        },
        tenantId
      );

      onAccountsChanged([saved, ...accounts.filter((item) => item.id !== saved.id)]);
      setForm((prev) => ({ ...prev, access_token: '', token_password: '' }));
      onMessage({
        type: 'success',
        text: 'Configurações de frete e transportadora salvas com sucesso!',
      });
    } catch (error: any) {
      onMessage({
        type: 'error',
        text: error.message || 'Erro ao salvar configurações de frete',
      });
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (id: number) => {
    if (!tenantId) return;
    try {
      const saved = await api.toggleCarrierAccount(id, tenantId);
      onAccountsChanged(accounts.map((item) => (item.id === id ? saved : item)));
    } catch (error: any) {
      onMessage({
        type: 'error',
        text: error.message || 'Erro ao alterar status da transportadora',
      });
    }
  };

  const fields: Array<[keyof typeof initialForm, string, string]> = [
    ['account_name', 'Nome da conta', 'SuperFrete'],
    ['access_token', 'Token de API próprio (Opcional)', 'Usa o token global do sistema se vazio'],
    ['token_username', 'Usuário / Identificador (Opcional)', ''],
    ['token_password', 'Senha / Segredo API (Opcional)', ''],
    ['contract_number', 'Contrato (Opcional)', ''],
    ['contract_dr', 'DR (Opcional)', ''],
    ['posting_card_number', 'Cartão postagem (Opcional)', ''],
    ['api_base_url', 'API base URL (Opcional)', 'https://api.superfrete.com/api/v0'],
    ['token_base_url', 'Token base URL (Opcional)', ''],
  ];

  return (
    <section className="space-y-4 rounded-2xl border border-chumbo-800 bg-chumbo-950/40 p-5">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-bold text-white">
          <Truck className="h-4 w-4 text-laser-400" /> Transportadoras & Expedição (SuperFrete)
        </h3>
        <p className="text-xs text-slate-400">
          Configure aqui o CEP de origem da sua loja e credenciais de frete. Cada loja calcula o frete a partir do seu próprio endereço de expedição.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <form onSubmit={save} className="grid gap-3 rounded-2xl border border-chumbo-800 bg-chumbo-950/60 p-4 md:grid-cols-2">
          {/* Campo de CEP de Origem em Destaque */}
          <div className="md:col-span-2 rounded-xl border border-laser-500/40 bg-laser-950/20 p-3">
            <label className="flex items-center gap-1.5 text-xs font-bold text-laser-400">
              <MapPin className="h-3.5 w-3.5" /> CEP de Origem da Sua Loja (Remetente)
            </label>
            <p className="mt-0.5 text-[11px] text-slate-400">
              De onde seus pacotes serão postados e enviados para o cliente.
            </p>
            <input
              type="text"
              maxLength={9}
              value={form.origin_cep}
              onChange={(e) => update('origin_cep', e.target.value)}
              placeholder="Ex: 86303-096"
              className="mt-2 block w-full rounded-xl border border-chumbo-700 bg-chumbo-950 px-3 py-2 font-mono text-sm text-white placeholder-slate-500 focus:border-laser-400 focus:outline-none"
            />
          </div>

          <label className="space-y-1 text-xs text-slate-400">
            Provedor
            <select
              value={form.provider}
              onChange={(e) => update('provider', e.target.value)}
              className="block w-full rounded-xl border border-chumbo-800 bg-chumbo-950 px-3 py-2 text-white"
            >
              <option value="superfrete">SuperFrete (Correios)</option>
              <option value="correios">Correios (Legado)</option>
            </select>
          </label>

          <label className="space-y-1 text-xs text-slate-400">
            Tipo de autenticação
            <select
              value={form.auth_type}
              onChange={(e) => update('auth_type', e.target.value)}
              className="block w-full rounded-xl border border-chumbo-800 bg-chumbo-950 px-3 py-2 text-white"
            >
              <option value="bearer_token">Bearer token</option>
              <option value="user">Usuário</option>
              <option value="contract_credentials">Contrato</option>
              <option value="posting_card">Cartão de postagem</option>
            </select>
          </label>

          {fields.map(([field, label, placeholder]) => (
            <label key={field} className="space-y-1 text-xs text-slate-400">
              {label}
              <input
                type={field === 'access_token' || field === 'token_password' ? 'password' : 'text'}
                value={String(form[field])}
                onChange={(e) => update(field, e.target.value)}
                placeholder={placeholder}
                className="block w-full rounded-xl border border-chumbo-800 bg-chumbo-950 px-3 py-2 text-white"
              />
            </label>
          ))}

          <div className="flex flex-wrap items-center gap-3 md:col-span-2">
            <label className="flex gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => update('is_active', e.target.checked)}
              />
              Ativa
            </label>
            <label className="flex gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={form.sync_tracking}
                onChange={(e) => update('sync_tracking', e.target.checked)}
              />
              Sincronizar tracking
            </label>
            <button
              disabled={saving}
              type="submit"
              className="ml-auto flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-bold text-chumbo-950 hover:bg-slate-200 disabled:opacity-50"
            >
              <Save className="h-4 w-4" /> Salvar Configurações
            </button>
          </div>
        </form>

        <div className="rounded-2xl border border-chumbo-800 bg-chumbo-950/60 p-4">
          <h4 className="flex items-center gap-2 text-sm font-bold text-white">
            <Activity className="h-4 w-4 text-laser-400" /> Contas & Origens Salvas
          </h4>
          <div className="mt-3 space-y-3">
            {accounts.map((account) => (
              <div key={account.id} className="rounded-xl border border-chumbo-800 bg-chumbo-900/60 p-3 text-xs">
                <div className="flex justify-between gap-3">
                  <div>
                    <strong className="block text-white">{account.account_name || account.provider}</strong>
                    <span className="text-slate-500">
                      {account.auth_type} · {account.is_connected ? 'conectada' : 'ativa'}
                    </span>
                    {account.origin_cep && (
                      <p className="mt-1 flex items-center gap-1 font-mono text-laser-400">
                        <MapPin className="h-3 w-3" /> Origem: {account.origin_cep}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => toggle(account.id)}
                    title={account.is_active ? 'Desativar' : 'Ativar'}
                  >
                    {account.is_active ? (
                      <ToggleRight className="h-7 w-7 text-emerald-400" />
                    ) : (
                      <ToggleLeft className="h-7 w-7 text-slate-500" />
                    )}
                  </button>
                </div>
                {account.last_error && <p className="mt-2 text-rose-300">{account.last_error}</p>}
              </div>
            ))}
            {!accounts.length && (
              <p className="py-8 text-center text-xs text-slate-500">
                Nenhuma transportadora configurada nesta loja ainda. Preencha o CEP de origem ao lado e clique em salvar.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
