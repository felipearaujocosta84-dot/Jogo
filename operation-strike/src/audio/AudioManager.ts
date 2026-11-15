// Áudio sintetizado com Web Audio (nenhum arquivo para baixar): tiros, passos por tipo de piso,
// pulo/aterrissagem, recarga, troca de arma, portas e vento ambiente do deserto.
// Arquivos reais podem substituir qualquer som com load('nome', 'assets/audio/arquivo.mp3').
import type { SurfaceKind } from '../physics/CollisionWorld';

type SoundName = 'dry' | 'draw' | 'door' | 'click' | 'jump';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private samples = new Map<string, AudioBuffer>();
  private ambient: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private volume = 0.8;

  /** Precisa ser chamado dentro de um gesto do usuário (toque/clique). */
  unlock(): void {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 1.5;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  suspend(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setVolume(v: number): void {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  async load(name: string, url: string): Promise<void> {
    if (!this.ctx) return;
    try {
      const res = await fetch(url);
      this.samples.set(name, await this.ctx.decodeAudioData(await res.arrayBuffer()));
    } catch {
      /* mantém o som sintetizado */
    }
  }

  private playSample(name: string, gain = 1, rate = 1): boolean {
    const buf = this.samples.get(name);
    if (!buf || !this.ctx || !this.master) return false;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(g).connect(this.master);
    src.start();
    return true;
  }

  /** Rajada de ruído filtrado com envelope (base de quase todos os sons). */
  private noise(opts: { dur: number; gain: number; type: BiquadFilterType; freq: number; q?: number; freqEnd?: number; attack?: number; delay?: number }): void {
    const { ctx, master, noiseBuf } = this;
    if (!ctx || !master || !noiseBuf) return;
    const t = ctx.currentTime + (opts.delay ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = opts.type;
    f.frequency.setValueAtTime(opts.freq, t);
    if (opts.freqEnd) f.frequency.exponentialRampToValueAtTime(opts.freqEnd, t + opts.dur);
    f.Q.value = opts.q ?? 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(opts.gain, t + (opts.attack ?? 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur);
    src.connect(f).connect(g).connect(master);
    src.start(t, Math.random() * 0.6, opts.dur + 0.05);
  }

  private tone(opts: { freq: number; freqEnd?: number; dur: number; gain: number; type?: OscillatorType; delay?: number }): void {
    const { ctx, master } = this;
    if (!ctx || !master) return;
    const t = ctx.currentTime + (opts.delay ?? 0);
    const o = ctx.createOscillator();
    o.type = opts.type ?? 'sine';
    o.frequency.setValueAtTime(opts.freq, t);
    if (opts.freqEnd) o.frequency.exponentialRampToValueAtTime(opts.freqEnd, t + opts.dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(opts.gain, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + opts.dur + 0.05);
  }

  shot(model: 'rifle' | 'pistol'): void {
    if (this.playSample('shot_' + model, 1, 0.95 + Math.random() * 0.1)) return;
    const v = 0.92 + Math.random() * 0.16;
    if (model === 'rifle') {
      this.noise({ dur: 0.16, gain: 0.9, type: 'lowpass', freq: 5200 * v, freqEnd: 500 });
      this.tone({ freq: 140 * v, freqEnd: 45, dur: 0.14, gain: 0.8, type: 'triangle' });
      this.noise({ dur: 0.5, gain: 0.12, type: 'bandpass', freq: 900, q: 0.6, delay: 0.04 }); // eco
    } else {
      this.noise({ dur: 0.12, gain: 0.75, type: 'lowpass', freq: 6500 * v, freqEnd: 800 });
      this.tone({ freq: 190 * v, freqEnd: 70, dur: 0.1, gain: 0.55, type: 'triangle' });
      this.noise({ dur: 0.35, gain: 0.08, type: 'bandpass', freq: 1200, q: 0.6, delay: 0.03 });
    }
  }

  footstep(surface: SurfaceKind): void {
    if (this.playSample('step_' + surface, 0.6, 0.9 + Math.random() * 0.2)) return;
    const v = 0.85 + Math.random() * 0.3;
    switch (surface) {
      case 'sand':
        this.noise({ dur: 0.12, gain: 0.16, type: 'bandpass', freq: 1800 * v, q: 0.7, attack: 0.015 });
        break;
      case 'metal':
        this.noise({ dur: 0.1, gain: 0.2, type: 'bandpass', freq: 2600 * v, q: 3 });
        this.tone({ freq: 420 * v, dur: 0.15, gain: 0.06, type: 'square' });
        break;
      case 'wood':
        this.tone({ freq: 160 * v, freqEnd: 90, dur: 0.08, gain: 0.22, type: 'triangle' });
        this.noise({ dur: 0.06, gain: 0.1, type: 'bandpass', freq: 900 * v, q: 1.5 });
        break;
      default:
        this.noise({ dur: 0.08, gain: 0.2, type: 'bandpass', freq: 1100 * v, q: 1.2 });
        this.tone({ freq: 95 * v, freqEnd: 60, dur: 0.07, gain: 0.15, type: 'sine' });
    }
  }

  land(impact: number, surface: SurfaceKind): void {
    const g = Math.min(0.5, 0.12 + impact * 0.03);
    this.noise({ dur: 0.14, gain: g, type: 'lowpass', freq: surface === 'metal' ? 2400 : 900 });
    this.tone({ freq: 80, freqEnd: 45, dur: 0.12, gain: g * 0.8 });
  }

  /** Sequência de recarga: pente sai, pente entra, ferrolho. */
  reload(duration: number): void {
    const click = (delay: number, freq: number, gain = 0.3) => {
      this.noise({ dur: 0.05, gain, type: 'bandpass', freq, q: 4, delay });
      this.tone({ freq: freq * 0.25, dur: 0.04, gain: gain * 0.4, type: 'square', delay });
    };
    click(duration * 0.15, 2200);
    click(duration * 0.55, 1800, 0.35);
    click(duration * 0.62, 2600, 0.25);
    click(duration * 0.82, 1500, 0.4);
    click(duration * 0.88, 2400, 0.3);
  }

  play(name: SoundName): void {
    if (this.playSample(name)) return;
    switch (name) {
      case 'dry':
        this.noise({ dur: 0.04, gain: 0.25, type: 'bandpass', freq: 3000, q: 5 });
        break;
      case 'draw':
        this.noise({ dur: 0.18, gain: 0.12, type: 'bandpass', freq: 1500, freqEnd: 3000, q: 1.5 });
        this.noise({ dur: 0.05, gain: 0.25, type: 'bandpass', freq: 2200, q: 4, delay: 0.2 });
        break;
      case 'door':
        this.noise({ dur: 0.7, gain: 0.18, type: 'bandpass', freq: 500, freqEnd: 300, q: 2, attack: 0.05 });
        this.tone({ freq: 70, dur: 0.3, gain: 0.1, type: 'sawtooth', delay: 0.5 });
        break;
      case 'click':
        this.tone({ freq: 1200, dur: 0.04, gain: 0.08, type: 'square' });
        break;
      case 'jump':
        this.noise({ dur: 0.08, gain: 0.08, type: 'bandpass', freq: 1300, q: 1 });
        break;
    }
  }

  /** Vento contínuo e suave do deserto. */
  startAmbient(): void {
    const { ctx, master, noiseBuf } = this;
    if (!ctx || !master || !noiseBuf || this.ambient) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 420;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 220;
    lfo.connect(lfoGain).connect(f.frequency);
    const gain = ctx.createGain();
    gain.gain.value = 0.07;
    src.connect(f).connect(gain).connect(master);
    src.start();
    lfo.start();
    this.ambient = { src, gain };
  }

  stopAmbient(): void {
    if (!this.ambient) return;
    try {
      this.ambient.src.stop();
    } catch {
      /* já parado */
    }
    this.ambient = null;
  }
}
