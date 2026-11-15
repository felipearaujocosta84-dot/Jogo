// Vegetação extra procedural: tufos de grama, flores e juncos.
// Usa "thin instances" (1 chamada de desenho por tipo) e só preenche um raio em volta do jogador,
// reposicionando quando ele se afasta. As posições vêm de um hash da grade do mundo, então
// voltam sempre aos mesmos lugares (sem "pular").
import { Mesh, VertexData, StandardMaterial, Color3, Matrix, Quaternion, Vector3 } from '../babylon.js';

function hash2(x, z, s = 0) {
  let h = (x * 374761393 + z * 668265263 + s * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

function bladeClump(name, scene, colors, blades = 7, height = 0.42, width = 0.06) {
  const positions = [], indices = [], cols = [], normals = [];
  for (let b = 0; b < blades; b++) {
    const a = (b / blades) * Math.PI + b * 0.7;
    const r = 0.12 * ((b * 7) % 3) / 2;
    const ox = Math.cos(a * 2.3) * r, oz = Math.sin(a * 2.3) * r;
    const dx = Math.cos(a) * width, dz = Math.sin(a) * width;
    const h = height * (0.7 + ((b * 13) % 5) / 10);
    const lean = 0.12 + ((b * 3) % 4) * 0.05;
    const lx = Math.cos(a + 1.57) * lean, lz = Math.sin(a + 1.57) * lean;
    const base = positions.length / 3;
    positions.push(ox - dx, 0, oz - dz, ox + dx, 0, oz + dz, ox + lx, h, oz + lz);
    indices.push(base, base + 1, base + 2);
    const [c0, c1] = colors;
    cols.push(c0.r, c0.g, c0.b, 1, c0.r, c0.g, c0.b, 1, c1.r, c1.g, c1.b, 1);
    normals.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
  }
  const vd = new VertexData();
  vd.positions = positions; vd.indices = indices; vd.colors = cols; vd.normals = normals;
  const m = new Mesh(name, scene);
  vd.applyToMesh(m);
  return m;
}

function flowerMesh(name, scene) {
  const positions = [], indices = [], cols = [], normals = [];
  const petals = [[1, 0.85, 0.3], [0.95, 0.95, 1], [0.8, 0.45, 0.9]];
  // caule + 4 florzinhas
  for (let f = 0; f < 4; f++) {
    const ox = Math.cos(f * 1.9) * 0.18, oz = Math.sin(f * 1.9) * 0.18;
    const h = 0.25 + (f % 2) * 0.12;
    let base = positions.length / 3;
    positions.push(ox - 0.012, 0, oz, ox + 0.012, 0, oz, ox, h, oz);
    indices.push(base, base + 1, base + 2);
    cols.push(0.25, 0.45, 0.15, 1, 0.25, 0.45, 0.15, 1, 0.3, 0.55, 0.2, 1);
    normals.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
    const c = petals[f % 3];
    base = positions.length / 3;
    const s = 0.06;
    positions.push(ox - s, h, oz - s, ox + s, h, oz - s, ox + s, h + 0.01, oz + s, ox - s, h + 0.01, oz + s);
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    for (let i = 0; i < 4; i++) { cols.push(c[0], c[1], c[2], 1); normals.push(0, 1, 0); }
  }
  const vd = new VertexData();
  vd.positions = positions; vd.indices = indices; vd.colors = cols; vd.normals = normals;
  const m = new Mesh(name, scene);
  vd.applyToMesh(m);
  return m;
}

export class Vegetation {
  constructor(game, world) {
    this.game = game;
    this.world = world;
    this.scene = game.scene;
    this.center = null;
    this.radius = 34;
  }

  build() {
    const scene = this.scene;
    const mat = new StandardMaterial('vegMat', scene);
    mat.backFaceCulling = false;
    mat.specularColor = new Color3(0, 0, 0);
    mat.diffuseColor = new Color3(1, 1, 1);
    this.mat = mat;

    this.grass = bladeClump('grass', scene, [new Color3(0.32, 0.46, 0.2), new Color3(0.62, 0.75, 0.36)]);
    this.grassDry = bladeClump('grassDry', scene, [new Color3(0.45, 0.42, 0.22), new Color3(0.78, 0.72, 0.42)], 4, 0.4);
    this.reeds = bladeClump('reeds', scene, [new Color3(0.2, 0.3, 0.12), new Color3(0.5, 0.55, 0.28)], 7, 1.3, 0.05);
    this.flowers = flowerMesh('flowers', scene);
    for (const m of [this.grass, this.grassDry, this.reeds, this.flowers]) {
      m.material = mat;
      m.isPickable = false;
      m.alwaysSelectAsActiveMesh = true;
      m.receiveShadows = true;
    }
    this.applyQuality();
  }

  applyQuality() {
    const q = this.game.quality;
    this.maxGrass = q.grass;
    this.center = null; // força reconstrução
  }

  fill(cx, cz) {
    const w = this.world, t = w.terrain;
    const R = this.radius;
    const density = Math.min(1, this.maxGrass / 3000);
    const step = 1.25;
    const lists = { grass: [], grassDry: [], reeds: [], flowers: [] };
    const m = new Matrix();
    const q = new Quaternion();
    const s = new Vector3();
    const p = new Vector3();
    const x0 = Math.floor((cx - R) / step), x1 = Math.ceil((cx + R) / step);
    const z0 = Math.floor((cz - R) / step), z1 = Math.ceil((cz + R) / step);
    for (let gx = x0; gx <= x1; gx++) {
      for (let gz = z0; gz <= z1; gz++) {
        const h0 = hash2(gx, gz);
        if (h0 > 0.62 * density) continue;
        const x = (gx + hash2(gx, gz, 1)) * step;
        const z = (gz + hash2(gx, gz, 2)) * step;
        const dx = x - cx, dz = z - cz;
        if (dx * dx + dz * dz > R * R) continue;
        if (Math.abs(x) > 88 || Math.abs(z) > 88) continue;
        const y = t.heightAt(x, z);
        let type = 'grass';
        if (w.lake) {
          const lx = x - w.lake.x, lz = z - w.lake.z;
          if (lx * lx + lz * lz < w.lake.r * w.lake.r * 1.3) {
            if (y < w.waterLevel - 0.15) continue;
            if (y < w.waterLevel + 0.6) type = 'reeds';
          }
        }
        if (this.nearTrail(x, z)) continue;
        if (this.insideHouse(x, z)) continue;
        const [r, g] = t.colorAt(x, z);
        if (type === 'grass') {
          if (g - r < 0.04) type = hash2(gx, gz, 5) < 0.5 ? 'grassDry' : null;
          else if (hash2(gx, gz, 3) < 0.06) type = 'flowers';
          else if (r > 0.33 && hash2(gx, gz, 4) < 0.3) type = 'grassDry';
        }
        if (!type) continue;
        const sc = 0.75 + hash2(gx, gz, 6) * 0.7;
        s.set(sc, sc * (0.8 + hash2(gx, gz, 7) * 0.5), sc);
        Quaternion.RotationYawPitchRollToRef(hash2(gx, gz, 8) * 6.28, 0, 0, q);
        p.set(x, y - 0.03, z);
        Matrix.ComposeToRef(s, q, p, m);
        lists[type].push(...m.asArray());
      }
    }
    for (const [k, arr] of Object.entries(lists)) {
      const mesh = this[k];
      if (!arr.length) { mesh.thinInstanceCount = 0; mesh.setEnabled(false); continue; }
      mesh.setEnabled(true);
      mesh.thinInstanceSetBuffer('matrix', new Float32Array(arr), 16, true);
    }
  }

  nearTrail(x, z) {
    const pts = this.world.trailPoints;
    if (!pts) return false;
    for (const p of pts) {
      const dx = x - p.x, dz = z - p.z;
      if (dx * dx + dz * dz < 6.5) return true;
    }
    return false;
  }

  insideHouse(x, z) {
    for (const b of this.world.houses) {
      if (x > b.minX - 0.6 && x < b.maxX + 0.6 && z > b.minZ - 0.6 && z < b.maxZ + 0.6) return true;
    }
    for (const b of this.world.boxes) {
      if (b.kind !== 'house' && x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ) return true;
    }
    return false;
  }

  update() {
    const p = this.game.player && this.game.player.position;
    if (!p) return;
    if (!this.center || Math.hypot(p.x - this.center.x, p.z - this.center.z) > 12) {
      this.center = { x: p.x, z: p.z };
      this.fill(p.x, p.z);
    }
  }
}
