// Validação das mensagens dos clientes: tudo que chega é tratado como não confiável.
import { WEAPONS } from '../../src/weapons/WeaponData';
import { MAPS, mapAllows } from '../../src/maps/maps';
import type { Difficulty, GameMode, Team, UserCmd } from '../../src/sim/types';

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Comando de movimento/ação: só campos conhecidos, números finitos e faixas válidas. */
export function cleanCmd(raw: unknown): UserCmd | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Record<string, unknown>;
  if (!isNum(c.seq) || !isNum(c.yaw) || !isNum(c.pitch) || !isNum(c.mx) || !isNum(c.my)) return null;
  const seq = Math.floor(c.seq);
  if (seq < 1 || seq > 1e9) return null;
  const cmd: UserCmd = {
    seq,
    mx: clamp(c.mx, -1, 1),
    my: clamp(c.my, -1, 1),
    yaw: ((c.yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2),
    pitch: clamp(c.pitch, -1.55, 1.55),
    buttons: isNum(c.buttons) ? Math.floor(c.buttons) & 0x7ff : 0,
    sel: isNum(c.sel) ? clamp(Math.floor(c.sel), 0, 5) : 0
  };
  if (isNum(c.rt)) cmd.rt = Math.floor(c.rt);
  return cmd;
}

export const MODES: GameMode[] = ['competitive', 'casual', 'tdm', 'x1', 'br'];

export interface RoomSettings {
  mode: GameMode;
  mapId: string;
  difficulty: Difficulty;
  /** Jogadores no total (humanos + bots). */
  maxPlayers: number;
  isPublic: boolean;
  bots: boolean;
  /** X1: rodadas para vencer. */
  rounds: number;
  /** Mata-mata/X1/BR: armas iniciais. */
  primary: string;
  secondary: string;
  /** Mata-mata: minutos e abates. */
  timeLimit: number;
  killLimit: number;
}

export function maxFor(mode: GameMode): number {
  return mode === 'x1' ? 2 : mode === 'br' ? 50 : 10;
}

export const DEFAULT_SETTINGS: RoomSettings = {
  mode: 'competitive', mapId: 'dust_zone', difficulty: 'normal', maxPlayers: 10, isPublic: false, bots: true,
  rounds: 5, primary: 'ak47', secondary: 'deagle', timeLimit: 10, killLimit: 50
};

/** Junta e valida configurações (as anteriores valem para o que não veio). */
export function cleanSettings(raw: unknown, prev: RoomSettings = DEFAULT_SETTINGS): RoomSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const s: RoomSettings = { ...prev };
  if (MODES.includes(r.mode as GameMode)) s.mode = r.mode as GameMode;
  if (typeof r.mapId === 'string' && MAPS[r.mapId]) s.mapId = r.mapId;
  if (!mapAllows(MAPS[s.mapId], s.mode)) s.mapId = Object.keys(MAPS).find(id => mapAllows(MAPS[id], s.mode)) ?? 'dust_zone';
  if (['easy', 'normal', 'hard'].includes(r.difficulty as string)) s.difficulty = r.difficulty as Difficulty;
  if (isNum(r.maxPlayers)) s.maxPlayers = Math.floor(r.maxPlayers);
  s.maxPlayers = s.mode === 'x1' ? 2 : clamp(s.maxPlayers, 2, maxFor(s.mode));
  if (s.mode !== 'br' && s.mode !== 'x1') s.maxPlayers = Math.min(10, s.maxPlayers + (s.maxPlayers % 2));
  if (typeof r.isPublic === 'boolean') s.isPublic = r.isPublic;
  if (typeof r.bots === 'boolean') s.bots = r.bots;
  if (s.mode === 'x1') s.bots = false;
  if (isNum(r.rounds)) s.rounds = clamp(Math.floor(r.rounds), 1, 15);
  if (typeof r.primary === 'string' && WEAPONS[r.primary]?.slot === 'primary') s.primary = r.primary;
  if (typeof r.secondary === 'string' && WEAPONS[r.secondary]?.slot === 'secondary') s.secondary = r.secondary;
  if (isNum(r.timeLimit)) s.timeLimit = clamp(Math.floor(r.timeLimit), 3, 30);
  if (isNum(r.killLimit)) s.killLimit = clamp(Math.floor(r.killLimit), 10, 200);
  return s;
}

export function cleanTeam(v: unknown): Team | null {
  return v === 'T' || v === 'CT' ? v : null;
}

export function cleanText(v: unknown, max: number): string {
  return String(v ?? '').replace(/[<>\u0000-\u001f]/g, '').slice(0, max).trim();
}
