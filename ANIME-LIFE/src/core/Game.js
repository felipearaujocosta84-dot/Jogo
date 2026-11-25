// Inicialização do Phaser (motor). Renderiza na resolução física da tela (nitidez em celulares),
// limitada a 2x para poupar GPU em aparelhos intermediários.
import Phaser from 'phaser';
import { ApartmentScene } from '../scenes/ApartmentScene.js';
export { ApartmentScene };
import { settings } from '../save/Settings.js';

export function pixelRatio() {
  const q = settings.data.quality;
  const dpr = window.devicePixelRatio || 1;
  if (q === 'economica') return 1;
  if (q === 'alta') return Math.min(dpr, 2.5);
  return Math.min(dpr, 2);
}

export function createGame(parent) {
  const dpr = pixelRatio();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#1b1530',
    width: window.innerWidth * dpr,
    height: window.innerHeight * dpr,
    scale: { mode: Phaser.Scale.NONE, zoom: 1 / dpr },
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false } },
    render: { antialias: true, pixelArt: false, roundPixels: false, powerPreference: 'default' },
    fps: { target: 60, smoothStep: true },
    input: { keyboard: false, mouse: true, touch: true },
    disableContextMenu: true,
    banner: false,
    scene: [],
    autoFocus: false,
  });
  game.registry.set('dpr', dpr);
  const fit = () => {
    const d = pixelRatio();
    game.registry.set('dpr', d);
    game.scale.setZoom(1 / d);
    game.scale.resize(Math.round(window.innerWidth * d), Math.round(window.innerHeight * d));
  };
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', () => setTimeout(fit, 200));
  game.refit = fit;
  return game;
}
