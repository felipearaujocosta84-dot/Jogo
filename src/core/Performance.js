// Resolução adaptável e controle de FPS.
// O motor é criado sem adaptToDeviceRatio; aqui decidimos quantos pixels reais renderizar.
import { QUALITY } from '../config.js';

export function detectDefaultLevel() {
  const mem = navigator.deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;
  const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  if (!mobile && mem >= 4) return 'high';
  if (mem <= 2 || cores <= 4) return 'low';
  return 'medium';
}

export class Performance {
  /**
   * @param {import('@babylonjs/core').Engine} engine
   * @param {string} mode auto | high | medium | low
   */
  constructor(engine, mode = 'auto') {
    this.engine = engine;
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.fpsSamples = [];
    this.timer = 0;
    this.setMode(mode);
  }

  /** Nível efetivo (presets de qualidade). */
  get level() {
    return this.mode === 'auto' ? this.autoLevel : this.mode;
  }

  get preset() {
    return QUALITY[this.level];
  }

  setMode(mode) {
    this.mode = mode;
    if (mode === 'auto') this.autoLevel = this.autoLevel || detectDefaultLevel();
    // densidade de pixels alvo por nível
    const target = { high: 2, medium: 1.5, low: 1 }[this.level];
    this.renderDpr = Math.min(this.dpr, target);
    this.minDpr = Math.min(this.dpr, 0.6);
    this.maxDpr = Math.min(this.dpr, target);
    this.apply();
  }

  apply() {
    const scaling = Math.max(1 / this.renderDpr, this.preset.minScaling / Math.max(1, this.dpr));
    this.engine.setHardwareScalingLevel(scaling);
  }

  /** Chamado a cada quadro com o dt real. Em modo auto, ajusta a resolução pelo FPS medido. */
  update(dt, fpsCap) {
    if (dt <= 0) return;
    this.fpsSamples.push(1 / dt);
    if (this.fpsSamples.length > 90) this.fpsSamples.shift();
    if (this.mode !== 'auto') return;
    this.timer += dt;
    if (this.timer < 2) return;
    this.timer = 0;
    const fps = this.averageFps;
    const target = fpsCap || 60;
    if (fps < target * 0.72 && this.renderDpr > this.minDpr) {
      this.renderDpr = Math.max(this.minDpr, this.renderDpr - 0.15);
      this.apply();
    } else if (fps > target * 0.95 && this.renderDpr < this.maxDpr) {
      this.renderDpr = Math.min(this.maxDpr, this.renderDpr + 0.1);
      this.apply();
    }
  }

  get averageFps() {
    if (!this.fpsSamples.length) return 60;
    let s = 0;
    for (const f of this.fpsSamples) s += f;
    return s / this.fpsSamples.length;
  }
}
