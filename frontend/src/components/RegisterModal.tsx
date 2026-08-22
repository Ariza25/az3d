import React, { useState } from 'react';
import { X, Lock, Mail, User as UserIcon, ArrowRight, AlertCircle, Layers } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

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
        window.history.pushState({}, '', '/admin');
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
            <h2 className="text-xl font-extrabold text-white">Criar Nova Conta</h2>
            <p className="text-xs text-slate-400">Junte-se ao ecossistema AZ3D</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3.5 rounded-xl bg-red-950/60 border border-red-800/80 text-red-200 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
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
              Quero comprar
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
              Quero vender
            </button>
          </div>

          <div>
            <label className="text-xs font-mono uppercase text-slate-400 block mb-1">
              Nome Completo
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu Nome"
                className="w-full bg-chumbo-900 border border-chumbo-700/80 rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-white transition-all"
              />
              <UserIcon className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {accountType === 'seller' && (
            <div>
              <label className="text-xs font-mono uppercase text-slate-400 block mb-1">
                Nome da Loja
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="Ex: Minha Loja 3D"
                  className="w-full bg-chumbo-900 border border-chumbo-700/80 rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-white transition-all"
                />
                <Layers className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-mono uppercase text-slate-400 block mb-1">
              Endereço de E-mail
            </label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.email@exemplo.com"
                className="w-full bg-chumbo-900 border border-chumbo-700/80 rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-white transition-all"
              />
              <Mail className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <div>
            <label className="text-xs font-mono uppercase text-slate-400 block mb-1">
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
            <span>{isLoading ? 'Registrando dados...' : accountType === 'seller' ? 'Criar Loja e Conta' : 'Criar Minha Conta'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-chumbo-800 text-center">
          <p className="text-xs text-slate-400">
            Já possui uma conta?{' '}
            <button
              onClick={() => {
                onClose();
                onSwitchToLogin();
              }}
              className="text-white font-bold underline hover:text-slate-200"
            >
              Fazer Login
            </button>
          </p>
        </div>

      </div>
    </div>
  );
};
