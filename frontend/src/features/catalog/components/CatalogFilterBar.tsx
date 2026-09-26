import React from 'react';
import { Search, X, Grid, List } from 'lucide-react';

export interface CatalogCategoryOption {
  id: number;
  name: string;
  slug: string;
  count: number;
}

export interface CatalogFilterBarProps {
  searchQuery: string;
  selectedCategory: string;
  sortBy: 'featured' | 'price_asc' | 'price_desc' | 'name';
  viewMode: 'grid' | 'compact';
  categoriesWithCounts: CatalogCategoryOption[];
  totalCount: number;
  onSearchChange: (query: string) => void;
  onClearSearch: () => void;
  onCategoryChange: (categorySlug: string) => void;
  onSortChange: (sortBy: 'featured' | 'price_asc' | 'price_desc' | 'name') => void;
  onViewModeChange: (viewMode: 'grid' | 'compact') => void;
}

export const CatalogFilterBar: React.FC<CatalogFilterBarProps> = ({
  searchQuery,
  selectedCategory,
  sortBy,
  viewMode,
  categoriesWithCounts,
  totalCount,
  onSearchChange,
  onClearSearch,
  onCategoryChange,
  onSortChange,
  onViewModeChange,
}) => {
  return (
    <section className="sticky top-14 sm:top-20 z-30 -mx-3 sm:-mx-6 lg:-mx-8 px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3 bg-slate-100/95 dark:bg-chumbo-950/95 backdrop-blur-md border-y border-slate-200 dark:border-chumbo-800/80 space-y-2.5 sm:space-y-3 transition-colors">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3">
        {/* Campo de Busca Rápida */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar produto por nome, modelo, cor..."
            className="w-full pl-9 pr-8 py-2 rounded-xl bg-white dark:bg-chumbo-900 border border-slate-300 dark:border-chumbo-700/80 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all shadow-xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={onClearSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 cursor-pointer"
              aria-label="Limpar busca"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Controles de Ordenação e Visualização */}
        <div className="flex items-center gap-1.5 sm:gap-2 justify-between sm:justify-end shrink-0">
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as CatalogFilterBarProps['sortBy'])}
            className="px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-white dark:bg-chumbo-900 border border-slate-300 dark:border-chumbo-700/80 text-[11px] sm:text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-cyan-500 text-ellipsis shadow-xs cursor-pointer"
          >
            <option value="featured">Destaques</option>
            <option value="price_asc">Menor Preço</option>
            <option value="price_desc">Maior Preço</option>
            <option value="name">Alfabética</option>
          </select>

          {/* Alternador de Layout (Grade / Lista) */}
          <div className="flex items-center p-0.5 sm:p-1 rounded-xl bg-slate-200 dark:bg-chumbo-900 border border-slate-300 dark:border-chumbo-700/80">
            <button
              type="button"
              onClick={() => onViewModeChange('grid')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-chumbo-800 text-cyan-600 dark:text-cyan-400 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Grade Visual"
              aria-label="Visualização em grade"
            >
              <Grid className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('compact')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'compact'
                  ? 'bg-white dark:bg-chumbo-800 text-cyan-600 dark:text-cyan-400 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Lista Compacta"
              aria-label="Visualização em lista"
            >
              <List className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Categorias em Pílulas com Scroll Horizontal */}
      <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar pb-1 text-xs -mx-1 px-1 touch-pan-x">
        <button
          type="button"
          onClick={() => onCategoryChange('todas')}
          className={`shrink-0 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
            selectedCategory === 'todas'
              ? 'bg-cyan-600 !text-white font-bold shadow-md shadow-cyan-600/30'
              : 'bg-white dark:bg-chumbo-900 text-slate-800 dark:text-white hover:bg-slate-50 dark:hover:bg-chumbo-800 border border-slate-300 dark:border-chumbo-700/70 shadow-xs'
          }`}
        >
          <span className={selectedCategory === 'todas' ? '!text-white' : 'text-slate-800 dark:text-white'}>
            Todas ({totalCount})
          </span>
        </button>
        {categoriesWithCounts.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => onCategoryChange(cat.slug)}
            className={`shrink-0 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
              selectedCategory === cat.slug
                ? 'bg-cyan-600 !text-white font-bold shadow-md shadow-cyan-600/30'
                : 'bg-white dark:bg-chumbo-900 text-slate-800 dark:text-white hover:bg-slate-50 dark:hover:bg-chumbo-800 border border-slate-300 dark:border-chumbo-700/70 shadow-xs'
            }`}
          >
            <span className={selectedCategory === cat.slug ? '!text-white' : 'text-slate-800 dark:text-white'}>
              {cat.name}
            </span>
            {cat.count > 0 && (
              <span
                className={`text-[9px] sm:text-[10px] px-1.5 py-0.2 rounded-full ${
                  selectedCategory === cat.slug
                    ? 'bg-cyan-700 !text-white font-bold'
                    : 'bg-slate-100 dark:bg-chumbo-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {cat.count}
              </span>
            )}
          </button>
        ))}
      </div>
    </section>
  );
};
