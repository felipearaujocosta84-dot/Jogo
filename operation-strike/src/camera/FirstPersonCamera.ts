// Câmera em primeira pessoa: segue os olhos do jogador, aplica balanço ao andar,
// impacto de aterrissagem, recuo (kick) e zoom de mira com transição suave.
import { FreeCamera, Vector3, type Scene } from '../core/babylon';
import type { PlayerController } from '../player/PlayerController';

const DEG = Math.PI / 180;

export class FirstPersonCamera {
  readonly camera: FreeCamera;
  /** FOV base em graus (configurações). */
  baseFov = 72;
  /** 1 = sem zoom; < 1 aproxima (mira). */
  private zoom = 1;
  private targetZoom = 1;
  private bobPhase = 0;
  private bobAmount = 0;
  private landDip = 0;
  private landVel = 0;
  private kickPitch = 0;
  private kickYaw = 0;
  private shake = 0;

  constructor(scene: Scene) {
    this.camera = new FreeCamera('fpCamera', new Vector3(0, 1.7, 0), scene);
    this.camera.minZ = 0.05;
    this.camera.maxZ = 200;
    this.camera.inputs.clear(); // a rotação é controlada por nós (mouse + toque)
    this.camera.fovMode = FreeCamera.FOVMODE_VERTICAL_FIXED;
    scene.activeCamera = this.camera;
    this.applyFov();
  }

  setZoom(z: number): void {
    this.targetZoom = z;
  }

  get currentZoom(): number {
    return this.zoom;
  }

  /** Aterrissagem: afunda a câmera proporcionalmente à velocidade da queda. */
  land(impact: number): void {
    this.landVel -= Math.min(2.5, impact * 0.12);
  }

  /** Recuo visual aplicado por cima da mira (graus). */
  kick(pitchDeg: number, yawDeg: number): void {
    this.kickPitch += pitchDeg * DEG;
    this.kickYaw += yawDeg * DEG;
  }

  addShake(amount: number): void {
    this.shake = Math.min(1, this.shake + amount);
  }

  private applyFov(): void {
    // Telas em pé (retrato) ganham FOV maior para não parecer "zoom"
    const engine = this.camera.getEngine();
    const aspect = engine.getRenderWidth() / Math.max(1, engine.getRenderHeight());
    let fov = this.baseFov;
    if (aspect < 1) fov = Math.min(100, fov * 1.25);
    this.camera.fov = fov * DEG * this.zoom;
  }

  update(dt: number, p: PlayerController): void {
    this.zoom += (this.targetZoom - this.zoom) * Math.min(1, dt * 14);
    this.applyFov();

    // Balanço de caminhada (proporcional à velocidade, só no chão)
    const speed = p.onGround ? p.horizontalSpeed : 0;
    const targetBob = Math.min(1, speed / 5.6) * (this.targetZoom < 1 ? 0.3 : 1);
    this.bobAmount += (targetBob - this.bobAmount) * Math.min(1, dt * 8);
    this.bobPhase += dt * (4 + speed * 1.15);

    // Mola da aterrissagem
    this.landVel += (-this.landDip * 90 - this.landVel * 12) * dt;
    this.landDip += this.landVel * dt;

    // Recuperação do recuo visual
    const rec = Math.exp(-dt * 9);
    this.kickPitch *= rec;
    this.kickYaw *= rec;
    this.shake *= Math.exp(-dt * 6);

    const bobY = Math.sin(this.bobPhase * 2) * 0.035 * this.bobAmount;
    const bobX = Math.cos(this.bobPhase) * 0.025 * this.bobAmount;
    const sx = (Math.random() - 0.5) * this.shake * 0.06;
    const sy = (Math.random() - 0.5) * this.shake * 0.06;

    const cos = Math.cos(p.yaw), sin = Math.sin(p.yaw);
    const cam = this.camera;
    cam.position.set(
      p.position.x + cos * bobX,
      p.eyeY + bobY + this.landDip * 0.12,
      p.position.z - sin * bobX
    );
    cam.rotation.set(-(p.pitch + this.kickPitch) + sy, p.yaw + this.kickYaw + sx, Math.sin(this.bobPhase) * 0.004 * this.bobAmount);
  }

  /** Direção para onde a câmera aponta (inclui recuo visual). */
  forward(out = new Vector3()): Vector3 {
    const pitch = -this.camera.rotation.x;
    const yaw = this.camera.rotation.y;
    out.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    return out;
  }

  /** Fase do balanço (a arma acompanha o mesmo ritmo). */
  get bob(): { phase: number; amount: number; dip: number } {
    return { phase: this.bobPhase, amount: this.bobAmount, dip: this.landDip };
  }
}
