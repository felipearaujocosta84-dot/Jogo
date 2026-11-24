// =============================================================
// EXTREME RACING — ReplaySystem
// Gravação da corrida inteira (todos os carros, 30 quadros/s) e
// leitura interpolada para o replay. Lógica pura (sem Babylon):
// a reprodução visual fica em ReplayPlayer.js.
//
// Quadro por carro (20 floats):
//   0-2 posição | 3-6 quaternion | 7 esterço | 8-11 altura das rodas
//   12-15 giro das rodas | 16 freio | 17 rpm | 18 km/h | 19 acelerador
// =============================================================

export const REPLAY_HZ = 30;
export const FRAME_FLOATS = 20;
const CHUNK_FRAMES = 1800; // 1 minuto por bloco

export class ReplayRecorder {
  /**
   * @param {number} carCount
   * @param {number} maxSeconds limite de memória (padrão 15 min)
   */
  constructor(carCount, maxSeconds = 900) {
    this.cars = carCount;
    this.stride = carCount * FRAME_FLOATS;
    this.maxFrames = maxSeconds * REPLAY_HZ;
    this.chunks = [];
    this.frames = 0;
    this._acc = 0;
    this.events = []; // { t, text } (largada, voltas, chegada)
  }

  get duration() { return Math.max(0, (this.frames - 1) / REPLAY_HZ); }

  /**
   * Chamado a cada passo fixo; grava um quadro a cada 1/30 s.
   * @param {number} dt
   * @param {function(carIndex, Float32Array, offset)} writeCar preenche os 20 floats
   */
  step(dt, writeCar) {
    this._acc += dt;
    if (this.frames > 0 && this._acc < 1 / REPLAY_HZ - 1e-6) return;
    this._acc = this.frames > 0 ? this._acc - 1 / REPLAY_HZ : 0;
    if (this.frames >= this.maxFrames) return;
    const ci = Math.floor(this.frames / CHUNK_FRAMES);
    if (!this.chunks[ci]) this.chunks[ci] = new Float32Array(CHUNK_FRAMES * this.stride);
    const base = (this.frames % CHUNK_FRAMES) * this.stride;
    for (let c = 0; c < this.cars; c++) writeCar(c, this.chunks[ci], base + c * FRAME_FLOATS);
    this.frames++;
  }

  mark(text) {
    this.events.push({ t: this.duration, text });
  }

  _frameView(f) {
    const ci = Math.floor(f / CHUNK_FRAMES);
    return { arr: this.chunks[ci], base: (f % CHUNK_FRAMES) * this.stride };
  }

  /**
   * Estado interpolado de um carro no tempo t (s).
   * @returns {Float32Array} 20 floats
   */
  sample(car, t, out = new Float32Array(FRAME_FLOATS)) {
    if (this.frames === 0) return out;
    const f = Math.max(0, Math.min(this.frames - 1, t * REPLAY_HZ));
    const f0 = Math.floor(f), f1 = Math.min(this.frames - 1, f0 + 1);
    const u = f - f0;
    const a = this._frameView(f0), b = this._frameView(f1);
    const oa = a.base + car * FRAME_FLOATS, ob = b.base + car * FRAME_FLOATS;
    for (let k = 0; k < FRAME_FLOATS; k++) out[k] = a.arr[oa + k] + (b.arr[ob + k] - a.arr[oa + k]) * u;
    // Quaternion: escolhe o hemisfério mais próximo e normaliza (nlerp)
    let dotq = 0;
    for (let k = 3; k < 7; k++) dotq += a.arr[oa + k] * b.arr[ob + k];
    if (dotq < 0) for (let k = 3; k < 7; k++) out[k] = a.arr[oa + k] - (b.arr[ob + k] + a.arr[oa + k]) * u;
    const l = Math.hypot(out[3], out[4], out[5], out[6]) || 1;
    for (let k = 3; k < 7; k++) out[k] /= l;
    return out;
  }

  /** Memória aproximada usada (MB). */
  get sizeMB() { return (this.chunks.length * CHUNK_FRAMES * this.stride * 4) / 1048576; }
}
