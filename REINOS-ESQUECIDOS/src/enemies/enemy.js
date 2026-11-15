// Inimigos: tipos, atributos, animação procedural, dano, morte, saque e gerenciador (spawn/respawn).
import { Vector3, Color4, MeshBuilder, StandardMaterial, Color3 } from '../babylon.js';
import { createCharacter } from './enemyModels.js';
import { updateAI } from './enemyAI.js';

export const ENEMY_TYPES = {
  lobo: {
    name: 'Lobo Cinzento', hp: 34, dmg: 7, run: 4.8, walk: 1.5, aggro: 11, range: 1.6, windup: 0.42, recover: 1.1,
    xp: 14, gold: [1, 5], loot: [['pele_lobo', 0.5], ['pocao', 0.06]], radius: 0.55, rig: 'quad', scale: 1, sound: 'growl'
  },
  goblin: {
    name: 'Goblin Saqueador', hp: 52, dmg: 10, run: 3.7, walk: 1.3, aggro: 12, range: 1.7, windup: 0.55, recover: 1.3,
    xp: 22, gold: [4, 11], loot: [['dente_goblin', 0.45], ['pocao', 0.12]], radius: 0.45, rig: 'biped', scale: 1, sound: 'goblin'
  },
  aranha: {
    name: 'Aranha Gigante', hp: 42, dmg: 9, run: 4.3, walk: 1.4, aggro: 10, range: 1.8, windup: 0.4, recover: 1.0,
    xp: 20, gold: [2, 7], loot: [['seda_aranha', 0.5], ['pocao', 0.08]], radius: 0.7, rig: 'spider', scale: 1, sound: 'hiss'
  },
  esqueleto: {
    name: 'Guerreiro Esqueleto', hp: 88, dmg: 14, run: 3.1, walk: 1.2, aggro: 13, range: 1.95, windup: 0.7, recover: 1.5,
    xp: 36, gold: [7, 16], loot: [['osso_antigo', 0.5], ['pocao', 0.15]], radius: 0.45, rig: 'biped', scale: 1, sound: 'bones'
  },
  rei: {
    name: 'Rei Esquecido', hp: 700, dmg: 22, run: 2.9, walk: 1.2, aggro: 16, range: 2.9, windup: 0.85, recover: 1.4,
    xp: 450, gold: [150, 200], loot: [['lamina_runica', 1]], radius: 0.8, rig: 'biped', scale: 1.65, sound: 'bones',
    boss: true, superArmor: true, leash: 30
  }
};

// Grupos de inimigos no mapa: [tipo, x, z, quantidade, raio]
export const SPAWNS = [
  ['lobo', 16, 8, 3, 4], ['lobo', 22, 30, 3, 5], ['lobo', 66, 14, 2, 4], ['lobo', -18, 10, 2, 4], ['lobo', 5, -55, 2, 4],
  ['goblin', -50, 45, 3, 6], ['goblin', -34, 30, 2, 4], ['goblin', -63, 62, 2, 4], ['goblin', -42, 60, 2, 3],
  ['aranha', -58, -55, 3, 6], ['aranha', -42, -70, 2, 4], ['aranha', -72, -38, 2, 4],
  ['esqueleto', 45, 50, 2, 6], ['esqueleto', 32, 40, 2, 3], ['esqueleto', 58, 60, 2, 3]
];

const lerp = (a, b, t) => a + (b - a) * t;

export class Enemy {
  constructor(game, type, x, z, id) {
    this.game = game;
    this.type = type;
    this.def = ENEMY_TYPES[type];
    this.id = id;
    this.home = new Vector3(x, 0, z);
    this.position = new Vector3(x, game.world.groundAt(x, z), z);
    this.velocity = new Vector3(0, 0, 0);
    this.knock = new Vector3(0, 0, 0);
    this.yaw = Math.random() * Math.PI * 2;
    this.radius = this.def.radius * (this.def.scale || 1);
    this.maxHp = this.def.hp;
    this.hp = this.maxHp;
    this.alive = true;
    this.active = true;
    this.state = 'idle';
    this.stateTime = 0;
    this.timer = Math.random() * 3;
    this.target = null;
    this.phase = Math.random() * 10;
    this.speedNorm = 0;
    this.flash = 0;
    this.showBar = 0;
    this.attackT = 0;
    this.slot = Math.random() * Math.PI * 2;
    this.deadTime = 0;
    this.respawnAt = 0;
    this.special = 0;
    this.char = createCharacter(game.scene, type, type + id, this.def.scale || 1);
    this.char.root.position.copyFrom(this.position);
    for (const inst of this.char.instances) game.addShadowCaster(inst);
  }

  get name() { return this.def.name; }

  setActive(on) {
    if (this.active === on) return;
    this.active = on;
    this.char.root.setEnabled(on);
  }

  setFlash(k) {
    const r = 1 + k * 2.2, g = 1 + k * 0.6, b = 1 + k * 0.4;
    for (const inst of this.char.instances) {
      const col = inst.instancedBuffers.instanceColor;
      if (!col) continue;
      col.r = r; col.g = g; col.b = b;
    }
  }

  takeDamage(dmg, nx, nz, knock, crit) {
    if (!this.alive) return;
    const g = this.game;
    this.hp -= dmg;
    this.flash = 0.16;
    this.showBar = 6;
    const head = this.position.add(new Vector3(0, 1.6 * (this.def.scale || 1), 0));
    g.hud.floatText(head, (crit ? 'CRÍTICO ' : '') + dmg, crit ? 'crit' : 'dmg');
    g.effects.hit(this.position.add(new Vector3(0, 0.9 * (this.def.scale || 1), 0)), crit);
    if (this.type === 'esqueleto' || this.type === 'rei') {
      g.effects.burst(this.position.add(new Vector3(0, 1, 0)), { count: 8, color: new Color4(0.9, 0.88, 0.8, 1), additive: false, power: 3, gravity: -9 });
    } else {
      g.effects.blood(this.position.add(new Vector3(0, 0.8, 0)), this.type === 'aranha' ? new Color4(0.3, 0.55, 0.15, 1) : undefined);
    }
    const kb = this.def.boss ? knock * 0.15 : knock;
    this.knock.x += nx * kb;
    this.knock.z += nz * kb;
    g.audio.enemyHurt(this.type);
    if (this.hp <= 0) {
      this.die();
      return;
    }
    // reage: persegue quem bateu, e cambaleia (exceto chefes)
    this.target = g.player;
    if (!this.def.superArmor || crit) {
      if (this.state !== 'hurt') this.setState('hurt');
      this.timer = 0.32;
    } else if (this.state === 'idle' || this.state === 'wander' || this.state === 'return') {
      this.setState('chase');
    }
    g.enemies.alertNear(this);
  }

  die() {
    const g = this.game;
    this.alive = false;
    this.hp = 0;
    this.setState('dead');
    this.deadTime = 0;
    this.showBar = 0;
    g.player.gainXp(this.def.xp);
    g.hud.floatText(this.position.add(new Vector3(0, 2.2, 0)), '+' + this.def.xp + ' XP', 'xp');
    // saque
    const [gmin, gmax] = this.def.gold;
    const gold = Math.round(gmin + Math.random() * (gmax - gmin));
    const drops = [['ouro', gold]];
    for (const [item, chance] of this.def.loot) if (Math.random() < chance) drops.push([item, 1]);
    drops.forEach(([item, qty], i) => {
      const a = (i / drops.length) * Math.PI * 2 + Math.random();
      const r = drops.length > 1 ? 0.7 : 0;
      g.interaction.spawnPickup(this.position.x + Math.cos(a) * r, this.position.z + Math.sin(a) * r, item, qty);
    });
    g.audio.enemyDie(this.type);
    g.onEnemyKilled(this);
    this.respawnAt = this.def.boss ? Infinity : g.time + 80 + Math.random() * 40;
  }

  respawn() {
    const g = this.game;
    this.hp = this.maxHp;
    this.alive = true;
    this.setState('idle');
    this.position.set(this.home.x, g.world.groundAt(this.home.x, this.home.z), this.home.z);
    this.char.body.position.set(0, 0, 0);
    this.char.body.rotation.set(0, 0, 0);
    this.char.root.setEnabled(true);
    this.setFlash(0);
  }

  setState(s) {
    this.state = s;
    this.stateTime = 0;
  }

  update(dt) {
    this.stateTime += dt;
    if (!this.alive) {
      this.deadTime += dt;
      this.animate(dt);
      if (this.deadTime > 2.4) {
        // afunda no chão e some
        this.char.body.position.y = -(this.deadTime - 2.4) * 0.8;
        if (this.deadTime > 4) this.char.root.setEnabled(false);
      }
      return;
    }
    updateAI(this, dt, this.game);
    if (this.flash > 0) {
      this.flash -= dt;
      this.setFlash(Math.max(0, this.flash / 0.16));
    }
    this.showBar = Math.max(0, this.showBar - dt);
    this.animate(dt);
    this.char.root.position.copyFrom(this.position);
    this.char.root.rotation.y = this.yaw;
  }

  // ---------------- ANIMAÇÃO PROCEDURAL ----------------
  animate(dt) {
    const J = this.char.joints;
    const sp = this.speedNorm;
    const t = this.game.time;
    const ph = this.phase;
    const s = Math.sin(ph), c = Math.cos(ph);
    const st = this.state;
    const atk = st === 'attack' ? Math.min(1, this.attackT / this.def.windup) : 0;
    const strike = st === 'attack' && this.attackT > this.def.windup ? Math.min(1, (this.attackT - this.def.windup) / 0.12) : 0;
    const hurt = st === 'hurt' ? Math.sin(Math.min(1, this.stateTime / 0.3) * Math.PI) : 0;
    const body = this.char.body;
    const rest = (n) => n.metadata.rest;

    if (this.def.rig === 'biped') {
      const A = lerp(0.05, 0.7, sp);
      J.legR.rotation.x = -s * A;
      J.legL.rotation.x = s * A;
      J.armL.rotation.x = -s * A * 0.6;
      J.armL.rotation.z = -0.12;
      J.hips.position.y = rest(J.hips).y - Math.abs(c) * 0.05 * sp + Math.sin(t * 2) * 0.01;
      J.hips.rotation.y = s * 0.08 * sp;
      // braço da arma: preparo (levanta) e golpe (desce)
      const swing = s * A * 0.6;
      let armX = lerp(swing - 0.25, -2.5, atk);
      armX = lerp(armX, -0.35, strike);
      J.armR.rotation.x = armX;
      J.armR.rotation.z = 0.12 + atk * 0.1;
      J.hips.rotation.x = lerp(0.05 * sp, -0.15, atk) + strike * 0.35 - hurt * 0.3;
      J.head.rotation.x = -hurt * 0.3 + (this.type === 'goblin' ? 0.1 : 0);
      if (this.special > 0) {
        // golpe especial do chefe (espada erguida com as duas mãos)
        const k = Math.min(1, this.special);
        J.armR.rotation.x = lerp(J.armR.rotation.x, -2.9, k);
        J.armL.rotation.x = lerp(J.armL.rotation.x, -2.9, k);
      }
    } else if (this.def.rig === 'quad') {
      const A = lerp(0.05, 0.75, sp);
      J.legFL.rotation.x = -s * A; J.legBR.rotation.x = -s * A;
      J.legFR.rotation.x = s * A; J.legBL.rotation.x = s * A;
      J.body.position.y = rest(J.body).y - Math.abs(c) * 0.06 * sp + Math.sin(t * 2.5) * 0.01;
      J.body.rotation.x = s * 0.04 * sp - atk * 0.15 + strike * 0.25;
      J.body.position.z = strike * 0.35 - atk * 0.15;
      J.head.rotation.x = lerp(0.05, -0.35, atk) + strike * 0.6 - hurt * 0.4;
      J.tail.rotation.y = Math.sin(t * (st === 'chase' ? 12 : 4)) * 0.35;
      J.tail.rotation.x = st === 'chase' || st === 'attack' ? -0.3 : 0.2;
    } else if (this.def.rig === 'spider') {
      const A = lerp(0.04, 0.35, sp);
      for (let i = 0; i < 8; i++) {
        const leg = J['leg' + i];
        const off = (i % 2 === 0 ? 0 : Math.PI) + (i < 4 ? 0 : Math.PI);
        leg.rotation.y = Math.sin(ph + off) * A;
        leg.rotation.z = Math.max(0, Math.cos(ph + off)) * A * (i < 4 ? 1 : -1) * 0.8;
      }
      J.body.position.y = rest(J.body).y + Math.sin(ph * 2) * 0.03 * sp + atk * 0.25 - strike * 0.2;
      J.body.rotation.x = -atk * 0.45 + strike * 0.5 - hurt * 0.3;
      J.body.position.z = strike * 0.4;
    }

    if (st === 'dead') {
      const k = Math.min(1, this.deadTime / 0.6);
      const e = k * k * (3 - 2 * k);
      if (this.def.rig === 'biped') {
        body.rotation.x = -e * 1.45;
        body.position.y = -e * 0.1 * (this.def.scale || 1);
      } else if (this.def.rig === 'quad') {
        body.rotation.z = e * 1.5;
        body.position.y = -e * 0.25;
      } else {
        body.rotation.z = e * Math.PI;
        body.position.y = e * 0.4;
        for (let i = 0; i < 8; i++) J['leg' + i].rotation.z = (i < 4 ? -1 : 1) * e * 0.8;
      }
    }
  }
}

export class EnemyManager {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.inCombat = false;
    this.boss = null;
    this.activeDist = 60;
  }

  spawnAll() {
    const w = this.game.world;
    let id = 0;
    for (const [type, cx, cz, count, r] of SPAWNS) {
      for (let i = 0; i < count; i++) {
        let x = cx, z = cz;
        for (let tries = 0; tries < 12; tries++) {
          const a = Math.random() * Math.PI * 2, d = Math.random() * r;
          x = cx + Math.cos(a) * d; z = cz + Math.sin(a) * d;
          const p = new Vector3(x, 0, z);
          if (!w.isDeepWater(x, z) && !w.resolve(p, 0.8)) break;
        }
        this.list.push(new Enemy(this.game, type, x, z, id++));
      }
    }
    // chefe no altar das ruínas
    const alt = w.regions.altar;
    if (alt) {
      this.boss = new Enemy(this.game, 'rei', alt.x, alt.z + 3, id++);
      this.boss.yaw = Math.PI;
      this.boss.dormant = true; // acorda quando o jogador se aproxima com a missão ativa
      this.list.push(this.boss);
    }
    this.createTelegraph();
  }

  createTelegraph() {
    const s = this.game.scene;
    const ring = MeshBuilder.CreateDisc('telegraph', { radius: 1, tessellation: 40 }, s);
    ring.rotation.x = Math.PI / 2;
    const mat = new StandardMaterial('telegraphMat', s);
    mat.diffuseColor = new Color3(0, 0, 0);
    mat.emissiveColor = new Color3(0.9, 0.15, 0.08);
    mat.alpha = 0.35;
    mat.disableLighting = true;
    mat.backFaceCulling = false;
    ring.material = mat;
    ring.isPickable = false;
    ring.setEnabled(false);
    this.telegraph = ring;
  }

  showTelegraph(x, z, radius, k) {
    const r = this.telegraph;
    r.setEnabled(true);
    r.position.set(x, this.game.world.groundAt(x, z) + 0.12, z);
    r.scaling.set(radius * Math.max(0.2, k), radius * Math.max(0.2, k), 1);
    r.material.alpha = 0.2 + k * 0.3;
  }

  hideTelegraph() {
    this.telegraph.setEnabled(false);
  }

  alertNear(src) {
    for (const e of this.list) {
      if (e === src || !e.alive || e.type !== src.type || e.def.boss) continue;
      if (Vector3.DistanceSquared(e.position, src.position) < 12 * 12 && (e.state === 'idle' || e.state === 'wander')) {
        e.target = this.game.player;
        e.setState('chase');
      }
    }
  }

  /** Recoloca inimigos (usado ao carregar o jogo). */
  resetAll() {
    for (const e of this.list) {
      if (e.def.boss && this.game.quests.isDone('rei_esquecido')) {
        e.alive = false; e.char.root.setEnabled(false); e.respawnAt = Infinity; e.state = 'dead'; e.deadTime = 99;
        continue;
      }
      e.respawn();
      if (e.def.boss) { e.dormant = true; e.yaw = Math.PI; }
    }
  }

  update(dt) {
    const p = this.game.player;
    let combat = false;
    for (const e of this.list) {
      const d2 = (e.position.x - p.position.x) ** 2 + (e.position.z - p.position.z) ** 2;
      if (!e.alive) {
        if (e.deadTime < 5) e.update(dt);
        if (this.game.time > e.respawnAt && d2 > 35 * 35) e.respawn();
        continue;
      }
      const near = d2 < this.activeDist * this.activeDist;
      e.setActive(near);
      if (!near) continue;
      e.update(dt);
      if (e.state === 'chase' || e.state === 'attack' || e.state === 'recover') combat = true;
    }
    this.inCombat = combat;
  }
}
