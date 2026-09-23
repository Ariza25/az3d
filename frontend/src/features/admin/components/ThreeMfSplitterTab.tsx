import React, { useState, useRef, useCallback } from 'react';
import {
  Boxes,
  Upload,
  Download,
  FileArchive,
  Layers,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  FolderArchive,
  FileBox,
  Palette,
  X,
} from 'lucide-react';
import {
  parse3MFProject,
  generatePlate3MF,
  generateColor3MF,
  generateObject3MF,
  generateAllPlatesZip,
  generateAllColorsZip,
  downloadBlob,
  ThreeMfProjectInfo,
  PlateInfo,
  ColorGroupInfo,
  ParsedObjectInfo,
} from '../../../shared/utils/threeMfSplitter';

export const ThreeMfSplitterTab: React.FC = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [project, setProject] = useState<ThreeMfProjectInfo | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'plates' | 'colors' | 'objects'>('plates');

  // Estados de download individual e em lote
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [isZippingAll, setIsZippingAll] = useState(false);
  const [zipProgress, setZipProgress] = useState<{ percent: number; text: string }>({ percent: 0, text: '' });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleProcessFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.3mf')) {
      setErrorMessage('Por favor, selecione um arquivo válido com extensão .3mf');
      return;
    }

    setIsParsing(true);
    setErrorMessage(null);

    try {
      const parsed = await parse3MFProject(file);
      setProject(parsed);
      setViewMode('plates');
    } catch (err: any) {
      console.error('Erro ao analisar arquivo 3MF:', err);
      setErrorMessage(err.message || 'Falha ao processar o arquivo .3mf. Verifique se o arquivo não está corrompido.');
    } finally {
      setIsParsing(false);
    }
  }, []);

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void handleProcessFile(e.dataTransfer.files[0]);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      void handleProcessFile(e.target.files[0]);
    }
  };

  // Download de uma única mesa
  const handleDownloadPlate = async (plate: PlateInfo) => {
    if (!project) return;
    const actionKey = `plate-${plate.plateIndex}`;
    setDownloadingId(actionKey);
    try {
      const blob = await generatePlate3MF(project, plate.plateIndex);
      const baseName = project.fileName.replace(/\.3mf$/i, '').trim();
      const cleanPlateName = plate.name.replace(/^(mesa|plate)\s*\d+[:_-]?\s*/i, '').trim();
      const suffix = cleanPlateName ? `_${cleanPlateName}` : '';
      const downloadName = `${baseName}_Mesa_${plate.plateIndex}${suffix}.3mf`;
      downloadBlob(blob, downloadName);
    } catch (err: any) {
      alert(`Erro ao gerar mesa ${plate.plateIndex}: ${err.message}`);
    } finally {
      setDownloadingId(null);
    }
  };

  // Download de uma mesa por cor/filamento
  const handleDownloadColor = async (cg: ColorGroupInfo) => {
    if (!project) return;
    const actionKey = `color-${cg.filamentId}`;
    setDownloadingId(actionKey);
    try {
      const blob = await generateColor3MF(project, cg);
      const baseName = project.fileName.replace(/\.3mf$/i, '').trim();
      const downloadName = `${baseName}_Mesa_Cor_${cg.filamentId}_${cg.colorName}.3mf`;
      downloadBlob(blob, downloadName);
    } catch (err: any) {
      alert(`Erro ao gerar mesa da cor ${cg.colorName}: ${err.message}`);
    } finally {
      setDownloadingId(null);
    }
  };

  // Download de um único objeto
  const handleDownloadObject = async (obj: ParsedObjectInfo) => {
    if (!project) return;
    const actionKey = `obj-${obj.id}`;
    setDownloadingId(actionKey);
    try {
      const blob = await generateObject3MF(project, obj.id);
      const baseName = project.fileName.replace(/\.3mf$/i, '').trim();
      const cleanObjName = (obj.name || `Peca_${obj.id}`).replace(/[\\/:*?"<>|]+/g, '_').trim();
      const downloadName = `${baseName}_Peca_${obj.id}_${cleanObjName}.3mf`;
      downloadBlob(blob, downloadName);
    } catch (err: any) {
      alert(`Erro ao gerar peça ${obj.name}: ${err.message}`);
    } finally {
      setDownloadingId(null);
    }
  };

  // Download de todas as mesas em um arquivo .zip
  const handleDownloadAllPlatesZip = async () => {
    if (!project || isZippingAll) return;
    setIsZippingAll(true);
    setZipProgress({ percent: 0, text: 'Iniciando separação das mesas...' });

    try {
      const zipBlob = await generateAllPlatesZip(project, (percent, text) => {
        setZipProgress({ percent, text });
      });

      const baseName = project.fileName.replace(/\.3mf$/i, '').trim();
      const zipFileName = `${baseName}_Mesas_Separadas.zip`;
      downloadBlob(zipBlob, zipFileName);
    } catch (err: any) {
      alert(`Erro ao compactar mesas: ${err.message}`);
    } finally {
      setIsZippingAll(false);
    }
  };

  // Download de todas as cores em um arquivo .zip
  const handleDownloadAllColorsZip = async () => {
    if (!project || isZippingAll) return;
    setIsZippingAll(true);
    setZipProgress({ percent: 0, text: 'Iniciando separação por cores...' });

    try {
      const zipBlob = await generateAllColorsZip(project, (percent, text) => {
        setZipProgress({ percent, text });
      });

      const baseName = project.fileName.replace(/\.3mf$/i, '').trim();
      const zipFileName = `${baseName}_Cores_Separadas.zip`;
      downloadBlob(zipBlob, zipFileName);
    } catch (err: any) {
      alert(`Erro ao compactar cores: ${err.message}`);
    } finally {
      setIsZippingAll(false);
    }
  };

  const handleReset = () => {
    setProject(null);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Cabeçalho do Módulo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-chumbo-800 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-200 dark:border-cyan-800 text-cyan-700 dark:text-cyan-400 shadow-xs">
              <Boxes className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                Divisor de Arquivos 3MF
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-100 dark:bg-cyan-900/60 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-700">
                  Bambu Lab & Orca
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Separe projetos com múltiplas mesas (plates) ou peças em arquivos .3mf individuais prontos para impressão.
              </p>
            </div>
          </div>
        </div>

        {project && (
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-300 dark:border-chumbo-700 hover:bg-slate-100 dark:hover:bg-chumbo-800 text-slate-700 dark:text-slate-200 transition-all self-start sm:self-auto shadow-xs active:scale-95"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Carregar outro .3mf</span>
          </button>
        )}
      </div>

      {/* Alerta de Erro */}
      {errorMessage && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-xs sm:text-sm animate-in fade-in">
          <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1">
            <strong className="font-bold block">Não foi possível processar o arquivo:</strong>
            <p>{errorMessage}</p>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-500 hover:text-rose-800 p-1">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Tela 1: Área de Upload / Drag & Drop */}
      {!project && (
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
      )}

      {/* Tela 2: Visualizador e Divisor do Projeto */}
      {project && (
        <div className="space-y-6">
          {/* Card Resumo do Projeto Analisado */}
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
                    onClick={handleDownloadAllColorsZip}
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
                    onClick={handleDownloadAllPlatesZip}
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
                  onClick={() => setViewMode('plates')}
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
                  onClick={() => setViewMode('colors')}
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
                  onClick={() => setViewMode('objects')}
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

          {/* Modo 1: Grid de Mesas Originais (Plates) */}
          {viewMode === 'plates' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {project.plates.map((plate) => {
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
                        onClick={() => handleDownloadPlate(plate)}
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
          )}

          {/* Modo 2: Grid de Mesas por Cor / Filamento (Color Split) */}
          {viewMode === 'colors' && (
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
                {project.colorGroups.map((cg) => {
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
                          onClick={() => handleDownloadColor(cg)}
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
          )}

          {/* Modo 3: Lista de Peças Individuais (Objects) */}
          {viewMode === 'objects' && (
            <div className="space-y-2">
              {project.objects.map((obj) => {
                const isDownloadingThis = downloadingId === `obj-${obj.id}`;

                return (
                  <div
                    key={`obj-row-${obj.id}`}
                    className="flex items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-chumbo-800 bg-white dark:bg-chumbo-900/50 hover:bg-slate-50 dark:hover:bg-chumbo-900 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-chumbo-800 text-slate-600 dark:text-slate-300 text-xs font-bold shrink-0">
                        #{obj.id}
                      </div>
                      <div className="min-w-0">
                        <strong className="block text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                          {obj.name}
                        </strong>
                        {obj.plateIndex && (
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            Pertence à Mesa #{obj.plateIndex}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDownloadObject(obj)}
                      disabled={isDownloadingThis}
                      className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold bg-slate-900 hover:bg-slate-800 dark:bg-chumbo-800 dark:hover:bg-chumbo-700 text-white transition-all shadow-xs shrink-0 disabled:opacity-50"
                    >
                      {isDownloadingThis ? (
                        <>
                          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Gerando...</span>
                        </>
                      ) : (
                        <>
                          <Download className="h-3 w-3" />
                          <span>Baixar Peça (.3mf)</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ThreeMfSplitterTab;
