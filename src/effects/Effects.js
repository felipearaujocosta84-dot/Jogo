// Efeitos visuais leves: poeira/faíscas no chute, confete no gol.
import { ParticleSystem, Vector3, Color4 } from '../babylon.js';
import { createDotTexture } from '../stadium/textures.js';

export class Effects {
  constructor(scene, maxParticles = 40) {
    this.scene = scene;
    const tex = createDotTexture(scene);

    const kick = new ParticleSystem('kickFx', maxParticles, scene);
    kick.particleTexture = tex;
    kick.emitter = new Vector3();
    kick.minEmitBox = new Vector3(-0.05, 0, -0.05);
    kick.maxEmitBox = new Vector3(0.05, 0.05, 0.05);
    kick.color1 = new Color4(1, 1, 1, 0.9);
    kick.color2 = new Color4(0.85, 0.85, 0.8, 0.7);
    kick.colorDead = new Color4(0.6, 0.6, 0.6, 0);
    kick.minSize = 0.05; kick.maxSize = 0.18;
    kick.minLifeTime = 0.15; kick.maxLifeTime = 0.4;
    kick.minEmitPower = 1.5; kick.maxEmitPower = 4;
    kick.direction1 = new Vector3(-1, 0.6, -1);
    kick.direction2 = new Vector3(1, 1.6, 1);
    kick.gravity = new Vector3(0, -6, 0);
    kick.blendMode = ParticleSystem.BLENDMODE_ADD;
    kick.emitRate = 0;
    kick.manualEmitCount = 0;
    kick.start();
    this.kickFx = kick;

    const conf = new ParticleSystem('confetti', maxParticles * 3, scene);
    conf.particleTexture = tex;
    conf.emitter = new Vector3();
    conf.minEmitBox = new Vector3(-0.5, 0, -1.5);
    conf.maxEmitBox = new Vector3(0.5, 2, 1.5);
    conf.color1 = new Color4(1, 0.85, 0.2, 1);
    conf.color2 = new Color4(1, 0.25, 0.4, 1);
    conf.colorDead = new Color4(0.2, 0.6, 1, 0);
    conf.minSize = 0.08; conf.maxSize = 0.2;
    conf.minLifeTime = 0.8; conf.maxLifeTime = 1.8;
    conf.minEmitPower = 3; conf.maxEmitPower = 7;
    conf.direction1 = new Vector3(-1, 2, -1);
    conf.direction2 = new Vector3(1, 3, 1);
    conf.gravity = new Vector3(0, -5, 0);
    conf.emitRate = 0;
    conf.manualEmitCount = 0;
    conf.start();
    this.confetti = conf;
    this.maxParticles = maxParticles;
  }

  kickBurst(position, power = 0.5) {
    this.kickFx.emitter.copyFrom(position);
    this.kickFx.manualEmitCount = Math.round(6 + power * (this.maxParticles - 6) * 0.6);
  }

  goalBurst(position) {
    this.confetti.emitter.copyFrom(position);
    this.confetti.manualEmitCount = this.maxParticles * 2;
  }
}
