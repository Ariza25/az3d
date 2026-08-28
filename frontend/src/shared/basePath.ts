const rawBasePath = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');

export const APP_BASE_PATH = rawBasePath === '' || rawBasePath === '/'
  ? ''
  : rawBasePath.startsWith('/')
    ? rawBasePath
    : `/${rawBasePath}`;

export const stripBasePath = (pathname: string) => {
  if (!APP_BASE_PATH) return pathname || '/';
  if (pathname === APP_BASE_PATH) return '/';
  if (pathname.startsWith(`${APP_BASE_PATH}/`)) {
    return pathname.slice(APP_BASE_PATH.length) || '/';
  }
  return pathname || '/';
};

export const withBasePath = (path: string) => {
  if (/^[a-z][a-z\d+.-]*:/i.test(path) || path.startsWith('//')) return path;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${APP_BASE_PATH}${normalizedPath}` || '/';
};

export const getAppPathname = () => stripBasePath(window.location.pathname);

export const getAppReturnTo = () => `${getAppPathname()}${window.location.search}`;
