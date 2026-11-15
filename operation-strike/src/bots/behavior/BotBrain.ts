// Cérebro de um bot: gera um comando (igual ao de um jogador humano) a cada passo de simulação.
// Procura inimigos, reage com atraso conforme a dificuldade, mira com erro e controle de recuo, atira em rajadas,
// faz strafe, agacha, recua para cobertura com pouca vida, recarrega, compra, joga granadas, abre portas,
// segue o plano do time (plantar, defender, retomar, desarmar) e reage a sons, dano e flash.
import type { MatchSim } from '../../sim/MatchSim';
import type { SimPlayer } from '../../sim/PlayerSim';
import type { Vec3 } from '../../physics/CollisionWorld';
import { BTN, type Difficulty, type UserCmd } from '../../sim/types';
import { WEAPONS } from '../../weapons/WeaponData';
import { canSee, type Sighting } from '../perception/Perception';
import type { BotTask } from '../tactics/TeamTactics';
import type { NavPoint } from '../navigation/NavGrid';

interface Skill {
  reaction: [number, number];
  turn: number; // graus por segundo
  error: number; // graus
  head: number;
  comp: number;
  burst: number;
  pause: number;
  fov: number;
  strafe: number;
}

const SKILL: Record<Difficulty, Skill> = {
  easy: { reaction: [0.55, 0.85], turn: 220, error: 2.2, head: 0.12, comp: 0.15, burst: 3, pause: 0.5, fov: 100, strafe: 0.2 },
  normal: { reaction: [0.3, 0.45], turn: 440, error: 1.1, head: 0.35, comp: 0.55, burst: 5, pause: 0.28, fov: 120, strafe: 0.6 },
  hard: { reaction: [0.15, 0.24], turn: 820, error: 0.45, head: 0.6, comp: 0.85, burst: 9, pause: 0.12, fov: 140, strafe: 0.9 }
};

const DEG = Math.PI / 180;

export class BotBrain {
  private skill: Skill;
  private seq = 0;
  private yaw = 0;
  private pitch = 0;
  private path: NavPoint[] | null = null;
  private pathGoal: { x: number; z: number } | null = null;
  private repath = 0;
  private stuckT = 0;
  private stuckCount = 0;
  private lastPos: Vec3 = { x: 0, y: 0, z: 0 };
  private perceiveT = 0;
  private target: Sighting | null = null;
  private targetId: string | null = null;
  private reactT = 0;
  private aimHead = false;
  private aimErr = { yaw: 0, pitch: 0 };
  private burst = 0;
  private pauseT = 0;
  private strafeDir = 1;
  private strafeT = 0;
  private crouchFire = false;
  private blindT = 0;
  private alertPos: { x: number; z: number; t: number } | null = null;
  private retreat: { x: number; z: number; until: number } | null = null;
  private bought = false;
  private nadeIntent: { type: 'he' | 'flash' | 'smoke'; x: number; y: number; z: number; t: number } | null = null;
  private usePulse = false;
  private lastTaskKind = '';
  private holdLookT = 0;

  constructor(private m: MatchSim, private p: SimPlayer, private passive = false) {
    this.skill = SKILL[p.difficulty];
    this.yaw = p.ctrl.yaw;
  }

  newRound(): void {
    this.path = null;
    this.pathGoal = null;
    this.target = null;
    this.targetId = null;
    this.retreat = null;
    this.bought = false;
    this.alertPos = null;
    this.nadeIntent = null;
    this.yaw = this.p.ctrl.yaw;
    this.pitch = 0;
  }

  onDamaged(attacker: SimPlayer | null, from: Vec3): void {
    if (!attacker || attacker.team === this.p.team) return;
    this.alertPos = { x: from.x, z: from.z, t: this.m.time };
  }

  onFlashed(amount: number): void {
    this.blindT = Math.max(this.blindT, amount);
  }

  onKill(victim: SimPlayer, killer: SimPlayer | null): void {
    if (victim.id === this.targetId) {
      this.target = null;
      this.targetId = null;
    }
    if (killer && killer.team !== this.p.team && victim.team === this.p.team) {
      const d = Math.hypot(victim.ctrl.position.x - this.p.ctrl.position.x, victim.ctrl.position.z - this.p.ctrl.position.z);
      if (d < 25) this.alertPos = { x: killer.ctrl.position.x, z: killer.ctrl.position.z, t: this.m.time };
    }
  }

  private cmd(mx: number, my: number, buttons: number, sel = 0): UserCmd {
    return { seq: ++this.seq, mx, my, yaw: this.yaw, pitch: this.pitch, buttons, sel };
  }

  update(dt: number): UserCmd {
    const p = this.p, m = this.m;
    if (!p.alive) return this.cmd(0, 0, 0);
    if (m.phase === 'freeze' || m.phase === 'warmup') {
      if (!this.bought) this.buy();
      this.lookAround(dt);
      return this.cmd(0, 0, 0);
    }
    if (m.phase === 'over') return this.cmd(0, 0, 0);
    if (this.blindT > 0) this.blindT -= dt;

    // percepção (10 vezes por segundo)
    this.perceiveT -= dt;
    if (this.perceiveT <= 0) {
      this.perceiveT = 0.1;
      this.perceive();
    }

    if (this.passive) return this.passiveUpdate(dt);

    let buttons = 0;
    let sel = 0;
    let mx = 0, my = 0;
    const pos = p.ctrl.position;
    const w = p.weapon;

    if (this.target && this.blindT <= 0) {
      // ---------------------------------------------------------------- combate
      const t = this.target.enemy;
      this.reactT -= dt;
      const tp = t.ctrl.position;
      const aimY = tp.y + (this.aimHead ? (t.ctrl.crouched ? 1.05 : 1.62) : t.ctrl.crouched ? 0.78 : 1.25);
      const eye = p.eye();
      const dx = tp.x - eye.x, dy = aimY - eye.y, dz = tp.z - eye.z;
      const flat = Math.hypot(dx, dz);
      let wantYaw = Math.atan2(dx, dz) + this.aimErr.yaw * DEG;
      let wantPitch = Math.atan2(dy, flat) + this.aimErr.pitch * DEG;
      // compensação de recuo
      wantPitch -= p.punchP * DEG * this.skill.comp;
      wantYaw -= p.punchY * DEG * this.skill.comp;
      this.turnTo(wantYaw, wantPitch, dt);
      const err = Math.abs(angDiff(this.yaw, wantYaw)) + Math.abs(this.pitch - wantPitch);
      const tolerance = Math.max(1.2 * DEG, Math.atan2(0.35, flat));

      // arma: sem munição -> pistola se o inimigo estiver perto
      const inst = p.inst;
      if (inst && inst.ammo === 0 && p.reloadT <= 0) {
        if (p.active === 'primary' && p.secondary && p.secondary.ammo > 0 && flat < 15 && this.skill.strafe > 0.3) sel = 2;
        else buttons |= BTN.RELOAD;
      }
      if (p.active === 'knife' || p.active === 'c4' || p.active === 'he' || p.active === 'flash' || p.active === 'smoke') sel = p.primary ? 1 : 2;

      // luneta
      if (w.scope && p.scope === 0 && flat > 8 && p.cooldown <= 0) buttons |= this.pulse() ? BTN.ZOOM : 0;

      // rajadas
      if (this.pauseT > 0) this.pauseT -= dt;
      const canShoot = this.reactT <= 0 && err < tolerance && this.pauseT <= 0;
      if (canShoot) {
        if (w.automatic) {
          buttons |= BTN.FIRE;
          if (p.firedTick === m.tick - 1) this.burst++;
          const maxBurst = flat < 8 ? this.skill.burst * 2 : this.skill.burst;
          if (this.burst >= maxBurst) {
            this.burst = 0;
            this.pauseT = this.skill.pause * (flat > 20 ? 1.4 : 1);
          }
        } else if (p.cooldown <= 0 && this.pulse()) buttons |= BTN.FIRE;
      }

      // movimento em combate
      const hp = p.health;
      if (hp < 35 && !this.retreat && Math.random() < 0.02 && m.bomb.state !== 'planted') this.findCover(t);
      if (this.retreat && m.time < this.retreat.until) {
        [mx, my] = this.followTo(this.retreat.x, this.retreat.z, dt, false);
        if (err > tolerance * 2) buttons &= ~BTN.FIRE;
      } else {
        this.retreat = null;
        this.strafeT -= dt;
        if (this.strafeT <= 0) {
          this.strafeT = 0.35 + Math.random() * 0.6;
          this.strafeDir = Math.random() < 0.5 ? -1 : 1;
          this.crouchFire = Math.random() < (this.skill.strafe > 0.8 ? 0.3 : 0.12);
        }
        const firing = (buttons & BTN.FIRE) !== 0;
        if (Math.random() < this.skill.strafe && (!firing || flat < 7)) mx = this.strafeDir;
        if (firing && this.crouchFire && flat > 8) buttons |= BTN.CROUCH;
      }
      if (w.cls === 'knife' && flat > 1.6) my = 1;
    } else {
      // ---------------------------------------------------------------- objetivo
      this.burst = 0;
      const tac = m.tactics[p.team];
      const task = tac.task(p);
      if (task.kind !== this.lastTaskKind) {
        this.lastTaskKind = task.kind;
        this.path = null;
      }
      const d = Math.hypot(task.x - pos.x, task.z - pos.z);
      const arrived = d < (task.kind === 'defuse' || task.kind === 'pickup' ? 0.9 : task.kind === 'plant' ? 1.2 : 1.6);

      // recarrega fora de combate
      const inst = p.inst;
      if (inst && inst.ammo < WEAPONS[inst.id].magazine * 0.45 && inst.reserve > 0 && p.reloadT <= 0) buttons |= BTN.RELOAD;
      if (p.active === 'knife' || (p.active === 'c4' && task.kind !== 'plant')) sel = p.primary ? 1 : 2;

      if (!arrived) {
        [mx, my] = this.followTo(task.x, task.z, dt, true);
        // corre fora de perigo; anda mais devagar perto de inimigos conhecidos
        const intel = tac.latestIntel(3);
        if (intel && Math.hypot(intel.x - pos.x, intel.z - pos.z) < 18 && this.skill.strafe > 0.5) buttons |= BTN.WALK;
      } else {
        this.path = null;
        if (task.yaw !== undefined) this.holdLook(task.yaw, dt);
        else this.lookAround(dt);
      }
      if (task.kind === 'plant' && arrived && p.c4) buttons |= BTN.USE;
      if (task.kind === 'defuse' && arrived) {
        buttons |= BTN.USE;
        this.turnTo(this.yaw, -0.6, dt);
      }

      // alerta (dano, tiros, companheiro morto): olha para lá
      if (this.alertPos && m.time - this.alertPos.t < 3 && !(buttons & BTN.USE)) {
        this.turnTo(Math.atan2(this.alertPos.x - pos.x, this.alertPos.z - pos.z), 0, dt);
      }

      // granadas
      this.maybeGrenade(task, (b, s) => {
        buttons |= b;
        if (s) sel = s;
      }, dt);

      // portas fechadas no caminho
      for (const door of m.map.doors) {
        if (door.open) continue;
        const dd = Math.hypot(door.center.x - pos.x, door.center.z - pos.z);
        if (dd < 2.6) {
          this.turnTo(Math.atan2(door.center.x - pos.x, door.center.z - pos.z), 0, dt);
          if (this.pulse()) buttons |= BTN.USE;
        }
      }
    }
    return this.cmd(mx, my, buttons, sel);
  }

  private passiveUpdate(dt: number): UserCmd {
    // Bots de treino: andam devagar entre pontos do local, não atiram
    const pos = this.p.ctrl.position;
    if (!this.pathGoal || Math.hypot(this.pathGoal.x - pos.x, this.pathGoal.z - pos.z) < 1.2 || Math.random() < 0.002) {
      const pt = this.m.nav!.randomNear(pos.x, pos.z, 8, Math.random);
      this.path = null;
      this.pathGoal = pt ?? { x: pos.x, z: pos.z };
    }
    const [mx, my] = this.followTo(this.pathGoal.x, this.pathGoal.z, dt, true);
    return this.cmd(mx * 0.45, my * 0.45, 0);
  }

  private pulse(): boolean {
    this.usePulse = !this.usePulse;
    return this.usePulse;
  }

  private perceive(): void {
    const p = this.p, m = this.m;
    if (this.blindT > 0.3) {
      this.target = null;
      return;
    }
    let best: Sighting | null = null;
    for (const e of m.players) {
      if (!e.alive || e.team === p.team) continue;
      const s = canSee(m, p, e, this.target?.enemy === e ? 200 : this.skill.fov);
      if (!s) {
        // ouve tiros e passos de perto
        const d = Math.hypot(e.ctrl.position.x - p.ctrl.position.x, e.ctrl.position.z - p.ctrl.position.z);
        if ((e.firedTick > m.tick - 6 && d < 30) || (d < 9 && e.ctrl.horizontalSpeed > 3.4)) this.alertPos = { x: e.ctrl.position.x, z: e.ctrl.position.z, t: m.time };
        continue;
      }
      m.tactics[p.team].report(e);
      if (!best || s.dist < best.dist) best = s;
    }
    if (best) {
      if (best.enemy.id !== this.targetId) {
        this.targetId = best.enemy.id;
        const [a, b] = this.skill.reaction;
        this.reactT = a + Math.random() * (b - a) + (best.dist > 30 ? 0.1 : 0);
        this.aimHead = Math.random() < this.skill.head && best.visibleHead;
        const e = this.skill.error * (0.6 + Math.random() * 0.8);
        this.aimErr = { yaw: (Math.random() - 0.5) * 2 * e, pitch: (Math.random() - 0.5) * e };
      } else {
        // o erro diminui enquanto acompanha o alvo
        this.aimErr.yaw *= 0.92;
        this.aimErr.pitch *= 0.92;
      }
      this.target = best;
    } else {
      this.target = null;
    }
  }

  private turnTo(yaw: number, pitch: number, dt: number): void {
    const max = this.skill.turn * DEG * dt;
    const dy = angDiff(this.yaw, yaw);
    this.yaw += Math.max(-max, Math.min(max, dy));
    const dp = pitch - this.pitch;
    this.pitch += Math.max(-max, Math.min(max, dp));
    if (this.yaw > Math.PI) this.yaw -= Math.PI * 2;
    else if (this.yaw < -Math.PI) this.yaw += Math.PI * 2;
  }

  private lookAround(dt: number): void {
    this.holdLookT -= dt;
    this.turnTo(this.yaw + Math.sin(this.m.time * 0.6 + this.seq * 0.001) * 0.02, 0, dt);
  }

  private holdLook(yaw: number, dt: number): void {
    this.holdLookT -= dt;
    const sweep = Math.sin(this.m.time * 0.5 + this.p.variant) * 0.35;
    this.turnTo(yaw + sweep, -0.02, dt);
  }

  /** Segue o caminho até o destino e retorna o movimento (mx, my) relativo à mira. */
  private followTo(x: number, z: number, dt: number, face: boolean): [number, number] {
    const m = this.m, p = this.p, pos = p.ctrl.position;
    const nav = m.nav!;
    this.repath -= dt;
    if (!this.path || !this.pathGoal || Math.hypot(this.pathGoal.x - x, this.pathGoal.z - z) > 1.5 || this.repath <= 0) {
      this.path = nav.findPath(pos.x, pos.z, x, z);
      this.pathGoal = { x, z };
      this.repath = 2.5 + Math.random();
    }
    if (!this.path || !this.path.length) return [0, 0];
    let wp = this.path[0];
    while (this.path.length > 1 && Math.hypot(wp.x - pos.x, wp.z - pos.z) < 0.8) {
      this.path.shift();
      wp = this.path[0];
    }
    const dx = wp.x - pos.x, dz = wp.z - pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.25) return [0, 0];
    // detecção de travamento
    this.stuckT += dt;
    if (this.stuckT > 0.8) {
      const moved = Math.hypot(pos.x - this.lastPos.x, pos.z - this.lastPos.z);
      if (moved < 0.35) {
        this.stuckCount++;
        this.path = null;
        if (this.stuckCount > 2) {
          this.stuckCount = 0;
          const alt = nav.randomNear(pos.x, pos.z, 4, Math.random);
          if (alt) this.path = [alt];
        }
      } else this.stuckCount = 0;
      this.stuckT = 0;
      this.lastPos = { ...pos };
    }
    if (face) this.turnTo(Math.atan2(dx, dz), 0, dt);
    const nx = dx / d, nz = dz / d;
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    return [nx * c - nz * s, nx * s + nz * c];
  }

  private findCover(enemy: SimPlayer): void {
    const nav = this.m.nav!;
    const pos = this.p.ctrl.position;
    const eye = enemy.eye();
    for (let k = 0; k < 10; k++) {
      const pt = nav.randomNear(pos.x, pos.z, 9, Math.random);
      if (!pt) continue;
      const dir = { x: pt.x - eye.x, y: 1.4 - eye.y + this.p.ctrl.position.y, z: pt.z - eye.z };
      const d = Math.hypot(dir.x, dir.y, dir.z);
      const hit = this.m.map.world.raycast(eye, dir, d);
      if (hit && hit.distance < d - 0.5) {
        this.retreat = { x: pt.x, z: pt.z, until: this.m.time + 3 };
        this.path = null;
        return;
      }
    }
  }

  private maybeGrenade(task: BotTask, set: (buttons: number, sel: number) => void, dt: number): void {
    const p = this.p, m = this.m;
    if (this.nadeIntent) {
      const n = this.nadeIntent;
      const pos = p.ctrl.position;
      const dx = n.x - pos.x, dz = n.z - pos.z;
      const flat = Math.hypot(dx, dz);
      const pitch = Math.min(0.75, 0.25 + flat / 60);
      this.turnTo(Math.atan2(dx, dz), pitch, dt);
      if (p.active !== n.type) set(0, 4);
      else if (Math.abs(angDiff(this.yaw, Math.atan2(dx, dz))) < 0.1 && p.drawT <= 0) set(BTN.FIRE, 0);
      if (m.time - n.t > 2.5 || p.nades[n.type] === 0) this.nadeIntent = null;
      return;
    }
    if (Math.random() > 0.01) return;
    const site = m.map.def.sites.find(s => s.name === m.tactics.T.site)!;
    const cx = (site.min[0] + site.max[0]) / 2, cz = (site.min[1] + site.max[1]) / 2;
    const pos = p.ctrl.position;
    if (p.team === 'T' && task.kind === 'execute' && Math.hypot(cx - pos.x, cz - pos.z) < 26) {
      const type = p.nades.flash ? 'flash' : p.nades.smoke ? 'smoke' : null;
      if (type) this.nadeIntent = { type, x: cx, y: 1, z: cz, t: m.time };
    } else if (p.nades.he) {
      const intel = m.tactics[p.team].latestIntel(2);
      if (intel) {
        const d = Math.hypot(intel.x - pos.x, intel.z - pos.z);
        if (d > 8 && d < 24) this.nadeIntent = { type: 'he', x: intel.x, y: 1, z: intel.z, t: m.time };
      }
    }
  }

  // ---------------------------------------------------------------- compras

  private buy(): void {
    this.bought = true;
    const p = this.p, m = this.m;
    if (m.rules.training) return;
    const b = (item: string) => m.buy(p.id, item) === null;
    const pistolRound = m.roundNumber === 1 || m.roundNumber === m.rules.halfAt + 1;
    const team = m.players.filter(x => x.team === p.team);
    const avg = team.reduce((s, x) => s + x.money, 0) / Math.max(1, team.length);
    if (pistolRound) {
      if (Math.random() < 0.5) b('vest');
      else if (p.team === 'CT' && Math.random() < 0.5) b('kit');
      else b('p250');
      return;
    }
    const rifle = p.team === 'T' ? 'ak47' : Math.random() < 0.5 ? 'm4a4' : 'm4a1';
    if (!p.primary) {
      if (p.money >= 5750 && Math.random() < 0.18) b('awp');
      else if (p.money >= WEAPONS[rifle].price + 650) b(rifle);
      else if (avg < 2400 && p.money < 3000) {
        // economia: só pistola melhor de vez em quando
        if (p.money >= 1200 && Math.random() < 0.3) b('deagle');
        return;
      } else if (p.money >= 1700) b(p.team === 'T' ? 'mac10' : Math.random() < 0.5 ? 'mp5' : 'ump45');
    }
    if (p.money >= 1000 && p.armor < 100) b('vesthelm');
    else if (p.money >= 650 && p.armor < 50) b('vest');
    if (p.team === 'CT' && p.money >= 400 && Math.random() < 0.6) b('kit');
    const nades = ['flash', 'smoke', 'he', 'flash'];
    for (const n of nades) if (p.money >= 600 && Math.random() < 0.55) b(n);
  }
}

function angDiff(a: number, b: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
