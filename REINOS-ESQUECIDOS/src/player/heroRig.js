// Auto-rig do herói.
// O modelo "heroi.glb" é uma malha estática (pose em T, sem esqueleto). Aqui criamos um esqueleto
// por código e calculamos os pesos de cada vértice a partir da posição dele (braços, antebraços,
// coxas, canelas, tronco e cabeça). Assim o herói anda, corre, ataca e rola com animação procedural.
import { ImportMeshAsync, Skeleton, Bone, Matrix, TransformNode, Vector3, VertexBuffer, Color3, MeshoptCompression, MeshBuilder, StandardMaterial, Mesh } from '../babylon.js';
import { MODELS } from '../config.js';

export const HERO_HEIGHT = 1.8;

const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Articulações em metros (X = lado direito, Y = cima, Z = frente)
const JOINTS = {
  hips:   { parent: null,    pos: [0, 0.74, 0] },
  spine:  { parent: 'hips',  pos: [0, 0.97, 0] },
  head:   { parent: 'spine', pos: [0, 1.55, 0] },
  armR:   { parent: 'spine', pos: [0.27, 1.40, 0] },
  foreR:  { parent: 'armR',  pos: [0.56, 1.40, 0] },
  armL:   { parent: 'spine', pos: [-0.27, 1.40, 0] },
  foreL:  { parent: 'armL',  pos: [-0.56, 1.40, 0] },
  thighR: { parent: 'hips',  pos: [0.11, 0.74, 0] },
  shinR:  { parent: 'thighR', pos: [0.11, 0.38, 0] },
  thighL: { parent: 'hips',  pos: [-0.11, 0.74, 0] },
  shinL:  { parent: 'thighL', pos: [-0.11, 0.38, 0] }
};
export const JOINT_NAMES = Object.keys(JOINTS);

/**
 * Carrega o GLB do herói, normaliza (1,8 m, frente = +Z, pés em y=0) e aplica o esqueleto.
 * @returns {{ root: TransformNode, mesh: Mesh, nodes: Record<string, TransformNode> }}
 */
export async function loadHero(scene, name = 'hero') {
  MeshoptCompression.Configuration = { decoder: { url: './libs/meshopt_decoder.js' } };
  const res = await ImportMeshAsync(MODELS.hero, scene);
  const mesh = res.meshes.find((m) => m.getTotalVertices && m.getTotalVertices() > 0);
  mesh.setParent(null);
  mesh.bakeCurrentTransformIntoVertices();
  for (const m of res.meshes) if (m !== mesh) m.dispose();

  // Mede a malha para normalizar
  mesh.refreshBoundingInfo();
  const bb = mesh.getBoundingInfo().boundingBox;
  const h = bb.maximumWorld.y - bb.minimumWorld.y;
  const s = HERO_HEIGHT / h;
  // Após o "bake" do nó raiz do glTF, a frente do modelo fica em -X; giramos para +Z.
  const m = Matrix.Scaling(s, s, s)
    .multiply(Matrix.Translation(0, -bb.minimumWorld.y * s, 0))
    .multiply(Matrix.RotationY(Math.PI / 2));
  mesh.bakeTransformIntoVertices(m);
  mesh.refreshBoundingInfo();
  return rigHero(scene, mesh, name);
}

export function rigHero(scene, mesh, name) {
  const root = new TransformNode(name + 'Root', scene);
  const model = new TransformNode(name + 'Model', scene);
  model.parent = root;
  mesh.parent = model;
  mesh.name = name + 'Mesh';

  const skel = new Skeleton(name + 'Skel', name + 'Skel', scene);
  const bones = {}, nodes = {};
  for (const [jn, j] of Object.entries(JOINTS)) {
    const pp = j.parent ? JOINTS[j.parent].pos : [0, 0, 0];
    const local = new Vector3(j.pos[0] - pp[0], j.pos[1] - pp[1], j.pos[2] - pp[2]);
    const bone = new Bone(jn, skel, j.parent ? bones[j.parent] : null, Matrix.Translation(local.x, local.y, local.z));
    const node = new TransformNode(name + '_' + jn, scene);
    node.parent = j.parent ? nodes[j.parent] : model;
    node.position.copyFrom(local);
    bone.linkTransformNode(node);
    bones[jn] = bone;
    nodes[jn] = node;
  }
  const idx = {};
  JOINT_NAMES.forEach((n, i) => (idx[n] = i));

  const pos = mesh.getVerticesData(VertexBuffer.PositionKind);
  const n = pos.length / 3;
  const mi = new Float32Array(n * 4);
  const mw = new Float32Array(n * 4);
  const H = HERO_HEIGHT;
  for (let v = 0; v < n; v++) {
    // coordenadas normalizadas (altura 1, centro no meio) usadas na análise da malha
    const lz = pos[v * 3] / H, ly = pos[v * 3 + 1] / H - 0.5, lx = pos[v * 3 + 2] / H;
    const az = Math.abs(lz);
    const right = lz > 0;
    const w = {};
    const add = (k, val) => { if (val > 0.001) w[k] = (w[k] || 0) + val; };

    const wArm = smooth(0.135, 0.2, az) * smooth(0.14, 0.2, ly);
    const wFore = smooth(0.27, 0.34, az);
    add(right ? 'armR' : 'armL', wArm * (1 - wFore));
    add(right ? 'foreR' : 'foreL', wArm * wFore);

    const cape = smooth(-0.075, -0.035, lx);
    const wLeg = smooth(-0.05, -0.17, ly) * cape * (1 - wArm);
    const wShin = smooth(-0.26, -0.33, ly);
    const sR = smooth(-0.03, 0.03, lz);
    add('thighR', wLeg * sR * (1 - wShin));
    add('shinR', wLeg * sR * wShin);
    add('thighL', wLeg * (1 - sR) * (1 - wShin));
    add('shinL', wLeg * (1 - sR) * wShin);

    const rest = Math.max(0, 1 - wArm - wLeg);
    const wHead = smooth(0.335, 0.375, ly) * smooth(0.12, 0.08, az);
    const wSpine = smooth(-0.07, 0.06, ly);
    add('head', rest * wHead);
    add('spine', rest * (1 - wHead) * wSpine);
    add('hips', rest * (1 - wHead) * (1 - wSpine));

    const list = Object.entries(w).sort((a, b) => b[1] - a[1]).slice(0, 4);
    let sum = 0;
    for (const [, val] of list) sum += val;
    for (let k = 0; k < 4; k++) {
      if (k < list.length) {
        mi[v * 4 + k] = idx[list[k][0]];
        mw[v * 4 + k] = list[k][1] / sum;
      } else {
        mi[v * 4 + k] = 0;
        mw[v * 4 + k] = 0;
      }
    }
  }
  mesh.setVerticesData(VertexBuffer.MatricesIndicesKind, mi, false);
  mesh.setVerticesData(VertexBuffer.MatricesWeightsKind, mw, false);
  mesh.numBoneInfluencers = 4;
  mesh.skeleton = skel;
  mesh.computeBonesUsingShaders = true;
  mesh.alwaysSelectAsActiveMesh = true; // a caixa de colisão da malha não acompanha os ossos
  if (mesh.material) {
    mesh.material.specularColor = new Color3(0.15, 0.15, 0.15);
  }
  return { root, model, mesh, nodes, skeleton: skel };
}

/** Espada procedural (lâmina, guarda, cabo e pomo) — presa na mão direita. */
export function createSword(scene, name = 'sword') {
  const parts = [];
  const blade = MeshBuilder.CreateBox('blade', { width: 0.06, height: 0.018, depth: 0.82 }, scene);
  blade.position.z = 0.53;
  const tip = MeshBuilder.CreateCylinder('tip', { diameterTop: 0, diameterBottom: 0.085, height: 0.14, tessellation: 4 }, scene);
  tip.rotation.x = Math.PI / 2;
  tip.scaling.x = 0.25;
  tip.position.z = 1.0;
  const guard = MeshBuilder.CreateBox('guard', { width: 0.26, height: 0.04, depth: 0.05 }, scene);
  guard.position.z = 0.11;
  const grip = MeshBuilder.CreateCylinder('grip', { diameter: 0.04, height: 0.2, tessellation: 6 }, scene);
  grip.rotation.x = Math.PI / 2;
  grip.position.z = 0.0;
  const pommel = MeshBuilder.CreateSphere('pommel', { diameter: 0.07, segments: 4 }, scene);
  pommel.position.z = -0.11;
  const metal = new StandardMaterial(name + 'Metal', scene);
  metal.diffuseColor = new Color3(0.72, 0.74, 0.78);
  metal.specularColor = new Color3(0.9, 0.9, 0.9);
  metal.specularPower = 64;
  const leather = new StandardMaterial(name + 'Leather', scene);
  leather.diffuseColor = new Color3(0.3, 0.18, 0.1);
  leather.specularColor = new Color3(0.05, 0.05, 0.05);
  const bladeMesh = Mesh.MergeMeshes([blade, tip], true);
  bladeMesh.material = metal;
  const hilt = Mesh.MergeMeshes([guard, grip, pommel], true);
  hilt.material = leather;
  const root = new TransformNode(name, scene);
  bladeMesh.parent = root;
  hilt.parent = root;
  parts.push(bladeMesh, hilt);
  return { root, blade: bladeMesh, hilt, metal, parts };
}
