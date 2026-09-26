import React, { useEffect, useState } from 'react';
import { X, Lock, Mail, ArrowRight, AlertCircle, Chrome } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { ADMIN_TOKEN_KEY, api } from '../../../services/api';
import { getAppReturnTo, withBasePath } from '../../../shared/basePath';
import { ForgotPasswordModal } from './ForgotPasswordModal';
import { AZ3DLogo } from '../../../components/AZ3DLogo';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToRegister: () => void;
  title?: string;
  subtitle?: string;
  submitLabel?: string;
  loadingLabel?: string;
  defaultEmail?: string;
  defaultPassword?: string;
  showRegisterLink?: boolean;
  googleScope?: 'customer' | 'admin';
  tenantId?: number;
  showAccountTypeSwitch?: boolean;
  initialAccountType?: 'customer' | 'seller';
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onSwitchToRegister,
  title = 'Acessar Conta AZ3D',
  subtitle = 'Autenticação de cliente comprador',
  submitLabel = 'Entrar na Loja',
  loadingLabel = 'Autenticando...',
  defaultEmail = '',
  defaultPassword = '',
  showRegisterLink = true,
  googleScope = 'customer',
  tenantId,
  showAccountTypeSwitch = false,
  initialAccountType = googleScope === 'admin' ? 'seller' : 'customer',
}) => {
  const { login, scope } = useAuth();
  const [accountType, setAccountType] = useState<'customer' | 'seller'>(initialAccountType);
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState(defaultPassword);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setAccountType(initialAccountType);
    setEmail(defaultEmail);
    setPassword(defaultPassword);
    setError(null);
  }, [defaultEmail, defaultPassword, initialAccountType, isOpen]);

  if (!isOpen) return null;

  const goToAdmin = () => {
    window.history.pushState({}, '', withBasePath('/admin'));
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const displayTitle = accountType === 'seller' ? 'Acessar Painel da Loja' : title;
  const displaySubtitle = accountType === 'seller'
    ? 'Entre para gerenciar sua loja, produtos e pedidos'
    : subtitle;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (accountType === 'seller') {
        if (scope === 'admin') {
          await login(email, password);
          onClose();
          return;
        }

        const response = await api.adminLogin(email, password);
        localStorage.setItem(ADMIN_TOKEN_KEY, response.token);
        localStorage.setItem('az3d_tenant_id', String(response.user.tenant_id || tenantId || 1));
        onClose();
        goToAdmin();
        return;
      }

      await login(email, password);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao realizar login');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const scope = accountType === 'seller' ? 'admin' : googleScope;
      const returnTo = scope === 'admin' ? '/admin' : getAppReturnTo();
      const { auth_url } = await api.startGoogleOAuth(scope, { tenantId, returnTo });
      window.location.href = auth_url;
    } catch (err: any) {
      setError(err.message || 'Erro ao iniciar login Google');
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="glass-panel w-full max-w-md p-8 rounded-3xl border border-slate-200 dark:border-chumbo-700 bg-white dark:bg-chumbo-900 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-chumbo-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-6">
          <AZ3DLogo className="w-10 h-10 shrink-0" />
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">{displayTitle}</h2>
            <p className="text-xs text-slate-600 dark:text-slate-400">{displaySubtitle}</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/80 text-red-700 dark:text-red-200 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {showAccountTypeSwitch && (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAccountType('customer')}
                className={`rounded-xl border px-3 py-2 text-xs font-bold transition-all ${
                  accountType === 'customer'
                    ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                    : 'border-slate-300 dark:border-chumbo-700 bg-slate-100 dark:bg-chumbo-900 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Sou comprador
              </button>
              <button
                type="button"
                onClick={() => setAccountType('seller')}
                className={`rounded-xl border px-3 py-2 text-xs font-bold transition-all ${
                  accountType === 'seller'
                    ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                    : 'border-slate-300 dark:border-chumbo-700 bg-slate-100 dark:bg-chumbo-900 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Sou vendedor
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full py-3 rounded-xl border border-slate-300 dark:border-chumbo-700 bg-white dark:bg-chumbo-900 hover:bg-slate-50 dark:hover:bg-chumbo-800 text-slate-800 dark:text-white font-bold text-sm transition-all flex items-center justify-center space-x-2 disabled:opacity-50 shadow-sm"
          >
            <Chrome className="w-4 h-4 text-slate-700 dark:text-white" />
            <span>{accountType === 'seller' ? 'Acessar Painel com Google' : 'Continuar com Google'}</span>
          </button>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200 dark:bg-chumbo-800" />
            <span className="text-[10px] font-mono font-semibold uppercase text-slate-600 dark:text-slate-400">ou</span>
            <div className="h-px flex-1 bg-slate-200 dark:bg-chumbo-800" />
          </div>

          <div>
            <label className="text-xs font-mono font-semibold uppercase text-slate-700 dark:text-slate-400 block mb-1">
              E-mail ou usuário
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.email@exemplo.com"
                className="w-full bg-slate-50 dark:bg-chumbo-900 border border-slate-300 dark:border-chumbo-700/80 rounded-xl py-3 pl-11 pr-4 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-600 dark:focus:border-white transition-all"
              />
              <Mail className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-mono font-semibold uppercase text-slate-700 dark:text-slate-400">
                Senha de acesso
              </label>
              <button
                type="button"
                onClick={() => setIsForgotPasswordOpen(true)}
                className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 dark:text-laser-400 dark:hover:text-laser-300 transition-colors"
              >
                Esqueceu a senha?
              </button>
            </div>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="********"
                className="w-full bg-slate-50 dark:bg-chumbo-900 border border-slate-300 dark:border-chumbo-700/80 rounded-xl py-3 pl-11 pr-4 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-600 dark:focus:border-white transition-all"
              />
              <Lock className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 mt-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm transition-all shadow-xl shadow-blue-600/25 flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            <span>{isLoading ? loadingLabel : accountType === 'seller' ? 'Acessar Painel' : submitLabel}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {showRegisterLink && (
          <div className="mt-6 pt-4 border-t border-slate-200 dark:border-chumbo-800 text-center">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Ainda não tem uma conta?{' '}
              <button
                onClick={() => {
                  onClose();
                  onSwitchToRegister();
                }}
                className="text-blue-600 hover:text-blue-700 dark:text-laser-400 dark:hover:text-laser-300 font-bold underline transition-colors"
              >
                Cadastre-se gratuitamente
              </button>
            </p>
          </div>
        )}
      </div>

      <ForgotPasswordModal
        isOpen={isForgotPasswordOpen}
        onClose={() => setIsForgotPasswordOpen(false)}
        onSwitchToLogin={() => setIsForgotPasswordOpen(false)}
        initialEmail={email}
        initialAccountType={accountType}
      />
    </div>
  );
};
