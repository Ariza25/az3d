import React from 'react';
import {
  AlertTriangle,
  History,
  MinusCircle,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { FilamentSpool } from '../../../../types';
import { money } from '../../../../shared/storePresentation';

interface FilamentSpoolCardProps {
  spool: FilamentSpool;
  onDelete: (id: number) => void;
  onOpenDeduct: (spool: FilamentSpool) => void;
  onOpenLogs: (spool: FilamentSpool) => void;
}

export const FilamentSpoolCard: React.FC<FilamentSpoolCardProps> = ({
  spool,
  onDelete,
  onOpenDeduct,
  onOpenLogs,
}) => {
  const percentLeft = Math.round((spool.remaining_weight_g / spool.spool_weight_g) * 100);
  const isCritical = spool.remaining_weight_g < 100;
  const isLow = spool.remaining_weight_g < 250;
  const estPieces150g = Math.floor(spool.remaining_weight_g / 150);

  return (
    <div className="relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3 dark:border-chumbo-800 dark:bg-chumbo-900">
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className="h-4 w-4 shrink-0 rounded-full border border-black/20 shadow-sm"
              style={{ backgroundColor: spool.color_hex }}
            />
            <div className="min-w-0">
              <strong className="block truncate text-sm text-slate-900 dark:text-white" title={spool.name}>
                {spool.name}
              </strong>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                <span className="font-bold">{spool.material_type}</span>
                <span>•</span>
                <span>{spool.color_name}</span>
                {spool.vendor && (
                  <>
                    <span>•</span>
                    <span className="rounded bg-slate-100 px-1 py-0.2 font-mono text-[10px] text-slate-700 dark:bg-chumbo-800 dark:text-slate-300">
                      {spool.vendor}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onDelete(spool.id)}
            className="text-slate-400 hover:text-rose-600 dark:text-slate-500 dark:hover:text-rose-400 p-1 shrink-0"
            title="Excluir carretel"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        {/* Progress Bar & Weight */}
        <div className="mt-3 space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Restante:</span>
            <span
              className={`font-mono font-bold ${
                isCritical
                  ? 'text-rose-600 dark:text-rose-400'
                  : isLow
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-emerald-700 dark:text-emerald-400'
              }`}
            >
              {Math.round(spool.remaining_weight_g)}g / {spool.spool_weight_g}g ({percentLeft}%)
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-chumbo-950">
            <div
              className={`h-full transition-all ${
                isCritical
                  ? 'bg-rose-500'
                  : isLow
                  ? 'bg-amber-500'
                  : 'bg-cyan-600 dark:bg-laser-400'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, percentLeft))}%` }}
            />
          </div>
        </div>

        {/* Autonomy Badge */}
        <div className="mt-2.5 flex items-center justify-between text-[11px]">
          <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400 font-medium">
            <Sparkles className="h-3 w-3 text-cyan-600 dark:text-laser-400" />
            <span>Autonomia estimada:</span>
          </span>
          <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
            ~{estPieces150g} peças (médias 150g)
          </span>
        </div>

        {/* Alert banner if low */}
        {isLow && (
          <div
            className={`mt-2 flex items-center gap-1.5 text-[11px] font-bold p-2 rounded-lg border ${
              isCritical
                ? 'text-rose-700 bg-rose-50 border-rose-300 dark:text-rose-300 dark:bg-rose-950/40 dark:border-rose-800'
                : 'text-amber-800 bg-amber-50 border-amber-300 dark:text-amber-300 dark:bg-amber-950/40 dark:border-amber-800'
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>
              {isCritical
                ? 'Atenção: nível crítico (< 100g)!'
                : 'Estoque de filamento baixo (< 250g)!'}
            </span>
          </div>
        )}

        <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-2 text-xs dark:border-chumbo-800/80">
          <span className="text-slate-500 dark:text-slate-400">Custo/kg:</span>
          <span className="font-mono font-bold text-slate-900 dark:text-white">
            {money(spool.price_per_kg)}
          </span>
        </div>
      </div>

      {/* Actions: Abate Manual & Histórico */}
      <div className="mt-3 flex gap-1.5 pt-1 border-t border-slate-100 dark:border-chumbo-800/50">
        <button
          type="button"
          onClick={() => onOpenDeduct(spool)}
          className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-slate-50 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-chumbo-700 dark:bg-chumbo-950 dark:text-slate-300 dark:hover:bg-chumbo-800"
        >
          <MinusCircle className="h-3.5 w-3.5 text-cyan-600 dark:text-laser-400" />
          <span>Abater</span>
        </button>
        <button
          type="button"
          onClick={() => onOpenLogs(spool)}
          className="flex items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-chumbo-700 dark:bg-chumbo-900 dark:text-slate-400 dark:hover:bg-chumbo-800"
          title="Ver histórico de consumo"
        >
          <History className="h-3.5 w-3.5" />
          <span>Histórico</span>
        </button>
      </div>
    </div>
  );
};
