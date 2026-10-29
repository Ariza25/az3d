import React, { useRef } from 'react';
import {
  CheckCircle2,
  Layers,
  Scissors,
  Sparkles,
  Upload,
  Palette,
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
          accept=".3mf,.stl,.obj"
          className="hidden"
        />

        {isParsing ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="h-10 w-10 border-3 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
              Subdividindo pintura 3MF e fechando malhas sólidas (Watertight)...
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Processando 100% localmente no seu navegador com privacidade total.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3.5 max-w-lg">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 shadow-inner">
              <Upload className="h-8 w-8" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                Arraste seu arquivo .3MF, .STL ou .OBJ aqui
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                Separe modelos multicor pintados no Bambu Studio / PrusaSlicer em peças sólidas de encaixe sem precisar de AMS!
              </p>
            </div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 dark:bg-chumbo-800/80 border border-slate-200 dark:border-chumbo-700 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              <Sparkles className="h-3.5 w-3.5 text-cyan-500" />
              <span>Suporta pintura `paint_color`, sub-modelos Bambu, Corte Plano + Pinos e Multi-Mesas</span>
            </div>
          </div>
        )}
      </div>

      {/* Recursos estilo Split3MF */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
        <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-chumbo-800 bg-white dark:bg-chumbo-900/40 space-y-1">
          <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <Palette className="h-4 w-4 text-amber-500" />
            Split Real por Pintura 3D
          </span>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Decodifica a árvore de subdivisão de triângulos pintados do Bambu Studio e fecha as costuras com encaixe estanque.
          </p>
        </div>
        <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-chumbo-800 bg-white dark:bg-chumbo-900/40 space-y-1">
          <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <Scissors className="h-4 w-4 text-cyan-500" />
            Corte Plano + Pinos & Folga
          </span>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Divida peças grandes em planos X/Y/Z gerando pinos macho e furos fêmea com tolerância ajustável em milímetros.
          </p>
        </div>
        <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-chumbo-800 bg-white dark:bg-chumbo-900/40 space-y-1">
          <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            100% Local + Multi-Formato
          </span>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Layers className="h-3 w-3 shrink-0 inline" />
            Exporte peças individuais (.3MF/.STL), pacote .ZIP, montagem .3MF unificada ou mesas separadas.
          </p>
        </div>
      </div>
    </div>
  );
};
