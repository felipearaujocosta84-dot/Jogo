// Raridades dos itens cosméticos (skins, peças do personagem, acessórios). Dados puros: cliente e servidor.
export type Rarity = 'comum' | 'incomum' | 'rara' | 'épica' | 'lendária';

export const RARITIES: Rarity[] = ['comum', 'incomum', 'rara', 'épica', 'lendária'];

export const RARITY_LABEL: Record<Rarity, string> = {
  comum: 'Comum',
  incomum: 'Incomum',
  rara: 'Rara',
  épica: 'Épica',
  lendária: 'Lendária'
};

export const RARITY_COLOR: Record<Rarity, string> = {
  comum: '#b0c3d9',
  incomum: '#5ec26a',
  rara: '#4b8bff',
  épica: '#b04dff',
  lendária: '#e8b33a'
};

/** Ordem para ordenar (comum primeiro). */
export function rarityRank(r: Rarity): number {
  return RARITIES.indexOf(r);
}
