> **Novo projeto:** o FPS **OPERATION STRIKE** (5v5 com bots e multiplayer online) está na pasta [`operation-strike/`](operation-strike/README.md).

# STREET FOOTBALL 3D

Futebol de rua 3D (3 contra 3) feito com **Babylon.js + JavaScript + Vite**, pensado para rodar no navegador de celulares Android.

## Estado atual — ETAPA 2 concluída

| Etapa | Status |
|---|---|
| 1. Base 3D, quadra, gols, bola e câmera | ✅ pronta e testada |
| 2. Seis jogadores e movimentação | ✅ pronta e testada |
| 3. Física, posse, passe e chute dos jogadores | ⏳ próxima |
| 4. IA dos times e goleiros | ⏳ |
| 5. Controles virtuais Android | ⏳ |
| 6. Menu, placar, cronômetro e resultado | ⏳ |
| 7. Gráficos, animações e efeitos | ⏳ |
| 8. Otimização e testes finais | ⏳ |

### O que já funciona
- Arena urbana noturna: quadra de concreto pintado com linhas, mureta com painéis, alambrado,
  muros grafitados (gerados por código), arquibancadas com torcida animada, refletores,
  prédios iluminados ao fundo, céu e neblina.
- Dois gols com traves, travessão e **redes que balançam** (simulação por vértice).
- Bola com **física arcade própria**: gravidade, quiques, atrito de rolagem, arrasto, efeito,
  rebote nas muretas, colisão com traves/travessão, rede que segura a bola, subpassos contra "atravessar" objetos.
- **Detecção de gol** (bola cruzando totalmente a linha), placar, banner "GOOOL!", confete, torcida pulando, reinício no meio.
- **Câmera de transmissão**: lateral, elevada, acompanha a bola com suavização, sem giro; ajusta campo de visão em telas em pé.
- **Áudio** sintetizado (chute, passe, quique, trave, rede, gol, apito, torcida). Aceita trocar por arquivos reais (`audio.load('kick', 'sounds/kick.mp3')`).
- **Desempenho**: resolução adaptável pelo FPS, níveis de qualidade (auto/alta/média/baixa), limite de 30 FPS opcional,
  sombras econômicas, texturas procedurais (zero downloads de imagens), pausa automática ao trocar de app.

### Etapa 2 — jogadores
- **6 jogadores humanos 3D** (goleiro + 2 de linha por time) com **esqueleto real** (15 ossos, skinning suave no tronco),
  uniformes por time, goleiros com cor própria e luvas, variação de pele, cabelo, altura e porte.
- **Animações procedurais**: parado, andar, correr, sprint (amplitude e inclinação crescem com a velocidade),
  postura de goleiro, chute, passe, carrinho, defesa em mergulho, comemoração e tropeço (já prontas para as próximas etapas).
- **Movimento arcade**: aceleração, frenagem, giro suave, três velocidades (andar/correr/sprint), **fôlego** que gasta no sprint.
- **Colisões**: jogador × jogador, jogador × muretas e redes, jogador × bola (condução por toque de pé, rebote no corpo).
- **IA de movimentação** (base para a Etapa 4): goleiros acompanham a bola na linha e saem do gol; um jogador de cada time
  disputa a bola e conduz para o gol adversário; os outros se posicionam (atacante oferece linha de passe, defensor cobre o gol),
  sem se amontoar. Regra de saída de bola, dividida (bola espirra quando os dois times travam a disputa) e "puxada com a sola" na parede.
- **Controles**: joystick analógico dinâmico (multitoque), botões CORRIDA, CHUTE e TROCAR. Teclado no PC: WASD/setas, Shift, Espaço, Q.
- **Pronto para modelos GLB** (testado com um modelo rigado de exemplo): coloque `public/models/player.glb` e crie um
  arquivo `.env` com `VITE_PLAYER_MODEL=models/player.glb`. O animador GLB usa as animações do arquivo (Idle/Walk/Run/Kick…)
  e pinta o uniforme com a cor do time. Sem modelo configurado, o personagem procedural é usado e o carregador GLB nem entra no pacote.

### Como jogar
- **Polegar esquerdo**: joystick (aparece onde tocar). **CORRIDA** (segurar): sprint.
- **CHUTE**: chuta na direção do joystick (ou para onde o jogador olha). Encoste na bola para conduzir.
- **TROCAR**: controla o companheiro mais perto da bola. ⟲ reinicia as posições; ❚❚ pausa e configurações.

## Como executar

### Pelo celular (sem instalar nada)
Use o link do jogo publicado que foi enviado na conversa, ou ative o GitHub Pages (instruções abaixo).

### No computador (desenvolvimento)
```bash
npm install
npm run dev      # abre em http://localhost:5173 (e na rede local, para testar no celular)
npm run build    # gera a versão final em dist/
```

## Estrutura

```
index.html                 interface HTML (HUD, telas)
src/main.js                ponto de entrada, liga a interface ao jogo
src/game.js                motor, cena, laço com passo fixo, pausa, modo treino
src/config.js              medidas da quadra, física, times, qualidade
src/babylon.js             importações do Babylon.js (só o necessário = bundle menor)
src/ball/Ball.js           bola e física arcade
src/camera/BroadcastCamera.js  câmera de transmissão
src/stadium/StreetArena.js arena urbana (colisões de mureta inclusas)
src/stadium/Goal.js        gols, redes animadas, colisão com traves
src/stadium/arenas.js      registro de arenas (para adicionar novas)
src/stadium/textures.js    texturas procedurais (quadra, grafite, torcida, bola…)
src/player/Player.js       jogador: movimento, fôlego, colisões, contato com a bola
src/player/PlayerAI.js     IA (posicionamento, perseguição, goleiro)
src/player/PlayerAnimation.js  animação procedural + animador para GLB
src/player/ProceduralHumanoid.js  personagem provisório com esqueleto
src/player/ModelFactory.js troca transparente entre GLB e personagem provisório
src/player/Team.js         times, uniformes, posições de saída
src/controls/MobileControls.js  joystick + botões (multitoque) + teclado
src/audio/AudioManager.js  sons (sintetizados ou arquivos)
src/effects/Effects.js     partículas de chute e confete
src/core/Performance.js    resolução adaptável e FPS
src/core/Settings.js       preferências salvas
```

Os arquivos `src/match/*` e `src/ui/Menu.js` serão criados na Etapa 6.
