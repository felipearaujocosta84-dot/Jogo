// Definições das armas. Na Etapa 1 existem duas armas de treino (fuzil e pistola),
// que já usam o mesmo formato que o arsenal completo da Etapa 2 vai usar.

export type WeaponSlot = 'primary' | 'secondary' | 'melee' | 'grenade' | 'bomb';
export type WeaponModel = 'rifle' | 'pistol';

export interface WeaponDef {
  id: string;
  name: string;
  slot: WeaponSlot;
  model: WeaponModel;
  automatic: boolean;
  /** Disparos por segundo. */
  fireRate: number;
  magazine: number;
  reserve: number;
  reloadTime: number;
  drawTime: number;
  /** Dano base (Etapa 2 aplica multiplicadores por região do corpo). */
  damage: number;
  range: number;
  /** Dispersão parado / em movimento / no ar (graus). */
  spreadStand: number;
  spreadMove: number;
  spreadAir: number;
  /** Recuo vertical por tiro (graus). */
  recoil: number;
  /** Zoom ao mirar (1 = sem zoom). */
  aimZoom: number;
  /** Multiplicador de velocidade ao carregar a arma. */
  moveSpeed: number;
}

export const TRAINING_RIFLE: WeaponDef = {
  id: 'training_rifle',
  name: 'FUZIL DE TREINO',
  slot: 'primary',
  model: 'rifle',
  automatic: true,
  fireRate: 10,
  magazine: 30,
  reserve: 90,
  reloadTime: 2.3,
  drawTime: 0.55,
  damage: 33,
  range: 200,
  spreadStand: 0.25,
  spreadMove: 3.2,
  spreadAir: 7,
  recoil: 0.9,
  aimZoom: 0.62,
  moveSpeed: 0.9
};

export const TRAINING_PISTOL: WeaponDef = {
  id: 'training_pistol',
  name: 'PISTOLA DE TREINO',
  slot: 'secondary',
  model: 'pistol',
  automatic: false,
  fireRate: 6,
  magazine: 20,
  reserve: 120,
  reloadTime: 1.8,
  drawTime: 0.4,
  damage: 26,
  range: 120,
  spreadStand: 0.5,
  spreadMove: 1.8,
  spreadAir: 5,
  recoil: 1.5,
  aimZoom: 0.8,
  moveSpeed: 1
};
