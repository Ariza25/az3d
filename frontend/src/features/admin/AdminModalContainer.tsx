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
} from '../../types';
import { api } from '../../services/api';
import { TabItem } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import {
  Package,
  ShoppingBag,
  Calculator,
  Settings,
  BarChart3,
  Boxes,
  TrendingUp,
  Clock,
  Layers,
  ShoppingCart,
  Sparkles,
  MessageSquare,
  Tag,
} from 'lucide-react';
import { AdminModalView, AdminSection } from './components/AdminModalView';

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending_confirmation: 'Aguardando confirmação',
  pending_payment: 'Aguardando pagamento',
  queued_printing: 'Fila de Impressão',
  in_printing: 'Em Impressão 3D',
  post_processing: 'Pós-Processamento',
  ready_shipping: 'Pronto / Expedição',
  shipped: 'Enviado / Rastreio',
  paid: 'Pago',
  preparing: 'Em preparo',
  delivered: 'Concluído',
  cancelled: 'Cancelado',
  pending: 'Pendente',
  printing: 'Em Impressão 3D',
};

export interface AdminModalContainerProps {
  isOpen: boolean;
  onClose: () => void;
  variant?: 'modal' | 'page';
  activeTenant: Tenant | null;
  categories: Category[];
  onRefreshProducts: () => void;
  onRefreshCategories?: () => void;
}

const initialAdminSection = (): AdminSection => {
  if (window.location.pathname.includes('/marketplaces/callback')) return 'marketplaces';
  const searchParams = new URLSearchParams(window.location.search);
  const value = (searchParams.get('section') || searchParams.get('tab')) as AdminSection | null;
  return value &&
    [
      'dashboard',
      'products',
      'orders',
      'promotions',
      'pipeline',
      'inventory',
      'filaments',
      'pricing',
      'split_3mf',
      'finance',
      'settings',
      'marketplaces',
      'intelligence',
      'image_converter',
    ].includes(value)
    ? value
    : 'dashboard';
};

export const AdminModalContainer: React.FC<AdminModalContainerProps> = ({
  isOpen,
  onClose,
  variant = 'modal',
  activeTenant,
  categories,
  onRefreshProducts,
  onRefreshCategories,
}) => {
  const { user } = useAuth();
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
  const [shipmentForm, setShipmentForm] = useState({ order_id: 0, carrier: 'superfrete', tracking_code: '' });
  const [mappings, setMappings] = useState<MarketplaceProductMapping[]>([]);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
      api.getTenantChatUnreadCount(activeTenant.id)
        .then((r) => setUnreadChatCount(r.unread_count || 0))
        .catch(() => {});
    } catch (err: any) {
      console.error('Erro ao carregar dados do admin:', err);
      setMessage({ type: 'error', text: err.message || 'Erro ao carregar dados do painel.' });
    }
  };

  useEffect(() => {
    if (isOpen && activeTenant) {
      void loadTenantData(activeTab);
    }
  }, [isOpen, activeTenant?.id, activeTab]);

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
      const errorMsg = err.message || 'Erro ao salvar produto.';
      setMessage({ type: 'error', text: errorMsg });
      throw err;
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
      setShipmentForm({ order_id: 0, carrier: 'superfrete', tracking_code: '' });
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

  // Métricas calculadas para Dashboard
  const dashboardRevenue = orders
    .filter((o) => o.status !== 'cancelled')
    .reduce((acc, o) => acc + o.total_amount, 0);
  const pendingOrders = orders.filter((o) => o.status === 'pending_confirmation' || o.status === 'pending_payment').length;
  const activeProducts = products.filter((p) => p.in_stock).length;
  const lowStockProducts = products.filter((p) => p.stock_qty <= 3).length;

  // Itens de baixo estoque
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
    { id: 'products', label: 'Produtos', icon: <Package className="h-4 w-4" />, badge: products.length },
    { id: 'orders', label: 'Pedidos e envios', icon: <ShoppingBag className="h-4 w-4" />, badge: orders.length },
    { id: 'promotions', label: 'Cupons & Promoções', icon: <Tag className="h-4 w-4" /> },
    { id: 'chat', label: 'Mensagens & Chat', icon: <MessageSquare className="h-4 w-4" />, badge: unreadChatCount > 0 ? unreadChatCount : undefined },
    { id: 'pipeline', label: 'Pipeline 3D', icon: <Clock className="h-4 w-4" /> },
    { id: 'inventory', label: 'Estoque', icon: <Package className="h-4 w-4" />, badge: lowStockItems.length > 0 ? lowStockItems.length : undefined },
    { id: 'filaments', label: 'Insumos 3D', icon: <Layers className="h-4 w-4" /> },
    { id: 'pricing', label: 'Precificação', icon: <Calculator className="h-4 w-4" /> },
    { id: 'finance', label: 'Financeiro', icon: <TrendingUp className="h-4 w-4" /> },
    { id: 'marketplaces', label: 'Marketplaces', icon: <ShoppingCart className="h-4 w-4" /> },
    { id: 'intelligence', label: 'ML Trends', icon: <TrendingUp className="h-4 w-4" /> },
    { id: 'image_converter', label: 'Formatador ML', icon: <Sparkles className="h-4 w-4 text-laser-400" /> },
    { id: 'split_3mf', label: 'Divisor 3MF', icon: <Boxes className="h-4 w-4 text-cyan-600 dark:text-cyan-400" /> },
    { id: 'settings', label: 'Configurações', icon: <Settings className="h-4 w-4" /> },
  ];

  return (
    <AdminModalView
      isOpen={isOpen}
      onClose={onClose}
      variant={variant}
      activeTenant={activeTenant}
      userEmail={user?.email}
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      tenantNavigation={tenantNavigation}
      message={message}
      onClearMessage={() => setMessage(null)}
      onMessage={setMessage}
      // Products
      products={products}
      categories={categories}
      isProductFormOpen={isProductFormOpen}
      editingProduct={editingProduct}
      onOpenCreateProduct={() => {
        setEditingProduct(null);
        setIsProductFormOpen(true);
      }}
      onOpenEditProduct={(p) => {
        setEditingProduct(p);
        setIsProductFormOpen(true);
      }}
      onCloseProductForm={() => {
        setIsProductFormOpen(false);
        setEditingProduct(null);
      }}
      onSaveProduct={handleSaveProduct}
      onDeleteProduct={handleDeleteProduct}
      onRefreshProducts={onRefreshProducts}
      onRefreshCategories={onRefreshCategories}
      // Orders
      orders={orders}
      shipments={shipments}
      shipmentForm={shipmentForm}
      syncingShipmentId={syncingShipmentId}
      setShipmentForm={setShipmentForm}
      onSaveShipment={handleSaveShipment}
      onSyncAllTracking={handleSyncAllTracking}
      onStatusChange={handleStatusChange}
      onRefreshPipelineOrders={() => activeTenant && void loadTenantData('pipeline')}
      // Inventory
      lowStockItems={lowStockItems}
      stockAdjustment={stockAdjustment}
      stockAdjustmentProduct={stockAdjustmentProduct}
      stockMovementProductId={stockMovementProductId}
      filteredStockMovements={filteredStockMovements}
      onStockAdjustmentChange={setStockAdjustment}
      onStockMovementProductChange={setStockMovementProductId}
      onAdjustStock={handleAdjustStockSubmit}
      onPrepareRestock={handlePrepareRestock}
      // Settings / Carrier / Marketplaces
      carrierAccounts={carrierAccounts}
      setCarrierAccounts={setCarrierAccounts}
      mappings={mappings}
      setMappings={setMappings}
      onProductsImported={() => {
        void loadTenantData();
        onRefreshProducts();
      }}
      // Dashboard
      dashboardRevenue={dashboardRevenue}
      pendingOrders={pendingOrders}
      activeProducts={activeProducts}
      lowStockProducts={lowStockProducts}
      orderStatusLabels={ORDER_STATUS_LABELS}
    />
  );
};
