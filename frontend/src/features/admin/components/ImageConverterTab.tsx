import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, Download, Trash2, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '../../../components/ui';

export interface ConvertedItem {
  id: string;
  file: File;
  originalName: string;
  originalWidth: number;
  originalHeight: number;
  originalSizeMb: number;
  dataUrl: string;
  blob: Blob;
  outputWidth: number;
  outputHeight: number;
  outputSizeMb: number;
  status: 'pending' | 'processing' | 'done';
}

export type FitMode = 'cover' | 'stretch' | 'contain-white' | 'contain-dark' | 'contain-transparent';
export type OutputFormat = 'image/jpeg' | 'image/png' | 'image/webp';

export const ImageConverterTab: React.FC = () => {
  const [items, setItems] = useState<ConvertedItem[]>([]);
  const [targetWidth, setTargetWidth] = useState<number>(1200);
  const [targetHeight, setTargetHeight] = useState<number>(1200);
  const [fitMode, setFitMode] = useState<FitMode>('cover');
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('image/jpeg');
  const [preset, setPreset] = useState<string>('ml-square');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePresetChange = (presetKey: string) => {
    setPreset(presetKey);
    if (presetKey === 'ml-square') {
      setTargetWidth(1200);
      setTargetHeight(1200);
    } else if (presetKey === 'ml-vertical') {
      setTargetWidth(1200);
      setTargetHeight(1540);
    } else if (presetKey === 'shopee-square') {
      setTargetWidth(1080);
      setTargetHeight(1080);
    }
  };

  const processFile = (
    file: File,
    w: number = targetWidth,
    h: number = targetHeight,
    mode: FitMode = fitMode,
    fmt: OutputFormat = outputFormat
  ): Promise<ConvertedItem> => {
    return new Promise((resolve) => {
      const id = Math.random().toString(36).substring(2, 9);
      const originalSizeMb = parseFloat((file.size / (1024 * 1024)).toFixed(2));

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');

          if (ctx) {
            // Fundo
            if (mode === 'contain-white') {
              ctx.fillStyle = '#FFFFFF';
              ctx.fillRect(0, 0, w, h);
            } else if (mode === 'contain-dark') {
              ctx.fillStyle = '#0f172a';
              ctx.fillRect(0, 0, w, h);
            } else if (mode === 'contain-transparent') {
              ctx.clearRect(0, 0, w, h);
            }

            const imgRatio = img.width / img.height;
            const targetRatio = w / h;

            let drawWidth = w;
            let drawHeight = h;
            let drawX = 0;
            let drawY = 0;

            if (mode === 'cover') {
              // Preencher 100% da área sem NENHUMA borda branca
              if (imgRatio > targetRatio) {
                drawHeight = h;
                drawWidth = h * imgRatio;
                drawX = (w - drawWidth) / 2;
              } else {
                drawWidth = w;
                drawHeight = w / imgRatio;
                drawY = (h - drawHeight) / 2;
              }
            } else if (mode === 'stretch') {
              // Esticar preenchendo exatamente 100% da área
              drawWidth = w;
              drawHeight = h;
              drawX = 0;
              drawY = 0;
            } else {
              // Contain mode (com margens)
              if (imgRatio > targetRatio) {
                drawWidth = w;
                drawHeight = w / imgRatio;
                drawY = (h - drawHeight) / 2;
              } else {
                drawHeight = h;
                drawWidth = h * imgRatio;
                drawX = (w - drawWidth) / 2;
              }
            }

            ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);

            const quality = fmt === 'image/jpeg' ? 0.92 : 0.95;
            canvas.toBlob(
              (blob) => {
                if (blob) {
                  const dataUrl = canvas.toDataURL(fmt, quality);
                  const outputSizeMb = parseFloat((blob.size / (1024 * 1024)).toFixed(2));
                  resolve({
                    id,
                    file,
                    originalName: file.name,
                    originalWidth: img.width,
                    originalHeight: img.height,
                    originalSizeMb,
                    dataUrl,
                    blob,
                    outputWidth: w,
                    outputHeight: h,
                    outputSizeMb,
                    status: 'done',
                  });
                }
              },
              fmt,
              quality
            );
          }
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const reprocessAllItems = async () => {
    if (items.length === 0) return;
    setIsProcessing(true);
    const updated: ConvertedItem[] = [];
    for (const item of items) {
      const newItem = await processFile(item.file, targetWidth, targetHeight, fitMode, outputFormat);
      newItem.id = item.id;
      updated.push(newItem);
    }
    setItems(updated);
    setIsProcessing(false);
  };

  useEffect(() => {
    if (items.length > 0) {
      void reprocessAllItems();
    }
  }, [targetWidth, targetHeight, fitMode, outputFormat]);

  const handleFilesAdded = async (filesList: FileList | File[]) => {
    const validFiles = Array.from(filesList).filter((file) => file.type.startsWith('image/'));
    if (validFiles.length === 0) return;

    setIsProcessing(true);
    const convertedResults: ConvertedItem[] = [];
    for (const file of validFiles) {
      const result = await processFile(file);
      convertedResults.push(result);
    }
    setItems((prev) => [...convertedResults, ...prev]);
    setIsProcessing(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void handleFilesAdded(e.dataTransfer.files);
    }
  };

  const handleDownloadSingle = (item: ConvertedItem) => {
    const extension = outputFormat === 'image/png' ? 'png' : outputFormat === 'image/webp' ? 'webp' : 'jpg';
    const cleanName = item.originalName.replace(/\.[^/.]+$/, '');
    const filename = `${cleanName}_ml_${targetWidth}x${targetHeight}.${extension}`;

    const link = document.createElement('a');
    link.href = item.dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadAll = () => {
    items.forEach((item, index) => {
      setTimeout(() => {
        handleDownloadSingle(item);
      }, index * 250);
    });
  };

  const handleClearAll = () => {
    setItems([]);
  };

  const handleRemoveSingle = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-laser-500/30 bg-chumbo-950/80 p-5 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-laser-400/20 text-laser-400 border border-laser-400/30">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-white">Formatador de Imagens sem Bordas para Mercado Livre</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Converte e preenche 100% da área sem bordas para o padrão oficial <strong className="text-white">1200 x 1540 px</strong>. 100% no seu navegador (sem salvar no servidor).
            </p>
          </div>
        </div>

        {items.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleClearAll}
              className="flex items-center gap-1.5 rounded-xl border border-chumbo-700 bg-chumbo-900 px-3.5 py-2 text-xs font-bold text-slate-300 hover:bg-chumbo-800 hover:text-white transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              Limpar lista
            </button>
            <Button
              type="button"
              variant="primary"
              icon={<Download className="h-4 w-4" />}
              onClick={handleDownloadAll}
            >
              Baixar Todas ({items.length})
            </Button>
          </div>
        )}
      </div>

      {/* Opções de Redimensionamento */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-chumbo-800 bg-chumbo-900/60 p-4 space-y-2">
          <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 font-bold">
            Formato / Resolução Alvo
          </label>
          <select
            value={preset}
            onChange={(e) => handlePresetChange(e.target.value)}
            className="w-full rounded-xl border border-chumbo-700 bg-chumbo-950 px-3 py-2 text-xs font-bold text-white focus:border-laser-500 focus:outline-none"
          >
            <option value="ml-square">Fotos 1:1 Quadrado HD (1200 x 1200 px — Padrão Ouro ML / Shopee / Amazon)</option>
            <option value="shopee-square">Vídeos / Mídias ML & Instagram (1080 x 1080 px)</option>
            <option value="ml-vertical">Mercado Livre Moda (1200 x 1540 px)</option>
            <option value="custom">Personalizado</option>
          </select>

          {preset === 'custom' && (
            <div className="grid grid-cols-2 gap-2 pt-2">
              <div>
                <span className="text-[10px] text-slate-400 font-mono">Largura (px)</span>
                <input
                  type="number"
                  value={targetWidth}
                  onChange={(e) => setTargetWidth(Number(e.target.value) || 1200)}
                  className="w-full rounded-lg border border-chumbo-700 bg-chumbo-950 px-2 py-1.5 text-xs text-white"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-mono">Altura (px)</span>
                <input
                  type="number"
                  value={targetHeight}
                  onChange={(e) => setTargetHeight(Number(e.target.value) || 1540)}
                  className="w-full rounded-lg border border-chumbo-700 bg-chumbo-950 px-2 py-1.5 text-xs text-white"
                />
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-chumbo-800 bg-chumbo-900/60 p-4 space-y-2">
          <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 font-bold">
            Modo de Enquadramento (Bordas)
          </label>
          <select
            value={fitMode}
            onChange={(e) => setFitMode(e.target.value as FitMode)}
            className="w-full rounded-xl border border-chumbo-700 bg-chumbo-950 px-3 py-2 text-xs font-bold text-white focus:border-laser-500 focus:outline-none"
          >
            <option value="cover">Preencher Sem Bordas (Zoom/Corte - Recomendado)</option>
            <option value="stretch">Esticar Total Sem Bordas (Preenchimento 100%)</option>
            <option value="contain-white">Ajustar com Bordas Brancas (Margem)</option>
            <option value="contain-dark">Ajustar com Bordas Escuras (AZ3D)</option>
            <option value="contain-transparent">Ajustar com Fundo Transparente (PNG)</option>
          </select>
        </div>

        <div className="rounded-2xl border border-chumbo-800 bg-chumbo-900/60 p-4 space-y-2">
          <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 font-bold">
            Formato de Saída
          </label>
          <select
            value={outputFormat}
            onChange={(e) => setOutputFormat(e.target.value as OutputFormat)}
            className="w-full rounded-xl border border-chumbo-700 bg-chumbo-950 px-3 py-2 text-xs font-bold text-white focus:border-laser-500 focus:outline-none"
          >
            <option value="image/jpeg">JPEG (.jpg) — 92% Qualidade</option>
            <option value="image/png">PNG (.png) — Transparência & Sem Perdas</option>
            <option value="image/webp">WebP (.webp) — Leve & Otimizado</option>
          </select>
        </div>
      </div>

      {/* Area de Dropzone de Imagens */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className="relative cursor-pointer rounded-2xl border-2 border-dashed border-chumbo-700 bg-chumbo-950/70 p-8 text-center transition-all hover:border-laser-400 hover:bg-chumbo-900/50 group"
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files && void handleFilesAdded(e.target.files)}
        />
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-chumbo-700 bg-chumbo-900 text-laser-400 transition-transform group-hover:scale-110">
          {isProcessing ? (
            <Loader2 className="h-7 w-7 animate-spin" />
          ) : (
            <UploadCloud className="h-7 w-7" />
          )}
        </div>
        <h4 className="mt-4 text-sm font-extrabold text-white">
          {isProcessing ? 'Formatando lote de imagens...' : 'Arraste e solte fotos de produtos aqui em lote'}
        </h4>
        <p className="mt-1 text-xs text-slate-400">
          Sem bordas · Formatação automática para{' '}
          <strong className="text-laser-400">{targetWidth} x {targetHeight} px</strong> ({fitMode === 'cover' ? 'Preenchimento sem bordas' : fitMode === 'stretch' ? 'Esticado sem bordas' : 'Ajustado'}).
        </p>
      </div>

      {/* Lista de Imagens Processadas */}
      {items.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
            <span>Imagens Formatadas Sem Bordas ({items.length})</span>
            <span>Pronto para Download</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex flex-col justify-between overflow-hidden rounded-2xl border border-chumbo-800 bg-chumbo-950 p-3 shadow-lg transition-all hover:border-chumbo-700"
              >
                <div className="flex items-center gap-3">
                  <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-xl border border-chumbo-800 bg-chumbo-900">
                    <img
                      src={item.dataUrl}
                      alt={item.originalName}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="truncate text-xs font-bold text-white" title={item.originalName}>
                      {item.originalName}
                    </p>
                    <p className="text-[10px] font-mono text-slate-400">
                      Original: {item.originalWidth}x{item.originalHeight}px ({item.originalSizeMb} MB)
                    </p>
                    <p className="text-[10px] font-mono font-bold text-laser-400">
                      Convertido: {item.outputWidth}x{item.outputHeight}px ({item.outputSizeMb} MB)
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-chumbo-850 pt-2">
                  <button
                    onClick={() => handleRemoveSingle(item.id)}
                    className="rounded-lg p-1.5 text-slate-500 hover:bg-chumbo-850 hover:text-rose-400 transition-colors"
                    title="Remover da lista"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDownloadSingle(item)}
                    className="flex items-center gap-1.5 rounded-xl bg-laser-400 px-3 py-1.5 text-xs font-extrabold text-chumbo-950 hover:bg-laser-300 transition-all active:scale-95"
                  >
                    <Download className="h-3.5 w-3.5 stroke-[2.5]" />
                    <span>Baixar</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
