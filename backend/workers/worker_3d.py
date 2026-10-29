"""
AZ3D - Worker Local de IA 3D (RTX 4060 / CUDA)
======================================================
Este microserviço roda no seu computador pessoal com placa NVIDIA.
Ele recebe imagens do painel AZ3D e gera modelos 3D volumétricos completos (.3mf / .stl)
utilizando a aceleração de hardware da sua GPU com pré-processamento de silhueta,
centralização 1:1, remoção de artefatos flutuantes e suavização Taubin.
"""

import io
import json
import os
import sys
import time
import zipfile
from typing import List, Optional, Tuple

import numpy as np

# Garantir saída UTF-8 no Windows PowerShell/CMD
try:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from PIL import Image, ImageFilter

app = FastAPI(title="AZ3D Local 3D AI Worker", version="2.0.0")

# Permitir CORS para o painel admin AZ3D
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Faces", "X-Vertices", "X-Height-Mm", "X-Colors", "X-Bg-Method"],
)

# Checagem de Hardware e CUDA
DEVICE = "cpu"
GPU_NAME = "CPU (Sem aceleração CUDA)"
VRAM_TOTAL_GB = 0.0

try:
    import torch

    if torch.cuda.is_available():
        DEVICE = "cuda"
        GPU_NAME = torch.cuda.get_device_name(0)
        VRAM_TOTAL_GB = round(torch.cuda.get_device_properties(0).total_memory / (1024 ** 3), 2)
        print(f"✅ GPU Detectada: {GPU_NAME} ({VRAM_TOTAL_GB} GB VRAM)")
    else:
        print("⚠️ CUDA não está disponível. Rodando em modo CPU.")
except Exception as e:
    print(f"⚠️ Erro ao inicializar PyTorch: {e}")

REMBG_AVAILABLE = False
REMBG_SESSION = None
try:
    import rembg

    REMBG_AVAILABLE = True
except Exception:
    REMBG_AVAILABLE = False

MODEL = None
TRIPOSR_AVAILABLE = False

triposr_dir = os.path.join(os.path.dirname(__file__), "TripoSR")
if triposr_dir not in sys.path:
    sys.path.insert(0, triposr_dir)

try:
    from tsr.system import TSR

    TRIPOSR_AVAILABLE = True
    print("🚀 TripoSR carregado com sucesso no worker!")
except Exception as e:
    print(f"⚠️ TripoSR não pôde ser importado: {e}")
    TRIPOSR_AVAILABLE = False


def get_rembg_session():
    global REMBG_SESSION
    if not REMBG_AVAILABLE:
        return None
    if REMBG_SESSION is None:
        try:
            import rembg

            REMBG_SESSION = rembg.new_session()
        except Exception as err:
            print(f"⚠️ Falha ao iniciar sessão rembg: {err}")
            return None
    return REMBG_SESSION


def _ensure_triposr_isosurface_fix():
    """Garante convenção (z, y, x) e normais externas CCW no fallback skimage de MarchingCubeHelper."""
    try:
        import torchmcubes  # noqa: F401
    except ImportError:
        import tsr.models.isosurface as iso_mod
        from skimage.measure import marching_cubes as sk_mc

        def _fixed_marching_cubes(volume, level=0.0):
            vol_np = volume.detach().cpu().numpy()
            v, f, _, _ = sk_mc(vol_np, level=level)
            v = v[:, [2, 1, 0]]
            return torch.from_numpy(v.copy()).float(), torch.from_numpy(f.copy()).long()

        iso_mod.marching_cubes = _fixed_marching_cubes


def load_triposr_model():
    """Carrega o modelo TripoSR para a memória da GPU RTX"""
    global MODEL
    if MODEL is not None:
        return MODEL
    if not TRIPOSR_AVAILABLE:
        return None

    try:
        _ensure_triposr_isosurface_fix()
        from tsr.system import TSR

        print("⏳ Carregando pesos do modelo TripoSR...")
        start_t = time.time()
        MODEL = TSR.from_pretrained(
            "stabilityai/TripoSR",
            config_name="config.yaml",
            weight_name="model.ckpt",
        )
        MODEL.renderer.set_chunk_size(8192)
        MODEL.to(DEVICE)
        print(f"🚀 TripoSR carregado com sucesso na {GPU_NAME} em {time.time() - start_t:.2f}s!")
        return MODEL
    except Exception as err:
        print(f"ℹ️ Erro ao carregar modelo TripoSR: {err}")
        return None


def segment_foreground_opencv(rgb_img: Image.Image) -> Image.Image:
    """
    Remove o fundo de fotos/imagens RGB usando OpenCV GrabCut + análise de bordas conectadas
    e preenchimento morfológico quando `rembg` não está instalado.
    """
    arr = np.array(rgb_img.convert("RGB"), dtype=np.uint8)
    h, w, _ = arr.shape

    # Redimensionar temporariamente se a imagem for muito grande para acelerar o GrabCut
    max_side = 640
    scale = min(1.0, max_side / float(max(h, w)))
    if scale < 1.0:
        work_w = max(32, int(round(w * scale)))
        work_h = max(32, int(round(h * scale)))
        work_rgb = np.array(rgb_img.convert("RGB").resize((work_w, work_h), Image.Resampling.BILINEAR), dtype=np.uint8)
    else:
        work_h, work_w = h, w
        work_rgb = arr

    border = max(2, int(round(min(work_h, work_w) * 0.04)))
    top = work_rgb[:border, :, :].reshape(-1, 3)
    bot = work_rgb[-border:, :, :].reshape(-1, 3)
    left = work_rgb[:, :border, :].reshape(-1, 3)
    right = work_rgb[:, -border:, :].reshape(-1, 3)
    border_pixels = np.concatenate([top, bot, left, right], axis=0).astype(np.float32)

    bg_median = np.median(border_pixels, axis=0)
    bg_std = np.maximum(np.std(border_pixels, axis=0), 12.0)

    diff = np.linalg.norm((work_rgb.astype(np.float32) - bg_median) / bg_std, axis=-1)

    alpha_mask: Optional[np.ndarray] = None
    try:
        import cv2
        from scipy import ndimage

        # 1. Máscara inicial conectada às bordas com cor semelhante ao fundo
        bg_like = diff < 2.35
        labeled_bg, _ = ndimage.label(bg_like)
        border_labels = np.unique(
            np.concatenate(
                [
                    labeled_bg[0, :],
                    labeled_bg[-1, :],
                    labeled_bg[:, 0],
                    labeled_bg[:, -1],
                ]
            )
        )
        border_labels = border_labels[border_labels > 0]
        connected_bg = np.isin(labeled_bg, border_labels)

        # 2. Refinar com GrabCut se houver região de primeiro plano plausível
        fg_initial = ~connected_bg
        fg_ratio = float(np.mean(fg_initial))

        gc_mask = np.full((work_h, work_w), cv2.GC_PR_FGD, dtype=np.uint8)
        gc_mask[connected_bg] = cv2.GC_PR_BGD
        gc_mask[:border, :] = np.where(diff[:border, :] < 3.0, cv2.GC_BGD, cv2.GC_PR_BGD)
        gc_mask[-border:, :] = np.where(diff[-border:, :] < 3.0, cv2.GC_BGD, cv2.GC_PR_BGD)
        gc_mask[:, :border] = np.where(diff[:, :border] < 3.0, cv2.GC_BGD, cv2.GC_PR_BGD)
        gc_mask[:, -border:] = np.where(diff[:, -border:] < 3.0, cv2.GC_BGD, cv2.GC_PR_BGD)

        # Núcleo central confiável como foreground provável/certo
        cy0, cy1 = int(work_h * 0.2), int(work_h * 0.8)
        cx0, cx1 = int(work_w * 0.2), int(work_w * 0.8)
        core = np.zeros((work_h, work_w), dtype=bool)
        core[cy0:cy1, cx0:cx1] = True
        sure_fg = core & (diff > 3.2) & (~connected_bg)
        if np.any(sure_fg):
            gc_mask[sure_fg] = cv2.GC_FGD

        if 0.01 < fg_ratio < 0.96 and np.any(gc_mask == cv2.GC_BGD):
            bgd_model = np.zeros((1, 65), np.float64)
            fgd_model = np.zeros((1, 65), np.float64)
            work_bgr = cv2.cvtColor(work_rgb, cv2.COLOR_RGB2BGR)
            cv2.grabCut(work_bgr, gc_mask, None, bgd_model, fgd_model, 4, cv2.GC_INIT_WITH_MASK)
            fg_mask = (gc_mask == cv2.GC_FGD) | (gc_mask == cv2.GC_PR_FGD)
        else:
            fg_mask = fg_initial

        # Limpeza morfológica: manter componentes relevantes e fechar buracos internos
        fg_mask = ndimage.binary_fill_holes(fg_mask)
        comp_labels, num_comp = ndimage.label(fg_mask)
        if num_comp > 1:
            sizes = ndimage.sum(fg_mask, comp_labels, index=np.arange(1, num_comp + 1))
            max_comp_size = float(np.max(sizes)) if len(sizes) > 0 else 0.0
            keep_labels = [idx + 1 for idx, sz in enumerate(sizes) if sz >= max_comp_size * 0.08]
            fg_mask = np.isin(comp_labels, keep_labels)

        # Se a segmentação falhou (vazia ou pegou tudo), faz fallback por distância de borda
        final_ratio = float(np.mean(fg_mask))
        if final_ratio < 0.015 or final_ratio > 0.985:
            fg_mask = ~connected_bg

        alpha_mask = (fg_mask.astype(np.float32) * 255.0).astype(np.uint8)
    except Exception:
        alpha_f = np.clip((diff - 1.5) / 1.8, 0.0, 1.0)
        alpha_mask = (alpha_f * 255.0).astype(np.uint8)

    alpha_pil = Image.fromarray(alpha_mask, mode="L")
    if (work_w, work_h) != (w, h):
        alpha_pil = alpha_pil.resize((w, h), Image.Resampling.BILINEAR)

    # Suavizar levemente a borda do canal alfa para evitar serrilhado no encoder ViT
    alpha_pil = alpha_pil.filter(ImageFilter.GaussianBlur(radius=0.8))

    rgba = arr.copy()
    rgba_out = np.dstack([rgba, np.array(alpha_pil, dtype=np.uint8)])
    return Image.fromarray(rgba_out, mode="RGBA")


def resize_foreground_square(image_rgba: Image.Image, ratio: float = 0.85) -> Image.Image:
    """
    Recorta o objeto pelo canal alfa, centraliza em um canvas QUADRADO 1:1 (evitando
    qualquer distorção de aspect-ratio no TripoSR) e aplica margem `ratio` (padrão 0.85).
    """
    ratio = float(np.clip(ratio, 0.50, 0.96))
    arr = np.array(image_rgba.convert("RGBA"))
    alpha_coords = np.where(arr[..., 3] > 16)

    if len(alpha_coords[0]) == 0:
        # Imagem sem máscara detectável: apenas acolchoar para quadrado 1:1 com fundo neutro
        h, w = arr.shape[:2]
        size = max(h, w)
        ph0, pw0 = (size - h) // 2, (size - w) // 2
        ph1, pw1 = size - h - ph0, size - w - pw0
        padded = np.pad(arr, ((ph0, ph1), (pw0, pw1), (0, 0)), mode="edge")
        return Image.fromarray(padded, mode="RGBA")

    y1, y2 = int(alpha_coords[0].min()), int(alpha_coords[0].max()) + 1
    x1, x2 = int(alpha_coords[1].min()), int(alpha_coords[1].max()) + 1
    fg = arr[y1:y2, x1:x2]

    size = max(fg.shape[0], fg.shape[1])
    ph0, pw0 = (size - fg.shape[0]) // 2, (size - fg.shape[1]) // 2
    ph1, pw1 = size - fg.shape[0] - ph0, size - fg.shape[1] - pw0
    sq = np.pad(
        fg,
        ((ph0, ph1), (pw0, pw1), (0, 0)),
        mode="constant",
        constant_values=0,
    )

    new_size = max(size, int(round(size / ratio)))
    mph0, mpw0 = (new_size - size) // 2, (new_size - size) // 2
    mph1, mpw1 = new_size - size - mph0, new_size - size - mpw0
    framed = np.pad(
        sq,
        ((mph0, mph1), (mpw0, mpw1), (0, 0)),
        mode="constant",
        constant_values=0,
    )
    return Image.fromarray(framed, mode="RGBA")


def preprocess_image_for_triposr(
    pil_image: Image.Image,
    remove_bg: bool = True,
    foreground_ratio: float = 0.85,
) -> Tuple[Image.Image, str]:
    """
    Executa o pipeline completo recomendado pelo TripoSR:
    1) Usa transparência nativa se o PNG já vier recortado;
    2) Caso contrário, remove o fundo via `rembg` (se disponível) ou GrabCut OpenCV;
    3) Centraliza o objeto em quadrado 1:1 com proporção `foreground_ratio`;
    4) Compõe sobre cinza neutro 0.5 (exatamente a cor de treino do TripoSR).
    """
    bg_method = "none"

    has_native_alpha = False
    if pil_image.mode in ("RGBA", "LA") or ("transparency" in pil_image.info):
        rgba_candidate = pil_image.convert("RGBA")
        alpha_ch = np.array(rgba_candidate)[..., 3]
        transparent_frac = float(np.mean(alpha_ch < 240))
        opaque_frac = float(np.mean(alpha_ch > 16))
        if transparent_frac > 0.02 and opaque_frac > 0.01:
            has_native_alpha = True
            rgba_img = rgba_candidate
            bg_method = "native_alpha"

    if not has_native_alpha:
        if remove_bg:
            session = get_rembg_session()
            if session is not None:
                import rembg

                rgba_img = rembg.remove(pil_image.convert("RGB"), session=session)
                bg_method = "rembg"
            else:
                rgba_img = segment_foreground_opencv(pil_image)
                bg_method = "opencv_grabcut"
        else:
            # Mesmo sem remoção de fundo, acolchoamos em quadrado 1:1 para não esticar
            rgb = np.array(pil_image.convert("RGB"))
            h, w = rgb.shape[:2]
            size = max(h, w)
            ph0, pw0 = (size - h) // 2, (size - w) // 2
            ph1, pw1 = size - h - ph0, size - w - pw0
            padded_rgb = np.pad(rgb, ((ph0, ph1), (pw0, pw1), (0, 0)), mode="constant", constant_values=128)
            return Image.fromarray(padded_rgb, mode="RGB"), "square_pad_only"

    framed_rgba = resize_foreground_square(rgba_img, ratio=foreground_ratio)
    img_f = np.array(framed_rgba, dtype=np.float32) / 255.0
    alpha = img_f[:, :, 3:4]
    composited = img_f[:, :, :3] * alpha + (1.0 - alpha) * 0.5
    return Image.fromarray(np.clip(composited * 255.0, 0, 255).astype(np.uint8), mode="RGB"), bg_method


def encode_bambu_paint_color(extruder_1based: int) -> str:
    """
    Codifica o índice do filamento/extrusora (1-based) no formato hexadecimal `paint_color`
    do Bambu Studio / OrcaSlicer (TriangleSelector leaf nibble).
    Extrusora 1 é o padrão do objeto (sem atributo extra necessário, ou "4").
    """
    if extruder_1based <= 1:
        return ""
    if extruder_1based == 2:
        return "8"
    # Para estado >= 3: nibble raiz = 0xC (state=3 escape) precedido por nibble (state - 3)
    offset = extruder_1based - 3
    if offset < 15:
        return f"{offset:X}C"
    # Suporte estendido > 17 extrusoras
    num_f = offset // 15
    rem = offset % 15
    return f"{rem:X}" + ("F" * num_f) + "C"


def quantize_mesh_face_colors(
    vertices: np.ndarray,
    faces: np.ndarray,
    vertex_colors: Optional[np.ndarray],
    num_colors: int,
) -> Tuple[Optional[np.ndarray], List[str]]:
    """
    Agrupa as cores RGB por face da malha do TripoSR em `num_colors` slots de filamento (K-Means)
    e aplica suavização por vizinhança de arestas para eliminar manchas isoladas de 1 triângulo.
    Retorna `(face_extruders_1based, palette_hex_list)`.
    """
    if vertex_colors is None or num_colors <= 1 or len(faces) == 0:
        return None, []

    vc = np.asarray(vertex_colors, dtype=np.float32)
    if vc.max() > 1.5:
        vc = vc / 255.0
    vc_rgb = np.clip(vc[:, :3], 0.0, 1.0)

    # Cor média de cada triângulo
    face_rgb = vc_rgb[faces].mean(axis=1)  # (F, 3)

    k = int(np.clip(num_colors, 2, 8))
    rng = np.random.default_rng(42)

    # Inicialização K-Means++ determinística
    n_faces = len(face_rgb)
    sample_idx = rng.choice(n_faces, size=min(n_faces, 12000), replace=False)
    sample = face_rgb[sample_idx]

    centers = np.zeros((k, 3), dtype=np.float32)
    centers[0] = sample[int(np.argmax(np.linalg.norm(sample - sample.mean(axis=0), axis=1)))]
    for c_i in range(1, k):
        dists = np.min(np.sum((sample[:, None, :] - centers[None, :c_i, :]) ** 2, axis=-1), axis=1)
        total_d = float(np.sum(dists))
        if total_d <= 1e-8:
            centers[c_i] = sample[c_i % len(sample)]
        else:
            centers[c_i] = sample[int(np.argmax(dists))]

    for _ in range(16):
        d2 = np.sum((sample[:, None, :] - centers[None, :, :]) ** 2, axis=-1)
        assign = np.argmin(d2, axis=1)
        new_centers = centers.copy()
        for c_i in range(k):
            pts = sample[assign == c_i]
            if len(pts) > 0:
                new_centers[c_i] = pts.mean(axis=0)
        if np.allclose(centers, new_centers, atol=1e-4):
            centers = new_centers
            break
        centers = new_centers

    full_d2 = np.sum((face_rgb[:, None, :] - centers[None, :, :]) ** 2, axis=-1)
    labels = np.argmin(full_d2, axis=1).astype(np.int32)

    # Ordenar paleta para que a cor predominante seja o Filamento #1 (corpo principal)
    counts = np.bincount(labels, minlength=k)
    order = np.argsort(-counts)
    remap = np.zeros(k, dtype=np.int32)
    for new_idx, old_idx in enumerate(order):
        remap[old_idx] = new_idx
    labels = remap[labels]
    centers = centers[order]

    # Suavização topológica simples (2 passadas de voto majoritário por vértices compartilhados)
    n_verts = len(vertices)
    for _ in range(2):
        vert_votes = np.zeros((n_verts, k), dtype=np.int32)
        for corner in range(3):
            np.add.at(vert_votes, (faces[:, corner], labels), 1)
        face_neighbor_votes = vert_votes[faces[:, 0]] + vert_votes[faces[:, 1]] + vert_votes[faces[:, 2]]
        labels = np.argmax(face_neighbor_votes, axis=1).astype(np.int32)

    # Remover cores vazias após suavização
    used_ids = sorted(set(int(x) for x in labels))
    compact_map = {old: idx for idx, old in enumerate(used_ids)}
    final_extruders = np.array([compact_map[int(x)] + 1 for x in labels], dtype=np.int32)
    palette_hex = []
    for old in used_ids:
        rgb255 = np.clip(np.round(centers[old] * 255.0), 0, 255).astype(int)
        palette_hex.append(f"#{rgb255[0]:02X}{rgb255[1]:02X}{rgb255[2]:02X}")

    return final_extruders, palette_hex


def export_to_3mf_bytes(
    vertices: np.ndarray,
    faces: np.ndarray,
    model_name: str = "AZ3D_Modelo_3D",
    face_extruders: Optional[np.ndarray] = None,
    palette_hex: Optional[List[str]] = None,
) -> bytes:
    """
    Exporta vértices e faces para formato .3MF nativo para Bambu Studio / OrcaSlicer / Split3MF.
    Posiciona o item no centro da mesa 256x256 mm (128, 128, 0) mantendo vértices locais centralizados.
    Quando `face_extruders` e `palette_hex` são fornecidos, embute `paint_color` por triângulo e
    a paleta `filament_colour` compatível com Bambu Studio e com o Divisor Split3MF!
    """
    content_types_xml = """<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
  <Default Extension="config" ContentType="text/xml"/>
</Types>"""

    rels_xml = """<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>"""

    vert_lines = [f'<vertex x="{v[0]:.4f}" y="{v[1]:.4f}" z="{v[2]:.4f}"/>' for v in vertices]

    has_multi_color = (
        face_extruders is not None
        and palette_hex is not None
        and len(palette_hex) > 1
        and len(face_extruders) == len(faces)
    )

    tri_lines: List[str] = []
    if has_multi_color and face_extruders is not None:
        for idx, f in enumerate(faces):
            ext = int(face_extruders[idx])
            paint_attr = encode_bambu_paint_color(ext)
            if paint_attr:
                tri_lines.append(
                    f'<triangle v1="{int(f[0])}" v2="{int(f[1])}" v3="{int(f[2])}" paint_color="{paint_attr}"/>'
                )
            else:
                tri_lines.append(f'<triangle v1="{int(f[0])}" v2="{int(f[1])}" v3="{int(f[2])}"/>')
    else:
        tri_lines = [f'<triangle v1="{int(f[0])}" v2="{int(f[1])}" v3="{int(f[2])}"/>' for f in faces]

    base_materials_xml = ""
    obj_pid_attr = ""
    if palette_hex and len(palette_hex) >= 1:
        base_items = [
            f'      <base name="Filamento {i + 1}" displaycolor="{hex_c}"/>'
            for i, hex_c in enumerate(palette_hex)
        ]
        base_materials_xml = (
            '    <basematerials id="99">\n'
            + "\n".join(base_items)
            + "\n    </basematerials>\n"
        )
        obj_pid_attr = ' pid="99" pindex="0"'

    model_xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="pt-BR" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:BambuStudio="http://schemas.bambulab.com/package/2021">
  <metadata name="Title">{model_name}</metadata>
  <metadata name="Designer">AZ3D Studio RTX 4060</metadata>
  <metadata name="Application">BambuStudio-01.09.00.00</metadata>
  <resources>
{base_materials_xml}    <object id="1" name="{model_name}" type="model"{obj_pid_attr}>
      <mesh>
        <vertices>
          {chr(10).join(vert_lines)}
        </vertices>
        <triangles>
          {chr(10).join(tri_lines)}
        </triangles>
      </mesh>
    </object>
  </resources>
  <build>
    <item objectid="1" transform="1 0 0 0 1 0 0 0 1 128 128 0" printable="1"/>
  </build>
</model>"""

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", content_types_xml)
        z.writestr("_rels/.rels", rels_xml)
        z.writestr("3D/3dmodel.model", model_xml)

        if palette_hex and len(palette_hex) >= 1:
            project_cfg = {
                "filament_colour": palette_hex,
                "filament_type": ["PLA"] * len(palette_hex),
            }
            z.writestr("Metadata/project_settings.config", json.dumps(project_cfg, indent=2))
            model_settings_xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<config>
  <object id="1">
    <metadata key="name" value="{model_name}"/>
    <metadata key="extruder" value="1"/>
  </object>
  <plate>
    <metadata key="plater_id" value="1"/>
    <metadata key="plater_name" value="{model_name}"/>
    <model_instance>
      <metadata key="object_id" value="1"/>
      <metadata key="instance_id" value="0"/>
    </model_instance>
  </plate>
</config>"""
            z.writestr("Metadata/model_settings.config", model_settings_xml)

    buf.seek(0)
    return buf.getvalue()


@app.get("/health")
def health_check():
    """Endpoint chamado pelo painel AZ3D para testar se a RTX 4060 está online"""
    vram_free = 0.0
    try:
        import torch

        if torch.cuda.is_available():
            vram_free = round(torch.cuda.mem_get_info()[0] / (1024 ** 3), 2)
    except Exception:
        pass

    return {
        "status": "online",
        "device": DEVICE,
        "gpu_name": GPU_NAME,
        "vram_total_gb": VRAM_TOTAL_GB,
        "vram_free_gb": vram_free,
        "triposr_installed": TRIPOSR_AVAILABLE,
        "rembg_installed": REMBG_AVAILABLE,
        "ready_for_inference": TRIPOSR_AVAILABLE,
    }


@app.post("/generate-3d")
async def generate_3d(
    image: UploadFile = File(...),
    mc_resolution: int = Form(256),
    foreground_ratio: float = Form(0.85),
    remove_bg: bool = Form(True),
    target_height_mm: float = Form(80.0),
    smooth_iterations: int = Form(6),
    flatten_base: bool = Form(True),
    color_slots: int = Form(4),
    format: str = Form("3mf"),
):
    """
    Recebe imagem PNG/JPEG/WebP e retorna a escultura 3D volumétrica 360° em .3MF ou .STL
    gerada com TripoSR, orientação Z-up correta, limpeza de ruídos flutuantes e suavização Taubin.
    """
    try:
        contents = await image.read()
        pil_image = Image.open(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Arquivo de imagem inválido: {e}")

    start_time = time.time()
    model = load_triposr_model()

    if model is None:
        raise HTTPException(
            status_code=503,
            detail=f"Modelo TripoSR não está disponível. Status CUDA: {DEVICE}, TripoSR: {TRIPOSR_AVAILABLE}",
        )

    try:
        import torch
        import trimesh

        mc_res = int(np.clip(mc_resolution, 96, 320))
        target_h = float(np.clip(target_height_mm, 20.0, 240.0))
        smooth_iters = int(np.clip(smooth_iterations, 0, 15))
        n_colors = int(np.clip(color_slots, 1, 8))

        # 1. Pré-processamento oficial TripoSR: recorte de fundo + enquadramento quadrado 1:1 + fundo 0.5
        input_img, bg_method = preprocess_image_for_triposr(
            pil_image,
            remove_bg=remove_bg,
            foreground_ratio=foreground_ratio,
        )

        # 2. Inferência do modelo TripoSR
        print(f"⏳ Executando inferência TripoSR ({mc_res}³, bg={bg_method}) na {GPU_NAME}...")
        with torch.no_grad():
            scene_codes = model([input_img], device=DEVICE)
            meshes = model.extract_mesh(scene_codes, True, resolution=mc_res)
            mesh_trimesh: trimesh.Trimesh = meshes[0]

        # 3. Remover ilhas flutuantes desconectadas (floaters do campo NeRF)
        try:
            parts = mesh_trimesh.split(only_watertight=False)
            if len(parts) > 1:
                parts_sorted = sorted(parts, key=lambda m: len(m.faces), reverse=True)
                main_faces = len(parts_sorted[0].faces)
                kept = [p for p in parts_sorted if len(p.faces) >= max(40, int(main_faces * 0.03))]
                mesh_trimesh = kept[0] if len(kept) == 1 else trimesh.util.concatenate(kept)
        except Exception as split_err:
            print(f"ℹ️ Aviso ao filtrar componentes conectados: {split_err}")

        # 4. Corrigir orientação de normais e suavizar degraus do Marching Cubes sem encolher volume
        try:
            trimesh.repair.fix_normals(mesh_trimesh)
        except Exception:
            pass

        if smooth_iters > 0 and len(mesh_trimesh.vertices) > 0:
            try:
                trimesh.smoothing.filter_taubin(mesh_trimesh, iterations=smooth_iters)
            except Exception as sm_err:
                print(f"ℹ️ Aviso na suavização Taubin: {sm_err}")

        # 5. Orientação para Bambu Studio / OrcaSlicer:
        # No TripoSR (com isosurface corrigido): +Z já é CIMA, +X aponta para a câmera frontal e +Y é direita.
        # No Bambu Studio: +Z é CIMA, -Y é a frente da mesa e +X é direita.
        # Logo, rotacionamos apenas -90° em torno de Z para que a frente da escultura olhe para a frente da impressora!
        rot_z = trimesh.transformations.rotation_matrix(np.radians(-90.0), [0, 0, 1])
        mesh_trimesh.apply_transform(rot_z)

        # 6. Centralizar X e Y pelo bounding box e assentar base em Z = 0
        bounds = mesh_trimesh.bounds
        center_xy = (bounds[0, :2] + bounds[1, :2]) * 0.5
        mesh_trimesh.vertices[:, 0] -= center_xy[0]
        mesh_trimesh.vertices[:, 1] -= center_xy[1]
        mesh_trimesh.vertices[:, 2] -= bounds[0, 2]

        # 7. Escalar para a altura desejada em milímetros
        current_height = float(mesh_trimesh.extents[2])
        if current_height > 1e-5:
            mesh_trimesh.apply_scale(target_h / current_height)

        # 8. Opcional: nivelar os primeiros 0.45 mm da base para melhor aderência na placa PEI
        if flatten_base and len(mesh_trimesh.vertices) > 0:
            z_vals = mesh_trimesh.vertices[:, 2]
            flat_cut = min(0.45, target_h * 0.01)
            z_vals = np.maximum(z_vals - flat_cut, 0.0)
            mesh_trimesh.vertices[:, 2] = z_vals

        # 9. Quantização opcional de cores das faces para pintura 3MF multi-cor (AMS / Split3MF)
        raw_vc = None
        if hasattr(mesh_trimesh, "visual") and hasattr(mesh_trimesh.visual, "vertex_colors"):
            raw_vc = mesh_trimesh.visual.vertex_colors

        face_extruders, palette_hex = quantize_mesh_face_colors(
            mesh_trimesh.vertices,
            mesh_trimesh.faces,
            raw_vc,
            num_colors=n_colors,
        )

        duration = round(time.time() - start_time, 2)
        print(
            f"🎉 Escultura 3D gerada em {duration}s! "
            f"({len(mesh_trimesh.faces)} faces, {len(mesh_trimesh.vertices)} vértices, "
            f"{len(palette_hex) or 1} cores)"
        )

        if format.lower() == "stl":
            stl_bytes = trimesh.exchange.stl.export_stl(mesh_trimesh)
            return Response(
                content=stl_bytes,
                media_type="model/stl",
                headers={
                    "Content-Disposition": "attachment; filename=sculpture_bambu.stl",
                    "X-Faces": str(len(mesh_trimesh.faces)),
                    "X-Vertices": str(len(mesh_trimesh.vertices)),
                    "X-Height-Mm": f"{target_h:.1f}",
                    "X-Colors": "1",
                    "X-Bg-Method": bg_method,
                },
            )

        three_mf_bytes = export_to_3mf_bytes(
            mesh_trimesh.vertices,
            mesh_trimesh.faces,
            model_name="Escultura_3D_Bambu",
            face_extruders=face_extruders,
            palette_hex=palette_hex if palette_hex else ["#FFFFFF"],
        )

        return Response(
            content=three_mf_bytes,
            media_type="application/vnd.ms-package.3dmanufacturing-3dmodel+xml",
            headers={
                "Content-Disposition": "attachment; filename=sculpture_bambu.3mf",
                "X-Faces": str(len(mesh_trimesh.faces)),
                "X-Vertices": str(len(mesh_trimesh.vertices)),
                "X-Height-Mm": f"{target_h:.1f}",
                "X-Colors": str(len(palette_hex) or 1),
                "X-Bg-Method": bg_method,
            },
        )

    except Exception as err:
        import traceback

        traceback.print_exc()
        print(f"❌ Erro na geração da escultura 3D: {err}")
        raise HTTPException(status_code=500, detail=f"Erro na geração TripoSR: {err}")


if __name__ == "__main__":
    import uvicorn

    print("\n" + "=" * 60)
    print("🚀 AZ3D WORKER DE IA 3D v2.0 - INICIANDO...")
    print(f"   Dispositivo: {GPU_NAME}")
    print(f"   Remoção de fundo: {'rembg neural' if REMBG_AVAILABLE else 'OpenCV GrabCut inteligente'}")
    print("   Escutando em: http://127.0.0.1:8000")
    print("=" * 60 + "\n")
    if TRIPOSR_AVAILABLE and DEVICE == "cuda":
        load_triposr_model()
    uvicorn.run(app, host="127.0.0.1", port=8000)
