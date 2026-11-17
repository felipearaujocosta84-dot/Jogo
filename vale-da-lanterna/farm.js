/* Vale da Lanterna — agricultura (arar, plantar, regar, adubar, crescer por estágios, colher) e criação de
   animais (galinha, vaca, ovelha, porco: comida, carinho, produtos e filhotes). Funciona nos terrenos do jogador. */
'use strict';

// ---------------------------------------------------------------- culturas
// days: dias regados até a colheita · regrow: volta a produzir depois de N dias · seasons: estações em que cresce
// thirst: 1 = precisa de água todo dia, 2 = aguenta um dia sem água
const CROPS = {
  couve: { name: 'Couve', days: 4, seasons: [0, 2], thirst: 1, sell: 18, seed: 6, col: '#3f8a37' },
  cenoura: { name: 'Cenoura', days: 3, seasons: [0, 1, 2], thirst: 2, sell: 12, seed: 4, col: '#e07a2a' },
  morango: { name: 'Morango', days: 5, regrow: 3, seasons: [0], thirst: 1, sell: 14, seed: 12, col: '#d83a3a' },
  tomate: { name: 'Tomate', days: 6, regrow: 3, seasons: [1], thirst: 1, sell: 10, seed: 8, col: '#e04a3a' },
  trigo: { name: 'Trigo', days: 4, seasons: [0, 1, 2], thirst: 2, sell: 8, seed: 3, col: '#e0c060' },
  abobora: { name: 'Abóbora', days: 8, seasons: [2], thirst: 1, sell: 60, seed: 20, col: '#e07a2a' },
  nabo: { name: 'Nabo', days: 4, seasons: [3], thirst: 2, sell: 15, seed: 5, col: '#e8e0f0' }
};
const ANIMALS = {
  galinha: { name: 'Galinha', price: 40, product: 'ovo', every: 1, size: 0.55 },
  vaca: { name: 'Vaca', price: 200, product: 'leite', every: 1, size: 1 },
  ovelha: { name: 'Ovelha', price: 120, product: 'la', every: 3, size: 0.85 },
  porco: { name: 'Porco', price: 140, product: 'trufa', every: 1, chance: 0.6, size: 0.85 }
};
const ANIMAL_NAMES = ['Pipoca', 'Mimosa', 'Nuvem', 'Bolota', 'Chiquinha', 'Trovão', 'Algodão', 'Paçoca', 'Fofinha', 'Tico', 'Malhada', 'Sardinha'];
const MAX_ANIMALS_PLOT = 6, MAX_ANIMALS = 12;
// preços de colheitas, sementes e produtos (a loja vende por 1,7× o preço base)
for (const [c, C] of Object.entries(CROPS)) { BASE_PRICE[c] = C.sell; BASE_PRICE['sem_' + c] = C.seed / 1.7; }
Object.assign(BASE_PRICE, { ovo: 6, leite: 10, la: 22, trufa: 30, racao: 1.5, adubo: 2.5, omelete: 9 });
const TILE_F = 48;
function weatherWaters() { return typeof weatherRainToday === 'function' && weatherRainToday(); }   // chuva (Fase 8)
const ownedPlots = () => PLOTS.filter(p => S.props.plots[p.id]);
const plotMode = pl => (S.plotMode || {})[pl.id] || 'horta';
function plotAt(x, y) { return PLOTS.find(p => S.props.plots[p.id] && x >= p.x0 && x < p.x1 && y >= p.y0 && y < p.y1); }
function tileOf(pl, x, y) {
  const i = Math.floor((x - pl.x0) / TILE_F), j = Math.floor((y - pl.y0) / TILE_F);
  const cols = Math.floor((pl.x1 - pl.x0) / TILE_F), rows = Math.floor((pl.y1 - pl.y0) / TILE_F);
  if (i < 0 || j < 0 || i >= cols || j >= rows) return null;
  return { key: pl.id + ':' + i + ':' + j, x: pl.x0 + (i + 0.5) * TILE_F, y: pl.y0 + (j + 0.5) * TILE_F };
}
const farmTile = key => S.farm[key];

// ---------------------------------------------------------------- ações na terra
function seedsOwned() { return Object.keys(CROPS).filter(c => (S.bag['sem_' + c] || 0) > 0); }
function selSeed() { const own = seedsOwned(); if (!own.includes(S.seedSel)) S.seedSel = own[0] || null; return S.seedSel; }
function cycleSeed(d) { const own = seedsOwned(); if (!own.length) return; const i = own.indexOf(S.seedSel); S.seedSel = own[(i + d + own.length) % own.length]; }
function farmTarget() {
  if (area !== 'world') return null;
  const pl = plotAt(player.x, player.y); if (!pl || plotMode(pl) !== 'horta') return null;
  const t = tileOf(pl, player.x + player.fx * 30, player.y + player.fy * 30) || tileOf(pl, player.x, player.y);
  if (!t) return null;
  const f = farmTile(t.key), season = calOf().season;
  let label = null, fn = null;
  if (!f) { if (S.tools.enxada) { label = 'Arar'; fn = () => { S.farm[t.key] = { crop: null, days: 0, water: false, dry: 0, fert: false }; Audio.sfx('chop'); burst(t.x, t.y, '#8a5a34', 8, 80); save(); }; } else label = null; }
  else if (f.dead) { label = 'Limpar'; fn = () => { S.farm[t.key] = { crop: null, days: 0, water: false, dry: 0, fert: false }; Audio.sfx('cut'); }; }
  else if (f.crop && f.days >= CROPS[f.crop].days) { label = 'Colher'; fn = () => harvest(t, f); }
  else if (!f.crop) {
    const sd = selSeed();
    if (sd) { label = 'Plantar'; fn = () => {
      if (!CROPS[sd].seasons.includes(season)) { say([CROPS[sd].name + ' não cresce no ' + SEASONS[season] + '. Estações certas: ' + CROPS[sd].seasons.map(i => SEASONS[i]).join(', ') + '.']); return; }
      S.bag['sem_' + sd]--; Object.assign(f, { crop: sd, days: 0, dry: 0, water: false, fert: false }); Audio.sfx('pick'); burst(t.x, t.y, '#9be36a', 6, 60); save(); }; }
  } else if (!f.water && S.tools.regador) { label = 'Regar'; fn = () => { f.water = true; Audio.sfx('cut'); burst(t.x, t.y - 10, '#6fd3ff', 12, 90); save(); }; }
  else if (!f.fert && (S.bag.adubo || 0) > 0) { label = 'Adubar'; fn = () => { S.bag.adubo--; f.fert = true; Audio.sfx('pick'); burst(t.x, t.y, '#c99a6a', 8, 60); save(); }; }
  if (!label) return null;
  return { kind: 'work', x: t.x, y: t.y - 40, fx: t.x, fy: t.y, r: 60, label, fn };
}
function harvest(t, f) {
  const C = CROPS[f.crop], n = f.fert ? 2 : 1;
  addItem(f.crop, n);
  gainText(t.x, t.y - 50, '+' + n + ' ' + C.name);
  Audio.sfx('pick'); burst(t.x, t.y - 20, C.col, 12, 110);
  S.stats.harvest = (S.stats.harvest || 0) + n;
  if (C.regrow) { f.days = C.days - C.regrow; f.fert = false; } else Object.assign(f, { crop: null, days: 0, water: false, dry: 0, fert: false });
  save();
}

// ---------------------------------------------------------------- animais
let animalObjs = [];   // posição e animação em tempo real (o estado salvo fica em S.animals)
function animalsIn(pl) { return S.animals.filter(a => a.plot === pl.id); }
function pastureFor() { return ownedPlots().find(p => !p.free && animalsIn(p).length < MAX_ANIMALS_PLOT && (plotMode(p) === 'pasto' || !Object.keys(S.farm).some(k => k.startsWith(p.id + ':')))); }
function buyAnimal(kind) {
  const A = ANIMALS[kind];
  if (S.animals.length >= MAX_ANIMALS) { say(['Seu Tomé: Você já tem bicho demais pra cuidar, rapaz!']); return; }
  const pl = pastureFor();
  if (!pl) { say(['Seu Tomé: Bicho precisa de pasto! Compre um terreno (as placas "À venda") e deixe ele sem plantação.']); return; }
  if (S.coins < A.price) { toast('Moedas insuficientes'); return; }
  S.coins -= A.price; S.stats.spent += A.price;
  S.plotMode = S.plotMode || {}; S.plotMode[pl.id] = 'pasto';
  const name = ANIMAL_NAMES[(S.animals.length * 7 + kind.length) % ANIMAL_NAMES.length];
  S.animals.push({ id: 'an' + Date.now() % 1e7 + S.animals.length, kind, plot: pl.id, name, born: S.time.day, baby: false, fedDay: 0, petDay: 0, affection: 30, ready: false, last: S.time.day, streak: 0, breedDay: 0 });
  Audio.sfx('relic'); toast(name + ' (' + A.name + ') chegou ao ' + pl.name + '!');
  syncAnimals(); save();
}
function syncAnimals() {
  const keep = new Map(animalObjs.map(o => [o.id, o]));
  animalObjs = S.animals.map(a => {
    const pl = PLOTS.find(p => p.id === a.plot), o = keep.get(a.id) || { id: a.id, x: rand(pl.x0 + 40, pl.x1 - 40), y: rand(pl.y0 + 40, pl.y1 - 20), tx: 0, ty: 0, wait: 0, fx: 0, fy: 1, moving: false };
    o.a = a; o.pl = pl; return o;
  });
}
function updateAnimals(dt) {
  if (area !== 'world') return;
  const h = gameHour(), night = h >= 21 || h < 5;
  for (const o of animalObjs) {
    if (Math.abs(o.x - player.x) > 1600 || Math.abs(o.y - player.y) > 1200) continue;
    if (night) { o.moving = false; continue; }
    if (o.moving) {
      const dx = o.tx - o.x, dy = o.ty - o.y, d = Math.hypot(dx, dy);
      if (d < 3) o.moving = false;
      else { const v = Math.min(d, (o.a.baby ? 45 : 35) * dt); o.x += dx / d * v; o.y += dy / d * v; o.fx = dx / d; o.fy = dy / d; }
    } else if ((o.wait -= dt) <= 0) {
      o.wait = rand(2, 6); o.moving = true;
      o.tx = clamp(o.x + rand(-140, 140), o.pl.x0 + 30, o.pl.x1 - 30); o.ty = clamp(o.y + rand(-100, 100), o.pl.y0 + 40, o.pl.y1 - 10);
    }
  }
}
function animalTarget() {
  if (area !== 'world') return null;
  let best = null, bd = 90;
  for (const o of animalObjs) { const d = Math.hypot(o.x - player.x, o.y - player.y); if (d < bd) { bd = d; best = o; } }
  if (!best) return null;
  return { kind: 'work', x: best.x, y: best.y - 80, fx: best.x, fy: best.y, r: 90, label: best.a.ready ? 'Coletar' : 'Animal', fn: () => animalTalk(best) };
}
function animalTalk(o) {
  const a = o.a, A = ANIMALS[a.kind];
  if (a.ready) {
    const n = a.affection > 80 ? 2 : 1;
    addItem(A.product, n); a.ready = false; a.last = S.time.day;
    gainText(o.x, o.y - 70, '+' + n + ' ' + NAMES[A.product]); Audio.sfx('pick'); save();
    return;
  }
  const hearts = Math.round(a.affection / 20);
  const st = a.baby ? 'filhote' : a.fedDay === S.time.day ? 'alimentado(a) hoje' : 'com fome';
  const ch = [];
  if (a.fedDay !== S.time.day) ch.push({ t: (S.bag.racao || 0) > 0 ? 'Alimentar (ração)' : 'Alimentar', fn: () => {
    if (!(S.bag.racao > 0)) { say(['Você não tem ração. Compre no Armazém ou crie com 2 fibras (ou 1 trigo).']); return; }
    S.bag.racao--; a.fedDay = S.time.day; Audio.sfx('pick'); burst(o.x, o.y - 30, '#e0c060', 8, 70); save(); } });
  if (a.petDay !== S.time.day) ch.push({ t: 'Carinho', fn: () => { a.petDay = S.time.day; a.affection = Math.min(100, a.affection + 6); Audio.sfx('heal'); burst(o.x, o.y - 50, '#ff9ec7', 8, 60); save(); } });
  ch.push({ t: 'Tchau' });
  say([a.name + ' (' + A.name + ') · ' + st + ' · afeição ' + '♥'.repeat(hearts) + '♡'.repeat(5 - hearts)], null, ch);
}
function drawAnimal(o, list) {
  const a = o.a, A = ANIMALS[a.kind], night = gameHour() >= 21 || gameHour() < 5;
  shadow(o.x, o.y, 26 * A.size * (a.baby ? 0.6 : 1), 8, 0.25);
  const anim = night ? 'sleep' : o.moving ? 'walk' : (a.fedDay === S.time.day && Math.sin(time + o.x) > 0.3 ? 'work' : 'idle');
  let ok = false;
  if (Char3D && Q().npc3d) ok = Char3D.drawPerson(ctx, 'animal_' + a.kind + (a.baby ? '_b' : ''), { animal: a.kind, baby: a.baby }, anim, time + o.x % 5, o.fx, o.fy, o.x, o.y + 3, KAI3D_SIZE);
  if (!ok) {
    const col = { galinha: '#ffffff', vaca: '#f4f1ea', ovelha: '#e8e4dc', porco: '#f0a0b0' }[a.kind], s = A.size * (a.baby ? 0.6 : 1);
    ctx.fillStyle = '#2a1a22'; ctx.beginPath(); ctx.ellipse(o.x, o.y - 26 * s, 34 * s, 24 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(o.x, o.y - 26 * s, 31 * s, 21 * s, 0, 0, 7); ctx.fill();
  }
  label(a.name, o.x, o.y + 18, 12, '#fff6d8', 0.75);
  if (a.ready) bubble(o.x, o.y - 70 * A.size - 10, '★');
}

// ---------------------------------------------------------------- virada do dia
function farmNewDay() {
  const season = calOf().season, rain = weatherWaters();
  for (const [k, f] of Object.entries(S.farm)) {
    if (!f.crop || f.dead) { f.water = rain; continue; }
    const C = CROPS[f.crop];
    if (!C.seasons.includes(season)) { f.dead = true; continue; }
    const wet = f.water || rain;
    if (wet) { f.dry = 0; if (f.days < C.days) f.days += 1 + (f.fert && Math.random() < 0.5 ? 1 : 0); }
    else { f.dry++; if (f.dry > C.thirst) f.dead = true; }
    f.water = rain;
  }
  const yest = S.time.day - 1;
  for (const a of S.animals) {
    const A = ANIMALS[a.kind], fed = a.fedDay === yest;
    a.affection = clamp(a.affection + (fed ? 5 : -10) + (a.petDay === yest ? 5 : 0), 0, 100);
    a.streak = fed ? a.streak + 1 : 0;
    if (a.baby && S.time.day - a.born >= 5) a.baby = false;
    if (!a.baby && fed && S.time.day - a.last >= A.every && Math.random() < (A.chance || 1)) a.ready = true;
  }
  // filhotes: dois adultos da mesma espécie, felizes e alimentados 3 dias seguidos
  for (const kind of Object.keys(ANIMALS)) {
    const ad = S.animals.filter(a => a.kind === kind && !a.baby && a.streak >= 3 && a.affection >= 70 && S.time.day - a.breedDay >= 7);
    if (ad.length >= 2 && S.animals.length < MAX_ANIMALS) {
      const pl = PLOTS.find(p => p.id === ad[0].plot);
      if (animalsIn(pl).length < MAX_ANIMALS_PLOT) {
        ad[0].breedDay = ad[1].breedDay = S.time.day;
        const name = ANIMAL_NAMES[(S.animals.length * 5 + 3) % ANIMAL_NAMES.length];
        S.animals.push({ id: 'an' + Date.now() % 1e7 + S.animals.length, kind, plot: pl.id, name, born: S.time.day, baby: true, fedDay: 0, petDay: 0, affection: 50, ready: false, last: S.time.day, streak: 0, breedDay: S.time.day });
        setTimeout(() => toast('Nasceu um filhote de ' + ANIMALS[kind].name.toLowerCase() + ': ' + name + '!'), 3500);
      }
    }
  }
  syncAnimals();
}

// ---------------------------------------------------------------- desenho da terra e das plantas
function drawFarm(x0, y0, x1, y1) {
  for (const pl of ownedPlots()) {
    if (pl.x1 < x0 || pl.x0 > x1 || pl.y1 < y0 || pl.y0 > y1) continue;
    if (plotMode(pl) === 'pasto') {
      ctx.fillStyle = 'rgba(160,210,90,0.18)'; ctx.fillRect(pl.x0, pl.y0, pl.x1 - pl.x0, pl.y1 - pl.y0);
      // cerca do pasto
      ctx.fillStyle = '#7a4a2a';
      for (let x = pl.x0; x <= pl.x1; x += 40) { ctx.fillRect(x - 3, pl.y0 - 26, 6, 26); ctx.fillRect(x - 3, pl.y1 - 26, 6, 26); }
      ctx.fillRect(pl.x0, pl.y0 - 20, pl.x1 - pl.x0, 4); ctx.fillRect(pl.x0, pl.y1 - 20, pl.x1 - pl.x0, 4);
      continue;
    }
    for (const [k, f] of Object.entries(S.farm)) {
      if (!k.startsWith(pl.id + ':')) continue;
      const [, i, j] = k.split(':').map(Number), tx = pl.x0 + i * TILE_F, ty = pl.y0 + j * TILE_F;
      ctx.fillStyle = f.water ? '#5a3a20' : '#8a5a34'; ctx.fillRect(tx + 2, ty + 2, TILE_F - 4, TILE_F - 4);
      ctx.fillStyle = f.water ? '#4a2e18' : '#74482a'; for (let r = 0; r < 3; r++) ctx.fillRect(tx + 6, ty + 10 + r * 13, TILE_F - 12, 3);
      if (!f.crop) continue;
      const C = CROPS[f.crop], cx = tx + TILE_F / 2, cy = ty + TILE_F * 0.7, st = f.dead ? -1 : Math.min(3, Math.floor(f.days / C.days * 3 + (f.days >= C.days ? 1 : 0)));
      if (st < 0) { ctx.fillStyle = '#6a5a3a'; ctx.fillRect(cx - 8, cy - 10, 16, 10); ctx.fillRect(cx - 2, cy - 18, 4, 10); continue; }
      ctx.fillStyle = '#3f8a37';
      if (st === 0) { ctx.fillRect(cx - 2, cy - 6, 4, 6); ctx.fillRect(cx - 6, cy - 8, 4, 3); ctx.fillRect(cx + 2, cy - 8, 4, 3); }
      else if (st === 1) { ctx.fillRect(cx - 2, cy - 16, 4, 16); ctx.fillRect(cx - 10, cy - 14, 8, 5); ctx.fillRect(cx + 2, cy - 18, 8, 5); }
      else if (st === 2) { ctx.fillStyle = '#4f9a40'; ctx.beginPath(); ctx.ellipse(cx, cy - 12, 14, 12, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#2f6b2a'; ctx.fillRect(cx - 1, cy - 20, 2, 18); }
      else {
        // maduro: desenho próprio de cada planta
        if (f.crop === 'couve') { ctx.fillStyle = '#1f4f2c'; ctx.beginPath(); ctx.ellipse(cx, cy - 12, 18, 13, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#5fae4a'; ctx.beginPath(); ctx.ellipse(cx - 2, cy - 14, 11, 8, 0, 0, 7); ctx.fill(); }
        else if (f.crop === 'abobora') { ctx.fillStyle = '#3f8a37'; ctx.fillRect(cx - 18, cy - 6, 36, 4); ctx.fillStyle = '#c05a1a'; ctx.beginPath(); ctx.ellipse(cx, cy - 12, 18, 13, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#e88a3a'; ctx.beginPath(); ctx.ellipse(cx - 3, cy - 14, 11, 9, 0, 0, 7); ctx.fill(); }
        else if (f.crop === 'trigo') { for (let s2 = -2; s2 <= 2; s2++) { ctx.fillStyle = '#c8a040'; ctx.fillRect(cx + s2 * 6 - 1, cy - 30, 3, 30); ctx.fillStyle = '#e8c860'; ctx.fillRect(cx + s2 * 6 - 2, cy - 34, 5, 9); } }
        else if (f.crop === 'tomate' || f.crop === 'morango') { ctx.fillStyle = '#3f8a37'; ctx.beginPath(); ctx.ellipse(cx, cy - 14, 15, 13, 0, 0, 7); ctx.fill(); ctx.fillStyle = C.col; for (const [a, b] of [[-7, -16], [6, -10], [0, -22], [8, -20]]) { ctx.beginPath(); ctx.arc(cx + a, cy + b, f.crop === 'tomate' ? 5 : 4, 0, 7); ctx.fill(); } }
        else { ctx.fillStyle = '#3f8a37'; for (let s2 = -2; s2 <= 2; s2++) ctx.fillRect(cx + s2 * 5 - 1, cy - 22 + Math.abs(s2) * 3, 3, 16); ctx.fillStyle = C.col; ctx.beginPath(); ctx.ellipse(cx, cy - 4, 8, 6, 0, 0, 7); ctx.fill(); }
        if (Math.sin(time * 4 + cx) > 0.6) sparkle(cx, cy - 26, '#fff6b0');
      }
    }
  }
}
// barra da fazenda (aparece dentro de um terreno de horta)
function drawFarmBar() {
  if (area !== 'world' || menu || dialog || work) return;
  const pl = plotAt(player.x, player.y); if (!pl || plotMode(pl) !== 'horta') return;
  const sd = selSeed(), bw = 330, bx = (W - bw) / 2, by = H - 52 - SAFE.b;
  ctx.fillStyle = 'rgba(20,24,20,0.72)'; ctx.beginPath(); ctx.roundRect(bx, by, bw, 40, 10); ctx.fill();
  panelButton('◀', bx + 6, by + 6, 28, 28, () => cycleSeed(-1), sd ? null : 'off');
  if (sd) { drawIcon('sem_' + sd, bx + 50, by + 20, 22); text(CROPS[sd].name + ' x' + S.bag['sem_' + sd], bx + 66, by + 20, 13, '#fff6e6', 700, 120); }
  else text('Sem sementes (Armazém)', bx + 44, by + 20, 12, '#cfc3a6', 600, 150);
  panelButton('▶', bx + 188, by + 6, 28, 28, () => cycleSeed(1), sd ? null : 'off');
  text((S.tools.enxada ? '✓' : '✗') + ' enxada  ' + (S.tools.regador ? '✓' : '✗') + ' regador  adubo x' + (S.bag.adubo || 0), bx + 222, by + 20, 10, '#e8dcc0', 600, 104);
}
