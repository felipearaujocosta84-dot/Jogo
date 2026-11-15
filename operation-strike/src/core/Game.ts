// Núcleo do jogo: motor 3D, cena, mapa, jogador, câmera, arma, efeitos, HUD e laço principal.
// Etapa 1: treino livre no mapa Dust Zone com movimentação completa, câmera, arma de treino e controles Android.
import { Engine, Scene, Vector3 } from './babylon';
import { InputState } from './Input';
import { KeyboardMouse } from './KeyboardMouse';
import { Quality } from './Quality';
import type { Settings } from './Settings';
import { MapBuilder, type Door, type MapInstance } from '../maps/MapBuilder';
import { MAPS, DEFAULT_MAP } from '../maps/maps';
import type { Team } from '../maps/MapTypes';
import { PlayerController, PLAYER } from '../player/PlayerController';
import { FirstPersonCamera } from '../camera/FirstPersonCamera';
import { ViewModel } from '../weapons/ViewModel';
import { WeaponSystem, type WeaponContext } from '../weapons/WeaponSystem';
import { ImpactEffects } from '../combat/ImpactEffects';
import { AudioManager } from '../audio/AudioManager';
import { Hud } from '../interface/Hud';
import { TouchControls } from '../interface/TouchControls';

const DEG = Math.PI / 180;
const MAX_STEP = 1 / 120;

export class Game {
  engine!: Engine;
  scene!: Scene;
  quality!: Quality;
  map!: MapInstance;
  player!: PlayerController;
  camera!: FirstPersonCamera;
  view!: ViewModel;
  weapons!: WeaponSystem;
  effects!: ImpactEffects;
  readonly input = new InputState();
  readonly audio = new AudioManager();
  readonly hud = new Hud();
  keyboard!: KeyboardMouse;
  touch!: TouchControls;

  paused = true;
  team: Team = 'T';
  private mapId = DEFAULT_MAP;
  private ctx!: WeaponContext;
  private lastTime = 0;
  private sinceRender = 0;
  private sessionTime = 0;
  private spawnIndex = 0;
  private fpsTimer = 0;
  private touchMode: boolean;
  /** Chamado quando o jogo pausa sozinho (perda do ponteiro, troca de app). */
  onAutoPause: (() => void) | null = null;

  constructor(private canvas: HTMLCanvasElement, private settings: Settings) {
    this.touchMode = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  }

  get isTouch(): boolean {
    return this.touchMode;
  }

  async init(onProgress: (pct: number, text: string) => void): Promise<void> {
    onProgress(5, 'Iniciando motor 3D');
    const lowStart = this.settings.get('quality') === 'low';
    this.engine = new Engine(this.canvas, !lowStart, {
      preserveDrawingBuffer: false,
      stencil: false,
      antialias: !lowStart,
      powerPreference: 'high-performance',
      adaptToDeviceRatio: false
    });
    this.engine.disableManifestCheck = true;
    this.quality = new Quality(this.engine, this.settings.get('quality'));
    this.scene = new Scene(this.engine);
    this.scene.skipPointerMovePicking = true;
    this.scene.autoClear = true;
    this.scene.autoClearDepthAndStencil = true;
    await nextFrame();

    onProgress(20, 'Construindo o mapa Dust Zone');
    this.camera = new FirstPersonCamera(this.scene);
    this.map = new MapBuilder(this.scene, MAPS[this.mapId], this.quality.preset).build();
    await nextFrame();

    onProgress(60, 'Preparando o operador');
    this.player = new PlayerController(this.map.world, {
      onFootstep: s => this.audio.footstep(s),
      onJump: () => this.audio.play('jump'),
      onLand: (impact, s) => {
        this.audio.land(impact, s);
        this.camera.land(impact);
      }
    });
    this.view = new ViewModel(this.scene, this.camera.camera);
    this.effects = new ImpactEffects(this.scene, this.quality.preset.decals, this.quality.preset.particles);
    this.ctx = { player: this.player, camera: this.camera, world: this.map.world, effects: this.effects, audio: this.audio, view: this.view };
    this.weapons = new WeaponSystem(this.ctx);
    await nextFrame();

    onProgress(80, 'Configurando controles');
    this.keyboard = new KeyboardMouse(this.canvas, this.input);
    this.keyboard.onPointerLockLost = () => {
      if (!this.paused && !this.touchMode) {
        this.pause();
        this.onAutoPause?.();
      }
    };
    this.touch = new TouchControls(document.getElementById('touchControls')!, this.input);
    this.hud.setMap(this.map);
    this.applySettings();
    this.settings.onChange(() => this.applySettings());

    window.addEventListener('resize', () => this.engine.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && !this.paused) {
        this.pause();
        this.onAutoPause?.();
      }
    });

    this.respawn('T');
    onProgress(95, 'Compilando shaders');
    // Primeiro quadro (compila shaders antes de mostrar o menu)
    this.camera.update(0, this.player);
    this.scene.render();
    await this.scene.whenReadyAsync();
    this.engine.runRenderLoop(() => this.frame());
    onProgress(100, 'Pronto');
  }

  applySettings(): void {
    const s = this.settings.data;
    if (this.quality.setMode(s.quality)) this.rebuildMap();
    this.camera.baseFov = s.fov;
    this.map.setRenderDistance(s.renderDistance);
    this.keyboard.sensitivity = s.mouseSensitivity;
    this.keyboard.invertY = s.invertY;
    this.touch.sensitivity = s.touchSensitivity;
    this.touch.invertY = s.invertY;
    this.touch.crouchToggle = s.crouchToggle;
    this.touch.setOpacity(s.buttonOpacity);
    this.audio.setVolume(s.volume);
    this.effects.setLimits(this.quality.preset.decals, this.quality.preset.particles);
    this.hud.setFps(s.showFps ? this.quality.averageFps : null);
  }

  /** Reconstrói o mapa com outro nível de qualidade (texturas, sombras, detalhes). */
  private rebuildMap(): void {
    if (!this.map) return;
    const pos = { ...this.player.position };
    this.map.dispose();
    this.map = new MapBuilder(this.scene, MAPS[this.mapId], this.quality.preset).build();
    this.player.setWorld(this.map.world);
    this.ctx.world = this.map.world;
    this.hud.setMap(this.map);
    this.player.position.x = pos.x;
    this.player.position.y = pos.y + 0.05;
    this.player.position.z = pos.z;
  }

  respawn(team: Team = this.team): void {
    this.team = team;
    const sp = this.map.spawn(team, this.spawnIndex++);
    this.player.teleport({ x: sp.x, y: 0.2, z: sp.z }, sp.yaw * DEG);
    this.weapons.refill();
    this.hud.message(team === 'T' ? 'Você nasceu na BASE TR' : 'Você nasceu na BASE CT', 2);
  }

  start(): void {
    this.audio.unlock();
    this.audio.startAmbient();
    this.resume();
  }

  resume(): void {
    this.paused = false;
    this.input.reset();
    this.audio.resume();
    this.keyboard.enabled = true;
    this.touch.enabled = true;
    this.touch.show(this.touchMode);
    this.hud.show(true);
    this.view.setVisible(true);
    if (!this.touchMode) this.keyboard.requestLock();
    this.lastTime = performance.now();
  }

  pause(): void {
    this.paused = true;
    this.input.reset();
    this.keyboard.enabled = false;
    this.keyboard.exitLock();
    this.touch.enabled = false;
    this.touch.releaseAll();
    this.audio.suspend();
  }

  /** Mostra o cenário atrás dos menus. */
  setMenuView(): void {
    this.hud.show(false);
    this.touch.show(false);
  }

  // ------------------------------------------------------------ laço principal

  private frame(): void {
    const now = performance.now();
    let dt = (now - (this.lastTime || now)) / 1000;
    this.lastTime = now;
    if (dt > 0.1) dt = 0.1;

    if (this.paused) {
      // Nos menus o cenário fica parado; desenha devagar para economizar bateria
      this.sinceRender += dt;
      if (this.sinceRender < 0.25) return;
      this.sinceRender = 0;
      this.scene.render();
      return;
    }

    // Limite de FPS opcional (economia de bateria)
    const cap = this.settings.get('fpsCap');
    this.sinceRender += dt;
    if (cap && this.sinceRender < 1 / cap - 0.002) return;
    const frameDt = Math.min(0.1, this.sinceRender);
    this.sinceRender = 0;

    this.update(frameDt);
    this.scene.render();
    this.quality.update(frameDt, cap || 60);
  }

  private update(dt: number): void {
    const s = this.settings.data;
    this.sessionTime += dt;
    const input = this.input;

    // Câmera (mouse/toque) — sensibilidade reduzida ao mirar
    const zoomScale = this.weapons.aiming ? s.aimSensitivity * this.camera.currentZoom : 1;
    this.keyboard.lookScale = zoomScale;
    this.touch.lookScale = zoomScale;
    const look = input.takeLook();
    this.player.look(look.yaw, look.pitch);
    this.view.addLook(look.yaw, look.pitch);

    // Física em subpassos fixos (estável em qualquer taxa de quadros)
    const steps = Math.max(1, Math.ceil(dt / MAX_STEP));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) this.player.update(h, input, input.isDown('crouch'));

    const p = this.player.position;
    const r = PLAYER.radius;
    this.map.update(dt, [{ x: p.x - r, y: p.y, z: p.z - r }, { x: p.x + r, y: p.y + this.player.height, z: p.z + r }]);

    this.weapons.update(dt, input);
    if (input.isDown('switch') && this.touch.isToggled('aim')) this.touch.clearToggle('aim');
    this.handleInteraction();

    this.camera.update(dt, this.player);
    const bob = this.camera.bob;
    this.view.update(dt, {
      aiming: this.weapons.aiming,
      crouched: this.player.crouched,
      speed: this.player.horizontalSpeed,
      onGround: this.player.onGround,
      bobPhase: bob.phase,
      bobAmount: bob.amount,
      landDip: bob.dip
    });

    // HUD
    const w = this.weapons.current;
    this.hud.setVitals(100, 0);
    this.hud.setAmmo(w.def.name, w.ammo, w.reserve, this.weapons.reloading);
    this.hud.setTimer(this.sessionTime);
    this.hud.setZone(this.map.zoneAt(p.x, p.z));
    const fovRad = this.camera.camera.fov;
    const gap = 4 + (Math.tan(this.weapons.spread * DEG) / Math.tan(fovRad / 2)) * (window.innerHeight / 2);
    this.hud.setCrosshair(Math.min(60, gap), s.crosshairColor, this.weapons.aiming && w.def.model === 'rifle' && this.camera.currentZoom < 0.8);
    this.hud.update(dt, p.x, p.z, this.player.yaw);
    this.fpsTimer += dt;
    if (s.showFps && this.fpsTimer > 0.5) {
      this.fpsTimer = 0;
      this.hud.setFps(this.quality.averageFps);
    }
    input.endFrame();
  }

  /** Portas e avisos de interação (botão USAR / tecla E). */
  private handleInteraction(): void {
    const p = this.player.position;
    const fwd = new Vector3(Math.sin(this.player.yaw), 0, Math.cos(this.player.yaw));
    let door: Door | null = null;
    let best = 3.2;
    for (const d of this.map.doors) {
      const dx = d.center.x - p.x, dz = d.center.z - p.z;
      const dist = Math.hypot(dx, dz);
      if (dist > best) continue;
      // precisa estar olhando mais ou menos na direção da porta
      if (dist > 0.8 && (dx * fwd.x + dz * fwd.z) / dist < 0.2) continue;
      best = dist;
      door = d;
    }
    const site = this.map.siteAt(p.x, p.z);
    const label = this.touchMode ? 'USAR' : 'E';
    if (door) this.hud.setPrompt(`[${label}] ${door.open ? 'Fechar' : 'Abrir'} porta`);
    else if (site) this.hud.setPrompt(`Ponto de bomba ${site} — o plantio chega na Etapa 5`);
    else this.hud.setPrompt(null);

    if (this.input.consume('interact')) {
      if (door) {
        const r = PLAYER.radius;
        const ok = this.map.toggleDoor(door, [
          { x: p.x - r, y: p.y, z: p.z - r },
          { x: p.x + r, y: p.y + this.player.height, z: p.z + r }
        ]);
        if (ok) this.audio.play('door');
        else this.hud.message('Saia do vão da porta para fechá-la', 1.5);
      } else {
        this.hud.message('Nada para usar aqui', 1.2);
      }
    }
  }
}

function nextFrame(): Promise<void> {
  return new Promise(r => requestAnimationFrame(() => r()));
}
