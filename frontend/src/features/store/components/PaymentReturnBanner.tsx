import React from 'react';
import { AlertCircle, CheckCircle2, Clock3, X } from 'lucide-react';

interface PaymentReturnBannerProps {
  status: string;
  orderId: string;
  onOpenOrders: () => void;
  onClose: () => void;
}

export const PaymentReturnBanner: React.FC<PaymentReturnBannerProps> = ({
  status,
  orderId,
  onOpenOrders,
  onClose,
}) => {
  const content =
    status === 'success'
      ? {
          icon: <CheckCircle2 className="h-5 w-5 text-emerald-300" />,
          title: 'Pagamento aprovado',
          text: 'Recebemos a confirmação do Mercado Pago. O pedido já pode seguir para preparação.',
          tone: 'border-emerald-500/40 bg-emerald-500/10',
        }
      : status === 'pending'
      ? {
          icon: <Clock3 className="h-5 w-5 text-amber-300" />,
          title: 'Pagamento pendente',
          text: 'O Mercado Pago ainda está processando o pagamento. O pedido será atualizado quando houver confirmação.',
          tone: 'border-amber-500/40 bg-amber-500/10',
        }
      : {
          icon: <AlertCircle className="h-5 w-5 text-red-300" />,
          title: 'Pagamento não concluído',
          text: 'O pagamento não foi aprovado ou foi cancelado. Você pode tentar novamente pelo carrinho.',
          tone: 'border-red-500/40 bg-red-500/10',
        };

  return (
    <div className={`border-b ${content.tone}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {content.icon}
          <div>
            <p className="text-sm font-bold text-white">
              {content.title}
              {orderId ? ` - Pedido #${orderId}` : ''}
            </p>
            <p className="text-xs text-slate-300">{content.text}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenOrders}
            className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-chumbo-950 hover:bg-slate-200"
          >
            Ver meus pedidos
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-chumbo-900 hover:text-white"
            aria-label="Fechar aviso"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
