# Créditos dos recursos 3D

## Armas (public/assets/weapons/)
Modelos enviados pelo dono do projeto em 16/11/2026 (arquivos `.blend` do Blender 2.79 e um `.fbx`).
Pelos nomes e estilo (AssaultRifle_1…5, AssaultRifle2_2, Bullpup_1, Pistol_1/4/6), aparentam ser do pacote
de armas low-poly de **Quaternius**, distribuído em **CC0 (domínio público)**.
**Confirme a origem e a licença** e anote aqui o link de download.

Conversão feita para o jogo (Blender 4.2): exportação para GLB, materiais PBR (metal/polímero/madeira)
e separação do pente em uma peça própria ("Magazine") nos fuzis, para a animação de recarga.

| Arquivo no jogo | Modelo original |
|---|---|
| weapons/extra/ak47_lowpoly.glb | AssaultRifle_2 (AK-47 anterior, guardada) |
| weapons/rifles/m4a4.glb | AssaultRifle2_2 |
| weapons/rifles/m4a1.glb | AssaultRifle2_2 (mesmo modelo da M4A4) |
| weapons/rifles/aug.glb | Bullpup_1 |
| weapons/pistols/deagle.glb | Pistol_6 |
| weapons/pistols/glock.glb | Pistol_4 |
| weapons/pistols/p250.glb | Pistol_1 |
| weapons/extra/AssaultRifle_1.glb, _3, _4, _5 | variantes de AK guardadas para armas futuras |

## Armas detalhadas — Stein Games (CC0 1.0)
Modelos e texturas PBR de **Stein Games**, licença **CC0 1.0** (uso livre, inclusive comercial; crédito opcional —
ver `weapons/LICENSE_SteinGames.txt`). Convertidos com `scripts/blender/convert_stein_weapons.py`: carregador e ferrolho
separados em peças ("Magazine"/"Slide") para a recarga, texturas RMAO→ORM e normal DirectX→OpenGL.

| Arquivo no jogo | Modelo original |
|---|---|
| weapons/rifles/ak47.glb | SKM_AK47 |
| weapons/smg/mp5.glb | SKM_MP5 |
| weapons/smg/mac10.glb | SKM_Mac10 |
| weapons/snipers/ssg08.glb | SKM_M700 (fuzil de ferrolho, usado como SSG 08) |

## Mapas 3D (public/assets/maps/)
Kit gratuito **"PvP Battle Maps"** da **Shuriken Studio** — https://shuriken.studio/kits/pvp-battle-maps
Licença: https://shuriken.studio/legal/models (uso livre em jogos, inclusive comercial, sem crédito obrigatório;
não é permitido vender ou distribuir os arquivos dos modelos sozinhos ou como pacote de recursos).

Conversão para o jogo (Blender 4.2, script `scripts/blender/convert_maps.py`): escala de 0,35 m por unidade,
malhas unidas por material, portões das bases e portas fechadas removidos, colisão gerada automaticamente
(caixas + colunas para terreno/peças irregulares) e pontos de nascimento extraídos dos marcadores vermelho/azul.

| Arquivo no jogo | Modelo original |
|---|---|
| maps/desert_outpost.glb / .json | desert-outpost-battle-map.glb |
| maps/city_crossroads.glb / .json | city-crossroads-battle-map.glb |
| maps/warehouse_yard.glb / .json | warehouse-yard-arena.glb |
| maps/snowy_bunker.glb / .json | snowy-bunker-battle-map.glb |
| maps/jungle_ruins.glb / .json | jungle-ruins-arena.glb |

## Cosméticos (public/assets/attachments/, public/assets/cosmetics/)
Modelos 3D **originais** do projeto, gerados por código no Blender (`scripts/blender/cosmetic_models.py`):
miras (red dot, holográfica, 4x, red dot de pistola), silenciadores, compensador, empunhaduras, lanternas, laser;
capacetes, máscaras, óculos, fone, mochilas, rádio, joelheiras e bolsa de quadril (encaixados em cada personagem).
Mapas de região das roupas (`characters/*_regions.png`, `_pos.png`, `_nrm.png`) gerados por `scripts/blender/region_maps.py`.
Os 6 modelos de arma simples (M4A4, M4A1, AUG, Glock, Desert Eagle, P250) receberam chanfros, UV e texturas PBR
assadas por `scripts/blender/upgrade_weapon.py`; os originais estão em `art/weapons/originais/`.
