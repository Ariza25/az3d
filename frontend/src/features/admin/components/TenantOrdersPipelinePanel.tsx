import React, { useState } from 'react';
import { Order, OrderFilamentCheckResult, FilamentSpool } from '../../../types';
import {
  Cpu,
  ArrowRight,
  Search,
  RefreshCw,
  Package,
  CheckCircle2,
  AlertCircle,
  Scale,
  AlertTriangle,
  X,
  Loader2,
} from 'lucide-react';
import { money } from '../../../shared/storePresentation';
import { api } from '../../../services/api';

interface TenantOrdersPipelinePanelProps {
  orders: Order[];
  onRefreshOrders: () => void;
  tenantId?: number;
}

export const STAGES = [
  { id: 'pending_payment', label: 'Aguardando Pagamento', color: 'border-amber-800 bg-amber-700 text-white dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300' },
  { id: 'queued_printing', label: 'Fila de Impressão', color: 'border-cyan-800 bg-cyan-700 text-white dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-300' },
  { id: 'in_printing', label: 'Em Impressão 3D', color: 'border-purple-800 bg-purple-700 text-white dark:border-purple-500/40 dark:bg-purple-500/10 dark:text-purple-300' },
  { id: 'post_processing', label: 'Pós-Processamento', color: 'border-indigo-800 bg-indigo-700 text-white dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-300' },
  { id: 'ready_shipping', label: 'Pronto / Expedição', color: 'border-emerald-800 bg-emerald-700 text-white dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300' },
  { id: 'shipped', label: 'Enviado / Rastreio', color: 'border-blue-800 bg-blue-700 text-white dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-300' },
] as const;

export const resolveOrderStageId = (order: Order): string => {
  const s = order.status;
  if (s === 'in_printing') return 'in_printing';
  if (s === 'post_processing') return 'post_processing';
  if (s === 'ready_shipping') return 'ready_shipping';
  if (s === 'shipped' || s === 'delivered') return 'shipped';

  const isPaid = order.payment_status === 'approved' || order.payment_status === 'paid' || !!order.paid_at;
  if (s === 'queued_printing' || s === 'paid' || s === 'preparing' || s === 'confirmed' || isPaid) {
    return 'queued_printing';
  }

  return 'pending_payment';
};

export const TenantOrdersPipelinePanel: React.FC<TenantOrdersPipelinePanelProps> = ({
  orders,
  onRefreshOrders,
  tenantId,
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Pre-flight Filament Check Modal
  const [checkingOrder, setCheckingOrder] = useState<Order | null>(null);
  const [filamentCheckResult, setFilamentCheckResult] = useState<OrderFilamentCheckResult | null>(null);
  const [availableSpools, setAvailableSpools] = useState<FilamentSpool[]>([]);
  const [selectedSpoolMap, setSelectedSpoolMap] = useState<Record<number, number>>({});
  const [autoDeduct, setAutoDeduct] = useState(true);
  const [isCheckingFilament, setIsCheckingFilament] = useState(false);
  const [isStartingProduction, setIsStartingProduction] = useState(false);

  const filteredOrders = orders.filter((order) => {
    const stageId = resolveOrderStageId(order);
    const matchesStatus = filterStatus === 'all' || stageId === filterStatus;
    const matchesSearch =
      order.id.toString().includes(searchQuery) ||
      (order.recipient_name && order.recipient_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (order.user?.name && order.user.name.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  const handleAdvanceStatus = async (orderId: number, nextStatus: string) => {
    // If advancing to in_printing, open the filament pre-flight check first!
    if (nextStatus === 'in_printing') {
      const order = orders.find((o) => o.id === orderId);
      if (order) {
        await initiateProductionCheck(order);
        return;
      }
    }

    setUpdatingOrderId(orderId);
    setErrorMessage(null);
    try {
      await api.updateOrderStatus(orderId, nextStatus, tenantId);
      onRefreshOrders();
    } catch (err: any) {
      console.error('Falha ao atualizar status do pedido', err);
      setErrorMessage(err?.message || 'Falha ao atualizar status do pedido');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const initiateProductionCheck = async (order: Order) => {
    setCheckingOrder(order);
    setIsCheckingFilament(true);
    setFilamentCheckResult(null);

    try {
      const [checkData, spoolsData] = await Promise.all([
        api.checkOrderFilament(order.id, tenantId),
        api.getFilamentSpools(tenantId),
      ]);

      setFilamentCheckResult(checkData);
      setAvailableSpools(spoolsData || []);

      // Prepopulate selected spools map strictly from exact color/material matches
      const initialMap: Record<number, number> = {};
      checkData.items.forEach((item) => {
        if (item.matching_spool_id) {
          initialMap[item.order_item_id] = item.matching_spool_id;
        }
      });
      setSelectedSpoolMap(initialMap);
    } catch (err: any) {
      console.error('Erro ao verificar filamento do pedido:', err);
      setErrorMessage(err.message || 'Erro ao verificar filamentos');
    } finally {
      setIsCheckingFilament(false);
    }
  };

  const handleConfirmStartProduction = async () => {
    if (!checkingOrder) return;
    setIsStartingProduction(true);
    setErrorMessage(null);

    try {
      // If auto-deduct is enabled, deduct the grams for each item
      if (autoDeduct && filamentCheckResult) {
        for (const item of filamentCheckResult.items) {
          const chosenSpoolId = selectedSpoolMap[item.order_item_id] || item.matching_spool_id;
          if (chosenSpoolId && item.total_required_grams > 0) {
            try {
              await api.deductFilament(
                {
                  spool_id: chosenSpoolId,
                  order_id: checkingOrder.id,
                  grams: item.total_required_grams,
                  description: `Produção Pedido #${checkingOrder.id} - ${item.product_title} (${item.quantity}x ${item.color})`,
                },
                tenantId
              );
            } catch (deductErr) {
              console.warn('Erro ao abater filamento de item:', deductErr);
            }
          }
        }
      }

      // Update status to in_printing
      await api.updateOrderStatus(checkingOrder.id, 'in_printing', tenantId);
      setCheckingOrder(null);
      onRefreshOrders();
    } catch (err: any) {
      console.error('Falha ao iniciar produção:', err);
      setErrorMessage(err?.message || 'Falha ao iniciar produção');
    } finally {
      setIsStartingProduction(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-chumbo-800 dark:bg-chumbo-900/60">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700 dark:bg-laser-500/20 dark:text-laser-400">
            <Cpu className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Pipeline de Produção 3D & Pedidos</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Acompanhe fabricação, carretéis em uso e etapas dos pedidos
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar pedido ou cliente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:border-cyan-600 focus:outline-none dark:border-chumbo-700 dark:bg-chumbo-950 dark:text-white dark:placeholder-slate-500"
            />
          </div>

          <button
            type="button"
            onClick={onRefreshOrders}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200 dark:border-chumbo-700 dark:bg-chumbo-800 dark:text-slate-300 dark:hover:bg-chumbo-700 dark:hover:text-white"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-red-600 hover:underline dark:text-red-400 font-semibold"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Stage Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {STAGES.map((stage) => {
          const count = orders.filter((o) => resolveOrderStageId(o) === stage.id).length;
          const isActive = filterStatus === stage.id;
          return (
            <button
              key={stage.id}
              type="button"
              onClick={() => setFilterStatus(isActive ? 'all' : stage.id)}
              className={`rounded-xl border p-3 text-left transition-all shadow-sm ${
                isActive
                  ? `${stage.color} ring-2 ring-cyan-600 dark:ring-laser-400`
                  : 'border-slate-200 bg-white hover:border-slate-300 dark:border-chumbo-800 dark:bg-chumbo-900/40 dark:hover:border-chumbo-700'
              }`}
            >
              <span className={`block text-[11px] font-medium ${isActive ? 'text-white' : 'text-slate-600 dark:text-slate-400'}`}>
                {stage.label}
              </span>
              <strong className={`mt-1 block text-xl font-extrabold ${isActive ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                {count}
              </strong>
            </button>
          );
        })}
      </div>

      {/* Orders List / Pipeline Cards */}
      {filteredOrders.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500 shadow-sm dark:border-chumbo-800 dark:bg-chumbo-900/40 dark:text-slate-400">
          <Package className="mx-auto h-10 w-10 text-slate-400 mb-2" />
          <p className="font-semibold text-slate-900 dark:text-white">Nenhum pedido encontrado nesta etapa</p>
          <p className="mt-1 text-xs">Ajuste os filtros ou aguarde novas vendas na loja.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const currentStageId = resolveOrderStageId(order);
            const currentStageIndex = STAGES.findIndex((s) => s.id === currentStageId);
            const nextStage =
              currentStageIndex >= 0 && currentStageIndex < STAGES.length - 1
                ? STAGES[currentStageIndex + 1]
                : null;
            const isCompleted = order.status === 'delivered';

            return (
              <article
                key={order.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-slate-300 dark:border-chumbo-800 dark:bg-chumbo-900/80 dark:hover:border-chumbo-700"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 dark:border-chumbo-800/80">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                      Pedido #{order.id}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      · {new Date(order.created_at).toLocaleDateString('pt-BR')}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 dark:border-chumbo-700 dark:bg-chumbo-950 dark:text-slate-300">
                      Cliente: {order.recipient_name || order.user?.name || 'Comprador'}
                    </span>
                    <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-0.5 text-xs font-semibold text-cyan-800 dark:border-cyan-800/60 dark:bg-cyan-950/50 dark:text-cyan-300">
                      {STAGES.find((s) => s.id === currentStageId)?.label || order.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-mono text-base font-extrabold text-cyan-700 dark:text-laser-400">
                      {money(order.total_amount)}
                    </span>

                    {/* Pre-flight check / Start Button */}
                    {nextStage && (
                      <button
                        type="button"
                        disabled={updatingOrderId === order.id}
                        onClick={() => handleAdvanceStatus(order.id, nextStage.id)}
                        className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-extrabold transition-all shadow-sm disabled:opacity-50 ${
                          nextStage.id === 'in_printing'
                            ? 'bg-purple-700 text-white hover:bg-purple-800 border border-purple-800 dark:bg-purple-600/30 dark:text-purple-300 dark:border-purple-500/40 dark:hover:bg-purple-600/40'
                            : 'bg-cyan-700 text-white hover:bg-cyan-800 border border-cyan-800 dark:bg-laser-500/20 dark:text-laser-400 dark:border-laser-500/30 dark:hover:bg-laser-500/30'
                        }`}
                      >
                        {nextStage.id === 'in_printing' ? (
                          <>
                            <Scale className="h-3.5 w-3.5" />
                            <span>Verificar & Iniciar Impressão</span>
                          </>
                        ) : (
                          <>
                            <span>Avançar para: {nextStage.label}</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </>
                        )}
                      </button>
                    )}

                    {!nextStage && !isCompleted && currentStageId === 'shipped' && (
                      <button
                        type="button"
                        disabled={updatingOrderId === order.id}
                        onClick={() => handleAdvanceStatus(order.id, 'delivered')}
                        className="flex items-center gap-1 rounded-xl bg-emerald-700 px-3 py-1.5 text-xs font-extrabold text-white border border-emerald-800 transition-all hover:bg-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30 dark:hover:bg-emerald-500/30 disabled:opacity-50"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Marcar como Concluído</span>
                      </button>
                    )}

                    {isCompleted && (
                      <span className="flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Concluído</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Items detail & 3D print specs */}
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {order.items?.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-2.5 dark:border-chumbo-800 dark:bg-chumbo-950"
                    >
                      {item.product?.image_url && (
                        <img
                          src={item.product.image_url}
                          alt=""
                          className="h-12 w-12 rounded-lg object-cover border border-slate-200 dark:border-chumbo-700"
                        />
                      )}
                      <div className="min-w-0 flex-1 text-xs">
                        <strong className="block truncate text-slate-900 dark:text-white">
                          {item.product?.title || `Produto #${item.product_id}`}
                        </strong>
                        <div className="flex flex-wrap items-center gap-x-2 text-slate-500 dark:text-slate-400 font-mono">
                          <span>{item.quantity}x</span>
                          <span>•</span>
                          <span>Cor: {item.color}</span>
                          {item.product?.weight && (
                            <>
                              <span>•</span>
                              <span>Peso: {item.product.weight}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Modal de Pré-Voo de Filamento (Filament Pre-flight Check) */}
      {checkingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl space-y-4 dark:border-chumbo-700 dark:bg-chumbo-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-chumbo-800">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400">
                  <Scale className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Pré-Voo de Filamento · Pedido #{checkingOrder.id}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Verifique se há carretel suficiente antes de iniciar a impressão física
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCheckingOrder(null)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {isCheckingFilament ? (
              <div className="flex flex-col items-center justify-center p-8 text-xs text-slate-400 space-y-2">
                <Loader2 className="h-6 w-6 animate-spin text-purple-600 dark:text-purple-400" />
                <span>Analisando carretéis compatíveis no estoque...</span>
              </div>
            ) : filamentCheckResult ? (
              <div className="space-y-4">
                {/* Warnings banner */}
                {filamentCheckResult.warnings.length > 0 && (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                      <span>Alerta de Filamento Insuficiente no Estoque!</span>
                    </div>
                    {filamentCheckResult.warnings.map((warn, idx) => (
                      <p key={idx} className="text-[11px] pl-5.5">
                        {warn}
                      </p>
                    ))}
                  </div>
                )}

                {/* Items check list */}
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {filamentCheckResult.items.map((item) => {
                    const chosenSpoolId = selectedSpoolMap[item.order_item_id] || item.matching_spool_id;
                    const chosenSpool = availableSpools.find((s) => s.id === chosenSpoolId);
                    const isSufficient = chosenSpool
                      ? chosenSpool.remaining_weight_g >= item.total_required_grams
                      : false;
                    const remainingAfter = chosenSpool
                      ? Math.round(chosenSpool.remaining_weight_g - item.total_required_grams)
                      : 0;

                    return (
                      <div
                        key={item.order_item_id}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs space-y-2 dark:border-chumbo-800 dark:bg-chumbo-950"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <strong className="block text-slate-900 dark:text-white">
                              {item.product_title}
                            </strong>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                              {item.quantity}x · Cor: {item.color} · Mat: {item.material}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">
                              Consumo Total
                            </span>
                            <strong className="font-mono text-sm text-cyan-700 dark:text-laser-400">
                              {Math.round(item.total_required_grams)}g
                            </strong>
                          </div>
                        </div>

                        {/* Spool selector */}
                        <div className="pt-2 border-t border-slate-200 dark:border-chumbo-800/80">
                          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                            Carretel a ser utilizado / debitado:
                          </label>
                          <select
                            value={chosenSpoolId || ''}
                            onChange={(e) =>
                              setSelectedSpoolMap((prev) => ({
                                ...prev,
                                [item.order_item_id]: Number(e.target.value),
                              }))
                            }
                            className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-900 focus:border-purple-600 focus:outline-none dark:border-chumbo-700 dark:bg-chumbo-900 dark:text-white"
                          >
                            <option value="">Selecione um carretel...</option>
                            {availableSpools.map((spool) => (
                              <option key={spool.id} value={spool.id}>
                                {spool.name} ({spool.vendor ? `${spool.vendor} · ` : ''}{spool.color_name}) - Restante: {Math.round(spool.remaining_weight_g)}g
                              </option>
                            ))}
                          </select>

                          {/* Status result pill */}
                          <div className="mt-1.5 flex items-center justify-between text-[11px]">
                            {chosenSpool ? (
                              isSufficient ? (
                                <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-bold">
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  <span>
                                    Suficiente! Restarão {remainingAfter}g após a impressão
                                  </span>
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-bold">
                                  <AlertCircle className="h-3.5 w-3.5" />
                                  <span>
                                    Insuficiente! Faltam{' '}
                                    {Math.round(item.total_required_grams - chosenSpool.remaining_weight_g)}g no carretel
                                  </span>
                                </span>
                              )
                            ) : (
                              <span className="text-amber-600 dark:text-amber-400 font-bold">
                                Nenhum carretel selecionado
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Auto Deduct Checkbox */}
                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 font-medium cursor-pointer p-2 rounded-xl bg-slate-50 border border-slate-200 dark:bg-chumbo-950 dark:border-chumbo-800">
                  <input
                    type="checkbox"
                    checked={autoDeduct}
                    onChange={(e) => setAutoDeduct(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span>
                    Abater gramas automaticamente dos carretéis selecionados ao dar o play
                  </span>
                </label>
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-3 dark:border-chumbo-800">
              <button
                type="button"
                onClick={() => setCheckingOrder(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:border-chumbo-700 dark:text-slate-400 dark:hover:bg-chumbo-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isStartingProduction || isCheckingFilament}
                onClick={handleConfirmStartProduction}
                className="flex items-center gap-1.5 rounded-xl bg-purple-700 px-5 py-2 text-xs font-extrabold text-white shadow-sm hover:bg-purple-800 dark:bg-purple-600 dark:hover:bg-purple-500 disabled:opacity-50"
              >
                {isStartingProduction ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Cpu className="h-4 w-4" />
                )}
                <span>Confirmar Início da Produção 3D</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
