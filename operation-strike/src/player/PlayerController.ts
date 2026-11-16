// Controlador de movimento em primeira pessoa.
// Física "estilo competitivo": aceleração e atrito no chão, pouco controle no ar (permite strafe),
// gravidade, pulo, agachar (inclusive agachar no ar para subir em caixas), andar silencioso,
// subida automática de degraus e detecção de chão/teto contra o mundo de colisão.
import type { CollisionWorld, SurfaceKind, Vec3, Collider } from '../physics/CollisionWorld';
import type { InputState } from '../core/Input';

export const PLAYER = {
  radius: 0.32,
  standHeight: 1.8,
  crouchHeight: 1.2,
  eyeStand: 1.64,
  eyeCrouch: 1.1,
  stepHeight: 0.5,
  runSpeed: 5.6,
  walkSpeed: 2.9,
  /** Velocidade máxima correndo (botão CORRER / Shift), alcançada aos poucos. */
  sprintSpeed: 7.1,
  /** Segundos para atingir a corrida máxima. */
  sprintRamp: 0.7,
  /** Aterrissagem forte reduz a velocidade por um instante. */
  landSlow: 0.55,
  crouchSpeed: 2.0,
  gravity: 19,
  jumpSpeed: 6.4,
  groundAccel: 10,
  airAccel: 1.8,
  airWishCap: 0.9,
  friction: 5.6,
  stopSpeed: 1.6,
  /** Abaixo desta velocidade os passos são silenciosos (andar). */
  quietSpeed: 3.3,
  stepDistance: 2.1
};

export interface ControllerState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  onGround: boolean;
  crouched: boolean;
  sprintT?: number;
}

export interface PlayerEvents {
  onFootstep?: (surface: SurfaceKind, speed: number) => void;
  onJump?: () => void;
  onLand?: (impactSpeed: number, surface: SurfaceKind) => void;
}

const EPS = 0.001;

export class PlayerController {
  /** Posição dos pés (centro da base). */
  readonly position: Vec3 = { x: 0, y: 0, z: 0 };
  readonly velocity: Vec3 = { x: 0, y: 0, z: 0 };
  /** Ângulos de visão (radianos). yaw 0 = olhando para +Z. */
  yaw = 0;
  pitch = 0;

  onGround = false;
  crouched = false;
  walking = false;
  height = PLAYER.standHeight;
  groundSurface: SurfaceKind = 'sand';
  /** Multiplicador de velocidade imposto pela arma (Etapa 2: armas pesadas deixam mais lento). */
  speedMultiplier = 1;
  /** Desligado = personagem parado (menus, morte). */
  enabled = true;

  /** 0..1: quanto da corrida já foi alcançada (aceleração progressiva). */
  sprintT = 0;
  private eyeHeight = PLAYER.eyeStand;
  private stepOffset = 0;
  private stepAccum = 0;
  private fallSpeed = 0;
  private hits: Collider[] = [];

  constructor(private world: CollisionWorld, public events: PlayerEvents = {}) {}

  /** Estado completo (para reconciliação da previsão no cliente online). */
  getState(): ControllerState {
    return {
      x: this.position.x, y: this.position.y, z: this.position.z,
      vx: this.velocity.x, vy: this.velocity.y, vz: this.velocity.z,
      onGround: this.onGround, crouched: this.crouched, sprintT: this.sprintT
    };
  }

  setState(s: ControllerState, smooth = true): void {
    const oldEye = this.eyeY;
    this.position.x = s.x;
    this.position.y = s.y;
    this.position.z = s.z;
    this.velocity.x = s.vx;
    this.velocity.y = s.vy;
    this.velocity.z = s.vz;
    this.onGround = s.onGround;
    this.sprintT = s.sprintT ?? 0;
    if (s.crouched !== this.crouched) {
      this.crouched = s.crouched;
      this.height = s.crouched ? PLAYER.crouchHeight : PLAYER.standHeight;
    }
    if (smooth) this.stepOffset = Math.max(-0.6, Math.min(0.6, this.stepOffset + oldEye - this.eyeY));
  }

  /** Troca o mundo de colisão (mapa reconstruído ou trocado). */
  setWorld(world: CollisionWorld): void {
    this.world = world;
  }

  /** Altura atual dos olhos no mundo (já suavizada). */
  get eyeY(): number {
    return this.position.y + this.eyeHeight + this.stepOffset;
  }

  /** Altura exata dos olhos (sem suavização) usada para os disparos. */
  get eyeExact(): number {
    return this.position.y + (this.crouched ? PLAYER.eyeCrouch : PLAYER.eyeStand);
  }

  get horizontalSpeed(): number {
    return Math.hypot(this.velocity.x, this.velocity.z);
  }

  /** Coloca o jogador em um ponto (nascimento, reaparecimento). */
  teleport(p: Vec3, yaw = 0): void {
    this.position.x = p.x;
    this.position.y = p.y;
    this.position.z = p.z;
    this.velocity.x = this.velocity.y = this.velocity.z = 0;
    this.yaw = yaw;
    this.pitch = 0;
    this.crouched = false;
    this.sprintT = 0;
    this.height = PLAYER.standHeight;
    this.eyeHeight = PLAYER.eyeStand;
    this.stepOffset = 0;
    this.onGround = false;
    this.snapToGround(3);
  }

  /** Aplica a rotação vinda do mouse/toque. */
  look(dYaw: number, dPitch: number): void {
    this.yaw += dYaw;
    if (this.yaw > Math.PI) this.yaw -= Math.PI * 2;
    else if (this.yaw < -Math.PI) this.yaw += Math.PI * 2;
    this.pitch = Math.max(-1.53, Math.min(1.53, this.pitch + dPitch));
  }

  /** Avança a simulação (dt fixo, chamado pelo laço do jogo). */
  update(dt: number, input: InputState, wantCrouch: boolean): void {
    if (!this.enabled) {
      this.velocity.x = this.velocity.z = 0;
      this.applyGravityOnly(dt);
      return;
    }
    this.updateCrouch(wantCrouch);
    this.walking = input.isDown('walk');

    // Direção desejada no plano, relativa ao yaw
    let mx = input.moveX, my = input.moveY;
    const mag = Math.min(1, Math.hypot(mx, my));
    if (mag > 0) {
      const inv = 1 / Math.max(1e-6, Math.hypot(mx, my));
      mx *= inv;
      my *= inv;
    }
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const wishX = mx * cos + my * sin;
    const wishZ = -mx * sin + my * cos;

    // corrida: só para a frente, no chão e em pé; acelera progressivamente e desacelera suave
    const wantSprint = input.isDown('sprint') && !this.crouched && !this.walking && my > 0.5 && mag > 0.5;
    if (wantSprint && this.onGround) this.sprintT = Math.min(1, this.sprintT + dt / PLAYER.sprintRamp);
    else if (!wantSprint) this.sprintT = Math.max(0, this.sprintT - dt * 3);
    const sprintEase = this.sprintT * this.sprintT * (3 - 2 * this.sprintT);
    let maxSpeed = this.crouched ? PLAYER.crouchSpeed : this.walking ? PLAYER.walkSpeed : PLAYER.runSpeed + (PLAYER.sprintSpeed - PLAYER.runSpeed) * sprintEase;
    maxSpeed *= this.speedMultiplier;
    const wishSpeed = maxSpeed * mag;

    if (this.onGround) {
      this.applyFriction(dt);
      this.accelerate(wishX, wishZ, wishSpeed, PLAYER.groundAccel, dt);
      if (input.consume('jump') && !this.blockedAbove(0.3)) {
        this.velocity.y = PLAYER.jumpSpeed;
        this.onGround = false;
        this.events.onJump?.();
      } else {
        this.velocity.y = 0;
      }
    } else {
      input.consume('jump');
      this.accelerate(wishX, wishZ, Math.min(wishSpeed, PLAYER.airWishCap), PLAYER.airAccel, dt, wishSpeed);
      this.velocity.y -= PLAYER.gravity * dt;
      if (this.velocity.y < -40) this.velocity.y = -40;
    }

    const wasGround = this.onGround;
    this.fallSpeed = -this.velocity.y;
    this.moveVertical(this.velocity.y * dt);
    this.moveHorizontal('x', this.velocity.x * dt, wasGround);
    this.moveHorizontal('z', this.velocity.z * dt, wasGround);

    // Saiu de uma borda? Ao descer degraus mantém o contato com o chão em vez de "voar" do degrau
    if (this.onGround && this.velocity.y <= 0 && !this.hasGroundBelow()) {
      this.onGround = false;
      if (wasGround) this.snapToGround(PLAYER.stepHeight);
    }
    if (!this.onGround) this.checkGround();

    // Suavização da câmera (agachar e degraus)
    const targetEye = this.crouched ? PLAYER.eyeCrouch : PLAYER.eyeStand;
    this.eyeHeight += (targetEye - this.eyeHeight) * Math.min(1, dt * 14);
    this.stepOffset *= Math.exp(-dt * 16);
    if (Math.abs(this.stepOffset) < 0.002) this.stepOffset = 0;

    // Passos
    const speed = this.horizontalSpeed;
    if (this.onGround && speed > 0.5) {
      this.stepAccum += speed * dt;
      if (this.stepAccum >= PLAYER.stepDistance) {
        this.stepAccum = 0;
        if (speed > PLAYER.quietSpeed) this.events.onFootstep?.(this.groundSurface, speed);
      }
    } else if (this.onGround) {
      this.stepAccum = PLAYER.stepDistance * 0.6;
    }
  }

  // ---------------------------------------------------------------- física interna

  private applyGravityOnly(dt: number): void {
    if (this.onGround) return;
    this.velocity.y -= PLAYER.gravity * dt;
    this.moveVertical(this.velocity.y * dt);
  }

  private applyFriction(dt: number): void {
    const speed = this.horizontalSpeed;
    if (speed < 0.01) {
      this.velocity.x = this.velocity.z = 0;
      return;
    }
    const drop = Math.max(speed, PLAYER.stopSpeed) * PLAYER.friction * dt;
    const k = Math.max(0, speed - drop) / speed;
    this.velocity.x *= k;
    this.velocity.z *= k;
  }

  /** Aceleração estilo Quake/Source: limita só a componente na direção desejada (permite strafe no ar). */
  private accelerate(dx: number, dz: number, wishSpeed: number, accel: number, dt: number, accelBase = wishSpeed): void {
    if (wishSpeed <= 0) return;
    const current = this.velocity.x * dx + this.velocity.z * dz;
    const add = wishSpeed - current;
    if (add <= 0) return;
    const acc = Math.min(add, accel * Math.max(accelBase, 1) * dt);
    this.velocity.x += dx * acc;
    this.velocity.z += dz * acc;
  }

  private box(px = this.position.x, py = this.position.y, pz = this.position.z, h = this.height): [Vec3, Vec3] {
    const r = PLAYER.radius;
    return [
      { x: px - r, y: py, z: pz - r },
      { x: px + r, y: py + h, z: pz + r }
    ];
  }

  private free(px: number, py: number, pz: number, h = this.height): boolean {
    const [min, max] = this.box(px, py, pz, h);
    return !this.world.overlaps(min, max);
  }

  private blockedAbove(dist: number): boolean {
    return !this.free(this.position.x, this.position.y + dist, this.position.z);
  }

  private moveVertical(dy: number): void {
    if (dy === 0) return;
    // Subpassos contra atravessar plataformas finas em quedas rápidas
    const steps = Math.max(1, Math.ceil(Math.abs(dy) / 0.25));
    const part = dy / steps;
    for (let i = 0; i < steps; i++) {
      const ny = this.position.y + part;
      const [min, max] = this.box(this.position.x, ny, this.position.z);
      const hits = this.world.query(min, max, this.hits);
      if (hits.length === 0) {
        this.position.y = ny;
        if (part < 0) this.onGround = false;
        continue;
      }
      if (part < 0) {
        let top = -Infinity;
        let surf: SurfaceKind = this.groundSurface;
        for (const c of hits) if (c.max.y > top) { top = c.max.y; surf = c.surface; }
        this.position.y = top + EPS;
        if (!this.onGround) this.land(surf);
        this.onGround = true;
        this.groundSurface = surf;
      } else {
        let bottom = Infinity;
        for (const c of hits) bottom = Math.min(bottom, c.min.y);
        this.position.y = bottom - this.height - EPS;
      }
      this.velocity.y = 0;
      return;
    }
  }

  private moveHorizontal(axis: 'x' | 'z', d: number, canStep: boolean): void {
    if (d === 0) return;
    const steps = Math.max(1, Math.ceil(Math.abs(d) / (PLAYER.radius * 0.8)));
    const part = d / steps;
    const r = PLAYER.radius;
    for (let i = 0; i < steps; i++) {
      const nx = axis === 'x' ? this.position.x + part : this.position.x;
      const nz = axis === 'z' ? this.position.z + part : this.position.z;
      const [min, max] = this.box(nx, this.position.y, nz);
      const hits = this.world.query(min, max, this.hits);
      if (hits.length === 0) {
        this.position.x = nx;
        this.position.z = nz;
        continue;
      }
      // Tenta subir degrau: todos os obstáculos são baixos e há espaço acima
      if (canStep || this.onGround) {
        let top = -Infinity;
        let ok = true;
        for (const c of hits) {
          const rise = c.max.y - this.position.y;
          if (rise > PLAYER.stepHeight) { ok = false; break; }
          top = Math.max(top, c.max.y);
        }
        if (ok && this.free(nx, top + EPS, nz)) {
          const rise = top + EPS - this.position.y;
          this.position.x = nx;
          this.position.z = nz;
          this.position.y = top + EPS;
          this.stepOffset -= rise;
          this.onGround = true;
          continue;
        }
      }
      // Bloqueado: encosta na face do obstáculo e zera a velocidade neste eixo
      if (part > 0) {
        let limit = Infinity;
        for (const c of hits) limit = Math.min(limit, (axis === 'x' ? c.min.x : c.min.z) - r - EPS);
        if (axis === 'x') this.position.x = Math.max(this.position.x, Math.min(nx, limit));
        else this.position.z = Math.max(this.position.z, Math.min(nz, limit));
      } else {
        let limit = -Infinity;
        for (const c of hits) limit = Math.max(limit, (axis === 'x' ? c.max.x : c.max.z) + r + EPS);
        if (axis === 'x') this.position.x = Math.min(this.position.x, Math.max(nx, limit));
        else this.position.z = Math.min(this.position.z, Math.max(nz, limit));
      }
      if (axis === 'x') this.velocity.x = 0;
      else this.velocity.z = 0;
      return;
    }
  }

  private hasGroundBelow(): boolean {
    const [min, max] = this.box(this.position.x, this.position.y - 0.04, this.position.z, 0.05);
    return this.world.overlaps(min, max);
  }

  private checkGround(): void {
    if (this.velocity.y > 0) return;
    const [min, max] = this.box(this.position.x, this.position.y - 0.03, this.position.z, 0.05);
    const hits = this.world.query(min, max, this.hits);
    if (hits.length) {
      let top = -Infinity;
      let surf: SurfaceKind = this.groundSurface;
      for (const c of hits) if (c.max.y > top) { top = c.max.y; surf = c.surface; }
      if (top <= this.position.y + EPS * 2) {
        if (!this.onGround) this.land(surf);
        this.onGround = true;
        this.groundSurface = surf;
        this.velocity.y = 0;
      }
    }
  }

  /** Procura chão logo abaixo e encosta nele (descida de degraus, nascimento). */
  private snapToGround(maxDrop: number): void {
    const [min, max] = this.box(this.position.x, this.position.y - maxDrop, this.position.z, maxDrop);
    const hits = this.world.query(min, max, this.hits);
    let top = -Infinity;
    let surf: SurfaceKind = this.groundSurface;
    for (const c of hits) if (c.max.y <= this.position.y + EPS * 2 && c.max.y > top) { top = c.max.y; surf = c.surface; }
    if (top > -Infinity) {
      const drop = this.position.y - (top + EPS);
      this.position.y = top + EPS;
      this.stepOffset += drop;
      this.onGround = true;
      this.groundSurface = surf;
      this.velocity.y = 0;
    }
  }

  private land(surface: SurfaceKind): void {
    if (this.fallSpeed > 2) this.events.onLand?.(this.fallSpeed, surface);
    // aterrissagem: queda alta trava o movimento por um instante (sem "bunny hop" infinito)
    if (this.fallSpeed > 7.5) {
      this.velocity.x *= PLAYER.landSlow;
      this.velocity.z *= PLAYER.landSlow;
      this.sprintT *= 0.4;
    } else if (this.fallSpeed > 4) {
      this.velocity.x *= 0.88;
      this.velocity.z *= 0.88;
    }
  }

  private updateCrouch(want: boolean): void {
    const diff = PLAYER.standHeight - PLAYER.crouchHeight;
    if (want && !this.crouched) {
      this.crouched = true;
      this.height = PLAYER.crouchHeight;
      if (!this.onGround) {
        // No ar, encolhe as pernas: os pés sobem e a cabeça fica onde estava
        this.position.y += diff;
        this.eyeHeight -= diff;
      }
    } else if (!want && this.crouched) {
      const p = this.position;
      if (this.onGround) {
        if (this.free(p.x, p.y, p.z, PLAYER.standHeight)) {
          this.crouched = false;
          this.height = PLAYER.standHeight;
        }
      } else if (this.free(p.x, p.y - diff, p.z, PLAYER.standHeight)) {
        p.y -= diff;
        this.eyeHeight += diff;
        this.crouched = false;
        this.height = PLAYER.standHeight;
      } else if (this.free(p.x, p.y, p.z, PLAYER.standHeight)) {
        this.crouched = false;
        this.height = PLAYER.standHeight;
      }
    }
  }
}
