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
    case 'solid': {
      // acabamento liso (cerakote) com variação suave de tom
      for (let k = 0; k < 60; k++) {
        g.fillStyle = c[1] ?? c[0];
        g.globalAlpha = 0.06 + rnd() * 0.08;
        g.beginPath();
        g.arc(rnd() * w, rnd() * h, (0.05 + rnd() * 0.15) * w, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
      break;
    }
    case 'woodland':
    case 'desert': {
      // manchas grandes e alongadas (floresta) ou suaves de três tons (deserto)
      const big = s.pattern === 'woodland';
      for (let layer = 1; layer < c.length; layer++)
        for (let k = 0; k < (big ? 16 : 22); k++) {
          g.fillStyle = c[layer];
          g.beginPath();
          const x = rnd() * w, y = rnd() * h, r = (big ? 0.07 + rnd() * 0.1 : 0.05 + rnd() * 0.08) * w;
          const stretch = big ? 2.2 : 1.4, rot = (rnd() - 0.5) * 0.8;
          for (let a = 0; a < Math.PI * 2; a += 0.3) {
            const rr = r * (0.6 + rnd() * 0.55);
            const px = Math.cos(a) * rr * stretch, py = Math.sin(a) * rr;
            g.lineTo(x + px * Math.cos(rot) - py * Math.sin(rot), y + px * Math.sin(rot) + py * Math.cos(rot));
          }
          g.closePath();
          g.fill();
        }
      break;
    }
    case 'digital': {
      // pixels em blocos (camuflagem digital)
      const px = Math.max(2, Math.round(w / 48));
      for (let layer = 1; layer < c.length; layer++)
        for (let k = 0; k < 34; k++) {
          g.fillStyle = c[layer];
          let x = Math.floor((rnd() * w) / px) * px, y = Math.floor((rnd() * h) / px) * px;
          for (let st = 0; st < 26; st++) {
            g.fillRect(x, y, px * (1 + Math.floor(rnd() * 2)), px);
            x += (Math.floor(rnd() * 3) - 1) * px;
            y += (Math.floor(rnd() * 3) - 1) * px;
          }
        }
      break;
    }
    case 'snow': {
      // neve: fundo claro com galhos e manchas cinza finas
      for (let layer = 1; layer < c.length; layer++)
        for (let k = 0; k < 40; k++) {
          g.strokeStyle = c[layer];
          g.lineWidth = (0.004 + rnd() * 0.01) * w;
          g.beginPath();
          let x = rnd() * w, y = rnd() * h;
          g.moveTo(x, y);
          for (let st = 0; st < 4; st++) {
            x += (rnd() - 0.3) * w * 0.08;
            y += (rnd() - 0.5) * h * 0.05;
            g.lineTo(x, y);
          }
          g.stroke();
        }
      break;
    }
    case 'tiger': {
      // faixas horizontais finas e irregulares
      for (let layer = 1; layer < c.length; layer++)
        for (let k = 0; k < 20; k++) {
          g.fillStyle = c[layer];
          const y0 = rnd() * h, len = (0.25 + rnd() * 0.5) * w, x0 = rnd() * w, th = (0.012 + rnd() * 0.025) * h;
          g.beginPath();
          for (let i = 0; i <= 12; i++) g.lineTo(x0 + (len * i) / 12, y0 + Math.sin(i * 0.9 + k) * th * 0.8 - th * Math.sin((Math.PI * i) / 12));
          for (let i = 12; i >= 0; i--) g.lineTo(x0 + (len * i) / 12, y0 + Math.sin(i * 0.9 + k) * th * 0.8 + th * Math.sin((Math.PI * i) / 12));
          g.closePath();
          g.fill();
        }
      break;
    }
    case 'hex': {
      // colmeia hexagonal com bordas claras (e brilho em skins futuristas)
      const r = w / 14, hh = r * Math.sqrt(3);
      g.lineWidth = Math.max(1, w / 220);
      for (let row = -1; row < h / hh + 2; row++)
        for (let col = -1; col < w / (r * 1.5) + 2; col++) {
          const cx = col * r * 1.5, cy = row * hh + (col % 2 ? hh / 2 : 0);
          g.beginPath();
          for (let a = 0; a < 6; a++) g.lineTo(cx + Math.cos((a * Math.PI) / 3) * r * 0.94, cy + Math.sin((a * Math.PI) / 3) * r * 0.94);
          g.closePath();
          const grd = g.createLinearGradient(cx, cy - r, cx, cy + r);
          grd.addColorStop(0, c[1]);
          grd.addColorStop(1, c[0]);
          g.fillStyle = rnd() < 0.12 ? c[2] : grd;
          g.fill();
          g.strokeStyle = c[3] ?? c[2];
          g.globalAlpha = 0.55;
          g.stroke();
          g.globalAlpha = 1;
        }
      break;
    }
    case 'circuit': {
      // trilhas de circuito em ângulos de 90/45 graus com pontos de solda
      g.fillStyle = c[1];
      for (let k = 0; k < 12; k++) g.fillRect(rnd() * w, rnd() * h, rnd() * w * 0.2, rnd() * h * 0.2);
      for (let k = 0; k < 46; k++) {
        g.strokeStyle = k % 5 === 0 ? c[3] : c[2];
        g.shadowColor = g.strokeStyle;
        g.shadowBlur = 3;
        g.lineWidth = Math.max(1, w / 260);
        let x = Math.round(rnd() * 16) * (w / 16), y = Math.round(rnd() * 16) * (h / 16);
        g.beginPath();
        g.moveTo(x, y);
        for (let st = 0; st < 4; st++) {
          const d = Math.floor(rnd() * 4), l = (0.04 + rnd() * 0.1) * w;
          if (d === 0) x += l; else if (d === 1) y += l; else if (d === 2) { x += l * 0.7; y += l * 0.7; } else { x += l * 0.7; y -= l * 0.7; }
          g.lineTo(x, y);
        }
        g.stroke();
        g.fillStyle = g.strokeStyle;
        g.beginPath();
        g.arc(x, y, w / 160, 0, Math.PI * 2);
        g.fill();
      }
      g.shadowBlur = 0;
      break;
    }
    case 'damascus': {
      // aço damasco: camadas onduladas finas (ouro/rubi sobre preto)
      const bands = 26;
      for (let i = 0; i < bands; i++) {
        g.strokeStyle = i % 3 === 0 ? c[2] : i % 3 === 1 ? c[1] : c[3] ?? c[2];
        g.lineWidth = (0.006 + (i % 4) * 0.003) * h;
        g.globalAlpha = i % 3 === 1 ? 0.9 : 0.75;
        g.beginPath();
        for (let x = 0; x <= w; x += w / 64) {
          const y = (i / bands) * h * 1.2 - h * 0.1 + Math.sin(x / w * Math.PI * 4 + i * 0.6) * h * 0.04 + Math.sin(x / w * Math.PI * 9 + i) * h * 0.015;
          g.lineTo(x, y);
        }
        g.stroke();
      }
      g.globalAlpha = 1;
      break;
    }
    case 'geometric': {
      // triângulos facetados em vermelho (teia geométrica)
      const n = 9, cw = w / n, ch = h / n;
      const jit = () => (rnd() - 0.5) * cw * 0.6;
      const pts: [number, number][][] = [];
      for (let j = 0; j <= n; j++) {
        pts.push([]);
        for (let i = 0; i <= n; i++) pts[j].push([i * cw + (i % n ? jit() : 0), j * ch + (j % n ? jit() : 0)]);
      }
      for (let j = 0; j < n; j++)
        for (let i = 0; i < n; i++) {
          const a = pts[j][i], b = pts[j][i + 1], d = pts[j + 1][i], e = pts[j + 1][i + 1];
          for (const tri of [[a, b, e], [a, e, d]]) {
            g.fillStyle = c[Math.floor(rnd() * 3)];
            g.beginPath();
            for (const p of tri) g.lineTo(p[0], p[1]);
            g.closePath();
            g.fill();
            g.strokeStyle = c[3];
            g.lineWidth = Math.max(1, w / 300);
            g.stroke();
          }
        }
      break;
    }
    case 'splatter': {
      // respingos de tinta com gotas
      for (let k = 0; k < 18; k++) {
        g.fillStyle = c[1 + (k % (c.length - 1))];
        const x = rnd() * w, y = rnd() * h, r = (0.02 + rnd() * 0.06) * w;
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fill();
        for (let d = 0; d < 9; d++) {
          const a = rnd() * Math.PI * 2, dist = r * (1.2 + rnd() * 1.8);
          g.beginPath();
          g.arc(x + Math.cos(a) * dist, y + Math.sin(a) * dist, r * (0.08 + rnd() * 0.18), 0, Math.PI * 2);
          g.fill();
        }
      }
      break;
    }
    case 'stripes': {
      // faixas de corrida largas com filetes
      g.fillStyle = c[1];
      g.fillRect(0, h * 0.36, w, h * 0.28);
      g.fillStyle = c[2];
      g.fillRect(0, h * 0.33, w, h * 0.02);
      g.fillRect(0, h * 0.65, w, h * 0.02);
      break;
    }
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

/**
 * Mapa de relevo (normal, padrão OpenGL) gerado a partir do brilho do padrão: as bordas das manchas,
 * escamas, hexágonos e trilhas ficam levemente em relevo. null quando a skin não tem relevo.
 */
export function skinNormal(skinId: string, size = 512): HTMLCanvasElement | null {
  const s = skinById(skinId);
  const k = s.relief ?? 0.3;
  if (s.pattern === 'none' || k <= 0) return null;
  const key = 'n' + skinId + size;
  const hit = cache.get(key);
  if (hit) return hit;
  const src = skinAlbedo(skinId, size).getContext('2d')!.getImageData(0, 0, size, size).data;
  const hgt = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) hgt[i] = (src[i * 4] * 0.3 + src[i * 4 + 1] * 0.59 + src[i * 4 + 2] * 0.11) / 255;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d')!;
  const out = g.createImageData(size, size);
  const strength = 2.5 * k;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const l = hgt[y * size + ((x - 1 + size) % size)], r = hgt[y * size + ((x + 1) % size)];
      const u = hgt[((y - 1 + size) % size) * size + x], d = hgt[((y + 1) % size) * size + x];
      let nx = (l - r) * strength, ny = (d - u) * strength, nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len; ny /= len; nz /= len;
      const o = (y * size + x) * 4;
      out.data[o] = (nx * 0.5 + 0.5) * 255;
      out.data[o + 1] = (ny * 0.5 + 0.5) * 255;
      out.data[o + 2] = (nz * 0.5 + 0.5) * 255;
      out.data[o + 3] = 255;
    }
  g.putImageData(out, 0, 0);
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

/**
 * Padrão qualquer (camuflagem de roupa, por exemplo) como textura que repete sem emenda:
 * desenha o padrão e monta 2×2 com cópias espelhadas.
 */
export function seamlessPattern(id: string, pattern: string, colors: string[], size = 256): HTMLCanvasElement {
  const key = 'sp' + id + size;
  const hit = cache.get(key);
  if (hit) return hit;
  const src = document.createElement('canvas');
  src.width = src.height = size;
  paint(src.getContext('2d')!, { id, name: id, folder: '', level: 1, rarity: 'comum', style: 'padrão', pattern: pattern as SkinDef['pattern'], colors, metallic: 0, roughness: 1 }, size, size);
  const cv = document.createElement('canvas');
  cv.width = cv.height = size * 2;
  const g = cv.getContext('2d')!;
  for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    g.save();
    g.translate(sx > 0 ? 0 : size * 2, sy > 0 ? 0 : size * 2);
    g.scale(sx, sy);
    g.drawImage(src, 0, 0);
    g.restore();
  }
  cache.set(key, cv);
  return cv;
}
