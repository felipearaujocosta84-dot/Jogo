// =============================================================
// EXTREME RACING — InputManager
// Combina teclado (teste no navegador) e controles touch em uma
// única entrada { throttle, brake, steer, handbrake } e eventos
// (câmera, marchas, pausa, reset). Suaviza direção digital.
// Teclado: ↑/W acelerar, ↓/S frear, ←→/AD direção, Espaço freio
// de mão, C câmera, E/Q (ou Shift/Ctrl) marchas, R reset, Esc pausa.
// =============================================================
import { moveTowards, clamp } from '../utils/MathUtils.js';

export class InputManager {
  constructor(controls, settings) {
    this.controls = controls;
    this.settings = settings;
    this.keys = new Set();
    this.out = { throttle: 0, brake: 0, steer: 0, handbrake: 0 };
    this.listeners = { camera: [], gearUp: [], gearDown: [], pause: [], reset: [] };
    this._kd = (e) => this._onKey(e, true);
    this._ku = (e) => this._onKey(e, false);
    window.addEventListener('keydown', this._kd);
    window.addEventListener('keyup', this._ku);
    if (controls) for (const evt of Object.keys(this.listeners)) controls.on(evt, () => this.emit(evt));
  }

  on(evt, fn) { this.listeners[evt].push(fn); }
  emit(evt) { for (const fn of this.listeners[evt]) fn(); }

  _onKey(e, down) {
    const k = e.code;
    if (down && !this.keys.has(k)) {
      if (k === 'KeyC') this.emit('camera');
      if (k === 'KeyE' || k === 'ShiftLeft' || k === 'ShiftRight') this.emit('gearUp');
      if (k === 'KeyQ' || k === 'ControlLeft' || k === 'ControlRight') this.emit('gearDown');
      if (k === 'KeyR') this.emit('reset');
      if (k === 'Escape' || k === 'KeyP') this.emit('pause');
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(k)) e.preventDefault();
    if (down) this.keys.add(k); else this.keys.delete(k);
  }

  update(dt) {
    const K = this.keys;
    const c = this.controls?.state ?? { throttle: 0, brake: 0, steer: 0, handbrake: 0, steerActive: false };
    const kThr = K.has('ArrowUp') || K.has('KeyW') ? 1 : 0;
    const kBrk = K.has('ArrowDown') || K.has('KeyS') ? 1 : 0;
    const kL = K.has('ArrowLeft') || K.has('KeyA');
    const kR = K.has('ArrowRight') || K.has('KeyD');
    const kHand = K.has('Space') ? 1 : 0;

    this.out.throttle = Math.max(kThr, c.throttle);
    this.out.brake = Math.max(kBrk, c.brake);
    this.out.handbrake = Math.max(kHand, c.handbrake);

    // Direção: analógica (volante/inclinação) direta; digital com rampa
    const digital = (kR ? 1 : 0) - (kL ? 1 : 0);
    let target;
    let rate;
    if (digital !== 0) {
      target = digital * clamp(this.settings.steeringSensitivity ?? 1, 0.5, 1.5);
      rate = 3.2;
    } else if (this.settings.steering === 'buttons' && c.steerActive) {
      target = c.steer * clamp(this.settings.steeringSensitivity ?? 1, 0.5, 1.5);
      rate = 3.2;
    } else if (c.steerActive) {
      target = c.steer;
      rate = 12;
    } else {
      target = 0;
      rate = 5;
    }
    this.out.steer = clamp(moveTowards(this.out.steer, clamp(target, -1, 1), rate * dt), -1, 1);
    return this.out;
  }

  dispose() {
    window.removeEventListener('keydown', this._kd);
    window.removeEventListener('keyup', this._ku);
  }
}
