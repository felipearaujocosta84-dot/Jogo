// =============================================================
// Ambiente da PISTA 2 — Mountain Racing
// Relevo montanhoso, dois túneis, ponte sobre ravina, viaduto sobre
// o vale, desfiladeiro, floresta de pinheiros, rochas e picos nevados.
// =============================================================
import { MeshBuilder, Vector3, Matrix, Quaternion, PBRMaterial, Color3 } from '@babylonjs/core';
import { fbm, mulberry32 } from '../../utils/MathUtils.js';

export function buildMountainEnvironment(builder) {
  const g = builder.geo;
  const scene = builder.scene;
  builder.buildTerrain({
    margin: 1800,
    material: 'terrainGrass',
    blendStart: 20,
    blendEnd: 500,
    hillsFn: (x, z, info) => {
      const ridge = Math.abs(fbm(x / 500, z / 500, 5, 21) - 0.5) * 2;
      return (1 - ridge) * 260 + fbm(x / 120, z / 120, 3, 4) * 30 - 60 * Math.exp(-info.distance / 250);
    },
  });
  builder.buildFeatures();
  builder.buildLightPoles(160, 3);
  // Rochas
  const rock = MeshBuilder.CreateIcoSphere('rock', { radius: 2.5, subdivisions: 1, flat: true }, scene);
  rock.material = builder.mats.get('rock');
  const spots = builder.scatter(Math.round(350 * (builder.preset?.vegetation ?? 1)), { minDist: 6, maxDist: 500, seed: 77 });
  builder._thin(rock, spots.map((s) => Matrix.Compose(new Vector3(0.6 + s.r * 2.2, 0.4 + s.r * 1.4, 0.7 + s.r * 1.8), Quaternion.RotationYawPitchRoll(s.r * 6, s.r, 0), new Vector3(s.x, s.y, s.z))));
  // Picos nevados distantes
  const b = g.bounds();
  const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
  const snow = new PBRMaterial('snowPeak', scene);
  snow.albedoColor = new Color3(0.78, 0.8, 0.84);
  snow.roughness = 0.8; snow.metallic = 0;
  const peak = MeshBuilder.CreateCylinder('peak', { diameterTop: 0, diameterBottom: 900, height: 700, tessellation: 9 }, scene);
  peak.material = snow;
  const rnd = mulberry32(5);
  const pm = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + rnd() * 0.3;
    const r = 2600 + rnd() * 700;
    const sc = 0.7 + rnd() * 0.8;
    pm.push(Matrix.Compose(new Vector3(sc, sc * (0.8 + rnd() * 0.6), sc), Quaternion.Identity(), new Vector3(cx + Math.cos(a) * r, 150 + 350 * sc, cz + Math.sin(a) * r)));
  }
  builder._thin(peak, pm);
  builder.buildTrees({ count: 2600, kind: 'pine', minDist: 7, maxDist: 700, seed: 13 });
  builder.buildPuddles(30, 3);
  return { ambience: 'forest' };
}
