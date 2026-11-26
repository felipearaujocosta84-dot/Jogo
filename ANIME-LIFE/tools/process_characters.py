"""Gera versões otimizadas (fundo transparente, WebP) das ilustrações de referência.

A referência original (reference/original.jpg) NUNCA é alterada: ela é o registro permanente.
Saídas por personagem:
  full.webp      corpo inteiro, fundo removido, altura máx. 720px (diálogo / sprite estático)
  portrait.webp  recorte do busto (cabeça e ombros) para o celular e listas
Remoção de fundo: preenchimento a partir das bordas por cor parecida com o fundo
(sem IA, sem redesenhar nada) + mantém só o maior bloco conectado (o personagem).
"""
import sys, os, json
from collections import deque
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'characters')
TOL = int(os.environ.get('BG_TOL', '14'))

def bg_mask(rgb, tol):
    h, w, _ = rgb.shape
    a = rgb.astype(np.int16)
    # cores de fundo amostradas nas bordas
    border = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    light = border[border.sum(1) > 560]
    samples = np.unique((light // 8) * 8, axis=0) if len(light) else np.array([[248, 248, 248]])
    if len(samples) > 64:
        samples = samples[np.random.default_rng(0).choice(len(samples), 64, replace=False)]
    # pixel "parece fundo" se perto de alguma amostra e claro
    near = np.zeros((h, w), bool)
    for s in samples:
        near |= (np.abs(a - s).max(2) <= tol)
    near &= a.sum(2) > 600
    # flood fill a partir das bordas
    seen = np.zeros((h, w), bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if near[y, x] and not seen[y, x]: seen[y, x] = True; q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if near[y, x] and not seen[y, x]: seen[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1,0),(-1,0),(0,1),(0,-1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and near[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True; q.append((ny, nx))
    return seen

def largest_component(fg):
    h, w = fg.shape
    lab = np.zeros((h, w), np.int32); cur = 0; sizes = {}
    for sy in range(h):
        for sx in range(w):
            if fg[sy, sx] and not lab[sy, sx]:
                cur += 1; n = 0; q = deque([(sy, sx)]); lab[sy, sx] = cur
                while q:
                    y, x = q.popleft(); n += 1
                    for dy, dx in ((1,0),(-1,0),(0,1),(0,-1)):
                        ny, nx = y + dy, x + dx
                        if 0 <= ny < h and 0 <= nx < w and fg[ny, nx] and not lab[ny, nx]:
                            lab[ny, nx] = cur; q.append((ny, nx))
                sizes[cur] = n
    if not sizes: return fg
    big = max(sizes, key=sizes.get)
    keep = lab == big
    # devolve buracos internos pequenos? não: buracos internos que tocam a borda já são fundo.
    return keep

def enclosed_holes(rgb, fg, tol, min_area):
    """Áreas de fundo branco cercadas pelo personagem (ex.: entre braço e tronco)."""
    a = rgb.astype(np.int16)
    white = (np.abs(a - 250).max(2) <= tol) & fg
    h, w = white.shape; out = np.zeros_like(white); seen = np.zeros_like(white)
    for sy, sx in zip(*np.nonzero(white)):
        if seen[sy, sx]: continue
        comp = []; q = deque([(sy, sx)]); seen[sy, sx] = True
        while q:
            y, x = q.popleft(); comp.append((y, x))
            for dy, dx in ((1,0),(-1,0),(0,1),(0,-1)):
                ny, nx = y + dy, x + dx
                if 0 <= ny < h and 0 <= nx < w and white[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True; q.append((ny, nx))
        if len(comp) >= min_area:
            ys, xs = zip(*comp); out[list(ys), list(xs)] = True
    return out

def remove_floor_shadow(rgb, fg, cfg):
    """Sombra no chão (cinza/azulada, sem textura) ligada ao fundo, só na faixa de baixo da imagem."""
    h, w = fg.shape
    a = rgb.astype(np.int16)
    chroma = a.max(2) - a.min(2)
    bright = a.sum(2)
    band = np.zeros_like(fg); band[int(h * (1 - cfg.get('shadowBand', 0.16))):] = True
    blue_tint = (a[..., 2] - a[..., 0]) >= 16  # sombra é azulada; tênis/roupa branca são neutros
    cand = fg & band & blue_tint & (chroma < 60) & (bright > 380) & (bright < 640)
    if cand.sum() < 200: return fg
    # cor típica da sombra (mediana) — só remove o que for MUITO parecido com ela (tênis brancos ficam)
    med = np.median(a[cand], axis=0)
    tol = cfg.get('shadowTol', 26)
    shadowish = fg & band & blue_tint & (np.abs(a - med).max(2) <= tol)
    # só remove se encostar no fundo (inunda a partir dos pixels transparentes vizinhos)
    seen = np.zeros_like(fg); q = deque()
    ys, xs = np.nonzero(shadowish)
    for y, x in zip(ys, xs):
        if (y > 0 and not fg[y-1, x]) or (y < h-1 and not fg[y+1, x]) or (x > 0 and not fg[y, x-1]) or (x < w-1 and not fg[y, x+1]):
            seen[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1,0),(-1,0),(0,1),(0,-1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and shadowish[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True; q.append((ny, nx))
    return fg & ~seen

def peel_white_fringe(rgb, fg, iters, max_y=0.8):
    """Remove, de fora para dentro, pixels quase brancos encostados no fundo (halo/pontinhos brancos)."""
    a = rgb.astype(np.int16)
    whiteish = (a.min(2) > 205) & ((a.max(2) - a.min(2)) < 40)
    whiteish[int(fg.shape[0] * max_y):] = False  # não mexe nos pés (tênis brancos)
    fg = fg.copy()
    for _ in range(iters):
        out = ~fg
        touch = np.zeros_like(fg)
        touch[1:] |= out[:-1]; touch[:-1] |= out[1:]; touch[:, 1:] |= out[:, :-1]; touch[:, :-1] |= out[:, 1:]
        kill = fg & whiteish & touch
        if not kill.any(): break
        fg &= ~kill
    # ilhas pequenas que sobraram soltas
    return largest_component(fg)

def process(cid, cfg):
    d = os.path.join(ROOT, cid)
    src = Image.open(os.path.join(d, 'reference', 'original.jpg')).convert('RGB')
    if 'crop' in cfg:  # remove faixas que não fazem parte da ilustração (ex.: rodapé de banco de imagens)
        src = src.crop(tuple(cfg['crop']))
    rgb = np.array(src)
    if cfg.get('keepBackground'):
        # fundo ilustrado (não é branco liso): mantém a arte inteira, sem recorte automático
        rgba = src.convert('RGBA')
        bg = None
    tol = cfg.get('bgTolerance', TOL)
    if not cfg.get('keepBackground'):
        bg = bg_mask(rgb, tol)
        fg = largest_component(~bg)
        holes = enclosed_holes(rgb, fg, cfg.get('holeTolerance', 8), cfg.get('holeMinArea', 350))
        if 'holeMaxY' in cfg:  # limita a limpeza a uma faixa (ex.: só o cabelo, nunca a pele)
            holes[int(holes.shape[0] * cfg['holeMaxY']):] = False
        fg &= ~holes
        box_fg = fg.copy()  # enquadramento calculado ANTES da limpeza (mantém as medidas do "rig")
        fg = remove_floor_shadow(rgb, fg, cfg)
        fg = peel_white_fringe(rgb, fg, cfg.get('peel', 3), cfg.get('peelMaxY', 0.8))
        # encolhe 1px a máscara (remove o contorno branco) e suaviza a borda
        mask = Image.fromarray((fg * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3))
        alpha = mask.filter(ImageFilter.GaussianBlur(0.7))
        # "descontamina" a cor das bordas semitransparentes (tira o branco do fundo misturado)
        a = np.array(alpha).astype(np.float32)[..., None] / 255.0
        c = rgb.astype(np.float32)
        edge = (a > 0.05) & (a < 0.98)
        dec = np.clip((c - (1 - a) * 255.0) / np.maximum(a, 0.05), 0, 255)
        c = np.where(edge, dec, c)
        rgba = Image.fromarray(c.astype(np.uint8)).convert('RGB'); rgba.putalpha(alpha)
        box = Image.fromarray((box_fg * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.7)).point(lambda v: 255 if v > 24 else 0).getbbox()
        rgba = rgba.crop(box)
    # escala (nunca amplia)
    maxh = 720
    if rgba.height > maxh:
        rgba = rgba.resize((round(rgba.width * maxh / rgba.height), maxh), Image.LANCZOS)
    rgba.save(os.path.join(d, 'full.webp'), 'WEBP', quality=86, method=6)
    # retrato: topo da figura (≈ 30% da altura), quadrado centrado na cabeça
    hx = cfg.get('headX', 0.5); top = cfg.get('portraitTop', 0.0); size = cfg.get('portraitSize', 0.30)
    s = int(rgba.height * size)
    cx = int(rgba.width * hx); y0 = int(rgba.height * top)
    p = rgba.crop((cx - s // 2, y0, cx + s // 2, y0 + s)).resize((256, 256), Image.LANCZOS)
    p.save(os.path.join(d, 'portrait.webp'), 'WEBP', quality=86, method=6)
    return rgba.size, os.path.getsize(os.path.join(d, 'full.webp'))

if __name__ == '__main__':
    reg = json.load(open(os.path.join(os.path.dirname(__file__), '..', 'src', 'characters', 'characters.json')))
    only = sys.argv[1:]
    for c in reg['characters']:
        if only and c['id'] not in only: continue
        size, nbytes = process(c['id'], c.get('processing', {}))
        print(c['id'], size, f'{nbytes/1024:.0f} KB')
