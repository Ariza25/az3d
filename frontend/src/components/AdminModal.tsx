import React, { useState, useEffect } from 'react';
import {
  Product,
  Category,
  Order,
  Tenant,
  ProductInput,
  StockMovement,
  TenantCarrierAccount,
  OrderShipment,
  StockAlert,
  MarketplaceProductMapping,
} from '../types';
import { api } from '../services/api';
import { Modal, Tabs, TabItem } from './ui';
import { ProductFormModal } from './ProductFormModal';
import { PricingCalculator } from './PricingCalculator';
import { PricingManagementPanel } from './PricingManagementPanel';
import { ProductionCostsPanel } from './ProductionCostsPanel';
import { FinancePanel } from './FinancePanel';
import { MarketplaceConnectionsPanel } from './MarketplaceConnectionsPanel';
import { CarrierSettingsPanel } from './CarrierSettingsPanel';
import { MarketplaceIntelligencePanel } from './MarketplaceIntelligencePanel';
import { AdminDashboard } from '../features/admin/components/AdminDashboard';
import { AdminInventory } from '../features/admin/components/AdminInventory';
import { MercadoPagoSettings } from '../features/admin/components/MercadoPagoSettings';
import { TenantOrdersPipelinePanel } from '../features/admin/components/TenantOrdersPipelinePanel';
import { TenantFilamentInventoryPanel } from '../features/admin/components/TenantFilamentInventoryPanel';
import { AdminProductsTab } from '../features/admin/components/AdminProductsTab';
import { AdminOrdersTab } from '../features/admin/components/AdminOrdersTab';
import { ImageConverterTab } from '../features/admin/components/ImageConverterTab';
import {
  Package,
  Store,
  ShoppingBag,
  Calculator,
  Settings,
  BarChart3,
  TrendingUp,
  Clock,
  Layers,
  ShoppingCart,
  AlertCircle,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending_confirmation: 'Aguardando confirmacao',
  pending_payment: 'Aguardando pagamento',
  paid: 'Pago',
  preparing: 'Em preparo',
  delivered: 'Concluido',
  cancelled: 'Cancelado',
  pending: 'Pendente',
  printing: 'Em preparo',
};

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  variant?: 'modal' | 'page';
  activeTenant: Tenant | null;
  categories: Category[];
  onRefreshProducts: () => void;
}

type AdminSection =
  | 'dashboard'
  | 'products'
  | 'orders'
  | 'pipeline'
  | 'inventory'
  | 'filaments'
  | 'finance'
  | 'pricing'
  | 'settings'
  | 'marketplaces'
  | 'intelligence'
  | 'image_converter';

const initialAdminSection = (): AdminSection => {
  if (window.location.pathname.includes('/marketplaces/callback')) return 'marketplaces';
  const value = new URLSearchParams(window.location.search).get('section') as AdminSection | null;
  return value &&
    [
      'dashboard',
      'products',
      'orders',
      'pipeline',
      'inventory',
      'filaments',
      'finance',
      'pricing',
      'settings',
      'marketplaces',
      'intelligence',
      'image_converter',
    ].includes(value)
    ? value
    : 'dashboard';
};

export const AdminModal: React.FC<AdminModalProps> = ({
  isOpen,
  onClose,
  variant = 'modal',
  activeTenant,
  categories,
  onRefreshProducts,
}) => {
  const [activeTab, setActiveTab] = useState<AdminSection>(initialAdminSection);

  // Estados para Produtos
  const [products, setProducts] = useState<Product[]>([]);
  const [isProductFormOpen, setIsProductFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Estados para Pedidos Admin
  const [orders, setOrders] = useState<Order[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [stockAlerts, setStockAlerts] = useState<StockAlert[]>([]);
  const [stockMovementProductId, setStockMovementProductId] = useState<number | ''>('');
  const [stockAdjustment, setStockAdjustment] = useState({
    product_id: 0,
    color_name: '',
    stock_qty: 0,
    reason: '',
  });
  const [carrierAccounts, setCarrierAccounts] = useState<TenantCarrierAccount[]>([]);
  const [shipments, setShipments] = useState<OrderShipment[]>([]);
  const [syncingShipmentId, setSyncingShipmentId] = useState<number | 'all' | null>(null);
  const [shipmentForm, setShipmentForm] = useState({ order_id: 0, carrier: 'correios', tracking_code: '' });
  const [mappings, setMappings] = useState<MarketplaceProductMapping[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen && activeTenant) {
      void loadTenantData(activeTab);
    }
  }, [isOpen, activeTenant?.id, activeTab]);

  const loadTenantData = async (section: AdminSection = activeTab) => {
    if (!activeTenant) return;
    try {
      if (['dashboard', 'products', 'inventory', 'pricing', 'finance', 'marketplaces', 'intelligence'].includes(section)) {
        const prodData = await api.getAdminProducts(activeTenant.id);
        setProducts(prodData);
      }
      if (['dashboard', 'orders', 'pipeline', 'inventory', 'finance'].includes(section)) {
        const ordData = await api.getAdminOrders(activeTenant.id);
        setOrders(ordData);
      }
      if (section === 'inventory') {
        const [movs, alerts] = await Promise.all([
          api.getStockMovements(activeTenant.id),
          api.getStockAlerts(activeTenant.id),
        ]);
        setStockMovements(movs);
        setStockAlerts(alerts);
      }
      if (section === 'orders' || section === 'settings') {
        const [carrierData, shipmentData] = await Promise.all([
          api.getCarrierAccounts(activeTenant.id),
          api.getShipments(activeTenant.id),
        ]);
        setCarrierAccounts(carrierData);
        setShipments(shipmentData);
      }
    } catch (err: any) {
      console.error('Erro ao carregar dados do admin:', err);
      setMessage({ type: 'error', text: err.message || 'Erro ao carregar dados do painel.' });
    }
  };

  const handleSaveProduct = async (productData: ProductInput) => {
    if (!activeTenant) return;
    try {
      if (editingProduct) {
        await api.updateProduct(editingProduct.id, productData, activeTenant.id);
        setMessage({ type: 'success', text: 'Produto atualizado com sucesso!' });
      } else {
        await api.createProduct(productData, activeTenant.id);
        setMessage({ type: 'success', text: 'Produto criado com sucesso!' });
      }
      setIsProductFormOpen(false);
      setEditingProduct(null);
      void loadTenantData('products');
      onRefreshProducts();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao salvar produto.' });
    }
  };

  const handleDeleteProduct = async (id: number) => {
    if (!activeTenant || !window.confirm('Tem certeza que deseja excluir este produto?')) return;
    try {
      await api.deleteProduct(id, activeTenant.id);
      setMessage({ type: 'success', text: 'Produto excluído.' });
      void loadTenantData('products');
      onRefreshProducts();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao excluir produto.' });
    }
  };

  const handleStatusChange = async (orderId: number, newStatus: string) => {
    if (!activeTenant) return;
    try {
      await api.updateOrderStatus(orderId, newStatus, activeTenant.id);
      setMessage({ type: 'success', text: `Status do Pedido #${orderId} atualizado!` });
      void loadTenantData('orders');
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao atualizar status.' });
    }
  };

  const handleSaveShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenant || !shipmentForm.order_id || !shipmentForm.tracking_code.trim()) {
      setMessage({ type: 'error', text: 'Selecione o pedido e informe o código de rastreio.' });
      return;
    }
    try {
      await api.saveShipment(shipmentForm, activeTenant.id);
      setMessage({ type: 'success', text: 'Envio vinculado com sucesso ao pedido!' });
      setShipmentForm({ order_id: 0, carrier: 'correios', tracking_code: '' });
      void loadTenantData('orders');
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Não foi possível vincular o envio.' });
    }
  };

  const handleSyncAllTracking = async () => {
    if (!activeTenant) return;
    setSyncingShipmentId('all');
    try {
      const summary = await api.syncTracking(activeTenant.id);
      setMessage({
        type: 'success',
        text: `Sincronização concluída: ${summary.synced} de ${summary.processed} rastreios atualizados.`,
      });
      void loadTenantData('orders');
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao sincronizar rastreios.' });
    } finally {
      setSyncingShipmentId(null);
    }
  };

  const handleAdjustStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenant || !stockAdjustment.product_id) return;
    try {
      await api.adjustStock(stockAdjustment, activeTenant.id);
      setMessage({ type: 'success', text: 'Estoque ajustado com sucesso!' });
      setStockAdjustment({ product_id: 0, color_name: '', stock_qty: 0, reason: '' });
      void loadTenantData('inventory');
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Não foi possível ajustar o estoque.' });
    }
  };

  const handlePrepareRestock = (alert: StockAlert) => {
    setStockAdjustment({
      product_id: alert.product_id,
      color_name: alert.color_name || '',
      stock_qty: Math.max(10, 10 - alert.stock_qty),
      reason: 'Reposição preventiva de estoque',
    });
  };

  const dashboardRevenue = orders
    .filter((o) => o.status !== 'cancelled')
    .reduce((acc, o) => acc + o.total_amount, 0);
  const pendingOrders = orders.filter((o) => o.status === 'pending_confirmation' || o.status === 'pending_payment').length;
  const activeProducts = products.filter((p) => p.in_stock).length;
  const lowStockProducts = products.filter((p) => p.stock_qty <= 3).length;

  const lowStockItems = stockAlerts.length > 0
    ? stockAlerts.map((alert) => ({
        product: products.find((p) => p.id === alert.product_id) || ({ id: alert.product_id, title: `Produto #${alert.product_id}`, image_url: '', stock_qty: alert.stock_qty } as Product),
        color: alert.color_name || '',
        qty: alert.stock_qty,
        severity: alert.severity,
        alert,
      }))
    : products.flatMap((product) => {
        const colorRows = product.color_stocks?.length
          ? product.color_stocks.map((stock) => ({ product, color: stock.color_name, qty: stock.stock_qty }))
          : [{ product, color: '', qty: product.stock_qty }];
        return colorRows
          .filter((item) => item.qty <= 3)
          .map((item) => ({ ...item, severity: item.qty <= 0 ? 'out' : item.qty <= 2 ? 'critical' : 'low', alert: null }));
      });

  const filteredStockMovements = stockMovementProductId
    ? stockMovements.filter((movement) => movement.product_id === stockMovementProductId)
    : stockMovements;
  const stockAdjustmentProduct = products.find((product) => product.id === stockAdjustment.product_id) || products[0];

  const tenantNavigation: TabItem<AdminSection>[] = [
    { id: 'dashboard', label: 'Visão geral', icon: <BarChart3 className="h-4 w-4" /> },
    { id: 'products', label: 'Catálogo', icon: <Package className="h-4 w-4" />, badge: products.length },
    { id: 'pipeline', label: 'Pipeline 3D', icon: <Clock className="h-4 w-4" /> },
    { id: 'orders', label: 'Pedidos e envios', icon: <ShoppingBag className="h-4 w-4" />, badge: orders.length },
    { id: 'inventory', label: 'Estoque Produtos', icon: <Package className="h-4 w-4" />, badge: lowStockItems.length },
    { id: 'filaments', label: 'Insumos 3D', icon: <Layers className="h-4 w-4" /> },
    { id: 'pricing', label: 'Precificação', icon: <Calculator className="h-4 w-4" /> },
    { id: 'finance', label: 'Financeiro', icon: <TrendingUp className="h-4 w-4" /> },
    { id: 'marketplaces', label: 'Mercado Livre', icon: <ShoppingCart className="h-4 w-4" /> },
    { id: 'intelligence', label: 'ML Trends', icon: <TrendingUp className="h-4 w-4" /> },
    { id: 'image_converter', label: 'Formatador ML', icon: <Sparkles className="h-4 w-4 text-laser-400" /> },
    { id: 'settings', label: 'Configurações', icon: <Settings className="h-4 w-4" /> },
  ];

  const modalTitle = (
    <div className="flex items-center gap-2">
      <Store className="h-5 w-5 text-laser-400" />
      <span>Gestão da loja — {activeTenant?.name || 'AZ3D'}</span>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      variant={variant}
      title={modalTitle}
      subtitle={`Operação de ${activeTenant?.name || ''} · Tenant #${activeTenant?.id || ''}`}
      maxWidth="6xl"
    >
      <div className="space-y-5">
        <Tabs items={tenantNavigation} activeTab={activeTab} onChange={setActiveTab} />

        {message && (
          <div
            className={`flex items-center justify-between rounded-xl border p-3 text-xs ${
              message.type === 'success'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
            }`}
          >
            <div className="flex items-center gap-2 font-semibold">
              {message.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              <span>{message.text}</span>
            </div>
            <button onClick={() => setMessage(null)} className="opacity-70 hover:opacity-100">
              ✕
            </button>
          </div>
        )}

        <div>
          {activeTab === 'dashboard' && (
            <AdminDashboard
              orders={orders}
              products={products}
              revenue={dashboardRevenue}
              pendingOrders={pendingOrders}
              activeProducts={activeProducts}
              lowStockProducts={lowStockProducts}
              orderStatusLabels={ORDER_STATUS_LABELS}
            />
          )}

          {activeTab === 'pipeline' && (
            <TenantOrdersPipelinePanel
              orders={orders}
              onRefreshOrders={() => activeTenant && void loadTenantData('pipeline')}
            />
          )}

          {activeTab === 'filaments' && <TenantFilamentInventoryPanel tenantId={activeTenant?.id} />}

          {activeTab === 'products' && (
            <AdminProductsTab
              products={products}
              categories={categories}
              activeTenant={activeTenant}
              onEditProduct={(p) => {
                setEditingProduct(p);
                setIsProductFormOpen(true);
              }}
              onCreateProduct={() => {
                setEditingProduct(null);
                setIsProductFormOpen(true);
              }}
              onDeleteProduct={handleDeleteProduct}
              onRefreshProducts={onRefreshProducts}
              onMessage={setMessage}
            />
          )}

          {activeTab === 'orders' && (
            <AdminOrdersTab
              orders={orders}
              shipments={shipments}
              shipmentForm={shipmentForm}
              syncingShipmentId={syncingShipmentId}
              setShipmentForm={setShipmentForm}
              onSaveShipment={handleSaveShipment}
              onSyncAllTracking={handleSyncAllTracking}
              onStatusChange={handleStatusChange}
            />
          )}

          {activeTab === 'inventory' && (
            <AdminInventory
              products={products}
              lowStockItems={lowStockItems}
              stockAdjustment={stockAdjustment}
              stockAdjustmentProduct={stockAdjustmentProduct}
              stockMovementProductId={stockMovementProductId}
              filteredStockMovements={filteredStockMovements}
              onStockAdjustmentChange={setStockAdjustment}
              onStockMovementProductChange={setStockMovementProductId}
              onAdjustStock={handleAdjustStockSubmit}
              onPrepareRestock={handlePrepareRestock}
            />
          )}

          {activeTab === 'pricing' && (
            <div className="space-y-6">
              <PricingCalculator tenantId={activeTenant?.id} products={products} />
              <PricingManagementPanel tenantId={activeTenant?.id} products={products} />
              <ProductionCostsPanel tenantId={activeTenant?.id} products={products} />
            </div>
          )}

          {activeTab === 'finance' && <FinancePanel tenantId={activeTenant?.id} products={products} />}

          {activeTab === 'marketplaces' && (
            <MarketplaceConnectionsPanel
              tenantId={activeTenant?.id}
              products={products}
              mappings={mappings}
              onMappingsChanged={setMappings}
              onProductsImported={() => {
                void loadTenantData();
                onRefreshProducts();
              }}
              onMessage={setMessage}
            />
          )}

          {activeTab === 'intelligence' && (
            <MarketplaceIntelligencePanel tenantId={activeTenant?.id} products={products} />
          )}

          {activeTab === 'image_converter' && <ImageConverterTab />}

          {activeTab === 'settings' && (
            <div className="space-y-6">
              <CarrierSettingsPanel
                tenantId={activeTenant?.id}
                accounts={carrierAccounts}
                onAccountsChanged={setCarrierAccounts}
                onMessage={setMessage}
              />
              {activeTenant && <MercadoPagoSettings tenantId={activeTenant.id} />}
            </div>
          )}
        </div>
      </div>

      <ProductFormModal
        isOpen={isProductFormOpen}
        onClose={() => {
          setIsProductFormOpen(false);
          setEditingProduct(null);
        }}
        productToEdit={editingProduct}
        categories={categories}
        onSave={handleSaveProduct}
      />
    </Modal>
  );
};
