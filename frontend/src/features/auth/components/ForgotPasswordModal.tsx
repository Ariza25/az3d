import React, { useState } from 'react';
import { X, Mail, ArrowRight, AlertCircle, CheckCircle2, KeyRound } from 'lucide-react';
import { api } from '../../../services/api';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToLogin: () => void;
  initialEmail?: string;
  initialAccountType?: 'customer' | 'seller';
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  isOpen,
  onClose,
  onSwitchToLogin,
  initialEmail = '',
  initialAccountType = 'customer',
}) => {
  const [email, setEmail] = useState(initialEmail);
  const [accountType, setAccountType] = useState<'customer' | 'seller'>(initialAccountType);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Por favor, digite seu e-mail cadastrado.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await api.forgotPassword(email.trim(), accountType);
      setSuccessMessage(response.message || 'Instruções de recuperação enviadas com sucesso!');
    } catch (err: any) {
      setError(err.message || 'Não foi possível solicitar a recuperação de senha.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="glass-panel w-full max-w-md p-8 rounded-3xl border border-slate-200 dark:border-chumbo-700 bg-white dark:bg-chumbo-900 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-chumbo-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-laser-400/10 border border-blue-200 dark:border-laser-500/30 flex items-center justify-center text-blue-600 dark:text-laser-400">
            <KeyRound className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Recuperar Senha</h2>
            <p className="text-xs text-slate-600 dark:text-slate-400">Enviaremos um link seguro para o seu e-mail</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/80 text-red-700 dark:text-red-200 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {successMessage ? (
          <div className="space-y-4 text-center py-2">
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-500/40 text-left space-y-2">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Solicitação enviada!</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {successMessage}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Verifique sua caixa de entrada e a pasta de spam. O link expira em 30 minutos.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setSuccessMessage(null);
                onClose();
                onSwitchToLogin();
              }}
              className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm transition-all shadow-xl shadow-blue-600/25"
            >
              Voltar para o login
            </button>
          </div>
        ) : (
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
                Comprador
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
                Lojista / Vendedor
              </button>
            </div>

            <div>
              <label className="text-xs font-mono font-semibold uppercase text-slate-700 dark:text-slate-400 block mb-1">
                Seu e-mail cadastrado
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="exemplo@email.com"
                  className="w-full bg-slate-50 dark:bg-chumbo-900 border border-slate-300 dark:border-chumbo-700/80 rounded-xl py-3 pl-11 pr-4 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-600 dark:focus:border-laser-400 transition-all"
                />
                <Mail className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 mt-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm transition-all shadow-xl shadow-blue-600/25 flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <span>{isLoading ? 'Enviando e-mail...' : 'Enviar link de recuperação'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="pt-3 text-center">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onSwitchToLogin();
                }}
                className="text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                Lembrou sua senha? <strong className="text-blue-600 hover:text-blue-700 dark:text-laser-400 underline">Fazer login</strong>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
