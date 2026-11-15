// Jogador: movimento arcade (aceleração, giro, corrida com fôlego), colisões e contato com a bola.
// Quem decide para onde ir é o controle humano (MobileControls) ou a IA (PlayerAI) via setInput().
import { Vector3 } from '../babylon.js';
import { FIELD } from '../config.js';
import { createPlayerVisual } from './ModelFactory.js';

export const PLAYER = {
  radius: 0.34,
  height: 1.8,
  walkSpeed: 2.8,
  runSpeed: 5.4,
  sprintSpeed: 7.3,
  keeperSpeedFactor: 0.92,
  accel: 16,
  decel: 20,
  turnRate: 11,             // rad/s
  staminaDrain: 0.22,       // por segundo correndo no sprint
  staminaRegen: 0.14
};

const tmp = new Vector3();

function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export class Player {
  /**
   * @param {object} team Team
   * @param {'gk'|'field'} role
   */
  constructor(team, role, index, look, name) {
    this.team = team;
    this.role = role;
    this.index = index;
    this.look = look;
    this.name = name;
    this.number = look.number;
    this.position = new Vector3();
    this.velocity = new Vector3();
    this.yaw = 0;
    this.input = { dir: new Vector3(), magnitude: 0, sprint: false, faceTarget: null };
    this.stamina = 1;
    this.isHuman = false;
    this.touchCooldown = 0;
    this.actionLock = 0;      // segundos com movimento travado (chute, carrinho, mergulho)
    this.ai = null;
    this.visual = null;
  }

  get isKeeper() {
    return this.role === 'gk';
  }

  async createVisual(scene, shadowGenerator) {
    this.visual = await createPlayerVisual(scene, `p_${this.team.id}_${this.index}`, this.look);
    for (const m of this.visual.meshes) {
      m.isPickable = false;
      if (shadowGenerator) shadowGenerator.addShadowCaster(m, false);
    }
    this.visual.animator.onEvent = (name, phase) => this.onAnimationEvent(name, phase);
    this.syncVisual(0);
  }

  /** Eventos da animação (contato do pé na bola etc.). Sobrescrito pelo sistema de jogo. */
  onAnimationEvent(name, phase) {
    if (this.onAction) this.onAction(this, name, phase);
  }

  placeAt(x, z, yaw = this.team.attackDir > 0 ? Math.PI / 2 : -Math.PI / 2) {
    this.position.set(x, 0, z);
    this.velocity.setAll(0);
    this.yaw = yaw;
    this.actionLock = 0;
    this.syncVisual(0);
  }

  /**
   * @param {Vector3} dir direção desejada no plano XZ (não precisa ser normalizada)
   * @param {number} magnitude 0..1 (quanto do joystick)
   * @param {boolean} sprint
   */
  setInput(dir, magnitude, sprint = false, faceTarget = null) {
    const l = Math.hypot(dir.x, dir.z);
    if (l > 1e-4) this.input.dir.set(dir.x / l, 0, dir.z / l);
    else this.input.dir.setAll(0);
    this.input.magnitude = l > 1e-4 ? Math.max(0, Math.min(1, magnitude)) : 0;
    this.input.sprint = sprint;
    this.input.faceTarget = faceTarget;
  }

  /** Inicia uma ação animada (kick, pass, slide, dive, celebrate…). */
  playAction(name, opts = {}) {
    if (!this.visual) return false;
    const anim = this.visual.animator;
    if (anim.isBusy() && name !== 'celebrate') return false;
    anim.play(name, opts);
    const lock = { kick: 0.32, pass: 0.22, slide: 0.75, dive: 0.95, stumble: 0.8, celebrate: 0 }[name] || 0;
    this.actionLock = Math.max(this.actionLock, lock);
    return true;
  }

  get busy() {
    return this.visual ? this.visual.animator.isBusy() : false;
  }

  get speed() {
    return Math.hypot(this.velocity.x, this.velocity.z);
  }

  get forward() {
    return new Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
  }

  maxSpeed() {
    const inp = this.input;
    const k = this.isKeeper ? PLAYER.keeperSpeedFactor : 1;
    if (inp.magnitude < 0.55) return PLAYER.walkSpeed * Math.max(inp.magnitude / 0.55, 0) * k;
    if (inp.sprint && this.stamina > 0.05) return PLAYER.sprintSpeed * k;
    return PLAYER.runSpeed * k;
  }

  update(dt) {
    this.touchCooldown = Math.max(0, this.touchCooldown - dt);
    const inp = this.input;
    const current = this.visual?.animator.currentAction;

    if (this.actionLock > 0) {
      this.actionLock -= dt;
      // durante o carrinho/mergulho o corpo desliza e perde velocidade
      const fr = current === 'slide' ? 2.8 : current === 'dive' ? 3.5 : 12;
      const k = Math.max(0, 1 - fr * dt);
      this.velocity.x *= k;
      this.velocity.z *= k;
    } else {
      const target = this.maxSpeed();
      const desiredX = inp.dir.x * target;
      const desiredZ = inp.dir.z * target;
      const dx = desiredX - this.velocity.x;
      const dz = desiredZ - this.velocity.z;
      const dl = Math.hypot(dx, dz);
      const rate = (target > this.speed ? PLAYER.accel : PLAYER.decel) * dt;
      if (dl <= rate) {
        this.velocity.x = desiredX;
        this.velocity.z = desiredZ;
      } else {
        this.velocity.x += (dx / dl) * rate;
        this.velocity.z += (dz / dl) * rate;
      }
    }

    // fôlego
    const sprinting = inp.sprint && this.speed > PLAYER.runSpeed * 0.9 && this.actionLock <= 0;
    if (sprinting) this.stamina = Math.max(0, this.stamina - PLAYER.staminaDrain * dt);
    else this.stamina = Math.min(1, this.stamina + PLAYER.staminaRegen * dt * (this.speed < 1 ? 1.6 : 1));

    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;

    // giro suave: para onde anda, ou para o alvo indicado (ex.: bola) quando quase parado
    let desiredYaw = null;
    if (this.actionLock <= 0) {
      if (inp.faceTarget && this.speed < 2.5) {
        desiredYaw = Math.atan2(inp.faceTarget.x - this.position.x, inp.faceTarget.z - this.position.z);
      } else if (this.speed > 0.3) {
        desiredYaw = Math.atan2(this.velocity.x, this.velocity.z);
      } else if (inp.magnitude > 0.05) {
        desiredYaw = Math.atan2(inp.dir.x, inp.dir.z);
      }
    }
    if (desiredYaw !== null) {
      const d = angleDiff(this.yaw, desiredYaw);
      const maxTurn = PLAYER.turnRate * dt * (this.speed > 6 ? 0.7 : 1);
      this.yaw += Math.max(-maxTurn, Math.min(maxTurn, d));
    }

    this.clampToCourt();
    this.syncVisual(dt);
  }

  clampToCourt() {
    const r = PLAYER.radius;
    const hl = FIELD.length / 2 - r * 0.6;
    const hw = FIELD.width / 2 - r;
    const p = this.position;
    // goleiro pode entrar um pouco no gol
    const inMouth = Math.abs(p.z) < FIELD.goalWidth / 2 - r;
    const xLimit = inMouth ? FIELD.length / 2 + FIELD.goalDepth - r : hl;
    if (p.x > xLimit) { p.x = xLimit; this.velocity.x = Math.min(0, this.velocity.x); }
    if (p.x < -xLimit) { p.x = -xLimit; this.velocity.x = Math.max(0, this.velocity.x); }
    // dentro do recuo do gol, respeita as redes laterais
    if (Math.abs(p.x) > hl) {
      const zl = FIELD.goalWidth / 2 - r;
      if (p.z > zl) p.z = zl;
      if (p.z < -zl) p.z = -zl;
    }
    if (p.z > hw) { p.z = hw; this.velocity.z = Math.min(0, this.velocity.z); }
    if (p.z < -hw) { p.z = -hw; this.velocity.z = Math.max(0, this.velocity.z); }
  }

  syncVisual(dt) {
    if (!this.visual) return;
    const root = this.visual.root;
    root.position.set(this.position.x, 0, this.position.z);
    if (root.rotationQuaternion) root.rotationQuaternion = null;
    root.rotation.y = this.yaw + (this.visual.yawOffset || 0);
    if (dt > 0) this.visual.animator.update(dt, this.speed, this.input.sprint && this.speed > PLAYER.runSpeed * 0.9, this.isKeeper);
  }

  distanceTo(p) {
    return Math.hypot(p.x - this.position.x, p.z - this.position.z);
  }

  /**
   * Contato físico com a bola (condução por toque).
   * Pés empurram a bola para frente; corpo rebate. Retorna true se tocou.
   */
  interactBall(ball) {
    const p = this.position, b = ball.position;
    if (ball.freeTimer > 0) return false;
    if (b.y > PLAYER.height + ball.radius) return false;
    const dx = b.x - p.x, dz = b.z - p.z;
    const dist = Math.hypot(dx, dz);
    const reach = PLAYER.radius * (b.y < 0.6 ? 0.85 : 0.75) + ball.radius;
    if (dist >= reach) return false;
    let nx, nz;
    if (dist > 1e-4) { nx = dx / dist; nz = dz / dist; } else { const f = this.forward; nx = f.x; nz = f.z; }
    // tira a bola de dentro do jogador
    b.x = p.x + nx * reach;
    b.z = p.z + nz * reach;
    const v = ball.velocity;
    const relN = (v.x - this.velocity.x) * nx + (v.z - this.velocity.z) * nz;
    if (relN >= 0 && this.touchCooldown > 0) return false;

    if (b.y < 0.7) {
      // toque de pé: conduz a bola um pouco à frente do jogador
      const spd = this.speed;
      const push = 0.9 + spd * 0.3;
      const f = this.forward;
      // mistura direção do contato com a direção do corpo (controle)
      let dirX = nx * 0.45 + f.x * 0.55, dirZ = nz * 0.45 + f.z * 0.55;
      const l = Math.hypot(dirX, dirZ) || 1;
      dirX /= l; dirZ /= l;
      const along = Math.max(spd * 1.08, spd + push * 0.5);
      tmp.set(dirX * along, 0, dirZ * along);
      // bola rápida chegando: amortece (domínio), em vez de colar no pé
      const incoming = -relN;
      if (incoming > 9) {
        v.x = v.x * -0.25 + tmp.x * 0.5;
        v.z = v.z * -0.25 + tmp.z * 0.5;
      } else {
        v.x = tmp.x;
        v.z = tmp.z;
      }
      if (v.y > 0) v.y *= 0.3;
    } else if (relN < 0) {
      // corpo/peito: rebate com pouca energia
      v.x -= (1 + 0.35) * relN * nx;
      v.z -= (1 + 0.35) * relN * nz;
      v.y *= 0.6;
    }
    this.touchCooldown = 0.1;
    ball.lastTouch = this;
    return true;
  }

  /** Separação entre jogadores (empurra os dois). */
  static resolveCollisions(players) {
    const minD = PLAYER.radius * 2;
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        const a = players[i].position, b = players[j].position;
        const dx = b.x - a.x, dz = b.z - a.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < minD * minD && d2 > 1e-8) {
          const d = Math.sqrt(d2);
          const push = (minD - d) / 2;
          const nx = dx / d, nz = dz / d;
          a.x -= nx * push; a.z -= nz * push;
          b.x += nx * push; b.z += nz * push;
        }
      }
    }
  }
}
