// Visual personalizado dos personagens (soldado.glb / terrorista.glb), sem alterar os modelos originais:
//  1) Cor/camuflagem por região (colete, uniforme, calças, luvas, botas, capacete/lenço): uma textura nova é
//     composta UMA vez na GPU a partir da textura original — o brilho e os detalhes do tecido são mantidos e só a
//     cor muda; a camuflagem é projetada em 3D (pose de repouso), contínua entre as ilhas de UV.
//     Mapas por personagem: characters/<nome>_regions.png, _pos.png, _nrm.png (scripts/blender/region_maps.py).
//  2) Peças 3D (capacete, máscara, óculos, mochila, acessórios): cosmetics/<peça>_<CT|T>.glb, já encaixadas em
//     cada modelo; cada malha "nome@Osso" é presa ao osso e acompanha as animações.
// Tudo é carregado sob demanda e reaproveitado (texturas por combinação, materiais por cor, modelos por cena).
import {
  Color3,
  Matrix,
  PBRMaterial,
  ProceduralTexture,
  ShaderStore,
  Texture,
  TransformNode,
  Vector3,
  Quaternion,
  LoadAssetContainerAsync,
  type AbstractMesh,
  type AssetContainer,
  type BaseTexture,
  type Material,
  type Scene
} from '../core/babylon';
import { ASSET_BASE, assetExists } from '../assets/AssetRegistry';
import type { Team } from '../sim/types';
import { finishOf, gearById, type CharSlot, type Look } from './Cosmetics';
import { seamlessPattern } from '../weapons/SkinPatterns';

const FILE: Record<Team, string> = { CT: 'characters/soldado', T: 'characters/terrorista' };

// Regiões no mapa: 1 colete, 2 uniforme, 3 calças, 4 luvas, 5 botas, 6 cobertura original da cabeça.

/** Padrão desenhado para cada tipo de acabamento. */
const PATTERN: Record<string, string> = {
  solid: 'solid', woodland: 'woodland', desert: 'desert', arid: 'camo', digital: 'digital', snow: 'snow', tiger: 'tiger', urban: 'digital', blackgold: 'damascus'
};

interface RegionInfo {
  min: number[];
  max: number[];
  mean: number[];
}

interface RegionMaps {
  regions: Texture;
  pos: Texture;
  nrm: Texture;
  info: RegionInfo;
}

ShaderStore.ShadersStore['lookComposePixelShader'] = `
precision highp float;
varying vec2 vUV;
uniform sampler2D albedo;
uniform sampler2D regions;
uniform sampler2D posmap;
uniform sampler2D nrmmap;
uniform sampler2D pat1;
uniform sampler2D pat2;
uniform sampler2D pat3;
uniform sampler2D pat4;
uniform sampler2D pat5;
uniform sampler2D pat6;
uniform vec4 act1;
uniform vec4 act2;
uniform vec4 mean1;
uniform vec4 mean2;
uniform vec3 boxSize;
uniform float linIn;
vec3 tri(sampler2D t, vec3 p, vec3 n) {
  vec3 w = pow(abs(n), vec3(4.0));
  w /= (w.x + w.y + w.z + 1e-4);
  float s = 1.0 / 0.55;
  return texture2D(t, p.yz * s).rgb * w.x + texture2D(t, p.xz * s).rgb * w.y + texture2D(t, p.xy * s).rgb * w.z;
}
void main(void) {
  vec4 base = texture2D(albedo, vUV);
  // a textura original pode chegar já linearizada (buffer sRGB): tudo é calculado e gravado em sRGB
  if (linIn > 0.5) base.rgb = pow(max(base.rgb, vec3(0.0)), vec3(1.0 / 2.2));
  float r = floor(texture2D(regions, vUV).r * 255.0 / 32.0 + 0.5);
  float act = 0.0;
  float mean = 0.3;
  if (r > 0.5 && r < 1.5) { act = act1.x; mean = mean1.x; }
  else if (r < 2.5) { act = act1.y; mean = mean1.y; }
  else if (r < 3.5) { act = act1.z; mean = mean1.z; }
  else if (r < 4.5) { act = act1.w; mean = mean1.w; }
  else if (r < 5.5) { act = act2.x; mean = mean2.x; }
  else if (r < 6.5) { act = act2.y; mean = mean2.y; }
  if (r < 0.5 || act < 0.5) { gl_FragColor = vec4(base.rgb, 1.0); return; }
  vec3 p = texture2D(posmap, vUV).rgb * boxSize;
  vec3 n = texture2D(nrmmap, vUV).rgb * 2.0 - 1.0;
  vec3 pc = vec3(1.0);
  if (r < 1.5) pc = tri(pat1, p, n);
  else if (r < 2.5) pc = tri(pat2, p, n);
  else if (r < 3.5) pc = tri(pat3, p, n);
  else if (r < 4.5) pc = tri(pat4, p, n);
  else if (r < 5.5) pc = tri(pat5, p, n);
  else pc = tri(pat6, p, n);
  float lum = dot(base.rgb, vec3(0.299, 0.587, 0.114));
  // fivelas, fitas e costuras muito escuras continuam como estão (exceto colete, luvas e botas)
  float keep = (r > 1.5 && r < 3.5) || r > 5.5 ? 1.0 - smoothstep(0.035, 0.09, lum) : 0.0;
  // luvas: os dedos de fora (pele) não mudam
  float skin = 0.0;
  if (r > 3.5 && r < 4.5) skin = step(0.06, base.r - base.g) * step(0.03, base.g - base.b) * step(0.28, base.r);
  float shade = clamp(pow(lum / max(0.04, mean), 0.85), 0.3, 1.6);
  vec3 col = pc * shade;
  float w = (1.0 - keep) * (1.0 - skin);
  gl_FragColor = vec4(mix(base.rgb, col, w), 1.0);
}`;

const maps = new Map<string, Promise<RegionMaps | null>>();

function loadMaps(scene: Scene, team: Team): Promise<RegionMaps | null> {
  const key = scene.uniqueId + '|' + team;
  let p = maps.get(key);
  if (!p) {
    p = (async () => {
      const f = FILE[team];
      if (!(await assetExists(f + '_regions.json'))) return null;
      try {
        const info = (await (await fetch(ASSET_BASE + f + '_regions.json')).json()) as RegionInfo;
        const tex = (n: string, nearest: boolean) => {
          const t = new Texture(ASSET_BASE + f + '_' + n + '.png', scene, true, false, nearest ? Texture.NEAREST_SAMPLINGMODE : Texture.BILINEAR_SAMPLINGMODE);
          t.gammaSpace = false;
          return t;
        };
        const m = { regions: tex('regions', true), pos: tex('pos', false), nrm: tex('nrm', false), info };
        await Promise.all([m.regions, m.pos, m.nrm].map(t => new Promise<void>(res => (t.isReady() ? res() : t.onLoadObservable.addOnce(() => res())))));
        scene.onDisposeObservable.addOnce(() => maps.delete(key));
        return m;
      } catch (e) {
        console.warn('[visual] mapas de região', e);
        return null;
      }
    })();
    maps.set(key, p);
  }
  return p;
}

const patterns = new Map<string, Texture>();
function patternTexture(scene: Scene, finishId: string): Texture {
  const key = scene.uniqueId + '|' + finishId;
  let t = patterns.get(key);
  if (t && t.getScene() === scene) return t;
  const f = finishOf(finishId);
  const cv = seamlessPattern('finish_' + f.id, PATTERN[f.pattern] ?? 'solid', f.colors.length ? f.colors : ['#808080'], 256);
  const tex = new Texture(cv.toDataURL('image/png'), scene, false, false, Texture.TRILINEAR_SAMPLINGMODE);
  tex.wrapU = tex.wrapV = Texture.WRAP_ADDRESSMODE;
  patterns.set(key, tex);
  t = tex;
  return t;
}

/** Acabamentos que mudam a textura (parte → acabamento), na ordem das regiões 1..6. */
export function finishKey(look: Look): string {
  const head = gearById(look.helmet)?.headFinish ?? 'orig';
  return [look.vest, look.uniform, look.pants, look.gloves, look.boots, head].join('|');
}

const composed = new Map<string, Promise<BaseTexture | null>>();

/**
 * Textura de cor com os acabamentos aplicados (composta uma vez por combinação e tamanho).
 * null quando nada muda (usa a original) ou se os mapas não existirem.
 */
export function composeAlbedo(scene: Scene, team: Team, base: BaseTexture, look: Look, size: number): Promise<BaseTexture | null> {
  const fk = finishKey(look);
  if (fk.split('|').every(x => x === 'orig')) return Promise.resolve(null);
  const key = `${scene.uniqueId}|${team}|${fk}|${size}`;
  let p = composed.get(key);
  if (!p) {
    p = (async () => {
      const m = await loadMaps(scene, team);
      if (!m) return null;
      const ids = fk.split('|');
      const pt = new ProceduralTexture('look_' + team + '_' + fk, size, 'lookCompose', scene, null, true, false);
      pt.refreshRate = 0;
      pt.setTexture('albedo', base);
      pt.setTexture('regions', m.regions);
      pt.setTexture('posmap', m.pos);
      pt.setTexture('nrmmap', m.nrm);
      const act: number[] = [];
      ids.forEach((id, i) => {
        act.push(id === 'orig' ? 0 : 1);
        pt.setTexture('pat' + (i + 1), patternTexture(scene, id === 'orig' ? 'olive' : id));
      });
      pt.setVector4('act1', { x: act[0], y: act[1], z: act[2], w: act[3] });
      pt.setVector4('act2', { x: act[4], y: act[5], z: 0, w: 0 });
      const mean = m.info.mean;
      pt.setVector4('mean1', { x: mean[1], y: mean[2], z: mean[3], w: mean[4] });
      pt.setVector4('mean2', { x: mean[5], y: mean[6], z: 0, w: 0 });
      pt.setVector3('boxSize', new Vector3(m.info.max[0] - m.info.min[0], m.info.max[1] - m.info.min[1], m.info.max[2] - m.info.min[2]));
      const internal = base.getInternalTexture() as unknown as { _useSRGBBuffer?: boolean } | null;
      pt.setFloat('linIn', internal?._useSRGBBuffer ? 1 : 0);
      pt.gammaSpace = true;
      pt.wrapU = pt.wrapV = Texture.CLAMP_ADDRESSMODE;
      await new Promise<void>(res => pt.onGeneratedObservable.addOnce(() => res()));
      return pt as unknown as BaseTexture;
    })();
    composed.set(key, p);
    // poucas combinações vivas por cena (bots usam poucas variações)
    if (composed.size > 24) {
      const first = composed.keys().next().value as string;
      void composed.get(first)?.then(t => t?.dispose());
      composed.delete(first);
    }
  }
  return p;
}

// ====================================================================== peças 3D

const gearContainers = new Map<string, Promise<AssetContainer | null>>();
let loader: Promise<unknown> | null = null;

function loadGear(scene: Scene, model: string, team: Team): Promise<AssetContainer | null> {
  const key = `${scene.uniqueId}|${model}|${team}`;
  let p = gearContainers.get(key);
  if (!p) {
    p = (async () => {
      const path = `cosmetics/${model}_${team}.glb`;
      if (!(await assetExists(path))) return null;
      try {
        if (!loader) loader = import('@babylonjs/loaders/glTF/2.0');
        await loader;
        const c = await LoadAssetContainerAsync(ASSET_BASE + path, scene);
        scene.onDisposeObservable.addOnce(() => gearContainers.delete(key));
        return c;
      } catch (e) {
        console.warn('[visual] peça', path, e);
        return null;
      }
    })();
    gearContainers.set(key, p);
  }
  return p;
}

const paintMats = new Map<string, Material>();
function paintMaterial(scene: Scene, base: Material, color: string): Material {
  const key = `${scene.uniqueId}|${base.uniqueId}|${color}`;
  let m = paintMats.get(key);
  if (!m || m.getScene() !== scene) {
    const c = (base as PBRMaterial).clone(base.name + '_' + color) as PBRMaterial;
    c.albedoColor = Color3.FromHexString(color).toLinearSpace();
    if (/^#(d4a63c|c99a32|e0b04a)/i.test(color)) {
      c.metallic = 1;
      c.roughness = 0.22;
    }
    m = c;
    paintMats.set(key, m);
  }
  return m;
}

/** Peças presas a um personagem (uma por parte do corpo). */
export class GearSet {
  private items = new Map<CharSlot, { model: string; color: string; nodes: TransformNode[] }>();
  private token = 0;
  meshes: AbstractMesh[] = [];
  /** Avisado quando as malhas mudam (para visibilidade/proteção). */
  onChange: (() => void) | null = null;

  constructor(
    private scene: Scene,
    private team: Team,
    /** Osso pelo nome. */
    private bone: (name: string) => TransformNode | undefined,
    /** Matriz do osso na pose de repouso, relativa à raiz do personagem. */
    private restOf: (name: string) => Matrix | undefined,
    /** Matriz local do modelo (nó raiz do GLB) relativa à raiz do personagem. */
    private modelLocal: Matrix,
    private prep: (m: AbstractMesh) => void
  ) {}

  /** Aplica as peças 3D do visual (só carrega o que mudou). */
  apply(look: Look): void {
    const token = ++this.token;
    for (const slot of ['helmet', 'mask', 'glasses', 'backpack', 'accessory'] as CharSlot[]) {
      const g = gearById(look[slot]);
      const model = g?.model ?? '';
      const color = g?.color ?? '';
      const cur = this.items.get(slot);
      if (cur && cur.model === model && cur.color === color) continue;
      if (cur) {
        for (const n of cur.nodes) n.dispose(false, false);
        this.items.delete(slot);
      }
      if (!model) continue;
      const entry = { model, color, nodes: [] as TransformNode[] };
      this.items.set(slot, entry);
      void loadGear(this.scene, model, this.team).then(c => {
        if (!c || token !== this.token && this.items.get(slot) !== entry) return;
        if (this.items.get(slot) !== entry) return;
        entry.nodes = this.mount(c, color);
        this.refresh();
      });
    }
    this.refresh();
  }

  private mount(c: AssetContainer, color: string): TransformNode[] {
    const inst = c.instantiateModelsToScene(n => 'gear_' + n, false, { doNotInstantiate: true });
    const acc = inst.rootNodes[0] as TransformNode;
    acc.parent = null;
    acc.computeWorldMatrix(true);
    const accInv = Matrix.Invert(acc.getWorldMatrix());
    const out: TransformNode[] = [];
    for (const m of acc.getChildMeshes(false)) {
      const boneName = (m.name.split('@')[1] ?? 'Head').replace(/_primitive\d+$/, '').replace(/\.\d{3}$/, '');
      const bone = this.bone(boneName);
      const rest = this.restOf(boneName);
      if (!bone || !rest) continue;
      m.computeWorldMatrix(true);
      // posição da peça no espaço do modelo (mesmo referencial do personagem) → relativa ao osso em repouso
      const inModel = m.getWorldMatrix().multiply(accInv);
      const inRoot = inModel.multiply(this.modelLocal);
      const local = inRoot.multiply(Matrix.Invert(rest));
      const s = new Vector3(), q = new Quaternion(), t = new Vector3();
      local.decompose(s, q, t);
      const holder = new TransformNode('gearAt_' + boneName, this.scene);
      holder.parent = bone;
      m.parent = holder;
      m.position.set(0, 0, 0);
      m.rotationQuaternion = Quaternion.Identity();
      m.scaling.set(1, 1, 1);
      holder.position.copyFrom(t);
      holder.rotationQuaternion = q;
      holder.scaling.copyFrom(s);
      if (color && m.material && /^paint/i.test(m.material.name)) m.material = paintMaterial(this.scene, m.material, color);
      this.prep(m);
      out.push(holder);
    }
    for (const a of inst.animationGroups) a.dispose();
    acc.dispose(false, false);
    return out;
  }

  private refresh(): void {
    this.meshes = [];
    for (const it of this.items.values()) for (const n of it.nodes) this.meshes.push(...n.getChildMeshes(false));
    this.onChange?.();
  }

  dispose(): void {
    this.token++;
    for (const it of this.items.values()) for (const n of it.nodes) n.dispose(false, false);
    this.items.clear();
    this.meshes = [];
  }
}
