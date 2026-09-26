import React, { useState } from 'react';
import { Order, OrderFilamentCheckResult, FilamentSpool } from '../../../types';
import {
  Package,
  AlertCircle,
} from 'lucide-react';
import { api } from '../../../services/api';
import {
  FilamentPreFlightModal,
  PipelineHeader,
  PipelineOrderCard,
  PipelineStagesSummary,
  resolveOrderStageId,
} from './orders-pipeline';

export { STAGES, resolveOrderStageId } from './orders-pipeline';

interface TenantOrdersPipelinePanelProps {
  orders: Order[];
  onRefreshOrders: () => void;
  tenantId?: number;
}

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
      checkData.items.forEach((item: any) => {
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
      <PipelineHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onRefresh={onRefreshOrders}
      />

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
      <PipelineStagesSummary
        orders={orders}
        filterStatus={filterStatus}
        onSelectStage={setFilterStatus}
      />

      {/* Orders List / Pipeline Cards */}
      {filteredOrders.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500 shadow-sm dark:border-chumbo-800 dark:bg-chumbo-900/40 dark:text-slate-400">
          <Package className="mx-auto h-10 w-10 text-slate-400 mb-2" />
          <p className="font-semibold text-slate-900 dark:text-white">Nenhum pedido encontrado nesta etapa</p>
          <p className="mt-1 text-xs">Ajuste os filtros ou aguarde novas vendas na loja.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => (
            <PipelineOrderCard
              key={order.id}
              order={order}
              updatingOrderId={updatingOrderId}
              onAdvanceStatus={handleAdvanceStatus}
            />
          ))}
        </div>
      )}

      {/* Modal de Pré-Voo de Filamento (Filament Pre-flight Check) */}
      {checkingOrder && (
        <FilamentPreFlightModal
          order={checkingOrder}
          isChecking={isCheckingFilament}
          isStarting={isStartingProduction}
          filamentCheckResult={filamentCheckResult}
          availableSpools={availableSpools}
          selectedSpoolMap={selectedSpoolMap}
          onSelectSpool={(orderItemId, spoolId) =>
            setSelectedSpoolMap((prev) => ({
              ...prev,
              [orderItemId]: spoolId,
            }))
          }
          autoDeduct={autoDeduct}
          onToggleAutoDeduct={setAutoDeduct}
          onConfirm={handleConfirmStartProduction}
          onClose={() => setCheckingOrder(null)}
        />
      )}
    </div>
  );
};
