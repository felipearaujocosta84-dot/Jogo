# Recursos 3D do OPERATION STRIKE

Coloque aqui os modelos e texturas reais. O jogo **verifica se cada arquivo existe** antes de carregar:
enquanto um arquivo não existir, ele usa o modelo provisório (procedural) e a tela
**Arsenal → Recursos 3D** mostra exatamente o que falta.

> Use apenas arquivos com licença que permita uso no jogo (ex.: **CC0**, ou **CC-BY** dando crédito).
> Guarde o link de origem e a licença de cada arquivo em `CREDITS.md` nesta pasta.

## Armas (GLB)
| Arquivo | Arma |
|---|---|
| `weapons/rifles/ak47.glb` | AK-47 |
| `weapons/rifles/m4a1.glb` | M4A1-S |
| `weapons/rifles/m4a4.glb` | M4A4 |
| `weapons/rifles/aug.glb` | AUG |
| `weapons/snipers/awp.glb` | AWP |
| `weapons/snipers/ssg08.glb` | SSG 08 |
| `weapons/pistols/deagle.glb` | Desert Eagle |
| `weapons/pistols/glock.glb` | Glock-18 |
| `weapons/smg/mp5.glb` | MP5 |
| `weapons/smg/ump45.glb` | UMP-45 |
| opcionais: `weapons/pistols/usp.glb`, `weapons/pistols/p250.glb`, `weapons/smg/mac10.glb`, `weapons/melee/knife.glb` | |

O jogo ajusta sozinho cada modelo:
- **eixo do cano** = maior dimensão; o sentido é a ponta mais fina (cano), não a coronha;
- **para cima** = lado oposto ao pente/empunhadura;
- **escala** = tamanho real da arma (ex.: AK-47 0,88 m);
- **empunhadura** na mão direita;
- peças cujo nome contém `mag`, `magazine`, `clip` ou `pente` viram o **pente** animado na recarga;
  `slide`, `bolt` ou `ferrolho` viram o **ferrolho**;
- animações dentro do GLB com nomes contendo `idle`, `fire`/`shoot`, `reload`, `inspect`, `draw`/`deploy`
  são tocadas nos momentos certos (além das animações procedurais do jogo).

Se algum modelo ficar virado ou deslocado, crie `weapons/weapons.json` com ajustes por arma:
```json
{
  "ak47": { "forward": "-x", "up": "+y", "length": 0.88, "gripAt": 0.4, "gripHeight": 0.6,
            "offset": [0, 0, 0], "rotation": [0, 0, 0], "magazine": "Mag_01", "slide": "Bolt" },
  "hands": { "scale": 1, "rotation": [0, 0, 0], "offset": [0, 0, 0] }
}
```

Prefira GLB otimizado para celular: até ~15 mil triângulos por arma, texturas de até 2048 px.
Não use compressão Draco (o app funciona offline e o decodificador Draco não vai junto).

## Mãos
`hands/tactical_gloves.glb`: mão **direita** com luva preta, palma voltada para o lado e dedos fechados.
O jogo espelha o modelo para fazer a mão esquerda. Se o arquivo tiver uma animação com
`idle`/`grip`/`hold` no nome, ela fica em repetição.

## Skins (texturas opcionais)
Cada skin tem uma pasta. Sem texturas, a skin usa o padrão procedural do jogo.
| Pasta | Skin | Raridade |
|---|---|---|
| `skins/military_camo/` | Camuflagem Militar | Comum |
| `skins/carbon/` | Carbono | Rara |
| `skins/black_ice/` | Gelo Negro | Épica |
| `skins/inferno/` | Inferno | Épica |
| `skins/blue_dragon/` | Dragão Azul | Lendária |
| `skins/gold/` | Dourada | Especial |

Arquivos aceitos em cada pasta (`.webp`, `.jpg` ou `.png`):
- `albedo` — cor (aplicada usando o UV do modelo GLB);
- `normal` — relevo;
- `orm` — oclusão (R), rugosidade (G) e metalicidade (B).

As texturas são reduzidas automaticamente conforme a qualidade gráfica (1024 px na média, 2048 px na alta).

## Sons (opcionais)
`audio/weapons/<arma>_fire.mp3` (ou `.ogg`), por exemplo `audio/weapons/ak47_fire.mp3`.
Sem arquivo, o som de tiro é sintetizado.
