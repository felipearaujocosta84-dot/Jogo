/* Vale da Lanterna — "mundo vivo": relógio do jogo, luz do dia, moradores com perfil e rotina,
   rede de caminhos para os NPCs e diálogos que mudam com hora, lugar, profissão e acontecimentos. */
'use strict';

// ---------------------------------------------------------------- relógio
const WEEK = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
function gameHour() { return S.time.min / 60; }
function clockText() {
  const m = Math.floor(S.time.min), h = Math.floor(m / 60), mm = m % 60;
  return String(h).padStart(2, '0') + ':' + String(Math.floor(mm / 10) * 10).padStart(2, '0');
}
function periodName(h = gameHour()) {
  return h < 5 ? 'Madrugada' : h < 12 ? 'Manhã' : h < 17.5 ? 'Tarde' : h < 19.5 ? 'Pôr do sol' : 'Noite';
}
function weekday(d = S.time.day) { return WEEK[(d - 1) % 7]; }
function dayMinutes() { return (CONFIG.dayMinutes || 60); }
function updateClock(dt) {
  S.time.min += dt * 1440 / (dayMinutes() * 60);
  if (S.time.min >= 1440) { S.time.min -= 1440; S.time.day++; onNewDay(); }
}
function onNewDay() {
  toast('Dia ' + S.time.day + ' · ' + weekday());
  for (const r of RESIDENTS) { const m = npcMem(r.id); m.todayTalk = false; }
}
// avança até as 6h (dormir)
function sleepUntilMorning() {
  const h = gameHour();
  if (h >= 6) S.time.day++;
  S.time.min = 6 * 60;
  onNewDay();
  snapResidents();
}

// cor da luz ao longo do dia (multiplica a cena) e intensidade das luzes artificiais
const LIGHT_KEYS = [
  [0, [70, 84, 140], 1], [4.5, [80, 90, 150], 1], [5.5, [170, 140, 170], 0.6], [6.5, [255, 236, 214], 0.1], [8, [255, 255, 255], 0],
  [16.5, [255, 250, 240], 0], [18, [255, 214, 170], 0.15], [19, [230, 150, 140], 0.45], [20, [130, 120, 170], 0.8], [21.5, [80, 92, 148], 1], [24, [70, 84, 140], 1]
];
function lightAt(h = gameHour()) {
  for (let i = 0; i < LIGHT_KEYS.length - 1; i++) {
    const [h0, c0, n0] = LIGHT_KEYS[i], [h1, c1, n1] = LIGHT_KEYS[i + 1];
    if (h >= h0 && h <= h1) {
      const k = (h - h0) / (h1 - h0);
      return { col: c0.map((v, j) => Math.round(v + (c1[j] - v) * k)), night: n0 + (n1 - n0) * k };
    }
  }
  return { col: [255, 255, 255], night: 0 };
}
let frameLights = [];
function addLight(x, y, r, col) { frameLights.push({ x, y, r, col }); }
function drawLighting() {
  const L = lightAt();
  const indoor = area !== 'world';
  const col = indoor ? L.col.map(v => Math.round(v + (255 - v) * 0.65)) : L.col;
  if (col[0] < 252 || col[1] < 252 || col[2] < 252) {
    ctx.save(); ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
    ctx.fillRect(cam.x - 50, cam.y - 50, view.vw + 100, view.vh + 100);
    ctx.restore();
  }
  const nk = indoor ? L.night * 0.5 : L.night;
  if (nk > 0.05) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const l of frameLights) {
      const g = ctx.createRadialGradient(l.x, l.y, 4, l.x, l.y, l.r);
      g.addColorStop(0, `rgba(${l.col},${0.55 * nk})`); g.addColorStop(1, `rgba(${l.col},0)`);
      ctx.fillStyle = g; ctx.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
    }
    ctx.restore();
  }
  frameLights = [];
}

// ---------------------------------------------------------------- moradores
// perfil fixo; o estado (memória, amizade…) fica em S.npcs[id]
const RESIDENTS = [
  { id: 'aurora', name: 'Vó Aurora', age: 72, prof: 'Anciã do vale', pers: 'gentil', home: 'casaAurora', bed: 0,
    likes: ['flor', 'torta'], sched: [[6, 7, 'home', 'idle'], [7, 12, 'praca_fonte', 'idle'], [12, 13, 'eat', 'idle'], [13, 18, 'praca_banco', 'rest'], [18, 21, 'home', 'idle'], [21, 30, 'bed', 'sleep']] },
  { id: 'mel', name: 'Mel', age: 26, prof: 'Florista', pers: 'alegre', home: 'casaMel', bed: 0,
    likes: ['flor', 'cristal'], sched: [[6, 7, 'home', 'idle'], [7, 12, 'jardim_mel', 'farm'], [12, 13, 'padaria_mesa', 'idle'], [13, 17, 'jardim_mel', 'farm'], [17, 20, 'vila_praca', 'talk'], [20, 22, 'home', 'idle'], [22, 30, 'bed', 'sleep']] },
  { id: 'tome', name: 'Seu Tomé', age: 58, prof: 'Agricultor', pers: 'rabugento', home: 'cabanaTome', bed: 0,
    likes: ['cogumelo', 'torta'], sched: [[5, 6, 'home', 'idle'], [6, 12, 'horta', 'farm'], [12, 13, 'eat', 'idle'], [13, 18, 'horta', 'farm'], [18, 21, 'home', 'idle'], [21, 29, 'bed', 'sleep']] },
  { id: 'bruno', name: 'Bruno', age: 45, prof: 'Ferreiro', pers: 'trabalhador', home: 'casaBruno', bed: 0,
    likes: ['pedra', 'cristal'], sched: [[6, 7, 'home', 'idle'], [7, 12, 'oficina_bigorna', 'work'], [12, 13, 'padaria_mesa', 'idle'], [13, 18, 'oficina_bigorna', 'work'], [18, 21, 'praca_fonte', 'talk'], [21, 30, 'bed', 'sleep']] },
  { id: 'rosa', name: 'Rosa', age: 39, prof: 'Padeira', pers: 'alegre', home: 'casaRosa', bed: 0,
    likes: ['cogumelo', 'flor'], sched: [[5, 6, 'home', 'idle'], [6, 15, 'padaria_balcao', 'idle'], [15, 18, 'vila_praca', 'talk'], [18, 21, 'home', 'idle'], [21, 29, 'bed', 'sleep']] },
  { id: 'teo', name: 'Téo', age: 10, prof: 'Criança', pers: 'curioso', home: 'casaTeo', bed: 0, child: true,
    likes: ['flor', 'moeda'], sched: [[7, 8, 'home', 'idle'], [8, 12, 'praca_brincar', 'idle'], [12, 13, 'eat', 'idle'], [13, 18, 'praca_brincar', 'idle'], [18, 20, 'home', 'idle'], [20, 31, 'bed', 'sleep']] },
  { id: 'iara', name: 'Iara', age: 29, prof: 'Pescadora', pers: 'aventureira', home: 'casaIara', bed: 0,
    likes: ['cristal', 'torta'], app: { skin: '#c98f5e', hair: '#1f1f2a', hairStyle: 'pony', top: '#2f8a84', bottom: '#33384e', hat: 'cap', hatCol: '#e9c46a' },
    sched: [[6, 7, 'home', 'idle'], [7, 12, 'rio_pesca', 'fish'], [12, 13, 'padaria_mesa', 'idle'], [13, 17, 'rio_pesca', 'fish'], [17, 21, 'vila_praca', 'talk'], [21, 30, 'bed', 'sleep']] },
  { id: 'davi', name: 'Davi', age: 31, prof: 'Carpinteiro', pers: 'timido', home: 'casaDavi', bed: 0,
    likes: ['madeira', 'torta'], app: { skin: '#f0c08a', hair: '#8a5a2b', hairStyle: 'short', top: '#a0703e', bottom: '#4a3a2a', apron: '#6e5a48', beard: '#5e3b1a' },
    sched: [[6, 7, 'home', 'idle'], [7, 12, 'serraria', 'work'], [12, 13, 'vila_praca', 'idle'], [13, 18, 'serraria', 'work'], [18, 22, 'home', 'idle'], [22, 30, 'bed', 'sleep']] },
  { id: 'nina', name: 'Nina', age: 24, prof: 'Costureira', pers: 'sonhadora', home: 'casaNina', bed: 0,
    likes: ['flor', 'fibra'], app: { skin: '#f6d0a8', hair: '#c8a040', hairStyle: 'long', top: '#b59cff', dress: true, collar: '#ffffff' },
    sched: [[7, 8, 'home', 'idle'], [8, 12, 'feira', 'talk'], [12, 13, 'padaria_mesa', 'idle'], [13, 17, 'feira', 'talk'], [17, 21, 'praca_fonte', 'idle'], [21, 31, 'bed', 'sleep']] },
  { id: 'leo', name: 'Léo', age: 34, prof: 'Guarda do vale', pers: 'serio', home: 'casaLeo', bed: 0,
    likes: ['pedra', 'pocao'], app: { skin: '#8a5a3a', hair: '#1a100a', hairStyle: 'short', top: '#3b5f8f', bottom: '#2a2a35', collar: '#c9a14a', hat: 'cap', hatCol: '#2a466c' },
    sched: [[6, 7, 'home', 'idle'], [7, 10, 'ronda_praca', 'walk'], [10, 13, 'ronda_vila', 'walk'], [13, 16, 'ronda_praca', 'walk'], [16, 19, 'ronda_vila', 'walk'], [19, 22, 'home', 'idle'], [22, 30, 'bed', 'sleep']] },
  { id: 'bia', name: 'Bia', age: 33, prof: 'Cozinheira', pers: 'alegre', home: 'casaLeo', bed: 1,
    likes: ['cogumelo', 'flor'], app: { skin: '#d9a066', hair: '#5a3a26', hairStyle: 'bun', top: '#c8423b', dress: true, apron: '#fbfbf4' },
    sched: [[6, 7, 'home', 'idle'], [7, 15, 'padaria_forno', 'work'], [15, 18, 'praca_fonte', 'talk'], [18, 22, 'home', 'idle'], [22, 30, 'bed', 'sleep']] },
  { id: 'joca', name: 'Joca', age: 20, prof: 'Lenhador', pers: 'brincalhao', home: 'cabanaTome', bed: 1,
    likes: ['madeira', 'cogumelo'], app: { skin: '#f0c08a', hair: '#d0542e', hairStyle: 'spiky', top: '#5fa65a', bottom: '#4a3a2a', beard: null },
    sched: [[6, 7, 'home', 'idle'], [7, 12, 'bosque', 'work'], [12, 13, 'horta', 'idle'], [13, 17, 'bosque', 'work'], [17, 21, 'praca_fonte', 'talk'], [21, 30, 'bed', 'sleep']] }
];
const RES_BY_ID = {};
// lugares do mundo (ponto, espalhamento) e de interiores
const PLACES = {
  praca_fonte: { area: 'world', x: 3550, y: 2250, spread: 150 },
  praca_banco: { area: 'world', x: 3420, y: 2300, spread: 30, face: [0, 1] },
  praca_brincar: { area: 'world', x: 3600, y: 1880, spread: 180 },
  vila_praca: { area: 'world', x: 1900, y: 1690, spread: 110 },
  jardim_mel: { area: 'world', x: 2010, y: 1440, spread: 60 },
  horta: { area: 'world', x: 4990, y: 1400, spread: 70 },
  rio_pesca: { area: 'world', x: 2345, y: 1180, spread: 40, face: [1, 0] },
  serraria: { area: 'world', x: 1590, y: 955, spread: 20, face: [0, -1] },
  feira: { area: 'world', x: 3330, y: 1945, spread: 10, face: [0, 1] },
  bosque: { area: 'world', x: 4300, y: 1060, spread: 120 },
  ronda_praca: { area: 'world', x: 3550, y: 2480, spread: 120 },
  ronda_vila: { area: 'world', x: 1900, y: 1300, spread: 60 },
  oficina_bigorna: { area: 'oficina', x: 3.5 * 48, y: 4.35 * 48, spread: 0, face: [0, -1] },
  padaria_balcao: { area: 'padaria', x: 5.5 * 48, y: 2.55 * 48, spread: 30 },
  padaria_forno: { area: 'padaria', x: 2 * 48, y: 2.6 * 48, spread: 0, face: [0, -1] },
  padaria_mesa: { area: 'padaria', x: 3 * 48, y: 6.6 * 48, spread: 220 }
};
function hashStr(s) { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return h; }
function homeSpot(r, kind) {
  const I = INTERIORS[r.home];
  if (kind === 'bed') {
    const beds = I.furn.filter(f => f.t === 'bed'), b = beds[r.bed % beds.length] || beds[0];
    return { area: r.home, x: (b.x + 0.5) * TILE, y: (b.y + 1.55) * TILE, face: [0, 1] };
  }
  if (kind === 'eat') {
    const t = I.furn.find(f => f.t === 'table');
    if (t) return { area: r.home, x: (t.x + t.w / 2) * TILE + (r.bed ? 30 : -30), y: (t.y + 1.6) * TILE, face: [0, -1] };
  }
  return { area: r.home, x: I.w * TILE / 2 + (r.bed ? 50 : -30), y: I.h * TILE * 0.62, face: [0, 1] };
}
function placeFor(r, name) {
  if (name === 'home' || name === 'bed' || name === 'eat') return homeSpot(r, name);
  const P = PLACES[name];
  const h = hashStr(r.id + name), a = (h % 628) / 100, d = P.spread * (0.4 + ((h >>> 8) % 60) / 100);
  return { area: P.area, x: P.x + Math.cos(a) * d, y: P.y + Math.sin(a) * d * 0.6, face: P.face };
}
function currentEntry(r, h = gameHour()) {
  for (const e of r.sched) { if ((h >= e[0] && h < e[1]) || (h + 24 >= e[0] && h + 24 < e[1])) return e; }
  return r.sched[r.sched.length - 1];
}
function npcMem(id) { S.npcs = S.npcs || {}; return S.npcs[id] || (S.npcs[id] = { met: false, talks: 0, lastDay: 0, recent: [] }); }

// sprite 2D de reserva feito a partir da aparência 3D
function spriteFromApp(app, seed) {
  const top = app.hat === 'straw' ? ['..OOOOOOOO..', '.OYYYYYYYYO.', 'OYYyYYYYyYYO', '.OWWWWWWWWO.'] : app.hairStyle === 'bun' ? ['....OOOO....', '...OWWWWO...', '.OOWWWWWWOO.'] : null;
  return bake(personRows(top, app.dress ? ROBE : null), pal({ W: app.hair, w: app.hair, R: app.collar || app.top, r: app.top, B: app.top, b: app.top,
    G: '#c9a14a', P: app.bottom || '#33384e', S: app.skin, s: app.skin, Y: '#e9c46a', y: '#b88c34' }));
}

// ---------------------------------------------------------------- rede de caminhos (NPCs não atravessam paredes)
let NAV = null;
function lineClear(ax, ay, bx, by) {
  const d = Math.hypot(bx - ax, by - ay), n = Math.ceil(d / 10);
  for (let i = 1; i < n; i++) { const k = i / n; if (!worldWalk(ax + (bx - ax) * k, ay + (by - ay) * k)) return false; }
  return true;
}
function buildNav() {
  const pts = [];
  const add = (x, y) => { for (const p of pts) if (Math.hypot(p.x - x, p.y - y) < 40) return p; const p = { x, y, e: [] }; pts.push(p); return p; };
  for (const t of TRAILS) {
    let prev = null;
    for (const [x, y] of t) { const p = add(clamp(x, 160, WW - 160), clamp(y, 160, WH - 160)); if (prev && prev !== p) { prev.e.push(p); p.e.push(prev); } prev = p; }
  }
  for (const P of Object.values(PLACES)) if (P.area === 'world') add(P.x, P.y);
  for (const r of REGION_LIST) for (const d of r.doors) add(d.x, d.y + 36);
  for (const [x, y] of [[3550, 2420], [3550, 1700], [3250, 2000], [3850, 2000], [3550, 2700], [1900, 1300], [1900, 950], [2200, 1600], [2350, 1300], [2050, 1500],
    [4990, 1320], [5100, 1300], [4300, 900], [4400, 700], [1590, 1000], [1750, 960], [3330, 2010], [4100, 2200], [4700, 2300], [4945, 2300], [1700, 2100], [1800, 1760], [2260, 1000], [2300, 1180]]) add(x, y);
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
    const a = pts[i], b = pts[j];
    if (a.e.includes(b) || Math.hypot(a.x - b.x, a.y - b.y) > 520) continue;
    if (lineClear(a.x, a.y, b.x, b.y)) { a.e.push(b); b.e.push(a); }
  }
  NAV = pts;
}
function nearestNav(x, y) {
  const c = NAV.map(p => [p, Math.hypot(p.x - x, p.y - y)]).sort((a, b) => a[1] - b[1]);
  for (let i = 0; i < Math.min(8, c.length); i++) if (lineClear(x, y, c[i][0].x, c[i][0].y)) return c[i][0];
  return c[0][0];
}
function navPath(ax, ay, bx, by) {
  if (Math.hypot(bx - ax, by - ay) < 500 && lineClear(ax, ay, bx, by)) return [[bx, by]];
  const s = nearestNav(ax, ay), t = nearestNav(bx, by);
  const dist = new Map([[s, 0]]), prev = new Map(), open = [s];
  while (open.length) {
    open.sort((a, b) => dist.get(a) - dist.get(b));
    const u = open.shift();
    if (u === t) break;
    for (const v of u.e) {
      const nd = dist.get(u) + Math.hypot(u.x - v.x, u.y - v.y);
      if (nd < (dist.has(v) ? dist.get(v) : Infinity)) { dist.set(v, nd); prev.set(v, u); if (!open.includes(v)) open.push(v); }
    }
  }
  const path = [[bx, by]];
  let u = t;
  while (u) { path.unshift([u.x, u.y]); u = prev.get(u); }
  return path;
}
const doorOut = id => { for (const r of REGION_LIST) for (const d of r.doors) if (d.to === id) return [d.x, d.y + 30]; return null; };
const doorIn = id => { const I = INTERIORS[id]; return [I.w * TILE / 2, I.h * TILE - 34]; };

// ---------------------------------------------------------------- simulação dos moradores
function makeResidentObjects() {
  for (const r of RESIDENTS) {
    RES_BY_ID[r.id] = r;
    r.app = r.app || NPC_APP[r.id];
    if (!NPC[r.id]) NPC[r.id] = spriteFromApp(r.app, hashStr(r.id));
    Object.assign(r, { area: r.home, x: 0, y: 0, steps: [], anim: 'idle', fx: 0, fy: 1, moving: false, entry: null, resident: true });
  }
}
function snapResidents() {
  for (const r of RESIDENTS) {
    const e = currentEntry(r), p = placeFor(r, e[2]);
    r.entry = e; r.area = p.area; r.x = p.x; r.y = p.y; r.steps = []; r.anim = e[3]; r.face = p.face; r.moving = false;
    if (p.face) { r.fx = p.face[0]; r.fy = p.face[1]; }
  }
}
function planRoute(r, p) {
  const st = [];
  let cx = r.x, cy = r.y, ca = r.area;
  if (ca !== p.area && ca !== 'world') {
    const di = doorIn(ca), dout = doorOut(ca);
    st.push({ area: ca, x: di[0], y: di[1] });
    st.push({ area: 'world', x: dout[0], y: dout[1], warp: true });
    cx = dout[0]; cy = dout[1]; ca = 'world';
  }
  if (ca === 'world') {
    const dest = p.area === 'world' ? [p.x, p.y] : doorOut(p.area);
    for (const [x, y] of navPath(cx, cy, dest[0], dest[1])) st.push({ area: 'world', x, y });
    if (p.area !== 'world') { const di = doorIn(p.area); st.push({ area: p.area, x: di[0], y: di[1], warp: true }); }
  }
  st.push({ area: p.area, x: p.x, y: p.y });
  r.steps = st;
}
function residentActive(r) {
  return r.area === area && (area !== 'world' || Math.hypot(r.x - player.x, r.y - player.y) < 2400);
}
function updateResidents(dt) {
  const h = gameHour();
  for (const r of RESIDENTS) {
    const e = currentEntry(r, h);
    if (e !== r.entry) {
      r.entry = e;
      const p = placeFor(r, e[2]);
      r.face = p.face;
      if (r.area === p.area && Math.hypot(r.x - p.x, r.y - p.y) < 8) r.steps = []; else planRoute(r, p);
    }
    if (dialog && dialog.pid === r.id) { r.moving = false; continue; }
    // ronda do guarda: passeia pela área
    if (!r.steps.length && e[3] === 'walk') {
      const P = PLACES[e[2]];
      if (P && (r.wait = (r.wait || 0) - dt) <= 0) { r.wait = rand(2, 6); const a = rand(0, 6.28), d = rand(0, P.spread); const tx = P.x + Math.cos(a) * d, ty = P.y + Math.sin(a) * d * 0.6; if (lineClear(r.x, r.y, tx, ty)) r.steps = [{ area: 'world', x: tx, y: ty }]; }
    }
    r.moving = false;
    let guard = 0;
    while (r.steps.length && guard++ < 40) {
      const s = r.steps[0];
      const walkHere = !s.warp && s.area === r.area && r.area === area && residentActive(r);
      if (!walkHere) { r.area = s.area; r.x = s.x; r.y = s.y; r.steps.shift(); continue; }
      const dx = s.x - r.x, dy = s.y - r.y, d = Math.hypot(dx, dy);
      const sp = 80 * dt;
      if (d <= sp) { r.x = s.x; r.y = s.y; r.steps.shift(); continue; }
      r.x += dx / d * sp; r.y += dy / d * sp; r.fx = dx / d; r.fy = dy / d; r.moving = true;
      break;
    }
    if (!r.moving && !r.steps.length && r.face) { r.fx = r.face[0]; r.fy = r.face[1]; }
    r.anim = r.moving ? 'walk' : (e[3] === 'walk' ? 'idle' : e[3]);
    r.sleeping = !r.moving && !r.steps.length && e[3] === 'sleep';
  }
}
function lifeUpdate(dt) {
  if (!menu && !showMap) updateClock(dt);
  updateResidents(dt);
  // moradores das cidades se recolhem à noite
  const h = gameHour(), night = h >= 22 || h < 6;
  for (const n of world.npcs) if (n.v) n.hiddenNight = night && (hashStr(n.id) & 3) !== 0;
  npcs = baseNpcs.filter(n => !n.hiddenNight).concat(RESIDENTS.filter(r => r.area === area));
}

// ---------------------------------------------------------------- conversa contextual
const PERS = {
  gentil: { hi: ['Olá, querido!', 'Que bom te ver.'], bye: [' Cuide-se.', ' Volte sempre.'] },
  alegre: { hi: ['Oiê!', 'Olha quem apareceu!', 'Ei, Kai!'], bye: [' Hihi!', ' Que dia!'] },
  rabugento: { hi: ['Hmpf. Você de novo.', 'Fala logo, rapaz.'], bye: [' Agora me deixa trabalhar.', ''] },
  trabalhador: { hi: ['E aí, garoto!', 'Opa!'], bye: [' Bom, de volta ao batente.', ''] },
  curioso: { hi: ['Kai! Kai!', 'Oi! Oi!'], bye: [' Você me leva junto um dia?', ''] },
  aventureira: { hi: ['Salve, explorador!', 'Ei, Kai!'], bye: [' O mundo é grande, hein?', ''] },
  timido: { hi: ['Ah... oi.', 'O-oi, Kai.'], bye: [' ...', ' Desculpa, tô meio ocupado.'] },
  sonhadora: { hi: ['Oi, Kai...', 'Ah, oi!'], bye: [' Já pensou em como seria voar?', ''] },
  serio: { hi: ['Kai.', 'Bom ver você.'], bye: [' Fique atento.', ''] },
  brincalhao: { hi: ['Eaí, Kai! Bora?', 'Olha o herói!'], bye: [' Hahaha!', ''] }
};
const PROF_LINES = {
  'Florista': ['As flores-lume brilham mais quando a gente conversa com elas.', 'Estou plantando margaridas novas.'],
  'Agricultor': ['Terra boa é terra cuidada todo dia.', 'Couve não cresce sozinha, não.'],
  'Ferreiro': ['O ferro só obedece quando está quente.', 'Já experimentou uma espada de cristal?'],
  'Padeira': ['O pão sai do forno às seis!', 'Fermento bom é paciência.'],
  'Pescadora': ['Os peixes do rio estão gordinhos esta semana.', 'Pescar é esperar e sorrir.'],
  'Carpinteiro': ['Madeira de lei não racha.', 'Estou fazendo uma mesa nova pra praça.'],
  'Costureira': ['Estou costurando um vestido com cor de pôr do sol.', 'Linha boa vem de fibra boa.'],
  'Guarda do vale': ['Os Musgos andam rondando as trilhas. Cuidado.', 'Tudo tranquilo por aqui.'],
  'Cozinheira': ['Hoje tem sopa de cogumelo!', 'A Rosa faz o pão, eu faço o resto.'],
  'Lenhador': ['Corta, empilha, corta, empilha!', 'Machado afiado, braço cansado.'],
  'Criança': ['Sabia que o Floco é o cachorro mais rápido do vale?', 'Quando eu crescer quero ser aventureiro igual você!'],
  'Anciã do vale': ['O vale já viu muitas lanternas se apagarem e acenderem.', 'Paciência é a melhor ferramenta.']
};
const PLACE_LINES = {
  praca_fonte: 'O chafariz da praça é o melhor lugar pra encontrar todo mundo.',
  vila_praca: 'Gosto de ver o rio no fim da tarde.',
  rio_pesca: 'Shhh... vai espantar os peixes!',
  padaria_mesa: 'Nada como um pão quentinho no almoço.',
  horta: 'Cuidado onde pisa, aí tem semente!',
  bosque: 'Esse bosque tem árvore boa pra lenha.'
};
function lifeLine(id) {
  const r = RES_BY_ID[id]; if (!r) return 'Olá!';
  const h = gameHour(), m = npcMem(id), pool = [];
  const P = PERS[r.pers] || PERS.gentil;
  pool.push(...(PROF_LINES[r.prof] || []));
  const e = r.entry || currentEntry(r);
  if (PLACE_LINES[e[2]]) pool.push(PLACE_LINES[e[2]]);
  if (h < 9) pool.push('Acordei cedinho hoje.', 'Café da manhã é a melhor refeição!');
  else if (h >= 12 && h < 14) pool.push('Já almoçou? Eu estou faminto' + (r.age > 0 ? '!' : '.'));
  else if (h >= 18 && h < 21) pool.push('Que pôr do sol bonito, né?', 'O dia passou voando.');
  else if (h >= 21 || h < 5) pool.push('Já está tarde... daqui a pouco vou dormir.', 'A noite no vale é tão calma.');
  if (weekday() === 'Domingo') pool.push('Domingo é dia de descansar... ou quase.');
  if (S.done) pool.push('A Lanterna voltou a brilhar! Você é o orgulho do vale.');
  else if (relicCount() > 0) pool.push('Dizem que você já tem ' + relicCount() + ' relíquia' + (relicCount() > 1 ? 's' : '') + '. Que coragem!');
  if (S.q.viajante === 2) pool.push('Ouvi dizer que você já conheceu um monte de cidades!');
  if (m.talks > 5) pool.push('Gosto das nossas conversas, Kai.');
  // evita repetir as últimas frases
  const fresh = pool.filter(l => !m.recent.includes(l));
  const pick = (fresh.length ? fresh : pool)[Math.floor(Math.random() * (fresh.length || pool.length))];
  m.recent.push(pick); if (m.recent.length > 5) m.recent.shift();
  const hi = P.hi[Math.floor(Math.random() * P.hi.length)], bye = Math.random() < 0.3 ? P.bye[Math.floor(Math.random() * P.bye.length)] : '';
  return (m.lastDay === S.time.day ? '' : hi + ' ') + pick + bye;
}
function noteTalk(id) { const m = npcMem(id); m.talks++; m.met = true; m.lastDay = S.time.day; }
// conversa com moradores novos (os das missões usam talkTo e caem aqui quando não há missão)
function lifeTalk(n) {
  const r = RES_BY_ID[n.id], m = npcMem(n.id);
  if (r.sleeping) { say([r.name + ' está dormindo. Zzz...']); return; }
  const lines = [];
  if (!m.met) lines.push(r.name + ': Prazer! Eu sou ' + (r.name.startsWith('Vó') ? 'a ' : '') + r.name + ', tenho ' + r.age + ' anos e sou ' + r.prof.toLowerCase() + '.');
  lines.push(r.name + ': ' + lifeLine(n.id));
  noteTalk(n.id);
  say(lines);
}
// desenho do relógio no topo da tela
function drawClockHUD(T) {
  const t = 'Dia ' + S.time.day + ' · ' + weekday().slice(0, 3) + ' · ' + clockText() + ' · ' + periodName();
  ctx.font = `700 13px ${FONT}`;
  const w = ctx.measureText(t).width + 26, x = W / 2 - w / 2, y = T;
  ctx.fillStyle = 'rgba(20,24,20,0.62)'; ctx.beginPath(); ctx.roundRect(x, y, w, 24, 10); ctx.fill();
  const h = gameHour(), sun = h >= 6 && h < 19;
  ctx.fillStyle = sun ? '#ffd84a' : '#cfe0ff'; ctx.beginPath(); ctx.arc(x + 13, y + 12, 5, 0, 7); ctx.fill();
  if (!sun) { ctx.fillStyle = 'rgba(20,24,20,0.9)'; ctx.beginPath(); ctx.arc(x + 15, y + 10, 4, 0, 7); ctx.fill(); }
  ctx.fillStyle = '#fff6d8'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(t, x + 22, y + 12.5);
}
