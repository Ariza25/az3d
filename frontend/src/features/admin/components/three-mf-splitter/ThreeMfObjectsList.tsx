import React from 'react';
import { Download } from 'lucide-react';
import { ParsedObjectInfo } from '../../../../shared/utils/threeMfSplitter';

interface ThreeMfObjectsListProps {
  objects: ParsedObjectInfo[];
  downloadingId: string | null;
  onDownloadObject: (obj: ParsedObjectInfo) => void;
}

export const ThreeMfObjectsList: React.FC<ThreeMfObjectsListProps> = ({
  objects,
  downloadingId,
  onDownloadObject,
}) => {
  return (
    <div className="space-y-2">
      {objects.map((obj) => {
        const isDownloadingThis = downloadingId === `obj-${obj.id}`;

        return (
          <div
            key={`obj-row-${obj.id}`}
            className="flex items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-chumbo-800 bg-white dark:bg-chumbo-900/50 hover:bg-slate-50 dark:hover:bg-chumbo-900 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-chumbo-800 text-slate-600 dark:text-slate-300 text-xs font-bold shrink-0">
                #{obj.id}
              </div>
              <div className="min-w-0">
                <strong className="block text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                  {obj.name}
                </strong>
                {obj.plateIndex && (
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Pertence à Mesa #{obj.plateIndex}
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => onDownloadObject(obj)}
              disabled={isDownloadingThis}
              className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold bg-slate-900 hover:bg-slate-800 dark:bg-chumbo-800 dark:hover:bg-chumbo-700 text-white transition-all shadow-xs shrink-0 disabled:opacity-50"
            >
              {isDownloadingThis ? (
                <>
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Gerando...</span>
                </>
              ) : (
                <>
                  <Download className="h-3 w-3" />
                  <span>Baixar Peça (.3mf)</span>
                </>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
};
