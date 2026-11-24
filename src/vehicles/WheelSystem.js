// =============================================================
// EXTREME RACING — WheelSystem
// Roda individual: suspensão (mola, amortecedor, batente),
// rotação da roda, escorregamento longitudinal/lateral e
// modelo de pneu (Pacejka simplificado + elipse de atrito).
// =============================================================
import { clamp } from '../utils/MathUtils.js';

/** Força longitudinal normalizada (−1..1) para slip ratio κ. */
export function tireLongCurve(kappa, B, C) {
  return Math.sin(C * Math.atan(B * kappa));
}
/** Derivada de tireLongCurve em κ. */
export function tireLongSlope(kappa, B, C) {
  const bk = B * kappa;
  return (C * B * Math.cos(C * Math.atan(bk))) / (1 + bk * bk);
}
/** Força lateral normalizada para ângulo de deriva α (rad). */
export function tireLatCurve(alpha, B, C) {
  return Math.sin(C * Math.atan(B * alpha));
}

export class Wheel {
  /**
   * @param {object} cfg { name, x, z, front, side, driven, steer, radius, width, inertia,
   *                       suspension:{mountY, restLength, maxCompression, stiffness, bump, rebound} }
   */
  constructor(cfg) {
    this.name = cfg.name;
    this.front = cfg.front;
    this.side = cfg.side; // -1 esquerda, +1 direita
    this.driven = cfg.driven;
    this.steerable = cfg.steer;
    this.radius = cfg.radius;
    this.width = cfg.width;
    this.inertia = cfg.inertia;
    this.mount = { x: cfg.x, y: cfg.suspension.mountY, z: cfg.z };
    this.susp = cfg.suspension;

    // Estado
    this.contact = false;
    this.compression = 0;
    this.compressionVel = 0;
    this.suspensionLength = this.susp.restLength;
    this.load = 0;
    this.omega = 0; // rad/s
    this.spin = 0; // ângulo acumulado (visual)
    this.steerAngle = 0;
    this.slipRatio = 0;
    this.slipAngle = 0;
    this.slipSpeed = 0; // velocidade de deslizamento (m/s) — fumaça/áudio
    this.Fx = 0;
    this.Fy = 0;
    this.driveTorque = 0;
    this.brakeTorque = 0;
    this.surface = null;
    this.contactPoint = { x: 0, y: 0, z: 0 };
    this.contactNormal = { x: 0, y: 1, z: 0 };
    this.absActive = false;
    this.absFactor = 1;
    this.locked = false;
  }

  /** Posição local do centro da roda (para o visual). */
  localCenterY() {
    return this.mount.y - this.suspensionLength;
  }

  /** Força da suspensão (N), ao longo do eixo vertical do chassi. */
  suspensionForce() {
    if (!this.contact) return 0;
    const s = this.susp;
    let f = s.stiffness * this.compression;
    f += this.compressionVel > 0 ? s.bump * this.compressionVel : s.rebound * this.compressionVel;
    // Batente progressivo no fim do curso
    const stopStart = s.maxCompression * 0.85;
    if (this.compression > stopStart) {
      const e = this.compression - stopStart;
      f += s.stiffness * 8 * e + 60000 * e * e * 100;
    }
    return Math.max(0, f);
  }

  /**
   * Integra a rotação da roda (implícito, estável) e calcula as forças do pneu.
   * @param {number} dt
   * @param {number} vLong velocidade longitudinal no contato (m/s)
   * @param {number} vLat velocidade lateral no contato (m/s)
   * @param {object} tire {longB,longC,latB,latC}
   * @param {number} mu coeficiente de atrito efetivo (pneu × superfície × clima)
   */
  solveTire(dt, vLong, vLat, tire, mu, latScale = 1, longScale = 1) {
    const r = this.radius;
    const I = this.inertia;
    const Fz = this.load;
    const peak = mu * Fz * longScale; // pico longitudinal (cambagem reduz um pouco)
    const peakLat = mu * Fz * latScale; // pico lateral (cambagem/pressão ajustam)
    const denom = Math.max(Math.abs(vLong), 3.0);

    // --- Rotação com torque de tração (implícito linearizado) ---
    const omegaFree = vLong / r; // rotação de rolamento puro
    const kappa0 = (this.omega * r - vLong) / denom;
    const fx0 = peak * tireLongCurve(kappa0, tire.longB, tire.longC);
    const K = Math.max(0, peak * tireLongSlope(kappa0, tire.longB, tire.longC)) * (r / denom);
    const effI = I + dt * r * K;
    const omegaPre = this.omega + (dt * this.driveTorque) / effI;
    let omega = omegaPre - (dt * r * fx0) / effI;
    // O atrito do pneu nunca inverte o escorregamento dentro de um passo
    let fxClamp = null;
    if (Math.sign(omegaPre - omegaFree) !== Math.sign(omega - omegaFree) && Math.abs(omegaPre - omegaFree) > 1e-6) {
      omega = omegaFree;
      // Força média que leva a roda exatamente ao rolamento puro neste passo
      fxClamp = (this.driveTorque - (I * (omegaFree - this.omega)) / dt) / r;
    }

    // --- Freio: reduz |ω| sem inverter o sentido ---
    const brakeDelta = (this.brakeTorque * dt) / effI;
    if (Math.abs(omega) <= brakeDelta) omega = 0;
    else omega -= Math.sign(omega) * brakeDelta;
    this.locked = this.brakeTorque > 0 && omega === 0 && Math.abs(vLong) > 0.5;
    if (omega !== omegaFree) fxClamp = null;
    this.omega = omega;

    // --- Forças finais: escorregamento combinado (método da similaridade) ---
    // Normaliza o escorregamento longitudinal e lateral pelos seus picos e aplica a
    // força na direção oposta ao vetor de escorregamento: um pneu travado ou
    // patinando perde aderência lateral (permite derrapar/drift).
    const kappa = (omega * r - vLong) / denom;
    const alpha = Math.atan2(vLat, Math.max(Math.abs(vLong), 3.0));
    const kPeak = Math.tan(Math.PI / (2 * tire.longC)) / tire.longB;
    const aPeak = Math.tan(Math.PI / (2 * tire.latC)) / tire.latB;
    const kn = kappa / kPeak;
    const an = Math.tan(alpha) / aPeak;
    const rho = Math.hypot(kn, an);
    let fx = 0, fy = 0;
    if (rho > 1e-6) {
      fx = peak * tireLongCurve(rho * kPeak, tire.longB, tire.longC) * (kn / rho);
      fy = -peakLat * tireLatCurve(rho * aPeak, tire.latB, tire.latC) * (an / rho);
    }
    if (fxClamp != null) fx = clamp(fxClamp, -peak, peak);
    // Elipse de atrito: a resultante nunca passa do limite do pneu
    const m = Math.hypot(fx / Math.max(1e-6, peak), fy / Math.max(1e-6, peakLat));
    if (m > 1) { fx /= m; fy /= m; }
    this.slipRatio = clamp(kappa, -1.5, 1.5);
    this.slipAngle = alpha;
    this.slipSpeed = Math.hypot(omega * r - vLong, vLat);
    this.Fx = fx;
    this.Fy = fy;
  }

  /** Roda no ar: gira livremente (torque − freio − atrito do rolamento). */
  freeSpin(dt) {
    let omega = this.omega + (this.driveTorque / this.inertia) * dt;
    const brakeDelta = ((this.brakeTorque + 4) / this.inertia) * dt;
    if (Math.abs(omega) <= brakeDelta) omega = 0;
    else omega -= Math.sign(omega) * brakeDelta;
    this.omega = clamp(omega, -400, 400);
    this.Fx = 0;
    this.Fy = 0;
    this.load = 0;
    this.slipRatio = 0;
    this.slipAngle = 0;
    this.slipSpeed = 0;
    this.locked = false;
  }
}
