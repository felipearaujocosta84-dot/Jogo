// Teclado e mouse (PC). Usa Pointer Lock para girar a câmera sem limite.
import type { ActionName, InputState } from './Input';

const KEYMAP: Record<string, ActionName> = {
  Space: 'jump',
  ControlLeft: 'crouch',
  KeyC: 'crouch',
  ShiftLeft: 'sprint',
  ShiftRight: 'sprint',
  AltLeft: 'walk',
  AltRight: 'walk',
  KeyZ: 'walk',
  KeyR: 'reload',
  KeyF: 'inspect',
  KeyE: 'interact',
  KeyQ: 'switch',
  Digit1: 'slot1',
  Digit2: 'slot2',
  Digit3: 'slot3',
  Digit4: 'slot4',
  Digit5: 'slot5',
  KeyB: 'buy',
  Tab: 'score'
};

export class KeyboardMouse {
  private keys = new Set<string>();
  sensitivity = 1;
  invertY = false;
  /** Multiplicador extra (mira com zoom). */
  lookScale = 1;
  enabled = false;
  onPointerLockLost: (() => void) | null = null;

  constructor(private canvas: HTMLCanvasElement, private input: InputState) {
    window.addEventListener('keydown', e => this.onKey(e, true));
    window.addEventListener('keyup', e => this.onKey(e, false));
    window.addEventListener('blur', () => this.releaseAll());
    canvas.addEventListener('mousedown', e => this.onMouse(e, true));
    window.addEventListener('mouseup', e => this.onMouse(e, false));
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('wheel', e => {
      if (this.enabled && this.locked) input.set('switch', true, 'wheel'), input.set('switch', false, 'wheel');
      e.preventDefault();
    }, { passive: false });
    document.addEventListener('mousemove', e => {
      if (!this.enabled || !this.locked) return;
      const k = 0.0022 * this.sensitivity * this.lookScale;
      input.addLook(e.movementX * k, -e.movementY * k * (this.invertY ? -1 : 1));
    });
    document.addEventListener('pointerlockchange', () => {
      if (!this.locked) {
        this.releaseAll();
        if (this.enabled && !this.uiOpen) this.onPointerLockLost?.();
      }
    });
  }

  get locked(): boolean {
    return document.pointerLockElement === this.canvas;
  }

  requestLock(): void {
    if (this.locked) return;
    try {
      const r = this.canvas.requestPointerLock() as unknown;
      if (r && typeof (r as Promise<void>).catch === 'function') (r as Promise<void>).catch(() => {});
    } catch {
      /* navegador sem suporte */
    }
  }

  exitLock(): void {
    if (this.locked) document.exitPointerLock();
  }

  private onKey(e: KeyboardEvent, down: boolean): void {
    if (!this.enabled) return;
    if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
    if (down) this.keys.add(e.code);
    else this.keys.delete(e.code);
    const action = KEYMAP[e.code];
    if (action) {
      if (!(down && e.repeat)) this.input.set(action, down, 'key:' + e.code);
      e.preventDefault();
    }
    this.updateMove();
  }

  /** Interface aberta (loja): cliques vão para os menus, não para a arma. */
  uiOpen = false;

  private onMouse(e: MouseEvent, down: boolean): void {
    if (!this.enabled || this.uiOpen) return;
    if (down && !this.locked) {
      this.requestLock();
      return;
    }
    if (e.button === 0) this.input.set('fire', down, 'mouse');
    if (e.button === 2) {
      this.input.set('aim', down, 'mouse');
      this.input.set('zoom', down, 'mouse');
    }
  }

  private updateMove(): void {
    const k = this.keys;
    const x = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    const y = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    this.input.setMove('keyboard', x, y);
  }

  releaseAll(): void {
    this.keys.clear();
    for (const a of Object.values(KEYMAP)) for (const code of Object.keys(KEYMAP)) this.input.set(a, false, 'key:' + code);
    this.input.set('fire', false, 'mouse');
    this.input.set('aim', false, 'mouse');
    this.input.set('zoom', false, 'mouse');
    this.updateMove();
  }
}
