// =============================================================
// EXTREME RACING — Transmission
// Câmbio automático e manual, ré, tempo de troca e relação final.
// Marchas: -1 = ré, 0 = neutro, 1..N = marchas à frente.
// =============================================================

export class Transmission {
  constructor(spec, mode = 'auto') {
    this.ratios = spec.ratios;
    this.reverseRatio = spec.reverse;
    this.finalDrive = spec.finalDrive;
    this.shiftTime = spec.shiftTime;
    this.efficiency = spec.efficiency;
    this.mode = mode; // 'auto' | 'manual'
    this.gear = 1;
    this.shiftTimer = 0;
    this.pendingGear = null;
    this.sinceShift = 1;
    this._reverseHold = 0;
    this.onShift = null; // callback(gearAnterior, novaMarcha)
  }

  get topGear() { return this.ratios.length; }
  get isShifting() { return this.shiftTimer > 0; }

  /** Relação total (caixa x diferencial), negativa em ré. */
  get totalRatio() {
    if (this.gear === 0) return 0;
    if (this.gear < 0) return -this.reverseRatio * this.finalDrive;
    return this.ratios[this.gear - 1] * this.finalDrive;
  }

  ratioOf(gear) {
    if (gear === 0) return 0;
    if (gear < 0) return -this.reverseRatio * this.finalDrive;
    return this.ratios[gear - 1] * this.finalDrive;
  }

  _startShift(target) {
    if (target === this.gear || this.isShifting) return false;
    this.pendingGear = target;
    this.shiftTimer = target < 0 || this.gear <= 0 ? Math.max(0.3, this.shiftTime) : this.shiftTime;
    return true;
  }

  shiftUp(forwardSpeed = 0) {
    if (this.isShifting) return;
    if (this.gear < 0) { if (forwardSpeed > -1.5) this._startShift(1); return; }
    if (this.gear < this.topGear) this._startShift(this.gear + 1);
  }

  shiftDown(forwardSpeed = 0) {
    if (this.isShifting) return;
    if (this.gear > 1) this._startShift(this.gear - 1);
    else if (this.gear === 1 && forwardSpeed < 1.5) this._startShift(-1);
  }

  /**
   * @param {number} dt
   * @param {object} ctx { rpm, maxRpm, redline, throttle, brake, forwardSpeed, wheelSpeedRpmPerGear }
   */
  update(dt, ctx) {
    this.sinceShift += dt;
    if (this.isShifting) {
      this.shiftTimer -= dt;
      if (this.shiftTimer <= 0) {
        const prev = this.gear;
        this.gear = this.pendingGear;
        this.pendingGear = null;
        this.shiftTimer = 0;
        this.sinceShift = 0;
        if (this.onShift) this.onShift(prev, this.gear);
      }
      return;
    }
    if (this.mode !== 'auto') return;

    const { rpm, redline, throttle, brake, forwardSpeed, rpmPerMs } = ctx;
    // Ré automática: carro parado e freio pressionado
    if (this.gear >= 1) {
      if (forwardSpeed < 0.6 && brake > 0.5 && throttle < 0.1) {
        this._reverseHold += dt;
        if (this._reverseHold > 0.4) { this._reverseHold = 0; this._startShift(-1); return; }
      } else this._reverseHold = 0;
    } else if (this.gear < 0) {
      if (throttle > 0.1 && forwardSpeed > -1.0) { this._startShift(1); return; }
      return;
    }
    if (this.sinceShift < 0.45) return;

    const g = this.gear;
    const upRpm = redline * (0.62 + 0.34 * throttle);
    // RPM pela velocidade real do carro (evita trocar com as rodas patinando)
    const groundRpm = Math.abs(forwardSpeed) * rpmPerMs * this.ratioOf(g);
    if (g < this.topGear && rpm > upRpm && (groundRpm > upRpm * 0.88 || (rpm > redline * 0.99 && this.sinceShift > 1.2))) {
      this._startShift(g + 1);
      return;
    }
    if (g > 1) {
      // RPM que o motor teria na marcha inferior
      const lowerRpm = Math.abs(forwardSpeed) * rpmPerMs * this.ratioOf(g - 1);
      const downRpm = redline * (brake > 0.2 ? 0.5 : 0.42 + 0.12 * throttle);
      if (rpm < downRpm && lowerRpm < redline * 0.9) this._startShift(g - 1);
    }
  }
}
