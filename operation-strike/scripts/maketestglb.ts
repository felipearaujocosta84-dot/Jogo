// Gera um GLB de TESTE (não é um modelo definitivo) para verificar o pipeline de carregamento:
// uma "arma" feita de caixas, com o cano apontando para -X e medidas em centímetros, de propósito,
// para conferir se a normalização automática acerta orientação, escala, pente e ferrolho.
// Uso: npx tsx scripts/maketestglb.ts saida.glb
import { writeFileSync } from 'node:fs';

interface Part { name: string; min: [number, number, number]; max: [number, number, number]; color: [number, number, number] }

const parts: Part[] = [
  { name: 'Receiver', min: [-10, -5, -3], max: [50, 5, 3], color: [0.2, 0.2, 0.22] },
  { name: 'Barrel', min: [-45, -1, -1], max: [-10, 1, 1], color: [0.1, 0.1, 0.1] },
  { name: 'Stock', min: [50, -9, -3], max: [80, 5, 3], color: [0.45, 0.28, 0.14] },
  { name: 'Magazine', min: [10, -28, -2], max: [18, -5, 2], color: [0.3, 0.3, 0.32] },
  { name: 'Grip', min: [30, -20, -2], max: [36, -5, 2], color: [0.12, 0.12, 0.12] },
  { name: 'Bolt', min: [20, 5, -1], max: [30, 7, 1], color: [0.4, 0.4, 0.42] }
];

const bin: number[] = [];
const bufferViews: object[] = [];
const accessors: object[] = [];
const meshes: object[] = [];
const nodes: object[] = [];
const materials: object[] = [];

function pushFloats(arr: number[], target?: number): number {
  const offset = bin.length;
  const f = new Float32Array(arr);
  for (const b of new Uint8Array(f.buffer)) bin.push(b);
  bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: f.byteLength, ...(target ? { target } : {}) });
  return bufferViews.length - 1;
}
function pushIndices(arr: number[]): number {
  const offset = bin.length;
  const u = new Uint16Array(arr);
  for (const b of new Uint8Array(u.buffer)) bin.push(b);
  while (bin.length % 4) bin.push(0);
  bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: u.byteLength, target: 34963 });
  return bufferViews.length - 1;
}

for (const p of parts) {
  const [x0, y0, z0] = p.min, [x1, y1, z1] = p.max;
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], idx: number[] = [];
  const faces: [number[][], number[]][] = [
    [[[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], [1, 0, 0]],
    [[[x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0]], [-1, 0, 0]],
    [[[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]], [0, 1, 0]],
    [[[x0, y0, z1], [x0, y0, z0], [x1, y0, z0], [x1, y0, z1]], [0, -1, 0]],
    [[[x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [x0, y0, z1]], [0, 0, 1]],
    [[[x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]], [0, 0, -1]]
  ];
  for (const [v, n] of faces) {
    const b = pos.length / 3;
    v.forEach((q, k) => {
      pos.push(...q);
      nor.push(...n);
      uv.push(k === 0 || k === 3 ? 0 : 1, k < 2 ? 0 : 1);
    });
    // glTF: sentido anti-horário visto de fora
    const e1 = [v[1][0] - v[0][0], v[1][1] - v[0][1], v[1][2] - v[0][2]];
    const e2 = [v[2][0] - v[0][0], v[2][1] - v[0][1], v[2][2] - v[0][2]];
    const c = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    if (c[0] * n[0] + c[1] * n[1] + c[2] * n[2] > 0) idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    else idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
  }
  const pv = pushFloats(pos, 34962), nv = pushFloats(nor, 34962), tv = pushFloats(uv, 34962), iv = pushIndices(idx);
  accessors.push({ bufferView: pv, componentType: 5126, count: pos.length / 3, type: 'VEC3', min: [x0, y0, z0], max: [x1, y1, z1] });
  const pa = accessors.length - 1;
  accessors.push({ bufferView: nv, componentType: 5126, count: nor.length / 3, type: 'VEC3' });
  const na = accessors.length - 1;
  accessors.push({ bufferView: tv, componentType: 5126, count: uv.length / 2, type: 'VEC2' });
  const ta = accessors.length - 1;
  accessors.push({ bufferView: iv, componentType: 5123, count: idx.length, type: 'SCALAR' });
  const ia = accessors.length - 1;
  materials.push({ name: p.name + '_mat', pbrMetallicRoughness: { baseColorFactor: [...p.color, 1], metallicFactor: 0.6, roughnessFactor: 0.45 } });
  meshes.push({ name: p.name, primitives: [{ attributes: { POSITION: pa, NORMAL: na, TEXCOORD_0: ta }, indices: ia, material: materials.length - 1 }] });
  nodes.push({ name: p.name, mesh: meshes.length - 1 });
}
nodes.push({ name: 'TestRifle', children: parts.map((_, i) => i) });
while (bin.length % 4) bin.push(0);
const json = {
  asset: { version: '2.0', generator: 'OPERATION STRIKE test generator' },
  scene: 0,
  scenes: [{ nodes: [nodes.length - 1] }],
  nodes, meshes, materials, accessors, bufferViews,
  buffers: [{ byteLength: bin.length }]
};
let js = Buffer.from(JSON.stringify(json));
const pad = (4 - (js.length % 4)) % 4;
js = Buffer.concat([js, Buffer.alloc(pad, 0x20)]);
const binBuf = Buffer.from(bin);
const total = 12 + 8 + js.length + 8 + binBuf.length;
const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(total, 8);
const jh = Buffer.alloc(8);
jh.writeUInt32LE(js.length, 0);
jh.writeUInt32LE(0x4e4f534a, 4);
const bh = Buffer.alloc(8);
bh.writeUInt32LE(binBuf.length, 0);
bh.writeUInt32LE(0x004e4942, 4);
writeFileSync(process.argv[2] ?? 'test.glb', Buffer.concat([header, jh, js, bh, binBuf]));
console.log('GLB de teste gerado:', process.argv[2] ?? 'test.glb', total, 'bytes');
