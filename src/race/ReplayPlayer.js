// =============================================================
// EXTREME RACING — ReplayPlayer
// Reproduz a gravação da corrida: congela a física, move os
// carros pelos quadros interpolados e oferece câmeras de TV
// (beira da pista), perseguição, helicóptero e cockpit, com
// velocidade variável, pausa e avanço/retrocesso.
// =============================================================
import { Vector3, Quaternion } from '@babylonjs/core';
import { FRAME_FLOATS } from './ReplaySystem.js';
import { damp, clamp } from '../utils/MathUtils.js';

export const REPLAY_CAMS = [
  ['tv', 'TV'],
  ['chase', 'PERSEGUIÇÃO'],
  ['heli', 'HELICÓPTERO'],
  ['cockpit', 'COCKPIT'],
];

export class ReplayPlayer {
  /**
   * @param {RaceSession} session
   * @param {ReplayRecorder} recorder
   */
  constructor(session, recorder) {
    this.session = session;
    this.rec = recorder;
    this.vehicles = session.vehicles;
    this.camera = session.camera.camera;
    this.geo = session.geo;
    this.t = 0;
    this.speed = 1;
    this.playing = true;
    this.camMode = 'tv';
    this.target = Math.max(0, this.vehicles.findIndex((v) => v.isPlayer));
    this.frame = new Float32Array(FRAME_FLOATS);
    this._camPos = null;
    this._look = new Vector3();
    this._tvSpot = null;
    this._tvTimer = 0;
    this.active = false;
  }

  start() {
    this.active = true;
    this.t = 0;
    for (const v of this.vehicles) v.setReplayMode(true);
    this._camPos = null;
  }

  stop() {
    this.active = false;
    this.camera.parent = null;
    this.camera.rotationQuaternion = null;
  }

  get duration() { return this.rec.duration; }

  seek(t) { this.t = clamp(t, 0, this.duration); this._camPos = null; this._tvSpot = null; }
  nextCamera() {
    const i = REPLAY_CAMS.findIndex((c) => c[0] === this.camMode);
    this.camMode = REPLAY_CAMS[(i + 1) % REPLAY_CAMS.length][0];
    this._camPos = null;
    this._tvSpot = null;
    return REPLAY_CAMS.find((c) => c[0] === this.camMode)[1];
  }
  nextCar() {
    this.target = (this.target + 1) % this.vehicles.length;
    this._camPos = null;
    this._tvSpot = null;
    return this.vehicles[this.target].name;
  }

  /** Atualização por quadro renderizado. */
  update(dt, { isNight = false } = {}) {
    if (!this.active) return;
    if (this.playing) {
      this.t += dt * this.speed;
      if (this.t >= this.duration) { this.t = this.duration; this.playing = false; }
    }
    const audio = this.session.game.audio;
    this.vehicles.forEach((v, i) => {
      this.rec.sample(i, this.t, this.frame);
      v.applyReplayFrame(this.frame, { isNight });
      if (audio.enabled) {
        const d = this.camera.globalPosition.subtract(v.root.position).length();
        audio.updateEngine(v.id, {
          rpm: this.frame[17], load: this.playing ? this.frame[19] : 0, limiter: false,
          distance: i === this.target && this.camMode === 'cockpit' ? 0 : d,
        });
      }
    });
    this._updateCamera(dt);
  }

  _updateCamera(dt) {
    const car = this.vehicles[this.target];
    const p = car.root.position;
    const q = car.root.rotationQuaternion;
    const fwd = new Vector3(0, 0, 1).rotateByQuaternionToRef(q, new Vector3());
    const cam = this.camera;
    if (this.camMode === 'cockpit') {
      const eye = car.model.driverEye.clone();
      eye.y -= car.spec.wheelRadius;
      cam.parent = car.root;
      cam.position.copyFrom(eye);
      cam.rotationQuaternion = Quaternion.Identity();
      cam.fov = 1.05;
      cam.minZ = 0.05;
      return;
    }
    cam.parent = null;
    cam.rotationQuaternion = null;
    cam.minZ = 0.2;
    let desired;
    let fov = 0.9;
    if (this.camMode === 'chase') {
      desired = new Vector3(p.x - fwd.x * 6.5, p.y + 2.1, p.z - fwd.z * 6.5);
    } else if (this.camMode === 'heli') {
      desired = new Vector3(p.x - fwd.x * 28 + fwd.z * 18, p.y + 26, p.z - fwd.z * 28 - fwd.x * 18);
      fov = 0.8;
    } else {
      // TV: câmeras fixas a cada ~150 m na beira da pista; corta para a próxima à frente
      const pr = this.geo.project(p, car.trackHint ?? -1);
      const spacing = 150;
      const need = !this._tvSpot || this._tvTimer > 0.5 && pr.s - this._tvSpot.s > spacing * 0.55 && pr.s - this._tvSpot.s < this.geo.length / 2;
      this._tvTimer += dt;
      if (need) {
        const sCam = Math.ceil((pr.s + 25) / spacing) * spacing;
        const side = Math.floor(sCam / spacing) % 2 ? 1 : -1;
        const pt = this.geo.pointAt(sCam, side * (this.geo.barrierOffset + 7));
        this._tvSpot = { s: sCam, pos: new Vector3(pt.p.x, pt.p.y + 4.5, pt.p.z) };
        this._camPos = this._tvSpot.pos.clone();
        this._tvTimer = 0;
      }
      if (this._tvSpot && pr.s < this._tvSpot.s - spacing * 1.5) this._tvSpot = null; // replay voltou
      desired = this._tvSpot ? this._tvSpot.pos : new Vector3(p.x - 10, p.y + 5, p.z - 10);
      const dist = Vector3.Distance(desired, p);
      fov = clamp(0.95 * (30 / Math.max(30, dist)), 0.18, 0.95); // zoom de TV
    }
    if (!this._camPos) this._camPos = desired.clone();
    const k = this.camMode === 'tv' ? 1000 : 6;
    this._camPos.x = damp(this._camPos.x, desired.x, k, dt);
    this._camPos.y = damp(this._camPos.y, desired.y, k, dt);
    this._camPos.z = damp(this._camPos.z, desired.z, k, dt);
    this._look.x = damp(this._look.x, p.x, 12, dt);
    this._look.y = damp(this._look.y, p.y + 0.8, 12, dt);
    this._look.z = damp(this._look.z, p.z, 12, dt);
    if (Vector3.Distance(this._look, p) > 40) this._look.set(p.x, p.y + 0.8, p.z);
    cam.position.copyFrom(this._camPos);
    cam.setTarget(this._look);
    cam.fov = damp(cam.fov, fov, 5, dt);
  }
}
