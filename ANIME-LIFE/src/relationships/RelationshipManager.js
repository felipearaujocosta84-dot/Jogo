// Afinidade com personagens (base para o futuro sistema de relacionamentos).
import { game } from '../core/GameState.js';
import { bus } from '../core/EventBus.js';

export const Relationships = {
  get(id) {
    const r = game.state.relationships;
    if (!r[id]) r[id] = { affinity: 0, met: false, talks: 0 };
    return r[id];
  },
  meet(id) { this.get(id).met = true; },
  talk(id) { this.get(id).talks += 1; },
  change(id, delta) {
    const r = this.get(id);
    r.affinity = Math.max(-100, Math.min(100, r.affinity + delta));
    bus.emit('relationship:changed', id, r.affinity, delta);
  },
};
