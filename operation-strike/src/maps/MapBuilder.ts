// Constrói um mapa a partir da MapDefinition:
//  - geometria 3D com UVs em coordenadas de mundo (texturas na escala certa em qualquer tamanho de caixa);
//  - malhas agrupadas por material e por bloco do mapa (poucas chamadas de desenho + recorte por visibilidade);
//  - colisores do mundo físico, iluminação, sombras, céu, neblina, portas e marcações dos pontos de bomba.
import {
  Color3,
  Color4,
  CreateBox,
  CreateSphere,
  CreatePlane,
  DirectionalLight,
  DynamicTexture,
  HemisphericLight,
  Mesh,
  RenderTargetTexture,
  ShadowGenerator,
  StandardMaterial,
  Vector3,
  VertexData,
  type Scene
} from '../core/babylon';
import { CollisionWorld, type Collider, type Vec3 } from '../physics/CollisionWorld';
import type { QualityPreset } from '../core/Quality';
import { getTexture, paintedTexture } from './textures';
import {
  MATERIAL_SCALE,
  MATERIAL_SURFACE,
  type BoxDef,
  type DoorDef,
  type MapDefinition,
  type MaterialName,
  type SpawnPoint,
  type Team
} from './MapTypes';

const CHUNK = 32;

interface GeoBucket {
  mat: MaterialName;
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
  shadow: boolean;
}

export interface Door {
  def: DoorDef;
  open: boolean;
  /** 0 = fechada, 1 = aberta */
  t: number;
  leaves: { mesh: Mesh; collider: Collider; closedMin: Vec3; closedMax: Vec3; openOffset: number }[];
  center: Vec3;
}

export interface MapInstance {
  def: MapDefinition;
  world: CollisionWorld;
  doors: Door[];
  shadow: ShadowGenerator | null;
  meshes: Mesh[];
  /** Grade de ocupação para o radar: true = bloqueado. */
  solidAt(x: number, z: number): boolean;
  zoneAt(x: number, z: number): string;
  siteAt(x: number, z: number): 'A' | 'B' | null;
  spawn(team: Team, index: number): SpawnPoint;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  setRenderDistance(d: number): void;
  update(dt: number, playerBox?: [Vec3, Vec3]): void;
  toggleDoor(door: Door, playerBox?: [Vec3, Vec3]): boolean;
  dispose(): void;
}

function hash(a: number, b: number, c = 0): number {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function hex(c: string): Color3 {
  return Color3.FromHexString(c);
}

export class MapBuilder {
  private buckets = new Map<string, GeoBucket>();
  private world = new CollisionWorld();
  private materials = new Map<MaterialName, StandardMaterial>();

  constructor(private scene: Scene, private def: MapDefinition, private quality: QualityPreset) {}

  build(): MapInstance {
    const { def, scene } = this;
    const cols = def.grid[0].length;
    const rows = def.grid.length;
    const minX = def.originX, maxX = def.originX + cols * def.cell;
    const maxZ = def.originZ, minZ = def.originZ - rows * def.cell;

    this.buildGrid();
    for (const b of def.boxes) {
      if (b.detail && !this.quality.props) {
        // Sem o detalhe visual, mas a colisão continua igual em todas as qualidades (justiça competitiva)
        if (b.collide !== false) this.addCollider(b);
        continue;
      }
      this.addBox(b);
    }

    // Chão (colisor único) e limites invisíveis do cenário
    this.world.add({ x: minX - 10, y: -2, z: minZ - 10 }, { x: maxX + 10, y: 0, z: maxZ + 10 }, 'sand');
    const H = 40, T = 2;
    const inv = { blocksBullets: false };
    this.world.add({ x: minX - T, y: 0, z: minZ - T }, { x: minX, y: H, z: maxZ + T }, 'stone', inv);
    this.world.add({ x: maxX, y: 0, z: minZ - T }, { x: maxX + T, y: H, z: maxZ + T }, 'stone', inv);
    this.world.add({ x: minX, y: 0, z: minZ - T }, { x: maxX, y: H, z: minZ }, 'stone', inv);
    this.world.add({ x: minX, y: 0, z: maxZ }, { x: maxX, y: H, z: maxZ + T }, 'stone', inv);
    this.world.add({ x: minX, y: H, z: minZ }, { x: maxX, y: H + T, z: maxZ }, 'stone', inv);

    const meshes = this.flush();

    // Iluminação
    const amb = def.ambience;
    const hemi = new HemisphericLight('ambient', new Vector3(0, 1, 0), scene);
    hemi.diffuse = hex(amb.ambient);
    hemi.groundColor = hex(amb.ambientGround);
    hemi.specular = Color3.Black();
    hemi.intensity = amb.ambientIntensity;
    const sunDir = new Vector3(...amb.sunDir).normalize();
    const sun = new DirectionalLight('sun', sunDir, scene);
    sun.diffuse = hex(amb.sunColor);
    sun.specular = hex(amb.sunColor).scale(0.25);
    sun.intensity = amb.sunIntensity;
    sun.position = sunDir.scale(-120).add(new Vector3((minX + maxX) / 2, 0, (minZ + maxZ) / 2));

    let shadow: ShadowGenerator | null = null;
    if (this.quality.shadows) {
      shadow = new ShadowGenerator(this.quality.shadowMapSize, sun);
      const webgl2 = (scene.getEngine() as unknown as { webGLVersion?: number }).webGLVersion === 2;
      if (webgl2 && this.quality.shadowMapSize >= 2048) {
        shadow.usePercentageCloserFiltering = true;
        shadow.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
      } else {
        shadow.usePoissonSampling = true;
      }
      shadow.bias = 0.0008;
      shadow.normalBias = 0.02;
      shadow.darkness = 0.35;
      sun.autoUpdateExtends = false;
      sun.shadowMinZ = 1;
      sun.shadowMaxZ = 300;
      sun.orthoLeft = -(maxX - minX) * 0.75;
      sun.orthoRight = (maxX - minX) * 0.75;
      sun.orthoTop = (maxZ - minZ) * 0.75;
      sun.orthoBottom = -(maxZ - minZ) * 0.75;
      for (const m of meshes) {
        if (m.metadata?.shadow) shadow.addShadowCaster(m, false);
        m.receiveShadows = true;
      }
      // O cenário é estático: o mapa de sombras é desenhado uma vez só (economia enorme no celular)
      const rt = shadow.getShadowMap();
      if (rt) rt.refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
    }

    // Céu e neblina
    const sky = this.createSky();
    meshes.push(sky);
    scene.fogMode = 3; // linear
    scene.fogColor = hex(amb.fog);
    scene.clearColor = Color4.FromColor3(hex(amb.fog), 1);
    scene.ambientColor = new Color3(0.25, 0.22, 0.2);

    this.createSiteMarkers(meshes);
    const doors = this.createDoors(meshes, shadow);

    const world = this.world;
    const def2 = def;
    const solid = (x: number, z: number): boolean => {
      const c = Math.floor((x - def2.originX) / def2.cell);
      const r = Math.floor((def2.originZ - z) / def2.cell);
      const row = def2.grid[r];
      if (!row || c < 0 || c >= row.length) return true;
      const k = def2.legend[row[c]];
      return !k || k.type === 'solid';
    };

    const instance: MapInstance = {
      def,
      world,
      doors,
      shadow,
      meshes,
      bounds: { minX, maxX, minZ, maxZ },
      solidAt: solid,
      zoneAt(x, z) {
        for (const zn of def2.zones) if (x >= zn.min[0] && x <= zn.max[0] && z >= zn.min[1] && z <= zn.max[1]) return zn.name;
        return '';
      },
      siteAt(x, z) {
        for (const s of def2.sites) if (x >= s.min[0] && x <= s.max[0] && z >= s.min[1] && z <= s.max[1]) return s.name;
        return null;
      },
      spawn(team, index) {
        const list = def2.spawns[team];
        return list[((index % list.length) + list.length) % list.length];
      },
      setRenderDistance: (d: number) => {
        scene.fogStart = d * 0.45;
        scene.fogEnd = d;
        const cam = scene.activeCamera;
        if (cam) cam.maxZ = d + 20;
        sky.scaling.setAll(Math.max(30, d * 0.9) / 100);
      },
      update: (dt: number, playerBox?: [Vec3, Vec3]) => this.updateDoors(doors, dt, playerBox),
      toggleDoor: (door, playerBox) => this.toggleDoor(door, playerBox),
      dispose: () => {
        for (const m of meshes) m.dispose(false, true);
        shadow?.dispose();
        hemi.dispose();
        sun.dispose();
        for (const mat of this.materials.values()) mat.dispose(true, false);
      }
    };
    return instance;
  }

  // -------------------------------------------------------------- grade

  private buildGrid(): void {
    const { def } = this;
    const rows = def.grid.length, cols = def.grid[0].length;
    const used: boolean[][] = def.grid.map(r => Array.from(r, () => false));
    const cs = def.cell;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (used[r][c]) continue;
        const ch = def.grid[r][c];
        const kind = def.legend[ch];
        if (!kind) throw new Error(`Mapa ${def.id}: símbolo desconhecido '${ch}' na linha ${r}`);
        // Retângulo guloso de células iguais (prédios limitados a 3x3 para variar a silhueta)
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
          this.addBox({ min: [x0, 0, z0], max: [x1, height, z1], mat: kind.material });
          if (kind.material === 'plaster') this.decorateBuilding(x0, z0, x1, z1, height, r, c);
        } else {
          this.addQuadTop(x0, z0, x1, z1, 0, kind.floor ?? kind.material);
          if (kind.type === 'roofed') {
            const [y] = kind.height ?? [3.6, 3.6];
            this.addBox({ min: [x0, y, z0], max: [x1, y + 0.4, z1], mat: 'roof' });
          }
        }
      }
    }
  }

  /** Beiral no topo e janelas nos prédios de reboco (apenas visual). */
  private decorateBuilding(x0: number, z0: number, x1: number, z1: number, h: number, r: number, c: number): void {
    const o = 0.12;
    this.addBox({ min: [x0 - o, h - 0.35, z0 - o], max: [x1 + o, h, z1 + o], mat: 'trim', collide: false, shadow: false });
    if (!this.quality.props || h < 5) return;
    const sides: [number, number, number, number, 'x' | 'z', number][] = [
      [x0, z0 - 0.06, x1, z0, 'x', -1],
      [x0, z1, x1, z1 + 0.06, 'x', 1],
      [x0 - 0.06, z0, x0, z1, 'z', -1],
      [x1, z0, x1 + 0.06, z1, 'z', 1]
    ];
    sides.forEach(([ax0, az0, ax1, az1, axis], si) => {
      const len = axis === 'x' ? ax1 - ax0 : az1 - az0;
      const n = Math.floor(len / 4);
      for (let i = 0; i < n; i++) {
        if (hash(r * 31 + si, c * 17 + i, 5) < 0.45) continue;
        const centre = (axis === 'x' ? ax0 : az0) + (i + 0.5) * (len / n);
        const y0 = 3.1, y1 = 4.5;
        if (axis === 'x') this.addBox({ min: [centre - 0.6, y0, az0], max: [centre + 0.6, y1, az1], mat: 'dark', collide: false, shadow: false });
        else this.addBox({ min: [ax0, y0, centre - 0.6], max: [ax1, y1, centre + 0.6], mat: 'dark', collide: false, shadow: false });
      }
    });
  }

  // -------------------------------------------------------------- geometria

  private bucket(mat: MaterialName, cx: number, cz: number, shadow: boolean): GeoBucket {
    const key = `${mat}|${Math.floor(cx / CHUNK)}|${Math.floor(cz / CHUNK)}|${shadow ? 1 : 0}`;
    let b = this.buckets.get(key);
    if (!b) this.buckets.set(key, (b = { mat, positions: [], normals: [], uvs: [], indices: [], shadow }));
    return b;
  }

  private addCollider(b: BoxDef): void {
    this.world.add(
      { x: b.min[0], y: b.min[1], z: b.min[2] },
      { x: b.max[0], y: b.max[1], z: b.max[2] },
      MATERIAL_SURFACE[b.mat],
      { blocksBullets: b.bullets !== false }
    );
  }

  addBox(b: BoxDef): void {
    if (b.collide !== false) this.addCollider(b);
    const [x0, y0, z0] = b.min;
    const [x1, y1, z1] = b.max;
    const bucket = this.bucket(b.mat, (x0 + x1) / 2, (z0 + z1) / 2, b.shadow !== false);
    const s = MATERIAL_SCALE[b.mat];
    const fit = s === 0;
    const sx = x1 - x0, sy = y1 - y0, sz = z1 - z0;
    // cada face: 4 cantos, normal, e as coordenadas (u,v) de cada canto
    const uv = (a: number, b2: number, sa: number, sb: number, base: number[]): [number, number] =>
      fit ? [(a - base[0]) / sa, (b2 - base[1]) / sb] : [a / s, b2 / s];
    const face = (pts: number[][], n: number[], uvs: [number, number][]) => this.pushQuad(bucket, pts, n, uvs);
    // +X / -X
    face([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], [1, 0, 0],
      [uv(z0, y0, sz, sy, [z0, y0]), uv(z0, y1, sz, sy, [z0, y0]), uv(z1, y1, sz, sy, [z0, y0]), uv(z1, y0, sz, sy, [z0, y0])]);
    face([[x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0]], [-1, 0, 0],
      [uv(-z1, y0, sz, sy, [-z1, y0]), uv(-z1, y1, sz, sy, [-z1, y0]), uv(-z0, y1, sz, sy, [-z1, y0]), uv(-z0, y0, sz, sy, [-z1, y0])]);
    // +Z / -Z
    face([[x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [x0, y0, z1]], [0, 0, 1],
      [uv(-x1, y0, sx, sy, [-x1, y0]), uv(-x1, y1, sx, sy, [-x1, y0]), uv(-x0, y1, sx, sy, [-x1, y0]), uv(-x0, y0, sx, sy, [-x1, y0])]);
    face([[x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]], [0, 0, -1],
      [uv(x0, y0, sx, sy, [x0, y0]), uv(x0, y1, sx, sy, [x0, y0]), uv(x1, y1, sx, sy, [x0, y0]), uv(x1, y0, sx, sy, [x0, y0])]);
    // topo
    face([[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]], [0, 1, 0],
      [uv(x0, z0, sx, sz, [x0, z0]), uv(x0, z1, sx, sz, [x0, z0]), uv(x1, z1, sx, sz, [x0, z0]), uv(x1, z0, sx, sz, [x0, z0])]);
    // base (só quando a caixa está suspensa: tetos, vigas, plataformas)
    if (y0 > 0.05)
      face([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0],
        [uv(x0, z0, sx, sz, [x0, z0]), uv(x1, z0, sx, sz, [x0, z0]), uv(x1, z1, sx, sz, [x0, z0]), uv(x0, z1, sx, sz, [x0, z0])]);
  }

  private addQuadTop(x0: number, z0: number, x1: number, z1: number, y: number, mat: MaterialName): void {
    // Pisos grandes são divididos em blocos para o recorte por visibilidade funcionar
    for (let cx = x0; cx < x1; cx += CHUNK) {
      for (let cz = z0; cz < z1; cz += CHUNK) {
        const ex = Math.min(x1, cx + CHUNK), ez = Math.min(z1, cz + CHUNK);
        const s = MATERIAL_SCALE[mat] || 4;
        const bucket = this.bucket(mat, (cx + ex) / 2, (cz + ez) / 2, false);
        this.pushQuad(bucket, [[cx, y, cz], [cx, y, ez], [ex, y, ez], [ex, y, cz]], [0, 1, 0],
          [[cx / s, cz / s], [cx / s, ez / s], [ex / s, ez / s], [ex / s, cz / s]]);
      }
    }
  }

  private pushQuad(b: GeoBucket, pts: number[][], n: number[], uvs: [number, number][]): void {
    const base = b.positions.length / 3;
    for (let i = 0; i < 4; i++) {
      b.positions.push(pts[i][0], pts[i][1], pts[i][2]);
      b.normals.push(n[0], n[1], n[2]);
      b.uvs.push(uvs[i][0], uvs[i][1]);
    }
    // Babylon usa sistema de mão esquerda: a face visível tem cross(v1-v0, v2-v0) oposto à normal
    const e1 = [pts[1][0] - pts[0][0], pts[1][1] - pts[0][1], pts[1][2] - pts[0][2]];
    const e2 = [pts[2][0] - pts[0][0], pts[2][1] - pts[0][1], pts[2][2] - pts[0][2]];
    const cx = e1[1] * e2[2] - e1[2] * e2[1];
    const cy = e1[2] * e2[0] - e1[0] * e2[2];
    const cz = e1[0] * e2[1] - e1[1] * e2[0];
    if (cx * n[0] + cy * n[1] + cz * n[2] > 0) b.indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
    else b.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  private material(name: MaterialName): StandardMaterial {
    let m = this.materials.get(name);
    if (m) return m;
    m = new StandardMaterial('mat_' + name, this.scene);
    m.diffuseTexture = getTexture(this.scene, name, this.quality.textureSize);
    m.specularColor = name === 'metal' || name === 'container' || name === 'door' ? new Color3(0.25, 0.25, 0.25) : new Color3(0.04, 0.04, 0.04);
    m.specularPower = 32;
    if (name === 'dark') m.emissiveColor = new Color3(0.02, 0.025, 0.03);
    this.materials.set(name, m);
    return m;
  }

  private flush(): Mesh[] {
    const meshes: Mesh[] = [];
    for (const [key, b] of this.buckets) {
      if (!b.indices.length) continue;
      const mesh = new Mesh('map_' + key, this.scene);
      const vd = new VertexData();
      vd.positions = b.positions;
      vd.normals = b.normals;
      vd.uvs = b.uvs;
      vd.indices = b.indices;
      vd.applyToMesh(mesh, false);
      mesh.material = this.material(b.mat);
      mesh.isPickable = false;
      mesh.metadata = { shadow: b.shadow };
      mesh.freezeWorldMatrix();
      mesh.doNotSyncBoundingInfo = true;
      meshes.push(mesh);
    }
    for (const m of this.materials.values()) m.freeze();
    this.buckets.clear();
    return meshes;
  }

  // -------------------------------------------------------------- céu, marcações e portas

  private createSky(): Mesh {
    const [top, mid, horizon] = this.def.ambience.sky;
    const tex = new DynamicTexture('skyTex', { width: 8, height: 256 }, this.scene, false);
    const g = tex.getContext() as unknown as CanvasRenderingContext2D;
    const grd = g.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, top);
    grd.addColorStop(0.42, mid);
    grd.addColorStop(0.5, horizon);
    grd.addColorStop(1, horizon);
    g.fillStyle = grd;
    g.fillRect(0, 0, 8, 256);
    tex.update(false);
    const mat = new StandardMaterial('skyMat', this.scene);
    mat.emissiveTexture = tex;
    mat.diffuseColor = Color3.Black();
    mat.specularColor = Color3.Black();
    mat.disableLighting = true;
    mat.backFaceCulling = false;
    mat.fogEnabled = false;
    mat.disableDepthWrite = true;
    const sky = CreateSphere('sky', { diameter: 200, segments: 12 }, this.scene);
    sky.material = mat;
    sky.infiniteDistance = true;
    sky.isPickable = false;
    sky.renderingGroupId = 0;
    sky.applyFog = false;
    // "sol" no céu na direção oposta à luz
    const sunDir = new Vector3(...this.def.ambience.sunDir).normalize().scale(-1);
    const sunMat = new StandardMaterial('sunDisc', this.scene);
    const sunTex = paintedTexture(this.scene, 'sunTex', 64, (g, sz) => {
      const grd = g.createRadialGradient(sz / 2, sz / 2, 0, sz / 2, sz / 2, sz / 2);
      grd.addColorStop(0, 'rgba(255,252,235,1)');
      grd.addColorStop(0.35, 'rgba(255,240,200,0.9)');
      grd.addColorStop(1, 'rgba(255,230,180,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, sz, sz);
    });
    sunMat.emissiveTexture = sunTex;
    sunMat.opacityTexture = sunTex;
    sunMat.diffuseColor = Color3.Black();
    sunMat.disableLighting = true;
    sunMat.fogEnabled = false;
    sunMat.disableDepthWrite = true;
    const disc = CreatePlane('sunDiscMesh', { size: 16 }, this.scene);
    disc.material = sunMat;
    disc.parent = sky;
    disc.position = sunDir.scale(92);
    disc.billboardMode = Mesh.BILLBOARDMODE_ALL;
    disc.isPickable = false;
    return sky;
  }

  private createSiteMarkers(meshes: Mesh[]): void {
    for (const site of this.def.sites) {
      const tex = paintedTexture(this.scene, 'site' + site.name, 256, (g, s) => {
        g.strokeStyle = 'rgba(190,40,30,0.85)';
        g.lineWidth = s * 0.05;
        g.beginPath();
        g.arc(s / 2, s / 2, s * 0.42, 0, Math.PI * 2);
        g.stroke();
        g.fillStyle = 'rgba(190,40,30,0.85)';
        g.font = `900 ${s * 0.55}px Arial, sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(site.name, s / 2, s * 0.53);
      });
      const mat = new StandardMaterial('siteMat' + site.name, this.scene);
      mat.diffuseTexture = tex;
      mat.useAlphaFromDiffuseTexture = true;
      mat.specularColor = Color3.Black();
      mat.zOffset = -2;
      const p = CreatePlane('siteMark' + site.name, { size: 5 }, this.scene);
      p.material = mat;
      p.rotation.x = Math.PI / 2;
      p.position.set((site.min[0] + site.max[0]) / 2, 0.03, (site.min[1] + site.max[1]) / 2);
      p.isPickable = false;
      p.receiveShadows = true;
      meshes.push(p);
    }
  }

  private createDoors(meshes: Mesh[], shadow: ShadowGenerator | null): Door[] {
    const doors: Door[] = [];
    const mat = this.material('door');
    for (const d of this.def.doors) {
      const [x0, y0, z0] = d.min;
      const [x1, y1, z1] = d.max;
      const along = d.axis === 'x' ? x1 - x0 : z1 - z0;
      const half = along / 2;
      const door: Door = { def: d, open: d.open, t: d.open ? 1 : 0, leaves: [], center: { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: (z0 + z1) / 2 } };
      for (const side of [-1, 1]) {
        const lmin: Vec3 = d.axis === 'x' ? { x: side < 0 ? x0 : x0 + half, y: y0, z: z0 } : { x: x0, y: y0, z: side < 0 ? z0 : z0 + half };
        const lmax: Vec3 = d.axis === 'x' ? { x: side < 0 ? x0 + half : x1, y: y1, z: z1 } : { x: x1, y: y1, z: side < 0 ? z0 + half : z1 };
        const mesh = CreateBox('door_' + d.id + side, {
          width: lmax.x - lmin.x - 0.02,
          height: lmax.y - lmin.y,
          depth: lmax.z - lmin.z - 0.02
        }, this.scene);
        mesh.material = mat;
        mesh.isPickable = false;
        mesh.receiveShadows = true;
        shadow?.addShadowCaster(mesh, false);
        const collider = this.world.add(lmin, lmax, 'metal', { tag: 'door:' + d.id });
        door.leaves.push({ mesh, collider, closedMin: lmin, closedMax: lmax, openOffset: side * (half - 0.08) });
        meshes.push(mesh);
      }
      this.applyDoor(door);
      doors.push(door);
    }
    return doors;
  }

  private applyDoor(door: Door): void {
    for (const leaf of door.leaves) {
      const off = leaf.openOffset * door.t;
      const ax = door.def.axis;
      const min = { ...leaf.closedMin }, max = { ...leaf.closedMax };
      min[ax] += off;
      max[ax] += off;
      // Aberta: a folha fica dentro do batente; o colisor encolhe para não atrapalhar a passagem
      this.world.move(leaf.collider, min, max);
      leaf.collider.enabled = door.t < 0.98;
      leaf.mesh.position.set((min.x + max.x) / 2, (min.y + max.y) / 2, (min.z + max.z) / 2);
    }
  }

  private doorBlocked(door: Door, playerBox?: [Vec3, Vec3]): boolean {
    if (!playerBox) return false;
    const [pm, pM] = playerBox;
    for (const leaf of door.leaves) {
      const a = leaf.closedMin, b = leaf.closedMax;
      if (pM.x > a.x && pm.x < b.x && pM.y > a.y && pm.y < b.y && pM.z > a.z && pm.z < b.z) return true;
    }
    return false;
  }

  private toggleDoor(door: Door, playerBox?: [Vec3, Vec3]): boolean {
    // Não fecha a porta em cima do jogador
    if (door.open && this.doorBlocked(door, playerBox)) return false;
    door.open = !door.open;
    return true;
  }

  private updateDoors(doors: Door[], dt: number, playerBox?: [Vec3, Vec3]): void {
    for (const d of doors) {
      // Alguém entrou no vão enquanto a porta fechava: ela volta a abrir
      if (!d.open && d.t > 0 && this.doorBlocked(d, playerBox)) d.open = true;
      const target = d.open ? 1 : 0;
      if (d.t === target) continue;
      d.t += Math.sign(target - d.t) * dt * 1.8;
      d.t = Math.max(0, Math.min(1, d.t));
      if (Math.abs(d.t - target) < 0.01) d.t = target;
      this.applyDoor(d);
    }
  }
}
