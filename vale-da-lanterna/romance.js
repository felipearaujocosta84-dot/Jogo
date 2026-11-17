/* Vale da Lanterna — namoro melhorado: encontros em lugares do vale (com respostas que combinam ou não com a
   personalidade), pontos de romance separados da amizade, o que cada pessoa valoriza, pedido de namoro que mostra o
   que falta (e é respeitoso quando a resposta é não), a pessoa pode se declarar primeiro, e dá para terminar.
   Só adultos elegíveis: crianças e adolescentes nunca entram em romance. */
'use strict';

const canRomance = id => { const r = RES_BY_ID[id], info = SOCIAL[id] || {}; return !!(r && info.eligible && !info.child && !info.teen && !r.child && !r.teen && !r.kid && r.age >= 18); };
function romanceGain(id, v) { if (!canRomance(id) && !partnerOf(id)) return; const m = sm(id); m.rom = clamp((m.rom || 0) + v, 0, 100); }
const romPts = id => sm(id).rom || 0;
const ROM_NEED = 40;

// o que cada pessoa valoriza (dica aparece em Pessoas depois que vocês ficam amigos)
const ROMANCE_PREF = {
  mel: { hint: 'Mel se encanta com quem lembra dela com presentes que ela ama (3 presentes favoritos).', ok: m => (m.likedGifts || 0) >= 3 },
  bruno: { hint: 'Bruno admira gente trabalhadora (ter um emprego no vale).', ok: () => !!S.job },
  rosa: { hint: 'Rosa quer encontros de verdade antes de namorar (2 encontros).', ok: m => (m.dates || 0) >= 2 },
  iara: { hint: 'Iara gosta de quem explora o mundo (1 relíquia ou 2 cidades visitadas).', ok: () => relicCount() >= 1 || Object.keys(S.cities || {}).length >= 2 },
  davi: { hint: 'Davi é tímido: precisa de muitas conversas (conversar em 10 dias diferentes).', ok: m => (m.talkDays || 0) >= 10 },
  nina: { hint: 'Nina sonha com um encontro debaixo das estrelas.', ok: m => !!m.starDate },
  joca: { hint: 'Joca quer alguém que jogue bola com ele (1 partida no mesmo time).', ok: () => !!(S.football && S.football.rel.joca && S.football.rel.joca.with >= 1) }
};
const prefOk = id => { const P = ROMANCE_PREF[id]; return !P || P.ok(sm(id)); };
function romanceTag(id) {
  if (!canRomance(id) || partnerOf(id) || !sm(id).met) return '';
  return ' · romance ' + romPts(id) + (sm(id).prefKnown && ROMANCE_PREF[id] ? (prefOk(id) ? ' ✓' : ' ✗') : '');
}

// ---------------------------------------------------------------- opções na conversa
function romanceOptions(n) {
  const id = n.id, m = sm(id), out = [], R = S.romance;
  const old = romanceOption(n); if (old) out.push(old);
  const date = (canRomance(id) && !R && hearts(id) >= 4) || (partnerOf(id) && !m.upset);
  if (date && !S.walk && m.dateDay !== S.time.day) out.push({ t: 'Encontro', fn: () => offerDate(n) });
  // adultos não elegíveis também respondem (com respeito); crianças e adolescentes nunca têm essa opção
  const r = RES_BY_ID[id], info = SOCIAL[id] || {}, adult = r && !r.kid && !r.child && !r.teen && !info.child && !info.teen && r.age >= 18;
  if (!R && adult && m.met && (hearts(id) >= 3 || !canRomance(id))) out.push({ t: 'Pedir em namoro', fn: () => askDateFlow(id) });
  if (partnerOf(id) && (R.status === 'namorando' || R.status === 'noivos')) out.push({ t: 'Terminar', fn: () => breakUp(id) });
  return out;
}
// mostra o que falta; com tudo pronto e o buquê, a pessoa aceita
function askDateFlow(id) {
  const r = RES_BY_ID[id], m = sm(id), h = hearts(id), need = r.pers === 'timido' ? 8 : 7;
  if (!canRomance(id)) { say([r.name + ': ' + ((SOCIAL[id] || {}).no || 'Você é muito querido(a), mas não sinto isso por você.')]); return; }
  if (m.askCd && S.time.day < m.askCd) { say([r.name + ': Kai... me dá um tempinho pra pensar no que você falou, tá?']); return; }
  m.prefKnown = true;
  const P = ROMANCE_PREF[id];
  const items = [['Amizade', h + '/' + need + ' ♥', h >= need], ['Romance', romPts(id) + '/' + ROM_NEED, romPts(id) >= ROM_NEED], ['Buquê de Flores', (S.bag.buque || 0) ? 'tem' : 'falta (Criar: 5 flores + 1 fibra)', (S.bag.buque || 0) > 0]];
  if (P) items.push(['O que ' + r.name + ' valoriza', P.ok(m) ? 'sim' : 'ainda não', P.ok(m)]);
  if (m.upset) items.push(['Humor', 'chateado(a)', false]);
  const ready = items.every(i => i[2]);
  const lines = ['Para pedir ' + r.name + ' em namoro: ' + items.map(i => (i[2] ? '✓ ' : '✗ ') + i[0] + ': ' + i[1]).join(' · ')];
  if (P) lines.push('Dica: ' + P.hint);
  const ch = [];
  if (ready) ch.push({ t: 'Entregar o buquê', fn: () => askDate(id) });
  else if ((S.bag.buque || 0) > 0) ch.push({ t: 'Pedir mesmo assim', fn: () => softNo(id, items) });
  ch.push({ t: 'Ainda não' });
  say(lines, null, ch);
}
// resposta "não" respeitosa: explica o que falta, sem brigas
function softNo(id, items) {
  const r = RES_BY_ID[id], m = sm(id), miss = items.find(i => !i[2]);
  m.askCd = S.time.day + 2; romanceGain(id, -3);
  const why = { 'Amizade': 'A gente ainda está se conhecendo... quero ser mais próximo(a) de você primeiro.', 'Romance': 'Eu gosto de você, mas ainda não sinto aquele friozinho na barriga. Que tal um encontro?',
    'Humor': 'Agora não, Kai. Ainda estou chateado(a).' }[miss[0]] || (ROMANCE_PREF[id] ? 'Sabe... ' + ROMANCE_PREF[id].hint.replace(r.name + ' ', 'eu ').replace(/\(.*\)/, '').trim() : 'Ainda não estou pronto(a).');
  remember(id, 'O Kai me pediu em namoro, mas ainda não era a hora.');
  say([r.name + ': ' + why, r.name + ': Mas fico feliz que você tenha falado. Continuamos amigos, tá?']);
  save();
}
function breakUp(id) {
  const r = RES_BY_ID[id];
  say(['Tem certeza que quer terminar com ' + r.name + '?'], null, [
    { t: 'Sim, terminar', fn: () => {
      const m = sm(id); S.romance = null; addFriend(id, -150); m.rom = Math.max(0, romPts(id) - 50); m.askCd = S.time.day + 7; m.upset = false;
      remember(id, 'Terminamos o namoro.');
      say([r.name + ': ...Tudo bem. Obrigado(a) pelo tempo que passamos juntos. Vou sentir sua falta.']); save();
    } },
    { t: 'Não' }]);
}

// ---------------------------------------------------------------- a pessoa se declara primeiro
function romanceConfess(n) {
  const id = n.id, m = sm(id);
  if (S.romance || !canRomance(id) || m.upset || romPts(id) < 60 || hearts(id) < 8 || !prefOk(id)) return false;
  if (S.time.day - (m.confessDay || -99) < 10) return false;
  m.confessDay = S.time.day;
  const r = RES_BY_ID[id]; talkPid = id; talkFace = r;
  say([r.name + ': Kai... posso te falar uma coisa? Faz tempo que eu quero dizer...', r.name + ': Eu gosto de você. De verdade. Você quer namorar comigo?'], null, [
    { t: 'Eu também gosto de você!', fn: () => startRomance(id, r.name + ': Sério?! Ai, meu coração... Então agora estamos namorando!') },
    { t: 'Prefiro sermos amigos', fn: () => { romanceGain(id, -15); remember(id, 'Me declarei, mas o Kai prefere amizade.'); say([r.name + ': Ah... tudo bem. Obrigado(a) pela sinceridade, Kai. Continuamos amigos.']); save(); } }
  ]);
  return true;
}
function startRomance(id, line) {
  const r = RES_BY_ID[id];
  S.romance = { id, status: 'namorando', since: S.time.day };
  addFriend(id, 60); remember(id, 'Começamos a namorar.');
  flash = 0.5; Audio.sfx('relic');
  for (let i = 0; i < 18; i++) particles.push({ x: r.x + rand(-60, 60), y: r.y - 80 + rand(-40, 20), vx: rand(-30, 30), vy: rand(-80, -30), g: 0, t: 1.6, max: 1.6, col: '#ff7aa6', s: 7 });
  say([line, 'Agora vocês estão namorando. Encontros, conversas e passeios deixam o namoro mais forte!']);
  save();
}

// ---------------------------------------------------------------- encontros
const DATE_PLACES = {
  por_do_sol: { name: 'Pôr do sol na Praça', x: 3550, y: 2300, h: [16.5, 20], area: 'world',
    line: 'Olha esse céu... o pôr do sol daqui é o mais bonito do vale.',
    ans: { romantico: 'Fica ainda mais bonito com você aqui.', engracado: 'Bonito mesmo é o pão da Rosa que eu trouxe escondido!', sincero: 'Eu queria muito passar esse fim de tarde com você.' } },
  rio: { name: 'Piquenique na beira do rio', x: 1980, y: 1720, h: [9, 17], area: 'world',
    line: 'Que lugar gostoso pra um piquenique. Dá pra ouvir o rio daqui.',
    ans: { romantico: 'Com você, até pão com nada vira banquete.', engracado: 'Aposto que consigo pegar um peixe com a mão!', sincero: 'Gosto de lugares calmos assim... e de conversar com você.' } },
  campo: { name: 'Bater bola no campo', x: FB.cx, y: FB.cy, h: [8, 18], area: 'world',
    line: 'Bora ver quem faz mais embaixadinhas?',
    ans: { romantico: 'Já ganhei: tô aqui com você.', engracado: 'Eu faço dez! ...Tá, talvez duas.', sincero: 'Valeu por topar, eu me diverti muito.' } },
  estrelas: { name: 'Ver as estrelas no campo', x: FB.cx, y: FB.cy + 120, h: [20, 24], area: 'world', stars: true,
    line: 'Olha quantas estrelas... dá pra ver a Lanterna lá longe.',
    ans: { romantico: 'Nenhuma brilha tanto quanto você.', engracado: 'Aquela ali parece o Floco dormindo!', sincero: 'Às vezes eu fico pensando no futuro... e você aparece nele.' } }
};
// resposta que mais combina com cada personalidade
const DATE_TASTE = { alegre: 'engracado', brincalhao: 'engracado', aventureira: 'engracado', curioso: 'engracado', timido: 'sincero', trabalhador: 'sincero', serio: 'sincero', gentil: 'sincero', rabugento: 'sincero', sonhadora: 'romantico' };
const TASTE_2 = { engracado: 'sincero', sincero: 'romantico', romantico: 'sincero' };
function offerDate(n) {
  const r = RES_BY_ID[n.id], h = gameHour(), m = sm(n.id), e = r.entry || currentEntry(r);
  if (['work', 'farm', 'fish'].includes(e[3]) && !partnerOf(n.id)) { say([r.name + ': Agora estou trabalhando... me chama depois do expediente?']); return; }
  const open = Object.entries(DATE_PLACES).filter(([, D]) => h >= D.h[0] - 1 && h < D.h[1] - 0.5);
  if (!open.length) { say([r.name + ': Agora tá tarde (ou cedo) demais pra um encontro... que tal outro horário?', 'Encontros: rio (9h–17h), campo (8h–18h), pôr do sol (16h30–20h), estrelas (20h–24h).']); return; }
  const ch = open.slice(0, 3).map(([k, D]) => ({ t: D.name, fn: () => startDate(n, k) }));
  ch.push({ t: 'Outro dia' });
  say([r.name + ': Um encontro? ' + (m.dates ? 'Adoro!' : 'Eu... topo! Pra onde?')], null, ch);
}
function startDate(n, key) {
  const r = RES_BY_ID[n.id], D = DATE_PLACES[key], now = S.time.day * 1440 + S.time.min;
  sm(n.id).dateDay = S.time.day;
  S.walk = { id: n.id, end: now + 180, tick: now, date: key };
  say([r.name + ': Vamos! Me leva até lá: ' + D.name.toLowerCase() + '.']);
  toast('Encontro: leve ' + r.name + ' até ' + D.name.toLowerCase());
}
// chamado a cada quadro pelo passeio: chegou ao lugar do encontro?
function updateDate() {
  const W = S.walk; if (!W || !W.date || W.arrived) return;
  const D = DATE_PLACES[W.date], r = RES_BY_ID[W.id];
  if (!r || area !== D.area || Math.hypot(player.x - D.x, player.y - D.y) > 260 || dialog || menu) return;
  W.arrived = true;
  talkPid = r.id; talkFace = r;
  const keys = Object.keys(D.ans), order = keys.slice().sort((a, b) => (hashStr(a + S.time.day) & 7) - (hashStr(b + S.time.day) & 7));
  say([r.name + ': ' + D.line], null, order.map(k => ({ t: D.ans[k], fn: () => dateAnswer(r, W.date, k) })));
}
function dateAnswer(r, key, kind) {
  const m = sm(r.id), D = DATE_PLACES[key], best = DATE_TASTE[r.pers] || 'sincero';
  const score = kind === best ? 2 : kind === TASTE_2[best] ? 1 : 0;
  const rom = [3, 9, 18][score] + (partnerOf(r.id) ? 4 : 0), fr = [10, 25, 45][score];
  romanceGain(r.id, rom); addFriend(r.id, fr);
  m.dates = (m.dates || 0) + 1;
  if (D.stars) m.starDate = true;
  remember(r.id, 'Tivemos um encontro: ' + D.name.toLowerCase() + '.');
  const reply = [['Hum... tá bom.', 'Haha, ok.', 'Entendi.'][S.time.day % 3], ['Que fofo, Kai.', 'Hehe, gostei.', 'Você é engraçado(a).'][S.time.day % 3], ['Kai... você sabe exatamente o que dizer.', 'Isso me deixou com o coração quentinho.', 'Eu ia dizer a mesma coisa!'][S.time.day % 3]][score];
  if (score === 2) { for (let i = 0; i < 10; i++) particles.push({ x: r.x + rand(-40, 40), y: r.y - 110, vx: rand(-20, 20), vy: rand(-60, -20), g: 0, t: 1.4, max: 1.4, col: '#ff7aa6', s: 6 }); Audio.sfx('heal'); }
  say([r.name + ': ' + reply, r.name + ': ' + (score ? 'Obrigado(a) pelo encontro. Foi especial.' : 'Foi legal passear com você.')]);
  if (S.walk && S.walk.id === r.id) S.walk.end = S.time.day * 1440 + S.time.min + 20;
  save();
}
