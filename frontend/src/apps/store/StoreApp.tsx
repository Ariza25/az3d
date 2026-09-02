import React, { useEffect, useMemo, useState } from 'react';
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
import { Product, TenantSettings } from '../../types';
import { useTenantCatalog } from '../../shared/hooks/useTenantCatalog';
import { api } from '../../services/api';
import { StoreFilters, AvailabilityFilter, StoreSort } from '../../components/StoreFilters';
import { getStockStatus, getTotalStock, groupMarketplaceProducts } from '../../shared/storePresentation';
import { getCurrentStoreRouteStyle, getProductPath, getStorePath } from '../../shared/tenantRoutes';
import { AlertCircle, CheckCircle2, Clock3, X } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { getAppPathname, withBasePath } from '../../shared/basePath';

const getProductSlugFromLocation = () => {
  const [, first, second, third, fourth] = getAppPathname().split('/');
  if (first === 'loja' && third === 'produto' && fourth) return decodeURIComponent(fourth);
  if (first && second === 'store' && third === 'produto' && fourth) return decodeURIComponent(fourth);
  return '';
};

const upsertMetaDescription = (content: string) => {
  let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'description';
    document.head.appendChild(meta);
  }
  meta.content = content;
};

const normalizeSearchText = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const matchesStoreSearch = (product: Product, query: string) => {
  const tokens = normalizeSearchText(query).split(' ').filter(Boolean);
  if (tokens.length === 0) return true;
  const family = product.store_variants?.length ? product.store_variants : [product];
  const searchable = normalizeSearchText(family.flatMap((item) => [
    item.title, item.description, item.material, item.sku || '', item.category?.name || '',
  ]).join(' '));
  return tokens.every((token) => searchable.includes(token));
};

export const StoreApp: React.FC = () => {
  const {
    activeTenant,
    categories,
    products,
    activeCategory,
    setActiveCategory,
    searchQuery,
    setSearchQuery,
    isLoading,
  } = useTenantCatalog();
  const { openCart, openOrders } = useCart();

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [tenantSettings, setTenantSettings] = useState<TenantSettings | null>(null);
  const [sortBy, setSortBy] = useState<StoreSort>('featured');
  const [materialFilter, setMaterialFilter] = useState('todos');
  const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityFilter>('all');
  const [maxPrice, setMaxPrice] = useState(0);
  const [paymentReturn, setPaymentReturn] = useState<{ status: string; orderId: string } | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('payment');
    if (!status) return null;
    return { status, orderId: params.get('order_id') || '' };
  });
  const [isLoginOpen, setIsLoginOpen] = useState<boolean>(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState<boolean>(false);
  const [isFavoritesOpen, setIsFavoritesOpen] = useState<boolean>(false);
  const [loginContext, setLoginContext] = useState<'default' | 'cart'>('default');
  const [cartNotice, setCartNotice] = useState<{ title: string; text: string } | null>(null);

  const storeProducts = useMemo(() => groupMarketplaceProducts(products), [products]);

  useEffect(() => {
    const handleRequireLogin = () => {
      setLoginContext('cart');
      setIsLoginOpen(true);
    };
    window.addEventListener('az3d:require-login', handleRequireLogin);
    return () => window.removeEventListener('az3d:require-login', handleRequireLogin);
  }, []);

  useEffect(() => {
    const handleCartAdded = (event: Event) => {
      const detail = (event as CustomEvent<{ product?: Product; quantity?: number }>).detail;
      setCartNotice({
        title: 'Produto adicionado',
        text: detail?.product?.title || 'Item incluido no carrinho.',
      });
      window.setTimeout(() => setCartNotice(null), 5000);
    };
    window.addEventListener('az3d:cart-added', handleCartAdded);
    return () => window.removeEventListener('az3d:cart-added', handleCartAdded);
  }, []);

  useEffect(() => {
    const authError = sessionStorage.getItem('az3d_auth_error');
    if (!authError) return;
    sessionStorage.removeItem('az3d_auth_error');
    setIsLoginOpen(true);
  }, []);

  useEffect(() => {
    if (!activeTenant) return;
    api.getTenantSettings(activeTenant.id)
      .then(setTenantSettings)
      .catch(() => setTenantSettings(null));
  }, [activeTenant]);

  const priceCeiling = useMemo(() => {
    const highest = storeProducts.reduce((max, product) => Math.max(max, product.price), 0);
    return Math.ceil(highest || 0);
  }, [storeProducts]);

  useEffect(() => {
    if (priceCeiling > 0) setMaxPrice(priceCeiling);
  }, [priceCeiling, activeTenant?.id]);

  const featuredProduct = useMemo(() => {
    return [...storeProducts]
      .filter((product) => getStockStatus(product).canBuy)
      .sort((a, b) => {
        const bReviews = b.review_summary?.review_count || b.review_count || 0;
        const aReviews = a.review_summary?.review_count || a.review_count || 0;
        return bReviews - aReviews || b.price - a.price;
      })[0] || storeProducts[0];
  }, [storeProducts]);

  const visibleProducts = useMemo(() => {
    const filtered = storeProducts.filter((product) => {
      const status = getStockStatus(product);
      const stock = getTotalStock(product);
      const matchesMaterial = materialFilter === 'todos' || product.material.toLowerCase().includes(materialFilter.toLowerCase());
      const matchesAvailability =
        availabilityFilter === 'all' ||
        (availabilityFilter === 'available' && status.canBuy) ||
        (availabilityFilter === 'low_stock' && status.canBuy && stock <= 3) ||
        (availabilityFilter === 'out' && !status.canBuy);
      const matchesPrice = maxPrice <= 0 || product.price <= maxPrice;
      const matchesSearch = matchesStoreSearch(product, searchQuery);
      return matchesMaterial && matchesAvailability && matchesPrice && matchesSearch;
    });

    return filtered.sort((a, b) => {
      if (sortBy === 'price_asc') return a.price - b.price;
      if (sortBy === 'price_desc') return b.price - a.price;
      if (sortBy === 'recent') {
        const bTime = b.created_at ? new Date(b.created_at).getTime() : b.id;
        const aTime = a.created_at ? new Date(a.created_at).getTime() : a.id;
        return bTime - aTime;
      }
      const bScore = (b.review_summary?.review_count || b.review_count || 0) + (getStockStatus(b).canBuy ? 10 : 0);
      const aScore = (a.review_summary?.review_count || a.review_count || 0) + (getStockStatus(a).canBuy ? 10 : 0);
      return bScore - aScore;
    });
  }, [storeProducts, materialFilter, availabilityFilter, maxPrice, searchQuery, sortBy]);

  const materialOptions = useMemo(() => {
    return Array.from(new Set(storeProducts.map((product) => product.material).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [storeProducts]);

  const findStoreProduct = (slug: string) => storeProducts.find((item) =>
    item.slug === slug || String(item.id) === slug || item.store_variants?.some((variant) => variant.slug === slug || String(variant.id) === slug)
  );

  useEffect(() => {
    const productSlug = getProductSlugFromLocation();
    if (!productSlug || products.length === 0) {
      if (!productSlug) setSelectedProduct(null);
      return;
    }
    const product = findStoreProduct(productSlug);
    if (product) setSelectedProduct(product);
  }, [storeProducts]);

  useEffect(() => {
    const handleRouteChange = () => {
      const productSlug = getProductSlugFromLocation();
      if (!productSlug) {
        setSelectedProduct(null);
        return;
      }
      const product = findStoreProduct(productSlug);
      if (product) setSelectedProduct(product);
    };

    window.addEventListener('popstate', handleRouteChange);
    return () => window.removeEventListener('popstate', handleRouteChange);
  }, [storeProducts]);

  useEffect(() => {
    const storeName = tenantSettings?.store_name || activeTenant?.name || 'AZ3D Store';
    if (selectedProduct) {
      document.title = `${selectedProduct.title} | ${storeName}`;
      upsertMetaDescription(selectedProduct.description || `${selectedProduct.title} em ${storeName}`);
      return;
    }
    document.title = `${storeName} | Loja`;
    upsertMetaDescription(`Compre produtos selecionados da loja ${storeName}.`);
  }, [activeTenant, tenantSettings, selectedProduct]);

  const openAdmin = () => {
    window.history.pushState({}, '', withBasePath('/admin'));
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const openProduct = (product: Product) => {
    setSelectedProduct(product);
    if (activeTenant?.slug) {
      window.history.pushState({}, '', getProductPath(activeTenant.slug, product.slug || product.id, getCurrentStoreRouteStyle()));
    }
  };

  const closeProduct = () => {
    setSelectedProduct(null);
    if (activeTenant?.slug && getAppPathname().includes('/produto/')) {
      window.history.pushState({}, '', getStorePath(activeTenant.slug, getCurrentStoreRouteStyle()));
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col bg-chumbo-950 text-slate-100 font-sans"
      style={{ '--tenant-primary': tenantSettings?.primary_color || '#22d3ee' } as React.CSSProperties}
    >
      <Navbar
        onOpenLogin={() => setIsLoginOpen(true)}
        onOpenRegister={() => setIsRegisterOpen(true)}
        activeTenant={activeTenant}
        onOpenAdmin={openAdmin}
        onOpenFavorites={() => setIsFavoritesOpen(true)}
        tenantSettings={tenantSettings}
      />

      <main className="flex-1">
        {paymentReturn && (
          <PaymentReturnBanner
            status={paymentReturn.status}
            orderId={paymentReturn.orderId}
            onOpenOrders={() => {
              setPaymentReturn(null);
              openOrders();
            }}
            onClose={() => {
              setPaymentReturn(null);
              if (activeTenant?.slug) window.history.replaceState({}, '', getStorePath(activeTenant.slug, getCurrentStoreRouteStyle()));
            }}
          />
        )}

        <Hero
          tenant={activeTenant}
          settings={tenantSettings}
          featuredProduct={featuredProduct}
          categories={categories}
          onSelectCategory={setActiveCategory}
          onOpenProduct={openProduct}
        />

        <CategoryFilter
          categories={categories}
          activeCategory={activeCategory}
          onSelectCategory={setActiveCategory}
        />

        <StoreFilters
          sortBy={sortBy}
          onSortChange={setSortBy}
          materialOptions={materialOptions}
          materialFilter={materialFilter}
          onMaterialChange={setMaterialFilter}
          availabilityFilter={availabilityFilter}
          onAvailabilityChange={setAvailabilityFilter}
          maxPrice={maxPrice}
          priceCeiling={priceCeiling}
          onMaxPriceChange={setMaxPrice}
          onClear={() => {
            setMaterialFilter('todos');
            setAvailabilityFilter('all');
            setMaxPrice(priceCeiling);
            setSortBy('featured');
            setSearchQuery('');
          }}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        <ProductGrid
          products={visibleProducts}
          isLoading={isLoading}
          onOpenModal={openProduct}
        />
      </main>

      <Footer />

      <ProductModal
        product={selectedProduct}
        onClose={closeProduct}
      />

      <CartDrawer
        onOpenLogin={() => setIsLoginOpen(true)}
        tenantSettings={tenantSettings}
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
        onClose={() => {
          setIsLoginOpen(false);
          setLoginContext('default');
        }}
        tenantId={activeTenant?.id}
        googleScope="customer"
        showAccountTypeSwitch
        title={loginContext === 'cart' ? 'Entre para continuar sua compra' : undefined}
        subtitle={loginContext === 'cart' ? 'Depois do login, vamos adicionar o produto ao seu carrinho' : undefined}
        submitLabel={loginContext === 'cart' ? 'Entrar e continuar' : undefined}
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

      {cartNotice && (
        <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded-2xl border border-emerald-500/30 bg-chumbo-950 p-4 shadow-2xl sm:left-auto sm:right-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white">{cartNotice.title}</h3>
              <p className="mt-1 line-clamp-1 text-xs text-slate-400">{cartNotice.text}</p>
            </div>
            <button onClick={() => setCartNotice(null)} className="rounded-lg p-1 text-slate-500 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button onClick={() => setCartNotice(null)} className="rounded-xl border border-chumbo-700 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-chumbo-800">
              Continuar comprando
            </button>
            <button onClick={() => { setCartNotice(null); openCart(); }} className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-chumbo-950 hover:bg-slate-200">
              Finalizar compra
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const PaymentReturnBanner = ({
  status,
  orderId,
  onOpenOrders,
  onClose,
}: {
  status: string;
  orderId: string;
  onOpenOrders: () => void;
  onClose: () => void;
}) => {
  const content = status === 'success'
    ? {
        icon: <CheckCircle2 className="h-5 w-5 text-emerald-300" />,
        title: 'Pagamento aprovado',
        text: 'Recebemos a confirmacao do Mercado Pago. O pedido ja pode seguir para preparacao.',
        tone: 'border-emerald-500/40 bg-emerald-500/10',
      }
    : status === 'pending'
      ? {
          icon: <Clock3 className="h-5 w-5 text-amber-300" />,
          title: 'Pagamento pendente',
          text: 'O Mercado Pago ainda esta processando o pagamento. O pedido sera atualizado quando houver confirmacao.',
          tone: 'border-amber-500/40 bg-amber-500/10',
        }
      : {
          icon: <AlertCircle className="h-5 w-5 text-red-300" />,
          title: 'Pagamento nao concluido',
          text: 'O pagamento nao foi aprovado ou foi cancelado. Voce pode tentar novamente pelo carrinho.',
          tone: 'border-red-500/40 bg-red-500/10',
        };

  return (
    <div className={`border-b ${content.tone}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {content.icon}
          <div>
            <p className="text-sm font-bold text-white">{content.title}{orderId ? ` - Pedido #${orderId}` : ''}</p>
            <p className="text-xs text-slate-300">{content.text}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onOpenOrders} className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-chumbo-950 hover:bg-slate-200">
            Ver meus pedidos
          </button>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-chumbo-900 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
