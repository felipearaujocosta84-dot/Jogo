// Sala de jogo online (Colyseus): lobby com configurações do dono, senha, código de entrada, equipes,
// partida autoritativa (MatchSim a 60 passos/s), atualizações compactas a 20/s, reconexão, revanche no X1
// e gravação do resultado nos perfis. O cliente só envia comandos (teclas, mira); vida, dano, munição,
// abates e resultado são decididos aqui.
import { Room, type Client } from '@colyseus/core';
import { MatchSim, TICK } from '../../src/sim/MatchSim';
import { MAPS } from '../../src/maps/maps';
import { applyMatch, BOT_MMR, levelFor, type ProfileData } from '../../src/save/Profile';
import { sanitizeCosmetics } from '../../src/cosmetics/Cosmetics';
import { encodeDyn, rosterOf, type NetSnapshot, type RosterEntry } from '../../src/multiplayer/NetCodec';
import type { RoomInfo } from '../../src/multiplayer/Protocol';
import type { SimEvent, Team, UserCmd } from '../../src/sim/types';
import { cleanCmd, cleanSettings, cleanTeam, cleanText, type RoomSettings } from './validate';
import { presence } from '../presence';
import { config } from '../config';
import { log, metrics } from '../log';
import type { Auth } from '../auth';
import type { Store, User } from '../db/Store';
import { hashPassword, checkPassword } from '../auth';

export interface GameRoomDeps {
  auth: Auth;
  store: Store;
}

interface Member {
  sessionId: string;
  client: Client;
  user: User;
  profile: ProfileData;
  cosmetics: Record<string, string>;
  team: Team;
  playerId: string;
  connected: boolean;
  events: SimEvent[];
  rtt: number;
  /** Comandos permitidos (1 por passo de simulação, acúmulo máximo): impede "acelerar" enviando mais. */
  cmdTokens: number;
  lastSeq: number;
  chatAt: number;
  rosterSent: string;
  doorsSent: string;
  youSent: string;
  roundSent: string;
  roundAt: number;
  bombSent: string;
  /** Bytes enviados nos últimos segundos (métrica). */
  bytes: number;
}

const SNAP_EVERY = 3; // 60 / 3 = 20 atualizações por segundo
const ROSTER_EVERY = 30; // 2 por segundo
/** Battle Royale: raio de interesse (jogadores mais longe não são enviados). */
const BR_INTEREST = 70;

const GLOBAL_EVENTS = new Set(['kill', 'round_start', 'round_end', 'live', 'zone', 'match_end', 'join', 'leave', 'halftime']);

/** Evento interessa a este jogador? (é dele/sobre ele, global, ou aconteceu por perto) */
function relevantEvent(e: SimEvent, me: string, x: number, z: number): boolean {
  if (GLOBAL_EVENTS.has(e.type)) return true;
  if (e.pid === me || e.by === me || e.victim === me || e.killer === me || e.hit === me) return true;
  const ex = (e.ox ?? e.x ?? e.fx) as number | undefined, ez = (e.oz ?? e.z ?? e.fz) as number | undefined;
  if (typeof ex !== 'number' || typeof ez !== 'number') return false;
  return Math.hypot(ex - x, ez - z) < BR_INTEREST + 20;
}

export class GameRoom extends Room {
  static deps: GameRoomDeps;
  maxClients = 50;
  maxMessagesPerSecond = 90;
  settings: RoomSettings = cleanSettings({});
  private passHash: string | null = null;
  private ownerId: string | null = null;
  private ownerName = '';
  private members = new Map<string, Member>(); // por sessionId
  private sim: MatchSim | null = null;
  private phase: 'lobby' | 'playing' | 'over' = 'lobby';
  private countdown = -1;
  private acc = 0;
  private lastStep = 0;
  private lobbyIds = 0;
  private kicked = new Set<string>();
  private rematch = new Set<string>();
  private tickMs = 0;
  /** Sala de matchmaking automático: começa sozinha. */
  private auto = false;

  async onCreate(options: Record<string, unknown>): Promise<void> {
    this.roomId = await this.uniqueCode();
    this.settings = cleanSettings(options?.settings ?? options);
    this.auto = options?.auto === true;
    if (this.auto) this.countdown = 20;
    if (typeof options?.password === 'string' && options.password.length > 0) this.passHash = await hashPassword(String(options.password).slice(0, 64));
    this.maxClients = this.settings.maxPlayers;
    await this.updateListing();
    this.onMessage('settings', (c, m) => this.onSettings(c, m));
    this.onMessage('team', (c, m) => this.onTeam(c, m));
    this.onMessage('start', c => this.onStart(c));
    this.onMessage('close', c => this.onClose(c));
    this.onMessage('kick', (c, m) => this.onKick(c, m));
    this.onMessage('cmd', (c, m) => this.onCmd(c, m));
    this.onMessage('buy', (c, m) => this.onBuy(c, m));
    this.onMessage('chat', (c, m) => this.onChat(c, m));
    this.onMessage('ping', (c, m) => this.onPing(c, m));
    this.onMessage('rematch', c => this.onRematch(c));
    if (config.testMode) {
      // só nos testes automáticos (OS_TEST_MODE=1): posiciona um jogador para os testes de tiro
      this.onMessage('test:place', (c, m: { x: number; y: number; z: number; yaw: number }) => {
        const mem = this.members.get(c.sessionId);
        const p = mem && this.sim?.byId(mem.playerId);
        if (p) p.spawn(m.x, m.y, m.z, m.yaw, true);
      });
    }
    this.onMessage('*', (c, type) => {
      metrics.rejectedMessages++;
      log.debug('mensagem desconhecida', { room: this.roomId, type: String(type), session: c.sessionId });
    });
    this.setSimulationInterval(() => this.loop(), 1000 / 60);
    log.info('sala criada', { room: this.roomId, mode: this.settings.mode, map: this.settings.mapId, public: this.settings.isPublic, auto: this.auto });
  }

  private async uniqueCode(): Promise<string> {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const { matchMaker } = await import('@colyseus/core');
    for (;;) {
      const code = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      const taken = await matchMaker.query({ roomId: code });
      if (!taken.length) return code;
    }
  }

  // ------------------------------------------------------------------ entrada e saída

  async onAuth(_client: Client, options: Record<string, unknown>): Promise<User> {
    const user = await GameRoom.deps.auth.userFromToken(options?.token);
    if (!user) throw new Error('Faça login para jogar online');
    if (this.kicked.has(user.id)) throw new Error('Você foi removido desta sala');
    if ([...this.members.values()].some(m => m.user.id === user.id)) throw new Error('Você já está nesta sala');
    const isOwner = !this.ownerId || this.ownerId === user.id;
    if (this.passHash && !isOwner) {
      const ticket = presence.useTicket(options?.ticket, user.id, this.roomId);
      if (!ticket && !(typeof options?.password === 'string' && (await checkPassword(String(options.password), this.passHash)))) throw new Error('Senha incorreta');
    }
    if (this.phase === 'over') throw new Error('A partida desta sala terminou');
    if (this.settings.mode === 'x1' && this.phase === 'playing') throw new Error('Duelo em andamento');
    return user;
  }

  async onJoin(client: Client, _options: unknown, user: User): Promise<void> {
    const { store } = GameRoom.deps;
    const profile = await store.getProfile(user);
    const cosmetics = sanitizeCosmetics(await store.getCosmetics(user.id), levelFor(profile.xp).level);
    if (!this.ownerId && !this.auto) {
      this.ownerId = user.id;
      this.ownerName = user.username;
    }
    const team = this.pickTeam();
    let playerId = 'h' + ++this.lobbyIds + '_' + user.id.slice(0, 6);
    if (this.sim) {
      const p = this.sim.addPlayer(user.username, { team, id: playerId });
      if (!p) throw new Error('Times cheios');
      playerId = p.id;
      this.sim.setSkins(playerId, cosmetics);
    }
    const m: Member = { sessionId: client.sessionId, client, user, profile, cosmetics, team, playerId, connected: true, events: [], rtt: 0, cmdTokens: 4, lastSeq: 0, chatAt: 0, rosterSent: '', doorsSent: '', youSent: '', roundSent: '', roundAt: 0, bombSent: '', bytes: 0 };
    this.members.set(client.sessionId, m);
    presence.setRoom(user.id, user.username, this.roomId, this.phase === 'playing' ? 'playing' : 'lobby');
    if (this.sim) this.sendStart(m);
    this.chat('', `${user.username} entrou na sala`);
    this.broadcastRoom();
    void this.updateListing();
    log.info('entrou', { room: this.roomId, user: user.id, name: user.username, players: this.members.size });
  }

  async onDrop(client: Client): Promise<void> {
    const m = this.members.get(client.sessionId);
    if (!m) return;
    m.connected = false;
    if (this.sim && this.phase === 'playing') {
      // um bot segura a vaga até a volta (no X1 o jogador fica parado)
      if (this.settings.mode !== 'x1') this.sim.setBotControl(m.playerId, true);
      else {
        const p = this.sim.byId(m.playerId);
        if (p) p.connected = false;
      }
      this.chat('', `${m.user.username} caiu — aguardando reconexão`);
    }
    this.broadcastRoom();
    log.info('queda de conexão', { room: this.roomId, user: m.user.id });
    try {
      await this.allowReconnection(client, config.reconnectSeconds);
    } catch {
      /* não voltou a tempo: onLeave cuida */
    }
  }

  onReconnect(client: Client): void {
    const m = this.members.get(client.sessionId);
    if (!m) return;
    m.client = client;
    m.connected = true;
    m.rosterSent = '';
    m.doorsSent = m.youSent = m.roundSent = m.bombSent = '';
    metrics.reconnections++;
    if (this.sim) {
      this.sim.setBotControl(m.playerId, false);
      this.sendStart(m);
    }
    this.chat('', `${m.user.username} reconectou`);
    this.broadcastRoom();
    log.info('reconectou', { room: this.roomId, user: m.user.id });
  }

  onLeave(client: Client): void {
    const m = this.members.get(client.sessionId);
    if (!m) return;
    this.members.delete(client.sessionId);
    presence.setRoom(m.user.id, m.user.username, null, null);
    if (this.sim && this.phase === 'playing') {
      if (this.settings.mode === 'x1') {
        // desistência no duelo: o outro vence
        const p = this.sim.byId(m.playerId);
        if (p && p.alive) this.sim.damage(p, null, 999, 0, 'desistência', false, p.ctrl.position);
        this.chat('', `${m.user.username} saiu do duelo`);
      } else {
        this.sim.setBotControl(m.playerId, true);
        const p = this.sim.byId(m.playerId);
        if (p) {
          p.bot = true;
          p.name = 'BOT ' + p.name;
        }
      }
    }
    if (this.ownerId === m.user.id) {
      const next = [...this.members.values()][0];
      this.ownerId = next?.user.id ?? null;
      this.ownerName = next?.user.username ?? '';
      if (next) this.chat('', `${next.user.username} agora é o dono da sala`);
    }
    this.chat('', `${m.user.username} saiu`);
    this.broadcastRoom();
    void this.updateListing();
    log.info('saiu', { room: this.roomId, user: m.user.id, players: this.members.size });
  }

  onDispose(): void {
    for (const m of this.members.values()) presence.setRoom(m.user.id, m.user.username, null, null);
    metrics.tickMs.delete(this.roomId);
    log.info('sala encerrada', { room: this.roomId });
  }

  // ------------------------------------------------------------------ lobby

  private isOwner(c: Client): boolean {
    const m = this.members.get(c.sessionId);
    return !!m && m.user.id === this.ownerId;
  }

  private pickTeam(): Team {
    const list = [...this.members.values()];
    const t = list.filter(m => m.team === 'T').length, ct = list.filter(m => m.team === 'CT').length;
    return t <= ct ? 'T' : 'CT';
  }

  private onSettings(c: Client, raw: unknown): void {
    if (!this.isOwner(c)) return this.err(c, 'Só o dono da sala muda as configurações');
    if (this.phase !== 'lobby') return this.err(c, 'A partida já começou');
    const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const next = cleanSettings(r, this.settings);
    if (next.maxPlayers < this.members.size) next.maxPlayers = Math.max(next.maxPlayers, this.members.size);
    if (next.mode === 'x1' && this.members.size > 2) return this.err(c, 'Duelo X1: no máximo 2 jogadores na sala');
    this.settings = next;
    this.maxClients = next.maxPlayers;
    if (typeof r.password === 'string') {
      const pw = r.password.slice(0, 64);
      void (pw ? hashPassword(pw).then(h => (this.passHash = h)) : Promise.resolve((this.passHash = null))).then(() => this.broadcastRoom());
    }
    // X1: um em cada lado
    if (next.mode === 'x1') {
      const list = [...this.members.values()];
      if (list[0]) list[0].team = 'T';
      if (list[1]) list[1].team = 'CT';
    }
    void this.updateListing();
    this.broadcastRoom();
  }

  private onTeam(c: Client, raw: unknown): void {
    const m = this.members.get(c.sessionId);
    const team = cleanTeam(raw && typeof raw === 'object' ? (raw as { team?: unknown }).team : raw);
    if (!m || !team || this.phase !== 'lobby') return;
    const cap = this.settings.mode === 'x1' ? 1 : Math.ceil(this.settings.maxPlayers / 2);
    if ([...this.members.values()].filter(x => x !== m && x.team === team).length >= cap) return this.err(c, 'Equipe cheia');
    m.team = team;
    this.broadcastRoom();
  }

  private onStart(c: Client): void {
    if (!this.isOwner(c)) return this.err(c, 'Só o dono da sala inicia a partida');
    if (this.settings.mode === 'x1' && this.members.size !== 2) return this.err(c, 'O duelo X1 precisa de exatamente 2 jogadores');
    this.start();
  }

  private onClose(c: Client): void {
    if (!this.isOwner(c)) return this.err(c, 'Só o dono pode encerrar a sala');
    log.info('sala encerrada pelo dono', { room: this.roomId });
    this.broadcast('closed', { reason: 'O dono encerrou a sala' });
    void this.disconnect();
  }

  private onKick(c: Client, raw: unknown): void {
    if (!this.isOwner(c)) return;
    const uid = String((raw as { userId?: unknown })?.userId ?? '');
    const target = [...this.members.values()].find(m => m.user.id === uid);
    if (!target || target.user.id === this.ownerId) return;
    this.kicked.add(uid);
    target.client.send('closed', { reason: 'Você foi removido pelo dono da sala' });
    target.client.leave();
  }

  // ------------------------------------------------------------------ partida

  private start(): void {
    if (this.phase !== 'lobby') return;
    const s = this.settings;
    const teamSize = s.mode === 'x1' ? 1 : Math.ceil(s.maxPlayers / 2);
    this.sim = new MatchSim({
      mapId: s.mapId, mode: s.mode, difficulty: s.difficulty, teamSize, lagComp: true, timeLimit: s.mode === 'br' ? undefined : s.timeLimit,
      killLimit: s.killLimit, rounds: s.rounds, loadout: { primary: s.primary, secondary: s.secondary }
    });
    // Battle Royale: as duas "equipes" são só visuais (todos contra todos)
    const list = [...this.members.values()];
    list.forEach((m, i) => {
      if (s.mode === 'br') m.team = i % 2 ? 'CT' : 'T';
      const p = this.sim!.addPlayer(m.user.username, { team: m.team, id: m.playerId });
      if (!p) return;
      p.skins = { ...m.cosmetics };
      if (!m.connected) this.sim!.setBotControl(m.playerId, true);
    });
    if (s.bots && s.mode !== 'x1') this.sim.fillBots();
    this.sim.start();
    this.phase = 'playing';
    this.rematch.clear();
    this.lastStep = performance.now();
    this.acc = 0;
    for (const m of this.members.values()) {
      m.events = [];
      m.rosterSent = '';
      m.doorsSent = m.youSent = m.roundSent = m.bombSent = '';
      m.lastSeq = 0;
      presence.setRoom(m.user.id, m.user.username, this.roomId, 'playing');
      if (m.connected) this.sendStart(m);
    }
    void this.lock();
    void this.updateListing();
    this.broadcastRoom();
    log.info('partida iniciada', { room: this.roomId, mode: s.mode, map: s.mapId, humans: list.length, total: this.sim.players.length });
  }

  private sendStart(m: Member): void {
    m.client.send('start', { mapId: this.settings.mapId, mode: this.settings.mode, you: m.playerId });
  }

  private onCmd(c: Client, raw: unknown): void {
    const m = this.members.get(c.sessionId);
    if (!m || !this.sim || this.phase !== 'playing') return;
    const list = Array.isArray((raw as { c?: unknown })?.c) ? ((raw as { c: unknown[] }).c) : null;
    if (!list) return void metrics.rejectedMessages++;
    for (const r of list.slice(0, 8)) {
      const cmd = cleanCmd(r);
      if (!cmd || cmd.seq <= m.lastSeq) {
        metrics.rejectedMessages++;
        continue;
      }
      // orçamento: no máximo 1 comando por passo do servidor (com folga para rajadas de rede)
      if (m.cmdTokens < 1) {
        metrics.rateLimited++;
        continue;
      }
      m.cmdTokens--;
      m.lastSeq = cmd.seq;
      this.sim.pushCmd(m.playerId, cmd as UserCmd);
    }
  }

  private onBuy(c: Client, raw: unknown): void {
    const m = this.members.get(c.sessionId);
    if (!m || !this.sim) return;
    const item = cleanText((raw as { item?: unknown })?.item, 16);
    const err = this.sim.buy(m.playerId, item);
    if (err) this.err(c, err);
  }

  private onChat(c: Client, raw: unknown): void {
    const m = this.members.get(c.sessionId);
    if (!m) return;
    const now = Date.now();
    if (now - m.chatAt < 700) return void metrics.rateLimited++;
    m.chatAt = now;
    const text = cleanText((raw as { text?: unknown })?.text, 120);
    if (text) this.chat(m.user.username, text);
  }

  private onPing(c: Client, raw: unknown): void {
    const m = this.members.get(c.sessionId);
    if (!m) return;
    const r = raw as { ts?: unknown; rtt?: unknown };
    if (typeof r?.rtt === 'number' && Number.isFinite(r.rtt)) m.rtt = Math.max(0, Math.min(999, Math.round(r.rtt)));
    c.send('pong', { ts: typeof r?.ts === 'number' ? r.ts : 0 });
  }

  private onRematch(c: Client): void {
    const m = this.members.get(c.sessionId);
    if (!m || this.phase !== 'over') return;
    this.rematch.add(m.user.id);
    this.broadcastRoom();
    const humans = [...this.members.values()];
    if (humans.length >= (this.settings.mode === 'x1' ? 2 : 1) && humans.every(h => this.rematch.has(h.user.id))) {
      // revanche: lados trocados, mesmas configurações
      for (const h of humans) h.team = h.team === 'T' ? 'CT' : 'T';
      this.sim = null;
      this.phase = 'lobby';
      void this.unlock();
      this.start();
    }
  }

  private loop(): void {
    const now = performance.now();
    if (this.phase === 'lobby') {
      if (this.auto && this.countdown > 0 && this.members.size > 0) {
        const before = Math.ceil(this.countdown);
        this.countdown -= 1 / 60;
        if (this.members.size >= this.settings.maxPlayers) this.countdown = Math.min(this.countdown, 3);
        if (Math.ceil(this.countdown) !== before) this.broadcastRoom();
        if (this.countdown <= 0) this.start();
      }
      return;
    }
    const sim = this.sim;
    if (!sim || this.phase !== 'playing') return;
    this.acc += Math.min(0.25, (now - this.lastStep) / 1000);
    this.lastStep = now;
    while (this.acc >= TICK) {
      this.acc -= TICK;
      const t0 = performance.now();
      for (const m of this.members.values()) {
        m.cmdTokens = Math.min(8, m.cmdTokens + 1);
        const p = sim.byId(m.playerId);
        if (p) p.ping = m.rtt;
      }
      sim.step();
      const ev = sim.takeEvents();
      if (ev.length) for (const m of this.members.values()) m.events.push(...ev);
      if (sim.tick % SNAP_EVERY === 0) this.sendSnapshots(sim);
      this.tickMs = this.tickMs * 0.98 + (performance.now() - t0) * 0.02;
      if (sim.phase === 'over') {
        this.finish();
        break;
      }
    }
    metrics.tickMs.set(this.roomId, Math.round(this.tickMs * 1000) / 1000);
  }

  private sendSnapshots(sim: MatchSim): void {
    const views = sim.players.map(p => sim.playerView(p));
    const br = this.settings.mode === 'br';
    const sendRoster = sim.tick % ROSTER_EVERY === 0;
    for (const m of this.members.values()) {
      if (!m.connected) {
        m.events.length = 0;
        continue;
      }
      const me = sim.byId(m.playerId);
      const full = sim.snapshot(m.playerId, m.events.splice(0));
      const myTeam = me?.team;
      // interesse: no Battle Royale só quem está perto (ou eu); nos outros modos, todos (até 10)
      const pos = me?.ctrl.position;
      const players = views.filter(v => {
        if (!br || v.id === m.playerId || !pos) return true;
        if (!v.alive) return false;
        return Math.hypot(v.x - pos.x, v.z - pos.z) < BR_INTEREST;
      });
      // Battle Royale: eventos de longe (tiros, dano, granadas) também ficam de fora
      if (br && pos) full.events = full.events.filter(e => relevantEvent(e, m.playerId, pos.x, pos.z));
      const snap: NetSnapshot = { ...full, players: players.map(v => encodeDyn(v, v.id !== m.playerId && (br || v.team !== myTeam))) };
      // portas: só quando mudam
      const dk = full.doors.join(',');
      if (dk === m.doorsSent) delete snap.doors;
      else m.doorsSent = dk;
      // inventário, rodada e bomba: só quando mudam (rodada também a cada 1 s para acertar o relógio)
      const yk = JSON.stringify(full.you);
      if (yk === m.youSent) delete snap.you;
      else m.youSent = yk;
      const r = full.round;
      const rk = `${r.phase}|${r.number}|${r.scoreT}|${r.scoreCT}|${r.lastWinner}|${r.halftime}|${r.zone?.nr}|${r.zone?.shrinking}|${r.aliveCount}`;
      if (rk === m.roundSent && sim.tick - m.roundAt < 60 && !r.zone?.shrinking) delete snap.round;
      else {
        m.roundSent = rk;
        m.roundAt = sim.tick;
      }
      const bk = JSON.stringify(full.bomb);
      if (bk === m.bombSent) delete snap.bomb;
      else m.bombSent = bk;
      m.client.send('snap', snap);
      if (sendRoster) {
        const roster: RosterEntry[] = (br ? views.filter(v => v.id === m.playerId || players.includes(v) || !v.bot) : views).map(v => rosterOf(v, !br && v.team === myTeam));
        const key = JSON.stringify(roster);
        if (key !== m.rosterSent) {
          m.rosterSent = key;
          m.client.send('roster', roster);
        }
      }
    }
  }

  private async finish(): Promise<void> {
    const sim = this.sim!;
    const res = sim.result!;
    this.phase = 'over';
    metrics.matchesFinished++;
    const mmrOf = (pid: string) => {
      const m = [...this.members.values()].find(x => x.playerId === pid);
      return m ? m.profile.mmr : BOT_MMR[this.settings.difficulty];
    };
    for (const m of this.members.values()) {
      const pr = res.players.find(x => x.id === m.playerId);
      presence.setRoom(m.user.id, m.user.username, this.roomId, 'lobby');
      if (!pr) continue;
      const mates = res.players.filter(x => x.group === pr.group);
      const foes = res.players.filter(x => x.group !== pr.group);
      const avg = (l: typeof mates) => l.reduce((s, x) => s + mmrOf(x.id), 0) / Math.max(1, l.length);
      const own = pr.team === 'T' ? res.scoreT : res.scoreCT;
      const enemy = pr.team === 'T' ? res.scoreCT : res.scoreT;
      applyMatch(m.profile, pr, { mode: this.settings.mode, mapId: this.settings.mapId, online: true, scoreOwn: own, scoreEnemy: enemy, teamMmr: avg(mates), enemyMmr: avg(foes) });
      try {
        await GameRoom.deps.store.saveProfile(m.user.id, m.profile);
      } catch (e) {
        log.error('falha ao salvar perfil', { user: m.user.id, err: String(e) });
      }
      if (m.connected) m.client.send('end', { result: res, profile: m.profile });
    }
    this.broadcastRoom();
    log.info('partida finalizada', { room: this.roomId, mode: this.settings.mode, winner: res.winner, winnerId: res.winnerId ?? null });
    // sala aberta mais um pouco para revanche/resultado; depois fecha
    this.clock.setTimeout(() => {
      if (this.phase === 'over') void this.disconnect();
    }, this.settings.mode === 'x1' ? 120_000 : 45_000);
  }

  // ------------------------------------------------------------------ informações

  info(): RoomInfo {
    const s = this.settings;
    const list = [...this.members.values()];
    const players = this.sim
      ? this.sim.players.map(p => {
          const m = list.find(x => x.playerId === p.id);
          return { id: p.id, name: p.name, team: p.team, bot: p.bot && !m, connected: m ? m.connected : true, mmr: m ? m.profile.mmr : BOT_MMR[s.difficulty], userId: m?.user.id };
        })
      : list.map(m => ({ id: m.playerId, name: m.user.username, team: m.team, bot: false, connected: m.connected, mmr: m.profile.mmr, userId: m.user.id }));
    return {
      code: this.roomId, mode: s.mode, mapId: s.mapId, difficulty: s.difficulty, host: this.ownerId ?? '', state: this.phase,
      isPublic: s.isPublic, humans: list.filter(m => m.connected).length,
      avgMmr: Math.round(list.reduce((a, m) => a + m.profile.mmr, 0) / Math.max(1, list.length)),
      countdown: Math.ceil(this.countdown), players, owner: this.ownerId ?? '', ownerName: this.ownerName, settings: { ...s },
      hasPassword: !!this.passHash, rematch: [...this.rematch]
    };
  }

  private broadcastRoom(): void {
    const info = this.info();
    for (const m of this.members.values()) if (m.connected) m.client.send('room', { room: info, you: m.playerId });
  }

  private chat(from: string, text: string): void {
    this.broadcast('chat', { from, text });
  }

  private err(c: Client, msg: string): void {
    c.send('error', { msg });
  }

  private async updateListing(): Promise<void> {
    const s = this.settings;
    await this.setMetadata({
      mode: s.mode, mapId: s.mapId, mapName: MAPS[s.mapId]?.name ?? s.mapId, isPublic: s.isPublic, hasPassword: !!this.passHash, state: this.phase,
      humans: this.members.size, max: s.maxPlayers, owner: this.ownerName, auto: this.auto
    });
    await this.setPrivate(!s.isPublic);
  }
}
