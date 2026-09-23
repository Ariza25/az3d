import React, { useEffect, useState } from 'react';
import {
  Lock,
  Mail,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Chrome,
  Store,
  KeyRound,
  ArrowLeft,
  Check,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ADMIN_TOKEN_KEY, api } from '../../services/api';
import { getAppPathname, withBasePath } from '../../shared/basePath';
import { ForgotPasswordModal } from '../../components/ForgotPasswordModal';
import { RegisterModal } from '../../components/RegisterModal';
import { AZ3DLogo } from '../../components/AZ3DLogo';

export const LoginPage: React.FC = () => {
  const { login, isAuthenticated, user, scope } = useAuth();
  const pathname = getAppPathname();
  const isResetRoute = pathname.startsWith('/recuperar-senha') || pathname.startsWith('/reset-password');

  // Redireciona se já estiver autenticado e não for tela de reset
  useEffect(() => {
    if (isAuthenticated && !isResetRoute) {
      if (user?.role === 'admin' || user?.role === 'tenant_admin' || user?.role === 'master_admin') {
        window.history.replaceState({}, '', withBasePath('/admin'));
      } else {
        const returnTo = new URLSearchParams(window.location.search).get('return_to') || '/az3d-studio/store';
        window.history.replaceState({}, '', withBasePath(returnTo));
      }
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  }, [isAuthenticated, isResetRoute, user?.role]);

  // Se estiver na rota de recuperação de senha por link do e-mail
  if (isResetRoute) {
    return <ResetPasswordView />;
  }

  return <LoginFormView onLogin={login} currentScope={scope} />;
};

const LoginFormView: React.FC<{
  onLogin: (email: string, pass: string) => Promise<any>;
  currentScope: 'customer' | 'admin';
}> = ({ onLogin }) => {
  const [accountType, setAccountType] = useState<'customer' | 'seller'>('customer');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isForgotOpen, setIsForgotOpen] = useState(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);

  const queryParams = new URLSearchParams(window.location.search);
  const returnTo = queryParams.get('return_to');

  const goToStore = () => {
    window.history.pushState({}, '', withBasePath('/az3d-studio/store'));
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const goToAdmin = () => {
    window.history.pushState({}, '', withBasePath('/admin'));
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (accountType === 'seller') {
        const response = await api.adminLogin(email, password);
        localStorage.setItem(ADMIN_TOKEN_KEY, response.token);
        localStorage.setItem('az3d_tenant_id', String(response.user.tenant_id || 1));
        goToAdmin();
        return;
      }

      await onLogin(email, password);
      const destination = returnTo || '/az3d-studio/store';
      window.history.pushState({}, '', withBasePath(destination));
      window.dispatchEvent(new PopStateEvent('popstate'));
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
      const scope = accountType === 'seller' ? 'admin' : 'customer';
      const targetReturn = scope === 'admin' ? '/admin' : returnTo || '/az3d-studio/store';
      const { auth_url } = await api.startGoogleOAuth(scope, { returnTo: targetReturn });
      window.location.href = auth_url;
    } catch (err: any) {
      setError(err.message || 'Erro ao iniciar login Google');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-chumbo-950 text-slate-900 dark:text-slate-100 flex flex-col justify-between selection:bg-blue-600 selection:text-white">
      {/* Header superior */}
      <header className="border-b border-slate-200 dark:border-chumbo-800/80 bg-white/80 dark:bg-chumbo-950/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={goToStore}>
            <AZ3DLogo showText className="h-10 w-10 shrink-0" />
          </div>

          <button
            type="button"
            onClick={goToStore}
            className="flex items-center gap-2 rounded-xl border border-slate-300 dark:border-chumbo-700/80 bg-white dark:bg-chumbo-900/60 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-chumbo-800 hover:text-slate-900 dark:hover:text-white transition-colors shadow-sm"
          >
            <Store className="h-4 w-4 text-blue-600 dark:text-laser-400" />
            <span>Ver Loja</span>
          </button>
        </div>
      </header>

      {/* Conteúdo Central */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 my-8">
        <div className="w-full max-w-md bg-white dark:bg-chumbo-900/80 border border-slate-200 dark:border-chumbo-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative">
          <div className="text-center mb-6">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Acessar Plataforma
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              Faça login para gerenciar pedidos, orçamentos e produtos 3D
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/80 text-red-700 dark:text-red-200 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Seletor Comprador vs Lojista */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-chumbo-950/70 border border-slate-200 dark:border-chumbo-800 rounded-2xl mb-5">
            <button
              type="button"
              onClick={() => setAccountType('customer')}
              className={`rounded-xl py-2.5 text-xs font-bold transition-all ${
                accountType === 'customer'
                  ? 'bg-blue-600 text-white shadow-md font-extrabold'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              Sou Comprador
            </button>
            <button
              type="button"
              onClick={() => setAccountType('seller')}
              className={`rounded-xl py-2.5 text-xs font-bold transition-all ${
                accountType === 'seller'
                  ? 'bg-blue-600 text-white shadow-md font-extrabold'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              Sou Lojista / Vendedor
            </button>
          </div>

          {/* Login com Google */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full py-3 rounded-xl border border-slate-300 dark:border-chumbo-700 bg-white dark:bg-chumbo-950/60 hover:bg-slate-50 dark:hover:bg-chumbo-800 text-slate-800 dark:text-white font-bold text-sm transition-all flex items-center justify-center space-x-2.5 disabled:opacity-50 shadow-sm"
          >
            <Chrome className="w-4 h-4 text-slate-700 dark:text-white" />
            <span>{accountType === 'seller' ? 'Acessar Painel com Google' : 'Continuar com Google'}</span>
          </button>

          <div className="flex items-center gap-3 my-5">
            <div className="h-px flex-1 bg-slate-200 dark:bg-chumbo-800" />
            <span className="text-[10px] font-mono font-semibold uppercase text-slate-600 dark:text-slate-400">ou com e-mail</span>
            <div className="h-px flex-1 bg-slate-200 dark:bg-chumbo-800" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-mono font-semibold uppercase text-slate-700 dark:text-slate-400 block mb-1">
                E-mail ou Usuário
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu.email@exemplo.com"
                  className="w-full bg-slate-50 dark:bg-chumbo-950/70 border border-slate-300 dark:border-chumbo-700 rounded-xl py-3 pl-11 pr-4 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-600 dark:focus:border-laser-400 transition-all"
                />
                <Mail className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-mono font-semibold uppercase text-slate-700 dark:text-slate-400">
                  Senha de Acesso
                </label>
                <button
                  type="button"
                  onClick={() => setIsForgotOpen(true)}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-laser-400 dark:hover:text-laser-300 transition-colors"
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
                  className="w-full bg-slate-50 dark:bg-chumbo-950/70 border border-slate-300 dark:border-chumbo-700 rounded-xl py-3 pl-11 pr-4 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-600 dark:focus:border-laser-400 transition-all"
                />
                <Lock className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 mt-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm transition-all shadow-lg shadow-blue-600/25 flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <span>{isLoading ? 'Autenticando...' : accountType === 'seller' ? 'Acessar Painel da Loja' : 'Entrar na Loja'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-200 dark:border-chumbo-800 text-center">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Ainda não tem conta?{' '}
              <button
                type="button"
                onClick={() => setIsRegisterOpen(true)}
                className="text-blue-600 hover:text-blue-700 dark:text-laser-400 dark:hover:text-laser-300 font-bold underline transition-colors"
              >
                Cadastre-se gratuitamente
              </button>
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-chumbo-800/60 py-6 text-center text-xs text-slate-500">
        AZ3D Studio &copy; {new Date().getFullYear()} — Plataforma de Impressão 3D e Manufatura sob Demanda.
      </footer>

      <ForgotPasswordModal
        isOpen={isForgotOpen}
        onClose={() => setIsForgotOpen(false)}
        onSwitchToLogin={() => setIsForgotOpen(false)}
        initialEmail={email}
        initialAccountType={accountType}
      />

      <RegisterModal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        onSwitchToLogin={() => setIsRegisterOpen(false)}
      />
    </div>
  );
};

const ResetPasswordView: React.FC = () => {
  const token = new URLSearchParams(window.location.search).get('token') || '';
  const [isValidating, setIsValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setIsValidating(false);
      setError('Token de recuperação não fornecido na URL.');
      return;
    }

    api.verifyResetToken(token)
      .then((res) => {
        if (res.valid) {
          setIsValid(true);
          setMaskedEmail(res.email || '');
        } else {
          setError(res.error || 'Link inválido ou expirado.');
        }
      })
      .catch((err) => {
        setError(err.message || 'Erro ao verificar token de recuperação.');
      })
      .finally(() => {
        setIsValidating(false);
      });
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setError('A nova senha deve possuir pelo menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('As senhas digitadas não coincidem.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await api.resetPassword(token, newPassword);
      setIsSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Erro ao redefinir senha.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const goToLogin = () => {
    window.history.pushState({}, '', withBasePath('/login'));
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-chumbo-950 text-slate-900 dark:text-slate-100 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-chumbo-900/90 border border-slate-200 dark:border-chumbo-700/80 rounded-3xl p-8 shadow-2xl backdrop-blur-xl">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-laser-400/15 border border-blue-200 dark:border-laser-500/30 flex items-center justify-center text-blue-600 dark:text-laser-400 mx-auto mb-4">
            <KeyRound className="w-6 h-6 stroke-[2.2]" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Criar Nova Senha</h1>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            {maskedEmail ? `Redefinindo senha para ${maskedEmail}` : 'Defina sua nova credencial de acesso'}
          </p>
        </div>

        {isValidating ? (
          <div className="py-12 text-center text-xs font-mono uppercase tracking-widest text-slate-500 dark:text-slate-400">
            Validando chave de segurança...
          </div>
        ) : isSuccess ? (
          <div className="text-center space-y-4 py-3">
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-500/40 text-left space-y-2">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold text-sm">
                <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <span>Senha redefinida com sucesso!</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Sua credencial foi atualizada no sistema. Você já pode fazer login na sua conta.
              </p>
            </div>
            <button
              type="button"
              onClick={goToLogin}
              className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm transition-all shadow-xl"
            >
              Fazer login agora
            </button>
          </div>
        ) : !isValid ? (
          <div className="text-center space-y-4 py-2">
            <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-left space-y-2">
              <div className="flex items-center gap-2 text-red-700 dark:text-red-300 font-bold text-sm">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                <span>Link Inválido ou Expirado</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                {error || 'Este link de recuperação já foi utilizado ou ultrapassou os 30 minutos de validade.'}
              </p>
            </div>
            <button
              type="button"
              onClick={goToLogin}
              className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm transition-all shadow-lg"
            >
              Solicitar novo link
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="text-xs font-mono font-semibold uppercase text-slate-700 dark:text-slate-400 block mb-1">
                Nova Senha (mínimo 6 caracteres)
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nova senha"
                  className="w-full bg-slate-50 dark:bg-chumbo-950 border border-slate-300 dark:border-chumbo-700 rounded-xl py-3 pl-11 pr-4 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-600 dark:focus:border-laser-400 transition-all"
                />
                <Lock className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div>
              <label className="text-xs font-mono font-semibold uppercase text-slate-700 dark:text-slate-400 block mb-1">
                Confirme a Nova Senha
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirme a nova senha"
                  className="w-full bg-slate-50 dark:bg-chumbo-950 border border-slate-300 dark:border-chumbo-700 rounded-xl py-3 pl-11 pr-4 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-600 dark:focus:border-laser-400 transition-all"
                />
                <Lock className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 mt-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm transition-all shadow-xl shadow-blue-600/25 flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <span>{isSubmitting ? 'Salvando...' : 'Atualizar Minha Senha'}</span>
              <CheckCircle2 className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={goToLogin}
              className="w-full pt-3 flex items-center justify-center gap-2 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Cancelar e voltar ao login</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
