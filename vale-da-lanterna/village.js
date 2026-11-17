/* Vale da Lanterna — vila maior: três casas novas de famílias, a Escola do Vale, e moradores crianças e adolescentes
   com rotina própria (escola nos dias de semana, brincadeiras, fim de semana diferente). As construções entram
   depois que o mapa é gerado, então o resto do mundo (árvores, pedras, cogumelos) continua igual. */
'use strict';

const NEW_HOUSES = [
  { kind: 'house', x: 2700, y: 1400, w: 70, roof: 'red', wall: 'stone', chimney: false, to: 'escola', region: 'vila', sign: 'book', school: true },
  { kind: 'house', x: 2700, y: 920, w: 60, roof: 'teal', wall: 'plaster', chimney: true, to: 'casaMoura', region: 'vila' },
  { kind: 'house', x: 1390, y: 650, w: 56, roof: 'brown', wall: 'wood', chimney: true, to: 'casaRocha', region: 'vila' },
  { kind: 'house', x: 1370, y: 2080, w: 60, roof: 'purple', wall: 'adobe', chimney: true, to: 'casaFlores', region: 'vila' }
];
// caminhos de terra até a trilha mais próxima (e pontos para a rede de caminhos dos moradores)
const NEW_PATHS = [];
const EXTRA_NAV = [];

Object.assign(INTERIORS, {
  casaMoura: homeDef('Casa da Dona Cida', 'brick', 3, ['#2f6b8a', '#c8423b', '#ff9ec7']),
  casaRocha: homeDef('Casa do Seu Zeca', 'wood', 3, ['#3b5f8f', '#e9c46a', '#4f7fbf']),
  casaFlores: homeDef('Casa da Marta', 'brick', 4, ['#7b9a4a', '#5fa65a', '#b59cff', '#f2c94c']),
  escola: { name: 'Escola do Vale', w: 12, h: 8, floor: 'wood', wall: 'brick',
    furn: [{ t: 'window', x: 1, y: 0, w: 1, h: 2 }, { t: 'board', x: 4, y: 0, w: 4, h: 2 }, { t: 'window', x: 10, y: 0, w: 1, h: 2 },
      { t: 'shelf', x: 8, y: 0, w: 2, h: 2 }, { t: 'table', x: 5, y: 2, w: 2, h: 1, block: 1 }, { t: 'plant', x: 11, y: 2, w: 1, h: 1, block: 1 },
      { t: 'desk', x: 2, y: 4, w: 1, h: 1, block: 1 }, { t: 'desk', x: 4, y: 4, w: 1, h: 1, block: 1 }, { t: 'desk', x: 7, y: 4, w: 1, h: 1, block: 1 }, { t: 'desk', x: 9, y: 4, w: 1, h: 1, block: 1 },
      { t: 'desk', x: 2, y: 6, w: 1, h: 1, block: 1 }, { t: 'desk', x: 4, y: 6, w: 1, h: 1, block: 1 }, { t: 'desk', x: 7, y: 6, w: 1, h: 1, block: 1 }, { t: 'desk', x: 9, y: 6, w: 1, h: 1, block: 1 },
      { t: 'toybox', x: 0, y: 6, w: 1, h: 1, block: 1 }],
    npcs: [] }
});

// lugares das rotinas novas
Object.assign(PLACES, {
  escola_aula: { area: 'escola', x: 6 * 48, y: 5.9 * 48, rect: [7.5 * 48, 2.6 * 48], face: [0, -1] },
  escola_prof: { area: 'escola', x: 6 * 48, y: 3.4 * 48, spread: 0, face: [0, 1] },
  vila_brincar: { area: 'world', x: 2600, y: 1720, rect: [260, 90] },
  rio_margem: { area: 'world', x: 2470, y: 1080, spread: 30, face: [-1, 0] },
  ervas: { area: 'world', x: 1250, y: 2260, rect: [200, 60] },
  campo_treino: { area: 'world', x: FB.cx - 200, y: FB.cy, rect: [260, 200] },
  serraria_ajuda: { area: 'world', x: 1618, y: 936, spread: 0, face: [-1, 0.3] }
});

// ---------------------------------------------------------------- moradores novos
const KID_SCHED = [[7, 8, 'home', 'idle'], [8, 12, 'escola_aula', 'rest'], [12, 13, 'eat', 'idle'], [13, 17, 'vila_brincar', 'idle'], [17, 19, 'home', 'idle'], [19.5, 31, 'bed', 'sleep']];
const KID_WEEKEND = [[8, 12, 'vila_brincar', 'idle'], [12, 13, 'eat', 'idle'], [13, 17, 'praca_brincar', 'idle'], [17, 19.5, 'home', 'idle'], [19.5, 32, 'bed', 'sleep']];
const NEW_RESIDENTS = [
  { id: 'cida', name: 'Dona Cida', age: 41, prof: 'Professora', pers: 'gentil', home: 'casaMoura', bed: 0, likes: ['flor', 'cristal'],
    app: { skin: '#c98f5e', hair: '#2a1a12', hairStyle: 'bun', top: '#2f6b8a', dress: true, collar: '#fbfbf4' },
    sched: [[6, 7.5, 'home', 'idle'], [7.5, 12.5, 'escola_prof', 'talk'], [12.5, 13.5, 'eat', 'idle'], [13.5, 17, 'home', 'idle'], [17, 20, 'vila_praca', 'talk'], [20, 22, 'home', 'idle'], [22, 30, 'bed', 'sleep']],
    weekend: [[7, 10, 'home', 'idle'], [10, 13, 'praca_fonte', 'talk'], [13, 14, 'eat', 'idle'], [14, 19, 'vila_praca', 'talk'], [19, 22, 'home', 'idle'], [22, 31, 'bed', 'sleep']] },
  { id: 'zeca', name: 'Seu Zeca', age: 47, prof: 'Barqueiro', pers: 'serio', home: 'casaRocha', bed: 0, likes: ['carpa', 'madeira'],
    app: { skin: '#8a5a3a', hair: '#d8d4cc', hairStyle: 'short', top: '#3b5f8f', bottom: '#2a2a35', hat: 'cap', hatCol: '#c8423b', beard: '#d8d4cc' },
    sched: [[5, 6, 'home', 'idle'], [6, 12, 'rio_margem', 'fish'], [12, 13, 'eat', 'idle'], [13, 17, 'rio_margem', 'fish'], [17, 20, 'praca_fonte', 'talk'], [20, 21, 'home', 'idle'], [21, 29, 'bed', 'sleep']] },
  { id: 'marta', name: 'Marta', age: 36, prof: 'Curandeira', pers: 'sonhadora', home: 'casaFlores', bed: 0, likes: ['seiva', 'flor'],
    app: { skin: '#f0c08a', hair: '#7a3a1a', hairStyle: 'long', top: '#7b9a4a', dress: true, apron: '#e9dcc0' },
    sched: [[6, 7, 'home', 'idle'], [7, 12, 'ervas', 'farm'], [12, 13, 'eat', 'idle'], [13, 16, 'home', 'work'], [16, 19, 'vila_praca', 'talk'], [19, 21, 'home', 'idle'], [21, 30, 'bed', 'sleep']] },
  // adolescentes
  { id: 'pedro', name: 'Pedro', age: 16, prof: 'Estudante', pers: 'brincalhao', home: 'casaMoura', bed: 1, likes: ['peixe', 'torta'], teen: true,
    app: { skin: '#c98f5e', hair: '#1a100a', hairStyle: 'spiky', top: '#c8423b', bottom: '#33384e', scale: 0.92 },
    sched: [[7, 8, 'home', 'idle'], [8, 12, 'escola_aula', 'rest'], [12, 13, 'eat', 'idle'], [13, 17, 'campo_treino', 'idle'], [17, 21, 'vila_praca', 'talk'], [21, 22, 'home', 'idle'], [22, 31, 'bed', 'sleep']],
    weekend: [[8, 10, 'home', 'idle'], [10, 17, 'campo_treino', 'idle'], [17, 22, 'praca_fonte', 'talk'], [22, 32, 'bed', 'sleep']] },
  { id: 'duda', name: 'Duda', age: 14, prof: 'Estudante', pers: 'aventureira', home: 'casaRocha', bed: 1, likes: ['cristal', 'morango'], teen: true,
    app: { skin: '#8a5a3a', hair: '#1f1f2a', hairStyle: 'pony', top: '#e9c46a', bottom: '#2f8a84', scale: 0.88 },
    sched: [[7, 8, 'home', 'idle'], [8, 12, 'escola_aula', 'rest'], [12, 13, 'eat', 'idle'], [13, 17, 'rio_margem', 'fish'], [17, 20, 'praca_fonte', 'talk'], [20, 21.5, 'home', 'idle'], [21.5, 31, 'bed', 'sleep']],
    weekend: [[8, 12, 'campo_treino', 'idle'], [12, 13, 'eat', 'idle'], [13, 17, 'rio_margem', 'fish'], [17, 21, 'praca_fonte', 'talk'], [21, 32, 'bed', 'sleep']] },
  { id: 'rafa', name: 'Rafa', age: 15, prof: 'Estudante', pers: 'timido', home: 'casaFlores', bed: 1, likes: ['madeira', 'pao'], teen: true,
    app: { skin: '#f6d0a8', hair: '#c8a040', hairStyle: 'short', top: '#5fa65a', bottom: '#4a3a2a', scale: 0.9 },
    sched: [[7, 8, 'home', 'idle'], [8, 12, 'escola_aula', 'rest'], [12, 13, 'eat', 'idle'], [13, 17, 'serraria_ajuda', 'work'], [17, 20, 'vila_praca', 'idle'], [20, 22, 'home', 'idle'], [22, 31, 'bed', 'sleep']],
    weekend: [[8, 12, 'home', 'idle'], [12, 13, 'eat', 'idle'], [13, 18, 'vila_praca', 'idle'], [18, 22, 'home', 'idle'], [22, 32, 'bed', 'sleep']] },
  // crianças
  { id: 'lia', name: 'Lia', age: 8, prof: 'Criança', pers: 'curioso', home: 'casaMoura', bed: 2, likes: ['flor', 'morango'], child: true,
    app: { skin: '#c98f5e', hair: '#2a1a12', hairStyle: 'pony', top: '#ff9ec7', dress: true, scale: 0.72 }, sched: KID_SCHED, weekend: KID_WEEKEND },
  { id: 'bento', name: 'Bento', age: 7, prof: 'Criança', pers: 'brincalhao', home: 'casaRocha', bed: 2, likes: ['torta', 'pedra'], child: true,
    app: { skin: '#8a5a3a', hair: '#1a100a', hairStyle: 'spiky', top: '#4f7fbf', bottom: '#e9c46a', scale: 0.7 }, sched: KID_SCHED, weekend: KID_WEEKEND },
  { id: 'malu', name: 'Malu', age: 10, prof: 'Criança', pers: 'alegre', home: 'casaFlores', bed: 2, likes: ['flor', 'torta'], child: true,
    app: { skin: '#f0c08a', hair: '#7a3a1a', hairStyle: 'long', top: '#b59cff', dress: true, scale: 0.76 },
    sched: [[7, 8, 'home', 'idle'], [8, 12, 'escola_aula', 'rest'], [12, 13, 'eat', 'idle'], [13, 17, 'praca_brincar', 'idle'], [17, 19.5, 'home', 'idle'], [19.5, 31, 'bed', 'sleep']], weekend: KID_WEEKEND },
  { id: 'nico', name: 'Nico', age: 6, prof: 'Criança', pers: 'curioso', home: 'casaFlores', bed: 3, likes: ['morango', 'torta'], child: true,
    app: { skin: '#f6d0a8', hair: '#c8a040', hairStyle: 'short', top: '#f2c94c', bottom: '#4a6fa5', scale: 0.66 }, sched: KID_SCHED, weekend: KID_WEEKEND }
];
RESIDENTS.push(...NEW_RESIDENTS);
// sábado e domingo
const isWeekend = (d = S.time.day) => { const w = weekday(d); return w === 'Sábado' || w === 'Domingo'; };
// escola fechada no fim de semana: quem não tem rotina de fim de semana fica em casa de manhã
function schedFor(r) { return (r.weekend && isWeekend()) ? r.weekend : r.sched; }

Object.assign(SOCIAL, {
  cida: { bday: [2, 10], eligible: false, gender: 'f', dislikes: ['pedra', 'seiva'], no: 'Ah, Kai... meu coração é do meu marido, que trabalha na cidade grande. Mas obrigada pelo carinho.' },
  zeca: { bday: [1, 18], eligible: false, gender: 'm', dislikes: ['flor'], no: 'Rapaz, desde que a minha Lurdes partiu, meu coração é do rio.' },
  marta: { bday: [0, 26], eligible: false, gender: 'f', dislikes: ['pedra'], no: 'Kai, que gentil... mas agora minha vida é cuidar dos meus três.' },
  pedro: { bday: [3, 7], eligible: false, teen: true, gender: 'm', dislikes: ['flor'] },
  duda: { bday: [1, 2], eligible: false, teen: true, gender: 'f', dislikes: ['seiva'] },
  rafa: { bday: [2, 23], eligible: false, teen: true, gender: 'm', dislikes: ['pedra'] },
  lia: { bday: [0, 17], eligible: false, child: true, gender: 'f', dislikes: ['cogumelo'] },
  bento: { bday: [3, 14], eligible: false, child: true, gender: 'm', dislikes: ['flor'] },
  malu: { bday: [1, 11], eligible: false, child: true, gender: 'f', dislikes: ['pedra'] },
  nico: { bday: [2, 2], eligible: false, child: true, gender: 'm', dislikes: ['cogumelo'] }
});
Object.assign(PROF_LINES, {
  'Professora': ['A escola começa às 8h. Os pequenos adoram a aula de desenho!', 'Ensinar é plantar devagar.'],
  'Barqueiro': ['Conheço cada curva desse rio.', 'Rio calmo, peixe arisco.'],
  'Curandeira': ['Chá de flor-lume cura até saudade.', 'As ervas da mata têm segredos.'],
  'Estudante': ['A escola é legal, mas o melhor é o recreio.', 'Sexta tem futebol, né? Eu vou!', 'Quando eu crescer quero conhecer as cidades grandes.']
});
PLACE_LINES.escola_aula = 'Shhh, a professora está explicando!';
PLACE_LINES.campo_treino = 'Tô treinando pra sexta!';
PLACE_LINES.vila_brincar = 'Pega-pega! Você tá com ele!';
// os mais novos também jogam bola (adolescentes no futebol de sexta)
Object.assign(FB_ATTR, {
  pedro: { spd: 8, sht: 6, ctl: 6, sta: 7, pas: 5, def: 4, tag: 'adolescente rápido' },
  duda: { spd: 7, sht: 5, ctl: 7, sta: 8, pas: 6, def: 5, tag: 'adolescente habilidosa' },
  rafa: { spd: 5, sht: 4, ctl: 4, sta: 6, pas: 6, def: 6, tag: 'adolescente, iniciante' }
});

// ---------------------------------------------------------------- construir as casas no mundo
function villageInitWorld() {
  const footprint = b => [b.x - 175, b.y - 380, b.x + 175, b.y + 70];
  const near = (p, [a, c, d, e]) => p.x > a && p.x < d && p.y > c && p.y < e;
  // caminho até a trilha mais próxima
  const nearestTrail = (x, y) => {
    for (let r = 60; r < 700; r += 20) for (let a = 0; a < 6.283; a += 0.12) {
      const tx = x + Math.cos(a) * r, ty = y + Math.abs(Math.sin(a)) * r * (a > 3.14 ? -0.6 : 1);
      if (terrainAt(tx, ty) === 1 || terrainAt(tx, ty) === 4) return [tx, ty];
    }
    return null;
  };
  for (const b of NEW_HOUSES) {
    // tira árvores e pedras do terreno da casa
    const fp = footprint(b);
    for (const p of props.filter(q => ['tree', 'rock', 'bush', 'tuft', 'flower', 'mush'].includes(q.t) && near(q, fp))) {
      bucketRemove(p);
      if (p.t === 'tree') stampGridBase(p.x, p.y - 6, 20); if (p.t === 'rock') stampGridBase(p.x, p.y - 8, 30);
    }
    const s = makeHouse(b, hashStr(b.to) & 0xffff);
    b.sc = 5; b.img = s.img; b.pw = s.w * b.sc; b.ph = s.h * b.sc;
    if (b.chimneyPos) b.smoke = [b.x - b.pw / 2 + b.chimneyPos[0] * b.sc, b.y - b.ph + 4];
    stampRect(valeGrid, b.x - b.pw / 2 + 16, b.y - s.foot * b.sc, b.x + b.pw / 2 - 16, b.y - 10, 0);
    REGIONS[b.region].doors.push({ x: b.x, y: b.y + 14, to: b.to });
    BUILDINGS.push(b);
    bucketAdd({ t: 'bld', x: b.x, y: b.y, b });
    // caminho
    const from = [b.x, b.y + 40], to = nearestTrail(b.x, b.y + 60);
    const pts = [from];
    if (b.to === 'casaMoura') pts.push([2930, 980], [2930, 1590]);   // contorna a escola
    else if (to) pts.push(to);
    NEW_PATHS.push(pts);
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [cx, cy] = pts[i], L = Math.hypot(cx - ax, cy - ay);
      for (let k = 0; k <= L; k += 40) {
        const x = ax + (cx - ax) * k / L, y = ay + (cy - ay) * k / L;
        for (const p of props.filter(q => ['tree', 'rock', 'bush', 'mush'].includes(q.t) && Math.abs(q.x - x) < 70 && Math.abs(q.y - y) < 60)) {
          bucketRemove(p); if (p.t === 'tree') stampGridBase(p.x, p.y - 6, 20); if (p.t === 'rock') stampGridBase(p.x, p.y - 8, 30);
        }
        if (k % 200 === 0) EXTRA_NAV.push([x, y]);
      }
      EXTRA_NAV.push([cx, cy]);
    }
  }
  for (const k of ['vila_brincar', 'rio_margem', 'ervas', 'campo_treino', 'serraria_ajuda']) { const P = PLACES[k]; EXTRA_NAV.push([P.x, P.y]); }
  // brinquedos: balanço e caixa de areia perto da área de brincar
  bucketAdd({ t: 'deco', d: 'flowerbed', x: 2460, y: 1770, seed: 7 });
}
// devolve o chão andável onde havia árvore/pedra (sem abrir água)
function stampGridBase(x, y, rad) {
  const c = CELL, r = Math.ceil(rad / c), gx = Math.floor(x / c), gy = Math.floor(y / c);
  for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
    const cx = gx + i, cy = gy + j; if (cx < 0 || cy < 0 || cx >= GC || cy >= GR) continue;
    if ((i * c) ** 2 + (j * c * 1.6) ** 2 > rad * rad) continue;
    const t = valeTer[cy * GC + cx];
    if (!BUILDINGS.some(B => B.pw && Math.abs(B.x - cx * c) < B.pw / 2 && cy * c < B.y && cy * c > B.y - B.ph * 0.7)) valeGrid.m[cy * GC + cx] = (t === 2 || t === 6) ? 0 : 1;
  }
}
// trilhas de terra novas (desenhadas por cima do chão)
function drawVillagePaths(x0, y0, x1, y1) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const pts of NEW_PATHS) {
    if (pts.every(([x, y]) => x < x0 - 200 || x > x1 + 200 || y < y0 - 200 || y > y1 + 200)) continue;
    for (const [w, col] of [[60, '#8a6a44'], [50, '#a8835a'], [30, '#b8946a']]) {
      ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath();
      pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
    }
    ctx.fillStyle = '#7a5a38';
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [cx, cy] = pts[i], L = Math.hypot(cx - ax, cy - ay);
      for (let k = 10; k < L; k += 23) { const h = (hashStr(i + ':' + k) >>> 0) % 40 - 20; ctx.fillRect(ax + (cx - ax) * k / L + h * 0.6 - 3, ay + (cy - ay) * k / L + (h % 7) * 2 - 2, 6, 4); }
    }
  }
}
