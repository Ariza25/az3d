"""
AZ3D - Worker Local de IA 3D (RTX 4060 / CUDA)
======================================================
Este microserviço roda no seu computador pessoal com placa NVIDIA.
Ele recebe imagens do painel AZ3D e gera modelos 3D volumétricos completos (.3mf / .obj)
utilizando a aceleração de hardware da sua GPU.
"""

import os
import sys
import io
import time
import zipfile
import numpy as np
from typing import Optional

# Garantir saída UTF-8 no Windows PowerShell/CMD
try:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass

from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, JSONResponse
from PIL import Image

app = FastAPI(title="AZ3D Local 3D AI Worker", version="1.0.0")

# Permitir CORS irrestrito para o painel admin AZ3D
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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

MODEL = None
TRIPOSR_AVAILABLE = False

import sys
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


def load_triposr_model():
    """Carrega o modelo TripoSR para a memória da GPU RTX"""
    global MODEL
    if MODEL is not None:
        return MODEL
    if not TRIPOSR_AVAILABLE:
        return None

    try:
        from tsr.system import TSR
        print("⏳ Carregando pesos do modelo TripoSR na GPU...")
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


def export_to_3mf_bytes(vertices: np.ndarray, faces: np.ndarray, model_name: str = "AZ3D_Modelo_3D") -> bytes:
    """
    Exporta vértices e faces para formato .3MF nativo para Bambu Studio
    usando zipfile puro (100% autônomo, sem depender da biblioteca externa lxml).
    """
    content_types_xml = """<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
</Types>"""

    rels_xml = """<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>"""

    # Gerar nós XML de vértices e triângulos
    vert_lines = [f'<vertex x="{v[0]:.3f}" y="{v[1]:.3f}" z="{v[2]:.3f}"/>' for v in vertices]
    tri_lines = [f'<triangle v1="{int(f[0])}" v2="{int(f[1])}" v3="{int(f[2])}"/>' for f in faces]

    model_xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="pt-BR" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <metadata name="Title">{model_name}</metadata>
  <metadata name="Designer">AZ3D Studio RTX 4060</metadata>
  <metadata name="Application">AZ3D Bambu Slicer Exporter</metadata>
  <resources>
    <object id="1" name="{model_name}" type="model">
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
    <item objectid="1"/>
  </build>
</model>"""

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", content_types_xml)
        z.writestr("_rels/.rels", rels_xml)
        z.writestr("3D/3dmodel.model", model_xml)
    buf.seek(0)
    return buf.getvalue()


def generate_volumetric_mesh_from_image(pil_image: Image.Image, target_size_mm: float = 85.0):
    """
    Gera uma malha volumétrica 3D 100% estanque, fechada e fatiável (manifold)
    a partir da imagem.
    """
    res = 90
    img = pil_image.convert("RGBA").resize((res, res), Image.Resampling.BILINEAR)
    arr = np.array(img, dtype=np.float32)

    r, g, b, a = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2], arr[:, :, 3] / 255.0
    lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255.0

    cols, rows = res, res
    half_size = target_size_mm / 2.0
    dx = target_size_mm / (cols - 1)
    dy = target_size_mm / (rows - 1)

    top_count = cols * rows
    all_verts = np.zeros((top_count * 2, 3), dtype=np.float32)

    base_thick = 2.5
    relief_high = 4.0

    # 1. Vértices do Topo (Superfície frontal esculpida)
    for y in range(rows):
        for x in range(cols):
            idx = y * cols + x
            vx = -half_size + x * dx
            vy = half_size - y * dy
            vz = base_thick + float(lum[y, x]) * relief_high
            all_verts[idx] = [vx, vy, vz]

    # 2. Vértices do Fundo (Base plana assentada na mesa de impressão)
    offset_bot = top_count
    for y in range(rows):
        for x in range(cols):
            top_idx = y * cols + x
            bot_idx = offset_bot + top_idx
            all_verts[bot_idx] = [all_verts[top_idx, 0], all_verts[top_idx, 1], 0.0]

    faces = []

    # 3. Faces do Topo (Anti-horário para fora)
    for y in range(rows - 1):
        for x in range(cols - 1):
            v0 = y * cols + x
            v1 = y * cols + (x + 1)
            v2 = (y + 1) * cols + x
            v3 = (y + 1) * cols + (x + 1)
            faces.append([v0, v2, v1])
            faces.append([v1, v2, v3])

    # 4. Faces do Fundo (Virado para baixo Z=0)
    for y in range(rows - 1):
        for x in range(cols - 1):
            b0 = offset_bot + (y * cols + x)
            b1 = offset_bot + (y * cols + (x + 1))
            b2 = offset_bot + ((y + 1) * cols + x)
            b3 = offset_bot + ((y + 1) * cols + (x + 1))
            faces.append([b0, b1, b2])
            faces.append([b1, b3, b2])

    # 5. Bordas Laterais Fechando 100% o Sólido (Manifold Watertight)
    # Borda Superior (y = 0)
    for x in range(cols - 1):
        t0, t1 = x, x + 1
        b0, b1 = offset_bot + t0, offset_bot + t1
        faces.append([t0, t1, b0])
        faces.append([t1, b1, b0])

    # Borda Inferior (y = rows - 1)
    last_row = (rows - 1) * cols
    for x in range(cols - 1):
        t0, t1 = last_row + x, last_row + x + 1
        b0, b1 = offset_bot + t0, offset_bot + t1
        faces.append([t0, b0, t1])
        faces.append([t1, b0, b1])

    # Borda Esquerda (x = 0)
    for y in range(rows - 1):
        t0, t1 = y * cols, (y + 1) * cols
        b0, b1 = offset_bot + t0, offset_bot + t1
        faces.append([t0, b0, t1])
        faces.append([t1, b0, b1])

    # Borda Direita (x = cols - 1)
    for y in range(rows - 1):
        t0, t1 = y * cols + (cols - 1), (y + 1) * cols + (cols - 1)
        b0, b1 = offset_bot + t0, offset_bot + t1
        faces.append([t0, t1, b0])
        faces.append([t1, b1, b0])

    return all_verts, np.array(faces, dtype=np.uint32)


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
        "ready_for_inference": True,
    }


@app.post("/generate-3d")
async def generate_3d(
    image: UploadFile = File(...),
    mc_resolution: int = Form(128),
    format: str = Form("3mf"),
):
    """
    Recebe imagem PNG/JPEG e retorna a escultura 3D volumétrica 360° em .3MF para Bambu Lab
    gerada diretamente na GPU RTX 4060 com TripoSR.
    """
    try:
        contents = await image.read()
        pil_image = Image.open(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Arquivo de imagem inválido: {e}")

    start_time = time.time()
    model = load_triposr_model()

    if model is None or DEVICE != "cuda":
        raise HTTPException(
            status_code=503,
            detail=f"Modelo TripoSR não está disponível na GPU. Status CUDA: {DEVICE}, TripoSR: {TRIPOSR_AVAILABLE}"
        )

    try:
        import trimesh

        # Pré-processamento inteligente de imagem para o encoder visual do TripoSR
        if pil_image.mode == "RGBA":
            img_np = np.array(pil_image).astype(np.float32) / 255.0
            alpha = img_np[:, :, 3:4]
            rgb = img_np[:, :, :3] * alpha + (1 - alpha) * 0.5
            input_img = Image.fromarray((rgb * 255.0).astype(np.uint8))
        else:
            img_np = np.array(pil_image.convert("RGB")).astype(np.float32) / 255.0
            # Se os cantos forem brancos/claros (estúdio ou fundo transparente convertido para branco)
            corners = [img_np[0, 0], img_np[0, -1], img_np[-1, 0], img_np[-1, -1]]
            avg_corner = np.mean(corners, axis=0)
            if np.mean(avg_corner) > 0.85:
                dist = np.linalg.norm(img_np - avg_corner, axis=-1, keepdims=True)
                alpha = np.clip((dist - 0.05) / 0.15, 0.0, 1.0)
                rgb = img_np * alpha + (1 - alpha) * 0.5
                input_img = Image.fromarray((rgb * 255.0).astype(np.uint8))
            else:
                input_img = pil_image.convert("RGB")

        # 1. Inferência do modelo TripoSR na GPU RTX 4060
        print(f"⏳ Executando inferência neural na {GPU_NAME}...")
        with torch.no_grad():
            scene_codes = model([input_img], device=DEVICE)
            meshes = model.extract_mesh(scene_codes, True, resolution=mc_resolution)
            mesh_trimesh = meshes[0]

        # 2. Orientação para fatiador Bambu Lab:
        # TripoSR usa Y como altura. No Bambu Lab / OrcaSlicer, Z é a altura da mesa.
        # Rotacionar 90 graus no eixo X coloca o modelo em pé ereto na mesa!
        R = trimesh.transformations.rotation_matrix(np.radians(90), [1, 0, 0])
        mesh_trimesh.apply_transform(R)

        # 3. Centralizar X e Y na mesa
        mesh_trimesh.vertices[:, 0] -= mesh_trimesh.centroid[0]
        mesh_trimesh.vertices[:, 1] -= mesh_trimesh.centroid[1]

        # 4. Assentar os pés / base no chão da mesa (min Z = 0)
        mesh_trimesh.vertices[:, 2] -= np.min(mesh_trimesh.vertices[:, 2])

        # 5. Escalar para altura ergonômica de impressão (~80 mm)
        current_height = mesh_trimesh.extents[2]
        if current_height > 0:
            scale = 80.0 / current_height
            mesh_trimesh.apply_scale(scale)

        duration = round(time.time() - start_time, 2)
        print(f"🎉 Escultura 3D gerada com TripoSR na RTX 4060 em {duration}s! ({len(mesh_trimesh.faces)} faces, {len(mesh_trimesh.vertices)} vértices)")

        three_mf_bytes = export_to_3mf_bytes(
            mesh_trimesh.vertices,
            mesh_trimesh.faces,
            model_name="Escultura_3D_Bambu"
        )

        return Response(
            content=three_mf_bytes,
            media_type="application/vnd.ms-package.3dmanufacturing-3dmodel+xml",
            headers={
                "Content-Disposition": "attachment; filename=sculpture_bambu.3mf",
                "X-Faces": str(len(mesh_trimesh.faces)),
                "X-Vertices": str(len(mesh_trimesh.vertices)),
                "X-Height-Mm": "80.0",
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
    print("🚀 AZ3D WORKER DE IA 3D - INICIANDO...")
    print(f"   Dispositivo: {GPU_NAME}")
    print("   Escutando em: http://127.0.0.1:8000")
    print("=" * 60 + "\n")
    if TRIPOSR_AVAILABLE and DEVICE == "cuda":
        load_triposr_model()
    uvicorn.run(app, host="127.0.0.1", port=8000)

