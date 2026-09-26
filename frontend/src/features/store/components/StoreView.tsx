import React from 'react';
import { Category, Product, Tenant, TenantSettings } from '../../../types';
import { Navbar } from '../../../components/Navbar';
import { Hero } from '../../../components/Hero';
import { CategoryFilter } from '../../../components/CategoryFilter';
import { ProductGrid } from '../../../components/ProductGrid';
import { ProductModal } from '../../../components/ProductModal';
import { CartDrawer } from '../../../components/CartDrawer';
import { LoginModal } from '../../../components/LoginModal';
import { RegisterModal } from '../../../components/RegisterModal';
import { UserSettingsModal } from '../../../components/UserSettingsModal';
import { Footer } from '../../../components/Footer';
import { FavoritesModal } from '../../../components/FavoritesModal';
import { ChatWidget } from '../../../components/ChatWidget';
import { StoreFilters, AvailabilityFilter, StoreSort } from '../../../components/StoreFilters';
import { PaymentReturnBanner } from './PaymentReturnBanner';
import { CartNoticeToast } from './CartNoticeToast';
import { MobileCartBar } from './MobileCartBar';

export interface StoreViewProps {
  activeTenant: Tenant | null;
  tenantSettings: TenantSettings | null;
  categories: Category[];
  activeCategory: string;
  searchQuery: string;
  sortBy: StoreSort;
  materialFilter: string;
  availabilityFilter: AvailabilityFilter;
  maxPrice: number;
  priceCeiling: number;
  materialOptions: string[];
  featuredProduct?: Product;
  visibleProducts: Product[];
  isLoading: boolean;
  selectedProduct: Product | null;
  paymentReturn: { status: string; orderId: string } | null;
  isLoginOpen: boolean;
  isRegisterOpen: boolean;
  isFavoritesOpen: boolean;
  isSettingsOpen: boolean;
  loginContext: 'default' | 'cart';
  cartNotice: { title: string; text: string } | null;
  totalItems: number;
  totalPrice: number;
  onOpenLogin: () => void;
  onCloseLogin: () => void;
  onOpenRegister: () => void;
  onCloseRegister: () => void;
  onOpenFavorites: () => void;
  onCloseFavorites: () => void;
  onOpenSettings: () => void;
  onCloseSettings: () => void;
  onOpenAdmin: () => void;
  onOpenOrders: () => void;
  onClosePaymentReturn: () => void;
  onSelectCategory: (category: string) => void;
  onOpenProduct: (product: Product) => void;
  onCloseProduct: () => void;
  onSortChange: (sort: StoreSort) => void;
  onMaterialChange: (material: string) => void;
  onAvailabilityChange: (avail: AvailabilityFilter) => void;
  onMaxPriceChange: (price: number) => void;
  onSearchChange: (query: string) => void;
  onClearFilters: () => void;
  onCloseCartNotice: () => void;
  onOpenCart: () => void;
  onSwitchToRegister: () => void;
  onSwitchToLogin: () => void;
}

export const StoreView: React.FC<StoreViewProps> = ({
  activeTenant,
  tenantSettings,
  categories,
  activeCategory,
  searchQuery,
  sortBy,
  materialFilter,
  availabilityFilter,
  maxPrice,
  priceCeiling,
  materialOptions,
  featuredProduct,
  visibleProducts,
  isLoading,
  selectedProduct,
  paymentReturn,
  isLoginOpen,
  isRegisterOpen,
  isFavoritesOpen,
  isSettingsOpen,
  loginContext,
  cartNotice,
  totalItems,
  totalPrice,
  onOpenLogin,
  onCloseLogin,
  onOpenRegister,
  onCloseRegister,
  onOpenFavorites,
  onCloseFavorites,
  onOpenSettings,
  onCloseSettings,
  onOpenAdmin,
  onOpenOrders,
  onClosePaymentReturn,
  onSelectCategory,
  onOpenProduct,
  onCloseProduct,
  onSortChange,
  onMaterialChange,
  onAvailabilityChange,
  onMaxPriceChange,
  onSearchChange,
  onClearFilters,
  onCloseCartNotice,
  onOpenCart,
  onSwitchToRegister,
  onSwitchToLogin,
}) => {
  return (
    <div
      className="min-h-screen flex flex-col bg-chumbo-950 text-slate-100 font-sans"
      style={{ '--tenant-primary': tenantSettings?.primary_color || '#22d3ee' } as React.CSSProperties}
    >
      <Navbar
        onOpenLogin={onOpenLogin}
        onOpenRegister={onOpenRegister}
        activeTenant={activeTenant}
        onOpenAdmin={onOpenAdmin}
        onOpenFavorites={onOpenFavorites}
        onOpenSettings={onOpenSettings}
        tenantSettings={tenantSettings}
      />

      <main className="flex-1">
        {paymentReturn && (
          <PaymentReturnBanner
            status={paymentReturn.status}
            orderId={paymentReturn.orderId}
            onOpenOrders={onOpenOrders}
            onClose={onClosePaymentReturn}
          />
        )}

        <Hero
          tenant={activeTenant}
          settings={tenantSettings}
          featuredProduct={featuredProduct}
          categories={categories}
          onSelectCategory={onSelectCategory}
          onOpenProduct={onOpenProduct}
        />

        <CategoryFilter
          categories={categories}
          activeCategory={activeCategory}
          onSelectCategory={onSelectCategory}
        />

        <StoreFilters
          sortBy={sortBy}
          onSortChange={onSortChange}
          materialOptions={materialOptions}
          materialFilter={materialFilter}
          onMaterialChange={onMaterialChange}
          availabilityFilter={availabilityFilter}
          onAvailabilityChange={onAvailabilityChange}
          maxPrice={maxPrice}
          priceCeiling={priceCeiling}
          onMaxPriceChange={onMaxPriceChange}
          onClear={onClearFilters}
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
        />

        <ProductGrid
          products={visibleProducts}
          isLoading={isLoading}
          onOpenModal={onOpenProduct}
        />
      </main>

      <Footer
        categories={categories}
        onSelectCategory={(slug) => {
          onSelectCategory(slug);
          onSortChange('featured');
        }}
      />

      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          onClose={onCloseProduct}
        />
      )}

      <CartDrawer
        onOpenLogin={onOpenLogin}
        tenantSettings={tenantSettings}
      />

      <FavoritesModal
        isOpen={isFavoritesOpen}
        onClose={onCloseFavorites}
        onOpenLogin={() => {
          onCloseFavorites();
          onOpenLogin();
        }}
      />

      <LoginModal
        isOpen={isLoginOpen}
        onClose={onCloseLogin}
        tenantId={activeTenant?.id}
        googleScope="customer"
        showAccountTypeSwitch
        title={loginContext === 'cart' ? 'Entre para continuar sua compra' : undefined}
        subtitle={loginContext === 'cart' ? 'Depois do login, vamos adicionar o produto ao seu carrinho' : undefined}
        submitLabel={loginContext === 'cart' ? 'Entrar e continuar' : undefined}
        onSwitchToRegister={onSwitchToRegister}
      />

      <RegisterModal
        isOpen={isRegisterOpen}
        onClose={onCloseRegister}
        tenantId={activeTenant?.id}
        onSwitchToLogin={onSwitchToLogin}
      />

      <UserSettingsModal
        isOpen={isSettingsOpen}
        onClose={onCloseSettings}
      />

      <ChatWidget
        activeTenant={activeTenant}
        onOpenLogin={onOpenLogin}
        hasFloatingBottomBar={totalItems > 0 && !cartNotice && !selectedProduct}
      />

      <CartNoticeToast
        notice={cartNotice}
        onClose={onCloseCartNotice}
        onOpenCart={onOpenCart}
      />

      <MobileCartBar
        totalItems={totalItems}
        totalPrice={totalPrice}
        onOpenCart={onOpenCart}
      />
    </div>
  );
};
