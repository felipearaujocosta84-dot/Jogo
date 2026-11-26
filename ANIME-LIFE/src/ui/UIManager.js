// Orquestra telas (HTML) e palco (Phaser): título → menu → novo jogo → história.
import { h, wait } from './dom.js';
import { bus } from '../core/EventBus.js';
import { game, newState } from '../core/GameState.js';
import { saves } from '../save/SaveManager.js';
import { audio } from '../audio/AudioManager.js';
import { MainMenu } from './MainMenu.js';
import { NewGame } from './NewGame.js';
import { DialogueUI } from './DialogueUI.js';
import { PhoneUI } from './PhoneUI.js';
import { Cards } from './Cards.js';
import { Chat } from '../smartphone/ChatSystem.js';
import { openSettings, openCredits, openPause, openBacklog, openGallery, openSaveLoad, openConfirm } from './Panels.js';

const findSceneIsEvent = (id) => typeof id === 'string' && id.startsWith('e_');
const GALLERY_KEY = 'anime-life.gallery'; // galeria vale para todas as partidas

export class UIManager {
  constructor(root, stageRoot) {
    this.root = root; this.stageRoot = stageRoot;
    this.menu = new MainMenu(this);
    this.newGame = new NewGame(this);
    this.dialogue = new DialogueUI(this);
    this.phone = new PhoneUI(this);
    this.cards = new Cards(this);
    this.fade = h('<div id="fade"></div>');
    this.toastEl = h('<div id="toast"></div>');
    root.append(this.fade, this.toastEl);
    this.modals = 0;
    bus.on('gallery:unlocked', (sc) => { this.rememberGallery(sc.id); this.toast(`🖼️ Cena desbloqueada na galeria: ${sc.title}`); });
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && this.story && !this.modals) openPause(this); });
    bus.on('chat:save', () => this.autosave());
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.story && game.state && !game.replay) this.autosave(); });
  }

  get skipping() { return this.dialogue.skipping; }

  async boot() { await this.menu.showSplash(); await this.showMenu(); }

  async showMenu() { await this.menu.show(await saves.load('auto')); }

  async menuAction(a) {
    if (a === 'settings') return openSettings(this);
    if (a === 'credits') return openCredits(this);
    if (a === 'gallery') return openGallery(this, { fromMenu: true, unlocked: this.galleryList() });
    if (a === 'load') return openSaveLoad(this, 'load');
    if (a === 'continue') return this.loadFrom('auto');
    if (a === 'new') {
      if (await saves.has('auto') && !(await openConfirm(this, 'Começar uma nova história substitui o salvamento automático (os espaços manuais continuam guardados). Continuar?', 'Nova história'))) return;
      await this.menu.hide();
      const protagonist = await this.newGame.open();
      await this.newGame.close();
      if (!protagonist) return this.showMenu();
      game.set(newState(protagonist));
      await this.autosave();
      return this.startStory();
    }
  }

  async ensureEngine() {
    if (this.engine) return this.engine;
    const [{ createEngine }, { StoryEngine }] = await Promise.all([import('../core/Engine.js'), import('../story/StoryEngine.js')]);
    this.engine = await createEngine(this.stageRoot);
    this.StoryEngine = StoryEngine;
    window.__ANIME_LIFE__ && (window.__ANIME_LIFE__.cueLog = StoryEngine.cueLog);
    return this.engine;
  }

  async startStory() {
    this.fade.classList.add('on');
    await this.ensureEngine();
    this.story?.stop();
    this.story = new this.StoryEngine(this, this.engine.stage);
    this.dialogue.show();
    const run = this.story.resume();
    Chat.startScheduler();
    await wait(300);
    this.fade.classList.remove('on');
    const story = this.story;
    run.then(() => { if (this.story === story && !game.replay) this.backToTitle(); }).catch((e) => console.error('[Story]', e));
  }

  /** Fecha todas as janelas abertas (pausa, galeria, etc.). */
  async closeModals() { await Promise.all([...(this.openModals || [])].map((m) => m.close())); }

  async loadFrom(slot) {
    await this.closeModals();
    const s = await saves.load(slot);
    if (!s) return this.toast('Nenhum jogo salvo aqui');
    this.story?.stop(); this.dialogue.abort();
    game.set(s);
    if (!this.menu.el.classList.contains('hidden')) await this.menu.hide();
    if (slot !== 'auto') await saves.save(s, 'auto');
    return this.startStory();
  }

  async replayScene(sceneId, fromMenu) {
    await this.closeModals();
    if (fromMenu) {
      const base = (await saves.load('auto')) || newState({ name: 'Você', displayName: 'Você', pronouns: 'ele' });
      game.set(base);
      await this.menu.hide();
    }
    this.fade.classList.add('on');
    await this.ensureEngine();
    this.story?.stop(); this.dialogue.abort();
    const replayer = new this.StoryEngine(this, this.engine.stage);
    this.story = replayer;
    this.dialogue.show();
    this.fade.classList.remove('on');
    this.toast('🖼️ Revendo cena (nada será salvo)');
    await replayer.replay(sceneId);
    if (this.story !== replayer) return;
    if (fromMenu) return this.backToTitle(true);
    return this.startStory();
  }

  /** Começa um evento especial (encontro etc.) e depois volta para a história principal. */
  async playEvent(sceneId) {
    if (!game.state || game.replay) return;
    await this.closeModals();
    if (this.phone.isOpen) { this.phone.locked = false; await this.phone.close(); }
    const st = game.state;
    if (!st.eventReturn && !findSceneIsEvent(st.pos.scene)) st.eventReturn = { pos: { ...st.pos }, stage: JSON.parse(JSON.stringify(st.stage)) };
    this.story?.stop(); this.dialogue.abort();
    st.pos = { chapter: 'eventos', scene: sceneId, pc: 0 };
    await this.autosave();
    return this.startStory();
  }

  async backToTitle(skipSave = false) {
    await this.closeModals();
    if (this.story && !skipSave && !game.replay) await this.autosave();
    this.story?.stop(); this.story = null;
    Chat.stopScheduler();
    if (this.phone.isOpen) { this.phone.locked = false; await this.phone.close(); }
    this.fade.classList.add('on');
    await wait(500);
    this.dialogue.abort(); this.dialogue.hide();
    this.engine?.stage.clearAll(); this.cards.letterbox(false);
    audio.ambient(null);
    this.cards.hideCover();
    this.fade.classList.remove('on');
    await this.showMenu();
  }

  // ---------- interface usada pelo StoryEngine ----------
  say(line, opts) { return this.dialogue.say(line, opts); }
  choose(options) { return this.dialogue.choose(options); }
  chapterCard(ch) { return this.cards.chapter(ch); }
  sceneCard(ch, sc, i) { return this.cards.scene(ch, sc, i); }
  timeCard(t) { return this.cards.timeCard(t); }
  letterbox(on) { this.cards.letterbox(on); }
  fadeScene(tone, text) { return this.cards.fadeScene(tone, text); }
  chapterEnd(ch, next) { this.dialogue.abort(); return game.replay ? Promise.resolve() : this.cards.chapterEnd(ch, next); }
  toBeContinued() { return this.cards.toBeContinued(); }

  async autosave() {
    if (!game.state || game.replay) return false;
    this.rememberGallery(...game.state.gallery);
    return saves.save(game.state, 'auto');
  }
  async saveTo(slot) { await this.autosave(); return saves.save(game.state, slot); }

  galleryList() { try { return JSON.parse(localStorage.getItem(GALLERY_KEY) || '[]'); } catch { return game.state?.gallery || []; } }
  rememberGallery(...ids) {
    try { const s = new Set(this.galleryList()); ids.forEach((i) => s.add(i)); localStorage.setItem(GALLERY_KEY, JSON.stringify([...s])); } catch {}
  }

  modalCount(d) { this.modals = Math.max(0, this.modals + d); bus.emit('ui:modal', this.modals > 0); }

  openPause() { openPause(this); }
  openBacklog() { openBacklog(this); }
  openSaveLoad(mode) { openSaveLoad(this, mode); }

  toast(msg, ms = 2600) {
    this.toastEl.textContent = msg;
    this.toastEl.classList.add('show');
    clearTimeout(this._tt);
    this._tt = setTimeout(() => this.toastEl.classList.remove('show'), ms);
  }
}
