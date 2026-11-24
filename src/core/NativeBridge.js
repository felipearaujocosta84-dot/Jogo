// =============================================================
// EXTREME RACING — NativeBridge
// Integração com o Android (Capacitor):
//  • botão "voltar": pausa/retoma a corrida, sai do replay, volta
//    ao menu principal; no menu, dois toques fecham o jogo
//  • app em segundo plano: pausa a corrida e silencia o áudio
// No navegador usa a API de visibilidade da página.
// =============================================================
import { toast } from '../ui/dom.js';

export class NativeBridge {
  constructor(game) {
    this.game = game;
    this._lastBack = 0;
    document.addEventListener('visibilitychange', () => this._onActive(!document.hidden));
  }

  async init() {
    if (!window.Capacitor?.isNativePlatform?.()) return;
    try {
      const { App } = await import('@capacitor/app');
      this.App = App;
      App.addListener('backButton', () => this.onBack());
      App.addListener('appStateChange', ({ isActive }) => this._onActive(isActive));
    } catch (e) {
      console.warn('[Native] plugin App indisponível', e);
    }
  }

  _onActive(active) {
    const g = this.game;
    if (!active) {
      if (g.session && !g.session.finished && !g.session.replaying) g.session.pause();
      g.audio.setPaused(true);
    } else if (!g.session?.paused) {
      g.audio.setPaused(false);
    }
  }

  onBack() {
    const g = this.game;
    const s = g.session;
    if (s) {
      if (g.settingsUI?.el) { g.settingsUI.close(); return; }
      if (s.replaying) { s.stopReplay(); return; }
      if (s.finished) return; // tela de resultados: use os botões
      if (s.paused) s.resume(); else s.pause();
      return;
    }
    // Menus: volta para a tela inicial; nela, dois toques saem do jogo
    const onMain = g.menu?.el && g.menu.el.querySelector('.menu-list');
    if (!onMain) {
      g.garageUI?.close();
      g.achievementsUI?.close();
      g.settingsUI?.el?.remove();
      g.menu.showMain();
      return;
    }
    const now = Date.now();
    if (now - this._lastBack < 2000) { this.App?.exitApp(); return; }
    this._lastBack = now;
    toast(g.uiRoot, 'Toque em voltar de novo para sair');
  }
}
