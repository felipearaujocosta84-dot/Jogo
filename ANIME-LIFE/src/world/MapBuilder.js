// Constrói o cenário a partir do JSON do mapa: grade de piso/parede, fundo pré-renderizado
// (uma única textura = poucas chamadas de desenho), colisões e objetos.
import { RES, ensureTexture, drawDecal } from './FurnitureArt.js';

const FLOOR = {
  wood: (c, x, y, T, i) => {
    c.fillStyle = (i % 3 === 0) ? '#d9a877' : (i % 3 === 1 ? '#d3a070' : '#dcae7e'); c.fillRect(x, y, T, T);
    c.fillStyle = 'rgba(120,70,40,0.25)';
    c.fillRect(x, y + T / 2 - 0.5, T, 1); c.fillRect(x, y + T - 1, T, 1);
    c.fillRect(x + ((i * 13) % T), y, 1, T / 2); c.fillRect(x + ((i * 7 + 16) % T), y + T / 2, 1, T / 2);
  },
  tile: (c, x, y, T, i, tx, ty) => {
    c.fillStyle = (tx + ty) % 2 ? '#eef0f2' : '#dfe6ec'; c.fillRect(x, y, T, T);
    c.fillStyle = 'rgba(90,100,120,0.18)'; c.fillRect(x, y, T, 1); c.fillRect(x, y, 1, T);
  },
  genkan: (c, x, y, T, i, tx, ty) => {
    c.fillStyle = (tx + ty) % 2 ? '#a7a3a8' : '#9c98a0'; c.fillRect(x, y, T, T);
    c.fillStyle = 'rgba(0,0,0,0.15)'; c.fillRect(x, y, T, 1); c.fillRect(x, y, 1, T);
  },
};

export class MapBuilder {
  constructor(scene, map) {
    this.scene = scene; this.map = map; this.T = map.tileSize;
    this.W = map.width * this.T; this.H = map.height * this.T;
    this.grid = Array.from({ length: map.height }, () => Array(map.width).fill(null)); // null = parede
    const carve = (r) => { for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) this.grid[y][x] = r.floor; };
    map.rooms.forEach(carve); map.openings.forEach(carve); (map.floorPatches || []).forEach(carve);
  }

  isFloor(tx, ty) { return !!this.grid[ty]?.[tx]; }

  /** Parede vista de frente (até 2 tiles acima de um piso) */
  isFace(tx, ty) { return !this.isFloor(tx, ty) && (this.isFloor(tx, ty + 1) || (!this.isFloor(tx, ty + 1) && this.isFloor(tx, ty + 2))); }

  buildBackground() {
    const { T, map } = this;
    const key = `map_${map.id}_bg`;
    if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
    const tex = this.scene.textures.createCanvas(key, this.W * RES, this.H * RES);
    const c = tex.getContext();
    c.save(); c.scale(RES, RES);
    for (let ty = 0; ty < map.height; ty++) {
      for (let tx = 0; tx < map.width; tx++) {
        const x = tx * T, y = ty * T, f = this.grid[ty][tx];
        if (f) FLOOR[f](c, x, y, T, tx * 7 + ty * 3, tx, ty);
        else if (this.isFace(tx, ty)) this.drawWallFace(c, tx, ty);
        else { c.fillStyle = '#3b2f45'; c.fillRect(x, y, T, T); }
      }
    }
    // sombra suave no pé das paredes e contorno das bordas superiores
    for (let ty = 0; ty < map.height; ty++) for (let tx = 0; tx < map.width; tx++) {
      if (!this.isFloor(tx, ty)) continue;
      const x = tx * T, y = ty * T;
      if (!this.isFloor(tx, ty - 1)) { c.fillStyle = 'rgba(40,20,50,0.22)'; c.fillRect(x, y, T, 6); }
      if (!this.isFloor(tx - 1, ty)) { c.fillStyle = 'rgba(40,20,50,0.18)'; c.fillRect(x, y, 5, T); }
      if (!this.isFloor(tx + 1, ty)) { c.fillStyle = 'rgba(40,20,50,0.12)'; c.fillRect(x + T - 3, y, 3, T); }
    }
    (map.decals || []).forEach((d) => drawDecal(c, d.type, d.x, d.y));
    // luz entrando pelas janelas
    map.objects.filter((o) => o.type === 'window').forEach((o) => {
      const g = c.createLinearGradient(0, 64, 0, 190);
      g.addColorStop(0, 'rgba(255,244,210,0.38)'); g.addColorStop(1, 'rgba(255,244,210,0)');
      c.fillStyle = g; c.beginPath();
      c.moveTo(o.x - 34, 64); c.lineTo(o.x + 34, 64); c.lineTo(o.x + 70, 190); c.lineTo(o.x - 6, 190); c.closePath(); c.fill();
    });
    c.restore();
    tex.refresh();
    return key;
  }

  drawWallFace(c, tx, ty) {
    const T = this.T, x = tx * T, y = ty * T;
    const lower = this.isFloor(tx, ty + 1); // linha de baixo da parede (rodapé)
    c.fillStyle = '#f4e6d8'; c.fillRect(x, y, T, T);
    c.fillStyle = 'rgba(214,180,190,0.35)';
    for (let i = 0; i < 4; i++) c.fillRect(x + i * 8 + 3, y, 2, T); // listras do papel de parede
    if (!lower) { c.fillStyle = '#3b2f45'; c.fillRect(x, y, T, 5); c.fillStyle = '#d9c3b0'; c.fillRect(x, y + 5, T, 2); }
    else { c.fillStyle = '#b48a68'; c.fillRect(x, y + T - 6, T, 6); c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(x, y + T - 7, T, 1); }
  }

  /** Corpos estáticos de colisão: paredes (fundidas em retângulos por linha) + móveis. */
  buildColliders(group) {
    const { T, map } = this;
    for (let ty = 0; ty < map.height; ty++) {
      let start = -1;
      for (let tx = 0; tx <= map.width; tx++) {
        const solid = tx < map.width && !this.isFloor(tx, ty);
        if (solid && start < 0) start = tx;
        if (!solid && start >= 0) { this.addRect(group, start * T, ty * T, (tx - start) * T, T); start = -1; }
      }
    }
    map.objects.forEach((o) => { if (o.collider) this.addRect(group, o.x - o.collider.w / 2, o.y - o.collider.h, o.collider.w, o.collider.h); });
  }

  addRect(group, x, y, w, h) {
    const z = this.scene.add.zone(x + w / 2, y + h / 2, w, h);
    this.scene.physics.add.existing(z, true);
    group.add(z);
  }

  /** Sprites dos objetos, ordenados por profundidade (y da base). */
  buildObjects() {
    return this.map.objects.map((o) => {
      const key = ensureTexture(this.scene, o.type);
      const s = this.scene.add.image(o.x, o.y, key).setOrigin(0.5, 1).setScale(1 / RES);
      s.setDepth(o.wall ? 1 : o.y);
      return { def: o, sprite: s };
    });
  }
}
