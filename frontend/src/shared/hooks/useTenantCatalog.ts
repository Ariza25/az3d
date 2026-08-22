import { useCallback, useEffect, useState } from 'react';
import { Category, Product, Tenant } from '../../types';
import { api } from '../../services/api';

interface UseTenantCatalogOptions {
  lockedTenantId?: number;
}

const getTenantSlugFromLocation = () => {
  const [, first, second] = window.location.pathname.split('/');
  if (first === 'loja' && second) return decodeURIComponent(second);
  return '';
};

const getHostTenantIdentifier = () => {
  const hostname = window.location.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return '';
  return hostname;
};

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
          const pathSlug = getTenantSlugFromLocation();
          const hostIdentifier = getHostTenantIdentifier();
          const storedId = localStorage.getItem('az3d_tenant_id');
          const fromPath = pathSlug
            ? visibleTenants.find((tenant) => tenant.slug === pathSlug)
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
        }
      } catch (err) {
        console.error('Erro ao carregar lista de tenants:', err);
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
    if (window.location.pathname.startsWith('/loja/')) {
      window.history.pushState({}, '', `/loja/${tenant.slug}`);
    }
  }, [lockedTenantId]);

  useEffect(() => {
    if (!activeTenant) return;

    const fetchCategories = async () => {
      try {
        const data = await api.getCategories(activeTenant.id);
        setCategories(data);
      } catch (err) {
        console.error('Erro ao carregar categorias:', err);
      }
    };

    fetchCategories();
  }, [activeTenant]);

  const fetchProducts = useCallback(async () => {
    if (!activeTenant) return;

    setIsLoading(true);
    try {
      const data = await api.getProducts(activeCategory, searchQuery, activeTenant.id);
      setProducts(data);
    } catch (err) {
      console.error('Erro ao carregar produtos:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeTenant, activeCategory, searchQuery]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchProducts();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [fetchProducts]);

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
  };
};
