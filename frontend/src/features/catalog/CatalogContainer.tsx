import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Product, TenantSettings } from '../../types';
import { useTenantCatalog } from '../../shared/hooks/useTenantCatalog';
import { useTheme } from '../../context/ThemeContext';
import { api } from '../../services/api';
import {
  getStockStatus,
  groupMarketplaceProducts,
  money,
} from '../../shared/storePresentation';
import { getCurrentStoreRouteStyle, getProductPath, getStorePath } from '../../shared/tenantRoutes';
import {
  CatalogHeader,
  CatalogHero,
  CatalogSpotlightCarousel,
  CatalogFilterBar,
  CatalogProductGrid,
  CatalogQuickDetailModal,
  CatalogFooter,
  getProductImages,
} from './components';

export const CatalogContainer: React.FC = () => {
  const { activeTenant, categories } = useTenantCatalog({ skipProducts: true });

  const [tenantSettings, setTenantSettings] = useState<TenantSettings | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('todas');
  const [sortBy, setSortBy] = useState<'featured' | 'price_asc' | 'price_desc' | 'name'>('featured');
  const [viewMode, setViewMode] = useState<'grid' | 'compact'>('grid');

  // Paginação com scroll infinito
  const PAGE_SIZE = 24;
  const [paginatedProducts, setPaginatedProducts] = useState<Product[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isCatalogLoading, setIsCatalogLoading] = useState(true);
  const [totalCatalogCount, setTotalCatalogCount] = useState(0);

  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);
  const isFetchingRef = useRef(false);
  const hasMoreRef = useRef(false);
  hasMoreRef.current = hasMore;
  const currentPageRef = useRef(1);
  currentPageRef.current = currentPage;

  // Tema
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  // Carrossel de Destaques
  const carouselRef = useRef<HTMLDivElement>(null);
  const [carouselCanScrollLeft, setCarouselCanScrollLeft] = useState(false);
  const [carouselCanScrollRight, setCarouselCanScrollRight] = useState(true);
  const [activeCarouselIndex, setActiveCarouselIndex] = useState(0);
  const [carouselVisibleCards, setCarouselVisibleCards] = useState(4);
  const [isCarouselPaused, setIsCarouselPaused] = useState(false);

  // Modal de Detalhes
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [copiedLink, setCopiedLink] = useState(false);

  // Sincroniza configurações do tenant
  useEffect(() => {
    if (!activeTenant) return;
    api.getTenantSettings(activeTenant.id)
      .then(setTenantSettings)
      .catch(() => setTenantSettings(null));
  }, [activeTenant]);

  // Título da página
  useEffect(() => {
    const storeName = tenantSettings?.store_name || activeTenant?.name || 'Catálogo Digital';
    document.title = `Catálogo Visual • ${storeName}`;
  }, [activeTenant, tenantSettings]);

  // Busca de produtos paginada
  const fetchProductsPage = useCallback(async (page: number, append: boolean = false) => {
    if (!activeTenant) return;
    if (page === 1) {
      setIsCatalogLoading(true);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const res = await api.getPaginatedProducts(
        selectedCategory,
        searchQuery,
        activeTenant.id,
        page,
        PAGE_SIZE,
        sortBy
      );

      const items = res.items || [];
      const more = Boolean(res.has_more);
      const nextPage = res.page || page;

      setTotalCatalogCount(res.total || 0);
      setHasMore(more);
      hasMoreRef.current = more;
      setCurrentPage(nextPage);
      currentPageRef.current = nextPage;

      if (append) {
        setPaginatedProducts((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const uniqueNew = items.filter((p) => !existingIds.has(p.id));
          return [...prev, ...uniqueNew];
        });
      } else {
        setPaginatedProducts(items);
      }
    } catch (err) {
      console.error('Erro ao buscar produtos paginados do backend:', err);
      if (!append) {
        setPaginatedProducts([]);
        setHasMore(false);
        hasMoreRef.current = false;
      }
    } finally {
      setIsCatalogLoading(false);
      setIsLoadingMore(false);
    }
  }, [activeTenant, selectedCategory, searchQuery, sortBy]);

  // Recarrega página 1 quando filtros mudam
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProductsPage(1, false);
    }, 180);
    return () => clearTimeout(timer);
  }, [fetchProductsPage]);

  // Infinite Scroll Observer
  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasMoreRef.current && !isFetchingRef.current) {
          isFetchingRef.current = true;
          fetchProductsPage(currentPageRef.current + 1, true).finally(() => {
            setTimeout(() => {
              isFetchingRef.current = false;
            }, 300);
          });
        }
      },
      { rootMargin: '300px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [fetchProductsPage]);

  const storeProducts = useMemo(() => groupMarketplaceProducts(paginatedProducts), [paginatedProducts]);

  // Spotlight Products para o carrossel
  const spotlightProducts = useMemo(() => {
    const all = groupMarketplaceProducts(paginatedProducts).filter((p) => getStockStatus(p).canBuy);
    if (all.length === 0) return [];

    const hasSalesRanking = all.some((p) => (p.sales_count || 0) > 0);
    if (hasSalesRanking) {
      return [...all].sort((a, b) => (b.sales_count || 0) - (a.sales_count || 0)).slice(0, 10);
    }
    return [...all].sort((a, b) => b.id - a.id).slice(0, 10);
  }, [paginatedProducts.slice(0, 24).map((p) => p.id).join(',')]);

  // Cálculo de passos do carrossel
  const getCarouselCardStep = () => {
    if (!carouselRef.current) return 280;
    const container = carouselRef.current;
    const item = container.querySelector('.carousel-spotlight-item') as HTMLElement | null;
    if (item && item.offsetWidth > 0) {
      return item.offsetWidth + 16;
    }
    const { clientWidth } = container;
    return clientWidth >= 1024 ? clientWidth / 4 : clientWidth >= 640 ? clientWidth / 2 : clientWidth * 0.78;
  };

  const checkCarouselScroll = () => {
    if (!carouselRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = carouselRef.current;
    setCarouselCanScrollLeft(scrollLeft > 15);
    setCarouselCanScrollRight(scrollLeft + clientWidth < scrollWidth - 15);

    const visibleCards = clientWidth >= 1024 ? 4 : clientWidth >= 640 ? 2 : 1;
    setCarouselVisibleCards(visibleCards);

    const step = getCarouselCardStep();
    const totalSteps = Math.max(1, spotlightProducts.length - visibleCards + 1);
    const index = Math.min(totalSteps - 1, Math.max(0, Math.round(scrollLeft / step)));
    setActiveCarouselIndex(index);
  };

  const scrollCarousel = (direction: 'left' | 'right') => {
    if (!carouselRef.current) return;
    const step = getCarouselCardStep();
    carouselRef.current.scrollBy({
      left: direction === 'left' ? -step : step,
      behavior: 'smooth',
    });
  };

  const scrollToCarouselIndex = (index: number) => {
    if (!carouselRef.current) return;
    const step = getCarouselCardStep();
    carouselRef.current.scrollTo({
      left: index * step,
      behavior: 'smooth',
    });
  };

  useEffect(() => {
    checkCarouselScroll();
    const handleResize = () => checkCarouselScroll();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [spotlightProducts.length]);

  // Autoplay suave do carrossel
  useEffect(() => {
    if (isCarouselPaused || spotlightProducts.length <= 1) return;

    const interval = setInterval(() => {
      if (!carouselRef.current) return;
      const container = carouselRef.current;
      const { scrollLeft, scrollWidth, clientWidth } = container;

      if (scrollLeft + clientWidth >= scrollWidth - 25) {
        container.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        const step = getCarouselCardStep();
        container.scrollBy({ left: step, behavior: 'smooth' });
      }
    }, 3800);

    return () => clearInterval(interval);
  }, [isCarouselPaused, spotlightProducts.length, carouselVisibleCards]);

  // Categorias com contadores
  const categoriesWithCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    paginatedProducts.forEach((p) => {
      const slug = p.category?.slug || 'sem-categoria';
      counts[slug] = (counts[slug] || 0) + 1;
    });

    return categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      count: counts[cat.slug] || 0,
    }));
  }, [categories, paginatedProducts]);

  // Ações de compartilhamento e navegação
  const handleCopyCatalogLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    });
  };

  const goToStore = (productSlugOrId?: string | number) => {
    if (!activeTenant?.slug) return;
    const targetUrl = productSlugOrId
      ? getProductPath(activeTenant.slug, productSlugOrId, getCurrentStoreRouteStyle())
      : getStorePath(activeTenant.slug, getCurrentStoreRouteStyle());
    window.history.pushState({}, '', targetUrl);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const handleWhatsAppContact = (product: Product) => {
    const name = tenantSettings?.store_name || activeTenant?.name || 'sua loja';
    const msg = `Olá! Vi o produto *${product.title}* (${money(product.price)}) no catálogo da *${name}* e gostaria de mais informações!`;
    window.open(`https://wa.me/5543998068708?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const primaryColor = tenantSettings?.primary_color || '#22d3ee';
  const storeName = tenantSettings?.store_name || activeTenant?.name || 'AZ3D Studio';
  const logoUrl = tenantSettings?.logo_url || activeTenant?.logo_url;
  const modalImages = useMemo(() => getProductImages(detailProduct), [detailProduct]);

  return (
    <div
      className="min-h-screen bg-slate-100 dark:bg-chumbo-950 text-slate-900 dark:text-slate-100 font-sans flex flex-col transition-colors duration-150"
      style={{ '--tenant-primary': primaryColor } as React.CSSProperties}
    >
      {/* 1. Header Dumb */}
      <CatalogHeader
        storeName={storeName}
        logoUrl={logoUrl}
        totalCount={totalCatalogCount || storeProducts.length}
        isDark={isDark}
        copiedLink={copiedLink}
        onToggleTheme={toggleTheme}
        onCopyLink={handleCopyCatalogLink}
        onGoToStore={() => goToStore()}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-6 sm:space-y-8">
        {/* 2. Hero Dumb */}
        <CatalogHero />

        {/* 3. Destaques Carrossel Dumb */}
        {selectedCategory === 'todas' && !searchQuery && (
          <CatalogSpotlightCarousel
            products={spotlightProducts}
            activeCarouselIndex={activeCarouselIndex}
            canScrollLeft={carouselCanScrollLeft}
            canScrollRight={carouselCanScrollRight}
            visibleCards={carouselVisibleCards}
            carouselRef={carouselRef}
            onScroll={checkCarouselScroll}
            onScrollDirection={scrollCarousel}
            onScrollToIndex={scrollToCarouselIndex}
            onMouseEnter={() => setIsCarouselPaused(true)}
            onMouseLeave={() => setIsCarouselPaused(false)}
            onTouchStart={() => setIsCarouselPaused(true)}
            onTouchEnd={() => setIsCarouselPaused(false)}
            onSelectProduct={(product) => {
              setDetailProduct(product);
              setActiveImageIndex(0);
            }}
          />
        )}

        {/* 4. Barra de Filtros e Categorias Dumb */}
        <CatalogFilterBar
          searchQuery={searchQuery}
          selectedCategory={selectedCategory}
          sortBy={sortBy}
          viewMode={viewMode}
          categoriesWithCounts={categoriesWithCounts}
          totalCount={totalCatalogCount || storeProducts.length}
          onSearchChange={setSearchQuery}
          onClearSearch={() => setSearchQuery('')}
          onCategoryChange={setSelectedCategory}
          onSortChange={setSortBy}
          onViewModeChange={setViewMode}
        />

        {/* 5. Grid/Lista de Produtos Dumb */}
        <CatalogProductGrid
          products={storeProducts}
          viewMode={viewMode}
          isLoading={isCatalogLoading}
          isLoadingMore={isLoadingMore}
          hasFilterActive={Boolean(searchQuery || selectedCategory !== 'todas')}
          onOpenDetail={(product, initialIdx) => {
            setDetailProduct(product);
            setActiveImageIndex(initialIdx || 0);
          }}
          onClearFilters={() => {
            setSearchQuery('');
            setSelectedCategory('todas');
          }}
          sentinelRef={loadMoreSentinelRef}
        />
      </main>

      {/* 6. Modal de Detalhes Dumb */}
      <CatalogQuickDetailModal
        product={detailProduct}
        activeImageIndex={activeImageIndex}
        allImages={modalImages}
        storeName={storeName}
        onClose={() => setDetailProduct(null)}
        onSelectImageIndex={setActiveImageIndex}
        onPrevImage={() => setActiveImageIndex((prev) => (prev - 1 + modalImages.length) % modalImages.length)}
        onNextImage={() => setActiveImageIndex((prev) => (prev + 1) % modalImages.length)}
        onGoToStore={goToStore}
        onWhatsAppClick={handleWhatsAppContact}
      />

      {/* 7. Footer Dumb */}
      <CatalogFooter storeName={storeName} onGoToStore={() => goToStore()} />
    </div>
  );
};
