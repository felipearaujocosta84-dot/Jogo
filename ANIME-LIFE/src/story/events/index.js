// Eventos especiais (fora da ordem dos capítulos): encontros e momentos românticos.
// Só existem para personagens ADULTOS marcados como "romanceable" (CharacterRegistry.canRomance).
// Cada evento define quando pode ser convidado (requires) e se o personagem aceita (accepts) —
// o "não" do personagem é respeitado e não tem punição.
import { R } from '../dsl.js';
import { rinEncontro, rinNoite } from './rin.js';

export const EVENTS = [
  {
    scene: rinEncontro, char: R, kind: 'encontro',
    inviteText: 'Quer subir no terraço hoje à noite? Só nós dois.',
    npcInvite: 'terraço hoje à noite? só nós dois. se quiser',
    requires: (c) => ['interesse', 'encontro'].includes(c.stage(R)) || (c.stage(R) === 'nenhum' && c.stat(R, 'afinidade') >= 8),
    accepts: (c) => c.comfort(R) >= 16 && !['irritado', 'triste'].includes(c.mood(R)),
    yes: ['...tá. terraço às dez. não se atrase', 'ok. eu levo café'],
    no: ['hoje não dá. mas pergunta de novo outro dia, tá?', 'acho que ainda não. não é você, sou eu sendo eu'],
  },
  {
    scene: rinNoite, char: R, kind: 'noite',
    inviteText: 'Quer passar a noite aqui em casa? Filme, salgadinho, sem pressa nenhuma.',
    npcInvite: 'posso ir aí hoje? ver um filme. e ficar. se você quiser',
    requires: (c) => c.stage(R) === 'namoro',
    accepts: (c) => c.comfort(R) >= 40 && !['irritado', 'triste', 'cansado'].includes(c.mood(R)),
    yes: ['...quero. chego às nove', 'tá. levo o salgadinho de alga'],
    no: ['hoje eu tô meio pra baixo. outro dia, prometo', 'ainda não me sinto pronta pra isso. tudo bem?'],
  },
];

export const EVENT_CHAPTER = {
  id: 'eventos', number: 0, title: 'Eventos especiais', subtitle: '', isEvents: true,
  scenes: EVENTS.map((e) => e.scene),
};

export const eventById = (id) => EVENTS.find((e) => e.scene.id === id);
