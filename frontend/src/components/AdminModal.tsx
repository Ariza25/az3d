import React, { useState, useEffect } from 'react';
import {
  Product,
  Category,
  Order,
  Tenant,
  ProductInput,
  MarketplaceIntegration,
  MarketplaceProductMapping,
  TenantSettings,
  StockMovement,
  TenantCarrierAccount,
  OrderShipment,
  CarrierHealthItem,
} from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ProductFormModal } from './ProductFormModal';
import { PricingCalculator } from './PricingCalculator';
import { PricingManagementPanel } from './PricingManagementPanel';
import { FinancePanel } from './FinancePanel';
import { MarketplaceConnectionsPanel } from './MarketplaceConnectionsPanel';
import {
  X,
  Package,
  Plus,
  Edit2,
  Trash2,
  Tag,
  ShoppingBag,
  Store,
  Search,
  ShoppingCart,
  ToggleLeft,
  ToggleRight,
  Zap,
  RefreshCw,
  ExternalLink,
  Calculator,
  Settings,
  BarChart3,
  TrendingUp,
  Truck,
  ShieldCheck,
  Activity,
  Clock,
} from 'lucide-react';

// Mapa de metadados visuais dos marketplaces
const MARKETPLACE_META: Record<string, { label: string; color: string; bg: string; border: string; icon: string; badge: string }> = {
  mercadolivre: {
    label: 'Mercado Livre',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    icon: '🛍️',
    badge: 'bg-yellow-400 text-yellow-950',
  },
  shopee: {
    label: 'Shopee',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
    icon: '🛒',
    badge: 'bg-orange-400 text-orange-950',
  },
  amazon: {
    label: 'Amazon Seller',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/30',
    icon: '📦',
    badge: 'bg-cyan-400 text-cyan-950',
  },
};

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
  tenants: Tenant[];
  onSelectTenant: (tenant: Tenant) => void;
  categories: Category[];
  onRefreshProducts: () => void;
}

export const AdminModal: React.FC<AdminModalProps> = ({
  isOpen,
  onClose,
  variant = 'modal',
  activeTenant,
  tenants,
  onSelectTenant,
  categories,
  onRefreshProducts,
}) => {
  const { user } = useAuth();
  const isMasterAdmin = user?.role === 'master_admin';
  const [activeTab, setActiveTab] = useState<'dashboard' | 'master' | 'products' | 'categories' | 'orders' | 'inventory' | 'finance' | 'pricing' | 'settings' | 'tenants' | 'marketplaces' | 'carriers'>('dashboard');
  
  // Estados para Produtos
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isProductFormOpen, setIsProductFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Estados para Categorias
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('box');

  // Estados para Pedidos Admin
  const [orders, setOrders] = useState<Order[]>([]);
  const [tenantSettings, setTenantSettings] = useState<TenantSettings | null>(null);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [stockAdjustment, setStockAdjustment] = useState({ product_id: 0, color_name: '', stock_qty: 0, reason: '' });
  const [carrierAccounts, setCarrierAccounts] = useState<TenantCarrierAccount[]>([]);
  const [shipments, setShipments] = useState<OrderShipment[]>([]);
  const [carrierHealth, setCarrierHealth] = useState<CarrierHealthItem[]>([]);
  const [carrierForm, setCarrierForm] = useState({
    provider: 'correios',
    account_name: 'Correios',
    auth_type: 'bearer_token',
    is_active: true,
    sync_tracking: true,
    access_token: '',
    api_base_url: '',
    token_base_url: '',
    token_username: '',
    token_password: '',
    contract_number: '',
    contract_dr: '',
    posting_card_number: '',
  });
  const [shipmentForm, setShipmentForm] = useState({ order_id: 0, carrier: 'correios', tracking_code: '' });
  const [syncingShipmentId, setSyncingShipmentId] = useState<number | 'all' | null>(null);

  // Estados para Marketplaces
  const [marketplaces, setMarketplaces] = useState<MarketplaceIntegration[]>([]);
  const [mappings, setMappings] = useState<MarketplaceProductMapping[]>([]);
  const [simulatingProvider, setSimulatingProvider] = useState<string | null>(null);
  const [syncingProduct, setSyncingProduct] = useState<{ productId: number; provider: string } | null>(null);

  // Estados gerais
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const canSwitchTenants = tenants.length > 1;

  // Carregar produtos e pedidos do tenant ativo
  useEffect(() => {
    if (isOpen && activeTenant) {
      loadTenantData();
    }
  }, [isOpen, activeTenant]);

  useEffect(() => {
    if (!canSwitchTenants && activeTab === 'tenants') {
      setActiveTab('products');
    }
  }, [activeTab, canSwitchTenants]);

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

  const loadTenantData = async () => {
    if (!activeTenant) return;
    try {
      const [prods, ords, mkts, maps, settings, movements, carriers, loadedShipments, health] = await Promise.all([
        api.getAdminProducts(activeTenant.id),
        api.getAdminOrders(activeTenant.id).catch(() => []),
        api.getMarketplaces(activeTenant.id).catch(() => []),
        api.getProductMappings(activeTenant.id).catch(() => []),
        api.getAdminTenantSettings(activeTenant.id).catch(() => null),
        api.getStockMovements(activeTenant.id).catch(() => []),
        api.getCarrierAccounts(activeTenant.id).catch(() => []),
        api.getShipments(activeTenant.id).catch(() => []),
        api.getCarrierHealth(activeTenant.id).catch(() => []),
      ]);
      setProducts(prods);
      setOrders(ords);
      setMarketplaces(mkts);
      setMappings(maps);
      setTenantSettings(settings);
      setStockMovements(movements);
      setCarrierAccounts(carriers);
      setShipments(loadedShipments);
      setCarrierHealth(health);
      setShipmentForm((prev) => ({ ...prev, order_id: prev.order_id || ords[0]?.id || 0 }));
    } catch (err: any) {
      console.error('Erro ao carregar dados do admin:', err);
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

  // Handlers de Categorias
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenant || !newCatName.trim()) return;
    try {
      await api.createCategory({ name: newCatName, description: newCatDesc, icon: newCatIcon }, activeTenant.id);
      setMessage({ type: 'success', text: `Categoria "${newCatName}" criada com sucesso!` });
      setNewCatName('');
      setNewCatDesc('');
      onRefreshProducts();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao criar categoria' });
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

  // Handlers de Marketplace
  const handleToggleMarketplace = async (id: number) => {
    if (!activeTenant) return;
    try {
      const updated = await api.toggleMarketplace(id, activeTenant.id);
      setMarketplaces((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      setMessage({ type: 'success', text: `Integração ${updated.is_active ? 'ativada' : 'desativada'} com sucesso!` });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao alternar integração' });
    }
  };

  const handleSimulateOrder = async (provider: string) => {
    if (!activeTenant) return;
    setSimulatingProvider(provider);
    try {
      const result = await api.simulateMarketplaceOrder(provider, activeTenant.id);
      setMessage({ type: 'success', text: result.message });
      loadTenantData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao simular pedido' });
    } finally {
      setSimulatingProvider(null);
    }
  };

  const handleSyncProduct = async (productId: number, provider: string) => {
    if (!activeTenant) return;
    setSyncingProduct({ productId, provider });
    try {
      const result = await api.syncProductToMarketplace(productId, provider, activeTenant.id);
      setMessage({ type: 'success', text: result.message });
      const maps = await api.getProductMappings(activeTenant.id).catch(() => []);
      setMappings(maps);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao sincronizar produto' });
    } finally {
      setSyncingProduct(null);
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

  const handleSaveCarrierAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeTenant) return;
    const credentials = Object.fromEntries(
      Object.entries({
        access_token: carrierForm.access_token,
        api_base_url: carrierForm.api_base_url,
        token_base_url: carrierForm.token_base_url,
        token_username: carrierForm.token_username,
        token_password: carrierForm.token_password,
        contract_number: carrierForm.contract_number,
        contract_dr: carrierForm.contract_dr,
        posting_card_number: carrierForm.posting_card_number,
        token_scope: carrierForm.auth_type === 'contract_credentials' ? 'contract' : carrierForm.auth_type === 'posting_card' ? 'posting_card' : 'user',
      }).filter(([, value]) => String(value || '').trim() !== '')
    );
    try {
      await api.saveCarrierAccount({
        provider: carrierForm.provider,
        account_name: carrierForm.account_name,
        auth_type: carrierForm.auth_type,
        is_active: carrierForm.is_active,
        sync_tracking: carrierForm.sync_tracking,
        credentials,
      }, activeTenant.id);
      setCarrierForm((prev) => ({ ...prev, access_token: '', token_password: '' }));
      setMessage({ type: 'success', text: 'Transportadora salva com sucesso.' });
      await loadTenantData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao salvar transportadora' });
    }
  };

  const handleToggleCarrier = async (id: number) => {
    if (!activeTenant) return;
    try {
      const updated = await api.toggleCarrierAccount(id, activeTenant.id);
      setCarrierAccounts((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setMessage({ type: 'success', text: `Transportadora ${updated.is_active ? 'ativada' : 'desativada'}.` });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao alternar transportadora' });
    }
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
  const lowStockItems = products.flatMap((product) => {
    const colorRows = product.color_stocks?.length
      ? product.color_stocks.map((stock) => ({ product, color: stock.color_name, qty: stock.stock_qty }))
      : [{ product, color: '', qty: product.stock_qty }];
    return colorRows.filter((item) => item.qty <= 3);
  });
  const stockAdjustmentProduct = products.find((product) => product.id === stockAdjustment.product_id) || products[0];
  const connectedCarriers = carrierAccounts.filter((account) => account.is_connected && account.is_active).length;
  const activeShipments = shipments.filter((shipment) => !['delivered', 'cancelled'].includes(shipment.status)).length;
  const integrationProblems = carrierHealth.filter((item) => item.last_error || !item.is_connected || !item.is_active).length;

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
                <h2 className="text-xl font-extrabold text-white">Painel Administrativo da Loja</h2>
                <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border border-emerald-500/30 uppercase">
                  Tenant #{activeTenant?.id}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Loja Ativa: <strong className="text-white">{activeTenant?.name}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {canSwitchTenants ? (
            <select
              value={activeTenant?.id}
              onChange={(e) => {
                const t = tenants.find((item) => item.id === parseInt(e.target.value));
                if (t) onSelectTenant(t);
              }}
              className="bg-chumbo-900 border border-chumbo-700 text-xs font-mono text-white rounded-xl px-3 py-2 focus:outline-none focus:border-laser-400"
            >
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  🏬 {t.name} (Tenant #{t.id})
                </option>
              ))}
            </select>
            ) : (
              <span className="bg-chumbo-900 border border-chumbo-700 text-xs font-mono text-white rounded-xl px-3 py-2">
                {activeTenant?.name || 'Loja'} #{activeTenant?.id}
              </span>
            )}

            <button
              onClick={onClose}
              className="p-2.5 rounded-full bg-chumbo-900 text-slate-400 hover:text-white border border-chumbo-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Abas do Painel */}
        <div className="bg-chumbo-950/80 px-6 border-b border-chumbo-800 flex items-center space-x-4 overflow-x-auto text-xs font-mono">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`py-3 px-4 border-b-2 flex items-center space-x-2 font-bold transition-all ${
              activeTab === 'dashboard'
                ? 'border-laser-400 text-laser-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Dashboard</span>
          </button>

          {isMasterAdmin && (
          <button
            onClick={() => setActiveTab('master')}
            className={`py-3 px-4 border-b-2 flex items-center space-x-2 font-bold transition-all ${
              activeTab === 'master'
                ? 'border-laser-400 text-laser-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Master</span>
          </button>
          )}

          <button
            onClick={() => setActiveTab('products')}
            className={`py-3 px-4 border-b-2 flex items-center space-x-2 font-bold transition-all ${
              activeTab === 'products'
                ? 'border-laser-400 text-laser-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Produtos ({products.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('categories')}
            className={`py-3 px-4 border-b-2 flex items-center space-x-2 font-bold transition-all ${
              activeTab === 'categories'
                ? 'border-laser-400 text-laser-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Tag className="w-4 h-4" />
            <span>Categorias ({categories.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('orders')}
            className={`py-3 px-4 border-b-2 flex items-center space-x-2 font-bold transition-all ${
              activeTab === 'orders'
                ? 'border-laser-400 text-laser-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Vendas / Pedidos ({orders.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('inventory')}
            className={`py-3 px-4 border-b-2 flex items-center space-x-2 font-bold transition-all ${
              activeTab === 'inventory'
                ? 'border-laser-400 text-laser-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Estoque</span>
          </button>

          <button
            onClick={() => setActiveTab('pricing')}
            className={`py-3 px-4 border-b-2 flex items-center space-x-2 font-bold transition-all ${
              activeTab === 'pricing'
                ? 'border-laser-400 text-laser-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Calculator className="w-4 h-4" />
            <span>Precificacao</span>
          </button>

          <button
            onClick={() => setActiveTab('finance')}
            className={`py-3 px-4 border-b-2 flex items-center space-x-2 font-bold transition-all ${
              activeTab === 'finance'
                ? 'border-laser-400 text-laser-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Financeiro</span>
          </button>

          <button
            onClick={() => setActiveTab('carriers')}
            className={`py-3 px-4 border-b-2 flex items-center space-x-2 font-bold transition-all ${
              activeTab === 'carriers'
                ? 'border-laser-400 text-laser-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>Transportadoras ({carrierAccounts.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`py-3 px-4 border-b-2 flex items-center space-x-2 font-bold transition-all ${
              activeTab === 'settings'
                ? 'border-laser-400 text-laser-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Configuracoes</span>
          </button>

          {canSwitchTenants && (
          <button
            onClick={() => setActiveTab('tenants')}
            className={`py-3 px-4 border-b-2 flex items-center space-x-2 font-bold transition-all ${
              activeTab === 'tenants'
                ? 'border-laser-400 text-laser-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Store className="w-4 h-4" />
            <span>Tenants ({tenants.length})</span>
          </button>
          )}

          <button
            onClick={() => setActiveTab('marketplaces')}
            className={`py-3 px-4 border-b-2 flex items-center space-x-2 font-bold transition-all ${
              activeTab === 'marketplaces'
                ? 'border-laser-400 text-laser-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Marketplaces ({marketplaces.length})</span>
          </button>
        </div>

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
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="rounded-2xl border border-chumbo-800 bg-chumbo-950/70 p-4">
                  <span className="block text-[10px] font-mono uppercase text-slate-500">Faturamento</span>
                  <strong className="mt-1 block text-xl text-white">R$ {dashboardRevenue.toFixed(2).replace('.', ',')}</strong>
                </div>
                <div className="rounded-2xl border border-chumbo-800 bg-chumbo-950/70 p-4">
                  <span className="block text-[10px] font-mono uppercase text-slate-500">Pedidos abertos</span>
                  <strong className="mt-1 block text-xl text-white">{pendingOrders}</strong>
                </div>
                <div className="rounded-2xl border border-chumbo-800 bg-chumbo-950/70 p-4">
                  <span className="block text-[10px] font-mono uppercase text-slate-500">Produtos ativos</span>
                  <strong className="mt-1 block text-xl text-white">{activeProducts}</strong>
                </div>
                <div className="rounded-2xl border border-chumbo-800 bg-chumbo-950/70 p-4">
                  <span className="block text-[10px] font-mono uppercase text-slate-500">Baixo estoque</span>
                  <strong className="mt-1 block text-xl text-white">{lowStockProducts}</strong>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-chumbo-800 bg-chumbo-950/60 p-4">
                  <h3 className="text-sm font-bold text-white">Pedidos recentes</h3>
                  <div className="mt-3 space-y-2">
                    {orders.slice(0, 5).map((order) => (
                      <div key={order.id} className="flex items-center justify-between rounded-xl border border-chumbo-800 bg-chumbo-900/60 p-3 text-xs">
                        <span className="font-mono text-slate-300">#{order.id} - {ORDER_STATUS_LABELS[order.status] || order.status}</span>
                        <strong className="text-white">R$ {order.total_amount.toFixed(2).replace('.', ',')}</strong>
                      </div>
                    ))}
                    {orders.length === 0 && <p className="text-xs text-slate-500">Nenhum pedido registrado.</p>}
                  </div>
                </div>

                <div className="rounded-2xl border border-chumbo-800 bg-chumbo-950/60 p-4">
                  <h3 className="text-sm font-bold text-white">Produtos para revisar</h3>
                  <div className="mt-3 space-y-2">
                    {products.filter((product) => product.status !== 'active' || product.stock_qty <= 3).slice(0, 5).map((product) => (
                      <div key={product.id} className="flex items-center justify-between rounded-xl border border-chumbo-800 bg-chumbo-900/60 p-3 text-xs">
                        <span className="truncate text-slate-300">{product.title}</span>
                        <span className="font-mono text-slate-500">{product.status} / {product.stock_qty} un</span>
                      </div>
                    ))}
                    {products.every((product) => product.status === 'active' && product.stock_qty > 3) && <p className="text-xs text-slate-500">Sem alertas de produto.</p>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'master' && isMasterAdmin && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-bold text-white">Visao plataforma</h3>
                <p className="text-xs text-slate-400">Tenants, contas conectadas e pontos operacionais do tenant selecionado.</p>
              </div>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="rounded-2xl border border-chumbo-800 bg-chumbo-950/70 p-4">
                  <span className="block text-[10px] font-mono uppercase text-slate-500">Tenants</span>
                  <strong className="mt-1 block text-xl text-white">{tenants.length}</strong>
                </div>
                <div className="rounded-2xl border border-chumbo-800 bg-chumbo-950/70 p-4">
                  <span className="block text-[10px] font-mono uppercase text-slate-500">Marketplaces</span>
                  <strong className="mt-1 block text-xl text-white">{marketplaces.filter((item) => item.is_active).length}</strong>
                </div>
                <div className="rounded-2xl border border-chumbo-800 bg-chumbo-950/70 p-4">
                  <span className="block text-[10px] font-mono uppercase text-slate-500">Transportadoras</span>
                  <strong className="mt-1 block text-xl text-white">{connectedCarriers}</strong>
                </div>
                <div className="rounded-2xl border border-chumbo-800 bg-chumbo-950/70 p-4">
                  <span className="block text-[10px] font-mono uppercase text-slate-500">Alertas integracao</span>
                  <strong className="mt-1 block text-xl text-white">{integrationProblems}</strong>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <div className="rounded-2xl border border-chumbo-800 bg-chumbo-950/60 p-4">
                  <h4 className="text-sm font-bold text-white">Tenants</h4>
                  <div className="mt-3 space-y-2">
                    {tenants.map((tenant) => (
                      <button
                        key={tenant.id}
                        onClick={() => onSelectTenant(tenant)}
                        className={`w-full rounded-xl border p-3 text-left text-xs transition-colors ${
                          activeTenant?.id === tenant.id ? 'border-laser-500/40 bg-laser-500/10 text-white' : 'border-chumbo-800 bg-chumbo-900/60 text-slate-300 hover:border-chumbo-700'
                        }`}
                      >
                        <strong className="block">{tenant.name}</strong>
                        <span className="font-mono text-slate-500">/{tenant.slug} - #{tenant.id}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-chumbo-800 bg-chumbo-950/60 p-4">
                  <h4 className="text-sm font-bold text-white">Contas conectadas</h4>
                  <div className="mt-3 space-y-2 text-xs">
                    {marketplaces.map((item) => (
                      <div key={item.id} className="flex items-center justify-between rounded-xl border border-chumbo-800 bg-chumbo-900/60 p-3">
                        <span className="font-semibold text-white">{MARKETPLACE_META[item.provider]?.label || item.provider}</span>
                        <span className={item.is_active ? 'text-emerald-300' : 'text-slate-500'}>{item.is_active ? 'ativo' : 'inativo'}</span>
                      </div>
                    ))}
                    {carrierAccounts.map((item) => (
                      <div key={`carrier-${item.id}`} className="flex items-center justify-between rounded-xl border border-chumbo-800 bg-chumbo-900/60 p-3">
                        <span className="font-semibold text-white">{item.account_name || item.provider}</span>
                        <span className={item.is_connected ? 'text-emerald-300' : 'text-amber-300'}>{item.is_connected ? 'conectado' : 'credencial pendente'}</span>
                      </div>
                    ))}
                    {marketplaces.length === 0 && carrierAccounts.length === 0 && (
                      <p className="py-6 text-center text-xs text-slate-500">Nenhuma conta conectada neste tenant.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-chumbo-800 bg-chumbo-950/60 p-4">
                  <h4 className="text-sm font-bold text-white">Saude operacional</h4>
                  <div className="mt-3 space-y-2 text-xs">
                    <div className="flex items-center justify-between rounded-xl border border-chumbo-800 bg-chumbo-900/60 p-3">
                      <span>Pagamentos Mercado Pago</span>
                      <span className="text-slate-300">webhook configuravel</span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-chumbo-800 bg-chumbo-900/60 p-3">
                      <span>Pedidos com envio ativo</span>
                      <span className="font-mono text-white">{activeShipments}</span>
                    </div>
                    {carrierHealth.map((item) => (
                      <div key={item.provider} className="rounded-xl border border-chumbo-800 bg-chumbo-900/60 p-3">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-white">{item.account_name || item.provider}</span>
                          <span className={item.last_error ? 'text-rose-300' : 'text-emerald-300'}>{item.last_error ? 'erro' : 'ok'}</span>
                        </div>
                        {item.last_error && <p className="mt-1 text-slate-500">{item.last_error}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 1: PRODUTOS */}
          {activeTab === 'products' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar produto por nome ou material..."
                    className="w-full bg-chumbo-950 border border-chumbo-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-laser-400"
                  />
                </div>

                <button
                  onClick={() => {
                    setEditingProduct(null);
                    setIsProductFormOpen(true);
                  }}
                  className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-white hover:bg-slate-200 text-chumbo-950 font-bold text-xs transition-all shadow-md active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>Novo Produto 3D</span>
                </button>
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

          {/* TAB 2: CATEGORIAS */}
          {activeTab === 'categories' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Formulário de Categoria */}
              <div className="bg-chumbo-950 p-5 rounded-2xl border border-chumbo-800 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <Plus className="w-4 h-4 text-laser-400" />
                  <span>Nova Categoria</span>
                </h3>
                <form onSubmit={handleCreateCategory} className="space-y-3 text-xs">
                  <div>
                    <label className="text-slate-400 block mb-1">Nome da Categoria</label>
                    <input
                      type="text"
                      required
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      placeholder="Ex: Engrenagens & Mecânica"
                      className="w-full bg-chumbo-900 border border-chumbo-750 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-laser-400"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Descrição Breve</label>
                    <input
                      type="text"
                      value={newCatDesc}
                      onChange={(e) => setNewCatDesc(e.target.value)}
                      placeholder="Ex: Peças técnicas de alta tolerância"
                      className="w-full bg-chumbo-900 border border-chumbo-750 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-laser-400"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Ícone (Lucide Icon)</label>
                    <input
                      type="text"
                      value={newCatIcon}
                      onChange={(e) => setNewCatIcon(e.target.value)}
                      placeholder="cpu, shield, wrench, sparkles"
                      className="w-full bg-chumbo-900 border border-chumbo-750 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-laser-400"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-white text-chumbo-950 font-bold hover:bg-slate-200 transition-all shadow-md"
                  >
                    Salvar Categoria
                  </button>
                </form>
              </div>

              {/* Lista de Categorias */}
              <div className="md:col-span-2 space-y-3">
                <h3 className="text-sm font-bold text-white">Categorias Cadastradas no Tenant #{activeTenant?.id}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {categories.map((c) => (
                    <div key={c.id} className="p-4 rounded-xl bg-chumbo-950/80 border border-chumbo-800 flex items-start space-x-3">
                      <div className="p-2.5 rounded-lg bg-chumbo-900 text-laser-400 border border-chumbo-700">
                        <Tag className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">{c.name}</h4>
                        <p className="text-xs text-slate-400 mt-0.5">{c.description || 'Sem descrição'}</p>
                        <span className="text-[10px] font-mono text-slate-500 mt-1 block">Slug: {c.slug}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

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
            <div className="space-y-5">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Controle de estoque</h3>
                  <p className="text-xs text-slate-400">Saldos atuais, alertas de reposicao e historico de movimentacoes.</p>
                </div>
                <span className="rounded-xl border border-chumbo-800 bg-chumbo-950 px-3 py-2 text-xs font-mono text-slate-300">
                  {lowStockItems.length} alerta(s) de baixo estoque
                </span>
              </div>

              <form onSubmit={handleAdjustStock} className="rounded-2xl border border-chumbo-800 bg-chumbo-950/60 p-4">
                <h4 className="text-sm font-bold text-white">Ajuste rapido</h4>
                <div className="mt-3 grid gap-3 md:grid-cols-[1.2fr_1fr_120px_1fr_auto]">
                  <select
                    value={stockAdjustment.product_id || stockAdjustmentProduct?.id || ''}
                    onChange={(event) => {
                      const productId = Number(event.target.value);
                      const product = products.find((item) => item.id === productId);
                      setStockAdjustment((prev) => ({
                        ...prev,
                        product_id: productId,
                        color_name: product?.color_stocks?.[0]?.color_name || '',
                        stock_qty: product?.color_stocks?.[0]?.stock_qty ?? product?.stock_qty ?? 0,
                      }));
                    }}
                    className="rounded-xl border border-chumbo-800 bg-chumbo-950 px-3 py-2 text-xs text-white"
                  >
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>{product.title}</option>
                    ))}
                  </select>
                  <select
                    value={stockAdjustment.color_name}
                    onChange={(event) => {
                      const colorName = event.target.value;
                      const stock = stockAdjustmentProduct?.color_stocks?.find((item) => item.color_name === colorName);
                      setStockAdjustment((prev) => ({ ...prev, color_name: colorName, stock_qty: stock?.stock_qty ?? stockAdjustmentProduct?.stock_qty ?? 0 }));
                    }}
                    className="rounded-xl border border-chumbo-800 bg-chumbo-950 px-3 py-2 text-xs text-white"
                  >
                    <option value="">Estoque geral</option>
                    {stockAdjustmentProduct?.color_stocks?.map((stock) => (
                      <option key={stock.color_name} value={stock.color_name}>{stock.color_name}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={0}
                    value={stockAdjustment.stock_qty}
                    onChange={(event) => setStockAdjustment((prev) => ({ ...prev, stock_qty: Number(event.target.value) || 0 }))}
                    className="rounded-xl border border-chumbo-800 bg-chumbo-950 px-3 py-2 text-xs text-white"
                  />
                  <input
                    value={stockAdjustment.reason}
                    onChange={(event) => setStockAdjustment((prev) => ({ ...prev, reason: event.target.value }))}
                    placeholder="Motivo"
                    className="rounded-xl border border-chumbo-800 bg-chumbo-950 px-3 py-2 text-xs text-white"
                  />
                  <button type="submit" className="rounded-xl bg-white px-4 py-2 text-xs font-bold text-chumbo-950 hover:bg-slate-200">
                    Ajustar
                  </button>
                </div>
              </form>

              <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                <div className="rounded-2xl border border-chumbo-800 bg-chumbo-950/60 p-4">
                  <h4 className="text-sm font-bold text-white">Alertas</h4>
                  <div className="mt-3 space-y-2">
                    {lowStockItems.map(({ product, color, qty }) => (
                      <div key={`${product.id}-${color || 'base'}`} className="flex items-center justify-between rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs">
                        <div className="min-w-0">
                          <strong className="block truncate text-white">{product.title}</strong>
                          <span className="text-slate-400">{color || 'Estoque geral'}</span>
                        </div>
                        <span className="rounded-lg bg-amber-400 px-2 py-1 font-mono font-bold text-chumbo-950">{qty} un</span>
                      </div>
                    ))}
                    {lowStockItems.length === 0 && (
                      <p className="py-6 text-center text-xs text-slate-500">Nenhum produto abaixo do limite de alerta.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-chumbo-800 bg-chumbo-950/60 p-4">
                  <h4 className="text-sm font-bold text-white">Ultimas movimentacoes</h4>
                  <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
                    {stockMovements.map((movement) => (
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
                    {stockMovements.length === 0 && (
                      <p className="py-6 text-center text-xs text-slate-500">Nenhuma movimentacao registrada ainda.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: PRECIFICACAO */}
          {activeTab === 'pricing' && (
            <div className="space-y-6">
              <PricingCalculator
                products={products}
                tenantId={activeTenant?.id}
                tenantSettings={tenantSettings}
                onSettingsSaved={setTenantSettings}
              />
              <PricingManagementPanel tenantId={activeTenant?.id} products={products} />
            </div>
          )}

          {activeTab === 'finance' && (
            <FinancePanel tenantId={activeTenant?.id} products={products} />
          )}

          {activeTab === 'carriers' && (
            <div className="space-y-6">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Transportadoras e rastreamento</h3>
                  <p className="text-xs text-slate-400">Credenciais por tenant, sync de tracking e saude da integracao.</p>
                </div>
                <button
                  onClick={handleSyncAllTracking}
                  disabled={syncingShipmentId === 'all' || shipments.length === 0}
                  className="flex items-center justify-center gap-2 rounded-xl border border-chumbo-700 bg-chumbo-950 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-chumbo-800 disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 ${syncingShipmentId === 'all' ? 'animate-spin' : ''}`} />
                  Sincronizar rastreios
                </button>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                <form onSubmit={handleSaveCarrierAccount} className="rounded-2xl border border-chumbo-800 bg-chumbo-950/60 p-4">
                  <h4 className="flex items-center gap-2 text-sm font-bold text-white">
                    <Truck className="h-4 w-4 text-laser-400" />
                    Conta Correios
                  </h4>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-mono uppercase text-slate-400">Provider</label>
                      <select
                        value={carrierForm.provider}
                        onChange={(event) => setCarrierForm((prev) => ({ ...prev, provider: event.target.value }))}
                        className="w-full rounded-xl border border-chumbo-800 bg-chumbo-950 px-3 py-2 text-xs text-white"
                      >
                        <option value="correios">Correios</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-mono uppercase text-slate-400">Nome da conta</label>
                      <input
                        value={carrierForm.account_name}
                        onChange={(event) => setCarrierForm((prev) => ({ ...prev, account_name: event.target.value }))}
                        className="w-full rounded-xl border border-chumbo-800 bg-chumbo-950 px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-mono uppercase text-slate-400">Tipo de autenticacao</label>
                      <select
                        value={carrierForm.auth_type}
                        onChange={(event) => setCarrierForm((prev) => ({ ...prev, auth_type: event.target.value }))}
                        className="w-full rounded-xl border border-chumbo-800 bg-chumbo-950 px-3 py-2 text-xs text-white"
                      >
                        <option value="bearer_token">Bearer token pronto</option>
                        <option value="user">API Token por usuario</option>
                        <option value="contract_credentials">API Token por contrato</option>
                        <option value="posting_card">API Token por cartao postagem</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-mono uppercase text-slate-400">Access token</label>
                      <input
                        type="password"
                        value={carrierForm.access_token}
                        onChange={(event) => setCarrierForm((prev) => ({ ...prev, access_token: event.target.value }))}
                        placeholder="Opcional se usar API Token"
                        className="w-full rounded-xl border border-chumbo-800 bg-chumbo-950 px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-mono uppercase text-slate-400">Usuario/token login</label>
                      <input
                        value={carrierForm.token_username}
                        onChange={(event) => setCarrierForm((prev) => ({ ...prev, token_username: event.target.value }))}
                        placeholder="idCorreios"
                        className="w-full rounded-xl border border-chumbo-800 bg-chumbo-950 px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-mono uppercase text-slate-400">Senha/codigo API</label>
                      <input
                        type="password"
                        value={carrierForm.token_password}
                        onChange={(event) => setCarrierForm((prev) => ({ ...prev, token_password: event.target.value }))}
                        className="w-full rounded-xl border border-chumbo-800 bg-chumbo-950 px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-mono uppercase text-slate-400">Contrato</label>
                      <input
                        value={carrierForm.contract_number}
                        onChange={(event) => setCarrierForm((prev) => ({ ...prev, contract_number: event.target.value }))}
                        className="w-full rounded-xl border border-chumbo-800 bg-chumbo-950 px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-mono uppercase text-slate-400">DR</label>
                      <input
                        value={carrierForm.contract_dr}
                        onChange={(event) => setCarrierForm((prev) => ({ ...prev, contract_dr: event.target.value }))}
                        className="w-full rounded-xl border border-chumbo-800 bg-chumbo-950 px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-mono uppercase text-slate-400">Cartao postagem</label>
                      <input
                        value={carrierForm.posting_card_number}
                        onChange={(event) => setCarrierForm((prev) => ({ ...prev, posting_card_number: event.target.value }))}
                        className="w-full rounded-xl border border-chumbo-800 bg-chumbo-950 px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-mono uppercase text-slate-400">Rastro base URL</label>
                      <input
                        value={carrierForm.api_base_url}
                        onChange={(event) => setCarrierForm((prev) => ({ ...prev, api_base_url: event.target.value }))}
                        placeholder="usa env do backend se vazio"
                        className="w-full rounded-xl border border-chumbo-800 bg-chumbo-950 px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-mono uppercase text-slate-400">Token base URL</label>
                      <input
                        value={carrierForm.token_base_url}
                        onChange={(event) => setCarrierForm((prev) => ({ ...prev, token_base_url: event.target.value }))}
                        placeholder="usa env do backend se vazio"
                        className="w-full rounded-xl border border-chumbo-800 bg-chumbo-950 px-3 py-2 text-xs text-white"
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <label className="flex items-center gap-2 rounded-xl border border-chumbo-800 bg-chumbo-900 px-4 py-2 text-xs text-slate-300">
                      <input type="checkbox" checked={carrierForm.is_active} onChange={(event) => setCarrierForm((prev) => ({ ...prev, is_active: event.target.checked }))} />
                      Ativa
                    </label>
                    <label className="flex items-center gap-2 rounded-xl border border-chumbo-800 bg-chumbo-900 px-4 py-2 text-xs text-slate-300">
                      <input type="checkbox" checked={carrierForm.sync_tracking} onChange={(event) => setCarrierForm((prev) => ({ ...prev, sync_tracking: event.target.checked }))} />
                      Sync tracking
                    </label>
                    <button type="submit" className="rounded-xl bg-white px-5 py-2 text-xs font-bold text-chumbo-950 hover:bg-slate-200">
                      Salvar Correios
                    </button>
                  </div>
                </form>

                <div className="rounded-2xl border border-chumbo-800 bg-chumbo-950/60 p-4">
                  <h4 className="flex items-center gap-2 text-sm font-bold text-white">
                    <Activity className="h-4 w-4 text-laser-400" />
                    Saude e contas
                  </h4>
                  <div className="mt-4 space-y-3">
                    {carrierAccounts.map((account) => (
                      <div key={account.id} className="rounded-xl border border-chumbo-800 bg-chumbo-900/60 p-3 text-xs">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <strong className="block text-white">{account.account_name || account.provider}</strong>
                            <span className="font-mono text-slate-500">{account.provider} - {account.auth_type}</span>
                          </div>
                          <button
                            onClick={() => handleToggleCarrier(account.id)}
                            title={account.is_active ? 'Desativar' : 'Ativar'}
                            className="text-slate-400 hover:text-white"
                          >
                            {account.is_active ? <ToggleRight className="h-8 w-8 text-emerald-400" /> : <ToggleLeft className="h-8 w-8 text-slate-500" />}
                          </button>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className={account.is_connected ? 'rounded-full bg-emerald-500/20 px-2 py-1 text-emerald-300' : 'rounded-full bg-amber-500/20 px-2 py-1 text-amber-300'}>
                            {account.is_connected ? 'conectada' : 'credencial pendente'}
                          </span>
                          <span className={account.sync_tracking ? 'rounded-full bg-laser-500/20 px-2 py-1 text-laser-400' : 'rounded-full bg-chumbo-800 px-2 py-1 text-slate-500'}>
                            sync {account.sync_tracking ? 'ligado' : 'desligado'}
                          </span>
                        </div>
                        {account.last_sync_at && <p className="mt-2 text-[10px] text-slate-500">Ultimo sync: {new Date(account.last_sync_at).toLocaleString('pt-BR')}</p>}
                        {account.last_error && <p className="mt-2 rounded-lg bg-rose-500/10 p-2 text-rose-300">{account.last_error}</p>}
                      </div>
                    ))}
                    {carrierAccounts.length === 0 && (
                      <p className="py-8 text-center text-xs text-slate-500">Nenhuma transportadora cadastrada para este tenant.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && tenantSettings && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-bold text-white">Configuracoes da loja</h3>
                <p className="mt-1 text-xs text-slate-400">Identidade da vitrine, formas de entrega e presets usados como base para precificacao.</p>
              </div>

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

              <div className="grid gap-3 md:grid-cols-4">
                {[
                  ['default_spool_price', 'Preco rolo'],
                  ['default_spool_weight', 'Peso rolo'],
                  ['default_printer_power_kw', 'Potencia kW'],
                  ['default_energy_tariff', 'Energia R$/kWh'],
                  ['default_packaging_cost', 'Embalagem'],
                  ['default_labor_cost', 'Mao de obra'],
                  ['default_extra_cost', 'Extras'],
                  ['default_failure_rate_percent', 'Falha %'],
                  ['default_margin_percent', 'Margem %'],
                  ['default_platform_fee_percent', 'Plataforma %'],
                  ['default_payment_fee_percent', 'Pagamento %'],
                  ['default_fixed_fee', 'Taxa fixa'],
                ].map(([field, label]) => (
                  <div key={field} className="space-y-1.5">
                    <label className="text-xs font-mono uppercase text-slate-400">{label}</label>
                    <input
                      type="number"
                      step="0.01"
                      value={Number(tenantSettings[field as keyof TenantSettings]) || 0}
                      onChange={(e) => updateTenantSetting(field as keyof TenantSettings, Number(e.target.value) || 0)}
                      className="w-full rounded-xl border border-chumbo-800 bg-chumbo-950 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-laser-400"
                    />
                  </div>
                ))}
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

          {/* TAB 5: TENANTS / LOJAS */}
          {activeTab === 'tenants' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">Lojas (Tenants) Disponíveis no Sistema</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {tenants.map((t) => (
                  <div
                    key={t.id}
                    className={`p-5 rounded-2xl border transition-all ${
                      activeTenant?.id === t.id
                        ? 'bg-laser-500/10 border-laser-500/40 text-white'
                        : 'bg-chumbo-950/60 border-chumbo-800 text-slate-300 hover:border-chumbo-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-extrabold text-base text-white flex items-center space-x-2">
                        <Store className="w-5 h-5 text-laser-400" />
                        <span>{t.name}</span>
                      </span>
                      {activeTenant?.id === t.id && (
                        <span className="bg-laser-400 text-chumbo-950 font-mono font-bold text-[10px] px-2 py-0.5 rounded-full">
                          LOJA ATIVA
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 font-mono">Slug: {t.slug} • Tenant ID #{t.id}</p>
                    
                    <button
                      onClick={() => onSelectTenant(t)}
                      className={`mt-4 w-full py-2 rounded-xl font-bold text-xs transition-all ${
                        activeTenant?.id === t.id
                          ? 'bg-chumbo-800 text-slate-300 cursor-default'
                          : 'bg-white text-chumbo-950 hover:bg-slate-200'
                      }`}
                    >
                      {activeTenant?.id === t.id ? 'Loja Selecionada' : 'Alternar para esta Loja'}
                    </button>
                  </div>
                ))}
              </div>
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

              {/* Cards dos Marketplaces */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(['mercadolivre', 'shopee', 'amazon'] as const).map((provider) => {
                  const meta = MARKETPLACE_META[provider];
                  const integration = marketplaces.find((m) => m.provider === provider);
                  const isActive = integration?.is_active ?? false;
                  const isSimulating = simulatingProvider === provider;

                  return (
                    <div key={provider} className={`rounded-2xl border p-5 space-y-4 transition-all ${isActive ? `${meta.bg} ${meta.border}` : 'bg-chumbo-950/60 border-chumbo-800'}`}>
                      {/* Header do Card */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="text-2xl">{meta.icon}</span>
                          <div>
                            <span className={`text-sm font-extrabold ${isActive ? meta.color : 'text-slate-300'}`}>{meta.label}</span>
                            {integration && (
                              <p className="text-[10px] text-slate-400 font-mono mt-0.5 truncate max-w-[130px]">{integration.seller_name}</p>
                            )}
                          </div>
                        </div>
                        {/* Toggle de Ativação */}
                        <button
                          onClick={() => integration && handleToggleMarketplace(integration.id)}
                          disabled={!integration}
                          title={isActive ? 'Desativar integração' : 'Ativar integração'}
                          className={`transition-all ${!integration ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          {isActive
                            ? <ToggleRight className={`w-8 h-8 ${meta.color}`} />
                            : <ToggleLeft className="w-8 h-8 text-slate-500" />}
                        </button>
                      </div>

                      {/* Status Badge */}
                      <div className="flex items-center space-x-2">
                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${isActive ? `${meta.badge}` : 'bg-chumbo-800 text-slate-400'}`}>
                          {isActive ? '● CONECTADO' : '○ PENDENTE'}
                        </span>
                        {integration && (
                          <span className="text-[10px] text-slate-500 font-mono truncate">ID: {integration.seller_id}</span>
                        )}
                      </div>

                      {/* Chaves de Sincronização */}
                      {integration && (
                        <div className="space-y-1 text-xs">
                          <div className="flex items-center justify-between text-slate-400">
                            <span>Importar Pedidos</span>
                            <span className={integration.sync_orders ? 'text-emerald-400 font-bold' : 'text-slate-500'}>{
                              integration.sync_orders ? '✓ Ativo' : '✗ Inativo'
                            }</span>
                          </div>
                          <div className="flex items-center justify-between text-slate-400">
                            <span>Sync de Estoque</span>
                            <span className={integration.sync_stock ? 'text-emerald-400 font-bold' : 'text-slate-500'}>{
                              integration.sync_stock ? '✓ Ativo' : '✗ Inativo'
                            }</span>
                          </div>
                        </div>
                      )}

                      {/* Botao de teste manual */}
                      <button
                        onClick={() => handleSimulateOrder(provider)}
                        disabled={isSimulating || !isActive}
                        className={`w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all ${
                          isActive
                            ? `${meta.bg} ${meta.color} border ${meta.border} hover:opacity-80 active:scale-95`
                            : 'bg-chumbo-900 text-slate-600 cursor-not-allowed border border-chumbo-800'
                        }`}
                      >
                        {isSimulating ? (
                          <><RefreshCw className="w-3.5 h-3.5 animate-spin" /><span>Testando...</span></>
                        ) : (
                          <><Zap className="w-3.5 h-3.5" /><span>Testar entrada de pedido</span></>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Tabela de Mapeamento de Produtos por Marketplace */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">Catalogo mapeado por marketplace</h3>
                  <span className="text-xs text-slate-400 font-mono">{mappings.length} mapeamento(s)</span>
                </div>

                {/* Mapeamento rapido por produto */}
                <div className="rounded-2xl border border-chumbo-800 overflow-hidden bg-chumbo-950/60">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-chumbo-950 text-slate-400 font-mono uppercase text-[10px]">
                      <tr>
                        <th className="p-3">Produto</th>
                        <th className="p-3">Mapear em</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Anúncio Externo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-chumbo-850 text-slate-300">
                      {products.slice(0, 5).map((p) => (
                        <tr key={p.id} className="hover:bg-chumbo-850/50 transition-colors">
                          <td className="p-3">
                            <div className="flex items-center space-x-2">
                              <img src={p.image_url} alt={p.title} className="w-8 h-8 rounded-lg object-cover border border-chumbo-700" />
                              <div>
                                <span className="font-semibold text-white block truncate max-w-[160px]">{p.title}</span>
                                <span className="text-[10px] text-slate-500 font-mono">R$ {p.price.toFixed(2).replace('.', ',')}</span>
                              </div>
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center space-x-1.5">
                              {(['mercadolivre', 'shopee', 'amazon'] as const).map((prov) => {
                                const meta = MARKETPLACE_META[prov];
                                const isSyncing = syncingProduct?.productId === p.id && syncingProduct?.provider === prov;
                                const isMapped = mappings.some((m) => m.product_id === p.id && m.provider === prov);
                                return (
                                  <button
                                    key={prov}
                                    onClick={() => handleSyncProduct(p.id, prov)}
                                    disabled={isSyncing}
                                    title={`Preparar mapeamento com ${meta.label}`}
                                    className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                                      isMapped
                                        ? `${meta.bg} ${meta.color} ${meta.border}`
                                        : 'bg-chumbo-900 text-slate-500 border-chumbo-700 hover:border-chumbo-600'
                                    }`}
                                  >
                                    {isSyncing ? '...' : `${meta.icon} ${meta.label.split(' ')[0]}`}
                                  </button>
                                );
                              })}
                            </div>
                          </td>
                          <td className="p-3">
                            {mappings.filter((m) => m.product_id === p.id).length > 0 ? (
                              <span className="text-emerald-400 font-bold text-[10px] font-mono">Mapeado</span>
                            ) : (
                              <span className="text-slate-500 text-[10px] font-mono">Nao mapeado</span>
                            )}
                          </td>
                          <td className="p-3">
                            <div className="space-y-0.5">
                              {mappings.filter((m) => m.product_id === p.id).map((m) => (
                                <a
                                  key={m.id}
                                  href={m.external_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`flex items-center space-x-1 text-[10px] ${MARKETPLACE_META[m.provider]?.color || 'text-slate-400'} hover:underline`}
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  <span className="font-mono truncate max-w-[130px]">{m.external_item_id}</span>
                                </a>
                              ))}
                              {mappings.filter((m) => m.product_id === p.id).length === 0 && (
                                <span className="text-slate-600 text-[10px] font-mono">–</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {products.length === 0 && (
                        <tr>
                          <td colSpan={4} className="p-8 text-center text-slate-400 font-mono text-xs">
                            Nenhum produto cadastrado para sincronizar.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
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
