import React, { useEffect, useMemo, useState } from 'react';
import {
  Heart,
  Share2,
  ExternalLink,
  MessageCircle,
  Search,
  Grid,
  List,
  Check,
  Copy,
  Sparkles,
  Layers,
  ArrowRight,
  X,
  Star,
  ShoppingBag,
  Maximize2,
  Trash2,
  Flame,
  ArrowUpRight,
} from 'lucide-react';
import { Product, TenantSettings } from '../../types';
import { useTenantCatalog } from '../../shared/hooks/useTenantCatalog';
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

interface SavedItem {
  id: number;
  title: string;
  price: number;
  image: string;
  material?: string;
  slug?: string;
  selectedColor?: string;
}

export const CatalogApp: React.FC = () => {
  const {
    activeTenant,
    categories,
    products,
    isLoading,
  } = useTenantCatalog();

  const [tenantSettings, setTenantSettings] = useState<TenantSettings | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('todas');
  const [selectedMaterial, setSelectedMaterial] = useState<string>('todos');
  const [sortBy, setSortBy] = useState<'featured' | 'price_asc' | 'price_desc' | 'name'>('featured');
  const [viewMode, setViewMode] = useState<'grid' | 'compact'>('grid');

  // Modal de Detalhes Rápido
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // Caderno de Desejos / Salvos para Depois
  const [savedItems, setSavedItems] = useState<SavedItem[]>(() => {
    if (!activeTenant) return [];
    try {
      const stored = localStorage.getItem(`az3d_catalog_saved_${activeTenant.id}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [isSavedDrawerOpen, setIsSavedDrawerOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedWishlist, setCopiedWishlist] = useState(false);

  // Atualiza configurações do tenant
  useEffect(() => {
    if (!activeTenant) return;
    api.getTenantSettings(activeTenant.id)
      .then(setTenantSettings)
      .catch(() => setTenantSettings(null));
  }, [activeTenant]);

  // Recarrega itens salvos ao trocar tenant
  useEffect(() => {
    if (!activeTenant) return;
    try {
      const stored = localStorage.getItem(`az3d_catalog_saved_${activeTenant.id}`);
      setSavedItems(stored ? JSON.parse(stored) : []);
    } catch {
      setSavedItems([]);
    }
  }, [activeTenant?.id]);

  // Salva itens salvos no localStorage
  useEffect(() => {
    if (!activeTenant) return;
    try {
      localStorage.setItem(`az3d_catalog_saved_${activeTenant.id}`, JSON.stringify(savedItems));
    } catch (e) {
      console.warn('Falha ao salvar itens do catálogo:', e);
    }
  }, [savedItems, activeTenant?.id]);

  // Ajusta título da página
  useEffect(() => {
    const storeName = tenantSettings?.store_name || activeTenant?.name || 'Catálogo Digital';
    document.title = `Catálogo Visual • ${storeName}`;
  }, [activeTenant, tenantSettings]);

  const storeProducts = useMemo(() => groupMarketplaceProducts(products), [products]);

  // Materiais disponíveis
  const materialList = useMemo(() => {
    const set = new Set<string>();
    storeProducts.forEach((p) => {
      if (p.material) set.add(p.material.trim());
    });
    return Array.from(set).sort();
  }, [storeProducts]);

  // Filtragem e busca
  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return storeProducts
      .filter((product) => {
        // Categoria
        if (selectedCategory !== 'todas') {
          const matchCat =
            product.category?.slug === selectedCategory ||
            String(product.category_id) === selectedCategory;
          if (!matchCat) return false;
        }

        // Material
        if (selectedMaterial !== 'todos') {
          if (!product.material || !product.material.toLowerCase().includes(selectedMaterial.toLowerCase())) {
            return false;
          }
        }

        // Busca textual
        if (q) {
          const family = product.store_variants?.length ? product.store_variants : [product];
          const text = family
            .flatMap((item) => [
              item.title,
              item.description,
              item.material,
              item.category?.name || '',
            ])
            .join(' ')
            .toLowerCase();
          if (!text.includes(q)) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'price_asc') return a.price - b.price;
        if (sortBy === 'price_desc') return b.price - a.price;
        if (sortBy === 'name') return a.title.localeCompare(b.title);
        // Featured (Destaques)
        const aScore = (a.review_summary?.review_count || a.review_count || 0) + (getStockStatus(a).canBuy ? 10 : 0);
        const bScore = (b.review_summary?.review_count || b.review_count || 0) + (getStockStatus(b).canBuy ? 10 : 0);
        return bScore - aScore;
      });
  }, [storeProducts, selectedCategory, selectedMaterial, searchQuery, sortBy]);

  // Destaques / Vitrine Top Picks (até 4 produtos)
  const spotlightProducts = useMemo(() => {
    return storeProducts
      .filter((p) => getStockStatus(p).canBuy)
      .slice(0, 4);
  }, [storeProducts]);

  // Categorias com contador de produtos
  const categoriesWithCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    storeProducts.forEach((p) => {
      const slug = p.category?.slug || 'sem-categoria';
      counts[slug] = (counts[slug] || 0) + 1;
    });

    return categories.map((cat) => ({
      ...cat,
      count: counts[cat.slug] || 0,
    }));
  }, [categories, storeProducts]);

  // Ações de Salvar / Desejos
  const toggleSaveItem = (product: Product) => {
    setSavedItems((prev) => {
      const exists = prev.some((item) => item.id === product.id);
      if (exists) {
        return prev.filter((item) => item.id !== product.id);
      } else {
        const cover = optimizeImageUrl(product.color_images?.[0]?.image_url || product.image_url);
        return [
          ...prev,
          {
            id: product.id,
            title: product.title,
            price: product.price,
            image: cover,
            material: product.material,
            slug: product.slug,
          },
        ];
      }
    });
  };

  const isItemSaved = (productId: number) => savedItems.some((item) => item.id === productId);

  // Copiar link do catálogo
  const handleCopyCatalogLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    });
  };

  // Gerar mensagem formatada para o WhatsApp com os itens salvos
  const handleShareWishlistWhatsApp = () => {
    if (savedItems.length === 0) return;
    const storeName = tenantSettings?.store_name || activeTenant?.name || 'sua loja';
    const total = savedItems.reduce((acc, item) => acc + item.price, 0);

    const itemsText = savedItems
      .map((item, idx) => `${idx + 1}. *${item.title}* - ${money(item.price)}${item.material ? ` (${item.material})` : ''}`)
      .join('\n');

    const message = `Olá! Estive olhando o catálogo da *${storeName}* e separei esses itens de interesse:\n\n${itemsText}\n\n*Total Estimado:* ${money(total)}\n\nGostaria de tirar algumas dúvidas e saber mais sobre prazo e cores disponíveis!`;

    const phone = tenantSettings?.origin_cep || '';
    const cleanPhone = phone.replace(/\D/g, '');
    const url = cleanPhone
      ? `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(message)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;

    window.open(url, '_blank');
  };

  // Copiar texto da lista salva
  const handleCopyWishlistText = () => {
    const storeName = tenantSettings?.store_name || activeTenant?.name || 'Catálogo';
    const total = savedItems.reduce((acc, item) => acc + item.price, 0);
    const itemsText = savedItems
      .map((item, idx) => `${idx + 1}. ${item.title} - ${money(item.price)}`)
      .join('\n');

    const fullText = `Minha seleção no catálogo ${storeName}:\n\n${itemsText}\n\nTotal estimado: ${money(total)}`;

    navigator.clipboard.writeText(fullText).then(() => {
      setCopiedWishlist(true);
      setTimeout(() => setCopiedWishlist(false), 2500);
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
      className="min-h-screen bg-chumbo-950 text-slate-100 font-sans flex flex-col selection:bg-cyan-500/30 selection:text-cyan-200"
      style={{ '--tenant-primary': primaryColor } as React.CSSProperties}
    >
      {/* Top Header / Brand Identity - Responsivo para todas as telas */}
      <header className="sticky top-0 z-40 border-b border-chumbo-800/80 bg-chumbo-950/90 backdrop-blur-xl transition-all">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 sm:h-20 flex items-center justify-between gap-2 sm:gap-4">
          {/* Logo & Store Info */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {logoUrl ? (
              <img
                src={resolveApiAssetUrl(logoUrl)}
                alt={storeName}
                className="h-8 w-8 sm:h-12 sm:w-12 rounded-xl object-cover border border-chumbo-700/60 shadow-md bg-chumbo-900 shrink-0"
              />
            ) : (
              <div className="h-8 w-8 sm:h-12 sm:w-12 rounded-xl bg-gradient-to-br from-chumbo-800 to-chumbo-900 border border-chumbo-700 flex items-center justify-center shadow-inner shrink-0">
                <AZ3DLogo className="h-5 w-5 sm:h-6 sm:w-6 text-cyan-400" />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h1 className="text-xs sm:text-lg font-bold text-white tracking-tight truncate max-w-[120px] min-[400px]:max-w-[160px] sm:max-w-xs md:max-w-md">
                  {storeName}
                </h1>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-950/70 border border-cyan-500/30 text-cyan-300 shrink-0">
                  Catálogo
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-400 truncate flex items-center gap-1">
                <span className="truncate">Impressão 3D</span>
                <span className="text-chumbo-600">•</span>
                <span className="text-slate-400 shrink-0">{storeProducts.length} itens</span>
              </p>
            </div>
          </div>

          {/* Quick Actions (Adapta para telas pequenas) */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* Botão de Compartilhar Link */}
            <button
              onClick={handleCopyCatalogLink}
              title="Copiar link do catálogo para compartilhar"
              aria-label="Compartilhar catálogo"
              className="inline-flex items-center gap-1.5 p-2 sm:px-3 sm:py-2 rounded-xl text-xs font-medium text-slate-300 bg-chumbo-900 hover:bg-chumbo-800 border border-chumbo-700/80 transition-all hover:text-white active:scale-95"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-semibold hidden md:inline">Copiado!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Compartilhar</span>
                </>
              )}
            </button>

            {/* Caderno de Escolhas / Salvos (Wishlist) */}
            <button
              onClick={() => setIsSavedDrawerOpen(true)}
              className="relative inline-flex items-center gap-1.5 sm:gap-2 p-2 sm:px-3.5 sm:py-2 rounded-xl text-xs font-semibold bg-chumbo-900 hover:bg-chumbo-800 border border-chumbo-700/80 text-white transition-all shadow-sm active:scale-95"
              title="Ver itens que você separou para depois"
              aria-label="Ver itens salvos"
            >
              <Heart className={`w-4 h-4 ${savedItems.length > 0 ? 'fill-rose-500 text-rose-500' : 'text-slate-400'}`} />
              <span className="hidden lg:inline">Salvos</span>
              {savedItems.length > 0 && (
                <span className="flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full bg-rose-500 text-[9px] sm:text-[10px] font-extrabold text-white shadow">
                  {savedItems.length}
                </span>
              )}
            </button>

            {/* Ir para a Loja Oficial */}
            <button
              onClick={() => goToStore()}
              className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs font-bold bg-white text-chumbo-950 hover:bg-slate-200 transition-all shadow-md active:scale-95 shrink-0"
              title="Acessar loja oficial com carrinho e checkout"
            >
              <ShoppingBag className="w-3.5 h-3.5 text-chumbo-950" />
              <span className="hidden min-[400px]:inline">Loja</span>
              <span className="hidden sm:inline">Oficial</span>
              <ArrowUpRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 opacity-60" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-6 sm:space-y-8">
        {/* Banner de Apresentação Leve & Calmo - Altamente Responsivo */}
        <section className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-chumbo-800/80 bg-gradient-to-br from-chumbo-900/90 via-chumbo-950 to-chumbo-900/60 p-4 sm:p-8 lg:p-10 shadow-2xl">
          <div className="absolute -right-16 -top-16 w-60 sm:w-80 h-60 sm:h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -left-16 -bottom-16 w-60 sm:w-72 h-60 sm:h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-2xl space-y-2 sm:space-y-3">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-[11px] sm:text-xs font-medium">
              <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-cyan-400" />
              <span>Vitrine Visual • Impressão 3D</span>
            </div>
            <h2 className="text-lg min-[400px]:text-xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-tight">
              Veja com calma tudo o que podemos produzir para você.
            </h2>
            <p className="text-xs sm:text-sm lg:text-base text-slate-300 leading-relaxed">
              Explore o catálogo completo de impressão 3D, descubra cores e materiais, e marque suas peças favoritas.
              Quando decidir, finalize na loja ou fale direto conosco no WhatsApp!
            </p>
          </div>
        </section>

        {/* Destaques / Vitrine em Evidência (Spotlight) - Carousel touch no celular, Grid no tablet/desktop */}
        {spotlightProducts.length > 0 && selectedCategory === 'todas' && !searchQuery && (
          <section className="space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
                <h3 className="text-sm sm:text-lg font-bold text-white tracking-tight">Destaques da Coleção</h3>
              </div>
              <span className="text-[11px] sm:text-xs text-slate-400">Mais procurados</span>
            </div>

            {/* Mobile: Swipe suave horizontal com snap; Tablet/PC: Grid clássico de 4 colunas */}
            <div className="flex sm:grid sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 overflow-x-auto sm:overflow-visible pb-2 sm:pb-0 no-scrollbar snap-x snap-mandatory">
              {spotlightProducts.map((product) => {
                const cover = optimizeImageUrl(product.color_images?.[0]?.image_url || product.image_url);
                const isSaved = isItemSaved(product.id);
                return (
                  <div
                    key={`spotlight-${product.id}`}
                    onClick={() => {
                      setDetailProduct(product);
                      setActiveImageIndex(0);
                    }}
                    className="w-[68vw] min-[420px]:w-[55vw] sm:w-auto shrink-0 snap-start group relative cursor-pointer overflow-hidden rounded-2xl border border-chumbo-800 bg-chumbo-900/60 p-2.5 sm:p-3 hover:border-cyan-500/40 transition-all duration-300 hover:shadow-xl hover:shadow-cyan-950/20"
                  >
                    <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-chumbo-950">
                      <img
                        src={cover}
                        alt={product.title}
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSaveItem(product);
                        }}
                        className={`absolute top-2 right-2 p-1.5 sm:p-2 rounded-lg backdrop-blur-md transition-all ${
                          isSaved
                            ? 'bg-rose-500 text-white'
                            : 'bg-chumbo-950/70 text-slate-300 hover:text-white hover:bg-chumbo-900'
                        }`}
                        title={isSaved ? 'Remover dos salvos' : 'Salvar para decidir depois'}
                        aria-label="Salvar item"
                      >
                        <Heart className={`w-3.5 h-3.5 ${isSaved ? 'fill-current' : ''}`} />
                      </button>
                    </div>

                    <div className="mt-2 space-y-0.5 sm:space-y-1">
                      <h4 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-cyan-300 transition-colors">
                        {product.title}
                      </h4>
                      <p className="text-xs sm:text-sm font-extrabold text-cyan-400">
                        {money(product.price)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Barra de Filtros e Busca (Sticky com altura otimizada para mobile) */}
        <section className="sticky top-14 sm:top-20 z-30 -mx-3 sm:-mx-6 lg:-mx-8 px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3 bg-chumbo-950/95 backdrop-blur-md border-y border-chumbo-800/80 space-y-2.5 sm:space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3">
            {/* Campo de Busca Rápida */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nome, material, cor..."
                className="w-full pl-9 pr-8 py-2 rounded-xl bg-chumbo-900/90 border border-chumbo-700/80 text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                  aria-label="Limpar busca"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Controles de Ordenação e Visualização */}
            <div className="flex items-center gap-1.5 sm:gap-2 justify-between sm:justify-end shrink-0">
              {/* Filtro de Material */}
              {materialList.length > 0 && (
                <select
                  value={selectedMaterial}
                  onChange={(e) => setSelectedMaterial(e.target.value)}
                  className="px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-chumbo-900 border border-chumbo-700/80 text-[11px] sm:text-xs font-semibold text-slate-300 focus:outline-none focus:border-cyan-400 max-w-[120px] sm:max-w-none truncate"
                >
                  <option value="todos">Materiais</option>
                  {materialList.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              )}

              {/* Ordenação */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-chumbo-900 border border-chumbo-700/80 text-[11px] sm:text-xs font-semibold text-slate-300 focus:outline-none focus:border-cyan-400 text-ellipsis"
              >
                <option value="featured">Destaques</option>
                <option value="price_asc">Menor Preço</option>
                <option value="price_desc">Maior Preço</option>
                <option value="name">Alfabética</option>
              </select>

              {/* Alternador de Layout (Grade / Lista) */}
              <div className="flex items-center p-0.5 sm:p-1 rounded-xl bg-chumbo-900 border border-chumbo-700/80">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-lg transition-all ${
                    viewMode === 'grid' ? 'bg-chumbo-800 text-cyan-400' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Grade Visual"
                  aria-label="Visualização em grade"
                >
                  <Grid className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
                <button
                  onClick={() => setViewMode('compact')}
                  className={`p-1.5 rounded-lg transition-all ${
                    viewMode === 'compact' ? 'bg-chumbo-800 text-cyan-400' : 'text-slate-400 hover:text-white'
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
                  ? 'bg-cyan-500 text-chumbo-950 font-bold shadow-md shadow-cyan-500/20'
                  : 'bg-chumbo-900 text-slate-300 hover:bg-chumbo-800 border border-chumbo-700/70'
              }`}
            >
              Todas ({storeProducts.length})
            </button>
            {categoriesWithCounts.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.slug)}
                className={`shrink-0 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
                  selectedCategory === cat.slug
                    ? 'bg-cyan-500 text-chumbo-950 font-bold shadow-md shadow-cyan-500/20'
                    : 'bg-chumbo-900 text-slate-300 hover:bg-chumbo-800 border border-chumbo-700/70'
                }`}
              >
                <span>{cat.name}</span>
                {cat.count > 0 && (
                  <span
                    className={`text-[9px] sm:text-[10px] px-1.5 py-0.2 rounded-full ${
                      selectedCategory === cat.slug
                        ? 'bg-chumbo-950/30 text-chumbo-950 font-black'
                        : 'bg-chumbo-800 text-slate-400'
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
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4 lg:gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-2xl border border-chumbo-800 bg-chumbo-900/40 p-2.5 sm:p-3 space-y-2.5 sm:space-y-3"
              >
                <div className="aspect-square w-full rounded-xl bg-chumbo-800/60" />
                <div className="h-4 w-3/4 rounded bg-chumbo-800/60" />
                <div className="h-4 w-1/3 rounded bg-chumbo-800/60" />
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-16 sm:py-20 text-center space-y-3 border border-dashed border-chumbo-800 rounded-3xl p-6 sm:p-8">
            <Layers className="w-10 h-10 sm:w-12 sm:h-12 text-slate-600 mx-auto" />
            <h3 className="text-base sm:text-lg font-bold text-white">Nenhum item encontrado</h3>
            <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
              Tente buscar por outro termo ou mude os filtros de categoria e material.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('todas');
                setSelectedMaterial('todos');
              }}
              className="mt-2 px-4 py-2 rounded-xl text-xs font-bold bg-chumbo-800 hover:bg-chumbo-700 text-white"
            >
              Limpar filtros
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          /* Grade Visual Ampla (Mobile: 2 colunas / Tablet: 3 colunas / PC: 4 colunas) */
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4 lg:gap-6">
            {filteredProducts.map((product) => {
              const cover = optimizeImageUrl(product.color_images?.[0]?.image_url || product.image_url);
              const isSaved = isItemSaved(product.id);
              const status = getStockStatus(product);
              const colors = getAvailableColors(product).slice(0, 4);
              const rating = product.review_summary?.average_rating || product.rating;

              return (
                <article
                  key={product.id}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-chumbo-800/90 bg-chumbo-900/50 hover:border-chumbo-700 transition-all duration-300 hover:shadow-xl hover:shadow-black/40"
                >
                  {/* Imagem do Produto com Ações Rápidas */}
                  <div
                    className="relative aspect-square w-full cursor-pointer overflow-hidden bg-chumbo-950"
                    onClick={() => {
                      setDetailProduct(product);
                      setActiveImageIndex(0);
                    }}
                  >
                    <img
                      src={cover}
                      alt={product.title}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-chumbo-950/80 via-transparent to-transparent opacity-60" />

                    {/* Badge de Disponibilidade */}
                    <div className="absolute left-2.5 top-2.5">
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${status.tone}`}>
                        {status.label}
                      </span>
                    </div>

                    {/* Botão de Salvar para Depois */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSaveItem(product);
                      }}
                      className={`absolute top-2.5 right-2.5 p-2 rounded-xl backdrop-blur-md transition-all shadow-md ${
                        isSaved
                          ? 'bg-rose-500 text-white scale-105'
                          : 'bg-chumbo-950/70 text-slate-300 hover:text-white hover:bg-chumbo-900'
                      }`}
                      title={isSaved ? 'Item salvo! Clique para remover' : 'Salvar para decidir depois'}
                    >
                      <Heart className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
                    </button>

                    {/* Botão de Zoom/Detalhes Rápido */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDetailProduct(product);
                        setActiveImageIndex(0);
                      }}
                      className="absolute bottom-2.5 right-2.5 p-2 rounded-xl bg-chumbo-950/80 text-slate-300 hover:text-white border border-chumbo-700/80 opacity-0 group-hover:opacity-100 transition-all duration-200"
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
                          onClick={() => {
                            setDetailProduct(product);
                            setActiveImageIndex(0);
                          }}
                          className="text-xs sm:text-sm font-bold text-white group-hover:text-cyan-300 transition-colors line-clamp-2 cursor-pointer leading-tight"
                        >
                          {product.title}
                        </h4>
                        {rating && rating > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-300 shrink-0">
                            <Star className="w-3 h-3 fill-amber-300" />
                            {rating.toFixed(1)}
                          </span>
                        )}
                      </div>

                      {product.material && (
                        <p className="text-[11px] font-mono text-slate-400">
                          {product.material}
                          {product.dimensions ? ` • ${product.dimensions}` : ''}
                        </p>
                      )}

                      {/* Swatches de Cores */}
                      {colors.length > 0 && (
                        <div className="flex items-center gap-1 pt-1">
                          {colors.map((c) => {
                            const visual = getColorVisual(c);
                            return (
                              <span
                                key={c}
                                title={c}
                                className="h-3 w-3 rounded-full border border-chumbo-900 ring-1 ring-chumbo-700"
                                style={{ backgroundColor: visual.hex }}
                              />
                            );
                          })}
                          {colors.length > 1 && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              +{colors.length} cores
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Preço e Botão de Ação */}
                    <div className="pt-2 border-t border-chumbo-800/80 flex items-center justify-between gap-2">
                      <div>
                        <span className="text-[9px] uppercase font-mono tracking-wider text-slate-400 block">
                          Preço
                        </span>
                        <span className="text-sm sm:text-base font-extrabold text-white">
                          {money(product.price)}
                        </span>
                      </div>

                      <button
                        onClick={() => goToStore(product.slug || product.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-200 text-chumbo-950 text-xs font-bold transition-all shadow-sm active:scale-95"
                        title="Ir para a loja comprar"
                      >
                        <span>Comprar</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          /* Lista Compacta */
          <div className="space-y-2">
            {filteredProducts.map((product) => {
              const cover = optimizeImageUrl(product.color_images?.[0]?.image_url || product.image_url);
              const isSaved = isItemSaved(product.id);
              const status = getStockStatus(product);

              return (
                <div
                  key={product.id}
                  onClick={() => {
                    setDetailProduct(product);
                    setActiveImageIndex(0);
                  }}
                  className="group flex items-center justify-between gap-3 p-3 rounded-2xl border border-chumbo-800 bg-chumbo-900/40 hover:bg-chumbo-900/80 hover:border-chumbo-700 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={cover}
                      alt={product.title}
                      loading="lazy"
                      className="h-14 w-14 sm:h-16 sm:w-16 rounded-xl object-cover bg-chumbo-950 border border-chumbo-800 shrink-0"
                    />
                    <div className="min-w-0">
                      <h4 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-cyan-300">
                        {product.title}
                      </h4>
                      <p className="text-[11px] text-slate-400 truncate">
                        {product.material || 'Impressão 3D'}
                        {product.category?.name ? ` • ${product.category.name}` : ''}
                      </p>
                      <span className={`inline-block mt-1 px-2 py-0.2 rounded-md text-[9px] font-bold border ${status.tone}`}>
                        {status.label}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm sm:text-base font-extrabold text-white">
                      {money(product.price)}
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSaveItem(product);
                      }}
                      className={`p-2 rounded-xl transition-all ${
                        isSaved ? 'bg-rose-500 text-white' : 'bg-chumbo-800 text-slate-300 hover:text-white'
                      }`}
                      title={isSaved ? 'Salvo' : 'Salvar para depois'}
                    >
                      <Heart className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        goToStore(product.slug || product.id);
                      }}
                      className="p-2 rounded-xl bg-white text-chumbo-950 hover:bg-slate-200 transition-all font-bold text-xs"
                      title="Comprar na Loja"
                    >
                      <ShoppingBag className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Modal de Detalhe Rápido do Produto - Totalmente responsivo (colunas em tablet/desktop, scroll elegante em mobile) */}
      {detailProduct && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 md:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setDetailProduct(null)}
        >
          <div
            className="relative w-full max-w-lg md:max-w-4xl lg:max-w-5xl overflow-hidden rounded-2xl sm:rounded-3xl border border-chumbo-700 bg-chumbo-950 p-4 sm:p-6 md:p-8 shadow-2xl max-h-[92vh] md:max-h-[88vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Fechar */}
            <button
              onClick={() => setDetailProduct(null)}
              className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 p-2 rounded-xl bg-chumbo-900/90 text-slate-400 hover:text-white hover:bg-chumbo-800 transition-all border border-chumbo-700/60"
              aria-label="Fechar detalhes"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            <div className="md:grid md:grid-cols-2 md:gap-8 md:items-start space-y-4 md:space-y-0">
              {/* Coluna Esquerda: Galeria de Fotos */}
              <div className="space-y-3">
                <div className="relative aspect-square sm:aspect-[4/3] md:aspect-square w-full overflow-hidden rounded-2xl bg-chumbo-900 border border-chumbo-800">
                  {(() => {
                    const allImages = [
                      detailProduct.image_url,
                      ...(detailProduct.color_images?.map((ci) => ci.image_url) || []),
                    ].filter(Boolean);
                    const currentImage = allImages[activeImageIndex] || detailProduct.image_url;

                    return (
                      <img
                        src={optimizeImageUrl(currentImage)}
                        alt={detailProduct.title}
                        className="w-full h-full object-contain p-2 sm:p-4"
                      />
                    );
                  })()}
                </div>

                {/* Miniaturas de Cores/Ângulos */}
                {(() => {
                  const allImages = [
                    detailProduct.image_url,
                    ...(detailProduct.color_images?.map((ci) => ci.image_url) || []),
                  ].filter(Boolean);

                  if (allImages.length <= 1) return null;

                  return (
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                      {allImages.map((img, idx) => (
                        <button
                          key={idx}
                          onClick={() => setActiveImageIndex(idx)}
                          className={`relative h-12 w-12 sm:h-14 sm:w-14 rounded-xl overflow-hidden border shrink-0 transition-all ${
                            activeImageIndex === idx
                              ? 'border-cyan-400 ring-2 ring-cyan-400/40'
                              : 'border-chumbo-800 opacity-60 hover:opacity-100'
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
              <div className="space-y-4 flex flex-col justify-between">
                <div className="space-y-3.5">
                  <div className="flex items-start justify-between gap-3 pr-8 md:pr-0">
                    <div>
                      <h3 className="text-lg sm:text-2xl font-extrabold text-white leading-tight">
                        {detailProduct.title}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        {detailProduct.category?.name || 'Impressão 3D'} • Ref: {detailProduct.sku || `#${detailProduct.id}`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[10px] text-slate-400 block font-mono uppercase">Valor</span>
                      <span className="text-xl sm:text-2xl font-black text-cyan-400">{money(detailProduct.price)}</span>
                    </div>
                  </div>

                  {/* Especificações da Peça 3D */}
                  <div className="grid grid-cols-3 gap-2 p-2.5 sm:p-3 rounded-xl bg-chumbo-900/70 border border-chumbo-800 text-xs">
                    <div>
                      <span className="text-[9px] sm:text-[10px] text-slate-400 block uppercase font-mono">Material</span>
                      <span className="font-semibold text-slate-200 truncate block">{detailProduct.material || 'PLA'}</span>
                    </div>
                    <div>
                      <span className="text-[9px] sm:text-[10px] text-slate-400 block uppercase font-mono">Dimensões</span>
                      <span className="font-semibold text-slate-200 truncate block">{detailProduct.dimensions || 'Sob medida'}</span>
                    </div>
                    <div>
                      <span className="text-[9px] sm:text-[10px] text-slate-400 block uppercase font-mono">Status</span>
                      <span className="font-semibold text-emerald-400 truncate block">{getStockStatus(detailProduct).label}</span>
                    </div>
                  </div>

                  {detailProduct.description && (
                    <div className="space-y-1">
                      <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Detalhes da Peça</h5>
                      <p className="text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-line max-h-48 overflow-y-auto pr-1">
                        {detailProduct.description}
                      </p>
                    </div>
                  )}
                </div>

                {/* Ações no Modal (Adaptável para mobile e desktop) */}
                <div className="pt-3 border-t border-chumbo-800 grid grid-cols-1 min-[420px]:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => toggleSaveItem(detailProduct)}
                    className={`flex items-center justify-center gap-1.5 py-2.5 sm:py-3 px-3 rounded-xl text-xs font-bold transition-all border active:scale-95 ${
                      isItemSaved(detailProduct.id)
                        ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                        : 'bg-chumbo-900 border-chumbo-700 text-slate-300 hover:text-white'
                    }`}
                  >
                    <Heart className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isItemSaved(detailProduct.id) ? 'fill-rose-500 text-rose-500' : ''}`} />
                    <span className="truncate">{isItemSaved(detailProduct.id) ? 'Salvo' : 'Salvar'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const storeName = tenantSettings?.store_name || activeTenant?.name || 'sua loja';
                      const msg = `Olá! Vi o produto *${detailProduct.title}* (${money(detailProduct.price)}) no catálogo da *${storeName}* e gostaria de mais informações!`;
                      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
                    }}
                    className="flex items-center justify-center gap-1.5 py-2.5 sm:py-3 px-3 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md active:scale-95"
                  >
                    <MessageCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="truncate">WhatsApp</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => goToStore(detailProduct.slug || detailProduct.id)}
                    className="flex items-center justify-center gap-1.5 py-2.5 sm:py-3 px-3 rounded-xl text-xs font-bold bg-white hover:bg-slate-200 text-chumbo-950 transition-all shadow-md active:scale-95"
                  >
                    <ShoppingBag className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="truncate">Comprar</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Drawer: Salvos para Depois (Wishlist / Caderno de Escolhas) - Responsivo para qualquer altura de tela */}
      {isSavedDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full sm:max-w-md h-full bg-chumbo-950 border-l border-chumbo-800 p-4 sm:p-6 flex flex-col justify-between shadow-2xl animate-in slide-in-from-right duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header do Drawer */}
            <div className="space-y-3 sm:space-y-4 flex flex-col flex-1 min-h-0">
              <div className="flex items-center justify-between border-b border-chumbo-800 pb-3 sm:pb-4 shrink-0">
                <div className="flex items-center gap-2">
                  <Heart className="w-5 h-5 text-rose-500 fill-rose-500" />
                  <div>
                    <h3 className="text-base font-bold text-white">Minhas Escolhas</h3>
                    <p className="text-xs text-slate-400">
                      {savedItems.length} {savedItems.length === 1 ? 'item salvo' : 'itens salvos'} para decidir depois
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsSavedDrawerOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-chumbo-900"
                  aria-label="Fechar gaveta"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Lista dos Itens Salvos (Ocupa o espaço livre dinamicamente) */}
              <div className="space-y-2 overflow-y-auto flex-1 pr-1">
                {savedItems.length === 0 ? (
                  <div className="py-12 text-center space-y-2 text-slate-400">
                    <Heart className="w-10 h-10 text-slate-600 mx-auto" />
                    <p className="text-sm font-medium">Nenhum item salvo ainda.</p>
                    <p className="text-xs text-slate-400 max-w-xs mx-auto">
                      Clique no coração de qualquer peça do catálogo para salvar e decidir com calma depois!
                    </p>
                  </div>
                ) : (
                  savedItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-2.5 p-2.5 sm:p-3 rounded-xl border border-chumbo-800 bg-chumbo-900/60"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={item.image}
                          alt={item.title}
                          className="h-11 w-11 sm:h-12 sm:w-12 rounded-lg object-cover bg-chumbo-950 shrink-0 border border-chumbo-800"
                        />
                        <div className="min-w-0">
                          <h5 className="text-xs font-bold text-white truncate">{item.title}</h5>
                          <p className="text-xs font-extrabold text-cyan-400">{money(item.price)}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => goToStore(item.slug || item.id)}
                          className="p-1.5 rounded-lg bg-chumbo-800 text-slate-300 hover:text-white"
                          title="Ver na loja"
                          aria-label="Ver na loja"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setSavedItems((prev) => prev.filter((i) => i.id !== item.id))}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400"
                          title="Remover"
                          aria-label="Remover item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Rodapé com Resumo e Ações */}
            {savedItems.length > 0 && (
              <div className="pt-3 sm:pt-4 border-t border-chumbo-800 space-y-2.5 sm:space-y-3 shrink-0">
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-slate-400">Total Estimado ({savedItems.length}):</span>
                  <span className="text-base sm:text-lg font-black text-cyan-400">
                    {money(savedItems.reduce((acc, item) => acc + item.price, 0))}
                  </span>
                </div>

                <div className="space-y-2">
                  <button
                    onClick={handleShareWishlistWhatsApp}
                    className="w-full flex items-center justify-center gap-2 py-2.5 sm:py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-950/40 transition-all active:scale-98"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Enviar Lista para o WhatsApp</span>
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handleCopyWishlistText}
                      className="flex items-center justify-center gap-1.5 py-2 sm:py-2.5 rounded-xl border border-chumbo-700 bg-chumbo-900 text-slate-300 hover:text-white text-xs font-semibold active:scale-95"
                    >
                      {copiedWishlist ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span className="truncate">{copiedWishlist ? 'Copiada!' : 'Copiar Lista'}</span>
                    </button>

                    <button
                      onClick={() => goToStore()}
                      className="flex items-center justify-center gap-1.5 py-2 sm:py-2.5 rounded-xl bg-white text-chumbo-950 hover:bg-slate-200 text-xs font-bold active:scale-95"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span>Ir para a Loja</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating Wishlist Pill (se houver itens salvos e a gaveta estiver fechada) */}
      {savedItems.length > 0 && !isSavedDrawerOpen && (
        <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 animate-in bounce-in duration-300">
          <button
            onClick={() => setIsSavedDrawerOpen(true)}
            className="flex items-center gap-2 sm:gap-3 px-3 py-2 sm:px-4 sm:py-3 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs shadow-2xl shadow-rose-950/60 transition-all hover:scale-105 active:scale-95"
            aria-label="Abrir itens salvos"
          >
            <Heart className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-white shrink-0" />
            <span className="text-[11px] sm:text-xs">Salvos ({savedItems.length})</span>
            <span className="bg-white/20 px-1.5 py-0.5 rounded-md text-[10px] sm:text-[11px] font-extrabold hidden min-[400px]:inline">
              {money(savedItems.reduce((acc, item) => acc + item.price, 0))}
            </span>
          </button>
        </div>
      )}

      {/* Footer simples do Catálogo */}
      <footer className="mt-16 border-t border-chumbo-800/80 bg-chumbo-950 py-8 text-center text-xs text-slate-400 space-y-2">
        <p className="font-medium text-slate-300">
          {storeName} • Catálogo Digital de Impressão 3D
        </p>
        <p>
          Tem um modelo personalizado ou arquivo STL próprio? Converse conosco para um orçamento sob medida.
        </p>
        <div className="pt-2">
          <button
            onClick={() => goToStore()}
            className="text-cyan-400 hover:text-cyan-300 font-semibold underline underline-offset-4"
          >
            Acessar loja oficial com carrinho e checkout
          </button>
        </div>
      </footer>
    </div>
  );
};
export default CatalogApp;
