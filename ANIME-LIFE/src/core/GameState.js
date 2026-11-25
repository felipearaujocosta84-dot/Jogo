// Estado completo da partida. Tudo o que influencia a história mora aqui e é salvo.
export const SAVE_VERSION = 2;

export function newState(protagonist) {
  return {
    version: SAVE_VERSION,
    createdAt: Date.now(), updatedAt: Date.now(), playtime: 0,
    protagonist, // { name, displayName, pronouns: 'ele'|'ela'|'elu' }
    pos: { chapter: 'ch1', scene: null, pc: 0 }, // onde a história está (passo exato)
    stage: { bg: null, chars: [], music: null }, // o que está na tela (para continuar idêntico)
    flags: {}, // variáveis da história
    rel: {}, // personagem -> { amizade, confianca, afinidade, romance, met }
    routes: {}, // personagem -> 'insinuada' | 'aberta' | 'fechada'
    decisions: [], // histórico de escolhas
    log: [], // histórico de falas (últimas 400)
    read: {}, // passos já lidos (para "Pular")
    gallery: [], // cenas desbloqueadas
    chapters: {}, // ch -> { started, done }
    phone: { contacts: [], convos: {}, posts: [], liked: [], unread: 0 },
  };
}

export const game = {
  state: null,
  replay: false, // revendo cena pela galeria: nada é salvo
  set(s) { this.state = s; },
  get p() { return this.state?.protagonist; },
  flag(k) { return this.state?.flags[k]; },
  setFlag(k, v = true) { this.state.flags[k] = v; },
};

/** Troca marcadores do texto: {nome}, {nomecompleto}, {g:o/a/e} (concordância pelos pronomes). */
export function fmt(text) {
  const p = game.p || { name: '', displayName: '', pronouns: 'ele' };
  const gi = { ele: 0, ela: 1, elu: 2 }[p.pronouns] ?? 0;
  return String(text)
    .replace(/\{nome\}/g, p.displayName || p.name)
    .replace(/\{nomecompleto\}/g, p.name)
    .replace(/\{g:([^}]*)\}/g, (_m, opts) => { const o = opts.split('/'); return o[gi] ?? o[0]; });
}
