# ANIME LIFE — MINHA VIDA

Visual novel anime, conduzida só por cenas, diálogos e escolhas.
Feita com **Phaser 3 + JavaScript modular + Vite**, empacotável como app Android com **Capacitor**.

> A versão anterior (exploração livre com joystick e mapa) foi removida a pedido. O código dela continua no histórico do git.

## O que tem nesta versão (v0.2.0)

- **Menu principal:** Continuar, Novo jogo, Carregar, Galeria, Ajustes e Créditos, com música ambiente e transições.
- **Novo jogo:** nome, nome de exibição e pronomes (ele/ela/elu). Os textos concordam com os pronomes escolhidos.
- **História jogável:**
  - **Capítulo 1 — Apartamento 201:** 5 cenas completas.
  - **Capítulo 2 — Cartões-postais de Kamakura:** só a abertura. Ela muda conforme o que aconteceu no Capítulo 1.
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
O 09 (talvez o mesmo personagem do 08) e o 11 ainda não aparecem.

**Expressões:** só existe a arte neutra de cada personagem. Por enquanto, a expressão é mostrada com animação, balão (♪ ! ? 💢 💧) e rubor sobre a ilustração original.
Para trocar por arte própria, veja `public/assets/characters/<id>/expressions/README.md`.

## Como executar
```bash
cd ANIME-LIFE
npm install
npm run dev      # http://localhost:5174
npm test         # verifica a história + build + joga o Capítulo 1 no Chromium (capturas em test-results/)
```

## Android
```bash
npm run android:sync   # build + copia para android/
npm run android:open   # Android Studio → Run ou Build APK (app travado em paisagem)
```

## Como escrever a história
- **Cenas:** ficam em `src/story/chapters/chN.js`. Cada cena é uma lista de passos:
  ```js
  { bg: 'cafe' }  { music: 'cafe' }  { card: 'Segunda-feira, 15h' }
  { show: R, at: 'left', e: 'happy' }  { hide: R }
  { n: 'narração' }  { th: 'pensamento' }  { p: 'fala do protagonista' }  { c: R, e: 'sad', t: 'fala' }
  { id: 'decisao', choice: [{ t: 'texto', value: 'x', do: [rel(R, { amizade: 2 }), flag('k', 'v')], go: 'rotulo', if: (c) => ..., lockIf: (c) => ..., lock: 'motivo' }] }
  { label: 'rotulo' }  { if: (c) => c.flag('k') === 'v', go: 'rotulo' }  { phone: 'conversa' }  { end: true }
  ```
- **Marcadores de texto:** `{nome}` para o nome de exibição e `{g:o/a/e}` para a concordância com os pronomes.
- **Celular:** conversas ficam em `src/story/phone/conversations.js` e publicações em `src/story/phone/posts.js`.
- **Verificação:** `node tools/story-check.mjs` percorre todos os caminhos e acusa rótulos quebrados, becos sem saída e romance inválido.

## Estrutura do código
```
src/core/            Engine.js (Phaser), GameState.js (estado salvo + textos), EventBus, assets
src/scenes/          StageScene.js (palco: cenário, personagens, transições), backgrounds.js (cenários pintados)
src/story/           StoryEngine.js (intérprete), chapters/ (capítulos), phone/ (conversas e posts), dsl.js
src/choices/         ChoiceSystem.js (condições, bloqueios, efeitos, registro de decisões)
src/characters/      characters.json + CharacterRegistry.js
src/relationships/   RelationshipManager.js (4 atributos, regras de romance, rotas)
src/smartphone/      PhoneSystem.js (contatos, conversas, posts)
src/save/            SaveManager.js (IndexedDB: auto + 3 espaços), Settings.js
src/ui/              UIManager, MainMenu, NewGame, DialogueUI, PhoneUI, Cards, Panels
tools/               story-check.mjs, smoke-test.cjs, process_characters.py
```

## Ainda não feito
- Capítulo 2 além da abertura, rotas completas e finais diferentes. As variáveis que vão decidir os finais já são registradas desde o Capítulo 1.
- Arte de expressões e cenários desenhados à mão (os atuais são pintados por código).
- APK compilado (precisa do Android Studio).
