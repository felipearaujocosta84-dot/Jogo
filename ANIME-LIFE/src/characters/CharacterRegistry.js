// Registro dos personagens oficiais (dados em characters.json, imagens em public/assets/characters/<id>/).
//   reference/original.jpg   ilustração original enviada (referência permanente — nunca editar)
//   full.webp                a mesma ilustração com fundo removido (usada em TODAS as cenas)
//   portrait.webp            busto 256x256 (celular, relacionamentos, histórico)
//   expressions/<expr>.webp  (opcional) variações de expressão desenhadas a partir da referência
import data from './characters.json';
import { characterAsset } from '../core/assets.js';

const byId = new Map(data.characters.map((c) => [c.id, c]));

export const Characters = {
  all: () => data.characters,
  get: (id) => byId.get(id),
  name: (id) => byId.get(id)?.displayName ?? id,
  fullName: (id) => byId.get(id)?.name ?? id,
  color: (id) => byId.get(id)?.color ?? '#ff8fb8',
  fullImage: (id) => characterAsset(id, 'full.webp'),
  portrait: (id) => characterAsset(id, 'portrait.webp'),
  reference: (id) => characterAsset(id, 'reference/original.jpg'),
  hasCutout: (id) => byId.get(id)?.cutout !== false,
  /** Romance só com personagens adultos marcados como "romanceable". */
  canRomance: (id) => { const c = byId.get(id); return !!(c && c.romanceable && c.age >= 18); },
  expressionImage(id, expr) {
    const file = byId.get(id)?.expressions?.[expr];
    return file ? characterAsset(id, file) : characterAsset(id, 'full.webp');
  },
  hasExpressionArt: (id, expr) => !!byId.get(id)?.expressions?.[expr],
};
