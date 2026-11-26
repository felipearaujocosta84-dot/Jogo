// Chat livre com os personagens (celular). Conversa com a IA pelo servidor seguro ou, sem servidor,
// pelo modo local limitado. Memória persistente (no save), resumo das conversas antigas, relacionamento,
// humor, notificações e mensagens espontâneas.
import { game } from '../core/GameState.js';
import { bus } from '../core/EventBus.js';
import { settings } from '../save/Settings.js';
import { Characters } from '../characters/CharacterRegistry.js';
import { Relationships } from '../relationships/RelationshipManager.js';
import { AIClient, AIError } from './ai/AIClient.js';
import { LocalBrain } from './ai/LocalBrain.js';
import { storyFactsFor, trustCap } from './ai/storyFacts.js';
import { CONVERSATIONS } from '../story/phone/conversations.js';
import { isOnline } from './presence.js';

const HISTORY_SENT = 12;      // mensagens recentes enviadas à IA
const SUMMARIZE_AFTER = 24;   // acima disso, as antigas viram resumo
const MAX_FACTS = 25;
const MAX_LOG = 400;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const today = () => new Date().toISOString().slice(0, 10);
const normText = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, '').trim();

export const Chat = {
  typing: new Set(),   // personagens "digitando…"
  viewing: null,       // conversa aberta na tela (não gera notificação)

  phone() { const p = game.state.phone; p.ai ||= {}; p.notifications ||= []; p.aiUsage ||= { day: today(), count: 0 }; return p; },

  mem(id) {
    const ai = this.phone().ai;
    if (!ai[id]) ai[id] = { history: [], facts: [], summary: '', summarizedUpTo: 0, mood: 'neutro', unread: 0, lastTalk: 0, lastSpont: 0, seeded: false };
    const m = ai[id];
    if (!m.seeded) this.seedFromStory(id, m);
    return m;
  },

  /** As mensagens privadas da história (ex.: Akane à noite) entram no começo do chat — mesma conversa. */
  seedFromStory(id, m) {
    m.seeded = true;
    for (const [cid, def] of Object.entries(CONVERSATIONS)) {
      if (def.group || def.members?.[0] !== id) continue;
      const prog = game.state.phone.convos[cid];
      if (!prog) continue;
      const t = prog.updatedAt || Date.now();
      m.history.unshift(...prog.msgs.filter((x) => x.t).map((x) => ({ from: x.from === 'player' ? 'player' : 'npc', text: x.t, at: t, story: true, status: 'read' })));
    }
  },

  contacts() { return game.state?.phone.contacts || []; },
  online(id) { return this.typing.has(id) || isOnline(id); },
  mode() { return AIClient.configured ? 'ia' : 'local'; },
  usageLeft() {
    const u = this.phone().aiUsage;
    if (u.day !== today()) { u.day = today(); u.count = 0; }
    return Math.max(0, (settings.data.aiDailyCap || 80) - u.count);
  },
  unreadTotal() { return this.contacts().reduce((n, id) => n + (this.phone().ai[id]?.unread || 0), 0); },

  relation(id) {
    const r = Relationships.get(id);
    return { amizade: r.amizade, confianca: r.confianca, carinho: r.carinho || 0, afinidade: r.afinidade, romance: r.romance };
  },

  context(id) {
    const m = this.mem(id), p = game.p;
    const recent = m.history.slice(-HISTORY_SENT).map((x) => ({ from: x.from, text: x.text.slice(0, 500) }));
    return {
      characterId: id,
      player: { name: p.name.slice(0, 40), displayName: p.displayName.slice(0, 20), pronouns: p.pronouns },
      relationship: this.relation(id), mood: m.mood,
      memories: m.facts.slice(-20).map((f) => f.text), storyFacts: storyFactsFor(id, game.state).slice(0, 15),
      summary: m.summary.slice(0, 1400), history: recent,
      localTime: new Date().toLocaleString('pt-BR', { weekday: 'long', hour: '2-digit', minute: '2-digit' }),
    };
  },

  /** O jogador envia uma mensagem. Não bloqueia: a resposta chega depois (com "digitando…"). */
  send(id, text) {
    text = String(text).trim().slice(0, 500);
    if (!text) return null;
    const m = this.mem(id);
    const msg = { from: 'player', text, at: Date.now(), status: 'sent' };
    m.history.push(msg); m.lastTalk = Date.now();
    this.trim(m);
    bus.emit('chat:update', id);
    this.respond(id, msg);
    return msg;
  },

  retry(id, msg) { msg.status = 'sent'; msg.error = null; bus.emit('chat:update', id); this.respond(id, msg); },

  async respond(id, msg) {
    const m = this.mem(id);
    let out;
    try {
      if (this.mode() === 'ia') {
        if (this.usageLeft() <= 0) throw new AIError('limite_local_diario');
        const pending = AIClient.chat({ ...this.context(id), history: this.context(id).history.slice(0, -1), message: msg.text });
        pending.catch(() => {}); // o erro é tratado abaixo, no await
        await wait(isOnline(id) ? 700 : 2500); // "visto" e começa a digitar
        msg.status = 'read'; this.setTyping(id, true);
        out = await pending;
        this.phone().aiUsage.count++;
      } else {
        await wait(600); msg.status = 'read'; this.setTyping(id, true);
        out = LocalBrain.reply(id, msg.text, m, this.relation(id));
      }
    } catch (e) {
      this.setTyping(id, false);
      msg.status = 'error'; msg.error = e.code || 'sem_conexao';
      bus.emit('chat:update', id); bus.emit('chat:error', id, msg.error);
      return;
    }
    // aplica relação, humor e memórias
    this.applyDeltas(id, out.deltas);
    if (out.mood) m.mood = out.mood;
    this.remember(id, out.memories);
    // entrega as bolhas uma a uma, com tempo de digitação
    for (const [i, text] of out.replies.entries()) {
      if (i > 0) { this.setTyping(id, true); }
      await wait(Math.min(3200, 450 + text.length * 28));
      this.deliver(id, text, { local: !!out.local });
    }
    this.setTyping(id, false);
    this.maybeSummarize(id);
    bus.emit('chat:save');
  },

  deliver(id, text, extra = {}) {
    const m = this.mem(id);
    const msg = { from: 'npc', text, at: Date.now(), ...extra };
    m.history.push(msg); m.lastTalk = Date.now();
    if (this.viewing !== id) {
      m.unread++;
      this.notify({ kind: 'msg', charId: id, text });
    }
    this.trim(m);
    bus.emit('chat:update', id);
    bus.emit('chat:message', id, msg);
  },

  setTyping(id, on) { if (on) this.typing.add(id); else this.typing.delete(id); bus.emit('chat:typing', id, on); },

  /** A relação muda com cada conversa — mas decisões graves da história limitam o quanto ela se recupera. */
  applyDeltas(id, d) {
    if (!d) return;
    const cap = trustCap(id, game.state);
    const deltas = {};
    for (const [k, v] of Object.entries(d)) {
      if (!v) continue;
      let x = Math.max(-3, Math.min(3, Math.round(v)));
      if (x > 0 && (k === 'confianca' || k === 'carinho' || k === 'romance')) x = x * cap >= 0.5 ? Math.max(1, Math.round(x * cap)) : 0;
      if (x) deltas[k] = x;
    }
    if (Object.keys(deltas).length) Relationships.change(id, deltas);
  },

  remember(id, list) {
    if (!list?.length) return;
    const m = this.mem(id);
    for (const f of list) {
      const key = normText(f.text);
      if (!key || m.facts.some((x) => normText(x.text) === key)) continue;
      m.facts.push({ kind: f.kind || 'fato', text: f.text.slice(0, 160), at: Date.now() });
    }
    // limite: descarta primeiro os fatos comuns mais antigos; promessas e momentos ficam
    while (m.facts.length > MAX_FACTS) {
      const i = m.facts.findIndex((x) => x.kind === 'fato' || x.kind === 'preferencia');
      m.facts.splice(i >= 0 ? i : 0, 1);
    }
  },

  trim(m) { if (m.history.length > MAX_LOG) { const cut = m.history.length - MAX_LOG; m.history.splice(0, cut); m.summarizedUpTo = Math.max(0, m.summarizedUpTo - cut); } },

  /** Conversas antigas viram um resumo curto (controle de custo: não reenvia o histórico inteiro). */
  async maybeSummarize(id) {
    const m = this.mem(id);
    const pending = m.history.length - m.summarizedUpTo;
    if (pending <= SUMMARIZE_AFTER) return;
    const upTo = m.history.length - HISTORY_SENT;
    const older = m.history.slice(m.summarizedUpTo, upTo).map((x) => ({ from: x.from, text: x.text.slice(0, 500) })).slice(-40);
    try {
      if (this.mode() === 'ia') {
        const r = await AIClient.summarize({ ...this.context(id), older });
        m.summary = r.summary; this.remember(id, r.memories);
      } else {
        const said = older.filter((x) => x.from === 'player').map((x) => x.text).slice(-6).join(' / ');
        m.summary = `${m.summary} Conversaram por mensagem; o jogador falou de: ${said}`.slice(-1200);
      }
      m.summarizedUpTo = upTo;
    } catch { /* tenta de novo na próxima mensagem */ }
  },

  notify(n) {
    const list = this.phone().notifications;
    list.unshift({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, at: Date.now(), read: false, ...n });
    list.splice(50);
    bus.emit('phone:notify', list[0]);
  },

  // ---------------- mensagens espontâneas ----------------
  startScheduler() {
    clearInterval(this.timer);
    this.timer = setInterval(() => this.tick(), 30000);
  },
  stopScheduler() { clearInterval(this.timer); this.timer = null; },

  /** Intervalo mínimo entre mensagens espontâneas, em minutos (Ajustes → Mensagens espontâneas). */
  gapMinutes() { return { off: Infinity, poucas: 30, normal: 12, muitas: 4 }[settings.data.spontaneous || 'normal']; },

  async tick(force = false) {
    if (!game.state || game.replay) return null;
    const p = this.phone();
    const gap = this.gapMinutes() * 60000;
    if (!force && (gap === Infinity || Date.now() - (p.lastSpont || 0) < gap)) return null;
    const h = new Date().getHours();
    const cands = this.contacts().filter((id) => !this.typing.has(id) && this.viewing !== id && (force || isOnline(id)));
    if (!cands.length) return null;
    const id = cands.sort((a, b) => (this.mem(a).lastSpont || 0) - (this.mem(b).lastSpont || 0))[0];
    const m = this.mem(id), r = this.relation(id);
    let reason = 'curiosidade';
    if (h >= 6 && h < 11) reason = 'bom_dia';
    else if (h >= 22 || h < 2) reason = 'boa_noite';
    else if (m.lastTalk && Date.now() - m.lastTalk > 2 * 86400000) reason = 'sumiu';
    else if (r.carinho + r.romance > 30) reason = 'saudade';
    else if (r.amizade > 20 && Math.random() < 0.4) reason = 'convite';
    else if (!m.facts.some((f) => f.kind === 'preferencia')) reason = 'sumiu';
    p.lastSpont = Date.now(); m.lastSpont = Date.now();
    try {
      let out;
      if (this.mode() === 'ia') { if (this.usageLeft() <= 0) return null; out = await AIClient.spontaneous({ ...this.context(id), reason }); p.aiUsage.count++; }
      else out = LocalBrain.spontaneous(id, reason, m);
      this.setTyping(id, true);
      for (const text of out.replies) { await wait(Math.min(2500, 400 + text.length * 25)); this.deliver(id, text, { spontaneous: true, local: !!out.local }); }
      this.setTyping(id, false);
      if (out.mood) m.mood = out.mood;
      bus.emit('chat:save');
      return { id, reason };
    } catch { this.setTyping(id, false); return null; }
  },
};
