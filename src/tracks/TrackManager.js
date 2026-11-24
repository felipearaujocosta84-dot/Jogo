// =============================================================
// EXTREME RACING — TrackManager
// Registro das quatro pistas e montagem completa (geometria,
// malhas, colisões e ambiente) para uma corrida.
// Para adicionar/expandir uma pista: crie a definição de dados
// (ex.: MountainRacing.js) e um construtor de ambiente em
// environments/ e registre ambos aqui.
// =============================================================
import GrandCircuit from './GrandCircuit.js';
import MountainRacing from './MountainRacing.js';
import DesertSpeedway from './DesertSpeedway.js';
import CoastalRacing from './CoastalRacing.js';
import { TrackGeometry } from './TrackGeometry.js';
import { TrackBuilder } from './TrackBuilder.js';
import { TrackMaterials } from './TrackMaterials.js';
import { buildCircuitEnvironment } from './environments/CircuitEnvironment.js';
import { buildMountainEnvironment } from './environments/MountainEnvironment.js';
import { buildDesertEnvironment } from './environments/DesertEnvironment.js';
import { buildCoastalEnvironment } from './environments/CoastalEnvironment.js';
import { assetExists } from '../core/AssetManager.js';

/** Texturas fotográficas opcionais (public/assets/textures). */
export const PHOTO_TEXTURES = ['asphalt_albedo', 'asphalt_normal', 'grass_albedo', 'rock_albedo', 'sand_albedo'];

export const TRACKS = [GrandCircuit, MountainRacing, DesertSpeedway, CoastalRacing];

const ENVIRONMENTS = {
  circuit: buildCircuitEnvironment,
  mountain: buildMountainEnvironment,
  desert: buildDesertEnvironment,
  coastal: buildCoastalEnvironment,
};

const geometryCache = new Map();

export function getTrackDef(id) {
  return TRACKS.find((t) => t.id === id) ?? TRACKS[0];
}

/** Geometria (pura) com cache — também usada pelo menu (mapa do traçado). */
export function getTrackGeometry(id) {
  if (!geometryCache.has(id)) geometryCache.set(id, new TrackGeometry(getTrackDef(id)));
  return geometryCache.get(id);
}

export class TrackManager {
  /**
   * Constrói a pista na cena.
   * @param {Scene} scene
   * @param {string} id
   * @param {object} graphicsPreset
   * @param {function(number,string)} progress callback de progresso
   */
  static async build(scene, id, graphicsPreset, progress = () => {}) {
    const def = getTrackDef(id);
    progress(0.1, 'Calculando traçado…');
    const geometry = getTrackGeometry(id);
    await nextFrame();
    progress(0.2, 'Gerando texturas…');
    const photo = {};
    for (const key of PHOTO_TEXTURES) {
      const url = `assets/textures/${key}.jpg`;
      if (await assetExists(url)) photo[key] = url;
    }
    const materials = new TrackMaterials(scene, graphicsPreset, photo);
    materials.get('asphalt');
    await nextFrame();
    const builder = new TrackBuilder(scene, geometry, materials, graphicsPreset);
    progress(0.35, 'Construindo asfalto e zebras…');
    builder.buildRoad();
    builder.buildBarriers();
    builder.buildStartFinish();
    await nextFrame();
    progress(0.5, 'Construindo terreno e cenário…');
    const env = ENVIRONMENTS[def.environment] ? ENVIRONMENTS[def.environment](builder) : {};
    await nextFrame();
    progress(0.7, 'Pista pronta');
    return { def, geometry, builder, materials, env, dispose: () => builder.dispose() };
  }
}

function nextFrame() {
  return new Promise((r) => requestAnimationFrame(() => r()));
}
