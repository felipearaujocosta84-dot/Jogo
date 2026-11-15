// Efeitos visuais leves (partículas) — pensados para celular: poucos sistemas reaproveitados.
import { ParticleSystem, DynamicTexture, Color4, Vector3, PointLight, Color3, TransformNode } from '../babylon.js';

export class Effects {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.tex = this.makeDotTexture();
    this.fires = [];
    this.bursts = [];
    this.mult = game.quality.particles;
  }

  makeDotTexture() {
    const t = new DynamicTexture('dotTex', { width: 64, height: 64 }, this.scene, false);
    const ctx = t.getContext();
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.7)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    t.update();
    t.hasAlpha = true;
    return t;
  }

  /** Fogueira contínua (com luz pontual opcional). */
  fire(pos, scale = 1, light = true) {
    const ps = new ParticleSystem('fire', Math.round(60 * this.mult) + 10, this.scene);
    ps.particleTexture = this.tex;
    ps.emitter = pos.clone();
    ps.minEmitBox = new Vector3(-0.25 * scale, 0, -0.25 * scale);
    ps.maxEmitBox = new Vector3(0.25 * scale, 0.1, 0.25 * scale);
    ps.color1 = new Color4(1, 0.65, 0.2, 1);
    ps.color2 = new Color4(1, 0.35, 0.08, 1);
    ps.colorDead = new Color4(0.2, 0.05, 0.02, 0);
    ps.minSize = 0.25 * scale; ps.maxSize = 0.6 * scale;
    ps.minLifeTime = 0.35; ps.maxLifeTime = 0.8;
    ps.emitRate = 45 * this.mult + 10;
    ps.blendMode = ParticleSystem.BLENDMODE_ADD;
    ps.gravity = new Vector3(0, 2.2, 0);
    ps.direction1 = new Vector3(-0.3, 1, -0.3);
    ps.direction2 = new Vector3(0.3, 1.6, 0.3);
    ps.minEmitPower = 0.3; ps.maxEmitPower = 0.8;
    ps.updateSpeed = 0.016;
    ps.start();
    let pl = null;
    if (light && this.game.qualityLevel !== 'low') {
      pl = new PointLight('fireLight', pos.add(new Vector3(0, 1, 0)), this.scene);
      pl.diffuse = new Color3(1, 0.6, 0.25);
      pl.specular = new Color3(0.3, 0.2, 0.1);
      pl.intensity = 0.9;
      pl.range = 9 * scale;
    }
    const f = { ps, pl, t: Math.random() * 10 };
    this.fires.push(f);
    return f;
  }

  /** Explosão curta de partículas (acerto, morte, coleta...). */
  burst(pos, opt = {}) {
    const count = Math.max(4, Math.round((opt.count || 20) * this.mult));
    const ps = new ParticleSystem('burst', count, this.scene);
    ps.particleTexture = this.tex;
    ps.emitter = pos.clone();
    const c = opt.color || new Color4(1, 0.9, 0.6, 1);
    ps.color1 = c;
    ps.color2 = opt.color2 || c;
    ps.colorDead = new Color4(c.r, c.g, c.b, 0);
    ps.minSize = opt.minSize || 0.08; ps.maxSize = opt.maxSize || 0.22;
    ps.minLifeTime = opt.life ? opt.life * 0.5 : 0.2; ps.maxLifeTime = opt.life || 0.5;
    ps.manualEmitCount = count;
    ps.blendMode = opt.additive === false ? ParticleSystem.BLENDMODE_STANDARD : ParticleSystem.BLENDMODE_ADD;
    ps.gravity = new Vector3(0, opt.gravity ?? -6, 0);
    const sp = opt.spread ?? 1;
    ps.direction1 = new Vector3(-sp, opt.up ?? 1.2, -sp);
    ps.direction2 = new Vector3(sp, (opt.up ?? 1.2) * 2, sp);
    ps.minEmitPower = opt.power ? opt.power * 0.5 : 1.5; ps.maxEmitPower = opt.power || 3.5;
    ps.updateSpeed = 0.016;
    ps.disposeOnStop = true;
    ps.targetStopDuration = (opt.life || 0.5) + 0.1;
    ps.start();
    return ps;
  }

  hit(pos, strong = false) {
    this.burst(pos, { count: strong ? 26 : 14, color: new Color4(1, 0.85, 0.5, 1), color2: new Color4(1, 0.5, 0.2, 1), power: strong ? 5 : 3.5 });
  }

  blood(pos, color = new Color4(0.55, 0.05, 0.04, 1)) {
    this.burst(pos, { count: 12, color, color2: color, additive: false, power: 2.5, minSize: 0.06, maxSize: 0.14, gravity: -9 });
  }

  dust(pos, big = false) {
    this.burst(pos, {
      count: big ? 24 : 8, color: new Color4(0.62, 0.55, 0.42, 0.6), additive: false,
      power: big ? 2.5 : 1, up: 0.4, spread: 1.4, minSize: 0.2, maxSize: big ? 0.8 : 0.45, life: big ? 0.9 : 0.6, gravity: 0.3
    });
  }

  sparkle(pos, color = new Color4(1, 0.95, 0.5, 1)) {
    this.burst(pos, { count: 22, color, power: 2, up: 1.5, gravity: 1.5, life: 0.9, minSize: 0.05, maxSize: 0.16 });
  }

  levelUp(pos) {
    this.burst(pos, { count: 50, color: new Color4(1, 0.9, 0.4, 1), color2: new Color4(0.6, 0.9, 1, 1), power: 3, up: 2.5, gravity: 2, life: 1.4, spread: 0.6 });
  }

  /** Brilho contínuo (baú, erva, marcador de missão). */
  glow(pos, color = new Color4(0.5, 0.9, 1, 1), rate = 6) {
    const ps = new ParticleSystem('glow', 24, this.scene);
    ps.particleTexture = this.tex;
    ps.emitter = pos.clone();
    ps.minEmitBox = new Vector3(-0.3, 0, -0.3);
    ps.maxEmitBox = new Vector3(0.3, 0.3, 0.3);
    ps.color1 = color; ps.color2 = color;
    ps.colorDead = new Color4(color.r, color.g, color.b, 0);
    ps.minSize = 0.05; ps.maxSize = 0.14;
    ps.minLifeTime = 0.8; ps.maxLifeTime = 1.6;
    ps.emitRate = rate * this.mult + 1;
    ps.blendMode = ParticleSystem.BLENDMODE_ADD;
    ps.gravity = new Vector3(0, 0.6, 0);
    ps.direction1 = new Vector3(-0.1, 0.2, -0.1);
    ps.direction2 = new Vector3(0.1, 0.5, 0.1);
    ps.minEmitPower = 0.2; ps.maxEmitPower = 0.4;
    ps.updateSpeed = 0.016;
    ps.start();
    return ps;
  }

  update(dt) {
    for (const f of this.fires) {
      f.t += dt;
      if (f.pl) f.pl.intensity = 0.8 + Math.sin(f.t * 13) * 0.08 + Math.sin(f.t * 7.3) * 0.1;
    }
  }
}
