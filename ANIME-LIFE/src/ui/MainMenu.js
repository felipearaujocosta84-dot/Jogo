// Tela inicial ("Toque para começar") e menu principal.
import { h, showEl, hideEl } from './dom.js';
import { SakuraPetals } from './SakuraPetals.js';
import { Characters } from '../characters/CharacterRegistry.js';
import { audio } from '../audio/AudioManager.js';
import { CHAPTERS } from '../story/chapters/index.js';

const VERSION = 'v0.2.0 — visual novel';
const LINEUP = [
  { id: 'character_07', left: '0%', h: '86%' },
  { id: 'character_01', left: '30%', h: '94%' },
  { id: 'character_06', left: '56%', h: '90%' },
];

export class MainMenu {
  constructor(ui) {
    this.ui = ui;
    this.splash = h(`<div id="splash" class="screen sky hidden"><div class="city"></div>
      <div class="logo center"><div class="t1">ANIME LIFE</div><div class="t2">MINHA VIDA</div></div>
      <div class="tap">TOQUE PARA COMEÇAR</div></div>`);
    this.el = h(`<div id="menu" class="screen sky hidden"><div class="city"></div>
      <div class="lineup"></div>
      <div class="left">
        <div class="logo"><div class="t1">ANIME LIFE</div><div class="t2">MINHA VIDA</div></div>
        <div class="menu-list">
          <button class="mbtn" data-a="continue">Continuar<small></small></button>
          <button class="mbtn" data-a="new">Novo jogo</button>
          <button class="mbtn" data-a="load">Carregar</button>
          <div class="mrow"><button class="mbtn sm" data-a="gallery">Galeria</button><button class="mbtn sm" data-a="settings">Ajustes</button><button class="mbtn sm" data-a="credits">Créditos</button></div>
        </div>
      </div><div class="ver">${VERSION}</div></div>`);
    ui.root.append(this.splash, this.el);
    this.petalsA = new SakuraPetals(this.splash, 18);
    this.petals = new SakuraPetals(this.el);
    this.el.querySelector('.menu-list').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      audio.sfx('confirm');
      ui.menuAction(b.dataset.a);
    });
  }

  showSplash() {
    showEl(this.splash); this.petalsA.start();
    return new Promise((resolve) => {
      this.splash.addEventListener('pointerup', async () => {
        audio.unlock(); audio.sfx('sparkle');
        // tela cheia + paisagem (alguns navegadores nunca respondem: limite de 600 ms)
        const tryIt = (fn) => Promise.race([Promise.resolve().then(fn).catch(() => {}), new Promise((r) => setTimeout(r, 600))]);
        await tryIt(() => document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }));
        await tryIt(() => screen.orientation?.lock?.('landscape'));
        this.petalsA.stop();
        await hideEl(this.splash, 450);
        resolve();
      }, { once: true });
    });
  }

  async show(auto) {
    const cont = this.el.querySelector('[data-a=continue]');
    cont.classList.toggle('hidden', !auto);
    if (auto) {
      const ch = CHAPTERS.find((c) => c.id === auto.pos.chapter);
      const sc = ch?.scenes.find((s) => s.id === auto.pos.scene);
      cont.querySelector('small').textContent = `${auto.protagonist.displayName} · Cap. ${ch?.number ?? '?'} — ${sc?.title ?? ''}`;
    }
    this.loadLineup();
    audio.playMusic('menu');
    await showEl(this.el); this.petals.start();
  }

  loadLineup() {
    const box = this.el.querySelector('.lineup');
    if (box.childElementCount) return;
    LINEUP.forEach((c, i) => {
      const img = new Image();
      img.alt = Characters.name(c.id); img.decoding = 'async';
      img.style.left = c.left; img.style.height = c.h; img.style.zIndex = i === 1 ? 2 : 1;
      img.onload = () => setTimeout(() => img.classList.add('in'), 150 + i * 220);
      img.src = Characters.fullImage(c.id);
      box.appendChild(img);
    });
  }

  async hide() { this.petals.stop(); await hideEl(this.el, 450); }
}
