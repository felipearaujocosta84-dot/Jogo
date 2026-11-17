/* Vale da Lanterna — sistema (Fase 10): salvamento seguro (cópia diária, recuperação de save corrompido,
   aviso de falta de espaço, salvar ao fechar o app), 3 espaços de salvamento manual, medição de desempenho,
   ajuste automático de qualidade, nível de detalhe (LOD) dos NPCs e limite de partículas. */
'use strict';

// ---------------------------------------------------------------- salvamento seguro
const DAILY_KEY = 'vale-da-lanterna-diario', SLOT_KEY = i => 'vale-da-lanterna-espaco' + i, SLOTS = 3;
let saveWarned = false;
function storeChecked(k, v) {
  try { localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); return true; }
  catch (e) { if (!saveWarned) { saveWarned = true; toast('Não foi possível salvar: armazenamento cheio ou bloqueado.'); } return false; }
}
// lê o save principal; se estiver corrompido, usa a cópia diária
function loadMainRaw() {
  let txt = null;
  try { txt = localStorage.getItem(SAVE_KEY); } catch (e) { return null; }
  if (!txt) return null;
  try { return JSON.parse(txt); }
  catch (e) {
    try { localStorage.setItem('vale-da-lanterna-corrompido', txt); } catch (e2) { /* sem espaço */ }
    const d = load(DAILY_KEY);
    setTimeout(() => toast(d ? 'O save estava danificado: recuperamos a cópia do início do dia.' : 'O save estava danificado e não havia cópia.'), 1500);
    return d;
  }
}
// cópia de segurança a cada novo dia (antes de salvar o dia novo)
function dailyBackup() { const cur = (() => { try { return localStorage.getItem(SAVE_KEY); } catch (e) { return null; } })(); if (cur) storeChecked(DAILY_KEY, cur); }
function slotMeta(i) {
  const s = load(SLOT_KEY(i));
  return s && s.meta ? s.meta : null;
}
function placeName() {
  if (area !== 'world') return (INTERIORS[area] && INTERIORS[area].name) || (DYN.has(area) ? 'Casa na cidade' : 'Interior');
  if (curRegion) return curRegion.name;
  const c = inCity(player.x, player.y, 200);
  return c ? c.name : inVale(player.x, player.y) ? 'Vale da Lanterna' : 'Terras distantes';
}
function saveSlot(i) {
  save();
  const c = calOf(), meta = { day: S.time.day, date: dateText(c.season, c.dom) + ', ano ' + c.year, hour: clockText(), coins: S.coins, place: placeName(), at: Date.now() };
  if (storeChecked(SLOT_KEY(i), { meta, data: S })) { Audio.sfx('pick'); toast('Salvo no espaço ' + i + '.'); }
}
function loadSlot(i) {
  const s = load(SLOT_KEY(i));
  if (!s || !s.data) { toast('Espaço ' + i + ' vazio.'); return; }
  save(); storeChecked('vale-da-lanterna-antes-de-carregar', S);   // permite desfazer
  storeChecked(SAVE_KEY, s.data);
  menu = null;
  startGame(false);
  toast('Carregado o espaço ' + i + ' (' + s.meta.date + ').');
}
function undoLoad() {
  const s = load('vale-da-lanterna-antes-de-carregar'); if (!s) { toast('Nada para desfazer.'); return; }
  storeChecked(SAVE_KEY, s); try { localStorage.removeItem('vale-da-lanterna-antes-de-carregar'); } catch (e) { /* ok */ }
  menu = null; startGame(false); toast('Voltou para o jogo de antes.');
}
function clearSlot(i) { try { localStorage.removeItem(SLOT_KEY(i)); } catch (e) { /* ok */ } toast('Espaço ' + i + ' apagado.'); }
function saveSizeKB() { try { return Math.round((localStorage.getItem(SAVE_KEY) || '').length / 1024); } catch (e) { return 0; } }
// salvar quando o app vai para segundo plano ou é fechado (celular)
window.addEventListener('pagehide', () => { if (mode === 'play') save(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play') save(); });

// ---------------------------------------------------------------- desempenho
const PERF = { fps: 60, ms: 0, acc: 0, n: 0, work: 0, t: 0, lowFor: 0 };
function perfFrame(dtReal, workMs) {
  PERF.acc += dtReal; PERF.work += workMs; PERF.n++;
  if (PERF.acc >= 1) {
    PERF.fps = Math.round(PERF.n / PERF.acc); PERF.ms = PERF.work / PERF.n;
    PERF.acc = 0; PERF.work = 0; PERF.n = 0;
    // ajuste automático: se ficar abaixo de 38 fps por 5 segundos seguidos, baixa um nível
    if (CONFIG.autoQ !== false && mode === 'play' && !document.hidden) {
      PERF.lowFor = PERF.fps < 38 ? PERF.lowFor + 1 : 0;
      const ks = Object.keys(QUALITY), i = ks.indexOf(CONFIG.quality);
      if (PERF.lowFor >= 5 && i > 0) { PERF.lowFor = 0; setQuality(ks[i - 1]); toast('O jogo estava lento: gráficos ajustados para ' + Q().name + '.'); }
    }
  }
  // partículas: limite por qualidade
  const cap = Math.round(500 * Q().fx);
  if (particles.length > cap) particles.splice(0, particles.length - cap);
}
function drawPerfHUD() {
  if (!CONFIG.showFps) return;
  const t = PERF.fps + ' fps · ' + PERF.ms.toFixed(1) + ' ms · ' + Q().name + ' · NPCs 3D ' + lodCount3D;
  ctx.font = `600 11px ${FONT}`; const w = ctx.measureText(t).width + 12;
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(W / 2 - w / 2, H - 20 - SAFE.b, w, 16);
  ctx.fillStyle = PERF.fps < 40 ? '#ff9a8a' : '#9be36a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, W / 2, H - 12 - SAFE.b);
}

// ---------------------------------------------------------------- nível de detalhe dos NPCs
// só os NPCs mais próximos usam o boneco 3D; os distantes usam o desenho 2D (sem gastar memória de atlas)
const LOD = { baixo: [0, 0], medio: [900, 10], alto: [1400, 18], ultra: [2600, 40] };
let lodCount3D = 0, lodNext = 0;
function updateLOD() {
  if (--lodNext > 0) return;
  lodNext = 10;
  const [dist, max] = LOD[CONFIG.quality] || LOD.medio;
  const near = npcs.map(n => [n, Math.hypot(n.x - player.x, n.y - player.y)]).filter(([, d]) => area !== 'world' || d < dist).sort((a, b) => a[1] - b[1]);
  for (const n of npcs) n.lod2d = true;
  near.slice(0, max).forEach(([n]) => { n.lod2d = false; });
  lodCount3D = Math.min(near.length, max);
}
