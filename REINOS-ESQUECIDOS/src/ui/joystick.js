// Controles: joystick analógico dinâmico (metade esquerda da tela), gestos de câmera
// (arrastar na metade direita gira, pinça dá zoom) e teclado/mouse no PC.

export class Input {
  constructor(game, canvas) {
    this.game = game;
    this.canvas = canvas;
    this.state = { x: 0, y: 0, magnitude: 0, attack: false, skill: false, dodge: false, potion: false, interact: false, walk: false };
    this.keys = new Set();
    this.joy = null; // { id, ox, oy }
    this.camTouches = new Map();
    this.radius = 60;
    this.enabled = true;
    this.buildJoystick();
    this.bind();
  }

  buildJoystick() {
    const base = document.createElement('div');
    base.id = 'joyBase';
    const knob = document.createElement('div');
    knob.id = 'joyKnob';
    base.appendChild(knob);
    document.getElementById('hud').appendChild(base);
    this.base = base;
    this.knob = knob;
    this.showBase(false);
  }

  showBase(on, x, y) {
    if (on) {
      this.base.style.left = x + 'px';
      this.base.style.top = y + 'px';
      this.base.classList.add('active');
    } else {
      this.base.classList.remove('active');
      this.knob.style.transform = 'translate(-50%, -50%)';
    }
  }

  /** Botões da tela chamam isto. */
  press(name) {
    if (!this.enabled) return;
    this.state[name] = true;
  }

  bind() {
    const c = this.canvas;
    const opts = { passive: false };
    c.addEventListener('touchstart', (e) => this.onTouchStart(e), opts);
    c.addEventListener('touchmove', (e) => this.onTouchMove(e), opts);
    c.addEventListener('touchend', (e) => this.onTouchEnd(e), opts);
    c.addEventListener('touchcancel', (e) => this.onTouchEnd(e), opts);

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      this.keys.add(k);
      if (!this.enabled) return;
      if (k === ' ' || k === 'j') this.press('attack');
      if (k === 'k') this.press('skill');
      if (k === 'shift' || k === 'l') this.press('dodge');
      if (k === 'h' || k === 'r') this.press('potion');
      if (k === 'f' || k === 'enter') this.press('interact');
      if (k === 'q') this.game.cameraRig.rotate(-Math.PI / 4);
      if (k === 'e') this.game.cameraRig.rotate(Math.PI / 4);
      if (k === 'i') this.game.menus.toggle('inventory');
      if (k === 'm') this.game.menus.toggle('map');
      if (k === 'u') this.game.menus.toggle('quests');
      if (k === 'escape' || k === 'p') this.game.menus.toggle('pause');
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());

    // mouse: clique esquerdo ataca, direito arrasta gira a câmera, roda = zoom
    let dragging = false, lastX = 0;
    c.addEventListener('mousedown', (e) => {
      if (e.button === 2) { dragging = true; lastX = e.clientX; }
      else if (e.button === 0 && this.enabled) this.press('attack');
    });
    window.addEventListener('mouseup', () => (dragging = false));
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      this.game.cameraRig.rotate((e.clientX - lastX) * 0.006);
      lastX = e.clientX;
    });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.game.cameraRig.zoom(e.deltaY * 0.01);
    }, { passive: false });
  }

  onTouchStart(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.clientX < window.innerWidth * 0.45 && !this.joy) {
        this.joy = { id: t.identifier, ox: t.clientX, oy: t.clientY };
        this.showBase(true, t.clientX, t.clientY);
      } else {
        this.camTouches.set(t.identifier, { x: t.clientX, y: t.clientY });
      }
    }
    if (this.camTouches.size === 2) this.pinchDist = this.touchDist();
  }

  touchDist() {
    const pts = [...this.camTouches.values()];
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  }

  onTouchMove(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (this.joy && t.identifier === this.joy.id) {
        let dx = t.clientX - this.joy.ox, dy = t.clientY - this.joy.oy;
        const d = Math.hypot(dx, dy);
        const R = this.radius;
        // a base "segue" o dedo se ele passar muito do limite
        if (d > R * 1.6) {
          const k = (d - R * 1.6) / d;
          this.joy.ox += dx * k; this.joy.oy += dy * k;
          this.base.style.left = this.joy.ox + 'px';
          this.base.style.top = this.joy.oy + 'px';
          dx = t.clientX - this.joy.ox; dy = t.clientY - this.joy.oy;
        }
        const m = Math.min(1, Math.hypot(dx, dy) / R);
        const a = Math.atan2(dy, dx);
        this.state.x = Math.cos(a) * m;
        this.state.y = -Math.sin(a) * m;
        this.state.magnitude = m;
        this.knob.style.transform = `translate(calc(-50% + ${Math.cos(a) * m * R}px), calc(-50% + ${Math.sin(a) * m * R}px))`;
      } else if (this.camTouches.has(t.identifier)) {
        const prev = this.camTouches.get(t.identifier);
        if (this.camTouches.size === 1) {
          this.game.cameraRig.rotate((t.clientX - prev.x) * 0.008);
        }
        prev.x = t.clientX; prev.y = t.clientY;
        if (this.camTouches.size === 2) {
          const d = this.touchDist();
          this.game.cameraRig.zoom((this.pinchDist - d) * 0.04);
          this.pinchDist = d;
        }
      }
    }
  }

  onTouchEnd(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (this.joy && t.identifier === this.joy.id) {
        this.joy = null;
        this.state.x = 0; this.state.y = 0; this.state.magnitude = 0;
        this.showBase(false);
      }
      this.camTouches.delete(t.identifier);
    }
  }

  reset() {
    this.joy = null;
    this.camTouches.clear();
    Object.assign(this.state, { x: 0, y: 0, magnitude: 0, attack: false, skill: false, dodge: false, potion: false, interact: false });
    this.showBase(false);
  }

  /** Lê o estado do quadro (teclado + toque) e limpa os "apertos". */
  poll() {
    const s = this.state;
    if (!this.joy) {
      let x = 0, y = 0;
      const k = this.keys;
      if (k.has('a') || k.has('arrowleft')) x -= 1;
      if (k.has('d') || k.has('arrowright')) x += 1;
      if (k.has('w') || k.has('arrowup')) y += 1;
      if (k.has('s') || k.has('arrowdown')) y -= 1;
      const m = Math.hypot(x, y);
      s.x = m ? x / m : 0; s.y = m ? y / m : 0; s.magnitude = m ? 1 : 0;
      s.walk = k.has('control') || k.has('alt');
    }
    const out = { ...s };
    s.attack = s.skill = s.dodge = s.potion = s.interact = false;
    if (!this.enabled) { out.x = out.y = out.magnitude = 0; out.attack = out.skill = out.dodge = out.potion = out.interact = false; }
    return out;
  }
}
