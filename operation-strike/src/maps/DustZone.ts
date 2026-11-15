// MAPA 1 — DUST ZONE
// Vila desértica original: dois pontos de bomba (A a leste, B a oeste), base TR ao sul, base CT ao norte.
// Rotas: Longo A (leste), Meio com portas + Curto A, Túneis B (oeste, cobertos), Túnel inferior ligando Túneis ao Meio,
// conectores Meio→B e Meio→A, saídas da base CT para os dois pontos.
//
// Grade: cada símbolo = 4 x 4 metros. Linha 0 = norte. Coluna 0 = oeste (x = -50).
//   # muro externo de arenito   B prédio   . piso de areia   r corredor coberto (túnel)
//   C piso da base CT   T piso da base TR   a / b piso do ponto de bomba A / B
import type { BoxDef, MapDefinition } from './MapTypes';

const GRID = [
  '#########################', // z 54..58
  '#BBBBBBBBCCCCCCCBBBBBBBB#', // z 50..54
  '#BBBB....CCCCCCC....BBBB#', // z 46..50
  '#bbbbbbb.CCCCCCC.aaaaaaa#', // z 42..46
  '#bbbbbbbBBBB.BBBBaaaaaaa#', // z 38..42
  '#bbbbbbbBBBB.BBBBaaaaaaa#', // z 34..38
  '#bbbbbbbBBBB.BBBBaaaaaaa#', // z 30..34
  '#bbbbbbbBBBB.BBBBaaaaaaa#', // z 26..30
  '#bbbbbbb.BBB.BBB.aaaaaaa#', // z 22..26
  '#B...BBB.........BBBB...#', // z 18..22
  '#B...BBBB.......BBBBB...#', // z 14..18
  '#B...BBBB.......BBBBB...#', // z 10..14
  '#B...BBBBBB...BBBBBBB...#', // z  6..10
  '#BrrrBBBBBB...BBBBBBB...#', // z  2..6
  '#BrrrBBBBBB...BBBBBBB...#', // z -2..2
  '#BrrrBBBBBBB.BBBBBBBBB.B#', // z -6..-2   portas do meio (col 12) e portões do Longo (col 22)
  '#Brrrrrrrrr...BBBBBBB...#', // z -10..-6  túnel inferior
  '#BrrrBBBBBB...BBBBBBB...#', // z -14..-10
  '#BrrrBBBBBB...BBBBBBB...#', // z -18..-14
  '#BrrrBBBBBB...BBBBBBB...#', // z -22..-18
  '#BrrrBBBBBB...BBBBBBB...#', // z -26..-22
  '#B...BBBBBB...BBBBBBB...#', // z -30..-26
  '#B...BBB.........BBB...B#', // z -34..-30
  '#BB...TTTTTTTTTTT....BBB#', // z -38..-34
  '#BBBBBTTTTTTTTTTTBBBBBBB#', // z -42..-38
  '#BBBBBTTTTTTTTTTTBBBBBBB#', // z -46..-42
  '#BBBBBTTTTTTTTTTTBBBBBBB#', // z -50..-46
  '#BBBBBBBBBBBBBBBBBBBBBBB#', // z -54..-50
  '#########################' // z -58..-54
];

// ---------------------------------------------------------------- auxiliares de construção

const boxes: BoxDef[] = [];

function crate(x: number, z: number, size = 1.2, y = 0): void {
  boxes.push({ min: [x - size / 2, y, z - size / 2], max: [x + size / 2, y + size, z + size / 2], mat: 'crate' });
}

function block(x0: number, z0: number, x1: number, z1: number, h: number, mat: BoxDef['mat'], y = 0, extra: Partial<BoxDef> = {}): void {
  boxes.push({ min: [x0, y, z0], max: [x1, y + h, z1], mat, ...extra });
}

/** Escada com degraus de `rise` metros, subindo na direção indicada. */
function stairs(x0: number, x1: number, zStart: number, dir: 1 | -1, steps: number, rise: number, depth: number): void {
  for (let i = 0; i < steps; i++) {
    const za = zStart + dir * i * depth, zb = za + dir * depth;
    block(x0, Math.min(za, zb), x1, Math.max(za, zb), rise * (i + 1), 'concrete');
  }
}

function barrel(x: number, z: number): void {
  boxes.push({ min: [x - 0.35, 0, z - 0.35], max: [x + 0.35, 1.0, z + 0.35], mat: 'metal' });
}

// ---------------------------------------------------------------- Bomba A (x 18..46, z 22..46)
block(34, 37.2, 46, 46, 1.2, 'concrete'); // plataforma do fundo
stairs(38, 42, 35.6, 1, 2, 0.4, 0.8); // escada até a plataforma (0.4 → 0.8 → 1.2)
block(28, 40, 34, 42.6, 2.6, 'container'); // contêiner
crate(26, 32, 1.6);
crate(27.6, 32.2, 1.2);
crate(26.2, 32.1, 1.0, 1.6);
crate(32, 27, 1.2);
crate(21, 40, 1.6);
crate(22.6, 40, 1.6);
crate(21.8, 40, 1.2, 1.6);
block(40, 26, 44, 26.6, 1.1, 'sandstone'); // mureta (cobertura baixa)
barrel(44.8, 23.2);
barrel(44, 23.4);

// ---------------------------------------------------------------- Bomba B (x -46..-18, z 22..46)
crate(-30, 32, 1.6);
crate(-28.4, 32, 1.6);
crate(-29.2, 32.1, 1.2, 1.6);
block(-40, 38, -36, 38.6, 1.1, 'sandstone');
block(-24, 26, -20, 27.8, 1.0, 'metal'); // carro abandonado
block(-23.2, 26.1, -21.2, 27.7, 0.6, 'metal', 1.0);
crate(-42, 26, 1.2);
crate(-42, 27.3, 1.2);
crate(-36, 44, 1.6);
block(-46, 42, -40, 46, 1.6, 'concrete'); // degrau alto no canto (precisa de pulo agachado)
barrel(-19, 44.6);

// ---------------------------------------------------------------- Meio e conectores
crate(-8, 14, 1.2);
crate(6, 10, 1.6);
crate(7.4, 10.2, 1.0);
crate(0, 17, 1.4);
block(-5.5, -18, -2.5, -17.4, 1.1, 'concrete'); // sacos de areia no meio inferior
crate(3.5, -12, 1.2);
crate(4.2, -24, 1.6);

// Batentes acima das passagens estreitas (dão forma de porta/arco às entradas)
block(-2, -6, 2, -2, 3.8, 'trim', 3.2); // portas do meio
block(38, -6, 42, -2, 3.8, 'trim', 3.2); // portões do Longo
block(-18, 22, -14, 26, 3.0, 'plaster', 3.4); // conector B
block(14, 22, 18, 26, 3.0, 'plaster', 3.4); // curto A
block(-2, 38, 2, 42, 3.0, 'plaster', 3.4); // saída CT para o meio

// ---------------------------------------------------------------- Longo A, túneis e bases
crate(37, 4, 1.6);
crate(44, 12, 1.2);
crate(44, 13.3, 1.2);
barrel(35, -20);
barrel(35.8, -20.4);
crate(43.5, -16, 1.4);
crate(-38, -10, 1.0);
crate(-33, 2, 1.2);
crate(-40, 14, 1.6);
crate(-4, -38, 1.6);
crate(8, -42, 1.2);
crate(9.2, -42, 1.2);
block(-22, -48, -16, -45.4, 2.6, 'container');
crate(10, 46, 1.4);
crate(-10, 50, 1.2);
block(-4, 51.2, 2, 53.8, 2.6, 'container');

// Detalhes visuais (somente qualidade média/alta; sem colisão)
for (const [x, z] of [[-36, -12], [-36, -20], [-20, -8], [-12, -8], [-36, -4]]) {
  boxes.push({ min: [x - 0.25, 3.35, z - 0.25], max: [x + 0.25, 3.6, z + 0.25], mat: 'trim', collide: false, shadow: false, detail: true });
}
// varais/cabos entre prédios no Longo e no meio
boxes.push({ min: [34, 6.2, 8], max: [46, 6.26, 8.06], mat: 'dark', collide: false, shadow: false, detail: true });
boxes.push({ min: [-6, 6.0, -26], max: [6, 6.06, -25.94], mat: 'dark', collide: false, shadow: false, detail: true });

export const DUST_ZONE: MapDefinition = {
  id: 'dust_zone',
  name: 'Dust Zone',
  cell: 4,
  originX: -50,
  originZ: 58,
  grid: GRID,
  legend: {
    '#': { type: 'solid', material: 'sandstone', height: [9, 10] },
    B: { type: 'solid', material: 'plaster', height: [5.5, 8.5] },
    '.': { type: 'floor', material: 'sand' },
    C: { type: 'floor', material: 'concrete' },
    T: { type: 'floor', material: 'sand' },
    a: { type: 'floor', material: 'tile' },
    b: { type: 'floor', material: 'tile' },
    r: { type: 'roofed', material: 'concrete', floor: 'concrete', height: [3.6, 3.6] }
  },
  boxes,
  doors: [
    { id: 'mid', min: [-2, 0, -4.12], max: [2, 3.2, -3.88], axis: 'x', open: true },
    { id: 'long', min: [38, 0, -4.12], max: [42, 3.2, -3.88], axis: 'x', open: true }
  ],
  spawns: {
    T: [
      { x: -2, z: -42, yaw: 0 }, { x: 2, z: -42, yaw: 0 }, { x: -6, z: -44, yaw: 0 },
      { x: 6, z: -44, yaw: 0 }, { x: 0, z: -46, yaw: 0 }, { x: -10, z: -46, yaw: 0 },
      { x: 10, z: -46, yaw: 0 }, { x: -14, z: -42, yaw: 0 }
    ],
    CT: [
      { x: 0, z: 47, yaw: 180 }, { x: -4, z: 47, yaw: 180 }, { x: 4, z: 47, yaw: 180 },
      { x: -8, z: 45, yaw: 180 }, { x: 8, z: 45, yaw: 180 }, { x: -2, z: 44, yaw: 180 },
      { x: 2, z: 44, yaw: 180 }, { x: 12, z: 44, yaw: 180 }
    ]
  },
  sites: [
    { name: 'A', min: [18, 22], max: [46, 46] },
    { name: 'B', min: [-46, 22], max: [-18, 46] }
  ],
  zones: [
    { name: 'BASE CT', min: [-14, 42], max: [14, 54] },
    { name: 'BOMBA A', min: [18, 22], max: [46, 46] },
    { name: 'BOMBA B', min: [-46, 22], max: [-18, 46] },
    { name: 'SAÍDA CT · A', min: [14, 42], max: [34, 54] },
    { name: 'SAÍDA CT · B', min: [-34, 42], max: [-14, 54] },
    { name: 'MEIO CT', min: [-2, 22], max: [2, 42] },
    { name: 'CONECTOR B', min: [-18, 18], max: [-14, 26] },
    { name: 'CURTO A', min: [14, 18], max: [18, 26] },
    { name: 'PRAÇA DO MEIO', min: [-18, 6], max: [18, 22] },
    { name: 'PORTAS DO MEIO', min: [-2, -6], max: [2, -2] },
    { name: 'TÚNEL INFERIOR', min: [-30, -10], max: [-6, -6] },
    { name: 'MEIO INFERIOR', min: [-6, -34], max: [6, 6] },
    { name: 'ENTRADA B', min: [-46, 6], max: [-30, 22] },
    { name: 'TÚNEIS B', min: [-46, -34], max: [-30, 6] },
    { name: 'PORTÕES DO LONGO', min: [38, -6], max: [42, -2] },
    { name: 'LONGO A', min: [30, -34], max: [46, 22] },
    { name: 'BASE TR', min: [-30, -54], max: [30, -30] }
  ],
  ambience: {
    sky: ['#2f6fb8', '#8fc0e6', '#e9d9b8'],
    fog: '#dccaa6',
    sunDir: [-0.45, -0.8, 0.38],
    sunColor: '#fff0d2',
    sunIntensity: 1.55,
    ambient: '#c4d8f0',
    ambientGround: '#8a6e4c',
    ambientIntensity: 0.62
  }
};
