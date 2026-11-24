// Simulador de corpo rígido mínimo para testar VehiclePhysics em Node
// (substitui o Havok apenas nos testes automatizados).
import { v3, add, sub, scale, cross, dot, rotate, quatMul, quatNormalize, quatConj, quat } from '../../src/utils/MathUtils.js';

export class RigidBodySim {
  constructor({ mass, inertia, comLocal, position, rotation }) {
    this.mass = mass;
    this.invI = v3(1 / inertia.x, 1 / inertia.y, 1 / inertia.z);
    this.comLocal = comLocal;
    this.rot = rotation ?? quat();
    this.com = add(position, rotate(comLocal, this.rot));
    this.vel = v3();
    this.angVel = v3();
    this.chassisHits = 0;
  }
  get origin() { return sub(this.com, rotate(this.comLocal, this.rot)); }
  applyImpulse(J, p) {
    this.vel = add(this.vel, scale(J, 1 / this.mass));
    const r = sub(p, this.com);
    const tW = cross(r, J);
    // I^-1 no mundo = R * Ib^-1 * R^T
    const tb = rotate(tW, quatConj(this.rot));
    const wb = v3(tb.x * this.invI.x, tb.y * this.invI.y, tb.z * this.invI.z);
    this.angVel = add(this.angVel, rotate(wb, this.rot));
  }
  integrate(dt, groundHeightAt) {
    this.vel.y -= 9.81 * dt;
    this.com = add(this.com, scale(this.vel, dt));
    const w = this.angVel;
    const dq = quatMul(quat(w.x, w.y, w.z, 0), this.rot);
    this.rot = quatNormalize(quat(this.rot.x + 0.5 * dq.x * dt, this.rot.y + 0.5 * dq.y * dt, this.rot.z + 0.5 * dq.z * dt, this.rot.w + 0.5 * dq.w * dt));
    // Contato do chassi com o solo (não deveria acontecer em condução normal)
    const o = this.origin;
    for (const c of [v3(-0.9, -0.16, 2.1), v3(0.9, -0.16, 2.1), v3(-0.9, -0.16, -2.1), v3(0.9, -0.16, -2.1)]) {
      const p = add(o, rotate(c, this.rot));
      const h = groundHeightAt(p);
      if (p.y < h) {
        this.chassisHits++;
        const depth = h - p.y;
        this.com.y += depth;
        if (this.vel.y < 0) this.vel.y *= -0.1;
      }
    }
  }
}

/** Adapter equivalente ao usado com Havok, sobre o simulador. */
export function makeAdapter(body, ground, surfaceAt) {
  return {
    getState(out) {
      out.pos = body.origin;
      out.rot = { ...body.rot };
      out.vel = { ...body.vel };
      out.angVel = { ...body.angVel };
      out.com = { ...body.com };
    },
    raycast(from, to) {
      // Raio contra o terreno: marcha ao longo do raio
      const dir = sub(to, from);
      const len = Math.hypot(dir.x, dir.y, dir.z);
      const steps = 24;
      let prevT = 0;
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const p = add(from, scale(dir, t));
        if (p.y <= ground.heightAt(p)) {
          // refino por bissecção
          let a = prevT, b = t;
          for (let k = 0; k < 12; k++) {
            const m = (a + b) / 2;
            const pm = add(from, scale(dir, m));
            if (pm.y <= ground.heightAt(pm)) b = m; else a = m;
          }
          const hp = add(from, scale(dir, b));
          return { distance: b * len, point: hp, normal: ground.normalAt(hp) };
        }
        prevT = t;
      }
      return null;
    },
    applyImpulse(J, p) { body.applyImpulse(J, p); },
    surfaceAt: surfaceAt ?? null,
  };
}

export const flatGround = { heightAt: () => 0, normalAt: () => v3(0, 1, 0) };

export function trackGround(track) {
  let hint = -1;
  return {
    heightAt(p) {
      const pr = track.project(p, hint);
      hint = pr.index;
      return track.pointAt(pr.s, 0).p.y;
    },
    normalAt(p) {
      const pr = track.project(p, hint);
      const t = track.sampleAt(pr.index).t;
      const n = track.sampleAt(pr.index).n;
      // normal = right x tangent... (cima) = cross(t, n) normalizado
      const up = cross(t, n);
      const l = Math.hypot(up.x, up.y, up.z);
      const r = v3(up.x / l, up.y / l, up.z / l);
      return r.y < 0 ? scale(r, -1) : r;
    },
  };
}

export { dot };
