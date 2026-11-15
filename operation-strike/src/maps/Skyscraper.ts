// MAPA 3 — SKYSCRAPER
// Complexo urbano moderno entre torres de vidro: Bomba B no estacionamento coberto (oeste),
// Bomba A no saguão do escritório (leste), praça central com escada para o mezanino, ruas laterais.
// Grade: 4 x 4 m. # torre perimetral  G torre de vidro  b estacionamento coberto  a saguão (escritório)
//        p praça  . rua  C base CT  T base TR
import type { BoxDef, MapDefinition } from './MapTypes';

const GRID = [
  '#########################', // z 50..54
  '#GGGGGGGGGCCCCCCCGGGGGGG#', // z 46..50
  '#GG.......CCCCCCC......G#', // z 42..46
  '#GG.bbbbbbCCCCCCCaaaaaaG#', // z 38..42
  '#GG.bbbbbbGGGG.GGaaaaaaG#', // z 34..38
  '#GG.bbbbbbGGGG.GGaaaaaaG#', // z 30..34
  '#GG.bbbbbbGGGG.GGaaaaaaG#', // z 26..30
  '#GG.bbbbbbGGGG.GGaaaaaaG#', // z 22..26
  '#GG.bbbbbb.....GGaaaaaaG#', // z 18..22
  '#GG.GGGG.ppppppppp.GGG.G#', // z 14..18
  '#GG.GGGG.ppppppppp.GGG.G#', // z 10..14
  '#GG.GGGG.ppppppppp.GGG.G#', // z  6..10
  '#GG.GGGG.ppppppppp.GGG.G#', // z  2..6
  '#GG.GGGG.ppppppppp.GGG.G#', // z -2..2
  '#GG.GGGGGGGG.GGGGGGGG..G#', // z -6..-2
  '#GG.GGGGGGGG.GGGGGGGG..G#', // z -10..-6
  '#GG.GGGGGGGG.GGGGGGGG..G#', // z -14..-10
  '#GG.GGGGGGGG.GGGGGGGG..G#', // z -18..-14
  '#GG.GGGGGGGG.GGGGGGGG..G#', // z -22..-18
  '#GG.GGGGGGGG.GGGGGGGG..G#', // z -26..-22
  '#GG..........GGGGGGGG..G#', // z -30..-26
  '#GGGG.TTTTTTTTTTTTT....G#', // z -34..-30
  '#GGGGGTTTTTTTTTTTTTGGGGG#', // z -38..-34
  '#GGGGGTTTTTTTTTTTTTGGGGG#', // z -42..-38
  '#GGGGGGGGGGGGGGGGGGGGGGG#', // z -46..-42
  '#########################' // z -50..-46
];

const boxes: BoxDef[] = [];
const crate = (x: number, z: number, s = 1.2, y = 0) => boxes.push({ min: [x - s / 2, y, z - s / 2], max: [x + s / 2, y + s, z + s / 2], mat: 'crate' });
const block = (x0: number, z0: number, x1: number, z1: number, h: number, mat: BoxDef['mat'], y = 0, extra: Partial<BoxDef> = {}) =>
  boxes.push({ min: [x0, y, z0], max: [x1, y + h, z1], mat, ...extra });
const pillar = (x: number, z: number, h: number, mat: BoxDef['mat'] = 'concrete') => block(x - 0.35, z - 0.35, x + 0.35, z + 0.35, h, mat);
/** Carro estacionado (eixo z). */
const car = (x: number, z: number, color: BoxDef['mat'] = 'metal') => {
  block(x - 0.9, z - 2.1, x + 0.9, z + 2.1, 0.9, color);
  block(x - 0.8, z - 1.1, x + 0.8, z + 0.9, 0.5, 'glass', 0.9);
};

// Bomba B — estacionamento (teto baixo, pilares e carros)
for (const x of [-30, -22, -14]) for (const z of [22, 30, 38]) pillar(x, z, 3.2);
car(-26, 26);
car(-18, 34);
car(-26, 38, 'container');
car(-12, 26.5, 'container');
block(-34, 30, -33.4, 40, 1.1, 'concrete'); // mureta da rampa (lado da rua oeste)
crate(-20, 20, 1.4);
// Bomba A — saguão do escritório: recepção, mesas, pilares, vasos
block(26, 26, 34, 27.2, 1.1, 'steel');
for (const x of [22, 38]) for (const z of [24, 34]) pillar(x, z, 4.5, 'steel');
block(28, 34, 31, 35.4, 0.8, 'crate');
block(33, 36, 36, 37.4, 0.8, 'crate');
block(19, 39, 21, 41, 1.2, 'concrete');
block(40, 19, 42, 21, 1.2, 'concrete');
crate(36, 30, 1.2);
// Praça central: canteiros, fonte, bancos, escada até o mezanino
block(0, 6, 6, 10, 0.7, 'concrete'); // fonte
block(-11, 14, -7, 16, 0.9, 'concrete');
block(-11, 14.9, -7, 15.1, 0.05, 'grass', 0.9, { collide: false });
block(14, 14, 18, 16, 0.9, 'concrete');
block(-12, 0, -9, 1, 0.5, 'steel');
for (let i = 0; i < 6; i++) block(16, -1 + i * 0.8, 21.9, -0.2 + i * 0.8, 0.4 * (i + 1), 'concrete'); // escada
block(16, 3.8, 21.9, 13.9, 2.4, 'concrete'); // mezanino
block(16, 13.9, 21.9, 14, 1.1, 'steel', 2.4, { bullets: false }); // guarda-corpo
crate(-6, 2, 1.4);
crate(10, 16, 1.2);
// Ruas laterais e meio
car(-36, 14, 'container');
car(-36, -10);
block(-38, -20, -34, -19.4, 1.1, 'concrete');
car(40, 8);
crate(42, -16, 1.4);
block(38, -6, 42, -5.4, 1.1, 'concrete');
block(-3.5, -14, -0.5, -13.4, 1.1, 'concrete');
crate(1.5, -22, 1.2);
// Bases
block(-20, -38, -16, -35.4, 2.2, 'metal');
crate(8, -36, 1.4);
crate(14, 46, 1.4);

export const SKYSCRAPER: MapDefinition = {
  id: 'skyscraper',
  name: 'Skyscraper',
  description: 'Complexo urbano: estacionamento B, saguão de escritórios A e praça com mezanino.',
  cell: 4,
  originX: -50,
  originZ: 54,
  grid: GRID,
  legend: {
    '#': { type: 'solid', material: 'glass', height: [34, 42] },
    G: { type: 'solid', material: 'glass', height: [14, 30] },
    b: { type: 'roofed', material: 'concrete', floor: 'asphalt', height: [3.2, 3.2], roof: 'concrete' },
    a: { type: 'roofed', material: 'carpet', floor: 'carpet', height: [4.5, 4.5], roof: 'concrete' },
    p: { type: 'floor', material: 'tile' },
    '.': { type: 'floor', material: 'asphalt' },
    C: { type: 'floor', material: 'tile' },
    T: { type: 'floor', material: 'asphalt' }
  },
  boxes,
  doors: [{ id: 'lobby', min: [38, 0, 17.88], max: [42, 3.2, 18.12], axis: 'x', open: true }],
  spawns: {
    T: [
      { x: -2, z: -36, yaw: 0 }, { x: 2, z: -36, yaw: 0 }, { x: -6, z: -38, yaw: 0 }, { x: 6, z: -38, yaw: 0 },
      { x: 0, z: -40, yaw: 0 }, { x: -10, z: -40, yaw: 0 }, { x: 12, z: -40, yaw: 0 }, { x: -12, z: -36, yaw: 0 }
    ],
    CT: [
      { x: 4, z: 44, yaw: 180 }, { x: 0, z: 44, yaw: 180 }, { x: 8, z: 44, yaw: 180 }, { x: -4, z: 43, yaw: 180 },
      { x: 12, z: 43, yaw: 180 }, { x: 2, z: 47, yaw: 180 }, { x: 6, z: 47, yaw: 180 }, { x: -6, z: 47, yaw: 180 }
    ]
  },
  sites: [
    { name: 'A', min: [18, 18], max: [42, 42] },
    { name: 'B', min: [-34, 18], max: [-10, 42] }
  ],
  zones: [
    { name: 'BASE CT', min: [-10, 38], max: [18, 50] },
    { name: 'BOMBA A · SAGUÃO', min: [18, 18], max: [42, 42] },
    { name: 'BOMBA B · ESTACIONAMENTO', min: [-34, 18], max: [-10, 42] },
    { name: 'CORREDOR CT', min: [6, 18], max: [10, 38] },
    { name: 'PRAÇA', min: [-14, -2], max: [22, 22] },
    { name: 'RUA OESTE', min: [-38, -30], max: [-34, 46] },
    { name: 'RUA LESTE', min: [26, -30], max: [42, 18] },
    { name: 'AVENIDA', min: [-2, -30], max: [2, -2] },
    { name: 'BASE TR', min: [-34, -46], max: [34, -30] }
  ],
  tactics: {
    A: { tStage: [[40, -4], [40, 0], [12, 10]], ctHold: [[32, 32, 148], [22, 30, -171], [38, 38, 180]] },
    B: { tStage: [[-36, 8], [-36, 2], [-10, 12]], ctHold: [[-20, 36, -110], [-18, 30, 130], [-28, 24, -135]] },
    ctMid: [[8, 30, 180], [8, 24, 180]]
  },
  ambience: {
    sky: ['#1f4d8c', '#7fb0dc', '#d8dde2'],
    fog: '#c6ccd3',
    sunDir: [-0.3, -0.7, -0.55],
    sunColor: '#fff6e8',
    sunIntensity: 1.45,
    ambient: '#cfdcf0',
    ambientGround: '#5a5e66',
    ambientIntensity: 0.7
  }
};
