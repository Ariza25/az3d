import JSZip from 'jszip';
import { saveAs } from 'file-saver';

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
  slicer: 'Bambu Studio / OrcaSlicer' | 'PrusaSlicer' | 'Padrão / Desconhecido';
  plates: PlateInfo[];
  colorGroups: ColorGroupInfo[];
  objects: ParsedObjectInfo[];
  globalThumbnailUrl?: string;
  rawZip: JSZip;
  modelXmlString: string;
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

/**
 * Heurísticas de detecção de cores por palavras-chave no nome do objeto
 */
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

/**
 * Normaliza nomes de arquivos para evitar caracteres inválidos no download
 */
export const sanitizeFileName = (name: string): string => {
  return name
    .replace(/[\\/:*?"<>|\x00-\x1F\x7F]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Dispara o download de um Blob no navegador com compatibilidade estrita no Chrome/Edge/Firefox
 */
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
 * Analisa e extrai todas as informações de mesas, objetos e miniaturas de um .3mf
 */
export const parse3MFProject = async (file: File): Promise<ThreeMfProjectInfo> => {
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(file);

  // 1. Encontrar o 3D Model XML
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

  // 2. Extrair objetos base do 3dmodel.model
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

  // Itens na tag <build>
  const buildItems: Array<{ objectId: string; plateId?: number }> = [];
  const buildNodes = xmlDoc.getElementsByTagName('build');
  if (buildNodes.length > 0) {
    const itemNodes = buildNodes[0].getElementsByTagName('item');
    for (let i = 0; i < itemNodes.length; i++) {
      const item = itemNodes[i];
      const objectId = item.getAttribute('objectid');
      if (objectId) {
        // Alguns fatiadores colocam plate_id direto no <item>
        const plateAttr = item.getAttribute('plate_id') ||
          item.getAttribute('BambuStudio:plate_id') ||
          item.getAttribute('slic3r:plate_id');
        buildItems.push({
          objectId,
          plateId: plateAttr ? parseInt(plateAttr, 10) : undefined,
        });
      }
    }
  }

  // 3. Procurar metadados do Bambu Studio / OrcaSlicer (model_settings.config ou slice_info.config)
  let slicer: ThreeMfProjectInfo['slicer'] = 'Padrão / Desconhecido';
  let modelSettingsString: string | undefined = undefined;
  const plateMap: Record<number, PlateInfo> = {};
  const objectToPlateMap: Record<string, number> = {};
  const objectNameMap: Record<string, string> = {};
  const objectFilamentMap: Record<string, number> = {};
  const filamentPalette: Record<number, { hex: string; type?: string }> = {};

  for (const [path, zipEntry] of Object.entries(loadedZip.files)) {
    const lower = path.toLowerCase();
    if (lower.includes('bambustudio') || lower.includes('orcaslicer') || lower.includes('model_settings.config')) {
      slicer = 'Bambu Studio / OrcaSlicer';
    } else if (lower.includes('prusaslicer') || lower.includes('slic3r')) {
      slicer = 'PrusaSlicer';
    }

    // Extrair tabela de cores dos arquivos de configuração e metadados
    if (lower.endsWith('.config') || lower.endsWith('.json') || lower.endsWith('.xml')) {
      try {
        const text = await zipEntry.async('string');

        // Regex para filament_colour
        const hexMatch = text.match(/key=["']filament_colours?["']\s+value=["']([^"']+)["']/i) ||
          text.match(/["']filament_colours?["']\s*:\s*\[([^\]]+)\]/i) ||
          text.match(/filament_colours?\s*=\s*([^\r\n]+)/i);

        if (hexMatch && hexMatch[1]) {
          const colors = hexMatch[1]
            .split(/[,;]/)
            .map((c) => c.replace(/["'\s]/g, '').trim())
            .filter((c) => /^#?[0-9a-fA-F]{6,8}$/.test(c));

          colors.forEach((c, idx) => {
            const fId = idx + 1;
            const fullHex = c.startsWith('#') ? c : `#${c}`;
            if (!filamentPalette[fId]) {
              filamentPalette[fId] = { hex: fullHex };
            } else {
              filamentPalette[fId].hex = fullHex;
            }
          });
        }

        // Regex para filament_type
        const typeMatch = text.match(/key=["']filament_types?["']\s+value=["']([^"']+)["']/i) ||
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

        // Tags <filament id="1" color="#..." type="..." />
        const filTagRegex = /<filament\s+([^>]+)>/gi;
        let filM;
        while ((filM = filTagRegex.exec(text)) !== null) {
          const attrs = filM[1];
          const idM = attrs.match(/id=["'](\d+)["']/i);
          const colM = attrs.match(/color=["']([^"']+)["']/i);
          const typM = attrs.match(/type=["']([^"']+)["']/i);
          if (idM && idM[1]) {
            const fId = parseInt(idM[1], 10);
            if (!filamentPalette[fId]) {
              filamentPalette[fId] = {
                hex: colM ? (colM[1].startsWith('#') ? colM[1] : `#${colM[1]}`) : DEFAULT_BAMBU_COLORS[(fId - 1) % DEFAULT_BAMBU_COLORS.length],
              };
            }
            if (colM) filamentPalette[fId].hex = colM[1].startsWith('#') ? colM[1] : `#${colM[1]}`;
            if (typM) filamentPalette[fId].type = typM[1];
          }
        }
      } catch (e) {
        // ignora
      }
    }

    if (lower.endsWith('model_settings.config') || lower.endsWith('project_settings.config')) {
      modelSettingsString = await zipEntry.async('string');
      try {
        const configDoc = parser.parseFromString(modelSettingsString, 'application/xml');
        // Mesas definidas em <plate>
        const plateNodes = configDoc.getElementsByTagName('plate');
        for (let p = 0; p < plateNodes.length; p++) {
          const pNode = plateNodes[p];
          let pId = p + 1;
          let pName = `Mesa ${pId}`;

          const metas = pNode.getElementsByTagName('metadata');
          for (let m = 0; m < metas.length; m++) {
            const key = metas[m].getAttribute('key');
            const val = metas[m].getAttribute('value');
            if (key === 'plate_id' && val) pId = parseInt(val, 10);
            if (key === 'plate_name' && val) pName = val;
            if (key === 'index' && val && !pId) pId = parseInt(val, 10);
          }

          plateMap[pId] = {
            plateIndex: pId,
            name: pName,
            objects: [],
          };
        }

        // Mapeamento de objetos em <object>
        const configObjNodes = configDoc.getElementsByTagName('object');
        for (let o = 0; o < configObjNodes.length; o++) {
          const oNode = configObjNodes[o];
          const objId = oNode.getAttribute('id');
          if (!objId) continue;

          let targetPlateId = 1;
          let customName = '';
          let filId = 1;
          const metas = oNode.getElementsByTagName('metadata');
          for (let m = 0; m < metas.length; m++) {
            const key = metas[m].getAttribute('key');
            const val = metas[m].getAttribute('value');
            if (key === 'plate_id' && val) targetPlateId = parseInt(val, 10);
            if (key === 'name' && val) customName = val;
            if ((key === 'filament_id' || key === 'tray_id') && val) filId = parseInt(val, 10);
          }

          // Partes filhas também podem ter filament_id
          const partNodes = oNode.getElementsByTagName('part');
          for (let p = 0; p < partNodes.length; p++) {
            const pMetas = partNodes[p].getElementsByTagName('metadata');
            for (let pm = 0; pm < pMetas.length; pm++) {
              const k = pMetas[pm].getAttribute('key');
              const v = pMetas[pm].getAttribute('value');
              if ((k === 'filament_id' || k === 'tray_id') && v) filId = parseInt(v, 10);
            }
          }

          objectToPlateMap[objId] = targetPlateId;
          objectFilamentMap[objId] = filId;
          if (customName) objectNameMap[objId] = customName;
        }
      } catch (err) {
        console.warn('Erro ao processar model_settings.config:', err);
      }
    }
  }

  // 4. Procurar Miniaturas de Mesas (Metadata/plate_X.png, top_X.png ou pick_X.png)
  const plateThumbnailMap: Record<number, string> = {};
  let globalThumbnailUrl: string | undefined = undefined;

  for (const [path, zipEntry] of Object.entries(loadedZip.files)) {
    const lower = path.toLowerCase();
    if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
      const matchPlate = lower.match(/(?:plate|top|pick)[_-]?(\d+)/i);
      if (matchPlate && matchPlate[1]) {
        const pIndex = parseInt(matchPlate[1], 10);
        if (!plateThumbnailMap[pIndex]) {
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

  // 5. Associar objetos às mesas
  for (const buildItem of buildItems) {
    const objId = buildItem.objectId;
    const baseObj = rawObjects[objId];
    const name = objectNameMap[objId] || baseObj?.name || `Peça #${objId}`;

    let plateId = buildItem.plateId || objectToPlateMap[objId];
    if (!plateId || plateId < 1) {
      plateId = 1;
    }

    if (!plateMap[plateId]) {
      plateMap[plateId] = {
        plateIndex: plateId,
        name: `Mesa ${plateId}`,
        objects: [],
      };
    }

    if (!plateMap[plateId].objects.some((o) => o.id === objId)) {
      const filId = objectFilamentMap[objId] || 1;
      const colorHex = filamentPalette[filId]?.hex || DEFAULT_BAMBU_COLORS[(filId - 1) % DEFAULT_BAMBU_COLORS.length];
      plateMap[plateId].objects.push({
        id: objId,
        name,
        filamentId: String(filId),
        colorHex,
      });
    }
  }

  // Se não houver mesas mapeadas, criamos mesas pelos objetos
  if (Object.keys(plateMap).length === 0) {
    const objList = Object.values(rawObjects);
    if (objList.length > 0) {
      objList.forEach((obj, idx) => {
        const pIdx = idx + 1;
        const filId = objectFilamentMap[obj.id] || 1;
        const colorHex = filamentPalette[filId]?.hex || DEFAULT_BAMBU_COLORS[(filId - 1) % DEFAULT_BAMBU_COLORS.length];
        plateMap[pIdx] = {
          plateIndex: pIdx,
          name: obj.name || `Mesa ${pIdx}`,
          objects: [{ id: obj.id, name: obj.name, filamentId: String(filId), colorHex }],
        };
      });
    } else {
      plateMap[1] = {
        plateIndex: 1,
        name: 'Mesa 1 (Padrão)',
        objects: [{ id: '1', name: 'Modelo 3D', filamentId: '1', colorHex: DEFAULT_BAMBU_COLORS[0] }],
      };
    }
  }

  // Injetar miniaturas nas mesas
  const sortedPlates = Object.values(plateMap)
    .sort((a, b) => a.plateIndex - b.plateIndex)
    .map((plate) => ({
      ...plate,
      thumbnailUrl: plateThumbnailMap[plate.plateIndex] || globalThumbnailUrl,
    }));

  const allObjects: ParsedObjectInfo[] = Object.values(rawObjects).map((obj) => ({
    id: obj.id,
    name: objectNameMap[obj.id] || obj.name,
    plateIndex: objectToPlateMap[obj.id],
  }));

  // 6. Construir Grupos de Cores / Filamentos
  const colorGroupMap: Record<string, ColorGroupInfo> = {};
  const buildObjectIds = new Set(buildItems.map((b) => b.objectId));
  const activeObjects = buildObjectIds.size > 0
    ? Object.entries(rawObjects).filter(([id]) => buildObjectIds.has(id))
    : Object.entries(rawObjects);

  // Analisar se todos os objetos caíram no mesmo filamento
  const distinctFilaments = new Set(Object.values(objectFilamentMap));
  const hasMultipleFilamentIds = distinctFilaments.size > 1;

  for (const [objId, baseObj] of activeObjects) {
    const name = objectNameMap[objId] || baseObj.name || `Peça #${objId}`;
    let filamentId = objectFilamentMap[objId] || 1;
    let colorHex = filamentPalette[filamentId]?.hex;
    let colorType = filamentPalette[filamentId]?.type || 'PLA';
    let colorName = '';

    // Se o filamento não tem cor mapeada ou se todas as peças caíram no filamento padrão 1,
    // verifica se o nome da peça contém uma cor descritiva (muito comum em modelos baixados)
    const keywordMatch = COLOR_KEYWORDS.find((kw) => kw.match.test(name));

    if ((!hasMultipleFilamentIds && keywordMatch) || !colorHex) {
      if (keywordMatch) {
        colorHex = keywordMatch.hex;
        colorName = keywordMatch.name;
        filamentId = 100 + COLOR_KEYWORDS.indexOf(keywordMatch) + 1;
      } else {
        colorHex = DEFAULT_BAMBU_COLORS[(filamentId - 1) % DEFAULT_BAMBU_COLORS.length];
        colorName = getColorNameFromHex(colorHex);
      }
    } else {
      colorName = getColorNameFromHex(colorHex);
    }

    const groupKey = `${filamentId}_${colorHex.toUpperCase()}`;
    if (!colorGroupMap[groupKey]) {
      colorGroupMap[groupKey] = {
        filamentId,
        colorHex,
        colorName,
        filamentType: colorType,
        objects: [],
      };
    }

    colorGroupMap[groupKey].objects.push({
      id: objId,
      name,
      filamentId: String(filamentId),
      colorHex,
    });
  }

  const colorGroups = Object.values(colorGroupMap).sort((a, b) => a.filamentId - b.filamentId);

  return {
    fileName: file.name,
    fileSizeBytes: file.size,
    slicer,
    plates: sortedPlates,
    colorGroups,
    objects: allObjects,
    globalThumbnailUrl,
    rawZip: loadedZip,
    modelXmlString,
    modelSettingsString,
  };
};

/**
 * Coleta recursivamente todos os IDs de objetos necessários (incluindo subcomponentes de montagens)
 */
const collectObjectIdsRecursively = (
  targetId: string,
  xmlDoc: Document,
  collected: Set<string>
) => {
  if (collected.has(targetId)) return;
  collected.add(targetId);

  const objects = xmlDoc.getElementsByTagName('object');
  for (let i = 0; i < objects.length; i++) {
    const obj = objects[i];
    if (obj.getAttribute('id') === targetId) {
      const components = obj.getElementsByTagName('component');
      for (let c = 0; c < components.length; c++) {
        const subId = components[c].getAttribute('objectid');
        if (subId) {
          collectObjectIdsRecursively(subId, xmlDoc, collected);
        }
      }
      break;
    }
  }
};

/**
 * Gera um novo arquivo .3mf independente contendo apenas a mesa solicitada
 */
export const generatePlate3MF = async (
  project: ThreeMfProjectInfo,
  targetPlateIndex: number
): Promise<Blob> => {
  const targetPlate = project.plates.find((p) => p.plateIndex === targetPlateIndex);
  if (!targetPlate) {
    throw new Error(`Mesa #${targetPlateIndex} não encontrada no projeto.`);
  }

  const targetObjectIds = new Set(targetPlate.objects.map((o) => o.id));

  // Criar clone do ZIP
  const newZip = new JSZip();
  for (const [path, entry] of Object.entries(project.rawZip.files)) {
    if (entry.dir) continue;
    // Omitir gcodes e imagens de outras mesas para deixar o arquivo leve e limpo
    const lower = path.toLowerCase();
    const otherPlateMatch = lower.match(/(?:plate|top|pick)[_-]?(\d+)/i);
    if (otherPlateMatch && otherPlateMatch[1]) {
      const pIdx = parseInt(otherPlateMatch[1], 10);
      if (pIdx !== targetPlateIndex) {
        continue;
      }
    }
    const data = await entry.async('uint8array');
    newZip.file(path, data);
  }

  // Atualizar 3D/3dmodel.model
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(project.modelXmlString, 'application/xml');

  // Identificar todos os object IDs necessários para esta mesa
  const requiredObjectIds = new Set<string>();
  targetObjectIds.forEach((id) => collectObjectIdsRecursively(id, xmlDoc, requiredObjectIds));

  // Filtrar <build> para incluir somente itens pertencentes a esta mesa
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

  // Filtrar <resources> para remover objetos não utilizados
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

  // Sobrescrever 3D/3dmodel.model no novo ZIP
  for (const path of Object.keys(newZip.files)) {
    if (path.toLowerCase().endsWith('3d/3dmodel.model') || path.toLowerCase().endsWith('3dmodel.model')) {
      newZip.file(path, updatedXml);
      break;
    }
  }

  // Se houver model_settings.config, filtrar apenas a mesa e objetos correspondentes
  if (project.modelSettingsString) {
    try {
      const configDoc = parser.parseFromString(project.modelSettingsString, 'application/xml');
      const plateNodes = Array.from(configDoc.getElementsByTagName('plate'));
      for (const pNode of plateNodes) {
        let pId = 1;
        const metas = pNode.getElementsByTagName('metadata');
        for (let m = 0; m < metas.length; m++) {
          if (metas[m].getAttribute('key') === 'plate_id') {
            pId = parseInt(metas[m].getAttribute('value') || '1', 10);
          }
        }
        if (pId !== targetPlateIndex) {
          pNode.parentNode?.removeChild(pNode);
        }
      }

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
      console.warn('Aviso: falha ao atualizar model_settings.config no split:', e);
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
 * Gera um novo arquivo .3mf independente contendo apenas um objeto/peça específica
 */
export const generateObject3MF = async (
  project: ThreeMfProjectInfo,
  targetObjectId: string
): Promise<Blob> => {
  const newZip = new JSZip();
  for (const [path, entry] of Object.entries(project.rawZip.files)) {
    if (entry.dir) continue;
    const data = await entry.async('uint8array');
    newZip.file(path, data);
  }

  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(project.modelXmlString, 'application/xml');

  const requiredObjectIds = new Set<string>();
  collectObjectIdsRecursively(targetObjectId, xmlDoc, requiredObjectIds);

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
 * Gera um arquivo ZIP contendo todas as mesas divididas como arquivos .3mf individuais
 */
export const generateAllPlatesZip = async (
  project: ThreeMfProjectInfo,
  onProgress?: (percent: number, currentPlate: string) => void
): Promise<Blob> => {
  const masterZip = new JSZip();
  const total = project.plates.length;

  const baseBaseName = project.fileName.replace(/\.3mf$/i, '');

  for (let i = 0; i < total; i++) {
    const plate = project.plates[i];
    if (onProgress) {
      onProgress(Math.round(((i) / total) * 100), plate.name);
    }

    const plateBlob = await generatePlate3MF(project, plate.plateIndex);
    const cleanPlateName = plate.name.replace(/^(mesa|plate)\s*\d+[:_-]?\s*/i, '').trim();
    const suffix = cleanPlateName ? `_${cleanPlateName}` : '';
    const plateFileName = sanitizeFileName(`${baseBaseName}_Mesa_${plate.plateIndex}${suffix}.3mf`);
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
 * Gera um novo arquivo .3mf independente contendo apenas as peças de uma cor/filamento específico
 */
export const generateColor3MF = async (
  project: ThreeMfProjectInfo,
  colorGroup: ColorGroupInfo
): Promise<Blob> => {
  const targetObjectIds = new Set(colorGroup.objects.map((o) => o.id));
  const newZip = new JSZip();

  // Copiar arquivos originais, ignorando miniaturas de mesas antigas para deixar o arquivo leve
  for (const [path, entry] of Object.entries(project.rawZip.files)) {
    if (entry.dir) continue;
    const lower = path.toLowerCase();
    if (lower.match(/(?:plate|top|pick)[_-]?(\d+)/i)) {
      continue;
    }
    const data = await entry.async('uint8array');
    newZip.file(path, data);
  }

  // Atualizar 3D/3dmodel.model
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(project.modelXmlString, 'application/xml');

  // Identificar todos os object IDs necessários para esta cor
  const requiredObjectIds = new Set<string>();
  targetObjectIds.forEach((id) => collectObjectIdsRecursively(id, xmlDoc, requiredObjectIds));

  // Filtrar <build> para incluir somente itens pertencentes a esta cor
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

  // Filtrar <resources> para remover objetos não utilizados
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

  // Sobrescrever 3D/3dmodel.model no novo ZIP
  for (const path of Object.keys(newZip.files)) {
    if (path.toLowerCase().endsWith('3d/3dmodel.model') || path.toLowerCase().endsWith('3dmodel.model')) {
      newZip.file(path, updatedXml);
      break;
    }
  }

  // Se houver model_settings.config, configurar uma única mesa associada à cor
  if (project.modelSettingsString) {
    try {
      const configDoc = parser.parseFromString(project.modelSettingsString, 'application/xml');
      const plateNodes = Array.from(configDoc.getElementsByTagName('plate'));
      for (let i = 0; i < plateNodes.length; i++) {
        if (i === 0) {
          const pNode = plateNodes[0];
          const metas = Array.from(pNode.getElementsByTagName('metadata'));
          metas.forEach((m) => pNode.removeChild(m));

          const mId = configDoc.createElement('metadata');
          mId.setAttribute('key', 'plate_id');
          mId.setAttribute('value', '1');
          pNode.appendChild(mId);

          const mName = configDoc.createElement('metadata');
          mName.setAttribute('key', 'plate_name');
          mName.setAttribute('value', `Mesa - ${colorGroup.colorName}`);
          pNode.appendChild(mName);

          const mFil = configDoc.createElement('metadata');
          mFil.setAttribute('key', 'filament_id');
          mFil.setAttribute('value', String(colorGroup.filamentId));
          pNode.appendChild(mFil);
        } else {
          plateNodes[i].parentNode?.removeChild(plateNodes[i]);
        }
      }

      const objNodes = Array.from(configDoc.getElementsByTagName('object'));
      for (const oNode of objNodes) {
        const objId = oNode.getAttribute('id');
        if (objId && !requiredObjectIds.has(objId)) {
          oNode.parentNode?.removeChild(oNode);
        } else if (objId) {
          const metas = Array.from(oNode.getElementsByTagName('metadata'));
          let hasPlate = false;
          let hasFilament = false;
          metas.forEach((m) => {
            if (m.getAttribute('key') === 'plate_id') {
              m.setAttribute('value', '1');
              hasPlate = true;
            }
            if (m.getAttribute('key') === 'filament_id') {
              m.setAttribute('value', String(colorGroup.filamentId));
              hasFilament = true;
            }
          });
          if (!hasPlate) {
            const mPlate = configDoc.createElement('metadata');
            mPlate.setAttribute('key', 'plate_id');
            mPlate.setAttribute('value', '1');
            oNode.appendChild(mPlate);
          }
          if (!hasFilament) {
            const mFil = configDoc.createElement('metadata');
            mFil.setAttribute('key', 'filament_id');
            mFil.setAttribute('value', String(colorGroup.filamentId));
            oNode.appendChild(mFil);
          }
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
      console.warn('Aviso: falha ao atualizar model_settings.config no split por cor:', e);
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
 * Gera um arquivo ZIP contendo todas as cores divididas como arquivos .3mf individuais
 */
export const generateAllColorsZip = async (
  project: ThreeMfProjectInfo,
  onProgress?: (percent: number, currentColor: string) => void
): Promise<Blob> => {
  const masterZip = new JSZip();
  const total = project.colorGroups.length;
  const baseBaseName = project.fileName.replace(/\.3mf$/i, '').trim();

  for (let i = 0; i < total; i++) {
    const cg = project.colorGroups[i];
    if (onProgress) {
      onProgress(Math.round(((i) / total) * 100), `${cg.colorName} (${cg.colorHex})`);
    }

    const colorBlob = await generateColor3MF(project, cg);
    const colorFileName = sanitizeFileName(`${baseBaseName}_Mesa_Cor_${cg.filamentId}_${cg.colorName}.3mf`);
    masterZip.file(colorFileName, colorBlob);
  }

  if (onProgress) {
    onProgress(100, 'Empacotando arquivo ZIP das cores...');
  }

  return await masterZip.generateAsync({
    type: 'blob',
    mimeType: 'application/zip',
    compression: 'DEFLATE',
    compressionOptions: { level: 4 },
  });
};
