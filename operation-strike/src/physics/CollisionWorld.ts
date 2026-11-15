// Mundo de colisão próprio, baseado em caixas alinhadas aos eixos (AABB).
// É leve, determinístico e roda bem em celulares: o cenário é formado por caixas,
// o jogador é uma caixa (cápsula simplificada) e os tiros usam raycast contra as caixas.
// O servidor autoritativo (Etapa 6) poderá reutilizar este mesmo módulo, pois ele não depende do Babylon.

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type SurfaceKind = 'sand' | 'stone' | 'concrete' | 'wood' | 'metal';

export interface Collider {
  id: number;
  min: Vec3;
  max: Vec3;
  surface: SurfaceKind;
  /** Colisores desativados (ex.: porta aberta) são ignorados. */
  enabled: boolean;
  /** Bloqueia projéteis? (falso para cercas de arame, limites invisíveis altos etc.) */
  blocksBullets: boolean;
  /** Informação livre para o jogo (ex.: referência a uma porta). */
  tag?: string;
}

export interface RayHit {
  collider: Collider;
  distance: number;
  point: Vec3;
  normal: Vec3;
}

const CELL = 8; // tamanho da célula da grade espacial (metros)

export class CollisionWorld {
  private colliders: Collider[] = [];
  private grid = new Map<string, Collider[]>();
  private nextId = 1;
  private queryStamp = 0;
  private stamps = new Map<number, number>();

  add(min: Vec3, max: Vec3, surface: SurfaceKind = 'stone', opts: Partial<Collider> = {}): Collider {
    const c: Collider = {
      id: this.nextId++,
      min: { x: Math.min(min.x, max.x), y: Math.min(min.y, max.y), z: Math.min(min.z, max.z) },
      max: { x: Math.max(min.x, max.x), y: Math.max(min.y, max.y), z: Math.max(min.z, max.z) },
      surface,
      enabled: true,
      blocksBullets: true,
      ...opts
    };
    this.colliders.push(c);
    this.insert(c);
    return c;
  }

  /** Move um colisor dinâmico (portas, plataformas). */
  move(c: Collider, min: Vec3, max: Vec3): void {
    this.remove(c);
    c.min = { ...min };
    c.max = { ...max };
    this.insert(c);
  }

  get count(): number {
    return this.colliders.length;
  }

  all(): readonly Collider[] {
    return this.colliders;
  }

  private cellRange(min: Vec3, max: Vec3): [number, number, number, number] {
    return [Math.floor(min.x / CELL), Math.floor(max.x / CELL), Math.floor(min.z / CELL), Math.floor(max.z / CELL)];
  }

  private insert(c: Collider): void {
    const [x0, x1, z0, z1] = this.cellRange(c.min, c.max);
    for (let x = x0; x <= x1; x++)
      for (let z = z0; z <= z1; z++) {
        const k = x + ',' + z;
        let list = this.grid.get(k);
        if (!list) this.grid.set(k, (list = []));
        list.push(c);
      }
  }

  private remove(c: Collider): void {
    const [x0, x1, z0, z1] = this.cellRange(c.min, c.max);
    for (let x = x0; x <= x1; x++)
      for (let z = z0; z <= z1; z++) {
        const list = this.grid.get(x + ',' + z);
        if (!list) continue;
        const i = list.indexOf(c);
        if (i >= 0) list.splice(i, 1);
      }
  }

  /** Colisores ativos que tocam a caixa informada. */
  query(min: Vec3, max: Vec3, out: Collider[] = []): Collider[] {
    out.length = 0;
    const stamp = ++this.queryStamp;
    const [x0, x1, z0, z1] = this.cellRange(min, max);
    for (let x = x0; x <= x1; x++)
      for (let z = z0; z <= z1; z++) {
        const list = this.grid.get(x + ',' + z);
        if (!list) continue;
        for (const c of list) {
          if (!c.enabled || this.stamps.get(c.id) === stamp) continue;
          this.stamps.set(c.id, stamp);
          if (
            c.max.x > min.x && c.min.x < max.x &&
            c.max.y > min.y && c.min.y < max.y &&
            c.max.z > min.z && c.min.z < max.z
          ) out.push(c);
        }
      }
    return out;
  }

  /** Existe algum colisor ocupando a caixa? */
  overlaps(min: Vec3, max: Vec3): boolean {
    return this.query(min, max, scratch).length > 0;
  }

  /**
   * Raycast contra todas as caixas (teste de lâminas / slab test), percorrendo só as células da grade
   * atravessadas pelo raio. Retorna o impacto mais próximo.
   */
  raycast(origin: Vec3, dir: Vec3, maxDist: number, forBullets = true): RayHit | null {
    const len = Math.hypot(dir.x, dir.y, dir.z) || 1;
    const dx = dir.x / len, dy = dir.y / len, dz = dir.z / len;
    const end = { x: origin.x + dx * maxDist, y: origin.y + dy * maxDist, z: origin.z + dz * maxDist };
    const min = { x: Math.min(origin.x, end.x), y: Math.min(origin.y, end.y), z: Math.min(origin.z, end.z) };
    const max = { x: Math.max(origin.x, end.x), y: Math.max(origin.y, end.y), z: Math.max(origin.z, end.z) };
    const candidates = this.query(min, max, scratch);
    let best: RayHit | null = null;
    let bestT = maxDist;
    for (const c of candidates) {
      if (forBullets && !c.blocksBullets) continue;
      const t = rayBox(origin, dx, dy, dz, c, bestT);
      if (t === null) continue;
      bestT = t.t;
      best = {
        collider: c,
        distance: t.t,
        point: { x: origin.x + dx * t.t, y: origin.y + dy * t.t, z: origin.z + dz * t.t },
        normal: t.n
      };
    }
    return best;
  }
}

const scratch: Collider[] = [];

function rayBox(o: Vec3, dx: number, dy: number, dz: number, c: Collider, maxT: number): { t: number; n: Vec3 } | null {
  let tmin = -Infinity, tmax = Infinity;
  let axis = -1, sign = 0;
  const ds = [dx, dy, dz];
  const os = [o.x, o.y, o.z];
  const mins = [c.min.x, c.min.y, c.min.z];
  const maxs = [c.max.x, c.max.y, c.max.z];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(ds[i]) < 1e-9) {
      if (os[i] < mins[i] || os[i] > maxs[i]) return null;
      continue;
    }
    let t1 = (mins[i] - os[i]) / ds[i];
    let t2 = (maxs[i] - os[i]) / ds[i];
    let s = -1;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; s = 1; }
    if (t1 > tmin) { tmin = t1; axis = i; sign = s; }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }
  if (tmin < 0 || tmin > maxT || axis < 0) return null; // origem dentro da caixa ou longe demais
  const n = { x: 0, y: 0, z: 0 };
  if (axis === 0) n.x = sign; else if (axis === 1) n.y = sign; else n.z = sign;
  return { t: tmin, n };
}
