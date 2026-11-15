// Skins (acabamentos cosméticos) originais. Não alteram atributos das armas.
// Desbloqueio por nível do perfil. Compartilhado entre cliente, simulação e servidor.

export type PatternKind = 'none' | 'digital' | 'camo' | 'carbon' | 'tiger' | 'hex' | 'waves' | 'brushed' | 'splatter';

export interface SkinDef {
  id: string;
  name: string;
  /** Nível mínimo do perfil para equipar. */
  level: number;
  rarity: 'comum' | 'incomum' | 'rara' | 'épica' | 'lendária';
  /** Cores que substituem as originais (vazio = mantém). */
  body?: string;
  furniture?: string;
  metal?: string;
  pattern: PatternKind;
  /** Cores do padrão (fundo, manchas...). */
  colors: string[];
}

export const SKINS: SkinDef[] = [
  { id: 'default', name: 'Padrão de fábrica', level: 1, rarity: 'comum', pattern: 'none', colors: [] },
  { id: 'dune', name: 'Duna Digital', level: 1, rarity: 'comum', pattern: 'digital', colors: ['#c9ad7d', '#9c7f52', '#e3d0a8', '#6f5a3a'] },
  { id: 'woodland', name: 'Mata Fechada', level: 1, rarity: 'comum', pattern: 'camo', colors: ['#4d5b34', '#2c3520', '#7a7a4a', '#1c1f15'] },
  { id: 'concrete', name: 'Concreto Urbano', level: 2, rarity: 'incomum', pattern: 'digital', colors: ['#8a8d90', '#5d6064', '#b8babc', '#3a3c3f'] },
  { id: 'carbon', name: 'Fibra de Carbono', level: 2, rarity: 'incomum', pattern: 'carbon', colors: ['#1a1b1d', '#2e3134', '#45494d'] },
  { id: 'ember', name: 'Listras de Brasa', level: 3, rarity: 'rara', pattern: 'tiger', colors: ['#e0731f', '#1d1410', '#f2a24a'] },
  { id: 'glacier', name: 'Geleira', level: 4, rarity: 'rara', pattern: 'camo', colors: ['#d8e6ee', '#8fb3c8', '#4f7894', '#f4f8fa'] },
  { id: 'circuit', name: 'Circuito Neon', level: 5, rarity: 'épica', pattern: 'hex', colors: ['#0b1220', '#18e0e8', '#0f5f8a'] },
  { id: 'crimson', name: 'Maré Carmesim', level: 6, rarity: 'épica', pattern: 'waves', colors: ['#5a0c12', '#c8202c', '#1a0507'] },
  { id: 'graffiti', name: 'Muro Pichado', level: 8, rarity: 'épica', pattern: 'splatter', colors: ['#f2efe6', '#e8362f', '#2a7ae2', '#f2c21b', '#1f1f1f'] },
  { id: 'aurum', name: 'Ouro Escovado', level: 10, rarity: 'lendária', pattern: 'brushed', colors: ['#c99a2e', '#f3d27a', '#8a6414'] }
];

export const RARITY_COLOR: Record<SkinDef['rarity'], string> = {
  comum: '#b0c3d9',
  incomum: '#5e98d9',
  rara: '#4b69ff',
  épica: '#d32ce6',
  lendária: '#e4ae39'
};

export function skinById(id: string | undefined): SkinDef {
  return SKINS.find(s => s.id === id) ?? SKINS[0];
}

/** Valida um mapa arma→skin (tamanho, ids conhecidos e nível do jogador). */
export function sanitizeSkins(raw: unknown, level: number): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== 'object') return out;
  let n = 0;
  for (const [w, s] of Object.entries(raw as Record<string, unknown>)) {
    if (++n > 40) break;
    const def = SKINS.find(x => x.id === s);
    if (def && def.level <= level && /^[a-z0-9]{2,12}$/.test(w)) out[w] = def.id;
  }
  return out;
}

export function randomSkins(weapons: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const w of weapons) out[w] = SKINS[Math.floor(Math.random() * SKINS.length)].id;
  return out;
}
