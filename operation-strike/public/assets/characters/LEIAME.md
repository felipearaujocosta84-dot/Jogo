# Personagens do jogo

| Arquivo | Equipe | Visual |
|---|---|---|
| `soldado.glb` / `soldado_lod.glb` | CT (antiterrorista) | capacete, uniforme camuflado e colete de placas |
| `terrorista.glb` / `terrorista_lod.glb` | TR | lenço xadrez, camisa marrom e colete preto |

Os arquivos enviados vieram com os nomes trocados em relação ao visual; aqui eles estão nomeados pelo conteúdo.
A ligação equipe → arquivo fica em `src/player/CharacterAssets.ts` (`CHARACTER_FILES`).

- Esqueleto de 21 ossos e 18 animações — ver `art/characters/`:
  - próprias: Idle, Walk, Run, Jump, Crouch, Aim, Shoot, Reload, Death;
  - locomoção (FBX enviados, convertidos por `scripts/blender/retarget_mixamo.py`): Run_Forward, Sprint_Backward,
    Stepping_Backward, Strafe_Left/Right (Strafing + espelho), Walk_Left/Right (Walk_Left + espelho), Turning/Turning_Mirror.
- Velocidade de cada ciclo (m/s, usada contra deslize dos pés em `src/player/Character.ts`, tabela `LOCO`):
  Run_Forward 3,71 · Sprint_Backward 5,56 · Stepping_Backward 0,22 · Strafe 0,83 · Walk_Left/Right 1,48 · Turning ≈ 31°/s.
- `_lod`: ~11 mil vértices e texturas 1024 (qualidades Baixa/Média e celular, exceto Ultra). Completo: ~28 mil vértices, texturas 2048.
- A arma fica presa no osso `Hand.R`.
