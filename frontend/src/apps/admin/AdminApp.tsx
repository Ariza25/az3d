import React, { useState } from 'react';
import { ArrowLeft, Layers, LockKeyhole, ShieldAlert } from 'lucide-react';
import { AdminModal } from '../../components/AdminModal';
import { LoginModal } from '../../components/LoginModal';
import { useAuth } from '../../context/AuthContext';
import { useTenantCatalog } from '../../shared/hooks/useTenantCatalog';

const goToStore = () => {
  window.history.pushState({}, '', '/');
  window.dispatchEvent(new PopStateEvent('popstate'));
};

export const AdminApp: React.FC = () => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const {
    tenants,
    activeTenant,
    categories,
    onSelectTenant,
    refreshProducts,
  } = useTenantCatalog({ lockedTenantId: user?.tenant_id });
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const scopedTenants = user?.tenant_id
    ? tenants.filter((tenant) => tenant.id === user.tenant_id)
    : tenants;
  const scopedActiveTenant = user?.tenant_id
    ? activeTenant?.id === user.tenant_id
      ? activeTenant
      : scopedTenants[0] || null
    : activeTenant;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-chumbo-950 text-slate-100 flex items-center justify-center">
        <div className="text-xs font-mono uppercase tracking-widest text-slate-400">Validando sessao administrativa...</div>
      </div>
    );
  }

  if (!isAuthenticated || (user?.role !== 'admin' && user?.role !== 'tenant_admin')) {
    return (
      <div className="min-h-screen bg-chumbo-950 text-slate-100">
        <header className="border-b border-chumbo-800 bg-chumbo-950/90">
          <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={goToStore}
              className="flex items-center space-x-3 text-left"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-slate-100 to-chumbo-600 shadow-lg">
                <Layers className="h-6 w-6 text-chumbo-950 stroke-[2.5]" />
              </div>
              <div>
                <span className="flex items-center gap-1 text-2xl font-extrabold tracking-wider text-white">
                  AZ<span className="font-mono text-laser-400">3D</span>
                </span>
                <span className="block -mt-1 text-[10px] font-medium uppercase tracking-widest text-slate-400">
                  Admin Console
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={goToStore}
              className="flex items-center gap-2 rounded-xl border border-chumbo-700 bg-chumbo-900 px-4 py-2 text-xs font-bold text-slate-200 transition-colors hover:bg-chumbo-800"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Voltar para loja</span>
            </button>
          </div>
        </header>

        <main className="mx-auto flex min-h-[calc(100vh-80px)] max-w-3xl items-center px-4 py-12">
          <div className="w-full rounded-2xl border border-chumbo-800 bg-chumbo-900 p-6 shadow-2xl">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-laser-500/30 bg-laser-500/10 text-laser-400">
              <LockKeyhole className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-extrabold text-white">Acesso administrativo</h1>
            <p className="mt-2 text-sm text-slate-400">
              Entre com uma conta administradora para gerenciar produtos, pedidos, marketplaces e precificacao.
            </p>
            <button
              type="button"
              onClick={() => setIsLoginOpen(true)}
              className="mt-6 flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-chumbo-950 transition-colors hover:bg-slate-200"
            >
              <ShieldAlert className="h-4 w-4" />
              <span>Entrar como admin</span>
            </button>
          </div>
        </main>

        <LoginModal
          isOpen={isLoginOpen}
          onClose={() => setIsLoginOpen(false)}
          onSwitchToRegister={() => setIsLoginOpen(false)}
          title="Acesso Administrativo"
          subtitle="Login exclusivo para lojistas e operadores do tenant"
          submitLabel="Entrar no Admin"
          loadingLabel="Validando admin..."
          defaultEmail="admin@az3d.com.br"
          defaultPassword="123456"
          showRegisterLink={false}
        />
      </div>
    );
  }

  return (
    <AdminModal
      isOpen
      variant="page"
      onClose={goToStore}
      activeTenant={scopedActiveTenant}
      tenants={scopedTenants}
      onSelectTenant={onSelectTenant}
      categories={categories}
      onRefreshProducts={refreshProducts}
    />
  );
};
