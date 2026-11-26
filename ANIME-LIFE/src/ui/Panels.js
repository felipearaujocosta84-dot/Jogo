// Janelas: ajustes, créditos, pausa, histórico de falas, histórico de escolhas,
// relacionamentos, galeria, salvar/carregar e confirmação.
import { h, esc, showEl, hideEl } from './dom.js';
import { settings } from '../save/Settings.js';
import { saves, SLOTS } from '../save/SaveManager.js';
import { audio } from '../audio/AudioManager.js';
import { bus } from '../core/EventBus.js';
import { game } from '../core/GameState.js';
import { Characters } from '../characters/CharacterRegistry.js';
import { Relationships, STATS } from '../relationships/RelationshipManager.js';
import { CHAPTERS } from '../story/chapters/index.js';
import { EVENT_CHAPTER } from '../story/events/index.js';
import { backgroundThumb } from '../scenes/backgrounds.js';
import { AIClient, errorText } from '../smartphone/ai/AIClient.js';
import { voice, PROFILES } from '../audio/VoiceManager.js';
import { CATALOG, VOLUMES_INFO, chapterStatus, isUnlocked, progress } from '../story/catalog.js';

export class Modal {
  constructor(ui, inner, { onClose, wide } = {}) {
    this.ui = ui; this.onClose = onClose;
    this.el = h(`<div class="modal hidden"></div>`);
    if (wide) inner.classList.add('wide');
    this.el.appendChild(inner);
    this.el.addEventListener('pointerdown', (e) => { if (e.target === this.el) this.close(); });
    inner.querySelector('.close')?.addEventListener('click', () => this.close());
    ui.root.appendChild(this.el);
  }
  async open() { this.ui.modalCount(+1); (this.ui.openModals ||= new Set()).add(this); await showEl(this.el); return this; }
  async close() {
    if (this.closed) return; this.closed = true;
    this.ui.openModals?.delete(this);
    audio.sfx('close');
    await hideEl(this.el, 220);
    this.ui.modalCount(-1);
    this.el.remove();
    this.onClose?.();
  }
}

const panel = (title, body, cls = '') => h(`<div class="panel ${cls}"><button class="close" aria-label="Fechar">✕</button><h2>${title}</h2>${body}</div>`);
const seg = (key, opts) => `<div class="seg" data-k="${key}">${opts.map(([v, l]) => `<button data-v="${v}" class="${String(settings.data[key]) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
const fmtDate = (t) => new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const where = (s) => {
  const ch = CHAPTERS.find((c) => c.id === s.pos.chapter);
  const sc = ch?.scenes.find((x) => x.id === s.pos.scene);
  return { ch, sc };
};

export function openSettings(ui) {
  const p = panel('⚙️ Ajustes', `
    <div class="row">Música <input type="range" min="0" max="1" step="0.05" data-k="music" value="${settings.data.music}"></div>
    <div class="row">Efeitos sonoros <input type="range" min="0" max="1" step="0.05" data-k="sfx" value="${settings.data.sfx}"></div>
    <div class="row">Velocidade do texto ${seg('textSpeed', [['lenta', 'Lenta'], ['normal', 'Normal'], ['rapida', 'Rápida'], ['instantanea', 'Instant.']])}</div>
    <div class="row">Modo automático ${seg('autoSpeed', [['lento', 'Lento'], ['normal', 'Normal'], ['rapido', 'Rápido']])}</div>
    <div class="row">“Pular” também pula texto não lido ${seg('skipUnread', [[false, 'Não'], [true, 'Sim']])}</div>
    <div class="row">Câmera cinematográfica ${seg('cinema', [[true, 'Ligada'], [false, 'Fixa']])}</div>
    <div class="row">Animação dos personagens ${seg('animations', [['completa', 'Completa'], ['leve', 'Leve'], ['off', 'Desligada']])}</div>
    <div class="row">Gráficos ${seg('quality', [['economica', 'Econômico'], ['auto', 'Auto'], ['alta', 'Alta']])}</div>
    <div class="row">Tela cheia <button class="pbtn alt" data-a="fs">Alternar</button></div>
    <h3>🔊 Vozes</h3>
    <p class="hint">${voice.available ? 'As vozes são <b>sintetizadas pelo aparelho</b> (não são dublagem gravada). Falas com gravação real, quando existirem, aparecem como 🎙.' : 'Este aparelho/navegador não oferece voz sintetizada. Falas com gravação real ainda tocam.'}</p>
    <div class="row">Vozes ${seg('voice', [[true, 'Ligadas'], [false, 'Desligadas']])}</div>
    <div class="row">Volume das vozes <input type="range" min="0" max="1" step="0.05" data-k="voiceVolume" value="${settings.data.voiceVolume ?? 0.9}"></div>
    <div class="voice-list">${Object.keys(PROFILES).filter((id) => Characters.get(id)).map((id) => `<div class="voice-row"><img src="${Characters.portrait(id)}" alt="">
      <select data-voice="${id}"><option value="">Automática${voice.voiceFor(id) ? ` (${esc(voice.voiceFor(id).name)})` : ''}</option>${voice.voices.map((v) => `<option value="${esc(v.id)}" ${settings.data.voices?.[id] === v.id ? 'selected' : ''}>${esc(v.name)} · ${esc(v.lang)}</option>`).join('')}</select>
      <button class="pbtn alt" data-vtest="${id}">▶</button></div>`).join('')}</div>
    <h3>📱 Celular e IA</h3>
    <div class="row col">Servidor de IA (deixe vazio para o modo local)
      <div class="ai-row"><input type="url" class="ai-url" placeholder="https://seu-servidor.exemplo.com" value="${esc(settings.data.aiServer || '')}" autocomplete="off"><button class="pbtn alt" data-a="test">Testar</button></div>
      <small class="ai-status">${settings.data.aiServer ? 'Servidor configurado.' : 'Modo local: respostas limitadas, sem IA real.'}</small></div>
    <div class="row">Mensagens espontâneas ${seg('spontaneous', [['off', 'Desligadas'], ['poucas', 'Poucas'], ['normal', 'Normal'], ['muitas', 'Muitas']])}</div>
    <div class="row">Limite de mensagens por dia ${seg('aiDailyCap', [[30, '30'], [80, '80'], [150, '150']])}</div>`);
  p.querySelectorAll('select[data-voice]').forEach((sel) => sel.addEventListener('change', () => { settings.set('voices', { ...(settings.data.voices || {}), [sel.dataset.voice]: sel.value || undefined }); }));
  p.querySelectorAll('[data-vtest]').forEach((b) => b.addEventListener('click', () => { if (!voice.test(b.dataset.vtest, `Oi, eu sou ${Characters.name(b.dataset.vtest)}. Essa é uma voz sintetizada.`)) ui.toast('Voz sintetizada indisponível neste aparelho'); }));
  p.querySelectorAll('input[type=range]').forEach((r) => r.addEventListener('input', () => { settings.set(r.dataset.k, Number(r.value)); audio.applyVolumes(); }));
  p.querySelectorAll('.seg').forEach((s) => s.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const v = b.dataset.v === 'true' ? true : b.dataset.v === 'false' ? false : /^\d+$/.test(b.dataset.v) ? Number(b.dataset.v) : b.dataset.v;
    settings.set(s.dataset.k, v); audio.sfx('click');
    s.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    if (s.dataset.k === 'quality') ui.engine?.game.refit?.();
    if (s.dataset.k === 'animations') ui.engine?.stage.setAnimationLevel(v);
    bus.emit('settings:changed', s.dataset.k);
  }));
  // Celular e IA: endereço do servidor seguro + teste de conexão
  const url = p.querySelector('.ai-url'), status = p.querySelector('.ai-status');
  url.addEventListener('keydown', (e) => e.stopPropagation());
  url.addEventListener('change', () => { settings.set('aiServer', url.value.trim()); status.textContent = url.value.trim() ? 'Servidor configurado. Toque em Testar.' : 'Modo local: respostas limitadas, sem IA real.'; });
  p.querySelector('[data-a=test]').addEventListener('click', async () => {
    settings.set('aiServer', url.value.trim());
    if (!url.value.trim()) { status.textContent = 'Modo local: respostas limitadas, sem IA real.'; return; }
    status.textContent = 'Testando…';
    try { const r = await AIClient.health(); status.textContent = `✅ Conectado (${r.model}).`; } catch (e) { status.textContent = `❌ ${errorText(e.code)}`; }
  });
  p.querySelector('[data-a=fs]').addEventListener('click', async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch {}
  });
  return new Modal(ui, p).open();
}

export function openCredits(ui) {
  const cast = Characters.all().filter((c) => c.age).map((c) => `${esc(c.name)} (${c.age})`).join(', ');
  const p = panel('✿ Créditos', `<div class="credits">
    <p><b>ANIME LIFE — MINHA VIDA</b><br>Versão 0.2.0 · visual novel</p>
    <p><b>História, roteiro e programação:</b> equipe Anime Life · Phaser 3 · Capacitor</p>
    <p><b>Elenco:</b> ${cast}. Todos os personagens com rotas de romance são adultos.</p>
    <p><b>Personagens:</b> ilustrações de referência fornecidas pelo autor do projeto.</p>
    <p><b>Cenários:</b> pintados por código. <b>Música e efeitos:</b> sintetizados em tempo real.</p>
    <p class="warn">Algumas ilustrações de referência têm marca d'água de banco de imagens ou assinatura de terceiros. Antes de publicar, é preciso licenciá-las ou substituí-las.</p></div>`);
  return new Modal(ui, p).open();
}

export function openConfirm(ui, text, yes = 'Sim', no = 'Cancelar') {
  return new Promise((resolve) => {
    let answer = false;
    const p = h(`<div class="panel narrow"><h2>✿ Atenção</h2><p class="confirm-text">${esc(text)}</p>
      <div class="actions"><button class="pbtn alt" data-a="no">${esc(no)}</button><button class="pbtn" data-a="yes">${esc(yes)}</button></div></div>`);
    const m = new Modal(ui, p, { onClose: () => resolve(answer) });
    p.addEventListener('click', (e) => { const a = e.target.closest('button')?.dataset.a; if (!a) return; answer = a === 'yes'; m.close(); });
    m.open();
  });
}

export function openPause(ui) {
  const p = panel('☰ Menu', `<div class="pause-grid">
    <button class="pbtn" data-a="resume">▶ Continuar</button>
    <button class="pbtn alt" data-a="save">💾 Salvar</button>
    <button class="pbtn alt" data-a="load">📂 Carregar</button>
    <button class="pbtn alt" data-a="rel">💞 Relacionamentos</button>
    <button class="pbtn alt" data-a="choices">🧭 Escolhas</button>
    <button class="pbtn alt" data-a="log">📜 Histórico</button>
    <button class="pbtn alt" data-a="gallery">🖼️ Galeria</button>
    <button class="pbtn alt" data-a="chapters">📚 Capítulos</button>
    <button class="pbtn alt" data-a="settings">⚙️ Ajustes</button>
    <button class="pbtn alt" data-a="title">🏠 Menu principal</button></div>`, 'narrow');
  const m = new Modal(ui, p);
  p.querySelector('.pause-grid').addEventListener('click', async (e) => {
    const a = e.target.closest('button')?.dataset.a; if (!a) return;
    audio.sfx('click');
    if (a === 'resume') return m.close();
    if (a === 'title') { await m.close(); return ui.backToTitle(); }
    ({ save: () => openSaveLoad(ui, 'save'), load: () => openSaveLoad(ui, 'load'), rel: () => openRelationships(ui), choices: () => openDecisions(ui), log: () => openBacklog(ui), gallery: () => openGallery(ui), chapters: () => openChapters(ui), settings: () => openSettings(ui) })[a]();
  });
  return m.open();
}

export function openBacklog(ui) {
  const log = game.state?.log || [];
  const p = panel('📜 Histórico de conversas', `<div class="backlog">${log.map((l) => {
    if (l.kind === 'scene') return `<div class="bl-scene">${esc(l.t)}</div>`;
    if (l.kind === 'choice') return `<div class="bl-choice">➤ ${esc(l.t)}</div>`;
    if (l.kind === 'phone') return `<div class="bl-phone">${esc(l.t)}</div>`;
    const color = l.who && !['player', 'thought'].includes(l.who) ? Characters.color(l.who) : '#b4497a';
    return `<div class="bl-line ${l.who ? '' : 'narr'} ${l.who === 'thought' ? 'thought' : ''}">${l.name ? `<b style="color:${color}">${esc(l.name)}</b>` : ''}<span>${esc(l.t)}</span></div>`;
  }).join('') || '<p>Nada ainda.</p>'}</div>`, 'tall');
  new Modal(ui, p, { wide: true }).open();
  const b = p.querySelector('.backlog'); requestAnimationFrame(() => { b.scrollTop = b.scrollHeight; });
}

export function openDecisions(ui) {
  const list = (game.state?.decisions || []).filter((d) => d.text);
  let lastScene = null;
  const p = panel('🧭 Histórico de escolhas', `<div class="decisions">${list.map((d) => {
    const head = d.scene !== lastScene ? `<div class="bl-scene">${esc(d.chapterTitle || '')} · ${esc(d.sceneTitle || '')}</div>` : '';
    lastScene = d.scene;
    return `${head}<div class="dec">➤ ${esc(d.text)}</div>`;
  }).join('') || '<p>Nenhuma escolha ainda.</p>'}</div>`, 'tall');
  new Modal(ui, p, { wide: true }).open();
}

const ROUTE_LABEL = { insinuada: '♡ Algo começou', aberta: '♥ Rota aberta', fechada: '✕ Rota fechada' };

export function openRelationships(ui) {
  const met = Characters.all().filter((c) => game.state?.rel[c.id]?.met);
  const p = panel('💞 Relacionamentos', `<div class="rels">${met.map((c) => {
    const r = Relationships.get(c.id), route = game.state.routes[c.id];
    return `<div class="rel-card" style="--nc:${c.color}"><img src="${Characters.portrait(c.id)}" alt="">
      <div class="rel-info"><b>${esc(c.name)}</b><small>${c.age} anos · ${esc(c.occupation)} · humor: ${esc(Relationships.mood(c.id))}</small>
      ${STATS.map((s) => (s.key === 'romance' && !Characters.canRomance(c.id)) ? '' : `<div class="bar"><span>${s.icon} ${s.label}</span><div><i style="width:${Math.min(100, (r[s.key] || 0) * 2)}%"></i></div><em>${r[s.key] || 0}</em></div>`).join('')}
      ${route ? `<div class="route">${ROUTE_LABEL[route]}</div>` : ''}<p>${esc(c.bio)}</p></div></div>`;
  }).join('') || '<p>Você ainda não conheceu ninguém.</p>'}</div>`, 'tall');
  return new Modal(ui, p, { wide: true }).open();
}

export function openGallery(ui, { fromMenu = false, unlocked = null } = {}) {
  const got = new Set(unlocked || game.state?.gallery || []);
  const p = panel('🖼️ Galeria de cenas', `<p class="hint">Cenas concluídas ficam aqui. Toque para rever (rever não altera seu jogo).</p>
    ${[...CHAPTERS, EVENT_CHAPTER].map((ch) => `<h3>${ch.isEvents ? '💗 Eventos especiais' : `Capítulo ${ch.number} — ${esc(ch.title)}`}</h3><div class="gallery">${ch.scenes.map((s) => got.has(s.id)
      ? `<button class="g-item" data-id="${s.id}"><img src="${backgroundThumb(s.thumb.bg, 320)}" alt=""><img class="g-char" src="${Characters.fullImage(s.thumb.char)}" alt=""><span>${esc(s.title)}</span></button>`
      : `<div class="g-item locked"><span>🔒 ???</span></div>`).join('')}</div>`).join('')}`, 'tall');
  const m = new Modal(ui, p, { wide: true });
  p.querySelectorAll('.g-item[data-id]').forEach((b) => b.addEventListener('click', async () => {
    audio.sfx('confirm'); await m.close(); ui.replayScene(b.dataset.id, fromMenu);
  }));
  return m.open();
}

export async function openSaveLoad(ui, mode) {
  const all = await saves.list();
  const label = { auto: 'Automático', slot1: 'Espaço 1', slot2: 'Espaço 2', slot3: 'Espaço 3' };
  const p = panel(mode === 'save' ? '💾 Salvar jogo' : '📂 Carregar jogo', `<div class="slots">${SLOTS.map((slot) => {
    const s = all[slot];
    const disabled = (mode === 'save' && slot === 'auto') || (mode === 'load' && !s);
    if (!s) return `<button class="slot empty" data-slot="${slot}" ${disabled ? 'disabled' : ''}><b>${label[slot]}</b><span>— vazio —</span></button>`;
    const { ch, sc } = where(s);
    return `<button class="slot" data-slot="${slot}" ${disabled ? 'disabled' : ''}>
      <img src="${backgroundThumb(s.stage?.bg || 'apartamento', 200)}" alt="">
      <div><b>${label[slot]}</b><span>${esc(s.protagonist.displayName)} · Cap. ${ch?.number ?? '?'} — ${esc(sc?.title ?? '')}</span><small>${fmtDate(s.updatedAt)} · ${s.decisions.length} escolhas</small></div></button>`;
  }).join('')}</div>${mode === 'save' ? '<p class="hint">O espaço automático é atualizado sozinho a cada fala.</p>' : ''}`);
  const m = new Modal(ui, p);
  p.querySelectorAll('.slot:not([disabled])').forEach((b) => b.addEventListener('click', async () => {
    const slot = b.dataset.slot;
    if (mode === 'save') {
      if (all[slot] && !(await openConfirm(ui, `Substituir o jogo salvo em ${label[slot]}?`, 'Substituir'))) return;
      const ok = await ui.saveTo(slot);
      ui.toast(ok ? `💾 Salvo em ${label[slot]}` : '⚠️ Não foi possível salvar');
      m.close();
    } else {
      audio.sfx('confirm'); await m.close(); ui.loadFrom(slot);
    }
  }));
  return m.open();
}

/** 📚 Capítulos: os 350 capítulos planejados, por volume, com status real de produção. */
export function openChapters(ui, { fromMenu = false, done = null } = {}) {
  const finished = new Set(done || Object.entries(game.state?.chapters || {}).filter(([, v]) => v?.done).map(([k]) => k));
  const pr = progress();
  let vol = Math.max(1, Math.ceil(((game.state && CATALOG.find((c) => c.id === game.state.pos?.chapter)?.n) || 1) / 35));
  const p = panel('📚 Capítulos', `<div class="chap-progress">${pr.escrito} escritos e jogáveis · ${pr.roteirizado} roteirizados · ${pr.planejado} planejados · ${CATALOG.length} no total</div>
    <div class="chap-bar"><i style="width:${(pr.escrito / CATALOG.length * 100).toFixed(2)}%"></i></div>
    <div class="chap-vols">${VOLUMES_INFO.map((v) => `<button data-vol="${v.n}">${v.n}. ${esc(v.title)}</button>`).join('')}</div>
    <p class="hint">Capítulos concluídos podem ser revistos (rever não altera seu jogo). O jogo mostra o status real de produção de cada capítulo.</p><p class="hint vol-arc"></p><div class="chap-list"></div>`, 'tall');
  const m = new Modal(ui, p, { wide: true });
  const list = p.querySelector('.chap-list');
  const render = () => {
    p.querySelectorAll('[data-vol]').forEach((b) => b.classList.toggle('on', Number(b.dataset.vol) === vol));
    const v = VOLUMES_INFO[vol - 1];
    p.querySelector('.vol-arc').textContent = `Volume ${v.n} (capítulos ${v.from}–${v.to}): ${v.arc}`;
    list.innerHTML = CATALOG.slice(v.from - 1, v.to).map((c) => {
      const st = chapterStatus(c);
      const open = isUnlocked(c.n, finished);
      const play = st === 'escrito' && finished.has(c.id); // rever capítulos concluídos (não altera o jogo)
      return `<${play ? 'button' : 'div'} class="chap ${open ? '' : 'locked'}" ${play ? `data-ch="${c.id}"` : ''}>
        <span class="num">${c.n}</span><div><b>${open || st !== 'planejado' ? esc(c.title) : '???'}</b><p>${open ? esc(c.synopsis) : '🔒 Termine o capítulo anterior para desbloquear.'}</p></div>
        <span class="st st-${st}">${{ escrito: finished.has(c.id) ? '✔ rever' : open ? '▶ jogável' : '🔒 escrito', roteirizado: '✎ roteirizado', planejado: '… planejado' }[st]}</span></${play ? 'button' : 'div'}>`;
    }).join('');
    list.querySelectorAll('[data-ch]').forEach((b) => b.addEventListener('click', async () => {
      audio.sfx('confirm'); await m.close(); ui.playChapter?.(b.dataset.ch, fromMenu);
    }));
  };
  p.querySelector('.chap-vols').addEventListener('click', (e) => { const b = e.target.closest('[data-vol]'); if (!b) return; audio.sfx('click'); vol = Number(b.dataset.vol); render(); });
  render();
  return m.open();
}
