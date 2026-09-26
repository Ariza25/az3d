import React from 'react';
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
} from '../../../types';
import { Modal, TabItem } from '../../../components/ui';
import { ProductFormModal } from '../../../components/ProductFormModal';
import {
  PricingCalculator,
  PricingManagementPanel,
  ProductionCostsPanel,
  FinancePanel,
  MarketplaceConnectionsPanel,
  CarrierSettingsPanel,
  MarketplaceIntelligencePanel,
} from './panels';
import { AdminDashboard } from './AdminDashboard';
import { AdminInventory } from './AdminInventory';
import { MercadoPagoSettings } from './MercadoPagoSettings';
import { TenantOrdersPipelinePanel } from './TenantOrdersPipelinePanel';
import { TenantFilamentInventoryPanel } from './TenantFilamentInventoryPanel';
import { AdminProductsTab } from './AdminProductsTab';
import { AdminOrdersTab } from './AdminOrdersTab';
import { ImageConverterTab } from './ImageConverterTab';
import { ThreeMfSplitterTab } from './ThreeMfSplitterTab';
import { TenantChatPanel } from './TenantChatPanel';
import { PromotionsManagementPanel } from './PromotionsManagementPanel';
import {
  Store,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
} from 'lucide-react';

export type AdminSection =
  | 'dashboard'
  | 'products'
  | 'orders'
  | 'promotions'
  | 'chat'
  | 'pipeline'
  | 'inventory'
  | 'filaments'
  | 'pricing'
  | 'split_3mf'
  | 'finance'
  | 'settings'
  | 'marketplaces'
  | 'intelligence'
  | 'image_converter';

export interface AdminModalViewProps {
  isOpen: boolean;
  onClose: () => void;
  variant?: 'modal' | 'page';
  activeTenant: Tenant | null;
  userEmail?: string;
  activeTab: AdminSection;
  onSelectTab: (tab: AdminSection) => void;
  tenantNavigation: TabItem<AdminSection>[];
  message: { type: 'success' | 'error'; text: string } | null;
  onClearMessage: () => void;
  onMessage: (msg: { type: 'success' | 'error'; text: string }) => void;

  // Products
  products: Product[];
  categories: Category[];
  isProductFormOpen: boolean;
  editingProduct: Product | null;
  onOpenCreateProduct: () => void;
  onOpenEditProduct: (product: Product) => void;
  onCloseProductForm: () => void;
  onSaveProduct: (productData: ProductInput) => Promise<void>;
  onDeleteProduct: (productId: number) => void;
  onRefreshProducts: () => void;
  onRefreshCategories?: () => void;

  // Orders & Shipments
  orders: Order[];
  shipments: OrderShipment[];
  shipmentForm: { order_id: number; carrier: string; tracking_code: string };
  syncingShipmentId: number | 'all' | null;
  setShipmentForm: React.Dispatch<React.SetStateAction<{ order_id: number; carrier: string; tracking_code: string }>>;
  onSaveShipment: (e: React.FormEvent) => void;
  onSyncAllTracking: () => void;
  onStatusChange: (orderId: number, newStatus: string) => void;
  onRefreshPipelineOrders: () => void;

  // Inventory
  lowStockItems: Array<{
    product: Product;
    color: string;
    qty: number;
    severity: string;
    alert: StockAlert | null;
  }>;
  stockAdjustment: {
    product_id: number;
    color_name: string;
    stock_qty: number;
    reason: string;
  };
  stockAdjustmentProduct?: Product;
  stockMovementProductId: number | '';
  filteredStockMovements: StockMovement[];
  onStockAdjustmentChange: React.Dispatch<React.SetStateAction<{
    product_id: number;
    color_name: string;
    stock_qty: number;
    reason: string;
  }>>;
  onStockMovementProductChange: (id: number | '') => void;
  onAdjustStock: (e: React.FormEvent) => void;
  onPrepareRestock: (alert: StockAlert) => void;

  // Carrier & Marketplaces
  carrierAccounts: TenantCarrierAccount[];
  setCarrierAccounts: React.Dispatch<React.SetStateAction<TenantCarrierAccount[]>>;
  mappings: MarketplaceProductMapping[];
  setMappings: React.Dispatch<React.SetStateAction<MarketplaceProductMapping[]>>;
  onProductsImported: () => void;

  // Dashboard Stats
  dashboardRevenue: number;
  pendingOrders: number;
  activeProducts: number;
  lowStockProducts: number;
  orderStatusLabels: Record<string, string>;
}

export const AdminModalView: React.FC<AdminModalViewProps> = ({
  isOpen,
  onClose,
  variant = 'modal',
  activeTenant,
  userEmail,
  activeTab,
  onSelectTab,
  tenantNavigation,
  message,
  onClearMessage,
  onMessage,
  // Products
  products,
  categories,
  isProductFormOpen,
  editingProduct,
  onOpenCreateProduct,
  onOpenEditProduct,
  onCloseProductForm,
  onSaveProduct,
  onDeleteProduct,
  onRefreshProducts,
  onRefreshCategories,
  // Orders
  orders,
  shipments,
  shipmentForm,
  syncingShipmentId,
  setShipmentForm,
  onSaveShipment,
  onSyncAllTracking,
  onStatusChange,
  onRefreshPipelineOrders,
  // Inventory
  lowStockItems,
  stockAdjustment,
  stockAdjustmentProduct,
  stockMovementProductId,
  filteredStockMovements,
  onStockAdjustmentChange,
  onStockMovementProductChange,
  onAdjustStock,
  onPrepareRestock,
  // Settings / Carrier / Marketplaces
  carrierAccounts,
  setCarrierAccounts,
  mappings,
  setMappings,
  onProductsImported,
  // Dashboard
  dashboardRevenue,
  pendingOrders,
  activeProducts,
  lowStockProducts,
  orderStatusLabels,
}) => {
  const modalTitle = (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-300 bg-cyan-700 text-white dark:border-laser-500/30 dark:bg-laser-500/10 dark:text-laser-400">
        <Store className="h-5 w-5" />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
            Gestão da loja — {`${activeTenant?.name}`}
          </h1>
        </div>
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      variant={variant}
      title={modalTitle}
      maxWidth="6xl"
    >
      <div className="flex flex-col lg:flex-row items-start gap-6 lg:gap-8">
        {/* Mobile Horizontal Navigation Tabs */}
        <div className="lg:hidden w-full overflow-x-auto pb-2 -mt-2">
          <nav className="flex items-center gap-1.5 min-w-max p-1.5 rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-chumbo-800 dark:bg-chumbo-900/60 dark:backdrop-blur-md">
            {tenantNavigation.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-cyan-600 text-white shadow-md font-extrabold dark:bg-laser-400 dark:text-chumbo-950'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-chumbo-800/80 dark:hover:text-white'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {item.badge !== undefined && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-extrabold ${
                        isActive
                          ? 'bg-white/20 text-white dark:bg-chumbo-950/20 dark:text-chumbo-950'
                          : 'border border-slate-200 bg-slate-100 text-slate-600 dark:border-transparent dark:bg-chumbo-800 dark:text-slate-300'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Desktop Vertical Sidebar */}
        <aside className="hidden lg:flex w-64 xl:w-72 shrink-0 flex-col gap-3.5 sticky top-24">
          {/* Tenant & User Info Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-chumbo-800 dark:bg-chumbo-900/60 dark:backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-laser-500/30 dark:bg-laser-500/10 dark:text-laser-400">
                <Store className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <strong className="block truncate text-xs font-bold text-slate-900 dark:text-white">
                  {`${activeTenant?.name}`}
                </strong>
              </div>
            </div>
            {userEmail && (
              <p className="mt-2.5 truncate border-t border-slate-100 pt-2 text-[11px] text-slate-500 dark:border-chumbo-800/80 dark:text-slate-400">
                {userEmail}
              </p>
            )}
          </div>

          {/* Navigation Menu Links */}
          <nav className="space-y-1 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-chumbo-800 dark:bg-chumbo-900/40 dark:backdrop-blur-sm">
            {tenantNavigation.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  className={`group flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all duration-150 ${
                    isActive
                      ? 'bg-cyan-600 text-white font-bold shadow-sm dark:bg-laser-400 dark:text-chumbo-950'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-chumbo-800/80 dark:hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`shrink-0 ${
                        isActive
                          ? 'text-white dark:text-chumbo-950'
                          : 'text-slate-400 group-hover:text-slate-900 dark:text-slate-400 dark:group-hover:text-white'
                      }`}
                    >
                      {item.icon}
                    </span>
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span
                      className={`ml-2 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        isActive
                          ? 'bg-white/20 text-white dark:bg-chumbo-950/20 dark:text-chumbo-950'
                          : 'border border-slate-200 bg-slate-100 text-slate-600 group-hover:bg-slate-200 dark:border-transparent dark:bg-chumbo-800 dark:text-slate-300 dark:group-hover:bg-chumbo-700'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Return button in sidebar */}
          <button
            type="button"
            onClick={onClose}
            className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-600 shadow-sm transition-colors hover:bg-slate-100 hover:text-slate-900 dark:border-chumbo-800 dark:bg-chumbo-900/40 dark:text-slate-400 dark:hover:bg-chumbo-800 dark:hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Voltar para a loja</span>
          </button>
        </aside>

        {/* Main Content Area with Natural Vertical Scroll */}
        <div className="flex-1 min-w-0 w-full space-y-6">
          {message && (
            <div
              className={`flex items-center justify-between rounded-2xl border p-3.5 text-xs shadow-sm ${
                message.type === 'success'
                  ? 'border-emerald-800 bg-emerald-700 text-white dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
                  : 'border-rose-800 bg-rose-700 text-white dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300'
              }`}
            >
              <div className="flex items-center gap-2.5 font-semibold">
                {message.type === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-white dark:text-emerald-300" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0 text-white dark:text-rose-400" />
                )}
                <span>{message.text}</span>
              </div>
              <button
                onClick={onClearMessage}
                className="opacity-80 hover:opacity-100 p-1 transition-opacity text-white"
                aria-label="Fechar mensagem"
              >
                ✕
              </button>
            </div>
          )}

          <div className="min-w-0">
            {activeTab === 'dashboard' && (
              <AdminDashboard
                orders={orders}
                products={products}
                revenue={dashboardRevenue}
                pendingOrders={pendingOrders}
                activeProducts={activeProducts}
                lowStockProducts={lowStockProducts}
                orderStatusLabels={orderStatusLabels}
              />
            )}

            {activeTab === 'pipeline' && (
              <TenantOrdersPipelinePanel
                orders={orders}
                tenantId={activeTenant?.id}
                onRefreshOrders={onRefreshPipelineOrders}
              />
            )}

            {activeTab === 'filaments' && <TenantFilamentInventoryPanel tenantId={activeTenant?.id} />}

            {activeTab === 'products' && (
              <AdminProductsTab
                products={products}
                categories={categories}
                activeTenant={activeTenant}
                onEditProduct={onOpenEditProduct}
                onCreateProduct={onOpenCreateProduct}
                onDeleteProduct={onDeleteProduct}
                onRefreshProducts={onRefreshProducts}
                onRefreshCategories={onRefreshCategories}
                onMessage={onMessage}
              />
            )}

            {activeTab === 'orders' && (
              <AdminOrdersTab
                orders={orders}
                shipments={shipments}
                shipmentForm={shipmentForm}
                syncingShipmentId={syncingShipmentId}
                setShipmentForm={setShipmentForm}
                onSaveShipment={onSaveShipment}
                onSyncAllTracking={onSyncAllTracking}
                onStatusChange={onStatusChange}
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
                onStockAdjustmentChange={onStockAdjustmentChange}
                onStockMovementProductChange={onStockMovementProductChange}
                onAdjustStock={onAdjustStock}
                onPrepareRestock={onPrepareRestock}
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
                onProductsImported={onProductsImported}
                onMessage={onMessage}
              />
            )}

            {activeTab === 'intelligence' && (
              <MarketplaceIntelligencePanel tenantId={activeTenant?.id} products={products} />
            )}

            {activeTab === 'promotions' && <PromotionsManagementPanel tenantId={activeTenant?.id} />}

            {activeTab === 'image_converter' && <ImageConverterTab />}

            {activeTab === 'split_3mf' && <ThreeMfSplitterTab />}

            {activeTab === 'chat' && <TenantChatPanel tenantId={activeTenant?.id} />}

            {activeTab === 'settings' && (
              <div className="space-y-6">
                <CarrierSettingsPanel
                  tenantId={activeTenant?.id}
                  accounts={carrierAccounts}
                  onAccountsChanged={setCarrierAccounts}
                  onMessage={onMessage}
                />
                {activeTenant && <MercadoPagoSettings tenantId={activeTenant.id} />}
              </div>
            )}
          </div>
        </div>
      </div>

      <ProductFormModal
        isOpen={isProductFormOpen}
        onClose={onCloseProductForm}
        productToEdit={editingProduct}
        categories={categories}
        onSave={onSaveProduct}
      />
    </Modal>
  );
};
