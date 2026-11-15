# STREET FOOTBALL 3D

Futebol de rua 3D (3 contra 3) feito com **Babylon.js + JavaScript + Vite**, pensado para rodar no navegador de celulares Android.

## Estado atual — ETAPA 1 concluída

| Etapa | Status |
|---|---|
| 1. Base 3D, quadra, gols, bola e câmera | ✅ pronta e testada |
| 2. Seis jogadores e movimentação | ⏳ próxima |
| 3. Física, posse, passe e chute dos jogadores | ⏳ |
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

### Como jogar a Etapa 1 (modo treino)
- **Toque rápido** na quadra → passe rasteiro até o ponto tocado.
- **Segure e solte** → chute; quanto mais tempo segurando, mais forte e mais alto (barra de FORÇA).
- **Arraste** enquanto segura para ajustar a mira.
- ⟲ recoloca a bola; ❚❚ pausa e abre as configurações.

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
src/audio/AudioManager.js  sons (sintetizados ou arquivos)
src/effects/Effects.js     partículas de chute e confete
src/core/Performance.js    resolução adaptável e FPS
src/core/Settings.js       preferências salvas
```

Os arquivos `src/player/*`, `src/controls/MobileControls.js`, `src/match/*` e `src/ui/Menu.js`
serão criados nas etapas correspondentes (2 a 6).
