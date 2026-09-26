import React, { useRef } from 'react';
import { CheckCircle2, Loader2, SlidersHorizontal, UploadCloud } from 'lucide-react';
import { Parsed3MFResult } from '../../../../types';

interface ProductThreeMfUploaderProps {
  isParsing3MF: boolean;
  isDragging3MF: boolean;
  parsed3MF: Parsed3MFResult | null;
  hasSlicerSettings: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onFileSelect: (file: File) => void;
  onOpenDetailsModal: () => void;
  formatPrintDuration: (minutes: number) => string;
}

export const ProductThreeMfUploader: React.FC<ProductThreeMfUploaderProps> = ({
  isParsing3MF,
  isDragging3MF,
  parsed3MF,
  hasSlicerSettings,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileSelect,
  onOpenDetailsModal,
  formatPrintDuration,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="rounded-2xl border border-cyan-800/40 bg-cyan-950/20 p-4 space-y-3 dark:border-laser-500/30 dark:bg-laser-950/20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold uppercase text-cyan-400 dark:text-laser-400">
            Importar Arquivo .3MF do Fatiador
          </span>
          <span className="rounded-md bg-cyan-900/50 px-2 py-0.5 text-[10px] font-mono font-semibold text-cyan-300 border border-cyan-700/50 dark:bg-laser-500/20 dark:text-laser-300 dark:border-laser-500/30">
            Opcional
          </span>
        </div>
        {hasSlicerSettings && (
          <button
            type="button"
            onClick={onOpenDetailsModal}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-400 hover:text-cyan-300 underline underline-offset-4 dark:text-laser-300 dark:hover:text-laser-200 transition-colors"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>Ver ficha técnica salva</span>
          </button>
        )}
      </div>

      <p className="text-xs text-slate-400">
        Se desejar preencher automaticamente peso, tempo, resolução, dimensões e configurações técnicas, arraste ou selecione o arquivo <strong>.3MF</strong> (Bambu Studio, OrcaSlicer ou PrusaSlicer) abaixo:
      </p>

      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 text-center transition-all ${
          isDragging3MF
            ? 'border-cyan-400 bg-cyan-900/30 dark:border-laser-400 dark:bg-laser-500/20'
            : 'border-chumbo-700 bg-chumbo-950/60 hover:border-cyan-500/60 hover:bg-chumbo-950/90 dark:border-chumbo-700 dark:hover:border-laser-500/60'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".3mf"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              onFileSelect(e.target.files[0]);
            }
          }}
        />
        {isParsing3MF ? (
          <div className="flex items-center gap-2 text-xs font-semibold text-cyan-400 dark:text-laser-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Lendo dados e configurações do arquivo .3MF...</span>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <UploadCloud className="h-5 w-5 text-cyan-400 dark:text-laser-400" />
            <span className="text-xs text-slate-300">
              Clique ou arraste o <strong>.3MF</strong> para auto-preencher os dados técnicos
            </span>
          </div>
        )}
      </div>

      {parsed3MF && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cyan-700/40 bg-cyan-950/40 p-3 shadow-inner dark:border-laser-500/30 dark:bg-laser-950/40">
          <div className="flex items-center gap-3">
            {parsed3MF.thumbnail_base64 ? (
              <img
                src={parsed3MF.thumbnail_base64}
                alt="Miniatura .3MF"
                className="h-12 w-12 rounded-lg object-cover border border-cyan-600/40 shadow-sm shrink-0"
              />
            ) : (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
            )}
            <div className="text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white">{parsed3MF.file_name}</span>
                <span className="rounded-md bg-cyan-900/60 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-cyan-300 dark:bg-laser-500/20 dark:text-laser-300">
                  {parsed3MF.slicer_detected || 'Fatiador 3MF'}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-mono text-slate-300">
                {parsed3MF.product_weight_grams > 0 && (
                  <span>
                    Peso: <strong className="text-white">{Math.round(parsed3MF.product_weight_grams)}g</strong>
                  </span>
                )}
                {parsed3MF.print_minutes > 0 && (
                  <span>
                    • Tempo: <strong className="text-white">{formatPrintDuration(parsed3MF.print_minutes)}</strong>
                  </span>
                )}
                {parsed3MF.dimensions && (
                  <span>
                    • Dimensões: <strong className="text-white">{parsed3MF.dimensions}</strong>
                  </span>
                )}
                {parsed3MF.material && (
                  <span>
                    • Material: <strong className="text-white">{parsed3MF.material}</strong>
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenDetailsModal}
            className="flex items-center gap-1.5 rounded-xl border border-cyan-500/50 bg-cyan-500/20 px-3 py-1.5 text-xs font-bold text-cyan-200 hover:bg-cyan-500/30 dark:border-laser-400/40 dark:bg-laser-500/20 dark:text-laser-200 dark:hover:bg-laser-500/30 transition-colors"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>Ver detalhes</span>
          </button>
        </div>
      )}
    </div>
  );
};
