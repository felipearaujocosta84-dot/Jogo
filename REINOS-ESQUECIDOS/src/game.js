// Núcleo do jogo: cria a cena e conecta mundo, jogador, inimigos, sistemas e interface.
import {
  Scene, Vector3, Color3, Color4, HemisphericLight, DirectionalLight, ShadowGenerator
} from './babylon.js';
import { WorldManager } from './world/worldManager.js';
import { Player } from './player/player.js';
import { EnemyManager, Enemy } from './enemies/enemy.js';
import { allTemplateMeshes } from './enemies/enemyModels.js';
import { Inventory, ITEMS } from './systems/inventory.js';
import { QuestSystem, QUESTS } from './systems/quests.js';
import { SaveSystem } from './systems/save.js';
import { Interaction } from './systems/interaction.js';
import { AudioManager } from './systems/audio.js';
import { Effects } from './systems/effects.js';
import { IsometricCamera } from './camera/isometricCamera.js';
import { HUD } from './ui/hud.js';
import { Input } from './ui/joystick.js';
import { Menus } from './ui/menus.js';
import { QUALITY, START_POS, SETTINGS_KEY, GAME_VERSION } from './config.js';
import { OCCLUSION } from './world/occlusion.js';

const DAY_LENGTH = 16 * 60; // segundos por dia completo

function detectLevel() {
  const mem = navigator.deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;
  const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  if (!mobile && mem >= 4) return 'high';
  if (mem <= 2 || cores <= 4) return 'low';
  return 'medium';
}

export class Game {
  constructor(engine, canvas) {
    this.engine = engine;
    this.canvas = canvas;
    this.version = GAME_VERSION;
    this.time = 0;
    this.playTime = 0;
    this.dayTime = 0.32;
    this.state = 'loading';
    this.hitStopT = 0;
    this.settings = this.loadSettings();
    this.qualityLevel = this.settings.quality === 'auto' ? detectLevel() : this.settings.quality;
    this.quality = QUALITY[this.qualityLevel];
    this.fogTarget = new Color3(0.78, 0.86, 0.92);
    this.fogBase = this.fogTarget.clone();
    this.fpsSamples = [];
    this.perfTimer = 0;
  }

  loadSettings() {
    const def = { quality: 'auto', sfx: 0.8, music: 0.45, fps30: false, showFps: false };
    try { return { ...def, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; } catch { return def; }
  }

  saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings)); } catch { /* ignora */ }
  }

  applySettings() {
    const s = this.settings;
    const lvl = s.quality === 'auto' ? (this.autoLevel || detectLevel()) : s.quality;
    if (lvl !== this.qualityLevel) {
      this.qualityLevel = lvl;
      this.quality = QUALITY[lvl];
      this.applyQuality();
    }
    this.audio.setVolumes(s.sfx, s.music);
    this.saveSettings();
  }

  applyQuality() {
    const q = this.quality;
    this.dpr = Math.min(window.devicePixelRatio || 1, q.maxDpr);
    this.renderDpr = this.dpr;
    this.engine.setHardwareScalingLevel(1 / this.renderDpr);
    if (this.shadowGen) {
      this.shadowGen.getShadowMap().refreshRate = q.shadows ? 1 : 0;
      this.sun.shadowEnabled = q.shadows;
      if (q.shadows) this.shadowGen.mapSize = q.shadowSize;
    }
    if (this.scene) {
      this.scene.fogEnd = q.viewDist;
      this.scene.fogStart = q.viewDist * 0.4;
    }
    if (this.world && this.world.vegetation) this.world.vegetation.applyQuality();
  }

  async init(progress = () => {}) {
    const scene = new Scene(this.engine);
    this.scene = scene;
    scene.skipPointerMovePicking = true;
    scene.fogMode = Scene.FOGMODE_LINEAR;
    scene.fogStart = 55;
    scene.fogEnd = 120;
    scene.fogColor = this.fogBase.clone();
    scene.ambientColor = new Color3(0.25, 0.25, 0.25);

    // luzes
    const hemi = new HemisphericLight('hemi', new Vector3(0.2, 1, 0.1), scene);
    hemi.intensity = 0.62;
    hemi.groundColor = new Color3(0.32, 0.3, 0.26);
    this.hemi = hemi;
    const sun = new DirectionalLight('sun', new Vector3(-0.5, -1, 0.35).normalize(), scene);
    sun.intensity = 1.25;
    sun.autoUpdateExtends = false;
    sun.shadowFrustumSize = 44;
    sun.shadowMinZ = 1;
    sun.shadowMaxZ = 160;
    this.sun = sun;
    const sg = new ShadowGenerator(this.quality.shadowSize, sun);
    sg.bias = 0.0015;
    sg.normalBias = 0.02;
    sg.usePercentageCloserFiltering = this.qualityLevel === 'high';
    sg.filteringQuality = ShadowGenerator.QUALITY_LOW;
    sg.darkness = 0.35;
    this.shadowGen = sg;

    this.audio = new AudioManager();
    this.effects = new Effects(this);
    this.inventory = new Inventory(this);
    this.quests = new QuestSystem(this);
    this.save = new SaveSystem(this);
    progress(0.08, 'Carregando o Vale Verde…');

    this.world = new WorldManager(this);
    this.player = null;
    await this.world.load((p) => progress(0.08 + p * 0.45, 'Carregando o Vale Verde…'));
    progress(0.56, 'Despertando o herói…');

    this.player = new Player(this);
    await this.player.load();
    this.player.teleport(START_POS.x, START_POS.z, Math.PI * 0.75);
    this.inventory.reset();
    progress(0.75, 'Povoando os reinos…');

    this.cameraRig = new IsometricCamera(this);
    this.cameraRig.snapTo(this.player.position);
    this.enemies = new EnemyManager(this);
    this.enemies.spawnAll();
    this.interaction = new Interaction(this);
    this.interaction.build();
    for (const f of this.world.regions.campfires) {
      this.effects.fire(new Vector3(f.x, this.world.groundAt(f.x, f.z) + 0.15, f.z), 1, f.light);
    }
    for (const m of allTemplateMeshes()) this.shadowGen.addShadowCaster(m);
    progress(0.88, 'Preparando a interface…');

    this.hud = new HUD(this);
    this.input = new Input(this, this.canvas);
    this.menus = new Menus(this);
    this.hud.buildMinimapImage();
    this.hud.show(false);
    this.applyQuality();
    this.audio.setVolumes(this.settings.sfx, this.settings.music);
    this.updateDayCycle(0);

    // compila materiais antes de mostrar
    await scene.whenReadyAsync();
    progress(1, 'Pronto!');

    scene.onBeforeRenderObservable.add(() => this.frame());
    this.state = 'menu';
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.audio.suspend();
        if (this.state === 'playing') {
          this.save.save(true);
          if (!this.menus.isOpen) this.menus.open('pause');
        }
      } else this.audio.resume();
    });
  }

  addShadowCaster(mesh) {
    if (this.shadowGen) this.shadowGen.addShadowCaster(mesh, false);
  }

  // ---------------- ESTADOS ----------------
  startGame(fresh) {
    this.audio.unlock();
    this.requestFullscreen();
    const p = this.player;
    if (fresh || !this.save.has()) {
      this.save.clear();
      Object.assign(p, { level: 1, xp: 0, maxHp: 100, hp: 100, maxStamina: 100, stamina: 100, baseAttack: 6, dead: false });
      this.inventory.reset();
      this.quests.reset();
      this.interaction.deserialize(null);
      this.dayTime = 0.3;
      this.playTime = 0;
      p.teleport(START_POS.x, START_POS.z, Math.PI * 0.75);
    } else {
      const data = this.save.read();
      this.quests.reset();
      if (data) this.save.apply(data);
    }
    p.dead = false;
    p.action = null;
    p.model.rotation.set(0, 0, 0);
    p.setEquipmentLook(ITEMS[this.inventory.weapon]);
    this.enemies.resetAll();
    this.hud.setBoss(null);
    this.world.regions.current = null;
    this.state = 'playing';
    document.body.classList.add('ingame');
    this.menus.close();
    this.hud.show(true);
    this.input.reset();
    this.cameraRig.targetRadius = 14;
    this.cameraRig.snapTo(p.position);
    if (fresh) {
      setTimeout(() => this.hud.toast('Fale com o Ancião Bento (!) perto do poço.', 4), 2200);
    }
    this.save.save(true);
  }

  toMainMenu() {
    this.state = 'menu';
    document.body.classList.remove('ingame');
    this.hud.show(false);
    this.hud.setBoss(null);
    this.enemies.hideTelegraph();
    this.menus.open('main');
  }

  onMenuChanged(name) {
    this.input.enabled = !name;
    if (name) this.input.reset();
    this.hud.root.classList.toggle('dim', !!name && this.state === 'playing');
  }

  get paused() {
    return this.state !== 'playing' || this.menus.isOpen;
  }

  requestFullscreen() {
    const el = document.documentElement;
    if (document.fullscreenElement || !/Android|Mobile/i.test(navigator.userAgent)) return;
    const p = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : null;
    if (p && p.then) p.then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {})).catch(() => {});
  }

  toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => {});
  }

  // ---------------- EVENTOS ----------------
  isSafeZone(x, z) {
    const r = this.world.regions.get('aldeia');
    return Math.hypot(x - r.x, z - r.z) < r.r - 1;
  }

  npcName(id) { return this.interaction.npcName(id); }

  talkTo(npc) {
    this.player.play('interact');
    this.menus.open('dialog', npc);
  }

  onRegionChanged(r, prev) {
    if (prev || this.state === 'playing') this.hud.showRegion(r.name, r.sub);
    this.fogTarget = new Color3(...r.fog);
  }

  onEnemyKilled(e) {
    this.quests.onKill(e.type);
    if (e.def.boss) {
      this.hud.setBoss(null);
      this.enemies.hideTelegraph();
      this.cameraRig.shake(0.5);
      this.effects.levelUp(e.position.add(new Vector3(0, 1, 0)));
      setTimeout(() => { if (this.state === 'playing') this.menus.open('victory'); }, 2200);
      this.save.save(true);
    }
  }

  onBossAwake(e) {
    this.hud.setBoss(e);
    this.hud.toast('O Rei Esquecido despertou!', 3);
    this.audio.bossRoar();
    this.cameraRig.shake(0.4);
  }

  onBossReset(e) {
    this.hud.setBoss(null);
    e.summoned = false;
    e.hp = e.maxHp;
    this.enemies.hideTelegraph();
  }

  onBossSummon(e) {
    this.hud.toast('O Rei invoca seus guardas!', 2.5);
    for (let i = 0; i < 2; i++) {
      const a = e.yaw + (i ? 1.2 : -1.2);
      const x = e.position.x + Math.sin(a) * 3, z = e.position.z + Math.cos(a) * 3;
      const s = new Enemy(this, 'esqueleto', x, z, 1000 + Math.floor(Math.random() * 1e6));
      s.target = this.player;
      s.setState('chase');
      s.respawnAt = Infinity;
      s.summoned = true;
      this.effects.burst(new Vector3(x, s.position.y + 0.5, z), { count: 30, color: new Color4(0.5, 0.8, 1, 1), power: 3, up: 2, life: 0.9 });
      this.enemies.list.push(s);
    }
  }

  onLevelUp(level) {
    this.hud.showLevelUp(level);
    this.audio.levelUp();
    this.effects.levelUp(this.player.position.add(new Vector3(0, 0.5, 0)));
  }

  onQuestUpdate(id, what) {
    const q = QUESTS[id];
    if (what === 'accepted') { this.hud.toast('Nova missão: ' + q.title, 3); this.audio.quest(); }
    if (what === 'progress') this.hud.toast(this.quests.objectiveText(id));
    if (what === 'ready') { this.hud.toast(`${q.title}: objetivo cumprido! Volte para ${this.npcName(q.giver)}.`, 3.5); this.audio.quest(); }
    if (what === 'done') { this.hud.toast('Missão concluída: ' + q.title, 3); this.audio.levelUp(); this.save.save(true); }
  }

  onInventoryChanged() { /* o HUD lê o inventário a cada quadro */ }

  onPlayerDeath() {
    this.hud.setBoss(null);
    this.enemies.hideTelegraph();
    setTimeout(() => this.menus.open('death'), 1700);
  }

  respawn() {
    const p = this.player;
    const lost = Math.floor(this.inventory.gold * 0.1);
    this.inventory.gold -= lost;
    p.dead = false;
    p.hp = p.maxHp;
    p.stamina = p.maxStamina;
    p.action = null;
    p.model.rotation.set(0, 0, 0);
    p.teleport(START_POS.x, START_POS.z, Math.PI * 0.75);
    this.cameraRig.snapTo(p.position);
    for (const e of this.enemies.list) {
      if (e.alive && (e.state === 'chase' || e.state === 'attack' || e.state === 'recover' || e.state === 'special')) e.setState('return');
      e.special = 0;
    }
    if (lost) this.hud.toast(`Você perdeu ${lost} de ouro.`);
    this.save.save(true);
  }

  hitStop(t) { this.hitStopT = Math.max(this.hitStopT, t); }

  /** Empurra um círculo para fora dos personagens (inimigos vivos e NPCs). */
  resolveAgainstCharacters(pos, radius, self) {
    for (const e of this.enemies.list) {
      if (e === self || !e.alive || !e.active) continue;
      const dx = pos.x - e.position.x, dz = pos.z - e.position.z;
      const min = radius + e.radius;
      const d2 = dx * dx + dz * dz;
      if (d2 < min * min && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        pos.x = e.position.x + (dx / d) * min;
        pos.z = e.position.z + (dz / d) * min;
      }
    }
    for (const n of this.interaction.npcs) {
      const dx = pos.x - n.x, dz = pos.z - n.z;
      const min = radius + n.radius;
      const d2 = dx * dx + dz * dz;
      if (d2 < min * min && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        pos.x = n.x + (dx / d) * min;
        pos.z = n.z + (dz / d) * min;
      }
    }
  }

  // ---------------- CICLO DE DIA ----------------
  updateDayCycle(dt) {
    this.dayTime = (this.dayTime + dt / DAY_LENGTH) % 1;
    const t = this.dayTime;
    // 0.25 nascer do sol, 0.5 meio-dia, 0.75 pôr do sol
    const sunAng = (t - 0.25) * Math.PI * 2;
    const elev = Math.sin(sunAng); // >0 de dia
    const day = Math.max(0, Math.min(1, elev * 2.5 + 0.35));
    const dusk = Math.max(0, 1 - Math.abs(elev) * 4) * (elev > -0.3 ? 1 : 0);
    // direção do sol (ou da lua à noite)
    const h = elev > 0 ? elev : -elev * 0.8;
    const dir = new Vector3(-Math.cos(sunAng) * 0.8, -Math.max(0.35, h), 0.45).normalize();
    this.sun.direction.copyFrom(dir);
    const sunCol = new Color3(1, 0.95, 0.86);
    const duskCol = new Color3(1, 0.6, 0.35);
    const moonCol = new Color3(0.55, 0.65, 0.95);
    let col = Color3.Lerp(moonCol, sunCol, day);
    col = Color3.Lerp(col, duskCol, dusk * 0.6);
    this.sun.diffuse = col;
    this.sun.intensity = 0.45 + day * 0.85;
    this.hemi.intensity = 0.38 + day * 0.3;
    this.hemi.diffuse = Color3.Lerp(new Color3(0.55, 0.62, 0.85), new Color3(1, 1, 1), day);
    // céu
    const topDay = new Color3(0.3, 0.52, 0.85), topNight = new Color3(0.04, 0.06, 0.14), topDusk = new Color3(0.32, 0.3, 0.55);
    const horDay = new Color3(0.78, 0.86, 0.92), horNight = new Color3(0.12, 0.15, 0.25), horDusk = new Color3(0.95, 0.62, 0.42);
    let top = Color3.Lerp(topNight, topDay, day);
    top = Color3.Lerp(top, topDusk, dusk * 0.6);
    let hor = Color3.Lerp(horNight, horDay, day);
    hor = Color3.Lerp(hor, horDusk, dusk * 0.7);
    // névoa da região
    this.fogBase = Color3.Lerp(this.fogBase, this.fogTarget, Math.min(1, dt * 0.8));
    const fog = new Color3(hor.r * this.fogBase.r / 0.78, hor.g * this.fogBase.g / 0.86, hor.b * this.fogBase.b / 0.92);
    this._skyTimer = (this._skyTimer || 0) - dt;
    if (this._skyTimer <= 0 || dt === 0) {
      this._skyTimer = 0.5;
      this.world.setSkyColors(top, fog);
    }
    this.night = 1 - day;
  }

  // ---------------- QUADRO ----------------
  frame() {
    let dt = Math.min(0.05, this.engine.getDeltaTime() / 1000);
    if (!this.player) return;
    this.measurePerformance(dt);

    // pausa de impacto ("hit stop")
    if (this.hitStopT > 0) {
      this.hitStopT -= dt;
      dt *= 0.08;
    }

    if (this.state === 'menu') {
      // câmera gira devagar pela aldeia no menu
      this.time += dt;
      this.cameraRig.rotate(dt * 0.06);
      this.cameraRig.targetRadius = 20;
      this.player.update(dt, { x: 0, y: 0, magnitude: 0 });
      this.cameraRig.update(dt);
      this.updateOcclusion();
      this.world.update(dt);
      this.effects.update(dt);
      return;
    }
    if (this.state !== 'playing') return;
    if (this.paused) {
      this.cameraRig.update(0.016);
      return;
    }

    this.time += dt;
    this.playTime += dt;
    const input = this.input.poll();
    if (input.interact) this.interaction.interact();
    this.player.update(dt, input);
    this.enemies.update(dt);
    this.interaction.update(dt);
    this.world.update(dt);
    this.effects.update(dt);
    this.cameraRig.update(dt);
    this.updateDayCycle(dt);
    this.audio.combat = this.enemies.inCombat ? 1 : 0;

    // a luz do sol acompanha o jogador (sombras só onde importa)
    const p = this.player.position;
    this.sun.position.set(p.x - this.sun.direction.x * 70, p.y - this.sun.direction.y * 70, p.z - this.sun.direction.z * 70);

    this.updateOcclusion();
    this.hud.update(dt);
    this.save.update(dt);
  }

  updateOcclusion() {
    const p = this.player.position;
    OCCLUSION.player.set(p.x, p.y + 1.1, p.z);
    OCCLUSION.cam.copyFrom(this.cameraRig.cam.position);
  }

  /** Resolução adaptável: reduz pixels se o FPS cair (modo automático). */
  measurePerformance(dt) {
    if (dt <= 0) return;
    this.fpsSamples.push(1 / dt);
    if (this.fpsSamples.length > 60) this.fpsSamples.shift();
    this.perfTimer += dt;
    if (this.perfTimer < 2.5 || this.settings.quality !== 'auto') return;
    this.perfTimer = 0;
    const avg = this.fpsSamples.reduce((a, b) => a + b, 0) / this.fpsSamples.length;
    const target = this.settings.fps30 ? 30 : 60;
    if (avg < target * 0.7 && this.renderDpr > 0.75) {
      this.renderDpr = Math.max(0.75, this.renderDpr - 0.15);
      this.engine.setHardwareScalingLevel(1 / this.renderDpr);
    } else if (avg > target * 0.93 && this.renderDpr < this.dpr) {
      this.renderDpr = Math.min(this.dpr, this.renderDpr + 0.1);
      this.engine.setHardwareScalingLevel(1 / this.renderDpr);
    }
  }
}
