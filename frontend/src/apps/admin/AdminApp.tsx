import React, { useState } from 'react';
import { ArrowLeft, LockKeyhole, ShieldAlert } from 'lucide-react';
import { AdminModal } from '../../components/AdminModal';
import { LoginModal } from '../../components/LoginModal';
import { useAuth } from '../../context/AuthContext';
import { MasterAdminConsole } from '../../features/admin/components/MasterAdminConsole';
import { useTenantCatalog } from '../../shared/hooks/useTenantCatalog';
import { withBasePath } from '../../shared/basePath';
import { AZ3DLogo } from '../../components/AZ3DLogo';

const goToStore = () => {
  window.history.pushState({}, '', withBasePath('/'));
  window.dispatchEvent(new PopStateEvent('popstate'));
};

const isTenantAdminRole = (role?: string) => role === 'admin' || role === 'tenant_admin';

export const AdminApp: React.FC = () => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-chumbo-950 text-slate-900 dark:text-slate-100">
        <div className="text-xs font-mono uppercase tracking-widest text-slate-500 dark:text-slate-400">Validando sessão administrativa...</div>
      </div>
    );
  }

  if (!isAuthenticated || (user?.role !== 'master_admin' && !isTenantAdminRole(user?.role))) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-chumbo-950 text-slate-900 dark:text-slate-100">
        <header className="border-b border-slate-200 dark:border-chumbo-800 bg-white/90 dark:bg-chumbo-950/90 backdrop-blur-md">
          <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <button type="button" onClick={goToStore} className="flex items-center space-x-3 text-left">
              <AZ3DLogo showText className="h-10 w-10 shrink-0" />
            </button>
            <button type="button" onClick={goToStore} className="flex items-center gap-2 rounded-xl border border-slate-300 dark:border-chumbo-700 bg-white dark:bg-chumbo-900 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-sm transition-colors hover:bg-slate-100 dark:hover:bg-chumbo-800">
              <ArrowLeft className="h-4 w-4" />
              <span>Voltar para loja</span>
            </button>
          </div>
        </header>

        <main className="mx-auto flex min-h-[calc(100vh-80px)] max-w-3xl items-center px-4 py-12">
          <div className="w-full rounded-2xl border border-slate-200 dark:border-chumbo-800 bg-white dark:bg-chumbo-900 p-8 shadow-2xl">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-blue-200 dark:border-laser-500/30 bg-blue-50 dark:bg-laser-500/10 text-blue-600 dark:text-laser-400">
              <LockKeyhole className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Acesso ao Painel</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
              Entre com suas credenciais para gerenciar produtos, pedidos e configurações da sua operação.
            </p>
            <button type="button" onClick={() => setIsLoginOpen(true)} className="mt-6 flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700 shadow-lg shadow-blue-600/25">
              <ShieldAlert className="h-4 w-4" />
              <span>Acessar Painel</span>
            </button>
          </div>
        </main>

        <LoginModal
          isOpen={isLoginOpen}
          onClose={() => setIsLoginOpen(false)}
          onSwitchToRegister={() => setIsLoginOpen(false)}
          title="Acesso ao Painel"
          subtitle="O painel será definido automaticamente pelo perfil da conta"
          submitLabel="Acessar Painel"
          loadingLabel="Validando perfil..."
          showRegisterLink={false}
          googleScope="admin"
          initialAccountType="seller"
        />
      </div>
    );
  }

  if (user?.role === 'master_admin') {
    return <MasterAdminConsole onClose={goToStore} />;
  }

  return <TenantAdminConsole tenantId={user?.tenant_id} />;
};

const TenantAdminConsole: React.FC<{ tenantId?: number }> = ({ tenantId }) => {
  const {
    activeTenant,
    categories,
    refreshProducts,
    refreshCategories,
  } = useTenantCatalog({ lockedTenantId: tenantId });

  return (
    <AdminModal
      isOpen
      variant="page"
      onClose={goToStore}
      activeTenant={activeTenant}
      categories={categories}
      onRefreshProducts={refreshProducts}
      onRefreshCategories={refreshCategories}
    />
  );
};
