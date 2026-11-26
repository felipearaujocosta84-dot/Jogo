// Palco da visual novel (Phaser 3): cenário em tela cheia, personagens em destaque,
// entrada/saída, foco em quem fala, expressões e transições.
// Os personagens são SEMPRE a ilustração original (full.webp, recorte da referência), animada
// pelo LivingSprite (piscar, boca, cabeça, respiração, cabelo, expressões) quando há WebGL.
import Phaser from 'phaser';
import { paintBackground, BG_W, BG_H, FILES } from './backgrounds.js';
import { Characters } from '../characters/CharacterRegistry.js';
import { asset, characterAsset } from '../core/assets.js';
import { EMOTIONS } from '../cinematic/Emotions.js';
import { LivingSprite, canAnimate } from '../animation/LivingSprite.js';
import { CharacterAnimator } from '../animation/CharacterAnimator.js';
import { settings } from '../save/Settings.js';
import { AmbientFX } from './AmbientFX.js';

const SLOTS = { farleft: 0.14, left: 0.27, center: 0.5, right: 0.73, farright: 0.86 };
const EMOTE_COLORS = { happy: '#ff6fa8', surprised: '#ffb020', curious: '#9a7aff', angry: '#ff4060', sad: '#5aa0ff', hurt: '#5aa0ff', embarrassed: '#ff5a7a', serious: '#ffffff', love: '#ff5a9a' };
// planos de câmera (2D): zoom e altura do rosto na tela (fração da altura)
const FRAMING = { wide: { z: 1, f: null }, medium: { z: 1.32, f: 0.3 }, close: { z: 1.95, f: 0.34 }, extreme: { z: 2.8, f: 0.37 }, ots: { z: 1.6, f: 0.33 }, side: { z: 1.5, f: 0.32 }, two: { z: 1.2, f: 0.3 }, choice: { z: 1.3, f: 0.3 } };

export class StageScene extends Phaser.Scene {
  constructor() { super('Stage'); }

  create() {
    this.bgA = this.add.image(0, 0, '__DEFAULT').setOrigin(0.5).setVisible(false).setDepth(0);
    this.bgB = this.add.image(0, 0, '__DEFAULT').setOrigin(0.5).setVisible(false).setDepth(1);
    this.chars = new Map(); // id -> { img, at, blush, emote }
    this.vignette = this.add.graphics().setDepth(50).setScrollFactor(0);
    this.camProxy = { x: 0, y: 0, z: 1 };
    this.ambient = new AmbientFX(this);
    // camada de luz da cena (escurecer, brilho romântico, fades)
    this.veil = this.add.rectangle(0, 0, 10, 10, 0x0a0620, 0).setOrigin(0).setDepth(48).setScrollFactor(0);
    this.glow = this.add.rectangle(0, 0, 10, 10, 0xff8ab0, 0).setOrigin(0).setDepth(47).setScrollFactor(0).setBlendMode('ADD');
    this.scale.on('resize', () => { this.layout(); this.ambient.relayout(); if (this.currentShot) this.shot(this.currentShot, { instant: true }); });
    this.layout();
    this.events.emit('stage-ready');
    this.game.events.emit('stage-ready', this);
  }

  get W() { return this.scale.width; }
  get H() { return this.scale.height; }

  layout() {
    this.cameras.main.setBounds(0, 0, this.W, this.H);
    if (!this.currentShot) { this.camProxy = { x: this.W / 2, y: this.H / 2, z: 1 }; this.applyCam(); }
    for (const bg of [this.bgA, this.bgB]) this.cover(bg);
    for (const [, c] of this.chars) this.place(c, false);
    // véus cobrem a tela inteira mesmo com zoom (compensam a escala da câmera)
    for (const v of [this.veil, this.glow].filter(Boolean)) v.setSize(this.W * 3, this.H * 3).setPosition(-this.W, -this.H);
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
    this.ambient.set(key, { level: settings.data.animations });
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

  /** Camadas opcionais desenhadas a partir da referência (characters.json → layers). */
  async loadLayers(id) {
    const L = Characters.get(id)?.layers || {};
    const out = {};
    for (const [k, file] of Object.entries(L)) {
      try { await this.loadImage(`layer_${id}_${k}`, characterAsset(id, file)); out[k] = `layer_${id}_${k}`; } catch (e) { console.warn('[Stage] camada não carregou', file); }
    }
    return out;
  }

  makeSprite(id, key, at) {
    const data = Characters.get(id);
    if (canAnimate(this, data) && settings.data.animations !== 'off') {
      const img = new LivingSprite(this, this.W * SLOTS[at], 0, key, this.layerKeys?.[id] || {});
      img.setOrigin(0.5, 0).setDepth(10);
      const anim = new CharacterAnimator(img, data, { side: SLOTS[at] < 0.5 ? 1 : -1 });
      anim.level = settings.data.animations || 'completa';
      return { img, anim };
    }
    return { img: this.add.image(this.W * SLOTS[at], 0, key).setOrigin(0.5, 0).setDepth(10), anim: null };
  }

  async show(id, at = 'center', expr = 'neutral') {
    const key = `char_${id}`;
    await this.loadImage(key, Characters.expressionImage(id, expr));
    (this.layerKeys ||= {})[id] ||= await this.loadLayers(id);
    const existing = this.chars.get(id);
    if (existing) {
      existing.at = at; this.place(existing, !this.instant); this.express(id, expr);
      if (existing.img.alpha < 1) this.fadeAlpha(existing.img, 1, 600); // volta de um corte
      if (existing.anim) existing.anim.side = SLOTS[at] < 0.5 ? 1 : -1;
      return;
    }
    const { img, anim } = this.makeSprite(id, key, at);
    const c = { id, img, at, anim };
    anim?.setEmotion(expr);
    this.chars.set(id, c);
    this.place(c, false);
    if (this.instant) return;
    // entrada: desliza do lado, sobe um pouco e aparece; leve "respiro" de escala no fim
    const fromX = img.x + (at === 'right' ? 50 : at === 'left' ? -50 : 0);
    img.setAlpha(0).setX(fromX).setY(c.baseY + 14);
    img.setScale(c.baseScale * 0.97);
    await new Promise((r) => this.tweens.add({ targets: img, alpha: 1, x: this.W * SLOTS[at], y: c.baseY, scale: c.baseScale, duration: 520, ease: 'Cubic.easeOut', onComplete: r }));
  }

  async hide(id) {
    const c = this.chars.get(id);
    if (!c) return;
    this.chars.delete(id);
    c.emote?.destroy();
    if (this.instant) { c.img.destroy(); return; }
    // saída: vira levemente para o lado da tela, desce e some
    const dir = SLOTS[c.at] < 0.5 ? -1 : 1;
    await new Promise((r) => this.tweens.add({ targets: c.img, alpha: 0, y: c.baseY + 18, x: c.img.x + dir * 40, duration: 380, ease: 'Sine.easeIn', onComplete: () => { c.img.destroy(); r(); } }));
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
    c.anim?.setEmotion(expr);
    if (Characters.hasExpressionArt(id, expr)) {
      const k = `char_${id}_${expr}`;
      this.loadImage(k, Characters.expressionImage(id, expr)).then(() => {
        if (c.anim) c.img.setSampler2D('iChannel0', k, 0, { wrapS: 'clamp_to_edge', wrapT: 'clamp_to_edge' }); else c.img.setTexture(k);
      });
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
    const emote = EMOTIONS[expr]?.emote;
    if (expr === 'love') this.tweens.add({ targets: img, angle: 1.2, duration: 900, yoyo: true, ease: 'Sine.easeInOut' });
    if (expr === 'shy') this.tweens.add({ targets: img, y: y0 + 6, duration: 400, ease: 'Sine.easeOut' });
    if (expr === 'lookaway') this.tweens.add({ targets: img, angle: c.at === 'right' ? 2 : -2, x: img.x + (c.at === 'right' ? 10 : -10), duration: 500, ease: 'Sine.easeOut' });
    if (expr === 'hurt') this.tweens.add({ targets: img, y: y0 + 8, duration: 600, ease: 'Sine.easeOut' });
    if (emote) {
      const t = this.add.text(img.x + img.displayWidth * 0.18, y0 + this.charHeight() * 0.04, emote, {
        fontFamily: '"M PLUS Rounded 1c", sans-serif', fontSize: `${Math.round(this.H * 0.08)}px`, fontStyle: 'bold',
        color: EMOTE_COLORS[expr] || '#ffffff',
        stroke: '#ffffff', strokeThickness: 6,
      }).setOrigin(0.5).setDepth(20).setScale(0.3).setAlpha(0);
      c.emote = t;
      this.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 220, ease: 'Back.easeOut' });
      this.tweens.add({ targets: t, alpha: 0, delay: 1600, duration: 400, onComplete: () => t.destroy() });
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

  clearAll() {
    this.instant = true; this.hideAll(); this.instant = false;
    this.bgA.setVisible(false); this.bgB.setVisible(false); this.bgKey = null;
    this.currentShot = null; this.clearShoulder(); this.camProxy = { x: this.W / 2, y: this.H / 2, z: 1 }; this.applyCam();
    this.ambient.clear(); this.veil.setAlpha(0); this.glow.setAlpha(0);
  }

  // ------------------------------------------------------------------
  // Câmera cinematográfica (2D): enquadra o rosto da ilustração original.
  // ------------------------------------------------------------------
  /** Centro do rosto (coordenadas do mundo), a partir de characters.json → face. */
  facePoint(id) {
    const c = this.chars.get(id);
    if (!c) return null;
    const [fx, fy] = Characters.get(id)?.face || [50, 12];
    const dispW = c.img.width * c.baseScale, dispH = c.img.height * c.baseScale;
    return { x: this.W * SLOTS[c.at] - dispW / 2 + (fx / 100) * dispW, y: c.baseY + (fy / 100) * dispH };
  }

  applyCam() {
    const cam = this.cameras.main, p = this.camProxy;
    cam.setZoom(p.z);
    cam.centerOn(p.x, p.y);
  }

  /** Calcula o enquadramento { x, y, z } de um plano. */
  framing(shot) {
    const W = this.W, H = this.H;
    const F = FRAMING[shot.type] || FRAMING.medium;
    const face = shot.subject && this.facePoint(shot.subject);
    if (!face || shot.type === 'wide') return { x: W / 2, y: H / 2, z: 1 };
    if (shot.type === 'two' && shot.partner && this.facePoint(shot.partner)) {
      const o = this.facePoint(shot.partner);
      const dx = Math.abs(face.x - o.x);
      const z = Math.max(1, Math.min(1.45, (W * 0.62) / Math.max(1, dx)));
      return { x: (face.x + o.x) / 2, y: (face.y + o.y) / 2 + (0.5 - F.f) * H / z, z };
    }
    let z = F.z;
    let sx = 0.5; // posição horizontal do rosto na tela
    if (shot.type === 'ots') sx = this.slotOf(shot.subject) <= this.slotOf(shot.partner) ? 0.4 : 0.6;
    if (shot.type === 'side') sx = this.slotOf(shot.subject) < 0.5 ? 0.42 : 0.58;
    if (shot.type === 'choice') sx = 0.25; // personagem no terço esquerdo; opções à direita
    return { x: face.x + (0.5 - sx) * W / z, y: face.y + (0.5 - F.f) * H / z, z };
  }

  slotOf(id) { const c = this.chars.get(id); return c ? SLOTS[c.at] : 0.5; }

  /** Aplica um plano do Diretor: corte seco ou movimento suave, com aproximação lenta. */
  shot(shot, { instant = false } = {}) {
    if (!shot) return;
    this.currentShot = shot;
    const target = this.framing(shot);
    this.tweens.killTweensOf(this.camProxy);
    this.clearShoulder();
    const quick = instant || this.instant || this.skipping;
    if (quick || shot.cut) Object.assign(this.camProxy, target);
    const settle = () => {
      if (shot.type === 'ots') this.showShoulder(shot);
      if (quick) return;
      // movimento contínuo durante a fala: aproximação/afastamento lento ou travelling lateral
      if (shot.push === 'in') this.tweens.add({ targets: this.camProxy, z: target.z * 1.07, duration: 6000, ease: 'Sine.easeOut', onUpdate: () => this.applyCam() });
      if (shot.push === 'out') this.tweens.add({ targets: this.camProxy, z: Math.max(1, target.z / 1.05), duration: 6000, ease: 'Sine.easeOut', onUpdate: () => this.applyCam() });
      if (shot.type === 'side') this.tweens.add({ targets: this.camProxy, x: target.x + this.W * 0.05 / target.z, duration: 7000, ease: 'Sine.easeInOut', onUpdate: () => this.applyCam() });
    };
    if (quick || shot.cut) { this.applyCam(); settle(); return; }
    this.tweens.add({ targets: this.camProxy, x: target.x, y: target.y, z: target.z, duration: 650, ease: 'Sine.easeInOut', onUpdate: () => this.applyCam(), onComplete: settle });
  }

  /** "Por cima do ombro": o outro personagem aparece desfocado e escuro em primeiro plano. */
  showShoulder(shot) {
    const p = this.chars.get(shot.partner);
    if (!p) return;
    const z = this.camProxy.z;
    const left = this.slotOf(shot.partner) <= this.slotOf(shot.subject);
    const cam = this.cameras.main;
    const sx = cam.worldView.x + (left ? 0.06 : 0.94) * cam.worldView.width;
    const img = this.add.image(sx, cam.worldView.y + cam.worldView.height * 0.3, p.img.sourceKey || p.img.texture.key).setOrigin(0.5, 0).setDepth(40)
      .setScale(p.baseScale * 1.5).setTint(0x2a2238).setAlpha(0);
    if (img.preFX) img.preFX.addBlur(2, 2, 2, 1.4);
    this.shoulder = img;
    this.tweens.add({ targets: img, alpha: 0.93, duration: 300 });
  }

  clearShoulder() { this.shoulder?.destroy(); this.shoulder = null; }

  /** Personagem falando: boca acompanha o texto (LivingSprite); sem WebGL, só um leve movimento de corpo. */
  speak(id, text, msPerChar) {
    const c = this.chars.get(id);
    if (!c || this.instant) return;
    if (c.anim) { c.anim.speak(text, msPerChar); return; }
    const ms = text.length * msPerChar;
    this.tweens.add({ targets: c.img, scaleY: c.baseScale * 1.006, duration: 260, yoyo: true, repeat: Math.max(0, Math.floor(ms / 520) - 1), ease: 'Sine.easeInOut' });
  }

  stopSpeaking() { for (const c of this.chars.values()) c.anim?.stopSpeaking(); }

  setAnimationLevel(level) { for (const c of this.chars.values()) if (c.anim) c.anim.level = level; }

  // ------------------------------------------------------------------
  // Direção de cena: luz, panorâmica, cortes, gestos e aproximação
  // ------------------------------------------------------------------
  /** Escurece (0..1) ou clareia a cena. */
  dim(level, ms = 900) { this.tweens.add({ targets: this.veil, alpha: Math.max(0, Math.min(0.92, level)), duration: this.instant ? 0 : ms }); }
  /** Brilho romântico suave (0..1). */
  romanticGlow(level, ms = 1200) { this.tweens.add({ targets: this.glow, alpha: Math.max(0, Math.min(0.25, level * 0.18)), duration: this.instant ? 0 : ms }); }

  lightsOn(sfx) { this.ambient.lightsOn(sfx); }

  /** Panorâmica lenta pelo ambiente (narração sem personagens). */
  pan(dir = 1, ms = 9000) {
    this.currentShot = { type: 'pan' };
    this.tweens.killTweensOf(this.camProxy);
    const z = 1.22, half = this.W / z / 2;
    const xs = [half, this.W - half];
    if (dir < 0) xs.reverse();
    Object.assign(this.camProxy, { x: xs[0], y: this.H / 2 - this.H * 0.04, z });
    this.applyCam();
    if (this.instant || this.skipping) return;
    this.tweens.add({ targets: this.camProxy, x: xs[1], duration: ms, ease: 'Sine.easeInOut', onUpdate: () => this.applyCam() });
  }

  /** Corte para o céu/janela (ex.: no beijo, ou quando a cena passa uma noite): personagens somem, câmera sobe. */
  async cutaway(ms = 2600) {
    if (this.instant || this.skipping) return;
    this.tweens.killTweensOf(this.camProxy);
    for (const c of this.chars.values()) this.fadeAlpha(c.img, 0, 700);
    await new Promise((r) => this.tweens.add({ targets: this.camProxy, y: this.H * 0.22, z: 1.6, duration: ms, ease: 'Sine.easeInOut', onUpdate: () => this.applyCam(), onComplete: r }));
  }

  /** Volta do corte: personagens reaparecem. */
  uncut() { for (const c of this.chars.values()) if (c.img.alpha < 1) this.fadeAlpha(c.img, 1, 600); }

  /** Transparência animada por um objeto à parte: as animações de expressão não a cancelam. */
  fadeAlpha(img, to, ms) {
    if (this.instant || !ms) { img.alpha = to; return; }
    const p = { a: img.alpha };
    this.tweens.add({ targets: p, a: to, duration: ms, onUpdate: () => { if (img.active !== false) img.alpha = p.a; } });
  }

  /** Personagem se aproxima (fica maior e mais perto da câmera) ou volta ao lugar (amount 0). */
  approach(id, amount = 1) {
    const c = this.chars.get(id); if (!c) return;
    const k = 1 + 0.22 * amount;
    const toX = amount > 0 ? c.img.x + (this.W * 0.5 - c.img.x) * Math.min(1, amount) : this.W * SLOTS[c.at];
    this.tweens.add({ targets: c.img, scale: c.baseScale * k, y: c.baseY + this.H * 0.06 * amount, x: toX, duration: this.instant ? 0 : 1400, ease: 'Sine.easeInOut' });
    c.near = amount;
  }

  /** Gestos: nod (assentir), shake (negar), sigh (suspirar), turn (virar o rosto), close_eyes / open_eyes. */
  gesture(id, g) {
    const c = this.chars.get(id); if (!c) return;
    if (c.anim) c.anim.gesture(g);
    else if (g === 'nod') this.tweens.add({ targets: c.img, y: c.baseY + 6, duration: 160, yoyo: true, repeat: 1 });
    else if (g === 'shake') this.tweens.add({ targets: c.img, x: c.img.x + 6, duration: 90, yoyo: true, repeat: 3 });
  }

  update(_t, dtMs) {
    const dt = Math.min(0.05, dtMs / 1000);
    for (const c of this.chars.values()) c.anim?.update(dt);
  }

}
