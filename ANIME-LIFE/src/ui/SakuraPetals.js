// Pétalas de cerejeira caindo (canvas leve, pausa quando a tela some).
export class SakuraPetals {
  constructor(container, count = 26) {
    this.c = document.createElement('canvas'); this.c.className = 'petals';
    container.appendChild(this.c);
    this.ctx = this.c.getContext('2d'); this.count = count; this.running = false;
    this.resize = () => { const d = Math.min(devicePixelRatio || 1, 2); this.c.width = this.c.clientWidth * d; this.c.height = this.c.clientHeight * d; this.d = d; };
    window.addEventListener('resize', this.resize);
    this.p = Array.from({ length: count }, () => this.spawn(true));
  }
  spawn(any) {
    return { x: Math.random(), y: any ? Math.random() : -0.05, s: 0.5 + Math.random(), r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.04, vx: 0.0004 + Math.random() * 0.0008, vy: 0.0012 + Math.random() * 0.0012, ph: Math.random() * 6 };
  }
  start() { if (this.running) return; this.running = true; this.resize(); const loop = () => { if (!this.running) return; this.draw(); requestAnimationFrame(loop); }; loop(); }
  stop() { this.running = false; }
  draw() {
    const { ctx, c } = this; ctx.clearRect(0, 0, c.width, c.height);
    for (const p of this.p) {
      p.ph += 0.02; p.x += p.vx + Math.sin(p.ph) * 0.0006; p.y += p.vy; p.r += p.vr;
      if (p.y > 1.05 || p.x > 1.05) Object.assign(p, this.spawn(false), { x: Math.random() * 0.8 });
      const s = 7 * p.s * this.d;
      ctx.save(); ctx.translate(p.x * c.width, p.y * c.height); ctx.rotate(p.r); ctx.scale(1, 0.6 + Math.sin(p.ph * 2) * 0.35);
      ctx.fillStyle = 'rgba(255,190,214,0.9)';
      ctx.beginPath(); ctx.moveTo(0, -s); ctx.bezierCurveTo(s, -s, s, s * 0.6, 0, s); ctx.bezierCurveTo(-s, s * 0.6, -s, -s, 0, -s); ctx.fill();
      ctx.restore();
    }
  }
}
