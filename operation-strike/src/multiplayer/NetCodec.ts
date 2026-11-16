// Formato compacto das atualizações da partida online (cliente e servidor):
//  - "roster": dados que mudam pouco (nome, equipe, placar individual, visual) — enviado 2×/s ou quando muda;
//  - "snapshot": só o estado dinâmico de cada jogador, em tupla (sem nomes de campos), 20×/s;
//  - interesse: no Battle Royale cada cliente recebe só quem está por perto.
// O cliente junta roster + tupla e volta a ter o PlayerView completo usado pelo jogo.
import type { PlayerView, Snapshot } from '../sim/types';

export interface RosterEntry {
  id: string;
  name: string;
  team: PlayerView['team'];
  bot: boolean;
  kills: number;
  deaths: number;
  assists: number;
  score: number;
  mvps: number;
  ping: number;
  connected: boolean;
  variant: number;
  look: string;
  /** Dinheiro: só dos companheiros (o dos inimigos não é enviado). */
  money: number;
}

/**
 * [id, x, y, z, vx, vy, vz, yaw, pitch, flags, hp, armor, weapon, act, skin, att]
 * Números inteiros (msgpack: 1–3 bytes): posição em cm, velocidade em dm/s, ângulos em milirradianos.
 */
export type DynTuple = [string, number, number, number, number, number, number, number, number, number, number, number, string, number, string, string];

/**
 * `doors`, `you`, `round` e `bomb` só vêm quando mudam (o cliente mantém o último valor; o relógio da rodada
 * continua correndo no cliente entre os envios).
 */
export type NetSnapshot = Omit<Snapshot, 'players' | 'doors' | 'you' | 'round' | 'bomb'> & {
  players: DynTuple[];
  doors?: boolean[];
  you?: Snapshot['you'];
  round?: Snapshot['round'];
  bomb?: Snapshot['bomb'];
};

/** Junta uma atualização parcial com a anterior (campos ausentes = sem mudança). */
export function mergeSnapshot(prev: Snapshot | null, s: NetSnapshot, players: Snapshot['players']): Snapshot {
  return {
    tick: s.tick, ack: s.ack, events: s.events, nades: s.nades, players,
    round: s.round ?? prev!.round, bomb: s.bomb ?? prev!.bomb, doors: s.doors ?? prev?.doors ?? [],
    you: 'you' in s && s.you !== undefined ? s.you : prev?.you ?? null
  };
}

const F = { crouch: 1, ground: 2, alive: 4, helmet: 8, kit: 16, bomb: 32, prot: 64 };

export function rosterOf(p: PlayerView, showMoney: boolean): RosterEntry {
  return {
    id: p.id, name: p.name, team: p.team, bot: p.bot, kills: p.kills, deaths: p.deaths, assists: p.assists, score: p.score,
    mvps: p.mvps, ping: p.ping, connected: p.connected, variant: p.variant, look: p.look ?? '', money: showMoney ? p.money : 0
  };
}

/** Estado dinâmico; `hideHp` esconde vida/colete de inimigos (não vaza informação). */
export function encodeDyn(p: PlayerView, hideHp: boolean): DynTuple {
  const flags = (p.crouch ? F.crouch : 0) | (p.ground ? F.ground : 0) | (p.alive ? F.alive : 0) | (p.helmet ? F.helmet : 0) |
    (p.kit ? F.kit : 0) | (p.bomb ? F.bomb : 0) | (p.prot ? F.prot : 0);
  return [p.id, Math.round(p.x * 100), Math.round(p.y * 100), Math.round(p.z * 100), Math.round(p.vx * 10), Math.round(p.vy * 10), Math.round(p.vz * 10), Math.round(p.yaw * 1000), Math.round(p.pitch * 1000), flags, hideHp ? (p.alive ? 100 : 0) : p.hp, hideHp ? 0 : p.armor, p.weapon, p.act, p.skin, p.att ?? ''];
}

export function decodeDyn(t: DynTuple, r: RosterEntry | undefined): PlayerView {
  const f = t[9];
  return {
    id: t[0], name: r?.name ?? '', team: r?.team ?? 'T', bot: r?.bot ?? false,
    x: t[1] / 100, y: t[2] / 100, z: t[3] / 100, vx: t[4] / 10, vy: t[5] / 10, vz: t[6] / 10, yaw: t[7] / 1000, pitch: t[8] / 1000,
    crouch: !!(f & F.crouch), ground: !!(f & F.ground), alive: !!(f & F.alive), helmet: !!(f & F.helmet), kit: !!(f & F.kit), bomb: !!(f & F.bomb), prot: !!(f & F.prot),
    hp: t[10], armor: t[11], weapon: t[12], act: t[13], skin: t[14], att: t[15],
    money: r?.money ?? 0, kills: r?.kills ?? 0, deaths: r?.deaths ?? 0, assists: r?.assists ?? 0, score: r?.score ?? 0, mvps: r?.mvps ?? 0,
    ping: r?.ping ?? 0, connected: r?.connected ?? true, variant: r?.variant ?? 0, look: r?.look ?? ''
  };
}
