// Controles virtuais (toque) + teclado.
// Joystick analógico dinâmico no lado esquerdo e botões no lado direito.
// Usa Pointer Events com rastreamento por pointerId: vários dedos ao mesmo tempo
// (correr + mover + chutar) sem que um toque interrompa o outro.

export class MobileControls {
  /**
   * @param {HTMLElement} root  container #controls
   * @param {string[]} buttons  ids dos botões a exibir (ex.: ['sprint','shoot','switch'])
   */
  constructor(root, buttons) {
    this.root = root;
    this.move = { x: 0, y: 0, magnitude: 0 }; // x: direita+, y: cima+ (tela)
    this.held = {};       // botão -> pressionado
    this.pressed = {};    // botão -> apertado neste quadro (consumido por consume())
    this.released = {};   // botão -> solto neste quadro
    this.holdTime = {};   // botão -> segundos pressionado
    this.enabled = true;
    this.joyPointer = null;
    this.keys = new Set();
    this.buildDom(buttons);
    this.bindTouch();
    this.bindKeyboard();
  }

  buildDom(buttons) {
    const labels = {
      pass: 'PASSE', shoot: 'CHUTE', sprint: 'CORRIDA', tackle: 'CARRINHO', switch: 'TROCAR'
    };
    this.root.innerHTML = `
      <div class="joy-zone" id="joyZone">
        <div class="joy-base" id="joyBase"><div class="joy-knob" id="joyKnob"></div></div>
      </div>
      <div class="btn-zone">${buttons
        .map((b) => `<button class="ctl-btn ctl-${b}" data-btn="${b}" aria-label="${labels[b]}"><span>${labels[b]}</span></button>`)
        .join('')}</div>`;
    this.joyZone = this.root.querySelector('#joyZone');
    this.joyBase = this.root.querySelector('#joyBase');
    this.joyKnob = this.root.querySelector('#joyKnob');
    this.buttonEls = [...this.root.querySelectorAll('.ctl-btn')];
    for (const el of this.buttonEls) this.held[el.dataset.btn] = false;
  }

  bindTouch() {
    const zone = this.joyZone;
    const radius = () => this.joyBase.offsetWidth * 0.5 || 60;

    const setKnob = (dx, dy) => {
      this.joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;
    };

    zone.addEventListener('pointerdown', (e) => {
      if (!this.enabled || this.joyPointer !== null) return;
      e.preventDefault();
      zone.setPointerCapture(e.pointerId);
      this.joyPointer = e.pointerId;
      // joystick dinâmico: a base aparece onde o polegar tocou
      const rect = zone.getBoundingClientRect();
      const r = radius();
      const cx = Math.max(r, Math.min(rect.width - r, e.clientX - rect.left));
      const cy = Math.max(r, Math.min(rect.height - r, e.clientY - rect.top));
      this.joyCenter = { x: rect.left + cx, y: rect.top + cy };
      this.joyBase.style.left = `${cx - r}px`;
      this.joyBase.style.top = `${cy - r}px`;
      this.joyBase.classList.add('active');
      this.updateJoy(e.clientX, e.clientY, r, setKnob);
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.joyPointer) return;
      e.preventDefault();
      this.updateJoy(e.clientX, e.clientY, radius(), setKnob);
    });
    const end = (e) => {
      if (e.pointerId !== this.joyPointer) return;
      this.joyPointer = null;
      this.move.x = this.move.y = this.move.magnitude = 0;
      setKnob(0, 0);
      this.joyBase.classList.remove('active');
      this.joyBase.style.left = '';
      this.joyBase.style.top = '';
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
    zone.addEventListener('lostpointercapture', end);

    for (const el of this.buttonEls) {
      const name = el.dataset.btn;
      const down = (e) => {
        e.preventDefault();
        if (!this.enabled) return;
        el.setPointerCapture?.(e.pointerId);
        this.press(name);
        el.classList.add('down');
        if (navigator.vibrate) {
          try { navigator.vibrate(8); } catch { /* ignora */ }
        }
      };
      const up = (e) => {
        e.preventDefault();
        if (!this.held[name]) return;
        this.release(name);
        el.classList.remove('down');
      };
      el.addEventListener('pointerdown', down);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('lostpointercapture', up);
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    }
  }

  updateJoy(x, y, r, setKnob) {
    let dx = x - this.joyCenter.x;
    let dy = y - this.joyCenter.y;
    const len = Math.hypot(dx, dy);
    if (len > r) { dx *= r / len; dy *= r / len; }
    setKnob(dx, dy);
    const dead = 0.12;
    const m = Math.min(1, len / r);
    const mag = m < dead ? 0 : (m - dead) / (1 - dead);
    this.move.magnitude = mag;
    this.move.x = len > 0 ? dx / len : 0;
    this.move.y = len > 0 ? -dy / len : 0;
  }

  press(name) {
    if (this.held[name]) return;
    this.held[name] = true;
    this.pressed[name] = true;
    this.holdTime[name] = 0;
  }

  release(name) {
    this.held[name] = false;
    this.released[name] = this.holdTime[name] || 0.0001;
  }

  bindKeyboard() {
    const map = {
      ShiftLeft: 'sprint', ShiftRight: 'sprint', Space: 'shoot', KeyJ: 'shoot', KeyK: 'pass',
      KeyL: 'tackle', KeyQ: 'switch', KeyE: 'switch'
    };
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      const b = map[e.code];
      if (b && b in this.held) { this.press(b); e.preventDefault(); }
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      const b = map[e.code];
      if (b && b in this.held) this.release(b);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      for (const k in this.held) if (this.held[k]) this.release(k);
    });
  }

  /** Atualiza tempos e devolve o estado combinado (toque + teclado). */
  read(dt) {
    for (const k in this.held) if (this.held[k]) this.holdTime[k] = (this.holdTime[k] || 0) + dt;
    let x = this.move.x * this.move.magnitude;
    let y = this.move.y * this.move.magnitude;
    let mag = this.move.magnitude;
    const k = this.keys;
    const kx = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    const ky = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    if (kx || ky) {
      const l = Math.hypot(kx, ky);
      x = kx / l; y = ky / l; mag = 1;
    }
    return { x, y, magnitude: mag };
  }

  /** Lê e limpa "apertou"/"soltou" deste quadro. */
  consume() {
    const out = { pressed: this.pressed, released: this.released };
    this.pressed = {};
    this.released = {};
    return out;
  }

  reset() {
    for (const k in this.held) {
      this.held[k] = false;
    }
    for (const el of this.buttonEls) el.classList.remove('down');
    this.pressed = {};
    this.released = {};
    this.move.x = this.move.y = this.move.magnitude = 0;
    this.joyPointer = null;
    this.joyKnob.style.transform = '';
    this.joyBase.classList.remove('active');
  }

  setVisible(on) {
    this.root.classList.toggle('hidden', !on);
  }
}
