import React, { createContext, useContext, useState, useEffect } from 'react';
import { Product, CartItem } from '../types';
import { useAuth } from './AuthContext';

interface CartContextType {
  cart: CartItem[];
  addToCart: (product: Product, quantity?: number, color?: string) => boolean;
  removeFromCart: (productId: number, color: string) => void;
  updateQuantity: (productId: number, color: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  openCart: () => void;
  openOrders: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const cartKeyForTenant = (tenantId: string | number | null | undefined) => `az3d_cart_tenant_${tenantId || localStorage.getItem('az3d_tenant_id') || '1'}`;
const LEGACY_CART_KEY = 'az3d_cart';
const PENDING_CART_KEY = 'az3d_pending_cart_item';

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const [cart, setCart] = useState<CartItem[]>(() => {
    const tenantKey = cartKeyForTenant(localStorage.getItem('az3d_tenant_id'));
    const saved = localStorage.getItem(tenantKey) || localStorage.getItem(LEGACY_CART_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  const [activeTenantId, setActiveTenantId] = useState(() => localStorage.getItem('az3d_tenant_id') || '1');
  const [pendingItem, setPendingItem] = useState<CartItem | null>(() => {
    const saved = sessionStorage.getItem(PENDING_CART_KEY);
    return saved ? JSON.parse(saved) : null;
  });

  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);

  useEffect(() => {
    localStorage.setItem(cartKeyForTenant(activeTenantId), JSON.stringify(cart));
  }, [activeTenantId, cart]);

  useEffect(() => {
    const handleTenantChange = (event: Event) => {
      const detail = (event as CustomEvent<{ tenantId?: number }>).detail;
      const nextTenantId = String(detail?.tenantId || localStorage.getItem('az3d_tenant_id') || '1');
      setActiveTenantId(nextTenantId);
      const saved = localStorage.getItem(cartKeyForTenant(nextTenantId));
      setCart(saved ? JSON.parse(saved) : []);
      setIsCartOpen(false);
    };
    window.addEventListener('az3d:tenant-changed', handleTenantChange);
    return () => window.removeEventListener('az3d:tenant-changed', handleTenantChange);
  }, []);

  const appendToCart = (product: Product, quantity = 1, color = 'Preto Slate') => {
    setCart((prev) => {
      const existingIndex = prev.findIndex(
        (item) => item.product.id === product.id && item.color === color
      );

      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex].quantity += quantity;
        return updated;
      }

      return [...prev, { product, quantity, color }];
    });
    window.dispatchEvent(new CustomEvent('az3d:cart-added', { detail: { product, quantity, color } }));
  };

  useEffect(() => {
    if (!pendingItem || !isAuthenticated || user?.role !== 'customer') return;
    appendToCart(pendingItem.product, pendingItem.quantity, pendingItem.color);
    setPendingItem(null);
    sessionStorage.removeItem(PENDING_CART_KEY);
  }, [isAuthenticated, pendingItem, user?.role]);

  const addToCart = (product: Product, quantity = 1, color = 'Preto Slate') => {
    if (!isAuthenticated || user?.role !== 'customer') {
      const nextPending = { product, quantity, color };
      setPendingItem(nextPending);
      sessionStorage.setItem(PENDING_CART_KEY, JSON.stringify(nextPending));
      window.dispatchEvent(new CustomEvent('az3d:require-login', { detail: { reason: 'cart', product } }));
      return false;
    }

    appendToCart(product, quantity, color);
    return true;
  };

  const removeFromCart = (productId: number, color: string) => {
    setCart((prev) => prev.filter((item) => !(item.product.id === productId && item.color === color)));
  };

  const updateQuantity = (productId: number, color: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId, color);
      return;
    }
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId && item.color === color
          ? { ...item, quantity }
          : item
      )
    );
  };

  const clearCart = () => {
    setCart([]);
  };

  const openCart = () => {
    window.dispatchEvent(new CustomEvent('az3d:open-cart'));
    setIsCartOpen(true);
  };

  const openOrders = () => {
    window.dispatchEvent(new CustomEvent('az3d:open-orders'));
    setIsCartOpen(true);
  };

  const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);
  const totalPrice = cart.reduce((acc, item) => acc + item.product.price * item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        totalItems,
        totalPrice,
        isCartOpen,
        setIsCartOpen,
        openCart,
        openOrders,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart deve ser usado dentro de um CartProvider');
  }
  return context;
};
