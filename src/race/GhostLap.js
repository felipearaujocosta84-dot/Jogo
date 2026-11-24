// =============================================================
// EXTREME RACING — GhostLap
// Volta "fantasma": grava posição e rotação do jogador durante uma
// volta (15 quadros/s), compacta em Int16 + base64 para salvar no
// aparelho e reproduz interpolando pelo tempo da volta. Lógica pura.
// =============================================================

export const GHOST_HZ = 15;
const POS_SCALE = 20; // 5 cm de resolução horizontal
const Y_SCALE = 100; // 1 cm de resolução vertical

export class GhostLap {
  constructor(origin = { x: 0, z: 0 }) {
    this.origin = { x: origin.x, z: origin.z };
    this.frames = []; // [x, y, z, qx, qy, qz, qw]
    this.time = null; // tempo da volta (s)
    this._acc = 0;
  }

  get duration() { return Math.max(0, (this.frames.length - 1) / GHOST_HZ); }

  reset() { this.frames = []; this._acc = 0; this.time = null; }

  /** Grava (chamar a cada passo fixo durante a volta). */
  record(dt, pos, q) {
    this._acc += dt;
    if (this.frames.length > 0 && this._acc < 1 / GHOST_HZ - 1e-6) return;
    this._acc = this.frames.length > 0 ? this._acc - 1 / GHOST_HZ : 0;
    if (this.frames.length > GHOST_HZ * 600) return; // máx. 10 min
    this.frames.push([pos.x, pos.y, pos.z, q.x, q.y, q.z, q.w]);
  }

  /** Posição/rotação interpoladas no tempo t da volta (null se acabou). */
  sample(t) {
    const n = this.frames.length;
    if (n < 2 || t < 0 || t > this.duration) return null;
    const f = t * GHOST_HZ;
    const i = Math.min(n - 2, Math.floor(f));
    const u = f - i;
    const a = this.frames[i], b = this.frames[i + 1];
    const lerp = (k) => a[k] + (b[k] - a[k]) * u;
    let d = 0;
    for (let k = 3; k < 7; k++) d += a[k] * b[k];
    const s = d < 0 ? -1 : 1;
    const q = [3, 4, 5, 6].map((k) => a[k] + (s * b[k] - a[k]) * u);
    const l = Math.hypot(...q) || 1;
    return { x: lerp(0), y: lerp(1), z: lerp(2), qx: q[0] / l, qy: q[1] / l, qz: q[2] / l, qw: q[3] / l };
  }

  /** Compacta para texto (localStorage). */
  encode() {
    const n = this.frames.length;
    const buf = new Int16Array(n * 7);
    const clamp16 = (v) => Math.max(-32767, Math.min(32767, Math.round(v)));
    this.frames.forEach((fr, i) => {
      const o = i * 7;
      buf[o] = clamp16((fr[0] - this.origin.x) * POS_SCALE);
      buf[o + 1] = clamp16(fr[1] * Y_SCALE);
      buf[o + 2] = clamp16((fr[2] - this.origin.z) * POS_SCALE);
      for (let k = 3; k < 7; k++) buf[o + k] = clamp16(fr[k] * 32767);
    });
    const bytes = new Uint8Array(buf.buffer);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return { v: 1, time: this.time, ox: this.origin.x, oz: this.origin.z, data: btoa(bin) };
  }

  static decode(obj) {
    const g = new GhostLap({ x: obj.ox, z: obj.oz });
    g.time = obj.time;
    const bin = atob(obj.data);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const buf = new Int16Array(bytes.buffer);
    for (let o = 0; o + 6 < buf.length; o += 7) {
      g.frames.push([
        buf[o] / POS_SCALE + obj.ox, buf[o + 1] / Y_SCALE, buf[o + 2] / POS_SCALE + obj.oz,
        buf[o + 3] / 32767, buf[o + 4] / 32767, buf[o + 5] / 32767, buf[o + 6] / 32767,
      ]);
    }
    return g;
  }
}
