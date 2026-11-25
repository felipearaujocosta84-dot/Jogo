# ANIME LIFE — MINHA VIDA

Simulador de vida anime 2D (top-down) feito com **Phaser 3 + JavaScript modular + Vite**, preparado para virar APK Android com **Capacitor**.

## Estado atual — v0.1.0 (base jogável)

Fluxo testado de ponta a ponta: abrir o jogo → menu → novo jogo → criar o protagonista → entrar no apartamento →
andar → chegar perto da Rin (personagem oficial) → conversar com escolhas → dormir → salvar → continuar.

### Funciona (testado com `npm test`)
- **Menu principal**: Novo jogo, Continuar (só ativa com save), Configurações, Créditos; pétalas de cerejeira, música ambiente sintetizada, transições suaves.
- **Criação do protagonista**: nome, nome de exibição, pronomes, corpo, cabelo (4 estilos, 7 cores), olhos, pele, roupa (3 estilos, 6 cores), botão aleatório, prévia animada girando. O protagonista é desenhado por código e não usa a arte dos personagens oficiais.
- **Apartamento** (quarto, sala, cozinha, entrada): cama, escrivaninha com computador, TV, 2 janelas, porta de entrada, guarda-roupa, sofá, estante, planta, geladeira, bancada, mesa, sapateira, caixas da mudança e tapetes.
- **Movimentação**: joystick virtual (multitoque), teclado no PC (WASD/setas), modo livre ou 4 direções, colisão com paredes e móveis, caminhada e espera animadas em 4 direções (protagonista), câmera acompanhando.
- **Interação**: botão contextual (Dormir, Usar PC, Assistir, Olhar, Sair, Conversar…) e "!" sobre o alvo. Tecla E/Espaço no PC.
- **Diálogo estilo visual novel**: retrato original, nome, texto digitando, avançar/completar, opções numeradas, expressões, registro de decisões, afinidade, itens e contatos ganhos pelo diálogo.
- **Salvamento** local em IndexedDB (reserva em localStorage): ao criar, após diálogos, ao dormir, ao pausar e ao minimizar o app.
- **HUD Android**: joystick (inferior esquerdo), interação (inferior direito), celular e inventário acima dele, menu (superior direito). Durante diálogos os controles somem e a câmera sobe os personagens para fora da caixa de texto.

### Ainda não implementado
- Spritesheets animadas dos personagens oficiais (só as ilustrações estáticas existem; ver `public/assets/characters/*/sprites/README.md`).
- Arte de expressões faciais (hoje: ilustração original + animação, balão e rubor).
- Saída do apartamento, bairro, empregos, economia, missões, clima, mensagens do celular.
- APK compilado (o projeto Android está gerado; a compilação precisa do Android Studio/SDK).

## Como executar
```bash
cd ANIME-LIFE
npm install
npm run dev        # http://localhost:5174 (e na rede local para abrir no celular)
npm test           # build + teste automatizado no Chromium (capturas em test-results/)
```

## Como testar no Android
1. **Pelo navegador**: `npm run dev`, abra no celular (mesma rede Wi-Fi) o endereço "Network" que o Vite mostrar, em paisagem.
2. **Como APK**: instale o Android Studio e rode
   ```bash
   npm run android:sync   # build + copia para android/
   npm run android:open   # abre no Android Studio → Run (celular via USB) ou Build > Build APK(s)
   ```
   O app já está configurado para paisagem (`sensorLandscape`).

## Personagens oficiais
Cada personagem tem a pasta `public/assets/characters/character_XX/`:
`reference/original.jpg` (ilustração enviada, **nunca editar**), `full.webp` (recorte sem fundo, retrato do diálogo),
`portrait.webp` (busto), `world.webp` (versão leve no mapa) e `sprites/` (futuras animações).
Dados (nome provisório, traços visuais a preservar, paleta) em `src/characters/characters.json`.
Para regenerar os recortes: `npm run assets` (Python 3 + Pillow + NumPy).

⚠️ `character_03` tem marca d'água do Shutterstock e `character_05` traz o nome "Honami" e a assinatura de outro artista.
Antes de publicar, licencie ou substitua essas imagens.

## Arquitetura
```
src/main.js                    entrada
src/core/        Game.js (Phaser, resolução física), GameState.js (estado salvo), EventBus.js, assets.js
src/scenes/      ApartmentScene.js (cena 1)
src/world/       MapBuilder.js (piso/paredes/colisões do JSON), FurnitureArt.js (móveis em código),
                 Player.js (protagonista), InteractionSystem.js
src/characters/  characters.json, CharacterRegistry.js, ProtagonistArt.js, appearanceOptions.js
src/npc/         NPC.js (ilustração estática ou spritesheet quando existir)
src/dialogue/    DialogueRunner.js + scripts/ (rin.js, objects.js)
src/controls/    VirtualJoystick.js, InputController.js
src/ui/          UIManager, MainMenu, CharacterCreation, HUD, DialogueBox, Panels
src/save/        SaveManager.js (IndexedDB), Settings.js
src/relationships, inventory, smartphone   bases usadas pelos diálogos
src/economy, jobs, missions, weather, housing   reservados
public/assets/maps/apartment.json   mapa (cômodos, portas, móveis, NPCs, interações)
android/         projeto nativo Capacitor
tools/           process_characters.py (recortes), smoke-test.cjs (teste automatizado)
```

## Desempenho
Phaser só é baixado ao entrar no jogo (menu leve). Cenário pré-renderizado numa única textura,
imagens em WebP (≈1 MB para os 11 personagens), carregamento por cena (só os personagens presentes),
resolução limitada a 2× (opção "Econômico" usa 1×), áudio sintetizado (nenhum arquivo).
