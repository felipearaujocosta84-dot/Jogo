// Modelos procedurais dos inimigos e NPCs (feitos com primitivas + cores por vértice).
// Cada tipo gera "peças-modelo" uma única vez; cada personagem usa INSTÂNCIAS dessas peças,
// presas a articulações (TransformNodes). Resultado: dezenas de inimigos com poucas chamadas de desenho.
import { MeshBuilder, Mesh, StandardMaterial, Color3, Color4, TransformNode, Vector3 } from '../babylon.js';
import { paint } from '../world/regions.js';

let sharedMat = null;
let glowMat = null;
const templates = new Map();

function materials(scene) {
  if (!sharedMat) {
    sharedMat = new StandardMaterial('charMat', scene);
    sharedMat.specularColor = new Color3(0.08, 0.08, 0.08);
    glowMat = new StandardMaterial('glowMat', scene);
    glowMat.disableLighting = true;
    glowMat.emissiveColor = new Color3(1, 1, 1);
  }
  return { sharedMat, glowMat };
}

/** Junta várias primitivas coloridas numa malha-modelo invisível (fonte das instâncias). */
function makePart(scene, name, pieces, glow = false) {
  const meshes = pieces.map(([mesh, color, jitter]) => paint(mesh, color, jitter || 0));
  const m = Mesh.MergeMeshes(meshes, true, true);
  m.name = name;
  const mats = materials(scene);
  m.material = glow ? mats.glowMat : mats.sharedMat;
  m.registerInstancedBuffer('instanceColor', 4);
  m.instancedBuffers.instanceColor = new Color4(1, 1, 1, 1);
  m.isVisible = false;
  m.isPickable = false;
  m.receiveShadows = true;
  return m;
}

const box = (s, o, p = [0, 0, 0], r = [0, 0, 0]) => {
  const m = MeshBuilder.CreateBox('b', o, s);
  m.position.set(...p); m.rotation.set(...r);
  return m;
};
const sph = (s, d, p = [0, 0, 0], sc = [1, 1, 1], seg = 8) => {
  const m = MeshBuilder.CreateSphere('s', { diameter: d, segments: seg }, s);
  m.position.set(...p); m.scaling.set(...sc);
  return m;
};
const cyl = (s, o, p = [0, 0, 0], r = [0, 0, 0]) => {
  const m = MeshBuilder.CreateCylinder('c', { tessellation: 8, ...o }, s);
  m.position.set(...p); m.rotation.set(...r);
  return m;
};

// ------------------------------------------------------------------
// Definições: joints = articulações {nome: [pai, x, y, z]}; parts = [junta, modelo]
// ------------------------------------------------------------------
function buildWolf(s) {
  const fur = [0.4, 0.38, 0.36], dark = [0.22, 0.21, 0.2], light = [0.62, 0.6, 0.56];
  return {
    joints: {
      body: [null, 0, 0.72, 0], head: ['body', 0, 0.12, 0.62], tail: ['body', 0, 0.1, -0.6],
      legFL: ['body', 0.17, -0.05, 0.42], legFR: ['body', -0.17, -0.05, 0.42],
      legBL: ['body', 0.17, -0.02, -0.42], legBR: ['body', -0.17, -0.02, -0.42]
    },
    parts: {
      body: makePart(s, 'wolfBody', [
        [sph(s, 1, [0, 0, 0], [0.48, 0.5, 1.25]), fur, 0.1],
        [sph(s, 1, [0, 0.06, 0.32], [0.55, 0.58, 0.6]), light, 0.05],
        [sph(s, 1, [0, 0.16, -0.05], [0.36, 0.22, 1.0]), dark, 0.1]
      ]),
      head: makePart(s, 'wolfHead', [
        [sph(s, 0.42, [0, 0.05, 0.05], [0.95, 0.9, 1.1]), fur],
        [box(s, { width: 0.18, height: 0.15, depth: 0.32 }, [0, -0.02, 0.3]), light],
        [sph(s, 0.07, [0, 0.0, 0.47]), [0.05, 0.05, 0.05]],
        [cyl(s, { diameterTop: 0, diameterBottom: 0.13, height: 0.2, tessellation: 4 }, [0.11, 0.25, 0.0]), dark],
        [cyl(s, { diameterTop: 0, diameterBottom: 0.13, height: 0.2, tessellation: 4 }, [-0.11, 0.25, 0.0]), dark],
        [sph(s, 0.06, [0.09, 0.1, 0.22]), [0.9, 0.75, 0.2]],
        [sph(s, 0.06, [-0.09, 0.1, 0.22]), [0.9, 0.75, 0.2]]
      ]),
      tail: makePart(s, 'wolfTail', [[cyl(s, { diameterTop: 0.05, diameterBottom: 0.16, height: 0.55 }, [0, -0.12, -0.2], [-0.9, 0, 0]), dark, 0.1]]),
      leg: makePart(s, 'wolfLeg', [
        [cyl(s, { diameterTop: 0.14, diameterBottom: 0.08, height: 0.62 }, [0, -0.32, 0]), fur],
        [sph(s, 0.12, [0, -0.64, 0.04], [1, 0.6, 1.3]), dark]
      ])
    },
    attach: [['body', 'body'], ['head', 'head'], ['tail', 'tail'], ['legFL', 'leg'], ['legFR', 'leg'], ['legBL', 'leg'], ['legBR', 'leg']],
    rig: 'quad'
  };
}

function buildHumanoid(s, key, o) {
  const H = o.height;
  const hipY = H * 0.5, shoulderY = H * 0.8;
  const legLen = hipY, armLen = H * 0.38, w = o.width || 1;
  const parts = {};
  const torsoPieces = o.torso ? o.torso(s, H) : [[box(s, { width: 0.42 * w, height: H * 0.32, depth: 0.24 * w }, [0, H * 0.15, 0]), o.cloth, 0.06]];
  parts.torso = makePart(s, key + 'Torso', torsoPieces);
  parts.head = makePart(s, key + 'Head', o.head(s, H));
  parts.arm = makePart(s, key + 'Arm', o.arm ? o.arm(s, armLen) : [
    [cyl(s, { diameterTop: 0.13 * w, diameterBottom: 0.1 * w, height: armLen }, [0, -armLen / 2, 0]), o.sleeve || o.skin],
    [sph(s, 0.12 * w, [0, -armLen, 0]), o.skin]
  ]);
  parts.leg = makePart(s, key + 'Leg', o.leg ? o.leg(s, legLen) : [
    [cyl(s, { diameterTop: 0.17 * w, diameterBottom: 0.12 * w, height: legLen * 0.95 }, [0, -legLen * 0.47, 0]), o.pants || o.skin],
    [box(s, { width: 0.14 * w, height: 0.1, depth: 0.26 * w }, [0, -legLen + 0.05, 0.05]), o.boots || [0.2, 0.15, 0.1]]
  ]);
  if (o.weapon) parts.weapon = makePart(s, key + 'Weapon', o.weapon(s));
  if (o.offhand) parts.offhand = makePart(s, key + 'Off', o.offhand(s));
  if (o.eyes) parts.eyes = makePart(s, key + 'Eyes', o.eyes(s, H), true);
  if (o.extra) parts.extra = makePart(s, key + 'Extra', o.extra(s, H));
  const attach = [['hips', 'torso'], ['head', 'head'], ['armR', 'arm'], ['armL', 'arm'], ['legR', 'leg'], ['legL', 'leg']];
  if (parts.weapon) attach.push(['handR', 'weapon']);
  if (parts.offhand) attach.push(['handL', 'offhand']);
  if (parts.eyes) attach.push(['head', 'eyes']);
  if (parts.extra) attach.push(['hips', 'extra']);
  const sx = 0.27 * w;
  return {
    joints: {
      hips: [null, 0, hipY, 0], head: ['hips', 0, H * 0.33, 0],
      armR: ['hips', sx, shoulderY - hipY, 0], armL: ['hips', -sx, shoulderY - hipY, 0],
      handR: ['armR', 0, -armLen, 0.02], handL: ['armL', 0, -armLen, 0.02],
      legR: ['hips', 0.12 * w, 0, 0], legL: ['hips', -0.12 * w, 0, 0]
    },
    parts, attach, rig: 'biped', height: H
  };
}

function buildGoblin(s) {
  const skin = [0.36, 0.5, 0.24];
  return buildHumanoid(s, 'goblin', {
    height: 1.3, width: 0.9, skin, cloth: [0.4, 0.3, 0.18], pants: [0.32, 0.24, 0.15], boots: [0.22, 0.16, 0.1],
    torso: (s, H) => [
      [sph(s, 0.5, [0, H * 0.14, 0.02], [0.85, 0.95, 0.72]), skin, 0.06],
      [cyl(s, { diameter: 0.4, height: 0.2 }, [0, 0.0, 0]), [0.42, 0.3, 0.16], 0.1],
      [box(s, { width: 0.06, height: 0.4, depth: 0.5 }, [0.12, H * 0.16, 0], [0, 0, 0.5]), [0.3, 0.2, 0.12]]
    ],
    head: (s) => [
      [sph(s, 0.42, [0, 0.12, 0.02], [1, 0.95, 1]), skin, 0.05],
      [cyl(s, { diameterTop: 0.0, diameterBottom: 0.14, height: 0.38, tessellation: 4 }, [0.26, 0.17, -0.02], [0, 0, -1.2]), skin],
      [cyl(s, { diameterTop: 0.0, diameterBottom: 0.14, height: 0.38, tessellation: 4 }, [-0.26, 0.17, -0.02], [0, 0, 1.2]), skin],
      [cyl(s, { diameterTop: 0.02, diameterBottom: 0.09, height: 0.17, tessellation: 5 }, [0, 0.09, 0.24], [1.4, 0, 0]), [0.32, 0.45, 0.2]],
      [sph(s, 0.075, [0.08, 0.17, 0.18]), [0.95, 0.85, 0.2]],
      [sph(s, 0.075, [-0.08, 0.17, 0.18]), [0.95, 0.85, 0.2]],
      [box(s, { width: 0.18, height: 0.03, depth: 0.04 }, [0, 0.0, 0.2]), [0.15, 0.08, 0.05]]
    ],
    weapon: (s) => [
      [cyl(s, { diameterTop: 0.14, diameterBottom: 0.06, height: 0.75 }, [0, 0, 0.3], [Math.PI / 2, 0, 0]), [0.38, 0.26, 0.15], 0.1],
      [sph(s, 0.08, [0.05, 0.02, 0.6]), [0.6, 0.6, 0.6]],
      [sph(s, 0.08, [-0.05, -0.03, 0.52]), [0.6, 0.6, 0.6]]
    ]
  });
}

function buildVillager(s, key, o) {
  return buildHumanoid(s, key, {
    height: o.height || 1.75, skin: o.skin, cloth: o.cloth, sleeve: o.cloth, pants: o.pants, boots: [0.25, 0.17, 0.1],
    torso: (s, H) => [
      [cyl(s, { diameterTop: 0.42, diameterBottom: o.robe ? 0.62 : 0.46, height: o.robe ? H * 0.72 : H * 0.36, tessellation: 10 }, [0, o.robe ? -H * 0.05 : H * 0.15, 0]), o.cloth, 0.05],
      [cyl(s, { diameter: 0.46, height: 0.08, tessellation: 10 }, [0, 0.02, 0]), o.belt || [0.3, 0.2, 0.1]],
      ...(o.apron ? [[box(s, { width: 0.4, height: H * 0.4, depth: 0.05 }, [0, -0.02, 0.24]), o.apron]] : []),
      ...(o.armor ? [[box(s, { width: 0.48, height: H * 0.26, depth: 0.3 }, [0, H * 0.18, 0]), o.armor, 0.04]] : [])
    ],
    head: (s) => [
      [sph(s, 0.27, [0, 0.12, 0], [0.9, 1.05, 0.95]), o.skin, 0.03],
      [sph(s, 0.29, [0, 0.18, -0.03], [0.95, 0.75, 0.95]), o.hair, 0.08],
      ...(o.beard ? [[sph(s, 0.2, [0, 0.0, 0.08], [1, 1.2, 0.8]), o.beard, 0.06]] : []),
      ...(o.hood ? [[sph(s, 0.34, [0, 0.16, -0.03], [1, 1.05, 1.05]), o.hood, 0.05]] : []),
      ...(o.helmet ? [[sph(s, 0.31, [0, 0.2, 0], [1, 0.75, 1]), o.helmet, 0.03]] : []),
      [sph(s, 0.04, [0.055, 0.14, 0.12]), [0.1, 0.08, 0.06]],
      [sph(s, 0.04, [-0.055, 0.14, 0.12]), [0.1, 0.08, 0.06]]
    ],
    weapon: o.weapon,
    offhand: o.offhand
  });
}

function buildSkeleton(s, key = 'skel', boss = false) {
  const bone = boss ? [0.78, 0.74, 0.66] : [0.86, 0.83, 0.74];
  const rust = [0.48, 0.38, 0.3];
  return buildHumanoid(s, key, {
    height: 1.8, width: 0.85, skin: bone, cloth: bone,
    torso: (s, H) => [
      [cyl(s, { diameter: 0.07, height: H * 0.34 }, [0, H * 0.15, -0.05]), bone],
      [MeshBuilder.CreateTorus('rib', { diameter: 0.34, thickness: 0.04, tessellation: 10 }, s), bone],
      [MeshBuilder.CreateTorus('rib', { diameter: 0.38, thickness: 0.04, tessellation: 10 }, s), bone],
      [MeshBuilder.CreateTorus('rib', { diameter: 0.32, thickness: 0.04, tessellation: 10 }, s), bone],
      [box(s, { width: 0.34, height: 0.14, depth: 0.18 }, [0, 0.0, 0]), bone],
      [box(s, { width: 0.5, height: 0.06, depth: 0.12 }, [0, H * 0.3, 0]), bone],
      ...(boss ? [
        [box(s, { width: 0.62, height: H * 0.6, depth: 0.05 }, [0, H * 0.02, -0.2], [0.12, 0, 0]), [0.25, 0.1, 0.3], 0.05],
        [box(s, { width: 0.6, height: 0.16, depth: 0.32 }, [0, H * 0.3, 0]), [0.35, 0.3, 0.32], 0.05]
      ] : [])
    ].map((p, i) => {
      if (i >= 1 && i <= 3) { p[0].position.set(0, H * (0.1 + i * 0.065), 0); p[0].scaling.set(1, 1, 0.75); }
      return p;
    }),
    head: (s) => [
      [sph(s, 0.3, [0, 0.13, 0], [0.9, 1, 1]), bone],
      [box(s, { width: 0.17, height: 0.07, depth: 0.12 }, [0, -0.02, 0.07]), bone],
      [sph(s, 0.08, [0.06, 0.14, 0.12]), [0.08, 0.06, 0.06]],
      [sph(s, 0.08, [-0.06, 0.14, 0.12]), [0.08, 0.06, 0.06]],
      ...(boss ? [
        [cyl(s, { diameter: 0.32, height: 0.1, tessellation: 10 }, [0, 0.29, 0]), [0.9, 0.72, 0.2]],
        ...[0, 1, 2, 3, 4].map((i) => [cyl(s, { diameterTop: 0, diameterBottom: 0.07, height: 0.14, tessellation: 4 }, [Math.cos(i * 1.256) * 0.14, 0.4, Math.sin(i * 1.256) * 0.14]), [0.9, 0.72, 0.2]])
      ] : [])
    ],
    eyes: (s) => [
      [sph(s, 0.05, [0.06, 0.14, 0.15]), boss ? [0.4, 0.8, 1] : [1, 0.25, 0.15]],
      [sph(s, 0.05, [-0.06, 0.14, 0.15]), boss ? [0.4, 0.8, 1] : [1, 0.25, 0.15]]
    ],
    arm: (s, L) => [
      [cyl(s, { diameter: 0.05, height: L }, [0, -L / 2, 0]), bone],
      [sph(s, 0.08, [0, -L / 2, 0]), bone],
      [sph(s, 0.09, [0, -L, 0]), bone],
      ...(boss ? [[sph(s, 0.2, [0, 0, 0], [1.2, 0.8, 1.2]), [0.35, 0.3, 0.32]]] : [])
    ],
    leg: (s, L) => [
      [cyl(s, { diameter: 0.06, height: L * 0.95 }, [0, -L * 0.47, 0]), bone],
      [sph(s, 0.09, [0, -L * 0.5, 0.01]), bone],
      [box(s, { width: 0.1, height: 0.06, depth: 0.22 }, [0, -L + 0.03, 0.05]), bone]
    ],
    weapon: (s) => boss ? [
      [box(s, { width: 0.1, height: 0.03, depth: 1.5 }, [0, 0, 0.9]), [0.5, 0.55, 0.62]],
      [box(s, { width: 0.4, height: 0.06, depth: 0.08 }, [0, 0, 0.12]), [0.3, 0.25, 0.2]],
      [cyl(s, { diameter: 0.05, height: 0.3 }, [0, 0, -0.05], [Math.PI / 2, 0, 0]), [0.2, 0.12, 0.08]]
    ] : [
      [box(s, { width: 0.07, height: 0.02, depth: 0.8 }, [0, 0, 0.5]), rust, 0.15],
      [box(s, { width: 0.24, height: 0.04, depth: 0.05 }, [0, 0, 0.1]), [0.3, 0.25, 0.2]],
      [cyl(s, { diameter: 0.04, height: 0.18 }, [0, 0, 0], [Math.PI / 2, 0, 0]), [0.25, 0.15, 0.1]]
    ],
    offhand: boss ? null : (s) => [
      [cyl(s, { diameter: 0.6, height: 0.06, tessellation: 12 }, [0.04, 0, 0.1], [0, 0, Math.PI / 2]), [0.4, 0.3, 0.2], 0.15],
      [cyl(s, { diameter: 0.15, height: 0.08, tessellation: 8 }, [0.08, 0, 0.1], [0, 0, Math.PI / 2]), [0.5, 0.5, 0.52]]
    ]
  });
}

function buildSpider(s) {
  const dark = [0.16, 0.13, 0.11], red = [0.6, 0.12, 0.08];
  const joints = { body: [null, 0, 0.55, 0] };
  const attach = [['body', 'body']];
  for (let i = 0; i < 8; i++) {
    const side = i < 4 ? 1 : -1;
    const k = i % 4;
    joints['leg' + i] = ['body', side * 0.2, 0, 0.32 - k * 0.2];
    attach.push(['leg' + i, side > 0 ? 'legR' : 'legL']);
  }
  const leg = (side) => [
    [cyl(s, { diameterTop: 0.07, diameterBottom: 0.09, height: 0.6 }, [side * 0.26, 0.2, 0], [0, 0, -side * 0.85]), dark],
    [cyl(s, { diameterTop: 0.03, diameterBottom: 0.07, height: 0.85 }, [side * 0.7, -0.08, 0], [0, 0, side * 0.45]), dark]
  ];
  return {
    joints, attach, rig: 'spider',
    parts: {
      body: makePart(s, 'spiderBody', [
        [sph(s, 0.85, [0, 0.15, -0.55], [1, 0.8, 1.15]), dark, 0.08],
        [sph(s, 0.32, [0, 0.42, -0.6], [1, 0.4, 1.4]), red],
        [sph(s, 0.5, [0, 0.0, 0.1], [1, 0.75, 1.1]), dark],
        [sph(s, 0.07, [0.08, 0.1, 0.36]), [0.9, 0.15, 0.1]],
        [sph(s, 0.07, [-0.08, 0.1, 0.36]), [0.9, 0.15, 0.1]],
        [cyl(s, { diameterTop: 0, diameterBottom: 0.06, height: 0.2 }, [0.06, -0.12, 0.38], [0.5, 0, 0]), [0.3, 0.25, 0.2]],
        [cyl(s, { diameterTop: 0, diameterBottom: 0.06, height: 0.2 }, [-0.06, -0.12, 0.38], [0.5, 0, 0]), [0.3, 0.25, 0.2]]
      ]),
      legR: makePart(s, 'spiderLegR', leg(1)),
      legL: makePart(s, 'spiderLegL', leg(-1))
    }
  };
}

const BUILDERS = {
  lobo: buildWolf,
  goblin: buildGoblin,
  aranha: buildSpider,
  esqueleto: (s) => buildSkeleton(s, 'skel', false),
  rei: (s) => buildSkeleton(s, 'rei', true),
  anciao: (s) => buildVillager(s, 'anciao', { skin: [0.85, 0.68, 0.55], cloth: [0.42, 0.34, 0.5], hair: [0.85, 0.85, 0.85], beard: [0.9, 0.9, 0.9], robe: true, height: 1.7,
    weapon: (s) => [[cyl(s, { diameter: 0.07, height: 1.7 }, [0, 0.2, 0.05]), [0.4, 0.28, 0.16]], [sph(s, 0.14, [0, 1.05, 0.05]), [0.4, 0.28, 0.16]]] }),
  curandeira: (s) => buildVillager(s, 'curandeira', { skin: [0.9, 0.74, 0.62], cloth: [0.3, 0.48, 0.32], hair: [0.45, 0.25, 0.12], hood: [0.25, 0.4, 0.27], robe: true, height: 1.65 }),
  ferreiro: (s) => buildVillager(s, 'ferreiro', { skin: [0.78, 0.58, 0.44], cloth: [0.45, 0.4, 0.35], pants: [0.25, 0.2, 0.16], hair: [0.2, 0.12, 0.08], beard: [0.25, 0.14, 0.08], apron: [0.3, 0.2, 0.13], height: 1.85,
    weapon: (s) => [[cyl(s, { diameter: 0.05, height: 0.45 }, [0, 0, 0.18], [Math.PI / 2, 0, 0]), [0.35, 0.22, 0.12]], [box(s, { width: 0.12, height: 0.12, depth: 0.2 }, [0, 0, 0.42]), [0.35, 0.35, 0.38]]] }),
  capitao: (s) => buildVillager(s, 'capitao', { skin: [0.82, 0.64, 0.5], cloth: [0.2, 0.26, 0.5], pants: [0.25, 0.22, 0.2], hair: [0.3, 0.2, 0.12], helmet: [0.6, 0.62, 0.66], armor: [0.55, 0.57, 0.62], height: 1.85,
    weapon: (s) => [[cyl(s, { diameter: 0.05, height: 2.2 }, [0, 0.4, 0.05]), [0.35, 0.25, 0.15]], [cyl(s, { diameterTop: 0, diameterBottom: 0.12, height: 0.3, tessellation: 4 }, [0, 1.6, 0.05]), [0.7, 0.72, 0.75]]] }),
  aldeao: (s) => buildVillager(s, 'aldeao', { skin: [0.88, 0.7, 0.56], cloth: [0.55, 0.42, 0.28], pants: [0.3, 0.26, 0.2], hair: [0.35, 0.22, 0.1], height: 1.72 })
};

export function getTemplate(scene, type) {
  if (!templates.has(type)) templates.set(type, BUILDERS[type](scene));
  return templates.get(type);
}

export function allTemplateMeshes() {
  const out = [];
  for (const t of templates.values()) for (const m of Object.values(t.parts)) out.push(m);
  return out;
}

/**
 * Cria um personagem a partir do modelo: raiz + articulações + instâncias.
 * @returns {{ root: TransformNode, joints: Record<string, TransformNode>, instances: any[], template: any }}
 */
export function createCharacter(scene, type, name, scale = 1) {
  const tpl = getTemplate(scene, type);
  const root = new TransformNode(name, scene);
  const body = new TransformNode(name + '_body', scene);
  body.parent = root;
  body.scaling.setAll(scale);
  const joints = {};
  for (const [jn, [parent, x, y, z]] of Object.entries(tpl.joints)) {
    const n = new TransformNode(name + '_' + jn, scene);
    n.parent = parent ? joints[parent] : body;
    n.position.set(x, y, z);
    n.metadata = { rest: new Vector3(x, y, z) };
    joints[jn] = n;
  }
  const instances = [];
  for (const [jn, pn] of tpl.attach) {
    const inst = tpl.parts[pn].createInstance(name + '_' + pn);
    inst.parent = joints[jn];
    inst.isPickable = false;
    inst.instancedBuffers.instanceColor = new Color4(1, 1, 1, 1);
    instances.push(inst);
  }
  return { root, body, joints, instances, template: tpl };
}
