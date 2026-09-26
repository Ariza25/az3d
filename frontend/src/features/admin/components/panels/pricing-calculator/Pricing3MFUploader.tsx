import React, { useRef, useState } from 'react';
import {
  CheckCircle2,
  Loader2,
  SlidersHorizontal,
  UploadCloud,
  X,
} from 'lucide-react';
import { Parsed3MFResult } from '../../../../../types';
import { formatPrintDuration } from '../../../../../utils/printingPricing';

interface Pricing3MFUploaderProps {
  isParsing3MF: boolean;
  parsed3MFInfo: Parsed3MFResult | null;
  onUploadFile: (file: File) => void;
  onClearParsedInfo: () => void;
  onOpenDetails: () => void;
}

export const Pricing3MFUploader: React.FC<Pricing3MFUploaderProps> = ({
  isParsing3MF,
  parsed3MFInfo,
  onUploadFile,
  onClearParsedInfo,
  onOpenDetails,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <span className="text-[10px] font-mono font-bold uppercase text-slate-600 dark:text-slate-400">
          2. Importar arquivo .3MF (Bambu / Orca / Prusa)
        </span>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
              onUploadFile(e.dataTransfer.files[0]);
            }
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-3 text-center transition-all ${
            isDragging
              ? 'border-cyan-500 bg-cyan-50/50 dark:border-laser-400 dark:bg-laser-500/10'
              : 'border-slate-300 bg-slate-50/60 hover:bg-slate-100/80 dark:border-chumbo-800 dark:bg-chumbo-950/40 dark:hover:bg-chumbo-900/40'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".3mf"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                onUploadFile(e.target.files[0]);
              }
            }}
          />
          {isParsing3MF ? (
            <div className="flex items-center gap-2 text-xs font-semibold text-cyan-700 dark:text-laser-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Lendo dados de fatiamento do .3MF...</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <UploadCloud className="h-4 w-4 text-cyan-600 dark:text-laser-400" />
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Clique ou arraste o <strong>.3MF</strong> para auto-preencher
              </span>
            </div>
          )}
        </div>
      </div>

      {parsed3MFInfo && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cyan-300 bg-cyan-50/80 p-3 shadow-sm dark:border-laser-500/40 dark:bg-laser-500/10">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <div className="text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 dark:text-white">
                  {parsed3MFInfo.file_name}
                </span>
                <span className="rounded-md bg-cyan-100 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-cyan-800 dark:bg-laser-500/20 dark:text-laser-300">
                  {parsed3MFInfo.slicer_detected || 'Fatiador 3MF'}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-mono text-slate-600 dark:text-slate-300">
                {parsed3MFInfo.product_weight_grams > 0 && (
                  <span>
                    Filamento: <strong className="text-slate-900 dark:text-white">{parsed3MFInfo.product_weight_grams} g</strong>
                  </span>
                )}
                {parsed3MFInfo.print_minutes > 0 && (
                  <span>
                    • Tempo: <strong className="text-slate-900 dark:text-white">{formatPrintDuration(parsed3MFInfo.print_minutes)}</strong>
                  </span>
                )}
                {parsed3MFInfo.dimensions && (
                  <span>
                    • Dimensões: <strong className="text-slate-900 dark:text-white">{parsed3MFInfo.dimensions}</strong>
                  </span>
                )}
                {parsed3MFInfo.layer_height && (
                  <span>
                    • Camada: <strong className="text-slate-900 dark:text-white">{parsed3MFInfo.layer_height}</strong>
                  </span>
                )}
                {parsed3MFInfo.material && (
                  <span>
                    • Material: <strong className="text-slate-900 dark:text-white">{parsed3MFInfo.material}</strong>
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenDetails}
              className="flex items-center gap-1.5 rounded-lg border border-cyan-300 bg-white px-2.5 py-1 text-xs font-semibold text-cyan-800 shadow-xs hover:bg-cyan-100/70 dark:border-laser-500/40 dark:bg-chumbo-950 dark:text-laser-300 dark:hover:bg-chumbo-900 transition-colors"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Ver detalhes</span>
            </button>
            <button
              type="button"
              onClick={onClearParsedInfo}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-200/50 hover:text-slate-600 dark:hover:bg-chumbo-800 dark:hover:text-slate-200"
              title="Fechar resumo do 3MF"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
