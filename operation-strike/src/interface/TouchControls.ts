// Controles de toque para Android (multitoque com Pointer Events):
//  - joystick esquerdo dinâmico (aparece onde o polegar toca; empurrar pouco = andar silencioso);
//  - área direita para girar a câmera (arrastar);
//  - botões: atirar (2x, o da direita também gira a câmera enquanto arrasta), mirar, recarregar,
//    pular, agachar, trocar de arma, interagir e inspecionar;
//  - editor de layout: arrastar para mover, controle deslizante para o tamanho, salvo no aparelho.
import type { ActionName, InputState } from '../core/Input';
import { Storage } from '../save/Storage';

interface ButtonSpec {
  id: string;
  action: ActionName;
  label: string;
  icon: string;
  /** Alterna ligado/desligado em vez de segurar. */
  toggle?: boolean;
  /** Arrastar o dedo neste botão também gira a câmera. */
  look?: boolean;
  primary?: boolean;
}

export interface ButtonLayout {
  /** Centro em fração da tela (0..1). */
  x: number;
  y: number;
  /** Diâmetro em fração do menor lado da tela. */
  size: number;
  hidden?: boolean;
}

type Layout = Record<string, ButtonLayout>;

const BUTTONS: ButtonSpec[] = [
  { id: 'fire', action: 'fire', label: 'ATIRAR', icon: '◉', look: true, primary: true },
  { id: 'fire2', action: 'fire', label: 'ATIRAR', icon: '◉' },
  { id: 'aim', action: 'aim', label: 'MIRAR', icon: '⊕', toggle: true },
  { id: 'reload', action: 'reload', label: 'RECARREGAR', icon: '↻' },
  { id: 'jump', action: 'jump', label: 'PULAR', icon: '⤒' },
  { id: 'crouch', action: 'crouch', label: 'AGACHAR', icon: '⤓', toggle: true },
  { id: 'switch', action: 'switch', label: 'TROCAR', icon: '⇄' },
  { id: 'interact', action: 'interact', label: 'USAR', icon: '✋' },
  { id: 'inspect', action: 'inspect', label: 'INSPECIONAR', icon: '👁' }
];

const DEFAULT_LAYOUT: Layout = {
  joystick: { x: 0.13, y: 0.7, size: 0.34 },
  fire: { x: 0.85, y: 0.6, size: 0.2 },
  fire2: { x: 0.2, y: 0.36, size: 0.13 },
  aim: { x: 0.94, y: 0.4, size: 0.12 },
  reload: { x: 0.73, y: 0.86, size: 0.11 },
  jump: { x: 0.94, y: 0.74, size: 0.13 },
  crouch: { x: 0.94, y: 0.92, size: 0.11 },
  switch: { x: 0.61, y: 0.9, size: 0.1 },
  interact: { x: 0.72, y: 0.4, size: 0.1 },
  inspect: { x: 0.85, y: 0.3, size: 0.08 }
};

type PointerRole =
  | { kind: 'joystick'; ox: number; oy: number }
  | { kind: 'look'; lx: number; ly: number }
  | { kind: 'button'; spec: ButtonSpec; lx: number; ly: number }
  | { kind: 'edit'; id: string; dx: number; dy: number };

export class TouchControls {
  private root: HTMLElement;
  private joyBase: HTMLElement;
  private joyKnob: HTMLElement;
  private buttons = new Map<string, HTMLElement>();
  private pointers = new Map<number, PointerRole>();
  private toggles = new Set<string>();
  layout: Layout;
  sensitivity = 1;
  invertY = false;
  lookScale = 1;
  crouchToggle = true;
  enabled = false;
  private editing = false;
  private selected = 'fire';
  private editorBar: HTMLElement;
  private sizeSlider: HTMLInputElement;
  private selectedLabel: HTMLElement;
  private onEditorClose: (() => void) | null = null;

  constructor(root: HTMLElement, private input: InputState) {
    this.root = root;
    this.layout = this.loadLayout();

    this.joyBase = document.createElement('div');
    this.joyBase.className = 'joy-base';
    this.joyKnob = document.createElement('div');
    this.joyKnob.className = 'joy-knob';
    this.joyBase.appendChild(this.joyKnob);
    this.joyBase.dataset.id = 'joystick';
    root.appendChild(this.joyBase);

    for (const spec of BUTTONS) {
      const el = document.createElement('div');
      el.className = 'tbtn' + (spec.primary ? ' primary' : '');
      el.dataset.id = spec.id;
      el.innerHTML = `<span class="ico">${spec.icon}</span><span class="lbl">${spec.label}</span>`;
      root.appendChild(el);
      this.buttons.set(spec.id, el);
    }

    // Barra do editor de layout
    this.editorBar = document.getElementById('layoutEditor')!;
    this.sizeSlider = document.getElementById('layoutSize') as HTMLInputElement;
    this.selectedLabel = document.getElementById('layoutSelected')!;
    this.sizeSlider.addEventListener('input', () => {
      const l = this.layout[this.selected];
      if (!l) return;
      l.size = parseFloat(this.sizeSlider.value);
      this.applyLayout();
    });
    document.getElementById('layoutHide')!.addEventListener('click', () => {
      const l = this.layout[this.selected];
      if (!l || this.selected === 'joystick' || this.selected === 'fire') return;
      l.hidden = !l.hidden;
      this.applyLayout();
      this.refreshEditorBar();
    });
    document.getElementById('layoutReset')!.addEventListener('click', () => {
      this.layout = structuredClone(DEFAULT_LAYOUT);
      this.applyLayout();
      this.refreshEditorBar();
    });
    document.getElementById('layoutDone')!.addEventListener('click', () => this.closeEditor());

    root.addEventListener('pointerdown', e => this.onDown(e));
    root.addEventListener('pointermove', e => this.onMove(e));
    root.addEventListener('pointerup', e => this.onUp(e));
    root.addEventListener('pointercancel', e => this.onUp(e));
    root.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('resize', () => this.applyLayout());
    this.applyLayout();
  }

  private loadLayout(): Layout {
    const saved = Storage.load<Layout>('touchLayout', {});
    const out: Layout = structuredClone(DEFAULT_LAYOUT);
    for (const k of Object.keys(out)) if (saved[k]) out[k] = { ...out[k], ...saved[k] };
    return out;
  }

  setOpacity(v: number): void {
    this.root.style.setProperty('--btn-opacity', String(v));
  }

  show(v: boolean): void {
    this.root.classList.toggle('hidden', !v);
    if (!v) this.releaseAll();
  }

  /** Desliga botões de alternância (ex.: mira ao trocar de arma). */
  clearToggle(action: ActionName): void {
    for (const spec of BUTTONS) {
      if (spec.action === action && this.toggles.has(spec.id)) {
        this.toggles.delete(spec.id);
        this.input.set(action, false, 'touch:' + spec.id);
        this.buttons.get(spec.id)?.classList.remove('on');
      }
    }
  }

  isToggled(action: ActionName): boolean {
    return BUTTONS.some(b => b.action === action && this.toggles.has(b.id));
  }

  private applyLayout(): void {
    const w = window.innerWidth, h = window.innerHeight;
    const unit = Math.min(w, h);
    const place = (el: HTMLElement, l: ButtonLayout) => {
      const d = Math.round(l.size * unit);
      el.style.width = el.style.height = d + 'px';
      el.style.left = Math.round(l.x * w - d / 2) + 'px';
      el.style.top = Math.round(l.y * h - d / 2) + 'px';
      el.style.fontSize = Math.max(9, d * 0.13) + 'px';
      el.classList.toggle('off', !!l.hidden);
    };
    place(this.joyBase, this.layout.joystick);
    for (const [id, el] of this.buttons) place(el, this.layout[id]);
  }

  // ------------------------------------------------------------ eventos

  private hitButton(x: number, y: number): string | null {
    const w = window.innerWidth, h = window.innerHeight, unit = Math.min(w, h);
    let best: string | null = null;
    let bestD = Infinity;
    const ids = this.editing ? ['joystick', ...this.buttons.keys()] : [...this.buttons.keys()];
    for (const id of ids) {
      const l = this.layout[id];
      if (l.hidden && !this.editing) continue;
      const r = (l.size * unit) / 2 * (this.editing ? 1 : 1.15); // área de toque um pouco maior que o desenho
      const d = Math.hypot(x - l.x * w, y - l.y * h);
      if (d <= r && d < bestD) {
        bestD = d;
        best = id;
      }
    }
    return best;
  }

  private onDown(e: PointerEvent): void {
    e.preventDefault();
    try {
      this.root.setPointerCapture(e.pointerId);
    } catch {
      /* ignorado */
    }
    const x = e.clientX, y = e.clientY;
    if (this.editing) {
      const id = this.hitButton(x, y);
      if (!id) return;
      this.selected = id;
      const l = this.layout[id];
      this.pointers.set(e.pointerId, { kind: 'edit', id, dx: l.x * window.innerWidth - x, dy: l.y * window.innerHeight - y });
      this.refreshEditorBar();
      return;
    }
    if (!this.enabled) return;
    const id = this.hitButton(x, y);
    if (id) {
      const spec = BUTTONS.find(b => b.id === id)!;
      this.pointers.set(e.pointerId, { kind: 'button', spec, lx: x, ly: y });
      const el = this.buttons.get(id)!;
      const toggle = spec.toggle && (spec.action !== 'crouch' || this.crouchToggle);
      if (toggle) {
        if (this.toggles.has(id)) {
          this.toggles.delete(id);
          this.input.set(spec.action, false, 'touch:' + id);
          el.classList.remove('on');
        } else {
          this.toggles.add(id);
          this.input.set(spec.action, true, 'touch:' + id);
          el.classList.add('on');
        }
      } else {
        this.input.set(spec.action, true, 'touch:' + id);
        el.classList.add('pressed');
      }
      return;
    }
    // Metade esquerda: joystick dinâmico; resto da tela: câmera
    if (x < window.innerWidth * 0.42 && ![...this.pointers.values()].some(p => p.kind === 'joystick')) {
      this.pointers.set(e.pointerId, { kind: 'joystick', ox: x, oy: y });
      const d = this.layout.joystick.size * Math.min(window.innerWidth, window.innerHeight);
      this.joyBase.style.left = x - d / 2 + 'px';
      this.joyBase.style.top = y - d / 2 + 'px';
      this.joyBase.classList.add('active');
      this.setKnob(0, 0);
    } else {
      this.pointers.set(e.pointerId, { kind: 'look', lx: x, ly: y });
    }
  }

  private look(dx: number, dy: number): void {
    // Uma varrida da largura toda da tela = ~160° na sensibilidade 1 (independe da resolução)
    const k = (2.8 / Math.max(320, window.innerWidth)) * this.sensitivity * this.lookScale;
    this.input.addLook(dx * k, -dy * k * (this.invertY ? -1 : 1));
  }

  private onMove(e: PointerEvent): void {
    const role = this.pointers.get(e.pointerId);
    if (!role) return;
    e.preventDefault();
    const x = e.clientX, y = e.clientY;
    if (role.kind === 'edit') {
      const l = this.layout[role.id];
      l.x = Math.max(0.03, Math.min(0.97, (x + role.dx) / window.innerWidth));
      l.y = Math.max(0.05, Math.min(0.97, (y + role.dy) / window.innerHeight));
      this.applyLayout();
      return;
    }
    if (role.kind === 'look') {
      this.look(x - role.lx, y - role.ly);
      role.lx = x;
      role.ly = y;
    } else if (role.kind === 'button') {
      if (role.spec.look) this.look(x - role.lx, y - role.ly);
      role.lx = x;
      role.ly = y;
    } else if (role.kind === 'joystick') {
      const d = this.layout.joystick.size * Math.min(window.innerWidth, window.innerHeight);
      const radius = d * 0.4;
      let dx = (x - role.ox) / radius, dy = (y - role.oy) / radius;
      const m = Math.hypot(dx, dy);
      if (m > 1) {
        dx /= m;
        dy /= m;
      }
      this.setKnob(dx, dy);
      const mag = Math.min(1, m);
      const dead = 0.12;
      if (mag < dead) this.input.setMove('touch', 0, 0);
      else {
        const k = (mag - dead) / (1 - dead) / Math.max(1e-6, mag);
        this.input.setMove('touch', dx * k, -dy * k);
      }
    }
  }

  private setKnob(dx: number, dy: number): void {
    const d = this.layout.joystick.size * Math.min(window.innerWidth, window.innerHeight);
    this.joyKnob.style.transform = `translate(${dx * d * 0.4}px, ${dy * d * 0.4}px)`;
  }

  private onUp(e: PointerEvent): void {
    const role = this.pointers.get(e.pointerId);
    this.pointers.delete(e.pointerId);
    if (!role) return;
    if (role.kind === 'button') {
      const toggle = role.spec.toggle && (role.spec.action !== 'crouch' || this.crouchToggle);
      if (!toggle) {
        this.input.set(role.spec.action, false, 'touch:' + role.spec.id);
        this.buttons.get(role.spec.id)?.classList.remove('pressed');
      }
    } else if (role.kind === 'joystick') {
      this.input.setMove('touch', 0, 0);
      this.joyBase.classList.remove('active');
      this.setKnob(0, 0);
      this.applyLayout();
    } else if (role.kind === 'edit') {
      this.refreshEditorBar();
    }
  }

  releaseAll(): void {
    for (const [, role] of this.pointers) {
      if (role.kind === 'button') {
        this.input.set(role.spec.action, false, 'touch:' + role.spec.id);
        this.buttons.get(role.spec.id)?.classList.remove('pressed');
      }
    }
    this.pointers.clear();
    this.input.setMove('touch', 0, 0);
    this.joyBase.classList.remove('active');
    this.setKnob(0, 0);
  }

  // ------------------------------------------------------------ editor de layout

  openEditor(onClose: () => void): void {
    this.releaseAll();
    this.editing = true;
    this.onEditorClose = onClose;
    this.root.classList.remove('hidden');
    this.root.classList.add('editing');
    this.editorBar.classList.remove('hidden');
    this.refreshEditorBar();
  }

  private refreshEditorBar(): void {
    for (const [id, el] of this.buttons) el.classList.toggle('selected', this.editing && id === this.selected);
    this.joyBase.classList.toggle('selected', this.editing && this.selected === 'joystick');
    const l = this.layout[this.selected];
    const name = this.selected === 'joystick' ? 'JOYSTICK' : BUTTONS.find(b => b.id === this.selected)?.label ?? '';
    this.selectedLabel.textContent = name + (l.hidden ? ' (oculto)' : '');
    this.sizeSlider.value = String(l.size);
  }

  private closeEditor(): void {
    this.editing = false;
    this.root.classList.remove('editing');
    this.editorBar.classList.add('hidden');
    this.refreshEditorBar();
    Storage.save('touchLayout', this.layout);
    const cb = this.onEditorClose;
    this.onEditorClose = null;
    cb?.();
  }
}
