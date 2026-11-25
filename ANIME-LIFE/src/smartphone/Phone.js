// Celular do protagonista (base). Contatos vêm das decisões nos diálogos.
import { game } from '../core/GameState.js';
import { bus } from '../core/EventBus.js';

export const Phone = {
  contacts() { return game.state.contacts; },
  addContact(characterId) {
    if (game.state.contacts.includes(characterId)) return false;
    game.state.contacts.push(characterId);
    bus.emit('phone:contact', characterId);
    return true;
  },
};
