// Câmera 3D isométrica inclinada: segue o jogador com suavização, ângulo fixo de visão diagonal,
// zoom por pinça/roda, giro por arrasto (dedo no lado direito livre / botão direito do mouse) ou Q/E,
// tremor de impacto e proteção contra entrar no terreno.
import { ArcRotateCamera, Vector3 } from '../babylon.js';

export class IsometricCamera {
  constructor(game) {
    this.game = game;
    const scene = game.scene;
    this.alpha = -Math.PI * 0.75;
    this.beta = 0.93;
    this.radius = 14;
    this.targetRadius = 14;
    this.minRadius = 9;
    this.maxRadius = 26;
    this.target = new Vector3(0, 0, 0);
    this.shakeAmt = 0;
    this.cam = new ArcRotateCamera('isoCam', this.alpha, this.beta, this.radius, this.target.clone(), scene);
    this.cam.inputs.clear(); // controlamos tudo manualmente (não conflita com o joystick)
    this.cam.fov = 0.8;
    this.cam.minZ = 0.5;
    this.cam.maxZ = 400;
    this.targetAlpha = this.alpha;
    this.betaAdjust = 0;
  }

  /** Vetor "para frente" da câmera no plano do chão. */
  forwardFlat() {
    const x = -Math.cos(this.alpha), z = -Math.sin(this.alpha);
    const l = Math.hypot(x, z) || 1;
    return { x: x / l, z: z / l };
  }

  rotate(delta) { this.targetAlpha += delta; }
  zoom(delta) { this.targetRadius = Math.max(this.minRadius, Math.min(this.maxRadius, this.targetRadius + delta)); }
  shake(a) { this.shakeAmt = Math.min(0.8, Math.max(this.shakeAmt, a)); }

  snapTo(pos) {
    this.target.set(pos.x, pos.y + 1.2, pos.z);
    this.update(0);
  }

  update(dt) {
    const p = this.game.player.position;
    const k = dt ? Math.min(1, dt * 6) : 1;
    // olha um pouco à frente na direção do movimento
    const v = this.game.player.movement ? this.game.player.movement.velocity : { x: 0, z: 0 };
    const lookX = p.x + v.x * 0.18, lookZ = p.z + v.z * 0.18;
    this.target.x += (lookX - this.target.x) * k;
    this.target.y += (p.y + 1.2 - this.target.y) * k;
    this.target.z += (lookZ - this.target.z) * k;
    this.alpha += (this.targetAlpha - this.alpha) * (dt ? Math.min(1, dt * 8) : 1);
    this.radius += (this.targetRadius - this.radius) * (dt ? Math.min(1, dt * 6) : 1);

    // evita que a câmera fique abaixo do terreno (deixa mais "de cima")
    const w = this.game.world;
    let beta = this.beta;
    for (let i = 0; i < 6; i++) {
      const cx = this.target.x + this.radius * Math.cos(this.alpha) * Math.sin(beta);
      const cz = this.target.z + this.radius * Math.sin(this.alpha) * Math.sin(beta);
      const cy = this.target.y + this.radius * Math.cos(beta);
      if (cy < w.groundAt(cx, cz) + 2) beta -= 0.06; else break;
    }
    this.betaAdjust += (beta - this.beta - this.betaAdjust) * (dt ? Math.min(1, dt * 4) : 1);

    const c = this.cam;
    c.alpha = this.alpha;
    c.beta = this.beta + this.betaAdjust;
    c.radius = this.radius;
    let sx = 0, sy = 0, sz = 0;
    if (this.shakeAmt > 0.001) {
      const s = this.shakeAmt;
      sx = (Math.random() - 0.5) * s; sy = (Math.random() - 0.5) * s; sz = (Math.random() - 0.5) * s;
      this.shakeAmt *= Math.pow(0.002, dt || 0.016);
    }
    c.target.set(this.target.x + sx, this.target.y + sy, this.target.z + sz);
  }
}
