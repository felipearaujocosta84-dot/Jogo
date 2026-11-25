// Orquestra as telas (DOM) e o motor (Phaser): título → menu → criação → jogo.
import { h, wait } from './dom.js';
import { bus } from '../core/EventBus.js';
import { game, createNewState } from '../core/GameState.js';
import { saves } from '../save/SaveManager.js';
import { audio } from '../audio/AudioManager.js';
import { MainMenu } from './MainMenu.js';
import { CharacterCreation } from './CharacterCreation.js';
import { HUD } from './HUD.js';
import { DialogueBox } from './DialogueBox.js';
import { openSettings, openCredits, openPause, openPhone, openInventory } from './Panels.js';
import { InputController } from '../controls/InputController.js';

export class UIManager {
  constructor(root, gameRoot) {
    this.root = root; this.gameRoot = gameRoot;
    this.menu = new MainMenu(this);
    this.create = new CharacterCreation(this);
    this.hud = new HUD(this);
    this.dialogue = new DialogueBox(this);
    this.fade = h('<div id="fade"></div>');
    this.toastEl = h('<div id="toast"></div>');
    this.loading = h('<div id="loading" class="hidden"><div></div></div>');
    root.append(this.fade, this.toastEl, this.loading);
    this.input = new InputController(this.hud.joystick);
    this.modals = 0;
    bus.on('load:progress', (p) => { this.loading.firstChild.style.width = `${Math.round(p * 100)}%`; });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.scene && !this.modals && !this.dialogue.runner) openPause(this);
    });
    // salva ao minimizar o app (Android)
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.scene && game.state) { this.scene.snapshotLocation(); this.save(); } });
  }

  async boot() {
    await this.menu.showSplash();
    await this.showMenu();
  }

  async showMenu() {
    const save = await saves.load();
    await this.menu.show(save);
  }

  async menuAction(a) {
    if (a === 'settings') return openSettings(this);
    if (a === 'credits') return openCredits(this);
    if (a === 'new') {
      if (await saves.has() && !confirm('Começar um novo jogo vai substituir o jogo salvo. Continuar?')) return;
      await this.menu.hide();
      const protagonist = await this.create.open();
      await this.create.close();
      if (!protagonist) return this.showMenu();
      game.set(createNewState(protagonist));
      await this.save();
      return this.startWorld();
    }
    if (a === 'continue') {
      const s = await saves.load();
      if (!s) return this.toast('Nenhum jogo salvo');
      game.set(s);
      await this.menu.hide();
      return this.startWorld();
    }
  }

  async startWorld() {
    this.fade.classList.add('on');
    this.loading.classList.remove('hidden');
    const { createGame, ApartmentScene } = await import('../core/Game.js'); // Phaser só carrega aqui
    if (!this.engine) this.engine = createGame(this.gameRoot);
    const data = { ui: this, input: this.input };
    const ready = new Promise((r) => bus.once('scene:ready', r));
    if (this.engine.scene.getScene('Apartment')) this.engine.scene.start('Apartment', data);
    else this.engine.scene.add('Apartment', ApartmentScene, true, data);
    await ready;
    this.scene = this.engine.scene.getScene('Apartment');
    this.loading.classList.add('hidden');
    this.hud.show();
    this.fade.classList.remove('on');
    if (game.state.time.day === 1 && !game.flag('tutorial.visto')) {
      game.setFlag('tutorial.visto');
      await wait(700);
      this.toast('Use o joystick para andar. Chegue perto das coisas para interagir.', 5000);
    }
  }

  async backToTitle() {
    if (this.scene) { this.scene.snapshotLocation(); await this.save(); }
    this.fade.classList.add('on');
    await wait(600);
    this.hud.hide();
    this.engine?.scene.stop('Apartment');
    this.scene = null;
    this.fade.classList.remove('on');
    await this.showMenu();
  }

  /** Transição com tela preta (ex.: dormir). */
  async transition(work, text = '') {
    this.fade.textContent = text;
    this.fade.classList.add('on');
    await wait(700);
    await work();
    await wait(900);
    this.fade.classList.remove('on');
    await wait(600);
    this.fade.textContent = '';
  }

  save() { return game.state ? saves.save(game.state) : Promise.resolve(false); }

  modalCount(d) {
    this.modals = Math.max(0, this.modals + d);
    bus.emit('ui:modal', this.modals > 0);
    this.input.setEnabled(this.modals === 0);
  }

  openPause() { openPause(this); }
  openPhone() { openPhone(this); }
  openInventory() { openInventory(this); }

  toast(msg, ms = 2600) {
    this.toastEl.textContent = msg;
    this.toastEl.classList.add('show');
    clearTimeout(this._tt);
    this._tt = setTimeout(() => this.toastEl.classList.remove('show'), ms);
  }
}
