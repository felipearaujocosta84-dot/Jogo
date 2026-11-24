// =============================================================
// EXTREME RACING — RacingAI
// Piloto controlado pelo computador. Usa a MESMA física do
// jogador: a IA apenas gera entradas (acelerador, freio, direção).
//  • Segue a linha de corrida pré-calculada (pure pursuit)
//  • Planeja a velocidade pela curvatura à frente e freia antes
//  • Acelera nas retas, ultrapassa e evita colisões
//  • Comete pequenos erros conforme a dificuldade
// =============================================================
import { sub, dot, clamp, damp, lerp, mulberry32, GRAVITY } from '../utils/MathUtils.js';

export const AI_DIFFICULTY = {
  easy: { label: 'Fácil', gripUse: 0.74, brakeUse: 0.62, throttleMax: 0.86, errorRate: 0.1, errorMag: 0.16, lookahead: 1.15, aggression: 0.25 },
  medium: { label: 'Médio', gripUse: 0.84, brakeUse: 0.7, throttleMax: 0.95, errorRate: 0.055, errorMag: 0.12, lookahead: 1.05, aggression: 0.5 },
  hard: { label: 'Difícil', gripUse: 0.91, brakeUse: 0.74, throttleMax: 1, errorRate: 0.03, errorMag: 0.08, lookahead: 1.0, aggression: 0.75 },
  expert: { label: 'Expert', gripUse: 0.93, brakeUse: 0.76, throttleMax: 1, errorRate: 0.012, errorMag: 0.05, lookahead: 0.95, aggression: 0.95 },
};

const AIR = 1.225;

export class RacingAI {
  /**
   * @param {TrackGeometry} track
   * @param {VehiclePhysics} physics física do carro controlado
   * @param {string} difficulty chave de AI_DIFFICULTY
   * @param {number} seed
   */
  constructor(track, physics, difficulty = 'medium', seed = 1) {
    this.track = track;
    this.physics = physics;
    this.setDifficulty(difficulty);
    this.rng = mulberry32(seed * 9973 + 17);
    // Variação individual de talento entre pilotos
    this.talent = 0.985 + this.rng() * 0.03;
    this.input = { throttle: 0, brake: 0, steer: 0, handbrake: 0 };
    this.lateralTarget = 0;
    this.passOffset = 0;
    this.passTimer = 0;
    this.error = null;
    this.stuckTimer = 0;
    this.flipTimer = 0;
    this.wantsRespawn = false;
    this.targetSpeed = 0;
    this.brakeLearn = 1;
    this._prevSpeed = null;
  }

  /** Compara a desaceleração obtida com a esperada durante frenagens fortes. */
  _learnBraking(dt, speed, expected) {
    if (this._prevSpeed != null && this.input.brake > 0.85 && speed > 15) {
      const achieved = (this._prevSpeed - speed) / dt;
      const ratio = clamp(achieved / Math.max(1, expected), 0.5, 1.3);
      this.brakeLearn = clamp(this.brakeLearn + (ratio - this.brakeLearn) * Math.min(1, dt * 0.6), 0.65, 1.05);
    }
    this._prevSpeed = speed;
  }

  setDifficulty(key) {
    this.diffKey = AI_DIFFICULTY[key] ? key : 'medium';
    this.diff = AI_DIFFICULTY[this.diffKey];
  }

  /** Velocidade máxima numa curva de curvatura k (considera downforce). */
  cornerSpeed(k) {
    const spec = this.physics.spec;
    const mu = spec.tireGrip * this.physics.gripMultiplier * this.diff.gripUse * this.talent;
    if (k < 1e-4) return 140;
    const aeroTerm = (mu * 0.5 * AIR * spec.aero.clA) / spec.mass;
    const denom = k - aeroTerm;
    if (denom <= 1e-5) return 140;
    return Math.min(140, Math.sqrt((mu * GRAVITY) / denom));
  }

  /**
   * @param {number} dt
   * @param {object} me { s, index, lateral, position }
   * @param {Array} others [{ s, lateral, speed, position }]
   * @param {boolean} racing false durante a contagem
   */
  update(dt, me, others, racing) {
    const ph = this.physics;
    const tr = this.track;
    const L = tr.length;
    const speed = Math.max(0, ph.forwardSpeed);
    const d = this.diff;
    this.wantsRespawn = false;

    // ---------- Planejamento de velocidade ----------
    const mu = ph.spec.tireGrip * ph.gripMultiplier * this.talent;
    // Inclinação: descidas aumentam a distância de frenagem
    let grade = 1;
    for (let k = 0; k <= 100; k += 20) grade = Math.min(grade, tr.sampleAt(me.index + Math.round(k / tr.spacing)).grade);
    // A desaceleração real aprendida em frenagens anteriores corrige a estimativa
    const planned = mu * GRAVITY * d.brakeUse + Math.min(4, ph.drag / ph.mass) + GRAVITY * grade * 1.2;
    this._learnBraking(dt, speed, planned);
    const decel = Math.max(3, planned * this.brakeLearn);
    const horizon = (speed * speed) / (2 * decel) + 40;
    const step = 3;
    let target = 140;
    let bind = null; // ponto de frenagem mais restritivo
    const startIdx = me.index;
    const n = Math.ceil(horizon / tr.spacing);
    for (let k = 2; k <= n; k += step) {
      const idx = tr.wrapIndex(startIdx + k);
      const vAllow = this.cornerSpeed(tr.racingCurvature[idx]);
      // margem: terminar a frenagem antes do ponto de tangência (frear em curva tira aderência lateral)
      const distAhead = Math.max(0, k * tr.spacing - 6 - speed * 0.12);
      const vReq = Math.sqrt(vAllow * vAllow + 2 * decel * distAhead);
      if (vReq < target) { target = vReq; bind = { vAllow, dist: distAhead }; }
    }
    if (this.error?.type === 'late') target *= 1.07;
    if (this.error?.type === 'early') target *= 0.9;
    this.targetSpeed = target;

    // ---------- Tráfego: ultrapassagem e prevenção de colisões ----------
    let followCap = Infinity;
    let blocker = null;
    for (const o of others) {
      let ds = o.s - me.s;
      if (ds > L / 2) ds -= L;
      if (ds < -L / 2) ds += L;
      const lat = o.lateral - me.lateral;
      if (ds > 0 && ds < 32 && Math.abs(lat) < 2.8) {
        if (!blocker || ds < blocker.ds) blocker = { ds, lat, o };
      }
      // Carro ao lado: abre um pouco de espaço lateral
      if (Math.abs(ds) < 5.5 && Math.abs(lat) < 2.4) {
        this.passOffset += (lat > 0 ? -1 : 1) * 1.5 * dt;
      }
    }
    const lim = tr.halfWidth - 1.5;
    // Em pistas estreitas, só tenta ultrapassar em trechos quase retos
    const kAhead = Math.max(tr.racingCurvature[me.index], tr.racingCurvature[tr.wrapIndex(me.index + Math.round(40 / tr.spacing))]);
    const canPass = tr.halfWidth >= 6.5 || kAhead < 0.004;
    if (blocker && canPass) {
      const closing = speed - blocker.o.speed;
      if (closing > -1 || blocker.ds < 12) {
        // Escolhe o lado com mais espaço
        const oLat = blocker.o.lateral;
        const leftRoom = oLat - -lim;
        const rightRoom = lim - oLat;
        const side = rightRoom > leftRoom ? 1 : -1;
        const want = clamp(oLat + side * 3.6, -lim, lim);
        this.passOffset = damp(this.passOffset, want - this._racingOffsetAt(me.s + 15), 1.6 + d.aggression, dt);
        this.passTimer = 1.5;
      }
    }
    if (blocker && blocker.ds < 14 && Math.abs(blocker.lat) < 2.2) {
      // Não bater por trás: limita a velocidade se não houver espaço
      followCap = blocker.o.speed + (blocker.ds - 6) * 0.6;
    }
    if (!blocker || !canPass) {
      this.passTimer -= dt;
      if (this.passTimer <= 0) this.passOffset = damp(this.passOffset, 0, 0.7, dt);
    }
    this.passOffset = clamp(this.passOffset, -lim, lim);
    target = Math.min(target, followCap);
    // Fora da linha ideal o raio real é menor: reduz a velocidade alvo
    const lineErr = Math.abs(me.lateral - (this._racingOffsetAt(me.s) + this.passOffset));
    if (lineErr > 1.5) target *= clamp(1 - (lineErr - 1.5) * 0.025, 0.85, 1);

    // ---------- Erros humanos ----------
    if (racing) this._updateErrors(dt);

    // ---------- Direção (pure pursuit) ----------
    const look = clamp(7 + speed * 0.5, 9, 48) * d.lookahead;
    const sT = me.s + look;
    const lateralTarget = clamp(this._racingOffsetAt(sT) + this.passOffset, -lim, lim);
    this.lateralTarget = lateralTarget;
    const tp = tr.pointAt(sT, lateralTarget).p;
    const st = ph.state;
    const to = sub(tp, st.pos);
    const lx = dot(to, ph.axes.right);
    const lz = Math.max(1, dot(to, ph.axes.fwd));
    const ld2 = lx * lx + lz * lz;
    const curvature = (2 * lx) / ld2;
    let steerAngle = Math.atan(ph.spec.wheelbase * curvature);
    // Limita o esterço ao que os pneus conseguem sustentar nesta velocidade
    const latCap = mu * (GRAVITY + ph.downforce / ph.mass);
    const kMax = (latCap * 1.1) / Math.max(4, speed * speed);
    const lim2 = Math.atan(ph.spec.wheelbase * kMax) + 0.1;
    steerAngle = clamp(steerAngle, -lim2, lim2);
    // Contra-esterço: alinha as rodas com a direção do movimento quando o carro escorrega
    // (somente o excesso além do ângulo de deriva normal de uma curva)
    const beta = ph.driftAngle;
    const excess = Math.sign(beta) * Math.max(0, Math.abs(beta) - 0.07);
    steerAngle += excess * 1.0;
    let steer = clamp(steerAngle / ph.maxSteerAt(ph.forwardSpeed), -1, 1);
    if (this.error?.type === 'steer') steer = clamp(steer + Math.sin(this.error.t * 9) * d.errorMag, -1, 1);

    // ---------- Acelerador e freio ----------
    let throttle = 0, brake = 0;
    const err = target - speed;
    if (err > 1.5) throttle = 1;
    else if (err > -1.2) throttle = clamp(0.35 + err * 0.4, 0, 1);
    else {
      // Frenagem antecipada: desaceleração necessária para chegar ao ponto crítico na velocidade certa
      let need = -err * 0.22;
      if (bind && bind.dist > 1) {
        const aReq = (speed * speed - bind.vAllow * bind.vAllow) / (2 * bind.dist);
        need = Math.max(need, (aReq / Math.max(1, decel)) * 1.15);
      }
      brake = clamp(need, 0.25, 1);
    }
    // Saída de curva: reduz o acelerador se estiver derrapando
    const slide = Math.abs(ph.driftAngle);
    if (slide > 0.07) throttle *= clamp(1 - (slide - 0.07) * 5, 0.15, 1);
    // Círculo de aderência: perto do limite lateral, alivia o acelerador (ou freia)
    const kHere = Math.max(tr.racingCurvature[me.index], Math.abs(curvature) * 0.6);
    const latDemand = (speed * speed * kHere) / Math.max(0.1, latCap);
    if (latDemand > 0.8) throttle *= clamp((1.05 - latDemand) / 0.25, 0.1, 1);
    // Frear forte no meio da curva desestabiliza a traseira: dosa o freio
    const lineDemand = (speed * speed * tr.racingCurvature[me.index]) / Math.max(0.1, latCap);
    if (brake > 0 && lineDemand > 0.45 && err > -4) brake *= clamp(1.2 - lineDemand, 0.3, 1);
    throttle *= d.throttleMax;
    if (this.error?.type === 'lift') throttle *= 0.55;

    if (!racing) { throttle = 0; brake = 1; steer = 0; }

    this.input.throttle = damp(this.input.throttle, throttle, 14, dt);
    this.input.brake = brake > 0 ? damp(this.input.brake, brake, 18, dt) : 0;
    this.input.steer = damp(this.input.steer, steer, 16, dt);
    this.input.handbrake = 0;

    // ---------- Recuperação ----------
    if (racing) {
      if (speed < 1.5) this.stuckTimer += dt; else this.stuckTimer = Math.max(0, this.stuckTimer - dt * 2);
      if (ph.axes.up.y < 0.3) this.flipTimer += dt; else this.flipTimer = 0;
      if (this.stuckTimer > 4 || this.flipTimer > 2 || Math.abs(me.lateral) > tr.barrierOffset + 6) {
        this.wantsRespawn = true;
        this.stuckTimer = 0;
        this.flipTimer = 0;
      }
    }
    return this.input;
  }

  _racingOffsetAt(s) {
    const tr = this.track;
    const f = tr.wrapS(s) / tr.spacing;
    const i0 = Math.floor(f) % tr.count;
    const i1 = (i0 + 1) % tr.count;
    return lerp(tr.racingOffset[i0], tr.racingOffset[i1], f - Math.floor(f));
  }

  _updateErrors(dt) {
    if (this.error) {
      this.error.t += dt;
      if (this.error.t > this.error.dur) this.error = null;
      return;
    }
    if (this.rng() < this.diff.errorRate * dt) {
      const r = this.rng();
      const type = r < 0.35 ? 'steer' : r < 0.6 ? 'late' : r < 0.8 ? 'early' : 'lift';
      this.error = { type, t: 0, dur: type === 'steer' ? 0.5 : type === 'lift' ? 0.9 : 2.5 };
    }
  }

  onRespawn() {
    this.passOffset = 0;
    this.error = null;
    this.stuckTimer = 0;
    this.input = { throttle: 0, brake: 0, steer: 0, handbrake: 0 };
  }
}
