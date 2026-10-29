import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Box, RotateCcw, Sparkles, Maximize2 } from 'lucide-react';
import { SplitPartMesh } from '../../../../shared/utils/threeMfSplitter';

interface Split3MfViewerProps {
  parts: SplitPartMesh[];
  selectedPartId: string | null;
  onSelectPart: (partId: string | null) => void;
  explodeFactor: number; // 0 .. 1
  onChangeExplodeFactor: (val: number) => void;
  showCutPlane: boolean;
  cutAxis: 'X' | 'Y' | 'Z';
  cutOffsetMm: number;
}

export const Split3MfViewer: React.FC<Split3MfViewerProps> = ({
  parts,
  selectedPartId,
  onSelectPart,
  explodeFactor,
  onChangeExplodeFactor,
  showCutPlane,
  cutAxis,
  cutOffsetMm,
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const partsGroupRef = useRef<THREE.Group | null>(null);
  const cutPlaneMeshRef = useRef<THREE.Group | null>(null);
  const partMeshMapRef = useRef<Map<string, THREE.Mesh>>(new Map());

  const [wireframe, setWireframe] = useState(false);

  const isMouseDown = useRef(false);
  const isRightMouseDown = useRef(false);
  const dragDistancePx = useRef(0);
  const prevMousePos = useRef({ x: 0, y: 0 });
  const cameraDistance = useRef(210);
  const cameraRotation = useRef({ theta: Math.PI / 4, phi: Math.PI / 2.8 });
  const targetOffset = useRef(new THREE.Vector3(0, 35, 0));

  const assemblyCenterRef = useRef<[number, number, number]>([0, 0, 0]);
  const assemblySpanRef = useRef<number>(80);

  const syncCamera = () => {
    const cam = cameraRef.current;
    if (!cam) return;
    const { theta, phi } = cameraRotation.current;
    const r = cameraDistance.current;
    cam.position.x = targetOffset.current.x + r * Math.sin(phi) * Math.sin(theta);
    cam.position.y = targetOffset.current.y + r * Math.cos(phi);
    cam.position.z = targetOffset.current.z + r * Math.sin(phi) * Math.cos(theta);
    cam.lookAt(targetOffset.current);
  };

  // Inicializar Cena Three.js + pausa automática fora da viewport (content-visibility / IntersectionObserver)
  useEffect(() => {
    if (!containerRef.current || !wrapperRef.current) return;
    const container = containerRef.current;
    const wrapper = wrapperRef.current;
    const width = container.clientWidth || 600;
    const height = container.clientHeight || 520;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#090f1d');
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 3000);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Mesa Bambu Lab 256 x 256 mm
    const bedGroup = new THREE.Group();
    const bedGeo = new THREE.PlaneGeometry(256, 256);
    const bedMat = new THREE.MeshStandardMaterial({
      color: 0x162032,
      roughness: 0.85,
      metalness: 0.15,
    });
    const bedMesh = new THREE.Mesh(bedGeo, bedMat);
    bedMesh.rotation.x = -Math.PI / 2;
    bedMesh.position.y = -0.1;
    bedMesh.receiveShadow = true;
    bedGroup.add(bedMesh);

    const gridHelper = new THREE.GridHelper(256, 16, 0x06b6d4, 0x29374d);
    gridHelper.position.y = 0;
    bedGroup.add(gridHelper);
    scene.add(bedGroup);

    // Grupo das peças 3D (rotacionado -90° em X para converter Bambu Z-up -> Three.js Y-up)
    const partsGroup = new THREE.Group();
    partsGroup.rotation.x = -Math.PI / 2;
    scene.add(partsGroup);
    partsGroupRef.current = partsGroup;

    // Grupo do Plano de Corte Interativo (também no espaço Bambu Z-up!)
    const cutGroup = new THREE.Group();
    cutGroup.rotation.x = -Math.PI / 2;
    const planeGeo = new THREE.PlaneGeometry(220, 220);
    const planeMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const planeFill = new THREE.Mesh(planeGeo, planeMat);
    const edgesGeo = new THREE.EdgesGeometry(planeGeo);
    const edgesMat = new THREE.LineBasicMaterial({ color: 0x22d3ee });
    const planeWire = new THREE.LineSegments(edgesGeo, edgesMat);
    planeFill.add(planeWire);
    cutGroup.add(planeFill);
    cutGroup.visible = false;
    scene.add(cutGroup);
    cutPlaneMeshRef.current = cutGroup;

    // Iluminação de estúdio 3 pontos
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
    keyLight.position.set(130, 230, 170);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x93c5fd, 0.5);
    rimLight.position.set(-150, 140, -140);
    scene.add(rimLight);

    syncCamera();

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

    const supportsContentVisibility =
      typeof document !== 'undefined' && 'contentVisibility' in document.documentElement.style;
    let intersectionObserver: IntersectionObserver | null = null;

    const onCvChange = (ev: Event) => {
      const skipped = Boolean((ev as Event & { skipped?: boolean }).skipped);
      if (skipped) pauseLoop();
      else resumeLoop();
    };

    if (supportsContentVisibility) {
      wrapper.addEventListener('contentvisibilityautostatechange', onCvChange);
    } else if (typeof IntersectionObserver !== 'undefined') {
      intersectionObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) resumeLoop();
            else pauseLoop();
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
        wrapper.removeEventListener('contentvisibilityautostatechange', onCvChange);
      }
      if (intersectionObserver) intersectionObserver.disconnect();
      resizeObserver.disconnect();
      renderer.dispose();
    };
  }, []);

  // Reconstruir malhas das peças quando a lista `parts` ou `wireframe` mudar
  useEffect(() => {
    const group = partsGroupRef.current;
    if (!group) return;

    // Limpar malhas anteriores
    for (const mesh of partMeshMapRef.current.values()) {
      group.remove(mesh);
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => m.dispose());
      } else {
        mesh.material.dispose();
      }
    }
    partMeshMapRef.current.clear();

    if (parts.length === 0) return;

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    for (const p of parts) {
      if (p.bboxMin[0] < minX) minX = p.bboxMin[0];
      if (p.bboxMax[0] > maxX) maxX = p.bboxMax[0];
      if (p.bboxMin[1] < minY) minY = p.bboxMin[1];
      if (p.bboxMax[1] > maxY) maxY = p.bboxMax[1];
      if (p.bboxMin[2] < minZ) minZ = p.bboxMin[2];
      if (p.bboxMax[2] > maxZ) maxZ = p.bboxMax[2];

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(p.vertices, 3));
      geo.setIndex(new THREE.BufferAttribute(p.indices, 1));
      geo.computeVertexNormals();

      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(p.colorHex),
        roughness: 0.42,
        metalness: 0.08,
        wireframe,
        side: THREE.DoubleSide,
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.userData.partId = p.id;
      mesh.visible = p.visible;
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      group.add(mesh);
      partMeshMapRef.current.set(p.id, mesh);
    }

    const cx = (minX + maxX) * 0.5;
    const cy = (minY + maxY) * 0.5;
    const cz = (minZ + maxZ) * 0.5;
    const span = Math.max(maxX - minX, maxY - minY, maxZ - minZ, 40);
    assemblyCenterRef.current = [cx, cy, cz];
    assemblySpanRef.current = span;
  }, [parts, wireframe]);

  // Enquadrar câmera inicialmente quando o conjunto de peças muda de tamanho
  useEffect(() => {
    if (parts.length === 0) return;
    const span = assemblySpanRef.current;
    const [, , cz] = assemblyCenterRef.current;
    cameraDistance.current = Math.max(95, span * 2.15);
    targetOffset.current.set(0, Math.max(12, cz), 0);
    syncCamera();
  }, [parts.length]);

  // Atualizar Visibilidade, Seleção (Destaque) e Vista Explodida em tempo real sem recriar BufferGeometry
  useEffect(() => {
    const [acx, acy, acz] = assemblyCenterRef.current;
    const maxExplodeDist = assemblySpanRef.current * 0.65;

    parts.forEach((p, idx) => {
      const mesh = partMeshMapRef.current.get(p.id);
      if (!mesh) return;

      mesh.visible = p.visible;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.color.set(p.colorHex);

      const isSelected = selectedPartId === p.id;
      if (isSelected) {
        mat.emissive.set('#22d3ee');
        mat.emissiveIntensity = 0.24;
      } else if (selectedPartId !== null) {
        mat.emissive.set('#000000');
        mat.emissiveIntensity = 0;
      } else {
        mat.emissive.set('#000000');
        mat.emissiveIntensity = 0;
      }

      // Vetor radial da Vista Explodida (com fallback angular determinístico se partes tiverem mesmo centroide)
      let vx = p.centroid[0] - acx;
      let vy = p.centroid[1] - acy;
      let vz = (p.centroid[2] - acz) * 1.15;
      const len = Math.hypot(vx, vy, vz);

      if (len < 1e-2 && parts.length > 1) {
        const angle = (idx / parts.length) * Math.PI * 2;
        vx = Math.cos(angle);
        vy = Math.sin(angle);
        vz = 0.35 * (idx % 2 === 0 ? 1 : -0.3);
      } else if (len >= 1e-2) {
        vx /= len;
        vy /= len;
        vz /= len;
      }

      const dist = explodeFactor * maxExplodeDist;
      // Garantir que nenhuma peça explodida atravesse abaixo da mesa (Z < 0)
      const targetZ = Math.max(-p.bboxMin[2], vz * dist);
      mesh.position.set(vx * dist, vy * dist, targetZ);
    });
  }, [parts, selectedPartId, explodeFactor]);

  // Atualizar Gizmo do Plano de Corte
  useEffect(() => {
    const cutGroup = cutPlaneMeshRef.current;
    if (!cutGroup) return;
    cutGroup.visible = showCutPlane;
    if (!showCutPlane) return;

    const planeFill = cutGroup.children[0] as THREE.Mesh;
    const span = Math.max(80, assemblySpanRef.current * 1.45);
    planeFill.scale.set(span / 220, span / 220, 1);

    const [acx, acy, acz] = assemblyCenterRef.current;
    planeFill.rotation.set(0, 0, 0);

    if (cutAxis === 'Z') {
      planeFill.position.set(acx, acy, cutOffsetMm);
    } else if (cutAxis === 'X') {
      planeFill.rotation.y = Math.PI / 2;
      planeFill.position.set(cutOffsetMm, acy, acz);
    } else {
      planeFill.rotation.x = Math.PI / 2;
      planeFill.position.set(acx, cutOffsetMm, acz);
    }
  }, [showCutPlane, cutAxis, cutOffsetMm, parts]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) isMouseDown.current = true;
    if (e.button === 2) isRightMouseDown.current = true;
    dragDistancePx.current = 0;
    prevMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDown.current && !isRightMouseDown.current) return;
    const dx = e.clientX - prevMousePos.current.x;
    const dy = e.clientY - prevMousePos.current.y;
    dragDistancePx.current += Math.hypot(dx, dy);
    prevMousePos.current = { x: e.clientX, y: e.clientY };

    if (isMouseDown.current) {
      cameraRotation.current.theta -= dx * 0.01;
      cameraRotation.current.phi = Math.max(
        0.08,
        Math.min(Math.PI / 2 - 0.02, cameraRotation.current.phi - dy * 0.01)
      );
    } else if (isRightMouseDown.current) {
      targetOffset.current.x -= dx * 0.22;
      targetOffset.current.y += dy * 0.22;
    }

    syncCamera();
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    const wasClick = e.button === 0 && isMouseDown.current && dragDistancePx.current < 5;
    isMouseDown.current = false;
    isRightMouseDown.current = false;

    if (wasClick && containerRef.current && cameraRef.current && partsGroupRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), cameraRef.current);
      const visibleMeshes = Array.from(partMeshMapRef.current.values()).filter((m) => m.visible);
      const hits = raycaster.intersectObjects(visibleMeshes, false);

      if (hits.length > 0) {
        const hitPartId = hits[0].object.userData.partId as string;
        onSelectPart(hitPartId === selectedPartId ? null : hitPartId);
      } else {
        onSelectPart(null);
      }
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    cameraDistance.current = Math.max(30, Math.min(900, cameraDistance.current + e.deltaY * 0.22));
    syncCamera();
  };

  const resetCamera = () => {
    const span = assemblySpanRef.current;
    const [, , cz] = assemblyCenterRef.current;
    cameraDistance.current = Math.max(95, span * 2.15);
    cameraRotation.current = { theta: Math.PI / 4, phi: Math.PI / 2.8 };
    targetOffset.current.set(0, Math.max(12, cz), 0);
    onChangeExplodeFactor(0);
    syncCamera();
  };

  const visibleCount = parts.filter((p) => p.visible).length;
  const totalTris = parts.reduce((acc, p) => acc + (p.visible ? p.triangleCount : 0), 0);
  const selectedPart = parts.find((p) => p.id === selectedPartId);

  return (
    <div
      ref={wrapperRef}
      style={{
        contentVisibility: 'auto',
        containIntrinsicSize: 'auto none auto 520px',
      }}
      className="relative w-full h-[520px] rounded-2xl overflow-hidden border border-slate-700/70 bg-slate-950 shadow-2xl flex flex-col select-none"
    >
      <div
        ref={containerRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          isMouseDown.current = false;
          isRightMouseDown.current = false;
        }}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
      />

      {/* Badges Superiores Esquerdos */}
      <div className="absolute top-3.5 left-3.5 flex flex-wrap items-center gap-2 pointer-events-none">
        <div className="px-3 py-1.5 rounded-lg bg-slate-900/85 backdrop-blur-md border border-slate-700/80 text-[11px] font-mono text-cyan-400 flex items-center gap-2 shadow-lg">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          Split3MF 3D • {visibleCount}/{parts.length} Peças
        </div>

        {selectedPart && (
          <div className="px-2.5 py-1.5 rounded-lg bg-cyan-950/90 backdrop-blur-md border border-cyan-500/60 text-[11px] font-bold text-cyan-200 flex items-center gap-2 shadow-lg">
            <span
              className="w-3 h-3 rounded-full border border-white/60 shrink-0"
              style={{ backgroundColor: selectedPart.colorHex }}
            />
            <span className="truncate max-w-[190px]">{selectedPart.name}</span>
          </div>
        )}
      </div>

      {/* Barra Superior Direita */}
      <div className="absolute top-3.5 right-3.5 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setWireframe(!wireframe)}
          title={wireframe ? 'Modo Sólido' : 'Inspecionar Malha Wireframe'}
          className={`p-2 rounded-xl backdrop-blur-md border transition-all ${
            wireframe
              ? 'bg-cyan-500/25 text-cyan-300 border-cyan-400/60'
              : 'bg-slate-900/85 text-slate-300 border-slate-700/80 hover:bg-slate-800'
          }`}
        >
          <Box className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={resetCamera}
          title="Centralizar Câmera e Juntar Peças"
          className="p-2 rounded-xl bg-slate-900/85 backdrop-blur-md border border-slate-700/80 text-slate-300 hover:bg-slate-800 transition-all shadow-lg"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Controle Flutuante de Vista Explodida (estilo split3mf.com) */}
      {parts.length > 1 && (
        <div className="absolute bottom-14 left-1/2 -translate-x-1/2 px-4 py-2 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-slate-700/80 shadow-xl flex items-center gap-3 w-[min(90%,340px)]">
          <Maximize2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span className="text-[11px] font-bold text-slate-200 whitespace-nowrap">
            Vista Explodida
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={explodeFactor}
            onChange={(e) => onChangeExplodeFactor(parseFloat(e.target.value))}
            className="w-full accent-cyan-400 cursor-pointer"
          />
          <span className="text-[11px] font-mono text-cyan-400 w-9 text-right">
            {Math.round(explodeFactor * 100)}%
          </span>
        </div>
      )}

      {/* Rodapé com Estatísticas e Atalhos */}
      <div className="absolute bottom-3.5 left-3.5 right-3.5 flex items-center justify-between gap-2 pointer-events-none">
        <div className="px-3 py-1 rounded-lg bg-slate-900/85 backdrop-blur-md border border-slate-800 text-[11px] font-mono text-slate-300 flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          <span>{totalTris.toLocaleString()} triângulos</span>
        </div>

        <span className="text-[10px] text-slate-400 font-mono bg-slate-900/75 px-2.5 py-1 rounded-lg border border-slate-800 hidden sm:inline-block">
          Clique na peça 3D para selecionar • Arraste para girar • Scroll: zoom
        </span>
      </div>
    </div>
  );
};

