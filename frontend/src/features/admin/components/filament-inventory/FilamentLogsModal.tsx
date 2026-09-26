import React from 'react';
import { Loader2, Package, X } from 'lucide-react';
import { FilamentSpool, FilamentUsageLog } from '../../../../types';

interface FilamentLogsModalProps {
  spool: FilamentSpool;
  logs: FilamentUsageLog[];
  isLoading: boolean;
  onClose: () => void;
}

export const FilamentLogsModal: React.FC<FilamentLogsModalProps> = ({
  spool,
  logs,
  isLoading,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-chumbo-700 dark:bg-chumbo-900">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-chumbo-800">
          <div className="flex items-center gap-2.5">
            <span
              className="h-3.5 w-3.5 rounded-full border shadow-sm"
              style={{ backgroundColor: spool.color_hex }}
            />
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Histórico de Consumo: {spool.name}
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Restante: {spool.remaining_weight_g}g de {spool.spool_weight_g}g
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 max-h-72 overflow-y-auto space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center p-8 text-xs text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin mr-2 text-cyan-600 dark:text-laser-400" />
              <span>Carregando histórico...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
              <Package className="h-8 w-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
              <span>Nenhum registro de consumo para este carretel ainda.</span>
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-2.5 text-xs dark:border-chumbo-800 dark:bg-chumbo-950"
              >
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {log.description}
                  </span>
                  <span className="block text-[10px] text-slate-400">
                    {new Date(log.created_at).toLocaleString('pt-BR')}
                  </span>
                </div>
                <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                  -{log.grams_used}g
                </span>
              </div>
            ))
          )}
        </div>

        <div className="mt-4 flex justify-end border-t border-slate-200 pt-3 dark:border-chumbo-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-100 px-4 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200 dark:bg-chumbo-800 dark:text-slate-300"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
