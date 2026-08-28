import React from 'react';
import { Order, Product } from '../../../types';
import { Card, EmptyState, StatCard } from '../../../components/ui';

interface AdminDashboardProps {
  orders: Order[];
  products: Product[];
  revenue: number;
  pendingOrders: number;
  activeProducts: number;
  lowStockProducts: number;
  orderStatusLabels: Record<string, string>;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  orders,
  products,
  revenue,
  pendingOrders,
  activeProducts,
  lowStockProducts,
  orderStatusLabels,
}) => {
  const productsToReview = products.filter((product) => product.status !== 'active' || product.stock_qty <= 3).slice(0, 5);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Faturamento" value={`R$ ${revenue.toFixed(2).replace('.', ',')}`} />
        <StatCard label="Pedidos abertos" value={pendingOrders} />
        <StatCard label="Produtos ativos" value={activeProducts} />
        <StatCard label="Baixo estoque" value={lowStockProducts} tone={lowStockProducts > 0 ? 'warning' : 'default'} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h3 className="text-sm font-bold text-white">Pedidos recentes</h3>
          <div className="mt-3 space-y-2">
            {orders.slice(0, 5).map((order) => (
              <div key={order.id} className="flex items-center justify-between rounded-xl border border-chumbo-800 bg-chumbo-900/60 p-3 text-xs">
                <span className="font-mono text-slate-300">#{order.id} - {orderStatusLabels[order.status] || order.status}</span>
                <strong className="text-white">R$ {order.total_amount.toFixed(2).replace('.', ',')}</strong>
              </div>
            ))}
            {orders.length === 0 && <EmptyState message="Nenhum pedido registrado." />}
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-bold text-white">Produtos para revisar</h3>
          <div className="mt-3 space-y-2">
            {productsToReview.map((product) => (
              <div key={product.id} className="flex items-center justify-between rounded-xl border border-chumbo-800 bg-chumbo-900/60 p-3 text-xs">
                <span className="truncate text-slate-300">{product.title}</span>
                <span className="font-mono text-slate-500">{product.status} / {product.stock_qty} un</span>
              </div>
            ))}
            {productsToReview.length === 0 && <EmptyState message="Sem alertas de produto." />}
          </div>
        </Card>
      </div>
    </div>
  );
};
