// =============================================================
// EXTREME RACING — MobileControls
// Controles touchscreen (multitoque) em modo horizontal:
//  • Volante virtual (gira com o dedo) | setas | inclinação
//  • Acelerador, freio, freio de mão
//  • Troca de marchas (+ / −) no câmbio manual
//  • Câmera, pausa e reposicionar carro
// =============================================================
import { h } from './dom.js';

const WHEEL_SVG = `
<svg viewBox="0 0 200 200" aria-hidden="true">
  <circle cx="100" cy="100" r="88" fill="rgba(10,13,19,0.35)" stroke="rgba(255,255,255,0.55)" stroke-width="14"/>
  <circle cx="100" cy="100" r="26" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.5)" stroke-width="4"/>
  <rect x="20" y="94" width="54" height="12" rx="5" fill="rgba(255,255,255,0.45)"/>
  <rect x="126" y="94" width="54" height="12" rx="5" fill="rgba(255,255,255,0.45)"/>
  <rect x="94" y="126" width="12" height="54" rx="5" fill="rgba(255,255,255,0.45)"/>
  <rect x="92" y="8" width="16" height="16" rx="3" fill="#e3122e"/>
</svg>`;

export class MobileControls {
  /**
   * @param {HTMLElement} root
   * @param {object} settings configurações salvas (modo de direção, sensibilidade…)
   */
  constructor(root, settings) {
    this.root = root;
    this.settings = settings;
    this.state = { throttle: 0, brake: 0, handbrake: 0, steer: 0, steerActive: false };
    this.events = { camera: [], gearUp: [], gearDown: [], pause: [], reset: [] };
    this.wheelAngle = 0;
    this.tilt = 0;
    this._buttons = new Map();
    this.el = h('div', { class: 'controls' });
    root.appendChild(this.el);
    this.build();
    this._onOrientation = this._onOrientation.bind(this);
    window.addEventListener('deviceorientation', this._onOrientation);
  }

  on(evt, fn) { this.events[evt].push(fn); }
  emit(evt) { for (const fn of this.events[evt]) fn(); }

  build() {
    const mode = this.settings.steering;
    this.el.innerHTML = '';
    // ---------- Direção ----------
    if (mode === 'wheel') {
      this.wheel = h('div', { class: 'ctl wheel', html: WHEEL_SVG });
      this.el.appendChild(this.wheel);
      this._bindWheel(this.wheel);
    } else if (mode === 'buttons') {
      const left = h('div', { class: 'ctl steer-btn steer-left' }, '◀');
      const right = h('div', { class: 'ctl steer-btn steer-right' }, '▶');
      this.el.append(left, right);
      this._bindHold(left, (v) => { this._left = v; this._applyButtons(); });
      this._bindHold(right, (v) => { this._right = v; this._applyButtons(); });
    } else {
      this.el.appendChild(h('div', { class: 'tilt-hint' }, 'Incline o celular para esterçar'));
    }
    // ---------- Pedais ----------
    const gas = h('div', { class: 'ctl pedal-gas' }, 'ACELERAR');
    const brake = h('div', { class: 'ctl pedal-brake' }, 'FREIO');
    const hand = h('div', { class: 'ctl btn-hand' }, 'FREIO DE MÃO');
    this.el.append(gas, brake, hand);
    this._bindHold(gas, (v) => { this.state.throttle = v ? 1 : 0; });
    this._bindHold(brake, (v) => { this.state.brake = v ? 1 : 0; });
    this._bindHold(hand, (v) => { this.state.handbrake = v ? 1 : 0; });
    // ---------- Marchas (manual) ----------
    this.gearUp = h('div', { class: 'ctl btn-up' }, '+');
    this.gearDown = h('div', { class: 'ctl btn-down' }, '−');
    this.el.append(this.gearUp, this.gearDown);
    this._bindTap(this.gearUp, () => this.emit('gearUp'));
    this._bindTap(this.gearDown, () => this.emit('gearDown'));
    this.setManual(this.settings.transmission === 'manual');
    // ---------- Utilitários ----------
    const cam = h('div', { class: 'ctl btn-cam' }, 'CÂM');
    const pause = h('div', { class: 'ctl btn-pause' }, 'II');
    const reset = h('div', { class: 'ctl btn-reset' }, 'RESET');
    this.el.append(cam, pause, reset);
    this._bindTap(cam, () => this.emit('camera'));
    this._bindTap(pause, () => this.emit('pause'));
    this._bindTap(reset, () => this.emit('reset'));
  }

  setManual(manual) {
    this.gearUp.classList.toggle('hidden', !manual);
    this.gearDown.classList.toggle('hidden', !manual);
  }

  setVisible(v) { this.el.classList.toggle('hidden', !v); }

  _applyButtons() {
    this.state.steer = (this._right ? 1 : 0) - (this._left ? 1 : 0);
    this.state.steerActive = !!(this._left || this._right);
  }

  /** Botão de segurar com suporte a multitoque (pointer capture). */
  _bindHold(el, cb) {
    const active = new Set();
    const down = (e) => {
      e.preventDefault();
      active.add(e.pointerId);
      try { el.setPointerCapture(e.pointerId); } catch { /* ok */ }
      el.classList.add('active');
      cb(true);
    };
    const up = (e) => {
      active.delete(e.pointerId);
      if (active.size === 0) { el.classList.remove('active'); cb(false); }
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _bindTap(el, cb) {
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      el.classList.add('active');
      cb();
      setTimeout(() => el.classList.remove('active'), 120);
    });
  }

  /** Volante virtual: o ângulo do dedo em torno do centro gira o volante. */
  _bindWheel(el) {
    let pid = null, startAngle = 0, startWheel = 0;
    const svg = el.querySelector('svg');
    const angleOf = (e) => {
      const r = el.getBoundingClientRect();
      return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2));
    };
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (pid !== null) return;
      pid = e.pointerId;
      try { el.setPointerCapture(pid); } catch { /* ok */ }
      startAngle = angleOf(e);
      startWheel = this.wheelAngle;
      el.classList.add('active');
      this.state.steerActive = true;
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerId !== pid) return;
      let d = angleOf(e) - startAngle;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.wheelAngle = Math.max(-2.4, Math.min(2.4, startWheel + d));
      // ±1 a ±100° (ajustado pela sensibilidade)
      const range = (100 * Math.PI) / 180 / (this.settings.steeringSensitivity || 1);
      this.state.steer = Math.max(-1, Math.min(1, this.wheelAngle / range));
      svg.style.transform = `rotate(${this.wheelAngle}rad)`;
    });
    const release = (e) => {
      if (e.pointerId !== pid) return;
      pid = null;
      el.classList.remove('active');
      this.state.steerActive = false;
      this.state.steer = 0;
      this.wheelAngle = 0;
      svg.style.transition = 'transform 0.18s ease-out';
      svg.style.transform = 'rotate(0rad)';
      setTimeout(() => { svg.style.transition = ''; }, 200);
    };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
  }

  /** Inclinação do aparelho (modo horizontal). */
  _onOrientation(e) {
    if (this.settings.steering !== 'tilt' || e.beta == null) return;
    const angle = (screen.orientation && screen.orientation.angle) ?? window.orientation ?? 90;
    // Em paisagem, girar o celular como um volante altera "beta"
    let tilt = angle === 90 ? e.beta : angle === -90 || angle === 270 ? -e.beta : e.gamma;
    if (this.settings.tiltInvert) tilt = -tilt;
    const range = 28 / (this.settings.tiltSensitivity || 1); // graus para esterço total
    const dead = 2;
    const t = Math.abs(tilt) < dead ? 0 : (tilt - Math.sign(tilt) * dead) / range;
    this.state.steer = Math.max(-1, Math.min(1, t));
    this.state.steerActive = true;
  }

  /** Pedido de permissão de sensores (iOS); no Android é automático. */
  static async requestTiltPermission() {
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        const r = await DeviceOrientationEvent.requestPermission();
        return r === 'granted';
      }
    } catch { return false; }
    return true;
  }

  dispose() {
    window.removeEventListener('deviceorientation', this._onOrientation);
    this.el.remove();
  }
}
