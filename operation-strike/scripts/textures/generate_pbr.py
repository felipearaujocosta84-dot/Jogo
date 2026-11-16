# Gerador de texturas PBR realistas e contínuas (seamless) para os mapas do OPERATION STRIKE.
# Para cada material produz: albedo (cor), normal (OpenGL), ORM (R = oclusão, G = rugosidade, B = metal),
# nas resoluções 1K, 2K e 4K (4K só para os materiais de maior área na tela).
# Técnica de "material procedural" (como em ferramentas de materiais): relevo -> normal/AO; máscaras de desgaste,
# sujeira, rachaduras e manchas; variação por peça (tijolo, bloco, tábua, lajota). Tudo periódico (sem emendas).
# Uso: python generate_pbr.py <saida> [materiais,separados]
import sys, os, math, time
import numpy as np
from scipy import ndimage
from scipy.spatial import cKDTree
from PIL import Image

OUT = sys.argv[1]
ONLY = sys.argv[2].split(',') if len(sys.argv) > 2 else None
HERO = {'asphalt', 'concrete', 'sandstone', 'plaster', 'brick', 'sand', 'tile'}
f32 = np.float32

# ------------------------------------------------------------------ utilidades (todas periódicas)

def rng(seed):
    return np.random.default_rng(seed)

def spectral(N, r, beta=2.0, fmin=1.0, fmax=None, aniso=(1.0, 1.0)):
    """Ruído fractal periódico por síntese espectral (média 0, desvio 1). fmin/fmax em ciclos por tile."""
    kx = np.fft.fftfreq(N)[None, :] * N / aniso[0]
    ky = np.fft.fftfreq(N)[:, None] * N / aniso[1]
    k = np.sqrt(kx * kx + ky * ky)
    amp = np.where(k >= fmin, 1.0 / np.maximum(k, 1e-6) ** (beta / 2), 0.0)
    if fmax:
        amp *= np.exp(-(k / fmax) ** 2)
    ph = r.normal(size=(N, N)) + 1j * r.normal(size=(N, N))
    x = np.real(np.fft.ifft2(ph * amp)).astype(f32)
    return (x - x.mean()) / (x.std() + 1e-9)

def n01(x):
    lo, hi = np.percentile(x, 1), np.percentile(x, 99)
    return np.clip((x - lo) / (hi - lo + 1e-9), 0, 1).astype(f32)

def blur(x, s):
    return ndimage.gaussian_filter(x, s, mode='wrap').astype(f32)

def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return (t * t * (3 - 2 * t)).astype(f32)

def warp(x, r, amt, scale_f):
    """Distorce a imagem por um campo de ruído (deixa padrões geométricos orgânicos)."""
    N = x.shape[0]
    dx = spectral(N, r, 2.0, 1, scale_f) * amt
    dy = spectral(N, r, 2.0, 1, scale_f) * amt
    yy, xx = np.mgrid[0:N, 0:N].astype(f32)
    return ndimage.map_coordinates(x, [(yy + dy) % N, (xx + dx) % N], order=1, mode='grid-wrap').astype(f32)

def voronoi(N, n, r, jitter=1.0):
    """Células periódicas: F1, F2 (em pixels) e índice da célula."""
    pts = r.random((n, 2))
    tiles = np.concatenate([pts + [dx, dy] for dx in (-1, 0, 1) for dy in (-1, 0, 1)])
    ids = np.tile(np.arange(n), 9)
    tree = cKDTree(tiles * N)
    yy, xx = np.mgrid[0:N, 0:N]
    q = np.stack([xx.ravel() + 0.5, yy.ravel() + 0.5], 1)
    d, i = tree.query(q, k=2, workers=-1)
    F1 = d[:, 0].reshape(N, N).astype(f32)
    F2 = d[:, 1].reshape(N, N).astype(f32)
    return F1, F2, ids[i[:, 0]].reshape(N, N)

def cracks(N, r, cells, width_px, coverage=0.5):
    """Rachaduras finas: bordas de células distorcidas, só onde a máscara de ruído permite."""
    F1, F2, _ = voronoi(N, cells, r)
    edge = (F2 - F1)
    edge = warp(edge, r, N * 0.004, 40)
    line = 1 - smooth(0, width_px, edge)
    mask = smooth(1 - coverage, 1 - coverage + 0.15, n01(spectral(N, r, 2.2, 1, 12)))
    return (line * mask).astype(f32)

def ao_from_height(h, N, strength=1.0):
    """Oclusão por cavidade em várias escalas (fendas e juntas escurecem)."""
    ao = np.zeros_like(h)
    for s, w in ((N / 512, 0.5), (N / 160, 0.35), (N / 48, 0.25)):
        ao += np.clip(blur(h, s) - h, 0, None) * w
    ao = 1 - np.clip(ao * strength * 3, 0, 0.7)
    # oclusão é sombra larga (frestas e juntas), não granulado: suaviza
    return blur(ao.astype(f32), N / 1024 * 1.5)

def normal_from_height(h, N, tile_m, depth_m):
    """Normal OpenGL a partir da altura (0..1) com profundidade real em metros."""
    px = tile_m / N
    hz = h * depth_m
    dx = (np.roll(hz, -1, 1) - np.roll(hz, 1, 1)) / (2 * px)
    dy = (np.roll(hz, -1, 0) - np.roll(hz, 1, 0)) / (2 * px)
    nx, ny, nz = -dx, dy, np.ones_like(dx)  # +Y para cima na imagem (OpenGL)
    l = np.sqrt(nx * nx + ny * ny + nz * nz)
    return np.stack([nx / l, ny / l, nz / l], -1) * 0.5 + 0.5

def hexc(c):
    c = c.lstrip('#')
    return np.array([int(c[i:i + 2], 16) / 255 for i in (0, 2, 4)], f32)

def mixc(a, b, t):
    t = t[..., None] if t.ndim == 2 else t
    return a + (b - a) * t

def tint(N, base, var, x):
    """Cor base com variação (x: -1..1 ou 0..1)."""
    return np.clip(base[None, None, :] * (1 + var * x[..., None]), 0, 1).astype(f32)

def grid_cells(N, rows, cols, offset_alt=0.5, jit=None, r=None):
    """Aparelho de blocos (tijolos/blocos/lajotas): id por bloco, distância à junta (px), coord. local."""
    yy, xx = np.mgrid[0:N, 0:N].astype(f32)
    rh = N / rows
    row = np.floor(yy / rh).astype(int)
    off = (row % 2) * offset_alt * (N / cols)
    if jit is not None:
        off = off + jit[row % rows] * (N / cols)
    xs = (xx + off) % N
    cw = N / cols
    col = np.floor(xs / cw).astype(int)
    lx = xs - col * cw
    ly = yy - row * rh
    d = np.minimum(np.minimum(lx, cw - lx), np.minimum(ly, rh - ly))
    bid = (row % rows) * 1000 + (col % cols)
    return bid, d, lx / cw, ly / rh

def per_id(bid, r, n=1):
    u, inv = np.unique(bid, return_inverse=True)
    vals = r.random((len(u), n)).astype(f32)
    return vals[inv.reshape(bid.shape)]

# ------------------------------------------------------------------ materiais
# cada função recebe (N, r) e devolve: albedo (N,N,3) sRGB 0..1, altura 0..1, rugosidade, metal, tile(m), profundidade(m)

def m_asphalt(N, r):
    tile = 6.0
    base = spectral(N, r, 2.6, 1, 60)
    agg = n01(spectral(N, r, 0.8, 200, None))  # agregado (brita)
    stones = smooth(0.62, 0.75, agg)
    h = 0.5 + 0.12 * base + 0.25 * stones + 0.05 * spectral(N, r, 1.0, 300)
    cr = cracks(N, r, 9, N * 0.0018, 0.45)
    patch = smooth(0.66, 0.7, n01(warp(spectral(N, r, 3.0, 1, 6), r, N * 0.01, 20)))  # remendos mais escuros
    oil = smooth(0.8, 0.95, n01(spectral(N, r, 3.0, 2, 14)))
    h = n01(h - cr * 0.6)
    g = 0.17 + 0.05 * n01(base)
    col = np.stack([g, g, g * 1.03], -1)
    col = mixc(col, hexc('#5b5a57'), stones * 0.55 * n01(spectral(N, r, 1.0, 300)))
    col = mixc(col, hexc('#141517'), patch * 0.3)
    col = mixc(col, hexc('#0d0d0e'), oil * 0.3)
    col = mixc(col, hexc('#0a0a0a'), cr * 0.8)
    dust = smooth(0.5, 1.0, n01(spectral(N, r, 2.4, 1, 20)))
    col = mixc(col, hexc('#6e675c'), dust * 0.18)
    rough = np.clip(0.86 - stones * 0.06 - oil * 0.35 - patch * 0.05 + 0.04 * spectral(N, r, 1.5, 50), 0.3, 1)
    return col, h, rough, np.zeros_like(h), tile, 0.006

def m_concrete(N, r):
    tile = 4.0
    mott = spectral(N, r, 2.8, 1, 40)
    pores = smooth(0.82, 0.9, n01(spectral(N, r, 0.5, 250)))
    h = 0.5 + 0.08 * spectral(N, r, 2.0, 4, 200) - 0.35 * pores
    seam = np.zeros((N, N), f32)
    for y in (0, N // 2):  # juntas de forma (painéis de 2 m)
        yy = np.abs(((np.arange(N) - y + N // 2) % N) - N // 2)
        seam = np.maximum(seam, (1 - smooth(N * 0.0008, N * 0.0025, yy.astype(f32)))[:, None] * np.ones((1, N), f32))
    cr = cracks(N, r, 6, N * 0.0012, 0.35)
    h = n01(h - seam * 0.5 - cr * 0.5)
    g = 0.5 + 0.06 * mott
    col = np.stack([g * 1.0, g * 0.985, g * 0.95], -1)
    stain = smooth(0.45, 1, n01(warp(spectral(N, r, 3.2, 1, 10), r, N * 0.01, 15)))
    col = mixc(col, hexc('#5e5a52'), stain * 0.35)
    streak = smooth(0.55, 1, n01(blur(spectral(N, r, 1.5, 4, 120, aniso=(1, 6)), 1)))  # escorridos verticais
    col = mixc(col, hexc('#4c4842'), streak * 0.25)
    col = mixc(col, hexc('#262420'), pores * 0.5 + cr * 0.6 + seam * 0.5)
    rough = np.clip(0.88 + 0.06 * spectral(N, r, 2.0, 2, 80) - stain * 0.08, 0.5, 1)
    return col, h, rough, np.zeros_like(h), tile, 0.004

def m_plaster(N, r):
    tile = 5.0
    # reboco liso de parede (massa fina), com remendos de reparo e manchas grandes — nada de formas repetíveis
    trowel = blur(spectral(N, r, 2.2, 6, 120), 1.2)            # ondulação da desempenadeira
    grain = blur(spectral(N, r, 1.2, 60, 500), 0.8) * 0.35     # grão fino suave
    h = 0.55 + 0.05 * trowel + 0.02 * grain
    patch = smooth(0.6, 0.66, n01(warp(spectral(N, r, 3.4, 1, 5), r, N * 0.03, 12)))   # áreas de massa nova
    h = h + patch * 0.03
    cr = cracks(N, r, 7, N * 0.0011, 0.35)
    h = n01(h - cr * 0.35)
    base = hexc('#d6c3a0')
    col = tint(N, base, 0.035, spectral(N, r, 2.8, 1, 25)) * (1 + 0.015 * grain[..., None])
    col = mixc(col, hexc('#e3d6bb'), patch * 0.35)
    grime = smooth(0.5, 1, n01(blur(spectral(N, r, 1.6, 3, 140, aniso=(1, 7)), 1)))
    col = mixc(col, hexc('#9a8668'), grime * 0.28)
    col = mixc(col, hexc('#5c4f3f'), cr * 0.6)
    rough = np.clip(0.88 + 0.04 * trowel - patch * 0.05, 0.6, 1)
    return col, h, rough, np.zeros_like(h), tile, 0.004

def m_brick(N, r):
    tile = 3.0
    rows, cols = 40, 13
    bid, d, lx, ly = grid_cells(N, rows, cols)
    pv = per_id(bid, r, 4)
    mortar_w = N * 0.0022
    edge_noise = spectral(N, r, 1.8, 30, 500) * N * 0.0012
    dd = d + edge_noise
    mortar = 1 - smooth(mortar_w * 0.6, mortar_w, dd)
    chip = smooth(0.75, 0.85, n01(spectral(N, r, 1.5, 60))) * (1 - smooth(0, mortar_w * 3, dd))
    face = 0.7 + 0.12 * spectral(N, r, 1.4, 60, 600) + 0.06 * (pv[..., 1] - 0.5)
    h = np.where(mortar > 0.5, 0.15 + 0.05 * spectral(N, r, 1, 100), face - chip * 0.4)
    h = n01(blur(h, 0.6))
    reds = [hexc('#8e3f2a'), hexc('#a5502f'), hexc('#7a3424'), hexc('#9c5a3c'), hexc('#6d3426')]
    k = (pv[..., 0] * len(reds)).astype(int).clip(0, len(reds) - 1)
    bc = np.stack(reds)[k]
    bc = bc * (0.85 + 0.3 * pv[..., 2:3]) * (1 + 0.08 * spectral(N, r, 1.2, 80)[..., None])
    burn = smooth(0.6, 0.95, n01(spectral(N, r, 1.0, 40)))[..., None]
    bc = mixc(bc, bc * 0.55, burn * (pv[..., 3:4] > 0.7))
    col = mixc(bc, hexc('#9a9080') * (0.9 + 0.1 * spectral(N, r, 1, 200))[..., None], mortar)
    soot = smooth(0.55, 1, n01(blur(spectral(N, r, 2.0, 2, 60, aniso=(1, 5)), 1)))
    col = mixc(col, hexc('#2c2622'), soot * 0.35)
    effl = smooth(0.8, 1, n01(spectral(N, r, 2.0, 3, 80)))  # eflorescência (sal branco)
    col = mixc(col, hexc('#cfc8bd'), effl * mortar * 0.5 + effl * 0.12)
    rough = np.clip(0.85 + mortar * 0.1 + 0.05 * spectral(N, r, 1, 100), 0.5, 1)
    return col, h, rough, np.zeros_like(h), tile, 0.012

def m_sandstone(N, r):
    tile = 4.0
    rows = 8
    jit = r.random(rows) * 0.7
    bid, d, lx, ly = grid_cells(N, rows, 4, offset_alt=0.0, jit=jit)
    pv = per_id(bid, r, 3)
    joint = 1 - smooth(N * 0.0015, N * 0.004, d + spectral(N, r, 1.8, 20, 300) * N * 0.002)
    strata = spectral(N, r, 1.8, 2, 200, aniso=(8, 1))  # camadas sedimentares horizontais
    erosion = smooth(0.7, 0.9, n01(spectral(N, r, 1.2, 30)))
    edge_wear = 1 - smooth(0, N * 0.02, d + spectral(N, r, 1.5, 15, 200) * N * 0.01)
    h = 0.65 + 0.08 * strata + 0.06 * spectral(N, r, 1.3, 40, 500) - erosion * 0.25 - edge_wear * 0.25
    h = np.where(joint > 0.5, 0.12, h)
    h = n01(blur(h, 0.7))
    base = mixc(hexc('#c9a675'), hexc('#b38c5c'), pv[..., 0])
    col = base * (1 + 0.07 * strata[..., None] + 0.05 * spectral(N, r, 1.5, 60)[..., None])
    col = mixc(col, hexc('#8d6b45'), erosion * 0.6 + edge_wear * 0.25)
    col = mixc(col, hexc('#6e5236'), joint * 0.85)
    grime = smooth(0.55, 1, n01(blur(spectral(N, r, 1.8, 2, 90, aniso=(1, 6)), 1)))
    col = mixc(col, hexc('#7a6448'), grime * 0.3)
    rough = np.clip(0.9 + 0.05 * spectral(N, r, 1, 80), 0.6, 1)
    return col, h, rough, np.zeros_like(h), tile, 0.02

def m_sand(N, r):
    tile = 6.0
    yy, xx = np.mgrid[0:N, 0:N].astype(f32)
    ph = (xx / N * 2 * math.pi * 22) + spectral(N, r, 2.6, 1, 10) * 4
    ripple = (np.sin(ph) * 0.5 + 0.5) ** 1.6
    ripple = warp(ripple.astype(f32), r, N * 0.01, 20)
    grain = spectral(N, r, 0.3, 300)
    pebF1, _, pid = voronoi(N, 900, r)
    ppv = per_id(pid, r, 2)
    peb = (1 - smooth(N * 0.0012, N * 0.0035, pebF1)) * (ppv[..., 0] > 0.55)
    h = 0.5 + 0.06 * ripple * n01(spectral(N, r, 2.5, 1, 6)) + 0.05 * grain + 0.35 * peb + 0.1 * spectral(N, r, 2.5, 1, 30)
    h = n01(h)
    col = tint(N, hexc('#c8a574'), 0.07, spectral(N, r, 2.6, 1, 20))
    col = mixc(col, hexc('#a98457'), smooth(0.55, 1, n01(spectral(N, r, 2.8, 1, 10))) * 0.45)
    col = col * (1 + 0.06 * grain[..., None])
    pcol = mixc(hexc('#6f5a44'), hexc('#a69a86'), ppv[..., 1])
    col = mixc(col, pcol, peb * 0.95)
    rough = np.clip(0.95 - peb * 0.2, 0.6, 1)
    return col, h, rough, np.zeros_like(h), tile, 0.008

def m_tile(N, r):
    tile = 4.0
    bid, d, _, _ = grid_cells(N, 4, 4, offset_alt=0.0)
    pv = per_id(bid, r, 3)
    grout = 1 - smooth(N * 0.002, N * 0.0035, d)
    chip = smooth(0.8, 0.9, n01(spectral(N, r, 1.4, 40))) * (1 - smooth(0, N * 0.01, d))
    h = np.where(grout > 0.5, 0.2, 0.75 + 0.03 * spectral(N, r, 1.5, 20, 400) - chip * 0.3)
    h = n01(blur(h, 0.8))
    base = mixc(hexc('#b49a76'), hexc('#9d8462'), pv[..., 0])
    col = base * (1 + 0.06 * spectral(N, r, 2.0, 4, 200)[..., None])
    wear = smooth(0.5, 1, n01(spectral(N, r, 2.4, 1, 12)))
    col = mixc(col, hexc('#7c6a52'), wear * 0.3)
    col = mixc(col, hexc('#4a3d2e'), grout * 0.9)
    cr = cracks(N, r, 8, N * 0.001, 0.3) * (1 - grout)
    col = mixc(col, hexc('#3a2f24'), cr * 0.7)
    h = n01(h - cr * 0.3)
    rough = np.clip(0.55 + wear * 0.15 + grout * 0.35 + 0.05 * spectral(N, r, 1, 100), 0.3, 1)
    return col, h, rough, np.zeros_like(h), tile, 0.008

def corrugated(N, r, ribs, base_hex, tile, rust_amt):
    yy, xx = np.mgrid[0:N, 0:N].astype(f32)
    prof = 0.5 + 0.5 * np.sin(xx / N * 2 * math.pi * ribs)
    dents = blur(spectral(N, r, 2.6, 1, 12), N / 120) * 0.08
    h = n01(prof * 0.85 + dents + 0.03 * spectral(N, r, 1, 200))
    paint = tint(N, hexc(base_hex), 0.06, spectral(N, r, 2.2, 1, 30))
    rust_m = smooth(1 - rust_amt, 1 - rust_amt + 0.12, n01(warp(spectral(N, r, 1.8, 2, 120), r, N * 0.004, 60)))
    rust_m = np.clip(rust_m + smooth(0.3, 0.0, prof) * rust_m * 0.5, 0, 1)
    rust_col = mixc(hexc('#6b3a1e'), hexc('#a4572a'), n01(spectral(N, r, 1.2, 60)))
    chip = smooth(0.85, 0.9, n01(spectral(N, r, 1.0, 120))) * (1 - rust_m)
    col = mixc(paint, rust_col, rust_m)
    col = mixc(col, hexc('#8a8d90'), chip * 0.8)
    streak = smooth(0.6, 1, n01(blur(spectral(N, r, 1.4, 6, 200, aniso=(1, 10)), 1)))
    col = mixc(col, hexc('#4e3322'), streak * 0.35)
    rough = np.clip(0.55 + rust_m * 0.35 - chip * 0.25 + 0.05 * spectral(N, r, 1, 80), 0.2, 1)
    metal = np.clip(chip * 0.9, 0, 1)
    return col, h, rough, metal, tile, 0.035

def m_metal(N, r):
    return corrugated(N, r, 16, '#5d6a70', 3.0, 0.35)

def m_container(N, r):
    return corrugated(N, r, 12, '#7d2f22', 3.0, 0.3)

def m_roof(N, r):
    tile = 3.0
    yy, xx = np.mgrid[0:N, 0:N].astype(f32)
    # cobertura asfáltica em faixas sobrepostas (8 por tile)
    band = (yy / N * 8) % 1.0
    lap = smooth(0.0, 0.04, band) * (1 - smooth(0.96, 1.0, band))
    gran = spectral(N, r, 0.4, 250)
    h = n01(0.5 + 0.25 * lap - 0.3 * (1 - lap) + 0.1 * gran)
    col = tint(N, hexc('#5a5047'), 0.08, spectral(N, r, 2.2, 1, 30))
    col = col * (1 + 0.12 * gran[..., None])
    col = mixc(col, hexc('#2d2925'), (1 - lap) * 0.6)
    moss = smooth(0.7, 1.0, n01(spectral(N, r, 2.6, 1, 20)))
    col = mixc(col, hexc('#4e5034'), moss * 0.35)
    rough = np.clip(0.9 + 0.04 * gran, 0.6, 1)
    return col, h, rough, np.zeros_like(h), tile, 0.01

def m_trim(N, r):
    tile = 2.0
    yy, _ = np.mgrid[0:N, 0:N].astype(f32)
    v = yy / N
    prof = np.where(v < 0.1, 0.9 - (0.1 - v) * 3, np.where(v > 0.9, 0.6 - (v - 0.9) * 3, 0.75))
    h = n01(prof + 0.05 * spectral(N, r, 1.5, 20, 400))
    col = tint(N, hexc('#9d7b55'), 0.07, spectral(N, r, 2.0, 2, 80))
    col = mixc(col, hexc('#e0cba8'), (v < 0.1).astype(f32) * 0.25)
    col = mixc(col, hexc('#4c3a28'), (v > 0.9).astype(f32) * 0.35)
    rough = np.clip(0.85 + 0.05 * spectral(N, r, 1, 80), 0.5, 1)
    return col, h, rough, np.zeros_like(h), tile, 0.02

def m_door(N, r):
    tile = 2.0
    yy, xx = np.mgrid[0:N, 0:N].astype(f32)
    band = (yy / N * 10) % 1.0
    groove = 1 - smooth(0.0, 0.06, np.minimum(band, 1 - band))
    h = n01(0.6 - groove * 0.4 + 0.02 * spectral(N, r, 1.5, 30, 400))
    col = tint(N, hexc('#3f5a4c'), 0.07, spectral(N, r, 2.2, 1, 30))
    rust = smooth(0.72, 0.86, n01(warp(spectral(N, r, 1.6, 4, 150), r, N * 0.005, 60)))
    col = mixc(col, mixc(hexc('#5e321a'), hexc('#9a5228'), n01(spectral(N, r, 1, 80))), rust)
    chip = smooth(0.86, 0.9, n01(spectral(N, r, 1.0, 150))) * (1 - rust)
    col = mixc(col, hexc('#8f9295'), chip)
    col = mixc(col, hexc('#1e221f'), groove * 0.4)
    rough = np.clip(0.5 + rust * 0.4 - chip * 0.2, 0.2, 1)
    return col, h, rough, chip * 0.9, tile, 0.01

def m_steel(N, r):
    tile = 2.0
    brushed = blur(spectral(N, r, 0.6, 60, None), 0)
    brushed = blur(spectral(N, r, 0.4, 100, None, aniso=(1, 40)), 0.5)  # escovado horizontal
    yy, xx = np.mgrid[0:N, 0:N].astype(f32)
    # rebites nos cantos da chapa
    rv = np.zeros((N, N), f32)
    for cx, cy in ((0.03, 0.03), (0.97, 0.03), (0.03, 0.97), (0.97, 0.97), (0.5, 0.03), (0.5, 0.97)):
        dd = np.sqrt(((xx / N - cx + 0.5) % 1 - 0.5) ** 2 + ((yy / N - cy + 0.5) % 1 - 0.5) ** 2) * N
        rv = np.maximum(rv, 1 - smooth(N * 0.006, N * 0.009, dd))
    seam = 1 - smooth(N * 0.001, N * 0.003, np.minimum(np.minimum(xx, N - xx), np.minimum(yy, N - yy)))
    h = n01(0.5 + 0.05 * brushed + 0.4 * rv - 0.4 * seam)
    col = tint(N, hexc('#7d858c'), 0.05, brushed)
    grime = smooth(0.55, 1, n01(spectral(N, r, 2.2, 1, 30)))
    col = mixc(col, hexc('#3c3a36'), grime * 0.22 + seam * 0.6)
    rust = smooth(0.82, 0.95, n01(spectral(N, r, 1.6, 4, 120))) * (0.4 + 0.6 * rv)
    col = mixc(col, hexc('#7a4523'), rust * 0.7)
    rough = np.clip(0.35 + 0.08 * brushed + grime * 0.3 + rust * 0.4, 0.15, 1)
    metal = np.clip(1 - grime * 0.6 - rust, 0, 1)
    return col, h, rough, metal, tile, 0.004

def m_crate(N, r):
    """Madeira de caixa (tábuas com veios, nós, pregos e travessas; a caixa recebe a textura inteira)."""
    tile = 1.0
    yy, xx = np.mgrid[0:N, 0:N].astype(f32)
    planks = 5
    pid = np.floor(yy / N * planks).astype(int)
    pv = per_id(pid, r, 3)
    py = (yy / N * planks) % 1.0
    gap = 1 - smooth(0.0, 0.015, np.minimum(py, 1 - py))
    grain_n = spectral(N, r, 1.2, 4, 600, aniso=(30, 1))
    rings = np.sin((yy / N * planks * 18 + grain_n * 3 + pv[..., 0] * 10) * math.pi) * 0.5 + 0.5
    knots_F1, _, kid = voronoi(N, 14, r)
    knot = (1 - smooth(N * 0.006, N * 0.015, knots_F1)) * (per_id(kid, r)[..., 0] > 0.5)
    b = 0.09
    frame = ((xx / N < b) | (xx / N > 1 - b) | (yy / N < b) | (yy / N > 1 - b))
    diag = np.abs((xx - yy) / N) < b * 0.7
    brace = (frame | diag).astype(f32)
    h = 0.55 + 0.08 * rings * (1 - brace) + 0.25 * brace - gap * 0.4 * (1 - brace) - knot * 0.1
    nails = np.zeros((N, N), f32)
    for cx, cy in ((b / 2, b / 2), (1 - b / 2, b / 2), (b / 2, 1 - b / 2), (1 - b / 2, 1 - b / 2)):
        dd = np.sqrt((xx / N - cx) ** 2 + (yy / N - cy) ** 2) * N
        nails = np.maximum(nails, 1 - smooth(N * 0.008, N * 0.012, dd))
    h = n01(blur(h, 0.7) + nails * 0.2)
    wood = mixc(hexc('#a07445'), hexc('#7d5530'), pv[..., 1])
    col = wood * (0.82 + 0.25 * rings[..., None]) * (1 + 0.1 * grain_n[..., None])
    col = mixc(col, hexc('#6b4724') * 0.95, brace * 0.85)
    col = mixc(col, hexc('#3d2814'), knot * 0.8 + gap * 0.9)
    col = mixc(col, hexc('#2a2b2c'), nails)
    grime = smooth(0.5, 1, n01(spectral(N, r, 2.4, 1, 16)))
    col = mixc(col, hexc('#5a4b3a'), grime * 0.3)
    rough = np.clip(0.78 + 0.08 * grain_n - nails * 0.4, 0.3, 1)
    return col, h, rough, nails * 0.9, tile, 0.01

def m_carpet(N, r):
    tile = 4.0
    fib = spectral(N, r, 0.2, 400)
    h = n01(0.5 + 0.3 * fib + 0.1 * spectral(N, r, 2.0, 2, 60))
    col = tint(N, hexc('#4b5560'), 0.08, spectral(N, r, 2.0, 2, 60))
    col = col * (1 + 0.12 * fib[..., None])
    wear = smooth(0.55, 1, n01(spectral(N, r, 2.6, 1, 10)))
    col = mixc(col, hexc('#6a6e70'), wear * 0.25)
    rough = np.full((N, N), 0.97, f32)
    return col, h, rough, np.zeros_like(h), tile, 0.004

def m_grass(N, r):
    tile = 4.0
    blades = spectral(N, r, 0.3, 350, None, aniso=(1, 3))
    clumps = n01(spectral(N, r, 2.4, 3, 60))
    dirt = smooth(0.74, 0.82, n01(warp(spectral(N, r, 2.2, 2, 40), r, N * 0.015, 30)))
    h = n01(0.5 + 0.3 * blades * (1 - dirt) + 0.15 * clumps - dirt * 0.3)
    col = mixc(hexc('#4d6a2c'), hexc('#7f8f3c'), n01(blades) * 0.6 + clumps * 0.4)
    col = mixc(col, hexc('#a39a5a'), smooth(0.7, 1, n01(spectral(N, r, 2.0, 2, 30))) * 0.4)  # capim seco
    col = mixc(col, mixc(hexc('#5a4630'), hexc('#7a6448'), n01(spectral(N, r, 1, 200))), dirt)
    rough = np.clip(0.9 - (1 - dirt) * 0.1, 0.5, 1)
    return col, h, rough, np.zeros_like(h), tile, 0.02

def m_glass(N, r):
    tile = 4.0
    yy, xx = np.mgrid[0:N, 0:N].astype(f32)
    fx = np.minimum((xx / N * 4) % 1, 1 - (xx / N * 4) % 1)
    fy = np.minimum((yy / N * 4) % 1, 1 - (yy / N * 4) % 1)
    frame = (np.minimum(fx, fy) < 0.025).astype(f32)
    h = n01(0.5 + frame * 0.4)
    smudge = smooth(0.4, 1, n01(spectral(N, r, 2.4, 2, 40)))
    col = mixc(hexc('#1e3346') * (1 + 0.15 * smudge)[..., None], hexc('#8d969c'), frame)
    rough = np.clip(0.06 + smudge * 0.25 + frame * 0.4, 0.02, 1)
    metal = np.clip(0.3 + frame * 0.5, 0, 1)
    return col, h, rough, metal, tile, 0.01

def m_dark(N, r):
    tile = 2.0
    n = spectral(N, r, 1.5, 4, 200)
    h = n01(0.5 + 0.2 * n)
    col = tint(N, hexc('#26221e'), 0.12, n)
    rough = np.clip(0.85 + 0.05 * n, 0.5, 1)
    return col, h, rough, np.zeros_like(h), tile, 0.004

MATERIALS = {
    'asphalt': m_asphalt, 'concrete': m_concrete, 'plaster': m_plaster, 'brick': m_brick, 'sandstone': m_sandstone,
    'sand': m_sand, 'tile': m_tile, 'metal': m_metal, 'container': m_container, 'roof': m_roof, 'trim': m_trim,
    'door': m_door, 'steel': m_steel, 'crate': m_crate, 'carpet': m_carpet, 'grass': m_grass, 'glass': m_glass, 'dark': m_dark,
}

def save(arr, path, q):
    img = Image.fromarray((np.clip(arr, 0, 1) * 255 + 0.5).astype(np.uint8))
    img.save(path, 'WEBP', quality=q, method=4)

def build(name, fn, seed):
    N = int(os.environ['TEXN']) if os.environ.get('TEXN') else (4096 if name in HERO else 2048)
    t0 = time.time()
    r = rng(seed)
    col, h, rough, metal, tile, depth = fn(N, r)
    h = h.astype(f32)
    ao = ao_from_height(h, N)
    nrm = normal_from_height(h, N, tile, depth)
    col = col * (0.86 + 0.14 * ao[..., None])  # um pouco de oclusão também na cor (sujeira nas frestas)
    orm = np.stack([ao, rough, metal], -1)
    for res in ((4096, 2048, 1024) if N >= 1024 else (N,)):
        if res > N:
            continue
        d = os.path.join(OUT, {4096: '4k', 2048: '2k', 1024: '1k'}.get(res, 'preview'))
        os.makedirs(d, exist_ok=True)
        def rs(a, mode=Image.LANCZOS):
            if res == N:
                return a
            im = Image.fromarray((np.clip(a, 0, 1) * 65535).astype(np.uint16)) if a.ndim == 2 else None
            return np.asarray(Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)).resize((res, res), Image.LANCZOS)).astype(f32) / 255
        save(rs(col), os.path.join(d, f'{name}_albedo.webp'), 84)
        nn = rs(nrm)
        if res != N:  # renormaliza depois de reduzir
            v = nn * 2 - 1
            v /= np.linalg.norm(v, axis=-1, keepdims=True) + 1e-6
            nn = v * 0.5 + 0.5
        save(nn, os.path.join(d, f'{name}_normal.webp'), 90)
        save(rs(orm), os.path.join(d, f'{name}_orm.webp'), 86)
    print(f'{name}: {N}px, tile {tile} m, {time.time() - t0:.1f}s', flush=True)

for i, (name, fn) in enumerate(MATERIALS.items()):
    if ONLY and name not in ONLY:
        continue
    build(name, fn, 1000 + i * 17)
