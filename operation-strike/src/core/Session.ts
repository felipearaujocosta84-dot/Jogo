// Sessões de jogo. A interface é a mesma para:
//  - LocalSession: a partida inteira roda no navegador (contra bots, treino);
//  - OnlineSession: o servidor é autoritativo; o cliente prevê o próprio movimento, reconcilia com os
//    snapshots do servidor (reaplicando comandos ainda não confirmados) e interpola os outros jogadores.
import { MatchSim, TICK, type MatchConfig, type MatchResult } from '../sim/MatchSim';
import { SimPlayer, type SimHooks } from '../sim/PlayerSim';
import { MapRuntime } from '../maps/MapRuntime';
import { MAPS } from '../maps/maps';
import type { BombView, GameMode, LocalView, NadeView, PlayerView, RoundView, SimEvent, Snapshot, Team, UserCmd } from '../sim/types';
import type { NetClient } from '../multiplayer/NetClient';
import { WEAPONS } from '../weapons/WeaponData';

export interface ViewState {
  round: RoundView;
  players: PlayerView[];
  bomb: BombView;
  nades: NadeView[];
  you: LocalView | null;
}

export interface Session {
  readonly online: boolean;
  readonly map: MapRuntime;
  readonly localId: string;
  readonly mode: GameMode;
  /** Fração entre o último passo e o próximo (interpolação da câmera). */
  alpha: number;
  result: MatchResult | null;
  update(dt: number, makeCmd: () => UserCmd): void;
  view(): ViewState;
  drainEvents(): SimEvent[];
  /** Jogador local simulado/previsto (câmera e arma em primeira pessoa). */
  local(): SimPlayer | null;
  /** Posição local no passo anterior (para interpolação). */
  prevPos: { x: number; y: number; z: number };
  buy(item: string): string | null;
  /** Atualiza as skins do jogador local. */
  setSkins(skins: Record<string, string>): void;
  dispose(): void;
}

export class LocalSession implements Session {
  readonly online = false;
  readonly sim: MatchSim;
  readonly localId = 'local';
  alpha = 0;
  prevPos = { x: 0, y: 0, z: 0 };
  private acc = 0;
  private seq = 0;
  private events: SimEvent[] = [];

  constructor(config: MatchConfig, name: string, team: Team, skins: Record<string, string> = {}) {
    this.sim = new MatchSim(config);
    this.sim.addPlayer(name, { team, id: this.localId });
    this.sim.setSkins(this.localId, skins);
    if (config.mode === 'training') this.sim.fillBotsFor(team === 'T' ? 'CT' : 'T', 5);
    else this.sim.fillBots();
    this.sim.start();
  }

  get map(): MapRuntime {
    return this.sim.map;
  }

  get mode(): GameMode {
    return this.sim.config.mode;
  }

  get result(): MatchResult | null {
    return this.sim.result;
  }

  update(dt: number, makeCmd: () => UserCmd): void {
    this.acc += Math.min(0.25, dt);
    const me = this.sim.byId(this.localId);
    while (this.acc >= TICK) {
      this.acc -= TICK;
      if (me) {
        const p = me.ctrl.position;
        this.prevPos = { x: p.x, y: me.ctrl.eyeY, z: p.z };
      }
      // cada comando precisa de número de sequência crescente (a simulação descarta repetidos)
      const cmd = makeCmd();
      cmd.seq = ++this.seq;
      this.sim.pushCmd(this.localId, cmd);
      this.sim.step();
      for (const e of this.sim.takeEvents()) this.events.push(e);
    }
    this.alpha = this.acc / TICK;
  }

  view(): ViewState {
    const s = this.sim;
    const me = s.byId(this.localId);
    return {
      round: s.roundView(),
      players: s.players.map(p => s.playerView(p)),
      bomb: s.bombView(),
      nades: s.nades.nades.map(n => ({ id: n.id, type: n.type, x: n.pos.x, y: n.pos.y, z: n.pos.z, smoke: n.smoke })),
      you: me ? me.localView(s.canBuyNow(me), s.time) : null
    };
  }

  drainEvents(): SimEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  local(): SimPlayer | null {
    return this.sim.byId(this.localId) ?? null;
  }

  buy(item: string): string | null {
    return this.sim.buy(this.localId, item);
  }

  setSkins(skins: Record<string, string>): void {
    this.sim.setSkins(this.localId, skins);
  }

  dispose(): void {}
}

interface TimedSnap {
  snap: Snapshot;
}

const INTERP_TICKS = 6; // 100 ms de atraso de interpolação

export class OnlineSession implements Session {
  readonly online = true;
  readonly map: MapRuntime;
  readonly pred: SimPlayer;
  alpha = 0;
  prevPos = { x: 0, y: 0, z: 0 };
  result: MatchResult | null = null;
  private snaps: TimedSnap[] = [];
  private latest: Snapshot | null = null;
  private lastSnapAt = 0;
  private pending: UserCmd[] = [];
  private seq = 0;
  private acc = 0;
  private localTick = 0;
  private events: SimEvent[] = [];
  private unsub: () => void;
  private hooks: SimHooks;
  private lastSelectAt = 0;
  private lastServerActive = '';

  constructor(private net: NetClient, mapId: string, readonly mode: GameMode, readonly localId: string) {
    this.map = new MapRuntime(MAPS[mapId] ?? MAPS.dust_zone);
    this.pred = new SimPlayer(localId, net.profile?.name ?? 'Você', 'T', false, 'normal', 0, this.map.world);
    this.pred.alive = false;
    this.hooks = {
      fire: (p, w, o, d) => {
        // efeito visual imediato do próprio tiro; o acerto em jogadores é decidido pelo servidor
        const hit = this.map.world.raycast(o, d, w.range);
        const end = hit ? hit.point : { x: o.x + d.x * w.range, y: o.y + d.y * w.range, z: o.z + d.z * w.range };
        this.events.push({
          type: 'shot', local: true, pid: p.id, w: w.id, ox: o.x, oy: o.y, oz: o.z, hx: end.x, hy: end.y, hz: end.z,
          hit: null, nx: hit?.normal.x ?? 0, ny: hit?.normal.y ?? 0, nz: hit?.normal.z ?? 0, surface: hit ? hit.collider.surface : null, melee: w.cls === 'knife'
        });
      },
      throwNade: (p, type) => this.events.push({ type: 'throw', local: true, pid: p.id, nade: type }),
      use: () => {},
      event: (type, data) => this.events.push({ ...data, type, local: true }),
      canMove: () => {
        const ph = this.latest?.round.phase;
        return ph !== 'freeze' && ph !== 'over';
      }
    };
    this.unsub = net.on(msg => {
      if (msg.t === 'snap') this.onSnap(msg.s);
      else if (msg.t === 'end') this.result = msg.result;
    });
  }

  private get serverTick(): number {
    if (!this.latest) return 0;
    return this.latest.tick + ((performance.now() - this.lastSnapAt) / 1000) * 60;
  }

  private onSnap(s: Snapshot): void {
    this.latest = s;
    this.lastSnapAt = performance.now();
    this.snaps.push({ snap: s });
    if (this.snaps.length > 30) this.snaps.shift();
    for (const e of s.events) {
      // eventos do próprio jogador já previstos localmente
      if (e.pid === this.localId && (e.type === 'reload' || e.type === 'dry' || e.type === 'zoom' || e.type === 'throw')) continue;
      this.events.push(e);
    }
    s.doors.forEach((open, i) => this.map.setDoorState(i, open));
    this.reconcile(s);
  }

  private reconcile(s: Snapshot): void {
    const me = s.players.find(p => p.id === this.localId);
    const p = this.pred;
    if (!me) return;
    p.team = me.team;
    p.health = me.hp;
    p.armor = me.armor;
    p.helmet = me.helmet;
    p.kit = me.kit;
    p.money = me.money;
    p.c4 = me.bomb;
    p.frozen = me.act === 2 || me.act === 3;
    const wasAlive = p.alive;
    p.alive = me.alive;
    const state = { x: me.x, y: me.y, z: me.z, vx: me.vx, vy: me.vy, vz: me.vz, onGround: me.ground, crouched: me.crouch };
    if (!me.alive) {
      p.ctrl.setState(state, false);
      this.pending = [];
      return;
    }
    if (!wasAlive) {
      // renasceu: começa da posição do servidor
      p.ctrl.setState(state, false);
      p.ctrl.yaw = me.yaw;
      this.pending = [];
    }
    // inventário vindo do servidor
    const you = s.you;
    if (you) {
      const find = (slot: string) => you.slots.find(x => x.slot === slot);
      const pri = find('primary'), sec = find('secondary');
      const quiet = p.sinceShot > 0.6 && p.reloadT <= 0;
      if ((pri?.id ?? null) !== (p.primary?.id ?? null) || quiet) p.primary = pri ? { id: pri.id, ammo: pri.ammo, reserve: pri.reserve } : null;
      if ((sec?.id ?? null) !== (p.secondary?.id ?? null) || quiet) p.secondary = sec ? { id: sec.id, ammo: sec.ammo, reserve: sec.reserve } : null;
      p.nades = { he: find('he')?.ammo ?? 0, flash: find('flash')?.ammo ?? 0, smoke: find('smoke')?.ammo ?? 0 };
      if (you.active !== this.lastServerActive) {
        this.lastServerActive = you.active;
        if (you.active !== p.active && performance.now() - this.lastSelectAt > 400 && p.has(you.active)) p.select(you.active, true);
      }
      if (!p.has(p.active)) p.select(p.bestSlot(), true);
    }
    // reconciliação do movimento: estado do servidor + reaplica comandos não confirmados
    this.pending = this.pending.filter(c => c.seq > s.ack);
    const before = { ...p.ctrl.position };
    p.ctrl.setState(state, false);
    for (const c of this.pending) p.runCmd(c, TICK, this.hooks, this.localTick, true);
    const err = Math.hypot(before.x - p.ctrl.position.x, before.y - p.ctrl.position.y, before.z - p.ctrl.position.z);
    if (err > 0.001 && err < 1.5) {
      // suaviza pequenas correções
      const after = { ...p.ctrl.position };
      p.ctrl.setState({ ...p.ctrl.getState(), x: before.x, y: before.y, z: before.z }, false);
      p.ctrl.setState({ ...p.ctrl.getState(), x: after.x, y: after.y, z: after.z }, true);
    }
  }

  update(dt: number, makeCmd: () => UserCmd): void {
    this.acc += Math.min(0.25, dt);
    while (this.acc >= TICK) {
      this.acc -= TICK;
      this.localTick++;
      const p = this.pred.ctrl.position;
      this.prevPos = { x: p.x, y: this.pred.ctrl.eyeY, z: p.z };
      const cmd = makeCmd();
      cmd.seq = ++this.seq;
      cmd.rt = Math.round(this.serverTick - INTERP_TICKS);
      if (cmd.sel) this.lastSelectAt = performance.now();
      if (this.pred.alive) {
        this.pending.push(cmd);
        if (this.pending.length > 180) this.pending.shift();
        this.pred.runCmd(cmd, TICK, this.hooks, this.localTick);
      }
      this.net.queueCmd(cmd);
    }
    this.alpha = this.acc / TICK;
  }

  view(): ViewState {
    const s = this.latest;
    if (!s) {
      return {
        round: { phase: 'warmup', timeLeft: 0, number: 0, maxRounds: 24, winRounds: 13, scoreT: 0, scoreCT: 0, mode: this.mode, mapId: this.map.def.id, lastWinner: null, lastReason: '', buyTimeLeft: 0, halftime: false },
        players: [], bomb: { state: 'none', x: 0, y: 0, z: 0, carrier: null, timeLeft: 0, site: null, defuser: null, progress: 0 }, nades: [], you: null
      };
    }
    // interpolação dos outros jogadores no tick de renderização
    const rt = this.serverTick - INTERP_TICKS;
    let a: Snapshot = s, b: Snapshot = s;
    for (let i = this.snaps.length - 1; i > 0; i--) {
      if (this.snaps[i - 1].snap.tick <= rt) {
        a = this.snaps[i - 1].snap;
        b = this.snaps[i].snap;
        break;
      }
    }
    const span = b.tick - a.tick;
    const t = span > 0 ? Math.max(0, Math.min(1, (rt - a.tick) / span)) : 1;
    const players = s.players.map(cur => {
      if (cur.id === this.localId) {
        const c = this.pred.ctrl;
        return { ...cur, skin: this.pred.skinOf(), x: c.position.x, y: c.position.y, z: c.position.z, vx: c.velocity.x, vz: c.velocity.z, yaw: c.yaw, pitch: c.pitch, crouch: c.crouched, ground: c.onGround, weapon: this.pred.weaponId() };
      }
      const pa = a.players.find(p => p.id === cur.id), pb = b.players.find(p => p.id === cur.id);
      if (!pa || !pb) return cur;
      return {
        ...pb,
        x: pa.x + (pb.x - pa.x) * t,
        y: pa.y + (pb.y - pa.y) * t,
        z: pa.z + (pb.z - pa.z) * t,
        yaw: lerpAngle(pa.yaw, pb.yaw, t),
        pitch: pa.pitch + (pb.pitch - pa.pitch) * t,
        alive: cur.alive
      };
    });
    let you: LocalView | null = null;
    if (s.you) {
      const pv = this.pred.localView(s.you.canBuy, 0);
      you = { ...pv, canBuy: s.you.canBuy, flash: s.you.flash, plantProgress: s.you.plantProgress, defuseProgress: s.you.defuseProgress };
    }
    // a contagem de tempo avança entre snapshots
    const elapsed = (performance.now() - this.lastSnapAt) / 1000;
    const round = { ...s.round, timeLeft: Math.max(0, s.round.timeLeft - (s.round.phase === 'end' ? 0 : elapsed)) };
    const bomb = { ...s.bomb, timeLeft: s.bomb.state === 'planted' ? Math.max(0, s.bomb.timeLeft - elapsed) : s.bomb.timeLeft };
    return { round, players, bomb, nades: s.nades, you };
  }

  drainEvents(): SimEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  local(): SimPlayer | null {
    return this.pred;
  }

  buy(item: string): string | null {
    const def = WEAPONS[item];
    if (def && def.slot === 'primary') this.lastSelectAt = 0;
    this.net.send({ t: 'buy', item });
    return null;
  }

  setSkins(skins: Record<string, string>): void {
    this.pred.skins = { ...skins };
    this.net.send({ t: 'skins', skins });
  }

  dispose(): void {
    this.unsub();
  }
}

function lerpAngle(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
