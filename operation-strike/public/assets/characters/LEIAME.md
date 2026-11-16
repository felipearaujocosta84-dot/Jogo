# Personagens do jogo

| Arquivo | Equipe | Visual |
|---|---|---|
| `soldado.glb` / `soldado_lod.glb` | CT (antiterrorista) | capacete, uniforme camuflado e colete de placas |
| `terrorista.glb` / `terrorista_lod.glb` | TR | lenço xadrez, camisa marrom e colete preto |

Os arquivos enviados vieram com os nomes trocados em relação ao visual; aqui eles estão nomeados pelo conteúdo.
A ligação equipe → arquivo fica em `src/player/CharacterAssets.ts` (`CHARACTER_FILES`).

- Esqueleto de 21 ossos e 9 animações (Idle, Walk, Run, Jump, Crouch, Aim, Shoot, Reload, Death) — ver `art/characters/`.
- `_lod`: ~11 mil vértices e texturas 1024 (qualidades Baixa/Média e celular, exceto Ultra). Completo: ~28 mil vértices, texturas 2048.
- A arma fica presa no osso `Hand.R`.
