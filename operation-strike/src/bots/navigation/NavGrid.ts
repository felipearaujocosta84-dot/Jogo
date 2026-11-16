// Grade de navegação para os bots (1 m por célula), gerada automaticamente a partir do mundo de colisão.
// Busca de caminho A* com 8 vizinhos, sem cortar quinas, custo extra perto de paredes (bots andam pelo meio)
// e suavização do caminho por linha de visão na grade.
import type { MapRuntime } from '../../maps/MapRuntime';

export interface NavPoint {
  x: number;
  z: number;
}

const SQRT2 = Math.SQRT2;

class Heap {
  private items: number[] = [];
  private prio: number[] = [];
  get size(): number {
    return this.items.length;
  }
  push(item: number, p: number): void {
    const a = this.items, pr = this.prio;
    a.push(item);
    pr.push(p);
    let i = a.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (pr[parent] <= pr[i]) break;
      [a[parent], a[i]] = [a[i], a[parent]];
      [pr[parent], pr[i]] = [pr[i], pr[parent]];
      i = parent;
    }
  }
  pop(): number {
    const a = this.items, pr = this.prio;
    const top = a[0];
    const lastI = a.pop()!, lastP = pr.pop()!;
    if (a.length) {
      a[0] = lastI;
      pr[0] = lastP;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < a.length && pr[l] < pr[m]) m = l;
        if (r < a.length && pr[r] < pr[m]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        [pr[m], pr[i]] = [pr[i], pr[m]];
        i = m;
      }
    }
    return top;
  }
}

export class NavGrid {
  readonly res: number;
  /** Altura do chão por célula (mapas com relevo/andares). */
  readonly height: Float32Array;
  private hasHeight: boolean;
  readonly cols: number;
  readonly rows: number;
  readonly minX: number;
  readonly minZ: number;
  readonly walk: Uint8Array;
  private penalty: Float32Array;
  private g: Float32Array;
  private parent: Int32Array;
  private stamp: Uint32Array;
  private closed: Uint32Array;
  private search = 0;
  /** Lista de células caminháveis (para sortear pontos). */
  readonly walkable: number[] = [];

  constructor(map: MapRuntime) {
    const b = map.bounds;
    // arenas de modelo 3D: células menores e altura do chão (degraus, rampas, terreno)
    this.hasHeight = !!map.def.model;
    this.res = this.hasHeight ? 0.5 : 1;
    this.minX = b.minX;
    this.minZ = b.minZ;
    this.cols = Math.ceil((b.maxX - b.minX) / this.res);
    this.rows = Math.ceil((b.maxZ - b.minZ) / this.res);
    const n = this.cols * this.rows;
    this.walk = new Uint8Array(n);
    this.height = new Float32Array(n);
    this.penalty = new Float32Array(n);
    this.g = new Float32Array(n);
    this.parent = new Int32Array(n);
    this.stamp = new Uint32Array(n);
    this.closed = new Uint32Array(n);
    // Portas contam como passagem livre (os bots abrem quando estão fechadas)
    const doorColliders = map.doors.flatMap(d => d.leaves.map(l => l.collider));
    const prev = doorColliders.map(c => c.enabled);
    for (const c of doorColliders) c.enabled = false;
    const r = this.hasHeight ? 0.3 : 0.36;
    for (let j = 0; j < this.rows; j++)
      for (let i = 0; i < this.cols; i++) {
        const x = this.minX + (i + 0.5) * this.res, z = this.minZ + (j + 0.5) * this.res;
        let free: boolean;
        if (this.hasHeight) {
          const g = map.groundAt(x, z, r);
          free = g.free;
          this.height[j * this.cols + i] = g.y;
        } else free = !map.world.overlaps({ x: x - r, y: 0.06, z: z - r }, { x: x + r, y: 1.75, z: z + r });
        if (free) {
          this.walk[j * this.cols + i] = 1;
          this.walkable.push(j * this.cols + i);
        }
      }
    doorColliders.forEach((c, k) => (c.enabled = prev[k]));
    // Penalidade perto de obstáculos
    for (let j = 0; j < this.rows; j++)
      for (let i = 0; i < this.cols; i++) {
        const k = j * this.cols + i;
        if (!this.walk[k]) continue;
        let near = 0;
        for (let dj = -1; dj <= 1; dj++)
          for (let di = -1; di <= 1; di++) if (!this.walkAt(i + di, j + dj)) near++;
        this.penalty[k] = near ? 1.5 + near * 0.3 : 0;
      }
  }

  walkAt(i: number, j: number): boolean {
    if (i < 0 || j < 0 || i >= this.cols || j >= this.rows) return false;
    return this.walk[j * this.cols + i] === 1;
  }

  /** Dá para ir da célula a para a vizinha b? (subir até 0,56 m; descer até 2,5 m) */
  private step(a: number, b: number): boolean {
    if (!this.hasHeight) return true;
    const dh = this.height[b] - this.height[a];
    return dh <= 0.5 && dh >= -2.5;
  }

  cellX(x: number): number {
    return Math.floor((x - this.minX) / this.res);
  }

  cellZ(z: number): number {
    return Math.floor((z - this.minZ) / this.res);
  }

  center(k: number): NavPoint {
    const i = k % this.cols, j = (k / this.cols) | 0;
    return { x: this.minX + (i + 0.5) * this.res, z: this.minZ + (j + 0.5) * this.res };
  }

  isWalkable(x: number, z: number): boolean {
    return this.walkAt(this.cellX(x), this.cellZ(z));
  }

  /** Célula caminhável mais próxima (busca em espiral). */
  nearest(x: number, z: number): number {
    const ci = this.cellX(x), cj = this.cellZ(z);
    for (let rad = 0; rad < 12; rad++)
      for (let dj = -rad; dj <= rad; dj++)
        for (let di = -rad; di <= rad; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== rad) continue;
          if (this.walkAt(ci + di, cj + dj)) return (cj + dj) * this.cols + ci + di;
        }
    return -1;
  }

  /** Linha reta caminhável entre dois pontos (com folga lateral). */
  clearLine(ax: number, az: number, bx: number, bz: number): boolean {
    const dx = bx - ax, dz = bz - az;
    const dist = Math.hypot(dx, dz);
    const steps = Math.ceil(dist / (this.res * 0.5));
    const nx = dist > 0 ? -dz / dist : 0, nz = dist > 0 ? dx / dist : 0;
    let prev = -1;
    for (let s = 0; s <= steps; s++) {
      const t = steps ? s / steps : 0;
      const x = ax + dx * t, z = az + dz * t;
      if (this.hasHeight) {
        const k = this.cellZ(z) * this.cols + this.cellX(x);
        if (s > 0 && prev >= 0 && k !== prev && Math.abs(this.height[k] - this.height[prev]) > 0.5) return false;
        prev = k;
      }
      if (!this.isWalkable(x, z) || !this.isWalkable(x + nx * 0.3, z + nz * 0.3) || !this.isWalkable(x - nx * 0.3, z - nz * 0.3)) return false;
    }
    return true;
  }

  findPath(sx: number, sz: number, tx: number, tz: number, maxNodes = 20000): NavPoint[] | null {
    const start = this.nearest(sx, sz), goal = this.nearest(tx, tz);
    if (start < 0 || goal < 0) return null;
    if (start === goal) return [{ x: tx, z: tz }];
    const id = ++this.search;
    const cols = this.cols;
    const gi = goal % cols, gj = (goal / cols) | 0;
    const h = (k: number) => {
      const dx = Math.abs((k % cols) - gi), dz = Math.abs(((k / cols) | 0) - gj);
      return dx + dz + (SQRT2 - 2) * Math.min(dx, dz);
    };
    const open = new Heap();
    this.g[start] = 0;
    this.stamp[start] = id;
    this.parent[start] = -1;
    open.push(start, h(start));
    let expanded = 0;
    let found = false;
    while (open.size) {
      const cur = open.pop();
      if (this.closed[cur] === id) continue;
      this.closed[cur] = id;
      if (cur === goal) {
        found = true;
        break;
      }
      if (++expanded > maxNodes) break;
      const ci = cur % cols, cj = (cur / cols) | 0;
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const ni = ci + di, nj = cj + dj;
          if (!this.walkAt(ni, nj)) continue;
          if (di && dj && (!this.walkAt(ci + di, cj) || !this.walkAt(ci, cj + dj))) continue; // sem cortar quinas
          const nk = nj * cols + ni;
          if (this.closed[nk] === id || !this.step(cur, nk)) continue;
          const ng = this.g[cur] + (di && dj ? SQRT2 : 1) + this.penalty[nk];
          if (this.stamp[nk] !== id || ng < this.g[nk]) {
            this.stamp[nk] = id;
            this.g[nk] = ng;
            this.parent[nk] = cur;
            open.push(nk, ng + h(nk));
          }
        }
    }
    if (!found) return null;
    const cells: number[] = [];
    for (let k = goal; k !== -1; k = this.parent[k]) cells.push(k);
    cells.reverse();
    // Suavização: pula pontos intermediários com linha livre
    const pts = cells.map(k => this.center(k));
    pts[pts.length - 1] = { x: tx, z: tz };
    if (!this.isWalkable(tx, tz)) pts[pts.length - 1] = this.center(goal);
    const out: NavPoint[] = [];
    let anchor = { x: sx, z: sz };
    let i = 0;
    while (i < pts.length - 1) {
      let j = Math.min(pts.length - 1, i + 24);
      while (j > i + 1 && !this.clearLine(anchor.x, anchor.z, pts[j].x, pts[j].z)) j--;
      out.push(pts[j]);
      anchor = pts[j];
      i = j;
    }
    if (!out.length) out.push(pts[pts.length - 1]);
    return out;
  }

  /** Ponto caminhável aleatório dentro de um retângulo (ex.: local de bomba). */
  randomIn(minX: number, minZ: number, maxX: number, maxZ: number, rnd: () => number): NavPoint | null {
    for (let k = 0; k < 40; k++) {
      const x = minX + 1 + rnd() * (maxX - minX - 2), z = minZ + 1 + rnd() * (maxZ - minZ - 2);
      const c = this.nearest(x, z);
      if (c >= 0 && this.penalty[c] === 0) return this.center(c);
    }
    const c = this.nearest((minX + maxX) / 2, (minZ + maxZ) / 2);
    return c >= 0 ? this.center(c) : null;
  }

  randomNear(x: number, z: number, radius: number, rnd: () => number): NavPoint | null {
    return this.randomIn(x - radius, z - radius, x + radius, z + radius, rnd);
  }
}
