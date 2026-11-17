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
| 10 | Salvamento completo, otimização, testes gerais | ⏳ próxima |

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
