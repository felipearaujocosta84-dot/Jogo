// Interface de visual novel: caixa de diálogo inferior, nome, texto com digitação,
// avançar (toque em qualquer lugar), opções de resposta, modo automático, pular e ocultar interface.
import { h, esc } from './dom.js';
import { Characters } from '../characters/CharacterRegistry.js';
import { game } from '../core/GameState.js';
import { settings } from '../save/Settings.js';
import { audio } from '../audio/AudioManager.js';
import { bus } from '../core/EventBus.js';

export class DialogueUI {
  constructor(ui) {
    this.ui = ui;
    this.el = h(`<div id="vn" class="hidden">
      <div class="tapzone"></div>
      <div class="choices"></div>
      <div class="dl-box">
        <div class="dl-name hidden"></div>
        <div class="dl-text"></div>
        <div class="dl-ind">▼</div>
      </div>
      <div class="quick">
        <button data-q="log" title="Histórico">📜<span>Histórico</span></button>
        <button data-q="auto" title="Automático">▶<span>Auto</span></button>
        <button data-q="skip" title="Pular">⏩<span>Pular</span></button>
        <button data-q="save" title="Salvar">💾<span>Salvar</span></button>
        <button data-q="hide" title="Ocultar interface">👁<span>Ocultar</span></button>
      </div>
      <div class="topbar">
        <button class="hbtn" data-q="phone" aria-label="Celular">📱<span class="badge hidden"></span></button>
        <button class="hbtn" data-q="menu" aria-label="Menu">☰</button>
      </div>
      <div class="memories"></div>
    </div>`);
    ui.root.appendChild(this.el);
    this.box = this.el.querySelector('.dl-box');
    this.nameEl = this.el.querySelector('.dl-name');
    this.textEl = this.el.querySelector('.dl-text');
    this.choicesEl = this.el.querySelector('.choices');
    this.auto = false; this.skip = false;
    const advance = (e) => { e.preventDefault(); if (this.el.classList.contains('ui-off')) return this.setHidden(false); this.tap(); };
    this.el.querySelector('.tapzone').addEventListener('pointerup', advance);
    this.box.addEventListener('pointerup', advance);
    this.el.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); this.quick(b.dataset.q); }));
    window.addEventListener('keydown', (e) => {
      if (this.el.classList.contains('hidden') || this.ui.modals) return;
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!e.repeat) this.tap(); }
      const n = Number(e.key);
      if (this.pickFn && n >= 1 && n <= this.options.length && !this.options[n - 1].locked) this.pickFn(n - 1);
      if (e.key === 'Control') this.setSkip(true);
    });
    window.addEventListener('keyup', (e) => { if (e.key === 'Control') this.setSkip(false); });
    bus.on('memory', (id, text) => this.memory(id, text));
    bus.on('phone:post', () => this.badge(true));
    bus.on('phone:contact', (id) => this.memory(id, `${Characters.name(id)} foi adicionad${Characters.get(id)?.pronoun === 'ele' ? 'o' : 'a'} aos contatos.`, '📱'));
  }

  get skipping() { return this.skip; }

  show() { this.el.classList.remove('hidden'); }
  hide() { this.el.classList.add('hidden'); this.setAuto(false); this.setSkip(false); }
  badge(on) { this.el.querySelector('[data-q=phone] .badge').classList.toggle('hidden', !on); }

  quick(q) {
    audio.sfx('click');
    if (q === 'auto') return this.setAuto(!this.auto);
    if (q === 'skip') return this.setSkip(!this.skip);
    if (q === 'hide') return this.setHidden(true);
    this.setAuto(false); this.setSkip(false);
    if (q === 'log') this.ui.openBacklog();
    if (q === 'save') this.ui.openSaveLoad('save');
    if (q === 'phone') { this.badge(false); this.ui.phone.openApp(); }
    if (q === 'menu') this.ui.openPause();
  }

  setAuto(v) { this.auto = v; this.el.querySelector('[data-q=auto]').classList.toggle('on', v); if (v && this.typingDone && this.resolveLine) this.scheduleAuto(); }
  setSkip(v) { this.skip = v; this.el.querySelector('[data-q=skip]').classList.toggle('on', v); if (v && this.resolveLine) this.tryFastForward(); }
  setHidden(v) { this.el.classList.toggle('ui-off', v); }

  /** Mostra uma fala; resolve quando o jogador avança. */
  say({ speaker, text }, { read = false } = {}) {
    clearTimeout(this.autoTimer);
    this.choicesEl.innerHTML = '';
    this.box.classList.add('show');
    const isChar = speaker && !['player', 'thought'].includes(speaker);
    const name = speaker === 'player' ? game.p.displayName : speaker === 'thought' ? game.p.displayName : isChar ? Characters.name(speaker) : '';
    this.nameEl.textContent = name;
    this.nameEl.classList.toggle('hidden', !name);
    this.nameEl.style.setProperty('--nc', isChar ? Characters.color(speaker) : '#ff8fb8');
    this.box.dataset.kind = !speaker ? 'narr' : speaker === 'thought' ? 'thought' : speaker === 'player' ? 'player' : 'char';
    this.read = read;
    this.full = speaker === 'thought' ? `(${text})` : text;
    return new Promise((resolve) => {
      this.resolveLine = resolve;
      this.type();
      this.tryFastForward();
    });
  }

  tryFastForward() {
    if (this.skip && (this.read || settings.data.skipUnread)) {
      this.complete();
      clearTimeout(this.autoTimer);
      this.autoTimer = setTimeout(() => this.finishLine(), 70);
    } else if (this.skip && !this.read) this.setSkip(false); // para no texto novo
  }

  type() {
    clearInterval(this.timer);
    this.typingDone = false;
    this.el.querySelector('.dl-ind').classList.remove('on');
    const delay = settings.textDelay();
    if (!delay) { this.textEl.textContent = this.full; return this.afterTyping(); }
    let i = 0; this.textEl.textContent = '';
    this.timer = setInterval(() => {
      i += 1;
      this.textEl.textContent = this.full.slice(0, i);
      if (i % 3 === 0 && this.full[i - 1] !== ' ') audio.sfx('blip');
      if (i >= this.full.length) this.afterTyping();
    }, delay);
  }

  complete() { if (!this.typingDone) { this.textEl.textContent = this.full; this.afterTyping(); } }

  afterTyping() {
    clearInterval(this.timer); this.typingDone = true;
    this.el.querySelector('.dl-ind').classList.add('on');
    if (this.auto) this.scheduleAuto();
  }

  scheduleAuto() {
    clearTimeout(this.autoTimer);
    this.autoTimer = setTimeout(() => { if (this.auto && !this.ui.modals) this.finishLine(); else if (this.auto) this.scheduleAuto(); }, settings.autoDelay() + this.full.length * 18);
  }

  tap() {
    if (this.pickFn) return; // esperando uma escolha
    if (!this.resolveLine) return;
    if (!this.typingDone) return this.complete();
    audio.sfx('click');
    this.finishLine();
  }

  finishLine() {
    clearTimeout(this.autoTimer);
    const r = this.resolveLine; this.resolveLine = null;
    r?.();
  }

  /** Mostra as opções; resolve com o índice escolhido. options: [{ text, locked, lock }] */
  choose(options) {
    this.setSkip(false);
    this.options = options;
    this.el.querySelector('.dl-ind').classList.remove('on');
    this.choicesEl.innerHTML = options.map((o, i) => `<button data-i="${i}" ${o.locked ? 'disabled' : ''} style="animation-delay:${i * 70}ms">
      <b>${o.locked ? '🔒' : i + 1}</b><span>${esc(o.text)}${o.locked && o.lock ? `<small>${esc(o.lock)}</small>` : ''}</span></button>`).join('');
    return new Promise((resolve) => {
      this.pickFn = (i) => {
        audio.sfx('confirm');
        this.pickFn = null; this.choicesEl.innerHTML = '';
        resolve(i);
      };
      this.choicesEl.querySelectorAll('button:not([disabled])').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); this.pickFn?.(Number(b.dataset.i)); }));
    });
  }

  memory(id, text, icon) {
    const el = h(`<div class="memory"><img src="${Characters.portrait(id)}" alt=""><span>${icon ? `${icon} ` : ''}${esc(text)}</span></div>`);
    this.el.querySelector('.memories').appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 400); }, 3400);
  }

  /** Interrompe tudo (voltar ao menu, carregar outro jogo). */
  abort() {
    clearInterval(this.timer); clearTimeout(this.autoTimer);
    this.resolveLine = null; this.pickFn = null; this.choicesEl.innerHTML = '';
    this.box.classList.remove('show');
  }
}
