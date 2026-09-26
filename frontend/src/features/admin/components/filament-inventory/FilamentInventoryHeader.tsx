import React from 'react';
import { Layers, Plus } from 'lucide-react';

interface FilamentInventoryHeaderProps {
  isAddOpen: boolean;
  onToggleAdd: () => void;
}

export const FilamentInventoryHeader: React.FC<FilamentInventoryHeaderProps> = ({
  isAddOpen,
  onToggleAdd,
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-chumbo-800 dark:bg-chumbo-900/60">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700 dark:bg-laser-500/20 dark:text-laser-400">
          <Layers className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
            Controle Inteligente de Carretéis & Filamentos
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Rastreie gramas restantes, autonomia e consumo automático por pedido impresso
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onToggleAdd}
        className="flex items-center gap-1.5 rounded-xl bg-cyan-700 px-4 py-2 text-xs font-extrabold text-white shadow-sm transition-all hover:bg-cyan-800 dark:bg-laser-400 dark:text-chumbo-950 dark:hover:bg-laser-300"
      >
        <Plus className="h-4 w-4" />
        <span>{isAddOpen ? 'Fechar Cadastro' : 'Cadastrar Novo Carretel'}</span>
      </button>
    </div>
  );
};
