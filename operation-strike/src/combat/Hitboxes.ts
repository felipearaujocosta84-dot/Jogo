// Caixas de acerto por região do corpo (cabeça, peito, estômago, pernas), em pé ou agachado,
// e cálculo de dano com multiplicadores, colete, capacete e queda por distância.
import type { Vec3 } from '../physics/CollisionWorld';
import type { WeaponDef } from '../weapons/WeaponData';

export type HitRegion = 'head' | 'chest' | 'stomach' | 'legs';

export const REGION_MULT: Record<HitRegion, number> = { head: 4, chest: 1, stomach: 1.25, legs: 0.75 };

interface RegionBox {
  region: HitRegion;
  y0: number;
  y1: number;
  r: number;
}

const STAND: RegionBox[] = [
  { region: 'head', y0: 1.5, y1: 1.8, r: 0.14 },
  { region: 'chest', y0: 1.12, y1: 1.5, r: 0.24 },
  { region: 'stomach', y0: 0.85, y1: 1.12, r: 0.22 },
  { region: 'legs', y0: 0, y1: 0.85, r: 0.2 }
];
const CROUCH: RegionBox[] = [
  { region: 'head', y0: 0.93, y1: 1.2, r: 0.14 },
  { region: 'chest', y0: 0.66, y1: 0.93, r: 0.24 },
  { region: 'stomach', y0: 0.46, y1: 0.66, r: 0.22 },
  { region: 'legs', y0: 0, y1: 0.46, r: 0.24 }
];

export interface BodyHit {
  region: HitRegion;
  distance: number;
  point: Vec3;
}

/** Raio contra as caixas do corpo de um jogador. Retorna a região mais próxima atingida. */
export function rayBody(o: Vec3, d: Vec3, maxDist: number, pos: Vec3, crouched: boolean): BodyHit | null {
  // teste rápido contra a caixa inteira
  if (!slab(o, d, pos.x - 0.3, pos.y, pos.z - 0.3, pos.x + 0.3, pos.y + (crouched ? 1.2 : 1.8), pos.z + 0.3, maxDist)) return null;
  let best: BodyHit | null = null;
  for (const b of crouched ? CROUCH : STAND) {
    const t = slab(o, d, pos.x - b.r, pos.y + b.y0, pos.z - b.r, pos.x + b.r, pos.y + b.y1, pos.z + b.r, best ? best.distance : maxDist);
    if (t !== null && (!best || t < best.distance)) best = { region: b.region, distance: t, point: { x: o.x + d.x * t, y: o.y + d.y * t, z: o.z + d.z * t } };
  }
  return best;
}

function slab(o: Vec3, d: Vec3, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, maxT: number): number | null {
  let tmin = 0, tmax = maxT;
  const os = [o.x, o.y, o.z], ds = [d.x, d.y, d.z], mins = [x0, y0, z0], maxs = [x1, y1, z1];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(ds[i]) < 1e-9) {
      if (os[i] < mins[i] || os[i] > maxs[i]) return null;
      continue;
    }
    let t1 = (mins[i] - os[i]) / ds[i], t2 = (maxs[i] - os[i]) / ds[i];
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  return tmin;
}

export interface DamageResult {
  health: number;
  armor: number;
}

/** Dano de arma de fogo/faca considerando região, distância, colete e capacete. */
export function computeDamage(w: WeaponDef, region: HitRegion, distance: number, armor: number, helmet: boolean): DamageResult {
  let dmg = w.damage * Math.pow(w.rangeMod, distance / 12.7);
  dmg *= region === 'head' ? w.headMult : REGION_MULT[region];
  const armored = armor > 0 && (region !== 'legs') && (region !== 'head' || helmet);
  if (!armored) return { health: Math.round(dmg), armor: 0 };
  let health = dmg * w.armorPen;
  let armorDmg = (dmg - health) * 0.5;
  if (armorDmg > armor) {
    health += (armorDmg - armor) * 2;
    armorDmg = armor;
  }
  return { health: Math.round(health), armor: Math.round(armorDmg) };
}

/** Dano de explosão (granada/bomba) com queda linear e redução pelo colete. */
export function explosionDamage(maxDamage: number, radius: number, dist: number, armor: number): DamageResult {
  if (dist >= radius) return { health: 0, armor: 0 };
  const dmg = maxDamage * (1 - dist / radius);
  if (armor <= 0) return { health: Math.round(dmg), armor: 0 };
  return { health: Math.round(dmg * 0.57), armor: Math.round(Math.min(armor, dmg * 0.2)) };
}
