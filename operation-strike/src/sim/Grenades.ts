// Granadas: física com gravidade e quique nas paredes, detonação por tempo (explosiva/flash)
// ou ao parar (fumaça). A fumaça bloqueia a visão (bots e flash) por 18 segundos.
import type { CollisionWorld, Vec3 } from '../physics/CollisionWorld';

export type NadeType = 'he' | 'flash' | 'smoke';

export interface Nade {
  id: number;
  type: NadeType;
  owner: string;
  pos: Vec3;
  vel: Vec3;
  t: number;
  done: boolean;
  /** Fumaça ativa: tempo restante (0 = ainda voando). */
  smoke: number;
  lastBounce: number;
}

export const SMOKE_RADIUS = 3.3;
export const SMOKE_TIME = 18;
const GRAVITY = 12;
const R = 0.07;

export class GrenadeSim {
  nades: Nade[] = [];
  private nextId = 1;

  constructor(private world: CollisionWorld) {}

  setWorld(w: CollisionWorld): void {
    this.world = w;
  }

  throw(owner: string, type: NadeType, pos: Vec3, vel: Vec3): Nade {
    const n: Nade = { id: this.nextId++, type, owner, pos: { ...pos }, vel: { ...vel }, t: 0, done: false, smoke: 0, lastBounce: -1 };
    this.nades.push(n);
    return n;
  }

  clear(): void {
    this.nades = [];
  }

  /** Avança a física. Chama onDetonate quando uma granada explode/ativa; onBounce para som. */
  step(dt: number, onDetonate: (n: Nade) => void, onBounce: (n: Nade) => void): void {
    for (const n of this.nades) {
      n.t += dt;
      if (n.smoke > 0) {
        n.smoke -= dt;
        if (n.smoke <= 0) n.done = true;
        continue;
      }
      // física com subpassos
      const steps = 3;
      const h = dt / steps;
      for (let s = 0; s < steps; s++) {
        n.vel.y -= GRAVITY * h;
        for (const ax of ['x', 'y', 'z'] as const) {
          const d = n.vel[ax] * h;
          if (!d) continue;
          const np = { ...n.pos };
          np[ax] += d;
          if (this.world.overlaps({ x: np.x - R, y: np.y - R, z: np.z - R }, { x: np.x + R, y: np.y + R, z: np.z + R })) {
            const speed = Math.abs(n.vel[ax]);
            n.vel[ax] *= -0.42;
            const other = ax === 'y' ? ['x', 'z'] : ['x', 'y', 'z'].filter(a => a !== ax);
            for (const o of other) n.vel[o as 'x'] *= ax === 'y' ? 0.75 : 0.85;
            if (speed > 2 && n.t - n.lastBounce > 0.1) {
              n.lastBounce = n.t;
              onBounce(n);
            }
          } else n.pos[ax] = np[ax];
        }
      }
      const speed = Math.hypot(n.vel.x, n.vel.y, n.vel.z);
      if ((n.type === 'he' && n.t >= 1.6) || (n.type === 'flash' && n.t >= 1.5)) {
        n.done = true;
        onDetonate(n);
      } else if (n.type === 'smoke' && ((n.t > 1.2 && speed < 0.6) || n.t > 4)) {
        n.smoke = SMOKE_TIME;
        n.vel = { x: 0, y: 0, z: 0 };
        onDetonate(n);
      }
    }
    this.nades = this.nades.filter(n => !n.done);
  }

  activeSmokes(): Nade[] {
    return this.nades.filter(n => n.smoke > 0);
  }

  /** O segmento a→b atravessa alguma fumaça? */
  smokeBlocks(a: Vec3, b: Vec3): boolean {
    for (const n of this.nades) {
      if (n.smoke <= 0 || n.smoke > SMOKE_TIME - 0.8) continue;
      const c = { x: n.pos.x, y: n.pos.y + 1.2, z: n.pos.z };
      const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
      const len2 = dx * dx + dy * dy + dz * dz || 1;
      let t = ((c.x - a.x) * dx + (c.y - a.y) * dy + (c.z - a.z) * dz) / len2;
      t = Math.max(0, Math.min(1, t));
      const px = a.x + dx * t - c.x, py = (a.y + dy * t - c.y) * 1.4, pz = a.z + dz * t - c.z;
      if (px * px + py * py + pz * pz < SMOKE_RADIUS * SMOKE_RADIUS) return true;
    }
    return false;
  }
}
