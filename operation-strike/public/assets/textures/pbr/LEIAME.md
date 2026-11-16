# Texturas PBR dos mapas

Geradas por `scripts/textures/generate_pbr.py` (material procedural: relevo, desgaste, sujeira, rachaduras e variação
por peça), contínuas (sem emendas), com tamanho real definido em metros.

| Arquivo | Conteúdo |
|---|---|
| `<res>/<material>_albedo.webp` | cor (sRGB) |
| `<res>/<material>_normal.webp` | relevo (normal no padrão OpenGL/glTF) |
| `<res>/<material>_orm.webp` | R = oclusão de ambiente, G = rugosidade, B = metal (metade da resolução da cor) |
| `detail/<material>_detail.webp` | mapa de detalhe do Babylon (variação de cor/rugosidade + normal) para os mapas de modelo 3D |

| Material | Tamanho de uma repetição | 4K |
|---|---|---|
| asphalt (asfalto com brita, remendos, óleo, rachaduras) | 6 m | sim |
| concrete (concreto com poros, juntas de forma, escorridos) | 4 m | sim |
| plaster (reboco com marcas de desempenadeira, remendos) | 5 m | sim |
| brick (tijolos 23 × 7,5 cm, argamassa, lascas, fuligem, eflorescência) | 3 m | sim |
| sandstone (blocos de arenito com camadas e erosão) | 4 m | sim |
| sand (areia com ondulações e pedriscos) | 6 m | sim |
| tile (lajotas 1 m com rejunte e desgaste) | 4 m | sim |
| metal, container (chapa ondulada pintada com ferrugem) | 3 m | — |
| roof, trim, door, steel, crate, carpet, grass, glass, dark | 1–4 m | — |

Resoluções: `1k` (todas), `2k` (todas), `4k` (só as de chão/parede).
O APK leva `1k` e o `2k` só dos materiais de chão/parede (o workflow remove o resto); o PC/navegador usa todas.
