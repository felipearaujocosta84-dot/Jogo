// Skins (acabamentos cosméticos) originais. Não alteram nenhum atributo de combate.
// Cada skin define parâmetros de material PBR (metalicidade, rugosidade, brilho) e um padrão procedural.
// Se a pasta public/assets/skins/<pasta>/ tiver texturas (albedo, normal, orm), elas substituem o padrão gerado.
// Compartilhado entre cliente, simulação e servidor.

export type PatternKind = 'none' | 'camo' | 'carbon' | 'flames' | 'brushed' | 'scales' | 'ice';
export type Rarity = 'comum' | 'rara' | 'épica' | 'lendária' | 'especial';

export interface SkinDef {
  id: string;
  name: string;
  /** Pasta em public/assets/skins/ com texturas opcionais. */
  folder: string;
  /** Nível mínimo do perfil para equipar (inventário). */
  level: number;
  rarity: Rarity;
  pattern: PatternKind;
  /** Cores do padrão procedural. */
  colors: string[];
  /** Material PBR das partes pintadas. */
  metallic: number;
  roughness: number;
  /** Brilho próprio (ex.: brasas, gelo). */
  emissive?: string;
}

export const RARITIES: Rarity[] = ['comum', 'rara', 'épica', 'lendária', 'especial'];

export const RARITY_LABEL: Record<Rarity, string> = {
  comum: 'Comum',
  rara: 'Rara',
  épica: 'Épica',
  lendária: 'Lendária',
  especial: 'Especial'
};

export const RARITY_COLOR: Record<Rarity, string> = {
  comum: '#b0c3d9',
  rara: '#4b69ff',
  épica: '#a632e6',
  lendária: '#e4ae39',
  especial: '#ff4d4d'
};

export const SKINS: SkinDef[] = [
  { id: 'default', name: 'Padrão de fábrica', folder: '', level: 1, rarity: 'comum', pattern: 'none', colors: [], metallic: 0.55, roughness: 0.5 },
  { id: 'military_camo', name: 'Camuflagem Militar', folder: 'military_camo', level: 1, rarity: 'comum', pattern: 'camo', colors: ['#5a6338', '#33391f', '#8a7d52', '#1d2014'], metallic: 0.05, roughness: 0.8 },
  { id: 'carbon', name: 'Carbono', folder: 'carbon', level: 2, rarity: 'rara', pattern: 'carbon', colors: ['#141518', '#2a2d31', '#4a4f55'], metallic: 0.35, roughness: 0.32 },
  { id: 'black_ice', name: 'Gelo Negro', folder: 'black_ice', level: 3, rarity: 'épica', pattern: 'ice', colors: ['#0b0f16', '#1b2a3c', '#7fd4ff'], metallic: 0.6, roughness: 0.18, emissive: '#06202e' },
  { id: 'inferno', name: 'Inferno', folder: 'inferno', level: 4, rarity: 'épica', pattern: 'flames', colors: ['#120604', '#c2280c', '#ff8a1c', '#ffd75a'], metallic: 0.25, roughness: 0.45, emissive: '#3a0c02' },
  { id: 'blue_dragon', name: 'Dragão Azul', folder: 'blue_dragon', level: 6, rarity: 'lendária', pattern: 'scales', colors: ['#071a3a', '#1556b8', '#58b6ff', '#d6ecff'], metallic: 0.45, roughness: 0.3 },
  { id: 'gold', name: 'Dourada', folder: 'gold', level: 8, rarity: 'especial', pattern: 'brushed', colors: ['#a8781c', '#f3d27a', '#7a5410'], metallic: 1, roughness: 0.22 }
];

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
