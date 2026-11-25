// Joystick virtual (toque/mouse) no canto inferior esquerdo. Multitoque: usa o pointerId próprio.
export class VirtualJoystick {
  constructor(parent) {
    this.el = document.createElement('div');
    this.el.className = 'joystick';
    this.el.innerHTML = '<div class="joy-base"><div class="joy-knob"></div></div>';
    parent.appendChild(this.el);
    this.base = this.el.querySelector('.joy-base');
    this.knob = this.el.querySelector('.joy-knob');
    this.x = 0; this.y = 0; this.active = false; this.pid = null;
    const down = (e) => {
      if (this.pid !== null) return;
      e.preventDefault();
      this.pid = e.pointerId; this.active = true;
      try { this.el.setPointerCapture(e.pointerId); } catch {}
      this.base.classList.add('on');
      this.move(e);
    };
    const move = (e) => { if (e.pointerId === this.pid) { e.preventDefault(); this.move(e); } };
    const up = (e) => { if (e.pointerId === this.pid) this.reset(); };
    this.el.addEventListener('pointerdown', down);
    this.el.addEventListener('pointermove', move);
    this.el.addEventListener('pointerup', up);
    this.el.addEventListener('pointercancel', up);
    this.el.addEventListener('lostpointercapture', up);
  }

  move(e) {
    const r = this.base.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2, max = r.width * 0.42;
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    if (len > max) { dx *= max / len; dy *= max / len; }
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const n = Math.min(1, len / max);
    // zona morta de 18%
    if (n < 0.18) { this.x = 0; this.y = 0; return; }
    const mag = (n - 0.18) / 0.82;
    this.x = ux * mag;
    this.y = uy * mag;
  }

  reset() {
    this.pid = null; this.active = false; this.x = 0; this.y = 0;
    this.knob.style.transform = 'translate(0,0)';
    this.base.classList.remove('on');
  }

  setVisible(v) { this.el.style.display = v ? '' : 'none'; if (!v) this.reset(); }
}
