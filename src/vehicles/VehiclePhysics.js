// =============================================================
// EXTREME RACING — VehiclePhysics
// Controlador automotivo completo, independente de renderização.
// O corpo rígido (chassi) é simulado pelo motor de física (Havok no
// jogo); este módulo lê o estado do corpo através de um "adapter",
// lança um raio por roda, calcula suspensão, pneus, motor, câmbio,
// diferencial, freios (ABS), controle de tração e aerodinâmica, e
// aplica as forças resultantes como impulsos no chassi.
//
// Interface do adapter:
//   getState(out)  -> preenche out.pos, out.rot (quat), out.vel, out.angVel, out.com
//   raycast(from, to) -> null | { distance, point, normal }
//   applyImpulse(impulse, point)
//   surfaceAt(point) -> objeto SURFACE (opcional)
// =============================================================
import {
  v3, add, sub, scale, dot, cross, normalize, rotate, projectOnPlane, clamp, lerp, damp, moveTowards,
  GRAVITY, DEG,
} from '../utils/MathUtils.js';
import { Engine } from './Engine.js';
import { Transmission } from './Transmission.js';
import { Wheel } from './WheelSystem.js';

const AIR_DENSITY = 1.225;
const DEFAULT_SURFACE = { id: 'asphalt', grip: 1, rolling: 0.012, bumpy: 0 };

export class VehiclePhysics {
  /**
   * @param {object} spec especificação (VehicleCatalog + upgrades)
   * @param {object} adapter ponte com o corpo rígido
   * @param {object} options { transmission:'auto'|'manual', abs, tc }
   */
  constructor(spec, adapter, options = {}) {
    this.spec = spec;
    this.adapter = adapter;
    this.mass = spec.mass;
    this.engine = new Engine(spec.engine);
    this.transmission = new Transmission(spec.transmission, options.transmission ?? 'auto');
    this.absEnabled = options.abs ?? true;
    this.tcEnabled = options.tc ?? true;
    this.stabilityEnabled = options.stability ?? false; // assistência de estabilidade (ESP simplificado)
    this.gripMultiplier = 1; // clima (chuva < 1)
    this.launchHold = false; // segura o carro no grid antes da largada
    this.rpmPerMs = 60 / (2 * Math.PI * spec.wheelRadius);

    const hw = spec.wheelbase / 2;
    const zFront = hw; // eixos simétricos em torno da origem do corpo
    const zRear = -hw;
    const s = spec.suspension;
    const mk = (name, front, side) => new Wheel({
      name, front, side,
      x: side * (front ? spec.trackFront : spec.trackRear) / 2,
      z: front ? zFront : zRear,
      driven: spec.drive === 'AWD' || (spec.drive === 'FWD' ? front : !front),
      steer: front,
      radius: spec.wheelRadius,
      width: spec.wheelWidth,
      inertia: spec.wheelInertia,
      suspension: {
        mountY: s.mountY, restLength: s.restLength, maxCompression: s.maxCompression,
        stiffness: front ? s.stiffnessFront : s.stiffnessRear,
        bump: s.bumpDamping, rebound: s.reboundDamping,
      },
    });
    this.wheels = [mk('FL', true, -1), mk('FR', true, 1), mk('RL', false, -1), mk('RR', false, 1)];

    // Centro de massa: posiciona para obter a distribuição de peso desejada
    this.comLocal = v3(spec.comOffset.x, spec.comOffset.y, zRear + spec.wheelbase * spec.weightFront);

    this.state = { pos: v3(), rot: { x: 0, y: 0, z: 0, w: 1 }, vel: v3(), angVel: v3(), com: v3() };
    this.axes = { right: v3(1, 0, 0), up: v3(0, 1, 0), fwd: v3(0, 0, 1) };
    this.steerAngle = 0;
    this.input = { throttle: 0, brake: 0, steer: 0, handbrake: 0 };
    this.tcFactor = 1;
    this.tcActive = false;
    this.absActive = false;
    this.speed = 0; // m/s (módulo)
    this.forwardSpeed = 0;
    this.lateralSpeed = 0;
    this.accelLocal = v3(); // aceleração em g no referencial do carro (câmera/HUD)
    this._prevVelLocal = v3();
    this.groundedWheels = 0;
    this.downforce = 0;
    this.drag = 0;
    this.impact = 0; // intensidade de colisão detectada neste passo
    this._prevVel = null;
    this.driftAngle = 0;
  }

  /** Inércia (Vector-like) aproximada para o corpo rígido. */
  static inertiaFor(spec) {
    const { width: w, length: l, height: h } = spec.dims;
    const m = spec.mass;
    return v3((m / 12) * (h * h + l * l) * 0.9, (m / 12) * (w * w + l * l) * 0.9, (m / 12) * (w * w + h * h) * 0.9);
  }

  maxSteerAt(speed) {
    const base = this.spec.steerMaxDeg * DEG;
    return Math.max(4.5 * DEG, base / (1 + Math.abs(speed) / this.spec.steerSpeedFactor));
  }

  get speedKmh() { return this.speed * 3.6; }
  get gear() { return this.transmission.gear; }
  get rpm() { return this.engine.displayRpm; }

  /**
   * Passo de simulação (dt fixo, ex.: 1/60).
   * @param {number} dt
   * @param {object} input { throttle 0..1, brake 0..1, steer -1..1, handbrake 0..1 }
   */
  step(dt, input) {
    const A = this.adapter;
    const st = this.state;
    A.getState(st);
    const q = st.rot;
    const right = rotate(v3(1, 0, 0), q);
    const up = rotate(v3(0, 1, 0), q);
    const fwd = rotate(v3(0, 0, 1), q);
    this.axes.right = right; this.axes.up = up; this.axes.fwd = fwd;

    const vel = st.vel;
    this.speed = Math.hypot(vel.x, vel.y, vel.z);
    this.forwardSpeed = dot(vel, fwd);
    this.lateralSpeed = dot(vel, right);
    this.driftAngle = this.speed > 4 ? Math.atan2(this.lateralSpeed, Math.abs(this.forwardSpeed)) : 0;

    // Detecção de impacto (variação brusca de velocidade)
    this.impact = 0;
    if (this._prevVel) {
      const dv = Math.hypot(vel.x - this._prevVel.x, vel.y - this._prevVel.y, vel.z - this._prevVel.z);
      const expected = 3.2 * GRAVITY * dt + 0.5;
      if (dv > expected) this.impact = dv - expected;
    }
    this._prevVel = { x: vel.x, y: vel.y, z: vel.z };
    // Aceleração local (g)
    const vl = v3(this.lateralSpeed, dot(vel, up), this.forwardSpeed);
    this.accelLocal = v3(
      damp(this.accelLocal.x, (vl.x - this._prevVelLocal.x) / dt / GRAVITY, 6, dt),
      damp(this.accelLocal.y, (vl.y - this._prevVelLocal.y) / dt / GRAVITY, 6, dt),
      damp(this.accelLocal.z, (vl.z - this._prevVelLocal.z) / dt / GRAVITY, 6, dt)
    );
    this._prevVelLocal = vl;

    // ---------- Entradas ----------
    const tr = this.transmission;
    const rawThrottle = clamp(input.throttle, 0, 1);
    const rawBrake = clamp(input.brake, 0, 1);
    let throttle = rawThrottle;
    let brake = rawBrake;
    const handbrake = clamp(input.handbrake ?? 0, 0, 1);
    // Em ré automática, o freio vira acelerador e vice-versa
    if (tr.mode === 'auto' && tr.gear < 0) { const t = throttle; throttle = brake; brake = t; }
    if (this.launchHold) { brake = 1; }
    this.input = { throttle, brake, steer: input.steer, handbrake };

    // Direção sensível à velocidade, com limite de taxa
    let steerLimit = this.maxSteerAt(this.forwardSpeed);
    // Contra-esterço: permite mais ângulo quando o volante aponta para o lado da derrapagem
    if (Math.sign(input.steer) === Math.sign(this.driftAngle) && Math.abs(this.driftAngle) > 0.06) {
      steerLimit = Math.max(steerLimit, Math.min(this.spec.steerMaxDeg * DEG, Math.abs(this.driftAngle) + 6 * DEG));
    }
    const targetSteer = clamp(input.steer, -1, 1) * steerLimit;
    this.steerAngle = moveTowards(this.steerAngle, targetSteer, this.spec.steerRate * dt);

    // ---------- Transmissão e motor ----------
    const driven = this.wheels.filter((w) => w.driven);
    let avgOmega = 0;
    for (const w of driven) avgOmega += w.omega;
    avgOmega /= driven.length;
    const ratio = tr.totalRatio;
    const wheelRpm = (avgOmega * ratio * 60) / (2 * Math.PI);
    const clutch = !tr.isShifting && tr.gear !== 0 && !this.launchHold;

    // Controle de tração: mantém o escorregamento das rodas motrizes perto do ideal
    let maxDrivenSlip = 0;
    for (const w of driven) if (w.contact) maxDrivenSlip = Math.max(maxDrivenSlip, w.slipRatio * Math.sign(ratio || 1));
    if (this.tcEnabled && this.speed > 0.5) {
      const target = clamp(1 - (maxDrivenSlip - 0.1) * 6, 0.08, 1);
      this.tcFactor = target < this.tcFactor ? moveTowards(this.tcFactor, target, 10 * dt) : moveTowards(this.tcFactor, target, 3 * dt);
    } else this.tcFactor = moveTowards(this.tcFactor, 1, 3 * dt);
    this.tcActive = this.tcEnabled && this.tcFactor < 0.97 && throttle > 0.2;
    // Estimativa da tração disponível (feed-forward): evita pedir mais torque do que os pneus transmitem
    let ffFactor = 1;
    if (this.tcEnabled && throttle > 0 && ratio !== 0) {
      let tractionTorque = 0;
      for (const w of driven) {
        const mu = this.spec.tireGrip * (w.surface?.grip ?? 1) * this.gripMultiplier;
        tractionTorque += mu * w.load * w.radius * 0.97;
      }
      const demand = Math.abs(this.engine.maxTorqueAt(this.engine.rpm) * throttle * ratio * tr.efficiency);
      if (demand > tractionTorque && tractionTorque > 0) ffFactor = tractionTorque / demand;
    }
    let engThrottle = throttle * (this.tcEnabled ? Math.min(ffFactor, this.tcFactor) : 1);
    // ESP: corta potência quando a traseira escorrega demais
    this.espActive = false;
    if (this.stabilityEnabled && this.speed > 8 && Math.abs(this.driftAngle) > 0.12 && this.forwardSpeed > 0) {
      engThrottle *= clamp(1 - (Math.abs(this.driftAngle) - 0.12) * 4, 0.15, 1);
      this.espActive = true;
    }
    const crankTorque = this.engine.update(dt, engThrottle, wheelRpm, clutch, tr.gear === 1 || tr.gear === -1);
    tr.update(dt, {
      rpm: this.engine.rpm, maxRpm: this.engine.maxRpm, redline: this.engine.redline,
      throttle: this.launchHold ? 0 : rawThrottle, brake: this.launchHold ? 0 : rawBrake, forwardSpeed: this.forwardSpeed, rpmPerMs: this.rpmPerMs,
    });
    const axleTorque = clutch ? crankTorque * ratio * tr.efficiency : 0;
    this._distributeTorque(axleTorque);

    // ---------- Freios (com ABS) ----------
    const bias = this.spec.brakeBias;
    this.absActive = false;
    for (const w of this.wheels) {
      let tb = brake * this.spec.brakeTorque * (w.front ? bias : 1 - bias) * 0.5;
      // ABS: modula a pressão para manter o escorregamento perto do pico de aderência
      if (this.absEnabled && tb > 0 && w.contact && Math.abs(this.forwardSpeed) > 2.5) {
        const slip = w.slipRatio * Math.sign(this.forwardSpeed);
        if (slip < -0.1) w.absFactor = Math.max(0.15, w.absFactor - 9 * dt);
        else if (slip > -0.06) w.absFactor = Math.min(1, w.absFactor + 4 * dt);
        tb *= w.absFactor;
        w.absActive = w.absFactor < 0.97;
        if (w.absActive) this.absActive = true;
      } else { w.absFactor = 1; w.absActive = false; }
      if (!w.front && handbrake > 0) tb += handbrake * this.spec.handbrakeTorque;
      w.brakeTorque = tb;
    }

    // ---------- Suspensão (raycast por roda) ----------
    this.groundedWheels = 0;
    for (const w of this.wheels) {
      const mountWorld = add(st.pos, rotate(w.mount, q));
      const rayLen = w.susp.restLength + w.radius;
      const hit = A.raycast(mountWorld, add(mountWorld, scale(up, -rayLen)));
      w._mountWorld = mountWorld;
      if (hit && hit.distance <= rayLen) {
        const prevComp = w.contact ? w.compression : 0;
        w.contact = true;
        this.groundedWheels++;
        w.suspensionLength = clamp(hit.distance - w.radius, w.susp.restLength - w.susp.maxCompression, w.susp.restLength);
        w.compression = clamp(w.susp.restLength - (hit.distance - w.radius), 0, w.susp.maxCompression * 1.2);
        w.contactPoint = hit.point;
        w.contactNormal = hit.normal;
        w.surface = (A.surfaceAt && A.surfaceAt(hit.point)) || DEFAULT_SURFACE;
        // Velocidade de compressão a partir da velocidade do ponto
        const r = sub(hit.point, st.com);
        const vp = add(vel, cross(st.angVel, r));
        const fromPoint = -dot(vp, up);
        const fromDelta = (w.compression - prevComp) / dt;
        w.compressionVel = clamp(lerp(fromPoint, fromDelta, 0.3), -6, 6);
        w._vp = vp;
      } else {
        w.contact = false;
        w.compression = 0;
        w.compressionVel = 0;
        w.suspensionLength = moveTowards(w.suspensionLength, w.susp.restLength, 2 * dt);
      }
    }

    // ---------- Cargas: mola + amortecedor + barra estabilizadora ----------
    const arb = [this.spec.suspension.antiRollFront, this.spec.suspension.antiRollRear];
    const loads = this.wheels.map((w) => w.suspensionForce());
    for (let axle = 0; axle < 2; axle++) {
      const L = this.wheels[axle * 2], R = this.wheels[axle * 2 + 1];
      const diff = (L.compression - R.compression) * arb[axle];
      if (L.contact) loads[axle * 2] = Math.max(0, loads[axle * 2] + diff);
      if (R.contact) loads[axle * 2 + 1] = Math.max(0, loads[axle * 2 + 1] - diff);
    }
    const staticLoad = (this.mass * GRAVITY) / 4;

    // ---------- Pneus e aplicação de forças ----------
    const tire = this.spec.tire;
    for (let i = 0; i < 4; i++) {
      const w = this.wheels[i];
      w.steerAngle = w.steerable ? this.steerAngle : 0;
      if (!w.contact) {
        w.freeSpin(dt);
        w.spin += w.omega * dt;
        continue;
      }
      const n = w.contactNormal;
      const cs = Math.cos(w.steerAngle), sn = Math.sin(w.steerAngle);
      const wheelFwd = add(scale(fwd, cs), scale(right, sn));
      let fwdC = normalize(projectOnPlane(wheelFwd, n));
      if (fwdC.x === 0 && fwdC.y === 0 && fwdC.z === 0) fwdC = fwd;
      const rightC = cross(n, fwdC);
      const vp = w._vp;
      const vLong = dot(vp, fwdC);
      const vLat = dot(vp, rightC);

      w.load = clamp(loads[i], 0, staticLoad * 4.5);
      const surf = w.surface;
      const mu = this.spec.tireGrip * surf.grip * this.gripMultiplier * (w.front ? 1 : this.spec.tire.rearGrip ?? 1);
      const latScale = w.front ? tire.latFront ?? 1 : tire.latRear ?? 1;
      const longScale = w.front ? tire.longFront ?? 1 : tire.longRear ?? 1;
      w.solveTire(dt, vLong, vLat, w.front ? tire : tire.rearCurve ?? tire, mu, latScale, longScale);
      w.spin += w.omega * dt;

      // Resistência ao rolamento
      const rolling = -w.load * (surf.rolling ?? tire.rolling) * clamp(vLong / 0.6, -1, 1);

      const Fs = loads[i];
      const applyAt = add(w.contactPoint, scale(up, this.spec.forceHeight));
      const F = add(add(scale(n, Fs * Math.max(0, dot(n, up))), scale(fwdC, w.Fx + rolling)), scale(rightC, w.Fy));
      A.applyImpulse(scale(F, dt), applyAt);
    }

    // ---------- Aerodinâmica ----------
    const aero = this.spec.aero;
    const v2 = this.speed * this.speed;
    const fwdSpeed = Math.max(0, this.forwardSpeed);
    this.drag = 0.5 * AIR_DENSITY * aero.cdA * v2;
    if (this.speed > 0.5) {
      const dragImpulse = scale(normalize(vel), -this.drag * dt);
      A.applyImpulse(dragImpulse, st.com);
    }
    const upright = dot(up, v3(0, 1, 0));
    this.downforce = 0.5 * AIR_DENSITY * aero.clA * fwdSpeed * fwdSpeed * Math.max(0, upright);
    if (this.downforce > 1) {
      const hw = this.spec.wheelbase / 2;
      const front = add(st.pos, rotate(v3(0, 0.2, hw), q));
      const rear = add(st.pos, rotate(v3(0, 0.2, -hw), q));
      A.applyImpulse(scale(up, -this.downforce * aero.balance * dt), front);
      A.applyImpulse(scale(up, -this.downforce * (1 - aero.balance) * dt), rear);
    }
  }

  /** Diferencial: divide o torque entre eixos (AWD) e rodas (LSD). */
  _distributeTorque(axleTorque) {
    for (const w of this.wheels) w.driveTorque = 0;
    const spec = this.spec;
    const axles = [];
    if (spec.drive === 'AWD') {
      axles.push([this.wheels[0], this.wheels[1], spec.frontTorqueSplit]);
      axles.push([this.wheels[2], this.wheels[3], 1 - spec.frontTorqueSplit]);
    } else if (spec.drive === 'FWD') axles.push([this.wheels[0], this.wheels[1], 1]);
    else axles.push([this.wheels[2], this.wheels[3], 1]);
    for (const [L, R, share] of axles) {
      const T = axleTorque * share;
      // Diferencial autoblocante: transfere torque da roda mais rápida para a mais lenta
      const dOmega = L.omega - R.omega;
      const lockLimit = spec.lsd.preload + Math.abs(T) * 0.35;
      const transfer = clamp(dOmega * spec.lsd.factor, -lockLimit, lockLimit);
      L.driveTorque = T / 2 - transfer;
      R.driveTorque = T / 2 + transfer;
    }
  }

  /** Zera rotação das rodas e estado interno (respawn). */
  resetState() {
    for (const w of this.wheels) {
      w.omega = 0; w.contact = false; w.compression = 0; w.compressionVel = 0;
      w.slipRatio = 0; w.slipAngle = 0; w.slipSpeed = 0;
    }
    this.steerAngle = 0;
    this._prevVel = null;
    this.tcFactor = 1;
    this.engine.rpm = this.engine.idleRpm;
    this.transmission.gear = 1;
    this.transmission.shiftTimer = 0;
    this.transmission.pendingGear = null;
  }

  /** Telemetria para HUD/áudio/efeitos. */
  telemetry() {
    let skid = 0;
    for (const w of this.wheels) if (w.contact) skid = Math.max(skid, w.slipSpeed);
    return {
      speedKmh: this.speed * 3.6,
      electric: !!this.spec.engine.electric,
      forwardKmh: this.forwardSpeed * 3.6,
      rpm: this.engine.displayRpm,
      maxRpm: this.engine.maxRpm,
      redline: this.engine.redline,
      gear: this.transmission.gear,
      shifting: this.transmission.isShifting,
      throttle: this.input.throttle,
      brake: this.input.brake,
      skid,
      abs: this.absActive,
      tc: this.tcActive,
      grounded: this.groundedWheels,
      drift: this.driftAngle,
    };
  }
}
