import React, { useEffect, useState } from 'react';
import { X, Lock, Mail, ArrowRight, AlertCircle, Layers, Chrome } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ADMIN_TOKEN_KEY, api } from '../services/api';
import { getAppReturnTo, withBasePath } from '../shared/basePath';

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
  subtitle = 'Autenticacao de cliente comprador',
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

  const displayTitle = accountType === 'seller' ? 'Acessar conta de vendedor' : title;
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
      <div className="glass-panel w-full max-w-md p-8 rounded-3xl border border-chumbo-700 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-white hover:bg-chumbo-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-chumbo-950 font-bold">
            <Layers className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-white">{displayTitle}</h2>
            <p className="text-xs text-slate-400">{displaySubtitle}</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3.5 rounded-xl bg-red-950/60 border border-red-800/80 text-red-200 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {showAccountTypeSwitch && (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAccountType('customer')}
                className={`rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
                  accountType === 'customer'
                    ? 'border-laser-500/40 bg-laser-500/15 text-laser-300'
                    : 'border-chumbo-700 bg-chumbo-900 text-slate-400 hover:text-white'
                }`}
              >
                Sou comprador
              </button>
              <button
                type="button"
                onClick={() => setAccountType('seller')}
                className={`rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
                  accountType === 'seller'
                    ? 'border-laser-500/40 bg-laser-500/15 text-laser-300'
                    : 'border-chumbo-700 bg-chumbo-900 text-slate-400 hover:text-white'
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
            className="w-full py-3 rounded-xl border border-chumbo-700 bg-chumbo-900 hover:bg-chumbo-800 text-white font-bold text-sm transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            <Chrome className="w-4 h-4" />
            <span>{accountType === 'seller' ? 'Entrar no admin com Google' : 'Continuar com Google'}</span>
          </button>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-chumbo-800" />
            <span className="text-[10px] font-mono uppercase text-slate-500">ou</span>
            <div className="h-px flex-1 bg-chumbo-800" />
          </div>

          <div>
            <label className="text-xs font-mono uppercase text-slate-400 block mb-1">
              E-mail ou usuario
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.email@exemplo.com ou admin"
                className="w-full bg-chumbo-900 border border-chumbo-700/80 rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-white transition-all"
              />
              <Mail className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <div>
            <label className="text-xs font-mono uppercase text-slate-400 block mb-1">
              Senha de acesso
            </label>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="********"
                className="w-full bg-chumbo-900 border border-chumbo-700/80 rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-white transition-all"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 mt-2 rounded-xl bg-white hover:bg-slate-200 text-chumbo-950 font-extrabold text-sm transition-all shadow-xl flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            <span>{isLoading ? loadingLabel : accountType === 'seller' ? 'Entrar no Admin' : submitLabel}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {showRegisterLink && (
          <div className="mt-6 pt-4 border-t border-chumbo-800 text-center">
            <p className="text-xs text-slate-400">
              Ainda nao tem uma conta?{' '}
              <button
                onClick={() => {
                  onClose();
                  onSwitchToRegister();
                }}
                className="text-white font-bold underline hover:text-slate-200"
              >
                Cadastre-se gratuitamente
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
