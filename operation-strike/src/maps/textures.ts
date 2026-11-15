// Texturas procedurais desenhadas em canvas: nenhum download de imagem,
// identidade visual própria e tamanho ajustado ao nível de qualidade.
import { DynamicTexture, Texture, type Scene } from '../core/babylon';

type Painter = (g: CanvasRenderingContext2D, s: number, rnd: () => number) => void;

function rng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function noise(g: CanvasRenderingContext2D, s: number, rnd: () => number, count: number, alpha: number, light: boolean, size = 2): void {
  for (let i = 0; i < count; i++) {
    const v = light ? 255 : 0;
    g.fillStyle = `rgba(${v},${v},${v},${alpha * rnd()})`;
    const w = 1 + rnd() * size;
    g.fillRect(rnd() * s, rnd() * s, w, w);
  }
}

function stains(g: CanvasRenderingContext2D, s: number, rnd: () => number, count: number, color: string, maxR: number): void {
  for (let i = 0; i < count; i++) {
    const x = rnd() * s, y = rnd() * s, r = (0.2 + rnd() * 0.8) * maxR;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, color);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    // desenha também as cópias nas bordas para a textura repetir sem emenda
    for (const ox of [-s, 0, s]) for (const oy of [-s, 0, s]) {
      g.save();
      g.translate(ox, oy);
      g.fillRect(x - r, y - r, r * 2, r * 2);
      g.restore();
    }
  }
}

const PAINTERS: Record<string, Painter> = {
  sand(g, s, rnd) {
    g.fillStyle = '#c9a774';
    g.fillRect(0, 0, s, s);
    stains(g, s, rnd, 14, 'rgba(150,110,62,0.35)', s * 0.25);
    stains(g, s, rnd, 10, 'rgba(235,205,150,0.35)', s * 0.2);
    noise(g, s, rnd, s * 22, 0.25, false, 2);
    noise(g, s, rnd, s * 14, 0.25, true, 2);
    // pedrinhas
    for (let i = 0; i < s / 6; i++) {
      g.fillStyle = `rgba(${90 + rnd() * 60},${70 + rnd() * 40},${45 + rnd() * 30},0.8)`;
      g.beginPath();
      g.arc(rnd() * s, rnd() * s, 1 + rnd() * 2.5, 0, Math.PI * 2);
      g.fill();
    }
  },
  sandstone(g, s, rnd) {
    // blocos de arenito
    g.fillStyle = '#c4a072';
    g.fillRect(0, 0, s, s);
    const rows = 6, rh = s / rows;
    for (let r = 0; r < rows; r++) {
      const cols = 3;
      const cw = s / cols;
      const off = (r % 2) * cw * 0.5;
      for (let c = -1; c <= cols; c++) {
        const x = c * cw + off;
        const shade = 0.85 + rnd() * 0.25;
        g.fillStyle = `rgb(${196 * shade},${160 * shade},${114 * shade})`;
        g.fillRect(x + 2, r * rh + 2, cw - 4, rh - 4);
      }
      g.fillStyle = 'rgba(80,58,36,0.55)';
      g.fillRect(0, r * rh, s, 2);
    }
    for (let r = 0; r < rows; r++) {
      const cw = s / 3, off = (r % 2) * cw * 0.5;
      g.fillStyle = 'rgba(80,58,36,0.5)';
      for (let c = 0; c <= 3; c++) g.fillRect(((c * cw + off) % s + s) % s - 1, r * rh, 2, rh);
    }
    stains(g, s, rnd, 8, 'rgba(110,80,50,0.25)', s * 0.2);
    noise(g, s, rnd, s * 16, 0.22, false);
    noise(g, s, rnd, s * 8, 0.2, true);
  },
  plaster(g, s, rnd) {
    g.fillStyle = '#d9c39b';
    g.fillRect(0, 0, s, s);
    stains(g, s, rnd, 12, 'rgba(160,120,80,0.28)', s * 0.3);
    stains(g, s, rnd, 6, 'rgba(255,240,210,0.3)', s * 0.25);
    // reboco descascado mostrando tijolos
    for (let i = 0; i < 3; i++) {
      const x = rnd() * s * 0.8, y = rnd() * s * 0.8, w = s * (0.08 + rnd() * 0.12), h = s * (0.05 + rnd() * 0.08);
      g.fillStyle = '#a8724c';
      g.fillRect(x, y, w, h);
      g.fillStyle = 'rgba(70,40,25,0.6)';
      for (let yy = y; yy < y + h; yy += 6) g.fillRect(x, yy, w, 1);
      g.strokeStyle = 'rgba(120,95,70,0.8)';
      g.strokeRect(x, y, w, h);
    }
    // escorridos de sujeira
    for (let i = 0; i < 10; i++) {
      const x = rnd() * s;
      const grd = g.createLinearGradient(0, 0, 0, s);
      grd.addColorStop(0, 'rgba(90,70,50,0.25)');
      grd.addColorStop(1, 'rgba(90,70,50,0)');
      g.fillStyle = grd;
      g.fillRect(x, 0, 2 + rnd() * 4, s * (0.3 + rnd() * 0.6));
    }
    noise(g, s, rnd, s * 18, 0.18, false);
  },
  concrete(g, s, rnd) {
    g.fillStyle = '#8f8a82';
    g.fillRect(0, 0, s, s);
    stains(g, s, rnd, 14, 'rgba(60,58,55,0.25)', s * 0.25);
    noise(g, s, rnd, s * 26, 0.22, false);
    noise(g, s, rnd, s * 16, 0.18, true);
    g.fillStyle = 'rgba(50,48,45,0.6)';
    g.fillRect(0, 0, s, 2);
    g.fillRect(0, 0, 2, s);
    // rachaduras
    g.strokeStyle = 'rgba(40,38,36,0.6)';
    for (let i = 0; i < 3; i++) {
      let x = rnd() * s, y = rnd() * s;
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 6; k++) {
        x += (rnd() - 0.5) * s * 0.12;
        y += (rnd() - 0.5) * s * 0.12;
        g.lineTo(x, y);
      }
      g.stroke();
    }
  },
  crate(g, s, rnd) {
    g.fillStyle = '#8a6236';
    g.fillRect(0, 0, s, s);
    const planks = 5, ph = s / planks;
    for (let i = 0; i < planks; i++) {
      const shade = 0.85 + rnd() * 0.25;
      g.fillStyle = `rgb(${150 * shade},${108 * shade},${62 * shade})`;
      g.fillRect(0, i * ph + 1, s, ph - 2);
      g.strokeStyle = 'rgba(70,45,20,0.35)';
      for (let k = 0; k < 6; k++) {
        g.beginPath();
        const y = i * ph + rnd() * ph;
        g.moveTo(0, y);
        g.bezierCurveTo(s * 0.3, y + (rnd() - 0.5) * 6, s * 0.6, y + (rnd() - 0.5) * 6, s, y);
        g.stroke();
      }
    }
    // moldura e travessa diagonal
    const b = s * 0.09;
    g.fillStyle = '#6b4724';
    g.fillRect(0, 0, s, b);
    g.fillRect(0, s - b, s, b);
    g.fillRect(0, 0, b, s);
    g.fillRect(s - b, 0, b, s);
    g.save();
    g.translate(s / 2, s / 2);
    g.rotate(Math.PI / 4);
    g.fillRect(-s * 0.72, -b / 2, s * 1.44, b);
    g.restore();
    g.fillStyle = 'rgba(30,20,10,0.7)';
    for (const [x, y] of [[b / 2, b / 2], [s - b / 2, b / 2], [b / 2, s - b / 2], [s - b / 2, s - b / 2]]) {
      g.beginPath();
      g.arc(x, y, s * 0.012, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = 'rgba(20,20,20,0.55)';
    g.font = `bold ${s * 0.09}px monospace`;
    g.fillText('OS-7', s * 0.62, s * 0.3);
    noise(g, s, rnd, s * 8, 0.15, false);
  },
  metal(g, s, rnd) {
    g.fillStyle = '#5d6a70';
    g.fillRect(0, 0, s, s);
    // chapas corrugadas
    for (let x = 0; x < s; x += s / 16) {
      const grd = g.createLinearGradient(x, 0, x + s / 16, 0);
      grd.addColorStop(0, 'rgba(255,255,255,0.12)');
      grd.addColorStop(0.5, 'rgba(0,0,0,0.18)');
      grd.addColorStop(1, 'rgba(255,255,255,0.12)');
      g.fillStyle = grd;
      g.fillRect(x, 0, s / 16, s);
    }
    stains(g, s, rnd, 10, 'rgba(140,70,30,0.35)', s * 0.18);
    noise(g, s, rnd, s * 10, 0.2, false);
  },
  container(g, s, rnd) {
    g.fillStyle = '#7d2f22';
    g.fillRect(0, 0, s, s);
    for (let x = 0; x < s; x += s / 12) {
      g.fillStyle = 'rgba(0,0,0,0.22)';
      g.fillRect(x, 0, s / 48, s);
      g.fillStyle = 'rgba(255,255,255,0.08)';
      g.fillRect(x + s / 24, 0, s / 48, s);
    }
    stains(g, s, rnd, 10, 'rgba(60,30,15,0.4)', s * 0.2);
    noise(g, s, rnd, s * 10, 0.2, false);
  },
  roof(g, s, rnd) {
    g.fillStyle = '#5a5047';
    g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += s / 8) {
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(0, y, s, 3);
    }
    noise(g, s, rnd, s * 14, 0.25, false);
  },
  trim(g, s, rnd) {
    g.fillStyle = '#9d7b55';
    g.fillRect(0, 0, s, s);
    g.fillStyle = 'rgba(255,240,210,0.25)';
    g.fillRect(0, 0, s, s * 0.1);
    g.fillStyle = 'rgba(40,25,10,0.35)';
    g.fillRect(0, s * 0.9, s, s * 0.1);
    noise(g, s, rnd, s * 12, 0.2, false);
  },
  tile(g, s, rnd) {
    // piso de lajotas dos pontos de bomba
    const n = 4, t = s / n;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const shade = 0.82 + rnd() * 0.22;
        g.fillStyle = `rgb(${170 * shade},${150 * shade},${122 * shade})`;
        g.fillRect(i * t, j * t, t, t);
      }
    g.fillStyle = 'rgba(70,55,40,0.7)';
    for (let i = 0; i <= n; i++) {
      g.fillRect(i * t - 1, 0, 2, s);
      g.fillRect(0, i * t - 1, s, 2);
    }
    stains(g, s, rnd, 8, 'rgba(110,85,55,0.3)', s * 0.2);
    noise(g, s, rnd, s * 14, 0.18, false);
  },
  door(g, s, rnd) {
    g.fillStyle = '#3f5a4c';
    g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += s / 10) {
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.fillRect(0, y, s, 2);
      g.fillStyle = 'rgba(255,255,255,0.07)';
      g.fillRect(0, y + 2, s, 2);
    }
    stains(g, s, rnd, 12, 'rgba(120,70,35,0.45)', s * 0.15);
    noise(g, s, rnd, s * 12, 0.2, false);
  },
  brick(g, s, rnd) {
    g.fillStyle = '#5a3a2c';
    g.fillRect(0, 0, s, s);
    const rows = 12, rh = s / rows, bw = s / 4;
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * bw / 2;
      for (let c = -1; c <= 4; c++) {
        const sh = 0.75 + rnd() * 0.35;
        g.fillStyle = `rgb(${150 * sh},${70 * sh},${50 * sh})`;
        g.fillRect(c * bw + off + 1.5, r * rh + 1.5, bw - 3, rh - 3);
      }
    }
    stains(g, s, rnd, 8, 'rgba(30,25,20,0.3)', s * 0.2);
    noise(g, s, rnd, s * 14, 0.2, false);
  },
  asphalt(g, s, rnd) {
    g.fillStyle = '#3b3c3e';
    g.fillRect(0, 0, s, s);
    noise(g, s, rnd, s * 40, 0.3, true, 1.5);
    noise(g, s, rnd, s * 30, 0.3, false, 2);
    stains(g, s, rnd, 10, 'rgba(15,15,15,0.35)', s * 0.25);
    g.fillStyle = 'rgba(230,200,60,0.75)';
    g.fillRect(s * 0.48, 0, s * 0.04, s * 0.45);
  },
  glass(g, s, rnd) {
    const grd = g.createLinearGradient(0, 0, s, s);
    grd.addColorStop(0, '#2a4a66');
    grd.addColorStop(0.5, '#6d93b3');
    grd.addColorStop(1, '#1d3550');
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
    g.fillStyle = '#9aa3aa';
    for (let i = 0; i <= 4; i++) {
      g.fillRect(i * (s / 4) - 3, 0, 6, s);
      g.fillRect(0, i * (s / 4) - 3, s, 6);
    }
    g.fillStyle = 'rgba(255,255,255,0.12)';
    for (let i = 0; i < 6; i++) g.fillRect(rnd() * s, 0, 10 + rnd() * 30, s);
  },
  carpet(g, s, rnd) {
    g.fillStyle = '#4b5560';
    g.fillRect(0, 0, s, s);
    noise(g, s, rnd, s * 50, 0.18, true, 1);
    noise(g, s, rnd, s * 50, 0.2, false, 1);
    g.strokeStyle = 'rgba(0,0,0,0.25)';
    g.strokeRect(0, 0, s, s);
  },
  steel(g, s, rnd) {
    g.fillStyle = '#7d858c';
    g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 2) {
      g.fillStyle = `rgba(255,255,255,${rnd() * 0.06})`;
      g.fillRect(0, y, s, 1);
    }
    g.fillStyle = 'rgba(40,40,40,0.5)';
    for (const [x, y] of [[8, 8], [s - 8, 8], [8, s - 8], [s - 8, s - 8]]) {
      g.beginPath();
      g.arc(x, y, 3, 0, Math.PI * 2);
      g.fill();
    }
    stains(g, s, rnd, 5, 'rgba(120,70,30,0.2)', s * 0.15);
  },
  grass(g, s, rnd) {
    g.fillStyle = '#5c7a3a';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < s * 30; i++) {
      g.fillStyle = `rgba(${60 + rnd() * 60},${90 + rnd() * 70},${30 + rnd() * 30},0.7)`;
      g.fillRect(rnd() * s, rnd() * s, 1, 2 + rnd() * 3);
    }
  },
  dark(g, s, rnd) {
    g.fillStyle = '#26221e';
    g.fillRect(0, 0, s, s);
    noise(g, s, rnd, s * 10, 0.2, true);
  }
};

export type TextureName = keyof typeof PAINTERS;

const cache = new Map<string, DynamicTexture>();

export function getTexture(scene: Scene, name: TextureName, size: number): DynamicTexture {
  const key = name + size;
  const found = cache.get(key);
  if (found && found.getInternalTexture()) return found;
  const tex = new DynamicTexture('tex_' + name, { width: size, height: size }, scene, true);
  const g = tex.getContext() as unknown as CanvasRenderingContext2D;
  PAINTERS[name](g, size, rng(name.length * 7919 + size));
  tex.update(true);
  tex.wrapU = Texture.WRAP_ADDRESSMODE;
  tex.wrapV = Texture.WRAP_ADDRESSMODE;
  tex.anisotropicFilteringLevel = 4;
  cache.set(key, tex);
  return tex;
}

/** Textura com texto/pintura única (letras dos pontos de bomba, placas). */
export function paintedTexture(scene: Scene, name: string, size: number, paint: (g: CanvasRenderingContext2D, s: number) => void): DynamicTexture {
  const tex = new DynamicTexture(name, { width: size, height: size }, scene, true);
  tex.hasAlpha = true;
  const g = tex.getContext() as unknown as CanvasRenderingContext2D;
  g.clearRect(0, 0, size, size);
  paint(g, size);
  tex.update(true);
  return tex;
}

export function clearTextureCache(): void {
  for (const t of cache.values()) t.dispose();
  cache.clear();
}
