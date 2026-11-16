// Mapas feitos com modelos 3D prontos (GLB). O visual vem do arquivo do modelo e a colisão vem de um
// arquivo JSON gerado na conversão (caixas AABB em metros + pontos de nascimento), ambos em public/assets/maps/.
// Esses mapas são arenas compactas de time contra time: não têm locais de bomba, então rodam no
// modo Mata-mata em equipe.
//
// Origem dos modelos: kit gratuito "PvP Battle Maps" (Shuriken Studio) — ver public/assets/CREDITS.md.
import type { MapDefinition, SpawnPoint } from './MapTypes';
import type { SurfaceKind } from '../physics/CollisionWorld';
import type { Team } from '../sim/types';

/** Superfícies na ordem usada pelo conversor (índice gravado em cada caixa). */
export const MODEL_SURFACES: SurfaceKind[] = ['sand', 'stone', 'concrete', 'wood', 'metal'];

/** Dados de colisão gerados na conversão. Caixa = [x0, y0, z0, x1, y1, z1, superfície] em centímetros. */
export interface ModelMapData {
  id: string;
  scale: number;
  bounds: [number, number, number, number];
  spawns: Record<Team, { x: number; y: number; z: number; yaw: number }[]>;
  boxes: number[][];
}

interface ModelMapMeta {
  id: string;
  name: string;
  description: string;
  /** Limites aproximados (preenchidos de verdade quando os dados carregam). */
  half: [number, number];
  ambience: MapDefinition['ambience'];
}

const META: ModelMapMeta[] = [
  {
    id: 'desert_outpost', name: 'Posto do Deserto', half: [21, 16.8],
    description: 'Complexo murado com prédio de dois andares, torre de vigia e caminhão quebrado.',
    ambience: { sky: ['#3a76bd', '#9cc8ea', '#efd9b0'], fog: '#e2cfa6', sunDir: [-0.5, -0.78, 0.36], sunColor: '#fff0d0', sunIntensity: 1.6, ambient: '#c8dcf2', ambientGround: '#9a7a52', ambientIntensity: 0.62 }
  },
  {
    id: 'city_crossroads', name: 'Cruzamento', half: [17.7, 17.7],
    description: 'Esquina urbana com loja, prédio com sacada, carros estacionados e beco.',
    ambience: { sky: ['#4a7fc0', '#a8c9e6', '#dfe4e8'], fog: '#c9d1d8', sunDir: [0.4, -0.75, 0.5], sunColor: '#fff4e2', sunIntensity: 1.45, ambient: '#cdd9e8', ambientGround: '#6e6a64', ambientIntensity: 0.66 }
  },
  {
    id: 'warehouse_yard', name: 'Pátio de Contêineres', half: [19.3, 16.8],
    description: 'Contêineres empilhados, galpão com passarelas, empilhadeiras e guindaste.',
    ambience: { sky: ['#5b6f86', '#a9b4bf', '#d9c9b0'], fog: '#b9b4ab', sunDir: [-0.35, -0.7, -0.6], sunColor: '#ffe2bc', sunIntensity: 1.35, ambient: '#bcc6d2', ambientGround: '#5e5a54', ambientIntensity: 0.7 }
  },
  {
    id: 'snowy_bunker', name: 'Bunker na Neve', half: [17.5, 17.5],
    description: 'Trincheiras, sacos de areia, cabanas de radar e um bunker de concreto no centro.',
    ambience: { sky: ['#6f8fb5', '#c3d3e4', '#eef2f6'], fog: '#dfe6ee', sunDir: [0.3, -0.6, 0.7], sunColor: '#f4f8ff', sunIntensity: 1.3, ambient: '#dbe6f4', ambientGround: '#b8c4d2', ambientIntensity: 0.8 }
  },
  {
    id: 'jungle_ruins', name: 'Ruínas da Selva', half: [17.5, 17.5],
    description: 'Templo de pedra em degraus, muros quebrados e ponte de corda sobre o riacho.',
    ambience: { sky: ['#3f7a9e', '#9fc7c9', '#d6e2c4'], fog: '#b9cbb0', sunDir: [-0.3, -0.82, -0.45], sunColor: '#fff2cf', sunIntensity: 1.4, ambient: '#c9e0cf', ambientGround: '#4f5e3a', ambientIntensity: 0.68 }
  }
];

function placeholderSpawns(team: Team, half: [number, number]): SpawnPoint[] {
  const z = (team === 'T' ? 1 : -1) * half[1] * 0.8;
  return [-2, -1, 0, 1, 2].map(i => ({ x: i * 1.5, z, yaw: team === 'T' ? 180 : 0 }));
}

function makeDef(m: ModelMapMeta): MapDefinition {
  return {
    id: m.id,
    name: m.name,
    description: m.description,
    cell: 1,
    originX: -m.half[0],
    originZ: m.half[1],
    grid: [],
    legend: {},
    boxes: [],
    doors: [],
    spawns: { T: placeholderSpawns('T', m.half), CT: placeholderSpawns('CT', m.half) },
    sites: [],
    zones: [
      { name: 'BASE TR', min: [-m.half[0], m.half[1] * 0.55], max: [m.half[0], m.half[1]] },
      { name: 'BASE CT', min: [-m.half[0], -m.half[1]], max: [m.half[0], -m.half[1] * 0.55] },
      { name: 'CENTRO', min: [-m.half[0] * 0.35, -m.half[1] * 0.35], max: [m.half[0] * 0.35, m.half[1] * 0.35] },
      { name: 'LADO LESTE', min: [-m.half[0], -m.half[1] * 0.55], max: [-m.half[0] * 0.35, m.half[1] * 0.55] },
      { name: 'LADO OESTE', min: [m.half[0] * 0.35, -m.half[1] * 0.55], max: [m.half[0], m.half[1] * 0.55] }
    ],
    tactics: {
      A: { tStage: [], ctHold: [] },
      B: { tStage: [], ctHold: [] },
      // pontos de patrulha dos bots (centro e laterais)
      ctMid: [[0, 0, 0], [-m.half[0] * 0.6, 0, 0], [m.half[0] * 0.6, 0, 0], [0, m.half[1] * 0.35, 0], [0, -m.half[1] * 0.35, 0]]
    },
    ambience: m.ambience,
    model: { glb: `maps/${m.id}.glb`, data: `maps/${m.id}.json` },
    modes: ['tdm']
  };
}

export const MODEL_MAPS: MapDefinition[] = META.map(makeDef);

/** Aplica os dados de colisão/nascimento ao mapa. */
export function applyModelData(def: MapDefinition, data: ModelMapData): void {
  def.colliders = data.boxes;
  const [x0, x1, z0, z1] = data.bounds;
  def.modelBounds = { minX: x0, maxX: x1, minZ: z0, maxZ: z1 };
  for (const team of ['T', 'CT'] as Team[]) {
    const list = data.spawns[team];
    if (list?.length) def.spawns[team] = list.map(s => ({ x: s.x, y: s.y, z: s.z, yaw: s.yaw }));
  }
}

const loading = new Map<string, Promise<void>>();

/** Garante que a colisão do mapa foi carregada (no navegador/APK). Mapas comuns retornam na hora. */
export function ensureMapData(def: MapDefinition, base = './assets/'): Promise<void> {
  if (!def.model || def.colliders) return Promise.resolve();
  let p = loading.get(def.id);
  if (!p) {
    p = fetch(base + def.model.data)
      .then(r => {
        if (!r.ok) throw new Error(`arquivo do mapa não encontrado: ${def.model!.data}`);
        return r.json() as Promise<ModelMapData>;
      })
      .then(d => applyModelData(def, d));
    p.catch(() => loading.delete(def.id));
    loading.set(def.id, p);
  }
  return p;
}
