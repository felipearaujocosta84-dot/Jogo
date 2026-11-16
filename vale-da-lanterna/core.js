/* Vale da Lanterna — núcleo: tela, utilidades, áudio e sprites em pixel art. */
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

// a fonte pixelada não tem as ligaduras "fi"/"fl": separa as letras
(() => {
  const P = CanvasRenderingContext2D.prototype, nolig = t => typeof t === 'string' ? t.replace(/f(?=[ilf])/g, 'f\u200C') : t;
  for (const fn of ['fillText', 'strokeText', 'measureText']) { const o = P[fn]; P[fn] = function (t, ...a) { return o.call(this, nolig(t), ...a); }; }
})();
const FONT = '"Pixelify Sans", "Trebuchet MS", sans-serif';
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// ---------------------------------------------------------------- armazenamento (opcional)
const SAVE_KEY = 'vale-da-lanterna-v2';
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
      case 'chop': this.tone(160, 0.08, 'square', 0.1, -60); this.noise(0.06, 0.12, 900); break;
      case 'rock': this.tone(110, 0.08, 'square', 0.1); this.noise(0.08, 0.14, 1800); break;
      case 'cut': this.noise(0.07, 0.08, 3000); break;
      case 'craft': [392, 523, 659, 784].forEach((f, i) => this.tone(f, 0.12, 'square', 0.07, 0, i * 0.07)); this.noise(0.1, 0.08, 2500); break;
      case 'meow': this.tone(700, 0.25, 'triangle', 0.09, 300); this.tone(900, 0.2, 'triangle', 0.06, -400, 0.18); break;
      case 'sleep': [392, 330, 262].forEach((f, i) => this.tone(f, 0.4, 'sine', 0.1, 0, i * 0.25)); break;
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
Object.assign(NPC, {
  bruno: bake(personRows(['...OOOOOO...', '..OSSSSSSO..', '.OSSSSSSSSO.', '.OSSsSSsSSO.', '.OSSSSSSSSO.', '.OsSESSESsO.', '..OWWWWWWO..']),
    pal({ W: '#5a3418', w: '#3b2210', R: '#8a8f99', r: '#5c6069', B: '#6e5a48', b: '#4f3f31', G: '#c9a14a', P: '#3a3a44', S: '#d99a66', s: '#b07a48' })),
  rosa: bake(personRows(['..OOOOOOOO..', '.OMMMMMMMMO.', '.OMMMMMMMMO.', '.OWWMMMMWWO.'], ROBE),
    pal({ M: '#fbfbf4', W: '#d0542e', w: '#9e3b1e', R: '#fbfbf4', r: '#d8d8cc', B: '#f2efe6', b: '#c9c4b5', G: '#e0a0a0', S: '#f0c08a' })),
  teo: bake(personRows(null),
    pal({ W: '#8a5a2b', w: '#5e3b1a', R: '#f2c94c', r: '#c99a2a', B: '#f2c94c', b: '#c99a2a', G: '#7a4a2a', P: '#4a6fa5' }))
});
const CAT = bake(['O.....O.....', 'OO...OO.....', 'OYYOOYYO....', 'OYEYYEYO..OO', 'OYYyyYYO..OY', '.OYYYYYYOOYO', '.OYYyYYyYYO.', '.OYYYYYYYYO.', '..OYO..OYO..', '..OO....OO..'],
  pal({ Y: '#f0a050', y: '#fbe0b8', E: '#2a2238' }));
const MUSGO_AZUL = bake(MUSGO_ROWS, pal({ M: '#4a8fd0', m: '#2f66a8', h: '#9fd0ff', g: '#c8f0ff', E: '#1d1a24' }));

// ---------------------------------------------------------------- ruído e aleatório com semente
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash2(x, y) { let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// ---------------------------------------------------------------- props em pixel art (gerados)
function pixelCanvas(w, h, fn) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); fn(g); return c;
}
function makeTree(seed, kind) {
  const R = mulberry(seed), W2 = 40, H2 = 50;
  const pals = {
    oak: ['#1f3d1f', '#2f6b2a', '#3f8a37', '#5fae4a', '#8fd36a'],
    lime: ['#1f3d1f', '#3a7a2a', '#5a9e34', '#7fc144', '#b5e070'],
    deep: ['#132b1a', '#1f4f2c', '#2b6b3a', '#3d8a4a', '#6ab36a'],
    bloom: ['#1f3d1f', '#2f6b2a', '#3f8a37', '#5fae4a', '#8fd36a']
  };
  const P = pals[kind] || pals.oak;
  return pixelCanvas(W2, H2, g => {
    // tronco
    g.fillStyle = '#2a1a10'; g.fillRect(16, 30, 8, 18);
    g.fillStyle = '#6b4226'; g.fillRect(17, 30, 6, 17);
    g.fillStyle = '#8a5a34'; g.fillRect(18, 30, 2, 16);
    g.fillStyle = '#2a1a10'; g.fillRect(13, 46, 14, 2);
    if (kind === 'pine') {
      for (let l = 0; l < 4; l++) {
        const top = 2 + l * 8, w = 8 + l * 6;
        for (let y = 0; y < 12; y++) {
          const hw = Math.floor(w * (y / 12)) + 2;
          for (let x = -hw; x <= hw; x++) {
            const edge = Math.abs(x) >= hw - 0 || y === 11;
            g.fillStyle = edge ? '#132b1a' : (x < -hw / 3 ? '#4f9a50' : x > hw / 3 ? '#1f4f2c' : '#2f6b3a');
            g.fillRect(20 + x, top + y, 1, 1);
          }
        }
      }
      return;
    }
    const blobs = [[20, 17, 14]];
    for (let i = 0; i < 5; i++) blobs.push([20 + (R() - 0.5) * 18, 17 + (R() - 0.5) * 12, 6 + R() * 6]);
    const inside = (x, y) => blobs.some(([bx, by, br]) => (x - bx) ** 2 + (y - by) ** 2 <= br * br);
    for (let y = 0; y < 36; y++) for (let x = 0; x < W2; x++) {
      if (!inside(x + 0.5, y + 0.5)) continue;
      const edge = !inside(x - 0.5, y + 0.5) || !inside(x + 1.5, y + 0.5) || !inside(x + 0.5, y - 0.5) || !inside(x + 0.5, y + 1.5);
      if (edge) { g.fillStyle = P[0]; g.fillRect(x, y, 1, 1); continue; }
      const l = ((20 - x) * 0.6 + (17 - y) * 0.9) / 14 + (R() - 0.5) * 0.5;
      g.fillStyle = l > 0.75 ? P[4] : l > 0.2 ? P[3] : l > -0.4 ? P[2] : P[1];
      g.fillRect(x, y, 1, 1);
    }
    if (kind === 'bloom') for (let i = 0; i < 26; i++) {
      const x = Math.floor(6 + R() * 28), y = Math.floor(4 + R() * 26);
      if (inside(x + 0.5, y + 0.5) && inside(x - 1, y) && inside(x + 2, y)) { g.fillStyle = R() < 0.5 ? '#ff9ec7' : '#ffe0ef'; g.fillRect(x, y, 2, 2); }
    }
  });
}
const TREE_IMGS = [];
['oak', 'oak', 'lime', 'deep', 'bloom', 'pine', 'pine', 'oak'].forEach((k, i) => TREE_IMGS.push({ kind: k, img: makeTree(1000 + i * 77, k) }));

function makeRock(seed, crystal) {
  const R = mulberry(seed);
  return pixelCanvas(20, 16, g => {
    const cx = 10, cy = 10, rx = 8 + R() * 1.5, ry = 5.5;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 20; x++) {
      const d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
      if (d > 1) continue;
      const edge = d > 0.72;
      const l = (cx - x) * 0.4 + (cy - y) * 0.7 + (R() - 0.5) * 1.5;
      g.fillStyle = edge ? '#3a3a44' : l > 2 ? '#c9c6c0' : l > -1 ? '#9a978f' : '#74716b';
      g.fillRect(x, y, 1, 1);
    }
    g.fillStyle = 'rgba(80,140,60,0.9)'; g.fillRect(5, 6, 4, 1); g.fillRect(6, 5, 2, 1);
    if (crystal) {
      [[7, 1, 3, 8], [11, 3, 3, 6], [4, 4, 2, 5]].forEach(([x, y, w, h]) => {
        g.fillStyle = '#1e3f7a'; g.fillRect(x - 1, y - 1, w + 2, h + 1);
        g.fillStyle = '#5fb8ff'; g.fillRect(x, y, w, h);
        g.fillStyle = '#c8f0ff'; g.fillRect(x, y, 1, h - 1);
      });
    }
  });
}
const ROCK_IMGS = [makeRock(5, false), makeRock(9, false), makeRock(13, true)];
const STUMP = pixelCanvas(16, 8, g => { g.fillStyle = '#2a1a10'; g.fillRect(2, 1, 12, 7); g.fillStyle = '#8a5a34'; g.fillRect(3, 2, 10, 5); g.fillStyle = '#c99a6a'; g.fillRect(5, 3, 6, 2); });
function makeBush(seed, flowers) {
  const R = mulberry(seed), W2 = 36, H2 = 24, P = ['#1f3d1f', '#2f6b2a', '#3f8a37', '#5fae4a', '#8fd36a'];
  return pixelCanvas(W2, H2, g => {
    const blobs = [[18, 14, 10]];
    for (let i = 0; i < 4; i++) blobs.push([8 + R() * 20, 11 + R() * 6, 6 + R() * 4]);
    const inside = (x, y) => y < 23 && blobs.some(([bx, by, br]) => (x - bx) ** 2 + (y - by) ** 2 <= br * br);
    for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) {
      if (!inside(x + 0.5, y + 0.5)) continue;
      const edge = !inside(x - 0.5, y + 0.5) || !inside(x + 1.5, y + 0.5) || !inside(x + 0.5, y - 0.5) || !inside(x + 0.5, y + 1.5);
      const l = ((18 - x) * 0.5 + (12 - y) * 0.9) / 10 + (R() - 0.5) * 0.5;
      g.fillStyle = edge ? P[0] : l > 0.75 ? P[4] : l > 0.2 ? P[3] : l > -0.4 ? P[2] : P[1];
      g.fillRect(x, y, 1, 1);
    }
    if (flowers) for (let i = 0; i < 10; i++) {
      const x = Math.floor(4 + R() * 28), y = Math.floor(4 + R() * 16);
      if (inside(x - 1, y) && inside(x + 2, y + 1)) { g.fillStyle = flowers; g.fillRect(x, y, 2, 2); }
    }
  });
}
const BUSH_IMGS = [makeBush(3), makeBush(8), makeBush(21, '#ff9ec7'), makeBush(34, '#ffe066'), makeBush(55, '#ffffff')];
