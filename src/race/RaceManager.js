// =============================================================
// EXTREME RACING — RaceManager
// Regras da corrida (lógica pura): contagem regressiva, largada,
// progresso contínuo na pista, checkpoints em sequência, voltas,
// cronômetro, melhor volta, classificação, contramão e chegada.
// =============================================================

export const RACE_MODES = {
  quick: { id: 'quick', label: 'Corrida Rápida', ai: true, timed: true },
  championship: { id: 'championship', label: 'Campeonato', ai: true, timed: true },
  timetrial: { id: 'timetrial', label: 'Contra o Relógio', ai: false, timed: true },
  training: { id: 'training', label: 'Treinamento', ai: false, timed: false },
};

export class RaceManager {
  /**
   * @param {TrackGeometry} track
   * @param {object} opts { mode, laps, countdown }
   */
  constructor(track, opts = {}) {
    this.track = track;
    this.mode = RACE_MODES[opts.mode] ?? RACE_MODES.quick;
    this.totalLaps = this.mode.id === 'training' ? Infinity : opts.laps ?? 3;
    this.countdownTime = opts.countdown ?? 3;
    this.participants = [];
    this.state = 'grid'; // grid -> countdown -> racing -> finished
    this.time = 0; // tempo de corrida (s)
    this.countdown = this.countdownTime;
    this.listeners = {};
    this.finishOrder = [];
  }

  on(evt, fn) { (this.listeners[evt] ||= []).push(fn); }
  emit(evt, ...args) { for (const fn of this.listeners[evt] || []) fn(...args); }

  /**
   * @param {object} p { id, name, isPlayer, getPosition():{x,y,z}, getSpeed():number }
   */
  addParticipant(p) {
    const pos = p.getPosition();
    const proj = this.track.project(pos, -1);
    const L = this.track.length;
    // No grid (atrás da linha), o progresso começa negativo
    const startDist = proj.s > L / 2 ? proj.s - L : proj.s;
    const entry = {
      ...p,
      index: proj.index,
      s: proj.s,
      lateral: proj.lateral,
      distance: startDist,
      nextCheckpoint: 1,
      lap: 0, // voltas completas
      lapStart: 0,
      lapTimes: [],
      bestLap: Infinity,
      lastLap: null,
      finished: false,
      finishTime: null,
      position: 0,
      wrongWay: false,
      _wrongTimer: 0,
      sectorTimes: [],
    };
    this.participants.push(entry);
    this._updateRanking();
    return entry;
  }

  startCountdown() {
    this.state = 'countdown';
    this.countdown = this.countdownTime;
    this._lastCount = Math.ceil(this.countdown);
    this.emit('count', this._lastCount);
  }

  get isRacing() { return this.state === 'racing'; }
  get player() { return this.participants.find((p) => p.isPlayer); }

  /** Avança a lógica (chamar no passo fixo). */
  update(dt) {
    if (this.state === 'countdown') {
      this.countdown -= dt;
      const c = Math.ceil(this.countdown);
      if (c !== this._lastCount && c > 0) { this._lastCount = c; this.emit('count', c); }
      if (this.countdown <= 0) {
        this.state = 'racing';
        this.time = 0;
        for (const p of this.participants) p.lapStart = 0;
        this.emit('go');
      }
    } else if (this.state === 'racing') {
      this.time += dt;
    }
    this._updateProgress(dt);
    this._updateRanking();
  }

  _updateProgress(dt) {
    const tr = this.track;
    const L = tr.length;
    for (const p of this.participants) {
      const pos = p.getPosition();
      const proj = tr.project(pos, p.index);
      let delta = proj.s - p.s;
      if (delta > L / 2) delta -= L;
      if (delta < -L / 2) delta += L;
      // Limita saltos (teleporte/atalho): no máximo ~110 m/s
      const maxStep = Math.max(2, 110 * dt);
      delta = Math.max(-maxStep, Math.min(maxStep, delta));
      p.index = proj.index;
      p.s = proj.s;
      p.lateral = proj.lateral;
      if (this.state === 'grid' || this.state === 'countdown') continue;
      if (p.finished) { p.distance += delta; continue; }
      p.distance += delta;

      // Contramão
      const speed = p.getSpeed();
      if (delta < -0.01 && speed > 4) p._wrongTimer += dt; else p._wrongTimer = Math.max(0, p._wrongTimer - dt * 2);
      p.wrongWay = p._wrongTimer > 1.2;

      if (this.state !== 'racing') continue;
      // Checkpoints em sequência (o checkpoint 0 é a linha de chegada)
      const cps = tr.checkpoints;
      const lapBase = p.lap * L;
      if (p.nextCheckpoint > 0 && p.nextCheckpoint < cps.length) {
        if (p.distance >= lapBase + cps[p.nextCheckpoint]) {
          p.sectorTimes.push(this.time - p.lapStart);
          this.emit('checkpoint', p, p.nextCheckpoint);
          p.nextCheckpoint++;
        }
      }
      if (p.nextCheckpoint >= cps.length && p.distance >= lapBase + L) {
        // Volta completa
        const lapTime = this.time - p.lapStart;
        p.lap++;
        p.lapStart = this.time;
        p.nextCheckpoint = 1;
        p.lastLap = lapTime;
        p.lapTimes.push(lapTime);
        p.sectorTimes = [];
        const isBest = lapTime < p.bestLap;
        if (isBest) p.bestLap = lapTime;
        this.emit('lap', p, lapTime, isBest);
        if (p.lap >= this.totalLaps) {
          p.finished = true;
          p.finishTime = this.time;
          this.finishOrder.push(p);
          this.emit('finish', p);
          if (p.isPlayer) this._finishRace();
        }
      } else if (p.lap === 0 && p.nextCheckpoint === 1 && p.distance >= 0 && p.distance < 5 && !p._crossedStart) {
        p._crossedStart = true; // cruzou a linha saindo do grid
      }
    }
  }

  _finishRace() {
    // Estima o tempo final de quem ainda não terminou (velocidade média até aqui)
    const L = this.track.length;
    for (const p of this.participants) {
      if (p.finished) continue;
      const total = this.totalLaps * L;
      const remaining = Math.max(0, total - p.distance);
      const avg = Math.max(15, p.distance / Math.max(1, this.time));
      p.estimatedFinish = this.time + remaining / avg;
    }
    this.state = 'finished';
    this._updateRanking();
    this.emit('raceEnd', this.results());
  }

  /** Encerra manualmente (treino / desistência). */
  abort() {
    if (this.state === 'finished') return;
    this.state = 'finished';
    this.emit('raceEnd', this.results());
  }

  _updateRanking() {
    const sorted = [...this.participants].sort((a, b) => {
      const fa = a.finished ? a.finishTime : a.estimatedFinish ?? null;
      const fb = b.finished ? b.finishTime : b.estimatedFinish ?? null;
      if (this.state === 'finished' && fa != null && fb != null) return fa - fb;
      if (a.finished && !b.finished) return -1;
      if (b.finished && !a.finished) return 1;
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      return b.distance - a.distance;
    });
    sorted.forEach((p, i) => { p.position = i + 1; });
    this.ranking = sorted;
  }

  results() {
    return this.ranking.map((p) => ({
      id: p.id,
      name: p.name,
      isPlayer: p.isPlayer,
      position: p.position,
      time: p.finished ? p.finishTime : p.estimatedFinish ?? null,
      estimated: !p.finished,
      bestLap: Number.isFinite(p.bestLap) ? p.bestLap : null,
      laps: p.lap,
      lapTimes: [...p.lapTimes],
    }));
  }

  /** Atualiza progresso após respawn (mantém a distância acumulada). */
  notifyRespawn(participant) {
    const proj = this.track.project(participant.getPosition(), -1);
    participant.index = proj.index;
    participant.s = proj.s;
    participant.lateral = proj.lateral;
  }
}

/** Formata segundos como m:ss.mmm */
export function formatTime(t) {
  if (t == null || !Number.isFinite(t)) return '--:--.---';
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(3).padStart(6, '0')}`;
}
