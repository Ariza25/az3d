import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import {
  SplitPartMesh,
  SplitEngineOptions,
  PlaneCutOptions,
  ConnectorShape,
  SeamCapMode,
  RawColoredSoup,
  DEFAULT_SPLIT_ENGINE_OPTIONS,
  extractColoredSoupFrom3MfZip,
  parseStlFileToSoup,
  parseObjFileToSoup,
  buildSplitColorParts,
  cutPartByAxisPlane,
  exportSplitPartTo3MF,
  exportSplitPartToSTL,
  exportUnifiedAssembly3MF,
} from './split3mfEngine';

export type {
  SplitPartMesh,
  SplitEngineOptions,
  PlaneCutOptions,
  ConnectorShape,
  SeamCapMode,
  RawColoredSoup,
};

export {
  DEFAULT_SPLIT_ENGINE_OPTIONS,
  buildSplitColorParts,
  cutPartByAxisPlane,
  exportSplitPartTo3MF,
  exportSplitPartToSTL,
  exportUnifiedAssembly3MF,
};

export interface PlateObject {
  id: string;
  name: string;
  filamentId?: string;
  colorHex?: string;
}

export interface PlateInfo {
  plateIndex: number;
  name: string;
  thumbnailUrl?: string;
  objects: PlateObject[];
  estimatedWeightGrams?: number;
  estimatedMinutes?: number;
}

export interface ParsedObjectInfo {
  id: string;
  name: string;
  trianglesCount?: number;
  plateIndex?: number;
}

export interface ColorGroupInfo {
  filamentId: number;
  colorHex: string;
  colorName: string;
  filamentType?: string;
  objects: PlateObject[];
}

export interface ThreeMfProjectInfo {
  fileName: string;
  fileSizeBytes: number;
  inputFormat: '3mf' | 'stl' | 'obj';
  slicer: 'Bambu Studio / OrcaSlicer' | 'PrusaSlicer' | 'STL / OBJ Direto' | 'Padrão / Desconhecido';
  plates: PlateInfo[];
  colorGroups: ColorGroupInfo[];
  objects: ParsedObjectInfo[];
  splitParts: SplitPartMesh[];
  coloredSoup: RawColoredSoup;
  hadPaintedTriangles: boolean;
  totalTriangles: number;
  globalThumbnailUrl?: string;
  rawZip?: JSZip;
  modelXmlString?: string;
  modelSettingsString?: string;
}

/**
 * Paleta padrão de cores do Bambu Lab AMS
 */
export const DEFAULT_BAMBU_COLORS = [
  '#00AE42', // 1: Bambu Green
  '#1A1A1A', // 2: Black
  '#FFFFFF', // 3: White
  '#E53E3E', // 4: Red
  '#3182CE', // 5: Blue
  '#ECC94B', // 6: Yellow
  '#ED8936', // 7: Orange
  '#805AD5', // 8: Purple
  '#718096', // 9: Gray
  '#8B4513', // 10: Brown
];

/**
 * Converte código HEX de cor para nome legível em português
 */
export const getColorNameFromHex = (hex: string): string => {
  const clean = hex.replace('#', '').trim().toUpperCase();
  if (clean.length === 8) {
    return getColorNameFromHex('#' + clean.substring(0, 6));
  }
  if (clean.length !== 6) return 'Personalizada';
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);

  const KNOWN_COLORS: Array<{ name: string; r: number; g: number; b: number }> = [
    { name: 'Preto', r: 26, g: 26, b: 26 },
    { name: 'Branco', r: 250, g: 250, b: 250 },
    { name: 'Cinza', r: 113, g: 128, b: 150 },
    { name: 'Vermelho', r: 229, g: 62, b: 62 },
    { name: 'Azul', r: 49, g: 130, b: 206 },
    { name: 'Verde', r: 56, g: 161, b: 105 },
    { name: 'Amarelo', r: 236, g: 201, b: 75 },
    { name: 'Laranja', r: 237, g: 137, b: 54 },
    { name: 'Roxo', r: 128, g: 90, b: 213 },
    { name: 'Rosa', r: 237, g: 100, b: 166 },
    { name: 'Marrom', r: 139, g: 69, b: 19 },
    { name: 'Ciano', r: 0, g: 180, b: 216 },
    { name: 'Dourado', r: 212, g: 175, b: 55 },
    { name: 'Prateado', r: 192, g: 192, b: 192 },
    { name: 'Bege', r: 245, g: 222, b: 179 },
  ];

  let closest = KNOWN_COLORS[0];
  let minDiff = Infinity;
  for (const c of KNOWN_COLORS) {
    const diff = Math.sqrt((r - c.r) ** 2 + (g - c.g) ** 2 + (b - c.b) ** 2);
    if (diff < minDiff) {
      minDiff = diff;
      closest = c;
    }
  }
  return closest.name;
};

export const COLOR_KEYWORDS: Array<{ match: RegExp; name: string; hex: string }> = [
  { match: /(?:preto|black|negro|escuro)/i, name: 'Preto', hex: '#1A1A1A' },
  { match: /(?:branco|white|blanco|claro)/i, name: 'Branco', hex: '#FFFFFF' },
  { match: /(?:vermelho|red|rojo)/i, name: 'Vermelho', hex: '#E53E3E' },
  { match: /(?:azul|blue)/i, name: 'Azul', hex: '#3182CE' },
  { match: /(?:verde|green)/i, name: 'Verde', hex: '#38A169' },
  { match: /(?:amarelo|yellow|amarillo)/i, name: 'Amarelo', hex: '#ECC94B' },
  { match: /(?:laranja|orange|naranja)/i, name: 'Laranja', hex: '#ED8936' },
  { match: /(?:roxo|purple|violeta|lilas)/i, name: 'Roxo', hex: '#805AD5' },
  { match: /(?:rosa|pink)/i, name: 'Rosa', hex: '#ED64A6' },
  { match: /(?:cinza|gray|grey|gris)/i, name: 'Cinza', hex: '#718096' },
  { match: /(?:marrom|brown|cafe)/i, name: 'Marrom', hex: '#8B4513' },
  { match: /(?:ouro|gold|dourado)/i, name: 'Dourado', hex: '#D4AF37' },
  { match: /(?:prata|silver|prateado)/i, name: 'Prateado', hex: '#CBD5E0' },
  { match: /(?:bege|beige|pele|skin)/i, name: 'Bege', hex: '#F6E05E' },
  { match: /(?:ciano|cyan)/i, name: 'Ciano', hex: '#00B4D8' },
];

export const sanitizeFileName = (name: string): string => {
  return name
    // eslint-disable-next-line no-control-regex
    .replace(/[\\/:*?"<>|\x00-\x1F\x7F]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
};

export const downloadBlob = (blob: Blob, fileName: string): void => {
  const safeName = sanitizeFileName(fileName);
  try {
    saveAs(blob, safeName);
  } catch (err) {
    console.warn('saveAs falhou, aplicando fallback de âncora:', err);
    const binaryBlob = new Blob([blob], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(binaryBlob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = safeName;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (a.parentNode) {
        a.parentNode.removeChild(a);
      }
      URL.revokeObjectURL(url);
    }, 30000);
  }
};

/**
 * Analisa arquivos `.3mf` (Bambu Studio, OrcaSlicer, PrusaSlicer), `.stl` ou `.obj`,
 * extraindo tanto as mesas/objetos originais quanto a divisão geométrica real por cor/pintura (`SplitPartMesh[]`)!
 */
export const parse3DModelProject = async (
  file: File,
  splitOptions: SplitEngineOptions = DEFAULT_SPLIT_ENGINE_OPTIONS
): Promise<ThreeMfProjectInfo> => {
  const lowerName = file.name.toLowerCase();

  // Caso 1: STL ou OBJ direto (igual ao split3mf.com)
  if (lowerName.endsWith('.stl') || lowerName.endsWith('.obj')) {
    const isStl = lowerName.endsWith('.stl');
    const soup = isStl
      ? await parseStlFileToSoup(file, DEFAULT_BAMBU_COLORS[0])
      : await parseObjFileToSoup(file, DEFAULT_BAMBU_COLORS);

    // Para STL único com múltiplas cascas desconectadas, mantém agrupado por material por padrão
    const splitParts = await buildSplitColorParts(
      soup,
      splitOptions,
      getColorNameFromHex,
      DEFAULT_BAMBU_COLORS
    );

    const baseObjName = file.name.replace(/\.(stl|obj)$/i, '');
    const colorGroups: ColorGroupInfo[] = splitParts.map((sp) => ({
      filamentId: sp.extruderId,
      colorHex: sp.colorHex,
      colorName: sp.colorName,
      filamentType: sp.filamentType,
      objects: [{ id: sp.id, name: sp.name, filamentId: String(sp.extruderId), colorHex: sp.colorHex }],
    }));

    return {
      fileName: file.name,
      fileSizeBytes: file.size,
      inputFormat: isStl ? 'stl' : 'obj',
      slicer: 'STL / OBJ Direto',
      plates: [
        {
          plateIndex: 1,
          name: 'Mesa 1',
          objects: [{ id: '1', name: baseObjName, filamentId: '1', colorHex: DEFAULT_BAMBU_COLORS[0] }],
        },
      ],
      colorGroups,
      objects: [{ id: '1', name: baseObjName, trianglesCount: soup.indices.length / 3, plateIndex: 1 }],
      splitParts,
      coloredSoup: soup,
      hadPaintedTriangles: soup.hadPaintedTriangles,
      totalTriangles: soup.indices.length / 3,
    };
  }

  // Caso 2: Pacote .3MF completo
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(file);

  let modelXmlPath = '';
  for (const path of Object.keys(loadedZip.files)) {
    if (path.toLowerCase().endsWith('3d/3dmodel.model') || path.toLowerCase().endsWith('3dmodel.model')) {
      modelXmlPath = path;
      break;
    }
  }

  if (!modelXmlPath) {
    throw new Error('Arquivo .3mf inválido: não foi encontrado o arquivo de geometria 3D/3dmodel.model.');
  }

  const modelXmlString = await loadedZip.files[modelXmlPath].async('string');
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(modelXmlString, 'application/xml');

  const rawObjects: Record<string, { id: string; name: string; componentIds: string[] }> = {};
  const objectNodes = xmlDoc.getElementsByTagName('object');
  for (let i = 0; i < objectNodes.length; i++) {
    const node = objectNodes[i];
    const id = node.getAttribute('id') || String(i + 1);
    const name = node.getAttribute('name') || `Objeto #${id}`;
    const componentIds: string[] = [];
    const components = node.getElementsByTagName('component');
    for (let c = 0; c < components.length; c++) {
      const compId = components[c].getAttribute('objectid');
      if (compId) componentIds.push(compId);
    }
    rawObjects[id] = { id, name, componentIds };
  }

  const buildItems: Array<{ objectId: string; plateId?: number }> = [];
  const buildNodes = xmlDoc.getElementsByTagName('build');
  if (buildNodes.length > 0) {
    const itemNodes = buildNodes[0].getElementsByTagName('item');
    for (let i = 0; i < itemNodes.length; i++) {
      const item = itemNodes[i];
      const objectId = item.getAttribute('objectid');
      if (objectId) {
        const plateAttr =
          item.getAttribute('plate_id') ||
          item.getAttribute('plater_id') ||
          item.getAttribute('BambuStudio:plate_id') ||
          item.getAttribute('slic3r:plate_id');
        buildItems.push({
          objectId,
          plateId: plateAttr ? parseInt(plateAttr, 10) : undefined,
        });
      }
    }
  }

  let slicer: ThreeMfProjectInfo['slicer'] = 'Padrão / Desconhecido';
  let modelSettingsString: string | undefined = undefined;
  const plateMap: Record<number, PlateInfo> = {};
  const objectToPlateMap: Record<string, number> = {};
  const objectNameMap: Record<string, string> = {};
  const objectFilamentMap: Record<string, number> = {};
  const partFilamentMap: Record<string, number> = {};
  const filamentPalette: Record<number, { hex: string; type?: string; name?: string }> = {};

  for (const [path, zipEntry] of Object.entries(loadedZip.files)) {
    if (zipEntry.dir) continue;
    const lower = path.toLowerCase();
    if (lower.includes('bambustudio') || lower.includes('orcaslicer') || lower.includes('model_settings.config')) {
      slicer = 'Bambu Studio / OrcaSlicer';
    } else if ((lower.includes('prusaslicer') || lower.includes('slic3r')) && slicer === 'Padrão / Desconhecido') {
      slicer = 'PrusaSlicer';
    }

    if (lower.endsWith('.config') || lower.endsWith('.json') || lower.endsWith('.xml')) {
      try {
        const text = await zipEntry.async('string');

        // JSON puro (Metadata/project_settings.config do Bambu Studio / OrcaSlicer)
        if (text.trim().startsWith('{')) {
          try {
            const jsonCfg = JSON.parse(text);
            const cols = jsonCfg.filament_colour || jsonCfg.filament_colours;
            const typs = jsonCfg.filament_type || jsonCfg.filament_types;
            if (Array.isArray(cols)) {
              cols.forEach((c: unknown, idx: number) => {
                if (typeof c === 'string' && /^#?[0-9a-fA-F]{6,8}$/.test(c.trim())) {
                  const fId = idx + 1;
                  const cleanHex = c.trim().startsWith('#') ? c.trim().slice(0, 7) : `#${c.trim().slice(0, 6)}`;
                  filamentPalette[fId] = {
                    hex: cleanHex,
                    type: Array.isArray(typs) && typeof typs[idx] === 'string' ? typs[idx] : filamentPalette[fId]?.type,
                  };
                }
              });
            }
          } catch {
            // Prossegue para regex fallback
          }
        }

        const hexMatch =
          text.match(/key=["']filament_colours?["']\s+value=["']([^"']+)["']/i) ||
          text.match(/["']filament_colours?["']\s*:\s*\[([^\]]+)\]/i) ||
          text.match(/filament_colours?\s*=\s*([^\r\n]+)/i);

        if (hexMatch && hexMatch[1]) {
          const colors = hexMatch[1]
            .split(/[,;]/)
            .map((c) => c.replace(/["'\s]/g, '').trim())
            .filter((c) => /^#?[0-9a-fA-F]{6,8}$/.test(c));

          colors.forEach((c, idx) => {
            const fId = idx + 1;
            const rawHex = c.startsWith('#') ? c : `#${c}`;
            const fullHex = rawHex.slice(0, 7);
            if (!filamentPalette[fId]) {
              filamentPalette[fId] = { hex: fullHex };
            } else {
              filamentPalette[fId].hex = fullHex;
            }
          });
        }

        const typeMatch =
          text.match(/key=["']filament_types?["']\s+value=["']([^"']+)["']/i) ||
          text.match(/["']filament_types?["']\s*:\s*\[([^\]]+)\]/i) ||
          text.match(/filament_types?\s*=\s*([^\r\n]+)/i);

        if (typeMatch && typeMatch[1]) {
          const types = typeMatch[1]
            .split(/[,;]/)
            .map((t) => t.replace(/["'\s]/g, '').trim())
            .filter(Boolean);

          types.forEach((t, idx) => {
            const fId = idx + 1;
            if (filamentPalette[fId]) {
              filamentPalette[fId].type = t;
            }
          });
        }

        const filTagRegex = /<filament\s+([^>]+)>/gi;
        let filM: RegExpExecArray | null;
        while ((filM = filTagRegex.exec(text)) !== null) {
          const attrs = filM[1];
          const idM = attrs.match(/id=["'](\d+)["']/i);
          const colM = attrs.match(/color=["']([^"']+)["']/i);
          const typM = attrs.match(/type=["']([^"']+)["']/i);
          if (idM && idM[1]) {
            const fId = parseInt(idM[1], 10);
            if (!filamentPalette[fId]) {
              filamentPalette[fId] = {
                hex: colM
                  ? (colM[1].startsWith('#') ? colM[1].slice(0, 7) : `#${colM[1].slice(0, 6)}`)
                  : DEFAULT_BAMBU_COLORS[(fId - 1) % DEFAULT_BAMBU_COLORS.length],
              };
            }
            if (colM) {
              filamentPalette[fId].hex = colM[1].startsWith('#') ? colM[1].slice(0, 7) : `#${colM[1].slice(0, 6)}`;
            }
            if (typM) filamentPalette[fId].type = typM[1];
          }
        }
      } catch {
        // Ignora arquivo auxiliar ilegível
      }
    }

    if (lower.endsWith('model_settings.config')) {
      modelSettingsString = await zipEntry.async('string');
      try {
        const configDoc = parser.parseFromString(modelSettingsString, 'application/xml');

        // 1. Mapeamento de objetos e sub-partes (<object> e <part>)
        const configObjNodes = configDoc.getElementsByTagName('object');
        for (let o = 0; o < configObjNodes.length; o++) {
          const oNode = configObjNodes[o];
          const objId = oNode.getAttribute('id');
          if (!objId) continue;

          let targetPlateId = 0;
          let customName = '';
          let filId = 1;

          // Ler apenas metadados diretos de <object> primeiro
          for (let c = 0; c < oNode.children.length; c++) {
            const ch = oNode.children[c];
            if (ch.tagName === 'metadata') {
              const key = ch.getAttribute('key');
              const val = ch.getAttribute('value');
              if ((key === 'plate_id' || key === 'plater_id') && val) targetPlateId = parseInt(val, 10);
              if (key === 'name' && val) customName = val;
              if ((key === 'extruder' || key === 'filament_id' || key === 'tray_id') && val) {
                const parsed = parseInt(val, 10);
                if (parsed > 0) filId = parsed;
              }
            } else if (ch.tagName === 'part') {
              const partId = ch.getAttribute('id');
              let partExt = filId;
              const pMetas = ch.getElementsByTagName('metadata');
              for (let pm = 0; pm < pMetas.length; pm++) {
                const k = pMetas[pm].getAttribute('key');
                const v = pMetas[pm].getAttribute('value');
                if ((k === 'extruder' || k === 'filament_id' || k === 'tray_id') && v) {
                  const parsed = parseInt(v, 10);
                  if (parsed > 0) partExt = parsed;
                }
              }
              if (partId) {
                partFilamentMap[`${objId}_${partId}`] = partExt;
                if (!objectFilamentMap[partId]) {
                  objectFilamentMap[partId] = partExt;
                }
              }
            }
          }

          if (targetPlateId > 0) {
            objectToPlateMap[objId] = targetPlateId;
          }
          objectFilamentMap[objId] = filId;
          if (customName) objectNameMap[objId] = customName;
        }

        // 2. Mesas definidas em <plate> (Bambu Studio usa `plater_id`, `plater_name` e `<model_instance>`)
        const plateNodes = configDoc.getElementsByTagName('plate');
        for (let p = 0; p < plateNodes.length; p++) {
          const pNode = plateNodes[p];
          let pId = p + 1;
          let pName = '';

          for (let c = 0; c < pNode.children.length; c++) {
            const ch = pNode.children[c];
            if (ch.tagName === 'metadata') {
              const key = ch.getAttribute('key');
              const val = ch.getAttribute('value');
              if ((key === 'plater_id' || key === 'plate_id' || key === 'index') && val) {
                const parsed = parseInt(val, 10);
                if (parsed > 0) pId = parsed;
              }
              if ((key === 'plater_name' || key === 'plate_name') && val && val.trim()) {
                pName = val.trim();
              }
            } else if (ch.tagName === 'model_instance') {
              const instMetas = ch.getElementsByTagName('metadata');
              for (let im = 0; im < instMetas.length; im++) {
                const ik = instMetas[im].getAttribute('key');
                const iv = instMetas[im].getAttribute('value');
                if (ik === 'object_id' && iv) {
                  objectToPlateMap[iv] = pId;
                }
              }
            }
          }

          plateMap[pId] = {
            plateIndex: pId,
            name: pName ? `Mesa ${pId} - ${pName}` : `Mesa ${pId}`,
            objects: [],
          };
        }
      } catch (err) {
        console.warn('Erro ao processar model_settings.config:', err);
      }
    }
  }

  // Miniaturas de Mesas
  const plateThumbnailMap: Record<number, string> = {};
  let globalThumbnailUrl: string | undefined = undefined;

  for (const [path, zipEntry] of Object.entries(loadedZip.files)) {
    if (zipEntry.dir) continue;
    const lower = path.toLowerCase();
    if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
      if (lower.includes('no_light') || lower.includes(' pick_') || lower.includes('/pick_')) continue;
      const matchPlate = lower.match(/(?:plate|top)[_-]?(\d+)/i);
      if (matchPlate && matchPlate[1]) {
        const pIndex = parseInt(matchPlate[1], 10);
        if (!plateThumbnailMap[pIndex] || lower.includes('plate_')) {
          const blob = await zipEntry.async('blob');
          plateThumbnailMap[pIndex] = URL.createObjectURL(blob);
        }
      } else if (lower.includes('thumbnail') || lower.includes('cover')) {
        if (!globalThumbnailUrl) {
          const blob = await zipEntry.async('blob');
          globalThumbnailUrl = URL.createObjectURL(blob);
        }
      }
    }
  }

  // Associar objetos às mesas
  for (const buildItem of buildItems) {
    const objId = buildItem.objectId;
    const baseObj = rawObjects[objId];
    const name = objectNameMap[objId] || baseObj?.name || `Peça #${objId}`;

    let plateId = buildItem.plateId || objectToPlateMap[objId];
    if (!plateId || plateId < 1) plateId = 1;

    if (!plateMap[plateId]) {
      plateMap[plateId] = {
        plateIndex: plateId,
        name: `Mesa ${plateId}`,
        objects: [],
      };
    }

    if (!plateMap[plateId].objects.some((o) => o.id === objId)) {
      const filId = objectFilamentMap[objId] || 1;
      const colorHex =
        filamentPalette[filId]?.hex || DEFAULT_BAMBU_COLORS[(filId - 1) % DEFAULT_BAMBU_COLORS.length];
      plateMap[plateId].objects.push({
        id: objId,
        name,
        filamentId: String(filId),
        colorHex,
      });
    }
  }

  // Remover mesas vazias caso o projeto tenha definido pratos em branco no model_settings.config
  const nonEmptyPlates = Object.values(plateMap).filter((p) => p.objects.length > 0);
  if (nonEmptyPlates.length === 0) {
    const objList = Object.values(rawObjects);
    if (objList.length > 0) {
      objList.forEach((obj, idx) => {
        const pIdx = idx + 1;
        const filId = objectFilamentMap[obj.id] || 1;
        const colorHex =
          filamentPalette[filId]?.hex || DEFAULT_BAMBU_COLORS[(filId - 1) % DEFAULT_BAMBU_COLORS.length];
        plateMap[pIdx] = {
          plateIndex: pIdx,
          name: obj.name || `Mesa ${pIdx}`,
          objects: [{ id: obj.id, name: obj.name, filamentId: String(filId), colorHex }],
        };
      });
    }
  }

  const finalPlatesList = Object.values(plateMap).filter((p) => p.objects.length > 0);
  const sortedPlates = finalPlatesList
    .sort((a, b) => a.plateIndex - b.plateIndex)
    .map((plate) => ({
      ...plate,
      thumbnailUrl: plateThumbnailMap[plate.plateIndex] || globalThumbnailUrl,
    }));

  // Extrair sopa global de triângulos coloridos (incluindo `3D/Objects/*.model` e subdivisão `paint_color`)!
  const coloredSoup = await extractColoredSoupFrom3MfZip(
    loadedZip,
    modelXmlPath,
    filamentPalette,
    objectFilamentMap,
    partFilamentMap,
    DEFAULT_BAMBU_COLORS
  );

  // Construir peças 3D divididas por cor e fechadas (watertight)
  const splitParts = await buildSplitColorParts(
    coloredSoup,
    splitOptions,
    getColorNameFromHex,
    DEFAULT_BAMBU_COLORS
  );

  if (coloredSoup.hadPaintedTriangles && slicer === 'Padrão / Desconhecido') {
    slicer = 'Bambu Studio / OrcaSlicer';
  }

  const buildObjectIds = new Set(buildItems.map((b) => b.objectId));
  const rootObjList =
    buildObjectIds.size > 0
      ? Object.values(rawObjects).filter((o) => buildObjectIds.has(o.id))
      : Object.values(rawObjects);

  const allObjects: ParsedObjectInfo[] = rootObjList.map((obj) => ({
    id: obj.id,
    name: objectNameMap[obj.id] || obj.name,
    plateIndex: objectToPlateMap[obj.id] || 1,
  }));

  // Sincronizar `colorGroups` com as peças reais divididas (`splitParts`) para compatibilidade completa
  const colorGroups: ColorGroupInfo[] = splitParts.map((sp) => ({
    filamentId: sp.extruderId,
    colorHex: sp.colorHex,
    colorName: sp.colorName,
    filamentType: sp.filamentType,
    objects: [
      {
        id: sp.id,
        name: `${sp.name} (${sp.triangleCount.toLocaleString()} faces)`,
        filamentId: String(sp.extruderId),
        colorHex: sp.colorHex,
      },
    ],
  }));

  return {
    fileName: file.name,
    fileSizeBytes: file.size,
    inputFormat: '3mf',
    slicer,
    plates: sortedPlates,
    colorGroups,
    objects: allObjects,
    splitParts,
    coloredSoup,
    hadPaintedTriangles: coloredSoup.hadPaintedTriangles,
    totalTriangles: coloredSoup.indices.length / 3,
    globalThumbnailUrl,
    rawZip: loadedZip,
    modelXmlString,
    modelSettingsString,
  };
};

// Alias retrocompatível
export const parse3MFProject = parse3DModelProject;

/**
 * Coleta recursivamente IDs de objetos no XML principal e caminhos `p:path` de sub-modelos externos (`3D/Objects/*.model`)
 */
const collectObjectDependencies = (
  targetId: string,
  xmlDoc: Document,
  collectedIds: Set<string>,
  collectedExternalPaths: Set<string>
) => {
  if (collectedIds.has(targetId)) return;
  collectedIds.add(targetId);

  const objects = xmlDoc.getElementsByTagName('object');
  for (let i = 0; i < objects.length; i++) {
    const obj = objects[i];
    if (obj.getAttribute('id') === targetId) {
      const components = obj.getElementsByTagName('component');
      for (let c = 0; c < components.length; c++) {
        const comp = components[c];
        const extPath =
          comp.getAttribute('p:path') ||
          comp.getAttribute('path') ||
          comp.getAttributeNS('http://schemas.microsoft.com/3dmanufacturing/production/2015/06', 'path');
        const subId = comp.getAttribute('objectid');
        if (extPath) {
          collectedExternalPaths.add(extPath.replace(/^\/+/, '').toLowerCase());
        } else if (subId) {
          collectObjectDependencies(subId, xmlDoc, collectedIds, collectedExternalPaths);
        }
      }
      break;
    }
  }
};

/**
 * Gera um novo arquivo .3mf independente contendo apenas a mesa solicitada (preservando `3D/Objects/*.model` necessários)
 */
export const generatePlate3MF = async (
  project: ThreeMfProjectInfo,
  targetPlateIndex: number
): Promise<Blob> => {
  if (!project.rawZip || !project.modelXmlString) {
    throw new Error('Separação por mesas originais está disponível apenas para projetos .3MF.');
  }

  const targetPlate = project.plates.find((p) => p.plateIndex === targetPlateIndex);
  if (!targetPlate) {
    throw new Error(`Mesa #${targetPlateIndex} não encontrada no projeto.`);
  }

  const targetObjectIds = new Set(targetPlate.objects.map((o) => o.id));
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(project.modelXmlString, 'application/xml');

  const requiredObjectIds = new Set<string>();
  const requiredExternalPaths = new Set<string>();
  targetObjectIds.forEach((id) =>
    collectObjectDependencies(id, xmlDoc, requiredObjectIds, requiredExternalPaths)
  );

  const newZip = new JSZip();
  for (const [path, entry] of Object.entries(project.rawZip.files)) {
    if (entry.dir) continue;
    const lower = path.replace(/^\/+/, '').toLowerCase();

    // Omitir gcodes e miniaturas de outras mesas
    const otherPlateMatch = lower.match(/(?:plate|top|pick)[_-]?(\d+)/i);
    if (otherPlateMatch && otherPlateMatch[1]) {
      const pIdx = parseInt(otherPlateMatch[1], 10);
      if (pIdx !== targetPlateIndex) continue;
    }

    // Se for um sub-modelo em 3d/objects/, copiar apenas os referenciados pelos objetos desta mesa
    if (lower.startsWith('3d/objects/') && lower.endsWith('.model')) {
      if (requiredExternalPaths.size > 0 && !requiredExternalPaths.has(lower)) {
        continue;
      }
    }

    const data = await entry.async('uint8array');
    newZip.file(path, data);
  }

  const buildNodes = xmlDoc.getElementsByTagName('build');
  if (buildNodes.length > 0) {
    const build = buildNodes[0];
    const items = Array.from(build.getElementsByTagName('item'));
    for (const item of items) {
      const objId = item.getAttribute('objectid');
      if (!objId || !targetObjectIds.has(objId)) {
        build.removeChild(item);
      }
    }
  }

  const resourcesNodes = xmlDoc.getElementsByTagName('resources');
  if (resourcesNodes.length > 0) {
    const resources = resourcesNodes[0];
    const objects = Array.from(resources.getElementsByTagName('object'));
    for (const obj of objects) {
      const objId = obj.getAttribute('id');
      if (objId && !requiredObjectIds.has(objId)) {
        resources.removeChild(obj);
      }
    }
  }

  const serializer = new XMLSerializer();
  const updatedXml = serializer.serializeToString(xmlDoc);

  for (const path of Object.keys(newZip.files)) {
    if (path.toLowerCase().endsWith('3d/3dmodel.model') || path.toLowerCase().endsWith('3dmodel.model')) {
      newZip.file(path, updatedXml);
      break;
    }
  }

  if (project.modelSettingsString) {
    try {
      const configDoc = parser.parseFromString(project.modelSettingsString, 'application/xml');
      const plateNodes = Array.from(configDoc.getElementsByTagName('plate'));
      plateNodes.forEach((pNode, idx) => {
        let pId = idx + 1;
        const metas = pNode.getElementsByTagName('metadata');
        for (let m = 0; m < metas.length; m++) {
          const k = metas[m].getAttribute('key');
          if (k === 'plater_id' || k === 'plate_id') {
            pId = parseInt(metas[m].getAttribute('value') || String(pId), 10);
          }
        }
        if (pId !== targetPlateIndex) {
          pNode.parentNode?.removeChild(pNode);
        } else {
          // Renumerar mesa única resultante para plater_id = 1
          for (let m = 0; m < metas.length; m++) {
            const k = metas[m].getAttribute('key');
            if (k === 'plater_id' || k === 'plate_id') {
              metas[m].setAttribute('value', '1');
            }
          }
        }
      });

      const objNodes = Array.from(configDoc.getElementsByTagName('object'));
      for (const oNode of objNodes) {
        const objId = oNode.getAttribute('id');
        if (objId && !requiredObjectIds.has(objId)) {
          oNode.parentNode?.removeChild(oNode);
        }
      }

      const updatedConfig = serializer.serializeToString(configDoc);
      for (const path of Object.keys(newZip.files)) {
        if (path.toLowerCase().endsWith('model_settings.config')) {
          newZip.file(path, updatedConfig);
          break;
        }
      }
    } catch (e) {
      console.warn('Aviso: falha ao atualizar model_settings.config no split de mesa:', e);
    }
  }

  return await newZip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
};

/**
 * Gera um novo arquivo .3mf independente contendo apenas um objeto raiz específico
 */
export const generateObject3MF = async (
  project: ThreeMfProjectInfo,
  targetObjectId: string
): Promise<Blob> => {
  if (!project.rawZip || !project.modelXmlString) {
    // Fallback para projetos STL/OBJ
    const firstPart = project.splitParts[0];
    if (!firstPart) throw new Error('Objeto não encontrado.');
    return await exportSplitPartTo3MF(firstPart, false);
  }

  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(project.modelXmlString, 'application/xml');

  const requiredObjectIds = new Set<string>();
  const requiredExternalPaths = new Set<string>();
  collectObjectDependencies(targetObjectId, xmlDoc, requiredObjectIds, requiredExternalPaths);

  const newZip = new JSZip();
  for (const [path, entry] of Object.entries(project.rawZip.files)) {
    if (entry.dir) continue;
    const lower = path.replace(/^\/+/, '').toLowerCase();
    if (lower.startsWith('3d/objects/') && lower.endsWith('.model')) {
      if (requiredExternalPaths.size > 0 && !requiredExternalPaths.has(lower)) {
        continue;
      }
    }
    const data = await entry.async('uint8array');
    newZip.file(path, data);
  }

  const buildNodes = xmlDoc.getElementsByTagName('build');
  if (buildNodes.length > 0) {
    const build = buildNodes[0];
    const items = Array.from(build.getElementsByTagName('item'));
    for (const item of items) {
      const objId = item.getAttribute('objectid');
      if (objId !== targetObjectId) {
        build.removeChild(item);
      }
    }
  }

  const resourcesNodes = xmlDoc.getElementsByTagName('resources');
  if (resourcesNodes.length > 0) {
    const resources = resourcesNodes[0];
    const objects = Array.from(resources.getElementsByTagName('object'));
    for (const obj of objects) {
      const objId = obj.getAttribute('id');
      if (objId && !requiredObjectIds.has(objId)) {
        resources.removeChild(obj);
      }
    }
  }

  const serializer = new XMLSerializer();
  const updatedXml = serializer.serializeToString(xmlDoc);

  for (const path of Object.keys(newZip.files)) {
    if (path.toLowerCase().endsWith('3d/3dmodel.model') || path.toLowerCase().endsWith('3dmodel.model')) {
      newZip.file(path, updatedXml);
      break;
    }
  }

  return await newZip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
};

/**
 * Gera um arquivo ZIP contendo todas as mesas originais divididas como arquivos .3mf individuais
 */
export const generateAllPlatesZip = async (
  project: ThreeMfProjectInfo,
  onProgress?: (percent: number, currentPlate: string) => void
): Promise<Blob> => {
  const masterZip = new JSZip();
  const total = project.plates.length;
  const baseName = project.fileName.replace(/\.(3mf|stl|obj)$/i, '');

  for (let i = 0; i < total; i++) {
    const plate = project.plates[i];
    if (onProgress) {
      onProgress(Math.round((i / total) * 100), plate.name);
    }

    const plateBlob = await generatePlate3MF(project, plate.plateIndex);
    const cleanPlateName = plate.name.replace(/^(mesa|plate)\s*\d+[\s:_-]*/i, '').trim();
    const suffix = cleanPlateName ? `_${cleanPlateName}` : '';
    const plateFileName = sanitizeFileName(`${baseName}_Mesa_${plate.plateIndex}${suffix}.3mf`);
    masterZip.file(plateFileName, plateBlob);
  }

  if (onProgress) {
    onProgress(100, 'Empacotando arquivo ZIP final...');
  }

  return await masterZip.generateAsync({
    type: 'blob',
    mimeType: 'application/zip',
    compression: 'DEFLATE',
    compressionOptions: { level: 4 },
  });
};

/**
 * Gera um pacote `.zip` com TODAS as peças divididas por cor/corte (`SplitPartMesh[]`),
 * suportando exportação individual em `.3mf` ou `.stl` (igual ao split3mf.com)!
 */
export const generateAllSplitPartsZip = async (
  parts: ReadonlyArray<SplitPartMesh>,
  originalFileName: string,
  format: '3mf' | 'stl' = '3mf',
  keepAssemblyPosition = true,
  onProgress?: (percent: number, currentPartName: string) => void
): Promise<Blob> => {
  const visibleParts = parts.filter((p) => p.visible && p.triangleCount > 0);
  if (visibleParts.length === 0) {
    throw new Error('Nenhuma peça visível selecionada para exportar.');
  }

  const masterZip = new JSZip();
  const baseName = originalFileName.replace(/\.(3mf|stl|obj)$/i, '').trim();
  const total = visibleParts.length;

  for (let i = 0; i < total; i++) {
    const part = visibleParts[i];
    if (onProgress) {
      onProgress(Math.round((i / total) * 100), part.name);
    }

    const partBlob =
      format === 'stl'
        ? exportSplitPartToSTL(part, keepAssemblyPosition)
        : await exportSplitPartTo3MF(part, keepAssemblyPosition);

    const ext = format === 'stl' ? 'stl' : '3mf';
    const fileName = sanitizeFileName(`${baseName}_${i + 1}_${part.name}.${ext}`);
    masterZip.file(fileName, partBlob);
  }

  if (onProgress) {
    onProgress(100, 'Compactando pacote ZIP...');
  }

  return await masterZip.generateAsync({
    type: 'blob',
    mimeType: 'application/zip',
    compression: 'DEFLATE',
    compressionOptions: { level: 5 },
  });
};

/**
 * Retrocompatibilidade para exportação de grupo de cor único
 */
export const generateColor3MF = async (
  project: ThreeMfProjectInfo,
  colorGroup: ColorGroupInfo
): Promise<Blob> => {
  const matchingPart =
    project.splitParts.find((p) => p.id === colorGroup.objects[0]?.id) ||
    project.splitParts.find((p) => p.extruderId === colorGroup.filamentId);
  if (!matchingPart) {
    throw new Error(`Malha da cor ${colorGroup.colorName} não encontrada.`);
  }
  return await exportSplitPartTo3MF(matchingPart, true);
};

export const generateAllColorsZip = async (
  project: ThreeMfProjectInfo,
  onProgress?: (percent: number, currentColor: string) => void
): Promise<Blob> => {
  return await generateAllSplitPartsZip(project.splitParts, project.fileName, '3mf', true, onProgress);
};
