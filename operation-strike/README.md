# OPERATION STRIKE

FPS competitivo 5v5 original feito com **Babylon.js + TypeScript + Vite** (cliente) e **Node.js + WebSocket** (servidor autoritativo).
Roda no navegador do PC e de celulares Android.

## Estado atual — Etapas 1 a 8 implementadas

| Etapa | O que tem |
|---|---|
| 1. Ambiente, 1ª pessoa, movimentação, Android | física própria (AABB), andar/correr/andar silencioso, agachar (inclusive no ar), pular, degraus, colisões, joystick + botões de toque com editor de layout |
| 2. Armas | Glock-18, USP-S, P250, Desert Eagle, MP5, UMP-45, MAC-10, AK-47, M4A4, M4A1-S, AWP, SSG 08, faca, granadas explosiva/flash/fumaça, C4. Modelos 3D próprios, animação de disparo/recarga/saque/inspeção, recuo com padrão de spray, dispersão por movimento, mira (ADS) e luneta com 2 níveis, raycast com dano por região (cabeça ×4, peito, estômago, pernas), colete e capacete, queda de dano por distância |
| 3. Mapas | **Dust Zone** (deserto), **Factory** (indústria) e **Skyscraper** (urbano): 2 locais de bomba cada, rotas alternativas, coberturas, portas que abrem/fecham, escadas, plataformas, iluminação, sombras, texturas procedurais, limites |
| 4. Bots e 5v5 contra IA | navegação A* em grade gerada automaticamente, visão com campo de visão e linha de visão (paredes e fumaça), audição de tiros/passos, tempo de reação, mira com erro e controle de recuo, rajadas, strafe, cobertura com pouca vida, recarga, compra, granadas, abrir portas. Táticas de time: TR escolhe local, reúne e invade, plantam e defendem a bomba; CT divide A/B/meio, rotaciona, retoma e desarma. Dificuldades Fácil/Normal/Difícil |
| 5. Bomba, economia, rodadas | MR12 (24 rodadas, vence com 13), troca de lados na 13ª, compra (15 s de congelamento + 25 s de compra), tempo de rodada, bomba de 40 s, plantio 3,2 s, desarme 10 s (5 s com kit), vitória por eliminação/bomba/desarme/tempo, recompensas por abate (por arma), vitória, derrota com bônus progressivo, plantio e desarme. Loja por categorias |
| 6. Multiplayer online | servidor **autoritativo** em Node (60 ticks/s, snapshots 20/s): criar sala, entrar por código, salas públicas, **encontrar partida por habilidade (MMR)**, escolha de time, bots preenchem vagas, sincronização de posições, tiros, mortes, bomba, granadas, portas e placar, previsão do movimento no cliente com reconciliação, interpolação dos outros jogadores, compensação de latência nos tiros, **reconexão** (um bot assume enquanto você está fora) |
| 7. Menus, ranking, estatísticas | Jogar (contra bots / online), Treinamento (bots-alvo, dinheiro infinito), Arsenal, Configurações, Perfil (XP, nível, 18 patentes por MMR, vitórias, derrotas, abates, mortes, assistências, HS%, MVPs, histórico), Ranking online. HUD: mira dinâmica, vida, colete, munição, cronômetro, dinheiro, placar 5v5 com vivos, killfeed, radar com companheiros/inimigos avistados/bomba, indicador da bomba, progresso de plantio/desarme, flash, luneta, indicador de dano, nomes dos companheiros, espectador |
| 8. Otimização e testes | qualidade baixa/média/alta/automática (resolução adaptável pelo FPS), distância de renderização, sombras desenhadas uma vez (cenário estático), geometria agrupada por material e bloco, personagens em malha única com skinning, limites de partículas/marcas, pausa ao trocar de app, limite de FPS. Testes automáticos de partida completa só com bots e de multiplayer com dois clientes reais |

### Personagens
Soldados 3D com **esqueleto de 18 ossos e malha com skinning**, proporções humanas (1,80 m), 5 visuais por equipe
(uniforme, colete, capacete/balaclava/boné/lenço, luvas, botas). Animações procedurais: caminhada, corrida, agachar,
mira acompanhando o olhar, braços por cinemática inversa segurando cada tipo de arma, recuo, recarga, plantar/desarmar e queda ao morrer.

## Como executar

```bash
cd operation-strike
npm install
npm run build      # gera o jogo em dist/
npm start          # servidor: jogo + multiplayer + ranking em http://localhost:8080
```
- **No Android**: com o celular na mesma rede Wi-Fi, abra `http://IP-DO-COMPUTADOR:8080`.
  Para jogar pela internet, hospede este servidor (qualquer serviço que rode Node.js e aceite WebSocket).
- **Só offline** (contra bots e treino): `dist/` funciona em qualquer hospedagem estática (ex.: GitHub Pages).
  Para usar um servidor online em outro endereço, informe-o em Configurações → "Servidor online".
- Desenvolvimento: `npm start` em um terminal e `npm run dev` em outro (o Vite repassa `/ws` e `/api` para a porta 8080).

### Testes
```bash
npm run test:sim -- dust_zone hard competitive   # partida completa 5v5 só com bots (sem gráficos)
npx tsx scripts/nettest.ts                        # dois clientes WebSocket contra o servidor rodando
npm run typecheck
```

### Controles
- **PC**: WASD · mouse · Espaço pular · Ctrl/C agachar · Shift andar · clique atirar · botão direito mirar/luneta · R recarregar ·
  1 primária · 2 pistola · 3 faca · 4 granadas · 5 bomba · Q próxima arma · E usar/plantar/desarmar (segurar) · B loja · Tab placar · F inspecionar · Esc pausa.
- **Celular**: joystick à esquerda, arrastar à direita para olhar, ATIRAR (arrastar também gira a câmera), MIRAR, RECARREGAR, PULAR,
  AGACHAR, TROCAR, USAR, GRANADA, FACA, COMPRAR, PLACAR. Posição e tamanho editáveis em "Controles de toque".

## Estrutura
```
index.html, src/main.ts         telas e menus
src/core/                       Game (cliente), Session (local/online), Input, KeyboardMouse, Quality, Settings, GeoBuilder
src/sim/                        simulação compartilhada: MatchSim (partida), PlayerSim (jogador e armas), Grenades, types
src/physics/CollisionWorld.ts   colisão AABB + raycast (usado também no servidor)
src/player/                     PlayerController (movimento), CharacterModel (soldado com esqueleto)
src/camera/                     câmera 1ª pessoa e espectador
src/weapons/                    WeaponData (arsenal), WeaponModels (modelos 3D), ViewModel (braços e arma)
src/combat/                     Hitboxes (dano por região), Effects, ImpactEffects
src/bots/                       navigation (NavGrid A*), perception, tactics (TeamTactics), behavior (BotBrain)
src/rounds/, src/economy/       regras de partida e economia
src/maps/                       MapTypes, MapLayout, MapRuntime (colisão), MapBuilder (visual), DustZone, Factory, Skyscraper
src/multiplayer/                Protocol, NetClient
src/interface/                  Hud, Radar, Scoreboard, BuyMenu, TouchControls, style.css
src/audio/                      AudioManager (sons sintetizados e espaciais)
src/save/                       Profile (XP/MMR/patentes), LocalProfile, Storage
server/                         index (HTTP + WebSocket + API), Room (partida autoritativa), ProfileStore (data/profiles.json)
scripts/                        simtest (partida de bots), nettest (multiplayer)
public/assets/                  espaço para modelos, texturas, animações e sons reais
```

## Limitações conhecidas
- Modelos de personagens e armas são **originais e procedurais** (low-poly, com cores por vértice); podem ser trocados
  por modelos GLB com texturas no futuro. Sons são sintetizados (aceitam arquivos reais via `AudioManager.load`).
- Tiros não atravessam paredes; armas de quem morre não ficam no chão (só a bomba cai e pode ser pega).
- Bots andam apenas no nível do chão (não sobem em plataformas elevadas).
- Perfis online são identificados pelo aparelho (sem login/senha) e salvos em `data/profiles.json` no servidor.
