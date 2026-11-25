// Interface de visual novel: retrato original, nome, texto com efeito de digitação,
// botão de avançar, opções de resposta e expressões.
//
// EXPRESSÕES: só existe a ilustração original (neutra) de cada personagem. Se houver arte
// de expressão registrada (characters.json → "expressions"), ela é usada; senão a ilustração
// original é mantida e a expressão é comunicada por animação + balão (♪ ! ? 💢 💧) + rubor.
import { h, esc } from './dom.js';
import { Characters } from '../characters/CharacterRegistry.js';
import { game } from '../core/GameState.js';
import { settings } from '../save/Settings.js';
import { audio } from '../audio/AudioManager.js';

export const EXPRESSIONS = {
  neutral: { emote: '' },
  happy: { emote: '♪', color: '#e773a3' },
  surprised: { emote: '!', color: '#f0a020' },
  embarrassed: { emote: '///', color: '#e05a7a' },
  sad: { emote: '💧', color: '#4a8ad0' },
  angry: { emote: '💢', color: '#d0304a' },
  curious: { emote: '?', color: '#7a5ad0' },
};

export class DialogueBox {
  constructor(ui) {
    this.ui = ui;
    this.el = h(`<div id="dialogue" class="hidden">
      <div class="dl-portrait"><div class="pimg"><img alt=""><div class="blush"></div></div><div class="emote"></div></div>
      <div class="dl-choices"></div>
      <div class="dl-box" role="dialog" aria-live="polite">
        <div class="dl-name"></div>
        <div class="dl-text"></div>
        <div class="dl-next"><button class="ghost dl-skip" aria-label="Mostrar texto completo">⏩</button><button class="dl-adv">Avançar <span class="dl-arrow">▼</span></button></div>
      </div></div>`);
    ui.root.appendChild(this.el);
    this.portrait = this.el.querySelector('.dl-portrait');
    this.img = this.portrait.querySelector('img');
    this.emote = this.portrait.querySelector('.emote');
    this.box = this.el.querySelector('.dl-box');
    this.nameEl = this.el.querySelector('.dl-name');
    this.textEl = this.el.querySelector('.dl-text');
    this.choicesEl = this.el.querySelector('.dl-choices');
    this.nextEl = this.el.querySelector('.dl-next');
    this.blush = this.portrait.querySelector('.blush');
    this.box.addEventListener('click', (e) => {
      if (e.target.closest('.dl-skip')) { this.completeText(); return; }
      this.onTap();
    });
    this._key = (e) => {
      if (this.el.classList.contains('hidden')) return;
      if (e.key === ' ' || e.key === 'Enter' || e.key.toLowerCase() === 'e') { e.preventDefault(); e.stopPropagation(); if (!e.repeat) this.onTap(); }
      const n = Number(e.key);
      if (n >= 1 && n <= this.choices.length && this.typingDone) { this.pick(n - 1); }
    };
    window.addEventListener('keydown', this._key, true);
    this.choices = [];
  }

  open(runner) {
    this.runner = runner;
    this.el.classList.remove('hidden');
    this.ui.hud.setControlsVisible(false);
    requestAnimationFrame(() => this.box.classList.add('show'));
    this.currentSpeaker = undefined;
  }

  show({ speaker, expr, text, choices }) {
    this.choices = choices;
    this.choicesEl.innerHTML = '';
    const isChar = speaker && speaker !== 'player';
    // nome
    this.nameEl.textContent = speaker === 'player' ? game.p.displayName : isChar ? Characters.name(speaker) : 'Narração';
    this.nameEl.classList.toggle('narr', !speaker);
    this.textEl.classList.toggle('narr', !speaker);
    // retrato
    this.box.classList.toggle('with-portrait', !!isChar);
    if (isChar) {
      const src = Characters.expressionImage(speaker, expr);
      if (this.img.dataset.src !== src) { this.img.dataset.src = src; this.img.src = src; }
      this.img.alt = Characters.name(speaker);
      this.img.classList.toggle('card', !Characters.hasCutout(speaker));
      this.portrait.classList.add('show');
      this.setExpression(speaker, expr);
    } else this.portrait.classList.remove('show');
    this.currentSpeaker = speaker;
    this.type(text);
  }

  setExpression(id, expr) {
    const e = EXPRESSIONS[expr] || EXPRESSIONS.neutral;
    const hasArt = Characters.hasExpressionArt(id, expr);
    this.portrait.className = `dl-portrait show ${hasArt ? '' : `e-${expr}`}`;
    void this.portrait.offsetWidth; // reinicia a animação
    // rubor só onde a posição das bochechas foi medida na ilustração (characters.json → "cheeks")
    const ch = Characters.get(id)?.cheeks;
    this.blush.style.background = ch && !hasArt
      ? ch.map(([x, y]) => `radial-gradient(ellipse 7% 1.6% at ${x}% ${y}%, rgba(255,110,140,.5), transparent)`).join(',')
      : 'none';
    this.emote.textContent = e.emote; this.emote.style.color = e.color || '';
    this.emote.classList.toggle('on', !!e.emote);
    this.portrait.dataset.expr = expr;
  }

  type(text) {
    clearInterval(this.timer);
    this.full = text; this.typingDone = false;
    this.nextEl.style.visibility = 'visible';
    this.nextEl.querySelector('.dl-adv').style.display = this.choices.length ? 'none' : '';
    const delay = settings.textDelay();
    if (!delay) { this.textEl.textContent = text; return this.afterTyping(); }
    let i = 0; this.textEl.textContent = '';
    this.timer = setInterval(() => {
      i += 1;
      this.textEl.textContent = text.slice(0, i);
      if (i % 3 === 0 && text[i - 1] !== ' ') audio.sfx('blip');
      if (i >= text.length) this.afterTyping();
    }, delay);
  }

  completeText() { if (!this.typingDone) { this.textEl.textContent = this.full; this.afterTyping(); } }

  afterTyping() {
    clearInterval(this.timer); this.typingDone = true;
    this.nextEl.querySelector('.dl-skip').style.display = 'none';
    if (this.choices.length) {
      this.nextEl.style.visibility = 'hidden';
      this.choicesEl.innerHTML = this.choices.map((c, i) => `<button data-i="${i}" style="animation-delay:${i * 70}ms"><b>${i + 1}</b>${esc(c)}</button>`).join('');
      this.choicesEl.querySelectorAll('button').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); this.pick(Number(b.dataset.i)); }));
    }
  }

  pick(i) {
    if (!this.runner) return;
    audio.sfx('confirm');
    this.choicesEl.innerHTML = '';
    this.runner.choose(i);
  }

  onTap() {
    if (!this.runner) return;
    if (!this.typingDone) return this.completeText();
    if (this.choices.length) return;
    audio.sfx('click');
    this.nextEl.querySelector('.dl-skip').style.display = '';
    this.runner.advance();
  }

  close() {
    clearInterval(this.timer);
    this.runner = null;
    this.box.classList.remove('show');
    this.portrait.classList.remove('show');
    this.choicesEl.innerHTML = '';
    this.ui.hud.setControlsVisible(true);
    setTimeout(() => { if (!this.runner) this.el.classList.add('hidden'); }, 300);
  }
}
