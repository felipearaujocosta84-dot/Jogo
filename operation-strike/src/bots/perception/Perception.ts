// Percepção dos bots: campo de visão, linha de visão (paredes e fumaça), audição de tiros e passos próximos.
import type { MatchSim } from '../../sim/MatchSim';
import type { SimPlayer } from '../../sim/PlayerSim';

export interface Sighting {
  enemy: SimPlayer;
  dist: number;
  /** Ponto visível (cabeça ou peito). */
  visibleHead: boolean;
}

export function canSee(match: MatchSim, from: SimPlayer, to: SimPlayer, fovDeg: number): Sighting | null {
  if (!to.alive) return null;
  const eye = from.eye();
  const tp = to.ctrl.position;
  const dx = tp.x - eye.x, dz = tp.z - eye.z;
  const flat = Math.hypot(dx, dz);
  if (flat > 75) return null;
  // campo de visão (horizontal)
  if (flat > 3) {
    const fx = Math.sin(from.ctrl.yaw), fz = Math.cos(from.ctrl.yaw);
    const cos = (dx * fx + dz * fz) / flat;
    if (cos < Math.cos(((fovDeg / 2) * Math.PI) / 180)) return null;
  }
  const headY = tp.y + (to.ctrl.crouched ? 1.05 : 1.62);
  const chestY = tp.y + (to.ctrl.crouched ? 0.75 : 1.25);
  const world = match.map.world;
  for (const [y, head] of [[headY, true], [chestY, false]] as [number, boolean][]) {
    const dir = { x: dx, y: y - eye.y, z: dz };
    const d = Math.hypot(dir.x, dir.y, dir.z);
    const hit = world.raycast(eye, dir, d);
    if (hit && hit.distance < d - 0.2) continue;
    if (match.nades.smokeBlocks(eye, { x: tp.x, y, z: tp.z })) continue;
    return { enemy: to, dist: d, visibleHead: head };
  }
  return null;
}
