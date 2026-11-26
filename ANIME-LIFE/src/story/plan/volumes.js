// PLANO DOS 3.000 CAPÍTULOS: 30 volumes × 100 capítulos.
// Cada volume tem um arco próprio (começo, desenvolvimento, conclusão) e passa o bastão para o seguinte.
// Isto é o PLANEJAMENTO do enredo; os capítulos são escritos em lotes (ver catalog.js e ROTEIRO_3000.md).
import { R, M, A, K, H, Y } from '../dsl.js';

export const VOLUMES = [
  { n: 1, title: 'Apartamento 201', cast: [R, A, M, K, Y, H], arc: 'A mudança para Hoshizora, a caixa sem remetente e o mistério de Yuki Tachibana. O protagonista conquista (ou perde) a confiança dos vizinhos enquanto descobre o que a antiga moradora deixou para trás. Termina com a decisão de ir a Kamakura.' },
  { n: 2, title: 'Revelações em Kamakura', cast: [A, M, R], arc: 'A viagem a Kamakura. O reencontro (ou desencontro) das irmãs Tachibana, a verdade sobre a noite em que Yuki partiu e o preço de cada segredo guardado no Volume 1.' },
  { n: 3, title: 'Estações do Café Hoshi', cast: [Y, H, A], arc: 'O café entra em crise financeira. Kyo esconde o motivo de nunca ter ido embora de Hoshizora; Haru precisa escolher entre o emprego e a faculdade.' },
  { n: 4, title: 'Festival de Verão', cast: [K, M, R], arc: 'Kaito organiza o primeiro festival do bairro em dez anos. Rivalidade com a associação de comerciantes, fogos de artifício e uma confissão que ninguém esperava.' },
  { n: 5, title: 'Traços de Mei', cast: [M, A], arc: 'Mei volta a desenhar e é convidada para uma exposição em Tóquio. O passado artístico dela com Yuki e uma acusação de plágio colocam tudo em risco.' },
  { n: 6, title: 'Filme Não Revelado', cast: [A, R], arc: 'As fotos da câmera de Yuki revelam a infância das irmãs e um terceiro nome que ninguém menciona. A família Tachibana entra em cena.' },
  { n: 7, title: 'Inverno no Terraço', cast: [R, K], arc: 'Rin se forma e recebe uma proposta de emprego longe de Hoshizora. O prédio passa o primeiro inverno juntos; o terraço vira refúgio e campo de batalha.' },
  { n: 8, title: 'Constelações', cast: [H, R], arc: 'Haru tenta entrar no programa do observatório nacional. Noites de estudo, um cometa e o medo de ser comum demais para os próprios sonhos.' },
  { n: 9, title: 'O Dono do Café', cast: [Y, A], arc: 'O misterioso dono do Café Hoshi aparece com um comprador. Kyo e o protagonista lutam para salvar o lugar — e descobrem a ligação do dono com Kyo.' },
  { n: 10, title: 'Partidas', cast: [R, M, K, A, Y, H], arc: 'Fim do primeiro ano. Alguém deixa o Residencial Hoshizora. As escolhas acumuladas definem quem fica, quem vai e quem volta.' },
  { n: 11, title: 'Primavera Outra Vez', cast: [K, M], arc: 'Um novo morador no 204 bagunça o equilíbrio do prédio. O protagonista agora é o veterano que recebe alguém.' },
  { n: 12, title: 'A Agência', cast: [R, Y], arc: 'O protagonista consegue uma chance na sua área profissional. Prazos, um chefe impossível e o dilema entre carreira e as pessoas de Hoshizora.' },
  { n: 13, title: 'Sinais de Fumaça', cast: [K, A], arc: 'Um incêndio na rua do café. Kaito vira herói por acaso; Akane fotografa a tragédia e enfrenta a ética do próprio trabalho.' },
  { n: 14, title: 'Cartas Para Ninguém', cast: [M, H], arc: 'Mei descobre que os cartões-postais de Yuki tinham um padrão. Um jogo de pistas atravessa a cidade.' },
  { n: 15, title: 'Família', cast: [A, Y], arc: 'Os pais do protagonista visitam Hoshizora. Comparações, expectativas e a pergunta: o que você veio buscar aqui, afinal?' },
  { n: 16, title: 'O Concurso', cast: [R, M], arc: 'Rin e Mei disputam o mesmo concurso de design. A amizade das duas é testada em público.' },
  { n: 17, title: 'Rotas Cruzadas', cast: [K, H], arc: 'Kaito sofre um acidente de bicicleta. Semanas de recuperação mudam a dinâmica do prédio e revelam quem cuida de quem.' },
  { n: 18, title: 'Noites de Jazz', cast: [Y, A], arc: 'Kyo transforma o café em bar de jazz às sextas. Música, um antigo amor de Kyo e uma noite que termina na delegacia.' },
  { n: 19, title: 'O Observatório', cast: [H, R], arc: 'Haru é aceito no observatório — longe. O grupo organiza uma última noite de estrelas.' },
  { n: 20, title: 'Meio do Caminho', cast: [R, M, K, A, Y, H], arc: 'Dois anos depois da mudança. Cada rota romântica chega a um ponto sem volta; amizades se consolidam ou se rompem.' },
  { n: 21, title: 'Kamakura, de Novo', cast: [A, M], arc: 'Yuki pede ajuda: algo em Kamakura está desmoronando. O grupo volta à cidade do mar.' },
  { n: 22, title: 'A Casa de Chá', cast: [Y, H], arc: 'Kyo herda uma casa de chá abandonada. Reforma, fantasmas de família e uma escolha entre o café e o passado.' },
  { n: 23, title: 'Tempestade', cast: [K, R], arc: 'Um tufão isola Hoshizora por três dias. O prédio vira um só lar — e segredos não sobrevivem ao confinamento.' },
  { n: 24, title: 'Exposição Individual', cast: [M, A], arc: 'Mei finalmente expõe sozinha. Akane fotografa a abertura; a crítica destrói, o público ama.' },
  { n: 25, title: 'Contratos', cast: [R, Y], arc: 'O protagonista recebe uma proposta que exige se mudar. A cidade pesa contra o coração.' },
  { n: 26, title: 'Raízes', cast: [K, H], arc: 'Kaito assume o negócio de entregas da família e tenta modernizá-lo sem perder o bairro.' },
  { n: 27, title: 'Aniversários', cast: [R, M, K, A, Y, H], arc: 'Uma série de aniversários e datas importantes revisita os momentos mais marcantes de cada rota.' },
  { n: 28, title: 'Promessas Cumpridas', cast: [A, M, R], arc: 'As promessas feitas desde o Volume 1 cobram resposta. Quem prometeu o quê — e cumpriu?' },
  { n: 29, title: 'Últimas Estações', cast: [R, M, K, A, Y, H], arc: 'A preparação para o futuro de cada um: casamentos, mudanças, carreiras, reconciliações — conforme as escolhas de toda a jornada.' },
  { n: 30, title: 'Minha Vida', cast: [R, M, K, A, Y, H], arc: 'O final. Os epílogos de cada rota e de cada amizade, e a última noite no terraço do Residencial Hoshizora.' },
];
