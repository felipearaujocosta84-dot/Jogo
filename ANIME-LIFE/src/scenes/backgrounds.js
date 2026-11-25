// Cenários pintados por código (sem arquivos para baixar), no estilo de fundos de visual novel:
// formas simples + luz suave + leve desfoque (profundidade de campo), para destacar os personagens.
// Para usar uma ilustração própria, coloque public/assets/backgrounds/<chave>.webp e registre em FILES.
export const BG_W = 1600, BG_H = 900;

export const BACKGROUNDS = {
  apartamento: { label: 'Apartamento 201', draw: (c) => room(c, 'dia') },
  apartamento_noite: { label: 'Apartamento 201 — noite', draw: (c) => room(c, 'noite') },
  cafe: { label: 'Café Hoshi', draw: cafe },
  terraco_tarde: { label: 'Terraço — fim de tarde', draw: (c) => rooftop(c, 'tarde') },
  terraco_noite: { label: 'Terraço — noite', draw: (c) => rooftop(c, 'noite') },
  corredor_noite: { label: 'Corredor do prédio', draw: corridor },
};
// Arquivos de imagem opcionais que substituem a pintura procedural (chave -> caminho em assets/)
export const FILES = {};

const lg = (c, x0, y0, x1, y1, stops) => { const g = c.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, col]) => g.addColorStop(o, col)); return g; };
const rg = (c, x, y, r0, r1, stops) => { const g = c.createRadialGradient(x, y, r0, x, y, r1); stops.forEach(([o, col]) => g.addColorStop(o, col)); return g; };
const rect = (c, x, y, w, h, f) => { c.fillStyle = f; c.fillRect(x, y, w, h); };
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

function skyline(c, y0, colA, colB, lit, night) {
  seed = 11;
  for (let layer = 0; layer < 2; layer++) {
    let x = -20;
    while (x < BG_W) {
      const w = 60 + rnd() * 110, h = (layer ? 120 : 200) + rnd() * (layer ? 140 : 260);
      rect(c, x, y0 - h, w, h + 400, layer ? colB : colA);
      if (lit) for (let wy = y0 - h + 18; wy < y0 - 10; wy += 22) for (let wx = x + 10; wx < x + w - 12; wx += 18) {
        if (rnd() < (night ? 0.42 : 0.18)) rect(c, wx, wy, 8, 11, night ? `rgba(255,${200 + rnd() * 40 | 0},140,${0.55 + rnd() * 0.4})` : 'rgba(255,255,255,0.25)');
      }
      x += w + 6;
    }
  }
}

function room(c, mode) {
  const night = mode === 'noite';
  // parede
  rect(c, 0, 0, BG_W, BG_H, night ? '#3a3352' : '#f3e6da');
  for (let x = 0; x < BG_W; x += 46) rect(c, x, 0, 3, 640, night ? 'rgba(255,255,255,0.03)' : 'rgba(200,160,170,0.12)');
  // janela grande
  const wx = 470, wy = 90, ww = 660, wh = 440;
  c.save(); c.beginPath(); c.rect(wx, wy, ww, wh); c.clip();
  c.fillStyle = night ? lg(c, 0, wy, 0, wy + wh, [[0, '#141a3a'], [1, '#3c3466']]) : lg(c, 0, wy, 0, wy + wh, [[0, '#7fc4f5'], [0.7, '#cfeafc'], [1, '#fde8d4']]);
  c.fillRect(wx, wy, ww, wh);
  if (night) { seed = 3; for (let i = 0; i < 60; i++) { c.fillStyle = `rgba(255,255,255,${rnd() * 0.8})`; c.fillRect(wx + rnd() * ww, wy + rnd() * wh * 0.5, 2, 2); } c.fillStyle = '#f6f0d8'; c.beginPath(); c.arc(wx + ww - 110, wy + 80, 30, 0, 7); c.fill(); }
  else { c.fillStyle = 'rgba(255,255,255,0.9)'; [[620, 170, 60], [700, 160, 45], [960, 220, 55]].forEach(([x, y, r]) => { c.beginPath(); c.ellipse(x, y, r * 1.8, r * 0.6, 0, 0, 7); c.fill(); }); }
  skyline(c, wy + wh + 10, night ? '#232040' : '#9fb3cf', night ? '#2c2850' : '#b9c8de', true, night);
  c.restore();
  rect(c, wx - 14, wy - 14, ww + 28, 14, night ? '#2a243c' : '#e8dccd'); rect(c, wx - 14, wy + wh, ww + 28, 22, night ? '#2a243c' : '#e2d3c2');
  rect(c, wx + ww / 2 - 5, wy, 10, wh, night ? '#2a243c' : '#e8dccd'); rect(c, wx, wy + wh / 2 - 4, ww, 8, night ? '#2a243c' : '#e8dccd');
  // cortinas
  c.fillStyle = night ? '#5a3d5e' : '#f2b8c8';
  c.beginPath(); c.moveTo(wx - 90, 40); c.lineTo(wx + 40, 40); c.quadraticCurveTo(wx - 10, 320, wx + 30, 620); c.lineTo(wx - 90, 620); c.fill();
  c.beginPath(); c.moveTo(wx + ww + 90, 40); c.lineTo(wx + ww - 40, 40); c.quadraticCurveTo(wx + ww + 10, 320, wx + ww - 30, 620); c.lineTo(wx + ww + 90, 620); c.fill();
  rect(c, wx - 110, 30, ww + 220, 12, night ? '#22202e' : '#8a6a52');
  // piso de madeira em perspectiva
  c.fillStyle = night ? '#4a3a42' : '#d6a674'; c.fillRect(0, 640, BG_W, 260);
  c.strokeStyle = night ? 'rgba(0,0,0,0.25)' : 'rgba(120,70,40,0.25)'; c.lineWidth = 2;
  for (let i = -12; i <= 12; i++) { c.beginPath(); c.moveTo(BG_W / 2 + i * 40, 640); c.lineTo(BG_W / 2 + i * 190, BG_H); c.stroke(); }
  rect(c, 0, 632, BG_W, 12, night ? '#2e2533' : '#b48a68');
  // caixas da mudança
  const box = (x, y, w, h) => { rect(c, x, y, w, h, night ? '#7a5a40' : '#d7a66a'); rect(c, x, y, w, h * 0.22, night ? '#6a4c36' : '#c08f55'); rect(c, x + w / 2 - 10, y, 20, h, night ? '#8a7258' : '#ead6a8'); };
  box(60, 520, 230, 190); box(110, 360, 170, 160); box(300, 580, 160, 140); box(1240, 560, 220, 170); box(1290, 430, 150, 130);
  // mesa baixa e luminária
  rect(c, 620, 700, 360, 26, night ? '#5a4030' : '#b98a5e'); rect(c, 640, 726, 20, 70, night ? '#3e2c22' : '#8a5f3e'); rect(c, 940, 726, 20, 70, night ? '#3e2c22' : '#8a5f3e');
  rect(c, 1480, 330, 10, 330, '#3a3346'); c.fillStyle = night ? '#ffd890' : '#fff3d0'; c.beginPath(); c.moveTo(1440, 330); c.lineTo(1530, 330); c.lineTo(1510, 260); c.lineTo(1460, 260); c.fill();
  // luz
  if (night) {
    c.fillStyle = rg(c, 1485, 320, 10, 520, [[0, 'rgba(255,200,120,0.45)'], [1, 'rgba(255,200,120,0)']]); c.fillRect(0, 0, BG_W, BG_H);
    c.fillStyle = 'rgba(30,20,60,0.25)'; c.fillRect(0, 0, BG_W, BG_H);
  } else {
    c.fillStyle = lg(c, wx, wy, wx + 300, BG_H, [[0, 'rgba(255,246,210,0.35)'], [1, 'rgba(255,246,210,0)']]);
    c.beginPath(); c.moveTo(wx, wy); c.lineTo(wx + ww, wy); c.lineTo(wx + ww + 300, BG_H); c.lineTo(wx + 100, BG_H); c.fill();
  }
}

function cafe(c) {
  rect(c, 0, 0, BG_W, BG_H, '#5a3b2c');
  // parede de madeira e prateleiras de livros
  for (let x = 0; x < BG_W; x += 70) rect(c, x, 0, 66, 620, x % 140 ? '#6b4632' : '#734b36');
  seed = 5;
  const cols = ['#c0504a', '#4a6a9a', '#d8a83a', '#4a8a6a', '#8a5aa0', '#e08a5a', '#3a4a6a', '#e8dcc0'];
  for (const sy of [120, 260, 400]) {
    rect(c, 60, sy + 100, 640, 14, '#3e281c');
    let x = 70; while (x < 690) { const w = 14 + rnd() * 18, h = 60 + rnd() * 38; rect(c, x, sy + 100 - h, w, h, cols[(rnd() * cols.length) | 0]); x += w + 2; }
  }
  // lousa
  rect(c, 820, 90, 340, 240, '#2a3a32'); rect(c, 810, 80, 360, 12, '#8a5f3e'); rect(c, 810, 328, 360, 12, '#8a5f3e');
  c.fillStyle = '#f0ece0'; c.font = 'bold 44px "M PLUS Rounded 1c", sans-serif'; c.fillText('Café Hoshi ☆', 850, 150);
  c.font = '26px "M PLUS Rounded 1c", sans-serif'; ['espresso ........ 380', 'americano ...... 420', 'latte de mel .... 520', 'torta do dia ..... 450'].forEach((t, i) => c.fillText(t, 850, 200 + i * 32));
  // janela com rua ao entardecer
  c.save(); c.beginPath(); c.rect(1240, 60, 330, 520); c.clip();
  c.fillStyle = lg(c, 0, 60, 0, 580, [[0, '#f6a07a'], [0.6, '#f8c89a'], [1, '#e7b0c0']]); c.fillRect(1240, 60, 330, 520);
  skyline(c, 600, '#8a6a8a', '#a07a90', true, false); c.restore();
  rect(c, 1230, 50, 350, 12, '#3e281c'); rect(c, 1230, 578, 350, 16, '#3e281c'); rect(c, 1400, 60, 10, 520, '#3e281c');
  // luminárias pendentes
  for (const lx of [300, 700, 1100]) {
    rect(c, lx - 1, 0, 3, 110, '#222'); c.fillStyle = '#2a2a2a'; c.beginPath(); c.moveTo(lx - 46, 150); c.lineTo(lx + 46, 150); c.lineTo(lx + 18, 108); c.lineTo(lx - 18, 108); c.fill();
    c.fillStyle = rg(c, lx, 160, 4, 330, [[0, 'rgba(255,210,130,0.75)'], [0.3, 'rgba(255,190,110,0.25)'], [1, 'rgba(255,190,110,0)']]); c.fillRect(lx - 340, 0, 680, 600);
  }
  // balcão
  rect(c, 0, 640, BG_W, 260, '#4a2f22'); rect(c, 0, 620, BG_W, 30, '#9a6a46'); rect(c, 0, 616, BG_W, 6, '#c08a5e');
  for (let x = 30; x < BG_W; x += 160) rect(c, x, 670, 120, 200, 'rgba(0,0,0,0.12)');
  // máquina de espresso e xícaras
  rect(c, 180, 500, 200, 122, '#c9ccd2'); rect(c, 190, 510, 180, 30, '#9aa0aa'); rect(c, 240, 560, 20, 40, '#555'); rect(c, 300, 560, 20, 40, '#555');
  [[560, 590], [610, 594], [1360, 592]].forEach(([x, y]) => { c.fillStyle = '#fff'; c.beginPath(); c.ellipse(x, y + 14, 26, 8, 0, 0, 7); c.fill(); rect(c, x - 16, y - 16, 32, 30, '#f4f0ea'); });
  c.fillStyle = 'rgba(60,20,10,0.18)'; c.fillRect(0, 0, BG_W, BG_H);
}

function rooftop(c, mode) {
  const night = mode === 'noite';
  c.fillStyle = night ? lg(c, 0, 0, 0, 640, [[0, '#0d1030'], [0.6, '#2a2a5a'], [1, '#5a3a6a']]) : lg(c, 0, 0, 0, 640, [[0, '#4a3a7a'], [0.45, '#e07a8a'], [0.8, '#f8b070'], [1, '#ffd8a0']]);
  c.fillRect(0, 0, BG_W, BG_H);
  if (night) { seed = 9; for (let i = 0; i < 160; i++) { const a = rnd(); c.fillStyle = `rgba(255,255,255,${a * 0.9})`; c.fillRect(rnd() * BG_W, rnd() * 420, a > 0.9 ? 3 : 2, a > 0.9 ? 3 : 2); } c.fillStyle = '#ffe9b0'; c.beginPath(); c.arc(1180, 150, 5, 0, 7); c.fill(); }
  else { c.fillStyle = rg(c, 1100, 560, 10, 300, [[0, 'rgba(255,240,200,0.95)'], [0.2, 'rgba(255,200,140,0.6)'], [1, 'rgba(255,180,120,0)']]); c.fillRect(0, 0, BG_W, BG_H); }
  skyline(c, 640, night ? '#1a1838' : '#6a4a7a', night ? '#24224a' : '#8a5a80', true, night);
  // piso do terraço
  rect(c, 0, 640, BG_W, 260, night ? '#3a3448' : '#a08a90');
  c.strokeStyle = night ? 'rgba(0,0,0,0.25)' : 'rgba(80,50,60,0.2)'; c.lineWidth = 2;
  for (let i = -10; i <= 10; i++) { c.beginPath(); c.moveTo(BG_W / 2 + i * 70, 640); c.lineTo(BG_W / 2 + i * 220, BG_H); c.stroke(); }
  // grade
  rect(c, 0, 560, BG_W, 8, night ? '#1a1828' : '#4a3a4a'); rect(c, 0, 630, BG_W, 10, night ? '#1a1828' : '#4a3a4a');
  for (let x = 10; x < BG_W; x += 36) rect(c, x, 560, 5, 80, night ? '#1a1828' : '#4a3a4a');
  // vasos e plantas
  [[90, 700], [260, 740], [1420, 720]].forEach(([x, y], i) => { rect(c, x - 40, y, 80, 70, night ? '#5a4040' : '#c07a5a'); c.fillStyle = night ? '#2a4a3a' : '#4a8a5a'; for (let k = 0; k < 6; k++) { c.beginPath(); c.ellipse(x + (k - 2.5) * 14, y - 30 - (k % 2) * 20, 16, 40, (k - 2.5) * 0.3, 0, 7); c.fill(); } });
  // cordão de lâmpadas (torto)
  c.strokeStyle = '#2a2a2a'; c.lineWidth = 3; c.beginPath(); c.moveTo(-20, 120); c.quadraticCurveTo(500, 330, 900, 190); c.quadraticCurveTo(1250, 90, 1640, 260); c.stroke();
  for (const [p0, p1, p2] of [[[-20, 120], [500, 330], [900, 190]], [[900, 190], [1250, 90], [1640, 260]]]) {
    for (let t = 0.04; t < 1; t += 0.085) {
      const px = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0];
      const py = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1];
      c.fillStyle = rg(c, px, py + 14, 1, night ? 60 : 28, [[0, 'rgba(255,220,140,0.9)'], [1, 'rgba(255,220,140,0)']]); c.fillRect(px - 60, py - 46, 120, 120);
      c.fillStyle = '#fff2c0'; c.beginPath(); c.ellipse(px, py + 14, 7, 10, 0, 0, 7); c.fill();
    }
  }
  if (night) { c.fillStyle = 'rgba(20,10,50,0.15)'; c.fillRect(0, 0, BG_W, BG_H); }
}

function corridor(c) {
  rect(c, 0, 0, BG_W, BG_H, '#2c2840');
  // parede com portas em perspectiva
  c.fillStyle = lg(c, 0, 0, BG_W, 0, [[0, '#4a4262'], [0.5, '#3a3452'], [1, '#2c2840']]); c.fillRect(0, 0, BG_W, 640);
  [[120, '201'], [480, '202'], [800, '203'], [1080, '204'], [1300, '205']].forEach(([x, n], i) => {
    const s = 1 - i * 0.13, w = 220 * s, h = 470 * s, y = 640 - h;
    rect(c, x, y, w, h, '#6a4a3a'); rect(c, x + 6 * s, y + 6 * s, w - 12 * s, h - 6 * s, '#7a5844');
    c.fillStyle = '#e8d8a8'; c.beginPath(); c.arc(x + w - 24 * s, y + h * 0.55, 7 * s, 0, 7); c.fill();
    rect(c, x + w / 2 - 34 * s, y - 50 * s, 68 * s, 34 * s, '#d8d0c0'); c.fillStyle = '#3a3040'; c.font = `bold ${22 * s}px sans-serif`; c.fillText(n, x + w / 2 - 20 * s, y - 25 * s);
  });
  rect(c, 0, 640, BG_W, 260, '#4a4258'); for (let x = 0; x < BG_W; x += 80) rect(c, x, 640, 2, 260, 'rgba(0,0,0,0.2)');
  for (const lx of [300, 900, 1400]) { c.fillStyle = rg(c, lx, 40, 5, 420, [[0, 'rgba(255,230,180,0.55)'], [1, 'rgba(255,230,180,0)']]); c.fillRect(0, 0, BG_W, BG_H); rect(c, lx - 50, 20, 100, 16, '#f8f0d8'); }
}

/** Desenha o cenário num canvas com desfoque leve (profundidade de campo). */
export function paintBackground(key, w = BG_W, h = BG_H) {
  const def = BACKGROUNDS[key];
  const raw = document.createElement('canvas'); raw.width = BG_W; raw.height = BG_H;
  def.draw(raw.getContext('2d'));
  const out = document.createElement('canvas'); out.width = w; out.height = h;
  const ctx = out.getContext('2d');
  ctx.filter = w >= 800 ? 'blur(2.2px) saturate(1.05)' : 'none';
  ctx.drawImage(raw, 0, 0, w, h);
  ctx.filter = 'none';
  return out;
}

const thumbs = new Map();
/** Miniatura (galeria, publicações) como dataURL. */
export function backgroundThumb(key, w = 320) {
  const k = `${key}:${w}`;
  if (!thumbs.has(k)) thumbs.set(k, paintBackground(key, w, Math.round(w * 9 / 16)).toDataURL('image/jpeg', 0.8));
  return thumbs.get(k);
}
