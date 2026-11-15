// Câmera estilo transmissão de TV: lateral, elevada, acompanha a bola com suavidade.
// Não gira livremente: só translada ao longo da lateral e ajusta levemente o zoom.
import { UniversalCamera, Vector3, Camera } from '../babylon.js';
import { FIELD } from '../config.js';

export class BroadcastCamera {
  constructor(scene, canvas) {
    this.height = 14.5;          // altura da câmera
    this.distance = 16.5;        // distância atrás da lateral próxima
    this.followX = 0.82;         // quanto a câmera acompanha a bola no comprimento
    this.followZ = 0.45;
    this.damping = 3.2;          // suavização (maior = mais rápida)
    this.baseFov = 1.02;         // FOV horizontal (rad)

    this.camera = new UniversalCamera('broadcast', new Vector3(0, this.height, -FIELD.width / 2 - this.distance), scene);
    this.camera.fovMode = Camera.FOVMODE_HORIZONTAL_FIXED;
    this.camera.fov = this.baseFov;
    this.camera.minZ = 0.5;
    this.camera.maxZ = 600;
    this.camera.inputs.clear(); // sem controle manual de câmera
    scene.activeCamera = this.camera;

    this.focus = new Vector3(0, 0, 0);
    this.lookAt = new Vector3(0, 0, 0);
    this.shake = 0;
    this.zoomBoost = 0; // zoom extra em momentos como gol
    this.updateAspect(canvas);
  }

  /** Ajusta FOV para telas em retrato (mostra mais do campo). */
  updateAspect(canvas) {
    const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
    this.aspectFactor = aspect < 1.2 ? 1.25 : aspect < 1.6 ? 1.08 : 1;
  }

  /** Posiciona a câmera imediatamente (sem suavização). */
  snapTo(target) {
    this.focus.copyFrom(target);
    this.update(0, target, true);
  }

  /**
   * @param {number} dt
   * @param {Vector3} target ponto de interesse (bola ou jogador)
   */
  update(dt, target, instant = false) {
    const hl = FIELD.length / 2;
    const k = instant ? 1 : 1 - Math.exp(-this.damping * dt);
    // foco antecipa um pouco o movimento
    this.focus.x += (target.x - this.focus.x) * k;
    this.focus.z += (target.z - this.focus.z) * k;

    const limitX = hl - 7;
    const camX = Math.max(-limitX, Math.min(limitX, this.focus.x * this.followX));
    // aproxima um pouco quando a bola está do lado de longe
    const depthFactor = (this.focus.z + FIELD.width / 2) / FIELD.width; // 0 perto .. 1 longe
    const zoom = 1 - this.zoomBoost * 0.12;
    const dist = (this.distance - depthFactor * 1.5) * zoom;
    const height = (this.height - depthFactor * 0.8) * zoom;

    const pos = this.camera.position;
    const desired = new Vector3(camX, height, -FIELD.width / 2 - dist);
    if (instant) pos.copyFrom(desired);
    else Vector3.LerpToRef(pos, desired, k, pos);

    this.lookAt.set(
      Math.max(-hl + 4, Math.min(hl - 4, this.focus.x * 0.95)),
      0.5,
      this.focus.z * this.followZ - 1.0
    );
    if (this.shake > 0) {
      const s = this.shake * 0.08;
      this.lookAt.x += (Math.random() - 0.5) * s;
      this.lookAt.y += (Math.random() - 0.5) * s;
      this.shake = Math.max(0, this.shake - dt * 2.5);
    }
    this.camera.setTarget(this.lookAt);
    this.camera.fov = this.baseFov * this.aspectFactor;
    this.zoomBoost = Math.max(0, this.zoomBoost - dt * 0.4);
  }

  addShake(amount) {
    this.shake = Math.min(1.5, this.shake + amount);
  }
}
