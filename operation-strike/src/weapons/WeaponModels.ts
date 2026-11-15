// Modelos 3D procedurais (originais) de todas as armas, granadas, faca e bomba.
// Cada arma vira poucas malhas com cor por vértice: corpo, pente (animado na recarga) e ferrolho/slide.
// O mesmo modelo é usado na visão em primeira pessoa e nas mãos dos personagens.
// Origem = empunhadura (onde fica a mão direita); +Z = cano.
import { GeoBuilder } from '../core/GeoBuilder';
import { Mesh, StandardMaterial, Color3, TransformNode, Vector3, type Scene } from '../core/babylon';

export interface GunParts {
  root: TransformNode;
  body: Mesh;
  mag: Mesh | null;
  slide: Mesh | null;
  /** Ponto do cano (local). */
  muzzle: Vector3;
  /** Posição local da mão esquerda (guarda-mão). */
  leftHand: Vector3;
}

const METAL = '#2a2c2f';
const METAL2 = '#3c4045';
const POLY = '#232426';
const WOOD = '#7b4a24';

type Parts = { body: GeoBuilder; mag: GeoBuilder; slide: GeoBuilder };

function rifleLike(b: Parts, o: { recv: number; barrel: number; body: string; furn: string; stock: 'wood' | 'poly' | 'fold' | 'none'; mag: 'curved' | 'straight' | 'box' | 'grip' | 'none'; scope?: number; supp?: number; hg?: string; rail?: boolean }): { muzzle: number; left: number } {
  const g = b.body;
  const r = o.recv;
  g.box(0.058, 0.08, r, [0, 0.01, r / 2 - 0.08], o.body);
  g.box(0.05, 0.028, r * 0.85, [0, 0.062, r / 2 - 0.08], METAL2);
  const hgLen = Math.min(0.24, o.barrel * 0.7 + 0.06);
  g.box(0.064, 0.068, hgLen, [0, 0.0, r - 0.08 + hgLen / 2], o.hg ?? o.furn);
  const bStart = r - 0.08;
  g.cyl(0.02, 0.02, o.barrel, [0, 0.008, bStart + o.barrel / 2], METAL, [Math.PI / 2, 0, 0]);
  let muzzle = bStart + o.barrel;
  if (o.supp) {
    g.cyl(0.038, 0.038, o.supp, [0, 0.008, muzzle + o.supp / 2 - 0.02], '#1b1c1d', [Math.PI / 2, 0, 0]);
    muzzle += o.supp - 0.02;
  } else g.cyl(0.03, 0.03, 0.05, [0, 0.008, muzzle], METAL2, [Math.PI / 2, 0, 0]);
  if (!o.scope) {
    g.box(0.01, 0.045, 0.012, [0, 0.05, bStart + o.barrel * 0.8], METAL);
    g.box(0.034, 0.022, 0.025, [0, 0.085, 0.04], METAL);
  }
  if (o.rail) g.box(0.024, 0.04, 0.12, [0, 0.095, 0.05], METAL);
  // empunhadura e gatilho
  g.box(0.034, 0.1, 0.048, [0, -0.07, -0.01], POLY, [-0.32, 0, 0]);
  g.box(0.008, 0.03, 0.035, [0, -0.04, 0.045], METAL);
  // coronha
  if (o.stock === 'wood') {
    g.box(0.048, 0.07, 0.26, [0, -0.02, -0.21], WOOD, [0.1, 0, 0]);
    g.box(0.05, 0.11, 0.025, [0, -0.04, -0.34], POLY, [0.1, 0, 0]);
  } else if (o.stock === 'poly') {
    g.cyl(0.03, 0.03, 0.2, [0, 0.02, -0.17], METAL, [Math.PI / 2, 0, 0]);
    g.box(0.045, 0.085, 0.13, [0, 0.0, -0.27], o.furn);
    g.box(0.048, 0.11, 0.02, [0, -0.01, -0.34], POLY);
  } else if (o.stock === 'fold') {
    g.box(0.012, 0.012, 0.22, [0.022, 0.02, -0.18], METAL);
    g.box(0.012, 0.012, 0.22, [-0.022, 0.02, -0.18], METAL);
    g.box(0.05, 0.07, 0.02, [0, 0.0, -0.29], METAL);
  }
  // luneta
  if (o.scope) {
    const L = o.scope;
    g.cyl(0.038, 0.038, L, [0, 0.11, 0.06], '#1d1f21', [Math.PI / 2, 0, 0], 0, 12);
    g.cyl(0.052, 0.04, 0.06, [0, 0.11, 0.06 + L / 2], '#1d1f21', [Math.PI / 2, 0, 0], 0, 12);
    g.cyl(0.048, 0.04, 0.05, [0, 0.11, 0.06 - L / 2], '#1d1f21', [Math.PI / 2, 0, 0], 0, 12);
    g.box(0.02, 0.04, 0.02, [0, 0.075, 0.0], METAL);
    g.box(0.02, 0.04, 0.02, [0, 0.075, 0.13], METAL);
  }
  // pente
  const m = b.mag;
  if (o.mag === 'curved') {
    m.box(0.036, 0.09, 0.07, [0, -0.08, 0.1], METAL2, [0.12, 0, 0]);
    m.box(0.036, 0.09, 0.07, [0, -0.16, 0.12], METAL2, [0.38, 0, 0]);
  } else if (o.mag === 'straight') {
    m.box(0.032, 0.17, 0.065, [0, -0.11, 0.1], METAL2, [0.08, 0, 0]);
  } else if (o.mag === 'box') {
    m.box(0.04, 0.08, 0.09, [0, -0.07, 0.08], POLY);
  } else if (o.mag === 'grip') {
    m.box(0.03, 0.12, 0.04, [0, -0.15, -0.025], METAL2, [-0.32, 0, 0]);
  }
  return { muzzle, left: Math.min(r - 0.08 + hgLen * 0.6, 0.32) };
}

function pistolLike(b: Parts, o: { slide: number; color: string; frame: string; supp?: number; big?: boolean }): { muzzle: number; left: number } {
  const s = b.slide;
  const k = o.big ? 1.25 : 1;
  s.box(0.034 * k, 0.038 * k, o.slide, [0, 0.03, o.slide / 2 - 0.05], o.color);
  s.box(0.008, 0.012, 0.01, [0, 0.055 * k, o.slide - 0.06], METAL2);
  s.box(0.024, 0.012, 0.012, [0, 0.055 * k, -0.04], METAL2);
  const g = b.body;
  g.box(0.03 * k, 0.03, o.slide * 0.85, [0, 0.0, o.slide * 0.42 - 0.05], o.frame);
  g.box(0.012, 0.03, 0.045, [0, -0.025, 0.03], o.frame);
  g.box(0.032 * k, 0.11 * k, 0.05 * k, [0, -0.06, -0.03], o.frame, [-0.22, 0, 0]);
  let muzzle = o.slide - 0.05;
  if (o.supp) {
    g.cyl(0.032, 0.032, o.supp, [0, 0.03, muzzle + o.supp / 2], '#1b1c1d', [Math.PI / 2, 0, 0]);
    muzzle += o.supp;
  }
  b.mag.box(0.03, 0.02, 0.045, [0, -0.12 * k, -0.045], METAL2, [-0.22, 0, 0]);
  return { muzzle, left: -0.01 };
}

function buildParts(id: string): { parts: Parts; muzzle: number; left: number } {
  const parts: Parts = { body: new GeoBuilder(), mag: new GeoBuilder(), slide: new GeoBuilder() };
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
      g.box(0.022, 0.03, 0.11, [0, 0, 0], '#1c1c1c');
      g.box(0.05, 0.012, 0.015, [0, 0, 0.06], METAL2);
      g.box(0.006, 0.032, 0.17, [0, 0.004, 0.15], '#b8bec4');
      g.box(0.006, 0.014, 0.05, [0, 0.022, 0.21], '#9aa0a6', [0.5, 0, 0]);
      r = { muzzle: 0.24, left: -0.05 };
      break;
    }
    case 'he': {
      parts.body.sphere(0.07, [0, 0.02, 0.02], '#4b5a32', [1, 1.15, 1]);
      parts.body.box(0.012, 0.06, 0.016, [0.025, 0.06, 0.02], METAL2, [0, 0, -0.3]);
      parts.body.cyl(0.02, 0.02, 0.02, [0, 0.065, 0.02], METAL2);
      r = { muzzle: 0.05, left: -0.05 };
      break;
    }
    case 'flash':
    case 'smoke': {
      const col = id === 'flash' ? '#6b6f73' : '#4f5d4b';
      parts.body.cyl(0.05, 0.05, id === 'flash' ? 0.1 : 0.13, [0, 0.03, 0.02], col);
      parts.body.cyl(0.02, 0.02, 0.025, [0, 0.1, 0.02], METAL2);
      parts.body.box(0.012, 0.07, 0.016, [0.03, 0.06, 0.02], METAL2, [0, 0, -0.2]);
      r = { muzzle: 0.05, left: -0.05 };
      break;
    }
    case 'c4': {
      const g = parts.body;
      g.box(0.16, 0.06, 0.1, [0, 0.0, 0.06], '#6c6352');
      g.box(0.07, 0.012, 0.06, [0.03, 0.035, 0.06], '#1f2a1f');
      g.box(0.05, 0.006, 0.02, [0.03, 0.043, 0.075], '#5dff6a');
      g.box(0.04, 0.05, 0.08, [-0.05, 0.03, 0.06], '#a84a2a');
      g.cyl(0.006, 0.006, 0.14, [-0.01, 0.035, 0.06], '#c22', [0, 0, Math.PI / 2]);
      r = { muzzle: 0.1, left: 0.08 };
      break;
    }
  }
  return { parts, muzzle: r.muzzle, left: r.left };
}

let sharedMat: StandardMaterial | null = null;

export function gunMaterial(scene: Scene): StandardMaterial {
  if (sharedMat && sharedMat.getScene() === scene) return sharedMat;
  sharedMat = new StandardMaterial('gunMat', scene);
  sharedMat.diffuseColor = Color3.White();
  sharedMat.specularColor = new Color3(0.35, 0.35, 0.35);
  sharedMat.specularPower = 48;
  return sharedMat;
}

/** Arma completa com partes animáveis (primeira pessoa). */
export function buildGun(id: string, scene: Scene): GunParts {
  const { parts, muzzle, left } = buildParts(id);
  const root = new TransformNode('gun_' + id, scene);
  const mat = gunMaterial(scene);
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

/** Malha única (corpo+pente+ferrolho) para as mãos dos personagens, compartilhada por instâncias. */
export function gunSource(id: string, scene: Scene): Mesh {
  const key = id;
  const hit = merged.get(key);
  if (hit && !hit.isDisposed()) return hit;
  const { parts } = buildParts(id);
  const all = new GeoBuilder();
  for (const g of [parts.body, parts.mag, parts.slide]) if (g.vertexCount) all.merge(g);
  const m = all.build('gunSrc_' + id, scene);
  m.material = gunMaterial(scene);
  m.isVisible = false;
  merged.set(key, m);
  return m;
}

export function clearGunCache(): void {
  for (const m of merged.values()) m.dispose();
  merged.clear();
  sharedMat = null;
}
