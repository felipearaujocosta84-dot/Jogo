// =============================================================
// EXTREME RACING — MathUtils
// Matemática pura (sem Babylon) usada pela física, pistas e IA.
// Vetores são objetos simples {x, y, z}; quaternions {x, y, z, w}.
// Convenção: Y para cima, Z para frente, X para a direita.
// =============================================================

export const GRAVITY = 9.81;
export const DEG = Math.PI / 180;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const sign = (v) => (v < 0 ? -1 : 1);
export const smoothStep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
/** Aproximação exponencial independente de FPS. */
export const damp = (current, target, lambda, dt) => lerp(current, target, 1 - Math.exp(-lambda * dt));
export const moveTowards = (cur, target, maxDelta) =>
  Math.abs(target - cur) <= maxDelta ? target : cur + sign(target - cur) * maxDelta;
export const wrapAngle = (a) => {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
};

// ---------- Vetores ----------
export const v3 = (x = 0, y = 0, z = 0) => ({ x, y, z });
export const copy = (a) => ({ x: a.x, y: a.y, z: a.z });
export const set = (o, x, y, z) => { o.x = x; o.y = y; o.z = z; return o; };
export const add = (a, b) => v3(a.x + b.x, a.y + b.y, a.z + b.z);
export const sub = (a, b) => v3(a.x - b.x, a.y - b.y, a.z - b.z);
export const scale = (a, s) => v3(a.x * s, a.y * s, a.z * s);
export const addScaled = (a, b, s) => v3(a.x + b.x * s, a.y + b.y * s, a.z + b.z * s);
export const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (a, b) => v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
export const length = (a) => Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
export const lengthSq = (a) => a.x * a.x + a.y * a.y + a.z * a.z;
export const dist = (a, b) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
export const distXZ = (a, b) => Math.sqrt((a.x - b.x) ** 2 + (a.z - b.z) ** 2);
export const normalize = (a) => {
  const l = length(a);
  return l > 1e-9 ? v3(a.x / l, a.y / l, a.z / l) : v3(0, 0, 0);
};
export const lerpV = (a, b, t) => v3(lerp(a.x, b.x, t), lerp(a.y, b.y, t), lerp(a.z, b.z, t));
/** Remove a componente de v ao longo de n (n normalizado). */
export const projectOnPlane = (v, n) => addScaled(v, n, -dot(v, n));

// ---------- Quaternions ----------
export const quat = (x = 0, y = 0, z = 0, w = 1) => ({ x, y, z, w });
export function quatMul(a, b) {
  return quat(
    a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z
  );
}
export function quatNormalize(q) {
  const l = Math.hypot(q.x, q.y, q.z, q.w) || 1;
  return quat(q.x / l, q.y / l, q.z / l, q.w / l);
}
export const quatConj = (q) => quat(-q.x, -q.y, -q.z, q.w);
export function quatFromAxisAngle(axis, angle) {
  const s = Math.sin(angle / 2);
  return quat(axis.x * s, axis.y * s, axis.z * s, Math.cos(angle / 2));
}
/** Rotação em torno de Y; yaw = atan2(dir.x, dir.z). */
export const quatFromYaw = (yaw) => quat(0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2));
/** Rotaciona vetor v pelo quaternion q. */
export function rotate(v, q) {
  const tx = 2 * (q.y * v.z - q.z * v.y);
  const ty = 2 * (q.z * v.x - q.x * v.z);
  const tz = 2 * (q.x * v.y - q.y * v.x);
  return v3(
    v.x + q.w * tx + (q.y * tz - q.z * ty),
    v.y + q.w * ty + (q.z * tx - q.x * tz),
    v.z + q.w * tz + (q.x * ty - q.y * tx)
  );
}
/** Quaternion que orienta +Z para "forward" e +Y próximo de "up". */
export function quatLookRotation(forward, up = v3(0, 1, 0)) {
  const f = normalize(forward);
  let r = normalize(cross(up, f));
  if (lengthSq(r) < 1e-6) r = v3(1, 0, 0);
  const u = cross(f, r);
  // matriz com colunas r,u,f -> quaternion
  const m00 = r.x, m01 = u.x, m02 = f.x;
  const m10 = r.y, m11 = u.y, m12 = f.y;
  const m20 = r.z, m21 = u.z, m22 = f.z;
  const tr = m00 + m11 + m22;
  let q;
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2;
    q = quat((m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s, 0.25 * s);
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    q = quat(0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s);
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    q = quat((m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s);
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
    q = quat((m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s);
  }
  return quatNormalize(q);
}

// ---------- Aleatório determinístico e ruído ----------
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(ix, iz, seed) {
  let h = (ix * 374761393 + iz * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
/** Value noise 2D suave em [0,1]. */
export function valueNoise(x, z, seed = 1) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz, seed), b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed), d = hash2(ix + 1, iz + 1, seed);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uz);
}
/** Ruído fractal (fBm) em [0,1]. */
export function fbm(x, z, octaves = 4, seed = 1) {
  let amp = 0.5, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise(x * freq, z * freq, seed + i * 17) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum / norm;
}

/** Interpolação linear em tabela [[x, y], ...] ordenada por x. */
export function interpTable(table, x) {
  if (x <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    if (x <= table[i][0]) {
      const [x0, y0] = table[i - 1];
      const [x1, y1] = table[i];
      return lerp(y0, y1, (x - x0) / (x1 - x0));
    }
  }
  return table[table.length - 1][1];
}
