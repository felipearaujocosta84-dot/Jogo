// Táticas de equipe dos bots. Cada lado tem um plano por rodada:
//  TR: escolhe um local (A/B), reúne no ponto de preparação, invade junto, o portador planta, depois defendem a bomba.
//  CT: divide a defesa entre A, B e meio; ao ver inimigos num local ou ouvir a bomba, rotaciona e retoma/desarma.
// A memória compartilhada guarda onde os inimigos foram vistos (comunicação do time).
import type { MatchSim } from '../../sim/MatchSim';
import type { SimPlayer } from '../../sim/PlayerSim';
import type { Team } from '../../sim/types';

export interface BotTask {
  kind: 'stage' | 'execute' | 'plant' | 'guard' | 'hold' | 'retake' | 'defuse' | 'pickup' | 'hunt' | 'wander';
  x: number;
  z: number;
  /** Direção para vigiar (radianos) ao chegar. */
  yaw?: number;
}

interface Intel {
  x: number;
  z: number;
  t: number;
}

export class TeamTactics {
  site: 'A' | 'B' = 'A';
  executeAt = 20;
  executing = false;
  rotateSite: 'A' | 'B' | null = null;
  intel = new Map<string, Intel>();
  private slots = new Map<string, number>();
  private points = new Map<string, { x: number; z: number }>();

  constructor(private match: MatchSim, readonly team: Team) {}

  newRound(): void {
    this.site = Math.random() < 0.5 ? 'A' : 'B';
    this.executeAt = 14 + Math.random() * 22;
    this.executing = false;
    this.rotateSite = null;
    this.intel.clear();
    this.slots.clear();
    this.points.clear();
    let i = 0;
    for (const p of this.match.players) if (p.team === this.team) this.slots.set(p.id, i++);
  }

  report(enemy: SimPlayer): void {
    const pos = enemy.ctrl.position;
    this.intel.set(enemy.id, { x: pos.x, z: pos.z, t: this.match.time });
    // CT: inimigos vistos dentro de um local disparam rotação
    if (this.team === 'CT' && !this.rotateSite) {
      const site = this.match.map.siteAt(pos.x, pos.z);
      const near = site ?? this.nearSite(pos.x, pos.z);
      if (near && this.match.alive('T').length >= 2) {
        const seen = [...this.intel.values()].filter(v => this.match.time - v.t < 4 && (this.match.map.siteAt(v.x, v.z) === near || this.nearSite(v.x, v.z) === near));
        if (seen.length >= 2) this.rotateSite = near;
      }
    }
  }

  private nearSite(x: number, z: number): 'A' | 'B' | null {
    for (const s of this.match.map.def.sites) {
      const cx = (s.min[0] + s.max[0]) / 2, cz = (s.min[1] + s.max[1]) / 2;
      if (Math.hypot(x - cx, z - cz) < 22) return s.name;
    }
    return null;
  }

  /** Inimigo conhecido mais recente perto de um ponto. */
  latestIntel(maxAge = 6): Intel | null {
    let best: Intel | null = null;
    for (const v of this.intel.values()) if (this.match.time - v.t < maxAge && (!best || v.t > best.t)) best = v;
    return best;
  }

  private siteDef(name: 'A' | 'B') {
    return this.match.map.def.sites.find(s => s.name === name)!;
  }

  private point(key: string, make: () => { x: number; z: number } | null): { x: number; z: number } {
    let p = this.points.get(key);
    if (!p) {
      p = make() ?? { x: 0, z: 0 };
      this.points.set(key, p);
    }
    return p;
  }

  private sitePoint(key: string, site: 'A' | 'B', shrink = 3): { x: number; z: number } {
    const s = this.siteDef(site);
    const nav = this.match.nav!;
    return this.point(key, () => nav.randomIn(s.min[0] + shrink, s.min[1] + shrink, s.max[0] - shrink, s.max[1] - shrink, Math.random));
  }

  task(bot: SimPlayer): BotTask {
    const m = this.match;
    const slot = this.slots.get(bot.id) ?? 0;
    const tac = m.map.def.tactics;
    const bomb = m.bomb;

    if (this.team === 'T') {
      if (bomb.state === 'planted') {
        const p = this.point('guard' + bot.id, () => m.nav!.randomNear(bomb.pos.x, bomb.pos.z, 7, Math.random));
        const ct = m.map.spawnCenter('CT');
        return { kind: 'guard', x: p.x, z: p.z, yaw: Math.atan2(ct.x - p.x, ct.z - p.z) };
      }
      if (bomb.state === 'dropped') {
        // o TR vivo mais próximo busca a bomba
        const ts = m.alive('T');
        const nearest = ts.sort((a, b) => dist(a, bomb.pos) - dist(b, bomb.pos))[0];
        if (nearest === bot) return { kind: 'pickup', x: bomb.pos.x, z: bomb.pos.z };
      }
      if (!this.executing) {
        const staged = m.alive('T').filter(p => {
          const st = tac[this.site].tStage[(this.slots.get(p.id) ?? 0) % tac[this.site].tStage.length];
          return Math.hypot(p.ctrl.position.x - st[0], p.ctrl.position.z - st[1]) < 4;
        }).length;
        if (m.liveTime >= this.executeAt || staged >= Math.max(2, Math.ceil(m.alive('T').length * 0.6)) || m.phaseTime < 50) this.executing = true;
      }
      if (!this.executing) {
        const st = tac[this.site].tStage[slot % tac[this.site].tStage.length];
        const jitter = this.point('stage' + bot.id, () => m.nav!.randomNear(st[0], st[1], 2, Math.random));
        return { kind: 'stage', x: jitter.x, z: jitter.z };
      }
      if (bot.c4) {
        const p = this.sitePoint('plant', this.site, 5);
        return { kind: 'plant', x: p.x, z: p.z };
      }
      const p = this.sitePoint('exec' + bot.id, this.site);
      return { kind: 'execute', x: p.x, z: p.z };
    }

    // ---------------------------------------------------------------- CT
    if (bomb.state === 'planted' && bomb.site) {
      const cts = m.alive('CT');
      const closest = cts.sort((a, b) => dist(a, bomb.pos) - dist(b, bomb.pos))[0];
      const enemiesNear = [...this.intel.values()].some(v => m.time - v.t < 2.5 && Math.hypot(v.x - bomb.pos.x, v.z - bomb.pos.z) < 18);
      if (closest === bot && (!enemiesNear || bomb.timeLeft < (bot.kit ? 7 : 12) || m.alive('T').length === 0)) return { kind: 'defuse', x: bomb.pos.x, z: bomb.pos.z };
      const p = this.point('retake' + bot.id, () => m.nav!.randomNear(bomb.pos.x, bomb.pos.z, 6, Math.random));
      return { kind: 'retake', x: p.x, z: p.z };
    }
    if (bomb.state === 'dropped' && m.alive('T').length) {
      // vigia a bomba caída
      const p = this.point('watchbomb' + bot.id, () => m.nav!.randomNear(bomb.pos.x, bomb.pos.z, 10, Math.random));
      if (slot % 2 === 0) return { kind: 'hold', x: p.x, z: p.z, yaw: Math.atan2(bomb.pos.x - p.x, bomb.pos.z - p.z) };
    }
    if (this.rotateSite) {
      const p = this.sitePoint('rot' + bot.id, this.rotateSite);
      return { kind: 'hold', x: p.x, z: p.z };
    }
    if (m.alive('T').length <= 1 && m.liveTime > 40) {
      const intel = this.latestIntel(10);
      if (intel) return { kind: 'hunt', x: intel.x, z: intel.z };
    }
    const order: ('A' | 'B' | 'mid')[] = ['A', 'B', 'mid', 'A', 'B'];
    const where = order[slot % order.length];
    const list = where === 'mid' ? tac.ctMid : tac[where].ctHold;
    const idx = Math.floor(slot / order.length + (where === 'A' ? 0 : 0)) % list.length;
    const h = list[(idx + (slot >= 3 ? 1 : 0)) % list.length];
    return { kind: 'hold', x: h[0], z: h[1], yaw: (h[2] * Math.PI) / 180 };
  }
}

function dist(p: SimPlayer, pos: { x: number; z: number }): number {
  return Math.hypot(p.ctrl.position.x - pos.x, p.ctrl.position.z - pos.z);
}
