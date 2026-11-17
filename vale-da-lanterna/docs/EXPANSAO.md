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
| 4 | Relacionamentos, namoro, casamento, família | ⏳ próxima |
| 5 | Empregos, profissões, economia | ⏳ |
| 6 | Agricultura e animais | ⏳ |
| 7 | Construção livre e decoração | ⏳ |
| 8 | Dia e noite, clima | ⏳ |
| 9 | Interface, menus, controles | ⏳ |
| 10 | Salvamento completo, otimização, testes gerais | ⏳ |

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
