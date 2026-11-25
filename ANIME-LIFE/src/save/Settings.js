// Preferências do jogador (não fazem parte do save da partida).
const KEY = 'anime-life.settings';
const DEFAULTS = {
  music: 0.6,
  sfx: 0.8,
  textSpeed: 'normal', // lenta | normal | rapida | instantanea
  movement: 'livre', // livre (analógico) | quatro (só 4 direções)
  quality: 'auto', // auto | alta | economica
};

export const settings = {
  data: { ...DEFAULTS },
  load() {
    try { Object.assign(this.data, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch {}
    return this.data;
  },
  set(k, v) {
    this.data[k] = v;
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch {}
  },
  textDelay() {
    return { lenta: 45, normal: 26, rapida: 12, instantanea: 0 }[this.data.textSpeed] ?? 26;
  },
};
settings.load();
