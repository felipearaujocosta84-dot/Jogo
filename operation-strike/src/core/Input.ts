// Estado de entrada unificado. Teclado/mouse e controles de toque escrevem aqui;
// o jogador e a arma apenas leem. Assim a lógica do jogo não depende do tipo de dispositivo.

export type ActionName =
  | 'fire'
  | 'aim'
  | 'reload'
  | 'jump'
  | 'crouch'
  | 'walk'
  | 'switch'
  | 'interact'
  | 'inspect'
  | 'slot1'
  | 'slot2'
  | 'slot3'
  | 'slot4'
  | 'slot5'
  | 'zoom'
  | 'buy'
  | 'score'
  | 'drop';

export class InputState {
  /** Movimento por fonte (teclado, joystick), somado e limitado a magnitude 1. */
  private moves = new Map<string, [number, number]>();
  /** Rotação acumulada da câmera desde o último quadro (radianos). */
  lookYaw = 0;
  lookPitch = 0;

  private held = new Set<ActionName>();
  private pressed = new Set<ActionName>();
  /** Fontes que seguram cada ação (ex.: tecla e botão de toque ao mesmo tempo). */
  private holders = new Map<ActionName, Set<string>>();

  /** Liga/desliga uma ação vinda de uma fonte (tecla, botão de toque, mouse...). */
  set(action: ActionName, down: boolean, source = 'default'): void {
    let set = this.holders.get(action);
    if (!set) this.holders.set(action, (set = new Set()));
    const wasHeld = set.size > 0;
    if (down) set.add(source);
    else set.delete(source);
    const isHeld = set.size > 0;
    if (isHeld && !wasHeld) {
      this.held.add(action);
      this.pressed.add(action);
    } else if (!isHeld && wasHeld) {
      this.held.delete(action);
    }
  }

  /** Ação mantida pressionada. */
  isDown(action: ActionName): boolean {
    return this.held.has(action);
  }

  /** Ação pressionada neste quadro (consumida ao ler). */
  consume(action: ActionName): boolean {
    if (!this.pressed.has(action)) return false;
    this.pressed.delete(action);
    return true;
  }

  setMove(source: string, x: number, y: number): void {
    if (x === 0 && y === 0) this.moves.delete(source);
    else this.moves.set(source, [x, y]);
  }

  /** Movimento desejado: x = lateral (direita +). */
  get moveX(): number {
    return this.sumMove()[0];
  }

  /** Movimento desejado: y = frente (+). */
  get moveY(): number {
    return this.sumMove()[1];
  }

  private sumMove(): [number, number] {
    let x = 0, y = 0;
    for (const [mx, my] of this.moves.values()) {
      x += mx;
      y += my;
    }
    const m = Math.hypot(x, y);
    if (m > 1) {
      x /= m;
      y /= m;
    }
    return [x, y];
  }

  addLook(yaw: number, pitch: number): void {
    this.lookYaw += yaw;
    this.lookPitch += pitch;
  }

  takeLook(): { yaw: number; pitch: number } {
    const r = { yaw: this.lookYaw, pitch: this.lookPitch };
    this.lookYaw = 0;
    this.lookPitch = 0;
    return r;
  }

  /** Limpa tudo (pausa, perda de foco). */
  reset(): void {
    this.held.clear();
    this.pressed.clear();
    this.holders.clear();
    this.moves.clear();
    this.lookYaw = this.lookPitch = 0;
  }

  /** Descarta toques rápidos que não foram usados neste quadro. */
  endFrame(): void {
    this.pressed.clear();
  }
}
