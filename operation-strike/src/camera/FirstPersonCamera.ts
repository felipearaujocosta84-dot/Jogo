// Câmera: primeira pessoa (balanço ao andar, aterrissagem, recuo, zoom de mira/luneta)
// e câmera de espectador (terceira pessoa atrás do jogador observado, sem atravessar paredes).
import { FreeCamera, Vector3, type Scene } from '../core/babylon';
import type { CollisionWorld } from '../physics/CollisionWorld';

const DEG = Math.PI / 180;

export class FirstPersonCamera {
  readonly camera: FreeCamera;
  baseFov = 72;
  private zoom = 1;
  private targetZoom = 1;
  private bobPhase = 0;
  private bobAmount = 0;
  private landDip = 0;
  private landVel = 0;
  private shake = 0;
  private specPos: Vector3 | null = null;

  constructor(scene: Scene) {
    this.camera = new FreeCamera('fpCamera', new Vector3(0, 1.7, 0), scene);
    this.camera.minZ = 0.05;
    this.camera.maxZ = 200;
    this.camera.inputs.clear();
    this.camera.fovMode = FreeCamera.FOVMODE_VERTICAL_FIXED;
    scene.activeCamera = this.camera;
  }

  setZoom(z: number, instant = false): void {
    this.targetZoom = z;
    if (instant) this.zoom = z;
  }

  get currentZoom(): number {
    return this.zoom;
  }

  land(impact: number): void {
    this.landVel -= Math.min(2.5, impact * 0.12);
  }

  addShake(amount: number): void {
    this.shake = Math.min(1.5, this.shake + amount);
  }

  private applyFov(): void {
    const engine = this.camera.getEngine();
    const aspect = engine.getRenderWidth() / Math.max(1, engine.getRenderHeight());
    let fov = this.baseFov;
    if (aspect < 1) fov = Math.min(100, fov * 1.25);
    this.camera.fov = fov * DEG * this.zoom;
  }

  private common(dt: number): { sx: number; sy: number } {
    this.zoom += (this.targetZoom - this.zoom) * Math.min(1, dt * 16);
    this.applyFov();
    this.landVel += (-this.landDip * 90 - this.landVel * 12) * dt;
    this.landDip += this.landVel * dt;
    this.shake *= Math.exp(-dt * 5);
    return { sx: (Math.random() - 0.5) * this.shake * 0.05, sy: (Math.random() - 0.5) * this.shake * 0.05 };
  }

  /** Primeira pessoa: eye = posição dos olhos; yaw/pitch já incluem o recuo. */
  update(dt: number, eye: { x: number; y: number; z: number }, yaw: number, pitch: number, speed: number, onGround: boolean): void {
    this.specPos = null;
    const { sx, sy } = this.common(dt);
    const sp = onGround ? speed : 0;
    const targetBob = Math.min(1, sp / 5.6) * (this.targetZoom < 0.95 ? 0.3 : 1);
    this.bobAmount += (targetBob - this.bobAmount) * Math.min(1, dt * 8);
    this.bobPhase += dt * (4 + sp * 1.15);
    const bobY = Math.sin(this.bobPhase * 2) * 0.03 * this.bobAmount;
    const bobX = Math.cos(this.bobPhase) * 0.02 * this.bobAmount;
    const cos = Math.cos(yaw), sin = Math.sin(yaw);
    this.camera.position.set(eye.x + cos * bobX, eye.y + bobY + this.landDip * 0.12, eye.z - sin * bobX);
    this.camera.rotation.set(-pitch + sy, yaw + sx, Math.sin(this.bobPhase) * 0.004 * this.bobAmount);
  }

  /** Espectador: atrás e acima do jogador observado. */
  spectate(dt: number, target: { x: number; y: number; z: number }, yaw: number, pitch: number, world: CollisionWorld): void {
    const { sx, sy } = this.common(dt);
    this.setZoom(1);
    const eye = new Vector3(target.x, target.y + 1.6, target.z);
    const back = new Vector3(-Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch) + 0.25, -Math.cos(yaw) * Math.cos(pitch)).normalize();
    let dist = 2.8;
    const hit = world.raycast(eye, back, dist, false);
    if (hit) dist = Math.max(0.3, hit.distance - 0.25);
    const want = eye.add(back.scale(dist));
    this.specPos = this.specPos ? Vector3.Lerp(this.specPos, want, Math.min(1, dt * 12)) : want;
    this.camera.position.copyFrom(want);
    this.camera.setTarget(eye.add(new Vector3(Math.sin(yaw), Math.sin(pitch) * 0.5, Math.cos(yaw))));
    this.camera.rotation.x += sy;
    this.camera.rotation.y += sx;
  }

  get bob(): { phase: number; amount: number; dip: number } {
    return { phase: this.bobPhase, amount: this.bobAmount, dip: this.landDip };
  }
}
