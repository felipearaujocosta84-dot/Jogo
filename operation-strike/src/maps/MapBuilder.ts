// Parte visual do mapa (Babylon): geometria com UVs em coordenadas de mundo, malhas agrupadas por material
// e por bloco (poucas chamadas de desenho + recorte por visibilidade), iluminação, sombras, céu, neblina,
// portas animadas e marcações dos pontos de bomba. A colisão fica no MapRuntime (compartilhado com o servidor).
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
import type { QualityPreset } from '../core/Quality';
import { getTexture, paintedTexture } from './textures';
import { expandMap } from './MapLayout';
import type { MapRuntime } from './MapRuntime';
import { MATERIAL_SCALE, type BoxDef, type MapDefinition, type MaterialName } from './MapTypes';

const CHUNK = 32;

interface GeoBucket {
  mat: MaterialName;
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
  shadow: boolean;
}

export interface MapVisual {
  shadow: ShadowGenerator | null;
  meshes: Mesh[];
  sun: DirectionalLight;
  setRenderDistance(d: number): void;
  /** Atualiza as portas a partir do estado do runtime. */
  update(): void;
  dispose(): void;
}

function hex(c: string): Color3 {
  return Color3.FromHexString(c);
}

export class MapBuilder {
  private buckets = new Map<string, GeoBucket>();
  private materials = new Map<MaterialName, StandardMaterial>();
  private def: MapDefinition;

  constructor(private scene: Scene, private runtime: MapRuntime, private quality: QualityPreset) {
    this.def = runtime.def;
  }

  build(): MapVisual {
    const { def, scene } = this;
    const { minX, maxX, minZ, maxZ } = this.runtime.bounds;
    const layout = expandMap(def);
    for (const f of layout.floors) this.addQuadTop(f.x0, f.z0, f.x1, f.z1, f.y, f.mat);
    for (const b of layout.boxes) {
      if (b.detail && !this.quality.props) continue;
      this.addBox(b);
    }
    // chão fora da área jogável (visual)
    this.addQuadTop(minX - 40, minZ - 40, maxX + 40, minZ, 0, layoutGround(def));
    this.addQuadTop(minX - 40, maxZ, maxX + 40, maxZ + 40, 0, layoutGround(def));
    this.addQuadTop(minX - 40, minZ, minX, maxZ, 0, layoutGround(def));
    this.addQuadTop(maxX, minZ, maxX + 40, maxZ, 0, layoutGround(def));
    const meshes = this.flush();

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
      // Cenário estático: o mapa de sombras é desenhado uma vez só
      const rt = shadow.getShadowMap();
      if (rt) rt.refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
    }

    const sky = this.createSky();
    meshes.push(sky);
    scene.fogMode = 3;
    scene.fogColor = hex(amb.fog);
    scene.clearColor = Color4.FromColor3(hex(amb.fog), 1);
    scene.ambientColor = new Color3(0.25, 0.22, 0.2);

    this.createSiteMarkers(meshes);
    const doorMeshes = this.createDoors(meshes);
    const runtime = this.runtime;
    const updateDoors = () => {
      for (const dm of doorMeshes) {
        const [min, max] = runtime.leafBox(runtime.doors[dm.door], dm.leaf);
        dm.mesh.position.set((min.x + max.x) / 2, (min.y + max.y) / 2, (min.z + max.z) / 2);
      }
    };
    updateDoors();

    return {
      shadow,
      meshes,
      sun,
      setRenderDistance: (d: number) => {
        scene.fogStart = d * 0.45;
        scene.fogEnd = d;
        const cam = scene.activeCamera;
        if (cam) cam.maxZ = d + 20;
        sky.scaling.setAll(Math.max(30, d * 0.9) / 100);
      },
      update: updateDoors,
      dispose: () => {
        for (const m of meshes) m.dispose(false, true);
        shadow?.dispose();
        hemi.dispose();
        sun.dispose();
        for (const mat of this.materials.values()) mat.dispose(true, false);
      }
    };
  }

  // -------------------------------------------------------------- geometria

  private bucket(mat: MaterialName, cx: number, cz: number, shadow: boolean): GeoBucket {
    const key = `${mat}|${Math.floor(cx / CHUNK)}|${Math.floor(cz / CHUNK)}|${shadow ? 1 : 0}`;
    let b = this.buckets.get(key);
    if (!b) this.buckets.set(key, (b = { mat, positions: [], normals: [], uvs: [], indices: [], shadow }));
    return b;
  }

  addBox(b: BoxDef): void {
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
        const bucket = this.bucket(mat, (cx + ex) / 2, (cz + ez) / 2, y > 0.05);
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
    m.specularColor = name === 'glass' ? new Color3(0.8, 0.8, 0.8) : name === 'metal' || name === 'container' || name === 'door' || name === 'steel' ? new Color3(0.25, 0.25, 0.25) : new Color3(0.04, 0.04, 0.04);
    if (name === 'glass') m.specularPower = 96;
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

  private createDoors(meshes: Mesh[]): { mesh: Mesh; door: number; leaf: number }[] {
    const out: { mesh: Mesh; door: number; leaf: number }[] = [];
    const mat = this.material('door');
    for (const door of this.runtime.doors) {
      door.leaves.forEach((leaf, li) => {
        const mesh = CreateBox('door_' + door.def.id + li, {
          width: leaf.closedMax.x - leaf.closedMin.x - 0.02,
          height: leaf.closedMax.y - leaf.closedMin.y,
          depth: leaf.closedMax.z - leaf.closedMin.z - 0.02
        }, this.scene);
        mesh.material = mat;
        mesh.isPickable = false;
        mesh.receiveShadows = true;
        meshes.push(mesh);
        out.push({ mesh, door: door.index, leaf: li });
      });
    }
    return out;
  }
}

function layoutGround(def: MapDefinition): MaterialName {
  const f = def.legend['.'];
  return (f?.floor ?? f?.material ?? 'sand') as MaterialName;
}
