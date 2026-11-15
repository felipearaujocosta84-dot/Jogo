// Terreno: usa a malha "Vale_Verde_Terrain" do mapa GLB.
// Constrói um mapa de alturas a partir dos vértices (grade regular) para:
//  - posicionar personagens no chão (altura bilinear),
//  - calcular normais/inclinação,
//  - desenhar o minimapa.
import { StandardMaterial, DynamicTexture, Texture, Color3, VertexBuffer } from '../babylon.js';

export class Terrain {
  /**
   * @param {import('@babylonjs/core').Scene} scene
   * @param {import('@babylonjs/core').Mesh} mesh malha do terreno já com a transformação "assada" (coordenadas de mundo)
   */
  constructor(scene, mesh) {
    this.scene = scene;
    this.mesh = mesh;
    this.buildHeightmap();
    this.applyMaterial();
  }

  buildHeightmap() {
    const pos = this.mesh.getVerticesData(VertexBuffer.PositionKind);
    const col = this.mesh.getVerticesData(VertexBuffer.ColorKind);
    const count = pos.length / 3;
    const n = Math.round(Math.sqrt(count));
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < count; i++) {
      minX = Math.min(minX, pos[i * 3]); maxX = Math.max(maxX, pos[i * 3]);
      minZ = Math.min(minZ, pos[i * 3 + 2]); maxZ = Math.max(maxZ, pos[i * 3 + 2]);
    }
    this.n = n;
    this.minX = minX; this.maxX = maxX; this.minZ = minZ; this.maxZ = maxZ;
    this.stepX = (maxX - minX) / (n - 1);
    this.stepZ = (maxZ - minZ) / (n - 1);
    this.heights = new Float32Array(n * n);
    this.colors = new Float32Array(n * n * 3);
    let minH = Infinity, maxH = -Infinity;
    for (let i = 0; i < count; i++) {
      const ix = Math.round((pos[i * 3] - minX) / this.stepX);
      const iz = Math.round((pos[i * 3 + 2] - minZ) / this.stepZ);
      const k = iz * n + ix;
      const h = pos[i * 3 + 1];
      this.heights[k] = h;
      minH = Math.min(minH, h); maxH = Math.max(maxH, h);
      if (col) {
        this.colors[k * 3] = col[i * 4];
        this.colors[k * 3 + 1] = col[i * 4 + 1];
        this.colors[k * 3 + 2] = col[i * 4 + 2];
      }
    }
    this.minH = minH; this.maxH = maxH;

    // UVs a partir de XZ (para a textura de detalhe repetida)
    const uvs = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      uvs[i * 2] = pos[i * 3] / 6;
      uvs[i * 2 + 1] = pos[i * 3 + 2] / 6;
    }
    this.mesh.setVerticesData(VertexBuffer.UVKind, uvs, false);
  }

  applyMaterial() {
    const scene = this.scene;
    const mat = new StandardMaterial('terrainMat', scene);
    // Textura de detalhe procedural (ruído de grama/terra) multiplicada pelas cores de vértice do mapa
    const size = 256;
    const tex = new DynamicTexture('terrainDetail', { width: size, height: size }, scene, true);
    const ctx = tex.getContext();
    const img = ctx.createImageData(size, size);
    let seed = 1337;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < size * size; i++) {
      const v = 0.86 + rnd() * 0.22;
      img.data[i * 4] = Math.min(255, 255 * v);
      img.data[i * 4 + 1] = Math.min(255, 255 * (v + 0.02));
      img.data[i * 4 + 2] = Math.min(255, 255 * (v - 0.03));
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    // pequenas manchas e "fios" de grama
    for (let i = 0; i < 900; i++) {
      const x = rnd() * size, y = rnd() * size;
      const g = 150 + rnd() * 105;
      ctx.strokeStyle = `rgba(${g * 0.85 | 0},${g | 0},${g * 0.7 | 0},0.35)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rnd() - 0.5) * 3, y - 2 - rnd() * 4);
      ctx.stroke();
    }
    for (let i = 0; i < 60; i++) {
      const x = rnd() * size, y = rnd() * size, r = 4 + rnd() * 14;
      const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
      const d = rnd() < 0.5 ? '120,100,70' : '200,215,170';
      grd.addColorStop(0, `rgba(${d},0.22)`);
      grd.addColorStop(1, `rgba(${d},0)`);
      ctx.fillStyle = grd;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    tex.update(true);
    tex.wrapU = tex.wrapV = Texture.WRAP_ADDRESSMODE;
    tex.anisotropicFilteringLevel = 4;
    mat.diffuseTexture = tex;
    mat.specularColor = new Color3(0.03, 0.03, 0.03);
    mat.diffuseColor = new Color3(1.08, 1.08, 1.02);
    this.mesh.material = mat;
    this.mesh.useVertexColors = true;
    this.mesh.receiveShadows = true;
    this.mesh.isPickable = false;
    this.mesh.freezeWorldMatrix();
    this.material = mat;
  }

  /** Altura do terreno em (x, z) com interpolação bilinear. */
  heightAt(x, z) {
    const n = this.n;
    let fx = (x - this.minX) / this.stepX;
    let fz = (z - this.minZ) / this.stepZ;
    fx = Math.max(0, Math.min(n - 1.001, fx));
    fz = Math.max(0, Math.min(n - 1.001, fz));
    const ix = fx | 0, iz = fz | 0;
    const tx = fx - ix, tz = fz - iz;
    const h = this.heights;
    const a = h[iz * n + ix], b = h[iz * n + ix + 1];
    const c = h[(iz + 1) * n + ix], d = h[(iz + 1) * n + ix + 1];
    return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
  }

  /** Inclinação (gradiente) aproximada em (x, z). */
  slopeAt(x, z) {
    const e = 0.6;
    const dx = (this.heightAt(x + e, z) - this.heightAt(x - e, z)) / (2 * e);
    const dz = (this.heightAt(x, z + e) - this.heightAt(x, z - e)) / (2 * e);
    return { dx, dz, mag: Math.hypot(dx, dz) };
  }

  /** Cor do terreno (0..1) em (x, z) — usada no minimapa. */
  colorAt(x, z) {
    const n = this.n;
    const ix = Math.max(0, Math.min(n - 1, Math.round((x - this.minX) / this.stepX)));
    const iz = Math.max(0, Math.min(n - 1, Math.round((z - this.minZ) / this.stepZ)));
    const k = (iz * n + ix) * 3;
    return [this.colors[k], this.colors[k + 1], this.colors[k + 2]];
  }
}
