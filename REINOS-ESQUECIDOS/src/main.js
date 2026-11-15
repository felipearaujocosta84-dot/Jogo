// Ponto de entrada: cria o motor Babylon, mostra o carregamento e inicia o jogo.
import './style.css';
import { Engine } from './babylon.js';
import { Game } from './game.js';

const canvas = document.getElementById('renderCanvas');
const fill = document.getElementById('loadingFill');
const text = document.getElementById('loadingText');

function setProgress(p, msg) {
  fill.style.width = Math.round(p * 100) + '%';
  if (msg) text.textContent = msg;
}

async function boot() {
  const engine = new Engine(canvas, true, {
    preserveDrawingBuffer: false,
    stencil: false,
    antialias: true,
    powerPreference: 'high-performance',
    doNotHandleContextLost: false
  }, false);
  engine.enableOfflineSupport = false;

  const game = new Game(engine, canvas);
  window.__game = game; // útil para depuração
  try {
    await game.init(setProgress);
  } catch (err) {
    console.error(err);
    text.textContent = 'Erro ao carregar: ' + (err && err.message ? err.message : err);
    return;
  }
  document.getElementById('loading').classList.add('hidden');
  game.menus.open('main');

  engine.runRenderLoop(() => {
    if (game.settings.fps30) {
      game._skip = !game._skip;
      if (game._skip) return;
    }
    game.scene.render();
  });
  window.addEventListener('resize', () => engine.resize());
  // libera o áudio no primeiro toque (exigência dos navegadores)
  const unlock = () => { game.audio.unlock(); };
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('touchstart', unlock, { once: true });
}

boot();

// PWA: funciona offline e pode ser "instalado" na tela inicial do Android
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
