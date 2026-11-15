// Áudio sintetizado com Web Audio (nenhum arquivo para baixar): tiros, passos por tipo de piso,
// pulo/aterrissagem, recarga, troca de arma, portas e vento ambiente do deserto.
// Arquivos reais podem substituir qualquer som com load('nome', 'assets/audio/arquivo.mp3').
import type { SurfaceKind } from '../physics/CollisionWorld';

type SoundName = 'dry' | 'draw' | 'door' | 'click' | 'jump' | 'pickup' | 'error';

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
  private noise(opts: { dur: number; gain: number; type: BiquadFilterType; freq: number; q?: number; freqEnd?: number; attack?: number; delay?: number; dest?: AudioNode }): void {
    const { ctx, noiseBuf } = this;
    const master = opts.dest ?? this.master;
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

  private tone(opts: { freq: number; freqEnd?: number; dur: number; gain: number; type?: OscillatorType; delay?: number; dest?: AudioNode }): void {
    const { ctx } = this;
    const master = opts.dest ?? this.master;
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

  // ------------------------------------------------------------ áudio espacial
  private listener = { x: 0, y: 0, z: 0, yaw: 0 };

  setListener(x: number, y: number, z: number, yaw: number): void {
    this.listener = { x, y, z, yaw };
  }

  /** Nó de saída com volume pela distância e direção estéreo. null = longe demais. */
  private spatial(pos: { x: number; y: number; z: number } | null, range = 60): AudioNode | null {
    const { ctx, master } = this;
    if (!ctx || !master) return null;
    if (!pos) return master;
    const l = this.listener;
    const dx = pos.x - l.x, dz = pos.z - l.z, dy = pos.y - l.y;
    const d = Math.hypot(dx, dy, dz);
    if (d > range) return null;
    const g = ctx.createGain();
    g.gain.value = Math.max(0, 1 / (1 + d * 0.12)) * (1 - d / range);
    const right = dx * Math.cos(l.yaw) - dz * Math.sin(l.yaw);
    let node: AudioNode = g;
    if (ctx.createStereoPanner) {
      const pan = ctx.createStereoPanner();
      pan.pan.value = Math.max(-0.9, Math.min(0.9, right / Math.max(1, d)));
      g.connect(pan).connect(master);
    } else g.connect(master);
    // som atrás fica um pouco abafado
    const fwd = dx * Math.sin(l.yaw) + dz * Math.cos(l.yaw);
    if (fwd < 0 && d > 3) g.gain.value *= 0.75;
    return node;
  }

  /** Tiro: pos = null para a própria arma. */
  shot(kind: string, pos: { x: number; y: number; z: number } | null = null): void {
    const dest = this.spatial(pos, 110);
    if (!dest) return;
    if (!pos && this.playSample('shot_' + kind, 1, 0.95 + Math.random() * 0.1)) return;
    const v = 0.92 + Math.random() * 0.16;
    const far = pos ? Math.hypot(pos.x - this.listener.x, pos.z - this.listener.z) : 0;
    const muffle = far > 25 ? 0.4 : 1;
    switch (kind) {
      case 'silenced':
        this.noise({ dur: 0.08, gain: 0.35, type: 'bandpass', freq: 2200 * v, q: 0.8, dest });
        this.tone({ freq: 220 * v, freqEnd: 90, dur: 0.06, gain: 0.25, type: 'triangle', dest });
        break;
      case 'sniper':
        this.noise({ dur: 0.3, gain: 1, type: 'lowpass', freq: 4200 * v * muffle, freqEnd: 300, dest });
        this.tone({ freq: 95 * v, freqEnd: 32, dur: 0.3, gain: 1, type: 'triangle', dest });
        this.noise({ dur: 0.9, gain: 0.18, type: 'bandpass', freq: 700, q: 0.5, delay: 0.06, dest });
        break;
      case 'heavy':
        this.noise({ dur: 0.2, gain: 0.9, type: 'lowpass', freq: 5000 * v * muffle, freqEnd: 400, dest });
        this.tone({ freq: 120 * v, freqEnd: 40, dur: 0.18, gain: 0.85, type: 'triangle', dest });
        this.noise({ dur: 0.5, gain: 0.12, type: 'bandpass', freq: 900, q: 0.6, delay: 0.04, dest });
        break;
      case 'smg':
        this.noise({ dur: 0.1, gain: 0.7, type: 'lowpass', freq: 6000 * v * muffle, freqEnd: 700, dest });
        this.tone({ freq: 170 * v, freqEnd: 60, dur: 0.08, gain: 0.5, type: 'triangle', dest });
        break;
      case 'pistol':
        this.noise({ dur: 0.12, gain: 0.75, type: 'lowpass', freq: 6500 * v * muffle, freqEnd: 800, dest });
        this.tone({ freq: 190 * v, freqEnd: 70, dur: 0.1, gain: 0.55, type: 'triangle', dest });
        this.noise({ dur: 0.35, gain: 0.08, type: 'bandpass', freq: 1200, q: 0.6, delay: 0.03, dest });
        break;
      case 'knife':
        this.noise({ dur: 0.18, gain: 0.25, type: 'bandpass', freq: 2500, freqEnd: 900, q: 1.2, dest });
        break;
      default:
        this.noise({ dur: 0.16, gain: 0.9, type: 'lowpass', freq: 5200 * v * muffle, freqEnd: 500, dest });
        this.tone({ freq: 140 * v, freqEnd: 45, dur: 0.14, gain: 0.8, type: 'triangle', dest });
        this.noise({ dur: 0.5, gain: 0.12, type: 'bandpass', freq: 900, q: 0.6, delay: 0.04, dest });
    }
  }

  footstep(surface: SurfaceKind, pos: { x: number; y: number; z: number } | null = null): void {
    const dest = this.spatial(pos, 28);
    if (!dest) return;
    if (!pos && this.playSample('step_' + surface, 0.6, 0.9 + Math.random() * 0.2)) return;
    const v = 0.85 + Math.random() * 0.3;
    const k = pos ? 1.6 : 1; // passos dos outros um pouco mais altos (informação tática)
    switch (surface) {
      case 'sand':
        this.noise({ dur: 0.12, gain: 0.16 * k, type: 'bandpass', freq: 1800 * v, q: 0.7, attack: 0.015, dest });
        break;
      case 'metal':
        this.noise({ dur: 0.1, gain: 0.2 * k, type: 'bandpass', freq: 2600 * v, q: 3, dest });
        this.tone({ freq: 420 * v, dur: 0.15, gain: 0.06 * k, type: 'square', dest });
        break;
      case 'wood':
        this.tone({ freq: 160 * v, freqEnd: 90, dur: 0.08, gain: 0.22 * k, type: 'triangle', dest });
        this.noise({ dur: 0.06, gain: 0.1 * k, type: 'bandpass', freq: 900 * v, q: 1.5, dest });
        break;
      default:
        this.noise({ dur: 0.08, gain: 0.2 * k, type: 'bandpass', freq: 1100 * v, q: 1.2, dest });
        this.tone({ freq: 95 * v, freqEnd: 60, dur: 0.07, gain: 0.15 * k, type: 'sine', dest });
    }
  }

  explosion(pos: { x: number; y: number; z: number }, big = false): void {
    const dest = this.spatial(pos, big ? 200 : 120);
    if (!dest) return;
    this.noise({ dur: big ? 2.2 : 1.2, gain: 1, type: 'lowpass', freq: big ? 1800 : 2600, freqEnd: 80, dest });
    this.tone({ freq: big ? 60 : 80, freqEnd: 20, dur: big ? 1.6 : 0.8, gain: 1, type: 'sine', dest });
  }

  flashbang(pos: { x: number; y: number; z: number }, blinded: number): void {
    const dest = this.spatial(pos, 80);
    if (dest) this.noise({ dur: 0.25, gain: 0.9, type: 'highpass', freq: 1500, dest });
    if (blinded > 0.3) this.tone({ freq: 3400, dur: blinded * 1.5, gain: 0.08 * blinded, type: 'sine' }); // zumbido
  }

  bounce(pos: { x: number; y: number; z: number }): void {
    const dest = this.spatial(pos, 30);
    if (dest) this.tone({ freq: 600 + Math.random() * 300, freqEnd: 300, dur: 0.06, gain: 0.25, type: 'triangle', dest });
  }

  smokePop(pos: { x: number; y: number; z: number }): void {
    const dest = this.spatial(pos, 60);
    if (dest) this.noise({ dur: 2.5, gain: 0.3, type: 'bandpass', freq: 1400, freqEnd: 500, q: 0.4, attack: 0.05, dest });
  }

  beep(pos: { x: number; y: number; z: number }, urgent: boolean): void {
    const dest = this.spatial(pos, 70);
    if (dest) this.tone({ freq: urgent ? 1900 : 1700, dur: 0.09, gain: 0.35, type: 'square', dest });
  }

  plantTick(): void {
    this.tone({ freq: 1200 + Math.random() * 600, dur: 0.05, gain: 0.12, type: 'square' });
  }

  hitmarker(head: boolean): void {
    this.tone({ freq: head ? 1800 : 1200, dur: 0.05, gain: head ? 0.25 : 0.15, type: 'triangle' });
    if (head) this.noise({ dur: 0.05, gain: 0.2, type: 'highpass', freq: 3000 });
  }

  hurt(): void {
    this.noise({ dur: 0.15, gain: 0.35, type: 'lowpass', freq: 700 });
    this.tone({ freq: 160, freqEnd: 90, dur: 0.12, gain: 0.2, type: 'sine' });
  }

  stinger(win: boolean): void {
    const notes = win ? [523, 659, 784] : [392, 330, 262];
    notes.forEach((f, i) => this.tone({ freq: f, dur: 0.35, gain: 0.15, type: 'triangle', delay: i * 0.14 }));
  }

  buy(): void {
    this.tone({ freq: 880, dur: 0.06, gain: 0.12, type: 'square' });
    this.tone({ freq: 1320, dur: 0.08, gain: 0.1, type: 'square', delay: 0.06 });
  }

  defuseTick(): void {
    this.noise({ dur: 0.04, gain: 0.15, type: 'bandpass', freq: 3500, q: 6 });
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
      case 'pickup':
        this.noise({ dur: 0.08, gain: 0.2, type: 'bandpass', freq: 2000, q: 3 });
        break;
      case 'error':
        this.tone({ freq: 220, dur: 0.15, gain: 0.15, type: 'square' });
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
