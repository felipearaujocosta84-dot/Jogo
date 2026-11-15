// Modelos 3D procedurais (originais) de todas as armas, granadas, faca e bomba, com suporte a skins.
// Cada arma vira poucas malhas com cor por vértice + textura do padrão da skin:
// corpo, pente (animado na recarga) e ferrolho/slide. O mesmo modelo serve para a primeira pessoa,
// para as mãos dos personagens e para as miniaturas da loja (desenhadas em canvas a partir da geometria).
// Origem = empunhadura (mão direita); +Z = cano.
import { GeoBuilder } from '../core/GeoBuilder';
import { Mesh, StandardMaterial, Color3, DynamicTexture, Texture, TransformNode, Vector3, type Scene } from '../core/babylon';
import { skinById, type SkinDef } from './Skins';
import { skinCanvas } from './SkinPatterns';

export interface GunParts {
  root: TransformNode;
  body: Mesh;
  mag: Mesh | null;
  slide: Mesh | null;
  muzzle: Vector3;
  leftHand: Vector3;
}

const METAL = '#2a2c2f';
const METAL2 = '#3c4045';
const POLY = '#232426';
const WOOD = '#7b4a24';

type Parts = { body: GeoBuilder; mag: GeoBuilder; slide: GeoBuilder };
type Role = 'body' | 'furn' | 'metal' | 'detail';

/** Cor de uma peça conforme a skin. Peças com padrão ficam brancas (a textura dá a cor). */
let SK: SkinDef = skinById('default');
function col(g: GeoBuilder, role: Role, c: string): string {
  const pat = SK.pattern !== 'none' && (role === 'body' || role === 'furn');
  g.patterned = pat;
  if (pat) return '#ffffff';
  if (role === 'body' && SK.body) return SK.body;
  if (role === 'furn' && SK.furniture) return SK.furniture;
  if (role === 'metal' && SK.metal) return SK.metal;
  return c;
}

function rifleLike(b: Parts, o: { recv: number; barrel: number; body: string; furn: string; stock: 'wood' | 'poly' | 'fold' | 'none'; mag: 'curved' | 'straight' | 'box' | 'grip' | 'none'; scope?: number; supp?: number; hg?: string; rail?: boolean }): { muzzle: number; left: number } {
  const g = b.body;
  const r = o.recv;
  g.box(0.058, 0.08, r, [0, 0.01, r / 2 - 0.08], col(g, 'body', o.body));
  g.box(0.05, 0.028, r * 0.85, [0, 0.062, r / 2 - 0.08], col(g, 'metal', METAL2));
  const hgLen = Math.min(0.24, o.barrel * 0.7 + 0.06);
  g.box(0.064, 0.068, hgLen, [0, 0.0, r - 0.08 + hgLen / 2], col(g, 'furn', o.hg ?? o.furn));
  const bStart = r - 0.08;
  g.cyl(0.02, 0.02, o.barrel, [0, 0.008, bStart + o.barrel / 2], col(g, 'metal', METAL), [Math.PI / 2, 0, 0]);
  let muzzle = bStart + o.barrel;
  if (o.supp) {
    g.cyl(0.038, 0.038, o.supp, [0, 0.008, muzzle + o.supp / 2 - 0.02], col(g, 'body', '#1b1c1d'), [Math.PI / 2, 0, 0]);
    muzzle += o.supp - 0.02;
  } else g.cyl(0.03, 0.03, 0.05, [0, 0.008, muzzle], col(g, 'metal', METAL2), [Math.PI / 2, 0, 0]);
  if (!o.scope) {
    g.box(0.01, 0.045, 0.012, [0, 0.05, bStart + o.barrel * 0.8], col(g, 'metal', METAL));
    g.box(0.034, 0.022, 0.025, [0, 0.085, 0.04], col(g, 'metal', METAL));
  }
  if (o.rail) g.box(0.024, 0.04, 0.12, [0, 0.095, 0.05], col(g, 'metal', METAL));
  g.box(0.034, 0.1, 0.048, [0, -0.07, -0.01], col(g, 'detail', POLY), [-0.32, 0, 0]);
  g.box(0.008, 0.03, 0.035, [0, -0.04, 0.045], col(g, 'metal', METAL));
  if (o.stock === 'wood') {
    g.box(0.048, 0.07, 0.26, [0, -0.02, -0.21], col(g, 'furn', WOOD), [0.1, 0, 0]);
    g.box(0.05, 0.11, 0.025, [0, -0.04, -0.34], col(g, 'detail', POLY), [0.1, 0, 0]);
  } else if (o.stock === 'poly') {
    g.cyl(0.03, 0.03, 0.2, [0, 0.02, -0.17], col(g, 'metal', METAL), [Math.PI / 2, 0, 0]);
    g.box(0.045, 0.085, 0.13, [0, 0.0, -0.27], col(g, 'furn', o.furn));
    g.box(0.048, 0.11, 0.02, [0, -0.01, -0.34], col(g, 'detail', POLY));
  } else if (o.stock === 'fold') {
    g.box(0.012, 0.012, 0.22, [0.022, 0.02, -0.18], col(g, 'metal', METAL));
    g.box(0.012, 0.012, 0.22, [-0.022, 0.02, -0.18], col(g, 'metal', METAL));
    g.box(0.05, 0.07, 0.02, [0, 0.0, -0.29], col(g, 'metal', METAL));
  }
  if (o.scope) {
    const L = o.scope;
    g.cyl(0.038, 0.038, L, [0, 0.11, 0.06], col(g, 'body', '#1d1f21'), [Math.PI / 2, 0, 0], 0, 12);
    g.cyl(0.052, 0.04, 0.06, [0, 0.11, 0.06 + L / 2], col(g, 'detail', '#1d1f21'), [Math.PI / 2, 0, 0], 0, 12);
    g.cyl(0.048, 0.04, 0.05, [0, 0.11, 0.06 - L / 2], col(g, 'detail', '#1d1f21'), [Math.PI / 2, 0, 0], 0, 12);
    g.box(0.02, 0.04, 0.02, [0, 0.075, 0.0], col(g, 'metal', METAL));
    g.box(0.02, 0.04, 0.02, [0, 0.075, 0.13], col(g, 'metal', METAL));
  }
  const m = b.mag;
  if (o.mag === 'curved') {
    m.box(0.036, 0.09, 0.07, [0, -0.08, 0.1], col(m, 'metal', METAL2), [0.12, 0, 0]);
    m.box(0.036, 0.09, 0.07, [0, -0.16, 0.12], col(m, 'metal', METAL2), [0.38, 0, 0]);
  } else if (o.mag === 'straight') {
    m.box(0.032, 0.17, 0.065, [0, -0.11, 0.1], col(m, 'metal', METAL2), [0.08, 0, 0]);
  } else if (o.mag === 'box') {
    m.box(0.04, 0.08, 0.09, [0, -0.07, 0.08], col(m, 'detail', POLY));
  } else if (o.mag === 'grip') {
    m.box(0.03, 0.12, 0.04, [0, -0.15, -0.025], col(m, 'metal', METAL2), [-0.32, 0, 0]);
  }
  return { muzzle, left: Math.min(r - 0.08 + hgLen * 0.6, 0.32) };
}

function pistolLike(b: Parts, o: { slide: number; color: string; frame: string; supp?: number; big?: boolean }): { muzzle: number; left: number } {
  const s = b.slide;
  const k = o.big ? 1.25 : 1;
  s.box(0.034 * k, 0.038 * k, o.slide, [0, 0.03, o.slide / 2 - 0.05], col(s, 'body', o.color));
  s.box(0.008, 0.012, 0.01, [0, 0.055 * k, o.slide - 0.06], col(s, 'metal', METAL2));
  s.box(0.024, 0.012, 0.012, [0, 0.055 * k, -0.04], col(s, 'metal', METAL2));
  const g = b.body;
  g.box(0.03 * k, 0.03, o.slide * 0.85, [0, 0.0, o.slide * 0.42 - 0.05], col(g, 'furn', o.frame));
  g.box(0.012, 0.03, 0.045, [0, -0.025, 0.03], col(g, 'detail', o.frame));
  g.box(0.032 * k, 0.11 * k, 0.05 * k, [0, -0.06, -0.03], col(g, 'furn', o.frame), [-0.22, 0, 0]);
  let muzzle = o.slide - 0.05;
  if (o.supp) {
    g.cyl(0.032, 0.032, o.supp, [0, 0.03, muzzle + o.supp / 2], col(g, 'body', '#1b1c1d'), [Math.PI / 2, 0, 0]);
    muzzle += o.supp;
  }
  b.mag.box(0.03, 0.02, 0.045, [0, -0.12 * k, -0.045], col(b.mag, 'metal', METAL2), [-0.22, 0, 0]);
  return { muzzle, left: -0.01 };
}

function buildParts(id: string, skin: string): { parts: Parts; muzzle: number; left: number } {
  const parts: Parts = { body: new GeoBuilder(), mag: new GeoBuilder(), slide: new GeoBuilder() };
  const noSkin = id === 'he' || id === 'flash' || id === 'smoke' || id === 'c4';
  SK = skinById(noSkin ? 'default' : skin);
  let r = { muzzle: 0.3, left: 0.2 };
  switch (id) {
    case 'ak47': r = rifleLike(parts, { recv: 0.36, barrel: 0.3, body: METAL, furn: WOOD, stock: 'wood', mag: 'curved' }); break;
    case 'm4a4': r = rifleLike(parts, { recv: 0.34, barrel: 0.32, body: '#2e3134', furn: POLY, stock: 'poly', mag: 'straight', rail: true }); break;
    case 'm4a1': r = rifleLike(parts, { recv: 0.34, barrel: 0.2, body: '#3a3e42', furn: '#8a7a5a', stock: 'poly', mag: 'straight', supp: 0.22, rail: true, hg: '#8a7a5a' }); break;
    case 'awp': r = rifleLike(parts, { recv: 0.42, barrel: 0.55, body: '#3e4b36', furn: '#3e4b36', stock: 'poly', mag: 'box', scope: 0.3 }); break;
    case 'ssg08': r = rifleLike(parts, { recv: 0.38, barrel: 0.5, body: '#383c40', furn: '#2b2d30', stock: 'poly', mag: 'box', scope: 0.24 }); break;
    case 'mp5': r = rifleLike(parts, { recv: 0.28, barrel: 0.1, body: '#1f2022', furn: POLY, stock: 'fold', mag: 'curved', hg: '#26272a' }); break;
    case 'ump45': r = rifleLike(parts, { recv: 0.3, barrel: 0.12, body: '#2a2c2e', furn: '#2a2c2e', stock: 'fold', mag: 'straight' }); break;
    case 'mac10': r = rifleLike(parts, { recv: 0.2, barrel: 0.08, body: '#333538', furn: '#333538', stock: 'none', mag: 'grip' }); break;
    case 'glock': r = pistolLike(parts, { slide: 0.19, color: '#1f2022', frame: '#2b2a26' }); break;
    case 'usp': r = pistolLike(parts, { slide: 0.2, color: '#26282a', frame: '#26282a', supp: 0.14 }); break;
    case 'p250': r = pistolLike(parts, { slide: 0.18, color: '#55595e', frame: '#232426' }); break;
    case 'deagle': r = pistolLike(parts, { slide: 0.25, color: '#9aa0a6', frame: '#7d8288', big: true }); break;
    case 'knife': {
      const g = parts.body;
      g.box(0.022, 0.03, 0.11, [0, 0, 0], col(g, 'body', '#1c1c1c'));
      g.box(0.05, 0.012, 0.015, [0, 0, 0.06], col(g, 'metal', METAL2));
      g.box(0.006, 0.032, 0.17, [0, 0.004, 0.15], col(g, 'furn', '#b8bec4'));
      g.box(0.006, 0.014, 0.05, [0, 0.022, 0.21], col(g, 'metal', '#9aa0a6'), [0.5, 0, 0]);
      r = { muzzle: 0.24, left: -0.05 };
      break;
    }
    case 'he': {
      parts.body.sphere(0.07, [0, 0.02, 0.02], col(parts.body, 'detail', '#4b5a32'), [1, 1.15, 1]);
      parts.body.box(0.012, 0.06, 0.016, [0.025, 0.06, 0.02], METAL2, [0, 0, -0.3]);
      parts.body.cyl(0.02, 0.02, 0.02, [0, 0.065, 0.02], METAL2);
      r = { muzzle: 0.05, left: -0.05 };
      break;
    }
    case 'flash':
    case 'smoke': {
      const c = id === 'flash' ? '#6b6f73' : '#4f5d4b';
      parts.body.patterned = false;
      parts.body.cyl(0.05, 0.05, id === 'flash' ? 0.1 : 0.13, [0, 0.03, 0.02], c);
      parts.body.cyl(0.02, 0.02, 0.025, [0, 0.1, 0.02], METAL2);
      parts.body.box(0.012, 0.07, 0.016, [0.03, 0.06, 0.02], METAL2, [0, 0, -0.2]);
      r = { muzzle: 0.05, left: -0.05 };
      break;
    }
    case 'c4': {
      const g = parts.body;
      g.patterned = false;
      g.box(0.16, 0.06, 0.1, [0, 0.0, 0.06], '#6c6352');
      g.box(0.07, 0.012, 0.06, [0.03, 0.035, 0.06], '#1f2a1f');
      g.box(0.05, 0.006, 0.02, [0.03, 0.043, 0.075], '#5dff6a');
      g.box(0.04, 0.05, 0.08, [-0.05, 0.03, 0.06], '#a84a2a');
      g.cyl(0.006, 0.006, 0.14, [-0.01, 0.035, 0.06], '#c22', [0, 0, Math.PI / 2]);
      r = { muzzle: 0.1, left: 0.08 };
      break;
    }
  }
  SK = skinById('default');
  return { parts, muzzle: r.muzzle, left: r.left };
}

const mats = new Map<string, StandardMaterial>();

/** Material por skin (textura do padrão multiplicada pelas cores de vértice). */
export function gunMaterial(scene: Scene, skin = 'default'): StandardMaterial {
  const hit = mats.get(skin);
  if (hit && hit.getScene() === scene) return hit;
  const def = skinById(skin);
  const m = new StandardMaterial('gunMat_' + skin, scene);
  m.diffuseColor = Color3.White();
  const shiny = def.pattern === 'brushed' || def.pattern === 'carbon' || def.pattern === 'hex';
  m.specularColor = shiny ? new Color3(0.6, 0.6, 0.6) : new Color3(0.35, 0.35, 0.35);
  m.specularPower = shiny ? 64 : 48;
  if (def.pattern !== 'none') {
    const src = skinCanvas(skin, 256);
    const tex = new DynamicTexture('skinTex_' + skin, { width: 256, height: 256 }, scene, true);
    (tex.getContext() as unknown as CanvasRenderingContext2D).drawImage(src, 0, 0);
    tex.update(false);
    tex.wrapU = Texture.CLAMP_ADDRESSMODE;
    tex.wrapV = Texture.WRAP_ADDRESSMODE;
    m.diffuseTexture = tex;
    if (def.pattern === 'hex') m.emissiveColor = new Color3(0.05, 0.25, 0.28);
  }
  mats.set(skin, m);
  return m;
}

/** Arma completa com partes animáveis (primeira pessoa). */
export function buildGun(id: string, scene: Scene, skin = 'default'): GunParts {
  const { parts, muzzle, left } = buildParts(id, skin);
  const root = new TransformNode('gun_' + id, scene);
  const mat = gunMaterial(scene, skin);
  const make = (g: GeoBuilder, n: string) => {
    if (!g.vertexCount) return null;
    const m = g.build(n + id, scene);
    m.material = mat;
    m.parent = root;
    return m;
  };
  const body = make(parts.body, 'gunBody_')!;
  const mag = make(parts.mag, 'gunMag_');
  const slide = make(parts.slide, 'gunSlide_');
  return { root, body, mag, slide, muzzle: new Vector3(0, 0.01, muzzle), leftHand: new Vector3(-0.01, -0.03, left) };
}

const merged = new Map<string, Mesh>();

/** Malha única para as mãos dos personagens (compartilhada por instâncias), por arma e skin. */
export function gunSource(id: string, scene: Scene, skin = 'default'): Mesh {
  const key = id + '|' + skin;
  const hit = merged.get(key);
  if (hit && !hit.isDisposed()) return hit;
  const { parts } = buildParts(id, skin);
  const all = new GeoBuilder();
  for (const g of [parts.body, parts.mag, parts.slide]) if (g.vertexCount) all.merge(g);
  const m = all.build('gunSrc_' + key, scene);
  m.material = gunMaterial(scene, skin);
  m.isVisible = false;
  merged.set(key, m);
  return m;
}

// ------------------------------------------------------------------ miniaturas (loja e arsenal)

const thumbs = new Map<string, string>();

/** Imagem lateral da arma com a skin, desenhada em canvas a partir da própria geometria 3D. */
export function gunThumbnail(id: string, skin = 'default', w = 240, h = 110): string {
  const key = `${id}|${skin}|${w}x${h}`;
  const hit = thumbs.get(key);
  if (hit) return hit;
  const { parts } = buildParts(id, skin);
  const all = new GeoBuilder();
  for (const g of [parts.body, parts.mag, parts.slide]) if (g.vertexCount) all.merge(g);
  const { positions: P, normals: N, colors: C, indices: I, uvs: U } = all.data;
  const cv = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = w * dpr;
  cv.height = h * dpr;
  const g = cv.getContext('2d')!;
  g.scale(dpr, dpr);
  // enquadramento (vista lateral direita: z → direita, y → cima)
  let minZ = Infinity, maxZ = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < P.length; i += 3) {
    minZ = Math.min(minZ, P[i + 2]);
    maxZ = Math.max(maxZ, P[i + 2]);
    minY = Math.min(minY, P[i + 1]);
    maxY = Math.max(maxY, P[i + 1]);
  }
  const pad = 8;
  const sc = Math.min((w - pad * 2) / (maxZ - minZ || 1), (h - pad * 2) / (maxY - minY || 1));
  const ox = (w - (maxZ - minZ) * sc) / 2 - minZ * sc;
  const oy = (h - (maxY - minY) * sc) / 2 + maxY * sc;
  const pattern = skinById(skin).pattern !== 'none' ? g.createPattern(skinCanvas(skin, 256), 'repeat') : null;
  const L = [0.62, 0.66, 0.42];
  const tris: { d: number; i: number }[] = [];
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t], b = I[t + 1], c = I[t + 2];
    const nx = N[a * 3] + N[b * 3] + N[c * 3];
    if (nx < -0.3) continue; // virada para trás
    tris.push({ d: (P[a * 3] + P[b * 3] + P[c * 3]) / 3, i: t });
  }
  tris.sort((p, q) => p.d - q.d);
  for (const { i: t } of tris) {
    const vs = [I[t], I[t + 1], I[t + 2]];
    let nx = 0, ny = 0, nz = 0, r = 0, gg = 0, bb = 0, pat = false;
    for (const v of vs) {
      nx += N[v * 3]; ny += N[v * 3 + 1]; nz += N[v * 3 + 2];
      r += C[v * 4]; gg += C[v * 4 + 1]; bb += C[v * 4 + 2];
      if (U[v * 2] < 0.8) pat = true;
    }
    const nl = Math.hypot(nx, ny, nz) || 1;
    const shade = 0.62 + 0.55 * Math.max(0, (nx * L[0] + ny * L[1] + nz * L[2]) / nl);
    g.beginPath();
    for (const v of vs) g.lineTo(ox + P[v * 3 + 2] * sc, oy - P[v * 3 + 1] * sc);
    g.closePath();
    if (pat && pattern) {
      g.fillStyle = pattern;
      g.fill();
      g.fillStyle = shade < 1 ? `rgba(0,0,0,${(1 - shade).toFixed(2)})` : `rgba(255,255,255,${((shade - 1) * 0.6).toFixed(2)})`;
      g.fill();
    } else {
      // metal escuro clareado para aparecer bem no fundo escuro da loja
      const lift = (v: number) => Math.min(255, Math.round((v / 3) * 255 * 1.7 * shade + 34 * shade));
      g.fillStyle = `rgb(${lift(r)},${lift(gg)},${lift(bb)})`;
      g.fill();
      g.strokeStyle = g.fillStyle;
      g.lineWidth = 0.5;
      g.stroke();
    }
  }
  const url = cv.toDataURL('image/png');
  thumbs.set(key, url);
  return url;
}

export function clearGunCache(): void {
  for (const m of merged.values()) m.dispose();
  merged.clear();
  mats.clear();
}
