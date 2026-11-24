// =============================================================
// EXTREME RACING — ponto de entrada
// =============================================================
import { Game } from './core/Game.js';

const canvas = document.getElementById('renderCanvas');
const uiRoot = document.getElementById('ui-root');

// Evita gestos do navegador (zoom, voltar, menu de contexto)
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('touchmove', (e) => {
  if (!e.target.closest('.panel, .settings-grid, .modal-box')) e.preventDefault();
}, { passive: false });

const game = new Game(canvas, uiRoot);
window.__EXTREME_RACING__ = game; // útil para depuração no console

game.boot().catch((e) => {
  console.error(e);
  const t = document.getElementById('loading-text');
  if (t) t.textContent = `Falha ao iniciar: ${e.message || e}. Verifique se o navegador suporta WebGL e WebAssembly.`;
});
