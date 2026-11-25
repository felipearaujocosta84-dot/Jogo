// Detecta o alvo de interação mais próximo (objeto ou personagem) e mostra o indicador.
export class InteractionSystem {
  constructor(scene) {
    this.scene = scene;
    this.targets = [];
    this.current = null;
    this.marker = scene.add.text(0, 0, '!', {
      fontFamily: '"M PLUS Rounded 1c", sans-serif', fontSize: '36px', fontStyle: 'bold', color: '#ffd84a', stroke: '#3a2d3f', strokeThickness: 7,
    }).setOrigin(0.5, 1).setScale(0.5).setDepth(10001).setVisible(false);
    this.bob = { v: 0 };
    scene.tweens.add({ targets: this.bob, v: -4, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.onChange = null;
  }

  /** alvo: { id, kind:'object'|'npc', x, y, radius, label, icon, markerY, data } */
  add(t) { this.targets.push(t); }

  update(px, py) {
    let best = null, bestD = Infinity;
    for (const t of this.targets) {
      const d = Math.hypot(px - t.x, py - t.y);
      if (d <= t.radius && d < bestD) { best = t; bestD = d; }
    }
    if (best !== this.current) {
      this.current = best;
      this.marker.setVisible(!!best);
      this.onChange?.(best);
    }
    if (best) this.marker.setPosition(best.markerX ?? best.x, best.markerY + this.bob.v);
  }

  clear() { this.current = null; this.marker.setVisible(false); this.onChange?.(null); }
}
