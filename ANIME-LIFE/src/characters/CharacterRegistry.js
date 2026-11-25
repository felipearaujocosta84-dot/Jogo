// Registro dos personagens oficiais (dados em characters.json, imagens em public/assets/characters/<id>/).
//
// Arquivos de cada personagem:
//   reference/original.jpg   ilustração original enviada (referência permanente, nunca editar)
//   full.webp                corpo inteiro com fundo removido (retrato do diálogo)
//   portrait.webp            busto 256x256 (celular, listas)
//   world.webp               versão leve exibida no mapa como personagem ESTÁTICO
//   sprites/                 reservado para spritesheets animadas fiéis à referência (ver sprites/README.md)
//   expressions/<nome>.webp  (opcional) variações de expressão desenhadas a partir da referência
import data from './characters.json';
import { characterAsset } from '../core/assets.js';

const byId = new Map(data.characters.map((c) => [c.id, c]));

export const Characters = {
  all: () => data.characters,
  get: (id) => byId.get(id),
  name: (id) => byId.get(id)?.displayName ?? id,
  fullImage: (id) => characterAsset(id, 'full.webp'),
  portrait: (id) => characterAsset(id, 'portrait.webp'),
  worldImage: (id) => characterAsset(id, 'world.webp'),
  reference: (id) => characterAsset(id, 'reference/original.jpg'),
  /** Personagem tem recorte transparente? (falso = ilustração mantém o fundo original) */
  hasCutout: (id) => byId.get(id)?.cutout !== false,
  /**
   * Imagem para uma expressão. Só existe arte "neutra" (a ilustração enviada).
   * Expressões sem arte própria usam a ilustração original + efeito de interface (ver DialogueBox).
   */
  expressionImage(id, expr) {
    const c = byId.get(id);
    const file = c?.expressions?.[expr];
    return file ? characterAsset(id, file) : characterAsset(id, 'full.webp');
  },
  hasExpressionArt: (id, expr) => !!byId.get(id)?.expressions?.[expr],
  /** Spritesheet animada (null até ser produzida a partir da referência). */
  spriteSheet: (id) => byId.get(id)?.spriteSheet ?? null,
};
