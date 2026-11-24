// =============================================================
// Ambiente da PISTA 1 — Grand International Circuit
// Arquibancadas com público, prédio dos boxes com garagens,
// pit lane, torre de controle, painéis, postes de luz, vegetação
// e colinas no horizonte.
// =============================================================
import { MeshBuilder, Vector3, Matrix, Quaternion, TransformNode, PhysicsAggregate, PhysicsShapeType } from '@babylonjs/core';
import { fbm } from '../../utils/MathUtils.js';
import { GROUP } from '../../core/PhysicsGroups.js';

export function buildCircuitEnvironment(builder) {
  const g = builder.geo;
  const scene = builder.scene;
  const mats = builder.mats;

  builder.buildTerrain({
    margin: 1600,
    material: 'terrainGrass',
    blendStart: 300,
    blendEnd: 1100,
    hillsFn: (x, z) => fbm(x / 700, z / 700, 4, 5) * 140 - 20,
  });

  const root = new TransformNode('circuitEnv', scene);
  root.parent = builder.root;

  // Utilitário: posiciona um objeto ao lado da pista em s (m) com deslocamento lateral
  const place = (mesh, s, lateral, yOff = 0, rotExtra = 0) => {
    const pt = g.pointAt(s, lateral);
    mesh.position.set(pt.p.x, pt.p.y + yOff, pt.p.z);
    mesh.rotation.y = pt.heading + rotExtra;
    mesh.parent = root;
    return mesh;
  };
  const staticCollider = (mesh) => {
    const agg = new PhysicsAggregate(mesh, PhysicsShapeType.BOX, { mass: 0 }, scene);
    agg.shape.filterMembershipMask = GROUP.PROP;
    builder.aggregates.push(agg);
  };

  // ---------- Arquibancadas (lado externo da reta principal) ----------
  const standOffset = g.barrierOffset + 7;
  const standCenters = [-330, -190, 130, 270, 410];
  for (const s0 of standCenters) {
    const len = 120;
    const stand = new TransformNode('grandstand', scene);
    place(stand, s0, standOffset);
    // Degraus com público (rampa inclinada)
    const seats = MeshBuilder.CreateBox('standSeats', { width: 18, height: 0.6, depth: len }, scene);
    seats.rotation.z = 0.5; // degraus sobem afastando-se da pista
    seats.position.set(9.5, 5, 0);
    seats.parent = stand;
    seats.material = mats.get('crowd');
    const sm = seats.material;
    if (sm.diffuseTexture) { sm.diffuseTexture.uScale = 3; sm.diffuseTexture.vScale = 10; }
    const back = MeshBuilder.CreateBox('standBack', { width: 1, height: 13, depth: len }, scene);
    back.position.set(18, 6.5, 0);
    back.parent = stand;
    back.material = mats.get('concrete');
    const base = MeshBuilder.CreateBox('standBase', { width: 18, height: 2.2, depth: len }, scene);
    base.position.set(9, 1.1, 0);
    base.parent = stand;
    base.material = mats.get('concrete');
    const roof = MeshBuilder.CreateBox('standRoof', { width: 22, height: 0.4, depth: len + 4 }, scene);
    roof.position.set(9, 15, 0);
    roof.rotation.z = 0.08;
    roof.parent = stand;
    roof.material = mats.get('darkMetal');
    for (let k = -2; k <= 2; k++) {
      const col = MeshBuilder.CreateCylinder('standCol', { diameter: 0.6, height: 15, tessellation: 8 }, scene);
      col.position.set(18, 7.5, k * (len / 4.4));
      col.parent = stand;
      col.material = mats.get('metal');
    }
    builder.shadowCasters.push(roof, back);
    for (const m of [seats, back, base, roof]) builder.meshes.push(m);
  }

  // ---------- Prédio dos boxes, pit lane e torre (lado interno) ----------
  const pitOffset = -(g.barrierOffset + 1);
  const pitLane = builder.strip('pitLane', pitOffset - 16, pitOffset, 0.02, 16, [[g.wrapIndex(Math.round(-280 / g.spacing)), g.wrapIndex(Math.round(-280 / g.spacing)) + Math.round(460 / g.spacing)]]);
  pitLane.material = mats.get('asphalt');
  builder._register(pitLane);
  const pitBuilding = MeshBuilder.CreateBox('pitBuilding', { width: 16, height: 10, depth: 420 }, scene);
  place(pitBuilding, -60, pitOffset - 26, 5);
  pitBuilding.material = mats.get('garage');
  const pbMat = pitBuilding.material;
  if (pbMat.albedoTexture) { pbMat.albedoTexture.uScale = 1; pbMat.albedoTexture.vScale = 1; }
  // Fachada com garagens (plano voltado para a pista)
  for (let k = 0; k < 7; k++) {
    const facade = MeshBuilder.CreatePlane('pitFacade', { width: 60, height: 10 }, scene);
    place(facade, -60 - 180 + k * 60, pitOffset - 17.95, 5, -Math.PI / 2);
    facade.material = mats.get('garage');
    facade.material.backFaceCulling = false;
    builder.meshes.push(facade);
  }
  staticCollider(pitBuilding);
  builder.meshes.push(pitBuilding);
  builder.shadowCasters.push(pitBuilding);
  const pitRoof = MeshBuilder.CreateBox('pitRoof', { width: 22, height: 0.6, depth: 430 }, scene);
  place(pitRoof, -60, pitOffset - 24, 10.4);
  pitRoof.material = mats.get('darkMetal');
  builder.meshes.push(pitRoof);
  // Torre de controle
  const tower = MeshBuilder.CreateBox('controlTower', { width: 14, height: 34, depth: 14 }, scene);
  place(tower, 160, pitOffset - 30, 17);
  tower.material = mats.get('building');
  staticCollider(tower);
  const towerTop = MeshBuilder.CreateBox('towerTop', { width: 20, height: 6, depth: 20 }, scene);
  place(towerTop, 160, pitOffset - 30, 37);
  towerTop.material = mats.get('glassDark');
  builder.meshes.push(tower, towerTop);
  builder.shadowCasters.push(tower);
  // Paddock (área asfaltada atrás dos boxes)
  const paddock = MeshBuilder.CreateGround('paddock', { width: 90, height: 420 }, scene);
  place(paddock, -60, pitOffset - 80, 0.03);
  paddock.material = mats.get('concrete');
  paddock.receiveShadows = true;
  builder.meshes.push(paddock);
  // Caminhões/trailers no paddock
  const trailer = MeshBuilder.CreateBox('trailer', { width: 3, height: 4, depth: 16 }, scene);
  trailer.material = mats.get('building');
  const tm = [];
  for (let k = 0; k < 10; k++) {
    const pt = g.pointAt(-260 + k * 42, pitOffset - 72);
    tm.push(Matrix.Compose(Vector3.One(), Quaternion.RotationAxis(Vector3.Up(), pt.heading), new Vector3(pt.p.x, pt.p.y + 2, pt.p.z)));
  }
  builder._thin(trailer, tm);

  // ---------- Painéis publicitários fictícios ----------
  const board = MeshBuilder.CreateBox('adBoard', { width: 0.3, height: 3, depth: 14 }, scene);
  board.material = mats.get('wall');
  const bm = [];
  for (let i = 0; i < g.count; i += Math.round(55 / g.spacing)) {
    const smp = g.samples[i];
    if (Math.abs(smp.curvature) > 0.004) continue;
    const pt = g.pointAt(smp.s, -(g.barrierOffset + 2.5) * (i % 2 ? 1 : -1));
    bm.push(Matrix.Compose(Vector3.One(), Quaternion.RotationAxis(Vector3.Up(), pt.heading), new Vector3(pt.p.x, pt.p.y + 2.2, pt.p.z)));
  }
  builder._thin(board, bm);

  // ---------- Postes de luz e vegetação ----------
  builder.buildLightPoles(90, 6);
  const avoidStraight = (x, z) => {
    const pr = g.project({ x, y: 0, z }, -1);
    const sAbs = Math.min(pr.s, g.length - pr.s);
    return sAbs < 480 && Math.abs(pr.lateral) < 140;
  };
  builder.buildTrees({ count: 1100, kind: 'broadleaf', minDist: 16, maxDist: 900, seed: 11, avoid: avoidStraight });
  builder.buildPuddles(50, 7);

  return { root, ambience: 'crowd' };
}
