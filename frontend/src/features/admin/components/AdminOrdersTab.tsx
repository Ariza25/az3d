import React from 'react';
import { Order, OrderShipment } from '../../../types';
import { RefreshCw } from 'lucide-react';

export interface AdminOrdersTabProps {
  orders: Order[];
  shipments: OrderShipment[];
  shipmentForm: { order_id: number; carrier: string; tracking_code: string };
  syncingShipmentId: string | number | null;
  setShipmentForm: React.Dispatch<React.SetStateAction<{ order_id: number; carrier: string; tracking_code: string }>>;
  onSaveShipment: (e: React.FormEvent) => void;
  onSyncAllTracking: () => void;
  onStatusChange: (orderId: number, status: string) => void;
}

export const AdminOrdersTab: React.FC<AdminOrdersTabProps> = ({
  orders,
  shipments,
  shipmentForm,
  syncingShipmentId,
  setShipmentForm,
  onSaveShipment,
  onSyncAllTracking,
  onStatusChange,
}) => {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-white">Gerenciamento de vendas e pedidos</h3>
      
      <form onSubmit={onSaveShipment} className="rounded-2xl border border-chumbo-800 bg-chumbo-950/60 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="flex-1 space-y-1.5">
            <label className="text-xs font-mono uppercase text-slate-400">Pedido</label>
            <select
              value={shipmentForm.order_id || ''}
              onChange={(event) =>
                setShipmentForm((prev) => ({ ...prev, order_id: Number(event.target.value) || 0 }))
              }
              className="w-full rounded-xl border border-chumbo-800 bg-chumbo-950 px-3 py-2 text-xs text-white"
            >
              <option value="">Selecione</option>
              {orders.map((order) => (
                <option key={order.id} value={order.id}>
                  Pedido #{order.id} - R$ {order.total_amount.toFixed(2).replace('.', ',')}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-mono uppercase text-slate-400">Transportadora</label>
            <select
              value={shipmentForm.carrier}
              onChange={(event) =>
                setShipmentForm((prev) => ({ ...prev, carrier: event.target.value }))
              }
              className="w-full rounded-xl border border-chumbo-800 bg-chumbo-950 px-3 py-2 text-xs text-white"
            >
              <option value="superfrete">SuperFrete (Correios)</option>
            </select>
          </div>
          <div className="flex-1 space-y-1.5">
            <label className="text-xs font-mono uppercase text-slate-400">Codigo de rastreio</label>
            <input
              value={shipmentForm.tracking_code}
              onChange={(event) =>
                setShipmentForm((prev) => ({ ...prev, tracking_code: event.target.value.toUpperCase() }))
              }
              placeholder="AA123456789BR"
              className="w-full rounded-xl border border-chumbo-800 bg-chumbo-950 px-3 py-2 text-xs text-white"
            />
          </div>
          <button type="submit" className="rounded-xl bg-white px-4 py-2 text-xs font-bold text-chumbo-950 hover:bg-slate-200">
            Vincular envio
          </button>
          <button
            type="button"
            onClick={onSyncAllTracking}
            disabled={syncingShipmentId === 'all' || shipments.length === 0}
            className="flex items-center justify-center gap-2 rounded-xl border border-chumbo-700 bg-chumbo-900 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-chumbo-800 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${syncingShipmentId === 'all' ? 'animate-spin' : ''}`} />
            Sincronizar
          </button>
        </div>
      </form>

      <div className="rounded-2xl border border-chumbo-800 overflow-hidden bg-chumbo-950/60">
        <table className="w-full text-left text-xs">
          <thead className="bg-chumbo-950 text-slate-400 font-mono uppercase text-[10px]">
            <tr>
              <th className="p-3">Pedido</th>
              <th className="p-3">Comprador</th>
              <th className="p-3">Itens</th>
              <th className="p-3">Valor Total</th>
              <th className="p-3">Status</th>
              <th className="p-3">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-chumbo-850 text-slate-300">
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-chumbo-850/50 transition-colors">
                <td className="p-3 font-mono font-bold text-white">
                  #{o.id}
                  <span className="text-[10px] text-slate-500 block">
                    {new Date(o.created_at).toLocaleDateString('pt-BR')}
                  </span>
                </td>
                <td className="p-3">
                  <span className="text-white font-semibold block">
                    {o.user?.name || `Usuário #${o.user_id}`}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {o.shipping_address || 'Endereço padrão'}
                  </span>
                </td>
                <td className="p-3">
                  <span className="bg-chumbo-800 text-slate-300 px-2 py-0.5 rounded-md font-mono text-[11px]">
                    {o.items?.length || 0} itens
                  </span>
                </td>
                <td className="p-3 font-bold text-white">
                  R$ {o.total_amount.toFixed(2).replace('.', ',')}
                </td>
                <td className="p-3">
                  <select
                    value={o.status}
                    onChange={(e) => onStatusChange(o.id, e.target.value)}
                    className={`bg-chumbo-950 border border-chumbo-700 text-xs font-mono font-bold rounded-lg px-2 py-1 focus:outline-none ${
                      o.status === 'preparing' || o.status === 'paid'
                        ? 'text-amber-400'
                        : o.status === 'delivered'
                        ? 'text-emerald-400'
                        : 'text-slate-300'
                    }`}
                  >
                    <option value="pending_confirmation">Aguardando confirmacao</option>
                    <option value="pending_payment">Aguardando pagamento</option>
                    <option value="paid">Pago</option>
                    <option value="preparing">Em preparo</option>
                    <option value="delivered">Concluido</option>
                    <option value="cancelled">Cancelado</option>
                  </select>
                </td>
                <td className="p-3">
                  <span className="text-[11px] text-slate-400 font-mono">OK</span>
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-400 font-mono text-xs">
                  Nenhum pedido realizado neste tenant.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
