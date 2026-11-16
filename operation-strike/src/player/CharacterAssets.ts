// Modelos 3D dos personagens (GLB com esqueleto e animações) — um por equipe.
// Ficam em public/assets/characters/. A versão "_lod" (menos polígonos, texturas 1024) é usada nas
// qualidades Baixa/Média e no celular; a completa nas qualidades Alta/Ultra.
// Os arquivos são carregados uma vez por cena (o jogo e o lobby têm cenas separadas) e cada jogador
// recebe uma cópia com esqueleto e animações próprios.
import { LoadAssetContainerAsync, type AssetContainer, type Scene } from '../core/babylon';
import type { Team } from '../sim/types';

/** Qual modelo cada equipe usa (troque aqui se quiser inverter). */
export const CHARACTER_FILES: Record<Team, { name: string; file: string }> = {
  CT: { name: 'Soldado', file: 'characters/soldado' },
  T: { name: 'Terrorista', file: 'characters/terrorista' }
};

/** Animações esperadas no arquivo (nomes das ações do Blender). */
export const CHARACTER_CLIPS = ['Idle', 'Walk', 'Run', 'Jump', 'Crouch', 'Aim', 'Shoot', 'Reload', 'Death'] as const;

let gltfLoader: Promise<unknown> | null = null;
function ensureGltf(): Promise<unknown> {
  if (!gltfLoader) gltfLoader = import('@babylonjs/loaders/glTF/2.0');
  return gltfLoader;
}

const cache = new WeakMap<Scene, Partial<Record<Team, AssetContainer>>>();
const pending = new WeakMap<Scene, Promise<void>>();
/** Erros de carregamento (mostrados no console e no relatório de recursos). */
export const characterErrors: string[] = [];

/** Modelo já carregado para a cena (ou null enquanto carrega / se falhou). */
export function characterAsset(scene: Scene, team: Team): AssetContainer | null {
  return cache.get(scene)?.[team] ?? null;
}

/** Carrega os dois personagens para a cena (uma vez). lod = versão leve. */
export function loadCharacters(scene: Scene, lod: boolean): Promise<void> {
  let p = pending.get(scene);
  if (p) return p;
  p = (async () => {
    await ensureGltf();
    const entry: Partial<Record<Team, AssetContainer>> = {};
    cache.set(scene, entry);
    await Promise.all(
      (['CT', 'T'] as Team[]).map(async team => {
        const url = `./assets/${CHARACTER_FILES[team].file}${lod ? '_lod' : ''}.glb`;
        try {
          const c = await LoadAssetContainerAsync(url, scene);
          const missing = CHARACTER_CLIPS.filter(n => !c.animationGroups.some(g => g.name === n));
          if (!c.skeletons.length) characterErrors.push(`${url}: sem esqueleto`);
          if (missing.length) characterErrors.push(`${url}: animações faltando (${missing.join(', ')})`);
          for (const g of c.animationGroups) g.stop();
          entry[team] = c;
        } catch (e) {
          characterErrors.push(`${url}: ${(e as Error).message}`);
          console.error('[personagens] falha ao carregar', url, e);
        }
      })
    );
  })();
  pending.set(scene, p);
  return p;
}

/** Descarta os modelos da cena (troca de qualidade). */
export function unloadCharacters(scene: Scene): void {
  const e = cache.get(scene);
  if (e) for (const c of Object.values(e)) c?.dispose();
  cache.delete(scene);
  pending.delete(scene);
}
