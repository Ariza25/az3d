import React from 'react';
import {
  BarChart2,
  Flame,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from 'lucide-react';

export type MarketplaceProvider = 'mercadolivre' | 'shopee' | 'amazon';
export type MarketplaceTab = 'trends' | 'audit' | 'insights' | 'opportunities';

interface MarketplaceHeaderProps {
  provider: MarketplaceProvider;
  onSwitchProvider: (provider: MarketplaceProvider) => void;
  activeTab: MarketplaceTab;
  onSelectTab: (tab: MarketplaceTab) => void;
  onReloadAll: () => void;
  isLoading: boolean;
}

export const MarketplaceHeader: React.FC<MarketplaceHeaderProps> = ({
  provider,
  onSwitchProvider,
  activeTab,
  onSelectTab,
  onReloadAll,
  isLoading,
}) => {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-chumbo-800 dark:bg-gradient-to-r dark:from-chumbo-900 dark:via-chumbo-950 dark:to-chumbo-900 dark:shadow-xl">
      <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-laser-500/10 blur-3xl" />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-600 text-white shadow-md dark:bg-gradient-to-br dark:from-yellow-400 dark:to-amber-600 dark:text-chumbo-950">
            <TrendingUp className="h-6 w-6 stroke-[2.5]" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white">
              Inteligência de Mercado & Tendências 3D
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Análise em tempo real de buscas, concorrência e auditoria de anúncios nos principais marketplaces.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Provider Selector Switcher */}
          <div className="flex rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-chumbo-700 dark:bg-chumbo-900">
            <button
              type="button"
              onClick={() => onSwitchProvider('mercadolivre')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                provider === 'mercadolivre'
                  ? 'bg-amber-600 text-white shadow-sm dark:bg-yellow-400 dark:text-chumbo-950'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <span>Mercado Livre 💛</span>
            </button>

            <button
              type="button"
              onClick={() => onSwitchProvider('shopee')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                provider === 'shopee'
                  ? 'bg-orange-600 text-white shadow-sm dark:bg-orange-500 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <span>Shopee 🧡</span>
            </button>

            <button
              type="button"
              onClick={() => onSwitchProvider('amazon')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                provider === 'amazon'
                  ? 'bg-sky-600 text-white shadow-sm dark:bg-sky-500 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <span>Amazon 📦</span>
            </button>
          </div>

          <button
            onClick={onReloadAll}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-100 hover:text-slate-900 dark:border-chumbo-700 dark:bg-chumbo-800/80 dark:text-slate-200 dark:hover:bg-chumbo-700 dark:hover:text-white"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-200 pt-4 dark:border-chumbo-800/80">
        <button
          onClick={() => onSelectTab('trends')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
            activeTab === 'trends'
              ? 'bg-amber-700 text-white shadow-sm dark:bg-amber-500 dark:text-chumbo-950'
              : 'border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-100 hover:text-slate-900 dark:border-transparent dark:bg-chumbo-900 dark:text-slate-400 dark:hover:bg-chumbo-800'
          }`}
        >
          <Flame className="h-4 w-4" />
          <span>Tendências ML (Google Trends)</span>
        </button>

        <button
          onClick={() => onSelectTab('audit')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
            activeTab === 'audit'
              ? 'bg-amber-700 text-white shadow-sm dark:bg-amber-500 dark:text-chumbo-950'
              : 'border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-100 hover:text-slate-900 dark:border-transparent dark:bg-chumbo-900 dark:text-slate-400 dark:hover:bg-chumbo-800'
          }`}
        >
          <ShieldCheck className="h-4 w-4" />
          <span>Otimizador de Anúncio (Metrify)</span>
        </button>

        <button
          onClick={() => onSelectTab('insights')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
            activeTab === 'insights'
              ? 'bg-amber-700 text-white shadow-sm dark:bg-amber-500 dark:text-chumbo-950'
              : 'border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-100 hover:text-slate-900 dark:border-transparent dark:bg-chumbo-900 dark:text-slate-400 dark:hover:bg-chumbo-800'
          }`}
        >
          <BarChart2 className="h-4 w-4" />
          <span>Análise de Concorrência</span>
        </button>

        <button
          onClick={() => onSelectTab('opportunities')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
            activeTab === 'opportunities'
              ? 'bg-amber-700 text-white shadow-sm dark:bg-amber-500 dark:text-chumbo-950'
              : 'border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-100 hover:text-slate-900 dark:border-transparent dark:bg-chumbo-900 dark:text-slate-400 dark:hover:bg-chumbo-800'
          }`}
        >
          <Sparkles className="h-4 w-4" />
          <span>Oportunidades 3D Lucrativas</span>
        </button>
      </div>
    </div>
  );
};
