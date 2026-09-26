import React from 'react';
import { Download, Layers } from 'lucide-react';
import { PlateInfo } from '../../../../shared/utils/threeMfSplitter';

interface ThreeMfPlatesGridProps {
  plates: PlateInfo[];
  downloadingId: string | null;
  onDownloadPlate: (plate: PlateInfo) => void;
}

export const ThreeMfPlatesGrid: React.FC<ThreeMfPlatesGridProps> = ({
  plates,
  downloadingId,
  onDownloadPlate,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {plates.map((plate) => {
        const isDownloadingThis = downloadingId === `plate-${plate.plateIndex}`;

        return (
          <div
            key={`plate-${plate.plateIndex}`}
            className="flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 dark:border-chumbo-800 bg-white dark:bg-chumbo-900/50 hover:border-cyan-500/40 dark:hover:border-cyan-500/40 transition-all duration-200 shadow-sm hover:shadow-lg group"
          >
            <div>
              {/* Miniatura da Mesa */}
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100 dark:bg-chumbo-950 flex items-center justify-center border-b border-slate-100 dark:border-chumbo-800/80">
                {plate.thumbnailUrl ? (
                  <img
                    src={plate.thumbnailUrl}
                    alt={plate.name}
                    className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-1.5 text-slate-400 dark:text-slate-600">
                    <Layers className="h-10 w-10 stroke-1" />
                    <span className="text-[10px] font-mono uppercase tracking-wider">Mesa #{plate.plateIndex}</span>
                  </div>
                )}

                {/* Badge de Número da Mesa */}
                <div className="absolute top-2.5 left-2.5">
                  <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-slate-900/85 text-white backdrop-blur-sm shadow-xs border border-white/10">
                    Mesa #{plate.plateIndex}
                  </span>
                </div>

                {/* Contagem de Peças na Mesa */}
                <div className="absolute top-2.5 right-2.5">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white/90 dark:bg-chumbo-900/90 text-slate-700 dark:text-slate-300 backdrop-blur-sm border border-slate-200/60 dark:border-chumbo-700">
                    {plate.objects.length} {plate.objects.length === 1 ? 'peça' : 'peças'}
                  </span>
                </div>
              </div>

              {/* Informações da Mesa */}
              <div className="p-4 space-y-2.5">
                <h4 className="text-sm font-extrabold text-slate-900 dark:text-white leading-tight">
                  {plate.name}
                </h4>

                {/* Lista de Peças presentes na Mesa */}
                {plate.objects.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                      Itens na mesa:
                    </span>
                    <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
                      {plate.objects.map((obj, oIdx) => (
                        <span
                          key={oIdx}
                          className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-chumbo-800 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-chumbo-700/60 truncate max-w-full"
                          title={obj.name}
                        >
                          {obj.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Botão de Download da Mesa */}
            <div className="p-4 pt-0">
              <button
                type="button"
                onClick={() => onDownloadPlate(plate)}
                disabled={isDownloadingThis}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 dark:bg-chumbo-800 dark:hover:bg-chumbo-700 text-white transition-all shadow-sm active:scale-95 disabled:opacity-50"
              >
                {isDownloadingThis ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Gerando .3mf...</span>
                  </>
                ) : (
                  <>
                    <Download className="h-3.5 w-3.5" />
                    <span>Baixar Mesa (.3mf)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
