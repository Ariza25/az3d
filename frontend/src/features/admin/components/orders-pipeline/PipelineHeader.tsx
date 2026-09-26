import React from 'react';
import { Cpu, RefreshCw, Search } from 'lucide-react';

interface PipelineHeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onRefresh: () => void;
}

export const PipelineHeader: React.FC<PipelineHeaderProps> = ({
  searchQuery,
  onSearchChange,
  onRefresh,
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-chumbo-800 dark:bg-chumbo-900/60">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700 dark:bg-laser-500/20 dark:text-laser-400">
          <Cpu className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Pipeline de Produção 3D & Pedidos</h3>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Acompanhe fabricação, carretéis em uso e etapas dos pedidos
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar pedido ou cliente..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:border-cyan-600 focus:outline-none dark:border-chumbo-700 dark:bg-chumbo-950 dark:text-white dark:placeholder-slate-500"
          />
        </div>

        <button
          type="button"
          onClick={onRefresh}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200 dark:border-chumbo-700 dark:bg-chumbo-800 dark:text-slate-300 dark:hover:bg-chumbo-700 dark:hover:text-white"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Atualizar</span>
        </button>
      </div>
    </div>
  );
};
