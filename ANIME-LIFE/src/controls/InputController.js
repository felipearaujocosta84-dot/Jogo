// Junta joystick virtual + teclado (PC) num único vetor de movimento e ação "interagir".
import { settings } from '../save/Settings.js';

export class InputController {
  constructor(joystick) {
    this.joy = joystick;
    this.keys = new Set();
    this.enabled = true;
    this.onInteract = null;
    this._kd = (e) => {
      if (e.target instanceof HTMLInputElement) return;
      const k = e.key.toLowerCase();
      this.keys.add(k);
      if (this.enabled && (k === 'e' || k === ' ' || k === 'enter') && !e.repeat) this.onInteract?.();
    };
    this._ku = (e) => this.keys.delete(e.key.toLowerCase());
    this._blur = () => this.keys.clear();
    window.addEventListener('keydown', this._kd);
    window.addEventListener('keyup', this._ku);
    window.addEventListener('blur', this._blur);
  }

  /** Vetor de movimento normalizado (comprimento 0..1). */
  vector() {
    if (!this.enabled) return { x: 0, y: 0 };
    let x = 0, y = 0;
    const k = this.keys;
    if (k.has('arrowleft') || k.has('a')) x -= 1;
    if (k.has('arrowright') || k.has('d')) x += 1;
    if (k.has('arrowup') || k.has('w')) y -= 1;
    if (k.has('arrowdown') || k.has('s')) y += 1;
    if (x || y) { const l = Math.hypot(x, y); x /= l; y /= l; }
    else if (this.joy) { x = this.joy.x; y = this.joy.y; }
    if (settings.data.movement === 'quatro' && (x || y)) { // só 4 direções
      const m = Math.hypot(x, y);
      if (Math.abs(x) > Math.abs(y)) { x = Math.sign(x) * m; y = 0; } else { y = Math.sign(y) * m; x = 0; }
    }
    return { x, y };
  }

  setEnabled(v) { this.enabled = v; if (!v) { this.keys.clear(); this.joy?.reset(); } }

  destroy() {
    window.removeEventListener('keydown', this._kd);
    window.removeEventListener('keyup', this._ku);
    window.removeEventListener('blur', this._blur);
  }
}
