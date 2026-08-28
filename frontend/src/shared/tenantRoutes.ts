export const getTenantSlugFromPath = (pathname = window.location.pathname) => {
  const [, first, second] = pathname.split('/');
  if (first === 'loja' && second) return decodeURIComponent(second);
  if (first && second === 'store') return decodeURIComponent(first);
  return '';
};

export const getStorePath = (tenantSlug: string, style: 'loja' | 'store' = 'store') => {
  const slug = encodeURIComponent(tenantSlug);
  return style === 'loja' ? `/loja/${slug}` : `/${slug}/store`;
};

export const getProductPath = (tenantSlug: string, productSlug: string | number, style: 'loja' | 'store' = 'store') => {
  const base = getStorePath(tenantSlug, style);
  return `${base}/produto/${encodeURIComponent(String(productSlug))}`;
};

export const getCurrentStoreRouteStyle = (pathname = window.location.pathname): 'loja' | 'store' => (
  pathname.startsWith('/loja/') ? 'loja' : 'store'
);

export const isStoreTenantPath = (pathname = window.location.pathname) => Boolean(getTenantSlugFromPath(pathname));
