// Conversas do celular. Passos: { from, t } mensagem · { from, invite:{title,when,where}, t } convite
// { choice:[{ t, reply?, value, do, go, if, lockIf, lock }], id } resposta do jogador · { label } { go } { if, go } { do } { end }
import { R, M, A, K, rel, flag, post, memory } from '../dsl.js';

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

  akane_2h: {
    title: 'Akane Tachibana', members: [A],
    steps: [
      { from: A, t: 'Acordad{g:o/a/e}?' },
      { from: A, t: 'Li.' },
      { from: A, t: 'Ela escreveu que não foi embora por minha causa. Que foi embora por causa do que ia me contar. E não conseguiu.' },
      { from: A, t: 'E tem uma linha no final. "Se o Sora Kirishima aparecer perguntando por mim, não diga onde eu estou. Ele não é quem parece."' },
      { from: A, t: 'Eu nunca ouvi esse nome na vida.' },
      { id: 'c2_akane_2h', choice: [
        { t: 'Você não precisa descobrir isso sozinha.', value: 'junto', do: [rel(A, { carinho: 3, confianca: 2 }), flag('c2.ajuda_akane')], go: 'a1' },
        { t: 'Quer que eu vá até aí? Só pra fazer companhia.', value: 'ir', do: [rel(A, { afinidade: 2, romance: 1 }), flag('c2.ofereceu_ir')], go: 'a2' },
        { t: 'Talvez seja melhor parar de procurar. Ela pediu isso.', value: 'parar', do: [rel(A, { confianca: -3 }), flag('c2.sugeriu_parar')], go: 'a3' },
      ] },
      { label: 'a1' }, { from: A, t: 'Faz um ano que eu descubro tudo sozinha.' }, { from: A, t: 'Ok. Então não sozinha.' }, { go: 'fim' },
      { label: 'a2' }, { from: A, t: 'Não. Se você vier eu vou chorar e eu odeio chorar na frente dos outros.' }, { from: A, t: '...mas obrigada. Sério.' }, { go: 'fim' },
      { label: 'a3' }, { from: A, t: 'Ela pediu um monte de coisas. Ela também pediu pra eu não procurar a câmera dela quando a gente era criança e a câmera estava embaixo da cama dela.' }, { from: A, t: 'Boa noite.' }, { go: 'fim' },
      { label: 'fim' },
      { from: A, t: 'Amanhã, oito horas, no café. Antes de abrir. Quero que você leia o bilhete inteiro.' },
      { do: [flag('c2.encontro_cafe'), memory(A, 'Akane vai lembrar desta conversa às duas da manhã.')] },
    ],
  },

  mei_2h: {
    title: 'Mei Asano', members: [M],
    steps: [
      { from: M, t: 'Desculpa a hora. A Akane passou aqui agora há pouco.' },
      { from: M, t: 'Ela leu um bilhete da Yuki na minha porta e chorou sentada no corredor. Eu nunca vi a Akane chorar.' },
      { from: M, t: 'No bilhete tem um nome. Sora Kirishima. A Yuki pede pra ninguém dizer onde ela está se ele aparecer.' },
      { from: M, t: 'Você conhece alguém com esse nome?' },
      { id: 'c2_mei_2h', choice: [
        { t: 'Não. Mas a gente pode descobrir juntos.', value: 'descobrir', do: [rel(M, { confianca: 2, amizade: 1 })], go: 'm1' },
        { t: 'Você está bem, Mei?', value: 'cuidado', do: [rel(M, { carinho: 3, afinidade: 1 })], go: 'm2' },
        { t: 'É melhor deixar a Akane cuidar disso.', value: 'distancia', do: [rel(M, { amizade: -1 })], go: 'm3' },
      ] },
      { label: 'm1' }, { from: M, t: 'Juntos. Tá. Eu gosto de como isso soa.' }, { go: 'fim' },
      { label: 'm2' }, { from: M, t: 'Não. Mas fiquei melhor quando você perguntou.' }, { go: 'fim' },
      { label: 'm3' }, { from: M, t: 'Talvez. Mas ela não deixa ninguém ajudar. Esse é o problema.' }, { go: 'fim' },
      { label: 'fim' },
      { from: M, t: 'A Akane disse que vai estar no café amanhã às oito, antes de abrir. Acho que ela quer que você esteja lá.' },
      { do: [flag('c2.encontro_cafe')] },
    ],
  },

  kaito_reuniao: {
    title: 'Hoshizora 201–205 🌸', group: true, members: [K, M, R],
    steps: [
      { from: K, t: 'REUNIÃO DE EMERGÊNCIA 🚨 corredor do 2º andar, 21h' },
      { from: K, t: 'pauta: ALGUÉM ABRIU UM ARMÁRIO SECRETO NO NOSSO TERRAÇO' },
      { from: R, t: 'kaito' },
      { from: R, t: 'não' },
      { from: M, t: 'Eu vou.' },
      { id: 'c3_reuniao', choice: [
        { t: 'Fui eu. Eu explico na reunião.', value: 'assumir', do: [rel(K, { confianca: 2 })], go: 'r1' },
        { t: 'Vou levar biscoito.', value: 'biscoito', do: [rel(K, { amizade: 2 })], go: 'r2' },
      ] },
      { label: 'r1' }, { from: K, t: 'EU SABIA. traz uma cadeira' }, { end: true },
      { label: 'r2' }, { from: K, t: 'finalmente alguém que entende o espírito da coisa 🍪' }, { end: true },
    ],
  },
};
