// Mensagens trocadas entre cliente e servidor (JSON sobre WebSocket).
import type { Difficulty, GameMode, Snapshot, Team, UserCmd } from '../sim/types';
import type { ProfileData } from '../save/Profile';
import type { MatchResult } from '../sim/MatchSim';

export interface RoomPlayerInfo {
  id: string;
  name: string;
  team: Team;
  bot: boolean;
  connected: boolean;
  mmr: number;
  /** Conta do jogador (vazio para bots). */
  userId?: string;
}

/** Configurações da sala (só o dono altera). */
export interface RoomSettingsInfo {
  mode: GameMode;
  mapId: string;
  difficulty: Difficulty;
  maxPlayers: number;
  isPublic: boolean;
  bots: boolean;
  rounds: number;
  primary: string;
  secondary: string;
  timeLimit: number;
  killLimit: number;
}

export interface RoomInfo {
  code: string;
  mode: GameMode;
  mapId: string;
  difficulty: Difficulty;
  host: string;
  state: 'lobby' | 'playing' | 'over';
  isPublic: boolean;
  humans: number;
  avgMmr: number;
  countdown: number;
  players: RoomPlayerInfo[];
  /** Dono da sala (conta) e configurações completas. */
  owner?: string;
  ownerName?: string;
  settings?: RoomSettingsInfo;
  hasPassword?: boolean;
  /** X1: quem já pediu revanche. */
  rematch?: string[];
}

export type ClientMsg =
  | { t: 'hello'; name: string; profileId: string; token?: string }
  | { t: 'list' }
  | { t: 'create'; mode: GameMode; mapId: string; difficulty: Difficulty; isPublic: boolean }
  | { t: 'join'; code: string }
  | { t: 'quick'; mode: GameMode }
  | { t: 'team'; team: Team }
  | { t: 'start' }
  | { t: 'cmd'; c: UserCmd[] }
  | { t: 'buy'; item: string }
  | { t: 'skins'; skins: Record<string, string> }
  | { t: 'chat'; text: string }
  | { t: 'leave' }
  | { t: 'ping'; ts: number; rtt?: number };

export type ServerMsg =
  | { t: 'welcome'; clientId: string; token: string; profile: ProfileData; resumed: boolean }
  | { t: 'rooms'; rooms: RoomInfo[] }
  | { t: 'room'; room: RoomInfo; you: string | null }
  | { t: 'start'; mapId: string; mode: GameMode; you: string }
  | { t: 'snap'; s: Snapshot }
  | { t: 'end'; result: MatchResult; profile: ProfileData | null }
  | { t: 'error'; msg: string }
  | { t: 'info'; msg: string }
  | { t: 'chat'; from: string; text: string }
  | { t: 'pong'; ts: number };
