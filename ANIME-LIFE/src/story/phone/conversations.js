// Conversas do celular. Passos: { from, t } mensagem · { from, invite:{title,when,where}, t } convite
// { choice:[{ t, reply?, value, do, go, if, lockIf, lock }], id } resposta do jogador · { label } { go } { if, go } { do } { end }
import { R, M, A, K, rel, flag, post } from '../dsl.js';

export const CONVERSATIONS = {
  grupo_predio: {
    title: 'Hoshizora 201–205 🌸', group: true, members: [R, K, M],
    steps: [
      { from: K, t: 'ATENÇÃO MORADORES 📢' },
      { from: K, t: 'temos gente nova no 201!!! boas-vindas, {nome} 🎉' },
      { from: M, t: 'Boas-vindas. Eu sou a Mei, do 205. O Kaito grita assim com todo mundo, não é pessoal.' },
      { from: R, t: 'ele gritou assim com o carteiro semana passada' },
      { from: K, t: 'o carteiro sou EU, Rin' },
      { id: 'c1_grupo', choice: [
        { t: 'Valeu, gente! Feliz de estar aqui 😊', value: 'simpatico', do: [rel(K, { amizade: 2 }), rel(M, { amizade: 1 })], go: 'g1' },
        { t: 'Kaito, você é o entregador? Então foi você que deixou a caixa da Yuki na porta da Rin.', value: 'caixa', do: [rel(K, { afinidade: 1 }), flag('mei.sabe_caixa')], go: 'g2' },
        { t: 'Não sabia que tinha grupo. Rin, foi você que me adicionou? 👀', value: 'rin', do: [rel(R, { afinidade: 2 })], go: 'g3' },
      ] },
      { label: 'g1' }, { from: K, t: 'VIU, RIN. educação. aprende' }, { from: R, t: '😑' }, { go: 'convite' },
      { label: 'g2' }, { from: K, t: 'fui eu sim 🚲 veio de Kamakura, sem remetente. achei estranho' }, { from: M, t: '...' }, { from: M, t: 'Que caixa?' }, { from: R, t: 'depois eu te conto, Mei' }, { go: 'convite' },
      { label: 'g3' }, { from: R, t: 'foi o Kaito. eu só aprovei' }, { from: R, t: 'por enquanto' }, { from: K, t: 'ela gosta de você. isso é raro' }, { from: R, t: 'kaito.' },
      { label: 'convite' },
      { from: K, invite: { title: 'Festa no terraço 🎆', when: 'Sábado, 18h', where: 'Terraço do prédio' }, t: 'sábado tem festinha de boas-vindas no terraço!! comida por minha conta, bebida por conta de vocês' },
      { from: M, t: 'Eu levo os pratos. E desligo a caixa de som do Kaito às dez.' },
      { id: 'c1_convite', choice: [
        { t: 'Tô dentro! Levo refrigerante e salgadinho.', value: 'sim', do: [rel(K, { amizade: 2 }), rel(M, { amizade: 1 }), rel(R, { amizade: 1 })], go: 'c1' },
        { t: 'Vou tentar, mas trabalho no Café Hoshi no sábado.', value: 'talvez', go: 'c2' },
        { t: 'Acho que vou passar dessa vez.', value: 'nao', do: [rel(K, { amizade: -1 }), flag('convite_recusado')], go: 'c3' },
      ] },
      { label: 'c1' }, { from: K, t: 'ISSOOO 🎉🎉' }, { from: R, t: 'traz o salgadinho de alga. não aceito outro' }, { go: 'fim' },
      { label: 'c2' }, { from: K, t: 'o Kyo fecha às 17h no sábado. eu sei. eu entrego o leite dele' }, { from: M, t: 'Ele sabe tudo de todo mundo. É assustador.' }, { go: 'fim' },
      { label: 'c3' }, { from: R, t: 'vem.' }, { from: R, t: 'por favor' }, { from: K, t: 'a Rin disse POR FAVOR. isso nunca aconteceu na história deste prédio' }, { do: [rel(R, { afinidade: 1 })] },
      { label: 'fim' },
      { from: K, t: 'postei o pôr do sol de hoje, curtam aí 📸' },
      { do: [post('kaito_por_do_sol')] },
    ],
  },

  akane_noite: {
    title: 'Akane Tachibana', members: [A],
    steps: [
      { if: (c) => c.flag('akane.vai_buscar'), go: 'buscar' },
      { from: A, t: 'Aqui é a Akane. Do café.' },
      { from: A, t: 'Se chegar qualquer coisa pra Yuki, qualquer coisa, me avisa. Por favor.' },
      { id: 'c1_akane_msg', choice: [
        { t: 'Aviso. Prometo.', value: 'prometo', do: [rel(A, { confianca: 2 }), flag('promessa_akane')], go: 'g1' },
        { t: 'Por que ela foi embora?', value: 'porque', do: [rel(A, { afinidade: 1 })], go: 'g2' },
        { t: 'Boa noite, Akane.', value: 'seco', go: 'g3' },
      ] },
      { label: 'g1' }, { from: A, t: 'Obrigada.' }, { from: A, t: 'Desculpa a hora. Eu não durmo muito.' }, { end: true },
      { label: 'g2' }, { from: A, t: 'Se eu soubesse, não estaria mandando mensagem pra um estranho às onze da noite.' }, { from: A, t: 'Desculpa. Essa foi grossa. Boa noite.' }, { end: true },
      { label: 'g3' }, { from: A, t: 'Boa noite.' }, { end: true },
      { label: 'buscar' },
      { from: A, t: 'Aqui é a Akane. Do café.' },
      { from: A, t: 'Amanhã às 19h eu passo aí pra pegar a caixa. Pode ser?' },
      { id: 'c1_akane_msg', choice: [
        { t: 'Pode. Vou estar em casa.', value: 'ok', do: [rel(A, { confianca: 1 })], go: 'b1' },
        { t: 'Pode. Mas... você está bem?', value: 'perguntou', do: [rel(A, { afinidade: 2, confianca: 1 })], go: 'b2' },
        { t: 'Prefere que eu leve no café? Pra você não precisar vir ao prédio.', value: 'cafe', do: [rel(A, { confianca: 2, amizade: 1 }), flag('akane.entrega_cafe')], go: 'b3' },
      ] },
      { label: 'b1' }, { from: A, t: 'Ok.' }, { end: true },
      { label: 'b2' }, { from: A, t: 'Não.' }, { from: A, t: 'Mas obrigada por perguntar. Faz tempo que ninguém pergunta.' }, { end: true },
      { label: 'b3' }, { from: A, t: '...Como você sabia que eu odeio aquele prédio?' }, { from: A, t: 'Sim. No café. Obrigada.' }, { end: true },
    ],
  },
};
