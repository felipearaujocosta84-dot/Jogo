// Skins (acabamentos cosméticos) originais. Não alteram nenhum atributo de combate.
// Cada skin define parâmetros de material PBR (metalicidade, rugosidade, brilho) e um padrão procedural
// (desenhado em SkinPatterns.ts, com relevo próprio). Se a pasta public/assets/skins/<pasta>/ tiver texturas
// (albedo, normal, orm), elas substituem o padrão gerado. Compartilhado entre cliente, simulação e servidor.
import { RARITIES, RARITY_COLOR, RARITY_LABEL, type Rarity } from '../cosmetics/Rarity';

export { RARITIES, RARITY_COLOR, RARITY_LABEL };
export type { Rarity };

export type PatternKind =
  | 'none' | 'solid' | 'camo' | 'woodland' | 'desert' | 'digital' | 'snow' | 'tiger'
  | 'carbon' | 'flames' | 'brushed' | 'scales' | 'ice' | 'hex' | 'circuit' | 'damascus' | 'geometric' | 'splatter' | 'stripes';

export type SkinStyle = 'camuflagem' | 'preta e dourada' | 'vermelha' | 'futurista' | 'metálica' | 'padrão' | 'fábrica';

export interface SkinDef {
  id: string;
  name: string;
  /** Pasta em public/assets/skins/ com texturas opcionais. */
  folder: string;
  /** Nível mínimo do perfil para equipar (inventário). */
  level: number;
  rarity: Rarity;
  style: SkinStyle;
  pattern: PatternKind;
  /** Cores do padrão procedural. */
  colors: string[];
  /** Material PBR das partes pintadas. */
  metallic: number;
  roughness: number;
  /** Brilho próprio (ex.: brasas, gelo, néon). */
  emissive?: string;
  /** Intensidade do relevo gerado a partir do padrão (0 = liso). */
  relief?: number;
}

const S = (id: string, name: string, level: number, rarity: Rarity, style: SkinStyle, pattern: PatternKind, colors: string[], metallic: number, roughness: number, extra: Partial<SkinDef> = {}): SkinDef =>
  ({ id, name, folder: id, level, rarity, style, pattern, colors, metallic, roughness, ...extra });

export const SKINS: SkinDef[] = [
  { id: 'default', name: 'Padrão de fábrica', folder: '', level: 1, rarity: 'comum', style: 'fábrica', pattern: 'none', colors: [], metallic: 0.55, roughness: 0.5 },
  // ---------------------------------------------------------------- comuns: acabamentos lisos e camuflagens básicas
  S('olive_drab', 'Verde Oliva', 1, 'comum', 'camuflagem', 'solid', ['#4a5236', '#3c432b'], 0.05, 0.72, { relief: 0.25 }),
  S('coyote', 'Coyote', 1, 'comum', 'camuflagem', 'solid', ['#8a7352', '#76603f'], 0.05, 0.72, { relief: 0.25 }),
  S('urban_gray', 'Cinza Urbano', 1, 'comum', 'padrão', 'solid', ['#5d6166', '#4a4e53'], 0.1, 0.6, { relief: 0.25 }),
  S('woodland', 'Floresta', 2, 'comum', 'camuflagem', 'woodland', ['#6b6a3c', '#3c4a26', '#5b4127', '#1d1f16'], 0.04, 0.8),
  S('desert_storm', 'Tempestade do Deserto', 2, 'comum', 'camuflagem', 'desert', ['#c8b68c', '#a48a5c', '#7d6748', '#e2d4b0'], 0.04, 0.8),
  // ---------------------------------------------------------------- incomuns
  S('military_camo', 'Camuflagem Militar', 3, 'incomum', 'camuflagem', 'camo', ['#5a6338', '#33391f', '#8a7d52', '#1d2014'], 0.05, 0.8),
  S('digital_urban', 'Digital Urbano', 3, 'incomum', 'camuflagem', 'digital', ['#8b9096', '#5e646b', '#3a3e44', '#c4c8cc'], 0.06, 0.75),
  S('digital_desert', 'Digital Deserto', 4, 'incomum', 'camuflagem', 'digital', ['#c2ad83', '#9c8460', '#6f5b40', '#ddd0b2'], 0.06, 0.75),
  S('arctic', 'Ártico', 4, 'incomum', 'camuflagem', 'snow', ['#e8ecef', '#b9c2c9', '#8a96a0', '#5d6873'], 0.05, 0.7),
  S('tiger_stripe', 'Listras de Tigre', 5, 'incomum', 'camuflagem', 'tiger', ['#7b7a45', '#3b3d22', '#9c8a55', '#14150d'], 0.05, 0.75),
  // ---------------------------------------------------------------- raras
  S('carbon', 'Carbono', 5, 'rara', 'metálica', 'carbon', ['#141518', '#2a2d31', '#4a4f55'], 0.35, 0.32, { relief: 0.6 }),
  S('anodized_blue', 'Anodizado Azul', 6, 'rara', 'metálica', 'brushed', ['#0f2c5c', '#2e6fd1', '#0a1d3d'], 0.9, 0.3, { relief: 0.35 }),
  S('titanium', 'Titânio', 6, 'rara', 'metálica', 'brushed', ['#6f747a', '#b8bec4', '#4a4f55'], 1, 0.34, { relief: 0.35 }),
  S('crimson_web', 'Teia Carmesim', 7, 'rara', 'vermelha', 'geometric', ['#4a0a0c', '#b3141b', '#ff4a3d', '#140203'], 0.2, 0.42),
  S('hex_steel', 'Hexágono de Aço', 7, 'rara', 'padrão', 'hex', ['#2b2f35', '#4d545c', '#8f98a2', '#16181b'], 0.75, 0.38, { relief: 0.8 }),
  S('red_splash', 'Respingo Vermelho', 8, 'rara', 'vermelha', 'splatter', ['#1b1c1e', '#c4161c', '#ff5b3a', '#3a3c40'], 0.15, 0.5),
  // ---------------------------------------------------------------- épicas
  S('black_ice', 'Gelo Negro', 9, 'épica', 'futurista', 'ice', ['#0b0f16', '#1b2a3c', '#7fd4ff'], 0.6, 0.18, { emissive: '#06202e' }),
  S('inferno', 'Inferno', 10, 'épica', 'vermelha', 'flames', ['#120604', '#c2280c', '#ff8a1c', '#ffd75a'], 0.25, 0.45, { emissive: '#3a0c02' }),
  S('neon_circuit', 'Circuito Néon', 11, 'épica', 'futurista', 'circuit', ['#06080c', '#121a24', '#00e5ff', '#ff2bd6'], 0.55, 0.28, { emissive: '#00313a', relief: 0.5 }),
  S('chrome', 'Cromado', 12, 'épica', 'metálica', 'brushed', ['#9ea4ab', '#f1f4f7', '#5a6067'], 1, 0.08, { relief: 0.15 }),
  S('red_stripes', 'Faixa de Corrida', 12, 'épica', 'vermelha', 'stripes', ['#f2f2f0', '#c91a1f', '#151517'], 0.3, 0.3),
  // ---------------------------------------------------------------- lendárias
  S('blue_dragon', 'Dragão Azul', 14, 'lendária', 'padrão', 'scales', ['#071a3a', '#1556b8', '#58b6ff', '#d6ecff'], 0.45, 0.3, { relief: 0.7 }),
  S('gold', 'Ouro Polido', 15, 'lendária', 'preta e dourada', 'brushed', ['#a8781c', '#f3d27a', '#7a5410'], 1, 0.22, { relief: 0.3 }),
  S('black_gold', 'Preto e Ouro', 16, 'lendária', 'preta e dourada', 'damascus', ['#0c0c0d', '#1d1d20', '#d6a738', '#f6dc8a'], 0.85, 0.26, { relief: 0.6 }),
  S('ruby_damascus', 'Damasco Rubi', 18, 'lendária', 'vermelha', 'damascus', ['#2a0306', '#6e0b12', '#e0303b', '#ff9aa0'], 0.9, 0.24, { relief: 0.6 }),
  S('plasma', 'Plasma', 20, 'lendária', 'futurista', 'hex', ['#05040c', '#1a0f3a', '#8a4dff', '#4df0ff'], 0.5, 0.22, { emissive: '#22105a', relief: 0.6 })
];

const byId = new Map(SKINS.map(s => [s.id, s]));
/** Nomes antigos salvos no aparelho. */
const RENAMED: Record<string, string> = {};

export function skinById(id: string | undefined): SkinDef {
  return byId.get(RENAMED[id ?? ''] ?? id ?? '') ?? SKINS[0];
}

/** Valida um mapa arma→skin (tamanho, ids conhecidos e nível do jogador). Ver também sanitizeCosmetics. */
export function sanitizeSkins(raw: unknown, level: number): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== 'object') return out;
  let n = 0;
  for (const [w, s] of Object.entries(raw as Record<string, unknown>)) {
    if (++n > 40) break;
    const def = byId.get(String(s));
    if (def && def.level <= level && /^[a-z0-9]{2,12}$/.test(w)) out[w] = def.id;
  }
  return out;
}

export function randomSkins(weapons: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const w of weapons) out[w] = SKINS[Math.floor(Math.random() * SKINS.length)].id;
  return out;
}
