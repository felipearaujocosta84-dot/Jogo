// Registro de arenas. Para adicionar uma nova arena, crie uma classe com a mesma interface
// de StreetArena (build, resolveBallCollisions, update, celebrate, goals, shadowGenerator)
// e registre aqui.
import { StreetArena } from './StreetArena.js';

export const ARENAS = {
  [StreetArena.id]: StreetArena
};

export function createArena(id, scene, quality) {
  const ArenaClass = ARENAS[id] || StreetArena;
  return new ArenaClass(scene, quality).build();
}
