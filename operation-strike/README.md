# OPERATION STRIKE

FPS competitivo 5v5 original, feito com **Babylon.js + TypeScript + Vite**, para navegador de PC e celulares Android.

## Estado atual — ETAPA 1 concluída

| Etapa | Status |
|---|---|
| 1. Ambiente 3D, personagem em 1ª pessoa, câmera, movimentação e controles Android | ✅ pronta e testada |
| 2. Armas, tiros, recarga, mira, dano e animações | ⏳ próxima (base já existe: fuzil e pistola de treino) |
| 3. Primeiro mapa competitivo completo | ⏳ (Dust Zone já jogável, falta polimento/balanceamento) |
| 4. Bots e partidas 5v5 contra IA | ⏳ |
| 5. Bomba, economia, loja e rodadas | ⏳ |
| 6. Multiplayer online (servidor autoritativo) | ⏳ |
| 7. Menus, ranking, estatísticas e configurações | ⏳ |
| 8. Otimização, testes e correções | ⏳ |

### O que já funciona
- **Mapa Dust Zone** (original): vila desértica de ~100 x 116 m com Bomba A e Bomba B, base TR e base CT,
  Longo A com portões, Meio com portas, Curto A, conector B, Túneis B cobertos e túnel inferior,
  caixas, contêineres, plataforma com escada, muretas, carro abandonado, limites invisíveis do cenário.
  Portas deslizantes de verdade (tecla **E** / botão **USAR**) com colisão.
- **Movimentação estilo competitivo**: aceleração e atrito no chão, strafe no ar, gravidade, pulo, agachar
  (inclusive agachar no ar para subir em blocos altos), andar silencioso (Shift / joystick pouco empurrado),
  subida automática de degraus, detecção de chão/teto, colisão contra paredes e objetos.
- **Câmera em 1ª pessoa**: balanço ao andar, impacto ao aterrissar, transição suave ao agachar, zoom ao mirar.
- **Braços e arma em 1ª pessoa** (modelos provisórios próprios): inércia ao girar, recuo, clarão do disparo,
  recarga animada (pente sai e entra), troca de arma, inspeção, mira no centro.
- **Tiro de treino por raycast** com dispersão (parado/andando/no ar/agachado/mirando), recuo, marcas de bala e
  partículas conforme a superfície. Munição, recarga e troca funcionam.
- **Controles Android**: joystick esquerdo dinâmico, área direita para olhar, botões ATIRAR (2), MIRAR, RECARREGAR,
  PULAR, AGACHAR, TROCAR, USAR e INSPECIONAR. **Editor de layout** (mover, redimensionar, ocultar, salvar),
  sensibilidade ajustável, tela cheia e orientação horizontal.
- **PC**: WASD, mouse com Pointer Lock, Espaço, Ctrl/C, Shift, clique (atirar), botão direito (mirar), R, Q/1/2, E, F, Esc.
- **HUD**: mira dinâmica, vida, colete, munição, cronômetro, nome da área do mapa, radar giratório, avisos.
- **Configurações salvas no aparelho**: qualidade (auto/baixa/média/alta), distância de renderização, FOV,
  sensibilidades (toque, mouse, mira), opacidade dos botões, volume, limite de FPS, cor da mira, inverter Y.
- **Desempenho**: resolução adaptável pelo FPS, sombras renderizadas uma única vez (cenário estático),
  geometria agrupada por material e por bloco (poucas chamadas de desenho + recorte por visibilidade),
  texturas procedurais (zero downloads de imagem), limite de partículas e marcas por qualidade, pausa ao trocar de app.
- **Áudio sintetizado**: tiros, passos por tipo de piso, pulo/aterrissagem, recarga, portas, vento ambiente.

## Como executar
```bash
cd operation-strike
npm install
npm run dev      # http://localhost:5174 (também na rede local: abra o IP mostrado no navegador do Android)
npm run build    # gera a versão final em dist/ (arquivos estáticos, funciona em qualquer hospedagem)
```

## Estrutura
```
index.html                     telas, HUD e menus
public/assets/                 (modelos, texturas, animações, armas e áudio reais entram aqui)
src/main.ts                    entrada: carregamento, menus, tela cheia
src/core/                      Game (laço), Input, KeyboardMouse, Quality, Settings, babylon (imports)
src/physics/CollisionWorld.ts  mundo de colisão AABB + raycast (independente do Babylon: o servidor reutilizará)
src/player/PlayerController.ts movimento em 1ª pessoa
src/camera/FirstPersonCamera.ts câmera
src/weapons/                   WeaponTypes, WeaponSystem (lógica), ViewModel (braços e arma)
src/combat/ImpactEffects.ts    marcas de bala e partículas
src/maps/                      MapTypes, MapBuilder, DustZone (grade ASCII + objetos), textures, maps
src/interface/                 Hud, Radar, TouchControls (com editor), style.css
src/audio/AudioManager.ts      sons
src/save/Storage.ts            armazenamento local seguro
```
Pastas `src/bots`, `src/rounds`, `src/economy`, `src/multiplayer` e `server/` serão criadas nas etapas correspondentes.
