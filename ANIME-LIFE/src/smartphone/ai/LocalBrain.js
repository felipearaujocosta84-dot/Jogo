// MODO LOCAL (sem servidor de IA). Respostas LIMITADAS feitas por regras simples e modelos de frase:
// reconhece cumprimentos, perguntas comuns, gostos ("gosto de X"), promessas, elogios, grosserias e convites,
// e guarda memórias simples. NÃO entende mensagens livres como uma IA real — a interface avisa isso.
const norm = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const pick = (arr, seed) => arr[Math.abs(seed) % arr.length];

// Voz de cada personagem: como a frase é "escrita"
const VOICE = {
  character_01: (s) => s.toLowerCase().replace(/[.!]+$/g, '').replace(/[!]/g, ''),
  character_02: (s) => s,
  character_06: (s) => s.replace(/!+/g, '.'),
  character_07: (s) => s,
  character_08: (s) => s,
  character_10: (s) => s.replace(/!+/g, '.'),
};

const T = {
  character_01: {
    hello: ['oi', 'oi. acordei agora', 'e aí'], how: ['sobrevivendo. e você', 'cansada mas bem'], thanks: ['de nada', 'tá tudo bem'],
    likeAck: ['{x}? anotado', 'não imaginava que você curtia {x}'], recall: ['você comentou que gostava de {x}. tem feito isso ultimamente?'],
    complimentLow: ['...ok. obrigada eu acho', 'para com isso'], complimentHigh: ['para. sério', '...você fala cada coisa'],
    insult: ['nossa. tá bom então', 'não precisava disso'], inviteYes: ['pode ser. mas não antes do meio-dia'], inviteNo: ['hoje não dá'],
    yuki: ['não gosto muito de falar dela por mensagem', 'a yuki... depois a gente conversa'], bye: ['até', 'vai dormir'],
    promise: ['vou cobrar isso'], other: ['hm', 'entendi', 'sei lá. me conta mais'],
  },
  character_02: {
    hello: ['Oi! Tudo bem por aí?', 'Olá 🌙'], how: ['Estou bem, desenhando um pouco. E você?'], thanks: ['Imagina.', 'Não precisa agradecer.'],
    likeAck: ['Que legal, eu não sabia que você gostava de {x}.'], recall: ['Você me contou que gostava de {x}. Tem tido tempo pra isso?'],
    complimentLow: ['Obrigada... é gentil da sua parte.'], complimentHigh: ['Você me deixa sem graça assim. 🎨'],
    insult: ['Isso me chateou um pouco.', 'Não precisava falar assim.'], inviteYes: ['Eu gostaria. Que dia seria bom?'], inviteNo: ['Essa semana está difícil, desculpa.'],
    yuki: ['Prefiro falar da Yuki pessoalmente.'], bye: ['Até mais. Se cuida.'], promise: ['Vou lembrar disso.'], other: ['Entendi.', 'Me conta mais?', 'Hm, faz sentido.'],
  },
  character_06: {
    hello: ['Oi.', 'Hm. Oi.'], how: ['Cansada. Como sempre.', 'Vivendo.'], thanks: ['Ok.', 'Não foi nada.'],
    likeAck: ['{x}. Anotado.'], recall: ['Você disse que gostava de {x}. Ainda faz isso?'],
    complimentLow: ['Não precisa.', '...Ok.'], complimentHigh: ['Você é estranho(a). Mas obrigada.'],
    insult: ['Tchau.', 'Não tenho paciência pra isso.'], inviteYes: ['Talvez. Me fala o horário.'], inviteNo: ['Não.'],
    yuki: ['Se souber de algo sobre a Yuki, me liga.'], bye: ['Tchau.'], promise: ['Vou cobrar.'], other: ['Hm.', 'Ok.', 'E daí?'],
  },
  character_07: {
    hello: ['OIII 🎉', 'Opa! E aí, sumido(a)? 🚲'], how: ['Tô ótimo!! Fiz 30 entregas hoje 🚲 e você?'], thanks: ['Tamo junto! 😄'],
    likeAck: ['VOCÊ CURTE {X}?? que massa!! desde quando?'], recall: ['Ei! Você falou que gostava de {x}, tem feito ultimamente? 😄'],
    complimentLow: ['Haha valeu!! 😂'], complimentHigh: ['Para que eu fico vermelho 😳😂'],
    insult: ['Eita... pegou pesado 😕'], inviteYes: ['BORA!! Que horas? 🎉'], inviteNo: ['Putz, hoje tô lotado de entrega 😭'],
    yuki: ['A Yuki? Ela era gente boa... sumiu do nada né 😕'], bye: ['Falou!! 👋'], promise: ['Tá prometido hein! 📸'], other: ['Haha sério? Me conta mais!', 'Saquei! E aí? 😄'],
  },
  character_08: {
    hello: ['O-oi! 😅', 'Oi...!'], how: ['Tô bem! Ontem deu pra ver Saturno ✨'], thanks: ['N-não foi nada!'],
    likeAck: ['V-você gosta de {x}? Que legal...'], recall: ['Você comentou que gostava de {x}... tem praticado? 😅'],
    complimentLow: ['E-eu? Obrigado...'], complimentHigh: ['...isso me deixou sem jeito 😅'],
    insult: ['Ah... desculpa se eu fiz algo errado.'], inviteYes: ['S-sim! Quer ver as estrelas do terraço? 🔭'], inviteNo: ['Hoje eu tenho aula... desculpa.'],
    yuki: ['Eu não conhecia muito a Yuki...'], bye: ['Até amanhã no café!'], promise: ['T-tá bom!'], other: ['Hm... entendi.', 'Ah, sério?'],
  },
  character_10: {
    hello: ['Boa tarde.', 'Olá.'], how: ['Bem. O café está movimentado.'], thanks: ['Disponha.'],
    likeAck: ['{x}. Interessante.'], recall: ['Você mencionou que gostava de {x}. Continua?'],
    complimentLow: ['Obrigado.'], complimentHigh: ['...Agradeço.'],
    insult: ['Vou fingir que não li isso.'], inviteYes: ['Depois do expediente, talvez.'], inviteNo: ['Estou ocupado.'],
    yuki: ['Isso é assunto da Akane.'], bye: ['Até amanhã. Nove horas.'], promise: ['Anotado.'], other: ['Entendo.', 'Certo.'],
  },
};

const LIKE = /\b(?:eu\s+)?(?:gosto(?:\s+muito)?|adoro|amo|curto)\s+(?:de\s+|do\s+|da\s+|dos\s+|das\s+)?([a-z0-9 ]{2,30})/;

export const LocalBrain = {
  reply(id, text, mem, rel) {
    const t = norm(text);
    const tpl = T[id] || T.character_02;
    const voice = VOICE[id] || ((s) => s);
    const seed = t.length + (mem.history?.length || 0);
    const out = { replies: [], mood: 'neutro', deltas: { amizade: 0, confianca: 0, carinho: 0, afinidade: 0, romance: 0 }, memories: [], local: true };
    const say = (key, x) => { const s = pick(tpl[key], seed).replace('{x}', x || '').replace('{X}', (x || '').toUpperCase()); out.replies.push(voice(s)); };
    const close = (rel.carinho || 0) + (rel.afinidade || 0) > 25;
    let m;
    if (/\b(idiota|burr|chat[ao]|cala a boca|odeio voce|feia|ridicul)/.test(t)) { say('insult'); out.mood = 'irritado'; Object.assign(out.deltas, { amizade: -3, confianca: -2, carinho: -2 }); return out; }
    if ((m = t.match(LIKE)) && !/\bde voce\b/.test(t)) {
      const x = m[1].trim().split(' ').slice(0, 3).join(' ');
      say('likeAck', x); out.memories.push({ kind: 'preferencia', text: `O jogador gosta de ${x}.` }); out.deltas.afinidade = 1; out.mood = 'feliz'; return out;
    }
    if (/\bprometo\b/.test(t)) { say('promise'); out.memories.push({ kind: 'promessa', text: `O jogador prometeu: "${text.slice(0, 80)}".` }); out.deltas.confianca = 1; return out; }
    if (/\b(linda|lindo|bonit|fofa|fofo|incrivel|gosto de voce|te adoro|saudade)/.test(t)) { say(close ? 'complimentHigh' : 'complimentLow'); out.mood = 'envergonhado'; Object.assign(out.deltas, close ? { carinho: 2, romance: 1 } : { afinidade: 1 }); return out; }
    if (/\b(vamos|bora|quer sair|topa|cafe juntos|sair comigo)\b/.test(t)) { say((rel.amizade || 0) >= 8 ? 'inviteYes' : 'inviteNo'); out.deltas.amizade = 1; return out; }
    if (/\b(yuki|caixa|kamakura|postal)/.test(t)) { say('yuki'); out.mood = 'pensativo'; return out; }
    if (/\bobrigad/.test(t)) { say('thanks'); out.deltas.amizade = 1; out.mood = 'feliz'; return out; }
    if (/\b(tchau|ate mais|ate amanha|fui|boa noite)\b/.test(t)) { say('bye'); return out; }
    if (/\b(tudo bem|como vai|como voce esta|como ta|como esta)\b/.test(t)) { say('how'); out.deltas.amizade = 1; return out; }
    if (/^(oi|ola|e ai|eai|bom dia|boa tarde|opa|hey)\b/.test(t)) {
      say('hello');
      const pref = (mem.facts || []).filter((f) => f.kind === 'preferencia').pop();
      if (pref && seed % 2 === 0) { const x = pref.text.replace(/^O jogador gosta de /, '').replace(/\.$/, ''); say('recall', x); }
      out.deltas.amizade = 1; return out;
    }
    say('other');
    return out;
  },

  spontaneous(id, reason, mem) {
    const voice = VOICE[id] || ((s) => s);
    const pref = (mem.facts || []).filter((f) => f.kind === 'preferencia').pop();
    const lines = {
      bom_dia: { character_01: 'bom dia. eu acho', character_07: 'BOM DIAAA ☀️🚲', character_06: 'Bom dia.', character_08: 'B-bom dia! ✨', character_10: 'Bom dia. O café abre às oito.', character_02: 'Bom dia! Dormiu bem?' },
      boa_noite: { character_01: 'ainda acordado(a)?', character_07: 'boa noiteee 🌙', character_06: 'Acordado(a)?', character_08: 'Hoje o céu tá limpo... dá pra ver Júpiter 🔭', character_10: 'Boa noite.', character_02: 'Boa noite 🌙' },
      sumiu: { character_01: 'sumiu hein', character_07: 'EI cadê você?? 😂', character_06: 'Você sumiu.', character_08: 'Faz tempo que a gente não conversa... 😅', character_10: 'Tudo certo?', character_02: 'Faz um tempinho que a gente não conversa. Tudo bem?' },
      saudade: { character_01: '...tava pensando em você. só isso', character_07: 'saudade de você hein 😄', character_06: 'Estranho não falar com você.', character_08: 'E-eu tava com saudade de conversar...', character_10: 'O café fica silencioso sem você.', character_02: 'Senti sua falta hoje.' },
      convite: { character_01: 'terraço hoje à noite?', character_07: 'bora tomar um açaí amanhã?? 🎉', character_06: 'Café amanhã? Não no Hoshi.', character_08: 'Q-quer ver as estrelas no terraço? 🔭', character_10: 'Café depois do expediente?', character_02: 'Quer desenhar comigo no terraço amanhã?' },
      curiosidade: pref ? Object.fromEntries(Object.keys(T).map((k) => [k, (T[k].recall[0]).replace('{x}', pref.text.replace(/^O jogador gosta de /, '').replace(/\.$/, ''))])) : null,
    };
    const set = lines[reason] || lines.sumiu;
    return { replies: [voice(set?.[id] || 'oi')], mood: 'neutro', local: true };
  },
};
