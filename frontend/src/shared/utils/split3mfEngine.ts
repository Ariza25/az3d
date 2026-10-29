import JSZip from 'jszip';
import { yieldToMainThread } from './meshGenerators';

export type ConnectorShape = 'none' | 'cylinder' | 'cube' | 'triangle';
export type SeamCapMode = 'watertight' | 'inward_shell' | 'open';

export interface SplitPartMesh {
  id: string;
  name: string;
  extruderId: number;
  colorHex: string;
  colorName: string;
  filamentType: string;
  vertices: Float32Array;
  indices: Uint32Array;
  triangleCount: number;
  vertexCount: number;
  bboxMin: [number, number, number];
  bboxMax: [number, number, number];
  centroid: [number, number, number];
  isWatertight: boolean;
  openEdgesCount: number;
  visible: boolean;
  connectorsAdded: number;
}

export interface SplitEngineOptions {
  capMode: SeamCapMode;
  seamClearanceMm: number;
  minIslandTriangles: number;
  splitDisconnectedIslands: boolean;
  connectorShape: ConnectorShape;
  connectorDiameterMm: number;
  connectorDepthMm: number;
  connectorClearanceMm: number;
  connectorCountPerSeam: number;
}

export interface PlaneCutOptions {
  axis: 'X' | 'Y' | 'Z';
  offsetMm: number;
  targetPartId: string | 'ALL';
  connectorShape: ConnectorShape;
  connectorDiameterMm: number;
  connectorDepthMm: number;
  connectorClearanceMm: number;
  connectorCount: number;
}

export interface RawColoredSoup {
  /** Posições globais soldadas ou não soldadas [x0,y0,z0, ...] */
  vertices: Float32Array;
  /** Índices de triângulos [a0,b0,c0, ...] */
  indices: Uint32Array;
  /** Extrusora 1-based por triângulo (comprimento === indices.length / 3) */
  faceExtruders: Int32Array;
  /** Paleta 1-based -> { hex, type, name? } */
  palette: Record<number, { hex: string; type?: string; name?: string }>;
  /** Centro global original da montagem [cx, cy, minZ] */
  assemblyOriginShift: [number, number, number];
  /** Houve subdivisão de pintura por triângulo (`paint_color` / `mmu_segmentation`)? */
  hadPaintedTriangles: boolean;
}

export const DEFAULT_SPLIT_ENGINE_OPTIONS: SplitEngineOptions = {
  capMode: 'watertight',
  seamClearanceMm: 0.10,
  minIslandTriangles: 12,
  splitDisconnectedIslands: false,
  connectorShape: 'none',
  connectorDiameterMm: 4.0,
  connectorDepthMm: 4.0,
  connectorClearanceMm: 0.20,
  connectorCountPerSeam: 2,
};

type Mat3x4 = [
  number, number, number,
  number, number, number,
  number, number, number,
  number, number, number
];

const IDENTITY_MAT: Mat3x4 = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];

/**
 * Converte string de atributo `transform` 3MF ("m00 m01 m02 m10 m11 m12 m20 m21 m22 m30 m31 m32")
 */
export const parse3MfTransform = (str: string | null | undefined): Mat3x4 => {
  if (!str) return IDENTITY_MAT;
  const parts = str.trim().split(/\s+/).map(Number);
  if (parts.length !== 12 || parts.some((n) => !Number.isFinite(n))) {
    return IDENTITY_MAT;
  }
  return parts as unknown as Mat3x4;
};

/**
 * Compõe duas transformações afins 3MF (vetor linha: p * local * parent)
 */
export const multiply3MfTransform = (local: Mat3x4, parent: Mat3x4): Mat3x4 => {
  const [
    a00, a01, a02,
    a10, a11, a12,
    a20, a21, a22,
    a30, a31, a32,
  ] = local;
  const [
    b00, b01, b02,
    b10, b11, b12,
    b20, b21, b22,
    b30, b31, b32,
  ] = parent;

  return [
    a00 * b00 + a01 * b10 + a02 * b20,
    a00 * b01 + a01 * b11 + a02 * b21,
    a00 * b02 + a01 * b12 + a02 * b22,

    a10 * b00 + a11 * b10 + a12 * b20,
    a10 * b01 + a11 * b11 + a12 * b21,
    a10 * b02 + a11 * b12 + a12 * b22,

    a20 * b00 + a21 * b10 + a22 * b20,
    a20 * b01 + a21 * b11 + a22 * b21,
    a20 * b02 + a21 * b12 + a22 * b22,

    a30 * b00 + a31 * b10 + a32 * b20 + b30,
    a30 * b01 + a31 * b11 + a32 * b21 + b31,
    a30 * b02 + a31 * b12 + a32 * b22 + b32,
  ];
};

const apply3MfTransform = (x: number, y: number, z: number, m: Mat3x4): [number, number, number] => [
  m[0] * x + m[3] * y + m[6] * z + m[9],
  m[1] * x + m[4] * y + m[7] * z + m[10],
  m[2] * x + m[5] * y + m[8] * z + m[11],
];

const determinant3Mf = (m: Mat3x4): number =>
  m[0] * (m[4] * m[8] - m[5] * m[7]) -
  m[1] * (m[3] * m[8] - m[5] * m[6]) +
  m[2] * (m[3] * m[7] - m[4] * m[6]);

/**
 * Decodificador recursivo exato do `TriangleSelector::deserialize` (Bambu Studio `paint_color`
 * e PrusaSlicer `slic3rpe:mmu_segmentation`).
 * Subdivide triângulos pintados exatamente nas fronteiras da pintura, deduplicando pontos médios
 * de arestas compartilhadas para manter a malha 100% contínua e sem frestas T-junction.
 */
export const decodePaintedTriangleIntoSoup = (
  v0: number,
  v1: number,
  v2: number,
  paintHex: string,
  defaultExtruder: number,
  verts: number[],
  midpointCache: Map<string, number>,
  outTris: number[],
  outExtruders: number[]
): void => {
  let cursor = paintHex.length - 1;
  const nextNibble = (): number => {
    if (cursor < 0) return 0;
    const ch = paintHex.charCodeAt(cursor--);
    if (ch >= 48 && ch <= 57) return ch - 48;
    if (ch >= 65 && ch <= 70) return ch - 55;
    if (ch >= 97 && ch <= 102) return ch - 87;
    return 0;
  };

  const getMidpoint = (a: number, b: number): number => {
    const lo = a < b ? a : b;
    const hi = a < b ? b : a;
    const key = `${lo}_${hi}`;
    const existing = midpointCache.get(key);
    if (existing !== undefined) return existing;

    const idx = verts.length / 3;
    verts.push(
      0.5 * (verts[a * 3] + verts[b * 3]),
      0.5 * (verts[a * 3 + 1] + verts[b * 3 + 1]),
      0.5 * (verts[a * 3 + 2] + verts[b * 3 + 2])
    );
    midpointCache.set(key, idx);
    return idx;
  };

  const visit = (a: number, b: number, c: number, depth: number): void => {
    if (depth > 20 || cursor < 0) {
      outTris.push(a, b, c);
      outExtruders.push(defaultExtruder);
      return;
    }

    const code = nextNibble();
    const numSplitSides = code & 0b11;

    if (numSplitSides === 0) {
      let state = 0;
      if ((code & 0b1100) === 0b1100) {
        let nextCode = nextNibble();
        let numF = 0;
        while (nextCode === 0xf && cursor >= 0) {
          numF++;
          nextCode = nextNibble();
        }
        state = nextCode + 15 * numF + 3;
      } else {
        state = code >> 2;
      }
      const ext = state <= 0 ? defaultExtruder : state;
      outTris.push(a, b, c);
      outExtruders.push(ext);
      return;
    }

    const specialSide = (code >> 2) % 3;
    const corners = [a, b, c];
    const u0 = corners[specialSide];
    const u1 = corners[(specialSide + 1) % 3];
    const u2 = corners[(specialSide + 2) % 3];

    if (numSplitSides === 1) {
      const m = getMidpoint(u2, u1);
      // Ordem reversa dos filhos conforme TriangleSelector.cpp (filho 1 -> filho 0)
      visit(m, u2, u0, depth + 1);
      visit(u0, u1, m, depth + 1);
    } else if (numSplitSides === 2) {
      const mA = getMidpoint(u1, u0);
      const mB = getMidpoint(u0, u2);
      // Filhos: 0=[u0, mA, mB], 1=[mA, u1, mB], 2=[u1, u2, mB] -> visitar 2, 1, 0
      visit(u1, u2, mB, depth + 1);
      visit(mA, u1, mB, depth + 1);
      visit(u0, mA, mB, depth + 1);
    } else {
      const m01 = getMidpoint(u1, u0);
      const m12 = getMidpoint(u2, u1);
      const m20 = getMidpoint(u0, u2);
      // Filhos: 0=[u0, m01, m20], 1=[m01, u1, m12], 2=[m12, u2, m20], 3=[m01, m12, m20] -> visitar 3, 2, 1, 0
      visit(m01, m12, m20, depth + 1);
      visit(m12, u2, m20, depth + 1);
      visit(m01, u1, m12, depth + 1);
      visit(u0, m01, m20, depth + 1);
    }
  };

  visit(v0, v1, v2, 0);
};

/**
 * Solda vértices espacialmente próximos (tolerância `weldEps`, padrão 1e-4 mm)
 * e remove triângulos degenerados de área zero.
 */
export const weldColoredSoup = async (
  rawVerts: Float32Array | number[],
  rawTris: Uint32Array | number[],
  rawFaceExtruders: Int32Array | number[],
  weldEps = 1e-4
): Promise<{
  vertices: Float32Array;
  indices: Uint32Array;
  faceExtruders: Int32Array;
}> => {
  const invEps = 1.0 / weldEps;
  const vertMap = new Map<string, number>();
  const weldedVerts: number[] = [];
  const vCount = rawVerts.length / 3;
  const remap = new Uint32Array(vCount);

  let deadline = performance.now() + 50;

  for (let i = 0; i < vCount; i++) {
    const x = rawVerts[i * 3];
    const y = rawVerts[i * 3 + 1];
    const z = rawVerts[i * 3 + 2];
    const kx = Math.round(x * invEps);
    const ky = Math.round(y * invEps);
    const kz = Math.round(z * invEps);
    const key = `${kx}_${ky}_${kz}`;

    let idx = vertMap.get(key);
    if (idx === undefined) {
      idx = weldedVerts.length / 3;
      weldedVerts.push(x, y, z);
      vertMap.set(key, idx);
    }
    remap[i] = idx;

    if ((i & 8191) === 8191 && performance.now() >= deadline) {
      await yieldToMainThread();
      deadline = performance.now() + 50;
    }
  }

  const triCount = rawTris.length / 3;
  const outTris: number[] = [];
  const outExt: number[] = [];

  for (let t = 0; t < triCount; t++) {
    const a = remap[rawTris[t * 3]];
    const b = remap[rawTris[t * 3 + 1]];
    const c = remap[rawTris[t * 3 + 2]];
    if (a === b || b === c || c === a) continue;
    outTris.push(a, b, c);
    outExt.push(rawFaceExtruders[t]);

    if ((t & 8191) === 8191 && performance.now() >= deadline) {
      await yieldToMainThread();
      deadline = performance.now() + 50;
    }
  }

  return {
    vertices: new Float32Array(weldedVerts),
    indices: new Uint32Array(outTris),
    faceExtruders: new Int32Array(outExt),
  };
};

/**
 * Remove manchas minúsculas de pincel (< minIslandTriangles) fundindo-as na cor adjacente
 * com maior fronteira compartilhada.
 */
export const cleanupSmallColorIslands = async (
  indices: Uint32Array,
  faceExtruders: Int32Array,
  minIslandTriangles: number
): Promise<Int32Array> => {
  const triCount = indices.length / 3;
  if (minIslandTriangles <= 0 || triCount === 0) return faceExtruders;

  const updated = new Int32Array(faceExtruders);

  // Verificar se há mais de uma cor
  let hasMulti = false;
  const firstExt = updated[0];
  for (let i = 1; i < triCount; i++) {
    if (updated[i] !== firstExt) {
      hasMulti = true;
      break;
    }
  }
  if (!hasMulti) return updated;

  let deadline = performance.now() + 50;

  // Mapear aresta não-direcionada -> lista de triângulos incidentes (usamos par compacto [t0, t1])
  const edgeFirstTri = new Map<string, number>();
  const adjHead = new Int32Array(triCount).fill(-1);
  const adjTo: number[] = [];
  const adjNext: number[] = [];

  const addAdj = (tA: number, tB: number) => {
    adjTo.push(tB);
    adjNext.push(adjHead[tA]);
    adjHead[tA] = adjTo.length - 1;

    adjTo.push(tA);
    adjNext.push(adjHead[tB]);
    adjHead[tB] = adjTo.length - 1;
  };

  for (let t = 0; t < triCount; t++) {
    const v0 = indices[t * 3];
    const v1 = indices[t * 3 + 1];
    const v2 = indices[t * 3 + 2];
    const edges: [number, number][] = [
      [v0, v1],
      [v1, v2],
      [v2, v0],
    ];
    for (let e = 0; e < 3; e++) {
      const a = edges[e][0];
      const b = edges[e][1];
      const key = a < b ? `${a}_${b}` : `${b}_${a}`;
      const prev = edgeFirstTri.get(key);
      if (prev === undefined) {
        edgeFirstTri.set(key, t);
      } else {
        addAdj(prev, t);
      }
    }
    if ((t & 8191) === 8191 && performance.now() >= deadline) {
      await yieldToMainThread();
      deadline = performance.now() + 50;
    }
  }

  const visited = new Uint8Array(triCount);
  const queue = new Int32Array(triCount);

  for (let startT = 0; startT < triCount; startT++) {
    if (visited[startT]) continue;
    const ext = updated[startT];
    let head = 0;
    let tail = 0;
    queue[tail++] = startT;
    visited[startT] = 1;

    const compTris: number[] = [];
    const neighborVotes = new Map<number, number>();

    while (head < tail) {
      const curr = queue[head++];
      compTris.push(curr);

      for (let edgePtr = adjHead[curr]; edgePtr !== -1; edgePtr = adjNext[edgePtr]) {
        const nb = adjTo[edgePtr];
        const nbExt = updated[nb];
        if (nbExt === ext) {
          if (!visited[nb]) {
            visited[nb] = 1;
            queue[tail++] = nb;
          }
        } else {
          neighborVotes.set(nbExt, (neighborVotes.get(nbExt) || 0) + 1);
        }
      }
    }

    if (compTris.length < minIslandTriangles && neighborVotes.size > 0) {
      let bestExt = ext;
      let bestScore = -1;
      for (const [candExt, count] of neighborVotes.entries()) {
        if (count > bestScore) {
          bestScore = count;
          bestExt = candExt;
        }
      }
      if (bestExt !== ext) {
        for (const t of compTris) {
          updated[t] = bestExt;
        }
      }
    }

    if ((startT & 8191) === 8191 && performance.now() >= deadline) {
      await yieldToMainThread();
      deadline = performance.now() + 50;
    }
  }

  return updated;
};

/**
 * Área assinada 2D (positiva = sentido anti-horário CCW)
 */
const signedArea2D = (pts: ReadonlyArray<[number, number]>): number => {
  let area = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % n];
    area += x0 * y1 - x1 * y0;
  }
  return area * 0.5;
};

const pointInTriangle2D = (
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
  cx: number, cy: number
): boolean => {
  const c1 = (bx - ax) * (py - ay) - (by - ay) * (px - ax);
  const c2 = (cx - bx) * (py - by) - (cy - by) * (px - bx);
  const c3 = (ax - cx) * (py - cy) - (ay - cy) * (px - cx);
  return c1 >= -1e-8 && c2 >= -1e-8 && c3 >= -1e-8;
};

/**
 * Triangulação 2D por Ear-Clipping para um polígono simples orientado em sentido CCW.
 * Retorna triplas de índices referentes ao array `polyVertIds`.
 */
export const earClipPolygon2D = (
  pts2D: ReadonlyArray<[number, number]>,
  polyVertIds: ReadonlyArray<number>
): number[] => {
  const n = pts2D.length;
  if (n < 3) return [];
  if (n === 3) return [polyVertIds[0], polyVertIds[1], polyVertIds[2]];

  // Para laços gigantescos (> 700 vértices), fan centrado evita custo quadrático excessivo mantendo fechamento
  if (n > 700) {
    const tris: number[] = [];
    const root = polyVertIds[0];
    for (let i = 1; i < n - 1; i++) {
      if (polyVertIds[i] !== root && polyVertIds[i + 1] !== root && polyVertIds[i] !== polyVertIds[i + 1]) {
        tris.push(root, polyVertIds[i], polyVertIds[i + 1]);
      }
    }
    return tris;
  }

  const active: number[] = [];
  for (let i = 0; i < n; i++) active.push(i);

  const tris: number[] = [];
  let guard = n * n * 2 + 32;
  let relaxPass = false;
  let cursor = 0;
  let failsSinceClip = 0;

  while (active.length > 3 && guard-- > 0) {
    const len = active.length;
    const prevIdx = active[(cursor + len - 1) % len];
    const currIdx = active[cursor % len];
    const nextIdx = active[(cursor + 1) % len];

    const [ax, ay] = pts2D[prevIdx];
    const [bx, by] = pts2D[currIdx];
    const [cx, cy] = pts2D[nextIdx];

    const cross = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    const minCross = relaxPass ? -1e-5 : 1e-9;

    let isEar = cross >= minCross;
    if (isEar && !relaxPass && cross > 1e-9) {
      for (let j = 0; j < len; j++) {
        const testIdx = active[j];
        if (testIdx === prevIdx || testIdx === currIdx || testIdx === nextIdx) continue;
        const [px, py] = pts2D[testIdx];
        if (
          (Math.abs(px - ax) < 1e-7 && Math.abs(py - ay) < 1e-7) ||
          (Math.abs(px - bx) < 1e-7 && Math.abs(py - by) < 1e-7) ||
          (Math.abs(px - cx) < 1e-7 && Math.abs(py - cy) < 1e-7)
        ) {
          continue;
        }
        if (pointInTriangle2D(px, py, ax, ay, bx, by, cx, cy)) {
          isEar = false;
          break;
        }
      }
    }

    if (isEar) {
      const idA = polyVertIds[prevIdx];
      const idB = polyVertIds[currIdx];
      const idC = polyVertIds[nextIdx];
      if (idA !== idB && idB !== idC && idC !== idA) {
        tris.push(idA, idB, idC);
      }
      active.splice(cursor % len, 1);
      if (cursor >= active.length) cursor = 0;
      failsSinceClip = 0;
    } else {
      cursor = (cursor + 1) % len;
      failsSinceClip++;
      if (failsSinceClip >= len) {
        if (!relaxPass) {
          relaxPass = true;
          failsSinceClip = 0;
        } else {
          // Forçar corte de emergência para garantir fechamento total sem travar
          const idA = polyVertIds[prevIdx];
          const idB = polyVertIds[currIdx];
          const idC = polyVertIds[nextIdx];
          if (idA !== idB && idB !== idC && idC !== idA) {
            tris.push(idA, idB, idC);
          }
          active.splice(cursor % len, 1);
          if (cursor >= active.length) cursor = 0;
          failsSinceClip = 0;
        }
      }
    }
  }

  if (active.length === 3) {
    const idA = polyVertIds[active[0]];
    const idB = polyVertIds[active[1]];
    const idC = polyVertIds[active[2]];
    if (idA !== idB && idB !== idC && idC !== idA) {
      tris.push(idA, idB, idC);
    }
  }

  return tris;
};

/**
 * Conecta buracos internos (ex: furos de pinos/soquetes em uma face de corte) ao contorno externo CCW
 * usando pontes de Eberly (raio horizontal à direita) e triangula o polígono resultante.
 */
export const triangulatePolygon2DWithHoles = (
  outerPts: ReadonlyArray<[number, number]>,
  outerIds: ReadonlyArray<number>,
  holes: ReadonlyArray<{ pts: [number, number][]; ids: number[] }>
): number[] => {
  let mergedPts = [...outerPts];
  let mergedIds = [...outerIds];

  let flipResult = false;
  if (signedArea2D(mergedPts) < 0) {
    mergedPts.reverse();
    mergedIds.reverse();
    flipResult = true;
  }

  if (holes.length > 0) {
    // Preparar buracos em orientação horária (CW: signedArea < 0) e ordenar pelo maior X decrescente
    const preparedHoles = holes
      .filter((h) => h.pts.length >= 3)
      .map((h) => {
        const pts = [...h.pts];
        const ids = [...h.ids];
        if (signedArea2D(pts) > 0) {
          pts.reverse();
          ids.reverse();
        }
        let maxX = -Infinity;
        let maxIdx = 0;
        for (let i = 0; i < pts.length; i++) {
          if (pts[i][0] > maxX) {
            maxX = pts[i][0];
            maxIdx = i;
          }
        }
        return { pts, ids, maxX, maxIdx };
      })
      .sort((a, b) => b.maxX - a.maxX);

    for (const hole of preparedHoles) {
      const [hx, hy] = hole.pts[hole.maxIdx];
      let bestBridgeIdx = 0;
      let bestIntersectX = Infinity;

      const mLen = mergedPts.length;
      for (let i = 0; i < mLen; i++) {
        const [x0, y0] = mergedPts[i];
        const [x1, y1] = mergedPts[(i + 1) % mLen];
        if ((y0 > hy) === (y1 > hy)) continue;
        const ix = x0 + ((hy - y0) * (x1 - x0)) / (y1 - y0);
        if (ix >= hx - 1e-6 && ix < bestIntersectX) {
          bestIntersectX = ix;
          bestBridgeIdx = x0 >= x1 ? i : (i + 1) % mLen;
        }
      }

      if (!Number.isFinite(bestIntersectX)) {
        // Fallback: vértice externo mais próximo
        let minDist = Infinity;
        for (let i = 0; i < mLen; i++) {
          const d = Math.hypot(mergedPts[i][0] - hx, mergedPts[i][1] - hy);
          if (d < minDist) {
            minDist = d;
            bestBridgeIdx = i;
          }
        }
      }

      const rotatedHolePts: [number, number][] = [];
      const rotatedHoleIds: number[] = [];
      for (let k = 0; k < hole.pts.length; k++) {
        const idx = (hole.maxIdx + k) % hole.pts.length;
        rotatedHolePts.push(hole.pts[idx]);
        rotatedHoleIds.push(hole.ids[idx]);
      }

      mergedPts = [
        ...mergedPts.slice(0, bestBridgeIdx + 1),
        ...rotatedHolePts,
        rotatedHolePts[0],
        mergedPts[bestBridgeIdx],
        ...mergedPts.slice(bestBridgeIdx + 1),
      ];
      mergedIds = [
        ...mergedIds.slice(0, bestBridgeIdx + 1),
        ...rotatedHoleIds,
        rotatedHoleIds[0],
        mergedIds[bestBridgeIdx],
        ...mergedIds.slice(bestBridgeIdx + 1),
      ];
    }
  }

  const tris = earClipPolygon2D(mergedPts, mergedIds);
  if (flipResult) {
    for (let i = 0; i < tris.length; i += 3) {
      const tmp = tris[i + 1];
      tris[i + 1] = tris[i + 2];
      tris[i + 2] = tmp;
    }
  }
  return tris;
};

/**
 * Teste Ponto-em-Polígono 2D (Ray Casting) + Distância mínima até qualquer aresta do polígono
 */
const pointInsideAndClearance2D = (
  px: number,
  py: number,
  poly: ReadonlyArray<[number, number]>
): { inside: boolean; minDist: number } => {
  let inside = false;
  let minDistSq = Infinity;
  const n = poly.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];

    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }

    const dx = xj - xi;
    const dy = yj - yi;
    const lenSq = dx * dx + dy * dy;
    let t = lenSq > 1e-10 ? ((px - xi) * dx + (py - yi) * dy) / lenSq : 0;
    t = Math.max(0, Math.min(1, t));
    const projX = xi + t * dx;
    const projY = yi + t * dy;
    const dSq = (px - projX) * (px - projX) + (py - projY) * (py - projY);
    if (dSq < minDistSq) minDistSq = dSq;
  }

  return { inside, minDist: Math.sqrt(minDistSq) };
};

/**
 * Encontra até `maxCount` centros bem espaçados no interior de um polígono 2D onde caibam conectores
 * com raio de segurança `requiredClearanceRadius`.
 */
export const findConnectorCenters2D = (
  poly: ReadonlyArray<[number, number]>,
  requiredClearanceRadius: number,
  maxCount: number
): [number, number][] => {
  if (maxCount <= 0 || poly.length < 3) return [];

  let minU = Infinity, maxU = -Infinity;
  let minV = Infinity, maxV = -Infinity;
  for (const [u, v] of poly) {
    if (u < minU) minU = u;
    if (u > maxU) maxU = u;
    if (v < minV) minV = v;
    if (v > maxV) maxV = v;
  }

  const spanU = maxU - minU;
  const spanV = maxV - minV;
  if (spanU < requiredClearanceRadius * 2 || spanV < requiredClearanceRadius * 2) {
    return [];
  }

  const steps = 18;
  const candidates: Array<{ u: number; v: number; clearance: number }> = [];

  for (let iu = 1; iu < steps; iu++) {
    const u = minU + (spanU * iu) / steps;
    for (let iv = 1; iv < steps; iv++) {
      const v = minV + (spanV * iv) / steps;
      const { inside, minDist } = pointInsideAndClearance2D(u, v, poly);
      if (inside && minDist >= requiredClearanceRadius) {
        candidates.push({ u, v, clearance: minDist });
      }
    }
  }

  if (candidates.length === 0) return [];
  candidates.sort((a, b) => b.clearance - a.clearance);

  const chosen: [number, number][] = [[candidates[0].u, candidates[0].v]];
  const minPinSpacing = requiredClearanceRadius * 2.5;

  while (chosen.length < maxCount) {
    let bestCand: [number, number] | null = null;
    let bestScore = -Infinity;

    for (const c of candidates) {
      let minSep = Infinity;
      for (const [cu, cv] of chosen) {
        const d = Math.hypot(c.u - cu, c.v - cv);
        if (d < minSep) minSep = d;
      }
      if (minSep < minPinSpacing) continue;
      const score = minSep * 0.75 + c.clearance * 0.25;
      if (score > bestScore) {
        bestScore = score;
        bestCand = [c.u, c.v];
      }
    }

    if (!bestCand) break;
    chosen.push(bestCand);
  }

  return chosen;
};

/**
 * Gera o perfil 2D regular do conector (cilindro 16 lados, cubo quadrado ou triângulo guia antirrotação)
 */
const makeConnectorProfile2D = (
  shape: ConnectorShape,
  centerU: number,
  centerV: number,
  radius: number
): [number, number][] => {
  if (shape === 'none') return [];
  const sides = shape === 'cylinder' ? 16 : shape === 'cube' ? 4 : 3;
  const angleOffset = shape === 'cube' ? Math.PI / 4 : -Math.PI / 2;
  // Para cubo com "diâmetro" D (lado = D), raio circunscrito = r * sqrt(2)
  const effRadius = shape === 'cube' ? radius * Math.SQRT2 : shape === 'triangle' ? radius * 1.15 : radius;

  const pts: [number, number][] = [];
  for (let i = 0; i < sides; i++) {
    const ang = angleOffset + (i * Math.PI * 2) / sides;
    pts.push([centerU + effRadius * Math.cos(ang), centerV + effRadius * Math.sin(ang)]);
  }
  return pts;
};

/**
 * Constrói uma base ortonormal (T1, T2) perpendicular a `normal` tal que `(T1 x T2) . normal > 0`
 */
const buildOrthonormalBasis = (
  nx: number,
  ny: number,
  nz: number
): { t1: [number, number, number]; t2: [number, number, number] } => {
  const ref: [number, number, number] = Math.abs(nz) < 0.85 ? [0, 0, 1] : [1, 0, 0];
  let t1x = ref[1] * nz - ref[2] * ny;
  let t1y = ref[2] * nx - ref[0] * nz;
  let t1z = ref[0] * ny - ref[1] * nx;
  const len1 = Math.hypot(t1x, t1y, t1z) || 1;
  t1x /= len1;
  t1y /= len1;
  t1z /= len1;

  // T2 = N x T1 => T1 x T2 = N
  const t2x = ny * t1z - nz * t1y;
  const t2y = nz * t1x - nx * t1z;
  const t2z = nx * t1y - ny * t1x;

  return {
    t1: [t1x, t1y, t1z],
    t2: [t2x, t2y, t2z],
  };
};

/**
 * Adiciona um prisma de Pino Macho (saliente ao longo de +dir) ou Soquete Fêmea (rebaixado ao longo de +dir)
 * conectado diretamente aos vértices `baseRingIds` do furo na tampa plana, mantendo 100% de estanqueidade!
 */
const appendConnectorPrism = (
  verts: number[],
  tris: number[],
  profile2D: ReadonlyArray<[number, number]>,
  origin: [number, number, number],
  t1: [number, number, number],
  t2: [number, number, number],
  capNormal: [number, number, number],
  extrudeDir: [number, number, number],
  depthMm: number,
  tipChamferMm: number
): number[] => {
  const k = profile2D.length;
  const baseRingIds: number[] = [];
  const tipRingIds: number[] = [];

  // Centro 2D do perfil para chanfro leve na ponta do pino macho
  let cu = 0, cv = 0;
  for (const [u, v] of profile2D) {
    cu += u;
    cv += v;
  }
  cu /= k;
  cv /= k;

  for (let i = 0; i < k; i++) {
    const [u, v] = profile2D[i];
    const bx = origin[0] + u * t1[0] + v * t2[0];
    const by = origin[1] + u * t1[1] + v * t2[1];
    const bz = origin[2] + u * t1[2] + v * t2[2];
    const bId = verts.length / 3;
    verts.push(bx, by, bz);
    baseRingIds.push(bId);

    const du = u - cu;
    const dv = v - cv;
    const rad = Math.hypot(du, dv) || 1;
    const shrink = tipChamferMm > 0 ? Math.max(0.6, (rad - tipChamferMm) / rad) : 1.0;
    const tu = cu + du * shrink;
    const tv = cv + dv * shrink;

    const tx = origin[0] + tu * t1[0] + tv * t2[0] + extrudeDir[0] * depthMm;
    const ty = origin[1] + tu * t1[1] + tv * t2[1] + extrudeDir[1] * depthMm;
    const tz = origin[2] + tu * t1[2] + tv * t2[2] + extrudeDir[2] * depthMm;
    const tId = verts.length / 3;
    verts.push(tx, ty, tz);
    tipRingIds.push(tId);
  }

  // `profile2D` está em CCW na base (T1, T2) cuja normal é `capNormal`.
  // Como a tampa principal contorna o furo em sentido CW (buraco), as paredes do prisma devem usar
  // a meia-aresta oposta `(b_i -> b_{i+1})` para cancelar exatamente com `(b_{i+1} -> b_i)` da tampa!
  for (let i = 0; i < k; i++) {
    const next = (i + 1) % k;
    const b0 = baseRingIds[i];
    const b1 = baseRingIds[next];
    const t0 = tipRingIds[i];
    const t1Id = tipRingIds[next];

    tris.push(b0, b1, t1Id);
    tris.push(b0, t1Id, t0);
  }

  // Fechar topo do pino / fundo do soquete com normal apontando para `capNormal`
  const centerTipId = verts.length / 3;
  verts.push(
    origin[0] + cu * t1[0] + cv * t2[0] + extrudeDir[0] * depthMm,
    origin[1] + cu * t1[1] + cv * t2[1] + extrudeDir[1] * depthMm,
    origin[2] + cu * t1[2] + cv * t2[2] + extrudeDir[2] * depthMm
  );
  // Verificar sinal: na base (T1,T2), `profile2D` é CCW => `(tip_i, tip_{i+1}, centerTip)` tem normal `+capNormal`!
  const dotCheck = capNormal[0] * (t1[1] * t2[2] - t1[2] * t2[1]) +
    capNormal[1] * (t1[2] * t2[0] - t1[0] * t2[2]) +
    capNormal[2] * (t1[0] * t2[1] - t1[1] * t2[0]);

  for (let i = 0; i < k; i++) {
    const next = (i + 1) % k;
    if (dotCheck >= 0) {
      tris.push(tipRingIds[i], tipRingIds[next], centerTipId);
    } else {
      tris.push(tipRingIds[next], tipRingIds[i], centerTipId);
    }
  }

  return baseRingIds;
};

/**
 * Extrai laços fechados de fronteira aberta (onde a meia-aresta `(u -> v)` existe mas `(v -> u)` falta)
 * e fecha cada abertura de modo estanque (watertight):
 * - Para costuras de pintura em superfície 3D, cria automaticamente raiz de encaixe interna (plug) na peça menor
 *   e cavidade rebaixada correspondente (pocket) com folga `seamClearanceMm` na peça hospedeira!
 * - Opcionalmente adiciona pinos/soquetes de alinhamento nas interfaces compatíveis.
 */
export interface SeamMateContext {
  globalVertices: Float32Array;
  globalIndices: Uint32Array;
  globalHalfEdgeTri: Map<string, number>;
  localToGlobal: Int32Array;
}

export const capOpenMeshBoundaries = (
  inVerts: Float32Array,
  inIndices: Uint32Array,
  options: SplitEngineOptions,
  mateContext?: SeamMateContext
): {
  vertices: Float32Array;
  indices: Uint32Array;
  isWatertight: boolean;
  openEdgesCount: number;
  connectorsAdded: number;
} => {
  const verts = Array.from(inVerts);
  const tris = Array.from(inIndices);
  const triCount = tris.length / 3;

  // Mapear meias-arestas direcionadas existentes `u_v` -> índice do triângulo incidente
  const halfEdgeTri = new Map<string, number>();
  for (let t = 0; t < triCount; t++) {
    const a = tris[t * 3];
    const b = tris[t * 3 + 1];
    const c = tris[t * 3 + 2];
    halfEdgeTri.set(`${a}_${b}`, t);
    halfEdgeTri.set(`${b}_${c}`, t);
    halfEdgeTri.set(`${c}_${a}`, t);
  }

  // Encontrar meias-arestas faltantes `(v -> u)` para fechar a superfície
  interface MissingEdge {
    from: number;
    to: number;
    adjTri: number;
    used: boolean;
  }

  const missingEdges: MissingEdge[] = [];
  const outgoingByVert = new Map<number, number[]>();

  for (let t = 0; t < triCount; t++) {
    const corners = [tris[t * 3], tris[t * 3 + 1], tris[t * 3 + 2]];
    for (let e = 0; e < 3; e++) {
      const u = corners[e];
      const v = corners[(e + 1) % 3];
      if (!halfEdgeTri.has(`${v}_${u}`)) {
        const edgeIdx = missingEdges.length;
        missingEdges.push({ from: v, to: u, adjTri: t, used: false });
        let list = outgoingByVert.get(v);
        if (!list) {
          list = [];
          outgoingByVert.set(v, list);
        }
        list.push(edgeIdx);
      }
    }
  }

  if (missingEdges.length === 0 || options.capMode === 'open') {
    return {
      vertices: inVerts,
      indices: inIndices,
      isWatertight: missingEdges.length === 0,
      openEdgesCount: missingEdges.length,
      connectorsAdded: 0,
    };
  }

  let connectorsAdded = 0;

  // Encadear meias-arestas faltantes em laços fechados
  for (let i = 0; i < missingEdges.length; i++) {
    if (missingEdges[i].used) continue;

    const loopVerts: number[] = [];
    const loopAdjTris: number[] = [];
    const startVert = missingEdges[i].from;
    let currEdgeIdx = i;
    let closed = false;

    while (currEdgeIdx !== -1 && loopVerts.length < missingEdges.length + 2) {
      const edge = missingEdges[currEdgeIdx];
      edge.used = true;
      loopVerts.push(edge.from);
      loopAdjTris.push(edge.adjTri);

      const nextV = edge.to;
      if (nextV === startVert && loopVerts.length >= 3) {
        closed = true;
        break;
      }

      const candidates = outgoingByVert.get(nextV);
      let nextEdgeIdx = -1;
      if (candidates) {
        for (const cIdx of candidates) {
          if (!missingEdges[cIdx].used) {
            nextEdgeIdx = cIdx;
            break;
          }
        }
      }
      currEdgeIdx = nextEdgeIdx;
    }

    if (!closed || loopVerts.length < 3) continue;

    // Remover eventuais sub-laços figura-8 internos mantendo o anel simples principal
    const k = loopVerts.length;
    let cx = 0, cy = 0, cz = 0;
    for (let j = 0; j < k; j++) {
      const vId = loopVerts[j];
      cx += verts[vId * 3];
      cy += verts[vId * 3 + 1];
      cz += verts[vId * 3 + 2];
    }
    cx /= k;
    cy /= k;
    cz /= k;

    let avgRadius = 0;
    for (let j = 0; j < k; j++) {
      const vId = loopVerts[j];
      avgRadius += Math.hypot(verts[vId * 3] - cx, verts[vId * 3 + 1] - cy, verts[vId * 3 + 2] - cz);
    }
    avgRadius /= k;

    // Normal de Newell do laço da tampa (aponta na direção da normal externa da tampa!)
    let nwx = 0, nwy = 0, nwz = 0;
    for (let j = 0; j < k; j++) {
      const vA = loopVerts[j];
      const vB = loopVerts[(j + 1) % k];
      const ax = verts[vA * 3], ay = verts[vA * 3 + 1], az = verts[vA * 3 + 2];
      const bx = verts[vB * 3], by = verts[vB * 3 + 1], bz = verts[vB * 3 + 2];
      nwx += (ay - by) * (az + bz);
      nwy += (az - bz) * (ax + bx);
      nwz += (ax - bx) * (ay + by);
    }
    const nwLen = Math.hypot(nwx, nwy, nwz);
    if (nwLen < 1e-8) {
      // Fechamento por fan simples se o laço for quase colinear
      const cId = verts.length / 3;
      verts.push(cx, cy, cz);
      for (let j = 0; j < k; j++) {
        tris.push(loopVerts[j], loopVerts[(j + 1) % k], cId);
      }
      continue;
    }
    nwx /= nwLen;
    nwy /= nwLen;
    nwz /= nwLen;

    // Projeção normal média ponderada por área dos triângulos adjacentes desta peça (`aSelf`)
    // e da peça conjugada através da costura (`aMate`), imune ao cancelamento de paredes a 90°!
    let snx = 0, sny = 0, snz = 0;
    let selfAreaSum = 0;
    for (let j = 0; j < loopAdjTris.length; j++) {
      const t = loopAdjTris[j];
      const i0 = tris[t * 3] * 3;
      const i1 = tris[t * 3 + 1] * 3;
      const i2 = tris[t * 3 + 2] * 3;
      const abx = verts[i1] - verts[i0], aby = verts[i1 + 1] - verts[i0 + 1], abz = verts[i1 + 2] - verts[i0 + 2];
      const acx = verts[i2] - verts[i0], acy = verts[i2 + 1] - verts[i0 + 1], acz = verts[i2 + 2] - verts[i0 + 2];
      const crx = aby * acz - abz * acy;
      const cry = abz * acx - abx * acz;
      const crz = abx * acy - aby * acx;
      snx += crx;
      sny += cry;
      snz += crz;
      selfAreaSum += Math.hypot(crx, cry, crz);
    }
    const aSelf = selfAreaSum > 1e-8 ? (nwx * snx + nwy * sny + nwz * snz) / selfAreaSum : 0;

    let aMate = -aSelf;
    let hasMate = false;
    if (mateContext) {
      let mnx = 0, mny = 0, mnz = 0;
      let mateAreaSum = 0;
      const gv = mateContext.globalVertices;
      const gi = mateContext.globalIndices;
      const l2g = mateContext.localToGlobal;
      for (let j = 0; j < k; j++) {
        const localFrom = loopVerts[j];
        const localTo = loopVerts[(j + 1) % k];
        if (localFrom < l2g.length && localTo < l2g.length) {
          const gFrom = l2g[localFrom];
          const gTo = l2g[localTo];
          const tMate = mateContext.globalHalfEdgeTri.get(`${gFrom}_${gTo}`);
          if (tMate !== undefined) {
            const i0 = gi[tMate * 3] * 3;
            const i1 = gi[tMate * 3 + 1] * 3;
            const i2 = gi[tMate * 3 + 2] * 3;
            const abx = gv[i1] - gv[i0], aby = gv[i1 + 1] - gv[i0 + 1], abz = gv[i1 + 2] - gv[i0 + 2];
            const acx = gv[i2] - gv[i0], acy = gv[i2 + 1] - gv[i0 + 1], acz = gv[i2 + 2] - gv[i0 + 2];
            const crx = aby * acz - abz * acy;
            const cry = abz * acx - abx * acz;
            const crz = abx * acy - aby * acx;
            mnx += crx;
            mny += cry;
            mnz += crz;
            mateAreaSum += Math.hypot(crx, cry, crz);
          }
        }
      }
      if (mateAreaSum > 1e-8) {
        // A peça oposta percorre o mesmo laço em ordem reversa (`N_mate = -N_newell`)
        aMate = (-nwx * mnx - nwy * mny - nwz * mnz) / mateAreaSum;
        hasMate = true;
      }
    }

    // Classificação simétrica bijetora: um lado é `'plug'` se e somente se o lado oposto for `'pocket'`!
    const seamRole: 'plug' | 'pocket' | 'flush' = hasMate
      ? aSelf <= -0.25 && aMate > -0.25
        ? 'plug'
        : aMate <= -0.25 && aSelf > -0.25
          ? 'pocket'
          : 'flush'
      : aSelf <= -0.25
        ? 'plug'
        : aSelf >= 0.25
          ? 'pocket'
          : 'flush';

    const isInsertPlug = seamRole === 'plug';
    // Eixo de extrusão coaxial exato (`+N_newell` no plug === `-N_newell_mate` no pocket!)
    const ex = isInsertPlug ? nwx : -nwx;
    const ey = isInsertPlug ? nwy : -nwy;
    const ez = isInsertPlug ? nwz : -nwz;
    const clearance = Math.max(0, options.seamClearanceMm);

    // Avaliar planaridade do laço
    let maxPlaneDev = 0;
    for (let j = 0; j < k; j++) {
      const vId = loopVerts[j];
      const dev = Math.abs(
        (verts[vId * 3] - cx) * nwx +
        (verts[vId * 3 + 1] - cy) * nwy +
        (verts[vId * 3 + 2] - cz) * nwz
      );
      if (dev > maxPlaneDev) maxPlaneDev = dev;
    }
    const isPlanarLoop = maxPlaneDev <= Math.max(0.15, avgRadius * 0.045);

    const isSurfacePaintSeam = seamRole !== 'flush' && avgRadius >= 0.4;

    if (isSurfacePaintSeam && options.capMode === 'inward_shell') {
      // Modo Inlay / Pocket com espessura 3D física real para encaixe perfeito (mesmo em pinturas planas ou faces de caixa 90°!)
      const baseDepth = Math.min(2.2, Math.max(0.85, avgRadius * 0.28));
      const extrudeDepth = isInsertPlug ? baseDepth : baseDepth + clearance;
      const radialShrink = isInsertPlug
        ? Math.min(0.35, (clearance + 0.18) / Math.max(1.0, avgRadius))
        : Math.min(0.28, 0.16 / Math.max(1.0, avgRadius));

      const innerRingIds: number[] = [];
      for (let j = 0; j < k; j++) {
        const vId = loopVerts[j];
        const px = verts[vId * 3];
        const py = verts[vId * 3 + 1];
        const pz = verts[vId * 3 + 2];

        const ix = px + (cx - px) * radialShrink + ex * extrudeDepth;
        const iy = py + (cy - py) * radialShrink + ey * extrudeDepth;
        const iz = pz + (cz - pz) * radialShrink + ez * extrudeDepth;

        const newId = verts.length / 3;
        verts.push(ix, iy, iz);
        innerRingIds.push(newId);
      }

      // Paredes laterais conectando `loopVerts` ao `innerRingIds`
      for (let j = 0; j < k; j++) {
        const next = (j + 1) % k;
        const o0 = loopVerts[j];
        const o1 = loopVerts[next];
        const i0 = innerRingIds[j];
        const i1 = innerRingIds[next];
        tris.push(o0, o1, i1);
        tris.push(o0, i1, i0);
      }

      // Fechar fundo do anel interno
      const { t1, t2 } = buildOrthonormalBasis(nwx, nwy, nwz);
      const innerOrigin: [number, number, number] = [
        cx + ex * extrudeDepth,
        cy + ey * extrudeDepth,
        cz + ez * extrudeDepth,
      ];
      const innerPts2D: [number, number][] = innerRingIds.map((id) => {
        const dx = verts[id * 3] - innerOrigin[0];
        const dy = verts[id * 3 + 1] - innerOrigin[1];
        const dz = verts[id * 3 + 2] - innerOrigin[2];
        return [dx * t1[0] + dy * t1[1] + dz * t1[2], dx * t2[0] + dy * t2[1] + dz * t2[2]];
      });

      // Opcional: adicionar pinos/soquetes na base do encaixe se couberem
      const holes: Array<{ pts: [number, number][]; ids: number[] }> = [];
      if (options.connectorShape !== 'none' && isPlanarLoop) {
        const rPin = options.connectorDiameterMm * 0.5;
        const rSock = rPin + options.connectorClearanceMm;
        const centers = findConnectorCenters2D(
          innerPts2D,
          rSock + 1.1,
          options.connectorCountPerSeam
        );
        for (const [cu, cv] of centers) {
          const radius = isInsertPlug ? rPin : rSock;
          const depth = isInsertPlug ? options.connectorDepthMm : options.connectorDepthMm + 0.35;
          const profile = makeConnectorProfile2D(options.connectorShape, cu, cv, radius);
          const dir: [number, number, number] = [ex, ey, ez];
          const ringIds = appendConnectorPrism(
            verts,
            tris,
            profile,
            innerOrigin,
            t1,
            t2,
            [nwx, nwy, nwz],
            dir,
            depth,
            isInsertPlug ? 0.35 : 0
          );
          holes.push({ pts: profile, ids: ringIds });
          connectorsAdded++;
        }
      }

      const capTris = triangulatePolygon2DWithHoles(innerPts2D, innerRingIds, holes);
      for (let j = 0; j < capTris.length; j++) tris.push(capTris[j]);
    } else if (isPlanarLoop) {
      // Laço planar: Ear-Clipping 2D exato (+ pinos/soquetes opcionais)
      const { t1, t2 } = buildOrthonormalBasis(nwx, nwy, nwz);
      const origin: [number, number, number] = [cx, cy, cz];
      const pts2D: [number, number][] = loopVerts.map((id) => {
        const dx = verts[id * 3] - cx;
        const dy = verts[id * 3 + 1] - cy;
        const dz = verts[id * 3 + 2] - cz;
        return [dx * t1[0] + dy * t1[1] + dz * t1[2], dx * t2[0] + dy * t2[1] + dz * t2[2]];
      });

      const dominantNormal = Math.abs(nwz) > 1e-4 ? nwz : Math.abs(nwy) > 1e-4 ? nwy : nwx;
      const isMaleSide =
        seamRole === 'plug' ? true : seamRole === 'pocket' ? false : dominantNormal < 0;
      const holes: Array<{ pts: [number, number][]; ids: number[] }> = [];

      if (options.connectorShape !== 'none') {
        const rPin = options.connectorDiameterMm * 0.5;
        const rSock = rPin + options.connectorClearanceMm;
        const centers = findConnectorCenters2D(pts2D, rSock + 1.2, options.connectorCountPerSeam);
        for (const [cu, cv] of centers) {
          const radius = isMaleSide ? rPin : rSock;
          const depth = isMaleSide ? options.connectorDepthMm : options.connectorDepthMm + 0.35;
          const profile = makeConnectorProfile2D(options.connectorShape, cu, cv, radius);
          const dir: [number, number, number] = isMaleSide
            ? [nwx, nwy, nwz]
            : [-nwx, -nwy, -nwz];
          const ringIds = appendConnectorPrism(
            verts,
            tris,
            profile,
            origin,
            t1,
            t2,
            [nwx, nwy, nwz],
            dir,
            depth,
            isMaleSide ? 0.35 : 0
          );
          holes.push({ pts: profile, ids: ringIds });
          connectorsAdded++;
        }
      }

      const capTris = triangulatePolygon2DWithHoles(pts2D, loopVerts, holes);
      for (let j = 0; j < capTris.length; j++) tris.push(capTris[j]);
    } else {
      // Costura 3D curva padrão ('watertight'): ápice cônico interno recuado com folga anti-colisão
      const coneOffset = isSurfacePaintSeam
        ? (isInsertPlug ? Math.min(1.6, Math.max(0.5, avgRadius * 0.2)) : Math.min(1.6, Math.max(0.5, avgRadius * 0.2)) + clearance)
        : 0;

      const apexId = verts.length / 3;
      verts.push(cx + ex * coneOffset, cy + ey * coneOffset, cz + ez * coneOffset);

      for (let j = 0; j < k; j++) {
        const a = loopVerts[j];
        const b = loopVerts[(j + 1) % k];
        if (a !== b) {
          tris.push(a, b, apexId);
        }
      }
    }
  }

  // Revalidar arestas abertas remanescentes após fechamento
  const finalHalfEdges = new Set<string>();
  const finalTriCount = tris.length / 3;
  for (let t = 0; t < finalTriCount; t++) {
    const a = tris[t * 3];
    const b = tris[t * 3 + 1];
    const c = tris[t * 3 + 2];
    finalHalfEdges.add(`${a}_${b}`);
    finalHalfEdges.add(`${b}_${c}`);
    finalHalfEdges.add(`${c}_${a}`);
  }
  let remainingOpen = 0;
  for (let t = 0; t < finalTriCount; t++) {
    const a = tris[t * 3];
    const b = tris[t * 3 + 1];
    const c = tris[t * 3 + 2];
    if (!finalHalfEdges.has(`${b}_${a}`)) remainingOpen++;
    if (!finalHalfEdges.has(`${c}_${b}`)) remainingOpen++;
    if (!finalHalfEdges.has(`${a}_${c}`)) remainingOpen++;
  }

  return {
    vertices: new Float32Array(verts),
    indices: new Uint32Array(tris),
    isWatertight: remainingOpen === 0,
    openEdgesCount: remainingOpen,
    connectorsAdded,
  };
};

/**
 * Calcula caixa delimitadora (AABB) e centroide de um conjunto de vértices
 */
export const computeMeshBounds = (
  vertices: Float32Array
): {
  bboxMin: [number, number, number];
  bboxMax: [number, number, number];
  centroid: [number, number, number];
} => {
  const vCount = vertices.length / 3;
  if (vCount === 0) {
    return {
      bboxMin: [0, 0, 0],
      bboxMax: [0, 0, 0],
      centroid: [0, 0, 0],
    };
  }

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  for (let i = 0; i < vCount; i++) {
    const x = vertices[i * 3];
    const y = vertices[i * 3 + 1];
    const z = vertices[i * 3 + 2];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }

  return {
    bboxMin: [minX, minY, minZ],
    bboxMax: [maxX, maxY, maxZ],
    centroid: [(minX + maxX) * 0.5, (minY + maxY) * 0.5, (minZ + maxZ) * 0.5],
  };
};

/**
 * Divide uma sopa de triângulos coloridos em peças `SplitPartMesh` independentes,
 * aplicando filtro de ruído, separação opcional de ilhas desconectadas e fechamento estanque de costuras!
 */
export const buildSplitColorParts = async (
  soup: RawColoredSoup,
  options: SplitEngineOptions,
  getColorName: (hex: string) => string,
  defaultColors: ReadonlyArray<string>
): Promise<SplitPartMesh[]> => {
  const welded = await weldColoredSoup(soup.vertices, soup.indices, soup.faceExtruders, 1e-4);
  const cleanedExtruders = await cleanupSmallColorIslands(
    welded.indices,
    welded.faceExtruders,
    options.minIslandTriangles
  );

  const triCount = welded.indices.length / 3;
  if (triCount === 0) return [];

  let deadline = performance.now() + 50;

  // Agrupar triângulos por extrusora (e opcionalmente por componente conectado)
  interface PartGroup {
    extruderId: number;
    islandIndex: number;
    triList: number[];
  }

  const groups: PartGroup[] = [];

  if (!options.splitDisconnectedIslands) {
    const byExtruder = new Map<number, number[]>();
    for (let t = 0; t < triCount; t++) {
      const ext = cleanedExtruders[t];
      let arr = byExtruder.get(ext);
      if (!arr) {
        arr = [];
        byExtruder.set(ext, arr);
      }
      arr.push(t);
    }
    const sortedExts = Array.from(byExtruder.keys()).sort((a, b) => a - b);
    for (const ext of sortedExts) {
      groups.push({ extruderId: ext, islandIndex: 0, triList: byExtruder.get(ext)! });
    }
  } else {
    // Separar componentes conectados de mesma cor (via vértices soldados compartilhados)
    const vertCount = welded.vertices.length / 3;
    const vertHead = new Int32Array(vertCount).fill(-1);
    const vertTri: number[] = [];
    const vertNext: number[] = [];
    for (let t = 0; t < triCount; t++) {
      for (let c = 0; c < 3; c++) {
        const v = welded.indices[t * 3 + c];
        vertTri.push(t);
        vertNext.push(vertHead[v]);
        vertHead[v] = vertTri.length - 1;
      }
    }

    const visited = new Uint8Array(triCount);
    const queue = new Int32Array(triCount);
    const islandCounters = new Map<number, number>();

    for (let startT = 0; startT < triCount; startT++) {
      if (visited[startT]) continue;
      const ext = cleanedExtruders[startT];
      let head = 0;
      let tail = 0;
      queue[tail++] = startT;
      visited[startT] = 1;
      const comp: number[] = [];

      while (head < tail) {
        const curr = queue[head++];
        comp.push(curr);
        for (let c = 0; c < 3; c++) {
          const v = welded.indices[curr * 3 + c];
          for (let ptr = vertHead[v]; ptr !== -1; ptr = vertNext[ptr]) {
            const nb = vertTri[ptr];
            if (!visited[nb] && cleanedExtruders[nb] === ext) {
              visited[nb] = 1;
              queue[tail++] = nb;
            }
          }
        }
      }

      if (comp.length < Math.max(4, options.minIslandTriangles)) continue;
      const isl = (islandCounters.get(ext) || 0) + 1;
      islandCounters.set(ext, isl);
      groups.push({ extruderId: ext, islandIndex: isl, triList: comp });

      if ((startT & 4095) === 4095 && performance.now() >= deadline) {
        await yieldToMainThread();
        deadline = performance.now() + 50;
      }
    }

    groups.sort((a, b) => a.extruderId - b.extruderId || b.triList.length - a.triList.length);
  }

  // Mapear meias-arestas globais soldadas `u_v` -> triângulo para correspondência exata plug/pocket entre peças
  const globalHalfEdgeTri = new Map<string, number>();
  for (let g = 0; g < groups.length; g++) {
    const tl = groups[g].triList;
    for (let i = 0; i < tl.length; i++) {
      const t = tl[i];
      const a = welded.indices[t * 3];
      const b = welded.indices[t * 3 + 1];
      const c = welded.indices[t * 3 + 2];
      globalHalfEdgeTri.set(`${a}_${b}`, t);
      globalHalfEdgeTri.set(`${b}_${c}`, t);
      globalHalfEdgeTri.set(`${c}_${a}`, t);
    }
  }

  const outParts: SplitPartMesh[] = [];

  for (let g = 0; g < groups.length; g++) {
    const grp = groups[g];
    const localVertMap = new Map<number, number>();
    const localVerts: number[] = [];
    const localToGlobalArr: number[] = [];
    const localTris: number[] = [];

    for (let i = 0; i < grp.triList.length; i++) {
      const t = grp.triList[i];
      for (let c = 0; c < 3; c++) {
        const globalV = welded.indices[t * 3 + c];
        let lv = localVertMap.get(globalV);
        if (lv === undefined) {
          lv = localVerts.length / 3;
          localVerts.push(
            welded.vertices[globalV * 3],
            welded.vertices[globalV * 3 + 1],
            welded.vertices[globalV * 3 + 2]
          );
          localToGlobalArr.push(globalV);
          localVertMap.set(globalV, lv);
        }
        localTris.push(lv);
      }
    }

    const capped = capOpenMeshBoundaries(
      new Float32Array(localVerts),
      new Uint32Array(localTris),
      options,
      {
        globalVertices: welded.vertices,
        globalIndices: welded.indices,
        globalHalfEdgeTri,
        localToGlobal: new Int32Array(localToGlobalArr),
      }
    );

    const palEntry = soup.palette[grp.extruderId];
    const colorHex =
      palEntry?.hex || defaultColors[(Math.max(1, grp.extruderId) - 1) % defaultColors.length];
    const colorName = palEntry?.name || getColorName(colorHex);
    const filamentType = palEntry?.type || 'PLA';
    const islandSuffix = grp.islandIndex > 0 ? ` (Ilha ${grp.islandIndex})` : '';
    const bounds = computeMeshBounds(capped.vertices);

    outParts.push({
      id: `part-${grp.extruderId}-${g + 1}`,
      name: `Cor ${grp.extruderId} - ${colorName}${islandSuffix}`,
      extruderId: grp.extruderId,
      colorHex,
      colorName,
      filamentType,
      vertices: capped.vertices,
      indices: capped.indices,
      triangleCount: capped.indices.length / 3,
      vertexCount: capped.vertices.length / 3,
      bboxMin: bounds.bboxMin,
      bboxMax: bounds.bboxMax,
      centroid: bounds.centroid,
      isWatertight: capped.isWatertight,
      openEdgesCount: capped.openEdgesCount,
      visible: true,
      connectorsAdded: capped.connectorsAdded,
    });

    if (performance.now() >= deadline) {
      await yieldToMainThread();
      deadline = performance.now() + 50;
    }
  }

  return outParts;
};

/**
 * Corta uma peça `SplitPartMesh` em duas metades estanques ao longo de um plano axial (X, Y ou Z = offsetMm),
 * tampando ambas as faces cortadas com Ear-Clipping 2D e inserindo automaticamente Pinos Macho na metade A
 * e Soquetes Fêmea com tolerância `connectorClearanceMm` na metade B!
 */
export const cutPartByAxisPlane = async (
  part: SplitPartMesh,
  cutOpts: PlaneCutOptions
): Promise<[SplitPartMesh, SplitPartMesh] | null> => {
  const axisIdx = cutOpts.axis === 'X' ? 0 : cutOpts.axis === 'Y' ? 1 : 2;
  const planeVal = cutOpts.offsetMm;

  if (planeVal <= part.bboxMin[axisIdx] + 0.25 || planeVal >= part.bboxMax[axisIdx] - 0.25) {
    return null; // Plano fora da peça
  }

  // Soldar vértices da peça para garantir contornos contínuos no plano de corte
  const dummyExt = new Int32Array(part.indices.length / 3).fill(part.extruderId);
  const welded = await weldColoredSoup(part.vertices, part.indices, dummyExt, 1e-4);
  const v = welded.vertices;
  const ind = welded.indices;
  const vCount = v.length / 3;
  const triCount = ind.length / 3;

  const dist = new Float32Array(vCount);
  const EPS = 1e-5;
  for (let i = 0; i < vCount; i++) {
    const d = v[i * 3 + axisIdx] - planeVal;
    dist[i] = Math.abs(d) < EPS ? 0 : d;
  }

  // Lado Negativo (A: d <= 0) e Lado Positivo (B: d >= 0)
  const vertsA: number[] = [];
  const trisA: number[] = [];
  const mapA = new Map<number, number>();

  const vertsB: number[] = [];
  const trisB: number[] = [];
  const mapB = new Map<number, number>();

  const getVertA = (origIdx: number): number => {
    let m = mapA.get(origIdx);
    if (m === undefined) {
      m = vertsA.length / 3;
      vertsA.push(v[origIdx * 3], v[origIdx * 3 + 1], v[origIdx * 3 + 2]);
      mapA.set(origIdx, m);
    }
    return m;
  };

  const getVertB = (origIdx: number): number => {
    let m = mapB.get(origIdx);
    if (m === undefined) {
      m = vertsB.length / 3;
      vertsB.push(v[origIdx * 3], v[origIdx * 3 + 1], v[origIdx * 3 + 2]);
      mapB.set(origIdx, m);
    }
    return m;
  };

  // Cache de interseção de arestas `(min_max)` -> coordenadas 3D e IDs em A e B
  const edgeCutCache = new Map<string, { pos: [number, number, number]; idA: number; idB: number }>();

  const getEdgeCut = (i0: number, i1: number) => {
    const lo = i0 < i1 ? i0 : i1;
    const hi = i0 < i1 ? i1 : i0;
    const key = `${lo}_${hi}`;
    const cached = edgeCutCache.get(key);
    if (cached) return cached;

    const d0 = dist[lo];
    const d1 = dist[hi];
    const t = Math.abs(d1 - d0) > 1e-9 ? -d0 / (d1 - d0) : 0.5;
    const px = v[lo * 3] + t * (v[hi * 3] - v[lo * 3]);
    const py = v[lo * 3 + 1] + t * (v[hi * 3 + 1] - v[lo * 3 + 1]);
    const pz = v[lo * 3 + 2] + t * (v[hi * 3 + 2] - v[lo * 3 + 2]);
    const pos: [number, number, number] = [px, py, pz];
    pos[axisIdx] = planeVal;

    const idA = vertsA.length / 3;
    vertsA.push(pos[0], pos[1], pos[2]);
    const idB = vertsB.length / 3;
    vertsB.push(pos[0], pos[1], pos[2]);

    const entry = { pos, idA, idB };
    edgeCutCache.set(key, entry);
    return entry;
  };

  // Arestas direcionadas no plano de corte para fechar a tampa de A (normal +axis) e B (normal -axis)
  // Para qualquer triângulo atravessando o plano, coletamos os segmentos do polígono clipado que caem no plano!
  let deadline = performance.now() + 50;

  for (let t = 0; t < triCount; t++) {
    const idx = [ind[t * 3], ind[t * 3 + 1], ind[t * 3 + 2]];
    const d = [dist[idx[0]], dist[idx[1]], dist[idx[2]]];

    if (d[0] <= 0 && d[1] <= 0 && d[2] <= 0) {
      trisA.push(getVertA(idx[0]), getVertA(idx[1]), getVertA(idx[2]));
    } else if (d[0] >= 0 && d[1] >= 0 && d[2] >= 0) {
      trisB.push(getVertB(idx[0]), getVertB(idx[1]), getVertB(idx[2]));
    } else {
      // Clipping Sutherland-Hodgman do triângulo contra d <= 0 (A) e d >= 0 (B)
      const polyA: number[] = [];
      const polyB: number[] = [];

      for (let e = 0; e < 3; e++) {
        const curr = idx[e];
        const next = idx[(e + 1) % 3];
        const dc = d[e];
        const dn = d[(e + 1) % 3];

        if (dc <= 0) polyA.push(getVertA(curr));
        if (dc >= 0) polyB.push(getVertB(curr));

        if ((dc < 0 && dn > 0) || (dc > 0 && dn < 0)) {
          const cut = getEdgeCut(curr, next);
          polyA.push(cut.idA);
          polyB.push(cut.idB);
        }
      }

      for (let k = 1; k < polyA.length - 1; k++) {
        if (polyA[0] !== polyA[k] && polyA[k] !== polyA[k + 1] && polyA[0] !== polyA[k + 1]) {
          trisA.push(polyA[0], polyA[k], polyA[k + 1]);
        }
      }
      for (let k = 1; k < polyB.length - 1; k++) {
        if (polyB[0] !== polyB[k] && polyB[k] !== polyB[k + 1] && polyB[0] !== polyB[k + 1]) {
          trisB.push(polyB[0], polyB[k], polyB[k + 1]);
        }
      }
    }

    if ((t & 8191) === 8191 && performance.now() >= deadline) {
      await yieldToMainThread();
      deadline = performance.now() + 50;
    }
  }

  if (trisA.length === 0 || trisB.length === 0) return null;

  // Fechar as faces abertas no plano de corte em A e B com sincronismo exato de pinos e soquetes!
  const nAxis: [number, number, number] =
    axisIdx === 0 ? [1, 0, 0] : axisIdx === 1 ? [0, 1, 0] : [0, 0, 1];
  const { t1, t2 } = buildOrthonormalBasis(nAxis[0], nAxis[1], nAxis[2]);
  const planeOrigin: [number, number, number] = [0, 0, 0];
  planeOrigin[axisIdx] = planeVal;

  // Extrair laços abertos de A que jazem sobre `planeVal`
  const extractPlaneLoops = (vertsArr: number[], trisArr: number[]) => {
    const heSet = new Set<string>();
    const tc = trisArr.length / 3;
    for (let t = 0; t < tc; t++) {
      const a = trisArr[t * 3], b = trisArr[t * 3 + 1], c = trisArr[t * 3 + 2];
      heSet.add(`${a}_${b}`);
      heSet.add(`${b}_${c}`);
      heSet.add(`${c}_${a}`);
    }

    const nextMap = new Map<number, number[]>();
    const edges: Array<{ from: number; to: number; used: boolean }> = [];
    for (let t = 0; t < tc; t++) {
      const corners = [trisArr[t * 3], trisArr[t * 3 + 1], trisArr[t * 3 + 2]];
      for (let e = 0; e < 3; e++) {
        const u = corners[e];
        const w = corners[(e + 1) % 3];
        if (!heSet.has(`${w}_${u}`)) {
          const onPlane =
            Math.abs(vertsArr[w * 3 + axisIdx] - planeVal) < 1e-2 &&
            Math.abs(vertsArr[u * 3 + axisIdx] - planeVal) < 1e-2;
          if (onPlane) {
            const idxE = edges.length;
            edges.push({ from: w, to: u, used: false });
            let arr = nextMap.get(w);
            if (!arr) {
              arr = [];
              nextMap.set(w, arr);
            }
            arr.push(idxE);
          }
        }
      }
    }

    const loops: number[][] = [];
    for (let i = 0; i < edges.length; i++) {
      if (edges[i].used) continue;
      const loop: number[] = [];
      const start = edges[i].from;
      let curr = i;
      let closed = false;
      while (curr !== -1 && loop.length <= edges.length + 1) {
        edges[curr].used = true;
        loop.push(edges[curr].from);
        const nxtV = edges[curr].to;
        if (nxtV === start && loop.length >= 3) {
          closed = true;
          break;
        }
        const cands = nextMap.get(nxtV);
        curr = -1;
        if (cands) {
          for (const cIdx of cands) {
            if (!edges[cIdx].used) {
              curr = cIdx;
              break;
            }
          }
        }
      }
      if (closed && loop.length >= 3) loops.push(loop);
    }
    return loops;
  };

  const loopsA = extractPlaneLoops(vertsA, trisA);
  const loopsB = extractPlaneLoops(vertsB, trisB);

  const project2D = (vertsArr: number[], id: number): [number, number] => {
    const dx = vertsArr[id * 3] - planeOrigin[0];
    const dy = vertsArr[id * 3 + 1] - planeOrigin[1];
    const dz = vertsArr[id * 3 + 2] - planeOrigin[2];
    return [dx * t1[0] + dy * t1[1] + dz * t1[2], dx * t2[0] + dy * t2[1] + dz * t2[2]];
  };

  // Determinar centros compartilhados de conectores no maior contorno 2D da seção transversal
  let sharedCenters: [number, number][] = [];
  if (cutOpts.connectorShape !== 'none' && loopsA.length > 0 && cutOpts.connectorCount > 0) {
    let largestPts: [number, number][] = [];
    let largestAbsArea = 0;
    for (const lp of loopsA) {
      const pts = lp.map((id) => project2D(vertsA, id));
      const area = Math.abs(signedArea2D(pts));
      if (area > largestAbsArea) {
        largestAbsArea = area;
        largestPts = pts;
      }
    }
    const rSock = cutOpts.connectorDiameterMm * 0.5 + cutOpts.connectorClearanceMm;
    sharedCenters = findConnectorCenters2D(largestPts, rSock + 1.2, cutOpts.connectorCount);
  }

  let pinsAddedA = 0;
  for (const lp of loopsA) {
    const pts = lp.map((id) => project2D(vertsA, id));
    const holes: Array<{ pts: [number, number][]; ids: number[] }> = [];

    for (const [cu, cv] of sharedCenters) {
      const { inside, minDist } = pointInsideAndClearance2D(cu, cv, pts);
      const rPin = cutOpts.connectorDiameterMm * 0.5;
      if (inside && minDist >= rPin + 0.8) {
        const profile = makeConnectorProfile2D(cutOpts.connectorShape, cu, cv, rPin);
        // Metade A (d <= 0): tampa tem normal +nAxis e pino macho projeta-se para +nAxis
        const ringIds = appendConnectorPrism(
          vertsA,
          trisA,
          profile,
          planeOrigin,
          t1,
          t2,
          nAxis,
          nAxis,
          cutOpts.connectorDepthMm,
          0.35
        );
        holes.push({ pts: profile, ids: ringIds });
        pinsAddedA++;
      }
    }

    const cap = triangulatePolygon2DWithHoles(pts, lp, holes);
    for (const idxV of cap) trisA.push(idxV);
  }

  let socketsAddedB = 0;
  const negAxis: [number, number, number] = [-nAxis[0], -nAxis[1], -nAxis[2]];
  for (const lp of loopsB) {
    const pts = lp.map((id) => project2D(vertsB, id));
    const holes: Array<{ pts: [number, number][]; ids: number[] }> = [];

    for (const [cu, cv] of sharedCenters) {
      const { inside, minDist } = pointInsideAndClearance2D(cu, cv, pts);
      const rSock = cutOpts.connectorDiameterMm * 0.5 + cutOpts.connectorClearanceMm;
      if (inside && minDist >= rSock + 0.6) {
        // Na base (t1, t2) com normal +nAxis, a tampa de B tem normal -nAxis!
        // Invertemos a orientação do perfil do buraco para alinhar com -nAxis e extrudamos o soquete para +nAxis (dentro de B)!
        const profile = makeConnectorProfile2D(cutOpts.connectorShape, cu, cv, rSock).reverse();
        const ringIds = appendConnectorPrism(
          vertsB,
          trisB,
          profile,
          planeOrigin,
          t1,
          t2,
          negAxis,
          nAxis,
          cutOpts.connectorDepthMm + 0.35,
          0
        );
        holes.push({ pts: profile, ids: ringIds });
        socketsAddedB++;
      }
    }

    const cap = triangulatePolygon2DWithHoles(pts, lp, holes);
    for (const idxV of cap) trisB.push(idxV);
  }

  // Fechar quaisquer outras aberturas residuais
  const finishHalf = (
    vArr: number[],
    tArr: number[],
    suffix: string,
    connCount: number
  ): SplitPartMesh => {
    const capped = capOpenMeshBoundaries(
      new Float32Array(vArr),
      new Uint32Array(tArr),
      { ...DEFAULT_SPLIT_ENGINE_OPTIONS, capMode: 'watertight', connectorShape: 'none' }
    );
    const bounds = computeMeshBounds(capped.vertices);
    return {
      ...part,
      id: `${part.id}-${suffix}-${Date.now().toString(36).slice(-4)}`,
      name: `${part.name} (${suffix})`,
      vertices: capped.vertices,
      indices: capped.indices,
      triangleCount: capped.indices.length / 3,
      vertexCount: capped.vertices.length / 3,
      bboxMin: bounds.bboxMin,
      bboxMax: bounds.bboxMax,
      centroid: bounds.centroid,
      isWatertight: capped.isWatertight,
      openEdgesCount: capped.openEdgesCount,
      connectorsAdded: part.connectorsAdded + connCount,
    };
  };

  const labelA = cutOpts.axis === 'Z' ? 'Base Inferior' : `Lado ${cutOpts.axis}-`;
  const labelB = cutOpts.axis === 'Z' ? 'Topo Superior' : `Lado ${cutOpts.axis}+`;

  return [
    finishHalf(vertsA, trisA, labelA, pinsAddedA),
    finishHalf(vertsB, trisB, labelB, socketsAddedB),
  ];
};

/**
 * Parser de arquivos STL (Binário ou ASCII) para `RawColoredSoup`
 */
export const parseStlFileToSoup = async (
  file: File,
  defaultHex = '#00AE42'
): Promise<RawColoredSoup> => {
  const buf = await file.arrayBuffer();
  const view = new DataView(buf);

  let isBinary = false;
  if (buf.byteLength >= 84) {
    const triCountHeader = view.getUint32(80, true);
    const expectedBytes = 84 + triCountHeader * 50;
    if (expectedBytes === buf.byteLength) {
      isBinary = true;
    }
  }

  const verts: number[] = [];
  const tris: number[] = [];
  let deadline = performance.now() + 50;

  if (isBinary) {
    const triCount = view.getUint32(80, true);
    let offset = 84;
    for (let i = 0; i < triCount; i++) {
      const base = verts.length / 3;
      for (let c = 0; c < 3; c++) {
        const vx = view.getFloat32(offset + 12 + c * 12, true);
        const vy = view.getFloat32(offset + 16 + c * 12, true);
        const vz = view.getFloat32(offset + 20 + c * 12, true);
        verts.push(vx, vy, vz);
      }
      tris.push(base, base + 1, base + 2);
      offset += 50;

      if ((i & 8191) === 8191 && performance.now() >= deadline) {
        await yieldToMainThread();
        deadline = performance.now() + 50;
      }
    }
  } else {
    const text = new TextDecoder().decode(buf);
    const vertexRegex = /vertex\s+([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)\s+([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)\s+([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)/g;
    let match: RegExpExecArray | null;
    while ((match = vertexRegex.exec(text)) !== null) {
      verts.push(parseFloat(match[1]), parseFloat(match[2]), parseFloat(match[3]));
      if (verts.length % 9 === 0) {
        const b = verts.length / 3 - 3;
        tris.push(b, b + 1, b + 2);
      }
    }
  }

  if (tris.length === 0) {
    throw new Error('Arquivo STL vazio ou corrompido.');
  }

  const vArr = new Float32Array(verts);
  const bounds = computeMeshBounds(vArr);
  const shift: [number, number, number] = [bounds.centroid[0], bounds.centroid[1], bounds.bboxMin[2]];
  for (let i = 0; i < vArr.length / 3; i++) {
    vArr[i * 3] -= shift[0];
    vArr[i * 3 + 1] -= shift[1];
    vArr[i * 3 + 2] -= shift[2];
  }

  return {
    vertices: vArr,
    indices: new Uint32Array(tris),
    faceExtruders: new Int32Array(tris.length / 3).fill(1),
    palette: { 1: { hex: defaultHex, type: 'PLA' } },
    assemblyOriginShift: shift,
    hadPaintedTriangles: false,
  };
};

/**
 * Parser de arquivos Wavefront OBJ (com suporte a grupos de materiais `usemtl` e cores `v x y z r g b`)
 */
export const parseObjFileToSoup = async (
  file: File,
  defaultColors: ReadonlyArray<string>
): Promise<RawColoredSoup> => {
  const text = await file.text();
  const lines = text.split(/\r?\n/);

  const verts: number[] = [];
  const tris: number[] = [];
  const faceExtruders: number[] = [];
  const mtlMap = new Map<string, number>();
  const palette: Record<number, { hex: string; type?: string; name?: string }> = {};

  let currentExt = 1;
  palette[1] = { hex: defaultColors[0], type: 'PLA', name: 'Material 1' };

  let deadline = performance.now() + 50;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#')) continue;

    if (line.startsWith('v ')) {
      const parts = line.split(/\s+/);
      if (parts.length >= 4) {
        verts.push(parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3]));
      }
    } else if (line.startsWith('usemtl ')) {
      const mtlName = line.slice(7).trim() || 'default';
      let ext = mtlMap.get(mtlName);
      if (ext === undefined) {
        ext = mtlMap.size + 1;
        mtlMap.set(mtlName, ext);
        palette[ext] = {
          hex: defaultColors[(ext - 1) % defaultColors.length],
          type: 'PLA',
          name: mtlName,
        };
      }
      currentExt = ext;
    } else if (line.startsWith('f ')) {
      const tokens = line.slice(2).trim().split(/\s+/);
      const faceIds: number[] = [];
      const totalV = verts.length / 3;
      for (const tok of tokens) {
        const rawIdx = parseInt(tok.split('/')[0], 10);
        if (!Number.isFinite(rawIdx) || rawIdx === 0) continue;
        const resolved = rawIdx > 0 ? rawIdx - 1 : totalV + rawIdx;
        if (resolved >= 0 && resolved < totalV) {
          faceIds.push(resolved);
        }
      }
      for (let k = 1; k < faceIds.length - 1; k++) {
        tris.push(faceIds[0], faceIds[k], faceIds[k + 1]);
        faceExtruders.push(currentExt);
      }
    }

    if ((i & 8191) === 8191 && performance.now() >= deadline) {
      await yieldToMainThread();
      deadline = performance.now() + 50;
    }
  }

  if (tris.length === 0) {
    throw new Error('Arquivo OBJ não contém faces triangulares ou poligonais válidas.');
  }

  const vArr = new Float32Array(verts);
  const bounds = computeMeshBounds(vArr);
  const shift: [number, number, number] = [bounds.centroid[0], bounds.centroid[1], bounds.bboxMin[2]];
  for (let i = 0; i < vArr.length / 3; i++) {
    vArr[i * 3] -= shift[0];
    vArr[i * 3 + 1] -= shift[1];
    vArr[i * 3 + 2] -= shift[2];
  }

  return {
    vertices: vArr,
    indices: new Uint32Array(tris),
    faceExtruders: new Int32Array(faceExtruders),
    palette,
    assemblyOriginShift: shift,
    hadPaintedTriangles: mtlMap.size > 1,
  };
};

/**
 * Exporta uma única peça `SplitPartMesh` para `.3mf` independente (mantendo posição de montagem ou centralizando na mesa)
 */
export const exportSplitPartTo3MF = async (
  part: SplitPartMesh,
  keepAssemblyPosition = true
): Promise<Blob> => {
  const zip = new JSZip();

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
  <Default Extension="config" ContentType="text/xml"/>
</Types>`
  );

  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`
  );

  const v = part.vertices;
  const ind = part.indices;
  const vCount = v.length / 3;
  const tCount = ind.length / 3;

  const shiftX = keepAssemblyPosition ? 0 : part.centroid[0];
  const shiftY = keepAssemblyPosition ? 0 : part.centroid[1];
  const shiftZ = keepAssemblyPosition ? 0 : part.bboxMin[2];

  let deadline = performance.now() + 50;
  const vLines = new Array<string>(vCount);
  for (let i = 0; i < vCount; i++) {
    const x = (v[i * 3] - shiftX).toFixed(4);
    const y = (v[i * 3 + 1] - shiftY).toFixed(4);
    const z = (v[i * 3 + 2] - shiftZ).toFixed(4);
    vLines[i] = `          <vertex x="${x}" y="${y}" z="${z}"/>`;
    if ((i & 4095) === 4095 && performance.now() >= deadline) {
      await yieldToMainThread();
      deadline = performance.now() + 50;
    }
  }

  const tLines = new Array<string>(tCount);
  for (let i = 0; i < tCount; i++) {
    tLines[i] = `          <triangle v1="${ind[i * 3]}" v2="${ind[i * 3 + 1]}" v3="${ind[i * 3 + 2]}"/>`;
    if ((i & 4095) === 4095 && performance.now() >= deadline) {
      await yieldToMainThread();
      deadline = performance.now() + 50;
    }
  }

  const safeName = part.name.replace(/[<>&"']/g, '_');
  const modelXml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<model unit="millimeter" xml:lang="pt-BR" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">',
    `  <metadata name="Title">${safeName}</metadata>`,
    '  <metadata name="Application">BambuStudio-01.09.00.00</metadata>',
    '  <resources>',
    '    <basematerials id="99">',
    `      <base name="${safeName}" displaycolor="${part.colorHex}"/>`,
    '    </basematerials>',
    `    <object id="1" name="${safeName}" type="model" pid="99" pindex="0">`,
    '      <mesh>',
    '        <vertices>',
    vLines.join('\n'),
    '        </vertices>',
    '        <triangles>',
    tLines.join('\n'),
    '        </triangles>',
    '      </mesh>',
    '    </object>',
    '  </resources>',
    '  <build>',
    '    <item objectid="1" transform="1 0 0 0 1 0 0 0 1 128 128 0" printable="1"/>',
    '  </build>',
    '</model>',
  ].join('\n');

  zip.file('3D/3dmodel.model', modelXml);
  zip.file(
    'Metadata/project_settings.config',
    JSON.stringify(
      {
        filament_colour: [part.colorHex],
        filament_type: [part.filamentType || 'PLA'],
      },
      null,
      2
    )
  );

  return await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
};

/**
 * Exporta uma peça `SplitPartMesh` para STL Binário
 */
export const exportSplitPartToSTL = (
  part: SplitPartMesh,
  keepAssemblyPosition = true
): Blob => {
  const triCount = part.indices.length / 3;
  const buffer = new ArrayBuffer(84 + triCount * 50);
  const view = new DataView(buffer);

  const header = 'AZ3D Split3MF Binary STL';
  for (let i = 0; i < header.length; i++) {
    view.setUint8(i, header.charCodeAt(i));
  }
  view.setUint32(80, triCount, true);

  const shiftX = keepAssemblyPosition ? 0 : part.centroid[0];
  const shiftY = keepAssemblyPosition ? 0 : part.centroid[1];
  const shiftZ = keepAssemblyPosition ? 0 : part.bboxMin[2];

  const v = part.vertices;
  const ind = part.indices;
  let offset = 84;

  for (let i = 0; i < triCount; i++) {
    const i0 = ind[i * 3] * 3;
    const i1 = ind[i * 3 + 1] * 3;
    const i2 = ind[i * 3 + 2] * 3;

    const ax = v[i0] - shiftX, ay = v[i0 + 1] - shiftY, az = v[i0 + 2] - shiftZ;
    const bx = v[i1] - shiftX, by = v[i1 + 1] - shiftY, bz = v[i1 + 2] - shiftZ;
    const cx = v[i2] - shiftX, cy = v[i2 + 1] - shiftY, cz = v[i2 + 2] - shiftZ;

    const abx = bx - ax, aby = by - ay, abz = bz - az;
    const acx = cx - ax, acy = cy - ay, acz = cz - az;
    let nx = aby * acz - abz * acy;
    let ny = abz * acx - abx * acz;
    let nz = abx * acy - aby * acx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;

    view.setFloat32(offset, nx, true);
    view.setFloat32(offset + 4, ny, true);
    view.setFloat32(offset + 8, nz, true);

    view.setFloat32(offset + 12, ax, true);
    view.setFloat32(offset + 16, ay, true);
    view.setFloat32(offset + 20, az, true);

    view.setFloat32(offset + 24, bx, true);
    view.setFloat32(offset + 28, by, true);
    view.setFloat32(offset + 32, bz, true);

    view.setFloat32(offset + 36, cx, true);
    view.setFloat32(offset + 40, cy, true);
    view.setFloat32(offset + 44, cz, true);

    view.setUint16(offset + 48, 0, true);
    offset += 50;
  }

  return new Blob([buffer], { type: 'model/stl' });
};

/**
 * Exporta TODAS as peças divididas em um único arquivo `.3MF` Multi-Peças unificado para Bambu Studio / OrcaSlicer,
 * preservando o alinhamento exato da montagem e atribuindo cada peça ao seu slot de filamento AMS correspondente!
 */
export const exportUnifiedAssembly3MF = async (
  parts: ReadonlyArray<SplitPartMesh>,
  assemblyName = 'Montagem_Split3MF'
): Promise<Blob> => {
  const activeParts = parts.filter((p) => p.visible && p.triangleCount > 0);
  if (activeParts.length === 0) {
    throw new Error('Nenhuma peça visível para exportar.');
  }

  const zip = new JSZip();

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
  <Default Extension="config" ContentType="text/xml"/>
</Types>`
  );

  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`
  );

  // Construir paleta compacta de slots AMS (1..N)
  const paletteColors: string[] = [];
  const paletteTypes: string[] = [];
  const colorToSlot = new Map<string, number>();

  for (const p of activeParts) {
    const key = p.colorHex.toUpperCase();
    if (!colorToSlot.has(key)) {
      paletteColors.push(p.colorHex);
      paletteTypes.push(p.filamentType || 'PLA');
      colorToSlot.set(key, paletteColors.length);
    }
  }

  let deadline = performance.now() + 50;
  const objectBlocks: string[] = [];
  const componentRefs: string[] = [];
  const partMetadataBlocks: string[] = [];

  for (let idx = 0; idx < activeParts.length; idx++) {
    const p = activeParts[idx];
    const objId = idx + 1;
    const slot = colorToSlot.get(p.colorHex.toUpperCase()) || 1;
    const safePartName = p.name.replace(/[<>&"']/g, '_');

    const vCount = p.vertices.length / 3;
    const tCount = p.indices.length / 3;
    const vLines = new Array<string>(vCount);
    for (let i = 0; i < vCount; i++) {
      vLines[i] = `          <vertex x="${p.vertices[i * 3].toFixed(4)}" y="${p.vertices[i * 3 + 1].toFixed(4)}" z="${p.vertices[i * 3 + 2].toFixed(4)}"/>`;
      if ((i & 4095) === 4095 && performance.now() >= deadline) {
        await yieldToMainThread();
        deadline = performance.now() + 50;
      }
    }

    const tLines = new Array<string>(tCount);
    for (let i = 0; i < tCount; i++) {
      tLines[i] = `          <triangle v1="${p.indices[i * 3]}" v2="${p.indices[i * 3 + 1]}" v3="${p.indices[i * 3 + 2]}"/>`;
      if ((i & 4095) === 4095 && performance.now() >= deadline) {
        await yieldToMainThread();
        deadline = performance.now() + 50;
      }
    }

    objectBlocks.push(
      [
        `    <object id="${objId}" name="${safePartName}" type="model" pid="999" pindex="${slot - 1}">`,
        '      <mesh>',
        '        <vertices>',
        vLines.join('\n'),
        '        </vertices>',
        '        <triangles>',
        tLines.join('\n'),
        '        </triangles>',
        '      </mesh>',
        '    </object>',
      ].join('\n')
    );

    componentRefs.push(`        <component objectid="${objId}"/>`);
    partMetadataBlocks.push(
      [
        `    <part id="${objId}" subtype="normal_part">`,
        `      <metadata key="name" value="${safePartName}"/>`,
        `      <metadata key="extruder" value="${slot}"/>`,
        '    </part>',
      ].join('\n')
    );
  }

  const assemblyObjId = activeParts.length + 1;
  const safeAssembly = assemblyName.replace(/[<>&"']/g, '_');
  const baseMaterialsLines = paletteColors.map(
    (hex, i) => `      <base name="Filamento ${i + 1}" displaycolor="${hex}"/>`
  );

  const modelXml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<model unit="millimeter" xml:lang="pt-BR" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">',
    `  <metadata name="Title">${safeAssembly}</metadata>`,
    '  <metadata name="Application">BambuStudio-01.09.00.00</metadata>',
    '  <resources>',
    '    <basematerials id="999">',
    baseMaterialsLines.join('\n'),
    '    </basematerials>',
    objectBlocks.join('\n'),
    `    <object id="${assemblyObjId}" name="${safeAssembly}" type="model">`,
    '      <components>',
    componentRefs.join('\n'),
    '      </components>',
    '    </object>',
    '  </resources>',
    '  <build>',
    `    <item objectid="${assemblyObjId}" transform="1 0 0 0 1 0 0 0 1 128 128 0" printable="1"/>`,
    '  </build>',
    '</model>',
  ].join('\n');

  const modelSettingsXml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<config>',
    `  <object id="${assemblyObjId}">`,
    `    <metadata key="name" value="${safeAssembly}"/>`,
    '    <metadata key="extruder" value="1"/>',
    partMetadataBlocks.join('\n'),
    '  </object>',
    '  <plate>',
    '    <metadata key="plater_id" value="1"/>',
    `    <metadata key="plater_name" value="${safeAssembly}"/>`,
    '    <model_instance>',
    `      <metadata key="object_id" value="${assemblyObjId}"/>`,
    '      <metadata key="instance_id" value="0"/>',
    '    </model_instance>',
    '  </plate>',
    '</config>',
  ].join('\n');

  zip.file('3D/3dmodel.model', modelXml);
  zip.file('Metadata/model_settings.config', modelSettingsXml);
  zip.file(
    'Metadata/project_settings.config',
    JSON.stringify(
      {
        filament_colour: paletteColors,
        filament_type: paletteTypes,
      },
      null,
      2
    )
  );

  return await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
};

/**
 * Helper interno para percorrer recursivamente os arquivos `.model` de um `.3mf`
 * (incluindo sub-modelos `3D/Objects/*.model` via `p:path`) e extrair a sopa global de triângulos coloridos!
 */
export const extractColoredSoupFrom3MfZip = async (
  loadedZip: JSZip,
  mainModelPath: string,
  filamentPalette: Record<number, { hex: string; type?: string; name?: string }>,
  objectExtruderMap: Record<string, number>,
  partExtruderMap: Record<string, number>,
  defaultColors: ReadonlyArray<string>
): Promise<RawColoredSoup> => {
  const parser = new DOMParser();

  // Indexar todos os arquivos .model do ZIP normalizados em minúsculas sem barra inicial
  const zipPathLookup = new Map<string, string>();
  for (const p of Object.keys(loadedZip.files)) {
    if (!loadedZip.files[p].dir) {
      zipPathLookup.set(p.replace(/^\/+/, '').toLowerCase(), p);
    }
  }

  const docCache = new Map<string, Document>();
  const loadModelDoc = async (normPath: string): Promise<Document | null> => {
    const clean = normPath.replace(/^\/+/, '').toLowerCase();
    const cached = docCache.get(clean);
    if (cached) return cached;
    const realPath = zipPathLookup.get(clean);
    if (!realPath) return null;
    const txt = await loadedZip.files[realPath].async('string');
    const doc = parser.parseFromString(txt, 'application/xml');
    docCache.set(clean, doc);
    return doc;
  };

  const mainNorm = mainModelPath.replace(/^\/+/, '').toLowerCase();
  const mainDoc = await loadModelDoc(mainNorm);
  if (!mainDoc) {
    throw new Error('Não foi possível abrir o XML principal do .3MF.');
  }

  // Extrair <basematerials> do modelo principal se a paleta ainda não tiver cores
  const baseMaterialExtruders = new Map<string, number>();
  const bmNodes = mainDoc.getElementsByTagName('basematerials');
  for (let b = 0; b < bmNodes.length; b++) {
    const bmId = bmNodes[b].getAttribute('id') || '0';
    const bases = bmNodes[b].getElementsByTagName('base');
    for (let idx = 0; idx < bases.length; idx++) {
      const col = bases[idx].getAttribute('displaycolor');
      const bName = bases[idx].getAttribute('name') || undefined;
      const slot = idx + 1;
      baseMaterialExtruders.set(`${bmId}_${idx}`, slot);
      if (col && !filamentPalette[slot]) {
        const cleanHex = col.startsWith('#') ? col.slice(0, 7) : `#${col.slice(0, 6)}`;
        filamentPalette[slot] = { hex: cleanHex, type: 'PLA', name: bName };
      }
    }
  }

  const globalVerts: number[] = [];
  const globalTris: number[] = [];
  const globalExtruders: number[] = [];
  let hadPaintedTriangles = false;
  let deadline = performance.now() + 50;

  const findObjectNode = (doc: Document, objId: string): Element | null => {
    const objs = doc.getElementsByTagName('object');
    for (let i = 0; i < objs.length; i++) {
      if (objs[i].getAttribute('id') === objId) return objs[i];
    }
    return null;
  };

  const getAttrPath = (el: Element): string | null =>
    el.getAttribute('p:path') ||
    el.getAttribute('path') ||
    el.getAttributeNS('http://schemas.microsoft.com/3dmanufacturing/production/2015/06', 'path');

  const traverseObject = async (
    modelNormPath: string,
    objId: string,
    worldMat: Mat3x4,
    inheritedExtruder: number,
    rootParentId: string,
    depth: number
  ): Promise<void> => {
    if (depth > 16) return;
    const doc = await loadModelDoc(modelNormPath);
    if (!doc) return;

    const objNode = findObjectNode(doc, objId);
    if (!objNode) return;

    // Resolver extrusora específica desta peça / parte
    let localExtruder =
      partExtruderMap[`${rootParentId}_${objId}`] ||
      objectExtruderMap[objId] ||
      inheritedExtruder;

    const pid = objNode.getAttribute('pid');
    const pindex = objNode.getAttribute('pindex');
    if (pid && pindex !== null) {
      const bmSlot = baseMaterialExtruders.get(`${pid}_${pindex}`);
      if (bmSlot && !partExtruderMap[`${rootParentId}_${objId}`] && !objectExtruderMap[objId]) {
        localExtruder = bmSlot;
      }
    }

    // 1. Processar <mesh> direto se houver
    const meshNodes = objNode.children;
    for (let c = 0; c < meshNodes.length; c++) {
      const child = meshNodes[c];
      const tag = child.localName || child.tagName;

      if (tag === 'mesh') {
        const vNodes = child.getElementsByTagName('vertex');
        const tNodes = child.getElementsByTagName('triangle');
        if (vNodes.length > 0 && tNodes.length > 0) {
          const baseOffset = globalVerts.length / 3;
          const flipWinding = determinant3Mf(worldMat) < 0;

          for (let i = 0; i < vNodes.length; i++) {
            const lx = parseFloat(vNodes[i].getAttribute('x') || '0');
            const ly = parseFloat(vNodes[i].getAttribute('y') || '0');
            const lz = parseFloat(vNodes[i].getAttribute('z') || '0');
            const [wx, wy, wz] = apply3MfTransform(lx, ly, lz, worldMat);
            globalVerts.push(wx, wy, wz);

            if ((i & 4095) === 4095 && performance.now() >= deadline) {
              await yieldToMainThread();
              deadline = performance.now() + 50;
            }
          }

          const midpointCache = new Map<string, number>();

          for (let i = 0; i < tNodes.length; i++) {
            const tn = tNodes[i];
            const rawV1 = baseOffset + parseInt(tn.getAttribute('v1') || '0', 10);
            const rawV2 = baseOffset + parseInt(tn.getAttribute('v2') || '0', 10);
            const rawV3 = baseOffset + parseInt(tn.getAttribute('v3') || '0', 10);

            const v1 = rawV1;
            const v2 = flipWinding ? rawV3 : rawV2;
            const v3 = flipWinding ? rawV2 : rawV3;

            let triDefaultExt = localExtruder;
            const triPid = tn.getAttribute('pid') || pid;
            const triP1 = tn.getAttribute('p1');
            if (triPid && triP1 !== null) {
              const bmSlot = baseMaterialExtruders.get(`${triPid}_${triP1}`);
              if (bmSlot) triDefaultExt = bmSlot;
            }

            const paintAttr =
              tn.getAttribute('paint_color') ||
              tn.getAttribute('slic3rpe:mmu_segmentation');

            if (paintAttr && paintAttr.length > 0) {
              hadPaintedTriangles = true;
              const beforeLen = globalTris.length;
              decodePaintedTriangleIntoSoup(
                rawV1,
                rawV2,
                rawV3,
                paintAttr,
                triDefaultExt,
                globalVerts,
                midpointCache,
                globalTris,
                globalExtruders
              );
              if (flipWinding) {
                for (let k = beforeLen; k < globalTris.length; k += 3) {
                  const tmp = globalTris[k + 1];
                  globalTris[k + 1] = globalTris[k + 2];
                  globalTris[k + 2] = tmp;
                }
              }
            } else {
              globalTris.push(v1, v2, v3);
              globalExtruders.push(triDefaultExt);
            }

            if ((i & 4095) === 4095 && performance.now() >= deadline) {
              await yieldToMainThread();
              deadline = performance.now() + 50;
            }
          }
        }
      } else if (tag === 'components') {
        const compNodes = child.getElementsByTagName('component');
        for (let k = 0; k < compNodes.length; k++) {
          const comp = compNodes[k];
          const subObjId = comp.getAttribute('objectid');
          if (!subObjId) continue;
          const subPath = getAttrPath(comp);
          const nextModelPath = subPath ? subPath.replace(/^\/+/, '').toLowerCase() : modelNormPath;
          const compMat = parse3MfTransform(comp.getAttribute('transform'));
          const combinedMat = multiply3MfTransform(compMat, worldMat);
          await traverseObject(
            nextModelPath,
            subObjId,
            combinedMat,
            localExtruder,
            rootParentId,
            depth + 1
          );
        }
      }
    }
  };

  // Percorrer itens de <build> (ou todos objetos raiz caso <build> esteja vazio)
  const buildNodes = mainDoc.getElementsByTagName('build');
  let visitedAny = false;
  if (buildNodes.length > 0) {
    const items = buildNodes[0].getElementsByTagName('item');
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const objId = item.getAttribute('objectid');
      if (!objId) continue;
      const printable = item.getAttribute('printable');
      if (printable === '0') continue;
      const itemPath = getAttrPath(item);
      const targetModel = itemPath ? itemPath.replace(/^\/+/, '').toLowerCase() : mainNorm;
      const itemMat = parse3MfTransform(item.getAttribute('transform'));
      const rootExt = objectExtruderMap[objId] || 1;
      await traverseObject(targetModel, objId, itemMat, rootExt, objId, 0);
      visitedAny = true;
    }
  }

  if (!visitedAny || globalTris.length === 0) {
    const objs = mainDoc.getElementsByTagName('object');
    for (let i = 0; i < objs.length; i++) {
      const objId = objs[i].getAttribute('id');
      if (objId) {
        await traverseObject(mainNorm, objId, IDENTITY_MAT, objectExtruderMap[objId] || 1, objId, 0);
      }
    }
  }

  if (globalTris.length === 0) {
    throw new Error('Nenhuma malha 3D encontrada dentro do arquivo .3MF.');
  }

  // Garantir que todas as extrusoras usadas existam na paleta
  for (let i = 0; i < globalExtruders.length; i++) {
    const ext = globalExtruders[i];
    if (!filamentPalette[ext]) {
      filamentPalette[ext] = {
        hex: defaultColors[(Math.max(1, ext) - 1) % defaultColors.length],
        type: 'PLA',
      };
    }
  }

  const vArr = new Float32Array(globalVerts);
  const bounds = computeMeshBounds(vArr);
  const shift: [number, number, number] = [bounds.centroid[0], bounds.centroid[1], bounds.bboxMin[2]];
  for (let i = 0; i < vArr.length / 3; i++) {
    vArr[i * 3] -= shift[0];
    vArr[i * 3 + 1] -= shift[1];
    vArr[i * 3 + 2] -= shift[2];
  }

  return {
    vertices: vArr,
    indices: new Uint32Array(globalTris),
    faceExtruders: new Int32Array(globalExtruders),
    palette: filamentPalette,
    assemblyOriginShift: shift,
    hadPaintedTriangles,
  };
};
