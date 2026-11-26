# ANIME LIFE — MINHA VIDA

Visual novel anime, conduzida só por cenas, diálogos e escolhas.
Feita com **Phaser 3 + JavaScript modular + Vite**, empacotável como app Android com **Capacitor**.

> A versão anterior (exploração livre com joystick e mapa) foi removida a pedido. O código dela continua no histórico do git.

## Novidade da v0.6.0 beta: capítulos, vozes e expressões
- **3.000 capítulos planejados** (30 volumes × 100), no painel **📚 Capítulos** (menu principal e pausa):
  - volumes, progresso, sinopse, desbloqueio e revisão de capítulos concluídos;
  - status real de cada capítulo: **3 escritos e jogáveis, 27 roteirizados, 2.970 planejados**;
  - detalhes e lotes em [ROTEIRO_3000.md](ROTEIRO_3000.md).
- **Capítulo 2 completo** (5 cenas) e **Capítulo 3 — O Bilhete que Kyo Guardou** (4 cenas). Novas conversas no celular, e o mistério de Sora Kirishima.
- **Novas expressões**, animadas na própria ilustração:
  - sorrindo, rindo (balanço e boca no ritmo), muito triste, chorando (lágrimas desenhadas saindo dos olhos do rig);
  - com medo (tremor), irritado, ciúmes, nervoso, confuso;
  - o roteiro aceita nomes em português (`e: 'bravo'`, `'irritado'`, `'chorando'`…).
- **Objetos em cena** (`{ prop: 'carta' }`), desenhados por código: carta, bilhete, álbum, foto, cartão, cachecol, passagem, caixa, chave, celular, caneca, cartão-postal.
  - Aparecem em plano de detalhe ou na mão de um personagem (`by`).
- **Braços e gestos (sistema pronto, arte pendente):**
  - o jogo escolhe a pose pela fala e pela emoção: acenar, apontar, explicar, braços cruzados, mãos na cintura, mão no rosto ou na boca, segurar objeto, discussão, romântico;
  - a troca usa uma transição suave;
  - **sem arte desenhada da pose, a ilustração não muda**, porque os braços não são deformados por código. Veja o pedido de arte em [ANIMACAO_2D.md](ANIMACAO_2D.md).
- **Vozes:** **voz sintetizada pelo aparelho**, sempre indicada na tela como "🔊 voz sintetizada". Não é dublagem.
  - Cada personagem tem um perfil próprio (tom e ritmo) e a entonação muda conforme a emoção.
  - Há pausas nas reticências e no fim das frases.
  - A legenda aparece no ritmo da fala, a boca acompanha cada trecho falado e o botão 🔁 repete a fala.
  - Nos Ajustes: ligar/desligar, volume, e escolha e teste da voz de cada personagem.
  - Funciona no navegador (Web Speech API) e no Android (plugin `@capacitor-community/text-to-speech`).
  - Gravações reais podem ser adicionadas em `public/assets/voices/` e substituem a voz sintetizada, marcadas como "🎙 voz gravada". Hoje não há nenhuma gravação.

## Novidade da v0.5.0 beta: cenas cinematográficas e relacionamentos adultos
- **Narração vira cena** (`src/cinematic/SceneDirector.js`). O diretor de cena lê o roteiro e mostra o que o texto descreve, sem inventar nada:
  - "alguém bate na porta" → batidas;
  - "o celular vibra" → vibração;
  - "as lâmpadas acendem uma por uma" → lâmpadas acendendo;
  - "ela estende a caixa" → a personagem se aproxima;
  - narração sem personagens → panorâmica lenta com faixas de cinema, e o texto entra depois de uma pausa.
- **Cenários vivos** (`src/scenes/AmbientFX.js`), desenhados sobre a pintura original, sem substituí-la:
  - janelas dos prédios piscando e faróis passando no teto à noite;
  - poeira na luz da janela durante o dia;
  - vapor do café;
  - estrelas e lâmpadas do terraço.
- **Som ambiente** sintetizado em cada cenário: cidade, café, vento, grilos.
- **Relacionamentos adultos:** só com personagens de 18 anos ou mais, marcados como elegíveis.
  - Etapas: interesse → encontro → namoro.
  - **Consentimento:** o personagem aceita ou recusa convites conforme o conforto (relação + humor), e a recusa nunca é punida.
  - Nos momentos íntimos, o personagem diz claramente que quer, e o jogador sempre pode desacelerar ou recusar.
- **Rota da Rin**, com dois eventos especiais em `src/story/events/`:
  - **"Terraço, só nós dois":** aproximar, segurar a mão, respeitar o espaço, abraçar e beijar, com o corte de câmera para o céu.
  - **"Fica comigo":** a primeira noite. O momento íntimo é uma transição discreta para a tela preta, sem nada explícito, e a história continua na manhã seguinte, com consequências: o Kaito desconfia e aparece um post no Hoshigram.
  - Os convites saem do celular: você convida pelo perfil, ou ela convida, com Aceitar/Recusar.
  - Depois do evento, o jogo volta exatamente ao ponto da história principal.

## Novidade da v0.4.0 beta: celular com IA
- **Smartphone** com Mensagens, Contatos, Perfis, Histórico, Notificações e Hoshigram, com transições entre os apps.
- **Chat livre:** você digita o que quiser e cada personagem responde com a própria personalidade.
  - O personagem considera a conversa, a relação, o humor, as memórias e o que ele sabe da história.
  - A tela mostra fotos, status online/offline, horário, ✓✓ de lida, "digitando…" e reenvio quando a mensagem falha.
- **Memória persistente:** gostos, promessas e momentos marcantes ficam salvos. As conversas antigas viram um resumo, para controlar o custo.
- **Relacionamento:** amizade, confiança, carinho, afinidade, interesse romântico e humor. Decisões graves da história pesam: por exemplo, trair o segredo da Mei limita a recuperação da confiança dela.
- **Mensagens espontâneas:** bom dia, "você sumiu", saudade, convites. Têm notificação e frequência ajustável.
- **IA por servidor seguro** (pasta `server/`): a chave nunca fica no app.
  - O servidor controla o custo (limites por aparelho, por IP e diário, mais um orçamento de tokens) e trata falhas.
  - Sem servidor configurado, o jogo usa o **modo local**, com respostas simples e avisado na tela. Ele **não** tem a inteligência de uma IA real.
- **APK beta:** compilado pelo GitHub Actions (`.github/workflows/anime-life-apk.yml`).

## Novidade da v0.3.0: personagens animados em 2D
Os personagens continuam sendo as ilustrações originais, agora com vida:
- piscar, boca acompanhando a fala, cabeça, respiração e cabelo;
- pequenos movimentos de corpo e entrada e saída animadas;
- expressões que seguem as falas: neutro, feliz, triste, envergonhado, surpreso, irritado e apaixonado, entre outras.

A câmera também ficou cinematográfica: zoom suave, close-up nos momentos importantes, plano por cima do ombro e movimento lateral.
Detalhes, limites e a lista de imagens que deixariam a animação perfeita estão em [ANIMACAO_2D.md](ANIMACAO_2D.md).

## O que tem nesta versão (v0.2.0)

- **Menu principal:** Continuar, Novo jogo, Carregar, Galeria, Ajustes e Créditos, com música ambiente e transições.
- **Novo jogo:** nome, nome de exibição e pronomes (ele/ela/elu). Os textos concordam com os pronomes escolhidos.
- **História jogável:**
  - **Capítulo 1 — Apartamento 201:** 5 cenas completas.
  - **Capítulo 2 — Cartões-postais de Kamakura:** 5 cenas (v0.6).
  - **Capítulo 3 — O Bilhete que Kyo Guardou:** 4 cenas (v0.6).
- **Diálogos ramificados:** cada escolha tem reação própria, altera variáveis da história, mexe nos relacionamentos e libera ou bloqueia opções futuras. Opções bloqueadas aparecem com 🔒 e o motivo.
- **Relacionamentos:** amizade, confiança, afinidade e romance para cada personagem. Romance só existe com personagens adultos marcados como elegíveis, e só depois de uma afinidade mínima. Momentos marcantes aparecem como "Fulano vai lembrar disso".
- **Celular:** conversas individuais e em grupo, com respostas de escolha, convites, contatos e publicações fictícias (Hoshigram). As conversas ficam guardadas para reler.
- **Interface de visual novel:**
  - cenário em tela cheia e personagens em destaque (quem fala fica iluminado);
  - caixa de diálogo inferior, nome colorido por personagem e texto digitando;
  - botões de histórico, automático, pular (só texto já lido), salvar e ocultar interface;
  - menu com relacionamentos, histórico de escolhas e galeria de cenas, que dá para rever sem alterar o jogo.
- **Salvamento:** automático a cada fala, mais 3 espaços manuais. Guarda a cena, o passo exato, o que está na tela, as escolhas, os relacionamentos, as rotas, o celular e a galeria. "Continuar" volta exatamente na mesma fala.

## Personagens

As ilustrações originais são usadas em todas as cenas, sem redesenho: `public/assets/characters/<id>/full.webp` é a própria referência com o fundo removido.
A original fica intacta em `reference/original.jpg`. Dados de cada personagem (idade, ocupação, se pode ter romance, traços visuais) ficam em `src/characters/characters.json`.

| Personagem | Idade | Na história |
|---|---|---|
| Rin Kuroha (01) | 22 | vizinha do 202 |
| Mei Asano (02) | 23 | vizinha do 205, melhor amiga da antiga moradora |
| Akane Tachibana (06) | 27 | fotógrafa, irmã da antiga moradora |
| Kaito Hayami (07) | 24 | vizinho do 203, entregador |
| Haru Mizuno (08) | 21 | colega no café |
| Kyo Amagiri (10) | 26 | gerente do Café Hoshi |

Os personagens 03 e 04 usam uniforme escolar e **nunca** terão romance.
O 05 está fora da história até a imagem ser licenciada.
O 09 é Sora Kirishima (25 anos, sem romance): por enquanto só é descrito na história, sem aparecer em cena. O 11 ainda não aparece.

**Expressões:** só existe a arte neutra de cada personagem. A expressão aparece animando a própria ilustração: olhos semicerrados ou arregalados, rubor, cabeça, respiração e balão (veja [ANIMACAO_2D.md](ANIMACAO_2D.md)).
Para usar arte própria por expressão, veja `public/assets/characters/<id>/expressions/README.md`.

## Como executar
```bash
cd ANIME-LIFE
npm install
npm run dev      # http://localhost:5174
npm test         # verifica a história + build + joga o Capítulo 1 no Chromium (capturas em test-results/)
```

## Android
**APK beta:** a cada envio para o GitHub, o workflow "ANIME LIFE — APK beta" compila o APK. Para baixar:
1. Abra a aba **Actions** do repositório.
2. Entre na execução mais recente.
3. Baixe o artefato **AnimeLife-beta-N**.

O APK é assinado para depuração (testes). Para instalar, permita "fontes desconhecidas".
Para a Play Store, é preciso gerar um APK/AAB assinado com a sua chave de lançamento.

Para compilar no próprio computador:
```bash
npm run android:sync   # build + copia para android/
npm run android:open   # Android Studio → Run ou Build APK (app travado em paisagem)
```

## Como escrever a história
- **Cenas:** ficam em `src/story/chapters/chN.js`. Cada cena é uma lista de passos:
  ```js
  { bg: 'cafe' }  { music: 'cafe' }  { card: 'Segunda-feira, 15h' }
  { show: R, at: 'left', e: 'happy' }  { hide: R }  { shot: 'wide' }
  { prop: 'carta' } { prop: 'carta', by: A } { prop: null } { c: R, pose: 'wave', t: 'Oi!' }
  { n: 'narração' }  { th: 'pensamento' }  { p: 'fala do protagonista' }  { c: R, e: 'sad', t: 'fala' }
  { id: 'decisao', choice: [{ t: 'texto', value: 'x', do: [rel(R, { amizade: 2 }), flag('k', 'v')], go: 'rotulo', if: (c) => ..., lockIf: (c) => ..., lock: 'motivo' }] }
  { label: 'rotulo' }  { if: (c) => c.flag('k') === 'v', go: 'rotulo' }  { phone: 'conversa' }  { end: true }
  ```
- **Câmera e emoção por fala:** `cam: 'close'` força o plano; `big: true` marca uma revelação. Sem `e`, a emoção é deduzida do texto.
- **Marcadores de texto:** `{nome}` para o nome de exibição e `{g:o/a/e}` para a concordância com os pronomes.
- **Celular:** conversas ficam em `src/story/phone/conversations.js` e publicações em `src/story/phone/posts.js`.
- **Verificação:** `node tools/story-check.mjs` percorre todos os caminhos e acusa rótulos quebrados, becos sem saída e romance inválido.

## Estrutura do código
```
src/core/            Engine.js (Phaser), GameState.js (estado salvo + textos), EventBus, assets
src/scenes/          StageScene.js (palco: cenário, personagens, câmera, transições), backgrounds.js (cenários pintados)
src/animation/       LivingSprite.js + livingShader.js (anima a ilustração original), CharacterAnimator.js
src/cinematic/       Emotions.js (emoção de cada fala), Director.js (planos de câmera), LipSync.js (boca pelo texto)
src/story/           StoryEngine.js (intérprete), chapters/ (capítulos), events/ (encontros e eventos românticos),
                     phone/ (conversas e posts), dsl.js
src/scenes/AmbientFX.js  vida dos cenários (luzes, poeira, vapor, estrelas, lâmpadas)
src/choices/         ChoiceSystem.js (condições, bloqueios, efeitos, registro de decisões)
src/characters/      characters.json + CharacterRegistry.js
src/relationships/   RelationshipManager.js (4 atributos, regras de romance, rotas)
src/smartphone/      PhoneSystem.js (conversas da história, posts), ChatSystem.js (chat livre, memória, espontâneas),
                     presence.js (online/offline), ai/ (AIClient, LocalBrain = modo local, storyFacts)
server/              servidor seguro de IA (Node + SDK oficial da Anthropic) — veja server/README.md
src/save/            SaveManager.js (IndexedDB: auto + 3 espaços), Settings.js
src/ui/              UIManager, MainMenu, NewGame, DialogueUI, PhoneUI, Cards, Panels
tools/               story-check.mjs, smoke-test.cjs, process_characters.py
```

## Ainda não feito
- **Capítulos 4 a 3.000:** 27 estão roteirizados e 2.970 só planejados (veja ROTEIRO_3000.md). Também faltam rotas completas e finais diferentes.
- **Arte das poses de braços:** sem ela, os personagens mantêm a pose original.
- **Vozes gravadas** por dubladores: hoje só existe voz sintetizada.
- Camadas desenhadas (olhos fechados, boca aberta) para um piscar completo e uma boca bem aberta. Veja o pedido de recursos em ANIMACAO_2D.md.
- Cenários desenhados à mão (os atuais são pintados por código).
