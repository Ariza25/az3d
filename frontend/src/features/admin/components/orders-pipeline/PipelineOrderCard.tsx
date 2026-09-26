import React from 'react';
import { ArrowRight, CheckCircle2, Scale } from 'lucide-react';
import { Order } from '../../../../types';
import { money } from '../../../../shared/storePresentation';
import { STAGES, resolveOrderStageId } from './pipelineUtils';

interface PipelineOrderCardProps {
  order: Order;
  updatingOrderId: number | null;
  onAdvanceStatus: (orderId: number, nextStatus: string) => void;
}

export const PipelineOrderCard: React.FC<PipelineOrderCardProps> = ({
  order,
  updatingOrderId,
  onAdvanceStatus,
}) => {
  const currentStageId = resolveOrderStageId(order);
  const currentStageIndex = STAGES.findIndex((s) => s.id === currentStageId);
  const nextStage =
    currentStageIndex >= 0 && currentStageIndex < STAGES.length - 1
      ? STAGES[currentStageIndex + 1]
      : null;
  const isCompleted = order.status === 'delivered';

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-slate-300 dark:border-chumbo-800 dark:bg-chumbo-900/80 dark:hover:border-chumbo-700">
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
              onClick={() => onAdvanceStatus(order.id, nextStage.id)}
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
              onClick={() => onAdvanceStatus(order.id, 'delivered')}
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
};
