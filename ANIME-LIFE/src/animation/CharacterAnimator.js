// Dá vida a um personagem 2D: piscar, boca acompanhando a fala, cabeça, respiração, cabelo,
// expressões (olhos, rubor, postura da cabeça) e foco. Atualiza os uniforms do LivingSprite.
import { buildTimeline, sample } from '../cinematic/LipSync.js';

const pct = (v) => v / 100;
// comportamento de cada emoção: olhos (squint: + fecha / - arregala), rubor, cabeça (x, y), velocidade de respiração
const EMO = {
  neutral: { squint: 0, blush: 0, head: [0, 0], breath: 1 },
  happy: { squint: 0.38, blush: 0.15, head: [0, -0.001], breath: 1.1 },
  shy: { squint: 0.22, blush: 0.9, head: [0.0035, 0.0045], breath: 1.1 },
  embarrassed: { squint: 0.15, blush: 1, head: [0.006, 0.003], breath: 1.25 },
  sad: { squint: 0.18, blush: 0, head: [0, 0.006], breath: 0.8 },
  hurt: { squint: 0.12, blush: 0, head: [-0.002, 0.005], breath: 0.9 },
  angry: { squint: 0.5, blush: 0, head: [0, 0.002], breath: 1.4 },
  surprised: { squint: -1, blush: 0, head: [0, -0.005], breath: 1.5 },
  love: { squint: 0.32, blush: 1, head: [0.002, 0.002], breath: 0.95 },
  lookaway: { squint: 0.1, blush: 0.35, head: [0.008, 0.002], breath: 1 },
  curious: { squint: -0.35, blush: 0, head: [0.002, -0.002], breath: 1 },
  serious: { squint: 0.2, blush: 0, head: [0, 0.001], breath: 0.9 },
};
const MOUTH = { aa: 1, oh: 0.85, ee: 0.6, ou: 0.5, ih: 0.45 };

export class CharacterAnimator {
  /** sprite: LivingSprite · data: entrada de characters.json · side: -1 (à esquerda da tela) | 1 */
  constructor(sprite, data, { side = 1 } = {}) {
    this.s = sprite; this.data = data; this.side = side;
    const rig = data.rig;
    const [L, R] = rig.eyes;
    this.set4('uEyeL', L ? [pct(L[0]), pct(L[1]), pct(L[2]), pct(L[3])] : [0, 0, 0, 0]);
    this.set4('uEyeR', R ? [pct(R[0]), pct(R[1]), pct(R[2]), pct(R[3])] : [0, 0, 0, 0]);
    sprite.setUniform('uMouth.value.x', pct(rig.mouth[0])); sprite.setUniform('uMouth.value.y', pct(rig.mouth[1])); sprite.setUniform('uMouth.value.z', pct(rig.mouth[2]));
    const [fx, fy] = data.face;
    this.set4('uHead', [pct(fx), pct(fy) - 0.01, 0.06, 0.05]);
    sprite.setUniform('uWaist.value', pct(fy) + 0.3);
    this.hairAmp = [0, 0, 0];
    (rig.hair || []).slice(0, 3).forEach((z, i) => { this.set4(`uHair${i}`, z.slice(0, 4).map(pct)); this.hairAmp[i] = (z[4] ?? 1) * 0.0045; });
    this.t = Math.random() * 20;
    this.blinkT = 1 + Math.random() * 3; this.blinkPhase = -1;
    this.emotion = 'neutral'; this.emoAge = 0;
    this.cur = { squint: 0, blush: 0, hx: 0, hy: 0, mouth: 0, wind: 1 };
    this.speech = null;
    this.level = 'completa';
  }

  set4(name, v) { ['x', 'y', 'z', 'w'].forEach((k, i) => this.s.setUniform(`${name}.value.${k}`, v[i])); }

  setEmotion(name) {
    if (!EMO[name]) name = 'neutral';
    if (name !== this.emotion) { this.emotion = name; this.emoAge = 0; if (name === 'surprised') this.gust = 1; }
  }
  /** Gestos curtos por cima da animação contínua. */
  gesture(name) {
    if (name === 'close_eyes') { this.eyesHold = 0.85; return; }
    if (name === 'open_eyes') { this.eyesHold = null; return; }
    this.gest = { name, t: 0 };
  }

  speak(text, msPerChar) { this.speech = { tl: buildTimeline(text, msPerChar), t: 0 }; }
  stopSpeaking() { this.speech = null; }

  update(dt) {
    if (this.level === 'freeze') return; // usado por testes para inspecionar um estado fixo
    if (this.level === 'off') { this.apply({ blink: 0, squint: 0, mouth: 0, hx: 0, hy: 0, breath: 0, wind: 0, blush: this.cur.blush }); return; }
    this.t += dt; this.emoAge += dt;
    const e = EMO[this.emotion];
    const k = (rate) => 1 - Math.exp(-rate * dt);
    // piscar (natural: intervalo aleatório, às vezes duplo; não pisca no susto)
    this.blinkT -= dt;
    if (this.blinkT <= 0 && this.blinkPhase < 0 && !(this.emotion === 'surprised' && this.emoAge < 0.8)) {
      this.blinkPhase = 0;
      this.blinkT = (this.emotion === 'embarrassed' || this.emotion === 'shy' ? 1.4 : 2.4) + Math.random() * 3.6;
      if (Math.random() < 0.18) this.blinkT = 0.28;
    }
    let blink = 0;
    if (this.blinkPhase >= 0) { this.blinkPhase += dt / 0.15; blink = Math.sin(Math.min(1, this.blinkPhase) * Math.PI); if (this.blinkPhase >= 1) this.blinkPhase = -1; }
    // boca
    let open = 0;
    if (this.speech) {
      this.speech.t += dt * 1000;
      const v = sample(this.speech.tl, this.speech.t);
      for (const [key, w] of Object.entries(MOUTH)) open = Math.max(open, v[key] * w);
      if (this.speech.t > this.speech.tl.duration + 150) this.speech = null;
    }
    this.cur.mouth += (open - this.cur.mouth) * k(24);
    // cabeça: micro-movimento + aceno ao falar + inclinação da emoção (olha para o lado do outro personagem)
    const talking = this.speech ? 1 : 0;
    const tx = Math.sin(this.t * 0.55) * 0.0022 + Math.sin(this.t * 1.7) * 0.0008 + e.head[0] * this.side;
    const ty = Math.sin(this.t * 0.8 + 1) * 0.0016 + talking * Math.sin(this.t * 6.2) * 0.0018 + e.head[1];
    this.cur.hx += (tx - this.cur.hx) * k(3.5); this.cur.hy += (ty - this.cur.hy) * k(3.5);
    // gestos (assentir, negar, suspirar, virar o rosto)
    let gx = 0, gy = 0, gb = 0;
    if (this.gest) {
      const g = this.gest; g.t += dt;
      const fade = Math.max(0, 1 - g.t / 1.1);
      if (g.name === 'nod') gy = Math.sin(g.t * 14) * 0.004 * fade;
      if (g.name === 'shake') gx = Math.sin(g.t * 16) * 0.005 * fade;
      if (g.name === 'sigh') gb = Math.sin(Math.min(1, g.t / 1.4) * Math.PI) * 0.006;
      if (g.name === 'turn') gx = 0.009 * this.side * Math.min(1, g.t * 3) * (g.t < 2.5 ? 1 : Math.max(0, 1 - (g.t - 2.5)));
      if (g.t > 3.5) this.gest = null;
    }
    // olhos e rubor (olhos fechados num beijo/abraço: eyesHold)
    const sq = this.eyesHold != null ? this.eyesHold : e.squint;
    this.cur.squint += (sq - this.cur.squint) * k(this.eyesHold != null ? 3 : 6);
    this.cur.blush += (e.blush - this.cur.blush) * k(2.5);
    // vento no cabelo: base + rajada quando a emoção muda bruscamente
    this.gust = Math.max(0, (this.gust || 0) - dt * 0.8);
    const wind = this.level === 'leve' ? 0 : 1 + this.gust * 2.5;
    this.cur.wind += (wind - this.cur.wind) * k(3);
    const breath = Math.sin(this.t * Math.PI * 2 / 4.2 * e.breath) * 0.0019 + gb;
    this.apply({ blink, squint: this.cur.squint, mouth: this.cur.mouth, hx: this.cur.hx + gx, hy: this.cur.hy + gy, breath, wind: this.cur.wind, blush: this.cur.blush });
  }

  apply(u) {
    const s = this.s;
    s.setUniform('uBlink.value', u.blink); s.setUniform('uSquint.value', u.squint);
    s.setUniform('uMouthOpen.value', u.mouth);
    s.setUniform('uHeadOffset.value.x', u.hx); s.setUniform('uHeadOffset.value.y', u.hy);
    s.setUniform('uBreath.value', u.breath); s.setUniform('uWind.value', u.wind); s.setUniform('uTime.value', this.t);
    s.setUniform('uBlush.value', u.blush);
    s.setUniform('uHairAmp.value.x', this.hairAmp[0]); s.setUniform('uHairAmp.value.y', this.hairAmp[1]); s.setUniform('uHairAmp.value.z', this.hairAmp[2]);
  }

  /** Estado atual (para testes e depuração). */
  snapshot() { return { emotion: this.emotion, mouth: +this.cur.mouth.toFixed(3), squint: +this.cur.squint.toFixed(3), blush: +this.cur.blush.toFixed(3), blinking: this.blinkPhase >= 0 }; }
}
