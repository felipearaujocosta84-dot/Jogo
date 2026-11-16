// Perfil competitivo: XP, nível, MMR (habilidade), patentes, estatísticas e histórico de partidas.
// Compartilhado: o servidor guarda os perfis online e o navegador guarda o perfil offline.
import type { GameMode, Team } from '../sim/types';

export interface MatchRecord {
  date: number;
  mode: GameMode;
  mapId: string;
  online: boolean;
  result: 'win' | 'loss' | 'draw';
  score: string;
  team: Team;
  kills: number;
  deaths: number;
  assists: number;
  mvps: number;
  mmrDelta: number;
  xp: number;
  coins?: number;
}

export interface ProfileData {
  id: string;
  name: string;
  xp: number;
  mmr: number;
  wins: number;
  losses: number;
  draws: number;
  kills: number;
  deaths: number;
  assists: number;
  headshots: number;
  mvps: number;
  matches: number;
  roundsWon: number;
  /** Moedas de campanha ganhas nas partidas. */
  coins?: number;
  history: MatchRecord[];
}

export const RANKS = [
  'Recruta I', 'Recruta II', 'Recruta III',
  'Soldado I', 'Soldado II', 'Soldado III',
  'Cabo I', 'Cabo II', 'Cabo III',
  'Sargento I', 'Sargento II', 'Sargento III',
  'Tenente', 'Capitão', 'Major', 'Coronel', 'General', 'Lenda do Strike'
];

export function rankIndex(mmr: number): number {
  return Math.max(0, Math.min(RANKS.length - 1, Math.floor((mmr - 600) / 75)));
}

export function rankName(mmr: number): string {
  return RANKS[rankIndex(mmr)];
}

export function levelFor(xp: number): { level: number; into: number; need: number } {
  let level = 1, need = 500, left = xp;
  while (left >= need) {
    left -= need;
    level++;
    need = Math.round(need * 1.12);
  }
  return { level, into: left, need };
}

export function newProfile(id: string, name: string): ProfileData {
  return { id, name, xp: 0, mmr: 1000, wins: 0, losses: 0, draws: 0, kills: 0, deaths: 0, assists: 0, headshots: 0, mvps: 0, matches: 0, roundsWon: 0, history: [] };
}

export const BOT_MMR = { easy: 800, normal: 1050, hard: 1350 };

export interface PlayerMatchStats {
  team: Team;
  kills: number;
  deaths: number;
  assists: number;
  headshots: number;
  mvps: number;
  won: boolean | null;
}

/** Aplica o resultado de uma partida ao perfil (Elo para o MMR) e retorna o registro do histórico. */
export function applyMatch(
  p: ProfileData,
  s: PlayerMatchStats,
  info: { mode: GameMode; mapId: string; online: boolean; scoreOwn: number; scoreEnemy: number; teamMmr: number; enemyMmr: number }
): MatchRecord {
  const result = s.won === null ? 'draw' : s.won ? 'win' : 'loss';
  let mmrDelta = 0;
  if (info.mode === 'competitive') {
    const expected = 1 / (1 + Math.pow(10, (info.enemyMmr - info.teamMmr) / 400));
    const actual = result === 'win' ? 1 : result === 'draw' ? 0.5 : 0;
    const perf = Math.max(-6, Math.min(6, (s.kills - s.deaths) * 0.6 + s.mvps));
    mmrDelta = Math.round(40 * (actual - expected) + perf);
  }
  const xp = Math.max(50, s.kills * 10 + s.assists * 5 + s.mvps * 20 + info.scoreOwn * (info.mode === 'tdm' ? 2 : 15) + (result === 'win' ? 200 : result === 'draw' ? 100 : 50)) * (info.mode === 'competitive' ? 1 : 0.6);
  p.mmr = Math.max(100, p.mmr + mmrDelta);
  p.xp += Math.round(xp);
  const coins = Math.round(xp / 6) + (result === 'win' ? 25 : 0);
  p.coins = (p.coins ?? 0) + coins;
  p.matches++;
  if (result === 'win') p.wins++;
  else if (result === 'loss') p.losses++;
  else p.draws++;
  p.kills += s.kills;
  p.deaths += s.deaths;
  p.assists += s.assists;
  p.headshots += s.headshots;
  p.mvps += s.mvps;
  p.roundsWon += info.scoreOwn;
  const rec: MatchRecord = {
    date: Date.now(), mode: info.mode, mapId: info.mapId, online: info.online, result,
    score: `${info.scoreOwn}-${info.scoreEnemy}`, team: s.team, kills: s.kills, deaths: s.deaths, assists: s.assists,
    mvps: s.mvps, mmrDelta, xp: Math.round(xp), coins
  };
  p.history.unshift(rec);
  if (p.history.length > 30) p.history.length = 30;
  return rec;
}
