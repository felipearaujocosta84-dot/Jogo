// Áudio 100% sintetizado (Web Audio): sem arquivos para baixar.
// Música ambiente "lo-fi" gerada em tempo real + efeitos curtos de interface.
// Para trocar por arquivos reais no futuro, use playFile('assets/audio/xxx.mp3').
import { settings } from '../save/Settings.js';

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

// Progressões (acordes em MIDI) e melodias por "tema"
const THEMES = {
  menu: {
    bpm: 72,
    chords: [[57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65], [52, 55, 59, 62]], // Am7 Fmaj7 G7 Em7
    melody: [76, null, 74, 72, null, 69, 71, null, 72, null, 74, 76, 79, null, 76, null],
  },
  cafe: {
    bpm: 84,
    chords: [[50, 53, 57, 60], [55, 59, 62, 65], [48, 52, 55, 59], [45, 48, 52, 55]], // Dm7 G7 Cmaj7 Am7
    melody: [69, 72, 74, null, 72, null, 69, 67, 65, null, 67, 69, null, 72, null, null],
  },
  noite: {
    bpm: 56,
    chords: [[52, 55, 59, 62], [48, 52, 55, 59], [53, 57, 60, 64], [55, 59, 62, 66]], // Em7 Cmaj7 Fmaj7 G
    melody: [71, null, null, 67, null, null, 69, null, 64, null, null, null, 67, null, 66, null],
  },
  home: {
    bpm: 66,
    chords: [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [55, 59, 62, 65]], // Fmaj7 Em7 Dm7 G7
    melody: [72, null, null, 74, 76, null, 74, null, 72, null, 69, null, 67, null, null, null],
  },
};

class AudioManager {
  constructor() {
    this.ctx = null;
    this.theme = null;
    this.timer = null;
    this.step = 0;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination);
      this.musicBus = this.ctx.createGain(); this.musicBus.connect(this.master);
      this.sfxBus = this.ctx.createGain(); this.sfxBus.connect(this.master);
      // filtro passa-baixa dá o "calor" lo-fi
      this.lp = this.ctx.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 1800;
      this.lp.connect(this.musicBus);
      this.applyVolumes();
      document.addEventListener('visibilitychange', () => {
        if (!this.ctx) return;
        if (document.hidden) this.ctx.suspend(); else this.ctx.resume();
      });
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  applyVolumes() {
    if (!this.ctx) return;
    this.musicBus.gain.value = settings.data.music * 0.5;
    this.sfxBus.gain.value = settings.data.sfx * 0.7;
  }

  playMusic(name) {
    if (!this.ctx || this.theme === name) return;
    this.stopMusic();
    this.theme = name;
    const th = THEMES[name];
    const stepDur = 60 / th.bpm / 2; // colcheias
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.1;
    const tick = () => {
      if (!this.ctx) return;
      while (this.nextTime < this.ctx.currentTime + 0.25) {
        this.scheduleStep(th, this.step, this.nextTime, stepDur);
        this.step++; this.nextTime += stepDur;
      }
    };
    tick();
    this.timer = setInterval(tick, 90);
  }

  stopMusic() {
    clearInterval(this.timer); this.timer = null; this.theme = null;
  }

  scheduleStep(th, step, t, dur) {
    const bar = Math.floor(step / 8) % th.chords.length;
    if (step % 8 === 0) { // acorde (pad) a cada compasso
      th.chords[bar].forEach((n, i) => this.pad(midi(n), t, dur * 8, 0.05 - i * 0.006));
      this.bass(midi(th.chords[bar][0] - 12), t, dur * 3);
    }
    if (step % 8 === 4) this.bass(midi(th.chords[bar][0] - 12), t, dur * 2, 0.6);
    const m = th.melody[step % th.melody.length];
    if (m && (Math.floor(step / th.melody.length) % 2 === 0 || step % 3 !== 0)) this.pluck(midi(m), t, dur * 2.5);
    if (step % 2 === 1) this.hat(t);
  }

  env(g, t, a, peak, d) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  pad(f, t, d, v) {
    const c = this.ctx, o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain();
    o.type = 'triangle'; o2.type = 'sine'; o.frequency.value = f; o2.frequency.value = f * 1.003;
    o.connect(g); o2.connect(g); g.connect(this.lp);
    this.env(g, t, 0.6, v, d);
    o.start(t); o2.start(t); o.stop(t + d + 0.8); o2.stop(t + d + 0.8);
  }

  bass(f, t, d, k = 1) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.value = f; o.connect(g); g.connect(this.lp);
    this.env(g, t, 0.02, 0.16 * k, d);
    o.start(t); o.stop(t + d + 0.1);
  }

  pluck(f, t, d) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.value = f; o.connect(g); g.connect(this.lp);
    this.env(g, t, 0.01, 0.07, d);
    o.start(t); o.stop(t + d + 0.1);
  }

  hat(t) {
    const c = this.ctx;
    if (!this.noise) {
      const b = c.createBuffer(1, c.sampleRate * 0.05, c.sampleRate);
      const ch = b.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
      this.noise = b;
    }
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; f.type = 'highpass'; f.frequency.value = 7000;
    s.connect(f); f.connect(g); g.connect(this.musicBus);
    this.env(g, t, 0.002, 0.012, 0.04);
    s.start(t);
  }

  // ---------- efeitos ----------
  sfx(name) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const tone = (f, d, type = 'sine', v = 0.2, at = 0, slide = 0) => {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t + at);
      if (slide) o.frequency.exponentialRampToValueAtTime(f * slide, t + at + d);
      o.connect(g); g.connect(this.sfxBus);
      this.env(g, t + at, 0.005, v, d);
      o.start(t + at); o.stop(t + at + d + 0.05);
    };
    switch (name) {
      case 'click': tone(880, 0.06, 'triangle', 0.15); break;
      case 'confirm': tone(660, 0.08, 'triangle', 0.15); tone(990, 0.12, 'triangle', 0.15, 0.07); break;
      case 'back': tone(520, 0.08, 'triangle', 0.12, 0, 0.7); break;
      case 'blip': tone(1100 + Math.random() * 120, 0.025, 'square', 0.025); break;
      case 'interact': tone(740, 0.07, 'sine', 0.18); tone(1110, 0.1, 'sine', 0.14, 0.05); break;
      case 'open': tone(400, 0.12, 'sine', 0.15, 0, 1.8); break;
      case 'close': tone(700, 0.12, 'sine', 0.12, 0, 0.55); break;
      case 'step': tone(140 + Math.random() * 30, 0.03, 'triangle', 0.05); break;
      case 'bump': tone(110, 0.06, 'sine', 0.12, 0, 0.7); break;
      case 'sparkle': [0, 0.06, 0.12].forEach((a, i) => tone(1320 * (1 + i * 0.25), 0.15, 'sine', 0.08, a)); break;
      case 'sleep': [523, 440, 349].forEach((f, i) => tone(f, 0.5, 'sine', 0.12, i * 0.25)); break;
      case 'door': tone(180, 0.15, 'square', 0.04); tone(120, 0.2, 'triangle', 0.1, 0.05); break;
    }
  }
}
export const audio = new AudioManager();
