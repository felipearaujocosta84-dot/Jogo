# Vale da Lanterna — Expansão "Mundo Vivo"

Documento de trabalho da expansão. Atualizado a cada fase.

## Ponto de restauração
- Commit `1059781` (etiqueta local `backup-antes-da-expansao`): última versão antes da expansão.
  Para voltar: `git checkout backup-antes-da-expansao -- vale-da-lanterna`.
- O jogo guarda uma cópia do save antigo no navegador antes de qualquer migração
  (`vale-da-lanterna-backup-v<versão>`).

## Fase 1 — Análise

### Engine e tecnologias
Não há engine de terceiros. O jogo é **HTML5 + Canvas 2D em JavaScript puro**, sem etapa de build.
- Mundo, interface e efeitos: Canvas 2D, desenhado à mão em código (pixel art gerada).
- Personagens 3D: **three.js r128** (`lib/three.min.js`, licença MIT), renderizado num canvas WebGL
  pequeno (52×52) e copiado para o canvas 2D. Sem WebGL, volta aos sprites 2D.
- Áudio: Web Audio sintetizado (sem arquivos de som).
- Salvamento: `localStorage` (chave `vale-da-lanterna-v2`).
- Nenhum recurso gráfico é carregado de arquivo: tudo é gerado na inicialização.

### Estrutura de arquivos
| Arquivo | Conteúdo |
|---|---|
| `index.html` | página, ordem de carregamento dos scripts |
| `core.js` | tela/DPR, utilidades, armazenamento, áudio, sprites 2D (herói, Floco, NPCs, Musgos, árvores, rochas), ruído |
| `world.js` | o Vale feito à mão: regiões, trilhas, rio, mar, praças, campos, casas/torre/celeiro, decoração, props, chão em pedaços, interiores |
| `infinite.js` | mundo infinito: biomas, estradas, cidades (planta, prédios, interiores), pedaços (terreno, props, colisão), mapas |
| `char3d.js` | Kai e Floco em 3D (three.js) |
| `game.js` | estado salvo, receitas, missões, entidades, diálogos, entrada, combate, atualização, câmera, desenho, HUD, menus, título/final, laço principal |
| `lib/three.min.js` | three.js r128 |

### Como os sistemas funcionam hoje
- **Movimento:** `readMove()` junta teclado e joystick virtual (lado esquerdo da tela); `moveBody()` desliza
  pela grade de colisão de 8 px (`walkable()`), que no mundo consulta os pedaços (`worldWalk`).
- **Câmera:** vista de cima 3/4 fixa, segue o jogador (`camTarget`), escala `view.s` pela altura da tela.
- **Controles mobile:** joystick dinâmico, botão de ação contextual (atacar/falar/entrar/criar), botões
  Mochila, poção, som e minimapa (toque abre o mapa grande). Teclado no PC.
- **Inventário/moedas/missões:** objeto `S` (materiais `inv`, consumíveis `bag`, equipamento `eq`, missões `q`,
  relíquias, cidades visitadas). Menu Mochila com abas Mochila, Criar e Missões.
- **Salvamento:** `save()` grava `S` + posição; automático a cada 6 s e em eventos.
- **Mapa:** o Vale (7600×4500, 5 regiões) + mundo infinito com 7 biomas e uma cidade a cada 9000 px.
- **NPCs:** Vó Aurora, Mel, Seu Tomé, Bruno, Rosa, Téo, Rui e Lina (diálogos com missões), mercadores/
  estalajadeiros/ferreiros/moradores das cidades e moradores que andam nas ruas. Todos em sprite 2D.

### Recursos preservados
Mapa do Vale e regiões, casas e interiores, missões principal e extras, criação de itens, combate,
chefe, final, mundo infinito, cidades, minimapa, controles, interface, áudio e saves existentes.

### Sistemas a criar
NPCs 3D com animações, rotinas e navegação; relacionamentos, namoro, casamento, família e filhos;
empregos e economia (salários, estoques, horários, propriedades); agricultura e animais; construção livre;
ciclo de dia e noite e clima; novos menus; migração de saves, salvamento manual e opções gráficas.

### Riscos de compatibilidade
- **Saves antigos:** a chave `v1` (primeira versão) ficou órfã quando o formato mudou. Agora há migração
  automática: v1 → atual e preenchimento de campos novos sem apagar nada.
- **Desempenho no celular:** renderizar um modelo 3D por NPC a cada quadro é caro. Solução: cada aparência
  de NPC é "assada" uma vez numa folha de sprites (direções × quadros de animação), e o desenho por quadro
  vira um `drawImage` barato. O Kai continua renderizado ao vivo.
- **Memória:** folhas de sprites ficam num cache limitado (as menos usadas são descartadas).
- **NPCs fixos das missões:** continuam nos mesmos lugares e com os mesmos diálogos até as rotinas
  (Fase 3) serem ligadas com cuidado para não quebrar as missões.

## Plano por fases
| Fase | Conteúdo | Situação |
|---|---|---|
| 1 | Análise, arquitetura, backup, migração de saves | ✅ concluída |
| 2 | Personagens 3D e animações (Kai + todos os NPCs) | ✅ concluída |
| 3 | Mais NPCs, rotinas diárias, navegação (+ relógio e luz do dia antecipados) | ✅ concluída |
| 4 | Relacionamentos, namoro, casamento, família e filhos | ✅ concluída |
| 5 | Empregos, profissões, economia | ✅ concluída |
| 6 | Agricultura e animais | ✅ concluída |
| 7 | Construção livre e decoração | ✅ concluída |
| 8 | Dia e noite, clima | ✅ concluída |
| 9 | Interface, menus, controles | ✅ concluída |
| 10 | Salvamento completo, otimização, testes gerais | ✅ concluída |

Observação: a Fase 3 (rotinas) depende do relógio do jogo, então a parte básica do relógio da Fase 8
será antecipada no início da Fase 3.

## Fase 2 — Personagens 3D e animações
- `char3d.js`: construtor genérico de pessoas 3D por aparência (pele, cabelo e penteado, roupa, vestido,
  avental, chapéu, barba, tamanho de criança/idoso) e ferramentas na mão (martelo, enxada, vara de pesca).
- Animações: parado, caminhada, corrida, conversa, trabalho, plantio/colheita, pesca e descanso (sentado).
- NPCs usam folhas de sprites assadas aos poucos (até 8 quadros por frame de jogo), com 4 ou 8 direções
  conforme a qualidade gráfica; enquanto a folha não fica pronta, o sprite 2D antigo aparece.
- Kai: caminhada e corrida (joystick todo para o lado, ou Shift), conversa durante diálogos.
- Aparências feitas para os NPCs das missões; moradores das cidades ganham aparência aleatória com semente.
- Opções gráficas Baixo/Médio/Alto/Ultra e salvamento manual na nova aba "Ajustes" da Mochila.

## Fase 3 — Moradores, rotinas e navegação
- **Relógio** (`life.js`): dia de 60 min reais por padrão (30 min, 1 h ou 2 h em Ajustes), dias da semana,
  períodos (madrugada, manhã, tarde, pôr do sol, noite), relógio no topo da tela. O relógio para com menus abertos.
- **Luz do dia** antecipada da Fase 8: a cena muda de cor ao longo do dia; à noite postes, fogueira e fornos acendem.
  Interiores ficam menos escuros. (Janelas acesas, sombras e clima ficam para a Fase 8.)
- **Dormir**: camas de casa e da estalagem fazem dormir até as 6h quando é noite (20h–5h); de dia, só descansa.
- **12 moradores com perfil** (nome, idade, personalidade, profissão, casa, gostos e rotina):
  Vó Aurora, Mel, Seu Tomé, Bruno, Rosa, Téo, e os novos Iara (pescadora), Davi (carpinteiro), Nina (costureira),
  Léo (guarda), Bia (cozinheira, mora com o Léo) e Joca (lenhador, mora com o Seu Tomé).
- **7 casas novas com interior** no Vale: casas do Bruno, Rosa, Iara, Davi, Nina, Léo e Bia, e a cabana do Seu Tomé
  (3 delas são construções novas; o resto eram casas decorativas que ganharam porta).
- **Rotinas**: acordar, sair de casa, ir ao trabalho, almoçar (em casa ou na padaria), trabalhar, passear na praça,
  voltar e dormir na própria cama. Animações conforme a atividade (pesca, plantio, martelo, ronda, sentar, dormir).
  Moradores das cidades se recolhem à noite.
- **Navegação**: rede de caminhos sobre as trilhas e praças do Vale (84 pontos) com rotas pelo menor caminho;
  todos os trajetos de rotina foram verificados contra a colisão (nenhum atravessa parede, casa ou água).
  NPCs entram e saem pelas portas das casas.
- **Simulação simplificada**: moradores longe do jogador ou em outra área pulam direto para o destino;
  os que estão perto andam de verdade pelo caminho.
- **Diálogos por contexto**: frases por profissão, lugar, horário, dia da semana, progresso da história e
  personalidade (saudação e despedida próprias), apresentação no primeiro encontro, e memória das últimas
  frases para não repetir. As missões continuam com prioridade nas falas dos NPCs de missão.
- O alvo das missões no mapa acompanha o morador (ou a porta da casa onde ele está).

## Fase 4 — Relacionamentos, casamento e família (`social.js`)
- **Calendário**: mês de 28 dias, 4 estações (Primavera, Verão, Outono, Inverno); o relógio mostra a data.
- **Datas comemorativas**: Festival das Flores (14 Prim.), Festa do Verão (21 Ver.), Festa da Lanterna (20 Out.),
  Noite das Estrelas (25 Inv.). Nesses dias todos vão para a praça das 17h às 22h; presentes valem 50% a mais.
- **Aniversários** de todos os moradores (presente vale o triplo).
- **Amizade** de 0 a 10 corações: conversar uma vez por dia, presentes (cada um tem gostos e coisas que não gosta;
  os gostos descobertos aparecem na aba Pessoas) e passeios.
- **Ao falar com um morador** abre um menu: Conversar (nos NPCs das missões, cai na conversa da missão), Presente,
  Passear (a partir de 3 corações; a pessoa pode recusar se estiver trabalhando) e opções românticas quando cabem.
- **Passeio**: o morador acompanha o Kai por 2 horas do jogo, ganhando amizade; termina com uma fala.
- **Namoro**: só adultos solteiros e elegíveis (Mel, Iara, Nina, Rosa, Davi, Joca, Bruno). Léo e Bia são casados,
  Vó Aurora, Seu Tomé e Téo recusam com respeito. Precisa de 7 corações (8 para tímidos) e um **Buquê de Flores**.
  Abaixo disso, a pessoa recusa com gentileza.
- **Primeiro encontro**: o primeiro passeio namorando vira evento especial.
- **Noivado**: namorando há 3 dias, 9 corações e um **Anel de Cristal** (bancada); o casamento fica marcado para 3 dias depois.
- **Casamento**: cerimônia na praça com os moradores reunidos, Vó Aurora celebrando, chuva de flores.
  Depois, o cônjuge **muda para a Casa do Kai** (casa nova a oeste da praça) e mantém o trabalho.
- **Discussões**: se o Kai some por mais de 2 dias ou esquece o aniversário do par, ele fica chateado.
  "Pedir desculpas" funciona com amizade alta ou com um presente no mesmo dia. Namoro com 4 dias de mágoa termina.
- **Filhos**: casados há 3 dias e com 9 corações, "Aumentar a família?" → o bebê chega em 4 dias (até 2 filhos).
  Nome escolhido pelo jogador; aparência misturando o Kai e o cônjuge; personalidade própria.
  Crescimento: bebê (0–4 dias, no berço), criança pequena (5–13 dias, em casa), criança (14+ dias, brinca na praça).
  Necessidades de fome e carinho (caem mais devagar com o cônjuge em casa); ações Ninar/Brincar, Alimentar
  (sopa ou torta) e Abraçar. Festa de aniversário a cada 28 dias, em casa a partir das 16h.
- **Memória**: cada morador guarda os últimos acontecimentos importantes (aparece na aba Pessoas).
- **Itens novos**: Sopa de Cogumelo (2 cogumelos, também no fogão de casa), Buquê de Flores (5 flores + 1 fibra),
  Anel de Cristal (bancada: 2 cristais + 3 pedras).
- **Abas novas na Mochila**: Pessoas (corações, situação, aniversário, gostos, última lembrança) e Família
  (par, filhos com barras de necessidades, bebê a caminho e próximos eventos de 2 semanas).
- Pendente para a Fase 7: construir/decorar quarto infantil e comprar móveis (a Casa do Kai já tem 2 berços).

## Fase 5 — Empregos e economia (`economy.js`)
- **Armazém do Vale** (construção nova na Horta) com o comerciante **Gil**, 13º morador (mora nos fundos).
- **Lojas com horário e estoque**: Armazém (8h–18h), Padaria (6h–15h), Oficina (7h–19h), Ateliê da Nina na barraca
  da praça (8h–17h, roupas) e o mercado de cada cidade (7h–19h). Lojas só abrem com o dono presente; as portas do
  Armazém, da Padaria e dos mercados ficam trancadas fora do horário. O estoque renova todo dia.
- **Preços** variam ±15% por dia e por item; cada loja compra uma lista própria de itens. O que você vende entra no
  estoque da loja. As cidades pagam/cobram 10% a mais.
- **6 empregos** com chefe, horário, local e salário: agricultor (Seu Tomé), ferreiro (Bruno), pescador (Iara),
  comerciante (Gil), carpinteiro (Davi) e cozinheiro (Bia). Contratação conversando com o chefe ("Emprego");
  um emprego por vez, com opção de pedir demissão.
- **Trabalho interativo**: forja e serraria (acertar a marca no verde, 3 golpes por rodada), balcão do armazém
  (escolher o pacote certo antes do tempo acabar), cozinha (memorizar e montar a receita), horta (andar até 6
  canteiros marcados e regar/plantar/colher/adubar) e pesca (entregar 4 peixes à Iara). Cada rodada avança o relógio.
- **Experiência e promoção**: Aprendiz → Ajudante → Profissional → Especialista → Mestre(a); cada nível +25% de salário.
  A carpintaria também rende tábuas (material para a Fase 7).
- **Pesca** em qualquer água com a Vara de Pesca: lançar, esperar a mordida e puxar no tempo certo.
  Peixe, truta, carpa dourada (mais comum no deserto e no pântano) e, às vezes, uma bota velha.
- **Roupas**: 6 conjuntos que mudam o cachecol e a túnica do Kai em 3D (Ateliê da Nina).
- **Propriedades**: 3 terrenos à venda no Vale (placa e contorno no chão; construção na Fase 7) e casas à venda
  nas cidades (placa "À venda"); a casa comprada tem cama para dormir.
- **Itens novos**: pão, peixe, truta, carpa dourada, bota velha, tábua e vara de pesca.
- **Aba Trabalho** na Mochila: emprego atual, experiência, turno do dia, lista de empregos, propriedades, roupas,
  ferramentas e total ganho/gasto. Lojas abrem numa tela com Comprar, Vender, Ferramentas e Roupas.
- Ajuste: o Bruno trabalha ao lado da bigorna; postos de trabalho têm prioridade sobre "Falar".

## Fase 6 — Agricultura e animais (`farm.js`)
- **Quintal do Kai**: terreno pequeno grátis ao lado da Casa do Kai (10 canteiros). Os terrenos comprados também
  viram horta ou pasto (troca na placa do terreno).
- **Ferramentas**: Enxada e Regador (Armazém). **Sementes** da estação no Armazém e no Sítio do Seu Tomé.
- **Ciclo**: arar (enxada) → plantar a semente escolhida na barra da fazenda → regar (regador) → adubar (opcional) →
  crescer em 4 estágios visíveis → colher. Solo molhado fica mais escuro.
- **7 culturas**: couve, cenoura, morango (rebrota), tomate (rebrota), trigo, abóbora e nabo, cada uma com dias de
  crescimento, necessidade de água (todo dia ou a cada 2 dias), estações certas, preço de venda e de semente.
  Sem água além do limite, ou fora da estação, a planta seca (botão "Limpar"). Adubo acelera e rende o dobro.
- **Chuva**: `weatherRainToday()` já é consultado na virada do dia; quando o clima da Fase 8 chegar, a chuva rega sozinha.
- **Animais** (modelos 3D próprios, também filhotes): galinha (ovo), vaca (leite), ovelha (lã a cada 3 dias) e
  porco (trufa, 60% dos dias). Comprados no **Sítio do Seu Tomé**; vivem num terreno-pasto cercado (máx. 6 por
  terreno, 12 no total, para não pesar no celular). Andam pelo pasto, dormem à noite.
- **Cuidados**: Alimentar (ração, uma vez por dia) e Carinho aumentam a afeição; produto só sai se comeu no dia
  anterior; afeição alta rende produto em dobro. Sem comida a afeição cai.
- **Filhotes**: dois adultos da mesma espécie, alimentados 3 dias seguidos e com afeição alta, geram um filhote
  (no máx. a cada 7 dias); o filhote vira adulto em 5 dias.
- **Itens e receitas novas**: ração (2 fibras ou 1 trigo → 2), adubo (1 seiva + 2 fibras → 2), omelete (2 ovos);
  colheitas e produtos são vendidos no Armazém, no Sítio, na Padaria (trigo, ovo, leite, morango) e nas cidades.
- **Aba Fazenda**: estado de cada terreno, animais (fome, afeição, produto pronto), ferramentas e guia de plantio
  com as estações (o que não cresce agora fica apagado).
- Ajustes: a loja mostra todo o estoque (inclui o que você vendeu); abas do menu cabem com o botão fechar.

## Fase 7 — Construção livre e decoração (`build.js`)
- **Botão Construir** aparece dentro de um terreno seu ou de um interior seu (Casa do Kai, casas compradas e
  construídas). Painel próprio com categorias, itens com custo, e ações Girar, Grade (encaixe liga/desliga),
  Mover, Remover, ✓ Colocar e ✕ Sair. O "fantasma" fica verde quando pode e vermelho com o motivo quando não pode.
- **Catálogo modular** (`BUILD_CATALOG`): novos objetos entram com uma linha (custo, tamanho, desenho).
  - Construções: **Casa** personalizável (parede reboco/madeira/pedra/adobe, cor do telhado, tamanho P/M/G — janelas
    e porta acompanham —, chaminé), **Loja do Kai** e **Galpão**. Todas têm interior e porta.
  - Cercas e caminhos: cerca e portão (girar: horizontal/vertical), caminho de pedra, estrada de terra, piso de tábuas.
  - Decoração: poste de luz (acende à noite), banco, canteiro, árvore, arbusto, barril, caixote, feno, espantalho,
    placa e **irrigador** (rega os canteiros num raio de 3 blocos toda manhã).
  - Móveis: cama, mesa, sofá, estante, janela, quadro, lareira (parede), tapete, planta, luminária (acende à noite),
    **baú** (todos os baús são ligados), **guarda-roupa** (troca de roupa), fogão, bancada.
  - **Quarto infantil**: berço, cama infantil (os filhos usam), caixa de brinquedos (crianças sentem menos falta de
    carinho) e tapete colorido.
- **Regras**: só dentro de terrenos seus (o quintal é pequeno demais para construções), sem sobrepor outra
  construção, plantação, placa ou obstáculo; móveis não bloqueiam a porta e os de parede vão na parede do fundo.
  Custos em moedas e materiais (tábuas da carpintaria ou 2 madeiras → 1 tábua). Remover devolve os materiais.
- **Loja do Kai**: coloque produtos na vitrine; das 8h às 18h chegam clientes a cada hora (mais variedade e
  decoração = mais clientes), pagando 130% do valor do dia; recolha o caixa no balcão.
- **Salvo para sempre**: `S.builds` (mundo) e `S.decor` (interiores); colisão aplicada ao mundo e à rede de caminhos
  dos moradores (recalculada a cada construção grande).
- Câmera sobe um pouco no modo construção para o painel não tapar o que você está colocando.

## Fase 8 — Dia, noite e clima (`weather.js`)
- **Ciclo do dia** (já existente, mantido): dia de 1 hora real por padrão, ajustável em Ajustes (30 min, 1 h, 2 h);
  dormir na cama à noite pula para as 6h; lojas abrem e fecham nos seus horários.
- **Previsão por dia**, sorteada a partir de uma semente guardada no save (`S.weather.seed`), então o tempo de cada dia
  é sempre o mesmo para aquele jogo. Chances por estação: primavera e outono mais chuvosos, verão com tempestades,
  outono com neblina, inverno com neve. Feriados sempre com céu limpo. Previsão aparece ao amanhecer e em Ajustes
  (hoje e amanhã); o nome e o ícone do tempo ficam no relógio do topo.
- **Tipos**: céu limpo, nublado, chuva, tempestade (raios com clarão e trovão atrasado), neblina pela manhã e neve.
  Deserto não tem chuva; nas montanhas geladas a chuva vira neve.
- **Efeitos**: nuvens escurecem a cena, postes e janelas acendem em dias escuros; gotas inclinadas pelo vento,
  respingos, **poças** que enchem na chuva e secam aos poucos (com ondinhas e respingos ao andar nelas),
  neblina em camadas que se movem, neve caindo.
- **Som**: chuva contínua (abafada dentro de casa) e trovões gerados na hora (sem arquivos de áudio).
- **Moradores se abrigam**: na chuva quem estava ao ar livre vai para casa (ou para a padaria conversar);
  andam correndo enquanto chove; o guarda Léo faz a ronda na chuva, mas não na tempestade. Moradores das cidades
  somem das ruas na chuva. Falas novas sobre o tempo.
- **Chuva rega as plantações** (canteiros ficam molhados no momento em que a chuva engrossa; chuva de madrugada
  já conta na virada do dia).
- **Janelas acesas** à noite em todas as casas (do vale, das cidades e as construídas), cada casa apagando a luz
  num horário diferente (entre 21h30 e 23h30).
- Saves antigos recebem o clima automaticamente (`deepDefaults`).

## Fase 9 — Interface, menus e controles (`menus.js`)
- **Menu com barra lateral**: 11 abas sempre visíveis à esquerda (cabe num celular deitado, testado em 667×375,
  844×390 e 1280×720): Mochila, Criar, Missões, Pessoas (relacionamentos), Família, Trabalho, Fazenda (agricultura
  e animais), **Construção**, **Propriedades**, **Calendário** e Ajustes. Cabeçalho com o nome da aba, moedas e hora.
- **Bolinha vermelha** nas abas que pedem atenção: filho com fome ou carente / par chateado (Família), colheita
  ou produto de animal pronto (Fazenda), turno aberto (Trabalho), dinheiro no caixa da loja (Propriedades).
- O botão Mochila e a tecla I **reabrem a última aba usada**.
- **Calendário e clima**: grade da estação (4 semanas), dia de hoje destacado, previsão com ícone para hoje e os
  próximos 2 dias, marcadores de festas, aniversários, casamento e bebê; toque num dia para ver detalhes
  (eventos, previsão e o que plantar na estação); ◀ ▶ mudam de estação.
- **Propriedades**: terrenos (preço, uso horta/pasto/quintal, construções em cada um), casas (Casa do Kai, casas
  compradas e construídas), Loja do Kai (vitrine e botão Recolher caixa), baús, roupas (trocar), ferramentas, finanças.
- **Construção**: catálogo completo por categoria com custos (amarelo = você tem os materiais), explicação e botão
  "Construir aqui" (ativo só num terreno ou casa sua).
- **Trabalho**: cartão do emprego atual com o que fazer e dicas; lista de todos os empregos com salário, horário,
  chefe e local.
- **Ajustes**: dia de 20 min, 30 min, 1 h ou 2 h; **modo canhoto** (botão de ação, Mochila e Construir à esquerda;
  joystick do lado direito); lista de atalhos de teclado; layout se adapta a telas estreitas.

## Fase 10 — Salvamento, otimização e testes (`system.js`)
- **Salvamento automático** a cada 6 s e também quando o app vai para segundo plano ou é fechado (`pagehide`,
  `visibilitychange` — antes só salvava se o som tivesse sido iniciado).
- **Cópia diária** (`vale-da-lanterna-diario`) no início de cada dia. Se o save principal estiver danificado, o jogo
  guarda o texto danificado à parte e **recupera a cópia do dia**, avisando o jogador.
- **Armazenamento cheio/bloqueado**: o jogo não trava e avisa uma vez.
- **3 espaços de salvamento manual** (Ajustes → Salvamentos): salvar, carregar e apagar, com dia, data, hora,
  lugar e moedas; ações que substituem um jogo pedem dois toques; **Desfazer carregamento** volta ao jogo de antes.
- **Migração** (já existente, mantida): v1 → v2/v3 com cópia `vale-da-lanterna-backup-v<n>`; campos novos chegam por
  `deepDefaults` sem apagar nada.
- **Desempenho**: medição de FPS e tempo de trabalho por quadro; **Mostrar FPS** opcional; **auto-ajuste** de qualidade
  (abaixo de 38 fps por 5 s seguidos baixa um nível e avisa; pode ser desligado).
- **LOD dos NPCs**: só os mais próximos usam o boneco 3D (Médio 10 até 900 px, Alto 18 até 1400 px, Ultra 40 até
  2600 px; Baixo tudo em 2D); os outros usam o desenho 2D. **Limite de partículas** por qualidade.
- **Testes gerais** (Playwright, Chromium): espaços de salvamento e desfazer; save corrompido → recuperado;
  armazenamento cheio; auto-ajuste; limite de partículas; cidade com 28 NPCs nas 4 qualidades (60 fps estável depois
  de preparar os bonecos); **60 dias simulados** com casamento, filho, animais, canteiros, clima e interiores sem
  nenhum erro, save de 3 KB, recarregado intacto; regressões das fases anteriores.

## Expansão: Futebol de várzea (`football.js`)
**Análise antes de programar:** engine própria em Canvas 2D (scripts globais, sem build), câmera top-down que segue o Kai,
joystick virtual + botão de ação, moradores com rotina por horário (`currentEntry` → `placeFor` → rede de caminhos),
amizade 0–1000 (`social.js`), clima determinístico por dia (`weather.js`), calendário e abas (`menus.js`), save `S` com
`deepDefaults`. O futebol entrou como módulo independente, ligado por ganchos pequenos nesses sistemas.

- **Campo** na Clareira dos Cogumelos, a oeste da Vila do Rio (x 420–1340, y 930–1490): grama listrada com terra batida
  irregular (mais gasta perto das traves e do meio), linhas de cal falhadas, círculo central, áreas, marcas de pênalti,
  duas traves com rede (desenhadas em duas partes para ordenar com quem está dentro do gol), 5 bancos para a torcida,
  4 postes (acendem à noite), placa "Campo da Várzea" e trilha até a vila. Só foram retiradas árvores/pedras de dentro da
  clareira; os 41 cogumelos de lá foram **realocados** para a mata em volta (o mapa continua com 121; missão da Rosa igual).
- **Sexta-feira** (horário configurável na aba Futebol: jogo às 14h/15h/16h/17h; organização = jogo − 6h, convites − 5h,
  conversas + 1h): o Joca organiza e monta dois times equilibrados (goleiros Rosa e Seu Tomé); às 10h o morador mais amigo
  do Kai entre os jogadores manda o **convite** (Aceitar / "Hoje não dá", sem penalidade); jogadores vão ao campo 1h antes,
  a torcida meia hora antes; depois do jogo ficam conversando. Aparece no **calendário** (marcador verde) e na aba Futebol.
  Se o Kai aceitou e não aparece, o pessoal espera meia hora e joga sem ele. Em dia de festa o jogo é mais cedo.
- **Amistosos:** opção "Amistoso" na conversa com amigos (≥ 3 corações) marca para o dia seguinte às 17h; amigos também
  convidam sozinhos (20% ao dia), nunca em sexta ou feriado.
- **Partida 5 × 5 jogável:** joystick original; botões **Chute** (o botão de ação; sem bola vira **Desarme**), **Passe**
  (sem bola vira **Pedir**) e **Correr** (liga/desliga; Shift no teclado; F = passe). Fôlego, placar, cronômetro (40'
  de jogo em 3, 4 ou 6 minutos reais), indicador de posse, "Sair do jogo" (dois toques, sem penalidade). O relógio do dia
  para enquanto o Kai joga e vai para o horário das conversas no fim.
- **Física da bola:** rolar com atrito (menor com campo molhado), altura com gravidade e quique, traves e travessão com
  ricochete, rede segurando a bola, gol só entre as traves e abaixo do travessão, lateral, escanteio e tiro de meta.
- **IA:** goleiro se posiciona entre a bola e o gol, prevê o chute, defende/espalma/sai do gol e repõe; os outros procuram a
  bola, pressionam (os 2 mais próximos), dão bote, passam escolhendo o companheiro mais livre e mais à frente, conduzem
  desviando do marcador, chutam quando têm ângulo e se posicionam pela formação (2 zagueiros, meia, atacante) que anda com a bola.
- **Atributos** (velocidade, chute, controle, fôlego, passe, defesa) por morador: Joca e Iara habilidosos, Léo zagueiro,
  Gil veterano, Davi e Nina iniciantes etc. O Kai melhora com a experiência (+1 em tudo a cada 4 pontos, até +3).
- **Torcida:** quem não joga senta nos bancos, conversa, pula e grita no gol, reage a defesas e bolas na trave, torce pelo
  Kai se for amigo; apito, chute, trave e torcida com sons gerados na hora.
- **Social:** +12 de amizade com os companheiros (mais na vitória e por gol do Kai), +5 com os adversários, +3 por passe
  certo (até 5 por jogador), +8 para quem fez gol com assistência do Kai, torcida amiga +3 quando o Kai marca;
  desarmes repetidos entre o Kai e alguém viram **rivalidade**; lembranças e falas sobre o último jogo.
- **Clima:** tempestade ou chuva forte no horário cancelam (moradores seguem a rotina e se abrigam); chuva fraca deixa o
  campo molhado (bola desliza mais, menos controle, goleiro escorrega).
- **Recompensas** (opcionais): moedas (40 vitória, 20 empate, 10 derrota, +15 por gol, +8 por assistência),
  popularidade com títulos (Novato, Boleiro, Craque da vila, Lenda da várzea), experiência e 8 conquistas.
- **Salvo em `S.football`:** configuração, eventos futuros e status, histórico das últimas 30 partidas (times, placar,
  gols com minuto e assistência, números do Kai), estatísticas, relações (jogos juntos, contra, desarmes, rivalidade),
  popularidade, experiência, conquistas e artilharia dos moradores.
- **Testes:** caminho vila → campo livre; convite de sexta e calendário; ida ao campo; partida começa às 15h com 10
  jogadores e relógio parado; chute vira gol; passe aumenta amizade; IA ao vivo (passes, desarmes, defesas, placar
  plausível, bola nunca presa); fim com recompensas, conquistas e falas; save/recarregar; tempestade cancela; chuva fraca
  molha o campo; recusa + longe → resultado calculado; amistoso pela conversa e convites aleatórios; desarme do Kai;
  desistência sem penalidade; toque real nos botões; Android emulado (Pixel 5, CPU 4× mais lenta): a partida custa cerca
  de +4–6 ms por quadro em relação à mesma cena sem futebol (+0,7 ms com CPU normal).

## Vila maior, crianças e adolescentes, namoro melhorado (`village.js`, `romance.js`)
- **4 construções novas**, colocadas depois da geração do mapa (o resto do mundo não muda; só árvores/pedras do terreno
  delas e dos caminhos saem): **Escola do Vale** (entre a vila e a praça, carteiras e quadro-negro), **Casa da Dona Cida**
  (ao norte da escola), **Casa do Seu Zeca** (noroeste da vila) e **Casa da Marta** (sudoeste). Cada uma com interior,
  janelas acesas à noite e trilha de terra até a trilha mais próxima (pontos novos na rede de caminhos dos moradores).
- **10 moradores novos:** adultos Dona Cida (professora), Seu Zeca (barqueiro) e Marta (curandeira); adolescentes
  Pedro (16), Duda (14) e Rafa (15); crianças Lia (8), Bento (7), Malu (10) e Nico (6). Bonecos 3D em tamanho de criança/
  adolescente, aparência própria, aniversários, presentes favoritos e falas.
- **Rotina:** de segunda a sexta, aula das 8h às 12h (professora no quadro, alunos nas carteiras); à tarde crianças
  brincam, Pedro treina no campo, Duda pesca com o pai, Rafa ajuda na serraria. **Fim de semana** com rotina própria
  (`schedFor`). Chuva manda todos para casa. Adolescentes entram no futebol de sexta; crianças torcem.
- **Namoro:** pontos de **romance** (0–100) separados da amizade (conversas, presentes favoritos, passeios, encontros);
  **Encontro** a partir de 4♥ em 4 lugares/horários (piquenique no rio, bola no campo, pôr do sol na praça, estrelas no
  campo) com uma cena e três respostas: a que combina com a personalidade rende mais; cada pessoa **valoriza algo**
  (Mel: presentes favoritos; Bruno: ter emprego; Rosa: 2 encontros; Iara: explorar; Davi: 10 dias de conversa; Nina:
  encontro sob as estrelas; Joca: jogar bola junto). **Pedir em namoro** mostra a lista do que falta e a dica; com tudo
  pronto e o buquê, a pessoa aceita; sem tudo, ela explica com carinho e pede 2 dias para pensar. Quem gosta muito do Kai
  pode **se declarar** primeiro (aceitar ou ficar só na amizade, sem briga). Dá para **terminar** o namoro/noivado.
  Crianças e adolescentes **nunca** têm opção de romance (`canRomance` exige adulto elegível); adultos casados/não
  interessados respondem com respeito.
- **Testes:** portas acessíveis e rotas de todos os moradores novos sem bloqueio; escola cheia na segunda às 9h;
  fim de semana; nenhuma opção romântica para os 7 menores (com 9,5♥ e romance 100); pedido com lista, "não" respeitoso,
  encontro com cena e resposta certa (+18 romance), aceite, término, declaração da Iara, save/recarregar; fluxo antigo de
  noivado, casamento e filhos; regressões de todas as fases e do futebol.

## Ano real e festas (`social.js` calendário, `festas.js`)
- **Calendário igual ao da vida real:** 12 meses com os tamanhos reais, anos bissextos (29/02/2028 existe; 2027 não),
  dias da semana reais e anos de verdade. O jogo começa na terça, 22 de setembro de 2026 (início da primavera no Brasil);
  estações do hemisfério sul (primavera 22/09–20/12, verão 21/12–19/03, outono 20/03–20/06, inverno 21/06–21/09) — as
  plantações e o clima continuam por estação. Relógio: "22 set 2026 · Ter · 07:00". Calendário mês a mês com ◀ ▶.
- **Saves antigos** (versão 3, estações de 28 dias) migram para a versão 4 sem mudar a contagem de dias (idade dos filhos,
  namoro e plantações continuam certos): a data nova fica na mesma estação e no mesmo ponto dela (ex.: dia 30 antigo,
  "2 de Verão" → 24 de dezembro). Cópia de segurança antes da migração. Partidas de sexta ainda não organizadas são refeitas.
- **Festas da vila** na praça (todos os moradores vão, bandeirinhas, lanternas acesas à noite; dia sempre com céu limpo):
  Ano Novo (1/1), Festa do Verão (20/1), Festa da Lanterna (20/4), **Festa Junina** (24/6, fogueira e quadrilha), Noite das
  Estrelas (12/8, estrelas cadentes), Festival das Flores (10/10), **Aniversário do Vale** (15/11, fogos), **Natal** (25/12,
  árvore iluminada; amigos com 4♥ dão um presentinho) e **Réveillon** (31/12 das 21h, contagem regressiva às 23h58 e fogos à
  meia-noite). Na festa dá para **Dançar** (ou **Quadrilha**) com cada adulto (+amizade, +romance) e pegar a **Prenda da festa**
  com a Vó Aurora (uma por festa por ano).
- **Ano Novo:** faixa "Feliz Ano Novo! 2027", fogos por um minuto e **retrospectiva** do ano (dias, moedas ganhas, melhores
  amigos, par, futebol); quem está na praça ganha amizade.
- **Aniversário dos moradores:** festa na casa de quem faz anos, das 18h às 21h, com quem mora junto e até 4 amigos da mesma
  faixa de idade; aviso de manhã e no calendário; quando o Kai chega: todos cantam "Parabéns pra você" (com a melodia), bolo
  com velas na mesa, confete, +30 de amizade e um pedaço de torta. Em dia de festa da vila o aniversário é comemorado na praça.
- **Aniversário do Kai:** escolhido no Calendário ("Este é meu aniversário"; padrão 15 de março, 20 anos). No dia: faixa de
  parabéns, a idade aumenta, e às 19h os melhores amigos fazem uma **festa surpresa** na Casa do Kai com presentes e moedas.
- **Festa de cada cidade grande:** cada cidade tem sua data; nas cidades visitadas ela aparece no calendário; no dia, a praça
  da cidade ganha bandeirinhas e fogos à noite.
- **Testes:** datas e dias da semana reais; bissexto; migração de save antigo; festa da Mel com convidados e "Parabéns";
  surpresa do Kai com presentes; Natal (prenda, presente de amigo, 23 moradores na praça); Réveillon (contagem, virada para
  2027, fogos, retrospectiva); quadrilha na Festa Junina; festa de cidade; calendário; regressões de todas as fases.
