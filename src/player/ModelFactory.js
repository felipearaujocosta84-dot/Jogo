// Cria o visual dos jogadores. Usa um modelo GLB/GLTF se configurado (e se carregar com sucesso);
// caso contrário, usa o personagem humano procedural.
//
// PARA USAR UM MODELO 3D PRÓPRIO:
//   1. Coloque o arquivo em  public/models/player.glb  (modelo rigado, olhando para +Z, ~1,8 m de altura)
//   2. Crie um arquivo  .env  na raiz do projeto com a linha:  VITE_PLAYER_MODEL=models/player.glb
//      (é uma configuração de build: sem ela o carregador GLB nem entra no pacote, que fica bem menor)
//   3. (opcional) informe os nomes das animações em MODEL_CONFIG.animations
//   4. O material cujo nome contém "jersey"/"shirt"/"camisa"/"body" recebe a cor do time
//      (se nenhum nome casar, a maior malha do modelo é pintada).
import { Color3 } from '../babylon.js';
import { buildProceduralHumanoid, getHumanoidMaterial } from './ProceduralHumanoid.js';
import { ProceduralAnimator, GlbAnimator } from './PlayerAnimation.js';

export const MODEL_CONFIG = {
  url: import.meta.env.VITE_PLAYER_MODEL || null, // ex.: 'models/player.glb' (via .env)
  scale: 1,
  rotationY: 0,           // correção se o modelo olhar para outra direção
  animations: {},         // ex.: { idle: 'Idle_Anim', run: 'Running', kick: 'Soccer_Kick' }
  jerseyMaterialKeys: ['jersey', 'shirt', 'camisa', 'body']
};

let containerPromise = null;

async function loadContainer(scene) {
  // o "if" com a variável de build permite ao bundler remover o carregador quando não há modelo
  if (!import.meta.env.VITE_PLAYER_MODEL || !MODEL_CONFIG.url) return null;
  if (!containerPromise) {
    containerPromise = (async () => {
      try {
        // carregadas sob demanda: só baixam se existir modelo configurado
        await import('@babylonjs/loaders/glTF/glTFFileLoader');
        await import('@babylonjs/loaders/glTF/2.0');
        const { LoadAssetContainerAsync } = await import('@babylonjs/core/Loading/sceneLoader');
        return await LoadAssetContainerAsync(MODEL_CONFIG.url, scene);
      } catch (e) {
        console.warn('[ModelFactory] modelo GLB indisponível, usando personagem procedural:', e);
        return null;
      }
    })();
  }
  return containerPromise;
}

/** Pré-carrega o modelo (se configurado). Retorna true se o GLB será usado. */
export async function preloadPlayerModel(scene) {
  return !!(await loadContainer(scene));
}

/**
 * @returns {Promise<{ root: import('@babylonjs/core').TransformNode, meshes: any[], animator: any, kind: string }>}
 */
export async function createPlayerVisual(scene, name, look) {
  const container = await loadContainer(scene);
  if (container) {
    const inst = container.instantiateModelsToScene((n) => `${name}_${n}`, true, { doNotInstantiate: true });
    const root = inst.rootNodes[0];
    root.scaling.scaleInPlace(MODEL_CONFIG.scale);
    const meshes = root.getChildMeshes(false);
    const jersey = Color3.FromHexString(look.jersey);
    const tint = (mat) => {
      if ('albedoColor' in mat) mat.albedoColor = jersey;
      else if ('diffuseColor' in mat) mat.diffuseColor = jersey;
    };
    let tinted = 0;
    for (const m of meshes) {
      const mat = m.material;
      if (mat && MODEL_CONFIG.jerseyMaterialKeys.some((k) => mat.name.toLowerCase().includes(k))) {
        tint(mat);
        tinted++;
      }
    }
    // nenhum material com nome reconhecido: pinta o da maior malha (normalmente o corpo/uniforme)
    if (!tinted) {
      const biggest = meshes.filter((m) => m.material).sort((a, b) => b.getTotalVertices() - a.getTotalVertices())[0];
      if (biggest) tint(biggest.material);
    }
    const animator = new GlbAnimator(inst.animationGroups, MODEL_CONFIG.animations);
    return { root, meshes, animator, kind: 'glb', yawOffset: MODEL_CONFIG.rotationY };
  }

  const { mesh, nodes } = buildProceduralHumanoid(scene, name, look);
  mesh.material = getHumanoidMaterial(scene);
  const s = look.height || 1;
  mesh.scaling.set(s, s, s);
  return { root: mesh, meshes: [mesh], animator: new ProceduralAnimator(nodes), kind: 'procedural', yawOffset: 0, nodes };
}
