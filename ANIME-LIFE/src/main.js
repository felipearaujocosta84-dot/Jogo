// Ponto de entrada do ANIME LIFE — MINHA VIDA.
import './style.css';
import { UIManager } from './ui/UIManager.js';
import { game } from './core/GameState.js';

const ui = new UIManager(document.getElementById('ui-root'), document.getElementById('game-root'));
ui.boot();

// Acesso para testes automatizados e depuração no console.
window.__ANIME_LIFE__ = { ui, game };
window.addEventListener('error', (e) => console.error('[Erro]', e.message));
window.addEventListener('unhandledrejection', (e) => console.error('[Promise]', e.reason));
