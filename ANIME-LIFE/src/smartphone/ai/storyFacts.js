// O que cada personagem SABE dos acontecimentos da história (vai para a IA como contexto).
// Cada fato só aparece para quem estava presente ou ficou sabendo — nada de onisciência.
import { R, M, A, K, H, Y } from '../../story/dsl.js';

const has = (s, k) => !!s.flags[k];
const chose = (s, id) => [...s.decisions].reverse().find((d) => d.id === id)?.value;

const RULES = [
  [R, (s) => s.flags.pacote === 'guardado' && 'O jogador decidiu guardar a caixa da Yuki sem abrir.'],
  [R, (s) => s.flags.pacote === 'aberto' && 'Você e o jogador abriram juntos a caixa de Kamakura: tinha uma câmera analógica e um envelope "Para A.".'],
  [R, (s) => s.flags.pacote === 'devolvido' && 'O jogador não quis se envolver com a caixa da Yuki; você ficou com ela.'],
  [R, (s) => chose(s, 'c1_final') === 'rin' && 'Depois da festa, o jogador ficou com você no terraço olhando o céu.'],
  [R, (s) => has(s, 'rin.filme') && 'Vocês falaram em revelar o filme da câmera da Yuki.'],
  [R, (s) => has(s, 'rin.numero') && 'Você deu seu número ao jogador no dia da mudança.'],
  [M, (s) => s.flags.segredo_mei === 'guardado' && 'Você contou ao jogador sobre os cartões-postais da Yuki e ele(a) prometeu guardar segredo.'],
  [M, (s) => s.flags.segredo_mei === 'defende_akane' && 'Você contou ao jogador sobre os cartões-postais da Yuki e ele(a) disse que a Akane merece saber.'],
  [M, (s) => s.flags.segredo_mei === 'perguntou' && 'Você contou ao jogador sobre os cartões-postais da Yuki e ele(a) perguntou por que a Yuki se esconde da irmã.'],
  [M, (s) => has(s, 'traiu_mei') && 'Você descobriu que o jogador contou o seu segredo para a Akane, mesmo tendo prometido guardar. Isso te magoou muito.'],
  [M, (s) => chose(s, 'c1_final') === 'mei' && 'O jogador te acompanhou até o 205 depois da festa.'],
  [A, (s) => has(s, 'akane.vai_buscar') && 'O jogador contou que a caixa da Yuki chegou e combinou de entregá-la a você.'],
  [A, (s) => has(s, 'confessou_akane') && 'O jogador mentiu dizendo que nada tinha chegado, mas depois ligou para confessar.'],
  [A, (s) => has(s, 'akane.sabe_postais') && 'O jogador te contou que a Yuki manda cartões-postais de Kamakura para a Mei.'],
  [A, (s) => chose(s, 'c1_final') === 'akane' && 'O jogador te ligou à noite só para saber como você estava.'],
  [K, (s) => chose(s, 'c1_segredo') === 'bike' && 'O jogador contou que nunca aprendeu a andar de bicicleta; você prometeu ensinar.'],
  [K, (s) => chose(s, 'c1_final') === 'kaito' && 'O jogador ficou para te ajudar a recolher as lâmpadas da festa.'],
  [H, (s) => has(s, 'haru.astronomia') && 'O jogador se interessou pela prateleira de astronomia que você escolheu no café.'],
  [Y, (s) => s.flags.motivo && `Na entrevista, o jogador disse que veio para Hoshizora porque ${({ recomecar: 'queria recomeçar', aluguel: 'o aluguel era barato', perdi: 'veio atrás de algo que perdeu' })[s.flags.motivo]}.`],
];

export function storyFactsFor(id, state) {
  const facts = [];
  for (const [who, fn] of RULES) if (who === id) { const f = fn(state); if (f) facts.push(f); }
  const ch = Object.entries(state.chapters).filter(([, c]) => c.done).length;
  facts.push(`O jogador mora no apartamento 201 do Residencial Hoshizora e trabalha no Café Hoshi. Capítulos concluídos: ${ch}.`);
  return facts;
}

/** Decisões graves pesam além da pontuação: limitam quanto a confiança pode subir. */
export function trustCap(id, state) {
  if (id === M && state.flags.traiu_mei) return 0.35; // ganhos de confiança/carinho com a Mei valem 35%
  if (id === A && state.flags.mentiu_akane) return 0.6;
  return 1;
}
