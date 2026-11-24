// =============================================================
// EXTREME RACING — VehicleEffects
// Fumaça dos pneus (derrapagem/patinagem) e poeira (fora do
// asfalto) com sistemas de partículas por roda traseira/dianteira.
// A quantidade é escalonada pelo preset gráfico.
// =============================================================
import { ParticleSystem, DynamicTexture, Vector3, Color4, TransformNode } from '@babylonjs/core';

const textureCache = new WeakMap();

/** Textura de partícula (fumaça suave) gerada em canvas. */
export function getSmokeTexture(scene) {
  if (textureCache.has(scene)) return textureCache.get(scene);
  const size = 128;
  const tex = new DynamicTexture('smokeTex', { width: size, height: size }, scene, false);
  const ctx = tex.getContext();
  const g = ctx.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  // ruído leve para não parecer um disco perfeito
  for (let i = 0; i < 140; i++) {
    const x = Math.random() * size, y = Math.random() * size;
    const d = Math.hypot(x - size / 2, y - size / 2) / (size / 2);
    if (d > 0.9) continue;
    ctx.fillStyle = `rgba(255,255,255,${0.08 * (1 - d)})`;
    ctx.beginPath(); ctx.arc(x, y, 4 + Math.random() * 8, 0, Math.PI * 2); ctx.fill();
  }
  tex.hasAlpha = true;
  tex.update(false);
  textureCache.set(scene, tex);
  return tex;
}

export class VehicleEffects {
  constructor(scene, vehicle, graphics) {
    this.scene = scene;
    this.vehicle = vehicle;
    const preset = graphics?.preset ?? { particles: 0.6, maxSmoke: 120 };
    this.scale = preset.particles;
    this.systems = [];
    // No preset Baixo só o carro do jogador emite partículas
    if (this.scale <= 0 || (!vehicle.isPlayer && this.scale < 0.5)) return;
    const tex = getSmokeTexture(scene);
    const names = ['FL', 'FR', 'RL', 'RR'];
    for (let i = 0; i < 4; i++) {
      const emitter = new TransformNode(`${vehicle.id}_fx_${names[i]}`, scene);
      // Fumaça
      const smoke = new ParticleSystem(`${vehicle.id}_smoke_${i}`, Math.round(preset.maxSmoke * (i >= 2 ? 1 : 0.5)), scene);
      smoke.particleTexture = tex;
      smoke.emitter = emitter;
      smoke.minEmitBox = new Vector3(-0.15, 0, -0.2);
      smoke.maxEmitBox = new Vector3(0.15, 0.05, 0.2);
      smoke.color1 = new Color4(0.85, 0.85, 0.85, 0.5);
      smoke.color2 = new Color4(0.7, 0.7, 0.72, 0.35);
      smoke.colorDead = new Color4(0.6, 0.6, 0.6, 0);
      smoke.minSize = 0.6; smoke.maxSize = 1.4;
      smoke.minLifeTime = 0.8; smoke.maxLifeTime = 2.0;
      smoke.minEmitPower = 0.3; smoke.maxEmitPower = 1.2;
      smoke.direction1 = new Vector3(-0.6, 0.8, -0.6);
      smoke.direction2 = new Vector3(0.6, 1.4, 0.6);
      smoke.gravity = new Vector3(0, 0.35, 0);
      smoke.addSizeGradient(0, 0.5);
      smoke.addSizeGradient(1, 3.2);
      smoke.blendMode = ParticleSystem.BLENDMODE_STANDARD;
      smoke.emitRate = 0;
      smoke.start();
      // Poeira
      const dust = new ParticleSystem(`${vehicle.id}_dust_${i}`, Math.round(preset.maxSmoke * 0.6), scene);
      dust.particleTexture = tex;
      dust.emitter = emitter;
      dust.minEmitBox = new Vector3(-0.2, 0, -0.2);
      dust.maxEmitBox = new Vector3(0.2, 0.05, 0.2);
      dust.color1 = new Color4(0.62, 0.5, 0.34, 0.55);
      dust.color2 = new Color4(0.5, 0.42, 0.3, 0.4);
      dust.colorDead = new Color4(0.5, 0.42, 0.3, 0);
      dust.minSize = 0.8; dust.maxSize = 1.8;
      dust.minLifeTime = 1.0; dust.maxLifeTime = 2.6;
      dust.minEmitPower = 0.5; dust.maxEmitPower = 1.8;
      dust.direction1 = new Vector3(-1, 0.5, -1);
      dust.direction2 = new Vector3(1, 1.5, 1);
      dust.gravity = new Vector3(0, -0.2, 0);
      dust.addSizeGradient(0, 0.6);
      dust.addSizeGradient(1, 3.6);
      dust.blendMode = ParticleSystem.BLENDMODE_STANDARD;
      dust.emitRate = 0;
      dust.start();
      this.systems.push({ emitter, smoke, dust });
    }
  }

  /** @param {boolean} stop zera as emissões (replay) */
  update(dt, stop = false) {
    if (!this.systems.length) return;
    if (stop) { for (const s of this.systems) { s.smoke.emitRate = 0; s.dust.emitRate = 0; } return; }
    const ph = this.vehicle.physics;
    const speed = ph.speed;
    for (let i = 0; i < 4; i++) {
      const w = ph.wheels[i];
      const sys = this.systems[i];
      if (!w.contact) { sys.smoke.emitRate = 0; sys.dust.emitRate = 0; continue; }
      const cp = w.contactPoint;
      sys.emitter.position.set(cp.x, cp.y + 0.1, cp.z);
      const surface = w.surface?.id ?? 'asphalt';
      const onPaved = surface === 'asphalt' || surface === 'kerb';
      const slip = Math.max(0, w.slipSpeed - 3.5);
      sys.smoke.emitRate = onPaved ? Math.min(140, slip * 9) * this.scale : 0;
      sys.dust.emitRate = !onPaved && speed > 3 ? Math.min(160, speed * 2.2 + slip * 4) * this.scale : 0;
    }
  }

  dispose() {
    for (const s of this.systems) {
      s.smoke.dispose();
      s.dust.dispose();
      s.emitter.dispose();
    }
    this.systems = [];
  }
}
