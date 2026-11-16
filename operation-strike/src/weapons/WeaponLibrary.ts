// Biblioteca de modelos GLB das armas e das mãos.
// - Verifica se o arquivo existe antes de carregar (AssetRegistry) e carrega sob demanda.
// - Normaliza qualquer modelo: eixo do cano → +Z, "para cima" → +Y, escala para o tamanho real,
//   empunhadura na origem (onde fica a mão direita). Ajustes finos opcionais em weapons.json.
// - Encontra pente e ferrolho pelo nome das peças (animados na recarga).
// - Aplica skins nos materiais (texturas da pasta da skin ou padrão procedural) sem mexer no combate.
// - Mantém poucos modelos na memória (os menos usados são descartados).
import {
  AssetContainer,
  Color3,
  DynamicTexture,
  LoadAssetContainerAsync,
  Matrix,
  PBRMaterial,
  Quaternion,
  StandardMaterial,
  Texture,
  TransformNode,
  Vector3,
  type AbstractMesh,
  type AnimationGroup,
  type Material,
  type Scene
} from '../core/babylon';
import { ASSET_BASE, HANDS_MODEL, WEAPON_MODELS, assetExists, findSkinMap, weaponConfigs, type WeaponModelConfig } from '../assets/AssetRegistry';
import { WEAPONS } from './WeaponData';
import { skinById } from './Skins';
import { skinAlbedo, skinNormal } from './SkinPatterns';

/** Comprimento real aproximado (m) usado para escalar os modelos. */
const REAL_LENGTH: Record<string, number> = {
  ak47: 0.88, m4a1: 0.98, m4a4: 0.84, aug: 0.79, awp: 1.24, ssg08: 1.1, deagle: 0.27, glock: 0.19,
  mp5: 0.68, ump45: 0.69, usp: 0.33, p250: 0.18, mac10: 0.27, knife: 0.3
};
const GRIP_AT: Record<string, number> = { rifle: 0.4, sniper: 0.42, smg: 0.45, pistol: 0.3, knife: 0.22 };

export interface GlbGun {
  root: TransformNode;
  meshes: AbstractMesh[];
  mag: TransformNode | null;
  slide: TransformNode | null;
  muzzle: Vector3;
  leftHand: Vector3;
  animations: AnimationGroup[];
}

interface Loaded {
  id: string;
  container: AssetContainer;
  /** Rotação/escala/deslocamento que normalizam o modelo. */
  rot: Quaternion;
  scale: number;
  offset: Vector3;
  length: number;
  height: number;
  muzzle: Vector3;
  leftHand: Vector3;
  cfg: WeaponModelConfig;
  lastUse: number;
  /** Cópias vivas na cena (não descarta o modelo enquanto alguma existir). */
  refs: number;
}

const AXES: Record<string, Vector3> = {
  '+x': new Vector3(1, 0, 0), '-x': new Vector3(-1, 0, 0), '+y': new Vector3(0, 1, 0),
  '-y': new Vector3(0, -1, 0), '+z': new Vector3(0, 0, 1), '-z': new Vector3(0, 0, -1)
};

let loaderReady: Promise<unknown> | null = null;
function ensureLoader(): Promise<unknown> {
  // o carregador glTF só entra no pacote quando existe algum modelo
  if (!loaderReady) loaderReady = import('@babylonjs/loaders/glTF/2.0');
  return loaderReady;
}

export class WeaponLibrary {
  private loaded = new Map<string, Loaded>();
  private pending = new Map<string, Promise<Loaded | null>>();
  private skinMats = new Map<string, Material>();
  private skinTex = new Map<string, Promise<Texture | null>>();
  /** Quantos modelos ficam na memória (menos no celular / qualidade baixa). */
  maxLoaded = 6;
  /** Tamanho máximo das texturas de skin (compressão por redimensionamento). */
  textureSize = 1024;
  enabled = true;
  errors: string[] = [];

  constructor(private scene: Scene) {}

  async has(id: string): Promise<boolean> {
    const path = WEAPON_MODELS[id];
    return !!path && this.enabled && (await assetExists(path));
  }

  /** Carrega (uma vez) e normaliza o modelo da arma. null = não existe ou falhou. */
  load(id: string): Promise<Loaded | null> {
    const hit = this.loaded.get(id);
    if (hit) {
      hit.lastUse = performance.now();
      return Promise.resolve(hit);
    }
    let p = this.pending.get(id);
    if (!p) {
      p = this.doLoad(id).finally(() => this.pending.delete(id));
      this.pending.set(id, p);
    }
    return p;
  }

  private async doLoad(id: string): Promise<Loaded | null> {
    if (!(await this.has(id))) return null;
    try {
      await ensureLoader();
      const container = await LoadAssetContainerAsync(ASSET_BASE + WEAPON_MODELS[id], this.scene);
      const cfg = (await weaponConfigs())[id] ?? {};
      const l = this.normalize(id, container, cfg);
      this.loaded.set(id, l);
      this.evict();
      return l;
    } catch (e) {
      const msg = `Falha ao carregar ${WEAPON_MODELS[id]}: ${(e as Error).message}`;
      console.error('[armas]', msg);
      this.errors.push(msg);
      return null;
    }
  }

  private evict(): void {
    if (this.loaded.size <= this.maxLoaded) return;
    const old = [...this.loaded.values()].filter(l => l.refs <= 0).sort((a, b) => a.lastUse - b.lastUse)[0];
    if (!old) return;
    old.container.dispose();
    this.loaded.delete(old.id);
  }

  private static perScene = new Map<number, WeaponLibrary>();

  /** Uma biblioteca por cena (primeira pessoa, personagens e lobby compartilham os modelos carregados). */
  static forScene(scene: Scene): WeaponLibrary {
    let lib = WeaponLibrary.perScene.get(scene.uniqueId);
    if (!lib) {
      lib = new WeaponLibrary(scene);
      WeaponLibrary.perScene.set(scene.uniqueId, lib);
      const l = lib;
      scene.onDisposeObservable.addOnce(() => {
        WeaponLibrary.perScene.delete(scene.uniqueId);
        l.dispose();
      });
    }
    return lib;
  }

  /** Calcula a normalização a partir dos vértices do modelo. */
  private normalize(id: string, container: AssetContainer, cfg: WeaponModelConfig): Loaded {
    const pts: Vector3[] = [];
    for (const m of container.meshes) {
      const pos = m.getVerticesData?.('position');
      if (!pos) continue;
      const wm = m.computeWorldMatrix(true);
      const step = Math.max(3, Math.floor(pos.length / 3 / 4000) * 3); // amostra até ~4000 vértices por malha
      for (let i = 0; i < pos.length; i += step) pts.push(Vector3.TransformCoordinates(new Vector3(pos[i], pos[i + 1], pos[i + 2]), wm));
    }
    const min = new Vector3(Infinity, Infinity, Infinity), max = new Vector3(-Infinity, -Infinity, -Infinity);
    for (const p of pts) {
      min.minimizeInPlace(p);
      max.maximizeInPlace(p);
    }
    const ext = max.subtract(min);
    const center = min.add(max).scale(0.5);
    const comps = [ext.x, ext.y, ext.z];
    const axisVec = (i: number) => (i === 0 ? new Vector3(1, 0, 0) : i === 1 ? new Vector3(0, 1, 0) : new Vector3(0, 0, 1));
    const get = (v: Vector3, i: number) => (i === 0 ? v.x : i === 1 ? v.y : v.z);

    // eixo do cano = maior dimensão; sentido = ponta mais fina (o cano), não a coronha
    let fwd: Vector3;
    let fi = comps.indexOf(Math.max(...comps));
    if (cfg.forward && AXES[cfg.forward]) {
      fwd = AXES[cfg.forward].clone();
      fi = Math.abs(fwd.x) ? 0 : Math.abs(fwd.y) ? 1 : 2;
    } else {
      const lo = get(min, fi), hi = get(max, fi), span = hi - lo;
      const section = (from: number, to: number) => {
        const sMin = [Infinity, Infinity, Infinity], sMax = [-Infinity, -Infinity, -Infinity];
        for (const p of pts) {
          const c = get(p, fi);
          if (c < from || c > to) continue;
          for (let k = 0; k < 3; k++) {
            sMin[k] = Math.min(sMin[k], get(p, k));
            sMax[k] = Math.max(sMax[k], get(p, k));
          }
        }
        let area = 1;
        for (let k = 0; k < 3; k++) if (k !== fi) area *= Math.max(0, sMax[k] - sMin[k]);
        return area;
      };
      const front = section(hi - span * 0.12, hi), back = section(lo, lo + span * 0.12);
      fwd = axisVec(fi).scale(front <= back ? 1 : -1);
    }
    // "para cima": das duas dimensões restantes, a maior (armas são mais altas que largas);
    // sentido: pente e empunhadura ficam embaixo, então o centro de massa fica abaixo do centro
    let up: Vector3;
    if (cfg.up && AXES[cfg.up]) up = AXES[cfg.up].clone();
    else {
      const rest = [0, 1, 2].filter(i => i !== fi).sort((a, b) => comps[b] - comps[a]);
      const ui = rest[0];
      // a mediana fica no corpo principal; pente e empunhadura se projetam mais longe para baixo
      const vals = pts.map(p => get(p, ui)).sort((a, b) => a - b);
      const median = vals[Math.floor(vals.length / 2)] ?? get(center, ui);
      const below = median - get(min, ui), above = get(max, ui) - median;
      up = axisVec(ui).scale(below >= above ? 1 : -1);
    }
    const right = Vector3.Cross(up, fwd).normalize();
    // matriz cujas linhas são os eixos do modelo → leva o modelo para o sistema da arma (+X, +Y, +Z)
    const m = Matrix.FromValues(right.x, up.x, fwd.x, 0, right.y, up.y, fwd.y, 0, right.z, up.z, fwd.z, 0, 0, 0, 0, 1);
    const rot = Quaternion.FromRotationMatrix(m);
    const length = Math.abs(get(ext, fi));
    const target = cfg.length ?? REAL_LENGTH[id] ?? 0.8;
    const scale = target / Math.max(1e-4, length);
    // pontos normalizados (sem deslocamento) para achar empunhadura, cano e guarda-mão
    const norm = pts.map(p => p.subtract(center).applyRotationQuaternion(rot).scale(scale));
    const nMin = new Vector3(Infinity, Infinity, Infinity), nMax = new Vector3(-Infinity, -Infinity, -Infinity);
    for (const p of norm) {
      nMin.minimizeInPlace(p);
      nMax.maximizeInPlace(p);
    }
    const cls = WEAPONS[id]?.cls ?? 'rifle';
    const gripAt = cfg.gripAt ?? (id === 'aug' ? 0.55 : GRIP_AT[cls] ?? 0.4);
    const gripH = cfg.gripHeight ?? 0.62;
    const L = nMax.z - nMin.z, H = nMax.y - nMin.y;
    const origin = new Vector3(0, nMin.y + H * gripH, nMin.z + L * gripAt);
    const offset = origin.scale(-1);
    if (cfg.offset) offset.addInPlace(new Vector3(...cfg.offset));
    const muzzle = new Vector3(0, nMin.y + H * 0.78, nMax.z).add(offset);
    const leftHand = cls === 'pistol' ? new Vector3(-0.03, -0.085, -0.02) : new Vector3(-0.01, nMin.y + H * 0.45, nMin.z + L * Math.min(0.8, gripAt + 0.3)).add(offset);
    let finalRot = rot;
    if (cfg.rotation) finalRot = Quaternion.FromEulerAngles(...(cfg.rotation.map(d => (d * Math.PI) / 180) as [number, number, number])).multiply(rot);
    return { id, container, rot: finalRot, scale, offset: offset.subtract(Vector3.Zero()), length: L, height: H, muzzle, leftHand, cfg, lastUse: performance.now(), refs: 0, ...{ center } } as Loaded & { center: Vector3 };
  }

  /** Cria uma cópia da arma pronta para uso, já com a skin. */
  async instantiate(id: string, skin: string): Promise<GlbGun | null> {
    const l = await this.load(id);
    if (!l) return null;
    l.lastUse = performance.now();
    const center = (l as Loaded & { center: Vector3 }).center;
    const inst = l.container.instantiateModelsToScene(n => `${id}_${n}`, false, { doNotInstantiate: true });
    // hierarquia: root (empunhadura) → pivot (escala/rotação/centro) → nós do modelo
    const root = new TransformNode('glb_' + id, this.scene);
    l.refs++;
    root.onDisposeObservable.addOnce(() => {
      l.refs--;
    });
    const offsetNode = new TransformNode('glbOffset_' + id, this.scene);
    offsetNode.parent = root;
    offsetNode.position.copyFrom(l.offset);
    const pivot = new TransformNode('glbPivot_' + id, this.scene);
    pivot.parent = offsetNode;
    pivot.rotationQuaternion = l.rot.clone();
    pivot.scaling.setAll(l.scale);
    const center2 = new TransformNode('glbCenter_' + id, this.scene);
    center2.parent = pivot;
    center2.position = center.scale(-1);
    for (const n of inst.rootNodes) n.parent = center2;
    const meshes = center2.getChildMeshes(false);
    // peças animadas (por nome)
    const find = (re: RegExp) => (center2.getDescendants(false).find(n => re.test(n.name)) as TransformNode | undefined) ?? null;
    const magRe = l.cfg.magazine ? new RegExp(l.cfg.magazine, 'i') : /mag(azine)?|clip|carregador|pente/i;
    const slideRe = l.cfg.slide ? new RegExp(l.cfg.slide, 'i') : /slide|bolt|ferrolho|charging|handle_pull/i;
    let mag = find(magRe), slide = find(slideRe);
    // reparenta mantendo a posição no mundo, para animar no espaço da arma
    root.computeWorldMatrix(true);
    for (const n of [mag, slide]) if (n) n.setParent(root);
    if (mag && mag === slide) slide = null;
    await this.applySkin(meshes, id, skin);
    return { root, meshes, mag, slide, muzzle: l.muzzle.clone(), leftHand: l.leftHand.clone(), animations: inst.animationGroups };
  }

  // ------------------------------------------------------------------ skins

  private loadSkinTexture(path: string): Promise<Texture | null> {
    let p = this.skinTex.get(path);
    if (!p) {
      p = (async () => {
        try {
          // "compressão": reduz a resolução conforme a qualidade antes de enviar à GPU
          const blob = await (await fetch(ASSET_BASE + path)).blob();
          const bmp = await createImageBitmap(blob);
          const size = Math.min(this.textureSize, Math.max(bmp.width, bmp.height));
          const tex = new DynamicTexture('skinMap_' + path, { width: size, height: size }, this.scene, true);
          (tex.getContext() as unknown as CanvasRenderingContext2D).drawImage(bmp, 0, 0, size, size);
          tex.update(false);
          bmp.close();
          return tex as unknown as Texture;
        } catch (e) {
          this.errors.push(`Textura inválida: ${path}`);
          console.warn('[skins]', path, e);
          return null;
        }
      })();
      this.skinTex.set(path, p);
    }
    return p;
  }

  private details = new Map<string, Texture | null>();

  /** Mapa de detalhe do Babylon (R = cor neutra, G/A = normal, B = rugosidade neutra) a partir do relevo da skin. */
  private skinDetail(skinId: string): Texture | null {
    if (this.details.has(skinId)) return this.details.get(skinId)!;
    const n = skinNormal(skinId, 512);
    let tex: Texture | null = null;
    if (n) {
      const src = n.getContext('2d')!.getImageData(0, 0, n.width, n.height);
      const d = src.data;
      for (let i = 0; i < d.length; i += 4) {
        const nx = d[i], ny = d[i + 1];
        d[i] = 128;
        d[i + 1] = ny;
        d[i + 2] = 128;
        d[i + 3] = nx;
      }
      const dt = new DynamicTexture('skinDetail_' + skinId, { width: n.width, height: n.height }, this.scene, true);
      (dt.getContext() as unknown as CanvasRenderingContext2D).putImageData(src, 0, 0);
      dt.update(false);
      dt.wrapU = dt.wrapV = Texture.WRAP_ADDRESSMODE;
      dt.hasAlpha = false;
      tex = dt as unknown as Texture;
    }
    this.details.set(skinId, tex);
    return tex;
  }

  /** Troca os materiais das peças pintáveis pela versão com a skin (vidro e lentes não mudam). */
  async applySkin(meshes: AbstractMesh[], id: string, skinId: string): Promise<void> {
    const skin = skinById(skinId);
    if (skin.id === 'default') return;
    const [albedoPath, normalPath, ormPath] = skin.folder
      ? await Promise.all([findSkinMap(skin.folder, 'albedo'), findSkinMap(skin.folder, 'normal'), findSkinMap(skin.folder, 'orm')])
      : [null, null, null];
    const albedo = albedoPath ? await this.loadSkinTexture(albedoPath) : null;
    const normal = normalPath ? await this.loadSkinTexture(normalPath) : null;
    const orm = ormPath ? await this.loadSkinTexture(ormPath) : null;
    for (const mesh of meshes) {
      const base = mesh.material;
      if (!base || /glass|lens|crystal|vidro|lente/i.test(base.name)) continue;
      const key = `${id}|${skin.id}|${base.uniqueId}`;
      let mat = this.skinMats.get(key);
      if (!mat) {
        let p: PBRMaterial;
        if (base instanceof PBRMaterial) p = base.clone(`${base.name}_${skin.id}`);
        else {
          p = new PBRMaterial(`${base.name}_${skin.id}`, this.scene);
          if (base instanceof StandardMaterial && base.diffuseTexture) p.albedoTexture = base.diffuseTexture;
        }
        if (albedo) p.albedoTexture = albedo;
        else {
          const tex = new DynamicTexture(`skinGen_${skin.id}`, { width: 512, height: 512 }, this.scene, true);
          (tex.getContext() as unknown as CanvasRenderingContext2D).drawImage(skinAlbedo(skin.id, 512), 0, 0);
          tex.update(false);
          tex.wrapU = tex.wrapV = Texture.WRAP_ADDRESSMODE;
          p.albedoTexture = tex;
        }
        p.albedoColor = Color3.White();
        if (normal) p.bumpTexture = normal;
        else {
          // relevo do padrão (bordas das escamas, hexágonos, trilhas...) como mapa de detalhe:
          // soma ao relevo próprio do modelo em vez de substituí-lo
          const det = this.skinDetail(skin.id);
          if (det) {
            p.detailMap.texture = det;
            p.detailMap.isEnabled = true;
            p.detailMap.diffuseBlendLevel = 0;
            p.detailMap.roughnessBlendLevel = 0;
            p.detailMap.bumpLevel = 1;
          }
        }
        if (orm) {
          p.metallicTexture = orm;
          p.useRoughnessFromMetallicTextureGreen = true;
          p.useMetallnessFromMetallicTextureBlue = true;
          p.useAmbientOcclusionFromMetallicTextureRed = true;
        } else {
          p.metallic = skin.metallic;
          p.roughness = skin.roughness;
          p.metallicTexture = null;
        }
        if (skin.emissive) p.emissiveColor = Color3.FromHexString(skin.emissive);
        mat = p;
        this.skinMats.set(key, mat);
      }
      mesh.material = mat;
    }
  }

  // ------------------------------------------------------------------ mãos

  private hands: Promise<AssetContainer | null> | null = null;

  /** Modelo das mãos (luvas táticas), se existir. */
  handsContainer(): Promise<AssetContainer | null> {
    if (!this.hands)
      this.hands = (async () => {
        if (!this.enabled || !(await assetExists(HANDS_MODEL))) return null;
        try {
          await ensureLoader();
          return await LoadAssetContainerAsync(ASSET_BASE + HANDS_MODEL, this.scene);
        } catch (e) {
          this.errors.push(`Falha ao carregar ${HANDS_MODEL}: ${(e as Error).message}`);
          return null;
        }
      })();
    return this.hands;
  }

  dispose(): void {
    for (const l of this.loaded.values()) l.container.dispose();
    this.loaded.clear();
    for (const m of this.skinMats.values()) m.dispose();
    this.skinMats.clear();
    this.skinTex.clear();
    for (const t of this.details.values()) t?.dispose();
    this.details.clear();
    this.hands = null;
  }
}
