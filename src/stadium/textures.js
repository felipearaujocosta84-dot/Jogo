// Texturas procedurais desenhadas em <canvas>. Evitam downloads e mantêm o jogo leve.
// Podem ser substituídas por arquivos de imagem reais no futuro (ver StreetArena.loadTextureOrFallback).
import { DynamicTexture, Texture } from '../babylon.js';
import { FIELD } from '../config.js';

function rand(seed) {
  // gerador pseudoaleatório determinístico (mulberry32)
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function makeTexture(name, w, h, scene, draw, { mipmaps = true, alpha = false } = {}) {
  const tex = new DynamicTexture(name, { width: w, height: h }, scene, mipmaps, Texture.TRILINEAR_SAMPLINGMODE);
  const ctx = tex.getContext();
  draw(ctx, w, h);
  tex.hasAlpha = alpha;
  tex.update(true);
  tex.anisotropicFilteringLevel = 4;
  return tex;
}

function speckle(ctx, w, h, count, colors, rnd, maxSize = 2) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = colors[(rnd() * colors.length) | 0];
    const s = 0.5 + rnd() * maxSize;
    ctx.fillRect(rnd() * w, rnd() * h, s, s);
  }
}

/** Piso da quadra: concreto pintado + linhas de marcação. Cobre a área de jogo + os recuos dos gols. */
export function createCourtTexture(scene, size = 2048) {
  const totalLen = FIELD.length + FIELD.goalDepth * 2;
  const w = size;
  const h = Math.round(size * (FIELD.width / totalLen));
  return makeTexture('courtTex', w, h, scene, (ctx) => {
    const rnd = rand(7);
    const sx = w / totalLen;
    const sz = h / FIELD.width;
    const X = (x) => (x + totalLen / 2) * sx; // x do mundo -> pixel
    const Z = (z) => (FIELD.width / 2 - z) * sz;

    // base: resina esportiva azul-petróleo gasta
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#2c5f6e');
    g.addColorStop(0.5, '#306777');
    g.addColorStop(1, '#2a5866');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // área central levemente diferente (desgaste)
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2, w * 0.3, h * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

    // ruído de concreto
    speckle(ctx, w, h, 60000, ['rgba(0,0,0,0.10)', 'rgba(255,255,255,0.06)', 'rgba(20,40,45,0.15)'], rnd, 2.2);

    // manchas e remendos
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '255,255,255'},${0.02 + rnd() * 0.04})`;
      ctx.beginPath();
      ctx.ellipse(rnd() * w, rnd() * h, 10 + rnd() * 70, 8 + rnd() * 40, rnd() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // rachaduras
    ctx.strokeStyle = 'rgba(10,20,25,0.35)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 18; i++) {
      let x = rnd() * w, y = rnd() * h;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let k = 0; k < 8; k++) {
        x += (rnd() - 0.5) * 60;
        y += (rnd() - 0.5) * 60;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // recuos dos gols: concreto cinza
    ctx.fillStyle = '#5b6266';
    const gd = FIELD.goalDepth;
    const gw = FIELD.goalWidth;
    ctx.fillRect(0, Z(gw / 2 + 0.3), X(-FIELD.length / 2), (gw + 0.6) * sz);
    ctx.fillRect(X(FIELD.length / 2), Z(gw / 2 + 0.3), gd * sx, (gw + 0.6) * sz);
    // fora da quadra nas pontas (atrás das muretas) — fica escondido, mas pintamos escuro
    ctx.fillStyle = '#25292b';
    ctx.fillRect(0, 0, X(-FIELD.length / 2), Z(gw / 2 + 0.3));
    ctx.fillRect(0, Z(-gw / 2 - 0.3), X(-FIELD.length / 2), h);
    ctx.fillRect(X(FIELD.length / 2), 0, gd * sx, Z(gw / 2 + 0.3));
    ctx.fillRect(X(FIELD.length / 2), Z(-gw / 2 - 0.3), gd * sx, h);

    // linhas brancas (levemente gastas)
    const line = 0.08 * sx;
    ctx.strokeStyle = 'rgba(245,245,240,0.92)';
    ctx.lineWidth = line;
    const hl = FIELD.length / 2;
    const hw = FIELD.width / 2 - 0.25;
    // contorno
    ctx.strokeRect(X(-hl), Z(hw), FIELD.length * sx, hw * 2 * sz);
    // meio
    ctx.beginPath();
    ctx.moveTo(X(0), Z(hw));
    ctx.lineTo(X(0), Z(-hw));
    ctx.stroke();
    // círculo central
    ctx.beginPath();
    ctx.ellipse(X(0), Z(0), FIELD.centerCircle * sx, FIELD.centerCircle * sz, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(245,245,240,0.92)';
    ctx.beginPath();
    ctx.ellipse(X(0), Z(0), 0.15 * sx, 0.15 * sz, 0, 0, Math.PI * 2);
    ctx.fill();
    // áreas (semicírculo estilo futsal)
    for (const side of [-1, 1]) {
      ctx.beginPath();
      const cx = X(side * hl);
      const r = FIELD.goalAreaRadius;
      ctx.ellipse(cx, Z(0), r * sx, r * sz, 0, side < 0 ? -Math.PI / 2 : Math.PI / 2, side < 0 ? Math.PI / 2 : Math.PI * 1.5);
      ctx.stroke();
      // marca do pênalti
      ctx.beginPath();
      ctx.ellipse(X(side * (hl - FIELD.penaltySpot)), Z(0), 0.12 * sx, 0.12 * sz, 0, 0, Math.PI * 2);
      ctx.fill();
      // linha do gol mais grossa
      ctx.lineWidth = line * 1.3;
      ctx.beginPath();
      ctx.moveTo(cx, Z(gw / 2));
      ctx.lineTo(cx, Z(-gw / 2));
      ctx.stroke();
      ctx.lineWidth = line;
    }
    // desgaste por cima das linhas
    speckle(ctx, w, h, 20000, ['rgba(40,80,90,0.35)'], rnd, 3);

    // logo central pintado no piso
    ctx.save();
    ctx.translate(X(0), Z(0));
    ctx.scale(1, sz / sx);
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${Math.round(sx * 1.2)}px Impact, "Arial Black", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('STREET', 0, -sx * 0.55);
    ctx.fillText('FOOTBALL', 0, sx * 0.65);
    ctx.restore();
  });
}

/** Asfalto da área externa */
export function createAsphaltTexture(scene) {
  const tex = makeTexture('asphaltTex', 512, 512, scene, (ctx, w, h) => {
    const rnd = rand(3);
    ctx.fillStyle = '#2b2b2d';
    ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, 26000, ['#3a3a3c', '#1f1f20', '#454547', '#26262a'], rnd, 2);
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = `rgba(0,0,0,${0.05 + rnd() * 0.08})`;
      ctx.beginPath();
      ctx.ellipse(rnd() * w, rnd() * h, 20 + rnd() * 60, 10 + rnd() * 40, rnd() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  tex.wrapU = tex.wrapV = Texture.WRAP_ADDRESSMODE;
  return tex;
}

/** Grade de alambrado (losangos) com transparência */
export function createFenceTexture(scene) {
  const tex = makeTexture('fenceTex', 128, 128, scene, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(190,195,200,1)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(0, h / 2); ctx.lineTo(w / 2, 0); ctx.lineTo(w, h / 2); ctx.lineTo(w / 2, h); ctx.closePath();
    ctx.stroke();
  }, { alpha: true });
  tex.wrapU = tex.wrapV = Texture.WRAP_ADDRESSMODE;
  return tex;
}

/** Rede do gol (malha quadrada) */
export function createNetTexture(scene) {
  const tex = makeTexture('netTex', 64, 64, scene, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(245,245,245,1)';
    ctx.lineWidth = 6;
    ctx.strokeRect(0, 0, w, h);
  }, { alpha: true });
  tex.wrapU = tex.wrapV = Texture.WRAP_ADDRESSMODE;
  return tex;
}

/** Muretas com faixas e "patrocínios" fictícios */
export function createBoardTexture(scene) {
  const tex = makeTexture('boardTex', 1024, 128, scene, (ctx, w, h) => {
    const rnd = rand(11);
    const panels = [
      ['#f2c230', '#111', 'RUA 10'],
      ['#151515', '#f2f2f2', '3 x 3'],
      ['#e8412c', '#fff', 'QUEBRADA FC'],
      ['#f2f2f2', '#1f7ae0', 'STREET'],
      ['#1f9e5a', '#fff', 'VARZEA'],
      ['#7a2fd0', '#fff', 'GOL!']
    ];
    const pw = w / panels.length;
    panels.forEach(([bg, fg, txt], i) => {
      ctx.fillStyle = bg;
      ctx.fillRect(i * pw, 0, pw, h);
      ctx.fillStyle = fg;
      ctx.font = `900 ${h * 0.5}px Impact, "Arial Black", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(txt, i * pw + pw / 2, h / 2 + 4);
    });
    // sujeira e arranhões
    speckle(ctx, w, h, 5000, ['rgba(0,0,0,0.18)', 'rgba(255,255,255,0.08)'], rnd, 2.5);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, h - 10, w, 10);
  });
  tex.wrapU = Texture.WRAP_ADDRESSMODE;
  return tex;
}

const GRAFFITI_WORDS = ['RUA', 'GOL', 'FAVELA', 'STREET', 'BOLA', 'DRIBLE', '3X3', 'CRAQUE', 'VARZEA', 'ZL', 'QUEBRADA', 'JOGA'];
const GRAFFITI_COLORS = [
  ['#ff3d6e', '#ffd23f'], ['#3df2ff', '#7a2fd0'], ['#7cff3d', '#1f7ae0'], ['#ff9f1c', '#e71d36'],
  ['#ffffff', '#ff3d6e'], ['#f9f871', '#00c2a8'], ['#c77dff', '#3df2ff']
];

/** Muro de tijolos/concreto coberto de grafites (gerado aleatoriamente por seed) */
export function createGraffitiWallTexture(scene, seed = 1, width = 2048, height = 512) {
  return makeTexture('graffiti' + seed, width, height, scene, (ctx, w, h) => {
    const rnd = rand(seed * 97 + 13);
    // base de tijolos
    ctx.fillStyle = '#5d4a42';
    ctx.fillRect(0, 0, w, h);
    const bw = 64, bh = 24;
    for (let y = 0; y < h; y += bh) {
      const off = ((y / bh) % 2) * (bw / 2);
      for (let x = -bw; x < w + bw; x += bw) {
        const v = 70 + rnd() * 40;
        ctx.fillStyle = `rgb(${v + 30},${v * 0.75},${v * 0.6})`;
        ctx.fillRect(x + off + 2, y + 2, bw - 4, bh - 4);
      }
    }
    speckle(ctx, w, h, 12000, ['rgba(0,0,0,0.25)', 'rgba(255,255,255,0.05)'], rnd, 2);

    // camadas de grafite
    const pieces = Math.round(w / 260);
    for (let i = 0; i < pieces; i++) {
      const cx = (i + 0.2 + rnd() * 0.6) * (w / pieces);
      const cy = h * (0.4 + rnd() * 0.3);
      const [c1, c2] = GRAFFITI_COLORS[(rnd() * GRAFFITI_COLORS.length) | 0];
      const word = GRAFFITI_WORDS[(rnd() * GRAFFITI_WORDS.length) | 0];
      const size = h * (0.22 + rnd() * 0.22);

      // nuvem de fundo
      ctx.fillStyle = c2;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      for (let k = 0; k < 7; k++) {
        ctx.ellipse(cx + (rnd() - 0.5) * size * 2.2, cy + (rnd() - 0.5) * size * 0.5, size * (0.4 + rnd() * 0.4), size * (0.3 + rnd() * 0.3), 0, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((rnd() - 0.5) * 0.25);
      ctx.font = `900 ${size}px Impact, "Arial Black", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = size * 0.22;
      ctx.strokeStyle = '#111';
      ctx.strokeText(word, 0, 0);
      const grad = ctx.createLinearGradient(0, -size / 2, 0, size / 2);
      grad.addColorStop(0, c1);
      grad.addColorStop(1, c2);
      ctx.fillStyle = grad;
      ctx.fillText(word, 0, 0);
      ctx.lineWidth = size * 0.04;
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.strokeText(word, -size * 0.03, -size * 0.03);
      // escorridos de tinta
      ctx.fillStyle = c1;
      const tw = ctx.measureText(word).width;
      for (let d = 0; d < 6; d++) {
        const dx = (rnd() - 0.5) * tw;
        ctx.fillRect(dx, size * 0.3, 3, size * (0.2 + rnd() * 0.6));
      }
      ctx.restore();
    }
    // tags pequenas
    for (let i = 0; i < pieces * 3; i++) {
      ctx.save();
      ctx.translate(rnd() * w, h * (0.15 + rnd() * 0.75));
      ctx.rotate((rnd() - 0.5) * 0.5);
      ctx.font = `italic 700 ${18 + rnd() * 26}px "Comic Sans MS", cursive, sans-serif`;
      ctx.fillStyle = ['#fff', '#111', '#ff3d6e', '#3df2ff', '#ffd23f'][(rnd() * 5) | 0];
      ctx.fillText(GRAFFITI_WORDS[(rnd() * GRAFFITI_WORDS.length) | 0].toLowerCase(), 0, 0);
      ctx.restore();
    }
    // sombra no topo/base
    const sh = ctx.createLinearGradient(0, 0, 0, h);
    sh.addColorStop(0, 'rgba(0,0,0,0.35)');
    sh.addColorStop(0.15, 'rgba(0,0,0,0)');
    sh.addColorStop(0.85, 'rgba(0,0,0,0)');
    sh.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = sh;
    ctx.fillRect(0, 0, w, h);
  });
}

/** Céu noturno urbano (gradiente + brilho da cidade) */
export function createSkyTexture(scene) {
  return makeTexture('skyTex', 1024, 512, scene, (ctx, w, h) => {
    const rnd = rand(5);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#05070f');
    g.addColorStop(0.35, '#0e1630');
    g.addColorStop(0.47, '#2a2a4a');
    g.addColorStop(0.5, '#5a3a4a');
    g.addColorStop(0.53, '#1a1a22');
    g.addColorStop(1, '#0b0b0e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 300; i++) {
      ctx.fillStyle = `rgba(255,255,255,${rnd() * 0.7})`;
      ctx.fillRect(rnd() * w, rnd() * h * 0.4, 1, 1);
    }
  }, { mipmaps: false });
}

/** Janelas de prédios (emissivo) */
export function createWindowsTexture(scene) {
  const tex = makeTexture('windowsTex', 256, 256, scene, (ctx, w, h) => {
    const rnd = rand(21);
    ctx.fillStyle = '#16171c';
    ctx.fillRect(0, 0, w, h);
    for (let y = 8; y < h; y += 32) {
      for (let x = 8; x < w; x += 32) {
        const lit = rnd() < 0.35;
        ctx.fillStyle = lit ? (rnd() < 0.5 ? '#ffd98a' : '#bfe3ff') : '#0c0c10';
        ctx.globalAlpha = lit ? 0.6 + rnd() * 0.4 : 1;
        ctx.fillRect(x, y, 16, 20);
      }
    }
    ctx.globalAlpha = 1;
  });
  tex.wrapU = tex.wrapV = Texture.WRAP_ADDRESSMODE;
  return tex;
}

/**
 * Atlas de torcedores (silhuetas). Retorna { texture, cols, rows }.
 * Cada célula é uma pessoa diferente (cor de camisa, pele, cabelo, boné).
 */
export function createCrowdAtlas(scene) {
  const cols = 8, rows = 2;
  const cw = 64, ch = 128;
  const tex = makeTexture('crowdTex', cols * cw, rows * ch, scene, (ctx) => {
    const rnd = rand(42);
    const skins = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#5c3a1e', '#ffdbac'];
    const shirts = ['#e8412c', '#1f7ae0', '#f2c230', '#ffffff', '#1f9e5a', '#111111', '#7a2fd0', '#ff7b00'];
    const hairs = ['#111', '#3b2414', '#6b4423', '#d9b36c', '#222'];
    ctx.clearRect(0, 0, cols * cw, rows * ch);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const ox = c * cw, oy = r * ch;
        const shirt = shirts[(rnd() * shirts.length) | 0];
        const skin = skins[(rnd() * skins.length) | 0];
        // corpo
        ctx.fillStyle = shirt;
        ctx.beginPath();
        ctx.moveTo(ox + 10, oy + ch);
        ctx.quadraticCurveTo(ox + 8, oy + 58, ox + 32, oy + 52);
        ctx.quadraticCurveTo(ox + 56, oy + 58, ox + 54, oy + ch);
        ctx.fill();
        // braços (alguns levantados)
        ctx.strokeStyle = skin;
        ctx.lineWidth = 7;
        ctx.lineCap = 'round';
        const up = rnd() < 0.35;
        ctx.beginPath();
        if (up) {
          ctx.moveTo(ox + 14, oy + 66); ctx.lineTo(ox + 6, oy + 30);
          ctx.moveTo(ox + 50, oy + 66); ctx.lineTo(ox + 58, oy + 30);
        } else {
          ctx.moveTo(ox + 13, oy + 66); ctx.lineTo(ox + 10, oy + 100);
          ctx.moveTo(ox + 51, oy + 66); ctx.lineTo(ox + 54, oy + 100);
        }
        ctx.stroke();
        // pescoço e cabeça
        ctx.fillStyle = skin;
        ctx.fillRect(ox + 28, oy + 44, 8, 10);
        ctx.beginPath();
        ctx.ellipse(ox + 32, oy + 36, 11, 13, 0, 0, Math.PI * 2);
        ctx.fill();
        // cabelo / boné
        if (rnd() < 0.3) {
          ctx.fillStyle = shirts[(rnd() * shirts.length) | 0];
          ctx.fillRect(ox + 20, oy + 22, 24, 8);
          ctx.fillRect(ox + 32, oy + 27, 16, 4);
        } else {
          ctx.fillStyle = hairs[(rnd() * hairs.length) | 0];
          ctx.beginPath();
          ctx.ellipse(ox + 32, oy + 28, 12, 7, 0, Math.PI, Math.PI * 2);
          ctx.fill();
        }
        // sombreamento
        const sh = ctx.createLinearGradient(ox, oy + 50, ox, oy + ch);
        sh.addColorStop(0, 'rgba(0,0,0,0)');
        sh.addColorStop(1, 'rgba(0,0,0,0.45)');
        ctx.fillStyle = sh;
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillRect(ox, oy, cw, ch);
        ctx.globalCompositeOperation = 'source-over';
      }
    }
  }, { alpha: true });
  return { texture: tex, cols, rows };
}

/** Textura de bola clássica (truncated icosahedron): pentágonos pretos e costuras */
export function createBallTexture(scene) {
  return makeTexture('ballTex', 512, 256, scene, (ctx, w, h) => {
    const phi = (1 + Math.sqrt(5)) / 2;
    const pent = [];
    const hex = [];
    const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
    // vértices do icosaedro = centros dos pentágonos
    for (const a of [-1, 1]) for (const b of [-phi, phi]) {
      pent.push(norm([0, a, b]), norm([a, b, 0]), norm([b, 0, a]));
    }
    // vértices do dodecaedro = centros dos hexágonos
    for (const a of [-1, 1]) for (const b of [-1, 1]) for (const c of [-1, 1]) hex.push(norm([a, b, c]));
    for (const a of [-1, 1]) for (const b of [-1, 1]) {
      hex.push(norm([0, a / phi, b * phi]), norm([a / phi, b * phi, 0]), norm([b * phi, 0, a / phi]));
    }
    const centers = pent.map((p) => [p, 1]).concat(hex.map((p) => [p, 0]));
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      const lat = Math.PI * (y / h - 0.5);
      const cl = Math.cos(lat), sl = Math.sin(lat);
      for (let x = 0; x < w; x++) {
        const lon = (x / w) * Math.PI * 2;
        const d = [cl * Math.cos(lon), sl, cl * Math.sin(lon)];
        let b1 = -2, b2 = -2, kind = 0;
        for (const [c, k] of centers) {
          const dot = c[0] * d[0] + c[1] * d[1] + c[2] * d[2];
          if (dot > b1) { b2 = b1; b1 = dot; kind = k; } else if (dot > b2) b2 = dot;
        }
        let v = kind ? 28 : 242;
        if (b1 - b2 < 0.012) v = kind ? 60 : 150; // costura
        const i = (y * w + x) * 4;
        img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = kind ? v : v - 4; img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
}

/** Ponto suave para partículas */
export function createDotTexture(scene) {
  return makeTexture('dotTex', 64, 64, scene, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.6)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }, { alpha: true, mipmaps: false });
}

/** Brilho do refletor (halo) */
export function createGlowTexture(scene) {
  return makeTexture('glowTex', 128, 128, scene, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,250,230,1)');
    g.addColorStop(0.2, 'rgba(255,240,200,0.7)');
    g.addColorStop(1, 'rgba(255,230,180,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }, { alpha: true, mipmaps: false });
}
