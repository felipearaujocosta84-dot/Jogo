// Lip sync a partir do texto (sem áudio): cada letra vira uma forma de boca (visema).
// O português tem vogais claras, que casam com os visemas padrão do VRM: aa, ee, ih, oh, ou.
// Consoantes bilabiais (m, b, p) fecham a boca; espaço e pontuação fazem pausas.

const MAP = { a: 'aa', 'á': 'aa', 'à': 'aa', 'â': 'aa', 'ã': 'aa', e: 'ee', 'é': 'ee', 'ê': 'ee', i: 'ih', 'í': 'ih', y: 'ih',
  o: 'oh', 'ó': 'oh', 'ô': 'oh', 'õ': 'oh', u: 'ou', 'ú': 'ou', w: 'ou' };
const CLOSED = new Set(['m', 'b', 'p']);
export const VISEMES = ['aa', 'ee', 'ih', 'oh', 'ou'];

/** Converte o texto em quadros { t (ms desde o início), v (visema|null), w (abertura 0..1) }. */
export function buildTimeline(text, msPerChar = 45) {
  const out = [];
  let t = 0;
  for (const ch of String(text).toLowerCase()) {
    if (MAP[ch]) out.push({ t, v: MAP[ch], w: ch === 'a' || ch === 'ã' ? 1 : 0.8 });
    else if (CLOSED.has(ch)) out.push({ t, v: null, w: 0 });
    else if (/[.,!?;:…]/.test(ch)) { out.push({ t, v: null, w: 0 }); t += msPerChar * 3; continue; }
    else if (ch === ' ') out.push({ t, v: null, w: 0.1 });
    t += msPerChar;
  }
  out.push({ t, v: null, w: 0 });
  return { frames: out, duration: t };
}

/** Amostra a linha do tempo: devolve { aa, ee, ih, oh, ou } suavizados para o instante t. */
export function sample(timeline, t) {
  const f = timeline.frames;
  const res = { aa: 0, ee: 0, ih: 0, oh: 0, ou: 0 };
  if (!f.length || t >= timeline.duration) return res;
  let i = 0;
  while (i < f.length - 1 && f[i + 1].t <= t) i++;
  const a = f[i], b = f[i + 1] || a;
  const span = Math.max(1, b.t - a.t);
  const k = Math.min(1, (t - a.t) / span);
  // a boca abre rápido e fecha suave (curva em sino em cada letra)
  const open = Math.sin(Math.PI * Math.min(1, k * 1.15));
  if (a.v) res[a.v] = Math.max(res[a.v], a.w * (0.55 + 0.45 * open));
  if (b.v && k > 0.6) res[b.v] = Math.max(res[b.v], b.w * (k - 0.6) * 1.6);
  return res;
}
