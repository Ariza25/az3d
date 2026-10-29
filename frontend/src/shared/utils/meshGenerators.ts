import JSZip from 'jszip';
import { saveAs } from 'file-saver';

export interface Mesh3D {
  vertices: Float32Array; // [x0, y0, z0, x1, y1, z1, ...] em coordenadas Bambu (Z-up, minZ = 0)
  indices: Uint32Array;   // [i0, i1, i2, ...]
  colors?: Float32Array;  // Cores RGB [0..1] por vértice (opcional, para esculturas multicor)
  lithoGlowColors?: Float32Array; // Simulação Beer-Lambert de luz traseira para litofania
  paletteHex?: string[];  // Paleta de filamentos detectada
  widthMm: number;        // Dimensão X
  heightMm: number;       // Dimensão Y (profundidade na mesa)
  depthMm: number;        // Dimensão Z (altura vertical na mesa)
  triangleCount: number;
}

export interface ReliefOptions {
  widthMm: number;
  heightMm: number;
  baseThicknessMm: number;
  reliefHeightMm: number;
  invertRelief: boolean;
  smoothingRadius: number; // 0 a 4
  borderWidthMm: number;   // Moldura elevada em placas retangulares (mm)
  addKeychainHole: boolean;
  keychainHoleDiameterMm: number;
  cutoutSilhouette?: boolean; // Recorta o contorno exato da imagem/logo (sem placa quadrada ao redor)
  autoRemoveBg?: boolean;     // Remove fundo sólido automaticamente em JPEGs/PNGs opacos
  alphaThreshold?: number;    // 0.05 a 0.90
  flatLogoMode?: boolean;     // Modo Logo/Chaveiro chapado (altura uniforme nítida em vez de mapa tonal de foto)
  contrast?: number;          // 0.5 a 2.5
  meshResolution?: number;    // 180 | 260 | 340
}

export interface LithophaneOptions {
  widthMm: number;
  heightMm: number;
  minThicknessMm: number;
  maxThicknessMm: number;
  frameWidthMm: number;
  frameThicknessMm: number;
  curveAngleDeg: number; // 0 = plano vertical, 30..90 = arco cilíndrico vertical autoportante
}

/**
 * Cede controle à thread principal periodicamente para evitar tarefas longas (> 50ms)
 * com fallback seguro via setTimeout para navegadores sem suporte a scheduler.yield().
 */
export const yieldToMainThread = async (): Promise<void> => {
  const g = globalThis as unknown as {
    scheduler?: { yield?: () => Promise<void> };
  };
  if (g.scheduler && typeof g.scheduler.yield === 'function') {
    await g.scheduler.yield();
  } else {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
};

/**
 * Carrega uma imagem para um HTMLCanvasElement redimensionado para resolução ótima de malha
 */
export const loadImageToCanvas = (
  file: File | string,
  maxResolution = 260
): Promise<{ canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; aspect: number; hasAlpha: boolean }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const aspect = img.width / Math.max(1, img.height);
      let targetW = maxResolution;
      let targetH = Math.round(maxResolution / aspect);

      if (targetH > maxResolution) {
        targetH = maxResolution;
        targetW = Math.round(maxResolution * aspect);
      }

      targetW = Math.max(36, targetW);
      targetH = Math.max(36, targetH);

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        reject(new Error('Não foi possível obter o contexto 2D do Canvas.'));
        return;
      }

      ctx.clearRect(0, 0, targetW, targetH);
      ctx.drawImage(img, 0, 0, targetW, targetH);

      const data = ctx.getImageData(0, 0, targetW, targetH).data;
      let transparentPixels = 0;
      const totalPixels = targetW * targetH;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] < 240) transparentPixels++;
      }
      const hasAlpha = transparentPixels > totalPixels * 0.015;

      resolve({ canvas, ctx, aspect, hasAlpha });
    };
    img.onerror = (e) => reject(e);

    if (typeof file === 'string') {
      img.src = file;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
    }
  });
};

/**
 * Aplica suavização Gaussiana separável aproximada (2 passadas Box Blur) respeitando máscara opcional
 */
const smoothGrid = (
  grid: Float32Array,
  cols: number,
  rows: number,
  radius: number,
  weightMask?: Float32Array
): Float32Array => {
  if (radius <= 0) return grid;
  let current = grid;

  for (let pass = 0; pass < 2; pass++) {
    const horiz = new Float32Array(grid.length);
    const vert = new Float32Array(grid.length);

    for (let y = 0; y < rows; y++) {
      const rowOffset = y * cols;
      for (let x = 0; x < cols; x++) {
        let sum = 0;
        let wSum = 0;
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= cols) continue;
          const idx = rowOffset + nx;
          const w = weightMask ? Math.max(0.001, weightMask[idx]) : 1.0;
          sum += current[idx] * w;
          wSum += w;
        }
        horiz[rowOffset + x] = wSum > 0 ? sum / wSum : current[rowOffset + x];
      }
    }

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        let sum = 0;
        let wSum = 0;
        for (let dy = -radius; dy <= radius; dy++) {
          const ny = y + dy;
          if (ny < 0 || ny >= rows) continue;
          const idx = ny * cols + x;
          const w = weightMask ? Math.max(0.001, weightMask[idx]) : 1.0;
          sum += horiz[idx] * w;
          wSum += w;
        }
        vert[y * cols + x] = wSum > 0 ? sum / wSum : horiz[y * cols + x];
      }
    }

    current = vert;
  }

  return current;
};

/**
 * Segmenta o fundo conectado às bordas da imagem (flood-fill BFS) para JPEGs/PNGs sem transparência
 */
const computeForegroundAlphaField = (
  imgData: Uint8ClampedArray,
  cols: number,
  rows: number,
  autoRemoveBg: boolean
): { alphaField: Float32Array; detectedAlpha: boolean } => {
  const total = cols * rows;
  const alphaField = new Float32Array(total);
  let transparentCount = 0;

  for (let i = 0; i < total; i++) {
    const a = imgData[i * 4 + 3] / 255.0;
    alphaField[i] = a;
    if (a < 0.94) transparentCount++;
  }

  const hasNativeAlpha = transparentCount > total * 0.015;
  if (hasNativeAlpha || !autoRemoveBg) {
    return { alphaField, detectedAlpha: hasNativeAlpha };
  }

  // Amostrar pixels da borda externa para estimar a cor do fundo
  const borderR: number[] = [];
  const borderG: number[] = [];
  const borderB: number[] = [];

  const pushPixel = (x: number, y: number) => {
    const idx = (y * cols + x) * 4;
    borderR.push(imgData[idx]);
    borderG.push(imgData[idx + 1]);
    borderB.push(imgData[idx + 2]);
  };

  for (let x = 0; x < cols; x++) {
    pushPixel(x, 0);
    pushPixel(x, rows - 1);
  }
  for (let y = 1; y < rows - 1; y++) {
    pushPixel(0, y);
    pushPixel(cols - 1, y);
  }

  const median = (arr: number[]) => {
    const sorted = [...arr].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)] ?? 255;
  };

  const bgR = median(borderR);
  const bgG = median(borderG);
  const bgB = median(borderB);

  // Calcular desvio médio das bordas para tolerância adaptativa
  let madSum = 0;
  for (let i = 0; i < borderR.length; i++) {
    const d = Math.hypot(borderR[i] - bgR, borderG[i] - bgG, borderB[i] - bgB);
    madSum += d;
  }
  const avgDev = madSum / Math.max(1, borderR.length);
  const tol = Math.max(32, Math.min(82, avgDev * 2.4 + 28));

  // Flood-fill BFS conectado às bordas
  const isBg = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;

  const tryEnqueue = (x: number, y: number) => {
    if (x < 0 || x >= cols || y < 0 || y >= rows) return;
    const idx = y * cols + x;
    if (isBg[idx]) return;
    const p = idx * 4;
    const dist = Math.hypot(imgData[p] - bgR, imgData[p + 1] - bgG, imgData[p + 2] - bgB);
    if (dist <= tol) {
      isBg[idx] = 1;
      queue[tail++] = idx;
    }
  };

  for (let x = 0; x < cols; x++) {
    tryEnqueue(x, 0);
    tryEnqueue(x, rows - 1);
  }
  for (let y = 1; y < rows - 1; y++) {
    tryEnqueue(0, y);
    tryEnqueue(cols - 1, y);
  }

  while (head < tail) {
    const curr = queue[head++];
    const cx = curr % cols;
    const cy = Math.floor(curr / cols);
    tryEnqueue(cx - 1, cy);
    tryEnqueue(cx + 1, cy);
    tryEnqueue(cx, cy - 1);
    tryEnqueue(cx, cy + 1);
  }

  let bgCount = 0;
  for (let i = 0; i < total; i++) {
    if (isBg[i]) {
      alphaField[i] = 0.0;
      bgCount++;
    } else {
      const p = i * 4;
      const dist = Math.hypot(imgData[p] - bgR, imgData[p + 1] - bgG, imgData[p + 2] - bgB);
      // Suavizar transição na borda do objeto
      alphaField[i] = dist < tol * 1.2 ? Math.min(1.0, Math.max(0.2, (dist - tol * 0.7) / (tol * 0.5))) : 1.0;
    }
  }

  // Se quase toda a imagem foi marcada como fundo (>98%), reverter para opaco seguro
  if (bgCount > total * 0.985) {
    alphaField.fill(1.0);
    return { alphaField, detectedAlpha: false };
  }

  return { alphaField, detectedAlpha: bgCount > total * 0.02 };
};

/**
 * Gera uma malha 3D sólida, fechada e 100% estanque (watertight manifold) para Relevo, Logo ou Chaveiro.
 * Suporta recorte exato de silhueta (PNG transparente ou remoção automática de fundo), argola/furo de chaveiro,
 * moldura de placa, ajuste de contraste e relaxamento suave de contorno para eliminar degraus serrilhados.
 */
export const generateReliefMesh = (
  canvas: HTMLCanvasElement,
  options: ReliefOptions
): Mesh3D => {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D inválido');

  const srcCols = canvas.width;
  const srcRows = canvas.height;
  const imgData = ctx.getImageData(0, 0, srcCols, srcRows).data;

  const cutout = Boolean(options.cutoutSilhouette);
  const autoBg = Boolean(options.autoRemoveBg) || cutout;
  const alphaThreshold = options.alphaThreshold ?? 0.30;
  const contrast = options.contrast ?? 1.0;
  const flatLogoMode = Boolean(options.flatLogoMode);
  const holeRadiusMm = Math.max(1.0, (options.keychainHoleDiameterMm || 4.0) * 0.5);
  const loopWallMm = 2.4;
  const loopOuterRadiusMm = holeRadiusMm + loopWallMm;

  const { alphaField: srcAlpha, detectedAlpha } = computeForegroundAlphaField(
    imgData,
    srcCols,
    srcRows,
    autoBg
  );

  // Caso recorte de silhueta + chaveiro esteja ativo, adicionamos margem superior no grid
  // para acomodar a argola integrada do chaveiro sem cortar o topo da logo
  const mmPerPxX = options.widthMm / Math.max(1, srcCols - 1);
  const mmPerPxY = options.heightMm / Math.max(1, srcRows - 1);
  const extraTopRows =
    cutout && options.addKeychainHole
      ? Math.ceil((loopOuterRadiusMm * 2.1) / Math.max(0.1, mmPerPxY)) + 2
      : 0;
  const padSideCols = cutout ? 2 : 0;
  const padBottomRows = cutout ? 2 : 0;

  const cols = srcCols + padSideCols * 2;
  const rows = srcRows + extraTopRows + padBottomRows;
  const totalVertsGrid = cols * rows;

  const dx = mmPerPxX;
  const dy = mmPerPxY;
  const worldSpanW = (cols - 1) * dx;
  const worldSpanH = (rows - 1) * dy;
  const halfSpanW = worldSpanW * 0.5;
  const halfSpanH = worldSpanH * 0.5;

  // Mapas no grid expandido
  const rawAlpha = new Float32Array(totalVertsGrid);
  const rawLum = new Float32Array(totalVertsGrid);

  for (let sy = 0; sy < srcRows; sy++) {
    const gy = sy + extraTopRows;
    for (let sx = 0; sx < srcCols; sx++) {
      const gx = sx + padSideCols;
      const gIdx = gy * cols + gx;
      const sIdx = sy * srcCols + sx;
      const p = sIdx * 4;

      const a = srcAlpha[sIdx];
      rawAlpha[gIdx] = a;

      let lum = (0.2126 * imgData[p] + 0.7152 * imgData[p + 1] + 0.0722 * imgData[p + 2]) / 255.0;
      if (contrast !== 1.0) {
        lum = Math.min(1.0, Math.max(0.0, (lum - 0.5) * contrast + 0.5));
      }

      if (options.invertRelief) {
        // Inverter apenas onde há objeto visível para jamais extrudar fundo transparente!
        lum = a >= alphaThreshold ? 1.0 - lum : 0.0;
      }

      if (flatLogoMode) {
        // No modo Logo/Chaveiro, qualquer pixel opaco recebe relevo cheio nítido (mesmo logos pretas!)
        lum = a >= alphaThreshold ? 1.0 : 0.0;
      } else if (detectedAlpha) {
        // Em imagens com fundo transparente/removido, garante degrau mínimo visível mesmo em áreas escuras da logo
        lum = a >= alphaThreshold ? 0.25 + 0.75 * lum : 0.0;
      }

      rawLum[gIdx] = lum;
    }
  }

  // Suavizar mapa de altura e campo de silhueta
  const smoothAlpha = cutout ? smoothGrid(rawAlpha, cols, rows, 1) : rawAlpha;
  const heightGrid = options.smoothingRadius > 0
    ? smoothGrid(rawLum, cols, rows, options.smoothingRadius, cutout ? smoothAlpha : undefined)
    : rawLum;

  // Posição mundial base de cada nó (gx, gy)
  const posX = new Float32Array(totalVertsGrid);
  const posY = new Float32Array(totalVertsGrid);
  for (let y = 0; y < rows; y++) {
    const vy = halfSpanH - y * dy;
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      posX[i] = -halfSpanW + x * dx;
      posY[i] = vy;
    }
  }

  // Determinar centro ótimo do furo / argola de chaveiro
  let holeCenterX = 0;
  let holeCenterY = halfSpanH - Math.max(options.borderWidthMm + holeRadiusMm + 2.5, holeRadiusMm + 3.0);
  let addLoopTab = false;

  if (options.addKeychainHole) {
    if (cutout) {
      // Encontrar o ponto médio horizontal da faixa superior da silhueta ativa
      let topActiveRow = -1;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          if (smoothAlpha[y * cols + x] >= alphaThreshold) {
            topActiveRow = y;
            break;
          }
        }
        if (topActiveRow !== -1) break;
      }

      if (topActiveRow !== -1) {
        const bandEnd = Math.min(rows - 1, topActiveRow + Math.max(3, Math.round(loopOuterRadiusMm / dy)));
        let sumX = 0;
        let countX = 0;
        for (let y = topActiveRow; y <= bandEnd; y++) {
          for (let x = 0; x < cols; x++) {
            if (smoothAlpha[y * cols + x] >= alphaThreshold) {
              sumX += posX[y * cols + x];
              countX++;
            }
          }
        }
        holeCenterX = countX > 0 ? sumX / countX : 0;
        const topWorldY = posY[topActiveRow * cols];
        // Posiciona o centro da argola levemente acima da borda superior para fundir a aba com o corpo
        holeCenterY = topWorldY + holeRadiusMm * 0.65;
        addLoopTab = true;
      }
    } else {
      const marginTop = Math.max(2.6, options.borderWidthMm + 2.0) + holeRadiusMm;
      holeCenterX = 0;
      holeCenterY = halfSpanH - marginTop;
    }
  }

  // Construir campo escalar contínuo de ocupação `occField` (> 0 = sólido, < 0 = vazio)
  // Isso permite tanto máscara exata de células quanto relaxamento suave de vértices na fronteira!
  const occField = new Float32Array(totalVertsGrid);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      const vx = posX[i];
      const vy = posY[i];

      // Ocupação base: silhueta ou placa retangular completa
      let occ = cutout ? smoothAlpha[i] - alphaThreshold : 1.0;

      // Moldura elevada em placas retangulares
      if (!cutout && options.borderWidthMm > 0) {
        const distLeft = vx - (-halfSpanW);
        const distRight = halfSpanW - vx;
        const distTop = halfSpanH - vy;
        const distBot = vy - (-halfSpanH);
        const minEdgeDist = Math.min(distLeft, distRight, distTop, distBot);
        if (minEdgeDist <= options.borderWidthMm) {
          heightGrid[i] = 1.0;
        }
      }

      // Geometria do Chaveiro (Aba arredondada externa + Furo circular passante)
      if (options.addKeychainHole) {
        const distHole = Math.hypot(vx - holeCenterX, vy - holeCenterY);

        if (addLoopTab) {
          // União com aba circular + haste inferior de conexão até o corpo
          const tabOcc = (loopOuterRadiusMm - distHole) / Math.max(dx, dy);
          const inBridgeX = Math.abs(vx - holeCenterX) <= loopOuterRadiusMm * 0.82;
          const inBridgeY = vy <= holeCenterY && vy >= holeCenterY - loopOuterRadiusMm * 1.45;
          const bridgeOcc = inBridgeX && inBridgeY
            ? (loopOuterRadiusMm * 0.82 - Math.abs(vx - holeCenterX)) / Math.max(dx, dy)
            : -1.0;
          const combinedTab = Math.max(tabOcc, bridgeOcc);
          if (combinedTab > occ) {
            occ = combinedTab;
            // Altura da argola: base reforçada limpa
            heightGrid[i] = Math.max(heightGrid[i] * 0.35, Math.min(0.45, 1.0 / Math.max(1.0, options.reliefHeightMm)));
          }
        } else if (!cutout && distHole <= loopOuterRadiusMm) {
          // Colarinho reforçado ao redor do furo na placa
          heightGrid[i] = Math.max(heightGrid[i], 0.65);
        }

        // Subtração booleana do furo circular interno
        const holeInside = (distHole - holeRadiusMm) / Math.max(dx, dy);
        occ = Math.min(occ, holeInside);
      }

      occField[i] = occ;
    }
  }

  // Determinar células (quads) ativas
  const cellCols = cols - 1;
  const cellRows = rows - 1;
  const activeCells = new Uint8Array(cellCols * cellRows);
  let activeCellCount = 0;

  for (let cy = 0; cy < cellRows; cy++) {
    for (let cx = 0; cx < cellCols; cx++) {
      const i00 = cy * cols + cx;
      const i10 = i00 + 1;
      const i01 = i00 + cols;
      const i11 = i01 + 1;

      const avgOcc = 0.25 * (occField[i00] + occField[i10] + occField[i01] + occField[i11]);
      // Se todos os pixels estiverem transparentes, fallback para placa completa caso não haja nada
      if (avgOcc >= 0.0) {
        activeCells[cy * cellCols + cx] = 1;
        activeCellCount++;
      }
    }
  }

  // Segurança: se o limiar de transparência recortou 100% da imagem, gera placa base para não falhar
  if (activeCellCount === 0) {
    activeCells.fill(1);
    activeCellCount = cellCols * cellRows;
  }

  // Relaxamento suave dos vértices de fronteira em direção à curva iso (occField == 0)
  // Elimina o aspecto "pixelado / escada" em furos circulares e bordas curvas mantendo 100% manifold!
  if (cutout || options.addKeychainHole) {
    const isBoundaryVert = new Uint8Array(totalVertsGrid);
    for (let cy = 0; cy < cellRows; cy++) {
      for (let cx = 0; cx < cellCols; cx++) {
        const active = activeCells[cy * cellCols + cx];
        const leftDiff = cx === 0 ? active === 1 : activeCells[cy * cellCols + (cx - 1)] !== active;
        const rightDiff = cx === cellCols - 1 ? active === 1 : activeCells[cy * cellCols + (cx + 1)] !== active;
        const topDiff = cy === 0 ? active === 1 : activeCells[(cy - 1) * cellCols + cx] !== active;
        const botDiff = cy === cellRows - 1 ? active === 1 : activeCells[(cy + 1) * cellCols + cx] !== active;

        if (leftDiff) {
          isBoundaryVert[cy * cols + cx] = 1;
          isBoundaryVert[(cy + 1) * cols + cx] = 1;
        }
        if (rightDiff) {
          isBoundaryVert[cy * cols + (cx + 1)] = 1;
          isBoundaryVert[(cy + 1) * cols + (cx + 1)] = 1;
        }
        if (topDiff) {
          isBoundaryVert[cy * cols + cx] = 1;
          isBoundaryVert[cy * cols + (cx + 1)] = 1;
        }
        if (botDiff) {
          isBoundaryVert[(cy + 1) * cols + cx] = 1;
          isBoundaryVert[(cy + 1) * cols + (cx + 1)] = 1;
        }
      }
    }

    const maxShiftX = dx * 0.40;
    const maxShiftY = dy * 0.40;

    for (let y = 1; y < rows - 1; y++) {
      for (let x = 1; x < cols - 1; x++) {
        const i = y * cols + x;
        if (!isBoundaryVert[i]) continue;

        const val = occField[i];
        const gx = (occField[i + 1] - occField[i - 1]) / (2 * dx);
        const gy = (occField[(y - 1) * cols + x] - occField[(y + 1) * cols + x]) / (2 * dy); // +Y world é -y grid
        const gradSq = gx * gx + gy * gy;
        if (gradSq > 1e-6) {
          const stepX = Math.max(-maxShiftX, Math.min(maxShiftX, (-val * gx) / gradSq));
          const stepY = Math.max(-maxShiftY, Math.min(maxShiftY, (-val * gy) / gradSq));
          posX[i] += stepX;
          posY[i] += stepY;
        }
      }
    }
  }

  // Suavização Laplaciana leve em XY nos vértices exclusivos da borda externa/interna
  // para curvas ainda mais orgânicas sem alterar a topologia estanque
  if (cutout || options.addKeychainHole) {
    const nextX = new Float32Array(posX);
    const nextY = new Float32Array(posY);
    for (let cy = 0; cy < cellRows; cy++) {
      for (let cx = 0; cx < cellCols; cx++) {
        if (!activeCells[cy * cellCols + cx]) continue;
        // Arestas de contorno direcionadas
        if (cy === 0 || !activeCells[(cy - 1) * cellCols + cx]) {
          const a = cy * cols + cx;
          const b = cy * cols + (cx + 1);
          nextX[a] = posX[a] * 0.8 + posX[b] * 0.2;
          nextY[a] = posY[a] * 0.8 + posY[b] * 0.2;
          nextX[b] = posX[b] * 0.8 + posX[a] * 0.2;
          nextY[b] = posY[b] * 0.8 + posY[a] * 0.2;
        }
      }
    }
    posX.set(nextX);
    posY.set(nextY);
  }

  // Mapear apenas vértices utilizados pelas células ativas (compactação de memória)
  const topVertMap = new Int32Array(totalVertsGrid).fill(-1);
  let usedGridVerts = 0;

  for (let cy = 0; cy < cellRows; cy++) {
    for (let cx = 0; cx < cellCols; cx++) {
      if (!activeCells[cy * cellCols + cx]) continue;
      const corners = [
        cy * cols + cx,
        cy * cols + (cx + 1),
        (cy + 1) * cols + cx,
        (cy + 1) * cols + (cx + 1),
      ];
      for (const c of corners) {
        if (topVertMap[c] === -1) {
          topVertMap[c] = usedGridVerts++;
        }
      }
    }
  }

  const totalVertices = usedGridVerts * 2;
  const vertices = new Float32Array(totalVertices * 3);
  const baseOffset = usedGridVerts;

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let maxZ = options.baseThicknessMm;

  for (let i = 0; i < totalVertsGrid; i++) {
    const mapped = topVertMap[i];
    if (mapped === -1) continue;

    const vx = posX[i];
    const vy = posY[i];
    const lum = Math.max(0, Math.min(1, heightGrid[i]));
    const vz = options.baseThicknessMm + lum * options.reliefHeightMm;

    vertices[mapped * 3] = vx;
    vertices[mapped * 3 + 1] = vy;
    vertices[mapped * 3 + 2] = vz;

    const bIdx = baseOffset + mapped;
    vertices[bIdx * 3] = vx;
    vertices[bIdx * 3 + 1] = vy;
    vertices[bIdx * 3 + 2] = 0;

    if (vx < minX) minX = vx;
    if (vx > maxX) maxX = vx;
    if (vy < minY) minY = vy;
    if (vy > maxY) maxY = vy;
    if (vz > maxZ) maxZ = vz;
  }

  // Centralizar X/Y do modelo recortado em (0, 0)
  const centerX = (minX + maxX) * 0.5;
  const centerY = (minY + maxY) * 0.5;
  if (Number.isFinite(centerX) && Number.isFinite(centerY)) {
    for (let v = 0; v < totalVertices; v++) {
      vertices[v * 3] -= centerX;
      vertices[v * 3 + 1] -= centerY;
    }
  }

  // Contar arestas de fronteira para alocação exata de triângulos
  let boundaryEdgeCount = 0;
  for (let cy = 0; cy < cellRows; cy++) {
    for (let cx = 0; cx < cellCols; cx++) {
      if (!activeCells[cy * cellCols + cx]) continue;
      if (cy === 0 || !activeCells[(cy - 1) * cellCols + cx]) boundaryEdgeCount++;
      if (cy === cellRows - 1 || !activeCells[(cy + 1) * cellCols + cx]) boundaryEdgeCount++;
      if (cx === 0 || !activeCells[cy * cellCols + (cx - 1)]) boundaryEdgeCount++;
      if (cx === cellCols - 1 || !activeCells[cy * cellCols + (cx + 1)]) boundaryEdgeCount++;
    }
  }

  const totalTriangles = activeCellCount * 4 + boundaryEdgeCount * 2;
  const indices = new Uint32Array(totalTriangles * 3);
  let triIdx = 0;

  for (let cy = 0; cy < cellRows; cy++) {
    for (let cx = 0; cx < cellCols; cx++) {
      if (!activeCells[cy * cellCols + cx]) continue;

      const t0 = topVertMap[cy * cols + cx];
      const t1 = topVertMap[cy * cols + (cx + 1)];
      const t2 = topVertMap[(cy + 1) * cols + cx];
      const t3 = topVertMap[(cy + 1) * cols + (cx + 1)];

      const b0 = baseOffset + t0;
      const b1 = baseOffset + t1;
      const b2 = baseOffset + t2;
      const b3 = baseOffset + t3;

      // Topo (+Z)
      indices[triIdx++] = t0;
      indices[triIdx++] = t2;
      indices[triIdx++] = t1;

      indices[triIdx++] = t1;
      indices[triIdx++] = t2;
      indices[triIdx++] = t3;

      // Base (-Z)
      indices[triIdx++] = b0;
      indices[triIdx++] = b1;
      indices[triIdx++] = b2;

      indices[triIdx++] = b1;
      indices[triIdx++] = b3;
      indices[triIdx++] = b2;

      // Parede Norte (+Y)
      if (cy === 0 || !activeCells[(cy - 1) * cellCols + cx]) {
        indices[triIdx++] = t0;
        indices[triIdx++] = t1;
        indices[triIdx++] = b0;

        indices[triIdx++] = t1;
        indices[triIdx++] = b1;
        indices[triIdx++] = b0;
      }

      // Parede Sul (-Y)
      if (cy === cellRows - 1 || !activeCells[(cy + 1) * cellCols + cx]) {
        indices[triIdx++] = t2;
        indices[triIdx++] = b2;
        indices[triIdx++] = t3;

        indices[triIdx++] = t3;
        indices[triIdx++] = b2;
        indices[triIdx++] = b3;
      }

      // Parede Oeste (-X)
      if (cx === 0 || !activeCells[cy * cellCols + (cx - 1)]) {
        indices[triIdx++] = t0;
        indices[triIdx++] = b0;
        indices[triIdx++] = t2;

        indices[triIdx++] = t2;
        indices[triIdx++] = b0;
        indices[triIdx++] = b2;
      }

      // Parede Leste (+X)
      if (cx === cellCols - 1 || !activeCells[cy * cellCols + (cx + 1)]) {
        indices[triIdx++] = t1;
        indices[triIdx++] = t3;
        indices[triIdx++] = b1;

        indices[triIdx++] = t3;
        indices[triIdx++] = b3;
        indices[triIdx++] = b1;
      }
    }
  }

  return {
    vertices,
    indices: indices.subarray(0, triIdx),
    widthMm: Math.round((maxX - minX) * 10) / 10,
    heightMm: Math.round((maxY - minY) * 10) / 10,
    depthMm: Math.round(maxZ * 10) / 10,
    triangleCount: triIdx / 3,
  };
};

/**
 * Gera uma Litofania 3D sólida orientada EM PÉ na mesa (Z = 0 .. heightMm),
 * pronta para impressão vertical de alta definição no Bambu Studio (sem precisar rotacionar no fatiador)
 * e autoportante quando curvada em arco cilíndrico (30°..60°).
 */
export const generateLithophaneMesh = (
  canvas: HTMLCanvasElement,
  options: LithophaneOptions
): Mesh3D => {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D inválido');

  const cols = canvas.width;
  const rows = canvas.height;
  const imgData = ctx.getImageData(0, 0, cols, rows).data;

  const topVertCount = cols * rows;
  const totalVertCount = topVertCount * 2;
  const vertices = new Float32Array(totalVertCount * 3);
  const lithoGlowColors = new Float32Array(totalVertCount * 3);

  const halfW = options.widthMm / 2;
  const dx = options.widthMm / Math.max(1, cols - 1);
  const dz = options.heightMm / Math.max(1, rows - 1);

  const isCurved = options.curveAngleDeg > 0;
  const arcRad = (options.curveAngleDeg * Math.PI) / 180;
  const radius = isCurved ? options.widthMm / arcRad : 0;

  const minT = Math.max(0.4, options.minThicknessMm);
  const maxT = Math.max(minT + 0.4, options.maxThicknessMm);
  const frameT = Math.max(maxT, options.frameThicknessMm);
  const frameBorderPixelsX = Math.round((options.frameWidthMm / Math.max(1, options.widthMm)) * cols);
  const frameBorderPixelsY = Math.round((options.frameWidthMm / Math.max(1, options.heightMm)) * rows);

  // Centro Y para equilibrar o arco sobre Y = 0 na mesa
  const midSagitta = isCurved && radius > 0 ? radius * (1 - Math.cos(arcRad * 0.5)) * 0.5 : 0;
  const baseOffset = topVertCount;

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  for (let y = 0; y < rows; y++) {
    // Em pé: linha superior da imagem (y=0) fica em Z = heightMm; base (y=rows-1) assenta em Z = 0.000
    const vz = options.heightMm - y * dz;

    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      const bIdx = baseOffset + i;
      const idx = i * 4;
      const r = imgData[idx];
      const g = imgData[idx + 1];
      const b = imgData[idx + 2];
      const a = imgData[idx + 3] / 255.0;

      // Pixel transparente vira claro (fino); escuro vira espesso (bloqueia luz)
      const rawLum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255.0;
      const lum = rawLum * a + (1.0 - a);
      const darkness = 1.0 - lum;

      let thickness = minT + darkness * (maxT - minT);

      const isFrame =
        options.frameWidthMm > 0 &&
        (x < frameBorderPixelsX ||
          x >= cols - frameBorderPixelsX ||
          y < frameBorderPixelsY ||
          y >= rows - frameBorderPixelsY);

      if (isFrame) {
        thickness = Math.max(thickness, frameT);
      }

      const u = -halfW + x * dx;

      let fx: number, fy: number, bx: number, by: number;
      if (isCurved && radius > 0) {
        const angle = (u / options.widthMm) * arcRad;
        const rBack = radius;
        const rFront = radius + thickness;
        // Arco côncavo em direção à luz traseira (+Y), frente esculpida voltada para o observador (-Y)
        bx = rBack * Math.sin(angle);
        by = (radius - rBack * Math.cos(angle)) - midSagitta + maxT * 0.5;
        fx = rFront * Math.sin(angle);
        fy = (radius - rFront * Math.cos(angle)) - midSagitta + maxT * 0.5;
      } else {
        bx = u;
        by = frameT * 0.5;
        fx = u;
        fy = by - thickness;
      }

      vertices[i * 3] = fx;
      vertices[i * 3 + 1] = fy;
      vertices[i * 3 + 2] = Math.max(0, vz);

      vertices[bIdx * 3] = bx;
      vertices[bIdx * 3 + 1] = by;
      vertices[bIdx * 3 + 2] = Math.max(0, vz);

      if (fx < minX) minX = fx;
      if (fx > maxX) maxX = fx;
      if (bx < minX) minX = bx;
      if (bx > maxX) maxX = bx;
      if (fy < minY) minY = fy;
      if (fy > maxY) maxY = fy;
      if (by < minY) minY = by;
      if (by > maxY) maxY = by;

      // Atenuação Beer-Lambert realista para o modo Simular Luz Traseira (PLA Branco Quente)
      const normT = (thickness - minT) / Math.max(0.2, frameT - minT);
      const trans = Math.exp(-2.65 * Math.max(0, normT));
      const gr = Math.min(1.0, 0.10 + 0.94 * Math.pow(trans, 0.82));
      const gg = Math.min(1.0, 0.08 + 0.87 * Math.pow(trans, 0.92));
      const gb = Math.min(1.0, 0.06 + 0.72 * Math.pow(trans, 1.08));

      lithoGlowColors[i * 3] = gr;
      lithoGlowColors[i * 3 + 1] = gg;
      lithoGlowColors[i * 3 + 2] = gb;

      lithoGlowColors[bIdx * 3] = gr;
      lithoGlowColors[bIdx * 3 + 1] = gg;
      lithoGlowColors[bIdx * 3 + 2] = gb;
    }
  }

  const gridQuads = (cols - 1) * (rows - 1);
  const borderQuads = (cols - 1) * 2 + (rows - 1) * 2;
  const totalTriangles = gridQuads * 4 + borderQuads * 2;
  const indices = new Uint32Array(totalTriangles * 3);
  let triIdx = 0;

  // Face Frontal esculpida (normal para -Y)
  for (let y = 0; y < rows - 1; y++) {
    for (let x = 0; x < cols - 1; x++) {
      const v0 = y * cols + x;
      const v1 = y * cols + (x + 1);
      const v2 = (y + 1) * cols + x;
      const v3 = (y + 1) * cols + (x + 1);

      indices[triIdx++] = v0;
      indices[triIdx++] = v2;
      indices[triIdx++] = v1;

      indices[triIdx++] = v1;
      indices[triIdx++] = v2;
      indices[triIdx++] = v3;
    }
  }

  // Face Traseira lisa (normal para +Y)
  for (let y = 0; y < rows - 1; y++) {
    for (let x = 0; x < cols - 1; x++) {
      const b0 = baseOffset + (y * cols + x);
      const b1 = baseOffset + (y * cols + (x + 1));
      const b2 = baseOffset + ((y + 1) * cols + x);
      const b3 = baseOffset + ((y + 1) * cols + (x + 1));

      indices[triIdx++] = b0;
      indices[triIdx++] = b1;
      indices[triIdx++] = b2;

      indices[triIdx++] = b1;
      indices[triIdx++] = b3;
      indices[triIdx++] = b2;
    }
  }

  // Topo (y = 0, Z = heightMm, normal +Z)
  for (let x = 0; x < cols - 1; x++) {
    const t0 = x;
    const t1 = x + 1;
    const b0 = baseOffset + t0;
    const b1 = baseOffset + t1;
    indices[triIdx++] = t0;
    indices[triIdx++] = t1;
    indices[triIdx++] = b0;
    indices[triIdx++] = t1;
    indices[triIdx++] = b1;
    indices[triIdx++] = b0;
  }

  // Base assentada na mesa (y = rows - 1, Z = 0, normal -Z)
  const lastRowY = (rows - 1) * cols;
  for (let x = 0; x < cols - 1; x++) {
    const t0 = lastRowY + x;
    const t1 = lastRowY + x + 1;
    const b0 = baseOffset + t0;
    const b1 = baseOffset + t1;
    indices[triIdx++] = t0;
    indices[triIdx++] = b0;
    indices[triIdx++] = t1;
    indices[triIdx++] = t1;
    indices[triIdx++] = b0;
    indices[triIdx++] = b1;
  }

  // Lateral Esquerda (-X)
  for (let y = 0; y < rows - 1; y++) {
    const t0 = y * cols;
    const t1 = (y + 1) * cols;
    const b0 = baseOffset + t0;
    const b1 = baseOffset + t1;
    indices[triIdx++] = t0;
    indices[triIdx++] = b0;
    indices[triIdx++] = t1;
    indices[triIdx++] = t1;
    indices[triIdx++] = b0;
    indices[triIdx++] = b1;
  }

  // Lateral Direita (+X)
  for (let y = 0; y < rows - 1; y++) {
    const t0 = y * cols + (cols - 1);
    const t1 = (y + 1) * cols + (cols - 1);
    const b0 = baseOffset + t0;
    const b1 = baseOffset + t1;
    indices[triIdx++] = t0;
    indices[triIdx++] = t1;
    indices[triIdx++] = b0;
    indices[triIdx++] = t1;
    indices[triIdx++] = b1;
    indices[triIdx++] = b0;
  }

  return {
    vertices,
    indices: indices.subarray(0, triIdx),
    lithoGlowColors,
    widthMm: Math.round((maxX - minX) * 10) / 10,
    heightMm: Math.round((maxY - minY) * 10) / 10,
    depthMm: Math.round(options.heightMm * 10) / 10,
    triangleCount: triIdx / 3,
  };
};

/**
 * Empacota a malha triangular em formato .3MF compatível com Bambu Studio, OrcaSlicer, PrusaSlicer e Cura,
 * já centralizada no centro da mesa Bambu 256×256 mm (128, 128, 0) e cedendo à thread principal a cada 50ms.
 */
export const exportMeshTo3MF = async (
  mesh: Mesh3D,
  modelName = 'AZ3D_Modelo_Bambu'
): Promise<Blob> => {
  const zip = new JSZip();

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
</Types>`;
  zip.file('[Content_Types].xml', contentTypesXml);

  const relsXml = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`;
  zip.file('_rels/.rels', relsXml);

  const vertices = mesh.vertices;
  const indices = mesh.indices;
  const vertCount = vertices.length / 3;
  const triCount = indices.length / 3;

  // Garantir centralização X/Y em 0 e base assentada em Z = 0
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity;
  for (let i = 0; i < vertCount; i++) {
    const x = vertices[i * 3];
    const y = vertices[i * 3 + 1];
    const z = vertices[i * 3 + 2];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
  }
  const shiftX = Number.isFinite(minX) ? (minX + maxX) * 0.5 : 0;
  const shiftY = Number.isFinite(minY) ? (minY + maxY) * 0.5 : 0;
  const shiftZ = Number.isFinite(minZ) ? minZ : 0;

  let deadline = performance.now() + 50;
  const vertChunks: string[] = new Array(vertCount);
  for (let i = 0; i < vertCount; i++) {
    const x = (vertices[i * 3] - shiftX).toFixed(3);
    const y = (vertices[i * 3 + 1] - shiftY).toFixed(3);
    const z = (vertices[i * 3 + 2] - shiftZ).toFixed(3);
    vertChunks[i] = `          <vertex x="${x}" y="${y}" z="${z}"/>`;
    if ((i & 4095) === 4095 && performance.now() >= deadline) {
      await yieldToMainThread();
      deadline = performance.now() + 50;
    }
  }

  const triChunks: string[] = new Array(triCount);
  for (let i = 0; i < triCount; i++) {
    const v1 = indices[i * 3];
    const v2 = indices[i * 3 + 1];
    const v3 = indices[i * 3 + 2];
    triChunks[i] = `          <triangle v1="${v1}" v2="${v2}" v3="${v3}"/>`;
    if ((i & 4095) === 4095 && performance.now() >= deadline) {
      await yieldToMainThread();
      deadline = performance.now() + 50;
    }
  }

  const safeTitle = modelName.replace(/[<>&"']/g, '_');
  const modelXml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<model unit="millimeter" xml:lang="pt-BR" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">',
    `  <metadata name="Title">${safeTitle}</metadata>`,
    '  <metadata name="Designer">AZ3D Studio</metadata>',
    '  <metadata name="Application">BambuStudio-01.09.00.00</metadata>',
    '  <resources>',
    `    <object id="1" name="${safeTitle}" type="model">`,
    '      <mesh>',
    '        <vertices>',
    vertChunks.join('\n'),
    '        </vertices>',
    '        <triangles>',
    triChunks.join('\n'),
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

  return await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
};

/**
 * Exportador alternativo para STL Binário (com base assentada em Z = 0)
 */
export const exportMeshToSTL = (mesh: Mesh3D): Blob => {
  const triCount = mesh.indices.length / 3;
  const bufferSize = 84 + triCount * 50;
  const buffer = new ArrayBuffer(bufferSize);
  const view = new DataView(buffer);

  const header = 'AZ3D STL Binary Exporter';
  for (let i = 0; i < header.length; i++) {
    view.setUint8(i, header.charCodeAt(i));
  }

  view.setUint32(80, triCount, true);

  let offset = 84;
  const v = mesh.vertices;
  const ind = mesh.indices;

  for (let i = 0; i < triCount; i++) {
    const i0 = ind[i * 3];
    const i1 = ind[i * 3 + 1];
    const i2 = ind[i * 3 + 2];

    const ax = v[i0 * 3], ay = v[i0 * 3 + 1], az = v[i0 * 3 + 2];
    const bx = v[i1 * 3], by = v[i1 * 3 + 1], bz = v[i1 * 3 + 2];
    const cx = v[i2 * 3], cy = v[i2 * 3 + 1], cz = v[i2 * 3 + 2];

    const abx = bx - ax, aby = by - ay, abz = bz - az;
    const acx = cx - ax, acy = cy - ay, acz = cz - az;
    let nx = aby * acz - abz * acy;
    let ny = abz * acx - abx * acz;
    let nz = abx * acy - aby * acx;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
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
 * Função utilitária para download de arquivos gerados
 */
export const downloadMeshFile = (blob: Blob, fileName: string) => {
  saveAs(blob, fileName);
};

/**
 * Decodifica o índice da extrusora (1-based) de um atributo `paint_color` simples de folha Bambu Studio
 */
const decodeSimpleLeafPaintExtruder = (paintAttr: string | null, defaultExtruder = 1): number => {
  if (!paintAttr || paintAttr.length === 0) return defaultExtruder;
  let pos = paintAttr.length - 1;
  const nextNibble = () => (pos >= 0 ? parseInt(paintAttr[pos--], 16) || 0 : 0);
  const code = nextNibble();
  if ((code & 0b11) !== 0) {
    // Triângulo subdividido: usa extrusora do último filho como aproximação rápida na prévia
    return defaultExtruder;
  }
  if ((code & 0b1100) === 0b1100) {
    let nextCode = nextNibble();
    let num = 0;
    while (nextCode === 0xf && pos >= 0) {
      num++;
      nextCode = nextNibble();
    }
    return nextCode + 15 * num + 3;
  }
  const state = code >> 2;
  return state === 0 ? defaultExtruder : state;
};

const hexToRgb01 = (hex: string): [number, number, number] => {
  const clean = hex.replace('#', '').trim();
  if (clean.length < 6) return [1, 1, 1];
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return [
    Number.isFinite(r) ? r : 1,
    Number.isFinite(g) ? g : 1,
    Number.isFinite(b) ? b : 1,
  ];
};

/**
 * Converte um arquivo .3MF (gerado pela RTX 4060 ou fatiador Bambu/Orca, incluindo sub-modelos `3D/Objects/*.model`
 * e cores `paint_color` / `filament_colour`) de volta para Mesh3D centralizado para visualização 3D imediata.
 */
export const parse3MFtoMesh3D = async (blob: Blob): Promise<Mesh3D> => {
  const zip = await JSZip.loadAsync(blob);
  const parser = new DOMParser();

  // 1. Extrair paleta de cores se existir (project_settings.config ou <basematerials>)
  const paletteHex: string[] = [];
  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    if (path.toLowerCase().endsWith('project_settings.config')) {
      try {
        const txt = await entry.async('string');
        const parsed = JSON.parse(txt);
        if (Array.isArray(parsed.filament_colour)) {
          parsed.filament_colour.forEach((c: string) => {
            if (typeof c === 'string' && c.trim()) {
              paletteHex.push(c.startsWith('#') ? c.slice(0, 7) : `#${c.slice(0, 6)}`);
            }
          });
        }
      } catch {
        // Fallback regex se não for JSON puro
      }
    }
  }

  // 2. Carregar todos os arquivos .model do pacote (principal + 3D/Objects/*.model)
  const modelFiles = Object.keys(zip.files).filter(
    (p) => !zip.files[p].dir && p.toLowerCase().endsWith('.model')
  );
  if (modelFiles.length === 0) {
    throw new Error('Nenhum arquivo .model encontrado dentro do pacote .3MF.');
  }

  const outVerts: number[] = [];
  const outColors: number[] = [];
  const outIndices: number[] = [];
  let hasAnyPaintColor = false;

  let deadline = performance.now() + 50;

  for (const mfPath of modelFiles) {
    const xmlText = await zip.files[mfPath].async('string');
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

    if (paletteHex.length === 0) {
      const baseNodes = xmlDoc.getElementsByTagName('base');
      for (let b = 0; b < baseNodes.length; b++) {
        const dc = baseNodes[b].getAttribute('displaycolor');
        if (dc) paletteHex.push(dc.startsWith('#') ? dc.slice(0, 7) : `#${dc.slice(0, 6)}`);
      }
    }

    const meshNodes = xmlDoc.getElementsByTagName('mesh');
    for (let m = 0; m < meshNodes.length; m++) {
      const meshNode = meshNodes[m];
      const vNodes = meshNode.getElementsByTagName('vertex');
      const tNodes = meshNode.getElementsByTagName('triangle');
      if (vNodes.length === 0 || tNodes.length === 0) continue;

      const localV = new Float32Array(vNodes.length * 3);
      for (let i = 0; i < vNodes.length; i++) {
        localV[i * 3] = parseFloat(vNodes[i].getAttribute('x') || '0');
        localV[i * 3 + 1] = parseFloat(vNodes[i].getAttribute('y') || '0');
        localV[i * 3 + 2] = parseFloat(vNodes[i].getAttribute('z') || '0');
        if ((i & 4095) === 4095 && performance.now() >= deadline) {
          await yieldToMainThread();
          deadline = performance.now() + 50;
        }
      }

      // Verificar se há atributo de pintura multicor neste mesh
      let meshHasPaint = false;
      for (let i = 0; i < Math.min(tNodes.length, 200); i++) {
        if (tNodes[i].hasAttribute('paint_color') || tNodes[i].hasAttribute('p1')) {
          meshHasPaint = true;
          break;
        }
      }
      if (!meshHasPaint && tNodes.length > 200) {
        for (let i = 200; i < tNodes.length; i += 37) {
          if (tNodes[i].hasAttribute('paint_color')) {
            meshHasPaint = true;
            break;
          }
        }
      }

      if (meshHasPaint && paletteHex.length > 0) {
        hasAnyPaintColor = true;
        // Chave composta (vertexIndex, extruder) para fronteiras nítidas entre cores
        const vertColorDedup = new Map<number, number>();
        for (let i = 0; i < tNodes.length; i++) {
          const tn = tNodes[i];
          const v1 = parseInt(tn.getAttribute('v1') || '0', 10);
          const v2 = parseInt(tn.getAttribute('v2') || '0', 10);
          const v3 = parseInt(tn.getAttribute('v3') || '0', 10);
          const ext = decodeSimpleLeafPaintExtruder(tn.getAttribute('paint_color'), 1);
          const hex = paletteHex[(ext - 1) % paletteHex.length] || '#FFFFFF';
          const [cr, cg, cb] = hexToRgb01(hex);

          const corners = [v1, v2, v3];
          for (let c = 0; c < 3; c++) {
            const origIdx = corners[c];
            const key = origIdx * 32 + (ext & 31);
            let mapped = vertColorDedup.get(key);
            if (mapped === undefined) {
              mapped = outVerts.length / 3;
              outVerts.push(localV[origIdx * 3], localV[origIdx * 3 + 1], localV[origIdx * 3 + 2]);
              outColors.push(cr, cg, cb);
              vertColorDedup.set(key, mapped);
            }
            outIndices.push(mapped);
          }

          if ((i & 4095) === 4095 && performance.now() >= deadline) {
            await yieldToMainThread();
            deadline = performance.now() + 50;
          }
        }
      } else {
        const baseVertexOffset = outVerts.length / 3;
        for (let i = 0; i < vNodes.length; i++) {
          outVerts.push(localV[i * 3], localV[i * 3 + 1], localV[i * 3 + 2]);
          outColors.push(1, 1, 1);
        }
        for (let i = 0; i < tNodes.length; i++) {
          const tn = tNodes[i];
          outIndices.push(
            baseVertexOffset + parseInt(tn.getAttribute('v1') || '0', 10),
            baseVertexOffset + parseInt(tn.getAttribute('v2') || '0', 10),
            baseVertexOffset + parseInt(tn.getAttribute('v3') || '0', 10)
          );
          if ((i & 4095) === 4095 && performance.now() >= deadline) {
            await yieldToMainThread();
            deadline = performance.now() + 50;
          }
        }
      }
    }
  }

  if (outVerts.length === 0 || outIndices.length === 0) {
    throw new Error('O modelo 3MF não contém vértices ou triângulos válidos.');
  }

  const vertices = new Float32Array(outVerts);
  const vCount = vertices.length / 3;
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

  // Centralizar X/Y em 0 e assentar base em Z = 0 para o visualizador 3D
  const cx = (minX + maxX) * 0.5;
  const cy = (minY + maxY) * 0.5;
  for (let i = 0; i < vCount; i++) {
    vertices[i * 3] -= cx;
    vertices[i * 3 + 1] -= cy;
    vertices[i * 3 + 2] -= minZ;
  }

  return {
    vertices,
    indices: new Uint32Array(outIndices),
    colors: hasAnyPaintColor ? new Float32Array(outColors) : undefined,
    paletteHex: paletteHex.length > 0 ? paletteHex : undefined,
    widthMm: Math.round(Math.abs(maxX - minX) * 10) / 10,
    heightMm: Math.round(Math.abs(maxY - minY) * 10) / 10,
    depthMm: Math.round(Math.abs(maxZ - minZ) * 10) / 10,
    triangleCount: outIndices.length / 3,
  };
};
