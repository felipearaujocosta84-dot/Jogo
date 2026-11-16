// Catálogo dos cosméticos (dados puros: cliente, simulação e servidor).
//  - Acessórios das armas: modelos 3D separados presos em pontos de encaixe (trilho superior, cano, trilho inferior,
//    lateral) ou acabamento do carregador. Só visuais: não mudam dano, recuo, precisão nem som.
//  - Peças do personagem: capacete, máscara, óculos, mochila e acessórios são modelos 3D presos aos ossos;
//    colete, uniforme, calças, luvas e botas trocam cor/camuflagem da própria roupa do modelo (por região).
//  - Codificação compacta para salvar e enviar pela rede junto com as skins:
//      skins[arma] = skin, skins['a_' + arma] = "acessório.acessório", skins['lk_CT' | 'lk_T'] = visual.
import type { Team } from '../sim/types';
import { RARITIES, type Rarity } from './Rarity';
import { SKINS } from '../weapons/Skins';

// ====================================================================== acessórios das armas

export type AttachSlot = 'optic' | 'muzzle' | 'grip' | 'light' | 'laser' | 'mag';

export const ATTACH_SLOTS: { id: AttachSlot; name: string }[] = [
  { id: 'optic', name: 'Mira' },
  { id: 'muzzle', name: 'Cano' },
  { id: 'grip', name: 'Empunhadura' },
  { id: 'light', name: 'Lanterna' },
  { id: 'laser', name: 'Laser' },
  { id: 'mag', name: 'Carregador' }
];

export interface AttachmentDef {
  id: string;
  name: string;
  slot: AttachSlot;
  rarity: Rarity;
  level: number;
  /** Modelo 3D em public/assets/attachments/<model>.glb (carregadores: só acabamento, sem modelo). */
  model?: string;
  /** Acabamento do carregador (cor e material). */
  finish?: { color: string; metallic: number; roughness: number };
  desc: string;
}

export const ATTACHMENTS: AttachmentDef[] = [
  { id: 'reddot', name: 'Red dot compacta', slot: 'optic', rarity: 'comum', level: 1, model: 'reddot', desc: 'Mira de ponto vermelho de tubo curto.' },
  { id: 'holo', name: 'Mira holográfica', slot: 'optic', rarity: 'incomum', level: 3, model: 'holo', desc: 'Janela retangular com retículo circular.' },
  { id: 'scope4x', name: 'Mira óptica 4x', slot: 'optic', rarity: 'rara', level: 6, model: 'scope4x', desc: 'Luneta de combate com protetor de lente.' },
  { id: 'pdot', name: 'Red dot de pistola', slot: 'optic', rarity: 'incomum', level: 2, model: 'pistol_dot', desc: 'Mira aberta de perfil baixo para ferrolho.' },
  { id: 'supp', name: 'Silenciador de fuzil', slot: 'muzzle', rarity: 'incomum', level: 3, model: 'suppressor', desc: 'Supressor cilíndrico com encaixe rápido.' },
  { id: 'psupp', name: 'Silenciador de pistola', slot: 'muzzle', rarity: 'incomum', level: 3, model: 'pistol_suppressor', desc: 'Supressor curto rosqueado.' },
  { id: 'comp', name: 'Compensador', slot: 'muzzle', rarity: 'comum', level: 2, model: 'compensator', desc: 'Freio de boca com janelas laterais.' },
  { id: 'vgrip', name: 'Empunhadura vertical', slot: 'grip', rarity: 'comum', level: 1, model: 'vgrip', desc: 'Punho frontal com ranhuras.' },
  { id: 'agrip', name: 'Empunhadura angulada', slot: 'grip', rarity: 'incomum', level: 4, model: 'agrip', desc: 'Apoio inclinado para o polegar.' },
  { id: 'light', name: 'Lanterna tática', slot: 'light', rarity: 'comum', level: 2, model: 'flashlight', desc: 'Lanterna de trilho com chave traseira.' },
  { id: 'plight', name: 'Lanterna de pistola', slot: 'light', rarity: 'comum', level: 2, model: 'pistol_light', desc: 'Lanterna compacta sob o cano.' },
  { id: 'laser', name: 'Módulo laser', slot: 'laser', rarity: 'rara', level: 5, model: 'laser', desc: 'Caixa de laser com feixe vermelho visível.' },
  { id: 'mag_tan', name: 'Carregador areia', slot: 'mag', rarity: 'comum', level: 1, finish: { color: '#9a8158', metallic: 0, roughness: 0.7 }, desc: 'Polímero cor areia.' },
  { id: 'mag_steel', name: 'Carregador de aço', slot: 'mag', rarity: 'incomum', level: 3, finish: { color: '#8d939a', metallic: 1, roughness: 0.32 }, desc: 'Aço escovado.' },
  { id: 'mag_red', name: 'Carregador vermelho', slot: 'mag', rarity: 'rara', level: 6, finish: { color: '#a3141a', metallic: 0.3, roughness: 0.38 }, desc: 'Anodizado vermelho.' },
  { id: 'mag_gold', name: 'Carregador dourado', slot: 'mag', rarity: 'lendária', level: 14, finish: { color: '#e0b04a', metallic: 1, roughness: 0.2 }, desc: 'Banho de ouro polido.' }
];

const attachById = new Map(ATTACHMENTS.map(a => [a.id, a]));
export function attachmentById(id: string): AttachmentDef | undefined {
  return attachById.get(id);
}

/**
 * O que cada arma aceita (por encaixe). Acessórios integrados (mira da AUG e das snipers, silenciador
 * da M4A1-S e da USP-S) excluem o encaixe correspondente.
 */
const RIFLE = { optic: ['reddot', 'holo', 'scope4x'], muzzle: ['supp', 'comp'], grip: ['vgrip', 'agrip'], light: ['light'], laser: ['laser'], mag: ['mag_tan', 'mag_steel', 'mag_red', 'mag_gold'] };
const SMG = { optic: ['reddot', 'holo'], muzzle: ['supp', 'comp'], grip: ['vgrip', 'agrip'], light: ['light'], laser: ['laser'], mag: ['mag_tan', 'mag_steel', 'mag_red', 'mag_gold'] };
const PISTOL = { optic: ['pdot'], muzzle: ['psupp'], light: ['plight'], laser: ['laser'], mag: ['mag_steel', 'mag_red', 'mag_gold'] };
type Compat = Partial<Record<AttachSlot, string[]>>;
export const WEAPON_ATTACH: Record<string, Compat> = {
  ak47: RIFLE,
  m4a4: RIFLE,
  m4a1: { ...RIFLE, muzzle: [] },
  aug: { ...RIFLE, optic: [], grip: [] },
  mp5: SMG,
  ump45: SMG,
  mac10: { ...SMG, light: [], grip: ['vgrip'] },
  awp: { muzzle: ['supp'], laser: ['laser'], mag: RIFLE.mag },
  ssg08: { muzzle: ['supp'], laser: ['laser'], mag: RIFLE.mag },
  glock: PISTOL,
  p250: PISTOL,
  usp: { ...PISTOL, muzzle: [] },
  deagle: { ...PISTOL, muzzle: [] }
};

/** Acessórios fixos que já fazem parte da arma (mostrados no arsenal como "integrado"). */
export const INTEGRATED: Record<string, string[]> = { m4a1: ['Silenciador integrado'], usp: ['Silenciador integrado'], aug: ['Luneta integrada', 'Empunhadura dobrável'], awp: ['Luneta'], ssg08: ['Luneta'] };

export function compatible(weapon: string, att: string): boolean {
  const a = attachById.get(att);
  return !!a && !!WEAPON_ATTACH[weapon]?.[a.slot]?.includes(att);
}

/** Lê "a.b.c" e devolve só os acessórios válidos (um por encaixe). */
export function parseAttachments(weapon: string, raw: string | undefined, level = 99): string[] {
  if (!raw) return [];
  const used = new Set<AttachSlot>();
  const out: string[] = [];
  for (const id of raw.split('.').slice(0, 6)) {
    const a = attachById.get(id);
    if (!a || a.level > level || used.has(a.slot) || !compatible(weapon, id)) continue;
    used.add(a.slot);
    out.push(id);
  }
  return out;
}

// ====================================================================== personagem

export type CharSlot = 'helmet' | 'mask' | 'glasses' | 'vest' | 'uniform' | 'pants' | 'gloves' | 'boots' | 'backpack' | 'accessory';

export const CHAR_SLOTS: { id: CharSlot; name: string; kind: 'model' | 'finish' }[] = [
  { id: 'helmet', name: 'Capacete', kind: 'model' },
  { id: 'mask', name: 'Máscara', kind: 'model' },
  { id: 'glasses', name: 'Óculos', kind: 'model' },
  { id: 'vest', name: 'Colete', kind: 'finish' },
  { id: 'uniform', name: 'Uniforme', kind: 'finish' },
  { id: 'pants', name: 'Calças', kind: 'finish' },
  { id: 'gloves', name: 'Luvas', kind: 'finish' },
  { id: 'boots', name: 'Botas', kind: 'finish' },
  { id: 'backpack', name: 'Mochila', kind: 'model' },
  { id: 'accessory', name: 'Acessórios', kind: 'model' }
];

/** Acabamento de tecido/equipamento (cor lisa ou camuflagem aplicada sobre a roupa original). */
export interface FinishDef {
  id: string;
  name: string;
  rarity: Rarity;
  level: number;
  /** 'orig' = sem mudança. */
  pattern: 'orig' | 'solid' | 'woodland' | 'desert' | 'arid' | 'digital' | 'snow' | 'tiger' | 'urban' | 'blackgold';
  colors: string[];
}

export const FINISHES: FinishDef[] = [
  { id: 'orig', name: 'Original', rarity: 'comum', level: 1, pattern: 'orig', colors: [] },
  { id: 'olive', name: 'Verde oliva', rarity: 'comum', level: 1, pattern: 'solid', colors: ['#4d5537'] },
  { id: 'coyote', name: 'Coyote', rarity: 'comum', level: 1, pattern: 'solid', colors: ['#8b7553'] },
  { id: 'black', name: 'Preto tático', rarity: 'comum', level: 1, pattern: 'solid', colors: ['#232427'] },
  { id: 'ranger', name: 'Verde ranger', rarity: 'comum', level: 2, pattern: 'solid', colors: ['#3d4634'] },
  { id: 'navy', name: 'Azul marinho', rarity: 'incomum', level: 3, pattern: 'solid', colors: ['#25324a'] },
  { id: 'urban', name: 'Cinza urbano', rarity: 'incomum', level: 3, pattern: 'urban', colors: ['#6f747a', '#4c5157', '#2f3237', '#9ca1a6'] },
  { id: 'woodland', name: 'Floresta', rarity: 'incomum', level: 4, pattern: 'woodland', colors: ['#6b6a3c', '#3c4a26', '#5b4127', '#1d1f16'] },
  { id: 'desert', name: 'Deserto', rarity: 'incomum', level: 4, pattern: 'desert', colors: ['#c3b089', '#9d855a', '#7a6446', '#ddd0ad'] },
  { id: 'arid', name: 'Multiterreno árido', rarity: 'rara', level: 6, pattern: 'arid', colors: ['#a08d68', '#7d7052', '#5f6142', '#c7b48c', '#4a3d2c'] },
  { id: 'digital', name: 'Digital floresta', rarity: 'rara', level: 7, pattern: 'digital', colors: ['#5f6a45', '#3e4630', '#7d7a55', '#262a1d'] },
  { id: 'snow', name: 'Neve', rarity: 'rara', level: 8, pattern: 'snow', colors: ['#e6eaec', '#b7bfc5', '#8a949c', '#5e6870'] },
  { id: 'tiger', name: 'Listras de tigre', rarity: 'épica', level: 10, pattern: 'tiger', colors: ['#7b7a45', '#3b3d22', '#9c8a55', '#14150d'] },
  { id: 'crimson', name: 'Carmesim', rarity: 'épica', level: 12, pattern: 'solid', colors: ['#6e1418'] },
  { id: 'blackgold', name: 'Preto e ouro', rarity: 'lendária', level: 16, pattern: 'blackgold', colors: ['#141416', '#26262a', '#c99a32'] }
];

const finishById = new Map(FINISHES.map(f => [f.id, f]));
export function finishOf(id: string): FinishDef {
  return finishById.get(id) ?? FINISHES[0];
}

/** Peça 3D presa ao corpo. */
export interface GearDef {
  id: string;
  name: string;
  slot: CharSlot;
  rarity: Rarity;
  level: number;
  /** Modelo em public/assets/cosmetics/<model>.glb ('' = nenhum). */
  model: string;
  /** Cor do material "Paint" do modelo (as demais partes ficam como no arquivo). */
  color?: string;
  /** Pinta a cobertura original da cabeça (capacete/lenço do modelo) com um acabamento. */
  headFinish?: string;
}

const G = (id: string, name: string, slot: CharSlot, rarity: Rarity, level: number, model: string, color?: string, headFinish?: string): GearDef => ({ id, name, slot, rarity, level, model, color, headFinish });

export const GEAR: GearDef[] = [
  // capacete: o original do modelo (com troca de cor) ou capacetes 3D que o cobrem
  G('helm_orig', 'Original', 'helmet', 'comum', 1, ''),
  G('helm_orig_black', 'Original preto', 'helmet', 'comum', 1, '', undefined, 'black'),
  G('helm_orig_tan', 'Original coyote', 'helmet', 'comum', 2, '', undefined, 'coyote'),
  G('helm_orig_wood', 'Original floresta', 'helmet', 'incomum', 4, '', undefined, 'woodland'),
  G('helm_ballistic_olive', 'Capacete balístico oliva', 'helmet', 'incomum', 3, 'helmet_ballistic', '#4d5537'),
  G('helm_ballistic_tan', 'Capacete balístico coyote', 'helmet', 'incomum', 3, 'helmet_ballistic', '#8b7553'),
  G('helm_ballistic_black', 'Capacete balístico preto', 'helmet', 'rara', 5, 'helmet_ballistic', '#25272a'),
  G('helm_comms', 'Capacete com abafadores', 'helmet', 'rara', 7, 'helmet_comms', '#5a5b45'),
  G('helm_nvg', 'Capacete com visão noturna', 'helmet', 'épica', 10, 'helmet_nvg', '#2e3033'),
  G('helm_gold', 'Capacete dourado', 'helmet', 'lendária', 18, 'helmet_ballistic', '#d4a63c'),
  // máscara
  G('mask_none', 'Nenhuma', 'mask', 'comum', 1, ''),
  G('mask_half_black', 'Meia-máscara preta', 'mask', 'comum', 2, 'mask_half', '#1e1f22'),
  G('mask_half_olive', 'Meia-máscara oliva', 'mask', 'incomum', 4, 'mask_half', '#4d5537'),
  G('mask_bandana', 'Bandana vermelha', 'mask', 'incomum', 5, 'mask_bandana', '#8e1b1f'),
  G('mask_gas', 'Máscara de gás', 'mask', 'épica', 11, 'mask_gas', '#2b2d2f'),
  // óculos
  G('glasses_none', 'Nenhum', 'glasses', 'comum', 1, ''),
  G('glasses_ballistic', 'Óculos balísticos', 'glasses', 'comum', 1, 'glasses_ballistic', '#1a1b1d'),
  G('glasses_goggles', 'Óculos de proteção', 'glasses', 'incomum', 4, 'goggles', '#5b5a44'),
  G('glasses_gold', 'Óculos lente dourada', 'glasses', 'lendária', 15, 'glasses_ballistic', '#c99a32'),
  // mochila
  G('pack_none', 'Nenhuma', 'backpack', 'comum', 1, ''),
  G('pack_assault_olive', 'Mochila de assalto oliva', 'backpack', 'comum', 2, 'backpack_assault', '#4d5537'),
  G('pack_assault_tan', 'Mochila de assalto coyote', 'backpack', 'incomum', 3, 'backpack_assault', '#8b7553'),
  G('pack_hydro', 'Bolsa de hidratação', 'backpack', 'incomum', 4, 'backpack_hydro', '#3d4634'),
  G('pack_radio', 'Mochila de rádio', 'backpack', 'rara', 8, 'backpack_radio', '#2f3134'),
  // acessórios
  G('acc_none', 'Nenhum', 'accessory', 'comum', 1, ''),
  G('acc_headset', 'Fone tático', 'accessory', 'incomum', 3, 'headset', '#2a2b2e'),
  G('acc_radio', 'Rádio no peito', 'accessory', 'incomum', 4, 'chest_radio', '#25272a'),
  G('acc_kneepads', 'Joelheiras', 'accessory', 'comum', 2, 'kneepads', '#2e3033'),
  G('acc_pouch', 'Bolsa de quadril', 'accessory', 'rara', 6, 'hip_pouch', '#5a5b45')
];

const gearMap = new Map(GEAR.map(g => [g.id, g]));
export function gearById(id: string): GearDef | undefined {
  return gearMap.get(id);
}

/** Visual completo de um personagem (uma escolha por parte). */
export type Look = Record<CharSlot, string>;

export const DEFAULT_LOOK: Look = {
  helmet: 'helm_orig', mask: 'mask_none', glasses: 'glasses_none', vest: 'orig', uniform: 'orig', pants: 'orig',
  gloves: 'orig', boots: 'orig', backpack: 'pack_none', accessory: 'acc_none'
};

/** Itens disponíveis para uma parte (acabamentos ou peças 3D). */
export function itemsFor(slot: CharSlot): { id: string; name: string; rarity: Rarity; level: number }[] {
  const kind = CHAR_SLOTS.find(s => s.id === slot)!.kind;
  return kind === 'finish' ? FINISHES : GEAR.filter(g => g.slot === slot);
}

export function validItem(slot: CharSlot, id: string, level = 99): boolean {
  return itemsFor(slot).some(i => i.id === id && i.level <= level);
}

/** Codifica o visual: "parte=item" só do que difere do padrão, separados por vírgula. */
export function encodeLook(l: Partial<Look>): string {
  return CHAR_SLOTS.filter(s => l[s.id] && l[s.id] !== DEFAULT_LOOK[s.id]).map(s => `${s.id}=${l[s.id]}`).join(',');
}

export function decodeLook(raw: string | undefined, level = 99): Look {
  const out: Look = { ...DEFAULT_LOOK };
  if (!raw) return out;
  for (const part of raw.split(',').slice(0, 12)) {
    const [k, v] = part.split('=');
    const slot = CHAR_SLOTS.find(s => s.id === k)?.id;
    if (slot && v && validItem(slot, v, level)) out[slot] = v;
  }
  return out;
}

// ====================================================================== validação e bots

/**
 * Valida o mapa completo de cosméticos de um jogador (skins + acessórios + visuais), pelo nível.
 * Usado pelo servidor e pela simulação local.
 */
export function sanitizeCosmetics(raw: unknown, level: number): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== 'object') return out;
  let n = 0;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (++n > 80) break;
    const val = String(v ?? '').slice(0, 200);
    if (k.startsWith('a_')) {
      const w = k.slice(2);
      if (!WEAPON_ATTACH[w]) continue;
      const list = parseAttachments(w, val, level);
      if (list.length) out[k] = list.join('.');
    } else if (k === 'lk_CT' || k === 'lk_T') {
      const enc = encodeLook(decodeLook(val, level));
      if (enc) out[k] = enc;
    } else if (/^[a-z0-9]{2,12}$/.test(k)) {
      const def = SKINS.find(s => s.id === val);
      if (def && def.level <= level) out[k] = def.id;
    }
  }
  return out;
}

function pick<T>(list: T[], r: () => number): T {
  return list[Math.floor(r() * list.length) % list.length];
}

/** Visuais prontos dos bots (equipes com identidade própria). */
const BOT_LOOKS: Record<Team, Partial<Look>[]> = {
  CT: [
    {},
    { helmet: 'helm_ballistic_olive', glasses: 'glasses_ballistic', backpack: 'pack_assault_olive', accessory: 'acc_headset' },
    { helmet: 'helm_comms', vest: 'black', gloves: 'black', accessory: 'acc_radio' },
    { helmet: 'helm_orig_black', mask: 'mask_half_black', uniform: 'urban', pants: 'urban', vest: 'black' },
    { helmet: 'helm_nvg', glasses: 'glasses_goggles', vest: 'woodland', backpack: 'pack_radio', accessory: 'acc_kneepads' },
    { helmet: 'helm_ballistic_tan', uniform: 'desert', pants: 'desert', vest: 'coyote', backpack: 'pack_hydro' }
  ],
  T: [
    {},
    { mask: 'mask_bandana', glasses: 'glasses_ballistic', backpack: 'pack_assault_tan' },
    { mask: 'mask_half_olive', uniform: 'olive', pants: 'tiger', accessory: 'acc_pouch' },
    { helmet: 'helm_orig_black', glasses: 'glasses_goggles', pants: 'desert', accessory: 'acc_kneepads' },
    { mask: 'mask_gas', vest: 'black', uniform: 'arid', backpack: 'pack_hydro' },
    { helmet: 'helm_orig_tan', mask: 'mask_half_black', pants: 'digital', boots: 'black', accessory: 'acc_headset' }
  ]
};

/** Cosméticos aleatórios de um bot: skins, alguns acessórios nas armas e um visual para cada equipe. */
export function randomCosmetics(weapons: string[], seed = Math.random() * 1e9): Record<string, string> {
  let t = Math.floor(seed) >>> 0;
  const r = () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
  const out: Record<string, string> = {};
  for (const w of weapons) {
    out[w] = pick(SKINS, r).id;
    const compat = WEAPON_ATTACH[w];
    if (!compat) continue;
    const list: string[] = [];
    for (const slot of ['optic', 'muzzle', 'grip', 'light'] as AttachSlot[]) {
      const opts = compat[slot];
      if (opts?.length && r() < 0.4) list.push(pick(opts, r));
    }
    if (list.length) out['a_' + w] = list.join('.');
  }
  out.lk_CT = encodeLook(pick(BOT_LOOKS.CT, r));
  out.lk_T = encodeLook(pick(BOT_LOOKS.T, r));
  return out;
}

/** Contagem de itens do inventário por categoria (para a interface). */
export function catalogSize(): Record<string, number> {
  return {
    skins: SKINS.length,
    attachments: ATTACHMENTS.length,
    finishes: FINISHES.length,
    gear: GEAR.length,
    rarities: RARITIES.length
  };
}
