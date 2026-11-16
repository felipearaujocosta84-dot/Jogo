// Registro dos recursos 3D externos (public/assets/). Verifica se cada arquivo existe antes de carregar
// e gera o relatório do que foi encontrado e do que ainda precisa ser adicionado.
// Os caminhos seguem a estrutura combinada para o projeto.

export const ASSET_BASE = './assets/';

/** Modelos GLB das armas (chave = id da arma no jogo). */
export const WEAPON_MODELS: Record<string, string> = {
  ak47: 'weapons/rifles/ak47.glb',
  m4a1: 'weapons/rifles/m4a1.glb',
  m4a4: 'weapons/rifles/m4a4.glb',
  aug: 'weapons/rifles/aug.glb',
  awp: 'weapons/snipers/awp.glb',
  ssg08: 'weapons/snipers/ssg08.glb',
  deagle: 'weapons/pistols/deagle.glb',
  glock: 'weapons/pistols/glock.glb',
  mp5: 'weapons/smg/mp5.glb',
  ump45: 'weapons/smg/ump45.glb',
  // opcionais (o jogo também tem estas armas)
  usp: 'weapons/pistols/usp.glb',
  p250: 'weapons/pistols/p250.glb',
  mac10: 'weapons/smg/mac10.glb',
  knife: 'weapons/melee/knife.glb'
};

/** Armas pedidas para o arsenal definitivo (as demais são opcionais). */
export const REQUIRED_WEAPONS = ['ak47', 'm4a1', 'm4a4', 'aug', 'awp', 'ssg08', 'deagle', 'glock', 'mp5', 'ump45'];

export const HANDS_MODEL = 'hands/tactical_gloves.glb';

/** Arquivo opcional com ajustes de orientação/escala por arma (ver public/assets/README.md). */
export const WEAPON_CONFIG = 'weapons/weapons.json';

/** Texturas aceitas em cada pasta de skin (a primeira extensão encontrada é usada). */
export const SKIN_MAPS = ['albedo', 'normal', 'orm'] as const;
export const IMAGE_EXT = ['webp', 'jpg', 'png'];

export interface WeaponModelConfig {
  /** Comprimento real da arma em metros (o modelo é escalado para isso). */
  length?: number;
  /** Eixo do cano no arquivo: '+x' | '-x' | '+y' | '-y' | '+z' | '-z' (automático se ausente). */
  forward?: string;
  /** Eixo "para cima" no arquivo (automático se ausente). */
  up?: string;
  /** Posição da empunhadura ao longo do comprimento (0 = coronha, 1 = cano). */
  gripAt?: number;
  /** Altura da empunhadura (0 = base, 1 = topo). */
  gripHeight?: number;
  /** Ajuste fino de posição/rotação (metros/graus) depois da normalização. */
  offset?: [number, number, number];
  rotation?: [number, number, number];
  /** Nomes (ou partes do nome) das peças animadas. */
  magazine?: string;
  slide?: string;
}

export interface AssetReport {
  found: string[];
  missing: string[];
  weapons: Record<string, boolean>;
  hands: boolean;
  skins: Record<string, string[]>;
  checkedAt: number;
}

const existsCache = new Map<string, Promise<boolean>>();

/** Índice gerado no build (scripts/assetmanifest.mjs). Sem ele, cada arquivo é consultado na rede. */
let manifest: Promise<Set<string> | null> | null = null;
function loadManifest(): Promise<Set<string> | null> {
  if (!manifest)
    manifest = (async () => {
      try {
        const res = await fetch(ASSET_BASE + 'manifest.json', { cache: 'no-cache' });
        if (!res.ok || (res.headers.get('content-type') ?? '').includes('text/html')) return null;
        const data = (await res.json()) as { files?: string[] };
        return Array.isArray(data.files) ? new Set(data.files) : null;
      } catch {
        return null;
      }
    })();
  return manifest;
}

/** O arquivo existe? (servidores de desenvolvimento devolvem index.html para caminhos inexistentes). */
export function assetExists(path: string): Promise<boolean> {
  let p = existsCache.get(path);
  if (!p) {
    p = (async () => {
      const list = await loadManifest();
      if (list) return list.has(path);
      const url = ASSET_BASE + path;
      for (const method of ['HEAD', 'GET']) {
        try {
          const res = await fetch(url, { method, cache: 'no-cache' });
          if (res.status === 405 || res.status === 501) continue;
          if (!res.ok) return false;
          const type = res.headers.get('content-type') ?? '';
          if (type.includes('text/html')) return false;
          if (method === 'GET') {
            // confere a assinatura do GLB ("glTF") ou que não é uma página
            const buf = new Uint8Array(await res.arrayBuffer());
            if (path.endsWith('.glb')) return buf.length > 12 && buf[0] === 0x67 && buf[1] === 0x6c && buf[2] === 0x54 && buf[3] === 0x46;
            return buf.length > 0 && buf[0] !== 0x3c; // '<'
          }
          return true;
        } catch {
          return false;
        }
      }
      return false;
    })();
    existsCache.set(path, p);
  }
  return p;
}

/** Primeira textura existente da pasta da skin para um tipo de mapa. */
export async function findSkinMap(folder: string, map: string): Promise<string | null> {
  for (const ext of IMAGE_EXT) {
    const path = `skins/${folder}/${map}.${ext}`;
    if (await assetExists(path)) return path;
  }
  return null;
}

let configPromise: Promise<Record<string, WeaponModelConfig>> | null = null;

export function weaponConfigs(): Promise<Record<string, WeaponModelConfig>> {
  if (!configPromise)
    configPromise = (async () => {
      if (!(await assetExists(WEAPON_CONFIG))) return {};
      try {
        return (await (await fetch(ASSET_BASE + WEAPON_CONFIG)).json()) as Record<string, WeaponModelConfig>;
      } catch {
        console.warn('[assets] weapons.json inválido — usando ajustes automáticos');
        return {};
      }
    })();
  return configPromise;
}

let reportPromise: Promise<AssetReport> | null = null;

/** Verifica todos os recursos esperados (uma vez por sessão; "force" refaz). */
export function assetReport(skinFolders: string[], force = false): Promise<AssetReport> {
  if (force) {
    existsCache.clear();
    manifest = null;
    reportPromise = null;
    configPromise = null;
  }
  if (!reportPromise)
    reportPromise = (async () => {
      const found: string[] = [], missing: string[] = [];
      const weapons: Record<string, boolean> = {};
      await Promise.all(
        Object.entries(WEAPON_MODELS).map(async ([id, path]) => {
          weapons[id] = await assetExists(path);
          if (weapons[id]) found.push(path);
          else if (REQUIRED_WEAPONS.includes(id)) missing.push(path);
        })
      );
      const hands = await assetExists(HANDS_MODEL);
      (hands ? found : missing).push(HANDS_MODEL);
      const skins: Record<string, string[]> = {};
      await Promise.all(
        skinFolders.map(async folder => {
          skins[folder] = [];
          for (const map of SKIN_MAPS) {
            const p = await findSkinMap(folder, map);
            if (p) {
              skins[folder].push(p);
              found.push(p);
            }
          }
          if (!skins[folder].length) missing.push(`skins/${folder}/albedo.webp (ou .jpg/.png) — opcional`);
        })
      );
      found.sort();
      missing.sort();
      const report = { found, missing, weapons, hands, skins, checkedAt: Date.now() };
      console.info('[assets] encontrados:', found.length ? found.join(', ') : 'nenhum');
      if (missing.length) console.info('[assets] faltando:', missing.join(', '));
      return report;
    })();
  return reportPromise;
}
