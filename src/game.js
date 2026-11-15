// Núcleo do jogo: motor, cena, laço com passo fixo, pausa automática e modo de treino da Etapa 1.
import { Engine, Scene, Vector3, MeshBuilder, StandardMaterial, Color3, Plane } from './babylon.js';
import { FIELD, PHYSICS, TEAMS } from './config.js';
import { createArena } from './stadium/arenas.js';
import { Ball } from './ball/Ball.js';
import { BroadcastCamera } from './camera/BroadcastCamera.js';
import { AudioManager } from './audio/AudioManager.js';
import { Effects } from './effects/Effects.js';
import { Performance } from './core/Performance.js';
import { Settings } from './core/Settings.js';

const GROUND_PLANE = Plane.FromPositionAndNormal(Vector3.Zero(), Vector3.Up());

export class Game {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} ui referências do HUD (ver main.js)
   */
  constructor(canvas, ui) {
    this.canvas = canvas;
    this.ui = ui;
    this.settings = new Settings();
    this.paused = true;
    this.started = false;
    this.accumulator = 0;
    this.lastFrame = 0;
    this.score = { home: 0, away: 0 };
    this.goalTimer = 0;      // > 0 durante a comemoração do gol
    this.aim = null;         // mira do toque (modo treino)
  }

  async init(onProgress = () => {}) {
    onProgress(5, 'Iniciando motor 3D');
    this.engine = new Engine(this.canvas, true, {
      preserveDrawingBuffer: false,
      stencil: false,
      antialias: true,
      powerPreference: 'high-performance',
      adaptToDeviceRatio: false
    });
    this.engine.disableManifestCheck = true;
    this.perf = new Performance(this.engine, this.settings.get('quality'));

    this.scene = new Scene(this.engine);
    this.scene.skipPointerMovePicking = true;
    this.scene.autoClear = true;
    await this.nextFrame();

    onProgress(20, 'Construindo a quadra');
    this.arena = createArena(this.settings.get('arena'), this.scene, this.perf.preset);
    await this.nextFrame();

    onProgress(60, 'Preparando bola e câmera');
    this.ball = new Ball(this.scene, this.arena.shadowGenerator);
    this.cameraRig = new BroadcastCamera(this.scene, this.canvas);
    this.cameraRig.snapTo(this.ball.position);
    this.effects = new Effects(this.scene, this.perf.preset.particles);
    this.audio = new AudioManager();
    this.audio.setEnabled(this.settings.get('sound'));
    this.applyQuality();
    this.createAimMarker();
    this.bindBallEvents();
    this.bindInput();
    this.bindLifecycle();

    onProgress(85, 'Compilando materiais');
    this.engine.runRenderLoop(() => this.frame());
    await Promise.race([this.scene.whenReadyAsync(), new Promise((r) => setTimeout(r, 8000))]);
    onProgress(100, 'Pronto');

    window.addEventListener('resize', () => this.onResize());
    this.onResize();
    this.updateScoreboard();
  }

  nextFrame() {
    return new Promise((r) => requestAnimationFrame(() => r()));
  }

  // ---------------------------------------------------------------- laço principal
  frame() {
    const now = performance.now();
    let dt = this.lastFrame ? (now - this.lastFrame) / 1000 : 1 / 60;
    // limite de FPS (economia de bateria)
    const cap = this.settings.get('fpsCap');
    if (cap && cap < 60 && dt < 1 / cap - 0.002) return;
    // pausado: renderiza a ~8 FPS só para manter a imagem (economiza bateria)
    if (this.paused && this.started && dt < 0.125) return;
    this.lastFrame = now;
    dt = Math.min(dt, 0.25);

    if (!this.paused) {
      this.accumulator += dt;
      let steps = 0;
      const step = PHYSICS.fixedStep;
      while (this.accumulator >= step && steps < PHYSICS.maxSteps) {
        this.simulate(step);
        this.accumulator -= step;
        steps++;
      }
      if (steps === PHYSICS.maxSteps) this.accumulator = 0;
    }
    this.arena.update(this.paused ? 0 : dt);
    this.cameraRig.update(dt, this.ball.position);
    this.perf.update(dt, cap);
    this.updateHud(dt);
    this.scene.render();
  }

  simulate(dt) {
    this.ball.step(dt, this.arena);

    if (this.goalTimer > 0) {
      this.goalTimer -= dt;
      if (this.goalTimer <= 0) this.kickoff();
      return;
    }
    if (this.arena.goals.positive.isGoal(this.ball)) this.onGoal(TEAMS.home.attacksPositiveX ? 'home' : 'away', this.arena.goals.positive);
    else if (this.arena.goals.negative.isGoal(this.ball)) this.onGoal(TEAMS.home.attacksPositiveX ? 'away' : 'home', this.arena.goals.negative);
  }

  onGoal(team, goal) {
    this.score[team]++;
    this.goalTimer = 3;
    this.updateScoreboard();
    this.audio.goal();
    this.arena.celebrate(1);
    this.effects.goalBurst(goal.mouthCenter);
    this.cameraRig.zoomBoost = 1;
    this.cameraRig.addShake(0.8);
    this.ui.showGoal(TEAMS[team]);
    this.cancelAim();
  }

  kickoff() {
    this.ball.reset(0, 0, 2.5);
    this.ball.velocity.y = 0;
    this.ui.hideGoal();
  }

  // ---------------------------------------------------------------- eventos da bola
  bindBallEvents() {
    const b = this.ball;
    b.on('kick', ({ power, position }) => {
      const p = Math.min(1, power / 30);
      if (power < 12) this.audio.pass(); else this.audio.kick(p);
      this.effects.kickBurst(position, p);
      if (power > 22) this.cameraRig.addShake(0.25);
    });
    b.on('bounce', ({ strength }) => this.audio.bounce(strength));
    b.on('wall', ({ strength }) => this.audio.wall(strength));
    b.on('post', ({ strength }) => {
      this.audio.post(strength);
      this.cameraRig.addShake(0.3);
      this.arena.celebrate(0.4);
    });
    b.on('net', () => this.audio.net());
  }

  // ---------------------------------------------------------------- entrada (modo treino da Etapa 1)
  // Toque rápido = passe rasteiro até o ponto. Segurar = chute (quanto mais tempo, mais forte e mais alto).
  createAimMarker() {
    const ring = MeshBuilder.CreateTorus('aimRing', { diameter: 0.9, thickness: 0.06, tessellation: 32 }, this.scene);
    const m = new StandardMaterial('aimMat', this.scene);
    m.emissiveColor = new Color3(1, 0.85, 0.2);
    m.disableLighting = true;
    ring.material = m;
    ring.isPickable = false;
    ring.setEnabled(false);
    this.aimRing = ring;
  }

  groundPointFromScreen(x, y) {
    const rect = this.canvas.getBoundingClientRect();
    const ray = this.scene.createPickingRay(
      (x - rect.left) / rect.width * this.engine.getRenderWidth(),
      (y - rect.top) / rect.height * this.engine.getRenderHeight(),
      null,
      this.cameraRig.camera
    );
    const d = ray.intersectsPlane(GROUND_PLANE);
    if (d === null) return null;
    const p = ray.origin.add(ray.direction.scale(d));
    // limita à área de jogo
    p.x = Math.max(-FIELD.length / 2 - 1, Math.min(FIELD.length / 2 + 1, p.x));
    p.z = Math.max(-FIELD.width / 2, Math.min(FIELD.width / 2, p.z));
    return p;
  }

  bindInput() {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => {
      if (this.paused || this.goalTimer > 0 || this.aim) return;
      const p = this.groundPointFromScreen(e.clientX, e.clientY);
      if (!p) return;
      c.setPointerCapture?.(e.pointerId);
      this.aim = { id: e.pointerId, start: performance.now(), point: p };
      this.aimRing.position.set(p.x, 0.03, p.z);
      this.aimRing.setEnabled(true);
    });
    c.addEventListener('pointermove', (e) => {
      if (!this.aim || e.pointerId !== this.aim.id) return;
      const p = this.groundPointFromScreen(e.clientX, e.clientY);
      if (p) {
        this.aim.point = p;
        this.aimRing.position.set(p.x, 0.03, p.z);
      }
    });
    const release = (e) => {
      if (!this.aim || e.pointerId !== this.aim.id) return;
      const held = (performance.now() - this.aim.start) / 1000;
      const target = this.aim.point;
      this.cancelAim();
      if (e.type === 'pointercancel') return;
      this.kickBallToward(target, held);
    };
    c.addEventListener('pointerup', release);
    c.addEventListener('pointercancel', release);
  }

  cancelAim() {
    this.aim = null;
    this.aimRing.setEnabled(false);
    this.ui.setCharge(0);
  }

  chargeFromHold(held) {
    return Math.max(0, Math.min(1, (held - 0.18) / 0.9));
  }

  kickBallToward(target, held) {
    const b = this.ball;
    const dir = target.subtract(b.position);
    dir.y = 0;
    const dist = dir.length();
    if (dist < 0.2) return;
    const charge = this.chargeFromHold(held);
    if (charge <= 0) {
      // passe rasteiro: velocidade para chegar ao ponto considerando o atrito
      const power = Math.sqrt(2 * 3.4 * dist) + 1.2;
      b.kick(dir, power, 0);
    } else {
      const power = 13 + charge * 19;
      const lift = charge * charge * 7.5 + (charge > 0.2 ? 1 : 0);
      b.kick(dir, power, lift);
    }
  }

  // ---------------------------------------------------------------- HUD, qualidade, ciclo de vida
  updateHud(dt) {
    if (this.aim) this.ui.setCharge(this.chargeFromHold((performance.now() - this.aim.start) / 1000));
    if (this.aimRing.isEnabled()) this.aimRing.rotation.y += dt * 2;
    if (this.settings.get('showFps')) this.ui.setFps(this.engine.getFps(), this.perf.renderDpr);
  }

  updateScoreboard() {
    this.ui.setScore(this.score.home, this.score.away);
  }

  applyQuality() {
    const preset = this.perf.preset;
    this.arena.quality = preset;
    this.arena.keyLight.shadowEnabled = this.perf.level !== 'low';
    this.effects.maxParticles = preset.particles;
  }

  setQuality(mode) {
    this.settings.set('quality', mode);
    this.perf.setMode(mode);
    this.applyQuality();
  }

  setSound(on) {
    this.settings.set('sound', on);
    this.audio.setEnabled(on);
  }

  setFpsCap(cap) {
    this.settings.set('fpsCap', cap);
  }

  resetBall() {
    this.goalTimer = 0;
    this.ui.hideGoal();
    this.ball.reset(0, 0);
    this.cancelAim();
  }

  /** Primeiro toque do usuário: libera áudio e inicia. */
  start() {
    this.audio.unlock();
    this.audio.startCrowd();
    this.audio.whistle(0.35);
    this.started = true;
    this.resume();
  }

  pause() {
    if (this.paused) return;
    this.paused = true;
    this.cancelAim();
    this.audio.suspend();
    this.ui.showPause(true);
  }

  resume() {
    this.paused = false;
    this.lastFrame = 0;
    this.accumulator = 0;
    this.audio.resume();
    this.ui.showPause(false);
  }

  bindLifecycle() {
    // pausa automática quando a página perde o foco (troca de app, bloqueio de tela)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.started) this.pause();
    });
    window.addEventListener('blur', () => {
      if (this.started) this.pause();
    });
  }

  onResize() {
    this.engine.resize();
    this.cameraRig.updateAspect(this.canvas);
  }
}
