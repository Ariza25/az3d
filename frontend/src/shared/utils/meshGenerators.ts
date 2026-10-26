import JSZip from 'jszip';
import { saveAs } from 'file-saver';

export interface Mesh3D {
  vertices: Float32Array; // [x0, y0, z0, x1, y1, z1, ...]
  indices: Uint32Array;   // [i0, i1, i2, ...]
  widthMm: number;
  heightMm: number;
  depthMm: number;
  triangleCount: number;
}

export interface ReliefOptions {
  widthMm: number;
  heightMm: number;
  baseThicknessMm: number;
  reliefHeightMm: number;
  invertRelief: boolean;
  smoothingRadius: number; // 0 a 3
  borderWidthMm: number;
  addKeychainHole: boolean;
  keychainHoleDiameterMm: number;
}

export interface LithophaneOptions {
  widthMm: number;
  heightMm: number;
  minThicknessMm: number;
  maxThicknessMm: number;
  frameWidthMm: number;
  frameThicknessMm: number;
  curveAngleDeg: number; // 0 = flat, 30..90 = curved arc
}

/**
 * Carrega uma imagem para um HTMLCanvasElement redimensionado para resolução ótima de malha
 */
export const loadImageToCanvas = (
  file: File | string,
  maxResolution = 200
): Promise<{ canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; aspect: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const aspect = img.width / img.height;
      let targetW = maxResolution;
      let targetH = Math.round(maxResolution / aspect);

      if (targetH > maxResolution) {
        targetH = maxResolution;
        targetW = Math.round(maxResolution * aspect);
      }

      // Garantir limites mínimos e pares
      targetW = Math.max(30, targetW);
      targetH = Math.max(30, targetH);

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Não foi possível obter o contexto 2D do Canvas.'));
        return;
      }

      ctx.drawImage(img, 0, 0, targetW, targetH);
      resolve({ canvas, ctx, aspect });
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
 * Aplica suavização simples (Box Blur) em matriz de altura para remover ruídos pontuais
 */
const smoothHeightGrid = (grid: Float32Array, cols: number, rows: number, radius: number): Float32Array => {
  if (radius <= 0) return grid;
  const output = new Float32Array(grid.length);

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= rows) continue;
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= cols) continue;
          sum += grid[ny * cols + nx];
          count++;
        }
      }
      output[y * cols + x] = sum / count;
    }
  }
  return output;
};

/**
 * Gera uma malha 3D sólida, fechada e fatiável (watertight manifold) em Relevo (Alto/Baixo relevo)
 */
export const generateReliefMesh = (
  canvas: HTMLCanvasElement,
  options: ReliefOptions
): Mesh3D => {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D inválido');

  const cols = canvas.width;
  const rows = canvas.height;
  const imgData = ctx.getImageData(0, 0, cols, rows).data;

  // 1. Extrair mapa de luminância normalizada [0.0 ... 1.0]
  let heightGrid: Float32Array<ArrayBufferLike> = new Float32Array(cols * rows);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const idx = (y * cols + x) * 4;
      const r = imgData[idx];
      const g = imgData[idx + 1];
      const b = imgData[idx + 2];
      const a = imgData[idx + 3] / 255.0;

      // Luminância percebida Rec. 709
      let lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255.0;
      lum = lum * a; // Se tiver transparência, zera altura

      if (options.invertRelief) {
        lum = 1.0 - lum;
      }
      heightGrid[y * cols + x] = lum;
    }
  }

  if (options.smoothingRadius > 0) {
    heightGrid = smoothHeightGrid(heightGrid, cols, rows, options.smoothingRadius);
  }

  // 2. Construir vértices
  // Teremos:
  // - Camada Superior (cols * rows vértices)
  // - Camada Inferior (cols * rows vértices plana em Z = 0)
  // - Conexões de bordas laterais criando um sólido 100% estanque (manifold)
  const topVertCount = cols * rows;
  const totalVertCount = topVertCount * 2;
  const vertices = new Float32Array(totalVertCount * 3);

  const halfW = options.widthMm / 2;
  const halfH = options.heightMm / 2;
  const dx = options.widthMm / (cols - 1);
  const dy = options.heightMm / (rows - 1);

  // Vértices do topo
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      const vx = -halfW + x * dx;
      const vy = halfH - y * dy; // Inverte Y para imagem não ficar de cabeça para baixo
      const lum = heightGrid[i];
      const vz = options.baseThicknessMm + lum * options.reliefHeightMm;

      vertices[i * 3] = vx;
      vertices[i * 3 + 1] = vy;
      vertices[i * 3 + 2] = vz;
    }
  }

  // Vértices da base (Z = 0)
  const baseOffset = topVertCount;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const topIdx = y * cols + x;
      const i = baseOffset + topIdx;
      vertices[i * 3] = vertices[topIdx * 3];
      vertices[i * 3 + 1] = vertices[topIdx * 3 + 1];
      vertices[i * 3 + 2] = 0; // Fundo plano assentado na mesa
    }
  }

  // 3. Gerar Triângulos (Faces)
  // - Topo: (cols - 1) * (rows - 1) * 2 triângulos
  // - Fundo: (cols - 1) * (rows - 1) * 2 triângulos
  // - 4 Bordas laterais: (cols - 1) * 2 * 2 + (rows - 1) * 2 * 2 triângulos
  const gridQuads = (cols - 1) * (rows - 1);
  const borderQuads = (cols - 1) * 2 + (rows - 1) * 2;
  const totalTriangles = (gridQuads * 2) * 2 + (borderQuads * 2);
  const indices = new Uint32Array(totalTriangles * 3);
  let triIdx = 0;

  // Triângulos da Superfície Superior (Sentido Anti-horário virado para cima)
  for (let y = 0; y < rows - 1; y++) {
    for (let x = 0; x < cols - 1; x++) {
      const v0 = y * cols + x;
      const v1 = y * cols + (x + 1);
      const v2 = (y + 1) * cols + x;
      const v3 = (y + 1) * cols + (x + 1);

      // Triângulo 1: v0 -> v2 -> v1
      indices[triIdx++] = v0;
      indices[triIdx++] = v2;
      indices[triIdx++] = v1;

      // Triângulo 2: v1 -> v2 -> v3
      indices[triIdx++] = v1;
      indices[triIdx++] = v2;
      indices[triIdx++] = v3;
    }
  }

  // Triângulos da Base Inferior (Sentido virado para baixo Z-)
  for (let y = 0; y < rows - 1; y++) {
    for (let x = 0; x < cols - 1; x++) {
      const b0 = baseOffset + (y * cols + x);
      const b1 = baseOffset + (y * cols + (x + 1));
      const b2 = baseOffset + ((y + 1) * cols + x);
      const b3 = baseOffset + ((y + 1) * cols + (x + 1));

      // Triângulo 1: b0 -> b1 -> b2
      indices[triIdx++] = b0;
      indices[triIdx++] = b1;
      indices[triIdx++] = b2;

      // Triângulo 2: b1 -> b3 -> b2
      indices[triIdx++] = b1;
      indices[triIdx++] = b3;
      indices[triIdx++] = b2;
    }
  }

  // Bordas Laterais Fechando o Sólido:
  // 1. Borda Superior (y = 0)
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

  // 2. Borda Inferior (y = rows - 1)
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

  // 3. Borda Esquerda (x = 0)
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

  // 4. Borda Direita (x = cols - 1)
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
    widthMm: options.widthMm,
    heightMm: options.heightMm,
    depthMm: options.baseThicknessMm + options.reliefHeightMm,
    triangleCount: triIdx / 3,
  };
};

/**
 * Gera uma Litofania 3D sólida, pronta para imprimir em pé ou plana
 */
export const generateLithophaneMesh = (
  canvas: HTMLCanvasElement,
  options: LithophaneOptions
): Mesh3D => {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D inválido');

  const cols = canvas.width;
  const rows = canvas.height;
  const imgData = ctx.getImageData(0, 0, cols, rows).data;

  const topVertCount = cols * rows;
  const totalVertCount = topVertCount * 2;
  const vertices = new Float32Array(totalVertCount * 3);

  const halfW = options.widthMm / 2;
  const halfH = options.heightMm / 2;
  const dx = options.widthMm / (cols - 1);
  const dy = options.heightMm / (rows - 1);

  // Conversão de curvatura (arco cilíndrico)
  const isCurved = options.curveAngleDeg > 0;
  const arcRad = (options.curveAngleDeg * Math.PI) / 180;
  const radius = isCurved ? options.widthMm / arcRad : 0;

  // Espessuras
  const minT = options.minThicknessMm;
  const maxT = options.maxThicknessMm;
  const frameBorderPixelsX = Math.round((options.frameWidthMm / options.widthMm) * cols);
  const frameBorderPixelsY = Math.round((options.frameWidthMm / options.heightMm) * rows);

  // 1. Gerar Vértices da Face com Detalhes (Frente)
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      const idx = i * 4;
      const r = imgData[idx];
      const g = imgData[idx + 1];
      const b = imgData[idx + 2];

      // Luminância: escuro = mais grosso (bloqueia luz), claro = mais fino (passa luz)
      const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255.0;
      const darkness = 1.0 - lum;

      let thickness = minT + darkness * (maxT - minT);

      // Moldura reforçada nas bordas
      const isFrame =
        x < frameBorderPixelsX ||
        x >= cols - frameBorderPixelsX ||
        y < frameBorderPixelsY ||
        y >= rows - frameBorderPixelsY;

      if (isFrame && options.frameWidthMm > 0) {
        thickness = Math.max(thickness, options.frameThicknessMm);
      }

      const flatX = -halfW + x * dx;
      const flatY = halfH - y * dy;

      if (isCurved && radius > 0) {
        const angle = (flatX / options.widthMm) * arcRad;
        const curvedX = (radius + thickness) * Math.sin(angle);
        const curvedZ = (radius + thickness) * Math.cos(angle) - radius;
        vertices[i * 3] = curvedX;
        vertices[i * 3 + 1] = flatY;
        vertices[i * 3 + 2] = curvedZ;
      } else {
        vertices[i * 3] = flatX;
        vertices[i * 3 + 1] = flatY;
        vertices[i * 3 + 2] = thickness;
      }
    }
  }

  // 2. Gerar Vértices da Face Traseira Plana / Cilíndrica Base
  const baseOffset = topVertCount;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const topIdx = y * cols + x;
      const i = baseOffset + topIdx;
      const flatX = -halfW + x * dx;
      const flatY = halfH - y * dy;

      if (isCurved && radius > 0) {
        const angle = (flatX / options.widthMm) * arcRad;
        const curvedX = radius * Math.sin(angle);
        const curvedZ = radius * Math.cos(angle) - radius;
        vertices[i * 3] = curvedX;
        vertices[i * 3 + 1] = flatY;
        vertices[i * 3 + 2] = curvedZ;
      } else {
        vertices[i * 3] = flatX;
        vertices[i * 3 + 1] = flatY;
        vertices[i * 3 + 2] = 0;
      }
    }
  }

  // 3. Montar Triângulos (Mesma topologia estanque fechada)
  const gridQuads = (cols - 1) * (rows - 1);
  const borderQuads = (cols - 1) * 2 + (rows - 1) * 2;
  const totalTriangles = (gridQuads * 2) * 2 + (borderQuads * 2);
  const indices = new Uint32Array(totalTriangles * 3);
  let triIdx = 0;

  // Frente
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

  // Traseira
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

  // Bordas
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
    widthMm: options.widthMm,
    heightMm: options.heightMm,
    depthMm: Math.max(options.maxThicknessMm, options.frameThicknessMm),
    triangleCount: triIdx / 3,
  };
};

/**
 * Empacota a malha triangular em formato .3MF compatível com Bambu Studio, OrcaSlicer, PrusaSlicer e Cura
 */
export const exportMeshTo3MF = async (
  mesh: Mesh3D,
  modelName = 'AZ3D_Modelo_Bambu'
): Promise<Blob> => {
  const zip = new JSZip();

  // 1. [Content_Types].xml
  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
</Types>`;
  zip.file('[Content_Types].xml', contentTypesXml);

  // 2. _rels/.rels
  const relsXml = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`;
  zip.file('_rels/.rels', relsXml);

  // 3. Montar 3D/3dmodel.model em blocos para performance de memória
  const vertices = mesh.vertices;
  const indices = mesh.indices;
  const vertCount = vertices.length / 3;
  const triCount = indices.length / 3;

  let verticesXml = '';
  for (let i = 0; i < vertCount; i++) {
    const x = vertices[i * 3].toFixed(3);
    const y = vertices[i * 3 + 1].toFixed(3);
    const z = vertices[i * 3 + 2].toFixed(3);
    verticesXml += `<vertex x="${x}" y="${y}" z="${z}"/>\n`;
  }

  let trianglesXml = '';
  for (let i = 0; i < triCount; i++) {
    const v1 = indices[i * 3];
    const v2 = indices[i * 3 + 1];
    const v3 = indices[i * 3 + 2];
    trianglesXml += `<triangle v1="${v1}" v2="${v2}" v3="${v3}"/>\n`;
  }

  const modelXml = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="pt-BR" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <metadata name="Title">${modelName}</metadata>
  <metadata name="Designer">AZ3D Studio</metadata>
  <metadata name="Application">AZ3D Bambu Slicer Exporter</metadata>
  <resources>
    <object id="1" name="${modelName}" type="model">
      <mesh>
        <vertices>
${verticesXml}        </vertices>
        <triangles>
${trianglesXml}        </triangles>
      </mesh>
    </object>
  </resources>
  <build>
    <item objectid="1"/>
  </build>
</model>`;

  zip.file('3D/3dmodel.model', modelXml);

  return await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
};

/**
 * Exportador alternativo para STL Binário
 */
export const exportMeshToSTL = (mesh: Mesh3D): Blob => {
  const triCount = mesh.indices.length / 3;
  const bufferSize = 84 + triCount * 50;
  const buffer = new ArrayBuffer(bufferSize);
  const view = new DataView(buffer);

  // Header 80 bytes
  const header = 'AZ3D STL Binary Exporter';
  for (let i = 0; i < header.length; i++) {
    view.setUint8(i, header.charCodeAt(i));
  }

  // Quantidade de triângulos (uint32)
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

    // Vetores AB e AC para calcular vetor normal
    const abx = bx - ax, aby = by - ay, abz = bz - az;
    const acx = cx - ax, acy = cy - ay, acz = cz - az;
    let nx = aby * acz - abz * acy;
    let ny = abz * acx - abx * acz;
    let nz = abx * acy - aby * acx;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;

    // Normal
    view.setFloat32(offset, nx, true);
    view.setFloat32(offset + 4, ny, true);
    view.setFloat32(offset + 8, nz, true);

    // Vértice 1
    view.setFloat32(offset + 12, ax, true);
    view.setFloat32(offset + 16, ay, true);
    view.setFloat32(offset + 20, az, true);

    // Vértice 2
    view.setFloat32(offset + 24, bx, true);
    view.setFloat32(offset + 28, by, true);
    view.setFloat32(offset + 32, bz, true);

    // Vértice 3
    view.setFloat32(offset + 36, cx, true);
    view.setFloat32(offset + 40, cy, true);
    view.setFloat32(offset + 44, cz, true);

    // Attribute byte count (0)
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
 * Converte um arquivo .3MF (gerado pela RTX ou fatiador) de volta para Mesh3D
 * para permitir visualização 3D interativa imediata no navegador.
 */
export const parse3MFtoMesh3D = async (blob: Blob): Promise<Mesh3D> => {
  const zip = await JSZip.loadAsync(blob);
  const modelFile = zip.file('3D/3dmodel.model') || zip.file('3d/3dmodel.model');
  if (!modelFile) {
    throw new Error('Arquivo 3D/3dmodel.model não encontrado dentro do pacote .3MF.');
  }

  const xmlText = await modelFile.async('string');
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

  const vertexNodes = xmlDoc.getElementsByTagName('vertex');
  const triangleNodes = xmlDoc.getElementsByTagName('triangle');

  if (vertexNodes.length === 0 || triangleNodes.length === 0) {
    throw new Error('O modelo 3MF não contém vértices ou triângulos válidos.');
  }

  const vertices = new Float32Array(vertexNodes.length * 3);
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  for (let i = 0; i < vertexNodes.length; i++) {
    const node = vertexNodes[i];
    const x = parseFloat(node.getAttribute('x') || '0');
    const y = parseFloat(node.getAttribute('y') || '0');
    const z = parseFloat(node.getAttribute('z') || '0');

    vertices[i * 3] = x;
    vertices[i * 3 + 1] = y;
    vertices[i * 3 + 2] = z;

    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }

  const indices = new Uint32Array(triangleNodes.length * 3);
  for (let i = 0; i < triangleNodes.length; i++) {
    const node = triangleNodes[i];
    indices[i * 3] = parseInt(node.getAttribute('v1') || '0', 10);
    indices[i * 3 + 1] = parseInt(node.getAttribute('v2') || '0', 10);
    indices[i * 3 + 2] = parseInt(node.getAttribute('v3') || '0', 10);
  }

  return {
    vertices,
    indices,
    widthMm: Math.round(Math.abs(maxX - minX) * 10) / 10,
    heightMm: Math.round(Math.abs(maxY - minY) * 10) / 10,
    depthMm: Math.round(Math.abs(maxZ - minZ) * 10) / 10,
    triangleCount: triangleNodes.length,
  };
};
