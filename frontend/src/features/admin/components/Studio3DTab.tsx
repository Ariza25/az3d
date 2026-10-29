import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  UploadCloud,
  Download,
  Trash2,
  Sparkles,
  Layers,
  Sun,
  Cpu,
  RefreshCw,
  Lock,
  Unlock,
  Info,
  Sliders,
  Terminal,
  FileCode,
  Scissors,
  KeyRound,
  Palette,
} from 'lucide-react';
import {
  Mesh3D,
  ReliefOptions,
  LithophaneOptions,
  loadImageToCanvas,
  generateReliefMesh,
  generateLithophaneMesh,
  exportMeshTo3MF,
  exportMeshToSTL,
  downloadMeshFile,
  parse3MFtoMesh3D,
} from '../../../shared/utils/meshGenerators';
import { ThreeDViewer } from './studio-3d/ThreeDViewer';

export type Studio3DMode = 'emboss' | 'lithophane' | 'sculpture';

interface AiSculptureOptions {
  targetHeightMm: number;
  mcResolution: number;
  colorSlots: number;
  removeBg: boolean;
  foregroundRatio: number;
  flattenBase: boolean;
  smoothIterations: number;
}

export const Studio3DTab: React.FC = () => {
  const [mode, setMode] = useState<Studio3DMode>('emboss');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<number>(1);
  const [imageHasAlpha, setImageHasAlpha] = useState<boolean>(false);
  const [lockAspect, setLockAspect] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Mesh 3D Atual
  const [currentMesh, setCurrentMesh] = useState<Mesh3D | null>(null);
  const [aiSculptureMesh, setAiSculptureMesh] = useState<Mesh3D | null>(null);
  const [aiSculptureBlob, setAiSculptureBlob] = useState<Blob | null>(null);
  const [cachedCanvas, setCachedCanvas] = useState<HTMLCanvasElement | null>(null);

  // Litofania: Backlight
  const [isBacklightOn, setIsBacklightOn] = useState(false);

  // Parâmetros de Relevo / Chaveiro / Logo
  const [reliefOptions, setReliefOptions] = useState<ReliefOptions>({
    widthMm: 90,
    heightMm: 90,
    baseThicknessMm: 2.0,
    reliefHeightMm: 2.4,
    invertRelief: false,
    smoothingRadius: 1,
    borderWidthMm: 0,
    addKeychainHole: false,
    keychainHoleDiameterMm: 4.5,
    cutoutSilhouette: false,
    autoRemoveBg: false,
    alphaThreshold: 0.30,
    flatLogoMode: false,
    contrast: 1.0,
    meshResolution: 260,
  });

  // Parâmetros de Litofania (em pé Z-up)
  const [lithoOptions, setLithoOptions] = useState<LithophaneOptions>({
    widthMm: 120,
    heightMm: 90,
    minThicknessMm: 0.8,
    maxThicknessMm: 3.0,
    frameWidthMm: 3.0,
    frameThicknessMm: 3.4,
    curveAngleDeg: 30, // 30° = arco autoportante que fica em pé sozinho!
  });

  // Parâmetros da Escultura IA 360° (TripoSR RTX 4060)
  const [aiOptions, setAiOptions] = useState<AiSculptureOptions>({
    targetHeightMm: 85,
    mcResolution: 256,
    colorSlots: 4,
    removeBg: true,
    foregroundRatio: 0.85,
    flattenBase: true,
    smoothIterations: 6,
  });

  // Status do Worker Local RTX 4060
  const [workerUrl, setWorkerUrl] = useState<string>('http://127.0.0.1:8000');
  const [workerStatus, setWorkerStatus] = useState<'checking' | 'online' | 'offline'>('offline');
  const [workerInfo, setWorkerInfo] = useState<{
    gpu_name?: string;
    vram_free_gb?: number;
    rembg_installed?: boolean;
  } | null>(null);
  const [showWorkerModal, setShowWorkerModal] = useState<boolean>(false);
  const [isGeneratingAi, setIsGeneratingAi] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const checkWorkerStatus = useCallback(async () => {
    setWorkerStatus('checking');
    try {
      const res = await fetch(`${workerUrl}/health`, { signal: AbortSignal.timeout(2500) });
      if (res.ok) {
        const data = await res.json();
        setWorkerStatus('online');
        setWorkerInfo(data);
      } else {
        setWorkerStatus('offline');
        setWorkerInfo(null);
      }
    } catch {
      setWorkerStatus('offline');
      setWorkerInfo(null);
    }
  }, [workerUrl]);

  useEffect(() => {
    void checkWorkerStatus();
  }, [checkWorkerStatus]);

  // Recarregar canvas quando a resolução da malha for alterada pelo usuário
  useEffect(() => {
    if (!selectedFile) return;
    let cancelled = false;
    const res = reliefOptions.meshResolution || 260;
    loadImageToCanvas(selectedFile, res)
      .then(({ canvas }) => {
        if (!cancelled) {
          setCachedCanvas(canvas);
        }
      })
      .catch((err) => console.error('Falha ao atualizar resolução do canvas:', err));
    return () => {
      cancelled = true;
    };
  }, [selectedFile, reliefOptions.meshResolution]);

  // Carregar e processar nova imagem selecionada
  const handleFileChange = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione um arquivo de imagem válido (PNG, JPEG ou WebP).');
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setIsProcessing(true);
    setStatusMessage('Analisando imagem e construindo geometria 3D estanque...');

    try {
      const res = reliefOptions.meshResolution || 260;
      const { canvas, aspect, hasAlpha } = await loadImageToCanvas(file, res);
      setCachedCanvas(canvas);
      setAspectRatio(aspect);
      setImageHasAlpha(hasAlpha);
      setAiSculptureMesh(null);
      setAiSculptureBlob(null);

      // Se a imagem já vier com fundo transparente (PNG de logo/adesivo), ativamos recorte de silhueta automaticamente!
      const newReliefW = 90;
      const newReliefH = Math.max(20, Math.round(newReliefW / aspect));
      const updatedRelief: ReliefOptions = {
        ...reliefOptions,
        widthMm: newReliefW,
        heightMm: newReliefH,
        cutoutSilhouette: hasAlpha ? true : reliefOptions.cutoutSilhouette,
        flatLogoMode: hasAlpha ? true : reliefOptions.flatLogoMode,
      };
      setReliefOptions(updatedRelief);

      const newLithoW = 120;
      const newLithoH = Math.max(30, Math.round(newLithoW / aspect));
      const updatedLitho: LithophaneOptions = {
        ...lithoOptions,
        widthMm: newLithoW,
        heightMm: newLithoH,
      };
      setLithoOptions(updatedLitho);

      if (mode === 'emboss') {
        setCurrentMesh(generateReliefMesh(canvas, updatedRelief));
      } else if (mode === 'lithophane') {
        setCurrentMesh(generateLithophaneMesh(canvas, updatedLitho));
      } else {
        setCurrentMesh(null);
      }
      setStatusMessage(null);
    } catch (err) {
      console.error(err);
      setStatusMessage('Erro ao processar imagem.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Troca de modo com sincronização do visualizador 3D
  const handleSelectMode = (newMode: Studio3DMode) => {
    setMode(newMode);
    if (newMode === 'sculpture') {
      setCurrentMesh(aiSculptureMesh);
    } else if (newMode === 'emboss' && cachedCanvas) {
      setCurrentMesh(generateReliefMesh(cachedCanvas, reliefOptions));
    } else if (newMode === 'lithophane' && cachedCanvas) {
      setCurrentMesh(generateLithophaneMesh(cachedCanvas, lithoOptions));
    }
  };

  // Recalcular malha quando os parâmetros mudam (com debounce responsivo)
  useEffect(() => {
    if (!cachedCanvas || mode === 'sculpture') return;

    const timer = setTimeout(() => {
      try {
        if (mode === 'emboss') {
          setCurrentMesh(generateReliefMesh(cachedCanvas, reliefOptions));
        } else if (mode === 'lithophane') {
          setCurrentMesh(generateLithophaneMesh(cachedCanvas, lithoOptions));
        }
      } catch (err) {
        console.error('Erro ao recalcular malha:', err);
      }
    }, 65);

    return () => clearTimeout(timer);
  }, [cachedCanvas, mode, reliefOptions, lithoOptions]);

  const handleWidthChange = (rawW: number) => {
    const newW = Math.max(15, Math.min(256, rawW || 20));
    if (mode === 'emboss') {
      const newH = lockAspect ? Math.max(15, Math.round(newW / aspectRatio)) : reliefOptions.heightMm;
      setReliefOptions((prev) => ({ ...prev, widthMm: newW, heightMm: newH }));
    } else {
      const newH = lockAspect ? Math.max(20, Math.round(newW / aspectRatio)) : lithoOptions.heightMm;
      setLithoOptions((prev) => ({ ...prev, widthMm: newW, heightMm: newH }));
    }
  };

  const handleHeightChange = (rawH: number) => {
    const newH = Math.max(15, Math.min(256, rawH || 20));
    if (mode === 'emboss') {
      const newW = lockAspect ? Math.max(15, Math.round(newH * aspectRatio)) : reliefOptions.widthMm;
      setReliefOptions((prev) => ({ ...prev, widthMm: newW, heightMm: newH }));
    } else {
      const newW = lockAspect ? Math.max(20, Math.round(newH * aspectRatio)) : lithoOptions.widthMm;
      setLithoOptions((prev) => ({ ...prev, widthMm: newW, heightMm: newH }));
    }
  };

  // Gerar Escultura 3D 360° na RTX 4060
  const handleGenerateAiSculpture = async () => {
    if (!selectedFile) {
      alert('Selecione uma imagem primeiro.');
      return;
    }
    if (workerStatus !== 'online') {
      setShowWorkerModal(true);
      return;
    }

    setIsGeneratingAi(true);
    setStatusMessage(
      `Recortando objeto 1:1 e reconstruindo volume 3D (${aiOptions.mcResolution}³) na RTX 4060...`
    );

    try {
      const formData = new FormData();
      formData.append('image', selectedFile);
      formData.append('format', '3mf');
      formData.append('mc_resolution', String(aiOptions.mcResolution));
      formData.append('foreground_ratio', String(aiOptions.foregroundRatio));
      formData.append('remove_bg', String(aiOptions.removeBg));
      formData.append('target_height_mm', String(aiOptions.targetHeightMm));
      formData.append('smooth_iterations', String(aiOptions.smoothIterations));
      formData.append('flatten_base', String(aiOptions.flattenBase));
      formData.append('color_slots', String(aiOptions.colorSlots));

      const response = await fetch(`${workerUrl}/generate-3d`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Worker retornou erro: ${errorText}`);
      }

      const blob = await response.blob();
      setAiSculptureBlob(blob);

      const baseName = selectedFile.name.replace(/\.[^/.]+$/, '');
      downloadMeshFile(blob, `${baseName}_Escultura_3D_Bambu.3mf`);

      try {
        const parsedMesh = await parse3MFtoMesh3D(blob);
        setAiSculptureMesh(parsedMesh);
        setCurrentMesh(parsedMesh);
        const detectedColors = response.headers.get('X-Colors') || String(aiOptions.colorSlots);
        setStatusMessage(
          `Escultura 360° concluída com sucesso (${parsedMesh.triangleCount.toLocaleString()} faces, ${detectedColors} cor(es) AMS) e baixada em .3MF!`
        );
      } catch (parseErr) {
        console.warn('Não foi possível renderizar prévia do 3MF:', parseErr);
        setStatusMessage('Arquivo .3MF gerado na RTX 4060 e baixado com sucesso.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(err);
      alert(`Falha na geração via IA: ${msg}`);
      setStatusMessage(null);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // Exportar .3MF para Bambu Lab
  const handleExport3MF = async () => {
    if (!selectedFile) return;
    const baseName = selectedFile.name.replace(/\.[^/.]+$/, '');

    if (mode === 'sculpture' && aiSculptureBlob) {
      downloadMeshFile(aiSculptureBlob, `${baseName}_Escultura_3D_Bambu.3mf`);
      return;
    }

    if (!currentMesh) return;
    try {
      setIsProcessing(true);
      const modeName =
        mode === 'emboss'
          ? reliefOptions.cutoutSilhouette
            ? 'Chaveiro_Logo'
            : 'Relevo'
          : 'Litofania';
      const fileName = `${baseName}_${modeName}_Bambu.3mf`;
      const blob = await exportMeshTo3MF(currentMesh, `${baseName}_${modeName}`);
      downloadMeshFile(blob, fileName);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Erro ao gerar .3MF: ${msg}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Exportar .STL Alternativo
  const handleExportSTL = () => {
    if (!currentMesh || !selectedFile) return;
    try {
      const baseName = selectedFile.name.replace(/\.[^/.]+$/, '');
      const fileName = `${baseName}_3D.stl`;
      const blob = exportMeshToSTL(currentMesh);
      downloadMeshFile(blob, fileName);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Erro ao gerar .STL: ${msg}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-chumbo-800 pb-5">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-500" />
            Estúdio 3D (2D ➔ 3MF para Bambu Lab)
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            Gere chaveiros recortados, logos 3D, litofanias verticais e esculturas 360° multicor prontas para fatiar.
          </p>
        </div>

        {/* Status da RTX 4060 */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowWorkerModal(true)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-mono font-medium transition-all shadow-sm ${
              workerStatus === 'online'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700/60 text-emerald-700 dark:text-emerald-300'
                : 'bg-slate-100 dark:bg-chumbo-800/80 border-slate-300 dark:border-chumbo-700 text-slate-600 dark:text-slate-300 hover:border-slate-400'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                workerStatus === 'online'
                  ? 'bg-emerald-500 animate-pulse'
                  : workerStatus === 'checking'
                  ? 'bg-amber-400 animate-ping'
                  : 'bg-slate-400'
              }`}
            />
            <Cpu className="w-3.5 h-3.5" />
            <span>
              {workerStatus === 'online'
                ? `RTX 4060 Online (${workerInfo?.gpu_name || 'GPU'})`
                : 'Worker RTX 4060 Local (Configurar)'}
            </span>
          </button>
        </div>
      </div>

      {/* Seletores de Modo (Pills) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => handleSelectMode('emboss')}
          className={`flex items-start gap-3 p-3.5 rounded-2xl border text-left transition-all ${
            mode === 'emboss'
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500 text-slate-900 dark:text-white shadow-md shadow-emerald-500/10'
              : 'bg-white dark:bg-chumbo-900 border-slate-200 dark:border-chumbo-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-chumbo-700'
          }`}
        >
          <div
            className={`p-2.5 rounded-xl shrink-0 ${
              mode === 'emboss'
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-chumbo-800 text-slate-500 dark:text-slate-300'
            }`}
          >
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold flex items-center gap-1.5">
              <span>Logo 3D / Chaveiro / Relevo</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">
                Instantâneo
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
              Recorte exato de silhueta para logos e chaveiros com argola integrada, ou placas de alto/baixo relevo.
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => handleSelectMode('lithophane')}
          className={`flex items-start gap-3 p-3.5 rounded-2xl border text-left transition-all ${
            mode === 'lithophane'
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500 text-slate-900 dark:text-white shadow-md shadow-emerald-500/10'
              : 'bg-white dark:bg-chumbo-900 border-slate-200 dark:border-chumbo-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-chumbo-700'
          }`}
        >
          <div
            className={`p-2.5 rounded-xl shrink-0 ${
              mode === 'lithophane'
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-chumbo-800 text-slate-500 dark:text-slate-300'
            }`}
          >
            <Sun className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold flex items-center gap-1.5">
              <span>Litofania Vertical (Luz)</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">
                Instantâneo
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
              Já gerada em pé na mesa (máxima nitidez XY) com arco autoportante e simulação realista de lâmpada.
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => handleSelectMode('sculpture')}
          className={`flex items-start gap-3 p-3.5 rounded-2xl border text-left transition-all ${
            mode === 'sculpture'
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500 text-slate-900 dark:text-white shadow-md shadow-emerald-500/10'
              : 'bg-white dark:bg-chumbo-900 border-slate-200 dark:border-chumbo-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-chumbo-700'
          }`}
        >
          <div
            className={`p-2.5 rounded-xl shrink-0 ${
              mode === 'sculpture'
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-chumbo-800 text-slate-500 dark:text-slate-300'
            }`}
          >
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold flex items-center gap-1.5">
              <span>Escultura 360° (IA RTX 4060)</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                Multicor AMS
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
              Reconstrução volumétrica 360° com recorte automático de fundo, suavização Taubin e pintura 3MF AMS.
            </p>
          </div>
        </button>
      </div>

      {/* Grid Principal: Configurações na Esquerda e Viewport 3D na Direita */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Painel Esquerdo: Upload e Parâmetros (5 colunas) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Zona de Upload de Imagem */}
          <div className="bg-white dark:bg-chumbo-900 border border-slate-200 dark:border-chumbo-800 rounded-2xl p-5 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
              <UploadCloud className="w-4 h-4 text-emerald-500" />
              1. Imagem de Origem (PNG, JPG ou WebP)
            </h3>

            {!previewUrl ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    void handleFileChange(e.dataTransfer.files[0]);
                  }
                }}
                className="border-2 border-dashed border-slate-300 dark:border-chumbo-700 hover:border-emerald-500 dark:hover:border-emerald-500/80 rounded-2xl p-6 text-center cursor-pointer transition-colors bg-slate-50 dark:bg-chumbo-950/40"
              >
                <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center mb-2">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  Arraste ou clique para selecionar uma imagem
                </p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                  PNG com transparência já recorta o formato exato da peça automaticamente!
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-chumbo-950 border border-slate-200 dark:border-chumbo-800">
                <img
                  src={previewUrl}
                  alt="Pré-visualização"
                  className="w-14 h-14 object-contain rounded-lg border border-slate-200 dark:border-chumbo-700 bg-white/90 p-0.5"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                    {selectedFile?.name}
                  </p>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                    {selectedFile && `${(selectedFile.size / 1024).toFixed(1)} KB`} •{' '}
                    {imageHasAlpha ? 'PNG Transparente' : `Proporção ${aspectRatio.toFixed(2)}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="Trocar imagem"
                  className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-chumbo-800 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (previewUrl) URL.revokeObjectURL(previewUrl);
                    setSelectedFile(null);
                    setPreviewUrl(null);
                    setCurrentMesh(null);
                    setAiSculptureMesh(null);
                    setAiSculptureBlob(null);
                    setCachedCanvas(null);
                  }}
                  title="Remover"
                  className="p-2 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  void handleFileChange(e.target.files[0]);
                }
              }}
              className="hidden"
            />
          </div>

          {/* Parâmetros do Modo Relevo / Chaveiro / Logo */}
          {mode === 'emboss' && (
            <div className="bg-white dark:bg-chumbo-900 border border-slate-200 dark:border-chumbo-800 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-emerald-500" />
                  2. Geometria da Peça (Bambu Lab)
                </h3>

                {/* Seletor de Qualidade da Malha */}
                <select
                  value={reliefOptions.meshResolution || 260}
                  onChange={(e) =>
                    setReliefOptions((prev) => ({
                      ...prev,
                      meshResolution: parseInt(e.target.value, 10),
                    }))
                  }
                  className="px-2 py-1 text-[11px] font-bold rounded-lg border border-slate-300 dark:border-chumbo-700 bg-slate-50 dark:bg-chumbo-950 text-slate-700 dark:text-slate-200"
                  title="Resolução da Malha 3D"
                >
                  <option value={180}>Malha Padrão (180px)</option>
                  <option value={260}>Alta Nitidez (260px)</option>
                  <option value={340}>Ultra Nitidez (340px)</option>
                </select>
              </div>

              {/* Modo Silhueta Recortada vs Placa Retangular */}
              <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-800/60 space-y-2.5">
                <label className="flex items-center justify-between gap-2 cursor-pointer">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                    <Scissors className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    Recortar Silhueta Exata (Logo / Adesivo)
                  </span>
                  <input
                    type="checkbox"
                    checked={Boolean(reliefOptions.cutoutSilhouette)}
                    onChange={(e) =>
                      setReliefOptions((prev) => ({
                        ...prev,
                        cutoutSilhouette: e.target.checked,
                      }))
                    }
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                </label>

                {!imageHasAlpha && (
                  <label className="flex items-center justify-between gap-2 cursor-pointer pt-1 border-t border-emerald-200/60 dark:border-emerald-800/40">
                    <span className="text-[11px] text-slate-700 dark:text-slate-300">
                      Remover fundo sólido da imagem (JPG/PNG opaco)
                    </span>
                    <input
                      type="checkbox"
                      checked={Boolean(reliefOptions.autoRemoveBg) || Boolean(reliefOptions.cutoutSilhouette)}
                      onChange={(e) =>
                        setReliefOptions((prev) => ({
                          ...prev,
                          autoRemoveBg: e.target.checked,
                        }))
                      }
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                  </label>
                )}

                <label className="flex items-center justify-between gap-2 cursor-pointer pt-1 border-t border-emerald-200/60 dark:border-emerald-800/40">
                  <span className="text-[11px] text-slate-700 dark:text-slate-300">
                    Modo Logo Chapada (Altura uniforme nítida)
                  </span>
                  <input
                    type="checkbox"
                    checked={Boolean(reliefOptions.flatLogoMode)}
                    onChange={(e) =>
                      setReliefOptions((prev) => ({
                        ...prev,
                        flatLogoMode: e.target.checked,
                      }))
                    }
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                </label>
              </div>

              {/* Dimensões X e Y */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Largura X (mm)
                  </label>
                  <input
                    type="number"
                    min={15}
                    max={256}
                    value={reliefOptions.widthMm}
                    onChange={(e) => handleWidthChange(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-chumbo-700 bg-white dark:bg-chumbo-950 font-mono text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Altura Y (mm)
                    </label>
                    <button
                      type="button"
                      onClick={() => setLockAspect(!lockAspect)}
                      title={lockAspect ? 'Travar proporção' : 'Destravar proporção'}
                      className="text-slate-400 hover:text-emerald-500"
                    >
                      {lockAspect ? (
                        <Lock className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Unlock className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                  <input
                    type="number"
                    min={15}
                    max={256}
                    value={reliefOptions.heightMm}
                    onChange={(e) => handleHeightChange(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-chumbo-700 bg-white dark:bg-chumbo-950 font-mono text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              {/* Espessura da Base e Altura do Relevo */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    <span>Base</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400">
                      {reliefOptions.baseThicknessMm.toFixed(1)} mm
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.8}
                    max={6.0}
                    step={0.2}
                    value={reliefOptions.baseThicknessMm}
                    onChange={(e) =>
                      setReliefOptions({ ...reliefOptions, baseThicknessMm: parseFloat(e.target.value) })
                    }
                    className="w-full accent-emerald-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    <span>Relevo Z</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400">
                      {reliefOptions.reliefHeightMm.toFixed(1)} mm
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.4}
                    max={8.0}
                    step={0.2}
                    value={reliefOptions.reliefHeightMm}
                    onChange={(e) =>
                      setReliefOptions({ ...reliefOptions, reliefHeightMm: parseFloat(e.target.value) })
                    }
                    className="w-full accent-emerald-500"
                  />
                </div>
              </div>

              {/* Argola / Furo de Chaveiro e Moldura */}
              <div className="pt-2 border-t border-slate-100 dark:border-chumbo-800 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={reliefOptions.addKeychainHole}
                      onChange={(e) =>
                        setReliefOptions({ ...reliefOptions, addKeychainHole: e.target.checked })
                      }
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                      Adicionar Argola / Furo de Chaveiro
                    </span>
                  </label>
                  {reliefOptions.addKeychainHole && (
                    <span className="text-xs font-mono text-amber-600 dark:text-amber-400">
                      Ø {reliefOptions.keychainHoleDiameterMm.toFixed(1)} mm
                    </span>
                  )}
                </div>

                {reliefOptions.addKeychainHole && (
                  <input
                    type="range"
                    min={2.5}
                    max={7.5}
                    step={0.5}
                    value={reliefOptions.keychainHoleDiameterMm}
                    onChange={(e) =>
                      setReliefOptions({
                        ...reliefOptions,
                        keychainHoleDiameterMm: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-amber-500"
                  />
                )}

                {!reliefOptions.cutoutSilhouette && (
                  <div>
                    <div className="flex justify-between text-xs text-slate-700 dark:text-slate-300 mb-1">
                      <span>Moldura Elevada da Placa</span>
                      <span className="font-mono text-slate-500">{reliefOptions.borderWidthMm.toFixed(1)} mm</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={8}
                      step={0.5}
                      value={reliefOptions.borderWidthMm}
                      onChange={(e) =>
                        setReliefOptions({ ...reliefOptions, borderWidthMm: parseFloat(e.target.value) })
                      }
                      className="w-full accent-emerald-500"
                    />
                  </div>
                )}

                {!reliefOptions.flatLogoMode && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex justify-between text-xs text-slate-700 dark:text-slate-300 mb-1">
                        <span>Contraste</span>
                        <span className="font-mono text-slate-500">
                          {(reliefOptions.contrast ?? 1.0).toFixed(1)}×
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0.6}
                        max={2.2}
                        step={0.1}
                        value={reliefOptions.contrast ?? 1.0}
                        onChange={(e) =>
                          setReliefOptions({ ...reliefOptions, contrast: parseFloat(e.target.value) })
                        }
                        className="w-full accent-emerald-500"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs text-slate-700 dark:text-slate-300 mb-1">
                        <span>Suavização</span>
                        <span className="font-mono text-slate-500">{reliefOptions.smoothingRadius}px</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={4}
                        step={1}
                        value={reliefOptions.smoothingRadius}
                        onChange={(e) =>
                          setReliefOptions({
                            ...reliefOptions,
                            smoothingRadius: parseInt(e.target.value, 10),
                          })
                        }
                        className="w-full accent-emerald-500"
                      />
                    </div>
                  </div>
                )}

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reliefOptions.invertRelief}
                    onChange={(e) => setReliefOptions({ ...reliefOptions, invertRelief: e.target.checked })}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-xs text-slate-700 dark:text-slate-300">
                    Inverter Tons do Objeto (Escuro mais alto / Claro entalhado)
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Parâmetros do Modo Litofania */}
          {mode === 'lithophane' && (
            <div className="bg-white dark:bg-chumbo-900 border border-slate-200 dark:border-chumbo-800 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-emerald-500" />
                  2. Parâmetros da Litofania Vertical
                </h3>
                <button
                  type="button"
                  onClick={() => setIsBacklightOn(!isBacklightOn)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 border transition-all ${
                    isBacklightOn
                      ? 'bg-amber-500/20 border-amber-500 text-amber-700 dark:text-amber-300'
                      : 'bg-slate-100 dark:bg-chumbo-800 border-slate-300 dark:border-chumbo-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <Sun className="w-3.5 h-3.5" />
                  <span>{isBacklightOn ? 'Luz Acesa' : 'Simular Luz'}</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Largura X (mm)
                  </label>
                  <input
                    type="number"
                    min={30}
                    max={256}
                    value={lithoOptions.widthMm}
                    onChange={(e) => handleWidthChange(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-chumbo-700 bg-white dark:bg-chumbo-950 font-mono text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Altura Vertical Z (mm)
                    </label>
                    <button
                      type="button"
                      onClick={() => setLockAspect(!lockAspect)}
                      title={lockAspect ? 'Travar proporção' : 'Destravar proporção'}
                      className="text-slate-400 hover:text-emerald-500"
                    >
                      {lockAspect ? (
                        <Lock className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Unlock className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                  <input
                    type="number"
                    min={30}
                    max={256}
                    value={lithoOptions.heightMm}
                    onChange={(e) => handleHeightChange(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-chumbo-700 bg-white dark:bg-chumbo-950 font-mono text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Mínima (Brilho máximo)
                  </label>
                  <input
                    type="number"
                    step={0.1}
                    min={0.4}
                    max={1.6}
                    value={lithoOptions.minThicknessMm}
                    onChange={(e) =>
                      setLithoOptions({ ...lithoOptions, minThicknessMm: parseFloat(e.target.value) || 0.8 })
                    }
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-chumbo-700 bg-white dark:bg-chumbo-950 font-mono text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Máxima (Sombra escura)
                  </label>
                  <input
                    type="number"
                    step={0.1}
                    min={1.8}
                    max={4.5}
                    value={lithoOptions.maxThicknessMm}
                    onChange={(e) =>
                      setLithoOptions({ ...lithoOptions, maxThicknessMm: parseFloat(e.target.value) || 3.0 })
                    }
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-chumbo-700 bg-white dark:bg-chumbo-950 font-mono text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-chumbo-800 space-y-3">
                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    <span>Moldura de Reforço</span>
                    <span className="font-mono text-slate-500">{lithoOptions.frameWidthMm} mm</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={8}
                    step={1}
                    value={lithoOptions.frameWidthMm}
                    onChange={(e) =>
                      setLithoOptions({ ...lithoOptions, frameWidthMm: parseInt(e.target.value, 10) })
                    }
                    className="w-full accent-emerald-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    <span>Curvatura Autoportante (Em Pé)</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400">
                      {lithoOptions.curveAngleDeg}°
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={75}
                    step={15}
                    value={lithoOptions.curveAngleDeg}
                    onChange={(e) =>
                      setLithoOptions({ ...lithoOptions, curveAngleDeg: parseInt(e.target.value, 10) })
                    }
                    className="w-full accent-emerald-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    A base já é nivelada em Z=0 para imprimir em pé com máxima definição e sem suportes!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Parâmetros do Modo Escultura 360° (RTX 4060) */}
          {mode === 'sculpture' && (
            <div className="bg-white dark:bg-chumbo-900 border border-slate-200 dark:border-chumbo-800 rounded-2xl p-5 shadow-sm space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-blue-500" />
                2. Escultura Volumétrica 360° (TripoSR GPU)
              </h3>

              <div className="p-3.5 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 text-xs text-blue-900 dark:text-blue-200 space-y-2">
                <div className="flex items-center justify-between font-bold">
                  <span>Status do Worker RTX 4060:</span>
                  <span
                    className={`font-mono px-2 py-0.5 rounded text-[11px] ${
                      workerStatus === 'online'
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-300 dark:bg-chumbo-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {workerStatus === 'online' ? '🟢 ONLINE' : '🔴 DESCONECTADO'}
                  </span>
                </div>
                <p className="text-[11px] text-blue-700 dark:text-blue-300 leading-relaxed">
                  Isola o objeto em proporção quadrada 1:1, reconstrói a malha 360° em alta resolução, remove ruídos flutuantes e gera pintura 3MF compatível com AMS e com o Divisor Split3MF!
                </p>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowWorkerModal(true)}
                    className="text-xs font-bold underline hover:text-blue-600 dark:hover:text-blue-400"
                  >
                    Instruções do Worker
                  </button>
                  <span className="text-slate-400">•</span>
                  <button
                    type="button"
                    onClick={() => void checkWorkerStatus()}
                    className="text-xs font-bold underline hover:text-blue-600 dark:hover:text-blue-400"
                  >
                    Testar Conexão
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Altura Final (mm)
                  </label>
                  <input
                    type="number"
                    min={25}
                    max={230}
                    value={aiOptions.targetHeightMm}
                    onChange={(e) =>
                      setAiOptions((prev) => ({
                        ...prev,
                        targetHeightMm: Math.max(25, Math.min(230, Number(e.target.value) || 80)),
                      }))
                    }
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-chumbo-700 bg-white dark:bg-chumbo-950 font-mono text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Resolução 3D (Voxel)
                  </label>
                  <select
                    value={aiOptions.mcResolution}
                    onChange={(e) =>
                      setAiOptions((prev) => ({
                        ...prev,
                        mcResolution: parseInt(e.target.value, 10),
                      }))
                    }
                    className="w-full px-2.5 py-2 text-xs rounded-xl border border-slate-300 dark:border-chumbo-700 bg-white dark:bg-chumbo-950 font-semibold text-slate-900 dark:text-slate-100"
                  >
                    <option value={192}>192³ (Rápida)</option>
                    <option value={256}>256³ (Alta Nitidez)</option>
                    <option value={300}>300³ (Ultra Detalhe)</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  <span className="flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-amber-500" />
                    Cores Pintadas no .3MF (AMS / Split3MF)
                  </span>
                  <span className="font-mono text-amber-600 dark:text-amber-400">
                    {aiOptions.colorSlots === 1 ? 'Monocor' : `${aiOptions.colorSlots} Filamentos`}
                  </span>
                </div>
                <select
                  value={aiOptions.colorSlots}
                  onChange={(e) =>
                    setAiOptions((prev) => ({
                      ...prev,
                      colorSlots: parseInt(e.target.value, 10),
                    }))
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-chumbo-700 bg-white dark:bg-chumbo-950 font-semibold text-slate-900 dark:text-slate-100"
                >
                  <option value={1}>1 Cor (Sólido Monocromático)</option>
                  <option value={2}>2 Cores (Bicolor Pintado)</option>
                  <option value={4}>4 Cores (Bambu AMS Padrão)</option>
                  <option value={6}>6 Cores (Multicor Estendido)</option>
                </select>
              </div>

              <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-chumbo-800">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-xs text-slate-700 dark:text-slate-300">
                    Recortar fundo e centralizar proporção 1:1
                  </span>
                  <input
                    type="checkbox"
                    checked={aiOptions.removeBg}
                    onChange={(e) => setAiOptions((prev) => ({ ...prev, removeBg: e.target.checked }))}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-xs text-slate-700 dark:text-slate-300">
                    Nivelar base (0.45 mm) para aderência na mesa PEI
                  </span>
                  <input
                    type="checkbox"
                    checked={aiOptions.flattenBase}
                    onChange={(e) => setAiOptions((prev) => ({ ...prev, flattenBase: e.target.checked }))}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                </label>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Endereço do Worker Local
                </label>
                <input
                  type="text"
                  value={workerUrl}
                  onChange={(e) => setWorkerUrl(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-chumbo-700 bg-white dark:bg-chumbo-950 font-mono text-slate-900 dark:text-slate-100"
                  placeholder="http://127.0.0.1:8000"
                />
              </div>

              <button
                type="button"
                onClick={() => void handleGenerateAiSculpture()}
                disabled={!selectedFile || isGeneratingAi}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {isGeneratingAi ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span className="text-white">Processando na RTX 4060...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-white" />
                    <span className="text-white">Gerar Escultura 3D na RTX 4060</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Botões de Exportação (todos os modos quando há malha pronta) */}
          {(mode !== 'sculpture' || currentMesh) && (
            <div className="bg-white dark:bg-chumbo-900 border border-slate-200 dark:border-chumbo-800 rounded-2xl p-5 shadow-sm space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Download className="w-4 h-4 text-emerald-500" />
                3. Exportar Arquivo para o Fatiador
              </h3>

              <button
                type="button"
                onClick={() => void handleExport3MF()}
                disabled={!currentMesh || isProcessing}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4 text-white" />
                <span className="text-white">Baixar Arquivo .3MF (Bambu Lab)</span>
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleExportSTL}
                  disabled={!currentMesh}
                  className="flex-1 py-2 px-3 text-xs font-semibold rounded-xl border border-slate-300 dark:border-chumbo-700 bg-slate-50 dark:bg-chumbo-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-chumbo-700 transition-colors flex items-center justify-center disabled:opacity-50"
                >
                  <FileCode className="w-3.5 h-3.5 mr-1.5" />
                  Baixar .STL Alternativo
                </button>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-chumbo-950 border border-slate-200 dark:border-chumbo-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-start gap-2">
                <Info className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <p>
                  <strong>Pronto para Bambu Studio / Split3MF:</strong> O modelo já sai assentado em{' '}
                  <code>Z = 0</code> e centralizado na mesa 256×256 mm. Esculturas multicor também podem ser divididas em peças de encaixe na aba <strong>Divisor 3MF</strong>!
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Painel Direito: Viewport 3D Interativo (7 colunas) */}
        <div className="lg:col-span-7">
          <ThreeDViewer
            mesh={currentMesh}
            mode={mode}
            isBacklightOn={isBacklightOn}
            onToggleBacklight={() => setIsBacklightOn(!isBacklightOn)}
          />

          {statusMessage && (
            <div className="mt-3 p-3 rounded-xl bg-slate-100 dark:bg-chumbo-900 border border-slate-200 dark:border-chumbo-800 text-xs text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Sparkles className={`w-4 h-4 text-emerald-500 shrink-0 ${isGeneratingAi || isProcessing ? 'animate-spin' : ''}`} />
              <span>{statusMessage}</span>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Instruções do Worker Local RTX 4060 */}
      {showWorkerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-chumbo-900 border border-slate-200 dark:border-chumbo-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl relative">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-chumbo-800 pb-3">
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-emerald-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Como Rodar o Worker Local na sua RTX 4060
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowWorkerModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-600 dark:text-slate-300">
              <p>
                O seu computador pessoal atua como um <strong>Worker acelerado por GPU</strong> para reconstruir modelos 3D volumétricos 360° com recorte inteligente de silhueta e pintura multicor sem custos de API.
              </p>

              <div className="space-y-2">
                <p className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Terminal className="w-4 h-4 text-emerald-500" />
                  Passo 1: Abrir o terminal na pasta do Worker
                </p>
                <pre className="p-3 rounded-xl bg-slate-950 text-emerald-400 font-mono text-[11px] overflow-x-auto">
                  cd backend/workers
                </pre>
              </div>

              <div className="space-y-2">
                <p className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Terminal className="w-4 h-4 text-emerald-500" />
                  Passo 2: Instalar dependências (opcional: rembg para recorte neural)
                </p>
                <pre className="p-3 rounded-xl bg-slate-950 text-emerald-400 font-mono text-[11px] overflow-x-auto">
{`pip install -r requirements.txt
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121`}
                </pre>
              </div>

              <div className="space-y-2">
                <p className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Terminal className="w-4 h-4 text-emerald-500" />
                  Passo 3: Iniciar o Worker v2.0
                </p>
                <pre className="p-3 rounded-xl bg-slate-950 text-emerald-400 font-mono text-[11px] overflow-x-auto">
                  python worker_3d.py
                </pre>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  void checkWorkerStatus();
                  setShowWorkerModal(false);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold px-5 py-2.5 rounded-xl text-xs shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
              >
                Entendi, verificar conexão
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
