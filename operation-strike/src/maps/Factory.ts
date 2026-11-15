// MAPA 2 — FACTORY
// Complexo industrial: grande pavilhão central coberto (meio), Bomba B dentro do armazém coberto (oeste),
// Bomba A no pátio de carga (leste), corredor de tubulações (oeste) e pátio de caminhões (leste).
// Grade: 4 x 4 m. # muro  B prédio de tijolo  W pavilhão coberto  b armazém coberto (B)  a pátio A
//        . asfalto  C base CT  T base TR
import type { BoxDef, MapDefinition } from './MapTypes';

const GRID = [
  '#########################', // z 52..56
  '#BBBBBBBCCCCCCCCCBBBBBBB#', // z 48..52
  '#BBBB...CCCCCCCCC....BBB#', // z 44..48
  '#bbbbbb.CCCCCCCCC.aaaaaa#', // z 40..44
  '#bbbbbbBBBBB.BBBBBaaaaaa#', // z 36..40
  '#bbbbbbBBBBB.BBBBBaaaaaa#', // z 32..36
  '#bbbbbbBBBBB.BBBBBaaaaaa#', // z 28..32
  '#bbbbbbBBBBB.BBBBBaaaaaa#', // z 24..28
  '#bbbbbb.BBBB.BBBB.aaaaaa#', // z 20..24
  '#B..BBB.WWWWWWWWW.BB....#', // z 16..20
  '#B..BBBWWWWWWWWWWWBB....#', // z 12..16
  '#B..BBBWWWWWWWWWWWBB....#', // z  8..12
  '#B..BBBWWWWWWWWWWWBB....#', // z  4..8
  '#B..BBBWWWWWWWWWWWBB....#', // z  0..4
  '#B..WWWWWWWWWWWWWWBB....#', // z -4..0
  '#B..BBBBBBB...BBBBBB.B..#', // z -8..-4
  '#B..BBBBBBB...BBBBBB....#', // z -12..-8
  '#B..BBBBBBB...BBBBBB....#', // z -16..-12
  '#B..BBBBBBB...BBBBBB....#', // z -20..-16
  '#B..BBBBBBB...BBBBBB....#', // z -24..-20
  '#B..BBBBBBB...BBBBBB....#', // z -28..-24
  '#B.....BBBB...BBBB......#', // z -32..-28
  '#BB..TTTTTTTTTTTTTTT...B#', // z -36..-32
  '#BBBBTTTTTTTTTTTTTTTBBBB#', // z -40..-36
  '#BBBBTTTTTTTTTTTTTTTBBBB#', // z -44..-40
  '#BBBBTTTTTTTTTTTTTTTBBBB#', // z -48..-44
  '#BBBBBBBBBBBBBBBBBBBBBBB#', // z -52..-48
  '#########################' // z -56..-52
];

const boxes: BoxDef[] = [];
const crate = (x: number, z: number, s = 1.2, y = 0) => boxes.push({ min: [x - s / 2, y, z - s / 2], max: [x + s / 2, y + s, z + s / 2], mat: 'crate' });
const block = (x0: number, z0: number, x1: number, z1: number, h: number, mat: BoxDef['mat'], y = 0, extra: Partial<BoxDef> = {}) =>
  boxes.push({ min: [x0, y, z0], max: [x1, y + h, z1], mat, ...extra });
const pillar = (x: number, z: number, h: number) => block(x - 0.3, z - 0.3, x + 0.3, z + 0.3, h, 'steel');
const barrel = (x: number, z: number) => boxes.push({ min: [x - 0.35, 0, z - 0.35], max: [x + 0.35, 1, z + 0.35], mat: 'metal' });

// Pavilhão central (meio): contêineres, máquinas e pilares
block(-14, 6, -8, 8.6, 2.6, 'container');
block(8, 12, 14, 14.6, 2.6, 'container');
block(-3, 14, 3, 16.6, 2.6, 'container');
block(-4, 3, 0, 5, 1.6, 'steel'); // máquina
block(5, 1, 8, 4, 2.2, 'steel');
for (const x of [-12, 0, 12]) for (const z of [2, 10, 18]) if (!(x === 0 && z === 18)) pillar(x, z, 7);
block(-18, 9, 18, 9.4, 0.3, 'steel', 4.6, { collide: false, detail: true }); // passarela suspensa (visual)
crate(16, 2, 1.4);
crate(-18, 14, 1.2);
crate(-17, 15.3, 1.2);
// Bomba A (pátio de carga)
block(30, 30, 36, 32.6, 2.6, 'container');
block(30, 32.6, 36, 35.2, 2.6, 'container');
block(31, 31, 35, 34.6, 2.6, 'container', 2.6);
block(40, 36, 42.4, 42, 2.2, 'metal'); // caminhão
block(40.2, 34.5, 42.2, 36, 1.8, 'metal');
crate(26, 26, 1.6);
crate(27.6, 26, 1.2);
crate(44, 24, 1.4);
barrel(24, 40);
barrel(24.8, 40.4);
block(36, 22, 40, 22.6, 1.1, 'concrete');
// Bomba B (armazém coberto): prateleiras com vãos
block(-40, 28, -38.8, 37, 2.8, 'steel');
block(-32, 28, -30.8, 37, 2.8, 'steel');
crate(-36, 24, 1.6);
crate(-26, 34, 1.6);
crate(-26, 35.6, 1.2);
crate(-44, 40, 1.2);
crate(-34.4, 41, 1.2);
for (const x of [-42, -34, -26]) for (const z of [26, 34, 42]) if (!(x === -34 && z === 34)) pillar(x, z, 6);
// Corredor de tubulações (oeste) e pátio de caminhões (leste)
block(-42, 2.4, -41.5, -30, 0.5, 'steel', 2.6, { collide: false, detail: true });
block(-42, 2.4, -41.5, -30, 0.5, 'steel', 3.4, { collide: false, detail: true });
crate(-38, -8, 1.2);
crate(-35.5, 8, 1.4);
barrel(-41, -20);
block(33, -16, 37, -9, 2.4, 'container');
crate(44, -2, 1.4);
crate(42, 10, 1.2);
barrel(35, 2);
// Meio sul e base TR
block(-5.5, -14, -2.5, -13.4, 1.1, 'concrete');
crate(3.5, -22, 1.4);
block(-24, -46, -18, -43.4, 2.6, 'container');
block(18, -46, 24, -43.4, 2.6, 'container');
crate(-4, -34, 1.6);
crate(6, -36, 1.2);
// Base CT
crate(12, 46, 1.4);
block(-6, 49.2, 0, 51.8, 2.6, 'container');

export const FACTORY: MapDefinition = {
  id: 'factory',
  name: 'Factory',
  description: 'Fábrica com pavilhão central coberto, armazém B e pátio de carga A.',
  cell: 4,
  originX: -50,
  originZ: 56,
  grid: GRID,
  legend: {
    '#': { type: 'solid', material: 'concrete', height: [10, 11] },
    B: { type: 'solid', material: 'brick', height: [7, 10] },
    W: { type: 'roofed', material: 'concrete', floor: 'concrete', height: [7, 7], roof: 'metal' },
    b: { type: 'roofed', material: 'concrete', floor: 'concrete', height: [6, 6], roof: 'metal' },
    a: { type: 'floor', material: 'concrete' },
    '.': { type: 'floor', material: 'asphalt' },
    C: { type: 'floor', material: 'concrete' },
    T: { type: 'floor', material: 'asphalt' }
  },
  boxes,
  doors: [{ id: 'bdoor', min: [-22.12, 0, 20], max: [-21.88, 3.2, 24], axis: 'z', open: true }],
  spawns: {
    T: [
      { x: -2, z: -40, yaw: 0 }, { x: 2, z: -40, yaw: 0 }, { x: -6, z: -42, yaw: 0 }, { x: 6, z: -42, yaw: 0 },
      { x: 0, z: -44, yaw: 0 }, { x: -10, z: -44, yaw: 0 }, { x: 10, z: -44, yaw: 0 }, { x: -14, z: -40, yaw: 0 }
    ],
    CT: [
      { x: 0, z: 46, yaw: 180 }, { x: -4, z: 46, yaw: 180 }, { x: 4, z: 46, yaw: 180 }, { x: -8, z: 45, yaw: 180 },
      { x: 8, z: 45, yaw: 180 }, { x: -2, z: 48, yaw: 180 }, { x: 2, z: 48, yaw: 180 }, { x: -12, z: 46, yaw: 180 }
    ]
  },
  sites: [
    { name: 'A', min: [22, 20], max: [46, 44] },
    { name: 'B', min: [-46, 20], max: [-22, 44] }
  ],
  zones: [
    { name: 'BASE CT', min: [-18, 40], max: [18, 52] },
    { name: 'BOMBA A · PÁTIO', min: [22, 20], max: [46, 44] },
    { name: 'BOMBA B · ARMAZÉM', min: [-46, 20], max: [-22, 44] },
    { name: 'CORREDOR CT', min: [-2, 20], max: [2, 40] },
    { name: 'PAVILHÃO', min: [-34, -4], max: [22, 20] },
    { name: 'TUBULAÇÕES', min: [-46, -32], max: [-34, 20] },
    { name: 'PÁTIO DE CAMINHÕES', min: [26, -32], max: [46, 20] },
    { name: 'MEIO SUL', min: [-6, -32], max: [6, -4] },
    { name: 'BASE TR', min: [-34, -52], max: [34, -32] }
  ],
  tactics: {
    A: { tStage: [[38, 10], [42, 6], [16, 8]], ctHold: [[28, 38, 158], [28, 30, -141], [44, 32, 180]] },
    B: { tStage: [[-38, 10], [-36, 4], [-18, 4]], ctHold: [[-28, 40, -153], [-36, 26, 180], [-26, 30, 124]] },
    ctMid: [[0, 30, 180], [0, 38, 180]]
  },
  ambience: {
    sky: ['#4f6276', '#9aa8b4', '#c9c4b8'],
    fog: '#b9b6ad',
    sunDir: [0.4, -0.75, 0.5],
    sunColor: '#fde9cc',
    sunIntensity: 1.3,
    ambient: '#c8d0da',
    ambientGround: '#5c5a55',
    ambientIntensity: 0.75
  }
};
