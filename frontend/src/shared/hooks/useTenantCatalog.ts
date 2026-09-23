import { useCallback, useEffect, useState } from 'react';
import { Category, Product, Tenant } from '../../types';
import { api } from '../../services/api';
import { getCatalogPath, getStorePath, getTenantSlugFromPath, isCatalogPath, isStoreTenantPath } from '../tenantRoutes';
import { getAppPathname } from '../basePath';

interface UseTenantCatalogOptions {
  lockedTenantId?: number;
}

const getHostTenantIdentifier = () => {
  const hostname = window.location.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return '';
  return hostname;
};

const FALLBACK_TENANT: Tenant = {
  id: 1,
  name: 'AZ3D Studio',
  slug: 'az3d-studio',
};

const FALLBACK_PRODUCTS: Product[] = [
  {
    id: 1,
    title: 'Vasinho Cafezinho Impressão 3d Decorativo',
    slug: 'vasinho-cafezinho-impressao-3d-decorativo',
    price: 35.90,
    description: 'Vasinho decorativo em formato de cafezinho para plantas e suculentas.\nDimensões: 8 x 8 x 10 cm',
    dimensions: '8 x 8 x 10 cm',
    category_id: 1,
    material: 'PLA Premium',
    layer_height: '0.20mm',
    print_time: '2h 15m',
    weight: '65g',
    in_stock: true,
    stock_qty: 15,
    status: 'active',
    image_url: 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?auto=format&fit=crop&w=600&q=80',
    rating: 5.0,
    review_count: 14,
  },
  {
    id: 2,
    title: 'Kit 3 Vasinhos Fofos Decorativos De Impressão 3D',
    slug: 'kit-3-vasinhos-fofos-decorativos-de-impressao-3d',
    price: 95.90,
    description: 'Trio de vasinhos minimalistas com rostinhos felizes.\nDimensões: 12 x 10 x 8 cm cada',
    dimensions: '12 x 10 x 8 cm',
    category_id: 1,
    material: 'PLA Silk',
    layer_height: '0.16mm',
    print_time: '6h 40m',
    weight: '180g',
    in_stock: true,
    stock_qty: 8,
    status: 'active',
    image_url: 'https://images.unsplash.com/photo-1512428559087-560fa5ceab42?auto=format&fit=crop&w=600&q=80',
    rating: 4.9,
    review_count: 28,
  },
  {
    id: 3,
    title: 'Vasinho Leitor Com Caneca Vaso Decorativo',
    slug: 'vasinho-leitor-com-caneca-vaso-decorativo',
    price: 35.90,
    description: 'Vasinho articulado leitor com livro e caneca na mão.\nDimensões: 9 x 7 x 11 cm',
    dimensions: '9 x 7 x 11 cm',
    category_id: 1,
    material: 'PLA Premium',
    layer_height: '0.20mm',
    print_time: '2h 45m',
    weight: '70g',
    in_stock: true,
    stock_qty: 12,
    status: 'active',
    image_url: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=600&q=80',
    rating: 5.0,
    review_count: 19,
  },
  {
    id: 4,
    title: 'Porta-terço Nossa Senhora Ore E Confia',
    slug: 'porta-terco-nossa-senhora-ore-e-confia',
    price: 44.90,
    description: 'Bandeja oval com imagem escultural de Nossa Senhora e gravação "Ore e confia".\nDimensões: 18 x 10 x 12 cm',
    dimensions: '18 x 10 x 12 cm',
    category_id: 1,
    material: 'Resina / PLA Silk',
    layer_height: '0.12mm',
    print_time: '4h 10m',
    weight: '110g',
    in_stock: true,
    stock_qty: 10,
    status: 'active',
    image_url: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=600&q=80',
    rating: 4.8,
    review_count: 9,
  },
];

export const useTenantCatalog = (options: UseTenantCatalogOptions = {}) => {
  const { lockedTenantId } = options;
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [activeTenant, setActiveTenant] = useState<Tenant | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('todas');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchTenants = async () => {
      try {
        const list = await api.getTenants();
        const visibleTenants = lockedTenantId
          ? list.filter((tenant) => tenant.id === lockedTenantId)
          : list;
        setTenants(visibleTenants);
        if (visibleTenants.length > 0) {
          const pathSlug = getTenantSlugFromPath();
          const hostIdentifier = getHostTenantIdentifier();
          const storedId = localStorage.getItem('az3d_tenant_id');
          const fromPath = pathSlug
            ? visibleTenants.find((tenant) => tenant.slug === pathSlug || String(tenant.id) === pathSlug)
            : undefined;
          const fromHost = hostIdentifier
            ? visibleTenants.find((tenant) => tenant.domain?.toLowerCase() === hostIdentifier || tenant.slug === hostIdentifier.split('.')[0])
            : undefined;
          const found = visibleTenants.find((tenant) => String(tenant.id) === storedId);
          const initial = lockedTenantId
            ? visibleTenants[0]
            : fromPath || fromHost || found || visibleTenants[0];
          setActiveTenant(initial);
          localStorage.setItem('az3d_tenant_id', String(initial.id));
          window.dispatchEvent(new CustomEvent('az3d:tenant-changed', { detail: { tenantId: initial.id } }));
          if (!lockedTenantId && !isStoreTenantPath() && !isCatalogPath() && getAppPathname() === '/') {
            window.history.replaceState({}, '', getStorePath(initial.slug));
          }
        } else {
          setActiveTenant(FALLBACK_TENANT);
        }
      } catch (err) {
        console.error('Erro ao carregar lista de tenants:', err);
        const pathSlug = getTenantSlugFromPath() || 'az3d-studio';
        const fallback = { ...FALLBACK_TENANT, slug: pathSlug };
        setActiveTenant(fallback);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTenants();
  }, [lockedTenantId]);

  const handleSelectTenant = useCallback((tenant: Tenant) => {
    if (lockedTenantId && tenant.id !== lockedTenantId) return;
    setActiveTenant(tenant);
    localStorage.setItem('az3d_tenant_id', String(tenant.id));
    window.dispatchEvent(new CustomEvent('az3d:tenant-changed', { detail: { tenantId: tenant.id } }));
    setActiveCategory('todas');
    if (isCatalogPath()) {
      window.history.pushState({}, '', getCatalogPath(tenant.slug));
    } else if (isStoreTenantPath() || getAppPathname() === '/') {
      window.history.pushState({}, '', getStorePath(tenant.slug));
    }
  }, [lockedTenantId]);

  const fetchCategories = useCallback(async () => {
    if (!activeTenant) return;

    try {
      const data = await api.getCategories(activeTenant.id);
      setCategories(data);
    } catch (err) {
      console.error('Erro ao carregar categorias:', err);
    }
  }, [activeTenant]);

  useEffect(() => {
    void fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    const handleCategoriesChanged = (e: Event) => {
      const custom = e as CustomEvent<{ tenantId?: number }>;
      if (!custom.detail?.tenantId || custom.detail.tenantId === activeTenant?.id) {
        void fetchCategories();
      }
    };
    window.addEventListener('az3d:categories-changed', handleCategoriesChanged);
    return () => {
      window.removeEventListener('az3d:categories-changed', handleCategoriesChanged);
    };
  }, [fetchCategories, activeTenant?.id]);

  const fetchProducts = useCallback(async () => {
    if (!activeTenant) return;

    setIsLoading(true);
    try {
      // Search is applied after marketplace sibling grouping in StoreApp so a
      // match never drops the other colors from the same product family.
      const data = await api.getProducts(activeCategory, undefined, activeTenant.id);
      const items = Array.isArray(data) ? data : (data?.items || []);
      if (items && items.length > 0) {
        setProducts(items);
      } else {
        setProducts(FALLBACK_PRODUCTS);
      }
    } catch (err) {
      console.error('Erro ao carregar produtos:', err);
      setProducts(FALLBACK_PRODUCTS);
    } finally {
      setIsLoading(false);
    }
  }, [activeTenant, activeCategory]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchProducts();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [fetchProducts]);

  const refreshCatalog = useCallback(async () => {
    await Promise.all([fetchCategories(), fetchProducts()]);
  }, [fetchCategories, fetchProducts]);

  return {
    tenants,
    activeTenant,
    categories,
    products,
    activeCategory,
    setActiveCategory,
    searchQuery,
    setSearchQuery,
    isLoading,
    onSelectTenant: handleSelectTenant,
    refreshProducts: fetchProducts,
    refreshCategories: fetchCategories,
    refreshCatalog,
  };
};
