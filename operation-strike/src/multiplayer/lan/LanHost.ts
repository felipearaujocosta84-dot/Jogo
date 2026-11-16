// Anfitrião da partida em Wi-Fi local: sala de espera (nomes, equipes, configurações) e a partida rodando neste
// aparelho (mesma simulação do modo contra bots). Os convidados recebem atualizações compactas a 20/s e enviam
// só comandos — vida, dano, munição e resultado são decididos aqui, como no servidor online.
import { LocalSession } from '../../core/Session';
import { TICK, type MatchConfig } from '../../sim/MatchSim';
import { cleanCmd, cleanSettings, cleanTeam, cleanText, type RoomSettings } from '../../../server/rooms/validate';
import { sanitizeCosmetics } from '../../cosmetics/Cosmetics';
import { encodeDyn, rosterOf, type NetSnapshot, type RosterEntry } from '../NetCodec';
import type { Team } from '../../sim/types';
import { makeHostTransport, type HostTransport } from './LanTransport';

export const LAN_PORT = 8787;

export interface LanPlayer {
  id: string;
  name: string;
  team: Team;
  host: boolean;
}

/** Mensagens do anfitrião para os convidados. */
export type LanHostMsg =
  | { t: 'lobby'; players: LanPlayer[]; settings: RoomSettings; you: string }
  | { t: 'start'; mapId: string; mode: string; you: string }
  | { t: 'snap'; s: NetSnapshot }
  | { t: 'roster'; r: RosterEntry[] }
  | { t: 'end'; result: unknown }
  | { t: 'pong'; ts: number }
  | { t: 'chat'; from: string; text: string }
  | { t: 'error'; msg: string }
  | { t: 'closed'; reason: string };

interface Guest {
  conn: number;
  id: string;
  name: string;
  team: Team;
  skins: Record<string, string>;
  ready: boolean;
  tokens: number;
  lastSeq: number;
  sent: { roster: string; doors: string; you: string; round: string; roundAt: number; bomb: string };
}

/** Sessão do anfitrião: a partida local com convidados de verdade. */
export class LanHostSession extends LocalSession {
  lan = true;
  constructor(config: MatchConfig, name: string, team: Team, skins: Record<string, string>, private host: LanHost, bots: boolean) {
    super(config, name, team, skins, {
      bots,
      beforeStart: sim => {
        for (const g of host.guests.values()) {
          const p = sim.addPlayer(g.name, { team: g.team, id: g.id });
          if (p) sim.setSkins(g.id, g.skins);
        }
      }
    });
  }

  update(dt: number, makeCmd: () => import('../../sim/types').UserCmd): void {
    this.acc += Math.min(0.25, dt);
    const me = this.sim.byId(this.localId);
    while (this.acc >= TICK) {
      this.acc -= TICK;
      if (me) {
        const p = me.ctrl.position;
        this.prevPos = { x: p.x, y: me.ctrl.eyeY, z: p.z };
      }
      const cmd = makeCmd();
      cmd.seq = ++this.seq;
      this.sim.pushCmd(this.localId, cmd);
      for (const g of this.host.guests.values()) g.tokens = Math.min(8, g.tokens + 1);
      this.sim.step();
      const ev = this.sim.takeEvents();
      for (const e of ev) this.events.push(e);
      this.host.fanout(this, ev);
    }
    this.alpha = this.acc / TICK;
  }

  dispose(): void {
    this.host.sessionEnded();
  }
}

export class LanHost {
  guests = new Map<number, Guest>();
  settings: RoomSettings = cleanSettings({ mode: 'x1', mapId: 'dust_zone', bots: false, maxPlayers: 2 });
  session: LanHostSession | null = null;
  ips: string[] = [];
  port = LAN_PORT;
  running = false;
  private transport: HostTransport = makeHostTransport();
  private nextId = 1;
  private pendingEvents = new Map<number, unknown[]>();
  /** Avisos para a interface. */
  onChange: () => void = () => {};
  onNotice: (msg: string) => void = () => {};

  constructor(public hostName: string, public hostTeam: Team = 'T', public hostSkins: Record<string, string> = {}) {}

  get players(): LanPlayer[] {
    return [{ id: 'local', name: this.hostName, team: this.hostTeam, host: true }, ...[...this.guests.values()].map(g => ({ id: g.id, name: g.name, team: g.team, host: false }))];
  }

  async open(): Promise<void> {
    const t = this.transport;
    t.onOpen = conn => {
      if (this.session && this.settings.mode === 'x1') {
        t.send(conn, JSON.stringify({ t: 'closed', reason: 'Duelo em andamento' }));
        t.kick(conn);
        return;
      }
      const id = 'lan' + this.nextId++;
      this.guests.set(conn, { conn, id, name: 'Convidado', team: this.freeTeam(), skins: {}, ready: false, tokens: 4, lastSeq: 0, sent: { roster: '', doors: '', you: '', round: '', roundAt: 0, bomb: '' } });
    };
    t.onMessage = (conn, data) => this.onMessage(conn, data);
    t.onClose = conn => {
      const g = this.guests.get(conn);
      if (!g) return;
      this.guests.delete(conn);
      const sim = this.session?.sim;
      if (sim) {
        // um bot assume a vaga (no X1, o duelo termina a favor de quem ficou)
        const p = sim.byId(g.id);
        if (p && this.settings.mode === 'x1' && p.alive) sim.damage(p, null, 999, 0, 'desistência', false, p.ctrl.position);
        else sim.setBotControl(g.id, true);
      }
      this.onNotice(`${g.name} saiu`);
      this.broadcastLobby();
    };
    const r = await t.start(this.port, Math.max(1, this.settings.maxPlayers - 1));
    this.ips = r.ips;
    this.port = r.port;
    this.running = true;
    this.onChange();
  }

  async close(): Promise<void> {
    for (const g of this.guests.values()) this.send(g, { t: 'closed', reason: 'O anfitrião encerrou a sala' });
    this.guests.clear();
    await this.transport.stop();
    this.running = false;
    this.onChange();
  }

  private freeTeam(): Team {
    const ps = this.players;
    if (this.settings.mode === 'x1') return ps.some(p => p.team === 'T') ? 'CT' : 'T';
    return ps.filter(p => p.team === 'T').length <= ps.filter(p => p.team === 'CT').length ? 'T' : 'CT';
  }

  private send(g: Guest, msg: LanHostMsg): void {
    this.transport.send(g.conn, JSON.stringify(msg));
  }

  setSettings(raw: Partial<RoomSettings>): void {
    if (this.session) return;
    this.settings = cleanSettings(raw, this.settings);
    if (this.settings.mode === 'x1') {
      this.hostTeam = 'T';
      for (const g of this.guests.values()) g.team = 'CT';
    }
    this.broadcastLobby();
  }

  setTeam(id: string, team: Team): void {
    if (this.session) return;
    if (id === 'local') this.hostTeam = team;
    else for (const g of this.guests.values()) if (g.id === id) g.team = team;
    this.broadcastLobby();
  }

  broadcastLobby(): void {
    const players = this.players;
    for (const g of this.guests.values()) this.send(g, { t: 'lobby', players, settings: this.settings, you: g.id });
    this.onChange();
  }

  private onMessage(conn: number, data: string): void {
    const g = this.guests.get(conn);
    if (!g) return;
    let m: Record<string, unknown>;
    try {
      m = JSON.parse(data);
    } catch {
      return;
    }
    switch (m.t) {
      case 'hello':
        g.name = cleanText(m.name, 16) || 'Convidado';
        g.skins = sanitizeCosmetics(m.skins, 99);
        this.onNotice(`${g.name} entrou`);
        this.broadcastLobby();
        if (this.session) {
          // entrou com a partida rolando: vira jogador (substitui um bot)
          const p = this.session.sim.addPlayer(g.name, { team: g.team, id: g.id });
          if (p) {
            this.session.sim.setSkins(g.id, g.skins);
            this.send(g, { t: 'start', mapId: this.settings.mapId, mode: this.settings.mode, you: g.id });
          }
        }
        break;
      case 'team': {
        const t = cleanTeam(m.team);
        if (t && !this.session) {
          g.team = t;
          this.broadcastLobby();
        }
        break;
      }
      case 'cmd': {
        const sim = this.session?.sim;
        if (!sim || !Array.isArray(m.c)) return;
        for (const raw of (m.c as unknown[]).slice(0, 8)) {
          const cmd = cleanCmd(raw);
          if (!cmd || cmd.seq <= g.lastSeq || g.tokens < 1) continue;
          g.tokens--;
          g.lastSeq = cmd.seq;
          sim.pushCmd(g.id, cmd);
        }
        break;
      }
      case 'buy': {
        const err = this.session?.sim.buy(g.id, cleanText(m.item, 16));
        if (err) this.send(g, { t: 'error', msg: err });
        break;
      }
      case 'ping': {
        this.send(g, { t: 'pong', ts: Number(m.ts) || 0 });
        const p = this.session?.sim.byId(g.id);
        if (p && typeof m.rtt === 'number') p.ping = Math.max(0, Math.min(999, Math.round(m.rtt)));
        break;
      }
      case 'chat': {
        const text = cleanText(m.text, 120);
        if (text) for (const x of this.guests.values()) this.send(x, { t: 'chat', from: g.name, text });
        break;
      }
    }
  }

  /** Começa a partida neste aparelho. */
  start(): LanHostSession {
    const s = this.settings;
    if (s.mode === 'x1' && this.guests.size !== 1) throw new Error('O X1 precisa de exatamente 1 convidado conectado');
    const teamSize = s.mode === 'x1' ? 1 : Math.ceil(s.maxPlayers / 2);
    const config: MatchConfig = {
      mapId: s.mapId, mode: s.mode, difficulty: s.difficulty, teamSize, lagComp: true,
      timeLimit: s.timeLimit, killLimit: s.killLimit, rounds: s.rounds, loadout: { primary: s.primary, secondary: s.secondary }
    };
    this.session = new LanHostSession(config, this.hostName, this.hostTeam, this.hostSkins, this, s.bots && s.mode !== 'x1');
    for (const g of this.guests.values()) {
      g.lastSeq = 0;
      g.sent = { roster: '', doors: '', you: '', round: '', roundAt: 0, bomb: '' };
      this.send(g, { t: 'start', mapId: s.mapId, mode: s.mode, you: g.id });
    }
    return this.session;
  }

  sessionEnded(): void {
    this.session = null;
    this.broadcastLobby();
  }

  /** Atualizações para os convidados (20/s), no mesmo formato compacto do servidor online. */
  fanout(session: LanHostSession, events: import('../../sim/types').SimEvent[]): void {
    const sim = session.sim;
    for (const g of this.guests.values()) {
      const pe = this.pendingEvents.get(g.conn) ?? [];
      pe.push(...events);
      this.pendingEvents.set(g.conn, pe);
    }
    if (sim.tick % 3 !== 0) {
      if (sim.phase === 'over' && sim.result) this.finish(session);
      return;
    }
    const views = sim.players.map(p => sim.playerView(p));
    for (const g of this.guests.values()) {
      const me = sim.byId(g.id);
      const ev = (this.pendingEvents.get(g.conn) ?? []) as import('../../sim/types').SimEvent[];
      this.pendingEvents.set(g.conn, []);
      const full = sim.snapshot(g.id, ev);
      const snap: NetSnapshot = { ...full, players: views.map(v => encodeDyn(v, v.id !== g.id && v.team !== me?.team)) };
      const dk = full.doors.join(',');
      if (dk === g.sent.doors) delete snap.doors;
      else g.sent.doors = dk;
      const yk = JSON.stringify(full.you);
      if (yk === g.sent.you) delete snap.you;
      else g.sent.you = yk;
      const r = full.round;
      const rk = `${r.phase}|${r.number}|${r.scoreT}|${r.scoreCT}|${r.lastWinner}|${r.halftime}`;
      if (rk === g.sent.round && sim.tick - g.sent.roundAt < 60) delete snap.round;
      else {
        g.sent.round = rk;
        g.sent.roundAt = sim.tick;
      }
      const bk = JSON.stringify(full.bomb);
      if (bk === g.sent.bomb) delete snap.bomb;
      else g.sent.bomb = bk;
      this.send(g, { t: 'snap', s: snap });
      if (sim.tick % 30 === 0) {
        const roster = views.map(v => rosterOf(v, v.team === me?.team));
        const key = JSON.stringify(roster);
        if (key !== g.sent.roster) {
          g.sent.roster = key;
          this.send(g, { t: 'roster', r: roster });
        }
      }
    }
    if (sim.phase === 'over' && sim.result) this.finish(session);
  }

  private finished = new WeakSet<LanHostSession>();
  private finish(session: LanHostSession): void {
    if (this.finished.has(session)) return;
    this.finished.add(session);
    for (const g of this.guests.values()) this.send(g, { t: 'end', result: session.sim.result });
  }
}
