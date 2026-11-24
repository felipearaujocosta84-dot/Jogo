// =============================================================
// EXTREME RACING — Engine
// Motor de combustão: curva de torque, RPM, freio-motor,
// limitador de giro e embreagem patinando na largada.
// =============================================================
import { interpTable, clamp, damp } from '../utils/MathUtils.js';

export class Engine {
  constructor(spec) {
    this.spec = spec;
    this.idleRpm = spec.idleRpm;
    this.maxRpm = spec.maxRpm;
    this.redline = spec.redline;
    this.curve = spec.torqueCurve;
    this.torqueMultiplier = spec.torqueMultiplier ?? 1;
    this.rpm = spec.idleRpm;
    this.displayRpm = spec.idleRpm;
    this.throttle = 0;
    this.load = 0; // 0..1, usado pelo áudio
    this.limiterActive = false;
    this._limiterTimer = 0;
    this.launchRpm = Math.min(spec.redline * 0.55, 4200);
  }

  /** Torque máximo (N·m) disponível em um RPM. */
  maxTorqueAt(rpm) {
    return interpTable(this.curve, clamp(rpm, this.curve[0][0], this.maxRpm)) * this.torqueMultiplier;
  }

  /**
   * Motor elétrico: ligado direto às rodas (sem embreagem nem marcha lenta),
   * torque máximo desde zero e frenagem regenerativa ao soltar o acelerador.
   */
  _updateElectric(dt, throttle, wheelRpm, connected) {
    const rpm = Math.abs(wheelRpm);
    if (rpm >= this.maxRpm) this._limiterTimer = 0.05;
    this._limiterTimer = Math.max(0, this._limiterTimer - dt);
    this.limiterActive = this._limiterTimer > 0;
    this.rpm = Math.min(rpm, this.maxRpm + 150);
    this.displayRpm = damp(this.displayRpm, this.rpm, 18, dt);
    const eff = this.limiterActive ? 0 : throttle;
    this.load = damp(this.load, eff, 10, dt);
    if (!connected) return 0;
    const drive = this.maxTorqueAt(this.rpm) * eff;
    const regen = rpm > 300 ? this.spec.engineBrake * (1 - eff) * Math.min(1, rpm / 1500) : 0;
    return drive - regen * Math.sign(wheelRpm || 1);
  }

  /** Potência máxima aproximada em kW (para a garagem). */
  peakPowerKW() {
    let best = 0;
    for (let rpm = this.idleRpm; rpm <= this.maxRpm; rpm += 100) {
      best = Math.max(best, (this.maxTorqueAt(rpm) * rpm * Math.PI) / 30 / 1000);
    }
    return best;
  }

  /**
   * Atualiza o motor e retorna o torque no virabrequim (N·m).
   * @param {number} dt
   * @param {number} throttle 0..1
   * @param {number} wheelRpm RPM equivalente vindo das rodas (já multiplicado pela relação)
   * @param {boolean} clutchEngaged false em neutro ou durante a troca
   * @param {boolean} launchGear true em 1ª marcha ou ré (permite patinar a embreagem)
   */
  update(dt, throttle, wheelRpm, clutchEngaged, launchGear) {
    this.throttle = throttle;
    if (this.spec.electric) return this._updateElectric(dt, throttle, wheelRpm, clutchEngaged);
    let rpm;
    if (!clutchEngaged) {
      // Motor livre: sobe/desce com o acelerador
      const target = this.idleRpm + throttle * (this.redline - this.idleRpm) * 0.92;
      rpm = damp(this.rpm, target, throttle > this.load ? 7 : 4, dt);
    } else {
      rpm = Math.max(this.idleRpm, Math.abs(wheelRpm));
      if (launchGear && Math.abs(wheelRpm) < this.launchRpm) {
        // Embreagem patinando: o motor sustenta um giro de largada
        const slipRpm = this.idleRpm + throttle * (this.launchRpm - this.idleRpm);
        rpm = Math.max(rpm, damp(this.rpm, slipRpm, 8, dt));
      }
    }
    // Limitador de giro
    if (rpm >= this.maxRpm) {
      this._limiterTimer = 0.08;
    }
    this._limiterTimer = Math.max(0, this._limiterTimer - dt);
    this.limiterActive = this._limiterTimer > 0;
    this.rpm = clamp(rpm, this.idleRpm * 0.8, this.maxRpm + 150);
    this.displayRpm = damp(this.displayRpm, this.rpm, 18, dt);

    const effectiveThrottle = this.limiterActive ? 0 : throttle;
    this.load = damp(this.load, effectiveThrottle, 10, dt);
    if (!clutchEngaged) return 0;
    // Em 1ª/ré abaixo da marcha lenta e sem acelerador, a embreagem fica aberta (sem "creep")
    if (launchGear && Math.abs(wheelRpm) < this.idleRpm * 1.15 && throttle < 0.02) return 0;
    const drive = this.maxTorqueAt(this.rpm) * effectiveThrottle;
    // Freio-motor só quando as rodas arrastam o motor acima da lenta
    const overrun = clamp((Math.abs(wheelRpm) - this.idleRpm) / 600, 0, 1);
    const brake = this.spec.engineBrake * (this.rpm / this.maxRpm) * (1 - effectiveThrottle) * overrun;
    return drive - brake;
  }
}
