// PLANO DOS 350 CAPÍTULOS: 10 volumes × 35 capítulos.
// Cada volume tem um arco próprio (começo, desenvolvimento, conclusão) e passa o bastão para o seguinte.
// Isto é o PLANEJAMENTO do enredo; os capítulos são escritos em lotes (ver catalog.js e ROTEIRO.md).
import { R, M, A, K, H, Y } from '../dsl.js';

export const VOLUMES = [
  { n: 1, title: 'Apartamento 201', cast: [R, A, M, K, Y, H], arc: 'A mudança para Hoshizora, a caixa sem remetente e o mistério de Yuki Tachibana. O protagonista conquista (ou perde) a confiança dos vizinhos, descobre o que a antiga moradora deixou para trás e quem é Sora Kirishima. Termina em Kamakura, com o reencontro (ou desencontro) das irmãs Tachibana.' },
  { n: 2, title: 'Estações do Café Hoshi', cast: [Y, H, A], arc: 'O café entra em crise e o misterioso dono aparece com um comprador. As fotos da câmera de Yuki revelam a infância das irmãs e um terceiro nome; Kyo conta por que nunca foi embora de Hoshizora, e Haru escolhe entre o emprego e a faculdade.' },
  { n: 3, title: 'Festival de Verão', cast: [K, M, R, H], arc: 'Kaito organiza o primeiro festival do bairro em dez anos. Mei volta a desenhar e é convidada para uma exposição em Tóquio; Haru tenta o programa do observatório. Fogos de artifício e uma confissão que ninguém esperava.' },
  { n: 4, title: 'Inverno no Terraço', cast: [R, K, M, A, Y, H], arc: 'Rin se forma e recebe uma proposta longe de Hoshizora. O prédio passa o primeiro inverno juntos e, no fim do primeiro ano, alguém vai embora: as escolhas acumuladas definem quem fica, quem vai e quem volta.' },
  { n: 5, title: 'Primavera Outra Vez', cast: [K, R, Y, A], arc: 'Um novo morador no 204 bagunça o prédio, e agora o protagonista é o veterano. Uma chance na carreira traz um chefe impossível; um incêndio na rua do café transforma Kaito em herói por acaso e põe à prova a ética de Akane.' },
  { n: 6, title: 'Cartas Para Ninguém', cast: [M, H, R, A], arc: 'Mei descobre um padrão nos cartões-postais de Yuki, e um jogo de pistas atravessa a cidade. Os pais do protagonista visitam Hoshizora; Rin e Mei disputam o mesmo concurso de design.' },
  { n: 7, title: 'Noites de Jazz', cast: [K, Y, H], arc: 'Kaito se acidenta e o prédio reorganiza quem cuida de quem. Kyo transforma o café em bar de jazz às sextas e reencontra um antigo amor. Haru é aceito no observatório, longe, e o grupo organiza uma última noite de estrelas.' },
  { n: 8, title: 'Meio do Caminho', cast: [R, M, K, A, Y, H], arc: 'Dois anos depois da mudança, cada rota romântica chega a um ponto sem volta. Yuki pede ajuda em Kamakura; na volta, um tufão isola Hoshizora por três dias, e nenhum segredo sobrevive ao confinamento.' },
  { n: 9, title: 'Raízes', cast: [Y, M, K, R], arc: 'Kyo herda uma casa de chá abandonada; Mei expõe sozinha; Kaito assume o negócio da família. O protagonista recebe uma proposta que exige se mudar, e a cidade pesa contra o coração.' },
  { n: 10, title: 'Minha Vida', cast: [R, M, K, A, Y, H], arc: 'As promessas feitas desde o Volume 1 cobram resposta. Aniversários, casamentos, mudanças e reconciliações, conforme as escolhas de toda a jornada, e a última noite no terraço do Residencial Hoshizora.' },
];
