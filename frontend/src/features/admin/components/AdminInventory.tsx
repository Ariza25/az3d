import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Product, StockAlert, StockMovement } from '../../../types';
import { Button, Card, EmptyState, Input, SectionHeader, Select } from '../../../components/ui';

interface StockAdjustmentState {
  product_id: number;
  color_name: string;
  stock_qty: number;
  reason: string;
}

interface LowStockItem {
  product: Product;
  color: string;
  qty: number;
  severity: string;
  alert: StockAlert | null;
}

interface AdminInventoryProps {
  products: Product[];
  lowStockItems: LowStockItem[];
  stockAdjustment: StockAdjustmentState;
  stockAdjustmentProduct?: Product;
  stockMovementProductId: number | '';
  filteredStockMovements: StockMovement[];
  onStockAdjustmentChange: React.Dispatch<React.SetStateAction<StockAdjustmentState>>;
  onStockMovementProductChange: (productId: number | '') => void;
  onAdjustStock: (event: React.FormEvent) => void;
  onPrepareRestock: (alert: StockAlert) => void;
}

export const AdminInventory: React.FC<AdminInventoryProps> = ({
  products,
  lowStockItems,
  stockAdjustment,
  stockAdjustmentProduct,
  stockMovementProductId,
  filteredStockMovements,
  onStockAdjustmentChange,
  onStockMovementProductChange,
  onAdjustStock,
  onPrepareRestock,
}) => (
  <div className="space-y-5">
    <SectionHeader
      title="Controle de estoque"
      description="Saldos atuais, alertas de reposicao e historico de movimentacoes."
      action={
        <span className="rounded-xl border border-chumbo-800 bg-chumbo-950 px-3 py-2 text-xs font-mono text-slate-300">
          {lowStockItems.length} alerta(s) de baixo estoque
        </span>
      }
    />

    <Card asForm onSubmit={onAdjustStock}>
      <h4 className="text-sm font-bold text-white">Ajuste rapido</h4>
      <div className="mt-3 grid gap-3 md:grid-cols-[1.2fr_1fr_120px_1fr_auto]">
        <Select
          value={stockAdjustment.product_id || stockAdjustmentProduct?.id || ''}
          onChange={(event) => {
            const productId = Number(event.target.value);
            const product = products.find((item) => item.id === productId);
            onStockAdjustmentChange((prev) => ({
              ...prev,
              product_id: productId,
              color_name: product?.color_stocks?.[0]?.color_name || '',
              stock_qty: product?.color_stocks?.[0]?.stock_qty ?? product?.stock_qty ?? 0,
            }));
          }}
        >
          {products.map((product) => (
            <option key={product.id} value={product.id}>{product.title}</option>
          ))}
        </Select>
        <Select
          value={stockAdjustment.color_name}
          onChange={(event) => {
            const colorName = event.target.value;
            const stock = stockAdjustmentProduct?.color_stocks?.find((item) => item.color_name === colorName);
            onStockAdjustmentChange((prev) => ({ ...prev, color_name: colorName, stock_qty: stock?.stock_qty ?? stockAdjustmentProduct?.stock_qty ?? 0 }));
          }}
        >
          <option value="">Estoque geral</option>
          {stockAdjustmentProduct?.color_stocks?.map((stock) => (
            <option key={stock.color_name} value={stock.color_name}>{stock.color_name}</option>
          ))}
        </Select>
        <Input
          type="number"
          min={0}
          value={stockAdjustment.stock_qty}
          onChange={(event) => onStockAdjustmentChange((prev) => ({ ...prev, stock_qty: Number(event.target.value) || 0 }))}
        />
        <Input
          value={stockAdjustment.reason}
          onChange={(event) => onStockAdjustmentChange((prev) => ({ ...prev, reason: event.target.value }))}
          placeholder="Motivo"
        />
        <Button type="submit" variant="primary">Ajustar</Button>
      </div>
    </Card>

    <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
      <Card>
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-sm font-bold text-white">Alertas</h4>
          <AlertTriangle className={lowStockItems.length ? 'h-4 w-4 text-amber-300' : 'h-4 w-4 text-slate-600'} />
        </div>
        <div className="mt-3 space-y-2">
          {lowStockItems.map(({ product, color, qty, severity, alert }) => (
            <div
              key={`${product.id}-${color || 'base'}`}
              className={`flex items-center justify-between gap-3 rounded-xl border p-3 text-xs ${
                severity === 'out' ? 'border-rose-500/30 bg-rose-500/10' : 'border-amber-500/20 bg-amber-500/10'
              }`}
            >
              <div className="min-w-0">
                <strong className="block truncate text-white">{product.title}</strong>
                <span className="text-slate-400">{color || 'Estoque geral'} - SKU {product.sku || '-'}</span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className={severity === 'out' ? 'rounded-lg bg-rose-400 px-2 py-1 font-mono font-bold text-chumbo-950' : 'rounded-lg bg-amber-400 px-2 py-1 font-mono font-bold text-chumbo-950'}>
                  {qty} un
                </span>
                {alert && (
                  <Button type="button" variant="secondary" size="sm" onClick={() => onPrepareRestock(alert)}>
                    Repor
                  </Button>
                )}
              </div>
            </div>
          ))}
          {lowStockItems.length === 0 && <EmptyState message="Nenhum produto abaixo do limite de alerta." />}
        </div>
      </Card>

      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h4 className="text-sm font-bold text-white">Ultimas movimentacoes</h4>
          <Select
            value={stockMovementProductId}
            onChange={(event) => onStockMovementProductChange(event.target.value ? Number(event.target.value) : '')}
            className="sm:w-64"
          >
            <option value="">Todos os produtos</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>{product.title}</option>
            ))}
          </Select>
        </div>
        <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
          {filteredStockMovements.map((movement) => (
            <div key={movement.id} className="rounded-xl border border-chumbo-800 bg-chumbo-900/60 p-3 text-xs">
              <div className="flex items-center justify-between gap-3">
                <strong className="min-w-0 truncate text-white">{movement.product?.title || `Produto #${movement.product_id}`}</strong>
                <span className={movement.quantity_delta < 0 ? 'font-mono font-bold text-rose-300' : 'font-mono font-bold text-emerald-300'}>
                  {movement.quantity_delta > 0 ? '+' : ''}{movement.quantity_delta}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-2 text-slate-400">
                <span>{movement.color_name || 'geral'}</span>
                <span>saldo {movement.quantity_after}</span>
                <span>{new Date(movement.created_at).toLocaleString('pt-BR')}</span>
              </div>
              {movement.reason && <p className="mt-1 text-slate-500">{movement.reason}</p>}
            </div>
          ))}
          {filteredStockMovements.length === 0 && <EmptyState message="Nenhuma movimentacao registrada ainda." />}
        </div>
      </Card>
    </div>
  </div>
);
