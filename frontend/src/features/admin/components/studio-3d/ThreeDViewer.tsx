import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Sun, Box, RotateCcw } from 'lucide-react';
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
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const backLightRef = useRef<THREE.PointLight | null>(null);
  const frontLightRef = useRef<THREE.DirectionalLight | null>(null);

  const [wireframe, setWireframe] = useState(false);
  const [materialColor, setMaterialColor] = useState('#FFFFFF'); // Branco Bambu

  // Estado para rotação e zoom do mouse
  const isMouseDown = useRef(false);
  const isRightMouseDown = useRef(false);
  const prevMousePos = useRef({ x: 0, y: 0 });
  const cameraDistance = useRef(180);
  const cameraRotation = useRef({ theta: Math.PI / 4, phi: Math.PI / 3 });
  const targetOffset = useRef(new THREE.Vector3(0, 0, 10));

  // Inicializar Cena Three.js
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth || 500;
    const height = container.clientHeight || 500;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0b1120'); // Dark slate slate-950
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 2000);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Mesa de Impressão Bambu Lab (256 x 256 mm)
    const bedGroup = new THREE.Group();

    // Placa PEI Texturizada (256x256mm)
    const bedGeo = new THREE.PlaneGeometry(256, 256);
    const bedMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.8,
      metalness: 0.2,
    });
    const bedMesh = new THREE.Mesh(bedGeo, bedMat);
    bedMesh.rotation.x = -Math.PI / 2;
    bedMesh.position.y = -0.1;
    bedMesh.receiveShadow = true;
    bedGroup.add(bedMesh);

    // Grade milimétrica (256x256 com divisões de 10mm e 50mm)
    const gridHelper = new THREE.GridHelper(256, 25.6, 0x00ae42, 0x334155); // Verde Bambu e cinza
    gridHelper.position.y = 0;
    bedGroup.add(gridHelper);

    scene.add(bedGroup);

    // 5. Iluminação
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
    scene.add(ambientLight);

    // Luz frontal principal para realçar relevos
    const frontLight = new THREE.DirectionalLight(0xffffff, 1.2);
    frontLight.position.set(100, 200, 150);
    frontLight.castShadow = true;
    frontLight.shadow.mapSize.width = 1024;
    frontLight.shadow.mapSize.height = 1024;
    scene.add(frontLight);
    frontLightRef.current = frontLight;

    // Luz de preenchimento lateral
    const fillLight = new THREE.DirectionalLight(0x94a3b8, 0.4);
    fillLight.position.set(-150, 100, -100);
    scene.add(fillLight);

    // Luz de Fundo (Backlight para Litofania)
    const backLight = new THREE.PointLight(0xffe8bb, 0, 300);
    backLight.position.set(0, 30, -50);
    scene.add(backLight);
    backLightRef.current = backLight;

    // 6. Atualizar Posição da Câmera
    const updateCamera = () => {
      const theta = cameraRotation.current.theta;
      const phi = cameraRotation.current.phi;
      const r = cameraDistance.current;

      camera.position.x = targetOffset.current.x + r * Math.sin(phi) * Math.sin(theta);
      camera.position.y = targetOffset.current.y + r * Math.cos(phi);
      camera.position.z = targetOffset.current.z + r * Math.sin(phi) * Math.cos(theta);

      camera.lookAt(targetOffset.current);
    };

    updateCamera();

    // 7. Loop de Animação
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    // 8. Resize Observer
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
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      renderer.dispose();
    };
  }, []);

  // Atualizar Geometria 3D quando o mesh mudar
  useEffect(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;

    // Remover mesh anterior
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

    // Criar BufferGeometry com os vértices e triângulos calculados
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(mesh.vertices, 3));
    geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
    geometry.computeVertexNormals();

    // Para litofanias, material levemente translúcido
    let mat: THREE.Material;
    if (mode === 'lithophane') {
      mat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(materialColor),
        roughness: 0.35,
        transmission: isBacklightOn ? 0.8 : 0.2, // Transmissão de luz
        thickness: 3.0,
        ior: 1.45,
        wireframe,
        side: THREE.DoubleSide,
      });
    } else {
      mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(materialColor),
        roughness: 0.45,
        metalness: 0.1,
        wireframe,
        side: THREE.DoubleSide,
      });
    }

    const objectMesh = new THREE.Mesh(geometry, mat);
    // Orientação: o fatiador do Bambu Lab utiliza Z para cima, enquanto Three.js tem Y para cima por padrão
    // Rotacionamos -90 graus em X para que o topo fique orientado para cima na tela
    objectMesh.rotation.x = -Math.PI / 2;
    objectMesh.castShadow = true;
    objectMesh.receiveShadow = true;

    scene.add(objectMesh);
    meshRef.current = objectMesh;

    // Ajustar distância de câmera para enquadrar a peça
    const maxDim = Math.max(mesh.widthMm, mesh.heightMm, mesh.depthMm, 40);
    cameraDistance.current = maxDim * 2.2;
    // Centralizar foco da câmera: para esculturas 3D eretas, focar na metade da altura (Y no Three.js)
    const midHeight = mode === 'sculpture' ? Math.max(15, mesh.depthMm / 2) : 10;
    targetOffset.current.set(0, midHeight, 0);

    // Atualizar câmera
    if (cameraRef.current) {
      const theta = cameraRotation.current.theta;
      const phi = cameraRotation.current.phi;
      const r = cameraDistance.current;
      cameraRef.current.position.x = r * Math.sin(phi) * Math.sin(theta);
      cameraRef.current.position.y = r * Math.cos(phi);
      cameraRef.current.position.z = r * Math.sin(phi) * Math.cos(theta);
      cameraRef.current.lookAt(targetOffset.current);
    }
  }, [mesh, mode, wireframe, materialColor]);

  // Atualizar Backlight (Luz de fundo para Litofania)
  useEffect(() => {
    if (!backLightRef.current || !frontLightRef.current) return;
    if (mode === 'lithophane' && isBacklightOn) {
      backLightRef.current.intensity = 250;
      frontLightRef.current.intensity = 0.2; // Diminui frente para destacar luz de trás
    } else {
      backLightRef.current.intensity = 0;
      frontLightRef.current.intensity = 1.2;
    }
  }, [mode, isBacklightOn]);

  // Controles de Mouse (Orbit e Zoom)
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
      // Rotacionar
      cameraRotation.current.theta -= dx * 0.01;
      cameraRotation.current.phi = Math.max(0.1, Math.min(Math.PI / 2 - 0.05, cameraRotation.current.phi - dy * 0.01));
    } else if (isRightMouseDown.current) {
      // Pan
      targetOffset.current.x -= dx * 0.2;
      targetOffset.current.y += dy * 0.2;
    }

    if (cameraRef.current) {
      const theta = cameraRotation.current.theta;
      const phi = cameraRotation.current.phi;
      const r = cameraDistance.current;
      cameraRef.current.position.x = targetOffset.current.x + r * Math.sin(phi) * Math.sin(theta);
      cameraRef.current.position.y = targetOffset.current.y + r * Math.cos(phi);
      cameraRef.current.position.z = targetOffset.current.z + r * Math.sin(phi) * Math.cos(theta);
      cameraRef.current.lookAt(targetOffset.current);
    }
  };

  const handleMouseUp = () => {
    isMouseDown.current = false;
    isRightMouseDown.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    cameraDistance.current = Math.max(30, Math.min(600, cameraDistance.current + e.deltaY * 0.2));
    if (cameraRef.current) {
      const theta = cameraRotation.current.theta;
      const phi = cameraRotation.current.phi;
      const r = cameraDistance.current;
      cameraRef.current.position.x = targetOffset.current.x + r * Math.sin(phi) * Math.sin(theta);
      cameraRef.current.position.y = targetOffset.current.y + r * Math.cos(phi);
      cameraRef.current.position.z = targetOffset.current.z + r * Math.sin(phi) * Math.cos(theta);
      cameraRef.current.lookAt(targetOffset.current);
    }
  };

  const resetCamera = () => {
    cameraDistance.current = mesh ? Math.max(mesh.widthMm, mesh.heightMm, 60) * 2.2 : 180;
    cameraRotation.current = { theta: Math.PI / 4, phi: Math.PI / 3 };
    targetOffset.current.set(0, 10, 0);
    if (cameraRef.current) {
      const theta = cameraRotation.current.theta;
      const phi = cameraRotation.current.phi;
      const r = cameraDistance.current;
      cameraRef.current.position.x = r * Math.sin(phi) * Math.sin(theta);
      cameraRef.current.position.y = r * Math.cos(phi);
      cameraRef.current.position.z = r * Math.sin(phi) * Math.cos(theta);
      cameraRef.current.lookAt(targetOffset.current);
    }
  };

  return (
    <div className="relative w-full h-[520px] rounded-2xl overflow-hidden border border-slate-700/60 bg-slate-950 shadow-2xl flex flex-col select-none">
      {/* Viewport 3D Canvas */}
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
        {/* Alternador de Cor do Filamento de Visualização */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900/80 backdrop-blur-md border border-slate-700/80 shadow-lg">
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
                materialColor === c.color ? 'scale-125 border-emerald-400 ring-2 ring-emerald-400/30' : 'border-slate-600 hover:scale-110'
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
            className={`p-2 rounded-xl backdrop-blur-md border transition-all ${
              isBacklightOn
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-lg shadow-amber-500/20'
                : 'bg-slate-900/80 text-slate-300 border-slate-700/80 hover:bg-slate-800'
            }`}
          >
            <Sun className="w-4 h-4" />
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
              ? 'Clique em "Gerar Escultura 3D na RTX 4060" para processar o volume completo na GPU.'
              : 'Envie uma imagem PNG/JPEG na barra lateral para gerar o modelo 3D em tempo real.'}
          </p>
        </div>
      )}
    </div>
  );
};

