// Janelas modais: configurações, créditos, pausa, celular e inventário.
import { h, esc, showEl, hideEl } from './dom.js';
import { settings } from '../save/Settings.js';
import { audio } from '../audio/AudioManager.js';
import { bus } from '../core/EventBus.js';
import { game } from '../core/GameState.js';
import { Characters } from '../characters/CharacterRegistry.js';
import { Phone } from '../smartphone/Phone.js';
import { Inventory } from '../inventory/Inventory.js';
import { Relationships } from '../relationships/RelationshipManager.js';

export class Modal {
  constructor(ui, inner, { onClose } = {}) {
    this.ui = ui; this.onClose = onClose;
    this.el = h(`<div class="modal hidden"></div>`);
    this.el.appendChild(inner);
    this.el.addEventListener('pointerdown', (e) => { if (e.target === this.el) this.close(); });
    inner.querySelector('.close')?.addEventListener('click', () => this.close());
    ui.root.appendChild(this.el);
  }
  async open() { this.ui.modalCount(+1); await showEl(this.el); }
  async close() {
    if (this.el.classList.contains('hidden')) return;
    audio.sfx('close');
    await hideEl(this.el, 250);
    this.ui.modalCount(-1);
    this.onClose?.();
    this.el.remove();
  }
}

const seg = (key, opts) => `<div class="seg" data-k="${key}">${opts.map(([v, l]) => `<button data-v="${v}" class="${settings.data[key] === v ? 'on' : ''}">${l}</button>`).join('')}</div>`;

export function openSettings(ui) {
  const p = h(`<div class="panel"><button class="close" aria-label="Fechar">✕</button><h2>⚙️ Configurações</h2>
    <div class="row">Música <input type="range" min="0" max="1" step="0.05" data-k="music" value="${settings.data.music}"></div>
    <div class="row">Efeitos sonoros <input type="range" min="0" max="1" step="0.05" data-k="sfx" value="${settings.data.sfx}"></div>
    <div class="row">Velocidade do texto ${seg('textSpeed', [['lenta', 'Lenta'], ['normal', 'Normal'], ['rapida', 'Rápida'], ['instantanea', 'Instant.']])}</div>
    <div class="row">Movimento ${seg('movement', [['livre', 'Livre'], ['quatro', '4 direções']])}</div>
    <div class="row">Gráficos ${seg('quality', [['economica', 'Econômico'], ['auto', 'Auto'], ['alta', 'Alta']])}</div>
    <div class="row">Tela cheia <button class="pbtn alt" data-a="fs">Alternar</button></div>
  </div>`);
  p.querySelectorAll('input[type=range]').forEach((r) => r.addEventListener('input', () => { settings.set(r.dataset.k, Number(r.value)); audio.applyVolumes(); }));
  p.querySelectorAll('.seg').forEach((s) => s.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    settings.set(s.dataset.k, b.dataset.v); audio.sfx('click');
    s.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    if (s.dataset.k === 'quality') ui.engine?.refit?.();
    bus.emit('settings:changed', s.dataset.k);
  }));
  p.querySelector('[data-a=fs]').addEventListener('click', async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch {}
  });
  const m = new Modal(ui, p); m.open(); return m;
}

export function openCredits(ui) {
  const list = Characters.all().map((c) => esc(c.name)).join(', ');
  const p = h(`<div class="panel credits"><button class="close" aria-label="Fechar">✕</button><h2>✿ Créditos</h2>
    <p><b>ANIME LIFE — MINHA VIDA</b><br>Versão 0.1.0 · base jogável</p>
    <p><b>Direção e conceito:</b> equipe Anime Life</p>
    <p><b>Programação:</b> Phaser 3 · JavaScript · Capacitor</p>
    <p><b>Personagens oficiais:</b> ${list}<br><small>Ilustrações de referência fornecidas pelo autor do projeto.</small></p>
    <p><b>Cenário, móveis e protagonista:</b> arte procedural feita em código.</p>
    <p><b>Música e efeitos:</b> sintetizados em tempo real (Web Audio).</p>
    <p class="warn">Aviso: algumas ilustrações de referência contêm marca d'água de banco de imagens ou assinatura de terceiros. Antes de publicar o jogo, é preciso licenciá-las ou substituí-las por artes próprias.</p>
  </div>`);
  const m = new Modal(ui, p); m.open(); return m;
}

export function openPause(ui) {
  const p = h(`<div class="panel" style="width:min(340px,90vw)"><button class="close" aria-label="Fechar">✕</button><h2>☰ Pausa</h2>
    <div class="menu-list" style="width:100%">
      <button class="pbtn" data-a="resume">Continuar</button>
      <button class="pbtn alt" data-a="save">Salvar jogo</button>
      <button class="pbtn alt" data-a="settings">Configurações</button>
      <button class="pbtn alt" data-a="title">Menu principal</button>
    </div></div>`);
  const m = new Modal(ui, p);
  p.querySelector('.menu-list').addEventListener('click', async (e) => {
    const a = e.target.closest('button')?.dataset.a; if (!a) return;
    audio.sfx('click');
    if (a === 'resume') m.close();
    if (a === 'save') { ui.scene?.snapshotLocation(); const ok = await ui.save(); ui.toast(ok ? '💾 Jogo salvo' : '⚠️ Não foi possível salvar'); }
    if (a === 'settings') openSettings(ui);
    if (a === 'title') { await m.close(); ui.backToTitle(); }
  });
  m.open(); return m;
}

export function openPhone(ui) {
  const p = h(`<div class="phone"><div class="scr"></div></div>`);
  const scr = p.querySelector('.scr');
  const home = () => {
    scr.innerHTML = `<div class="clock">${game.clockText()}</div><div class="date">Dia ${game.state.time.day} · ${esc(game.p.displayName)}</div>
      <div class="apps">
        <button class="app" data-a="contacts"><i>👥</i>Contatos</button>
        <button class="app off" data-a="soon"><i>💬</i>Mensagens</button>
        <button class="app off" data-a="soon"><i>🗺️</i>Mapa</button>
        <button class="app off" data-a="soon"><i>💼</i>Empregos</button>
        <button class="app off" data-a="soon"><i>🏦</i>Banco</button>
        <button class="app" data-a="close"><i>⏏️</i>Fechar</button>
      </div><p style="font-size:11px;text-align:center;opacity:.7;margin-top:16px">Apps apagados chegam nas próximas versões.</p>`;
  };
  const contacts = () => {
    const list = Phone.contacts();
    scr.innerHTML = `<button class="pbtn alt" data-a="home" style="margin-bottom:10px">‹ Voltar</button>` + (list.length ? list.map((id) => {
      const r = Relationships.get(id); const hearts = Math.max(0, Math.min(5, Math.round(r.affinity / 2)));
      return `<div class="contact"><img src="${Characters.portrait(id)}" alt=""><div><b>${esc(Characters.get(id).name)}</b><small>${esc(Characters.get(id).role || "")}</small><span class="hearts">${'♥'.repeat(hearts)}${'♡'.repeat(5 - hearts)}</span></div></div>`;
    }).join('') : '<p style="text-align:center;font-weight:700">Nenhum contato ainda.<br><small>Converse com as pessoas!</small></p>');
  };
  const m = new Modal(ui, p);
  scr.addEventListener('click', (e) => {
    const a = e.target.closest('button')?.dataset.a; if (!a) return;
    audio.sfx('click');
    if (a === 'contacts') contacts();
    if (a === 'home') home();
    if (a === 'close') m.close();
    if (a === 'soon') ui.toast('Em desenvolvimento');
  });
  home(); m.open(); return m;
}

export function openInventory(ui) {
  const items = Inventory.list();
  const p = h(`<div class="panel"><button class="close" aria-label="Fechar">✕</button><h2>🎒 Inventário</h2>
    <div class="inv-grid">${items.map((it, i) => `<button class="slot" data-i="${i}"><i>${it.icon}</i>${esc(it.name)}${it.qty > 1 ? ` ×${it.qty}` : ''}</button>`).join('')}</div>
    <div class="inv-desc">Toque em um item para ver detalhes.</div></div>`);
  p.querySelector('.inv-grid').addEventListener('click', (e) => {
    const b = e.target.closest('.slot'); if (!b) return;
    audio.sfx('click');
    p.querySelectorAll('.slot').forEach((s) => s.classList.toggle('on', s === b));
    p.querySelector('.inv-desc').textContent = items[b.dataset.i].desc;
  });
  const m = new Modal(ui, p); m.open(); return m;
}

/** Confirmação dentro do jogo (window.confirm é bloqueado em alguns navegadores/iframes). */
export function openConfirm(ui, text, yes = 'Sim', no = 'Cancelar') {
  return new Promise((resolve) => {
    let answer = false;
    const p = h(`<div class="panel" style="width:min(380px,90vw)"><h2>✿ Atenção</h2><p style="font-weight:700;margin:0 0 14px">${esc(text)}</p>
      <div class="create-actions"><button class="pbtn alt" data-a="no">${esc(no)}</button><button class="pbtn" data-a="yes">${esc(yes)}</button></div></div>`);
    const m = new Modal(ui, p, { onClose: () => resolve(answer) });
    p.addEventListener('click', (e) => { const a = e.target.closest('button')?.dataset.a; if (!a) return; answer = a === 'yes'; m.close(); });
    m.open();
  });
}
