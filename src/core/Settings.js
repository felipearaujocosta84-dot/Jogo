// Preferências do jogador salvas no navegador (com tolerância a falhas de armazenamento).
const KEY = 'streetfootball3d.settings.v1';

const DEFAULTS = {
  quality: 'auto',   // auto | high | medium | low
  sound: true,
  fpsCap: 60,        // 60 | 30
  showFps: false,
  arena: 'street'
};

export class Settings {
  constructor() {
    this.data = { ...DEFAULTS };
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) Object.assign(this.data, JSON.parse(raw));
    } catch {
      /* armazenamento indisponível: usa padrões */
    }
  }

  get(key) {
    return this.data[key];
  }

  set(key, value) {
    this.data[key] = value;
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      /* ignora */
    }
  }
}
