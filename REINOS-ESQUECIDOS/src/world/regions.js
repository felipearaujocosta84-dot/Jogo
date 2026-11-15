// Regiões do mundo: nomes, limites, clima/ambiente e cenários extras construídos por código
// (decoração da aldeia, acampamento goblin, ninho das aranhas, ruínas antigas).
import { MeshBuilder, Mesh, Vector3, Color3, Color4, StandardMaterial, VertexBuffer } from '../babylon.js';
import { addOccluder } from './occlusion.js';

export const REGION_DEFS = [
  { id: 'aldeia', name: 'Aldeia Inicial', sub: 'Um refúgio seguro', x: 49, z: -28, r: 21, safe: true, fog: [0.78, 0.84, 0.88] },
  { id: 'ruinas', name: 'Ruínas Antigas', sub: 'Onde dorme o Rei Esquecido', x: 45, z: 52, r: 22, fog: [0.62, 0.6, 0.66] },
  { id: 'floresta', name: 'Floresta Sombria', sub: 'Território dos goblins', x: -50, z: 45, r: 30, fog: [0.55, 0.64, 0.6] },
  { id: 'ninho', name: 'Ninho das Aranhas', sub: 'Teias entre as pedras', x: -58, z: -55, r: 22, fog: [0.6, 0.62, 0.6] },
  { id: 'lago', name: 'Lago Azul', sub: 'Águas calmas e ervas raras', x: 0, z: 0, r: 0, fog: [0.74, 0.84, 0.9] },
  { id: 'vale', name: 'Vale Verde', sub: 'Campos abertos do reino', x: 8, z: 0, r: 46, fog: [0.78, 0.86, 0.92] }
];
const WILD = { id: 'ermos', name: 'Terras Selvagens', sub: 'Longe da estrada do rei', fog: [0.74, 0.8, 0.86] };

/** Define cor de vértice uniforme numa malha (para mesclar peças com cores diferentes). */
export function paint(mesh, c, jitter = 0) {
  const n = mesh.getTotalVertices();
  const cols = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const j = jitter ? 1 + (Math.random() - 0.5) * jitter : 1;
    cols[i * 4] = c[0] * j; cols[i * 4 + 1] = c[1] * j; cols[i * 4 + 2] = c[2] * j; cols[i * 4 + 3] = 1;
  }
  mesh.setVerticesData(VertexBuffer.ColorKind, cols);
  return mesh;
}

export class Regions {
  constructor(game, world) {
    this.game = game;
    this.world = world;
    this.scene = game.scene;
    this.defs = REGION_DEFS.map((d) => ({ ...d }));
    this.current = null;
    this.parts = [];
    this.chestSpots = [];
    this.herbSpots = [];
    this.campfires = [];
  }

  get(id) {
    return this.defs.find((d) => d.id === id);
  }

  regionAt(x, z) {
    for (const d of this.defs) {
      const dx = x - d.x, dz = z - d.z;
      if (dx * dx + dz * dz < d.r * d.r) return d;
    }
    return WILD;
  }

  ground(x, z) {
    return this.world.terrain.heightAt(x, z);
  }

  /** Adiciona uma peça (será mesclada ao final num único objeto). */
  part(mesh, color, x, z, y = null, jitter = 0.08) {
    paint(mesh, color, jitter);
    mesh.position.x += x;
    mesh.position.z += z;
    mesh.position.y += (y === null ? this.ground(x, z) : y);
    this.parts.push(mesh);
    return mesh;
  }

  build() {
    const w = this.world;
    // Região do lago acompanha a água gerada
    const lago = this.get('lago');
    if (w.lake) { lago.x = w.lake.x; lago.z = w.lake.z; lago.r = w.lake.r + 6; }

    this.buildVillage();
    this.buildGoblinCamp();
    this.buildSpiderNest();
    this.buildRuins();
    this.computeHerbSpots();

    // todas as peças estáticas viram UMA malha (1 chamada de desenho)
    const merged = Mesh.MergeMeshes(this.parts, true, true);
    if (merged) {
      merged.name = 'cenarios';
      const mat = new StandardMaterial('propsMat', this.scene);
      mat.specularColor = new Color3(0.06, 0.06, 0.06);
      merged.material = mat;
      addOccluder(mat);
      merged.receiveShadows = true;
      merged.isPickable = false;
      merged.freezeWorldMatrix();
      this.game.addShadowCaster(merged, true);
      this.mesh = merged;
    }
    this.parts = [];
  }

  // ---------------- ALDEIA ----------------
  buildVillage() {
    const s = this.scene, w = this.world;
    const wood = [0.42, 0.29, 0.18], darkWood = [0.28, 0.19, 0.12], stone = [0.5, 0.5, 0.48];
    const v = this.get('aldeia');

    // portas e chaminés nas casas do mapa (porta voltada ao centro da aldeia)
    for (const h of w.houses) {
      const cx = (h.minX + h.maxX) / 2, cz = (h.minZ + h.maxZ) / 2;
      const dx = v.x - cx, dz = v.z - cz;
      const door = MeshBuilder.CreateBox('door', { width: 1.1, height: 1.9, depth: 0.12 }, s);
      let px, pz;
      if (Math.abs(dx) > Math.abs(dz)) {
        door.rotation.y = Math.PI / 2;
        px = dx > 0 ? h.maxX - 0.2 : h.minX + 0.2; pz = cz;
      } else {
        px = cx; pz = dz > 0 ? h.maxZ - 0.2 : h.minZ + 0.2;
      }
      this.part(door, darkWood, px, pz, h.floor + 0.95);
      // janelas
      for (const side of [-1, 1]) {
        const win = MeshBuilder.CreateBox('win', { width: 0.7, height: 0.6, depth: 0.12 }, s);
        if (Math.abs(dx) > Math.abs(dz)) {
          win.rotation.y = Math.PI / 2;
          this.part(win, [0.95, 0.78, 0.4], px, cz + side * 1.5, h.floor + 2.0, 0);
        } else {
          this.part(win, [0.95, 0.78, 0.4], cx + side * 1.5, pz, h.floor + 2.0, 0);
        }
      }
      const ch = MeshBuilder.CreateBox('chimney', { width: 0.6, height: 2.4, depth: 0.6 }, s);
      this.part(ch, stone, h.maxX - 1, h.maxZ - 1.2, h.top + 1.2);
    }

    // poço
    const wellX = 52.5, wellZ = -27.5;
    const ring = MeshBuilder.CreateCylinder('well', { diameter: 2.2, height: 1, tessellation: 14 }, s);
    this.part(ring, stone, wellX, wellZ, this.ground(wellX, wellZ) + 0.45, 0.2);
    const water = MeshBuilder.CreateCylinder('wellWater', { diameter: 1.7, height: 0.05, tessellation: 12 }, s);
    this.part(water, [0.15, 0.3, 0.38], wellX, wellZ, this.ground(wellX, wellZ) + 0.85, 0);
    for (const sx of [-1, 1]) {
      const post = MeshBuilder.CreateBox('wellPost', { width: 0.15, height: 2.2, depth: 0.15 }, s);
      this.part(post, wood, wellX + sx * 0.95, wellZ, this.ground(wellX, wellZ) + 1.3);
    }
    const roof = MeshBuilder.CreateCylinder('wellRoof', { diameterTop: 0, diameterBottom: 2.6, height: 1, tessellation: 4 }, s);
    roof.rotation.y = Math.PI / 4;
    this.part(roof, [0.45, 0.24, 0.17], wellX, wellZ, this.ground(wellX, wellZ) + 2.85);
    w.addCircle({ x: wellX, z: wellZ, r: 1.2, kind: 'prop' });
    this.well = { x: wellX, z: wellZ };

    // fogueira central
    const fx = 43, fz = -34;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const st = MeshBuilder.CreateSphere('fstone', { diameter: 0.4, segments: 4 }, s);
      st.scaling.y = 0.6;
      this.part(st, stone, fx + Math.cos(a) * 0.75, fz + Math.sin(a) * 0.75, null, 0.25);
    }
    for (let i = 0; i < 3; i++) {
      const log = MeshBuilder.CreateCylinder('flog', { diameter: 0.16, height: 1.1, tessellation: 6 }, s);
      log.rotation.z = Math.PI / 2;
      log.rotation.y = (i / 3) * Math.PI;
      this.part(log, darkWood, fx, fz, this.ground(fx, fz) + 0.12);
    }
    // bancos de tronco
    for (const [bx, bz, ry] of [[fx + 2.4, fz, 0], [fx - 2.4, fz, 0], [fx, fz + 2.4, Math.PI / 2]]) {
      const bench = MeshBuilder.CreateCylinder('bench', { diameter: 0.5, height: 1.8, tessellation: 8 }, s);
      bench.rotation.x = Math.PI / 2;
      bench.rotation.y = ry;
      this.part(bench, wood, bx, bz, this.ground(bx, bz) + 0.25);
    }
    this.campfires.push({ x: fx, z: fz, light: true });
    w.addCircle({ x: fx, z: fz, r: 0.9, kind: 'prop' });

    // bigorna e forja do ferreiro
    const ax = 58.5, az = -28.5;
    const anvil = MeshBuilder.CreateBox('anvil', { width: 0.9, height: 0.45, depth: 0.4 }, s);
    this.part(anvil, [0.22, 0.22, 0.24], ax, az, this.ground(ax, az) + 0.75, 0);
    const stump = MeshBuilder.CreateCylinder('stump', { diameter: 0.6, height: 0.55, tessellation: 8 }, s);
    this.part(stump, darkWood, ax, az, this.ground(ax, az) + 0.27);
    const forge = MeshBuilder.CreateBox('forge', { width: 1.6, height: 1.1, depth: 1.4 }, s);
    this.part(forge, [0.4, 0.38, 0.36], ax + 2, az + 0.5, this.ground(ax + 2, az + 0.5) + 0.55, 0.2);
    const coals = MeshBuilder.CreateBox('coals', { width: 1.1, height: 0.1, depth: 0.9 }, s);
    this.part(coals, [1.0, 0.45, 0.12], ax + 2, az + 0.5, this.ground(ax + 2, az + 0.5) + 1.12, 0.3);
    w.addCircle({ x: ax + 2, z: az + 0.5, r: 1.0, kind: 'prop' });
    w.addCircle({ x: ax, z: az, r: 0.5, kind: 'prop' });

    // barraca de mercado
    const mx = 39, mz = -23.5;
    const counter = MeshBuilder.CreateBox('counter', { width: 2.6, height: 0.9, depth: 0.9 }, s);
    this.part(counter, wood, mx, mz, this.ground(mx, mz) + 0.45);
    for (const sx of [-1.2, 1.2]) {
      const p = MeshBuilder.CreateBox('stallPost', { width: 0.12, height: 2.4, depth: 0.12 }, s);
      this.part(p, darkWood, mx + sx, mz - 0.4, this.ground(mx, mz) + 1.2);
    }
    const awning = MeshBuilder.CreateBox('awning', { width: 3, height: 0.08, depth: 1.6 }, s);
    awning.rotation.x = 0.25;
    this.part(awning, [0.65, 0.18, 0.15], mx, mz - 0.1, this.ground(mx, mz) + 2.35, 0.05);
    w.addBox({ minX: mx - 1.4, maxX: mx + 1.4, minZ: mz - 0.55, maxZ: mz + 0.55, kind: 'prop' });

    // barris, caixas e fardos de feno
    const clutter = [[54.5, -23, 'barrel'], [55.3, -23.6, 'barrel'], [46, -31.5, 'crate'], [46.9, -31.8, 'crate'],
      [41, -18.5, 'hay'], [60, -25.5, 'barrel'], [37, -29, 'hay'], [50.5, -37, 'crate']];
    for (const [x, z, k] of clutter) {
      let m;
      if (k === 'barrel') { m = MeshBuilder.CreateCylinder('barrel', { diameter: 0.7, height: 0.95, tessellation: 10 }, s); this.part(m, [0.45, 0.3, 0.17], x, z, this.ground(x, z) + 0.47); }
      else if (k === 'crate') { m = MeshBuilder.CreateBox('crate', { size: 0.8 }, s); m.rotation.y = Math.random(); this.part(m, [0.55, 0.42, 0.25], x, z, this.ground(x, z) + 0.4); }
      else { m = MeshBuilder.CreateCylinder('hay', { diameter: 1.1, height: 1.2, tessellation: 12 }, s); m.rotation.z = Math.PI / 2; this.part(m, [0.82, 0.7, 0.36], x, z, this.ground(x, z) + 0.55, 0.15); }
      w.addCircle({ x, z, r: k === 'hay' ? 0.7 : 0.45, kind: 'prop' });
    }

    // cerca em volta (com aberturas para a trilha)
    const fencePts = [];
    const R = 19.5;
    for (let i = 0; i < 44; i++) {
      const a = (i / 44) * Math.PI * 2;
      // aberturas: norte (trilha) e oeste (vale)
      const deg = (a * 180) / Math.PI;
      if ((deg > 60 && deg < 115) || (deg > 165 && deg < 200)) continue;
      fencePts.push([v.x + Math.cos(a) * R, v.z + Math.sin(a) * R, a]);
    }
    for (const [x, z, a] of fencePts) {
      if (w.houses.some((h) => x > h.minX - 1 && x < h.maxX + 1 && z > h.minZ - 1 && z < h.maxZ + 1)) continue;
      const post = MeshBuilder.CreateBox('fpost', { width: 0.14, height: 1.2, depth: 0.14 }, s);
      this.part(post, darkWood, x, z, this.ground(x, z) + 0.5);
      const rail = MeshBuilder.CreateBox('frail', { width: 0.06, height: 0.1, depth: (2 * Math.PI * R) / 44 + 0.1 }, s);
      rail.rotation.y = -a;
      this.part(rail, wood, x, z, this.ground(x, z) + 0.8);
      w.addCircle({ x, z, r: 0.5, kind: 'fence' });
    }

    // quadro de avisos
    const nb = MeshBuilder.CreateBox('board', { width: 1.6, height: 1, depth: 0.1 }, s);
    this.part(nb, wood, 47, -21.5, this.ground(47, -21.5) + 1.5);
    const paper = MeshBuilder.CreateBox('paper', { width: 0.5, height: 0.6, depth: 0.12 }, s);
    this.part(paper, [0.92, 0.88, 0.75], 46.8, -21.5, this.ground(47, -21.5) + 1.5, 0);
    for (const sx of [-0.7, 0.7]) {
      const p = MeshBuilder.CreateBox('boardPost', { width: 0.1, height: 2, depth: 0.1 }, s);
      this.part(p, darkWood, 47 + sx, -21.5, this.ground(47, -21.5) + 1);
    }
    w.addBox({ minX: 46, maxX: 48, minZ: -21.8, maxZ: -21.2, kind: 'prop' });

    // estandartes
    for (const [x, z] of [[33.5, -25], [33.5, -30]]) {
      const pole = MeshBuilder.CreateCylinder('pole', { diameter: 0.12, height: 4, tessellation: 6 }, s);
      this.part(pole, darkWood, x, z, this.ground(x, z) + 2);
      const flag = MeshBuilder.CreateBox('flag', { width: 0.05, height: 1.6, depth: 0.8 }, s);
      this.part(flag, [0.15, 0.22, 0.5], x, z + 0.45, this.ground(x, z) + 3.1, 0.03);
      w.addCircle({ x, z, r: 0.25, kind: 'prop' });
    }

    // baú da aldeia (tutorial)
    this.chestSpots.push({ id: 'chest_aldeia', x: 56, z: -38, loot: [['pocao', 2], ['ouro', 15]] });
  }

  // ---------------- ACAMPAMENTO GOBLIN ----------------
  buildGoblinCamp() {
    const s = this.scene, w = this.world;
    const c = this.get('floresta');
    const hide = [0.45, 0.36, 0.24], darkWood = [0.26, 0.18, 0.11];
    const tents = [[c.x - 5, c.z + 3], [c.x + 4, c.z + 5], [c.x + 1, c.z - 5]];
    for (const [x, z] of tents) {
      const t = MeshBuilder.CreateCylinder('tent', { diameterTop: 0.2, diameterBottom: 3.6, height: 2.8, tessellation: 7 }, s);
      this.part(t, hide, x, z, this.ground(x, z) + 1.3, 0.15);
      const st = MeshBuilder.CreateCylinder('tentStick', { diameter: 0.1, height: 1, tessellation: 4 }, s);
      this.part(st, darkWood, x, z, this.ground(x, z) + 3);
      w.addCircle({ x, z, r: 1.6, kind: 'prop' });
    }
    // totem
    const tx = c.x + 0.5, tz = c.z + 0.5;
    for (let i = 0; i < 3; i++) {
      const seg = MeshBuilder.CreateBox('totem', { width: 0.7 - i * 0.08, height: 1, depth: 0.7 - i * 0.08 }, s);
      seg.rotation.y = i * 0.4;
      this.part(seg, [[0.5, 0.25, 0.15], [0.3, 0.4, 0.2], [0.6, 0.15, 0.1]][i], tx, tz, this.ground(tx, tz) + 0.5 + i, 0.1);
    }
    const skull = MeshBuilder.CreateSphere('tskull', { diameter: 0.5, segments: 6 }, s);
    this.part(skull, [0.85, 0.82, 0.7], tx, tz, this.ground(tx, tz) + 3.25, 0.05);
    w.addCircle({ x: tx, z: tz, r: 0.6, kind: 'prop' });
    // fogueira goblin
    const fx = c.x - 1.5, fz = c.z + 3.5;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const st = MeshBuilder.CreateSphere('gstone', { diameter: 0.35, segments: 4 }, s);
      this.part(st, [0.4, 0.4, 0.38], fx + Math.cos(a) * 0.6, fz + Math.sin(a) * 0.6, null, 0.3);
    }
    this.campfires.push({ x: fx, z: fz, light: false });
    // paliçada (estacas)
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      if (i % 6 === 0 || i % 6 === 1) continue;
      const x = c.x + Math.cos(a) * 11, z = c.z + Math.sin(a) * 11;
      const spike = MeshBuilder.CreateCylinder('spike', { diameterTop: 0, diameterBottom: 0.3, height: 2, tessellation: 5 }, s);
      spike.rotation.x = Math.cos(a) * 0.25;
      spike.rotation.z = -Math.sin(a) * 0.25;
      this.part(spike, darkWood, x, z, this.ground(x, z) + 0.9);
      w.addCircle({ x, z, r: 0.3, kind: 'prop' });
    }
    this.chestSpots.push({ id: 'chest_goblin', x: c.x + 6, z: c.z - 2, loot: [['ouro', 60], ['pocao', 2], ['cota_malha', 1]] });
  }

  // ---------------- NINHO DAS ARANHAS ----------------
  buildSpiderNest() {
    const s = this.scene, w = this.world;
    const c = this.get('ninho');
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4, r = 3 + (i % 4) * 2.5;
      const x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
      const egg = MeshBuilder.CreateSphere('egg', { diameter: 0.7 + (i % 3) * 0.25, segments: 6 }, s);
      egg.scaling.y = 1.3;
      this.part(egg, [0.86, 0.85, 0.78], x, z, this.ground(x, z) + 0.35, 0.1);
    }
    // teias (planos finos entre "estacas")
    for (let i = 0; i < 6; i++) {
      const a = i * 1.05 + 0.3;
      const x = c.x + Math.cos(a) * 9, z = c.z + Math.sin(a) * 9;
      // teia: fios radiais + anéis entre dois troncos secos
      const wy = this.ground(x, z) + 1.4;
      for (let k = 0; k < 8; k++) {
        const strand = MeshBuilder.CreateCylinder('strand', { diameter: 0.025, height: 2.4, tessellation: 3 }, s);
        strand.rotation.z = (k / 8) * Math.PI;
        strand.rotation.y = -a + Math.PI / 2;
        this.part(strand, [0.88, 0.88, 0.86], x, z, wy, 0);
      }
      for (let k = 1; k <= 3; k++) {
        const ring = MeshBuilder.CreateTorus('webRing', { diameter: k * 0.75, thickness: 0.02, tessellation: 10 }, s);
        ring.rotation.x = Math.PI / 2;
        ring.rotation.y = -a + Math.PI / 2;
        this.part(ring, [0.88, 0.88, 0.86], x, z, wy, 0);
      }
      const dead = MeshBuilder.CreateCylinder('deadTree', { diameterTop: 0.1, diameterBottom: 0.35, height: 3.2, tessellation: 5 }, s);
      dead.rotation.z = 0.15;
      this.part(dead, [0.25, 0.22, 0.2], x + 1.2, z, this.ground(x + 1.2, z) + 1.5);
      w.addCircle({ x: x + 1.2, z, r: 0.35, kind: 'prop' });
    }
    // ossos
    for (let i = 0; i < 8; i++) {
      const x = c.x + Math.cos(i * 0.8) * (2 + i), z = c.z + Math.sin(i * 0.8) * (2 + i);
      const bone = MeshBuilder.CreateCylinder('bone', { diameter: 0.08, height: 0.7, tessellation: 4 }, s);
      bone.rotation.z = Math.PI / 2; bone.rotation.y = i;
      this.part(bone, [0.85, 0.83, 0.75], x, z, this.ground(x, z) + 0.05, 0);
    }
    this.chestSpots.push({ id: 'chest_ninho', x: c.x - 2, z: c.z + 1.5, loot: [['ouro', 45], ['pocao', 3]] });
  }

  // ---------------- RUÍNAS ANTIGAS ----------------
  buildRuins() {
    const s = this.scene, w = this.world;
    const c = this.get('ruinas');
    const stone = [0.56, 0.55, 0.52], moss = [0.4, 0.46, 0.34];
    const cy = this.ground(c.x, c.z);
    // piso de lajes
    for (let i = -3; i <= 3; i++) {
      for (let j = -3; j <= 3; j++) {
        if (Math.random() < 0.18) continue;
        const x = c.x + i * 2.1, z = c.z + j * 2.1;
        const slab = MeshBuilder.CreateBox('slab', { width: 2, height: 0.3, depth: 2 }, s);
        slab.rotation.y = (Math.random() - 0.5) * 0.08;
        this.part(slab, Math.random() < 0.3 ? moss : stone, x, z, this.ground(x, z) + 0.02, 0.15);
      }
    }
    // anel de colunas (algumas quebradas)
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const x = c.x + Math.cos(a) * 10, z = c.z + Math.sin(a) * 10;
      const h = i % 3 === 0 ? 1.6 : 4.8 - (i % 2) * 1.2;
      const col = MeshBuilder.CreateCylinder('pillar', { diameter: 1.05, height: h, tessellation: 10 }, s);
      this.part(col, stone, x, z, this.ground(x, z) + h / 2 - 0.1, 0.12);
      const base = MeshBuilder.CreateBox('pbase', { width: 1.5, height: 0.4, depth: 1.5 }, s);
      this.part(base, stone, x, z, this.ground(x, z) + 0.1, 0.1);
      if (h > 4) {
        const cap = MeshBuilder.CreateBox('pcap', { width: 1.4, height: 0.35, depth: 1.4 }, s);
        this.part(cap, stone, x, z, this.ground(x, z) + h - 0.1, 0.1);
      } else if (h < 2) {
        // pedaço caído
        const fallen = MeshBuilder.CreateCylinder('fallen', { diameter: 1, height: 2.6, tessellation: 10 }, s);
        fallen.rotation.z = Math.PI / 2;
        fallen.rotation.y = a;
        const fx = x + Math.cos(a + 0.6) * 2, fz = z + Math.sin(a + 0.6) * 2;
        this.part(fallen, moss, fx, fz, this.ground(fx, fz) + 0.4, 0.12);
        w.addCircle({ x: fx, z: fz, r: 0.9, kind: 'prop' });
      }
      w.addCircle({ x, z, r: 0.8, kind: 'prop' });
    }
    // arco de entrada (voltado para o sul/aldeia)
    const ax = c.x, az = c.z - 14;
    for (const sx of [-2, 2]) {
      const p = MeshBuilder.CreateBox('archP', { width: 1, height: 5, depth: 1 }, s);
      this.part(p, stone, ax + sx, az, this.ground(ax + sx, az) + 2.4, 0.1);
      w.addCircle({ x: ax + sx, z: az, r: 0.75, kind: 'prop' });
    }
    const lintel = MeshBuilder.CreateBox('lintel', { width: 5.4, height: 0.9, depth: 1.1 }, s);
    this.part(lintel, stone, ax, az, Math.max(this.ground(ax - 2, az), this.ground(ax + 2, az)) + 5.2, 0.1);
    // altar central
    const altar = MeshBuilder.CreateBox('altar', { width: 2.6, height: 1, depth: 1.5 }, s);
    this.part(altar, [0.35, 0.33, 0.36], c.x, c.z + 4, cy + 0.5, 0.1);
    const rune = MeshBuilder.CreateBox('rune', { width: 1.6, height: 0.05, depth: 0.9 }, s);
    this.part(rune, [0.35, 0.7, 0.95], c.x, c.z + 4, cy + 1.03, 0);
    w.addBox({ minX: c.x - 1.4, maxX: c.x + 1.4, minZ: c.z + 3.2, maxZ: c.z + 4.8, kind: 'prop' });
    this.altar = { x: c.x, z: c.z + 4, y: cy + 1.1 };
    // tumbas
    for (const [ox, oz] of [[-6, 6], [6, 6], [-6, -4], [6, -4]]) {
      const x = c.x + ox, z = c.z + oz;
      const tomb = MeshBuilder.CreateBox('tomb', { width: 1.2, height: 0.6, depth: 2.2 }, s);
      this.part(tomb, moss, x, z, this.ground(x, z) + 0.3, 0.15);
      w.addBox({ minX: x - 0.6, maxX: x + 0.6, minZ: z - 1.1, maxZ: z + 1.1, kind: 'prop' });
    }
    this.chestSpots.push({ id: 'chest_ruinas', x: c.x - 3, z: c.z + 8, loot: [['ouro', 120], ['pocao', 3], ['armadura_guardiao', 1]] });
    // baús espalhados
    this.chestSpots.push({ id: 'chest_vale', x: -8, z: 18, loot: [['ouro', 30], ['pocao', 1]] });
    this.chestSpots.push({ id: 'chest_colina', x: 70, z: 40, loot: [['ouro', 40], ['gibao_couro', 1]] });
  }

  computeHerbSpots() {
    const w = this.world;
    if (!w.lake) return;
    const L = w.lake;
    const spots = [];
    for (let a = 0; a < Math.PI * 2 && spots.length < 9; a += 0.31) {
      for (let r = L.r * 0.5; r < L.r + 10; r += 0.5) {
        const x = L.x + Math.cos(a) * r, z = L.z + Math.sin(a) * r;
        const h = w.terrain.heightAt(x, z);
        if (h > w.waterLevel + 0.25 && h < w.waterLevel + 2.5) {
          if (!spots.some((p) => Math.hypot(p.x - x, p.z - z) < 5)) spots.push({ x, z });
          break;
        }
      }
    }
    this.herbSpots = spots.map((p, i) => ({ id: 'erva_' + i, ...p }));
  }

  /** Atualiza a região atual do jogador e avisa o jogo quando muda. */
  update() {
    const p = this.game.player && this.game.player.position;
    if (!p) return;
    const r = this.regionAt(p.x, p.z);
    if (r !== this.current) {
      const prev = this.current;
      this.current = r;
      this.game.onRegionChanged(r, prev);
    }
  }
}
