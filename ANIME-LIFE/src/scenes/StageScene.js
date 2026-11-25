// Palco da visual novel (Phaser 3): cenário em tela cheia, personagens em destaque,
// entrada/saída, foco em quem fala, expressões e transições.
// Os personagens são SEMPRE a ilustração original (full.webp, recorte da referência).
import Phaser from 'phaser';
import { paintBackground, BG_W, BG_H, FILES } from './backgrounds.js';
import { Characters } from '../characters/CharacterRegistry.js';
import { asset } from '../core/assets.js';

const SLOTS = { farleft: 0.14, left: 0.27, center: 0.5, right: 0.73, farright: 0.86 };
const EMOTES = { happy: '♪', surprised: '!', curious: '?', angry: '💢', sad: '💧', embarrassed: '///', serious: '…' };

export class StageScene extends Phaser.Scene {
  constructor() { super('Stage'); }

  create() {
    this.bgA = this.add.image(0, 0, '__DEFAULT').setOrigin(0.5).setVisible(false).setDepth(0);
    this.bgB = this.add.image(0, 0, '__DEFAULT').setOrigin(0.5).setVisible(false).setDepth(1);
    this.chars = new Map(); // id -> { img, at, blush, emote }
    this.vignette = this.add.graphics().setDepth(50);
    this.scale.on('resize', () => this.layout());
    this.layout();
    this.events.emit('stage-ready');
    this.game.events.emit('stage-ready', this);
  }

  get W() { return this.scale.width; }
  get H() { return this.scale.height; }

  layout() {
    for (const bg of [this.bgA, this.bgB]) this.cover(bg);
    for (const [, c] of this.chars) this.place(c, false);
    this.vignette.clear();
    // escurece levemente a base da tela (legibilidade da caixa de diálogo)
    const g = this.vignette, steps = 12;
    for (let i = 0; i < steps; i++) g.fillStyle(0x140c24, 0.035).fillRect(0, this.H * (0.55 + i * 0.0375), this.W, this.H);
  }

  cover(img) {
    if (!img.texture || img.texture.key === '__DEFAULT') return;
    const s = Math.max(this.W / img.width, this.H / img.height);
    img.setScale(s).setPosition(this.W / 2, this.H / 2);
  }

  ensureBackground(key) {
    if (this.textures.exists(`bg_${key}`)) return Promise.resolve();
    if (FILES[key]) return this.loadImage(`bg_${key}`, asset(FILES[key]));
    this.textures.addCanvas(`bg_${key}`, paintBackground(key));
    return Promise.resolve();
  }

  loadImage(key, url) {
    return new Promise((resolve, reject) => {
      if (this.textures.exists(key)) return resolve();
      this.load.image(key, url);
      this.load.once(`filecomplete-image-${key}`, () => resolve());
      this.load.once('loaderror', (f) => { if (f.key === key) reject(new Error(`Falha ao carregar ${url}`)); });
      this.load.start();
    });
  }

  async setBackground(key, fx = 'fade') {
    await this.ensureBackground(key);
    if (this.bgKey === key) return;
    this.bgKey = key;
    const [front, back] = this.bgA.visible && this.bgA.depth > this.bgB.depth ? [this.bgA, this.bgB] : [this.bgB, this.bgA];
    back.setTexture(`bg_${key}`).setVisible(true).setAlpha(fx === 'cut' ? 1 : 0).setDepth(front.depth + 1);
    this.cover(back);
    if (fx === 'cut' || this.instant) { front.setVisible(false); back.setAlpha(1); return; }
    await new Promise((r) => this.tweens.add({ targets: back, alpha: 1, duration: 700, ease: 'Sine.easeInOut', onComplete: r }));
    front.setVisible(false);
  }

  charHeight() { return this.H * (this.W / this.H < 1.5 ? 1.45 : 1.58); }

  place(c, animate = true, dur = 400) {
    const h = this.charHeight();
    const s = h / c.img.height;
    const x = this.W * SLOTS[c.at];
    const y = this.H * 0.035;
    c.baseScale = s; c.baseY = y;
    if (animate) this.tweens.add({ targets: c.img, x, y, scale: s, duration: dur, ease: 'Sine.easeOut' });
    else c.img.setPosition(x, y).setScale(s);
  }

  async show(id, at = 'center', expr = 'neutral') {
    const key = `char_${id}`;
    await this.loadImage(key, Characters.expressionImage(id, expr));
    const existing = this.chars.get(id);
    if (existing) { existing.at = at; this.place(existing, !this.instant); this.express(id, expr); return; }
    const img = this.add.image(this.W * SLOTS[at], 0, key).setOrigin(0.5, 0).setDepth(10);
    const c = { id, img, at };
    this.chars.set(id, c);
    this.place(c, false);
    if (this.instant) return;
    const fromX = img.x + (at === 'right' ? 50 : at === 'left' ? -50 : 0);
    img.setAlpha(0).setX(fromX).setY(c.baseY + 14);
    await new Promise((r) => this.tweens.add({ targets: img, alpha: 1, x: this.W * SLOTS[at], y: c.baseY, duration: 420, ease: 'Cubic.easeOut', onComplete: r }));
  }

  async hide(id) {
    const c = this.chars.get(id);
    if (!c) return;
    this.chars.delete(id);
    c.emote?.destroy(); c.blush?.destroy();
    if (this.instant) { c.img.destroy(); return; }
    await new Promise((r) => this.tweens.add({ targets: c.img, alpha: 0, y: c.baseY + 16, duration: 300, onComplete: () => { c.img.destroy(); r(); } }));
  }

  async hideAll() { await Promise.all([...this.chars.keys()].map((id) => this.hide(id))); }

  /** Destaca quem fala; os outros ficam levemente escurecidos. null = narração (ninguém em foco). */
  focus(id) {
    for (const [cid, c] of this.chars) {
      const on = !id || id === 'player' || id === 'thought' ? true : cid === id;
      c.img.setTint(on ? 0xffffff : 0x8a86a0);
      c.img.setDepth(cid === id ? 12 : 10);
    }
  }

  /** Expressão: troca a arte se existir; senão anima a ilustração original + balão + rubor. */
  express(id, expr) {
    const c = this.chars.get(id);
    if (!c || !expr) return;
    if (Characters.hasExpressionArt(id, expr)) {
      this.loadImage(`char_${id}_${expr}`, Characters.expressionImage(id, expr)).then(() => c.img.setTexture(`char_${id}_${expr}`));
      return;
    }
    if (this.instant) return;
    const img = c.img, y0 = c.baseY;
    this.tweens.killTweensOf(img);
    img.setY(y0).setAngle(0).setX(this.W * SLOTS[c.at]);
    if (expr === 'happy') this.tweens.add({ targets: img, y: y0 - 14, duration: 140, yoyo: true, repeat: 1, ease: 'Sine.easeOut' });
    if (expr === 'surprised') this.tweens.add({ targets: img, y: y0 - 22, duration: 120, yoyo: true, ease: 'Quad.easeOut' });
    if (expr === 'angry') this.tweens.add({ targets: img, x: img.x + 8, duration: 50, yoyo: true, repeat: 3 });
    if (expr === 'sad') this.tweens.add({ targets: img, y: y0 + 10, duration: 500, ease: 'Sine.easeOut' });
    if (expr === 'curious') this.tweens.add({ targets: img, angle: -1.5, duration: 300, ease: 'Sine.easeOut' });
    // balão
    c.emote?.destroy();
    if (EMOTES[expr]) {
      const t = this.add.text(img.x + img.displayWidth * 0.18, y0 + this.charHeight() * 0.04, EMOTES[expr], {
        fontFamily: '"M PLUS Rounded 1c", sans-serif', fontSize: `${Math.round(this.H * 0.08)}px`, fontStyle: 'bold',
        color: { happy: '#ff6fa8', surprised: '#ffb020', curious: '#9a7aff', angry: '#ff4060', sad: '#5aa0ff', embarrassed: '#ff5a7a', serious: '#ffffff' }[expr],
        stroke: '#ffffff', strokeThickness: 6,
      }).setOrigin(0.5).setDepth(20).setScale(0.3).setAlpha(0);
      c.emote = t;
      this.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 220, ease: 'Back.easeOut' });
      this.tweens.add({ targets: t, alpha: 0, delay: 1600, duration: 400, onComplete: () => t.destroy() });
    }
    // rubor (só onde as bochechas foram medidas na ilustração)
    c.blush?.destroy(); c.blush = null;
    const cheeks = Characters.get(id)?.cheeks;
    if (expr === 'embarrassed' && cheeks) {
      const g = this.add.graphics().setDepth(img.depth + 0.5);
      const s = c.baseScale;
      for (const [px, py] of cheeks) {
        const x = img.x - img.displayWidth / 2 + (px / 100) * img.displayWidth, y = y0 + (py / 100) * img.displayHeight;
        for (let k = 3; k > 0; k--) g.fillStyle(0xff6e8c, 0.12).fillEllipse(x, y, 22 * s * k, 9 * s * k);
      }
      c.blush = g; g.setAlpha(0);
      this.tweens.add({ targets: g, alpha: 1, duration: 300 });
      this.tweens.add({ targets: g, alpha: 0, delay: 2600, duration: 600, onComplete: () => { g.destroy(); if (c.blush === g) c.blush = null; } });
    }
  }

  effect(name) {
    if (name === 'shake') this.cameras.main.shake(350, 0.008);
    if (name === 'flash') this.cameras.main.flash(300, 255, 255, 255);
  }

  /** Recria o palco salvo (cenário + personagens) sem animações. */
  async restore(st) {
    this.instant = true;
    try {
      await this.hideAll();
      if (st?.bg) { this.bgKey = null; await this.setBackground(st.bg, 'cut'); }
      for (const c of st?.chars || []) await this.show(c.id, c.at, c.e);
    } finally { this.instant = false; }
  }

  clearAll() { this.instant = true; this.hideAll(); this.instant = false; this.bgA.setVisible(false); this.bgB.setVisible(false); this.bgKey = null; }
}
