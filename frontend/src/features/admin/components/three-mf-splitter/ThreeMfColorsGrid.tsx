import React from 'react';
import { Download, Palette } from 'lucide-react';
import { ColorGroupInfo } from '../../../../shared/utils/threeMfSplitter';

interface ThreeMfColorsGridProps {
  colorGroups: ColorGroupInfo[];
  downloadingId: string | null;
  onDownloadColor: (cg: ColorGroupInfo) => void;
}

export const ThreeMfColorsGrid: React.FC<ThreeMfColorsGridProps> = ({
  colorGroups,
  downloadingId,
  onDownloadColor,
}) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 text-xs">
        <div className="flex items-center gap-2">
          <Palette className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>
            <strong>Agrupamento Inteligente por Cor:</strong> Peças agrupadas pelo filamento configurado ou pelas cores detectadas. Cada mesa abaixo contém apenas as peças da respectiva cor!
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {colorGroups.map((cg) => {
          const isDownloadingThis = downloadingId === `color-${cg.filamentId}`;

          return (
            <div
              key={`color-${cg.filamentId}-${cg.colorHex}`}
              className="flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 dark:border-chumbo-800 bg-white dark:bg-chumbo-900/50 hover:border-amber-500/50 transition-all duration-200 shadow-sm hover:shadow-lg group"
            >
              <div className="p-5 space-y-4">
                {/* Cabeçalho do Card com Amostra da Cor */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-10 h-10 rounded-xl shadow-md border-2 border-white dark:border-chumbo-700 shrink-0 ring-2 ring-slate-200 dark:ring-chumbo-800 flex items-center justify-center"
                      style={{ backgroundColor: cg.colorHex }}
                    >
                      <span className="sr-only">{cg.colorName}</span>
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-extrabold text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                        {cg.colorName}
                      </h4>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                        <span>{cg.colorHex}</span>
                        {cg.filamentType && (
                          <>
                            <span>•</span>
                            <span className="font-semibold text-slate-600 dark:text-slate-300">{cg.filamentType}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-slate-100 dark:bg-chumbo-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-chumbo-700 shrink-0">
                    Filamento #{cg.filamentId}
                  </span>
                </div>

                {/* Contagem e Lista de Peças */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span className="text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Peças desta cor:
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 text-[10px]">
                      {cg.objects.length} {cg.objects.length === 1 ? 'peça' : 'peças'}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto pr-1">
                    {cg.objects.map((obj, oIdx) => (
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
              </div>

              {/* Botão de Download desta Cor */}
              <div className="p-4 pt-0">
                <button
                  type="button"
                  onClick={() => onDownloadColor(cg)}
                  disabled={isDownloadingThis}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white transition-all shadow-sm shadow-amber-600/20 active:scale-95 disabled:opacity-50"
                >
                  {isDownloadingThis ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Gerando .3mf...</span>
                    </>
                  ) : (
                    <>
                      <Download className="h-3.5 w-3.5" />
                      <span>Baixar Mesa Desta Cor (.3mf)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
