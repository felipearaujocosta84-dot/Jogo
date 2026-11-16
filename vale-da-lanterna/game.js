/* Vale da Lanterna — lógica do jogo: estado, missões, criação de itens, combate, desenho e interface. */
'use strict';

let MINI = null;

// ---------------------------------------------------------------- estado salvo
function newSave() {
  return {
    stage: 0, relics: { petala: false, orvalho: false, brasa: false }, got: {}, kills: {},
    coins: 0, maxHp: 5, chest: false, bossDead: false, done: false,
    inv: { madeira: 0, pedra: 0, fibra: 0, flor: 0, cogumelo: 0, seiva: 0, cristal: 0 },
    bag: { pocao: 0, torta: 0, feixe: 0 },
    eq: { espada: 1, armadura: false, botas: false, coleira: false },
    q: { ferro: 0, torta: 0, gato: 0, caca: 0, artesao: 0 }, cat: 'none', mkills: 0, crafted: {}, pos: null, moved: false
  };
}
let S = newSave();
const hasSave = () => { const s = load(SAVE_KEY); return !!(s && (s.stage > 0 || s.coins > 0 || s.moved)); };
function save() { S.pos = { area, x: Math.round(player.x), y: Math.round(player.y) }; store(SAVE_KEY, S); }
const relicCount = () => (S.relics.petala ? 1 : 0) + (S.relics.orvalho ? 1 : 0) + (S.relics.brasa ? 1 : 0);
const florlumeCount = () => Object.keys(S.got).filter(k => k.startsWith('flor')).length;
const hortaKills = () => REGIONS.horta.foes.filter(f => S.kills[f.id]).length;

// ---------------------------------------------------------------- receitas e itens
const NAMES = { madeira: 'Madeira', pedra: 'Pedra', fibra: 'Fibra', flor: 'Flor', cogumelo: 'Cogumelo', seiva: 'Seiva', cristal: 'Cristal',
  pocao: 'Poção de Cura', torta: 'Torta', feixe: 'Feixe de Lenha', moeda: 'Moeda' };
const RECIPES = [
  { id: 'pocao', name: 'Poção de Cura', desc: 'Recupera 3 corações', need: { flor: 2, cogumelo: 1 }, icon: 'pocao' },
  { id: 'feixe', name: 'Feixe de Lenha', desc: 'Lenha boa para fogueira', need: { madeira: 4, fibra: 1 }, icon: 'feixe' },
  { id: 'espada2', name: 'Espada de Pedra', desc: 'Dano 2', need: { madeira: 3, pedra: 4 }, station: true, icon: 'espada2', has: () => S.eq.espada >= 2 },
  { id: 'espada3', name: 'Espada de Cristal', desc: 'Dano 3', need: { madeira: 2, cristal: 3, seiva: 2 }, station: true, icon: 'espada3', has: () => S.eq.espada >= 3 },
  { id: 'armadura', name: 'Armadura de Folhas', desc: '+2 corações', need: { fibra: 6, madeira: 3 }, station: true, icon: 'armadura', has: () => S.eq.armadura },
  { id: 'botas', name: 'Botas de Vento', desc: 'Corre 30% mais rápido', need: { fibra: 4, seiva: 3 }, station: true, icon: 'botas', has: () => S.eq.botas },
  { id: 'coleira', name: 'Coleira do Floco', desc: 'Floco morde mais forte', need: { pedra: 3, seiva: 2 }, station: true, icon: 'coleira', has: () => S.eq.coleira }
];
function canCraft(r) { return Object.entries(r.need).every(([k, n]) => S.inv[k] >= n); }
function craft(r) {
  if (!canCraft(r) || (r.has && r.has())) return;
  for (const [k, n] of Object.entries(r.need)) S.inv[k] -= n;
  if (r.id === 'pocao') S.bag.pocao++;
  else if (r.id === 'feixe') S.bag.feixe++;
  else if (r.id === 'espada2') S.eq.espada = Math.max(S.eq.espada, 2);
  else if (r.id === 'espada3') S.eq.espada = 3;
  else if (r.id === 'armadura') { S.eq.armadura = true; S.maxHp += 2; player.hp = S.maxHp; }
  else if (r.id === 'botas') S.eq.botas = true;
  else if (r.id === 'coleira') S.eq.coleira = true;
  S.crafted[r.id] = true;
  Audio.sfx('craft');
  toast('Criado: ' + r.name + '!');
  save();
}
function useItem(k) {
  if (!S.bag[k] || player.hp >= S.maxHp) { if (player.hp >= S.maxHp) toast('Vida já está cheia'); return; }
  S.bag[k]--;
  player.hp = k === 'torta' ? S.maxHp : Math.min(S.maxHp, player.hp + 3);
  Audio.sfx('heal'); burst(player.x, player.y - 40, '#ff8aa0', 12);
  save();
}
let toastMsg = null;
function toast(t) { toastMsg = { t, life: 2.2 }; }

// ---------------------------------------------------------------- missões
function questList() {
  const main = {
    title: 'A Lanterna Apagada', giver: 'Vó Aurora', main: true, done: S.done,
    steps: [
      { t: 'Falar com a Vó Aurora na Praça', ok: S.stage >= 1 },
      { t: 'Pétala Solar: 5 flores-lume para a Mel (Vila do Rio) ' + Math.min(5, florlumeCount()) + '/5', ok: S.relics.petala },
      { t: 'Orvalho do Poço: espantar os Musgos da Horta ' + hortaKills() + '/5', ok: S.relics.orvalho },
      { t: 'Brasa Eterna: levar um Feixe de Lenha a Rui e Lina (Penhasco)', ok: S.relics.brasa },
      { t: 'Derrotar o Musgo Ancião (Torre)', ok: S.bossDead },
      { t: 'Abrir a porta da Torre', ok: S.done }
    ]
  };
  const side = [
    { id: 'ferro', title: 'Ferro e Fogo', giver: 'Bruno — Oficina, Praça', st: S.q.ferro, prog: 'Pedras ' + Math.min(S.inv.pedra, 5) + '/5', desc: 'Quebre rochas com a espada e leve 5 pedras.' },
    { id: 'artesao', title: 'Aprendiz de Artesão', giver: 'Bruno — Oficina, Praça', st: S.q.artesao, prog: 'Itens diferentes ' + Math.min(3, Object.keys(S.crafted).length) + '/3', desc: 'Crie 3 itens diferentes.' },
    { id: 'torta', title: 'Torta de Cogumelos', giver: 'Rosa — Padaria, Vila do Rio', st: S.q.torta, prog: 'Cogumelos ' + Math.min(S.inv.cogumelo, 3) + '/3', desc: 'Cogumelos crescem perto das árvores.' },
    { id: 'gato', title: 'Cadê a Bolinha?', giver: 'Téo — Casa do Téo, Praça', st: S.q.gato, prog: S.cat === 'follow' ? 'Leve a Bolinha pra casa' : 'Procure no Bosque Norte', desc: 'A gatinha fugiu para o norte da Torre.' },
    { id: 'caca', title: 'Caça aos Musgos', giver: 'Vó Aurora — Praça', st: S.q.caca, prog: 'Musgos ' + Math.min(S.mkills, 20) + '/20', desc: 'Derrote 20 Musgos pelo vale.' }
  ];
  return { main, side };
}
function objective() {
  if (S.stage === 0) return 'Fale com a Vó Aurora na Praça';
  const n = relicCount();
  if (n < 3) {
    const r = regionAt(player.x, player.y);
    if (area === 'world' && r) {
      if (r.id === 'vila' && !S.relics.petala) return 'Flores-lume: ' + Math.min(5, florlumeCount()) + '/5 — leve para a Mel';
      if (r.id === 'horta' && !S.relics.orvalho) return hortaKills() < 5 ? 'Musgos na horta: ' + hortaKills() + '/5' : 'Fale com o Seu Tomé';
      if (r.id === 'penhasco' && !S.relics.brasa) return S.bag.feixe ? 'Entregue o Feixe de Lenha' : 'Crie um Feixe de Lenha (Mochila → Criar)';
    }
    return 'Relíquias ' + n + '/3 — veja as Missões';
  }
  if (!S.bossDead) return 'Leve as relíquias à Torre (leste)';
  return 'Abra a porta da Torre';
}
function questTargets() {
  const T = [];
  const npcPos = id => { for (const r of REGION_LIST) for (const n of r.npcs) if (n.id === id) return toWorld(r, n.x, n.y); return null; };
  const doorPos = to => { for (const r of REGION_LIST) for (const d of r.doors) if (d.to === to) return toWorld(r, d.x, d.y); return null; };
  if (S.stage === 0) T.push(npcPos('aurora'));
  else if (relicCount() < 3) {
    if (!S.relics.petala) T.push(npcPos('mel'));
    if (!S.relics.orvalho) T.push(npcPos('tome'));
    if (!S.relics.brasa) T.push(npcPos('camp'));
  } else if (!S.done) T.push([6750, 2300]);
  const side = [];
  if (S.q.ferro === 1 || (S.q.artesao === 1 && Object.keys(S.crafted).length >= 3)) side.push(doorPos('oficina'));
  if (S.q.torta === 1) side.push(doorPos('padaria'));
  if (S.cat === 'lost') side.push(CAT_SPOT);
  if (S.cat === 'follow') side.push(doorPos('casaTeo'));
  return { main: T.filter(Boolean), side: side.filter(Boolean) };
}

// ---------------------------------------------------------------- entidades e áreas
let mode = 'loading';             // loading | title | play | end
let area = 'world';
let grid = null;
let npcs = [], items = [], enemies = [];
const world = { npcs: [], items: [], enemies: [] };
let interiorDef = null;
const player = { x: 0, y: 0, dir: 'down', fx: 0, fy: 1, hp: 5, inv: 0, atk: 0, atkCd: 0, anim: 0, moving: false, kx: 0, ky: 0 };
const dog = { x: 0, y: 0, flip: false, anim: 0, cd: 0, moving: false, target: null, bark: 0 };
const cat = { x: 0, y: 0, flip: false, anim: 0 };
let particles = [], floaters = [];
let dialog = null, fade = null, banner = null, shake = 0, interactTarget = null, menu = null, showMap = false;
let time = 0, bossRef = null, flash = 0, curRegion = null, spawnT = 0, saveT = 0, regrowT = 0, allowPortrait = false;
let cam = { x: 0, y: 0 }, view = { s: 1, vw: 0, vh: 0 };

function walkable(x, y) {
  const g = grid; const cx = Math.floor(x / g.cell), cy = Math.floor(y / g.cell);
  if (cx < 0 || cy < 0 || cx >= g.cols || cy >= g.rows) return false;
  return g.m[cy * g.cols + cx] === 1;
}
function nearestWalkable(x, y) {
  if (walkable(x, y)) return [x, y];
  for (let r = 8; r < 400; r += 8) for (let a = 0; a < 16; a++) {
    const nx = x + Math.cos(a / 16 * Math.PI * 2) * r, ny = y + Math.sin(a / 16 * Math.PI * 2) * r;
    if (walkable(nx, ny)) return [nx, ny];
  }
  return [x, y];
}
function moveBody(b, dx, dy, test = walkable) {
  const fx = b.x + dx, fy = b.y + dy;
  if (test(fx, fy)) { b.x = fx; b.y = fy; return true; }
  if (dx && test(fx, b.y)) { b.x = fx; return true; }
  if (dy && test(b.x, fy)) { b.y = fy; return true; }
  return false;
}
const inSafe = (x, y) => { const r = regionAt(x, y); return !!(r && r.safe); };
const enemyWalk = (x, y) => walkable(x, y) && !inSafe(x, y);

function buildWorldEntities() {
  world.npcs = []; world.items = []; world.enemies = [];
  for (const r of REGION_LIST) {
    for (const n of r.npcs) { const [x, y] = toWorld(r, n.x, n.y); world.npcs.push(Object.assign({}, n, { x, y })); }
    for (const it of r.items) {
      if (S.got[it.id]) continue;
      const [x, y] = toWorld(r, it.x, it.y);
      world.items.push(Object.assign({}, it, { x, y, t: rand(0, 6) }));
    }
    for (const f of (r.foes || [])) if (!S.kills[f.id]) { const [x, y] = toWorld(r, f.x, f.y); world.enemies.push(makeMusgo(x, y, f.id)); }
  }
}
function setArea(id, x, y) {
  area = id;
  if (id === 'world') {
    grid = worldGrid; interiorDef = null;
    npcs = world.npcs; items = world.items; enemies = world.enemies;
  } else {
    interiorDef = INTERIORS[id];
    grid = interiorDef.grid;
    npcs = interiorDef.npcs.map(n => Object.assign({}, n, { x: n.x * TILE, y: n.y * TILE }));
    items = []; enemies = [];
    banner = { text: interiorDef.name, t: 2.2 };
  }
  [player.x, player.y] = nearestWalkable(x, y);
  player.kx = player.ky = 0;
  [dog.x, dog.y] = nearestWalkable(player.x - 50, player.y + 10);
  [cat.x, cat.y] = nearestWalkable(player.x + 40, player.y + 16);
  particles = []; floaters = [];
  bossRef = enemies.find(e => e.boss) || null;
  snapCamera();
  save();
}
function enterInterior(id, fromDoor) {
  fade = { t: 0, dur: 0.6, mid: () => {
    const I = INTERIORS[id];
    I.returnTo = fromDoor;
    setArea(id, I.pw / 2, I.ph - 60);
  } };
  Audio.sfx('door');
}
function exitInterior() {
  const back = interiorDef.returnTo;
  fade = { t: 0, dur: 0.6, mid: () => setArea('world', back[0], back[1] + 40) };
  Audio.sfx('door');
}
function makeMusgo(x, y, id, kind) {
  const boss = kind === 'boss', azul = kind === 'azul';
  return { x, y, id: id || null, boss, azul, wild: kind === 'wild' || azul, hp: boss ? 30 : azul ? 5 : 3, maxHp: boss ? 30 : azul ? 5 : 3,
    r: boss ? 56 : 24, kx: 0, ky: 0, t: rand(0, 3), wander: rand(0, 6.28), wt: 0, hurt: 0, speed: boss ? 62 : rand(48, 66) * (azul ? 1.15 : 1),
    state: 'chase', st: boss ? 2.5 : 0, spawnT: 6, z: 0, tx: 0, ty: 0, born: boss ? 1.2 : 0 };
}
function spawnEnemy(e) { enemies.push(e); return e; }

// ---------------------------------------------------------------- diálogos
const PORTRAIT = { 'Vó Aurora': 'aurora', 'Mel': 'mel', 'Seu Tomé': 'tome', 'Lina': 'lina', 'Rui': 'rui', 'Kai': 'kai', 'Bruno': 'bruno', 'Rosa': 'rosa', 'Téo': 'teo' };
function say(lines, done, choices) {
  dialog = { lines: lines.map(l => {
    const m = /^([^:]{2,14}):\s(.*)$/.exec(l);
    return m ? { who: m[1], text: m[2] } : { who: '', text: l };
  }), i: 0, shown: 0, done, choices };
}
function advanceDialog() {
  const l = dialog.lines[dialog.i];
  if (dialog.shown < l.text.length) { dialog.shown = l.text.length; return; }
  if (dialog.choices && dialog.i === dialog.lines.length - 1) return;
  dialog.i++; dialog.shown = 0; Audio.sfx('ui');
  if (dialog.i >= dialog.lines.length) { const d = dialog.done; dialog = null; if (d) d(); }
}
function choose(c) { Audio.sfx('ui'); dialog = null; if (c.fn) c.fn(); }
function giveRelic(key, name) {
  S.relics[key] = true; Audio.sfx('relic'); flash = 0.6;
  floaters.push({ x: player.x, y: player.y - 120, text: name + '!', t: 2.2, col: '#ffe38a' });
  save();
}
function talkTo(n) {
  const id = n.id;
  if (id === 'aurora') {
    player.hp = S.maxHp;
    if (S.stage === 0) {
      say(['Vó Aurora: Kai! Floco! Que bom que vocês chegaram.',
        'Vó Aurora: Ontem à noite a Lanterna da Torre se apagou... e os Musgos acordaram pelo vale inteiro.',
        'Vó Aurora: Para reacendê-la precisamos de 3 relíquias: a Pétala Solar, o Orvalho do Poço e a Brasa Eterna.',
        'Vó Aurora: A Mel, na Vila do Rio (a oeste), o Seu Tomé, na Horta (a nordeste), e os viajantes Rui e Lina, no Penhasco (sudoeste), podem ajudar.',
        'Vó Aurora: O vale é grande! Abra a Mochila para ver o mapa, criar itens e acompanhar suas missões.',
        'Vó Aurora: E entre nas casas: tem muita gente aqui precisando de uma mãozinha.',
        'Kai: Pode deixar, vó! Vamos, Floco!'], () => { S.stage = 1; save(); Audio.sfx('pick'); });
    } else if (S.q.caca === 1 && S.mkills >= 20) {
      say(['Vó Aurora: Vinte Musgos! O vale está bem mais tranquilo.', 'Vó Aurora: Tome: 30 moedas e 3 cristais que guardei.'],
        () => { S.q.caca = 2; S.coins += 30; S.inv.cristal += 3; Audio.sfx('relic'); save(); });
    } else if (relicCount() < 3) {
      const falta = [];
      if (!S.relics.petala) falta.push('a Pétala Solar (Mel)');
      if (!S.relics.orvalho) falta.push('o Orvalho do Poço (Seu Tomé)');
      if (!S.relics.brasa) falta.push('a Brasa Eterna (Rui e Lina)');
      const lines = ['Vó Aurora: Deixe-me cuidar desses arranhões... pronto, novinho em folha!', 'Vó Aurora: Ainda falta ' + falta.join(', ') + '.'];
      if (S.q.caca === 0) { lines.push('Vó Aurora: Ah! E se puder, derrote 20 Musgos pelo vale. Eles estão demais este ano.'); }
      say(lines, () => { if (S.q.caca === 0) { S.q.caca = 1; toast('Nova missão: Caça aos Musgos'); save(); } });
      Audio.sfx('heal');
    } else if (!S.bossDead) {
      say(['Vó Aurora: As três relíquias! Estão brilhando tanto...', 'Vó Aurora: Leve-as à Torre da Lanterna, bem a leste. Siga a trilha!',
        'Vó Aurora: Mas cuidado... algo grande dorme ao pé da torre.']);
      Audio.sfx('heal');
    } else say(['Vó Aurora: Você conseguiu, Kai. A Lanterna brilha de novo!']);
    return;
  }
  if (id === 'bruno') return talkBruno();
  if (id === 'rosa') return talkRosa();
  if (id === 'teo') return talkTeo();
  if (S.stage === 0) {
    const who = id === 'camp' ? 'Lina' : n.name;
    say([who + ': Oi, Kai! A Vó Aurora estava te procurando lá na Praça.']);
  } else if (id === 'mel') {
    const f = florlumeCount();
    if (S.relics.petala) say(['Mel: Cuidado com os Musgos, viu? O Floco que o diga!', 'Mel: Ah, e pode pegar o que quiser do baú lá de casa.']);
    else if (f < 5) say(['Mel: Oi, Kai! As flores-lume perderam o brilho e se espalharam pela vila.',
      'Mel: Junte 5 delas e eu teço a Pétala Solar pra você! (' + f + '/5)']);
    else say(['Mel: Que lindas! Olha só, voltaram a brilhar!', 'Mel: Aqui está: a Pétala Solar. Leve com carinho!'], () => giveRelic('petala', 'Pétala Solar'));
  } else if (id === 'tome') {
    const k = hortaKills();
    if (S.relics.orvalho) say(['Seu Tomé: Minhas couves agradecem, rapaz!', 'Seu Tomé: Dica: cogumelo nasce na sombra das árvores.']);
    else if (k < 5) say(['Seu Tomé: Ei, rapaz! Esses Musgos estão comendo minhas couves!',
      'Seu Tomé: Espante os 5 que estão na horta e eu te dou o Orvalho do Poço. (' + k + '/5)']);
    else say(['Seu Tomé: Ufa! Minha horta está salva.', 'Seu Tomé: Tome: o Orvalho do Poço, colhido em noite de lua cheia.'], () => giveRelic('orvalho', 'Orvalho do Poço'));
  } else if (id === 'camp') {
    if (S.relics.brasa) say(['Rui: Que fogo bonito, hein?', 'Lina: Boa sorte na torre, Kai!']);
    else if (!S.bag.feixe) say(['Lina: Olá, viajante! Que vista, né?', 'Rui: Nossa fogueira está quase apagando... e é nela que mora a Brasa Eterna.',
      'Lina: Traz um Feixe de Lenha pra gente? Dá pra criar com 4 madeiras e 1 fibra.',
      'Rui: Bata nas árvores para pegar madeira e corte o capim alto para pegar fibra. Depois é só abrir a Mochila e ir em Criar!']);
    else say(['Rui: Um feixe de lenha! Olha como o fogo cresceu!', 'Lina: Leve a Brasa Eterna. Ela nunca se apaga.'],
      () => { S.bag.feixe--; giveRelic('brasa', 'Brasa Eterna'); });
  }
}
function talkBruno() {
  if (S.q.ferro === 0) {
    say(['Bruno: Opa! Sou o Bruno, o ferreiro da praça.', 'Bruno: Minha forja está sem pedra. Me traz 5 pedras? É só bater nas rochas com a espada.',
      'Bruno: Em troca eu libero minha bancada pra você criar espadas, armaduras e botas.'], () => { S.q.ferro = 1; toast('Nova missão: Ferro e Fogo'); save(); });
  } else if (S.q.ferro === 1) {
    if (S.inv.pedra >= 5) say(['Bruno: Isso aí é pedra de primeira!'], null, [
      { t: 'Entregar 5 pedras', fn: () => { S.inv.pedra -= 5; S.q.ferro = 2; S.q.artesao = 1; S.coins += 10; Audio.sfx('relic');
        say(['Bruno: Valeu! A bancada é sua, use quando quiser.', 'Bruno: E se criar 3 itens diferentes, te dou um presente. (+10 moedas)']); save(); } },
      { t: 'Ainda não' }]);
    else say(['Bruno: Ainda faltam pedras. (' + S.inv.pedra + '/5)', 'Bruno: Rochas cinzentas ficam espalhadas pelos campos.']);
  } else if (S.q.artesao === 1 && Object.keys(S.crafted).length >= 3) {
    say(['Bruno: Três criações! Você tem mão boa, garoto.', 'Bruno: Leve estes 2 cristais e 15 moedas.'],
      () => { S.q.artesao = 2; S.inv.cristal += 2; S.coins += 15; Audio.sfx('relic'); save(); });
  } else say(['Bruno: A bancada é toda sua. Cristais azuis aparecem nas rochas do leste.', 'Bruno: Com cristal dá pra fazer a melhor espada do vale!']);
}
function talkRosa() {
  const shop = [{ t: 'Comprar torta (6 moedas)', fn: () => {
    if (S.coins >= 6) { S.coins -= 6; S.bag.torta++; Audio.sfx('coin'); say(['Rosa: Saindo quentinha! A torta recupera toda a vida.']); save(); }
    else say(['Rosa: Ih, faltam moedas, querido.']);
  } }, { t: 'Tchau!' }];
  if (S.q.torta === 0) {
    say(['Rosa: Bem-vindo à padaria! Eu sou a Rosa.', 'Rosa: Queria fazer minha torta de cogumelos, mas não tenho nenhum...',
      'Rosa: Se trouxer 3 cogumelos, te dou duas tortas! Eles crescem perto das árvores, ainda mais na Clareira a oeste.'],
      () => { S.q.torta = 1; toast('Nova missão: Torta de Cogumelos'); save(); });
  } else if (S.q.torta === 1 && S.inv.cogumelo >= 3) {
    say(['Rosa: Cogumelos fresquinhos!', 'Rosa: Aqui estão duas tortas e 10 moedas. Obrigada!'],
      () => { S.inv.cogumelo -= 3; S.q.torta = 2; S.bag.torta += 2; S.coins += 10; Audio.sfx('relic'); save(); });
  } else say(['Rosa: O que vai ser hoje?'], null, shop);
}
function talkTeo() {
  if (S.cat === 'none') say(['Téo: Kai... a minha gatinha Bolinha fugiu!', 'Téo: Eu vi ela correndo pro Bosque Norte, depois da Horta, lá perto da Torre.', 'Téo: Você traz ela de volta?'],
    () => { S.cat = 'lost'; S.q.gato = 1; toast('Nova missão: Cadê a Bolinha?'); save(); });
  else if (S.cat === 'lost') say(['Téo: A Bolinha está no Bosque Norte... ela é laranjinha!']);
  else if (S.cat === 'follow') say(['Téo: BOLINHA!!! Você achou!', 'Téo: Toma, é meu amuleto da sorte. Dizem que ele dá mais coragem! (+1 coração)'],
    () => { S.cat = 'home'; S.q.gato = 2; S.maxHp += 1; player.hp = S.maxHp; S.coins += 10; Audio.sfx('relic'); Audio.sfx('meow'); save(); });
  else say(['Téo: A Bolinha não sai mais do meu lado. Valeu, Kai!']);
}
function interact(t) {
  if (t.kind === 'npc') talkTo(t.ref);
  else if (t.kind === 'door') enterInterior(t.ref.to, [t.x0, t.y0]);
  else if (t.kind === 'tdoor') useTowerDoor();
  else if (t.kind === 'tchest') openTowerChest();
  else if (t.kind === 'cat') { S.cat = 'follow'; Audio.sfx('meow'); say(['Miau!', 'A Bolinha pulou pertinho de você. Leve-a de volta para o Téo, na Praça.']); save(); }
  else if (t.kind === 'furn') {
    const f = t.ref;
    if (f.use === 'bancada') {
      if (S.q.ferro < 2) say(['Bruno: Ei! Essa bancada é minha. Me ajuda primeiro e eu deixo você usar.']);
      else { menu = { tab: 'craft', station: true }; Audio.sfx('ui'); }
    } else if (f.use === 'bed') {
      fade = { t: 0, dur: 1.2, mid: () => { player.hp = S.maxHp; save(); } };
      Audio.sfx('sleep'); toast('Você descansou. Vida cheia e jogo salvo.');
    } else if (f.use === 'chest') {
      if (S.got[f.id]) say(['O baú está vazio.']);
      else {
        S.got[f.id] = true;
        const loot = CHEST_LOOT[f.id], parts = [];
        for (const [k, n] of Object.entries(loot)) {
          if (k === 'moeda') S.coins += n; else if (k in S.inv) S.inv[k] += n; else S.bag[k] += n;
          parts.push(n + ' ' + NAMES[k]);
        }
        Audio.sfx('relic'); say(['Você abriu o baú: ' + parts.join(', ') + '.']); save();
      }
    }
  }
}
function openTowerChest() {
  if (S.chest) { say(['O baú está vazio.']); return; }
  S.chest = true; S.maxHp += 1; player.hp = S.maxHp; S.coins += 15; S.inv.cristal += 1;
  Audio.sfx('relic');
  say(['Você abriu o baú antigo!', 'Coração extra (+1 vida máxima), 15 moedas e 1 cristal.']);
  save();
}
function useTowerDoor() {
  if (relicCount() < 3) { Audio.sfx('door'); say(['A porta da torre está selada.', 'Três encaixes vazios brilham fraquinho: uma pétala, uma gota e uma chama.']); return; }
  if (!S.bossDead) { say(['Derrote o Musgo Ancião antes!']); return; }
  say(['Kai encaixa a Pétala Solar, o Orvalho do Poço e a Brasa Eterna...', 'A porta se abre. Floco sobe as escadas na frente, abanando o rabo.',
    'Lá no alto... a LANTERNA SE ACENDE!'], () => { S.done = true; save(); mode = 'end'; endT = 0; Audio.sfx('relic'); });
}

// ---------------------------------------------------------------- entrada
const input = { joy: null, keys: {} };
let uiButtons = [];
const btn = { action: { x: 0, y: 0, r: 44 } };
function layoutButtons() { btn.action.x = W - 76 - SAFE.r; btn.action.y = H - 76 - SAFE.b; }
const inCircle = (x, y, c, pad = 0) => Math.hypot(x - c.x, y - c.y) <= c.r + pad;
function addBtn(x, y, w, h, fn) { uiButtons.push({ x, y, w, h, fn }); }
function hitUI(x, y) {
  for (let i = uiButtons.length - 1; i >= 0; i--) { const b = uiButtons[i]; if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { b.fn(); return true; } }
  return false;
}
const rotateNeeded = () => H > W && !allowPortrait;

cv.addEventListener('pointerdown', e => {
  e.preventDefault();
  Audio.init();
  const x = e.clientX, y = e.clientY;
  if (hitUI(x, y)) return;
  if (mode !== 'play' || rotateNeeded()) return;
  if (menu) return;
  if (showMap) { showMap = false; return; }
  if (dialog) { if (!(dialog.choices && dialog.i === dialog.lines.length - 1 && dialog.shown >= dialog.lines[dialog.i].text.length)) advanceDialog(); return; }
  if (inCircle(x, y, btn.action, 16)) { pressAction(); return; }
  if (!input.joy && x < W * 0.55) input.joy = { id: e.pointerId, ox: x, oy: y, x, y };
});
cv.addEventListener('pointermove', e => { if (input.joy && e.pointerId === input.joy.id) { input.joy.x = e.clientX; input.joy.y = e.clientY; } });
const endPointer = e => { if (input.joy && e.pointerId === input.joy.id) input.joy = null; };
cv.addEventListener('pointerup', endPointer);
cv.addEventListener('pointercancel', endPointer);
window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  input.keys[k] = true;
  Audio.init();
  if (mode === 'title' && (k === 'enter' || k === ' ')) { titleStart && titleStart(); return; }
  if (mode !== 'play') return;
  if (k === 'escape') { menu = null; showMap = false; return; }
  if (k === 'i' || k === 'tab') { e.preventDefault(); menu = menu ? null : { tab: 'bag' }; return; }
  if (k === 'm') { showMap = !showMap; return; }
  if (k === 'q') { useItem(S.bag.pocao ? 'pocao' : 'torta'); return; }
  if (dialog && dialog.choices && dialog.i === dialog.lines.length - 1 && dialog.shown >= dialog.lines[dialog.i].text.length) {
    const n = parseInt(k, 10); if (n >= 1 && n <= dialog.choices.length) choose(dialog.choices[n - 1]);
    if (k === ' ' || k === 'enter') choose(dialog.choices[0]);
    return;
  }
  if (k === ' ' || k === 'j' || k === 'e' || k === 'enter' || k === 'z') {
    e.preventDefault();
    if (menu || showMap) return;
    if (dialog) advanceDialog(); else pressAction();
  }
});
window.addEventListener('keyup', e => { input.keys[e.key.toLowerCase()] = false; });

function pressAction() { if (fade) return; if (interactTarget) interact(interactTarget); else attack(); }
function readMove() {
  let x = 0, y = 0;
  const k = input.keys;
  if (k['arrowleft'] || k['a']) x -= 1; if (k['arrowright'] || k['d']) x += 1;
  if (k['arrowup'] || k['w']) y -= 1; if (k['arrowdown'] || k['s']) y += 1;
  if (input.joy) {
    const dx = input.joy.x - input.joy.ox, dy = input.joy.y - input.joy.oy, L = Math.hypot(dx, dy), R = 50;
    if (L > R) { input.joy.ox = input.joy.x - dx / L * R; input.joy.oy = input.joy.y - dy / L * R; }
    if (L > 6) { const m = Math.min(1, L / R); x = dx / L * m; y = dy / L * m; }
  }
  const L = Math.hypot(x, y);
  if (L > 1) { x /= L; y /= L; }
  return [x, y];
}

// ---------------------------------------------------------------- combate e coleta
function attack() {
  if (player.atkCd > 0) return;
  player.atk = 0.24; player.atkCd = 0.36;
  Audio.sfx('swing');
  const cx = player.x, cy = player.y - 40, fa = Math.atan2(player.fy, player.fx);
  const inArc = (tx, ty, range) => {
    const dx = tx - cx, dy = ty - cy, d = Math.hypot(dx, dy);
    let da = Math.abs(Math.atan2(dy, dx) - fa); if (da > Math.PI) da = 2 * Math.PI - da;
    return d < range && (da < 1.35 || d < 34) ? d : -1;
  };
  let hitAny = false;
  for (const e of enemies) {
    if (e.born > 0) continue;
    const d = inArc(e.x, e.y - (e.boss ? 50 : 18), 84 + e.r * 0.6);
    if (d >= 0) { hurtEnemy(e, S.eq.espada, (e.x - cx) / (d || 1), (e.y - cy) / (d || 1)); hitAny = true; }
  }
  if (hitAny || area !== 'world') return;
  // props: árvore, rocha, capim
  let best = null, bd = 1e9;
  for (const p of propsNear(player.x - 130, player.y - 130, player.x + 130, player.y + 130)) {
    if (p.t === 'tree' && p.stock > 0) { const d = inArc(p.x, p.y - 40, 105); if (d >= 0 && d < bd) { bd = d; best = p; } }
    if (p.t === 'rock' && p.stock > 0) { const d = inArc(p.x, p.y - 20, 100); if (d >= 0 && d < bd) { bd = d; best = p; } }
    if (p.t === 'tuft' && !p.gone) { const d = inArc(p.x, p.y - 10, 92); if (d >= 0 && d < bd) { bd = d; best = p; } }
  }
  if (!best) return;
  if (best.t === 'tree') {
    best.shake = 0.3; best.stock--; S.inv.madeira++; Audio.sfx('chop');
    burst(best.x, best.y - 90, '#6fb04a', 6, 110); gainText(best.x, best.y - 140, '+1 Madeira');
    if (best.stock <= 0) best.regrow = 75;
  } else if (best.t === 'rock') {
    best.shake = 0.25; best.stock--; Audio.sfx('rock');
    burst(best.x, best.y - 20, '#b9b6ae', 8, 120);
    if (best.crystal) { S.inv.cristal++; gainText(best.x, best.y - 80, '+1 Cristal'); burst(best.x, best.y - 30, '#7fd0ff', 8, 120); }
    else { S.inv.pedra++; gainText(best.x, best.y - 80, '+1 Pedra'); }
    if (best.stock <= 0) { best.regrow = 90; stampGrid(worldGrid, best.x, best.y - 8, 30, 1); }
  } else if (best.t === 'tuft') {
    best.gone = 60; S.inv.fibra++; Audio.sfx('cut');
    burst(best.x, best.y - 10, '#9be36a', 8, 100); gainText(best.x, best.y - 60, '+1 Fibra');
  }
  save();
}
function gainText(x, y, t) { floaters.push({ x, y, text: t, t: 1.3, col: '#fff6d8' }); }
function hurtEnemy(e, dmg, nx, ny) {
  if (e.hurt > 0.12) return;
  e.hp -= dmg; e.hurt = 0.25;
  const kb = e.boss ? 90 : 340; e.kx = nx * kb; e.ky = ny * kb;
  Audio.sfx('hit'); shake = Math.max(shake, e.boss ? 5 : 3);
  burst(e.x, e.y - 20, e.azul ? '#8fd0ff' : '#8fe06a', 7);
  if (e.hp <= 0) killEnemy(e);
}
function killEnemy(e) {
  e.dead = true; Audio.sfx('kill');
  burst(e.x, e.y - 18, e.azul ? '#5fa8e0' : '#7ccf55', e.boss ? 40 : 14, e.boss ? 260 : 150);
  if (e.id) S.kills[e.id] = true;
  S.mkills++;
  const drop = (k, n = 1) => { for (let i = 0; i < n; i++) items.push({ id: null, k, x: e.x + rand(-34, 34), y: e.y + rand(-20, 20), t: 0, drop: 0.35 }); };
  drop('moeda', e.boss ? 20 : 1 + Math.floor(Math.random() * 3));
  if (Math.random() < 0.6 || e.boss) drop('seiva', e.boss ? 4 : 1);
  if (Math.random() < (e.azul ? 0.45 : 0.08) || e.boss) drop('cristal', e.boss ? 3 : 1);
  if (!e.boss && Math.random() < 0.18) drop('coracao');
  if (e.boss) {
    S.bossDead = true; bossRef = null; flash = 1; shake = 14;
    enemies.forEach(o => { if (!o.boss && !o.dead && o.minion) { o.dead = true; burst(o.x, o.y - 12, '#7ccf55', 10); } });
    setTimeout(() => say(['O Musgo Ancião se desfaz em folhas e flores...', 'Kai: Conseguimos, Floco! Agora, a porta!']), 700);
  }
  if (e.id && e.id.startsWith('hm') && hortaKills() === 5) floaters.push({ x: player.x, y: player.y - 120, text: 'Horta livre! Fale com Seu Tomé', t: 2.6, col: '#ffffff' });
  if (S.q.caca === 1 && S.mkills === 20) toast('20 Musgos! Volte à Vó Aurora');
  save();
}
function hurtPlayer(src, dmg) {
  if (player.inv > 0 || mode !== 'play') return;
  player.hp -= dmg; player.inv = 1.1; Audio.sfx('hurt'); shake = 6;
  const dx = player.x - src.x, dy = player.y - src.y, d = Math.hypot(dx, dy) || 1;
  player.kx = dx / d * 400; player.ky = dy / d * 400;
  burst(player.x, player.y - 40, '#ff6b6b', 8);
  if (player.hp <= 0) {
    player.hp = 0;
    fade = { t: 0, dur: 0.9, mid: () => {
      player.hp = S.maxHp; player.inv = 2;
      const [x, y] = [3450, 2390];
      setArea('world', x, y);
      setTimeout(() => say(['Vó Aurora: Kai! Que susto... o Floco te trouxe de volta pra praça.', 'Vó Aurora: Descanse um pouco e tente de novo, viu?']), 400);
    } };
  }
}
function burst(x, y, col, n, sp = 140) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), v = rand(sp * 0.3, sp);
    particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, g: 260, t: rand(0.35, 0.7), max: 0.7, col, s: rand(4, 7) });
  }
}
function collect(it) {
  it.taken = true;
  if (it.id) S.got[it.id] = true;
  if (it.k === 'moeda') { S.coins++; Audio.sfx('coin'); burst(it.x, it.y, '#ffd84a', 5, 90); }
  else if (it.k === 'coracao') { player.hp = Math.min(S.maxHp, player.hp + 1); Audio.sfx('heal'); gainText(it.x, it.y - 30, '+1 ♥'); }
  else if (it.k === 'seiva' || it.k === 'cristal') { S.inv[it.k]++; Audio.sfx('pick'); gainText(it.x, it.y - 30, '+1 ' + NAMES[it.k]); }
  else if (it.k === 'florlume') {
    Audio.sfx('pick'); burst(it.x, it.y, '#ffb3d9', 12, 120);
    floaters.push({ x: it.x, y: it.y - 50, text: 'Flor-lume ' + florlumeCount() + '/5', t: 1.6, col: '#ffd6ec' });
  }
  save();
}

// ---------------------------------------------------------------- atualização
function update(dt) {
  time += dt;
  Audio.tick();
  if (banner) { banner.t -= dt; if (banner.t <= 0) banner = null; }
  if (toastMsg) { toastMsg.life -= dt; if (toastMsg.life <= 0) toastMsg = null; }
  if (flash > 0) flash -= dt;
  shake = Math.max(0, shake - dt * 30);
  if (fade) {
    fade.t += dt;
    if (fade.mid && fade.t >= fade.dur / 2) { const m = fade.mid; fade.mid = null; m(); }
    if (fade.t >= fade.dur) fade = null;
  }
  if (mode !== 'play' || rotateNeeded()) return;
  if (menu || showMap) return;

  if (dialog) {
    const l = dialog.lines[dialog.i];
    if (l && dialog.shown < l.text.length) {
      const before = Math.floor(dialog.shown); dialog.shown += dt * 60;
      if (Math.floor(dialog.shown) !== before && Math.floor(dialog.shown) % 3 === 0) Audio.sfx('talk');
    }
  }
  const busy = !!dialog || !!fade;
  const [mx, my] = busy ? [0, 0] : readMove();
  const spd = 250 * (S.eq.botas ? 1.3 : 1);
  player.moving = Math.hypot(mx, my) > 0.1;
  if (player.moving) {
    const L = Math.hypot(mx, my); player.fx = mx / L; player.fy = my / L;
    player.dir = Math.abs(mx) > Math.abs(my) * 1.1 ? (mx < 0 ? 'left' : 'right') : (my < 0 ? 'up' : 'down');
    moveBody(player, mx * spd * dt, my * spd * dt);
    player.anim += dt * 10 * (S.eq.botas ? 1.2 : 1);
    if (!S.moved) S.moved = true;
  } else player.anim = 0;
  if (Math.abs(player.kx) + Math.abs(player.ky) > 5) {
    moveBody(player, player.kx * dt, player.ky * dt);
    player.kx *= Math.pow(0.0015, dt); player.ky *= Math.pow(0.0015, dt);
  }
  player.inv = Math.max(0, player.inv - dt);
  player.atk = Math.max(0, player.atk - dt);
  player.atkCd = Math.max(0, player.atkCd - dt);

  updateDog(dt);
  updateCat(dt);
  for (const e of enemies) if (!e.dead) updateEnemy(e, dt, busy);
  for (let i = enemies.length - 1; i >= 0; i--) if (enemies[i].dead) enemies.splice(i, 1);

  for (const it of items) {
    it.t += dt;
    if (it.drop > 0) { it.drop -= dt; continue; }
    const d = Math.hypot(it.x - player.x, it.y - (player.y - 10));
    if (!it.id && d < 130) { it.x += (player.x - it.x) * dt * 6; it.y += (player.y - 10 - it.y) * dt * 6; }
    if (d < 50) collect(it);
  }
  for (let i = items.length - 1; i >= 0; i--) if (items[i].taken) items.splice(i, 1);

  if (area === 'world') updateWorld(dt, busy);
  else if (!busy && interiorDef && player.y > interiorDef.ph - 22 && Math.abs(player.x - interiorDef.pw / 2) < 44) exitInterior();

  findInteract(busy);
  saveT += dt; if (saveT > 6) { saveT = 0; save(); }

  for (const p of particles) { if (p.smoke) p.s += dt * 14; p.t -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.g || 0) * dt; p.vx *= Math.pow(0.4, dt); }
  particles = particles.filter(p => p.t > 0);
  for (const f of floaters) { f.t -= dt; f.y -= 30 * dt; }
  floaters = floaters.filter(f => f.t > 0);
  ambient(dt);
  updateCamera(dt);
}
function updateWorld(dt, busy) {
  // região atual e nomes
  const r = regionAt(player.x, player.y);
  if (r !== curRegion) {
    curRegion = r;
    if (r) banner = { text: r.name, t: 2.4 };
  }
  if (!r) for (const lm of LANDMARKS) {
    const d = Math.hypot(lm.x - player.x, lm.y - player.y);
    if (d < 450 && !lm.seen) { lm.seen = true; banner = { text: lm.name, t: 2.4 }; }
    if (d > 900) lm.seen = false;
  }
  // coleta de flores e cogumelos
  for (const p of propsNear(player.x - 60, player.y - 60, player.x + 60, player.y + 60)) {
    if ((p.t === 'flower' || p.t === 'mush') && !p.gone && Math.hypot(p.x - player.x, p.y - player.y) < 46) {
      p.gone = 100;
      const k = p.t === 'flower' ? 'flor' : 'cogumelo';
      S.inv[k]++; Audio.sfx('pick'); gainText(p.x, p.y - 50, '+1 ' + NAMES[k]);
      burst(p.x, p.y - 10, p.t === 'flower' ? p.col : '#e05050', 6, 90);
    }
  }
  regrowT += dt;
  if (regrowT > 0.5) {
    for (const p of props) {
      if (p.gone > 0) p.gone -= regrowT;
      if (p.regrow > 0) { p.regrow -= regrowT; if (p.regrow <= 0) { p.stock = p.t === 'rock' ? (p.crystal ? 2 : 3) : 3; if (p.t === 'rock') stampGrid(worldGrid, p.x, p.y - 8, 30, 0); } }
    }
    regrowT = 0;
  }
  // Musgos selvagens
  spawnT -= dt;
  const wild = enemies.filter(e => e.wild).length;
  if (spawnT <= 0 && S.stage >= 1 && wild < 16) {
    spawnT = 2.2;
    for (let tries = 0; tries < 6; tries++) {
      const a = rand(0, 6.28), d = rand(800, 1250);
      const x = player.x + Math.cos(a) * d, y = player.y + Math.sin(a) * d;
      if (!enemyWalk(x, y) || regionAt(x, y)) continue;
      spawnEnemy(makeMusgo(x, y, null, (x > 5500 || y < 1200) && Math.random() < 0.55 ? 'azul' : 'wild'));
      break;
    }
  }
  for (const e of enemies) if (e.wild && Math.hypot(e.x - player.x, e.y - player.y) > 2400) e.dead = true;
  // chefe
  if (!bossRef && relicCount() === 3 && !S.bossDead && r && r.id === 'torre') {
    const [bx, by] = [6750, 2720];
    bossRef = spawnEnemy(makeMusgo(bx, by, null, 'boss'));
    banner = { text: 'Musgo Ancião!', t: 2.4 }; Audio.sfx('slam'); shake = 10;
  }
}
function findInteract(busy) {
  interactTarget = null;
  if (busy) return;
  let best = 1e9;
  const consider = (d, max, t) => { if (d < max && d < best) { best = d; interactTarget = t; } };
  for (const n of npcs) if (!n.deco) consider(Math.hypot(n.x - player.x, n.y - player.y), n.hidden ? 140 : 110, { kind: 'npc', ref: n, x: n.x, y: n.y - (n.hidden ? 90 : 120), label: 'Falar' });
  if (area === 'world') {
    for (const r of REGION_LIST) {
      if (Math.abs(r.ox + r.iw * IS / 2 - player.x) > r.iw * IS && Math.abs(r.oy - player.y) > r.ih * IS * 2) continue;
      for (const d of r.doors) {
        const [x, y] = toWorld(r, d.x, d.y);
        consider(Math.hypot(x - player.x, y - player.y), 110, { kind: 'door', ref: d, x, y: y - 90, x0: x, y0: y, label: 'Entrar' });
      }
    }
    const T = REGIONS.torre;
    const [dx, dy] = toWorld(T, T.door.x, T.door.y);
    consider(Math.hypot(dx - player.x, dy - player.y), 120, { kind: 'tdoor', x: dx, y: dy - 160, label: 'Porta' });
    const [cx, cy] = toWorld(T, T.chest.x, T.chest.y);
    consider(Math.hypot(cx - player.x, cy - player.y), 130, { kind: 'tchest', x: cx, y: cy - 90, label: 'Abrir' });
    if (S.cat === 'lost' || S.cat === 'none') consider(Math.hypot(CAT_SPOT[0] - player.x, CAT_SPOT[1] - player.y), 100, { kind: 'cat', x: CAT_SPOT[0], y: CAT_SPOT[1] - 60, label: 'Pegar' });
  } else {
    for (const f of interiorDef.furn) if (f.use) {
      const x = (f.x + f.w / 2) * TILE, y = (f.y + f.h) * TILE;
      consider(Math.hypot(x - player.x, y - player.y), 95, { kind: 'furn', ref: f, x, y: f.y * TILE - 10, label: f.use === 'bancada' ? 'Criar' : f.use === 'bed' ? 'Dormir' : 'Abrir' });
    }
  }
}
function updateDog(dt) {
  dog.cd = Math.max(0, dog.cd - dt); dog.bark = Math.max(0, dog.bark - dt);
  let tx = player.x - player.fx * 56 - 30, ty = player.y - player.fy * 36 + 10, spd = 270 * (S.eq.botas ? 1.3 : 1);
  if (!dog.target || dog.target.dead) dog.target = null;
  if (!dog.target && dog.cd <= 0) {
    let best = 200;
    for (const e of enemies) { if (e.born > 0) continue; const d = dist(e, dog); if (d < best && dist(e, player) < 300) { best = d; dog.target = e; } }
  }
  if (dog.target) {
    tx = dog.target.x + (dog.x < dog.target.x ? -22 : 22); ty = dog.target.y; spd = 330;
    if (Math.hypot(dog.target.x - dog.x, dog.target.y - dog.y) < dog.target.r + 26) {
      const e = dog.target;
      hurtEnemy(e, S.eq.coleira ? 2 : 1, Math.sign(e.x - dog.x) || 1, 0);
      Audio.sfx('bark'); dog.bark = 0.5; dog.cd = S.eq.coleira ? 1.0 : 1.6; dog.target = null;
    }
    if (dog.target && dist(dog, player) > 340) dog.target = null;
  }
  const dx = tx - dog.x, dy = ty - dog.y, d = Math.hypot(dx, dy);
  dog.moving = d > 16;
  if (dog.moving) {
    const v = Math.min(spd * (d > 140 ? 1.4 : 1), d * 6) * dt;
    moveBody(dog, dx / d * v, dy / d * v);
    if (Math.abs(dx) > 3) dog.flip = dx < 0;
    dog.anim += dt * 12;
  }
  if (dist(dog, player) > 360) { [dog.x, dog.y] = nearestWalkable(player.x - 50, player.y + 10); burst(dog.x, dog.y - 10, '#ffffff', 6, 80); }
}
function updateCat(dt) {
  if (S.cat !== 'follow') return;
  const tx = dog.x + (dog.flip ? 46 : -46), ty = dog.y + 14;
  const dx = tx - cat.x, dy = ty - cat.y, d = Math.hypot(dx, dy);
  if (d > 12) { const v = Math.min(300, d * 5) * dt; moveBody(cat, dx / d * v, dy / d * v); cat.flip = dx < 0; cat.anim += dt * 12; }
  if (d > 380) [cat.x, cat.y] = nearestWalkable(player.x + 40, player.y + 16);
}
function updateEnemy(e, dt, busy) {
  e.t += dt; e.hurt = Math.max(0, e.hurt - dt);
  const dx = player.x - e.x, dy = player.y - e.y, d = Math.hypot(dx, dy);
  if (d > 1500 && !e.boss) return;
  if (e.born > 0) { e.born -= dt; return; }
  if (Math.abs(e.kx) + Math.abs(e.ky) > 4) { moveBody(e, e.kx * dt, e.ky * dt, enemyWalk); e.kx *= Math.pow(0.002, dt); e.ky *= Math.pow(0.002, dt); }
  if (busy) return;
  if (e.boss) { updateBoss(e, dt, dx, dy, d); return; }
  if (d < 300 && !inSafe(player.x, player.y)) {
    const sp = e.speed * (e.hurt > 0 ? 0.2 : 1);
    moveBody(e, dx / d * sp * dt, dy / d * sp * dt, enemyWalk);
  } else {
    e.wt -= dt; if (e.wt <= 0) { e.wander = rand(0, 6.28); e.wt = rand(1.2, 2.8); }
    if (!moveBody(e, Math.cos(e.wander) * 30 * dt, Math.sin(e.wander) * 30 * dt, enemyWalk)) e.wt = 0;
  }
  if (d < e.r + 18) hurtPlayer(e, 1);
}
function updateBoss(e, dt, dx, dy, d) {
  e.st -= dt; e.spawnT -= dt;
  const rage = e.hp < e.maxHp / 2;
  if (e.state === 'chase') {
    const sp = e.speed * (rage ? 1.35 : 1);
    if (d > 10) moveBody(e, dx / d * sp * dt, dy / d * sp * dt);
    if (d < e.r + 14) hurtPlayer(e, 1);
    if (e.st <= 0) { e.state = 'tele'; e.st = rage ? 0.7 : 0.95; [e.tx, e.ty] = nearestWalkable(player.x, player.y); }
    if (e.spawnT <= 0) {
      e.spawnT = rage ? 5 : 7.5;
      if (enemies.filter(o => o.minion && !o.dead).length < 4) for (let i = 0; i < 2; i++) {
        const [mx, my] = nearestWalkable(e.x + rand(-100, 100), e.y + rand(-40, 50));
        const m = spawnEnemy(makeMusgo(mx, my)); m.born = 0.5; m.minion = true;
        burst(m.x, m.y - 10, '#9be36a', 8, 120);
      }
    }
  } else if (e.state === 'tele') {
    if (e.st <= 0) { e.state = 'jump'; e.st = 0.55; e.sx = e.x; e.sy = e.y; Audio.sfx('swing'); }
  } else if (e.state === 'jump') {
    const k = 1 - e.st / 0.55;
    e.x = e.sx + (e.tx - e.sx) * k; e.y = e.sy + (e.ty - e.sy) * k; e.z = Math.sin(k * Math.PI) * 160;
    if (e.st <= 0) {
      e.z = 0; e.x = e.tx; e.y = e.ty; e.state = 'chase'; e.st = rage ? 2.6 : 3.6;
      Audio.sfx('slam'); shake = 12;
      burst(e.x, e.y, '#c9b38a', 18, 240);
      if (Math.hypot(player.x - e.x, player.y - e.y) < 110) hurtPlayer(e, 1);
    }
  }
}
function ambient(dt) {
  const vw = view.vw, vh = view.vh;
  const a = area === 'world' ? (curRegion ? curRegion.amb : 'meadow') : 'none';
  if (a === 'petals' && Math.random() < dt * 4) particles.push({ x: cam.x + rand(0, vw), y: cam.y - 10, vx: rand(10, 40), vy: rand(30, 60), g: 0, t: 8, max: 8, col: Math.random() < 0.5 ? '#ffb7d0' : '#fff2c9', s: 5, sway: rand(0, 6), amb: 1 });
  if ((a === 'butterflies' || a === 'meadow') && particles.filter(p => p.bf).length < 6 && Math.random() < dt) particles.push({ x: cam.x + rand(0, vw), y: cam.y + rand(0, vh), vx: 0, vy: 0, g: 0, t: 12, max: 12, col: ['#ffe066', '#ffffff', '#ff9ec7', '#9ad1ff'][Math.floor(rand(0, 4))], s: 6, bf: 1, ph: rand(0, 6) });
  if (a === 'fireflies' && particles.filter(p => p.ff).length < 26 && Math.random() < dt * 6) particles.push({ x: cam.x + rand(0, vw), y: cam.y + rand(0, vh), vx: rand(-12, 12), vy: rand(-12, 12), g: 0, t: rand(4, 8), max: 8, col: '#f5ff9a', s: 4, ff: 1, ph: rand(0, 6) });
  if (area === 'world') {
    for (const b of BUILDINGS) if (b.smoke && Math.random() < dt * 3 && Math.abs(b.x - player.x) < 1300 && Math.abs(b.y - player.y) < 900)
      particles.push({ x: b.smoke[0] + rand(-6, 6), y: b.smoke[1], vx: rand(10, 30), vy: rand(-45, -30), g: 0, t: 2.4, max: 2.4, col: 'rgba(220,220,220,0.55)', s: 12, smoke: 1 });
    const P = REGIONS.penhasco, [fx, fy] = toWorld(P, P.fire.x, P.fire.y);
    if (Math.abs(fx - player.x) < 1200 && Math.abs(fy - player.y) < 900 && Math.random() < dt * (S.relics.brasa ? 16 : 6))
      particles.push({ x: fx + rand(-20, 20), y: fy - 14, vx: rand(-20, 20), vy: rand(-120, -50), g: -10, t: rand(0.8, 1.8), max: 1.8, col: Math.random() < 0.5 ? '#ffb347' : '#ffe27a', s: 4 });
    if (Math.random() < dt * 14) {
      const x = cam.x + rand(0, vw), y = cam.y + rand(0, vh);
      if (terrainAt(x, y) === 2 && !regionAt(x, y)) particles.push({ x, y, vx: 0, vy: 0, g: 0, t: 0.8, max: 0.8, col: '#e8f8ff', s: 5 });
    }
  }
  for (const p of particles) {
    if (p.amb) { p.sway += dt * 2; p.vx = 25 + Math.sin(p.sway) * 30; }
    if (p.bf) { p.ph += dt; p.vx = Math.cos(p.ph * 0.7) * 60; p.vy = Math.sin(p.ph * 1.1) * 45; }
    if (p.ff) { p.ph += dt * 2; p.vx += Math.sin(p.ph) * 4; }
  }
}

// ---------------------------------------------------------------- câmera
function computeView() {
  if (area === 'world') view.s = window.__zoom || Math.min(H, W * 0.75) / 820;
  else { const I = interiorDef; view.s = Math.min(H / (I.ph + 150), W / (I.pw + 260)); }
  view.vw = W / view.s; view.vh = H / view.s;
}
function camTarget() {
  const bw = area === 'world' ? WW : interiorDef.pw, bh = area === 'world' ? WH : interiorDef.ph + 24;
  const tx = view.vw >= bw ? (bw - view.vw) / 2 : clamp(player.x - view.vw / 2, 0, bw - view.vw);
  const ty = view.vh >= bh ? (bh - view.vh) / 2 : clamp(player.y - view.vh * 0.56, 0, bh - view.vh);
  return [tx, ty];
}
function snapCamera() { computeView(); [cam.x, cam.y] = camTarget(); }
function updateCamera(dt) {
  computeView();
  const [tx, ty] = camTarget(), k = 1 - Math.pow(0.003, dt);
  cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k;
}

// ---------------------------------------------------------------- desenho do mundo
function spr(sp, x, y, scale, flip, white, sx = 1, sy = 1) {
  const w = sp.w * scale * sx, h = sp.h * scale * sy;
  ctx.save(); ctx.translate(Math.round(x), Math.round(y));
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(white ? sp.white : sp.img, -w / 2, -h, w, h);
  ctx.restore();
}
function shadow(x, y, rx, ry, a = 0.3) { ctx.fillStyle = `rgba(10,20,10,${a})`; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); }
function heroSprite() {
  const f = player.moving ? [1, 0, 2, 0][Math.floor(player.anim) % 4] : 0;
  if (player.dir === 'down') return [HERO.down[f], false];
  if (player.dir === 'up') return [HERO.up[f], false];
  return [HERO.side[player.moving ? [1, 0][Math.floor(player.anim) % 2] : 0], player.dir === 'left'];
}
let dirtPattern = null, chunkBudget = 0;
function drawWorld() {
  const sx = (Math.random() - 0.5) * shake, sy = (Math.random() - 0.5) * shake;
  ctx.setTransform(DPR * view.s, 0, 0, DPR * view.s, DPR * (-cam.x * view.s + sx), DPR * (-cam.y * view.s + sy));
  const x0 = cam.x, y0 = cam.y, x1 = cam.x + view.vw, y1 = cam.y + view.vh;
  if (area !== 'world') { drawInterior(); return; }
  // chão
  ctx.imageSmoothingEnabled = false;
  chunkBudget = 2;
  for (let cy = Math.max(0, Math.floor(y0 / CH)); cy <= Math.floor(y1 / CH); cy++) for (let cx = Math.max(0, Math.floor(x0 / CH)); cx <= Math.floor(x1 / CH); cx++) {
    if (cx * CH >= WW || cy * CH >= WH) continue;
    const c = getChunk(cx, cy, false) || (chunkBudget-- > 0 ? getChunk(cx, cy, true) : null);
    if (c) ctx.drawImage(c, cx * CH, cy * CH, CH + 1, CH + 1);
    else { ctx.fillStyle = '#5c9a3e'; ctx.fillRect(cx * CH, cy * CH, CH + 1, CH + 1); }
  }
  // fogueira do penhasco
  const P = REGIONS.penhasco, [fx, fy] = toWorld(P, P.fire.x, P.fire.y);
  if (fx > x0 - 400 && fx < x1 + 400 && fy > y0 - 400 && fy < y1 + 400) {
    const rr = (S.relics.brasa ? 280 : 180) + Math.sin(time * 9) * 12 + Math.sin(time * 23) * 6;
    const g = ctx.createRadialGradient(fx, fy, 5, fx, fy, rr);
    g.addColorStop(0, 'rgba(255,190,90,0.45)'); g.addColorStop(1, 'rgba(255,150,60,0)');
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(fx - rr, fy - rr, rr * 2, rr * 2); ctx.globalCompositeOperation = 'source-over';
  }
  // porta da torre brilhando
  const T = REGIONS.torre, [tdx, tdy] = toWorld(T, T.door.x, T.door.y);
  if (relicCount() === 3 && S.bossDead) {
    const g = ctx.createRadialGradient(tdx, tdy - 130, 10, tdx, tdy - 130, 210);
    g.addColorStop(0, `rgba(255,230,140,${0.35 + Math.sin(time * 3) * 0.1})`); g.addColorStop(1, 'rgba(255,230,140,0)');
    ctx.fillStyle = g; ctx.fillRect(tdx - 210, tdy - 340, 420, 420);
  }
  if (!S.chest) { const [cx, cy] = toWorld(T, T.chest.x, T.chest.y); sparkle(cx, cy - 60, '#fff1a8'); }
  // portas das casas
  for (const r of REGION_LIST) for (const d of r.doors) {
    const [x, y] = toWorld(r, d.x, d.y);
    if (x < x0 - 100 || x > x1 + 100 || y < y0 - 100 || y > y1 + 100) continue;
    const near = Math.hypot(x - player.x, y - player.y) < 420;
    if (near) label(INTERIORS[d.to].name, x, y - 70 + Math.sin(time * 3) * 3, 17, '#fff6d8', 0.85);
  }
  // entidades
  const list = [];
  for (const p of propsNear(x0 - 200, y0 - 40, x1 + 200, y1 + 640)) list.push({ y: p.y, p });
  for (const it of items) list.push({ y: it.y, f: () => drawItem(it) });
  for (const n of npcs) if (!n.hidden) list.push({ y: n.y, f: () => drawNpc(n) });
  for (const e of enemies) if (e.x > x0 - 200 && e.x < x1 + 200 && e.y > y0 - 100 && e.y < y1 + 300) list.push({ y: e.y, f: () => drawEnemy(e) });
  if (S.cat === 'lost' || S.cat === 'none') list.push({ y: CAT_SPOT[1], f: () => drawCatAt(CAT_SPOT[0], CAT_SPOT[1], false, true) });
  addCommon(list);
  list.sort((a, b) => a.y - b.y);
  for (const o of list) { if (o.p) drawProp(o.p); else o.f(); }
  drawLanternGlow();
  drawOverlays();
}
function addCommon(list) {
  if (S.cat === 'follow') list.push({ y: cat.y, f: () => drawCatAt(cat.x, cat.y, cat.flip, false) });
  list.push({ y: dog.y, f: drawDog });
  list.push({ y: player.y, f: drawPlayer });
}
function drawInterior() {
  const I = interiorDef;
  ctx.fillStyle = '#120e0c'; ctx.fillRect(cam.x - 10, cam.y - 10, view.vw + 20, view.vh + 20);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(I.canvas, 0, 0);
  // brilho de fogo
  for (const f of I.furn) if (f.t === 'forge' || f.t === 'oven' || f.t === 'fireplace') {
    const x = (f.x + f.w / 2) * TILE, y = (f.y + f.h) * TILE - 20, rr = 130 + Math.sin(time * 8) * 8;
    const g = ctx.createRadialGradient(x, y, 4, x, y, rr);
    g.addColorStop(0, 'rgba(255,170,80,0.4)'); g.addColorStop(1, 'rgba(255,140,60,0)');
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(x - rr, y - rr, rr * 2, rr * 2); ctx.globalCompositeOperation = 'source-over';
    if (Math.random() < 0.3) particles.push({ x: x + rand(-14, 14), y: y - 6, vx: rand(-10, 10), vy: rand(-80, -40), g: 0, t: 0.6, max: 0.6, col: '#ffd34a', s: 3 });
  }
  const list = [];
  for (const n of npcs) list.push({ y: n.y, f: () => drawNpc(n) });
  if (area === 'casaTeo' && S.cat === 'home') { const cb = I.furn.find(f => f.t === 'catbed'); list.push({ y: (cb.y + 1) * TILE, f: () => drawCatAt((cb.x + 0.5) * TILE, (cb.y + 0.85) * TILE, false, false, true) }); }
  addCommon(list);
  list.sort((a, b) => a.y - b.y).forEach(o => o.f());
  // tapete de saída
  label('Sair', I.pw / 2, I.ph + 12, 15, '#fff6d8', 0.7);
  drawOverlays();
}
function drawOverlays() {
  for (const n of npcs) {
    const q = npcHasNews(n.id);
    if (q) bubble(n.x, n.y - (n.hidden ? 100 : 136) + Math.sin(time * 4) * 4, q);
  }
  if (bossRef && bossRef.state === 'tele') {
    const a = 0.35 + Math.sin(time * 30) * 0.15;
    ctx.strokeStyle = `rgba(255,70,60,${a + 0.3})`; ctx.fillStyle = `rgba(255,70,60,${a * 0.5})`; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.ellipse(bossRef.tx, bossRef.ty, 110, 58, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  for (const p of particles) {
    const a = Math.min(1, p.t / (p.max * 0.4));
    ctx.globalAlpha = p.ff ? (0.5 + 0.5 * Math.sin(p.ph * 3)) * a : a;
    if (p.ff) { ctx.fillStyle = 'rgba(245,255,154,0.25)'; ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, 7); ctx.fill(); }
    ctx.fillStyle = p.col;
    if (p.bf) { const w = Math.abs(Math.sin(time * 14 + p.ph)) * 7 + 1; ctx.fillRect(p.x - w, p.y - 3, w, 7); ctx.fillRect(p.x, p.y - 3, w, 7); ctx.fillStyle = '#3a2a1a'; ctx.fillRect(p.x - 1, p.y - 3, 2, 8); }
    else ctx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s);
  }
  ctx.globalAlpha = 1;
  for (const f of floaters) label(f.text, f.x, f.y, 22, f.col, Math.min(1, f.t * 2));
  if (interactTarget && !dialog) {
    const t = interactTarget, b = Math.sin(time * 6) * 3;
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#2a2238'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(t.x - 10, t.y - 16 + b); ctx.lineTo(t.x + 10, t.y - 16 + b); ctx.lineTo(t.x, t.y + b); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
}
function npcHasNews(id) {
  if (id === 'aurora') return S.stage === 0 ? '!' : (S.q.caca === 1 && S.mkills >= 20) ? '★' : (relicCount() === 3 && !S.bossDead ? '…' : null);
  if (id === 'bruno') return S.q.ferro === 0 ? '!' : (S.q.ferro === 1 && S.inv.pedra >= 5) || (S.q.artesao === 1 && Object.keys(S.crafted).length >= 3) ? '★' : S.q.ferro === 1 ? '?' : null;
  if (id === 'rosa') return S.q.torta === 0 ? '!' : S.q.torta === 1 ? (S.inv.cogumelo >= 3 ? '★' : '?') : null;
  if (id === 'teo') return S.cat === 'none' ? '!' : S.cat === 'follow' ? '★' : S.cat === 'lost' ? '?' : null;
  if (S.stage === 0) return null;
  if (id === 'mel' && !S.relics.petala) return florlumeCount() >= 5 ? '★' : '?';
  if (id === 'tome' && !S.relics.orvalho) return hortaKills() >= 5 ? '★' : '?';
  if (id === 'camp' && !S.relics.brasa) return S.bag.feixe ? '★' : '?';
  return null;
}
function bubble(x, y, ch) {
  ctx.fillStyle = '#fffaf0'; ctx.strokeStyle = '#2a2238'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(x - 17, y - 38, 34, 34, 9); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 6, y - 5); ctx.lineTo(x, y + 5); ctx.lineTo(x + 6, y - 5); ctx.fill();
  ctx.fillStyle = ch === '★' ? '#e0a020' : '#c8423b'; ctx.font = `700 24px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(ch, x, y - 20);
}
function label(text, x, y, size, col = '#fffaf0', alpha = 1) {
  ctx.globalAlpha = alpha; ctx.font = `700 ${size}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(3, size / 4); ctx.strokeStyle = 'rgba(30,22,30,0.85)'; ctx.lineJoin = 'round';
  ctx.strokeText(text, x, y); ctx.fillStyle = col; ctx.fillText(text, x, y); ctx.globalAlpha = 1;
}
function sparkle(x, y, col) {
  const t = time * 3 + x;
  for (let i = 0; i < 3; i++) {
    const a = t + i * 2.1, r = 26 + Math.sin(t * 1.3 + i) * 6, s = 3 + Math.abs(Math.sin(t * 2 + i)) * 3;
    ctx.fillStyle = col; ctx.fillRect(x + Math.cos(a) * r - s / 2, y + Math.sin(a) * r * 0.6 - s / 2, s, s);
  }
}
function drawProp(p) {
  if (p.t === 'tree') {
    if (p.stock <= 0) { shadow(p.x, p.y, 30, 9); ctx.drawImage(STUMP, p.x - 32, p.y - 26, 64, 32); return; }
    const w = p.img.width * p.s, h = p.img.height * p.s;
    shadow(p.x, p.y, 54, 16, 0.28);
    const sh = p.shake > 0 ? Math.sin(time * 60) * 5 * p.shake / 0.3 : 0;
    if (p.shake > 0) p.shake -= 1 / 60;
    const behind = player.y < p.y - 10 && player.y > p.y - h * 0.9 && Math.abs(player.x - p.x) < w * 0.42 && area === 'world';
    if (behind) ctx.globalAlpha = 0.5;
    ctx.drawImage(p.img, p.x - w / 2 + sh, p.y - h + 6, w, h);
    ctx.globalAlpha = 1;
  } else if (p.t === 'bld') {
    const b = p.b, x = b.x - b.pw / 2, y = b.y - b.ph;
    const behind = area === 'world' && player.y < b.y - 20 && player.y > y + 20 && player.x > x + 10 && player.x < x + b.pw - 10;
    if (b.kind !== 'tower' && b.kind !== 'fountain' && b.kind !== 'well') shadow(b.x + 10, b.y - 4, b.pw * 0.52, 18, 0.25);
    if (behind) ctx.globalAlpha = 0.55;
    ctx.drawImage(b.img, x, y, b.pw, b.ph);
    ctx.globalAlpha = 1;
    if (b.kind === 'fountain') {
      for (let i = 0; i < 6; i++) {
        const k = ((time * 1.2 + i / 6) % 1), a = i / 6 * 6.283;
        ctx.fillStyle = 'rgba(200,235,255,0.85)';
        ctx.fillRect(b.x + Math.cos(a) * 34 * k - 3, b.y - 128 + (k * k) * 70 - Math.sin(k * 3.14) * 30, 6, 6);
      }
    }
  } else if (p.t === 'deco') {
    drawDeco(p);
  } else if (p.t === 'bush') {
    const w = p.img.width * p.s, h = p.img.height * p.s;
    const behind = player.y < p.y - 4 && player.y > p.y - h && Math.abs(player.x - p.x) < w * 0.45;
    if (behind) ctx.globalAlpha = 0.55;
    ctx.drawImage(p.img, p.x - w / 2, p.y - h + 8, w, h);
    ctx.globalAlpha = 1;
  } else if (p.t === 'rock') {
    if (p.stock <= 0) return;
    const sh = p.shake > 0 ? Math.sin(time * 70) * 3 : 0; if (p.shake > 0) p.shake -= 1 / 60;
    shadow(p.x, p.y, 40, 10, 0.25);
    ctx.drawImage(p.img, p.x - 40 + sh, p.y - 58, 80, 64);
  } else if (p.t === 'tuft') {
    if (p.gone > 0) return;
    const sw = Math.sin(time * 2 + p.ph) * 3;
    ctx.fillStyle = '#2f6b2a';
    for (let i = -3; i <= 3; i++) ctx.fillRect(p.x + i * 6 + sw * (i % 2 ? 1 : 0.5), p.y - 26 + Math.abs(i) * 4, 4, 26 - Math.abs(i) * 4);
    ctx.fillStyle = '#8fd36a';
    for (let i = -2; i <= 2; i += 2) ctx.fillRect(p.x + i * 6 + 1 + sw, p.y - 24 + Math.abs(i) * 4, 2, 10);
  } else if (p.t === 'flower') {
    if (p.gone > 0) return;
    ctx.fillStyle = '#3f8a37'; ctx.fillRect(p.x - 2, p.y - 14, 4, 14);
    ctx.fillStyle = p.col; ctx.fillRect(p.x - 8, p.y - 22, 6, 6); ctx.fillRect(p.x + 2, p.y - 22, 6, 6); ctx.fillRect(p.x - 3, p.y - 27, 6, 6); ctx.fillRect(p.x - 3, p.y - 17, 6, 5);
    ctx.fillStyle = '#ffe066'; ctx.fillRect(p.x - 2, p.y - 21, 4, 4);
  } else if (p.t === 'mush') {
    if (p.gone > 0) return;
    shadow(p.x, p.y, 12, 4, 0.25);
    ctx.fillStyle = '#f4ecd6'; ctx.fillRect(p.x - 4, p.y - 14, 8, 14);
    ctx.fillStyle = '#2a1a10'; ctx.fillRect(p.x - 14, p.y - 26, 28, 14);
    ctx.fillStyle = '#d83a3a'; ctx.fillRect(p.x - 12, p.y - 26, 24, 12); ctx.fillRect(p.x - 8, p.y - 30, 16, 6);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(p.x - 7, p.y - 24, 4, 4); ctx.fillRect(p.x + 3, p.y - 22, 4, 4); ctx.fillRect(p.x - 1, p.y - 29, 3, 3);
  }
}
function drawLanternGlow() {
  if (!TOWER) return;
  const b = TOWER, lx = b.x - b.pw / 2 + b.lantern[0] * b.sc, ly = b.y - b.ph + b.lantern[1] * b.sc;
  if (lx < cam.x - 600 || lx > cam.x + view.vw + 600 || ly < cam.y - 600 || ly > cam.y + view.vh + 600) return;
  const lit = S.done || mode === 'end', warm = !lit && S.bossDead;
  if (!lit && !warm) return;
  const fl = Math.sin(time * 7) * 0.05, R = lit ? 520 : 160;
  const g = ctx.createRadialGradient(lx, ly, 8, lx, ly, R);
  g.addColorStop(0, `rgba(255,236,150,${(lit ? 0.85 : 0.4) + fl})`); g.addColorStop(0.35, `rgba(255,200,110,${lit ? 0.35 : 0.12})`); g.addColorStop(1, 'rgba(255,200,110,0)');
  ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(lx - R, ly - R, R * 2, R * 2); ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = lit ? '#fff2a8' : '#e8c060';
  for (let i = 0; i < 4; i++) ctx.fillRect(b.x - b.pw / 2 + (19 + i * 7) * b.sc, b.y - b.ph + 15 * b.sc, 5 * b.sc, 13 * b.sc);
}
function drawDeco(p) {
  const x = p.x, y = p.y, R = (a, b, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x + a, y + b, w, h); };
  switch (p.d) {
    case 'lamp':
      shadow(x, y, 14, 5, 0.25);
      R(-4, -96, 8, 96, '#2a2238'); R(-2, -96, 3, 96, '#4a4458'); R(-10, -4, 20, 6, '#2a2238');
      R(-12, -124, 24, 30, '#2a2238'); R(-8, -120, 16, 22, '#ffe9a0'); R(-8, -120, 5, 22, '#fff8d8'); R(-14, -130, 28, 8, '#2a2238');
      ctx.fillStyle = 'rgba(255,230,140,0.18)'; ctx.beginPath(); ctx.arc(x, y - 110, 34 + Math.sin(time * 3 + x) * 2, 0, 7); ctx.fill();
      break;
    case 'bench':
      shadow(x, y, 38, 7, 0.25);
      R(-34, -46, 68, 8, '#5a3a22'); R(-34, -44, 68, 3, '#8a5a34'); R(-36, -28, 72, 10, '#5a3a22'); R(-36, -28, 72, 4, '#a0703e');
      R(-30, -18, 6, 18, '#3b2618'); R(24, -18, 6, 18, '#3b2618'); R(-30, -46, 5, 20, '#3b2618'); R(25, -46, 5, 20, '#3b2618');
      break;
    case 'flowerbed': {
      ctx.fillStyle = '#5f5c57'; ctx.beginPath(); ctx.ellipse(x, y - 12, 48, 20, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#6b4426'; ctx.beginPath(); ctx.ellipse(x, y - 14, 42, 16, 0, 0, 7); ctx.fill();
      const Rn = mulberry(p.seed);
      for (let i = 0; i < 16; i++) {
        const a = Rn() * 6.28, d = Math.sqrt(Rn()), fx = x + Math.cos(a) * d * 34, fy = y - 16 + Math.sin(a) * d * 11;
        ctx.fillStyle = '#3f8a37'; ctx.fillRect(fx - 2, fy - 8, 4, 8);
        ctx.fillStyle = FLOWER_COLS[Math.floor(Rn() * 5)]; ctx.fillRect(fx - 5, fy - 14, 10, 8);
      }
      break;
    }
    case 'barrel':
      shadow(x, y, 20, 6, 0.25); R(-18, -48, 36, 46, '#2a1a10'); R(-16, -46, 32, 42, '#8a5a34'); R(-16, -46, 8, 42, '#a87446');
      R(-17, -38, 34, 4, '#3b2618'); R(-17, -16, 34, 4, '#3b2618'); R(-14, -48, 28, 4, '#5a3a22');
      break;
    case 'crate':
      shadow(x, y, 22, 6, 0.25); R(-22, -44, 44, 42, '#2a1a10'); R(-20, -42, 40, 38, '#b07c46'); R(-20, -42, 40, 4, '#c99a6a');
      R(-20, -26, 40, 4, '#7a4a2a'); R(-3, -42, 6, 38, '#7a4a2a');
      break;
    case 'hay':
      shadow(x, y, 40, 9, 0.25); R(-38, -50, 76, 48, '#7a6020'); R(-36, -48, 72, 44, '#e0c060'); R(-36, -48, 72, 8, '#f0d880');
      for (let i = -30; i < 34; i += 8) R(i, -40, 2, 34, '#c09a40');
      R(-36, -30, 72, 3, '#a07a30');
      break;
    case 'anvilout':
      shadow(x, y, 20, 5, 0.25); R(-10, -18, 20, 16, '#3a3a44'); R(-20, -34, 40, 14, '#55555f'); R(-20, -34, 40, 4, '#9a9aa8'); R(16, -30, 10, 6, '#55555f');
      break;
    case 'fenceH':
      R(-26, -36, 8, 36, '#3b2618'); R(-24, -34, 4, 32, '#a0703e'); R(18, -36, 8, 36, '#3b2618'); R(20, -34, 4, 32, '#a0703e');
      R(-24, -28, 48, 6, '#7a4a2a'); R(-24, -28, 48, 2, '#b07c46'); R(-24, -14, 48, 6, '#7a4a2a'); R(-24, -14, 48, 2, '#b07c46');
      break;
    case 'fenceV':
      R(-4, -48, 8, 48, '#3b2618'); R(-2, -46, 4, 44, '#a0703e'); R(-2, -92, 4, 46, '#7a4a2a');
      break;
    case 'cabbage':
      shadow(x, y, 18, 5, 0.25);
      ctx.fillStyle = '#1f4f2c'; ctx.beginPath(); ctx.ellipse(x, y - 14, 20, 14, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#3d8a4a'; ctx.beginPath(); ctx.ellipse(x - 2, y - 16, 15, 10, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#7fc46a'; ctx.beginPath(); ctx.ellipse(x - 4, y - 18, 8, 5, 0, 0, 7); ctx.fill();
      break;
    case 'carrot':
      R(-3, -4, 6, 6, '#e07a2a');
      ctx.fillStyle = '#3f8a37'; for (let i = -2; i <= 2; i++) ctx.fillRect(x + i * 5 - 2, y - 22 + Math.abs(i) * 4, 4, 20 - Math.abs(i) * 4);
      ctx.fillStyle = '#7fc46a'; ctx.fillRect(x - 1, y - 22, 2, 10);
      break;
    case 'beans': {
      R(-3, -86, 6, 86, '#7a4a2a');
      ctx.fillStyle = '#3f8a37';
      for (let i = 0; i < 7; i++) { const yy = y - 12 - i * 11, xx = x + (i % 2 ? 7 : -7) + Math.sin(time * 2 + i + x) * 1.5; ctx.beginPath(); ctx.ellipse(xx, yy, 9, 6, 0, 0, 7); ctx.fill(); }
      ctx.fillStyle = '#9be36a'; for (let i = 0; i < 4; i++) ctx.fillRect(x + (i % 2 ? 4 : -8), y - 30 - i * 16, 4, 12);
      break;
    }
    case 'pumpkin':
      shadow(x, y, 18, 5, 0.25);
      ctx.fillStyle = '#a0461a'; ctx.beginPath(); ctx.ellipse(x, y - 12, 20, 13, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#e07a2a'; ctx.beginPath(); ctx.ellipse(x, y - 13, 17, 11, 0, 0, 7); ctx.fill();
      R(-7, -23, 3, 20, '#c0601e'); R(4, -23, 3, 20, '#c0601e'); R(-2, -30, 4, 8, '#3f8a37');
      break;
    case 'pillar':
      shadow(x, y, 26, 7, 0.25);
      R(-20, -14, 40, 14, '#4f4a44'); R(-18, -12, 36, 10, '#8f897d');
      R(-14, -84, 28, 72, '#4f4a44'); R(-12, -82, 24, 70, '#a8a296'); R(-12, -82, 7, 70, '#c4beb2');
      for (let yy = -74; yy < -14; yy += 14) R(-12, yy, 24, 2, '#7d776c');
      R(-14, -92, 12, 10, '#4f4a44'); R(-2, -88, 16, 6, '#4f4a44');
      ctx.fillStyle = '#5f8a3a'; ctx.fillRect(x - 12, y - 60, 6, 14); ctx.fillRect(x + 6, y - 40, 6, 10);
      break;
    case 'rubble':
      R(-24, -12, 20, 12, '#5f5a52'); R(-22, -10, 16, 8, '#a8a296'); R(2, -16, 22, 16, '#5f5a52'); R(4, -14, 18, 12, '#9a9488'); R(-6, -24, 14, 10, '#5f5a52'); R(-4, -22, 10, 6, '#b6b0a4');
      break;
    case 'chest':
      shadow(x, y, 26, 7, 0.3);
      if (!S.chest) {
        R(-26, -44, 52, 42, '#2a1a10'); R(-24, -42, 48, 38, '#8a5a34'); R(-24, -42, 48, 12, '#a87446');
        R(-24, -30, 48, 4, '#c99a3a'); R(-4, -34, 8, 12, '#e0b040'); R(-24, -42, 4, 38, '#c99a3a'); R(20, -42, 4, 38, '#c99a3a');
      } else {
        R(-26, -30, 52, 28, '#2a1a10'); R(-24, -28, 48, 24, '#8a5a34'); R(-26, -60, 52, 16, '#2a1a10'); R(-24, -58, 48, 12, '#a87446');
        R(-22, -30, 44, 4, '#1a1008');
      }
      break;
    case 'campfire': {
      const big = S.relics.brasa || S.bag.feixe > 0;
      ctx.fillStyle = '#5f5c57';
      for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283; ctx.fillRect(x + Math.cos(a) * 36 - 7, y - 10 + Math.sin(a) * 14 - 5, 14, 10); }
      R(-22, -16, 44, 8, '#5a3418'); R(-8, -22, 16, 8, '#7a4a2a');
      const hgt = big ? 70 : 44;
      for (let i = 0; i < 5; i++) {
        const fx = x + (i - 2) * 8, fh = hgt * (0.6 + 0.4 * Math.abs(Math.sin(time * 9 + i * 1.7)));
        ctx.fillStyle = '#ff7a2a'; ctx.fillRect(fx - 6, y - 14 - fh, 12, fh);
        ctx.fillStyle = '#ffd34a'; ctx.fillRect(fx - 3, y - 14 - fh * 0.7, 6, fh * 0.7);
      }
      break;
    }
    case 'log':
      shadow(x, y, 38, 6, 0.25); R(-36, -20, 72, 18, '#3b2618'); R(-34, -18, 68, 14, '#8a5a34'); R(-34, -18, 68, 4, '#a87446');
      R(26, -18, 8, 14, '#c99a6a'); R(28, -14, 4, 6, '#8a5a34');
      break;
    case 'chair':
      shadow(x, y, 18, 5, 0.25); R(-16, -34, 32, 18, '#2a2238'); R(-14, -32, 28, 14, '#c8423b'); R(-16, -18, 4, 18, '#2a2238'); R(12, -18, 4, 18, '#2a2238');
      break;
    case 'sign':
      shadow(x, y, 14, 4, 0.25); R(-4, -70, 8, 70, '#3b2618'); R(-2, -70, 3, 70, '#8a5a34');
      ctx.font = `700 15px ${FONT}`; { const tw = ctx.measureText(p.text).width + 20;
        R(-tw / 2 - 3, -100, tw + 6, 34, '#3b2618'); R(-tw / 2, -97, tw, 28, '#c99a6a'); R(-tw / 2, -97, tw, 4, '#e0b888');
        ctx.fillStyle = '#3b2618'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.text, x, y - 82); }
      break;
  }
}
function drawPlayer() {
  const [sp, flip] = heroSprite();
  shadow(player.x, player.y, 26, 9);
  if (player.inv > 0 && Math.floor(player.inv * 14) % 2 === 0) return;
  const bob = player.moving ? Math.abs(Math.sin(player.anim * Math.PI / 2)) * -2 : Math.sin(time * 2) * 0.6;
  spr(sp, player.x, player.y + bob, 6, flip, false);
  if (S.eq.armadura) { ctx.fillStyle = 'rgba(95,166,74,0.55)'; ctx.fillRect(player.x - 22, player.y - 52 + bob, 44, 8); }
  if (player.atk > 0) {
    const k = 1 - player.atk / 0.24, fa = Math.atan2(player.fy, player.fx);
    const cx = player.x, cy = player.y - 44, R = 72;
    const a0 = fa - 1.4 + k * 2.4;
    const bladeCol = S.eq.espada >= 3 ? '#8fd8ff' : S.eq.espada === 2 ? '#c9c6c0' : '#e8eef5';
    ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const a = a0 - i * 0.18; if (a < fa - 1.4) break;
      ctx.strokeStyle = S.eq.espada >= 3 ? `rgba(160,220,255,${0.9 - i * 0.15})` : `rgba(255,255,255,${0.9 - i * 0.15})`; ctx.lineWidth = 13 - i * 1.7;
      ctx.beginPath(); ctx.arc(cx, cy, R, a - 0.16, a); ctx.stroke();
    }
    ctx.strokeStyle = bladeCol; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a0) * 14, cy + Math.sin(a0) * 14); ctx.lineTo(cx + Math.cos(a0) * (R + 8), cy + Math.sin(a0) * (R + 8)); ctx.stroke();
    ctx.strokeStyle = '#c99a3a'; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a0) * 6, cy + Math.sin(a0) * 6); ctx.lineTo(cx + Math.cos(a0) * 18, cy + Math.sin(a0) * 18); ctx.stroke();
  }
}
function drawDog() {
  shadow(dog.x, dog.y, 20, 6);
  const f = dog.moving ? 1 + (Math.floor(dog.anim) % 2) : 0;
  const hop = dog.moving ? -Math.abs(Math.sin(dog.anim * Math.PI / 2)) * 4 : 0;
  spr(DOG[f], dog.x, dog.y + hop, 5, dog.flip, false);
  if (S.eq.coleira) { ctx.fillStyle = '#e0a020'; ctx.fillRect(dog.x + (dog.flip ? -12 : 4), dog.y - 26 + hop, 8, 5); }
  if (dog.bark > 0) label('Au!', dog.x + (dog.flip ? -28 : 28), dog.y - 50 - (0.5 - dog.bark) * 30, 18, '#fff', Math.min(1, dog.bark * 3));
}
function drawCatAt(x, y, flip, lost, sleeping) {
  shadow(x, y, 16, 5);
  const hop = !sleeping && lost ? Math.abs(Math.sin(time * 3)) * -3 : 0;
  spr(CAT, x, y + hop, 4, flip, false, 1, sleeping ? 0.8 : 1);
  if (lost) { label('Bolinha', x, y + 20, 15, '#ffe0b8', 0.85); if (Math.sin(time * 2) > 0.6) label('miau?', x + 30, y - 52, 14, '#fff', 0.9); }
  if (sleeping) label('z z', x + 26, y - 40 - Math.sin(time * 2) * 4, 14, '#cfe6ff', 0.8);
}
function drawNpc(n) {
  const sp = NPC[n.id];
  shadow(n.x, n.y, 22, 8);
  const sc = n.id === 'teo' ? 5 : 6;
  spr(sp, n.x, n.y + Math.sin(time * 2 + n.x) * 0.8, sc, Math.sin(time * 0.5 + n.x) > 0.7, false);
  label(n.name, n.x, n.y + 22, 15, '#fff6d8', 0.9);
}
function drawEnemy(e) {
  const SP = e.boss ? MUSGO_BOSS : e.azul ? MUSGO_AZUL : MUSGO;
  const sc = e.boss ? 13 : e.azul ? 5.5 : 5;
  if (e.born > 0) {
    const k = 1 - e.born / (e.boss ? 1.2 : 0.5);
    shadow(e.x, e.y, e.r * k, e.r * 0.4 * k);
    spr(SP, e.x, e.y, sc * k, false, true);
    return;
  }
  const sq = 1 + Math.sin(e.t * (e.boss ? 5 : 8)) * 0.07;
  shadow(e.x, e.y, e.r * (e.z ? 0.7 : 1), e.r * 0.38, e.z ? 0.2 : 0.3);
  spr(SP, e.x, e.y - e.z, sc, player.x < e.x, e.hurt > 0.1, 1 / sq, sq);
  if (e.boss) {
    const top = e.y - e.z - MUSGO.h * sc * sq + 12;
    for (let i = 0; i < 5; i++) {
      const fx = e.x - 50 + i * 25, fy = top + 6 + Math.abs(i - 2) * 7;
      ctx.fillStyle = ['#ff8fb1', '#ffe066', '#ffffff', '#ffe066', '#ff8fb1'][i];
      ctx.beginPath(); ctx.arc(fx, fy, 9, 0, 7); ctx.fill(); ctx.fillStyle = '#e0a020'; ctx.beginPath(); ctx.arc(fx, fy, 3, 0, 7); ctx.fill();
    }
  } else if (e.hp < e.maxHp) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(e.x - 20, e.y - 66, 40, 6);
    ctx.fillStyle = e.azul ? '#8fd0ff' : '#8fe06a'; ctx.fillRect(e.x - 19, e.y - 65, 38 * e.hp / e.maxHp, 4);
  }
}
function drawItem(it) {
  const bob = Math.sin(it.t * 3) * 4 - (it.drop > 0 ? Math.sin((0.35 - it.drop) / 0.35 * Math.PI) * 30 : 0);
  const x = it.x, y = it.y;
  if (it.k === 'florlume') {
    const g = ctx.createRadialGradient(x, y - 22 + bob, 2, x, y - 22 + bob, 48);
    g.addColorStop(0, 'rgba(255,220,240,0.75)'); g.addColorStop(1, 'rgba(255,180,220,0)');
    ctx.fillStyle = g; ctx.fillRect(x - 48, y - 70 + bob, 96, 96);
    ctx.fillStyle = '#3f8a37'; ctx.fillRect(x - 2, y - 16 + bob, 4, 16);
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 + it.t; ctx.fillStyle = '#ff9ec7'; ctx.beginPath(); ctx.arc(x + Math.cos(a) * 9, y - 24 + bob + Math.sin(a) * 9, 7, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#ffe066'; ctx.beginPath(); ctx.arc(x, y - 24 + bob, 6, 0, 7); ctx.fill();
    sparkle(x, y - 26 + bob, '#fff');
    return;
  }
  shadow(x, y + 4, 10, 3, 0.25);
  if (it.k === 'coracao') heart(x, y - 16 + bob, 15, '#ff5a6e');
  else if (it.k === 'moeda') {
    const w = Math.abs(Math.cos(it.t * 4)) * 11 + 2;
    ctx.fillStyle = '#8a5a10'; ctx.beginPath(); ctx.ellipse(x, y - 14 + bob, w + 2, 13, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffd84a'; ctx.beginPath(); ctx.ellipse(x, y - 14 + bob, w, 11, 0, 0, 7); ctx.fill();
  } else drawIcon(it.k, x, y - 18 + bob, 30);
}
function heart(x, y, s, col, empty) {
  ctx.save(); ctx.translate(x, y);
  const k = s / 7;
  const rows = ['.OO.OO.', 'OxxOxxO', 'OxxxxxO', 'OxxxxxO', '.OxxxO.', '..OxO..', '...O...'];
  rows.forEach((r, j) => { for (let i = 0; i < 7; i++) {
    const c = r[i]; if (c === '.') continue;
    ctx.fillStyle = c === 'O' ? '#2a1a22' : (empty ? 'rgba(60,40,50,0.6)' : col);
    ctx.fillRect((i - 3.5) * k, (j - 3.5) * k, k + 0.5, k + 0.5);
  } });
  if (!empty) { ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(-2.5 * k, -2.5 * k, k, k); }
  ctx.restore();
}
// ícones de itens desenhados em código
function drawIcon(k, x, y, s) {
  ctx.save(); ctx.translate(x, y); const u = s / 16;
  const r = (a, b, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(a * u, b * u, w * u, h * u); };
  switch (k) {
    case 'madeira': r(-7, -3, 14, 7, '#2a1a10'); r(-6, -2, 12, 5, '#8a5a34'); r(-6, -2, 12, 1.5, '#b07c46'); r(4, -3, 3, 7, '#c99a6a'); r(5, -1.5, 1, 3, '#8a5a34'); break;
    case 'pedra': r(-6, -3, 12, 8, '#3a3a44'); r(-5, -4, 9, 8, '#9a978f'); r(-4, -3, 4, 2, '#c9c6c0'); break;
    case 'fibra': for (let i = -3; i <= 3; i++) r(i * 2, -6 + Math.abs(i), 1.5, 11 - Math.abs(i), i % 2 ? '#5fae4a' : '#8fd36a'); r(-5, 2, 10, 2, '#c9a14a'); break;
    case 'flor': r(-1, 0, 2, 7, '#3f8a37'); r(-5, -5, 4, 4, '#ff9ec7'); r(1, -5, 4, 4, '#ff9ec7'); r(-2, -8, 4, 4, '#ff9ec7'); r(-2, -2, 4, 3, '#ff9ec7'); r(-1, -4, 2, 2, '#ffe066'); break;
    case 'cogumelo': r(-2, -1, 4, 7, '#f4ecd6'); r(-6, -6, 12, 6, '#d83a3a'); r(-4, -8, 8, 2, '#d83a3a'); r(-4, -5, 2, 2, '#fff'); r(2, -4, 2, 2, '#fff'); break;
    case 'seiva': ctx.fillStyle = '#7ccf55'; ctx.beginPath(); ctx.moveTo(0, -7 * u); ctx.quadraticCurveTo(6 * u, 1 * u, 0, 6 * u); ctx.quadraticCurveTo(-6 * u, 1 * u, 0, -7 * u); ctx.fill(); r(-2, 0, 1.5, 3, '#d8ffc0'); break;
    case 'cristal': r(-4, -7, 8, 14, '#1e3f7a'); r(-3, -6, 6, 12, '#5fb8ff'); r(-3, -6, 2, 10, '#c8f0ff'); break;
    case 'pocao': r(-2, -8, 4, 3, '#8a5a34'); r(-5, -5, 10, 11, '#2a1a22'); r(-4, -4, 8, 9, '#ff5a6e'); r(-3, -3, 2, 4, '#ffd0d8'); break;
    case 'torta': r(-7, -1, 14, 6, '#8a5a34'); r(-6, -3, 12, 4, '#e8c080'); r(-4, -4, 2, 1, '#c48440'); r(1, -4, 2, 1, '#c48440'); break;
    case 'feixe': r(-7, -4, 14, 4, '#8a5a34'); r(-7, 0, 14, 4, '#7a4a2a'); r(-6, -2, 12, 1, '#c99a6a'); r(-1, -5, 2, 10, '#c9a14a'); break;
    case 'espada2': case 'espada3': case 'espada1': ctx.rotate(-0.8); r(-1, -8, 3, 11, k === 'espada3' ? '#8fd8ff' : k === 'espada2' ? '#a9a6a0' : '#e8eef5'); r(-4, 3, 9, 2, '#c99a3a'); r(-0.5, 5, 2, 4, '#7a4a2a'); break;
    case 'armadura': r(-6, -6, 12, 12, '#2a1a10'); r(-5, -5, 10, 10, '#5fae4a'); r(-5, -5, 10, 2, '#8fd36a'); r(-1, -3, 2, 7, '#3f8a37'); break;
    case 'botas': r(-6, -4, 5, 8, '#7a4a2a'); r(-6, 2, 7, 3, '#5a3418'); r(1, -4, 5, 8, '#7a4a2a'); r(1, 2, 7, 3, '#5a3418'); r(-6, -4, 5, 2, '#9ad1ff'); r(1, -4, 5, 2, '#9ad1ff'); break;
    case 'coleira': ctx.strokeStyle = '#c8423b'; ctx.lineWidth = 3 * u; ctx.beginPath(); ctx.arc(0, 0, 5 * u, 0, 7); ctx.stroke(); r(-1.5, 4, 3, 3, '#e0a020'); break;
  }
  ctx.restore();
}
function relicIcon(key, x, y, s, on) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = on ? 'rgba(255,240,200,0.18)' : 'rgba(0,0,0,0.35)'; ctx.strokeStyle = on ? '#ffe38a' : 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(-s / 2, -s / 2, s, s, 7); ctx.fill(); ctx.stroke();
  ctx.globalAlpha = on ? 1 : 0.3;
  const r = s * 0.3;
  if (key === 'petala') { ctx.fillStyle = '#ff9ec7'; for (let i = 0; i < 5; i++) { const a = i / 5 * 6.283; ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6, r * 0.5, 0, 7); ctx.fill(); } ctx.fillStyle = '#ffe066'; ctx.beginPath(); ctx.arc(0, 0, r * 0.35, 0, 7); ctx.fill(); }
  if (key === 'orvalho') { ctx.fillStyle = '#6fd3ff'; ctx.beginPath(); ctx.moveTo(0, -r * 1.1); ctx.quadraticCurveTo(r, r * 0.2, 0, r); ctx.quadraticCurveTo(-r, r * 0.2, 0, -r * 1.1); ctx.fill(); }
  if (key === 'brasa') { ctx.fillStyle = '#ff7a2a'; ctx.beginPath(); ctx.moveTo(0, -r * 1.1); ctx.quadraticCurveTo(r * 1.1, 0, 0, r); ctx.quadraticCurveTo(-r * 1.1, 0, 0, -r * 1.1); ctx.fill(); ctx.fillStyle = '#ffe27a'; ctx.beginPath(); ctx.arc(0, r * 0.3, r * 0.35, 0, 7); ctx.fill(); }
  ctx.restore();
}

// ---------------------------------------------------------------- minimapa
function buildMinimap() {
  const k = 16, w = Math.ceil(WW / k), h = Math.ceil(WH / k);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'), id = g.createImageData(w, h), d = id.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const t = terrainAt(x * k + 8, y * k + 8), i = (y * w + x) * 4;
    const col = t === 2 ? [58, 140, 196] : t === 1 ? [205, 170, 112] : t === 3 ? [226, 207, 150] : [88, 150, 60];
    d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
  }
  g.putImageData(id, 0, 0);
  g.fillStyle = 'rgba(25,70,30,0.85)';
  for (const p of props) if (p.t === 'tree') g.fillRect(p.x / k - 2, p.y / k - 4, 4, 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const t = terrainAt(x * k + 8, y * k + 8);
    if (t === 4) { g.fillStyle = '#c9bfa8'; g.fillRect(x, y, 1, 1); } else if (t === 5) { g.fillStyle = '#7a5232'; g.fillRect(x, y, 1, 1); }
    else if (t === 6) { g.fillStyle = '#7d7a74'; g.fillRect(x, y, 1, 1); } else if (t === 7) { g.fillStyle = '#a0703e'; g.fillRect(x, y, 1, 1); }
  }
  for (const b of BUILDINGS) { g.fillStyle = b.kind === 'house' ? ROOFS[b.roof][2] : b.kind === 'barn' ? '#a8402e' : b.kind === 'tower' ? '#9a9488' : '#d8d0b8'; g.fillRect((b.x - b.pw / 2) / k, (b.y - b.ph * 0.8) / k, b.pw / k, b.ph * 0.8 / k); }
  g.strokeStyle = 'rgba(20,20,20,0.6)'; g.lineWidth = 1;
  MINI = c;
}
function drawMap(x, y, w, h, full) {
  ctx.save();
  ctx.fillStyle = '#1b2a1f'; ctx.strokeStyle = '#e8d6a8'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(x - 3, y - 3, w + 6, h + 6, 8); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  const k = w / WW;
  ctx.imageSmoothingEnabled = true;
  if (MINI) ctx.drawImage(MINI, x, y, w, h);
  if (full) {
    for (const r of REGION_LIST) label(r.name, x + (r.ox + r.iw * IS / 2) * k, y + (r.oy + r.ih * IS * 0.5) * k, 14, '#fff6d8');
    for (const lm of LANDMARKS) label(lm.name, x + lm.x * k, y + lm.y * k, 12, '#cfe6c0', 0.9);
  }
  const tg = questTargets();
  const pulse = 0.7 + Math.sin(time * 5) * 0.3;
  for (const [tx, ty] of tg.side) { ctx.fillStyle = `rgba(120,200,255,${pulse})`; ctx.beginPath(); ctx.arc(x + tx * k, y + ty * k, full ? 7 : 4, 0, 7); ctx.fill(); }
  for (const [tx, ty] of tg.main) { ctx.fillStyle = `rgba(255,214,90,${pulse})`; ctx.strokeStyle = '#2a2238'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x + tx * k, y + ty * k, full ? 8 : 4.5, 0, 7); ctx.fill(); ctx.stroke(); }
  let px = player.x, py = player.y;
  if (area !== 'world' && interiorDef.returnTo) [px, py] = interiorDef.returnTo;
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#c8423b'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x + px * k, y + py * k, full ? 7 : 4, 0, 7); ctx.fill(); ctx.stroke();
  if (!full) {
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1;
    if (area === 'world') ctx.strokeRect(x + cam.x * k, y + cam.y * k, view.vw * k, view.vh * k);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- interface
function hudButton(x, y, r, drawFn, fn, active) {
  ctx.fillStyle = active ? 'rgba(255,214,90,0.92)' : 'rgba(20,24,20,0.6)'; ctx.strokeStyle = 'rgba(255,246,216,0.7)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.stroke();
  drawFn(x, y);
  addBtn(x - r, y - r, r * 2, r * 2, fn);
}
function drawHUD() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  layoutButtons();
  const L = 12 + SAFE.l, T = 10 + SAFE.t;
  for (let i = 0; i < S.maxHp; i++) heart(L + 12 + i * 25, T + 12, 20, '#ff4d63', i >= player.hp);
  ctx.fillStyle = '#ffd84a'; ctx.beginPath(); ctx.arc(L + 11, T + 40, 8, 0, 7); ctx.fill();
  ctx.strokeStyle = '#8a5a10'; ctx.lineWidth = 2; ctx.stroke();
  ctx.font = `700 16px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(20,15,25,0.8)'; ctx.strokeText(String(S.coins), L + 25, T + 41);
  ctx.fillStyle = '#fff6d8'; ctx.fillText(String(S.coins), L + 25, T + 41);
  ['petala', 'orvalho', 'brasa'].forEach((k, i) => relicIcon(k, L + 80 + i * 32, T + 41, 26, S.relics[k]));
  ctx.font = `600 14px ${FONT}`;
  const ob = objective(), ow = Math.min(W * 0.5, ctx.measureText(ob).width + 26), oy = T + 60;
  ctx.fillStyle = 'rgba(20,24,20,0.62)'; ctx.beginPath(); ctx.roundRect(L, oy, ow, 26, 9); ctx.fill();
  ctx.fillStyle = '#ffe38a'; ctx.fillRect(L + 9, oy + 9, 6, 8);
  ctx.fillStyle = '#fff6d8'; ctx.textAlign = 'left'; ctx.fillText(ob, L + 20, oy + 14, ow - 26);
  // minimapa
  const mw = Math.min(170, W * 0.22), mh = mw * WH / WW, mx = W - SAFE.r - 12 - mw, my = T + 2;
  if (area === 'world' || true) { drawMap(mx, my, mw, mh, false); addBtn(mx, my, mw, mh, () => { showMap = true; Audio.sfx('ui'); }); }
  label('MAPA', mx + mw / 2, my + mh + 11, 11, '#fff6d8', 0.75);
  // som
  hudButton(mx - 24, my + 18, 17, (x, y) => {
    ctx.fillStyle = '#fff6d8'; ctx.beginPath(); ctx.moveTo(x - 8, y - 3); ctx.lineTo(x - 4, y - 3); ctx.lineTo(x + 1, y - 8); ctx.lineTo(x + 1, y + 8); ctx.lineTo(x - 4, y + 3); ctx.lineTo(x - 8, y + 3); ctx.fill();
    ctx.strokeStyle = '#fff6d8'; ctx.lineWidth = 2; ctx.beginPath();
    if (Audio.muted) { ctx.moveTo(x + 4, y - 5); ctx.lineTo(x + 10, y + 5); ctx.moveTo(x + 10, y - 5); ctx.lineTo(x + 4, y + 5); } else ctx.arc(x + 2, y, 6, -0.8, 0.8);
    ctx.stroke();
  }, () => Audio.setMuted(!Audio.muted));
  // chefe
  if (bossRef && !bossRef.dead) {
    const bw = Math.min(300, W - 360), bx = (W - bw) / 2, by = T + 18;
    label('Musgo Ancião', W / 2, by - 4, 15, '#e9ffd0');
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.beginPath(); ctx.roundRect(bx, by + 6, bw, 12, 6); ctx.fill();
    ctx.fillStyle = '#7ccf55'; ctx.beginPath(); ctx.roundRect(bx + 2, by + 8, (bw - 4) * Math.max(0, bossRef.hp / bossRef.maxHp), 8, 4); ctx.fill();
  }
  // joystick
  if (input.joy) {
    const j = input.joy;
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(j.ox, j.oy, 52, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.arc(j.x, j.y, 24, 0, 7); ctx.fill();
  } else if (!dialog && !S.moved) label('Arraste aqui para andar', W * 0.22, H - 50 - SAFE.b, 15, '#fff6d8', 0.6 + Math.sin(time * 3) * 0.3);
  // botões
  const b = btn.action, it = interactTarget;
  ctx.fillStyle = it ? 'rgba(255,214,90,0.92)' : 'rgba(255,250,235,0.85)'; ctx.strokeStyle = '#2a2238'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill(); ctx.stroke();
  if (it) { ctx.fillStyle = '#2a2238'; ctx.font = `700 16px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(it.label, b.x, b.y + 1); }
  else drawIcon('espada' + S.eq.espada, b.x, b.y, 44);
  hudButton(b.x - 92, b.y + 14, 28, (x, y) => {
    ctx.fillStyle = '#c99a6a'; ctx.fillRect(x - 11, y - 7, 22, 17); ctx.fillStyle = '#8a5a34'; ctx.fillRect(x - 11, y - 7, 22, 5); ctx.fillRect(x - 5, y - 12, 10, 5);
    ctx.fillStyle = '#e0a020'; ctx.fillRect(x - 2, y - 3, 4, 4);
  }, () => { menu = { tab: 'bag' }; Audio.sfx('ui'); });
  label('Mochila', b.x - 92, b.y + 52, 11, '#fff6d8', 0.8);
  const potion = S.bag.pocao ? 'pocao' : S.bag.torta ? 'torta' : null;
  if (potion) {
    hudButton(b.x - 6, b.y - 82, 24, (x, y) => drawIcon(potion, x, y, 28), () => useItem(potion));
    label('x' + S.bag[potion], b.x + 16, b.y - 66, 13, '#fff6d8');
  }
  // faixa de nome
  if (banner) {
    const a = Math.min(1, banner.t, (2.6 - banner.t) * 3);
    ctx.globalAlpha = Math.max(0, a);
    const by = H * 0.3;
    ctx.fillStyle = 'rgba(20,24,20,0.5)'; ctx.fillRect(0, by - 24, W, 48);
    ctx.fillStyle = '#ffe38a'; ctx.fillRect(0, by - 24, W, 2); ctx.fillRect(0, by + 22, W, 2);
    ctx.globalAlpha = 1;
    label(banner.text, W / 2, by, 26, '#fff6d8', Math.max(0, a));
  }
  if (toastMsg) {
    const a = Math.min(1, toastMsg.life * 2);
    ctx.font = `700 16px ${FONT}`; const tw = ctx.measureText(toastMsg.t).width + 30;
    ctx.globalAlpha = a; ctx.fillStyle = 'rgba(40,30,20,0.85)'; ctx.beginPath(); ctx.roundRect((W - tw) / 2, H * 0.16, tw, 32, 10); ctx.fill();
    ctx.globalAlpha = 1; label(toastMsg.t, W / 2, H * 0.16 + 16, 16, '#ffe38a', a);
  }
  if (dialog) drawDialog();
  if (showMap) drawBigMap();
  if (menu) drawMenu();
  if (flash > 0) { ctx.fillStyle = `rgba(255,245,210,${Math.min(0.7, flash)})`; ctx.fillRect(0, 0, W, H); }
}
function wrap(text, maxW) {
  const words = text.split(' '), lines = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur); return lines;
}
function drawDialog() {
  const l = dialog.lines[dialog.i]; if (!l) return;
  const pad = 14, bw = Math.min(W - 40 - SAFE.l - SAFE.r, 700), bh = 124, bx = (W - bw) / 2, by = H - bh - 10 - SAFE.b;
  ctx.fillStyle = 'rgba(28,24,34,0.94)'; ctx.strokeStyle = '#e8d6a8'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 14); ctx.fill(); ctx.stroke();
  let tx = bx + pad;
  const pk = PORTRAIT[l.who];
  if (pk) {
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.beginPath(); ctx.roundRect(bx + 10, by + 10, 70, 80, 10); ctx.fill();
    ctx.imageSmoothingEnabled = false;
    const sp = pk === 'kai' ? HERO.down[0] : NPC[pk];
    ctx.drawImage(sp.img, 0, 0, sp.w, 11, bx + 12, by + 16, 66, 60);
    ctx.font = `700 13px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = '#ffe38a'; ctx.textBaseline = 'middle';
    ctx.fillText(l.who, bx + 45, by + 104, 80);
    tx = bx + 92;
  }
  ctx.font = `500 17px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = '#fff6e6';
  const shown = Math.floor(dialog.shown);
  const lines = wrap(l.text, bx + bw - pad - tx);
  let n = 0;
  lines.forEach((ln, i) => { const part = ln.slice(0, Math.max(0, shown - n)); n += ln.length + 1; ctx.fillText(part, tx, by + 14 + i * 23); });
  const done = dialog.shown >= l.text.length;
  if (done && dialog.choices && dialog.i === dialog.lines.length - 1) {
    let cx = tx; const cy = by + bh - 44;
    dialog.choices.forEach((c, i) => {
      ctx.font = `700 15px ${FONT}`; const w = ctx.measureText(c.t).width + 28;
      ctx.fillStyle = i === 0 ? '#ffd65a' : 'rgba(255,250,235,0.9)'; ctx.strokeStyle = '#2a2238'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(cx, cy, w, 34, 9); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#2a2238'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(c.t, cx + w / 2, cy + 17);
      addBtn(cx, cy, w, 34, () => choose(c));
      cx += w + 10;
    });
  } else if (done) { ctx.fillStyle = '#ffe38a'; const yb = by + bh - 18 + Math.sin(time * 6) * 3; ctx.beginPath(); ctx.moveTo(bx + bw - 30, yb); ctx.lineTo(bx + bw - 18, yb); ctx.lineTo(bx + bw - 24, yb + 8); ctx.fill(); }
}
function drawBigMap() {
  ctx.fillStyle = 'rgba(10,14,10,0.8)'; ctx.fillRect(0, 0, W, H);
  const pad = 20, aw = W - pad * 2 - SAFE.l - SAFE.r, ah = H - pad * 2 - 30 - SAFE.t - SAFE.b;
  const w = Math.min(aw, ah * WW / WH), h = w * WH / WW;
  const x = (W - w) / 2, y = SAFE.t + pad + 22;
  label('Mapa do Vale', W / 2, y - 14, 18, '#ffe38a');
  drawMap(x, y, w, h, true);
  label('● você    ● missão principal    ● missões extras    (toque para fechar)', W / 2, y + h + 14, 12, '#cfe6c0', 0.9);
  addBtn(0, 0, W, H, () => { showMap = false; });
}
function panelButton(text, x, y, w, h, fn, style) {
  ctx.fillStyle = style === 'on' ? '#ffd65a' : style === 'off' ? 'rgba(255,255,255,0.12)' : 'rgba(255,250,235,0.92)';
  ctx.strokeStyle = style === 'off' ? 'rgba(255,255,255,0.2)' : '#2a2238'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.fill(); ctx.stroke();
  ctx.fillStyle = style === 'off' ? 'rgba(255,255,255,0.45)' : '#2a2238'; ctx.font = `700 ${Math.min(15, h * 0.45)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, x + w / 2, y + h / 2 + 1, w - 6);
  if (fn && style !== 'off') addBtn(x, y, w, h, fn);
}
function drawMenu() {
  ctx.fillStyle = 'rgba(10,14,10,0.6)'; ctx.fillRect(0, 0, W, H);
  addBtn(0, 0, W, H, () => {});
  const pw = Math.min(W - 24 - SAFE.l - SAFE.r, 820), ph = H - 20 - SAFE.t - SAFE.b, px = (W - pw) / 2, py = SAFE.t + 10;
  ctx.fillStyle = '#2b2219'; ctx.strokeStyle = '#e8d6a8'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 16); ctx.fill(); ctx.stroke();
  const tabs = [['bag', 'Mochila'], ['craft', 'Criar'], ['quests', 'Missões']];
  const tw = Math.min(130, (pw - 80) / 3);
  tabs.forEach(([id, t], i) => panelButton(t, px + 12 + i * (tw + 8), py + 10, tw, 34, () => { menu.tab = id; Audio.sfx('ui'); }, menu.tab === id ? 'on' : null));
  panelButton('✕', px + pw - 46, py + 10, 34, 34, () => { menu = null; Audio.sfx('ui'); });
  const cx = px + 14, cy = py + 54, cw = pw - 28, ch = ph - 64;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  if (menu.tab === 'bag') drawBagTab(cx, cy, cw, ch);
  else if (menu.tab === 'craft') drawCraftTab(cx, cy, cw, ch);
  else drawQuestTab(cx, cy, cw, ch);
}
function text(t, x, y, size, col, weight = 600, maxW) { ctx.font = `${weight} ${size}px ${FONT}`; ctx.fillStyle = col; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y, maxW); }
function drawBagTab(x, y, w, h) {
  const colW = (w - 16) / 2;
  text('Materiais', x, y + 8, 15, '#ffe38a', 700);
  const mats = Object.keys(S.inv), cell = Math.min(colW / 4, 72);
  mats.forEach((k, i) => {
    const cx = x + (i % 4) * cell, cy = y + 22 + Math.floor(i / 4) * (cell + 6);
    ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.beginPath(); ctx.roundRect(cx, cy, cell - 6, cell, 8); ctx.fill();
    drawIcon(k, cx + (cell - 6) / 2, cy + cell * 0.38, cell * 0.42);
    text(NAMES[k], cx + 4, cy + cell * 0.74, 11, '#e8dcc0', 600, cell - 12);
    text('x' + S.inv[k], cx + 4, cy + cell * 0.9, 12, '#fff', 700);
  });
  const ex = x + colW + 16;
  text('Itens', ex, y + 8, 15, '#ffe38a', 700);
  let yy = y + 26;
  for (const k of ['pocao', 'torta', 'feixe']) {
    ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.beginPath(); ctx.roundRect(ex, yy, colW, 40, 8); ctx.fill();
    drawIcon(k, ex + 20, yy + 20, 26);
    text(NAMES[k] + '  x' + S.bag[k], ex + 40, yy + 20, 14, '#fff6e6', 600);
    if (k !== 'feixe') panelButton('Usar', ex + colW - 70, yy + 6, 62, 28, () => useItem(k), S.bag[k] && player.hp < S.maxHp ? null : 'off');
    yy += 46;
  }
  text('Equipamento', ex, yy + 10, 15, '#ffe38a', 700); yy += 22;
  const eq = [['espada' + S.eq.espada, ['Espada de Madeira', 'Espada de Pedra', 'Espada de Cristal'][S.eq.espada - 1] + ' (dano ' + S.eq.espada + ')', true],
    ['armadura', 'Armadura de Folhas', S.eq.armadura], ['botas', 'Botas de Vento', S.eq.botas], ['coleira', 'Coleira do Floco', S.eq.coleira]];
  for (const [ic, nm, on] of eq) {
    ctx.globalAlpha = on ? 1 : 0.35; drawIcon(ic, ex + 14, yy + 12, 20); text(nm + (on ? '' : ' — não tem'), ex + 32, yy + 12, 13, '#fff6e6'); ctx.globalAlpha = 1;
    yy += 24;
    if (yy > y + h - 10) break;
  }
}
function drawCraftTab(x, y, w, h) {
  const station = menu.station;
  text(station ? 'Bancada do Bruno: todas as receitas' : 'Receitas com ⚒ precisam da bancada da Oficina do Bruno (Praça)', x, y + 6, 13, station ? '#9be36a' : '#e8dcc0', 600, w);
  const cols = w > 560 ? 2 : 1, colW = (w - (cols - 1) * 10) / cols;
  const rows = Math.ceil(RECIPES.length / cols), rh = Math.min(70, (h - 22) / rows - 6);
  RECIPES.forEach((r, i) => {
    const cx = x + (i % cols) * (colW + 10), cy = y + 20 + Math.floor(i / cols) * (rh + 6);
    ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.beginPath(); ctx.roundRect(cx, cy, colW, rh, 9); ctx.fill();
    drawIcon(r.icon, cx + rh / 2, cy + rh / 2, rh * 0.55);
    const owned = r.has && r.has();
    text((r.station ? '⚒ ' : '') + r.name, cx + rh + 4, cy + rh * 0.24, Math.min(15, rh * 0.24), '#fff6e6', 700, colW - rh - 90);
    text(r.desc, cx + rh + 4, cy + rh * 0.5, Math.min(12, rh * 0.2), '#cfc3a6', 500, colW - rh - 90);
    let ix = cx + rh + 4;
    for (const [k, n] of Object.entries(r.need)) {
      drawIcon(k, ix + 8, cy + rh * 0.78, Math.min(16, rh * 0.25));
      const ok = S.inv[k] >= n;
      text(S.inv[k] + '/' + n, ix + 18, cy + rh * 0.78, Math.min(12, rh * 0.2), ok ? '#9be36a' : '#ff8a8a', 700);
      ix += 54;
    }
    const can = canCraft(r) && !owned && (!r.station || station);
    panelButton(owned ? 'Feito ✓' : r.station && !station ? 'Bancada' : 'Criar', cx + colW - 80, cy + rh / 2 - 16, 72, 32, () => craft(r), can ? 'on' : 'off');
  });
}
function drawQuestTab(x, y, w, h) {
  const { main, side } = questList();
  const colW = (w - 16) / 2;
  text('★ ' + main.title, x, y + 8, 16, '#ffe38a', 700, colW);
  let yy = y + 32;
  ctx.font = `500 13px ${FONT}`;
  for (const s of main.steps) {
    const ls = wrap(s.t, colW - 26);
    text(s.ok ? '✓' : '○', x, yy, 14, s.ok ? '#9be36a' : '#e8dcc0', 700);
    ls.forEach((ln, i) => text(ln, x + 20, yy + i * 16, 13, s.ok ? '#9fb88a' : '#fff6e6', 500));
    yy += ls.length * 16 + 8;
  }
  const ex = x + colW + 16;
  text('Missões extras', ex, y + 8, 16, '#9ad1ff', 700);
  yy = y + 30;
  const rowH = Math.min(52, (h - 30) / side.length);
  for (const q of side) {
    ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.beginPath(); ctx.roundRect(ex, yy, colW, rowH - 6, 8); ctx.fill();
    const status = q.st === 2 ? '✓ Concluída' : q.st === 1 ? q.prog : 'Fale com: ' + q.giver;
    text((q.st === 2 ? '✓ ' : q.st === 1 ? '● ' : '? ') + (q.st === 0 ? '???' : q.title), ex + 8, yy + (rowH - 6) * 0.32, 14, q.st === 2 ? '#9fb88a' : q.st === 1 ? '#fff6e6' : '#b8ad94', 700, colW - 16);
    text(q.st === 1 ? status + ' — ' + q.desc : status, ex + 8, yy + (rowH - 6) * 0.72, 12, '#cfc3a6', 500, colW - 16);
    yy += rowH;
  }
}

// ---------------------------------------------------------------- título, final e "gire o celular"
let endT = 0, titleStart = null;
function backdrop(cx, cy, zoom) {
  // desenha o próprio mundo como fundo das telas de título e final
  area = 'world'; grid = worldGrid;
  view.s = Math.min(H, W * 0.75) / 820 * zoom; view.vw = W / view.s; view.vh = H / view.s;
  cam.x = clamp(cx - view.vw / 2, 0, WW - view.vw); cam.y = clamp(cy - view.vh / 2, 0, WH - view.vh);
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#14201a'; ctx.fillRect(0, 0, cv.width, cv.height);
  const keep = interactTarget; interactTarget = null;
  drawWorld();
  interactTarget = keep;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
function bigButton(t, x, y, w, h, fn, primary) {
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.roundRect(x, y + 4, w, h, 14); ctx.fill();
  ctx.fillStyle = primary ? '#ffd65a' : 'rgba(255,250,235,0.92)'; ctx.strokeStyle = '#2a2238'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 14); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#2a2238'; ctx.font = `700 20px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x + w / 2, y + h / 2 + 1);
  addBtn(x, y, w, h, () => { Audio.sfx('ui'); fn(); });
}
function goLandscape() {
  try {
    const el = document.documentElement;
    const p = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : null;
    if (p && p.then) p.then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {})).catch(() => {});
  } catch (e) { /* sem tela cheia */ }
}
function startGame(fresh) {
  goLandscape();
  if (fresh) { wipe(SAVE_KEY); S = newSave(); }
  else { const L = load(SAVE_KEY) || {}; S = Object.assign(newSave(), L); for (const k of ['inv', 'bag', 'eq', 'q', 'relics']) S[k] = Object.assign(newSave()[k], L[k] || {}); }
  player.hp = S.maxHp; player.inv = 0; dialog = null; endT = 0; menu = null; showMap = false;
  buildWorldEntities();
  mode = 'play';
  fade = { t: 0.35, dur: 0.7, mid: null };
  curRegion = null;
  if (S.pos && S.pos.area && S.pos.area !== 'world' && INTERIORS[S.pos.area]) {
    const I = INTERIORS[S.pos.area];
    const door = REGION_LIST.flatMap(r => r.doors.map(d => ({ d, r }))).find(o => o.d.to === S.pos.area);
    I.returnTo = toWorld(door.r, door.d.x, door.d.y);
    setArea(S.pos.area, S.pos.x, S.pos.y);
  } else if (S.pos && S.pos.area === 'world') setArea('world', S.pos.x, S.pos.y);
  else { const [x, y] = toWorld(REGIONS.praca, ...REGIONS.praca.start); setArea('world', x, y); }
  if (S.stage === 0) setTimeout(() => say(['Kai: Que dia bonito no vale, Floco!', 'Kai: A Vó Aurora pediu pra gente encontrar ela aqui na Praça...',
    'Dica: arraste o dedo no lado esquerdo para andar. O botão redondo ataca, fala e entra nas casas.']), 900);
}
function drawTitle() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  uiButtons = [];
  player.x = 3470; player.y = 2330; player.dir = 'down'; player.moving = false; dog.x = 3400; dog.y = 2345; dog.moving = false;
  backdrop(3600, 2050, 0.9);
  const g = ctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, 'rgba(10,20,15,0.85)'); g.addColorStop(0.55, 'rgba(10,20,15,0.35)'); g.addColorStop(1, 'rgba(10,20,15,0.6)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const land = W > H, lx = land ? W * 0.3 : W / 2;
  const ty = land ? H * 0.28 : H * 0.2;
  label('VALE DA', lx, ty - 32, Math.min(30, W / 16), '#fff6d8');
  label('LANTERNA', lx, ty + 14, Math.min(60, W / 9), '#ffd65a');
  label('Uma aventura de Kai e Floco', lx, ty + 58, 16, '#e9ffd0');
  ctx.imageSmoothingEnabled = false;
  const cy = land ? H * 0.78 : H * 0.55, f = Math.floor(time * 6) % 4;
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(lx - 10, cy + 4, 90, 14, 0, 0, 7); ctx.fill();
  spr(HERO.down[[1, 0, 2, 0][f]], lx + 20, cy, Math.min(8, H / 60), false, false);
  spr(DOG[1 + (Math.floor(time * 8) % 2)], lx - 66, cy + Math.abs(Math.sin(time * 8)) * -6, Math.min(6, H / 75), false, false);
  const bw = Math.min(260, W * 0.36), bx = land ? W * 0.72 - bw / 2 : (W - bw) / 2;
  let by = land ? H * 0.4 : H * 0.7;
  if (hasSave()) {
    titleStart = () => startGame(false);
    bigButton('Continuar', bx, by, bw, 54, titleStart, true); by += 68;
    bigButton('Novo jogo', bx, by, bw, 50, () => startGame(true));
  } else { titleStart = () => startGame(true); bigButton('Jogar', bx, by, bw, 58, titleStart, true); }
  label('Mundo aberto • casas • criação de itens • missões', land ? W * 0.72 : W / 2, by + 80, 13, '#cfe6c0', 0.85);
  if (H > W) drawRotate();
}
function drawRotate() {
  ctx.fillStyle = 'rgba(12,16,12,0.92)'; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.translate(W / 2, H * 0.38); ctx.rotate(Math.sin(time * 2) > 0 ? -Math.PI / 2 : 0);
  ctx.strokeStyle = '#ffd65a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.roundRect(-30, -50, 60, 100, 10); ctx.stroke();
  ctx.fillStyle = '#ffd65a'; ctx.fillRect(-6, 40, 12, 4);
  ctx.restore();
  label('Gire o celular', W / 2, H * 0.58, 26, '#fff6d8');
  label('O Vale da Lanterna é jogado na horizontal', W / 2, H * 0.58 + 34, 14, '#cfe6c0');
  if (mode === 'play') bigButton('Jogar assim mesmo', (W - 220) / 2, H * 0.72, 220, 46, () => { allowPortrait = true; });
}
function drawEnd() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  uiButtons = [];
  endT += 1 / 60;
  backdrop(6750, 1950, 0.85);
  const k = Math.min(1, endT / 2);
  const g = ctx.createRadialGradient(W * 0.6, H * 0.05, 10, W * 0.6, H * 0.05, Math.max(W, H) * (0.3 + k * 0.9));
  g.addColorStop(0, `rgba(255,236,160,${0.85 * k})`); g.addColorStop(0.5, `rgba(255,200,120,${0.35 * k})`); g.addColorStop(1, 'rgba(255,200,120,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = `rgba(10,20,15,${0.5 * k})`; ctx.fillRect(0, H * 0.22, W, H * 0.6);
  label('A Lanterna brilha', W / 2, H * 0.32, Math.min(38, W / 14), '#ffe38a', k);
  label('de novo sobre o vale!', W / 2, H * 0.32 + 40, Math.min(26, W / 20), '#fff6d8', k);
  const sideDone = Object.values(S.q).filter(v => v === 2).length;
  label('Moedas: ' + S.coins + '   Corações: ' + S.maxHp + '   Missões extras: ' + sideDone + '/5   Musgos: ' + S.mkills, W / 2, H * 0.32 + 84, 15, '#e9ffd0', k);
  if (endT > 1.5) bigButton('Jogar de novo', W / 2 - 130, H * 0.8, 260, 50, () => { wipe(SAVE_KEY); mode = 'title'; });
}

// ---------------------------------------------------------------- laço principal
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  try {
    if (mode === 'play') {
      update(dt);
      uiButtons = [];
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#14201a'; ctx.fillRect(0, 0, cv.width, cv.height);
      drawWorld();
      drawHUD();
      if (rotateNeeded()) { ctx.setTransform(DPR, 0, 0, DPR, 0, 0); uiButtons = []; drawRotate(); }
    } else if (mode === 'title') { time += dt; Audio.tick(); drawTitle(); }
    else if (mode === 'end') { time += dt; Audio.tick(); drawEnd(); }
    if (fade) {
      if (mode !== 'play') update(dt);
      const k = fade.t / fade.dur, a = k < 0.5 ? k * 2 : (1 - k) * 2;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.fillStyle = `rgba(12,16,12,${clamp(a, 0, 1)})`; ctx.fillRect(0, 0, W, H);
    }
  } catch (err) { console.error(err); }
  requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange', () => {
  if (!Audio.ac) return;
  if (document.hidden) { Audio.ac.suspend(); if (mode === 'play') save(); } else { Audio.ac.resume(); Audio.nextNote = Audio.ac.currentTime + 0.1; }
});

(async function boot() {
  const setMsg = t => { const el = document.getElementById('loading'); if (el) el.textContent = t; };
  try { await Promise.race([document.fonts.load(`700 20px "Pixelify Sans"`), new Promise(r => setTimeout(r, 2500))]); } catch (e) { /* ok */ }
  setMsg('Criando o mundo…');
  await new Promise(r => setTimeout(r, 30));
  buildTerrain();
  buildWorldGrid();
  buildBuildings();
  placeTownDecor();
  placeProps();
  for (const id of Object.keys(INTERIORS)) buildInterior(id);
  buildMinimap();
  grid = worldGrid;
  document.getElementById('loading').remove();
  mode = 'title';
  requestAnimationFrame(frame);
})();

// para testes automáticos
window.__vale = { get S() { return S; }, player, get mode() { return mode; }, startGame, get area() { return area; }, setArea,
  get enemies() { return enemies; }, get dialog() { return dialog; }, advanceDialog, choose, interact, get target() { return interactTarget; },
  openMenu(tab, station) { menu = { tab, station }; }, closeMenu() { menu = null; }, set showMap(v) { showMap = v; }, toWorld, REGIONS, INTERIORS, craft, RECIPES, props };
