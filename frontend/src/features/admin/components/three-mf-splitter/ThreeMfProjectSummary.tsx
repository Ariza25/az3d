import React from 'react';
import {
  Boxes,
  FileBox,
  FolderArchive,
  Layers,
  Palette,
} from 'lucide-react';
import { ThreeMfProjectInfo } from '../../../../shared/utils/threeMfSplitter';

export type ThreeMfViewMode = 'plates' | 'colors' | 'objects';

interface ThreeMfProjectSummaryProps {
  project: ThreeMfProjectInfo;
  viewMode: ThreeMfViewMode;
  onSelectViewMode: (mode: ThreeMfViewMode) => void;
  onDownloadAllColorsZip: () => void;
  onDownloadAllPlatesZip: () => void;
  isZippingAll: boolean;
  zipProgress: { percent: number; text: string };
}

export const ThreeMfProjectSummary: React.FC<ThreeMfProjectSummaryProps> = ({
  project,
  viewMode,
  onSelectViewMode,
  onDownloadAllColorsZip,
  onDownloadAllPlatesZip,
  isZippingAll,
  zipProgress,
}) => {
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-chumbo-800 bg-white dark:bg-chumbo-900/60 shadow-sm space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-cyan-600 text-white shadow-md shadow-cyan-600/20">
            <FileBox className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white truncate">
              {project.fileName}
            </h3>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {project.slicer}
              </span>
              <span>•</span>
              <span>{formatFileSize(project.fileSizeBytes)}</span>
              <span>•</span>
              <span className="font-bold text-cyan-600 dark:text-cyan-400">
                {project.plates.length} {project.plates.length === 1 ? 'Mesa' : 'Mesas'}
              </span>
              <span>•</span>
              <span>{project.objects.length} peças</span>
            </div>
          </div>
        </div>

        {/* Ação Principal: Baixar Todas em ZIP */}
        <div className="flex items-center gap-2 self-stretch sm:self-auto shrink-0">
          {viewMode === 'colors' ? (
            <button
              type="button"
              onClick={onDownloadAllColorsZip}
              disabled={isZippingAll}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm bg-amber-600 hover:bg-amber-500 text-white shadow-md shadow-amber-600/30 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isZippingAll ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{zipProgress.percent}% ({zipProgress.text})</span>
                </>
              ) : (
                <>
                  <FolderArchive className="h-4 w-4" />
                  <span>Baixar Todas as Cores (.zip)</span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={onDownloadAllPlatesZip}
              disabled={isZippingAll}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-600/30 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
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
          )}
        </div>
      </div>

      {/* Alternador de Visualização (Mesas vs Cores vs Peças) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100 dark:border-chumbo-800/80 pt-3">
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-chumbo-900 border border-slate-200 dark:border-chumbo-800 text-xs">
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
            onClick={() => onSelectViewMode('colors')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
              viewMode === 'colors'
                ? 'bg-white dark:bg-chumbo-800 text-amber-600 dark:text-amber-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Palette className="h-3.5 w-3.5 text-amber-500" />
            <span>Por Cor / Filamento ({project.colorGroups.length})</span>
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
            <span>Peças ({project.objects.length})</span>
          </button>
        </div>

        <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:inline-block">
          Pronto para abrir diretamente no Bambu Studio ou OrcaSlicer
        </span>
      </div>
    </div>
  );
};
