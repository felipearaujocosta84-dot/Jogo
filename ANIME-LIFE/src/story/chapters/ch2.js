// CAPÍTULO 2 — Cartões-postais de Kamakura (abertura)
// A primeira cena muda conforme o final da noite do Capítulo 1 (escolha.c1_final)
// e conforme os segredos revelados (akane.sabe_postais, traiu_mei, rin.filme, kaito.domingo...).
import { R, M, A, K, rel, flag, memory } from '../dsl.js';

const s1 = {
  id: 'c2s1', title: 'A manhã seguinte', thumb: { bg: 'apartamento', char: A },
  steps: [
    { music: 'home' }, { bg: 'apartamento' }, { card: 'Domingo, 8h' },
    { if: (c) => c.flag('akane.sabe_postais'), go: 'akane_porta' },
    { if: (c) => c.chose('c1_final') === 'kaito', go: 'kaito' },
    { if: (c) => c.chose('c1_final') === 'mei', go: 'mei' },
    { if: (c) => c.chose('c1_final') === 'akane', go: 'akane_calma' },
    { go: 'rin' },

    // Akane descobriu os cartões-postais (por você)
    { label: 'akane_porta' },
    { n: 'Batidas fortes. Não são três, educadas. São muitas.' },
    { show: A, at: 'center', e: 'angry' },
    { c: A, e: 'angry', t: 'A Mei mora no 205, não é?' },
    { c: A, e: 'sad', t: 'Eu não dormi. Fiquei a noite toda olhando o mapa de Kamakura no celular, como se ele fosse me responder.' },
    { if: (c) => c.flag('traiu_mei'), go: 'akane_traiu' },
    { go: 'akane_q' },
    { label: 'akane_traiu' },
    { th: 'A Mei confiou em mim. E eu contei na primeira ligação.' },
    { label: 'akane_q' },
    { id: 'c2_akane_porta', choice: [
      { t: 'Eu vou com você. Mas deixa eu falar primeiro.', value: 'mediar', do: [rel(A, { confianca: 3 }), rel(M, { confianca: 2 }), flag('c2.mediar')], go: 'ap1' },
      { t: 'Akane, você não pode invadir a casa dela desse jeito.', value: 'frear', do: [rel(A, { confianca: -2, afinidade: 1 }), rel(M, { confianca: 1 })], go: 'ap2' },
      { t: 'Vai. Você esperou um ano. Já esperou demais.', value: 'apoiar', do: [rel(A, { afinidade: 3 }), rel(M, { confianca: -3 }), flag('c2.confronto')], go: 'ap3' },
    ] },
    { label: 'ap1' }, { c: A, e: 'neutral', t: '...Tá. Você fala. Eu fico atrás. Eu tento.' }, { go: 'envelope' },
    { label: 'ap2' }, { c: A, e: 'angry', t: 'Invadir? Ela escondeu minha irmã de mim!' }, { c: A, e: 'sad', t: '...Desculpa. Você tem razão. Eu odeio que você tenha razão.' }, { go: 'envelope' },
    { label: 'ap3' }, { c: A, e: 'surprised', t: 'Você não vai me dizer pra ter calma?' }, { c: A, e: 'neutral', t: 'Todo mundo me diz pra ter calma. Obrigada por não dizer.' }, { go: 'envelope' },

    // Final com o Kaito
    { label: 'kaito' },
    { if: (c) => !c.flag('kaito.domingo'), go: 'kaito2' },
    { n: 'Oito em ponto. Kaito está na porta com uma bicicleta, duas joelheiras e um sorriso que não combina com o horário.' },
    { show: K, at: 'center', e: 'happy' },
    { c: K, e: 'happy', t: 'Bom dia, aluno! Hoje você aprende a cair com estilo.' }, { go: 'kaito3' },
    { label: 'kaito2' },
    { n: 'Kaito bate na porta com dois pães de melão e cara de quem dormiu três horas.' },
    { show: K, at: 'center', e: 'neutral' },
    { c: K, e: 'neutral', t: 'Café da manhã. É suborno. Preciso de ajuda com uma coisa.' },
    { label: 'kaito3' },
    { c: K, e: 'curious', t: 'Mas antes: passei na caixa de correio do prédio. Tem uma coisa pra você.' }, { go: 'envelope' },

    // Final com a Mei
    { label: 'mei' },
    { n: 'Uma mensagem às 7h42: “Acordad{g:o/a/e}? Desculpa. Não dormi.” Dois minutos depois, a Mei está na sua porta.' },
    { show: M, at: 'center', e: 'sad' },
    { if: (c) => c.flag('mei.escrever_yuki'), go: 'mei_carta' },
    { c: M, e: 'neutral', t: 'Pensei a noite toda no que você disse. Ainda não decidi nada. Mas eu queria que você soubesse que eu pensei.' }, { go: 'mei_fim' },
    { label: 'mei_carta' },
    { c: M, e: 'neutral', t: 'Eu escrevi pra Yuki. Três páginas. Rasguei duas.' },
    { c: M, e: 'happy', t: 'Vou postar segunda. Posta-restante, Kamakura. Como você disse.' }, { do: [rel(M, { afinidade: 2 })] },
    { label: 'mei_fim' },
    { c: M, e: 'curious', t: 'Ah... e passei pela caixa de correio. Tem uma coisa pra você.' }, { go: 'envelope' },

    // Ligou para a Akane, mas sem revelar os cartões
    { label: 'akane_calma' },
    { n: 'O celular toca às oito. Akane. Nenhuma mensagem antes — ela simplesmente liga.' },
    { show: A, at: 'center', e: 'neutral' },
    { c: A, e: 'neutral', t: 'Você me ligou ontem pra saber se eu estava bem. Então hoje eu ligo pra saber se você está.' },
    { c: A, e: 'embarrassed', t: 'Isso é uma coisa que as pessoas fazem, né? Estou fora de prática.' },
    { do: [rel(A, { afinidade: 2 })] },
    { c: A, e: 'curious', t: 'Aliás, o Kaito me mandou mensagem. Disse que chegou alguma coisa no seu correio.' }, { go: 'envelope' },

    // Final com a Rin (padrão)
    { label: 'rin' },
    { if: (c) => c.flag('rin.filme'), go: 'rin_filme' },
    { n: 'Três batidas curtas, educadas. Rin, com dois cafés de máquina e o capuz na cabeça.' },
    { show: R, at: 'center', e: 'neutral' },
    { c: R, e: 'neutral', t: 'Bom dia. Eu não acordo antes do meio-dia. Então isso é uma emergência.' }, { go: 'rin_fim' },
    { label: 'rin_filme' },
    { n: 'Uma mensagem às 8h01: “a loja de revelação abre às 10. só dizendo.” Às 8h03, a Rin já está na sua porta.' },
    { show: R, at: 'center', e: 'curious' },
    { c: R, e: 'curious', t: 'Eu não dormi pensando nas fotos. Isso é culpa sua.' },
    { label: 'rin_fim' },
    { c: R, e: 'serious', t: 'Mas não é por isso que eu vim. Olha o que estava na sua caixa de correio.' },

    // ---------- comum a todos ----------
    { label: 'envelope' },
    { n: 'Um envelope de Kamakura. A mesma letra caprichada da caixa.' },
    { n: 'Mas, desta vez, o destinatário não é a Yuki, nem a Akane, nem a Mei.' },
    { n: '“Para quem estiver morando no meu apartamento.”' },
    { th: 'Ela sabe que tem alguém aqui. Como ela sabe?' },
    { id: 'c2_envelope', choice: [
      { t: 'Abrir agora, na frente de quem está comigo.', value: 'abrir_junto', do: [flag('c2.envelope', 'junto')], go: 'e1' },
      { t: 'Guardar e abrir mais tarde, sozinh{g:o/a/e}.', value: 'abrir_sozinho', do: [flag('c2.envelope', 'sozinho'), memory(R, 'Seus vizinhos perceberam que você guardou o envelope.')], go: 'e2' },
      { t: 'Ligar para a Akane antes de abrir.', value: 'akane', lockIf: (c) => !c.contact(A), lock: 'Você não tem o número da Akane.', do: [flag('c2.envelope', 'akane'), rel(A, { confianca: 3 })], go: 'e3' },
    ] },
    { label: 'e1' }, { n: 'Você rasga a ponta do envelope. Dentro, uma folha dobrada em quatro e uma chave pequena, de cadeado.' }, { go: 'fim' },
    { label: 'e2' }, { n: 'Você guarda o envelope no bolso. Ele pesa mais do que deveria — tem algo de metal lá dentro.' }, { go: 'fim' },
    { label: 'e3' }, { n: 'Você liga. A Akane atende no primeiro toque e não diz nada por um longo tempo. Depois: “Não abre. Estou indo.”' },
    { label: 'fim' },
    { card: 'Continua no próximo capítulo' },
    { end: true },
  ],
};

export default {
  id: 'ch2', number: 2, title: 'Cartões-postais de Kamakura',
  subtitle: 'Alguém em Kamakura sabe que você existe.',
  preview: true, // capítulo em produção: só a abertura está disponível
  scenes: [s1],
};
