// =============================================================
// EXTREME RACING — AudioManager
// Áudio sintetizado em tempo real com Web Audio (não depende de
// arquivos): motor com timbre por cilindros que varia com RPM e
// carga, escapamento com estouros no corte, trocas de marcha,
// derrapagem, frenagem, colisões, vento, chuva e ambiente de cada
// pista. Opcional: amostras reais em public/assets/sounds (README).
// =============================================================
import { assetExists } from '../core/AssetManager.js';
import { CARS } from '../vehicles/VehicleCatalog.js';

/** Arquivos opcionais (OGG) em public/assets/sounds. */
export const SOUND_FILES = [
  'engine_low', 'engine_high', 'skid', 'wind', 'rain', 'impact',
  'amb_crowd', 'amb_forest', 'amb_wind', 'amb_ocean',
  ...CARS.flatMap((c) => [`${c.id}_low`, `${c.id}_high`]),
];
// RPM em que cada gravação foi feita (o tom é ajustado a partir dele)
export const SAMPLE_REF_RPM = { low: 2500, high: 6500 };

export class AudioManager {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.enabled = false;
    this.engineVoices = new Map();
    this.raw = {}; // ArrayBuffers baixados
    this.buffers = {}; // AudioBuffers decodificados
  }

  /** Procura e baixa as gravações opcionais (chamar no carregamento). */
  async preloadSamples() {
    const found = [];
    await Promise.all(SOUND_FILES.map(async (name) => {
      const url = `assets/sounds/${name}.ogg`;
      if (!(await assetExists(url))) return;
      try {
        const res = await fetch(url);
        this.raw[name] = await res.arrayBuffer();
        found.push(name);
      } catch { /* ignora */ }
    }));
    if (found.length) console.info('[Áudio] gravações encontradas:', found.join(', '));
    if (this.ctx) this._decode();
    return found;
  }

  _decode() {
    for (const [name, data] of Object.entries(this.raw)) {
      if (this.buffers[name] || data._decoding) continue;
      data._decoding = true;
      this.ctx.decodeAudioData(data.slice(0)).then((buf) => { this.buffers[name] = buf; }).catch((e) => console.warn('[Áudio] falha ao decodificar', name, e));
    }
  }

  _bufferSource(buf, loop = true) {
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = loop;
    return src;
  }

  /** Precisa ser chamado a partir de um toque/clique do usuário. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -14;
      this.compressor.ratio.value = 4;
      this.compressor.connect(this.master);
      this.noiseBuffer = this._makeNoise(2);
      this.enabled = true;
      this._decode();
      this.applyVolumes();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  applyVolumes() {
    if (!this.ctx) return;
    this.master.gain.value = this.settings.masterVolume ?? 0.8;
  }

  _makeNoise(seconds) {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b = 0.97 * b + 0.03 * w; // ruído rosado simples
      d[i] = w * 0.5 + b * 2.5;
    }
    return buf;
  }

  _noiseSource() {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    return src;
  }

  _waveShaper(amount) {
    const ws = this.ctx.createWaveShaper();
    const n = 1024;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / n) * 2 - 1;
      curve[i] = ((1 + amount) * x) / (1 + amount * Math.abs(x));
    }
    ws.curve = curve;
    ws.oversample = '2x';
    return ws;
  }

  /**
   * Cria a voz de motor de um veículo.
   * @param {string} id
   * @param {object} opts { cylinders, isPlayer }
   */
  createEngine(id, opts = {}) {
    if (!this.enabled) return null;
    const ctx = this.ctx;
    // Gravações reais: do carro (<id>_low/_high) ou genéricas (engine_low/_high)
    const low = this.buffers[`${opts.carId}_low`] ?? (!opts.electric ? this.buffers.engine_low : null);
    const high = this.buffers[`${opts.carId}_high`] ?? (!opts.electric ? this.buffers.engine_high : null);
    if (low || high) return this._createSampleEngine(id, low ?? high, high ?? low, opts);
    const out = ctx.createGain();
    out.gain.value = 0;
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1200;
    lp.Q.value = 0.8;
    const shaper = this._waveShaper(opts.electric ? 0.6 : opts.isPlayer ? 6 : 3);
    const mix = ctx.createGain();
    mix.gain.value = 0.5;
    // Três osciladores: fundamental de combustão, harmônico e sub
    const electric = !!opts.electric;
    const o1 = ctx.createOscillator(); o1.type = electric ? 'sine' : 'sawtooth';
    const o2 = ctx.createOscillator(); o2.type = electric ? 'triangle' : 'square';
    const o3 = ctx.createOscillator(); o3.type = electric ? 'sine' : 'triangle';
    const g1 = ctx.createGain(); g1.gain.value = 0.5;
    const g2 = ctx.createGain(); g2.gain.value = 0.18;
    const g3 = ctx.createGain(); g3.gain.value = 0.45;
    o1.connect(g1).connect(mix);
    o2.connect(g2).connect(mix);
    o3.connect(g3).connect(mix);
    // Ronco do escapamento (ruído filtrado modulado pela carga)
    const exNoise = this._noiseSource();
    const exBand = ctx.createBiquadFilter();
    exBand.type = 'bandpass';
    exBand.frequency.value = 220;
    exBand.Q.value = 1.2;
    const exGain = ctx.createGain();
    exGain.gain.value = 0;
    exNoise.connect(exBand).connect(exGain).connect(mix);
    mix.connect(shaper).connect(lp).connect(out);
    if (pan) { out.connect(pan); pan.connect(this.compressor); } else out.connect(this.compressor);
    o1.start(); o2.start(); o3.start(); exNoise.start();
    const voice = { out, lp, o1, o2, o3, exGain, exBand, pan, cyl: opts.cylinders || 8, electric, isPlayer: !!opts.isPlayer, lastLimiter: false };
    this.engineVoices.set(id, voice);
    return voice;
  }

  _createSampleEngine(id, lowBuf, highBuf, opts) {
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = 0;
    const gLow = ctx.createGain(), gHigh = ctx.createGain();
    const sLow = this._bufferSource(lowBuf), sHigh = this._bufferSource(highBuf);
    sLow.connect(gLow).connect(out);
    sHigh.connect(gHigh).connect(out);
    out.connect(this.compressor);
    sLow.start(0, Math.random() * lowBuf.duration);
    sHigh.start(0, Math.random() * highBuf.duration);
    const voice = { sample: true, out, gLow, gHigh, sLow, sHigh, isPlayer: !!opts.isPlayer, electric: !!opts.electric, lastLimiter: false };
    this.engineVoices.set(id, voice);
    return voice;
  }

  /** Atualiza a voz do motor (RPM, carga, volume por distância). */
  updateEngine(id, { rpm, load, limiter, distance = 0, pan = 0 }) {
    const v = this.engineVoices.get(id);
    if (!v) return;
    const t = this.ctx.currentTime;
    if (v.sample) {
      const r = Math.max(600, rpm);
      v.sLow.playbackRate.setTargetAtTime(Math.min(4, r / SAMPLE_REF_RPM.low), t, 0.03);
      v.sHigh.playbackRate.setTargetAtTime(Math.min(4, r / SAMPLE_REF_RPM.high), t, 0.03);
      const x = Math.max(0, Math.min(1, (r - 3000) / 2500));
      v.gLow.gain.setTargetAtTime(Math.cos((x * Math.PI) / 2), t, 0.05);
      v.gHigh.gain.setTargetAtTime(Math.sin((x * Math.PI) / 2), t, 0.05);
      const vol = (this.settings.engineVolume ?? 0.9) * (v.isPlayer ? 0.7 : 0.45) * (0.5 + load * 0.5);
      const att = v.isPlayer ? 1 : 1 / (1 + (distance / 18) ** 2);
      v.out.gain.setTargetAtTime(vol * att, t, 0.05);
      if (limiter && !v.lastLimiter && v.isPlayer) this.pop(0.5);
      v.lastLimiter = limiter;
      return;
    }
    // Elétrico: zumbido do inversor/motor proporcional à rotação; combustão: frequência de explosões
    const fire = v.electric ? 120 + rpm * 0.11 : (rpm / 60) * (v.cyl / 2);
    const f = Math.max(20, v.electric ? fire : fire * 0.5);
    v.o1.frequency.setTargetAtTime(f, t, 0.02);
    v.o2.frequency.setTargetAtTime(f * 2.01, t, 0.02);
    v.o3.frequency.setTargetAtTime(f * 0.5, t, 0.02);
    v.lp.frequency.setTargetAtTime(500 + load * 2600 + rpm * 0.25, t, 0.04);
    v.exBand.frequency.setTargetAtTime(120 + rpm * 0.05, t, 0.05);
    v.exGain.gain.setTargetAtTime(v.electric ? 0.04 + load * 0.08 : 0.15 + load * 0.5, t, 0.05);
    const vol = (this.settings.engineVolume ?? 0.9) * (v.isPlayer ? 0.5 : 0.35) * (0.45 + load * 0.55);
    const att = v.isPlayer ? 1 : 1 / (1 + (distance / 18) ** 2);
    v.out.gain.setTargetAtTime(vol * att, t, 0.05);
    if (v.pan) v.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), t, 0.05);
    // Estouro no corte de giro
    if (limiter && !v.lastLimiter && v.isPlayer) this.pop(0.5);
    v.lastLimiter = limiter;
  }

  removeEngine(id) {
    const v = this.engineVoices.get(id);
    if (!v) return;
    try {
      if (v.sample) { v.sLow.stop(); v.sHigh.stop(); } else { v.o1.stop(); v.o2.stop(); v.o3.stop(); }
    } catch { /* já parado */ }
    v.out.disconnect();
    this.engineVoices.delete(id);
  }

  /** Som contínuo (pneus, vento, chuva, ambiente). */
  createLoop(kind) {
    if (!this.enabled) return null;
    const ctx = this.ctx;
    const recorded = this.buffers[kind] ?? this.buffers[`amb_${kind}`];
    const src = recorded ? this._bufferSource(recorded) : this._noiseSource();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    g.gain.value = 0;
    if (kind === 'skid') { f.type = 'bandpass'; f.frequency.value = 1100; f.Q.value = 3.5; }
    else if (kind === 'wind') { f.type = 'lowpass'; f.frequency.value = 500; }
    else if (kind === 'rain') { f.type = 'highpass'; f.frequency.value = 1800; }
    else if (kind === 'crowd') { f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 0.6; }
    else if (kind === 'ocean') { f.type = 'lowpass'; f.frequency.value = 420; }
    else if (kind === 'forest') { f.type = 'bandpass'; f.frequency.value = 2600; f.Q.value = 2; }
    else { f.type = 'lowpass'; f.frequency.value = 800; }
    if (recorded) { f.type = 'allpass'; }
    src.connect(f).connect(g).connect(this.compressor);
    src.start();
    const loop = { src, f, g, kind };
    if (recorded) return loop; // gravação real dispensa modulação
    // Modulação lenta (ondas/multidão)
    if (kind === 'ocean' || kind === 'crowd' || kind === 'wind') {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = kind === 'ocean' ? 0.12 : 0.3;
      const lg = ctx.createGain();
      lg.gain.value = kind === 'ocean' ? 180 : 120;
      lfo.connect(lg).connect(f.frequency);
      lfo.start();
      loop.lfo = lfo;
    }
    return loop;
  }

  setLoop(loop, volume, freq = null) {
    if (!loop) return;
    const t = this.ctx.currentTime;
    loop.g.gain.setTargetAtTime(volume, t, 0.08);
    if (freq && loop.f.type !== 'allpass') loop.f.frequency.setTargetAtTime(freq, t, 0.08);
  }

  stopLoop(loop) {
    if (!loop) return;
    try { loop.src.stop(); loop.lfo?.stop(); } catch { /* ok */ }
    loop.g.disconnect();
  }

  /** Efeitos pontuais. */
  pop(vol = 0.5) { this._burst({ freq: 180, q: 1.5, dur: 0.08, vol: vol * (this.settings.effectsVolume ?? 0.8) }); }

  shift() {
    if (!this.enabled) return;
    this._burst({ freq: 2400, q: 6, dur: 0.05, vol: 0.18 * (this.settings.effectsVolume ?? 0.8) });
    this._burst({ freq: 140, q: 1, dur: 0.12, vol: 0.35 * (this.settings.effectsVolume ?? 0.8) });
  }

  impact(strength) {
    if (!this.enabled) return;
    const v = Math.min(1, strength / 10) * (this.settings.effectsVolume ?? 0.8);
    if (this.buffers.impact) {
      const src = this._bufferSource(this.buffers.impact, false);
      const g = this.ctx.createGain();
      g.gain.value = v;
      src.connect(g).connect(this.compressor);
      src.start();
      return;
    }
    this._burst({ freq: 90, q: 0.7, dur: 0.35, vol: v });
    this._burst({ freq: 1600, q: 2, dur: 0.15, vol: v * 0.5 });
  }

  beep(high = false) {
    if (!this.enabled) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = high ? 1320 : 660;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25 * (this.settings.effectsVolume ?? 0.8), t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (high ? 0.6 : 0.25));
    o.connect(g).connect(this.compressor);
    o.start(t);
    o.stop(t + 0.7);
  }

  ui() {
    if (!this.enabled) return;
    this._burst({ freq: 3200, q: 8, dur: 0.03, vol: 0.12 * (this.settings.effectsVolume ?? 0.8) });
  }

  _burst({ freq, q, dur, vol }) {
    if (!this.enabled) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = this._noiseSource();
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(Math.max(0.0001, vol), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.compressor);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  /** Silencia tudo (pausa). */
  setPaused(p) {
    if (!this.ctx) return;
    if (p) this.ctx.suspend().catch(() => {});
    else this.ctx.resume().catch(() => {});
  }

  stopAll() {
    for (const id of [...this.engineVoices.keys()]) this.removeEngine(id);
  }
}
