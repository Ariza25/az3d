import React, { useEffect, useState } from 'react';
import {
  Tag,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Truck,
  Percent,
  Layers,
  Sparkles,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { Coupon, CouponInput } from '../../../types';
import { api } from '../../../services/api';

interface PromotionsManagementPanelProps {
  tenantId?: number;
}

export const PromotionsManagementPanel: React.FC<PromotionsManagementPanelProps> = ({ tenantId }) => {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Formulário para novo cupom
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newDiscountPercent, setNewDiscountPercent] = useState<number>(10);
  const [newAppliesToShipping, setNewAppliesToShipping] = useState(false);
  const [newUsageLimit, setNewUsageLimit] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadCoupons = async () => {
    try {
      setLoading(true);
      const list = await api.getAdminCoupons(tenantId);
      setCoupons(list || []);
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Erro ao carregar cupons' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCoupons();
  }, [tenantId]);

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = newCode.trim().toUpperCase();
    if (!cleanCode) {
      setFeedback({ type: 'error', text: 'Informe o nome/código da promoção.' });
      return;
    }
    if (newDiscountPercent <= 0 || newDiscountPercent > 100) {
      setFeedback({ type: 'error', text: 'A porcentagem de desconto deve ser entre 0.1% e 100%.' });
      return;
    }

    try {
      setIsSubmitting(true);
      setFeedback(null);
      const payload: CouponInput = {
        code: cleanCode,
        discount_percent: newDiscountPercent,
        applies_to_shipping: newAppliesToShipping,
        is_active: true,
        usage_limit: newUsageLimit,
      };

      const created = await api.createAdminCoupon(payload, tenantId);
      setCoupons((prev) => [created, ...prev]);
      setShowCreateModal(false);
      setNewCode('');
      setNewDiscountPercent(10);
      setNewAppliesToShipping(false);
      setNewUsageLimit(0);
      setFeedback({ type: 'success', text: `Cupom ${created.code} criado com sucesso!` });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Não foi possível criar o cupom.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (coupon: Coupon) => {
    try {
      const nextActive = !coupon.is_active;
      const updated = await api.updateAdminCoupon(coupon.id, { is_active: nextActive }, tenantId);
      setCoupons((prev) => prev.map((c) => (c.id === coupon.id ? updated : c)));
      setFeedback({
        type: 'success',
        text: `Cupom ${coupon.code} ${nextActive ? 'ativado' : 'pausado'} com sucesso!`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Erro ao atualizar cupom.' });
    }
  };

  const handleDeleteCoupon = async (coupon: Coupon) => {
    if (!window.confirm(`Tem certeza que deseja excluir o cupom "${coupon.code}"?`)) return;
    try {
      await api.deleteAdminCoupon(coupon.id, tenantId);
      setCoupons((prev) => prev.filter((c) => c.id !== coupon.id));
      setFeedback({ type: 'success', text: `Cupom ${coupon.code} excluído com sucesso.` });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Erro ao excluir cupom.' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Feedback banner */}
      {feedback && (
        <div
          className={`flex items-center gap-2 rounded-xl p-3 text-xs font-semibold ${
            feedback.type === 'success'
              ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              : 'border border-rose-500/30 bg-rose-500/10 text-rose-300'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* 1. Atacado Progressivo (Informativo e Ativo) */}
      <div className="rounded-2xl border border-chumbo-800 bg-chumbo-900/60 p-5 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-chumbo-800/80 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-laser-400/10 text-laser-400 border border-laser-400/20">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Desconto Progressivo por Atacado
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
                  Ativo na loja
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Quanto maior a quantidade selecionada, o preço original é riscado e o desconto é aplicado automaticamente.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-chumbo-800 bg-chumbo-950/70 p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">Faixa 1</span>
              <span className="rounded-md bg-laser-400/10 px-2 py-0.5 text-xs font-extrabold text-laser-400 border border-laser-400/20">
                2% OFF
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">A partir de <strong>3 unidades</strong></p>
            <p className="mt-1 text-[11px] text-slate-500">Valor riscado e calculado por item</p>
          </div>

          <div className="rounded-xl border border-chumbo-800 bg-chumbo-950/70 p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">Faixa 2</span>
              <span className="rounded-md bg-laser-400/10 px-2 py-0.5 text-xs font-extrabold text-laser-400 border border-laser-400/20">
                5% OFF
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">A partir de <strong>6 unidades</strong></p>
            <p className="mt-1 text-[11px] text-slate-500">Valor riscado e calculado por item</p>
          </div>

          <div className="rounded-xl border border-chumbo-800 bg-chumbo-950/70 p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">Faixa 3</span>
              <span className="rounded-md bg-laser-400/10 px-2 py-0.5 text-xs font-extrabold text-laser-400 border border-laser-400/20">
                7% OFF
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">A partir de <strong>10 unidades</strong></p>
            <p className="mt-1 text-[11px] text-slate-500">Desconto máximo de atacado</p>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-400">
          <Sparkles className="h-3.5 w-3.5 text-laser-400 shrink-0" />
          <span>O cliente pode combinar o desconto de atacado com qualquer cupom ativo digitado no checkout.</span>
        </div>
      </div>

      {/* 2. Gestão de Cupons */}
      <div className="rounded-2xl border border-chumbo-800 bg-chumbo-900/60 p-5 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-chumbo-800/80 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Tag className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Cupons Promocionais (% OFF)</h3>
              <p className="text-xs text-slate-400">
                Crie cupons com nome da promoção e porcentagem. É possível aplicar o desconto no frete também.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-laser-400 px-3.5 py-2 text-xs font-bold text-chumbo-950 transition hover:bg-laser-300"
          >
            <Plus className="h-4 w-4" />
            Criar novo cupom
          </button>
        </div>

        {/* Modal de criação de cupom */}
        {showCreateModal && (
          <div className="mt-4 rounded-xl border border-chumbo-700 bg-chumbo-950 p-4">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">
              Novo Cupom de Desconto
            </h4>
            <form onSubmit={handleCreateCoupon} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Nome da Promoção / Código
                  </label>
                  <input
                    type="text"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                    placeholder="Ex: PROMO10, CLIENTEVIP"
                    required
                    className="w-full rounded-xl border border-chumbo-700 bg-chumbo-900 px-3 py-2 text-xs font-mono font-bold text-white placeholder-slate-600 focus:border-laser-400 focus:outline-none"
                  />
                  <p className="mt-1 text-[10px] text-slate-500">Este é o código que o cliente digitará no checkout.</p>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Porcentagem de Desconto (% OFF)
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="number"
                      step="0.5"
                      min="1"
                      max="100"
                      value={newDiscountPercent}
                      onChange={(e) => setNewDiscountPercent(parseFloat(e.target.value) || 0)}
                      required
                      className="w-full rounded-xl border border-chumbo-700 bg-chumbo-900 px-3 py-2 pr-8 text-xs font-bold text-white focus:border-laser-400 focus:outline-none"
                    />
                    <Percent className="absolute right-3 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
                  </div>
                  <p className="mt-1 text-[10px] text-slate-500">Ex: 10 para 10% de desconto.</p>
                </div>
              </div>

              <div className="rounded-xl border border-chumbo-800 bg-chumbo-900/50 p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-laser-400" />
                  <div>
                    <strong className="block text-xs text-white">Aplicar desconto também sobre o frete</strong>
                    <span className="block text-[10px] text-slate-400">
                      Se ativado, a % de desconto também reduzirá o valor do frete calculado (SuperFrete).
                    </span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={newAppliesToShipping}
                  onChange={(e) => setNewAppliesToShipping(e.target.checked)}
                  className="h-4 w-4 rounded border-chumbo-700 bg-chumbo-950 text-laser-400 focus:ring-laser-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-chumbo-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border border-chumbo-700 px-3.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-chumbo-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-laser-400 px-4 py-1.5 text-xs font-bold text-chumbo-950 hover:bg-laser-300 disabled:opacity-50"
                >
                  {isSubmitting ? 'Salvando...' : 'Salvar Cupom'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Lista de cupons */}
        <div className="mt-4">
          {loading ? (
            <p className="py-6 text-center text-xs text-slate-500">Carregando cupons...</p>
          ) : coupons.length === 0 ? (
            <div className="rounded-xl border border-chumbo-800/80 bg-chumbo-950/40 p-6 text-center text-xs text-slate-500">
              Nenhum cupom cadastrado até o momento. Clique em &quot;Criar novo cupom&quot; acima para habilitar descontos.
            </div>
          ) : (
            <div className="divide-y divide-chumbo-800/80 rounded-xl border border-chumbo-800 bg-chumbo-950/50">
              {coupons.map((coupon) => (
                <div key={coupon.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 text-xs">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-chumbo-800 text-laser-400">
                      <Tag className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <strong className="font-mono text-sm tracking-wide text-white">{coupon.code}</strong>
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
                          {coupon.discount_percent}% OFF
                        </span>
                        {coupon.applies_to_shipping && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold text-cyan-400 border border-cyan-500/20" title="Desconto incide também no frete">
                            <Truck className="h-3 w-3" /> + Frete
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {coupon.usage_count} uso{coupon.usage_count === 1 ? '' : 's'}
                        {coupon.usage_limit > 0 ? ` de ${coupon.usage_limit} limites` : ' (ilimitado)'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(coupon)}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                        coupon.is_active
                          ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                          : 'border border-slate-700 bg-chumbo-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {coupon.is_active ? <ToggleRight className="h-4 w-4 text-emerald-400" /> : <ToggleLeft className="h-4 w-4" />}
                      <span>{coupon.is_active ? 'Ativo' : 'Pausado'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteCoupon(coupon)}
                      className="rounded-lg border border-chumbo-800 p-1.5 text-slate-400 transition hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-400"
                      title="Excluir cupom"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
