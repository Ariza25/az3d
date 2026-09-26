import React, { useRef } from 'react';
import {
  CheckCircle2,
  FileArchive,
  Layers,
  Sparkles,
  Upload,
} from 'lucide-react';

interface ThreeMfUploadZoneProps {
  isParsing: boolean;
  isDragging: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onFileSelect: (file: File) => void;
}

export const ThreeMfUploadZone: React.FC<ThreeMfUploadZoneProps> = ({
  isParsing,
  isDragging,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileSelect,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(e.target.files[0]);
    }
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center p-8 sm:p-14 border-2 border-dashed rounded-3xl cursor-pointer transition-all duration-200 text-center ${
          isDragging
            ? 'border-cyan-500 bg-cyan-50/60 dark:bg-cyan-950/40 scale-[1.01]'
            : 'border-slate-300 dark:border-chumbo-700 hover:border-cyan-500/70 hover:bg-slate-50 dark:hover:bg-chumbo-900/40'
        } ${isParsing ? 'pointer-events-none opacity-60' : ''}`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={onFileChange}
          accept=".3mf"
          className="hidden"
        />

        {isParsing ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="h-10 w-10 border-3 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
              Analisando geometria e mesas do .3MF...
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Processando 100% no seu navegador (sem limite de envio).
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3.5 max-w-md">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 shadow-inner">
              <Upload className="h-8 w-8" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                Arraste o arquivo .3MF aqui
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                ou clique para procurar no seu computador.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-chumbo-800/80 border border-slate-200 dark:border-chumbo-700 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              <Sparkles className="h-3.5 w-3.5 text-cyan-500" />
              <span>Suporta projetos com 1 a 20+ mesas de Bambu Lab, OrcaSlicer e Prusa</span>
            </div>
          </div>
        )}
      </div>

      {/* Dicas e Recursos */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
        <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-chumbo-800 bg-white dark:bg-chumbo-900/40 space-y-1">
          <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            Zero Upload
          </span>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Seus modelos são processados na memória local do navegador com total privacidade e velocidade.
          </p>
        </div>
        <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-chumbo-800 bg-white dark:bg-chumbo-900/40 space-y-1">
          <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <Layers className="h-4 w-4 text-cyan-500" />
            Divisão por Mesas
          </span>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Cada prato/mesa é isolado em um .3mf independente com geometria e metadados preservados.
          </p>
        </div>
        <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-chumbo-800 bg-white dark:bg-chumbo-900/40 space-y-1">
          <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <FileArchive className="h-4 w-4 text-amber-500" />
            Download em ZIP
          </span>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Baixe mesas específicas ou empacote todas as mesas divididas de uma só vez em um arquivo .zip.
          </p>
        </div>
      </div>
    </div>
  );
};
