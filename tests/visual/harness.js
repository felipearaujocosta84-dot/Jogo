// Verificação visual automática (roda no GitHub Actions com Chrome sem tela).
// Monta o carro GLB realista como no jogo e tira fotos de vários ângulos.
import {
  Engine, Scene, ArcRotateCamera, Vector3, HemisphericLight, DirectionalLight, MeshBuilder,
  PBRMaterial, Color3, Color4, CubeTexture, ShadowGenerator, Tools,
} from '@babylonjs/core';
import { createCarMaterials, loadCarModel } from '../../src/vehicles/CarModelFactory.js';
import { getCar } from '../../src/vehicles/VehicleCatalog.js';

const out = { log: [] };
window.__out = out;
const log = (...a) => { out.log.push(a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ')); };

async function main() {
  const canvas = document.getElementById('c');
  const engine = new Engine(canvas, true, { preserveDrawingBuffer: true });
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.55, 0.62, 0.7, 1);
  const hemi = new HemisphericLight('h', new Vector3(0, 1, 0), scene);
  hemi.intensity = 0.6;
  const sun = new DirectionalLight('s', new Vector3(-0.5, -1, 0.35), scene);
  sun.position = new Vector3(10, 20, -10);
  sun.intensity = 2.2;
  const env = scene.createDefaultEnvironment({ createGround: false, createSkybox: false });
  const ground = MeshBuilder.CreateGround('g', { width: 40, height: 40 }, scene);
  const gm = new PBRMaterial('gm', scene); gm.albedoColor = new Color3(0.25, 0.25, 0.27); gm.roughness = 0.9; gm.metallic = 0;
  ground.material = gm; ground.receiveShadows = true;
  const sg = new ShadowGenerator(1024, sun);
  const cam = new ArcRotateCamera('cam', 0, 1.2, 7, new Vector3(0, 0.6, 0), scene);

  log('cena pronta');
  const spec = getCar('vortex') ?? getCar(undefined);
  const cars = [];
  for (const [detail, x, color] of [['full', -1.6, '#1d4ed8'], ['lite', 1.6, '#f2b705']]) {
    const mats = createCarMaterials(scene, { paint: color, rim: '#2b2b2b' }, 'metallic');
    const t0 = performance.now();
    log(detail, 'carregando...');
    const model = await loadCarModel(scene, spec, mats, { detail });
    log(detail, 'source', model.source, 'ms', Math.round(performance.now() - t0));
    model.root.position.x = x;
    // Mesma convenção do jogo: pivô em y = raio
    for (const [k, w] of Object.entries(model.wheels)) {
      log(detail, 'wheel', k, w.pivot.position.asArray().map((v) => +v.toFixed(3)));
      if (k[0] === 'F') w.pivot.rotation.y = 0.35;
      w.spin.rotation.x = 1.0;
    }
    let tris = 0, meshes = 0;
    for (const m of model.root.getChildMeshes(false)) {
      if (!m.isEnabled() || !m.isVisible || !m.getTotalIndices) continue;
      meshes++; tris += (m.getTotalIndices() || 0) / 3;
      sg.addShadowCaster(m, false);
    }
    log(detail, 'meshes', meshes, 'tris', Math.round(tris), 'eye', model.driverEye.asArray().map((v) => +v.toFixed(2)));
    log(detail, 'mats', Object.fromEntries(Object.entries(model.materials).map(([k, m]) => [k, m?.name])));
    scene.meshes.forEach((m) => { m.computeWorldMatrix(true); });
    const bb = model.root.getHierarchyBoundingVectors(true);
    log(detail, 'bbox min', bb.min.asArray().map((v) => +v.toFixed(2)), 'max', bb.max.asArray().map((v) => +v.toFixed(2)));
    cars.push(model);
  }
  log('compilando shaders...');
  await scene.whenReadyAsync();
  log('pronto para fotos');
  const shots = [
    ['frente34', -0.6, 1.25, 9.5, new Vector3(0, 0.6, 0)],
    ['traseira34', 2.3, 1.25, 9.5, new Vector3(0, 0.6, 0)],
    ['lado', Math.PI, 1.45, 8.5, new Vector3(0, 0.6, 0)],
    ['cima', -0.6, 0.35, 10, new Vector3(0, 0.6, 0)],
    ['roda', -0.9, 1.35, 3.2, new Vector3(-1.6 + 0.8, 0.35, 1.3)],
  ];
  out.shots = {};
  for (const [name, a, b, r, tgt] of shots) {
    cam.alpha = a; cam.beta = b; cam.radius = r; cam.setTarget(tgt);
    for (let i = 0; i < 3; i++) scene.render();
    out.shots[name] = canvas.toDataURL('image/png');
    log('foto', name);
  }
  // Cockpit
  const eye = cars[0].driverEye.add(cars[0].root.position);
  const { UniversalCamera } = await import('@babylonjs/core');
  const ck = new UniversalCamera('ck', eye, scene);
  ck.minZ = 0.03; ck.fov = 1.15;
  ck.setTarget(eye.add(new Vector3(0, -0.08, 3)));
  scene.activeCamera = ck;
  for (let i = 0; i < 3; i++) scene.render();
  out.shots.cockpit = canvas.toDataURL('image/png');
  log('drawCalls', engine._drawCalls?.current ?? 'n/a');
  out.done = true;
}
main().catch((e) => { log('ERRO', String(e?.stack || e)); out.done = true; });
