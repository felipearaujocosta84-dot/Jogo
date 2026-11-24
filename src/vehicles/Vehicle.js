// =============================================================
// EXTREME RACING — Vehicle
// Liga a física automotiva (VehiclePhysics) ao Havok e ao modelo
// 3D: cria o corpo rígido do chassi, implementa o adapter (estado,
// raycast das rodas, impulsos), sincroniza rodas/volante/lanternas,
// faróis, efeitos de fumaça/poeira e respawn seguro.
// =============================================================
import {
  TransformNode, Vector3, Quaternion, PhysicsBody, PhysicsMotionType, PhysicsShapeBox,
  PhysicsRaycastResult, SpotLight, Color3,
} from '@babylonjs/core';
import { VehiclePhysics } from './VehiclePhysics.js';
import { createCarMaterials, loadCarModel, drawDash } from './CarModelFactory.js';
import { VehicleEffects } from './VehicleEffects.js';
import { GROUP, WHEEL_RAY_MASK } from '../core/PhysicsGroups.js';
import { rotate, v3, quatFromYaw } from '../utils/MathUtils.js';

let VEHICLE_ID = 0;

export class Vehicle {
  /**
   * @param {Scene} scene
   * @param {object} spec especificação com upgrades aplicados
   * @param {object} opts { name, isPlayer, colors, finish, track, transmission, abs, tc, stability, graphics }
   */
  constructor(scene, spec, opts = {}) {
    this.id = `car${VEHICLE_ID++}`;
    this.scene = scene;
    this.spec = spec;
    this.name = opts.name ?? spec.name;
    this.isPlayer = !!opts.isPlayer;
    this.track = opts.track ?? null;
    this.opts = opts;
    this.trackHint = -1;
    this.input = { throttle: 0, brake: 0, steer: 0, handbrake: 0 };
    this._rayResult = new PhysicsRaycastResult();
    this._tmpV = new Vector3();
    this._tmpA = new Vector3();
    this._pendingTeleport = false;
    this.ready = false;
  }

  /** Cria modelo, corpo físico e efeitos. Posição inicial no mundo. */
  async init(position, heading) {
    const scene = this.scene;
    const spec = this.spec;
    this.root = new TransformNode(`${this.id}_body`, scene);
    this.root.position.set(position.x, position.y, position.z);
    const q = quatFromYaw(heading);
    this.root.rotationQuaternion = new Quaternion(q.x, q.y, q.z, q.w);

    // Modelo (GLB licenciado ou procedural)
    this.materials = createCarMaterials(scene, this.opts.colors ?? spec.colors, this.opts.finish ?? 'metallic');
    // Adversários no gráfico Baixo usam o modelo procedural (leve)
    const lowGfx = this.opts.graphics?.key === 'low';
    const modelSpec = { ...spec, rimStyle: this.opts.rimStyle ?? 0, ...(lowGfx && !this.isPlayer ? { model: null } : {}) };
    this.model = await loadCarModel(scene, modelSpec, this.materials, { detail: this.isPlayer ? 'full' : 'lite' });
    this.materials = this.model.materials; // GLB: materiais do próprio modelo
    this.model.root.parent = this.root;
    this.model.root.position.y = -spec.wheelRadius;

    // Física automotiva
    this.physics = new VehiclePhysics(spec, this._makeAdapter(), {
      transmission: this.opts.transmission ?? 'auto',
      abs: this.opts.abs ?? true,
      tc: this.opts.tc ?? true,
      stability: this.opts.stability ?? false,
    });

    // Corpo rígido do chassi (Havok)
    const c = spec.collider;
    this.body = new PhysicsBody(this.root, PhysicsMotionType.DYNAMIC, false, scene);
    const shape = new PhysicsShapeBox(new Vector3(0, c.centerY, 0), Quaternion.Identity(), new Vector3(c.width, c.height, c.length), scene);
    shape.material = { friction: 0.25, restitution: 0.08 };
    shape.filterMembershipMask = GROUP.CAR;
    shape.filterCollideMask = GROUP.DRIVABLE | GROUP.BARRIER | GROUP.CAR | GROUP.PROP;
    this.body.shape = shape;
    const com = this.physics.comLocal;
    const I = VehiclePhysics.inertiaFor(spec);
    this.body.setMassProperties({
      mass: spec.mass,
      centerOfMass: new Vector3(com.x, com.y, com.z),
      inertia: new Vector3(I.x, I.y, I.z),
      inertiaOrientation: Quaternion.Identity(),
    });
    this.body.setLinearDamping(0.0);
    this.body.setAngularDamping(0.25);

    // Faróis (luz real somente no carro do jogador, por desempenho)
    if (this.isPlayer) {
      this.headLight = new SpotLight(`${this.id}_headlight`, new Vector3(0, 0.25, spec.dims.length / 2 - 0.2), new Vector3(0, -0.12, 1), Math.PI / 3, 6, scene);
      this.headLight.parent = this.root;
      this.headLight.diffuse = new Color3(1, 0.96, 0.88);
      this.headLight.specular = new Color3(0.6, 0.6, 0.6);
      this.headLight.range = 120;
      this.headLight.intensity = 0;
    }

    this.effects = new VehicleEffects(scene, this, this.opts.graphics);
    this.ready = true;
    this._dashTimer = 0;
  }

  _makeAdapter() {
    const self = this;
    return {
      getState(out) {
        const n = self.root;
        const p = n.position, q = n.rotationQuaternion;
        out.pos = v3(p.x, p.y, p.z);
        out.rot = { x: q.x, y: q.y, z: q.z, w: q.w };
        self.body.getLinearVelocityToRef(self._tmpV);
        self.body.getAngularVelocityToRef(self._tmpA);
        out.vel = v3(self._tmpV.x, self._tmpV.y, self._tmpV.z);
        out.angVel = v3(self._tmpA.x, self._tmpA.y, self._tmpA.z);
        const c = rotate(self.physics.comLocal, out.rot);
        out.com = v3(p.x + c.x, p.y + c.y, p.z + c.z);
      },
      raycast(from, to) {
        const engine = self.scene.getPhysicsEngine();
        const res = self._rayResult;
        let start = new Vector3(from.x, from.y, from.z);
        const end = new Vector3(to.x, to.y, to.z);
        // Até 2 tentativas: ignora o próprio chassi caso o filtro não seja suportado
        for (let attempt = 0; attempt < 2; attempt++) {
          res.reset(start, end);
          engine.raycastToRef(start, end, res, { collideWith: WHEEL_RAY_MASK });
          if (!res.hasHit) return null;
          if (res.body && res.body === self.body) {
            start = res.hitPointWorld.add(end.subtract(start).normalize().scale(0.02));
            continue;
          }
          const hp = res.hitPointWorld, hn = res.hitNormalWorld;
          const distance = Math.sqrt((hp.x - from.x) ** 2 + (hp.y - from.y) ** 2 + (hp.z - from.z) ** 2);
          let nx = hn.x, ny = hn.y, nz = hn.z;
          if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }
          return { distance, point: v3(hp.x, hp.y, hp.z), normal: v3(nx, ny, nz) };
        }
        return null;
      },
      applyImpulse(J, p) {
        self.body.applyImpulse(new Vector3(J.x, J.y, J.z), new Vector3(p.x, p.y, p.z));
      },
      surfaceAt(p) {
        if (!self.track) return null;
        const pr = self.track.project(p, self.trackHint);
        return self.track.surfaceAtLateral(pr.lateral);
      },
    };
  }

  /** Passo físico fixo. */
  fixedUpdate(dt, input) {
    if (!this.ready) return;
    if (this._pendingTeleport) return; // aguarda o Havok aplicar o teleporte
    this.input = input;
    if (this.track) {
      const pr = this.track.project(this.root.position, this.trackHint);
      this.trackHint = pr.index;
      this.trackProjection = pr;
    }
    this.physics.step(dt, input);
  }

  /** Atualização visual por quadro. */
  update(dt, { isNight = false, cockpit = false } = {}) {
    if (!this.ready) return;
    const ph = this.physics;
    const names = ['FL', 'FR', 'RL', 'RR'];
    for (let i = 0; i < 4; i++) {
      const w = ph.wheels[i];
      const vis = this.model.wheels[names[i]];
      if (!vis) continue;
      vis.pivot.position.y = this.spec.wheelRadius + w.localCenterY();
      vis.pivot.rotation.y = w.steerAngle;
      vis.spin.rotation.x = w.spin % (Math.PI * 2);
    }
    if (this.model.steeringWheel) this.model.steeringWheel.rotation.z = -ph.steerAngle * 9;
    // Lanternas de freio
    const braking = ph.input.brake > 0.05 || (ph.input.handbrake ?? 0) > 0.1;
    const tl = this.materials.taillight;
    tl.emissiveColor.set(braking ? 1.0 : isNight ? 0.5 : 0.35, 0.02, 0.02);
    const hl = this.materials.headlight;
    const hlOn = isNight ? 1 : 0.55;
    hl.emissiveColor.set(hlOn, hlOn, hlOn * 1.05);
    if (this.headLight) this.headLight.intensity = isNight ? 3.2 : 0;
    // Painel de instrumentos (só quando visível no cockpit)
    if (this.model.dashTexture && cockpit) {
      this._dashTimer -= dt;
      if (this._dashTimer <= 0) {
        this._dashTimer = 0.1;
        drawDash(this.model.dashTexture, ph.speedKmh, ph.engine.displayRpm, ph.engine.maxRpm, ph.gear);
      }
    }
    this.effects.update(dt);
  }

  // ---------------- Replay ----------------
  /** Escreve o estado visual atual em 20 floats (ver ReplaySystem). */
  writeReplayFrame(arr, o) {
    const p = this.root.position, q = this.root.rotationQuaternion, ph = this.physics;
    arr[o] = p.x; arr[o + 1] = p.y; arr[o + 2] = p.z;
    arr[o + 3] = q.x; arr[o + 4] = q.y; arr[o + 5] = q.z; arr[o + 6] = q.w;
    arr[o + 7] = ph.steerAngle;
    for (let i = 0; i < 4; i++) {
      arr[o + 8 + i] = ph.wheels[i].localCenterY();
      arr[o + 12 + i] = ph.wheels[i].spin;
    }
    arr[o + 16] = Math.max(ph.input.brake, ph.input.handbrake ?? 0);
    arr[o + 17] = ph.engine.displayRpm;
    arr[o + 18] = ph.speedKmh;
    arr[o + 19] = ph.input.throttle;
  }

  /** Congela a física do carro (o replay passa a mover o modelo). */
  setReplayMode(on) {
    this.replaying = on;
    this.body.setMotionType(on ? PhysicsMotionType.ANIMATED : PhysicsMotionType.DYNAMIC);
    this.body.disablePreStep = !on;
    if (on) {
      this.body.setLinearVelocity(Vector3.Zero());
      this.body.setAngularVelocity(Vector3.Zero());
    }
    this.effects?.update?.(0, true);
  }

  /** Guarda posição e velocidades (para voltar à corrida após um replay). */
  snapshot() {
    const v = new Vector3(), w = new Vector3();
    this.body.getLinearVelocityToRef(v);
    this.body.getAngularVelocityToRef(w);
    return { p: this.root.position.clone(), q: this.root.rotationQuaternion.clone(), v, w };
  }

  restoreSnapshot(s) {
    this.replaying = false;
    this.root.position.copyFrom(s.p);
    this.root.rotationQuaternion.copyFrom(s.q);
    this.body.setMotionType(PhysicsMotionType.DYNAMIC);
    this.body.disablePreStep = false;
    this.body.setLinearVelocity(s.v);
    this.body.setAngularVelocity(s.w);
    this._pendingTeleport = true;
    const observable = this.scene.onAfterPhysicsObservable ?? this.scene.onAfterStepObservable;
    const obs = observable.add(() => {
      this.body.disablePreStep = true;
      this._pendingTeleport = false;
      observable.remove(obs);
    });
  }

  /** Aplica um quadro de replay ao modelo. */
  applyReplayFrame(f, { isNight = false } = {}) {
    this.root.position.set(f[0], f[1], f[2]);
    this.root.rotationQuaternion.set(f[3], f[4], f[5], f[6]);
    const names = ['FL', 'FR', 'RL', 'RR'];
    for (let i = 0; i < 4; i++) {
      const vis = this.model.wheels[names[i]];
      if (!vis) continue;
      vis.pivot.position.y = this.spec.wheelRadius + f[8 + i];
      vis.pivot.rotation.y = i < 2 ? f[7] : 0;
      vis.spin.rotation.x = f[12 + i] % (Math.PI * 2);
    }
    if (this.model.steeringWheel) this.model.steeringWheel.rotation.z = -f[7] * 9;
    this.materials.taillight.emissiveColor.set(f[16] > 0.05 ? 1.0 : isNight ? 0.5 : 0.35, 0.02, 0.02);
    const hlOn = isNight ? 1 : 0.55;
    this.materials.headlight.emissiveColor.set(hlOn, hlOn, hlOn * 1.05);
    if (this.headLight) this.headLight.intensity = isNight ? 3.2 : 0;
  }

  get position() { return this.root.position; }
  get speed() { return this.physics.speed; }

  /** Posição como objeto simples (para RaceManager/IA). */
  getPosition() {
    const p = this.root.position;
    return { x: p.x, y: p.y, z: p.z };
  }

  /** Coloca o carro em um ponto da pista com segurança (sem atravessar o chão). */
  teleport(position, heading) {
    const q = quatFromYaw(heading);
    this.root.position.set(position.x, position.y, position.z);
    this.root.rotationQuaternion.set(q.x, q.y, q.z, q.w);
    this.body.disablePreStep = false;
    this.body.setLinearVelocity(Vector3.Zero());
    this.body.setAngularVelocity(Vector3.Zero());
    this.physics.resetState();
    this._pendingTeleport = true;
    const observable = this.scene.onAfterPhysicsObservable ?? this.scene.onAfterStepObservable;
    const obs = observable.add(() => {
      this.body.disablePreStep = true;
      this._pendingTeleport = false;
      observable.remove(obs);
    });
    this.trackHint = -1;
  }

  /** Respawn no centro da pista, alguns metros atrás da posição atual. */
  respawnOnTrack() {
    if (!this.track) return;
    const pr = this.track.project(this.root.position, -1);
    const pt = this.track.pointAt(pr.s - 4, 0);
    this.teleport({ x: pt.p.x, y: pt.p.y + 0.9, z: pt.p.z }, pt.heading);
  }

  /** Troca cor/acabamento ao vivo (garagem). */
  setPaint(hex, finish) {
    const m = this.materials.paint;
    m.albedoColor = Color3.FromHexString(hex).toLinearSpace();
    if (finish) {
      m.metallic = finish === 'matte' ? 0.1 : 0.55;
      m.roughness = finish === 'matte' ? 0.6 : 0.28;
      m.clearCoat.isEnabled = finish !== 'matte';
    }
  }

  dispose() {
    this.effects?.dispose();
    this.body?.dispose();
    this.headLight?.dispose();
    if (this.model?.dispose) { this.model.dispose(); this.root?.dispose(false, true); }
    else this.root?.dispose(false, true);
  }
}
