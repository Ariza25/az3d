import { getAppPathname, stripBasePath, withBasePath } from './basePath';

export const getTenantSlugFromPath = (pathname = getAppPathname()) => {
  const [, first, second] = stripBasePath(pathname).split('/');
  if (first === 'loja' && second) return decodeURIComponent(second);
  if (first && second === 'store') return decodeURIComponent(first);
  return '';
};

export const getStorePath = (tenantSlug: string, style: 'loja' | 'store' = 'store') => {
  const slug = encodeURIComponent(tenantSlug);
  return withBasePath(style === 'loja' ? `/loja/${slug}` : `/${slug}/store`);
};

export const getProductPath = (tenantSlug: string, productSlug: string | number, style: 'loja' | 'store' = 'store') => {
  const base = getStorePath(tenantSlug, style);
  return `${base}/produto/${encodeURIComponent(String(productSlug))}`;
};

export const getCurrentStoreRouteStyle = (pathname = getAppPathname()): 'loja' | 'store' => (
  stripBasePath(pathname).startsWith('/loja/') ? 'loja' : 'store'
);

export const isStoreTenantPath = (pathname = getAppPathname()) => Boolean(getTenantSlugFromPath(pathname));
