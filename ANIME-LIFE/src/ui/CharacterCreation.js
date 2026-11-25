// Criação e identificação do protagonista: nome, nome de exibição, pronomes e aparência inicial.
import { h, esc, showEl, hideEl } from './dom.js';
import { SakuraPetals } from './SakuraPetals.js';
import { APPEARANCE, DEFAULT_APPEARANCE, randomAppearance } from '../characters/appearanceOptions.js';
import { drawFrame, FRAME_W, FRAME_H, DIRS } from '../characters/ProtagonistArt.js';
import { audio } from '../audio/AudioManager.js';

const PICKERS = [['body', 'Corpo'], ['hairStyle', 'Cabelo'], ['outfit', 'Roupa']];
const SWATCHES = [['hairColor', 'Cor do cabelo'], ['eyeColor', 'Olhos'], ['skin', 'Pele'], ['outfitColor', 'Cor da roupa']];

export class CharacterCreation {
  constructor(ui) {
    this.ui = ui;
    this.ap = { ...DEFAULT_APPEARANCE };
    this.dir = 0; this.frame = 0;
    this.el = h(`<div id="create" class="screen sky hidden"><div class="city"></div>
      <div class="stage"><canvas width="${FRAME_W * 4}" height="${FRAME_H * 4}"></canvas><div class="pedestal"></div>
        <div class="rot"><button data-r="-1" aria-label="Girar">⟲</button><button data-r="1" aria-label="Girar">⟳</button></div></div>
      <div class="form"><h1>Quem é você?</h1><div class="panel">
        <div class="field"><label for="f-name">Nome</label><input id="f-name" type="text" maxlength="24" placeholder="Seu nome completo" autocomplete="off"></div>
        <div class="field"><label for="f-disp">Nome de exibição</label><input id="f-disp" type="text" maxlength="12" placeholder="Como te chamam" autocomplete="off"></div>
        <div class="field"><span>Pronomes</span><div class="seg" id="f-pron"><button data-v="ele">ele</button><button data-v="ela">ela</button><button data-v="elu">elu</button></div></div>
        ${PICKERS.map(([k, l]) => `<div class="field"><span>${l}</span><div class="picker" data-k="${k}"><button data-d="-1">‹</button><span></span><button data-d="1">›</button></div></div>`).join('')}
        ${SWATCHES.map(([k, l]) => `<div class="field"><span>${l}</span><div class="swatches" data-k="${k}">${APPEARANCE[k].map((o) => `<button data-v="${o.id}" title="${esc(o.label)}" aria-label="${esc(o.label)}" style="background:${o.c}"></button>`).join('')}</div></div>`).join('')}
        <div class="err"></div>
      </div>
      <div class="create-actions"><button class="pbtn alt" data-a="back">Voltar</button><button class="pbtn alt" data-a="rand">🎲 Aleatório</button><button class="pbtn" data-a="ok">Começar ▶</button></div>
      </div></div>`);
    ui.root.appendChild(this.el);
    this.petals = new SakuraPetals(this.el, 14);
    this.canvas = this.el.querySelector('canvas');
    this.pron = 'ele';
    this.bind();
  }

  bind() {
    const q = (s) => this.el.querySelector(s);
    q('#f-pron').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; this.pron = b.dataset.v; audio.sfx('click'); this.refresh(); });
    this.el.querySelectorAll('.picker').forEach((p) => p.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      const k = p.dataset.k, list = APPEARANCE[k];
      const i = list.findIndex((o) => o.id === this.ap[k]);
      this.ap[k] = list[(i + Number(b.dataset.d) + list.length) % list.length].id;
      audio.sfx('click'); this.refresh();
    }));
    this.el.querySelectorAll('.swatches').forEach((s) => s.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      this.ap[s.dataset.k] = b.dataset.v; audio.sfx('click'); this.refresh();
    }));
    this.el.querySelector('.rot').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      this.dir = (this.dir + Number(b.dataset.r) + 4) % 4; this.lastSpin = performance.now();
    });
    // nome de exibição acompanha o primeiro nome enquanto o jogador não o editar
    const name = q('#f-name'), disp = q('#f-disp');
    name.addEventListener('input', () => { if (!disp.dataset.touched) disp.value = name.value.trim().split(/\s+/)[0] || ''; });
    disp.addEventListener('input', () => { disp.dataset.touched = '1'; });
    this.el.querySelector('.create-actions').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.a === 'back') { audio.sfx('back'); this.resolve?.(null); }
      if (b.dataset.a === 'rand') { this.ap = randomAppearance(); audio.sfx('sparkle'); this.refresh(); }
      if (b.dataset.a === 'ok') this.submit();
    });
    // Enter fecha o teclado virtual
    [name, disp].forEach((i) => i.addEventListener('keydown', (e) => { if (e.key === 'Enter') i.blur(); }));
  }

  submit() {
    const name = this.el.querySelector('#f-name').value.trim().replace(/\s+/g, ' ');
    const disp = (this.el.querySelector('#f-disp').value.trim() || name.split(' ')[0]).slice(0, 12);
    const err = this.el.querySelector('.err');
    if (name.length < 2) { err.textContent = 'Digite um nome com pelo menos 2 letras.'; audio.sfx('bump'); return; }
    if (!/^[\p{L}\p{M}' .-]+$/u.test(name) || !/^[\p{L}\p{M}' .-]+$/u.test(disp)) { err.textContent = 'Use apenas letras, espaços, apóstrofo ou hífen.'; audio.sfx('bump'); return; }
    audio.sfx('confirm');
    this.resolve?.({ name, displayName: disp, pronouns: this.pron, appearance: { ...this.ap } });
  }

  refresh() {
    this.el.querySelectorAll('.picker').forEach((p) => {
      const k = p.dataset.k; p.querySelector('span').textContent = APPEARANCE[k].find((o) => o.id === this.ap[k]).label;
    });
    this.el.querySelectorAll('.swatches').forEach((s) => s.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === this.ap[s.dataset.k])));
    this.el.querySelectorAll('#f-pron button').forEach((b) => b.classList.toggle('on', b.dataset.v === this.pron));
  }

  loop = (t) => {
    if (!this.running) return;
    // gira sozinho a cada 2,4s (se o jogador não girou recentemente) e anima a caminhada
    if (!this.lastSpin || t - this.lastSpin > 6000) { if (!this._lt || t - this._lt > 2400) { this._lt = t; this.dir = (this.dir + 1) % 4; } }
    const ctx = this.canvas.getContext('2d');
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.save(); ctx.scale(4, 4);
    drawFrame(ctx, this.ap, DIRS[[0, 1, 3, 2][this.dir]], 2 + (Math.floor(t / 140) % 4));
    ctx.restore();
    requestAnimationFrame(this.loop);
  };

  async open() {
    this.refresh();
    this.el.querySelector('.err').textContent = '';
    await showEl(this.el); this.petals.start();
    this.running = true; requestAnimationFrame(this.loop);
    return new Promise((r) => { this.resolve = r; });
  }

  async close() { this.running = false; this.petals.stop(); await hideEl(this.el, 450); }
}
