/* Vale da Lanterna — festas: festas da vila na praça (decoração, dança, prenda), Réveillon com contagem regressiva e
   fogos, Ano Novo com retrospectiva, Natal com árvore e presentes, Festa Junina com fogueira, festas de aniversário dos
   moradores (na casa de quem faz anos, com bolo e "Parabéns pra você"), aniversário surpresa do Kai e a festa de cada
   cidade grande do mundo. */
'use strict';

function festState() {
  S.fest = S.fest || {};
  const F = S.fest;
  if (!F.kaiBday) F.kaiBday = [2, 15];
  if (!F.kaiAge) F.kaiAge = 20;
  F.seen = F.seen || {}; F.danced = F.danced || {}; F.gifts = F.gifts || {};
  if (!F.yearStart) F.yearStart = { day: S.time.day, earned: S.stats ? S.stats.earned : 0, year: calOf().y };
  return F;
}
const festArt = hol => /^(Natal|Réveillon|Ano Novo|Aniversário|Festival)/.test(hol.name) ? 'do' : 'da';
const festKey = k => k + ':' + calOf().y + ':' + calOf().doy;

// ---------------------------------------------------------------- quem vai para onde
PLACES.praca_festa = { area: 'world', x: 3550, y: 2190, rect: [640, 330] };
const festEntries = new Map();
const festEntry = (key, place, a = 'talk') => { if (!festEntries.has(key)) festEntries.set(key, Object.assign([0, 24, place, a], { fest: true, fb: true })); return festEntries.get(key); };
// aniversário de morador: convidados (quem mora junto + até 4 amigos da mesma faixa de idade)
function partyHostToday() {
  if (holidayToday()) return null;   // em dia de festa da vila, o aniversário é comemorado na praça
  return RESIDENTS.find(r => !r.kid && isBirthday(r.id)) || null;
}
function partyGuests(host) {
  const young = r => r.child || r.teen || r.age < 18;
  const mates = RESIDENTS.filter(r => r !== host && !r.kid && r.home0 === host.home0);
  const others = RESIDENTS.filter(r => r !== host && !r.kid && !mates.includes(r) && young(r) === young(host))
    .sort((a, b) => (hashStr(a.id + host.id + calOf().y) & 255) - (hashStr(b.id + host.id + calOf().y) & 255)).slice(0, 4);
  return mates.concat(others);
}
function partyPlace(id, home) {
  const key = 'niver_' + id;
  if (!PLACES[key]) { const I = INTERIORS[home]; PLACES[key] = { area: home, x: I.w * TILE / 2, y: I.h * TILE * 0.56, rect: [I.w * TILE * 0.6, I.h * TILE * 0.3] }; }
  return key;
}
// amigos do Kai que vão à festa surpresa
function kaiPartyGuests() {
  return RESIDENTS.filter(r => !r.kid && r.age >= 6 && (partnerOf(r.id) || hearts(r.id) >= 3)).sort((a, b) => sm(b.id).friend - sm(a.id).friend).slice(0, 6);
}
const isKaiBirthday = (day = S.time.day) => sameDate(festState().kaiBday, calOf(day));
function festOverride(r, h) {
  if (r.kid && r.stage === 'bebe') return null;
  const hol = holidayToday();
  if (hol && h >= hol.start && h < hol.end) return festEntry('hol:' + hol.key, 'praca_festa');
  if (h >= 18 && h < 21) {
    const host = partyHostToday();
    if (host && (r === host || partyGuests(host).includes(r))) return festEntry('niver:' + host.id, partyPlace(host.id, host.home));
  }
  if (h >= 19 && h < 22 && isKaiBirthday() && kaiPartyGuests().includes(r)) return festEntry('niver:kai', partyPlace('kai', 'casaKai'));
  return null;
}

// ---------------------------------------------------------------- virada do dia
function festNewDay() {
  const F = festState(), c = calOf();
  const host = partyHostToday();
  if (host && npcMem(host.id).met) setTimeout(() => toast('Festa de aniversário de ' + host.name + ' hoje às 18h, na casa ' + (SOCIAL[host.id] && SOCIAL[host.id].gender === 'f' ? 'dela' : 'dele') + '!'), 7800);
  if (isKaiBirthday()) { F.kaiAge++; setTimeout(() => { banner = { text: 'Feliz aniversário, Kai!', sub: 'Você faz ' + F.kaiAge + ' anos hoje', t: 3.2 }; Audio.sfx('relic'); }, 1200); }
  if (c.m === 0 && c.d === 1) newYear();
  if (c.m === 11 && c.d === 31) setTimeout(() => toast('Hoje é Réveillon! Festa na praça a partir das 21h, fogos à meia-noite.'), 2600);
  const cf = cityFestToday(); for (const ci of cf) setTimeout(() => toast('Hoje é a festa de ' + ci.name + '!'), 10400);
}
// virada do ano: fogos e retrospectiva
let fireworksT = 0, countdownShown = 0;
function newYear() {
  const F = festState(), c = calOf();
  fireworksT = 70;
  banner = { text: 'Feliz Ano Novo!', sub: String(c.y), t: 4 };
  Audio.sfx('relic');
  const ys = F.yearStart, days = S.time.day - ys.day, earned = (S.stats.earned || 0) - ys.earned;
  const best = RESIDENTS.filter(r => !r.kid).sort((a, b) => sm(b.id).friend - sm(a.id).friend).slice(0, 3).map(r => r.name);
  const lines = ['Retrospectiva de ' + (c.y - 1) + ': ' + days + ' dias no vale, ' + earned + ' moedas ganhas.', 'Melhores amigos: ' + best.join(', ') + '.'];
  if (S.romance) lines.push('E ' + RES_BY_ID[S.romance.id].name + ' ao seu lado.');
  if (S.football && S.football.stats.matches) lines.push('No futebol: ' + S.football.stats.matches + ' jogos e ' + S.football.stats.goals + ' gols.');
  lines.push('Feliz ' + c.y + ', Kai!');
  F.yearRecap = lines;
  F.yearStart = { day: S.time.day, earned: S.stats.earned || 0, year: c.y };
  for (const r of RESIDENTS) if (!r.kid && r.area === 'world' && Math.hypot(r.x - 3550, r.y - 2200) < 700) addFriend(r.id, 10);
}

// ---------------------------------------------------------------- a cada quadro: cenas de festa, fogos, contagem
const PARABENS = [[392, 0.3], [392, 0.15], [440, 0.45], [392, 0.45], [523, 0.45], [494, 0.9], [392, 0.3], [392, 0.15], [440, 0.45], [392, 0.45], [587, 0.45], [523, 0.9]];
function singParabens() { if (!Audio.ac || Audio.muted) return; let t = 0; for (const [f, d] of PARABENS) { Audio.tone(f, d * 0.95, 'triangle', 0.07, 0, t); t += d * 0.9; } }
function confetti(cx, cy, n = 50) { for (let i = 0; i < n; i++) particles.push({ x: cx + rand(-160, 160), y: cy + rand(-80, 40), vx: rand(-60, 60), vy: rand(-160, -60), g: 140, t: 2.4, max: 2.4, col: FLOWER_COLS[i % 5], s: 6 }); }
function festTick(dt) {
  if (mode !== 'play' || !S.time) return;
  const F = festState(), h = gameHour(), c = calOf();
  // festa de aniversário de morador: o Kai chega na casa durante a festa
  const host = partyHostToday();
  if (host && area === host.home && h >= 18 && h < 21 && !dialog && !menu && !F.seen[festKey('niver:' + host.id)]) {
    F.seen[festKey('niver:' + host.id)] = true;
    const g = partyGuests(host).filter(r => r.area === host.home);
    talkPid = host.id; talkFace = host;
    singParabens(); confetti(interiorDef.pw / 2, interiorDef.ph / 2); flash = 0.3;
    addFriend(host.id, 30); for (const r of g) addFriend(r.id, 5); remember(host.id, 'O Kai veio na minha festa de aniversário!');
    for (const r of [host].concat(g)) { r.hopT = 1.6; }
    say(['Todos: ♪ Parabéns pra você, nesta data querida... ♪', 'Todos: ♪ Muitas felicidades, muitos anos de vida! ♪', host.name + ': Que bom que você veio, Kai! Pega um pedaço de bolo!',
      'Dica: um presente hoje vale o triplo.']);
    addItem('torta', 1);
    save();
  }
  // aniversário surpresa do Kai
  if (isKaiBirthday() && area === 'casaKai' && h >= 19 && h < 22 && !dialog && !menu && !F.seen[festKey('niver:kai')]) {
    const guests = kaiPartyGuests().filter(r => r.area === 'casaKai');
    if (guests.length) {
      F.seen[festKey('niver:kai')] = true;
      singParabens(); confetti(interiorDef.pw / 2, interiorDef.ph / 2, 70); flash = 0.4;
      const gifts = [];
      for (const r of guests) {
        const k = r.likes[0] && ['flor', 'torta', 'cristal', 'cogumelo', 'madeira', 'pedra', 'carpa', 'peixe', 'pao', 'morango'].includes(r.likes[0]) ? r.likes[0] : 'torta';
        addItem(k, 1); gifts.push(r.name + ' (' + NAMES[k].toLowerCase() + ')'); addFriend(r.id, 5); r.hopT = 1.6;
      }
      const coins = 10 * guests.length; S.coins += coins; S.stats.earned += coins;
      talkPid = guests[0].id; talkFace = guests[0];
      say(['Todos: SURPRESA!!!', 'Todos: ♪ Parabéns pra você, nesta data querida... ♪', guests[0].name + ': Feliz aniversário, Kai! ' + F.kaiAge + ' anos!',
        'Presentes: ' + gifts.join(', ') + ' e ' + coins + ' moedas.']);
      save();
    }
  }
  // retrospectiva do ano (quando o Kai estiver livre)
  if (F.yearRecap && !dialog && !menu && !fade && !work && !(typeof fbPlaying === 'function' && fbPlaying())) { const l = F.yearRecap; F.yearRecap = null; setTimeout(() => say(l), 2500); }
  // contagem regressiva do Réveillon
  if (c.m === 11 && c.d === 31 && h >= 23 + 58 / 60 && countdownShown !== S.time.day) { countdownShown = S.time.day; banner = { text: '10... 9... 8...', sub: 'Contagem regressiva para ' + (c.y + 1) + '!', t: 3 }; }
  // fogos
  const hol = holidayToday(), night = h >= 19 || h < 2;
  const fwOn = fireworksT > 0 || (hol && hol.fireworks && night && h >= hol.start && h < Math.max(hol.end, hol.start + 1)) || (cityFestNear() && night && h < 24);
  if (fireworksT > 0) fireworksT -= dt;
  if (fwOn && area === 'world' && (Math.hypot(player.x - 3550, player.y - 2050) < 3200 || cityFestNear()) && Math.random() < dt * (fireworksT > 0 ? 2.6 : 0.8) * Q().fx + 0.0) launchFirework();
  if (hol && hol.key === 'estrelas' && night && area === 'world' && Math.random() < dt * 0.7) shootingStar();
  for (const f of fireworks) { f.t -= dt; f.x += f.vx * dt; f.y += f.vy * dt; f.vy += f.g * dt; f.vx *= 0.985; }
  fireworks = fireworks.filter(f => f.t > 0);
}
let fireworks = [];
function launchFirework() {
  const x = cam.x + rand(0.1, 0.9) * view.vw, y = cam.y + rand(0.08, 0.35) * view.vh;
  const col = ['#ff5a6a', '#ffd84a', '#7be3ff', '#b59cff', '#7be36a', '#ffffff', '#ff9ec7'][Math.floor(rand(0, 7))], n = Math.round(26 * Math.min(1.4, Q().fx + 0.3));
  for (let i = 0; i < n; i++) { const a = i / n * 6.283, v = rand(160, 280); fireworks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 60, t: rand(1, 1.6), max: 1.6, col }); }
  fireworks.push({ x, y, vx: 0, vy: 0, g: 0, t: 0.5, max: 0.5, col, glow: true });
  if (Audio.ac && !Audio.muted) { Audio.noise(0.35, 0.1, 300); Audio.tone(rand(500, 900), 0.12, 'triangle', 0.03, -300, 0.05); }
}
function shootingStar() { const x = cam.x + rand(0, view.vw), y = cam.y + rand(0, 0.3) * view.vh; fireworks.push({ x, y, vx: rand(500, 700), vy: rand(150, 260), g: 0, t: 0.7, max: 0.7, col: '#ffffff', star: true }); }

// ---------------------------------------------------------------- desenho: decoração da praça, árvore de Natal, fogueira, bolo
const BUNTING = [[[3330, 1760], [3770, 1760]], [[3330, 2400], [3770, 2400]], [[3200, 2050], [3330, 1760]], [[3770, 1760], [3900, 2050]], [[3200, 2050], [3330, 2400]], [[3900, 2050], [3770, 2400]], [[3330, 1760], [3770, 2400]], [[3770, 1760], [3330, 2400]]];
function buntingCols(key) { return key === 'natal' ? ['#c8423b', '#2f8a4a', '#e9c46a'] : key === 'junina' ? ['#ff5a6a', '#ffd84a', '#4a90e2', '#7be36a', '#ff9ec7', '#f08a24'] : ['#ff9ec7', '#ffd84a', '#9ad1ff', '#b59cff', '#7be36a']; }
function drawBunting(pairs, key, x0, y0, x1, y1, lanterns) {
  const cols = buntingCols(key), night = lightAt().night > 0.3;
  for (const [[ax, ay], [bx, by]] of pairs) {
    if (Math.max(ax, bx) < x0 - 100 || Math.min(ax, bx) > x1 + 100 || Math.max(ay, by) < y0 - 200 || Math.min(ay, by) > y1 + 300) continue;
    const L = Math.hypot(bx - ax, by - ay), n = Math.floor(L / 34), top = 120;
    const pt = k => [ax + (bx - ax) * k, ay - top + (by - ay) * k + Math.sin(k * Math.PI) * 50];
    ctx.strokeStyle = 'rgba(60,40,30,0.8)'; ctx.lineWidth = 2; ctx.beginPath();
    for (let i = 0; i <= 20; i++) { const [x, y] = pt(i / 20); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
    for (let i = 1; i < n; i++) {
      const [x, y] = pt(i / n), sw = Math.sin(time * 3 + i) * 2;
      if (lanterns && i % 2 === 0) { ctx.fillStyle = '#c8423b'; ctx.fillRect(x - 7, y + 2, 14, 18); ctx.fillStyle = '#ffd84a'; ctx.fillRect(x - 5, y + 5, 10, 12); if (night && i % 4 === 0) addLight(x, y + 10, 46, '255,180,90'); continue; }
      ctx.fillStyle = cols[i % cols.length]; ctx.beginPath(); ctx.moveTo(x - 9, y); ctx.lineTo(x + 9, y); ctx.lineTo(x + sw, y + 18); ctx.fill();
    }
  }
}
function festEntities(list) {
  if (area !== 'world') return;
  const hol = holidayToday();
  if (hol && hol.tree) list.push({ y: 2160, f: () => drawXmasTree(3720, 2160) });
  if (hol && hol.bonfire) list.push({ y: 2240, f: () => drawBonfire(3550, 2240) });
}
function drawFestGround(x0, y0, x1, y1) {
  const hol = holidayToday();
  if (hol) drawBunting(BUNTING, hol.key, x0, y0, x1, y1, hol.lanterns || lightAt().night > 0.3);
  for (const ci of cityFestToday()) if (Math.hypot(ci.x - player.x, ci.y - player.y) < ci.R + 600) drawBunting(cityBunting(ci), 'cidade', x0, y0, x1, y1, lightAt().night > 0.3);
}
function drawXmasTree(x, y) {
  shadow(x, y, 50, 14, 0.3);
  ctx.fillStyle = '#6b4626'; ctx.fillRect(x - 8, y - 30, 16, 30);
  for (let i = 0; i < 4; i++) { const w = 110 - i * 24, ty = y - 30 - i * 44; ctx.fillStyle = i % 2 ? '#2f7a3a' : '#276a32'; ctx.beginPath(); ctx.moveTo(x - w / 2, ty); ctx.lineTo(x + w / 2, ty); ctx.lineTo(x, ty - 70); ctx.fill(); }
  const cols = ['#ff5a6a', '#ffd84a', '#7be3ff', '#ffffff'];
  for (let i = 0; i < 16; i++) { const k = (hashStr('t' + i) >>> 0) % 1000 / 1000, ty = y - 40 - k * 170, half = (1 - k) * 46; const tx = x + ((hashStr('x' + i) >>> 0) % 100 / 50 - 1) * half; ctx.fillStyle = cols[(i + Math.floor(time * 2)) % 4]; ctx.beginPath(); ctx.arc(tx, ty, 4, 0, 7); ctx.fill(); }
  ctx.fillStyle = '#ffd84a'; ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, r = i % 2 ? 6 : 14; ctx.lineTo(x + Math.cos(a) * r, y - 236 + Math.sin(a) * r); } ctx.fill();
  if (lightAt().night > 0.2) { addLight(x, y - 120, 150, '255,220,140'); }
}
function drawBonfire(x, y) {
  ctx.fillStyle = '#5a3418'; ctx.fillRect(x - 40, y - 12, 80, 10); ctx.fillRect(x - 10, y - 24, 20, 20);
  for (let i = 0; i < 7; i++) { const k = Math.sin(time * 8 + i * 1.7); ctx.fillStyle = i % 2 ? '#ffb347' : '#ff7a2e'; ctx.beginPath(); ctx.moveTo(x - 30 + i * 10, y - 12); ctx.lineTo(x - 26 + i * 10, y - 70 - k * 18 - (3 - Math.abs(3 - i)) * 14); ctx.lineTo(x - 20 + i * 10, y - 12); ctx.fill(); }
  addLight(x, y - 40, 340, '255,160,70');
  if (Math.random() < 0.4) particles.push({ x: x + rand(-20, 20), y: y - 50, vx: rand(-15, 15), vy: rand(-110, -50), g: -10, t: 1.2, max: 1.2, col: '#ffd34a', s: 3 });
}
// fogos e estrelas cadentes por cima da noite
function drawFestOverlay() {
  if (!fireworks.length || area !== 'world') return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const f of fireworks) {
    const a = Math.max(0, f.t / f.max);
    if (f.star) { ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x - f.vx * 0.12, f.y - f.vy * 0.12); ctx.stroke(); continue; }
    if (f.glow) { const g = ctx.createRadialGradient(f.x, f.y, 4, f.x, f.y, 180); g.addColorStop(0, `rgba(255,240,200,${0.5 * a})`); g.addColorStop(1, 'rgba(255,240,200,0)'); ctx.fillStyle = g; ctx.fillRect(f.x - 180, f.y - 180, 360, 360); continue; }
    ctx.globalAlpha = a; ctx.fillStyle = f.col; ctx.fillRect(f.x - 6, f.y - 6, 12, 12); ctx.globalAlpha = a * 0.5; ctx.fillRect(f.x - f.vx * 0.06 - 4, f.y - f.vy * 0.06 - 4, 8, 8);
  }
  ctx.restore();
}
// bolo com velas na mesa durante uma festa de aniversário
function drawFestInterior() {
  const h = gameHour(), host = partyHostToday();
  const on = (host && area === host.home && h >= 18 && h < 21) || (area === 'casaKai' && isKaiBirthday() && h >= 19 && h < 22);
  if (!on) return;
  const t = interiorDef.furn.find(f => f.t === 'table'); if (!t) return;
  const x = (t.x + t.w / 2) * TILE, y = t.y * TILE + 18;
  ctx.fillStyle = '#f4e8d8'; ctx.fillRect(x - 20, y - 18, 40, 20); ctx.fillStyle = '#ff9ec7'; ctx.fillRect(x - 20, y - 22, 40, 7); ctx.fillStyle = '#c8423b'; ctx.fillRect(x - 3, y - 30, 6, 6);
  for (let i = -1; i <= 1; i++) { ctx.fillStyle = '#9ad1ff'; ctx.fillRect(x + i * 12 - 1, y - 34, 3, 10); ctx.fillStyle = Math.sin(time * 14 + i) > 0 ? '#ffd84a' : '#ffb347'; ctx.fillRect(x + i * 12 - 2, y - 40, 5, 6); addLight(x + i * 12, y - 38, 60, '255,210,120'); }
  label('Feliz aniversário!', x, y - 70, 15, '#ffd6e6', 0.9);
}

// ---------------------------------------------------------------- conversas na festa: dançar e prenda
const FEST_PRENDA = { flores: [['flor', 5]], verao: [['morango', 3]], lanterna: [['cristal', 1]], junina: [['torta', 2]], estrelas: [['cristal', 1]], vale: [['moeda', 50]], natal: [['torta', 1], ['pao', 2]], reveillon: [['moeda', 30]], anonovo: [['moeda', 30]] };
function festChoices(n) {
  const r = RES_BY_ID[n.id], hol = holidayToday(), F = festState(), out = [];
  if (!r || !hol || !(r.entry && r.entry.fest) || r.area !== 'world') return out;
  const yk = hol.key + ':' + calOf().y;
  if (!r.child && !r.kid && !(F.danced[yk] || []).includes(r.id)) out.push({ t: hol.key === 'junina' ? 'Quadrilha' : 'Dançar', fn: () => {
    (F.danced[yk] = F.danced[yk] || []).push(r.id); addFriend(r.id, 15); romanceGain(r.id, 3); r.hopT = 2; flash = 0.15; Audio.sfx('pick');
    remember(r.id, (hol.key === 'junina' ? 'Dançamos quadrilha' : 'Dançamos') + ' ' + (festArt(hol) === 'do' ? 'no' : 'na') + ' ' + hol.name + '.');
    say([r.name + ': ' + (hol.key === 'junina' ? 'Olha a cobra! É mentira! Hahaha!' : 'Que música boa! Você dança bem, Kai!')]); save();
  } });
  if (r.id === 'aurora' && !F.gifts[yk]) out.push({ t: 'Prenda da festa', fn: () => {
    F.gifts[yk] = true; const got = [];
    for (const [k, q] of FEST_PRENDA[hol.key] || []) { if (k === 'moeda') { S.coins += q; S.stats.earned += q; got.push(q + ' moedas'); } else { addItem(k, q); got.push(q + ' ' + NAMES[k].toLowerCase()); } }
    Audio.sfx('coin'); say(['Vó Aurora: Toma, Kai, uma lembrança ' + festArt(hol) + ' ' + hol.name + ': ' + got.join(' e ') + '.']); save();
  } });
  return out;
}
// presentes de Natal: amigos próximos dão uma lembrancinha ao conversar
function festGreeting(n) {
  const hol = holidayToday(), F = festState(), r = RES_BY_ID[n.id];
  if (!hol || hol.key !== 'natal' || !r || r.kid || hearts(r.id) < 4) return;
  const k = 'natal:' + calOf().y + ':' + r.id; if (F.gifts[k]) return;
  F.gifts[k] = true; const item = ['torta', 'flor', 'cristal', 'pao'][hashStr(r.id) & 3]; addItem(item, 1);
  setTimeout(() => toast(r.name + ' te deu ' + NAMES[item].toLowerCase() + ' de Natal!'), 300);
}

// ---------------------------------------------------------------- festa de cada cidade grande
function cityFestDate(c) { const doy = (hashStr('festa' + c.key) >>> 0) % 365; const t = new Date(Date.UTC(2027, 0, 1) + doy * DAY_MS); return [t.getUTCMonth(), t.getUTCDate()]; }
function cityFestToday(day = S.time.day) {
  const out = [], c = calOf(day);
  for (const key of Object.keys(S.cities || {})) { const [i, j] = key.split('_').map(Number), ci = cityAt(i, j); if (ci && sameDate(cityFestDate(ci), c)) out.push(ci); }
  const here = typeof inCity === 'function' && area === 'world' ? inCity(player.x, player.y, 300) : null;
  if (here && !out.includes(here) && sameDate(cityFestDate(here), c)) out.push(here);
  return out;
}
function cityFestNear() { return area === 'world' && cityFestToday().some(ci => Math.hypot(ci.x - player.x, ci.y - player.y) < ci.R + 400); }
function cityBunting(ci) {
  if (ci.bunting) return ci.bunting;
  const pts = []; for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; pts.push([ci.x + Math.cos(a) * 340, ci.y + Math.sin(a) * 220]); }
  ci.bunting = pts.map((p, i) => [p, pts[(i + 1) % 8]]).concat([[pts[0], pts[4]], [pts[2], pts[6]]]);
  return ci.bunting;
}
