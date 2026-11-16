// Núcleo do jogo no navegador: motor 3D, cena, sessão (local ou online), mapa, personagens,
// câmera, arma em primeira pessoa, efeitos, áudio, HUD, loja, placar e laço principal.
import { Engine, Scene, Vector3, Matrix } from './babylon';
import { InputState } from './Input';
import { KeyboardMouse } from './KeyboardMouse';
import { Quality } from './Quality';
import type { Settings } from './Settings';
import type { Session, ViewState } from './Session';
import { MapBuilder, type MapVisual } from '../maps/MapBuilder';
import { MapRuntime } from '../maps/MapRuntime';
import { MAPS, DEFAULT_MAP } from '../maps/maps';
import { FirstPersonCamera } from '../camera/FirstPersonCamera';
import { ViewModel } from '../weapons/ViewModel';
import { ImpactEffects } from '../combat/ImpactEffects';
import { Effects } from '../combat/Effects';
import { AudioManager } from '../audio/AudioManager';
import { Hud } from '../interface/Hud';
import { TouchControls } from '../interface/TouchControls';
import { Scoreboard } from '../interface/Scoreboard';
import { BuyMenu } from '../interface/BuyMenu';
import { CharacterModel } from '../player/CharacterModel';
import { WEAPONS } from '../weapons/WeaponData';
import { skinById } from '../weapons/Skins';
import { SkinPrefs } from '../save/SkinPrefs';
import { WeaponLibrary } from '../weapons/WeaponLibrary';
import { setWeaponMaterialQuality } from '../weapons/WeaponModels';
import { applyStudioEnvironment } from './Environment';
import { PostFx } from './Graphics';
import { LobbyScene } from '../interface/LobbyScene';
import { weaponConfigs, assetExists, ASSET_BASE } from '../assets/AssetRegistry';
import { PLAYER } from '../player/PlayerController';
import { BTN, type PlayerView, type SimEvent, type Team, type UserCmd } from '../sim/types';
import type { SurfaceKind } from '../physics/CollisionWorld';
import type { RadarDot } from '../interface/Radar';

const DEG = Math.PI / 180;

export class Game {
  engine!: Engine;
  scene!: Scene;
  quality!: Quality;
  camera!: FirstPersonCamera;
  view!: ViewModel;
  decals!: ImpactEffects;
  fx!: Effects;
  readonly input = new InputState();
  readonly audio = new AudioManager();
  readonly hud = new Hud();
  readonly scoreboard = new Scoreboard();
  readonly buyMenu = new BuyMenu();
  keyboard!: KeyboardMouse;
  library!: WeaponLibrary;
  touch!: TouchControls;

  session: Session | null = null;
  paused = true;
  private mapVisual: MapVisual | null = null;
  private mapRuntime: MapRuntime | null = null;
  private visualMapId = '';
  private chars = new Map<string, { model: CharacterModel; team: Team; variant: number; step: number; reloadAt: number; reloadDur: number; lastX: number; lastZ: number }>();
  private look = { yaw: 0, pitch: 0 };
  private wasAlive = false;
  private spectateIdx = 0;
  private lastTime = 0;
  private sinceRender = 0;
  private fpsTimer = 0;
  private touchMode: boolean;
  private lastWeapon = '';
  private lastPhase = '';
  private beepT = 0;
  private plantSoundT = 0;
  private seenEnemy = new Map<string, number>();
  private cmdsThisFrame = 0;
  private time = 0;
  private lastState: ViewState | null = null;
  private landWatch = { ground: true, vy: 0 };
  onAutoPause: (() => void) | null = null;
  onMatchOver: ((s: Session) => void) | null = null;

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
    this.quality.dynamic = this.settings.get('dynamicResolution');
    // modo automático: se o aparelho não aguentar, reduz o nível e reconstrói o cenário
    this.quality.onAutoDowngrade = () => this.applyQualityLevel();
    this.scene = new Scene(this.engine);
    this.scene.skipPointerMovePicking = true;
    await nextFrame();
    this.camera = new FirstPersonCamera(this.scene);
    this.view = new ViewModel(this.scene, this.camera.camera);
    // reflexos para os materiais PBR das armas + biblioteca de modelos GLB (carrega sob demanda)
    applyStudioEnvironment(this.scene);
    this.library = new WeaponLibrary(this.scene);
    this.configureLibrary();
    void weaponConfigs().then(cfg => this.view.setLibrary(this.library.enabled ? this.library : null, (cfg as Record<string, object>).hands ?? {}));
    this.decals = new ImpactEffects(this.scene, this.quality.preset.decals, this.quality.preset.particles);
    this.fx = new Effects(this.scene, this.quality.preset.particles);
    this.fx.setDynamicLights(this.quality.preset.dynamicLights);
    CharacterModel.pbr = this.quality.preset.pbr;
    this.postFx = new PostFx(this.scene, this.camera.camera);
    this.postFx.apply(this.quality.preset);
    onProgress(18, 'Montando o lobby');
    this.lobby = new LobbyScene(this.engine, this.quality.preset);
    onProgress(25, 'Construindo o cenário');
    this.loadMapVisual(DEFAULT_MAP);
    await nextFrame();
    onProgress(70, 'Configurando controles');
    this.keyboard = new KeyboardMouse(this.canvas, this.input);
    this.keyboard.onPointerLockLost = () => {
      if (!this.paused && !this.touchMode && !this.buyMenu.open) {
        this.pause();
        this.onAutoPause?.();
      }
    };
    this.touch = new TouchControls(document.getElementById('touchControls')!, this.input);
    this.buyMenu.skinOf = id => SkinPrefs.get(id);
    this.buyMenu.onSkin = (id, dir) => {
      SkinPrefs.cycle(id, dir);
      this.session?.setSkins(SkinPrefs.all);
    };
    this.buyMenu.onBuy = item => {
      const err = this.session?.buy(item);
      if (err) {
        this.hud.message(err, 1.5);
        this.audio.play('error');
      }
    };
    this.buyMenu.onClose = () => {
      this.keyboard.uiOpen = false;
      if (!this.paused && !this.touchMode) this.keyboard.requestLock();
    };
    this.applySettings();
    this.settings.onChange(() => this.applySettings());
    window.addEventListener('resize', () => this.engine.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && !this.paused) {
        this.pause();
        this.onAutoPause?.();
      }
    });
    // vista do menu
    this.camera.update(0, { x: 0, y: 4, z: -30 }, 0.3, 0.05, 0, true);
    this.view.setVisible(false);
    onProgress(90, 'Compilando shaders');
    this.scene.render();
    await this.scene.whenReadyAsync();
    this.engine.runRenderLoop(() => this.frame());
    onProgress(100, 'Pronto');
  }

  /** Qualidade dos modelos de arma: baixa = modelos leves e material simples; média/alta = GLB + PBR. */
  private configureLibrary(): void {
    const level = this.quality.level;
    const lib = this.library;
    lib.enabled = level !== 'low';
    lib.maxLoaded = level === 'ultra' ? 8 : level === 'high' ? 6 : 4;
    lib.textureSize = level === 'high' || level === 'ultra' ? 2048 : 1024;
    setWeaponMaterialQuality(level !== 'low');
  }

  applySettings(): void {
    const s = this.settings.data;
    this.quality.dynamic = s.dynamicResolution;
    if (this.quality.setMode(s.quality)) this.applyQualityLevel();
    this.camera.baseFov = s.fov;
    this.mapVisual?.setRenderDistance(s.renderDistance);
    this.keyboard.sensitivity = s.mouseSensitivity;
    this.keyboard.invertY = s.invertY;
    this.touch.sensitivity = s.touchSensitivity;
    this.touch.invertY = s.invertY;
    this.touch.crouchToggle = s.crouchToggle;
    this.touch.setOpacity(s.buttonOpacity);
    this.audio.setVolume(s.volume);
    this.decals.setLimits(this.quality.preset.decals, this.quality.preset.particles);
    this.fx.setMaxParticles(this.quality.preset.particles);
    if (this.library) {
      const was = this.library.enabled;
      this.configureLibrary();
      if (was !== this.library.enabled) void weaponConfigs().then(cfg => this.view.setLibrary(this.library.enabled ? this.library : null, (cfg as Record<string, object>).hands ?? {}));
    }
    this.hud.setFps(s.showFps ? this.quality.averageFps : null);
  }

  private postFx!: PostFx;
  /** Cena 3D do menu principal (renderizada no lugar da partida enquanto não há sessão). */
  lobby: LobbyScene | null = null;

  /** Reconfigura tudo que depende do nível de qualidade (cenário, pós-processamento, luzes, materiais). */
  private applyQualityLevel(): void {
    const p = this.quality.preset;
    this.postFx?.apply(p);
    this.fx?.setDynamicLights(p.dynamicLights);
    this.fx?.setMaxParticles(p.particles);
    this.decals?.setLimits(p.decals, p.particles);
    if (CharacterModel.pbr !== p.pbr) {
      CharacterModel.pbr = p.pbr;
      for (const c of this.chars.values()) c.model.dispose();
      this.chars.clear(); // recriados no próximo quadro com o material novo
    }
    if (this.library) this.configureLibrary();
    if (this.lobby) {
      // recria o lobby com os materiais/sombras do novo nível, mantendo o agente e a arma
      const old = this.lobby;
      const next = new LobbyScene(this.engine, p);
      next.active = old.active;
      next.setLoadout(old.team, old.variant, old.weapon, old.skin);
      old.dispose();
      this.lobby = next;
    }
    if (this.visualMapId) {
      const id = this.visualMapId;
      this.visualMapId = '';
      this.loadMapVisual(id, this.session?.map);
    }
  }

  private loadMapVisual(mapId: string, runtime?: MapRuntime): void {
    if (this.visualMapId === mapId && runtime === this.mapRuntime) return;
    if (this.visualMapId !== mapId || !this.mapVisual) {
      this.mapVisual?.dispose();
      this.mapRuntime = runtime ?? new MapRuntime(MAPS[mapId]);
      this.mapVisual = new MapBuilder(this.scene, this.mapRuntime, this.quality.preset).build();
      this.visualMapId = mapId;
      this.mapVisual.setRenderDistance(this.settings.get('renderDistance'));
    } else if (runtime) {
      // mesmo mapa, novo runtime (portas da sessão)
      this.mapRuntime = runtime;
      this.mapVisual.dispose();
      this.mapVisual = new MapBuilder(this.scene, runtime, this.quality.preset).build();
      this.mapVisual.setRenderDistance(this.settings.get('renderDistance'));
    }
    this.hud.setMap(this.mapRuntime!);
  }

  // ------------------------------------------------------------------ sessões

  private weaponSoundsLoaded = false;

  /** Carrega sons gravados de tiro que existirem em public/assets/audio/weapons/. */
  private loadWeaponSounds(): void {
    if (this.weaponSoundsLoaded) return;
    this.weaponSoundsLoaded = true;
    for (const id of Object.keys(WEAPONS)) {
      for (const ext of ['mp3', 'ogg']) {
        const path = `audio/weapons/${id}_fire.${ext}`;
        void assetExists(path).then(ok => {
          if (ok) void this.audio.load('fire_' + id, ASSET_BASE + path);
        });
      }
    }
  }

  startSession(s: Session): void {
    this.endSession();
    this.session = s;
    this.visualMapId = '';
    this.loadMapVisual(s.map.def.id, s.map);
    this.hud.clearFeed();
    this.wasAlive = false;
    this.lastPhase = '';
    this.lastWeapon = '';
    this.seenEnemy.clear();
    this.audio.unlock();
    this.loadWeaponSounds();
    this.audio.startAmbient();
    this.resume();
  }

  endSession(): void {
    for (const c of this.chars.values()) c.model.dispose();
    this.chars.clear();
    this.fx.clearRound();
    this.session?.dispose();
    this.session = null;
    this.buyMenu.toggle(false);
    this.scoreboard.toggle(false);
    this.view.setVisible(false);
    this.hud.show(false);
    this.touch.show(false);
    this.audio.stopAmbient();
    this.scene.render(); // tira a arma da tela imediatamente (fundo dos menus)
  }

  resume(): void {
    this.paused = false;
    this.input.reset();
    this.audio.resume();
    this.keyboard.enabled = true;
    this.touch.enabled = true;
    this.touch.show(this.touchMode);
    this.hud.show(true);
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
    this.buyMenu.toggle(false);
    this.scoreboard.toggle(false);
    // online a partida continua no servidor; offline ela congela
    if (!this.session?.online) this.audio.suspend();
  }

  setMenuView(): void {
    this.hud.show(false);
    this.touch.show(false);
  }

  // ------------------------------------------------------------------ laço

  private frame(): void {
    const now = performance.now();
    let dt = (now - (this.lastTime || now)) / 1000;
    this.lastTime = now;
    if (dt > 0.1) dt = 0.1;
    const s = this.session;
    if (this.paused && !s && this.lobby?.active) {
      // menu principal: cena do lobby (até 60 qps, respeitando o limite escolhido)
      const cap = Math.min(60, this.settings.get('fpsCap') || 60);
      this.sinceRender += dt;
      if (this.sinceRender < 1 / cap - 0.002) return;
      const ldt = Math.min(0.1, this.sinceRender);
      this.sinceRender = 0;
      this.lobby.render(ldt);
      this.quality.update(ldt, cap);
      return;
    }
    if (this.paused) {
      // menus: offline a cena fica parada; online a simulação segue (sem comandos)
      if (s?.online) s.update(dt, () => this.idleCmd());
      this.sinceRender += dt;
      if (this.sinceRender < (s?.online ? 0.05 : 0.25)) return;
      this.sinceRender = 0;
      if (s) this.updateWorld(0.05, s.view(), s.drainEvents());
      this.scene.render();
      return;
    }
    const cap = this.settings.get('fpsCap');
    this.sinceRender += dt;
    if (cap && this.sinceRender < 1 / cap - 0.002) return;
    const frameDt = Math.min(0.1, this.sinceRender);
    this.sinceRender = 0;
    this.update(frameDt);
    this.scene.render();
    this.quality.update(frameDt, cap || 60);
  }

  private idleCmd(): UserCmd {
    return { seq: 0, mx: 0, my: 0, yaw: this.look.yaw, pitch: this.look.pitch, buttons: 0, sel: 0 };
  }

  private makeCmd = (): UserCmd => {
    this.cmdsThisFrame++;
    const i = this.input;
    const ui = this.buyMenu.open;
    let b = 0;
    if (!ui && i.isDown('fire')) b |= BTN.FIRE;
    if (!ui && i.isDown('aim')) b |= BTN.AIM;
    if (i.consume('reload')) b |= BTN.RELOAD;
    if (i.isDown('jump') || i.consume('jump')) b |= BTN.JUMP;
    if (i.isDown('crouch')) b |= BTN.CROUCH;
    if (i.isDown('walk')) b |= BTN.WALK;
    if (i.isDown('sprint')) b |= BTN.SPRINT;
    if (i.isDown('interact') || i.consume('interact')) b |= BTN.USE;
    if (i.consume('zoom')) b |= BTN.ZOOM;
    if (i.consume('switch')) b |= BTN.NEXT;
    let sel = 0;
    if (i.consume('slot1')) sel = 1;
    else if (i.consume('slot2')) sel = 2;
    else if (i.consume('slot3')) sel = 3;
    else if (i.consume('slot4')) sel = 4;
    else if (i.consume('slot5')) sel = 5;
    return { seq: 0, mx: i.moveX, my: i.moveY, yaw: this.look.yaw, pitch: this.look.pitch, buttons: b, sel };
  };

  private update(dt: number): void {
    const s = this.session;
    if (!s) return;
    this.time += dt;
    const set = this.settings.data;
    const local = s.local();
    const i = this.input;

    // interface (loja / placar / inspeção)
    if (i.consume('buy')) this.toggleBuy();
    const sbHeld = i.isDown('score');
    if (sbHeld !== this.scoreboard.open) this.scoreboard.toggle(sbHeld);
    if (i.consume('inspect') && local?.alive && this.view.inspect()) {
      const wid = local.weaponId();
      this.hud.message(`${WEAPONS[wid]?.name ?? wid} | ${skinById(local.skinOf(wid)).name}`, 2.5);
    }

    // mira (sensibilidade menor com zoom)
    const zoomScale = this.camera.currentZoom < 0.98 ? set.aimSensitivity * this.camera.currentZoom : 1;
    this.keyboard.lookScale = zoomScale;
    this.touch.lookScale = zoomScale;
    const look = i.takeLook();
    if (local?.alive) {
      this.look.yaw += look.yaw;
      this.look.pitch = Math.max(-1.53, Math.min(1.53, this.look.pitch + look.pitch));
      if (this.look.yaw > Math.PI) this.look.yaw -= Math.PI * 2;
      else if (this.look.yaw < -Math.PI) this.look.yaw += Math.PI * 2;
      this.view.addLook(look.yaw, look.pitch);
    } else if (look.yaw > 0.15 || i.consume('fire')) {
      this.spectateIdx++;
    }

    // simulação / previsão
    this.cmdsThisFrame = 0;
    s.update(dt, this.makeCmd);
    if (this.cmdsThisFrame > 0) i.endFrame();
    const st = s.view();
    this.updateWorld(dt, st, s.drainEvents());
  }

  private toggleBuy(): void {
    const st = this.lastState;
    if (!this.buyMenu.open && !st?.you?.canBuy) {
      this.hud.message(st?.round.mode === 'training' ? 'Loja indisponível' : 'Só é possível comprar na base, no início da rodada', 1.6);
      return;
    }
    this.buyMenu.toggle();
    if (this.buyMenu.open) {
      this.keyboard.uiOpen = true;
      this.keyboard.exitLock();
      this.input.set('fire', false, 'mouse');
    }
  }

  /** Atualiza tudo o que é desenhado a partir do estado da partida. */
  private updateWorld(dt: number, st: ViewState, events: SimEvent[]): void {
    const s = this.session!;
    this.lastState = st;
    const local = s.local();
    const me = st.players.find(p => p.id === s.localId) ?? null;
    const set = this.settings.data;

    // renascimento: a mira volta para a direção do ponto de nascimento
    if (local && local.alive && !this.wasAlive) {
      this.look.yaw = local.ctrl.yaw;
      this.look.pitch = 0;
      this.lastWeapon = '';
      this.camera.setZoom(1, true);
      this.view.setTeam(local.team);
    }
    this.wasAlive = !!local?.alive;

    // mudança de fase
    if (st.round.phase !== this.lastPhase) this.onPhase(st, me);

    for (const e of events) this.handleEvent(e, st, me);

    // câmera
    const alive = !!(local && local.alive);
    let camX = 0, camZ = 0, camYaw = this.look.yaw;
    if (alive && local) {
      const c = local.ctrl;
      const a = s.alpha;
      const eye = { x: s.prevPos.x + (c.position.x - s.prevPos.x) * a, y: s.prevPos.y + (c.eyeY - s.prevPos.y) * a, z: s.prevPos.z + (c.position.z - s.prevPos.z) * a };
      const you = st.you;
      const punchP = (you?.punchPitch ?? 0) * DEG, punchY = (you?.punchYaw ?? 0) * DEG;
      // aterrissagem
      if (c.onGround && !this.landWatch.ground && this.landWatch.vy < -3) {
        this.camera.land(-this.landWatch.vy);
        this.audio.land(-this.landWatch.vy, c.groundSurface);
      }
      this.landWatch = { ground: c.onGround, vy: c.velocity.y };
      const lateral = c.velocity.x * Math.cos(this.look.yaw) - c.velocity.z * Math.sin(this.look.yaw);
      this.camera.tiltEnabled = this.settings.get('cameraTilt');
      this.camera.update(dt, eye, this.look.yaw + punchY, this.look.pitch + punchP, c.horizontalSpeed, c.onGround, lateral, c.sprintT);
      camX = eye.x;
      camZ = eye.z;
      // zoom: luneta ou mira
      const w = local.weapon;
      const scoped = w.scope && (you?.scope ?? 0) > 0;
      if (scoped) this.camera.setZoom(w.zoom[(you!.scope - 1) | 0] ?? 0.4);
      else if (local.input.isDown('aim') && w.cls !== 'knife' && w.cls !== 'grenade' && w.cls !== 'c4' && !w.scope) this.camera.setZoom(w.zoom[0]);
      else this.camera.setZoom(1);
      this.hud.setScope(scoped);
      // arma em primeira pessoa
      const wid = local.weaponId();
      const wskin = local.skinOf(wid);
      if (wid + '|' + wskin !== this.lastWeapon) {
        const sameGun = this.lastWeapon.startsWith(wid + '|');
        this.lastWeapon = wid + '|' + wskin;
        this.view.setWeapon(wid, w.drawTime, wskin);
        if (this.lastPhase !== '' && !sameGun) this.audio.play('draw');
      }
      this.view.plant(local.act === 2 || local.act === 3);
      this.view.setVisible(!scoped);
      const bob = this.camera.bob;
      this.view.update(dt, { aiming: local.input.isDown('aim') && !w.scope, crouched: c.crouched, speed: c.horizontalSpeed + c.sprintT * 2, onGround: c.onGround, bobPhase: bob.phase, bobAmount: bob.amount, landDip: bob.dip });
      // passos do próprio jogador
      const ch = this.footstepTracker('local', c.horizontalSpeed, c.onGround, dt);
      if (ch) this.audio.footstep(c.groundSurface);
      this.hud.setSpectate(null);
    } else {
      // espectador
      this.view.setVisible(false);
      this.hud.setScope(false);
      const myTeam = me?.team ?? 'T';
      const pool = st.players.filter(p => p.alive && p.team === myTeam);
      const list = pool.length ? pool : st.players.filter(p => p.alive);
      const target = list.length ? list[this.spectateIdx % list.length] : null;
      if (target) {
        this.camera.spectate(dt, target, target.yaw, target.pitch, s.map.world);
        camX = target.x;
        camZ = target.z;
        camYaw = target.yaw;
        this.hud.setSpectate(target.name);
      } else {
        this.camera.spectate(dt, me ?? { x: 0, y: 0, z: 0 }, this.look.yaw, -0.3, s.map.world);
        this.hud.setSpectate(null);
      }
    }
    this.audio.setListener(this.camera.camera.position.x, this.camera.camera.position.y, this.camera.camera.position.z, camYaw);

    // personagens
    const seen = new Set<string>();
    for (const p of st.players) {
      seen.add(p.id);
      let c = this.chars.get(p.id);
      if (!c || c.team !== p.team || c.variant !== p.variant) {
        c?.model.dispose();
        const model = new CharacterModel(this.scene, p.team, p.variant, this.mapVisual?.shadow ?? null);
        c = { model, team: p.team, variant: p.variant, step: 0, reloadAt: -10, reloadDur: 1, lastX: p.x, lastZ: p.z };
        this.chars.set(p.id, c);
      }
      const isMe = p.id === s.localId;
      c.model.setVisible(!(isMe && alive));
      if (isMe && alive) continue;
      const reloadT = this.time - c.reloadAt < c.reloadDur ? (this.time - c.reloadAt) / c.reloadDur : 0;
      c.model.update(dt, p, reloadT);
      c.model.setProtected(!!p.prot && p.alive, this.time);
      c.model.victory = (st.round.phase === 'end' || st.round.phase === 'over') && st.round.lastWinner === p.team && p.alive;
      // passos dos outros (som espacial)
      if (p.alive && this.footstepTracker(p.id, Math.hypot(p.vx, p.vz), p.ground, dt)) {
        const surf: SurfaceKind = s.map.zoneAt(p.x, p.z) ? 'stone' : 'sand';
        this.audio.footstep(surf, { x: p.x, y: p.y, z: p.z });
      }
    }
    for (const [id, c] of this.chars) if (!seen.has(id)) {
      c.model.dispose();
      this.chars.delete(id);
    }

    // mapa, efeitos e bomba
    if (s.online) s.map.update(dt, []);
    this.mapVisual?.update();
    this.fx.sync(st.nades, st.bomb, !!local?.c4 && alive);
    this.fx.update(dt);
    if (st.bomb.state === 'planted') {
      this.beepT -= dt;
      const interval = st.bomb.timeLeft > 20 ? 1 : st.bomb.timeLeft > 10 ? 0.6 : st.bomb.timeLeft > 5 ? 0.3 : 0.15;
      if (this.beepT <= 0) {
        this.beepT = interval;
        this.audio.beep(st.bomb, st.bomb.timeLeft < 10);
      }
    }

    // HUD
    if (me) {
      this.hud.setVitals(me.hp, me.armor, me.helmet, me.kit, me.bomb, me.money);
    }
    const you = st.you;
    if (you && local) {
      this.hud.setAmmo(local.weaponId(), you.ammo, you.reserve, you.reloading, you.slots, you.active);
      const fovRad = this.camera.camera.fov;
      const gap = 4 + (Math.tan(you.spread * DEG) / Math.tan(fovRad / 2)) * (window.innerHeight / 2);
      const scoped = local.weapon.scope && you.scope > 0;
      const hideCross = !alive || scoped || (local.weapon.scope && !scoped) || (local.input.isDown('aim') && local.weapon.cls !== 'pistol' && local.weapon.cls !== 'knife' && local.weapon.cls !== 'grenade' && this.camera.currentZoom < 0.9);
      this.hud.setCrosshair(Math.min(60, gap), set.crosshairColor, hideCross);
      this.hud.setFlash(you.flash);
      if (you.plantProgress > 0) this.hud.setProgress('PLANTANDO A BOMBA', you.plantProgress);
      else if (you.defuseProgress > 0) this.hud.setProgress(me?.kit ? 'DESARMANDO (KIT)' : 'DESARMANDO', you.defuseProgress);
      else this.hud.setProgress(null, 0);
      if (you.plantProgress > 0 || you.defuseProgress > 0) {
        this.plantSoundT -= dt;
        if (this.plantSoundT <= 0) {
          this.plantSoundT = 0.25;
          if (you.plantProgress > 0) this.audio.plantTick();
          else this.audio.defuseTick();
        }
      }
      const buyLabel = this.touchMode ? 'COMPRAR' : '[B] COMPRAR';
      this.hud.setBuyHint(you.canBuy && st.round.mode !== 'training' ? (st.round.mode === 'tdm' ? `${buyLabel} · trocar arma na base` : `${buyLabel} · ${Math.ceil(st.round.buyTimeLeft)}s`) : null);
      this.buyMenu.update(
        {
          team: local.team, money: me?.money ?? 0, primary: local.primary?.id, secondary: local.secondary?.id,
          armor: me?.armor ?? 0, helmet: !!me?.helmet, kit: !!me?.kit, nades: { ...local.nades }
        },
        you.canBuy,
        st.round.mode === 'training' || st.round.mode === 'tdm' ? 999 : st.round.buyTimeLeft
      );
    }
    this.hud.setRound(st.round, st.bomb.state === 'planted');
    this.hud.setAlive(st.players);
    this.hud.setZone(alive && local ? s.map.zoneAt(local.ctrl.position.x, local.ctrl.position.z) : '');
    this.updatePrompt(st, me);
    this.scoreboard.update(st.players, st.round, s.localId, me?.team ?? 'T', s.online);
    this.hud.update(dt, camX, camZ, camYaw, this.radarDots(st, me));
    if (set.nameTags) this.updateTags(st, me);
    else this.hud.setTags([]);
    this.fpsTimer += dt;
    if (set.showFps && this.fpsTimer > 0.5) {
      this.fpsTimer = 0;
      this.hud.setFps(this.quality.averageFps);
    }
    if (s.online) {
      const net = (s as unknown as { net: { rtt: number; status: string } }).net;
      this.hud.setNet(net.status === 'conectado' ? `ping ${Math.round(net.rtt)} ms` : net.status);
    } else this.hud.setNet(null);

    if (st.round.phase === 'over' && s.result && this.onMatchOver) {
      const cb = this.onMatchOver;
      this.onMatchOver = null;
      setTimeout(() => cb(s), 2500);
    }
  }

  private footsteps = new Map<string, number>();

  /** Acumula a distância percorrida e avisa quando é hora de um passo audível. */
  private footstepTracker(id: string, speed: number, ground: boolean, dt: number): boolean {
    if (!ground || speed < PLAYER.quietSpeed) {
      this.footsteps.set(id, PLAYER.stepDistance * 0.5);
      return false;
    }
    const acc = (this.footsteps.get(id) ?? 0) + speed * dt;
    if (acc >= PLAYER.stepDistance) {
      this.footsteps.set(id, 0);
      return true;
    }
    this.footsteps.set(id, acc);
    return false;
  }

  private onPhase(st: ViewState, me: PlayerView | null): void {
    const prev = this.lastPhase;
    this.lastPhase = st.round.phase;
    if (st.round.mode === 'training') return;
    if (st.round.mode === 'tdm') {
      if (st.round.phase === 'live' && prev !== 'live')
        this.hud.banner('MATA-MATA EM EQUIPE', `Primeira equipe a ${st.round.winRounds} abates · renascimento automático`, 'info', 3);
      return;
    }
    if (st.round.phase === 'freeze') {
      this.fx.clearRound();
      this.hud.banner(`RODADA ${st.round.number}`, st.round.halftime && st.round.number === 13 ? 'TROCA DE LADOS' : 'Tempo de compra', 'info', 2.5);
    } else if (st.round.phase === 'live' && prev === 'freeze') {
      this.hud.banner('VALENDO!', me?.team === 'T' ? 'Plante a bomba ou elimine os CT' : 'Defenda os locais de bomba', 'info', 1.8);
      if (this.buyMenu.open && !st.you?.canBuy) this.buyMenu.toggle(false);
    }
  }

  private handleEvent(e: SimEvent, st: ViewState, me: PlayerView | null): void {
    const s = this.session!;
    const localId = s.localId;
    const pos = (x: unknown, y: unknown, z: unknown) => ({ x: x as number, y: y as number, z: z as number });
    switch (e.type) {
      case 'shot': {
        const isLocal = e.pid === localId;
        const def = WEAPONS[e.w as string];
        const serverEcho = s.online && isLocal && !e.local;
        const from = new Vector3(e.ox as number, e.oy as number, e.oz as number);
        const to = new Vector3(e.hx as number, e.hy as number, e.hz as number);
        if (!serverEcho) {
          if (isLocal) {
            this.view.fire();
            if (def && def.cls !== 'knife' && def.cls !== 'grenade') this.camera.kick(Math.min(0.5, def.recoil * 0.05) * (def.cls === 'sniper' ? 1.6 : 1));
            this.audio.shot(def?.sound ?? 'rifle', null, e.w as string);
            if (def?.cls !== 'knife') this.fx.lightFlash(this.view.muzzleWorld, def?.cls === 'sniper' ? 2.6 : 1.6, 0.06, 7);
            if (def?.cls !== 'knife') this.fx.tracer(this.view.muzzleWorld, to);
          } else {
            const c = this.chars.get(e.pid as string);
            c?.model.fire();
            this.audio.shot(def?.sound ?? 'rifle', from, e.w as string);
            if (def?.cls !== 'knife' && Vector3.DistanceSquared(from, this.camera.camera.position) < 900) this.fx.lightFlash(from, 1.3, 0.06, 6);
            if (def?.cls !== 'knife') this.fx.tracer(from.add(to.subtract(from).normalize().scale(0.8)), to);
            this.seenEnemy.set(e.pid as string, this.time);
          }
          if (e.surface && !e.hit) this.decals.spawn({ x: to.x, y: to.y, z: to.z }, { x: e.nx as number, y: e.ny as number, z: e.nz as number }, e.surface as SurfaceKind);
        }
        if (e.hit && !e.local) {
          const dir = from.subtract(to).normalize();
          this.fx.bloodAt(to, dir);
          if (isLocal) {
            this.hud.hit(e.region === 'head');
            this.audio.hitmarker(e.region === 'head');
          }
        }
        break;
      }
      case 'damage': {
        const victim = st.players.find(p => p.id === e.pid);
        if (victim) this.chars.get(e.pid as string)?.model.hit(Math.atan2((e.fx as number) - victim.x, (e.fz as number) - victim.z));
        if (e.pid === localId) {
          const ang = Math.atan2((e.fx as number) - (me?.x ?? 0), (e.fz as number) - (me?.z ?? 0)) - this.look.yaw;
          this.hud.damage(ang);
          this.audio.hurt();
          this.camera.addShake(0.3);
        }
        break;
      }
      case 'kill': {
        const killer = st.players.find(p => p.id === e.killer);
        const victim = st.players.find(p => p.id === e.victim);
        if (victim) this.hud.kill(killer?.name ?? null, killer?.team ?? null, victim.name, victim.team, e.weapon as string, !!e.hs, e.killer === localId || e.victim === localId);
        if (e.killer === localId && e.victim !== localId) this.hud.message(e.hs ? 'ABATE NA CABEÇA!' : 'ABATE!', 1);
        if (e.victim === localId) {
          const how = !killer ? 'Você morreu' : killer.id === me?.id ? 'Você se matou' : killer.team === me?.team ? `Morto pelo companheiro ${killer.name}` : `Morto pelo inimigo ${killer.name} (${killer.team === 'T' ? 'TR' : 'CT'})`;
          this.hud.message(e.weapon === 'c4' ? 'Morto pela explosão da bomba' : s.mode === 'tdm' ? how + ' · renascendo em 3 s' : how, 3);
          this.scoreboard.toggle(false);
        }
        break;
      }
      case 'reload': {
        const c = this.chars.get(e.pid as string);
        if (c) {
          c.reloadAt = this.time;
          c.reloadDur = e.time as number;
        }
        if (e.pid === localId) {
          this.view.reload(e.time as number);
          this.audio.reload(e.time as number, this.session?.local()?.weapon.cls ?? 'rifle');
        }
        break;
      }
      case 'dry':
        if (e.pid === localId) this.audio.play('dry');
        break;
      case 'throw':
        if (e.pid === localId) this.view.fire();
        break;
      case 'bounce':
        this.audio.bounce(pos(e.x, e.y, e.z));
        break;
      case 'detonate': {
        const p = new Vector3(e.x as number, e.y as number, e.z as number);
        if (e.nade === 'he') {
          this.fx.explosion(p);
          this.audio.explosion(p);
          const d = Vector3.Distance(p, this.camera.camera.position);
          if (d < 15) this.camera.addShake((15 - d) / 15);
        } else if (e.nade === 'flash') {
          this.fx.flashbang(p);
          this.audio.flashbang(p, 0);
        } else this.audio.smokePop(p);
        break;
      }
      case 'flashed':
        if (e.pid === localId) this.audio.flashbang(this.camera.camera.position, (e.dur as number) * (e.strength as number));
        break;
      case 'explode': {
        const p = new Vector3(e.x as number, e.y as number, e.z as number);
        this.fx.explosion(p, true);
        this.audio.explosion(p, true);
        this.camera.addShake(1.4);
        break;
      }
      case 'planted':
        this.hud.banner('BOMBA PLANTADA', `Local ${e.site}`, 'warn', 2.5);
        this.audio.beep(pos(e.x, e.y, e.z), true);
        break;
      case 'defused':
        this.hud.banner('BOMBA DESARMADA', '', 'ct', 2);
        break;
      case 'bomb_pickup':
        if (e.pid === localId) {
          this.hud.message('Você pegou a bomba', 1.5);
          this.audio.play('pickup');
        }
        break;
      case 'bomb_drop':
        if (me?.team === 'T') this.hud.message('A bomba caiu!', 1.5);
        break;
      case 'door':
        this.audio.play('door');
        break;
      case 'buy':
        if (e.pid === localId) this.audio.buy();
        break;
      case 'round_end': {
        const winner = e.winner as Team | null;
        const reasons: Record<string, string> = { elimination: 'Todos os inimigos eliminados', bomb: 'A bomba explodiu', defuse: 'A bomba foi desarmada', time: 'O tempo acabou', kills: 'Limite de abates atingido' };
        const mvp = st.players.find(p => p.id === e.mvp);
        if (!winner) {
          this.hud.banner('EMPATE', `${reasons[e.reason as string] ?? ''}${mvp ? ' · MVP: ' + mvp.name : ''}`, 'info', 5);
          break;
        }
        this.hud.banner(winner === 'T' ? 'TERRORISTAS VENCERAM' : 'CONTRATERRORISTAS VENCERAM', `${reasons[e.reason as string] ?? ''}${mvp ? ' · MVP: ' + mvp.name : ''}`, winner === 'T' ? 't' : 'ct', 5);
        if (me) this.audio.stinger(me.team === winner);
        break;
      }
      case 'radio': {
        const from = st.players.find(p => p.id === e.pid);
        if (from && me && from.team === me.team && from.id !== localId) this.hud.radio(from.name, from.team, e.text as string);
        break;
      }
      case 'halftime':
        this.hud.banner('INTERVALO', 'Os times trocaram de lado', 'info', 3);
        break;
      case 'join':
        if (s.online && e.pid !== localId && !e.bot) this.hud.message(`${e.name} entrou`, 2);
        break;
    }
  }

  private updatePrompt(st: ViewState, me: PlayerView | null): void {
    const s = this.session!;
    const local = s.local();
    if (!local || !local.alive || !me) return this.hud.setPrompt(null);
    const p = local.ctrl.position;
    const use = this.touchMode ? 'USAR' : 'E';
    const live = st.round.phase === 'live';
    if (me.team === 'T' && me.bomb && live) {
      const site = s.map.siteAt(p.x, p.z);
      if (site) return this.hud.setPrompt(`Segure [${use}] para plantar a bomba no local ${site}`);
    }
    if (me.team === 'CT' && st.bomb.state === 'planted' && live) {
      const d = Math.hypot(p.x - st.bomb.x, p.z - st.bomb.z);
      if (d < 1.7) return this.hud.setPrompt(`Segure [${use}] para desarmar${me.kit ? ' (kit: 5s)' : ' (10s)'}`);
      if (d < 6) return this.hud.setPrompt('A bomba está aqui perto!');
    }
    for (const d of s.map.doors) {
      const dist = Math.hypot(d.center.x - p.x, d.center.z - p.z);
      if (dist < 3) return this.hud.setPrompt(`[${use}] ${d.open ? 'Fechar' : 'Abrir'} porta`);
    }
    this.hud.setPrompt(null);
  }

  private radarDots(st: ViewState, me: PlayerView | null): RadarDot[] {
    const dots: RadarDot[] = [];
    const s = this.session!;
    const myTeam = me?.team ?? 'T';
    const cam = this.camera.camera.position;
    for (const p of st.players) {
      if (p.id === s.localId) continue;
      if (p.team === myTeam) dots.push({ x: p.x, z: p.z, color: myTeam === 'T' ? '#f0b040' : '#5ab0ff', dead: !p.alive });
      else if (p.alive) {
        // inimigo aparece se está à vista ou atirou há pouco
        let visible = this.time - (this.seenEnemy.get(p.id) ?? -9) < 1.5;
        if (!visible) {
          const dir = { x: p.x - cam.x, y: p.y + 1.4 - cam.y, z: p.z - cam.z };
          const d = Math.hypot(dir.x, dir.y, dir.z);
          if (d < 60) {
            const hit = s.map.world.raycast(cam, dir, d);
            visible = !hit || hit.distance > d - 0.5;
            if (visible) this.seenEnemy.set(p.id, this.time - 1);
          }
        }
        if (visible) dots.push({ x: p.x, z: p.z, color: '#ff4040' });
      }
    }
    const b = st.bomb;
    if (b.state === 'planted' || (myTeam === 'T' && (b.state === 'dropped' || (b.state === 'carried' && b.carrier !== s.localId)))) {
      dots.push({ x: b.x, z: b.z, color: b.state === 'planted' ? '#ff3020' : '#ffcc40', bomb: true });
    }
    return dots;
  }

  private updateTags(st: ViewState, me: PlayerView | null): void {
    if (!me) return this.hud.setTags([]);
    const cam = this.camera.camera;
    const engine = this.engine;
    const w = engine.getRenderWidth(), h = engine.getRenderHeight();
    const scale = window.innerWidth / w;
    const vp = cam.viewport.toGlobal(w, h);
    const tm = this.scene.getTransformMatrix();
    const tags: { x: number; y: number; name: string; hp: number; team: string }[] = [];
    for (const p of st.players) {
      if (p.id === me.id || p.team !== me.team || !p.alive) continue;
      const pos = new Vector3(p.x, p.y + (p.crouch ? 1.45 : 2.05), p.z);
      const d = Vector3.Distance(pos, cam.position);
      if (d > 90) continue;
      const fwd = cam.getDirection(Vector3.Forward());
      if (Vector3.Dot(fwd, pos.subtract(cam.position)) <= 0) continue;
      const sp = Vector3.Project(pos, Matrix.IdentityReadOnly, tm, vp);
      tags.push({ x: sp.x * scale, y: sp.y * scale, name: p.name, hp: p.hp, team: p.team });
    }
    this.hud.setTags(tags);
  }
}

function nextFrame(): Promise<void> {
  return new Promise(r => requestAnimationFrame(() => r()));
}
