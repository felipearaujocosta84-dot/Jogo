// Arte procedural dos móveis e objetos (canvas 2D → textura Phaser).
// Sem arquivos para baixar: cada objeto é desenhado uma vez ao entrar na cena.
// Origem dos sprites: centro-base (0.5, 1). Unidades lógicas; RES define a nitidez.
export const RES = 2;

const R = (ctx, x, y, w, h, r, fill, stroke) => {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
};
const E = (ctx, x, y, rx, ry, fill) => { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); };
const LG = (ctx, x0, y0, x1, y1, stops) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; };
const OUT = '#3a2d3f';

export const ART = {
  bed: [64, 124, (c) => {
    R(c, 2, 4, 60, 118, 6, '#8a5a3c', OUT); // estrutura
    R(c, 2, 4, 60, 18, 6, LG(c, 0, 4, 0, 22, [[0, '#a46d48'], [1, '#7a4c30']]), OUT); // cabeceira
    R(c, 6, 20, 52, 98, 4, '#f6f2ec');
    R(c, 10, 24, 44, 18, 8, '#ffffff', '#d8d2e0'); // travesseiro
    R(c, 14, 28, 36, 6, 3, '#efeaf3');
    R(c, 5, 46, 54, 74, 5, LG(c, 0, 46, 0, 120, [[0, '#9fb8e8'], [1, '#7d95cf']]), OUT); // edredom
    c.fillStyle = '#b8cbf0'; c.fillRect(5, 46, 54, 8);
    c.globalAlpha = 0.25; c.fillStyle = '#ffffff';
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) E(c, 14 + j * 18, 66 + i * 14, 2, 2, '#fff');
    c.globalAlpha = 1;
    R(c, 30, 86, 22, 10, 4, '#f3c9d6', OUT); // pelúcia/almofada
  }],
  nightstand: [30, 46, (c) => {
    R(c, 3, 18, 24, 27, 3, '#a8764e', OUT); R(c, 3, 18, 24, 7, 3, '#bf8a5e');
    R(c, 7, 30, 16, 5, 2, '#8a5a3c'); E(c, 15, 32.5, 1.5, 1.2, '#e7d08a');
    R(c, 12, 12, 6, 8, 2, '#6d6a78'); // abajur
    c.beginPath(); c.moveTo(8, 12); c.lineTo(22, 12); c.lineTo(19, 2); c.lineTo(11, 2); c.closePath(); c.fillStyle = '#ffe9b8'; c.fill(); c.strokeStyle = OUT; c.stroke();
  }],
  desk: [88, 64, (c) => {
    R(c, 2, 30, 84, 32, 3, '#9b6a46', OUT);
    R(c, 2, 30, 84, 10, 3, '#c28d60');
    R(c, 6, 42, 18, 18, 2, '#86593a'); R(c, 64, 42, 18, 18, 2, '#86593a');
    R(c, 28, 4, 34, 24, 3, '#2d2a36', OUT); // monitor
    R(c, 30.5, 6.5, 29, 19, 2, LG(c, 0, 6, 0, 26, [[0, '#7fd0ff'], [1, '#6a7ef0']]));
    c.fillStyle = 'rgba(255,255,255,0.7)'; c.fillRect(33, 9, 12, 2); c.fillRect(33, 13, 18, 1.5); c.fillRect(33, 16, 9, 1.5);
    R(c, 42, 27, 6, 5, 1, '#2d2a36');
    R(c, 30, 33, 28, 5, 1.5, '#e8e6ef', OUT); // teclado
    R(c, 62, 33, 6, 6, 3, '#e8e6ef', OUT); // mouse
    R(c, 8, 18, 12, 14, 2, '#e9e2d2', OUT); c.fillStyle = '#6fbf8a'; c.fillRect(10, 20, 8, 5); // porta-retrato
    E(c, 76, 30, 5, 3, '#f2efe8'); R(c, 72, 20, 8, 10, 2, '#ffffff', OUT); // caneca
  }],
  chair: [26, 36, (c) => {
    R(c, 3, 2, 20, 18, 5, '#5a5f7a', OUT); R(c, 5, 4, 16, 6, 3, '#6d7394');
    R(c, 4, 18, 18, 8, 3, '#4a4e66', OUT);
    c.fillStyle = '#2d2a36'; c.fillRect(12, 26, 2, 6); R(c, 5, 31, 16, 3, 1.5, '#2d2a36');
  }],
  window: [76, 50, (c) => {
    R(c, 2, 2, 72, 46, 3, '#f4eee6', OUT);
    R(c, 6, 6, 64, 38, 2, LG(c, 0, 6, 0, 44, [[0, '#8fd0ff'], [0.7, '#cfeaff'], [1, '#fde9d6']]));
    E(c, 22, 20, 8, 3, 'rgba(255,255,255,0.85)'); E(c, 30, 18, 6, 3, 'rgba(255,255,255,0.85)'); E(c, 54, 28, 7, 2.5, 'rgba(255,255,255,0.7)');
    c.fillStyle = '#d9cfc2'; c.fillRect(37, 6, 2, 38); c.fillRect(6, 24, 64, 2);
    // cortinas
    c.fillStyle = '#f0b6c8'; c.beginPath(); c.moveTo(2, 0); c.lineTo(16, 0); c.quadraticCurveTo(10, 26, 14, 50); c.lineTo(2, 50); c.fill();
    c.beginPath(); c.moveTo(74, 0); c.lineTo(60, 0); c.quadraticCurveTo(66, 26, 62, 50); c.lineTo(74, 50); c.fill();
    c.fillStyle = 'rgba(0,0,0,0.08)'; c.fillRect(6, 3, 2, 46); c.fillRect(68, 3, 2, 46);
  }],
  wardrobe: [38, 86, (c) => {
    R(c, 2, 2, 34, 82, 3, '#c79a6c', OUT);
    R(c, 2, 2, 34, 8, 3, '#d8ad80');
    c.strokeStyle = '#8a5f3e'; c.lineWidth = 1; c.beginPath(); c.moveTo(19, 12); c.lineTo(19, 80); c.stroke();
    E(c, 16, 46, 1.4, 3, '#efd59a'); E(c, 22, 46, 1.4, 3, '#efd59a');
    R(c, 5, 14, 11, 30, 2, null, '#b3875c'); R(c, 22, 14, 11, 30, 2, null, '#b3875c');
  }],
  boxes: [62, 52, (c) => {
    const box = (x, y, w, h) => { R(c, x, y, w, h, 2, '#d7a66a', OUT); c.fillStyle = '#c08f55'; c.fillRect(x, y, w, h * 0.28); c.fillStyle = '#e9d6a8'; c.fillRect(x + w / 2 - 3, y, 6, h); };
    box(3, 22, 34, 28); box(30, 26, 28, 24); box(10, 4, 26, 20);
    c.fillStyle = '#5a4a3a'; c.font = 'bold 5px sans-serif'; c.fillText('LIVROS', 12, 42);
  }],
  boxes2: [62, 50, (c) => {
    const box = (x, y, w, h) => { R(c, x, y, w, h, 2, '#d7a66a', OUT); c.fillStyle = '#c08f55'; c.fillRect(x, y, w, h * 0.28); c.fillStyle = '#e9d6a8'; c.fillRect(x + w / 2 - 3, y, 6, h); };
    box(2, 20, 30, 28); box(28, 16, 32, 32); box(30, 0, 24, 18);
    c.fillStyle = '#c0392b'; c.font = 'bold 5px sans-serif'; c.fillText('FRÁGIL', 34, 36);
  }],
  tv: [112, 78, (c) => {
    R(c, 4, 52, 104, 24, 3, '#6b4b3c', OUT); R(c, 4, 52, 104, 7, 3, '#8a6450');
    R(c, 10, 62, 28, 10, 2, '#4f382c'); R(c, 74, 62, 28, 10, 2, '#4f382c'); R(c, 42, 62, 28, 10, 2, '#4f382c');
    R(c, 16, 2, 80, 46, 3, '#22202a', OUT);
    R(c, 19, 5, 74, 40, 2, LG(c, 0, 5, 74, 45, [[0, '#2b3a6e'], [0.5, '#5a4aa0'], [1, '#e07aa8']]));
    c.fillStyle = 'rgba(255,255,255,0.12)'; c.beginPath(); c.moveTo(19, 5); c.lineTo(55, 5); c.lineTo(35, 45); c.lineTo(19, 45); c.fill();
    R(c, 50, 47, 12, 6, 1, '#22202a');
    R(c, 84, 40, 10, 14, 2, '#7bc8a4', OUT); E(c, 89, 38, 6, 5, '#5aa880'); // vaso
  }],
  sofa: [122, 56, (c) => {
    R(c, 2, 14, 118, 40, 10, '#e88a6a', OUT); // base
    R(c, 2, 4, 118, 22, 10, LG(c, 0, 4, 0, 26, [[0, '#f6a487'], [1, '#e07e5e']]), OUT); // encosto (visto de trás)
    R(c, 0, 12, 16, 40, 7, '#d8735a', OUT); R(c, 106, 12, 16, 40, 7, '#d8735a', OUT);
    c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(60, 6, 1.5, 18);
    R(c, 22, 0, 18, 12, 5, '#fbe0a0', OUT); // almofada aparecendo
  }],
  lowtable: [76, 34, (c) => {
    R(c, 2, 6, 72, 22, 4, '#c79a6c', OUT); R(c, 2, 6, 72, 6, 4, '#ddb184');
    c.fillStyle = '#8a5f3e'; c.fillRect(6, 27, 4, 6); c.fillRect(66, 27, 4, 6);
    R(c, 14, 8, 8, 7, 2, '#ffffff', OUT); R(c, 50, 10, 16, 3, 1, '#6a7ef0'); R(c, 52, 7, 13, 3, 1, '#f0b6c8');
  }],
  bookshelf: [60, 90, (c) => {
    R(c, 2, 2, 56, 86, 3, '#9b6a46', OUT);
    const cols = ['#e0707a', '#7aa0e0', '#f2c45a', '#7ac89a', '#b08ad8', '#f09a6a', '#5a6a8a'];
    for (let s = 0; s < 4; s++) {
      const y = 6 + s * 20; R(c, 5, y, 50, 18, 1, '#6f4a30');
      let x = 7; let i = s * 3;
      while (x < 50) { const w = 3 + ((i * 7) % 4); const h = 12 + ((i * 5) % 5); R(c, x, y + 18 - h, w, h, 0.6, cols[i % cols.length]); x += w + 0.6; i++; }
    }
  }],
  plant: [30, 56, (c) => {
    R(c, 7, 36, 16, 18, 3, '#e6e0d6', OUT); c.fillStyle = '#cfc6b6'; c.fillRect(7, 36, 16, 4);
    const leaf = (x, y, r, a, col) => { c.save(); c.translate(x, y); c.rotate(a); E(c, 0, -r, r * 0.45, r, col); c.restore(); };
    [[-0.9, 14], [-0.4, 18], [0.1, 20], [0.6, 17], [1.0, 13], [-0.15, 12], [0.35, 12]].forEach(([a, r], i) => leaf(15, 36, r, a, i % 2 ? '#4fa070' : '#62b884'));
  }],
  counter: [200, 66, (c) => {
    R(c, 2, 26, 196, 38, 3, '#f1ece4', OUT); // armários
    for (let i = 0; i < 6; i++) { R(c, 6 + i * 32, 36, 28, 24, 2, '#e6dfd3', '#cfc6b6'); R(c, 18 + i * 32, 40, 6, 1.6, 1, '#9a917f'); }
    R(c, 0, 18, 200, 12, 3, LG(c, 0, 18, 0, 30, [[0, '#a8b0bc'], [1, '#8a94a2']]), OUT); // tampo
    R(c, 26, 19, 36, 9, 3, '#c9d2de', OUT); R(c, 40, 8, 4, 12, 2, '#9aa4b2'); // pia e torneira
    R(c, 120, 19, 44, 9, 2, '#2d2a36'); E(c, 132, 23.5, 6, 3, '#4a4656'); E(c, 152, 23.5, 6, 3, '#4a4656'); // fogão
    R(c, 128, 12, 14, 10, 3, '#e05a4a', OUT); // panela
    R(c, 174, 8, 16, 14, 2, '#d0a46a', OUT); // tábua/pão
  }],
  fridge: [48, 92, (c) => {
    R(c, 2, 2, 44, 88, 5, LG(c, 0, 0, 48, 0, [[0, '#f7f9fb'], [1, '#d5dbe3']]), OUT);
    c.strokeStyle = '#b4bcc8'; c.beginPath(); c.moveTo(3, 32); c.lineTo(45, 32); c.stroke();
    R(c, 36, 12, 3, 14, 1.5, '#9aa4b2'); R(c, 36, 40, 3, 20, 1.5, '#9aa4b2');
    R(c, 9, 10, 8, 8, 1, '#f2c45a'); R(c, 18, 14, 6, 6, 3, '#e0707a'); R(c, 10, 42, 12, 9, 1, '#ffffff', '#ccc');
  }],
  kitchentable: [80, 52, (c) => {
    E(c, 14, 44, 8, 5, '#b3875c'); E(c, 66, 44, 8, 5, '#b3875c'); // banquinhos
    R(c, 4, 6, 72, 30, 5, '#d8ad80', OUT); R(c, 4, 6, 72, 8, 5, '#e9c49a');
    c.fillStyle = '#8a5f3e'; c.fillRect(10, 34, 4, 10); c.fillRect(66, 34, 4, 10);
    E(c, 40, 18, 9, 5, '#ffffff'); E(c, 40, 17, 6, 3, '#f2a65a'); // tigela de mexericas
    E(c, 38, 15.5, 2.5, 2, '#f39a3a'); E(c, 42, 15.5, 2.5, 2, '#f39a3a');
  }],
  shoerack: [62, 40, (c) => {
    R(c, 2, 8, 58, 30, 3, '#b3875c', OUT); c.fillStyle = '#8a5f3e'; c.fillRect(4, 22, 54, 2);
    [[8, '#2c2a33'], [22, '#e8e6ef'], [38, '#c94a5a']].forEach(([x, col]) => { E(c, x + 3, 18, 4, 3, col); E(c, x + 10, 18, 4, 3, col); });
    E(c, 14, 32, 4, 3, '#6a7ef0'); E(c, 22, 32, 4, 3, '#6a7ef0');
    R(c, 44, 0, 3, 14, 1, '#4a4656'); E(c, 45.5, 0, 4, 2, '#4a4656'); // guarda-chuva
  }],
  door: [64, 42, (c) => {
    R(c, 2, 2, 60, 38, 2, '#3a2d3f');
    R(c, 6, 4, 52, 34, 2, LG(c, 0, 4, 0, 38, [[0, '#a86e48'], [1, '#7a4c30']]));
    c.strokeStyle = '#6a4228'; c.lineWidth = 1; c.strokeRect(10, 8, 44, 12); c.strokeRect(10, 23, 44, 12);
    E(c, 50, 22, 2.4, 2.4, '#f2d27a');
  }],
};

export const DECALS = {
  rug_round: [124, 84, (c) => {
    E(c, 62, 42, 60, 40, '#f3c9d6'); E(c, 62, 42, 50, 32, '#f8dbe4');
    c.strokeStyle = '#e8a8bd'; c.lineWidth = 1.5; c.setLineDash([3, 3]); c.beginPath(); c.ellipse(62, 42, 55, 36, 0, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
  }],
  rug_living: [160, 96, (c) => {
    R(c, 2, 2, 156, 92, 8, '#8fa6d8'); R(c, 10, 10, 140, 76, 6, '#a9bde6');
    c.strokeStyle = '#ffffff'; c.globalAlpha = 0.5; c.lineWidth = 1;
    for (let i = 0; i < 8; i++) { c.beginPath(); c.moveTo(14 + i * 18, 12); c.lineTo(14 + i * 18, 84); c.stroke(); }
    c.globalAlpha = 1;
  }],
  doormat: [60, 24, (c) => { R(c, 2, 2, 56, 20, 3, '#6a5a4a'); R(c, 5, 5, 50, 14, 2, '#857360'); c.fillStyle = '#d8c8a8'; c.font = 'bold 6px sans-serif'; c.fillText('BEM-VINDO', 13, 14.5); }],
};

/** Cria (se necessário) a textura Phaser de um objeto e retorna a chave. */
export function ensureTexture(scene, type, table = ART) {
  const key = `obj_${type}`;
  if (scene.textures.exists(key)) return key;
  const def = table[type];
  if (!def) throw new Error(`Arte inexistente: ${type}`);
  const [w, h, draw] = def;
  const tex = scene.textures.createCanvas(key, Math.ceil(w * RES), Math.ceil(h * RES));
  const ctx = tex.getContext();
  ctx.save(); ctx.scale(RES, RES); ctx.lineJoin = 'round'; draw(ctx); ctx.restore();
  tex.refresh();
  return key;
}

/** Desenha um decalque (tapete etc.) direto num contexto já escalado. */
export function drawDecal(ctx, type, x, y) {
  const [w, h, draw] = DECALS[type];
  ctx.save(); ctx.translate(x - w / 2, y - h / 2); draw(ctx); ctx.restore();
}
