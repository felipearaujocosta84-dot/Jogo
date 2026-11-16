// Tipos compartilhados entre cliente, simulação local e servidor.
export type Team = 'T' | 'CT';
export type Difficulty = 'easy' | 'normal' | 'hard';
export type GameMode = 'competitive' | 'casual' | 'training' | 'tdm';

/** Botões de um comando (bits). */
export const BTN = {
  FIRE: 1,
  AIM: 2,
  RELOAD: 4,
  JUMP: 8,
  CROUCH: 16,
  WALK: 32,
  USE: 64,
  ZOOM: 128,
  NEXT: 256,
  DROP: 512,
  SPRINT: 1024
} as const;

/** Comando do jogador para um passo de simulação (1/60 s). */
export interface UserCmd {
  seq: number;
  /** Movimento: x lateral, y frente (-1..1). */
  mx: number;
  my: number;
  yaw: number;
  pitch: number;
  buttons: number;
  /** Arma pedida: 0 nenhuma, 1 primária, 2 secundária, 3 faca, 4 granadas (alterna), 5 bomba. */
  sel: number;
  /** Tick do servidor que o cliente estava vendo (compensação de latência). */
  rt?: number;
}

export type Slot = 'primary' | 'secondary' | 'knife' | 'he' | 'flash' | 'smoke' | 'c4';

export interface SimEvent {
  type: string;
  [k: string]: unknown;
}

export type RoundPhase = 'warmup' | 'freeze' | 'live' | 'end' | 'over';

export interface PlayerView {
  id: string;
  name: string;
  team: Team;
  bot: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  pitch: number;
  crouch: boolean;
  ground: boolean;
  alive: boolean;
  hp: number;
  armor: number;
  helmet: boolean;
  kit: boolean;
  money: number;
  weapon: string;
  bomb: boolean;
  /** Animação: 0 nada, 1 recarregando, 2 plantando, 3 desarmando */
  act: number;
  kills: number;
  deaths: number;
  assists: number;
  score: number;
  mvps: number;
  ping: number;
  connected: boolean;
  variant: number;
  /** Skin da arma em uso. */
  skin: string;
  /** Proteção de renascimento ativa (mata-mata). */
  prot?: boolean;
}

export interface BombView {
  state: 'carried' | 'dropped' | 'planted' | 'defused' | 'exploded' | 'none';
  x: number;
  y: number;
  z: number;
  carrier: string | null;
  timeLeft: number;
  site: 'A' | 'B' | null;
  defuser: string | null;
  progress: number;
}

export interface NadeView {
  id: number;
  type: 'he' | 'flash' | 'smoke';
  x: number;
  y: number;
  z: number;
  /** fumaça ativa: tempo restante */
  smoke: number;
}

export interface RoundView {
  phase: RoundPhase;
  timeLeft: number;
  number: number;
  maxRounds: number;
  winRounds: number;
  scoreT: number;
  scoreCT: number;
  mode: GameMode;
  mapId: string;
  lastWinner: Team | null;
  lastReason: string;
  buyTimeLeft: number;
  halftime: boolean;
}

/** Dados privados do jogador local (inventário). */
export interface LocalView {
  slots: { slot: Slot; id: string; ammo: number; reserve: number }[];
  active: Slot;
  ammo: number;
  reserve: number;
  reloading: boolean;
  flash: number;
  scope: number;
  plantProgress: number;
  defuseProgress: number;
  canBuy: boolean;
  punchPitch: number;
  punchYaw: number;
  spread: number;
}

export interface Snapshot {
  tick: number;
  ack: number;
  round: RoundView;
  players: PlayerView[];
  bomb: BombView;
  nades: NadeView[];
  doors: boolean[];
  you: LocalView | null;
  events: SimEvent[];
}
