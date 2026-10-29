import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Sun, Box, RotateCcw, Palette } from 'lucide-react';
import { Mesh3D } from '../../../../shared/utils/meshGenerators';

interface ThreeDViewerProps {
  mesh: Mesh3D | null;
  mode: 'emboss' | 'lithophane' | 'sculpture';
  isBacklightOn?: boolean;
  onToggleBacklight?: () => void;
}

export const ThreeDViewer: React.FC<ThreeDViewerProps> = ({
  mesh,
  mode,
  isBacklightOn = false,
  onToggleBacklight,
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const backLightRef = useRef<THREE.PointLight | null>(null);
  const frontLightRef = useRef<THREE.DirectionalLight | null>(null);
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);

  const [wireframe, setWireframe] = useState(false);
  const [materialColor, setMaterialColor] = useState<string>('#FFFFFF');

  const isMouseDown = useRef(false);
  const isRightMouseDown = useRef(false);
  const prevMousePos = useRef({ x: 0, y: 0 });
  const cameraDistance = useRef(180);
  const cameraRotation = useRef({ theta: Math.PI / 5, phi: Math.PI / 3 });
  const targetOffset = useRef(new THREE.Vector3(0, 10, 0));

  const syncCameraTransform = () => {
    const cam = cameraRef.current;
    if (!cam) return;
    const { theta, phi } = cameraRotation.current;
    const r = cameraDistance.current;
    cam.position.x = targetOffset.current.x + r * Math.sin(phi) * Math.sin(theta);
    cam.position.y = targetOffset.current.y + r * Math.cos(phi);
    cam.position.z = targetOffset.current.z + r * Math.sin(phi) * Math.cos(theta);
    cam.lookAt(targetOffset.current);
  };

  // Quando chega uma malha multicor nova, ativar visualização multicor automaticamente
  useEffect(() => {
    if (mesh?.colors) {
      setMaterialColor('MULTICOLOR');
    } else if (materialColor === 'MULTICOLOR') {
      setMaterialColor('#FFFFFF');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesh]);

  // Inicializar Cena Three.js + pausa automática fora da tela (content-visibility / IntersectionObserver)
  useEffect(() => {
    if (!containerRef.current || !wrapperRef.current) return;
    const container = containerRef.current;
    const wrapper = wrapperRef.current;
    const width = container.clientWidth || 500;
    const height = container.clientHeight || 520;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0b1120');
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 2500);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Mesa de Impressão Bambu Lab (256 x 256 mm)
    const bedGroup = new THREE.Group();
    const bedGeo = new THREE.PlaneGeometry(256, 256);
    const bedMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.85,
      metalness: 0.15,
    });
    const bedMesh = new THREE.Mesh(bedGeo, bedMat);
    bedMesh.rotation.x = -Math.PI / 2;
    bedMesh.position.y = -0.08;
    bedMesh.receiveShadow = true;
    bedGroup.add(bedMesh);

    // Divisões inteiras (16 x 16 = blocos de 16 mm na mesa 256x256 mm)
    const gridHelper = new THREE.GridHelper(256, 16, 0x00ae42, 0x334155);
    gridHelper.position.y = 0;
    bedGroup.add(gridHelper);
    scene.add(bedGroup);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.52);
    scene.add(ambientLight);
    ambientLightRef.current = ambientLight;

    const frontLight = new THREE.DirectionalLight(0xffffff, 1.25);
    frontLight.position.set(110, 210, 160);
    frontLight.castShadow = true;
    frontLight.shadow.mapSize.width = 1024;
    frontLight.shadow.mapSize.height = 1024;
    scene.add(frontLight);
    frontLightRef.current = frontLight;

    const fillLight = new THREE.DirectionalLight(0x94a3b8, 0.45);
    fillLight.position.set(-150, 110, -110);
    scene.add(fillLight);

    const backLight = new THREE.PointLight(0xffe4a8, 0, 360);
    backLight.position.set(0, 55, -55);
    scene.add(backLight);
    backLightRef.current = backLight;

    syncCameraTransform();

    let animId: number | null = null;
    let isPaused = false;

    const renderLoop = () => {
      if (isPaused) {
        animId = null;
        return;
      }
      animId = requestAnimationFrame(renderLoop);
      renderer.render(scene, camera);
    };

    const pauseLoop = () => {
      isPaused = true;
      if (animId !== null) {
        cancelAnimationFrame(animId);
        animId = null;
      }
    };

    const resumeLoop = () => {
      if (!isPaused && animId !== null) return;
      isPaused = false;
      if (animId === null) {
        animId = requestAnimationFrame(renderLoop);
      }
    };

    resumeLoop();

    // Pausa eficiente quando fora da viewport (contentvisibilityautostatechange direto no elemento + fallback IO)
    const supportsContentVisibility =
      typeof document !== 'undefined' && 'contentVisibility' in document.documentElement.style;

    let intersectionObserver: IntersectionObserver | null = null;
    const handleContentVisibilityChange = (ev: Event) => {
      const skipped = Boolean((ev as Event & { skipped?: boolean }).skipped);
      if (skipped) {
        pauseLoop();
      } else {
        resumeLoop();
      }
    };

    if (supportsContentVisibility) {
      wrapper.addEventListener('contentvisibilityautostatechange', handleContentVisibilityChange);
    } else if (typeof IntersectionObserver !== 'undefined') {
      intersectionObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              resumeLoop();
            } else {
              pauseLoop();
            }
          }
        },
        { rootMargin: '200px' }
      );
      intersectionObserver.observe(wrapper);
    }

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        const h = entry.contentRect.height;
        if (w > 0 && h > 0) {
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        }
      }
    });
    resizeObserver.observe(container);

    return () => {
      pauseLoop();
      if (supportsContentVisibility) {
        wrapper.removeEventListener('contentvisibilityautostatechange', handleContentVisibilityChange);
      }
      if (intersectionObserver) {
        intersectionObserver.disconnect();
      }
      resizeObserver.disconnect();
      renderer.dispose();
    };
  }, []);

  // Enquadrar câmera apenas quando um novo mesh ou modo for carregado
  useEffect(() => {
    if (!mesh) return;
    const maxDim = Math.max(mesh.widthMm, mesh.heightMm, mesh.depthMm, 40);
    cameraDistance.current = maxDim * 2.05;

    if (mode === 'lithophane') {
      targetOffset.current.set(0, Math.max(20, mesh.depthMm * 0.5), 0);
      cameraRotation.current = { theta: 0.18, phi: Math.PI / 2.25 };
    } else if (mode === 'sculpture') {
      targetOffset.current.set(0, Math.max(20, mesh.depthMm * 0.48), 0);
      cameraRotation.current = { theta: Math.PI / 5, phi: Math.PI / 2.5 };
    } else {
      targetOffset.current.set(0, Math.max(4, mesh.depthMm * 0.5), 0);
      cameraRotation.current = { theta: Math.PI / 6, phi: Math.PI / 3.2 };
    }

    if (backLightRef.current) {
      backLightRef.current.position.set(0, Math.max(30, mesh.depthMm * 0.5), -55);
    }
    syncCameraTransform();
  }, [mesh, mode]);

  // Atualizar Geometria e Material 3D
  useEffect(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;

    if (meshRef.current) {
      scene.remove(meshRef.current);
      meshRef.current.geometry.dispose();
      if (Array.isArray(meshRef.current.material)) {
        meshRef.current.material.forEach((m) => m.dispose());
      } else {
        meshRef.current.material.dispose();
      }
      meshRef.current = null;
    }

    if (!mesh) return;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(mesh.vertices, 3));
    geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1));

    const useLitBacklight = mode === 'lithophane' && isBacklightOn && Boolean(mesh.lithoGlowColors);
    const useMultiColor = materialColor === 'MULTICOLOR' && Boolean(mesh.colors);

    if (useLitBacklight && mesh.lithoGlowColors) {
      geometry.setAttribute('color', new THREE.BufferAttribute(mesh.lithoGlowColors, 3));
    } else if (useMultiColor && mesh.colors) {
      geometry.setAttribute('color', new THREE.BufferAttribute(mesh.colors, 3));
    }

    geometry.computeVertexNormals();

    let mat: THREE.Material;
    if (useLitBacklight) {
      // Simulação realista de placa PLA retroiluminada por lâmpada quente
      mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color('#ffffff'),
        vertexColors: true,
        roughness: 0.42,
        metalness: 0.02,
        emissive: new THREE.Color('#fff1cf'),
        emissiveIntensity: 0.16,
        wireframe,
        side: THREE.DoubleSide,
      });
    } else if (mode === 'lithophane') {
      const baseHex = materialColor === 'MULTICOLOR' ? '#FFFFFF' : materialColor;
      mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(baseHex),
        roughness: 0.40,
        metalness: 0.05,
        wireframe,
        side: THREE.DoubleSide,
      });
    } else {
      const baseHex = useMultiColor ? '#FFFFFF' : materialColor === 'MULTICOLOR' ? '#FFFFFF' : materialColor;
      mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(baseHex),
        vertexColors: useMultiColor,
        roughness: 0.44,
        metalness: 0.08,
        wireframe,
        side: THREE.DoubleSide,
      });
    }

    const objectMesh = new THREE.Mesh(geometry, mat);
    // Bambu usa +Z para cima e -Y para frente; Three.js usa +Y para cima e +Z para frente (-90° em X)
    objectMesh.rotation.x = -Math.PI / 2;
    objectMesh.castShadow = !useLitBacklight;
    objectMesh.receiveShadow = !useLitBacklight;

    scene.add(objectMesh);
    meshRef.current = objectMesh;
  }, [mesh, mode, wireframe, materialColor, isBacklightOn]);

  // Ajustar iluminação para modo Backlight de Litofania
  useEffect(() => {
    if (!backLightRef.current || !frontLightRef.current || !ambientLightRef.current) return;
    if (mode === 'lithophane' && isBacklightOn) {
      backLightRef.current.intensity = 220;
      frontLightRef.current.intensity = 0.35;
      ambientLightRef.current.intensity = 0.85;
    } else {
      backLightRef.current.intensity = 0;
      frontLightRef.current.intensity = 1.25;
      ambientLightRef.current.intensity = 0.52;
    }
  }, [mode, isBacklightOn]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) isMouseDown.current = true;
    if (e.button === 2) isRightMouseDown.current = true;
    prevMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDown.current && !isRightMouseDown.current) return;
    const dx = e.clientX - prevMousePos.current.x;
    const dy = e.clientY - prevMousePos.current.y;
    prevMousePos.current = { x: e.clientX, y: e.clientY };

    if (isMouseDown.current) {
      cameraRotation.current.theta -= dx * 0.01;
      cameraRotation.current.phi = Math.max(
        0.08,
        Math.min(Math.PI / 2 - 0.02, cameraRotation.current.phi - dy * 0.01)
      );
    } else if (isRightMouseDown.current) {
      targetOffset.current.x -= dx * 0.2;
      targetOffset.current.y += dy * 0.2;
    }

    syncCameraTransform();
  };

  const handleMouseUp = () => {
    isMouseDown.current = false;
    isRightMouseDown.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    cameraDistance.current = Math.max(25, Math.min(750, cameraDistance.current + e.deltaY * 0.2));
    syncCameraTransform();
  };

  const resetCamera = () => {
    if (!mesh) {
      cameraDistance.current = 180;
      cameraRotation.current = { theta: Math.PI / 5, phi: Math.PI / 3 };
      targetOffset.current.set(0, 10, 0);
    } else {
      const maxDim = Math.max(mesh.widthMm, mesh.heightMm, mesh.depthMm, 40);
      cameraDistance.current = maxDim * 2.05;
      targetOffset.current.set(0, Math.max(6, mesh.depthMm * 0.5), 0);
      cameraRotation.current =
        mode === 'lithophane'
          ? { theta: 0.18, phi: Math.PI / 2.25 }
          : { theta: Math.PI / 5, phi: Math.PI / 3 };
    }
    syncCameraTransform();
  };

  return (
    <div
      ref={wrapperRef}
      style={{
        contentVisibility: 'auto',
        containIntrinsicSize: 'auto none auto 520px',
      }}
      className="relative w-full h-[520px] rounded-2xl overflow-hidden border border-slate-700/60 bg-slate-950 shadow-2xl flex flex-col select-none"
    >
      <div
        ref={containerRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
      />

      {/* Badge Mesa Bambu Lab */}
      <div className="absolute top-4 left-4 flex items-center gap-2 pointer-events-none">
        <div className="px-3 py-1.5 rounded-lg bg-slate-900/80 backdrop-blur-md border border-slate-700/80 text-[11px] font-mono text-emerald-400 flex items-center gap-2 shadow-lg">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Mesa Bambu 256×256 mm
        </div>
        {mesh?.paletteHex && mesh.paletteHex.length > 1 && (
          <div className="px-2.5 py-1.5 rounded-lg bg-slate-900/85 backdrop-blur-md border border-amber-500/40 text-[11px] font-mono text-amber-300 flex items-center gap-1.5 shadow-lg">
            <Palette className="w-3.5 h-3.5 text-amber-400" />
            <span>{mesh.paletteHex.length} Cores AMS</span>
          </div>
        )}
      </div>

      {/* Dimensões em tempo real */}
      {mesh && (
        <div className="absolute bottom-4 left-4 flex items-center gap-2 pointer-events-none">
          <div className="px-3 py-1.5 rounded-lg bg-slate-900/90 backdrop-blur-md border border-slate-700/80 text-xs font-mono text-slate-300 flex items-center gap-3 shadow-lg">
            <span>
              <strong className="text-emerald-400">X:</strong> {mesh.widthMm.toFixed(1)} mm
            </span>
            <span className="text-slate-600">|</span>
            <span>
              <strong className="text-blue-400">Y:</strong> {mesh.heightMm.toFixed(1)} mm
            </span>
            <span className="text-slate-600">|</span>
            <span>
              <strong className="text-amber-400">Z:</strong> {mesh.depthMm.toFixed(1)} mm
            </span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">
              {mesh.triangleCount.toLocaleString()} triângulos
            </span>
          </div>
        </div>
      )}

      {/* Barra de Ferramentas Flutuante Superior Direita */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900/80 backdrop-blur-md border border-slate-700/80 shadow-lg">
          {mesh?.colors && (
            <button
              type="button"
              title="Cores Pintadas Multi-Filamento (AMS)"
              onClick={() => setMaterialColor('MULTICOLOR')}
              className={`w-5 h-5 rounded-full transition-transform border ${
                materialColor === 'MULTICOLOR'
                  ? 'scale-125 border-white ring-2 ring-amber-400/60'
                  : 'border-slate-500 hover:scale-110'
              }`}
              style={{
                background: 'conic-gradient(#ef4444, #f59e0b, #10b981, #3b82f6, #8b5cf6, #ef4444)',
              }}
            />
          )}
          {[
            { color: '#FFFFFF', label: 'Branco' },
            { color: '#00AE42', label: 'Verde Bambu' },
            { color: '#E53E3E', label: 'Vermelho' },
            { color: '#3182CE', label: 'Azul' },
            { color: '#D97706', label: 'Dourado / Bronze' },
            { color: '#1E293B', label: 'Cinza Escuro' },
          ].map((c) => (
            <button
              key={c.color}
              type="button"
              title={`Filamento: ${c.label}`}
              onClick={() => setMaterialColor(c.color)}
              className={`w-5 h-5 rounded-full transition-transform border ${
                materialColor === c.color
                  ? 'scale-125 border-emerald-400 ring-2 ring-emerald-400/30'
                  : 'border-slate-600 hover:scale-110'
              }`}
              style={{ backgroundColor: c.color }}
            />
          ))}
        </div>

        {/* Botão Backlight (Lanterna para Litofania) */}
        {mode === 'lithophane' && onToggleBacklight && (
          <button
            type="button"
            onClick={onToggleBacklight}
            title={isBacklightOn ? 'Desligar Luz Traseira' : 'Simular Luz Traseira (Ver Foto)'}
            className={`px-2.5 py-2 rounded-xl backdrop-blur-md border transition-all flex items-center gap-1.5 text-xs font-bold ${
              isBacklightOn
                ? 'bg-amber-500/25 text-amber-300 border-amber-400/60 shadow-lg shadow-amber-500/20'
                : 'bg-slate-900/80 text-slate-300 border-slate-700/80 hover:bg-slate-800'
            }`}
          >
            <Sun className="w-4 h-4" />
            <span className="hidden sm:inline">{isBacklightOn ? 'Luz Acesa' : 'Testar Luz'}</span>
          </button>
        )}

        {/* Botão Wireframe */}
        <button
          type="button"
          onClick={() => setWireframe(!wireframe)}
          title={wireframe ? 'Modo Sólido' : 'Ver Malha Wireframe'}
          className={`p-2 rounded-xl backdrop-blur-md border transition-all ${
            wireframe
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
              : 'bg-slate-900/80 text-slate-300 border-slate-700/80 hover:bg-slate-800'
          }`}
        >
          <Box className="w-4 h-4" />
        </button>

        {/* Botão Resetar Câmera */}
        <button
          type="button"
          onClick={resetCamera}
          title="Centralizar Câmera"
          className="p-2 rounded-xl bg-slate-900/80 backdrop-blur-md border border-slate-700/80 text-slate-300 hover:bg-slate-800 transition-all shadow-lg"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Dica de Controle */}
      <div className="absolute bottom-4 right-4 pointer-events-none">
        <span className="text-[10px] text-slate-500 font-mono bg-slate-900/60 px-2 py-1 rounded-md border border-slate-800">
          Botão esq: girar • Botão dir: mover • Scroll: zoom
        </span>
      </div>

      {/* Placeholder se não houver mesh */}
      {!mesh && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none bg-slate-950/60 backdrop-blur-[2px]">
          <div className="w-16 h-16 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-center text-slate-500 mb-3 shadow-xl">
            <Box className="w-8 h-8 opacity-60 animate-bounce" />
          </div>
          <p className="text-sm font-semibold text-slate-300">
            {mode === 'sculpture' ? 'Pronto para Escultura 360°' : 'Nenhum modelo carregado'}
          </p>
          <p className="text-xs text-slate-500 mt-1 max-w-xs text-center">
            {mode === 'sculpture'
              ? 'Configure os parâmetros ao lado e clique em "Gerar Escultura 3D na RTX 4060".'
              : 'Envie uma imagem PNG/JPEG na barra lateral para gerar o modelo 3D em tempo real.'}
          </p>
        </div>
      )}
    </div>
  );
};
