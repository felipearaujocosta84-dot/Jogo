// Personagem humano provisório gerado por código.
// É uma malha ÚNICA com esqueleto de verdade (skinning), igual a um modelo GLB rigado:
// 1 draw call por jogador e o mesmo sistema de ossos que os modelos definitivos usarão.
import {
  MeshBuilder, Mesh, VertexData, StandardMaterial, Color3, Vector3, Matrix,
  Skeleton, Bone, TransformNode
} from '../babylon.js';

// Ossos: nome, pai, posição local (em relação ao pai) na pose de ligação (bind pose, de pé, braços abaixados)
// Personagem olha para +Z local.
const BONES = [
  ['root', null, [0, 0, 0]],
  ['hips', 'root', [0, 0.97, 0]],
  ['spine', 'hips', [0, 0.14, 0]],
  ['chest', 'spine', [0, 0.2, 0]],
  ['head', 'chest', [0, 0.25, 0]],
  ['upperArmL', 'chest', [0.2, 0.14, 0]],
  ['foreArmL', 'upperArmL', [0.02, -0.28, 0]],
  ['upperArmR', 'chest', [-0.2, 0.14, 0]],
  ['foreArmR', 'upperArmR', [-0.02, -0.28, 0]],
  ['thighL', 'hips', [0.1, -0.05, 0]],
  ['shinL', 'thighL', [0, -0.43, 0]],
  ['footL', 'shinL', [0, -0.42, 0]],
  ['thighR', 'hips', [-0.1, -0.05, 0]],
  ['shinR', 'thighR', [0, -0.43, 0]],
  ['footR', 'shinR', [0, -0.42, 0]]
];

export const BONE_NAMES = BONES.map((b) => b[0]);

function c3(hex) {
  return Color3.FromHexString(hex);
}

/**
 * @param {object} look { jersey, jerseyDark, shorts, socks, boots, skin, hair, hairStyle, gloves, height, build }
 */
export function buildProceduralHumanoid(scene, name, look) {
  // posições absolutas dos ossos na pose de ligação
  const abs = {};
  for (const [bn, parent, p] of BONES) {
    const base = parent ? abs[parent] : new Vector3(0, 0, 0);
    abs[bn] = base.add(new Vector3(p[0], p[1], p[2]));
  }
  const boneIndex = Object.fromEntries(BONES.map((b, i) => [b[0], i]));
  const parts = [];

  /**
   * Converte uma peça em dados de vértice com cor e pesos de osso.
   * @param bone nome do osso OU função (x,y,z) => [[osso, peso], ...] para pele suavizada
   * @param color cor OU função (x,y,z) => Color3
   * @param shapeFn ajuste opcional de forma por vértice (x,y,z) => [x,y,z]
   */
  const add = (mesh, bone, color, gradient = 0, shapeFn = null) => {
    mesh.bakeCurrentTransformIntoVertices();
    const vd = VertexData.ExtractFromMesh(mesh, true, true);
    mesh.dispose();
    const n = vd.positions.length / 3;
    const colors = new Float32Array(n * 4);
    const mi = new Float32Array(n * 4);
    const mw = new Float32Array(n * 4);
    const fixed = typeof color === 'string' ? c3(color) : null;
    for (let i = 0; i < n; i++) {
      let x = vd.positions[i * 3], y = vd.positions[i * 3 + 1], z = vd.positions[i * 3 + 2];
      if (shapeFn) {
        [x, y, z] = shapeFn(x, y, z);
        vd.positions[i * 3] = x; vd.positions[i * 3 + 1] = y; vd.positions[i * 3 + 2] = z;
      }
      const col = fixed || color(x, y, z);
      const ref = typeof bone === 'string' ? abs[bone].y : y;
      // leve escurecimento para baixo (oclusão falsa) para dar volume
      const shade = gradient ? 1 - gradient * Math.max(0, Math.min(1, (ref + 0.15 - y) / 0.4)) : 1;
      colors[i * 4] = col.r * shade;
      colors[i * 4 + 1] = col.g * shade;
      colors[i * 4 + 2] = col.b * shade;
      colors[i * 4 + 3] = 1;
      if (typeof bone === 'string') {
        mi[i * 4] = boneIndex[bone];
        mw[i * 4] = 1;
      } else {
        const ws = bone(x, y, z);
        ws.forEach(([b, w], k) => { mi[i * 4 + k] = boneIndex[b]; mw[i * 4 + k] = w; });
      }
    }
    vd.colors = colors;
    vd.matricesIndices = mi;
    vd.matricesWeights = mw;
    if (shapeFn) {
      const normals = [];
      VertexData.ComputeNormals(vd.positions, vd.indices, normals);
      vd.normals = normals;
    }
    parts.push(vd);
  };

  const capsule = (radius, height, pos, scale = [1, 1, 1], rotX = 0, tess = 10) => {
    // altura precisa ser maior que 2x o raio (senão o trecho cilíndrico some e as normais ficam inválidas)
    height = Math.max(height, radius * 2 + 0.04);
    const m = MeshBuilder.CreateCapsule('c', { radius, height, tessellation: tess, subdivisions: 1, capSubdivisions: 3 }, scene);
    m.scaling.set(scale[0], scale[1], scale[2]);
    m.rotation.x = rotX;
    m.position.copyFrom(pos);
    return m;
  };
  const sphere = (diameter, pos, scale = [1, 1, 1], slice = 1) => {
    const m = MeshBuilder.CreateSphere('s', { diameter, segments: 8, slice }, scene);
    m.scaling.set(scale[0], scale[1], scale[2]);
    m.position.copyFrom(pos);
    return m;
  };
  const box = (w, h, d, pos) => {
    const m = MeshBuilder.CreateBox('b', { width: w, height: h, depth: d }, scene);
    m.position.copyFrom(pos);
    return m;
  };
  const mid = (a, b) => abs[a].add(abs[b]).scale(0.5);
  const v = (x, y, z) => new Vector3(x, y, z);
  const build = look.build || 1; // 0.9 magro .. 1.15 forte

  // tronco: uma peça contínua (shorts + camisa) com pesos suavizados entre quadril, coluna e peito
  const smoothstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const yHips = abs.hips.y, ySpine = abs.spine.y, yChest = abs.chest.y;
  const torsoWeights = (x, y) => {
    if (y < ySpine) {
      const t = smoothstep(ySpine - 0.1, ySpine + 0.04, y);
      return [['hips', 1 - t], ['spine', t]];
    }
    const t = smoothstep(yChest - 0.08, yChest + 0.06, y);
    return [['spine', 1 - t], ['chest', t]];
  };
  const shortsTop = yHips + 0.07;
  const jersey = c3(look.jersey), shorts = c3(look.shorts);
  const torsoColor = (x, y) => (y < shortsTop ? shorts : jersey);
  const torsoTop = yChest + 0.26, torsoBottom = yHips - 0.14;
  const torso = capsule(0.17, torsoTop - torsoBottom, v(0, (torsoTop + torsoBottom) / 2, 0), [1.12 * build, 1, 0.72 * build], 0, 12);
  // forma em "V": ombros mais largos que a cintura, peito levemente projetado
  const torsoShape = (x, y, z) => {
    const k = 0.9 + 0.16 * smoothstep(yHips + 0.1, yChest + 0.1, y) - 0.04 * smoothstep(yChest + 0.15, torsoTop, y);
    const chest = 1 + 0.08 * smoothstep(yChest - 0.1, yChest + 0.05, y) * (z > 0 ? 1 : 0.4);
    return [x * k, y, z * chest];
  };
  // a faixa de transição recebe 2 ossos; numBoneInfluencers = 2
  add(torso, torsoWeights, torsoColor, 0, torsoShape);
  // gola / ombros
  const collar = capsule(0.075, 0.5 * build, v(0, abs.chest.y + 0.15, 0), [1, 1, 0.95]);
  collar.rotation.z = Math.PI / 2;
  add(collar, 'chest', look.jerseyDark);
  // pescoço e cabeça
  add(capsule(0.05, 0.14, v(0, abs.head.y - 0.02, 0)), 'head', look.skin);
  add(sphere(0.22, v(0, abs.head.y + 0.12, 0.005), [0.92, 1.08, 1]), 'head', look.skin);
  // nariz e orelhas (pequenos detalhes que dão leitura humana)
  add(sphere(0.04, v(0, abs.head.y + 0.11, 0.1), [0.7, 1, 1]), 'head', look.skin);
  add(sphere(0.045, v(0.1, abs.head.y + 0.12, 0), [0.5, 1, 0.8]), 'head', look.skin);
  add(sphere(0.045, v(-0.1, abs.head.y + 0.12, 0), [0.5, 1, 0.8]), 'head', look.skin);
  // cabelo
  if (look.hairStyle !== 'bald') {
    const hs = look.hairStyle === 'afro' ? 1.2 : 1.0;
    add(sphere(0.235 * hs, v(0, abs.head.y + 0.15 + (hs - 1) * 0.05, -0.012), [0.95, 0.85, 1.02], 0.55), 'head', look.hair);
  }
  // olhos
  add(sphere(0.025, v(0.038, abs.head.y + 0.14, 0.095)), 'head', '#1a1a1a');
  add(sphere(0.025, v(-0.038, abs.head.y + 0.14, 0.095)), 'head', '#1a1a1a');

  // braços
  for (const s of ['L', 'R']) {
    const ua = 'upperArm' + s, fa = 'foreArm' + s;
    add(capsule(0.062 * build, 0.3, mid(ua, fa).add(v(0, 0.02, 0))), ua, look.jersey);
    add(capsule(0.048, 0.28, abs[fa].add(v(0, -0.13, 0))), fa, look.skin);
    add(sphere(0.1, abs[fa].add(v(0, -0.29, 0.01)), [0.8, 1, 0.9]), fa, look.gloves || look.skin);
  }
  // pernas
  for (const s of ['L', 'R']) {
    const th = 'thigh' + s, sh = 'shin' + s, ft = 'foot' + s;
    add(capsule(0.085 * build, 0.3, abs[th].add(v(0, -0.12, 0))), th, look.shorts, 0.15);
    add(capsule(0.068, 0.3, abs[th].add(v(0, -0.3, 0)), [1, 1, 1]), th, look.skin);
    add(capsule(0.06, 0.36, abs[sh].add(v(0, -0.2, -0.01))), sh, look.socks);
    // chuteira
    add(capsule(0.055, 0.27, abs[ft].add(v(0, 0.035, 0.05)), [1, 1, 1], Math.PI / 2), ft, look.boots);
  }

  const vd = parts.shift();
  vd.merge(parts, true);
  const mesh = new Mesh(name, scene);
  vd.applyToMesh(mesh, false);

  // esqueleto
  const skeleton = new Skeleton(name + 'Skel', name + 'Skel', scene);
  // poucos ossos: matrizes como uniforms (mais compatível com celulares do que textura de ossos)
  skeleton.useTextureToStoreBoneMatrices = false;
  const bones = {};
  const nodes = {};
  for (const [bn, parent, p] of BONES) {
    const local = Matrix.Translation(p[0], p[1], p[2]);
    const bone = new Bone(bn, skeleton, parent ? bones[parent] : null, local);
    const node = new TransformNode(name + '_' + bn, scene);
    node.position.set(p[0], p[1], p[2]);
    node.rotationQuaternion = null;
    node.parent = parent ? nodes[parent] : mesh;
    bone.linkTransformNode(node);
    bones[bn] = bone;
    nodes[bn] = node;
  }
  mesh.skeleton = skeleton;
  mesh.numBoneInfluencers = 2;

  return { mesh, skeleton, nodes };
}

let sharedMaterial = null;
/** Material compartilhado (cores vêm dos vértices). */
export function getHumanoidMaterial(scene) {
  if (sharedMaterial && sharedMaterial.getScene() === scene) return sharedMaterial;
  const m = new StandardMaterial('humanoidMat', scene);
  m.diffuseColor = new Color3(1, 1, 1);
  m.specularColor = new Color3(0.12, 0.12, 0.12);
  m.specularPower = 20;
  m.emissiveColor = new Color3(0.08, 0.08, 0.09);
  sharedMaterial = m;
  return m;
}

