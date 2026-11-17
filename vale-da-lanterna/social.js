/* Vale da Lanterna — vida social: amizade, presentes, passeios, namoro, noivado, casamento, morar junto,
   filhos (nascimento, crescimento, necessidades), aniversários, datas comemorativas, discussões e memória. */
'use strict';

// ---------------------------------------------------------------- calendário (mês de 28 dias, 4 estações)
const SEASONS = ['Primavera', 'Verão', 'Outono', 'Inverno'];
function calOf(day = S.time.day) { const doy = (day - 1) % 112; return { season: Math.floor(doy / 28), dom: doy % 28 + 1, year: Math.floor((day - 1) / 112) + 1 }; }
const dateText = (s, d) => d + ' de ' + SEASONS[s];
const HOLIDAYS = [
  { s: 0, d: 14, name: 'Festival das Flores', line: 'Feliz Festival das Flores!' },
  { s: 1, d: 21, name: 'Festa do Verão', line: 'Que calor gostoso! Feliz Festa do Verão!' },
  { s: 2, d: 20, name: 'Festa da Lanterna', line: 'Feliz Festa da Lanterna! A praça fica linda à noite.' },
  { s: 3, d: 25, name: 'Noite das Estrelas', line: 'Hoje é a Noite das Estrelas. Faça um pedido!' }];
function holidayToday() { const c = calOf(); return HOLIDAYS.find(h => h.s === c.season && h.d === c.dom) || null; }

// ---------------------------------------------------------------- perfil social dos moradores
// gender: 'f'/'m' (usado em "mamãe/papai"); eligible: adulto que aceita romance; dislikes: presentes que não gosta
const SOCIAL = {
  aurora: { bday: [3, 12], eligible: false, gender: 'f', dislikes: ['seiva', 'pedra'], no: 'Ah, querido... meu coração ainda é do meu falecido Joaquim. Mas fico lisonjeada!' },
  mel: { bday: [0, 8], eligible: true, gender: 'f', dislikes: ['seiva', 'pedra'] },
  tome: { bday: [1, 3], eligible: false, gender: 'm', dislikes: ['flor'], no: 'Rapaz, eu tô velho e casado com a minha horta!' },
  bruno: { bday: [2, 17], eligible: true, gender: 'm', dislikes: ['flor', 'fibra'] },
  rosa: { bday: [0, 22], eligible: true, gender: 'f', dislikes: ['seiva', 'pedra'] },
  teo: { bday: [1, 15], eligible: false, child: true, gender: 'm', dislikes: ['cogumelo'] },
  iara: { bday: [1, 25], eligible: true, gender: 'f', dislikes: ['flor'] },
  davi: { bday: [2, 6], eligible: true, gender: 'm', dislikes: ['seiva'] },
  nina: { bday: [3, 2], eligible: true, gender: 'f', dislikes: ['pedra', 'madeira'] },
  leo: { bday: [2, 28], eligible: false, gender: 'm', dislikes: ['flor'], no: 'Kai... eu sou casado com a Bia. Mas valeu pela amizade.' },
  bia: { bday: [0, 4], eligible: false, gender: 'f', dislikes: ['pedra'], no: 'Ai, que fofo! Mas eu e o Léo somos casados há anos.' },
  joca: { bday: [3, 19], eligible: true, gender: 'm', dislikes: ['flor'] },
  gil: { bday: [1, 9], eligible: false, gender: 'm', dislikes: ['seiva'], no: 'Hahaha! Kai, eu sou casado com este armazém!' }
};
const GIFTABLE = ['flor', 'cogumelo', 'madeira', 'pedra', 'fibra', 'seiva', 'cristal', 'torta', 'pocao', 'sopa', 'pao', 'peixe', 'truta', 'carpa', 'tabua', 'couve', 'cenoura', 'morango', 'tomate', 'abobora', 'nabo', 'ovo', 'leite', 'la', 'trufa', 'omelete'];
function sm(id) {
  const m = npcMem(id);
  if (m.friend === undefined) Object.assign(m, { friend: 0, hist: [], likesKnown: [], giftDay: 0, upset: false, upsetDays: 0, firstDate: false, walkDay: 0 });
  return m;
}
const hearts = id => Math.floor(sm(id).friend / 100);
function addFriend(id, v) { const m = sm(id); m.friend = clamp(m.friend + v, 0, 1000); }
function remember(id, text) { const m = sm(id); m.hist.push({ day: S.time.day, text }); if (m.hist.length > 12) m.hist.shift(); }
function isBirthday(id) { const b = (SOCIAL[id] || {}).bday; if (!b) return false; const c = calOf(); return b[0] === c.season && b[1] === c.dom; }
const romance = () => S.romance;
const partnerOf = id => S.romance && S.romance.id === id;
function statusText(id) {
  const k = S.family && S.family.kids.find(k => k.id === id);
  if (k) return 'Seu filho(a)';
  if (partnerOf(id)) return { namorando: 'Namorando', noivos: 'Noivos', casados: 'Casados' }[S.romance.status];
  const h = hearts(id);
  return h >= 8 ? 'Melhor amigo(a)' : h >= 5 ? 'Amigo(a)' : h >= 2 ? 'Conhecido(a)' : sm(id).met ? 'Acabou de conhecer' : 'Ainda não conhece';
}

// ---------------------------------------------------------------- rotina: festas, passeio e família
const FEST_ENTRY = [17, 22, 'praca_fonte', 'talk'];
const WALK_ENTRY = [0, 24, 'walk_with', 'idle'];
function socialOverride(r, h) {
  if (S.walk && S.walk.id === r.id) return WALK_ENTRY;
  if (holidayToday() && h >= 17 && h < 22 && !(r.kid && r.stage === 'bebe')) return FEST_ENTRY;
  return null;
}
function followPlayer(r, dt) {
  if (r.area !== area) { r.area = area; r.x = player.x + 40; r.y = player.y + 20; r.steps = []; }
  const tx = player.x - player.fx * 40 + player.fy * 70, ty = player.y - player.fy * 30 - player.fx * 50 + 10;
  const dx = tx - r.x, dy = ty - r.y, d = Math.hypot(dx, dy);
  r.moving = d > 18;
  if (r.moving) { const v = Math.min(d * 4, (player.running ? 300 : 200)) * dt; const nx = r.x + dx / d * v, ny = r.y + dy / d * v; if (walkable(nx, ny)) { r.x = nx; r.y = ny; } else if (d > 300) { r.x = player.x + 30; r.y = player.y + 20; } r.fx = dx / d; r.fy = dy / d; }
  r.anim = r.moving ? (player.running ? 'run' : 'walk') : 'idle';
  r.sleeping = false;
}
// passeio: termina sozinho depois de 2 horas do jogo
function updateWalk() {
  if (!S.walk) return;
  updateDate();
  const now = S.time.day * 1440 + S.time.min, r = RES_BY_ID[S.walk.id];
  if (!r) { S.walk = null; return; }
  if (now - S.walk.tick >= 10) { S.walk.tick = now; addFriend(r.id, partnerOf(r.id) ? 9 : 6); }
  if (now >= S.walk.end) {
    S.walk = null;
    addFriend(r.id, 20); romanceGain(r.id, 3); remember(r.id, 'Passeamos juntos pelo vale.');
    talkPid = r.id; talkFace = r;
    say([r.name + ': ' + (partnerOf(r.id) ? 'Que passeio lindo. Adoro estar com você.' : 'Foi muito bom passear com você, Kai! Até mais!')]);
    r.entry = null;
  }
}

// ---------------------------------------------------------------- conversa com moradores: menu de ações
function socialOpen(n, questTalk) {
  const r = RES_BY_ID[n.id], m = sm(n.id), info = SOCIAL[n.id] || {};
  if (r.kid) return kidOpen(r);
  if (romanceConfess(n)) return;
  const first = !m.met;
  const ch = [];
  ch.push({ t: 'Conversar', fn: () => { if (questTalk) questTalk(); else lifeTalk(n); dailyTalk(n.id); } });
  if (m.giftDay !== S.time.day) ch.push({ t: 'Presente', fn: () => { menu = { tab: 'gift', npc: n.id }; } });
  if (S.walk && S.walk.id === n.id) ch.push({ t: 'Encerrar passeio', fn: () => { S.walk.end = 0; updateWalk(); } });
  else if (!S.walk && !info.child && m.met) ch.push({ t: 'Passear', fn: () => inviteWalk(n) });
  ch.push(...economyChoices(n));
  ch.push(...footballChoices(n));
  ch.push(...romanceOptions(n));
  ch.push({ t: 'Tchau' });
  const greet = isBirthday(n.id) ? 'Hoje é meu aniversário!' : holidayToday() ? holidayToday().line : partnerOf(n.id) ? partnerGreet(n.id) : first ? 'Oi! Acho que ainda não nos conhecemos.' : m.upset ? 'Hmm... oi.' : 'Oi, Kai! O que manda?';
  say([n.name + ': ' + greet], null, ch);
}
function partnerGreet(id) {
  const m = sm(id), st = S.romance.status;
  if (m.upset) return 'Ah... é você. Sumiu, hein?';
  if (st === 'casados') return ['Oi, amor! Como foi seu dia?', 'Te esperei pro jantar!', 'Que bom que você chegou.'][S.time.day % 3];
  if (st === 'noivos') return 'Faltam ' + Math.max(0, S.romance.weddingDay - S.time.day) + ' dias pro nosso casamento!';
  return 'Oi, meu bem!';
}
function dailyTalk(id) {
  const m = sm(id);
  if (m.talkDay !== S.time.day) { m.talkDay = S.time.day; m.talkDays = (m.talkDays || 0) + 1; romanceGain(id, partnerOf(id) ? 2 : 1); addFriend(id, partnerOf(id) ? 25 : 18); if (m.upset && partnerOf(id)) { m.upsetDays = Math.max(0, m.upsetDays - 1); } }
}
function inviteWalk(n) {
  const r = RES_BY_ID[n.id], h = hearts(n.id), e = r.entry || currentEntry(r);
  if (h < 3) { say([n.name + ': Ah... a gente mal se conhece, Kai. Quem sabe outro dia?']); return; }
  if (sm(n.id).upset) { say([n.name + ': Não estou com cabeça pra passear agora.']); return; }
  const busy = ['work', 'farm', 'fish'].includes(e[3]);
  const chance = 0.35 + h * 0.07 + (busy ? -0.35 : 0.2) + (partnerOf(n.id) ? 0.4 : 0);
  if (Math.random() > chance) { say([n.name + ': ' + (busy ? 'Agora estou trabalhando... me chama mais tarde?' : 'Hoje não vai dar, desculpa. Fica pra próxima!')]); return; }
  const now = S.time.day * 1440 + S.time.min;
  S.walk = { id: n.id, end: now + 120, tick: now };
  const lines = [n.name + ': Bora! Vamos dar uma volta.'];
  if (partnerOf(n.id) && !sm(n.id).firstDate) {
    sm(n.id).firstDate = true; addFriend(n.id, 60); remember(n.id, 'Nosso primeiro encontro.');
    lines.push(n.name + ': Nosso primeiro encontro de verdade... estou até nervoso(a)!');
    flash = 0.3; Audio.sfx('relic');
  }
  say(lines);
}

// ---------------------------------------------------------------- presentes
function giveGift(id, item) {
  const r = RES_BY_ID[id], m = sm(id), info = SOCIAL[id] || {};
  const have = item in S.inv ? S.inv[item] : S.bag[item] || 0;
  if (!have) return;
  if (item in S.inv) S.inv[item]--; else S.bag[item]--;
  m.giftDay = S.time.day;
  const liked = r.likes.includes(item), disliked = (info.dislikes || []).includes(item);
  let v = liked ? 80 : disliked ? -30 : 25;
  const bday = isBirthday(id);
  if (bday) v *= 3;
  if (holidayToday() && v > 0) v = Math.round(v * 1.5);
  addFriend(id, v);
  if (liked && !m.likesKnown.includes(item)) m.likesKnown.push(item);
  if (liked) m.likedGifts = (m.likedGifts || 0) + 1;
  romanceGain(id, liked ? 4 : disliked ? -2 : 1);
  if (bday) m.bdayGift = S.time.day;
  if (v > 0 && m.upset) { m.upset = false; m.upsetDays = 0; remember(id, 'Fizemos as pazes com um presente.'); }
  remember(id, 'Ganhei ' + NAMES[item].toLowerCase() + ' do Kai' + (bday ? ' no meu aniversário' : '') + '.');
  talkPid = id; talkFace = r;
  const line = liked ? (bday ? 'No meu aniversário?! E é exatamente o que eu amo! Obrigado(a)!' : 'Uau, eu adoro isso! Como você sabia?')
    : disliked ? 'Hmm... obrigado, mas isso não é muito a minha cara.' : (bday ? 'Você lembrou do meu aniversário! Que gentil!' : 'Obrigado(a), Kai! Muito gentil.');
  Audio.sfx(v > 0 ? 'pick' : 'hurt');
  burst(r.x, r.y - 90, v > 0 ? '#ff8aa0' : '#9a9aa8', 10, 90);
  say([r.name + ': ' + line]);
  save();
}

// ---------------------------------------------------------------- namoro, noivado e casamento
function romanceOption(n) {
  const id = n.id, info = SOCIAL[id] || {}, m = sm(id), R = S.romance;
  if (partnerOf(id)) {
    if (m.upset) return { t: 'Pedir desculpas', fn: () => apologize(id) };
    if (R.status === 'namorando' && (S.bag.anel || 0) > 0) return { t: 'Pedir em casamento', fn: () => proposeMarriage(id) };
    if (R.status === 'noivos' && S.time.day >= R.weddingDay) return { t: 'Vamos casar!', fn: () => wedding(id) };
    if (R.status === 'casados' && !S.family.babyDue && S.family.kids.length < 2) return { t: 'Aumentar a família?', fn: () => askBaby(id) };
    return null;
  }
  return null;
}
function askDate(id) {
  const r = RES_BY_ID[id], info = SOCIAL[id], h = hearts(id);
  if (!canRomance(id) || !(S.bag.buque > 0)) { say([r.name + ': ' + (info.no || 'Você é muito querido(a), mas não sinto isso por você.')]); return; }
  const need = r.pers === 'timido' ? 8 : 7;
  if (h < need) {
    addFriend(id, -10);
    say([r.name + ': Kai... eu gosto muito de você, mas ainda é cedo pra isso. Vamos nos conhecer melhor?']);
    return;
  }
  S.bag.buque--;
  S.romance = { id, status: 'namorando', since: S.time.day };
  addFriend(id, 60); remember(id, 'Começamos a namorar.');
  flash = 0.5; Audio.sfx('relic');
  for (let i = 0; i < 18; i++) particles.push({ x: r.x + rand(-60, 60), y: r.y - 80 + rand(-40, 20), vx: rand(-30, 30), vy: rand(-80, -30), g: 0, t: 1.6, max: 1.6, col: '#ff7aa6', s: 7 });
  say([r.name + ': Um buquê... pra mim? Eu... eu aceito! Vamos namorar!', 'Agora vocês estão namorando. Passeiem juntos e conversem todo dia!']);
  save();
}
function proposeMarriage(id) {
  const r = RES_BY_ID[id], h = hearts(id), days = S.time.day - S.romance.since;
  if (h < 9 || days < 3) { say([r.name + ': Que anel lindo... mas acho que ainda é cedo. Vamos namorar mais um pouco?']); return; }
  S.bag.anel--;
  S.romance.status = 'noivos'; S.romance.weddingDay = S.time.day + 3;
  addFriend(id, 80); remember(id, 'Ficamos noivos!');
  flash = 0.6; Audio.sfx('relic');
  const c = calOf(S.romance.weddingDay);
  say([r.name + ': SIM! Mil vezes sim!', r.name + ': Vamos casar na praça, no dia ' + dateText(c.season, c.dom) + '. Fale comigo nesse dia!']);
  save();
}
function wedding(id) {
  const r = RES_BY_ID[id];
  fade = { t: 0, dur: 1.4, mid: () => {
    setArea('world', 3550, 2390);
    const ring = RESIDENTS.filter(o => !o.kid && o.id !== id);
    ring.forEach((o, i) => { const a = Math.PI * (0.15 + 0.7 * i / Math.max(1, ring.length - 1)); o.area = 'world'; o.x = 3550 + Math.cos(a) * 260; o.y = 2390 + Math.sin(a) * 120 + 60; o.steps = []; o.fx = 3550 - o.x; o.fy = 2390 - o.y; });
    r.area = 'world'; r.x = 3610; r.y = 2390; r.steps = []; r.fx = -1; r.fy = 0;
    player.fx = 1; player.fy = 0;
    S.weddingParty = S.time.day;
  } };
  setTimeout(() => {
    talkPid = 'aurora'; talkFace = RES_BY_ID.aurora;
    say(['Vó Aurora: Estamos aqui reunidos, debaixo do céu do vale, para celebrar o amor de Kai e ' + r.name + '.',
      'Vó Aurora: ' + r.name + ', você aceita o Kai como companheiro(a) para todas as estações?', r.name + ': Aceito!',
      'Vó Aurora: E você, Kai?', 'Kai: Aceito!', 'Vó Aurora: Então eu os declaro casados! Podem se abraçar!'], () => {
      S.romance.status = 'casados'; S.romance.married = S.time.day;
      addFriend(id, 100); remember(id, 'Nos casamos na praça!');
      for (const o of RESIDENTS) if (!o.kid && o.id !== id) addFriend(o.id, 15);
      flash = 1; Audio.sfx('relic');
      for (let i = 0; i < 60; i++) particles.push({ x: 3550 + rand(-300, 300), y: 2250 + rand(-80, 80), vx: rand(-60, 60), vy: rand(-140, -40), g: 120, t: 2.5, max: 2.5, col: FLOWER_COLS[i % 5], s: 7 });
      applySpouseHome();
      say([r.name + ': A partir de hoje eu moro com você na Casa do Kai, a oeste da praça!']);
      save();
    });
  }, 1500);
}
function applySpouseHome() {
  for (const r of RESIDENTS) if (r.home0) { r.home = r.home0; r.bed = r.bed0; }
  if (S.romance && S.romance.status === 'casados') { const r = RES_BY_ID[S.romance.id]; if (r) { r.home = 'casaKai'; r.bed = 1; r.entry = null; } }
}
function apologize(id) {
  const r = RES_BY_ID[id], m = sm(id);
  if (m.giftDay === S.time.day || m.friend >= 700) {
    m.upset = false; m.upsetDays = 0; addFriend(id, 30); remember(id, 'Discutimos, mas fizemos as pazes.');
    say(['Kai: Desculpa por ter sumido. Você é importante pra mim.', r.name + ': ...Tá bom. Eu também senti sua falta. Vem cá!']);
  } else say(['Kai: Desculpa por ter sumido.', r.name + ': Eu sei... só preciso de um tempo. Um presente e uma conversa ajudariam.']);
}

// ---------------------------------------------------------------- filhos
const KID_NAMES = ['Lumi', 'Ravi', 'Aurora Jr.', 'Pipo', 'Clara', 'Tito', 'Maia', 'Joaquim', 'Lis', 'Davizinho'];
function askBaby(id) {
  const r = RES_BY_ID[id], married = S.time.day - (S.romance.married || S.time.day);
  if (married < 3 || hearts(id) < 9) { say([r.name + ': Eu adoraria... mas vamos curtir mais um pouquinho a vida de casados primeiro?']); return; }
  say([r.name + ': Uma família maior? Você tem certeza, Kai?'], null, [
    { t: 'Sim, vamos!', fn: () => { S.family.babyDue = S.time.day + 4; remember(id, 'Decidimos aumentar a família.'); flash = 0.4; Audio.sfx('heal'); say([r.name + ': Ai, que alegria! Em 4 dias a nossa família vai crescer!']); save(); } },
    { t: 'Ainda não' }]);
}
function kidStage(k) { const a = S.time.day - k.born; return a < 5 ? 'bebe' : a < 14 ? 'pequeno' : 'crianca'; }
const KID_SCALE = { bebe: 0.42, pequeno: 0.55, crianca: 0.68 };
function kidSched(stage) {
  if (stage === 'bebe') return [[0, 24, 'crib', 'sleep']];
  if (stage === 'pequeno') return [[7, 12, 'home', 'idle'], [12, 13, 'eat', 'idle'], [13, 20, 'home', 'idle'], [20, 31, 'crib', 'sleep']];
  return [[7, 8, 'home', 'idle'], [8, 12, 'praca_brincar', 'idle'], [12, 13, 'eat', 'idle'], [13, 17, 'praca_brincar', 'idle'], [17, 20, 'home', 'idle'], [20, 31, 'crib', 'sleep']];
}
function kidResident(k) {
  let r = RES_BY_ID[k.id];
  const stage = kidStage(k);
  if (!r) {
    r = { id: k.id, kid: true, prof: 'Criança', pers: k.pers, likes: ['flor', 'torta'], home: 'casaKai', bed: k.crib, resident: true, steps: [], fx: 0, fy: 1, x: 0, y: 0, area: 'casaKai', anim: 'idle' };
    RESIDENTS.push(r); RES_BY_ID[k.id] = r;
  }
  r.name = k.name; r.age = S.time.day - k.born; r.stage = stage; r.sched = kidSched(stage); r.entry = null;
  r.app = Object.assign({}, k.app, { scale: KID_SCALE[stage] });
  r.atlasKey = k.id + '_' + stage;
  NPC[k.id] = spriteFromApp(r.app);
  return r;
}
function makeKid() {
  const sp = RES_BY_ID[S.romance.id], R = mulberry(S.time.day * 7 + S.family.kids.length * 13 + 5);
  const n = S.family.kids.length;
  const k = { id: 'kid' + (n + 1), name: KID_NAMES[Math.floor(R() * KID_NAMES.length)], born: S.time.day, crib: n, named: false,
    pers: ['alegre', 'curioso', 'timido', 'brincalhao'][Math.floor(R() * 4)], needs: { fome: 90, carinho: 90 },
    app: { skin: R() < 0.5 ? '#f0c08a' : sp.app.skin, hair: R() < 0.5 ? '#f3f0ea' : sp.app.hair, hairStyle: ['short', 'spiky', 'pony', 'bun'][Math.floor(R() * 4)],
      top: ['#f2c94c', '#9ad1ff', '#ff9ec7', '#7fc46a'][Math.floor(R() * 4)], bottom: '#4a6fa5' } };
  S.family.kids.push(k);
  kidResident(k);
  snapResidents();
  return k;
}
function parentWord() { const sp = S.romance && SOCIAL[S.romance.id]; return sp ? (sp.gender === 'f' ? 'mamãe' : 'papai') + ' ' + RES_BY_ID[S.romance.id].name : 'família'; }
function kidOpen(r) {
  const k = S.family.kids.find(k => k.id === r.id);
  if (!k) return;
  talkPid = r.id; talkFace = r;
  if (!k.named) {
    const opts = [k.name, KID_NAMES[(KID_NAMES.indexOf(k.name) + 3) % KID_NAMES.length], KID_NAMES[(KID_NAMES.indexOf(k.name) + 6) % KID_NAMES.length]];
    say(['Que bebê lindo! Qual vai ser o nome?'], null, opts.map(nm => ({ t: nm, fn: () => { k.name = nm; k.named = true; kidResident(k); remember(S.romance.id, 'Nasceu nosso bebê, ' + nm + '.'); say([nm + ' sorriu pra você! Bem-vindo(a) à família, ' + nm + '!']); save(); } })));
    return;
  }
  if (r.sleeping) { say([k.name + ' está dormindo. Zzz...']); return; }
  const st = kidStage(k), hungry = k.needs.fome < 40, lonely = k.needs.carinho < 40;
  const line = st === 'bebe' ? (hungry ? 'Buáá! (está com fome)' : 'Gu-gu, da-da! (sorri pra você)')
    : hungry ? 'Papai, tô com fome...' : lonely ? 'Papai, brinca comigo?' : ['Papai! Hoje eu ' + (st === 'crianca' ? 'brinquei com o Téo na praça!' : 'aprendi a pular!'), 'A ' + parentWord() + ' contou uma história!', 'Eu te amo, papai!'][S.time.day % 3];
  const food = (S.bag.sopa || 0) > 0 ? 'sopa' : (S.bag.torta || 0) > 0 ? 'torta' : (S.bag.pao || 0) > 0 ? 'pao' : null;
  say([k.name + ': ' + line], null, [
    { t: st === 'bebe' ? 'Ninar' : 'Brincar', fn: () => { k.needs.carinho = Math.min(100, k.needs.carinho + 35); Audio.sfx('heal'); burst(r.x, r.y - 50, '#ffb7d0', 10, 80); say([k.name + (st === 'bebe' ? ' adormeceu sorrindo.' : ' deu muitas risadas!')]); save(); } },
    { t: food ? 'Alimentar (' + NAMES[food] + ')' : 'Alimentar', fn: () => { if (!food) { say(['Você não tem comida. Cozinhe uma sopa no fogão de casa (2 cogumelos) ou compre pão ou torta.']); return; } S.bag[food]--; k.needs.fome = 100; Audio.sfx('pick'); say([k.name + ' comeu tudinho!']); save(); } },
    { t: 'Abraçar', fn: () => { k.needs.carinho = Math.min(100, k.needs.carinho + 15); say(['Você abraçou ' + k.name + '. Que quentinho!']); } },
    { t: 'Tchau' }]);
}
// necessidades das crianças caem com o tempo (mais devagar quando o cônjuge está em casa)
let kidTick = 0;
function updateFamily(dt) {
  updateWalk();
  if (!S.family || !S.family.kids.length) return;
  kidTick += dt; if (kidTick < 1) return;
  const gm = kidTick * 1440 / (dayMinutes() * 60); kidTick = 0;
  const sp = S.romance && RES_BY_ID[S.romance.id], toys = INTERIORS.casaKai.furn.some(f => f.t === 'toybox') ? 0.7 : 1, help = (sp && sp.area === 'casaKai' ? 0.4 : 1) * toys;
  for (const k of S.family.kids) {
    const r = RES_BY_ID[k.id]; if (r && r.sleeping) continue;
    k.needs.fome = Math.max(0, k.needs.fome - gm / 60 * 6 * help);
    k.needs.carinho = Math.max(0, k.needs.carinho - gm / 60 * 4 * help);
  }
}

// ---------------------------------------------------------------- virada do dia: aniversários, festas, saudade, nascimentos
function socialNewDay() {
  const d = S.time.day, c = calOf();
  const h = holidayToday(); if (h) setTimeout(() => toast('Hoje é ' + h.name + '! Festa na praça às 17h.'), 2600);
  for (const r of RESIDENTS) if (!r.kid && isBirthday(r.id)) setTimeout(() => toast('Hoje é aniversário de ' + r.name + '!'), 5200);
  if (S.romance) {
    const id = S.romance.id, m = sm(id);
    // saudade: sem conversar há mais de 2 dias
    if ((m.talkDay || 0) < d - 2) { addFriend(id, -40); if (!m.upset) { m.upset = true; remember(id, 'Fiquei chateado(a): o Kai sumiu.'); } m.upsetDays++; }
    // aniversário do par esquecido
    const pb = SOCIAL[id].bday, yest = calOf(d - 1);
    if (pb[0] === yest.season && pb[1] === yest.dom && m.bdayGift !== d - 1) { addFriend(id, -80); m.upset = true; remember(id, 'O Kai esqueceu meu aniversário.'); }
    if (S.romance.status === 'namorando' && m.upsetDays >= 4) {
      const name = RES_BY_ID[id].name;
      remember(id, 'Terminamos o namoro.'); addFriend(id, -150); m.upset = false; m.upsetDays = 0; S.romance = null;
      setTimeout(() => say([name + ' deixou um bilhete: "Kai, a gente se afastou muito. Acho melhor sermos só amigos."']), 1500);
    }
    if (S.romance && S.romance.status === 'noivos' && d > S.romance.weddingDay) { S.romance.weddingDay = d; setTimeout(() => toast('O casamento foi remarcado para hoje!'), 3000); }
  }
  if (S.family.babyDue && d >= S.family.babyDue) {
    S.family.babyDue = 0; makeKid();
    setTimeout(() => toast('O bebê nasceu! Vá para casa conhecê-lo.'), 1500);
  }
  for (const k of S.family.kids) {
    const r = kidResident(k);
    if ((d - k.born) > 0 && (d - k.born) % 28 === 0) k.party = d;
    if (r) r.entry = null;
  }
}
// festa de aniversário dos filhos quando o Kai chega em casa no dia
function checkKidParty() {
  if (area !== 'casaKai' || !S.family) return;
  for (const k of S.family.kids) if (k.party === S.time.day && k.partyDone !== S.time.day && gameHour() >= 16) {
    k.partyDone = S.time.day; k.needs.carinho = 100; k.needs.fome = 100;
    flash = 0.5; Audio.sfx('relic');
    for (let i = 0; i < 40; i++) particles.push({ x: rand(150, 450), y: rand(150, 300), vx: rand(-40, 40), vy: rand(-120, -40), g: 120, t: 2.2, max: 2.2, col: FLOWER_COLS[i % 5], s: 7 });
    const sp = S.romance ? RES_BY_ID[S.romance.id].name : 'Vó Aurora';
    say([sp + ': Surpresa! Feliz aniversário, ' + k.name + '!', k.name + ': Ebaaa! Bolo!', 'A família toda cantou parabéns. ' + k.name + ' fez ' + Math.floor((S.time.day - k.born) / 28) + ' mês(es) de idade no vale!']);
    save();
  }
}
// inicializa estado social ao carregar o jogo
function socialInit() {
  for (const r of RESIDENTS) if (!r.kid && r.home0 === undefined) { r.home0 = r.home; r.bed0 = r.bed; }
  for (let i = RESIDENTS.length - 1; i >= 0; i--) if (RESIDENTS[i].kid) { delete RES_BY_ID[RESIDENTS[i].id]; RESIDENTS.splice(i, 1); }
  for (const k of S.family.kids) kidResident(k);
  applySpouseHome();
  if (S.walk && !RES_BY_ID[S.walk.id]) S.walk = null;
}
