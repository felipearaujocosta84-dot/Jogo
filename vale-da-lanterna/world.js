/* Vale da Lanterna — mundo aberto: regiões (as ilustrações), terreno, trilhas, água, props e interiores. */
'use strict';

const IS = 1.5;                    // escala das ilustrações no mundo
const WW = 7600, WH = 4500;        // tamanho do mundo (px)
const CELL = 8, GC = Math.ceil(WW / CELL), GR = Math.ceil(WH / CELL);

// Coordenadas locais = pixels da ilustração original. ox/oy = canto no mundo.
const REGIONS = {
  praca: {
    name: 'Praça das Telhas', img: 'assets/praca.jpg', amb: 'petals', ox: 3000, oy: 1100, safe: true,
    walk: [[[290, 470], [470, 455], [490, 530], [540, 610], [575, 680], [555, 770], [520, 830], [470, 880], [440, 940],
      [470, 1060], [540, 1120], [600, 1180], [585, 1308], [220, 1308], [200, 1200], [210, 1120], [240, 1050], [230, 950],
      [245, 850], [240, 760], [245, 690], [200, 650], [140, 610], [140, 550], [230, 545], [280, 520]],
      [[0, 520], [160, 540], [160, 618], [0, 618]]],
    corridors: [[[0, 528], [150, 545], [150, 612], [0, 612]]],
    holes: [{ e: [400, 728, 95, 58] }, { e: [405, 1005, 58, 82] }, { e: [436, 872, 26, 22] }],
    npcs: [{ id: 'aurora', x: 318, y: 835, name: 'Vó Aurora' }],
    items: [{ id: 'c_p1', k: 'moeda', x: 520, y: 640 }, { id: 'c_p2', k: 'moeda', x: 260, y: 1180 }],
    doors: [{ x: 212, y: 498, to: 'oficina' }, { x: 560, y: 598, to: 'casaTeo' }, { x: 522, y: 1078, to: 'casaAurora' }],
    start: [380, 1150]
  },
  vila: {
    name: 'Vila do Rio', img: 'assets/vila.jpg', amb: 'butterflies', ox: 1500, oy: 300, safe: true,
    walk: [
      [[430, 188], [495, 188], [490, 260], [472, 340], [420, 340], [440, 260]],
      [[300, 330], [520, 330], [530, 420], [400, 445], [300, 450]],
      [[300, 440], [400, 440], [400, 610], [300, 610]],
      [[270, 600], [405, 595], [430, 680], [520, 700], [525, 785], [440, 790], [400, 805], [340, 820], [278, 760], [270, 680]],
      [[340, 800], [440, 780], [525, 800], [600, 880], [600, 950], [450, 955], [415, 1068], [345, 1068], [310, 950], [300, 880]],
      [[440, 940], [640, 955], [680, 1020], [480, 1040], [440, 1000]],
      [[340, 1040], [420, 1040], [425, 1313], [335, 1313]],
      [[600, 945], [736, 960], [736, 1035], [640, 1035]]],
    corridors: [[[345, 1045], [415, 1045], [420, 1313], [340, 1313]], [[610, 955], [736, 968], [736, 1028], [650, 1028]]],
    holes: [],
    npcs: [{ id: 'mel', x: 430, y: 885, name: 'Mel' }],
    items: [
      { id: 'flor1', k: 'florlume', x: 340, y: 395 }, { id: 'flor2', k: 'florlume', x: 462, y: 300 }, { id: 'flor3', k: 'florlume', x: 305, y: 700 },
      { id: 'flor4', k: 'florlume', x: 480, y: 745 }, { id: 'flor5', k: 'florlume', x: 600, y: 1000 }, { id: 'c_v1', k: 'moeda', x: 350, y: 520 }],
    doors: [{ x: 440, y: 672, to: 'padaria' }, { x: 585, y: 880, to: 'casaMel' }],
    start: [462, 250]
  },
  horta: {
    name: 'Horta do Seu Tomé', img: 'assets/horta.jpg', amb: 'butterflies', ox: 4600, oy: 300,
    walk: [[[40, 170], [330, 120], [345, 215], [215, 250], [205, 340], [240, 420], [300, 450], [440, 500], [560, 560],
      [640, 615], [736, 635], [736, 720], [640, 722], [560, 780], [460, 860], [360, 920], [280, 960], [300, 1060], [420, 1100],
      [440, 1160], [400, 1200], [360, 1314], [100, 1314], [60, 1150], [40, 1000], [30, 760], [140, 665], [150, 420], [60, 330]],
      [[0, 165], [70, 165], [70, 335], [0, 335]]],
    corridors: [[[0, 172], [60, 172], [60, 328], [0, 328]]],
    holes: [
      { p: [[195, 650], [230, 600], [260, 570], [300, 560], [420, 600], [520, 690], [510, 760], [390, 830], [290, 820], [200, 760]] },
      { e: [245, 872, 88, 36] }],
    npcs: [{ id: 'tome', x: 610, y: 690, name: 'Seu Tomé' }],
    items: [{ id: 'c_h1', k: 'moeda', x: 90, y: 760 }, { id: 'c_h2', k: 'moeda', x: 330, y: 1240 }],
    foes: [{ id: 'hm1', x: 180, y: 520 }, { id: 'hm2', x: 470, y: 580 }, { id: 'hm3', x: 110, y: 900 },
      { id: 'hm4', x: 230, y: 1060 }, { id: 'hm5', x: 300, y: 1200 }],
    doors: [], start: [250, 205]
  },
  torre: {
    name: 'Torre da Lanterna', img: 'assets/torre.jpg', amb: 'fireflies', ox: 6200, oy: 1500,
    walk: [[[440, 300], [600, 300], [650, 340], [640, 400], [560, 470], [600, 560], [560, 620], [600, 700], [560, 760],
      [580, 880], [560, 960], [540, 1000], [420, 1030], [300, 1000], [200, 965], [120, 960], [0, 945], [0, 875], [120, 875],
      [180, 895], [250, 860], [300, 780], [340, 700], [330, 620], [300, 580], [290, 500], [330, 450], [420, 420], [470, 360]]],
    corridors: [], holes: [], npcs: [], items: [], doors: [],
    door: { x: 520, y: 312 }, chest: { x: 258, y: 448 },
    start: [80, 915]
  },
  penhasco: {
    name: 'Penhasco do Vento', img: 'assets/penhasco.jpg', amb: 'embers', ox: 300, oy: 2300,
    walk: [[[60, 700], [260, 700], [300, 655], [420, 605], [440, 520], [430, 430], [470, 350], [520, 360], [560, 480],
      [660, 560], [680, 620], [640, 720], [600, 800], [520, 880], [440, 930], [320, 960], [230, 968], [60, 962], [20, 900], [20, 760]],
      [[55, 0], [205, 0], [205, 730], [55, 730]]],
    corridors: [[[62, 0], [198, 0], [198, 715], [62, 715]]],
    holes: [{ e: [395, 690, 55, 32] }, { e: [488, 648, 34, 30] }],
    npcs: [{ id: 'camp', x: 485, y: 655, name: 'Rui e Lina', hidden: true }],
    items: [{ id: 'c_c1', k: 'moeda', x: 470, y: 900 }, { id: 'c_c2', k: 'moeda', x: 560, y: 520 }],
    doors: [], fire: { x: 395, y: 680 },
    start: [150, 900]
  }
};
const REGION_LIST = Object.keys(REGIONS).map(k => Object.assign(REGIONS[k], { id: k }));
const toWorld = (r, x, y) => [r.ox + x * IS, r.oy + y * IS];

const TRAILS = [
  [[495, 2300], [495, 2150], [1420, 2150], [1420, 2450], [2070, 2450], [2070, 2262]],
  [[2604, 1800], [2800, 1800], [2800, 1955], [3000, 1955]],
  [[4600, 675], [2800, 675], [2800, 1800]],
  [[3600, 3055], [3600, 3350], [5800, 3350], [5800, 2865], [6200, 2865]],
  [[4945, 2262], [4945, 3350]],
  [[5800, 2865], [5800, 1300], [6050, 1000], [6750, 900]],
  [[3600, 3350], [3600, 4000], [2750, 4000]],
  [[1420, 2150], [1150, 1600], [800, 950]]
];
const WATER = [
  [[1240, 2650], [1800, 2560], [2350, 2700], [2550, 3300], [2500, 4000], [2650, 4500], [0, 4500], [0, 4250], [1240, 4250]],
  [[7000, 2700], [7600, 2600], [7600, 4500], [6300, 4500], [6400, 3950], [6900, 3650], [6950, 3200]],
  Array.from({ length: 20 }, (_, i) => [4300 + Math.cos(i / 20 * 6.283) * 240, 3880 + Math.sin(i / 20 * 6.283) * 150])
];
// lugares notáveis no mapa grande
const LANDMARKS = [
  { name: 'Clareira dos Cogumelos', x: 800, y: 900 },
  { name: 'Praia', x: 2700, y: 3950 },
  { name: 'Lago', x: 7050, y: 3900 },
  { name: 'Bosque Norte', x: 6750, y: 900 },
  { name: 'Campos do Sul', x: 4700, y: 3950 }
];
const CAT_SPOT = [6800, 860];
const SPAWN_CLEAR = [];

// ---------------------------------------------------------------- terreno (0 grama, 1 trilha, 2 água, 3 areia)
let terrain = null;
function buildTerrain() {
  const c = document.createElement('canvas'); c.width = GC; c.height = GR;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, GC, GR);
  const path = p => { g.beginPath(); p.forEach(([x, y], i) => i ? g.lineTo(x / CELL, y / CELL) : g.moveTo(x / CELL, y / CELL)); };
  g.lineJoin = 'round'; g.lineCap = 'round';
  for (const w of WATER) { path(w); g.closePath(); g.strokeStyle = '#0000ff'; g.lineWidth = 70 / CELL; g.stroke(); }
  for (const w of WATER) { path(w); g.closePath(); g.fillStyle = '#ff0000'; g.fill(); }
  for (const t of TRAILS) { path(t); g.strokeStyle = '#00ff00'; g.lineWidth = 76 / CELL; g.stroke(); }
  const d = g.getImageData(0, 0, GC, GR).data;
  terrain = new Uint8Array(GC * GR);
  for (let i = 0; i < terrain.length; i++) {
    const r = d[i * 4], gg = d[i * 4 + 1], b = d[i * 4 + 2];
    terrain[i] = r > 127 ? 2 : gg > 127 ? 1 : b > 127 ? 3 : 0;
  }
}
function terrainAt(x, y) {
  const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
  if (cx < 0 || cy < 0 || cx >= GC || cy >= GR) return 0;
  return terrain[cy * GC + cx];
}
function regionAt(x, y, pad = 0) {
  for (const r of REGION_LIST) {
    if (x >= r.ox - pad && y >= r.oy - pad && x < r.ox + r.iw * IS + pad && y < r.oy + r.ih * IS + pad) return r;
  }
  return null;
}

// máscara local de cada ilustração (1/4 da resolução original)
function buildRegionMask(r, im) {
  const iw = im.naturalWidth, ih = im.naturalHeight, mw = Math.ceil(iw / 4), mh = Math.ceil(ih / 4);
  const c = document.createElement('canvas'); c.width = mw; c.height = mh;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, mw, mh);
  const poly = (p, col) => { g.fillStyle = col; g.beginPath(); p.forEach(([x, y], i) => i ? g.lineTo(x / 4, y / 4) : g.moveTo(x / 4, y / 4)); g.closePath(); g.fill(); };
  r.walk.forEach(p => poly(p, '#fff'));
  r.holes.forEach(h => {
    if (h.p) poly(h.p, '#000');
    else { g.fillStyle = '#000'; g.beginPath(); g.ellipse(h.e[0] / 4, h.e[1] / 4, h.e[2] / 4, h.e[3] / 4, 0, 0, Math.PI * 2); g.fill(); }
  });
  const d = g.getImageData(0, 0, mw, mh).data, m = new Uint8Array(mw * mh);
  for (let i = 0; i < m.length; i++) m[i] = d[i * 4] > 127 ? 1 : 0;
  r.iw = iw; r.ih = ih; r.mask = { w: mw, h: mh, m };
}
// borda esfumada para a ilustração se misturar ao campo
function featherImage(im) {
  const w = im.naturalWidth, h = im.naturalHeight, F = 64;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); g.drawImage(im, 0, 0);
  try {
    const id = g.getImageData(0, 0, w, h), d = id.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const e = Math.min(x, y, w - 1 - x, h - 1 - y);
      if (e >= F) continue;
      const wob = (hash2(x >> 3, y >> 3) - 0.5) * 18;
      let a = clamp((e + wob) / F, 0, 1); a = a * a * (3 - 2 * a);
      d[(y * w + x) * 4 + 3] = Math.round(a * 255);
    }
    g.putImageData(id, 0, 0);
  } catch (err) { /* sem acesso aos pixels: usa a imagem sem esfumar */ }
  return c;
}

// ---------------------------------------------------------------- grade andável do mundo
let worldGrid = null;
function buildWorldGrid() {
  const m = new Uint8Array(GC * GR);
  for (let cy = 0; cy < GR; cy++) for (let cx = 0; cx < GC; cx++) {
    const x = (cx + 0.5) * CELL, y = (cy + 0.5) * CELL;
    let v = 1;
    if (x < 150 || y < 150 || x > WW - 150 || y > WH - 150) v = 0;
    else {
      const r = regionAt(x, y);
      if (r) {
        const lx = (x - r.ox) / IS, ly = (y - r.oy) / IS, mk = r.mask;
        const mx = Math.floor(lx / 4), my = Math.floor(ly / 4);
        v = (mx >= 0 && my >= 0 && mx < mk.w && my < mk.h) ? mk.m[my * mk.w + mx] : 0;
      } else if (terrain[cy * GC + cx] === 2) v = 0;
    }
    m[cy * GC + cx] = v;
  }
  worldGrid = { cols: GC, rows: GR, cell: CELL, m };
}
function stampGrid(grid, x, y, rad, v) {
  const c = grid.cell, r = Math.ceil(rad / c);
  const gx = Math.floor(x / c), gy = Math.floor(y / c);
  for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
    const cx = gx + i, cy = gy + j;
    if (cx < 0 || cy < 0 || cx >= grid.cols || cy >= grid.rows) continue;
    if ((i * c) ** 2 + (j * c * 1.6) ** 2 <= rad * rad) grid.m[cy * grid.cols + cx] = v;
  }
}

// ---------------------------------------------------------------- props: árvores, rochas, capim, flores, cogumelos
const BUCKET = 512, BC = Math.ceil(WW / BUCKET), BR = Math.ceil(WH / BUCKET);
let buckets = [];
const props = [];
function addProp(p) { props.push(p); }
function entrancePoints() {
  const pts = [];
  for (const t of TRAILS) { pts.push(t[0]); pts.push(t[t.length - 1]); }
  return pts;
}
function clearOf(x, y, rad, types) {
  for (let a = 0; a < 8; a++) {
    const t = terrainAt(x + Math.cos(a * 0.785) * rad, y + Math.sin(a * 0.785) * rad);
    if (types.includes(t)) return false;
  }
  return !types.includes(terrainAt(x, y));
}
function placeProps() {
  const R = mulberry(20261116);
  const ents = entrancePoints();
  const nearEnt = (x, y, d) => ents.some(([ex, ey]) => Math.hypot(ex - x, ey - y) < d);
  const okTree = (x, y) => x > 60 && y > 120 && x < WW - 60 && y < WH - 40 && !regionAt(x, y, 24) &&
    clearOf(x, y, 64, [1, 2, 3]) && !nearEnt(x, y, 180) && Math.hypot(x - CAT_SPOT[0], y - CAT_SPOT[1]) > 230;
  const tree = (x, y) => {
    let kind = R();
    let idx = y < 1300 && R() < 0.6 ? 5 + Math.floor(R() * 2) : Math.floor(kind * 5);
    if (x > 5600 && R() < 0.4) idx = 3;
    addProp({ t: 'tree', x, y, img: TREE_IMGS[idx].img, stock: 3, regrow: 0, shake: 0, s: 4 + (R() < 0.2 ? 0.6 : 0) });
  };
  // floresta: manchas de ruído + borda densa
  for (let y = 60; y < WH; y += 104) for (let x = 40; x < WW; x += 96) {
    const jx = x + (R() - 0.5) * 70, jy = y + (R() - 0.5) * 60;
    const edge = Math.min(jx, jy, WW - jx, WH - jy);
    let n = vnoise(jx * 0.0014, jy * 0.0014) + (edge < 380 ? 0.55 : 0) + (vnoise(jx * 0.006, jy * 0.006) - 0.5) * 0.25;
    if ((n > 0.62 || R() < 0.06) && okTree(jx, jy)) tree(jx, jy);
  }
  // árvores coladas às ilustrações (escondem as emendas)
  for (const r of REGION_LIST) {
    const x0 = r.ox, y0 = r.oy, x1 = r.ox + r.iw * IS, y1 = r.oy + r.ih * IS;
    const per = [];
    for (let x = x0; x <= x1; x += 110) { per.push([x, y0 - 4]); per.push([x, y1 + 70]); }
    for (let y = y0 + 80; y <= y1; y += 120) { per.push([x0 - 40, y]); per.push([x1 + 40, y]); }
    for (const [px, py] of per) {
      const x = px + (R() - 0.5) * 30, y = py + R() * 30;
      if (R() < 0.75 && !regionAt(x, y, 0) && clearOf(x, y, 60, [1, 2, 3]) && !nearEnt(x, y, 200)) tree(x, y);
    }
  }
  const meadow = (x, y, pad) => x > 200 && y > 200 && x < WW - 200 && y < WH - 200 && !regionAt(x, y, pad) && clearOf(x, y, 30, [1, 2, 3]);
  const farFromTrees = (x, y, d) => !props.some(p => p.t === 'tree' && Math.abs(p.x - x) < d && Math.abs(p.y - y) < d * 0.7);
  for (let i = 0; i < 170; i++) {
    const x = R() * WW, y = R() * WH;
    if (!meadow(x, y, 40) || !farFromTrees(x, y, 70)) continue;
    const crystal = (x > 5400 && R() < 0.5) || (Math.hypot(x - CAT_SPOT[0], y - CAT_SPOT[1]) < 900 && R() < 0.6);
    addProp({ t: 'rock', x, y, img: crystal ? ROCK_IMGS[2] : ROCK_IMGS[Math.floor(R() * 2)], crystal, stock: crystal ? 2 : 3, regrow: 0, shake: 0 });
  }
  for (let i = 0; i < 520; i++) {
    const x = R() * WW, y = R() * WH;
    if (meadow(x, y, 10) && farFromTrees(x, y, 40)) addProp({ t: 'tuft', x, y, gone: 0, ph: R() * 6 });
  }
  const FC = ['#ff9ec7', '#ffe066', '#ffffff', '#b59cff', '#ff7a5a'];
  for (let i = 0; i < 300; i++) {
    const x = R() * WW, y = R() * WH;
    if (meadow(x, y, 10) && farFromTrees(x, y, 40)) addProp({ t: 'flower', x, y, gone: 0, col: FC[Math.floor(R() * FC.length)] });
  }
  for (let i = 0; i < 900; i++) {
    const x = i % 3 === 0 ? 800 + (R() - 0.5) * 1300 : R() * WW, y = i % 3 === 0 ? 950 + (R() - 0.5) * 1000 : R() * WH;
    if (!meadow(x, y, 20)) continue;
    if (!props.some(p => p.t === 'tree' && Math.hypot(p.x - x, p.y - y) < 150)) continue;
    if (props.filter(p => p.t === 'mush').length > 120) break;
    addProp({ t: 'mush', x, y, gone: 0 });
  }
  // colisão de troncos e rochas
  for (const p of props) {
    if (p.t === 'tree') stampGrid(worldGrid, p.x, p.y - 6, 20, 0);
    if (p.t === 'rock') stampGrid(worldGrid, p.x, p.y - 8, 30, 0);
  }
  buckets = Array.from({ length: BC * BR }, () => []);
  for (const p of props) {
    const bx = clamp(Math.floor(p.x / BUCKET), 0, BC - 1), by = clamp(Math.floor(p.y / BUCKET), 0, BR - 1);
    buckets[by * BC + bx].push(p);
  }
}
function propsNear(x0, y0, x1, y1) {
  const out = [];
  const bx0 = clamp(Math.floor(x0 / BUCKET), 0, BC - 1), bx1 = clamp(Math.floor(x1 / BUCKET), 0, BC - 1);
  const by0 = clamp(Math.floor(y0 / BUCKET), 0, BR - 1), by1 = clamp(Math.floor(y1 / BUCKET), 0, BR - 1);
  for (let by = by0; by <= by1; by++) for (let bx = bx0; bx <= bx1; bx++) for (const p of buckets[by * BC + bx]) {
    if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1) out.push(p);
  }
  return out;
}

// ---------------------------------------------------------------- chão em pedaços (cache)
const CH = 512, CHR = 2;   // pedaço de 512px de mundo desenhado em meia resolução
const chunkCache = new Map();
function groundRGB(wx, wy) {
  const jx = (vnoise(wx * 0.02, wy * 0.02) - 0.5) * 30, jy = (vnoise(wx * 0.02 + 50, wy * 0.02) - 0.5) * 30;
  const t = terrainAt(wx + jx, wy + jy);
  const n = vnoise(wx * 0.005, wy * 0.005) * 0.65 + vnoise(wx * 0.03, wy * 0.03) * 0.35;
  const h = hash2(wx >> 2, wy >> 2);
  const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  if (t === 2) {
    if (h < 0.015) return [170, 222, 245];
    return mix([40, 118, 176], [64, 158, 210], n);
  }
  if (t === 3) return h < 0.05 ? [200, 180, 120] : mix([214, 192, 132], [232, 214, 158], n);
  if (t === 1) {
    if (h < 0.05) return [150, 118, 78];
    const e = terrainAt(wx + jx + 14, wy + jy) !== 1 || terrainAt(wx + jx - 14, wy + jy) !== 1 || terrainAt(wx + jx, wy + jy + 14) !== 1 || terrainAt(wx + jx, wy + jy - 14) !== 1;
    return e ? [160, 126, 80] : mix([178, 140, 88], [204, 168, 112], n);
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
    const wx = cx * CH + x * CHR, wy = cy * CH + y * CHR;
    const [r, gg, b] = groundRGB(wx, wy);
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
      const k = ((y + j) * S2 + x + i) * 4; d[k] = r; d[k + 1] = gg; d[k + 2] = b; d[k + 3] = 255;
    }
  }
  g.putImageData(id, 0, 0);
  chunkCache.set(key, c);
  while (chunkCache.size > 70) chunkCache.delete(chunkCache.keys().next().value);
  return c;
}
// textura de terra para as trilhas que entram nas ilustrações
const DIRT = pixelCanvas(32, 32, g => {
  for (let y = 0; y < 32; y += 2) for (let x = 0; x < 32; x += 2) {
    const h = hash2(x + 900, y + 300), n = vnoise(x * 0.15, y * 0.15);
    g.fillStyle = h < 0.08 ? '#97764e' : n > 0.55 ? '#cca870' : '#b99459';
    g.fillRect(x, y, 2, 2);
  }
});

// ---------------------------------------------------------------- interiores
const TILE = 48;
const INTERIORS = {
  oficina: { name: 'Oficina do Bruno', w: 12, h: 8, floor: 'stone', wall: 'stone',
    furn: [{ t: 'forge', x: 1, y: 0, w: 2, h: 2 }, { t: 'shelf', x: 8, y: 0, w: 2, h: 2 }, { t: 'window', x: 5, y: 0, w: 1, h: 2 },
      { t: 'anvil', x: 3, y: 3, w: 1, h: 1, block: 1 }, { t: 'bancada', x: 8, y: 3, w: 2, h: 1, block: 1, use: 'bancada' },
      { t: 'barrel', x: 10, y: 5, w: 1, h: 1, block: 1 }, { t: 'barrel', x: 10, y: 6, w: 1, h: 1, block: 1 }, { t: 'rug', x: 4, y: 5, w: 3, h: 2 }],
    npcs: [{ id: 'bruno', x: 5.5, y: 4.2, name: 'Bruno' }] },
  casaTeo: { name: 'Casa do Téo', w: 10, h: 7, floor: 'wood', wall: 'wood',
    furn: [{ t: 'window', x: 2, y: 0, w: 1, h: 2 }, { t: 'shelf', x: 6, y: 0, w: 2, h: 2 }, { t: 'window', x: 8, y: 0, w: 1, h: 2 },
      { t: 'bed', x: 1, y: 2, w: 1, h: 2, block: 1, col: '#4f7fbf' }, { t: 'rug', x: 3, y: 4, w: 3, h: 2 },
      { t: 'table', x: 6, y: 3, w: 2, h: 1, block: 1 }, { t: 'plant', x: 8, y: 2, w: 1, h: 1, block: 1 }, { t: 'catbed', x: 8, y: 5, w: 1, h: 1 }],
    npcs: [{ id: 'teo', x: 4.5, y: 3.4, name: 'Téo' }] },
  casaAurora: { name: 'Casa da Vó Aurora', w: 10, h: 7, floor: 'wood', wall: 'wood',
    furn: [{ t: 'shelf', x: 1, y: 0, w: 2, h: 2 }, { t: 'fireplace', x: 4, y: 0, w: 2, h: 2 }, { t: 'window', x: 7, y: 0, w: 1, h: 2 },
      { t: 'bed', x: 8, y: 2, w: 1, h: 2, block: 1, col: '#7b5aa6', use: 'bed' }, { t: 'rug', x: 3, y: 3, w: 4, h: 2 },
      { t: 'table', x: 1, y: 4, w: 2, h: 1, block: 1 }, { t: 'plant', x: 1, y: 2, w: 1, h: 1, block: 1 }, { t: 'chest', x: 8, y: 5, w: 1, h: 1, block: 1, use: 'chest', id: 'ch_aurora' }],
    npcs: [] },
  padaria: { name: 'Padaria da Rosa', w: 12, h: 8, floor: 'wood', wall: 'brick',
    furn: [{ t: 'oven', x: 1, y: 0, w: 2, h: 2 }, { t: 'window', x: 5, y: 0, w: 1, h: 2 }, { t: 'shelf', x: 8, y: 0, w: 3, h: 2, bread: 1 },
      { t: 'counter', x: 3, y: 3, w: 5, h: 1, block: 1 }, { t: 'sack', x: 10, y: 3, w: 1, h: 1, block: 1 }, { t: 'sack', x: 10, y: 4, w: 1, h: 1, block: 1 },
      { t: 'table', x: 2, y: 5, w: 2, h: 1, block: 1 }, { t: 'table', x: 7, y: 5, w: 2, h: 1, block: 1 }],
    npcs: [{ id: 'rosa', x: 5.5, y: 2.55, name: 'Rosa' }] },
  casaMel: { name: 'Casa da Mel', w: 10, h: 7, floor: 'wood', wall: 'wood',
    furn: [{ t: 'window', x: 2, y: 0, w: 1, h: 2 }, { t: 'flowers', x: 4, y: 0, w: 3, h: 2 }, { t: 'window', x: 8, y: 0, w: 1, h: 2 },
      { t: 'bed', x: 1, y: 2, w: 1, h: 2, block: 1, col: '#e86a9a' }, { t: 'loom', x: 5, y: 2, w: 2, h: 1, block: 1 },
      { t: 'rug', x: 3, y: 4, w: 3, h: 2 }, { t: 'plant', x: 8, y: 2, w: 1, h: 1, block: 1 }, { t: 'chest', x: 8, y: 5, w: 1, h: 1, block: 1, use: 'chest', id: 'ch_mel' }],
    npcs: [] }
};
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
