import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, Download, Trash2, Sparkles, Loader2, Archive, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { Button } from '../../../components/ui';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

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
  qualityUsed?: number;
}

export type FitMode = 'cover' | 'stretch' | 'contain-white' | 'contain-dark' | 'contain-transparent';
export type OutputFormat = 'image/jpeg' | 'image/png' | 'image/webp';
export type TargetSizeOption = '1.8' | '1.2' | '0.8' | 'none';
export type PresetOption = 'keep-dimensions' | 'ml-34' | 'ml-square' | 'ml-video' | 'custom';

export const ImageConverterTab: React.FC = () => {
  const [items, setItems] = useState<ConvertedItem[]>([]);
  const [preset, setPreset] = useState<PresetOption>('keep-dimensions');
  const [targetWidth, setTargetWidth] = useState<number>(900);
  const [targetHeight, setTargetHeight] = useState<number>(1200);
  const [fitMode, setFitMode] = useState<FitMode>('cover');
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('image/jpeg');
  const [targetSizeLimit, setTargetSizeLimit] = useState<TargetSizeOption>('1.8');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isZipping, setIsZipping] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePresetChange = (presetKey: PresetOption) => {
    setPreset(presetKey);
    if (presetKey === 'ml-34') {
      setTargetWidth(900);
      setTargetHeight(1200);
    } else if (presetKey === 'ml-square') {
      setTargetWidth(1200);
      setTargetHeight(1200);
    } else if (presetKey === 'ml-video') {
      setTargetWidth(675);
      setTargetHeight(1200);
    }
  };

  const processFile = (
    file: File,
    presetKey: PresetOption = preset,
    w: number = targetWidth,
    h: number = targetHeight,
    mode: FitMode = fitMode,
    fmt: OutputFormat = outputFormat,
    sizeLimit: TargetSizeOption = targetSizeLimit
  ): Promise<ConvertedItem> => {
    return new Promise((resolve) => {
      const id = Math.random().toString(36).substring(2, 9);
      const originalSizeMb = parseFloat((file.size / (1024 * 1024)).toFixed(2));

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = async () => {
          const isKeepDimensions = presetKey === 'keep-dimensions';
          const finalW = isKeepDimensions ? img.naturalWidth : w;
          const finalH = isKeepDimensions ? img.naturalHeight : h;

          const canvas = document.createElement('canvas');
          canvas.width = finalW;
          canvas.height = finalH;
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            return;
          }

          if (isKeepDimensions) {
            // Desenhar 100% da imagem original preservando todas as dimensões e proporções
            ctx.drawImage(img, 0, 0, finalW, finalH);
          } else {
            // Fundo
            if (mode === 'contain-white') {
              ctx.fillStyle = '#FFFFFF';
              ctx.fillRect(0, 0, finalW, finalH);
            } else if (mode === 'contain-dark') {
              ctx.fillStyle = '#0f172a';
              ctx.fillRect(0, 0, finalW, finalH);
            } else if (mode === 'contain-transparent') {
              ctx.clearRect(0, 0, finalW, finalH);
            }

            const imgRatio = img.naturalWidth / img.naturalHeight;
            const targetRatio = finalW / finalH;

            let drawWidth = finalW;
            let drawHeight = finalH;
            let drawX = 0;
            let drawY = 0;

            if (mode === 'cover') {
              // Preencher 100% da área sem NENHUMA borda branca
              if (imgRatio > targetRatio) {
                drawHeight = finalH;
                drawWidth = finalH * imgRatio;
                drawX = (finalW - drawWidth) / 2;
              } else {
                drawWidth = finalW;
                drawHeight = finalW / imgRatio;
                drawY = (finalH - drawHeight) / 2;
              }
            } else if (mode === 'stretch') {
              // Esticar preenchendo exatamente 100% da área
              drawWidth = finalW;
              drawHeight = finalH;
              drawX = 0;
              drawY = 0;
            } else {
              // Contain mode (com margens)
              if (imgRatio > targetRatio) {
                drawWidth = finalW;
                drawHeight = finalW / imgRatio;
                drawY = (finalH - drawHeight) / 2;
              } else {
                drawHeight = finalH;
                drawWidth = finalH * imgRatio;
                drawX = (finalW - drawWidth) / 2;
              }
            }

            ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
          }

          // Compactação Inteligente sem perda perceptível
          const targetBytes = sizeLimit === 'none' ? Infinity : parseFloat(sizeLimit) * 1024 * 1024;
          let bestBlob: Blob | null = null;
          let qualityUsed = 0.92;

          if (fmt === 'image/png') {
            bestBlob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
            qualityUsed = 1.0;
          } else {
            // Busca progressiva da melhor qualidade visual possível dentro do limite em bytes
            const qualitiesToTry = [0.94, 0.90, 0.86, 0.82, 0.78, 0.74, 0.70, 0.65];
            for (const q of qualitiesToTry) {
              const testBlob = await new Promise<Blob | null>((res) => canvas.toBlob(res, fmt, q));
              if (testBlob) {
                bestBlob = testBlob;
                qualityUsed = q;
                if (testBlob.size <= targetBytes) {
                  break; // Encontrou o melhor equilíbrio de qualidade dentro do tamanho alvo!
                }
              }
            }
          }

          if (bestBlob) {
            const dataUrl = canvas.toDataURL(fmt, qualityUsed);
            const outputSizeMb = parseFloat((bestBlob.size / (1024 * 1024)).toFixed(2));
            resolve({
              id,
              file,
              originalName: file.name,
              originalWidth: img.naturalWidth,
              originalHeight: img.naturalHeight,
              originalSizeMb,
              dataUrl,
              blob: bestBlob,
              outputWidth: finalW,
              outputHeight: finalH,
              outputSizeMb,
              status: 'done',
              qualityUsed,
            });
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
      const newItem = await processFile(
        item.file,
        preset,
        targetWidth,
        targetHeight,
        fitMode,
        outputFormat,
        targetSizeLimit
      );
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
  }, [preset, targetWidth, targetHeight, fitMode, outputFormat, targetSizeLimit]);

  const handleFilesAdded = async (filesList: FileList | File[]) => {
    const validFiles = Array.from(filesList).filter((file) => file.type.startsWith('image/'));
    if (validFiles.length === 0) return;

    setIsProcessing(true);
    const convertedResults: ConvertedItem[] = [];
    for (const file of validFiles) {
      const result = await processFile(
        file,
        preset,
        targetWidth,
        targetHeight,
        fitMode,
        outputFormat,
        targetSizeLimit
      );
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

  const getCleanFilename = (item: ConvertedItem) => {
    const extension = outputFormat === 'image/png' ? 'png' : outputFormat === 'image/webp' ? 'webp' : 'jpg';
    const cleanName = item.originalName.replace(/\.[^/.]+$/, '');
    const prefix = preset === 'keep-dimensions' ? 'opt' : 'ml';
    return `${cleanName}_${prefix}_${item.outputWidth}x${item.outputHeight}.${extension}`;
  };

  const handleDownloadSingle = (item: ConvertedItem) => {
    const filename = getCleanFilename(item);
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

  const handleDownloadZip = async () => {
    if (items.length === 0) return;
    setIsZipping(true);
    try {
      const zip = new JSZip();
      items.forEach((item) => {
        const filename = getCleanFilename(item);
        zip.file(filename, item.blob);
      });
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      saveAs(zipBlob, 'az3d_fotos_otimizadas_marketplaces.zip');
    } catch (err) {
      console.error('Erro ao gerar arquivo zip:', err);
    } finally {
      setIsZipping(false);
    }
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm backdrop-blur-md dark:border-laser-500/30 dark:bg-chumbo-950/80">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-800 border border-cyan-200 dark:bg-laser-400/20 dark:text-laser-400 dark:border-laser-400/30">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                Otimizador & Formatador de Imagens (Shopee & Mercado Livre)
              </h3>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
                <ShieldCheck className="h-3 w-3" /> Limite &lt; 2MB
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5 dark:text-slate-400">
              Comprima fotos para menos de 2MB <strong>sem perder qualidade visual nem dimensões</strong> para Shopee e Mercado Livre, ou redimensione sem bordas para os padrões oficiais. 100% no seu navegador (sem limites e sem salvar no servidor).
            </p>
          </div>
        </div>

        {items.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <button
              onClick={handleClearAll}
              className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm dark:border-chumbo-700 dark:bg-chumbo-900 dark:text-slate-300 dark:hover:bg-chumbo-800 dark:hover:text-white"
            >
              <Trash2 className="h-4 w-4" />
              Limpar lista
            </button>
            <button
              onClick={handleDownloadZip}
              disabled={isZipping}
              className="flex items-center gap-1.5 rounded-xl border border-cyan-300 bg-cyan-50 px-3.5 py-2 text-xs font-extrabold text-cyan-900 hover:bg-cyan-100 transition-colors shadow-sm dark:border-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300 dark:hover:bg-cyan-900"
            >
              {isZipping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
              Baixar ZIP ({items.length})
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

      {/* Opções de Redimensionamento e Compactação */}
      <div className="grid gap-4 md:grid-cols-4">
        {/* Preset / Resolução */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2 shadow-sm dark:border-chumbo-800 dark:bg-chumbo-900/60">
          <label className="block text-xs font-mono uppercase tracking-wider text-slate-600 font-bold dark:text-slate-400">
            Modo / Resolução Alvo
          </label>
          <select
            value={preset}
            onChange={(e) => handlePresetChange(e.target.value as PresetOption)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 focus:border-cyan-600 focus:outline-none dark:border-chumbo-700 dark:bg-chumbo-950 dark:text-white dark:focus:border-laser-500"
          >
            <option value="keep-dimensions">⚡ Manter Dimensões Originais (Apenas Compactar &lt; 2MB)</option>
            <option value="ml-34">Mercado Livre Fotos 3:4 Vertical (900 x 1200 px — Padrão Exato ML)</option>
            <option value="ml-square">Fotos 1:1 Quadrado HD (1200 x 1200 px)</option>
            <option value="ml-video">Mercado Livre Vídeos / Clips 9:16 (675 x 1200 px)</option>
            <option value="custom">Personalizado (Largura x Altura)</option>
          </select>

          {preset === 'custom' && (
            <div className="grid grid-cols-2 gap-2 pt-2">
              <div>
                <span className="text-[10px] text-slate-600 font-mono dark:text-slate-400">Largura (px)</span>
                <input
                  type="number"
                  value={targetWidth}
                  onChange={(e) => setTargetWidth(Number(e.target.value) || 900)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 dark:border-chumbo-700 dark:bg-chumbo-950 dark:text-white"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-600 font-mono dark:text-slate-400">Altura (px)</span>
                <input
                  type="number"
                  value={targetHeight}
                  onChange={(e) => setTargetHeight(Number(e.target.value) || 1200)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 dark:border-chumbo-700 dark:bg-chumbo-950 dark:text-white"
                />
              </div>
            </div>
          )}

          {preset === 'keep-dimensions' && (
            <p className="text-[11px] text-emerald-700 font-medium dark:text-emerald-400">
              ✓ Preserva 100% dos pixels de cada foto sem cortar nem esticar.
            </p>
          )}
        </div>

        {/* Limite de Tamanho Alvo para Marketplaces */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2 shadow-sm dark:border-chumbo-800 dark:bg-chumbo-900/60">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-mono uppercase tracking-wider text-slate-600 font-bold dark:text-slate-400">
              Tamanho Máximo Alvo
            </label>
            <span className="text-[10px] font-bold text-cyan-800 dark:text-laser-400">Auto-ajuste</span>
          </div>
          <select
            value={targetSizeLimit}
            onChange={(e) => setTargetSizeLimit(e.target.value as TargetSizeOption)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 focus:border-cyan-600 focus:outline-none dark:border-chumbo-700 dark:bg-chumbo-950 dark:text-white dark:focus:border-laser-500"
          >
            <option value="1.8">Máx 1.8 MB (Seguro Shopee &lt; 2.0MB &amp; ML)</option>
            <option value="1.2">Máx 1.2 MB (Otimizado / Mais Leve)</option>
            <option value="0.8">Máx 800 KB (Ultra Rápido para Carregamento)</option>
            <option value="none">Sem limite forçado (Qualidade fixa 92%)</option>
          </select>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            A Shopee rejeita arquivos a partir de 2.0MB. 1.8MB é o limite recomendado.
          </p>
        </div>

        {/* Modo de Enquadramento */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2 shadow-sm dark:border-chumbo-800 dark:bg-chumbo-900/60">
          <label className="block text-xs font-mono uppercase tracking-wider text-slate-600 font-bold dark:text-slate-400">
            Modo de Enquadramento
          </label>
          {preset === 'keep-dimensions' ? (
            <div className="rounded-xl bg-slate-100 p-2.5 text-xs text-slate-600 font-medium dark:bg-chumbo-950 dark:text-slate-400">
              Desativado (mantém proporção e resolução original de cada imagem)
            </div>
          ) : (
            <select
              value={fitMode}
              onChange={(e) => setFitMode(e.target.value as FitMode)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 focus:border-cyan-600 focus:outline-none dark:border-chumbo-700 dark:bg-chumbo-950 dark:text-white dark:focus:border-laser-500"
            >
              <option value="cover">Preencher Sem Bordas (Zoom/Corte - Recomendado)</option>
              <option value="stretch">Esticar Total Sem Bordas (Preenchimento 100%)</option>
            </select>
          )}
        </div>

        {/* Formato de Saída */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2 shadow-sm dark:border-chumbo-800 dark:bg-chumbo-900/60">
          <label className="block text-xs font-mono uppercase tracking-wider text-slate-600 font-bold dark:text-slate-400">
            Formato de Saída
          </label>
          <select
            value={outputFormat}
            onChange={(e) => setOutputFormat(e.target.value as OutputFormat)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 focus:border-cyan-600 focus:outline-none dark:border-chumbo-700 dark:bg-chumbo-950 dark:text-white dark:focus:border-laser-500"
          >
            <option value="image/jpeg">JPEG (.jpg) — Recomendado Shopee &amp; ML</option>
            <option value="image/webp">WebP (.webp) — Leve &amp; Otimizado</option>
            <option value="image/png">PNG (.png) — Sem perdas (Gera arquivos maiores)</option>
          </select>
          {outputFormat === 'image/png' && targetSizeLimit !== 'none' && (
            <p className="text-[10px] text-amber-600 dark:text-amber-400">
              Aviso: PNG não permite compressão com perdas. Prefira JPEG para imagens pesadas.
            </p>
          )}
        </div>
      </div>

      {/* Area de Dropzone de Imagens */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className="relative cursor-pointer rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/70 p-8 text-center transition-all hover:border-cyan-600 hover:bg-slate-100 group dark:border-chumbo-700 dark:bg-chumbo-950/70 dark:hover:border-laser-400 dark:hover:bg-chumbo-900/50"
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files && void handleFilesAdded(e.target.files)}
        />
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-white text-cyan-800 shadow-sm transition-transform group-hover:scale-110 dark:border-chumbo-700 dark:bg-chumbo-900 dark:text-laser-400">
          {isProcessing ? (
            <Loader2 className="h-7 w-7 animate-spin" />
          ) : (
            <UploadCloud className="h-7 w-7" />
          )}
        </div>
        <h4 className="mt-4 text-sm font-extrabold text-slate-900 dark:text-white">
          {isProcessing ? 'Processando lote de imagens...' : 'Arraste e solte fotos de produtos aqui em lote'}
        </h4>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
          {preset === 'keep-dimensions' ? (
            <>
              Preservação 100% da resolução original com compressão inteligente para{' '}
              <strong className="text-cyan-800 dark:text-laser-400">
                &lt; {targetSizeLimit === 'none' ? 'original' : `${targetSizeLimit} MB`}
              </strong>{' '}
              (Aprovado para Shopee &amp; Mercado Livre).
            </>
          ) : (
            <>
              Sem bordas · Formatação automática para{' '}
              <strong className="text-cyan-800 dark:text-laser-400">
                {targetWidth} x {targetHeight} px
              </strong>{' '}
              ({fitMode === 'cover' ? 'Preenchimento sem bordas' : 'Esticado sem bordas'}).
            </>
          )}
        </p>
      </div>

      {/* Lista de Imagens Processadas */}
      {items.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-600 font-mono dark:text-slate-400">
            <span>
              Imagens Processadas ({items.length})
            </span>
            <span>Pronto para Download</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => {
              const isApproved = item.outputSizeMb <= 2.0;
              const savingsPercent = item.originalSizeMb > 0
                ? Math.max(0, Math.round((1 - item.outputSizeMb / item.originalSizeMb) * 100))
                : 0;

              return (
                <div
                  key={item.id}
                  className="flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition-all hover:border-slate-300 dark:border-chumbo-800 dark:bg-chumbo-950 dark:hover:border-chumbo-700"
                >
                  <div className="flex items-start gap-3">
                    <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-chumbo-800 dark:bg-chumbo-900">
                      <img
                        src={item.dataUrl}
                        alt={item.originalName}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="truncate text-xs font-bold text-slate-900 dark:text-white" title={item.originalName}>
                        {item.originalName}
                      </p>

                      <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                        Dimensões: {item.outputWidth}x{item.outputHeight}px {item.outputWidth === item.originalWidth && item.outputHeight === item.originalHeight && '(Nativa)'}
                      </p>

                      <div className="flex items-center gap-1.5 text-[10px] font-mono">
                        <span className="text-slate-500 line-through">{item.originalSizeMb} MB</span>
                        <span className="font-bold text-cyan-800 dark:text-laser-400">{item.outputSizeMb} MB</span>
                        {savingsPercent > 0 && (
                          <span className="text-emerald-700 font-bold dark:text-emerald-400">
                            (-{savingsPercent}%)
                          </span>
                        )}
                      </div>

                      <div className="pt-1">
                        {isApproved ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950/70 dark:border-emerald-800 dark:text-emerald-300">
                            <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                            Aprovado Shopee &amp; ML (&lt; 2MB)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950/70 dark:border-amber-800 dark:text-amber-300">
                            <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                            {item.outputSizeMb} MB (&gt; 2MB)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 dark:border-chumbo-850">
                    <button
                      onClick={() => handleRemoveSingle(item.id)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-rose-600 transition-colors dark:text-slate-500 dark:hover:bg-chumbo-850 dark:hover:text-rose-400"
                      title="Remover da lista"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDownloadSingle(item)}
                      className="flex items-center gap-1.5 rounded-xl bg-cyan-700 px-3 py-1.5 text-xs font-extrabold text-white hover:bg-cyan-800 transition-all active:scale-95 dark:bg-laser-400 dark:text-chumbo-950 dark:hover:bg-laser-300"
                    >
                      <Download className="h-3.5 w-3.5 stroke-[2.5]" />
                      <span>Baixar</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
