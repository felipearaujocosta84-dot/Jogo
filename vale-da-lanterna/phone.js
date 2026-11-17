/* Vale da Lanterna — smartphone: interface (tela inicial, barra de status, bateria, notificações, papel de parede,
   animação), Mensagens (conversas, grupos, fotos, respostas com contexto, digitar), Contatos, Telefone (ligações
   feitas e recebidas), Calendário, Banco, Mapas, Música e Configurações. VilaGram, Vídeos, Câmera e Galeria ficam
   em phone_media.js. Tudo desenhado no mesmo canvas do jogo e salvo em S.phone. */
'use strict';

// ---------------------------------------------------------------- estado
const PH = { open: false, anim: 0, closing: false, stack: [], banner: null, call: null, ring: 0, swipe: null, input: null, rt: 0, lastCoins: null, bankHint: null };
function phS() {
  S.phone = S.phone || {};
  const P = S.phone;
  if (P.battery === undefined) P.battery = 100;
  P.known = P.known || []; P.contacts = P.contacts || []; P.chats = P.chats || {}; P.posts = P.posts || []; P.follows = P.follows || []; P.followers = P.followers || [];
  P.profile = P.profile || { bio: 'Explorador do Vale da Lanterna.', avatar: 'kai' };
  P.notifs = P.notifs || []; P.calls = P.calls || []; P.bank = P.bank || []; P.pending = P.pending || []; P.plan = P.plan || [];
  P.settings = Object.assign({ wall: 0, sound: true, ring: true, silent: false, notif: { msg: true, social: true, invite: true, bday: true, event: true, family: true } }, P.settings || {});
  P.vids = P.vids || { liked: [], comments: {}, shared: 0 };
  P.music = P.music || { track: 0, playing: true };
  return P;
}
const nowMin = () => S.time.day * 1440 + S.time.min;
function timeLabel(at) {
  const d = Math.floor(at / 1440), m = Math.floor(at % 1440), hh = String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  if (d === S.time.day) return hh;
  if (d === S.time.day - 1) return 'ontem ' + hh;
  const c = calOf(d); return c.d + '/' + (c.m + 1) + ' ' + hh;
}
const hasPhone = id => { const r = RES_BY_ID[id]; return !!(r && !r.kid && r.age >= 12); };
const isContact = id => phS().contacts.includes(id);
const phoneNumber = id => '(84) 9' + String(1000 + (hashStr('tel' + id) >>> 0) % 9000) + '-' + String(1000 + (hashStr('num' + id) >>> 0) % 9000);
const phoneBlocks = () => PH.open && phTop().app !== 'camera';
// com o celular aberto o mundo está pausado: desenha uma vez e reaproveita a imagem (economiza bateria/CPU no Android)
const phoneFrozen = () => !!(PH.snap && PH.open && !PH.closing && PH.anim >= 1 && phTop().app !== 'camera' && PH.snap.width === cv.width && PH.snap.height === cv.height);
function phoneSnap() {
  if (!PH.open || PH.closing || PH.anim < 1 || phTop().app === 'camera') { PH.snap = null; return; }
  if (!PH.snap) { PH.snap = document.createElement('canvas'); PH.snap.width = cv.width; PH.snap.height = cv.height; PH.snap.getContext('2d').drawImage(cv, 0, 0); }
}
const phTop = () => PH.stack[PH.stack.length - 1] || { app: 'home' };

// ---------------------------------------------------------------- abrir, fechar e navegar
function openPhone(app, extra) {
  const P = phS();
  if (P.battery <= 0) { toast('A bateria do celular acabou. Carregue em casa (ou dormindo).'); return; }
  if (fbPlaying() || work || build) { toast('Agora não dá para usar o celular.'); return; }
  menu = null; showMap = false;
  if (!PH.open) { PH.open = true; PH.anim = 0; PH.closing = false; PH.stack = [{ app: 'home' }]; }
  if (app && app !== 'home') PH.stack.push(Object.assign({ app }, extra || {}));
  Audio.sfx('ui');
}
function closePhone() { if (!PH.open) return; PH.closing = true; hideInput(); if (phTop().app === 'camera') phoneCamEnd(); }
function phoneBack() {
  hideInput();
  if (phTop().app === 'camera') phoneCamEnd();
  if (phTop().app === 'call' && PH.call) { endCall(); }
  if (PH.stack.length > 1) PH.stack.pop(); else closePhone();
  Audio.sfx('ui');
}
function phoneHome() { hideInput(); if (phTop().app === 'camera') phoneCamEnd(); PH.stack = [{ app: 'home' }]; Audio.sfx('ui'); }
function go(app, extra) { hideInput(); if (app === 'camera') phoneCamStart(); PH.stack.push(Object.assign({ app }, extra || {})); Audio.sfx('ui'); }

// ---------------------------------------------------------------- texto digitado (teclado do celular)
let phInputEl = null;
function phoneAsk(placeholder, cb, rect, initial) {
  if (!phInputEl) {
    phInputEl = document.createElement('input');
    phInputEl.type = 'text'; phInputEl.maxLength = 140; phInputEl.autocomplete = 'off';
    Object.assign(phInputEl.style, { position: 'fixed', zIndex: 20, font: '600 15px "Pixelify Sans", sans-serif', padding: '6px 10px', borderRadius: '14px', border: '2px solid #7b5aa6', background: '#fffaf0', color: '#2a2238', outline: 'none', boxSizing: 'border-box' });
    document.body.appendChild(phInputEl);
    phInputEl.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { const v = phInputEl.value.trim(), f = PH.input && PH.input.cb; hideInput(); if (v && f) f(v); } if (e.key === 'Escape') hideInput(); });
  }
  PH.input = { cb };
  Object.assign(phInputEl.style, { display: 'block', left: rect[0] + 'px', top: rect[1] + 'px', width: rect[2] + 'px', height: rect[3] + 'px' });
  phInputEl.placeholder = placeholder; phInputEl.value = initial || '';
  setTimeout(() => phInputEl.focus(), 0);
}
function hideInput() { if (phInputEl) { phInputEl.style.display = 'none'; phInputEl.blur(); } PH.input = null; }
const typing = () => !!(phInputEl && phInputEl.style.display === 'block');

// ---------------------------------------------------------------- notificações
const NOTIF_CAT = { msg: 'Mensagens', social: 'VilaGram e vídeos', invite: 'Convites', bday: 'Aniversários', event: 'Eventos da cidade', family: 'Família' };
function notify(cat, title, text, open) {
  const P = phS();
  P.notifs.unshift({ id: 'n' + Date.now() + Math.floor(Math.random() * 99), cat, title, text, at: nowMin(), read: false, open: open || null });
  if (P.notifs.length > 50) P.notifs.length = 50;
  if (P.settings.notif[cat] === false) { P.notifs[0].read = true; return; }
  const viewing = PH.open && open && open.chat && phTop().app === 'chat' && phTop().chat === open.chat;
  if (viewing) { P.notifs[0].read = true; return; }
  PH.banner = { title, text, open, t: 3.6 };
  if (P.settings.sound && !P.settings.silent && Audio.ac && !Audio.muted) { Audio.tone(988, 0.08, 'sine', 0.06); Audio.tone(1319, 0.12, 'sine', 0.05, 0, 0.09); }
}
const unreadNotifs = () => phS().notifs.filter(n => !n.read).length;
function openNotif(n) {
  n.read = true; PH.banner = null;
  const o = n.open || {};
  if (!PH.open) openPhone();
  if (o.app) go(o.app, o);
}

// ---------------------------------------------------------------- mensagens
function chatOf(id) {
  const P = phS();
  if (!P.chats[id]) {
    const g = GROUPS[id];
    P.chats[id] = { id, name: g ? g.name : (RES_BY_ID[id] ? RES_BY_ID[id].name : id), group: !!g, members: g ? [] : [id], msgs: [], unread: 0 };
  }
  return P.chats[id];
}
const GROUPS = { g_futebol: { name: 'Futebol de Sexta ⚽' }, g_familia: { name: 'Família 🏠' }, g_vale: { name: 'Vale da Lanterna 🏮' } };
function pushMsg(chatId, from, text, extra) {
  const c = chatOf(chatId), m = Object.assign({ f: from, t: text, at: nowMin() }, extra || {});
  c.msgs.push(m); if (c.msgs.length > 60) c.msgs.splice(0, c.msgs.length - 60);
  const viewing = PH.open && phTop().app === 'chat' && phTop().chat === chatId;
  if (from !== 'kai') {
    if (!viewing) c.unread++;
    const who = RES_BY_ID[from] ? RES_BY_ID[from].name : from;
    notify(extra && extra.cat || (c.group ? 'msg' : (partnerOf(from) || (S.romance && S.romance.status === 'casados' && chatId === 'g_familia') ? 'family' : 'msg')), c.group ? c.name : who, (c.group ? who + ': ' : '') + (m.photo ? '📷 Foto' : text), { app: 'chat', chat: chatId });
  }
  return m;
}
// mensagem de NPC com um pequeno atraso (parece que a pessoa está digitando)
function npcMsg(chatId, from, text, extra, delay = 2) { phS().pending.push({ chat: chatId, from, text, extra: extra || null, wait: delay }); }
const unreadMsgs = () => Object.values(phS().chats).reduce((a, c) => a + (c.unread || 0), 0);
function ensureGroup(id, members) {
  const c = chatOf(id);
  c.members = members.filter(m => isContact(m) || m === (S.romance && S.romance.id));
  return c;
}
// lugar onde a pessoa está (respeitando o mundo: só diz onde ela realmente está)
function whereIs(r) {
  if (r.area !== 'world') { const I = INTERIORS[r.area]; return I ? I.name : 'em casa'; }
  const e = r.entry || currentEntry(r), names = { praca_fonte: 'na praça', praca_banco: 'num banco da praça', praca_brincar: 'brincando na praça', vila_praca: 'na Vila do Rio', jardim_mel: 'no jardim', horta: 'na horta', rio_pesca: 'pescando no rio', serraria: 'na serraria', feira: 'na feira', bosque: 'no bosque', campo: 'no campo de futebol', campo_torcida: 'no campo de futebol', campo_treino: 'no campo de futebol', rio_margem: 'na beira do rio', vila_brincar: 'brincando perto da ponte', ervas: 'colhendo ervas', praca_festa: 'na festa da praça' };
  return names[e && e[2]] || 'andando pelo vale';
}
// resposta com contexto ao que o Kai escreveu
function npcReply(id, text) { return dlgReply(id, text, 'phone').join(' '); }
function sendMsg(chatId, text, extra) {
  pushMsg(chatId, 'kai', text, extra);
  const c = chatOf(chatId);
  const replyFrom = c.group ? c.members.filter(id => RES_BY_ID[id]).sort(() => Math.random() - 0.5).slice(0, 2) : [chatId];
  replyFrom.forEach((id, i) => {
    const r = RES_BY_ID[id]; if (!r) return;
    const ans = extra && extra.photo ? [['Que foto linda!', 'Uau, ficou ótima! 📷', 'Adorei! Onde foi isso?'][hashStr(id + S.time.min) % 3]] : extra && extra.vid != null ? ['Hahaha, esse vídeo é muito bom!'] : dlgReply(id, text, 'phone');
    if (extra && (extra.photo || extra.vid != null)) addFriend(id, 2);
    if (r.sleeping) { phS().plan.push({ at: (S.time.day + (gameHour() >= 6 ? 1 : 0)) * 1440 + 7 * 60 + 10 + i * 5, chat: chatId, from: id, text: 'Desculpa, eu tava dormindo! ' + ans.join(' ') }); return; }
    // cada frase chega num balão, com tempo de "digitando" proporcional ao tamanho
    let wait = 1.2 + i * 2.2 + Math.random();
    for (const a of ans) { npcMsg(chatId, id, a, null, wait); wait += 0.8 + Math.min(2.5, a.length / 30); }
  });
  save();
}
// respostas rápidas a convites recebidos por mensagem
function phoneAct(msg, opt) {
  msg.opts = null;
  sendMsgQuiet(msg.chat || phTop().chat, opt.t);
  const [act, arg] = opt.act.split(':');
  if (act === 'fb') { const e = S.football.ev[arg]; if (e && !fbDone(e)) { e.status = opt.yes ? 'aceito' : 'recusado'; e.teams = null; e.invited = true; if (opt.yes) { fbTeams(e); addFriend(msg.f, 5); } npcMsg(msg.chat, msg.f, opt.yes ? 'Boa! Te espero lá às ' + e.start + 'h. ⚽' : 'Sem problema! Fica pra próxima.', null, 1.5); } }
  else if (act === 'walk') { if (opt.yes) { sm(msg.f).walkPromise = S.time.day; addFriend(msg.f, 5); npcMsg(msg.chat, msg.f, 'Combinado! Me encontra ' + whereIs(RES_BY_ID[msg.f]) + ' 😄', null, 1.5); } else npcMsg(msg.chat, msg.f, 'Tudo bem! Outro dia então.', null, 1.5); }
  else if (act === 'party') { addFriend(msg.f, opt.yes ? 6 : 3); npcMsg(msg.chat, msg.f, opt.yes ? 'Eba! Te espero às 18h! 🎂' : 'Obrigado(a)! 💛', null, 1.5); }
  else if (act === 'love') { addFriend(msg.f, 8); romanceGain(msg.f, 2); npcMsg(msg.chat, msg.f, ['❤❤❤', 'Você é o(a) melhor!', 'Hehe, até mais tarde, amor.'][S.time.day % 3], null, 1.5); }
  else if (act === 'kid') { npcMsg(msg.chat, msg.f, opt.yes ? 'Obrigado(a)! A sopa fica na mochila, é só dar quando chegar.' : 'Tá bom, eu dou um jeito aqui.', null, 1.5); }
  else if (act === 'ok') { addFriend(msg.f, 2); }
  save();
}
function sendMsgQuiet(chatId, text) { pushMsg(chatId, 'kai', text); }

// ---------------------------------------------------------------- contatos e "pedir número"
function phoneChoices(n) {
  const id = n.id, P = phS();
  if (!hasPhone(id) || P.known.includes(id) || !npcMem(id).met) return [];
  return [{ t: 'Pedir número', fn: () => {
    const r = RES_BY_ID[id];
    if (sm(id).friend < 60 && !partnerOf(id)) { say([r.name + ': Hmm... a gente ainda mal se conhece. Quem sabe depois?']); return; }
    P.known.push(id); if (!P.contacts.includes(id)) P.contacts.push(id);
    addFriend(id, 5);
    say([r.name + ': Claro! Anota aí: ' + phoneNumber(id) + '.', 'Contato salvo: ' + r.name + '. Mande mensagens ou ligue pelo celular!']);
    save();
  } }];
}
function addContactAuto(id) { const P = phS(); if (!hasPhone(id)) return; if (!P.known.includes(id)) P.known.push(id); if (!P.contacts.includes(id)) P.contacts.push(id); }

// ---------------------------------------------------------------- ligações
function startCall(id, incoming, reason) {
  const P = phS(), r = RES_BY_ID[id]; if (!r) return;
  PH.call = { id, dir: incoming ? 'in' : 'out', phase: incoming ? 'incoming' : 'ringing', t: 0, talkT: 0, lines: [], used: [], muted: false, silenced: false, reason: reason || null };
  if (!incoming) { if (!PH.open) openPhone(); if (phTop().app !== 'call') go('call'); }
}
function answerCall() {
  const c = PH.call; if (!c) return;
  c.phase = 'talk'; c.talkT = 0;
  if (!PH.open) openPhone();
  if (phTop().app !== 'call') go('call');
  const r = RES_BY_ID[c.id];
  c.lines = [r.name + ': ' + (c.reason || (partnerOf(c.id) ? 'Oi, amor! Só liguei pra ouvir sua voz.' : 'Alô? Oi, Kai!'))];
}
function callAnswerDecision(id) {
  const r = RES_BY_ID[id], e = r.entry || currentEntry(r);
  if (r.sleeping) return 'dormindo';
  if (['work', 'farm', 'fish'].includes(e[3]) && !partnerOf(id) && Math.random() < 0.5) return 'ocupado';
  return 'ok';
}
function callTopics(id) {
  const t = [{ k: 'como', t: 'Como você está?' }, { k: 'passear', t: 'Bora passear?' }, { k: 'fut', t: 'Vai ter futebol?' }];
  if (partnerOf(id)) t.push({ k: 'amor', t: 'Saudade de você' });
  if (partnerOf(id) && S.romance.status === 'casados' && S.family.kids.length) t.push({ k: 'filhos', t: 'Como estão as crianças?' });
  t.push({ k: 'tchau', t: 'Tchau!' });
  return t;
}
function callSay(k) {
  const c = PH.call, r = RES_BY_ID[c.id], m = sm(c.id);
  if (k === 'tchau') { c.lines.push('Kai: Tchau!', r.name + ': Tchau, Kai! ' + (partnerOf(c.id) ? 'Te amo!' : 'Até mais!')); setTimeout(endCall, 1200); return; }
  c.used.push(k);
  if (c.muted) { c.lines.push(r.name + ': Alô? Kai? Não tô te ouvindo...'); return; }
  if (m.callDay !== S.time.day) { m.callDay = S.time.day; addFriend(c.id, partnerOf(c.id) ? 10 : 6); }
  const ans = k === 'como' ? lifeLine(c.id) : k === 'passear' ? npcReply(c.id, 'bora passear') : k === 'fut' ? npcReply(c.id, 'futebol') : k === 'amor' ? npcReply(c.id, 'saudade') : npcReply(c.id, 'filhos');
  if (k === 'amor') romanceGain(c.id, 2);
  c.lines.push('Kai: ' + callTopics(c.id).find(x => x.k === k).t, r.name + ': ' + ans);
  if (c.lines.length > 6) c.lines.splice(0, c.lines.length - 6);
}
function endCall() {
  const c = PH.call; if (!c) return;
  const P = phS();
  P.calls.unshift({ id: c.id, dir: c.phase === 'talk' || c.done ? c.dir : (c.dir === 'in' ? 'perdida' : 'sem resposta'), at: nowMin(), dur: Math.round(c.talkT) });
  if (P.calls.length > 40) P.calls.length = 40;
  if (c.dir === 'in' && c.phase === 'incoming') notify('msg', 'Chamada perdida', RES_BY_ID[c.id].name, { app: 'tel' });
  PH.call = null; PH.ring = 0;
  if (PH.open && phTop().app === 'call') PH.stack.pop();
  save();
}
function updateCall(dt) {
  const c = PH.call; if (!c) return;
  c.t += dt;
  if (c.phase === 'ringing') {
    if (Math.floor(c.t * 2) !== Math.floor((c.t - dt) * 2) && Audio.ac && !Audio.muted) Audio.tone(440, 0.3, 'sine', 0.03);
    if (c.t > 2.6) {
      const d = callAnswerDecision(c.id), r = RES_BY_ID[c.id];
      if (d === 'ok') { c.phase = 'talk'; c.done = true; c.lines = [r.name + ': Alô? ' + (partnerOf(c.id) ? 'Oi, meu bem!' : 'Oi, Kai! Que bom que ligou.')]; }
      else { c.phase = 'voicemail'; c.lines = [d === 'dormindo' ? r.name + ' não atendeu (deve estar dormindo).' : r.name + ': (caixa postal) Tô ocupado(a) agora, depois te ligo!']; setTimeout(() => { if (PH.call === c) endCall(); }, 2200); if (d === 'ocupado') phS().plan.push({ at: nowMin() + 90, chat: c.id, from: c.id, text: 'Vi que você ligou! Tava trabalhando. O que foi?' }); }
    }
  } else if (c.phase === 'incoming') {
    if (!c.silenced && phS().settings.ring && !phS().settings.silent && Math.floor(c.t * 1.6) !== Math.floor((c.t - dt) * 1.6) && Audio.ac && !Audio.muted) { Audio.tone(784, 0.15, 'square', 0.035); Audio.tone(988, 0.15, 'square', 0.035, 0, 0.18); }
    if (c.t > 14) endCall();
  } else if (c.phase === 'talk') c.talkT += dt;
}

// ---------------------------------------------------------------- banco: movimentações do dinheiro
function bankNote(label) { PH.bankHint = { label, t: 2 }; }
function bankTick(dt) {
  const P = phS();
  if (PH.bankHint && (PH.bankHint.t -= dt) <= 0) PH.bankHint = null;
  if (PH.lastCoins === null) { PH.lastCoins = S.coins; return; }
  const d = S.coins - PH.lastCoins; if (!d) return;
  PH.lastCoins = S.coins;
  let label = PH.bankHint ? PH.bankHint.label : null; PH.bankHint = null;
  if (!label) label = work ? 'Salário (turno)' : menu && menu.tab === 'shop' ? (d > 0 ? 'Venda: ' : 'Compra: ') + SHOPS[menu.shop].name : menu && menu.tab === 'myshop' ? 'Loja do Kai' : (typeof fbm !== 'undefined' && fbm) ? 'Futebol' : build ? 'Construção' : dialog ? (d > 0 ? 'Recompensa' : 'Pagamento') : d > 0 ? 'Entrada' : 'Saída';
  P.bank.unshift({ at: nowMin(), v: d, label, bal: S.coins });
  if (P.bank.length > 80) P.bank.length = 80;
}

// ---------------------------------------------------------------- tempo: bateria, mensagens agendadas, eventos do dia
let phoneLowWarned = false;
function phoneTick(dt) {
  if (mode !== 'play' || !S.time) return;
  const P = phS();
  PH.rt += dt;
  if (!PH.musicInit) { PH.musicInit = true; setTrack(P.music.track || 0); }
  // animação de abrir/fechar
  if (PH.open) { PH.anim = Math.min(1, PH.anim + dt * 5); if (PH.closing) { PH.anim = Math.max(0, PH.anim - dt * 10); if (PH.anim <= 0) { PH.open = false; PH.closing = false; PH.stack = []; phoneCamEnd(); } } }
  // bateria: gasta com o celular aberto, carrega em casa
  const home = area === 'casaKai' || area.startsWith('b_') || (S.props && S.props.houses && S.props.houses[area]);
  const gm = dt * 1440 / (dayMinutes() * 60);
  if (PH.open) P.battery -= dt * (phTop().app === 'camera' || phTop().app === 'videos' ? 0.11 : 0.06);
  else if (home) P.battery += gm * 0.8; else P.battery -= gm / 70;
  P.battery = clamp(P.battery, 0, 100);
  if (P.battery < 15 && !phoneLowWarned) { phoneLowWarned = true; notify('event', 'Bateria fraca', 'Carregue o celular em casa.'); }
  if (P.battery > 30) phoneLowWarned = false;
  if (P.battery <= 0 && PH.open) { closePhone(); toast('O celular desligou: bateria acabou.'); }
  // mensagens chegando
  for (let i = P.pending.length - 1; i >= 0; i--) { const q = P.pending[i]; if ((q.wait -= dt) <= 0) { P.pending.splice(i, 1); pushMsg(q.chat, q.from, q.text, q.extra); } }
  const now = nowMin();
  for (let i = P.plan.length - 1; i >= 0; i--) { const q = P.plan[i]; if (now >= q.at) { P.plan.splice(i, 1); if (q.call) { if (!PH.call) { if (P.settings.silent) { P.calls.unshift({ id: q.from, dir: 'perdida', at: now, dur: 0 }); notify('msg', 'Chamada perdida', RES_BY_ID[q.from].name, { app: 'tel' }); } else startCall(q.from, true, q.text); } } else if (!q.check || q.check()) pushMsg(q.chat, q.from, q.text, q.extra); } }
  if (PH.banner && (PH.banner.t -= dt) <= 0) PH.banner = null;
  updateCall(dt);
  bankTick(dt);
  phoneMusicTick();
  if (typeof phoneMediaTick === 'function') phoneMediaTick(dt);
  // chegou ao destino marcado no mapa
  if (P.waypoint && area === 'world' && Math.hypot(player.x - P.waypoint.x, player.y - P.waypoint.y) < 160) { toast('Você chegou: ' + P.waypoint.name); P.waypoint = null; }
}
// virada do dia: o celular planeja mensagens com contexto (só de contatos, e só quando há motivo)
function phoneNewDay() {
  const P = phS(), d = S.time.day, base = d * 1440, R = S.romance;
  P.plan = P.plan.filter(q => q.at >= base - 60);
  if (S.time.min >= 6 * 60) P.battery = 100;   // dormiu: celular carregado
  const plan = (h, chat, from, text, extra, check) => P.plan.push({ at: base + Math.round(h * 60), chat, from, text, extra: extra || null, check: check || null });
  // par / família
  if (R && isContact(R.id)) {
    const p = R.id, name = RES_BY_ID[p].name;
    if (R.status !== 'casados') {
      plan(10 + (hashStr('a' + d) & 3), p, p, ['Bom dia! Já pensei em você hoje 😊', 'Oi, amor! O que vai fazer hoje?', 'Bom dia, meu bem! Dormiu bem?'][d % 3], { opts: [{ t: 'Pensei em você também ❤', act: 'love:' + p }, { t: 'Vou trabalhar, depois te vejo!', act: 'ok:' + p }] });
      plan(19.5, p, p, 'Onde você está? Senti sua falta hoje...', { opts: [{ t: 'Tô indo te ver!', act: 'love:' + p }, { t: 'Desculpa, dia corrido!', act: 'ok:' + p }] }, () => sm(p).talkDay !== S.time.day);
      if (Math.random() < 0.25) P.plan.push({ at: base + 21 * 60, call: true, from: p, text: 'Oi, amor... só liguei pra dar boa noite.' });
    } else {
      const g = ensureGroup('g_familia', [p]);
      const k = S.family.kids[(d) % Math.max(1, S.family.kids.length)];
      plan(9, 'g_familia', p, k ? (kidStage(k) === 'bebe' ? k.name + ' dormiu a noite toda! 😴' : k.name + ' acordou cheio(a) de energia hoje!') : 'Bom dia, amor! Café na mesa ☕', { photo: null });
      if (k) plan(13, 'g_familia', p, k.name + ' perguntou de você. Vem almoçar?', { opts: [{ t: 'Já vou! ❤', act: 'love:' + p }, { t: 'Hoje não dá, beijo neles!', act: 'ok:' + p }] });
      if (k) plan(16, 'g_familia', p, k.name + ' está com fome... consegue trazer uma sopa?', { opts: [{ t: 'Levo sim!', act: 'kid:yes', yes: true }, { t: 'Não vou conseguir...', act: 'kid:no' }] }, () => k.needs.fome < 45);
      plan(18.5, 'g_familia', p, 'Jantar às 19h. Fiz sopa de cogumelo 🍲');
      void g; void name;
    }
  }
  // amigos chamando para passear (personalidade e amizade)
  const friends = P.contacts.filter(id => RES_BY_ID[id] && !partnerOf(id) && hearts(id) >= 3 && !RES_BY_ID[id].child);
  if (friends.length && Math.random() < 0.45) {
    const id = friends[Math.floor(Math.random() * friends.length)], r = RES_BY_ID[id];
    const txt = { alegre: 'Kaiii! Bora dar uma volta hoje? 🌸', brincalhao: 'E aí, herói! Partiu rolê mais tarde?', aventureira: 'Bora explorar um pouco hoje?', timido: 'Oi Kai... se quiser passear mais tarde, eu topo.', serio: 'Kai. Se estiver livre, podemos dar uma volta.', gentil: 'Querido, passa aqui mais tarde pra uma volta?', sonhadora: 'O céu tá lindo hoje... bora passear?', trabalhador: 'Depois do trabalho, uma volta?' }[r.pers] || 'Bora passear mais tarde?';
    plan(14 + (hashStr(id + d) & 3), id, id, txt, { cat: 'invite', opts: [{ t: 'Bora!', act: 'walk:' + id, yes: true }, { t: 'Hoje não dá', act: 'walk:' + id }] });
  }
  // um amigo puxa assunto (sobre algo que você contou, novidades do vale ou a vida dele)
  const chatty = P.contacts.filter(id => RES_BY_ID[id] && hearts(id) >= 2 && !partnerOf(id));
  if (chatty.length && Math.random() < 0.4) { const id = chatty[(hashStr('st' + d) >>> 0) % chatty.length]; plan(12 + (hashStr(id + d) & 3), id, id, chatSmallTalk(id)); }
  // aniversário de contato: convite para a festa
  const host = typeof partyHostToday === 'function' ? partyHostToday() : null;
  if (host && isContact(host.id)) plan(9, host.id, host.id, 'Hoje é meu aniversário! 🎂 Festa lá em casa às 18h. Você vem?', { cat: 'bday', opts: [{ t: 'Vou sim! Parabéns!', act: 'party:' + host.id, yes: true }, { t: 'Parabéns! 🎉', act: 'party:' + host.id }] });
  for (const id of P.contacts) if (isBirthday(id) && (!host || host.id !== id)) plan(8, null, null, null, null, () => { notify('bday', 'Aniversário', 'Hoje é aniversário de ' + RES_BY_ID[id].name + '!', { app: 'chat', chat: id }); return false; });
  // festa da vila: aviso no grupo do vale
  const hol = holidayToday();
  const vale = P.contacts.filter(id => RES_BY_ID[id] && !RES_BY_ID[id].child);
  if (hol && vale.length >= 2) { ensureGroup('g_vale', vale.concat(P.contacts.includes('aurora') ? ['aurora'] : [])); const who = isContact('aurora') ? 'aurora' : vale[0]; plan(8, 'g_vale', who, 'Hoje é ' + hol.name + '! Todo mundo na praça às ' + Math.floor(hol.start) + 'h 🎉', { cat: 'event' }); }
  for (const ci of (typeof cityFestToday === 'function' ? cityFestToday() : [])) plan(8.2, null, null, null, null, () => { notify('event', 'Evento', 'Hoje é a festa de ' + ci.name + '!'); return false; });
  // futebol de sexta no grupo
  const fe = fbEvent(d, isFriday(d));
  const fbMates = P.contacts.filter(id => FB_ATTR[id]);
  if (fe && fe.kind === 'sexta' && fbMates.length >= 2) {
    ensureGroup('g_futebol', fbMates);
    plan(9.2, 'g_futebol', fbMates.includes('joca') ? 'joca' : fbMates[0], 'Hoje tem jogo às ' + fe.start + 'h no campo! Quem vem? ⚽', { cat: 'invite' }, () => !fbDone(fe));
    plan(9.4, 'g_futebol', fbMates[1], ['Tô dentro!', 'Eu vou!', 'Bora!'][d % 3], null, () => !fbDone(fe));
  }
  // chefe lembrando do turno
  if (S.job && JOBS[S.job.id] && isContact(JOBS[S.job.id].boss) && Math.random() < 0.4) { const J = JOBS[S.job.id]; plan(J.hours[0] - 1, J.boss, J.boss, 'Bom dia! Turno hoje às ' + J.hours[0] + 'h no(a) ' + J.where + '.', null, () => S.job && S.job.lastShift !== S.time.day); }
  save();
}
// convite do futebol pelo celular (substitui o diálogo quando quem convida é contato)
function phoneFootballInvite(ev, host) {
  if (!isContact(host)) return false;
  const r = RES_BY_ID[host];
  pushMsg(host, host, ev.kind === 'sexta' ? 'Ei, Kai! Hoje tem futebol de várzea às ' + ev.start + 'h no campo (oeste da Vila do Rio). Bora jogar no meu time? ⚽' : 'Kai, bora um amistoso hoje às ' + ev.start + 'h no campo?', { cat: 'invite', opts: [{ t: 'Bora!', act: 'fb:' + ev.day, yes: true }, { t: 'Hoje não dá', act: 'fb:' + ev.day }] });
  void r; return true;
}

// ---------------------------------------------------------------- música (composições originais do jogo)
const TRACKS = [
  { name: 'Tema do Vale', by: 'Vale da Lanterna', mel: null },
  { name: 'Manhã na Vila', by: 'Mel & Banda da Praça', spb: 0.24, mel: [67, 71, 74, 0, 72, 71, 69, 0, 67, 69, 71, 74, 76, 0, 74, 0, 72, 71, 69, 67, 69, 0, 71, 0, 67, 0, 0, 0, 74, 72, 71, 0], bass: [43, 47, 50, 47, 45, 48, 43, 50] },
  { name: 'Noite de Lanternas', by: 'Nina', spb: 0.34, mel: [69, 0, 72, 0, 76, 0, 74, 72, 71, 0, 72, 0, 69, 0, 0, 0, 67, 0, 71, 0, 74, 0, 72, 71, 69, 0, 67, 0, 64, 0, 0, 0], bass: [45, 45, 41, 41, 43, 43, 40, 40] },
  { name: 'Arraiá do Vale', by: 'Seu Zeca e os Barqueiros', spb: 0.2, mel: [72, 74, 76, 72, 77, 76, 74, 0, 74, 76, 77, 74, 79, 77, 76, 0, 76, 77, 79, 76, 81, 79, 77, 76, 74, 72, 74, 76, 72, 0, 0, 0], bass: [48, 55, 50, 55, 53, 48, 55, 48] },
  { name: 'Várzea de Sexta', by: 'Joca MC', spb: 0.22, mel: [64, 0, 64, 67, 0, 69, 67, 0, 64, 0, 62, 64, 0, 0, 60, 0, 64, 0, 64, 67, 0, 69, 72, 0, 71, 69, 67, 0, 64, 0, 0, 0], bass: [40, 40, 47, 47, 45, 45, 43, 47] }
];
const DEFAULT_MEL = Audio.MEL, DEFAULT_BASS = Audio.BASS;
function setTrack(i) {
  const T = TRACKS[i], P = phS(); P.music.track = i;
  Audio.MEL = T.mel || DEFAULT_MEL; Audio.BASS = T.bass || DEFAULT_BASS; Audio.spb = T.spb || 0.27; Audio.step = 0;
}
function phoneMusicTick() { const P = phS(); Audio.musicOn = P.music.playing !== false; }

// ---------------------------------------------------------------- desenho: moldura, barra de status, tela inicial
const PHONE_WALLS = [['#7b5aa6', '#f08a8a'], ['#1b3a5a', '#4a90e2'], ['#2f6b3a', '#9be36a'], ['#3a2238', '#ff9ec7'], ['#14201a', '#c9a14a'], ['#0e1424', '#6a5acd']];
const APPS = [
  ['msgs', 'Mensagens', '#4cc96a'], ['gram', 'VilaGram', '#e0507a'], ['videos', 'Vídeos', '#2a2238'], ['contacts', 'Contatos', '#f0a040'],
  ['tel', 'Telefone', '#3ab0e0'], ['camera', 'Câmera', '#555c70'], ['gallery', 'Galeria', '#f2c94c'], ['cal', 'Calendário', '#ffffff'],
  ['bank', 'Banco', '#2f8a4a'], ['maps', 'Mapas', '#4a90e2'], ['music', 'Música', '#c8423b'], ['settings', 'Ajustes', '#8a8a9a']];
function phoneRect() {
  const w = Math.min(W - 24 - SAFE.l - SAFE.r, 760), h = Math.min(H - 16 - SAFE.t - SAFE.b, 430);
  return { x: (W - w) / 2, y: (H - h) / 2, w, h };
}
function screenRect() { const r = phoneRect(); return { x: r.x + 26, y: r.y + 10, w: r.w - 52, h: r.h - 20 }; }
function drawWallpaper(sr) {
  const P = phS(), wv = P.settings.wall;
  if (typeof wv === 'string') { const img = photoImg(wv); if (img && img.complete && img.naturalWidth) { ctx.drawImage(img, sr.x, sr.y, sr.w, sr.h); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(sr.x, sr.y, sr.w, sr.h); return; } }
  const [a, b] = PHONE_WALLS[(typeof wv === 'number' ? wv : 0) % PHONE_WALLS.length];
  const g = ctx.createLinearGradient(sr.x, sr.y, sr.x + sr.w, sr.y + sr.h); g.addColorStop(0, a); g.addColorStop(1, b);
  ctx.fillStyle = g; ctx.fillRect(sr.x, sr.y, sr.w, sr.h);
  ctx.fillStyle = 'rgba(255,255,255,0.07)'; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(sr.x + sr.w * (0.15 + i * 0.2), sr.y + sr.h * (0.3 + (i % 2) * 0.4), 40 + i * 12, 0, 7); ctx.fill(); }
}
function pbtn(t, x, y, w, h, fn, style, size) {
  ctx.fillStyle = style === 'on' ? '#7b5aa6' : style === 'off' ? 'rgba(0,0,0,0.12)' : style === 'red' ? '#e0505a' : style === 'green' ? '#3fbf5f' : style === 'ghost' ? 'rgba(255,255,255,0.14)' : '#eef0f6';
  ctx.beginPath(); ctx.roundRect(x, y, w, h, Math.min(14, h / 2)); ctx.fill();
  ctx.fillStyle = style === 'on' || style === 'red' || style === 'green' || style === 'ghost' ? '#ffffff' : style === 'off' ? 'rgba(40,40,60,0.4)' : '#2a2238';
  ctx.font = `700 ${size || Math.min(14, h * 0.45)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x + w / 2, y + h / 2 + 1, w - 8);
  if (fn && style !== 'off') addBtn(x, y, w, h, fn);
}
function ptext(t, x, y, size, col, weight = 600, maxW, align = 'left') { ctx.font = `${weight} ${size}px ${FONT}`; ctx.fillStyle = col; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y, maxW); }
function batteryIcon(x, y) {
  const b = phS().battery;
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.strokeRect(x, y - 5, 22, 10); ctx.fillStyle = '#fff'; ctx.fillRect(x + 22, y - 2, 2, 4);
  ctx.fillStyle = b < 15 ? '#ff5a5a' : b < 40 ? '#ffd84a' : '#7be36a'; ctx.fillRect(x + 2, y - 3, 18 * b / 100, 6);
}
// retrato de um morador (sprite do jogo) ou do Kai
function portrait(id, x, y, s) {
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, s / 2, 0, 7); ctx.fillStyle = '#e8e0f0'; ctx.fill(); ctx.clip();
  ctx.imageSmoothingEnabled = false;
  if (id === 'kai' || id === 'floco') {
    const sp = id === 'kai' ? HERO.down[0] : DOG[0];
    if (sp) ctx.drawImage(sp.img, x - s * 0.45, y - s * 0.32, s * 0.9, s * 0.9 * sp.h / sp.w);
  } else if (typeof id === 'string' && id.startsWith('p')) { const img = photoImg(id); if (img && img.complete && img.naturalWidth) ctx.drawImage(img, x - s / 2, y - s / 2, s, s); }
  else if (NPC[id]) { const sp = NPC[id]; ctx.drawImage(sp.img, x - s * 0.45, y - s * 0.3, s * 0.9, s * 0.9 * sp.h / sp.w); }
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, s / 2, 0, 7); ctx.stroke();
}
function drawPhone() {
  if (!PH.open) return;
  const app = phTop().app;
  if (app === 'camera') { drawCameraUI(); return; }
  const r = phoneRect(), k = PH.anim, e = 1 - Math.pow(1 - k, 3);
  ctx.save();
  ctx.fillStyle = `rgba(10,12,20,${0.5 * e})`; ctx.fillRect(0, 0, W, H);
  addBtn(0, 0, W, H, () => {});
  ctx.translate(W / 2, H / 2 + (1 - e) * H * 0.6); ctx.scale(0.85 + 0.15 * e, 0.85 + 0.15 * e); ctx.translate(-W / 2, -H / 2);
  ctx.globalAlpha = e;
  // corpo
  ctx.fillStyle = '#16141c'; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 28); ctx.fill();
  ctx.strokeStyle = '#3a3646'; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = '#0a0a10'; ctx.beginPath(); ctx.arc(r.x + 13, r.y + r.h / 2, 4, 0, 7); ctx.fill();
  const sr = screenRect();
  ctx.save(); ctx.beginPath(); ctx.roundRect(sr.x, sr.y, sr.w, sr.h, 18); ctx.clip();
  drawWallpaper(sr);
  const cy = sr.y + 30, ch = sr.h - 30;
  if (k >= 1 || true) {
    const fn = PHONE_APPS[app] || drawHome;
    if (app !== 'home') { ctx.fillStyle = app === 'videos' ? '#0c0c12' : 'rgba(250,250,255,0.97)'; ctx.fillRect(sr.x, cy, sr.w, ch); }
    fn(sr.x, cy, sr.w, ch, phTop());
  }
  // barra de status
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(sr.x, sr.y, sr.w, 30);
  pbtn('‹ Voltar', sr.x + 6, sr.y + 3, 74, 24, phoneBack, 'ghost', 12);
  pbtn('⌂', sr.x + 84, sr.y + 3, 30, 24, phoneHome, 'ghost', 14);
  ptext(clockText(), sr.x + sr.w / 2, sr.y + 15, 13, '#fff', 700, 80, 'center');
  const un = unreadNotifs();
  pbtn('🔔' + (un ? ' ' + un : ''), sr.x + sr.w - 150, sr.y + 3, 50, 24, () => go('notifs'), un ? 'on' : 'ghost', 12);
  ptext(Math.round(phS().battery) + '%', sr.x + sr.w - 62, sr.y + 15, 11, '#fff', 700, 40, 'right');
  batteryIcon(sr.x + sr.w - 56, sr.y + 15);
  pbtn('✕', sr.x + sr.w - 28, sr.y + 3, 24, 24, closePhone, 'red', 12);
  ctx.restore();
  ctx.restore();
}
function drawHome(x, y, w, h) {
  const c = calOf(), P = phS();
  ptext(clockText(), x + 24, y + 30, 34, '#fff', 700);
  ptext(weekday() + ', ' + dateText(c.m, c.d) + ' de ' + c.y + ' · ' + weatherName(), x + 26, y + 58, 12, 'rgba(255,255,255,0.9)', 600, w * 0.42);
  // widget de notificações recentes
  const ns = P.notifs.filter(n => !n.read).slice(0, 2);
  ns.forEach((n, i) => {
    const bx = x + 20, by = y + 78 + i * 40;
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.roundRect(bx, by, w * 0.42 - 10, 34, 10); ctx.fill();
    ptext(n.title, bx + 8, by + 11, 11, '#2a2238', 700, w * 0.42 - 26); ptext(n.text, bx + 8, by + 25, 10, '#4a4458', 500, w * 0.42 - 26);
    addBtn(bx, by, w * 0.42 - 10, 34, () => openNotif(n));
  });
  if (!ns.length) ptext('Sem notificações novas', x + 26, y + 92, 11, 'rgba(255,255,255,0.75)', 500);
  // ícones
  const gx = x + w * 0.46, gw = w * 0.52, cols = 4, cell = Math.min(gw / cols, (h - 16) / 3);
  APPS.forEach(([id, name, col], i) => {
    const cx = gx + (i % cols) * cell + cell / 2, cy2 = y + 10 + Math.floor(i / cols) * cell + cell * 0.42, s = cell * 0.52;
    ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(cx - s / 2, cy2 - s / 2, s, s, s * 0.26); ctx.fill();
    appGlyph(id, cx, cy2, s);
    ptext(name, cx, cy2 + s / 2 + 10, 10, '#fff', 700, cell - 4, 'center');
    const badge = id === 'msgs' ? unreadMsgs() : id === 'gram' ? gramUnread() : 0;
    if (badge) { ctx.fillStyle = '#ff3b4a'; ctx.beginPath(); ctx.arc(cx + s / 2 - 2, cy2 - s / 2 + 2, 9, 0, 7); ctx.fill(); ptext(String(badge), cx + s / 2 - 2, cy2 - s / 2 + 3, 10, '#fff', 700, 16, 'center'); }
    addBtn(cx - cell / 2, cy2 - s / 2 - 4, cell, s + 22, () => go(id));
  });
}
function appGlyph(id, x, y, s) {
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff'; ctx.lineWidth = s * 0.07;
  const u = s / 10;
  switch (id) {
    case 'msgs': ctx.beginPath(); ctx.roundRect(x - 3 * u, y - 2.5 * u, 6 * u, 4.5 * u, u * 1.5); ctx.fill(); ctx.beginPath(); ctx.moveTo(x - 2 * u, y + 1.5 * u); ctx.lineTo(x - 2.5 * u, y + 3.5 * u); ctx.lineTo(x, y + 1.5 * u); ctx.fill(); break;
    case 'gram': ctx.beginPath(); ctx.roundRect(x - 3 * u, y - 3 * u, 6 * u, 6 * u, 1.8 * u); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, 1.4 * u, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(x + 1.9 * u, y - 1.9 * u, 0.4 * u, 0, 7); ctx.fill(); break;
    case 'videos': ctx.fillStyle = '#ff3b6a'; ctx.beginPath(); ctx.moveTo(x - 1.6 * u, y - 2.4 * u); ctx.lineTo(x + 2.6 * u, y); ctx.lineTo(x - 1.6 * u, y + 2.4 * u); ctx.fill(); break;
    case 'contacts': ctx.beginPath(); ctx.arc(x, y - 1.2 * u, 1.6 * u, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(x, y + 2.4 * u, 2.8 * u, 1.6 * u, 0, Math.PI, 0); ctx.fill(); break;
    case 'tel': ctx.beginPath(); ctx.arc(x, y, 2.8 * u, 2.3, 4.1); ctx.lineWidth = u * 1.4; ctx.stroke(); break;
    case 'camera': ctx.beginPath(); ctx.roundRect(x - 3 * u, y - 2 * u, 6 * u, 4.4 * u, u); ctx.fill(); ctx.fillStyle = '#555c70'; ctx.beginPath(); ctx.arc(x, y + 0.2 * u, 1.4 * u, 0, 7); ctx.fill(); break;
    case 'gallery': ctx.fillStyle = '#2f8a4a'; ctx.beginPath(); ctx.moveTo(x - 3 * u, y + 2.5 * u); ctx.lineTo(x - 0.5 * u, y - 1 * u); ctx.lineTo(x + 3 * u, y + 2.5 * u); ctx.fill(); ctx.fillStyle = '#c8423b'; ctx.beginPath(); ctx.arc(x + 1.5 * u, y - 1.8 * u, u, 0, 7); ctx.fill(); break;
    case 'cal': ctx.fillStyle = '#e0505a'; ctx.fillRect(x - 3 * u, y - 3 * u, 6 * u, 1.6 * u); ptext(String(calOf().d), x, y + 0.9 * u, 3.4 * u, '#2a2238', 700, 6 * u, 'center'); break;
    case 'bank': ptext('$', x, y + 0.3 * u, 5 * u, '#fff', 700, 6 * u, 'center'); break;
    case 'maps': ctx.beginPath(); ctx.arc(x, y - 0.8 * u, 2 * u, Math.PI, 0); ctx.lineTo(x, y + 3 * u); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#4a90e2'; ctx.beginPath(); ctx.arc(x, y - 0.8 * u, 0.8 * u, 0, 7); ctx.fill(); break;
    case 'music': ctx.fillRect(x + 0.6 * u, y - 3 * u, 0.8 * u, 4.6 * u); ctx.beginPath(); ctx.arc(x - 0.4 * u, y + 1.8 * u, 1.3 * u, 0, 7); ctx.fill(); break;
    case 'settings': ctx.beginPath(); ctx.arc(x, y, 2.4 * u, 0, 7); ctx.lineWidth = u * 1.1; ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, 0.8 * u, 0, 7); ctx.fill(); break;
  }
}
// cabeçalho de app
function appHeader(x, y, w, title, right) {
  ctx.fillStyle = 'rgba(123,90,166,0.12)'; ctx.fillRect(x, y, w, 34);
  ptext(title, x + 14, y + 17, 15, '#2a2238', 700, w * 0.5);
  if (right) right();
  return y + 38;
}
// lista paginada genérica
function pageList(x, y, w, h, items, rowH, drawRow, key) {
  const st = phTop(); const per = Math.max(1, Math.floor((h - 30) / rowH)), pages = Math.max(1, Math.ceil(items.length / per));
  st[key] = clamp(st[key] || 0, 0, pages - 1);
  items.slice(st[key] * per, st[key] * per + per).forEach((it, i) => drawRow(it, x, y + i * rowH, w, rowH - 4));
  if (pages > 1) {
    ptext((st[key] + 1) + '/' + pages, x + w / 2, y + h - 12, 11, '#6a6478', 600, 60, 'center');
    pbtn('▲', x + w / 2 - 80, y + h - 24, 44, 22, () => { st[key]--; }, st[key] > 0 ? null : 'off', 11);
    pbtn('▼', x + w / 2 + 36, y + h - 24, 44, 22, () => { st[key]++; }, st[key] < pages - 1 ? null : 'off', 11);
  }
}

// ---------------------------------------------------------------- app: Mensagens
function drawMsgs(x, y, w, h) {
  const P = phS();
  y = appHeader(x, y, w, 'Mensagens', () => pbtn('+ Nova', x + w - 84, y + 6, 76, 22, () => go('pick', { purpose: 'chat' }), 'on', 11));
  const chats = Object.values(P.chats).filter(c => c.msgs.length || c.group).sort((a, b) => (b.msgs.length ? b.msgs[b.msgs.length - 1].at : 0) - (a.msgs.length ? a.msgs[a.msgs.length - 1].at : 0));
  if (!chats.length) { ptext('Nenhuma conversa ainda.', x + 16, y + 20, 12, '#6a6478'); ptext('Peça o número dos moradores conversando com eles ("Pedir número").', x + 16, y + 40, 11, '#6a6478', 500, w - 32); return; }
  pageList(x, y, w, h - 38, chats, 46, (c, rx, ry, rw, rh) => {
    const last = c.msgs[c.msgs.length - 1];
    ctx.fillStyle = c.unread ? 'rgba(123,90,166,0.10)' : 'transparent'; ctx.fillRect(rx, ry, rw, rh);
    if (c.group) { ctx.fillStyle = '#7b5aa6'; ctx.beginPath(); ctx.arc(rx + 26, ry + rh / 2, 17, 0, 7); ctx.fill(); ptext(c.name.slice(-2), rx + 26, ry + rh / 2 + 1, 15, '#fff', 700, 30, 'center'); }
    else portrait(c.id, rx + 26, ry + rh / 2, 34);
    ptext(c.name, rx + 52, ry + 13, 13, '#2a2238', 700, rw * 0.55);
    ptext(last ? ((last.f === 'kai' ? 'Você: ' : c.group && RES_BY_ID[last.f] ? RES_BY_ID[last.f].name + ': ' : '') + (last.photo ? '📷 Foto' : last.vid != null ? '🎬 Vídeo' : last.t)) : 'Grupo criado', rx + 52, ry + 31, 11, '#6a6478', 500, rw - 140);
    if (last) ptext(timeLabel(last.at), rx + rw - 12, ry + 13, 10, '#8a8496', 600, 90, 'right');
    if (c.unread) { ctx.fillStyle = '#3fbf5f'; ctx.beginPath(); ctx.arc(rx + rw - 22, ry + 31, 9, 0, 7); ctx.fill(); ptext(String(c.unread), rx + rw - 22, ry + 32, 10, '#fff', 700, 16, 'center'); }
    addBtn(rx, ry, rw, rh, () => go('chat', { chat: c.id }));
  }, 'pg');
}
function drawChat(x, y, w, h, st) {
  const c = chatOf(st.chat); c.unread = 0;
  for (const n of phS().notifs) if (n.open && n.open.chat === st.chat) n.read = true;
  const title = c.group ? c.name + ' · ' + (c.members.length + 1) + ' pessoas' : c.name + (partnerOf(c.id) ? ' ❤' : '');
  y = appHeader(x, y, w, title, () => { if (!c.group) { pbtn('📞', x + w - 90, y + 6, 38, 22, () => { startCall(c.id, false); }, null, 12); pbtn('Perfil', x + w - 48, y + 6, 42, 22, () => go('gprofile', { id: c.id }), null, 10); } });
  // mensagens (as mais recentes embaixo)
  const inputH = 74, area = h - 38 - inputH, bub = [];
  const maxW = w * 0.62;
  let yy = y + area - 6;
  st.off = st.off || 0;
  const msgs = c.msgs.slice(0, c.msgs.length - st.off);
  for (let i = msgs.length - 1; i >= 0 && yy > y + 10; i--) {
    const m = msgs[i], mine = m.f === 'kai';
    ctx.font = `600 12px ${FONT}`;
    const lines = wrapLines((c.group && !mine && RES_BY_ID[m.f] ? RES_BY_ID[m.f].name + ': ' : '') + (m.t || ''), maxW - 20);
    const ph = m.photo || m.vid != null ? 70 : 0, bh = lines.length * 15 + 20 + ph;
    yy -= bh + 6; if (yy < y + 4) break;
    const bw = Math.min(maxW, Math.max(90, ...lines.map(l => ctx.measureText(l).width + 24)), ph ? maxW : 9999);
    const bx = mine ? x + w - bw - 10 : x + 10;
    ctx.fillStyle = mine ? '#7b5aa6' : '#e9e6f2'; ctx.beginPath(); ctx.roundRect(bx, yy, bw, bh, 12); ctx.fill();
    lines.forEach((l, j) => ptext(l, bx + 12, yy + 14 + j * 15, 12, mine ? '#fff' : '#2a2238', 600, bw - 20));
    if (m.photo) { const img = photoImg(m.photo); if (img && img.naturalWidth) ctx.drawImage(img, bx + 10, yy + lines.length * 15 + 6, 96, 64); addBtn(bx, yy, bw, bh, () => go('photo', { id: m.photo })); }
    if (m.vid != null) { drawVideoThumb(m.vid, bx + 10, yy + lines.length * 15 + 6, 96, 64); addBtn(bx, yy, bw, bh, () => typeof m.vid === 'object' ? go('vidview', { id: m.vid.u }) : go('videos', { i: m.vid })); }
    ptext(timeLabel(m.at), mine ? bx + bw - 8 : bx + bw - 8, yy + bh - 8, 9, mine ? 'rgba(255,255,255,0.75)' : '#8a8496', 500, 80, 'right');
    // opções de resposta para convites
    if (m.opts && !mine) bub.push(m);
  }
  const typingNow = phS().pending.filter(q => q.chat === c.id);
  if (typingNow.length && !st.off) { const who = RES_BY_ID[typingNow[0].from]; ctx.fillStyle = '#e9e6f2'; ctx.beginPath(); ctx.roundRect(x + 10, y + area - 28, 150, 22, 11); ctx.fill(); ptext((who ? who.name : '') + ' está digitando' + '.'.repeat(1 + Math.floor(PH.rt * 3) % 3), x + 20, y + area - 17, 11, '#6a6478', 600, 140); }
  if (msgs.length > 6) pbtn('Mais antigas', x + w / 2 - 50, y + 4, 100, 20, () => { st.off = Math.min(c.msgs.length - 3, st.off + 4); }, null, 10);
  if (st.off) pbtn('Recentes ▼', x + w / 2 - 50, y + area - 24, 100, 20, () => { st.off = Math.max(0, st.off - 4); }, 'on', 10);
  // área de resposta
  const iy = y + area;
  ctx.fillStyle = '#f0eef6'; ctx.fillRect(x, iy, w, inputH);
  const pend = c.msgs.slice().reverse().find(m => m.opts && m.f !== 'kai');
  let opts;
  if (pend) opts = pend.opts.map(o => ({ t: o.t, fn: () => { pend.chat = c.id; phoneAct(pend, o); } }));
  else if (c.group) opts = [{ t: 'Oi, pessoal!' }, { t: 'Vai ter futebol?' }, { t: 'Alguma novidade?' }].map(o => ({ t: o.t, fn: () => sendMsg(c.id, o.t) }));
  else {
    const q = ['Oi! Tudo bem?', 'O que tá fazendo?', 'Bora sair mais tarde?', 'Alguma novidade?'];
    if (partnerOf(c.id)) q.splice(1, 0, 'Saudade de você ❤'); if (partnerOf(c.id) && S.family.kids.length) q.splice(2, 0, 'Como estão as crianças?');
    opts = q.slice(0, 4).map(t => ({ t, fn: () => sendMsg(c.id, t) }));
  }
  const ow = (w - 20 - (opts.length - 1) * 6) / opts.length;
  opts.forEach((o, i) => pbtn(o.t, x + 10 + i * (ow + 6), iy + 6, ow, 26, o.fn, pend ? 'on' : null, 11));
  addBtn(x + 10, iy + 38, w - 130, 28, () => phoneAsk('Escreva uma mensagem…', v => sendMsg(c.id, v), [x + 10, iy + 36, w - 130, 32]));
  ctx.fillStyle = 'rgba(123,90,166,0.25)'; ctx.beginPath(); ctx.roundRect(x + 10, iy + 38, w - 130, 28, 14); ctx.fill();
  ptext('✎ Digitar…', x + 24, iy + 52, 12, '#4a4458', 600);
  pbtn('📷 Foto', x + w - 114, iy + 38, 50, 28, () => go('gallery', { pick: c.id }), null, 11);
  pbtn('🎬', x + w - 58, iy + 38, 48, 28, () => go('videos', { shareTo: c.id }), null, 12);
}
function wrapLines(t, maxW) {
  const out = []; let line = '';
  for (const wd of String(t).split(' ')) { const test = line ? line + ' ' + wd : wd; if (ctx.measureText(test).width > maxW && line) { out.push(line); line = wd; } else line = test; }
  if (line) out.push(line); return out.slice(0, 6);
}

// ---------------------------------------------------------------- app: Contatos (agenda)
function drawContacts(x, y, w, h, st) {
  const P = phS();
  y = appHeader(x, y, w, 'Contatos (' + P.contacts.length + ')', () => {
    pbtn('🔍 ' + (st.q || 'Pesquisar'), x + w - 250, y + 6, 150, 22, () => phoneAsk('Nome…', v => { st.q = v; st.pg = 0; }, [x + w - 250, y + 4, 150, 28], st.q || ''), st.q ? 'on' : null, 11);
    if (st.q) pbtn('✕', x + w - 96, y + 6, 22, 22, () => { st.q = ''; }, null, 10);
    pbtn('+ Adicionar', x + w - 70, y + 6, 64, 22, () => go('addcontact'), 'on', 10);
  });
  const list = P.contacts.filter(id => RES_BY_ID[id] && (!st.q || RES_BY_ID[id].name.toLowerCase().includes(st.q.toLowerCase())));
  if (!list.length) { ptext(st.q ? 'Ninguém com esse nome.' : 'Sem contatos. Converse com os moradores e escolha "Pedir número".', x + 16, y + 20, 12, '#6a6478', 500, w - 32); return; }
  pageList(x, y, w, h - 38, list, 46, (id, rx, ry, rw, rh) => {
    const r = RES_BY_ID[id];
    portrait(id, rx + 26, ry + rh / 2, 34);
    ptext(r.name + (partnerOf(id) ? ' ❤' : ''), rx + 52, ry + 13, 13, '#2a2238', 700, rw * 0.4);
    ptext(phoneNumber(id) + ' · ' + r.prof, rx + 52, ry + 31, 10, '#6a6478', 500, rw * 0.42);
    pbtn('💬', rx + rw - 190, ry + 8, 40, 26, () => go('chat', { chat: id }), null, 13);
    pbtn('📞', rx + rw - 144, ry + 8, 40, 26, () => startCall(id, false), null, 13);
    pbtn('Perfil', rx + rw - 98, ry + 8, 46, 26, () => go('gprofile', { id }), null, 10);
    pbtn('Remover', rx + rw - 48, ry + 8, 44, 26, () => { if (st.del === id) { P.contacts.splice(P.contacts.indexOf(id), 1); st.del = null; save(); } else st.del = id; }, st.del === id ? 'red' : 'off' === 0 ? null : null, 9);
  }, 'pg');
}
function drawAddContact(x, y, w, h, st) {
  const P = phS();
  y = appHeader(x, y, w, 'Adicionar contato');
  const list = P.known.filter(id => !P.contacts.includes(id) && RES_BY_ID[id]);
  if (!list.length) { ptext('Nenhum número novo. Peça o número dos moradores conversando com eles.', x + 16, y + 20, 12, '#6a6478', 500, w - 32); return; }
  pageList(x, y, w, h - 38, list, 46, (id, rx, ry, rw, rh) => {
    portrait(id, rx + 26, ry + rh / 2, 34); ptext(RES_BY_ID[id].name + ' · ' + phoneNumber(id), rx + 52, ry + rh / 2, 13, '#2a2238', 700, rw * 0.6);
    pbtn('Salvar', rx + rw - 80, ry + 8, 70, 26, () => { P.contacts.push(id); save(); }, 'on', 11);
  }, 'pg');
}
// escolher contato (nova conversa, compartilhar)
function drawPick(x, y, w, h, st) {
  const P = phS();
  y = appHeader(x, y, w, st.purpose === 'share' ? 'Enviar para…' : 'Nova conversa');
  const list = P.contacts.filter(id => RES_BY_ID[id]).map(id => ({ id, name: RES_BY_ID[id].name })).concat(Object.values(P.chats).filter(c => c.group && c.members.length).map(c => ({ id: c.id, name: c.name, g: 1 })));
  if (!list.length) { ptext('Sem contatos ainda.', x + 16, y + 20, 12, '#6a6478'); return; }
  pageList(x, y, w, h - 38, list, 42, (it, rx, ry, rw, rh) => {
    if (it.g) { ctx.fillStyle = '#7b5aa6'; ctx.beginPath(); ctx.arc(rx + 24, ry + rh / 2, 15, 0, 7); ctx.fill(); } else portrait(it.id, rx + 24, ry + rh / 2, 30);
    ptext(it.name, rx + 48, ry + rh / 2, 13, '#2a2238', 700, rw - 60);
    addBtn(rx, ry, rw, rh, () => {
      if (st.purpose === 'share') { PH.stack.pop(); sendMsg(it.id, st.text || 'Olha isso!', st.extra); go('chat', { chat: it.id }); }
      else { PH.stack.pop(); go('chat', { chat: it.id }); }
    });
  }, 'pg');
}

// ---------------------------------------------------------------- app: Telefone (ligações e histórico)
function drawTel(x, y, w, h) {
  const P = phS();
  y = appHeader(x, y, w, 'Telefone');
  const favs = P.contacts.filter(id => RES_BY_ID[id]).sort((a, b) => (partnerOf(b) ? 9999 : sm(b).friend) - (partnerOf(a) ? 9999 : sm(a).friend)).slice(0, 5);
  ptext('Favoritos', x + 14, y + 8, 12, '#7b5aa6', 700);
  favs.forEach((id, i) => { const cx = x + 40 + i * 74; portrait(id, cx, y + 44, 44); ptext(RES_BY_ID[id].name, cx, y + 76, 10, '#2a2238', 700, 70, 'center'); addBtn(cx - 30, y + 20, 60, 64, () => startCall(id, false)); });
  if (!favs.length) ptext('Sem contatos para ligar.', x + 14, y + 40, 11, '#6a6478');
  ptext('Recentes', x + 14, y + 98, 12, '#7b5aa6', 700);
  pageList(x, y + 108, w, h - 146, P.calls, 32, (c, rx, ry, rw, rh) => {
    const r = RES_BY_ID[c.id]; if (!r) return;
    const col = c.dir === 'perdida' || c.dir === 'sem resposta' ? '#e0505a' : '#2a2238';
    ptext((c.dir === 'in' ? '↙ ' : c.dir === 'out' ? '↗ ' : '✕ ') + r.name, rx + 16, ry + rh / 2, 12, col, 700, rw * 0.4);
    ptext(c.dir === 'perdida' ? 'perdida' : c.dir === 'sem resposta' ? 'não atendeu' : Math.floor(c.dur / 60) + ':' + String(c.dur % 60).padStart(2, '0'), rx + rw * 0.48, ry + rh / 2, 11, '#6a6478', 500);
    ptext(timeLabel(c.at), rx + rw - 60, ry + rh / 2, 10, '#8a8496', 500, 120, 'right');
    pbtn('📞', rx + rw - 50, ry + 2, 40, rh - 4, () => startCall(c.id, false), null, 12);
  }, 'pg');
}
function drawCall(x, y, w, h) {
  const c = PH.call; if (!c) { PH.stack.pop(); return; }
  const r = RES_BY_ID[c.id];
  const g = ctx.createLinearGradient(x, y, x, y + h); g.addColorStop(0, '#2a2238'); g.addColorStop(1, '#4a3a6a'); ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  const pulse = c.phase === 'talk' ? 0 : Math.sin(PH.rt * 6) * 6;
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.arc(x + 110, y + h / 2 - 20, 58 + pulse, 0, 7); ctx.fill();
  portrait(c.id, x + 110, y + h / 2 - 20, 96);
  ptext(r.name, x + 110, y + h / 2 + 50, 16, '#fff', 700, 200, 'center');
  ptext(c.phase === 'ringing' ? 'Chamando…' : c.phase === 'incoming' ? 'Ligação recebida' : c.phase === 'voicemail' ? 'Não atendeu' : Math.floor(c.talkT / 60) + ':' + String(Math.floor(c.talkT % 60)).padStart(2, '0'), x + 110, y + h / 2 + 70, 12, '#cfc3e6', 600, 200, 'center');
  const lx = x + 220, lw = w - 236;
  c.lines.slice(-4).forEach((l, i) => wrapText(l, lx, y + 20 + i * 36, 12, '#fff', 600, lw, 14));
  if (c.phase === 'incoming') {
    pbtn('Atender', lx, y + h - 50, 110, 38, answerCall, 'green', 14);
    pbtn('Recusar', lx + 120, y + h - 50, 110, 38, () => { c.declined = true; endCall(); }, 'red', 14);
    pbtn(c.silenced ? 'Silenciado' : 'Silenciar', lx + 240, y + h - 50, 100, 38, () => { c.silenced = true; }, c.silenced ? 'on' : 'ghost', 12);
  } else if (c.phase === 'talk') {
    const tops = callTopics(c.id).filter(t => !c.used.includes(t.k));
    const bw = Math.min(150, (lw - 10) / 2);
    tops.forEach((t, i) => pbtn(t.t, lx + (i % 2) * (bw + 8), y + h - 118 + Math.floor(i / 2) * 32, bw, 28, () => callSay(t.k), t.k === 'tchau' ? 'red' : 'ghost', 11));
    pbtn(c.muted ? '🔇 Mudo' : '🎤 Mudo', lx, y + h - 44, 90, 32, () => { c.muted = !c.muted; }, c.muted ? 'on' : 'ghost', 12);
    pbtn('Desligar', lx + 100, y + h - 44, 110, 32, endCall, 'red', 13);
  } else pbtn('Desligar', lx, y + h - 50, 120, 38, endCall, 'red', 14);
}
// ligação chegando com o celular fechado
function drawCallBanner() {
  const c = PH.call; if (!c || c.phase !== 'incoming' || (PH.open && phTop().app === 'call')) return;
  const bw = Math.min(380, W - 40), bx = (W - bw) / 2, by = SAFE.t + 70;
  ctx.fillStyle = 'rgba(30,26,44,0.95)'; ctx.beginPath(); ctx.roundRect(bx, by, bw, 64, 16); ctx.fill();
  portrait(c.id, bx + 34, by + 32, 44);
  ptext(RES_BY_ID[c.id].name, bx + 64, by + 22, 14, '#fff', 700, bw * 0.4); ptext('📞 ligando…', bx + 64, by + 42, 11, '#cfc3e6', 600);
  pbtn('Atender', bx + bw - 214, by + 14, 70, 36, answerCall, 'green', 12);
  pbtn('Recusar', bx + bw - 138, by + 14, 70, 36, () => { c.declined = true; endCall(); }, 'red', 12);
  pbtn('🔕', bx + bw - 62, by + 14, 50, 36, () => { c.silenced = true; }, c.silenced ? 'on' : 'ghost', 14);
}

// ---------------------------------------------------------------- notificações (central)
function drawNotifs(x, y, w, h) {
  const P = phS();
  y = appHeader(x, y, w, 'Notificações', () => pbtn('Limpar', x + w - 76, y + 6, 68, 22, () => { P.notifs = []; save(); }, null, 11));
  if (!P.notifs.length) { ptext('Tudo em dia!', x + 16, y + 20, 12, '#6a6478'); return; }
  pageList(x, y, w, h - 38, P.notifs, 42, (n, rx, ry, rw, rh) => {
    ctx.fillStyle = n.read ? 'transparent' : 'rgba(123,90,166,0.10)'; ctx.fillRect(rx, ry, rw, rh);
    ptext(n.title, rx + 14, ry + 12, 12, '#2a2238', 700, rw * 0.6); ptext(n.text, rx + 14, ry + 28, 11, '#4a4458', 500, rw - 110);
    ptext(timeLabel(n.at) + ' · ' + NOTIF_CAT[n.cat], rx + rw - 10, ry + 12, 9, '#8a8496', 500, 160, 'right');
    addBtn(rx, ry, rw, rh, () => openNotif(n));
  }, 'pg');
}

// ---------------------------------------------------------------- app: Calendário
function drawCal(x, y, w, h, st) {
  const now = calOf(), off = st.off || 0;
  let my = now.y, mm = now.m + off; my += Math.floor(mm / 12); mm = ((mm % 12) + 12) % 12;
  y = appHeader(x, y, w, MONTHS[mm][0].toUpperCase() + MONTHS[mm].slice(1) + ' de ' + my, () => { pbtn('◀', x + w - 96, y + 6, 40, 22, () => { st.off = off - 1; }, null, 11); pbtn('▶', x + w - 50, y + 6, 40, 22, () => { st.off = off + 1; }, null, 11); });
  const gw = w * 0.5, cw = gw / 7, first = new Date(Date.UTC(my, mm, 1)).getUTCDay(), nd = daysInMonth(my, mm), rows = Math.ceil((first + nd) / 7), chh = Math.min(36, (h - 60) / rows);
  ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].forEach((d, i) => ptext(d, x + 10 + i * cw + cw / 2, y + 8, 10, '#8a8496', 700, cw, 'center'));
  for (let dd = 1; dd <= nd; dd++) {
    const i = first + dd - 1, d = dayOfDate(my, mm, dd), cx = x + 10 + (i % 7) * cw, cy = y + 18 + Math.floor(i / 7) * chh, ev = d >= 1 ? dayEvents(d) : [];
    if (d === S.time.day) { ctx.fillStyle = '#7b5aa6'; ctx.beginPath(); ctx.arc(cx + cw / 2, cy + chh / 2, Math.min(cw, chh) / 2 - 1, 0, 7); ctx.fill(); }
    ptext(String(dd), cx + cw / 2, cy + chh / 2, 11, d === S.time.day ? '#fff' : d < S.time.day ? '#b0aabc' : '#2a2238', 700, cw, 'center');
    if (ev.length) { ctx.fillStyle = ev[0].k === 'festa' ? '#f0a020' : ev[0].k === 'futebol' ? '#3fbf5f' : ev[0].k === 'casamento' ? '#e0507a' : '#4a90e2'; ctx.beginPath(); ctx.arc(cx + cw / 2, cy + chh - 4, 2.5, 0, 7); ctx.fill(); }
  }
  // próximos compromissos
  const ex = x + gw + 24, ew = w - gw - 34; let yy = y + 8;
  ptext('Próximos eventos', ex, yy, 13, '#7b5aa6', 700); yy += 18;
  for (let d = S.time.day; d < S.time.day + 30 && yy < y + h - 50; d++) for (const e of dayEvents(d)) {
    if (yy > y + h - 50) break;
    const c = calOf(d); ptext((d === S.time.day ? 'Hoje' : d === S.time.day + 1 ? 'Amanhã' : weekday(d).slice(0, 3) + ' ' + c.d + '/' + (c.m + 1)) + ' · ' + e.t, ex, yy, 11, '#2a2238', 600, ew); yy += 17;
  }
}

// ---------------------------------------------------------------- app: Banco
function drawBank(x, y, w, h) {
  const P = phS();
  y = appHeader(x, y, w, 'Banco do Vale');
  ctx.fillStyle = '#2f8a4a'; ctx.beginPath(); ctx.roundRect(x + 12, y + 2, w * 0.36, 86, 14); ctx.fill();
  ptext('Saldo', x + 26, y + 20, 12, 'rgba(255,255,255,0.85)', 600); ptext(S.coins + ' moedas', x + 26, y + 46, 22, '#fff', 700, w * 0.33);
  ptext('Conta de Kai · ' + phoneNumber('kai').slice(5), x + 26, y + 72, 10, 'rgba(255,255,255,0.8)', 500);
  let yy = y + 104;
  const J = S.job && JOBS[S.job.id];
  ptext(J ? 'Salário: ' + J.wage + (S.job.id === 'pescador' ? '/peixe' : '/turno') + ' ×' + wageMul().toFixed(2) + ' (' + J.name + ')' : 'Sem emprego (veja a aba Trabalho no menu)', x + 16, yy, 11, '#2a2238', 600, w * 0.38); yy += 18;
  const inc = P.bank.filter(b => b.at >= S.time.day * 1440).reduce((a, b) => a + b.v, 0);
  ptext('Hoje: ' + (inc >= 0 ? '+' : '') + inc + ' moedas', x + 16, yy, 11, inc >= 0 ? '#2f8a4a' : '#e0505a', 700); yy += 18;
  ptext('Total ganho: ' + S.stats.earned + ' · gasto: ' + S.stats.spent, x + 16, yy, 11, '#6a6478', 500, w * 0.38);
  const lx = x + w * 0.42, lw = w * 0.56;
  ptext('Movimentações', lx, y + 8, 13, '#7b5aa6', 700);
  if (!P.bank.length) ptext('Nenhuma movimentação ainda.', lx, y + 30, 11, '#6a6478');
  pageList(lx, y + 18, lw, h - 56, P.bank, 30, (b, rx, ry, rw, rh) => {
    ptext(b.label, rx, ry + 9, 11, '#2a2238', 700, rw * 0.6); ptext(timeLabel(b.at), rx, ry + 22, 9, '#8a8496', 500);
    ptext((b.v > 0 ? '+' : '') + b.v, rx + rw - 70, ry + 12, 12, b.v > 0 ? '#2f8a4a' : '#e0505a', 700, 60, 'right');
    ptext(String(b.bal), rx + rw - 6, ry + 12, 10, '#8a8496', 600, 60, 'right');
  }, 'pg');
}

// ---------------------------------------------------------------- app: Mapas (lugares e amigos)
const MAP_PLACES = [['Praça das Telhas', 3550, 2300], ['Casa do Kai', 2950, 2520], ['Vila do Rio', 1900, 1700], ['Campo da Várzea', 880, 1560], ['Escola do Vale', 2700, 1440], ['Padaria', 1700, 1200],
  ['Oficina do Bruno', 3250, 1600], ['Armazém do Vale', 5550, 2270], ['Horta do Seu Tomé', 4990, 1450], ['Bosque Norte', 6750, 950], ['Torre', 6750, 2330], ['Penhasco', 860, 3000], ['Praia', 2700, 3950], ['Lago', 7050, 3900]];
function drawMaps(x, y, w, h, st) {
  const P = phS(), tab = st.tab || 'lugares';
  y = appHeader(x, y, w, 'Mapas', () => { pbtn('Lugares', x + w - 170, y + 6, 78, 22, () => { st.tab = 'lugares'; st.pg = 0; }, tab === 'lugares' ? 'on' : null, 11); pbtn('Amigos', x + w - 86, y + 6, 78, 22, () => { st.tab = 'amigos'; st.pg = 0; }, tab === 'amigos' ? 'on' : null, 11); });
  // minimapa
  const mw = w * 0.42, mh = mw * 4050 / 7200;
  drawMap(x + 10, y + 4, mw, mh, false);
  if (P.waypoint) ptext('Destino: ' + P.waypoint.name, x + 12, y + mh + 18, 12, '#7b5aa6', 700, mw);
  if (P.waypoint) pbtn('Cancelar rota', x + 12, y + mh + 30, 110, 24, () => { P.waypoint = null; }, null, 11);
  ptext('Toque num lugar para marcar a rota (seta na tela).', x + 12, y + h - 52, 10, '#6a6478', 500, mw);
  const lx = x + mw + 22, lw = w - mw - 30;
  const items = tab === 'lugares' ? MAP_PLACES.map(([n, px, py]) => ({ n, px, py })) :
    P.contacts.filter(id => RES_BY_ID[id]).map(id => { const r = RES_BY_ID[id], d = r.area === 'world' ? [r.x, r.y] : doorOut(r.area); return { n: r.name, sub: whereIs(r), px: d ? d[0] : 0, py: d ? d[1] : 0, id }; });
  pageList(lx, y, lw, h - 40, items, 34, (it, rx, ry, rw, rh) => {
    if (it.id) portrait(it.id, rx + 14, ry + rh / 2, 26);
    ptext(it.n, rx + (it.id ? 32 : 6), ry + (it.sub ? 10 : rh / 2), 12, '#2a2238', 700, rw - 110);
    if (it.sub) ptext(it.sub, rx + 32, ry + 24, 10, '#6a6478', 500, rw - 110);
    const dist = area === 'world' ? Math.round(Math.hypot(it.px - player.x, it.py - player.y) / 48) : null;
    if (dist != null) ptext(dist + ' m', rx + rw - 76, ry + rh / 2, 10, '#8a8496', 600, 50, 'right');
    pbtn('Ir', rx + rw - 44, ry + 4, 40, rh - 8, () => { P.waypoint = { x: it.px, y: it.py, name: it.n }; toast('Rota marcada: ' + it.n); closePhone(); }, 'on', 11);
  }, 'pg');
}
// seta para o destino
function drawWaypoint() {
  const P = S.phone; if (!P || !P.waypoint || area !== 'world' || PH.open) return;
  const wp = P.waypoint, sx = (wp.x - cam.x) * view.s, sy = (wp.y - cam.y) * view.s;
  const inside = sx > 30 && sx < W - 30 && sy > 60 && sy < H - 30;
  const cx = clamp(sx, 40, W - 40), cy = clamp(sy, 80, H - 40), a = Math.atan2(sy - H / 2, sx - W / 2);
  ctx.save(); ctx.translate(cx, cy); if (!inside) ctx.rotate(a);
  ctx.fillStyle = '#7b5aa6'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
  ctx.beginPath(); if (inside) { ctx.arc(0, -10, 9, 0, 7); } else { ctx.moveTo(16, 0); ctx.lineTo(-8, -10); ctx.lineTo(-8, 10); ctx.closePath(); } ctx.fill(); ctx.stroke(); ctx.restore();
  label(wp.name + ' · ' + Math.round(Math.hypot(wp.x - player.x, wp.y - player.y) / 48) + ' m', clamp(cx, 110, W - 110), cy + 24, 12, '#fff6d8', 0.9);
}

// ---------------------------------------------------------------- app: Música
function drawMusic(x, y, w, h) {
  const P = phS(), T = TRACKS[P.music.track];
  y = appHeader(x, y, w, 'Música');
  const g = ctx.createLinearGradient(x + 14, y, x + 194, y + 180); g.addColorStop(0, '#c8423b'); g.addColorStop(1, '#7b5aa6');
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x + 14, y + 4, 170, 170, 16); ctx.fill();
  for (let i = 0; i < 14; i++) { const v = P.music.playing ? Math.abs(Math.sin(PH.rt * 3 + i * 0.7)) : 0.15; ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fillRect(x + 28 + i * 11, y + 140 - v * 60, 7, v * 60); }
  ptext(T.name, x + 210, y + 26, 18, '#2a2238', 700, w - 230); ptext(T.by + ' · composição original do jogo', x + 210, y + 48, 11, '#6a6478', 600, w - 230);
  pbtn('⏮', x + 210, y + 70, 54, 40, () => setTrack((P.music.track + TRACKS.length - 1) % TRACKS.length), null, 16);
  pbtn(P.music.playing ? '⏸ Pausar' : '▶ Tocar', x + 270, y + 70, 110, 40, () => { P.music.playing = !P.music.playing; save(); }, 'on', 14);
  pbtn('⏭', x + 386, y + 70, 54, 40, () => setTrack((P.music.track + 1) % TRACKS.length), null, 16);
  TRACKS.forEach((t, i) => pbtn((i === P.music.track ? '♪ ' : '') + t.name, x + 210 + (i % 2) * ((w - 230) / 2 + 4), y + 124 + Math.floor(i / 2) * 32, (w - 230) / 2 - 4, 26, () => { setTrack(i); P.music.playing = true; save(); }, i === P.music.track ? 'on' : null, 11));
  ptext('A música continua tocando com o celular fechado.', x + 16, y + h - 54, 10, '#6a6478', 500, w - 30);
}

// ---------------------------------------------------------------- app: Configurações
function drawSettings(x, y, w, h) {
  const P = phS(), s = P.settings;
  y = appHeader(x, y, w, 'Configurações');
  ptext('Papel de parede', x + 14, y + 8, 13, '#7b5aa6', 700);
  PHONE_WALLS.forEach(([a, b], i) => { const bx = x + 14 + i * 50, g = ctx.createLinearGradient(bx, y + 18, bx + 42, y + 60); g.addColorStop(0, a); g.addColorStop(1, b); ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(bx, y + 18, 42, 42, 8); ctx.fill(); if (s.wall === i) { ctx.strokeStyle = '#2a2238'; ctx.lineWidth = 3; ctx.stroke(); } addBtn(bx, y + 18, 42, 42, () => { s.wall = i; save(); }); });
  pbtn('Usar foto da galeria', x + 14 + PHONE_WALLS.length * 50, y + 26, 150, 26, () => go('gallery', { wall: true }), typeof s.wall === 'string' ? 'on' : null, 11);
  let yy = y + 78;
  ptext('Notificações', x + 14, yy, 13, '#7b5aa6', 700); yy += 16;
  Object.entries(NOTIF_CAT).forEach(([k, n], i) => pbtn((s.notif[k] !== false ? '✓ ' : '✗ ') + n, x + 14 + (i % 3) * ((w - 40) / 3 + 6), yy + Math.floor(i / 3) * 30, (w - 40) / 3, 26, () => { s.notif[k] = s.notif[k] === false; save(); }, s.notif[k] !== false ? 'on' : null, 11));
  yy += 70;
  ptext('Sons', x + 14, yy, 13, '#7b5aa6', 700); yy += 16;
  pbtn((s.sound ? '✓' : '✗') + ' Som de notificação', x + 14, yy, 170, 26, () => { s.sound = !s.sound; save(); }, s.sound ? 'on' : null, 11);
  pbtn((s.ring ? '✓' : '✗') + ' Toque de chamada', x + 190, yy, 160, 26, () => { s.ring = !s.ring; save(); }, s.ring ? 'on' : null, 11);
  pbtn((s.silent ? '✓' : '✗') + ' Modo silencioso', x + 356, yy, 150, 26, () => { s.silent = !s.silent; save(); }, s.silent ? 'on' : null, 11);
  yy += 40;
  ptext('Bateria ' + Math.round(P.battery) + '% · carrega na sua casa e ao dormir · gasta mais com câmera e vídeos', x + 14, yy, 11, '#6a6478', 500, w - 28);
  ptext('Celular do Kai · ' + phoneNumber('kai') + ' · ' + P.contacts.length + ' contatos', x + 14, yy + 18, 11, '#6a6478', 500, w - 28);
}

const PHONE_APPS = { home: drawHome, msgs: drawMsgs, chat: drawChat, contacts: drawContacts, addcontact: drawAddContact, pick: drawPick, tel: drawTel, call: drawCall, notifs: drawNotifs, cal: drawCal, bank: drawBank, maps: drawMaps, music: drawMusic, settings: drawSettings };

// ---------------------------------------------------------------- HUD: botão do celular, banner de notificação
function drawPhoneHUD(mx, my) {
  if (PH.open || fbPlaying() || work || build) { drawCallBanner(); return; }
  const n = unreadMsgs() + unreadNotifs(), P = phS();
  hudButton(mx - 24, my + 62, 17, (x, y) => { ctx.fillStyle = '#fff6d8'; ctx.fillRect(x - 6, y - 10, 12, 20); ctx.fillStyle = '#2a2238'; ctx.fillRect(x - 4, y - 7, 8, 13); }, () => openPhone(), n > 0);
  if (n) { ctx.fillStyle = '#ff3b4a'; ctx.beginPath(); ctx.arc(mx - 12, my + 50, 8, 0, 7); ctx.fill(); ptext(String(Math.min(99, n)), mx - 12, my + 51, 10, '#fff', 700, 16, 'center'); }
  if (P.battery < 15) ptext(Math.round(P.battery) + '%', mx - 24, my + 88, 10, '#ff9a8a', 700, 30, 'center');
  const b = PH.banner;
  if (b && !dialog) {
    const bw = Math.min(340, W * 0.45), bx = W - SAFE.r - bw - 12, by = my + 110;
    ctx.globalAlpha = Math.min(1, b.t * 3);
    ctx.fillStyle = 'rgba(30,26,44,0.92)'; ctx.beginPath(); ctx.roundRect(bx, by, bw, 46, 12); ctx.fill();
    ptext('📱 ' + b.title, bx + 12, by + 15, 12, '#fff', 700, bw - 24); ptext(b.text, bx + 12, by + 33, 11, '#cfc3e6', 500, bw - 24);
    ctx.globalAlpha = 1;
    addBtn(bx, by, bw, 46, () => { const n2 = phS().notifs.find(q => q.title === b.title && q.text === b.text); if (n2) openNotif(n2); else openPhone(); });
  }
  drawCallBanner();
}
