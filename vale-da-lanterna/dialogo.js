/* Vale da Lanterna — cérebro das conversas: entende o que o Kai escreve (no celular ou cara a cara) e responde de
   acordo com a pessoa (idade, personalidade, profissão, família, gostos, humor), com o relacionamento e com o que está
   acontecendo no jogo. Lembra o que o Kai contou e a última pergunta que fez. Crianças e adolescentes nunca entram em
   flerte; adultos comprometidos recusam com respeito. Tudo local (funciona offline). */
'use strict';

// ---------------------------------------------------------------- quem é cada um
const NPC_INFO = {
  aurora: { fam: 'Fui casada com o Joaquim por 50 anos. Hoje o vale inteiro é minha família.', hobby: 'contar histórias e fazer chá', food: 'torta de maçã', color: 'lilás', dream: 'ver a Lanterna brilhando para sempre', fear: 'que o vale esqueça suas histórias' },
  mel: { fam: 'Minha família mora longe, numa cidade grande. Eu vim pro vale por causa das flores.', hobby: 'cuidar do jardim e fazer coroas de flores', food: 'salada de morango', color: 'rosa', dream: 'abrir uma floricultura enorme', fear: 'geada nas flores' },
  tome: { fam: 'Moro com o Joca, meu sobrinho. Trabalha bem, mas fala demais.', hobby: 'cuidar da horta (e reclamar)', food: 'sopa de abóbora', color: 'verde, cor de couve', dream: 'uma colheita perfeita', fear: 'praga de lagarta' },
  bruno: { fam: 'Sou solteiro. A forja é minha companheira há 20 anos.', hobby: 'forjar ferramentas e pescar no domingo', food: 'pão com queijo', color: 'cinza aço', dream: 'forjar uma espada lendária', fear: 'perder o fogo da forja' },
  rosa: { fam: 'Sou solteira. A padaria é minha casa de verdade!', hobby: 'inventar receitas de pão', food: 'pão de queijo quentinho', color: 'laranja', dream: 'ter a padaria mais famosa da região', fear: 'pão queimado no festival' },
  teo: { fam: 'Moro com meus pais na casa vermelha da praça. E tenho a gata Bolinha!', hobby: 'correr atrás do Floco', food: 'torta!', color: 'amarelo', dream: 'ser aventureiro igual você', fear: 'escuro' },
  iara: { fam: 'Cresci na beira do mar. Hoje o rio é minha família.', hobby: 'pescar e explorar', food: 'peixe assado', color: 'azul-turquesa', dream: 'conhecer todas as cidades do mundo', fear: 'ficar parada' },
  davi: { fam: 'Moro sozinho... gosto do silêncio da serraria.', hobby: 'esculpir madeira', food: 'torta de amora', color: 'marrom', dream: 'fazer móveis pra vila toda', fear: 'falar em público' },
  nina: { fam: 'Moro sozinha, mas minha casa vive cheia de tecidos e sonhos.', hobby: 'costurar e olhar as estrelas', food: 'bolo de flor-lume', color: 'roxo', dream: 'desfilar minhas roupas numa cidade grande', fear: 'que ninguém goste do que eu faço' },
  leo: { fam: 'Sou casado com a Bia, a melhor cozinheira do vale.', hobby: 'fazer a ronda e treinar', food: 'a sopa da Bia', color: 'azul-marinho', dream: 'um vale sem Musgos', fear: 'falhar em proteger alguém' },
  bia: { fam: 'Sou casada com o Léo. Ele é sério, mas é um amor.', hobby: 'cozinhar e conversar', food: 'cogumelo refogado', color: 'vermelho', dream: 'abrir um restaurante', fear: 'faltar comida na festa' },
  joca: { fam: 'Moro com o tio Tomé. Ele resmunga, mas me ama.', hobby: 'futebol e cortar lenha', food: 'qualquer coisa que a Bia fizer', color: 'verde', dream: 'ser artilheiro da várzea', fear: 'aranha (não conta pra ninguém!)' },
  gil: { fam: 'Sou casado com o armazém, hahaha! Solteirão convicto.', hobby: 'negociar e colecionar moedas antigas', food: 'carpa frita', color: 'dourado', dream: 'vender pra todas as cidades', fear: 'prejuízo' },
  cida: { fam: 'Sou mãe do Pedro e da Lia. Meu marido trabalha na cidade grande.', hobby: 'ler e ensinar', food: 'bolo de fubá', color: 'azul-céu', dream: 'ver meus alunos crescendo felizes', fear: 'criança sem estudar' },
  zeca: { fam: 'Sou pai da Duda e do Bento. A Lurdes, minha esposa, já partiu.', hobby: 'navegar no rio de barco', food: 'peixe com farofa', color: 'azul do rio', dream: 'ensinar a Duda a pilotar o barco', fear: 'enchente' },
  marta: { fam: 'Sou mãe do Rafa, da Malu e do Nico. Três furacões!', hobby: 'colher ervas e fazer chás', food: 'chá com mel e bolo', color: 'verde-musgo', dream: 'curar qualquer resfriado do vale', fear: 'meus filhos doentes' },
  pedro: { fam: 'Minha mãe é a professora Cida e a pirralha da Lia é minha irmã.', hobby: 'futebol, óbvio', food: 'pizza', color: 'vermelho', dream: 'jogar num time de verdade', fear: 'prova de matemática' },
  duda: { fam: 'Meu pai é o Seu Zeca e o Bento é meu irmão menor.', hobby: 'pescar com meu pai e jogar bola', food: 'morango', color: 'amarelo', dream: 'pilotar o barco do meu pai', fear: 'ficar presa em casa' },
  rafa: { fam: 'Minha mãe é a Marta. A Malu e o Nico são meus irmãos.', hobby: 'desenhar e ajudar o Davi na serraria', food: 'pão com manteiga', color: 'verde', dream: 'ser carpinteiro', fear: 'falar com gente nova' },
  lia: { fam: 'A minha mãe é a professora! E o Pedro é meu irmão chato.', hobby: 'desenhar flores', food: 'morango!', color: 'rosa', dream: 'ser florista igual a Mel', fear: 'trovão' },
  bento: { fam: 'Meu pai é o Seu Zeca e a Duda é minha irmã.', hobby: 'jogar pedra no rio', food: 'torta', color: 'azul', dream: 'ter um cachorro igual o Floco', fear: 'o Musgo Ancião' },
  malu: { fam: 'Minha mãe é a Marta, e tenho o Rafa e o Nico.', hobby: 'brincar de pega-pega com o Téo', food: 'bolo', color: 'roxo', dream: 'ser cantora', fear: 'barata' },
  nico: { fam: 'Minha mamãe é a Marta!', hobby: 'brincar', food: 'morango', color: 'amarelo', dream: 'ser grande', fear: 'escuro' }
};
const JOKES = ['Por que o Musgo não usa celular? Porque ele já vive conectado na raiz! Hahaha', 'Sabe o que o peixe falou pro outro? Nada! Kkkk', 'O que a couve disse pro tomate? Para de ficar vermelho, é só uma salada!',
  'Por que a galinha atravessou a praça? Pra fugir do Floco, claro!', 'Qual é o pão preferido do Bruno? O pão de FERRO! ...tá, essa foi ruim.', 'Sabe por que a Lanterna nunca fica triste? Porque ela sempre vê o lado brilhante!'];

// ---------------------------------------------------------------- ferramentas de texto
const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/(.)\1{2,}/g, '$1$1').replace(/([aeiou])\1+/g, '$1').replace(/[^a-z0-9?! ]/g, ' ').replace(/\s+/g, ' ').trim();
const pickR = (arr, seed) => arr[(hashStr(String(seed)) >>> 0) % arr.length];
const fem = r => SOCIAL[r.id] && SOCIAL[r.id].gender === 'f';
const gw = (r, m, f) => fem(r) ? f : m;    // palavra no gênero da pessoa
const ageGroup = r => r.age < 12 ? 'crianca' : r.age < 18 ? 'teen' : r.age >= 60 ? 'idoso' : 'adulto';
const STOP = new Set(('a o e de da do das dos que eu voce vc tu ele ela isso esse essa um uma uns umas para pra pro com sem na no nas nos em por mais muito muita mas como qual quais quando onde quem me te se ja nao sim ta to tava foi vai vou ser ter tem tenho meu minha seu sua teu tua kai hoje agora entao la aqui ai la ne e ou ate assim tambem tbm vcs voces ' +
  'acredita acha acho sabe sabia quer queria pode podia fazer fazendo faz conhece prefere estava tinha gosta gosto achou viu vi falou disse pensa pensou existe sera seria ficou fica deu dar').split(' '));
function entities(t) {
  const e = { people: [], items: [], places: [], hour: null };
  const tt = ' ' + t.replace(/\?/g, ' ') + ' ';
  for (const r of RESIDENTS) { if (r.kid) continue; const n = norm(r.name), first = n.replace(/^(vo|seu|dona) /, ''); if (tt.includes(' ' + first + ' ') || tt.includes(' ' + n + ' ')) e.people.push(r); }
  const toks = t.replace(/\?/g, '').split(' ');
  for (const [k, n] of Object.entries(NAMES)) { const n0 = norm(n).split(' ')[0]; if (n0.length > 2 && toks.some(w => w === n0 || (w.length >= 4 && (w.startsWith(n0) || n0.startsWith(w))))) e.items.push(k); }
  const PL = [['praca', 'na praça'], ['vila', 'na Vila do Rio'], ['campo', 'no campo'], ['rio', 'no rio'], ['horta', 'na horta'], ['padaria', 'na padaria'], ['armazem', 'no armazém'], ['escola', 'na escola'], ['bosque', 'no bosque'], ['torre', 'na torre'], ['penhasco', 'no penhasco'], ['praia', 'na praia'], ['lago', 'no lago'], ['fonte', 'na fonte'], ['casa', 'em casa']];
  for (const [k, p] of PL) if ((' ' + t + ' ').includes(' ' + k)) e.places.push(p);
  const h = /(\d{1,2}) ?(h|hs|horas)\b/.exec(t); if (h) e.hour = Math.min(23, +h[1]);
  else if (/meio dia/.test(t)) e.hour = 12; else if (/\bnoite\b/.test(t)) e.hour = 19; else if (/\btarde\b/.test(t)) e.hour = 16; else if (/\bmanha\b/.test(t)) e.hour = 9;
  return e;
}
function topicWord(t) { const w = t.replace(/\?/g, '').split(' ').filter(x => x.length > 3 && !STOP.has(x)); return w.sort((a, b) => b.length - a.length)[0] || null; }

// ---------------------------------------------------------------- estilo de fala
function styl(r, text, ch) {
  const g = ageGroup(r);
  if (ch !== 'phone') return text;
  if (g === 'teen') { text = text.replace(/Hahaha/g, 'kkkkk').replace(/haha/gi, 'kkk'); if (Math.random() < 0.4) text = text.replace(/\.$/, ''); }
  if (g === 'crianca' && Math.random() < 0.5) text += ' 😄';
  return text;
}
function opener(r) {
  const g = ageGroup(r), P = PERS[r.pers] || PERS.gentil;
  if (g === 'teen') return pickR(['E aí, Kai!', 'Opa, Kai!', 'Fala, Kai!', 'Salve!'], r.id + S.time.min);
  if (g === 'crianca') return pickR(['Kai! Kai!', 'Oiê, Kai!', 'Kaaai!'], r.id + S.time.min);
  if (g === 'idoso') return pickR(['Olá, meu querido!', 'Oi, Kai, que bom te ver!'], r.id + S.time.min);
  return pickR(P.hi, r.id + S.time.min);
}
function moodLine(r) {
  const h = gameHour(), e = r.entry || currentEntry(r), m = sm(r.id), g = ageGroup(r);
  if (m.upset) return 'Mais ou menos... ainda estou um pouco chateado' + gw(r, '', 'a') + ' com você.';
  if (r.sleeping) return 'Com sono... ' + gw(r, 'acordado', 'acordada') + ' agora só por você!';
  if (isBirthday(r.id)) return 'Ótimo! Hoje é meu aniversário! 🎂';
  if (valeRaining()) return g === 'crianca' ? 'Tô bem! Mas não posso brincar lá fora por causa da chuva...' : 'Bem, só um pouco preguiços' + gw(r, 'o', 'a') + ' com essa chuva.';
  if (['work', 'farm', 'fish'].includes(e[3])) return 'Bem! ' + pickR(['Trabalhando bastante hoje.', 'Na correria, mas feliz.', 'Cansad' + gw(r, 'o', 'a') + ', mas o trabalho está rendendo.'], r.id + S.time.day);
  if (h >= 21) return 'Bem, já ficando com sono.';
  return pickR(['Muito bem, obrigad' + gw(r, 'o', 'a') + '!', 'Tô ótim' + gw(r, 'o', 'a') + '!', 'Bem, o dia está bonito.', 'Tranquil' + gw(r, 'o', 'a') + ', e você?'], r.id + S.time.day + S.time.min);
}
function opinionOf(r, o) {
  if (o === r) return 'Eu? Hahaha, eu sou ótim' + gw(r, 'o', 'a') + '!';
  const pairs = { 'leo:bia': 'A Bia é o amor da minha vida.', 'bia:leo': 'O Léo é meu marido, né? Sério por fora, um doce por dentro.', 'tome:joca': 'O Joca? Meu sobrinho. Fala pelos cotovelos, mas é bom rapaz.', 'joca:tome': 'Meu tio é rabugento, mas é o melhor tio do mundo.',
    'cida:pedro': 'Meu filho! Inteligente, mas só pensa em futebol.', 'cida:lia': 'Minha pequena Lia! Desenha flores lindas.', 'pedro:lia': 'Minha irmã? Chata. Mas eu defendo ela de todo mundo.', 'lia:pedro': 'O Pedro é chato! Mas me ensina a chutar bola.',
    'zeca:duda': 'Minha filha. Já pesca melhor que eu!', 'duda:bento': 'O Bento é meu irmãozinho, vive me seguindo.', 'marta:rafa': 'O Rafa é tímido, mas tem um coração de ouro.', 'rafa:davi': 'O Davi me ensina carpintaria. Ele é muito paciente.', 'davi:rafa': 'O Rafa tem talento. Lembra eu quando era novo.' };
  if (pairs[r.id + ':' + o.id]) return pairs[r.id + ':' + o.id];
  if (partnerOf(o.id)) return o.name + '? ' + gw(o, 'Ele', 'Ela') + ' gosta muito de você, Kai. Cuida bem, hein!';
  const info = NPC_INFO[o.id] || {};
  const base = [o.name + '? ' + gw(o, 'Ele', 'Ela') + ' é ' + o.prof.toLowerCase() + '. ' + (info.hobby ? 'Adora ' + info.hobby.split(' e ')[0] + '.' : ''),
    'Gosto d' + gw(o, 'o', 'a') + ' ' + o.name + '. ' + pickR(['Pessoa boa.', 'Sempre me ajuda.', 'A gente conversa bastante na praça.'], r.id + o.id),
    o.name + '... ' + pickR(['tem um jeito só del' + gw(o, 'e', 'a') + ', né?', 'é gente boa demais.', 'é meio na del' + gw(o, 'e', 'a') + ', mas é legal.'], o.id + r.id)];
  return pickR(base, r.id + ':' + o.id);
}
function newsLine(r) {
  const out = [];
  const F = S.football, last = F && F.history[0];
  if (last && S.time.day - last.day <= 5) out.push('O último futebol terminou ' + last.score.join(' × ') + '.' + (last.kai && last.kai.goals ? ' E você marcou!' : ''));
  for (let d = S.time.day; d < S.time.day + 10; d++) { const ev = dayEvents(d).find(e => e.k === 'festa' || e.k === 'niver'); if (ev) { out.push((d === S.time.day ? 'Hoje' : d === S.time.day + 1 ? 'Amanhã' : 'Dia ' + calOf(d).d) + ' tem ' + ev.t.replace(' (praça', ' (na praça').toLowerCase() + '.'); break; } }
  if (S.romance && !partnerOf(r.id)) out.push('Dizem que você e ' + gw(RES_BY_ID[S.romance.id], 'o ', 'a ') + RES_BY_ID[S.romance.id].name + ' estão ' + (S.romance.status === 'casados' ? 'casados e felizes' : 'juntos') + '! Hihi.');
  const sp = RESIDENTS.find(o => !o.kid && o !== r && isBirthday(o.id, S.time.day + 1)); if (sp) out.push('Amanhã é aniversário d' + gw(sp, 'o', 'a') + ' ' + sp.name + '!');
  const others = RESIDENTS.filter(o => !o.kid && o !== r && NPC_INFO[o.id]);
  for (let i = 0; i < 3 && others.length; i++) { const o = others[(hashStr(r.id + S.time.day + i) >>> 0) % others.length], I = NPC_INFO[o.id];
    out.push(pickR([gw(o, 'O ', 'A ') + o.name + ' passou o dia todo ' + I.hobby.split(' e ')[0].replace(/^(cuidar|fazer|contar|colher|jogar|ler|cortar|negociar|inventar|esculpir|costurar|forjar|pescar|desenhar|brincar|navegar|correr)/, m => m.replace(/r$/, 'ndo')) + '.', 'Sabia que o sonho d' + gw(o, 'o', 'a') + ' ' + o.name + ' é ' + I.dream + '?', 'Dizem que ' + gw(o, 'o ', 'a ') + o.name + ' tem medo de ' + I.fear + '. Hihi, não conta que fui eu!'], o.id + S.time.day + i)); }
  if (out.length < 2) out.push('Previsão de hoje: ' + forecastText().toLowerCase() + '.');
  return pickR(out, r.id + S.time.day + S.time.min);
}
// dicas do jogo (perguntas de "como faço…", "onde compro…")
const TIPS = [[/semente|plantar|planta/, 'Sementes você compra no Armazém do Gil ou no Sítio do Seu Tomé. Ara a terra com a enxada, planta e rega todo dia!'],
  [/vara|pesca|pescar|peixe/, 'Pra pescar precisa da Vara de Pesca, 40 moedas no Armazém. Chega perto da água e toca no botão!'],
  [/dinheiro|moeda|rico|ganhar/, 'Pra ganhar dinheiro: arruma um emprego (fala com o Bruno, a Iara, o Gil...), vende peixe ou monta a Loja do Kai.'],
  [/tabua|madeira/, 'Tábua sai de 2 madeiras na aba Criar, ou trabalhando na serraria do Davi.'],
  [/namor|buque|anel/, 'Pra namorar: amizade, encontros e um Buquê (5 flores + 1 fibra). No Pedir em namoro aparece o que falta.'],
  [/casa|terreno|constru/, 'Terrenos você compra nas placas "À venda". Lá aparece o botão Construir.'],
  [/emprego|trabalh/, 'Emprego? Fala com o chefe e escolhe "Emprego": ferreiro, pescador, comerciante, carpinteiro, cozinheiro ou agricultor.'],
  [/futebol|jogo|partida|bola/, 'Futebol de várzea toda sexta às 15h, no campo a oeste da Vila do Rio!'],
  [/animal|galinha|vaca|ovelha|porco/, 'Animais você compra no Sítio do Seu Tomé. Precisa de um terreno como pasto e ração todo dia.'],
  [/reliquia|lanterna|musgo|torre/, 'As três relíquias acendem a Lanterna. Fala com a Vó Aurora, ela conta tudo.'],
  [/celular|numero|telefone/, 'Pra ter o número de alguém, conversa com a pessoa e escolhe "Pedir número".'],
  [/comida|fome|vida|coracao/, 'Pra recuperar vida: torta da Rosa, sopa de cogumelo ou poção (2 flores + 1 cogumelo).']];

// ---------------------------------------------------------------- o cérebro: texto do Kai → resposta
function dlgMem(id) { const m = sm(id); m.chat = m.chat || { kai: {}, recent: [], q: null, insults: 0, day: 0 }; return m.chat; }
let rawWords = {};
function dlgReply(id, raw, ch = 'phone') {
  const r = RES_BY_ID[id]; if (!r) return ['...'];
  rawWords = {}; for (const w of String(raw).toLowerCase().split(/[^a-zà-ÿ0-9]+/)) { const n = norm(w); if (n && n !== w) rawWords[n] = w; }
  const t = norm(raw), m = sm(id), M = dlgMem(id), g = ageGroup(r), e = entities(t), out = [];
  const love = partnerOf(id), st = S.romance && S.romance.status, adult = r.age >= 18 && !r.child && !r.teen && !r.kid;
  const has = re => re.test(t), say = s => out.push(s);
  const k = M.kai;
  if (M.day !== S.time.day) { M.day = S.time.day; M.recent = []; }
  // 1) resposta a uma pergunta que a pessoa fez antes
  const yes = /^(sim|s|claro|bora|vamos|pode|quero|aceito|com certeza|ss|uhum|isso|bora sim|ok|beleza|blz|ta bom|fechado)\b/.test(t), no = /^(nao|n|nem|nunca|agora nao|depois|hoje nao|nop)\b/.test(t);
  if (M.q && /(quebr|perdi|ruim|pessim|horrivel|triste|chat[oa]|errado|machuc|doente|briguei|roubaram)/.test(t) && M.q !== 'comovoce') M.q = null;   // notícia ruim: responde com empatia abaixo
  if (M.q) {
    const q = M.q; M.q = null;
    if (q === 'comovoce') { if (/(bem|otimo|feliz|legal|tranquil|de boa|suave|bom)/.test(t)) say(pickR(['Que bom! Fico feliz.', 'Aí sim! Dia bom é dia de vale.', 'Isso! Sorriso no rosto!'], id + t)); else if (/(mal|triste|cansad|pessim|chatead|doente)/.test(t)) say(pickR(['Ah, não... quer conversar sobre isso?', 'Poxa, Kai. Se precisar de mim, tô aqui.', 'Força! Um chá da Marta resolve quase tudo.'], id + t)); }
    else if (q === 'passear') { if (yes) { m.walkPromise = S.time.day; say('Combinado! Me encontra ' + whereIs(r) + (e.hour ? ' às ' + e.hour + 'h' : '') + ' que a gente sai.'); } else if (no) say('Tudo bem! Fica pra outro dia.'); }
    else if (q === 'futebol') { if (yes) say('Isso! Sexta às 15h no campo. Leva disposição!'); else if (no) say('Ah, que pena. Mas vai torcer pelo menos!'); }
    else if (q === 'gosta') { const w = topicWord(t); if (w) { k.likes = (k.likes || []).concat([w]).slice(-5); say(pickR(['Sério? ' + cap(w) + '? Nunca imaginei!', cap(w) + '! Bom gosto, Kai.', 'Anotado: Kai gosta de ' + w + '. Hehe.'], id + w)); } }
    else if (q === 'dia') { const w = topicWord(t); say(w ? pickR(['Que legal! ' + cap(w) + ' parece divertido.', 'Hmm, ' + w + '... me conta mais depois!', 'Uau, você não para, hein!'], id + w) : 'Haha, entendi!'); }
    if (out.length) return finish(r, out, ch);
  }
  // 2) ofensa
  if (/(idiota|burr|chat[oa] demais|feio|feia|odeio|lixo|imbecil|otari|cala a boca|vai se|ridicul|nojent|bobo|boba)/.test(t)) {
    M.insults++; addFriend(id, -12); if (M.insults >= 3) m.upset = true;
    say(g === 'crianca' ? 'Isso não se fala! Vou contar pra minha mãe!' : g === 'teen' ? 'Ué, mano, que isso? Pegou pesado.' : r.pers === 'rabugento' ? 'Olha o respeito, rapaz!' : pickR(['Nossa, Kai... isso me magoou.', 'Por que você tá falando assim comigo?', 'Que grosseria. Não esperava isso de você.'], id + t));
    return finish(r, out, ch);
  }
  if (/(desculpa|perdao|foi mal|sinto muito)/.test(t)) { if (m.upset || M.insults) { M.insults = 0; m.upset = false; addFriend(id, 8); say('Tá desculpado. Só não repete, tá?'); } else say(pickR(['Desculpa pelo quê? Tá tudo bem!', 'Relaxa, Kai, não aconteceu nada.'], id)); return finish(r, out, ch); }
  // 3) carinho / flerte (respeitando idade e compromisso)
  if (/(te amo|amo voce|gosto de voce|linda|lindo|gata|gato|gostos[oa]|namora comigo|namorar comigo|quer namorar|vamos namorar|casa comigo|beij|crush|saudade|meu amor|minha vida|apaixonad|^oi amor|^amor\b)/.test(t) && !/(gosto de voce como amig|tem namorad|ta namorando|e casad)/.test(t)) {
    if (!adult) say(g === 'crianca' ? pickR(['Eca! Hahaha. Você é meu amigo, Kai!', 'Hã? Eu sou criança, Kai! Vamos brincar?'], id) : 'Opa, Kai... sou adolescente, a gente é só amigo, beleza? Bora falar de outra coisa.');
    else if (love) { romanceGain(id, 2); addFriend(id, 4); say(pickR([st === 'casados' ? 'Também te amo, meu bem. Vem pra casa logo!' : 'Também te amo! ❤', 'Saudade de você também... muita!', 'Você sempre sabe como me deixar feliz. ❤', 'Ai, Kai... 🥰'], id + t + S.time.min)); }
    else if (canRomance(id) && !S.romance) { if (hearts(id) >= 5) { romanceGain(id, 1); say(pickR(['Ai, Kai... assim você me deixa sem graça. 😳', 'Hihi... você é muito fofo, sabia?', 'Para, Kai! ...mas fala de novo. 😊'], id + t)); } else say(pickR(['Haha, calma! A gente mal se conhece.', 'Que isso, Kai! Vamos com calma, tá?'], id + t)); }
    else say((SOCIAL[id] && SOCIAL[id].no) ? SOCIAL[id].no : 'Você é um amigo muito querido, Kai. Só amigo, tá?');
    return finish(r, out, ch);
  }
  // 4) o Kai conta algo sobre si
  let mm;
  if ((mm = /eu gosto (de|da|do) ([a-z ]+)/.exec(t))) { const w = mm[2].split(' ').filter(x => !STOP.has(x))[0] || mm[2]; k.likes = (k.likes || []).concat([w]).slice(-5); const meu = r.likes.some(l => norm(NAMES[l] || l).startsWith(w.slice(0, 4))); say(meu ? 'Sério?! Eu também AMO ' + w + '!' : pickR([cap(w) + '? Que legal! Vou lembrar disso.', 'Hmm, ' + w + '... boa escolha, Kai.', 'Anotado! O Kai gosta de ' + w + '.'], id + w)); }
  else if ((mm = /eu (pesquei|plantei|colhi|ganhei|comprei|fiz|construi|matei|derrotei|achei|encontrei|vendi|casei|joguei|fui|cozinhei|terminei|consegui)( [a-z ]+)?/.exec(t))) {
    const v = mm[1], obj = (mm[2] || '').trim().split(' ').filter(x => !STOP.has(x)).slice(0, 3).join(' ');
    const react = { pesquei: 'Pescou ' + (obj || 'um peixe') + '? Boa! ' + (r.id === 'iara' || r.id === 'zeca' ? 'Tá virando pescador de verdade!' : 'Traz um pra mim, hehe.'), plantei: 'Plantou ' + (obj || 'coisa nova') + '? Não esquece de regar!', colhi: 'Colheita boa! ' + (r.id === 'tome' ? 'Hmpf. Nada mal.' : 'Parabéns!'),
      ganhei: 'Ganhou ' + (obj || 'de novo') + '? Isso aí, campeão!', comprei: 'Comprou ' + (obj || 'o quê') + '? Gastou muito? Hehe.', fiz: 'Fez ' + (obj || 'isso') + '? Caprichou!', construi: 'Construiu ' + (obj || 'algo') + '? Quero ver depois!', matei: 'Derrotou ' + (obj || 'um Musgo') + '?! Corajoso!', derrotei: 'Derrotou ' + (obj || 'um Musgo') + '?! Que coragem!',
      achei: 'Achou ' + (obj || 'algo') + '? Que sorte!', encontrei: 'Encontrou ' + (obj || 'algo') + '? Me mostra!', vendi: 'Vendeu ' + (obj || 'bem') + '? Bom negócio!', casei: love ? 'Comigo, né? Hehe ❤' : 'Eu sei! Foi lindo!', joguei: 'Jogou ' + (obj || 'bola') + '? Ganhou?', fui: 'Foi ' + (obj ? 'em ' + obj : 'passear') + '? Que legal!', cozinhei: 'Cozinhou ' + (obj || 'o quê') + '? Me chama na próxima!', terminei: 'Terminou ' + (obj || 'tudo') + '? Merece descanso!', consegui: 'Conseguiu? Eu sabia que você conseguia!' };
    say(react[v]); if (Math.random() < 0.4) { say('Como foi o resto do seu dia?'); M.q = 'dia'; }
  }
  else if ((mm = /(quebrou|quebrei|perdi|caiu|cai |machuquei|morreu|roubaram|deu errado|estraguei|queimei|sumiu|briguei)/.exec(t))) { const w = topicWord(t.replace(mm[1], '')); say(pickR(['Poxa, ' + (w ? w + '... ' : '') + 'que chato, Kai!', 'Ah não! ' + (w ? cap(w) + '? ' : '') + 'Precisa de ajuda?', 'Que azar! Mas vai dar tudo certo.'], id + t) + (w && /quebr/.test(mm[1]) ? ' O Davi ou o Bruno conseguem consertar quase tudo.' : '')); }
  else if (/(to|estou|tou|me sinto|fiquei) (triste|mal|cansad|chatead|sozinh|doente|com medo|preocupad)/.test(t)) say(g === 'crianca' ? 'Ah, não fica triste, Kai! Quer um abraço? 🤗' : pickR(['Poxa, Kai... quer conversar? Às vezes ajuda.', 'Ei, você não está sozinho. O vale inteiro gosta de você.', 'Respira fundo. Amanhã é outro dia, e eu tô aqui.'], id + t));
  else if (/(to|estou|tou|me sinto|fiquei) (feliz|bem|otim|animad|alegre|contente)/.test(t)) say(pickR(['Que bom! Sua alegria contagia.', 'Isso! Assim que eu gosto de ver.', 'Aí sim, Kai!'], id + t));
  if (out.length) return finish(r, out, ch);
  // 5) perguntas
  const q = t.includes('?') || /^(qual|quais|quanto|quantos|quantas|como|onde|quando|quem|por que|porque|o que|oq|vc|voce|tu) /.test(t + ' ');
  const any = (...res) => res.some(re => re.test(t));
  if (any(/^(oi|ola|oie|eai|e ai|opa|salve|bom dia|boa tarde|boa noite|hey|eae|fala)\b/)) { say(love ? pickR(['Oi, amor! ❤', 'Oi, meu bem! Tava pensando em você.', 'Oiii! Saudade!'], id + S.time.min) : opener(r)); if (!/tudo bem|como (vai|voce|vc|esta|ta)|beleza/.test(t)) { if (Math.random() < 0.6) { say('Tudo bem com você?'); M.q = 'comovoce'; } } }
  if (any(/tudo (bem|bom|certo|joia)/, /como (vai|voce|vc) (esta|ta|vai)/, /como (vc|voce) ta/, /beleza\?/, /como esta/, /como ta\b/, /como foi (seu|o seu|teu) dia/)) { say(moodLine(r)); if (Math.random() < 0.55 && !M.q) { say(pickR(['E você, como tá?', 'E aí, como foi seu dia?', 'E você?'], id + S.time.min)); M.q = 'comovoce'; } }
  if (any(/(seu|teu) nome/, /como (voce|vc) se chama/, /quem e (voce|vc)/)) say('Eu sou ' + gw(r, 'o ', 'a ') + r.name + '! ' + (ageGroup(r) === 'crianca' ? 'Você já sabia!' : 'Moro aqui no vale faz tempo.'));
  if (any(/quantos anos/, /sua idade/, /(vc|voce) tem quantos/)) say('Tenho ' + r.age + ' anos. ' + (r.age >= 60 ? 'Já vi muita coisa nesse vale!' : r.age < 12 ? 'Já sou grande!' : r.age < 18 ? 'Quase adulto' + gw(r, '', 'a') + ', hehe.' : ''));
  if (any(/(o que|oq|qual) (voce|vc) faz/, /(seu|teu) (trabalho|emprego|servico)/, /trabalha (com|de)/, /sua profissao/)) say((r.age < 12 ? 'Eu sou criança! Vou na escola e brinco.' : r.prof === 'Estudante' ? 'Sou estudante! De manhã escola, de tarde ' + (NPC_INFO[id] ? NPC_INFO[id].hobby : 'diversão') + '.' : 'Sou ' + r.prof.toLowerCase() + '. ' + (PROF_LINES[r.prof] || [''])[0]));
  if (any(/(o que|oq) (voce|vc) (esta|ta|tá) fazendo/, /fazendo o que/, /ta fazendo/, /oq ta fazendo/)) say(r.sleeping ? 'Tava dormindo! Hahaha.' : 'Tô ' + whereIs(r) + '. ' + pickR(['E você?', 'Passa aqui!', 'Dia tranquilo.'], id + S.time.min));
  if (any(/onde (voce|vc|tu) (esta|ta|tá)/, /cade (voce|vc)/, /onde (vc|voce) ta/)) say('Tô ' + whereIs(r) + '.');
  if (any(/onde (voce|vc) mora/, /(sua|tua) casa/)) { const I = INTERIORS[r.home0 || r.home]; say('Moro na ' + (I ? I.name : 'minha casinha') + '. Passa lá pra tomar um café!'); }
  if (any(/familia/, /(seu|teu|sua|tua) (pai|mae|filh|irma|esposa|marido|pais)/, /(voce|vc) tem (filh|irma)/)) say((NPC_INFO[id] || {}).fam || 'Minha família é o vale!');
  if (any(/(voce|vc) (tem|ta) (namorad|namorando|casad)/, /(voce|vc) e casad/, /(seu|sua) (namorad|marido|esposa)/)) say(love ? 'Tenho, né? VOCÊ! ❤' : !adult ? 'Eu?! Sou ' + (r.age < 12 ? 'criança' : 'novo' + gw(r, '', 'a') + ' demais pra isso') + ', Kai!' : (SOCIAL[id] && SOCIAL[id].no) ? SOCIAL[id].no : 'Não... tô solteir' + gw(r, 'o', 'a') + '. Por quê? 😏');
  if (any(/(do que|oq|o que) (voce|vc) gosta/, /(seu|sua|teu) (hobby|passatempo)/, /gosta de fazer/)) { const I = NPC_INFO[id] || {}; say('Gosto de ' + (I.hobby || 'conversar') + '. E de ganhar ' + r.likes.map(l => (NAMES[l] || l).toLowerCase()).join(' e ') + ' de presente, hehe.'); if (!M.q) { say('E você, do que gosta?'); M.q = 'gosta'; } }
  if ((mm = /(voce|vc) gosta (de|da|do) ([a-z ]+)/.exec(t))) { const w = mm[3].split(' ').filter(x => !STOP.has(x))[0] || mm[3].split(' ')[0]; const item = e.items[0]; const likes = item && r.likes.includes(item), hates = item && SOCIAL[id] && (SOCIAL[id].dislikes || []).includes(item); say(likes ? 'Amo ' + w + '! É meu presente favorito!' : hates ? cap(w) + '? Não muito, sinceramente.' : e.people.length ? opinionOf(r, e.people[0]) : pickR(['Gosto sim! ' + cap(w) + ' é legal.', cap(w) + '? Hmm, mais ou menos.', 'Nunca pensei muito sobre ' + w + ', mas parece bom!'], id + w)); }
  if (any(/comida (favorita|preferida)/, /gosta de comer/)) say('Minha comida favorita é ' + ((NPC_INFO[id] || {}).food || 'torta') + '!');
  if (any(/cor (favorita|preferida)/)) say('Minha cor favorita? ' + cap((NPC_INFO[id] || {}).color || 'azul') + '.');
  if (any(/(seu|teu) sonho/, /quer ser quando/, /sonha/)) say('Meu sonho é ' + ((NPC_INFO[id] || {}).dream || 'ser feliz') + '.');
  if (any(/medo/)) say('Tenho medo de ' + ((NPC_INFO[id] || {}).fear || 'escuro') + '. Mas não espalha!');
  if (any(/aniversario/, /quando (voce|vc) nasceu/)) { const b = SOCIAL[id] && SOCIAL[id].bday; say(b ? 'Meu aniversário é ' + dateText(b[0], b[1]) + '! ' + (isBirthday(id) ? 'É HOJE!' : 'Não esquece, hein!') : 'Não lembro, hahaha.'); }
  if (any(/(voce|vc) gosta de mim/, /(voce|vc) me ama/, /me acha/, /somos amigos/, /sou (seu|sua) amig/, /o que (voce|vc) acha de mim/)) { const h = hearts(id); say(love ? 'Gosto? Eu te amo, bobo! ❤' : h >= 7 ? 'Você é um dos meus melhores amigos, Kai!' : h >= 4 ? 'Claro que gosto! Você é muito legal.' : h >= 1 ? 'Gosto sim! Ainda tô te conhecendo, mas gosto.' : 'A gente mal se conhece... mas você parece legal!'); }
  if (e.people.length && any(/acha (d[aoe]|sobre)/, /conhece/, /gosta (d[aoe])/, /fala (d[aoe]|sobre)/, /e (a|o) /, /\?$/) && !out.some(x => x.includes(e.people[0].name))) say(opinionOf(r, e.people[0]));
  if (any(/novidade/, /fofoca/, /o que (ta|esta) acontecendo/, /alguma noticia/, /que que ta rolando/)) say(newsLine(r));
  if (any(/piada/, /me faz rir/, /algo engracado/)) say(r.pers === 'rabugento' || r.pers === 'serio' ? 'Piada? ' + pickR(JOKES, id + S.time.day) + ' ...Pronto. Feliz?' : pickR(JOKES, id + S.time.day + S.time.min));
  if (any(/^(kk|haha|rs|kkk|ahah|hahaha|hehe)/, / kk/)) say(pickR(['Hahaha!', 'Kkkkk', 'Hehe, você é engraçado.', 'Hahaha, para!'], id + S.time.min));
  if (any(/(obrigad|valeu|vlw|brigad)/)) say(pickR(['De nada!', 'Por nada, Kai!', 'Imagina!'], id + S.time.min));
  if (any(/(tchau|ate mais|ate logo|falou|flw|boa noite e|vou dormir|fui)/)) say(pickR(['Tchau, Kai! Até mais!', 'Até! Se cuida.', 'Falou! Boa sorte por aí.'], id + S.time.min) + (love ? ' Te amo ❤' : ''));
  if (any(/(legal|incrivel|demais|bonit[oa]|lind[oa]|inteligente|engracad[oa]|o melhor|a melhor|adoro voce|admiro)/) && !out.length) { addFriend(id, 2); say(pickR(['Ah, obrigad' + gw(r, 'o', 'a') + '! Você também é demais, Kai.', 'Que isso! Fiquei até vermelh' + gw(r, 'o', 'a') + '.', 'Valeu, Kai! Isso alegrou meu dia.'], id + t)); }
  if (any(/fome|comer|comida|almoc|jant/) && !out.length) say(pickR(['Eu tô com fome também! A Rosa já tirou o pão do forno?', 'Bora comer alguma coisa na padaria?', 'Comida boa é a da Bia, viu?'], id + t));
  if (any(/tempo|chuva|chover|sol\b|frio|calor/) && !out.length) say('Hoje: ' + forecastText().toLowerCase() + '. ' + (valeRaining() ? 'Leva guarda-chuva!' : 'Dia bom pra sair.'));
  // convites (passear, futebol, comer, pescar…) com lugar e hora
  if (any(/(bora|vamos|vem|quer|topa|partiu|bora la)/) && any(/(passe|volta|sair|praca|pescar|jogar|bola|futebol|comer|lanche|dancar|nadar|caminhar|conversar|encontr|festa|ver)/)) {
    const busy = ['work', 'farm', 'fish'].includes((r.entry || currentEntry(r))[3]);
    const place = e.places[0] || (any(/pescar/) ? 'no rio' : any(/bola|futebol/) ? 'no campo' : any(/comer|lanche/) ? 'na padaria' : 'na praça');
    const hour = e.hour || null;
    if (g === 'crianca' && !(hearts(id) >= 1)) say('Minha mãe disse que eu não posso sair com gente que eu não conheço!');
    else if (hearts(id) >= 3 || love || (g === 'crianca' && hearts(id) >= 1)) {
      m.walkPromise = S.time.day;
      say((busy && !love ? 'Agora tô trabalhando, mas depois sim! ' : 'Bora! ') + 'Te encontro ' + place + (hour != null ? ' às ' + hour + 'h' : '') + '.' + (g === 'crianca' ? ' Mas antes das 19h, que é hora de dormir!' : ''));
      if (hour != null && ch === 'phone') phS().plan.push({ at: (S.time.day + (hour * 60 < S.time.min ? 1 : 0)) * 1440 + hour * 60 - 10, chat: id, from: id, text: 'Já tô indo ' + place + '! Te vejo daqui a pouco.' });
    } else say(pickR(['Hmm, quem sabe outro dia? Ainda tô te conhecendo.', 'Hoje não dá... mas obrigad' + gw(r, 'o', 'a') + ' pelo convite!'], id + t));
  }
  if (any(/como (faco|faz|eu|consigo|ganho|compro|pego)/, /onde (compro|acho|encontro|consigo|fica)/, /me (ajuda|ensina)/, /dica/)) { const tip = TIPS.find(([re]) => re.test(t)); say(tip ? tip[1] : pickR(['Hmm, isso eu não sei... pergunta pra Vó Aurora, ela sabe de tudo!', 'Boa pergunta. Tenta perguntar no Armazém do Gil.'], id + t)); }
  if (any(/futebol|bola|partida/) && !out.length) { for (let d = S.time.day; d < S.time.day + 8; d++) { const ev = fbEvent(d, false); if (ev && !fbDone(ev)) { say('Tem futebol ' + (d === S.time.day ? 'hoje' : weekday(d).toLowerCase()) + ' às ' + ev.start + 'h no campo!' + (FB_ATTR[id] ? ' Vai jogar?' : ' Vou torcer!')); if (FB_ATTR[id]) M.q = 'futebol'; break; } } }
  if (any(/festa/) && !out.length) say(newsLine(r));
  // 6) nada reconhecido: responde sobre o assunto que o Kai trouxe
  if (!out.length) {
    const w = topicWord(t);
    if (e.people.length) say(opinionOf(r, e.people[0]));
    else if (e.items.length) { const it = e.items[0], nm = NAMES[it].toLowerCase(); say(r.likes.includes(it) ? 'Você falou ' + nm + '?! Eu adoro ' + nm + '!' : pickR([cap(nm) + '? Tem bastante por aí no vale.', 'Ah, ' + nm + '. ' + pickR(['Útil, né?', 'Já tive muito disso.', 'Bom pra presente!'], it)], id + it)); }
    else if (e.places.length) say(cap(e.places[0].replace(/^(na|no|em) /, '')) + '? ' + pickR(['Adoro ir lá!', 'Passei lá hoje cedo.', 'Lugar bonito, né?'], id + e.places[0]));
    else if (q) say(w ? pickR(['Sobre ' + w + '? Hmm... boa pergunta! Acho que sim.', cap(w) + '? Sinceramente não sei, Kai. E você, o que acha?', 'Deixa eu pensar sobre ' + w + '... acho que depende!'], id + w + S.time.min) : pickR(['Hmm, boa pergunta!', 'Não sei, Kai. E você?'], id + S.time.min));
    else if (w) say(pickR([cap(w) + '? Me conta mais!', 'Sério? ' + cap(w) + '... não sabia disso!', 'Hahaha, ' + w + '! Você é cheio de assunto, Kai.', 'Interessante isso de ' + w + '.', 'Hmm, ' + w + '... ' + gw(r, 'fiquei curioso', 'fiquei curiosa') + '!'], id + w + S.time.min));
    else say(pickR(['Hehe', 'Entendi!', 'Haha, beleza!', '😄'], id + S.time.min));
  }
  return finish(r, out, ch);
}
function cap(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }
function finish(r, out, ch) {
  const M = dlgMem(r.id);
  // evita repetir a mesma frase seguida
  const fixAcc = s => s.replace(/[A-Za-z]+/g, w => { const o = rawWords[w.toLowerCase()]; return o ? (w[0] === w[0].toUpperCase() ? cap(o) : o) : w; });
  let res = out.slice(0, 3).map(s => styl(r, fixAcc(s), ch));
  if (res.length === 1 && M.recent.includes(res[0])) res = [styl(r, pickR(['Como eu disse: ', 'Repito: ', 'Hehe, de novo: '], r.id + S.time.min) + res[0], ch)];
  M.recent.push(...res); if (M.recent.length > 8) M.recent.splice(0, M.recent.length - 8);
  if (sm(r.id).chatDay !== S.time.day) { sm(r.id).chatDay = S.time.day; addFriend(r.id, partnerOf(r.id) ? 6 : 3); }
  return res;
}

// ---------------------------------------------------------------- conversa cara a cara (com assuntos e texto livre)
function talkTopics(n) {
  const r = RES_BY_ID[n.id], others = RESIDENTS.filter(o => !o.kid && o !== r && npcMem(o.id).met);
  const o = others.length ? others[(hashStr(n.id + S.time.day + (dlgMem(n.id).turn || 0)) >>> 0) % others.length] : null;
  const opts = ['Tudo bem?', 'Fala de você', o ? 'E ' + gw(o, 'o', 'a') + ' ' + o.name + '?' : 'Sua família?', 'Novidades?', 'Uma piada!'];
  return opts;
}
function talkConverse(n, first) {
  const r = RES_BY_ID[n.id], M = dlgMem(n.id);
  talkPid = n.id; talkFace = r;
  const lines = first || [r.name + ': ' + opener(r) + ' ' + lifeLine(n.id).replace(/^.*?! /, '')];
  M.turn = (M.turn || 0) + 1;
  const ch = talkTopics(n).map(t => ({ t, fn: () => talkSay(n, t === 'Fala de você' ? 'me fala de voce o que voce faz e do que gosta' : t) }));
  ch.push({ t: '✎ Escrever', fn: () => { const bw = Math.min(W - 40 - SAFE.l - SAFE.r, 700), bx = (W - bw) / 2, by = H - 124 - 10 - SAFE.b; phoneAsk('Escreva para ' + r.name + '…', v => talkSay(n, v, true), [bx + 92, by + 40, bw - 110, 40]); } });
  ch.push({ t: 'Tchau' });
  say(lines, null, ch);
}
function talkSay(n, text, typed) {
  const r = RES_BY_ID[n.id];
  const ans = dlgReply(n.id, text, 'talk');
  const lines = (typed ? ['Kai: ' + text] : []).concat(ans.map(a => r.name + ': ' + a));
  talkConverse(n, lines);
}

// ---------------------------------------------------------------- celular: mensagens espontâneas com assunto
function chatSmallTalk(id) {
  const r = RES_BY_ID[id], M = dlgMem(id), k = M.kai;
  const pool = [];
  if (k.likes && k.likes.length) pool.push('Lembrei de você hoje! Você falou que gosta de ' + k.likes[k.likes.length - 1] + ', né?');
  pool.push(newsLine(r));
  const I = NPC_INFO[id]; if (I) pool.push(pickR(['Hoje passei o dia ' + I.hobby.split(' e ')[0] + '. E você?', 'Tô pensando em ' + I.dream + '... será que dá?'], id + S.time.day));
  return pickR(pool, id + S.time.day);
}
