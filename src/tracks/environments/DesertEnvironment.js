// =============================================================
// Ambiente da PISTA 3 — Desert Speedway
// Dunas, montanhas áridas e mesas rochosas, complexo de largada
// (arquibancadas, boxes e torre), cânion de arenito, ponte sobre
// leito seco, arco de pedra, oásis com lagoa e palmeiras, cactos
// e miragens no asfalto quente.
// =============================================================
import { Mesh, MeshBuilder, Vector3, Matrix, Quaternion, TransformNode, PhysicsAggregate, PhysicsShapeType } from '@babylonjs/core';
import { fbm, smoothStep, mulberry32 } from '../../utils/MathUtils.js';
import { GROUP } from '../../core/PhysicsGroups.js';

/** Centro do oásis no mundo (definido na pista por s, lado e distância). */
export function oasisCenter(geo, f) {
  const pt = geo.pointAt(f.at, f.side * (geo.barrierOffset + f.distance));
  return { x: pt.p.x, z: pt.p.z, heading: pt.heading };
}

export function buildDesertEnvironment(builder) {
  const g = builder.geo;
  const scene = builder.scene;
  const mats = builder.mats;
  const oasis = g.def.features?.find((f) => f.type === 'oasis');
  const oc = oasis ? oasisCenter(g, oasis) : null;

  builder.buildTerrain({
    margin: 2000,
    material: 'terrainSand',
    blendStart: 30,
    blendEnd: 700,
    hillsFn: (x, z) => {
      const dunes = Math.pow(Math.abs(Math.sin(x / 90 + fbm(x / 300, z / 300, 2, 8) * 6)), 2) * 14;
      return dunes + fbm(x / 900, z / 900, 4, 31) * 220 - 40;
    },
    // Depressão do oásis (bacia com lagoa no centro)
    extraFn: oc ? (x, z) => {
      const d = Math.hypot(x - oc.x, z - oc.z);
      return -7 * (1 - smoothStep(oasis.radius * 0.4, oasis.radius * 1.6, d));
    } : null,
  });

  const root = new TransformNode('desertEnv', scene);
  root.parent = builder.root;
  const place = (mesh, s, lateral, yOff = 0) => {
    const pt = g.pointAt(s, lateral);
    mesh.position.set(pt.p.x, pt.p.y + yOff, pt.p.z);
    mesh.rotation.y = pt.heading;
    mesh.parent = root;
    builder.meshes.push(mesh);
    return mesh;
  };
  const collider = (mesh) => {
    const agg = new PhysicsAggregate(mesh, PhysicsShapeType.BOX, { mass: 0 }, scene);
    agg.shape.filterMembershipMask = GROUP.PROP;
    builder.aggregates.push(agg);
  };

  // ---------- Complexo de largada ----------
  const standOff = g.barrierOffset + 6;
  for (const s0 of [-160, 140]) {
    const stand = new TransformNode('desertStand', scene);
    place(stand, s0, standOff);
    const seats = MeshBuilder.CreateBox('dStandSeats', { width: 14, height: 0.6, depth: 110 }, scene);
    seats.rotation.z = 0.5;
    seats.position.set(7.5, 4, 0);
    seats.parent = stand;
    seats.material = mats.get('crowd');
    const base = MeshBuilder.CreateBox('dStandBase', { width: 14, height: 1.8, depth: 110 }, scene);
    base.position.set(7, 0.9, 0);
    base.parent = stand;
    base.material = mats.get('concrete');
    const shade = MeshBuilder.CreateBox('dStandShade', { width: 18, height: 0.3, depth: 114 }, scene);
    shade.position.set(8, 12, 0);
    shade.rotation.z = 0.06;
    shade.parent = stand;
    shade.material = mats.get('darkMetal');
    for (const m of [seats, base, shade]) builder.meshes.push(m);
    builder.shadowCasters.push(shade);
  }
  const pitOff = -(g.barrierOffset + 18);
  const pits = MeshBuilder.CreateBox('desertPits', { width: 16, height: 8, depth: 260 }, scene);
  place(pits, -20, pitOff, 4);
  pits.material = mats.get('garage');
  collider(pits);
  builder.shadowCasters.push(pits);
  const tower = MeshBuilder.CreateBox('desertTower', { width: 12, height: 28, depth: 12 }, scene);
  place(tower, 150, pitOff - 6, 14);
  tower.material = mats.get('building2');
  collider(tower);
  const towerTop = MeshBuilder.CreateBox('desertTowerTop', { width: 17, height: 5, depth: 17 }, scene);
  place(towerTop, 150, pitOff - 6, 30.5);
  towerTop.material = mats.get('glassDark');
  const apron = builder.strip('desertApron', pitOff - 10, -(g.barrierOffset + 1), 0.02, 16,
    [[g.wrapIndex(Math.round(-160 / g.spacing)), g.wrapIndex(Math.round(-160 / g.spacing)) + Math.round(290 / g.spacing)]]);
  apron.material = mats.get('concrete');
  builder._register(apron);

  // ---------- Trechos especiais (cânion, ponte, miragens) ----------
  builder.buildFeatures();

  // ---------- Arco de pedra (marco visual na saída do cânion) ----------
  const gorge = g.featuresOf('gorge')[0];
  if (gorge) {
    const a = g.pointAt(gorge.to + 120, -(g.barrierOffset + 70));
    const near = g.distanceToCenter(a.p.x, a.p.z);
    if (near.distance > g.barrierOffset + 40) {
      const ground = builder.terrainHeight(a.p.x, a.p.z);
      const path = [];
      for (let k = 0; k <= 20; k++) {
        const t = Math.PI * (k / 20);
        const lx = Math.cos(t) * 26, ly = Math.sin(t) * 30;
        path.push(new Vector3(a.p.x + a.t.x * lx, ground - 4 + ly, a.p.z + a.t.z * lx));
      }
      const arch = MeshBuilder.CreateTube('rockArch', { path, radius: 6.5, tessellation: 9, cap: 3 }, scene);
      arch.material = mats.get('sandstone');
      arch.parent = root;
      builder.meshes.push(arch);
      builder.shadowCasters.push(arch);
    }
  }

  // ---------- Oásis ----------
  if (oc) {
    const R = oasis.radius;
    const bottom = builder.terrainHeight(oc.x, oc.z);
    const lake = MeshBuilder.CreateDisc('oasisLake', { radius: R * 0.62, tessellation: 40 }, scene);
    lake.rotation.x = Math.PI / 2;
    lake.position.set(oc.x, bottom + 3.2, oc.z);
    lake.material = mats.get('water');
    lake.parent = root;
    builder.meshes.push(lake);
    const rnd = mulberry32(77);
    const palm = MeshBuilder.CreateCylinder('oasisPalmTrunk', { diameterTop: 0.28, diameterBottom: 0.45, height: 8, tessellation: 6 }, scene);
    palm.position.y = 4;
    palm.material = mats.get('trunk');
    const crown = MeshBuilder.CreateCylinder('oasisPalmCrown', { diameterTop: 5.5, diameterBottom: 0.4, height: 1.4, tessellation: 7 }, scene);
    crown.position.y = 8.3;
    crown.material = mats.get('foliage');
    const merged = Mesh.MergeMeshes([palm, crown], true, true, undefined, false, true);
    merged.name = 'oasisPalm';
    const pm = [];
    const bush = MeshBuilder.CreateIcoSphere('oasisBush', { radius: 1.6, subdivisions: 1 }, scene);
    bush.material = mats.get('foliage');
    const bm = [];
    for (let i = 0; i < 46; i++) {
      const ang = rnd() * Math.PI * 2;
      const r = R * (0.68 + rnd() * 0.7);
      const x = oc.x + Math.cos(ang) * r, z = oc.z + Math.sin(ang) * r;
      const y = builder.terrainHeight(x, z);
      const sc = 0.8 + rnd() * 0.5;
      pm.push(Matrix.Compose(new Vector3(sc, sc * (0.9 + rnd() * 0.3), sc), Quaternion.RotationYawPitchRoll(rnd() * 6, (rnd() - 0.5) * 0.25, (rnd() - 0.5) * 0.25), new Vector3(x, y - 0.3, z)));
      if (i % 2 === 0) bm.push(Matrix.Compose(new Vector3(1 + rnd(), 0.6 + rnd() * 0.4, 1 + rnd()), Quaternion.Identity(), new Vector3(x + 3, y + 0.4, z + 2)));
    }
    builder._thin(merged, pm);
    builder._thin(bush, bm);
    builder.oasis = { x: oc.x, z: oc.z, radius: R };
  }

  // ---------- Mesas rochosas, cactos e postes ----------
  const mesa = MeshBuilder.CreateCylinder('mesa', { diameterTop: 120, diameterBottom: 160, height: 90, tessellation: 10 }, scene);
  mesa.material = mats.get('sandstone');
  const spots = builder.scatter(26, { minDist: 260, maxDist: 1600, seed: 41, avoid: oc ? (x, z) => Math.hypot(x - oc.x, z - oc.z) < 200 : null });
  builder._thin(mesa, spots.map((s) => Matrix.Compose(new Vector3(0.5 + s.r, 0.6 + s.r * 0.9, 0.5 + s.r), Quaternion.RotationAxis(Vector3.Up(), s.r * 6), new Vector3(s.x, s.y + 30, s.z))));
  builder.buildTrees({ count: 700, kind: 'cactus', minDist: 10, maxDist: 600, seed: 17, avoid: oc ? (x, z) => Math.hypot(x - oc.x, z - oc.z) < oasis.radius * 1.6 : null });
  builder.buildLightPoles(140, 6);
  return { ambience: 'wind' };

}
