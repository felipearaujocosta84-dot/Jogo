// Vida própria dos cenários ilustrados (desenhada POR CIMA da pintura, sem substituí-la):
// janelas dos prédios piscando, faixas de luz passando no teto, poeira na luz, vapor do café,
// estrelas, lâmpadas do terraço. Coordenadas no espaço da pintura (1600x900).
import { BG_W, BG_H } from './backgrounds.js';

const rnd = (a, b) => a + Math.random() * (b - a);

export class AmbientFX {
  constructor(scene) { this.scene = scene; this.objs = []; this.timers = []; this.key = null; this.lamps = []; }

  /** Converte um ponto da pintura para o mundo (o cenário cobre a tela). */
  pt(bx, by) {
    const { W, H } = this.scene;
    const s = Math.max(W / BG_W, H / BG_H);
    return { x: W / 2 + (bx - BG_W / 2) * s, y: H / 2 + (by - BG_H / 2) * s, s };
  }

  clear() {
    this.objs.forEach((o) => { this.scene.tweens.killTweensOf(o); o.destroy(); });
    this.timers.forEach((t) => t.remove());
    this.objs = []; this.timers = []; this.lamps = [];
  }

  add(o, depth = 4) { o.setDepth(depth); this.objs.push(o); return o; }

  set(key, { level = 'completa' } = {}) {
    this.clear(); this.key = key;
    if (level === 'off') return;
    const f = this[`fx_${key}`];
    if (f) f.call(this);
  }

  relayout() { if (this.key) this.set(this.key); }

  // janelinhas acendendo e apagando numa área da pintura
  cityWindows(x0, y0, x1, y1, n, color = 0xffe2a0) {
    for (let i = 0; i < n; i++) {
      const p = this.pt(rnd(x0, x1), rnd(y0, y1));
      const r = this.add(this.scene.add.rectangle(p.x, p.y, 8 * p.s, 11 * p.s, color, 0));
      this.scene.tweens.add({ targets: r, alpha: { from: 0, to: rnd(0.5, 0.9) }, duration: rnd(600, 1600), delay: rnd(0, 6000), yoyo: true, hold: rnd(2000, 9000), repeat: -1, repeatDelay: rnd(1000, 8000) });
    }
  }

  fx_apartamento_noite() {
    this.cityWindows(480, 440, 1120, 525, 22);
    // faróis de carros desenhando quadrados de luz que atravessam o teto
    const spawn = () => {
      const a = this.pt(-200, 60), b = this.pt(BG_W + 200, 60);
      const q = this.add(this.scene.add.rectangle(a.x, a.y, 220 * a.s, 120 * a.s, 0xfff0c8, 0).setBlendMode('ADD'), 3);
      this.scene.tweens.add({ targets: q, x: b.x, duration: 5200, ease: 'Sine.easeInOut', onComplete: () => q.destroy() });
      this.scene.tweens.add({ targets: q, alpha: 0.13, duration: 1400, yoyo: true, hold: 2400 });
    };
    spawn();
    this.timers.push(this.scene.time.addEvent({ delay: 7000, loop: true, callback: spawn }));
  }

  fx_apartamento() {
    // poeira flutuando no feixe de luz da janela
    for (let i = 0; i < 26; i++) {
      const p = this.pt(rnd(520, 1300), rnd(120, 820));
      const d = this.add(this.scene.add.circle(p.x, p.y, rnd(1.2, 2.6) * p.s, 0xfffbe8, rnd(0.25, 0.6)));
      this.scene.tweens.add({ targets: d, x: p.x + rnd(-40, 40) * p.s, y: p.y - rnd(30, 90) * p.s, alpha: 0, duration: rnd(5000, 9000), repeat: -1, delay: rnd(0, 4000) });
    }
  }

  fx_cafe() {
    // vapor das xícaras no balcão
    for (const [bx, by] of [[560, 570], [610, 574], [1360, 572]]) {
      const puff = () => {
        const p = this.pt(bx + rnd(-6, 6), by);
        const c = this.add(this.scene.add.circle(p.x, p.y, rnd(5, 9) * p.s, 0xffffff, 0.28));
        this.scene.tweens.add({ targets: c, y: p.y - 70 * p.s, x: p.x + rnd(-14, 14) * p.s, scale: 2.4, alpha: 0, duration: 2600, onComplete: () => c.destroy() });
      };
      this.timers.push(this.scene.time.addEvent({ delay: 520, loop: true, callback: puff }));
    }
    // luminárias "respirando"
    for (const lx of [300, 700, 1100]) {
      const p = this.pt(lx, 170);
      const g = this.add(this.scene.add.circle(p.x, p.y, 140 * p.s, 0xffc070, 0.06).setBlendMode('ADD'));
      this.scene.tweens.add({ targets: g, alpha: 0.12, duration: rnd(1800, 2600), yoyo: true, repeat: -1 });
    }
  }

  stringLights(on = true) {
    this.lamps = [];
    for (const [p0, p1, p2] of [[[-20, 120], [500, 330], [900, 190]], [[900, 190], [1250, 90], [1640, 260]]]) {
      for (let t = 0.04; t < 1; t += 0.085) {
        const bx = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0];
        const by = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1] + 14;
        const p = this.pt(bx, by);
        const g = this.add(this.scene.add.circle(p.x, p.y, 26 * p.s, 0xffd890, on ? 0.18 : 0).setBlendMode('ADD'), 6);
        this.lamps.push(g);
        if (on) this.scene.tweens.add({ targets: g, alpha: 0.32, duration: rnd(900, 1600), yoyo: true, repeat: -1, delay: rnd(0, 1000) });
      }
    }
  }

  /** As lâmpadas acendem uma a uma (narração: "as lâmpadas acendem uma por uma"). */
  lightsOn(sfx) {
    this.lamps.forEach((g, i) => {
      this.scene.tweens.killTweensOf(g); g.setAlpha(0);
      this.scene.time.delayedCall(i * 140, () => {
        sfx?.();
        this.scene.tweens.add({ targets: g, alpha: 0.34, duration: 220, onComplete: () => this.scene.tweens.add({ targets: g, alpha: 0.2, duration: rnd(900, 1500), yoyo: true, repeat: -1 }) });
      });
    });
  }

  fx_terraco_noite() {
    for (let i = 0; i < 40; i++) {
      const p = this.pt(rnd(0, BG_W), rnd(10, 400));
      const s = this.add(this.scene.add.circle(p.x, p.y, rnd(1, 2.2) * p.s, 0xffffff, 0), 2);
      this.scene.tweens.add({ targets: s, alpha: rnd(0.4, 1), duration: rnd(700, 1800), yoyo: true, repeat: -1, delay: rnd(0, 3000) });
    }
    this.cityWindows(0, 420, BG_W, 620, 30);
    this.stringLights(true);
  }

  fx_terraco_tarde() {
    const p = this.pt(1100, 560);
    const sun = this.add(this.scene.add.circle(p.x, p.y, 220 * p.s, 0xffd8a0, 0.1).setBlendMode('ADD'), 2);
    this.scene.tweens.add({ targets: sun, alpha: 0.18, scale: 1.08, duration: 3200, yoyo: true, repeat: -1 });
    this.cityWindows(0, 450, BG_W, 620, 10, 0xfff4d0);
  }

  fx_corredor_noite() {
    for (const lx of [300, 900, 1400]) {
      const p = this.pt(lx, 60);
      const g = this.add(this.scene.add.circle(p.x, p.y, 200 * p.s, 0xffe6b0, 0.08).setBlendMode('ADD'));
      if (lx === 900) this.scene.tweens.add({ targets: g, alpha: 0.02, duration: 90, yoyo: true, repeat: -1, repeatDelay: 4200 }); // lâmpada falhando
    }
  }
}
