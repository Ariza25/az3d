import React, { useState } from 'react';
import { ShoppingBag, LogOut, Search, Layers, ChevronDown, ShieldAlert, Heart, ReceiptText } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { Tenant, TenantSettings } from '../types';

interface NavbarProps {
  onOpenLogin: () => void;
  onOpenRegister: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  activeTenant: Tenant | null;
  onOpenAdmin: () => void;
  onOpenFavorites: () => void;
  tenantSettings?: TenantSettings | null;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenLogin,
  onOpenRegister,
  searchQuery,
  setSearchQuery,
  activeTenant,
  onOpenAdmin,
  onOpenFavorites,
  tenantSettings,
}) => {
  const { user, isAuthenticated, logout } = useAuth();
  const { totalItems, openCart, openOrders } = useCart();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const storeName = tenantSettings?.store_name || activeTenant?.name || 'AZ3D';
  const logoUrl = tenantSettings?.logo_url || activeTenant?.logo_url;
  const primaryColor = tenantSettings?.primary_color || '#22d3ee';

  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-chumbo-800 bg-chumbo-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between sm:h-20">
          
          {/* Identidade da loja */}
          <div className="flex min-w-0 items-center space-x-3 sm:space-x-4">
            <div className="group flex min-w-0 cursor-pointer items-center space-x-2 sm:space-x-3">
              {logoUrl ? (
                <img src={logoUrl} alt={storeName} className="h-9 w-9 shrink-0 rounded-lg border border-chumbo-700 bg-chumbo-900 object-cover shadow-lg transition-transform duration-300 group-hover:scale-105 sm:h-10 sm:w-10" />
              ) : (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-chumbo-700 bg-chumbo-900 shadow-lg transition-transform duration-300 group-hover:scale-105 sm:h-10 sm:w-10" style={{ color: primaryColor }}>
                  <Layers className="h-5 w-5 stroke-[2.5] sm:h-6 sm:w-6" />
                </div>
              )}
              <div className="min-w-0">
                <span className="block max-w-[118px] truncate text-lg font-extrabold tracking-wide text-white sm:max-w-none sm:text-2xl sm:tracking-wider">
                  {storeName}
                </span>
                <span className="-mt-1 hidden text-[10px] font-medium uppercase tracking-widest text-slate-400 sm:block">
                  {activeTenant?.slug || 'store'}
                </span>
              </div>
            </div>
          </div>

          {/* Search Bar Minimalista */}
          <div className="hidden md:flex items-center flex-1 max-w-md mx-6">
            <div className="relative w-full">
              <input
                type="text"
                placeholder="Buscar itens 3D, capacetes, vasilhames..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-chumbo-900 border border-chumbo-700/60 rounded-xl py-2.5 pl-11 pr-4 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-slate-300 focus:ring-1 focus:ring-slate-300 transition-all"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {/* Ações / Usuário & Carrinho & Painel Admin */}
          <div className="flex shrink-0 items-center space-x-1.5 sm:space-x-3">
            
            {/* Botão Painel Admin (Se admin) */}
            {isAuthenticated && (user?.role === 'admin' || user?.role === 'tenant_admin' || user?.role === 'master_admin') && (
              <button
                onClick={onOpenAdmin}
                className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-laser-500/20 hover:bg-laser-500/30 text-laser-400 border border-laser-500/30 font-mono text-xs font-bold transition-all shadow-md active:scale-95"
              >
                <ShieldAlert className="w-4 h-4" />
                <span className="hidden sm:inline">Painel Admin</span>
              </button>
            )}

            {isAuthenticated && user?.role === 'customer' && (
              <>
                <button
                  onClick={openOrders}
                  className="relative p-2.5 rounded-xl bg-chumbo-900 hover:bg-chumbo-800 border border-chumbo-700/50 text-slate-200 hover:text-white transition-all"
                  aria-label="Abrir meus pedidos"
                  title="Meus pedidos"
                >
                  <ReceiptText className="w-5 h-5" />
                </button>
                <button
                  onClick={onOpenFavorites}
                  className="relative p-2.5 rounded-xl bg-chumbo-900 hover:bg-chumbo-800 border border-chumbo-700/50 text-slate-200 hover:text-white transition-all"
                  aria-label="Abrir favoritos"
                  title="Favoritos"
                >
                  <Heart className="w-5 h-5" />
                </button>
              </>
            )}

            {/* Botão Carrinho */}
            <button
              onClick={openCart}
              className="group relative rounded-xl border border-chumbo-700/50 bg-chumbo-900 p-2 text-slate-200 transition-all hover:bg-chumbo-800 hover:text-white sm:p-2.5"
              aria-label="Abrir carrinho de vendas"
            >
              <ShoppingBag className="w-5 h-5 group-hover:scale-110 transition-transform" />
              {totalItems > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-laser-500 text-chumbo-950 font-bold text-xs w-5 h-5 rounded-full flex items-center justify-center shadow-laser-glow">
                  {totalItems}
                </span>
              )}
            </button>

            {/* Status de Autenticação */}
            {isAuthenticated && user ? (
              <div className="relative">
                <button
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="flex items-center space-x-2 bg-chumbo-900 hover:bg-chumbo-800 border border-chumbo-700/60 py-2 px-3.5 rounded-xl text-sm font-medium text-slate-200 transition-all"
                >
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt={user.name} className="w-7 h-7 rounded-full object-cover border border-chumbo-700" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-chumbo-700 flex items-center justify-center font-bold text-xs text-white">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="hidden sm:inline max-w-[100px] truncate">{user.name}</span>
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </button>

                {/* Submenu do Usuário */}
                {isMenuOpen && (
                  <div className="absolute right-0 mt-2 w-52 bg-chumbo-900 border border-chumbo-700 rounded-xl shadow-2xl py-2 z-50">
                    <div className="px-4 py-2 border-b border-chumbo-800">
                      <p className="text-xs font-semibold text-slate-300">{user.name}</p>
                      <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
                      <span className="inline-block mt-1 bg-chumbo-800 text-slate-400 text-[10px] font-mono px-2 py-0.5 rounded uppercase">
                        {user.role}
                      </span>
                    </div>

                    {(user.role === 'admin' || user.role === 'tenant_admin' || user.role === 'master_admin') && (
                      <button
                        onClick={() => {
                          setIsMenuOpen(false);
                          onOpenAdmin();
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-laser-400 hover:bg-chumbo-800 flex items-center space-x-2 border-b border-chumbo-800 font-semibold"
                      >
                        <ShieldAlert className="w-4 h-4" />
                        <span>Gerenciar Loja</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setIsMenuOpen(false);
                        logout();
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-chumbo-800 flex items-center space-x-2"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sair da conta</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center space-x-1 sm:space-x-2">
                <button
                  onClick={onOpenLogin}
                  className="hidden px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:text-white sm:block"
                >
                  Entrar
                </button>
                <button
                  onClick={onOpenRegister}
                  className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-chumbo-950 shadow-md transition-all duration-200 hover:bg-slate-200 active:scale-95 sm:px-4 sm:text-sm"
                >
                  Cadastrar
                </button>
              </div>
            )}

          </div>

        </div>

        {/* Campo de Busca Mobile */}
        <div className="pb-3 md:hidden">
          <div className="relative w-full">
            <input
              type="text"
              placeholder="Buscar modelos 3D..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-chumbo-900 border border-chumbo-800 rounded-xl py-2 pl-10 pr-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-slate-400"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          </div>
        </div>

      </div>
    </header>
  );
};
