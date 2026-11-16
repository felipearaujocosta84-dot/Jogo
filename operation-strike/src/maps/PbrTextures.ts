// Texturas PBR dos mapas (arquivos reais em public/assets/textures/pbr/, gerados por scripts/textures/generate_pbr.py).
// Cada material tem: albedo (cor), normal (relevo) e ORM (R = oclusão, G = rugosidade, B = metal).
// Resoluções: 1K (todas), 2K (todas), 4K (só as de maior área: chão e paredes — só no PC/navegador).
// Carregamento progressivo: o material aparece com 1K e troca para 2K/4K quando a versão maior termina de carregar.
// Um mapa de variação em grande escala (detalhe) quebra a repetição visível das texturas.
import { DynamicTexture, Texture, type PBRMaterial, type Scene, type StandardMaterial } from '../core/babylon';
import { isNativeApp } from '../core/Platform';

export type PbrRes = '1k' | '2k' | '4k';
const ORDER: PbrRes[] = ['1k', '2k', '4k'];

/** Materiais com versão 4K (chão e paredes, a maior parte da tela). */
const HERO = new Set(['asphalt', 'concrete', 'plaster', 'brick', 'sandstone', 'sand', 'tile']);
/** Materiais com mapa de detalhe (usados nos mapas de modelo 3D, que têm cor chapada). */
export const DETAIL_SETS = new Set(['asphalt', 'concrete', 'brick', 'plaster', 'sand', 'sandstone', 'metal', 'steel', 'crate', 'grass']);

const BASE = './assets/textures/pbr/';

/** Maior resolução disponível deste material nesta plataforma (o APK leva 2K só do chão/paredes). */
export function availableRes(name: string): PbrRes {
  if (isNativeApp()) return HERO.has(name) ? '2k' : '1k';
  return HERO.has(name) ? '4k' : '2k';
}

export function resFor(name: string, wanted: PbrRes): PbrRes {
  const a = availableRes(name);
  return ORDER[Math.min(ORDER.indexOf(a), ORDER.indexOf(wanted))];
}

export interface PbrSet {
  albedo: Texture;
  normal: Texture;
  orm: Texture;
}

const cache = new Map<string, PbrSet>();

function tex(scene: Scene, url: string, srgb: boolean, aniso: number): Texture {
  const t = new Texture(url, scene, { noMipmap: false, samplingMode: Texture.TRILINEAR_SAMPLINGMODE, gammaSpace: srgb });
  t.wrapU = t.wrapV = Texture.WRAP_ADDRESSMODE;
  t.anisotropicFilteringLevel = aniso;
  return t;
}

/** Conjunto de texturas (albedo, normal, ORM) de um material numa resolução. */
export function pbrSet(scene: Scene, name: string, res: PbrRes, aniso = 4, tag = ''): PbrSet {
  // tag separa cópias com escala de UV diferente (mapas de modelo 3D usam UV em unidades de 2 m)
  const key = `${scene.uniqueId}|${name}|${res}|${tag}`;
  let s = cache.get(key);
  if (s && s.albedo.getScene()) return s;
  const dir = BASE + res + '/' + name;
  s = { albedo: tex(scene, dir + '_albedo.webp', true, aniso), normal: tex(scene, dir + '_normal.webp', false, aniso), orm: tex(scene, dir + '_orm.webp', false, aniso) };
  cache.set(key, s);
  return s;
}

function whenLoaded(s: PbrSet): Promise<void> {
  const one = (t: Texture) => new Promise<void>(res => (t.isReady() ? res() : t.onLoadObservable.addOnce(() => res())));
  return Promise.all([one(s.albedo), one(s.normal), one(s.orm)]).then(() => undefined);
}

/** Aplica um conjunto a um material PBR (cor, relevo e ORM: oclusão, rugosidade e metal por pixel). */
export function applyPbr(m: PBRMaterial, s: PbrSet, normalLevel = 1): void {
  m.albedoTexture = s.albedo;
  m.bumpTexture = s.normal;
  m.bumpTexture.level = normalLevel;
  m.metallicTexture = s.orm;
  m.useAmbientOcclusionFromMetallicTextureRed = true;
  m.useRoughnessFromMetallicTextureGreen = true;
  m.useMetallnessFromMetallicTextureBlue = true;
  m.useRoughnessFromMetallicTextureAlpha = false;
  m.metallic = 1;
  m.roughness = 1;
  // normais no padrão OpenGL (glTF); o Babylon é mão esquerda
  m.invertNormalMapY = true;
}

/**
 * Material com textura real que melhora depois: começa em 1K (aparece rápido) e troca para a resolução alvo
 * quando ela termina de carregar. As texturas 1K ficam no cache para outros usos.
 */
export function progressivePbr(scene: Scene, m: PBRMaterial, name: string, target: PbrRes, aniso: number, normalLevel = 1): void {
  const final = resFor(name, target);
  applyPbr(m, pbrSet(scene, name, '1k', aniso), normalLevel);
  if (final === '1k') return;
  const hi = pbrSet(scene, name, final, aniso);
  void whenLoaded(hi).then(() => {
    if (!m.getScene() || m.isFrozen) m.unfreeze();
    applyPbr(m, hi, normalLevel);
  });
}

/** Versão simples (qualidade Baixa): só a cor real 1K num material padrão. */
export function applyBasic(m: StandardMaterial, scene: Scene, name: string): void {
  const s = pbrSet(scene, name, '1k', 1);
  m.diffuseTexture = s.albedo;
}

let variation: DynamicTexture | null = null;

/**
 * Mapa de variação em grande escala (formato de detalhe do Babylon: R = cor, G/A = normal neutra, B = rugosidade).
 * Escurece/clareia e muda a rugosidade em manchas de dezenas de metros: some a repetição do ladrilhamento.
 */
export function variationMap(scene: Scene): DynamicTexture {
  if (variation && variation.getScene() === scene) return variation;
  const n = 256;
  const t = new DynamicTexture('pbrVariation', { width: n, height: n }, scene, true);
  const g = t.getContext() as unknown as CanvasRenderingContext2D;
  const img = g.createImageData(n, n);
  // ruído periódico em oitavas (soma de senos com fases aleatórias)
  const waves: [number, number, number, number][] = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let o = 0; o < 24; o++) {
    const f = 1 + Math.floor(rnd() * (o < 8 ? 3 : 7));
    waves.push([f * (rnd() < 0.5 ? -1 : 1), Math.floor(rnd() * 4), rnd() * Math.PI * 2, 1 / f]);
  }
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      let v = 0, r = 0;
      for (const [fx, fy, ph, a] of waves) {
        const s = Math.sin(((fx * x + fy * y) / n) * Math.PI * 2 + ph) * a;
        v += s;
        r += Math.sin(((fy * x - fx * y) / n) * Math.PI * 2 + ph * 1.7) * a;
      }
      const i = (y * n + x) * 4;
      img.data[i] = Math.max(0, Math.min(255, 128 + v * 26));
      img.data[i + 1] = 128;
      img.data[i + 2] = Math.max(0, Math.min(255, 128 + r * 22));
      img.data[i + 3] = 128;
    }
  g.putImageData(img, 0, 0);
  t.update(false);
  t.wrapU = t.wrapV = Texture.WRAP_ADDRESSMODE;
  variation = t;
  return t;
}

/** Liga a variação em grande escala num material PBR (escala em repetições da textura principal). */
export function addVariation(m: PBRMaterial, scene: Scene, tilesPerPatch = 7): void {
  // textura compartilhada (clonar textura de canvas sai vazia); a escala é a mesma para todos os materiais
  const v = variationMap(scene);
  v.uScale = v.vScale = 1 / tilesPerPatch;
  m.detailMap.texture = v;
  m.detailMap.isEnabled = true;
  m.detailMap.diffuseBlendLevel = 0.32;
  m.detailMap.roughnessBlendLevel = 0.35;
  m.detailMap.bumpLevel = 0;
}

/** Mapa de detalhe real (relevo, desgaste e rugosidade) para materiais de cor chapada. */
/** Tamanho real (m) de uma repetição de cada textura. */
export const TILE_METERS: Record<string, number> = {
  asphalt: 6, concrete: 4, plaster: 5, brick: 3, sandstone: 4, sand: 6, tile: 4, metal: 3, container: 3, roof: 3,
  trim: 2, door: 2, steel: 2, crate: 1, carpet: 4, grass: 4, glass: 4, dark: 2
};

/** Materiais dos mapas de modelo 3D (kit de cor chapada) → textura real usada para relevo e desgaste. */
const KIT_MATERIALS: [RegExp, string][] = [
  [/asphalt/i, 'asphalt'], [/sidewalk|concrete|yard/i, 'concrete'], [/brick/i, 'brick'],
  [/cream|plaster|adobe/i, 'plaster'], [/stone/i, 'sandstone'], [/sand|soil|snow|burlap/i, 'sand'],
  [/grass|foliage/i, 'grass'], [/iron|metal/i, 'steel'], [/paint|olive/i, 'metal']
];

/**
 * Melhora um material de cor chapada (mapas de modelo 3D): mantém a cor original e acrescenta relevo real
 * (normal), variação de cor/desgaste e de rugosidade (mapa de detalhe). UV do modelo em unidades de 2 m.
 */
export function upgradeKitMaterial(m: PBRMaterial, scene: Scene, res: PbrRes, aniso: number): boolean {
  const hit = KIT_MATERIALS.find(([re]) => re.test(m.name));
  if (!hit || /glass|glow|fire|water|crystal|screen|ice|light/i.test(m.name)) return false;
  const name = hit[1];
  const scale = 2 / (TILE_METERS[name] ?? 4);
  const s = pbrSet(scene, name, resFor(name, res), aniso, 'kit');
  s.normal.uScale = s.normal.vScale = scale;
  m.bumpTexture = s.normal;
  m.bumpTexture.level = 0.85;
  m.invertNormalMapY = true;
  if (DETAIL_SETS.has(name)) {
    const d = detailTexture(scene, name, aniso);
    d.uScale = d.vScale = scale;
    m.detailMap.texture = d;
    m.detailMap.isEnabled = true;
    m.detailMap.diffuseBlendLevel = 0.65;
    m.detailMap.roughnessBlendLevel = 0.5;
    m.detailMap.bumpLevel = 0;
  }
  return true;
}

export function detailTexture(scene: Scene, name: string, aniso = 4): Texture {
  const key = `${scene.uniqueId}|detail|${name}`;
  let s = cache.get(key);
  if (!s || !s.albedo.getScene()) {
    const t = tex(scene, BASE + 'detail/' + name + '_detail.webp', false, aniso);
    s = { albedo: t, normal: t, orm: t };
    cache.set(key, s);
  }
  return s.albedo;
}

export function clearPbrCache(scene: Scene): void {
  for (const [k, s] of cache) {
    if (!k.startsWith(scene.uniqueId + '|')) continue;
    s.albedo.dispose();
    if (s.normal !== s.albedo) s.normal.dispose();
    if (s.orm !== s.albedo) s.orm.dispose();
    cache.delete(k);
  }
}
