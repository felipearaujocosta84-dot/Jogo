// =============================================================
// EXTREME RACING — Game
// Orquestra o jogo: carregamento, menu com showroom 3D, garagem,
// configurações, corridas (rápida, treino, contra o relógio) e o
// campeonato de 4 etapas.
// =============================================================
import { SceneManager } from './SceneManager.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { GraphicsSettings } from '../systems/GraphicsSettings.js';
import { AudioManager } from '../audio/AudioManager.js';
import { GarageManager } from '../garage/GarageManager.js';
import { ShowroomScene } from '../garage/ShowroomScene.js';
import { MainMenu } from '../ui/MainMenu.js';
import { GarageUI } from '../ui/GarageUI.js';
import { SettingsUI } from '../ui/SettingsUI.js';
import { RaceSession } from '../race/RaceSession.js';
import { TRACKS } from '../tracks/TrackManager.js';
import { h } from '../ui/dom.js';
import { reportOptionalAssets } from './AssetManager.js';
import { Achievements } from '../systems/Achievements.js';
import { NativeBridge } from './NativeBridge.js';
import { DebugLog } from '../utils/DebugLog.js';
import { toast } from '../ui/dom.js';

const CHAMP_POINTS = [25, 18, 15, 12, 10, 8, 6, 4];
const CHAMP_NAMES = ['VOCÊ', 'R. Valente', 'M. Okafor', 'L. Brandt', 'S. Moreau', 'K. Tanaka'];
const CHAMP_PRIZE = { easy: 15000, medium: 30000, hard: 50000, expert: 80000 };

export class Game {
  constructor(canvas, uiRoot) {
    this.canvas = canvas;
    this.uiRoot = uiRoot;
    this.loadingEl = document.getElementById('loading');
    this.loadingFill = document.getElementById('loading-fill');
    this.loadingText = document.getElementById('loading-text');
  }

  async boot() {
    this.progress(0.05, 'Iniciando motor gráfico…');
    this.sceneManager = new SceneManager(this.canvas);
    this.save = new SaveSystem();
    this.graphics = new GraphicsSettings(this.sceneManager.engine, this.save);
    try {
      const e = this.sceneManager.engine;
      DebugLog.info(`Aparelho: ${navigator.userAgent}`);
      DebugLog.info(`WebGL ${e.webGLVersion} • ${e.getGlInfo()?.renderer} • qualidade ${this.graphics.preset.label} (detectado: ${this.graphics.detected})`);
    } catch { /* ok */ }
    this.audio = new AudioManager(this.save.settings);
    this.garage = new GarageManager(this.save);
    this._initAchievements();
    this.menu = new MainMenu(this);
    this.sceneManager.onFrame = (dt) => this.session?.frame(dt);
    this.sceneManager.start();
    this.progress(0.3, 'Carregando física (Havok)…');
    await this.sceneManager.initPhysics();
    this.progress(0.5, 'Procurando sons…');
    await this.audio.preloadSamples();
    this.progress(0.6, 'Montando o showroom…');
    await this.showMenu();
    this.progress(1, 'Pronto');
    this.hideLoading();
    reportOptionalAssets();
    this.native = new NativeBridge(this);
    this.native.init();
    // Esconde a tela de abertura nativa (splash) quando o menu estiver pronto
    if (window.Capacitor?.isNativePlatform?.()) {
      import('@capacitor/splash-screen').then(({ SplashScreen }) => SplashScreen.hide()).catch(() => {});
    }
    // Primeiro toque: libera áudio, tela cheia e orientação horizontal
    const unlock = () => {
      this.audio.unlock();
      try {
        const el = document.documentElement;
        if (!document.fullscreenElement && el.requestFullscreen && !window.Capacitor) {
          el.requestFullscreen({ navigationUI: 'hide' }).then(() => screen.orientation?.lock?.('landscape')).catch(() => {});
        } else screen.orientation?.lock?.('landscape').catch(() => {});
      } catch { /* sem suporte */ }
      window.removeEventListener('pointerdown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
  }

  _initAchievements() {
    this.achievements = new Achievements(this.save.data, (a) => {
      this.garage.addCredits(a.reward);
      this.save.save();
      const msg = `🏆 CONQUISTA: ${a.title} (+${a.reward.toLocaleString('pt-BR')} CR)`;
      if (this.session?.hud && !this.session.finished) this.session.hud.message(msg, 3200);
      else toast(this.uiRoot, msg, 3200);
      this.audio.beep(true);
    });
    this.achievements.garageChanged(this.save.data.garage);
    this.garage.onChange = () => this.achievements.garageChanged(this.save.data.garage);
  }

  progress(p, text) {
    this.loadingEl.classList.remove('hidden', 'fade');
    this.loadingFill.style.width = `${Math.round(p * 100)}%`;
    if (text) this.loadingText.textContent = text;
  }

  hideLoading() {
    this.loadingEl.classList.add('fade');
    setTimeout(() => this.loadingEl.classList.add('hidden'), 450);
  }

  async showMenu() {
    this.closeUI();
    if (!this.showroom || this.sceneManager.scene !== this.showroom.scene) {
      this.showroom = new ShowroomScene(this.sceneManager, this.graphics);
      await this.showroom.build();
    }
    await this.showroom.setCar(this.garage.spec(), this.garage.look());
    this.showroom.setFraming('menu');
    this.menu.showMain();
  }

  async reloadMenu() {
    this.garage = new GarageManager(this.save);
    this._initAchievements();
    this.audio.settings = this.save.settings;
    await this.showMenu();
  }

  closeUI() {
    this.menu?.close();
    this.garageUI?.close();
    this.achievementsUI?.close();
    this.settingsUI?.el?.remove();
  }

  openGarage() {
    this.menu.close();
    this.garageUI = new GarageUI(this);
    this.garageUI.show(() => this.menu.showMain());
  }

  openSettings(onClose) {
    const inRace = !!this.session;
    if (!inRace) this.menu.close();
    this.settingsUI = new SettingsUI(this);
    this.settingsUI.show(() => {
      if (onClose) onClose();
      else this.menu.showMain();
    }, { overlay: inRace });
  }

  startQuickRace(trackId) {
    const s = this.save.settings;
    this.startRace({ trackId, mode: 'quick', laps: s.laps, difficulty: s.difficulty, opponents: s.opponents });
  }

  async startRace(config) {
    this.audio.unlock();
    this.closeUI();
    this.lastRaceConfig = config;
    this.progress(0.01, 'Carregando pista…');
    if (this.session) { this.session.dispose(); this.session = null; }
    this.showroom = null;
    const session = new RaceSession(this, config);
    try {
      await session.load((p, t) => this.progress(p, t));
    } catch (e) {
      console.error(e);
      this.progress(1, `Erro ao carregar: ${e.message || e}`);
      setTimeout(() => { this.hideLoading(); this.showMenu(); }, 3500);
      return;
    }
    this.session = session;
    session.onExit = (champ) => this.endRace(champ);
    this.hideLoading();
    session.start();
  }

  async restartRace() {
    if (!this.lastRaceConfig) return;
    await this.startRace(this.lastRaceConfig);
  }

  async endRace(champ) {
    this.progress(0.2, 'Voltando à garagem…');
    if (this.session) { this.session.dispose(); this.session = null; }
    await this.showMenu();
    this.hideLoading();
    if (champ) this.menu.showChampionship();
  }

  // ---------------- Campeonato ----------------
  startChampionship(difficulty) {
    this.save.data.championship = {
      round: 0,
      tracks: TRACKS.map((t) => t.id),
      difficulty,
      standings: Object.fromEntries(CHAMP_NAMES.map((n) => [n, 0])),
    };
    this.save.save();
    this.continueChampionship();
  }

  continueChampionship() {
    const c = this.save.data.championship;
    if (!c) return;
    const trackId = c.tracks[c.round];
    const def = TRACKS.find((t) => t.id === trackId);
    this.startRace({ trackId, mode: 'championship', laps: def.defaultLaps, difficulty: c.difficulty, opponents: 5 });
  }

  /** Soma os pontos da etapa; retorna elemento com a classificação. */
  championshipAfterRace(results) {
    const c = this.save.data.championship;
    if (!c) return null;
    for (const r of results) {
      const pts = CHAMP_POINTS[r.position - 1] ?? 0;
      c.standings[r.name] = (c.standings[r.name] ?? 0) + pts;
    }
    c.round++;
    const rows = Object.entries(c.standings).sort((a, b) => b[1] - a[1]);
    let finished = false;
    let prizeText = '';
    if (c.round >= c.tracks.length) {
      finished = true;
      const champion = rows[0][0] === 'VOCÊ';
      if (champion) this.achievements.championshipWon();
      const myPos = rows.findIndex(([n]) => n === 'VOCÊ') + 1;
      const prize = champion ? CHAMP_PRIZE[c.difficulty] : Math.round(CHAMP_PRIZE[c.difficulty] / (myPos + 1));
      this.garage.addCredits(prize);
      prizeText = champion ? `CAMPEÃO! Prêmio: ${prize.toLocaleString('pt-BR')} CR` : `Campeonato encerrado em ${myPos}º. Prêmio: ${prize.toLocaleString('pt-BR')} CR`;
      this.save.data.championship = null;
    }
    this.save.save();
    const el = h('div', {},
      h('p', { style: { fontWeight: 800, marginTop: '1vh' } }, finished ? prizeText : `CAMPEONATO — após a etapa ${c.round} de ${c.tracks.length}`),
      h('div', { html: `<table class="table"><tbody>${rows.map(([n, p], i) => `<tr class="${n === 'VOCÊ' ? 'me' : ''}"><td>${i + 1}º</td><td>${n}</td><td class="num">${p} pts</td></tr>`).join('')}</tbody></table>` }));
    return { element: el, finished };
  }
}
