// Acessórios das armas (mira, silenciador, empunhadura, lanterna, laser, carregador): modelos 3D separados
// (public/assets/attachments/*.glb) presos em pontos de encaixe calculados a partir da própria geometria da arma:
//   - trilho superior (mira): o ponto mais alto sobre a caixa da culatra / ferrolho;
//   - boca do cano (silenciador, compensador): ponta do cano, na altura do eixo do cano;
//   - trilho inferior (empunhadura, lanterna de pistola): parte de baixo do guarda-mão;
//   - lateral esquerda (lanterna, laser): lado do guarda-mão.
// Serve para a arma em primeira pessoa, na mão dos personagens e no arsenal (GLB ou modelo procedural).
// Só visual: não muda nenhum atributo do tiro.
import {
  Color3,
  CreateCylinder,
  LoadAssetContainerAsync,
  Matrix,
  Mesh,
  PBRMaterial,
  StandardMaterial,
  TransformNode,
  Vector3,
  type AbstractMesh,
  type AssetContainer,
  type Material,
  type Scene
} from '../core/babylon';
import { ASSET_BASE, assetExists } from '../assets/AssetRegistry';
import { attachmentById, parseAttachments } from '../cosmetics/Cosmetics';
import { WEAPONS } from './WeaponData';

export interface Mounts {
  top: Vector3;
  muzzle: Vector3;
  under: Vector3;
  side: Vector3;
  pistolUnder: Vector3;
  /** Raio aproximado do cano (escala do silenciador). */
  barrel: number;
}

/** Ajustes finos por arma (somados ao ponto calculado). */
const MOUNT_FIX: Record<string, Partial<Record<keyof Omit<Mounts, 'barrel'>, [number, number, number]>>> = {
  ak47: { top: [0, -0.004, 0.0] },
  m4a4: { top: [0, -0.012, 0.0] },
  m4a1: { top: [0, -0.012, 0.0] },
  mp5: { top: [0, -0.002, 0.0] }
};

let loader: Promise<unknown> | null = null;
function ensureLoader(): Promise<unknown> {
  if (!loader) loader = import('@babylonjs/loaders/glTF/2.0');
  return loader;
}

const containers = new Map<string, Promise<AssetContainer | null>>();

/** Carrega (uma vez por cena) o modelo de um acessório. */
function loadModel(scene: Scene, model: string): Promise<AssetContainer | null> {
  const key = scene.uniqueId + '|' + model;
  let p = containers.get(key);
  if (!p) {
    p = (async () => {
      const path = `attachments/${model}.glb`;
      if (!(await assetExists(path))) return null;
      try {
        await ensureLoader();
        const c = await LoadAssetContainerAsync(ASSET_BASE + path, scene);
        scene.onDisposeObservable.addOnce(() => containers.delete(key));
        return c;
      } catch (e) {
        console.warn('[acessórios]', path, e);
        return null;
      }
    })();
    containers.set(key, p);
  }
  return p;
}

const mountCache = new Map<string, Mounts>();

/** Pontos de encaixe a partir dos vértices das malhas, no espaço do nó raiz da arma (origem = empunhadura). */
export function computeMounts(weapon: string, root: TransformNode, meshes: AbstractMesh[], muzzle: Vector3, leftHand: Vector3, cacheKey?: string): Mounts {
  const hit = cacheKey ? mountCache.get(cacheKey) : undefined;
  if (hit) return hit;
  root.computeWorldMatrix(true);
  const inv = Matrix.Invert(root.getWorldMatrix());
  const pts: Vector3[] = [];
  for (const m of meshes) {
    const pos = m.getVerticesData('position');
    if (!pos) continue;
    m.computeWorldMatrix(true);
    const mm = m.getWorldMatrix().multiply(inv);
    const step = Math.max(3, Math.floor(pos.length / 3 / 3000) * 3);
    for (let i = 0; i < pos.length; i += step) pts.push(Vector3.TransformCoordinates(new Vector3(pos[i], pos[i + 1], pos[i + 2]), mm));
  }
  const cls = WEAPONS[weapon]?.cls ?? 'rifle';
  const pistol = cls === 'pistol';
  let zMax = -Infinity;
  for (const p of pts) zMax = Math.max(zMax, p.z);
  const win = (z0: number, z1: number, xAbs = 1) => pts.filter(p => p.z >= z0 && p.z <= z1 && Math.abs(p.x) <= xAbs);
  const maxY = (l: Vector3[], d: number) => (l.length ? Math.max(...l.map(p => p.y)) : d);
  const minY = (l: Vector3[], d: number) => (l.length ? Math.min(...l.map(p => p.y)) : d);
  // trilho superior
  const tz0 = pistol ? -0.06 : -0.03, tz1 = pistol ? 0.03 : cls === 'smg' ? 0.12 : 0.17;
  const topPts = win(tz0, tz1, 0.02);
  const top = new Vector3(0, maxY(topPts, 0.06), (tz0 + tz1) / 2);
  // cano
  const tip = win(zMax - 0.03, zMax + 1, 0.04);
  const by = tip.length ? tip.reduce((a, p) => a + p.y, 0) / tip.length : muzzle.y;
  const bx = tip.length ? Math.max(...tip.map(p => Math.abs(p.x))) : 0.012;
  const mz = new Vector3(0, by, zMax);
  // guarda-mão
  const uz = pistol ? 0.07 : Math.min(leftHand.z + 0.03, zMax - 0.12);
  const underPts = win(uz - 0.025, uz + 0.025, 0.035);
  const under = new Vector3(0, minY(underPts, -0.03), uz);
  const sz = pistol ? 0.07 : Math.min(uz + 0.06, zMax - 0.08);
  const sidePts = win(sz - 0.03, sz + 0.03);
  const sx = sidePts.length ? Math.min(...sidePts.map(p => p.x)) : -0.03;
  const sy = sidePts.length ? (maxY(sidePts, 0) + minY(sidePts, 0)) / 2 : 0;
  const side = new Vector3(sx, sy, sz);
  const pistolUnder = new Vector3(0, minY(win(0.05, 0.1, 0.03), -0.02), 0.06);
  const res: Mounts = { top, muzzle: mz, under, side, pistolUnder, barrel: Math.max(0.008, bx) };
  const fix = MOUNT_FIX[weapon];
  if (fix) for (const [k, v] of Object.entries(fix)) (res as unknown as Record<string, Vector3>)[k].addInPlace(new Vector3(...v));
  if (cacheKey) mountCache.set(cacheKey, res);
  return res;
}

/** Onde cada acessório encaixa. */
function mountFor(id: string, m: Mounts, pistol: boolean): Vector3 {
  const a = attachmentById(id)!;
  switch (a.slot) {
    case 'optic': return m.top;
    case 'muzzle': return m.muzzle;
    case 'grip': return m.under;
    case 'light': return pistol ? m.pistolUnder : m.side;
    case 'laser': return pistol ? m.pistolUnder.add(new Vector3(0, 0, -0.01)) : m.side.add(new Vector3(0, 0, -0.07));
    default: return Vector3.Zero();
  }
}

/** Comprimento extra que o acessório de cano acrescenta (o clarão do tiro anda junto). */
const MUZZLE_LEN: Record<string, number> = { supp: 0.18, psupp: 0.14, comp: 0.055 };

const magMats = new Map<string, Material>();
const beamMats = new Map<string, StandardMaterial>();

export interface AttachResult {
  nodes: TransformNode[];
  /** Nova posição da boca do cano (com silenciador/compensador), no espaço da arma. */
  muzzle: Vector3 | null;
}

/**
 * Prende os acessórios na arma. `prep` é chamado em cada malha criada (camada de renderização, sombra...).
 * `firstPerson`: feixe do laser curto (a arma em 1ª pessoa é desenhada por cima do cenário).
 */
export async function attachToGun(
  scene: Scene,
  opts: { weapon: string; list: string[] | string; root: TransformNode; meshes: AbstractMesh[]; mag?: TransformNode | null; muzzle: Vector3; leftHand: Vector3; cacheKey?: string; prep?: (m: AbstractMesh) => void; firstPerson?: boolean }
): Promise<AttachResult> {
  const list = typeof opts.list === 'string' ? parseAttachments(opts.weapon, opts.list) : opts.list;
  const res: AttachResult = { nodes: [], muzzle: null };
  if (!list.length) return res;
  const mounts = computeMounts(opts.weapon, opts.root, opts.meshes, opts.muzzle, opts.leftHand, opts.cacheKey);
  const pistol = WEAPONS[opts.weapon]?.cls === 'pistol';
  for (const id of list) {
    const def = attachmentById(id);
    if (!def) continue;
    if (def.finish) {
      paintMag(scene, opts.mag ?? null, id);
      continue;
    }
    if (!def.model) continue;
    const c = await loadModel(scene, def.model);
    if (!c || opts.root.isDisposed()) continue;
    const inst = c.instantiateModelsToScene(n => `att_${id}_${n}`, false, { doNotInstantiate: true });
    const holder = new TransformNode('att_' + id, scene);
    holder.parent = opts.root;
    holder.position.copyFrom(mountFor(id, mounts, pistol));
    if (def.slot === 'muzzle') {
      // silenciador acompanha a grossura do cano (modelos pensados para ~1,2 cm de raio)
      const k = Math.max(0.75, Math.min(1.35, mounts.barrel / 0.0125));
      holder.scaling.set(k, k, 1);
      res.muzzle = mounts.muzzle.add(new Vector3(0, 0, MUZZLE_LEN[id] ?? 0.05));
    }
    for (const r of inst.rootNodes) r.parent = holder;
    for (const m of holder.getChildMeshes(false)) {
      m.isPickable = false;
      opts.prep?.(m);
    }
    for (const a of inst.animationGroups) a.dispose();
    if (def.slot === 'laser') addBeam(scene, holder, pistol, !!opts.firstPerson, opts.prep);
    res.nodes.push(holder);
  }
  return res;
}

function addBeam(scene: Scene, holder: TransformNode, pistol: boolean, fp: boolean, prep?: (m: AbstractMesh) => void): void {
  const key = String(scene.uniqueId);
  let mat = beamMats.get(key);
  if (!mat || mat.getScene() !== scene) {
    mat = new StandardMaterial('laserBeam', scene);
    mat.emissiveColor = new Color3(1, 0.08, 0.05);
    mat.disableLighting = true;
    mat.alpha = 0.35;
    beamMats.set(key, mat);
  }
  const len = fp ? 0.9 : 7;
  const beam = CreateCylinder('laserBeam', { diameter: 0.0016, height: len, tessellation: 6 }, scene);
  beam.material = mat;
  beam.isPickable = false;
  beam.rotation.x = Math.PI / 2;
  beam.parent = holder;
  // emissor do modelo: à esquerda e à frente do ponto de encaixe
  beam.position.set(pistol ? 0 : -0.025, pistol ? -0.02 : 0.006, (pistol ? 0.04 : 0.05) + len / 2);
  prep?.(beam);
}

/** Acabamento do carregador (troca o material das peças do pente). */
function paintMag(scene: Scene, mag: TransformNode | null, id: string): void {
  const def = attachmentById(id);
  if (!mag || !def?.finish) return;
  const key = scene.uniqueId + '|' + id;
  let mat = magMats.get(key);
  if (!mat || mat.getScene() !== scene) {
    const p = new PBRMaterial('mag_' + id, scene);
    p.albedoColor = Color3.FromHexString(def.finish.color).toLinearSpace();
    p.metallic = def.finish.metallic;
    p.roughness = def.finish.roughness;
    mat = p;
    magMats.set(key, mat);
  }
  const meshes = mag instanceof Mesh ? [mag as AbstractMesh, ...mag.getChildMeshes(false)] : mag.getChildMeshes(false);
  for (const m of meshes) {
    if (m instanceof Mesh) m.useVertexColors = false;
    m.material = mat;
  }
}

/** Remove os acessórios presos (troca de configuração). */
export function detachAll(nodes: TransformNode[]): void {
  for (const n of nodes) n.dispose(false, false);
}
