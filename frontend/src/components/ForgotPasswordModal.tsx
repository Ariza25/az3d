import React, { useState } from 'react';
import { X, Mail, ArrowRight, AlertCircle, CheckCircle2, KeyRound } from 'lucide-react';
import { api } from '../services/api';

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
      <div className="glass-panel w-full max-w-md p-8 rounded-3xl border border-chumbo-700 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-white hover:bg-chumbo-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-laser-400/10 border border-laser-500/30 flex items-center justify-center text-laser-400">
            <KeyRound className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-white">Recuperar Senha</h2>
            <p className="text-xs text-slate-400">Enviaremos um link seguro para o seu e-mail</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3.5 rounded-xl bg-red-950/60 border border-red-800/80 text-red-200 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {successMessage ? (
          <div className="space-y-4 text-center py-2">
            <div className="p-4 rounded-2xl bg-emerald-950/50 border border-emerald-500/40 text-left space-y-2">
              <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>Solicitação enviada!</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {successMessage}
              </p>
              <p className="text-[11px] text-slate-400">
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
              className="w-full py-3.5 rounded-xl bg-white hover:bg-slate-200 text-chumbo-950 font-extrabold text-sm transition-all shadow-xl"
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
                className={`rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
                  accountType === 'customer'
                    ? 'border-laser-500/40 bg-laser-500/15 text-laser-300'
                    : 'border-chumbo-700 bg-chumbo-900 text-slate-400 hover:text-white'
                }`}
              >
                Comprador
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
                Lojista / Vendedor
              </button>
            </div>

            <div>
              <label className="text-xs font-mono uppercase text-slate-400 block mb-1">
                Seu e-mail cadastrado
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="exemplo@email.com"
                  className="w-full bg-chumbo-900 border border-chumbo-700/80 rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-laser-400 transition-all"
                />
                <Mail className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 mt-2 rounded-xl bg-white hover:bg-slate-200 text-chumbo-950 font-extrabold text-sm transition-all shadow-xl flex items-center justify-center space-x-2 disabled:opacity-50"
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
                className="text-xs text-slate-400 hover:text-white transition-colors"
              >
                Lembrou sua senha? <strong className="text-laser-400 underline">Fazer login</strong>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
