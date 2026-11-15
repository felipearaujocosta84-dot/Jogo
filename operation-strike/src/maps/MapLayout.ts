// Expande a definição do mapa (grade ASCII + objetos) numa lista de caixas e pisos.
// Função pura e determinística: cliente e servidor geram exatamente a mesma geometria.
import type { BoxDef, FloorDef, MapDefinition } from './MapTypes';

export function hash(a: number, b: number, c = 0): number {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export interface MapLayout {
  boxes: BoxDef[];
  floors: FloorDef[];
}

const cache = new Map<string, MapLayout>();

export function expandMap(def: MapDefinition): MapLayout {
  const hit = cache.get(def.id);
  if (hit) return hit;
  const boxes: BoxDef[] = [];
  const floors: FloorDef[] = [];
  const rows = def.grid.length, cols = def.grid[0].length;
  const used: boolean[][] = def.grid.map(r => Array.from(r, () => false));
  const cs = def.cell;

  for (let r = 0; r < rows; r++) {
    if (def.grid[r].length !== cols) throw new Error(`Mapa ${def.id}: linha ${r} com largura ${def.grid[r].length} (esperado ${cols})`);
    for (let c = 0; c < cols; c++) {
      if (used[r][c]) continue;
      const ch = def.grid[r][c];
      const kind = def.legend[ch];
      if (!kind) throw new Error(`Mapa ${def.id}: símbolo desconhecido '${ch}' na linha ${r}`);
      const maxW = kind.type === 'solid' ? 3 : cols;
      const maxH = kind.type === 'solid' ? 3 : rows;
      let w = 1;
      while (c + w < cols && w < maxW && !used[r][c + w] && def.grid[r][c + w] === ch) w++;
      let h = 1;
      outer: while (r + h < rows && h < maxH) {
        for (let k = 0; k < w; k++) if (used[r + h][c + k] || def.grid[r + h][c + k] !== ch) break outer;
        h++;
      }
      for (let i = 0; i < h; i++) for (let k = 0; k < w; k++) used[r + i][c + k] = true;
      const x0 = def.originX + c * cs, x1 = x0 + w * cs;
      const z1 = def.originZ - r * cs, z0 = z1 - h * cs;
      const rnd = hash(r, c, ch.charCodeAt(0));
      if (kind.type === 'solid') {
        const [hMin, hMax] = kind.height ?? [6, 8];
        const height = Math.round((hMin + (hMax - hMin) * rnd) * 2) / 2;
        boxes.push({ min: [x0, 0, z0], max: [x1, height, z1], mat: kind.material });
        if (kind.material === 'plaster' || kind.material === 'brick' || kind.material === 'glass') decorate(boxes, x0, z0, x1, z1, height, r, c, kind.material);
      } else {
        floors.push({ x0, z0, x1, z1, y: 0, mat: kind.floor ?? kind.material });
        if (kind.type === 'roofed') {
          const [y] = kind.height ?? [3.6, 3.6];
          boxes.push({ min: [x0, y, z0], max: [x1, y + 0.4, z1], mat: kind.roof ?? 'roof' });
        }
      }
    }
  }
  for (const b of def.boxes) boxes.push(b);
  const out = { boxes, floors };
  cache.set(def.id, out);
  return out;
}

/** Beiral e janelas nas fachadas (somente visual). */
function decorate(boxes: BoxDef[], x0: number, z0: number, x1: number, z1: number, h: number, r: number, c: number, mat: string): void {
  const o = 0.12;
  boxes.push({ min: [x0 - o, h - 0.35, z0 - o], max: [x1 + o, h, z1 + o], mat: mat === 'glass' ? 'steel' : 'trim', collide: false, shadow: false });
  if (h < 5 || mat === 'glass') return; // fachadas de vidro já têm a grade de janelas na textura
  const sides: [number, number, number, number, 'x' | 'z'][] = [
    [x0, z0 - 0.06, x1, z0, 'x'],
    [x0, z1, x1, z1 + 0.06, 'x'],
    [x0 - 0.06, z0, x0, z1, 'z'],
    [x1, z0, x1 + 0.06, z1, 'z']
  ];
  sides.forEach(([ax0, az0, ax1, az1, axis], si) => {
    const len = axis === 'x' ? ax1 - ax0 : az1 - az0;
    const n = Math.floor(len / 4);
    for (let i = 0; i < n; i++) {
      if (mat !== 'glass' && hash(r * 31 + si, c * 17 + i, 5) < 0.45) continue;
      const centre = (axis === 'x' ? ax0 : az0) + (i + 0.5) * (len / n);
      const floorsN = mat === 'glass' ? Math.floor((h - 1) / 3.5) : 1;
      for (let f = 0; f < floorsN; f++) {
        const y0 = 3.1 + f * 3.5, y1 = y0 + 1.4;
        if (y1 > h - 0.5) break;
        if (axis === 'x') boxes.push({ min: [centre - 0.6, y0, az0], max: [centre + 0.6, y1, az1], mat: 'dark', collide: false, shadow: false, detail: true });
        else boxes.push({ min: [ax0, y0, centre - 0.6], max: [ax1, y1, centre + 0.6], mat: 'dark', collide: false, shadow: false, detail: true });
      }
    }
  });
}
