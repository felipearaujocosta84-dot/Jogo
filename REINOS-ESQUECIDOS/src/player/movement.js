// Movimento do jogador: joystick relativo à câmera, aceleração, giro suave, colisões,
// água funda, terreno, esquiva e empurrões.
import { Vector3 } from '../babylon.js';

const WALK = 2.3;
const RUN = 5.4;

export class Movement {
  constructor(player) {
    this.player = player;
    this.velocity = new Vector3(0, 0, 0);
    this.knock = new Vector3(0, 0, 0);
    this.dash = null; // { dir, t, dur, speed }
    this.lastStepPhase = 0;
    this._tmp = new Vector3();
  }

  get game() { return this.player.game; }

  /** Direção no chão a partir do joystick (x direita, y para cima) relativa à câmera. */
  inputDirection(input) {
    const cam = this.game.cameraRig;
    const f = cam.forwardFlat();
    const rx = f.z, rz = -f.x;
    const x = rx * input.x + f.x * input.y;
    const z = rz * input.x + f.z * input.y;
    const m = Math.hypot(x, z);
    if (m < 1e-4) return null;
    return { x: x / m, z: z / m };
  }

  startDash(dir, speed = 9, dur = 0.42) {
    this.dash = { dir, t: 0, dur, speed };
  }

  addKnockback(x, z, force) {
    this.knock.x += x * force;
    this.knock.z += z * force;
  }

  update(dt, input) {
    const p = this.player;
    const world = this.game.world;
    if (p.dead) {
      this.velocity.scaleInPlace(Math.max(0, 1 - dt * 8));
      return;
    }
    const combat = p.combat;
    let desiredX = 0, desiredZ = 0;
    const mag = Math.min(1, input.magnitude);
    const dir = mag > 0.08 ? this.inputDirection(input) : null;
    const locked = combat.movementLocked();

    if (this.dash) {
      const d = this.dash;
      d.t += dt;
      const k = 1 - d.t / d.dur;
      desiredX = d.dir.x * d.speed * Math.max(0.2, k);
      desiredZ = d.dir.z * d.speed * Math.max(0.2, k);
      this.velocity.x = desiredX;
      this.velocity.z = desiredZ;
      if (d.t >= d.dur) this.dash = null;
    } else {
      if (dir && !locked) {
        let speed = mag > 0.82 ? RUN : WALK + (RUN - WALK) * Math.max(0, (mag - 0.35) / 0.47);
        if (input.walk) speed = Math.min(speed, WALK);
        // subida íngreme deixa mais lento
        const sl = world.terrain.slopeAt(p.position.x, p.position.z);
        const uphill = sl.dx * dir.x + sl.dz * dir.z;
        if (uphill > 0.25) speed *= Math.max(0.45, 1 - (uphill - 0.25));
        desiredX = dir.x * speed;
        desiredZ = dir.z * speed;
      }
      // avanço curto durante golpes
      const lunge = combat.lungeSpeed();
      if (lunge) {
        desiredX += Math.sin(p.yaw) * lunge;
        desiredZ += Math.cos(p.yaw) * lunge;
      }
      const accel = (dir && !locked) ? 12 : 16;
      const k = Math.min(1, accel * dt);
      this.velocity.x += (desiredX - this.velocity.x) * k;
      this.velocity.z += (desiredZ - this.velocity.z) * k;
    }

    // giro
    if (!this.dash) {
      let targetYaw = null;
      if (combat.facingOverride !== null) targetYaw = combat.facingOverride;
      else if (dir && !locked) targetYaw = Math.atan2(dir.x, dir.z);
      if (targetYaw !== null) {
        let d = targetYaw - p.yaw;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        p.yaw += d * Math.min(1, dt * (combat.facingOverride !== null ? 22 : 12));
      }
    }

    // empurrão (dano)
    const kx = this.knock.x, kz = this.knock.z;
    this.knock.scaleInPlace(Math.max(0, 1 - dt * 7));

    const nx = p.position.x + (this.velocity.x + kx) * dt;
    const nz = p.position.z + (this.velocity.z + kz) * dt;
    const pos = this._tmp.set(nx, 0, nz);
    // água funda: desliza ao longo da margem
    if (world.isDeepWater(pos.x, pos.z)) {
      if (!world.isDeepWater(pos.x, p.position.z)) pos.z = p.position.z;
      else if (!world.isDeepWater(p.position.x, pos.z)) pos.x = p.position.x;
      else { pos.x = p.position.x; pos.z = p.position.z; }
    }
    world.resolve(pos, p.radius);
    this.game.resolveAgainstCharacters(pos, p.radius, p);

    const moved = Math.hypot(pos.x - p.position.x, pos.z - p.position.z);
    p.position.x = pos.x;
    p.position.z = pos.z;
    const gy = world.groundAt(pos.x, pos.z);
    // dentro d'água rasa afunda um pouco
    let y = gy;
    if (world.waterLevel > gy) y = Math.max(gy, gy);
    p.position.y += (y - p.position.y) * Math.min(1, dt * 18);

    const speed = moved / Math.max(dt, 1e-4);
    p.speedNorm += (Math.min(1, speed / RUN) - p.speedNorm) * Math.min(1, dt * 10);
    if (!this.dash) {
      const stride = speed > 3.5 ? 2.3 : 1.55;
      p.phase += (moved / stride) * Math.PI * 2;
      const step = Math.floor(p.phase / Math.PI);
      if (step !== this.lastStepPhase) {
        this.lastStepPhase = step;
        if (speed > 0.8) this.game.audio.step(world.waterLevel > gy - 0.05 ? 'water' : 'grass', Math.min(1, speed / RUN));
      }
    }
  }
}
