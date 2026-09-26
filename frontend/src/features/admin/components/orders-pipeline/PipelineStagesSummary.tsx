import React from 'react';
import { Order } from '../../../../types';
import { STAGES, resolveOrderStageId } from './pipelineUtils';

interface PipelineStagesSummaryProps {
  orders: Order[];
  filterStatus: string;
  onSelectStage: (stageId: string) => void;
}

export const PipelineStagesSummary: React.FC<PipelineStagesSummaryProps> = ({
  orders,
  filterStatus,
  onSelectStage,
}) => {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {STAGES.map((stage) => {
        const count = orders.filter((o) => resolveOrderStageId(o) === stage.id).length;
        const isActive = filterStatus === stage.id;
        return (
          <button
            key={stage.id}
            type="button"
            onClick={() => onSelectStage(isActive ? 'all' : stage.id)}
            className={`rounded-xl border p-3 text-left transition-all shadow-sm ${
              isActive
                ? `${stage.color} ring-2 ring-cyan-600 dark:ring-laser-400`
                : 'border-slate-200 bg-white hover:border-slate-300 dark:border-chumbo-800 dark:bg-chumbo-900/40 dark:hover:border-chumbo-700'
            }`}
          >
            <span className={`block text-[11px] font-medium ${isActive ? 'text-white' : 'text-slate-600 dark:text-slate-400'}`}>
              {stage.label}
            </span>
            <strong className={`mt-1 block text-xl font-extrabold ${isActive ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
              {count}
            </strong>
          </button>
        );
      })}
    </div>
  );
};
