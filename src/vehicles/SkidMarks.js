// =============================================================
// EXTREME RACING — SkidMarks
// Marcas de pneu no asfalto: uma única malha dinâmica (buffer
// circular de quadriláteros) compartilhada por todos os carros.
// Cada roda deixa um rastro enquanto derrapa, patina ou trava.
// =============================================================
import { Mesh, VertexData, StandardMaterial, Color3 } from '@babylonjs/core';

export class SkidMarks {
  /**
   * @param {Scene} scene
   * @param {number} maxQuads tamanho do buffer (segmentos)
   */
  constructor(scene, maxQuads = 1600) {
    this.scene = scene;
    this.max = maxQuads;
    this.next = 0;
    this.dirty = false;
    this.positions = new Float32Array(maxQuads * 4 * 3);
    this.colors = new Float32Array(maxQuads * 4 * 4);
    const indices = new Uint32Array(maxQuads * 6);
    const normals = new Float32Array(maxQuads * 4 * 3);
    for (let q = 0; q < maxQuads; q++) {
      const v = q * 4;
      indices.set([v, v + 1, v + 2, v + 1, v + 3, v + 2], q * 6);
      for (let k = 0; k < 4; k++) normals[(v + k) * 3 + 1] = 1;
    }
    const mesh = new Mesh('skidMarks', scene);
    const vd = new VertexData();
    vd.positions = this.positions;
    vd.indices = indices;
    vd.normals = normals;
    vd.colors = this.colors;
    vd.applyToMesh(mesh, true);
    const mat = new StandardMaterial('skidMat', scene);
    mat.diffuseColor = new Color3(0.02, 0.02, 0.02);
    mat.specularColor = new Color3(0, 0, 0);
    mat.zOffset = -6;
    mat.backFaceCulling = false;
    mesh.hasVertexAlpha = true; // alfa por vértice (marcas esmaecem)
    mesh.material = mat;
    mesh.alwaysSelectAsActiveMesh = true; // o buffer muda o tempo todo
    mesh.isPickable = false;
    this.mesh = mesh;
    this.last = new Map(); // roda -> último ponto
  }

  /** Atualiza o rastro de todas as rodas de um carro. */
  addVehicle(vehicle) {
    const ph = vehicle.physics;
    const right = ph.axes.right;
    for (const w of ph.wheels) {
      const key = w;
      const surf = w.surface?.id;
      const paved = surf === 'asphalt' || surf === 'kerb';
      const intensity = w.contact && paved ? Math.min(1, Math.max(0, (w.slipSpeed - 3.2) / 6)) : 0;
      if (intensity <= 0.02 || ph.speed < 2) { this.last.delete(key); continue; }
      const p = w.contactPoint;
      const prev = this.last.get(key);
      if (prev) {
        const dx = p.x - prev.x, dz = p.z - prev.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < 0.36) continue; // segmento mínimo de 0,6 m
        if (d2 < 25) this._quad(prev, p, right, w.width * 0.45, Math.min(prev.a, intensity) * 0.75, intensity * 0.75);
      }
      this.last.set(key, { x: p.x, y: p.y, z: p.z, a: intensity });
    }
  }

  _quad(a, b, right, hw, alphaA, alphaB) {
    const q = this.next;
    this.next = (this.next + 1) % this.max;
    const P = this.positions, C = this.colors;
    const o = q * 12;
    const lift = 0.045;
    const set = (k, x, y, z) => { P[o + k * 3] = x; P[o + k * 3 + 1] = y + lift; P[o + k * 3 + 2] = z; };
    set(0, a.x - right.x * hw, a.y, a.z - right.z * hw);
    set(1, a.x + right.x * hw, a.y, a.z + right.z * hw);
    set(2, b.x - right.x * hw, b.y, b.z - right.z * hw);
    set(3, b.x + right.x * hw, b.y, b.z + right.z * hw);
    const c = q * 16;
    for (let k = 0; k < 4; k++) {
      C[c + k * 4] = 0.02; C[c + k * 4 + 1] = 0.02; C[c + k * 4 + 2] = 0.02;
      C[c + k * 4 + 3] = k < 2 ? alphaA : alphaB;
    }
    this.dirty = true;
  }

  /** Envia o buffer à GPU (uma vez por quadro, se mudou). */
  flush() {
    if (!this.dirty) return;
    this.dirty = false;
    this.mesh.updateVerticesData('position', this.positions, false, false);
    this.mesh.updateVerticesData('color', this.colors, false, false);
  }

  dispose() {
    this.mesh.dispose();
  }
}
