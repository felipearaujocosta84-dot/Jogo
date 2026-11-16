// Padrões procedurais das skins (originais), desenhados em canvas.
// skinCanvas: textura dos modelos procedurais (desenho em u 0..0,74 + faixa branca para peças sem padrão).
// skinAlbedo: textura cheia (modelos GLB com UV próprio, quando a pasta da skin não tem albedo).
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
    case 'camo':
      // manchas orgânicas em camadas (da cor mais clara para a mais escura)
      for (let layer = 1; layer < c.length; layer++)
        for (let k = 0; k < 26; k++) {
          g.fillStyle = c[layer];
          g.beginPath();
          const x = rnd() * w, y = rnd() * h, r = (0.05 + rnd() * 0.09) * w;
          for (let a = 0; a < Math.PI * 2; a += 0.45) {
            const rr = r * (0.55 + rnd() * 0.7);
            g.lineTo(x + Math.cos(a) * rr * 1.5, y + Math.sin(a) * rr);
          }
          g.closePath();
          g.fill();
        }
      break;
    case 'carbon': {
      // trama de fibra de carbono
      const t = Math.max(4, Math.round(w / 32));
      for (let y = 0; y < h; y += t)
        for (let x = 0; x < w; x += t) {
          const flip = ((x / t + y / t) | 0) % 2 === 0;
          const grd = flip ? g.createLinearGradient(x, y, x + t, y) : g.createLinearGradient(x, y, x, y + t);
          grd.addColorStop(0, c[0]);
          grd.addColorStop(0.5, c[2]);
          grd.addColorStop(1, c[1]);
          g.fillStyle = grd;
          g.fillRect(x, y, t, t);
        }
      break;
    }
    case 'flames': {
      // labaredas subindo do fundo, com brasas
      const grd = g.createLinearGradient(0, h, 0, 0);
      grd.addColorStop(0, c[1]);
      grd.addColorStop(0.45, c[0]);
      grd.addColorStop(1, c[0]);
      g.fillStyle = grd;
      g.fillRect(0, 0, w, h);
      for (let layer = 0; layer < 3; layer++) {
        g.fillStyle = c[1 + layer];
        for (let k = 0; k < 9; k++) {
          const x = (k / 9) * w + rnd() * w * 0.08;
          const top = h * (0.25 + layer * 0.17 + rnd() * 0.2);
          const half = w * (0.05 - layer * 0.012);
          g.beginPath();
          g.moveTo(x - half, h);
          g.bezierCurveTo(x - half * 1.6, h * 0.75, x + half * 0.8, top + h * 0.15, x + (rnd() - 0.5) * half, top);
          g.bezierCurveTo(x + half * 1.4, top + h * 0.2, x + half * 1.5, h * 0.8, x + half, h);
          g.closePath();
          g.fill();
        }
      }
      for (let k = 0; k < 40; k++) {
        g.fillStyle = c[3];
        g.globalAlpha = 0.4 + rnd() * 0.6;
        g.fillRect(rnd() * w, rnd() * h * 0.7, 1 + rnd() * 2, 1 + rnd() * 2);
      }
      g.globalAlpha = 1;
      break;
    }
    case 'scales': {
      // escamas sobrepostas com degradê e borda clara
      const r = w / 12;
      for (let row = -1; row < h / (r * 0.7) + 1; row++)
        for (let col = -1; col < w / r + 1; col++) {
          const cx = col * r + (row % 2) * r * 0.5, cy = row * r * 0.7;
          const grd = g.createRadialGradient(cx, cy - r * 0.3, r * 0.1, cx, cy, r * 0.75);
          grd.addColorStop(0, c[2]);
          grd.addColorStop(0.7, c[1]);
          grd.addColorStop(1, c[0]);
          g.fillStyle = grd;
          g.beginPath();
          g.arc(cx, cy, r * 0.62, 0, Math.PI);
          g.closePath();
          g.fill();
          g.strokeStyle = c[3];
          g.globalAlpha = 0.5;
          g.lineWidth = Math.max(1, w / 256);
          g.beginPath();
          g.arc(cx, cy, r * 0.62, 0.15, Math.PI - 0.15);
          g.stroke();
          g.globalAlpha = 1;
        }
      break;
    }
    case 'ice': {
      // placas escuras com rachaduras de gelo brilhantes
      for (let k = 0; k < 18; k++) {
        g.fillStyle = rnd() < 0.5 ? c[0] : c[1];
        g.beginPath();
        const x = rnd() * w, y = rnd() * h;
        for (let a = 0; a < 6; a++) g.lineTo(x + Math.cos(a + rnd()) * w * 0.12, y + Math.sin(a + rnd()) * h * 0.12);
        g.closePath();
        g.fill();
      }
      g.strokeStyle = c[2];
      g.shadowColor = c[2];
      g.shadowBlur = 4;
      for (let k = 0; k < 22; k++) {
        g.lineWidth = 0.6 + rnd() * 1.4;
        let x = rnd() * w, y = rnd() * h;
        g.beginPath();
        g.moveTo(x, y);
        for (let s2 = 0; s2 < 5; s2++) {
          x += (rnd() - 0.5) * w * 0.18;
          y += (rnd() - 0.5) * h * 0.18;
          g.lineTo(x, y);
        }
        g.stroke();
      }
      g.shadowBlur = 0;
      break;
    }
    case 'brushed': {
      // metal escovado com reflexo diagonal
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

/** Textura dos modelos procedurais: padrão + faixa branca à direita. */
export function skinCanvas(skinId: string, size = 256): HTMLCanvasElement {
  const key = 'c' + skinId + size;
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

/** Textura cheia do padrão (modelos GLB). */
export function skinAlbedo(skinId: string, size = 512): HTMLCanvasElement {
  const key = 'a' + skinId + size;
  const hit = cache.get(key);
  if (hit) return hit;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d')!;
  const s = skinById(skinId);
  if (s.pattern === 'none') {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, size, size);
  } else paint(g, s, size, size);
  cache.set(key, cv);
  return cv;
}

/** Amostra quadrada para a interface. */
export function skinSwatch(skinId: string, size = 64): HTMLCanvasElement {
  const key = 'sw' + skinId + size;
  const hit = cache.get(key);
  if (hit) return hit;
  const s = skinById(skinId);
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d')!;
  if (s.pattern === 'none') {
    const grd = g.createLinearGradient(0, 0, size, size);
    grd.addColorStop(0, '#3a3d42');
    grd.addColorStop(1, '#1d1f22');
    g.fillStyle = grd;
    g.fillRect(0, 0, size, size);
  } else paint(g, s, size, size);
  cache.set(key, cv);
  return cv;
}
