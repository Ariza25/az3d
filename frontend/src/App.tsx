import { useEffect, useState } from 'react';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { LoadingProvider } from './context/LoadingContext';
import { ThemeProvider } from './context/ThemeContext';
import { AdminApp } from './apps/admin/AdminApp';
import { StoreApp } from './apps/store/StoreApp';
import { LoginPage } from './apps/auth/LoginPage';
import { ADMIN_TOKEN_KEY, CUSTOMER_TOKEN_KEY } from './services/api';
import { getAppPathname, withBasePath } from './shared/basePath';
import { isStoreTenantPath } from './shared/tenantRoutes';

type AppMode = 'admin' | 'store' | 'auth';

const resolveAppRoute = (): AppMode => {
  const pathname = getAppPathname();

  if (pathname.startsWith('/admin')) {
    return 'admin';
  }

  if (pathname === '/login' || pathname.startsWith('/recuperar-senha') || pathname.startsWith('/reset-password')) {
    return 'auth';
  }

  // Raiz '/' ou caminho sem tenant específico
  if (!isStoreTenantPath(pathname)) {
    const hasCustomerToken = Boolean(localStorage.getItem(CUSTOMER_TOKEN_KEY));
    const hasAdminToken = Boolean(localStorage.getItem(ADMIN_TOKEN_KEY));

    if (hasAdminToken) {
      window.history.replaceState({}, '', withBasePath('/admin'));
      return 'admin';
    }

    if (hasCustomerToken) {
      window.history.replaceState({}, '', withBasePath('/az3d-studio/store'));
      return 'store';
    }

    // Visitante não autenticado na raiz: redireciona para /login
    window.history.replaceState({}, '', withBasePath('/login'));
    return 'auth';
  }

  return 'store';
};

const consumeGoogleCallback = () => {
  if (!getAppPathname().startsWith('/auth/google/callback')) return;

  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const token = params.get('token');
  const error = params.get('error');
  const scope = params.get('scope') || 'customer';
  const returnTo = params.get('return_to') || (scope === 'admin' || scope === 'seller' ? '/admin' : '/az3d-studio/store');

  if (token) {
    localStorage.setItem(scope === 'admin' || scope === 'seller' ? ADMIN_TOKEN_KEY : CUSTOMER_TOKEN_KEY, token);
  } else if (error) {
    sessionStorage.setItem('az3d_auth_error', error);
  }

  window.history.replaceState({}, '', withBasePath(returnTo));
};

export function App() {
  const [currentApp, setCurrentApp] = useState<AppMode>(() => {
    consumeGoogleCallback();
    return resolveAppRoute();
  });

  useEffect(() => {
    const syncRoute = () => setCurrentApp(resolveAppRoute());
    window.addEventListener('popstate', syncRoute);
    return () => window.removeEventListener('popstate', syncRoute);
  }, []);

  return (
    <ThemeProvider>
      <LoadingProvider>
        {currentApp === 'admin' ? (
          <AuthProvider scope="admin">
            <AdminApp />
          </AuthProvider>
        ) : currentApp === 'auth' ? (
          <AuthProvider scope="customer">
            <LoginPage />
          </AuthProvider>
        ) : (
          <AuthProvider scope="customer">
            <CartProvider>
              <StoreApp />
            </CartProvider>
          </AuthProvider>
        )}
      </LoadingProvider>
    </ThemeProvider>
  );
}

export default App;

