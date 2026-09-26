import React from 'react';
import { Sun, Moon, Share2, Check, ShoppingBag, ArrowUpRight } from 'lucide-react';
import { AZ3DLogo } from '../../../components/AZ3DLogo';
import { resolveApiAssetUrl } from '../../../services/api';

export interface CatalogHeaderProps {
  storeName: string;
  logoUrl?: string;
  totalCount: number;
  isDark: boolean;
  copiedLink: boolean;
  onToggleTheme: () => void;
  onCopyLink: () => void;
  onGoToStore: () => void;
}

export const CatalogHeader: React.FC<CatalogHeaderProps> = ({
  storeName,
  logoUrl,
  totalCount,
  isDark,
  copiedLink,
  onToggleTheme,
  onCopyLink,
  onGoToStore,
}) => {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-chumbo-800/80 bg-white/95 dark:bg-chumbo-950/95 backdrop-blur-xl transition-colors">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 sm:h-20 flex items-center justify-between gap-2 sm:gap-4">
        {/* Logo & Informações da Loja */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {logoUrl ? (
            <img
              src={resolveApiAssetUrl(logoUrl)}
              alt={storeName}
              className="h-8 w-8 sm:h-12 sm:w-12 rounded-xl object-contain shrink-0"
            />
          ) : (
            <AZ3DLogo className="h-8 w-8 sm:h-12 sm:w-12 rounded-xl object-contain shrink-0" />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h1 className="text-xs sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight truncate max-w-[120px] min-[400px]:max-w-[160px] sm:max-w-xs md:max-w-md">
                {storeName}
              </h1>
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-100 dark:bg-cyan-950/70 border border-cyan-300 dark:border-cyan-500/30 text-cyan-800 dark:text-cyan-300 shrink-0">
                Catálogo
              </span>
            </div>
            <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
              <span className="truncate">Impressão 3D</span>
              <span className="text-slate-400 dark:text-chumbo-600">•</span>
              <span className="text-slate-500 dark:text-slate-400 shrink-0">{totalCount} itens</span>
            </p>
          </div>
        </div>

        {/* Quick Actions no Cabeçalho */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Alternador de Tema Claro / Escuro */}
          <button
            type="button"
            onClick={onToggleTheme}
            title={isDark ? 'Alternar para tema claro' : 'Alternar para tema escuro'}
            aria-label="Alternar tema claro/escuro"
            className="inline-flex items-center gap-1.5 p-2 sm:px-3 sm:py-2 rounded-xl text-xs font-semibold bg-white dark:bg-chumbo-900 hover:bg-slate-100 dark:hover:bg-chumbo-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-chumbo-700/80 transition-all shadow-sm active:scale-95 shrink-0"
          >
            {isDark ? (
              <>
                <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 fill-amber-400/20" />
                <span className="hidden md:inline text-amber-400 font-bold">Claro</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-700 fill-slate-700/20" />
                <span className="hidden md:inline text-slate-700 font-bold">Escuro</span>
              </>
            )}
          </button>

          {/* Botão de Compartilhar Link */}
          <button
            type="button"
            onClick={onCopyLink}
            title="Copiar link do catálogo para compartilhar"
            aria-label="Compartilhar catálogo"
            className="inline-flex items-center gap-1.5 p-2 sm:px-3 sm:py-2 rounded-xl text-xs font-semibold bg-white dark:bg-chumbo-900 hover:bg-slate-100 dark:hover:bg-chumbo-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-chumbo-700/80 transition-all shadow-sm active:scale-95 shrink-0"
          >
            {copiedLink ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold hidden md:inline">Copiado!</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Compartilhar</span>
              </>
            )}
          </button>

          {/* Ir para a Loja Oficial */}
          <button
            type="button"
            onClick={onGoToStore}
            className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white border border-cyan-500 transition-all shadow-md active:scale-95 shrink-0"
            title="Acessar loja oficial com carrinho e checkout"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span className="hidden min-[400px]:inline">Loja</span>
            <span className="hidden sm:inline">Oficial</span>
            <ArrowUpRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 opacity-80" />
          </button>
        </div>
      </div>
    </header>
  );
};
