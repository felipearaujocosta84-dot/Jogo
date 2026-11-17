/* Vale da Lanterna — clima (Fase 8): previsão por dia (determinística pela semente do save), chuva, tempestade
   com raios e trovões, neblina, neve no inverno, poças, som de chuva, moradores se abrigando,
   chuva regando plantações e janelas acesas à noite. */
'use strict';

const WEATHER = {
  sol: { name: 'Céu limpo' }, nublado: { name: 'Nublado' }, chuva: { name: 'Chuva' },
  tempestade: { name: 'Tempestade' }, neblina: { name: 'Neblina' }, neve: { name: 'Neve' }
};
// probabilidade por estação (primavera, verão, outono, inverno)
const WEATHER_ODDS = [
  { chuva: 0.24, tempestade: 0.05, neblina: 0.08, nublado: 0.18 },
  { chuva: 0.15, tempestade: 0.07, neblina: 0.03, nublado: 0.13 },
  { chuva: 0.22, tempestade: 0.05, neblina: 0.18, nublado: 0.2 },
  { neve: 0.32, chuva: 0.04, neblina: 0.14, nublado: 0.2 }
];
const WET_TYPES = ['chuva', 'tempestade'];
function wst() { S.weather = S.weather || { seed: 1, wet: 0, rainedDay: 0 }; return S.weather; }
function wrand(day, salt) { return ((hashStr('w' + wst().seed + ':' + day + ':' + salt) >>> 0) % 100000) / 100000; }
const wxCache = new Map();
// previsão completa de um dia: tipo e janela de horas
function weatherDay(day = S.time.day) {
  const key = wst().seed + ':' + day;
  if (wxCache.has(key)) return wxCache.get(key);
  let d = { type: 'sol', from: 0, to: 0, power: 1 };
  const c = calOf(day), hol = holidayOn(day);
  if (day > 1 && !hol) {
    const odds = WEATHER_ODDS[c.season], r = wrand(day, 'tipo');
    let acc = 0;
    for (const [t, p] of Object.entries(odds)) { acc += p; if (r < acc) { d.type = t; break; } }
    if (d.type === 'neblina') { d.from = 0; d.to = 8 + Math.floor(wrand(day, 'a') * 4); }
    else if (d.type === 'nublado') { d.from = 0; d.to = 24; }
    else if (d.type !== 'sol') {
      d.from = 1 + Math.floor(wrand(day, 'a') * 16);
      d.to = Math.min(24, d.from + 3 + Math.floor(wrand(day, 'b') * (d.type === 'tempestade' ? 4 : 8)));
      d.power = d.type === 'tempestade' ? 1 : 0.55 + wrand(day, 'c') * 0.45;
    }
  }
  wxCache.set(key, d);
  return d;
}
// clima de base no vale agora: { type, k } (k = intensidade 0..1 com entrada/saída suaves)
function weatherBase(h = gameHour()) {
  const d = weatherDay();
  if (d.type === 'sol') return { type: 'sol', k: 0 };
  if (d.type === 'nublado') return { type: 'nublado', k: 1 };
  if (h < d.from || h >= d.to) {
    const near = (h > d.from - 1.5 && h < d.from) || (h >= d.to && h < d.to + 1);
    return { type: near && d.type !== 'neblina' ? 'nublado' : 'sol', k: near ? 0.6 : 0 };
  }
  const k = Math.min(1, (h - d.from) / 0.5, (d.to - h) / 0.5);
  return { type: d.type, k: Math.max(0.05, k) * d.power };
}
// clima onde o jogador está (deserto não tem chuva; nas montanhas geladas vira neve)
function weatherHere() {
  const w = weatherBase();
  if (typeof curBiome === 'undefined' || !curBiome || area !== 'world') return w;
  if (curBiome === 'deserto' && (WET_TYPES.includes(w.type) || w.type === 'neve' || w.type === 'neblina')) return { type: 'nublado', k: 0.5 };
  if (curBiome === 'neve' && WET_TYPES.includes(w.type)) return { type: 'neve', k: w.k };
  return w;
}
function valeRaining() { return WET_TYPES.includes(weatherBase().type); }
// usado pela fazenda na virada do dia: chuva de madrugada já rega
function weatherRainToday() { const d = weatherDay(); return WET_TYPES.includes(d.type) && d.from < 6; }
function weatherName() { const w = weatherHere(); return WEATHER[w.type].name; }
function forecastText(day = S.time.day) {
  const d = weatherDay(day), n = WEATHER[d.type].name;
  if (d.type === 'sol' || d.type === 'nublado') return n;
  if (d.type === 'neblina') return 'Neblina até as ' + d.to + 'h';
  return n + ' das ' + d.from + 'h às ' + (d.to % 24) + 'h';
}
function weatherNewDay() {
  toast('Previsão: ' + forecastText());
}

// ---------------------------------------------------------------- moradores se abrigam
function weatherShelter(r, e) {
  if (!e || e.fb || !valeRaining()) return e;
  const P = PLACES[e[2]];
  if (!P || P.area !== 'world') return e;
  if (e[3] === 'walk' && weatherBase().type === 'chuva') return e;   // o guarda faz a ronda na chuva
  const late = gameHour() >= 17 || gameHour() < 6, key = late ? '_shN' : '_shD';
  if (!e[key]) e[key] = [e[0], e[1], (!late && e[3] === 'talk') ? 'padaria_mesa' : 'home', e[3] === 'talk' ? 'talk' : 'idle'];
  return e[key];
}
function weatherLine(r) {
  const w = weatherBase();
  if (w.type === 'tempestade') return ['Que tempestade! Melhor ficar aqui dentro.', 'Esses trovões me dão arrepios.'];
  if (w.type === 'chuva') return r.pers === 'rabugento' ? ['Chuva boa pra horta. Pelo menos isso.'] : r.prof === 'Guarda do vale' ? ['Nem a chuva me tira da ronda.'] : ['Que chuvinha, hein?', 'A chuva rega as plantações sozinha!'];
  if (w.type === 'neve') return ['Olha a neve! O vale fica lindo assim.', 'Brrr... que frio!'];
  if (w.type === 'neblina') return ['Com essa neblina mal dá pra ver a praça.'];
  const t = weatherDay(S.time.day + 1);
  if (WET_TYPES.includes(t.type) && gameHour() > 15) return ['Dizem que amanhã vai chover.'];
  return [];
}

// ---------------------------------------------------------------- atualização (chuva rega, poças, raios, som)
const wfx = { drops: [], flash: 0, nextBolt: 8, thunder: [], rainGain: null, rainFilt: null, t: 0 };
function weatherUpdate(dt) {
  const W = wst(), base = weatherBase(), here = weatherHere();
  wfx.t += dt;
  // poças: enchem na chuva, secam em ~2 horas de jogo
  const gm = dt * 1440 / (dayMinutes() * 60);
  if (WET_TYPES.includes(base.type)) W.wet = Math.min(1, W.wet + gm / 60 * base.k);
  else W.wet = Math.max(0, W.wet - gm / 150);
  // chuva rega as plantações do vale
  if (WET_TYPES.includes(base.type) && base.k > 0.3 && W.rainedDay !== S.time.day) {
    W.rainedDay = S.time.day;
    let n = 0;
    for (const f of Object.values(S.farm)) if (!f.water) { f.water = true; n++; }
    if (n && area === 'world' && !curBiome) toast('A chuva está regando suas plantações.');
  }
  // raios e trovões
  if (here.type === 'tempestade' && here.k > 0.4) {
    wfx.nextBolt -= dt;
    if (wfx.nextBolt <= 0) {
      wfx.nextBolt = rand(6, 16);
      wfx.flash = area === 'world' ? 1 : 0.35;
      wfx.thunder.push(rand(0.3, 1.6));
    }
  }
  wfx.flash = Math.max(0, wfx.flash - dt * 2.6);
  for (let i = wfx.thunder.length - 1; i >= 0; i--) if ((wfx.thunder[i] -= dt) <= 0) { wfx.thunder.splice(i, 1); thunderSound(); }
  rainSound(WET_TYPES.includes(here.type) ? here.k * (here.type === 'tempestade' ? 1 : 0.7) : 0, area !== 'world');
  // gotas (coordenadas de tela)
  const want = area === 'world' && WET_TYPES.includes(here.type) ? Math.round(Q().fx * here.k * (here.type === 'tempestade' ? 360 : 200)) : 0;
  const wind = here.type === 'tempestade' ? -320 : -90;
  while (wfx.drops.length < want) wfx.drops.push({ x: rand(-100, W_() + 200), y: rand(-H, H), v: rand(900, 1300), l: rand(12, 22) });
  if (wfx.drops.length > want) wfx.drops.length = want;
  for (const d of wfx.drops) {
    d.y += d.v * dt; d.x += wind * dt;
    if (d.y > H + 20 || d.x < -40) { d.y = rand(-60, -10); d.x = rand(-40, W_() + 300); }
  }
  // respingos ao andar nas poças
  if (area === 'world' && W.wet > 0.35 && player.moving && Math.random() < dt * 5 && !curBiome)
    particles.push({ x: player.x + rand(-10, 10), y: player.y, vx: rand(-40, 40), vy: rand(-90, -40), g: 300, t: 0.35, max: 0.35, col: 'rgba(190,215,240,0.9)', s: 3 });
  // neve caindo (usa as partículas de neve já existentes)
  if (area === 'world' && here.type === 'neve' && curBiome !== 'neve' && Math.random() < dt * Q().fx * 26 * here.k)
    particles.push({ x: cam.x + rand(-100, view.vw + 100), y: cam.y - 10, vx: 0, vy: rand(50, 95), g: 0, t: 9, max: 9, col: '#ffffff', s: rand(4, 7), sway: rand(0, 6), snow: 1 });
}
const W_ = () => W;   // largura da tela (W é global do core)

// ---------------------------------------------------------------- som
function rainSound(level, indoor) {
  if (!Audio.ac) return;
  if (!wfx.rainGain) {
    if (level <= 0) return;
    const ac = Audio.ac, n = ac.sampleRate * 2, b = ac.createBuffer(1, n, ac.sampleRate), a = b.getChannelData(0);
    let last = 0; for (let i = 0; i < n; i++) { last = last * 0.6 + (Math.random() * 2 - 1) * 0.4; a[i] = last; }
    const s = ac.createBufferSource(); s.buffer = b; s.loop = true;
    wfx.rainFilt = ac.createBiquadFilter(); wfx.rainFilt.type = 'lowpass'; wfx.rainFilt.frequency.value = 2400;
    wfx.rainGain = ac.createGain(); wfx.rainGain.gain.value = 0;
    s.connect(wfx.rainFilt); wfx.rainFilt.connect(wfx.rainGain); wfx.rainGain.connect(Audio.master); s.start();
  }
  const t = Audio.ac.currentTime;
  wfx.rainGain.gain.setTargetAtTime(level * (indoor ? 0.12 : 0.32), t, 0.6);
  wfx.rainFilt.frequency.setTargetAtTime(indoor ? 500 : 2400, t, 0.3);
}
function thunderSound() {
  if (!Audio.ac || Audio.muted) return;
  const ac = Audio.ac, d = 2.6, n = Math.floor(ac.sampleRate * d), b = ac.createBuffer(1, n, ac.sampleRate), a = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < n; i++) { const k = i / n; last = last * 0.97 + (Math.random() * 2 - 1) * 0.03; a[i] = last * 9 * (k < 0.05 ? k / 0.05 : Math.pow(1 - k, 1.6)) * (1 + 0.5 * Math.sin(k * 40)); }
  const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  f.type = 'lowpass'; f.frequency.value = area === 'world' ? 260 : 140; g.gain.value = area === 'world' ? 0.9 : 0.5;
  s.buffer = b; s.connect(f); f.connect(g); g.connect(Audio.master); s.start();
}

// ---------------------------------------------------------------- luz: nuvens escurecem, luzes acendem
function weatherLight() {
  const w = weatherHere();
  const dim = { sol: 0, nublado: 0.14, chuva: 0.26, tempestade: 0.42, neblina: 0.1, neve: 0.12 }[w.type] * Math.max(w.k, w.type === 'nublado' ? 0.6 : 0);
  return { dim, tint: [176, 188, 212], lights: dim > 0.25 ? dim * 1.4 : 0 };
}
// janelas acesas: cada casa tem seu horário de dormir; acende à noite e em dias escuros
function windowsLit(b) {
  const h = gameHour(), L = lightAt(), wl = weatherLight();
  const k = Math.max(L.night, wl.lights);
  if (k < 0.25) return 0;
  const off = 21.5 + ((hashStr(Math.round(b.x) + ',' + Math.round(b.y)) >>> 0) % 5) * 0.5;
  return h >= 5 && h < off ? k : 0;
}

// ---------------------------------------------------------------- desenho
function drawPuddles(x0, y0, x1, y1) {
  const wet = wst().wet;
  if (wet < 0.05 || curBiome) return;
  const G = 150, raining = valeRaining();
  for (let gy = Math.floor(y0 / G); gy <= Math.floor(y1 / G); gy++) for (let gx = Math.floor(x0 / G); gx <= Math.floor(x1 / G); gx++) {
    const h = hashStr('p' + gx + ',' + gy) >>> 0;
    if (h % 100 > 30) continue;
    const x = gx * G + (h >>> 8) % 110 + 20, y = gy * G + (h >>> 16) % 110 + 20;
    if (!inVale(x, y) || terrainAt(x, y) === 2 || !worldWalk(x, y) || inPlot(x, y)) continue;
    const rx = (26 + (h >>> 4) % 30) * Math.min(1, wet * 1.6), ry = rx * 0.42;
    ctx.fillStyle = `rgba(78,104,132,${0.45 * Math.min(1, wet * 1.4)})`;
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7); ctx.fill();
    ctx.fillStyle = `rgba(200,225,250,${0.25 * wet})`;
    ctx.beginPath(); ctx.ellipse(x - rx * 0.3, y - ry * 0.3, rx * 0.35, ry * 0.3, 0, 0, 7); ctx.fill();
    if (raining) {
      const p = (wfx.t * 1.3 + (h % 97) / 97) % 1;
      ctx.strokeStyle = `rgba(220,235,255,${0.5 * (1 - p)})`; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(x + ((h >>> 3) % 20) - 10, y, 4 + p * rx * 0.6, (4 + p * rx * 0.6) * 0.42, 0, 0, 7); ctx.stroke();
    }
  }
}
// efeitos de tela (depois da luz): chuva, neblina, clarão do raio
function drawWeatherFX() {
  const w = weatherHere();
  ctx.save(); ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (area === 'world') {
    if (wfx.drops.length) {
      const sl = w.type === 'tempestade' ? 0.3 : 0.09;
      ctx.strokeStyle = 'rgba(205,220,245,0.6)'; ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (const d of wfx.drops) { ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + d.l * sl, d.y - d.l); }
      ctx.stroke();
      // respingos no chão
      ctx.strokeStyle = 'rgba(220,232,255,0.5)';
      const n = Math.round(wfx.drops.length * 0.08);
      for (let i = 0; i < n; i++) { const x = Math.random() * W, y = Math.random() * H, r = 2 + Math.random() * 4; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.4, 0, 0, 7); ctx.stroke(); }
    }
    if (w.type === 'neblina' && w.k > 0) {
      const L = lightAt(), c = L.col.map(v => Math.round(150 + v * 0.38));
      ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${0.3 * w.k})`; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 6; i++) {
        const x = ((i * 397 + wfx.t * 14 - cam.x * view.s * 0.6) % (W + 600) + W + 600) % (W + 600) - 300, y = (i * 0.17 + 0.1) * H, r = 260 + i * 40;
        const g = ctx.createRadialGradient(x, y, 10, x, y, r);
        g.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${0.35 * w.k})`); g.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
        ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
    }
  }
  if (wfx.flash > 0) { ctx.fillStyle = `rgba(235,240,255,${0.55 * wfx.flash})`; ctx.fillRect(0, 0, W, H); }
  ctx.restore();
}
// ícone pequeno do clima (HUD)
function drawWeatherIcon(type, x, y) {
  const c = ctx;
  const cloud = (cx, cy, col) => { c.fillStyle = col; c.beginPath(); c.arc(cx - 5, cy, 5, 0, 7); c.arc(cx + 2, cy - 3, 6, 0, 7); c.arc(cx + 7, cy + 1, 4, 0, 7); c.fill(); c.fillRect(cx - 5, cy, 12, 5); };
  if (type === 'sol') { c.fillStyle = '#ffd84a'; c.beginPath(); c.arc(x, y, 5, 0, 7); c.fill(); for (let i = 0; i < 8; i++) { const a = i * 0.785; c.fillRect(x + Math.cos(a) * 8 - 1, y + Math.sin(a) * 8 - 1, 2, 2); } return; }
  if (type === 'neblina') { c.fillStyle = '#d8dde4'; for (let i = 0; i < 3; i++) c.fillRect(x - 8 + (i % 2) * 2, y - 5 + i * 4, 14, 2); return; }
  cloud(x, y - 1, type === 'tempestade' ? '#8a90a0' : '#dfe6ef');
  if (type === 'chuva' || type === 'tempestade') { c.fillStyle = '#8fcfff'; for (let i = 0; i < 3; i++) c.fillRect(x - 5 + i * 5, y + 7, 2, 4); }
  if (type === 'tempestade') { c.fillStyle = '#ffe066'; c.beginPath(); c.moveTo(x + 2, y + 3); c.lineTo(x - 2, y + 10); c.lineTo(x + 1, y + 10); c.lineTo(x - 1, y + 15); c.lineTo(x + 5, y + 7); c.lineTo(x + 2, y + 7); c.fill(); }
  if (type === 'neve') { c.fillStyle = '#ffffff'; for (let i = 0; i < 3; i++) c.fillRect(x - 5 + i * 5, y + 8 + (i % 2) * 2, 2, 2); }
}
