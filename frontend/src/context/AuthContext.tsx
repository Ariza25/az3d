import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { User } from '../types';
import { ADMIN_TOKEN_KEY, CUSTOMER_TOKEN_KEY, api } from '../services/api';

type AuthScope = 'customer' | 'admin';

interface AuthContextType {
  scope: AuthScope;
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, tenantId?: number) => Promise<void>;
  registerSeller: (name: string, email: string, password: string, storeName: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getTokenKey = (scope: AuthScope) => (scope === 'admin' ? ADMIN_TOKEN_KEY : CUSTOMER_TOKEN_KEY);

const isRoleAllowed = (scope: AuthScope, role?: string) => {
  if (scope === 'admin') return role === 'admin' || role === 'tenant_admin';
  return role === 'customer';
};

export const AuthProvider: React.FC<{ children: React.ReactNode; scope?: AuthScope }> = ({
  children,
  scope = 'customer',
}) => {
  const tokenKey = useMemo(() => getTokenKey(scope), [scope]);
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(tokenKey));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    setToken(localStorage.getItem(tokenKey));
    setUser(null);
  }, [tokenKey]);

  useEffect(() => {
    const initAuth = async () => {
      if (!token) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const userData = await api.getMe(tokenKey);
        if (!isRoleAllowed(scope, userData.role)) {
          logout();
          return;
        }
        setUser(userData);
      } catch (error) {
        console.error('Sessao expirada:', error);
        logout();
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, [scope, token, tokenKey]);

  const login = async (email: string, password: string) => {
    const response = scope === 'admin'
      ? await api.adminLogin(email, password)
      : await api.customerLogin(email, password);

    localStorage.setItem(tokenKey, response.token);
    setToken(response.token);
    setUser(response.user);
  };

  const register = async (name: string, email: string, password: string, tenantId?: number) => {
    if (scope === 'admin') {
      throw new Error('Cadastro administrativo deve ser criado por um administrador do sistema');
    }

    const response = await api.customerRegister(name, email, password, tenantId);
    localStorage.setItem(tokenKey, response.token);
    setToken(response.token);
    setUser(response.user);
  };

  const registerSeller = async (name: string, email: string, password: string, storeName: string) => {
    const response = await api.sellerRegister(name, email, password, storeName);
    localStorage.setItem(ADMIN_TOKEN_KEY, response.token);
    localStorage.setItem('az3d_tenant_id', String(response.user.tenant_id || 1));
  };

  const logout = () => {
    localStorage.removeItem(tokenKey);
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        scope,
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        registerSeller,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};
