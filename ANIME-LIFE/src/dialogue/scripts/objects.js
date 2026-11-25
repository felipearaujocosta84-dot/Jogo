// Textos das interações com objetos do apartamento (usam o mesmo sistema de diálogo, sem retrato).
const one = (id, text, extra = {}) => ({ id, start: 'a', nodes: { a: { speaker: null, text, end: true, ...extra } } });

export const objectScripts = {
  sleep: (c) => ({
    id: 'obj_sleep', start: 'a',
    nodes: {
      a: {
        speaker: null,
        text: c.period === 'noite' ? 'A cama está te chamando. Dormir até amanhã?' : 'Ainda é ' + c.period + ', mas a mudança cansou. Dormir até amanhã de manhã?',
        choices: [
          { text: 'Dormir', effects: [{ action: 'sleep' }], end: true },
          { text: 'Agora não', end: true },
        ],
      },
    },
  }),
  computer: () => ({
    id: 'obj_computer', start: 'a',
    nodes: {
      a: {
        speaker: null, text: 'O computador liga com um zumbido baixinho. A área de trabalho ainda tem o papel de parede padrão.',
        choices: [
          { text: 'Ler e-mails', next: 'mail' },
          { text: 'Procurar vagas de emprego', next: 'jobs' },
          { text: 'Desligar', end: true },
        ],
      },
      mail: { speaker: null, text: '1 e-mail novo — Administração do Residencial Hoshizora: "Boas-vindas! Lixo reciclável às quintas. Silêncio depois das 22h."', next: 'a' },
      jobs: { speaker: null, text: 'Você abre um site de vagas: café no térreo, livraria, entregas... (O sistema de empregos ainda não está disponível nesta versão.)', next: 'a' },
    },
  }),
  tv: (c) => one('obj_tv', {
    manhã: 'Na TV, a previsão do tempo: sol com poucas nuvens o dia todo. Ótimo para secar roupa.',
    tarde: 'Está passando um programa de culinária. O apresentador faz um omurice perfeito em dois minutos.',
    noite: 'Está passando um anime de romance escolar. Você assiste a um episódio inteiro sem perceber.',
  }[c.period], c.period === 'noite' ? { effects: [{ action: 'time', minutes: 25 }] } : {}),
  window: (c) => one('obj_window', {
    manhã: 'Lá embaixo, a rua está cheia de gente indo para o trabalho. Uma cerejeira floresce na esquina.',
    tarde: 'O sol da tarde deixa os prédios alaranjados. Dá para ouvir crianças voltando da escola.',
    noite: 'As luzes da cidade piscam ao longe. O letreiro da loja de conveniência ainda está aceso.',
  }[c.period]),
  wardrobe: () => one('obj_wardrobe', 'O guarda-roupa ainda está vazio. Suas roupas continuam nas caixas da mudança.'),
  boxes: () => one('obj_boxes', 'Caixas da mudança. Numa delas está escrito "LIVROS" com a sua letra torta.'),
  boxes_entry: () => one('obj_boxes2', 'Mais caixas. Esta diz "FRÁGIL — COZINHA". Melhor abrir com cuidado depois.'),
  sofa: () => one('obj_sofa', 'Você se joga no sofá por um minuto. É mais confortável do que parecia na loja.', { effects: [{ action: 'time', minutes: 5 }] }),
  books: () => one('obj_books', 'A estante veio com o apartamento. Só tem um guia turístico da cidade e um volume de mangá esquecido pelo antigo morador.'),
  plant: (c) => (c.flag('planta.regada_dia') === c.day
    ? one('obj_plant2', 'A terra ainda está úmida. Por hoje, chega de água.')
    : one('obj_plant', 'Você rega a planta. As folhas parecem até mais verdes.', { effects: [{ flag: 'planta.regada_dia', value: c.day }] })),
  cook: () => one('obj_cook', 'Você abre os armários: só tem sal e um pacote de macarrão instantâneo. (Culinária ainda não está disponível nesta versão.)'),
  fridge: () => one('obj_fridge', 'Quase vazia: uma garrafa de água e dois onigiris de loja de conveniência.'),
  door: (c) => one('obj_door', c.flag('rin.conheceu') || c.day > 1
    ? 'O corredor e o bairro ainda não estão disponíveis nesta versão do jogo. Por enquanto, a vida é aqui dentro.'
    : 'Antes de sair... parece que tem alguém parado bem ali na entrada.'),
};
