import React, { useState, useCallback } from 'react';
import {
  Boxes,
  AlertTriangle,
  RefreshCw,
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
import {
  ThreeMfColorsGrid,
  ThreeMfObjectsList,
  ThreeMfPlatesGrid,
  ThreeMfProjectSummary,
  ThreeMfUploadZone,
  ThreeMfViewMode,
} from './three-mf-splitter';

export const ThreeMfSplitterTab: React.FC = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [project, setProject] = useState<ThreeMfProjectInfo | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ThreeMfViewMode>('plates');

  // Estados de download individual e em lote
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [isZippingAll, setIsZippingAll] = useState(false);
  const [zipProgress, setZipProgress] = useState<{ percent: number; text: string }>({ percent: 0, text: '' });

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
        <ThreeMfUploadZone
          isParsing={isParsing}
          isDragging={isDragging}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onFileSelect={handleProcessFile}
        />
      )}

      {/* Tela 2: Visualizador e Divisor do Projeto */}
      {project && (
        <div className="space-y-6">
          <ThreeMfProjectSummary
            project={project}
            viewMode={viewMode}
            onSelectViewMode={setViewMode}
            onDownloadAllColorsZip={handleDownloadAllColorsZip}
            onDownloadAllPlatesZip={handleDownloadAllPlatesZip}
            isZippingAll={isZippingAll}
            zipProgress={zipProgress}
          />

          {viewMode === 'plates' && (
            <ThreeMfPlatesGrid
              plates={project.plates}
              downloadingId={downloadingId}
              onDownloadPlate={handleDownloadPlate}
            />
          )}

          {viewMode === 'colors' && (
            <ThreeMfColorsGrid
              colorGroups={project.colorGroups}
              downloadingId={downloadingId}
              onDownloadColor={handleDownloadColor}
            />
          )}

          {viewMode === 'objects' && (
            <ThreeMfObjectsList
              objects={project.objects}
              downloadingId={downloadingId}
              onDownloadObject={handleDownloadObject}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default ThreeMfSplitterTab;
