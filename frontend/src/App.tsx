import { useEffect, useState } from 'react';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { AdminApp } from './apps/admin/AdminApp';
import { StoreApp } from './apps/store/StoreApp';
import { ADMIN_TOKEN_KEY, CUSTOMER_TOKEN_KEY } from './services/api';
import { getAppPathname, withBasePath } from './shared/basePath';

const getCurrentApp = () => (getAppPathname().startsWith('/admin') ? 'admin' : 'store');

const consumeGoogleCallback = () => {
  if (!getAppPathname().startsWith('/auth/google/callback')) return;

  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const token = params.get('token');
  const error = params.get('error');
  const scope = params.get('scope') || 'customer';
  const returnTo = params.get('return_to') || (scope === 'admin' || scope === 'seller' ? '/admin' : '/');

  if (token) {
    localStorage.setItem(scope === 'admin' || scope === 'seller' ? ADMIN_TOKEN_KEY : CUSTOMER_TOKEN_KEY, token);
  } else if (error) {
    sessionStorage.setItem('az3d_auth_error', error);
  }

  window.history.replaceState({}, '', withBasePath(returnTo));
};

export function App() {
  const [currentApp, setCurrentApp] = useState<'admin' | 'store'>(() => {
    consumeGoogleCallback();
    return getCurrentApp();
  });

  useEffect(() => {
    const syncRoute = () => setCurrentApp(getCurrentApp());
    window.addEventListener('popstate', syncRoute);
    return () => window.removeEventListener('popstate', syncRoute);
  }, []);

  return currentApp === 'admin' ? (
    <AuthProvider scope="admin">
      <AdminApp />
    </AuthProvider>
  ) : (
    <AuthProvider scope="customer">
      <CartProvider>
        <StoreApp />
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
