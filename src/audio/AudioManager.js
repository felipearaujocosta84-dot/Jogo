// Áudio via Web Audio API. Cada som tem uma versão sintetizada (funciona sem arquivos)
// e pode ser substituído por um arquivo real com load('kick', 'sounds/kick.mp3').

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.volume = 0.8;
    this.buffers = {};
    this.crowdGain = null;
    this.noiseBuffer = null;
  }

  /** Deve ser chamado dentro de um gesto do usuário (toque) por exigência dos navegadores. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? this.volume : 0;
      this.master.connect(this.ctx.destination);
      this.noiseBuffer = this.createNoise(2);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.master) this.master.gain.setTargetAtTime(on ? this.volume : 0, this.ctx.currentTime, 0.05);
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend();
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  /** Carrega um arquivo de áudio que passa a substituir o som sintetizado. */
  async load(name, url) {
    if (!this.ctx) return false;
    try {
      const res = await fetch(url);
      const data = await res.arrayBuffer();
      this.buffers[name] = await this.ctx.decodeAudioData(data);
      return true;
    } catch (e) {
      console.warn('[Audio] falha ao carregar', name, url, e);
      return false;
    }
  }

  playBuffer(name, gain = 1, rate = 1) {
    const b = this.buffers[name];
    if (!b) return false;
    const src = this.ctx.createBufferSource();
    src.buffer = b;
    src.playbackRate.value = rate;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(g).connect(this.master);
    src.start();
    return true;
  }

  createNoise(seconds) {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  ready() {
    return this.ctx && this.ctx.state === 'running';
  }

  noise(duration, filterType, freq, q, gain, attack = 0.005) {
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = this.ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random());
    src.stop(t + duration + 0.05);
  }

  tone(type, f0, f1, duration, gain) {
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + duration);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + duration + 0.05);
  }

  /** Chute: impacto grave + estalo. power 0..1 */
  kick(power = 0.7) {
    if (!this.ready() || this.playBuffer('kick', 0.5 + power * 0.5)) return;
    this.tone('sine', 160 + power * 40, 45, 0.18, 0.5 + power * 0.4);
    this.noise(0.06, 'bandpass', 1800, 0.8, 0.25 + power * 0.3);
  }

  pass() {
    if (!this.ready() || this.playBuffer('pass', 0.7)) return;
    this.tone('sine', 140, 60, 0.12, 0.35);
    this.noise(0.04, 'bandpass', 2200, 1, 0.12);
  }

  bounce(strength = 1) {
    if (!this.ready() || this.playBuffer('bounce', Math.min(1, strength / 8))) return;
    this.tone('sine', 110, 50, 0.1, Math.min(0.3, strength * 0.04));
  }

  wall(strength = 1) {
    if (!this.ready() || this.playBuffer('wall', Math.min(1, strength / 10))) return;
    this.noise(0.12, 'lowpass', 600, 0.7, Math.min(0.5, strength * 0.05));
    this.tone('triangle', 90, 60, 0.12, Math.min(0.25, strength * 0.03));
  }

  /** Bola na trave: metálico. */
  post(strength = 5) {
    if (!this.ready() || this.playBuffer('post', 1)) return;
    const g = Math.min(0.35, 0.08 + strength * 0.02);
    for (const f of [820, 1240, 1990, 2730]) this.tone('sine', f, f * 0.98, 0.9, g / 2);
    this.noise(0.05, 'highpass', 3000, 0.7, g);
  }

  net() {
    if (!this.ready() || this.playBuffer('net', 0.8)) return;
    this.noise(0.35, 'bandpass', 900, 0.6, 0.18, 0.02);
  }

  /** Gol: explosão da torcida + apito curto. */
  goal() {
    if (!this.ready() || this.playBuffer('goal', 1)) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1100;
    f.Q.value = 0.5;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.6, t + 0.3);
    g.gain.setValueAtTime(0.6, t + 1.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.5);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + 3.6);
    this.whistle(0.25);
  }

  whistle(duration = 0.4) {
    if (!this.ready() || this.playBuffer('whistle', 0.8)) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = 2900;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 28;
    const lfoG = this.ctx.createGain();
    lfoG.gain.value = 120;
    lfo.connect(lfoG).connect(o.frequency);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 4000;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
    g.gain.setValueAtTime(0.12, t + duration);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration + 0.05);
    o.connect(f).connect(g).connect(this.master);
    o.start(t); lfo.start(t);
    o.stop(t + duration + 0.1); lfo.stop(t + duration + 0.1);
  }

  ui() {
    if (!this.ready() || this.playBuffer('ui', 0.6)) return;
    this.tone('triangle', 880, 660, 0.07, 0.15);
  }

  /** Murmúrio contínuo da torcida. */
  startCrowd() {
    if (!this.ctx || this.crowdGain) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 650;
    f.Q.value = 0.4;
    const g = this.ctx.createGain();
    g.gain.value = 0.05;
    // leve oscilação de volume
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.13;
    const lfoG = this.ctx.createGain();
    lfoG.gain.value = 0.015;
    lfo.connect(lfoG).connect(g.gain);
    src.connect(f).connect(g).connect(this.master);
    src.start();
    lfo.start();
    this.crowdGain = g;
  }
}
