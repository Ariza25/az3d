import React from 'react';

export interface CatalogFooterProps {
  storeName: string;
  onGoToStore: () => void;
}

export const CatalogFooter: React.FC<CatalogFooterProps> = ({ storeName, onGoToStore }) => {
  return (
    <footer className="mt-16 border-t border-slate-200 dark:border-chumbo-800/80 bg-white dark:bg-chumbo-950 py-8 text-center text-xs text-slate-500 dark:text-slate-400 space-y-2 transition-colors">
      <p className="font-medium text-slate-800 dark:text-slate-300">
        {storeName} • Catálogo Digital de Impressão 3D
      </p>
      <p>
        Tem um modelo personalizado em mente? Converse conosco para um orçamento sob medida.
      </p>
      <div className="pt-2">
        <button
          type="button"
          onClick={onGoToStore}
          className="text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300 font-semibold underline underline-offset-4 cursor-pointer"
        >
          Acessar loja oficial com carrinho e checkout
        </button>
      </div>
    </footer>
  );
};
