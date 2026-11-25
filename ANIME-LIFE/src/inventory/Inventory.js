import { game } from '../core/GameState.js';
import { bus } from '../core/EventBus.js';
import { ITEMS } from './items.js';

export const Inventory = {
  list() { return game.state.inventory.map((s) => ({ ...s, ...ITEMS[s.id] })); },
  has(id) { return game.state.inventory.some((s) => s.id === id); },
  add(id, qty = 1) {
    const s = game.state.inventory.find((i) => i.id === id);
    if (s) s.qty += qty; else game.state.inventory.push({ id, qty });
    bus.emit('inventory:added', id, ITEMS[id]);
  },
};
