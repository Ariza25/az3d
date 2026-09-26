import React from 'react';
import { PackagePlus, X } from 'lucide-react';

interface ProductFormHeaderProps {
  isEditing: boolean;
  onClose: () => void;
}

export const ProductFormHeader: React.FC<ProductFormHeaderProps> = ({ isEditing, onClose }) => {
  return (
    <div className="bg-slate-100 dark:bg-chumbo-950 p-6 border-b border-slate-200 dark:border-chumbo-800 flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 rounded-xl bg-cyan-700 text-white border border-cyan-600 dark:bg-laser-500/20 dark:text-laser-400 dark:border-laser-500/30 flex items-center justify-center">
          <PackagePlus className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            {isEditing ? 'Editar Produto' : 'Novo Produto 3D'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Preencha os detalhes e especificações de fatiamento 3D
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onClose}
        className="p-2 rounded-full bg-white text-slate-500 hover:text-slate-900 border border-slate-200 dark:bg-chumbo-900 dark:text-slate-400 dark:hover:text-white dark:border-chumbo-700 transition-colors"
        aria-label="Fechar modal de produto"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
};
