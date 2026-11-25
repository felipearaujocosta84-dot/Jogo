// Celular narrativo: contatos, conversas (individuais e em grupo, com escolhas),
// convites e publicações fictícias (Hoshigram). Os textos ficam em src/story/phone/.
import { game, fmt } from '../core/GameState.js';
import { bus } from '../core/EventBus.js';
import { CONVERSATIONS } from '../story/phone/conversations.js';
import { POSTS } from '../story/phone/posts.js';

export const Phone = {
  contacts() { return game.state.phone.contacts; },
  addContact(id) {
    const p = game.state.phone;
    if (p.contacts.includes(id)) return;
    p.contacts.push(id);
    bus.emit('phone:contact', id);
  },
  addPost(id) {
    const p = game.state.phone;
    if (p.posts.includes(id)) return;
    p.posts.unshift(id); p.unread += 1;
    bus.emit('phone:post', id);
  },
  posts() { return game.state.phone.posts.map((id) => ({ id, ...POSTS[id], liked: game.state.phone.liked.includes(id) })); },
  toggleLike(id) {
    const l = game.state.phone.liked; const i = l.indexOf(id);
    if (i >= 0) l.splice(i, 1); else l.push(id);
  },
  /** Conversas já iniciadas (para o app de Mensagens). */
  threads() {
    return Object.entries(game.state.phone.convos).map(([id, c]) => ({ id, ...CONVERSATIONS[id], log: c.msgs, done: c.done }))
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  },
  conversation(id) { return CONVERSATIONS[id]; },
  progress(id) {
    const all = game.state.phone.convos;
    if (!all[id]) all[id] = { msgs: [], pc: 0, done: false, updatedAt: Date.now() };
    return all[id];
  },
};

/**
 * Executa uma conversa. view = { message(msg), ask(options) -> Promise<index>, typing(from, ms) }
 * Passos: { from, t } | { from:'player', t } | { invite:{title,when,where} , from }
 *         { choice:[{ t, reply?, do?, go?, id?, value? }], id } | { label } | { go } | { if, go } | { do } | { end }
 */
export async function runConversation(id, view, hooks) {
  const def = CONVERSATIONS[id];
  const prog = Phone.progress(id);
  const labels = {};
  def.steps.forEach((s, i) => { if (s.label) labels[s.label] = i; });
  for (const m of prog.msgs) view.message(m, true); // restaura mensagens já trocadas
  while (prog.pc < def.steps.length && !prog.done) {
    const s = def.steps[prog.pc];
    if (s.label) { prog.pc++; continue; }
    if (s.go && !s.if) { prog.pc = labels[s.go]; continue; }
    if (s.if) { prog.pc = s.if(hooks.ctx()) ? labels[s.go] : prog.pc + 1; continue; }
    if (s.do) { hooks.apply(s.do); prog.pc++; continue; }
    if (s.end) break;
    if (s.choice) {
      hooks.save();
      const opts = hooks.prepare(s.choice);
      const i = await view.ask(opts.map((o) => ({ text: fmt(o.t), locked: o.locked, lock: o.lock })));
      const o = opts[i];
      hooks.decide({ id: s.id, value: o.value ?? i, text: fmt(o.t) });
      const msg = { from: 'player', t: fmt(o.reply || o.t) };
      prog.msgs.push(msg); view.message(msg);
      hooks.apply(o.do);
      prog.pc = o.go ? labels[o.go] : prog.pc + 1;
      continue;
    }
    // mensagem recebida ou enviada
    const msg = { from: s.from, t: s.t ? fmt(s.t) : '', invite: s.invite || null };
    if (s.from !== 'player') await view.typing(s.from, Math.min(1400, 350 + msg.t.length * 18));
    prog.msgs.push(msg); prog.updatedAt = Date.now();
    view.message(msg);
    prog.pc++;
    hooks.save();
  }
  prog.done = true; prog.updatedAt = Date.now();
}
