// Jogador simulado: movimento (PlayerController) + inventário e lógica de armas.
// Roda igual no navegador (modo offline e previsão online) e no servidor autoritativo.
import { InputState } from '../core/Input';
import { PlayerController } from '../player/PlayerController';
import type { CollisionWorld, Vec3 } from '../physics/CollisionWorld';
import { DEFAULT_PISTOL, WEAPONS, type WeaponDef } from '../weapons/WeaponData';
import { BTN, type Difficulty, type LocalView, type Slot, type Team, type UserCmd } from './types';

const DEG = Math.PI / 180;
const SLOT_ORDER: Slot[] = ['primary', 'secondary', 'knife', 'he', 'flash', 'smoke', 'c4'];

export interface WeaponInst {
  id: string;
  ammo: number;
  reserve: number;
}

export interface SimHooks {
  /** Disparo/golpe: resolve acertos (a simulação da partida faz isso). */
  fire(p: SimPlayer, w: WeaponDef, origin: Vec3, dir: Vec3, rt?: number): void;
  throwNade(p: SimPlayer, type: 'he' | 'flash' | 'smoke', origin: Vec3, vel: Vec3): void;
  /** Botão USAR (ou atirar com a C4): plantar, desarmar, portas. */
  use(p: SimPlayer, held: boolean, pressed: boolean): void;
  event(type: string, data: Record<string, unknown>): void;
  canMove(p: SimPlayer): boolean;
}

export class SimPlayer {
  readonly ctrl: PlayerController;
  readonly input = new InputState();
  alive = true;
  /** Todos contra todos (Battle Royale): cada jogador é o próprio lado. */
  ffa = false;
  /** Colocação final no Battle Royale (1 = vencedor). */
  place = 0;
  health = 100;
  armor = 0;
  helmet = false;
  kit = false;
  money = 800;
  primary: WeaponInst | null = null;
  secondary: WeaponInst | null = null;
  nades = { he: 0, flash: 0, smoke: 0 };
  c4 = false;
  active: Slot = 'secondary';
  private lastWeapon: Slot = 'knife';
  cooldown = 0;
  reloadT = 0;
  drawT = 0;
  spray = 0;
  sinceShot = 10;
  punchP = 0;
  punchY = 0;
  scope = 0;
  private scopeRestore = 0;
  flashUntil = 0;
  /** Skins escolhidas pelo jogador (arma → skin). */
  skins: Record<string, string> = {};
  flashAmount = 0;
  /** 0 nada, 1 recarregando, 2 plantando, 3 desarmando */
  act = 0;
  frozen = false;
  plantProgress = 0;
  defuseProgress = 0;
  // estatísticas
  kills = 0;
  deaths = 0;
  assists = 0;
  damageDealt = 0;
  headshots = 0;
  mvps = 0;
  score = 0;
  roundKills = 0;
  /** Mata-mata: armas escolhidas (recebidas a cada renascimento). */
  loadout: { primary: string | null; secondary: string | null } = { primary: null, secondary: null };
  /** Mata-mata: invulnerável até este instante (proteção de renascimento). */
  protectUntil = 0;
  roundDamage = new Map<string, number>();
  // rede
  cmdQueue: UserCmd[] = [];
  lastSeq = 0;
  ping = 0;
  connected = true;
  /** Histórico de posições para compensação de latência: [tick, x, y, z, agachado] */
  history: Float32Array;
  private histIdx = 0;
  /** Disparou neste passo (para animação dos outros). */
  firedTick = -1;

  /** Lado para amigo/inimigo: a equipe, ou o próprio jogador no todos contra todos. */
  get side(): string {
    return this.ffa ? this.id : this.team;
  }

  constructor(
    public id: string,
    public name: string,
    public team: Team,
    public bot: boolean,
    public difficulty: Difficulty,
    public variant: number,
    world: CollisionWorld
  ) {
    this.ctrl = new PlayerController(world);
    this.history = new Float32Array(64 * 5).fill(-1);
  }

  // ------------------------------------------------------------ inventário

  has(slot: Slot): boolean {
    switch (slot) {
      case 'primary': return !!this.primary;
      case 'secondary': return !!this.secondary;
      case 'knife': return true;
      case 'he': return this.nades.he > 0;
      case 'flash': return this.nades.flash > 0;
      case 'smoke': return this.nades.smoke > 0;
      case 'c4': return this.c4;
    }
  }

  weaponId(slot: Slot = this.active): string {
    if (slot === 'primary') return this.primary?.id ?? 'knife';
    if (slot === 'secondary') return this.secondary?.id ?? 'knife';
    return slot;
  }

  skinOf(weaponId: string = this.weaponId()): string {
    return this.skins[weaponId] ?? 'default';
  }

  get weapon(): WeaponDef {
    return WEAPONS[this.weaponId()];
  }

  get inst(): WeaponInst | null {
    return this.active === 'primary' ? this.primary : this.active === 'secondary' ? this.secondary : null;
  }

  giveWeapon(id: string): void {
    const w = WEAPONS[id];
    if (!w) return;
    const inst = { id, ammo: w.magazine, reserve: w.reserve };
    if (w.slot === 'primary') this.primary = inst;
    else if (w.slot === 'secondary') this.secondary = inst;
    else if (w.cls === 'grenade') this.nades[id as 'he' | 'flash' | 'smoke']++;
    else if (w.slot === 'c4') this.c4 = true;
    if (w.slot === 'primary' || w.slot === 'secondary') this.select(w.slot, true);
  }

  /** Reaparece no início da rodada. keep = sobreviveu à rodada anterior (mantém armas). */
  spawn(x: number, y: number, z: number, yaw: number, keep: boolean): void {
    this.ctrl.teleport({ x, y, z }, yaw);
    if (!keep || !this.alive) {
      this.primary = null;
      this.secondary = { id: DEFAULT_PISTOL[this.team], ammo: WEAPONS[DEFAULT_PISTOL[this.team]].magazine, reserve: WEAPONS[DEFAULT_PISTOL[this.team]].reserve };
      this.nades = { he: 0, flash: 0, smoke: 0 };
      this.armor = 0;
      this.helmet = false;
      this.kit = false;
    } else {
      // sobreviventes mantêm armas, com munição completa de reserva
      for (const w of [this.primary, this.secondary]) if (w) w.reserve = Math.max(w.reserve, WEAPONS[w.id].reserve);
    }
    this.c4 = false;
    this.alive = true;
    this.health = 100;
    this.flashUntil = 0;
    this.flashAmount = 0;
    this.punchP = this.punchY = 0;
    this.spray = 0;
    this.scope = 0;
    this.reloadT = 0;
    this.act = 0;
    this.plantProgress = this.defuseProgress = 0;
    this.frozen = false;
    this.roundKills = 0;
    this.roundDamage.clear();
    this.input.reset();
    this.active = this.primary ? 'primary' : 'secondary';
    this.drawT = 0.3;
  }

  select(slot: Slot, force = false): void {
    if (!this.has(slot) || (slot === this.active && !force)) return;
    if (slot !== this.active) this.lastWeapon = this.active;
    this.active = slot;
    this.reloadT = 0;
    this.scope = 0;
    this.spray = 0;
    this.drawT = WEAPONS[this.weaponId()].drawTime;
    this.act = 0;
  }

  bestSlot(): Slot {
    if (this.primary) return 'primary';
    if (this.secondary) return 'secondary';
    return 'knife';
  }

  private cycle(): void {
    const avail = SLOT_ORDER.filter(s => this.has(s));
    const i = avail.indexOf(this.active);
    this.select(avail[(i + 1) % avail.length]);
  }

  private selectGrenade(): void {
    const nades: Slot[] = ['he', 'flash', 'smoke'];
    const start = nades.indexOf(this.active);
    for (let k = 1; k <= 3; k++) {
      const s = nades[(start + k + 3) % 3];
      if (this.has(s)) return this.select(s);
    }
  }

  // ------------------------------------------------------------ dispersão

  get spread(): number {
    const w = this.weapon;
    const c = this.ctrl;
    const speed = c.horizontalSpeed;
    let s: number;
    if (!c.onGround) s = w.spreadAir;
    else {
      const k = Math.min(1, Math.max(0, (speed - 0.8) / 4.2));
      s = w.spreadStand + (w.spreadMove - w.spreadStand) * k;
    }
    if (w.scope) {
      if (this.scope > 0) s = c.onGround ? Math.max(0.03, s * (speed > 1 ? 0.6 : 0.01)) : s;
    } else if (this.input.isDown('aim') && w.cls !== 'knife') s *= 0.6;
    if (c.crouched) s *= 0.75;
    // correndo: penalidade forte de precisão
    if (c.sprintT > 0.05 && c.onGround) s += (w.spreadMove - w.spreadStand) * 0.8 * c.sprintT + 1.5 * c.sprintT;
    s += Math.min(this.spray, 10) * (w.cls === 'pistol' ? 0.25 : 0.14);
    return s;
  }

  // ------------------------------------------------------------ comandos

  runCmd(cmd: UserCmd, dt: number, hooks: SimHooks, tick: number, replay = false): void {
    const inp = this.input;
    this.ctrl.yaw = cmd.yaw;
    this.ctrl.pitch = Math.max(-1.53, Math.min(1.53, cmd.pitch));
    if (!this.alive) {
      inp.reset();
      this.ctrl.enabled = false;
      this.ctrl.update(dt, inp, false);
      return;
    }
    const b = cmd.buttons;
    inp.setMove('cmd', Math.max(-1, Math.min(1, cmd.mx || 0)), Math.max(-1, Math.min(1, cmd.my || 0)));
    inp.set('fire', !!(b & BTN.FIRE), 'cmd');
    inp.set('aim', !!(b & BTN.AIM), 'cmd');
    inp.set('reload', !!(b & BTN.RELOAD), 'cmd');
    inp.set('jump', !!(b & BTN.JUMP), 'cmd');
    inp.set('crouch', !!(b & BTN.CROUCH), 'cmd');
    inp.set('walk', !!(b & BTN.WALK), 'cmd');
    // correr: só sem mirar/atirar/luneta (atirar cancela a corrida)
    inp.set('sprint', !!(b & BTN.SPRINT) && !(b & (BTN.AIM | BTN.FIRE)) && this.scope === 0 && this.reloadT <= 0, 'cmd');
    inp.set('interact', !!(b & BTN.USE), 'cmd');
    inp.set('zoom', !!(b & BTN.ZOOM), 'cmd');
    inp.set('switch', !!(b & BTN.NEXT), 'cmd');

    // troca de arma
    if (cmd.sel === 1) this.select('primary');
    else if (cmd.sel === 2) this.select('secondary');
    else if (cmd.sel === 3) this.select('knife');
    else if (cmd.sel === 4) this.selectGrenade();
    else if (cmd.sel === 5) this.select('c4');
    if (inp.consume('switch')) this.cycle();

    const w = this.weapon;
    // movimento
    const canMove = hooks.canMove(this) && !this.frozen;
    this.ctrl.enabled = canMove;
    let mult = w.speed;
    if (w.scope && this.scope > 0) mult *= 0.55;
    else if (inp.isDown('aim') && w.cls !== 'knife' && w.cls !== 'grenade') mult *= 0.8;
    this.ctrl.speedMultiplier = mult;
    this.ctrl.update(dt, inp, inp.isDown('crouch'));
    if (!canMove) {
      this.ctrl.velocity.x = 0;
      this.ctrl.velocity.z = 0;
    }
    if (replay) {
      // reprodução da previsão no cliente: só movimento
      inp.endFrame();
      return;
    }

    // timers
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.drawT = Math.max(0, this.drawT - dt);
    this.sinceShot += dt;
    if (this.sinceShot > 0.12) {
      const k = Math.exp(-dt * (w.cls === 'sniper' ? 4 : 7));
      this.punchP *= k;
      this.punchY *= k;
      this.spray = Math.max(0, this.spray - dt * (w.automatic ? 14 : 8));
    }
    if (this.scopeRestore > 0) {
      this.scopeRestore -= dt;
      if (this.scopeRestore <= 0 && this.cooldown <= 0) this.scope = Math.min(this.scope || 1, w.zoom.length);
    }
    const inst = this.inst;
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      this.act = 1;
      if (this.reloadT <= 0 && inst) {
        const take = Math.min(w.magazine - inst.ammo, inst.reserve);
        inst.ammo += take;
        inst.reserve -= take;
        this.act = 0;
      }
    }

    // luneta (snipers) — cada toque alterna o nível de zoom
    if (inp.consume('zoom') && w.scope && this.drawT <= 0 && this.reloadT <= 0) {
      this.scope = (this.scope + 1) % (w.zoom.length + 1);
      this.scopeRestore = 0;
      hooks.event('zoom', { pid: this.id, level: this.scope });
    }

    if (inp.consume('reload')) this.startReload(hooks);

    // usar / plantar / desarmar
    const c4Fire = this.active === 'c4' && inp.isDown('fire');
    hooks.use(this, inp.isDown('interact') || c4Fire, inp.consume('interact'));

    // disparo
    if (this.active !== 'c4' && !this.frozen) {
      const wants = w.automatic ? inp.isDown('fire') : inp.consume('fire');
      // vindo de uma corrida, a arma leva um instante para subir até a posição de tiro
      if (wants && this.ctrl.sprintT > 0.15 && w.cls !== 'knife') this.cooldown = Math.max(this.cooldown, 0.14 * this.ctrl.sprintT);
      if (wants) this.tryFire(w, hooks, cmd.rt, tick);
    }
    if (this.act === 1 && this.reloadT <= 0) this.act = 0;
    this.recordHistory(tick);
    inp.endFrame();
  }

  private startReload(hooks: SimHooks): void {
    const inst = this.inst;
    const w = this.weapon;
    if (!inst || this.reloadT > 0 || this.drawT > 0 || inst.ammo >= w.magazine || inst.reserve <= 0) return;
    this.reloadT = w.reloadTime;
    this.scope = 0;
    this.act = 1;
    hooks.event('reload', { pid: this.id, time: w.reloadTime });
  }

  /** Direção dos olhos com o recuo acumulado (graus de punch). */
  aimDir(extraSpreadDeg = 0): Vec3 {
    const yaw = this.ctrl.yaw + this.punchY * DEG;
    const pitch = this.ctrl.pitch + this.punchP * DEG;
    const fx = Math.sin(yaw) * Math.cos(pitch), fy = Math.sin(pitch), fz = Math.cos(yaw) * Math.cos(pitch);
    if (extraSpreadDeg <= 0) return { x: fx, y: fy, z: fz };
    const r = Math.sqrt(Math.random()) * extraSpreadDeg * DEG;
    const a = Math.random() * Math.PI * 2;
    // base ortonormal
    const rx = Math.cos(yaw), rz = -Math.sin(yaw);
    const ux = -Math.sin(pitch) * Math.sin(yaw), uy = Math.cos(pitch), uz = -Math.sin(pitch) * Math.cos(yaw);
    const t = Math.tan(r);
    const dx = fx + (rx * Math.cos(a) + ux * Math.sin(a)) * t;
    const dy = fy + uy * Math.sin(a) * t;
    const dz = fz + (rz * Math.cos(a) + uz * Math.sin(a)) * t;
    const len = Math.hypot(dx, dy, dz);
    return { x: dx / len, y: dy / len, z: dz / len };
  }

  eye(): Vec3 {
    return { x: this.ctrl.position.x, y: this.ctrl.eyeExact, z: this.ctrl.position.z };
  }

  private tryFire(w: WeaponDef, hooks: SimHooks, rt: number | undefined, tick: number): void {
    if (this.cooldown > 0 || this.drawT > 0) return;
    if (w.cls === 'grenade') {
      const type = this.active as 'he' | 'flash' | 'smoke';
      if (this.nades[type] <= 0) return;
      const dir = this.aimDir();
      const v = this.ctrl.velocity;
      const speed = this.input.isDown('aim') ? 7 : 15;
      hooks.throwNade(this, type, this.eye(), { x: dir.x * speed + v.x * 0.8, y: dir.y * speed + 2.2 + v.y * 0.5, z: dir.z * speed + v.z * 0.8 });
      this.nades[type]--;
      this.cooldown = 0.6;
      if (!this.has(this.active)) {
        const next = (['he', 'flash', 'smoke'] as Slot[]).find(s => this.has(s));
        this.select(next ?? (this.has(this.lastWeapon) && this.lastWeapon !== this.active ? this.lastWeapon : this.bestSlot()));
      }
      return;
    }
    if (w.cls === 'knife') {
      this.cooldown = 1 / w.fireRate;
      this.firedTick = tick;
      hooks.fire(this, w, this.eye(), this.aimDir(), rt);
      return;
    }
    const inst = this.inst;
    if (!inst || this.reloadT > 0) return;
    if (inst.ammo <= 0) {
      this.cooldown = 0.25;
      hooks.event('dry', { pid: this.id });
      this.startReload(hooks);
      return;
    }
    inst.ammo--;
    this.cooldown = 1 / w.fireRate;
    this.firedTick = tick;
    const spread = this.spread;
    const dir = this.aimDir(spread);
    hooks.fire(this, w, this.eye(), dir, rt);
    // recuo
    this.spray++;
    this.sinceShot = 0;
    const s = this.spray;
    this.punchP += w.recoil * 0.55 * (s < 9 ? 1 : 0.35) * (this.ctrl.crouched ? 0.85 : 1);
    this.punchY += Math.sin(s * 0.55) * w.recoilYaw * Math.min(1, s / 5) * 0.4 + (Math.random() - 0.5) * w.recoilYaw * 0.25;
    this.punchP = Math.min(this.punchP, 18);
    if (w.scope && this.scope > 0) {
      this.scopeRestore = 1 / w.fireRate;
      this.scope = 0;
    }
    if (inst.ammo === 0 && inst.reserve > 0 && this.bot) this.startReload(hooks);
  }

  private recordHistory(tick: number): void {
    const i = (this.histIdx = (this.histIdx + 1) % 64) * 5;
    const p = this.ctrl.position;
    this.history[i] = tick;
    this.history[i + 1] = p.x;
    this.history[i + 2] = p.y;
    this.history[i + 3] = p.z;
    this.history[i + 4] = this.ctrl.crouched ? 1 : 0;
  }

  /** Posição num tick passado (compensação de latência). */
  positionAt(tick: number): { pos: Vec3; crouched: boolean } {
    let best = -1, bestDiff = Infinity;
    for (let k = 0; k < 64; k++) {
      const t = this.history[k * 5];
      if (t < 0) continue;
      const d = Math.abs(t - tick);
      if (d < bestDiff) {
        bestDiff = d;
        best = k;
      }
    }
    if (best < 0 || bestDiff > 3) return { pos: { ...this.ctrl.position }, crouched: this.ctrl.crouched };
    const i = best * 5;
    return { pos: { x: this.history[i + 1], y: this.history[i + 2], z: this.history[i + 3] }, crouched: this.history[i + 4] === 1 };
  }

  localView(canBuy: boolean, time: number): LocalView {
    const slots: LocalView['slots'] = [];
    for (const s of SLOT_ORDER) {
      if (!this.has(s)) continue;
      const inst = s === 'primary' ? this.primary : s === 'secondary' ? this.secondary : null;
      const count = s === 'he' || s === 'flash' || s === 'smoke' ? this.nades[s] : 0;
      slots.push({ slot: s, id: this.weaponId(s), ammo: inst?.ammo ?? count, reserve: inst?.reserve ?? 0 });
    }
    const inst = this.inst;
    return {
      slots,
      active: this.active,
      ammo: inst?.ammo ?? (this.active === 'he' || this.active === 'flash' || this.active === 'smoke' ? this.nades[this.active] : 0),
      reserve: inst?.reserve ?? 0,
      reloading: this.reloadT > 0,
      flash: this.flashUntil > time ? Math.min(1, (this.flashUntil - time) / 1.2) * this.flashAmount : 0,
      scope: this.scope,
      plantProgress: this.plantProgress,
      defuseProgress: this.defuseProgress,
      canBuy,
      punchPitch: this.punchP,
      punchYaw: this.punchY,
      spread: this.spread
    };
  }
}
