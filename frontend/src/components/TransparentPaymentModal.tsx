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
  const isPix = payment?.payment_method === 'pix' || !!payment?.pix_qr_code;
  const isApprovedInitial = order.payment_status === 'paid' || order.status === 'confirmed';

  const [copied, setCopied] = useState(false);
  const [isPaid, setIsPaid] = useState(isApprovedInitial);
  const [isPolling, setIsPolling] = useState(!isApprovedInitial);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(30 * 60); // 30 minutos padrão

  // Timer regressivo do PIX
  useEffect(() => {
    if (isPaid || !isPix) return;

    if (payment?.pix_expiration) {
      const expTime = new Date(payment.pix_expiration).getTime();
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
  }, [payment?.pix_expiration, isPaid, isPix]);

  // Polling automático para detecção instantânea do pagamento
  useEffect(() => {
    if (isPaid) return;

    let isMounted = true;
    const pollInterval = setInterval(async () => {
      try {
        const status = await api.getOrderPaymentStatus(order.id, tenantId, token);
        if (isMounted && (status.is_paid || status.payment_status === 'paid' || status.status === 'confirmed')) {
          setIsPaid(true);
          setIsPolling(false);
          clearInterval(pollInterval);
          if (onPaymentSuccess) {
            onPaymentSuccess({
              ...order,
              status: 'confirmed',
              payment_status: 'paid',
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
  }, [order.id, tenantId, token, isPaid, onPaymentSuccess, order]);

  const copyPixCode = () => {
    if (!payment?.pix_qr_code) return;
    navigator.clipboard.writeText(payment.pix_qr_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const formatTime = (secs: number) => {
    const minutes = Math.floor(secs / 60);
    const seconds = secs % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const qrCodeImageSrc = payment?.pix_qr_code_base64
    ? payment.pix_qr_code_base64.startsWith('data:')
      ? payment.pix_qr_code_base64
      : `data:image/png;base64,${payment.pix_qr_code_base64}`
    : `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(payment?.pix_qr_code || '')}`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg rounded-3xl border border-chumbo-800 bg-chumbo-950 p-6 shadow-2xl md:p-8">
        {/* Botão de Fechar */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 text-slate-400 hover:bg-chumbo-900 hover:text-white"
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
                <span className="text-white">{order.recipient_name}</span>
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
                <QrCode className="h-3.5 w-3.5" /> Pague com PIX Instantâneo
              </div>
              <h3 className="mt-2 text-xl font-bold text-white">
                Total: R$ {order.total_amount.toFixed(2).replace('.', ',')}
              </h3>
              <p className="mt-0.5 text-xs text-slate-400">
                Abra o app do seu banco e escaneie o QR Code ou copie o código.
              </p>
            </div>

            {/* QR Code Container */}
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

            {/* Botão Copia e Cola */}
            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Código PIX Copia e Cola
              </label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  readOnly
                  value={payment?.pix_qr_code || ''}
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

            {/* Status em Tempo Real */}
            <div className="flex items-center justify-center gap-2 rounded-xl border border-chumbo-800/80 bg-chumbo-900/40 py-2.5 text-xs text-slate-400">
              {isPolling && <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-400" />}
              <span>Aguardando confirmação bancária...</span>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 border-t border-chumbo-800/60 pt-3">
              <span className="flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> Pagamento 100% Seguro
              </span>
              <span>Mercado Pago Checkout Transparente</span>
            </div>
          </div>
        ) : (
          /* Estado 3: Checkout Pro Modal / Redirect Fallback */
          <div className="space-y-5 text-center py-2">
            <h3 className="text-xl font-bold text-white">Finalizar Pagamento</h3>
            <p className="text-xs text-slate-400">
              Pedido #{order.id} registrado no valor de <strong className="text-white">R$ {order.total_amount.toFixed(2).replace('.', ',')}</strong>.
            </p>

            {payment?.checkout_url && (
              <a
                href={payment.checkout_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-laser-500 py-3 text-sm font-bold text-chumbo-950 hover:bg-laser-400"
              >
                <ExternalLink className="h-4 w-4" /> Abrir Checkout Mercado Pago
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
