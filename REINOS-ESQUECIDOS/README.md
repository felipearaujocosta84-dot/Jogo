# Reinos Esquecidos

RPG de ação e aventura 3D em fantasia medieval, feito com **Babylon.js + JavaScript + Vite**.
Single-player, câmera isométrica inclinada, prioridade para **Android** (navegador mobile e futuro APK).

## Rodar

```bash
cd REINOS-ESQUECIDOS
npm install
npm run dev        # abre em http://localhost:5173 (e na rede local, para testar no celular)
npm run build      # gera a pasta dist/ pronta para publicar ou empacotar
```

## Modelos usados
- `public/models/reinos_esquecidos_mapa.glb`: o mapa (terreno do Vale Verde, trilha, lago, árvores, arbustos, pedras, aldeia).
  O jogo lê o terreno para gerar alturas, colisões (árvores, pedras e casas) e o minimapa.
- `public/models/heroi.glb`: o herói. O modelo é estático (pose em T), então o jogo **cria um esqueleto por código**
  (`src/player/heroRig.js`) e anima andar, correr, combo de espada, giro, rolamento, beber poção e morte.

## Conteúdo
- **Regiões**: Aldeia Inicial (zona segura), Vale Verde, Lago Azul, Floresta Sombria (acampamento goblin),
  Ninho das Aranhas, Ruínas Antigas (chefe) e Terras Selvagens.
- **Inimigos** com IA (patrulha, perseguição, ataque com preparo, recuo, retorno): lobos, goblins, aranhas,
  esqueletos e o chefe **Rei Esquecido** (golpe em área com aviso no chão e invocação de guardas).
- **Combate**: combo de 3 golpes, Golpe Giratório, esquiva com invencibilidade, poções, críticos, mira automática.
- **Progressão**: XP e níveis, ouro, saque, baús, armas e armaduras, loja do ferreiro (comprar/vender).
- **5 missões** (3 da história principal), NPCs com diálogos e marcadores `!`/`?`.
- **Salvamento** automático e no poço da aldeia (localStorage).
- Ciclo dia/noite, água animada, grama, fogueiras, partículas, música e sons sintetizados (sem downloads).
- Árvores e casas entre a câmera e o herói ficam transparentes (o herói nunca some).

## Controles
- Celular: joystick no lado esquerdo; arrastar no lado direito gira a câmera; pinça = zoom; botões ⚔️ 🌀 💨 🧪 ✋.
- PC: WASD, Espaço/clique ataca, K giratório, Shift esquiva, H poção, F interage, Q/E câmera, I/U/M menus, Esc pausa.

## Estrutura
```
src/main.js, game.js, config.js, babylon.js (imports enxutos), style.css
src/world/      terrain.js, vegetation.js, regions.js, worldManager.js, occlusion.js
src/player/     player.js, heroRig.js, movement.js, combat.js
src/enemies/    enemy.js, enemyAI.js, enemyModels.js
src/systems/    inventory.js, quests.js, save.js, interaction.js, audio.js, effects.js
src/camera/     isometricCamera.js
src/ui/         hud.js, joystick.js, menus.js
public/         models/, textures/, audio/, icons/, libs/ (decodificador meshopt), manifest, sw.js
```

## Celular e APK
- Já é um PWA: no Chrome do Android, "Adicionar à tela inicial" abre em tela cheia e funciona offline.
- Qualidade automática (Alta/Média/Baixa), resolução adaptável ao FPS, opção de 30 FPS.
- Para gerar o APK com Capacitor (o `capacitor.config.json` já está pronto):
  ```bash
  npm run build
  npm install @capacitor/core @capacitor/cli @capacitor/android
  npx cap add android
  npx cap sync android
  npx cap open android   # no Android Studio: Build > Build APK(s)
  ```
