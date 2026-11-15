// Sala de jogo no servidor: lobby (times, início), partida autoritativa a 60 ticks/s,
// snapshots a 20/s para cada cliente, eventos, reconexão (bot assume enquanto o jogador está fora)
// e atualização dos perfis no fim.
import { MatchSim, TICK } from '../src/sim/MatchSim';
import { applyMatch, BOT_MMR, type ProfileData } from '../src/save/Profile';
import type { RoomInfo, ServerMsg } from '../src/multiplayer/Protocol';
import type { Difficulty, GameMode, SimEvent, Team, UserCmd } from '../src/sim/types';
import type { ProfileStore } from './ProfileStore';

export interface Client {
  id: string;
  token: string;
  name: string;
  profile: ProfileData;
  send(msg: ServerMsg): void;
  room: Room | null;
  playerId: string | null;
  connected: boolean;
  disconnectedAt: number;
  ping: number;
}

interface Member {
  client: Client;
  playerId: string;
  team: Team;
  events: SimEvent[];
}

const SNAP_EVERY = 3; // 60 / 3 = 20 snapshots por segundo

export class Room {
  sim: MatchSim | null = null;
  state: 'lobby' | 'playing' | 'over' = 'lobby';
  members: Member[] = [];
  host: string;
  countdown = -1;
  private timer: NodeJS.Timeout | null = null;
  private acc = 0;
  private last = 0;
  private emptySince = 0;
  private lobbyIds = 0;

  constructor(
    readonly code: string,
    readonly mode: GameMode,
    readonly mapId: string,
    readonly difficulty: Difficulty,
    readonly isPublic: boolean,
    hostClient: Client,
    private store: ProfileStore,
    private onClose: (r: Room) => void
  ) {
    this.host = hostClient.id;
    // salas públicas de matchmaking começam sozinhas após a contagem
    if (isPublic) this.countdown = 20;
    this.timer = setInterval(() => this.loop(), 15);
  }

  get humans(): number {
    return this.members.filter(m => m.client.connected).length;
  }

  get avgMmr(): number {
    if (!this.members.length) return 1000;
    return this.members.reduce((s, m) => s + m.client.profile.mmr, 0) / this.members.length;
  }

  info(): RoomInfo {
    const players = this.sim
      ? this.sim.players.map(p => {
          const mem = this.members.find(m => m.playerId === p.id);
          return { id: p.id, name: p.name, team: p.team, bot: p.bot && !mem, connected: mem ? mem.client.connected : true, mmr: mem ? mem.client.profile.mmr : BOT_MMR[this.difficulty] };
        })
      : this.members.map(m => ({ id: m.playerId, name: m.client.name, team: m.team, bot: false, connected: m.client.connected, mmr: m.client.profile.mmr }));
    return {
      code: this.code, mode: this.mode, mapId: this.mapId, difficulty: this.difficulty, host: this.host, state: this.state,
      isPublic: this.isPublic, humans: this.humans, avgMmr: Math.round(this.avgMmr), countdown: Math.ceil(this.countdown), players
    };
  }

  broadcastRoom(): void {
    const info = this.info();
    for (const m of this.members) if (m.client.connected) m.client.send({ t: 'room', room: info, you: m.playerId });
  }

  canJoin(): boolean {
    return this.state !== 'over' && this.members.length < 10;
  }

  join(c: Client): string | null {
    if (!this.canJoin()) return 'Sala cheia ou encerrada';
    const t = this.members.filter(m => m.team === 'T').length;
    const ct = this.members.filter(m => m.team === 'CT').length;
    const team: Team = t <= ct ? 'T' : 'CT';
    let playerId = 'h' + ++this.lobbyIds + '_' + c.id.slice(0, 4);
    if (this.sim) {
      const p = this.sim.addPlayer(c.name, { team, id: playerId });
      if (!p) return 'Times cheios';
      playerId = p.id;
    }
    const mem: Member = { client: c, playerId, team, events: [] };
    this.members.push(mem);
    c.room = this;
    c.playerId = playerId;
    if (this.sim) c.send({ t: 'start', mapId: this.mapId, mode: this.mode, you: playerId });
    this.broadcastRoom();
    this.chat('', `${c.name} entrou na sala`);
    return null;
  }

  /** Jogador voltou após queda de conexão: devolve o controle. */
  resume(c: Client): void {
    const mem = this.members.find(m => m.client === c);
    if (!mem) return;
    if (this.sim) {
      this.sim.setBotControl(mem.playerId, false);
      c.send({ t: 'start', mapId: this.mapId, mode: this.mode, you: mem.playerId });
    }
    this.broadcastRoom();
    this.chat('', `${c.name} reconectou`);
  }

  disconnected(c: Client): void {
    const mem = this.members.find(m => m.client === c);
    if (!mem) return;
    if (this.sim && this.state === 'playing') {
      this.sim.setBotControl(mem.playerId, true);
      this.chat('', `${c.name} caiu — um bot assume até a reconexão`);
    }
    this.broadcastRoom();
  }

  leave(c: Client): void {
    const mem = this.members.find(m => m.client === c);
    if (!mem) return;
    this.members = this.members.filter(m => m !== mem);
    c.room = null;
    c.playerId = null;
    if (this.sim) {
      // um bot assume a vaga até o fim
      this.sim.setBotControl(mem.playerId, true);
      const p = this.sim.byId(mem.playerId);
      if (p) {
        p.bot = true;
        p.name = 'BOT ' + p.name;
      }
    }
    if (this.host === c.id && this.members.length) this.host = this.members[0].client.id;
    this.chat('', `${c.name} saiu`);
    this.broadcastRoom();
  }

  setTeam(c: Client, team: Team): void {
    if (this.state !== 'lobby') return;
    const mem = this.members.find(m => m.client === c);
    if (!mem) return;
    if (this.members.filter(m => m.team === team).length >= 5) return c.send({ t: 'error', msg: 'Time cheio' });
    mem.team = team;
    this.broadcastRoom();
  }

  start(by: Client | null): void {
    if (this.state !== 'lobby') return;
    if (by && by.id !== this.host) return by.send({ t: 'error', msg: 'Só o anfitrião pode iniciar' });
    this.sim = new MatchSim({ mapId: this.mapId, mode: this.mode, difficulty: this.difficulty, teamSize: 5, lagComp: true });
    for (const m of this.members) {
      const p = this.sim.addPlayer(m.client.name, { team: m.team, id: m.playerId });
      if (!p) continue;
      if (!m.client.connected) this.sim.setBotControl(m.playerId, true);
    }
    this.sim.fillBots();
    this.sim.start();
    this.state = 'playing';
    this.last = performance.now();
    this.acc = 0;
    for (const m of this.members) if (m.client.connected) m.client.send({ t: 'start', mapId: this.mapId, mode: this.mode, you: m.playerId });
    this.broadcastRoom();
  }

  cmd(c: Client, cmds: UserCmd[]): void {
    if (!this.sim || !c.playerId) return;
    for (const cmd of cmds.slice(0, 8)) {
      if (typeof cmd?.seq !== 'number' || !Number.isFinite(cmd.yaw) || !Number.isFinite(cmd.pitch)) continue;
      this.sim.pushCmd(c.playerId, cmd);
    }
  }

  buy(c: Client, item: string): void {
    if (!this.sim || !c.playerId) return;
    const err = this.sim.buy(c.playerId, String(item));
    if (err) c.send({ t: 'error', msg: err });
  }

  chat(from: string, text: string): void {
    const clean = String(text).slice(0, 120);
    for (const m of this.members) if (m.client.connected) m.client.send({ t: 'chat', from, text: clean });
  }

  private loop(): void {
    const now = performance.now();
    // sala vazia por muito tempo: fecha
    if (this.humans === 0) {
      if (!this.emptySince) this.emptySince = now;
      if (now - this.emptySince > 90_000) return this.close();
    } else this.emptySince = 0;

    if (this.state === 'lobby') {
      if (this.countdown > 0 && this.humans > 0) {
        const before = Math.ceil(this.countdown);
        this.countdown -= 0.015;
        if (this.members.length >= 10) this.countdown = Math.min(this.countdown, 3);
        if (Math.ceil(this.countdown) !== before) this.broadcastRoom();
        if (this.countdown <= 0) this.start(null);
      }
      return;
    }
    const sim = this.sim;
    if (!sim) return;
    this.acc += Math.min(0.25, (now - this.last) / 1000);
    this.last = now;
    while (this.acc >= TICK) {
      this.acc -= TICK;
      for (const mem of this.members) {
        const p = sim.byId(mem.playerId);
        if (p) p.ping = mem.client.ping;
      }
      sim.step();
      const ev = sim.takeEvents();
      if (ev.length) for (const m of this.members) m.events.push(...ev);
      if (sim.tick % SNAP_EVERY === 0) {
        for (const m of this.members) {
          if (!m.client.connected) {
            m.events.length = 0;
            continue;
          }
          m.client.send({ t: 'snap', s: sim.snapshot(m.playerId, m.events.splice(0)) });
        }
      }
      if (sim.phase === 'over' && this.state === 'playing') this.finish();
    }
  }

  private finish(): void {
    const sim = this.sim!;
    const res = sim.result!;
    this.state = 'over';
    const mmrOf = (pid: string) => {
      const mem = this.members.find(m => m.playerId === pid);
      return mem ? mem.client.profile.mmr : BOT_MMR[this.difficulty];
    };
    for (const m of this.members) {
      const pr = res.players.find(x => x.id === m.playerId);
      if (!pr) continue;
      const mates = res.players.filter(x => x.group === pr.group);
      const foes = res.players.filter(x => x.group !== pr.group);
      const avg = (l: typeof mates) => l.reduce((s, x) => s + mmrOf(x.id), 0) / Math.max(1, l.length);
      const own = pr.team === 'T' ? res.scoreT : res.scoreCT;
      const enemy = pr.team === 'T' ? res.scoreCT : res.scoreT;
      applyMatch(m.client.profile, pr, { mode: this.mode, mapId: this.mapId, online: true, scoreOwn: own, scoreEnemy: enemy, teamMmr: avg(mates), enemyMmr: avg(foes) });
      this.store.touch();
      if (m.client.connected) m.client.send({ t: 'end', result: res, profile: m.client.profile });
    }
    this.broadcastRoom();
    setTimeout(() => this.close(), 30_000);
  }

  close(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    for (const m of this.members) {
      m.client.room = null;
      m.client.playerId = null;
    }
    this.members = [];
    this.onClose(this);
  }
}
