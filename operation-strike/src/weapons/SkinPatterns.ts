// Desenha o padrão de cada skin num canvas. Área do desenho: u 0..0,74; faixa branca à direita
// (peças sem padrão usam essa faixa e ficam com a própria cor).
import { skinById, type SkinDef } from './Skins';

function rng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function paint(g: CanvasRenderingContext2D, s: SkinDef, w: number, h: number): void {
  const c = s.colors;
  const rnd = rng(s.id.length * 977 + s.id.charCodeAt(0));
  g.fillStyle = c[0];
  g.fillRect(0, 0, w, h);
  switch (s.pattern) {
    case 'digital': {
      const px = Math.max(4, Math.round(w / 28));
      for (let k = 0; k < 900; k++) {
        g.fillStyle = c[1 + Math.floor(rnd() * (c.length - 1))];
        const x = Math.floor((rnd() * w) / px) * px, y = Math.floor((rnd() * h) / px) * px;
        g.fillRect(x, y, px * (1 + Math.floor(rnd() * 3)), px * (1 + Math.floor(rnd() * 2)));
      }
      break;
    }
    case 'camo':
      for (let k = 0; k < 70; k++) {
        g.fillStyle = c[1 + Math.floor(rnd() * (c.length - 1))];
        g.beginPath();
        const x = rnd() * w, y = rnd() * h, r = (0.04 + rnd() * 0.09) * w;
        for (let a = 0; a < Math.PI * 2; a += 0.5) {
          const rr = r * (0.6 + rnd() * 0.6);
          g.lineTo(x + Math.cos(a) * rr * 1.4, y + Math.sin(a) * rr);
        }
        g.closePath();
        g.fill();
      }
      break;
    case 'carbon': {
      const t = Math.max(4, Math.round(w / 32));
      for (let y = 0; y < h; y += t)
        for (let x = 0; x < w; x += t) {
          const grd = g.createLinearGradient(x, y, x + t, y + t);
          const flip = ((x / t + y / t) | 0) % 2 === 0;
          grd.addColorStop(0, flip ? c[1] : c[0]);
          grd.addColorStop(0.5, c[2]);
          grd.addColorStop(1, flip ? c[0] : c[1]);
          g.fillStyle = grd;
          g.fillRect(x, y, t, t);
        }
      break;
    }
    case 'tiger':
      g.fillStyle = c[2];
      for (let k = 0; k < 30; k++) g.fillRect(rnd() * w, rnd() * h, w * 0.2, 2);
      g.fillStyle = c[1];
      for (let k = 0; k < 16; k++) {
        const x = rnd() * w;
        g.beginPath();
        g.moveTo(x, 0);
        g.bezierCurveTo(x + w * 0.08, h * 0.3, x - w * 0.06, h * 0.6, x + w * 0.04 * (rnd() - 0.5), h);
        g.lineTo(x + w * 0.035, h);
        g.bezierCurveTo(x - w * 0.03, h * 0.6, x + w * 0.11, h * 0.3, x + w * 0.03, 0);
        g.closePath();
        g.fill();
      }
      break;
    case 'hex': {
      const r = w / 14;
      g.strokeStyle = c[1];
      g.lineWidth = Math.max(1.5, w / 160);
      g.shadowColor = c[1];
      g.shadowBlur = 6;
      for (let row = -1; row < h / (r * 1.5) + 1; row++)
        for (let col = -1; col < w / (r * 1.73) + 1; col++) {
          const cx = col * r * 1.73 + (row % 2) * r * 0.866, cy = row * r * 1.5;
          g.beginPath();
          for (let k = 0; k < 6; k++) g.lineTo(cx + Math.cos(k * Math.PI / 3 + Math.PI / 6) * r, cy + Math.sin(k * Math.PI / 3 + Math.PI / 6) * r);
          g.closePath();
          if (rnd() < 0.18) {
            g.fillStyle = c[2];
            g.fill();
          }
          g.stroke();
        }
      g.shadowBlur = 0;
      break;
    }
    case 'waves':
      for (let k = 0; k < 14; k++) {
        g.strokeStyle = k % 3 === 0 ? c[2] : c[1];
        g.lineWidth = w * (0.015 + rnd() * 0.04);
        g.beginPath();
        const y0 = (k / 14) * h;
        for (let x = 0; x <= w; x += 4) g.lineTo(x, y0 + Math.sin(x / (w * 0.08) + k) * h * 0.05);
        g.stroke();
      }
      break;
    case 'splatter':
      for (let k = 0; k < 60; k++) {
        g.fillStyle = c[1 + Math.floor(rnd() * (c.length - 1))];
        const x = rnd() * w, y = rnd() * h, r = (0.01 + rnd() * 0.05) * w;
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fill();
        for (let d = 0; d < 5; d++) {
          g.beginPath();
          g.arc(x + (rnd() - 0.5) * r * 4, y + (rnd() - 0.5) * r * 4, r * 0.25 * rnd(), 0, Math.PI * 2);
          g.fill();
        }
      }
      break;
    case 'brushed': {
      const grd = g.createLinearGradient(0, 0, w, h);
      grd.addColorStop(0, c[0]);
      grd.addColorStop(0.45, c[1]);
      grd.addColorStop(0.55, c[1]);
      grd.addColorStop(1, c[2]);
      g.fillStyle = grd;
      g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 2) {
        g.fillStyle = `rgba(255,255,255,${rnd() * 0.12})`;
        g.fillRect(0, y, w, 1);
      }
      break;
    }
  }
}

const cache = new Map<string, HTMLCanvasElement>();

/** Canvas da textura (padrão + faixa branca). */
export function skinCanvas(skinId: string, size = 256): HTMLCanvasElement {
  const key = skinId + size;
  const hit = cache.get(key);
  if (hit) return hit;
  const s = skinById(skinId);
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, size, size);
  const w = Math.floor(size * 0.75);
  g.save();
  g.beginPath();
  g.rect(0, 0, w, size);
  g.clip();
  if (s.pattern !== 'none') paint(g, s, w, size);
  g.restore();
  cache.set(key, cv);
  return cv;
}

/** Só o desenho (para miniaturas e amostras na interface). */
export function skinSwatch(skinId: string, size = 64): HTMLCanvasElement {
  const key = 'sw' + skinId + size;
  const hit = cache.get(key);
  if (hit) return hit;
  const s = skinById(skinId);
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d')!;
  if (s.pattern === 'none') {
    g.fillStyle = '#2b2d30';
    g.fillRect(0, 0, size, size);
  } else paint(g, s, size, size);
  cache.set(key, cv);
  return cv;
}
