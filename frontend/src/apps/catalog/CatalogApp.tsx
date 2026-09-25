import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Share2,
  MessageCircle,
  Search,
  Grid,
  List,
  Check,
  Sparkles,
  Layers,
  X,
  Star,
  ShoppingBag,
  Maximize2,
  Flame,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Loader2,
} from 'lucide-react';
import { Product, TenantSettings } from '../../types';
import { useTenantCatalog } from '../../shared/hooks/useTenantCatalog';
import { useTheme } from '../../context/ThemeContext';
import { api, resolveApiAssetUrl } from '../../services/api';
import {
  getAvailableColors,
  getColorVisual,
  getStockStatus,
  groupMarketplaceProducts,
  money,
  optimizeImageUrl,
} from '../../shared/storePresentation';
import { getCurrentStoreRouteStyle, getProductPath, getStorePath } from '../../shared/tenantRoutes';
import { AZ3DLogo } from '../../components/AZ3DLogo';


// Preço da peça no catálogo com cupom de 10% aplicado diretamente (sem exibir desconto)
export const getCatalogPrice = (price: number): number => {
  if (!price || price <= 0) return 0;
  return Math.round(price * 0.9 * 100) / 100;
};

// Extração de dimensões a partir da descrição ou campo dimensions do produto
export const extractProductDimensions = (product: { description?: string; dimensions?: string }): string => {
  const desc = product.description || '';

  if (desc) {
    // 1. Linhas com "Dimensões", "Medidas", "Tamanho"
    const lineMatch = desc.match(
      /(?:dimens[õo]es|medidas?|tamanho|dimensao)(?:\s*(?:aproximadas?|totais?|do produto|\([^)]*\)))?\s*[:\-–]\s*([^\n\r]+)/i
    );
    if (lineMatch && lineMatch[1]) {
      let raw = lineMatch[1].trim();
      const dotIdx = raw.indexOf('.');
      if (dotIdx > 0 && (raw.slice(dotIdx).includes(' ') || dotIdx > 8)) {
        raw = raw.slice(0, dotIdx).trim();
      }
      raw = raw.replace(/[;,.\-]+$/, '').trim();
      if (raw.length >= 2 && raw.length <= 50) {
        return raw;
      }
    }

    // 2. Altura, Largura e Comprimento/Profundidade estruturados
    const altMatch = desc.match(/(?:alt(?:ura)?)\s*[:\-–]?\s*(\d+(?:[.,]\d+)?\s*(?:cm|mm|m)?)/i);
    const largMatch = desc.match(/(?:larg(?:ura)?)\s*[:\-–]?\s*(\d+(?:[.,]\d+)?\s*(?:cm|mm|m)?)/i);
    const profMatch = desc.match(/(?:prof(?:undidade)?|comp(?:rimento)?)\s*[:\-–]?\s*(\d+(?:[.,]\d+)?\s*(?:cm|mm|m)?)/i);
    if (altMatch && largMatch) {
      const parts = [
        altMatch[1] ? `Alt: ${altMatch[1]}` : null,
        largMatch[1] ? `Larg: ${largMatch[1]}` : null,
        profMatch ? `Prof: ${profMatch[1]}` : null,
      ].filter(Boolean);
      return parts.join(' • ');
    }

    // 3. Padrão numérico clássico: ex: "12 x 10 x 8 cm" ou "120 × 120 × 150 mm" ou "15 x 10 cm"
    const numMatch = desc.match(
      /\b\d+(?:[.,]\d+)?\s*(?:cm|mm|m)?\s*[xX×*]\s*\d+(?:[.,]\d+)?\s*(?:cm|mm|m)?(?:\s*[xX×*]\s*\d+(?:[.,]\d+)?\s*(?:cm|mm|m)?)?\b/
    );
    if (numMatch && numMatch[0]) {
      return numMatch[0].trim();
    }
  }

  // 4. Fallback para campo dimensions do produto se preenchido e não genérico
  if (product.dimensions && product.dimensions.trim() && product.dimensions !== 'A confirmar' && product.dimensions !== '--') {
    return product.dimensions.trim();
  }

  return '';
};

// Coleta todas as imagens associadas ao produto (foto principal, fotos de cores e variações irmãs)
export const getProductImages = (product?: Product | null): string[] => {
  if (!product) return [];
  const urls: string[] = [];
  const add = (u?: string) => {
    if (u && !urls.includes(u)) urls.push(u);
  };
  add(product.image_url);
  product.color_images?.forEach((ci) => add(ci.image_url));
  product.store_variants?.forEach((v) => {
    add(v.image_url);
    v.color_images?.forEach((ci) => add(ci.image_url));
  });
  return urls.filter(Boolean);
};

interface CatalogProductCardProps {
  product: Product;
  onOpenDetail: (product: Product, initialImageIndex?: number) => void;
}

export const CatalogProductCard: React.FC<CatalogProductCardProps> = ({ product, onOpenDetail }) => {
  const images = useMemo(() => getProductImages(product), [product]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const activeImage = optimizeImageUrl(images[currentImageIndex] || images[0] || product.image_url);
  const status = getStockStatus(product);
  const colors = getAvailableColors(product).slice(0, 4);
  const rating = product.review_summary?.average_rating || product.rating;

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200/90 dark:border-chumbo-800/90 bg-white dark:bg-chumbo-900/50 hover:border-slate-300 dark:hover:border-chumbo-700 transition-all duration-300 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-black/40">
      {/* Imagem do Produto com Carrossel de Setas estilo Mercado Livre */}
      <div
        className="relative aspect-square w-full cursor-pointer overflow-hidden bg-slate-100 dark:bg-chumbo-950 select-none"
        onClick={() => onOpenDetail(product, currentImageIndex)}
      >
        <img
          src={activeImage}
          alt={product.title}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 dark:from-chumbo-950/80 via-transparent to-transparent opacity-50 pointer-events-none" />

        {/* Badge de Disponibilidade */}
        <div className="absolute left-2.5 top-2.5 z-10 pointer-events-none">
          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${status.tone}`}>
            {status.label}
          </span>
        </div>

        {/* Setas de navegação do carrossel no card (estilo Mercado Livre - giram sem abrir o modal) */}
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={handlePrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white/95 dark:bg-chumbo-900/95 text-slate-800 dark:text-slate-100 flex items-center justify-center shadow-lg hover:bg-white dark:hover:bg-chumbo-800 hover:scale-110 active:scale-95 transition-all opacity-0 group-hover:opacity-100 max-sm:opacity-90 border border-slate-200/80 dark:border-chumbo-700/80 cursor-pointer"
              title="Foto anterior"
              aria-label="Foto anterior"
            >
              <ChevronLeft className="w-4.5 h-4.5" />
            </button>

            <button
              type="button"
              onClick={handleNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white/95 dark:bg-chumbo-900/95 text-slate-800 dark:text-slate-100 flex items-center justify-center shadow-lg hover:bg-white dark:hover:bg-chumbo-800 hover:scale-110 active:scale-95 transition-all opacity-0 group-hover:opacity-100 max-sm:opacity-90 border border-slate-200/80 dark:border-chumbo-700/80 cursor-pointer"
              title="Próxima foto"
              aria-label="Próxima foto"
            >
              <ChevronRight className="w-4.5 h-4.5" />
            </button>

            {/* Indicador de Bolinhas do Card estilo Mercado Livre */}
            <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/40 backdrop-blur-xs pointer-events-none">
              {images.slice(0, 6).map((_, idx) => (
                <span
                  key={idx}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    currentImageIndex === idx ? 'w-3.5 bg-white' : 'w-1.5 bg-white/50'
                  }`}
                />
              ))}
              {images.length > 6 && (
                <span className="text-[9px] text-white/80 font-mono ml-0.5">+{images.length - 6}</span>
              )}
            </div>
          </>
        )}

        {/* Botão de Zoom/Detalhes Rápido */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenDetail(product, currentImageIndex);
          }}
          className="absolute bottom-2.5 right-2.5 z-20 p-2 rounded-xl bg-white/90 dark:bg-chumbo-950/80 text-slate-700 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-white border border-slate-200/60 dark:border-chumbo-700/80 opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-sm"
          title="Ver detalhes da peça"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Informações da Peça */}
      <div className="p-3 sm:p-4 flex flex-1 flex-col justify-between space-y-3">
        <div className="space-y-1.5">
          <div className="flex items-start justify-between gap-1">
            <h4
              onClick={() => onOpenDetail(product, currentImageIndex)}
              className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-300 transition-colors line-clamp-2 cursor-pointer leading-tight"
            >
              {product.title}
            </h4>
            {rating && rating > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-500 dark:text-amber-300 shrink-0">
                <Star className="w-3 h-3 fill-amber-400 dark:fill-amber-300" />
                {rating.toFixed(1)}
              </span>
            )}
          </div>

          {(() => {
            const dim = extractProductDimensions(product);
            if (!dim) return null;
            return (
              <p className="text-xs sm:text-[13px] font-medium text-slate-700 dark:text-slate-300">
                Dimensões do produto: <span className="font-bold text-slate-900 dark:text-slate-100">{dim}</span>
              </p>
            );
          })()}

          {/* Swatches de Cores: clicar na cor troca para a foto da cor no card */}
          {colors.length > 0 && (
            <div className="flex items-center gap-1 pt-1">
              {colors.map((c) => {
                const visual = getColorVisual(c);
                return (
                  <button
                    key={c}
                    type="button"
                    title={c}
                    onClick={(e) => {
                      e.stopPropagation();
                      const matched = product.color_images?.find(
                        (ci) => ci.color_name?.toLowerCase() === c.toLowerCase()
                      );
                      if (matched && matched.image_url) {
                        const targetIdx = images.indexOf(matched.image_url);
                        if (targetIdx >= 0) setCurrentImageIndex(targetIdx);
                      }
                    }}
                    className="h-3.5 w-3.5 rounded-full border border-white dark:border-chumbo-900 ring-1 ring-slate-300 dark:ring-chumbo-700 shadow-xs hover:scale-125 transition-transform"
                    style={{ backgroundColor: visual.hex }}
                  />
                );
              })}
              {colors.length > 1 && (
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                  +{colors.length} cores
                </span>
              )}
            </div>
          )}
        </div>

        {/* Preço */}
        <div className="pt-2.5 border-t border-slate-200 dark:border-chumbo-800/80 flex items-center justify-between gap-2">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              Preço:
            </span>
            <span className="text-base sm:text-lg lg:text-xl font-black text-cyan-700 dark:text-cyan-400">
              {money(getCatalogPrice(product.price))}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
};

export const CatalogApp: React.FC = () => {
  const {
    activeTenant,
    categories,
  } = useTenantCatalog({ skipProducts: true });

  const [tenantSettings, setTenantSettings] = useState<TenantSettings | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('todas');
  const [sortBy, setSortBy] = useState<'featured' | 'price_asc' | 'price_desc' | 'name'>('featured');
  const [viewMode, setViewMode] = useState<'grid' | 'compact'>('grid');

  // Paginação vinda do Backend com Infinite Scroll
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

  // Tema Escuro / Claro
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  // Carrossel de Destaques
  const carouselRef = useRef<HTMLDivElement>(null);
  const [carouselCanScrollLeft, setCarouselCanScrollLeft] = useState(false);
  const [carouselCanScrollRight, setCarouselCanScrollRight] = useState(true);
  const [activeCarouselIndex, setActiveCarouselIndex] = useState(0);

  const checkCarouselScroll = () => {
    if (!carouselRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = carouselRef.current;
    setCarouselCanScrollLeft(scrollLeft > 15);
    setCarouselCanScrollRight(scrollLeft + clientWidth < scrollWidth - 15);

    const cardWidth = clientWidth >= 1024 ? clientWidth / 4 : clientWidth >= 640 ? clientWidth / 2 : clientWidth * 0.78;
    const index = Math.round(scrollLeft / cardWidth);
    setActiveCarouselIndex(Math.max(0, index));
  };

  const scrollCarousel = (direction: 'left' | 'right') => {
    if (!carouselRef.current) return;
    const container = carouselRef.current;
    const cardWidth = container.clientWidth >= 1024 ? container.clientWidth / 4 : container.clientWidth >= 640 ? container.clientWidth / 2 : container.clientWidth * 0.78;
    const scrollAmount = cardWidth * (container.clientWidth >= 1024 ? 2 : 1);
    container.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  const scrollToCarouselIndex = (index: number) => {
    if (!carouselRef.current) return;
    const container = carouselRef.current;
    const items = container.querySelectorAll('.carousel-spotlight-item');
    if (items[index]) {
      (items[index] as HTMLElement).scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
    }
  };

  const [isCarouselPaused, setIsCarouselPaused] = useState(false);


  // Modal de Detalhes Rápido
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const [copiedLink, setCopiedLink] = useState(false);

  // Atualiza configurações do tenant
  useEffect(() => {
    if (!activeTenant) return;
    api.getTenantSettings(activeTenant.id)
      .then(setTenantSettings)
      .catch(() => setTenantSettings(null));
  }, [activeTenant]);

  // Ajusta título da página
  useEffect(() => {
    const storeName = tenantSettings?.store_name || activeTenant?.name || 'Catálogo Digital';
    document.title = `Catálogo Visual • ${storeName}`;
  }, [activeTenant, tenantSettings]);

  // Busca de produtos paginada no backend
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

  // Recarrega página 1 quando tenant, categoria, busca ou ordenação mudam
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProductsPage(1, false);
    }, 180);
    return () => clearTimeout(timer);
  }, [fetchProductsPage]);

  // Listener de Infinite Scroll estável com IntersectionObserver (sem loops ou flickers)
  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (
          entry.isIntersecting &&
          hasMoreRef.current &&
          !isFetchingRef.current
        ) {
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

  const rawProducts = paginatedProducts;
  const storeProducts = useMemo(() => groupMarketplaceProducts(rawProducts), [rawProducts]);
  const filteredProducts = storeProducts;

  // Destaques / Vitrine Top Picks (para o carrossel interativo)
  // Determinístico e estável para nunca piscar ou reembaralhar durante o scroll
  const spotlightProducts = useMemo(() => {
    const candidateList = paginatedProducts;
    const all = groupMarketplaceProducts(candidateList).filter((p) => getStockStatus(p).canBuy);
    if (all.length === 0) return [];

    const hasSalesRanking = all.some((p) => (p.sales_count || 0) > 0);
    if (hasSalesRanking) {
      return [...all].sort((a, b) => (b.sales_count || 0) - (a.sales_count || 0)).slice(0, 10);
    }

    // Seleção estável sem Math.random(): preserva ordem consistente
    return [...all].sort((a, b) => b.id - a.id).slice(0, 10);
  }, [paginatedProducts.slice(0, 24).map((p) => p.id).join(',')]);

  useEffect(() => {
    checkCarouselScroll();
    const handleResize = () => checkCarouselScroll();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [spotlightProducts.length]);

  // Auto-play do Carrossel de Destaques da Coleção (roda automaticamente a cada 3.8s)
  useEffect(() => {
    if (isCarouselPaused || spotlightProducts.length <= 1) return;

    const interval = setInterval(() => {
      if (!carouselRef.current) return;
      const container = carouselRef.current;
      const { scrollLeft, scrollWidth, clientWidth } = container;

      // Se atingir o fim da trilha, retorna suavemente para o início
      if (scrollLeft + clientWidth >= scrollWidth - 25) {
        container.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        const cardWidth =
          clientWidth >= 1024
            ? clientWidth / 4
            : clientWidth >= 640
            ? clientWidth / 2
            : clientWidth * 0.78;
        container.scrollBy({ left: cardWidth, behavior: 'smooth' });
      }
    }, 3800);

    return () => clearInterval(interval);
  }, [isCarouselPaused, spotlightProducts.length]);

  // Categorias com contador de produtos
  const categoriesWithCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    paginatedProducts.forEach((p) => {
      const slug = p.category?.slug || 'sem-categoria';
      counts[slug] = (counts[slug] || 0) + 1;
    });

    return categories.map((cat) => ({
      ...cat,
      count: counts[cat.slug] || 0,
    }));
  }, [categories, paginatedProducts]);



  // Copiar link do catálogo
  const handleCopyCatalogLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    });
  };

  // Navegar para a loja oficial
  const goToStore = (productSlugOrId?: string | number) => {
    if (!activeTenant?.slug) return;
    const targetUrl = productSlugOrId
      ? getProductPath(activeTenant.slug, productSlugOrId, getCurrentStoreRouteStyle())
      : getStorePath(activeTenant.slug, getCurrentStoreRouteStyle());
    window.history.pushState({}, '', targetUrl);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const primaryColor = tenantSettings?.primary_color || '#22d3ee';
  const storeName = tenantSettings?.store_name || activeTenant?.name || 'AZ3D Studio';
  const logoUrl = tenantSettings?.logo_url || activeTenant?.logo_url;

  return (
    <div
      className="min-h-screen bg-slate-100 dark:bg-chumbo-950 text-slate-900 dark:text-slate-100 font-sans flex flex-col transition-colors duration-150"
      style={{ '--tenant-primary': primaryColor } as React.CSSProperties}
    >
      {/* Top Header / Identidade da Loja - Totalmente responsivo com suporte a Tema Claro / Escuro */}
      <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-chumbo-800/80 bg-white/95 dark:bg-chumbo-950/95 backdrop-blur-xl transition-colors">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 sm:h-20 flex items-center justify-between gap-2 sm:gap-4">
          {/* Logo & Informações da Loja */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {logoUrl ? (
              <img
                src={resolveApiAssetUrl(logoUrl)}
                alt={storeName}
                className="h-8 w-8 sm:h-12 sm:w-12 rounded-xl object-contain shrink-0"
              />
            ) : (
              <AZ3DLogo className="h-8 w-8 sm:h-12 sm:w-12 rounded-xl object-contain shrink-0" />
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h1 className="text-xs sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight truncate max-w-[120px] min-[400px]:max-w-[160px] sm:max-w-xs md:max-w-md">
                  {storeName}
                </h1>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-100 dark:bg-cyan-950/70 border border-cyan-300 dark:border-cyan-500/30 text-cyan-800 dark:text-cyan-300 shrink-0">
                  Catálogo
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
                <span className="truncate">Impressão 3D</span>
                <span className="text-slate-400 dark:text-chumbo-600">•</span>
                <span className="text-slate-500 dark:text-slate-400 shrink-0">{totalCatalogCount || storeProducts.length} itens</span>
              </p>
            </div>
          </div>

          {/* Quick Actions no Cabeçalho */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Alternador de Tema Claro / Escuro */}
            <button
              type="button"
              onClick={toggleTheme}
              title={isDark ? 'Alternar para tema claro' : 'Alternar para tema escuro'}
              aria-label="Alternar tema claro/escuro"
              className="inline-flex items-center gap-1.5 p-2 sm:px-3 sm:py-2 rounded-xl text-xs font-semibold bg-white dark:bg-chumbo-900 hover:bg-slate-100 dark:hover:bg-chumbo-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-chumbo-700/80 transition-all shadow-sm active:scale-95 shrink-0"
            >
              {isDark ? (
                <>
                  <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 fill-amber-400/20" />
                  <span className="hidden md:inline text-amber-400 font-bold">Claro</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-700 fill-slate-700/20" />
                  <span className="hidden md:inline text-slate-700 font-bold">Escuro</span>
                </>
              )}
            </button>

            {/* Botão de Compartilhar Link */}
            <button
              type="button"
              onClick={handleCopyCatalogLink}
              title="Copiar link do catálogo para compartilhar"
              aria-label="Compartilhar catálogo"
              className="inline-flex items-center gap-1.5 p-2 sm:px-3 sm:py-2 rounded-xl text-xs font-semibold bg-white dark:bg-chumbo-900 hover:bg-slate-100 dark:hover:bg-chumbo-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-chumbo-700/80 transition-all shadow-sm active:scale-95 shrink-0"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold hidden md:inline">Copiado!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Compartilhar</span>
                </>
              )}
            </button>

            {/* Ir para a Loja Oficial */}
            <button
              type="button"
              onClick={() => goToStore()}
              className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white border border-cyan-500 transition-all shadow-md active:scale-95 shrink-0"
              title="Acessar loja oficial com carrinho e checkout"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span className="hidden min-[400px]:inline">Loja</span>
              <span className="hidden sm:inline">Oficial</span>
              <ArrowUpRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 opacity-80" />
            </button>
          </div>
        </div>
      </header>

      {/* Área Principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-6 sm:space-y-8">
        {/* Banner de Apresentação Leve & Calmo - Alto Contraste em Qualquer Tema */}
        <section className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-chumbo-950 to-cyan-950 p-5 sm:p-8 lg:p-10 shadow-2xl text-white">
          <div className="absolute -right-16 -top-16 w-60 sm:w-80 h-60 sm:h-80 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -left-16 -bottom-16 w-60 sm:w-72 h-60 sm:h-72 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-2xl space-y-2 sm:space-y-3">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-cyan-400/20 border border-cyan-400/40 !text-white text-[11px] sm:text-xs font-bold">
              <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 !text-white" />
              <span className="!text-white font-bold">Vitrine Visual • Impressão 3D</span>
            </div>
            <h2 className="text-xl min-[400px]:text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-tight drop-shadow-sm">
              Veja com calma tudo o que podemos produzir para você.
            </h2>
            <p className="text-xs sm:text-sm lg:text-base text-slate-200 leading-relaxed font-normal">
              Explore o catálogo completo de impressão 3D, descubra cores e modelos, e veja as especificações de cada peça.
              Quando decidir, finalize na loja ou fale direto conosco no WhatsApp!
            </p>
          </div>
        </section>

        {/* Destaques / Vitrine em Evidência - Carrossel Interativo com Controles e Indicadores */}
        {spotlightProducts.length > 0 && selectedCategory === 'todas' && !searchQuery && (
          <section className="space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-500/15 text-amber-500 border border-amber-500/20">
                  <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                    Destaques da Coleção
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
                    Peças mais procuradas e recomendadas para você
                  </p>
                </div>
              </div>

              {/* Controles de Navegação do Carrossel */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => scrollCarousel('left')}
                  disabled={!carouselCanScrollLeft}
                  className={`p-2 rounded-xl border transition-all ${
                    carouselCanScrollLeft
                      ? 'bg-white dark:bg-chumbo-900 border-slate-300 dark:border-chumbo-700 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-chumbo-800 shadow-sm active:scale-95'
                      : 'bg-slate-100 dark:bg-chumbo-900/40 border-slate-200 dark:border-chumbo-800 text-slate-400 dark:text-slate-600 opacity-40 cursor-not-allowed'
                  }`}
                  title="Anterior"
                  aria-label="Item anterior do carrossel"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollCarousel('right')}
                  disabled={!carouselCanScrollRight}
                  className={`p-2 rounded-xl border transition-all ${
                    carouselCanScrollRight
                      ? 'bg-white dark:bg-chumbo-900 border-slate-300 dark:border-chumbo-700 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-chumbo-800 shadow-sm active:scale-95'
                      : 'bg-slate-100 dark:bg-chumbo-900/40 border-slate-200 dark:border-chumbo-800 text-slate-400 dark:text-slate-600 opacity-40 cursor-not-allowed'
                  }`}
                  title="Próximo"
                  aria-label="Próximo item do carrossel"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Trilho do Carrossel com Snap suave e Rotação Automática */}
            <div
              ref={carouselRef}
              onScroll={checkCarouselScroll}
              onMouseEnter={() => setIsCarouselPaused(true)}
              onMouseLeave={() => setIsCarouselPaused(false)}
              onTouchStart={() => setIsCarouselPaused(true)}
              onTouchEnd={() => setIsCarouselPaused(false)}
              className="flex gap-3 sm:gap-4 overflow-x-auto pb-3 pt-1 no-scrollbar scroll-smooth snap-x snap-mandatory touch-pan-x -mx-1 px-1"
            >
              {spotlightProducts.map((product) => {
                const cover = optimizeImageUrl(product.color_images?.[0]?.image_url || product.image_url);
                return (
                  <div
                    key={`spotlight-${product.id}`}
                    onClick={() => {
                      setDetailProduct(product);
                      setActiveImageIndex(0);
                    }}
                    className="carousel-spotlight-item w-[78vw] min-[420px]:w-[65vw] sm:w-[calc(50%-10px)] md:w-[calc(33.333%-12px)] lg:w-[calc(25%-12px)] shrink-0 snap-start group relative cursor-pointer overflow-hidden rounded-2xl border border-slate-200/90 dark:border-chumbo-800 bg-white dark:bg-chumbo-900/70 p-2.5 sm:p-3 hover:border-cyan-500/50 dark:hover:border-cyan-500/40 transition-all duration-300 shadow-sm hover:shadow-xl hover:-translate-y-0.5"
                  >
                    <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-slate-100 dark:bg-chumbo-950">
                      <img
                        src={cover}
                        alt={product.title}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    </div>

                    <div className="mt-2 space-y-1">
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-cyan-600 dark:group-hover:text-cyan-300 transition-colors">
                        {product.title}
                      </h4>
                      {(() => {
                        const dim = extractProductDimensions(product);
                        return dim ? (
                          <p className="text-xs sm:text-[13px] font-medium text-slate-700 dark:text-slate-300 truncate">
                            Dimensões do produto: <span className="font-bold text-slate-900 dark:text-slate-100">{dim}</span>
                          </p>
                        ) : null;
                      })()}
                      <div className="flex items-baseline gap-1.5 pt-0.5">
                        <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Preço:</span>
                        <span className="text-base sm:text-lg lg:text-xl font-black text-cyan-700 dark:text-cyan-400">
                          {money(getCatalogPrice(product.price))}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Indicador de Bolinhas do Carrossel */}
            {spotlightProducts.length > 1 && (
              <div className="flex items-center justify-center gap-1.5 pt-1">
                {spotlightProducts.map((_, idx) => (
                  <button
                    key={`dot-${idx}`}
                    type="button"
                    onClick={() => scrollToCarouselIndex(idx)}
                    className={`h-1.5 rounded-full transition-all ${
                      activeCarouselIndex === idx
                        ? 'w-6 bg-cyan-600 dark:bg-cyan-400'
                        : 'w-1.5 bg-slate-300 dark:bg-chumbo-700 hover:bg-slate-400 dark:hover:bg-chumbo-600'
                    }`}
                    aria-label={`Ir para destaque ${idx + 1}`}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Barra de Filtros e Busca (Sticky com altura otimizada para mobile) */}
        <section className="sticky top-14 sm:top-20 z-30 -mx-3 sm:-mx-6 lg:-mx-8 px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3 bg-slate-100/95 dark:bg-chumbo-950/95 backdrop-blur-md border-y border-slate-200 dark:border-chumbo-800/80 space-y-2.5 sm:space-y-3 transition-colors">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3">
            {/* Campo de Busca Rápida */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar produto por nome, modelo, cor..."
                className="w-full pl-9 pr-8 py-2 rounded-xl bg-white dark:bg-chumbo-900 border border-slate-300 dark:border-chumbo-700/80 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all shadow-xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white p-1"
                  aria-label="Limpar busca"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Controles de Ordenação e Visualização */}
            <div className="flex items-center gap-1.5 sm:gap-2 justify-between sm:justify-end shrink-0">
              {/* Ordenação */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-white dark:bg-chumbo-900 border border-slate-300 dark:border-chumbo-700/80 text-[11px] sm:text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-cyan-500 text-ellipsis shadow-xs"
              >
                <option value="featured">Destaques</option>
                <option value="price_asc">Menor Preço</option>
                <option value="price_desc">Maior Preço</option>
                <option value="name">Alfabética</option>
              </select>

              {/* Alternador de Layout (Grade / Lista) */}
              <div className="flex items-center p-0.5 sm:p-1 rounded-xl bg-slate-200 dark:bg-chumbo-900 border border-slate-300 dark:border-chumbo-700/80">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-lg transition-all ${
                    viewMode === 'grid'
                      ? 'bg-white dark:bg-chumbo-800 text-cyan-600 dark:text-cyan-400 shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Grade Visual"
                  aria-label="Visualização em grade"
                >
                  <Grid className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
                <button
                  onClick={() => setViewMode('compact')}
                  className={`p-1.5 rounded-lg transition-all ${
                    viewMode === 'compact'
                      ? 'bg-white dark:bg-chumbo-800 text-cyan-600 dark:text-cyan-400 shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Lista Compacta"
                  aria-label="Visualização em lista"
                >
                  <List className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Categorias em Pílulas com Scroll Horizontal */}
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar pb-1 text-xs -mx-1 px-1 touch-pan-x">
            <button
              onClick={() => setSelectedCategory('todas')}
              className={`shrink-0 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full text-xs font-medium transition-all ${
                selectedCategory === 'todas'
                  ? 'bg-cyan-600 !text-white font-bold shadow-md shadow-cyan-600/30'
                  : 'bg-white dark:bg-chumbo-900 text-slate-800 dark:text-white hover:bg-slate-50 dark:hover:bg-chumbo-800 border border-slate-300 dark:border-chumbo-700/70 shadow-xs'
              }`}
            >
              <span className={selectedCategory === 'todas' ? '!text-white' : 'text-slate-800 dark:text-white'}>
                Todas ({totalCatalogCount || storeProducts.length})
              </span>
            </button>
            {categoriesWithCounts.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.slug)}
                className={`shrink-0 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
                  selectedCategory === cat.slug
                    ? 'bg-cyan-600 !text-white font-bold shadow-md shadow-cyan-600/30'
                    : 'bg-white dark:bg-chumbo-900 text-slate-800 dark:text-white hover:bg-slate-50 dark:hover:bg-chumbo-800 border border-slate-300 dark:border-chumbo-700/70 shadow-xs'
                }`}
              >
                <span className={selectedCategory === cat.slug ? '!text-white' : 'text-slate-800 dark:text-white'}>
                  {cat.name}
                </span>
                {cat.count > 0 && (
                  <span
                    className={`text-[9px] sm:text-[10px] px-1.5 py-0.2 rounded-full ${
                      selectedCategory === cat.slug
                        ? 'bg-cyan-700 !text-white font-bold'
                        : 'bg-slate-100 dark:bg-chumbo-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {cat.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </section>

        {/* Catálogo de Produtos - Totalmente Responsivo para celular, tablet e PC */}
        {(isCatalogLoading && filteredProducts.length === 0) ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4 lg:gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-2xl border border-slate-200 dark:border-chumbo-800 bg-white/60 dark:bg-chumbo-900/40 p-2.5 sm:p-3 space-y-2.5 sm:space-y-3"
              >
                <div className="aspect-square w-full rounded-xl bg-slate-200 dark:bg-chumbo-800/60" />
                <div className="h-4 w-3/4 rounded bg-slate-200 dark:bg-chumbo-800/60" />
                <div className="h-4 w-1/3 rounded bg-slate-200 dark:bg-chumbo-800/60" />
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-16 sm:py-20 text-center space-y-3 border border-dashed border-slate-300 dark:border-chumbo-800 rounded-3xl p-6 sm:p-8 bg-white/50 dark:bg-chumbo-900/20">
            <Layers className="w-10 h-10 sm:w-12 sm:h-12 text-slate-400 dark:text-slate-600 mx-auto" />
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              {searchQuery || selectedCategory !== 'todas'
                ? 'Nenhum item encontrado'
                : 'Nenhum produto cadastrado nesta loja'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              {searchQuery || selectedCategory !== 'todas'
                ? 'Tente buscar por outro termo ou mude os filtros de categoria e material.'
                : 'Esta loja ainda não possui produtos ativos disponíveis no catálogo.'}
            </p>
            {(searchQuery || selectedCategory !== 'todas') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('todas');
                }}
                className="mt-2 px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white dark:bg-chumbo-800 dark:hover:bg-chumbo-700 shadow-sm"
              >
                Limpar filtros
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          /* Grade Visual Ampla (Mobile: 2 colunas / Tablet: 3 colunas / PC: 4 colunas) */
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4 lg:gap-6">
            {filteredProducts.map((product) => (
              <CatalogProductCard
                key={product.id}
                product={product}
                onOpenDetail={(prod, imgIdx) => {
                  setDetailProduct(prod);
                  setActiveImageIndex(imgIdx || 0);
                }}
              />
            ))}

            {/* Esqueletos de loading das novas peças para o scroll infinito (Grade) */}
            {isLoadingMore && (
              <>
                {Array.from({ length: 4 }).map((_, idx) => (
                  <div
                    key={`loading-more-card-${idx}`}
                    className="flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 dark:border-chumbo-800/80 bg-white/70 dark:bg-chumbo-900/40 p-2.5 sm:p-3 space-y-2.5 sm:space-y-3 animate-pulse"
                  >
                    <div className="relative aspect-square w-full rounded-xl bg-slate-200/80 dark:bg-chumbo-800/60 flex items-center justify-center">
                      {idx === 0 && (
                        <Loader2 className="w-7 h-7 text-cyan-500 animate-spin" />
                      )}
                    </div>
                    <div className="h-4 w-3/4 rounded bg-slate-200/80 dark:bg-chumbo-800/60" />
                    <div className="h-4 w-1/3 rounded bg-slate-200/80 dark:bg-chumbo-800/60" />
                  </div>
                ))}
              </>
            )}
          </div>
        ) : (
          /* Lista Compacta */
          <div className="space-y-2">
            {filteredProducts.map((product) => {
              const cover = optimizeImageUrl(product.color_images?.[0]?.image_url || product.image_url);
              const status = getStockStatus(product);

              return (
                <div
                  key={product.id}
                  onClick={() => {
                    setDetailProduct(product);
                    setActiveImageIndex(0);
                  }}
                  className="group flex items-center justify-between gap-3 p-3 rounded-2xl border border-slate-200/90 dark:border-chumbo-800 bg-white dark:bg-chumbo-900/40 hover:bg-slate-50 dark:hover:bg-chumbo-900/80 hover:border-slate-300 dark:hover:border-chumbo-700 transition-all cursor-pointer shadow-xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={cover}
                      alt={product.title}
                      loading="lazy"
                      decoding="async"
                      className="h-14 w-14 sm:h-16 sm:w-16 rounded-xl object-cover bg-slate-100 dark:bg-chumbo-950 border border-slate-200 dark:border-chumbo-800 shrink-0"
                    />
                    <div className="min-w-0">
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-cyan-600 dark:group-hover:text-cyan-300">
                        {product.title}
                      </h4>
                      {(() => {
                        const dim = extractProductDimensions(product);
                        return dim ? (
                          <p className="text-xs sm:text-[13px] font-medium text-slate-700 dark:text-slate-300 truncate">
                            Dimensões do produto: <span className="font-bold text-slate-900 dark:text-slate-100">{dim}</span>
                          </p>
                        ) : null;
                      })()}
                      <span className={`inline-block mt-1 px-2 py-0.2 rounded-md text-[9px] font-bold border ${status.tone}`}>
                        {status.label}
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <span className="text-[10px] sm:text-xs font-bold uppercase text-slate-500 dark:text-slate-400 block">Preço:</span>
                    <span className="text-base sm:text-lg font-black text-cyan-700 dark:text-cyan-400">
                      {money(getCatalogPrice(product.price))}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Esqueleto de loading na lista compacta */}
            {isLoadingMore && (
              <div className="flex items-center gap-3 p-4 rounded-2xl border border-slate-200/80 dark:border-chumbo-800/80 bg-white/70 dark:bg-chumbo-900/40 animate-pulse">
                <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-xl bg-slate-200/80 dark:bg-chumbo-800/60 flex items-center justify-center shrink-0">
                  <Loader2 className="w-5 h-5 text-cyan-500 animate-spin" />
                </div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/2 rounded bg-slate-200/80 dark:bg-chumbo-800/60" />
                  <div className="h-3 w-1/4 rounded bg-slate-200/80 dark:bg-chumbo-800/60" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Loading de Paginação no Scroll */}
        <div ref={loadMoreSentinelRef} className={`flex flex-col items-center justify-center ${isLoadingMore ? 'py-6 min-h-[90px]' : 'py-2 min-h-[20px]'}`}>
          {isLoadingMore && (
            <div className="flex items-center gap-3 py-3 px-5 rounded-2xl bg-white dark:bg-chumbo-900 border border-slate-200 dark:border-chumbo-700/80 text-cyan-600 dark:text-cyan-400 shadow-md animate-in fade-in duration-200">
              <Loader2 className="w-5 h-5 animate-spin text-cyan-500" />
              <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
                Carregando mais peças...
              </span>
            </div>
          )}
        </div>
      </main>

      {/* Modal de Detalhe Rápido do Produto - Totalmente responsivo com suporte a Tema Claro e Escuro */}
      {detailProduct && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setDetailProduct(null)}
        >
          <div
            className="relative w-full max-w-xl md:max-w-5xl lg:max-w-6xl xl:max-w-7xl overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-chumbo-700 bg-white dark:bg-chumbo-950 text-slate-900 dark:text-slate-100 p-4 sm:p-6 md:p-8 lg:p-10 shadow-2xl max-h-[94vh] md:max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Fechar sem sobreposição */}
            <button
              onClick={() => setDetailProduct(null)}
              className="absolute top-3.5 right-3.5 sm:top-5 sm:right-5 z-30 p-2 sm:p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-chumbo-900 dark:hover:bg-chumbo-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-chumbo-700 transition-all shadow-sm active:scale-95 cursor-pointer"
              aria-label="Fechar detalhes"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="md:grid md:grid-cols-2 lg:grid-cols-[1.25fr_1fr] md:gap-8 lg:gap-12 md:items-stretch space-y-4 md:space-y-0">
              {/* Coluna Esquerda: Galeria de Fotos Ampliada */}
              <div className="space-y-3 flex flex-col justify-between">
                <div className="relative aspect-square md:aspect-auto md:min-h-[460px] lg:min-h-[540px] xl:min-h-[600px] w-full overflow-hidden rounded-2xl bg-slate-50 dark:bg-chumbo-900/60 border border-slate-200 dark:border-chumbo-800 flex items-center justify-center group/modalimg">
                  {(() => {
                    const allImages = getProductImages(detailProduct);
                    const currentImage = allImages[activeImageIndex] || detailProduct.image_url;

                    return (
                      <>
                        <img
                          src={optimizeImageUrl(currentImage)}
                          alt={detailProduct.title}
                          decoding="async"
                          className="w-full h-full max-h-[600px] object-contain p-2 sm:p-4 lg:p-6 transition-all duration-300"
                        />

                        {/* Setas de navegação na galeria do modal */}
                        {allImages.length > 1 && (
                          <>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveImageIndex((prev) => (prev - 1 + allImages.length) % allImages.length);
                              }}
                              className="absolute left-3 top-1/2 -translate-y-1/2 z-20 p-2 sm:p-2.5 rounded-full bg-white/95 dark:bg-chumbo-900/95 text-slate-800 dark:text-slate-100 shadow-lg hover:scale-110 active:scale-95 transition-all border border-slate-200/80 dark:border-chumbo-700/80 cursor-pointer"
                              title="Foto anterior"
                              aria-label="Foto anterior"
                            >
                              <ChevronLeft className="w-5 h-5" />
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveImageIndex((prev) => (prev + 1) % allImages.length);
                              }}
                              className="absolute right-3 top-1/2 -translate-y-1/2 z-20 p-2 sm:p-2.5 rounded-full bg-white/95 dark:bg-chumbo-900/95 text-slate-800 dark:text-slate-100 shadow-lg hover:scale-110 active:scale-95 transition-all border border-slate-200/80 dark:border-chumbo-700/80 cursor-pointer"
                              title="Próxima foto"
                              aria-label="Próxima foto"
                            >
                              <ChevronRight className="w-5 h-5" />
                            </button>
                          </>
                        )}
                      </>
                    );
                  })()}
                </div>

                {/* Miniaturas de Cores/Ângulos */}
                {(() => {
                  const allImages = getProductImages(detailProduct);
                  if (allImages.length <= 1) return null;

                  return (
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar pt-1">
                      {allImages.map((img, idx) => (
                        <button
                          key={idx}
                          onClick={() => setActiveImageIndex(idx)}
                          className={`relative h-14 w-14 sm:h-16 sm:w-16 rounded-xl overflow-hidden border shrink-0 transition-all ${
                            activeImageIndex === idx
                              ? 'border-cyan-500 ring-2 ring-cyan-500/40 scale-105'
                              : 'border-slate-200 dark:border-chumbo-800 opacity-60 hover:opacity-100'
                          }`}
                        >
                          <img src={optimizeImageUrl(img)} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Coluna Direita: Informações & Ações */}
              <div className="flex flex-col justify-between h-full space-y-5">
                <div className="space-y-4 flex-1">
                  {/* Cabeçalho do Produto: Título em linha inteira e Preço diretamente abaixo */}
                  <div className="space-y-2 pr-12 sm:pr-14 md:pr-16">
                    <h3 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 dark:text-white leading-tight break-words">
                      {detailProduct.title}
                    </h3>
                    <div className="flex items-baseline gap-2 pt-1">
                      <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Preço:</span>
                      <span className="text-2xl sm:text-3xl lg:text-4xl font-black text-cyan-700 dark:text-cyan-400">
                        {money(getCatalogPrice(detailProduct.price))}
                      </span>
                    </div>
                  </div>

                  {/* Especificações da Peça 3D */}
                  <div className="grid grid-cols-3 gap-2.5 p-3 sm:p-4 rounded-xl bg-slate-50 dark:bg-chumbo-900/70 border border-slate-200 dark:border-chumbo-800 text-xs sm:text-sm">
                    <div>
                      <span className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 block uppercase font-mono">Material</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">{detailProduct.material || 'PLA'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 block uppercase font-mono">Dimensões</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">{extractProductDimensions(detailProduct) || 'Sob medida'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 block uppercase font-mono">Status</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400 truncate block">{getStockStatus(detailProduct).label}</span>
                    </div>
                  </div>

                  {detailProduct.description && (
                    <div className="space-y-2">
                      <h5 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Detalhes da Peça</h5>
                      <p className="text-sm sm:text-base text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line max-h-72 overflow-y-auto pr-2">
                        {detailProduct.description}
                      </p>
                    </div>
                  )}
                </div>

                {/* Ações no Modal fixadas na base */}
                <div className="pt-4 border-t border-slate-200 dark:border-chumbo-800 grid grid-cols-1 sm:grid-cols-2 gap-3 mt-auto">
                  <button
                    type="button"
                    onClick={() => {
                      const storeName = tenantSettings?.store_name || activeTenant?.name || 'sua loja';
                      const msg = `Olá! Vi o produto *${detailProduct.title}* (${money(getCatalogPrice(detailProduct.price))}) no catálogo da *${storeName}* e gostaria de mais informações!`;
                      window.open(`https://wa.me/5543998068708?text=${encodeURIComponent(msg)}`, '_blank');
                    }}
                    className="flex items-center justify-center gap-2 py-3 sm:py-3.5 px-4 rounded-xl text-xs sm:text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md active:scale-95 cursor-pointer"
                  >
                    <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="truncate">Tirar dúvidas no WhatsApp</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => goToStore(detailProduct.slug || detailProduct.id)}
                    className="flex items-center justify-center gap-2 py-3 sm:py-3.5 px-4 rounded-xl text-xs sm:text-sm font-bold bg-slate-950 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 !text-white dark:!text-slate-950 transition-all shadow-md active:scale-95 cursor-pointer"
                  >
                    <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5 !text-white dark:!text-slate-950" />
                    <span className="truncate !text-white dark:!text-slate-950 font-bold">Ver na Loja Oficial</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer simples do Catálogo */}
      <footer className="mt-16 border-t border-slate-200 dark:border-chumbo-800/80 bg-white dark:bg-chumbo-950 py-8 text-center text-xs text-slate-500 dark:text-slate-400 space-y-2 transition-colors">
        <p className="font-medium text-slate-800 dark:text-slate-300">
          {storeName} • Catálogo Digital de Impressão 3D
        </p>
        <p>
          Tem um modelo personalizado em mente? Converse conosco para um orçamento sob medida.
        </p>
        <div className="pt-2">
          <button
            onClick={() => goToStore()}
            className="text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300 font-semibold underline underline-offset-4"
          >
            Acessar loja oficial com carrinho e checkout
          </button>
        </div>
      </footer>
    </div>
  );
};
export default CatalogApp;
