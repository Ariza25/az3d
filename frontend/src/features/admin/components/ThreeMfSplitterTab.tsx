import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Boxes,
  AlertTriangle,
  RefreshCw,
  X,
  Eye,
  EyeOff,
  Download,
  Scissors,
  Sliders,
  Palette,
  CheckCircle2,
  RotateCcw,
  Wrench,
} from 'lucide-react';
import {
  parse3DModelProject,
  generatePlate3MF,
  generateColor3MF,
  generateObject3MF,
  generateAllPlatesZip,
  generateAllSplitPartsZip,
  buildSplitColorParts,
  cutPartByAxisPlane,
  exportSplitPartTo3MF,
  exportSplitPartToSTL,
  exportUnifiedAssembly3MF,
  downloadBlob,
  sanitizeFileName,
  getColorNameFromHex,
  DEFAULT_BAMBU_COLORS,
  DEFAULT_SPLIT_ENGINE_OPTIONS,
  ThreeMfProjectInfo,
  PlateInfo,
  ColorGroupInfo,
  ParsedObjectInfo,
  SplitPartMesh,
  SplitEngineOptions,
  ConnectorShape,
  SeamCapMode,
} from '../../../shared/utils/threeMfSplitter';
import {
  Split3MfViewer,
  ThreeMfColorsGrid,
  ThreeMfObjectsList,
  ThreeMfPlatesGrid,
  ThreeMfProjectSummary,
  ThreeMfUploadZone,
  ThreeMfViewMode,
} from './three-mf-splitter';

type StudioSidebarTab = 'parts' | 'seams' | 'cut';

export const ThreeMfSplitterTab: React.FC = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [project, setProject] = useState<ThreeMfProjectInfo | null>(null);
  const [parts, setParts] = useState<SplitPartMesh[]>([]);
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [explodeFactor, setExplodeFactor] = useState<number>(0);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ThreeMfViewMode>('split3d');
  const [sidebarTab, setSidebarTab] = useState<StudioSidebarTab>('parts');
  const [keepAssemblyPosition, setKeepAssemblyPosition] = useState<boolean>(true);

  // Opções de Costura Watertight & Inlay
  const [splitOptions, setSplitOptions] = useState<SplitEngineOptions>(DEFAULT_SPLIT_ENGINE_OPTIONS);

  // Opções da Ferramenta de Corte Plano + Pinos de Encaixe
  const [cutAxis, setCutAxis] = useState<'X' | 'Y' | 'Z'>('Z');
  const [cutOffsetMm, setCutOffsetMm] = useState<number>(20);
  const [cutTargetMode, setCutTargetMode] = useState<'ALL' | 'SELECTED'>('ALL');
  const [cutConnectorShape, setCutConnectorShape] = useState<ConnectorShape>('cylinder');
  const [cutConnectorCount, setCutConnectorCount] = useState<number>(2);
  const [cutConnectorDiameterMm, setCutConnectorDiameterMm] = useState<number>(4.0);
  const [cutConnectorDepthMm, setCutConnectorDepthMm] = useState<number>(4.0);
  const [cutConnectorClearanceMm, setCutConnectorClearanceMm] = useState<number>(0.20);

  // Estados de download individual e em lote
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [isZippingAll, setIsZippingAll] = useState(false);
  const [zipProgress, setZipProgress] = useState<{ percent: number; text: string }>({
    percent: 0,
    text: '',
  });

  // Limites axiais dinâmicos para o slider de Corte Plano
  const cutBounds = useMemo(() => {
    const relevant =
      cutTargetMode === 'SELECTED' && selectedPartId
        ? parts.filter((p) => p.id === selectedPartId)
        : parts.filter((p) => p.visible);
    const list = relevant.length > 0 ? relevant : parts;
    if (list.length === 0) return { min: 0, max: 100 };

    const axisIdx = cutAxis === 'X' ? 0 : cutAxis === 'Y' ? 1 : 2;
    let minVal = Infinity;
    let maxVal = -Infinity;
    for (const p of list) {
      if (p.bboxMin[axisIdx] < minVal) minVal = p.bboxMin[axisIdx];
      if (p.bboxMax[axisIdx] > maxVal) maxVal = p.bboxMax[axisIdx];
    }
    if (!Number.isFinite(minVal) || maxVal - minVal < 2) {
      return { min: -50, max: 50 };
    }
    return {
      min: Math.round((minVal + 0.8) * 10) / 10,
      max: Math.round((maxVal - 0.8) * 10) / 10,
    };
  }, [parts, cutAxis, cutTargetMode, selectedPartId]);

  useEffect(() => {
    const mid = Math.round(((cutBounds.min + cutBounds.max) * 0.5) * 10) / 10;
    setCutOffsetMm(mid);
  }, [cutAxis, cutBounds.min, cutBounds.max]);

  const handleProcessFile = useCallback(
    async (file: File) => {
      const lower = file.name.toLowerCase();
      if (!lower.endsWith('.3mf') && !lower.endsWith('.stl') && !lower.endsWith('.obj')) {
        setErrorMessage('Selecione um arquivo 3D válido com extensão .3mf, .stl ou .obj');
        return;
      }

      setIsParsing(true);
      setErrorMessage(null);
      setStatusNotice(null);

      try {
        const parsed = await parse3DModelProject(file, splitOptions);
        setProject(parsed);
        setParts(parsed.splitParts);
        setSelectedPartId(null);
        setExplodeFactor(parsed.splitParts.length > 1 ? 0.16 : 0);
        setViewMode('split3d');
        setSidebarTab(parsed.splitParts.length > 1 ? 'parts' : 'cut');

        if (parsed.hadPaintedTriangles) {
          setStatusNotice(
            `Pintura 3MF detectada e subdividida com sucesso em ${parsed.splitParts.length} peças sólidas independentes!`
          );
        } else if (parsed.splitParts.length === 1) {
          setStatusNotice(
            'Modelo de cor única carregado. Use a aba "Corte Plano + Pinos" para dividir a peça com conectores de encaixe!'
          );
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('Erro ao analisar modelo 3D:', err);
        setErrorMessage(msg || 'Falha ao processar o arquivo 3D.');
      } finally {
        setIsParsing(false);
      }
    },
    [splitOptions]
  );

  // Reprocessar divisão por cor / costuras watertight com as opções ajustadas
  const handleRebuildColorSplit = async () => {
    if (!project) return;
    setIsRebuilding(true);
    setErrorMessage(null);
    try {
      const rebuilt = await buildSplitColorParts(
        project.coloredSoup,
        splitOptions,
        getColorNameFromHex,
        DEFAULT_BAMBU_COLORS
      );
      setParts(rebuilt);
      setSelectedPartId(null);
      setStatusNotice(
        `Malha reconstruída: ${rebuilt.length} peça(s) gerada(s) no modo "${
          splitOptions.capMode === 'inward_shell'
            ? 'Encaixe Inlay 3D Macho/Fêmea'
            : splitOptions.capMode === 'watertight'
            ? 'Estanque Sólido'
            : 'Casca Aberta'
        }".`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(`Erro ao reconstruir costuras: ${msg}`);
    } finally {
      setIsRebuilding(false);
    }
  };

  // Aplicar Corte Plano + Geração de Pinos Macho e Soquetes Fêmea
  const handleApplyPlaneCut = async () => {
    if (parts.length === 0) return;
    setIsRebuilding(true);
    setErrorMessage(null);

    try {
      const targetId =
        cutTargetMode === 'SELECTED' && selectedPartId ? selectedPartId : 'ALL';

      const nextParts: SplitPartMesh[] = [];
      let cutCount = 0;
      let totalPins = 0;

      for (const p of parts) {
        const shouldCut =
          p.visible && (targetId === 'ALL' || p.id === targetId);
        if (!shouldCut) {
          nextParts.push(p);
          continue;
        }

        const result = await cutPartByAxisPlane(p, {
          axis: cutAxis,
          offsetMm: cutOffsetMm,
          targetPartId: targetId,
          connectorShape: cutConnectorShape,
          connectorDiameterMm: cutConnectorDiameterMm,
          connectorDepthMm: cutConnectorDepthMm,
          connectorClearanceMm: cutConnectorClearanceMm,
          connectorCount: cutConnectorCount,
        });

        if (result) {
          nextParts.push(result[0], result[1]);
          cutCount++;
          totalPins += Math.max(0, result[0].connectorsAdded - p.connectorsAdded);
        } else {
          nextParts.push(p);
        }
      }

      if (cutCount === 0) {
        setStatusNotice('O plano de corte não interceptou nenhuma peça visível na posição escolhida.');
      } else {
        setParts(nextParts);
        setSelectedPartId(null);
        setExplodeFactor((prev) => Math.max(prev, 0.25));
        setSidebarTab('parts');
        setStatusNotice(
          `Corte aplicado em ${cutCount} peça(s)! ${
            totalPins > 0
              ? `${totalPins} pino(s) macho e soquete(s) fêmea (folga ${cutConnectorClearanceMm.toFixed(2)} mm) gerados automaticamente.`
              : 'Faces cortadas fechadas de modo 100% estanque.'
          }`
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(`Falha durante o corte plano: ${msg}`);
    } finally {
      setIsRebuilding(false);
    }
  };

  const togglePartVisibility = (partId: string) => {
    setParts((prev) =>
      prev.map((p) => (p.id === partId ? { ...p, visible: !p.visible } : p))
    );
  };

  const updatePartColor = (partId: string, newHex: string) => {
    setParts((prev) =>
      prev.map((p) =>
        p.id === partId
          ? { ...p, colorHex: newHex, colorName: getColorNameFromHex(newHex) }
          : p
      )
    );
  };

  // Download individual de peça dividida (.3MF ou .STL)
  const handleDownloadSplitPart = async (part: SplitPartMesh, format: '3mf' | 'stl') => {
    if (!project) return;
    const actionKey = `part-${part.id}-${format}`;
    setDownloadingId(actionKey);
    try {
      const baseName = project.fileName.replace(/\.(3mf|stl|obj)$/i, '').trim();
      const blob =
        format === 'stl'
          ? exportSplitPartToSTL(part, keepAssemblyPosition)
          : await exportSplitPartTo3MF(part, keepAssemblyPosition);
      downloadBlob(blob, sanitizeFileName(`${baseName}_${part.name}.${format}`));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Erro ao exportar peça: ${msg}`);
    } finally {
      setDownloadingId(null);
    }
  };

  // Download de todas as peças divididas em .ZIP (.3MF ou .STL)
  const handleDownloadSplitPartsZip = async (format: '3mf' | 'stl') => {
    if (!project || isZippingAll) return;
    setIsZippingAll(true);
    setZipProgress({ percent: 0, text: `Exportando peças em .${format.toUpperCase()}...` });
    try {
      const zipBlob = await generateAllSplitPartsZip(
        parts,
        project.fileName,
        format,
        keepAssemblyPosition,
        (percent, text) => setZipProgress({ percent, text })
      );
      const baseName = project.fileName.replace(/\.(3mf|stl|obj)$/i, '').trim();
      downloadBlob(zipBlob, `${baseName}_Split3MF_${format.toUpperCase()}.zip`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Erro ao compactar peças: ${msg}`);
    } finally {
      setIsZippingAll(false);
    }
  };

  // Download de montagem .3MF unificada com todas as peças separadas e slots AMS preservados
  const handleDownloadUnified3Mf = async () => {
    if (!project || isZippingAll) return;
    setIsZippingAll(true);
    setZipProgress({ percent: 50, text: 'Empacotando .3MF Multi-Peças...' });
    try {
      const baseName = project.fileName.replace(/\.(3mf|stl|obj)$/i, '').trim();
      const blob = await exportUnifiedAssembly3MF(parts, `${baseName}_Split3MF`);
      downloadBlob(blob, `${baseName}_Montagem_Unificada.3mf`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Erro ao gerar .3MF unificado: ${msg}`);
    } finally {
      setIsZippingAll(false);
    }
  };

  // Downloads do modo Mesas Originais / Objetos XML
  const handleDownloadPlate = async (plate: PlateInfo) => {
    if (!project) return;
    const actionKey = `plate-${plate.plateIndex}`;
    setDownloadingId(actionKey);
    try {
      const blob = await generatePlate3MF(project, plate.plateIndex);
      const baseName = project.fileName.replace(/\.3mf$/i, '').trim();
      const cleanPlateName = plate.name.replace(/^(mesa|plate)\s*\d+[\s:_-]*/i, '').trim();
      const suffix = cleanPlateName ? `_${cleanPlateName}` : '';
      downloadBlob(blob, `${baseName}_Mesa_${plate.plateIndex}${suffix}.3mf`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Erro ao gerar mesa ${plate.plateIndex}: ${msg}`);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDownloadColor = async (cg: ColorGroupInfo) => {
    if (!project) return;
    const actionKey = `color-${cg.filamentId}`;
    setDownloadingId(actionKey);
    try {
      const blob = await generateColor3MF(project, cg);
      const baseName = project.fileName.replace(/\.(3mf|stl|obj)$/i, '').trim();
      downloadBlob(blob, `${baseName}_Cor_${cg.filamentId}_${cg.colorName}.3mf`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Erro ao gerar cor ${cg.colorName}: ${msg}`);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDownloadObject = async (obj: ParsedObjectInfo) => {
    if (!project) return;
    const actionKey = `obj-${obj.id}`;
    setDownloadingId(actionKey);
    try {
      const blob = await generateObject3MF(project, obj.id);
      const baseName = project.fileName.replace(/\.(3mf|stl|obj)$/i, '').trim();
      const cleanObjName = sanitizeFileName(obj.name || `Peca_${obj.id}`);
      downloadBlob(blob, `${baseName}_Peca_${obj.id}_${cleanObjName}.3mf`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Erro ao gerar peça ${obj.name}: ${msg}`);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDownloadAllPlatesZip = async () => {
    if (!project || isZippingAll) return;
    setIsZippingAll(true);
    setZipProgress({ percent: 0, text: 'Iniciando separação das mesas...' });
    try {
      const zipBlob = await generateAllPlatesZip(project, (percent, text) => {
        setZipProgress({ percent, text });
      });
      const baseName = project.fileName.replace(/\.3mf$/i, '').trim();
      downloadBlob(zipBlob, `${baseName}_Mesas_Separadas.zip`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Erro ao compactar mesas: ${msg}`);
    } finally {
      setIsZippingAll(false);
    }
  };

  const handleReset = () => {
    setProject(null);
    setParts([]);
    setSelectedPartId(null);
    setExplodeFactor(0);
    setErrorMessage(null);
    setStatusNotice(null);
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
                Estúdio Split3MF (Divisor 3D por Cor & Corte)
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-100 dark:bg-cyan-900/60 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-700">
                  3MF • STL • OBJ
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Divida modelos multicor pintados em peças sólidas estanques com encaixes, corte peças grandes com pinos e separe múltiplas mesas.
              </p>
            </div>
          </div>
        </div>

        {project && (
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-300 dark:border-chumbo-700 hover:bg-slate-100 dark:hover:bg-chumbo-800 text-slate-700 dark:text-slate-200 transition-all self-start sm:self-auto shadow-xs active:scale-95 cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Carregar outro modelo</span>
          </button>
        )}
      </div>

      {/* Alerta de Erro */}
      {errorMessage && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-xs sm:text-sm animate-in fade-in">
          <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1">
            <strong className="font-bold block">Não foi possível concluir a operação:</strong>
            <p>{errorMessage}</p>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-500 hover:text-rose-800 p-1">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Aviso de Status / Sucesso */}
      {statusNotice && !errorMessage && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-cyan-50/80 dark:bg-cyan-950/35 border border-cyan-200 dark:border-cyan-800/70 text-cyan-900 dark:text-cyan-200 text-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
            <span>{statusNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusNotice(null)}
            className="text-cyan-600 dark:text-cyan-400 hover:opacity-75 p-0.5"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Tela 1: Upload / Drag & Drop */}
      {!project && (
        <ThreeMfUploadZone
          isParsing={isParsing}
          isDragging={isDragging}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
              void handleProcessFile(e.dataTransfer.files[0]);
            }
          }}
          onFileSelect={handleProcessFile}
        />
      )}

      {/* Tela 2: Estúdio Interativo Split3MF */}
      {project && (
        <div className="space-y-5">
          <ThreeMfProjectSummary
            project={project}
            activeParts={parts}
            viewMode={viewMode}
            onSelectViewMode={setViewMode}
            onDownloadSplitPartsZip={(fmt) => void handleDownloadSplitPartsZip(fmt)}
            onDownloadUnified3Mf={() => void handleDownloadUnified3Mf()}
            onDownloadAllPlatesZip={() => void handleDownloadAllPlatesZip()}
            isZippingAll={isZippingAll}
            zipProgress={zipProgress}
          />

          {/* Modo Principal: Estúdio Split3MF 3D Interativo */}
          {viewMode === 'split3d' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Viewport 3D (7 colunas) */}
              <div className="lg:col-span-7">
                <Split3MfViewer
                  parts={parts}
                  selectedPartId={selectedPartId}
                  onSelectPart={setSelectedPartId}
                  explodeFactor={explodeFactor}
                  onChangeExplodeFactor={setExplodeFactor}
                  showCutPlane={sidebarTab === 'cut'}
                  cutAxis={cutAxis}
                  cutOffsetMm={cutOffsetMm}
                />
              </div>

              {/* Painel Lateral de Controle Split3MF (5 colunas) */}
              <div className="lg:col-span-5 bg-white dark:bg-chumbo-900 border border-slate-200 dark:border-chumbo-800 rounded-2xl shadow-sm overflow-hidden">
                {/* Abas do Painel Lateral */}
                <div className="grid grid-cols-3 border-b border-slate-200 dark:border-chumbo-800 bg-slate-50 dark:bg-chumbo-950/60 p-1.5 gap-1">
                  <button
                    type="button"
                    onClick={() => setSidebarTab('parts')}
                    className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold transition-all ${
                      sidebarTab === 'parts'
                        ? 'bg-white dark:bg-chumbo-800 text-cyan-700 dark:text-cyan-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Palette className="w-3.5 h-3.5" />
                    <span>Peças ({parts.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSidebarTab('seams')}
                    className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold transition-all ${
                      sidebarTab === 'seams'
                        ? 'bg-white dark:bg-chumbo-800 text-amber-600 dark:text-amber-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    <span>Encaixes</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSidebarTab('cut')}
                    className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold transition-all ${
                      sidebarTab === 'cut'
                        ? 'bg-white dark:bg-chumbo-800 text-emerald-600 dark:text-emerald-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Scissors className="w-3.5 h-3.5" />
                    <span>Corte + Pinos</span>
                  </button>
                </div>

                {/* ABA 1: Lista de Peças & Cores Divididas */}
                {sidebarTab === 'parts' && (
                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-chumbo-800 text-xs">
                      <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={keepAssemblyPosition}
                          onChange={(e) => setKeepAssemblyPosition(e.target.checked)}
                          className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                        />
                        <span className="text-[11px] font-semibold">
                          Preservar coordenadas de montagem
                        </span>
                      </label>

                      <button
                        type="button"
                        onClick={() => {
                          const anyHidden = parts.some((p) => !p.visible);
                          setParts((prev) => prev.map((p) => ({ ...p, visible: anyHidden })));
                        }}
                        className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400 hover:underline"
                      >
                        {parts.some((p) => !p.visible) ? 'Mostrar todas' : 'Ocultar todas'}
                      </button>
                    </div>

                    <div className="space-y-2.5 max-h-[415px] overflow-y-auto pr-1">
                      {parts.map((part) => {
                        const isSelected = selectedPartId === part.id;
                        const dimX = (part.bboxMax[0] - part.bboxMin[0]).toFixed(1);
                        const dimY = (part.bboxMax[1] - part.bboxMin[1]).toFixed(1);
                        const dimZ = (part.bboxMax[2] - part.bboxMin[2]).toFixed(1);

                        return (
                          <div
                            key={part.id}
                            onClick={() => setSelectedPartId(isSelected ? null : part.id)}
                            className={`p-3 rounded-xl border transition-all cursor-pointer ${
                              isSelected
                                ? 'border-cyan-500 bg-cyan-50/40 dark:bg-cyan-950/30 shadow-sm'
                                : 'border-slate-200 dark:border-chumbo-800 bg-slate-50/50 dark:bg-chumbo-950/40 hover:border-slate-300 dark:hover:border-chumbo-700'
                            } ${!part.visible ? 'opacity-55' : ''}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2.5 min-w-0">
                                {/* Seletor nativo de cor do filamento */}
                                <input
                                  type="color"
                                  value={part.colorHex.slice(0, 7)}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => updatePartColor(part.id, e.target.value)}
                                  title="Alterar cor de visualização/exportação desta peça"
                                  className="w-7 h-7 rounded-lg border border-slate-300 dark:border-chumbo-700 cursor-pointer shrink-0 bg-transparent p-0"
                                />

                                <div className="min-w-0">
                                  <div className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                                    {part.name}
                                  </div>
                                  <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1.5 flex-wrap">
                                    <span>
                                      {dimX}×{dimY}×{dimZ} mm
                                    </span>
                                    <span>•</span>
                                    <span>{part.triangleCount.toLocaleString()} faces</span>
                                  </div>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  togglePartVisibility(part.id);
                                }}
                                title={part.visible ? 'Ocultar peça' : 'Mostrar peça'}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-chumbo-800"
                              >
                                {part.visible ? (
                                  <Eye className="w-4 h-4" />
                                ) : (
                                  <EyeOff className="w-4 h-4 text-slate-400" />
                                )}
                              </button>
                            </div>

                            {/* Badges de Qualidade + Botões Individuais .3MF / .STL */}
                            <div className="flex items-center justify-between gap-2 mt-2.5 pt-2 border-t border-slate-200/70 dark:border-chumbo-800/80">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    part.isWatertight
                                      ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                      : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                                  }`}
                                >
                                  {part.isWatertight ? '● Estanque' : '◐ Casca'}
                                </span>

                                {part.connectorsAdded > 0 && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-100 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300">
                                    +{part.connectorsAdded} encaixe(s)
                                  </span>
                                )}
                              </div>

                              <div
                                className="flex items-center gap-1.5"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  disabled={downloadingId === `part-${part.id}-3mf`}
                                  onClick={() => void handleDownloadSplitPart(part, '3mf')}
                                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-cyan-600 hover:bg-cyan-500 text-white flex items-center gap-1 transition-all disabled:opacity-50 cursor-pointer"
                                >
                                  <Download className="w-3 h-3" />
                                  <span>.3MF</span>
                                </button>

                                <button
                                  type="button"
                                  disabled={downloadingId === `part-${part.id}-stl`}
                                  onClick={() => void handleDownloadSplitPart(part, 'stl')}
                                  className="px-2 py-1 rounded-lg text-[11px] font-bold border border-slate-300 dark:border-chumbo-700 bg-white dark:bg-chumbo-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-chumbo-700 transition-all disabled:opacity-50 cursor-pointer"
                                >
                                  .STL
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ABA 2: Costuras Estanques (Watertight), Inlay 3D & Limpeza */}
                {sidebarTab === 'seams' && (
                  <div className="p-4 space-y-4 text-xs">
                    <div>
                      <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1.5">
                        Modo de Fechamento das Costuras de Cor
                      </label>
                      <select
                        value={splitOptions.capMode}
                        onChange={(e) =>
                          setSplitOptions((prev) => ({
                            ...prev,
                            capMode: e.target.value as SeamCapMode,
                          }))
                        }
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-chumbo-700 bg-white dark:bg-chumbo-950 font-semibold text-slate-900 dark:text-slate-100"
                      >
                        <option value="watertight">
                          Estanque Sólido Automático (Recomendado)
                        </option>
                        <option value="inward_shell">
                          Encaixe Inlay 3D Macho/Fêmea (Cria raiz + cavidade para logos/olhos)
                        </option>
                        <option value="open">Sem Fechamento (Manter casca aberta)</option>
                      </select>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                        O modo <strong>Inlay 3D</strong> extruda uma raiz interna na cor pintada e escava a cavidade correspondente na peça principal para montagem física por pressão/cola!
                      </p>
                    </div>

                    <div>
                      <div className="flex justify-between font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        <span>Folga / Tolerância entre Cores</span>
                        <span className="font-mono text-amber-600 dark:text-amber-400">
                          {splitOptions.seamClearanceMm.toFixed(2)} mm
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={0.35}
                        step={0.02}
                        value={splitOptions.seamClearanceMm}
                        onChange={(e) =>
                          setSplitOptions((prev) => ({
                            ...prev,
                            seamClearanceMm: parseFloat(e.target.value),
                          }))
                        }
                        className="w-full accent-amber-500"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        <span>Filtro de Respingos de Pincel</span>
                        <span className="font-mono text-slate-500">
                          &lt; {splitOptions.minIslandTriangles} faces
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={60}
                        step={2}
                        value={splitOptions.minIslandTriangles}
                        onChange={(e) =>
                          setSplitOptions((prev) => ({
                            ...prev,
                            minIslandTriangles: parseInt(e.target.value, 10),
                          }))
                        }
                        className="w-full accent-amber-500"
                      />
                    </div>

                    <label className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-chumbo-950 border border-slate-200 dark:border-chumbo-800 cursor-pointer">
                      <span className="text-slate-700 dark:text-slate-300 font-semibold">
                        Separar ilhas desconectadas da mesma cor
                      </span>
                      <input
                        type="checkbox"
                        checked={splitOptions.splitDisconnectedIslands}
                        onChange={(e) =>
                          setSplitOptions((prev) => ({
                            ...prev,
                            splitDisconnectedIslands: e.target.checked,
                          }))
                        }
                        className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                      />
                    </label>

                    <div className="pt-2 border-t border-slate-100 dark:border-chumbo-800 space-y-2.5">
                      <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <Sliders className="w-3.5 h-3.5 text-amber-500" />
                        Pinos Automáticos em Costuras Planas
                      </label>
                      <select
                        value={splitOptions.connectorShape}
                        onChange={(e) =>
                          setSplitOptions((prev) => ({
                            ...prev,
                            connectorShape: e.target.value as ConnectorShape,
                          }))
                        }
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-chumbo-700 bg-white dark:bg-chumbo-950 font-semibold text-slate-900 dark:text-slate-100"
                      >
                        <option value="none">Sem pinos extras nas costuras de cor</option>
                        <option value="cylinder">Pinos Cilíndricos + Furos</option>
                        <option value="cube">Pinos Quadrados + Furos</option>
                        <option value="triangle">Chaveta Triangular Antirrotação</option>
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleRebuildColorSplit()}
                      disabled={isRebuilding}
                      className="w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs shadow-md shadow-amber-600/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
                    >
                      {isRebuilding ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Reconstruindo Malhas...</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4" />
                          <span>Reprocessar Costuras & Cores</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* ABA 3: Ferramenta de Corte Plano + Pinos de Alinhamento */}
                {sidebarTab === 'cut' && (
                  <div className="p-4 space-y-4 text-xs">
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                          Eixo do Plano
                        </label>
                        <div className="grid grid-cols-3 gap-1">
                          {(['X', 'Y', 'Z'] as const).map((ax) => (
                            <button
                              key={ax}
                              type="button"
                              onClick={() => setCutAxis(ax)}
                              className={`py-1.5 rounded-lg font-extrabold border transition-all ${
                                cutAxis === ax
                                  ? 'bg-cyan-600 border-cyan-600 text-white'
                                  : 'bg-slate-50 dark:bg-chumbo-950 border-slate-300 dark:border-chumbo-700 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              {ax}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                          Alvo do Corte
                        </label>
                        <select
                          value={cutTargetMode}
                          onChange={(e) => setCutTargetMode(e.target.value as 'ALL' | 'SELECTED')}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-chumbo-700 bg-white dark:bg-chumbo-950 font-semibold text-slate-900 dark:text-slate-100"
                        >
                          <option value="ALL">Todas Visíveis</option>
                          <option value="SELECTED" disabled={!selectedPartId}>
                            {selectedPartId ? 'Apenas Selecionada' : 'Clique numa peça 3D'}
                          </option>
                        </select>
                      </div>
                    </div>

                    {/* Posição do Plano de Corte */}
                    <div>
                      <div className="flex justify-between font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        <span>Posição do Corte ({cutAxis})</span>
                        <span className="font-mono text-cyan-600 dark:text-cyan-400">
                          {cutOffsetMm.toFixed(1)} mm
                        </span>
                      </div>
                      <input
                        type="range"
                        min={cutBounds.min}
                        max={cutBounds.max}
                        step={0.5}
                        value={cutOffsetMm}
                        onChange={(e) => setCutOffsetMm(parseFloat(e.target.value))}
                        className="w-full accent-cyan-500"
                      />
                    </div>

                    {/* Conectores de Montagem (Pinos Macho + Soquetes Fêmea) */}
                    <div className="pt-3 border-t border-slate-100 dark:border-chumbo-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-slate-800 dark:text-slate-200">
                          Conectores de Encaixe (Pino + Furo)
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                          Automático
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                            Formato
                          </label>
                          <select
                            value={cutConnectorShape}
                            onChange={(e) => setCutConnectorShape(e.target.value as ConnectorShape)}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-chumbo-700 bg-white dark:bg-chumbo-950 font-semibold text-slate-900 dark:text-slate-100"
                          >
                            <option value="cylinder">Cilíndrico</option>
                            <option value="cube">Cubo / Quadrado</option>
                            <option value="triangle">Triangular Guia</option>
                            <option value="none">Sem Pinos (Liso)</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                            Qtd. Máxima
                          </label>
                          <select
                            value={cutConnectorCount}
                            disabled={cutConnectorShape === 'none'}
                            onChange={(e) => setCutConnectorCount(parseInt(e.target.value, 10))}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-chumbo-700 bg-white dark:bg-chumbo-950 font-semibold text-slate-900 dark:text-slate-100 disabled:opacity-50"
                          >
                            <option value={1}>1 Pino Central</option>
                            <option value={2}>2 Pinos Alinhados</option>
                            <option value={3}>3 Pinos</option>
                            <option value={4}>4 Pinos</option>
                          </select>
                        </div>
                      </div>

                      {cutConnectorShape !== 'none' && (
                        <>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <div className="flex justify-between text-[11px] text-slate-600 dark:text-slate-400 mb-1">
                                <span>Diâmetro</span>
                                <span className="font-mono text-slate-800 dark:text-slate-200">
                                  {cutConnectorDiameterMm.toFixed(1)} mm
                                </span>
                              </div>
                              <input
                                type="range"
                                min={2.0}
                                max={10.0}
                                step={0.5}
                                value={cutConnectorDiameterMm}
                                onChange={(e) =>
                                  setCutConnectorDiameterMm(parseFloat(e.target.value))
                                }
                                className="w-full accent-emerald-500"
                              />
                            </div>

                            <div>
                              <div className="flex justify-between text-[11px] text-slate-600 dark:text-slate-400 mb-1">
                                <span>Profundidade</span>
                                <span className="font-mono text-slate-800 dark:text-slate-200">
                                  {cutConnectorDepthMm.toFixed(1)} mm
                                </span>
                              </div>
                              <input
                                type="range"
                                min={2.0}
                                max={10.0}
                                step={0.5}
                                value={cutConnectorDepthMm}
                                onChange={(e) => setCutConnectorDepthMm(parseFloat(e.target.value))}
                                className="w-full accent-emerald-500"
                              />
                            </div>
                          </div>

                          <div>
                            <div className="flex justify-between text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                              <span>Tolerância / Folga do Furo Fêmea</span>
                              <span className="font-mono text-emerald-600 dark:text-emerald-400">
                                +{cutConnectorClearanceMm.toFixed(2)} mm
                              </span>
                            </div>
                            <input
                              type="range"
                              min={0.05}
                              max={0.45}
                              step={0.05}
                              value={cutConnectorClearanceMm}
                              onChange={(e) =>
                                setCutConnectorClearanceMm(parseFloat(e.target.value))
                              }
                              className="w-full accent-emerald-500"
                            />
                          </div>
                        </>
                      )}
                    </div>

                    <div className="space-y-2 pt-1">
                      <button
                        type="button"
                        onClick={() => void handleApplyPlaneCut()}
                        disabled={isRebuilding}
                        className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-md shadow-emerald-600/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
                      >
                        {isRebuilding ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Cortando e Gerando Encaixes...</span>
                          </>
                        ) : (
                          <>
                            <Scissors className="w-4 h-4" />
                            <span>Aplicar Corte Plano + Encaixes</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleRebuildColorSplit()}
                        disabled={isRebuilding}
                        className="w-full py-2 px-3 rounded-xl border border-slate-300 dark:border-chumbo-700 bg-slate-50 dark:bg-chumbo-950 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-chumbo-800 font-bold text-[11px] flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Desfazer Cortes (Restaurar Peças Originais)</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

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
