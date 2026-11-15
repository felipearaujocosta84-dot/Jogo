// Constantes globais do jogo.
export const GAME_VERSION = '0.1.0';
export const SAVE_KEY = 'reinos-esquecidos-save-v1';
export const SETTINGS_KEY = 'reinos-esquecidos-settings-v1';

export const MODELS = {
  map: 'models/reinos_esquecidos_mapa.glb',
  hero: 'models/heroi.glb'
};

// Ponto inicial (Aldeia Inicial) e ponto de renascimento
export const START_POS = { x: 41, z: -21 };

// Presets de qualidade
export const QUALITY = {
  high:   { shadows: true,  shadowSize: 2048, grass: 5000, maxDpr: 2,   particles: 1,   viewDist: 140 },
  medium: { shadows: true,  shadowSize: 1024, grass: 3000, maxDpr: 1.5, particles: 0.7, viewDist: 115 },
  low:    { shadows: false, shadowSize: 512,  grass: 1200, maxDpr: 1,   particles: 0.4, viewDist: 90 }
};

// Progressão
export function xpForLevel(level) {
  return Math.round(60 * Math.pow(level, 1.45));
}
