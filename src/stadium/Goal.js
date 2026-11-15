// Gol com traves, travessão, redes deformáveis e colisões com a bola.
import {
  Mesh, MeshBuilder, VertexData, StandardMaterial, Color3, Vector3, TransformNode
} from '../babylon.js';
import { FIELD, BALL } from '../config.js';

const tmp = new Vector3();

/** Painel de rede com simulação mola-amortecedor por vértice. */
class NetPanel {
  constructor(name, scene, material, origin, uAxis, vAxis, uLen, vLen, normal, parent) {
    this.nu = Math.max(4, Math.round(uLen / 0.18));
    this.nv = Math.max(4, Math.round(vLen / 0.18));
    this.normal = normal.clone();
    const count = (this.nu + 1) * (this.nv + 1);
    this.base = new Float32Array(count * 3);
    this.pin = new Float32Array(count);
    this.disp = new Float32Array(count);
    this.vel = new Float32Array(count);
    this.positions = new Float32Array(count * 3);
    const uvs = new Float32Array(count * 2);
    const indices = [];
    let k = 0;
    for (let j = 0; j <= this.nv; j++) {
      for (let i = 0; i <= this.nu; i++) {
        const a = i / this.nu, b = j / this.nv;
        const p = origin.add(uAxis.scale(a * uLen)).add(vAxis.scale(b * vLen));
        this.base[k * 3] = p.x; this.base[k * 3 + 1] = p.y; this.base[k * 3 + 2] = p.z;
        this.pin[k] = Math.sin(Math.PI * a) * Math.sin(Math.PI * b);
        uvs[k * 2] = (a * uLen) / 0.16;
        uvs[k * 2 + 1] = (b * vLen) / 0.16;
        k++;
      }
    }
    for (let j = 0; j < this.nv; j++) {
      for (let i = 0; i < this.nu; i++) {
        const a = j * (this.nu + 1) + i;
        const b = a + 1, c = a + this.nu + 1, d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }
    this.positions.set(this.base);
    const vd = new VertexData();
    vd.positions = this.positions;
    vd.indices = indices;
    vd.uvs = uvs;
    const normals = [];
    VertexData.ComputeNormals(this.positions, indices, normals);
    vd.normals = normals;
    this.mesh = new Mesh(name, scene);
    vd.applyToMesh(this.mesh, true);
    this.mesh.material = material;
    this.mesh.parent = parent;
    this.mesh.isPickable = false;
    this.active = false;
  }

  /** Aplica impulso a partir de um ponto local (coordenadas do gol). */
  hit(localPoint, strength) {
    const s2 = 2 * 0.45 * 0.45;
    for (let k = 0; k < this.disp.length; k++) {
      const dx = this.base[k * 3] - localPoint.x;
      const dy = this.base[k * 3 + 1] - localPoint.y;
      const dz = this.base[k * 3 + 2] - localPoint.z;
      const w = Math.exp(-(dx * dx + dy * dy + dz * dz) / s2);
      this.vel[k] += strength * w;
    }
    this.active = true;
  }

  update(dt) {
    if (!this.active) return;
    const stiff = 120, damp = 7;
    let energy = 0;
    const n = this.normal;
    for (let k = 0; k < this.disp.length; k++) {
      const acc = -stiff * this.disp[k] - damp * this.vel[k];
      this.vel[k] += acc * dt;
      this.disp[k] += this.vel[k] * dt;
      const d = this.disp[k] * this.pin[k];
      this.positions[k * 3] = this.base[k * 3] + n.x * d;
      this.positions[k * 3 + 1] = this.base[k * 3 + 1] + n.y * d;
      this.positions[k * 3 + 2] = this.base[k * 3 + 2] + n.z * d;
      energy += Math.abs(this.disp[k]) + Math.abs(this.vel[k]) * 0.05;
    }
    this.mesh.updateVerticesData('position', this.positions, false, false);
    if (energy / this.disp.length < 0.0005) {
      this.disp.fill(0);
      this.vel.fill(0);
      this.positions.set(this.base);
      this.mesh.updateVerticesData('position', this.positions, false, false);
      this.active = false;
    }
  }
}

export class Goal {
  /**
   * @param {number} side +1 = gol do lado X positivo, -1 = lado X negativo
   */
  constructor(scene, side, materials, shadowGenerator) {
    this.side = side;
    this.lineX = side * FIELD.length / 2;
    this.root = new TransformNode('goal' + side, scene);
    // O gol é construído em coordenadas locais: x local cresce "para dentro" do gol.
    this.root.position.set(this.lineX, 0, 0);
    if (side < 0) this.root.rotation.y = Math.PI;

    const gw = FIELD.goalWidth, gh = FIELD.goalHeight, gd = FIELD.goalDepth, pr = FIELD.postRadius;
    const frameMat = materials.post;
    const bars = [];
    const bar = (name, from, to, radius = pr) => {
      const len = Vector3.Distance(from, to);
      const m = MeshBuilder.CreateCylinder(name, { height: len, diameter: radius * 2, tessellation: 10 }, scene);
      m.position = from.add(to).scale(0.5);
      const dir = to.subtract(from).normalize();
      // cilindro nasce no eixo Y; alinhar com a direção
      const up = new Vector3(0, 1, 0);
      const axis = Vector3.Cross(up, dir);
      const angle = Math.acos(Math.min(1, Math.max(-1, Vector3.Dot(up, dir))));
      if (axis.lengthSquared() > 1e-6) m.rotate(axis.normalize(), angle);
      // sem parent: as barras são unidas em uma malha só e depois presas ao gol
      bars.push(m);
      return m;
    };
    // traves e travessão
    bar('postL', new Vector3(0, 0, -gw / 2), new Vector3(0, gh, -gw / 2));
    bar('postR', new Vector3(0, 0, gw / 2), new Vector3(0, gh, gw / 2));
    bar('crossbar', new Vector3(0, gh, -gw / 2 - pr), new Vector3(0, gh, gw / 2 + pr));
    // estrutura de trás (mais fina)
    const r2 = pr * 0.55;
    bar('backL', new Vector3(gd, 0, -gw / 2), new Vector3(gd, gh, -gw / 2), r2);
    bar('backR', new Vector3(gd, 0, gw / 2), new Vector3(gd, gh, gw / 2), r2);
    bar('backTop', new Vector3(gd, gh, -gw / 2), new Vector3(gd, gh, gw / 2), r2);
    bar('topL', new Vector3(0, gh, -gw / 2), new Vector3(gd, gh, -gw / 2), r2);
    bar('topR', new Vector3(0, gh, gw / 2), new Vector3(gd, gh, gw / 2), r2);
    bar('groundBack', new Vector3(gd, r2, -gw / 2), new Vector3(gd, r2, gw / 2), r2);
    bar('groundL', new Vector3(0, r2, -gw / 2), new Vector3(gd, r2, -gw / 2), r2);
    bar('groundR', new Vector3(0, r2, gw / 2), new Vector3(gd, r2, gw / 2), r2);
    const frame = Mesh.MergeMeshes(bars, true, true, undefined, false, false);
    frame.name = 'goalFrame' + side;
    frame.material = frameMat;
    frame.parent = this.root;
    frame.isPickable = false;
    if (shadowGenerator) shadowGenerator.addShadowCaster(frame);
    this.frame = frame;

    // redes
    const netMat = materials.net;
    this.nets = {
      back: new NetPanel('netBack', scene, netMat, new Vector3(gd, 0, -gw / 2), new Vector3(0, 0, 1), new Vector3(0, 1, 0), gw, gh, new Vector3(1, 0, 0), this.root),
      left: new NetPanel('netL', scene, netMat, new Vector3(0, 0, -gw / 2), new Vector3(1, 0, 0), new Vector3(0, 1, 0), gd, gh, new Vector3(0, 0, -1), this.root),
      right: new NetPanel('netR', scene, netMat, new Vector3(0, 0, gw / 2), new Vector3(1, 0, 0), new Vector3(0, 1, 0), gd, gh, new Vector3(0, 0, 1), this.root),
      top: new NetPanel('netTop', scene, netMat, new Vector3(0, gh, -gw / 2), new Vector3(1, 0, 0), new Vector3(0, 0, 1), gd, gw, new Vector3(0, 1, 0), this.root)
    };

    // segmentos de colisão (traves e travessão) em coordenadas do mundo
    const w = (lx, y, lz) => new Vector3(this.lineX + side * lx, y, side * lz);
    this.segments = [
      [w(0, 0, -gw / 2), w(0, gh, -gw / 2)],
      [w(0, 0, gw / 2), w(0, gh, gw / 2)],
      [w(0, gh, -gw / 2), w(0, gh, gw / 2)]
    ];
  }

  /** Converte posição do mundo para coordenadas locais do gol (lx > 0 = dentro do gol). */
  toLocal(p, out) {
    out.x = this.side * p.x - FIELD.length / 2;
    out.y = p.y;
    out.z = this.side * p.z;
    return out;
  }

  /**
   * Resolve colisões da bola com traves, travessão e redes.
   * Retorna um evento ('post' | 'net' | null).
   */
  collideBall(ball) {
    const r = ball.radius;
    const p = ball.position, v = ball.velocity;
    let event = null;

    // traves / travessão (esfera x segmento)
    for (const [a, b] of this.segments) {
      const ab = b.subtract(a);
      const t = Math.max(0, Math.min(1, Vector3.Dot(p.subtract(a), ab) / ab.lengthSquared()));
      const closest = a.add(ab.scale(t));
      p.subtractToRef(closest, tmp);
      const minD = r + FIELD.postRadius;
      const d2 = tmp.lengthSquared();
      if (d2 < minD * minD && d2 > 1e-8) {
        const d = Math.sqrt(d2);
        const n = tmp.scale(1 / d);
        p.copyFrom(closest.add(n.scale(minD + 0.001)));
        const vn = Vector3.Dot(v, n);
        if (vn < 0) {
          v.subtractInPlace(n.scale((1 + BALL.postRestitution) * vn));
          if (-vn > 2) event = { type: 'post', strength: -vn };
        }
      }
    }

    // redes (somente quando a bola está dentro do gol)
    const L = this.toLocal(p, new Vector3());
    const gw = FIELD.goalWidth, gh = FIELD.goalHeight, gd = FIELD.goalDepth;
    if (L.x > 0 && Math.abs(L.z) < gw / 2 + r && L.y < gh + r) {
      // velocidade em coordenadas locais
      let vx = this.side * v.x, vz = this.side * v.z;
      const nr = BALL.netRestitution;
      if (L.x + r > gd) {
        const speed = Math.abs(vx) + Math.abs(v.y) * 0.3;
        L.x = gd - r;
        if (vx > 0) {
          this.nets.back.hit(new Vector3(gd, L.y, L.z), Math.min(14, speed * 0.9));
          vx = -vx * nr;
          v.y *= 0.6; vz *= 0.6;
          if (speed > 1.5) event = event || { type: 'net', strength: speed };
        }
      }
      if (Math.abs(L.z) + r > gw / 2) {
        const s = Math.sign(L.z);
        L.z = s * (gw / 2 - r);
        if (vz * s > 0) {
          (s > 0 ? this.nets.right : this.nets.left).hit(new Vector3(L.x, L.y, s * gw / 2), Math.min(8, Math.abs(vz) * 0.8));
          vz = -vz * nr;
          vx *= 0.8;
        }
      }
      if (L.y + r > gh) {
        L.y = gh - r;
        if (v.y > 0) {
          this.nets.top.hit(new Vector3(L.x, gh, L.z), Math.min(8, v.y * 0.8));
          v.y = -v.y * nr;
        }
      }
      // dentro do gol a bola perde energia rápido (rede segura a bola)
      const damp = 1 - Math.min(1, 1.6 * ball.lastStep);
      vx *= damp; vz *= damp;
      p.x = this.side * (L.x + FIELD.length / 2);
      p.y = L.y;
      p.z = this.side * L.z;
      v.x = this.side * vx;
      v.z = this.side * vz;
    }
    return event;
  }

  /** A bola cruzou totalmente a linha dentro da boca do gol? */
  isGoal(ball) {
    const L = this.toLocal(ball.position, new Vector3());
    return L.x > ball.radius && Math.abs(L.z) < FIELD.goalWidth / 2 && L.y < FIELD.goalHeight;
  }

  /** Ponto central da boca do gol (para mirar). */
  get mouthCenter() {
    return new Vector3(this.lineX, FIELD.goalHeight * 0.4, 0);
  }

  update(dt) {
    for (const k in this.nets) this.nets[k].update(dt);
  }
}
