// Diretor de cena: transforma a NARRAÇÃO em acontecimentos visuais e sonoros, sem inventar nada que
// não esteja no texto. Ex.: "Alguém bate na porta" → som de batidas; "O celular vibra" → vibração;
// "As lâmpadas acendem uma por uma" → lâmpadas acendem no cenário; "Ela estende uma caixa" → a
// personagem se aproxima; narração sem personagens → panorâmica lenta pelo ambiente + faixas de cinema.
// O roteiro também pode pedir efeitos explícitos (ver StoryEngine).

/** Som ambiente de cada cenário. */
export const AMBIENT = { apartamento: 'cidade', apartamento_noite: 'cidade', cafe: 'cafe', terraco_tarde: 'vento', terraco_noite: 'grilos', corredor_noite: null };

const norm = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const RULES = [
  { re: /bate(m|u)? na porta|batidas/, cue: () => ({ sfx: 'knock' }) },
  { re: /celular vibra|vibra\b/, cue: () => ({ sfx: 'vibrate', shake: true }) },
  { re: /\bsino\b/, cue: () => ({ sfx: 'bell' }) },
  { re: /barulho de chaves|\bchaves\b/, cue: () => ({ sfx: 'keys' }) },
  { re: /lampadas.*acendem|acendem uma por uma/, cue: () => ({ lights: 'on' }) },
  { re: /o sol some|por do sol|anoitece/, cue: () => ({ dim: 0.12 }) },
  { re: /dorme|adormece|apaga a luz/, cue: () => ({ dim: 0.55 }) },
  { re: /desliga a caixa de som/, cue: () => ({ musicDown: true }) },
  // ações de quem está em cena (personagem de quem a narração fala)
  { re: /se aproxima|chega (mais )?perto|estende|entrega|se ajoelha ao seu lado/, cue: (who) => who && { approach: [who, 0.45] } },
  { re: /se afasta|recua|da um passo para tras/, cue: (who) => who && { approach: [who, 0] } },
  { re: /\bgira\b|vira o rosto|se vira|olha para o horizonte|olha para o lado/, cue: (who) => who && { gesture: [who, 'turn'] } },
  { re: /suspira|respira fundo/, cue: (who) => who && { gesture: [who, 'sigh'] } },
  { re: /assente|acena com a cabeca|faz que sim/, cue: (who) => who && { gesture: [who, 'nod'] } },
  { re: /balanca a cabeca|faz que nao|nega com a cabeca/, cue: (who) => who && { gesture: [who, 'shake'] } },
  { re: /fecha os olhos/, cue: (who) => who && { gesture: [who, 'close_eyes'] } },
];

/**
 * ctx: { bg, cast: [{id, at}], lastSpeaker }
 * Retorna { cues: [...], cinematic: bool } — cinematic = narração "de cinema" (faixas + pausa antes do texto).
 */
export function directNarration(text, ctx) {
  const t = norm(text);
  const ids = (ctx.cast || []).map((c) => c.id);
  const who = ids.includes(ctx.lastSpeaker) ? ctx.lastSpeaker : ids.length === 1 ? ids[0] : null;
  const cues = [];
  for (const r of RULES) if (r.re.test(t)) { const c = r.cue(who); if (c) cues.push(c); }
  const noCast = !ids.length;
  // narração de ambiente sem ninguém em cena: a câmera percorre o lugar
  if (noCast && !cues.some((c) => c.lights)) cues.push({ pan: /noite|luz|predios|cidade|janela|ceu|telhados|terraco|cafe|apartamento|corredor/.test(t) ? 1 : 0 });
  return { cues, cinematic: noCast || cues.length > 0 };
}
