// Núcleo do jogo: motor, cena, laço com passo fixo, jogadores, IA, controles e pausa automática.
import { Engine, Scene, Vector3, MeshBuilder, StandardMaterial, Color3 } from './babylon.js';
import { PHYSICS, TEAMS } from './config.js';
import { createArena } from './stadium/arenas.js';
import { Ball } from './ball/Ball.js';
import { BroadcastCamera } from './camera/BroadcastCamera.js';
import { AudioManager } from './audio/AudioManager.js';
import { Effects } from './effects/Effects.js';
import { Performance } from './core/Performance.js';
import { Settings } from './core/Settings.js';
import { Team } from './player/Team.js';
import { Player } from './player/Player.js';
import { PlayerAI } from './player/PlayerAI.js';
import { preloadPlayerModel } from './player/ModelFactory.js';
import { MobileControls } from './controls/MobileControls.js';

export class Game {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} ui funções do HUD (ver main.js)
   * @param {HTMLElement} controlsRoot container dos controles virtuais
   */
  constructor(canvas, ui, controlsRoot) {
    this.canvas = canvas;
    this.ui = ui;
    this.controlsRoot = controlsRoot;
    this.settings = new Settings();
    this.paused = true;
    this.started = false;
    this.accumulator = 0;
    this.lastFrame = 0;
    this.score = { home: 0, away: 0 };
    this.goalTimer = 0;       // > 0 durante a comemoração do gol
    this.human = null;        // jogador controlado pelo usuário
    this.pendingKicks = new Map();
    this.camTarget = new Vector3();
    this.simTime = 0;
    this.lastTeamTouch = { home: -10, away: -10 };
    this.contestAnchor = null;
    this.contestTime = 0;
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
    await this.nextFrame();

    onProgress(15, 'Construindo a quadra');
    this.arena = createArena(this.settings.get('arena'), this.scene, this.perf.preset);
    await this.nextFrame();

    onProgress(45, 'Criando jogadores');
    await preloadPlayerModel(this.scene);
    this.home = new Team('home', TEAMS.home, 3);
    this.away = new Team('away', TEAMS.away, 11);
    this.home.opponent = this.away;
    this.away.opponent = this.home;
    await this.home.createPlayers(this.scene, this.arena.shadowGenerator, ['Gol', 'Tito', 'Rafa']);
    await this.away.createPlayers(this.scene, this.arena.shadowGenerator, ['Gol', 'Duda', 'Leo']);
    this.players = [...this.home.players, ...this.away.players];
    for (const p of this.players) {
      p.ai = new PlayerAI(p);
      p.onAction = (player, name, phase) => this.onPlayerAction(player, name, phase);
    }
    this.createMarkers();
    await this.nextFrame();

    onProgress(65, 'Preparando bola e câmera');
    this.ball = new Ball(this.scene, this.arena.shadowGenerator);
    this.cameraRig = new BroadcastCamera(this.scene, this.canvas);
    this.effects = new Effects(this.scene, this.perf.preset.particles);
    this.audio = new AudioManager();
    this.audio.setEnabled(this.settings.get('sound'));
    this.controls = new MobileControls(this.controlsRoot, ['shoot', 'sprint', 'switch']);
    this.applyQuality();
    this.bindBallEvents();
    this.bindLifecycle();
    this.kickoff('home', true);

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

  // ---------------------------------------------------------------- marcadores (jogador controlado, times)
  createMarkers() {
    const scene = this.scene;
    const mk = (name, hex, alpha) => {
      const m = new StandardMaterial(name, scene);
      m.diffuseColor = Color3.Black();
      m.specularColor = Color3.Black();
      m.emissiveColor = Color3.FromHexString(hex);
      m.disableLighting = true;
      m.alpha = alpha;
      return m;
    };
    // disco discreto com a cor do time sob cada jogador (leitura rápida de quem é quem)
    const teamMat = { home: mk('discHome', TEAMS.home.color, 0.35), away: mk('discAway', TEAMS.away.color, 0.35) };
    for (const p of this.players) {
      const d = MeshBuilder.CreateDisc('disc_' + p.team.id + p.index, { radius: 0.42, tessellation: 20 }, scene);
      d.rotation.x = Math.PI / 2;
      d.material = teamMat[p.team.id];
      d.isPickable = false;
      p.disc = d;
    }
    // anel + seta do jogador controlado
    const ringMat = mk('humanRingMat', '#ffd23f', 1);
    const ring = MeshBuilder.CreateTorus('humanRing', { diameter: 1.0, thickness: 0.07, tessellation: 32 }, scene);
    ring.material = ringMat;
    ring.isPickable = false;
    const arrow = MeshBuilder.CreateCylinder('humanArrow', { diameterTop: 0.32, diameterBottom: 0, height: 0.32, tessellation: 3 }, scene);
    arrow.material = ringMat;
    arrow.isPickable = false;
    // indicador de direção (mostra para onde o jogador está virado)
    const dir = MeshBuilder.CreateCylinder('humanDir', { diameterTop: 0, diameterBottom: 0.28, height: 0.4, tessellation: 3 }, scene);
    dir.rotation.x = Math.PI / 2;
    dir.bakeCurrentTransformIntoVertices();
    dir.material = ringMat;
    dir.isPickable = false;
    this.humanRing = ring;
    this.humanArrow = arrow;
    this.humanDir = dir;
  }

  updateMarkers(dt) {
    for (const p of this.players) p.disc.position.set(p.position.x, 0.015, p.position.z);
    const h = this.human;
    if (!h) return;
    this.humanRing.position.set(h.position.x, 0.03, h.position.z);
    this.humanArrow.position.set(h.position.x, 2.25 + Math.sin(performance.now() / 180) * 0.06, h.position.z);
    this.humanArrow.rotation.y += dt * 3;
    const f = h.forward;
    this.humanDir.position.set(h.position.x + f.x * 0.75, 0.04, h.position.z + f.z * 0.75);
    this.humanDir.rotation.y = h.yaw;
  }

  setHuman(player) {
    if (this.human) this.human.isHuman = false;
    this.human = player;
    player.isHuman = true;
    player.setInput(new Vector3(), 0, false);
    this.ui.setControlled(player);
  }

  /** Troca para o companheiro de linha mais perto da bola (diferente do atual). */
  switchPlayer() {
    const team = this.human.team;
    const options = team.fieldPlayers.filter((p) => p !== this.human);
    if (!options.length) return;
    options.sort((a, b) => a.distanceTo(this.ball.position) - b.distanceTo(this.ball.position));
    this.setHuman(options[0]);
    this.audio.ui();
  }

  // ---------------------------------------------------------------- laço principal
  frame() {
    const now = performance.now();
    let dt = this.lastFrame ? (now - this.lastFrame) / 1000 : 1 / 60;
    const cap = this.settings.get('fpsCap');
    if (cap && cap < 60 && dt < 1 / cap - 0.002) return;
    // pausado: renderiza a ~8 FPS só para manter a imagem (economiza bateria)
    if (this.paused && this.started && dt < 0.125) return;
    this.lastFrame = now;
    dt = Math.min(dt, 0.25);

    if (!this.paused) {
      this.handleInput(dt);
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
    this.updateMarkers(dt);
    // câmera: principalmente a bola, um pouco o jogador controlado
    const b = this.ball.position;
    const h = this.human ? this.human.position : b;
    this.camTarget.set(b.x * 0.75 + h.x * 0.25, 0, b.z * 0.75 + h.z * 0.25);
    this.cameraRig.update(dt, this.camTarget);
    this.perf.update(dt, cap);
    this.updateHud();
    this.scene.render();
  }

  handleInput(dt) {
    const c = this.controls;
    const mv = c.read(dt);
    const { pressed } = c.consume();
    const h = this.human;
    if (!h) return;
    if (this.goalTimer > 0) {
      h.setInput(new Vector3(), 0, false);
      return;
    }
    // tela: x = direita, y = cima  →  mundo: +X, +Z (câmera lateral olhando para +Z)
    h.setInput(new Vector3(mv.x, 0, mv.y), mv.magnitude, !!c.held.sprint);
    if (pressed.switch) this.switchPlayer();
    if (pressed.shoot) this.tryKick(this.human, mv);
  }

  /** Chute simples da Etapa 2 (a Etapa 3 traz posse, passe e chute com força/direção). */
  tryKick(player, mv) {
    if (player.busy) return;
    const b = this.ball.position;
    const dist = player.distanceTo(b);
    let dir = player.forward;
    if (mv && mv.magnitude > 0.2) dir = new Vector3(mv.x, 0, mv.y).normalize();
    if (dist < 1.6 && b.y < 0.9) {
      // vira o corpo para a direção do chute
      player.yaw = Math.atan2(dir.x, dir.z);
      this.pendingKicks.set(player, { dir, power: 19, lift: 2.2 });
    }
    player.playAction('kick');
  }

  onPlayerAction(player, name, phase) {
    if (phase !== 'contact') return;
    const k = this.pendingKicks.get(player);
    if (!k) return;
    this.pendingKicks.delete(player);
    const b = this.ball.position;
    if (player.distanceTo(b) < 1.7 && b.y < 1.0) {
      this.ball.kick(k.dir, k.power, k.lift, 0, player);
    }
  }

  simulate(dt) {
    this.simTime += dt;
    const ctx = { ball: this.ball, human: this.human, game: this, kickoffTeam: this.kickoffTeam, dt };
    const celebrating = this.goalTimer > 0;
    for (const p of this.players) {
      if (!p.isHuman) {
        if (celebrating) p.setInput(new Vector3(), 0, false, this.ball.position);
        else p.ai.update(dt, ctx);
      }
      p.update(dt);
    }
    Player.resolveCollisions(this.players);
    for (const p of this.players) p.clampToCourt();

    this.ball.step(dt, this.arena);
    if (!celebrating) {
      let touched = false;
      const teamsTouching = new Set();
      for (const p of this.players) {
        if (p.interactBall(this.ball)) {
          touched = true;
          teamsTouching.add(p.team.id);
          if (this.kickoffTeam && p.team.id === this.kickoffTeam) this.kickoffTeam = null;
        }
      }
      // dividida: os dois times disputando a bola sem ela sair do lugar → a bola espirra (evita bola "presa")
      const now = this.simTime;
      for (const id of teamsTouching) this.lastTeamTouch[id] = now;
      const contested = now - this.lastTeamTouch.home < 0.35 && now - this.lastTeamTouch.away < 0.35;
      if (contested) {
        if (!this.contestAnchor) { this.contestAnchor = this.ball.position.clone(); this.contestTime = 0; }
        this.contestTime += dt;
        if (this.contestTime > 0.8) {
          if (Vector3.Distance(this.contestAnchor, this.ball.position) < 1.2) {
            // espirra para o lado mais aberto (em direção ao centro), por cima da disputa
            const b = this.ball.position;
            const a = Math.atan2(-b.z, -b.x) + (Math.random() - 0.5) * 1.6;
            const v = this.ball.velocity;
            v.set(Math.cos(a) * 4.5, 4 + Math.random() * 1.5, Math.sin(a) * 4.5);
            this.ball.lastTouch = null;
            this.ball.freeTimer = 0.4;
            this.audio.bounce(6);
          }
          this.contestAnchor = null;
        }
      } else this.contestAnchor = null;
      // o empurrão do jogador nunca pode tirar a bola da quadra
      if (touched) this.arena.resolveBallCollisions(this.ball);
    }
    if (this.kickoffTeam && this.ball.speed > 0.5 && this.ball.lastTouch) this.kickoffTeam = null;

    if (celebrating) {
      this.goalTimer -= dt;
      if (this.goalTimer <= 0) this.kickoff(this.lastConceded || 'home');
      return;
    }
    if (this.arena.goals.positive.isGoal(this.ball)) this.onGoal(this.home.attackDir > 0 ? 'home' : 'away', this.arena.goals.positive);
    else if (this.arena.goals.negative.isGoal(this.ball)) this.onGoal(this.home.attackDir > 0 ? 'away' : 'home', this.arena.goals.negative);
  }

  onGoal(teamId, goal) {
    this.score[teamId]++;
    this.goalTimer = 3.2;
    this.lastConceded = teamId === 'home' ? 'away' : 'home';
    this.updateScoreboard();
    this.audio.goal();
    this.arena.celebrate(1);
    this.effects.goalBurst(goal.mouthCenter);
    this.cameraRig.zoomBoost = 1;
    this.cameraRig.addShake(0.8);
    this.ui.showGoal(TEAMS[teamId]);
    const team = teamId === 'home' ? this.home : this.away;
    for (const p of team.players) p.playAction('celebrate');
  }

  /** Coloca todos em posição de saída. kickingTeam dá a saída de bola. */
  kickoff(kickingTeam, instant = false) {
    this.home.resetToKickoff(kickingTeam === 'home');
    this.away.resetToKickoff(kickingTeam === 'away');
    this.ball.reset(0, 0);
    this.ball.lastTouch = null;
    this.kickoffTeam = kickingTeam; // até a saída, o adversário fica fora do círculo central
    this.pendingKicks.clear();
    this.ui.hideGoal();
    // o usuário controla o time da casa; começa com o jogador mais perto da bola
    const pick = [...this.home.fieldPlayers].sort((a, b) => a.distanceTo(this.ball.position) - b.distanceTo(this.ball.position))[0];
    this.setHuman(pick);
    if (instant) this.cameraRig.snapTo(this.ball.position);
    if (this.started) this.audio.whistle(0.3);
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

  // ---------------------------------------------------------------- HUD, qualidade, ciclo de vida
  updateHud() {
    if (this.settings.get('showFps')) this.ui.setFps(this.engine.getFps(), this.perf.renderDpr);
    if (this.human) this.ui.setStamina(this.human.stamina);
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

  /** Botão de reinício: todos voltam às posições de saída. */
  restartPositions() {
    this.goalTimer = 0;
    this.kickoff('home');
  }

  /** Primeiro toque do usuário: libera áudio e inicia. */
  start() {
    this.audio.unlock();
    this.audio.startCrowd();
    this.audio.whistle(0.35);
    this.started = true;
    this.controls.setVisible(true);
    this.resume();
  }

  pause() {
    if (this.paused) return;
    this.paused = true;
    this.controls.reset();
    this.audio.suspend();
    this.ui.showPause(true);
  }

  resume() {
    this.paused = false;
    this.lastFrame = 0;
    this.accumulator = 0;
    this.controls.reset();
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
