// Radar circular no canto da tela: o mapa é desenhado uma vez num canvas fora da tela
// e a cada quadro só giramos/deslocamos essa imagem em torno do jogador.
import type { MapInstance } from '../maps/MapBuilder';

const PX_PER_M = 3; // resolução da imagem pré-desenhada

export class Radar {
  private ctx: CanvasRenderingContext2D;
  private mapImg: HTMLCanvasElement;
  private size = 0;
  /** Metros visíveis do centro até a borda. */
  range = 34;

  constructor(private canvas: HTMLCanvasElement, private map: MapInstance) {
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
    // Células da grade: piso claro, prédios escuros
    const def = this.map.def;
    for (let r = 0; r < def.grid.length; r++)
      for (let col = 0; col < def.grid[r].length; col++) {
        const kind = def.legend[def.grid[r][col]];
        if (!kind || kind.type === 'solid') continue;
        g.fillStyle = kind.type === 'roofed' ? '#5d5a52' : '#8c8270';
        g.fillRect(col * def.cell * PX_PER_M, r * def.cell * PX_PER_M, def.cell * PX_PER_M + 0.5, def.cell * PX_PER_M + 0.5);
      }
    // Obstáculos (caixas, plataformas)
    g.fillStyle = 'rgba(40,36,30,0.85)';
    for (const b of def.boxes) {
      if (b.collide === false || b.min[1] > 2.5) continue;
      g.fillRect((b.min[0] - minX) * PX_PER_M, (maxZ - b.max[2]) * PX_PER_M, (b.max[0] - b.min[0]) * PX_PER_M, (b.max[2] - b.min[2]) * PX_PER_M);
    }
    // Locais de bomba
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

  resize(): void {
    const css = this.canvas.clientWidth;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const px = Math.max(1, Math.round(css * dpr));
    if (px !== this.size) {
      this.size = px;
      this.canvas.width = px;
      this.canvas.height = px;
    }
  }

  draw(x: number, z: number, yaw: number): void {
    this.resize();
    const g = this.ctx, s = this.size;
    if (!s) return;
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
    g.rotate(-yaw); // frente do jogador sempre para cima
    g.scale(scale, scale);
    g.translate(-(x - minX) * PX_PER_M, -(maxZ - z) * PX_PER_M);
    g.drawImage(this.mapImg, 0, 0);
    g.restore();
    // jogador
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
