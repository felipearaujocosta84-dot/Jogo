// =============================================================
// EXTREME RACING — CameraController
// TERCEIRA PESSOA: atrás do carro, distância ajustável, movimento
//   suave (amortecido), FOV dinâmico e vibração com a velocidade.
// COCKPIT: dentro do carro, volante e painel visíveis, cabeça
//   reage a curvas, frenagens/acelerações e à suspensão.
// Alterna entre as duas durante a corrida.
// =============================================================
import { FreeCamera, Vector3, Quaternion } from '@babylonjs/core';
import { damp, clamp, valueNoise } from '../utils/MathUtils.js';

export class CameraController {
  constructor(scene, preset, settings) {
    this.scene = scene;
    this.settings = settings;
    this.camera = new FreeCamera('raceCam', new Vector3(0, 5, -10), scene);
    this.camera.minZ = 0.08;
    this.camera.maxZ = preset.viewDistance;
    this.camera.fov = 1.0;
    this.camera.inputs.clear(); // controlada pelo jogo
    scene.activeCamera = this.camera;
    this.mode = settings.startCamera === 'cockpit' ? 'cockpit' : 'chase';
    this.target = null;
    this.pos = new Vector3();
    this.look = new Vector3();
    this.head = { x: 0, y: 0, pitch: 0, roll: 0 };
    this.shake = 0;
    this.time = 0;
    this._init = false;
    this.listeners = [];
  }

  setTarget(vehicle) {
    this.target = vehicle;
    this._init = false;
  }

  toggle() {
    this.mode = this.mode === 'chase' ? 'cockpit' : 'chase';
    this._init = false;
    for (const fn of this.listeners) fn(this.mode);
    return this.mode;
  }

  onChange(fn) { this.listeners.push(fn); }

  addImpact(strength) {
    this.shake = Math.min(1.5, this.shake + strength * 0.12);
  }

  update(dt) {
    const v = this.target;
    if (!v || !v.ready) return;
    this.time += dt;
    const ph = v.physics;
    const root = v.root;
    root.computeWorldMatrix(true);
    const wm = root.getWorldMatrix();
    const fwd = Vector3.TransformNormal(new Vector3(0, 0, 1), wm).normalize();
    const speed = ph.speed;
    const speedK = clamp(speed / 80, 0, 1);
    this.shake = Math.max(0, this.shake - dt * 2.2);
    const shakeOn = this.settings.cameraShake !== false;

    if (this.mode === 'chase') {
      // Direção horizontal suavizada (segue a trajetória em derrapagens)
      const flatFwd = new Vector3(fwd.x, 0, fwd.z).normalize();
      const vel = new Vector3(ph.state.vel.x, 0, ph.state.vel.z);
      let dir = flatFwd;
      if (speed > 8 && ph.forwardSpeed > 0) dir = Vector3.Lerp(flatFwd, vel.normalize(), 0.35).normalize();
      const distScale = this.settings.cameraDistance ?? 1;
      const dist = (5.6 + speedK * 1.6) * distScale;
      const height = (1.75 + speedK * 0.25) * Math.sqrt(distScale);
      const p = root.position;
      const desired = new Vector3(p.x - dir.x * dist, p.y + height, p.z - dir.z * dist);
      const lookAt = new Vector3(p.x + dir.x * 4, p.y + 0.9, p.z + dir.z * 4);
      if (!this._init) { this.pos.copyFrom(desired); this.look.copyFrom(lookAt); this._init = true; }
      const kPos = 9 + speedK * 6;
      this.pos.x = damp(this.pos.x, desired.x, kPos, dt);
      this.pos.z = damp(this.pos.z, desired.z, kPos, dt);
      this.pos.y = damp(this.pos.y, desired.y, 7, dt);
      this.look.x = damp(this.look.x, lookAt.x, 16, dt);
      this.look.y = damp(this.look.y, lookAt.y, 10, dt);
      this.look.z = damp(this.look.z, lookAt.z, 16, dt);
      // Não deixa a câmera entrar no chão
      const minY = p.y + 0.6;
      if (this.pos.y < minY) this.pos.y = minY;
      // Vibração com a velocidade e impactos
      let sx = 0, sy = 0;
      if (shakeOn) {
        const amp = speedK * speedK * 0.035 + this.shake * 0.25 + (ph.groundedWheels < 4 ? 0.01 : 0);
        sx = (valueNoise(this.time * 18, 1.3, 3) - 0.5) * amp;
        sy = (valueNoise(this.time * 21, 7.1, 5) - 0.5) * amp;
      }
      this.camera.parent = null;
      this.camera.rotationQuaternion = null;
      this.camera.position.set(this.pos.x + sx, this.pos.y + sy, this.pos.z);
      this.camera.setTarget(this.look);
      this.camera.fov = damp(this.camera.fov, 0.95 + speedK * 0.22, 3, dt);
      this.camera.minZ = 0.2;
    } else {
      // Cockpit: câmera presa à cabeça do piloto
      const eye = v.model.driverEye.clone();
      eye.y -= v.spec.wheelRadius; // modelo deslocado (solo no y = -raio)
      const acc = ph.accelLocal;
      this.head.x = damp(this.head.x, clamp(-acc.x * 0.035, -0.06, 0.06), 6, dt);
      this.head.y = damp(this.head.y, clamp(-acc.y * 0.02, -0.04, 0.04), 8, dt);
      this.head.pitch = damp(this.head.pitch, clamp(acc.z * 0.02, -0.05, 0.05), 5, dt);
      this.head.roll = damp(this.head.roll, clamp(acc.x * 0.025, -0.05, 0.05), 5, dt);
      let vib = 0;
      if (shakeOn) vib = (valueNoise(this.time * 30, 2.2, 9) - 0.5) * (speedK * 0.006 + this.shake * 0.03);
      this.camera.parent = root;
      this.camera.position.set(eye.x + this.head.x, eye.y + this.head.y + vib, eye.z);
      this.camera.rotationQuaternion = Quaternion.RotationYawPitchRoll(-ph.steerAngle * 0.15, 0.06 - this.head.pitch, this.head.roll);
      this.camera.fov = damp(this.camera.fov, 1.05 + speedK * 0.12, 3, dt);
      this.camera.minZ = 0.05;
    }
  }

  dispose() {
    this.camera.dispose();
  }
}
