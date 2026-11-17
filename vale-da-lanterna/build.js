/* Vale da Lanterna — construção livre e decoração.
   Catálogo modular (BUILD_CATALOG): para criar um objeto novo basta acrescentar uma entrada com custo, tamanho e
   forma de desenho. Constrói nos terrenos do jogador e decora interiores próprios; tudo fica salvo em S.builds/S.decor. */
'use strict';

// ---------------------------------------------------------------- catálogo
// where: 'world' (terrenos) ou 'inside' (interiores próprios) · w/h: tamanho em px (mundo) ou em blocos de 48 (interior)
// rot: 'hv' (horizontal/vertical), 'flip' (espelhar), 'swap' (troca largura e altura) · wall: só na parede do fundo
const BUILD_CATALOG = [
  // construções (entram por porta)
  { id: 'casa', cat: 'Construções', name: 'Casa', where: 'world', kind: 'house', enter: 'casa', cost: { tabua: 30, pedra: 20, moeda: 200 }, custom: true },
  { id: 'loja', cat: 'Construções', name: 'Loja do Kai', where: 'world', kind: 'house', enter: 'loja', sign: 'bag', cost: { tabua: 30, pedra: 15, moeda: 250 }, custom: true },
  { id: 'galpao', cat: 'Construções', name: 'Galpão', where: 'world', kind: 'barn', enter: 'galpao', cost: { tabua: 25, pedra: 10, moeda: 120 } },
  // cercas e caminhos
  { id: 'cerca', cat: 'Cercas e caminhos', name: 'Cerca', where: 'world', d: 'fenceH', w: 48, h: 14, rot: 'hv', cost: { madeira: 1 } },
  { id: 'portao', cat: 'Cercas e caminhos', name: 'Portão', where: 'world', d: 'gate', w: 48, h: 14, rot: 'hv', pass: true, cost: { madeira: 2 } },
  { id: 'pedra', cat: 'Cercas e caminhos', name: 'Caminho de pedra', where: 'world', ground: 'stone', w: 48, h: 48, pass: true, cost: { pedra: 1 } },
  { id: 'terra', cat: 'Cercas e caminhos', name: 'Estrada de terra', where: 'world', ground: 'dirt', w: 48, h: 48, pass: true, cost: { moeda: 2 } },
  { id: 'tabuado', cat: 'Cercas e caminhos', name: 'Piso de tábuas', where: 'world', ground: 'wood', w: 48, h: 48, pass: true, cost: { tabua: 1 } },
  // decoração externa
  { id: 'poste', cat: 'Decoração', name: 'Poste de luz', where: 'world', d: 'lamp', w: 24, h: 16, block: 12, cost: { pedra: 2, cristal: 1 } },
  { id: 'banco', cat: 'Decoração', name: 'Banco', where: 'world', d: 'bench', w: 76, h: 20, cost: { tabua: 2 } },
  { id: 'canteiro', cat: 'Decoração', name: 'Canteiro de flores', where: 'world', d: 'flowerbed', w: 90, h: 36, cost: { flor: 3 } },
  { id: 'arvore', cat: 'Decoração', name: 'Árvore', where: 'world', tree: true, w: 40, h: 24, block: 20, cost: { madeira: 1, moeda: 5 } },
  { id: 'arbusto', cat: 'Decoração', name: 'Arbusto', where: 'world', bush: true, w: 60, h: 20, cost: { fibra: 2 } },
  { id: 'barril', cat: 'Decoração', name: 'Barril', where: 'world', d: 'barrel', w: 36, h: 16, block: 18, cost: { tabua: 2 } },
  { id: 'caixote', cat: 'Decoração', name: 'Caixote', where: 'world', d: 'crate', w: 44, h: 16, block: 18, cost: { tabua: 1 } },
  { id: 'feno', cat: 'Decoração', name: 'Fardo de feno', where: 'world', d: 'hay', w: 76, h: 20, block: 30, cost: { fibra: 3 } },
  { id: 'espantalho', cat: 'Decoração', name: 'Espantalho', where: 'world', d: 'scarecrow', w: 40, h: 16, block: 12, cost: { madeira: 2, fibra: 1 } },
  { id: 'irrigador', cat: 'Decoração', name: 'Irrigador', desc: 'rega os canteiros num raio de 3 blocos toda manhã', where: 'world', d: 'sprinkler', w: 30, h: 16, block: 10, cost: { pedra: 2, cristal: 1 } },
  { id: 'placa', cat: 'Decoração', name: 'Placa', where: 'world', d: 'sign', text: 'Kai', w: 30, h: 16, block: 8, cost: { madeira: 1 } },
  // móveis (interiores)
  { id: 'm_cama', cat: 'Móveis', name: 'Cama', where: 'inside', t: 'bed', w: 1, h: 2, use: 'bed', col: '#4f7fbf', cost: { tabua: 4, fibra: 2 } },
  { id: 'm_mesa', cat: 'Móveis', name: 'Mesa', where: 'inside', t: 'table', w: 2, h: 1, rot: 'swap', cost: { tabua: 3 } },
  { id: 'm_sofa', cat: 'Móveis', name: 'Sofá', where: 'inside', t: 'sofa', w: 2, h: 1, cost: { tabua: 3, fibra: 2 } },
  { id: 'm_estante', cat: 'Móveis', name: 'Estante', where: 'inside', t: 'shelf', w: 2, h: 2, wall: true, cost: { tabua: 3 } },
  { id: 'm_janela', cat: 'Móveis', name: 'Janela', where: 'inside', t: 'window', w: 1, h: 2, wall: true, cost: { tabua: 1, cristal: 1 } },
  { id: 'm_quadro', cat: 'Móveis', name: 'Quadro', where: 'inside', t: 'painting', w: 1, h: 2, wall: true, cost: { tabua: 1, flor: 2 } },
  { id: 'm_lareira', cat: 'Móveis', name: 'Lareira', where: 'inside', t: 'fireplace', w: 2, h: 2, wall: true, cost: { pedra: 6 } },
  { id: 'm_tapete', cat: 'Móveis', name: 'Tapete', where: 'inside', t: 'rug', w: 3, h: 2, rot: 'swap', floor: true, cost: { fibra: 3 } },
  { id: 'm_planta', cat: 'Móveis', name: 'Planta', where: 'inside', t: 'plant', w: 1, h: 1, cost: { flor: 1, pedra: 1 } },
  { id: 'm_luminaria', cat: 'Móveis', name: 'Luminária', where: 'inside', t: 'lamp', w: 1, h: 1, cost: { tabua: 1, cristal: 1 } },
  { id: 'm_bau', cat: 'Móveis', name: 'Baú', desc: 'guarda itens (todos os baús são ligados)', where: 'inside', t: 'chest', w: 1, h: 1, use: 'storage', cost: { tabua: 2 } },
  { id: 'm_guarda', cat: 'Móveis', name: 'Guarda-roupa', desc: 'troca de roupa', where: 'inside', t: 'wardrobe', w: 1, h: 1, use: 'wardrobe', cost: { tabua: 4 } },
  { id: 'm_fogao', cat: 'Móveis', name: 'Fogão', where: 'inside', t: 'oven', w: 1, h: 1, use: 'cook', cost: { pedra: 4 } },
  { id: 'm_bancada', cat: 'Móveis', name: 'Bancada', desc: 'cria equipamentos', where: 'inside', t: 'bancada', w: 2, h: 1, use: 'bancada2', cost: { tabua: 4, pedra: 2 } },
  // quarto infantil
  { id: 'k_berco', cat: 'Quarto infantil', name: 'Berço', where: 'inside', t: 'crib', w: 1, h: 1, cost: { tabua: 3 } },
  { id: 'k_cama', cat: 'Quarto infantil', name: 'Cama infantil', where: 'inside', t: 'kidbed', w: 1, h: 2, col: '#9ad1ff', cost: { tabua: 3, fibra: 2 } },
  { id: 'k_brinquedos', cat: 'Quarto infantil', name: 'Caixa de brinquedos', desc: 'as crianças sentem menos falta de carinho', where: 'inside', t: 'toybox', w: 1, h: 1, cost: { tabua: 2 } },
  { id: 'k_tapete', cat: 'Quarto infantil', name: 'Tapete colorido', where: 'inside', t: 'rug', w: 2, h: 2, floor: true, cost: { fibra: 2, flor: 2 } }
];
const BUILD_BY_ID = Object.fromEntries(BUILD_CATALOG.map(c => [c.id, c]));
const WALLS = ['plaster', 'wood', 'stone', 'adobe'], WALL_NAMES = { plaster: 'reboco', wood: 'madeira', stone: 'pedra', adobe: 'adobe' };
const ROOF_LIST = Object.keys(ROOFS), WIDTHS = [52, 58, 66];
const costText = c => Object.entries(c).map(([k, n]) => n + ' ' + (k === 'moeda' ? 'moedas' : (NAMES[k] || k).toLowerCase())).join(', ');
const canPay = c => Object.entries(c).every(([k, n]) => k === 'moeda' ? S.coins >= n : itemCount(k) >= n);
function pay(c, sign = 1) { for (const [k, n] of Object.entries(c)) { if (k === 'moeda') S.coins -= n * sign; else addItem(k, -n * sign); } }

// ---------------------------------------------------------------- estado do modo construção
let build = null;   // { cat, item, rot, grid, mode: 'place'|'remove'|'move', opts, moving }
function buildContext() {
  if (area === 'world') return plotAt(player.x, player.y) ? 'world' : null;
  if (area === 'casaKai' || area.startsWith('b_') || (DYN.get(area) && DYN.get(area).kind === 'venda' && S.props.houses[area])) return 'inside';
  return null;
}
function openBuild() {
  const ctxW = buildContext(); if (!ctxW) return;
  const cats = [...new Set(BUILD_CATALOG.filter(c => c.where === ctxW).map(c => c.cat))];
  build = { where: ctxW, cat: cats[0], item: null, rot: 0, grid: true, mode: 'place', opts: { wall: 'plaster', roof: 'red', w: 58, chimney: true }, moving: null };
  menu = null; Audio.sfx('ui');
}
function closeBuild() { if (build && build.moving) placeMoved(true); build = null; }

// ---------------------------------------------------------------- formas e encaixe
function houseSprite(item, opts) {
  const key = item.id + opts.wall + opts.roof + opts.w + opts.chimney;
  houseSprite.cache = houseSprite.cache || new Map();
  if (!houseSprite.cache.has(key)) {
    const o = { kind: 'house', w: opts.w, roof: opts.roof, wall: opts.wall, chimney: opts.chimney, sign: item.sign || null };
    const s = item.kind === 'barn' ? makeBarn() : makeHouse(o, hashStr(key) & 0xffff);
    houseSprite.cache.set(key, { s, chimneyPos: o.chimneyPos });
  }
  return houseSprite.cache.get(key);
}
// retângulo ocupado no mundo (colisão e validação)
function footprint(item, x, y, rot, opts) {
  if (item.kind) {
    const { s } = houseSprite(item, opts), sc = item.kind === 'barn' ? 4 : 5, pw = s.w * sc;
    const foot = item.kind === 'barn' ? s.h * sc * 0.55 : (s.foot || 40) * sc;
    return { x0: x - pw / 2 + 16, y0: y - foot, x1: x + pw / 2 - 16, y1: y - 10, draw: [x - pw / 2, y - s.h * sc, pw, s.h * sc] };
  }
  let w = item.w, h = item.h;
  if (item.rot === 'hv' && rot % 2) { w = item.h; h = item.w; }
  if (item.ground) return { x0: x - w / 2, y0: y - h / 2, x1: x + w / 2, y1: y + h / 2 };
  return { x0: x - w / 2, y0: y - h, x1: x + w / 2, y1: y };
}
function ghostPos() {
  const it = BUILD_BY_ID[build.item]; if (!it) return null;
  if (build.where === 'world') {
    let gx = player.x + player.fx * 90, gy = player.y + player.fy * 70 + (it.kind ? 40 : 0);
    if (it.kind) { gx = player.x; gy = player.y - 34; }   // a porta fica onde o Kai está; a construção sobe a partir dela
    const sn = it.ground || it.d === 'fenceH' || it.d === 'gate' ? 48 : 24;
    if (build.grid) { gx = Math.round(gx / sn) * sn + (it.ground ? 24 : 0); gy = Math.round(gy / sn) * sn + (it.ground ? 24 : 0); }
    return { x: gx, y: gy };
  }
  const I = interiorDef;
  let w = it.w, h = it.h; if (it.rot === 'swap' && build.rot % 2) { w = it.h; h = it.w; }
  const tx = clamp(Math.round((player.x + player.fx * 56) / TILE - w / 2), 0, I.w - w);
  const ty = it.wall ? 0 : clamp(Math.round((player.y + player.fy * 56) / TILE - h / 2), 2, I.h - h);
  return { tx, ty, w, h };
}
function rectsHit(a, b) { return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0; }
function validWorld(it, g) {
  const f = footprint(it, g.x, g.y, build.rot, build.opts);
  const pl = PLOTS.find(p => S.props.plots[p.id] && f.x0 >= p.x0 && f.x1 <= p.x1 && f.y0 >= p.y0 - (it.kind ? 0 : 0) && f.y1 <= p.y1);
  if (!pl) return 'Precisa ficar inteiro dentro de um terreno seu.';
  if (it.kind && pl.free) return 'O quintal é pequeno demais para construções.';
  for (const b of S.builds) {
    const o = BUILD_BY_ID[b.item]; if (!!o.ground !== !!it.ground) continue;   // objetos podem ficar em cima de pisos
    if (rectsHit(f, footprint(o, b.x, b.y, b.rot, b.opts))) return it.ground ? 'Já tem piso aqui.' : 'Já tem algo construído aqui.';
  }
  for (const k of Object.keys(S.farm)) { if (!k.startsWith(pl.id + ':')) continue; const [, i, j] = k.split(':').map(Number); const r = { x0: pl.x0 + i * 48, y0: pl.y0 + j * 48, x1: pl.x0 + i * 48 + 48, y1: pl.y0 + j * 48 + 48 }; if (rectsHit(f, r)) return 'Tem plantação aqui.'; }
  if (!it.ground) for (let y = f.y0 + 4; y < f.y1; y += 12) for (let x = f.x0 + 4; x < f.x1; x += 12) if (!worldWalk(x, y)) return 'Tem um obstáculo no caminho.';
  const sx = pl.x0 + 70, sy = pl.y1 - 10;
  if (!pl.free && sx > f.x0 - 20 && sx < f.x1 + 20 && sy > f.y0 - 10 && sy < f.y1 + 30) return 'Não pode tapar a placa do terreno.';
  if (it.kind) { const dy = f.y1 + 30; if (dy > pl.y1 + 40) return 'A porta precisa ficar dentro do terreno.'; }
  return null;
}
function insideFurn(I) { return I.furn; }
function validInside(it, g) {
  const I = interiorDef, r = { x0: g.tx, y0: g.ty, x1: g.tx + g.w, y1: g.ty + g.h };
  if (!it.wall && g.ty < 2) return 'Móveis vão no chão.';
  for (const f of insideFurn(I)) {
    if (it.floor && f.t === 'rug') { if (rectsHit(r, { x0: f.x, y0: f.y, x1: f.x + f.w, y1: f.y + f.h })) return 'Já tem tapete aqui.'; continue; }
    if (it.floor || f.t === 'rug') continue;
    if (rectsHit(r, { x0: f.x, y0: f.y, x1: f.x + f.w, y1: f.y + f.h })) return 'Já tem um móvel aqui.';
  }
  const dx = I.w / 2;
  if (!it.wall && !it.floor && g.ty + g.h >= I.h && g.tx < dx + 1 && g.tx + g.w > dx - 1) return 'Não bloqueie a porta.';
  return null;
}

// ---------------------------------------------------------------- aplicar construções ao mundo
const buildProps = new Map();   // id da construção -> props criadas
function bucketAdd(p) { props.push(p); const bx = clamp(Math.floor(p.x / BUCKET), 0, BC - 1), by = clamp(Math.floor(p.y / BUCKET), 0, BR - 1); buckets[by * BC + bx].push(p); }
function bucketRemove(p) {
  const i = props.indexOf(p); if (i >= 0) props.splice(i, 1);
  const bx = clamp(Math.floor(p.x / BUCKET), 0, BC - 1), by = clamp(Math.floor(p.y / BUCKET), 0, BR - 1), B = buckets[by * BC + bx], j = B.indexOf(p); if (j >= 0) B.splice(j, 1);
}
function stampFoot(f, v) { for (let y = f.y0; y < f.y1; y += CELL) for (let x = f.x0; x < f.x1; x += CELL) worldSetCell(x, y, v); }
function applyBuild(b) {
  const it = BUILD_BY_ID[b.item]; if (!it) return;
  const out = [];
  if (it.kind) {
    const { s, chimneyPos } = houseSprite(it, b.opts), sc = it.kind === 'barn' ? 4 : 5;
    const B = { kind: it.kind === 'barn' ? 'barn' : 'house', x: b.x, y: b.y, img: s.img, pw: s.w * sc, ph: s.h * sc, sc, built: b.id };
    if (chimneyPos) B.smoke = [b.x - B.pw / 2 + chimneyPos[0] * sc, b.y - B.ph + 4];
    out.push({ t: 'bld', x: b.x, y: b.y, b: B });
    if (B.smoke) BUILDINGS.push(Object.assign(B, { kind2: 'built' }));
  } else if (it.tree) out.push({ t: 'tree', x: b.x, y: b.y, img: TREE_SETS.campo[b.x % 3 | 0] || TREE_IMGS[0].img, stock: 3, regrow: 0, shake: 0, s: 4, built: b.id });
  else if (it.bush) out.push({ t: 'bush', x: b.x, y: b.y, img: BUSH_IMGS[(b.x / 24 | 0) % BUSH_IMGS.length], s: 4 });
  else if (it.d) {
    let d = it.d; if (it.rot === 'hv' && b.rot % 2) d = d === 'fenceH' ? 'fenceV' : 'gateV';
    out.push({ t: 'deco', d, x: b.x, y: b.y, seed: b.x * 7 + b.y, text: it.text });
  }
  for (const p of out) { p.built = b.id; bucketAdd(p); }
  buildProps.set(b.id, out);
  if (!it.ground && !it.pass) stampFoot(footprint(it, b.x, b.y, b.rot, b.opts), 0);
}
function unapplyBuild(b) {
  const it = BUILD_BY_ID[b.item];
  for (const p of buildProps.get(b.id) || []) { bucketRemove(p); const k = BUILDINGS.findIndex(o => o.built === b.id); if (k >= 0) BUILDINGS.splice(k, 1); }
  buildProps.delete(b.id);
  if (!it.ground && !it.pass) stampFoot(footprint(it, b.x, b.y, b.rot, b.opts), 1);
}
let appliedBuilds = [];
function applyAllBuilds() {
  for (const b of appliedBuilds) if (buildProps.has(b.id)) unapplyBuild(b);
  for (const id of Object.keys(INTERIORS)) if (id.startsWith('b_')) delete INTERIORS[id];
  appliedBuilds = S.builds;
  for (const b of S.builds) applyBuild(b);
  for (const [id, I] of Object.entries(INTERIORS)) if (I.baseFurn || S.decor[id]) refreshInterior(id);
}
// portas das construções do jogador
function buildDoors() {
  const out = [];
  for (const b of S.builds) { const it = BUILD_BY_ID[b.item]; if (it.enter) out.push({ x: b.x, y: b.y + 14, to: 'b_' + b.id, kind: it.enter }); }
  return out;
}
function ensureBuildInterior(id) {
  if (INTERIORS[id]) return INTERIORS[id];
  const b = S.builds.find(o => 'b_' + o.id === id); if (!b) return null;
  const it = BUILD_BY_ID[b.item];
  let def;
  if (it.enter === 'loja') def = { name: 'Loja do Kai', w: 12, h: 8, floor: 'wood', wall: 'wood', furn: [{ t: 'shelf', x: 1, y: 0, w: 3, h: 2, bread: 1 }, { t: 'window', x: 6, y: 0, w: 1, h: 2 }, { t: 'counter', x: 3, y: 3, w: 5, h: 1, block: 1, use: 'myshop' }], npcs: [] };
  else if (it.enter === 'galpao') def = { name: 'Galpão do Kai', w: 12, h: 8, floor: 'wood', wall: 'wood', furn: [{ t: 'chest', x: 1, y: 2, w: 1, h: 1, block: 1, use: 'storage' }, { t: 'chest', x: 2, y: 2, w: 1, h: 1, block: 1, use: 'storage' }, { t: 'barrel', x: 10, y: 2, w: 1, h: 1, block: 1 }, { t: 'sack', x: 10, y: 3, w: 1, h: 1, block: 1 }], npcs: [] };
  else def = { name: 'Casa nova do Kai', w: 10, h: 7, floor: 'wood', wall: b.opts.wall === 'stone' ? 'stone' : 'wood', furn: [{ t: 'window', x: 2, y: 0, w: 1, h: 2 }, { t: 'window', x: 7, y: 0, w: 1, h: 2 }, { t: 'bed', x: 1, y: 2, w: 1, h: 2, block: 1, col: '#c8423b', use: 'bed' }], npcs: [] };
  INTERIORS[id] = def;
  refreshInterior(id);
  return def;
}
// móveis colocados pelo jogador somam-se aos da casa
function refreshInterior(id) {
  const I = INTERIORS[id]; if (!I) return;
  if (!I.baseFurn) I.baseFurn = I.furn.slice();
  I.furn = I.baseFurn.concat((S.decor[id] || []).map(d => Object.assign({}, BUILD_BY_ID[d.item] ? { t: BUILD_BY_ID[d.item].t, use: BUILD_BY_ID[d.item].use, col: BUILD_BY_ID[d.item].col } : {}, { x: d.tx, y: d.ty, w: d.w, h: d.h, block: BUILD_BY_ID[d.item].floor || BUILD_BY_ID[d.item].wall ? 0 : 1, decor: d.id })));
  buildInterior(id);
}

// ---------------------------------------------------------------- confirmar, remover, mover
function buildConfirm() {
  if (!build) return;
  if (build.mode === 'remove' || (build.mode === 'move' && !build.moving)) { const t = buildPickTarget(); if (t) { if (build.mode === 'remove') removeTarget(t); else pickUp(t); } return; }
  const it = BUILD_BY_ID[build.item], g = ghostPos(); if (!it || !g) return;
  const why = build.where === 'world' ? validWorld(it, g) : validInside(it, g);
  if (why) { toast(why); Audio.sfx('hurt'); return; }
  const free = build.moving;
  if (!free && !canPay(it.cost)) { toast('Faltam materiais: ' + costText(it.cost)); Audio.sfx('hurt'); return; }
  if (!free) pay(it.cost);
  const id = free ? free.id : 'k' + (Date.now() % 1e8) + Math.floor(Math.random() * 99);
  if (build.where === 'world') {
    const b = { id, item: it.id, x: Math.round(g.x), y: Math.round(g.y), rot: build.rot, opts: Object.assign({}, build.opts) };
    if (free && free.extra) Object.assign(b, free.extra);
    S.builds.push(b); applyBuild(b);
    if (it.kind) buildNav();
  } else {
    (S.decor[area] = S.decor[area] || []).push({ id, item: it.id, tx: g.tx, ty: g.ty, w: g.w, h: g.h });
    refreshInterior(area); grid = interiorDef.grid; [player.x, player.y] = nearestWalkable(player.x, player.y);
  }
  build.moving = null;
  if (build.mode === 'move') build.mode = 'place';
  Audio.sfx('craft'); burst(player.x + player.fx * 60, player.y - 20, '#ffe38a', 10, 90);
  save();
}
function buildPickTarget() {
  let best = null, bd = 140;
  if (build.where === 'world') for (const b of S.builds) { const d = Math.hypot(b.x - player.x, b.y - player.y - (BUILD_BY_ID[b.item].kind ? -60 : 0)); if (d < (BUILD_BY_ID[b.item].kind ? 220 : bd)) { bd = d; best = { b }; } }
  else for (const d of S.decor[area] || []) { const x = (d.tx + d.w / 2) * TILE, y = (d.ty + d.h / 2) * TILE, dd = Math.hypot(x - player.x, y - player.y); if (dd < bd) { bd = dd; best = { d }; } }
  return best;
}
function removeTarget(t) {
  if (t.b) {
    const it = BUILD_BY_ID[t.b.item];
    if (it.enter && Object.keys(S.decor['b_' + t.b.id] || {}).length) { toast('Esvazie os móveis lá dentro antes.'); return; }
    if (it.enter === 'loja' && S.myshop && Object.values(S.myshop.stock).some(v => v > 0)) { toast('Retire os produtos da loja antes.'); return; }
    unapplyBuild(t.b); S.builds.splice(S.builds.indexOf(t.b), 1); pay(it.cost, -1);
    if (it.kind) { delete INTERIORS['b_' + t.b.id]; buildNav(); }
  } else {
    const L = S.decor[area]; L.splice(L.indexOf(t.d), 1); pay(BUILD_BY_ID[t.d.item].cost, -1); refreshInterior(area); grid = interiorDef.grid;
  }
  Audio.sfx('chop'); toast('Removido (materiais devolvidos)'); save();
}
function pickUp(t) {
  if (t.b) { if (BUILD_BY_ID[t.b.item].kind) { toast('Construções grandes não podem ser movidas; remova e construa de novo.'); return; } unapplyBuild(t.b); S.builds.splice(S.builds.indexOf(t.b), 1); build.item = t.b.item; build.rot = t.b.rot; build.moving = { id: t.b.id, orig: t.b }; }
  else { const L = S.decor[area]; L.splice(L.indexOf(t.d), 1); refreshInterior(area); grid = interiorDef.grid; build.item = t.d.item; build.rot = 0; build.moving = { id: t.d.id, orig: t.d }; }
  build.cat = BUILD_BY_ID[build.item].cat; toast('Leve até o novo lugar e confirme');
}
// cancelar uma mudança devolve o objeto ao lugar antigo
function placeMoved(cancel) {
  const m = build.moving; if (!m) return;
  if (build.where === 'world') { S.builds.push(m.orig); applyBuild(m.orig); }
  else { (S.decor[area] = S.decor[area] || []).push(m.orig); refreshInterior(area); grid = interiorDef.grid; }
  build.moving = null; save();
}

// ---------------------------------------------------------------- baú (armazenamento) e loja do Kai
function storageMove(k, toStorage) {
  if (toStorage) { if (itemCount(k) <= 0) return; addItem(k, -1); S.storage[k] = (S.storage[k] || 0) + 1; }
  else { if (!(S.storage[k] > 0)) return; S.storage[k]--; addItem(k, 1); }
  Audio.sfx('ui'); save();
}
function myshopStock(k, add) {
  S.myshop = S.myshop || { stock: {}, till: 0, sold: 0 };
  if (add) { if (itemCount(k) <= 0) return; addItem(k, -1); S.myshop.stock[k] = (S.myshop.stock[k] || 0) + 1; }
  else { if (!(S.myshop.stock[k] > 0)) return; S.myshop.stock[k]--; addItem(k, 1); }
  Audio.sfx('ui'); save();
}
const hasMyShop = () => S.builds.some(b => BUILD_BY_ID[b.item].enter === 'loja');
// a cada hora de funcionamento (8h–18h) aparecem clientes; decoração e variedade atraem mais gente
let shopHour = -1;
function updateMyShop() {
  if (!hasMyShop() || !S.myshop) return;
  const h = Math.floor(gameHour());
  if (h === shopHour) return; shopHour = h;
  if (h < 8 || h >= 18) return;
  const ks = Object.keys(S.myshop.stock).filter(k => S.myshop.stock[k] > 0); if (!ks.length) return;
  const lojaId = 'b_' + S.builds.find(b => BUILD_BY_ID[b.item].enter === 'loja').id;
  const decor = (S.decor[lojaId] || []).length;
  const tries = 1 + Math.floor(Math.random() * 2) + (ks.length >= 4 ? 1 : 0);
  for (let i = 0; i < tries; i++) {
    if (Math.random() > Math.min(0.9, 0.45 + decor * 0.05)) continue;
    const k = ks[Math.floor(Math.random() * ks.length)]; if (!(S.myshop.stock[k] > 0)) continue;
    const p = Math.max(1, Math.round(sellPrice(k) * 1.3));
    S.myshop.stock[k]--; S.myshop.till += p; S.myshop.sold++;
  }
}
function collectTill() { const v = S.myshop ? S.myshop.till : 0; if (!v) { toast('O caixa está vazio.'); return; } S.coins += v; S.stats.earned += v; S.myshop.till = 0; Audio.sfx('coin'); toast('Recebeu ' + v + ' moedas da sua loja!'); save(); }

// ---------------------------------------------------------------- irrigadores regam os canteiros vizinhos de manhã
function sprinklersWater() {
  for (const b of S.builds) if (b.item === 'irrigador') {
    for (const [k, f] of Object.entries(S.farm)) {
      const [pid, i, j] = k.split(':'), pl = PLOTS.find(p => p.id === pid); if (!pl) continue;
      const x = pl.x0 + (+i + 0.5) * 48, y = pl.y0 + (+j + 0.5) * 48;
      if (Math.abs(x - b.x) < 150 && Math.abs(y - b.y) < 150) f.water = true;
    }
  }
}

// ---------------------------------------------------------------- desenho
function drawBuildGround(x0, y0, x1, y1) {
  for (const b of S.builds) {
    const it = BUILD_BY_ID[b.item]; if (!it.ground) continue;
    if (b.x < x0 - 60 || b.x > x1 + 60 || b.y < y0 - 60 || b.y > y1 + 60) continue;
    drawGroundTile(it.ground, b.x, b.y, 1);
  }
}
function drawGroundTile(kind, x, y, a) {
  ctx.globalAlpha = a;
  const x0 = x - 24, y0 = y - 24;
  if (kind === 'stone') { ctx.fillStyle = '#8a8070'; ctx.fillRect(x0, y0, 48, 48); for (let j = 0; j < 3; j++) for (let i = 0; i < 2; i++) { ctx.fillStyle = (i + j) % 2 ? '#c9bfa8' : '#b8ad94'; ctx.fillRect(x0 + 2 + i * 24 + (j % 2) * 6, y0 + 2 + j * 16, 20, 13); } }
  else if (kind === 'dirt') { ctx.fillStyle = '#b48c58'; ctx.fillRect(x0, y0, 48, 48); ctx.fillStyle = '#9a7448'; ctx.fillRect(x0 + 8, y0 + 12, 4, 4); ctx.fillRect(x0 + 30, y0 + 30, 4, 4); }
  else { ctx.fillStyle = '#5a3a20'; ctx.fillRect(x0, y0, 48, 48); for (let j = 0; j < 4; j++) { ctx.fillStyle = j % 2 ? '#b07c46' : '#a0703e'; ctx.fillRect(x0 + 1, y0 + 1 + j * 12, 46, 10); } }
  ctx.globalAlpha = 1;
}
function drawBuildGhost() {
  if (!build || build.mode !== 'place' && !build.moving) { if (build) { const t = buildPickTarget(); if (t) drawPickMarker(t); } return; }
  const it = BUILD_BY_ID[build.item], g = it && ghostPos(); if (!g) return;
  const why = build.where === 'world' ? validWorld(it, g) : validInside(it, g), col = why ? 'rgba(255,90,80,' : 'rgba(120,230,120,';
  if (build.where === 'world') {
    const f = footprint(it, g.x, g.y, build.rot, build.opts);
    ctx.globalAlpha = 0.6;
    if (it.kind) { const { s } = houseSprite(it, build.opts), sc = it.kind === 'barn' ? 4 : 5; ctx.drawImage(s.img, g.x - s.w * sc / 2, g.y - s.h * sc, s.w * sc, s.h * sc); }
    else if (it.ground) drawGroundTile(it.ground, g.x, g.y, 0.8);
    else if (it.tree) ctx.drawImage(TREE_SETS.campo[0], g.x - 80, g.y - 194, 160, 200);
    else if (it.bush) ctx.drawImage(BUSH_IMGS[0], g.x - 72, g.y - 88, 144, 96);
    else drawDeco({ d: it.rot === 'hv' && build.rot % 2 ? (it.d === 'fenceH' ? 'fenceV' : 'gateV') : it.d, x: g.x, y: g.y, seed: 1, text: it.text });
    ctx.globalAlpha = 1;
    ctx.fillStyle = col + '0.25)'; ctx.strokeStyle = col + '0.9)'; ctx.lineWidth = 3;
    ctx.fillRect(f.x0, f.y0, f.x1 - f.x0, f.y1 - f.y0); ctx.strokeRect(f.x0, f.y0, f.x1 - f.x0, f.y1 - f.y0);
    if (why) label(why, g.x, f.y0 - 18, 15, '#ffb0a0');
  } else {
    const x = g.tx * TILE, y = g.ty * TILE;
    ctx.save(); ctx.globalAlpha = 0.7; const tmp = pixelCanvas(g.w * TILE, g.h * TILE, gg => drawFurniture(gg, { t: it.t, x: 0, y: 0, w: g.w, h: g.h, col: it.col }, mulberry(3))); ctx.drawImage(tmp, x, y); ctx.restore();
    ctx.fillStyle = col + '0.22)'; ctx.strokeStyle = col + '0.9)'; ctx.lineWidth = 3; ctx.fillRect(x, y, g.w * TILE, g.h * TILE); ctx.strokeRect(x, y, g.w * TILE, g.h * TILE);
    if (why) label(why, x + g.w * TILE / 2, y - 14, 14, '#ffb0a0');
  }
}
function drawPickMarker(t) {
  let x, y, w, h;
  if (t.b) { const it = BUILD_BY_ID[t.b.item], f = footprint(it, t.b.x, t.b.y, t.b.rot, t.b.opts); x = f.x0; y = f.y0; w = f.x1 - f.x0; h = f.y1 - f.y0; }
  else { x = t.d.tx * TILE; y = t.d.ty * TILE; w = t.d.w * TILE; h = t.d.h * TILE; }
  ctx.strokeStyle = build.mode === 'remove' ? 'rgba(255,90,80,0.95)' : 'rgba(120,200,255,0.95)'; ctx.lineWidth = 4; ctx.setLineDash([10, 8]); ctx.strokeRect(x - 4, y - 4, w + 8, h + 8); ctx.setLineDash([]);
}
// painel do modo construção
function drawBuildUI() {
  if (!build) return;
  const ph = 132, py = H - ph - SAFE.b, px = SAFE.l + 8, pw = W - SAFE.l - SAFE.r - 16;
  ctx.fillStyle = 'rgba(28,24,34,0.93)'; ctx.strokeStyle = '#e8d6a8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(px, py, pw, ph - 6, 12); ctx.fill(); ctx.stroke();
  addBtn(px, py, pw, ph, () => {});
  label('MODO CONSTRUÇÃO', W / 2, py - 14, 15, '#ffe38a');
  const cats = [...new Set(BUILD_CATALOG.filter(c => c.where === build.where).map(c => c.cat))];
  let cx = px + 8;
  for (const c of cats) { ctx.font = `700 12px ${FONT}`; const w = ctx.measureText(c).width + 18; panelButton(c, cx, py + 6, w, 24, () => { build.cat = c; build.item = null; build.page = 0; }, build.cat === c ? 'on' : null); cx += w + 6; }
  // ações
  const acts = [['Girar', () => { build.rot = (build.rot + 1) % 4; }], [build.grid ? 'Grade ✓' : 'Grade ✗', () => { build.grid = !build.grid; }],
    ['Mover', () => { build.mode = 'move'; build.item = null; }, build.mode === 'move'], ['Remover', () => { build.mode = 'remove'; build.item = null; }, build.mode === 'remove'],
    ['✓ Colocar', buildConfirm, false, true], ['✕ Sair', () => { closeBuild(); }]];
  let ax = px + pw - 8;
  for (let i = acts.length - 1; i >= 0; i--) { const [t, fn, on, main] = acts[i]; ctx.font = `700 12px ${FONT}`; const w = ctx.measureText(t).width + 18; ax -= w + 5; panelButton(t, ax, py + 6, w, 24, fn, on || main ? 'on' : null); }
  // itens da categoria
  const items = BUILD_CATALOG.filter(c => c.where === build.where && c.cat === build.cat);
  const cw = 132, per = Math.max(1, Math.floor((pw - 70) / (cw + 6))), pages = Math.ceil(items.length / per), pg = clamp(build.page || 0, 0, pages - 1);
  items.slice(pg * per, pg * per + per).forEach((it, i) => {
    const x = px + 8 + i * (cw + 6), y = py + 36, sel = build.item === it.id && build.mode === 'place', ok = canPay(it.cost);
    ctx.fillStyle = sel ? 'rgba(255,214,90,0.25)' : 'rgba(255,255,255,0.08)'; ctx.beginPath(); ctx.roundRect(x, y, cw, 52, 8); ctx.fill();
    if (sel) { ctx.strokeStyle = '#ffd65a'; ctx.lineWidth = 2; ctx.stroke(); }
    text(it.name, x + 6, y + 13, 12, ok ? '#fff6e6' : '#b8ad94', 700, cw - 12);
    text(costText(it.cost), x + 6, y + 30, 10, ok ? '#ffd65a' : '#ff9a8a', 600, cw - 12);
    if (it.desc) text(it.desc, x + 6, y + 44, 9, '#cfc3a6', 500, cw - 12);
    addBtn(x, y, cw, 52, () => { build.item = it.id; build.mode = 'place'; build.rot = 0; });
  });
  if (pages > 1) { panelButton('◀', px + pw - 62, py + 36, 26, 24, () => { build.page = Math.max(0, pg - 1); }); panelButton('▶', px + pw - 32, py + 36, 26, 24, () => { build.page = Math.min(pages - 1, pg + 1); }); }
  // opções da casa personalizada
  const it = BUILD_BY_ID[build.item];
  const hint = build.mode === 'remove' ? 'Chegue perto de algo que você construiu e toque em ✓ para remover (devolve os materiais).'
    : build.mode === 'move' ? (build.moving ? 'Leve até o novo lugar e toque em ✓.' : 'Chegue perto de algo seu e toque em ✓ para pegar.')
    : !it ? 'Escolha um item. Ande para posicionar: verde pode, vermelho não.' : '';
  if (it && it.custom && build.mode === 'place') {
    const o = build.opts, y = py + 94; let x = px + 8;
    const opt = (t, fn) => { ctx.font = `700 11px ${FONT}`; const w = ctx.measureText(t).width + 16; panelButton(t, x, y, w, 24, fn); x += w + 6; };
    opt('Parede: ' + WALL_NAMES[o.wall], () => { o.wall = WALLS[(WALLS.indexOf(o.wall) + 1) % WALLS.length]; });
    opt('Telhado: ' + o.roof, () => { o.roof = ROOF_LIST[(ROOF_LIST.indexOf(o.roof) + 1) % ROOF_LIST.length]; });
    opt('Tamanho: ' + ['P', 'M', 'G'][WIDTHS.indexOf(o.w)], () => { o.w = WIDTHS[(WIDTHS.indexOf(o.w) + 1) % WIDTHS.length]; });
    opt(o.chimney ? 'Chaminé ✓' : 'Chaminé ✗', () => { o.chimney = !o.chimney; });
    text('Janelas e porta acompanham o tamanho', x + 4, y + 12, 10, '#cfc3a6', 500, 220);
  } else text(hint || (it ? it.name + ': ' + costText(it.cost) + (it.rot ? ' · use Girar' : '') : ''), px + 10, py + 106, 11, '#cfc3a6', 600, pw - 20);
}
