// Relacionamentos: amizade, confiança, carinho, afinidade e interesse romântico (0–100) por personagem,
// mais o humor atual (das conversas no celular).
// Romance só cresce com personagens adultos marcados como "romanceable" e depois de
// uma afinidade mínima — antes disso, o carinho conta como afinidade.
import { game } from '../core/GameState.js';
import { bus } from '../core/EventBus.js';
import { Characters } from '../characters/CharacterRegistry.js';

export const STATS = [
  { key: 'amizade', label: 'Amizade', icon: '🤝' },
  { key: 'confianca', label: 'Confiança', icon: '🔒' },
  { key: 'carinho', label: 'Carinho', icon: '🌸' },
  { key: 'afinidade', label: 'Afinidade', icon: '✨' },
  { key: 'romance', label: 'Romance', icon: '♥' },
];
export const ROMANCE_MIN_AFFINITY = 15;

export const Relationships = {
  get(id) {
    const r = game.state.rel;
    if (!r[id]) r[id] = { amizade: 0, confianca: 0, carinho: 0, afinidade: 0, romance: 0, met: false };
    return r[id];
  },
  meet(id) { this.get(id).met = true; },
  value(id, stat) { return this.get(id)[stat] ?? 0; },
  /** Humor atual (vem das conversas no celular). */
  mood(id) { return game.state.phone?.ai?.[id]?.mood || 'neutro'; },
  /** deltas: { amizade: 2, confianca: -1, ... } */
  change(id, deltas) {
    const r = this.get(id);
    const applied = {};
    for (let [k, d] of Object.entries(deltas)) {
      if (k === 'romance' && d > 0 && (!Characters.canRomance(id) || r.afinidade < ROMANCE_MIN_AFFINITY)) k = 'afinidade';
      r[k] = Math.max(0, Math.min(100, (r[k] ?? 0) + d));
      applied[k] = (applied[k] || 0) + d;
    }
    bus.emit('rel:changed', id, applied);
    return applied;
  },
  route(id) { return game.state.routes[id] || null; },
  setRoute(id, state) {
    if (state !== 'fechada' && !Characters.canRomance(id)) return;
    game.state.routes[id] = state;
    bus.emit('route:changed', id, state);
  },
};
