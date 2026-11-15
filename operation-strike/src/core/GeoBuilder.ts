// Monta uma malha única a partir de várias peças primitivas (caixas, cilindros, esferas, cápsulas),
// com cor por vértice e, opcionalmente, índice de osso por peça (malha com skinning).
// Uma malha = uma chamada de desenho: essencial para o desempenho no celular.
import {
  Color3,
  CreateBoxVertexData,
  CreateCapsuleVertexData,
  CreateCylinderVertexData,
  CreateSphereVertexData,
  Matrix,
  Mesh,
  Quaternion,
  Vector3,
  VertexData,
  type Scene
} from './babylon';

export type V3 = [number, number, number];

export class GeoBuilder {
  private positions: number[] = [];
  private normals: number[] = [];
  private colors: number[] = [];
  private indices: number[] = [];
  private boneIdx: number[] = [];
  private boneW: number[] = [];
  private uvs: number[] = [];
  /** Peças seguintes recebem o padrão da skin (UV na área do desenho) ou cor lisa (UV na faixa branca). */
  patterned = false;

  add(vd: VertexData, pos: V3, rot: V3 = [0, 0, 0], color: string | Color3 = '#888888', bone = 0, scale: V3 = [1, 1, 1]): this {
    const m = Matrix.Compose(new Vector3(...scale), Quaternion.FromEulerAngles(rot[0], rot[1], rot[2]), new Vector3(...pos));
    vd.transform(m);
    const base = this.positions.length / 3;
    const c = typeof color === 'string' ? Color3.FromHexString(color) : color;
    const p = vd.positions!, n = vd.normals!, idx = vd.indices!;
    const uv = vd.uvs;
    for (let i = 0, k = 0; i < p.length; i += 3, k += 2) {
      // a textura da skin tem o desenho em u 0..0,74 e uma faixa branca em u > 0,8
      if (this.patterned && uv) this.uvs.push(uv[k] * 0.72 + 0.01, uv[k + 1]);
      else this.uvs.push(0.9, 0.5);
      this.positions.push(p[i], p[i + 1], p[i + 2]);
      this.normals.push(n[i], n[i + 1], n[i + 2]);
      this.colors.push(c.r, c.g, c.b, 1);
      this.boneIdx.push(bone, 0, 0, 0);
      this.boneW.push(1, 0, 0, 0);
    }
    for (const i of idx) this.indices.push(base + i);
    return this;
  }

  box(w: number, h: number, d: number, pos: V3, color: string, rot?: V3, bone = 0): this {
    return this.add(CreateBoxVertexData({ width: w, height: h, depth: d }), pos, rot, color, bone);
  }

  /** Cilindro (eixo Y). */
  cyl(dTop: number, dBot: number, h: number, pos: V3, color: string, rot?: V3, bone = 0, tess = 10): this {
    return this.add(CreateCylinderVertexData({ diameterTop: dTop, diameterBottom: dBot, height: h, tessellation: tess }), pos, rot, color, bone);
  }

  sphere(d: number, pos: V3, color: string, scale: V3 = [1, 1, 1], bone = 0, seg = 8): this {
    return this.add(CreateSphereVertexData({ diameter: d, segments: seg }), pos, [0, 0, 0], color, bone, scale);
  }

  /** Cápsula (eixo Y) — membros com proporções humanas. */
  capsule(r: number, h: number, pos: V3, color: string, rot?: V3, bone = 0, scale: V3 = [1, 1, 1]): this {
    return this.add(CreateCapsuleVertexData({ radius: r, height: h, tessellation: 10, subdivisions: 1, capSubdivisions: 3 }), pos, rot, color, bone, scale);
  }

  /** Copia todas as peças de outro construtor. */
  merge(o: GeoBuilder): this {
    const base = this.positions.length / 3;
    this.positions.push(...o.positions);
    this.normals.push(...o.normals);
    this.colors.push(...o.colors);
    this.boneIdx.push(...o.boneIdx);
    this.boneW.push(...o.boneW);
    this.uvs.push(...o.uvs);
    for (const i of o.indices) this.indices.push(base + i);
    return this;
  }

  /** Dados brutos (miniaturas desenhadas em canvas). */
  get data() {
    return { positions: this.positions, normals: this.normals, colors: this.colors, indices: this.indices, uvs: this.uvs };
  }

  get vertexCount(): number {
    return this.positions.length / 3;
  }

  build(name: string, scene: Scene, skinned = false): Mesh {
    const mesh = new Mesh(name, scene);
    const vd = new VertexData();
    vd.positions = this.positions;
    vd.normals = this.normals;
    vd.colors = this.colors;
    vd.indices = this.indices;
    vd.uvs = this.uvs;
    if (skinned) {
      vd.matricesIndices = this.boneIdx;
      vd.matricesWeights = this.boneW;
    }
    vd.applyToMesh(mesh, false);
    mesh.useVertexColors = true;
    mesh.hasVertexAlpha = false;
    mesh.isPickable = false;
    return mesh;
  }
}
