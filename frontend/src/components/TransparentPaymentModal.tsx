import React, { useEffect, useState } from 'react';
import { CheckCircle2, Clock, Copy, ExternalLink, Loader2, QrCode, ShieldCheck, Sparkles, X } from 'lucide-react';
import { CreateOrderResponse, Order } from '../types';
import { api } from '../services/api';

interface Props {
  orderResponse: CreateOrderResponse;
  tenantId?: number;
  token?: string;
  onClose: () => void;
  onPaymentSuccess?: (order: Order) => void;
}

export const TransparentPaymentModal: React.FC<Props> = ({
  orderResponse,
  tenantId,
  token,
  onClose,
  onPaymentSuccess,
}) => {
  const { order, payment } = orderResponse;
  const rawMethod = (payment?.payment_method || order.payment_method || '').toLowerCase().trim();
  const hasPixData = Boolean(payment?.pix_qr_code || order.pix_qr_code || payment?.pix_qr_code_base64 || order.pix_qr_code_base64);
  const isPix = rawMethod === 'pix' || hasPixData;
  const isApprovedInitial = order.payment_status === 'paid' || order.status === 'confirmed';

  const [copied, setCopied] = useState(false);
  const [isPaid, setIsPaid] = useState(isApprovedInitial);
  const [isPolling, setIsPolling] = useState(!isApprovedInitial);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(30 * 60); // 30 minutos padrão

  const pixCode = payment?.pix_qr_code || order.pix_qr_code || '';
  const pixExpiration = payment?.pix_expiration || order.pix_expiration;
  const ticketUrl = payment?.ticket_url || payment?.checkout_url || order.mp_init_point;
  const effectiveTenantId = tenantId || order.tenant_id;

  // Timer regressivo do PIX
  useEffect(() => {
    if (isPaid || !isPix) return;

    if (pixExpiration) {
      const expTime = new Date(pixExpiration).getTime();
      const diffSecs = Math.max(0, Math.floor((expTime - Date.now()) / 1000));
      setTimeLeftSeconds(diffSecs > 0 ? diffSecs : 30 * 60);
    }

    const interval = setInterval(() => {
      setTimeLeftSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [pixExpiration, isPaid, isPix]);

  // Polling automático para detecção instantânea do pagamento
  useEffect(() => {
    if (isPaid) return;

    let isMounted = true;
    const pollInterval = setInterval(async () => {
      try {
        const status = await api.getOrderPaymentStatus(order.id, effectiveTenantId, token);
        const isConfirmed = status.is_paid ||
          status.payment_status === 'paid' ||
          status.payment_status === 'approved' ||
          status.payment_status === 'accredited' ||
          status.status === 'confirmed' ||
          status.status === 'paid' ||
          !!status.paid_at;

        if (isMounted && isConfirmed) {
          setIsPaid(true);
          setIsPolling(false);
          clearInterval(pollInterval);
          if (onPaymentSuccess) {
            onPaymentSuccess({
              ...order,
              status: status.status || 'paid',
              payment_status: status.payment_status || 'approved',
              paid_at: status.paid_at || new Date().toISOString(),
            });
          }
        }
      } catch {
        // Ignora erros transitórios de rede no polling
      }
    }, 2500);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
    };
  }, [order.id, effectiveTenantId, token, isPaid, onPaymentSuccess, order]);

  const copyPixCode = () => {
    if (!pixCode) return;
    navigator.clipboard.writeText(pixCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const formatTime = (secs: number) => {
    const minutes = Math.floor(secs / 60);
    const seconds = secs % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const base64Code = payment?.pix_qr_code_base64 || order.pix_qr_code_base64;
  const qrCodeImageSrc = base64Code
    ? base64Code.startsWith('data:')
      ? base64Code
      : `data:image/png;base64,${base64Code}`
    : pixCode
      ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(pixCode)}`
      : '';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg rounded-3xl border border-chumbo-800 bg-chumbo-950 p-6 shadow-2xl md:p-8">
        {/* Botão de Fechar */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 text-slate-400 hover:bg-chumbo-900 hover:text-white transition"
          aria-label="Fechar modal de pagamento"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Estado 1: Pagamento Aprovado com Sucesso */}
        {isPaid ? (
          <div className="space-y-6 text-center py-4">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 ring-8 ring-emerald-500/10">
              <CheckCircle2 className="h-12 w-12" />
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 px-3 py-1 text-xs font-bold text-emerald-300">
                <Sparkles className="h-3.5 w-3.5" /> Pagamento Confirmado
              </div>
              <h3 className="mt-2 text-2xl font-black text-white">Pedido #{order.id} Aprovado!</h3>
              <p className="mt-1 text-xs text-slate-400">
                O pagamento de <strong className="text-white">R$ {order.total_amount.toFixed(2).replace('.', ',')}</strong> foi recebido com sucesso via Mercado Pago.
              </p>
            </div>

            <div className="rounded-2xl border border-chumbo-800 bg-chumbo-900/60 p-4 text-left text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Número do Pedido:</span>
                <span className="font-mono font-bold text-white">#{order.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Destinatário:</span>
                <span className="text-white">{order.recipient_name || 'Cliente'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Forma de Pagamento:</span>
                <span className="font-semibold text-emerald-400">{isPix ? 'PIX Instantâneo' : 'Cartão de Crédito'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Status da Produção:</span>
                <span className="font-semibold text-laser-400">Encaminhado para Impressão 3D</span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full rounded-2xl bg-laser-500 py-3 text-sm font-bold text-chumbo-950 hover:bg-laser-400 transition"
            >
              Concluir e Voltar para a Loja
            </button>
          </div>
        ) : isPix ? (
          /* Estado 2: PIX Instantâneo Transparente */
          <div className="space-y-5">
            <div className="text-center">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-teal-950/60 border border-teal-500/30 px-3 py-1 text-xs font-bold text-teal-400">
                <QrCode className="h-3.5 w-3.5" /> Pagamento com PIX
              </div>
              <h3 className="mt-2 text-xl font-bold text-white">
                Total: R$ {order.total_amount.toFixed(2).replace('.', ',')}
              </h3>
              <p className="mt-0.5 text-xs text-slate-400">
                Abra o app do seu banco e escaneie o QR Code ou copie a chave abaixo.
              </p>
            </div>

            {/* QR Code Container */}
            {qrCodeImageSrc ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-chumbo-800 bg-chumbo-900/40 p-5">
                <div className="rounded-xl bg-white p-3 shadow-lg">
                  <img
                    src={qrCodeImageSrc}
                    alt="QR Code PIX"
                    className="h-48 w-48 object-contain"
                  />
                </div>

                {/* Timer */}
                <div className="mt-3 flex items-center gap-1.5 text-xs font-mono text-amber-400">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Expira em: <strong>{formatTime(timeLeftSeconds)}</strong></span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-chumbo-800 bg-chumbo-900/40 p-6 text-center space-y-3">
                <Loader2 className="h-8 w-8 animate-spin text-teal-400" />
                <p className="text-xs text-slate-300">Gerando chave PIX com o banco emissor...</p>
                {ticketUrl && (
                  <a
                    href={ticketUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-teal-500/20 border border-teal-500/40 px-3.5 py-2 text-xs font-bold text-teal-300 hover:bg-teal-500/30 transition"
                  >
                    <span>Abrir comprovante no Mercado Pago</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            )}

            {/* Botão Copia e Cola */}
            {pixCode && (
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Código PIX Copia e Cola
                </label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    readOnly
                    value={pixCode}
                    className="w-full rounded-xl border border-chumbo-800 bg-chumbo-900/80 px-3.5 py-2.5 pr-28 font-mono text-xs text-slate-300 select-all focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={copyPixCode}
                    className={`absolute right-1.5 flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                      copied
                        ? 'bg-emerald-500 text-chumbo-950'
                        : 'bg-white text-chumbo-950 hover:bg-slate-200'
                    }`}
                  >
                    {copied ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5" /> Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" /> Copiar
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Resumo do Pedido */}
            <div className="rounded-2xl border border-chumbo-800 bg-chumbo-900/60 p-3.5 text-left text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Número do Pedido:</span>
                <span className="font-mono font-bold text-white">#{order.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Destinatário:</span>
                <span className="text-white">{order.recipient_name || 'Cliente'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Forma de Pagamento:</span>
                <span className="font-semibold text-teal-300">PIX Instantâneo</span>
              </div>
            </div>

            {/* Status em Tempo Real */}
            <div className="flex items-center justify-center gap-2 rounded-xl border border-chumbo-800/80 bg-chumbo-900/40 py-2.5 text-xs text-slate-400">
              {isPolling && <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-400" />}
              <span>Aguardando confirmação bancária do PIX...</span>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 border-t border-chumbo-800/60 pt-3">
              <span className="flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> Pagamento 100% Seguro
              </span>
              <span>Mercado Pago Checkout Transparente</span>
            </div>
          </div>
        ) : (
          /* Estado 3: Pagamento Cartão em Processamento / Análise */
          <div className="space-y-6 text-center py-4">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-blue-500/20 text-blue-400 ring-8 ring-blue-500/10">
              <Clock className="h-10 w-10 animate-pulse" />
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-950/80 border border-blue-500/40 px-3 py-1 text-xs font-bold text-blue-300">
                <ShieldCheck className="h-3.5 w-3.5" /> Pagamento com Cartão
              </div>
              <h3 className="mt-2 text-2xl font-black text-white">Processando Pedido #{order.id}</h3>
              <p className="mt-1 text-xs text-slate-400">
                Estamos validando a transação de <strong className="text-white">R$ {order.total_amount.toFixed(2).replace('.', ',')}</strong> com o banco emissor.
              </p>
            </div>

            <div className="rounded-2xl border border-chumbo-800 bg-chumbo-900/60 p-4 text-left text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Número do Pedido:</span>
                <span className="font-mono font-bold text-white">#{order.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Destinatário:</span>
                <span className="text-white">{order.recipient_name || 'Cliente'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Forma de Pagamento:</span>
                <span className="font-semibold text-slate-200">Cartão de Crédito</span>
              </div>
            </div>

            {/* Status em Tempo Real */}
            <div className="flex items-center justify-center gap-2 rounded-xl border border-chumbo-800/80 bg-chumbo-900/40 py-2.5 text-xs text-slate-400">
              {isPolling && <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" />}
              <span>Aguardando resposta do banco emissor...</span>
            </div>

            <button
              onClick={onClose}
              className="w-full rounded-2xl bg-chumbo-800 py-3 text-sm font-bold text-white hover:bg-chumbo-700 transition"
            >
              Acompanhar em Meus Pedidos
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
