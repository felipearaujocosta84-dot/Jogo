// =============================================================
// EXTREME RACING — RaceSession
// Monta e executa uma corrida: cena com física Havok, clima,
// pista, carros (jogador + IA), câmeras, HUD, controles, áudio,
// regras (RaceManager) e o laço de passo fixo da simulação.
// =============================================================
import { DefaultRenderingPipeline, ImageProcessingConfiguration, Color4, Vector3 } from '@babylonjs/core';
import { TrackManager, getTrackDef } from '../tracks/TrackManager.js';
import { Vehicle } from '../vehicles/Vehicle.js';
import { RacingAI } from '../ai/RacingAI.js';
import { RaceManager, RACE_MODES } from './RaceManager.js';
import { CameraController } from '../cameras/CameraController.js';
import { WeatherSystem } from '../systems/WeatherSystem.js';
import { InputManager } from '../systems/InputManager.js';
import { RaceHUD } from '../ui/RaceHUD.js';
import { MobileControls } from '../ui/MobileControls.js';
import { getCar, applyUpgrades } from '../vehicles/VehicleCatalog.js';
import { PAINT_COLORS } from '../garage/GarageManager.js';
import { mulberry32, clamp, smoothStep } from '../utils/MathUtils.js';
import { formatTime } from './RaceManager.js';
import { SkidMarks } from '../vehicles/SkidMarks.js';
import { DebugLog } from '../utils/DebugLog.js';
import { ReplayRecorder } from './ReplaySystem.js';
import { ReplayPlayer } from './ReplayPlayer.js';
import { GhostLap } from './GhostLap.js';
import { GhostCar } from '../vehicles/GhostCar.js';
import { ReplayUI } from '../ui/ReplayUI.js';

const AI_NAMES = ['R. Valente', 'M. Okafor', 'L. Brandt', 'S. Moreau', 'K. Tanaka', 'A. Duarte', 'J. Lindqvist', 'E. Rossi'];
const PRIZES = [6000, 4000, 2800, 2000, 1500, 1200, 1000, 800];
const DIFF_MULT = { easy: 0.7, medium: 1, hard: 1.35, expert: 1.7 };

export class RaceSession {
  /**
   * @param {Game} game
   * @param {object} config { trackId, mode, laps, difficulty, opponents, timeOfDay?, rain? }
   */
  constructor(game, config) {
    this.game = game;
    this.config = config;
    this.sm = game.sceneManager;
    this.settings = game.save.settings;
    this.preset = game.graphics.preset;
    this.paused = false;
    this.finished = false;
    this.vehicles = [];
    this.ais = new Map();
    this.onExit = null; // callback(result)
  }

  async load(progress) {
    const cfg = this.config;
    const s = this.settings;
    const game = this.game;
    progress(0.02, 'Preparando física…');
    await this.sm.initPhysics();
    const scene = this.sm.createScene({ physics: true });
    this.scene = scene;

    // ---------- Clima e iluminação ----------
    const trackDef = getTrackDef(cfg.trackId);
    const tod = s.dayNight === 'day' ? 13 : s.dayNight === 'sunset' ? 18.1 : s.dayNight === 'night' ? 22.5 : trackDef.timeOfDay;
    // Tempestade de areia só existe no deserto
    const canSand = (trackDef.weatherOptions ?? []).includes('sandstorm');
    const sandstorm = canSand && (s.weather === 'sandstorm' || (s.weather === 'random' && Math.random() < 0.3));
    const rain = !sandstorm && (s.weather === 'rain' || (s.weather === 'random' && !canSand && Math.random() < 0.3));
    this.weather = new WeatherSystem(scene, this.preset, { timeOfDay: tod, cycle: s.dayNight === 'dynamic', rain, sandstorm, cycleSpeed: 0.05 });

    // ---------- Pista ----------
    this.track = await TrackManager.build(scene, cfg.trackId, this.preset, (p, t) => progress(0.05 + p * 0.6, t));
    this.geo = this.track.geometry;
    this.builder = this.track.builder;
    this.minY = this.geo.bounds().minY;
    for (const m of this.builder.shadowCasters) this.weather.addShadowCaster(m);
    if (this.builder.puddles) this.builder.puddles.setEnabled(rain);

    // ---------- Carros ----------
    progress(0.72, 'Preparando carros…');
    const mode = RACE_MODES[cfg.mode] ?? RACE_MODES.quick;
    this.mode = mode;
    const nAI = mode.ai ? clamp(cfg.opponents ?? s.opponents ?? 3, 1, 7) : 0;
    const slots = this.geo.gridSlots(nAI + 1);
    const rnd = mulberry32(Date.now() & 0xffff);
    const playerSlot = nAI; // jogador larga atrás
    const garage = game.garage;
    const playerSpec = garage.spec();
    const playerLook = garage.look();
    const common = { track: this.geo, graphics: game.graphics };
    for (let i = 0; i <= nAI; i++) {
      const slot = slots[i];
      const isPlayer = i === playerSlot;
      let spec, look, name;
      if (isPlayer) {
        spec = playerSpec; look = playerLook; name = 'VOCÊ';
      } else {
        // Adversários: mesmo carro-base do jogador com melhorias equivalentes
        spec = applyUpgrades(getCar(garage.selectedId), garage.config().upgrades);
        look = { colors: { paint: PAINT_COLORS[Math.floor(rnd() * PAINT_COLORS.length)], rim: '#1a1a1a' }, finish: rnd() < 0.2 ? 'matte' : 'metallic', rimStyle: Math.floor(rnd() * 3) };
        name = AI_NAMES[i % AI_NAMES.length];
      }
      const v = new Vehicle(scene, spec, {
        ...common, name, isPlayer, colors: look.colors, finish: look.finish, rimStyle: look.rimStyle,
        transmission: isPlayer ? s.transmission : 'auto',
        abs: isPlayer ? s.abs : true, tc: isPlayer ? s.tc : true, stability: isPlayer ? s.stability : false,
      });
      await v.init({ x: slot.position.x, y: slot.position.y + 0.55, z: slot.position.z }, slot.heading);
      v.physics.launchHold = true;
      this.vehicles.push(v);
      if (isPlayer) this.player = v;
      else this.ais.set(v, new RacingAI(this.geo, v.physics, cfg.difficulty ?? s.difficulty, i + 1));
      this.weather.addShadowCaster(v.model.root);
      v.model.root.getChildMeshes().forEach((m) => { m.receiveShadows = true; });
    }

    this.skids = new SkidMarks(scene, this.preset.particles >= 1 ? 2400 : 1200);

    // ---------- Câmera e pós-processamento ----------
    this.camera = new CameraController(scene, this.preset, s);
    this.camera.setTarget(this.player);
    this._setupPipeline();

    // ---------- Regras ----------
    const laps = mode.id === 'training' ? Infinity : cfg.laps ?? s.laps ?? trackDef.defaultLaps;
    this.race = new RaceManager(this.geo, { mode: mode.id, laps, countdown: 5 });
    this.participants = this.vehicles.map((v) => {
      const p = this.race.addParticipant({ id: v.id, name: v.name, isPlayer: v.isPlayer, getPosition: () => v.getPosition(), getSpeed: () => v.speed });
      p.vehicle = v;
      return p;
    });
    this.playerPart = this.participants.find((p) => p.isPlayer);
    this.recordLap = game.save.getRecord(cfg.trackId, garage.selectedId);

    // ---------- Interface e controles ----------
    const ui = game.uiRoot;
    this.hud = new RaceHUD(ui, this.geo);
    this.controls = new MobileControls(ui, s);
    this.input = new InputManager(this.controls, s);
    this.input.on('camera', () => this.camera.toggle());
    this.input.on('pause', () => (this.paused ? this.resume() : this.pause()));
    this.input.on('reset', () => this.resetPlayer());
    this.input.on('gearUp', () => { if (s.transmission === 'manual') this.player.physics.transmission.shiftUp(this.player.physics.forwardSpeed); });
    this.input.on('gearDown', () => { if (s.transmission === 'manual') this.player.physics.transmission.shiftDown(this.player.physics.forwardSpeed); });
    this.player.physics.transmission.onShift = () => game.audio.shift();

    // ---------- Eventos da corrida ----------
    this.race.on('count', (n) => {
      const lit = 6 - n; // 5..1 -> 1..5 luzes
      this.builder.setStartLights(Math.max(0, Math.min(5, lit)));
      if (n <= 3) this.hud.countdown(n);
      game.audio.beep(false);
    });
    this.race.on('go', () => {
      this.builder.setStartLights('go');
      this.hud.countdown('go');
      game.audio.beep(true);
      for (const v of this.vehicles) v.physics.launchHold = false;
      setTimeout(() => this.builder?.setStartLights('off'), 4000);
    });
    this.race.on('lap', (p, lapTime, isBest) => {
      this.replayRec?.mark(`${p.name}: volta ${p.lap} ${formatTime(lapTime)}`);
      if (!p.isPlayer) return;
      game.achievements.lap({ clean: !this._lapImpact });
      this._lapImpact = false;
      this._onGhostLap(lapTime);
      const rec = game.save.submitLap(cfg.trackId, garage.selectedId, lapTime);
      if (rec) { this.newRecord = lapTime; this.recordLap = lapTime; }
      const remaining = this.race.totalLaps - p.lap;
      let msg = `VOLTA ${formatTime(lapTime)}`;
      if (rec) msg += ' • RECORDE!';
      else if (isBest) msg += ' • MELHOR VOLTA';
      if (remaining === 1) msg += ' • ÚLTIMA VOLTA';
      this.hud.message(msg, 2600);
    });
    this.race.on('raceEnd', (results) => this._onRaceEnd(results));
    this.race.on('go', () => this.replayRec?.mark('Largada'));

    // ---------- Replay e fantasma ----------
    this.replayRec = new ReplayRecorder(this.vehicles.length);
    this.stormy = rain || sandstorm;
    if (mode.id === 'timetrial' || mode.id === 'training') {
      const b = this.geo.bounds();
      this.ghostOrigin = { x: (b.minX + b.maxX) / 2, z: (b.minZ + b.maxZ) / 2 };
      this.ghostKey = `${cfg.trackId}_${garage.selectedId}`;
      this.ghostRec = new GhostLap(this.ghostOrigin);
      this.ghostCar = new GhostCar(scene, playerSpec);
      await this.ghostCar.init();
      const saved = game.save.data.ghosts?.[this.ghostKey];
      if (saved) {
        try { this.ghostCar.setLap(GhostLap.decode(saved)); } catch (e) { console.warn('[Ghost] inválido', e); }
      }
    }

    // ---------- Áudio ----------
    const audio = game.audio;
    audio.unlock();
    for (const v of this.vehicles) audio.createEngine(v.id, { carId: v.spec.id, cylinders: v.spec.engine.cylinders, isPlayer: v.isPlayer, electric: !!v.spec.engine.electric });
    this.loops = {
      skid: audio.createLoop('skid'),
      wind: audio.createLoop('wind'),
      rain: audio.createLoop('rain'),
      amb: audio.createLoop(this.track.env?.ambience ?? trackDef.ambience ?? 'wind'),
    };

    // ---------- Laço de física (passo fixo) ----------
    // Executa imediatamente antes de cada passo do Havok (60 Hz fixos)
    this._physObservable = scene.onBeforePhysicsObservable ?? scene.onBeforeStepObservable;
    this._physObs = this._physObservable.add(() => this._fixedStep());
    progress(0.95, 'Preparando gráficos…');
    // Compila shaders antes de mostrar — mas nunca espera para sempre:
    // se algo não ficar pronto em 8 s, registra o diagnóstico e segue.
    const ready = await Promise.race([
      scene.whenReadyAsync().then(() => true),
      new Promise((r) => setTimeout(() => r(false), 8000)),
    ]);
    if (!ready) this._logNotReady();
    progress(1, 'Largada!');
  }

  /** Diagnóstico: o que impediu a cena de ficar pronta (vai para o LOG). */
  _logNotReady() {
    const scene = this.scene;
    const engine = scene.getEngine();
    const info = [];
    try {
      info.push(`WebGL ${engine.webGLVersion} • ${engine.getGlInfo()?.renderer ?? '?'} • preset ${this.preset.label}`);
      const meshes = scene.meshes.filter((m) => m.isEnabled() && m.subMeshes?.length && !m.isReady(true));
      info.push(`malhas não prontas (${meshes.length}): ${meshes.slice(0, 20).map((m) => `${m.name}[${m.material?.name ?? '-'}]`).join(', ')}`);
      const ps = scene.particleSystems.filter((p) => !p.isReady());
      if (ps.length) info.push(`partículas não prontas: ${ps.map((p) => p.name).join(', ')}`);
      if (!engine.areAllEffectsReady()) info.push('shaders ainda compilando');
      if (scene.getWaitingItemsCount?.()) info.push(`itens aguardando: ${scene.getWaitingItemsCount()}`);
    } catch (e) { info.push(`falha no diagnóstico: ${e.message}`); }
    console.warn('[Corrida] cena não ficou pronta em 8 s —', info.join(' | '));
    DebugLog.showBadge();
  }

  _setupPipeline() {
    const p = this.preset;
    const scene = this.scene;
    scene.imageProcessingConfiguration.toneMappingEnabled = true;
    scene.imageProcessingConfiguration.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
    scene.imageProcessingConfiguration.exposure = 1.05;
    scene.imageProcessingConfiguration.contrast = 1.15;
    if (!p.postProcess) return;
    const pipe = new DefaultRenderingPipeline('pipeline', false, scene, [this.camera.camera]);
    pipe.fxaaEnabled = p.fxaa;
    pipe.bloomEnabled = p.bloom;
    pipe.bloomThreshold = 0.85;
    pipe.bloomWeight = 0.25;
    pipe.bloomKernel = 48;
    pipe.bloomScale = 0.5;
    pipe.imageProcessingEnabled = true;
    pipe.imageProcessing.toneMappingEnabled = true;
    pipe.imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
    pipe.imageProcessing.contrast = 1.15;
    pipe.imageProcessing.exposure = 1.05;
    pipe.imageProcessing.vignetteEnabled = true;
    pipe.imageProcessing.vignetteWeight = 1.2;
    pipe.imageProcessing.vignetteColor = new Color4(0, 0, 0, 0);
    this.pipeline = pipe;
  }

  start() {
    this.startedAt = performance.now();
    setTimeout(() => { if (this.race && this.race.state === 'grid') this.race.startCountdown(); }, 1200);
  }

  get dt() { return this.sm.fixedDt; }

  /** Passo fixo (60 Hz): entradas, IA, física automotiva e regras. */
  _fixedStep() {
    if (this.paused || !this.race || this.replaying) return;
    const dt = this.sm.engine.isDeterministicLockStep() ? this.sm.fixedDt : Math.min(1 / 20, this.sm.engine.getDeltaTime() / 1000);
    const racing = this.race.isRacing;
    const grip = this.weather.gripFactor;
    const input = this.input.update(dt);
    const others = this.participants.map((p) => ({ part: p, s: p.s, lateral: p.lateral, speed: p.vehicle.speed }));

    for (const p of this.participants) {
      const v = p.vehicle;
      v.physics.gripMultiplier = grip;
      if (p.isPlayer) {
        const finishedCoast = p.finished;
        v.fixedUpdate(dt, finishedCoast ? { throttle: 0, brake: 0.4, steer: input.steer, handbrake: 0 } : input);
      } else {
        const ai = this.ais.get(v);
        const list = others.filter((o) => o.part !== p);
        const inp = ai.update(dt, p, list, racing);
        v.fixedUpdate(dt, inp);
        if (ai.wantsRespawn) {
          v.respawnOnTrack();
          ai.onRespawn();
          this.race.notifyRespawn(p);
        }
      }
      // Segurança: caiu do mapa
      if (v.root.position.y < this.minY - 25) {
        v.respawnOnTrack();
        this.race.notifyRespawn(p);
      }
    }
    // Impactos do jogador (som e câmera)
    const imp = this.player.physics.impact;
    if (imp > 1.5) {
      this.game.audio.impact(imp);
      this.camera.addImpact(imp);
    }
    // Capotado e parado: reposiciona automaticamente
    const up = this.player.physics.axes.up.y;
    this._flipTimer = up < 0.3 && this.player.speed < 3 ? (this._flipTimer ?? 0) + dt : 0;
    if (this._flipTimer > 2.5) { this.resetPlayer(); this._flipTimer = 0; }
    if (imp > 1.5 && racing) this._lapImpact = true;

    this.race.update(dt);

    // Conquistas de condução
    if (racing && !this.playerPart.finished) this.game.achievements.tick(dt, this.player.physics.telemetry());
    // Gravação do replay (desde a contagem) e da volta fantasma
    if (this.race.state !== 'grid') this.replayRec.step(dt, (c, arr, o) => this.vehicles[c].writeReplayFrame(arr, o));
    if (this.ghostRec && racing) {
      const q = this.player.root.rotationQuaternion;
      this.ghostRec.record(dt, this.player.root.position, q);
    }
  }

  /** Volta completa: salva o fantasma se for a melhor volta deste carro nesta pista. */
  _onGhostLap(lapTime) {
    if (!this.ghostRec) return;
    const lap = this.ghostRec;
    lap.time = lapTime;
    const prev = this.ghostCar?.lap;
    if (prev?.time && lapTime < prev.time) this.game.achievements.ghostBeaten();
    if (!prev?.time || lapTime < prev.time) {
      this.ghostCar.setLap(lap);
      const save = this.game.save;
      save.data.ghosts ||= {};
      try {
        save.data.ghosts[this.ghostKey] = lap.encode();
        save.save();
      } catch (e) { console.warn('[Ghost] não foi possível salvar', e); }
      if (prev?.time) this.hud.message('NOVO FANTASMA SALVO', 1600);
    }
    this.ghostRec = new GhostLap(this.ghostOrigin);
  }

  // ---------------- Replay ----------------
  startReplay() {
    if (this.replaying || !this.replayRec || this.replayRec.frames < 10) return;
    this.replaying = true;
    this.hud.setReplayMode(true);
    this.controls.setVisible(false);
    if (this.ghostCar) this.ghostCar.update(-1);
    this._snapshots = this.vehicles.map((v) => v.snapshot());
    this.replayPlayer = new ReplayPlayer(this, this.replayRec);
    this.replayPlayer.start();
    this.replayUI = new ReplayUI(this.game.uiRoot, this.replayPlayer, { onExit: () => this.stopReplay() });
  }

  stopReplay() {
    if (!this.replaying) return;
    this.replaying = false;
    this.replayPlayer.stop();
    this.replayUI.dispose();
    this.replayUI = null;
    this.vehicles.forEach((v, i) => v.restoreSnapshot(this._snapshots[i]));
    this.camera.camera.parent = null;
    this.camera.camera.rotationQuaternion = null;
    this.camera.setTarget(this.player);
    this.hud.setReplayMode(false);
    if (this._replayFromPause) {
      this._replayFromPause = false;
      this.pause();
    }
  }

  /** Atualização por quadro (visual, câmera, HUD, áudio). */
  frame(dt) {
    if (!this.race || this.paused) return;
    if (this.replaying) {
      this.weather.apply(dt);
      this.weather.followTarget(this.replayPlayer.vehicles[this.replayPlayer.target].root.position);
      this.replayPlayer.update(dt, { isNight: this.weather.isNight });
      this.replayUI?.update(dt);
      this.skids.flush();
      return;
    }
    if (this.ghostCar) this.ghostCar.update(this.race.isRacing ? this.race.time - this.playerPart.lapStart : -1);
    this.weather.apply(dt);
    this.weather.followTarget(this.player.root.position);
    if (this.builder.puddles) this.builder.puddles.setEnabled(this.weather.wetness > 0.3);
    const asphalt = this.track.materials.cache.asphalt;
    if (asphalt) asphalt.roughness = 0.88 - this.weather.wetness * 0.6;
    // Túneis: escurece a cena e acende os faróis
    const inTunnel = !!this.geo.featureAt(this.playerPart.s, 'tunnel', 12);
    this.weather.occlusionTarget = inTunnel ? 1 : 0;
    const isNight = this.weather.isNight;
    const cockpit = this.camera.mode === 'cockpit';
    for (const v of this.vehicles) {
      const vTunnel = v.isPlayer ? inTunnel : false;
      v.update(dt, { isNight: isNight || vTunnel, cockpit: cockpit && v.isPlayer });
      this.skids.addVehicle(v);
    }
    this.skids.flush();
    // Miragens: asfalto distante "molhado" em dia quente (somem ao se aproximar)
    if (this.builder.mirageMeshes) {
      const w = this.weather;
      const heat = Math.max(0, w.daylight - 0.4) / 0.6 * (1 - w.rain) * (1 - w.sand) * (1 - w.wetness);
      const cam = this.camera.camera.globalPosition;
      for (const m of this.builder.mirageMeshes) {
        const d = Vector3.Distance(cam, m.center);
        const vis = heat * 0.85 * smoothStep(80, 220, d) * (1 - smoothStep(650, 950, d));
        m.mesh.visibility = vis;
        m.mesh.setEnabled(vis > 0.01);
      }
    }
    // Janelas dos prédios acendem ao anoitecer
    if (this.builder.nightMaterials) {
      const glow = Math.max(0, 1 - this.weather.daylight * 1.6);
      for (const m of this.builder.nightMaterials) m.emissiveColor.set(glow * 0.9, glow * 0.82, glow * 0.6);
    }
    this.camera.update(dt);
    const tel = this.player.physics.telemetry();
    tel.esp = this.player.physics.espActive;
    this.hud.update(dt, {
      player: this.playerPart, telemetry: tel, race: this.race, participants: this.participants,
      fps: this.sm.engine.getFps(), showFps: this.settings.showFps, recordLap: this.recordLap,
    });
    this._updateAudio(tel);
    this.game.graphics.update(dt);
  }

  _updateAudio(tel) {
    const audio = this.game.audio;
    if (!audio.enabled) return;
    const cam = this.camera.camera.globalPosition;
    for (const v of this.vehicles) {
      const ph = v.physics;
      const d = v.isPlayer ? 0 : cam.subtract(v.root.position).length();
      audio.updateEngine(v.id, { rpm: ph.engine.displayRpm, load: ph.engine.load, limiter: ph.engine.limiterActive, distance: d });
    }
    const skid = Math.max(0, tel.skid - 3.5);
    audio.setLoop(this.loops.skid, Math.min(0.5, skid * 0.05) * (this.settings.effectsVolume ?? 0.8), 900 + Math.min(600, skid * 40));
    audio.setLoop(this.loops.wind, (Math.min(0.35, (tel.speedKmh / 300) ** 2 * 0.35) + this.weather.sand * 0.3) * (this.settings.effectsVolume ?? 0.8));
    audio.setLoop(this.loops.rain, this.weather.rain * 0.25 * (this.settings.ambienceVolume ?? 0.6));
    audio.setLoop(this.loops.amb, 0.12 * (this.settings.ambienceVolume ?? 0.6));
  }

  pause() {
    if (this.paused || this.finished) return;
    this.paused = true;
    this.sm.paused = true;
    this.game.audio.setPaused(true);
    this.controls.setVisible(false);
    this.hud.showPause({
      onResume: () => this.resume(),
      onRestart: () => this.game.restartRace(),
      onQuit: () => this.quit(),
      onCamera: () => { const m = this.camera.toggle(); this.hud.message(m === 'cockpit' ? 'CÂMERA: COCKPIT' : 'CÂMERA: TERCEIRA PESSOA', 1200); },
      onSettings: () => this.game.openSettings(() => this.applyLiveSettings()),
      onReplay: () => {
        if (!this.replayRec || this.replayRec.frames < 10) return;
        this.hud.hidePause();
        this.paused = false;
        this.sm.paused = false;
        this.game.audio.setPaused(false);
        this._replayFromPause = true;
        this.startReplay();
      },
    });
  }

  resume() {
    this.paused = false;
    this.sm.paused = false;
    this.game.audio.setPaused(false);
    this.controls.setVisible(true);
    this.hud.hidePause();
  }

  /** Configurações alteradas durante a pausa. */
  applyLiveSettings() {
    const s = this.settings;
    const ph = this.player.physics;
    ph.absEnabled = s.abs; ph.tcEnabled = s.tc; ph.stabilityEnabled = s.stability;
    ph.transmission.mode = s.transmission;
    this.controls.dispose();
    this.controls = new MobileControls(this.game.uiRoot, s);
    this.input.controls = this.controls;
    for (const evt of Object.keys(this.input.listeners)) this.controls.on(evt, () => this.input.emit(evt));
    this.controls.setVisible(!this.paused);
    this.game.audio.applyVolumes();
  }

  resetPlayer() {
    if (!this.race || this.race.state !== 'racing') return;
    this.player.respawnOnTrack();
    this.race.notifyRespawn(this.playerPart);
    this.hud.message('CARRO REPOSICIONADO', 1200);
  }

  _onRaceEnd(results) {
    if (this.finished) return;
    this.finished = true;
    const game = this.game;
    const me = results.find((r) => r.isPlayer);
    let earned = 0;
    if (this.mode.id === 'quick' || this.mode.id === 'championship') {
      earned = Math.round((PRIZES[me.position - 1] ?? 500) * (DIFF_MULT[this.config.difficulty ?? this.settings.difficulty] ?? 1));
    } else if (this.mode.id === 'timetrial') {
      earned = 1500 + (this.newRecord ? 2500 : 0);
    }
    const stats = game.save.data.stats;
    stats.races++;
    if (me.position === 1 && this.mode.ai) stats.wins++;
    if (me.position <= 3 && this.mode.ai) stats.podiums++;
    stats.distanceKm += (this.playerPart.distance / 1000) || 0;
    game.garage.addCredits(earned);
    game.achievements.raceFinished({ position: me.position, ai: this.mode.ai, difficulty: this.config.difficulty ?? this.settings.difficulty, trackId: this.config.trackId, stormy: this.stormy });
    game.save.save();
    setTimeout(() => {
      this.controls.setVisible(false);
      this.sm.paused = false;
      const title = this.mode.ai ? (me.position === 1 ? 'VITÓRIA!' : `${me.position}º LUGAR`) : 'SESSÃO CONCLUÍDA';
      const champ = this.mode.id === 'championship' ? game.championshipAfterRace(results) : null;
      this.hud.showResults({
        title, results, earned, record: this.newRecord,
        extra: champ?.element,
        onContinue: () => this.quit(champ),
        onRestart: this.mode.id === 'championship' ? null : () => game.restartRace(),
        onReplay: () => this.startReplay(),
      });
    }, 1500);
  }

  quit(champ = null) {
    if (this.onExit) this.onExit(champ);
  }

  dispose() {
    try { this._physObservable?.remove(this._physObs); } catch { /* ok */ }
    this.game.audio.stopAll();
    if (this.loops) for (const l of Object.values(this.loops)) this.game.audio.stopLoop(l);
    this.hud?.dispose();
    this.controls?.dispose();
    this.input?.dispose();
    for (const v of this.vehicles) v.dispose();
    this.skids?.dispose();
    this.replayUI?.dispose();
    this.ghostCar?.dispose();
    this.weather?.dispose();
    this.pipeline?.dispose();
    this.track?.dispose();
    this.camera?.dispose();
    this.race = null;
    this.game.audio.setPaused(false);
    this.sm.paused = false;
  }
}
