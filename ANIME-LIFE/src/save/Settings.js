// Preferências do jogador (não fazem parte do save da partida).
const KEY = 'anime-life.settings';
const DEFAULTS = {
  music: 0.6,
  sfx: 0.8,
  textSpeed: 'normal', // lenta | normal | rapida | instantanea
  autoSpeed: 'normal', // modo automático: lento | normal | rapido
  skipUnread: false,
  cinema: true, // câmera cinematográfica (zoom, planos, movimentos)
  animations: 'completa',
  aiServer: '', // endereço do servidor seguro de IA (vazio = modo local)
  aiToken: '', // token opcional do app (NÃO é a chave da API)
  spontaneous: 'normal', // mensagens espontâneas: off | poucas | normal | muitas
  aiDailyCap: 80, // limite de mensagens por dia neste aparelho // animação dos personagens: completa | leve | off // "Pular" também pula texto ainda não lido
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
  autoDelay() { return { lento: 2600, normal: 1700, rapido: 1000 }[this.data.autoSpeed] ?? 1700; },
  textDelay() {
    return { lenta: 45, normal: 26, rapida: 12, instantanea: 0 }[this.data.textSpeed] ?? 26;
  },
};
settings.load();
