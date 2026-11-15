// Gerencia o mundo: carrega o mapa GLB, prepara materiais, céu, água, colisões e regiões.
import {
  ImportMeshAsync, StandardMaterial, Color3, Color4, Vector3, MeshBuilder, Mesh, VertexBuffer,
  DynamicTexture, Texture, VertexData
} from '../babylon.js';
import { Terrain } from './terrain.js';
import { Vegetation } from './vegetation.js';
import { Regions } from './regions.js';
import { MODELS } from '../config.js';
import { addOccluder } from './occlusion.js';

const CELL = 10;

export class WorldManager {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.circles = []; // { x, z, r, kind }
    this.boxes = [];   // { minX, maxX, minZ, maxZ }
    this.grid = new Map();
    this.bound = 86;
    this.waterLevel = -100;
    this.time = 0;
  }

  async load(onProgress) {
    const scene = this.scene;
    const res = await ImportMeshAsync(MODELS.map, scene, {
      onProgress: (e) => e.lengthComputable && onProgress && onProgress(e.loaded / e.total)
    });
    const byName = {};
    for (const m of res.meshes) {
      if (!m.getTotalVertices || m.getTotalVertices() === 0) continue;
      m.setParent(null);
      m.bakeCurrentTransformIntoVertices();
      m.refreshBoundingInfo();
      byName[m.name] = m;
    }
    // remove o nó raiz vazio
    for (const m of res.meshes) if (m.getTotalVertices && m.getTotalVertices() === 0) m.dispose();

    this.terrain = new Terrain(scene, byName['Vale_Verde_Terrain']);

    // Trilha: muitas peças pequenas -> junta numa malha só (1 chamada de desenho)
    const trail = Object.values(byName).filter((m) => m.name.startsWith('Trilha'));
    this.trailPoints = trail.map((m) => {
      const c = m.getBoundingInfo().boundingBox.centerWorld;
      return { x: c.x, z: c.z };
    });
    if (trail.length) {
      const merged = Mesh.MergeMeshes(trail, true, true);
      merged.name = 'Trilha';
      merged.material = this.vcMaterial('trailMat', 0.02, new Color3(0.95, 0.9, 0.85));
      merged.receiveShadows = true;
      merged.isPickable = false;
      merged.freezeWorldMatrix();
      this.trail = merged;
    }

    const props = {
      Arvores_Troncos: { spec: 0.02, occlude: true },
      Arvores_Copas: { spec: 0.04, occlude: true },
      Arbustos: { spec: 0.04 },
      Pedras: { spec: 0.12 },
      Aldeia_Inicial: { spec: 0.05, occlude: true }
    };
    for (const [name, opt] of Object.entries(props)) {
      const m = byName[name];
      if (!m) continue;
      m.material = this.vcMaterial(name + 'Mat', opt.spec);
      if (opt.occlude) addOccluder(m.material);
      m.receiveShadows = true;
      m.isPickable = false;
      m.freezeWorldMatrix();
      this.game.addShadowCaster(m, true);
    }
    this.meshes = byName;

    this.createSky();
    this.createWater(byName['Lago_Azul']);
    for (const n of ['Arvores_Troncos', 'Arvores_Copas', 'Arbustos', 'Pedras']) if (byName[n]) this.removeSubmerged(byName[n]);
    this.extractColliders(byName);

    this.regions = new Regions(this.game, this);
    this.regions.build();

    this.vegetation = new Vegetation(this.game, this);
    this.vegetation.build();
  }

  vcMaterial(name, spec = 0.03, tint = new Color3(1, 1, 1)) {
    const mat = new StandardMaterial(name, this.scene);
    mat.diffuseColor = tint;
    mat.specularColor = new Color3(spec, spec, spec);
    mat.specularPower = 24;
    return mat;
  }

  /** Agrupa os vértices de malhas "mescladas" em peças (componentes conectados). */
  components(mesh) {
    const pos = mesh.getVerticesData(VertexBuffer.PositionKind);
    const idx = mesh.getIndices();
    const n = pos.length / 3;
    const parent = new Int32Array(n);
    for (let i = 0; i < n; i++) parent[i] = i;
    const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
    for (let i = 0; i < idx.length; i += 3) {
      const a = find(idx[i]), b = find(idx[i + 1]), c = find(idx[i + 2]);
      parent[b] = a; parent[find(c)] = a;
    }
    // vértices duplicados na mesma posição (malhas sem índice compartilhado)
    const used = new Uint8Array(n);
    for (let i = 0; i < idx.length; i++) used[idx[i]] = 1;
    const groups = new Map();
    for (let v = 0; v < n; v++) {
      if (!used[v]) continue;
      const r = find(v);
      let g = groups.get(r);
      if (!g) groups.set(r, (g = { minX: 1e9, maxX: -1e9, minY: 1e9, maxY: -1e9, minZ: 1e9, maxZ: -1e9, n: 0 }));
      const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
      g.minX = Math.min(g.minX, x); g.maxX = Math.max(g.maxX, x);
      g.minY = Math.min(g.minY, y); g.maxY = Math.max(g.maxY, y);
      g.minZ = Math.min(g.minZ, z); g.maxZ = Math.max(g.maxZ, z);
      g.n++;
    }
    return [...groups.values()];
  }

  /** Remove peças (árvores, arbustos, pedras) cuja base ficou dentro do lago. */
  removeSubmerged(mesh) {
    const pos = mesh.getVerticesData(VertexBuffer.PositionKind);
    const idx = mesh.getIndices();
    const n = pos.length / 3;
    const parent = new Int32Array(n);
    for (let i = 0; i < n; i++) parent[i] = i;
    const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
    for (let i = 0; i < idx.length; i += 3) {
      const a = find(idx[i]), b = find(idx[i + 1]), c = find(idx[i + 2]);
      parent[b] = a; parent[find(c)] = a;
    }
    const sum = new Map();
    for (let v = 0; v < n; v++) {
      const r = find(v);
      let s2 = sum.get(r);
      if (!s2) sum.set(r, (s2 = { x: 0, z: 0, k: 0 }));
      s2.x += pos[v * 3]; s2.z += pos[v * 3 + 2]; s2.k++;
    }
    const drop = new Set();
    for (const [r, s2] of sum) {
      const x = s2.x / s2.k, z = s2.z / s2.k;
      const dx = x - this.lake.x, dz = z - this.lake.z;
      if (dx * dx + dz * dz < (this.lake.r + 2) ** 2 && this.terrain.heightAt(x, z) < this.waterLevel + 0.35) drop.add(r);
    }
    if (!drop.size) return;
    const keep = [];
    for (let i = 0; i < idx.length; i += 3) if (!drop.has(find(idx[i]))) keep.push(idx[i], idx[i + 1], idx[i + 2]);
    mesh.setIndices(keep);
  }

  extractColliders(byName) {
    this.trees = [];
    if (byName.Arvores_Troncos) {
      for (const g of this.components(byName.Arvores_Troncos)) {
        const t = { x: (g.minX + g.maxX) / 2, z: (g.minZ + g.maxZ) / 2, r: 0.55, kind: 'tree', top: g.maxY };
        this.trees.push(t);
        this.addCircle(t);
      }
    }
    this.rocks = [];
    if (byName.Pedras) {
      for (const g of this.components(byName.Pedras)) {
        const size = Math.max(g.maxX - g.minX, g.maxZ - g.minZ);
        const rock = { x: (g.minX + g.maxX) / 2, z: (g.minZ + g.maxZ) / 2, r: size * 0.42, kind: 'rock', size };
        this.rocks.push(rock);
        if (size > 1.4) this.addCircle(rock);
      }
    }
    this.houses = [];
    if (byName.Aldeia_Inicial) {
      for (const g of this.components(byName.Aldeia_Inicial)) {
        if (g.n !== 8) continue; // corpo das casas (caixas); telhados são ignorados
        const box = { minX: g.minX - 0.25, maxX: g.maxX + 0.25, minZ: g.minZ - 0.25, maxZ: g.maxZ + 0.25, kind: 'house', floor: g.minY, top: g.maxY };
        this.houses.push(box);
        this.addBox(box);
      }
    }
  }

  cellsFor(minX, maxX, minZ, maxZ, cb) {
    for (let cx = Math.floor(minX / CELL); cx <= Math.floor(maxX / CELL); cx++) {
      for (let cz = Math.floor(minZ / CELL); cz <= Math.floor(maxZ / CELL); cz++) cb(cx + ',' + cz);
    }
  }

  addCircle(c) {
    this.circles.push(c);
    this.cellsFor(c.x - c.r, c.x + c.r, c.z - c.r, c.z + c.r, (k) => {
      let cell = this.grid.get(k);
      if (!cell) this.grid.set(k, (cell = { circles: [], boxes: [] }));
      cell.circles.push(c);
    });
  }

  addBox(b) {
    this.boxes.push(b);
    this.cellsFor(b.minX, b.maxX, b.minZ, b.maxZ, (k) => {
      let cell = this.grid.get(k);
      if (!cell) this.grid.set(k, (cell = { circles: [], boxes: [] }));
      cell.boxes.push(b);
    });
  }

  /**
   * Empurra um círculo (personagem) para fora dos obstáculos estáticos.
   * Modifica pos (Vector3) e retorna true se colidiu.
   */
  resolve(pos, radius) {
    let hit = false;
    const seen = this._seen || (this._seen = new Set());
    seen.clear();
    this.cellsFor(pos.x - radius, pos.x + radius, pos.z - radius, pos.z + radius, (k) => {
      const cell = this.grid.get(k);
      if (!cell) return;
      for (const c of cell.circles) {
        if (seen.has(c)) continue;
        seen.add(c);
        const dx = pos.x - c.x, dz = pos.z - c.z;
        const min = c.r + radius;
        const d2 = dx * dx + dz * dz;
        if (d2 < min * min) {
          const d = Math.sqrt(d2) || 0.001;
          pos.x = c.x + (dx / d) * min;
          pos.z = c.z + (dz / d) * min;
          hit = true;
        }
      }
      for (const b of cell.boxes) {
        if (seen.has(b)) continue;
        seen.add(b);
        const cx = Math.max(b.minX, Math.min(pos.x, b.maxX));
        const cz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
        let dx = pos.x - cx, dz = pos.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 < radius * radius) {
          if (d2 < 1e-6) {
            // centro dentro da caixa: sai pelo lado mais próximo
            const opts = [
              [b.minX - radius - pos.x, 0], [b.maxX + radius - pos.x, 0],
              [0, b.minZ - radius - pos.z], [0, b.maxZ + radius - pos.z]
            ].sort((a, c2) => Math.abs(a[0] + a[1]) - Math.abs(c2[0] + c2[1]));
            pos.x += opts[0][0]; pos.z += opts[0][1];
          } else {
            const d = Math.sqrt(d2);
            pos.x = cx + (dx / d) * radius;
            pos.z = cz + (dz / d) * radius;
          }
          hit = true;
        }
      }
    });
    const B = this.bound;
    if (pos.x < -B) { pos.x = -B; hit = true; }
    if (pos.x > B) { pos.x = B; hit = true; }
    if (pos.z < -B) { pos.z = -B; hit = true; }
    if (pos.z > B) { pos.z = B; hit = true; }
    return hit;
  }

  /** Água funda demais para andar? */
  isDeepWater(x, z) {
    if (!this.lake) return false;
    const dx = x - this.lake.x, dz = z - this.lake.z;
    if (dx * dx + dz * dz > this.lake.r * this.lake.r) return false;
    return this.terrain.heightAt(x, z) < this.waterLevel - 0.75;
  }

  /** Altura do chão para personagens (terreno, ou piso de objetos). */
  groundAt(x, z) {
    return this.terrain.heightAt(x, z);
  }

  createSky() {
    const scene = this.scene;
    const sky = MeshBuilder.CreateSphere('sky', { diameter: 600, segments: 16, sideOrientation: Mesh.BACKSIDE }, scene);
    const mat = new StandardMaterial('skyMat', scene);
    mat.disableLighting = true;
    mat.emissiveColor = new Color3(1, 1, 1);
    mat.diffuseColor = new Color3(0, 0, 0);
    mat.specularColor = new Color3(0, 0, 0);
    mat.fogEnabled = false;
    sky.material = mat;
    sky.infiniteDistance = true;
    sky.isPickable = false;
    sky.applyFog = false;
    this.sky = sky;
    this.skyPositions = sky.getVerticesData(VertexBuffer.PositionKind);
    this.skyColors = new Float32Array((this.skyPositions.length / 3) * 4);
    this.setSkyColors(new Color3(0.36, 0.58, 0.86), new Color3(0.78, 0.86, 0.92));
  }

  setSkyColors(top, horizon) {
    const p = this.skyPositions, c = this.skyColors;
    for (let i = 0; i < p.length / 3; i++) {
      const y = p[i * 3 + 1] / 300;
      const t = Math.max(0, Math.min(1, Math.pow(Math.max(0, y), 0.55)));
      c[i * 4] = horizon.r + (top.r - horizon.r) * t;
      c[i * 4 + 1] = horizon.g + (top.g - horizon.g) * t;
      c[i * 4 + 2] = horizon.b + (top.b - horizon.b) * t;
      c[i * 4 + 3] = 1;
    }
    this.sky.setVerticesData(VertexBuffer.ColorKind, c, true);
    this.scene.fogColor = horizon.clone();
    this.scene.clearColor = new Color4(horizon.r, horizon.g, horizon.b, 1);
  }

  createWater(lakeStrip) {
    const scene = this.scene;
    const t = this.terrain;
    // Encontra a bacia mais baixa perto do "Lago Azul" do mapa e enche de água.
    let cx = 0, cz = 0;
    if (lakeStrip) {
      const bb = lakeStrip.getBoundingInfo().boundingBox;
      cx = (bb.minimumWorld.x + bb.maximumWorld.x) / 2;
      cz = (bb.minimumWorld.z + bb.maximumWorld.z) / 2;
    }
    let best = { h: Infinity, x: cx, z: cz };
    for (let x = cx - 40; x <= cx + 40; x += 1.5) {
      for (let z = cz - 40; z <= cz + 40; z += 1.5) {
        const h = t.heightAt(x, z);
        if (h < best.h) best = { h, x, z };
      }
    }
    this.waterLevel = best.h + 0.8;
    // raio: média dos raios (amostrados em 32 direções) até a margem
    let sum = 0, rmax = 6;
    for (let a = 0; a < 32; a++) {
      const ang = (a / 32) * Math.PI * 2;
      let rr = 1;
      for (; rr < 45; rr += 0.5) {
        if (t.heightAt(best.x + Math.cos(ang) * rr, best.z + Math.sin(ang) * rr) >= this.waterLevel) break;
      }
      sum += rr;
      rmax = Math.max(rmax, rr);
    }
    const r = Math.min(rmax, sum / 32 * 1.35 + 2);
    this.lake = { x: best.x, z: best.z, r: r + 1 };

    const water = MeshBuilder.CreateDisc('lagoAzul', { radius: r + 4, tessellation: 48 }, scene);
    water.rotation.x = Math.PI / 2;
    water.position.set(best.x, this.waterLevel, best.z);
    const mat = new StandardMaterial('waterMat', scene);
    mat.diffuseColor = new Color3(0.1, 0.3, 0.42);
    mat.emissiveColor = new Color3(0.06, 0.16, 0.24);
    mat.specularColor = new Color3(0.9, 0.9, 0.85);
    mat.specularPower = 96;
    mat.alpha = 0.9;
    mat.backFaceCulling = false;
    // mapa de normais procedural (ondulações)
    const size = 128;
    const bump = new DynamicTexture('waterBump', { width: size, height: size }, scene, true);
    const ctx = bump.getContext();
    const img = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = (x / size) * Math.PI * 2, v = (y / size) * Math.PI * 2;
        const nx = Math.sin(u * 3 + Math.sin(v * 2) * 1.5) * 0.5 + Math.sin(u * 7 + v * 5) * 0.25;
        const ny = Math.cos(v * 4 + Math.sin(u * 3) * 1.2) * 0.5 + Math.cos(v * 9 - u * 4) * 0.2;
        const k = (y * size + x) * 4;
        img.data[k] = 128 + nx * 90;
        img.data[k + 1] = 128 + ny * 90;
        img.data[k + 2] = 255;
        img.data[k + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    bump.update(false);
    bump.wrapU = bump.wrapV = Texture.WRAP_ADDRESSMODE;
    bump.uScale = bump.vScale = 6;
    bump.level = 0.45;
    mat.bumpTexture = bump;
    water.material = mat;
    water.isPickable = false;
    water.receiveShadows = true;
    this.water = water;
    this.waterMat = mat;
    this.waterBump = bump;

    // a faixa original do lago (inclinada) é substituída pelo lago gerado na bacia
    if (lakeStrip) lakeStrip.setEnabled(false);
  }

  update(dt) {
    this.time += dt;
    if (this.waterBump) {
      this.waterBump.uOffset = (this.time * 0.012) % 1;
      this.waterBump.vOffset = (Math.sin(this.time * 0.2) * 0.02);
    }
    if (this.regions) this.regions.update(dt);
    if (this.vegetation) this.vegetation.update(dt);
  }
}
