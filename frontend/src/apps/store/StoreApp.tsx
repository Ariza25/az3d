import React, { useState } from 'react';
import { Navbar } from '../../components/Navbar';
import { Hero } from '../../components/Hero';
import { CategoryFilter } from '../../components/CategoryFilter';
import { ProductGrid } from '../../components/ProductGrid';
import { ProductModal } from '../../components/ProductModal';
import { CartDrawer } from '../../components/CartDrawer';
import { LoginModal } from '../../components/LoginModal';
import { RegisterModal } from '../../components/RegisterModal';
import { Footer } from '../../components/Footer';
import { FavoritesModal } from '../../components/FavoritesModal';
import { Product } from '../../types';
import { useTenantCatalog } from '../../shared/hooks/useTenantCatalog';

export const StoreApp: React.FC = () => {
  const {
    tenants,
    activeTenant,
    categories,
    products,
    activeCategory,
    setActiveCategory,
    searchQuery,
    setSearchQuery,
    isLoading,
    onSelectTenant,
  } = useTenantCatalog();

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isLoginOpen, setIsLoginOpen] = useState<boolean>(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState<boolean>(false);
  const [isFavoritesOpen, setIsFavoritesOpen] = useState<boolean>(false);

  const openAdmin = () => {
    window.history.pushState({}, '', '/admin');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <div className="min-h-screen flex flex-col bg-chumbo-950 text-slate-100 font-sans">
      <Navbar
        onOpenLogin={() => setIsLoginOpen(true)}
        onOpenRegister={() => setIsRegisterOpen(true)}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        activeTenant={activeTenant}
        tenants={tenants}
        onSelectTenant={onSelectTenant}
        onOpenAdmin={openAdmin}
        onOpenFavorites={() => setIsFavoritesOpen(true)}
      />

      <main className="flex-1">
        <Hero />

        <CategoryFilter
          categories={categories}
          activeCategory={activeCategory}
          onSelectCategory={setActiveCategory}
        />

        <ProductGrid
          products={products}
          isLoading={isLoading}
          onOpenModal={(product) => setSelectedProduct(product)}
        />
      </main>

      <Footer />

      <ProductModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
      />

      <CartDrawer
        onOpenLogin={() => setIsLoginOpen(true)}
      />

      <FavoritesModal
        isOpen={isFavoritesOpen}
        onClose={() => setIsFavoritesOpen(false)}
        onOpenLogin={() => {
          setIsFavoritesOpen(false);
          setIsLoginOpen(true);
        }}
      />

      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onSwitchToRegister={() => {
          setIsLoginOpen(false);
          setIsRegisterOpen(true);
        }}
      />

      <RegisterModal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        tenantId={activeTenant?.id}
        onSwitchToLogin={() => {
          setIsRegisterOpen(false);
          setIsLoginOpen(true);
        }}
      />
    </div>
  );
};
