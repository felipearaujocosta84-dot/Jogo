// Opções de aparência do PROTAGONISTA (nunca usa as artes dos personagens oficiais).
export const APPEARANCE = {
  body: [
    { id: 'a', label: 'Corpo A (ombros largos)' },
    { id: 'b', label: 'Corpo B (silhueta fina)' },
  ],
  hairStyle: [
    { id: 'curto', label: 'Curto bagunçado' },
    { id: 'medio', label: 'Médio (bob)' },
    { id: 'longo', label: 'Longo' },
    { id: 'rabo', label: 'Rabo de cavalo' },
  ],
  hairColor: [
    { id: 'castanho', label: 'Castanho', c: '#6b4532' },
    { id: 'preto', label: 'Preto', c: '#2a2630' },
    { id: 'loiro', label: 'Loiro', c: '#e9c77a' },
    { id: 'azul', label: 'Azul', c: '#4a6cc9' },
    { id: 'verde', label: 'Verde-menta', c: '#5fbf9f' },
    { id: 'roxo', label: 'Lavanda', c: '#9a7ad0' },
    { id: 'branco', label: 'Prateado', c: '#d8dbe6' },
  ],
  eyeColor: [
    { id: 'ambar', label: 'Âmbar', c: '#d08a2a' },
    { id: 'verde', label: 'Verde', c: '#3e9a5a' },
    { id: 'violeta', label: 'Violeta', c: '#8a4ad0' },
    { id: 'castanho', label: 'Castanho', c: '#7a4a2a' },
    { id: 'cinza', label: 'Cinza', c: '#7a8494' },
  ],
  skin: [
    { id: 's1', label: 'Clara', c: '#fde4d3' },
    { id: 's2', label: 'Média', c: '#f0c7a4' },
    { id: 's3', label: 'Morena', c: '#c98d62' },
    { id: 's4', label: 'Escura', c: '#8d5a3b' },
  ],
  outfit: [
    { id: 'jaqueta', label: 'Jaqueta + camiseta' },
    { id: 'cardigan', label: 'Cardigã + saia' },
    { id: 'colete', label: 'Camisa + colete' },
  ],
  outfitColor: [
    { id: 'verde', label: 'Verde-oliva', c: '#6f8a4e' },
    { id: 'mostarda', label: 'Mostarda', c: '#d6a23a' },
    { id: 'marinho', label: 'Azul-marinho', c: '#34477a' },
    { id: 'vinho', label: 'Vinho', c: '#8a3048' },
    { id: 'creme', label: 'Creme', c: '#e8dcc0' },
    { id: 'lilas', label: 'Lilás', c: '#a98fd6' },
  ],
};

export const DEFAULT_APPEARANCE = {
  body: 'a', hairStyle: 'curto', hairColor: 'castanho', eyeColor: 'ambar',
  skin: 's1', outfit: 'jaqueta', outfitColor: 'verde',
};

export function colorOf(group, id) {
  return APPEARANCE[group].find((o) => o.id === id)?.c ?? '#888';
}

export function randomAppearance() {
  const pick = (g) => APPEARANCE[g][Math.floor(Math.random() * APPEARANCE[g].length)].id;
  return Object.fromEntries(Object.keys(DEFAULT_APPEARANCE).map((k) => [k, pick(k)]));
}
