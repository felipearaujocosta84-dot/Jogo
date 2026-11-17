/* Vale da Lanterna — mundo infinito: biomas, estradas, cidades grandes e geração em pedaços (chunks). */
'use strict';

const CK = 512, CCELLS = CK / CELL;
let frameNo = 0;
const BIOME_NAMES = { campo: 'Campos Abertos', floresta: 'Mata Fechada', outono: 'Floresta Outonal', deserto: 'Deserto de Âmbar',
  neve: 'Tundra Gelada', pantano: 'Pântano Sombrio', cerejeiras: 'Bosque das Cerejeiras' };
const inVale = (x, y) => x >= 0 && y >= 0 && x < WW && y < WH;
const valeDist = (x, y) => Math.hypot(Math.max(-x, 0, x - WW), Math.max(-y, 0, y - WH));
const smoothstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const stretch = v => clamp((v - 0.5) * 2 + 0.5, 0, 1);

function biomeAt(x, y) {
  if (valeDist(x, y) < 1800) return 'campo';
  const t = stretch(vnoise(x / 7000 + 11, y / 7000 - 11) * 0.75 + vnoise(x / 2600 + 3, y / 2600 - 3) * 0.25);
  const m = stretch(vnoise(x / 6000 + 37, y / 6000 - 37) * 0.75 + vnoise(x / 2300 + 7, y / 2300 - 7) * 0.25);
  if (t < 0.3) return 'neve';
  if (t > 0.68 && m < 0.52) return 'deserto';
  if (m > 0.66 && t > 0.42) return 'pantano';
  if (t < 0.43) return 'outono';
  if (m > 0.57) return 'floresta';
  if (m < 0.36) return 'cerejeiras';
  return 'campo';
}

// ---------------------------------------------------------------- cidades e estradas
const CITY_S = 9000, RX0 = 4700, RY0 = 2150;
const CITY_A = ['Pedra', 'Porto', 'Monte', 'Campo', 'Ponte', 'Serra', 'Lago', 'Forte', 'Vila', 'Rocha', 'Vento', 'Ouro'];
const CITY_B = ['Alta', 'Serena', 'Dourada', 'Nova', 'Velha', 'Clara', 'Verde', 'do Sol', 'da Lua', 'das Flores', 'Bela', 'dos Ventos'];
const cityCache = new Map();
function cityAt(i, j) {
  if (i === 0 && j === 0) return null;
  const k = i * 100003 + j;
  if (cityCache.has(k)) return cityCache.get(k);
  let c = null;
  if (hash2(i * 31 + 500, j * 17 - 300) < 0.82 || Math.abs(i) + Math.abs(j) === 1) {
    const x = RX0 + i * CITY_S, y = RY0 + j * CITY_S;
    const R = [1500, 1900, 2300][Math.floor(hash2(i * 3 + 9, j * 5 + 2) * 3)];
    c = { i, j, x, y, R, key: i + '_' + j, biome: biomeAt(x, y), props: null,
      name: CITY_A[Math.floor(hash2(i * 13 + 1, j * 7 + 5) * 12)] + ' ' + CITY_B[Math.floor(hash2(i + 77, j - 77) * 12)] };
  }
  cityCache.set(k, c);
  return c;
}
const cellOf = (x, y) => [Math.round((x - RX0) / CITY_S), Math.round((y - RY0) / CITY_S)];
function nearestCity(x, y) { const [i, j] = cellOf(x, y); return cityAt(i, j); }
function inCity(x, y, pad = 0) { const c = nearestCity(x, y); return c && Math.hypot(x - c.x, y - c.y) < c.R + pad ? c : null; }
function roadHY(j, x) {
  const base = RY0 + j * CITY_S;
  const di = Math.abs(x - (RX0 + Math.round((x - RX0) / CITY_S) * CITY_S));
  const f = smoothstep(2400, 3700, di) * smoothstep(300, 1800, valeDist(x, base));
  return base + (Math.sin(x / 1150 + j * 1.7) * 280 + Math.sin(x / 470 + j) * 50) * f;
}
function roadVX(i, y) {
  const base = RX0 + i * CITY_S;
  const dj = Math.abs(y - (RY0 + Math.round((y - RY0) / CITY_S) * CITY_S));
  const f = smoothstep(2400, 3700, dj) * smoothstep(300, 1800, valeDist(base, y));
  return base + (Math.sin(y / 1200 + i * 2.3) * 280 + Math.sin(y / 500 + i) * 50) * f;
}
function onRoad(x, y) {
  const j = Math.round((y - RY0) / CITY_S);
  if (Math.abs(y - roadHY(j, x)) < 38) return true;
  const i = Math.round((x - RX0) / CITY_S);
  return Math.abs(x - roadVX(i, y)) < 38;
}

// ---------------------------------------------------------------- terreno gerado
// códigos novos: 9 gelo (andável), 13 gramado/calçada de cidade, 14 muralha
function terrainProc(x, y) {
  const vd = valeDist(x, y);
  if (vd < 1700) {
    const qx = clamp(x, 0, WW - 1), qy = clamp(y, 0, WH - 1), vt = valeTer[Math.floor(qy / CELL) * GC + Math.floor(qx / CELL)];
    if (vt === 2 || vt === 6 || vt === 3) {
      const lim = 1000 + vnoise(x / 500 + 5, y / 500) * 700;
      if (vd < lim - 90) return onRoad(x, y) ? 7 : 2;
      if (vd < lim) return 3;
    }
  }
  const c = nearestCity(x, y);
  let dc = 1e9;
  if (c) {
    dc = Math.hypot(x - c.x, y - c.y);
    if (dc < c.R) {
      if (dc > c.R - 44) return (Math.abs(x - c.x) < 70 || Math.abs(y - c.y) < 70) ? 4 : 14;
      if (dc < 340) return 4;
      const mx = mod(x - c.x, 400), my = mod(y - c.y, 400);
      return (mx < 40 || mx > 360 || my < 40 || my > 360) ? 4 : 13;
    }
  }
  const road = onRoad(x, y);
  const b = biomeAt(x, y);
  const e = vnoise(x / 2400 + 71, y / 2400 - 71) * 0.65 + vnoise(x / 800 + 13, y / 800 - 13) * 0.35;
  const wl = b === 'pantano' ? 0.38 : b === 'deserto' ? 0.24 : 0.3;
  if (!c || dc > c.R + 300) {
    if (e < wl) return road ? 7 : (b === 'neve' ? 9 : 2);
    if (road) return 1;
    if (e < wl + 0.025 && b !== 'neve' && b !== 'pantano') return 3;
    if (e > 0.74 && vd > 2000) return 6;
    return 0;
  }
  return road ? 1 : 0;
}

// ---------------------------------------------------------------- pedaços do mundo
const chunkData = new Map();
function getCD(cx, cy) {
  const k = cx * 100003 + cy;
  let d = chunkData.get(k);
  if (!d) {
    d = { cx, cy, ter: new Uint8Array(CCELLS * CCELLS), grid: null, props: null, used: 0 };
    for (let j = 0; j < CCELLS; j++) for (let i = 0; i < CCELLS; i++) {
      const x = cx * CK + (i + 0.5) * CELL, y = cy * CK + (j + 0.5) * CELL;
      d.ter[j * CCELLS + i] = inVale(x, y) ? valeTer[Math.floor(y / CELL) * GC + Math.floor(x / CELL)] : terrainProc(x, y);
    }
    chunkData.set(k, d);
    if (chunkData.size > 700) {
      const arr = [...chunkData.entries()].sort((a, b) => a[1].used - b[1].used);
      for (let i = 0; i < arr.length - 450; i++) chunkData.delete(arr[i][0]);
    }
  }
  d.used = frameNo;
  return d;
}
const TUFT_COL = { campo: ['#2f6b2a', '#8fd36a'], floresta: ['#1f4f2c', '#5fae4a'], outono: ['#7a4a1a', '#e8a040'], deserto: ['#8a7a3a', '#d8c070'],
  neve: ['#7a90a8', '#eef4fa'], pantano: ['#2a4a2a', '#7a9a4a'], cerejeiras: ['#2f6b2a', '#ffb7d0'] };
const DENS = { campo: 0.1, floresta: 0.55, outono: 0.42, deserto: 0.05, neve: 0.3, pantano: 0.3, cerejeiras: 0.36 };
function treeProp(x, y, b, r) {
  const set = TREE_SETS[b] || TREE_SETS.campo;
  return { t: 'tree', x, y, img: set[Math.floor(r * set.length) % set.length], stock: 3, regrow: 0, shake: 0, s: 4 + (r > 0.8 ? 0.6 : 0) };
}
function onlyGround(x, y, rad) {
  if (terrainAt(x, y) !== 0) return false;
  for (let a = 0; a < 8; a++) if (terrainAt(x + Math.cos(a * 0.785) * rad, y + Math.sin(a * 0.785) * rad) !== 0) return false;
  return true;
}
function chunkProps(cx, cy) {
  const d = getCD(cx, cy);
  if (d.props) return d.props;
  const P = d.props = [];
  const x0 = cx * CK, y0 = cy * CK;
  const c = nearestCity(x0 + CK / 2, y0 + CK / 2);
  if (c && Math.hypot(x0 + CK / 2 - c.x, y0 + CK / 2 - c.y) < c.R + 900) {
    cityLayout(c);
    for (const p of c.props) if (p.x >= x0 && p.x < x0 + CK && p.y >= y0 && p.y < y0 + CK) P.push(p);
  }
  const R = mulberry(((cx * 73856093) ^ (cy * 19349663) ^ 0x5bd1e995) >>> 0);
  for (let k = 0; k < 30; k++) {
    const x = x0 + R() * CK, y = y0 + R() * CK, roll = R(), roll2 = R();
    if (inVale(x, y) || inCity(x, y, 160)) continue;
    const t = terrainAt(x, y), b = biomeAt(x, y);
    if (t === 3 && b === 'deserto' && roll < 0.12) { P.push(treeProp(x, y, 'deserto', 0.99)); continue; }
    if (t !== 0) continue;
    const dens = DENS[b];
    if (roll < dens) { if (onlyGround(x, y, 58)) P.push(treeProp(x, y, b, roll2)); continue; }
    const r2 = (roll - dens) / (1 - dens);
    if (r2 < 0.06) {
      if (!onlyGround(x, y, 40)) continue;
      const cr = roll2 < ({ neve: 0.4, deserto: 0.3 }[b] || 0.12);
      const img = cr ? (b === 'neve' ? ROCK_ICE : ROCK_IMGS[2]) : b === 'deserto' ? ROCK_SAND : b === 'neve' ? ROCK_SNOW : ROCK_IMGS[Math.floor(roll2 * 2)];
      P.push({ t: 'rock', x, y, img, crystal: cr, stock: cr ? 2 : 3, regrow: 0, shake: 0 });
    } else if (r2 < 0.32) P.push({ t: 'tuft', x, y, gone: 0, ph: roll2 * 6, tc: TUFT_COL[b] });
    else if (r2 < 0.44 && b !== 'neve' && b !== 'deserto') P.push({ t: 'flower', x, y, gone: 0, col: b === 'cerejeiras' ? '#ffb7d0' : FLOWER_COLS[Math.floor(roll2 * 5)] });
    else if (r2 < 0.52 && (b === 'pantano' || b === 'floresta' || b === 'outono')) P.push({ t: 'mush', x, y, gone: 0 });
    else if (r2 < 0.58 && b !== 'deserto' && b !== 'neve') P.push({ t: 'bush', x, y, img: BUSH_IMGS[Math.floor(roll2 * BUSH_IMGS.length)], s: 3.5 + roll2 * 1.5 });
  }
  return P;
}
function localSet(g, cx, cy, x, y, v) {
  const i = Math.floor((x - cx * CK) / CELL), j = Math.floor((y - cy * CK) / CELL);
  if (i < 0 || j < 0 || i >= CCELLS || j >= CCELLS || inVale(x, y)) return;
  g[j * CCELLS + i] = v;
}
function stampProp(g, cx, cy, p) {
  const circ = (x, y, rad) => { const r = Math.ceil(rad / CELL); for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if ((i * CELL) ** 2 + (j * CELL * 1.6) ** 2 <= rad * rad) localSet(g, cx, cy, x + i * CELL, y + j * CELL, 0); };
  if (p.t === 'tree') circ(p.x, p.y - 6, 20);
  else if (p.t === 'rock' && p.stock > 0) circ(p.x, p.y - 8, 30);
  else if (p.t === 'bld' && p.col) for (const [x0, y0, x1, y1] of p.col) { for (let y = y0; y < y1; y += CELL) for (let x = x0; x < x1; x += CELL) localSet(g, cx, cy, x, y, 0); }
  else if (p.t === 'deco' && p.block) circ(p.x, p.y - 6, p.block);
}
function chunkGrid(cx, cy) {
  const d = getCD(cx, cy);
  if (d.grid) return d.grid;
  const g = new Uint8Array(CCELLS * CCELLS);
  for (let j = 0; j < CCELLS; j++) for (let i = 0; i < CCELLS; i++) {
    const x = cx * CK + (i + 0.5) * CELL, y = cy * CK + (j + 0.5) * CELL;
    if (inVale(x, y)) g[j * CCELLS + i] = valeGrid.m[Math.floor(y / CELL) * GC + Math.floor(x / CELL)];
    else { const t = d.ter[j * CCELLS + i]; g[j * CCELLS + i] = (t === 2 || t === 6 || t === 14) ? 0 : 1; }
  }
  d.grid = g;
  for (let ny = -1; ny <= 1; ny++) for (let nx = -1; nx <= 1; nx++) for (const p of chunkProps(cx + nx, cy + ny)) stampProp(g, cx, cy, p);
  return g;
}
function worldWalk(x, y) {
  const cx = Math.floor(x / CK), cy = Math.floor(y / CK), g = chunkGrid(cx, cy);
  return g[Math.floor((y - cy * CK) / CELL) * CCELLS + Math.floor((x - cx * CK) / CELL)] === 1;
}
function worldSetCell(x, y, v) {
  if (inVale(x, y)) valeGrid.m[Math.floor(y / CELL) * GC + Math.floor(x / CELL)] = v;
  const cx = Math.floor(x / CK), cy = Math.floor(y / CK), d = chunkData.get(cx * 100003 + cy);
  if (d && d.grid) d.grid[Math.floor((y - cy * CK) / CELL) * CCELLS + Math.floor((x - cx * CK) / CELL)] = v;
}

// ---------------------------------------------------------------- planta das cidades
const CITY_STYLE = {
  campo: { roofs: ['red', 'blue', 'brown', 'orange', 'teal'], walls: ['plaster', 'wood', 'stone'] },
  floresta: { roofs: ['brown', 'teal', 'slate'], walls: ['wood', 'stone'] },
  outono: { roofs: ['red', 'orange', 'brown'], walls: ['plaster', 'wood'] },
  deserto: { roofs: ['orange', 'brown'], walls: ['adobe'] },
  neve: { roofs: ['slate', 'blue', 'red'], walls: ['stone', 'wood'], snow: true },
  pantano: { roofs: ['teal', 'brown', 'slate'], walls: ['wood'] },
  cerejeiras: { roofs: ['pink', 'red', 'purple'], walls: ['plaster'] }
};
const DYN = new Map();   // interiores das cidades: id -> { kind, city, door, seed }
function cityLayout(c) {
  if (c.props) return;
  const R = mulberry(Math.abs(c.i * 92821 + c.j * 68917) + 11);
  const st = CITY_STYLE[c.biome] || CITY_STYLE.campo;
  c.props = []; c.doors = []; c.streets = [];
  const n = Math.ceil(c.R / 400);
  const blocks = [];
  for (let by = -n; by < n; by++) for (let bx = -n; bx < n; bx++) {
    const x = c.x + bx * 400 + 200, y = c.y + by * 400 + 200, d = Math.hypot(x - c.x, y - c.y);
    if (d > c.R - 270 || d < 470) continue;
    blocks.push({ x, y, d, by });
  }
  blocks.sort((a, b) => a.d - b.d || a.x - b.x);
  const addBld = (o, enter) => {
    o.sc = o.kind === 'house' || o.kind === 'tower' ? 5 : SC;
    const s = o.kind === 'house' ? makeHouse(o, Math.floor(R() * 1e6)) : o.kind === 'tower' ? makeTower() : makeSmall(o.kind);
    o.img = s.img; o.pw = s.w * o.sc; o.ph = s.h * o.sc;
    if (o.chimneyPos) o.smoke = [o.x - o.pw / 2 + o.chimneyPos[0] * o.sc, o.y - o.ph + 4];
    let col;
    if (o.kind === 'house') col = [[o.x - o.pw / 2 + 16, o.y - s.foot * o.sc, o.x + o.pw / 2 - 16, o.y - 10]];
    else if (o.kind === 'tower') col = [[o.x - o.pw * 0.36, o.y - o.ph * 0.3, o.x + o.pw * 0.36, o.y - 8]];
    else if (o.kind === 'fountain') col = [[o.x - 120, o.y - 90, o.x + 120, o.y - 8]];
    else col = [[o.x - o.pw * 0.45, o.y - o.ph * 0.6, o.x + o.pw * 0.45, o.y - 8]];
    c.props.push({ t: 'bld', x: o.x, y: o.y, b: o, col });
    if (enter) {
      const id = 'c' + c.key + '_' + c.doors.length;
      o.to = id;
      c.doors.push({ x: o.x, y: o.y + 14, to: id });
      DYN.set(id, { kind: enter, city: c, door: [o.x, o.y + 14], seed: Math.floor(R() * 1e6), price: 600 + Math.floor(R() * 5) * 100 });
    }
  };
  const deco2 = (d, x, y, extra) => c.props.push(Object.assign({ t: 'deco', d, x, y, seed: Math.floor(x * 7 + y * 13) }, extra || {}));
  const specials = [['loja', 'bag'], ['estalagem', 'inn'], ['ferreiro', 'anvil']];
  blocks.forEach((bk, idx) => {
    let kind = idx < 3 ? 'special' : null;
    const roll = R();
    if (!kind) kind = roll < 0.64 ? 'house' : roll < 0.77 ? 'park' : roll < 0.87 ? 'market' : (roll < 0.92 && !c.hasTower) ? 'tower' : 'garden';
    const pick = a => a[Math.floor(R() * a.length)];
    if (kind === 'special' || kind === 'house') {
      const sp = kind === 'special' ? specials[idx] : null;
      const o = { kind: 'house', x: bk.x + Math.round((R() - 0.5) * 20), y: bk.y + 150, w: sp ? 66 : 52 + Math.floor(R() * 4) * 4,
        roof: pick(st.roofs), wall: pick(st.walls), chimney: R() < 0.6, snow: !!st.snow, sign: sp ? sp[1] : null };
      const rr = R();
      addBld(o, sp ? sp[0] : (rr < 0.4 ? 'casa' : rr < 0.55 ? 'venda' : null));
      if (R() < 0.5) deco2(pick(['barrel', 'crate', 'flowerbed']), bk.x + (R() < 0.5 ? -130 : 130), bk.y + 168, { block: 14 });
    } else if (kind === 'tower') {
      c.hasTower = true;
      addBld({ kind: 'tower', x: bk.x, y: bk.y + 150 });
    } else if (kind === 'park') {
      for (let k = 0; k < 4; k++) {
        const x = bk.x + (R() - 0.5) * 240, y = bk.y + (R() - 0.5) * 220 + 40;
        c.props.push(treeProp(x, y, c.biome === 'deserto' ? 'deserto' : c.biome, R()));
      }
      deco2('bench', bk.x, bk.y + 40); deco2('flowerbed', bk.x + 90, bk.y - 60);
    } else if (kind === 'market') {
      deco2('stall', bk.x - 80, bk.y + 20, { block: 30, col: pick(['#c8423b', '#4f7fbf', '#5fa65a', '#e0a020']) });
      deco2('stall', bk.x + 90, bk.y + 120, { block: 30, col: pick(['#c8423b', '#4f7fbf', '#5fa65a', '#e0a020']) });
      deco2('crate', bk.x + 110, bk.y - 60, { block: 18 }); deco2('barrel', bk.x - 120, bk.y + 140, { block: 18 });
    } else {
      deco2('flowerbed', bk.x - 60, bk.y); deco2('flowerbed', bk.x + 70, bk.y + 90); deco2('lamp', bk.x, bk.y - 80, { block: 12 });
    }
  });
  addBld({ kind: 'fountain', x: c.x, y: c.y + 60 });
  for (const [dx, dy] of [[-200, -200], [200, -200], [-200, 200], [200, 200]]) deco2('lamp', c.x + dx, c.y + dy, { block: 12 });
  for (const [dx, dy] of [[-150, 170], [150, 170]]) deco2('bench', c.x + dx, c.y + dy);
  for (let a = -n; a <= n; a++) for (let b = -n; b <= n; b++) {
    const ix = c.x + a * 400, iy = c.y + b * 400, d = Math.hypot(ix - c.x, iy - c.y);
    if (d < c.R - 160) c.streets.push([ix, iy]);
    if (d > 380 && d < c.R - 160 && (a + b) % 2 === 0) deco2('lamp', ix + 54, iy + 60, { block: 12 });
  }
  deco2('sign', c.x + 110, c.y + c.R - 60, { text: c.name, block: 8 });
  deco2('sign', c.x - 110, c.y - c.R + 120, { text: c.name, block: 8 });
}

// ---------------------------------------------------------------- interiores das cidades
function ensureInterior(id) {
  if (INTERIORS[id] && INTERIORS[id].canvas) return INTERIORS[id];
  const m = DYN.get(id); if (!m) return null;
  const c = m.city, R = mulberry(m.seed), npcId = 'n_' + id;
  NPC[npcId] = makePerson(m.seed);
  let def;
  if (m.kind === 'loja') def = { name: 'Mercado de ' + c.name, w: 12, h: 8, floor: 'wood', wall: 'wood',
    furn: [{ t: 'shelf', x: 1, y: 0, w: 3, h: 2 }, { t: 'window', x: 5, y: 0, w: 1, h: 2 }, { t: 'shelf', x: 8, y: 0, w: 3, h: 2, bread: 1 },
      { t: 'counter', x: 3, y: 3, w: 5, h: 1, block: 1 }, { t: 'barrel', x: 10, y: 5, w: 1, h: 1, block: 1 }, { t: 'sack', x: 1, y: 5, w: 1, h: 1, block: 1 }, { t: 'sack', x: 1, y: 6, w: 1, h: 1, block: 1 }],
    npcs: [{ id: npcId, x: 5.5, y: 2.55, name: 'Mercador', role: 'loja' }] };
  else if (m.kind === 'estalagem') def = { name: 'Estalagem de ' + c.name, w: 12, h: 8, floor: 'wood', wall: 'brick',
    furn: [{ t: 'fireplace', x: 1, y: 0, w: 2, h: 2 }, { t: 'window', x: 4, y: 0, w: 1, h: 2 }, { t: 'window', x: 7, y: 0, w: 1, h: 2 }, { t: 'shelf', x: 9, y: 0, w: 2, h: 2 },
      { t: 'bed', x: 1, y: 3, w: 1, h: 2, block: 1, col: '#c8423b', use: 'bed' }, { t: 'bed', x: 3, y: 3, w: 1, h: 2, block: 1, col: '#4f7fbf', use: 'bed' },
      { t: 'table', x: 6, y: 4, w: 2, h: 1, block: 1 }, { t: 'table', x: 9, y: 4, w: 2, h: 1, block: 1 }, { t: 'barrel', x: 10, y: 6, w: 1, h: 1, block: 1 }, { t: 'rug', x: 5, y: 6, w: 3, h: 1 }],
    npcs: [{ id: npcId, x: 8, y: 2.8, name: 'Estalajadeira', role: 'estalagem' }] };
  else if (m.kind === 'ferreiro') def = { name: 'Ferreiro de ' + c.name, w: 12, h: 8, floor: 'stone', wall: 'stone',
    furn: [{ t: 'forge', x: 1, y: 0, w: 2, h: 2 }, { t: 'shelf', x: 8, y: 0, w: 2, h: 2 }, { t: 'window', x: 5, y: 0, w: 1, h: 2 },
      { t: 'anvil', x: 3, y: 3, w: 1, h: 1, block: 1 }, { t: 'bancada', x: 8, y: 3, w: 2, h: 1, block: 1, use: 'bancada2' },
      { t: 'barrel', x: 10, y: 5, w: 1, h: 1, block: 1 }, { t: 'rug', x: 4, y: 5, w: 3, h: 2 }],
    npcs: [{ id: npcId, x: 5.5, y: 4.2, name: 'Ferreira', role: 'ferreiro' }] };
  else if (m.kind === 'venda') def = Object.assign(homeDef('Sua casa em ' + c.name, 'wood', 1, ['#c8423b']), {});
  else def = { name: 'Casa em ' + c.name, w: 10, h: 7, floor: 'wood', wall: R() < 0.5 ? 'wood' : 'brick',
    furn: [{ t: 'window', x: 2, y: 0, w: 1, h: 2 }, { t: 'shelf', x: 5, y: 0, w: 2, h: 2 }, { t: 'window', x: 8, y: 0, w: 1, h: 2 },
      { t: 'bed', x: 1, y: 2, w: 1, h: 2, block: 1, col: ['#4f7fbf', '#c8423b', '#5fa65a', '#e86a9a'][Math.floor(R() * 4)] }, { t: 'rug', x: 3, y: 4, w: 3, h: 2 },
      { t: 'table', x: 6, y: 3, w: 2, h: 1, block: 1 }, { t: 'plant', x: 8, y: 2, w: 1, h: 1, block: 1 },
      ...(R() < 0.6 ? [{ t: 'chest', x: 8, y: 5, w: 1, h: 1, block: 1, use: 'chest', id: 'ch_' + id }] : [])],
    npcs: [{ id: npcId, x: 4.5, y: 3.4, name: ['Lúcia', 'Davi', 'Nina', 'Caio', 'Bia', 'Joca', 'Tainá', 'Raul'][Math.floor(R() * 8)], role: 'morador' }] };
  INTERIORS[id] = def;
  if (!CHEST_LOOT['ch_' + id]) CHEST_LOOT['ch_' + id] = [{ moeda: 8, madeira: 3 }, { pocao: 1, moeda: 4 }, { cristal: 1, seiva: 2 }, { fibra: 4, pedra: 3 }][Math.floor(R() * 4)];
  buildInterior(id);
  def.returnTo = m.door;
  return def;
}

// ---------------------------------------------------------------- mapas (minimapa e mapa grande)
function mapRGB(x, y) {
  const t = inVale(x, y) ? valeTer[Math.floor(y / CELL) * GC + Math.floor(x / CELL)] : terrainProc(x, y);
  const b = inVale(x, y) ? 'campo' : biomeAt(x, y);
  switch (t) {
    case 2: return b === 'pantano' ? [60, 80, 46] : [58, 140, 196];
    case 9: return [196, 228, 244];
    case 1: case 7: return [205, 170, 112];
    case 3: return [226, 207, 150];
    case 4: return [200, 190, 166];
    case 13: return [170, 150, 120];
    case 14: return [90, 86, 80];
    case 5: return [122, 82, 50];
    case 6: return b === 'neve' ? [236, 242, 248] : b === 'deserto' ? [176, 110, 72] : [125, 122, 116];
  }
  return { campo: [88, 150, 60], floresta: [46, 104, 44], outono: [196, 120, 50], deserto: [226, 196, 132], neve: [228, 236, 244], pantano: [66, 92, 48], cerejeiras: [228, 150, 186] }[b];
}
function makeMapLayer(cx, cy, spanW, spanH, res) {
  const w = Math.ceil(spanW / res), h = Math.ceil(spanH / res);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  return { cx, cy, spanW, spanH, res, w, h, canvas: c, g, img: g.createImageData(w, h), row: 0, done: false };
}
function stepMapLayer(L, rows) {
  if (L.done) return;
  const d = L.img.data, x0 = L.cx - L.spanW / 2, y0 = L.cy - L.spanH / 2;
  const end = Math.min(L.h, L.row + rows);
  for (let y = L.row; y < end; y++) for (let x = 0; x < L.w; x++) {
    const [r, g, b] = mapRGB(x0 + (x + 0.5) * L.res, y0 + (y + 0.5) * L.res), i = (y * L.w + x) * 4;
    d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
  }
  L.row = end;
  L.g.putImageData(L.img, 0, 0);
  if (L.row >= L.h) L.done = true;
}
function citiesIn(x0, y0, x1, y1) {
  const out = [];
  const [i0, j0] = cellOf(x0, y0), [i1, j1] = cellOf(x1, y1);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const c = cityAt(i, j); if (c) out.push(c); }
  return out;
}
