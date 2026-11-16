#!/bin/sh
# Refaz as 6 armas simples a partir dos originais em art/weapons/originais (ver upgrade_weapon.py).
# Uso: BLENDER_PY=<python com bpy> sh scripts/blender/upgrade_weapons.sh
# (o bpy pode encerrar com falha de segmentação depois de salvar: não interrompe)
PY=${BLENDER_PY:-blender --background --python}
O=art/weapons/originais; D=public/assets/weapons; S=scripts/blender/upgrade_weapon.py
$PY $S -- $O/m4a4.glb $D/rifles/m4a4.glb 1024 Main=anodized MainDark=polymer MainLight=metal
$PY $S -- $O/m4a1.glb $D/rifles/m4a1.glb 1024 Main=anodized MainDark=polymer MainLight=metal
$PY $S -- $O/aug.glb $D/rifles/aug.glb 1024 MainDark=polymer Main=anodized MainLight=metal
$PY $S -- $O/glock.glb $D/pistols/glock.glb 1024 Metal=metal Black=polymer LightMetal=metal_light
$PY $S -- $O/deagle.glb $D/pistols/deagle.glb 1024 Metal=metal Black=rubber LightMetal=metal_light
$PY $S -- $O/p250.glb $D/pistols/p250.glb 1024 DarkWood=wood DarkMetal=metal Metal=metal_light Black=polymer Black2=rubber
