import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Eye, Layers, RefreshCw, RotateCw } from 'lucide-react';

interface Product3DViewerProps {
  colorHex?: string;
  colorName?: string;
  materialType?: string;
  autoRotateDefault?: boolean;
  className?: string;
  heightPx?: number;
}

export const Product3DViewer: React.FC<Product3DViewerProps> = ({
  colorHex = '#3b82f6',
  colorName = 'Azul',
  materialType = 'PLA',
  autoRotateDefault = true,
  className = '',
  heightPx = 380,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [isWireframe, setIsWireframe] = useState(false);
  const [isAutoRotate, setIsAutoRotate] = useState(autoRotateDefault);
  const [activeFinish, setActiveFinish] = useState<'standard' | 'silk' | 'matte' | 'resin'>('silk');
  const controlsRef = useRef<OrbitControls | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 400;
    const height = heightPx;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a); // dark Slate-900

    // Grid Helper for 3D Printer bed feel
    const gridHelper = new THREE.GridHelper(10, 20, 0x3b82f6, 0x1e293b);
    gridHelper.position.y = -2;
    scene.add(gridHelper);

    // Camera setup
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(4, 3, 5);

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(renderer.domElement);

    // Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 + 0.1; // Don't clip below floor
    controls.minDistance = 2;
    controls.maxDistance = 15;
    controls.autoRotate = isAutoRotate;
    controls.autoRotateSpeed = 2.5;
    controlsRef.current = controls;

    // Lighting (Studio Setup for 3D Print Reflection)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1.5);
    mainLight.position.set(5, 8, 5);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 1024;
    mainLight.shadow.mapSize.height = 1024;
    scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.8); // Laser cyan fill
    fillLight.position.set(-5, 3, -5);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xa855f7, 0.6); // Purple rim light for depth
    rimLight.position.set(0, -4, 5);
    scene.add(rimLight);

    // Create 3D Print Geometry (Complex procedural model: Beveled Polyhedron with Print Layers effect)
    const geometry = new THREE.TorusKnotGeometry(1.2, 0.4, 128, 32);
    
    // Create Material PBR Shader
    const initialColor = new THREE.Color(colorHex);
    const material = new THREE.MeshStandardMaterial({
      color: initialColor,
      roughness: activeFinish === 'silk' ? 0.25 : activeFinish === 'matte' ? 0.75 : 0.4,
      metalness: activeFinish === 'silk' ? 0.35 : 0.05,
      wireframe: isWireframe,
    });
    materialRef.current = material;

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = 0.2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    meshRef.current = mesh;
    scene.add(mesh);

    // Animation Loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Handle Resize
    const handleResize = () => {
      if (!container) return;
      const newWidth = container.clientWidth;
      camera.aspect = newWidth / height;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, height);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [heightPx]);

  // Update color dynamically when prop changes
  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.color.set(colorHex);
    }
  }, [colorHex]);

  // Update wireframe mode
  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.wireframe = isWireframe;
    }
  }, [isWireframe]);

  // Update finish roughness
  useEffect(() => {
    if (!materialRef.current) return;
    if (activeFinish === 'silk') {
      materialRef.current.roughness = 0.25;
      materialRef.current.metalness = 0.4;
    } else if (activeFinish === 'matte') {
      materialRef.current.roughness = 0.85;
      materialRef.current.metalness = 0.02;
    } else if (activeFinish === 'resin') {
      materialRef.current.roughness = 0.08;
      materialRef.current.metalness = 0.15;
    } else {
      materialRef.current.roughness = 0.45;
      materialRef.current.metalness = 0.1;
    }
  }, [activeFinish]);

  // Update auto rotation
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = isAutoRotate;
    }
  }, [isAutoRotate]);

  const handleResetCamera = () => {
    if (controlsRef.current) {
      controlsRef.current.reset();
    }
  };

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-chumbo-800 bg-chumbo-950 ${className}`}>
      {/* 3D WebGL Canvas Mounting Node */}
      <div ref={mountRef} style={{ height: `${heightPx}px` }} className="w-full cursor-grab active:cursor-grabbing" />

      {/* Top Overlay Badge */}
      <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-laser-500/40 bg-laser-500/10 px-3 py-1 text-xs font-bold text-laser-400 backdrop-blur-md">
          <Layers className="h-3.5 w-3.5" />
          <span>Viewer 3D Realtime</span>
        </span>
        <span className="rounded-full border border-chumbo-700 bg-chumbo-900/80 px-2.5 py-1 text-[11px] font-medium text-slate-300 backdrop-blur-md">
          Material: <strong className="text-white">{materialType}</strong> ({colorName})
        </span>
      </div>

      {/* Interactive Controls Overlay */}
      <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-chumbo-800/90 bg-chumbo-900/90 p-2 text-xs backdrop-blur-md">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsAutoRotate(!isAutoRotate)}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 font-medium transition-colors ${
              isAutoRotate ? 'bg-laser-500/20 text-laser-400 border border-laser-500/30' : 'bg-chumbo-800 text-slate-400 hover:text-white'
            }`}
            title="Girar modelo automaticamente"
          >
            <RotateCw className={`h-3.5 w-3.5 ${isAutoRotate ? 'animate-spin' : ''}`} />
            <span>Giro</span>
          </button>

          <button
            type="button"
            onClick={() => setIsWireframe(!isWireframe)}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 font-medium transition-colors ${
              isWireframe ? 'bg-laser-500/20 text-laser-400 border border-laser-500/30' : 'bg-chumbo-800 text-slate-400 hover:text-white'
            }`}
            title="Modo malha 3D (Wireframe)"
          >
            <Eye className="h-3.5 w-3.5" />
            <span>Malha</span>
          </button>

          <button
            type="button"
            onClick={handleResetCamera}
            className="flex items-center gap-1 rounded-lg bg-chumbo-800 px-2.5 py-1.5 font-medium text-slate-400 transition-colors hover:bg-chumbo-700 hover:text-white"
            title="Resetar câmera"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Reset</span>
          </button>
        </div>

        {/* Finish Picker */}
        <div className="flex items-center gap-1 border-l border-chumbo-800 pl-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mr-1">Acabamento:</span>
          {(['silk', 'matte', 'resin', 'standard'] as const).map((finish) => (
            <button
              key={finish}
              type="button"
              onClick={() => setActiveFinish(finish)}
              className={`rounded-md px-2 py-0.5 text-[11px] font-bold capitalize transition-colors ${
                activeFinish === finish ? 'bg-white text-chumbo-950' : 'bg-chumbo-800 text-slate-400 hover:text-white'
              }`}
            >
              {finish === 'silk' ? 'Seda' : finish === 'matte' ? 'Fosco' : finish === 'resin' ? 'Resina' : 'Std'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
