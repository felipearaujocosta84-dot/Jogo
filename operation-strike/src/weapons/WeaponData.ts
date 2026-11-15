// Arsenal completo (dados puros: usados pelo cliente, pela simulação local e pelo servidor).
// Valores inspirados em FPS competitivos, com nomes de armas reais e modelos 3D próprios.
import type { Slot, Team } from '../sim/types';

export type WeaponClass = 'pistol' | 'smg' | 'rifle' | 'sniper' | 'knife' | 'grenade' | 'c4';

export interface WeaponDef {
  id: string;
  name: string;
  cls: WeaponClass;
  slot: Slot;
  price: number;
  /** Lado que pode comprar (indefinido = ambos). */
  team?: Team;
  automatic: boolean;
  /** Disparos por segundo. */
  fireRate: number;
  magazine: number;
  reserve: number;
  reloadTime: number;
  drawTime: number;
  damage: number;
  /** Fração do dano que atravessa o colete (0..1). */
  armorPen: number;
  /** Multiplicador de dano a cada 12,7 m. */
  rangeMod: number;
  range: number;
  headMult: number;
  /** Dispersão (graus): parado, correndo, no ar. */
  spreadStand: number;
  spreadMove: number;
  spreadAir: number;
  /** Recuo vertical por tiro (graus) e amplitude lateral. */
  recoil: number;
  recoilYaw: number;
  /** Multiplicador de velocidade ao carregar. */
  speed: number;
  killReward: number;
  /** Níveis de zoom (luneta) ou zoom de mira (FOV multiplicador). */
  zoom: number[];
  scope: boolean;
  /** Som: pesado, leve, silenciado, sniper... */
  sound: 'rifle' | 'pistol' | 'heavy' | 'smg' | 'sniper' | 'silenced' | 'knife';
}

const base = {
  automatic: false,
  headMult: 4,
  rangeMod: 0.9,
  range: 200,
  recoilYaw: 0.4,
  zoom: [0.78],
  scope: false,
  killReward: 300
};

export const WEAPONS: Record<string, WeaponDef> = {
  // ---------------------------------------------------------------- pistolas
  glock: { ...base, id: 'glock', name: 'Glock-18', cls: 'pistol', slot: 'secondary', price: 200, team: 'T', fireRate: 6.6, magazine: 20, reserve: 120, reloadTime: 2.2, drawTime: 0.5, damage: 30, armorPen: 0.47, rangeMod: 0.85, spreadStand: 0.55, spreadMove: 1.6, spreadAir: 4, recoil: 1.2, speed: 0.96, sound: 'pistol' },
  usp: { ...base, id: 'usp', name: 'USP-S', cls: 'pistol', slot: 'secondary', price: 200, team: 'CT', fireRate: 5.9, magazine: 12, reserve: 24, reloadTime: 2.2, drawTime: 0.5, damage: 35, armorPen: 0.505, rangeMod: 0.9, spreadStand: 0.35, spreadMove: 1.5, spreadAir: 4, recoil: 1.4, speed: 0.96, sound: 'silenced' },
  p250: { ...base, id: 'p250', name: 'P250', cls: 'pistol', slot: 'secondary', price: 300, fireRate: 6.6, magazine: 13, reserve: 26, reloadTime: 2.2, drawTime: 0.5, damage: 38, armorPen: 0.64, rangeMod: 0.85, spreadStand: 0.5, spreadMove: 1.7, spreadAir: 4, recoil: 1.6, speed: 0.96, sound: 'pistol' },
  deagle: { ...base, id: 'deagle', name: 'Desert Eagle', cls: 'pistol', slot: 'secondary', price: 700, fireRate: 3.6, magazine: 7, reserve: 35, reloadTime: 2.2, drawTime: 0.6, damage: 63, armorPen: 0.93, rangeMod: 0.81, spreadStand: 0.4, spreadMove: 3, spreadAir: 6, recoil: 3.4, recoilYaw: 1, speed: 0.92, sound: 'heavy' },
  // ---------------------------------------------------------------- submetralhadoras
  mp5: { ...base, id: 'mp5', name: 'MP5', cls: 'smg', slot: 'primary', price: 1500, automatic: true, fireRate: 12.5, magazine: 30, reserve: 120, reloadTime: 2.6, drawTime: 0.6, damage: 27, armorPen: 0.625, rangeMod: 0.8, spreadStand: 0.7, spreadMove: 1.6, spreadAir: 5, recoil: 0.55, speed: 0.98, killReward: 600, sound: 'smg' },
  ump45: { ...base, id: 'ump45', name: 'UMP-45', cls: 'smg', slot: 'primary', price: 1200, automatic: true, fireRate: 11.1, magazine: 25, reserve: 100, reloadTime: 3.5, drawTime: 0.6, damage: 35, armorPen: 0.65, rangeMod: 0.75, spreadStand: 0.8, spreadMove: 1.8, spreadAir: 5, recoil: 0.75, speed: 0.92, killReward: 600, sound: 'smg' },
  mac10: { ...base, id: 'mac10', name: 'MAC-10', cls: 'smg', slot: 'primary', price: 1050, team: 'T', automatic: true, fireRate: 13.3, magazine: 30, reserve: 100, reloadTime: 2.6, drawTime: 0.5, damage: 29, armorPen: 0.575, rangeMod: 0.8, spreadStand: 0.9, spreadMove: 1.6, spreadAir: 5, recoil: 0.65, speed: 1, killReward: 600, sound: 'smg' },
  // ---------------------------------------------------------------- fuzis
  ak47: { ...base, id: 'ak47', name: 'AK-47', cls: 'rifle', slot: 'primary', price: 2700, team: 'T', automatic: true, fireRate: 10, magazine: 30, reserve: 90, reloadTime: 2.5, drawTime: 0.8, damage: 36, armorPen: 0.775, rangeMod: 0.98, spreadStand: 0.3, spreadMove: 4.5, spreadAir: 8, recoil: 1.05, recoilYaw: 0.9, speed: 0.86, sound: 'rifle', zoom: [0.72] },
  m4a4: { ...base, id: 'm4a4', name: 'M4A4', cls: 'rifle', slot: 'primary', price: 3100, team: 'CT', automatic: true, fireRate: 11.1, magazine: 30, reserve: 90, reloadTime: 3.1, drawTime: 0.8, damage: 33, armorPen: 0.7, rangeMod: 0.97, spreadStand: 0.27, spreadMove: 4, spreadAir: 8, recoil: 0.85, recoilYaw: 0.7, speed: 0.9, sound: 'rifle', zoom: [0.72] },
  m4a1: { ...base, id: 'm4a1', name: 'M4A1-S', cls: 'rifle', slot: 'primary', price: 2900, team: 'CT', automatic: true, fireRate: 10, magazine: 20, reserve: 80, reloadTime: 3.1, drawTime: 0.8, damage: 38, armorPen: 0.7, rangeMod: 0.99, spreadStand: 0.22, spreadMove: 3.8, spreadAir: 8, recoil: 0.7, recoilYaw: 0.5, speed: 0.9, sound: 'silenced', zoom: [0.72] },
  // ---------------------------------------------------------------- snipers
  awp: { ...base, id: 'awp', name: 'AWP', cls: 'sniper', slot: 'primary', price: 4750, fireRate: 0.68, magazine: 5, reserve: 30, reloadTime: 3.7, drawTime: 1.1, damage: 115, armorPen: 0.975, rangeMod: 0.99, range: 300, spreadStand: 5, spreadMove: 9, spreadAir: 14, recoil: 4, recoilYaw: 0.5, speed: 0.8, killReward: 100, sound: 'sniper', zoom: [0.42, 0.14], scope: true },
  ssg08: { ...base, id: 'ssg08', name: 'SSG 08', cls: 'sniper', slot: 'primary', price: 1700, fireRate: 0.8, magazine: 10, reserve: 90, reloadTime: 3.7, drawTime: 0.9, damage: 88, armorPen: 0.85, rangeMod: 0.98, range: 300, spreadStand: 3, spreadMove: 6, spreadAir: 0.6, recoil: 3, recoilYaw: 0.4, speed: 0.92, sound: 'sniper', zoom: [0.42, 0.16], scope: true },
  // ---------------------------------------------------------------- corpo a corpo, granadas e bomba
  knife: { ...base, id: 'knife', name: 'Faca', cls: 'knife', slot: 'knife', price: 0, fireRate: 2.2, magazine: 0, reserve: 0, reloadTime: 0, drawTime: 0.4, damage: 40, armorPen: 0.85, rangeMod: 1, range: 1.9, headMult: 1, spreadStand: 0, spreadMove: 0, spreadAir: 0, recoil: 0, speed: 1, killReward: 1500, sound: 'knife', zoom: [1] },
  he: { ...base, id: 'he', name: 'Granada explosiva', cls: 'grenade', slot: 'he', price: 300, fireRate: 1, magazine: 0, reserve: 0, reloadTime: 0, drawTime: 0.5, damage: 98, armorPen: 0.5, range: 0, spreadStand: 0, spreadMove: 0, spreadAir: 0, recoil: 0, speed: 1, sound: 'knife', zoom: [1] },
  flash: { ...base, id: 'flash', name: 'Granada de flash', cls: 'grenade', slot: 'flash', price: 200, fireRate: 1, magazine: 0, reserve: 0, reloadTime: 0, drawTime: 0.5, damage: 0, armorPen: 0, range: 0, spreadStand: 0, spreadMove: 0, spreadAir: 0, recoil: 0, speed: 1, sound: 'knife', zoom: [1] },
  smoke: { ...base, id: 'smoke', name: 'Granada de fumaça', cls: 'grenade', slot: 'smoke', price: 300, fireRate: 1, magazine: 0, reserve: 0, reloadTime: 0, drawTime: 0.5, damage: 0, armorPen: 0, range: 0, spreadStand: 0, spreadMove: 0, spreadAir: 0, recoil: 0, speed: 1, sound: 'knife', zoom: [1] },
  c4: { ...base, id: 'c4', name: 'Bomba C4', cls: 'c4', slot: 'c4', price: 0, fireRate: 1, magazine: 0, reserve: 0, reloadTime: 0, drawTime: 0.6, damage: 0, armorPen: 0, range: 0, spreadStand: 0, spreadMove: 0, spreadAir: 0, recoil: 0, speed: 1, sound: 'knife', zoom: [1] }
};

export interface EquipmentDef {
  id: 'vest' | 'vesthelm' | 'kit';
  name: string;
  price: number;
  team?: Team;
}

export const EQUIPMENT: EquipmentDef[] = [
  { id: 'vest', name: 'Colete', price: 650 },
  { id: 'vesthelm', name: 'Colete + Capacete', price: 1000 },
  { id: 'kit', name: 'Kit de desarme', price: 400, team: 'CT' }
];

export const BUY_CATEGORIES: { id: string; name: string; items: string[] }[] = [
  { id: 'pistol', name: 'Pistolas', items: ['glock', 'usp', 'p250', 'deagle'] },
  { id: 'smg', name: 'Submetralhadoras', items: ['mac10', 'ump45', 'mp5'] },
  { id: 'rifle', name: 'Fuzis', items: ['ak47', 'm4a1', 'm4a4'] },
  { id: 'sniper', name: 'Snipers', items: ['ssg08', 'awp'] },
  { id: 'grenade', name: 'Granadas', items: ['he', 'flash', 'smoke'] },
  { id: 'gear', name: 'Equipamento', items: ['vest', 'vesthelm', 'kit'] }
];

export function itemName(id: string): string {
  return WEAPONS[id]?.name ?? EQUIPMENT.find(e => e.id === id)?.name ?? id;
}

export function itemPrice(id: string): number {
  return WEAPONS[id]?.price ?? EQUIPMENT.find(e => e.id === id)?.price ?? 0;
}

export function itemTeam(id: string): Team | undefined {
  return WEAPONS[id]?.team ?? EQUIPMENT.find(e => e.id === id)?.team;
}

export const DEFAULT_PISTOL: Record<Team, string> = { T: 'glock', CT: 'usp' };
