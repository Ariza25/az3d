import { useEffect, useState } from 'react';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { AdminApp } from './apps/admin/AdminApp';
import { StoreApp } from './apps/store/StoreApp';

const getCurrentApp = () => (window.location.pathname.startsWith('/admin') ? 'admin' : 'store');

export function App() {
  const [currentApp, setCurrentApp] = useState<'admin' | 'store'>(getCurrentApp);

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
