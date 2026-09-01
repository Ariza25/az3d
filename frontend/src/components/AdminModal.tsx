import React, { useState, useEffect } from 'react';
import {
  Product,
  Category,
  Order,
  Tenant,
  ProductInput,
  MarketplaceProductMapping,
  TenantSettings,
  StockMovement,
  TenantCarrierAccount,
  OrderShipment,
  StockAlert,
} from '../types';
import { api } from '../services/api';
import { ProductFormModal } from './ProductFormModal';
import { PricingCalculator } from './PricingCalculator';
import { PricingManagementPanel } from './PricingManagementPanel';
import { ProductionCostsPanel } from './ProductionCostsPanel';
import { FinancePanel } from './FinancePanel';
import { MarketplaceConnectionsPanel } from './MarketplaceConnectionsPanel';
import { CatalogCategoriesPanel } from './CatalogCategoriesPanel';
import { CarrierSettingsPanel } from './CarrierSettingsPanel';
import { AdminDashboard } from '../features/admin/components/AdminDashboard';
import { AdminInventory } from '../features/admin/components/AdminInventory';
import { MercadoPagoSettings } from '../features/admin/components/MercadoPagoSettings';
import { Button, SearchInput } from './ui';
import {
  X,
  Package,
  Plus,
  Edit2,
  Trash2,
  ShoppingBag,
  Store,
  ShoppingCart,
  RefreshCw,
  Calculator,
  Settings,
  BarChart3,
  TrendingUp,
  Clock,
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

type AdminSection = 'dashboard' | 'products' | 'orders' | 'inventory' | 'finance' | 'pricing' | 'settings' | 'marketplaces';

const initialAdminSection = (): AdminSection => {
  if (window.location.pathname.includes('/marketplaces/callback')) return 'marketplaces';
  const value = new URLSearchParams(window.location.search).get('section') as AdminSection | null;
  return value && ['dashboard', 'products', 'orders', 'inventory', 'finance', 'pricing', 'settings', 'marketplaces'].includes(value) ? value : 'dashboard';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [isProductFormOpen, setIsProductFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Estados para Pedidos Admin
  const [orders, setOrders] = useState<Order[]>([]);
  const [tenantSettings, setTenantSettings] = useState<TenantSettings | null>(null);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [stockAlerts, setStockAlerts] = useState<StockAlert[]>([]);
  const [stockMovementProductId, setStockMovementProductId] = useState<number | ''>('');
  const [stockAdjustment, setStockAdjustment] = useState({ product_id: 0, color_name: '', stock_qty: 0, reason: '' });
  const [carrierAccounts, setCarrierAccounts] = useState<TenantCarrierAccount[]>([]);
  const [shipments, setShipments] = useState<OrderShipment[]>([]);
  const [shipmentForm, setShipmentForm] = useState({ order_id: 0, carrier: 'correios', tracking_code: '' });
  const [syncingShipmentId, setSyncingShipmentId] = useState<number | 'all' | null>(null);

  const [mappings, setMappings] = useState<MarketplaceProductMapping[]>([]);

  // Estados gerais
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadOptional = async <T,>(request: Promise<T>, fallback: T, label: string): Promise<T> => {
    try { return await request; }
    catch (error: any) { setMessage({ type: 'error', text: error.message || `Não foi possível carregar ${label}.` }); return fallback; }
  };

  // Carregar produtos e pedidos do tenant ativo
  useEffect(() => {
    if (isOpen && activeTenant) void loadTenantData(activeTab);
  }, [isOpen, activeTenant, activeTab]);

  useEffect(() => {
    if (!isOpen || window.location.pathname.includes('/marketplaces/callback')) return;
    const url = new URL(window.location.href);
    url.searchParams.set('section', activeTab);
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }, [activeTab, isOpen]);

  useEffect(() => {
    if (stockAdjustment.product_id || products.length === 0) return;
    const product = products[0];
    const firstStock = product.color_stocks?.[0];
    setStockAdjustment({
      product_id: product.id,
      color_name: firstStock?.color_name || '',
      stock_qty: firstStock?.stock_qty ?? product.stock_qty,
      reason: '',
    });
  }, [products, stockAdjustment.product_id]);

  const loadTenantData = async (section: AdminSection = activeTab) => {
    if (!activeTenant) return;
    try {
      if (['dashboard', 'products', 'inventory', 'pricing', 'finance', 'marketplaces'].includes(section)) setProducts(await api.getAdminProducts(activeTenant.id));
      if (section === 'dashboard' || section === 'orders') {
        const [ords, carriers, loadedShipments] = await Promise.all([loadOptional(api.getAdminOrders(activeTenant.id), [], 'pedidos'), loadOptional(api.getCarrierAccounts(activeTenant.id), [], 'transportadoras'), loadOptional(api.getShipments(activeTenant.id), [], 'envios')]);
        setOrders(ords); setCarrierAccounts(carriers); setShipments(loadedShipments);
        setShipmentForm((prev) => ({ ...prev, order_id: prev.order_id || ords[0]?.id || 0 }));
      }
      if (section === 'inventory' || section === 'dashboard') {
        const [movements, alerts] = await Promise.all([loadOptional(api.getStockMovements(activeTenant.id), [], 'movimentações de estoque'), loadOptional(api.getStockAlerts(activeTenant.id), [], 'alertas de estoque')]);
        setStockMovements(movements); setStockAlerts(alerts);
      }
      if (section === 'settings' || section === 'pricing' || section === 'marketplaces') setTenantSettings(await loadOptional(api.getAdminTenantSettings(activeTenant.id), null, 'configurações'));
      if (section === 'settings') setCarrierAccounts(await loadOptional(api.getCarrierAccounts(activeTenant.id), [], 'transportadoras'));
      if (section === 'marketplaces') setMappings(await loadOptional(api.getProductMappings(activeTenant.id), [], 'itens importados'));
    } catch (err: any) {
      console.error('Erro ao carregar dados do admin:', err);
      setMessage({ type: 'error', text: err.message || 'Não foi possível carregar esta seção.' });
    }
  };

  if (!isOpen) return null;

  // Handlers de Produtos
  const handleSaveProduct = async (formData: ProductInput) => {
    if (!activeTenant) return;
    if (editingProduct) {
      await api.updateProduct(editingProduct.id, formData, activeTenant.id);
      setMessage({ type: 'success', text: 'Produto atualizado com sucesso!' });
    } else {
      await api.createProduct(formData, activeTenant.id);
      setMessage({ type: 'success', text: 'Novo produto criado com sucesso!' });
    }
    loadTenantData();
    onRefreshProducts();
  };

  const handleDeleteProduct = async (id: number) => {
    if (!activeTenant || !window.confirm('Tem certeza que deseja excluir este produto?')) return;
    try {
      await api.deleteProduct(id, activeTenant.id);
      setMessage({ type: 'success', text: 'Produto removido com sucesso!' });
      loadTenantData();
      onRefreshProducts();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao excluir produto' });
    }
  };

  // Handler de Status de Pedido
  const handleStatusChange = async (orderId: number, newStatus: string) => {
    if (!activeTenant) return;
    try {
      await api.updateOrderStatus(orderId, newStatus, activeTenant.id);
      setMessage({ type: 'success', text: `Status do pedido #${orderId} atualizado!` });
      loadTenantData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao atualizar pedido' });
    }
  };

  const handleSaveTenantSettings = async () => {
    if (!activeTenant || !tenantSettings) return;
    try {
      const updated = await api.updateAdminTenantSettings(tenantSettings, activeTenant.id);
      setTenantSettings(updated);
      setMessage({ type: 'success', text: 'Configuracoes da loja salvas com sucesso!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao salvar configuracoes da loja' });
    }
  };

  const handleAdjustStock = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeTenant || !stockAdjustment.product_id) return;
    try {
      await api.adjustStock(stockAdjustment, activeTenant.id);
      setMessage({ type: 'success', text: 'Estoque ajustado com sucesso.' });
      await loadTenantData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao ajustar estoque' });
    }
  };

  const handlePrepareRestock = (alert: StockAlert, targetQty = 10) => {
    setStockAdjustment({
      product_id: alert.product_id,
      color_name: alert.color_name || '',
      stock_qty: targetQty,
      reason: `Reposicao de estoque (${alert.stock_qty} -> ${targetQty})`,
    });
    setActiveTab('inventory');
  };

  const handleSaveShipment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeTenant || !shipmentForm.order_id || !shipmentForm.tracking_code.trim()) return;
    try {
      await api.saveShipment({
        order_id: shipmentForm.order_id,
        carrier: shipmentForm.carrier,
        tracking_code: shipmentForm.tracking_code,
        status: 'pending',
      }, activeTenant.id);
      setShipmentForm((prev) => ({ ...prev, tracking_code: '' }));
      setMessage({ type: 'success', text: 'Rastreio vinculado ao pedido.' });
      await loadTenantData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao salvar rastreio' });
    }
  };

  const handleSyncShipment = async (shipmentId: number) => {
    if (!activeTenant) return;
    setSyncingShipmentId(shipmentId);
    try {
      const result = await api.syncShipment(shipmentId, activeTenant.id);
      setMessage({ type: 'success', text: `Rastreio sincronizado: ${result.events_created} evento(s) novo(s).` });
      await loadTenantData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao sincronizar rastreio' });
    } finally {
      setSyncingShipmentId(null);
    }
  };

  const handleSyncAllTracking = async () => {
    if (!activeTenant) return;
    setSyncingShipmentId('all');
    try {
      const result = await api.syncTracking(activeTenant.id);
      setMessage({ type: result.failed ? 'error' : 'success', text: `Sync concluido: ${result.synced}/${result.processed} envio(s), ${result.failed} falha(s).` });
      await loadTenantData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao sincronizar rastreios' });
    } finally {
      setSyncingShipmentId(null);
    }
  };

  const updateTenantSetting = (field: keyof TenantSettings, value: string | number | boolean) => {
    setTenantSettings((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const filteredProducts = products.filter(
    (p) =>
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.material.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const dashboardRevenue = orders.reduce((sum, order) => sum + order.total_amount, 0);
  const pendingOrders = orders.filter((order) => ['pending_confirmation', 'pending_payment', 'paid', 'preparing'].includes(order.status)).length;
  const activeProducts = products.filter((product) => product.status === 'active').length;
  const lowStockProducts = products.filter((product) =>
    product.stock_qty <= 3 || product.color_stocks?.some((stock) => stock.stock_qty <= 3)
  ).length;
  const lowStockItems = stockAlerts.length ? stockAlerts.map((alert) => ({
    product: alert.product,
    color: alert.color_name || '',
    qty: alert.stock_qty,
    severity: alert.severity,
    alert,
  })) : products.flatMap((product) => {
    const colorRows = product.color_stocks?.length
      ? product.color_stocks.map((stock) => ({ product, color: stock.color_name, qty: stock.stock_qty }))
      : [{ product, color: '', qty: product.stock_qty }];
    return colorRows.filter((item) => item.qty <= 3).map((item) => ({ ...item, severity: item.qty <= 0 ? 'out' : item.qty <= 2 ? 'critical' : 'low', alert: null }));
  });
  const filteredStockMovements = stockMovementProductId
    ? stockMovements.filter((movement) => movement.product_id === stockMovementProductId)
    : stockMovements;
  const stockAdjustmentProduct = products.find((product) => product.id === stockAdjustment.product_id) || products[0];
  const tenantNavigation = [
    { id: 'dashboard' as const, label: 'Visão geral', hint: 'Resumo da operação', icon: BarChart3 },
    { id: 'products' as const, label: 'Catálogo', hint: `${products.length} produtos · ${categories.length} categorias`, icon: Package },
    { id: 'orders' as const, label: 'Pedidos e envios', hint: `${orders.length} vendas`, icon: ShoppingBag },
    { id: 'inventory' as const, label: 'Estoque', hint: `${lowStockItems.length} alertas`, icon: Package },
    { id: 'pricing' as const, label: 'Precificação', hint: 'Custos e margens', icon: Calculator },
    { id: 'finance' as const, label: 'Financeiro', hint: 'Receita e resultado', icon: TrendingUp },
    { id: 'marketplaces' as const, label: 'Mercado Livre', hint: 'Canal conectado', icon: ShoppingCart },
    { id: 'settings' as const, label: 'Configurações', hint: 'Loja, pagamentos e frete', icon: Settings },
  ];

  return (
    <div className={variant === 'page'
      ? 'min-h-screen bg-chumbo-950 text-slate-100'
      : 'fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-black/85 backdrop-blur-md'
    }>
      <div 
        className={variant === 'page'
          ? 'glass-panel min-h-screen w-full overflow-hidden border-x-0 border-y border-chumbo-800 shadow-2xl relative animate-in fade-in duration-200'
          : 'glass-panel w-full max-w-5xl rounded-3xl overflow-hidden border border-chumbo-700 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200'
        }
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="bg-chumbo-950 p-6 border-b border-chumbo-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-2xl bg-laser-500/20 text-laser-400 border border-laser-500/30 flex items-center justify-center font-bold">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-extrabold text-white">Gestão da loja</h2>
                <span className="bg-emerald-500/15 text-emerald-300 text-[9px] font-mono font-bold px-2 py-1 rounded-md border border-emerald-500/25 uppercase tracking-wider">
                  tenant_admin
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Operação de <strong className="text-white">{activeTenant?.name}</strong> · Tenant #{activeTenant?.id}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <span className="bg-chumbo-900 border border-chumbo-700 text-xs font-mono text-white rounded-xl px-3 py-2">
              {activeTenant?.name || 'Loja'} #{activeTenant?.id}
            </span>

            <button
              onClick={onClose}
              className="p-2.5 rounded-full bg-chumbo-900 text-slate-400 hover:text-white border border-chumbo-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <nav aria-label="Navegação da gestão da loja" className="border-b border-chumbo-800 bg-chumbo-950/80 px-4 py-4 sm:px-6">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {tenantNavigation.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`flex min-w-0 items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                    isActive
                      ? 'border-laser-500/40 bg-laser-500/10 text-white'
                      : 'border-chumbo-800 bg-chumbo-900/60 text-slate-400 hover:border-chumbo-700 hover:text-white'
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-laser-400' : 'text-slate-500'}`} />
                  <span className="min-w-0">
                    <strong className="block truncate text-xs">{item.label}</strong>
                    <span className="mt-0.5 block truncate text-[9px] font-normal text-slate-600">{item.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Notificações e Feedback */}
        {message && (
          <div className={`p-3 px-6 text-xs flex items-center justify-between ${
            message.type === 'success' ? 'bg-emerald-500/10 text-emerald-300 border-b border-emerald-500/20' : 'bg-rose-500/10 text-rose-300 border-b border-rose-500/20'
          }`}>
            <span className="font-semibold">{message.text}</span>
            <button onClick={() => setMessage(null)} className="opacity-70 hover:opacity-100">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Conteúdo Principal do Painel */}
        <div className={variant === 'page'
          ? 'p-6 min-h-[calc(100vh-152px)] overflow-y-auto bg-chumbo-900 text-slate-100'
          : 'p-6 max-h-[65vh] overflow-y-auto bg-chumbo-900 text-slate-100'
        }>
          
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

          {/* TAB 1: PRODUTOS */}
          {activeTab === 'products' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-72">
                  <SearchInput
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar produto por nome ou material..."
                  />
                </div>

                <Button
                  type="button"
                  variant="primary"
                  icon={<Plus className="w-4 h-4" />}
                  onClick={() => {
                    setEditingProduct(null);
                    setIsProductFormOpen(true);
                  }}
                >
                  Novo Produto 3D
                </Button>
              </div>

              {/* Tabela de Produtos */}
              <div className="rounded-2xl border border-chumbo-800 overflow-hidden bg-chumbo-950/60">
                <table className="w-full text-left text-xs">
                  <thead className="bg-chumbo-950 text-slate-400 font-mono uppercase text-[10px]">
                    <tr>
                      <th className="p-3">Produto</th>
                      <th className="p-3">Material 3D</th>
                      <th className="p-3">Resolução / Tempo</th>
                      <th className="p-3">Preço Unitário</th>
                      <th className="p-3">Estoque</th>
                      <th className="p-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-chumbo-850 text-slate-300">
                    {filteredProducts.map((p) => (
                      <tr key={p.id} className="hover:bg-chumbo-850/50 transition-colors">
                        <td className="p-3">
                          <div className="flex items-center space-x-3">
                            <img src={p.image_url} alt={p.title} className="w-10 h-10 object-cover rounded-lg border border-chumbo-700" />
                            <div>
                              <span className="font-bold text-white block">{p.title}</span>
                              <span className="text-[10px] text-slate-400 font-mono">ID #{p.id} • Slug: {p.slug}</span>
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="bg-chumbo-800 text-slate-200 px-2 py-0.5 rounded-md font-mono text-[11px]">
                            {p.material}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-slate-400">
                          <div>{p.layer_height}</div>
                          <div className="text-[10px] text-slate-500">{p.print_time}</div>
                        </td>
                        <td className="p-3 font-bold text-white">
                          R$ {p.price.toFixed(2).replace('.', ',')}
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            p.in_stock ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                          }`}>
                            {p.in_stock ? `${p.stock_qty} un` : 'Esgotado'}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => {
                                setEditingProduct(p);
                                setIsProductFormOpen(true);
                              }}
                              className="p-1.5 rounded-lg bg-chumbo-800 hover:bg-chumbo-700 text-slate-300 hover:text-white transition-colors"
                              title="Editar Produto"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(p.id)}
                              className="p-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 transition-colors"
                              title="Excluir Produto"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredProducts.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-400 font-mono text-xs">
                          Nenhum produto cadastrado neste tenant.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'products' && <CatalogCategoriesPanel tenantId={activeTenant?.id} categories={categories} onCreated={onRefreshProducts} onMessage={setMessage} />}

          {/* TAB 3: PEDIDOS */}
          {activeTab === 'orders' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-white">Gerenciamento de vendas e pedidos</h3>
              <form onSubmit={handleSaveShipment} className="rounded-2xl border border-chumbo-800 bg-chumbo-950/60 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                  <div className="flex-1 space-y-1.5">
                    <label className="text-xs font-mono uppercase text-slate-400">Pedido</label>
                    <select
                      value={shipmentForm.order_id || ''}
                      onChange={(event) => setShipmentForm((prev) => ({ ...prev, order_id: Number(event.target.value) || 0 }))}
                      className="w-full rounded-xl border border-chumbo-800 bg-chumbo-950 px-3 py-2 text-xs text-white"
                    >
                      <option value="">Selecione</option>
                      {orders.map((order) => (
                        <option key={order.id} value={order.id}>Pedido #{order.id} - R$ {order.total_amount.toFixed(2).replace('.', ',')}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono uppercase text-slate-400">Transportadora</label>
                    <select
                      value={shipmentForm.carrier}
                      onChange={(event) => setShipmentForm((prev) => ({ ...prev, carrier: event.target.value }))}
                      className="w-full rounded-xl border border-chumbo-800 bg-chumbo-950 px-3 py-2 text-xs text-white"
                    >
                      <option value="correios">Correios</option>
                    </select>
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <label className="text-xs font-mono uppercase text-slate-400">Codigo de rastreio</label>
                    <input
                      value={shipmentForm.tracking_code}
                      onChange={(event) => setShipmentForm((prev) => ({ ...prev, tracking_code: event.target.value.toUpperCase() }))}
                      placeholder="AA123456789BR"
                      className="w-full rounded-xl border border-chumbo-800 bg-chumbo-950 px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <button type="submit" className="rounded-xl bg-white px-4 py-2 text-xs font-bold text-chumbo-950 hover:bg-slate-200">
                    Vincular envio
                  </button>
                  <button
                    type="button"
                    onClick={handleSyncAllTracking}
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
                          <span className="text-white font-semibold block">{o.user?.name || `Usuário #${o.user_id}`}</span>
                          <span className="text-[10px] text-slate-400">{o.shipping_address || 'Endereço padrão'}</span>
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
                            onChange={(e) => handleStatusChange(o.id, e.target.value)}
                            className={`bg-chumbo-950 border border-chumbo-700 text-xs font-mono font-bold rounded-lg px-2 py-1 focus:outline-none ${
                              o.status === 'preparing' || o.status === 'paid' ? 'text-amber-400' : o.status === 'delivered' ? 'text-emerald-400' : 'text-slate-300'
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
                          Nenhum pedido registrado para este tenant ainda.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                {shipments.map((shipment) => (
                  <div key={shipment.id} className="rounded-2xl border border-chumbo-800 bg-chumbo-950/60 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-bold text-white">Pedido #{shipment.order_id}</h4>
                        <p className="font-mono text-xs text-slate-400">{shipment.carrier.toUpperCase()} - {shipment.tracking_code}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                          shipment.status === 'delivered' ? 'bg-emerald-500/20 text-emerald-300' : shipment.last_error ? 'bg-rose-500/20 text-rose-300' : 'bg-amber-500/20 text-amber-300'
                        }`}>
                          {shipment.status}
                        </span>
                        <button
                          onClick={() => handleSyncShipment(shipment.id)}
                          disabled={syncingShipmentId === shipment.id}
                          className="rounded-lg border border-chumbo-700 bg-chumbo-900 p-2 text-slate-300 hover:text-white disabled:opacity-50"
                          title="Sincronizar rastreio"
                        >
                          <RefreshCw className={`h-4 w-4 ${syncingShipmentId === shipment.id ? 'animate-spin' : ''}`} />
                        </button>
                      </div>
                    </div>
                    {shipment.last_sync_at && (
                      <p className="mt-2 flex items-center gap-1 text-[10px] text-slate-500">
                        <Clock className="h-3 w-3" />
                        Ultimo sync: {new Date(shipment.last_sync_at).toLocaleString('pt-BR')}
                      </p>
                    )}
                    {shipment.last_error && <p className="mt-2 rounded-lg bg-rose-500/10 p-2 text-xs text-rose-300">{shipment.last_error}</p>}
                    <div className="mt-3 space-y-2">
                      {(shipment.events || []).slice(0, 5).map((event) => (
                        <div key={event.id} className="border-l-2 border-laser-500/40 pl-3 text-xs">
                          <strong className="block text-white">{event.description || event.event_code || 'Evento recebido'}</strong>
                          <span className="text-slate-400">{event.location || 'Local nao informado'}</span>
                          <span className="block font-mono text-[10px] text-slate-500">{new Date(event.occurred_at).toLocaleString('pt-BR')}</span>
                        </div>
                      ))}
                      {(!shipment.events || shipment.events.length === 0) && (
                        <p className="py-3 text-xs text-slate-500">Sem eventos sincronizados ainda.</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
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
              onAdjustStock={handleAdjustStock}
              onPrepareRestock={handlePrepareRestock}
            />
          )}

          {/* TAB 4: PRECIFICACAO */}
          {activeTab === 'pricing' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-white">Central de custos e precificacao 3D</h3>
                <p className="mt-1 text-xs text-slate-400">Todos os calculos de filamento, energia, tempo, perdas, taxas e margem ficam concentrados nesta aba.</p>
              </div>
              <details open className="rounded-2xl border border-chumbo-800 bg-chumbo-950/40 p-4">
                <summary className="cursor-pointer text-sm font-bold text-white">Calculadora</summary>
                <div className="mt-4"><PricingCalculator
                products={products}
                tenantId={activeTenant?.id}
                tenantSettings={tenantSettings}
                onSettingsSaved={setTenantSettings}
                onProductPricingApplied={() => {
                  void loadTenantData();
                  onRefreshProducts();
                }}
                /></div>
              </details>
              <details className="rounded-2xl border border-chumbo-800 bg-chumbo-950/40 p-4">
                <summary className="cursor-pointer text-sm font-bold text-white">Materiais, impressoras, canais e cenários</summary>
                <div className="mt-4"><PricingManagementPanel tenantId={activeTenant?.id} products={products} /></div>
              </details>
              <details className="rounded-2xl border border-chumbo-800 bg-chumbo-950/40 p-4">
                <summary className="cursor-pointer text-sm font-bold text-white">Custos fixos e custos reais</summary>
                <div className="mt-4"><ProductionCostsPanel tenantId={activeTenant?.id} products={products} /></div>
              </details>
            </div>
          )}

          {activeTab === 'finance' && (
            <FinancePanel tenantId={activeTenant?.id} products={products} />
          )}

          {activeTab === 'settings' && <CarrierSettingsPanel tenantId={activeTenant?.id} accounts={carrierAccounts} onAccountsChanged={setCarrierAccounts} onMessage={setMessage} />}

          {activeTab === 'settings' && tenantSettings && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-bold text-white">Configuracoes da loja</h3>
                <p className="mt-1 text-xs text-slate-400">Identidade da vitrine, pagamentos e formas de entrega.</p>
              </div>

              {activeTenant && <MercadoPagoSettings tenantId={activeTenant.id} />}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono uppercase text-slate-400">Nome da loja</label>
                  <input value={tenantSettings.store_name || ''} onChange={(e) => updateTenantSetting('store_name', e.target.value)} className="w-full rounded-xl border border-chumbo-800 bg-chumbo-950 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-laser-400" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-mono uppercase text-slate-400">Logo URL</label>
                  <input value={tenantSettings.logo_url || ''} onChange={(e) => updateTenantSetting('logo_url', e.target.value)} className="w-full rounded-xl border border-chumbo-800 bg-chumbo-950 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-laser-400" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-mono uppercase text-slate-400">Cor primaria</label>
                  <input type="color" value={tenantSettings.primary_color || '#22d3ee'} onChange={(e) => updateTenantSetting('primary_color', e.target.value)} className="h-11 w-full rounded-xl border border-chumbo-800 bg-chumbo-950 px-2 py-1" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-mono uppercase text-slate-400">Cor de destaque</label>
                  <input type="color" value={tenantSettings.accent_color || '#ffffff'} onChange={(e) => updateTenantSetting('accent_color', e.target.value)} className="h-11 w-full rounded-xl border border-chumbo-800 bg-chumbo-950 px-2 py-1" />
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <label className="flex items-center gap-2 rounded-xl border border-chumbo-800 bg-chumbo-950 px-4 py-2 text-xs text-slate-300">
                  <input type="checkbox" checked={tenantSettings.delivery_ship_enabled} onChange={(e) => updateTenantSetting('delivery_ship_enabled', e.target.checked)} />
                  Entrega habilitada
                </label>
                <label className="flex items-center gap-2 rounded-xl border border-chumbo-800 bg-chumbo-950 px-4 py-2 text-xs text-slate-300">
                  <input type="checkbox" checked={tenantSettings.delivery_pickup_enabled} onChange={(e) => updateTenantSetting('delivery_pickup_enabled', e.target.checked)} />
                  Retirada habilitada
                </label>
              </div>

              <button onClick={handleSaveTenantSettings} className="rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-chumbo-950 hover:bg-slate-200">
                Salvar configuracoes
              </button>
            </div>
          )}

          {/* TAB 6: MARKETPLACES */}
          {activeTab === 'marketplaces' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-white mb-1">Canais de Venda Conectados</h3>
                <p className="text-xs text-slate-400">Gerencie as integrações do tenant <strong className="text-white">{activeTenant?.name}</strong> com marketplaces externos.</p>
              </div>

              <MarketplaceConnectionsPanel
                tenantId={activeTenant?.id}
                products={products}
                mappings={mappings}
                onMappingsChanged={setMappings}
                onProductsImported={() => {
                  loadTenantData();
                  onRefreshProducts();
                }}
                onMessage={setMessage}
              />

            </div>
          )}

        </div>

      </div>

      {/* Modal Secundário: Formulário de Produto (Criar / Editar) */}
      <ProductFormModal
        isOpen={isProductFormOpen}
        onClose={() => setIsProductFormOpen(false)}
        onSave={handleSaveProduct}
        productToEdit={editingProduct}
        categories={categories}
      />
    </div>
  );
};
