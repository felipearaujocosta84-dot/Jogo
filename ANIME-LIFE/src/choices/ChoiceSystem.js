// Escolhas: condições (mostrar/bloquear), efeitos e registro no histórico de decisões.
import { game } from '../core/GameState.js';
import { bus } from '../core/EventBus.js';
import { Relationships } from '../relationships/RelationshipManager.js';
import { Phone } from '../smartphone/PhoneSystem.js';

/** Contexto entregue às condições escritas na história. */
export function ctx() {
  const s = game.state;
  return {
    flag: (k) => s.flags[k],
    stat: (id, k) => Relationships.value(id, k),
    route: (id) => s.routes[id] || null,
    stage: (id) => Relationships.stage(id),
    comfort: (id) => Relationships.comfort(id),
    mood: (id) => Relationships.mood(id),
    contact: (id) => s.phone.contacts.includes(id),
    chose: (decisionId) => [...s.decisions].reverse().find((d) => d.id === decisionId)?.value,
    pronouns: game.p?.pronouns,
  };
}

/**
 * Efeitos possíveis (lista de objetos):
 *  { rel: ['character_01', { amizade: 2, confianca: 1 }] }   relacionamento
 *  { flag: 'pacote', v: 'aberto' }                           variável da história
 *  { contact: 'character_01' }                               novo contato no celular
 *  { post: 'kaito_terraco' }                                 publicação no Hoshigram
 *  { route: ['character_01', 'insinuada'] }                  estado de rota
 *  { memory: ['character_01', 'texto'] }                     aviso "fulano vai lembrar disso"
 *  { meet: 'character_06' }
 */
export function applyEffects(list = []) {
  for (const e of list) {
    if (e.rel) Relationships.change(e.rel[0], e.rel[1]);
    if ('flag' in e) game.setFlag(e.flag, e.v ?? true);
    if (e.contact) Phone.addContact(e.contact);
    if (e.post) Phone.addPost(e.post);
    if (e.route) Relationships.setRoute(e.route[0], e.route[1]);
    if (e.meet) Relationships.meet(e.meet);
    if (e.memory) bus.emit('memory', e.memory[0], e.memory[1]);
    if (e.romance) Relationships.setStage(e.romance[0], e.romance[1]);
  }
}

/** Prepara as opções visíveis: some (if falso) ou aparece bloqueada (lockIf verdadeiro). */
export function prepareOptions(options) {
  const c = ctx();
  return options
    .filter((o) => !o.if || o.if(c))
    .map((o) => ({ ...o, locked: o.lockIf ? !!o.lockIf(c) : false }));
}

export function recordDecision({ id, value, text, chapter, scene, chapterTitle, sceneTitle }) {
  game.state.decisions.push({ id, value, text, chapter, scene, chapterTitle, sceneTitle, at: Date.now() });
  if (id) game.setFlag(`escolha.${id}`, value);
}
