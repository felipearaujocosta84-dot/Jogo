/* Vale da Lanterna — jogo de aventura para celular (canvas 2D, sem dependências).
   Cenários: as ilustrações em assets/. Personagens: pixel art desenhada em código. */
(() => {
'use strict';

// ---------------------------------------------------------------- tela
const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
let W = 0, H = 0, DPR = 1, SAFE = { t: 0, r: 0, b: 0, l: 0 };
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  const cs = getComputedStyle(document.getElementById('safe'));
  SAFE = { t: parseFloat(cs.paddingTop) || 0, r: parseFloat(cs.paddingRight) || 0,
           b: parseFloat(cs.paddingBottom) || 0, l: parseFloat(cs.paddingLeft) || 0 };
}
window.addEventListener('resize', resize);
resize();

const FONT = '"Pixelify Sans", "Trebuchet MS", sans-serif';
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// ---------------------------------------------------------------- armazenamento (opcional)
const SAVE_KEY = 'vale-da-lanterna-v1';
function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sem armazenamento */ } }
function load(k) { try { const s = localStorage.getItem(k); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
function wipe(k) { try { localStorage.removeItem(k); } catch (e) { /* ok */ } }

// ---------------------------------------------------------------- áudio sintetizado
const Audio = {
  ac: null, master: null, muted: false, musicOn: true, nextNote: 0, step: 0,
  init() {
    if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume(); return; }
    try {
      this.ac = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ac.createGain(); this.master.gain.value = 0.55; this.master.connect(this.ac.destination);
      this.nextNote = this.ac.currentTime + 0.1;
    } catch (e) { this.ac = null; }
  },
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.55; },
  tone(f, d, type = 'square', vol = 0.12, slide = 0, delay = 0) {
    if (!this.ac || this.muted) return;
    const t = this.ac.currentTime + delay;
    const o = this.ac.createOscillator(), g = this.ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + d);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + d + 0.02);
  },
  noise(d, vol = 0.15, hp = 800) {
    if (!this.ac || this.muted) return;
    const n = Math.floor(this.ac.sampleRate * d), b = this.ac.createBuffer(1, n, this.ac.sampleRate);
    const a = b.getChannelData(0); for (let i = 0; i < n; i++) a[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = this.ac.createBufferSource(), f = this.ac.createBiquadFilter(), g = this.ac.createGain();
    f.type = 'highpass'; f.frequency.value = hp; g.gain.value = vol;
    s.buffer = b; s.connect(f); f.connect(g); g.connect(this.master); s.start();
  },
  sfx(name) {
    switch (name) {
      case 'swing': this.noise(0.12, 0.12, 2200); this.tone(520, 0.1, 'triangle', 0.05, -300); break;
      case 'hit': this.tone(180, 0.12, 'square', 0.12, -90); this.noise(0.08, 0.1, 600); break;
      case 'kill': this.tone(300, 0.08, 'square', 0.1); this.tone(200, 0.16, 'square', 0.1, -120, 0.07); break;
      case 'coin': this.tone(988, 0.07, 'square', 0.07); this.tone(1319, 0.14, 'square', 0.07, 0, 0.06); break;
      case 'pick': [660, 880, 1100].forEach((f, i) => this.tone(f, 0.1, 'triangle', 0.1, 0, i * 0.06)); break;
      case 'relic': [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.11, 0, i * 0.09)); break;
      case 'hurt': this.tone(240, 0.22, 'sawtooth', 0.1, -160); break;
      case 'bark': this.tone(520, 0.05, 'square', 0.07, -200); this.tone(480, 0.07, 'square', 0.07, -220, 0.09); break;
      case 'talk': this.tone(rand(500, 640), 0.03, 'square', 0.035); break;
      case 'door': this.tone(140, 0.3, 'triangle', 0.15, -40); break;
      case 'slam': this.tone(90, 0.4, 'sawtooth', 0.16, -50); this.noise(0.3, 0.18, 200); break;
      case 'heal': [523, 784, 1047].forEach((f, i) => this.tone(f, 0.18, 'sine', 0.12, 0, i * 0.08)); break;
      case 'ui': this.tone(700, 0.05, 'square', 0.06); break;
    }
  },
  // pequena música em loop (pentatônica), agendada à frente
  MEL: [72, 0, 76, 79, 0, 76, 74, 0, 72, 0, 69, 72, 74, 0, 0, 0, 76, 0, 79, 81, 0, 79, 76, 0, 74, 0, 72, 74, 72, 0, 0, 0],
  BASS: [48, 55, 52, 55, 45, 52, 48, 52],
  tick() {
    if (!this.ac || !this.musicOn) return;
    const spb = 0.27;
    while (this.nextNote < this.ac.currentTime + 0.4) {
      const t = this.nextNote, i = this.step % 32;
      if (!this.muted) {
        const m = this.MEL[i];
        if (m) this.note(m, t, 0.32, 'triangle', 0.045);
        if (i % 4 === 0) this.note(this.BASS[(i / 4) % 8], t, 0.9, 'sine', 0.06);
      }
      this.nextNote += spb; this.step++;
    }
  },
  note(midi, t, d, type, vol) {
    const o = this.ac.createOscillator(), g = this.ac.createGain();
    o.type = type; o.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0008, t + d);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + d + 0.05);
  }
};

// ---------------------------------------------------------------- pixel art
function bake(rows, pal) {
  const h = rows.length, w = Math.max(...rows.map(r => r.length));
  const make = white => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) {
      const col = pal[r[x]]; if (!col) continue;
      g.fillStyle = white ? '#ffffff' : col; g.fillRect(x, y, 1, 1);
    } });
    return c;
  };
  return { img: make(false), white: make(true), w, h };
}
const BASE = { O: '#1d1a24', E: '#2a2238', S: '#f0c08a', s: '#cf9461', K: '#3b2618', N: '#3a2626', M: '#d5dde6' };
const pal = o => Object.assign({}, BASE, o);

const HERO_PAL = pal({ W: '#f3f0ea', w: '#b9bccb', R: '#c8423b', r: '#8e2a2a', B: '#7a4a2a', b: '#55331d',
  P: '#33384e', T: '#45b2c9', t: '#256f86', G: '#c99a3a' });

const BODY_DOWN = [
  '...OOOOOO...', '..OWWWWWWO..', '.OWWWWWWWWO.', '.OWWwWWwWWO.', '.OWSSSSSSWO.', '.OwSESSESwO.',
  '..OSSssSSO..', '..ORRRRRRO..', '.OTBrRRrBTO.', '.OTBBBBBBTO.', '.OSBBGGBBSO.', '..OBBBBBBO..'];
const BODY_UP = [
  '...OOOOOO...', '..OWWWWWWO..', '.OWWWWWWWWO.', '.OWWWWWWWWOG', '.OWWWwWWWWOG', '.OwWWWWWWwOM',
  '..OwWWWWwOM.', '..ORRRRRROM.', '.OSTTTTTTSO.', '.OBTtOOtTBO.', '.OBTtOOtTBO.', '..OTTTTTTO..'];
const BODY_SIDE = [
  '..OOOOOO....', '.OWWWWWWO...', 'OWWWWWWWWO..', 'OWWWWWWWWWO.', '.OWWWWSSSO..', '.OWWWSSSESO.',
  '..OWSSSSsO..', '..ORRRRRO...', '.OTTBBBBO...', 'OTtTBBBSO...', 'OTtTBBBSO...', '.OTTBBBO....'];
const LEGS_V = [
  ['..OPPOOPPO..', '..OPPOOPPO..', '..OKKOOKKO..', '..OOO..OOO..'],
  ['..OPPOOPPO..', '..OKKOOPPO..', '..OOO.OPPO..', '......OKKO..'],
  ['..OPPOOPPO..', '..OPPOOKKO..', '..OPPO.OOO..', '..OKKO......']];
const LEGS_S = [
  ['...OPPPO....', '...OPPPO....', '...OKKKO....', '...OOOOO....'],
  ['..OPPOPPO...', '..OPO.OPO...', '.OKKO.OKKO..', '.OOO...OOO..']];

const HERO = {
  down: LEGS_V.map(l => bake(BODY_DOWN.concat(l), HERO_PAL)),
  up: LEGS_V.map(l => bake(BODY_UP.concat(l), HERO_PAL)),
  side: [0, 1, 0].map(i => bake(BODY_SIDE.concat(LEGS_S[i]), HERO_PAL))
};

const DOG_PAL = pal({ W: '#f7f5f0', w: '#d6d2c8', E: '#1d1a24', N: '#2b1d1d', R: '#d04a4a' });
const DOG_BODY = ['........OO..', '.......OwWOO', 'O.....OWWWEN', 'OWO.OWWRWWO.', '.OWOWWWWWWO.', '.OWWWWWWWO..'];
const DOG = [
  bake(DOG_BODY.concat(['..OWOOOOWO..', '..OO....OO..']), DOG_PAL),
  bake(DOG_BODY.concat(['.OWO...OWO..', '.OO.....OO..']), DOG_PAL),
  bake(DOG_BODY.concat(['...OWOOWO...', '...OO..OO...']), DOG_PAL)];

const MUSGO_ROWS = [
  '.....gg.....', '....gOgO....', '...OOOOOO...', '..OMMhMMMO..', '.OMMhMMMMMO.', '.OMMEMMEMMO.',
  'OMMMMMMMMMMO', 'OMmMMMMMMmMO', '.OMMmMMmMMO.', '..OOOOOOOO..'];
const MUSGO = bake(MUSGO_ROWS, pal({ M: '#5fae4a', m: '#3f8a37', h: '#a8e07a', g: '#9be36a', E: '#1d1a24' }));
const MUSGO_BOSS = bake(MUSGO_ROWS, pal({ M: '#3f7d3a', m: '#2a5a2a', h: '#78b85a', g: '#e86a8a', E: '#f2e14b' }));

function personRows(top, legs) {
  const body = BODY_DOWN.map(r => r.replace(/T/g, 'B'));
  if (top) for (let i = 0; i < top.length; i++) body[i] = top[i];
  return body.concat(legs || LEGS_V[0]);
}
const ROBE = ['..OBBBBBBO..', '..OBbBBbBO..', '.OBBBBBBBBO.', '.OOOOOOOOOO.'];
const NPC = {
  aurora: bake(personRows(['....OOOO....', '...OWWWWO...', '.OOWWWWWWOO.'], ROBE),
    pal({ W: '#e4e2ec', w: '#a9a6bb', R: '#efe2b8', r: '#c6ae6e', B: '#7b5aa6', b: '#5a3f80', G: '#e2b84a', S: '#e9b88a', s: '#c68e62' })),
  mel: bake(personRows(null, ROBE),
    pal({ W: '#f08bb0', w: '#c45d87', R: '#fbfbf4', r: '#d8d8cc', B: '#5fa65a', b: '#3f7a3c', G: '#f5d36b' })),
  tome: bake(personRows(['..OOOOOOOO..', '.OYYYYYYYYO.', 'OYYyYYYYyYYO', '.OWWWWWWWWO.']),
    pal({ Y: '#e9c46a', y: '#b88c34', W: '#6b4a2b', w: '#4a321d', R: '#e2d6b8', r: '#b9a988', B: '#4f7fbf', b: '#355c8f',
      G: '#c9a14a', P: '#4f7fbf', S: '#d9a066', s: '#b47a45' })),
  lina: bake(personRows(null),
    pal({ W: '#5a3a26', w: '#3b2618', R: '#e6dccb', r: '#b8ab95', B: '#e6dccb', b: '#b8ab95', G: '#9a6a3a', P: '#6b5a4a' })),
  rui: bake(personRows(null),
    pal({ W: '#23232e', w: '#121219', R: '#3b5f8f', r: '#2a466c', B: '#2f4f7a', b: '#1f3555', G: '#c9a14a', P: '#2a2a35', S: '#c98f5e', s: '#9e6a3f' }))
};

// ---------------------------------------------------------------- cenários
// Coordenadas em pixels da imagem original (≈736 × 1310).
const SCENES = {
  praca: {
    name: 'Praça das Telhas', img: 'assets/praca.jpg', amb: 'petals',
    walk: [[[290, 470], [470, 455], [490, 530], [540, 610], [575, 680], [555, 770], [520, 830], [470, 880], [440, 940],
      [470, 1060], [540, 1120], [600, 1180], [585, 1308], [220, 1308], [200, 1200], [210, 1120], [240, 1050], [230, 950],
      [245, 850], [240, 760], [245, 690], [200, 650], [140, 610], [140, 550], [230, 545], [280, 520]]],
    holes: [{ e: [400, 728, 95, 58] }, { e: [405, 1005, 58, 82] }, { e: [436, 872, 26, 22] }],
    exits: [
      { r: [220, 1280, 590, 1310], to: 'vila', at: [462, 250], label: 'Vila do Rio', arrow: 'down' },
      { r: [135, 545, 165, 615], to: 'horta', at: [250, 205], label: 'Horta', arrow: 'left' }],
    npcs: [{ id: 'aurora', x: 318, y: 835, name: 'Vó Aurora' }],
    items: [{ id: 'c_p1', k: 'moeda', x: 520, y: 640 }, { id: 'c_p2', k: 'moeda', x: 260, y: 1180 }],
    start: [380, 1150]
  },
  vila: {
    name: 'Vila do Rio', img: 'assets/vila.jpg', amb: 'butterflies',
    walk: [
      [[430, 188], [495, 188], [490, 260], [472, 340], [420, 340], [440, 260]],
      [[300, 330], [520, 330], [530, 420], [400, 445], [300, 450]],
      [[300, 440], [400, 440], [400, 610], [300, 610]],
      [[270, 600], [405, 595], [430, 680], [520, 700], [525, 785], [440, 790], [400, 805], [340, 820], [278, 760], [270, 680]],
      [[340, 800], [440, 780], [525, 800], [600, 880], [600, 950], [450, 955], [415, 1068], [345, 1068], [310, 950], [300, 880]],
      [[440, 940], [640, 955], [680, 1020], [480, 1040], [440, 1000]]],
    holes: [],
    exits: [
      { r: [420, 186, 505, 212], to: 'praca', at: [400, 1240], label: 'Praça', arrow: 'up' },
      { r: [340, 1042, 420, 1070], to: 'penhasco', at: [150, 900], label: 'Penhasco', arrow: 'down' }],
    npcs: [{ id: 'mel', x: 505, y: 880, name: 'Mel' }],
    items: [
      { id: 'flor1', k: 'flor', x: 340, y: 395 }, { id: 'flor2', k: 'flor', x: 462, y: 300 }, { id: 'flor3', k: 'flor', x: 305, y: 700 },
      { id: 'flor4', k: 'flor', x: 480, y: 745 }, { id: 'flor5', k: 'flor', x: 600, y: 1000 }, { id: 'c_v1', k: 'moeda', x: 350, y: 520 }],
    enemies: [{ x: 360, y: 940 }, { x: 560, y: 995 }],
    start: [462, 250]
  },
  horta: {
    name: 'Horta do Seu Tomé', img: 'assets/horta.jpg', amb: 'butterflies',
    walk: [[[40, 170], [330, 120], [345, 215], [215, 250], [205, 340], [240, 420], [300, 450], [440, 500], [560, 560],
      [640, 615], [736, 635], [736, 720], [640, 722], [560, 780], [460, 860], [360, 920], [280, 960], [300, 1060], [420, 1100],
      [440, 1160], [400, 1200], [360, 1310], [100, 1310], [60, 1150], [40, 1000], [30, 760], [140, 665], [150, 420], [60, 330]]],
    holes: [
      { p: [[195, 650], [230, 600], [260, 570], [300, 560], [420, 600], [520, 690], [510, 760], [390, 830], [290, 820], [200, 760]] },
      { e: [245, 872, 88, 36] }],
    exits: [
      { r: [140, 108, 345, 150], to: 'praca', at: [190, 580], label: 'Praça', arrow: 'up' },
      { r: [95, 1282, 365, 1312], to: 'torre', at: [80, 915], label: 'Torre', arrow: 'down' }],
    npcs: [{ id: 'tome', x: 610, y: 690, name: 'Seu Tomé' }],
    items: [{ id: 'c_h1', k: 'moeda', x: 90, y: 760 }, { id: 'c_h2', k: 'moeda', x: 330, y: 1240 }],
    foes: [{ id: 'hm1', x: 180, y: 520 }, { id: 'hm2', x: 470, y: 580 }, { id: 'hm3', x: 110, y: 900 },
      { id: 'hm4', x: 230, y: 1060 }, { id: 'hm5', x: 300, y: 1200 }],
    start: [250, 205]
  },
  torre: {
    name: 'Torre da Lanterna', img: 'assets/torre.jpg', amb: 'fireflies',
    walk: [[[440, 300], [600, 300], [650, 340], [640, 400], [560, 470], [600, 560], [560, 620], [600, 700], [560, 760],
      [580, 880], [560, 960], [540, 1000], [420, 1030], [300, 1000], [200, 965], [120, 960], [0, 945], [0, 875], [120, 875],
      [180, 895], [250, 860], [300, 780], [340, 700], [330, 620], [300, 580], [290, 500], [330, 450], [420, 420], [470, 360]]],
    holes: [],
    exits: [{ r: [0, 870, 28, 950], to: 'horta', at: [235, 1250], label: 'Horta', arrow: 'left' }],
    npcs: [], items: [],
    enemies: [{ x: 470, y: 520 }, { x: 470, y: 720 }],
    door: { x: 520, y: 312 }, chest: { x: 258, y: 448 },
    start: [80, 915]
  },
  penhasco: {
    name: 'Penhasco do Vento', img: 'assets/penhasco.jpg', amb: 'embers',
    walk: [[[60, 700], [260, 700], [300, 655], [420, 605], [440, 520], [430, 430], [470, 350], [520, 360], [560, 480],
      [660, 560], [680, 620], [640, 720], [600, 800], [520, 880], [440, 930], [320, 960], [230, 968], [60, 962], [20, 900], [20, 760]]],
    holes: [{ e: [395, 690, 55, 32] }, { e: [488, 648, 34, 30] }],
    exits: [{ r: [40, 945, 230, 975], to: 'vila', at: [380, 1010], label: 'Vila do Rio', arrow: 'down' }],
    npcs: [{ id: 'camp', x: 485, y: 655, name: 'Rui e Lina', hidden: true }],
    items: [
      { id: 'gra1', k: 'graveto', x: 180, y: 790 }, { id: 'gra2', k: 'graveto', x: 560, y: 525 },
      { id: 'gra3', k: 'graveto', x: 330, y: 800 }, { id: 'gra4', k: 'graveto', x: 600, y: 700 },
      { id: 'c_c1', k: 'moeda', x: 470, y: 900 }],
    enemies: [{ x: 250, y: 760 }, { x: 540, y: 800 }],
    fire: { x: 395, y: 680 },
    start: [150, 900]
  }
};

const IMGS = {};
function loadImages() {
  return Promise.all(Object.entries(SCENES).map(([id, s]) => new Promise(res => {
    const im = new Image(); im.onload = () => { IMGS[id] = im; res(); }; im.onerror = () => res(); im.src = s.img;
  })));
}

// máscara de chão andável (1/4 da resolução)
function buildMask(s, im) {
  const iw = im.naturalWidth, ih = im.naturalHeight, mw = Math.ceil(iw / 4), mh = Math.ceil(ih / 4);
  const c = document.createElement('canvas'); c.width = mw; c.height = mh;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, mw, mh);
  const poly = (p, col) => { g.fillStyle = col; g.beginPath(); p.forEach(([x, y], i) => i ? g.lineTo(x / 4, y / 4) : g.moveTo(x / 4, y / 4)); g.closePath(); g.fill(); };
  s.walk.forEach(p => poly(p, '#fff'));
  s.holes.forEach(h => {
    if (h.p) poly(h.p, '#000');
    else { g.fillStyle = '#000'; g.beginPath(); g.ellipse(h.e[0] / 4, h.e[1] / 4, h.e[2] / 4, h.e[3] / 4, 0, 0, Math.PI * 2); g.fill(); }
  });
  const d = g.getImageData(0, 0, mw, mh).data, m = new Uint8Array(mw * mh);
  for (let i = 0; i < m.length; i++) m[i] = d[i * 4] > 127 ? 1 : 0;
  s.iw = iw; s.ih = ih; s.mask = { w: mw, h: mh, m, canvas: c };
}
function walkable(x, y) {
  const mk = scene.mask; const mx = Math.floor(x / 4), my = Math.floor(y / 4);
  if (mx < 0 || my < 0 || mx >= mk.w || my >= mk.h) return false;
  return mk.m[my * mk.w + mx] === 1;
}
function nearestWalkable(x, y) {
  if (walkable(x, y)) return [x, y];
  for (let r = 8; r < 300; r += 8) for (let a = 0; a < 16; a++) {
    const nx = x + Math.cos(a / 16 * Math.PI * 2) * r, ny = y + Math.sin(a / 16 * Math.PI * 2) * r;
    if (walkable(nx, ny)) return [nx, ny];
  }
  return [x, y];
}
function moveBody(b, dx, dy) {
  const fx = b.x + dx, fy = b.y + dy;
  if (walkable(fx, fy)) { b.x = fx; b.y = fy; return true; }
  if (dx && walkable(fx, b.y)) { b.x = fx; return true; }
  if (dy && walkable(b.x, fy)) { b.y = fy; return true; }
  return false;
}

// ---------------------------------------------------------------- estado do jogo
function newSave() {
  return { scene: 'praca', stage: 0, relics: { petala: false, orvalho: false, brasa: false }, got: {}, kills: {},
    coins: 0, maxHp: 5, chest: false, bossDead: false, done: false };
}
let S = newSave();
const hasSave = () => { const s = load(SAVE_KEY); return !!(s && (s.stage > 0 || s.coins > 0)); };
function save() { store(SAVE_KEY, S); }
const relicCount = () => (S.relics.petala ? 1 : 0) + (S.relics.orvalho ? 1 : 0) + (S.relics.brasa ? 1 : 0);
const countGot = pre => Object.keys(S.got).filter(k => k.startsWith(pre)).length;

let mode = 'loading';           // loading | title | play | end
let scene = null, sceneId = '';
let cam = { x: 0, y: 0 }, view = { s: 1, ox: 0, oy: 0 };
const player = { x: 0, y: 0, dir: 'down', fx: 0, fy: 1, hp: 5, inv: 0, atk: 0, atkCd: 0, anim: 0, moving: false, kx: 0, ky: 0 };
const dog = { x: 0, y: 0, flip: false, anim: 0, cd: 0, moving: false, target: null, bark: 0 };
let enemies = [], items = [], npcs = [], particles = [], floaters = [];
let dialog = null, fade = null, banner = null, shake = 0, exitLock = true, interactTarget = null;
let time = 0, bossRef = null, flash = 0;

function enterScene(id, at) {
  sceneId = id; scene = SCENES[id]; S.scene = id;
  const [sx, sy] = at || scene.start;
  [player.x, player.y] = nearestWalkable(sx, sy);
  player.kx = player.ky = 0;
  [dog.x, dog.y] = nearestWalkable(player.x - 40, player.y + 10);
  npcs = scene.npcs.map(n => Object.assign({}, n));
  items = scene.items.filter(it => !S.got[it.id] && (it.k === 'moeda' || S.stage >= 1)).map(it => Object.assign({ t: rand(0, 6) }, it));
  enemies = [];
  (scene.foes || []).forEach(f => { if (!S.kills[f.id]) spawnMusgo(f.x, f.y, f.id); });
  if (S.stage >= 1 && !(id === 'torre' && S.bossDead)) (scene.enemies || []).forEach(f => spawnMusgo(f.x, f.y));
  bossRef = null;
  if (id === 'torre' && relicCount() === 3 && !S.bossDead) {
    enemies = enemies.filter(e => e.boss);
    bossRef = spawnMusgo(440, 760, null, true);
  }
  particles = []; floaters = [];
  exitLock = true;
  banner = { text: scene.name, t: 2.6 };
  snapCamera();
  save();
}
function spawnMusgo(x, y, id, boss) {
  const [px, py] = nearestWalkable(x, y);
  const e = { x: px, y: py, id: id || null, boss: !!boss, hp: boss ? 26 : 3, maxHp: boss ? 26 : 3, r: boss ? 50 : 22,
    vx: 0, vy: 0, kx: 0, ky: 0, t: rand(0, 3), wander: rand(0, 6.28), wt: 0, hurt: 0, speed: boss ? 55 : rand(42, 58),
    state: 'chase', st: boss ? 2.5 : 0, spawnT: 6, z: 0, tx: 0, ty: 0, born: boss ? 1.2 : 0 };
  enemies.push(e);
  return e;
}

// ---------------------------------------------------------------- diálogos e missões
const PORTRAIT = { 'Vó Aurora': 'aurora', 'Mel': 'mel', 'Seu Tomé': 'tome', 'Lina': 'lina', 'Rui': 'rui', 'Kai': 'kai' };
function say(lines, done) {
  dialog = { lines: lines.map(l => {
    const m = /^([^:]{2,14}):\s(.*)$/.exec(l);
    return m ? { who: m[1], text: m[2] } : { who: '', text: l };
  }), i: 0, shown: 0, done };
}
function giveRelic(key, name) {
  S.relics[key] = true; Audio.sfx('relic'); flash = 0.6;
  floaters.push({ x: player.x, y: player.y - 100, text: name + '!', t: 2, col: '#ffe38a' });
  save();
}
function interact(t) {
  if (t.kind === 'npc') talkTo(t.ref);
  else if (t.kind === 'chest') openChest();
  else if (t.kind === 'door') useDoor();
}
function talkTo(n) {
  const id = n.id;
  if (id === 'aurora') {
    player.hp = S.maxHp;
    if (S.stage === 0) {
      say(['Vó Aurora: Kai! Floco! Que bom que vocês chegaram.',
        'Vó Aurora: Ontem à noite a Lanterna da Torre se apagou... e os Musgos acordaram pelo vale.',
        'Vó Aurora: Para reacendê-la precisamos de 3 relíquias: a Pétala Solar, o Orvalho do Poço e a Brasa Eterna.',
        'Vó Aurora: A Mel, na Vila do Rio, o Seu Tomé, na Horta, e os viajantes Rui e Lina, lá no Penhasco, podem ajudar.',
        'Vó Aurora: A Vila fica descendo a rua. A Horta é pela trilha da esquerda. Vá com cuidado!',
        'Kai: Pode deixar, vó! Vamos, Floco!'], () => { S.stage = 1; save(); Audio.sfx('pick'); enterScene('praca', [player.x, player.y]); });
    } else if (relicCount() < 3) {
      const falta = [];
      if (!S.relics.petala) falta.push('a Pétala Solar (Mel, Vila do Rio)');
      if (!S.relics.orvalho) falta.push('o Orvalho do Poço (Seu Tomé, Horta)');
      if (!S.relics.brasa) falta.push('a Brasa Eterna (Rui e Lina, Penhasco)');
      say(['Vó Aurora: Deixe-me cuidar desses arranhões... pronto, novinho em folha!',
        'Vó Aurora: Ainda falta ' + falta.join(', e ') + '.']);
      Audio.sfx('heal');
    } else if (!S.bossDead) {
      say(['Vó Aurora: As três relíquias! Estão brilhando tanto...',
        'Vó Aurora: Leve-as à Torre da Lanterna: passe pela Horta e siga a trilha para baixo.',
        'Vó Aurora: Mas cuidado... algo grande dorme ao pé da torre.']);
      Audio.sfx('heal');
    } else say(['Vó Aurora: Você conseguiu, Kai. A Lanterna brilha de novo!']);
  } else if (S.stage === 0) {
    const who = id === 'camp' ? 'Lina' : n.name;
    say([who + ': Oi, Kai! A Vó Aurora estava te procurando lá na praça.']);
  } else if (id === 'mel') {
    const f = countGot('flor');
    if (S.relics.petala) say(['Mel: Cuidado com os Musgos, viu? O Floco que o diga!']);
    else if (f < 5) say(['Mel: Oi, Kai! As flores-lume perderam o brilho e se espalharam pela vila.',
      'Mel: Junte 5 delas e eu teço a Pétala Solar pra você! (' + f + '/5)']);
    else say(['Mel: Que lindas! Olha só, voltaram a brilhar!', 'Mel: Aqui está: a Pétala Solar. Leve com carinho!'],
      () => giveRelic('petala', 'Pétala Solar'));
  } else if (id === 'tome') {
    const k = (SCENES.horta.foes || []).filter(f => S.kills[f.id]).length;
    if (S.relics.orvalho) say(['Seu Tomé: Minhas couves agradecem, rapaz!']);
    else if (k < 5) say(['Seu Tomé: Ei, rapaz! Esses Musgos estão comendo minhas couves!',
      'Seu Tomé: Espante os 5 que estão na horta e eu te dou o Orvalho do Poço. (' + k + '/5)']);
    else say(['Seu Tomé: Ufa! Minha horta está salva.', 'Seu Tomé: Tome: o Orvalho do Poço, colhido em noite de lua cheia.'],
      () => giveRelic('orvalho', 'Orvalho do Poço'));
  } else if (id === 'camp') {
    const g = countGot('gra');
    if (S.relics.brasa) say(['Rui: Que fogo bonito, hein?', 'Lina: Boa sorte na torre, Kai!']);
    else if (g < 4) say(['Lina: Olá, viajante! Que vista, né?', 'Rui: Nossa fogueira está quase apagando... e é nela que mora a Brasa Eterna.',
      'Lina: Se você achar 4 gravetos aqui no penhasco, a gente divide a brasa com você! (' + g + '/4)']);
    else say(['Rui: Agora sim! Olha como o fogo cresceu!', 'Lina: Leve a Brasa Eterna. Ela nunca se apaga.'],
      () => giveRelic('brasa', 'Brasa Eterna'));
  }
}
function openChest() {
  if (S.chest) { say(['O baú está vazio.']); return; }
  S.chest = true; S.maxHp += 1; player.hp = S.maxHp; S.coins += 15;
  Audio.sfx('relic');
  say(['Você abriu o baú antigo!', 'Coração extra! (+1 vida máxima) e 15 moedas.']);
  save();
}
function useDoor() {
  if (relicCount() < 3) { Audio.sfx('door'); say(['A porta da torre está selada.', 'Três encaixes vazios brilham fraquinho: uma pétala, uma gota e uma chama.']); return; }
  if (!S.bossDead) { say(['Derrote o Musgo Ancião antes!']); return; }
  say(['Kai encaixa a Pétala Solar, o Orvalho do Poço e a Brasa Eterna...', 'A porta se abre. Floco sobe as escadas na frente, abanando o rabo.',
    'Lá no alto... a LANTERNA SE ACENDE!'], () => { S.done = true; save(); mode = 'end'; endT = 0; Audio.sfx('relic'); });
}
function objective() {
  if (S.stage === 0) return 'Fale com a Vó Aurora na praça';
  const n = relicCount();
  if (n < 3) {
    if (sceneId === 'vila' && !S.relics.petala) return 'Flores-lume: ' + countGot('flor') + '/5 — leve para a Mel';
    if (sceneId === 'horta' && !S.relics.orvalho) return 'Musgos na horta: ' + (SCENES.horta.foes.filter(f => S.kills[f.id]).length) + '/5';
    if (sceneId === 'penhasco' && !S.relics.brasa) return 'Gravetos: ' + countGot('gra') + '/4 — leve para Rui e Lina';
    return 'Relíquias: ' + n + '/3';
  }
  if (!S.bossDead) return sceneId === 'torre' ? 'Derrote o Musgo Ancião!' : 'Leve as relíquias à Torre (Praça → Horta → Torre)';
  return 'Abra a porta da torre';
}

// ---------------------------------------------------------------- entrada
const input = { jx: 0, jy: 0, joy: null, actionDown: false, keys: {} };
const btn = { action: { x: 0, y: 0, r: 46 }, mute: { x: 0, y: 0, r: 20 } };
function layoutButtons() {
  btn.action.x = W - 78 - SAFE.r; btn.action.y = H - 92 - SAFE.b;
  btn.mute.x = W - 30 - SAFE.r; btn.mute.y = SAFE.t + 84;
}
let titleButtons = [];
const inCircle = (x, y, c, pad = 0) => Math.hypot(x - c.x, y - c.y) <= c.r + pad;

cv.addEventListener('pointerdown', e => {
  e.preventDefault();
  Audio.init();
  const x = e.clientX, y = e.clientY;
  if (mode === 'title' || mode === 'end') {
    for (const b of titleButtons) if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { Audio.sfx('ui'); b.fn(); return; }
    return;
  }
  if (mode !== 'play') return;
  if (inCircle(x, y, btn.mute, 8)) { Audio.setMuted(!Audio.muted); return; }
  if (dialog) { advanceDialog(); return; }
  if (inCircle(x, y, btn.action, 16)) { pressAction(); return; }
  if (!input.joy && x < W * 0.7) input.joy = { id: e.pointerId, ox: x, oy: y, x, y };
});
cv.addEventListener('pointermove', e => {
  if (input.joy && e.pointerId === input.joy.id) { input.joy.x = e.clientX; input.joy.y = e.clientY; }
});
const endPointer = e => { if (input.joy && e.pointerId === input.joy.id) input.joy = null; };
cv.addEventListener('pointerup', endPointer);
cv.addEventListener('pointercancel', endPointer);
window.addEventListener('keydown', e => {
  input.keys[e.key.toLowerCase()] = true;
  Audio.init();
  const k = e.key.toLowerCase();
  if (mode === 'title' && (k === 'enter' || k === ' ')) { titleButtons[0] && titleButtons[0].fn(); return; }
  if (mode === 'end' && (k === 'enter')) { titleButtons[0] && titleButtons[0].fn(); return; }
  if (mode !== 'play') return;
  if (k === ' ' || k === 'j' || k === 'e' || k === 'enter' || k === 'z') {
    e.preventDefault();
    if (dialog) advanceDialog(); else pressAction();
  }
  if (k === 'm') Audio.setMuted(!Audio.muted);
  if (k === 'g') debugMask = !debugMask;
});
window.addEventListener('keyup', e => { input.keys[e.key.toLowerCase()] = false; });
let debugMask = false;

function advanceDialog() {
  const l = dialog.lines[dialog.i];
  if (dialog.shown < l.text.length) { dialog.shown = l.text.length; return; }
  dialog.i++; dialog.shown = 0; Audio.sfx('ui');
  if (dialog.i >= dialog.lines.length) { const d = dialog.done; dialog = null; if (d) d(); }
}
function pressAction() {
  if (fade) return;
  if (interactTarget) interact(interactTarget); else attack();
}
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

// ---------------------------------------------------------------- combate
function attack() {
  if (player.atkCd > 0) return;
  player.atk = 0.24; player.atkCd = 0.36;
  Audio.sfx('swing');
  const cx = player.x, cy = player.y - 40;
  const fa = Math.atan2(player.fy, player.fx);
  for (const e of enemies) {
    if (e.born > 0) continue;
    const dx = e.x - cx, dy = (e.y - (e.boss ? 40 : 14)) - cy, d = Math.hypot(dx, dy);
    let da = Math.abs(Math.atan2(dy, dx) - fa); if (da > Math.PI) da = 2 * Math.PI - da;
    if (d < 78 + e.r * 0.6 && (da < 1.35 || d < 30 + e.r * 0.5)) hurtEnemy(e, 1, dx / (d || 1), dy / (d || 1));
  }
}
function hurtEnemy(e, dmg, nx, ny) {
  if (e.hurt > 0.12) return;
  e.hp -= dmg; e.hurt = 0.25;
  const kb = e.boss ? 90 : 320; e.kx = nx * kb; e.ky = ny * kb;
  Audio.sfx('hit'); shake = Math.max(shake, e.boss ? 5 : 3);
  burst(e.x, e.y - 18, '#8fe06a', 7);
  if (e.hp <= 0) killEnemy(e);
}
function killEnemy(e) {
  e.dead = true; Audio.sfx('kill');
  burst(e.x, e.y - 16, '#7ccf55', e.boss ? 40 : 14, e.boss ? 260 : 150);
  burst(e.x, e.y - 16, '#e9f7c8', e.boss ? 20 : 6, 120);
  if (e.id) { S.kills[e.id] = true; }
  const n = e.boss ? 20 : 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) items.push({ id: null, k: 'moeda', x: e.x + rand(-30, 30), y: e.y + rand(-18, 18), t: 0, drop: 0.35 });
  if (!e.boss && Math.random() < 0.22) items.push({ id: null, k: 'coracao', x: e.x, y: e.y, t: 0, drop: 0.35 });
  if (e.boss) {
    S.bossDead = true; bossRef = null; flash = 1; shake = 14;
    enemies.forEach(o => { if (!o.boss && !o.dead) { o.dead = true; burst(o.x, o.y - 12, '#7ccf55', 10); } });
    setTimeout(() => say(['O Musgo Ancião se desfaz em folhas e flores...', 'Kai: Conseguimos, Floco! Agora, a porta!']), 700);
  }
  if (sceneId === 'horta' && e.id && SCENES.horta.foes.every(f => S.kills[f.id])) {
    floaters.push({ x: player.x, y: player.y - 110, text: 'Horta livre! Fale com Seu Tomé', t: 2.6, col: '#ffffff' });
  }
  save();
}
function hurtPlayer(src, dmg) {
  if (player.inv > 0 || mode !== 'play') return;
  player.hp -= dmg; player.inv = 1.1; Audio.sfx('hurt'); shake = 6;
  const dx = player.x - src.x, dy = player.y - src.y, d = Math.hypot(dx, dy) || 1;
  player.kx = dx / d * 380; player.ky = dy / d * 380;
  burst(player.x, player.y - 30, '#ff6b6b', 8);
  if (player.hp <= 0) {
    player.hp = 0;
    fade = { t: 0, dur: 0.9, mid: () => {
      player.hp = S.maxHp; player.inv = 2;
      enterScene('praca', [330, 900]);
      setTimeout(() => say(['Vó Aurora: Kai! Que susto... Floco te trouxe de volta pra praça.', 'Vó Aurora: Descanse um pouco e tente de novo, viu?']), 400);
    } };
  }
}
function burst(x, y, col, n, sp = 140) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), v = rand(sp * 0.3, sp);
    particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, g: 260, t: rand(0.35, 0.7), max: 0.7, col, s: rand(3, 6) });
  }
}

// ---------------------------------------------------------------- atualização
function update(dt) {
  time += dt;
  Audio.tick();
  if (banner) { banner.t -= dt; if (banner.t <= 0) banner = null; }
  if (flash > 0) flash -= dt;
  shake = Math.max(0, shake - dt * 30);
  if (fade) {
    fade.t += dt;
    if (fade.mid && fade.t >= fade.dur / 2) { const m = fade.mid; fade.mid = null; m(); }
    if (fade.t >= fade.dur) fade = null;
  }
  if (mode !== 'play') return;

  if (dialog) {
    const l = dialog.lines[dialog.i];
    if (l && dialog.shown < l.text.length) {
      const before = Math.floor(dialog.shown); dialog.shown += dt * 55;
      if (Math.floor(dialog.shown) !== before && Math.floor(dialog.shown) % 3 === 0) Audio.sfx('talk');
    }
  }

  // jogador
  const busy = !!dialog || !!fade;
  const [mx, my] = busy ? [0, 0] : readMove();
  const spd = 190;
  player.moving = Math.hypot(mx, my) > 0.1;
  if (player.moving) {
    player.fx = mx; player.fy = my;
    const L = Math.hypot(mx, my); player.fx /= L; player.fy /= L;
    player.dir = Math.abs(mx) > Math.abs(my) * 1.1 ? (mx < 0 ? 'left' : 'right') : (my < 0 ? 'up' : 'down');
    moveBody(player, mx * spd * dt, my * spd * dt);
    player.anim += dt * 9;
  } else player.anim = 0;
  if (Math.abs(player.kx) + Math.abs(player.ky) > 5) {
    moveBody(player, player.kx * dt, player.ky * dt);
    player.kx *= Math.pow(0.0015, dt); player.ky *= Math.pow(0.0015, dt);
  }
  player.inv = Math.max(0, player.inv - dt);
  player.atk = Math.max(0, player.atk - dt);
  player.atkCd = Math.max(0, player.atkCd - dt);

  updateDog(dt);
  for (const e of enemies) if (!e.dead) updateEnemy(e, dt, busy);
  enemies = enemies.filter(e => !e.dead);

  // itens
  for (const it of items) {
    it.t += dt;
    if (it.drop > 0) { it.drop -= dt; continue; }
    const d = Math.hypot(it.x - player.x, it.y - (player.y - 10));
    const near = it.k === 'moeda' ? 46 : 42;
    if (it.k === 'moeda' && d < 110 && !it.id) { it.x += (player.x - it.x) * dt * 6; it.y += (player.y - 10 - it.y) * dt * 6; }
    if (d < near) collect(it);
  }
  items = items.filter(it => !it.taken);

  // saídas
  let inExit = null;
  for (const ex of scene.exits) if (player.x >= ex.r[0] && player.x <= ex.r[2] && player.y >= ex.r[1] && player.y <= ex.r[3]) inExit = ex;
  if (!inExit) exitLock = false;
  else if (!exitLock && !fade && !busy) {
    exitLock = true;
    const ex = inExit;
    fade = { t: 0, dur: 0.7, mid: () => enterScene(ex.to, ex.at) };
  }

  // alvo de interação
  interactTarget = null;
  if (!busy) {
    let best = 1e9;
    for (const n of npcs) { const d = Math.hypot(n.x - player.x, n.y - player.y); if (d < (n.hidden ? 110 : 85) && d < best) { best = d; interactTarget = { kind: 'npc', ref: n, x: n.x, y: n.y - (n.hidden ? 70 : 112) }; } }
    if (scene.chest) { const c = scene.chest, d = Math.hypot(c.x - player.x, c.y - player.y); if (d < 95 && d < best) { best = d; interactTarget = { kind: 'chest', x: c.x, y: c.y - 60 }; } }
    if (scene.door) { const c = scene.door, d = Math.hypot(c.x - player.x, c.y - player.y); if (d < 90 && d < best) { best = d; interactTarget = { kind: 'door', x: c.x, y: c.y - 120 }; } }
  }

  // partículas
  for (const p of particles) { p.t -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.g || 0) * dt; p.vx *= Math.pow(0.4, dt); }
  particles = particles.filter(p => p.t > 0);
  for (const f of floaters) { f.t -= dt; f.y -= 28 * dt; }
  floaters = floaters.filter(f => f.t > 0);
  ambient(dt);
  updateCamera(dt);
}
function collect(it) {
  it.taken = true;
  if (it.id) S.got[it.id] = true;
  if (it.k === 'moeda') { S.coins += 1; Audio.sfx('coin'); burst(it.x, it.y, '#ffd84a', 5, 90); }
  else if (it.k === 'coracao') {
    player.hp = Math.min(S.maxHp, player.hp + 1); Audio.sfx('heal');
    floaters.push({ x: it.x, y: it.y - 30, text: '+1 ♥', t: 1.2, col: '#ff8a8a' });
  } else if (it.k === 'flor') {
    Audio.sfx('pick'); burst(it.x, it.y, '#ffb3d9', 12, 120);
    const n = countGot('flor');
    floaters.push({ x: it.x, y: it.y - 40, text: 'Flor-lume ' + n + '/5', t: 1.6, col: '#ffd6ec' });
  } else if (it.k === 'graveto') {
    Audio.sfx('pick'); burst(it.x, it.y, '#d9a46a', 10, 110);
    floaters.push({ x: it.x, y: it.y - 40, text: 'Graveto ' + countGot('gra') + '/4', t: 1.6, col: '#ffe0b0' });
  }
  save();
}
function updateDog(dt) {
  dog.cd = Math.max(0, dog.cd - dt); dog.bark = Math.max(0, dog.bark - dt);
  let tx = player.x - player.fx * 46 - 26, ty = player.y - player.fy * 30 + 8;
  let spd = 210;
  // procura um Musgo para morder
  if (!dog.target || dog.target.dead) dog.target = null;
  if (!dog.target && dog.cd <= 0) {
    let best = 170;
    for (const e of enemies) { if (e.born > 0) continue; const d = dist(e, dog); if (d < best && dist(e, player) < 260) { best = d; dog.target = e; } }
  }
  if (dog.target) {
    tx = dog.target.x + (dog.x < dog.target.x ? -18 : 18); ty = dog.target.y; spd = 280;
    if (Math.hypot(dog.target.x - dog.x, dog.target.y - dog.y) < dog.target.r + 22) {
      const e = dog.target;
      hurtEnemy(e, 1, Math.sign(e.x - dog.x) || 1, 0);
      Audio.sfx('bark'); dog.bark = 0.5; dog.cd = 1.6; dog.target = null;
    }
    if (dist(dog, player) > 300) dog.target = null;
  }
  const dx = tx - dog.x, dy = ty - dog.y, d = Math.hypot(dx, dy);
  dog.moving = d > 14;
  if (dog.moving) {
    const v = Math.min(spd * (d > 120 ? 1.4 : 1), d * 6) * dt;
    if (!moveBody(dog, dx / d * v, dy / d * v) && d > 140) { /* preso */ }
    if (Math.abs(dx) > 3) dog.flip = dx < 0;
    dog.anim += dt * 12;
  }
  if (dist(dog, player) > 300) { [dog.x, dog.y] = nearestWalkable(player.x - 40, player.y + 8); burst(dog.x, dog.y - 10, '#ffffff', 6, 80); }
}
function updateEnemy(e, dt, busy) {
  e.t += dt; e.hurt = Math.max(0, e.hurt - dt);
  if (e.born > 0) { e.born -= dt; return; }
  if (Math.abs(e.kx) + Math.abs(e.ky) > 4) { moveBody(e, e.kx * dt, e.ky * dt); e.kx *= Math.pow(0.002, dt); e.ky *= Math.pow(0.002, dt); }
  if (busy) return;
  const dx = player.x - e.x, dy = player.y - e.y, d = Math.hypot(dx, dy);
  if (e.boss) { updateBoss(e, dt, dx, dy, d); return; }
  if (d < 240) {
    const sp = e.speed * (e.hurt > 0 ? 0.2 : 1);
    moveBody(e, dx / d * sp * dt, dy / d * sp * dt);
  } else {
    e.wt -= dt; if (e.wt <= 0) { e.wander = rand(0, 6.28); e.wt = rand(1.2, 2.8); }
    if (!moveBody(e, Math.cos(e.wander) * 26 * dt, Math.sin(e.wander) * 26 * dt)) e.wt = 0;
  }
  if (d < e.r + 16) hurtPlayer(e, 1);
}
function updateBoss(e, dt, dx, dy, d) {
  e.st -= dt; e.spawnT -= dt;
  const rage = e.hp < e.maxHp / 2;
  if (e.state === 'chase') {
    const sp = e.speed * (rage ? 1.35 : 1);
    if (d > 10) moveBody(e, dx / d * sp * dt, dy / d * sp * dt);
    if (d < e.r + 12) hurtPlayer(e, 1);
    if (e.st <= 0) { e.state = 'tele'; e.st = rage ? 0.7 : 0.95; [e.tx, e.ty] = nearestWalkable(player.x, player.y); }
    if (e.spawnT <= 0) {
      e.spawnT = rage ? 5 : 7.5;
      if (enemies.filter(o => !o.boss && !o.dead).length < 4) for (let i = 0; i < 2; i++) {
        const m = spawnMusgo(e.x + rand(-80, 80), e.y + rand(-30, 40)); m.born = 0.5; m.speed *= 0.9;
        burst(m.x, m.y - 10, '#9be36a', 8, 120);
      }
    }
  } else if (e.state === 'tele') {
    if (e.st <= 0) { e.state = 'jump'; e.st = 0.55; e.sx = e.x; e.sy = e.y; Audio.sfx('swing'); }
  } else if (e.state === 'jump') {
    const k = 1 - e.st / 0.55;
    e.x = e.sx + (e.tx - e.sx) * k; e.y = e.sy + (e.ty - e.sy) * k; e.z = Math.sin(k * Math.PI) * 140;
    if (e.st <= 0) {
      e.z = 0; e.x = e.tx; e.y = e.ty; e.state = 'chase'; e.st = rage ? 2.6 : 3.6;
      Audio.sfx('slam'); shake = 12;
      burst(e.x, e.y, '#c9b38a', 18, 220);
      if (Math.hypot(player.x - e.x, player.y - e.y) < 95) hurtPlayer(e, 1);
    }
  }
}
function ambient(dt) {
  const a = scene.amb, ih = scene.ih, iw = scene.iw;
  const vw = W / view.s, vh = H / view.s;
  if (a === 'petals' && Math.random() < dt * 3) particles.push({ x: cam.x + rand(0, vw), y: cam.y - 10, vx: rand(10, 40), vy: rand(30, 60), g: 0, t: 7, max: 7, col: Math.random() < 0.5 ? '#ffb7d0' : '#fff2c9', s: 4, sway: rand(0, 6), amb: 1 });
  if (a === 'butterflies' && particles.filter(p => p.bf).length < 5 && Math.random() < dt) particles.push({ x: rand(100, iw - 100), y: rand(200, ih - 200), vx: 0, vy: 0, g: 0, t: 12, max: 12, col: ['#ffe066', '#ffffff', '#ff9ec7', '#9ad1ff'][Math.floor(rand(0, 4))], s: 5, bf: 1, ph: rand(0, 6) });
  if (a === 'fireflies' && particles.filter(p => p.ff).length < 22 && Math.random() < dt * 6) particles.push({ x: rand(0, iw), y: rand(0, ih), vx: rand(-12, 12), vy: rand(-12, 12), g: 0, t: rand(4, 8), max: 8, col: '#f5ff9a', s: 3, ff: 1, ph: rand(0, 6) });
  if (a === 'embers' && scene.fire) {
    const fire = scene.fire, big = S.relics.brasa || countGot('gra') >= 4;
    if (Math.random() < dt * (big ? 16 : 6)) particles.push({ x: fire.x + rand(-14, 14), y: fire.y - 10, vx: rand(-15, 15), vy: rand(-90, -40), g: -10, t: rand(0.8, 1.8), max: 1.8, col: Math.random() < 0.5 ? '#ffb347' : '#ffe27a', s: 3 });
  }
  for (const p of particles) {
    if (p.amb) { p.sway += dt * 2; p.vx = 25 + Math.sin(p.sway) * 30; }
    if (p.bf) { p.ph += dt; p.vx = Math.cos(p.ph * 0.7) * 50; p.vy = Math.sin(p.ph * 1.1) * 40; }
    if (p.ff) { p.ph += dt * 2; p.vx += Math.sin(p.ph) * 4; }
  }
}

// ---------------------------------------------------------------- câmera
function computeView() {
  const iw = scene.iw, ih = scene.ih;
  const portrait = W / H <= 0.8;
  view.s = portrait ? Math.max(W / iw, H / ih) : H / ih;
  view.vw = W / view.s; view.vh = H / view.s;
}
function camTarget() {
  const iw = scene.iw, ih = scene.ih;
  const tx = view.vw >= iw ? (iw - view.vw) / 2 : clamp(player.x - view.vw / 2, 0, iw - view.vw);
  const ty = view.vh >= ih ? (ih - view.vh) / 2 : clamp(player.y - view.vh * 0.55, 0, ih - view.vh);
  return [tx, ty];
}
function snapCamera() { computeView(); [cam.x, cam.y] = camTarget(); }
function updateCamera(dt) {
  computeView();
  const [tx, ty] = camTarget(); const k = 1 - Math.pow(0.002, dt);
  cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k;
}

// ---------------------------------------------------------------- desenho
function spr(sp, x, y, scale, flip, white, sx = 1, sy = 1) {
  const w = sp.w * scale * sx, h = sp.h * scale * sy;
  ctx.save(); ctx.translate(Math.round(x), Math.round(y));
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(white ? sp.white : sp.img, -w / 2, -h, w, h);
  ctx.restore();
}
function shadow(x, y, rx, ry, a = 0.32) {
  ctx.fillStyle = `rgba(10,20,10,${a})`; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
}
function heroSprite() {
  const f = player.moving ? [1, 0, 2, 0][Math.floor(player.anim) % 4] : 0;
  if (player.dir === 'down') return [HERO.down[f], false];
  if (player.dir === 'up') return [HERO.up[f], false];
  return [HERO.side[player.moving ? [1, 0][Math.floor(player.anim) % 2] : 0], player.dir === 'left'];
}
function drawWorld() {
  const im = IMGS[sceneId];
  const sx = (Math.random() - 0.5) * shake, sy = (Math.random() - 0.5) * shake;
  ctx.setTransform(DPR * view.s, 0, 0, DPR * view.s, DPR * (-cam.x * view.s + sx), DPR * (-cam.y * view.s + sy));
  ctx.imageSmoothingEnabled = true;
  if (im) ctx.drawImage(im, 0, 0);
  if (debugMask) { ctx.globalAlpha = 0.35; ctx.drawImage(scene.mask.canvas, 0, 0, scene.iw, scene.ih); ctx.globalAlpha = 1; }
  ctx.imageSmoothingEnabled = false;

  // brilho da fogueira
  if (scene.fire) {
    const f = scene.fire, big = S.relics.brasa || countGot('gra') >= 4;
    const r = (big ? 190 : 120) + Math.sin(time * 9) * 8 + Math.sin(time * 23) * 4;
    const g = ctx.createRadialGradient(f.x, f.y, 5, f.x, f.y, r);
    g.addColorStop(0, 'rgba(255,190,90,0.45)'); g.addColorStop(1, 'rgba(255,150,60,0)');
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(f.x - r, f.y - r, r * 2, r * 2); ctx.globalCompositeOperation = 'source-over';
  }
  // marcadores de saída
  for (const ex of scene.exits) {
    const cx = (ex.r[0] + ex.r[2]) / 2, cy = (ex.r[1] + ex.r[3]) / 2, b = Math.sin(time * 4) * 5;
    const ang = { up: -Math.PI / 2, down: Math.PI / 2, left: Math.PI, right: 0 }[ex.arrow];
    const ax = cx - Math.cos(ang) * 28 + Math.cos(ang) * b, ay = cy - Math.sin(ang) * 28 + Math.sin(ang) * b;
    ctx.save(); ctx.translate(ax, ay); ctx.rotate(ang);
    ctx.fillStyle = 'rgba(255,248,220,0.9)'; ctx.strokeStyle = 'rgba(40,30,20,0.8)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -12); ctx.lineTo(-8, 12); ctx.closePath(); ctx.stroke(); ctx.fill();
    ctx.restore();
    label(ex.label, ax - Math.cos(ang) * 26, ay - Math.sin(ang) * 26 - (ex.arrow === 'left' ? 22 : 0), 15);
  }
  // baú e porta
  if (scene.chest && !S.chest) sparkle(scene.chest.x, scene.chest.y - 40, '#fff1a8');
  if (scene.door && relicCount() === 3 && S.bossDead) {
    const g = ctx.createRadialGradient(scene.door.x, scene.door.y - 90, 10, scene.door.x, scene.door.y - 90, 140);
    g.addColorStop(0, `rgba(255,230,140,${0.35 + Math.sin(time * 3) * 0.1})`); g.addColorStop(1, 'rgba(255,230,140,0)');
    ctx.fillStyle = g; ctx.fillRect(scene.door.x - 140, scene.door.y - 230, 280, 280);
  }

  // entidades ordenadas por y
  const list = [];
  for (const it of items) list.push({ y: it.y, f: () => drawItem(it) });
  for (const n of npcs) if (!n.hidden) list.push({ y: n.y, f: () => drawNpc(n) });
  for (const e of enemies) list.push({ y: e.y, f: () => drawEnemy(e) });
  list.push({ y: dog.y, f: drawDog });
  list.push({ y: player.y, f: drawPlayer });
  list.sort((a, b) => a.y - b.y).forEach(o => o.f());

  // marcadores "!" de NPC
  for (const n of npcs) {
    const q = npcHasNews(n.id);
    if (q) bubble(n.x, n.y - (n.hidden ? 80 : 118) + Math.sin(time * 4) * 4, q);
  }
  if (bossRef && bossRef.state === 'tele') {
    const a = 0.35 + Math.sin(time * 30) * 0.15;
    ctx.strokeStyle = `rgba(255,70,60,${a + 0.3})`; ctx.fillStyle = `rgba(255,70,60,${a * 0.5})`; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.ellipse(bossRef.tx, bossRef.ty, 95, 50, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  // partículas
  for (const p of particles) {
    const a = Math.min(1, p.t / (p.max * 0.4));
    ctx.globalAlpha = p.ff ? (0.5 + 0.5 * Math.sin(p.ph * 3)) * a : a;
    if (p.ff) { ctx.fillStyle = 'rgba(245,255,154,0.25)'; ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, 7); ctx.fill(); }
    ctx.fillStyle = p.col;
    if (p.bf) { const w = Math.abs(Math.sin(time * 14 + p.ph)) * 6 + 1; ctx.fillRect(p.x - w, p.y - 3, w, 6); ctx.fillRect(p.x, p.y - 3, w, 6); ctx.fillStyle = '#3a2a1a'; ctx.fillRect(p.x - 1, p.y - 3, 2, 7); }
    else ctx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s);
  }
  ctx.globalAlpha = 1;
  for (const f of floaters) label(f.text, f.x, f.y, 20, f.col, Math.min(1, f.t * 2));
  if (interactTarget && !dialog) {
    const t = interactTarget; const b = Math.sin(time * 6) * 3;
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#2a2238'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(t.x - 9, t.y - 14 + b); ctx.lineTo(t.x + 9, t.y - 14 + b); ctx.lineTo(t.x, t.y + b); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
}
function npcHasNews(id) {
  if (id === 'aurora') return S.stage === 0 ? '!' : (relicCount() === 3 && !S.bossDead ? '…' : null);
  if (S.stage === 0) return null;
  if (id === 'mel' && !S.relics.petala) return countGot('flor') >= 5 ? '★' : '?';
  if (id === 'tome' && !S.relics.orvalho) return SCENES.horta.foes.every(f => S.kills[f.id]) ? '★' : '?';
  if (id === 'camp' && !S.relics.brasa) return countGot('gra') >= 4 ? '★' : '?';
  return null;
}
function bubble(x, y, ch) {
  ctx.fillStyle = '#fffaf0'; ctx.strokeStyle = '#2a2238'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(x - 15, y - 34, 30, 30, 8); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 5, y - 5); ctx.lineTo(x, y + 4); ctx.lineTo(x + 5, y - 5); ctx.fill();
  ctx.fillStyle = ch === '★' ? '#e0a020' : '#c8423b'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(ch, x, y - 18);
}
function label(text, x, y, size, col = '#fffaf0', alpha = 1) {
  ctx.globalAlpha = alpha; ctx.font = `700 ${size}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(30,22,30,0.85)'; ctx.lineJoin = 'round';
  ctx.strokeText(text, x, y); ctx.fillStyle = col; ctx.fillText(text, x, y); ctx.globalAlpha = 1;
}
function sparkle(x, y, col) {
  const t = time * 3 + x;
  for (let i = 0; i < 3; i++) {
    const a = t + i * 2.1, r = 22 + Math.sin(t * 1.3 + i) * 6, s = 2 + Math.abs(Math.sin(t * 2 + i)) * 3;
    ctx.fillStyle = col; ctx.fillRect(x + Math.cos(a) * r - s / 2, y + Math.sin(a) * r * 0.6 - s / 2, s, s);
  }
}
function drawPlayer() {
  const [sp, flip] = heroSprite();
  shadow(player.x, player.y, 26, 9);
  if (player.inv > 0 && Math.floor(player.inv * 14) % 2 === 0) return;
  const bob = player.moving ? Math.abs(Math.sin(player.anim * Math.PI / 2)) * -2 : Math.sin(time * 2) * 0.6;
  // espada nas costas quando de frente / de lado
  spr(sp, player.x, player.y + bob, 6, flip, false);
  if (player.atk > 0) {
    const k = 1 - player.atk / 0.24, fa = Math.atan2(player.fy, player.fx);
    const cx = player.x, cy = player.y - 44, R = 70;
    const a0 = fa - 1.4 + k * 2.4;
    ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const a = a0 - i * 0.18; if (a < fa - 1.4) break;
      ctx.strokeStyle = `rgba(255,255,255,${0.9 - i * 0.15})`; ctx.lineWidth = 12 - i * 1.6;
      ctx.beginPath(); ctx.arc(cx, cy, R, a - 0.16, a); ctx.stroke();
    }
    // lâmina
    ctx.strokeStyle = '#e8eef5'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a0) * 14, cy + Math.sin(a0) * 14); ctx.lineTo(cx + Math.cos(a0) * (R + 6), cy + Math.sin(a0) * (R + 6)); ctx.stroke();
    ctx.strokeStyle = '#c99a3a'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a0) * 6, cy + Math.sin(a0) * 6); ctx.lineTo(cx + Math.cos(a0) * 16, cy + Math.sin(a0) * 16); ctx.stroke();
  }
}
function drawDog() {
  shadow(dog.x, dog.y, 20, 6);
  const f = dog.moving ? 1 + (Math.floor(dog.anim) % 2) : 0;
  const hop = dog.moving ? -Math.abs(Math.sin(dog.anim * Math.PI / 2)) * 4 : 0;
  spr(DOG[f], dog.x, dog.y + hop, 5, dog.flip, false);
  if (dog.bark > 0) label('Au!', dog.x + (dog.flip ? -26 : 26), dog.y - 44 - (0.5 - dog.bark) * 30, 16, '#fff', Math.min(1, dog.bark * 3));
}
function drawNpc(n) {
  const sp = NPC[n.id];
  shadow(n.x, n.y, 22, 8);
  spr(sp, n.x, n.y + Math.sin(time * 2 + n.x) * 0.8, 6, Math.sin(time * 0.5 + n.x) > 0.7, false);
  label(n.name, n.x, n.y + 20, 14, '#fff6d8', 0.9);
}
function drawEnemy(e) {
  if (e.born > 0) {
    const k = 1 - e.born / (e.boss ? 1.2 : 0.5);
    shadow(e.x, e.y, e.r * k, e.r * 0.4 * k);
    spr(e.boss ? MUSGO_BOSS : MUSGO, e.x, e.y, (e.boss ? 12 : 5) * k, false, true);
    return;
  }
  const sc = e.boss ? 12 : 5;
  const sq = 1 + Math.sin(e.t * (e.boss ? 5 : 8)) * 0.07;
  shadow(e.x, e.y, e.r * (e.z ? 0.7 : 1), e.r * 0.38, e.z ? 0.2 : 0.32);
  spr(e.boss ? MUSGO_BOSS : MUSGO, e.x, e.y - e.z, sc, player.x < e.x, e.hurt > 0.1, 1 / sq, sq);
  if (e.boss) {
    // coroa de flores
    const top = e.y - e.z - MUSGO.h * sc * sq + 10;
    for (let i = 0; i < 5; i++) {
      const fx = e.x - 44 + i * 22, fy = top + 6 + Math.abs(i - 2) * 6;
      ctx.fillStyle = ['#ff8fb1', '#ffe066', '#ffffff', '#ffe066', '#ff8fb1'][i];
      ctx.beginPath(); ctx.arc(fx, fy, 8, 0, 7); ctx.fill(); ctx.fillStyle = '#e0a020'; ctx.beginPath(); ctx.arc(fx, fy, 3, 0, 7); ctx.fill();
    }
  } else if (e.hp < e.maxHp) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(e.x - 18, e.y - 62, 36, 6);
    ctx.fillStyle = '#8fe06a'; ctx.fillRect(e.x - 17, e.y - 61, 34 * e.hp / e.maxHp, 4);
  }
}
function drawItem(it) {
  const bob = Math.sin(it.t * 3) * 4 - (it.drop > 0 ? Math.sin((0.35 - it.drop) / 0.35 * Math.PI) * 30 : 0);
  const x = it.x, y = it.y;
  if (it.k === 'moeda') {
    shadow(x, y + 4, 9, 3, 0.25);
    const w = Math.abs(Math.cos(it.t * 4)) * 10 + 2;
    ctx.fillStyle = '#8a5a10'; ctx.beginPath(); ctx.ellipse(x, y - 12 + bob, w + 2, 12, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffd84a'; ctx.beginPath(); ctx.ellipse(x, y - 12 + bob, w, 10, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff3b0'; ctx.fillRect(x - w * 0.4, y - 18 + bob, Math.max(1, w * 0.3), 6);
  } else if (it.k === 'coracao') {
    shadow(x, y + 4, 10, 3, 0.25);
    heart(x, y - 14 + bob, 13, '#ff5a6e');
  } else if (it.k === 'flor') {
    const g = ctx.createRadialGradient(x, y - 18 + bob, 2, x, y - 18 + bob, 40);
    g.addColorStop(0, 'rgba(255,220,240,0.75)'); g.addColorStop(1, 'rgba(255,180,220,0)');
    ctx.fillStyle = g; ctx.fillRect(x - 40, y - 58 + bob, 80, 80);
    ctx.fillStyle = '#3f8a37'; ctx.fillRect(x - 2, y - 14 + bob, 4, 14);
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * Math.PI * 2 + it.t;
      ctx.fillStyle = '#ff9ec7'; ctx.beginPath(); ctx.arc(x + Math.cos(a) * 8, y - 20 + bob + Math.sin(a) * 8, 6, 0, 7); ctx.fill();
    }
    ctx.fillStyle = '#ffe066'; ctx.beginPath(); ctx.arc(x, y - 20 + bob, 5, 0, 7); ctx.fill();
    sparkle(x, y - 22 + bob, '#fff');
  } else if (it.k === 'graveto') {
    shadow(x, y + 2, 20, 5, 0.25);
    ctx.save(); ctx.translate(x, y - 6 + bob * 0.5); ctx.rotate(-0.4);
    ctx.fillStyle = '#3b2618'; ctx.fillRect(-24, -5, 48, 10);
    ctx.fillStyle = '#9a6a3a'; ctx.fillRect(-22, -3, 44, 6);
    ctx.fillStyle = '#c99a6a'; ctx.fillRect(-22, -3, 44, 2);
    ctx.fillStyle = '#3b2618'; ctx.fillRect(4, -14, 5, 11);
    ctx.fillStyle = '#6fb04a'; ctx.fillRect(8, -18, 8, 6);
    ctx.restore();
    sparkle(x, y - 14, '#ffe9b0');
  }
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
function relicIcon(key, x, y, s, on) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = on ? 'rgba(255,240,200,0.18)' : 'rgba(0,0,0,0.35)'; ctx.strokeStyle = on ? '#ffe38a' : 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(-s / 2, -s / 2, s, s, 8); ctx.fill(); ctx.stroke();
  ctx.globalAlpha = on ? 1 : 0.3;
  const r = s * 0.3;
  if (key === 'petala') { ctx.fillStyle = '#ff9ec7'; for (let i = 0; i < 5; i++) { const a = i / 5 * 6.283; ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6, r * 0.5, 0, 7); ctx.fill(); } ctx.fillStyle = '#ffe066'; ctx.beginPath(); ctx.arc(0, 0, r * 0.35, 0, 7); ctx.fill(); }
  if (key === 'orvalho') { ctx.fillStyle = '#6fd3ff'; ctx.beginPath(); ctx.moveTo(0, -r * 1.1); ctx.quadraticCurveTo(r, r * 0.2, 0, r); ctx.quadraticCurveTo(-r, r * 0.2, 0, -r * 1.1); ctx.fill(); ctx.fillStyle = '#e8f8ff'; ctx.fillRect(-r * 0.3, -r * 0.1, r * 0.25, r * 0.4); }
  if (key === 'brasa') { ctx.fillStyle = '#ff7a2a'; ctx.beginPath(); ctx.moveTo(0, -r * 1.1); ctx.quadraticCurveTo(r * 1.1, 0, 0, r); ctx.quadraticCurveTo(-r * 1.1, 0, 0, -r * 1.1); ctx.fill(); ctx.fillStyle = '#ffe27a'; ctx.beginPath(); ctx.moveTo(0, -r * 0.3); ctx.quadraticCurveTo(r * 0.5, r * 0.3, 0, r * 0.8); ctx.quadraticCurveTo(-r * 0.5, r * 0.3, 0, -r * 0.3); ctx.fill(); }
  ctx.restore();
}
function wrap(text, maxW) {
  const words = text.split(' '), lines = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur); return lines;
}
function drawHUD() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  layoutButtons();
  const L = 12 + SAFE.l, T = 12 + SAFE.t;
  // corações
  for (let i = 0; i < S.maxHp; i++) heart(L + 13 + i * 27, T + 13, 22, '#ff4d63', i >= player.hp);
  // moedas
  ctx.fillStyle = '#ffd84a'; ctx.beginPath(); ctx.arc(L + 12, T + 44, 9, 0, 7); ctx.fill();
  ctx.strokeStyle = '#8a5a10'; ctx.lineWidth = 2; ctx.stroke();
  ctx.font = `700 17px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(20,15,25,0.8)'; ctx.strokeText(String(S.coins), L + 28, T + 45);
  ctx.fillStyle = '#fff6d8'; ctx.fillText(String(S.coins), L + 28, T + 45);
  // relíquias
  const rs = 36;
  ['petala', 'orvalho', 'brasa'].forEach((k, i) => relicIcon(k, W - SAFE.r - 12 - rs / 2 - (2 - i) * (rs + 6), T + rs / 2, rs, S.relics[k]));
  // objetivo
  ctx.font = `600 14px ${FONT}`;
  const ob = objective(), ow = Math.min(W - L - 24, ctx.measureText(ob).width + 26);
  const oy = T + 64;
  ctx.fillStyle = 'rgba(20,24,20,0.62)'; ctx.beginPath(); ctx.roundRect(L, oy, ow, 28, 10); ctx.fill();
  ctx.fillStyle = '#ffe38a'; ctx.fillRect(L + 9, oy + 10, 6, 8);
  ctx.fillStyle = '#fff6d8'; ctx.textAlign = 'left'; ctx.fillText(ob, L + 20, oy + 15, ow - 26);
  // som
  const mb = btn.mute;
  ctx.fillStyle = 'rgba(20,24,20,0.55)'; ctx.beginPath(); ctx.arc(mb.x, mb.y, mb.r, 0, 7); ctx.fill();
  ctx.fillStyle = '#fff6d8'; ctx.beginPath(); ctx.moveTo(mb.x - 9, mb.y - 4); ctx.lineTo(mb.x - 4, mb.y - 4); ctx.lineTo(mb.x + 2, mb.y - 10); ctx.lineTo(mb.x + 2, mb.y + 10); ctx.lineTo(mb.x - 4, mb.y + 4); ctx.lineTo(mb.x - 9, mb.y + 4); ctx.fill();
  ctx.strokeStyle = '#fff6d8'; ctx.lineWidth = 2;
  if (Audio.muted) { ctx.beginPath(); ctx.moveTo(mb.x + 5, mb.y - 6); ctx.lineTo(mb.x + 12, mb.y + 6); ctx.moveTo(mb.x + 12, mb.y - 6); ctx.lineTo(mb.x + 5, mb.y + 6); ctx.stroke(); }
  else { ctx.beginPath(); ctx.arc(mb.x + 3, mb.y, 7, -0.8, 0.8); ctx.stroke(); }

  // chefe
  if (bossRef && !bossRef.dead) {
    const bw = Math.min(280, W - 60), bx = (W - bw) / 2, by = T + 102;
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
  } else if (!dialog && time < 9999 && !S.moved) {
    label('Arraste para andar', W * 0.3, H - 70 - SAFE.b, 15, '#fff6d8', 0.6 + Math.sin(time * 3) * 0.3);
  }
  // botão de ação
  const b = btn.action, it = interactTarget;
  ctx.fillStyle = it ? 'rgba(255,214,90,0.92)' : 'rgba(255,250,235,0.85)';
  ctx.strokeStyle = '#2a2238'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill(); ctx.stroke();
  ctx.save(); ctx.translate(b.x, b.y);
  if (it) {
    ctx.fillStyle = '#2a2238'; ctx.font = `700 16px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(it.kind === 'npc' ? 'Falar' : it.kind === 'chest' ? 'Abrir' : 'Porta', 0, 1);
  } else {
    ctx.rotate(-0.8);
    ctx.fillStyle = '#c9d3dc'; ctx.fillRect(-4, -26, 8, 32); ctx.fillStyle = '#2a2238'; ctx.fillRect(-4, -26, 2, 32);
    ctx.fillStyle = '#c99a3a'; ctx.fillRect(-12, 6, 24, 6); ctx.fillStyle = '#7a4a2a'; ctx.fillRect(-3, 12, 6, 12);
  }
  ctx.restore();

  if (banner) {
    const a = Math.min(1, banner.t, (2.6 - banner.t) * 3);
    ctx.globalAlpha = a;
    const by = H * 0.24;
    ctx.fillStyle = 'rgba(20,24,20,0.55)'; ctx.fillRect(0, by - 26, W, 52);
    ctx.fillStyle = '#ffe38a'; ctx.fillRect(0, by - 26, W, 2); ctx.fillRect(0, by + 24, W, 2);
    ctx.globalAlpha = 1;
    label(banner.text, W / 2, by, 26, '#fff6d8', a);
  }
  if (dialog) drawDialog();
  if (flash > 0) { ctx.fillStyle = `rgba(255,245,210,${Math.min(0.7, flash)})`; ctx.fillRect(0, 0, W, H); }
}
function drawDialog() {
  const l = dialog.lines[dialog.i]; if (!l) return;
  const pad = 14, bw = Math.min(W - 20, 560), bh = 150, bx = (W - bw) / 2, by = H - bh - 16 - SAFE.b;
  ctx.fillStyle = 'rgba(28,24,34,0.93)'; ctx.strokeStyle = '#e8d6a8'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 14); ctx.fill(); ctx.stroke();
  let tx = bx + pad;
  const pk = PORTRAIT[l.who];
  if (pk) {
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.beginPath(); ctx.roundRect(bx + 10, by + 12, 74, 92, 10); ctx.fill();
    ctx.imageSmoothingEnabled = false;
    const sp = pk === 'kai' ? HERO.down[0] : NPC[pk];
    ctx.save(); ctx.beginPath(); ctx.rect(bx + 10, by + 12, 74, 92); ctx.clip();
    ctx.drawImage(sp.img, 0, 0, sp.w, 11, bx + 11, by + 18, 72, 66);
    ctx.restore();
    ctx.font = `700 14px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = '#ffe38a'; ctx.textBaseline = 'middle';
    ctx.fillText(l.who, bx + 47, by + 120, 80);
    tx = bx + 96;
  }
  ctx.font = `500 17px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = '#fff6e6';
  const txt = l.text.slice(0, Math.floor(dialog.shown));
  const lines = wrap(l.text, bx + bw - pad - tx);
  let n = 0;
  lines.forEach((ln, i) => {
    const part = ln.slice(0, Math.max(0, txt.length - n)); n += ln.length + 1;
    ctx.fillText(part, tx, by + 16 + i * 23);
  });
  if (dialog.shown >= l.text.length) { ctx.fillStyle = '#ffe38a'; const yb = by + bh - 20 + Math.sin(time * 6) * 3; ctx.beginPath(); ctx.moveTo(bx + bw - 30, yb); ctx.lineTo(bx + bw - 18, yb); ctx.lineTo(bx + bw - 24, yb + 8); ctx.fill(); }
}

// ---------------------------------------------------------------- telas de título e final
let endT = 0;
function coverImage(im, alpha = 1) {
  if (!im) return;
  const s = Math.max(W / im.naturalWidth, H / im.naturalHeight);
  const w = im.naturalWidth * s, h = im.naturalHeight * s;
  ctx.globalAlpha = alpha; ctx.imageSmoothingEnabled = true;
  ctx.drawImage(im, (W - w) / 2, (H - h) / 2, w, h); ctx.globalAlpha = 1;
}
function button(text, x, y, w, h, fn, primary) {
  ctx.fillStyle = primary ? '#ffd65a' : 'rgba(255,250,235,0.9)'; ctx.strokeStyle = '#2a2238'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(x, y + 4, w, h, 14); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill();
  ctx.fillStyle = primary ? '#ffd65a' : 'rgba(255,250,235,0.92)';
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 14); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#2a2238'; ctx.font = `700 20px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, x + w / 2, y + h / 2 + 1);
  titleButtons.push({ x, y, w, h, fn });
}
function startGame(fresh) {
  if (fresh) { wipe(SAVE_KEY); S = newSave(); }
  else S = Object.assign(newSave(), load(SAVE_KEY) || {});
  player.hp = S.maxHp; player.inv = 0; dialog = null; endT = 0;
  mode = 'play';
  fade = { t: 0.35, dur: 0.7, mid: null };
  enterScene(S.scene || 'praca', S.scene === 'praca' || !S.scene ? SCENES.praca.start : null);
  if (S.stage === 0) setTimeout(() => say(['Kai: Que dia bonito no vale, Floco!', 'Kai: A Vó Aurora pediu pra gente encontrar ela aqui na praça...',
    'Dica: arraste o dedo para andar e toque no botão para atacar ou falar.']), 900);
}
function drawTitle() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  titleButtons = [];
  coverImage(IMGS.vila);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(10,20,15,0.75)'); g.addColorStop(0.45, 'rgba(10,20,15,0.15)'); g.addColorStop(1, 'rgba(10,20,15,0.85)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const ty = H * 0.17 + SAFE.t;
  label('VALE DA', W / 2, ty - 30, Math.min(30, W / 12), '#fff6d8');
  label('LANTERNA', W / 2, ty + 14, Math.min(56, W / 7), '#ffd65a');
  label('Uma aventura de Kai e Floco', W / 2, ty + 56, 16, '#e9ffd0');
  // herói e cão
  ctx.imageSmoothingEnabled = false;
  const cy = H * 0.6, f = Math.floor(time * 6) % 4;
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(W / 2 - 10, cy + 4, 90, 16, 0, 0, 7); ctx.fill();
  spr(HERO.down[[1, 0, 2, 0][f]], W / 2 + 20, cy, 9, false, false);
  spr(DOG[1 + (Math.floor(time * 8) % 2)], W / 2 - 70, cy + Math.abs(Math.sin(time * 8)) * -6, 7, false, false);
  const bw = Math.min(260, W - 60), bx = (W - bw) / 2;
  let by = H * 0.72;
  if (hasSave()) { button('Continuar', bx, by, bw, 54, () => startGame(false), true); by += 68; button('Novo jogo', bx, by, bw, 50, () => startGame(true)); }
  else button('Jogar', bx, by, bw, 58, () => startGame(true), true);
  label('Use fones para ouvir a música ♪', W / 2, H - 26 - SAFE.b, 13, '#cfe6c0', 0.8);
}
function drawEnd() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  titleButtons = [];
  endT += 1 / 60;
  coverImage(IMGS.torre);
  const k = Math.min(1, endT / 2);
  const g = ctx.createRadialGradient(W * 0.7, H * 0.08, 10, W * 0.7, H * 0.08, Math.max(W, H) * (0.3 + k * 0.9));
  g.addColorStop(0, `rgba(255,236,160,${0.85 * k})`); g.addColorStop(0.5, `rgba(255,200,120,${0.35 * k})`); g.addColorStop(1, 'rgba(255,200,120,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = `rgba(10,20,15,${0.45 * k})`; ctx.fillRect(0, H * 0.3, W, H * 0.5);
  label('A Lanterna brilha', W / 2, H * 0.38, Math.min(38, W / 10), '#ffe38a', k);
  label('de novo sobre o vale!', W / 2, H * 0.38 + 40, Math.min(26, W / 14), '#fff6d8', k);
  label('Moedas: ' + S.coins + '   Corações: ' + S.maxHp, W / 2, H * 0.38 + 90, 17, '#e9ffd0', k);
  ctx.imageSmoothingEnabled = false;
  spr(HERO.up[0], W / 2 + 22, H * 0.66, 7, false, false);
  spr(DOG[0], W / 2 - 40, H * 0.66, 5, false, false);
  if (endT > 1.5) button('Jogar de novo', (W - Math.min(260, W - 60)) / 2, H * 0.74, Math.min(260, W - 60), 54, () => { wipe(SAVE_KEY); mode = 'title'; }, true);
  for (let i = 0; i < 3; i++) { const x = (time * 40 + i * 137) % W, y = H * 0.1 + ((time * 23 + i * 211) % (H * 0.8)); ctx.fillStyle = '#fff6b0'; ctx.fillRect(x, y, 3, 3); }
}

// ---------------------------------------------------------------- laço principal
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  try {
    if (mode === 'play') {
      if (!S.moved && (Math.abs(input.jx) + Math.abs(input.jy) > 0 || player.moving)) S.moved = true;
      update(dt);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#14201a'; ctx.fillRect(0, 0, cv.width, cv.height);
      drawWorld();
      drawHUD();
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
  if (document.hidden) Audio.ac.suspend(); else { Audio.ac.resume(); Audio.nextNote = Audio.ac.currentTime + 0.1; }
});

(async function boot() {
  try { await Promise.race([document.fonts.load(`700 20px "Pixelify Sans"`), new Promise(r => setTimeout(r, 2500))]); } catch (e) { /* ok */ }
  await loadImages();
  for (const [id, s] of Object.entries(SCENES)) if (IMGS[id]) buildMask(s, IMGS[id]);
  document.getElementById('loading').remove();
  mode = 'title';
  requestAnimationFrame(frame);
})();

// exposto para testes
window.__vale = { get S() { return S; }, get player() { return player; }, get mode() { return mode; }, enterScene, startGame,
  get enemies() { return enemies; }, get dialog() { return dialog; }, advanceDialog, toggleMask() { debugMask = !debugMask; } };
})();
