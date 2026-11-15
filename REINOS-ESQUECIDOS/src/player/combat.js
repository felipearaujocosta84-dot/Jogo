// Combate do jogador: combo de 3 golpes, Golpe Giratório (habilidade), esquiva com invencibilidade,
// poções, mira automática no inimigo mais próximo, dano recebido e morte.
import { Vector3, Color4 } from '../babylon.js';

const COST = { slash: 5, slash3: 9, spin: 30, dodge: 20 };

export class Combat {
  constructor(player) {
    this.player = player;
    this.combo = 0;
    this.comboTimer = 0;
    this.queued = false;
    this.facingOverride = null;
    this.staminaDelay = 0;
    this.invuln = 0;
    this.skillCooldown = 0;
    this.potionCooldown = 0;
    this.dodgeCooldown = 0;
  }

  get game() { return this.player.game; }

  get busy() {
    const a = this.player.action;
    return !!a && a.name !== 'hurt';
  }

  movementLocked() {
    const a = this.player.action;
    if (!a) return false;
    return a.name.startsWith('slash') || a.name === 'drink' || a.name === 'interact' || a.name === 'death';
  }

  lungeSpeed() {
    const a = this.player.action;
    if (!a || !a.name.startsWith('slash')) return 0;
    const h = a.def.hit;
    if (a.t > h - 0.12 && a.t < h + 0.04) return a.name === 'slash3' ? 4.2 : 3.0;
    return 0;
  }

  spend(amount) {
    const p = this.player;
    if (p.stamina < amount * 0.6) {
      this.game.hud.flashStamina();
      return false;
    }
    p.stamina = Math.max(0, p.stamina - amount);
    this.staminaDelay = 0.7;
    return true;
  }

  /** Inimigo mais próximo à frente (para mirar). */
  findTarget(range = 5) {
    const p = this.player;
    let best = null, bestScore = Infinity;
    const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
    for (const e of this.game.enemies.list) {
      if (!e.alive || !e.active) continue;
      const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z;
      const d = Math.hypot(dx, dz);
      if (d > range) continue;
      const dot = (dx * fx + dz * fz) / (d || 1);
      const score = d - dot * 1.5;
      if (score < bestScore) { bestScore = score; best = e; }
    }
    return best;
  }

  aimAt(target) {
    const p = this.player;
    if (!target) { this.facingOverride = null; return; }
    this.facingOverride = Math.atan2(target.position.x - p.position.x, target.position.z - p.position.z);
  }

  attack() {
    const p = this.player;
    if (p.dead) return;
    const a = p.action;
    if (a && a.name.startsWith('slash')) {
      if (a.t > a.def.dur * 0.45) this.queued = true;
      return;
    }
    if (a && a.name !== 'hurt') return;
    this.startSlash();
  }

  startSlash() {
    const p = this.player;
    const name = ['slash1', 'slash2', 'slash3'][this.combo % 3];
    if (!this.spend(name === 'slash3' ? COST.slash3 : COST.slash)) return;
    this.aimAt(this.findTarget(5));
    p.play(name, { onHit: () => this.doHit(name) });
    this.game.audio.swing(name === 'slash3');
    this.combo = (this.combo + 1) % 3;
    this.comboTimer = 1.0;
    this.queued = false;
  }

  skill() {
    const p = this.player;
    if (p.dead || this.busy || this.skillCooldown > 0) return;
    if (!this.spend(COST.spin)) return;
    this.facingOverride = null;
    p.play('spin', { onHit: () => this.doHit('spin') });
    this.skillCooldown = 4;
    this.game.audio.swing(true);
    this.game.effects.dust(p.position.add(new Vector3(0, 0.2, 0)), true);
  }

  dodge(input) {
    const p = this.player;
    if (p.dead || this.dodgeCooldown > 0) return;
    const a = p.action;
    if (a && (a.name === 'dodge' || a.name === 'death' || a.name === 'drink')) return;
    if (!this.spend(COST.dodge)) return;
    const mv = p.movement;
    let dir = input.magnitude > 0.1 ? mv.inputDirection(input) : null;
    if (!dir) dir = { x: Math.sin(p.yaw), z: Math.cos(p.yaw) };
    p.yaw = Math.atan2(dir.x, dir.z);
    this.facingOverride = null;
    p.play('dodge');
    mv.startDash(dir, 8.5, 0.45);
    this.invuln = 0.4;
    this.dodgeCooldown = 0.55;
    this.game.audio.dodge();
  }

  drinkPotion() {
    const p = this.player;
    const inv = this.game.inventory;
    if (p.dead || this.busy || this.potionCooldown > 0) return;
    if (p.hp >= p.maxHp) { this.game.hud.toast('Vida já está cheia'); return; }
    if (!inv.has('pocao')) { this.game.hud.toast('Sem poções! Compre com o ferreiro.'); return; }
    inv.remove('pocao', 1);
    this.potionCooldown = 1.2;
    p.play('drink', {
      onHit: () => {
        const amount = Math.round(40 + p.maxHp * 0.25);
        p.heal(amount);
        this.game.hud.floatText(p.position.add(new Vector3(0, 2.1, 0)), '+' + amount, 'heal');
        this.game.effects.sparkle(p.position.add(new Vector3(0, 1, 0)), new Color4(0.4, 1, 0.5, 1));
        this.game.audio.potion();
      }
    });
    p.action.def = { ...p.action.def, hit: 0.45 };
  }

  doHit(kind) {
    const p = this.player;
    const g = this.game;
    const spin = kind === 'spin';
    const range = spin ? 3.1 : kind === 'slash3' ? 2.7 : 2.45;
    const minDot = spin ? -2 : kind === 'slash3' ? 0.45 : 0.15;
    const mult = spin ? 1.5 : kind === 'slash3' ? 1.7 : 1;
    const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
    let hits = 0;
    for (const e of g.enemies.list) {
      if (!e.alive || !e.active) continue;
      const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z;
      const d = Math.hypot(dx, dz);
      if (d > range + e.radius) continue;
      const dot = (dx * fx + dz * fz) / (d || 1);
      if (dot < minDot) continue;
      const crit = Math.random() < 0.1;
      let dmg = p.attack * mult * (0.9 + Math.random() * 0.2);
      if (crit) dmg *= 1.6;
      dmg = Math.round(dmg);
      const nx = dx / (d || 1), nz = dz / (d || 1);
      e.takeDamage(dmg, nx, nz, spin || kind === 'slash3' ? 5 : 3, crit);
      hits++;
    }
    if (hits) {
      g.hitStop(kind === 'slash3' || spin ? 0.07 : 0.045);
      g.cameraRig.shake(kind === 'slash3' ? 0.25 : 0.12);
      g.audio.hit(kind === 'slash3' || spin);
    }
    // destrói objetos quebráveis próximos
    g.interaction && g.interaction.onPlayerStrike(p.position, fx, fz, range);
  }

  /** Dano recebido. Retorna true se acertou. */
  receiveDamage(raw, fromX, fromZ, knock = 4) {
    const p = this.player;
    const g = this.game;
    if (p.dead) return false;
    if (this.invuln > 0) {
      g.hud.floatText(p.position.add(new Vector3(0, 2.1, 0)), 'Esquivou!', 'miss');
      return false;
    }
    const dmg = Math.max(1, Math.round(raw * (0.9 + Math.random() * 0.2) - p.defense * 0.7));
    p.hp = Math.max(0, p.hp - dmg);
    p.flash = 0.15;
    g.hud.floatText(p.position.add(new Vector3(0, 2.1, 0)), '-' + dmg, 'hurt');
    g.hud.damageVignette();
    g.cameraRig.shake(0.22);
    g.audio.hurt();
    g.effects.blood(p.position.add(new Vector3(0, 1.2, 0)));
    const dx = p.position.x - fromX, dz = p.position.z - fromZ;
    const d = Math.hypot(dx, dz) || 1;
    p.movement.addKnockback(dx / d, dz / d, knock);
    if (p.hp <= 0) {
      this.die();
      return true;
    }
    const a = p.action;
    if (!a || a.name === 'hurt' || (a.name.startsWith('slash') && a.t > a.def.hit + 0.05)) {
      p.play('hurt');
      this.queued = false;
    }
    this.invuln = 0.25;
    return true;
  }

  die() {
    const p = this.player;
    p.dead = true;
    p.play('death');
    this.facingOverride = null;
    this.game.onPlayerDeath();
  }

  update(dt, input) {
    const p = this.player;
    this.invuln = Math.max(0, this.invuln - dt);
    this.skillCooldown = Math.max(0, this.skillCooldown - dt);
    this.potionCooldown = Math.max(0, this.potionCooldown - dt);
    this.dodgeCooldown = Math.max(0, this.dodgeCooldown - dt);
    this.comboTimer -= dt;
    if (this.comboTimer <= 0 && !this.busy) this.combo = 0;

    // estamina
    this.staminaDelay -= dt;
    if (this.staminaDelay <= 0) p.stamina = Math.min(p.maxStamina, p.stamina + dt * 26);
    // regeneração de vida lenta fora de combate
    if (!p.dead && this.game.enemies.inCombat === false) p.hp = Math.min(p.maxHp, p.hp + dt * 1.2);

    if (p.dead) return;
    if (input.attack) this.attack();
    if (input.skill) this.skill();
    if (input.dodge) this.dodge(input);
    if (input.potion) this.drinkPotion();

    // evento de impacto da ação atual
    const a = p.action;
    if (a && !a.hitDone && a.def.hit !== undefined && a.t >= a.def.hit) {
      a.hitDone = true;
      if (a.onHit) a.onHit();
    }
    // combo encadeado
    if (a && a.name.startsWith('slash') && this.queued && a.t > a.def.dur * 0.72) {
      p.action = null;
      this.startSlash();
    }
    if (!p.action || !p.action.name.match(/slash|spin/)) this.facingOverride = null;
  }
}
