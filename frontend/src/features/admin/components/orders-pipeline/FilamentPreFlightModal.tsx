import React from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Loader2,
  Scale,
  X,
} from 'lucide-react';
import { FilamentSpool, Order, OrderFilamentCheckResult } from '../../../../types';

interface FilamentPreFlightModalProps {
  order: Order;
  isChecking: boolean;
  isStarting: boolean;
  filamentCheckResult: OrderFilamentCheckResult | null;
  availableSpools: FilamentSpool[];
  selectedSpoolMap: Record<number, number>;
  onSelectSpool: (orderItemId: number, spoolId: number) => void;
  autoDeduct: boolean;
  onToggleAutoDeduct: (val: boolean) => void;
  onConfirm: () => void;
  onClose: () => void;
}

export const FilamentPreFlightModal: React.FC<FilamentPreFlightModalProps> = ({
  order,
  isChecking,
  isStarting,
  filamentCheckResult,
  availableSpools,
  selectedSpoolMap,
  onSelectSpool,
  autoDeduct,
  onToggleAutoDeduct,
  onConfirm,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl space-y-4 dark:border-chumbo-700 dark:bg-chumbo-900">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-chumbo-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Pré-Voo de Filamento · Pedido #{order.id}
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Verifique se há carretel suficiente antes de iniciar a impressão física
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

        {isChecking ? (
          <div className="flex flex-col items-center justify-center p-8 text-xs text-slate-400 space-y-2">
            <Loader2 className="h-6 w-6 animate-spin text-purple-600 dark:text-purple-400" />
            <span>Analisando carretéis compatíveis no estoque...</span>
          </div>
        ) : filamentCheckResult ? (
          <div className="space-y-4">
            {/* Warnings banner */}
            {filamentCheckResult.warnings.length > 0 && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300 space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span>Alerta de Filamento Insuficiente no Estoque!</span>
                </div>
                {filamentCheckResult.warnings.map((warn, idx) => (
                  <p key={idx} className="text-[11px] pl-5.5">
                    {warn}
                  </p>
                ))}
              </div>
            )}

            {/* Items check list */}
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {filamentCheckResult.items.map((item) => {
                const chosenSpoolId = selectedSpoolMap[item.order_item_id] || item.matching_spool_id;
                const chosenSpool = availableSpools.find((s) => s.id === chosenSpoolId);
                const isSufficient = chosenSpool
                  ? chosenSpool.remaining_weight_g >= item.total_required_grams
                  : false;
                const remainingAfter = chosenSpool
                  ? Math.round(chosenSpool.remaining_weight_g - item.total_required_grams)
                  : 0;

                return (
                  <div
                    key={item.order_item_id}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs space-y-2 dark:border-chumbo-800 dark:bg-chumbo-950"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <strong className="block text-slate-900 dark:text-white">
                          {item.product_title}
                        </strong>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                          {item.quantity}x · Cor: {item.color} · Mat: {item.material}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Consumo Total
                        </span>
                        <strong className="font-mono text-sm text-cyan-700 dark:text-laser-400">
                          {Math.round(item.total_required_grams)}g
                        </strong>
                      </div>
                    </div>

                    {/* Spool selector */}
                    <div className="pt-2 border-t border-slate-200 dark:border-chumbo-800/80">
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Carretel a ser utilizado / debitado:
                      </label>
                      <select
                        value={chosenSpoolId || ''}
                        onChange={(e) => onSelectSpool(item.order_item_id, Number(e.target.value))}
                        className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-900 focus:border-purple-600 focus:outline-none dark:border-chumbo-700 dark:bg-chumbo-900 dark:text-white"
                      >
                        <option value="">Selecione um carretel...</option>
                        {availableSpools.map((spool) => (
                          <option key={spool.id} value={spool.id}>
                            {spool.name} ({spool.vendor ? `${spool.vendor} · ` : ''}{spool.color_name}) - Restante: {Math.round(spool.remaining_weight_g)}g
                          </option>
                        ))}
                      </select>

                      {/* Status result pill */}
                      <div className="mt-1.5 flex items-center justify-between text-[11px]">
                        {chosenSpool ? (
                          isSufficient ? (
                            <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-bold">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>
                                Suficiente! Restarão {remainingAfter}g após a impressão
                              </span>
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-bold">
                              <AlertCircle className="h-3.5 w-3.5" />
                              <span>
                                Insuficiente! Faltam{' '}
                                {Math.round(item.total_required_grams - chosenSpool.remaining_weight_g)}g no carretel
                              </span>
                            </span>
                          )
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400 font-bold">
                            Nenhum carretel selecionado
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Auto Deduct Checkbox */}
            <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 font-medium cursor-pointer p-2 rounded-xl bg-slate-50 border border-slate-200 dark:bg-chumbo-950 dark:border-chumbo-800">
              <input
                type="checkbox"
                checked={autoDeduct}
                onChange={(e) => onToggleAutoDeduct(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
              />
              <span>
                Abater gramas automaticamente dos carretéis selecionados ao dar o play
              </span>
            </label>
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-3 dark:border-chumbo-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:border-chumbo-700 dark:text-slate-400 dark:hover:bg-chumbo-800"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={isStarting || isChecking}
            onClick={onConfirm}
            className="flex items-center gap-1.5 rounded-xl bg-purple-700 px-5 py-2 text-xs font-extrabold text-white shadow-sm hover:bg-purple-800 dark:bg-purple-600 dark:hover:bg-purple-500 disabled:opacity-50"
          >
            {isStarting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Cpu className="h-4 w-4" />
            )}
            <span>Confirmar Início da Produção 3D</span>
          </button>
        </div>
      </div>
    </div>
  );
};
