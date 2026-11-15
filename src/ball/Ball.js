// Bola com física arcade própria (sem engine de física externa: leve e previsível no celular).
import { MeshBuilder, StandardMaterial, Color3, Vector3, Quaternion } from '../babylon.js';
import { BALL, PHYSICS } from '../config.js';
import { createBallTexture } from '../stadium/textures.js';

const tmpAxis = new Vector3();
const tmpQ = new Quaternion();
const UP = new Vector3(0, 1, 0);

export class Ball {
  constructor(scene, shadowGenerator) {
    this.radius = BALL.radius;
    this.position = new Vector3(0, this.radius, 0);
    this.velocity = new Vector3();
    this.spin = new Vector3();      // efeito (curva) aplicado no ar
    this.onGround = true;
    this.owner = null;              // jogador com a posse (usado a partir da Etapa 3)
    this.lastTouch = null;
    this.listeners = {};
    this.lastStep = 1 / 60;

    const mesh = MeshBuilder.CreateSphere('ball', { diameter: this.radius * 2, segments: 16 }, scene);
    const m = new StandardMaterial('ballMat', scene);
    m.diffuseTexture = createBallTexture(scene);
    m.specularColor = new Color3(0.35, 0.35, 0.35);
    m.specularPower = 40;
    m.emissiveColor = new Color3(0.12, 0.12, 0.12);
    mesh.material = m;
    mesh.rotationQuaternion = Quaternion.Identity();
    mesh.isPickable = false;
    this.mesh = mesh;
    if (shadowGenerator) shadowGenerator.addShadowCaster(mesh);

    // sombra de contato barata (ajuda a ler a altura da bola)
    const blob = MeshBuilder.CreateDisc('ballBlob', { radius: this.radius * 1.3, tessellation: 16 }, scene);
    blob.rotation.x = Math.PI / 2;
    const bm = new StandardMaterial('ballBlobMat', scene);
    bm.diffuseColor = Color3.Black();
    bm.specularColor = Color3.Black();
    bm.disableLighting = true;
    bm.alpha = 0.35;
    blob.material = bm;
    blob.isPickable = false;
    this.blob = blob;
    this.syncMesh();
  }

  on(event, fn) {
    (this.listeners[event] ||= []).push(fn);
  }

  emit(event, data) {
    const list = this.listeners[event];
    if (list) for (const fn of list) fn(data);
  }

  /** Recoloca a bola parada em um ponto. */
  reset(x = 0, z = 0, y = this.radius) {
    this.position.set(x, y, z);
    this.velocity.setAll(0);
    this.spin.setAll(0);
    this.owner = null;
    this.syncMesh();
  }

  /**
   * Chute/passe: velocidade inicial na direção (x,z) com elevação.
   * @param {Vector3} dirXZ direção horizontal (será normalizada)
   * @param {number} power velocidade horizontal (m/s)
   * @param {number} lift velocidade vertical (m/s)
   * @param {number} curve efeito lateral (-1..1)
   */
  kick(dirXZ, power, lift = 0, curve = 0, kicker = null) {
    const d = new Vector3(dirXZ.x, 0, dirXZ.z);
    if (d.lengthSquared() < 1e-6) return;
    d.normalize();
    power = Math.min(power, BALL.maxSpeed);
    this.velocity.set(d.x * power, lift, d.z * power);
    // curva: força perpendicular à direção enquanto estiver no ar
    this.spin.set(-d.z * curve, 0, d.x * curve);
    this.owner = null;
    this.lastTouch = kicker;
    this.emit('kick', { power, lift, position: this.position.clone(), kicker });
  }

  /**
   * Passo de simulação com subpassos para evitar atravessar traves/paredes em chutes fortes.
   * @param {number} dt
   * @param {{resolveBallCollisions:Function}} arena
   */
  step(dt, arena) {
    const speed = this.velocity.length();
    const sub = Math.min(8, Math.max(1, Math.ceil((speed * dt) / (this.radius * 0.6))));
    const h = dt / sub;
    for (let i = 0; i < sub; i++) this.integrate(h, arena);
    this.syncMesh(dt);
  }

  integrate(h, arena) {
    this.lastStep = h;
    const p = this.position, v = this.velocity;
    const r = this.radius;
    this.onGround = p.y <= r + 0.005 && Math.abs(v.y) < 0.6;

    if (!this.onGround) {
      v.y -= PHYSICS.gravity * h;
      // arrasto do ar
      const drag = 1 - BALL.airDrag * h;
      v.x *= drag; v.z *= drag;
      // efeito (curva)
      v.x += this.spin.x * h * 6;
      v.z += this.spin.z * h * 6;
      this.spin.scaleInPlace(1 - 0.6 * h);
    } else {
      v.y = 0;
      p.y = r;
      // atrito de rolagem (desaceleração constante + leve viscosidade)
      const hs = Math.hypot(v.x, v.z);
      if (hs > 0) {
        const dec = (BALL.rollingFriction + hs * 0.08) * h;
        const ns = Math.max(0, hs - dec);
        const k = ns / hs;
        v.x *= k; v.z *= k;
      }
      this.spin.setAll(0);
      if (hs < BALL.restVelocity) { v.x = 0; v.z = 0; }
    }

    p.x += v.x * h;
    p.y += v.y * h;
    p.z += v.z * h;

    // quique no chão
    if (p.y < r) {
      p.y = r;
      if (v.y < 0) {
        const impact = -v.y;
        if (impact > 1.2) {
          v.y = impact * BALL.groundRestitution;
          v.x *= 0.9; v.z *= 0.9;
          if (impact > 2.5) this.emit('bounce', { strength: impact });
        } else {
          v.y = 0;
        }
      }
    }

    if (arena) {
      const events = arena.resolveBallCollisions(this);
      for (const e of events) this.emit(e.type, e);
    }
  }

  syncMesh(dt = 0) {
    this.mesh.position.copyFrom(this.position);
    // rotação de rolagem: eixo = up x velocidade
    if (dt > 0) {
      const hs = Math.hypot(this.velocity.x, this.velocity.z);
      if (hs > 0.01) {
        Vector3.CrossToRef(UP, this.velocity, tmpAxis);
        tmpAxis.y = 0;
        tmpAxis.normalize();
        Quaternion.RotationAxisToRef(tmpAxis, (hs * dt) / this.radius, tmpQ);
        tmpQ.multiplyToRef(this.mesh.rotationQuaternion, this.mesh.rotationQuaternion);
      }
    }
    // sombra de contato
    const height = Math.max(0, this.position.y - this.radius);
    this.blob.position.set(this.position.x, 0.012, this.position.z);
    const s = 1 + height * 0.25;
    this.blob.scaling.set(s, s, s);
    this.blob.material.alpha = Math.max(0.05, 0.4 - height * 0.08);
  }

  get speed() {
    return this.velocity.length();
  }
}
