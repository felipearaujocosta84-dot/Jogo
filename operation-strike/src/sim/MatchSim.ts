// Simulação completa de uma partida 5v5 (autoritativa): rodadas, troca de lados, bomba (plantar/desarmar/explodir),
// economia, compras, disparos com raycast e regiões do corpo, granadas, mortes, assistências, MVP e placar.
// Roda no navegador (contra bots / treino) e no servidor Node (multiplayer). Não depende do Babylon nem do DOM.
import { MapRuntime, type Box } from '../maps/MapRuntime';
import { MAPS } from '../maps/maps';
import type { Vec3 } from '../physics/CollisionWorld';
import { PLAYER } from '../player/PlayerController';
import { RULES, type RoundRules } from '../rounds/RoundRules';
import { REWARD, buyPrice, canBuy, lossBonus } from '../economy/Economy';
import { WEAPONS, type WeaponDef } from '../weapons/WeaponData';
import { computeDamage, explosionDamage, rayBody } from '../combat/Hitboxes';
import { GrenadeSim, type Nade, type NadeType } from './Grenades';
import { SimPlayer, type SimHooks } from './PlayerSim';
import { NavGrid } from '../bots/navigation/NavGrid';
import { randomSkins } from '../weapons/Skins';
import { BotBrain } from '../bots/behavior/BotBrain';
import { TeamTactics } from '../bots/tactics/TeamTactics';
import type {
  BombView,
  Difficulty,
  GameMode,
  PlayerView,
  RoundPhase,
  RoundView,
  SimEvent,
  Snapshot,
  Team,
  UserCmd
} from './types';

export const TICK = 1 / 60;
const BOT_NAMES = ['Viper', 'Falcão', 'Raven', 'Ghost', 'Cobra', 'Titan', 'Lince', 'Spectre', 'Nômade', 'Atlas', 'Jaguar', 'Orion', 'Ronin', 'Sombra', 'Zeca', 'Bruma'];

export type Group = 'A' | 'B';

export interface MatchConfig {
  mapId: string;
  mode: GameMode;
  difficulty: Difficulty;
  teamSize: number;
  /** Ativa compensação de latência (servidor). */
  lagComp?: boolean;
}

export interface BombState {
  state: BombView['state'];
  pos: Vec3;
  carrier: string | null;
  timeLeft: number;
  site: 'A' | 'B' | null;
  defuser: string | null;
  progress: number;
  planter: string | null;
}

export interface MatchResult {
  winner: Team | 'draw';
  scoreT: number;
  scoreCT: number;
  players: { id: string; name: string; bot: boolean; group: Group; team: Team; kills: number; deaths: number; assists: number; mvps: number; score: number; headshots: number; damage: number; won: boolean | null }[];
}

export class MatchSim {
  readonly map: MapRuntime;
  readonly rules: RoundRules;
  readonly nades: GrenadeSim;
  nav: NavGrid | null = null;
  players: SimPlayer[] = [];
  groups = new Map<string, Group>();
  brains = new Map<string, BotBrain>();
  tactics: Record<Team, TeamTactics>;
  tick = 0;
  time = 0;
  phase: RoundPhase = 'warmup';
  phaseTime = 0;
  roundNumber = 0;
  liveTime = 0;
  swapped = false;
  score: Record<Group, number> = { A: 0, B: 0 };
  lossStreak: Record<Group, number> = { A: 0, B: 0 };
  lastWinner: Team | null = null;
  lastReason = '';
  bomb: BombState = { state: 'none', pos: { x: 0, y: 0, z: 0 }, carrier: null, timeLeft: 0, site: null, defuser: null, progress: 0, planter: null };
  events: SimEvent[] = [];
  result: MatchResult | null = null;
  private nextId = 1;
  private hooks: SimHooks;
  private botNameIdx = Math.floor(Math.random() * BOT_NAMES.length);
  private respawnTimers = new Map<string, number>();

  constructor(readonly config: MatchConfig) {
    const def = MAPS[config.mapId] ?? MAPS.dust_zone;
    this.map = new MapRuntime(def);
    this.rules = RULES[config.mode];
    this.nades = new GrenadeSim(this.map.world);
    this.tactics = { T: new TeamTactics(this, 'T'), CT: new TeamTactics(this, 'CT') };
    this.hooks = {
      fire: (p, w, o, d, rt) => this.resolveShot(p, w, o, d, rt),
      throwNade: (p, type, o, v) => this.throwNade(p, type, o, v),
      use: (p, held, pressed) => this.handleUse(p, held, pressed),
      event: (type, data) => this.emit(type, data),
      canMove: () => this.phase !== 'freeze' && this.phase !== 'over'
    };
  }

  // ------------------------------------------------------------------ jogadores

  teamOf(group: Group): Team {
    return (group === 'A') !== this.swapped ? 'T' : 'CT';
  }

  groupOf(team: Team): Group {
    return this.teamOf('A') === team ? 'A' : 'B';
  }

  byId(id: string): SimPlayer | undefined {
    return this.players.find(p => p.id === id);
  }

  addPlayer(name: string, opts: { bot?: boolean; difficulty?: Difficulty; team?: Team; id?: string } = {}): SimPlayer | null {
    let group: Group;
    if (opts.team) group = this.groupOf(opts.team);
    else {
      const a = this.players.filter(p => this.groups.get(p.id) === 'A').length;
      const b = this.players.filter(p => this.groups.get(p.id) === 'B').length;
      group = a <= b ? 'A' : 'B';
    }
    let count = this.players.filter(p => this.groups.get(p.id) === group).length;
    if (count >= this.config.teamSize && !opts.bot) {
      // substitui um bot do mesmo lado
      const bot = this.players.find(p => p.bot && this.groups.get(p.id) === group);
      if (bot) {
        this.removePlayer(bot.id);
        count--;
      } else {
        const other: Group = group === 'A' ? 'B' : 'A';
        if (this.players.filter(p => this.groups.get(p.id) === other).length >= this.config.teamSize) return null;
        group = other;
      }
    } else if (count >= this.config.teamSize) return null;
    const id = opts.id ?? 'p' + this.nextId++;
    const team = this.teamOf(group);
    const variant = this.players.filter(p => this.groups.get(p.id) === group).length;
    const p = new SimPlayer(id, name, team, !!opts.bot, opts.difficulty ?? this.config.difficulty, variant % 5, this.map.world);
    p.money = this.rules.startMoney;
    this.players.push(p);
    this.groups.set(id, group);
    if (p.bot) {
      this.attachBrain(p);
      p.skins = randomSkins(Object.keys(WEAPONS));
    }
    // entra no meio da rodada: espera a próxima (morto), exceto no aquecimento/compra/treino
    const sp = this.map.spawn(team, variant);
    p.spawn(sp.x, 0.2, sp.z, (sp.yaw * Math.PI) / 180, false);
    if (this.phase === 'live' && !this.rules.training) {
      p.alive = false;
      p.ctrl.enabled = false;
    }
    this.emit('join', { pid: id, name, team, bot: p.bot });
    return p;
  }

  private attachBrain(p: SimPlayer): void {
    if (!this.nav) this.nav = new NavGrid(this.map);
    this.brains.set(p.id, new BotBrain(this, p, this.config.mode === 'training'));
  }

  /** Controle por bot de um jogador humano desconectado (e devolução ao reconectar). */
  setBotControl(id: string, on: boolean): void {
    const p = this.byId(id);
    if (!p) return;
    if (on) {
      p.connected = false;
      this.attachBrain(p);
    } else {
      p.connected = true;
      this.brains.delete(id);
      p.cmdQueue = [];
    }
  }

  removePlayer(id: string): void {
    const p = this.byId(id);
    if (!p) return;
    if (p.c4 && p.alive) this.dropBomb(p);
    this.players = this.players.filter(x => x !== p);
    this.groups.delete(id);
    this.brains.delete(id);
    this.emit('leave', { pid: id, name: p.name });
  }

  /** Completa só um lado com bots (treino: alvos). */
  fillBotsFor(team: Team, n: number): void {
    for (let i = 0; i < n; i++) this.addPlayer('ALVO ' + BOT_NAMES[this.botNameIdx++ % BOT_NAMES.length], { bot: true, team });
  }

  fillBots(): void {
    for (const g of ['A', 'B'] as Group[]) {
      while (this.players.filter(p => this.groups.get(p.id) === g).length < this.config.teamSize) {
        const name = 'BOT ' + BOT_NAMES[this.botNameIdx++ % BOT_NAMES.length];
        this.addPlayer(name, { bot: true, team: this.teamOf(g) });
      }
    }
  }

  /** Troca as skins de um jogador (já validadas). */
  setSkins(id: string, skins: Record<string, string>): void {
    const p = this.byId(id);
    if (p) p.skins = { ...skins };
  }

  pushCmd(id: string, cmd: UserCmd): void {
    const p = this.byId(id);
    if (!p || p.bot) return;
    if (cmd.seq <= p.lastSeq) return;
    if (p.cmdQueue.length < 12) p.cmdQueue.push(cmd);
  }

  alive(team: Team): SimPlayer[] {
    return this.players.filter(p => p.alive && p.team === team);
  }

  // ------------------------------------------------------------------ eventos

  emit(type: string, data: Record<string, unknown> = {}): void {
    this.events.push({ ...data, type });
  }

  takeEvents(): SimEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  // ------------------------------------------------------------------ fluxo da partida

  start(): void {
    this.roundNumber = 0;
    this.score = { A: 0, B: 0 };
    this.swapped = false;
    for (const p of this.players) {
      p.money = this.rules.startMoney;
      p.kills = p.deaths = p.assists = p.score = p.mvps = p.headshots = p.damageDealt = 0;
      p.alive = false;
      p.team = this.teamOf(this.groups.get(p.id)!);
    }
    this.result = null;
    if (this.rules.training) {
      this.phase = 'live';
      this.roundNumber = 1;
      this.spawnAll(false);
      this.emit('round_start', { number: 1 });
      return;
    }
    this.startRound();
  }

  private spawnAll(keep: boolean): void {
    const idx: Record<Team, number> = { T: 0, CT: 0 };
    for (const p of this.players) {
      const sp = this.map.spawn(p.team, idx[p.team]++);
      p.spawn(sp.x, 0.2, sp.z, (sp.yaw * Math.PI) / 180, keep && p.alive);
      if (this.rules.training) p.money = this.rules.maxMoney;
    }
  }

  private startRound(): void {
    this.roundNumber++;
    let halftime = false;
    if (this.roundNumber === this.rules.halfAt + 1) {
      this.swapped = true;
      halftime = true;
      for (const p of this.players) {
        p.team = this.teamOf(this.groups.get(p.id)!);
        p.money = this.rules.startMoney;
        p.alive = false; // perde as armas
      }
      this.lossStreak = { A: 0, B: 0 };
      this.emit('halftime', {});
    }
    for (const d of this.map.doors) {
      d.open = d.def.open;
    }
    this.spawnAll(!halftime);
    this.nades.clear();
    this.bomb = { state: 'none', pos: { x: 0, y: 0, z: 0 }, carrier: null, timeLeft: 0, site: null, defuser: null, progress: 0, planter: null };
    const ts = this.alive('T');
    if (ts.length) {
      const humans = ts.filter(p => !p.bot);
      const pool = Math.random() < 0.5 && humans.length ? humans : ts;
      const carrier = pool[Math.floor(Math.random() * pool.length)];
      carrier.c4 = true;
      this.bomb.state = 'carried';
      this.bomb.carrier = carrier.id;
    }
    this.phase = 'freeze';
    this.phaseTime = this.rules.freezeTime;
    this.liveTime = 0;
    this.tactics.T.newRound();
    this.tactics.CT.newRound();
    for (const b of this.brains.values()) b.newRound();
    this.emit('round_start', { number: this.roundNumber, halftime });
  }

  private endRound(winner: Team, reason: string): void {
    if (this.phase !== 'live') return;
    this.phase = 'end';
    this.phaseTime = this.rules.roundEndTime;
    this.lastWinner = winner;
    this.lastReason = reason;
    const wg = this.groupOf(winner);
    const lg: Group = wg === 'A' ? 'B' : 'A';
    this.score[wg]++;
    this.lossStreak[wg] = 0;
    this.lossStreak[lg]++;
    const winMoney = reason === 'bomb' ? REWARD.winBomb : reason === 'defuse' ? REWARD.winDefuse : reason === 'time' ? REWARD.winTime : REWARD.winElimination;
    for (const p of this.players) {
      const g = this.groups.get(p.id);
      if (g === wg) this.addMoney(p, winMoney);
      else {
        let m = lossBonus(this.lossStreak[lg]);
        if (p.team === 'T' && this.bomb.planter) m += REWARD.plantedLossBonus;
        this.addMoney(p, m);
      }
    }
    // MVP: mais abates no time vencedor (ou quem plantou/desarmou)
    let mvp: SimPlayer | undefined;
    if (reason === 'defuse') mvp = this.byId(this.bomb.defuser ?? '');
    else if (reason === 'bomb') mvp = this.byId(this.bomb.planter ?? '');
    if (!mvp) mvp = this.players.filter(p => p.team === winner).sort((a, b) => b.roundKills - a.roundKills)[0];
    if (mvp) mvp.mvps++;
    this.emit('round_end', { winner, reason, mvp: mvp?.id ?? null, scoreT: this.score[this.groupOf('T')], scoreCT: this.score[this.groupOf('CT')] });
  }

  private finishMatch(): void {
    this.phase = 'over';
    const sA = this.score.A, sB = this.score.B;
    const wg: Group | null = sA === sB ? null : sA > sB ? 'A' : 'B';
    this.result = {
      winner: wg ? this.teamOf(wg) : 'draw',
      scoreT: this.score[this.groupOf('T')],
      scoreCT: this.score[this.groupOf('CT')],
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        bot: p.bot,
        group: this.groups.get(p.id)!,
        team: p.team,
        kills: p.kills,
        deaths: p.deaths,
        assists: p.assists,
        mvps: p.mvps,
        score: p.score,
        headshots: p.headshots,
        damage: p.damageDealt,
        won: wg ? this.groups.get(p.id) === wg : null
      }))
    };
    this.emit('match_end', { winner: this.result.winner, scoreT: this.result.scoreT, scoreCT: this.result.scoreCT });
  }

  private addMoney(p: SimPlayer, m: number): void {
    p.money = Math.max(0, Math.min(this.rules.maxMoney, p.money + m));
  }

  // ------------------------------------------------------------------ passo de simulação

  step(): void {
    this.tick++;
    this.time += TICK;
    const dt = TICK;

    // fases
    if (this.phase === 'freeze') {
      this.phaseTime -= dt;
      if (this.phaseTime <= 0) {
        this.phase = 'live';
        this.phaseTime = this.rules.roundTime;
        this.emit('live', {});
      }
    } else if (this.phase === 'live') {
      this.liveTime += dt;
      if (this.bomb.state !== 'planted') this.phaseTime -= dt;
    } else if (this.phase === 'end') {
      this.phaseTime -= dt;
      if (this.phaseTime <= 0) {
        const maxScore = Math.max(this.score.A, this.score.B);
        if (maxScore >= this.rules.winRounds || this.roundNumber >= this.rules.maxRounds) this.finishMatch();
        else this.startRound();
      }
    }

    // comandos dos jogadores
    for (const p of this.players) {
      const brain = this.brains.get(p.id);
      if (brain) {
        const cmd = brain.update(dt);
        p.runCmd(cmd, dt, this.hooks, this.tick);
      } else {
        let n = 0;
        while (p.cmdQueue.length && n < 4) {
          const cmd = p.cmdQueue.shift()!;
          p.lastSeq = cmd.seq;
          p.runCmd(cmd, dt, this.hooks, this.tick);
          n++;
        }
      }
    }

    // portas e granadas
    const blockers: Box[] = this.players.filter(p => p.alive).map(p => this.playerBox(p));
    this.map.update(dt, blockers);
    this.nades.step(dt, n => this.detonate(n), n => this.emit('bounce', { x: n.pos.x, y: n.pos.y, z: n.pos.z }));

    // bomba
    this.updateBomb(dt);

    // treino: renascimento automático
    if (this.rules.training) {
      for (const p of this.players) {
        if (p.alive) {
          p.money = this.rules.maxMoney;
          continue;
        }
        const t = (this.respawnTimers.get(p.id) ?? 2.5) - dt;
        this.respawnTimers.set(p.id, t);
        if (t <= 0) {
          this.respawnTimers.delete(p.id);
          const sp = p.bot ? this.trainingSpot(p) : this.map.spawn(p.team, Math.floor(Math.random() * 5));
          p.spawn(sp.x, 0.2, sp.z, (sp.yaw * Math.PI) / 180, false);
          if (p.team === 'T' && !p.bot && this.bomb.state !== 'planted') p.c4 = true;
          this.emit('respawn', { pid: p.id });
        }
      }
      return;
    }

    // condições de vitória
    if (this.phase === 'live') {
      const t = this.alive('T').length, ct = this.alive('CT').length;
      const anyT = this.players.some(p => p.team === 'T'), anyCT = this.players.some(p => p.team === 'CT');
      if (anyCT && ct === 0) this.endRound('T', 'elimination');
      else if (anyT && t === 0 && this.bomb.state !== 'planted') this.endRound('CT', 'elimination');
      else if (this.phaseTime <= 0 && this.bomb.state !== 'planted') this.endRound('CT', 'time');
    }
  }

  private trainingSpot(p: SimPlayer): { x: number; z: number; yaw: number } {
    if (this.nav) {
      const site = this.map.def.sites[Math.floor(Math.random() * 2)];
      const pt = this.nav.randomIn(site.min[0], site.min[1], site.max[0], site.max[1], Math.random);
      if (pt) return { x: pt.x, z: pt.z, yaw: Math.random() * 360 };
    }
    return this.map.spawn(p.team, Math.floor(Math.random() * 5));
  }

  playerBox(p: SimPlayer): Box {
    const c = p.ctrl.position, r = PLAYER.radius;
    return [{ x: c.x - r, y: c.y, z: c.z - r }, { x: c.x + r, y: c.y + p.ctrl.height, z: c.z + r }];
  }

  // ------------------------------------------------------------------ combate

  private resolveShot(p: SimPlayer, w: WeaponDef, origin: Vec3, dir: Vec3, rt?: number): void {
    const melee = w.cls === 'knife';
    const range = melee ? w.range : w.range;
    const wall = this.map.world.raycast(origin, dir, range);
    const maxDist = wall ? wall.distance : range;
    const lag = this.config.lagComp && !p.bot && rt !== undefined ? Math.max(this.tick - 24, Math.min(this.tick, rt)) : null;
    let best: { victim: SimPlayer; region: 'head' | 'chest' | 'stomach' | 'legs'; distance: number; point: Vec3 } | null = null;
    for (const v of this.players) {
      if (v === p || !v.alive) continue;
      if (v.team === p.team && !this.rules.friendlyFire) continue;
      const state = lag !== null ? v.positionAt(lag) : { pos: v.ctrl.position, crouched: v.ctrl.crouched };
      const hit = rayBody(origin, dir, best ? best.distance : maxDist, state.pos, state.crouched);
      if (hit) best = { victim: v, ...hit };
    }
    if (best) {
      const v = best.victim;
      const dmg = computeDamage(w, best.region, best.distance, v.armor, v.helmet);
      this.emit('shot', { pid: p.id, w: w.id, ox: r2(origin.x), oy: r2(origin.y), oz: r2(origin.z), hx: r2(best.point.x), hy: r2(best.point.y), hz: r2(best.point.z), hit: v.id, region: best.region });
      this.damage(v, p, dmg.health, dmg.armor, w.id, best.region === 'head', origin);
    } else {
      const end = wall ? wall.point : { x: origin.x + dir.x * range, y: origin.y + dir.y * range, z: origin.z + dir.z * range };
      this.emit('shot', {
        pid: p.id, w: w.id, ox: r2(origin.x), oy: r2(origin.y), oz: r2(origin.z), hx: r2(end.x), hy: r2(end.y), hz: r2(end.z),
        hit: null, nx: wall?.normal.x ?? 0, ny: wall?.normal.y ?? 0, nz: wall?.normal.z ?? 0, surface: wall ? wall.collider.surface : null, melee
      });
    }
  }

  damage(v: SimPlayer, attacker: SimPlayer | null, health: number, armor: number, weapon: string, headshot: boolean, from: Vec3): void {
    if (!v.alive || health <= 0) return;
    const real = Math.min(v.health, health);
    v.health -= health;
    v.armor = Math.max(0, v.armor - armor);
    if (attacker && attacker.team !== v.team) {
      attacker.damageDealt += real;
      v.roundDamage.set(attacker.id, (v.roundDamage.get(attacker.id) ?? 0) + real);
    }
    this.emit('damage', { pid: v.id, by: attacker?.id ?? null, amount: real, fx: r2(from.x), fz: r2(from.z), hs: headshot });
    this.brains.get(v.id)?.onDamaged(attacker, from);
    if (v.health <= 0) this.kill(v, attacker, weapon, headshot);
  }

  private kill(v: SimPlayer, attacker: SimPlayer | null, weapon: string, headshot: boolean): void {
    v.health = 0;
    v.alive = false;
    v.deaths++;
    v.frozen = false;
    v.plantProgress = v.defuseProgress = 0;
    if (this.bomb.defuser === v.id) {
      this.bomb.defuser = null;
      this.bomb.progress = 0;
    }
    if (v.c4) this.dropBomb(v);
    if (attacker && attacker !== v) {
      if (attacker.team === v.team) {
        attacker.kills = Math.max(0, attacker.kills - 1);
        this.addMoney(attacker, REWARD.teamKill);
      } else {
        attacker.kills++;
        attacker.roundKills++;
        attacker.score += 2;
        if (headshot) attacker.headshots++;
        this.addMoney(attacker, WEAPONS[weapon]?.killReward ?? 300);
      }
    }
    let assister: SimPlayer | null = null;
    for (const [aid, dmg] of v.roundDamage) {
      if (dmg >= 40 && aid !== attacker?.id) {
        const a = this.byId(aid);
        if (a) {
          a.assists++;
          a.score += 1;
          assister = a;
        }
      }
    }
    this.emit('kill', { victim: v.id, killer: attacker?.id ?? null, assister: assister?.id ?? null, weapon, hs: headshot, x: r2(v.ctrl.position.x), y: r2(v.ctrl.position.y), z: r2(v.ctrl.position.z) });
    for (const b of this.brains.values()) b.onKill(v, attacker);
  }

  private throwNade(p: SimPlayer, type: NadeType, o: Vec3, v: Vec3): void {
    const n = this.nades.throw(p.id, type, o, v);
    this.emit('throw', { pid: p.id, id: n.id, nade: type });
  }

  private detonate(n: Nade): void {
    const owner = this.byId(n.owner) ?? null;
    const pos = n.pos;
    this.emit('detonate', { id: n.id, nade: n.type, x: r2(pos.x), y: r2(pos.y), z: r2(pos.z) });
    if (n.type === 'he') {
      for (const v of this.players) {
        if (!v.alive) continue;
        if (v.team === owner?.team && v !== owner && !this.rules.friendlyFire) continue;
        const c = { x: v.ctrl.position.x, y: v.ctrl.position.y + 1, z: v.ctrl.position.z };
        const dist = Math.hypot(c.x - pos.x, c.y - pos.y, c.z - pos.z);
        if (dist > 8) continue;
        const dir = { x: c.x - pos.x, y: c.y - pos.y, z: c.z - pos.z };
        const wall = this.map.world.raycast({ x: pos.x, y: pos.y + 0.1, z: pos.z }, dir, dist);
        if (wall && wall.distance < dist - 0.3) continue;
        const d = explosionDamage(WEAPONS.he.damage, 8, dist, v.armor);
        this.damage(v, owner, d.health, d.armor, 'he', false, pos);
      }
    } else if (n.type === 'flash') {
      for (const v of this.players) {
        if (!v.alive) continue;
        const eye = v.eye();
        const dx = pos.x - eye.x, dy = pos.y - eye.y, dz = pos.z - eye.z;
        const dist = Math.hypot(dx, dy, dz);
        if (dist > 30) continue;
        const wall = this.map.world.raycast(eye, { x: dx, y: dy, z: dz }, dist);
        if (wall && wall.distance < dist - 0.3) continue;
        if (this.nades.smokeBlocks(eye, pos)) continue;
        const f = v.aimDir();
        const dot = (f.x * dx + f.y * dy + f.z * dz) / (dist || 1);
        const strength = dot > 0.5 ? 1 : dot > -0.2 ? 0.6 : 0.25;
        const dur = (dot > 0.5 ? 3.6 : dot > -0.2 ? 1.8 : 0.6) * (1 - (dist / 30) * 0.55);
        if (v.flashUntil < this.time + dur) v.flashUntil = this.time + dur;
        v.flashAmount = Math.max(strength, v.flashUntil > this.time ? v.flashAmount : 0);
        this.emit('flashed', { pid: v.id, dur: r2(dur), strength });
        this.brains.get(v.id)?.onFlashed(dur * strength);
      }
    }
  }

  // ------------------------------------------------------------------ bomba e interação

  private dropBomb(p: SimPlayer): void {
    p.c4 = false;
    if (p.active === 'c4') p.select(p.bestSlot());
    const pos = p.ctrl.position;
    this.bomb.state = 'dropped';
    this.bomb.carrier = null;
    this.bomb.pos = { x: pos.x, y: pos.y + 0.05, z: pos.z };
    this.emit('bomb_drop', { x: r2(pos.x), z: r2(pos.z) });
  }

  private updateBomb(dt: number): void {
    const b = this.bomb;
    if (b.state === 'carried') {
      const c = this.byId(b.carrier ?? '');
      if (c) b.pos = { ...c.ctrl.position };
      else b.state = 'none';
    } else if (b.state === 'dropped') {
      for (const p of this.players) {
        if (!p.alive || p.team !== 'T') continue;
        const d = Math.hypot(p.ctrl.position.x - b.pos.x, p.ctrl.position.z - b.pos.z);
        if (d < 1.1 && Math.abs(p.ctrl.position.y - b.pos.y) < 1.5) {
          p.c4 = true;
          b.state = 'carried';
          b.carrier = p.id;
          this.emit('bomb_pickup', { pid: p.id });
          break;
        }
      }
    } else if (b.state === 'planted') {
      if (this.phase !== 'live' && this.phase !== 'end') return;
      b.timeLeft -= dt;
      // desarmador soltou?
      const d = this.byId(b.defuser ?? '');
      if (b.defuser && (!d || !d.alive || d.defuseProgress <= 0)) {
        b.defuser = null;
        b.progress = 0;
      }
      if (b.timeLeft <= 0 && this.phase === 'live') {
        b.state = 'exploded';
        this.emit('explode', { x: r2(b.pos.x), y: r2(b.pos.y), z: r2(b.pos.z) });
        for (const v of this.players) {
          if (!v.alive) continue;
          const dist = Math.hypot(v.ctrl.position.x - b.pos.x, v.ctrl.position.z - b.pos.z);
          const dmg = explosionDamage(500, 22, dist, v.armor);
          this.damage(v, null, dmg.health, dmg.armor, 'c4', false, b.pos);
        }
        if (this.rules.training) {
          b.state = 'none';
          return;
        }
        this.endRound('T', 'bomb');
      }
    }
  }

  private handleUse(p: SimPlayer, held: boolean, pressed: boolean): void {
    const pos = p.ctrl.position;
    const b = this.bomb;
    const live = this.phase === 'live';
    // plantar
    if (p.team === 'T' && p.c4 && live) {
      const site = this.map.siteAt(pos.x, pos.z);
      if (held && site && p.ctrl.onGround) {
        if (p.plantProgress === 0) {
          p.select('c4');
          this.emit('plant_start', { pid: p.id, site });
        }
        p.frozen = true;
        p.act = 2;
        p.plantProgress += TICK / this.rules.plantTime;
        if (p.plantProgress >= 1) {
          p.plantProgress = 0;
          p.frozen = false;
          p.act = 0;
          p.c4 = false;
          p.select(p.bestSlot());
          b.state = 'planted';
          b.pos = { x: pos.x, y: pos.y + 0.02, z: pos.z };
          b.carrier = null;
          b.site = site;
          b.timeLeft = this.rules.bombTime;
          b.planter = p.id;
          p.score += 2;
          this.addMoney(p, REWARD.plant);
          this.emit('planted', { pid: p.id, site, x: r2(pos.x), y: r2(b.pos.y), z: r2(pos.z) });
        }
        return;
      }
      if (p.plantProgress > 0) {
        p.plantProgress = 0;
        p.frozen = false;
        p.act = 0;
      }
    }
    // desarmar
    if (p.team === 'CT' && b.state === 'planted' && live) {
      const d = Math.hypot(pos.x - b.pos.x, pos.z - b.pos.z);
      const near = d < 1.7 && Math.abs(pos.y - b.pos.y) < 1.6;
      if (held && near && (!b.defuser || b.defuser === p.id)) {
        if (!b.defuser) this.emit('defuse_start', { pid: p.id, kit: p.kit });
        b.defuser = p.id;
        p.frozen = true;
        p.act = 3;
        p.defuseProgress += TICK / (p.kit ? this.rules.defuseKitTime : this.rules.defuseTime);
        b.progress = p.defuseProgress;
        if (p.defuseProgress >= 1) {
          p.defuseProgress = 0;
          p.frozen = false;
          p.act = 0;
          b.state = 'defused';
          p.score += 2;
          this.addMoney(p, REWARD.defuse);
          this.emit('defused', { pid: p.id });
          if (this.rules.training) {
            b.state = 'none';
            return;
          }
          this.endRound('CT', 'defuse');
        }
        return;
      }
      if (p.defuseProgress > 0) {
        p.defuseProgress = 0;
        p.frozen = false;
        p.act = 0;
        if (b.defuser === p.id) {
          b.defuser = null;
          b.progress = 0;
        }
      }
    }
    // portas
    if (pressed) {
      const fx = Math.sin(p.ctrl.yaw), fz = Math.cos(p.ctrl.yaw);
      let door = null;
      let best = 3.2;
      for (const d of this.map.doors) {
        const dx = d.center.x - pos.x, dz = d.center.z - pos.z;
        const dist = Math.hypot(dx, dz);
        if (dist > best) continue;
        if (dist > 0.8 && (dx * fx + dz * fz) / dist < 0.2) continue;
        best = dist;
        door = d;
      }
      if (door) {
        const blockers = this.players.filter(x => x.alive).map(x => this.playerBox(x));
        if (this.map.toggleDoor(door, blockers)) this.emit('door', { index: door.index, open: door.open });
      }
    }
  }

  // ------------------------------------------------------------------ compras

  inBuyZone(p: SimPlayer): boolean {
    if (this.rules.training) return true;
    const c = this.map.spawnCenter(p.team);
    return Math.hypot(p.ctrl.position.x - c.x, p.ctrl.position.z - c.z) < 16;
  }

  canBuyNow(p: SimPlayer): boolean {
    if (!p.alive) return false;
    if (this.rules.training) return true;
    if (this.phase === 'freeze') return this.inBuyZone(p);
    return this.phase === 'live' && this.liveTime < this.rules.buyTime && this.inBuyZone(p);
  }

  buy(id: string, item: string): string | null {
    const p = this.byId(id);
    if (!p) return 'Jogador inválido';
    if (!this.canBuyNow(p)) return 'Fora do tempo ou da área de compra';
    const state = {
      team: p.team, money: p.money, primary: p.primary?.id, secondary: p.secondary?.id,
      armor: p.armor, helmet: p.helmet, kit: p.kit, nades: { ...p.nades }
    };
    const err = canBuy(state, item);
    if (err) return err;
    const price = buyPrice(state, item);
    p.money -= price;
    if (item === 'vest') p.armor = 100;
    else if (item === 'vesthelm') {
      p.armor = 100;
      p.helmet = true;
    } else if (item === 'kit') p.kit = true;
    else p.giveWeapon(item);
    this.emit('buy', { pid: p.id, item });
    return null;
  }

  // ------------------------------------------------------------------ visão para o cliente

  roundView(): RoundView {
    return {
      phase: this.phase,
      timeLeft: this.phase === 'live' && this.bomb.state === 'planted' ? this.bomb.timeLeft : Math.max(0, this.phaseTime),
      number: this.roundNumber,
      maxRounds: this.rules.maxRounds,
      winRounds: this.rules.winRounds,
      scoreT: this.score[this.groupOf('T')],
      scoreCT: this.score[this.groupOf('CT')],
      mode: this.config.mode,
      mapId: this.map.def.id,
      lastWinner: this.lastWinner,
      lastReason: this.lastReason,
      buyTimeLeft: this.phase === 'freeze' ? this.rules.buyTime + this.phaseTime : Math.max(0, this.rules.buyTime - this.liveTime),
      halftime: this.swapped
    };
  }

  playerView(p: SimPlayer): PlayerView {
    const c = p.ctrl;
    return {
      id: p.id, name: p.name, team: p.team, bot: p.bot,
      x: r2(c.position.x), y: r2(c.position.y), z: r2(c.position.z), vx: r2(c.velocity.x), vy: r2(c.velocity.y), vz: r2(c.velocity.z),
      yaw: r3(c.yaw), pitch: r3(c.pitch), crouch: c.crouched, ground: c.onGround, alive: p.alive,
      hp: Math.max(0, Math.round(p.health)), armor: Math.round(p.armor), helmet: p.helmet, kit: p.kit, money: p.money,
      weapon: p.weaponId(), bomb: p.c4, act: p.act, kills: p.kills, deaths: p.deaths, assists: p.assists, score: p.score,
      mvps: p.mvps, ping: p.ping, connected: p.connected, variant: p.variant, skin: p.skinOf()
    };
  }

  bombView(): BombView {
    const b = this.bomb;
    return {
      state: b.state, x: r2(b.pos.x), y: r2(b.pos.y), z: r2(b.pos.z), carrier: b.carrier, timeLeft: r2(b.timeLeft),
      site: b.site, defuser: b.defuser, progress: r2(b.progress)
    };
  }

  snapshot(forId: string | null, events: SimEvent[]): Snapshot {
    const me = forId ? this.byId(forId) : undefined;
    return {
      tick: this.tick,
      ack: me?.lastSeq ?? 0,
      round: this.roundView(),
      players: this.players.map(p => this.playerView(p)),
      bomb: this.bombView(),
      nades: this.nades.nades.map(n => ({ id: n.id, type: n.type, x: r2(n.pos.x), y: r2(n.pos.y), z: r2(n.pos.z), smoke: r2(n.smoke) })),
      doors: this.map.doors.map(d => d.open),
      you: me ? me.localView(this.canBuyNow(me), this.time) : null,
      events
    };
  }
}

function r2(v: number): number {
  return Math.round(v * 100) / 100;
}

function r3(v: number): number {
  return Math.round(v * 1000) / 1000;
}
