import React from 'react';
import { ArrowUpRight, Filter, Flame, TrendingUp } from 'lucide-react';
import { MLTrendKeyword } from '../../../../../types';

interface MarketplaceTrendsTabProps {
  trends: MLTrendKeyword[];
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  onAnalyzeKeyword: (keyword: string) => void;
}

export const MarketplaceTrendsTab: React.FC<MarketplaceTrendsTabProps> = ({
  trends,
  selectedCategory,
  onSelectCategory,
  onAnalyzeKeyword,
}) => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-amber-400" />
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Categoria:</span>
          <select
            value={selectedCategory}
            onChange={(e) => onSelectCategory(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-amber-500 focus:outline-none dark:border-chumbo-700 dark:bg-chumbo-900 dark:text-white"
          >
            <option value="all">Todas as categorias</option>
            <option value="Organização">Organização / Setup</option>
            <option value="Decoração">Decoração / Casa</option>
            <option value="Geek/Games">Geek / Games</option>
            <option value="Utilitários">Utilitários & Ferramentas</option>
            <option value="Colecionáveis">Colecionáveis / RPG</option>
          </select>
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          Exibindo <span className="font-bold text-amber-700 dark:text-amber-400">{trends.length}</span> buscas em alta no marketplace
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {trends.map((item) => (
          <div
            key={item.keyword}
            className="group relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-amber-500/40 hover:shadow-md dark:border-chumbo-800 dark:bg-chumbo-900/90 dark:hover:bg-chumbo-900"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-xs font-extrabold text-amber-700 border border-slate-200 dark:bg-chumbo-800 dark:text-amber-400 dark:border-chumbo-700">
                  #{item.rank}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    item.status === 'hot'
                      ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-500/20 dark:text-rose-400 dark:border-rose-500/30'
                      : item.status === 'rising'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30'
                      : 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-700/50 dark:text-slate-300 dark:border-slate-600'
                  }`}
                >
                  {item.status === 'hot' && <Flame className="h-3 w-3" />}
                  {item.status === 'rising' && <TrendingUp className="h-3 w-3" />}
                  {item.status === 'hot' ? 'Em Chamas' : item.status === 'rising' ? 'Em Alta' : 'Estável'}
                </span>
              </div>

              <h3 className="mt-3 text-base font-bold text-slate-900 group-hover:text-amber-700 transition-colors dark:text-white dark:group-hover:text-amber-400">
                {item.keyword}
              </h3>

              {item.category && (
                <span className="mt-1 inline-block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {item.category}
                </span>
              )}

              {/* Volume Trend Sparkline visualization */}
              <div className="mt-4 flex items-end gap-1.5 h-10 border-b border-slate-100 pb-1 dark:border-chumbo-800/80">
                {item.volume_trend?.map((vol, i) => (
                  <div
                    key={i}
                    style={{ height: `${Math.max(15, vol)}%` }}
                    className={`w-full rounded-t transition-all ${
                      i === item.volume_trend.length - 1
                        ? 'bg-gradient-to-t from-amber-600 to-amber-400'
                        : 'bg-slate-200 group-hover:bg-slate-300 dark:bg-chumbo-700 dark:group-hover:bg-chumbo-600'
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between text-xs pt-2 border-t border-slate-100 dark:border-chumbo-800/50">
              <div className="text-slate-500 dark:text-slate-400">
                Volume est.: <span className="font-bold text-slate-900 dark:text-white">{item.search_vol.toLocaleString('pt-BR')} /mês</span>
              </div>
              <button
                onClick={() => onAnalyzeKeyword(item.keyword)}
                className="flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300"
              >
                <span>Analisar</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
