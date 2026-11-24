// =============================================================
// Ambiente da PISTA 4 — Coastal Racing
// Oceano, baía com ponte estaiada, praia, coqueiros, centro urbano
// com prédios e calçadas, ponte sobre o canal e bairros ao fundo.
// =============================================================
import { MeshBuilder, Vector3, Matrix, Quaternion } from '@babylonjs/core';
import { fbm, lerp, smoothStep } from '../../utils/MathUtils.js';

export function buildCoastalEnvironment(builder) {
  const g = builder.geo;
  const scene = builder.scene;
  const b = g.bounds();
  const coastZ = b.minZ - 90; // linha da costa ao sul do traçado
  builder.buildTerrain({
    margin: 1600,
    material: 'terrainGrass',
    blendStart: 25,
    blendEnd: 260,
    hillsFn: (x, z, info) => {
      // Ao sul desce até abaixo do nível do mar; ao norte, colinas
      const sea = -(info.roadY + 4) - Math.max(0, coastZ - z) * 0.08;
      const hills = fbm(x / 500, z / 500, 4, 51) * 120;
      return lerp(sea, hills, smoothStep(coastZ - 20, coastZ + 500, z));
    },
  });
  const cx = (b.minX + b.maxX) / 2;
  // Oceano (cobre todo o mapa; o terreno acima do nível do mar o esconde,
  // e os vales rebaixados sob as pontes viram baía/canal)
  const cz = (b.minZ + b.maxZ) / 2;
  const ocean = MeshBuilder.CreateGround('ocean', { width: 9000, height: 9000 }, scene);
  ocean.position.set(cx, 0.4, cz - 1500);
  ocean.material = builder.mats.get('water');
  builder.meshes.push(ocean);
  ocean.parent = builder.root;
  builder.ocean = ocean;
  // Praia
  const beach = MeshBuilder.CreateGround('beach', { width: 9000, height: 70 }, scene);
  beach.position.set(cx, 0.75, coastZ + 10);
  beach.material = builder.mats.get('beach');
  beach.material.zOffset = -1;
  beach.parent = builder.root;
  builder.meshes.push(beach);
  // Pontes, centro urbano e canal
  builder.buildFeatures();
  // Bairros ao fundo (afastados da pista)
  const block = MeshBuilder.CreateBox('cityBlock', { width: 22, height: 1, depth: 22 }, scene);
  block.material = builder.mats.get('building2');
  const spots = builder.scatter(160, { minDist: 70, maxDist: 520, seed: 61, avoid: (x, z) => z < b.minZ + 250 || builder.terrainHeight(x, z) < 2 });
  builder._thin(block, spots.map((s) => Matrix.Compose(new Vector3(0.7 + s.r * 0.8, 12 + s.r * 60, 0.7 + s.r * 0.8), Quaternion.RotationAxis(Vector3.Up(), Math.round(s.r * 4) * 0.4), new Vector3(s.x, s.y + 6 + s.r * 30, s.z))));
  builder.buildTrees({ count: 600, kind: 'palm', minDist: 8, maxDist: 300, seed: 23, avoid: (x, z) => z > b.minZ + 300 });
  builder.buildLightPoles(70, 4);
  builder.buildPuddles(40, 5);
  return { ambience: 'ocean' };
}
