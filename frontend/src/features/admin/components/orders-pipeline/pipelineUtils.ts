import { Order } from '../../../../types';

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
