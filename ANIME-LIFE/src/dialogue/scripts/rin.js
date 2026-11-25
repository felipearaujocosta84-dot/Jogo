// Rin (character_01) — vizinha do 202. Primeiro encontro no dia da mudança.
const R = 'character_01';

export const rinIntro = {
  id: 'rin_intro',
  start: 'n0',
  nodes: {
    n0: { speaker: null, text: 'Uma garota de moletom preto está parada na entrada, segurando uma caixa de papelão.', next: 'n1' },
    n1: { speaker: R, expr: 'embarrassed', text: 'Ah! Desculpa entrar assim... A porta estava aberta, eu chamei, mas ninguém respondeu.', next: 'n2' },
    n2: {
      speaker: R, expr: 'curious', text: 'Oi! Você acabou de se mudar para cá?',
      choices: [
        { text: 'Sim, cheguei hoje.', decision: 'rin.mudanca', value: 'hoje', affinity: { [R]: 2 }, next: 'a1' },
        { text: 'Já faz alguns dias.', decision: 'rin.mudanca', value: 'dias', affinity: { [R]: 1 }, next: 'b1' },
        { text: 'Por que está perguntando?', decision: 'rin.mudanca', value: 'desconfiado', next: 'c1' },
      ],
    },
    // — "Sim, cheguei hoje."
    a1: { speaker: R, expr: 'happy', text: 'Eu imaginei! Vi o caminhão de mudança hoje cedo e fiquei curiosa pra saber quem ia morar no 201.', next: 'a2' },
    a2: { speaker: R, expr: 'neutral', text: 'Eu sou a Rin. Moro no 202, aqui do lado.', next: 'pkg1' },
    // — "Já faz alguns dias."
    b1: { speaker: R, expr: 'surprised', text: 'Sério? Nossa... eu passei a semana inteira trancada estudando pras provas, nem percebi.', next: 'b2' },
    b2: { speaker: R, expr: 'embarrassed', text: 'Que vergonha de vizinha. Eu sou a Rin, do 202, aqui do lado.', next: 'pkg1' },
    // — "Por que está perguntando?"
    c1: { speaker: R, expr: 'embarrassed', text: 'Ah, desculpa! Não quis parecer intrometida.', next: 'c2' },
    c2: { speaker: R, expr: 'neutral', text: 'É que o entregador deixou esta caixa na minha porta. A etiqueta diz "Apartamento 201"... e o nome {fullname}.', next: 'c3' },
    c3: { speaker: R, expr: 'neutral', text: 'Eu sou a Rin, do 202. Só vim devolver.', next: 'pkg2' },
    // — caixa
    pkg1: { speaker: R, expr: 'neutral', text: 'Ah, e o entregador deixou esta caixa na minha porta por engano. Tem o seu nome na etiqueta: {fullname}.', next: 'pkg2' },
    pkg2: { speaker: null, text: 'Rin entrega a caixa. É leve e tem um adesivo de "FRÁGIL".', effects: [{ item: 'package' }], next: 'q2' },
    q2: {
      speaker: R, expr: 'neutral', text: 'Pronto, entregue sã e salva.',
      choices: [
        { text: 'Valeu! Foi muito gentil da sua parte.', decision: 'rin.reacao', value: 'agradeceu', affinity: { [R]: 3 }, next: 'd1' },
        { text: 'Você abriu a caixa?', decision: 'rin.reacao', value: 'desconfiou', affinity: { [R]: -2 }, next: 'e1' },
        { text: 'Quer um chá? A chaleira foi a primeira coisa que desempacotei.', decision: 'rin.reacao', value: 'convidou', affinity: { [R]: 2 }, next: 'f1' },
      ],
    },
    d1: { speaker: R, expr: 'happy', text: 'Imagina! Vizinho tem que se ajudar, né?', next: 'num' },
    e1: { speaker: R, expr: 'angry', text: 'Claro que não! Eu só li a etiqueta pra saber de quem era...', next: 'e2' },
    e2: { speaker: R, expr: 'sad', text: '...Tudo bem. Eu também ia desconfiar. Cidade grande deixa a gente assim.', next: 'bye' },
    f1: { speaker: R, expr: 'surprised', text: 'Chá? Agora?', next: 'f2' },
    f2: { speaker: R, expr: 'embarrassed', text: 'Eu adoraria, mas preciso entregar um trabalho da faculdade até meia-noite. Fica pra próxima, tá?', effects: [{ flag: 'rin.cha_pendente' }], next: 'num' },
    num: { speaker: R, expr: 'happy', text: 'Se precisar de alguma coisa, me manda mensagem. Vou salvar meu número no seu celular.', effects: [{ contact: R }], next: 'bye' },
    bye: {
      speaker: R, expr: 'happy', text: 'Boas-vindas ao prédio! Até mais.',
      effects: [{ flag: 'rin.conheceu' }], end: true,
    },
  },
};

export const rinAgain = {
  id: 'rin_again',
  start: (c) => (c.flag('rin.reacao') === 'desconfiou' ? 'x1' : c.flag('rin.cha_pendente') ? 'y1' : 'z1'),
  nodes: {
    x1: { speaker: R, expr: 'neutral', text: 'Já abriu a caixa? ...Não que eu esteja curiosa. Nem um pouco.', end: true },
    y1: { speaker: R, expr: 'happy', text: 'Não esqueci do chá, viu? Assim que eu entregar esse trabalho, eu venho cobrar.', end: true },
    z1: { speaker: R, expr: 'neutral', text: 'Ah, uma dica: o zelador fica no térreo, mas só até as seis. Se perder a chave depois disso... boa sorte.', end: true },
  },
};

export default (c) => (c.flag('rin.conheceu') ? rinAgain : rinIntro);
