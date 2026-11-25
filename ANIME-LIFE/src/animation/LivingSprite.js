// Personagem desenhado pelo shader de animação (WebGL). Se não houver WebGL ou dados de "rig",
// o palco usa a ilustração estática (Phaser Image) — o jogo continua funcionando igual.
import Phaser from 'phaser';
import { LIVING_FRAG, LIVING_UNIFORMS } from './livingShader.js';

export function canAnimate(scene, data) {
  return scene.renderer.type === Phaser.WEBGL && !!data?.rig;
}

export class LivingSprite extends Phaser.GameObjects.Shader {
  constructor(scene, x, y, textureKey, layerKeys = {}) {
    if (!scene.cache.shader.has('living')) {
      scene.cache.shader.add('living', new Phaser.Display.BaseShader('living', LIVING_FRAG, undefined, LIVING_UNIFORMS));
    }
    const frame = scene.textures.getFrame(textureKey);
    const channels = [textureKey, layerKeys.eyesClosed || textureKey, layerKeys.mouthOpen || textureKey];
    super(scene, 'living', x, y, frame.width, frame.height, channels, { wrapS: 'clamp_to_edge', wrapT: 'clamp_to_edge' });
    scene.add.existing(this);
    this.sourceKey = textureKey;
    this._alpha = 1; this._tint = 0xffffff;
    this.setUniform('uAspect.value', frame.width / frame.height);
    this.setUniform('uHasEyesLayer.value', layerKeys.eyesClosed ? 1 : 0);
    this.setUniform('uHasMouthLayer.value', layerKeys.mouthOpen ? 1 : 0);
  }

  // Shader não tem alpha/tint nativos: viram uniforms (assim os tweens do palco continuam valendo)
  get alpha() { return this._alpha; }
  set alpha(v) { this._alpha = v; this.setUniform('uAlpha.value', v); }
  setAlpha(v) { this.alpha = v; return this; }
  setTint(color = 0xffffff) {
    this._tint = color;
    this.setUniform('uTint.value.x', ((color >> 16) & 255) / 255);
    this.setUniform('uTint.value.y', ((color >> 8) & 255) / 255);
    this.setUniform('uTint.value.z', (color & 255) / 255);
    return this;
  }
  get width2() { return this.width; }
}
