// Lógica das armas do jogador: munição, cadência, disparo por raycast com dispersão,
// recuo, recarga, troca, mira e inspeção. A parte visual fica no ViewModel.
// Na Etapa 2 este módulo recebe o arsenal completo, dano por região do corpo e acerto em jogadores.
import { Vector3 } from '../core/babylon';
import type { InputState } from '../core/Input';
import type { CollisionWorld, RayHit } from '../physics/CollisionWorld';
import type { PlayerController } from '../player/PlayerController';
import type { FirstPersonCamera } from '../camera/FirstPersonCamera';
import type { ViewModel } from './ViewModel';
import type { ImpactEffects } from '../combat/ImpactEffects';
import type { AudioManager } from '../audio/AudioManager';
import { TRAINING_PISTOL, TRAINING_RIFLE, type WeaponDef } from './WeaponTypes';

const DEG = Math.PI / 180;

interface WeaponInstance {
  def: WeaponDef;
  ammo: number;
  reserve: number;
}

export interface WeaponContext {
  player: PlayerController;
  camera: FirstPersonCamera;
  world: CollisionWorld;
  effects: ImpactEffects;
  audio: AudioManager;
  view: ViewModel;
}

export class WeaponSystem {
  private inventory: WeaponInstance[];
  private index = 0;
  private cooldown = 0;
  private reloadTimer = 0;
  private drawTimer = 0;
  private sprayCount = 0;
  private sprayTimer = 0;
  aiming = false;
  /** Disparos efetuados e acertos no cenário (estatística do treino). */
  shotsFired = 0;
  lastHit: RayHit | null = null;

  constructor(private ctx: WeaponContext) {
    this.inventory = [
      { def: TRAINING_RIFLE, ammo: TRAINING_RIFLE.magazine, reserve: TRAINING_RIFLE.reserve },
      { def: TRAINING_PISTOL, ammo: TRAINING_PISTOL.magazine, reserve: TRAINING_PISTOL.reserve }
    ];
    this.drawTimer = TRAINING_RIFLE.drawTime;
    ctx.view.switchTo('rifle', TRAINING_RIFLE.drawTime);
  }

  get current(): WeaponInstance {
    return this.inventory[this.index];
  }

  get reloading(): boolean {
    return this.reloadTimer > 0;
  }

  /** Repõe toda a munição (reaparecer). */
  refill(): void {
    for (const w of this.inventory) {
      w.ammo = w.def.magazine;
      w.reserve = w.def.reserve;
    }
    this.reloadTimer = 0;
  }

  /** Dispersão atual em graus (também usada pela mira dinâmica do HUD). */
  get spread(): number {
    const p = this.ctx.player;
    const d = this.current.def;
    let s: number;
    if (!p.onGround) s = d.spreadAir;
    else {
      const k = Math.min(1, Math.max(0, (p.horizontalSpeed - 0.8) / 4.8));
      s = d.spreadStand + (d.spreadMove - d.spreadStand) * k;
    }
    if (p.crouched) s *= 0.7;
    if (this.aiming) s *= 0.5;
    s += Math.min(this.sprayCount, 12) * 0.12;
    return s;
  }

  update(dt: number, input: InputState): void {
    const { view, player } = this.ctx;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.drawTimer = Math.max(0, this.drawTimer - dt);
    this.sprayTimer -= dt;
    if (this.sprayTimer <= 0) this.sprayCount = Math.max(0, this.sprayCount - dt * 20);

    // Troca de arma
    let target = -1;
    if (input.consume('switch')) target = (this.index + 1) % this.inventory.length;
    if (input.consume('slot1')) target = 0;
    if (input.consume('slot2')) target = 1;
    if (target >= 0 && target !== this.index) this.switchTo(target);

    // Recarga
    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) this.finishReload();
    }
    if (input.consume('reload')) this.startReload();
    if (input.consume('inspect') && !this.reloading && this.drawTimer <= 0) view.inspect();

    // Mira
    const def = this.current.def;
    this.aiming = input.isDown('aim') && !this.reloading && this.drawTimer <= 0;
    this.ctx.camera.setZoom(this.aiming ? def.aimZoom : 1);
    player.speedMultiplier = def.moveSpeed * (this.aiming ? 0.7 : 1);

    // Disparo
    const wants = def.automatic ? input.isDown('fire') : input.consume('fire');
    if (wants) this.tryFire();
  }

  private switchTo(i: number): void {
    this.index = i;
    this.reloadTimer = 0;
    this.sprayCount = 0;
    const def = this.current.def;
    this.drawTimer = 0.18 + def.drawTime;
    this.ctx.view.switchTo(def.model, def.drawTime);
    this.ctx.audio.play('draw');
  }

  private startReload(): void {
    const w = this.current;
    if (this.reloading || this.drawTimer > 0 || w.ammo >= w.def.magazine || w.reserve <= 0) return;
    this.reloadTimer = w.def.reloadTime;
    this.ctx.view.reload(w.def.reloadTime);
    this.ctx.audio.reload(w.def.reloadTime);
  }

  private finishReload(): void {
    const w = this.current;
    const need = w.def.magazine - w.ammo;
    const take = Math.min(need, w.reserve);
    w.ammo += take;
    w.reserve -= take;
    this.reloadTimer = 0;
  }

  private tryFire(): void {
    const w = this.current;
    if (this.cooldown > 0 || this.reloading || this.drawTimer > 0) return;
    if (w.ammo <= 0) {
      this.cooldown = 0.25;
      this.ctx.audio.play('dry');
      this.startReload();
      return;
    }
    const { camera, world, effects, view, audio } = this.ctx;
    w.ammo--;
    this.shotsFired++;
    this.cooldown = 1 / w.def.fireRate;

    // Direção com dispersão aleatória dentro de um cone
    const fwd = camera.forward();
    const spread = this.spread * DEG;
    const r = Math.sqrt(Math.random()) * spread;
    const a = Math.random() * Math.PI * 2;
    const up = Math.abs(fwd.y) > 0.99 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0);
    const right = Vector3.Cross(up, fwd).normalize();
    const realUp = Vector3.Cross(fwd, right).normalize();
    const dir = fwd
      .add(right.scale(Math.cos(a) * Math.tan(r)))
      .add(realUp.scale(Math.sin(a) * Math.tan(r)))
      .normalize();

    const origin = camera.camera.position;
    const hit = world.raycast(origin, dir, w.def.range);
    this.lastHit = hit;
    if (hit) effects.spawn(hit.point, hit.normal, hit.collider.surface);

    // Recuo: sobe a mira com leve desvio lateral crescente no spray
    this.sprayCount++;
    this.sprayTimer = 0.25;
    const side = (Math.random() - 0.5) * w.def.recoil * (this.sprayCount > 4 ? 0.9 : 0.35);
    camera.kick(w.def.recoil * (this.aiming ? 0.7 : 1), side);
    view.fire();
    audio.shot(w.def.model);
  }
}
