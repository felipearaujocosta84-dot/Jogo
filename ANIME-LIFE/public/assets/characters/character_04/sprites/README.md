# Spritesheet animada (ainda não produzida)

Esta pasta recebe a spritesheet de movimentação **desenhada a partir de `../reference/original.jpg`**,
preservando rosto, olhos, cabelo, roupas, acessórios e proporções (ver `traits` em `src/characters/characters.json`).

Formato esperado (o mesmo do protagonista, já suportado pelo código em `src/npc/NPC.js`):

- Arquivo: `walk.webp` (PNG também funciona), fundo transparente.
- Quadro: 96 × 192 px (personagem de pé, pés encostando na borda de baixo).
- 4 linhas: baixo, esquerda, direita, cima.
- 6 colunas: parado 1, parado 2 (respiração), andar 1–4.

Depois de criar o arquivo, registre em `characters.json`:

```json
"spriteSheet": { "file": "sprites/walk.webp", "frameWidth": 96, "frameHeight": 192 }
```

Enquanto não existir, o jogo mostra a ilustração original estática (`world.webp`).
