import React, { useEffect, useState } from 'react';
import { Activity, Box, CheckCircle2, ChevronDown, ChevronUp, Clock, Info, MapPin, Save, Shield, ToggleLeft, ToggleRight, Truck } from 'lucide-react';
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
  // Parâmetros de pacote e cálculo do SuperFrete
  package_format: 'box', // 'box', 'roll', 'envelope'
  package_height: 20,
  package_width: 20,
  package_length: 20,
  package_weight_grams: 300,
  own_hand: false,
  receipt: false,
  use_insurance_value: false,
  insurance_value: 0,
  additional_days: 0,
  services: '1,2,17', // 1: PAC, 2: SEDEX, 17: Mini Envios
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
  const [showAdvancedAuth, setShowAdvancedAuth] = useState(false);

  useEffect(() => {
    const existing = accounts.find((a) => a.provider === 'superfrete') || accounts[0];
    if (existing) {
      const s = existing.settings || {};
      setForm((prev) => ({
        ...prev,
        origin_cep: existing.origin_cep || (s.origin_cep as string) || prev.origin_cep || '',
        account_name: existing.account_name || prev.account_name,
        is_active: existing.is_active ?? prev.is_active,
        sync_tracking: existing.sync_tracking ?? prev.sync_tracking,
        package_format: (s.package_format as string) || prev.package_format,
        package_height: Number(s.package_height || s.height || prev.package_height),
        package_width: Number(s.package_width || s.width || prev.package_width),
        package_length: Number(s.package_length || s.length || prev.package_length),
        package_weight_grams: Number(
          s.package_weight_grams ||
          (s.package_weight ? Number(s.package_weight) * 1000 : null) ||
          prev.package_weight_grams
        ),
        own_hand: Boolean(s.own_hand ?? prev.own_hand),
        receipt: Boolean(s.receipt ?? prev.receipt),
        use_insurance_value: Boolean(s.use_insurance_value ?? prev.use_insurance_value),
        insurance_value: Number(s.insurance_value || prev.insurance_value),
        additional_days: Number(s.additional_days || prev.additional_days),
        services: (s.services as string) || prev.services,
        api_base_url: (s.api_base_url as string) || prev.api_base_url,
      }));
    }
  }, [accounts]);

  const update = (field: keyof typeof initialForm, value: any) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!tenantId) return;
    setSaving(true);

    const weightKg = Number(form.package_weight_grams || 300) / 1000.0;

    const credentials: Record<string, any> = {
      origin_cep: form.origin_cep.replace(/\D/g, ''),
      package_format: form.package_format,
      package_height: Number(form.package_height || 20),
      package_width: Number(form.package_width || 20),
      package_length: Number(form.package_length || 20),
      package_weight: weightKg,
      package_weight_grams: Number(form.package_weight_grams || 300),
      own_hand: form.own_hand,
      receipt: form.receipt,
      use_insurance_value: form.use_insurance_value,
      insurance_value: Number(form.insurance_value || 0),
      additional_days: Number(form.additional_days || 0),
      services: form.services || '1,2,17',
    };

    if (form.access_token.trim() && !form.access_token.includes('••')) {
      credentials.access_token = form.access_token.trim();
    }
    if (form.api_base_url.trim()) {
      credentials.api_base_url = form.api_base_url.trim();
    }

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
      setForm((prev) => ({ ...prev, access_token: '' }));
      onMessage({
        type: 'success',
        text: 'Configurações de frete e dimensões do SuperFrete salvas com sucesso!',
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

  return (
    <section className="space-y-4 rounded-2xl border border-chumbo-800 bg-chumbo-950/40 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-chumbo-800/80 pb-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold text-white">
            <Truck className="h-4 w-4 text-emerald-400" /> Parâmetros de Frete SuperFrete (Correios)
          </h3>
          <p className="text-xs text-slate-400">
            Ajuste o CEP de origem, formato, dimensões e opções do pacote para garantir que a cotação na sua loja reflita exatamente a calculadora do SuperFrete.
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-3 py-1 text-[11px] font-medium text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5" /> API Oficial SuperFrete Ativa
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
        <form onSubmit={save} className="space-y-4">
          {/* Card 1: Origem do Envio */}
          <div className="rounded-xl border border-laser-500/30 bg-laser-950/20 p-4">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-laser-400" />
              <h4 className="text-xs font-bold text-laser-400 uppercase tracking-wider">
                1. Local de Origem da Expedição
              </h4>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              Informe o CEP de onde saem seus pedidos 3D (seu ateliê/fábrica).
            </p>
            <div className="mt-3">
              <input
                type="text"
                maxLength={9}
                value={form.origin_cep}
                onChange={(e) => update('origin_cep', e.target.value)}
                placeholder="Ex: 86303-096"
                className="block w-full max-w-sm rounded-xl border border-chumbo-700 bg-chumbo-950 px-3.5 py-2.5 font-mono text-sm font-bold text-white placeholder-slate-500 focus:border-laser-400 focus:outline-none focus:ring-1 focus:ring-laser-400"
              />
            </div>
          </div>

          {/* Card 2: Formato, Dimensões e Peso do Pacote */}
          <div className="rounded-xl border border-chumbo-800 bg-chumbo-900/40 p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Box className="h-4 w-4 text-amber-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                2. Formato, Dimensões e Peso Padrão da Caixa
              </h4>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {/* Formato */}
              <label className="space-y-1.5 text-xs text-slate-300">
                <span className="font-semibold text-white">Formato do Pacote</span>
                <select
                  value={form.package_format}
                  onChange={(e) => update('package_format', e.target.value)}
                  className="block w-full rounded-xl border border-chumbo-700 bg-chumbo-950 px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                >
                  <option value="box">Caixa / Pacote (Padrão)</option>
                  <option value="roll">Rolo / Cilindro / Prisma</option>
                  <option value="envelope">Envelope</option>
                </select>
              </label>

              {/* Peso Padrão */}
              <label className="space-y-1.5 text-xs text-slate-300">
                <span className="font-semibold text-white">Peso Estimado (em gramas)</span>
                <div className="relative">
                  <input
                    type="number"
                    min={50}
                    max={30000}
                    step={10}
                    value={form.package_weight_grams}
                    onChange={(e) => update('package_weight_grams', Number(e.target.value))}
                    className="block w-full rounded-xl border border-chumbo-700 bg-chumbo-950 px-3 py-2 pr-10 text-xs font-mono text-white focus:border-amber-400 focus:outline-none"
                  />
                  <span className="absolute right-3 top-2 text-xs font-bold text-slate-500">g</span>
                </div>
              </label>
            </div>

            {/* Dimensões em 3 colunas */}
            <div className="grid grid-cols-3 gap-2.5">
              <label className="space-y-1 text-xs text-slate-300">
                <span className="text-[11px] text-slate-400">Altura (cm)</span>
                <input
                  type="number"
                  min={2}
                  max={105}
                  value={form.package_height}
                  onChange={(e) => update('package_height', Number(e.target.value))}
                  className="block w-full rounded-xl border border-chumbo-700 bg-chumbo-950 px-3 py-2 text-xs font-mono text-white focus:border-amber-400 focus:outline-none"
                />
              </label>
              <label className="space-y-1 text-xs text-slate-300">
                <span className="text-[11px] text-slate-400">Largura (cm)</span>
                <input
                  type="number"
                  min={11}
                  max={105}
                  value={form.package_width}
                  onChange={(e) => update('package_width', Number(e.target.value))}
                  className="block w-full rounded-xl border border-chumbo-700 bg-chumbo-950 px-3 py-2 text-xs font-mono text-white focus:border-amber-400 focus:outline-none"
                />
              </label>
              <label className="space-y-1 text-xs text-slate-300">
                <span className="text-[11px] text-slate-400">Comprimento (cm)</span>
                <input
                  type="number"
                  min={16}
                  max={105}
                  value={form.package_length}
                  onChange={(e) => update('package_length', Number(e.target.value))}
                  className="block w-full rounded-xl border border-chumbo-700 bg-chumbo-950 px-3 py-2 text-xs font-mono text-white focus:border-amber-400 focus:outline-none"
                />
              </label>
            </div>
            <p className="text-[11px] text-slate-500">
              * Mínimos dos Correios para caixas: 16cm comprimento × 11cm largura × 2cm altura.
            </p>
          </div>

          {/* Card 3: Opções Avançadas e Serviços */}
          <div className="rounded-xl border border-chumbo-800 bg-chumbo-900/40 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-cyan-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                3. Serviços Adicionais & Prazos
              </h4>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-xs text-slate-300">
                <span className="flex items-center gap-1.5 font-semibold text-white">
                  <Clock className="h-3.5 w-3.5 text-laser-400" /> Dias adicionais de produção/postagem
                </span>
                <input
                  type="number"
                  min={0}
                  max={30}
                  value={form.additional_days}
                  onChange={(e) => update('additional_days', Number(e.target.value))}
                  placeholder="0 (soma aos dias do frete)"
                  className="block w-full rounded-xl border border-chumbo-700 bg-chumbo-950 px-3 py-2 text-xs font-mono text-white focus:border-cyan-400 focus:outline-none"
                />
              </label>

              <label className="space-y-1 text-xs text-slate-300">
                <span className="font-semibold text-white">Serviços Habilitados</span>
                <select
                  value={form.services}
                  onChange={(e) => update('services', e.target.value)}
                  className="block w-full rounded-xl border border-chumbo-700 bg-chumbo-950 px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
                >
                  <option value="1,2,17">Todos (PAC, SEDEX e Mini Envios)</option>
                  <option value="1,2">PAC e SEDEX</option>
                  <option value="2">Apenas SEDEX</option>
                  <option value="1">Apenas PAC</option>
                </select>
              </label>
            </div>

            <div className="grid gap-2 pt-2 sm:grid-cols-3">
              <label className="flex items-center gap-2 rounded-lg border border-chumbo-800 bg-chumbo-950/60 p-2.5 text-xs text-slate-300 cursor-pointer hover:border-chumbo-700">
                <input
                  type="checkbox"
                  checked={form.own_hand}
                  onChange={(e) => update('own_hand', e.target.checked)}
                  className="rounded border-chumbo-700 text-laser-500 focus:ring-0"
                />
                <span>Mão Própria</span>
              </label>

              <label className="flex items-center gap-2 rounded-lg border border-chumbo-800 bg-chumbo-950/60 p-2.5 text-xs text-slate-300 cursor-pointer hover:border-chumbo-700">
                <input
                  type="checkbox"
                  checked={form.receipt}
                  onChange={(e) => update('receipt', e.target.checked)}
                  className="rounded border-chumbo-700 text-laser-500 focus:ring-0"
                />
                <span>Aviso de Recebimento (AR)</span>
              </label>

              <label className="flex items-center gap-2 rounded-lg border border-chumbo-800 bg-chumbo-950/60 p-2.5 text-xs text-slate-300 cursor-pointer hover:border-chumbo-700">
                <input
                  type="checkbox"
                  checked={form.use_insurance_value}
                  onChange={(e) => update('use_insurance_value', e.target.checked)}
                  className="rounded border-chumbo-700 text-laser-500 focus:ring-0"
                />
                <span>Seguro / Valor Declarado</span>
              </label>
            </div>
          </div>

          {/* Card 4: Credenciais e Token Opcional */}
          <div className="rounded-xl border border-chumbo-800 bg-chumbo-900/30 p-3">
            <button
              type="button"
              onClick={() => setShowAdvancedAuth(!showAdvancedAuth)}
              className="flex w-full items-center justify-between text-xs font-semibold text-slate-400 hover:text-white"
            >
              <span className="flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5 text-slate-400" /> Token Próprio SuperFrete (Opcional para Tenant)
              </span>
              {showAdvancedAuth ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {showAdvancedAuth && (
              <div className="mt-3 space-y-3 pt-3 border-t border-chumbo-800/60">
                <label className="space-y-1 text-xs text-slate-400">
                  Token de API Personalizado
                  <input
                    type="password"
                    value={form.access_token}
                    onChange={(e) => update('access_token', e.target.value)}
                    placeholder="Deixe em branco para usar o token SuperFrete da plataforma AZ3D"
                    className="block w-full rounded-xl border border-chumbo-800 bg-chumbo-950 px-3 py-2 text-xs font-mono text-white placeholder-slate-600 focus:border-laser-400 focus:outline-none"
                  />
                </label>

                <label className="space-y-1 text-xs text-slate-400">
                  URL Base da API
                  <input
                    type="text"
                    value={form.api_base_url}
                    onChange={(e) => update('api_base_url', e.target.value)}
                    placeholder="https://api.superfrete.com/api/v0"
                    className="block w-full rounded-xl border border-chumbo-800 bg-chumbo-950 px-3 py-2 text-xs font-mono text-white placeholder-slate-600 focus:border-laser-400 focus:outline-none"
                  />
                </label>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => update('is_active', e.target.checked)}
                />
                Ativa no Checkout
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.sync_tracking}
                  onChange={(e) => update('sync_tracking', e.target.checked)}
                />
                Sincronizar Rastreio
              </label>
            </div>

            <button
              disabled={saving}
              type="submit"
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-500/20 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50"
            >
              <Save className="h-4 w-4" /> {saving ? 'Salvando...' : 'Salvar Parâmetros de Frete'}
            </button>
          </div>
        </form>

        {/* Painel lateral: Resumo das Configurações do Tenant */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-chumbo-800 bg-chumbo-950/60 p-4">
            <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white">
              <Activity className="h-4 w-4 text-emerald-400" /> Resumo de Expedição
            </h4>
            
            <div className="mt-3 space-y-3">
              <div className="rounded-xl border border-chumbo-800 bg-chumbo-900/60 p-3 text-xs space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-white">SuperFrete (Correios)</span>
                  <span className="rounded-full bg-emerald-950/60 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
                    Cálculo Oficial Ativo
                  </span>
                </div>

                <div className="space-y-1 text-slate-300 text-[11px]">
                  <p className="flex items-center justify-between">
                    <span className="text-slate-400">CEP Origem:</span>
                    <strong className="font-mono text-laser-400">{form.origin_cep || 'Não definido'}</strong>
                  </p>
                  <p className="flex items-center justify-between">
                    <span className="text-slate-400">Dimensões:</span>
                    <span>{form.package_height} × {form.package_width} × {form.package_length} cm</span>
                  </p>
                  <p className="flex items-center justify-between">
                    <span className="text-slate-400">Peso Padrão:</span>
                    <span>{form.package_weight_grams}g ({(form.package_weight_grams / 1000).toFixed(2)} kg)</span>
                  </p>
                  <p className="flex items-center justify-between">
                    <span className="text-slate-400">Formato:</span>
                    <span>{form.package_format === 'box' ? 'Caixa / Pacote' : form.package_format === 'roll' ? 'Rolo / Cilindro' : 'Envelope'}</span>
                  </p>
                  <p className="flex items-center justify-between">
                    <span className="text-slate-400">Prazo Adicional:</span>
                    <span>+{form.additional_days} dia(s)</span>
                  </p>
                </div>
              </div>

              {accounts.map((account) => (
                <div key={account.id} className="rounded-xl border border-chumbo-800 bg-chumbo-900/40 p-3 text-xs">
                  <div className="flex justify-between gap-3">
                    <div>
                      <strong className="block text-white">{account.account_name || account.provider}</strong>
                      <span className="text-[11px] text-slate-500">
                        {account.auth_type} · {account.is_connected ? 'conectada' : 'ativa'}
                      </span>
                      {account.origin_cep && (
                        <p className="mt-1 flex items-center gap-1 font-mono text-emerald-400 text-[11px]">
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
                  {account.last_error && <p className="mt-2 text-rose-300 text-[11px]">{account.last_error}</p>}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-blue-500/20 bg-blue-950/20 p-3 text-[11px] text-blue-300 space-y-1">
            <p className="font-semibold flex items-center gap-1.5 text-blue-200">
              <Info className="h-3.5 w-3.5" /> Como funciona o cálculo?
            </p>
            <p className="text-slate-400">
              Quando o cliente digita o CEP de entrega na vitrine da sua loja ou no checkout, o sistema envia exatamente o seu CEP de origem e as dimensões configuradas para a API do SuperFrete, trazendo os mesmos descontos de SEDEX e PAC da plataforma.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

