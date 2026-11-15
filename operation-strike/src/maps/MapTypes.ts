// Formato de dados dos mapas. Um mapa é descrito por:
//  - uma grade ASCII (estrutura: prédios, muros, corredores, áreas abertas);
//  - uma lista de objetos (caixas, escadas, plataformas, portas, decoração);
//  - pontos de nascimento, locais de bomba e zonas nomeadas (radar e HUD).
// Isso facilita criar e equilibrar novos mapas (Factory, Skyscraper) sem mexer no motor.
import type { SurfaceKind } from '../physics/CollisionWorld';
import type { TextureName } from './textures';

export type MaterialName = TextureName;

export type Team = 'T' | 'CT';

export interface CellKind {
  /** solid = bloco alto (prédio/muro); floor = piso aberto; roofed = piso com teto (túnel) */
  type: 'solid' | 'floor' | 'roofed';
  material: MaterialName;
  /** Altura (solid) ou altura do teto (roofed). Intervalo [min,max] sorteado por bloco. */
  height?: [number, number];
  floor?: MaterialName;
}

export interface BoxDef {
  min: [number, number, number];
  max: [number, number, number];
  mat: MaterialName;
  /** Padrão true. */
  collide?: boolean;
  /** Bloqueia tiros? Padrão true. */
  bullets?: boolean;
  /** Projeta sombra? Padrão true. */
  shadow?: boolean;
  /** Só aparece nas qualidades média/alta. */
  detail?: boolean;
}

export interface DoorDef {
  id: string;
  /** Vão da porta (caixa fechada). As folhas deslizam ao longo de `axis`. */
  min: [number, number, number];
  max: [number, number, number];
  axis: 'x' | 'z';
  open: boolean;
}

export interface SpawnPoint {
  x: number;
  z: number;
  /** Direção inicial (graus, 0 = +Z/norte). */
  yaw: number;
}

export interface Zone {
  name: string;
  min: [number, number];
  max: [number, number];
}

export interface BombSite {
  name: 'A' | 'B';
  min: [number, number];
  max: [number, number];
}

export interface MapDefinition {
  id: string;
  name: string;
  /** Tamanho da célula da grade (m). */
  cell: number;
  /** Coordenada X da coluna 0 e Z da linha 0 (linha 0 = norte, Z máximo). */
  originX: number;
  originZ: number;
  grid: string[];
  legend: Record<string, CellKind>;
  boxes: BoxDef[];
  doors: DoorDef[];
  spawns: Record<Team, SpawnPoint[]>;
  sites: BombSite[];
  zones: Zone[];
  ambience: {
    sky: [string, string, string];
    fog: string;
    sunDir: [number, number, number];
    sunColor: string;
    sunIntensity: number;
    ambient: string;
    ambientGround: string;
    ambientIntensity: number;
  };
}

export const MATERIAL_SURFACE: Record<MaterialName, SurfaceKind> = {
  sand: 'sand',
  sandstone: 'stone',
  plaster: 'stone',
  concrete: 'concrete',
  crate: 'wood',
  metal: 'metal',
  container: 'metal',
  roof: 'concrete',
  trim: 'stone',
  tile: 'stone',
  door: 'metal',
  dark: 'concrete'
};

/** Metros por repetição de textura. */
export const MATERIAL_SCALE: Record<MaterialName, number> = {
  sand: 6,
  sandstone: 4,
  plaster: 5,
  concrete: 4,
  crate: 0, // 0 = textura ajustada a cada caixa
  metal: 3,
  container: 3,
  roof: 3,
  trim: 2,
  tile: 4,
  door: 2,
  dark: 2
};
