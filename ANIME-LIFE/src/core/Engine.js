// Inicializa o Phaser (só o palco). Renderiza na resolução física da tela, limitada a 2x
// (aparelhos intermediários). A interface (texto, botões) é HTML por cima do canvas.
import Phaser from 'phaser';
import { StageScene } from '../scenes/StageScene.js';
import { settings } from '../save/Settings.js';

export function pixelRatio() {
  const dpr = window.devicePixelRatio || 1;
  if (settings.data.quality === 'economica') return 1;
  if (settings.data.quality === 'alta') return Math.min(dpr, 3);
  return Math.min(dpr, 2);
}

export function createEngine(parent) {
  return new Promise((resolve) => {
    const d = pixelRatio();
    const game = new Phaser.Game({
      type: Phaser.AUTO, parent, backgroundColor: '#1b1530',
      width: Math.round(window.innerWidth * d), height: Math.round(window.innerHeight * d),
      scale: { mode: Phaser.Scale.NONE, zoom: 1 / d },
      render: { antialias: true, pixelArt: false, roundPixels: false },
      input: { keyboard: false, mouse: false, touch: false },
      banner: false, autoFocus: false, disableContextMenu: true,
      fps: { target: 60, smoothStep: true },
      scene: [StageScene],
    });
    const fit = () => {
      const r = pixelRatio();
      game.scale.setZoom(1 / r);
      game.scale.resize(Math.round(window.innerWidth * r), Math.round(window.innerHeight * r));
    };
    window.addEventListener('resize', fit);
    window.addEventListener('orientationchange', () => setTimeout(fit, 250));
    game.refit = fit;
    game.events.once('stage-ready', (stage) => resolve({ game, stage }));
  });
}
