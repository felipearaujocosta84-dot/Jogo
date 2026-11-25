// Tela de novo jogo: identificação do protagonista (nome, nome de exibição, pronomes).
// Na visual novel o protagonista é a "câmera": não aparece em cena, mas é chamado pelo nome
// e os textos concordam com os pronomes escolhidos.
import { h, showEl, hideEl } from './dom.js';
import { SakuraPetals } from './SakuraPetals.js';
import { audio } from '../audio/AudioManager.js';

export class NewGame {
  constructor(ui) {
    this.ui = ui;
    this.pron = 'ele';
    this.el = h(`<div id="newgame" class="screen sky hidden"><div class="city"></div>
      <div class="ng-card panel">
        <h2>✿ Nova história</h2>
        <p class="ng-intro">Você tem 23 anos, acabou de se mudar para o bairro de Hoshizora e começa amanhã num café-livraria. O apartamento 201 está cheio de caixas — e de perguntas.</p>
        <div class="field"><label for="f-name">Nome</label><input id="f-name" type="text" maxlength="24" placeholder="Seu nome completo" autocomplete="off"></div>
        <div class="field"><label for="f-disp">Como te chamam</label><input id="f-disp" type="text" maxlength="12" placeholder="Nome de exibição" autocomplete="off"></div>
        <div class="field"><span>Pronomes</span><div class="seg" id="f-pron"><button data-v="ele">ele / o</button><button data-v="ela">ela / a</button><button data-v="elu">elu / e</button></div></div>
        <div class="err"></div>
        <div class="actions"><button class="pbtn alt" data-a="back">Voltar</button><button class="pbtn" data-a="ok">Começar a história ▶</button></div>
      </div></div>`);
    ui.root.appendChild(this.el);
    this.petals = new SakuraPetals(this.el, 14);
    const q = (s) => this.el.querySelector(s);
    q('#f-pron').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; this.pron = b.dataset.v; audio.sfx('click'); this.refresh(); });
    const name = q('#f-name'), disp = q('#f-disp');
    name.addEventListener('input', () => { if (!disp.dataset.touched) disp.value = name.value.trim().split(/\s+/)[0] || ''; });
    disp.addEventListener('input', () => { disp.dataset.touched = '1'; });
    [name, disp].forEach((i) => i.addEventListener('keydown', (e) => { if (e.key === 'Enter') i.blur(); }));
    q('.actions').addEventListener('click', (e) => {
      const a = e.target.closest('button')?.dataset.a; if (!a) return;
      if (a === 'back') { audio.sfx('back'); this.resolve?.(null); }
      if (a === 'ok') this.submit();
    });
  }

  refresh() { this.el.querySelectorAll('#f-pron button').forEach((b) => b.classList.toggle('on', b.dataset.v === this.pron)); }

  submit() {
    const name = this.el.querySelector('#f-name').value.trim().replace(/\s+/g, ' ');
    const disp = (this.el.querySelector('#f-disp').value.trim() || name.split(' ')[0]).slice(0, 12);
    const err = this.el.querySelector('.err');
    if (name.length < 2) { err.textContent = 'Digite um nome com pelo menos 2 letras.'; audio.sfx('back'); return; }
    if (!/^[\p{L}\p{M}' .-]+$/u.test(name) || !/^[\p{L}\p{M}' .-]+$/u.test(disp)) { err.textContent = 'Use apenas letras, espaços, apóstrofo ou hífen.'; audio.sfx('back'); return; }
    audio.sfx('confirm');
    this.resolve?.({ name, displayName: disp, pronouns: this.pron });
  }

  async open() {
    this.refresh(); this.el.querySelector('.err').textContent = '';
    await showEl(this.el); this.petals.start();
    return new Promise((r) => { this.resolve = r; });
  }

  async close() { this.petals.stop(); await hideEl(this.el, 450); }
}
