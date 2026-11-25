// Intérprete da história: percorre capítulos → cenas → passos, conversa com o palco (Phaser),
// a interface (diálogo, escolhas, celular) e salva a posição EXATA a cada passo exibido.
//
// Passos de uma cena (ver src/story/chapters/*.js):
//   { label:'x' }  { go:'x' }  { if:(c)=>bool, go:'x' }  { do:[efeitos] }
//   { bg:'cafe', fx:'fade'|'cut' }  { music:'cafe' }  { card:'Sábado, 18h' }  { wait:ms }  { fx:'shake'|'flash' }
//   { show:'character_01', at:'left|center|right', e:'happy' }  { hide:'character_01' }  { hideAll:true }
//   { n:'narração' }  { th:'pensamento' }  { p:'fala do protagonista' }  { c:'character_01', e:'happy', t:'fala' }
//   { choice:[{ t, do, go, if, lockIf, lock, value }], id:'decisao' }
//   { phone:'idDaConversa' }  { end:true }
//   Em qualquer fala: cam:'close'|'extreme'|'medium'|'two'|'ots'|'side'|'wide' força o plano; big:true marca uma revelação.
//   Sem "e", a expressão é deduzida do texto (cinematic/Emotions.js).
import { game, fmt } from '../core/GameState.js';
import { bus } from '../core/EventBus.js';
import { CHAPTERS } from './chapters/index.js';
import { applyEffects, prepareOptions, recordDecision, ctx } from '../choices/ChoiceSystem.js';
import { Relationships } from '../relationships/RelationshipManager.js';
import { runConversation } from '../smartphone/PhoneSystem.js';
import { Characters } from '../characters/CharacterRegistry.js';
import { audio } from '../audio/AudioManager.js';
import { Director } from '../cinematic/Director.js';
import { emotionFor } from '../cinematic/Emotions.js';
import { settings } from '../save/Settings.js';

const LOG_MAX = 400;

export function findScene(sceneId) {
  for (const ch of CHAPTERS) {
    const i = ch.scenes.findIndex((s) => s.id === sceneId);
    if (i >= 0) return { chapter: ch, scene: ch.scenes[i], index: i };
  }
  return null;
}

export class StoryEngine {
  constructor(ui, stage) { this.ui = ui; this.stage = stage; this.token = 0; this.director = new Director(); }

  /** Começa (ou continua) a partir da posição salva no estado. */
  async resume() {
    const pos = game.state.pos;
    if (!pos.scene) { pos.chapter = CHAPTERS[0].id; pos.scene = CHAPTERS[0].scenes[0].id; pos.pc = 0; return this.run(true); }
    await this.stage.restore(game.state.stage);
    return this.run(pos.pc === 0);
  }

  /** Revê uma cena da galeria sem alterar o jogo salvo. */
  async replay(sceneId) {
    const backup = game.state;
    const sandbox = JSON.parse(JSON.stringify(backup));
    sandbox.pos = { chapter: findScene(sceneId).chapter.id, scene: sceneId, pc: 0 };
    sandbox.stage = { bg: null, chars: [], music: null };
    game.set(sandbox); game.replay = true;
    try { await this.run(true, { single: true }); } finally { game.set(backup); game.replay = false; }
  }

  stop() { this.token++; }

  async run(fresh, { single = false } = {}) {
    const token = ++this.token;
    const alive = () => token === this.token;
    let info = findScene(game.state.pos.scene);
    if (!info) { console.error('[Story] cena inexistente', game.state.pos.scene); return; }
    if (fresh) await this.enterScene(info);
    let labels = this.labels(info.scene);
    while (alive()) {
      const pos = game.state.pos;
      const s = info.scene.steps[pos.pc];
      if (!s || s.end) {
        const next = await this.finishScene(info, single);
        if (!next || !alive()) return;
        info = next; labels = this.labels(info.scene);
        await this.enterScene(info);
        continue;
      }
      await this.exec(s, info, labels, alive);
    }
  }

  labels(scene) { const m = {}; scene.steps.forEach((s, i) => { if (s.label) m[s.label] = i; }); return m; }

  async exec(s, info, labels, alive) {
    const pos = game.state.pos, st = game.state.stage;
    const jump = (l) => { if (!(l in labels)) throw new Error(`Rótulo "${l}" não existe em ${info.scene.id}`); pos.pc = labels[l]; };
    if (s.label) { pos.pc++; return; }
    if (s.go && !s.if && !s.choice) return jump(s.go);
    if (s.if) { if (s.if(ctx())) return jump(s.go); pos.pc++; return; }
    if (s.do) { applyEffects(s.do); pos.pc++; return; }
    if (s.music) { st.music = s.music; audio.playMusic(s.music); pos.pc++; return; }
    if (s.bg) { st.bg = s.bg; await this.stage.setBackground(s.bg, s.fx || 'fade'); pos.pc++; return; }
    if (s.show) {
      const c = st.chars.filter((x) => x.id !== s.show); c.push({ id: s.show, at: s.at || 'center', e: s.e || 'neutral' }); st.chars = c;
      Relationships.meet(s.show);
      await this.stage.show(s.show, s.at || 'center', s.e || 'neutral'); pos.pc++; return;
    }
    if (s.hide) { st.chars = st.chars.filter((x) => x.id !== s.hide); await this.stage.hide(s.hide); pos.pc++; return; }
    if (s.hideAll) { st.chars = []; await this.stage.hideAll(); pos.pc++; return; }
    if (s.wait) { await new Promise((r) => setTimeout(r, this.ui.skipping ? 0 : s.wait)); pos.pc++; return; }
    if (s.fx) { this.stage.effect(s.fx); pos.pc++; return; }
    if (s.shot) { this.stage.shot?.(this.director.shotFor({ cam: s.shot, cast: st.chars })); pos.pc++; return; }
    if (s.card) { await this.ui.timeCard(fmt(s.card)); pos.pc++; return; }

    // ---- passos exibidos: salva antes, para poder continuar exatamente daqui ----
    if (s.phone) {
      await this.save();
      await this.ui.phone.playConversation(s.phone, {
        ctx, apply: applyEffects, prepare: prepareOptions, save: () => this.save(),
        decide: (d) => recordDecision({ ...d, ...this.where(info) }),
      }, runConversation);
      if (!alive()) return;
      this.log({ kind: 'phone', t: `📱 Conversa no celular: ${this.ui.phone.title(s.phone)}` });
      pos.pc++; return;
    }
    if (s.choice) {
      await this.save();
      const opts = prepareOptions(s.choice);
      // enquadra quem está em cena à esquerda, deixando as opções livres à direita
      const cast = game.state.stage.chars.map((c) => c.id);
      const who = cast.includes(this.director.lastSpeaker) ? this.director.lastSpeaker : cast[0];
      if (who && settings.data.cinema !== false) this.stage.shot?.({ type: 'choice', subject: who, push: 'in' }, { instant: this.ui.skipping });
      const i = await this.ui.choose(opts.map((o) => ({ text: fmt(o.t), locked: o.locked, lock: o.lock })));
      if (!alive()) return;
      const o = opts[i];
      recordDecision({ id: s.id, value: o.value ?? i, text: fmt(o.t), ...this.where(info) });
      this.log({ kind: 'choice', t: fmt(o.t) });
      applyEffects(o.do);
      if (o.go) jump(o.go); else pos.pc++;
      return;
    }
    if (s.n || s.th || s.p || s.c) {
      const line = s.c ? { speaker: s.c, expr: s.e || null, text: fmt(s.t) }
        : s.p ? { speaker: 'player', text: fmt(s.p) }
          : s.th ? { speaker: 'thought', text: fmt(s.th) } : { speaker: null, text: fmt(s.n) };
      // emoção: a do roteiro ou deduzida da fala
      let emo = null;
      if (s.c) {
        emo = emotionFor(s.e, line.text);
        const ch = st.chars.find((x) => x.id === s.c);
        if (ch && ch.e !== emo.emotion) { ch.e = emo.emotion; this.stage.express(s.c, emo.emotion); }
        else if (s.e) this.stage.express(s.c, emo.emotion);
      }
      this.stage.focus(s.c || null);
      // câmera cinematográfica
      const shot = this.director.shotFor({ speaker: line.speaker, emotion: emo?.emotion, intensity: emo?.intensity ?? 0.5, text: line.text, cast: st.chars, cam: s.cam, revelation: s.big });
      if (this.stage.shot) this.stage.shot(settings.data.cinema === false ? { type: 'wide' } : shot, { instant: this.ui.skipping });
      // boca acompanha a fala no ritmo do texto
      if (s.c && !this.ui.skipping) this.stage.speak?.(s.c, line.text, settings.textDelay() || 38);
      const key = `${info.scene.id}:${pos.pc}`;
      const wasRead = !!game.state.read[key];
      await this.save();
      this.log({ kind: 'line', who: line.speaker, t: line.text });
      await this.ui.say(line, { read: wasRead });
      this.stage.stopSpeaking?.();
      if (!alive()) return;
      if (!game.replay) game.state.read[key] = 1;
      pos.pc++; return;
    }
    console.warn('[Story] passo desconhecido', s); pos.pc++;
  }

  where(info) {
    return { chapter: info.chapter.id, scene: info.scene.id, chapterTitle: info.chapter.title, sceneTitle: info.scene.title };
  }

  log(entry) {
    const l = game.state.log;
    const name = entry.who === 'player' ? game.p.displayName : entry.who === 'thought' ? `${game.p.displayName} (pensando)` : entry.who ? Characters.name(entry.who) : null;
    l.push({ ...entry, name });
    if (l.length > LOG_MAX) l.splice(0, l.length - LOG_MAX);
  }

  async enterScene(info) {
    const st = game.state;
    st.pos = { chapter: info.chapter.id, scene: info.scene.id, pc: 0 };
    st.chapters[info.chapter.id] = { ...(st.chapters[info.chapter.id] || {}), started: true };
    if (info.index === 0 && !info.scene.noChapterCard) await this.ui.chapterCard(info.chapter);
    await this.stage.hideAll();
    st.stage.chars = [];
    this.director.reset();
    this.stage.shot?.({ type: 'wide' }, { instant: true });
    await this.ui.sceneCard(info.chapter, info.scene, info.index);
    this.log({ kind: 'scene', t: `— ${info.chapter.title} · ${info.scene.title} —` });
  }

  async finishScene(info, single) {
    const st = game.state;
    if (!st.gallery.includes(info.scene.id)) { st.gallery.push(info.scene.id); if (!game.replay) bus.emit('gallery:unlocked', info.scene); }
    if (single) return null;
    // próxima cena: definida pela cena (pode depender das escolhas) ou a seguinte do capítulo
    let nextId = typeof info.scene.next === 'function' ? info.scene.next(ctx()) : info.scene.next;
    if (!nextId) nextId = info.chapter.scenes[info.index + 1]?.id;
    if (!nextId) {
      st.chapters[info.chapter.id] = { ...(st.chapters[info.chapter.id] || {}), done: true };
      const ci = CHAPTERS.indexOf(info.chapter);
      const nextCh = CHAPTERS[ci + 1];
      await this.save();
      await this.ui.chapterEnd(info.chapter, nextCh);
      if (!nextCh || !nextCh.scenes.length) { st.pos = { chapter: info.chapter.id, scene: info.scene.id, pc: info.scene.steps.length }; await this.save(); await this.ui.toBeContinued(); return null; }
      nextId = nextCh.scenes[0].id;
    }
    return findScene(nextId);
  }

  async save() {
    if (game.replay) return;
    await this.ui.autosave();
  }
}
