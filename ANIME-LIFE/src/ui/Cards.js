// Cartões de transição: abertura de capítulo, título de cena, indicação de horário,
// resumo de fim de capítulo e "continua".
import { h, esc, wait } from './dom.js';
import { game } from '../core/GameState.js';
import { Characters } from '../characters/CharacterRegistry.js';
import { STATS } from '../relationships/RelationshipManager.js';
import { audio } from '../audio/AudioManager.js';

export class Cards {
  constructor(ui) {
    this.ui = ui;
    this.cover = h('<div id="cover"><div class="cv-inner"></div></div>');
    this.time = h('<div id="timecard"></div>');
    this.bars = h('<div id="letterbox"><i></i><i></i></div>');
    ui.root.append(this.cover, this.time, this.bars);
  }

  async showCover(html, ms, { skippable = true } = {}) {
    this.cover.querySelector('.cv-inner').innerHTML = html;
    this.cover.classList.add('on');
    let skip;
    const skipP = new Promise((r) => { skip = r; });
    const onTap = () => skip();
    if (skippable) this.cover.addEventListener('pointerup', onTap, { once: true });
    await Promise.race([wait(this.ui.dialogue.skipping ? 250 : ms), skipP]);
    this.cover.removeEventListener('pointerup', onTap);
  }

  hideCover() { this.cover.classList.remove('on'); this.cover.dataset.tone = ''; }

  /** Faixas de cinema (narração cinematográfica). */
  letterbox(on) { this.bars.classList.toggle('on', !!on); }

  /** Transição discreta: tela escurece (ou clareia), mostra um texto curto e volta. */
  async fadeScene(tone = 'black', text = '') {
    this.cover.dataset.tone = tone;
    await this.showCover(text ? `<div class="cv-fade">${esc(text)}</div>` : '', text ? 2600 : 1500);
    this.hideCover();
    await wait(this.ui.dialogue.skipping ? 0 : 500);
  }

  async chapter(ch) {
    audio.sfx('sparkle');
    await this.showCover(`<div class="cv-ch">Capítulo ${ch.number}</div><div class="cv-title">${esc(ch.title)}</div><div class="cv-sub">${esc(ch.subtitle || '')}</div>`, 2600);
  }

  async scene(ch, sc, index) {
    const label = ch.isEvents ? '💗 Evento especial' : `Cena ${index + 1}`;
    await this.showCover(`<div class="cv-scene">${label}</div><div class="cv-stitle">${esc(sc.title)}</div>`, 1300);
    // o cartão some enquanto a cena começa (o cenário entra por baixo)
    setTimeout(() => this.hideCover(), 350);
  }

  async timeCard(text) {
    this.time.textContent = text;
    this.time.classList.add('on');
    clearTimeout(this._t);
    this._t = setTimeout(() => this.time.classList.remove('on'), this.ui.dialogue.skipping ? 600 : 2400);
    await wait(this.ui.dialogue.skipping ? 0 : 350);
  }

  /** Resumo do capítulo: escolhas feitas e como estão os relacionamentos. */
  chapterEnd(ch, next) {
    const st = game.state;
    const decs = st.decisions.filter((d) => d.chapter === ch.id && d.text);
    const met = Characters.all().filter((c) => st.rel[c.id]?.met);
    const el = h(`<div class="chapter-end"><div class="panel tall">
      <h2>✿ Fim do Capítulo ${ch.number} — ${esc(ch.title)}</h2>
      <div class="ce-cols">
        <div><h3>Suas escolhas</h3><ul>${decs.map((d) => `<li>${esc(d.text)}</li>`).join('')}</ul></div>
        <div><h3>Relacionamentos</h3>${met.map((c) => {
          const r = st.rel[c.id];
          return `<div class="ce-rel"><img src="${Characters.portrait(c.id)}" alt=""><b>${esc(c.displayName)}</b><span>${STATS.map((s) => (s.key === 'romance' && !Characters.canRomance(c.id)) ? '' : `${s.icon}${r[s.key] || 0}`).join(' ')}</span>${st.routes[c.id] === 'insinuada' ? '<em>♡</em>' : ''}</div>`;
        }).join('')}</div>
      </div>
      <div class="actions"><button class="pbtn">${next ? `Capítulo ${next.number}: ${esc(next.title)} ▶` : 'Continuar ▶'}</button></div>
    </div></div>`);
    this.ui.root.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    return new Promise((resolve) => el.querySelector('.pbtn').addEventListener('click', async () => {
      audio.sfx('confirm'); el.classList.remove('show'); await wait(400); el.remove(); resolve();
    }));
  }

  toBeContinued() {
    const el = h(`<div class="chapter-end"><div class="panel narrow center">
      <h2>✿ Continua...</h2>
      <p>Você chegou ao fim do conteúdo disponível nesta versão. Suas escolhas estão salvas e vão continuar valendo nos próximos capítulos.</p>
      <div class="actions"><button class="pbtn">Voltar ao menu</button></div></div></div>`);
    this.ui.root.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    return new Promise((resolve) => el.querySelector('.pbtn').addEventListener('click', async () => {
      el.classList.remove('show'); await wait(400); el.remove(); resolve();
    }));
  }
}
