import React from 'react';
import { CheckCircle2, AlertCircle, Save, Moon, Sun } from 'lucide-react';
import { User } from '../../../types';
import { Button } from '../../../components/ui';

export interface UserProfileTabProps {
  user: User | null;
  name: string;
  email: string;
  phone: string;
  theme: string;
  profileSuccessMsg: string | null;
  profileErrorMsg: string | null;
  onNameChange: (val: string) => void;
  onEmailChange: (val: string) => void;
  onPhoneChange: (val: string) => void;
  onThemeChange: (val: 'light' | 'dark') => void;
  onSaveProfile: () => void;
}

export const UserProfileTab: React.FC<UserProfileTabProps> = ({
  user,
  name,
  email,
  phone,
  theme,
  profileSuccessMsg,
  profileErrorMsg,
  onNameChange,
  onEmailChange,
  onPhoneChange,
  onThemeChange,
  onSaveProfile,
}) => {
  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <div className="bg-chumbo-800/40 p-4 rounded-2xl border border-chumbo-700/50 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-chumbo-700 flex items-center justify-center font-black text-xl text-white border-2 border-laser-500/50 shrink-0">
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt={user.name} className="w-full h-full rounded-full object-cover" />
          ) : (
            (user?.name || 'A').charAt(0).toUpperCase()
          )}
        </div>
        <div>
          <h3 className="text-sm font-bold text-white">{user?.name}</h3>
          <p className="text-xs text-slate-400">{user?.email}</p>
        </div>
      </div>

      {profileSuccessMsg && (
        <div className="p-3 bg-emerald-700 text-white border border-emerald-800 rounded-xl flex items-center gap-2.5 text-xs shadow-sm dark:bg-emerald-500/20 dark:border-emerald-500/40 dark:text-emerald-300 dark:shadow-none">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-white dark:text-emerald-400" />
          <span>{profileSuccessMsg}</span>
        </div>
      )}

      {profileErrorMsg && (
        <div className="p-3 bg-rose-700 text-white border border-rose-800 rounded-xl flex items-center gap-2.5 text-xs shadow-sm dark:bg-red-500/20 dark:border-red-500/40 dark:text-red-300 dark:shadow-none">
          <AlertCircle className="w-4 h-4 shrink-0 text-white dark:text-red-400" />
          <span>{profileErrorMsg}</span>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
            Nome Completo
          </label>
          <div className="relative">
            <input
              type="text"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="Seu nome completo"
              className="w-full bg-chumbo-950 border border-chumbo-700 rounded-xl py-2.5 px-3.5 text-sm text-white focus:outline-none focus:border-laser-400 transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
            E-mail Principal
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            placeholder="exemplo@email.com"
            className="w-full bg-chumbo-950 border border-chumbo-700 rounded-xl py-2.5 px-3.5 text-sm text-white focus:outline-none focus:border-laser-400 transition-colors"
          />
          <p className="text-[11px] text-slate-400 mt-1">
            Usado para confirmações de compras, rastreamento e faturamento.
          </p>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
            Telefone / WhatsApp
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => onPhoneChange(e.target.value)}
            placeholder="(11) 99999-9999"
            maxLength={15}
            className="w-full bg-chumbo-950 border border-chumbo-700 rounded-xl py-2.5 px-3.5 text-sm text-white focus:outline-none focus:border-laser-400 transition-colors font-mono"
          />
          <p className="text-[11px] text-slate-400 mt-1">
            Para avisos importantes e agilização da entrega dos pedidos.
          </p>
        </div>

        {/* Tema do Sistema */}
        <div className="pt-3 border-t border-chumbo-800">
          <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
            Aparência do Sistema
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => onThemeChange('dark')}
              className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all ${
                theme === 'dark'
                  ? 'border-laser-400 bg-laser-500/10 text-white shadow-laser-glow'
                  : 'border-chumbo-700 bg-chumbo-950 text-slate-400 hover:text-white'
              }`}
            >
              <Moon className="w-4 h-4 text-cyan-400" />
              <span>Tema Escuro (Chumbo)</span>
            </button>

            <button
              type="button"
              onClick={() => onThemeChange('light')}
              className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all ${
                theme === 'light'
                  ? 'border-laser-400 bg-white text-chumbo-950 shadow-md'
                  : 'border-chumbo-700 bg-chumbo-950 text-slate-400 hover:text-white'
              }`}
            >
              <Sun className="w-4 h-4 text-amber-500" />
              <span>Tema Claro (Branco Gelo)</span>
            </button>
          </div>
        </div>

        <div className="pt-2">
          <Button
            onClick={onSaveProfile}
            variant="laser"
            className="w-full py-3 text-sm font-bold shadow-laser-glow flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>Salvar Alterações</span>
          </Button>
        </div>
      </div>
    </div>
  );
};
