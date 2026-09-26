import React from 'react';
import { Loader2, MinusCircle, Scale, X } from 'lucide-react';
import { FilamentSpool } from '../../../../types';

interface FilamentManualDeductModalProps {
  spool: FilamentSpool;
  deductGrams: number;
  setDeductGrams: (v: number) => void;
  deductReason: string;
  setDeductReason: (v: string) => void;
  isDeducting: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

export const FilamentManualDeductModal: React.FC<FilamentManualDeductModalProps> = ({
  spool,
  deductGrams,
  setDeductGrams,
  deductReason,
  setDeductReason,
  isDeducting,
  onSubmit,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl space-y-4 dark:border-chumbo-700 dark:bg-chumbo-900"
      >
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-chumbo-800">
          <div className="flex items-center gap-2">
            <MinusCircle className="h-5 w-5 text-cyan-600 dark:text-laser-400" />
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Abater Filamento: {spool.name}
            </h4>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Quantidade a Abater (Gramas)
            </label>
            <input
              type="number"
              min="1"
              max={spool.remaining_weight_g}
              value={deductGrams}
              onChange={(e) => setDeductGrams(parseFloat(e.target.value) || 0)}
              required
              className="w-full rounded-lg border border-slate-200 bg-white p-2 text-sm font-mono font-bold text-slate-900 focus:border-cyan-600 focus:outline-none dark:border-chumbo-700 dark:bg-chumbo-950 dark:text-white"
            />
            <span className="text-[11px] text-slate-500 mt-1 block">
              Saldo atual: {spool.remaining_weight_g}g ➔ Ficará com:{' '}
              <strong className="text-slate-800 dark:text-slate-200">
                {Math.max(0, spool.remaining_weight_g - deductGrams)}g
              </strong>
            </span>
          </div>

          <div>
            <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Motivo / Descrição
            </label>
            <input
              type="text"
              value={deductReason}
              onChange={(e) => setDeductReason(e.target.value)}
              placeholder="Ex: Peça de teste, falha de impressão, etc."
              required
              className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-900 focus:border-cyan-600 focus:outline-none dark:border-chumbo-700 dark:bg-chumbo-950 dark:text-white"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 pt-3 dark:border-chumbo-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:border-chumbo-700 dark:text-slate-400 dark:hover:bg-chumbo-800"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isDeducting || deductGrams <= 0}
            className="flex items-center gap-1.5 rounded-xl bg-cyan-700 px-4 py-2 text-xs font-extrabold text-white hover:bg-cyan-800 dark:bg-laser-400 dark:text-chumbo-950 dark:hover:bg-laser-300 disabled:opacity-50"
          >
            {isDeducting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Scale className="h-3.5 w-3.5" />}
            <span>Confirmar Abate</span>
          </button>
        </div>
      </form>
    </div>
  );
};
