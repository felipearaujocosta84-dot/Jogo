# Peças 3D dos personagens

`<peça>_CT.glb` (soldado) e `<peça>_T.glb` (terrorista): a mesma peça encaixada em cada modelo (medidas da malha).
Cada malha se chama `nome@Osso` — o jogo prende ao osso (Head, Chest, Leg.L/R, UpLeg.R) e ela acompanha as animações.
Material `Paint` recebe a cor da variante (ver `src/cosmetics/Cosmetics.ts`, lista GEAR). Gerado por
`scripts/blender/cosmetic_models.py`. Para trocar por um modelo melhor, mantenha o nome, a origem e os nomes `@Osso`.
