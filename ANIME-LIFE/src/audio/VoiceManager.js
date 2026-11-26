// Voz das falas.
// - Gravada: se existir um arquivo em public/assets/voices (manifest.json), ele é tocado e marcado "voz gravada".
// - Sintetizada (TTS): Web Speech API no navegador; plugin nativo @capacitor-community/text-to-speech no Android
//   (o WebView do Android não tem Web Speech). É SEMPRE indicada como "voz sintetizada" — não é dublagem.
// Cada personagem tem um perfil (tom, velocidade, voz escolhida) e a emoção da fala muda a entonação.
// As frases são faladas em partes, com pausas nas reticências e no fim das frases; a boca acompanha cada parte.
import { settings } from '../save/Settings.js';
import { asset } from '../core/assets.js';

/** Perfil base (tom e ritmo combinam com a personalidade descrita em characters.json). */
export const PROFILES = {
  character_01: { pitch: 1.12, rate: 0.94, gender: 'f', note: 'Rin: calma, fala baixo e devagar' },
  character_02: { pitch: 1.3, rate: 1.06, gender: 'f', note: 'Mei: doce, um pouco ansiosa' },
  character_06: { pitch: 1.0, rate: 0.96, gender: 'f', note: 'Akane: firme, cansada' },
  character_07: { pitch: 0.98, rate: 1.14, gender: 'm', note: 'Kaito: animado, rápido' },
  character_08: { pitch: 1.12, rate: 1.04, gender: 'm', note: 'Haru: jovem, tímido' },
  character_09: { pitch: 0.8, rate: 0.88, gender: 'm', note: 'Sora: calmo, sem pressa' },
  character_10: { pitch: 0.74, rate: 0.9, gender: 'm', note: 'Kyo: grave, seco' },
};
const DEFAULT = { pitch: 1, rate: 1, gender: 'f' };
/** Entonação por emoção: [tom, velocidade] somados ao perfil. */
export const INTONATION = {
  happy: [0.1, 0.05], smile: [0.05, 0], laugh: [0.16, 0.1], sad: [-0.1, -0.12], very_sad: [-0.14, -0.18], crying: [-0.12, -0.2],
  hurt: [-0.08, -0.1], angry: [-0.05, 0.12], annoyed: [-0.04, 0.06], surprised: [0.16, 0.08], scared: [0.12, 0.16],
  nervous: [0.08, 0.12], confused: [0.06, -0.04], embarrassed: [0.06, -0.04], shy: [0.05, -0.08], love: [0.03, -0.1],
  serious: [-0.08, -0.05], jealous: [-0.03, 0.04], curious: [0.07, 0], lookaway: [0, -0.05],
};
const FEMALE = /female|femin|mulher|luciana|francisca|maria|vit[oó]ria|camila|helena|let[ií]cia|joana|fernanda|raquel|thalita|brenda|elza|giovanna|yara/i;
const MALE = /\bmale\b|mascul|homem|daniel|ant[oô]nio|felipe|ricardo|duarte|fabio|humberto|donato|julio|nicolau|valerio/i;
const CPS = 14; // caracteres por segundo da fala em pt-BR na velocidade 1

const clean = (t) => String(t).replace(/[\u{1F300}-\u{1FAFF}☀-➿♡♪]/gu, '').replace(/\s+/g, ' ').trim();
/** Divide em partes faladas, guardando a pausa depois de cada uma. */
export function chunks(text) {
  const out = [];
  const re = /[^.!?…]+(?:\.\.\.|…|[.!?]+)?/g;
  let m;
  while ((m = re.exec(clean(text)))) {
    const s = m[0].trim(); if (!s || !/[\p{L}\p{N}]/u.test(s)) continue;
    const pause = /(\.\.\.|…)$/.test(s) ? 520 : /[.!?]$/.test(s) ? 220 : 120;
    out.push({ text: s, pause });
  }
  return out;
}

class VoiceManager {
  constructor() { this.voices = []; this.token = 0; this.native = null; this.manifest = null; this.mode = 'none'; }

  async init() {
    try { this.manifest = await fetch(asset('voices/manifest.json')).then((r) => (r.ok ? r.json() : {})); } catch { this.manifest = {}; }
    const cap = globalThis.Capacitor;
    if (cap?.isNativePlatform?.()) {
      try {
        const { TextToSpeech } = await import('@capacitor-community/text-to-speech');
        this.native = TextToSpeech;
        const { voices } = await TextToSpeech.getSupportedVoices();
        this.voices = voices.map((v, i) => ({ id: String(i), name: v.name, lang: v.lang, index: i })).filter((v) => /^pt/i.test(v.lang));
        if (!this.voices.length) this.voices = voices.map((v, i) => ({ id: String(i), name: v.name, lang: v.lang, index: i })).slice(0, 20);
        this.mode = 'native';
      } catch (e) { console.warn('[Voz] plugin nativo indisponível', e); }
    }
    if (this.mode === 'none' && globalThis.speechSynthesis) {
      this.mode = 'web';
      const load = () => {
        const all = speechSynthesis.getVoices();
        const pt = all.filter((v) => /^pt/i.test(v.lang));
        this.voices = (pt.length ? pt : all).map((v) => ({ id: v.voiceURI, name: v.name, lang: v.lang, ref: v }));
      };
      load(); speechSynthesis.addEventListener?.('voiceschanged', load);
    }
    return this.mode;
  }

  get available() { return this.mode !== 'none'; }
  get on() { return settings.data.voice !== false; }

  /** Voz escolhida para o personagem: a do jogador nos Ajustes ou uma automática (gênero + variedade). */
  voiceFor(id) {
    const chosen = settings.data.voices?.[id];
    if (chosen) { const v = this.voices.find((x) => x.id === chosen); if (v) return v; }
    if (!this.voices.length) return null;
    const p = PROFILES[id] || DEFAULT;
    const pool = this.voices.filter((v) => (p.gender === 'm' ? MALE : FEMALE).test(v.name));
    const list = pool.length ? pool : this.voices;
    const ids = Object.keys(PROFILES).filter((k) => (PROFILES[k].gender === p.gender));
    return list[Math.max(0, ids.indexOf(id)) % list.length];
  }

  params(id, emotion) {
    const p = PROFILES[id] || DEFAULT;
    const [dp, dr] = INTONATION[emotion] || [0, 0];
    const custom = settings.data.voiceTune?.[id] || {};
    return { pitch: Math.max(0.1, Math.min(2, (custom.pitch ?? p.pitch) + dp)), rate: Math.max(0.5, Math.min(1.8, (custom.rate ?? p.rate) + dr)), volume: settings.data.voiceVolume ?? 0.9 };
  }

  recorded(key) { return key && this.manifest?.[key] ? asset(`voices/${this.manifest[key]}`) : null; }

  /**
   * Fala uma linha. Devolve { kind: 'synth'|'recorded', msPerChar, done } ou null (voz desligada/indisponível).
   * onChunk(texto, msPerChar) é chamado no início de cada parte (para a boca); onEnd no fim.
   */
  say(meta, text, { onChunk, onEnd } = {}) {
    if (!this.on || !meta) return null;
    const rec = this.recorded(meta.key);
    if (!rec && !this.available) return null;
    this.stop();
    const token = ++this.token;
    const alive = () => token === this.token;
    if (rec) return this.playRecorded(rec, text, { onChunk, onEnd, alive });
    const parts = chunks(text);
    if (!parts.length) return null;
    const pr = this.params(meta.id, meta.emotion);
    const msPerChar = 1000 / (CPS * pr.rate);
    const v = this.voiceFor(meta.id);
    const done = (async () => {
      for (const part of parts) {
        if (!alive()) return;
        onChunk?.(part.text, msPerChar);
        const est = part.text.length * msPerChar;
        await Promise.race([this.speakPart(part.text, pr, v), new Promise((r) => setTimeout(r, est * 1.8 + 900))]);
        if (!alive()) return;
        await new Promise((r) => setTimeout(r, part.pause));
      }
      if (alive()) onEnd?.();
    })();
    this.current = { kind: 'synth', msPerChar, done, voiceName: v?.name || 'padrão do aparelho' };
    return this.current;
  }

  speakPart(text, pr, v) {
    if (this.mode === 'native') {
      return this.native.speak({ text, lang: v?.lang || 'pt-BR', rate: pr.rate, pitch: pr.pitch, volume: pr.volume, voice: v?.index, category: 'playback' }).catch(() => {});
    }
    return new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = v?.lang || 'pt-BR'; if (v?.ref) u.voice = v.ref;
      u.pitch = pr.pitch; u.rate = pr.rate; u.volume = pr.volume;
      u.onend = resolve; u.onerror = resolve;
      speechSynthesis.speak(u);
    });
  }

  playRecorded(url, text, { onChunk, onEnd, alive }) {
    const a = new Audio(url);
    a.volume = settings.data.voiceVolume ?? 0.9;
    this.audioEl = a;
    let msPerChar = 60;
    const done = new Promise((resolve) => {
      a.onloadedmetadata = () => { msPerChar = (a.duration * 1000) / Math.max(1, clean(text).length); if (alive()) onChunk?.(clean(text), msPerChar); };
      a.onended = () => { if (alive()) onEnd?.(); resolve(); };
      a.onerror = () => resolve();
      a.play().catch(() => resolve());
    });
    this.current = { kind: 'recorded', get msPerChar() { return msPerChar; }, done };
    return this.current;
  }

  stop() {
    this.token++;
    this.current = null;
    if (this.audioEl) { this.audioEl.pause(); this.audioEl = null; }
    if (this.mode === 'web') speechSynthesis.cancel();
    if (this.mode === 'native') this.native.stop().catch(() => {});
  }

  /** Ajustes → "Testar" voz de um personagem. */
  test(id, line = 'Oi. Essa é a minha voz sintetizada.') {
    const was = settings.data.voice; settings.data.voice = true;
    const r = this.say({ id, emotion: 'neutral' }, line); settings.data.voice = was; return r;
  }
}

export const voice = new VoiceManager();
