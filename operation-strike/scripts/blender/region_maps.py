# Mapas para a troca de cor/camuflagem das roupas dos personagens (sem alterar a malha nem a textura original).
# Para cada personagem gera, no espaço de UV da textura:
#   <nome>_regions.png  R = região (0 nada, 1 colete, 2 uniforme, 3 calças, 4 luvas, 5 botas, 6 cobertura da cabeça) × 32
#   <nome>_pos.png      RGB = posição 3D na pose de repouso (normalizada) — a camuflagem é projetada em 3D,
#                       contínua entre as ilhas de UV;  <nome>_nrm.png  RGB = normal (espaço do objeto).
# Região de cada vértice: osso dominante + altura (botas abaixo de 0,2 m) + regras por personagem.
# Uso: python(bpy) region_maps.py -- <rig.blend> <saida_prefixo> <CT|T> [tamanho]
import bpy, sys, json, os
import numpy as np

args = sys.argv[sys.argv.index('--') + 1:]
RIG, OUT, TEAM = args[0], args[1], args[2]
RES = int(args[3]) if len(args) > 3 else 1024

bpy.ops.wm.open_mainfile(filepath=RIG)
body = bpy.data.objects['Body']
me = body.data
vg = {g.index: g.name for g in body.vertex_groups}
M = body.matrix_world
N3 = M.to_3x3().inverted().transposed()

def region(name, p):
    z = p.z
    if name in ('Head', 'Neck'):
        # rosto fica de fora (só o capacete / lenço muda de cor)
        if TEAM == 'CT' and p.y < -0.05 and 1.54 < z < 1.69 and abs(p.x) < 0.1: return 0
        if TEAM == 'T' and p.y < -0.07 and 1.645 < z < 1.692 and abs(p.x) < 0.08: return 0
    if TEAM == 'T' and name.startswith('ForeArm'): return 0  # mangas dobradas: antebraço à mostra
    if name in ('Foot.L', 'Foot.R', 'Toe.L', 'Toe.R'): return 5
    if name.startswith(('UpLeg', 'Leg')): return 5 if z < 0.2 else 3
    if name == 'Hips': return 3 if z < 0.86 else 1
    if name in ('Spine', 'Chest'): return 1
    if name.startswith(('Shoulder', 'UpperArm', 'ForeArm')): return 2
    if name.startswith('Hand'): return 4
    if name == 'Head': return 6
    if name == 'Neck': return 6 if TEAM == 'T' else 0
    return 0

nv = len(me.vertices)
vreg = np.zeros(nv, np.int32)
pos = np.zeros((nv, 3)); nrm = np.zeros((nv, 3))
for v in me.vertices:
    p = M @ v.co
    pos[v.index] = p
    n = (N3 @ v.normal).normalized()
    nrm[v.index] = n
    if v.groups:
        b = max(v.groups, key=lambda g: g.weight)
        vreg[v.index] = region(vg[b.group], p)
pmin, pmax = pos.min(0), pos.max(0)

me.calc_loop_triangles()
uvl = me.uv_layers.active.data
tris = []
for t in me.loop_triangles:
    vs = list(t.vertices)
    uv = [tuple(uvl[l].uv) for l in t.loops]
    r = np.bincount(vreg[vs], minlength=7).argmax()
    tris.append((vs, uv, r))

regions = np.zeros((RES, RES), np.uint8)
posmap = np.zeros((RES, RES, 3), np.float32)
nrmmap = np.zeros((RES, RES, 3), np.float32)
cover = np.zeros((RES, RES), bool)
for vs, uv, r in tris:
    P = np.array(uv) * RES
    P[:, 1] = RES - P[:, 1]  # imagem: linha 0 em cima
    x0, y0 = np.floor(P.min(0)).astype(int); x1, y1 = np.ceil(P.max(0)).astype(int)
    x0, y0 = max(x0, 0), max(y0, 0); x1, y1 = min(x1, RES - 1), min(y1, RES - 1)
    if x1 < x0 or y1 < y0: continue
    xs, ys = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
    (ax, ay), (bx, by), (cx, cy) = P
    d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
    if abs(d) < 1e-9: continue
    w0 = ((by - cy) * (xs - cx) + (cx - bx) * (ys - cy)) / d
    w1 = ((cy - ay) * (xs - cx) + (ax - cx) * (ys - cy)) / d
    w2 = 1 - w0 - w1
    eps = -0.02
    inside = (w0 >= eps) & (w1 >= eps) & (w2 >= eps)
    if not inside.any(): continue
    yy, xx = np.nonzero(inside)
    yy += y0; xx += x0
    W = np.stack([w0[inside], w1[inside], w2[inside]], 1)
    regions[yy, xx] = r
    posmap[yy, xx] = W @ pos[vs]
    nrmmap[yy, xx] = W @ nrm[vs]
    cover[yy, xx] = True

# preenche as bordas das ilhas (evita costuras ao filtrar a textura)
for _ in range(6):
    miss = ~cover
    for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
        src_c = np.roll(cover, (dy, dx), (0, 1))
        take = miss & src_c
        if not take.any(): continue
        regions[take] = np.roll(regions, (dy, dx), (0, 1))[take]
        posmap[take] = np.roll(posmap, (dy, dx), (0, 1))[take]
        nrmmap[take] = np.roll(nrmmap, (dy, dx), (0, 1))[take]
        cover = cover | take
        miss = ~cover

def save(name, arr):
    img = bpy.data.images.new(name, RES, RES, alpha=True, float_buffer=False)
    img.colorspace_settings.name = 'Non-Color'
    rgba = np.ones((RES, RES, 4), np.float32)
    rgba[..., :arr.shape[2]] = arr
    img.pixels = np.flipud(rgba).ravel()
    img.filepath_raw = f'{OUT}_{name}.png'; img.file_format = 'PNG'; img.save()

save('regions', np.stack([regions / 255.0 * 32, np.zeros_like(regions, float), np.zeros_like(regions, float)], -1).astype(np.float32))
# brilho médio de cada região na textura original (normaliza a nova cor)
img = next(i for i in bpy.data.images if i.name.startswith('Color'))
W = img.size[0]
alb = np.array(img.pixels[:], np.float32).reshape(W, W, 4)[::-1, :, :3]
alb = alb[::W // RES, ::W // RES][:RES, :RES]
lum = alb @ np.array([0.299, 0.587, 0.114], np.float32)
means = [float(lum[regions == k].mean()) if (regions == k).any() else 0.3 for k in range(7)]
half = slice(None, None, 2)
posmap = posmap[half, half]; nrmmap = nrmmap[half, half]; RES2 = RES // 2
def save2(name, arr):
    img2 = bpy.data.images.new(name, RES2, RES2, alpha=True, float_buffer=False)
    img2.colorspace_settings.name = 'Non-Color'
    rgba = np.ones((RES2, RES2, 4), np.float32); rgba[..., :3] = arr
    img2.pixels = np.flipud(rgba).ravel()
    img2.filepath_raw = f'{OUT}_{name}.png'; img2.file_format = 'PNG'; img2.save()
save2('pos', ((posmap - pmin) / (pmax - pmin)).clip(0, 1).astype(np.float32))
save2('nrm', (nrmmap / np.maximum(1e-6, np.linalg.norm(nrmmap, axis=-1, keepdims=True)) * 0.5 + 0.5).astype(np.float32))
json.dump({'min': pmin.round(4).tolist(), 'max': pmax.round(4).tolist(), 'res': RES,
           'counts': np.bincount(regions.ravel(), minlength=7).tolist(), 'mean': [round(m, 4) for m in means]}, open(f'{OUT}_regions.json', 'w'))
print('REGIOES', np.bincount(regions.ravel(), minlength=7).tolist())
