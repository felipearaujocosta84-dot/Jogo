/* Vale da Lanterna — mundo aberto todo desenhado em código: terreno, rio, mar, trilhas, praças,
   casas, torre, fazenda, acampamento, árvores e interiores. */
'use strict';

const IS = 1;
const WW = 7600, WH = 4500;
const CELL = 8, GC = Math.ceil(WW / CELL), GR = Math.ceil(WH / CELL);

// Regiões (coordenadas de mundo). ox/oy/iw/ih = retângulo da região.
const REGIONS = {
  praca: { name: 'Praça das Telhas', amb: 'petals', ox: 3000, oy: 1100, iw: 1104, ih: 1965, safe: true,
    npcs: [],   // Vó Aurora agora é moradora com rotina (life.js)
    items: [{ id: 'c_p1', k: 'moeda', x: 3700, y: 1780 }, { id: 'c_p2', k: 'moeda', x: 3330, y: 2420 }],
    doors: [], start: [3550, 2420] },
  vila: { name: 'Vila do Rio', amb: 'butterflies', ox: 1500, oy: 300, iw: 1104, ih: 1965, safe: true,
    npcs: [],   // Mel: moradora com rotina (life.js)
    items: [
      { id: 'flor1', k: 'florlume', x: 1610, y: 1290 }, { id: 'flor2', k: 'florlume', x: 2290, y: 1060 }, { id: 'flor3', k: 'florlume', x: 1560, y: 2080 },
      { id: 'flor4', k: 'florlume', x: 2230, y: 1720 }, { id: 'flor5', k: 'florlume', x: 2010, y: 560 }, { id: 'c_v1', k: 'moeda', x: 1790, y: 1420 }],
    doors: [], start: [1900, 1700] },
  horta: { name: 'Horta do Seu Tomé', amb: 'butterflies', ox: 4600, oy: 300, iw: 1104, ih: 1965,
    npcs: [],   // Seu Tomé: morador com rotina (life.js)
    items: [{ id: 'c_h1', k: 'moeda', x: 4700, y: 1380 }, { id: 'c_h2', k: 'moeda', x: 5480, y: 2000 }],
    foes: [{ id: 'hm1', x: 4880, y: 1100 }, { id: 'hm2', x: 5380, y: 1080 }, { id: 'hm3', x: 4870, y: 1650 },
      { id: 'hm4', x: 5370, y: 1660 }, { id: 'hm5', x: 5250, y: 1400 }],
    doors: [], start: [5100, 1000] },
  torre: { name: 'Torre da Lanterna', amb: 'fireflies', ox: 6200, oy: 1500, iw: 1104, ih: 1965,
    npcs: [], items: [], doors: [],
    door: { x: 6750, y: 2262 }, chest: { x: 6470, y: 2170 }, start: [6500, 2620] },
  penhasco: { name: 'Penhasco do Vento', amb: 'embers', ox: 300, oy: 2300, iw: 1104, ih: 1500,
    npcs: [{ id: 'camp', x: 800, y: 3222, name: 'Rui e Lina', hidden: true },
      { id: 'rui', x: 712, y: 3196, name: 'Rui', deco: true }, { id: 'lina', x: 890, y: 3196, name: 'Lina', deco: true }],
    items: [{ id: 'c_c1', k: 'moeda', x: 560, y: 3350 }, { id: 'c_c2', k: 'moeda', x: 1100, y: 3100 }],
    doors: [], fire: { x: 800, y: 3140 }, start: [800, 2900] }
};
const REGION_LIST = Object.keys(REGIONS).map(k => Object.assign(REGIONS[k], { id: k }));
const toWorld = (r, x, y) => [x, y];

const TRAILS = [
  [[3150, 1950], [2800, 1950], [2800, 1600], [1900, 1600]],                       // praça → vila (ponte)
  [[1900, 1760], [1900, 2150], [800, 2150], [800, 3060]],                          // vila → penhasco
  [[1900, 1760], [1900, 600], [2250, 430]],                                         // rua da vila
  [[3550, 1480], [3550, 700], [5100, 700], [5100, 2000], [5100, 3350]],            // praça → horta → sul
  [[3550, 2700], [3550, 3350], [5800, 3350], [5800, 2620], [6560, 2620], [6750, 2420]], // praça → torre
  [[5800, 2620], [5800, 1300], [6050, 1000], [6750, 900]],                         // bosque norte
  [[3550, 3350], [3550, 4000], [2750, 4000]],                                      // praia
  [[800, 2150], [800, 950]],                                                       // clareira
  [[4600, 700], [4600, 1400], [5650, 1400]],                                       // corredor da horta
  [[800, 2150], [0, 2150]], [[7600, 2150], [7150, 2150], [6990, 2330]],            // saídas para o mundo
  [[4700, 700], [4700, 0]], [[4700, 3350], [4700, 4500]]
];
const RIVER = [[2500, 120], [2480, 700], [2400, 1100], [2450, 1500], [2350, 1900], [2250, 2300], [2200, 2700]];
const WATER = [
  [[1240, 2650], [1800, 2560], [2350, 2700], [2550, 3300], [2500, 4000], [2650, 4500], [0, 4500], [0, 3700],
    [300, 3650], [600, 3760], [950, 3640], [1240, 3450]],
  [[7000, 2700], [7600, 2600], [7600, 4500], [6300, 4500], [6400, 3950], [6900, 3650], [6950, 3200]],
  Array.from({ length: 20 }, (_, i) => [4300 + Math.cos(i / 20 * 6.283) * 240, 3880 + Math.sin(i / 20 * 6.283) * 150])
];
const PLAZAS = [[3550, 2080, 430, 640], [6750, 2380, 280, 210], [1900, 1660, 170, 110], [800, 3170, 230, 150]];
const FIELDS = [[4740, 900, 260, 380], [5200, 900, 360, 380], [4740, 1460, 260, 380], [5200, 1460, 360, 380]];
const LANDMARKS = [
  { name: 'Clareira dos Cogumelos', x: 800, y: 900 }, { name: 'Praia', x: 2700, y: 3950 }, { name: 'Lago', x: 7050, y: 3900 },
  { name: 'Bosque Norte', x: 6750, y: 900 }, { name: 'Campos do Sul', x: 4700, y: 3950 }
];
const CAT_SPOT = [6800, 860];

// ---------------------------------------------------------------- terreno
// 0 grama, 1 trilha, 2 água, 3 areia, 4 calçamento, 5 terra arada, 6 rocha do penhasco, 7 ponte
let valeTer = null;
function buildTerrain() {
  const c = document.createElement('canvas'); c.width = GC; c.height = GR;
  const g = c.getContext('2d');
  const path = p => { g.beginPath(); p.forEach(([x, y], i) => i ? g.lineTo(x / CELL, y / CELL) : g.moveTo(x / CELL, y / CELL)); };
  g.lineJoin = 'round'; g.lineCap = 'round';
  const layer = draw => {
    g.clearRect(0, 0, GC, GR); g.fillStyle = '#fff'; g.strokeStyle = '#fff'; draw();
    const d = g.getImageData(0, 0, GC, GR).data, m = new Uint8Array(GC * GR);
    for (let i = 0; i < m.length; i++) m[i] = d[i * 4 + 3] > 120 ? 1 : 0;
    return m;
  };
  const sand = layer(() => { for (const w of WATER) { path(w); g.closePath(); g.lineWidth = 80 / CELL; g.stroke(); } });
  const water = layer(() => {
    for (const w of WATER) { path(w); g.closePath(); g.fill(); }
    path(RIVER); g.lineWidth = 84 / CELL; g.stroke();
  });
  const cliff = layer(() => {
    g.save(); g.beginPath(); g.rect(0, 2400 / CELL, 1700 / CELL, GR); g.clip();
    path(WATER[0]); g.closePath(); g.lineWidth = 120 / CELL; g.stroke(); g.restore();
  });
  const trail = layer(() => { for (const t of TRAILS) { path(t); g.lineWidth = 76 / CELL; g.stroke(); } });
  const plaza = layer(() => { for (const [x, y, rx, ry] of PLAZAS) { g.beginPath(); g.ellipse(x / CELL, y / CELL, rx / CELL, ry / CELL, 0, 0, 7); g.fill(); } });
  const field = layer(() => { for (const [x, y, w, h] of FIELDS) g.fillRect(x / CELL, y / CELL, w / CELL, h / CELL); });
  valeTer = new Uint8Array(GC * GR);
  for (let i = 0; i < valeTer.length; i++) {
    valeTer[i] = trail[i] && water[i] ? 7 : field[i] ? 5 : plaza[i] ? 4 : trail[i] ? 1 : cliff[i] ? 6 : water[i] ? 2 : sand[i] ? 3 : 0;
  }
}
function terrainAt(x, y) {
  if (x >= 0 && y >= 0 && x < WW && y < WH) return valeTer[Math.floor(y / CELL) * GC + Math.floor(x / CELL)];
  const cx = Math.floor(x / CK), cy = Math.floor(y / CK), d = getCD(cx, cy);
  return d.ter[Math.floor((y - cy * CK) / CELL) * CCELLS + Math.floor((x - cx * CK) / CELL)];
}
function regionAt(x, y, pad = 0) {
  for (const r of REGION_LIST) if (x >= r.ox - pad && y >= r.oy - pad && x < r.ox + r.iw + pad && y < r.oy + r.ih + pad) return r;
  return null;
}

// ---------------------------------------------------------------- grade andável
let valeGrid = null;
const worldGrid = { facade: true, cell: CELL };   // grade do mundo infinito (vale + pedaços gerados)
function buildWorldGrid() {
  const m = new Uint8Array(GC * GR);
  for (let i = 0; i < m.length; i++) { const t = valeTer[i]; m[i] = (t === 2 || t === 6) ? 0 : 1; }
  valeGrid = { cols: GC, rows: GR, cell: CELL, m };
}
function stampGrid(grid, x, y, rad, v) {
  const c = grid.cell, r = Math.ceil(rad / c);
  if (grid.facade) {
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if ((i * c) ** 2 + (j * c * 1.6) ** 2 <= rad * rad) worldSetCell(x + i * c, y + j * c, v);
    return;
  }
  const gx = Math.floor(x / c), gy = Math.floor(y / c);
  for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
    const cx = gx + i, cy = gy + j;
    if (cx < 0 || cy < 0 || cx >= grid.cols || cy >= grid.rows) continue;
    if ((i * c) ** 2 + (j * c * 1.6) ** 2 <= rad * rad) grid.m[cy * grid.cols + cx] = v;
  }
}
function stampRect(grid, x0, y0, x1, y1, v) {
  if (grid.facade) { for (let y = y0; y < y1; y += CELL) for (let x = x0; x < x1; x += CELL) worldSetCell(x, y, v); return; }
  for (let y = y0; y < y1; y += grid.cell) for (let x = x0; x < x1; x += grid.cell) {
    const cx = Math.floor(x / grid.cell), cy = Math.floor(y / grid.cell);
    if (cx >= 0 && cy >= 0 && cx < grid.cols && cy < grid.rows) grid.m[cy * grid.cols + cx] = v;
  }
}

// ---------------------------------------------------------------- construções em pixel art
const SC = 4;   // 1 pixel de arte = 4 px de mundo
const ROOFS = {
  red: ['#4a1812', '#8e3a2a', '#b5523a', '#d8784e'], slate: ['#161b28', '#2c3448', '#424c66', '#647090'],
  blue: ['#15233f', '#2b4a7a', '#3b62a0', '#6a92cc'], teal: ['#0f3533', '#1f6a66', '#2f8a84', '#5cc0b4'],
  brown: ['#2e1c10', '#5e3a20', '#7e5230', '#a87446'], purple: ['#24163a', '#4a2f66', '#6a4a8e', '#9a7ac0'],
  orange: ['#4a2410', '#a0522a', '#c86a34', '#e8944e'], pink: ['#4a1a2a', '#a04a6a', '#d06a90', '#f09ab8']
};
const FLOWER_COLS = ['#ff9ec7', '#ffe066', '#ffffff', '#ff7a5a', '#b59cff'];
function makeHouse(o, seed) {
  const W = o.w, roofH = o.roofH || 30, wallH = o.wallH || 25, top = 10, H = top + roofH + wallH + 3;
  const P = ROOFS[o.roof];
  const cv2 = pixelCanvas(W, H, g => {
    const rect = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
    const wy0 = top + roofH, wx0 = 3, wx1 = W - 3;
    // parede
    for (let y = wy0; y < wy0 + wallH; y++) for (let x = wx0; x < wx1; x++) {
      let c;
      if (o.wall === 'stone') {
        const row = Math.floor((y - wy0) / 4), off = (row % 2) * 3;
        c = ((x + off) % 6 === 0 || (y - wy0) % 4 === 0) ? '#5f5c57' : ['#a29e96', '#8f8b83', '#b4b0a8'][Math.floor(hash2(Math.floor((x + off) / 6), row + seed) * 3)];
      } else if (o.wall === 'adobe') c = hash2(x + seed, y) < 0.08 ? '#c8a06a' : (y - wy0) % 9 === 0 && hash2(x >> 3, y) < 0.4 ? '#d4ae78' : '#e6c690';
      else if (o.wall === 'wood') c = x % 4 === 0 ? '#5e3a20' : (hash2(x >> 2, seed) < 0.5 ? '#9a6a3e' : '#a87646');
      else c = hash2(x + seed, y) < 0.07 ? '#ddd0b0' : '#efe4c8';
      rect(x, y, 1, 1, c);
    }
    if (o.wall === 'plaster') {
      rect(wx0, wy0, 2, wallH, '#5a3a22'); rect(wx1 - 2, wy0, 2, wallH, '#5a3a22');
      rect(wx0, wy0 + 1, wx1 - wx0, 2, '#5a3a22'); rect(wx0, wy0 + Math.floor(wallH * 0.55), wx1 - wx0, 1, '#6b4426');
      for (let x = wx0 + 10; x < wx1 - 8; x += 14) { for (let k = 0; k < 6; k++) rect(x + k, wy0 + 3 + k, 1, 1, '#6b4426'); }
    }
    for (let y = wy0 + wallH - 4; y < wy0 + wallH; y++) for (let x = wx0; x < wx1; x++)
      rect(x, y, 1, 1, ((x + (y % 2) * 2) % 5 === 0 || y === wy0 + wallH - 4) ? '#4f4c48' : '#8a867e');
    rect(wx0 - 1, wy0, 1, wallH, '#2a1d16'); rect(wx1, wy0, 1, wallH, '#2a1d16'); rect(wx0 - 1, wy0 + wallH, wx1 - wx0 + 2, 1, '#2a1d16');
    // janelas
    const dw = 10, dh = 15, dx = Math.floor(W / 2 - dw / 2), dy = wy0 + wallH - dh;
    const nWin = W >= 62 ? 2 : 1;
    for (const s of [-1, 1]) for (let k = 0; k < nWin; k++) {
      const x = Math.round(W / 2 + s * (dw / 2 + 7 + k * 13) - 4), y = wy0 + 6;
      rect(x - 1, y - 1, 10, 9, '#2a1d16'); rect(x, y, 8, 7, '#8fcfe8'); rect(x, y, 3, 3, '#d8f2ff');
      rect(x + 3, y, 1, 7, '#5a3a22'); rect(x, y + 3, 8, 1, '#5a3a22');
      if (o.flowers !== false) {
        rect(x - 1, y + 8, 10, 3, '#6b4426');
        for (let i = 0; i < 5; i++) rect(x + i * 2, y + 7 - (i % 2), 2, 2, FLOWER_COLS[(i + seed) % 5]);
      }
    }
    // porta
    rect(dx - 1, dy - 1, dw + 2, dh + 1, '#2a1d16'); rect(dx, dy, dw, dh, '#7a4a2a');
    for (let x = dx + 2; x < dx + dw; x += 3) rect(x, dy, 1, dh, '#5a3418');
    rect(dx, dy, dw, 2, '#5a3418'); rect(dx + dw - 3, dy + 7, 1, 2, '#e0b040');
    rect(dx, dy - 1, 1, 1, 'rgba(0,0,0,0)');
    rect(dx - 3, wy0 + wallH, dw + 6, 3, '#9a968e'); rect(dx - 3, wy0 + wallH + 2, dw + 6, 1, '#5f5c57');
    // placa
    if (o.sign) {
      const sx = dx + dw + 3, sy = dy - 2;
      rect(sx, sy, 8, 1, '#2a1d16'); rect(sx + 1, sy + 1, 1, 2, '#2a1d16'); rect(sx + 6, sy + 1, 1, 2, '#2a1d16');
      rect(sx - 1, sy + 3, 10, 8, '#2a1d16'); rect(sx, sy + 4, 8, 6, '#c99a6a');
      if (o.sign === 'anvil') { rect(sx + 1, sy + 5, 6, 2, '#4f4c48'); rect(sx + 3, sy + 7, 2, 2, '#4f4c48'); }
      if (o.sign === 'bag') { rect(sx + 2, sy + 5, 4, 4, '#e0b040'); rect(sx + 3, sy + 4, 2, 1, '#a07a20'); }
      if (o.sign === 'inn') { rect(sx + 2, sy + 5, 4, 4, '#e8e0c8'); rect(sx + 6, sy + 6, 1, 2, '#e8e0c8'); rect(sx + 2, sy + 5, 4, 1, '#ffffff'); }
      if (o.sign === 'bread') { rect(sx + 1, sy + 6, 6, 3, '#a0602a'); rect(sx + 2, sy + 5, 4, 1, '#d9a05a'); }
    }
    // telhado
    for (let t = 0; t < roofH; t++) {
      const y = top + t, inset = Math.round((1 - t / roofH) * 7);
      for (let x = inset; x < W - inset; x++) {
        const row = Math.floor(t / 4), off = (row % 2) * 3;
        let c = P[2];
        if ((x + off) % 6 === 0 || t % 4 === 3) c = P[1];
        else if (t % 4 === 0 && hash2(x + seed, row) < 0.35) c = P[3];
        if (o.snow && (t < 4 || (t < 9 && hash2(x + seed, t) < 0.55))) c = t < 2 ? '#ffffff' : '#e4eef6';
        if (x === inset || x === W - inset - 1) c = P[0];
        rect(x, y, 1, 1, c);
      }
    }
    rect(7, top, W - 14, 2, P[0]); rect(8, top + 1, W - 16, 1, P[3]);
    rect(0, top + roofH - 1, W, 1, P[0]);
    rect(wx0, top + roofH, wx1 - wx0, 2, 'rgba(0,0,0,0.28)');
    if (W >= 62) {   // água-furtada
      const cx = Math.floor(W / 2) - 6, cy = top + 7;
      rect(cx - 1, cy + 3, 14, 11, '#2a1d16'); rect(cx, cy + 4, 12, 9, '#efe4c8');
      rect(cx + 3, cy + 6, 6, 5, '#8fcfe8'); rect(cx + 5, cy + 6, 1, 5, '#5a3a22');
      for (let k = 0; k < 7; k++) { rect(cx - 1 + k, cy + 3 - Math.floor(k / 2), 1, 1, P[0]); rect(cx + 12 - k, cy + 3 - Math.floor(k / 2), 1, 1, P[0]); }
      rect(cx + 1, cy + 1, 10, 3, P[2]);
    }
    if (o.chimney) {
      const cx = Math.floor(W * 0.72);
      rect(cx - 1, 1, 8, top + 9, '#2a1d16'); rect(cx, 2, 6, top + 7, '#8a867e');
      for (let y = 4; y < top + 8; y += 3) rect(cx, y, 6, 1, '#6a665f');
      rect(cx - 1, 1, 8, 2, '#4f4c48');
      o.chimneyPos = [cx + 3, 1];
    }
  });
  return { img: cv2, w: W, h: H, foot: (wallH + roofH * 0.55) };
}
function makeTower() {
  const W = 64, H = 150;
  const img = pixelCanvas(W, H, g => {
    const rect = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
    // corpo cilíndrico
    for (let y = 40; y < 140; y++) for (let x = 12; x < 52; x++) {
      const row = Math.floor(y / 5), off = (row % 2) * 4;
      const sh = (x - 12) / 40;
      const base = sh < 0.25 ? ['#c4beb2', '#b6b0a4'] : sh < 0.7 ? ['#a8a296', '#9a9488'] : ['#857f74', '#767066'];
      let c = base[Math.floor(hash2(Math.floor((x + off) / 8), row) * 2)];
      if ((x + off) % 8 === 0 || y % 5 === 0) c = '#5f5a52';
      if (hash2(x, y) < 0.02) c = '#5f8a3a';
      rect(x, y, 1, 1, c);
    }
    rect(11, 40, 1, 100, '#2a2622'); rect(52, 40, 1, 100, '#2a2622');
    for (let x = 7; x < 57; x++) for (let y = 132; y < 146; y++) rect(x, y, 1, 1, (y === 132 || (x + (y % 2) * 3) % 7 === 0) ? '#4f4a44' : '#8f897d');
    rect(6, 132, 1, 14, '#2a2622'); rect(57, 132, 1, 14, '#2a2622'); rect(6, 146, 52, 1, '#2a2622');
    // porta em arco
    rect(23, 113, 18, 33, '#2a2622'); rect(25, 116, 14, 30, '#7a4a2a');
    for (let x = 27; x < 39; x += 3) rect(x, 116, 1, 30, '#5a3418');
    rect(25, 116, 2, 2, '#2a2622'); rect(37, 116, 2, 2, '#2a2622'); rect(26, 125, 12, 1, '#3b3530'); rect(26, 136, 12, 1, '#3b3530');
    rect(35, 130, 2, 2, '#e0b040');
    rect(22, 112, 20, 2, '#d6d0c4');
    // janelas
    for (const y of [62, 88]) { rect(29, y - 1, 6, 12, '#2a2622'); rect(30, y, 4, 10, '#3a4a5a'); rect(30, y, 1, 4, '#8fcfe8'); }
    // varanda
    rect(5, 34, 54, 7, '#2a2622'); rect(6, 35, 52, 4, '#b6b0a4'); rect(6, 39, 52, 2, '#6a645a');
    for (let x = 8; x < 56; x += 5) rect(x, 30, 2, 5, '#4f4a44');
    rect(6, 29, 52, 2, '#4f4a44');
    // sala da lanterna
    rect(17, 13, 30, 17, '#2a2622');
    for (let i = 0; i < 4; i++) { rect(19 + i * 7, 15, 5, 13, '#34404c'); rect(19 + i * 7, 15, 1, 6, '#5a6a7a'); }
    // telhado cônico
    for (let y = 0; y < 14; y++) {
      const hw = Math.round(2 + y * 1.3);
      for (let x = 32 - hw; x < 32 + hw; x++) rect(x, y, 1, 1, x === 32 - hw || x === 32 + hw - 1 ? '#161b28' : x < 32 ? '#46516e' : '#2c3448');
    }
    rect(15, 12, 34, 2, '#161b28'); rect(31, 0, 2, 2, '#e0b040');
  });
  return { img, w: W, h: H, lantern: [32, 21] };
}
function makeBarn() {
  const W = 78, H = 70;
  const img = pixelCanvas(W, H, g => {
    const rect = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
    for (let y = 30; y < 66; y++) for (let x = 6; x < 72; x++) rect(x, y, 1, 1, x % 4 === 0 ? '#7a2a1e' : '#a8402e');
    rect(5, 30, 1, 36, '#2a1410'); rect(72, 30, 1, 36, '#2a1410'); rect(5, 66, 68, 1, '#2a1410');
    rect(6, 30, 66, 2, '#f0e6d0'); rect(6, 30, 2, 36, '#f0e6d0'); rect(70, 30, 2, 36, '#f0e6d0');
    // portão
    rect(27, 40, 24, 26, '#f0e6d0'); rect(29, 42, 20, 24, '#8e3424');
    for (let k = 0; k < 20; k++) { rect(29 + k, 42 + Math.floor(k * 1.2), 1, 1, '#f0e6d0'); rect(48 - k, 42 + Math.floor(k * 1.2), 1, 1, '#f0e6d0'); }
    rect(38, 42, 1, 24, '#f0e6d0');
    // telhado de duas águas
    for (let y = 0; y < 31; y++) {
      const hw = Math.round(6 + y * 1.06);
      for (let x = 39 - hw; x < 39 + hw; x++) {
        let c = (x + (Math.floor(y / 3) % 2) * 2) % 5 === 0 || y % 3 === 2 ? '#4a2a18' : '#6e4426';
        if (x === 39 - hw || x === 39 + hw - 1) c = '#24140a';
        rect(x, y, 1, 1, c);
      }
    }
    rect(33, 12, 12, 10, '#24140a'); rect(34, 13, 10, 8, '#f0e6d0'); rect(35, 14, 8, 6, '#e8c060'); rect(38, 14, 2, 6, '#c99a3a');
  });
  return { img, w: W, h: H };
}
function makeSmall(kind) {
  const defs = {
    well: [32, 40, g => {
      const rect = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
      rect(5, 8, 3, 20, '#5a3a22'); rect(24, 8, 3, 20, '#5a3a22');
      for (let y = 0; y < 9; y++) { const hw = 6 + y * 1.4; rect(16 - hw, y, hw * 2, 1, y === 8 ? '#4a1812' : y % 3 === 0 ? '#8e3a2a' : '#b5523a'); }
      rect(8, 13, 16, 2, '#7a4a2a'); rect(15, 15, 2, 6, '#3b2618'); rect(13, 20, 6, 5, '#7a4a2a');
      g.fillStyle = '#4f4c48'; g.beginPath(); g.ellipse(16, 31, 15, 8, 0, 0, 7); g.fill();
      g.fillStyle = '#9a968e'; g.beginPath(); g.ellipse(16, 30, 14, 7, 0, 0, 7); g.fill();
      g.fillStyle = '#2a5a8a'; g.beginPath(); g.ellipse(16, 29, 10, 4, 0, 0, 7); g.fill();
      for (let x = 3; x < 30; x += 4) rect(x, 32 + (x % 8 ? 1 : 0), 3, 2, '#7d7a74');
    }],
    fountain: [64, 36, g => {
      const rect = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
      g.fillStyle = '#4f4c48'; g.beginPath(); g.ellipse(32, 25, 31, 11, 0, 0, 7); g.fill();
      g.fillStyle = '#b4b0a8'; g.beginPath(); g.ellipse(32, 24, 30, 10, 0, 0, 7); g.fill();
      g.fillStyle = '#3a7ab0'; g.beginPath(); g.ellipse(32, 23, 25, 7, 0, 0, 7); g.fill();
      g.fillStyle = '#5fa8d8'; g.beginPath(); g.ellipse(28, 22, 14, 3, 0, 0, 7); g.fill();
      rect(28, 6, 8, 18, '#4f4c48'); rect(29, 6, 6, 17, '#a29e96'); rect(29, 6, 2, 17, '#c4beb2');
      g.fillStyle = '#4f4c48'; g.beginPath(); g.ellipse(32, 6, 9, 3, 0, 0, 7); g.fill();
      g.fillStyle = '#5fa8d8'; g.beginPath(); g.ellipse(32, 5, 7, 2, 0, 0, 7); g.fill();
    }],
    van: [62, 36, g => {
      const rect = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
      rect(2, 5, 58, 25, '#2a2622'); rect(3, 6, 56, 23, '#e8e0c8'); rect(3, 6, 56, 4, '#f6f0dc');
      rect(14, 1, 18, 5, '#2a2622'); rect(15, 2, 16, 4, '#d8d0b8');
      rect(6, 11, 10, 7, '#2a3a4a'); rect(19, 11, 10, 7, '#2a3a4a'); rect(32, 11, 8, 7, '#2a3a4a'); rect(46, 10, 11, 9, '#2a3a4a');
      rect(7, 12, 3, 3, '#8fcfe8'); rect(47, 11, 4, 3, '#8fcfe8');
      rect(3, 21, 56, 2, '#b5523a'); rect(3, 24, 56, 1, '#7a6a5a');
      rect(41, 10, 1, 19, '#7a6a5a'); rect(56, 22, 3, 3, '#ffe27a');
      for (const wx of [14, 47]) { g.fillStyle = '#1a1a1a'; g.beginPath(); g.arc(wx, 30, 5.5, 0, 7); g.fill(); g.fillStyle = '#8a8a8a'; g.beginPath(); g.arc(wx, 30, 2, 0, 7); g.fill(); }
    }],
    tent: [44, 32, g => {
      for (let y = 0; y < 30; y++) {
        const hw = y * 0.72 + 1;
        for (let x = Math.round(22 - hw); x < Math.round(22 + hw); x++) {
          g.fillStyle = x === Math.round(22 - hw) || x === Math.round(22 + hw) - 1 ? '#5a2a10' : x < 22 ? '#e8883a' : '#c06a28';
          g.fillRect(x, y + 1, 1, 1);
        }
      }
      g.fillStyle = '#3a1a08';
      for (let y = 12; y < 30; y++) { const hw = (y - 12) * 0.35; g.fillRect(Math.round(22 - hw), y + 1, Math.max(1, Math.round(hw * 2)), 1); }
      g.fillStyle = '#5a3a22'; g.fillRect(21, 0, 2, 3);
    }]
  };
  const [w, h, fn] = defs[kind];
  return { img: pixelCanvas(w, h, fn), w, h };
}

// lista de construções (x = centro, y = base no mundo)
const BUILDINGS = [
  { kind: 'house', x: 3250, y: 1560, w: 66, roof: 'slate', wall: 'stone', sign: 'anvil', chimney: true, to: 'oficina' },
  { kind: 'house', x: 3850, y: 1560, w: 62, roof: 'red', wall: 'plaster', to: 'casaTeo' },
  { kind: 'house', x: 3850, y: 2640, w: 62, roof: 'purple', wall: 'plaster', chimney: true, to: 'casaAurora' },
  { kind: 'house', x: 3250, y: 2640, w: 58, roof: 'blue', wall: 'wood', chimney: true, to: 'casaBruno' },
  { kind: 'house', x: 1700, y: 1160, w: 66, roof: 'orange', wall: 'plaster', sign: 'bread', chimney: true, to: 'padaria' },
  { kind: 'house', x: 2130, y: 1340, w: 58, roof: 'teal', wall: 'wood', to: 'casaMel' },
  { kind: 'house', x: 1700, y: 1640, w: 54, roof: 'blue', wall: 'plaster', to: 'casaRosa' },
  { kind: 'house', x: 2140, y: 880, w: 58, roof: 'brown', wall: 'plaster', chimney: true, to: 'casaIara' },
  { kind: 'house', x: 1700, y: 720, w: 54, roof: 'red', wall: 'stone', chimney: true, to: 'casaDavi' },
  { kind: 'house', x: 1650, y: 2000, w: 52, roof: 'pink', wall: 'plaster', to: 'casaNina' },
  { kind: 'house', x: 4000, y: 2100, w: 58, roof: 'teal', wall: 'stone', chimney: true, to: 'casaLeo' },
  { kind: 'house', x: 4690, y: 2210, w: 54, roof: 'brown', wall: 'wood', chimney: true, to: 'cabanaTome' },
  { kind: 'barn', x: 5380, y: 820 },
  { kind: 'tower', x: 6750, y: 2262 },
  { kind: 'well', x: 5640, y: 1420 },
  { kind: 'fountain', x: 3550, y: 2030 },
  { kind: 'van', x: 990, y: 3040 },
  { kind: 'tent', x: 620, y: 3070 }
];
let TOWER = null;
function buildBuildings() {
  BUILDINGS.forEach((b, i) => {
    let s;
    if (b.kind === 'house') s = makeHouse(b, i * 13 + 7);
    else if (b.kind === 'tower') { s = makeTower(); TOWER = b; }
    else if (b.kind === 'barn') s = makeBarn();
    else s = makeSmall(b.kind);
    b.sc = (b.kind === 'house' || b.kind === 'barn' || b.kind === 'tower') ? 5 : SC;
    b.img = s.img; b.pw = s.w * b.sc; b.ph = s.h * b.sc; b.lantern = s.lantern;
    if (b.chimneyPos) b.smoke = [b.x - b.pw / 2 + b.chimneyPos[0] * b.sc, b.y - b.ph + 4];
    // colisão
    const hw = b.pw / 2;
    if (b.kind === 'house' || b.kind === 'barn') stampRect(valeGrid, b.x - hw + 16, b.y - (s.foot ? s.foot * b.sc : b.ph * 0.6), b.x + hw - 16, b.y - 10, 0);
    else if (b.kind === 'tower') stampRect(valeGrid, b.x - b.pw * 0.36, b.y - b.ph * 0.3, b.x + b.pw * 0.36, b.y - 8, 0);
    else if (b.kind === 'fountain') { for (let a = 0; a < 6.28; a += 0.2) stampGrid(valeGrid, b.x + Math.cos(a) * 80, b.y - 44 + Math.sin(a) * 26, 34, 0); stampGrid(valeGrid, b.x, b.y - 44, 60, 0); }
    else if (b.kind === 'well') stampRect(valeGrid, b.x - 56, b.y - 70, b.x + 56, b.y - 6, 0);
    else if (b.kind === 'van') stampRect(valeGrid, b.x - 118, b.y - 100, b.x + 118, b.y - 8, 0);
    else if (b.kind === 'tent') stampRect(valeGrid, b.x - 76, b.y - 90, b.x + 76, b.y - 8, 0);
    if (b.to) { const r = regionAt(b.x, b.y); r.doors.push({ x: b.x, y: b.y + 14, to: b.to }); }
    addProp({ t: 'bld', x: b.x, y: b.y, b });
  });
}

// ---------------------------------------------------------------- props
const BUCKET = 512, BC = Math.ceil(WW / BUCKET), BR = Math.ceil(WH / BUCKET);
let buckets = [];
const props = [];
function addProp(p) { props.push(p); }
function deco(d, x, y, extra) { addProp(Object.assign({ t: 'deco', d, x, y, seed: Math.floor(x * 7 + y * 13) }, extra || {})); }
function clearOf(x, y, rad, types) {
  for (let a = 0; a < 8; a++) if (types.includes(terrainAt(x + Math.cos(a * 0.785) * rad, y + Math.sin(a * 0.785) * rad))) return false;
  return !types.includes(terrainAt(x, y));
}
function nearBuilding(x, y, pad) {
  return BUILDINGS.some(b => x > b.x - b.pw / 2 - pad && x < b.x + b.pw / 2 + pad && y > b.y - b.ph - pad && y < b.y + pad + 40);
}
function placeTownDecor() {
  // praça: postes, bancos, canteiros, barris
  for (const [x, y] of [[3330, 1760], [3770, 1760], [3330, 2400], [3770, 2400], [3200, 2050], [3900, 2050]]) deco('lamp', x, y, { block: 12 });
  for (const [x, y] of [[3420, 2290], [3680, 2290]]) deco('bench', x, y);
  for (const [x, y] of [[3550, 2200], [3380, 1990], [3720, 1990], [3550, 1850]]) deco('flowerbed', x, y);
  for (const [x, y] of [[3100, 1600], [3110, 1640], [4000, 2680], [3420, 1620]]) deco('barrel', x, y, { block: 18 });
  deco('crate', 3060, 1620, { block: 18 }); deco('anvilout', 3400, 1610, { block: 16 });
  // vila
  for (const [x, y] of [[1820, 1250], [1980, 1250], [1820, 800], [1980, 1520]]) deco('lamp', x, y, { block: 12 });
  for (const [x, y] of [[1600, 1300], [2260, 1080], [1660, 2070], [2230, 1740], [2000, 580], [1640, 900], [2250, 1440]]) deco('flowerbed', x, y);
  deco('bench', 1990, 1745); deco('stall', 3330, 1880, { block: 30, col: '#7b5aa6' }); deco('log', 1545, 880); deco('log', 1600, 905); deco('crate', 1590, 1190, { block: 18 }); deco('barrel', 1850, 1180, { block: 18 });
  // horta: cercas, plantações, feno
  for (const [fx, fy, fw, fh] of FIELDS) {
    for (let x = fx + 12; x < fx + fw; x += 48) {
      if (Math.abs(x + 24 - (fx + fw / 2)) > 40) { deco('fenceH', x + 24, fy - 6); }
      deco('fenceH', x + 24, fy + fh + 18);
    }
    for (let y = fy + 30; y < fy + fh; y += 46) { deco('fenceV', fx - 10, y + 20); deco('fenceV', fx + fw + 10, y + 20); }
    const kinds = ['cabbage', 'carrot', 'beans', 'pumpkin'], kd = kinds[(fx + fy) % 4 === 0 ? 0 : Math.floor(hash2(fx, fy) * 4)];
    for (let y = fy + 50; y < fy + fh - 10; y += 64) for (let x = fx + 34; x < fx + fw - 20; x += 56) deco(kd, x, y);
  }
  for (const [x, y] of [[5640, 900], [5680, 960]]) deco('hay', x, y, { block: 30 });
  deco('crate', 5560, 1460, { block: 18 }); deco('barrel', 5720, 1460, { block: 18 });
  // torre: ruínas e baú
  for (const [x, y] of [[6520, 2420], [6980, 2420], [6600, 2160], [6920, 2170], [6450, 2620], [7050, 2620]]) deco('pillar', x, y, { block: 22 });
  for (const [x, y] of [[6560, 2540], [6930, 2300], [7000, 2500], [6480, 2280]]) deco('rubble', x, y);
  deco('chest', REGIONS.torre.chest.x, REGIONS.torre.chest.y, { block: 26 });
  // acampamento
  deco('campfire', REGIONS.penhasco.fire.x, REGIONS.penhasco.fire.y, { block: 46 });
  for (const [x, y] of [[700, 3200], [900, 3200]]) deco('log', x, y + 6);
  deco('crate', 1080, 3140, { block: 18 }); deco('chair', 1000, 3240);
  // placas nas entradas
  for (const [x, y, t] of [[3110, 1890, 'Praça das Telhas'], [2700, 1540, 'Vila do Rio'], [5040, 640, 'Horta'], [6480, 2700, 'Torre'], [860, 2960, 'Penhasco'], [5740, 1260, 'Bosque Norte']]) deco('sign', x, y, { text: t, block: 8 });
  for (const p of props) if (p.t === 'deco' && p.block) stampGrid(valeGrid, p.x, p.y - 6, p.block, 0);
  for (const p of props) if (p.t === 'deco' && (p.d === 'fenceH')) stampRect(valeGrid, p.x - 24, p.y - 12, p.x + 24, p.y, 0);
  for (const p of props) if (p.t === 'deco' && (p.d === 'fenceV')) stampRect(valeGrid, p.x - 6, p.y - 46, p.x + 6, p.y, 0);
}
function placeProps() {
  const R = mulberry(20261116);
  const town = (x, y) => REGION_LIST.some(r => x > r.ox + 60 && x < r.ox + r.iw - 60 && y > r.oy + 60 && y < r.oy + r.ih - 60);
  const okTree = (x, y) => x > 60 && y > 120 && x < WW - 60 && y < WH - 40 && clearOf(x, y, 66, [1, 2, 3, 4, 5, 6, 7]) &&
    !nearBuilding(x, y, 90) && Math.hypot(x - CAT_SPOT[0], y - CAT_SPOT[1]) > 230 && !PLAZAS.some(([px, py, rx, ry]) => ((x - px) / (rx + 90)) ** 2 + ((y - py) / (ry + 90)) ** 2 < 1);
  const tree = (x, y) => {
    let idx = y < 1300 && R() < 0.6 ? 5 + Math.floor(R() * 2) : Math.floor(R() * 5);
    if (x > 5600 && R() < 0.4) idx = 3;
    addProp({ t: 'tree', x, y, img: TREE_IMGS[idx].img, stock: 3, regrow: 0, shake: 0, s: 4 + (R() < 0.2 ? 0.6 : 0) });
  };
  for (let y = 60; y < WH; y += 104) for (let x = 40; x < WW; x += 96) {
    const jx = x + (R() - 0.5) * 70, jy = y + (R() - 0.5) * 60;
    const edge = Math.min(jx, jy, WW - jx, WH - jy);
    let n = vnoise(jx * 0.0014, jy * 0.0014) + (edge < 380 ? 0.55 : 0) + (vnoise(jx * 0.006, jy * 0.006) - 0.5) * 0.25;
    const inTown = town(jx, jy);
    if (inTown) n -= 0.35;
    if ((n > 0.62 || (!inTown && R() < 0.06) || (inTown && R() < 0.035)) && okTree(jx, jy)) tree(jx, jy);
  }
  // arbustos espalhados (decoração)
  for (let i = 0; i < 260; i++) {
    const x = R() * WW, y = R() * WH;
    if (x < 200 || y < 200 || x > WW - 200 || y > WH - 200 || !clearOf(x, y, 40, [1, 2, 3, 4, 5, 6, 7]) || nearBuilding(x, y, 60)) continue;
    addProp({ t: 'bush', x, y, img: BUSH_IMGS[Math.floor(R() * BUSH_IMGS.length)], s: 3.5 + R() * 1.5 });
  }
  const meadow = (x, y) => x > 200 && y > 200 && x < WW - 200 && y < WH - 200 && clearOf(x, y, 34, [1, 2, 3, 4, 5, 6, 7]) && !nearBuilding(x, y, 70);
  const notSafe = (x, y) => { const r = regionAt(x, y); return !(r && r.safe); };
  const farFromTrees = (x, y, d) => !props.some(p => (p.t === 'tree' || p.t === 'bld') && Math.abs(p.x - x) < d && Math.abs(p.y - y) < d * 0.7);
  for (let i = 0; i < 190; i++) {
    const x = R() * WW, y = R() * WH;
    if (!meadow(x, y) || !notSafe(x, y) || !farFromTrees(x, y, 70)) continue;
    const crystal = (x > 5400 && R() < 0.5) || (Math.hypot(x - CAT_SPOT[0], y - CAT_SPOT[1]) < 900 && R() < 0.6);
    addProp({ t: 'rock', x, y, img: crystal ? ROCK_IMGS[2] : ROCK_IMGS[Math.floor(R() * 2)], crystal, stock: crystal ? 2 : 3, regrow: 0, shake: 0 });
  }
  for (let i = 0; i < 560; i++) {
    const x = R() * WW, y = R() * WH;
    if (meadow(x, y) && farFromTrees(x, y, 40)) addProp({ t: 'tuft', x, y, gone: 0, ph: R() * 6 });
  }
  for (let i = 0; i < 300; i++) {
    const x = R() * WW, y = R() * WH;
    if (meadow(x, y) && notSafe(x, y) && farFromTrees(x, y, 40)) addProp({ t: 'flower', x, y, gone: 0, col: FLOWER_COLS[Math.floor(R() * FLOWER_COLS.length)] });
  }
  for (let i = 0; i < 900; i++) {
    const x = i % 3 === 0 ? 800 + (R() - 0.5) * 1300 : R() * WW, y = i % 3 === 0 ? 950 + (R() - 0.5) * 1000 : R() * WH;
    if (!meadow(x, y) || !notSafe(x, y)) continue;
    if (!props.some(p => p.t === 'tree' && Math.hypot(p.x - x, p.y - y) < 150)) continue;
    if (props.filter(p => p.t === 'mush').length > 120) break;
    addProp({ t: 'mush', x, y, gone: 0 });
  }
  for (const p of props) {
    if (p.t === 'tree') stampGrid(valeGrid, p.x, p.y - 6, 20, 0);
    if (p.t === 'rock') stampGrid(valeGrid, p.x, p.y - 8, 30, 0);
  }
  buckets = Array.from({ length: BC * BR }, () => []);
  for (const p of props) {
    const bx = clamp(Math.floor(p.x / BUCKET), 0, BC - 1), by = clamp(Math.floor(p.y / BUCKET), 0, BR - 1);
    buckets[by * BC + bx].push(p);
  }
}
function propsNear(x0, y0, x1, y1) {
  const out = [];
  for (let cy = Math.floor(y0 / CK); cy <= Math.floor(y1 / CK); cy++) for (let cx = Math.floor(x0 / CK); cx <= Math.floor(x1 / CK); cx++) {
    if (cx >= 0 && cy >= 0 && (cx + 1) * CK <= WW && (cy + 1) * CK <= WH) continue;
    for (const p of chunkProps(cx, cy)) if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1) out.push(p);
  }
  if (x1 < 0 || y1 < 0 || x0 > WW || y0 > WH) return out;
  const bx0 = clamp(Math.floor(x0 / BUCKET), 0, BC - 1), bx1 = clamp(Math.floor(x1 / BUCKET), 0, BC - 1);
  const by0 = clamp(Math.floor(y0 / BUCKET), 0, BR - 1), by1 = clamp(Math.floor(y1 / BUCKET), 0, BR - 1);
  for (let by = by0; by <= by1; by++) for (let bx = bx0; bx <= bx1; bx++) for (const p of buckets[by * BC + bx]) {
    if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1) out.push(p);
  }
  return out;
}

// ---------------------------------------------------------------- chão em pedaços (cache)
const CH = 512, CHR = 2;
const chunkCache = new Map();
const mod = (a, n) => ((a % n) + n) % n;
function groundRGB(wx, wy) {
  const jx = (vnoise(wx * 0.02, wy * 0.02) - 0.5) * 26, jy = (vnoise(wx * 0.02 + 50, wy * 0.02) - 0.5) * 26;
  const t = terrainAt(wx + jx, wy + jy);
  const n = vnoise(wx * 0.005, wy * 0.005) * 0.65 + vnoise(wx * 0.03, wy * 0.03) * 0.35;
  const h = hash2(wx >> 2, wy >> 2);
  const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  const bio = (wx >= 0 && wy >= 0 && wx < WW && wy < WH) ? 'campo' : biomeAt(wx, wy);
  if (t === 7) {
    if (terrainAt(wx, wy) !== 7) return [90, 58, 32];
    return (mod(wx, 16) < 3 || mod(wy, 16) < 2) ? [90, 58, 32] : h < 0.5 ? [160, 112, 62] : [176, 124, 70];
  }
  if (t === 2) {
    if (bio === 'pantano') return h < 0.02 ? [110, 130, 70] : mix([44, 60, 36], [70, 92, 52], n);
    if (h < 0.015) return [170, 222, 245]; return mix([40, 118, 176], [64, 158, 210], n);
  }
  if (t === 9) return h < 0.03 ? [150, 190, 215] : mix([186, 222, 240], [214, 238, 250], n);
  if (t === 6) {
    if (h < 0.06) return [62, 60, 58];
    const k = vnoise(wx * 0.04, wy * 0.04);
    if (bio === 'neve') return k > 0.5 ? [244, 248, 252] : k > 0.3 ? [200, 212, 226] : [130, 138, 152];
    if (bio === 'deserto') return k < 0.35 ? [150, 90, 60] : k < 0.65 ? [180, 112, 74] : [206, 142, 98];
    return k < 0.35 ? [95, 92, 87] : k < 0.65 ? [125, 122, 116] : [154, 151, 143];
  }
  if (t === 3) return h < 0.05 ? [200, 180, 120] : mix([214, 192, 132], [232, 214, 158], n);
  if (t === 4 || t === 14) {
    const row = Math.floor(wy / 14), off = mod(row, 2) * 10, bx = Math.floor((wx + off) / 20);
    if (t === 14) { if (mod(wx + off, 20) < 3 || mod(wy, 14) < 3) return [58, 54, 50]; return hash2(bx, row) < 0.5 ? [120, 114, 104] : [140, 134, 122]; }
    if (mod(wx + off, 20) < 3 || mod(wy, 14) < 3) return [128, 118, 100];
    const k = hash2(bx, row);
    return k < 0.33 ? [200, 190, 166] : k < 0.66 ? [184, 173, 148] : [214, 204, 180];
  }
  if (t === 5) {
    if (mod(wy, 32) < 7) return [86, 56, 32];
    return h < 0.06 ? [140, 98, 60] : mix([112, 74, 44], [128, 86, 52], n);
  }
  if (t === 1) {
    if (h < 0.05) return [150, 118, 78];
    const e = [[14, 0], [-14, 0], [0, 14], [0, -14]].some(([a, b]) => { const q = terrainAt(wx + jx + a, wy + jy + b); return q === 0 || q === 3 || q === 13; });
    if (bio === 'neve') return e ? [170, 160, 150] : mix([190, 180, 168], [214, 206, 196], n);
    return e ? [160, 126, 80] : mix([178, 140, 88], [204, 168, 112], n);
  }
  if (t === 13) {
    if (bio === 'deserto') return h < 0.05 ? [200, 170, 110] : mix([222, 196, 140], [236, 214, 160], n);
    if (bio === 'neve') return h < 0.04 ? [200, 214, 230] : mix([226, 234, 242], [246, 250, 252], n);
    if (h > 0.99) return [[255, 236, 120], [255, 255, 255], [255, 170, 205]][Math.floor(h * 1000) % 3];
    return h < 0.05 ? [100, 168, 70] : mix([92, 156, 62], [124, 190, 80], n);
  }
  switch (bio) {
    case 'floresta': if (h < 0.05) return [30, 70, 30]; return mix([40, 92, 36], [80, 142, 56], n);
    case 'outono': if (h > 0.965) return [[220, 110, 40], [200, 60, 40], [230, 190, 60]][Math.floor(h * 1000) % 3]; return mix([128, 118, 52], [170, 150, 72], n);
    case 'deserto': { const rip = Math.sin(wx * 0.018 + wy * 0.006 + n * 7) * 0.5 + 0.5; if (h < 0.015) return [170, 130, 80]; return mix([214, 178, 116], [238, 208, 148], rip * 0.6 + n * 0.4); }
    case 'neve': if (h < 0.03) return [186, 204, 224]; return mix([212, 224, 236], [246, 250, 253], n);
    case 'pantano': if (vnoise(wx * 0.012, wy * 0.012) > 0.64) return h < 0.1 ? [60, 50, 32] : [80, 66, 42]; if (h < 0.05) return [96, 120, 56]; return mix([44, 72, 38], [76, 104, 52], n);
    case 'cerejeiras': if (h > 0.97) return [255, 190, 215]; break;
  }
  if (h < 0.045) return [150, 212, 92];
  if (h > 0.992) return [[255, 236, 120], [255, 255, 255], [255, 170, 205]][Math.floor(h * 1000) % 3];
  if (h < 0.09) return [58, 116, 42];
  return mix([66, 128, 44], [118, 186, 68], n);
}
function getChunk(cx, cy, allowBuild) {
  const key = cx + ',' + cy;
  let c = chunkCache.get(key);
  if (c) { chunkCache.delete(key); chunkCache.set(key, c); return c; }
  if (!allowBuild) return null;
  const S2 = CH / CHR;
  c = document.createElement('canvas'); c.width = S2; c.height = S2;
  const g = c.getContext('2d'), id = g.createImageData(S2, S2), d = id.data;
  for (let y = 0; y < S2; y += 2) for (let x = 0; x < S2; x += 2) {
    const [r, gg, b] = groundRGB(cx * CH + x * CHR, cy * CH + y * CHR);
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
      const k = ((y + j) * S2 + x + i) * 4; d[k] = r; d[k + 1] = gg; d[k + 2] = b; d[k + 3] = 255;
    }
  }
  g.putImageData(id, 0, 0);
  chunkCache.set(key, c);
  while (chunkCache.size > 70) chunkCache.delete(chunkCache.keys().next().value);
  return c;
}

// ---------------------------------------------------------------- interiores
const TILE = 48;
const INTERIORS = {
  oficina: { name: 'Oficina do Bruno', w: 12, h: 8, floor: 'stone', wall: 'stone',
    furn: [{ t: 'forge', x: 1, y: 0, w: 2, h: 2 }, { t: 'shelf', x: 8, y: 0, w: 2, h: 2 }, { t: 'window', x: 5, y: 0, w: 1, h: 2 },
      { t: 'anvil', x: 3, y: 3, w: 1, h: 1, block: 1 }, { t: 'bancada', x: 8, y: 3, w: 2, h: 1, block: 1, use: 'bancada' },
      { t: 'barrel', x: 10, y: 5, w: 1, h: 1, block: 1 }, { t: 'barrel', x: 10, y: 6, w: 1, h: 1, block: 1 }, { t: 'rug', x: 4, y: 5, w: 3, h: 2 }],
    npcs: [] },
  casaTeo: { name: 'Casa do Téo', w: 10, h: 7, floor: 'wood', wall: 'wood',
    furn: [{ t: 'window', x: 2, y: 0, w: 1, h: 2 }, { t: 'shelf', x: 6, y: 0, w: 2, h: 2 }, { t: 'window', x: 8, y: 0, w: 1, h: 2 },
      { t: 'bed', x: 1, y: 2, w: 1, h: 2, block: 1, col: '#4f7fbf' }, { t: 'rug', x: 3, y: 4, w: 3, h: 2 },
      { t: 'table', x: 6, y: 3, w: 2, h: 1, block: 1 }, { t: 'plant', x: 8, y: 2, w: 1, h: 1, block: 1 }, { t: 'catbed', x: 8, y: 5, w: 1, h: 1 }],
    npcs: [] },
  casaAurora: { name: 'Casa da Vó Aurora', w: 10, h: 7, floor: 'wood', wall: 'wood',
    furn: [{ t: 'shelf', x: 1, y: 0, w: 2, h: 2 }, { t: 'fireplace', x: 4, y: 0, w: 2, h: 2 }, { t: 'window', x: 7, y: 0, w: 1, h: 2 },
      { t: 'bed', x: 8, y: 2, w: 1, h: 2, block: 1, col: '#7b5aa6', use: 'bed' }, { t: 'rug', x: 3, y: 3, w: 4, h: 2 },
      { t: 'table', x: 1, y: 4, w: 2, h: 1, block: 1 }, { t: 'plant', x: 1, y: 2, w: 1, h: 1, block: 1 }, { t: 'chest', x: 8, y: 5, w: 1, h: 1, block: 1, use: 'chest', id: 'ch_aurora' }],
    npcs: [] },
  padaria: { name: 'Padaria da Rosa', w: 12, h: 8, floor: 'wood', wall: 'brick',
    furn: [{ t: 'oven', x: 1, y: 0, w: 2, h: 2 }, { t: 'window', x: 5, y: 0, w: 1, h: 2 }, { t: 'shelf', x: 8, y: 0, w: 3, h: 2, bread: 1 },
      { t: 'counter', x: 3, y: 3, w: 5, h: 1, block: 1 }, { t: 'sack', x: 10, y: 3, w: 1, h: 1, block: 1 }, { t: 'sack', x: 10, y: 4, w: 1, h: 1, block: 1 },
      { t: 'table', x: 2, y: 5, w: 2, h: 1, block: 1 }, { t: 'table', x: 7, y: 5, w: 2, h: 1, block: 1 }],
    npcs: [] },
  casaMel: { name: 'Casa da Mel', w: 10, h: 7, floor: 'wood', wall: 'wood',
    furn: [{ t: 'window', x: 2, y: 0, w: 1, h: 2 }, { t: 'flowers', x: 4, y: 0, w: 3, h: 2 }, { t: 'window', x: 8, y: 0, w: 1, h: 2 },
      { t: 'bed', x: 1, y: 2, w: 1, h: 2, block: 1, col: '#e86a9a' }, { t: 'loom', x: 5, y: 2, w: 2, h: 1, block: 1 },
      { t: 'rug', x: 3, y: 4, w: 3, h: 2 }, { t: 'plant', x: 8, y: 2, w: 1, h: 1, block: 1 }, { t: 'chest', x: 8, y: 5, w: 1, h: 1, block: 1, use: 'chest', id: 'ch_mel' }],
    npcs: [] }
};
// casas dos moradores (Fase 3)
function homeDef(name, wall, beds, cols) {
  const furn = [{ t: 'window', x: 2, y: 0, w: 1, h: 2 }, { t: 'shelf', x: 4, y: 0, w: 2, h: 2 }, { t: 'window', x: 7, y: 0, w: 1, h: 2 },
    { t: 'rug', x: 3, y: 4, w: 3, h: 2 }, { t: 'table', x: 6, y: 4, w: 2, h: 1, block: 1 }, { t: 'plant', x: 8, y: 2, w: 1, h: 1, block: 1 }];
  for (let i = 0; i < beds; i++) furn.push({ t: 'bed', x: 1 + i * 2, y: 2, w: 1, h: 2, block: 1, col: cols[i % cols.length], use: 'bed' });
  return { name, w: 10, h: 7, floor: 'wood', wall, furn, npcs: [] };
}
Object.assign(INTERIORS, {
  casaBruno: homeDef('Casa do Bruno', 'stone', 1, ['#6e5a48']),
  casaRosa: homeDef('Casa da Rosa', 'brick', 1, ['#e86a8a']),
  casaIara: homeDef('Casa da Iara', 'wood', 1, ['#2f8a84']),
  casaDavi: homeDef('Casa do Davi', 'wood', 1, ['#7a4a2a']),
  casaNina: homeDef('Casa da Nina', 'brick', 1, ['#b59cff']),
  casaLeo: homeDef('Casa do Léo e da Bia', 'stone', 2, ['#4f7fbf', '#e8944e']),
  cabanaTome: homeDef('Cabana do Seu Tomé', 'wood', 2, ['#c8423b', '#5fa65a'])
});
const CHEST_LOOT = { ch_aurora: { pocao: 1, flor: 2, moeda: 5 }, ch_mel: { fibra: 3, flor: 3, moeda: 5 } };
function buildInterior(id) {
  const I = INTERIORS[id];
  const w = I.w * TILE, h = I.h * TILE;
  I.pw = w; I.ph = h;
  const c = document.createElement('canvas'); c.width = w; c.height = h + 24;
  const g = c.getContext('2d');
  const R = mulberry(id.length * 991);
  // chão
  for (let y = 2 * TILE; y < h; y += 12) for (let x = 0; x < w; x += 4) {
    if (I.floor === 'stone') {
      const tx = Math.floor(x / 48), ty = Math.floor(y / 48), n = hash2(tx, ty);
      g.fillStyle = (x % 48 < 4 || y % 48 < 4) ? '#4a4650' : n < 0.3 ? '#7d7884' : n < 0.7 ? '#8d8894' : '#9a96a2';
      g.fillRect(x, y, 4, 12);
    } else {
      const row = Math.floor(y / 12), off = (row % 3) * 32, seg = Math.floor((x + off) / 96);
      const n = hash2(seg, row);
      g.fillStyle = (x + off) % 96 < 4 ? '#5a3a20' : n < 0.33 ? '#a0703e' : n < 0.66 ? '#b07c46' : '#bb8a52';
      g.fillRect(x, y, 4, 12);
      if (y % 12 === 0) { g.fillStyle = '#6b4626'; g.fillRect(x, y, 4, 2); }
    }
  }
  // parede do fundo
  const wallCol = { stone: ['#6b6672', '#5a5560', '#7d7884'], wood: ['#8a5a34', '#7a4e2c', '#9a6a3e'], brick: ['#a0523a', '#8a4430', '#b4664a'] }[I.wall];
  for (let y = 0; y < 2 * TILE; y += 12) for (let x = 0; x < w; x += 24) {
    const off = (Math.floor(y / 12) % 2) * 12;
    g.fillStyle = wallCol[Math.floor(hash2(x + off, y) * 3)];
    g.fillRect(x - off, y, 24, 12);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x - off, y + 10, 24, 2); g.fillRect(x - off, y, 2, 12);
  }
  g.fillStyle = '#3b2618'; g.fillRect(0, 2 * TILE - 10, w, 10);
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 2 * TILE, w, 10);
  // móveis
  const sorted = I.furn.slice().sort((a, b) => (a.t === 'rug' ? -1 : 0) - (b.t === 'rug' ? -1 : 0));
  for (const f of sorted) drawFurniture(g, f, R);
  // paredes laterais e de baixo com porta
  g.fillStyle = '#2a1d16'; g.fillRect(0, 0, 10, h + 24); g.fillRect(w - 10, 0, 10, h + 24);
  const dx = w / 2;
  g.fillStyle = '#2a1d16'; g.fillRect(0, h, dx - 40, 24); g.fillRect(dx + 40, h, w - dx - 40, 24);
  g.fillStyle = '#7a4a2a'; g.fillRect(dx - 40, h - 4, 80, 28);
  g.fillStyle = '#b5523a'; g.fillRect(dx - 34, h - 22, 68, 22);
  g.fillStyle = '#e0a060'; for (let i = 0; i < 6; i++) g.fillRect(dx - 30 + i * 11, h - 18, 6, 14);
  I.canvas = c;
  // grade
  const cols = Math.ceil(w / CELL), rows = Math.ceil(h / CELL), m = new Uint8Array(cols * rows);
  for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
    const x = (cx + 0.5) * CELL, y = (cy + 0.5) * CELL;
    m[cy * cols + cx] = (y > 2 * TILE + 10 && x > 22 && x < w - 22 && y < h) ? 1 : 0;
  }
  const grid = { cols, rows, cell: CELL, m };
  for (const f of I.furn) if (f.block) {
    for (let y = f.y * TILE + 6; y < (f.y + f.h) * TILE + 10; y += CELL) for (let x = f.x * TILE + 4; x < (f.x + f.w) * TILE - 4; x += CELL) {
      const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
      if (cx >= 0 && cy >= 0 && cx < cols && cy < rows) m[cy * cols + cx] = 0;
    }
  }
  I.grid = grid;
}
function drawFurniture(g, f, R) {
  const x = f.x * TILE, y = f.y * TILE, w = f.w * TILE, h = f.h * TILE;
  const box = (bx, by, bw, bh, col, out = '#2a1a10') => { g.fillStyle = out; g.fillRect(bx - 2, by - 2, bw + 4, bh + 4); g.fillStyle = col; g.fillRect(bx, by, bw, bh); };
  switch (f.t) {
    case 'rug': {
      g.fillStyle = '#7a2e2e'; g.fillRect(x + 4, y + 4, w - 8, h - 8);
      g.fillStyle = '#b5523a'; g.fillRect(x + 10, y + 10, w - 20, h - 20);
      g.fillStyle = '#e0a060'; for (let i = x + 16; i < x + w - 16; i += 16) g.fillRect(i, y + h / 2 - 2, 8, 4);
      break;
    }
    case 'window': {
      box(x + 6, y + 14, w - 12, 50, '#9fd8f0', '#3b2618');
      g.fillStyle = '#d8f2ff'; g.fillRect(x + 10, y + 18, 10, 20);
      g.fillStyle = '#3b2618'; g.fillRect(x + w / 2 - 2, y + 14, 4, 50); g.fillRect(x + 6, y + 37, w - 12, 4);
      g.fillStyle = '#5a9e34'; g.fillRect(x + 4, y + 66, w - 8, 6);
      break;
    }
    case 'shelf': {
      box(x + 4, y + 8, w - 8, h - 22, '#7a4a2a');
      for (let r = 0; r < 3; r++) {
        const sy = y + 14 + r * 22;
        g.fillStyle = '#3b2618'; g.fillRect(x + 6, sy + 18, w - 12, 3);
        for (let bx = x + 10; bx < x + w - 12; bx += 7) {
          const hh = 12 + Math.floor(R() * 6);
          g.fillStyle = f.bread ? ['#d9a05a', '#c48440', '#e8c080'][Math.floor(R() * 3)] : ['#c8423b', '#4f7fbf', '#5fa65a', '#e0a020', '#7b5aa6'][Math.floor(R() * 5)];
          if (f.bread) { g.beginPath(); g.ellipse(bx + 4, sy + 13, 6, 5, 0, 0, 7); g.fill(); bx += 6; }
          else g.fillRect(bx, sy + 18 - hh, 5, hh);
        }
      }
      break;
    }
    case 'forge': case 'oven': case 'fireplace': {
      const col = f.t === 'oven' ? '#a0523a' : '#6b6672';
      box(x + 4, y + 10, w - 8, h - 14, col);
      for (let yy = y + 12; yy < y + h - 6; yy += 10) for (let xx = x + 6 + ((yy / 10) % 2) * 8; xx < x + w - 8; xx += 16) { g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(xx, yy, 14, 2); }
      box(x + w / 2 - 22, y + h - 44, 44, 32, '#1a1010', '#1a1010');
      g.fillStyle = '#ff7a2a'; g.fillRect(x + w / 2 - 16, y + h - 26, 32, 12);
      g.fillStyle = '#ffd34a'; g.fillRect(x + w / 2 - 8, y + h - 30, 16, 14);
      break;
    }
    case 'anvil': {
      box(x + 8, y + 20, 32, 10, '#55555f'); box(x + 16, y + 30, 16, 14, '#44444c'); g.fillStyle = '#9a9aa8'; g.fillRect(x + 8, y + 20, 32, 3);
      break;
    }
    case 'bancada': {
      box(x + 2, y + 8, w - 4, 22, '#a0703e'); g.fillStyle = '#5a3a20'; g.fillRect(x + 6, y + 30, 6, 16); g.fillRect(x + w - 12, y + 30, 6, 16);
      g.fillStyle = '#c9d3dc'; g.fillRect(x + 14, y + 12, 18, 4); g.fillStyle = '#7a4a2a'; g.fillRect(x + 30, y + 11, 10, 6);
      g.fillStyle = '#8a8f99'; g.fillRect(x + 50, y + 10, 10, 10); g.fillStyle = '#d9a05a'; g.fillRect(x + 66, y + 12, 18, 6);
      break;
    }
    case 'barrel': case 'sack': {
      if (f.t === 'barrel') { box(x + 8, y + 6, 32, 38, '#8a5a34'); g.fillStyle = '#3b2618'; g.fillRect(x + 8, y + 14, 32, 3); g.fillRect(x + 8, y + 34, 32, 3); }
      else { box(x + 8, y + 12, 32, 32, '#e6dccb'); g.fillStyle = '#b8ab95'; g.fillRect(x + 14, y + 12, 20, 5); g.fillStyle = '#c8423b'; g.fillRect(x + 18, y + 26, 12, 6); }
      break;
    }
    case 'bed': {
      box(x + 4, y + 4, w - 8, h - 10, '#7a4a2a');
      g.fillStyle = '#f4f1ea'; g.fillRect(x + 8, y + 8, w - 16, 18);
      g.fillStyle = f.col || '#4f7fbf'; g.fillRect(x + 6, y + 30, w - 12, h - 40);
      g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x + 6, y + 30, w - 12, 4);
      break;
    }
    case 'table': {
      box(x + 4, y + 8, w - 8, 24, '#b07c46'); g.fillStyle = '#6b4626'; g.fillRect(x + 8, y + 32, 6, 12); g.fillRect(x + w - 14, y + 32, 6, 12);
      g.fillStyle = '#f4f1ea'; g.fillRect(x + 14, y + 12, 12, 8); g.fillStyle = '#e8c080'; g.fillRect(x + w - 30, y + 12, 14, 8);
      break;
    }
    case 'counter': {
      box(x + 2, y + 6, w - 4, 34, '#8a5a34'); g.fillStyle = '#c99a6a'; g.fillRect(x + 2, y + 6, w - 4, 8);
      for (let i = 0; i < 6; i++) { g.fillStyle = ['#d9a05a', '#e8c080', '#c48440'][i % 3]; g.beginPath(); g.ellipse(x + 26 + i * 38, y + 8, 12, 7, 0, 0, 7); g.fill(); }
      break;
    }
    case 'plant': {
      box(x + 14, y + 26, 20, 18, '#b5523a'); g.fillStyle = '#3f8a37';
      for (let i = 0; i < 7; i++) { g.beginPath(); g.ellipse(x + 24 + Math.cos(i) * 10, y + 16 + Math.sin(i * 2) * 8, 8, 6, i, 0, 7); g.fill(); }
      break;
    }
    case 'flowers': {
      box(x + 6, y + 50, w - 12, 20, '#7a4a2a');
      for (let i = 0; i < 12; i++) { g.fillStyle = ['#ff9ec7', '#ffe066', '#ffffff', '#b59cff'][i % 4]; g.beginPath(); g.arc(x + 14 + i * ((w - 28) / 11), y + 44 + (i % 2) * 6, 6, 0, 7); g.fill(); }
      break;
    }
    case 'loom': {
      box(x + 6, y + 4, w - 12, 36, '#8a5a34');
      for (let i = 0; i < 14; i++) { g.fillStyle = ['#ff9ec7', '#ffe066', '#9ad1ff'][i % 3]; g.fillRect(x + 12 + i * 5, y + 8, 3, 28); }
      break;
    }
    case 'chest': {
      box(x + 6, y + 14, 36, 28, '#8a5a34'); g.fillStyle = '#c99a3a'; g.fillRect(x + 6, y + 24, 36, 4); g.fillRect(x + 21, y + 22, 6, 8);
      break;
    }
    case 'catbed': {
      g.fillStyle = '#7a4a2a'; g.beginPath(); g.ellipse(x + 24, y + 30, 22, 13, 0, 0, 7); g.fill();
      g.fillStyle = '#e86a8a'; g.beginPath(); g.ellipse(x + 24, y + 28, 17, 9, 0, 0, 7); g.fill();
      break;
    }
  }
}
