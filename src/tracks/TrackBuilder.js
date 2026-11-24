// =============================================================
// EXTREME RACING — TrackBuilder
// Transforma a geometria do traçado (TrackGeometry) em malhas 3D
// e colisões Havok: asfalto, zebras, áreas de escape, barreiras,
// terreno, linha de largada/chegada, pórtico com semáforo e
// vegetação instanciada (thin instances).
// =============================================================
import {
  Mesh, VertexData, MeshBuilder, Vector3, Matrix, Quaternion, TransformNode, PhysicsAggregate,
  PhysicsShapeType, StandardMaterial, Color3, DynamicTexture,
} from '@babylonjs/core';
import { GROUP } from '../core/PhysicsGroups.js';
import { mulberry32, smoothStep } from '../utils/MathUtils.js';

export class TrackBuilder {
  constructor(scene, geometry, materials, graphicsPreset) {
    this.scene = scene;
    this.geo = geometry;
    this.mats = materials;
    this.preset = graphicsPreset;
    this.def = geometry.def;
    this.root = new TransformNode('track', scene);
    this.meshes = [];
    this.aggregates = [];
    this.shadowReceivers = [];
    this.shadowCasters = [];
  }

  _register(mesh, { receive = true, collide = 0, freeze = true } = {}) {
    mesh.parent = this.root;
    this.meshes.push(mesh);
    if (receive) { mesh.receiveShadows = true; this.shadowReceivers.push(mesh); }
    if (collide) {
      const agg = new PhysicsAggregate(mesh, PhysicsShapeType.MESH, { mass: 0, friction: collide === GROUP.BARRIER ? 0.35 : 0.9, restitution: collide === GROUP.BARRIER ? 0.15 : 0.0 }, this.scene);
      agg.shape.filterMembershipMask = collide;
      agg.shape.filterCollideMask = GROUP.CAR | GROUP.PROP;
      this.aggregates.push(agg);
    }
    if (freeze) {
      mesh.freezeWorldMatrix();
      mesh.doNotSyncBoundingInfo = true;
    }
    return mesh;
  }

  /**
   * Faixa ao longo do traçado entre dois deslocamentos laterais.
   * @param {number} a deslocamento interno (m, direita +)
   * @param {number} b deslocamento externo
   * @param {number} y deslocamento vertical
   * @param {number} vLen comprimento (m) de repetição da textura em V
   * @param {Array<[number,number]>} range trechos [i0, i1] (null = volta inteira)
   */
  strip(name, a, b, y, vLen, range = null, step = 1) {
    const g = this.geo;
    const N = g.count;
    const positions = [], uvs = [], indices = [];
    const runs = range ?? [[0, N]];
    let base = 0;
    for (const [i0, i1] of runs) {
      let rows = 0;
      for (let i = i0; i <= i1; i += step) {
        const smp = g.samples[((i % N) + N) % N];
        const s = i * g.spacing;
        const pa = smp.p, n = smp.n;
        positions.push(pa.x + n.x * a, pa.y + y, pa.z + n.z * a);
        positions.push(pa.x + n.x * b, pa.y + y, pa.z + n.z * b);
        uvs.push(0, s / vLen, 1, s / vLen);
        rows++;
      }
      for (let r = 0; r < rows - 1; r++) {
        const i = base + r * 2;
        indices.push(i, i + 2, i + 1, i + 1, i + 2, i + 3);
      }
      base += rows * 2;
    }
    const mesh = new Mesh(name, this.scene);
    const vd = new VertexData();
    vd.positions = positions;
    vd.indices = indices;
    vd.uvs = uvs;
    const normals = [];
    VertexData.ComputeNormals(positions, indices, normals);
    // Garante normais para cima (inverte a ordem dos triângulos se necessário)
    let sumY = 0;
    for (let k = 1; k < normals.length; k += 3) sumY += normals[k];
    if (sumY < 0) {
      for (let k = 0; k < indices.length; k += 3) { const t = indices[k + 1]; indices[k + 1] = indices[k + 2]; indices[k + 2] = t; }
      for (let k = 0; k < normals.length; k++) normals[k] = -normals[k];
    }
    vd.normals = normals;
    vd.applyToMesh(mesh, false);
    return mesh;
  }

  /** Malha de barreira (perfil fechado) ao longo de um lado. */
  barrierMesh(name, side, offset, height, thickness, depthBelow = 2.5) {
    const g = this.geo;
    const N = g.count;
    const step = 2;
    const paths = [];
    for (let i = 0; i <= N; i += step) {
      const smp = g.samples[i % N];
      const p = smp.p, n = smp.n;
      const o1 = side * offset, o2 = side * (offset + thickness);
      paths.push([
        new Vector3(p.x + n.x * o1, p.y - depthBelow, p.z + n.z * o1),
        new Vector3(p.x + n.x * o1, p.y + height, p.z + n.z * o1),
        new Vector3(p.x + n.x * o2, p.y + height, p.z + n.z * o2),
        new Vector3(p.x + n.x * o2, p.y - depthBelow, p.z + n.z * o2),
      ]);
    }
    const mesh = MeshBuilder.CreateRibbon(name, { pathArray: paths, closeArray: false, closePath: false }, this.scene);
    // UV ao longo do comprimento
    const uvs = mesh.getVerticesData('uv');
    if (uvs) {
      const per = 4;
      for (let r = 0; r < paths.length; r++) {
        for (let c = 0; c < per; c++) {
          const k = (r * per + c) * 2;
          uvs[k] = (r * step * g.spacing) / 6;
          uvs[k + 1] = c === 0 || c === 3 ? 0 : 1;
        }
      }
      mesh.setVerticesData('uv', uvs);
    }
    return mesh;
  }

  /** Trechos em curva (para zebras). */
  _curveRuns(threshold = 0.006, pad = 12) {
    const g = this.geo;
    const N = g.count;
    const mark = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      if (Math.abs(g.samples[i].curvature) > threshold) {
        for (let k = -pad; k <= pad; k++) mark[((i + k) % N + N) % N] = 1;
      }
    }
    const runs = [];
    // começa num ponto sem marca para não quebrar um trecho
    const start = mark.indexOf(0);
    if (start < 0) return [[0, N]];
    let cur = null;
    for (let c = 0; c < N; c++) {
      const i = (start + c) % N;
      if (mark[i]) {
        if (!cur) cur = [start + c, start + c];
        else cur[1] = start + c;
      } else if (cur) {
        runs.push([cur[0], cur[1] + 1]);
        cur = null;
      }
    }
    if (cur) runs.push([cur[0], cur[1] + 1]);
    return runs;
  }

  buildRoad() {
    const g = this.geo;
    const hw = g.halfWidth;
    const road = this.strip('road', -hw, hw, 0.02, g.width * 1.4);
    road.material = this.mats.get('asphalt');
    road.material.zOffset = -2;
    this._register(road, { collide: GROUP.DRIVABLE });
    // Com textura fotográfica de asfalto, as faixas brancas viram malhas próprias
    if (this.mats.asphaltIsPhoto) {
      const lineMat = new StandardMaterial('edgeLine', this.scene);
      lineMat.diffuseColor = new Color3(0.92, 0.92, 0.9);
      lineMat.zOffset = -3;
      for (const side of [-1, 1]) {
        const a = side * (hw - 0.55), b = side * (hw - 0.25);
        const line = this.strip(`edgeLine${side}`, Math.min(a, b), Math.max(a, b), 0.03, 10);
        line.material = lineMat;
        this._register(line);
      }
    }

    // Zebras nas curvas
    const runs = this._curveRuns();
    if (runs.length) {
      for (const side of [-1, 1]) {
        const a = side * hw, b = side * (hw + g.kerbWidth);
        const kerb = this.strip(`kerb${side}`, Math.min(a, b), Math.max(a, b), 0.045, 4, runs);
        kerb.material = this.mats.get('kerb');
        kerb.material.zOffset = -3;
        this._register(kerb, { collide: GROUP.DRIVABLE });
      }
    }
    // Áreas de escape
    const runoffMat = this.mats.get(g.runoffSurface.id === 'grass' ? 'grass' : g.runoffSurface.id === 'sand' ? 'sand' : g.runoffSurface.id === 'dirt' ? 'dirt' : 'gravel');
    for (const side of [-1, 1]) {
      const a = side * (hw - 0.5), b = side * (g.barrierOffset + 0.2);
      const ro = this.strip(`runoff${side}`, Math.min(a, b), Math.max(a, b), 0.0, 8);
      ro.material = runoffMat;
      this._register(ro, { collide: GROUP.DRIVABLE });
    }
  }

  buildBarriers() {
    const g = this.geo;
    const type = this.def.barrier?.type ?? 'wall';
    const h = this.def.barrier?.height ?? 1.2;
    const mat = this.mats.get(type === 'guardrail' ? 'guardrail' : type === 'tirewall' ? 'tirewall' : 'wall');
    // visível e iluminada dos dois lados
    mat.backFaceCulling = false;
    mat.twoSidedLighting = true;
    for (const side of [-1, 1]) {
      const m = this.barrierMesh(`barrier${side}`, side, g.barrierOffset, h, type === 'guardrail' ? 0.25 : 0.6);
      m.material = mat;
      this._register(m, { collide: GROUP.BARRIER });
      this.shadowCasters.push(m);
    }
    if (type === 'guardrail') {
      // postes do guard-rail (instâncias)
      const post = MeshBuilder.CreateBox('railPost', { width: 0.12, height: h + 0.6, depth: 0.12 }, this.scene);
      post.material = this.mats.get('darkMetal');
      const mats = [];
      for (let i = 0; i < g.count; i += 2) {
        const smp = g.samples[i];
        for (const side of [-1, 1]) {
          const o = side * (g.barrierOffset + 0.4);
          mats.push(Matrix.Translation(smp.p.x + smp.n.x * o, smp.p.y + (h - 0.6) / 2, smp.p.z + smp.n.z * o));
        }
      }
      this._thin(post, mats);
    }
  }

  _thin(mesh, matrices) {
    if (!matrices.length) { mesh.dispose(); return null; }
    const buf = new Float32Array(matrices.length * 16);
    matrices.forEach((m, i) => m.copyToArray(buf, i * 16));
    mesh.thinInstanceSetBuffer('matrix', buf, 16, true);
    mesh.parent = this.root;
    mesh.alwaysSelectAsActiveMesh = false;
    this.meshes.push(mesh);
    return mesh;
  }

  /** Linha de largada/chegada, marcações do grid e pórtico com semáforo. */
  buildStartFinish() {
    const g = this.geo;
    const hw = g.halfWidth;
    const s0 = g.samples[0];
    const heading = s0.heading;
    const line = MeshBuilder.CreateGround('startLine', { width: g.width, height: 1.6 }, this.scene);
    line.position.set(s0.p.x, s0.p.y + 0.03, s0.p.z);
    line.rotation.y = heading;
    line.material = this.mats.get('checker');
    line.material.zOffset = -4;
    this._register(line);
    // Marcações do grid
    const gridMat = new StandardMaterial('gridMark', this.scene);
    gridMat.diffuseColor = new Color3(0.95, 0.95, 0.95);
    gridMat.zOffset = -4;
    for (const slot of g.gridSlots(8)) {
      const m = MeshBuilder.CreateGround('gridMark', { width: 2.4, height: 0.25 }, this.scene);
      m.position.set(slot.position.x, slot.position.y + 0.03, slot.position.z + 0);
      m.rotation.y = slot.heading;
      const fwd = new Vector3(Math.sin(slot.heading), 0, Math.cos(slot.heading));
      m.position.addInPlace(fwd.scale(2.6));
      m.material = gridMat;
      this._register(m);
    }
    // Pórtico
    const gantry = new TransformNode('gantry', this.scene);
    gantry.parent = this.root;
    gantry.position.set(s0.p.x, s0.p.y, s0.p.z);
    gantry.rotation.y = heading;
    const metal = this.mats.get('darkMetal');
    const span = hw + g.kerbWidth + 3;
    for (const sx of [-1, 1]) {
      const pillar = MeshBuilder.CreateBox('gantryPillar', { width: 0.8, height: 8.5, depth: 0.8 }, this.scene);
      pillar.position.set(sx * span, 4.25, 0);
      pillar.parent = gantry; pillar.material = metal;
      this.shadowCasters.push(pillar);
      // colisão dos pilares (fora do traçado)
      const agg = new PhysicsAggregate(pillar, PhysicsShapeType.BOX, { mass: 0 }, this.scene);
      agg.shape.filterMembershipMask = GROUP.PROP;
      this.aggregates.push(agg);
    }
    const beam = MeshBuilder.CreateBox('gantryBeam', { width: span * 2 + 0.8, height: 1.6, depth: 0.9 }, this.scene);
    beam.position.set(0, 8, 0);
    beam.parent = gantry; beam.material = metal;
    this.shadowCasters.push(beam);
    // Painel com o nome
    const banner = new DynamicTexture('bannerTex', { width: 1024, height: 128 }, this.scene, true);
    const ctx = banner.getContext();
    ctx.fillStyle = '#0b0e12'; ctx.fillRect(0, 0, 1024, 128);
    ctx.fillStyle = '#c8102e'; ctx.fillRect(0, 0, 1024, 10); ctx.fillRect(0, 118, 1024, 10);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 72px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('START  •  EXTREME RACING  •  FINISH', 512, 90);
    banner.update(true);
    const bannerMat = new StandardMaterial('bannerMat', this.scene);
    bannerMat.diffuseTexture = banner;
    bannerMat.emissiveTexture = banner;
    bannerMat.emissiveColor = new Color3(0.6, 0.6, 0.6);
    for (const sz of [-1, 1]) {
      const plane = MeshBuilder.CreatePlane('banner', { width: span * 2, height: 1.3 }, this.scene);
      plane.position.set(0, 8, sz * 0.46);
      plane.rotation.y = sz > 0 ? Math.PI : 0;
      plane.parent = gantry; plane.material = bannerMat;
    }
    // Semáforo (5 luzes) usado na contagem regressiva
    this.startLights = [];
    for (let i = 0; i < 5; i++) {
      const mat = new StandardMaterial(`startLight${i}`, this.scene);
      mat.diffuseColor = new Color3(0.1, 0.02, 0.02);
      mat.emissiveColor = new Color3(0.08, 0.0, 0.0);
      const lamp = MeshBuilder.CreateCylinder('startLamp', { diameter: 0.55, height: 0.1, tessellation: 20 }, this.scene);
      lamp.rotation.x = Math.PI / 2;
      lamp.position.set((i - 2) * 0.8, 6.6, -0.5);
      lamp.parent = gantry; lamp.material = mat;
      this.startLights.push(mat);
    }
    const lampBox = MeshBuilder.CreateBox('lampBox', { width: 4.4, height: 0.9, depth: 0.3 }, this.scene);
    lampBox.position.set(0, 6.6, -0.3);
    lampBox.parent = gantry; lampBox.material = metal;
    this.gantry = gantry;
  }

  /** Estado do semáforo: n luzes vermelhas acesas, ou 'go' (verde). */
  setStartLights(state) {
    if (!this.startLights) return;
    this.startLights.forEach((m, i) => {
      if (state === 'go') { m.emissiveColor.set(0.1, 1, 0.25); m.diffuseColor.set(0.1, 0.8, 0.2); }
      else if (state === 'off') { m.emissiveColor.set(0.06, 0, 0); m.diffuseColor.set(0.1, 0.02, 0.02); }
      else if (i < state) { m.emissiveColor.set(1, 0.05, 0.03); m.diffuseColor.set(0.9, 0.05, 0.05); }
      else { m.emissiveColor.set(0.06, 0, 0); m.diffuseColor.set(0.1, 0.02, 0.02); }
    });
  }

  /**
   * Terreno com relevo que acompanha a altura da pista nas proximidades.
   * @param {function(x,z,info):number} hillsFn altura extra longe da pista
   */
  buildTerrain({ margin = 1400, hillsFn = null, extraFn = null, nearDrop = 0.06, material = 'terrainGrass', blendStart = 40, blendEnd = 380 } = {}) {
    const g = this.geo;
    const b = g.bounds();
    const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
    const size = Math.max(b.maxX - b.minX, b.maxZ - b.minZ) + margin * 2;
    const sub = this.preset?.terrainSubdiv ?? 96;
    const ground = MeshBuilder.CreateGround('terrain', { width: size, height: size, subdivisions: sub, updatable: true }, this.scene);
    ground.position.set(cx, 0, cz);
    const pos = ground.getVerticesData('position');
    const heightCache = new Float32Array(pos.length / 3);
    for (let k = 0; k < pos.length; k += 3) {
      const x = pos[k] + cx, z = pos[k + 2] + cz;
      const h = this.terrainHeight(x, z, { hillsFn, extraFn, nearDrop, blendStart, blendEnd });
      pos[k + 1] = h;
      heightCache[k / 3] = h;
    }
    ground.updateVerticesData('position', pos);
    const normals = [];
    VertexData.ComputeNormals(pos, ground.getIndices(), normals);
    ground.updateVerticesData('normal', normals);
    // UV em escala de metros (repetição a cada 24 m)
    const uvs = ground.getVerticesData('uv');
    for (let k = 0, j = 0; k < pos.length; k += 3, j += 2) {
      uvs[j] = (pos[k] + cx) / 24;
      uvs[j + 1] = (pos[k + 2] + cz) / 24;
    }
    ground.updateVerticesData('uv', uvs);
    ground.material = this.mats.get(material);
    this._register(ground, { collide: GROUP.DRIVABLE });
    this.terrain = { mesh: ground, cx, cz, size, sub, heights: heightCache };
    this._terrainOpts = { hillsFn, extraFn, nearDrop, blendStart, blendEnd };
    return ground;
  }

  /** Altura do terreno em (x,z): próximo da pista segue o asfalto (um pouco abaixo). */
  terrainHeight(x, z, opts = this._terrainOpts) {
    const g = this.geo;
    const near = g.distanceToCenter(x, z);
    const smp = g.samples[near.index];
    const roadY = smp.p.y;
    const edge = g.barrierOffset;
    const d = Math.max(0, near.distance - edge);
    if (this._elevated == null) { const bb = g.bounds(); this._elevated = Math.abs(bb.maxY - bb.minY) > 2; }
    const elevated = this._elevated;
    const drop = elevated ? 2.4 : opts.nearDrop;
    // Vales sob pontes e viadutos rebaixam o terreno (nunca o elevam junto à pista)
    const base = roadY - drop - g.valleyDepth(smp.s, d);
    const hills = opts.hillsFn ? opts.hillsFn(x, z, { distance: d, roadY }) : 0;
    const extra = opts.extraFn ? opts.extraFn(x, z) : 0; // relevo local (ex.: oásis), longe da pista
    return base + hills * smoothStep(opts.blendStart, opts.blendEnd, d) + extra;
  }

  /** true se (x,z) fica junto de túnel, desfiladeiro ou cidade (evita vegetação ali). */
  nearStructure(x, z, dist = 70) {
    const g = this.geo;
    const near = g.distanceToCenter(x, z);
    if (near.distance > g.barrierOffset + dist) return false;
    const s = g.samples[near.index].s;
    return !!(g.featureAt(s, 'tunnel', 30) || g.featureAt(s, 'gorge', 20) || g.featureAt(s, 'city', 20));
  }

  /** Posições aleatórias longe da pista (para vegetação e objetos). */
  scatter(count, { minDist = 12, maxDist = 600, seed = 1, avoid = null } = {}) {
    const g = this.geo;
    const rnd = mulberry32(seed);
    const out = [];
    const b = g.bounds();
    const ext = maxDist;
    let guard = count * 12;
    while (out.length < count && guard-- > 0) {
      const x = b.minX - ext + rnd() * (b.maxX - b.minX + ext * 2);
      const z = b.minZ - ext + rnd() * (b.maxZ - b.minZ + ext * 2);
      const near = g.distanceToCenter(x, z);
      const d = near.distance - g.barrierOffset;
      if (d < minDist || d > maxDist) continue;
      if (avoid && avoid(x, z)) continue;
      if (this.def.features && this.nearStructure(x, z)) continue;
      out.push({ x, z, y: this.terrainHeight(x, z), r: rnd(), d });
    }
    return out;
  }

  /** Vegetação: árvores frondosas ou pinheiros como thin instances. */
  buildTrees({ count = 800, kind = 'broadleaf', minDist = 14, maxDist = 500, seed = 3, avoid = null } = {}) {
    const n = Math.round(count * (this.preset?.vegetation ?? 1));
    if (n <= 0) return;
    const spots = this.scatter(n, { minDist, maxDist, seed, avoid });
    const scene = this.scene;
    let trunk, crown;
    if (kind === 'pine') {
      trunk = MeshBuilder.CreateCylinder('pineTrunk', { diameterTop: 0.25, diameterBottom: 0.45, height: 3, tessellation: 6 }, scene);
      trunk.position.y = 1.5;
      crown = MeshBuilder.CreateCylinder('pineCrown', { diameterTop: 0, diameterBottom: 4.2, height: 9, tessellation: 7 }, scene);
      crown.position.y = 7;
      crown.material = this.mats.get('pine');
    } else if (kind === 'palm') {
      trunk = MeshBuilder.CreateCylinder('palmTrunk', { diameterTop: 0.28, diameterBottom: 0.45, height: 8, tessellation: 6 }, scene);
      trunk.position.y = 4;
      crown = MeshBuilder.CreateCylinder('palmCrown', { diameterTop: 5, diameterBottom: 0.4, height: 1.4, tessellation: 7 }, scene);
      crown.position.y = 8.3;
      crown.material = this.mats.get('foliage');
    } else if (kind === 'cactus') {
      trunk = MeshBuilder.CreateCylinder('cactus', { diameter: 0.6, height: 4, tessellation: 8 }, scene);
      trunk.position.y = 2;
      crown = MeshBuilder.CreateCylinder('cactusArm', { diameter: 0.4, height: 1.8, tessellation: 8 }, scene);
      crown.position.set(0.6, 2.4, 0);
      crown.material = this.mats.get('foliage');
    } else {
      trunk = MeshBuilder.CreateCylinder('treeTrunk', { diameterTop: 0.3, diameterBottom: 0.55, height: 3.5, tessellation: 6 }, scene);
      trunk.position.y = 1.75;
      crown = MeshBuilder.CreateIcoSphere('treeCrown', { radius: 3, subdivisions: 2 }, scene);
      crown.scaling.set(1, 1.15, 1);
      crown.position.y = 5.6;
      crown.material = this.mats.get('foliage');
    }
    trunk.material = kind === 'cactus' ? this.mats.get('foliage') : this.mats.get('trunk');
    const merged = Mesh.MergeMeshes([trunk, crown], true, true, undefined, false, true);
    merged.name = `trees_${kind}`;
    const matrices = spots.map((s) => {
      const sc = 0.75 + s.r * 0.6;
      return Matrix.Compose(new Vector3(sc, sc * (0.9 + s.r * 0.3), sc), Quaternion.RotationAxis(Vector3.Up(), s.r * 6.28), new Vector3(s.x, s.y - 0.2, s.z));
    });
    this._thin(merged, matrices);
    merged.receiveShadows = false;
    return merged;
  }

  /** Poças de água (visíveis apenas com chuva). */
  buildPuddles(count = 40, seed = 9) {
    const g = this.geo;
    const rnd = mulberry32(seed);
    const mat = this.mats.get('puddle');
    mat.zOffset = -5;
    const base = MeshBuilder.CreateDisc('puddle', { radius: 1, tessellation: 18 }, this.scene);
    base.rotation.x = Math.PI / 2;
    base.bakeCurrentTransformIntoVertices();
    base.material = mat;
    const mats = [];
    for (let i = 0; i < count; i++) {
      const s = rnd() * g.length;
      const lat = (rnd() * 2 - 1) * (g.halfWidth - 1.5);
      const pt = g.pointAt(s, lat);
      const sx = 1.2 + rnd() * 2.8, sz = 0.8 + rnd() * 2.2;
      mats.push(Matrix.Compose(new Vector3(sx, 1, sz), Quaternion.RotationAxis(Vector3.Up(), rnd() * 6.28), new Vector3(pt.p.x, pt.p.y + 0.035, pt.p.z)));
    }
    this._thin(base, mats);
    base.setEnabled(false);
    this.puddles = base;
    return base;
  }

  /** Luzes de iluminação noturna ao longo da pista (emissivas, baratas). */
  buildLightPoles(every = 80, sideOffsetExtra = 4) {
    const g = this.geo;
    const pole = MeshBuilder.CreateCylinder('lightPole', { diameterTop: 0.18, diameterBottom: 0.3, height: 12, tessellation: 6 }, this.scene);
    pole.position.y = 6;
    pole.material = this.mats.get('darkMetal');
    const head = MeshBuilder.CreateBox('lightHead', { width: 1.6, height: 0.25, depth: 0.6 }, this.scene);
    head.position.set(0, 12, 0);
    head.material = this.mats.get('lamp');
    const merged = Mesh.MergeMeshes([pole, head], true, true, undefined, false, true);
    const mats = [];
    const stepIdx = Math.max(1, Math.round(every / g.spacing));
    for (let i = 0; i < g.count; i += stepIdx) {
      const smp = g.samples[i];
      const side = (i / stepIdx) % 2 ? 1 : -1;
      const o = side * (g.barrierOffset + sideOffsetExtra);
      mats.push(Matrix.Compose(Vector3.One(), Quaternion.RotationAxis(Vector3.Up(), smp.heading + (side > 0 ? Math.PI / 2 : -Math.PI / 2)), new Vector3(smp.p.x + smp.n.x * o, smp.p.y, smp.p.z + smp.n.z * o)));
    }
    this._thin(merged, mats);
    return merged;
  }

  // =============================================================
  // Trechos especiais (Etapa 2)
  // =============================================================

  /** Índices de amostra de um trecho [from, to] (m) com passo. */
  _rangeIdx(f, stepM = 2) {
    const g = this.geo;
    const out = [];
    const step = Math.max(1, Math.round(stepM / g.spacing));
    const i0 = Math.round(f.from / g.spacing), i1 = Math.round(f.to / g.spacing);
    for (let i = i0; i <= i1; i += step) out.push(i);
    if (out[out.length - 1] !== i1) out.push(i1);
    return out;
  }

  /** Constrói todos os trechos definidos na pista. */
  buildFeatures() {
    this.tunnels = [];
    for (const f of this.def.features ?? []) {
      if (f.type === 'tunnel') this.buildTunnel(f);
      else if (f.type === 'bridge') this.buildBridge(f);
      else if (f.type === 'gorge') this.buildGorge(f);
      else if (f.type === 'city') this.buildCity(f);
      else if (f.type === 'mirage') this.buildMirage(f);
    }
  }

  /**
   * Túnel: tubo em arco com iluminação no teto, morro por cima e
   * fachadas (portais) nas duas bocas. As paredes laterais de colisão
   * são as próprias barreiras da pista, que ficam dentro do túnel.
   */
  buildTunnel(f) {
    const g = this.geo;
    const scene = this.scene;
    const tw = g.barrierOffset + 1.0; // meia largura interna
    const wallH = 5.2, roofH = 8.4;
    const archN = 9;
    // Contorno do arco (de baixo/esquerda até baixo/direita)
    const arch = [];
    arch.push([-tw, -0.6]);
    arch.push([-tw, wallH]);
    for (let k = 1; k < archN; k++) {
      const a = Math.PI - (k / archN) * Math.PI;
      arch.push([Math.cos(a) * tw, wallH + Math.sin(a) * (roofH - wallH)]);
    }
    arch.push([tw, wallH]);
    arch.push([tw, -0.6]);
    const idx = this._rangeIdx(f, 3);
    const tube = [];
    for (const i of idx) {
      const smp = g.sampleAt(i);
      tube.push(arch.map(([lx, ly]) => new Vector3(smp.p.x + smp.n.x * lx, smp.p.y + ly, smp.p.z + smp.n.z * lx)));
    }
    const tunnel = MeshBuilder.CreateRibbon(`tunnel_${f.from}`, { pathArray: tube }, scene);
    const tm = this.mats.get('tunnel');
    tm.backFaceCulling = false;
    tm.twoSidedLighting = true;
    tunnel.material = tm;
    this._register(tunnel);
    this.shadowCasters.push(tunnel);

    // Morro sobre o túnel
    const W = 52, cover = 26;
    const NL = 15;
    const mound = [];
    for (const i of idx) {
      const smp = g.sampleAt(i);
      const path = [];
      for (let k = 0; k <= NL; k++) {
        const lx = -W + (2 * W * k) / NL;
        const t = Math.abs(lx) / W;
        const y = -2.2 + Math.pow(Math.max(0, 1 - t * t), 1.4) * (cover + roofH);
        path.push(new Vector3(smp.p.x + smp.n.x * lx, smp.p.y + y, smp.p.z + smp.n.z * lx));
      }
      mound.push(path);
    }
    const hill = MeshBuilder.CreateRibbon(`tunnelHill_${f.from}`, { pathArray: mound, sideOrientation: Mesh.DOUBLESIDE }, scene);
    hill.material = this.mats.get(this.def.environment === 'coastal' ? 'terrainGrass' : 'rock');
    this._register(hill);
    this.shadowCasters.push(hill);

    // Portais: superfície entre o perfil do morro e o arco (abertura do túnel)
    const portalMat = this.mats.get('concrete');
    for (const end of [0, idx.length - 1]) {
      const outer = mound[end];
      const inner = tube[end];
      // reamostra o arco para ter o mesmo número de pontos do perfil do morro
      const innerR = [];
      for (let k = 0; k <= NL; k++) {
        const u = (k / NL) * (inner.length - 1);
        const a = Math.floor(u), b = Math.min(inner.length - 1, a + 1);
        innerR.push(Vector3.Lerp(inner[a], inner[b], u - a));
      }
      const portal = MeshBuilder.CreateRibbon(`portal_${f.from}_${end}`, { pathArray: [outer, innerR], sideOrientation: Mesh.DOUBLESIDE }, scene);
      portal.material = portalMat;
      this._register(portal);
      // Placa com o nome do túnel
      const smp = g.sampleAt(idx[end]);
      const sign = MeshBuilder.CreatePlane('tunnelSign', { width: 9, height: 1.1 }, scene);
      sign.position.set(smp.p.x, smp.p.y + roofH + 1.2, smp.p.z);
      sign.rotation.y = smp.heading + (end === 0 ? 0 : Math.PI);
      sign.material = this._signMaterial(f.name ?? 'TÚNEL');
      this._register(sign, { receive: false });
    }

    // Luminárias no teto
    const lamp = MeshBuilder.CreateBox('tunnelLamp', { width: 1.6, height: 0.12, depth: 0.5 }, scene);
    lamp.material = this.mats.get('lamp');
    const lm = [];
    const step = Math.max(1, Math.round(12 / g.spacing));
    const i0 = Math.round(f.from / g.spacing), i1 = Math.round(f.to / g.spacing);
    for (let i = i0; i <= i1; i += step) {
      const smp = g.sampleAt(i);
      for (const lx of [-tw * 0.45, tw * 0.45]) {
        lm.push(Matrix.Compose(Vector3.One(), Quaternion.RotationAxis(Vector3.Up(), smp.heading), new Vector3(smp.p.x + smp.n.x * lx, smp.p.y + roofH - 0.6, smp.p.z + smp.n.z * lx)));
      }
    }
    this._thin(lamp, lm);
    this.tunnels.push(f);
  }

  _signMaterial(text) {
    this._signs ||= new Map();
    if (this._signs.has(text)) return this._signs.get(text);
    const tex = new DynamicTexture(`sign_${text}`, { width: 1024, height: 128 }, this.scene, true);
    const ctx = tex.getContext();
    ctx.fillStyle = '#0d5c2e'; ctx.fillRect(0, 0, 1024, 128);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 8; ctx.strokeRect(8, 8, 1008, 112);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 64px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(String(text).toUpperCase(), 512, 86);
    tex.update(true);
    const m = new StandardMaterial(`signMat_${text}`, this.scene);
    m.diffuseTexture = tex;
    m.emissiveTexture = tex;
    m.emissiveColor = new Color3(0.35, 0.35, 0.35);
    m.backFaceCulling = false;
    this._signs.set(text, m);
    return m;
  }

  /**
   * Ponte/viaduto: tabuleiro sob a pista, pilares até o fundo do vale e
   * estrutura por estilo: 'viaduct' (pilares altos), 'arch' (arco) ou
   * 'cable' (estaiada, com torres e cabos). O terreno abaixo é rebaixado
   * por TrackGeometry.valleyDepth (e vira água quando f.water).
   */
  buildBridge(f) {
    const g = this.geo;
    const scene = this.scene;
    const half = g.barrierOffset + 0.9;
    const deckH = 1.8;
    const idx = this._rangeIdx(f, 4);
    const deck = [];
    for (const i of idx) {
      const smp = g.sampleAt(i);
      const p = smp.p, n = smp.n;
      const pt = (lx, ly) => new Vector3(p.x + n.x * lx, p.y + ly, p.z + n.z * lx);
      deck.push([pt(-half, -0.05), pt(-half, -deckH), pt(half, -deckH), pt(half, -0.05)]);
    }
    const deckMesh = MeshBuilder.CreateRibbon(`deck_${f.from}`, { pathArray: deck, sideOrientation: Mesh.DOUBLESIDE }, scene);
    deckMesh.material = this.mats.get('concrete');
    this._register(deckMesh);
    this.shadowCasters.push(deckMesh);

    // Pilares
    const pillar = MeshBuilder.CreateBox('bridgePillar', { width: 1, height: 1, depth: 1 }, scene);
    pillar.material = this.mats.get('concrete');
    const pm = [];
    const spanM = f.style === 'cable' ? 90 : f.style === 'arch' ? 1e9 : 42;
    const n0 = Math.round(f.from / g.spacing), n1 = Math.round(f.to / g.spacing);
    const pStep = Math.max(1, Math.round(spanM / g.spacing));
    const pillarAt = (i, sx, w = 3.2) => {
      const smp = g.sampleAt(i);
      const x = smp.p.x + smp.n.x * sx, z = smp.p.z + smp.n.z * sx;
      const top = smp.p.y - deckH;
      const bottom = Math.min(top - 1, this.terrainHeight(x, z) - 3);
      const h = top - bottom;
      pm.push(Matrix.Compose(new Vector3(w, h, w * 0.8), Quaternion.RotationAxis(Vector3.Up(), smp.heading), new Vector3(x, bottom + h / 2, z)));
    };
    for (let i = n0 + pStep; i < n1 - pStep / 3; i += pStep) {
      pillarAt(i, -half * 0.55); pillarAt(i, half * 0.55);
    }
    // encontros (cabeceiras)
    for (const i of [n0, n1]) { pillarAt(i, -half * 0.7, 2.4); pillarAt(i, half * 0.7, 2.4); pillarAt(i, 0, 2.4); }

    if (f.style === 'arch') {
      // Arco de concreto sob o tabuleiro
      const arcPaths = [];
      const N = 24;
      const L = f.to - f.from;
      for (const side of [-1, 1]) {
        const path = [];
        for (let k = 0; k <= N; k++) {
          const sPos = f.from + (L * k) / N;
          const smp = g.pointAt(sPos, side * half * 0.6);
          const yDeck = smp.p.y - deckH;
          const tt = k / N;
          const depthHere = Math.max(4, f.depth * 0.9) * Math.sin(Math.PI * tt);
          path.push(new Vector3(smp.p.x, yDeck - (f.depth * 0.95 - depthHere), smp.p.z));
        }
        arcPaths.push(path);
      }
      for (const path of arcPaths) {
        const arc = MeshBuilder.CreateTube(`arch_${f.from}`, { path, radius: 1.3, tessellation: 8 }, scene);
        arc.material = this.mats.get('concrete');
        this._register(arc);
        this.shadowCasters.push(arc);
      }
      // montantes entre arco e tabuleiro
      for (let k = 2; k < N - 1; k += 2) {
        const sPos = f.from + (L * k) / N;
        for (const side of [-1, 1]) {
          const smp = g.pointAt(sPos, side * half * 0.6);
          const yDeck = smp.p.y - deckH;
          const yArc = arcPaths[side < 0 ? 0 : 1][k].y;
          const h = yDeck - yArc;
          if (h > 0.5) pm.push(Matrix.Compose(new Vector3(0.9, h, 0.9), Quaternion.Identity(), new Vector3(smp.p.x, yArc + h / 2, smp.p.z)));
        }
      }
    }

    if (f.style === 'cable') {
      // Ponte estaiada: duas torres em "H" e leques de cabos
      const L = f.to - f.from;
      const towerMat = this.mats.get('concrete');
      const cables = [];
      for (const frac of [0.3, 0.7]) {
        const sPos = f.from + L * frac;
        const c = g.pointAt(sPos, 0);
        const towerH = 46;
        for (const side of [-1, 1]) {
          const tp = g.pointAt(sPos, side * (half + 1.2));
          const ground = Math.min(c.p.y - 8, this.terrainHeight(tp.p.x, tp.p.z) - 3);
          const h = c.p.y + towerH - ground;
          pm.push(Matrix.Compose(new Vector3(2.2, h, 3), Quaternion.RotationAxis(Vector3.Up(), c.heading), new Vector3(tp.p.x, ground + h / 2, tp.p.z)));
          // cabos em leque para os dois lados
          const top = new Vector3(tp.p.x, c.p.y + towerH - 3, tp.p.z);
          for (let k = 1; k <= 7; k++) {
            for (const dir of [-1, 1]) {
              const anchor = g.pointAt(sPos + dir * k * 15, side * (half - 0.2));
              cables.push(MeshBuilder.CreateTube('cable', { path: [top, new Vector3(anchor.p.x, anchor.p.y + 0.3, anchor.p.z)], radius: 0.09, tessellation: 4 }, scene));
            }
          }
        }
        const beam = MeshBuilder.CreateBox('towerBeam', { width: 2 * (half + 1.2), height: 2.2, depth: 2.4 }, scene);
        beam.position.set(c.p.x, c.p.y + towerH - 1, c.p.z);
        beam.rotation.y = c.heading;
        beam.material = towerMat;
        this._register(beam);
        this.shadowCasters.push(beam);
      }
      const merged = Mesh.MergeMeshes(cables, true, true);
      if (merged) { merged.material = this.mats.get('metal'); this._register(merged, { receive: false }); }
    }
    const pillars = this._thin(pillar, pm);
    if (pillars) this.shadowCasters.push(pillars);
    // Placa com o nome
    if (f.name) {
      const smp = g.sampleAt(n0);
      const sign = MeshBuilder.CreatePlane('bridgeSign', { width: 9, height: 1.1 }, scene);
      const o = g.barrierOffset + 3;
      sign.position.set(smp.p.x + smp.n.x * o, smp.p.y + 3, smp.p.z + smp.n.z * o);
      sign.rotation.y = smp.heading;
      sign.material = this._signMaterial(f.name);
      this._register(sign, { receive: false });
    }
  }

  /** Desfiladeiro: paredões de rocha dos dois lados da pista. */
  buildGorge(f) {
    const g = this.geo;
    const H = f.height ?? 40;
    const idx = this._rangeIdx(f, 4);
    for (const side of [-1, 1]) {
      const paths = [];
      idx.forEach((i, k) => {
        const smp = g.sampleAt(i);
        const t = k / (idx.length - 1);
        const endFade = Math.min(1, Math.min(t, 1 - t) * 6);
        const prof = [[2.5, -2], [3.5, 4], [6, H * 0.45], [9, H * 0.8], [16, H], [40, H * 1.1]];
        const path = prof.map(([lo, ly], j) => {
          const jitter = (Math.sin(i * 0.37 + j * 1.7 + side) + Math.sin(i * 0.11 + j)) * (j > 0 ? 1.2 : 0);
          const o = side * (g.barrierOffset + lo + jitter);
          return new Vector3(smp.p.x + smp.n.x * o, smp.p.y + ly * endFade - (1 - endFade) * 2, smp.p.z + smp.n.z * o);
        });
        paths.push(path);
      });
      const wall = MeshBuilder.CreateRibbon(`gorge_${f.from}_${side}`, { pathArray: paths, sideOrientation: Mesh.DOUBLESIDE }, this.scene);
      wall.material = this.mats.get(f.material ?? 'rock');
      this._register(wall);
      this.shadowCasters.push(wall);
    }
  }

  /**
   * Miragem: em dias quentes o asfalto distante parece molhado e reflete
   * o céu. Faixas de 40 m cuja visibilidade a corrida ajusta pela
   * distância até a câmera (some quando o carro se aproxima).
   */
  buildMirage(f) {
    const g = this.geo;
    const mat = this.mats.get('mirage');
    this.mirageMeshes ||= [];
    for (let s0 = f.from; s0 < f.to; s0 += 40) {
      const i0 = Math.round(s0 / g.spacing), i1 = Math.round(Math.min(f.to, s0 + 40) / g.spacing);
      const m = this.strip(`mirage_${s0}`, -g.halfWidth + 0.8, g.halfWidth - 0.8, 0.06, 40, [[i0, i1]]);
      m.material = mat;
      m.visibility = 0;
      m.isPickable = false;
      this._register(m, { receive: false });
      const c = g.pointAt(s0 + 20).p;
      this.mirageMeshes.push({ mesh: m, center: new Vector3(c.x, c.y, c.z) });
    }
  }

  /**
   * Trecho urbano: calçadas, prédios alinhados à rua (fachadas variadas
   * com janelas que acendem à noite) e postes.
   */
  buildCity(f) {
    const g = this.geo;
    const scene = this.scene;
    const i0 = Math.round(f.from / g.spacing), i1 = Math.round(f.to / g.spacing);
    // Calçadas
    for (const side of [-1, 1]) {
      const a = side * (g.barrierOffset + 0.7), b = side * (g.barrierOffset + 6);
      const walk = this.strip(`sidewalk${side}`, Math.min(a, b), Math.max(a, b), 0.18, 6, [[i0, i1]]);
      walk.material = this.mats.get('concrete');
      this._register(walk);
    }
    // Prédios
    const variants = ['building', 'building2', 'building3'];
    const boxes = variants.map((v) => {
      const b = MeshBuilder.CreateBox(`city_${v}`, { size: 1 }, scene);
      b.material = this.mats.get(v);
      return { mesh: b, mats: [] };
    });
    const rnd = mulberry32(f.from | 0);
    for (const side of [-1, 1]) {
      let s = f.from + 10;
      while (s < f.to - 10) {
        const w = 16 + rnd() * 14; // largura ao longo da rua
        const depth = 14 + rnd() * 18;
        const h = 10 + rnd() * rnd() * 70;
        const lat = side * (g.barrierOffset + 7 + depth / 2);
        const pt = g.pointAt(s + w / 2, lat);
        const near = g.distanceToCenter(pt.p.x, pt.p.z);
        // Evita que prédios invadam a pista no lado interno das curvas
        if (near.distance > g.barrierOffset + 6 + depth / 2 - 1) {
          const ground = this.terrainHeight(pt.p.x, pt.p.z);
          const base = Math.min(ground, pt.p.y) - 1;
          const top = pt.p.y + h;
          const box = boxes[Math.floor(rnd() * boxes.length)];
          box.mats.push(Matrix.Compose(new Vector3(depth, top - base, w), Quaternion.RotationAxis(Vector3.Up(), pt.heading), new Vector3(pt.p.x, (top + base) / 2, pt.p.z)));
        }
        s += w + 2 + rnd() * 6;
      }
    }
    this.nightMaterials ||= [];
    for (const b of boxes) {
      const m = this._thin(b.mesh, b.mats);
      if (m) this.shadowCasters.push(m);
      this.nightMaterials.push(b.mesh.material);
    }
  }

  dispose() {
    for (const a of this.aggregates) a.dispose();
    this.root.dispose(false, true);
  }
}
