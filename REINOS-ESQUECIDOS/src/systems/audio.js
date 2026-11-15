// Áudio sintetizado com Web Audio (zero downloads). Efeitos sonoros e trilha ambiente procedural.
// Para usar arquivos reais no futuro: audio.loadFile('hit', 'audio/hit.mp3') substitui o som sintetizado.

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfxVol = 0.8;
    this.musicVol = 0.45;
    this.files = {};
    this.combat = 0;
    this.musicOn = true;
  }

  /** Precisa ser chamado num toque do usuário (política dos navegadores). */
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 1;
    this.master.connect(this.ctx.destination);
    this.sfx = this.ctx.createGain();
    this.sfx.gain.value = this.sfxVol;
    this.sfx.connect(this.master);
    this.music = this.ctx.createGain();
    this.music.gain.value = this.musicVol;
    this.music.connect(this.master);
    // reverberação simples para a música (ecos)
    this.delay = this.ctx.createDelay(1);
    this.delay.delayTime.value = 0.32;
    this.fb = this.ctx.createGain();
    this.fb.gain.value = 0.32;
    this.delay.connect(this.fb); this.fb.connect(this.delay);
    this.delay.connect(this.music);
    this.noiseBuf = this.makeNoise();
    this.startMusic();
  }

  setVolumes(sfx, music) {
    this.sfxVol = sfx; this.musicVol = music;
    if (this.sfx) this.sfx.gain.value = sfx;
    if (this.music) this.music.gain.value = music;
  }

  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend(); }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  async loadFile(name, url) {
    if (!this.ctx) return;
    try {
      const buf = await (await fetch(url)).arrayBuffer();
      this.files[name] = await this.ctx.decodeAudioData(buf);
    } catch { /* mantém o sintetizado */ }
  }

  playFile(name, vol = 1) {
    const b = this.files[name];
    if (!b) return false;
    const src = this.ctx.createBufferSource();
    src.buffer = b;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(g); g.connect(this.sfx);
    src.start();
    return true;
  }

  makeNoise() {
    const len = this.ctx.sampleRate * 1;
    const b = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  // ---------- blocos ----------
  tone(freq, dur, { type = 'sine', vol = 0.3, attack = 0.005, slide = 0, delay = 0, dest = null } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.sfx);
    o.start(t); o.stop(t + dur + 0.05);
  }

  noise(dur, { vol = 0.3, freq = 1000, q = 1, type = 'bandpass', slide = 0, attack = 0.003, delay = 0 } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (slide) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), t + dur);
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.sfx);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
  }

  // ---------- efeitos ----------
  step(surface, k) {
    if (surface === 'water') this.noise(0.12, { vol: 0.08 * k + 0.02, freq: 1800, q: 0.8 });
    else this.noise(0.07, { vol: 0.05 * k + 0.02, freq: 420 + Math.random() * 200, q: 1.2 });
  }
  swing(heavy) {
    if (this.playFile('swing')) return;
    this.noise(heavy ? 0.28 : 0.2, { vol: heavy ? 0.22 : 0.16, freq: 2400, slide: 0.35, q: 1.5, attack: 0.04 });
  }
  hit(heavy) {
    if (this.playFile('hit')) return;
    this.noise(0.12, { vol: 0.35, freq: 900, q: 0.8 });
    this.tone(heavy ? 120 : 160, 0.18, { type: 'triangle', vol: 0.3, slide: 0.5 });
    this.tone(2400 + Math.random() * 600, 0.15, { type: 'square', vol: 0.03, slide: 0.8 });
  }
  hurt() {
    this.noise(0.15, { vol: 0.3, freq: 500, q: 0.7 });
    this.tone(220, 0.25, { type: 'sawtooth', vol: 0.08, slide: 0.6 });
  }
  dodge() { this.noise(0.25, { vol: 0.12, freq: 700, slide: 0.5, attack: 0.03 }); }
  potion() {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.25, { vol: 0.08, delay: i * 0.06 }));
  }
  coin() {
    this.tone(1318, 0.12, { type: 'square', vol: 0.05 });
    this.tone(1760, 0.2, { type: 'square', vol: 0.05, delay: 0.07 });
  }
  pickup() {
    this.tone(660, 0.12, { type: 'triangle', vol: 0.12 });
    this.tone(990, 0.18, { type: 'triangle', vol: 0.12, delay: 0.08 });
  }
  chest() {
    this.noise(0.3, { vol: 0.15, freq: 300, q: 2 });
    [392, 494, 587, 784].forEach((f, i) => this.tone(f, 0.3, { type: 'triangle', vol: 0.1, delay: 0.15 + i * 0.08 }));
  }
  levelUp() {
    [392, 523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.4, { type: 'triangle', vol: 0.12, delay: i * 0.09 }));
  }
  quest() {
    [523, 659, 784].forEach((f, i) => this.tone(f, 0.5, { type: 'sine', vol: 0.13, delay: i * 0.12 }));
  }
  ui() { this.tone(880, 0.06, { type: 'triangle', vol: 0.06 }); }
  slam() {
    this.tone(60, 0.6, { type: 'sine', vol: 0.5, slide: 0.5 });
    this.noise(0.6, { vol: 0.4, freq: 250, q: 0.5, type: 'lowpass' });
  }
  bossRoar() {
    this.tone(90, 0.9, { type: 'sawtooth', vol: 0.12, slide: 0.7, attack: 0.1 });
    this.noise(0.9, { vol: 0.15, freq: 400, q: 2, slide: 0.6, attack: 0.1 });
  }
  alert(type) {
    if (type === 'lobo') this.tone(420, 0.5, { type: 'sine', vol: 0.06, slide: 1.4, attack: 0.08 });
    else if (type === 'goblin') this.tone(520, 0.2, { type: 'square', vol: 0.04, slide: 0.7 });
    else if (type === 'aranha') this.noise(0.3, { vol: 0.1, freq: 3500, q: 3 });
    else this.noise(0.25, { vol: 0.12, freq: 1500, q: 6 });
  }
  enemyAttack(type) {
    if (type === 'lobo') this.noise(0.12, { vol: 0.15, freq: 300, q: 1 });
    else this.noise(0.18, { vol: 0.12, freq: 1600, slide: 0.4, q: 1.2, attack: 0.03 });
  }
  enemyHurt(type) {
    if (type === 'lobo') this.tone(600, 0.15, { type: 'sine', vol: 0.06, slide: 1.3 });
    else if (type === 'goblin') this.tone(380, 0.15, { type: 'square', vol: 0.04, slide: 1.4 });
    else if (type === 'esqueleto' || type === 'rei') this.noise(0.1, { vol: 0.2, freq: 2500, q: 5 });
    else this.noise(0.12, { vol: 0.12, freq: 3000, q: 2 });
  }
  enemyDie(type) {
    if (type === 'lobo') this.tone(500, 0.6, { type: 'sine', vol: 0.07, slide: 0.5 });
    else if (type === 'esqueleto' || type === 'rei') {
      for (let i = 0; i < 6; i++) this.noise(0.08, { vol: 0.15, freq: 2000 + Math.random() * 1500, q: 6, delay: i * 0.06 });
    } else this.tone(300, 0.4, { type: 'sawtooth', vol: 0.05, slide: 0.4 });
  }

  // ---------- música ambiente procedural ----------
  startMusic() {
    if (!this.ctx) return;
    const scale = [146.83, 164.81, 174.61, 196, 220, 246.94, 261.63, 293.66, 329.63, 349.23, 392]; // ré dórico
    const chords = [[0, 2, 4], [3, 5, 7], [1, 3, 5], [4, 6, 8]];
    let bar = 0;
    const tick = () => {
      if (!this.ctx) return;
      if (this.musicOn && this.ctx.state === 'running') {
        const ch = chords[bar % chords.length];
        // pad
        for (const n of ch) {
          this.tone(scale[n] / 2, 4.2, { type: 'triangle', vol: 0.035, attack: 1.2, dest: this.music });
        }
        // melodia dedilhada (alaúde)
        const notes = 3 + Math.floor(Math.random() * 3);
        for (let i = 0; i < notes; i++) {
          const n = ch[Math.floor(Math.random() * 3)] + (Math.random() < 0.5 ? 0 : 2);
          const f = scale[Math.min(scale.length - 1, n + 3)];
          this.pluck(f, i * 0.75 + Math.random() * 0.1, 0.05);
        }
        // tambor quando em combate
        if (this.combat > 0.5) {
          for (let i = 0; i < 8; i++) {
            this.tone(i % 4 === 0 ? 70 : 95, 0.25, { type: 'sine', vol: i % 4 === 0 ? 0.22 : 0.1, slide: 0.5, delay: i * 0.5, dest: this.music });
          }
        }
        bar++;
      }
      this.musicTimer = setTimeout(tick, 4000);
    };
    tick();
  }

  pluck(freq, delay, vol) {
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const o2 = this.ctx.createOscillator();
    const f = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    o.type = 'sawtooth'; o2.type = 'triangle';
    o.frequency.value = freq; o2.frequency.value = freq * 2.001;
    f.type = 'lowpass';
    f.frequency.setValueAtTime(freq * 6, t);
    f.frequency.exponentialRampToValueAtTime(freq * 1.2, t + 0.8);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    o.connect(f); o2.connect(f); f.connect(g);
    g.connect(this.music); g.connect(this.delay);
    o.start(t); o2.start(t); o.stop(t + 1.7); o2.stop(t + 1.7);
  }
}
