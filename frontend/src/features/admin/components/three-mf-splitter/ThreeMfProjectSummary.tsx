import React from 'react';
import {
  Boxes,
  FileBox,
  FolderArchive,
  Layers,
  Palette,
  PackageCheck,
} from 'lucide-react';
import { ThreeMfProjectInfo, SplitPartMesh } from '../../../../shared/utils/threeMfSplitter';

export type ThreeMfViewMode = 'split3d' | 'plates' | 'colors' | 'objects';

interface ThreeMfProjectSummaryProps {
  project: ThreeMfProjectInfo;
  activeParts: SplitPartMesh[];
  viewMode: ThreeMfViewMode;
  onSelectViewMode: (mode: ThreeMfViewMode) => void;
  onDownloadSplitPartsZip: (format: '3mf' | 'stl') => void;
  onDownloadUnified3Mf: () => void;
  onDownloadAllPlatesZip: () => void;
  isZippingAll: boolean;
  zipProgress: { percent: number; text: string };
}

export const ThreeMfProjectSummary: React.FC<ThreeMfProjectSummaryProps> = ({
  project,
  activeParts,
  viewMode,
  onSelectViewMode,
  onDownloadSplitPartsZip,
  onDownloadUnified3Mf,
  onDownloadAllPlatesZip,
  isZippingAll,
  zipProgress,
}) => {
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const visiblePartsCount = activeParts.filter((p) => p.visible).length;

  return (
    <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-chumbo-800 bg-white dark:bg-chumbo-900/60 shadow-sm space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-cyan-600 text-white shadow-md shadow-cyan-600/20">
            <FileBox className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white truncate">
                {project.fileName}
              </h3>
              {project.hadPaintedTriangles && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                  Pintura 3MF Subdividida
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {project.slicer}
              </span>
              <span>•</span>
              <span>{formatFileSize(project.fileSizeBytes)}</span>
              <span>•</span>
              <span className="font-bold text-amber-600 dark:text-amber-400">
                {activeParts.length} {activeParts.length === 1 ? 'Peça / Cor' : 'Peças / Cores'}
              </span>
              {project.inputFormat === '3mf' && (
                <>
                  <span>•</span>
                  <span className="font-bold text-cyan-600 dark:text-cyan-400">
                    {project.plates.length} {project.plates.length === 1 ? 'Mesa' : 'Mesas'}
                  </span>
                </>
              )}
              <span>•</span>
              <span>{project.totalTriangles.toLocaleString()} faces</span>
            </div>
          </div>
        </div>

        {/* Botões Principais de Exportação */}
        <div className="flex flex-wrap items-center gap-2 self-stretch lg:self-auto shrink-0">
          {viewMode === 'plates' ? (
            <button
              type="button"
              onClick={onDownloadAllPlatesZip}
              disabled={isZippingAll}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-extrabold text-xs bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-600/30 transition-all active:scale-95 disabled:opacity-50"
            >
              {isZippingAll ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{zipProgress.percent}% ({zipProgress.text})</span>
                </>
              ) : (
                <>
                  <FolderArchive className="h-4 w-4" />
                  <span>Baixar Todas as Mesas (.zip)</span>
                </>
              )}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onDownloadSplitPartsZip('3mf')}
                disabled={isZippingAll || visiblePartsCount === 0}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl font-extrabold text-xs bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-600/25 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {isZippingAll ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>{zipProgress.percent}%</span>
                  </>
                ) : (
                  <>
                    <FolderArchive className="h-4 w-4" />
                    <span>ZIP Peças (.3MF)</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => onDownloadSplitPartsZip('stl')}
                disabled={isZippingAll || visiblePartsCount === 0}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl font-bold text-xs border border-slate-300 dark:border-chumbo-700 bg-slate-50 dark:bg-chumbo-800 hover:bg-slate-100 dark:hover:bg-chumbo-700 text-slate-800 dark:text-slate-100 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <FolderArchive className="h-3.5 w-3.5 text-amber-500" />
                <span>ZIP (.STL)</span>
              </button>

              <button
                type="button"
                onClick={onDownloadUnified3Mf}
                disabled={isZippingAll || visiblePartsCount === 0}
                title="Baixa um único arquivo .3MF contendo todas as peças separadas e coloridas para o Bambu Studio"
                className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/25 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <PackageCheck className="h-4 w-4" />
                <span>.3MF Unificado</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Alternador de Modos */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100 dark:border-chumbo-800/80 pt-3">
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-chumbo-900 border border-slate-200 dark:border-chumbo-800 text-xs">
          <button
            type="button"
            onClick={() => onSelectViewMode('split3d')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
              viewMode === 'split3d'
                ? 'bg-white dark:bg-chumbo-800 text-cyan-700 dark:text-cyan-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Palette className="h-3.5 w-3.5 text-amber-500" />
            <span>Estúdio Split3MF 3D ({activeParts.length})</span>
          </button>

          {project.inputFormat === '3mf' && (
            <>
              <button
                type="button"
                onClick={() => onSelectViewMode('plates')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
                  viewMode === 'plates'
                    ? 'bg-white dark:bg-chumbo-800 text-cyan-700 dark:text-cyan-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                <span>Mesas Originais ({project.plates.length})</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectViewMode('objects')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
                  viewMode === 'objects'
                    ? 'bg-white dark:bg-chumbo-800 text-cyan-700 dark:text-cyan-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Boxes className="h-3.5 w-3.5" />
                <span>Objetos XML ({project.objects.length})</span>
              </button>
            </>
          )}
        </div>

        <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:inline-block">
          Malhas sólidas estanques prontas para imprimir sem AMS ou com encaixes
        </span>
      </div>
    </div>
  );
};
