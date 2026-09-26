import React, { useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  Layers,
  MapPin,
  PackageCheck,
  QrCode,
  ReceiptText,
  Truck,
} from 'lucide-react';
import { Order } from '../../../types';
import { money } from '../../../shared/storePresentation';

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending_confirmation: 'Aguardando confirmação',
  pending_payment: 'Aguardando pagamento',
  queued_printing: 'Fila de Impressão',
  in_printing: 'Em Impressão 3D',
  post_processing: 'Pós-Processamento',
  ready_shipping: 'Pronto para Envio',
  shipped: 'Enviado',
  paid: 'Pago',
  preparing: 'Em preparo',
  delivered: 'Concluído',
  cancelled: 'Cancelado',
};

const StatusPill = ({ label, tone }: { label: string; tone: 'success' | 'warning' | 'danger' }) => {
  const classes =
    tone === 'success'
      ? 'border-emerald-800 bg-emerald-700 text-white dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200'
      : tone === 'danger'
      ? 'border-rose-800 bg-rose-700 text-white dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200'
      : 'border-amber-800 bg-amber-700 text-white dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200';
  return <span className={`rounded-full border px-2.5 py-1 text-center font-bold shadow-sm ${classes}`}>{label}</span>;
};

interface CartOrdersPanelProps {
  orders: Order[];
  isLoading: boolean;
  errorMessage: string | null;
  isAuthenticated: boolean;
  onReload: () => void;
  onOpenLogin: () => void;
  onOpenPaymentModal?: (order: Order) => void;
}

export const CartOrdersPanel: React.FC<CartOrdersPanelProps> = ({
  orders,
  isLoading,
  errorMessage,
  isAuthenticated,
  onReload,
  onOpenLogin,
  onOpenPaymentModal,
}) => {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      {!isAuthenticated ? (
        <div className="py-16 text-center">
          <ReceiptText className="mx-auto h-12 w-12 text-slate-600" />
          <h3 className="mt-4 text-lg font-bold text-white">Entre para ver seus pedidos</h3>
          <p className="mt-2 text-sm text-slate-400">Seu histórico fica vinculado à conta de comprador.</p>
          <button
            onClick={onOpenLogin}
            className="mt-5 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-chumbo-950 hover:bg-slate-200"
          >
            Entrar
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-slate-400">{orders.length} pedido(s) encontrado(s)</p>
            <button
              onClick={onReload}
              className="rounded-lg border border-chumbo-700 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-chumbo-800"
            >
              Atualizar
            </button>
          </div>
          {errorMessage && (
            <div className="rounded-xl border border-red-800/80 bg-red-950/60 p-3 text-xs text-red-200">
              {errorMessage}
            </div>
          )}
          {isLoading ? (
            <p className="py-12 text-center text-xs text-slate-500">Carregando pedidos...</p>
          ) : orders.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-500">Você ainda não fez pedidos nesta loja.</div>
          ) : (
            <OrdersList orders={orders} onOpenPaymentModal={onOpenPaymentModal} />
          )}
        </div>
      )}
    </div>
  );
};

export const OrdersList: React.FC<{
  orders: Order[];
  compact?: boolean;
  onOpenPaymentModal?: (order: Order) => void;
}> = ({ orders, compact = false, onOpenPaymentModal }) => {
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(compact ? null : orders[0]?.id ?? null);
  const [copiedTrackingId, setCopiedTrackingId] = useState<string | null>(null);

  const copyTracking = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedTrackingId(code);
    setTimeout(() => setCopiedTrackingId(null), 2500);
  };

  const getTrackingUrl = (code: string) => {
    const clean = code.trim().toUpperCase();
    if (/^[A-Z]{2}[0-9]{9}[A-Z]{2}$/.test(clean)) {
      return `https://rastreamento.correios.com.br/app/index.php?codigo=${clean}`;
    }
    return `https://www.google.com/search?q=rastreio+${encodeURIComponent(clean)}`;
  };

  const formatPaymentMethodLabel = (method?: string) => {
    const m = (method || '').toLowerCase();
    if (m === 'pix') return 'PIX Instantâneo';
    if (m === 'credit_card' || m === 'card' || m === 'cartao') return 'Cartão de Crédito';
    return method || 'Mercado Pago';
  };

  const formatPaymentStatusLabel = (status?: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'approved' || s === 'paid') return 'Pago / Aprovado';
    if (s === 'pending') return 'Aguardando Pagamento';
    if (s === 'rejected') return 'Recusado';
    if (s === 'cancelled') return 'Cancelado';
    if (s === 'refunded') return 'Reembolsado';
    return status || 'Pendente';
  };

  return (
    <div className="space-y-3 text-left">
      {orders.map((order) => {
        const isExpanded = expandedOrderId === order.id;
        const latestShipment = order.shipments?.[0];
        const latestEvent = latestShipment?.events?.[0];
        const isPixPending =
          (order.payment_method === 'pix' || !!order.pix_qr_code) &&
          order.payment_status !== 'approved' &&
          order.payment_status !== 'paid' &&
          order.status !== 'confirmed' &&
          order.status !== 'paid' &&
          order.status !== 'queued_printing' &&
          order.status !== 'in_printing' &&
          order.status !== 'post_processing' &&
          order.status !== 'ready_shipping' &&
          order.status !== 'shipped' &&
          order.status !== 'delivered';

        return (
          <div
            key={order.id}
            className="rounded-2xl border border-chumbo-800 bg-chumbo-900/80 p-4 transition-all hover:border-chumbo-750"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">Pedido #{order.id}</span>
                  {order.delivery_method === 'pickup' ? (
                    <span className="rounded-full bg-chumbo-800 border border-chumbo-700 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                      Retirada
                    </span>
                  ) : (
                    <span className="rounded-full bg-laser-500/10 border border-laser-500/30 px-2 py-0.5 text-[10px] font-semibold text-laser-300">
                      Entrega
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  {new Date(order.created_at).toLocaleString('pt-BR')}
                </p>
              </div>
              <span className="text-sm font-extrabold text-white">{money(order.total_amount)}</span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
              <StatusPill
                label={ORDER_STATUS_LABELS[order.status] || order.status}
                tone={
                  order.status === 'cancelled'
                    ? 'danger'
                    : order.status === 'delivered' || order.status === 'paid' || order.status === 'confirmed'
                    ? 'success'
                    : 'warning'
                }
              />
              <StatusPill
                label={formatPaymentStatusLabel(order.payment_status)}
                tone={
                  order.payment_status === 'approved' || order.payment_status === 'paid'
                    ? 'success'
                    : order.payment_status === 'rejected' || order.payment_status === 'cancelled'
                    ? 'danger'
                    : 'warning'
                }
              />
            </div>

            {isPixPending && onOpenPaymentModal && (
              <button
                type="button"
                onClick={() => onOpenPaymentModal(order)}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-teal-500/20 border border-teal-500/40 py-2 text-xs font-bold text-teal-300 hover:bg-teal-500/30 transition"
              >
                <QrCode className="h-3.5 w-3.5" />
                <span>Pagar PIX / Abrir QR Code</span>
              </button>
            )}

            {!compact && (
              <div className="mt-3 pt-2 border-t border-chumbo-800/80">
                <button
                  type="button"
                  onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                  className="flex w-full items-center justify-between py-1 text-xs font-semibold text-laser-400 hover:text-laser-300 transition"
                >
                  <span className="flex items-center gap-1.5">
                    <PackageCheck className="h-3.5 w-3.5" />
                    {isExpanded ? 'Ocultar detalhes da compra' : 'Averiguar resumo e rastreio da compra'}
                  </span>
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>

                {isExpanded && (
                  <div className="mt-3 space-y-3.5 pt-2 text-xs animate-fade-in">
                    {order.items && order.items.length > 0 && (
                      <div className="rounded-xl border border-chumbo-800 bg-chumbo-950/60 p-3 space-y-2">
                        <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          Itens do Pedido ({order.items.length})
                        </span>
                        <div className="divide-y divide-chumbo-850">
                          {order.items.map((item) => {
                            const colorImg = item.product?.color_images?.find(
                              (img) => img.color_name === item.color
                            )?.image_url;
                            const imgSrc = colorImg || item.product?.image_url;

                            return (
                              <div key={item.id} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                                {imgSrc && (
                                  <img
                                    src={imgSrc}
                                    alt=""
                                    className="h-10 w-10 shrink-0 rounded-lg object-cover border border-chumbo-800"
                                  />
                                )}
                                <div className="min-w-0 flex-1">
                                  <h5 className="truncate font-semibold text-white text-xs">
                                    {item.product?.title || `Produto #${item.product_id}`}
                                  </h5>
                                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                                    <span className="flex items-center gap-1 text-slate-300">
                                      <Layers className="h-3 w-3 text-laser-400" />
                                      {item.color}
                                    </span>
                                    <span>·</span>
                                    <span>Qtd: {item.quantity}</span>
                                  </div>
                                </div>
                                <span className="font-mono font-bold text-xs text-slate-200">
                                  {money(item.unit_price * item.quantity)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="rounded-xl border border-chumbo-800 bg-chumbo-950/60 p-3 space-y-2.5">
                      <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Entrega & Rastreamento
                      </span>

                      <div className="space-y-1.5 text-slate-300 text-xs">
                        <div className="flex items-start gap-2">
                          <MapPin className="h-3.5 w-3.5 text-laser-400 shrink-0 mt-0.5" />
                          <div>
                            <strong>
                              {order.delivery_method === 'pickup' ? 'Retirada no Balcão' : 'Entrega no Endereço'}
                            </strong>
                            <p className="text-slate-400 text-[11px] mt-0.5">
                              {order.recipient_name && <span>{order.recipient_name} · </span>}
                              {order.recipient_phone && <span>{order.recipient_phone}</span>}
                            </p>
                            {order.delivery_method !== 'pickup' && order.shipping_address && (
                              <p className="text-slate-400 text-[11px] mt-0.5">
                                {order.shipping_address}
                                {order.city ? `, ${order.city} - ${order.state || ''}` : ''}
                                {order.zip_code ? ` (CEP: ${order.zip_code})` : ''}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {latestShipment ? (
                        <div className="rounded-xl border border-laser-500/20 bg-laser-950/10 p-3 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Truck className="h-4 w-4 text-laser-400" />
                              <span className="font-mono font-bold text-xs text-white">
                                {latestShipment.tracking_code}
                              </span>
                            </div>
                            <span className="rounded bg-laser-500/20 px-2 py-0.5 text-[10px] font-bold text-laser-300 uppercase">
                              {latestShipment.status}
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => copyTracking(latestShipment.tracking_code)}
                              className="inline-flex items-center gap-1 rounded-lg border border-chumbo-700 bg-chumbo-900 px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:bg-chumbo-800 transition"
                            >
                              {copiedTrackingId === latestShipment.tracking_code ? (
                                <>
                                  <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                                  <span>Copiado!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3" />
                                  <span>Copiar código</span>
                                </>
                              )}
                            </button>

                            <a
                              href={getTrackingUrl(latestShipment.tracking_code)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg bg-laser-500/20 border border-laser-500/40 px-2.5 py-1 text-[11px] font-bold text-laser-300 hover:bg-laser-500/30 transition"
                            >
                              <span>Rastrear no site</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>

                          {latestEvent && (
                            <div className="mt-2 pt-2 border-t border-laser-500/10 text-[11px] text-slate-400">
                              <p className="font-semibold text-slate-200">{latestEvent.description}</p>
                              {latestEvent.location && <p className="text-slate-500">{latestEvent.location}</p>}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 rounded-xl border border-chumbo-800 bg-chumbo-900/40 p-2.5 text-xs text-slate-500">
                          <Truck className="h-3.5 w-3.5 text-slate-600" />
                          <span>
                            {order.delivery_method === 'pickup'
                              ? 'Pronto para retirada assim que a impressão for finalizada.'
                              : 'O código de rastreamento será informado aqui assim que o pacote for postado.'}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="rounded-xl border border-chumbo-800 bg-chumbo-950/60 p-3 space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Forma de Pagamento:</span>
                        <span className="font-semibold text-white">
                          {formatPaymentMethodLabel(order.payment_method)}
                        </span>
                      </div>
                      {order.paid_at && (
                        <div className="flex justify-between">
                          <span className="text-slate-400">Pago em:</span>
                          <span className="text-slate-300">
                            {new Date(order.paid_at).toLocaleString('pt-BR')}
                          </span>
                        </div>
                      )}
                      {order.payment_id && (
                        <div className="flex justify-between">
                          <span className="text-slate-400">ID da Transação:</span>
                          <span className="font-mono text-slate-400 text-[11px]">#{order.payment_id}</span>
                        </div>
                      )}
                      <div className="flex justify-between pt-1 border-t border-chumbo-800 font-bold">
                        <span className="text-slate-300">Total Pago:</span>
                        <span className="text-laser-400 font-mono">{money(order.total_amount)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
