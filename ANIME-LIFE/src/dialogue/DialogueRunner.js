// Executa roteiros de diálogo (grafo de nós) e aplica efeitos. A interface é a DialogueBox.
//
// Nó: { speaker: 'character_01' | 'player' | null(narração), expr, text,
//        next: 'idNó' | (ctx) => 'idNó', choices: [{ text, next, decision, value, affinity, effects, if }],
//        effects: [...], end: true }
// Efeitos: { flag, value } | { affinity: { id: delta } } | { item } | { contact } | { action }
import { game } from '../core/GameState.js';
import { bus } from '../core/EventBus.js';
import { Relationships } from '../relationships/RelationshipManager.js';
import { Inventory } from '../inventory/Inventory.js';
import { Phone } from '../smartphone/Phone.js';

export class DialogueRunner {
  constructor(script, { box, npcId = null, onEnd } = {}) {
    this.script = script; this.box = box; this.npcId = npcId; this.onEnd = onEnd;
    this.ctx = {
      game, flag: (k) => game.flag(k), affinity: (id) => Relationships.get(id).affinity,
      period: game.period(), day: game.state.time.day,
    };
  }

  start() {
    if (this.npcId) { Relationships.meet(this.npcId); Relationships.talk(this.npcId); }
    const start = typeof this.script.start === 'function' ? this.script.start(this.ctx) : this.script.start;
    this.box.open(this);
    this.goto(start);
  }

  resolve(next) { return typeof next === 'function' ? next(this.ctx) : next; }

  interpolate(text) {
    const p = game.p;
    return text.replace(/\{player\}/g, p?.displayName || p?.name || '...').replace(/\{fullname\}/g, p?.name || '');
  }

  goto(id) {
    const node = this.script.nodes[id];
    if (!node) { console.error(`[Dialogue] nó inexistente "${id}" em ${this.script.id}`); return this.finish(); }
    this.node = node; this.nodeId = id;
    this.applyEffects(node.effects);
    const choices = (node.choices || []).filter((c) => !c.if || c.if(this.ctx));
    this.box.show({
      speaker: node.speaker ?? null,
      expr: node.expr || 'neutral',
      text: this.interpolate(node.text),
      choices: choices.map((c) => this.interpolate(c.text)),
    });
    this.visibleChoices = choices;
  }

  /** Avançar (nó sem escolhas). */
  advance() {
    const n = this.node;
    if (!n || this.visibleChoices.length) return;
    if (n.end || !n.next) return this.finish();
    this.goto(this.resolve(n.next));
  }

  choose(index) {
    const c = this.visibleChoices[index];
    if (!c) return;
    if (c.decision) {
      game.setFlag(c.decision, c.value ?? c.text);
      game.state.decisions.push({
        dialogue: this.script.id, node: this.nodeId, decision: c.decision, value: c.value ?? null,
        text: this.interpolate(c.text), day: game.state.time.day, time: game.clockText(),
      });
      bus.emit('dialogue:decision', c.decision, c.value);
    }
    if (c.affinity) this.applyEffects([{ affinity: c.affinity }]);
    this.applyEffects(c.effects);
    if (c.end || !c.next) return this.finish();
    this.goto(this.resolve(c.next));
  }

  applyEffects(list) {
    for (const e of list || []) {
      if ('flag' in e) game.setFlag(e.flag, e.value ?? true);
      if (e.affinity) for (const [id, d] of Object.entries(e.affinity)) Relationships.change(id, d);
      if (e.item) Inventory.add(e.item, e.qty || 1);
      if (e.contact) Phone.addContact(e.contact);
      if (e.action) bus.emit('dialogue:action', e.action, e);
    }
  }

  finish() {
    this.box.close();
    this.onEnd?.(this);
    bus.emit('dialogue:end', this.script.id);
  }
}
