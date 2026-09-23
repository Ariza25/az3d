import React, { useState } from 'react';
import { X, Lock, Mail, User as UserIcon, ArrowRight, AlertCircle, Store, Chrome } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { getAppReturnTo, withBasePath } from '../shared/basePath';
import { AZ3DLogo } from './AZ3DLogo';

interface RegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToLogin: () => void;
  tenantId?: number;
}

export const RegisterModal: React.FC<RegisterModalProps> = ({
  isOpen,
  onClose,
  onSwitchToLogin,
  tenantId,
}) => {
  const { register, registerSeller } = useAuth();
  const [accountType, setAccountType] = useState<'customer' | 'seller'>('customer');
  const [name, setName] = useState('');
  const [storeName, setStoreName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (accountType === 'seller') {
        await registerSeller(name, email, password, storeName);
        onClose();
        window.history.pushState({}, '', withBasePath('/admin'));
        window.dispatchEvent(new PopStateEvent('popstate'));
        return;
      }

      await register(name, email, password, tenantId);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao realizar cadastro');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (accountType === 'seller' && !storeName.trim()) {
        setError('Informe o nome da loja antes de continuar com Google');
        setIsLoading(false);
        return;
      }
      const scope = accountType === 'seller' ? 'seller' : 'customer';
      const { auth_url } = await api.startGoogleOAuth(scope, {
        tenantId,
        storeName: accountType === 'seller' ? storeName : undefined,
        returnTo: accountType === 'seller' ? '/admin' : getAppReturnTo(),
      });
      window.location.href = auth_url;
    } catch (err: any) {
      setError(err.message || 'Erro ao iniciar cadastro Google');
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
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Criar Nova Conta</h2>
            <p className="text-xs text-slate-600 dark:text-slate-400">Junte-se ao ecossistema AZ3D</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/80 text-red-700 dark:text-red-200 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
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
              Quero comprar
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
              Quero vender
            </button>
          </div>

          {accountType === 'seller' && (
            <div>
              <label className="text-xs font-mono font-semibold uppercase text-slate-700 dark:text-slate-400 block mb-1">
                Nome da Loja
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="Ex: Minha Loja 3D"
                  className="w-full bg-slate-50 dark:bg-chumbo-900 border border-slate-300 dark:border-chumbo-700/80 rounded-xl py-3 pl-11 pr-4 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-600 dark:focus:border-white transition-all"
                />
                <Store className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogleRegister}
            disabled={isLoading}
            className="w-full py-3 rounded-xl border border-slate-300 dark:border-chumbo-700 bg-white dark:bg-chumbo-900 hover:bg-slate-50 dark:hover:bg-chumbo-800 text-slate-800 dark:text-white font-bold text-sm transition-all flex items-center justify-center space-x-2 disabled:opacity-50 shadow-sm"
          >
            <Chrome className="w-4 h-4 text-slate-700 dark:text-white" />
            <span>{accountType === 'seller' ? 'Criar loja com Google' : 'Continuar com Google'}</span>
          </button>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200 dark:bg-chumbo-800" />
            <span className="text-[10px] font-mono font-semibold uppercase text-slate-600 dark:text-slate-400">ou</span>
            <div className="h-px flex-1 bg-slate-200 dark:bg-chumbo-800" />
          </div>

          <div>
            <label className="text-xs font-mono font-semibold uppercase text-slate-700 dark:text-slate-400 block mb-1">
              Nome Completo
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu Nome"
                className="w-full bg-slate-50 dark:bg-chumbo-900 border border-slate-300 dark:border-chumbo-700/80 rounded-xl py-3 pl-11 pr-4 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-600 dark:focus:border-white transition-all"
              />
              <UserIcon className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <div>
            <label className="text-xs font-mono font-semibold uppercase text-slate-700 dark:text-slate-400 block mb-1">
              Endereço de E-mail
            </label>
            <div className="relative">
              <input
                type="email"
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
            <label className="text-xs font-mono font-semibold uppercase text-slate-700 dark:text-slate-400 block mb-1">
              Crie uma Senha
            </label>
            <div className="relative">
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
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
            <span>{isLoading ? 'Registrando dados...' : accountType === 'seller' ? 'Criar Loja e Conta' : 'Criar Minha Conta'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-200 dark:border-chumbo-800 text-center">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Já possui uma conta?{' '}
            <button
              onClick={() => {
                onClose();
                onSwitchToLogin();
              }}
              className="text-blue-600 hover:text-blue-700 dark:text-laser-400 dark:hover:text-laser-300 font-bold underline transition-colors"
            >
              Fazer Login
            </button>
          </p>
        </div>

      </div>
    </div>
  );
};

