// =============================================================
// EXTREME RACING — GraphicsSettings
// Presets Baixo / Médio / Alto / Ultra, detecção automática do
// aparelho e resolução adaptativa conforme o FPS medido.
// =============================================================

export const PRESETS = {
  low: {
    label: 'Baixo', scaling: 1.7, minScaling: 1.4, maxScaling: 2.4,
    shadows: false, shadowMapSize: 512, pcf: false,
    viewDistance: 700, fogDensity: 0.0016, particles: 0.35, vegetation: 0.3,
    textureSize: 512, postProcess: false, bloom: false, fxaa: false, reflections: false,
    rainDrops: 600, antialias: false, terrainSubdiv: 64, maxSmoke: 60,
  },
  medium: {
    label: 'Médio', scaling: 1.3, minScaling: 1.1, maxScaling: 2.0,
    shadows: true, shadowMapSize: 1024, pcf: false,
    viewDistance: 1300, fogDensity: 0.0009, particles: 0.6, vegetation: 0.6,
    textureSize: 1024, postProcess: true, bloom: false, fxaa: true, reflections: true,
    rainDrops: 1400, antialias: false, terrainSubdiv: 96, maxSmoke: 120,
  },
  high: {
    label: 'Alto', scaling: 1.0, minScaling: 1.0, maxScaling: 1.6,
    shadows: true, shadowMapSize: 2048, pcf: true,
    viewDistance: 2200, fogDensity: 0.00055, particles: 1, vegetation: 1,
    textureSize: 1024, postProcess: true, bloom: true, fxaa: true, reflections: true,
    rainDrops: 2600, antialias: true, terrainSubdiv: 128, maxSmoke: 220,
  },
  ultra: {
    label: 'Ultra', scaling: 'native', minScaling: 'native', maxScaling: 1.3,
    shadows: true, shadowMapSize: 4096, pcf: true,
    viewDistance: 3500, fogDensity: 0.00035, particles: 1.3, vegetation: 1.4,
    textureSize: 2048, postProcess: true, bloom: true, fxaa: true, reflections: true,
    rainDrops: 4000, antialias: true, terrainSubdiv: 160, maxSmoke: 320,
  },
};

export const PRESET_ORDER = ['low', 'medium', 'high', 'ultra'];

/** Escolhe um preset a partir das características do aparelho. */
export function detectPreset(engine) {
  let score = 0;
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;
  score += cores >= 8 ? 2 : cores >= 6 ? 1 : 0;
  score += mem >= 8 ? 2 : mem >= 6 ? 1 : mem <= 3 ? -1 : 0;
  let renderer = '';
  try {
    renderer = (engine.getGlInfo()?.renderer || '').toLowerCase();
  } catch { /* ignore */ }
  const mobile = /android|iphone|ipad|mobile/i.test(navigator.userAgent);
  // GPUs móveis de entrada (ex.: Adreno 6xx baixo, Mali-G52/G57, PowerVR)
  if (/adreno \(tm\) (5\d\d|6[0-1]\d)|mali-g(31|51|52|57|68)|powervr|mali-t/.test(renderer)) score -= 2;
  if (/adreno \(tm\) (7\d\d|8\d\d)|mali-g(7\d|71\d)|immortalis/.test(renderer)) score += 2;
  if (!mobile) score += 3;
  if (score <= 0) return 'low';
  if (score <= 2) return 'medium';
  if (score <= 5) return 'high';
  return 'ultra';
}

export class GraphicsSettings {
  constructor(engine, save) {
    this.engine = engine;
    this.save = save;
    this.detected = detectPreset(engine);
    this.fpsSamples = [];
    this.adaptiveTimer = 0;
    this.listeners = [];
    this._apply();
  }

  get key() {
    const k = this.save.settings.graphics;
    return k === 'auto' ? this.detected : k;
  }

  get preset() { return PRESETS[this.key]; }

  set(key) {
    this.save.setSetting('graphics', key);
    this._apply();
    for (const fn of this.listeners) fn(this.preset);
  }

  onChange(fn) { this.listeners.push(fn); }

  _resolveScaling(v) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    return v === 'native' ? 1 / dpr : v;
  }

  _apply() {
    this.scaling = this._resolveScaling(this.preset.scaling);
    this.engine.setHardwareScalingLevel(this.scaling);
  }

  /** Resolução adaptativa: ajusta a escala dentro dos limites do preset. */
  update(dt) {
    if (!this.save.settings.adaptiveResolution) return;
    const fps = this.engine.getFps();
    if (!Number.isFinite(fps) || fps <= 0) return;
    this.fpsSamples.push(fps);
    if (this.fpsSamples.length > 90) this.fpsSamples.shift();
    this.adaptiveTimer += dt;
    if (this.adaptiveTimer < 2.5 || this.fpsSamples.length < 60) return;
    this.adaptiveTimer = 0;
    const avg = this.fpsSamples.reduce((a, b) => a + b, 0) / this.fpsSamples.length;
    const p = this.preset;
    const minS = this._resolveScaling(p.minScaling);
    const maxS = this._resolveScaling(p.maxScaling);
    let s = this.scaling;
    if (avg < 27) s = Math.min(maxS, s + 0.15);
    else if (avg > 55) s = Math.max(minS, s - 0.08);
    if (Math.abs(s - this.scaling) > 0.01) {
      this.scaling = s;
      this.engine.setHardwareScalingLevel(s);
    }
  }
}
