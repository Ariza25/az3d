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

export const Studio3DTab: React.FC = () => {
  const [mode, setMode] = useState<Studio3DMode>('emboss');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<number>(1);
  const [lockAspect, setLockAspect] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Mesh 3D Atual
  const [currentMesh, setCurrentMesh] = useState<Mesh3D | null>(null);
  const [aiSculptureMesh, setAiSculptureMesh] = useState<Mesh3D | null>(null);
  const [cachedCanvas, setCachedCanvas] = useState<HTMLCanvasElement | null>(null);

  // Litofania: Backlight
  const [isBacklightOn, setIsBacklightOn] = useState(false);

  // Parâmetros de Relevo / Chaveiro
  const [reliefOptions, setReliefOptions] = useState<ReliefOptions>({
    widthMm: 100,
    heightMm: 100,
    baseThicknessMm: 2.0,
    reliefHeightMm: 2.5,
    invertRelief: false,
    smoothingRadius: 1,
    borderWidthMm: 0,
    addKeychainHole: false,
    keychainHoleDiameterMm: 4.0,
  });

  // Parâmetros de Litofania
  const [lithoOptions, setLithoOptions] = useState<LithophaneOptions>({
    widthMm: 120,
    heightMm: 90,
    minThicknessMm: 0.8,
    maxThicknessMm: 3.0,
    frameWidthMm: 3.0,
    frameThicknessMm: 3.2,
    curveAngleDeg: 0, // 0 = plano, 45 = arco
  });

  // Parâmetros do Worker Local RTX 4060
  const [workerUrl, setWorkerUrl] = useState<string>('http://127.0.0.1:8000');
  const [workerStatus, setWorkerStatus] = useState<'checking' | 'online' | 'offline'>('offline');
  const [workerInfo, setWorkerInfo] = useState<{ gpu_name?: string; vram_free_gb?: number } | null>(null);
  const [showWorkerModal, setShowWorkerModal] = useState<boolean>(false);
  const [isGeneratingAi, setIsGeneratingAi] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Verificar status do Worker Local da RTX 4060
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

  // Carregar e processar nova imagem selecionada
  const handleFileChange = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione um arquivo de imagem válido (PNG ou JPEG).');
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setIsProcessing(true);
    setStatusMessage('Lendo imagem e gerando malha 3D inicial...');

    try {
      const { canvas, aspect } = await loadImageToCanvas(file, 160);
      setCachedCanvas(canvas);
      setAspectRatio(aspect);

      // Ajustar dimensões preservando proporção
      if (mode === 'emboss') {
        const newW = 100;
        const newH = Math.round(100 / aspect);
        const updatedOpts = { ...reliefOptions, widthMm: newW, heightMm: newH };
        setReliefOptions(updatedOpts);
        const mesh = generateReliefMesh(canvas, updatedOpts);
        setCurrentMesh(mesh);
      } else if (mode === 'lithophane') {
        const newW = 120;
        const newH = Math.round(120 / aspect);
        const updatedOpts = { ...lithoOptions, widthMm: newW, heightMm: newH };
        setLithoOptions(updatedOpts);
        const mesh = generateLithophaneMesh(canvas, updatedOpts);
        setCurrentMesh(mesh);
      } else if (mode === 'sculpture') {
        setCurrentMesh(null);
        setAiSculptureMesh(null);
      }
      setStatusMessage(null);
    } catch (err: any) {
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
    } else if (newMode === 'emboss') {
      if (cachedCanvas) {
        const mesh = generateReliefMesh(cachedCanvas, reliefOptions);
        setCurrentMesh(mesh);
      }
    } else if (newMode === 'lithophane') {
      if (cachedCanvas) {
        const mesh = generateLithophaneMesh(cachedCanvas, lithoOptions);
        setCurrentMesh(mesh);
      }
    }
  };

  // Recalcular malha quando os sliders/inputs mudam (com debounce simples)
  useEffect(() => {
    if (!cachedCanvas) return;
    if (mode === 'sculpture') return; // Escultura é gerada sob demanda na GPU

    const timer = setTimeout(() => {
      try {
        if (mode === 'emboss') {
          const mesh = generateReliefMesh(cachedCanvas, reliefOptions);
          setCurrentMesh(mesh);
        } else if (mode === 'lithophane') {
          const mesh = generateLithophaneMesh(cachedCanvas, lithoOptions);
          setCurrentMesh(mesh);
        }
      } catch (err) {
        console.error('Erro ao recalcular malha:', err);
      }
    }, 80);

    return () => clearTimeout(timer);
  }, [cachedCanvas, mode, reliefOptions, lithoOptions]);

  // Tratar alteração de largura mantendo proporção
  const handleWidthChange = (newW: number) => {
    if (mode === 'emboss') {
      const newH = lockAspect ? Math.round(newW / aspectRatio) : reliefOptions.heightMm;
      setReliefOptions((prev) => ({ ...prev, widthMm: newW, heightMm: newH }));
    } else {
      const newH = lockAspect ? Math.round(newW / aspectRatio) : lithoOptions.heightMm;
      setLithoOptions((prev) => ({ ...prev, widthMm: newW, heightMm: newH }));
    }
  };

  // Tratar alteração de altura mantendo proporção
  const handleHeightChange = (newH: number) => {
    if (mode === 'emboss') {
      const newW = lockAspect ? Math.round(newH * aspectRatio) : reliefOptions.widthMm;
      setReliefOptions((prev) => ({ ...prev, widthMm: newW, heightMm: newH }));
    } else {
      const newW = lockAspect ? Math.round(newH * aspectRatio) : lithoOptions.widthMm;
      setLithoOptions((prev) => ({ ...prev, widthMm: newW, heightMm: newH }));
    }
  };

  // Gerar Escultura 3D na RTX 4060
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
    setStatusMessage('Enviando para a RTX 4060... Processando IA na GPU local...');

    try {
      const formData = new FormData();
      formData.append('image', selectedFile);
      formData.append('format', '3mf');

      const response = await fetch(`${workerUrl}/generate-3d`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Worker retornou erro: ${errorText}`);
      }

      const blob = await response.blob();
      const baseName = selectedFile.name.replace(/\.[^/.]+$/, '');
      downloadMeshFile(blob, `${baseName}_Escultura_3D_Bambu.3mf`);

      // Carregar e renderizar o modelo 3D diretamente no visualizador interativo
      try {
        const parsedMesh = await parse3MFtoMesh3D(blob);
        setAiSculptureMesh(parsedMesh);
        setCurrentMesh(parsedMesh);
        setStatusMessage('Sucesso! Escultura 3D gerada na sua RTX 4060, renderizada no visualizador e baixada em .3MF.');
      } catch (parseErr) {
        console.warn('Não foi possível renderizar prévia do 3MF:', parseErr);
        setStatusMessage('Sucesso! Arquivo .3MF gerado na sua RTX 4060 e baixado.');
      }
    } catch (err: any) {
      console.error(err);
      alert(`Falha na geração via IA: ${err.message}`);
      setStatusMessage(null);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // Exportar .3MF para Bambu Lab
  const handleExport3MF = async () => {
    if (!currentMesh || !selectedFile) return;
    try {
      setIsProcessing(true);
      const baseName = selectedFile.name.replace(/\.[^/.]+$/, '');
      const modeName = mode === 'emboss' ? 'Relevo' : 'Litofania';
      const fileName = `${baseName}_${modeName}_Bambu.3mf`;
      const blob = await exportMeshTo3MF(currentMesh, `${baseName}_${modeName}`);
      downloadMeshFile(blob, fileName);
    } catch (err: any) {
      alert(`Erro ao gerar .3MF: ${err.message}`);
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
    } catch (err: any) {
      alert(`Erro ao gerar .STL: ${err.message}`);
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
            Transforme fotos e imagens 2D em modelos 3D sólidos prontos para fatiar no Bambu Studio ou OrcaSlicer.
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
                ? `RTX 4060 Conectada (${workerInfo?.gpu_name || 'GPU'})`
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
              <span>Relevo 3D / Chaveiro / Logo</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">
                Instantâneo
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
              Cria placas sólidas com altura baseada no brilho. Ideal para logos, chaveiros e placas decorativas.
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
              <span>Litofania 3D (Quadro de Luz)</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">
                Instantâneo
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
              A imagem ganha vida quando colocada contra a luz. Opção de suporte plano ou arco que fica em pé.
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
                GPU Local
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
              Gera volume 3D completo em todos os ângulos processado pela sua placa de vídeo sem gastar API externa.
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
              1. Imagem de Origem (PNG ou JPEG)
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
                  Formatos suportados: PNG, JPG, JPEG ou WebP
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-chumbo-950 border border-slate-200 dark:border-chumbo-800">
                <img
                  src={previewUrl}
                  alt="Pré-visualização"
                  className="w-14 h-14 object-cover rounded-lg border border-slate-200 dark:border-chumbo-700 bg-white"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                    {selectedFile?.name}
                  </p>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                    {selectedFile && `${(selectedFile.size / 1024).toFixed(1)} KB`} • Proporção {aspectRatio.toFixed(2)}
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
                    setSelectedFile(null);
                    setPreviewUrl(null);
                    setCurrentMesh(null);
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

          {/* Parâmetros do Modo Relevo / Chaveiro */}
          {mode === 'emboss' && (
            <div className="bg-white dark:bg-chumbo-900 border border-slate-200 dark:border-chumbo-800 rounded-2xl p-5 shadow-sm space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-emerald-500" />
                2. Parâmetros de Relevo (Bambu Lab)
              </h3>

              {/* Dimensões X e Y */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Largura X (mm)
                  </label>
                  <input
                    type="number"
                    min={20}
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
                      {lockAspect ? <Lock className="w-3.5 h-3.5 text-emerald-500" /> : <Unlock className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <input
                    type="number"
                    min={20}
                    max={256}
                    value={reliefOptions.heightMm}
                    onChange={(e) => handleHeightChange(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-chumbo-700 bg-white dark:bg-chumbo-950 font-mono text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              {/* Espessura da Base */}
              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  <span>Espessura da Base Inferior</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">{reliefOptions.baseThicknessMm.toFixed(1)} mm</span>
                </div>
                <input
                  type="range"
                  min={0.8}
                  max={6.0}
                  step={0.2}
                  value={reliefOptions.baseThicknessMm}
                  onChange={(e) => setReliefOptions({ ...reliefOptions, baseThicknessMm: parseFloat(e.target.value) })}
                  className="w-full accent-emerald-500"
                />
              </div>

              {/* Altura do Relevo */}
              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  <span>Altura do Relevo (Z)</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">{reliefOptions.reliefHeightMm.toFixed(1)} mm</span>
                </div>
                <input
                  type="range"
                  min={0.6}
                  max={8.0}
                  step={0.2}
                  value={reliefOptions.reliefHeightMm}
                  onChange={(e) => setReliefOptions({ ...reliefOptions, reliefHeightMm: parseFloat(e.target.value) })}
                  className="w-full accent-emerald-500"
                />
              </div>

              {/* Inverter e Suavização */}
              <div className="pt-2 border-t border-slate-100 dark:border-chumbo-800 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reliefOptions.invertRelief}
                    onChange={(e) => setReliefOptions({ ...reliefOptions, invertRelief: e.target.checked })}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-xs text-slate-700 dark:text-slate-300">
                    Inverter Relevo (Baixo-relevo / Entalhado)
                  </span>
                </label>

                <div>
                  <div className="flex justify-between text-xs text-slate-700 dark:text-slate-300 mb-1">
                    <span>Filtro de Suavização (Reduz ruído de fotos)</span>
                    <span className="font-mono text-slate-500">{reliefOptions.smoothingRadius}px</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={3}
                    step={1}
                    value={reliefOptions.smoothingRadius}
                    onChange={(e) => setReliefOptions({ ...reliefOptions, smoothingRadius: parseInt(e.target.value, 10) })}
                    className="w-full accent-emerald-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Parâmetros do Modo Litofania */}
          {mode === 'lithophane' && (
            <div className="bg-white dark:bg-chumbo-900 border border-slate-200 dark:border-chumbo-800 rounded-2xl p-5 shadow-sm space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-emerald-500" />
                2. Parâmetros da Litofania
              </h3>

              {/* Dimensões X e Y */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Largura (mm)
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
                      Altura (mm)
                    </label>
                    <button
                      type="button"
                      onClick={() => setLockAspect(!lockAspect)}
                      title={lockAspect ? 'Travar proporção' : 'Destravar proporção'}
                      className="text-slate-400 hover:text-emerald-500"
                    >
                      {lockAspect ? <Lock className="w-3.5 h-3.5 text-emerald-500" /> : <Unlock className="w-3.5 h-3.5" />}
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

              {/* Espessuras Mínima e Máxima */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Mínima (Luz alta)
                  </label>
                  <input
                    type="number"
                    step={0.1}
                    min={0.4}
                    max={1.6}
                    value={lithoOptions.minThicknessMm}
                    onChange={(e) => setLithoOptions({ ...lithoOptions, minThicknessMm: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-chumbo-700 bg-white dark:bg-chumbo-950 font-mono text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Máxima (Sombra)
                  </label>
                  <input
                    type="number"
                    step={0.1}
                    min={1.8}
                    max={4.5}
                    value={lithoOptions.maxThicknessMm}
                    onChange={(e) => setLithoOptions({ ...lithoOptions, maxThicknessMm: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-chumbo-700 bg-white dark:bg-chumbo-950 font-mono text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              {/* Moldura de Reforço e Curvatura */}
              <div className="pt-2 border-t border-slate-100 dark:border-chumbo-800 space-y-3">
                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    <span>Moldura de Borda</span>
                    <span className="font-mono text-slate-500">{lithoOptions.frameWidthMm} mm</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={8}
                    step={1}
                    value={lithoOptions.frameWidthMm}
                    onChange={(e) => setLithoOptions({ ...lithoOptions, frameWidthMm: parseInt(e.target.value, 10) })}
                    className="w-full accent-emerald-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    <span>Curvatura (Arco cilíndrico)</span>
                    <span className="font-mono text-slate-500">{lithoOptions.curveAngleDeg}°</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={60}
                    step={15}
                    value={lithoOptions.curveAngleDeg}
                    onChange={(e) => setLithoOptions({ ...lithoOptions, curveAngleDeg: parseInt(e.target.value, 10) })}
                    className="w-full accent-emerald-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    30° a 45° permite que a litofania fique em pé sozinha na mesa sem cair!
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
                2. Processamento Local na RTX 4060
              </h3>

              <div className="p-3.5 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 text-xs text-blue-900 dark:text-blue-200 space-y-2">
                <div className="flex items-center justify-between font-bold">
                  <span>Status do Worker Local:</span>
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
                  O microserviço Python na sua máquina executa o modelo TripoSR na GPU RTX 4060, gerando um modelo 3D fechado de 360° em cerca de 3 segundos.
                </p>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowWorkerModal(true)}
                    className="text-xs font-bold underline hover:text-blue-600 dark:hover:text-blue-400"
                  >
                    Ver instruções de como iniciar o Worker
                  </button>
                  <span className="text-slate-400">•</span>
                  <button
                    type="button"
                    onClick={checkWorkerStatus}
                    className="text-xs font-bold underline hover:text-blue-600 dark:hover:text-blue-400"
                  >
                    Testar Conexão Novamente
                  </button>
                </div>
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
                onClick={handleGenerateAiSculpture}
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

          {/* Botões de Ação para Relevo e Litofania */}
          {mode !== 'sculpture' && (
            <div className="bg-white dark:bg-chumbo-900 border border-slate-200 dark:border-chumbo-800 rounded-2xl p-5 shadow-sm space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Download className="w-4 h-4 text-emerald-500" />
                3. Exportar Arquivo para o Fatiador
              </h3>

              <button
                type="button"
                onClick={handleExport3MF}
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
                  className="flex-1 py-2 px-3 text-xs font-semibold rounded-xl border border-slate-300 dark:border-chumbo-700 bg-slate-50 dark:bg-chumbo-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-chumbo-700 transition-colors flex items-center justify-center"
                >
                  <FileCode className="w-3.5 h-3.5 mr-1.5" />
                  Baixar .STL Alternativo
                </button>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-chumbo-950 border border-slate-200 dark:border-chumbo-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-start gap-2">
                <Info className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <p>
                  <strong>Como usar no Bambu Studio:</strong> Dê duplo clique no arquivo <code>.3mf</code> baixado. O modelo já abre centralizado na mesa da impressora com as medidas exatas em milímetros.
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
              <Sparkles className="w-4 h-4 text-emerald-500 shrink-0 animate-spin" />
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
                Como seu backend está hospedado no Google Cloud Run, o seu computador pessoal atua como um <strong>Worker acelerado por GPU</strong> para gerar modelos 3D volumétricos completos sem custos de API.
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
                  Passo 2: Instalar as dependências com suporte a CUDA
                </p>
                <pre className="p-3 rounded-xl bg-slate-950 text-emerald-400 font-mono text-[11px] overflow-x-auto">
pip install -r requirements.txt
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
pip install git+https://github.com/VAST-AI-Research/TripoSR.git
                </pre>
              </div>

              <div className="space-y-2">
                <p className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Terminal className="w-4 h-4 text-emerald-500" />
                  Passo 3: Executar o Worker
                </p>
                <pre className="p-3 rounded-xl bg-slate-950 text-emerald-400 font-mono text-[11px] overflow-x-auto">
python worker_3d.py
                </pre>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-[11px] text-emerald-800 dark:text-emerald-300">
                Assim que você iniciar o comando, o status no topo mudará para <strong>🟢 RTX 4060 Conectada</strong> e você poderá gerar quantas esculturas 3D quiser sem limites!
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
