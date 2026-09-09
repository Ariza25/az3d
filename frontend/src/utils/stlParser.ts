export interface ClientMeshAnalysis {
  triangleCount: number;
  volumeCm3: number;
  surfaceAreaCm2: number;
  dimXMm: number;
  dimYMm: number;
  dimZMm: number;
}

export interface ClientSliceResult {
  mesh: ClientMeshAnalysis;
  materialType: string;
  infillPercent: number;
  estimatedWeightG: number;
  estimatedHours: number;
  estimatedPrice: number;
}

const MATERIAL_DENSITIES: Record<string, number> = {
  PLA: 1.24,
  ABS: 1.04,
  PETG: 1.27,
  TPU: 1.21,
  Resin: 1.15,
};

/**
 * Fast client-side ArrayBuffer STL binary/ASCII parser
 */
export function parseSTLArrayBuffer(buffer: ArrayBuffer): ClientMeshAnalysis {
  const dataView = new DataView(buffer);
  const dataLen = buffer.byteLength;

  if (dataLen < 84) {
    throw new Error('Arquivo STL muito pequeno ou corrompido.');
  }

  // Check if Binary STL
  const numTriangles = dataView.getUint32(80, true);
  const expectedBinarySize = 84 + numTriangles * 50;

  if (dataLen === expectedBinarySize) {
    return parseBinarySTL(dataView, numTriangles);
  }

  // ASCII fallback
  const decoder = new TextDecoder('utf-8');
  const text = decoder.decode(buffer);
  return parseASCIISTL(text);
}

function parseBinarySTL(view: DataView, numTriangles: number): ClientMeshAnalysis {
  let totalSignedVolume = 0;
  let totalArea = 0;

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  let offset = 84;

  for (let i = 0; i < numTriangles; i++) {
    if (offset + 50 > view.byteLength) break;

    // Normal vector (12 bytes, offset + 0)
    // Vertex 1 (12 bytes, offset + 12)
    const v1x = view.getFloat32(offset + 12, true);
    const v1y = view.getFloat32(offset + 16, true);
    const v1z = view.getFloat32(offset + 20, true);

    // Vertex 2 (12 bytes, offset + 24)
    const v2x = view.getFloat32(offset + 24, true);
    const v2y = view.getFloat32(offset + 28, true);
    const v2z = view.getFloat32(offset + 32, true);

    // Vertex 3 (12 bytes, offset + 36)
    const v3x = view.getFloat32(offset + 36, true);
    const v3y = view.getFloat32(offset + 40, true);
    const v3z = view.getFloat32(offset + 44, true);

    offset += 50;

    minX = Math.min(minX, v1x, v2x, v3x);
    maxX = Math.max(maxX, v1x, v2x, v3x);

    minY = Math.min(minY, v1y, v2y, v3y);
    maxY = Math.max(maxY, v1y, v2y, v3y);

    minZ = Math.min(minZ, v1z, v2z, v3z);
    maxZ = Math.max(maxZ, v1z, v2z, v3z);

    // Signed volume of tetrahedron
    const vSigned = (-v3x * v2y * v1z + v2x * v3y * v1z + v3x * v1y * v2z - v1x * v3y * v2z - v2x * v1y * v3z + v1x * v2y * v3z) / 6.0;
    totalSignedVolume += vSigned;

    // Triangle Area
    const ax = v2x - v1x, ay = v2y - v1y, az = v2z - v1z;
    const bx = v3x - v1x, by = v3y - v1y, bz = v3z - v1z;
    const cx = ay * bz - az * by;
    const cy = az * bx - ax * bz;
    const cz = ax * by - ay * bx;
    totalArea += 0.5 * Math.sqrt(cx * cx + cy * cy + cz * cz);
  }

  const volCm3 = Math.abs(totalSignedVolume) / 1000.0;
  const areaCm2 = totalArea / 100.0;

  return {
    triangleCount: numTriangles,
    volumeCm3: Math.round(volCm3 * 100) / 100,
    surfaceAreaCm2: Math.round(areaCm2 * 100) / 100,
    dimXMm: Math.round(Math.max(0, maxX - minX) * 10) / 10,
    dimYMm: Math.round(Math.max(0, maxY - minY) * 10) / 10,
    dimZMm: Math.round(Math.max(0, maxZ - minZ) * 10) / 10,
  };
}

function parseASCIISTL(text: string): ClientMeshAnalysis {
  const lines = text.split('\n');
  const vertices: { x: number; y: number; z: number }[] = [];
  let totalSignedVolume = 0;
  let totalArea = 0;
  let triCount = 0;

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('vertex ')) {
      const parts = line.split(/\s+/);
      if (parts.length >= 4) {
        const x = parseFloat(parts[1]);
        const y = parseFloat(parts[2]);
        const z = parseFloat(parts[3]);
        if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
          vertices.push({ x, y, z });
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
          minZ = Math.min(minZ, z);
          maxZ = Math.max(maxZ, z);

          if (vertices.length === 3) {
            const v1 = vertices[0], v2 = vertices[1], v3 = vertices[2];
            const vSigned = (-v3.x * v2.y * v1.z + v2.x * v3.y * v1.z + v3.x * v1.y * v2.z - v1.x * v3.y * v2.z - v2.x * v1.y * v3.z + v1.x * v2.y * v3.z) / 6.0;
            totalSignedVolume += vSigned;

            const ax = v2.x - v1.x, ay = v2.y - v1.y, az = v2.z - v1.z;
            const bx = v3.x - v1.x, by = v3.y - v1.y, bz = v3.z - v1.z;
            const cx = ay * bz - az * by;
            const cy = az * bx - ax * bz;
            const cz = ax * by - ay * bx;
            totalArea += 0.5 * Math.sqrt(cx * cx + cy * cy + cz * cz);

            triCount++;
            vertices.length = 0;
          }
        }
      }
    }
  }

  const volCm3 = Math.abs(totalSignedVolume) / 1000.0;
  const areaCm2 = totalArea / 100.0;

  return {
    triangleCount: triCount,
    volumeCm3: Math.round(volCm3 * 100) / 100,
    surfaceAreaCm2: Math.round(areaCm2 * 100) / 100,
    dimXMm: Math.round(Math.max(0, maxX - minX) * 10) / 10,
    dimYMm: Math.round(Math.max(0, maxY - minY) * 10) / 10,
    dimZMm: Math.round(Math.max(0, maxZ - minZ) * 10) / 10,
  };
}

export function calculateClientSlice(mesh: ClientMeshAnalysis, material = 'PLA', infillPercent = 20): ClientSliceResult {
  const density = MATERIAL_DENSITIES[material] || 1.24;
  const shellRatio = 0.20;
  const infillRatio = Math.min(100, Math.max(0, infillPercent)) / 100.0;
  const effectiveVolRatio = shellRatio + (1.0 - shellRatio) * infillRatio;

  const effectiveVolCm3 = mesh.volumeCm3 * effectiveVolRatio;
  const weightG = Math.max(5.0, Math.round(effectiveVolCm3 * density * 10) / 10);
  const hours = Math.max(0.5, Math.round((weightG / 16.0) * 10) / 10);

  let matMultiplier = 1.0;
  if (material === 'Resin') matMultiplier = 1.8;
  else if (material === 'PETG') matMultiplier = 1.25;
  else if (material === 'TPU') matMultiplier = 1.5;
  else if (material === 'ABS') matMultiplier = 1.15;

  let price = Math.round((weightG * 0.45 + hours * 14.0) * matMultiplier);
  if (price < 25.0) price = 25.0;

  return {
    mesh,
    materialType: material,
    infillPercent,
    estimatedWeightG: weightG,
    estimatedHours: hours,
    estimatedPrice: price,
  };
}
