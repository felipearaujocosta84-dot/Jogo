# Personagens com rig e animações

| Arquivo | Conteúdo |
|---|---|
| `soldado.glb` | Modelo de `soldado.glb` enviado (personagem com lenço xadrez e colete preto) — riggado e animado |
| `terrorista.glb` | Modelo de `terrorista.glb` enviado (personagem com capacete e uniforme camuflado) — riggado e animado |
| `*_rig.blend` | Arquivos do Blender 4.2 com esqueleto, pesos e as 9 animações (para editar) |
| `teste_*.png` | Testes de deformação (Blender) e de reprodução no Babylon.js 9.32.1 |

**Atenção:** pelo visual, os nomes parecem trocados (o arquivo "soldado" tem o visual de TR e o "terrorista" o visual de CT).
Os nomes originais foram mantidos.

## Esqueleto (21 ossos que deformam)
Hips → Spine → Chest → Neck → Head; Chest → Shoulder.L/R → UpperArm → ForeArm → Hand;
Hips → UpLeg.L/R → Leg → Foot → Toe. No máximo 4 ossos por vértice (padrão glTF / Babylon).

- Altura 1,80 m, pés em y = 0, de frente para +Z (glTF/Babylon). Escala uniforme: proporções originais preservadas.
- Malha, roupas, equipamentos, UVs e texturas PBR (cor 2048², ORM 2048², normal 2048²) originais, sem alteração.
- Arma: prender no osso `Hand.R` (as animações seguram o fuzil com a direita no punho e a esquerda no guarda-mão).

## Animações (30 qps no Blender; o Babylon mostra em quadros de 60)
| Nome | Duração | Repete |
|---|---|---|
| Idle | 2,0 s | sim |
| Walk | 1,0 s | sim (no lugar) |
| Run | 0,67 s | sim (no lugar) |
| Jump | 1,2 s | não |
| Crouch | 1,33 s | sim |
| Aim | 2,0 s | sim |
| Shoot | 0,4 s (2 disparos) | sim |
| Reload | 2,2 s | não |
| Death | 1,5 s | não (fica no chão) |

## Como foi feito (scripts em `scripts/blender/`)
1. `decode_meshopt.mjs` — os GLB originais usavam compressão meshopt (não suportada pelo importador do Blender 4.2): descompactação sem perda.
2. `rig_character.py` — normaliza (rotação/escala uniforme), detecta ombros, cotovelos, pulsos, virilha, quadris, joelhos,
   tornozelos, dedos dos pés, pescoço e cabeça pela geometria; cria o esqueleto e os controles de IK; calcula os pesos
   (distância aos ossos + máscaras anatômicas + suavização na malha + vértices das costuras de UV unidos).
3. `animate.py` — anima pelos controles (IK de mãos e pés, coluna), assa nos ossos que deformam e exporta o GLB.

Uso no Babylon.js:
```ts
const c = await LoadAssetContainerAsync('assets/characters/soldado.glb', scene);
c.addAllToScene();
c.animationGroups.find(g => g.name === 'Walk')!.start(true);
```

## Animações de locomoção (FBX)

`scripts/blender/retarget_mixamo.py -- <rig.blend> <pasta_fbx> <saida.glb> <saida.blend> <saida.json>` converte os FBX
(esqueleto de 67 ossos, centímetros) para o rig de 21 ossos: rotação relativa à T-pose em espaço de mundo, altura do
quadril escalada pela razão das pernas, deslocamento linear removido (o jogo move o personagem), giro progressivo removido
em Turning/Strafing e versões espelhadas para o outro lado. Rodar de novo substitui os clipes.
`scripts/blender/lod.py -- <rig.blend> <saida_lod.glb> 0.32 1024` gera a versão leve.
Este `.blend` de cada personagem já contém as 18 ações.
