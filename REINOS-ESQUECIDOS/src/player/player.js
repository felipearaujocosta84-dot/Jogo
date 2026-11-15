// Jogador: modelo do herói (heroi.glb com esqueleto gerado), atributos e animação procedural.
import { Vector3, Color3 } from '../babylon.js';
import { loadHero, createSword } from './heroRig.js';
import { Movement } from './movement.js';
import { Combat } from './combat.js';
import { xpForLevel } from '../config.js';

const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);

// Poses-chave (Euler x, y, z por articulação). Braços: z abaixa/levanta, y leva para frente/trás.
const READY = {
  armR: [0.1, -0.25, -1.15], foreR: [0, -0.55, 0],
  armL: [0.05, 0.1, 1.2], foreL: [0, 0.35, 0]
};
const ACTIONS = {
  slash1: {
    dur: 0.46, hit: 0.2, frames: [
      [0, READY],
      [0.13, { armR: [-0.1, 1.0, -0.15], foreR: [0, -0.2, 0], spine: [0.05, 0.55, 0], armL: [0, 0.4, 1.1] }],
      [0.24, { armR: [-0.05, -1.35, -0.25], foreR: [0, -0.15, 0], spine: [0.15, -0.55, 0], armL: [0.2, -0.2, 1.2] }],
      [0.46, READY]
    ]
  },
  slash2: {
    dur: 0.46, hit: 0.2, frames: [
      [0, READY],
      [0.12, { armR: [0.1, -1.4, -0.65], foreR: [0, -0.9, 0], spine: [0.05, -0.5, 0] }],
      [0.24, { armR: [-0.1, 0.75, 0.15], foreR: [0, -0.1, 0], spine: [0.1, 0.5, 0] }],
      [0.46, READY]
    ]
  },
  slash3: {
    dur: 0.62, hit: 0.32, frames: [
      [0, READY],
      [0.2, { armR: [0, -0.5, 1.25], foreR: [0, -1.2, 0], spine: [-0.25, 0.1, 0], armL: [0, 0.6, 0.6], head: [-0.15, 0, 0] }],
      [0.33, { armR: [0, -1.2, -0.9], foreR: [0, -0.1, 0], spine: [0.45, -0.1, 0], armL: [0.3, 0.2, 1.2], thighR: [-0.5, 0, 0], shinR: [0.4, 0, 0], thighL: [0.3, 0, 0] }],
      [0.62, READY]
    ]
  },
  spin: {
    dur: 0.75, hit: 0.3, frames: [
      [0, READY],
      [0.12, { armR: [0, 0.6, -0.05], foreR: [0, 0, 0], armL: [0, 0, 0.3], spine: [0.15, 0.5, 0] }],
      [0.6, { armR: [0, -0.2, -0.05], foreR: [0, 0, 0], armL: [0, 0, 0.3], spine: [0.15, 0, 0] }],
      [0.75, READY]
    ]
  },
  dodge: {
    dur: 0.55, frames: [
      [0, { spine: [0.6, 0, 0], head: [0.4, 0, 0], thighR: [-1.6, 0, 0], shinR: [1.8, 0, 0], thighL: [-1.4, 0, 0], shinL: [1.9, 0, 0], armR: [-0.8, -0.4, -0.6], armL: [-0.8, 0.4, 0.6], foreR: [0, -1.4, 0], foreL: [0, 1.4, 0] }],
      [0.55, { spine: [0.6, 0, 0], head: [0.4, 0, 0], thighR: [-1.6, 0, 0], shinR: [1.8, 0, 0], thighL: [-1.4, 0, 0], shinL: [1.9, 0, 0], armR: [-0.8, -0.4, -0.6], armL: [-0.8, 0.4, 0.6], foreR: [0, -1.4, 0], foreL: [0, 1.4, 0] }]
    ]
  },
  hurt: {
    dur: 0.32, frames: [
      [0, {}],
      [0.08, { spine: [-0.3, 0.15, 0], head: [-0.3, 0, 0], armL: [0, 0.3, 0.9] }],
      [0.32, {}]
    ]
  },
  drink: {
    dur: 0.9, frames: [
      [0, READY],
      [0.25, { armL: [0, 1.2, 0.3], foreL: [0, 1.9, 0], head: [-0.35, 0, 0], spine: [-0.1, 0, 0] }],
      [0.7, { armL: [0, 1.2, 0.35], foreL: [0, 1.9, 0], head: [-0.4, 0, 0], spine: [-0.12, 0, 0] }],
      [0.9, READY]
    ]
  },
  interact: {
    dur: 0.6, frames: [
      [0, READY],
      [0.25, { spine: [0.5, 0, 0], head: [0.2, 0, 0], armL: [-0.6, 0.6, 0.9], foreL: [0, 0.4, 0] }],
      [0.6, READY]
    ]
  },
  death: {
    dur: 1.0, frames: [
      [0, {}],
      [0.3, { spine: [0.3, 0.2, 0], head: [0.4, 0, 0], thighR: [-0.9, 0, 0], shinR: [1.6, 0, 0], thighL: [-0.7, 0, 0], shinL: [1.5, 0, 0], armR: [0, 0, -0.6], armL: [0, 0, 0.6] }],
      [1.0, { spine: [0.1, 0.2, 0], head: [0.2, 0.3, 0], thighR: [-0.2, 0, 0], shinR: [0.3, 0, 0], thighL: [-0.1, 0, 0], shinL: [0.2, 0, 0], armR: [0, 0, -0.2], armL: [0, 0, 0.3] }]
    ]
  }
};
export { ACTIONS };

export class Player {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.position = new Vector3(0, 0, 0);
    this.yaw = 0;
    this.radius = 0.42;
    this.level = 1;
    this.xp = 0;
    this.maxHp = 100;
    this.hp = 100;
    this.maxStamina = 100;
    this.stamina = 100;
    this.baseAttack = 6;
    this.dead = false;
    this.phase = 0;
    this.speedNorm = 0;
    this.action = null; // { name, t, def, onHit, hitDone }
    this.flash = 0;
  }

  async load() {
    const hero = await loadHero(this.scene, 'hero');
    this.root = hero.root;
    this.model = hero.model;
    this.mesh = hero.mesh;
    this.nodes = hero.nodes;
    this.game.addShadowCaster(this.mesh);
    this.mesh.receiveShadows = true;
    this.baseColor = this.mesh.material ? this.mesh.material.emissiveColor.clone() : new Color3(0, 0, 0);

    const sword = createSword(this.scene, 'heroSword');
    sword.root.parent = this.nodes.foreR;
    sword.root.position.set(0.24, -0.01, 0.0);
    sword.root.rotation.set(-0.35, 0, 0);
    this.sword = sword;
    for (const p of sword.parts) this.game.addShadowCaster(p);

    this.movement = new Movement(this);
    this.combat = new Combat(this);
  }

  get world() { return this.game.world; }

  // ---------- atributos derivados do equipamento ----------
  get attack() {
    const inv = this.game.inventory;
    return this.baseAttack + this.level * 1.5 + (inv ? inv.weaponAttack() : 0);
  }
  get defense() {
    const inv = this.game.inventory;
    return (inv ? inv.armorDefense() : 0) + Math.floor(this.level / 2);
  }
  get xpNext() { return xpForLevel(this.level); }

  gainXp(amount) {
    this.xp += amount;
    let leveled = false;
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level++;
      this.maxHp += 15;
      this.maxStamina += 5;
      this.baseAttack += 1;
      this.hp = this.maxHp;
      this.stamina = this.maxStamina;
      leveled = true;
    }
    if (leveled) this.game.onLevelUp(this.level);
  }

  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  teleport(x, z, yaw = this.yaw) {
    this.position.set(x, this.world.groundAt(x, z), z);
    this.yaw = yaw;
    this.movement.velocity.set(0, 0, 0);
    this.syncTransform();
  }

  syncTransform() {
    this.root.position.copyFrom(this.position);
    this.root.rotation.y = this.yaw;
  }

  setEquipmentLook(weapon) {
    if (!this.sword) return;
    const c = weapon && weapon.color ? weapon.color : [0.72, 0.74, 0.78];
    this.sword.metal.diffuseColor = new Color3(c[0], c[1], c[2]);
    this.sword.metal.emissiveColor = weapon && weapon.glow ? new Color3(weapon.glow[0], weapon.glow[1], weapon.glow[2]) : new Color3(0, 0, 0);
    const len = weapon && weapon.length ? weapon.length : 1;
    this.sword.blade.scaling.z = len;
    this.sword.blade.position.z = 0.53 * len - 0.53 + 0.0;
  }

  /** Inicia uma ação animada. */
  play(name, opts = {}) {
    const def = ACTIONS[name];
    this.action = { name, t: 0, def, hitDone: false, ...opts };
  }

  update(dt, input) {
    if (!this.root) return;
    this.combat.update(dt, input);
    this.movement.update(dt, input);
    this.animate(dt);
    this.syncTransform();
    if (this.flash > 0) {
      this.flash -= dt;
      if (this.mesh.material) {
        const k = Math.max(0, this.flash / 0.15);
        this.mesh.material.emissiveColor = new Color3(0.6 * k, 0.1 * k, 0.05 * k);
      }
    }
  }

  // ---------------- ANIMAÇÃO PROCEDURAL ----------------
  animate(dt) {
    const N = this.nodes;
    const sp = this.speedNorm; // 0 parado, 1 correndo
    const pose = {};
    const set = (k, x, y, z) => (pose[k] = [x, y, z]);

    // locomoção
    const t = this.game.time;
    const breath = Math.sin(t * 2.2) * 0.025;
    const A = lerp(0.0, 0.75, sp), B = lerp(0.0, 1.1, sp), C = lerp(0.04, 0.55, sp);
    const ph = this.phase;
    const s = Math.sin(ph), c = Math.cos(ph);
    set('thighR', -s * A - 0.04, 0, 0);
    set('thighL', s * A - 0.04, 0, 0);
    set('shinR', Math.max(0, Math.sin(ph + 1.3)) * B + 0.06, 0, 0);
    set('shinL', Math.max(0, Math.sin(ph + 1.3 + Math.PI)) * B + 0.06, 0, 0);
    set('armR', READY.armR[0] + s * C * 0.6, READY.armR[1], READY.armR[2] + breath);
    set('foreR', 0, READY.foreR[1] - sp * 0.3, 0);
    set('armL', -s * C, READY.armL[1], READY.armL[2] - breath);
    set('foreL', 0, READY.foreL[1] + sp * 0.4, 0);
    set('spine', 0.05 + sp * 0.22 + breath * 0.5, -s * 0.12 * sp, 0);
    set('hips', 0, s * 0.1 * sp, 0);
    set('head', -sp * 0.12, 0, 0);
    let bob = -Math.abs(c) * 0.06 * sp + (sp < 0.05 ? breath * 0.3 : 0);
    let modelRotX = 0, modelRotY = 0, modelOffY = 0, modelOffZ = 0;

    // ação (sobrepõe a locomoção)
    const a = this.action;
    if (a) {
      a.t += dt * (a.speed || 1);
      const def = a.def;
      const fr = def.frames;
      let i = 0;
      while (i < fr.length - 2 && a.t > fr[i + 1][0]) i++;
      const [t0, p0] = fr[i];
      const [t1, p1] = fr[Math.min(i + 1, fr.length - 1)];
      const k = t1 > t0 ? ease(Math.max(0, Math.min(1, (a.t - t0) / (t1 - t0)))) : 1;
      // peso de mistura: entra/sai suave
      const fadeIn = Math.min(1, a.t / 0.06);
      const fadeOut = Math.min(1, (def.dur - a.t) / 0.08);
      const w = a.name === 'death' ? 1 : Math.max(0, Math.min(fadeIn, fadeOut, 1));
      const keys = new Set([...Object.keys(p0), ...Object.keys(p1)]);
      for (const key of keys) {
        const v0 = p0[key] || pose[key] || [0, 0, 0];
        const v1 = p1[key] || pose[key] || [0, 0, 0];
        const base = pose[key] || [0, 0, 0];
        pose[key] = [0, 1, 2].map((j) => lerp(base[j], lerp(v0[j], v1[j], k), w));
      }
      if (a.name === 'spin') {
        const st = Math.max(0, Math.min(1, (a.t - 0.12) / 0.48));
        modelRotY = -ease(st) * Math.PI * 2;
      }
      if (a.name === 'dodge') {
        const rt = Math.max(0, Math.min(1, a.t / def.dur));
        const ang = ease(rt) * Math.PI * 2;
        const p = 0.55;
        modelRotX = ang;
        modelOffY = p - p * Math.cos(ang) - 0.35 * Math.sin(rt * Math.PI);
        modelOffZ = -p * Math.sin(ang);
        bob = 0;
      }
      if (a.name === 'death') {
        const rt = Math.min(1, a.t / 0.9);
        modelRotX = -ease(rt) * 1.45;
        modelOffY = -ease(rt) * 0.05;
      }
      if (a.t >= def.dur && a.name !== 'death') this.action = null;
    }

    for (const key in pose) {
      const n = N[key];
      if (!n) continue;
      const v = pose[key];
      n.rotation.set(v[0], v[1], v[2]);
    }
    this.model.position.set(0, bob + modelOffY, modelOffZ);
    this.model.rotation.set(modelRotX, modelRotY, 0);
  }
}
