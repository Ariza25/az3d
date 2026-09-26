import React from 'react';
import { Search } from 'lucide-react';

interface FilamentFilterBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  materialFilter: string;
  onMaterialFilterChange: (mat: string) => void;
}

export const FilamentFilterBar: React.FC<FilamentFilterBarProps> = ({
  searchQuery,
  onSearchChange,
  materialFilter,
  onMaterialFilterChange,
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="relative min-w-[220px] flex-1 max-w-md">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar por marca, cor ou nome..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:border-cyan-600 focus:outline-none dark:border-chumbo-700 dark:bg-chumbo-950 dark:text-white dark:placeholder-slate-500"
        />
      </div>

      <div className="flex items-center gap-1 overflow-x-auto text-xs">
        {['ALL', 'PLA', 'PETG', 'ABS', 'TPU', 'Resin'].map((mat) => (
          <button
            key={mat}
            type="button"
            onClick={() => onMaterialFilterChange(mat)}
            className={`rounded-lg px-2.5 py-1 font-semibold transition-colors ${
              materialFilter === mat
                ? 'bg-cyan-700 text-white dark:bg-laser-400 dark:text-chumbo-950'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-chumbo-800 dark:bg-chumbo-950 dark:text-slate-400'
            }`}
          >
            {mat === 'ALL' ? 'Todos os Polímeros' : mat}
          </button>
        ))}
      </div>
    </div>
  );
};
