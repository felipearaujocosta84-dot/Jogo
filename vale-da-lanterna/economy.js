/* Vale da Lanterna — economia: lojas com horário e estoque, preços que variam por dia, compra e venda,
   empregos com minijogos, experiência e promoção, pesca, roupas e propriedades (terrenos e casas). */
'use strict';

// ---------------------------------------------------------------- preços
const BASE_PRICE = { madeira: 2, pedra: 2, fibra: 2, flor: 2, cogumelo: 4, seiva: 4, cristal: 14, pocao: 10, torta: 7, sopa: 8, pao: 3,
  peixe: 7, truta: 16, carpa: 40, bota: 1, tabua: 8, feixe: 8 };
function dayMul(item) { return 0.85 + 0.3 * hash2(S.time.day * 13 + 7, hashStr(item) & 0xffff); }
const buyPrice = (item, mul = 1) => Math.max(1, Math.round(BASE_PRICE[item] * 1.7 * dayMul(item) * mul));
const sellPrice = (item, mul = 1) => Math.max(1, Math.round(BASE_PRICE[item] * dayMul(item) * mul));
const TOOLS = { vara: { name: 'Vara de Pesca', price: 40, desc: 'Pesque perto de rios, lagos e do mar' },
  enxada: { name: 'Enxada', price: 35, desc: 'Ara a terra dos seus terrenos' }, regador: { name: 'Regador', price: 30, desc: 'Rega as plantações' } };
const OUTFITS = [
  { id: 'classico', name: 'Clássico', scarf: '#c8423b', tunic: '#7a4a2a', price: 0 },
  { id: 'mar', name: 'Marinheiro', scarf: '#3b62a0', tunic: '#e6dccb', price: 45 },
  { id: 'floresta', name: 'Floresta', scarf: '#3f8a37', tunic: '#5a3a22', price: 40 },
  { id: 'sol', name: 'Sol Poente', scarf: '#e0a020', tunic: '#a0402a', price: 50 },
  { id: 'neve', name: 'Neve', scarf: '#ffffff', tunic: '#4f7fbf', price: 55 },
  { id: 'realeza', name: 'Realeza', scarf: '#7b5aa6', tunic: '#2c3448', price: 70 }];

// ---------------------------------------------------------------- lojas
const SHOPS = {
  armazem: { name: 'Armazém do Vale', owner: 'gil', area: 'armazem', hours: [8, 18], sells: { pao: 12, torta: 6, cogumelo: 10, madeira: 30, pedra: 30, fibra: 20, flor: 15, cristal: 3, racao: 30, adubo: 20 }, tools: ['vara', 'enxada', 'regador'], seeds: true,
    buys: ['peixe', 'truta', 'carpa', 'bota', 'madeira', 'pedra', 'fibra', 'flor', 'cogumelo', 'cristal', 'seiva', 'tabua', 'sopa', 'torta', 'pao', 'feixe', 'couve', 'cenoura', 'morango', 'tomate', 'trigo', 'abobora', 'nabo', 'ovo', 'leite', 'la', 'trufa'] },
  padaria: { name: 'Padaria da Rosa', owner: 'rosa', area: 'padaria', hours: [6, 15], sells: { pao: 15, torta: 6, omelete: 4 }, buys: ['cogumelo', 'flor', 'trigo', 'ovo', 'leite', 'morango'] },
  animais: { name: 'Sítio do Seu Tomé', owner: 'tome', area: 'world', hours: [6, 18], sells: { racao: 20, adubo: 10 }, seeds: true, animals: true, buys: ['couve', 'cenoura', 'morango', 'tomate', 'trigo', 'abobora', 'nabo', 'ovo', 'leite', 'la', 'trufa'] },
  oficina: { name: 'Oficina do Bruno', owner: 'bruno', area: 'oficina', hours: [7, 19], sells: { pedra: 10, cristal: 2 }, tools: ['vara'], buys: ['pedra', 'cristal', 'seiva', 'tabua'] },
  feira: { name: 'Ateliê da Nina', owner: 'nina', area: 'world', hours: [8, 17], sells: {}, clothes: true, buys: ['fibra', 'flor'] }
};
function cityShop(c) {
  const id = 'city_' + c.key;
  if (!SHOPS[id]) {
    const extra = { deserto: 'cristal', neve: 'cristal', pantano: 'cogumelo', floresta: 'madeira', outono: 'madeira', cerejeiras: 'flor', campo: 'fibra' }[c.biome] || 'fibra';
    SHOPS[id] = { name: 'Mercado de ' + c.name, city: c, hours: [7, 19], sells: { pocao: 5, torta: 6, pao: 10, madeira: 20, pedra: 20, [extra]: 15 }, tools: ['vara'],
      buys: ['peixe', 'truta', 'carpa', 'madeira', 'pedra', 'fibra', 'flor', 'cogumelo', 'cristal', 'seiva', 'tabua', 'sopa', 'feixe', 'couve', 'cenoura', 'morango', 'tomate', 'trigo', 'abobora', 'nabo', 'ovo', 'leite', 'la', 'trufa'], mul: 1.1 };
  }
  return id;
}
const shopOpen = id => { const sh = SHOPS[id], h = gameHour(); return h >= sh.hours[0] && h < sh.hours[1]; };
function shopStock(id) {
  S.shops = S.shops || {};
  let st = S.shops[id];
  if (!st || st.day !== S.time.day) {
    st = S.shops[id] = { day: S.time.day, stock: Object.assign({}, SHOPS[id].sells) };
    if (SHOPS[id].seeds) for (const [c, C] of Object.entries(CROPS)) if (C.seasons.includes(calOf().season)) st.stock['sem_' + c] = 15;
  }
  return st.stock;
}
const itemCount = k => k in S.inv ? S.inv[k] : (S.bag[k] || 0);
function addItem(k, n) { if (k in S.inv) S.inv[k] += n; else S.bag[k] = (S.bag[k] || 0) + n; }
function openShop(id) { menu = { tab: 'shop', shop: id, mode: SHOPS[id].clothes ? 'clothes' : 'buy' }; Audio.sfx('ui'); }
function shopBuy(id, item) {
  const sh = SHOPS[id], st = shopStock(id), p = buyPrice(item, sh.mul);
  if (!st[item]) { toast('Acabou o estoque de hoje'); return; }
  if (S.coins < p) { toast('Moedas insuficientes'); return; }
  S.coins -= p; st[item]--; addItem(item, 1); S.stats.spent += p; Audio.sfx('coin'); save();
}
function shopSell(id, item) {
  const sh = SHOPS[id], p = sellPrice(item, sh.mul);
  if (itemCount(item) <= 0) return;
  addItem(item, -1); S.coins += p; S.stats.earned += p;
  const st = shopStock(id); st[item] = (st[item] || 0) + 1;   // o que você vende entra no estoque da loja
  Audio.sfx('coin'); save();
}
function buyTool(k) {
  const T = TOOLS[k];
  if (S.tools[k]) return;
  if (S.coins < T.price) { toast('Moedas insuficientes'); return; }
  S.coins -= T.price; S.tools[k] = true; S.stats.spent += T.price; Audio.sfx('relic'); toast('Comprou: ' + T.name + '!'); save();
}
function buyOutfit(o) {
  if (S.outfits.includes(o.id)) { S.outfit = o.id; toast('Vestiu: ' + o.name); save(); return; }
  if (S.coins < o.price) { toast('Moedas insuficientes'); return; }
  S.coins -= o.price; S.outfits.push(o.id); S.outfit = o.id; S.stats.spent += o.price; Audio.sfx('relic'); toast('Nova roupa: ' + o.name + '!'); save();
}
const outfit = () => OUTFITS.find(o => o.id === S.outfit) || OUTFITS[0];
// portas de loja trancadas fora do horário
const SHOP_DOORS = { armazem: 'armazem', padaria: 'padaria' };
function doorClosed(to) {
  const sid = SHOP_DOORS[to];
  if (sid && !shopOpen(sid)) return 'Fechado. ' + SHOPS[sid].name + ' abre às ' + SHOPS[sid].hours[0] + 'h e fecha às ' + SHOPS[sid].hours[1] + 'h.';
  const m = DYN.get(to);
  if (m && m.kind === 'loja' && (gameHour() < 7 || gameHour() >= 19)) return 'Fechado. O mercado abre às 7h.';
  if (m && m.kind === 'venda' && !S.props.houses[to]) return null;
  return null;
}

// ---------------------------------------------------------------- empregos
const JOBS = {
  agricultor: { name: 'Agricultor(a)', boss: 'tome', hours: [6, 12], wage: 16, game: 'farm', where: 'Horta do Seu Tomé', desc: 'Regar, plantar e colher nos canteiros marcados.' },
  ferreiro: { name: 'Ferreiro(a)', boss: 'bruno', hours: [8, 14], wage: 20, game: 'forge', where: 'Bigorna da Oficina do Bruno', desc: 'Martelar o ferro quente no ponto certo.' },
  pescador: { name: 'Pescador(a)', boss: 'iara', hours: [7, 13], wage: 6, game: 'fish', where: 'Rios, lagos e mar (precisa de vara)', desc: 'Pescar e entregar 4 peixes para a Iara.' },
  comerciante: { name: 'Comerciante', boss: 'gil', hours: [9, 15], wage: 18, game: 'shop', where: 'Balcão do Armazém do Vale', desc: 'Atender os pedidos dos clientes, certo e rápido.' },
  carpinteiro: { name: 'Carpinteiro(a)', boss: 'davi', hours: [8, 14], wage: 18, game: 'saw', where: 'Serraria do Davi, na vila', desc: 'Serrar tábuas no ritmo (as tábuas ficam com você).' },
  cozinheiro: { name: 'Cozinheiro(a)', boss: 'bia', hours: [7, 13], wage: 17, game: 'cook', where: 'Forno da Padaria', desc: 'Memorizar e montar as receitas dos pedidos.' }
};
const JOB_XP = [0, 60, 160, 320, 540], JOB_TITLE = ['Aprendiz', 'Ajudante', 'Profissional', 'Especialista', 'Mestre(a)'];
const jobLevel = xp => JOB_XP.filter(v => xp >= v).length;
const wageMul = () => 1 + 0.25 * ((S.job ? S.job.level : 1) - 1);
const jobOf = boss => Object.keys(JOBS).find(k => JOBS[k].boss === boss);
const onShiftHours = () => S.job && gameHour() >= JOBS[S.job.id].hours[0] && gameHour() < JOBS[S.job.id].hours[1];
const shiftAvailable = () => S.job && onShiftHours() && S.job.lastShift !== S.time.day;

function economyChoices(n) {
  const out = [];
  for (const [id, sh] of Object.entries(SHOPS)) if (sh.owner === n.id && shopOpen(id) && (sh.area === n.area || (id === 'feira' && n.area === 'world')))
    out.push({ t: 'Loja', fn: () => openShop(id) });
  const jid = jobOf(n.id);
  if (jid) {
    if (S.job && S.job.id === jid && jid === 'pescador' && fishCount() > 0 && onShiftHours()) out.push({ t: 'Entregar peixes', fn: () => deliverFish(n) });
    out.push({ t: 'Emprego', fn: () => jobTalk(n, jid) });
  }
  return out;
}
function jobTalk(n, jid) {
  const J = JOBS[jid], who = n.name;
  if (S.job && S.job.id === jid) {
    const st = S.job.lastShift === S.time.day ? 'Você já fez o turno de hoje. Descanse!' : onShiftHours() ? 'O turno está aberto agora: vá para ' + J.where + '.' : 'Seu turno é das ' + J.hours[0] + 'h às ' + J.hours[1] + 'h.';
    say([who + ': ' + JOB_TITLE[S.job.level - 1] + ' ' + J.name.toLowerCase() + ', hein? ' + st], null, [{ t: 'Pedir demissão', fn: () => {
      S.job = null; addFriend(n.id, -20); say([who + ': Que pena... as portas continuam abertas, viu?']); save(); } }, { t: 'Voltar' }]);
    return;
  }
  if (S.job) { say([who + ': Você já trabalha como ' + JOBS[S.job.id].name.toLowerCase() + '. Peça demissão lá antes, que eu te contrato!']); return; }
  if (!sm(n.id).met) { say([who + ': A gente nem se conhece ainda! Vamos conversar primeiro.']); return; }
  say([who + ': Quer trabalhar comigo como ' + J.name.toLowerCase() + '?', 'Turno: ' + J.hours[0] + 'h às ' + J.hours[1] + 'h · Local: ' + J.where + ' · Salário base: ' + J.wage + (jid === 'pescador' ? ' moedas por peixe' : ' moedas por turno') + '. ' + J.desc],
    null, [{ t: 'Aceitar', fn: () => { S.job = { id: jid, xp: 0, level: 1, lastShift: 0, shiftFish: 0 }; addFriend(n.id, 15); remember(n.id, 'Contratou o Kai como ' + J.name.toLowerCase() + '.'); Audio.sfx('relic'); say([who + ': Contratado! Te espero no turno.']); save(); } }, { t: 'Agora não' }]);
}
function finishShift(quality, extra) {
  const J = JOBS[S.job.id], q = clamp(quality, 0.3, 1.25);
  const pay = Math.round(J.wage * wageMul() * q);
  const xp = Math.round(20 + 25 * q);
  S.coins += pay; S.stats.earned += pay; S.job.xp += xp; S.job.lastShift = S.time.day;
  const before = S.job.level; S.job.level = jobLevel(S.job.xp);
  addFriend(J.boss, 12);
  Audio.sfx('coin');
  const boss = RES_BY_ID[J.boss];
  talkPid = J.boss; talkFace = boss;
  const lines = [boss.name + ': ' + (q > 1 ? 'Trabalho impecável!' : q > 0.7 ? 'Bom trabalho hoje!' : 'Dá pra melhorar, mas obrigado pela ajuda.') + ' Aqui estão ' + pay + ' moedas.' + (extra || '')];
  if (S.job.level > before) { lines.push(boss.name + ': E tem mais: você foi promovido(a) a ' + JOB_TITLE[S.job.level - 1] + '! Seu salário subiu.'); remember(J.boss, 'Promovi o Kai a ' + JOB_TITLE[S.job.level - 1] + '.'); flash = 0.4; }
  say(lines);
  save();
}

// ---------------------------------------------------------------- minijogos (sobre a tela)
let work = null;
const ORDER_ITEMS = ['pao', 'torta', 'sopa', 'peixe', 'flor', 'madeira', 'cogumelo', 'cristal'];
const ING = { sopa: ['cogumelo', 'agua', 'sal'], torta: ['farinha', 'cogumelo', 'ovo'], pao: ['farinha', 'agua', 'fermento'], ensopado: ['peixe', 'agua', 'sal'], doce: ['farinha', 'flor', 'ovo'] };
const ING_NAMES = { cogumelo: 'Cogumelo', agua: 'Água', sal: 'Sal', farinha: 'Farinha', ovo: 'Ovo', fermento: 'Fermento', peixe: 'Peixe', flor: 'Flor' };
function startShift() {
  const J = JOBS[S.job.id];
  if (!shiftAvailable()) { say([S.job.lastShift === S.time.day ? 'Você já trabalhou hoje.' : 'Fora do horário do turno (' + J.hours[0] + 'h–' + J.hours[1] + 'h).']); return; }
  if (J.game === 'farm') { startFarmShift(); return; }
  work = { game: J.game, round: 0, rounds: 6, qsum: 0, msg: '', msgT: 0 };
  newRound();
  Audio.sfx('ui');
}
function newRound() {
  const w = work, lv = S.job.level;
  w.t = 0; w.hits = 0; w.hq = 0;
  if (w.game === 'forge' || w.game === 'saw') { w.zone = rand(0.2, 0.8); w.zw = 0.16 + lv * 0.012; w.speed = (w.game === 'forge' ? 2.2 : 2.8) + w.round * 0.15; w.phase0 = rand(0, 6); }
  if (w.game === 'shop') {
    const n = 1 + Math.floor(Math.random() * 2), want = {};
    for (let i = 0; i < n + 1; i++) { const k = ORDER_ITEMS[Math.floor(Math.random() * ORDER_ITEMS.length)]; want[k] = (want[k] || 0) + 1; }
    const fmt = o => Object.entries(o).map(([k, q]) => q + ' ' + NAMES[k].toLowerCase()).join(' + ');
    const wrong = () => { const o = Object.assign({}, want), ks = Object.keys(o), k = ks[Math.floor(Math.random() * ks.length)]; if (Math.random() < 0.5) o[k] += 1; else { delete o[k]; o[ORDER_ITEMS.find(x => !(x in want))] = 1; } return fmt(o); };
    const opts = [fmt(want)]; while (opts.length < 3) { const x = wrong(); if (!opts.includes(x)) opts.push(x); }
    w.order = fmt(want); w.opts = opts.sort(() => Math.random() - 0.5); w.limit = 7 - Math.min(2, lv * 0.3);
    w.client = ['Lúcia', 'Davi', 'Nina', 'Caio', 'Bia', 'Joca', 'Tainá', 'Raul', 'Iara', 'Otto'][Math.floor(Math.random() * 10)];
  }
  if (w.game === 'cook') {
    const dish = Object.keys(ING)[Math.floor(Math.random() * Object.keys(ING).length)];
    w.dish = dish; w.seq = ING[dish]; w.input = []; w.show = 2.6 - Math.min(0.8, lv * 0.1);
    const pool = Object.keys(ING_NAMES); w.opts = [...new Set(w.seq.concat(pool.sort(() => Math.random() - 0.5)))].slice(0, 6).sort(() => Math.random() - 0.5);
  }
}
function roundDone(q) {
  const w = work;
  w.qsum += q; w.round++;
  S.time.min = Math.min(1439, S.time.min + 25);
  w.msg = q >= 1 ? 'Perfeito!' : q >= 0.6 ? 'Bom!' : 'Ops...'; w.msgT = 0.9;
  if (w.game === 'saw' && q >= 0.6) addItem('tabua', 1);
  Audio.sfx(q >= 0.6 ? 'pick' : 'hurt');
  if (w.round >= w.rounds) {
    const qual = w.qsum / w.rounds, g = w.game;
    work = null;
    finishShift(qual * 1.15, g === 'saw' ? ' As tábuas que você serrou ficam com você.' : '');
  } else newRound();
}
function workAction() {
  const w = work; if (!w || w.msgT > 0) return;
  if (w.game === 'forge' || w.game === 'saw') {
    const pos = (Math.sin(w.t * w.speed + w.phase0) + 1) / 2, d = Math.abs(pos - w.zone);
    const q = d < w.zw / 4 ? 1.1 : d < w.zw / 2 ? 0.8 : 0.2;
    w.hq += q; w.hits++;
    Audio.sfx(w.game === 'forge' ? 'rock' : 'chop');
    shake = 3;
    w.zone = rand(0.2, 0.8);
    if (w.hits >= 3) roundDone(w.hq / 3);
  }
}
function workPick(i) {
  const w = work; if (!w || w.msgT > 0) return;
  if (w.game === 'shop') roundDone(w.opts[i] === w.order ? 1 - 0.3 * (w.t / w.limit) + 0.3 : 0.1);
  if (w.game === 'cook' && w.t > w.show) {
    w.input.push(w.opts[i]);
    if (w.input[w.input.length - 1] !== w.seq[w.input.length - 1]) roundDone(0.2);
    else if (w.input.length === w.seq.length) roundDone(1.05);
  }
}
function updateWork(dt) {
  const w = work; if (!w) return;
  if (w.msgT > 0) { w.msgT -= dt; return; }
  w.t += dt;
  if (w.game === 'shop' && w.t > w.limit) roundDone(0);
}
function drawWork() {
  const w = work; if (!w) return;
  ctx.fillStyle = 'rgba(10,14,10,0.62)'; ctx.fillRect(0, 0, W, H);
  addBtn(0, 0, W, H, () => {});
  const pw = Math.min(W - 40, 640), ph = Math.min(H - 30, 330), px = (W - pw) / 2, py = (H - ph) / 2;
  ctx.fillStyle = '#2b2219'; ctx.strokeStyle = '#e8d6a8'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 16); ctx.fill(); ctx.stroke();
  const J = JOBS[S.job.id];
  text(J.name + ' · rodada ' + Math.min(w.round + 1, w.rounds) + '/' + w.rounds, px + 16, py + 20, 15, '#ffe38a', 700);
  text(clockText(), px + pw - 70, py + 20, 13, '#cfc3a6', 600);
  panelButton('Sair', px + pw - 70, py + ph - 44, 58, 32, () => { work = null; toast('Turno abandonado (sem pagamento)'); });
  if (w.game === 'forge' || w.game === 'saw') {
    const bx = px + 40, bw = pw - 80, by = py + 120;
    // peça
    if (w.game === 'forge') { ctx.fillStyle = '#55555f'; ctx.fillRect(px + pw / 2 - 70, py + 50, 140, 30); ctx.fillStyle = '#ff7a2a'; ctx.fillRect(px + pw / 2 - 40, py + 42, 80, 12); ctx.fillStyle = '#ffd34a'; ctx.fillRect(px + pw / 2 - 30, py + 44, 60, 5); }
    else { ctx.fillStyle = '#b07c46'; ctx.fillRect(px + pw / 2 - 110, py + 48, 220, 26); ctx.fillStyle = '#8a5a34'; for (let i = 0; i < 6; i++) ctx.fillRect(px + pw / 2 - 100 + i * 40, py + 52, 2, 18); }
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(bx, by, bw, 26);
    ctx.fillStyle = '#5fae4a'; ctx.fillRect(bx + (w.zone - w.zw / 2) * bw, by, w.zw * bw, 26);
    ctx.fillStyle = '#9be36a'; ctx.fillRect(bx + (w.zone - w.zw / 4) * bw, by, w.zw / 2 * bw, 26);
    const pos = (Math.sin(w.t * w.speed + w.phase0) + 1) / 2;
    ctx.fillStyle = '#fff6d8'; ctx.fillRect(bx + pos * bw - 3, by - 8, 6, 42);
    text('Toque no botão quando a marca estiver no verde (golpe ' + (w.hits + 1) + '/3)', px + 16, by + 50, 13, '#e8dcc0', 600, pw - 32);
    panelButton(w.game === 'forge' ? 'MARTELAR' : 'SERRAR', px + pw / 2 - 90, py + ph - 90, 180, 52, workAction, 'on');
  } else if (w.game === 'shop') {
    text(w.client + ' pede:', px + 20, py + 60, 15, '#fff6e6', 700);
    text('"' + w.order.replace(/^./, c => c.toUpperCase()) + ', por favor!"', px + 20, py + 86, 15, '#ffd6e6', 600, pw - 40);
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(px + 20, py + 106, pw - 40, 8);
    ctx.fillStyle = '#e0a020'; ctx.fillRect(px + 20, py + 106, (pw - 40) * Math.max(0, 1 - w.t / w.limit), 8);
    text('Escolha o pacote certo antes do tempo acabar:', px + 20, py + 130, 12, '#cfc3a6', 600);
    w.opts.forEach((o, i) => panelButton(o, px + 20, py + 146 + i * 46, pw - 120, 40, () => workPick(i)));
  } else if (w.game === 'cook') {
    text('Pedido: ' + { sopa: 'Sopa', torta: 'Torta', pao: 'Pão', ensopado: 'Ensopado de Peixe', doce: 'Doce de Flor' }[w.dish], px + 20, py + 58, 16, '#fff6e6', 700);
    if (w.t < w.show) text('Memorize: ' + w.seq.map(k => ING_NAMES[k]).join(' → '), px + 20, py + 90, 16, '#ffe38a', 700, pw - 40);
    else text('Agora monte na ordem: ' + w.input.map(k => ING_NAMES[k]).join(' → ') + (w.input.length < 3 ? ' → ?' : ''), px + 20, py + 90, 14, '#e8dcc0', 600, pw - 40);
    const bw = (pw - 60) / 3;
    w.opts.forEach((k, i) => panelButton(ING_NAMES[k], px + 20 + (i % 3) * (bw + 10), py + 130 + Math.floor(i / 3) * 52, bw, 44, () => workPick(i), w.t < w.show ? 'off' : null));
  }
  if (w.msgT > 0) label(w.msg, W / 2, py + ph / 2, 34, w.msg === 'Ops...' ? '#ff8a8a' : '#9be36a');
}

// ---------------------------------------------------------------- agricultor: tarefas no mundo
let farmTasks = null;
function startFarmShift() {
  const spots = [];
  for (const [fx, fy, fw, fh] of FIELDS) for (let k = 0; k < 2; k++) spots.push([fx + 40 + Math.random() * (fw - 80), fy + 50 + Math.random() * (fh - 90)]);
  const acts = ['Regar', 'Plantar', 'Colher', 'Adubar'];
  farmTasks = spots.sort(() => Math.random() - 0.5).slice(0, 6).map(([x, y], i) => ({ x, y, act: acts[i % 4], done: false }));
  toast('Turno na horta: faça as 6 tarefas marcadas!');
}
function farmTaskDo(t) {
  t.done = true; S.time.min = Math.min(1439, S.time.min + 15);
  Audio.sfx('pick'); burst(t.x, t.y - 20, t.act === 'Regar' ? '#6fd3ff' : '#9be36a', 12, 100);
  gainText(t.x, t.y - 60, t.act + '!');
  if (farmTasks.every(t => t.done)) { farmTasks = null; finishShift(1.05); }
}
function drawFarmTasks() {
  if (!farmTasks || area !== 'world') return;
  for (const t of farmTasks) if (!t.done) {
    const b = Math.sin(time * 5) * 4;
    ctx.strokeStyle = '#ffe38a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(t.x, t.y, 34, 14, 0, 0, 7); ctx.stroke();
    label(t.act, t.x, t.y - 46 + b, 15, '#ffe38a');
  }
}

// ---------------------------------------------------------------- pesca
let fishing = null;
function waterNear() {
  if (area !== 'world') return null;
  const dirs = [[player.fx, player.fy]].concat([[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]]);
  for (const [dx, dy] of dirs) for (const d of [70, 100, 130]) {
    const x = player.x + dx * d, y = player.y + dy * d * 0.8;
    if (terrainAt(x, y) === 2) return [x, y];
  }
  return null;
}
const fishCount = () => (S.bag.peixe || 0) + (S.bag.truta || 0) + (S.bag.carpa || 0);
function startFishing(spot) { fishing = { phase: 'wait', t: rand(1.4, 3.6), x: spot[0], y: spot[1] }; player.fx = Math.sign(spot[0] - player.x) * 0.7 || 0; player.fy = Math.sign(spot[1] - player.y) * 0.7 || 1; Audio.sfx('swing'); }
function fishAction() {
  const f = fishing; if (!f) return;
  if (f.phase === 'bite') {
    const b = inVale(player.x, player.y) ? 'campo' : biomeAt(player.x, player.y), r = Math.random();
    const carpa = b === 'deserto' || b === 'pantano' ? 0.16 : 0.08;
    const k = r < 0.03 ? 'bota' : r < 0.03 + carpa ? 'carpa' : r < 0.36 + carpa ? 'truta' : 'peixe';
    addItem(k, 1);
    gainText(player.x, player.y - 120, '+1 ' + { bota: 'Bota velha', carpa: 'Carpa dourada!', truta: 'Truta', peixe: 'Peixe' }[k]);
    Audio.sfx(k === 'carpa' ? 'relic' : 'pick'); burst(f.x, f.y, '#9ad1ff', 12, 120);
    if (S.job && S.job.id === 'pescador' && onShiftHours() && k !== 'bota') S.job.shiftFish = (S.job.shiftFish || 0) + 1;
    fishing = null; save();
  } else { fishing = null; toast('Linha recolhida'); }
}
function updateFishing(dt, moving) {
  const f = fishing; if (!f) return;
  if (moving) { fishing = null; return; }
  f.t -= dt;
  if (f.phase === 'wait' && f.t <= 0) { f.phase = 'bite'; f.t = 0.75; Audio.sfx('bark'); }
  else if (f.phase === 'bite' && f.t <= 0) { fishing = null; toast('O peixe escapou!'); }
}
function drawFishing() {
  const f = fishing; if (!f) return;
  const hx = player.x + player.fx * 30, hy = player.y - 70, dip = f.phase === 'bite' ? 8 : Math.sin(time * 3) * 2;
  ctx.strokeStyle = 'rgba(240,240,240,0.9)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(hx, hy); ctx.quadraticCurveTo((hx + f.x) / 2, Math.min(hy, f.y) - 50, f.x, f.y + dip); ctx.stroke();
  ctx.strokeStyle = '#8a5a34'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(player.x + player.fx * 8, player.y - 40); ctx.lineTo(hx, hy); ctx.stroke();
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(f.x, f.y + dip, 7, 0, 7); ctx.fill(); ctx.fillStyle = '#d83a3a'; ctx.beginPath(); ctx.arc(f.x, f.y + dip - 3, 7, Math.PI, 0); ctx.fill();
  if (f.phase === 'bite') label('!', f.x, f.y - 40, 36, '#ffe38a');
}
function deliverFish(n) {
  const c = fishCount();
  let paid = 0;
  for (const k of ['carpa', 'truta', 'peixe']) { const q = S.bag[k] || 0; paid += q * (k === 'carpa' ? 4 : k === 'truta' ? 2 : 1); S.bag[k] = 0; }
  const shift = S.job.shiftFish || 0;
  S.job.shiftFish = 0;
  if (shift >= 4 && S.job.lastShift !== S.time.day) finishShift(Math.min(1.25, 0.8 + paid / 20), ' Os peixes ficam comigo pra feira.');
  else { const p = Math.round(paid * JOBS.pescador.wage * wageMul()); S.coins += p; S.stats.earned += p; Audio.sfx('coin'); talkPid = n.id; talkFace = n; say([n.name + ': Valeu! ' + c + ' peixe(s) = ' + p + ' moedas.' + (shift < 4 && S.job.lastShift !== S.time.day ? ' Pesque 4 no turno pra fechar o dia de trabalho.' : '')]); save(); }
}

// ---------------------------------------------------------------- propriedades
function plotTalk(pl) {
  if (S.props.plots[pl.id]) {
    const mode = plotMode(pl), hasCrops = Object.keys(S.farm).some(k => k.startsWith(pl.id + ':')), hasAnimals = animalsIn(pl).length > 0;
    const ch = [];
    if (mode === 'horta' && !hasCrops && !pl.free) ch.push({ t: 'Virar pasto', fn: () => { S.plotMode = S.plotMode || {}; S.plotMode[pl.id] = 'pasto'; toast('Agora é um pasto para animais'); save(); } });
    if (mode === 'pasto' && !hasAnimals) ch.push({ t: 'Virar horta', fn: () => { S.plotMode[pl.id] = 'horta'; toast('Agora é uma horta'); save(); } });
    ch.push({ t: 'Ok' });
    say(['Este é o ' + pl.name + ' (' + (mode === 'pasto' ? 'pasto: ' + animalsIn(pl).length + ' animais' : 'horta') + ').',
      mode === 'pasto' ? 'Compre animais no Sítio do Seu Tomé e cuide deles todo dia.' : 'Horta: are com a enxada, plante sementes, regue todo dia e colha. A construção livre chega na Fase 7.'], null, ch);
    return;
  }
  say([pl.name + ' à venda por ' + pl.price + ' moedas.'], null, [{ t: 'Comprar (' + pl.price + ')', fn: () => {
    if (S.coins < pl.price) { say(['Você ainda não tem moedas suficientes.']); return; }
    S.coins -= pl.price; S.stats.spent += pl.price; S.props.plots[pl.id] = true; Audio.sfx('relic'); flash = 0.4;
    say(['Parabéns! O ' + pl.name + ' agora é seu.']); save(); } }, { t: 'Agora não' }]);
}
function houseSaleTalk(d) {
  const m = DYN.get(d.to);
  if (S.props.houses[d.to]) { enterInterior(d.to, [d.x, d.y - 14]); return; }
  say(['Casa à venda em ' + m.city.name + ': ' + m.price + ' moedas.', 'Com ela você ganha cama para dormir e um baú nesta cidade.'], null, [{ t: 'Comprar (' + m.price + ')', fn: () => {
    if (S.coins < m.price) { say(['Você ainda não tem moedas suficientes.']); return; }
    S.coins -= m.price; S.stats.spent += m.price; S.props.houses[d.to] = m.city.name; Audio.sfx('relic'); flash = 0.4;
    say(['Parabéns! Agora você tem uma casa em ' + m.city.name + '.']); save(); } }, { t: 'Agora não' }]);
}

// ---------------------------------------------------------------- alvos de interação da economia
function economyTargets() {
  const out = [];
  if (!S.job) { /* sem emprego: só pesca e propriedades */ }
  const J = S.job && JOBS[S.job.id], avail = shiftAvailable();
  if (area === 'world') {
    if (avail && J.game === 'saw') out.push({ kind: 'work', x: 1590, y: 905, r: 140, label: 'Trabalhar', fn: startShift });
    if (avail && J.game === 'farm' && !farmTasks) out.push({ kind: 'work', x: 4990, y: 1400, r: 220, label: 'Trabalhar', fn: startShift });
    if (farmTasks) for (const t of farmTasks) if (!t.done) out.push({ kind: 'work', x: t.x, y: t.y - 40, r: 70, label: t.act, fn: () => farmTaskDo(t) });
    for (const pl of PLOTS) out.push({ kind: 'work', x: pl.x0 + 70, y: pl.y1 - 110, fx: pl.x0 + 70, fy: pl.y1 + 10, r: 100, label: S.props.plots[pl.id] ? 'Terreno' : 'Comprar', fn: () => plotTalk(pl) });
    const feira = PLACES.feira;
    if (shopOpen('feira') && RES_BY_ID.nina && RES_BY_ID.nina.area === 'world' && Math.hypot(RES_BY_ID.nina.x - feira.x, RES_BY_ID.nina.y - feira.y) < 120)
      out.push({ kind: 'work', x: 3330, y: 1830, r: 80, label: 'Roupas', fn: () => { menu = { tab: 'shop', shop: 'feira', mode: 'clothes' }; } });
  } else {
    for (const f of interiorDef.furn) {
      const x = (f.x + f.w / 2) * TILE, y = (f.y + f.h) * TILE;
      if (avail && ((f.use === 'work_forge' && J.game === 'forge') || (f.use === 'work_shop' && J.game === 'shop') || (f.use === 'work_cook' && J.game === 'cook')))
        out.push({ kind: 'work', x, y: f.y * TILE - 10, r: 100, label: 'Trabalhar', fn: startShift, fx: x, fy: y });
    }
  }
  return out;
}
