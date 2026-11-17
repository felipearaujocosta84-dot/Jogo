/* Vale da Lanterna — Futebol de várzea.
   Campo na clareira a oeste da Vila do Rio, evento semanal de sexta (organização, convites, partida, conversas),
   amistosos, partidas 5 contra 5 jogáveis com física de bola, IA de jogadores e goleiros, atributos por morador,
   torcida que reage, consequências sociais, clima, recompensas, interface de toque e histórico salvo. */
'use strict';

// ---------------------------------------------------------------- campo
const FB = { x0: 420, y0: 930, x1: 1340, y1: 1490 };
FB.L = FB.x1 - FB.x0; FB.H = FB.y1 - FB.y0; FB.cx = (FB.x0 + FB.x1) / 2; FB.cy = (FB.y0 + FB.y1) / 2;
const FB_GH = 72, FB_BAR = 58, FB_DEPTH = 46, FB_BOX = [140, 160];
const FB_CLEAR = [[330, 830, 1430, 1650], [1420, 1150, 1830, 1320]];
const inFieldArea = (x, y, pad = 0) => x > FB.x0 - pad && x < FB.x1 + pad && y > FB.y0 - pad && y < FB.y1 + pad;
const FB_POSTS = [[FB.x0, FB.cy - FB_GH], [FB.x0, FB.cy + FB_GH], [FB.x1, FB.cy - FB_GH], [FB.x1, FB.cy + FB_GH]];
const TEAM_NAMES = ['Azul', 'Laranja'], TEAM_COLS = ['#4a90e2', '#f08a24'];

// lugares usados pelas rotinas dos moradores
PLACES.campo = { area: 'world', x: FB.cx, y: FB.cy, rect: [FB.L - 120, FB.H - 120] };
PLACES.campo_torcida = { area: 'world', x: FB.cx, y: FB.y1 + 112, rect: [FB.L - 160, 34], face: [0, -1] };
PLACES.campo_trilha = { area: 'world', x: 1600, y: 1240, spread: 10 };

// abre a clareira (sem mexer no resto do mapa), coloca traves, bancos, postes e placa
function footballInitWorld() {
  const inClear = (x, y) => FB_CLEAR.some(([a, b, c, d]) => x > a && x < c && y > b && y < d);
  const gone = props.filter(p => ['tree', 'rock', 'bush', 'tuft', 'flower', 'mush'].includes(p.t) && inClear(p.x, p.y));
  for (const p of gone) bucketRemove(p);
  // os cogumelos da clareira não somem: mudam para a mata em volta do campo (missão da Rosa continua igual)
  const R = mulberry(4242);
  for (const mu of gone.filter(p => p.t === 'mush')) {
    for (let k = 0; k < 60; k++) {
      const x = 180 + R() * 1450, y = 620 + R() * 1250;
      if (inClear(x, y) || inPlot(x, y, 20) || terrainAt(x, y) !== 0 || !worldWalk(x, y) || nearBuilding(x, y, 60)) continue;
      mu.x = x; mu.y = y; bucketAdd(mu); break;
    }
  }
  // devolve o chão onde havia árvores e pedras (só onde o terreno é andável)
  for (const [a, b, c, d] of FB_CLEAR) for (let y = b; y < d; y += CELL) for (let x = a; x < c; x += CELL) {
    const gx = Math.floor(x / CELL), gy = Math.floor(y / CELL), t = valeTer[gy * GC + gx];
    if (!BUILDINGS.some(B => Math.abs(B.x - x) < B.pw / 2 + 10 && y < B.y + 10 && y > B.y - B.ph)) valeGrid.m[gy * GC + gx] = (t === 2 || t === 6) ? 0 : 1;
  }
  const add = p => bucketAdd(Object.assign({ seed: Math.floor(p.x * 7 + p.y * 13) }, p));
  for (const side of [0, 1]) { add({ t: 'fb', k: 'goalTop', side, x: side ? FB.x1 : FB.x0, y: FB.cy - FB_GH }); add({ t: 'fb', k: 'goalBot', side, x: side ? FB.x1 : FB.x0, y: FB.cy + FB_GH }); }
  for (let x = FB.x0 + 120; x < FB.x1 - 60; x += 150) add({ t: 'deco', d: 'bench', x, y: FB.y1 + 96 });
  for (const [x, y] of [[FB.x0 - 46, FB.y0 - 40], [FB.x1 + 46, FB.y0 - 40], [FB.x0 - 46, FB.y1 + 70], [FB.x1 + 46, FB.y1 + 70]]) { add({ t: 'deco', d: 'lamp', x, y, block: 12 }); stampGrid(valeGrid, x, y - 6, 12, 0); }
  add({ t: 'deco', d: 'sign', x: 1480, y: 1330, text: 'Campo da Várzea', block: 8 }); stampGrid(valeGrid, 1480, 1324, 8, 0);
}

// ---------------------------------------------------------------- chão do campo (desenhado uma vez, pixel art)
let fbGround = null, FB_GRASS = [92, 158, 70];
const FBG = { x: 320, y: 820, w: 1520, h: 840, s: 4 };
function makeFieldGround() {
  FB_GRASS = groundRGB(FB.x0 + 60, FB.y0 + 60);
  const w = FBG.w / FBG.s, h = FBG.h / FBG.s, cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d'), img = g.createImageData(w, h), D = img.data;
  const inClear = (x, y) => FB_CLEAR.some(([a, b, c, d]) => x > a && x < c && y > b && y < d);
  const line = (x, y) => {
    const t = 5, nx = Math.abs(x - FB.x0) < t || Math.abs(x - FB.x1) < t, ny = Math.abs(y - FB.y0) < t || Math.abs(y - FB.y1) < t;
    if ((nx && y > FB.y0 - t && y < FB.y1 + t) || (ny && x > FB.x0 - t && x < FB.x1 + t)) return true;
    if (Math.abs(x - FB.cx) < t && y > FB.y0 && y < FB.y1) return true;
    if (Math.abs(Math.hypot(x - FB.cx, y - FB.cy) - 84) < t) return true;
    for (const [gx, dir] of [[FB.x0, 1], [FB.x1, -1]]) {
      const bx = gx + dir * FB_BOX[0];
      if (Math.abs(x - bx) < t && Math.abs(y - FB.cy) < FB_BOX[1]) return true;
      if (Math.abs(Math.abs(y - FB.cy) - FB_BOX[1]) < t && (x - gx) * dir > 0 && (x - gx) * dir < FB_BOX[0]) return true;
      if (Math.hypot(x - (gx + dir * 100), y - FB.cy) < 7) return true;
    }
    return Math.hypot(x - FB.cx, y - FB.cy) < 7;
  };
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const x = FBG.x + i * FBG.s + 2, y = FBG.y + j * FBG.s + 2, o = (j * w + i) * 4;
    if (!inClear(x, y)) continue;
    let [r, gg, b] = groundRGB(x, y);
    const pathY = 1245 + Math.sin(x * 0.012) * 10, onPath = x > FB.x1 + 20 && Math.abs(y - pathY) < 24 + vnoise(x * 0.05, 3) * 8;
    if (inFieldArea(x, y, 20)) {
      const gn = vnoise(x * 0.03, y * 0.03) * 14 - 7;
      r = FB_GRASS[0] + gn; gg = FB_GRASS[1] + gn * 1.3; b = FB_GRASS[2] + gn * 0.6;
      const stripe = Math.floor((x - FB.x0) / 70) % 2 ? 1.06 : 0.97;
      r *= stripe; gg *= stripe; b *= stripe;
      // terra batida: mais perto das traves e do meio, manchas irregulares
      const wear = vnoise(x * 0.012, y * 0.012) * 0.75 + vnoise(x * 0.05, y * 0.05) * 0.25
        + Math.max(0, 0.32 - Math.min(Math.abs(x - FB.x0), Math.abs(x - FB.x1)) / 420) * (Math.abs(y - FB.cy) < 150 ? 1.4 : 0.3)
        + Math.max(0, 0.18 - Math.hypot(x - FB.cx, y - FB.cy) / 700);
      if (wear > 0.66) { const k = vnoise(x * 0.2, y * 0.2) * 18; r = 150 + k; gg = 118 + k; b = 78 + k * 0.6; }
      else if (wear > 0.6) { r = (r + 150) / 2; gg = (gg + 125) / 2; b = (b + 80) / 2; }
      if (line(x, y) && vnoise(x * 0.08, y * 0.08) > 0.18) { r = 236; gg = 232; b = 214; }
    } else if (onPath) { const k = vnoise(x * 0.1, y * 0.1) * 16; r = 168 + k; gg = 130 + k; b = 84 + k * 0.5; }
    D[o] = r; D[o + 1] = gg; D[o + 2] = b; D[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return cv;
}
function drawFootballGround(x0, y0, x1, y1) {
  if (x1 < FBG.x || x0 > FBG.x + FBG.w || y1 < FBG.y || y0 > FBG.y + FBG.h) return;
  if (!fbGround) fbGround = makeFieldGround();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(fbGround, FBG.x, FBG.y, FBG.w, FBG.h);
  // campo molhado
  const wet = Math.max(S.weather ? S.weather.wet : 0, valeRaining() ? 0.5 : 0);
  if (wet > 0.05) { ctx.fillStyle = `rgba(40,58,80,${0.16 * wet})`; ctx.fillRect(FB.x0 - 20, FB.y0 - 20, FB.L + 40, FB.H + 40); }
  // anéis dos jogadores e posse de bola
  if (fbm && fbm.phase !== 'done') for (const p of fbm.players) {
    const own = fbm.ball.owner === p;
    ctx.strokeStyle = TEAM_COLS[p.team]; ctx.globalAlpha = own ? 1 : 0.9; ctx.lineWidth = own ? 6 : 4;
    ctx.beginPath(); ctx.ellipse(p.ref.x, p.ref.y + 2, 24, 9, 0, 0, 7); ctx.stroke();
    if (p.human) { ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fill(); }
  }
  ctx.globalAlpha = 1;
}
// traves com rede (dois pedaços para ordenar com quem está dentro do gol)
function drawFootballProp(p) {
  const dir = p.side ? 1 : -1, gx = p.x, top = FB.cy - FB_GH, bot = FB.cy + FB_GH, back = gx + dir * FB_DEPTH;
  const post = (x, y, h) => { ctx.fillStyle = '#f4f1e8'; ctx.fillRect(x - 4, y - h, 8, h); ctx.fillStyle = '#b9b4a6'; ctx.fillRect(x + 1, y - h, 3, h); };
  ctx.strokeStyle = 'rgba(240,240,235,0.55)'; ctx.lineWidth = 1.5;
  if (p.k === 'goalTop') {
    // rede do fundo e do teto
    ctx.beginPath();
    for (let y = top; y <= bot; y += 12) { ctx.moveTo(back, y - 40); ctx.lineTo(back, y); ctx.moveTo(gx, y - FB_BAR); ctx.lineTo(back, y - 40); }
    for (let k = 0; k <= 40; k += 10) { ctx.moveTo(back, top - k); ctx.lineTo(back, bot - k); }
    for (let k = 0; k <= 4; k++) { const t = k / 4; ctx.moveTo(gx + (back - gx) * t, top - FB_BAR + (FB_BAR - 40) * t); ctx.lineTo(gx + (back - gx) * t, bot - FB_BAR + (FB_BAR - 40) * t); }
    ctx.stroke();
    ctx.fillStyle = '#d8d3c4'; ctx.fillRect(back - 2, top - 40, 4, bot - top + 40);
    post(gx, top, FB_BAR);
    ctx.fillStyle = '#f4f1e8'; ctx.fillRect(gx - 4, top - FB_BAR - 3, 8, bot - top + 6);   // travessão
  } else {
    ctx.beginPath();
    for (let k = 0; k <= FB_DEPTH; k += 9) { ctx.moveTo(gx + dir * k, bot - FB_BAR + (FB_BAR - 40) * k / FB_DEPTH); ctx.lineTo(gx + dir * k, bot); }
    for (let k = 0; k <= 40; k += 10) { ctx.moveTo(gx, bot - k * FB_BAR / 40); ctx.lineTo(back, bot - k); }
    ctx.stroke();
    shadow(gx, bot, 8, 3, 0.3);
    post(gx, bot, FB_BAR);
    ctx.fillStyle = '#d8d3c4'; ctx.fillRect(back - 2, bot - 40, 4, 40);
  }
}

// ---------------------------------------------------------------- jogadores (atributos 1–10)
// spd velocidade · sht chute · ctl controle · sta resistência · pas passe · def defesa
const FB_ATTR = {
  joca: { spd: 9, sht: 8, ctl: 8, sta: 8, pas: 6, def: 4, tag: 'habilidoso' },
  iara: { spd: 8, sht: 7, ctl: 7, sta: 9, pas: 7, def: 5, tag: 'habilidosa' },
  leo: { spd: 7, sht: 5, ctl: 5, sta: 8, pas: 5, def: 9, tag: 'zagueiro duro' },
  bia: { spd: 6, sht: 6, ctl: 7, sta: 6, pas: 7, def: 5, tag: 'meia' },
  mel: { spd: 6, sht: 4, ctl: 6, sta: 6, pas: 8, def: 4, tag: 'boa de passe' },
  bruno: { spd: 4, sht: 6, ctl: 4, sta: 7, pas: 4, def: 8, tag: 'forte' },
  gil: { spd: 3, sht: 5, ctl: 6, sta: 3, pas: 8, def: 5, tag: 'veterano' },
  rosa: { spd: 5, sht: 5, ctl: 5, sta: 6, pas: 6, def: 6, gk: true, tag: 'goleira' },
  tome: { spd: 3, sht: 4, ctl: 4, sta: 4, pas: 4, def: 8, gk: true, tag: 'goleiro rabugento' },
  davi: { spd: 5, sht: 3, ctl: 3, sta: 5, pas: 4, def: 4, tag: 'iniciante' },
  nina: { spd: 4, sht: 3, ctl: 4, sta: 4, pas: 5, def: 3, tag: 'iniciante' }
};
const FB_ORGANIZER = 'joca';
function kaiAttr() {
  const b = Math.min(3, Math.floor((S.football.xp || 0) / 4));
  return { spd: 6 + b, sht: 5 + b, ctl: 5 + b, sta: 6 + b, pas: 5 + b, def: 5 + b };
}
const fbRating = a => Math.round((a.spd + a.sht + a.ctl + a.sta + a.pas + a.def) / 6 * 10) / 10;
const POP_TITLES = [[0, 'Novato'], [10, 'Boleiro'], [30, 'Craque da vila'], [60, 'Lenda da várzea']];
const popTitle = () => POP_TITLES.filter(([v]) => (S.football.pop || 0) >= v).pop()[1];
const FB_TROPHIES = {
  estreia: 'Estreia na várzea', gol1: 'Primeiro gol', vitoria1: 'Primeira vitória', hat: 'Hat-trick',
  craque: 'Craque da Várzea (5 vitórias)', artilheiro: 'Artilheiro (10 gols)', garcom: 'Garçom (5 assistências)', amigo: 'Amistoso entre amigos'
};

// ---------------------------------------------------------------- eventos (sexta e amistosos)
function fbCfg() { return S.football.cfg; }
const isFriday = d => weekday(d) === 'Sexta';
const holidayOn = d => { const c = calOf(d); return HOLIDAYS.some(h => h.s === c.season && h.d === c.dom); };
// devolve o evento do dia (cria a partida de sexta quando precisa)
function fbEvent(d = S.time.day, create = true) {
  const F = S.football, key = String(d);
  if (F.ev[key]) return F.ev[key];
  if (!isFriday(d) || !create) return isFriday(d) ? { day: d, kind: 'sexta', start: fbCfg().start, status: 'pendente', virtual: true } : null;
  // em dia de festa à noite, o jogo é mais cedo para não bater com a festa da praça (17h)
  const start = holidayOn(d) && fbCfg().start >= 16 ? 14 : fbCfg().start;
  return (F.ev[key] = { day: d, kind: 'sexta', start, host: FB_ORGANIZER, status: 'pendente', orgDone: false, invited: false });
}
const fbDone = ev => ['jogado', 'cancelado'].includes(ev.status);
const evStatusText = ev => ({ pendente: 'convite pendente', aceito: 'confirmado', recusado: 'você recusou', cancelado: 'cancelado (chuva)', jogado: 'jogado' }[ev.status] || ev.status);
// clima: tempestade ou chuva forte no horário cancela; chuva fraca molha o campo
function fbWeatherCheck(ev) {
  const w = weatherDay(ev.day), a = ev.start, b = ev.start + 1;
  const overlap = WET_TYPES.includes(w.type) && w.from < b && w.to > a;
  return { cancel: overlap && (w.type === 'tempestade' || w.power >= 0.8), wet: overlap };
}
// times: organizador monta os times equilibrados; com o Kai, ele entra no time Azul com quem convidou
function fbTeams(ev) {
  const withKai = ev.status === 'aceito';
  if (ev.teams && ev.teams.kai === withKai) return ev.teams;
  const pool = Object.keys(FB_ATTR).filter(id => RES_BY_ID[id] && !(S.walk && S.walk.id === id));
  const need = withKai ? 9 : 10;
  const h = id => (hashStr(id + ':' + ev.day) >>> 0) % 1000;
  let pick = pool.slice().sort((a, b) => h(a) - h(b)).slice(0, need);
  if (ev.host && !pick.includes(ev.host) && pool.includes(ev.host)) pick[pick.length - 1] = ev.host;
  // dois goleiros, se houver
  const gks = pool.filter(id => FB_ATTR[id].gk);
  for (const g of gks) if (!pick.includes(g) && pick.filter(id => FB_ATTR[id].gk).length < 2) { const i = pick.findIndex(id => !FB_ATTR[id].gk && id !== ev.host); if (i >= 0) pick[i] = g; }
  pick.sort((a, b) => fbRating(FB_ATTR[b]) - fbRating(FB_ATTR[a]));
  const A = [], B = [];
  if (withKai) A.push('kai');
  let sa = withKai ? fbRating(kaiAttr()) : 0, sb = 0;
  const gkList = pick.filter(id => FB_ATTR[id].gk), rest = pick.filter(id => !FB_ATTR[id].gk);
  if (gkList[0]) { A.push(gkList[0]); sa += fbRating(FB_ATTR[gkList[0]]); }
  if (gkList[1]) { B.push(gkList[1]); sb += fbRating(FB_ATTR[gkList[1]]); }
  if (withKai && ev.host && rest.includes(ev.host)) { A.push(ev.host); sa += fbRating(FB_ATTR[ev.host]); rest.splice(rest.indexOf(ev.host), 1); }
  for (const id of rest) { if ((A.length < 5 && sa <= sb) || B.length >= 5) { A.push(id); sa += fbRating(FB_ATTR[id]); } else { B.push(id); sb += fbRating(FB_ATTR[id]); } }
  ev.teams = { kai: withKai, a: A, b: B };
  return ev.teams;
}
const fbParticipants = ev => { const T = fbTeams(ev); return T.a.concat(T.b).filter(id => id !== 'kai'); };
function fbSpectators(ev) {
  const play = fbParticipants(ev);
  return RESIDENTS.filter(r => !play.includes(r.id) && !(r.kid && r.stage === 'bebe') && !(S.walk && S.walk.id === r.id) && (r.child || r.kid || (hashStr(r.id + ev.day) & 3) !== 0)).map(r => r.id);
}

// rotina: jogadores vão ao campo uma hora antes; torcida meia hora antes; depois do jogo ficam conversando
const FB_PLAY_E = Object.assign([0, 0, 'campo', 'talk'], { fb: true }), FB_WATCH_E = Object.assign([0, 0, 'campo_torcida', 'talk'], { fb: true });
function footballOverride(r, h) {
  if (!S.football) return null;
  const ev = fbEvent(S.time.day, false);
  if (!ev || ev.virtual || ev.status === 'cancelado' || !ev.orgDone) return null;
  if (h < ev.start - 1 || h >= ev.start + 1.5) return null;
  if (fbParticipants(ev).includes(r.id)) return FB_PLAY_E;
  if (h >= ev.start - 0.5 && fbSpectators(ev).includes(r.id)) return FB_WATCH_E;
  return null;
}

// ---------------------------------------------------------------- agenda do dia
let fbInviteQueue = null, fbWarned = {};
function footballTick(dt) {
  if (!S.football || mode !== 'play') return;
  const d = S.time.day, h = gameHour(), ev = fbEvent(d, isFriday(d));
  fbHopTick(dt);
  if (fbm) { fbLive(dt); return; }
  if (!ev || fbDone(ev)) return;
  if (!ev.orgDone && h >= ev.start - 6) {
    ev.orgDone = true;
    const w = fbWeatherCheck(ev);
    if (w.cancel) { ev.status = 'cancelado'; toast((ev.kind === 'sexta' ? 'Futebol de sexta' : 'Amistoso') + ' cancelado: previsão de chuva forte.'); return; }
    ev.wet = w.wet; fbTeams(ev);
    if (ev.kind === 'sexta' && h < ev.start) toast(RES_BY_ID[FB_ORGANIZER].name + ' está organizando o futebol de várzea às ' + ev.start + 'h.');
  }
  if (!ev.invited && ev.status === 'pendente' && h >= ev.start - 5 && h < ev.start) fbInviteQueue = ev;
  if (fbInviteQueue && !dialog && !menu && !work && !build && !fade && !showMap) { const q = fbInviteQueue; fbInviteQueue = null; q.invited = true; fbShowInvite(q); }
  if (ev.status === 'aceito' && h >= ev.start - 0.5 && !fbWarned[d]) { fbWarned[d] = true; toast('A partida começa às ' + ev.start + 'h no Campo da Várzea, a oeste da Vila do Rio.'); }
  if (h >= ev.start && ev.orgDone && ev.status !== 'cancelado') {
    const near = kaiNearField(900);
    if (ev.status === 'aceito' && !near && h < ev.start + 0.5) return;   // o pessoal espera até meia hora
    if (ev.status === 'aceito' && !near) { ev.status = 'pendente'; ev.noShow = true; ev.teams = null; }
    fbStart(ev, ev.status === 'aceito');
  }
}
const kaiNearField = r => area === 'world' && Math.hypot(player.x - FB.cx, player.y - FB.cy) < r;
function fbHostOf(ev) {
  if (ev.kind !== 'sexta') return ev.host;
  // convite vem do participante mais próximo do Kai (amizade), ou do organizador
  const ids = fbParticipants(ev).filter(id => npcMem(id).met || sm(id).friend > 0).sort((a, b) => sm(b).friend - sm(a).friend);
  return ids[0] || FB_ORGANIZER;
}
function fbShowInvite(ev) {
  const host = fbHostOf(ev), r = RES_BY_ID[host]; ev.host = host; ev.teams = null;
  const msg = ev.kind === 'sexta' ? 'Ei, Kai! Hoje tem futebol de várzea às ' + ev.start + 'h no campo, do lado oeste da Vila do Rio. Bora jogar no meu time?' : 'Kai, bora um amistoso hoje às ' + ev.start + 'h no campo?';
  const wet = ev.wet ? ' Vai estar molhado, mas dá jogo!' : '';
  say([r.name + ': ' + msg + wet], null, [
    { t: 'Aceitar', fn: () => { ev.status = 'aceito'; ev.teams = null; fbTeams(ev); addFriend(host, 5); say([r.name + ': Boa! Te espero lá às ' + ev.start + 'h.']); save(); } },
    { t: 'Hoje não dá', fn: () => { ev.status = 'recusado'; ev.teams = null; say([r.name + ': Sem problema! Fica pra próxima.']); save(); } }
  ]);
}
// conversas: entrar no jogo de hoje ou marcar amistoso
function footballChoices(n) {
  if (!S.football || !FB_ATTR[n.id]) return [];
  const out = [], ev = fbEvent(S.time.day, false), h = gameHour();
  if (ev && !ev.virtual && !fbDone(ev) && !fbm && h < ev.start + 0.5 && ev.status !== 'aceito' && ev.orgDone && fbParticipants(ev).concat([ev.host]).includes(n.id))
    out.push({ t: 'Futebol hoje', fn: () => { ev.status = 'aceito'; ev.teams = null; ev.noShow = false; fbTeams(ev); say([n.name + ': Aí sim! Às ' + ev.start + 'h no campo.']); save(); } });
  const soon = Object.values(S.football.ev).some(e => e.kind === 'amistoso' && !fbDone(e) && e.day >= S.time.day);
  if (!soon && sm(n.id).friend >= 300) out.push({ t: 'Amistoso', fn: () => fbScheduleFriendly(n.id, true) });
  return out;
}
function fbScheduleFriendly(id, asked) {
  let d = S.time.day + 1; while (isFriday(d) || holidayOn(d)) d++;
  const ev = S.football.ev[String(d)] = { day: d, kind: 'amistoso', start: 17, host: id, status: asked ? 'aceito' : 'pendente', orgDone: false, invited: !!asked };
  if (asked) { say([RES_BY_ID[id].name + ': Fechado! ' + (d === S.time.day + 1 ? 'Amanhã' : weekday(d)) + ', às 17h no campo. Vou chamar o pessoal.']); addFriend(id, 4); }
  save(); return ev;
}
// virada do dia: limpa eventos velhos e às vezes um amigo chama para um amistoso
function footballNewDay() {
  const F = S.football;
  for (const k of Object.keys(F.ev)) if (+k < S.time.day - 30) delete F.ev[k];
  fbWarned = {};
  const d = S.time.day;
  if (isFriday(d) || holidayOn(d) || F.ev[String(d)]) return;
  if (Object.values(F.ev).some(e => e.kind === 'amistoso' && !fbDone(e) && e.day >= d)) return;
  const friends = Object.keys(FB_ATTR).filter(id => RES_BY_ID[id] && sm(id).friend >= 300);
  if (friends.length && Math.random() < 0.2) {
    const id = friends[Math.floor(Math.random() * friends.length)];
    F.ev[String(d)] = { day: d, kind: 'amistoso', start: 17, host: id, status: 'pendente', orgDone: false, invited: false };
  }
}

// ---------------------------------------------------------------- partida
let fbm = null, fbRun = false, fbBubbles = [], fbQuitAsk = 0;
const fbPlaying = () => !!(fbm && fbm.withKai && fbm.phase !== 'done');
const fbFreeze = () => fbPlaying();
const HOME = { gk: [0.03, 0.5], d1: [0.24, 0.28], d2: [0.24, 0.72], mid: [0.47, 0.5], fwd: [0.68, 0.5] };
const ux = (team, u) => team === 0 ? FB.x0 + u * FB.L : FB.x1 - u * FB.L;
const uOf = (team, x) => team === 0 ? (x - FB.x0) / FB.L : (FB.x1 - x) / FB.L;
const oppGoalX = team => team === 0 ? FB.x1 : FB.x0, ownGoalX = team => team === 0 ? FB.x0 : FB.x1;
function fbStart(ev, withKai) {
  const T = fbTeams(ev), w = fbWeatherCheck(ev);
  ev.wet = w.wet || (S.weather && S.weather.wet > 0.3);
  const live = withKai || kaiNearField(1500);
  const players = [];
  [T.a, T.b].forEach((ids, team) => {
    const np = ids.filter(id => id !== 'kai');
    const gk = np.find(id => FB_ATTR[id].gk) || np.slice().sort((a, b) => FB_ATTR[b].def - FB_ATTR[a].def)[0];
    const field = np.filter(id => id !== gk).sort((a, b) => FB_ATTR[b].def - FB_ATTR[a].def);
    const roles = {}; roles[gk] = 'gk';
    const order = ids.includes('kai') ? ['d1', 'd2', 'fwd'] : ['d1', 'd2', 'mid', 'fwd'];
    if (ids.includes('kai')) roles.kai = 'mid';
    field.forEach((id, i) => { roles[id] = order[i] || 'mid'; });
    if (!ids.includes('kai')) { const f = field.slice().sort((a, b) => FB_ATTR[b].sht - FB_ATTR[a].sht)[0]; if (f && roles[f] !== 'fwd') { const o = Object.keys(roles).find(k => roles[k] === 'fwd'); if (o) roles[o] = roles[f]; roles[f] = 'fwd'; } }
    for (const id of ids) {
      const human = id === 'kai', ref = human ? player : RES_BY_ID[id];
      players.push({ id, team, role: roles[id], ref, at: human ? kaiAttr() : FB_ATTR[id], human, stam: 100, cd: 0, stun: 0, vx: 0, vy: 0, think: 0, tx: 0, ty: 0, sprint: false, touchCd: 0 });
    }
  });
  fbm = { ev, withKai, live, t: 0, dur: (fbCfg().minutes || 4) * 60, score: [0, 0], phase: 'kickoff', pt: 1.6, kick: 0, players,
    ball: { x: FB.cx, y: FB.cy, z: 0, vx: 0, vy: 0, vz: 0, owner: null, kickBy: null, kickT: 9, lastTeam: -1, passFrom: null, spin: 0 },
    scorers: [], kai: { goals: 0, assists: 0, passes: 0, tackles: 0, shots: 0 }, passTo: {}, tackled: {}, call: 0, wet: ev.wet, hold: 0, restart: null, mins: 0 };
  if (!live) { fbSimulate(fbm, 1); fbFinish(fbm); return; }
  for (const p of fbm.players) if (!p.human) { const r = p.ref; r.fbCtl = true; r.area = 'world'; r.steps = []; r.sleeping = false; }
  if (withKai) { menu = null; dialog = null; dog.x = FB.cx - 300; dog.y = FB.y1 + 130; }
  fbKickoff(0);
  whistle(2);
  if (withKai) toast('Partida começando! Você joga no time ' + TEAM_NAMES[0] + '.');
}
function fbKickoff(team) {
  const m = fbm; m.phase = 'kickoff'; m.pt = 1.2; m.kick = team; m.restart = null;
  const b = m.ball; Object.assign(b, { x: FB.cx, y: FB.cy, z: 0, vx: 0, vy: 0, vz: 0, owner: null, kickBy: null, kickT: 9, passFrom: null });
  for (const p of m.players) {
    let [u, v] = HOME[p.role]; u = Math.min(u, 0.44);
    if (p.team === team && p.role === (m.players.some(q => q.team === team && q.role === 'fwd') ? 'fwd' : 'mid')) { u = 0.49; v = 0.5; }
    p.ref.x = ux(p.team, u); p.ref.y = FB.y0 + v * FB.H; p.stun = 0;
    p.ref.fx = p.team === 0 ? 1 : -1; p.ref.fy = 0;
  }
}
const pdist = (p, x, y) => Math.hypot(p.ref.x - x, p.ref.y - y);
function fbSfx(k) {
  if (!Audio.ac || Audio.muted) return;
  if (k === 'kick') { Audio.noise(0.05, 0.14, 1200); Audio.tone(150, 0.07, 'square', 0.08, -40); }
  else if (k === 'post') Audio.tone(1300, 0.18, 'triangle', 0.09, -200);
  else if (k === 'cheer') { Audio.noise(1.4, 0.13, 900); Audio.noise(0.9, 0.08, 2600); }
  else if (k === 'ooh') Audio.tone(330, 0.5, 'sine', 0.06, -90);
}
function whistle(n) { if (!Audio.ac || Audio.muted) return; for (let i = 0; i < n; i++) Audio.tone(2650, i === n - 1 ? 0.35 : 0.16, 'square', 0.05, 0, i * 0.22); }
function kickBall(p, tx, ty, speed, loft, err) {
  const b = fbm.ball, a = Math.atan2(ty - b.y, tx - b.x) + (Math.random() - 0.5) * 2 * err;
  b.owner = null; b.vx = Math.cos(a) * speed; b.vy = Math.sin(a) * speed; b.vz = loft; b.z = Math.max(b.z, 1);
  b.kickBy = p; b.kickT = 0; b.lastTeam = p.team; b.passFrom = null; b.gkTried = null;
  fbm.hold = 0; fbSfx('kick');
}
function passTo(p, mate) {
  const b = fbm.ball, lx = mate.ref.x + mate.vx * 0.35, ly = mate.ref.y + mate.vy * 0.35, d = Math.hypot(lx - b.x, ly - b.y);
  const blocked = laneBlock(p, lx, ly) < 26;
  kickBall(p, lx, ly, clamp(d * 1.5 + 160, 260, 660), blocked ? 230 + d * 0.15 : 0, (11 - p.at.pas) * 0.013 * (fbm.wet ? 1.2 : 1));
  b.passFrom = p; fbm.passTo[p.id] = mate.id;
  if (p.human) fbm.kai.passes++;
}
function shoot(p, ty) {
  const gx = oppGoalX(p.team), gk = fbm.players.find(q => q.team !== p.team && q.role === 'gk');
  if (ty == null) ty = FB.cy + (gk && gk.ref.y < FB.cy ? 1 : -1) * (30 + Math.random() * 32);
  kickBall(p, gx, ty, 520 + p.at.sht * 22, 60 + Math.random() * 150, (12 - p.at.sht) * 0.03 * (fbm.wet ? 1.15 : 1));
  if (p.human) fbm.kai.shots++;
}
// menor distância de um adversário à linha de passe
function laneBlock(p, tx, ty) {
  let best = 999;
  const ax = p.ref.x, ay = p.ref.y, dx = tx - ax, dy = ty - ay, L2 = dx * dx + dy * dy || 1;
  for (const q of fbm.players) if (q.team !== p.team) {
    const t = clamp(((q.ref.x - ax) * dx + (q.ref.y - ay) * dy) / L2, 0, 1);
    best = Math.min(best, Math.hypot(ax + dx * t - q.ref.x, ay + dy * t - q.ref.y));
  }
  return best;
}
function bestPass(p, aim) {
  let best = null;
  for (const q of fbm.players) if (q.team === p.team && q !== p) {
    const d = pdist(q, p.ref.x, p.ref.y); if (d < 50 || d > 560) continue;
    const open = Math.min(laneBlock(p, q.ref.x, q.ref.y), 90) / 90, fwd = uOf(p.team, q.ref.x) - uOf(p.team, p.ref.x);
    let s = open + fwd * 1.2 - d / 1400 + (q.role === 'gk' ? -0.6 : 0);
    if (aim) { const dot = ((q.ref.x - p.ref.x) * aim[0] + (q.ref.y - p.ref.y) * aim[1]) / d; s += dot * 1.6; }
    if (!best || s > best.s) best = { q, s };
  }
  return best;
}
function tackle(p, o) {
  if (!o || p.cd > 0 || pdist(o, p.ref.x, p.ref.y) > 30) return false;
  p.cd = p.role === 'gk' ? 0.7 : 1.1;
  const gkSmother = p.role === 'gk' && Math.abs(o.ref.x - ownGoalX(p.team)) < FB_BOX[0];
  const ch = clamp((gkSmother ? 0.55 : 0.38) + (p.at.def - o.at.ctl) * 0.05 - (fbm.wet ? 0.05 : 0), 0.15, 0.85);
  const key = p.human ? 'kai>' + o.id : o.human ? p.id + '>kai' : null;
  if (Math.random() < ch) {
    const b = fbm.ball, dir = p.team === 0 ? 1 : -1;
    b.owner = null; b.vx = dir * (120 + Math.random() * 80) + (Math.random() - 0.5) * 120; b.vy = (Math.random() - 0.5) * 160; b.kickBy = o; b.kickT = 0; b.lastTeam = o.team;
    o.stun = 0.55; fbm.hold = 0; fbSfx('kick');
    if (key) { fbm.tackled[key] = (fbm.tackled[key] || 0) + 1; if (p.human) fbm.kai.tackles++; }
    return true;
  }
  p.stun = 0.6;
  return false;
}
// ---------------------------------------------------------------- inteligência artificial
function aiThink(p) {
  const m = fbm, b = m.ball, own = b.owner, dir = p.team === 0 ? 1 : -1;
  const home = HOME[p.role], bu = uOf(p.team, b.x), bv = (b.y - FB.y0) / FB.H;
  const homeAt = (du = 0) => [ux(p.team, clamp(home[0] + (bu - 0.5) * 0.45 + du, 0.04, 0.9)), FB.y0 + clamp(home[1] + (bv - 0.5) * 0.35, 0.08, 0.92) * FB.H];
  p.sprint = false;
  if (p.role === 'gk') return gkThink(p);
  if (own === p) {
    const gx = oppGoalX(p.team), dg = Math.hypot(gx - p.ref.x, FB.cy - p.ref.y);
    const press = Math.min(...m.players.filter(q => q.team !== p.team).map(q => pdist(q, p.ref.x, p.ref.y)));
    const kai = m.players.find(q => q.human);
    if (m.call > 0 && kai && kai.team === p.team && laneBlock(p, kai.ref.x, kai.ref.y) > 22) { passTo(p, kai); m.call = 0; return; }
    if (dg < 170 + p.at.sht * 12 && (laneBlock(p, gx, FB.cy) > 24 || Math.random() < 0.2)) { shoot(p); return; }
    const bp = bestPass(p);
    if (bp && ((press < 55 && Math.random() < 0.35 + p.at.pas * 0.05) || (m.hold > 2.6 - p.at.pas * 0.12 && bp.s > 0.25) || (bp.s > 0.9 && Math.random() < p.at.pas * 0.025))) { passTo(p, bp.q); return; }
    // conduzir para o gol desviando do marcador
    let tx = gx, ty = FB.cy + (p.ref.y - FB.cy) * 0.5;
    const near = m.players.filter(q => q.team !== p.team).sort((a, c) => pdist(a, p.ref.x, p.ref.y) - pdist(c, p.ref.x, p.ref.y))[0];
    if (near && pdist(near, p.ref.x, p.ref.y) < 110 && (near.ref.x - p.ref.x) * dir > 0) ty = p.ref.y + (p.ref.y > near.ref.y ? 1 : -1) * 140;
    const d = Math.hypot(tx - p.ref.x, ty - p.ref.y) || 1;
    p.tx = p.ref.x + (tx - p.ref.x) / d * 90; p.ty = p.ref.y + (ty - p.ref.y) / d * 90;
    p.sprint = p.stam > 40 && press < 120;
    return;
  }
  const mates = m.players.filter(q => q.team === p.team && q.role !== 'gk' && !q.human);
  const rank = target => mates.slice().sort((a, c) => pdist(a, target[0], target[1]) - pdist(c, target[0], target[1])).indexOf(p);
  if (own && own.team === p.team) {
    [p.tx, p.ty] = homeAt(p.role === 'fwd' ? 0.14 : p.role === 'mid' ? 0.08 : 0.04);
    if (pdist(own, p.tx, p.ty) < 90) p.ty += (p.ty > own.ref.y ? 1 : -1) * 90;
  } else if (own) {
    const r = rank([own.ref.x, own.ref.y]);
    if (r === 0 || (r === 1 && pdist(own, p.ref.x, p.ref.y) < 170)) {
      const gx = ownGoalX(p.team);
      p.tx = own.ref.x + (gx - own.ref.x) * 0.08; p.ty = own.ref.y + (FB.cy - own.ref.y) * 0.08; p.sprint = p.stam > 30;
    } else [p.tx, p.ty] = homeAt(-0.08);
  } else {
    const fx = b.x + b.vx * 0.3, fy = b.y + b.vy * 0.3;
    if (rank([fx, fy]) === 0 || (m.restart && m.restart.team === p.team && rank([b.x, b.y]) === 0)) { p.tx = fx; p.ty = fy; p.sprint = p.stam > 25; }
    else [p.tx, p.ty] = homeAt();
  }
  if (m.restart && m.restart.team !== p.team && Math.hypot(p.tx - b.x, p.ty - b.y) < 80) { const a = Math.atan2(p.ty - b.y, p.tx - b.x); p.tx = b.x + Math.cos(a) * 85; p.ty = b.y + Math.sin(a) * 85; }
}
function gkThink(p) {
  const m = fbm, b = m.ball, gx = ownGoalX(p.team), dir = p.team === 0 ? 1 : -1;
  if (b.owner === p) {
    if (m.hold > 0.9) { const bp = bestPass(p); if (bp && bp.s > -0.2) passTo(p, bp.q); else kickBall(p, FB.cx + dir * 120, FB.cy + (Math.random() - 0.5) * 300, 620, 260, 0.08); }
    p.tx = p.ref.x; p.ty = p.ref.y; return;
  }
  let ty = FB.cy + clamp((b.y - FB.cy) * 0.45, -FB_GH + 8, FB_GH - 8), tx = gx + dir * 26;
  const toward = (b.vx * -dir) > 200;
  if (toward && !b.owner) { const t = (gx - b.x) / (b.vx || 1); if (t > 0 && t < 1.2) { ty = clamp(b.y + b.vy * t, FB.cy - FB_GH - 10, FB.cy + FB_GH + 10); p.sprint = true; } }
  const inBox = Math.abs(b.x - gx) < FB_BOX[0] && Math.abs(b.y - FB.cy) < FB_BOX[1];
  if (inBox && !b.owner && Math.hypot(b.vx, b.vy) < 380) {
    const opp = Math.min(...m.players.filter(q => q.team !== p.team).map(q => pdist(q, b.x, b.y)));
    if (pdist(p, b.x, b.y) < opp + 30) { tx = b.x; ty = b.y; p.sprint = true; }
  }
  if (b.owner && b.owner.team !== p.team && inBox && pdist(b.owner, p.ref.x, p.ref.y) < 120) { tx = b.owner.ref.x; ty = b.owner.ref.y; p.sprint = true; tackle(p, b.owner); }
  p.tx = tx; p.ty = ty;
}
// ---------------------------------------------------------------- simulação ao vivo
function fbLive(dt) {
  const m = fbm;
  if (menu || showMap || (m.withKai && dialog)) return;
  // espectador que se afastou: o resto do jogo é calculado
  if (!m.withKai && !kaiNearField(2600) && m.phase !== 'done') { fbSimulate(m, Math.max(0, 1 - m.t / m.dur)); fbFinish(m); return; }
  if (m.phase === 'done') return;
  m.pt -= dt;
  if (m.phase === 'kickoff') {
    if (m.pt <= 0) { m.phase = 'play'; const k = m.players.find(p => p.team === m.kick && Math.hypot(p.ref.x - FB.cx, p.ref.y - FB.cy) < 60) || m.players.find(p => p.team === m.kick && p.role !== 'gk'); m.ball.owner = k; m.hold = 0; }
    fbAnimate(dt, true); return;
  }
  if (m.phase === 'goal') {
    for (const p of m.players) if (!p.human) { const [u, v] = HOME[p.role]; p.tx = ux(p.team, Math.min(u, 0.44)); p.ty = FB.y0 + v * FB.H; p.sprint = false; }
    fbMove(dt); fbBall(dt, true); fbAnimate(dt);
    if (m.pt <= 0) fbKickoff(m.kick);
    return;
  }
  if (m.phase === 'end') { fbAnimate(dt, true); if (m.pt <= 0) fbFinish(m); return; }
  m.t += dt; m.hold += dt; m.call = Math.max(0, m.call - dt);
  if (m.t >= m.dur) { m.phase = 'end'; m.pt = 3; whistle(3); m.ball.owner = null; m.ball.vx *= 0.2; m.ball.vy *= 0.2; return; }
  for (const p of m.players) {
    p.cd = Math.max(0, p.cd - dt); p.stun = Math.max(0, p.stun - dt); p.touchCd = Math.max(0, p.touchCd - dt);
    if (p.human) continue;
    if ((p.think -= dt) <= 0) { p.think = 0.18 + Math.random() * 0.1; if (p.stun <= 0) aiThink(p); }
    const own = m.ball.owner;
    if (own && own.team !== p.team && p.stun <= 0 && p.role !== 'gk' && pdist(own, p.ref.x, p.ref.y) < 26 && Math.random() < dt * 3) tackle(p, own);
  }
  fbMove(dt);
  fbBall(dt);
  fbAnimate(dt);
  fbChatter();
}
function fbMove(dt) {
  const m = fbm;
  for (const p of m.players) {
    if (p.human) continue;
    const r = p.ref, dx = p.tx - r.x, dy = p.ty - r.y, d = Math.hypot(dx, dy);
    const run = p.sprint && p.stam > 12;
    let sp = (p.role === 'gk' ? 200 + p.at.def * 10 : run ? 190 + p.at.spd * 11 : 120 + p.at.spd * 7) * (m.ball.owner === p ? 0.88 : 1) * (m.wet ? 0.94 : 1) * (p.stun > 0 ? 0.25 : 1);
    sp *= 0.75 + p.stam / 400;
    p.stam = clamp(p.stam + (run ? -(13 - p.at.sta) * 1.6 : 7) * dt, 0, 100);
    if (d > 5) { const v = Math.min(sp, d * 6); p.vx = dx / d * v; p.vy = dy / d * v; r.fx = dx / d; r.fy = dy / d; }
    else { p.vx = 0; p.vy = 0; const b = m.ball, bd = Math.hypot(b.x - r.x, b.y - r.y) || 1; r.fx = (b.x - r.x) / bd; r.fy = (b.y - r.y) / bd; }
    r.x += p.vx * dt; r.y += p.vy * dt;
    p.running = run && d > 5;
  }
  // separação entre jogadores
  for (let i = 0; i < m.players.length; i++) for (let j = i + 1; j < m.players.length; j++) {
    const a = m.players[i].ref, c = m.players[j].ref, dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy);
    if (d > 0.1 && d < 24) { const k = (24 - d) / 2; if (!m.players[i].human) { a.x -= dx / d * k; a.y -= dy / d * k; } if (!m.players[j].human) { c.x += dx / d * k; c.y += dy / d * k; } }
  }
  for (const p of m.players) { p.ref.x = clamp(p.ref.x, FB.x0 - 40, FB.x1 + 40); p.ref.y = clamp(p.ref.y, FB.y0 - 30, FB.y1 + 30); }
}
function fbAnimate(dt, still) {
  for (const p of fbm.players) {
    const r = p.ref, mv = !still && Math.hypot(p.vx, p.vy) > 12;
    if (p.human) continue;
    r.moving = false; r.sleeping = false;
    r.anim = mv ? (p.running ? 'run' : 'walk') : (fbm.phase === 'goal' && fbm.lastScorer === p) ? 'talk' : 'idle';
  }
}
function fbBall(dt, noRules) {
  const m = fbm, b = m.ball;
  b.kickT += dt;
  if (b.owner) {
    const o = b.owner.ref, fx = o.fx || 0, fy = o.fy || 0;
    b.x += (o.x + fx * 20 - b.x) * Math.min(1, dt * 14); b.y += (o.y + fy * 10 + 4 - b.y) * Math.min(1, dt * 14);
    b.z = 0; b.vx = b.owner.vx; b.vy = b.owner.vy; b.vz = 0;
    b.spin += Math.hypot(b.vx, b.vy) * dt * 0.08;
    return;
  }
  const px = b.x;
  b.x += b.vx * dt; b.y += b.vy * dt;
  if (b.z > 0 || b.vz > 0) {
    b.vz -= 980 * dt; b.z += b.vz * dt;
    if (b.z <= 0) { b.z = 0; if (b.vz < -110) { b.vz = -b.vz * 0.42; b.vx *= 0.86; b.vy *= 0.86; } else b.vz = 0; }
    const k = Math.exp(-0.15 * dt); b.vx *= k; b.vy *= k;
  } else { const k = Math.exp(-(m.wet ? 0.85 : 1.25) * dt); b.vx *= k; b.vy *= k; }
  b.spin += Math.hypot(b.vx, b.vy) * dt * 0.08;
  // traves
  for (const [qx, qy] of FB_POSTS) {
    const dx = b.x - qx, dy = b.y - qy, d = Math.hypot(dx, dy);
    if (d < 9 && b.z < FB_BAR) { const nx = dx / (d || 1), ny = dy / (d || 1), vn = b.vx * nx + b.vy * ny; if (vn < 0) { b.vx -= 1.6 * vn * nx; b.vy -= 1.6 * vn * ny; b.x = qx + nx * 9; b.y = qy + ny * 9; fbSfx('post'); fbReact('ooh'); } }
  }
  // travessão
  for (const gx of [FB.x0, FB.x1]) if ((px - gx) * (b.x - gx) <= 0 && Math.abs(b.y - FB.cy) < FB_GH && b.z > FB_BAR - 6 && b.z < FB_BAR + 8) { b.vx = -b.vx * 0.5; b.x = px; fbSfx('post'); fbReact('ooh'); }
  // dentro do gol: a rede segura a bola
  for (const [gx, s] of [[FB.x0, -1], [FB.x1, 1]]) if ((b.x - gx) * s > 0 && Math.abs(b.y - FB.cy) < FB_GH && b.z < FB_BAR) {
    if ((b.x - gx) * s > FB_DEPTH - 6) { b.x = gx + s * (FB_DEPTH - 6); b.vx *= -0.2; b.vy *= 0.4; }
  }
  if (noRules) return;
  // gol? (cruzou a linha entre as traves e abaixo do travessão)
  for (const [gx, s, team] of [[FB.x0, -1, 1], [FB.x1, 1, 0]]) if ((px - gx) * s <= 0 && (b.x - gx) * s > 0 && Math.abs(b.y - FB.cy) < FB_GH && b.z < FB_BAR) { fbGoal(team); return; }
  // saiu pela lateral ou pela linha de fundo (inclusive por cima do travessão)
  if (b.y < FB.y0 - 4 || b.y > FB.y1 + 4) { fbRestart(1 - Math.max(0, b.lastTeam), clamp(b.x, FB.x0 + 20, FB.x1 - 20), b.y < FB.y0 ? FB.y0 + 6 : FB.y1 - 6); return; }
  for (const [gx, s, defTeam] of [[FB.x0, -1, 0], [FB.x1, 1, 1]]) if ((b.x - gx) * s > 4 && (Math.abs(b.y - FB.cy) >= FB_GH || ((px - gx) * s <= 4 && b.z >= FB_BAR) || (b.x - gx) * s > FB_DEPTH + 10)) {
    if (b.lastTeam === defTeam) fbRestart(1 - defTeam, gx - s * 8, b.y < FB.cy ? FB.y0 + 8 : FB.y1 - 8);   // escanteio
    else { const gk = m.players.find(p => p.team === defTeam && p.role === 'gk'); fbRestart(defTeam, gx - s * 70, FB.cy, gk); }   // tiro de meta
    return;
  }
  // domínio, interceptação e defesa do goleiro
  if (b.z > 34) return;
  const sp = Math.hypot(b.vx, b.vy);
  const cand = m.players.filter(p => p.stun <= 0 && p.touchCd <= 0 && !(b.kickBy === p && b.kickT < 0.3)).sort((a, c) => pdist(a, b.x, b.y) - pdist(c, b.x, b.y));
  for (const p of cand) {
    const gkBox = p.role === 'gk' && Math.abs(b.x - ownGoalX(p.team)) < FB_BOX[0] && Math.abs(b.y - FB.cy) < FB_BOX[1];
    const reach = gkBox ? 26 + p.at.def * 1.3 : 17, d = pdist(p, b.x, b.y);
    if (d > reach) break;
    let ok;
    if (gkBox && b.gkTried !== p) {
      b.gkTried = p;
      ok = Math.random() < (sp < 300 ? 0.98 : clamp(0.55 + p.at.def * 0.05 - (sp > 700 ? 0.12 : 0) - (m.wet ? 0.08 : 0), 0.2, 0.95));
      if (ok && sp > 650 && Math.random() < 0.45) { const s = p.team === 0 ? 1 : -1; b.vx = s * 260; b.vy = (b.y < FB.cy ? -1 : 1) * 320; b.vz = 160; b.kickBy = p; b.kickT = 0; b.lastTeam = p.team; fbSfx('kick'); fbReact('save'); return; }
      if (ok) fbReact('save'); else { p.touchCd = 0.5; continue; }
    } else ok = Math.random() < (sp < 220 ? 0.96 : sp < 520 ? 0.32 + p.at.ctl * 0.06 : 0.08 + p.at.ctl * 0.045) * (m.wet ? 0.85 : 1);
    if (ok) { fbGain(p); return; }
    p.touchCd = 0.35; b.vx = b.vx * 0.55 + (Math.random() - 0.5) * 140; b.vy = b.vy * 0.55 + (Math.random() - 0.5) * 140; b.kickBy = p; b.kickT = 0; b.lastTeam = p.team;
    return;
  }
}
function fbGain(p) {
  const m = fbm, b = m.ball, from = b.passFrom;
  if (from && from.team === p.team && from !== p) {
    m.lastPass = { from, to: p, t: m.t };
    if (from.human && !p.human) { const n = (m.passTo['ok:' + p.id] = (m.passTo['ok:' + p.id] || 0) + 1); if (n <= 5) addFriend(p.id, 3); }
  }
  b.owner = p; b.passFrom = null; b.vz = 0; b.z = 0; b.lastTeam = p.team; m.hold = 0; m.restart = null;
}
function fbRestart(team, x, y, taker) {
  const m = fbm, b = m.ball;
  Object.assign(b, { x, y, z: 0, vx: 0, vy: 0, vz: 0, owner: null, passFrom: null, kickBy: null, kickT: 9 });
  const t = taker || m.players.filter(p => p.team === team && p.role !== 'gk').sort((a, c) => pdist(a, x, y) - pdist(c, x, y))[0];
  m.restart = { team };
  if (t && !t.human) { t.ref.x = x - (t.team === 0 ? 14 : -14); t.ref.y = y; fbGain(t); m.hold = 0; }
  else if (t && t.human) { player.x = x; player.y = y; fbGain(t); }
}
function fbGoal(team) {
  const m = fbm, b = m.ball, scorer = b.kickBy && b.kickBy.team === team ? b.kickBy : null;
  m.score[team]++;
  const min = Math.max(1, Math.round(m.t / m.dur * 40));
  const lp = m.lastPass, assist = scorer && lp && lp.to === scorer && m.t - lp.t < 8 ? lp.from : null;
  m.scorers.push({ id: scorer ? scorer.id : null, team, min, assist: assist ? assist.id : null, own: !scorer });
  if (scorer && scorer.human) m.kai.goals++;
  if (assist && assist.human) m.kai.assists++;
  m.lastScorer = scorer; m.phase = 'goal'; m.pt = 2.8; m.kick = 1 - team; b.owner = null; b.vx *= 0.2; b.vy *= 0.2;
  whistle(1); fbSfx('cheer');
  const name = scorer ? (scorer.human ? 'Kai' : RES_BY_ID[scorer.id].name) : 'Gol contra';
  if (m.withKai || kaiNearField(1800)) banner = { text: 'GOOOL! ' + name, sub: TEAM_NAMES[0] + ' ' + m.score[0] + ' × ' + m.score[1] + ' ' + TEAM_NAMES[1], t: 2.6 };
  if (scorer && !scorer.human) fbHop(scorer.ref, 2.2);
  fbReact('goal', team, scorer);
}
// torcida e jogadores reagem
function fbHop(r, t) { r.hopT = t; }
function fbHopTick(dt) {
  for (const r of RESIDENTS) { if (r.hopT > 0) { r.hopT -= dt; r.hopZ = Math.abs(Math.sin(r.hopT * 11)) * 16; } else r.hopZ = 0; }
  for (const bb of fbBubbles) bb.t -= dt;
  fbBubbles = fbBubbles.filter(bb => bb.t > 0);
}
function fbSay(r, text, t = 2.2) { if (r && r.area === 'world') fbBubbles.push({ r, text, t }); }
function fbReact(kind, team, scorer) {
  const m = fbm; if (!m) return;
  const fans = RESIDENTS.filter(r => !r.fbCtl && r.area === 'world' && Math.hypot(r.x - FB.cx, r.y - (FB.y1 + 100)) < 600);
  if (kind === 'goal') {
    const sid = scorer ? scorer.id : null;
    fans.forEach((r, i) => {
      const friendOf = sid === 'kai' ? sm(r.id).friend >= 200 : sid && (SOCIAL[r.id] && (sm(r.id).friend >= 0) && (hashStr(r.id + sid) & 1));
      if (i % 2 === 0 || friendOf) { fbHop(r, 1.6 + Math.random()); fbSay(r, sid === 'kai' && friendOf ? 'Isso, Kai!' : ['Gooool!', 'Uhuuul!', 'Que golaço!', 'É gol!'][i % 4]); }
    });
    for (const p of m.players) if (!p.human && p.team === team) fbHop(p.ref, 1.2);
  } else if (kind === 'save') { fbSfx('ooh'); const r = fans[Math.floor(Math.random() * fans.length)]; fbSay(r, ['Que defesa!', 'Uuuh!', 'Pegou!'][Math.floor(Math.random() * 3)]); }
  else if (kind === 'ooh') { const r = fans[Math.floor(Math.random() * fans.length)]; fbSay(r, 'Na trave!'); }
}
// conversas da torcida durante o jogo
function fbChatter() {
  const m = fbm; if (!m || m.phase !== 'play' || Math.random() > 0.006) return;
  const fans = RESIDENTS.filter(r => !r.fbCtl && r.area === 'world' && Math.hypot(r.x - FB.cx, r.y - (FB.y1 + 100)) < 600);
  if (!fans.length) return;
  const r = fans[Math.floor(Math.random() * fans.length)], own = m.ball.owner;
  const lines = ['Vai, ' + TEAM_NAMES[Math.random() < 0.5 ? 0 : 1] + '!', 'Passa a bola!', 'Olha o ladrão!', 'Chuta!'];
  if (own && own.human && sm(r.id).friend >= 200) lines.push('Vai, Kai!', 'Isso, Kai!');
  if (own && !own.human && (hashStr(r.id + own.id) & 3) === 0) lines.push('Vai, ' + RES_BY_ID[own.id].name + '!');
  fbSay(r, lines[Math.floor(Math.random() * lines.length)], 1.8);
}
// ---------------------------------------------------------------- controle do Kai
function fbHuman(dt, busy) {
  const m = fbm, p = m.players.find(q => q.human);
  if (!p || busy || m.phase === 'end') { player.moving = false; p && (p.vx = p.vy = 0); return; }
  const frozen = m.phase === 'kickoff';
  const [mx, my] = frozen ? [0, 0] : readMove(), mag = Math.hypot(mx, my);
  const run = (fbRun || input.keys['shift']) && p.stam > 10 && mag > 0.1;
  const sp = (run ? 200 + p.at.spd * 10 : 135 + p.at.spd * 6) * (m.ball.owner === p ? 0.9 : 1) * (m.wet ? 0.94 : 1) * (p.stun > 0 ? 0.3 : 1) * (0.78 + p.stam / 450);
  p.stam = clamp(p.stam + (run ? -(13 - p.at.sta) * 1.5 : 8) * dt, 0, 100);
  player.moving = mag > 0.1; player.running = run;
  if (player.moving) {
    const L = mag; player.fx = mx / L; player.fy = my / L;
    player.dir = Math.abs(mx) > Math.abs(my) * 1.1 ? (mx < 0 ? 'left' : 'right') : (my < 0 ? 'up' : 'down');
    p.vx = mx * sp; p.vy = my * sp;
    player.x = clamp(player.x + p.vx * dt, FB.x0 - 40, FB.x1 + 40); player.y = clamp(player.y + p.vy * dt, FB.y0 - 30, FB.y1 + 30);
    player.anim += dt * (run ? 11 : 7.5);
  } else { p.vx = 0; p.vy = 0; player.anim = 0; }
}
function fbButton(kind) {
  const m = fbm; if (!fbPlaying() || m.phase !== 'play') return;
  const p = m.players.find(q => q.human), b = m.ball;
  const aim = Math.hypot(player.fx, player.fy) > 0.1 ? [player.fx, player.fy] : [p.team === 0 ? 1 : -1, 0];
  if (kind === 'shoot') {
    if (b.owner === p) {
      const gx = oppGoalX(p.team), dir = p.team === 0 ? 1 : -1;
      if (aim[0] * dir > 0.25) { const ty = p.ref.y + aim[1] / aim[0] * (gx - p.ref.x); shoot(p, clamp(ty, FB.cy - FB_GH + 6, FB.cy + FB_GH - 6)); }
      else kickBall(p, p.ref.x + aim[0] * 500, p.ref.y + aim[1] * 500, 640 + p.at.sht * 20, 120, (11 - p.at.sht) * 0.02);
    } else if (b.owner && b.owner.team !== p.team && pdist(b.owner, player.x, player.y) < 44) tackle(p, b.owner);
    else if (!b.owner && pdist(p, b.x, b.y) < 30) { fbGain(p); }
    else if (p.cd <= 0) { p.cd = 0.5; player.x += aim[0] * 26; player.y += aim[1] * 26; }   // bote
  } else if (kind === 'pass') {
    if (b.owner === p) { const bp = bestPass(p, aim); if (bp) passTo(p, bp.q); }
    else { m.call = 2.2; fbBubbleKai = 1.6; }
  }
}
let fbBubbleKai = 0;
function fbQuit() {
  const m = fbm; if (!m) return;
  m.withKai = false; m.kaiLeft = true;
  fbSimulate(m, Math.max(0, 1 - m.t / m.dur)); fbFinish(m);
  toast('Você saiu da partida. Sem problemas!');
}
// ---------------------------------------------------------------- resultado estimado (quando ninguém está assistindo)
function fbSimulate(m, frac) {
  if (frac <= 0) return;
  const str = team => { const ps = m.players.filter(p => p.team === team); const att = ps.reduce((s, p) => s + p.at.sht + p.at.ctl + p.at.pas + p.at.spd, 0) / ps.length / 4; const gk = ps.find(p => p.role === 'gk'); const def = ps.reduce((s, p) => s + p.at.def, 0) / ps.length * 0.6 + (gk ? gk.at.def : 5) * 0.4; return { att, def }; };
  const A = str(0), B = str(1);
  const pois = l => { let k = 0, p = Math.exp(-l), s = p, u = Math.random(); while (u > s && k < 9) { k++; p *= l / k; s += p; } return k; };
  [[A, B, 0], [B, A, 1]].forEach(([me, op, team]) => {
    const g = pois(1.5 * frac * Math.pow(me.att / op.def, 1.3));
    const shooters = m.players.filter(p => p.team === team && p.role !== 'gk' && !p.human);
    for (let i = 0; i < g; i++) {
      const tot = shooters.reduce((s, p) => s + p.at.sht, 0); let r = Math.random() * tot, sc = shooters[0];
      for (const p of shooters) { r -= p.at.sht; if (r <= 0) { sc = p; break; } }
      m.score[team]++; m.scorers.push({ id: sc ? sc.id : null, team, min: Math.round(40 * (1 - frac) + Math.random() * 40 * frac), assist: null, sim: true });
    }
  });
}
// ---------------------------------------------------------------- fim de jogo: histórico, recompensas e amizade
function fbFinish(m) {
  if (m.phase === 'done') return;
  m.phase = 'done';
  const F = S.football, ev = m.ev, played = !!m.withKai;
  const T = { a: m.players.filter(p => p.team === 0).map(p => p.id), b: m.players.filter(p => p.team === 1).map(p => p.id) };
  const res = m.score[0] > m.score[1] ? 0 : m.score[1] > m.score[0] ? 1 : -1;
  const rec = { day: ev.day, kind: ev.kind, wet: !!ev.wet, teams: T, score: m.score.slice(), scorers: m.scorers.slice(), kai: played ? Object.assign({}, m.kai) : null, kaiTeam: played ? 0 : null, result: played ? (res === 0 ? 'vitoria' : res === 1 ? 'derrota' : 'empate') : null, live: m.live };
  F.history.unshift(rec); if (F.history.length > 30) F.history.length = 30;
  ev.status = 'jogado'; ev.result = { score: rec.score };
  for (const p of m.players) if (!p.human) { p.ref.fbCtl = false; p.ref.entry = null; }
  // gols de todos (artilharia da vila)
  for (const s of m.scorers) if (s.id && s.id !== 'kai') F.npcGoals[s.id] = (F.npcGoals[s.id] || 0) + 1;
  const lines = [];
  if (played) {
    const st = F.stats, k = m.kai;
    st.matches++; st.goals += k.goals; st.assists += k.assists; st.passes += k.passes; st.tackles += k.tackles;
    if (res === 0) st.wins++; else if (res === 1) st.losses++; else st.draws++;
    let coins = (res === 0 ? 40 : res === -1 ? 20 : 10) + k.goals * 15 + k.assists * 8;
    S.coins += coins; S.stats.earned += coins;
    const popGain = (res === 0 ? 3 : 1) + k.goals * 6 + k.assists * 3;
    F.pop = (F.pop || 0) + popGain;
    F.xp = (F.xp || 0) + 1 + k.goals + (res === 0 ? 1 : 0);
    // amizade: jogar junto, fair play com os adversários, gols e assistências
    for (const id of T.a) if (id !== 'kai') { addFriend(id, 12 + (res === 0 ? 8 : 0) + k.goals * 5); remember(id, 'Jogamos futebol juntos (' + m.score[0] + ' × ' + m.score[1] + ')'); F.rel[id] = F.rel[id] || { with: 0, vs: 0, tk: 0 }; F.rel[id].with++; }
    for (const id of T.b) { addFriend(id, 5); F.rel[id] = F.rel[id] || { with: 0, vs: 0, tk: 0 }; F.rel[id].vs++; }
    for (const s of m.scorers) if (s.assist === 'kai' && s.id) addFriend(s.id, 8);
    for (const r of RESIDENTS) if (!T.a.includes(r.id) && !T.b.includes(r.id) && r.area === 'world' && Math.hypot(r.x - FB.cx, r.y - FB.cy) < 700 && sm(r.id).friend >= 200 && k.goals) addFriend(r.id, 3);
    // rivalidade: muitos carrinhos entre o Kai e alguém do outro time
    for (const [key, n] of Object.entries(m.tackled)) {
      const id = key.replace('kai>', '').replace('>kai', '');
      const R = F.rel[id] = F.rel[id] || { with: 0, vs: 0, tk: 0 };
      R.tk += n; if (key.startsWith('kai>')) addFriend(id, -2 * n);
      if (R.tk >= 5 && !R.rival) { R.rival = true; remember(id, 'Virou meu rival no futebol'); lines.push(RES_BY_ID[id].name + ' agora é seu rival no futebol!'); }
    }
    // conquistas
    const got = [];
    const give = (id, cond) => { if (cond && !F.trophies.includes(id)) { F.trophies.push(id); got.push(FB_TROPHIES[id]); } };
    give('estreia', true); give('gol1', st.goals >= 1); give('vitoria1', st.wins >= 1); give('hat', k.goals >= 3);
    give('craque', st.wins >= 5); give('artilheiro', st.goals >= 10); give('garcom', st.assists >= 5); give('amigo', ev.kind === 'amistoso');
    lines.unshift('Fim de jogo! ' + TEAM_NAMES[0] + ' ' + m.score[0] + ' × ' + m.score[1] + ' ' + TEAM_NAMES[1] + ' — ' + (res === 0 ? 'vitória!' : res === 1 ? 'derrota.' : 'empate.'),
      'Você: ' + k.goals + ' gol(s), ' + k.assists + ' assistência(s), ' + k.passes + ' passe(s). +' + coins + ' moedas, +' + popGain + ' de popularidade.');
    if (got.length) { lines.push('Conquista: ' + got.join(', ') + '!'); Audio.sfx('craft'); }
    const mate = T.a.find(id => id !== 'kai' && RES_BY_ID[id]);
    if (mate) lines.push(RES_BY_ID[mate].name + ': ' + (res === 0 ? 'Que jogão, Kai! Sexta que vem tem mais.' : res === 1 ? 'Perdemos, mas foi divertido. Na próxima a gente vira!' : 'Empate justo. Bom jogo, Kai!'));
    S.time.min = Math.max(S.time.min, (ev.start + 1) * 60);
  } else if (m.live || kaiNearField(2000)) lines.push('Fim de jogo: ' + TEAM_NAMES[0] + ' ' + m.score[0] + ' × ' + m.score[1] + ' ' + TEAM_NAMES[1] + '.');
  if (lines.length) say(lines);
  fbm = null; fbRun = false;
  save();
}
// ---------------------------------------------------------------- falas dos moradores sobre futebol
function footballLine(r) {
  if (!S.football || !FB_ATTR[r.id] && !r.child) return [];
  const out = [], F = S.football, ev = fbEvent(S.time.day, false), h = gameHour();
  if (ev && !ev.virtual && !fbDone(ev) && ev.orgDone && h < ev.start) out.push('Hoje tem futebol às ' + ev.start + 'h no campo!');
  if (isFriday(S.time.day + 1) && h > 12) out.push('Amanhã é sexta: dia de futebol de várzea!');
  const last = F.history[0];
  if (last && S.time.day - last.day <= 6) {
    const inA = last.teams.a.includes(r.id), inB = last.teams.b.includes(r.id);
    const myGoals = last.scorers.filter(s => s.id === r.id).length, kaiGoals = last.kai ? last.kai.goals : 0;
    if (myGoals) out.push('Viu meu gol no último jogo? Hehe.');
    if (kaiGoals && (inA || inB)) out.push(inA ? 'Que golaço você fez no último jogo!' : 'Você marcou contra a gente... na próxima eu te paro!');
    if (last.kai && inA) out.push(last.result === 'vitoria' ? 'Nosso time jogou muito bem junto!' : 'Na próxima a gente ganha, Kai.');
    if (!last.kai && (inA || inB)) out.push('Faltou você no futebol, Kai!');
  }
  const R = F.rel[r.id];
  if (R && R.rival) out.push('Você e seus carrinhos... na próxima sexta eu te pego!');
  if ((F.pop || 0) >= 30) out.push('O pessoal só fala de você no campo, ' + popTitle().toLowerCase() + '!');
  return out;
}

// ---------------------------------------------------------------- desenho: bola, balões e interface
function footballEntities(list) {
  if (!fbm || fbm.phase === 'done' || area !== 'world') return;
  const b = fbm.ball;
  list.push({ y: b.y, f: () => {
    shadow(b.x, b.y, 9, 4, 0.35);
    const y = b.y - 7 - b.z;
    ctx.fillStyle = '#fbfbf6'; ctx.beginPath(); ctx.arc(b.x, y, 10, 0, 7); ctx.fill();
    ctx.strokeStyle = '#2a2238'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#2a2238';
    for (let i = 0; i < 3; i++) { const a = b.spin + i * 2.1; ctx.fillRect(b.x + Math.cos(a) * 4 - 1.5, y + Math.sin(a) * 4 - 1.5, 3, 3); }
  } });
}
function drawFootballOverlay() {
  if (area !== 'world') return;
  for (const bb of fbBubbles) if (bb.r) label(bb.text, bb.r.x, bb.r.y - 150 - (bb.r.hopZ || 0), 14, '#fff6d8', Math.min(1, bb.t * 2));
  if (!fbm || fbm.phase === 'done') return;
  const own = fbm.ball.owner;
  if (own) label('▼', own.ref.x, own.ref.y - (own.human ? 150 : 140), 15, TEAM_COLS[own.team]);
  if (fbBubbleKai > 0) label('Aqui!', player.x, player.y - 160, 15, '#fff6d8');
}
function drawFootballHUD() {
  fbBubbleKai = Math.max(0, fbBubbleKai - 1 / 60);
  if (!fbm || fbm.phase === 'done' || !(fbm.withKai || kaiNearField(2000))) return;
  const m = fbm, T = SAFE.t + 40, min = Math.min(40, Math.floor(m.t / m.dur * 40));
  const txt = TEAM_NAMES[0] + '  ' + m.score[0] + ' × ' + m.score[1] + '  ' + TEAM_NAMES[1];
  ctx.font = `700 16px ${FONT}`; const w = ctx.measureText(txt).width + 90, x = W / 2 - w / 2;
  ctx.fillStyle = 'rgba(20,24,20,0.78)'; ctx.beginPath(); ctx.roundRect(x, T, w, 30, 10); ctx.fill();
  ctx.fillStyle = TEAM_COLS[0]; ctx.fillRect(x + 8, T + 8, 10, 14); ctx.fillStyle = TEAM_COLS[1]; ctx.fillRect(x + w - 64, T + 8, 10, 14);
  ctx.fillStyle = '#fff6d8'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(txt, x + 24, T + 15.5);
  ctx.fillStyle = '#ffd65a'; ctx.fillText(String(min).padStart(2, '0') + "'", x + w - 46, T + 15.5);
  const own = m.ball.owner;
  const ptxt = m.phase === 'goal' ? 'Gol!' : m.phase === 'kickoff' ? 'Saída de bola' : m.phase === 'end' ? 'Fim de jogo' : own ? 'Bola: ' + (own.human ? 'Kai' : RES_BY_ID[own.id].name) : 'Bola livre';
  label(ptxt, W / 2, T + 44, 13, own ? TEAM_COLS[own.team] : '#fff6d8', 0.95);
  if (m.wet) label('campo molhado', W / 2, T + 62, 11, '#9ad1ff', 0.8);
  if (!fbPlaying()) return;
  // fôlego do Kai
  const p = m.players.find(q => q.human), bx = 12 + SAFE.l, by = T + 60;
  label('Fôlego', bx + 30, by - 2, 11, '#fff6d8', 0.85);
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(bx, by + 6, 120, 8); ctx.fillStyle = p.stam > 30 ? '#9be36a' : '#ff9a6a'; ctx.fillRect(bx, by + 6, 120 * p.stam / 100, 8);
  panelButton(fbQuitAsk > time ? 'Sair? Toque de novo' : 'Sair do jogo', bx, by + 22, 130, 28, () => { if (fbQuitAsk > time) fbQuit(); else fbQuitAsk = time + 3; });
}
// botões de passe/pedir e correr, ao lado do botão de chute (o botão de ação)
function drawFootballButtons(b) {
  const m = fbm, p = m.players.find(q => q.human), has = m.ball.owner === p, s = HS();
  ctx.fillStyle = '#2a2238'; ctx.font = `700 16px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(has ? 'Chute' : 'Desarme', b.x, b.y + 1);
  hudButton(b.x - 96 * s, b.y + 8, 34, (x, y) => { ctx.fillStyle = '#fff6d8'; ctx.font = `700 13px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText(has ? 'Passe' : 'Pedir', x, y + 1); }, () => fbButton('pass'), has);
  hudButton(b.x - 30 * s, b.y - 96, 30, (x, y) => { ctx.fillStyle = fbRun ? '#2a2238' : '#fff6d8'; ctx.font = `700 12px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('Correr', x, y + 1); }, () => { fbRun = !fbRun; }, fbRun);
}

// ---------------------------------------------------------------- aba Futebol do menu
function drawFootballTab(x, y, w, h) {
  const F = S.football, colW = (w - 16) / 2;
  let yy = y + 8;
  text('Próximos jogos', x, yy, 15, '#ffe38a', 700); yy += 20;
  const up = [];
  for (let d = S.time.day; d < S.time.day + 10; d++) { const e = fbEvent(d, false); if (e && !(fbDone(e) && d < S.time.day)) up.push(e); }
  up.slice(0, 3).forEach(e => {
    const c = calOf(e.day), when = e.day === S.time.day ? 'Hoje' : e.day === S.time.day + 1 ? 'Amanhã' : weekday(e.day) + ', ' + dateText(c.season, c.dom);
    ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.beginPath(); ctx.roundRect(x, yy, colW, 46, 8); ctx.fill();
    const btns = !e.virtual && !fbDone(e) && e.day === S.time.day && gameHour() < e.start && e.orgDone;
    text((e.kind === 'sexta' ? 'Futebol de sexta' : 'Amistoso com ' + (RES_BY_ID[e.host] ? RES_BY_ID[e.host].name : '?')) + ' · ' + when + ', ' + e.start + 'h', x + 8, yy + 14, 12, '#fff6e6', 700, colW - (btns ? 160 : 16));
    text(e.virtual ? 'Convite chega às ' + (e.start - 5) + 'h do dia' : evStatusText(e) + (e.result ? ' · ' + e.result.score.join(' × ') : ''), x + 8, yy + 32, 11, e.status === 'aceito' ? '#9be36a' : '#cfc3a6', 600, colW - 190);
    if (btns) {
      panelButton('Vou', x + colW - 148, yy + 8, 64, 30, () => { e.status = 'aceito'; e.teams = null; fbTeams(e); save(); }, e.status === 'aceito' ? 'on' : null);
      panelButton('Não vou', x + colW - 78, yy + 8, 72, 30, () => { e.status = 'recusado'; e.teams = null; save(); }, e.status === 'recusado' ? 'on' : null);
    }
    yy += 52;
  });
  if (!up.length) { text('Nenhum jogo marcado.', x, yy + 6, 12, '#cfc3a6', 600); yy += 24; }
  yy += 4; text('Horário de sexta e duração da partida', x, yy, 13, '#ffe38a', 700, colW); yy += 18;
  const hb = Math.min(48, (colW - 24) / 7);
  [14, 15, 16, 17].forEach((hh, i) => panelButton(hh + 'h', x + i * (hb + 4), yy, hb, 28, () => { F.cfg.start = hh; for (const e of Object.values(F.ev)) if (e.kind === 'sexta' && !e.orgDone) e.start = hh; save(); }, F.cfg.start === hh ? 'on' : null));
  [3, 4, 6].forEach((mm, i) => panelButton(mm + ' min', x + 4 * (hb + 4) + 8 + i * (hb + 4), yy, hb, 28, () => { F.cfg.minutes = mm; save(); }, F.cfg.minutes === mm ? 'on' : null));
  yy += 34;
  text('Organização ' + (F.cfg.start - 6) + 'h · convites ' + (F.cfg.start - 5) + 'h · jogo ' + F.cfg.start + 'h · conversas ' + (F.cfg.start + 1) + 'h (minutos reais)', x, yy, 10, '#b8ad94', 500, colW);
  yy += 20;
  const st = F.stats;
  text('Você · ' + popTitle() + ' (popularidade ' + (F.pop || 0) + ')', x, yy, 13, '#ffe38a', 700, colW); yy += 18;
  text(st.matches + ' jogos · ' + st.wins + 'V ' + st.draws + 'E ' + st.losses + 'D · ' + st.goals + ' gols · ' + st.assists + ' assist. · nota ' + fbRating(kaiAttr()), x, yy, 11, '#e8dcc0', 600, colW); yy += 16;
  text('Conquistas: ' + (F.trophies.length ? F.trophies.map(t => FB_TROPHIES[t]).join(', ') : 'nenhuma ainda'), x, yy, 11, '#e8dcc0', 600, colW);
  // direita: histórico e jogadores
  const ex = x + colW + 16;
  let ry = y + 8;
  text('Últimos resultados', ex, ry, 15, '#ffe38a', 700); ry += 18;
  F.history.slice(0, 4).forEach(hh => {
    const sc = hh.scorers.filter(s => s.id).map(s => (s.id === 'kai' ? 'Kai' : RES_BY_ID[s.id] ? RES_BY_ID[s.id].name : s.id) + ' ' + s.min + "'").join(', ');
    text('Dia ' + hh.day + ': ' + TEAM_NAMES[0] + ' ' + hh.score[0] + ' × ' + hh.score[1] + ' ' + TEAM_NAMES[1] + (hh.kai ? ' · você: ' + hh.result : ''), ex, ry, 11, '#fff6e6', 700, colW); ry += 14;
    text(sc ? 'Gols: ' + sc : 'Sem gols', ex, ry, 10, '#cfc3a6', 500, colW); ry += 16;
  });
  if (!F.history.length) { text('Nenhuma partida ainda.', ex, ry, 11, '#cfc3a6', 600); ry += 18; }
  ry += 4; text('Jogadores (vel · chute · controle · fôlego · passe · defesa)', ex, ry, 12, '#ffe38a', 700, colW); ry += 16;
  const ids = Object.keys(FB_ATTR).filter(id => RES_BY_ID[id]);
  const rowH = Math.max(12, Math.min(15, (y + h - ry) / ids.length));
  for (const id of ids) {
    const a = FB_ATTR[id], R = F.rel[id];
    text(RES_BY_ID[id].name + ' · ' + [a.spd, a.sht, a.ctl, a.sta, a.pas, a.def].join(' ') + ' · ' + a.tag + ((F.npcGoals[id] || 0) ? ' · ' + F.npcGoals[id] + ' gols' : '') + (R && R.rival ? ' · rival' : ''), ex, ry, 10, R && R.rival ? '#ff9a8a' : '#e8dcc0', 600, colW);
    ry += rowH; if (ry > y + h - 4) break;
  }
}
