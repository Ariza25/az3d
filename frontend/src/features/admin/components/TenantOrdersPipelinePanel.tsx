import React, { useState } from 'react';
import { Order } from '../../../types';
import { Cpu, ArrowRight, Search, RefreshCw, Package, CheckCircle2, AlertCircle } from 'lucide-react';
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
            <p className="text-xs text-slate-600 dark:text-slate-400">Acompanhe a fabricação e etapas dos pedidos do tenant</p>
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
                isActive ? `${stage.color} ring-2 ring-cyan-600 dark:ring-laser-400` : 'border-slate-200 bg-white hover:border-slate-300 dark:border-chumbo-800 dark:bg-chumbo-900/40 dark:hover:border-chumbo-700'
              }`}
            >
              <span className={`block text-[11px] font-medium ${isActive ? 'text-white' : 'text-slate-600 dark:text-slate-400'}`}>{stage.label}</span>
              <strong className={`mt-1 block text-xl font-extrabold ${isActive ? 'text-white' : 'text-slate-900 dark:text-white'}`}>{count}</strong>
            </button>
          );
        })}
      </div>

      {/* Orders List / Pipeline Cards */}
      {filteredOrders.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500 shadow-sm dark:border-chumbo-800 dark:bg-chumbo-900/40 dark:text-slate-400">
          <Package className="mx-auto h-10 w-10 text-slate-400 mb-2" />
          <p className="font-semibold text-slate-900 dark:text-white">Nenhum pedido encontrado nesta etapa</p>
          <p className="mt-1 text-xs">Ajuste os filtros ou aguarde novas vendas no tenant.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const currentStageId = resolveOrderStageId(order);
            const currentStageIndex = STAGES.findIndex((s) => s.id === currentStageId);
            const nextStage = currentStageIndex >= 0 && currentStageIndex < STAGES.length - 1 ? STAGES[currentStageIndex + 1] : null;
            const isCompleted = order.status === 'delivered';

            return (
              <article key={order.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-slate-300 dark:border-chumbo-800 dark:bg-chumbo-900/80 dark:hover:border-chumbo-700">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 dark:border-chumbo-800/80">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">Pedido #{order.id}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">· {new Date(order.created_at).toLocaleDateString('pt-BR')}</span>
                    <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 dark:border-chumbo-700 dark:bg-chumbo-950 dark:text-slate-300">
                      Cliente: {order.recipient_name || order.user?.name || 'Comprador'}
                    </span>
                    <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-0.5 text-xs font-semibold text-cyan-800 dark:border-cyan-800/60 dark:bg-cyan-950/50 dark:text-cyan-300">
                      {STAGES.find((s) => s.id === currentStageId)?.label || order.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-mono text-base font-extrabold text-cyan-700 dark:text-laser-400">{money(order.total_amount)}</span>
                    {nextStage && (
                      <button
                        type="button"
                        disabled={updatingOrderId === order.id}
                        onClick={() => handleAdvanceStatus(order.id, nextStage.id)}
                        className="flex items-center gap-1 rounded-xl bg-cyan-700 px-3 py-1.5 text-xs font-extrabold text-white border border-cyan-800 transition-all hover:bg-cyan-800 dark:bg-laser-500/20 dark:text-laser-400 dark:border-laser-500/30 dark:hover:bg-laser-500/30 disabled:opacity-50"
                      >
                        <span>Avançar para: {nextStage.label}</span>
                        <ArrowRight className="h-3.5 w-3.5" />
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
                    <div key={item.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-2.5 dark:border-chumbo-800 dark:bg-chumbo-950">
                      {item.product?.image_url && (
                        <img src={item.product.image_url} alt="" className="h-12 w-12 rounded-lg object-cover border border-slate-200 dark:border-chumbo-700" />
                      )}
                      <div className="min-w-0 flex-1 text-xs">
                        <strong className="block truncate text-slate-900 dark:text-white">{item.product?.title || `Produto #${item.product_id}`}</strong>
                        <span className="text-slate-500 dark:text-slate-400 font-mono">{item.quantity}x · Cor: {item.color}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
