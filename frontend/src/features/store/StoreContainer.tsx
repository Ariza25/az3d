import React, { useEffect, useMemo, useState } from 'react';
import { Product, TenantSettings } from '../../types';
import { useTenantCatalog } from '../../shared/hooks/useTenantCatalog';
import { useCart } from '../../context/CartContext';
import { api } from '../../services/api';
import { AvailabilityFilter, StoreSort } from '../../components/StoreFilters';
import { getStockStatus, getTotalStock, groupMarketplaceProducts } from '../../shared/storePresentation';
import { getCurrentStoreRouteStyle, getProductPath, getStorePath } from '../../shared/tenantRoutes';
import { getAppPathname, withBasePath } from '../../shared/basePath';
import { StoreView } from './components/StoreView';

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

const normalizeSearchText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const matchesStoreSearch = (product: Product, query: string) => {
  const tokens = normalizeSearchText(query).split(' ').filter(Boolean);
  if (tokens.length === 0) return true;
  const family = product.store_variants?.length ? product.store_variants : [product];
  const searchable = normalizeSearchText(
    family
      .flatMap((item) => [
        item.title,
        item.description,
        item.material,
        item.sku || '',
        item.category?.name || '',
      ])
      .join(' ')
  );
  return tokens.every((token) => searchable.includes(token));
};

export const StoreContainer: React.FC = () => {
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
  const { openCart, openOrders, totalItems, totalPrice } = useCart();

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
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
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
        text: detail?.product?.title || 'Item incluído no carrinho.',
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
    return (
      [...storeProducts]
        .filter((product) => getStockStatus(product).canBuy)
        .sort((a, b) => {
          const bReviews = b.review_summary?.review_count || b.review_count || 0;
          const aReviews = a.review_summary?.review_count || a.review_count || 0;
          return bReviews - aReviews || b.price - a.price;
        })[0] || storeProducts[0]
    );
  }, [storeProducts]);

  const visibleProducts = useMemo(() => {
    const filtered = storeProducts.filter((product) => {
      const status = getStockStatus(product);
      const stock = getTotalStock(product);
      const matchesMaterial =
        materialFilter === 'todos' || product.material.toLowerCase().includes(materialFilter.toLowerCase());
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
    return Array.from(new Set(storeProducts.map((product) => product.material).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [storeProducts]);

  const findStoreProduct = (slug: string) =>
    storeProducts.find(
      (item) =>
        item.slug === slug ||
        String(item.id) === slug ||
        item.store_variants?.some((variant) => variant.slug === slug || String(variant.id) === slug)
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
    const storeName = (tenantSettings?.store_name || activeTenant?.name || 'AZ3D Studio').replace(
      /AZ3D Store/gi,
      'AZ3D Studio'
    );
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
      window.history.pushState(
        {},
        '',
        getProductPath(activeTenant.slug, product.slug || product.id, getCurrentStoreRouteStyle())
      );
    }
  };

  const closeProduct = () => {
    setSelectedProduct(null);
    if (activeTenant?.slug && getAppPathname().includes('/produto/')) {
      window.history.pushState({}, '', getStorePath(activeTenant.slug, getCurrentStoreRouteStyle()));
    }
  };

  const clearFilters = () => {
    setMaterialFilter('todos');
    setAvailabilityFilter('all');
    setMaxPrice(priceCeiling);
    setSortBy('featured');
    setSearchQuery('');
  };

  return (
    <StoreView
      activeTenant={activeTenant}
      tenantSettings={tenantSettings}
      categories={categories}
      activeCategory={activeCategory}
      searchQuery={searchQuery}
      sortBy={sortBy}
      materialFilter={materialFilter}
      availabilityFilter={availabilityFilter}
      maxPrice={maxPrice}
      priceCeiling={priceCeiling}
      materialOptions={materialOptions}
      featuredProduct={featuredProduct}
      visibleProducts={visibleProducts}
      isLoading={isLoading}
      selectedProduct={selectedProduct}
      paymentReturn={paymentReturn}
      isLoginOpen={isLoginOpen}
      isRegisterOpen={isRegisterOpen}
      isFavoritesOpen={isFavoritesOpen}
      isSettingsOpen={isSettingsOpen}
      loginContext={loginContext}
      cartNotice={cartNotice}
      totalItems={totalItems}
      totalPrice={totalPrice}
      onOpenLogin={() => setIsLoginOpen(true)}
      onCloseLogin={() => {
        setIsLoginOpen(false);
        setLoginContext('default');
      }}
      onOpenRegister={() => setIsRegisterOpen(true)}
      onCloseRegister={() => setIsRegisterOpen(false)}
      onOpenFavorites={() => setIsFavoritesOpen(true)}
      onCloseFavorites={() => setIsFavoritesOpen(false)}
      onOpenSettings={() => setIsSettingsOpen(true)}
      onCloseSettings={() => setIsSettingsOpen(false)}
      onOpenAdmin={openAdmin}
      onOpenOrders={() => {
        setPaymentReturn(null);
        openOrders();
      }}
      onClosePaymentReturn={() => {
        setPaymentReturn(null);
        if (activeTenant?.slug) {
          window.history.replaceState({}, '', getStorePath(activeTenant.slug, getCurrentStoreRouteStyle()));
        }
      }}
      onSelectCategory={setActiveCategory}
      onOpenProduct={openProduct}
      onCloseProduct={closeProduct}
      onSortChange={setSortBy}
      onMaterialChange={setMaterialFilter}
      onAvailabilityChange={setAvailabilityFilter}
      onMaxPriceChange={setMaxPrice}
      onSearchChange={setSearchQuery}
      onClearFilters={clearFilters}
      onCloseCartNotice={() => setCartNotice(null)}
      onOpenCart={() => {
        setCartNotice(null);
        openCart();
      }}
      onSwitchToRegister={() => {
        setIsLoginOpen(false);
        setIsRegisterOpen(true);
      }}
      onSwitchToLogin={() => {
        setIsRegisterOpen(false);
        setIsLoginOpen(true);
      }}
    />
  );
};
