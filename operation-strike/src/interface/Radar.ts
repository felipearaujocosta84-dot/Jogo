// Radar circular: mapa pré-desenhado, girado em torno do jogador. Mostra companheiros, inimigos avistados e a bomba.
import type { MapRuntime } from '../maps/MapRuntime';
import { expandMap } from '../maps/MapLayout';

const PX_PER_M = 3;

export interface RadarDot {
  x: number;
  z: number;
  color: string;
  yaw?: number;
  bomb?: boolean;
  dead?: boolean;
}

export class Radar {
  private ctx: CanvasRenderingContext2D;
  private mapImg: HTMLCanvasElement;
  private size = 0;
  range = 34;

  constructor(private canvas: HTMLCanvasElement, private map: MapRuntime) {
    this.ctx = canvas.getContext('2d')!;
    this.mapImg = this.renderMap();
  }

  private renderMap(): HTMLCanvasElement {
    const { minX, maxX, minZ, maxZ } = this.map.bounds;
    const w = Math.ceil((maxX - minX) * PX_PER_M), h = Math.ceil((maxZ - minZ) * PX_PER_M);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d')!;
    g.fillStyle = 'rgba(20,24,28,0.9)';
    g.fillRect(0, 0, w, h);
    const def = this.map.def;
    if (def.model) {
      // mapa de modelo 3D: varre o chão (caminhável = claro, mais alto = mais claro; obstáculo = escuro)
      const step = 0.5;
      for (let z = minZ; z < maxZ; z += step)
        for (let x = minX; x < maxX; x += step) {
          const gr = this.map.groundAt(x + step / 2, z + step / 2, 0.2);
          if (!gr.free) continue;
          const v = Math.min(200, 120 + gr.y * 18);
          g.fillStyle = `rgb(${v},${v - 8},${v - 22})`;
          g.fillRect((x - minX) * PX_PER_M, (maxZ - z - step) * PX_PER_M, step * PX_PER_M + 0.5, step * PX_PER_M + 0.5);
        }
      return c;
    }
    for (let r = 0; r < def.grid.length; r++)
      for (let col = 0; col < def.grid[r].length; col++) {
        const kind = def.legend[def.grid[r][col]];
        if (!kind || kind.type === 'solid') continue;
        g.fillStyle = kind.type === 'roofed' ? '#5d5a52' : '#8c8270';
        g.fillRect(col * def.cell * PX_PER_M, r * def.cell * PX_PER_M, def.cell * PX_PER_M + 0.5, def.cell * PX_PER_M + 0.5);
      }
    g.fillStyle = 'rgba(40,36,30,0.85)';
    for (const b of expandMap(def).boxes) {
      if (b.collide === false || b.min[1] > 2.5 || b.max[1] - b.min[1] < 0.5) continue;
      g.fillRect((b.min[0] - minX) * PX_PER_M, (maxZ - b.max[2]) * PX_PER_M, (b.max[0] - b.min[0]) * PX_PER_M, (b.max[2] - b.min[2]) * PX_PER_M);
    }
    for (const s of def.sites) {
      const x = (s.min[0] - minX) * PX_PER_M, y = (maxZ - s.max[1]) * PX_PER_M;
      const sw = (s.max[0] - s.min[0]) * PX_PER_M, sh = (s.max[1] - s.min[1]) * PX_PER_M;
      g.fillStyle = 'rgba(220,60,40,0.18)';
      g.fillRect(x, y, sw, sh);
      g.fillStyle = 'rgba(255,90,70,0.95)';
      g.font = `900 ${14 * PX_PER_M}px Arial`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(s.name, x + sw / 2, y + sh / 2);
    }
    return c;
  }

  private resize(): void {
    const css = this.canvas.clientWidth;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const px = Math.max(1, Math.round(css * dpr));
    if (px !== this.size) {
      this.size = px;
      this.canvas.width = px;
      this.canvas.height = px;
    }
  }

  draw(x: number, z: number, yaw: number, dots: RadarDot[]): void {
    this.resize();
    const g = this.ctx, s = this.size;
    if (s < 16) return; // HUD oculto
    const scale = s / 2 / this.range / PX_PER_M;
    const { minX, maxZ } = this.map.bounds;
    g.clearRect(0, 0, s, s);
    g.save();
    g.beginPath();
    g.arc(s / 2, s / 2, s / 2 - 1, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = 'rgba(10,12,14,0.75)';
    g.fillRect(0, 0, s, s);
    g.translate(s / 2, s / 2);
    g.rotate(-yaw);
    g.scale(scale, scale);
    g.translate(-(x - minX) * PX_PER_M, -(maxZ - z) * PX_PER_M);
    g.drawImage(this.mapImg, 0, 0);
    g.restore();
    // pontos (no espaço do radar, com rotação)
    const k = s / 2 / this.range;
    const cos = Math.cos(-yaw), sin = Math.sin(-yaw);
    for (const d of dots) {
      const dx = d.x - x, dz = -(d.z - z);
      let rx = (dx * cos - dz * sin) * k, ry = (dx * sin + dz * cos) * k;
      const r = Math.hypot(rx, ry), lim = s / 2 - 6;
      if (r > lim) {
        rx *= lim / r;
        ry *= lim / r;
      }
      const px = s / 2 + rx, py = s / 2 + ry;
      if (d.bomb) {
        g.fillStyle = d.color;
        g.font = `${Math.round(s * 0.09)}px sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText('✹', px, py);
        continue;
      }
      g.fillStyle = d.dead ? 'rgba(160,160,160,0.6)' : d.color;
      g.beginPath();
      if (d.dead) {
        g.font = `${Math.round(s * 0.07)}px sans-serif`;
        g.textAlign = 'center';
        g.fillText('✕', px, py + 3);
        continue;
      }
      g.arc(px, py, Math.max(2.5, s * 0.025), 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.moveTo(s / 2, s / 2 - s * 0.055);
    g.lineTo(s / 2 + s * 0.035, s / 2 + s * 0.035);
    g.lineTo(s / 2 - s * 0.035, s / 2 + s * 0.035);
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    g.lineWidth = Math.max(1, s * 0.01);
    g.beginPath();
    g.arc(s / 2, s / 2, s / 2 - 1, 0, Math.PI * 2);
    g.stroke();
  }
}
