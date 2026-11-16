// Mapa em tempo de execução (sem gráficos): colisão, portas, zonas, locais de bomba e nascimentos.
// Usado pela simulação no navegador e pelo servidor autoritativo.
import { CollisionWorld, type Collider, type Vec3 } from '../physics/CollisionWorld';
import { expandMap } from './MapLayout';
import { MODEL_SURFACES } from './ModelMaps';
import { MATERIAL_SURFACE, type DoorDef, type MapDefinition, type SpawnPoint } from './MapTypes';
import type { Team } from '../sim/types';

export interface DoorRuntime {
  index: number;
  def: DoorDef;
  open: boolean;
  /** 0 = fechada, 1 = aberta */
  t: number;
  leaves: { collider: Collider; closedMin: Vec3; closedMax: Vec3; openOffset: number }[];
  center: Vec3;
}

export type Box = [Vec3, Vec3];

export class MapRuntime {
  readonly world: CollisionWorld;
  readonly doors: DoorRuntime[] = [];
  readonly bounds: { minX: number; maxX: number; minZ: number; maxZ: number };

  constructor(readonly def: MapDefinition) {
    // mapas de modelo 3D têm milhares de caixas pequenas: grade espacial mais fina
    this.world = new CollisionWorld(def.model ? 2 : 8);
    if (def.model) {
      if (!def.colliders || !def.modelBounds) throw new Error(`Dados de colisão do mapa ${def.id} não carregados`);
      this.bounds = { ...def.modelBounds };
      for (const c of def.colliders)
        this.world.add({ x: c[0] / 100, y: c[1] / 100, z: c[2] / 100 }, { x: c[3] / 100, y: c[4] / 100, z: c[5] / 100 }, MODEL_SURFACES[c[6]] ?? 'concrete');
    } else {
      const cols = def.grid[0].length, rows = def.grid.length;
      this.bounds = { minX: def.originX, maxX: def.originX + cols * def.cell, minZ: def.originZ - rows * def.cell, maxZ: def.originZ };
    }
    const { minX, maxX, minZ, maxZ } = this.bounds;
    const layout = def.model ? { boxes: [] } : expandMap(def);
    for (const b of layout.boxes) {
      if (b.collide === false) continue;
      this.world.add({ x: b.min[0], y: b.min[1], z: b.min[2] }, { x: b.max[0], y: b.max[1], z: b.max[2] }, MATERIAL_SURFACE[b.mat], {
        blocksBullets: b.bullets !== false
      });
    }
    this.world.add({ x: minX - 10, y: -2, z: minZ - 10 }, { x: maxX + 10, y: 0, z: maxZ + 10 }, 'sand');
    const H = 40, T = 2, inv = { blocksBullets: false };
    this.world.add({ x: minX - T, y: 0, z: minZ - T }, { x: minX, y: H, z: maxZ + T }, 'stone', inv);
    this.world.add({ x: maxX, y: 0, z: minZ - T }, { x: maxX + T, y: H, z: maxZ + T }, 'stone', inv);
    this.world.add({ x: minX, y: 0, z: minZ - T }, { x: maxX, y: H, z: minZ }, 'stone', inv);
    this.world.add({ x: minX, y: 0, z: maxZ }, { x: maxX, y: H, z: maxZ + T }, 'stone', inv);
    this.world.add({ x: minX, y: H, z: minZ }, { x: maxX, y: H + T, z: maxZ }, 'stone', inv);

    def.doors.forEach((d, index) => {
      const [x0, y0, z0] = d.min;
      const [x1, y1, z1] = d.max;
      const along = d.axis === 'x' ? x1 - x0 : z1 - z0;
      const half = along / 2;
      const door: DoorRuntime = { index, def: d, open: d.open, t: d.open ? 1 : 0, leaves: [], center: { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: (z0 + z1) / 2 } };
      for (const side of [-1, 1]) {
        const lmin: Vec3 = d.axis === 'x' ? { x: side < 0 ? x0 : x0 + half, y: y0, z: z0 } : { x: x0, y: y0, z: side < 0 ? z0 : z0 + half };
        const lmax: Vec3 = d.axis === 'x' ? { x: side < 0 ? x0 + half : x1, y: y1, z: z1 } : { x: x1, y: y1, z: side < 0 ? z0 + half : z1 };
        const collider = this.world.add(lmin, lmax, 'metal', { tag: 'door:' + d.id });
        door.leaves.push({ collider, closedMin: lmin, closedMax: lmax, openOffset: side * (half - 0.08) });
      }
      this.applyDoor(door);
      this.doors.push(door);
    });
  }

  /** Caixa de cada folha na posição atual (para o desenho). */
  leafBox(door: DoorRuntime, i: number): Box {
    const leaf = door.leaves[i];
    const off = leaf.openOffset * door.t;
    const ax = door.def.axis;
    const min = { ...leaf.closedMin }, max = { ...leaf.closedMax };
    min[ax] += off;
    max[ax] += off;
    return [min, max];
  }

  private applyDoor(door: DoorRuntime): void {
    for (let i = 0; i < door.leaves.length; i++) {
      const [min, max] = this.leafBox(door, i);
      this.world.move(door.leaves[i].collider, min, max);
      door.leaves[i].collider.enabled = door.t < 0.98;
    }
  }

  private doorBlocked(door: DoorRuntime, blockers: Box[]): boolean {
    for (const [pm, pM] of blockers)
      for (const leaf of door.leaves) {
        const a = leaf.closedMin, b = leaf.closedMax;
        if (pM.x > a.x && pm.x < b.x && pM.y > a.y && pm.y < b.y && pM.z > a.z && pm.z < b.z) return true;
      }
    return false;
  }

  toggleDoor(door: DoorRuntime, blockers: Box[]): boolean {
    if (door.open && this.doorBlocked(door, blockers)) return false;
    door.open = !door.open;
    return true;
  }

  /** Estado vindo do servidor (cliente online). */
  setDoorState(index: number, open: boolean): void {
    const d = this.doors[index];
    if (d) d.open = open;
  }

  update(dt: number, blockers: Box[]): void {
    for (const d of this.doors) {
      if (!d.open && d.t > 0 && this.doorBlocked(d, blockers)) d.open = true;
      const target = d.open ? 1 : 0;
      if (d.t === target) continue;
      d.t += Math.sign(target - d.t) * dt * 1.8;
      d.t = Math.max(0, Math.min(1, d.t));
      if (Math.abs(d.t - target) < 0.01) d.t = target;
      this.applyDoor(d);
    }
  }

  zoneAt(x: number, z: number): string {
    for (const zn of this.def.zones) if (x >= zn.min[0] && x <= zn.max[0] && z >= zn.min[1] && z <= zn.max[1]) return zn.name;
    return '';
  }

  siteAt(x: number, z: number): 'A' | 'B' | null {
    for (const s of this.def.sites) if (x >= s.min[0] && x <= s.max[0] && z >= s.min[1] && z <= s.max[1]) return s.name;
    return null;
  }

  spawn(team: Team, index: number): SpawnPoint {
    const list = this.def.spawns[team];
    return list[((index % list.length) + list.length) % list.length];
  }

  spawnCenter(team: Team): { x: number; z: number } {
    const list = this.def.spawns[team];
    let x = 0, z = 0;
    for (const s of list) {
      x += s.x;
      z += s.z;
    }
    return { x: x / list.length, z: z / list.length };
  }

  /**
   * Altura do chão caminhável num ponto (sobe degraus de até 0,55 m a partir do chão mais baixo) e se há
   * espaço para uma pessoa em pé ali. Usado pela navegação dos bots e pelo radar dos mapas com relevo.
   */
  groundAt(x: number, z: number, r = 0.36): { y: number; free: boolean } {
    const hits: Collider[] = [];
    // chão = topo da pilha sólida contínua que começa embaixo de tudo (terreno, piso, base)
    this.world.query({ x: x - 0.05, y: -5, z: z - 0.05 }, { x: x + 0.05, y: 80, z: z + 0.05 }, hits);
    hits.sort((a, b) => a.min.y - b.min.y);
    let y = hits.length ? hits[0].min.y : 0;
    for (const c of hits) {
      if (c.min.y > y + 0.05) break;
      if (c.max.y > y) y = c.max.y;
    }
    for (let k = 0; k < 24; k++) {
      this.world.query({ x: x - r, y: y + 0.06, z: z - r }, { x: x + r, y: y + 1.75, z: z + r }, hits);
      if (!hits.length) return { y, free: true };
      let top = -Infinity;
      for (const c of hits) top = Math.max(top, c.max.y);
      if (top - y > 0.5) return { y, free: false };
      y = top;
    }
    return { y, free: false };
  }

  solidAt(x: number, z: number): boolean {
    const d = this.def;
    if (d.model) return !this.groundAt(x, z).free;
    const c = Math.floor((x - d.originX) / d.cell);
    const r = Math.floor((d.originZ - z) / d.cell);
    const row = d.grid[r];
    if (!row || c < 0 || c >= row.length) return true;
    const k = d.legend[row[c]];
    return !k || k.type === 'solid';
  }
}
