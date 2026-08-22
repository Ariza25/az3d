import React, { useState } from 'react';
import { ShoppingBag, LogOut, Search, Layers, ChevronDown, Store, ShieldAlert, Heart } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { Tenant, TenantSettings } from '../types';

interface NavbarProps {
  onOpenLogin: () => void;
  onOpenRegister: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  activeTenant: Tenant | null;
  tenants: Tenant[];
  onSelectTenant: (tenant: Tenant) => void;
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
  tenants,
  onSelectTenant,
  onOpenAdmin,
  onOpenFavorites,
  tenantSettings,
}) => {
  const { user, isAuthenticated, logout } = useAuth();
  const { totalItems, setIsCartOpen } = useCart();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const storeName = tenantSettings?.store_name || activeTenant?.name || 'AZ3D';
  const logoUrl = tenantSettings?.logo_url || activeTenant?.logo_url;
  const primaryColor = tenantSettings?.primary_color || '#22d3ee';

  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-chumbo-800 bg-chumbo-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* Logo AZ3D & Seletor Multi-Tenant */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3 cursor-pointer group">
              {logoUrl ? (
                <img src={logoUrl} alt={storeName} className="w-10 h-10 rounded-lg object-cover border border-chumbo-700 bg-chumbo-900 shadow-lg group-hover:scale-105 transition-transform duration-300" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-chumbo-900 border border-chumbo-700 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform duration-300" style={{ color: primaryColor }}>
                  <Layers className="w-6 h-6 stroke-[2.5]" />
                </div>
              )}
              <div>
                <span className="text-2xl font-extrabold tracking-wider text-white flex items-center gap-1">
                  {storeName}
                </span>
                <span className="text-[10px] uppercase tracking-widest text-slate-400 font-medium block -mt-1">
                  {activeTenant?.slug || 'store'}
                </span>
              </div>
            </div>

            {/* Seletor de Loja/Tenant na Navbar */}
            {tenants.length > 0 && (
              <div className="hidden lg:flex items-center bg-chumbo-900 border border-chumbo-750 rounded-xl px-2.5 py-1 space-x-1.5 text-xs text-slate-300">
                <Store className="w-3.5 h-3.5 text-laser-400" />
                <select
                  value={activeTenant?.id || 1}
                  onChange={(e) => {
                    const t = tenants.find((item) => item.id === parseInt(e.target.value));
                    if (t) onSelectTenant(t);
                  }}
                  className="bg-transparent text-white font-mono focus:outline-none cursor-pointer pr-1"
                >
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id} className="bg-chumbo-950 text-white">
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
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
          <div className="flex items-center space-x-3">
            
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
              <button
                onClick={onOpenFavorites}
                className="relative p-2.5 rounded-xl bg-chumbo-900 hover:bg-chumbo-800 border border-chumbo-700/50 text-slate-200 hover:text-white transition-all"
                aria-label="Abrir favoritos"
              >
                <Heart className="w-5 h-5" />
              </button>
            )}

            {/* Botão Carrinho */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative p-2.5 rounded-xl bg-chumbo-900 hover:bg-chumbo-800 border border-chumbo-700/50 text-slate-200 hover:text-white transition-all group"
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
                  <div className="w-7 h-7 rounded-full bg-chumbo-700 flex items-center justify-center font-bold text-xs text-white">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
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
              <div className="flex items-center space-x-2">
                <button
                  onClick={onOpenLogin}
                  className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
                >
                  Entrar
                </button>
                <button
                  onClick={onOpenRegister}
                  className="px-4 py-2 text-sm font-medium bg-white text-chumbo-950 hover:bg-slate-200 rounded-xl font-semibold shadow-md transition-all duration-200 active:scale-95"
                >
                  Cadastrar
                </button>
              </div>
            )}

          </div>

        </div>

        {/* Campo de Busca Mobile */}
        <div className="md:hidden pb-4">
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
