/* Vale da Lanterna — interface (Fase 9): menu com barra lateral (cabe em celular na horizontal),
   abas novas de Calendário e clima, Propriedades e Construção, e lembrança da última aba aberta. */
'use strict';

const MENU_TABS = [
  ['bag', 'Mochila'], ['craft', 'Criar'], ['quests', 'Missões'], ['people', 'Pessoas'], ['family', 'Família'],
  ['job', 'Trabalho'], ['farm', 'Fazenda'], ['build', 'Construção'], ['props', 'Propriedades'], ['calendar', 'Calendário'], ['config', 'Ajustes']
];
const MENU_TITLES = { gift: 'Presente', shop: 'Loja', storage: 'Baú', myshop: 'Loja do Kai' };
let lastMenuTab = 'bag';
function openMainMenu(tab) { menu = { tab: tab || lastMenuTab }; Audio.sfx('ui'); }
function setMenuTab(id) { menu = { tab: id }; lastMenuTab = id; Audio.sfx('ui'); }

function drawMenu() {
  ctx.fillStyle = 'rgba(10,14,10,0.6)'; ctx.fillRect(0, 0, W, H);
  addBtn(0, 0, W, H, () => {});
  const pw = Math.min(W - 24 - SAFE.l - SAFE.r, 940), ph = H - 20 - SAFE.t - SAFE.b, px = (W - pw) / 2, py = SAFE.t + 10;
  ctx.fillStyle = '#2b2219'; ctx.strokeStyle = '#e8d6a8'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 16); ctx.fill(); ctx.stroke();
  // barra lateral
  const sw = clamp(pw * 0.15, 96, 132), n = MENU_TABS.length, th = Math.min(36, (ph - 20 - (n - 1) * 4) / n);
  ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.roundRect(px + 6, py + 6, sw, ph - 12, 12); ctx.fill();
  MENU_TABS.forEach(([id, t], i) => {
    const on = menu.tab === id || (id === 'craft' && menu.tab === 'craft');
    panelButton(t, px + 12, py + 10 + i * (th + 4), sw - 12, th, () => setMenuTab(id), on ? 'on' : null);
    const badge = tabBadge(id);
    if (badge) { ctx.fillStyle = '#ff5a6a'; ctx.beginPath(); ctx.arc(px + sw - 4, py + 12 + i * (th + 4), 6, 0, 7); ctx.fill(); }
  });
  // cabeçalho
  const cx = px + sw + 20, cw = pw - sw - 34;
  const title = (MENU_TABS.find(t => t[0] === menu.tab) || [0, MENU_TITLES[menu.tab] || ''])[1];
  text(title, cx, py + 28, 20, '#ffe38a', 700, cw - 200);
  ctx.font = `700 14px ${FONT}`; ctx.textAlign = 'right'; ctx.fillStyle = '#ffd65a';
  ctx.fillText(S.coins + ' moedas · ' + clockText(), px + pw - 56, py + 28);
  panelButton('✕', px + pw - 46, py + 10, 34, 34, () => { menu = null; Audio.sfx('ui'); });
  const cy = py + 54, ch = ph - 64;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  const T = menu.tab;
  if (T === 'bag') drawBagTab(cx, cy, cw, ch);
  else if (T === 'craft') drawCraftTab(cx, cy, cw, ch);
  else if (T === 'quests') drawQuestTab(cx, cy, cw, ch);
  else if (T === 'people') drawPeopleTab(cx, cy, cw, ch);
  else if (T === 'family') drawFamilyTab(cx, cy, cw, ch);
  else if (T === 'gift') drawGiftTab(cx, cy, cw, ch);
  else if (T === 'shop') drawShopTab(cx, cy, cw, ch);
  else if (T === 'job') drawJobTab(cx, cy, cw, ch);
  else if (T === 'farm') drawFarmTab(cx, cy, cw, ch);
  else if (T === 'storage') drawStorageTab(cx, cy, cw, ch);
  else if (T === 'myshop') drawMyShopTab(cx, cy, cw, ch);
  else if (T === 'build') drawBuildTab(cx, cy, cw, ch);
  else if (T === 'props') drawPropsTab(cx, cy, cw, ch);
  else if (T === 'calendar') drawCalendarTab(cx, cy, cw, ch);
  else drawConfigTab(cx, cy, cw, ch);
}
// bolinha vermelha nas abas que pedem atenção
function tabBadge(id) {
  if (id === 'family') return S.family.kids.some(k => k.needs.fome < 30 || k.needs.carinho < 30) || (S.romance && sm(S.romance.id).upset);
  if (id === 'farm') return S.animals.some(a => a.ready) || Object.values(S.farm).some(f => f.crop && !f.dead && f.days >= CROPS[f.crop].days);
  if (id === 'job') return S.job && S.job.lastShift !== S.time.day && onShiftHours();
  if (id === 'props') return S.myshop && S.myshop.till > 0;
  return false;
}

// ---------------------------------------------------------------- calendário e clima
const WEEK_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
function dayEvents(d) {
  const c = calOf(d), ev = [];
  for (const h of HOLIDAYS) if (h.s === c.season && h.d === c.dom) ev.push({ t: h.name + ' (praça, 17h)', k: 'festa' });
  for (const [id, info] of Object.entries(SOCIAL)) if (info.bday && info.bday[0] === c.season && info.bday[1] === c.dom && RES_BY_ID[id]) ev.push({ t: 'Aniversário de ' + RES_BY_ID[id].name, k: 'niver' });
  if (S.romance && S.romance.status === 'noivos' && S.romance.weddingDay === d) ev.push({ t: 'Seu casamento!', k: 'casamento' });
  for (const k of S.family.kids) if (d > k.born && (d - k.born) % 28 === 0) ev.push({ t: 'Aniversário de ' + k.name, k: 'niver' });
  if (S.family.babyDue === d) ev.push({ t: 'O bebê deve chegar', k: 'casamento' });
  return ev;
}
const FORECAST_DAYS = 3;   // previsão conhecida: hoje e os próximos 2 dias
function drawCalendarTab(x, y, w, h) {
  const now = calOf(), base = S.time.day - (now.dom - 1);           // primeiro dia da estação atual
  const off = menu.calOff || 0, first = base + off * 28, c0 = calOf(first);
  const gw = Math.min(w * 0.6, 520), cellW = gw / 7, cellH = Math.min(58, (h - 52) / 4);
  panelButton('◀', x, y - 4, 40, 30, () => { menu.calOff = off - 1; menu.calSel = null; });
  panelButton('▶', x + gw - 40, y - 4, 40, 30, () => { menu.calOff = off + 1; menu.calSel = null; });
  ctx.textAlign = 'center'; ctx.font = `700 15px ${FONT}`; ctx.fillStyle = '#fff6e6';
  ctx.fillText(SEASONS[c0.season] + ' · ano ' + c0.year, x + gw / 2, y + 11);
  WEEK_SHORT.forEach((d, i) => { ctx.font = `600 11px ${FONT}`; ctx.fillStyle = '#b8ad94'; ctx.fillText(d, x + i * cellW + cellW / 2, y + 38); });
  const sel = menu.calSel || S.time.day;
  for (let i = 0; i < 28; i++) {
    const d = first + i, cx = x + (i % 7) * cellW, cy = y + 48 + Math.floor(i / 7) * cellH, ev = dayEvents(d);
    const past = d < S.time.day, today = d === S.time.day;
    ctx.fillStyle = today ? 'rgba(255,214,90,0.28)' : past ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.08)';
    ctx.beginPath(); ctx.roundRect(cx + 2, cy + 2, cellW - 4, cellH - 4, 7); ctx.fill();
    if (d === sel) { ctx.strokeStyle = '#ffd65a'; ctx.lineWidth = 2; ctx.stroke(); }
    ctx.textAlign = 'left'; ctx.font = `700 12px ${FONT}`; ctx.fillStyle = past ? '#7a7060' : '#fff6e6';
    ctx.fillText(String(i + 1), cx + 7, cy + 12);
    if (d >= S.time.day && d < S.time.day + FORECAST_DAYS) drawWeatherIcon(weatherDay(d).type, cx + cellW - 14, cy + 13);
    ev.slice(0, 2).forEach((e, j) => {
      ctx.fillStyle = e.k === 'festa' ? '#ffd65a' : e.k === 'casamento' ? '#ff7aa6' : '#9ad1ff';
      ctx.beginPath(); ctx.arc(cx + 10 + j * 11, cy + cellH - 12, 4, 0, 7); ctx.fill();
    });
    addBtn(cx, cy, cellW, cellH, () => { menu.calSel = d; });
  }
  ctx.textAlign = 'left';
  // detalhes do dia escolhido
  const ex = x + gw + 18, ew = w - gw - 18, sc = calOf(sel);
  text(weekday(sel) + ', ' + dateText(sc.season, sc.dom), ex, y + 11, 15, '#ffe38a', 700, ew);
  let yy = y + 34;
  const rel = sel - S.time.day;
  text(rel === 0 ? 'Hoje · agora: ' + weatherName() + ', ' + clockText() : rel === 1 ? 'Amanhã' : rel > 0 ? 'Daqui a ' + rel + ' dias' : 'Já passou', ex, yy, 12, '#cfc3a6', 600, ew); yy += 22;
  if (rel >= 0 && rel < FORECAST_DAYS) { drawWeatherIcon(weatherDay(sel).type, ex + 9, yy); text('Previsão: ' + forecastText(sel), ex + 24, yy, 12, '#e8dcc0', 600, ew - 24); }
  else text(rel < 0 ? '' : 'Previsão do tempo: só para os próximos ' + FORECAST_DAYS + ' dias.', ex, yy, 11, '#b8ad94', 500, ew);
  yy += 24;
  const ev = dayEvents(sel);
  text('Eventos', ex, yy, 13, '#ffe38a', 700); yy += 18;
  (ev.length ? ev.map(e => e.t) : ['Nenhum evento.']).forEach(l => { text('• ' + l, ex, yy, 12, '#e8dcc0', 600, ew); yy += 17; });
  yy += 8;
  text('Plantar em ' + SEASONS[sc.season], ex, yy, 13, '#ffe38a', 700); yy += 18;
  const crops = Object.values(CROPS).filter(C => C.seasons.includes(sc.season)).map(C => C.name);
  text(crops.join(', ') || 'Nada cresce nesta estação.', ex, yy, 11, '#e8dcc0', 600, ew); yy += 22;
  let lx = ex;
  for (const [t, c] of [['festa', '#ffd65a'], ['aniver.', '#9ad1ff'], ['casório/bebê', '#ff7aa6']]) {
    ctx.fillStyle = c; ctx.beginPath(); ctx.arc(lx + 4, y + h - 8, 4, 0, 7); ctx.fill();
    text(t, lx + 12, y + h - 8, 10, '#b8ad94', 500); ctx.font = `500 10px ${FONT}`; lx += ctx.measureText(t).width + 20;
  }
}

// ---------------------------------------------------------------- propriedades
function drawPropsTab(x, y, w, h) {
  const colW = (w - 16) / 2;
  let yy = y + 8;
  text('Terrenos', x, yy, 15, '#ffe38a', 700); yy += 20;
  for (const pl of PLOTS) {
    const own = S.props.plots[pl.id];
    const nb = S.builds.filter(b => { const p = plotAt(b.x, b.y); return p && p.id === pl.id; }).length;
    text((own ? '✓ ' : '○ ') + pl.name + (own ? ' · ' + (pl.free ? 'quintal' : plotMode(pl) === 'pasto' ? 'pasto' : 'horta') + (nb ? ' · ' + nb + ' construç' + (nb > 1 ? 'ões' : 'ão') : '') : ' · ' + pl.price + ' moedas (placa no local)'),
      x, yy, 12, own ? '#9be36a' : '#e8dcc0', 600, colW); yy += 18;
  }
  yy += 8; text('Casas', x, yy, 15, '#ffe38a', 700); yy += 20;
  text('✓ Casa do Kai (a oeste da Praça)', x, yy, 12, '#9be36a', 600, colW); yy += 18;
  for (const [id, city] of Object.entries(S.props.houses)) { text('✓ Casa em ' + city, x, yy, 12, '#9be36a', 600, colW); yy += 18; }
  const myHouses = S.builds.filter(b => BUILD_BY_ID[b.item] && BUILD_BY_ID[b.item].enter);
  for (const b of myHouses) { text('✓ ' + BUILD_BY_ID[b.item].name + ' (construída)', x, yy, 12, '#9be36a', 600, colW); yy += 18; }
  text('Casas à venda aparecem nas cidades com a placa "À venda".', x, yy, 11, '#b8ad94', 500, colW); yy += 24;
  if (hasMyShop()) {
    const st = Object.values(S.myshop.stock).reduce((a, b) => a + b, 0);
    text('Loja do Kai · ' + st + ' itens na vitrine · caixa ' + S.myshop.till + ' moedas', x, yy, 12, '#ffd6e6', 700, colW - 120);
    panelButton('Recolher', x + colW - 104, yy - 14, 100, 28, collectTill, S.myshop.till ? 'on' : 'off'); yy += 22;
  }
  const inBox = Object.values(S.storage).reduce((a, b) => a + b, 0);
  text('Baús: ' + inBox + ' itens guardados', x, yy, 12, '#e8dcc0', 600, colW);
  // direita: roupas, ferramentas, finanças
  const ex = x + colW + 16;
  yy = y + 8; text('Roupas', ex, yy, 15, '#ffe38a', 700); yy += 18;
  const bw = Math.min(104, (colW - 16) / 3);
  OUTFITS.filter(o => S.outfits.includes(o.id)).forEach((o, i) => panelButton(o.name, ex + (i % 3) * (bw + 6), yy + Math.floor(i / 3) * 34, bw, 28, () => { S.outfit = o.id; save(); }, S.outfit === o.id ? 'on' : null));
  yy += Math.ceil(S.outfits.length / 3) * 34 + 6;
  text('Mais roupas no Ateliê da Nina (barraca roxa da praça) e no guarda-roupa.', ex, yy, 11, '#b8ad94', 500, colW); yy += 24;
  text('Ferramentas', ex, yy, 15, '#ffe38a', 700); yy += 18;
  for (const [k, T] of Object.entries(TOOLS)) { text((S.tools[k] ? '✓ ' : '○ ') + T.name + (S.tools[k] ? '' : ' · ' + T.price + ' moedas'), ex, yy, 12, S.tools[k] ? '#9be36a' : '#e8dcc0', 600, colW); yy += 17; }
  yy += 8; text('Finanças', ex, yy, 15, '#ffe38a', 700); yy += 18;
  text('Moedas: ' + S.coins + ' · ganhou ' + S.stats.earned + ' · gastou ' + S.stats.spent, ex, yy, 12, '#e8dcc0', 600, colW);
}

// ---------------------------------------------------------------- construção (catálogo e atalho)
function drawBuildTab(x, y, w, h) {
  const ctxW = buildContext(), colW = Math.min(250, w * 0.36);
  wrapText(ctxW ? (ctxW === 'world' ? 'Você está num terreno seu.' : 'Você está numa casa sua.') : 'Vá até um terreno seu ou entre numa casa sua.', x, y + 2, 12, ctxW ? '#9be36a' : '#e8dcc0', 600, colW, 14);
  panelButton(ctxW ? 'Construir aqui' : 'Fora de um terreno', x, y + 30, colW, 40, () => openBuild(), ctxW ? 'on' : 'off');
  text('Como funciona', x, y + 82, 13, '#ffe38a', 700);
  let ty = y + 100;
  for (const l of ['O botão Construir também aparece na tela quando você está no lugar certo.', 'Fantasma verde: pode colocar. Vermelho: mostra o motivo.',
    'Girar, Grade, Mover e Remover (devolve os materiais).', 'Tábuas: carpintaria ou 2 madeiras na aba Criar.', 'Móveis e quarto infantil só dentro de casa.'])
    ty = wrapText('• ' + l, x, ty, 11, '#e8dcc0', 500, colW, 14) + 4;
  // catálogo
  const ex = x + colW + 16, ew = w - colW - 16;
  const cats = [...new Set(BUILD_CATALOG.map(c => c.cat))], cat = menu.bcat && cats.includes(menu.bcat) ? menu.bcat : cats[0];
  const cbw = Math.min(110, (ew - (cats.length - 1) * 4) / cats.length);
  const short = { 'Construções': 'Casas', 'Cercas e caminhos': 'Cercas', 'Decoração': 'Decoração', 'Móveis': 'Móveis', 'Quarto infantil': 'Infantil' };
  cats.forEach((c, i) => panelButton(short[c] || c, ex + i * (cbw + 4), y - 4, cbw, 28, () => { menu.bcat = c; menu.bpage = 0; }, c === cat ? 'on' : null));
  const list = BUILD_CATALOG.filter(c => c.cat === cat), rh = 40, per = Math.max(1, Math.floor((h - 70) / (rh + 4))) * 2;
  const pages = Math.ceil(list.length / per), pg = clamp(menu.bpage || 0, 0, pages - 1), cw2 = (ew - 8) / 2;
  list.slice(pg * per, pg * per + per).forEach((it, i) => {
    const cx = ex + (i % 2) * (cw2 + 8), cy = y + 32 + Math.floor(i / 2) * (rh + 4), ok = canPay(it.cost);
    ctx.fillStyle = 'rgba(255,255,255,' + (ok ? 0.09 : 0.04) + ')'; ctx.beginPath(); ctx.roundRect(cx, cy, cw2, rh, 8); ctx.fill();
    text(it.name + (it.where === 'inside' ? ' · dentro' : ''), cx + 8, cy + 13, 12, ok ? '#fff6e6' : '#9a9080', 700, cw2 - 16);
    text(costText(it.cost), cx + 8, cy + 29, 10, ok ? '#ffd65a' : '#8a8070', 600, cw2 - 16);
  });
  if (pages > 1) {
    panelButton('◀', ex + ew - 96, y + h - 30, 44, 28, () => { menu.bpage = Math.max(0, pg - 1); });
    panelButton('▶', ex + ew - 46, y + h - 30, 44, 28, () => { menu.bpage = Math.min(pages - 1, pg + 1); });
  }
  text('Amarelo: você tem os materiais. Construções: ' + S.builds.length + ' · móveis colocados: ' + Object.values(S.decor).reduce((a, l) => a + l.length, 0), ex, y + h - 16, 10, '#b8ad94', 500, ew - 110);
}

// texto com quebra de linha; devolve o y da próxima linha
function wrapText(t, x, y, size, col, weight, maxW, lh) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  let line = '';
  for (const wd of t.split(' ')) {
    const test = line ? line + ' ' + wd : wd;
    if (ctx.measureText(test).width > maxW && line) { text(line, x, y, size, col, weight); y += lh; line = wd; } else line = test;
  }
  if (line) { text(line, x, y, size, col, weight); y += lh; }
  return y;
}
