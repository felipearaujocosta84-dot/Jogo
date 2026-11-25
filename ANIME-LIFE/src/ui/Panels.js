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
import { backgroundThumb } from '../scenes/backgrounds.js';

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
const seg = (key, opts) => `<div class="seg" data-k="${key}">${opts.map(([v, l]) => `<button data-v="${v}" class="${settings.data[key] === v ? 'on' : ''}">${l}</button>`).join('')}</div>`;
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
    <div class="row">Gráficos ${seg('quality', [['economica', 'Econômico'], ['auto', 'Auto'], ['alta', 'Alta']])}</div>
    <div class="row">Tela cheia <button class="pbtn alt" data-a="fs">Alternar</button></div>`);
  p.querySelectorAll('input[type=range]').forEach((r) => r.addEventListener('input', () => { settings.set(r.dataset.k, Number(r.value)); audio.applyVolumes(); }));
  p.querySelectorAll('.seg').forEach((s) => s.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const v = b.dataset.v === 'true' ? true : b.dataset.v === 'false' ? false : b.dataset.v;
    settings.set(s.dataset.k, v); audio.sfx('click');
    s.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    if (s.dataset.k === 'quality') ui.engine?.game.refit?.();
    bus.emit('settings:changed', s.dataset.k);
  }));
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
    <button class="pbtn alt" data-a="settings">⚙️ Ajustes</button>
    <button class="pbtn alt" data-a="title">🏠 Menu principal</button></div>`, 'narrow');
  const m = new Modal(ui, p);
  p.querySelector('.pause-grid').addEventListener('click', async (e) => {
    const a = e.target.closest('button')?.dataset.a; if (!a) return;
    audio.sfx('click');
    if (a === 'resume') return m.close();
    if (a === 'title') { await m.close(); return ui.backToTitle(); }
    ({ save: () => openSaveLoad(ui, 'save'), load: () => openSaveLoad(ui, 'load'), rel: () => openRelationships(ui), choices: () => openDecisions(ui), log: () => openBacklog(ui), gallery: () => openGallery(ui), settings: () => openSettings(ui) })[a]();
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
      <div class="rel-info"><b>${esc(c.name)}</b><small>${c.age} anos · ${esc(c.occupation)}</small>
      ${STATS.map((s) => (s.key === 'romance' && !Characters.canRomance(c.id)) ? '' : `<div class="bar"><span>${s.icon} ${s.label}</span><div><i style="width:${Math.min(100, r[s.key] * 4)}%"></i></div><em>${r[s.key]}</em></div>`).join('')}
      ${route ? `<div class="route">${ROUTE_LABEL[route]}</div>` : ''}<p>${esc(c.bio)}</p></div></div>`;
  }).join('') || '<p>Você ainda não conheceu ninguém.</p>'}</div>`, 'tall');
  return new Modal(ui, p, { wide: true }).open();
}

export function openGallery(ui, { fromMenu = false, unlocked = null } = {}) {
  const got = new Set(unlocked || game.state?.gallery || []);
  const p = panel('🖼️ Galeria de cenas', `<p class="hint">Cenas concluídas ficam aqui. Toque para rever (rever não altera seu jogo).</p>
    ${CHAPTERS.map((ch) => `<h3>Capítulo ${ch.number} — ${esc(ch.title)}</h3><div class="gallery">${ch.scenes.map((s) => got.has(s.id)
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
