// =============================================================
// EXTREME RACING — TrackGeometry
// Geometria pura do traçado (sem Babylon): spline fechada,
// amostragem por comprimento de arco, curvatura, projeção de
// posição na pista, linha de corrida, checkpoints e grid.
// =============================================================
import {
  v3, add, sub, scale, addScaled, normalize, length, clamp, lerp, wrapAngle, distXZ, smoothStep,
} from '../utils/MathUtils.js';

/** Catmull-Rom centrípeta em um segmento p1->p2. */
function catmullRom(p0, p1, p2, p3, t) {
  const alpha = 0.5;
  const tj = (a, b) => Math.pow(Math.max(1e-6, Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)), alpha);
  const t0 = 0;
  const t1 = t0 + tj(p0, p1);
  const t2 = t1 + tj(p1, p2);
  const t3 = t2 + tj(p2, p3);
  const tt = lerp(t1, t2, t);
  const A1 = add(scale(p0, (t1 - tt) / (t1 - t0)), scale(p1, (tt - t0) / (t1 - t0)));
  const A2 = add(scale(p1, (t2 - tt) / (t2 - t1)), scale(p2, (tt - t1) / (t2 - t1)));
  const A3 = add(scale(p2, (t3 - tt) / (t3 - t2)), scale(p3, (tt - t2) / (t3 - t2)));
  const B1 = add(scale(A1, (t2 - tt) / (t2 - t0)), scale(A2, (tt - t0) / (t2 - t0)));
  const B2 = add(scale(A2, (t3 - tt) / (t3 - t1)), scale(A3, (tt - t1) / (t3 - t1)));
  return add(scale(B1, (t2 - tt) / (t2 - t1)), scale(B2, (tt - t1) / (t2 - t1)));
}

export const SURFACE = {
  ASPHALT: { id: 'asphalt', grip: 1.0, rolling: 0.012, bumpy: 0 },
  KERB: { id: 'kerb', grip: 0.92, rolling: 0.015, bumpy: 0.6 },
  GRASS: { id: 'grass', grip: 0.58, rolling: 0.06, bumpy: 0.35 },
  GRAVEL: { id: 'gravel', grip: 0.5, rolling: 0.16, bumpy: 0.8 },
  SAND: { id: 'sand', grip: 0.55, rolling: 0.11, bumpy: 0.45 },
  DIRT: { id: 'dirt', grip: 0.62, rolling: 0.05, bumpy: 0.5 },
};

export class TrackGeometry {
  /**
   * @param {object} def definição da pista (ver GrandCircuit.js)
   */
  constructor(def) {
    this.def = def;
    this.width = def.width;
    this.halfWidth = def.width / 2;
    this.kerbWidth = def.kerbWidth ?? 1.2;
    this.runoffWidth = def.runoff?.width ?? 12;
    this.runoffSurface = SURFACE[(def.runoff?.surface ?? 'GRASS').toUpperCase()] ?? SURFACE.GRASS;
    this.barrierOffset = this.halfWidth + this.kerbWidth + this.runoffWidth; // distância do centro à barreira
    this.spacing = def.sampleSpacing ?? 2;
    this._build();
  }

  _build() {
    // Aceita [x, y, z] (com elevação) ou [x, z]
    const pts = this.def.controlPoints.map((p) => (p.length === 3 ? v3(p[0], p[1], p[2]) : v3(p[0], 0, p[1])));
    const n = pts.length;
    // Polilinha densa
    const dense = [];
    const SUB = 24;
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      for (let k = 0; k < SUB; k++) dense.push(catmullRom(p0, p1, p2, p3, k / SUB));
    }
    // Comprimento acumulado
    const cum = [0];
    for (let i = 1; i <= dense.length; i++) {
      const a = dense[i - 1], b = dense[i % dense.length];
      cum.push(cum[i - 1] + length(sub(b, a)));
    }
    this.length = cum[dense.length];
    // Reamostragem uniforme
    const count = Math.max(16, Math.round(this.length / this.spacing));
    this.spacing = this.length / count;
    const samples = [];
    let j = 0;
    for (let i = 0; i < count; i++) {
      const s = i * this.spacing;
      while (cum[j + 1] < s) j++;
      const a = dense[j], b = dense[(j + 1) % dense.length];
      const t = (s - cum[j]) / Math.max(1e-6, cum[j + 1] - cum[j]);
      samples.push({ p: v3(lerp(a.x, b.x, t), lerp(a.y, b.y, t), lerp(a.z, b.z, t)), s });
    }
    // Tangentes, normais horizontais, rumo
    for (let i = 0; i < count; i++) {
      const prev = samples[(i - 1 + count) % count].p, next = samples[(i + 1) % count].p;
      const t = normalize(sub(next, prev));
      const th = normalize(v3(t.x, 0, t.z));
      samples[i].t = t;
      samples[i].n = v3(th.z, 0, -th.x); // direita
      samples[i].heading = Math.atan2(th.x, th.z);
      samples[i].grade = t.y; // inclinação longitudinal (seno)
    }
    // Curvatura assinada (positivo = curva à direita), suavizada
    const raw = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const a = samples[(i - 2 + count) % count].heading, b = samples[(i + 2) % count].heading;
      raw[i] = wrapAngle(b - a) / (4 * this.spacing);
    }
    for (let i = 0; i < count; i++) {
      let acc = 0;
      for (let k = -3; k <= 3; k++) acc += raw[(i + k + count) % count];
      samples[i].curvature = acc / 7;
    }
    this.samples = samples;
    this.count = count;
    this._computeRacingLine();
    this._buildSpatialHash();
    // Checkpoints igualmente espaçados (o índice 0 é a linha de chegada)
    const nCp = this.def.checkpoints ?? 8;
    this.checkpoints = [];
    for (let i = 0; i < nCp; i++) this.checkpoints.push((i / nCp) * this.length);
  }

  /** Linha de corrida por relaxamento iterativo (minimiza curvatura dentro da largura). */
  _computeRacingLine() {
    const N = this.count;
    const lim = this.halfWidth - 1.6;
    const off = new Float32Array(N);
    const K = Math.max(3, Math.round(14 / this.spacing));
    const pos = (i) => {
      const s = this.samples[(i + N) % N];
      const o = off[(i + N) % N];
      return v3(s.p.x + s.n.x * o, s.p.y, s.p.z + s.n.z * o);
    };
    for (let iter = 0; iter < 160; iter++) {
      for (let i = 0; i < N; i++) {
        const a = pos(i - K), b = pos(i + K);
        const mid = v3((a.x + b.x) / 2, 0, (a.z + b.z) / 2);
        const s = this.samples[i];
        const target = (mid.x - s.p.x) * s.n.x + (mid.z - s.p.z) * s.n.z;
        off[i] = clamp(lerp(off[i], target, 0.55), -lim, lim);
      }
    }
    // Suavização final
    const sm = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      let acc = 0;
      for (let k = -4; k <= 4; k++) acc += off[(i + k + N) % N];
      sm[i] = acc / 9;
    }
    this.racingOffset = sm;
    // Curvatura da linha de corrida
    const heads = new Float32Array(N);
    const rpos = [];
    for (let i = 0; i < N; i++) {
      const s = this.samples[i];
      rpos.push(v3(s.p.x + s.n.x * sm[i], s.p.y, s.p.z + s.n.z * sm[i]));
    }
    for (let i = 0; i < N; i++) {
      const a = rpos[(i - 1 + N) % N], b = rpos[(i + 1) % N];
      heads[i] = Math.atan2(b.x - a.x, b.z - a.z);
    }
    const rk = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const a = heads[(i - 2 + N) % N], b = heads[(i + 2) % N];
      const da = distXZ(rpos[(i - 2 + N) % N], rpos[(i + 2) % N]);
      rk[i] = wrapAngle(b - a) / Math.max(0.5, da);
    }
    this.racingCurvature = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      let acc = 0;
      for (let k = -3; k <= 3; k++) acc += Math.abs(rk[(i + k + N) % N]);
      this.racingCurvature[i] = acc / 7;
    }
    this.racingPositions = rpos;
  }

  _buildSpatialHash() {
    this.cell = 40;
    this.hash = new Map();
    for (let i = 0; i < this.count; i++) {
      const p = this.samples[i].p;
      const key = `${Math.floor(p.x / this.cell)},${Math.floor(p.z / this.cell)}`;
      if (!this.hash.has(key)) this.hash.set(key, []);
      this.hash.get(key).push(i);
    }
  }

  wrapIndex(i) { return ((i % this.count) + this.count) % this.count; }
  wrapS(s) { return ((s % this.length) + this.length) % this.length; }
  sampleAt(i) { return this.samples[this.wrapIndex(i)]; }
  indexAtS(s) { return this.wrapIndex(Math.round(this.wrapS(s) / this.spacing)); }

  /** Posição interpolada no traçado com deslocamento lateral (direita +). */
  pointAt(s, lateral = 0) {
    s = this.wrapS(s);
    const f = s / this.spacing;
    const i0 = Math.floor(f) % this.count;
    const i1 = (i0 + 1) % this.count;
    const t = f - Math.floor(f);
    const a = this.samples[i0], b = this.samples[i1];
    const p = v3(lerp(a.p.x, b.p.x, t), lerp(a.p.y, b.p.y, t), lerp(a.p.z, b.p.z, t));
    const n = normalize(v3(lerp(a.n.x, b.n.x, t), 0, lerp(a.n.z, b.n.z, t)));
    const tan = normalize(v3(lerp(a.t.x, b.t.x, t), lerp(a.t.y, b.t.y, t), lerp(a.t.z, b.t.z, t)));
    return { p: addScaled(p, n, lateral), n, t: tan, heading: Math.atan2(tan.x, tan.z) };
  }

  /** Índice de amostra mais próximo (busca completa via hash espacial). */
  nearestIndex(pos) {
    const cx = Math.floor(pos.x / this.cell), cz = Math.floor(pos.z / this.cell);
    let best = -1, bestD = Infinity;
    for (let r = 0; r <= 4 && best < 0; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const list = this.hash.get(`${cx + dx},${cz + dz}`);
          if (!list) continue;
          for (const i of list) {
            const p = this.samples[i].p;
            const d = (p.x - pos.x) ** 2 + (p.z - pos.z) ** 2 + 0.25 * (p.y - pos.y) ** 2;
            if (d < bestD) { bestD = d; best = i; }
          }
        }
      }
      if (best >= 0 && r >= 1) break;
    }
    if (best < 0) {
      for (let i = 0; i < this.count; i++) {
        const p = this.samples[i].p;
        const d = (p.x - pos.x) ** 2 + (p.z - pos.z) ** 2;
        if (d < bestD) { bestD = d; best = i; }
      }
    }
    return best;
  }

  /**
   * Projeta uma posição no traçado.
   * @param {object} pos {x,y,z}
   * @param {number} hint índice anterior (-1 para busca completa)
   * @returns {{index:number, s:number, lateral:number, height:number}}
   */
  project(pos, hint = -1) {
    let idx;
    if (hint < 0) idx = this.nearestIndex(pos);
    else {
      idx = hint;
      let bestD = Infinity;
      for (let k = -25; k <= 25; k++) {
        const i = this.wrapIndex(hint + k);
        const p = this.samples[i].p;
        const d = (p.x - pos.x) ** 2 + (p.z - pos.z) ** 2 + 0.25 * (p.y - pos.y) ** 2;
        if (d < bestD) { bestD = d; idx = i; }
      }
      // Se saiu muito do trecho (teleporte/respawn), refaz a busca completa
      if (bestD > 60 * 60) idx = this.nearestIndex(pos);
    }
    const smp = this.samples[idx];
    const d = sub(pos, smp.p);
    const along = d.x * smp.t.x + d.z * smp.t.z;
    const lateral = d.x * smp.n.x + d.z * smp.n.z;
    const s = this.wrapS(smp.s + along);
    return { index: idx, s, lateral, height: smp.p.y };
  }

  /** Superfície sob um ponto a partir do deslocamento lateral. */
  surfaceAtLateral(lateral) {
    const a = Math.abs(lateral);
    if (a <= this.halfWidth) return SURFACE.ASPHALT;
    if (a <= this.halfWidth + this.kerbWidth) return SURFACE.KERB;
    return this.runoffSurface;
  }

  /** Posições de largada (grid escalonado 2 a 2 atrás da linha). */
  gridSlots(count) {
    const slots = [];
    for (let i = 0; i < count; i++) {
      const s = -(12 + i * 9);
      const lateral = (i % 2 === 0 ? -1 : 1) * Math.min(3.2, this.halfWidth - 2.2);
      const pt = this.pointAt(s, lateral);
      slots.push({ position: v3(pt.p.x, pt.p.y, pt.p.z), heading: pt.heading, s: this.wrapS(s) });
    }
    return slots;
  }

  /** Distância mínima entre trechos não adjacentes (validação de layout). */
  minSeparation(skipMeters = 140) {
    let min = Infinity, at = null;
    const skip = Math.round(skipMeters / this.spacing);
    const step = 3;
    for (let i = 0; i < this.count; i += step) {
      for (let j = i + skip; j < this.count; j += step) {
        if (this.count - (j - i) < skip) continue;
        const d = distXZ(this.samples[i].p, this.samples[j].p);
        if (d < min) { min = d; at = [i, j]; }
      }
    }
    return { min, at };
  }

  /** Raio mínimo de curva (m). */
  minRadius() {
    let k = 0;
    for (const s of this.samples) k = Math.max(k, Math.abs(s.curvature));
    return k > 0 ? 1 / k : Infinity;
  }

  /** Bounding box XZ. */
  bounds() {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const s of this.samples) {
      minX = Math.min(minX, s.p.x); maxX = Math.max(maxX, s.p.x);
      minZ = Math.min(minZ, s.p.z); maxZ = Math.max(maxZ, s.p.z);
      minY = Math.min(minY, s.p.y); maxY = Math.max(maxY, s.p.y);
    }
    return { minX, maxX, minZ, maxZ, minY, maxY };
  }

  // ---------- Trechos especiais (túneis, pontes, viadutos, desfiladeiros, cidade) ----------
  /** Lista de trechos do tipo pedido. */
  featuresOf(type) {
    return (this.def.features ?? []).filter((f) => f.type === type);
  }

  /** Trecho que contém s (m), com margem opcional. */
  featureAt(s, type, margin = 0) {
    s = this.wrapS(s);
    for (const f of this.def.features ?? []) {
      if (type && f.type !== type) continue;
      if (s >= f.from - margin && s <= f.to + margin) return f;
    }
    return null;
  }

  /**
   * Profundidade do vale sob pontes/viadutos (m) para um ponto do terreno cujo
   * ponto mais próximo da pista está em s, a uma distância d além da barreira.
   */
  valleyDepth(s, d) {
    let depth = 0;
    for (const f of this.featuresOf('bridge')) {
      if (s < f.from - 5 || s > f.to + 5) continue;
      const ramp = Math.min(smoothStep(f.from - 5, f.from + 55, s), 1 - smoothStep(f.to - 55, f.to + 5, s));
      const lateral = 1 - smoothStep(0, f.valleyWidth ?? 140, d);
      depth = Math.max(depth, (f.depth ?? 30) * ramp * lateral);
    }
    return depth;
  }

  /** Distância horizontal até o traçado (para terreno/vegetação). */
  distanceToCenter(x, z) {
    const i = this.nearestIndex(v3(x, 0, z));
    const s = this.samples[i];
    const dx = x - s.p.x, dz = z - s.p.z;
    const lateral = dx * s.n.x + dz * s.n.z;
    return { distance: Math.abs(lateral) + Math.max(0, Math.abs(dx * s.t.x + dz * s.t.z) - this.spacing), index: i, lateral };
  }
}
