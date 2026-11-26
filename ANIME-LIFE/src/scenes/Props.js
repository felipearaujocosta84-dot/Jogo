// Objetos de cena desenhados por código (nada de arte nova dos personagens):
// carta, bilhete, álbum, foto, cartão de visita, cachecol, passagem, caixa, chave, celular, caneca, cartão-postal.
// Aparecem em "plano de detalhe" no centro da tela ou perto do personagem que segura (by).
import { PROPS } from './propList.js';

const W = 360, H = 260;
const paper = 0xf7f0e2, ink = 0x5a4a6a, line = 0xc9bca6;

function draw(g, name) {
  const rr = (x, y, w, h, r, c, a = 1) => g.fillStyle(c, a).fillRoundedRect(x, y, w, h, r);
  const lines = (x, y, w, n, gap = 16, c = line) => { for (let i = 0; i < n; i++) g.fillStyle(c, 1).fillRect(x, y + i * gap, w * (0.75 + ((i * 37) % 25) / 100), 3); };
  g.fillStyle(0x000000, 0.25).fillEllipse(W / 2, H - 18, W * 0.75, 26); // sombra
  switch (name) {
    case 'carta':
      rr(60, 50, 240, 170, 8, 0xe9dcc3); g.fillStyle(0xd8c7a6).fillTriangle(60, 52, 300, 52, 180, 140);
      rr(80, 20, 200, 120, 4, paper); lines(96, 40, 160, 5); g.fillStyle(0xc0392b).fillCircle(180, 140, 14); break;
    case 'bilhete': case 'postal':
      rr(70, 40, 220, 170, 6, name === 'postal' ? 0xdbe9f7 : paper);
      if (name === 'postal') { rr(84, 54, 110, 80, 4, 0x7fb3d5); g.fillStyle(0xf4d03f).fillCircle(170, 74, 10); g.fillStyle(0x2e86c1).fillRect(84, 112, 110, 22); rr(236, 52, 40, 48, 2, 0xe74c3c); lines(206, 120, 70, 4, 14); }
      else { g.fillStyle(0xe7dcc6).fillRect(70, 120, 220, 3); lines(88, 60, 180, 7, 18, 0x8d7ba8); }
      break;
    case 'album':
      rr(70, 30, 220, 190, 10, 0x8e3b46); rr(80, 40, 200, 170, 8, 0xa04a56); rr(120, 70, 120, 90, 4, paper); rr(130, 80, 100, 70, 2, 0xb7d3e8);
      g.fillStyle(0xffffff, 0.6).fillCircle(180, 105, 16); break;
    case 'foto':
      rr(90, 30, 180, 200, 4, 0xffffff); rr(104, 44, 152, 140, 2, 0x9cc3e0); g.fillStyle(0x6b8f71).fillRect(104, 150, 152, 34);
      g.fillStyle(0x3d3049).fillCircle(150, 120, 18).fillCircle(205, 118, 18); break;
    case 'cartao':
      rr(60, 70, 240, 130, 6, 0xffffff); g.fillStyle(0x2c3e50).fillRect(80, 96, 120, 10); lines(80, 150, 140, 2, 18, 0x95a5a6); g.fillStyle(0x2c3e50).fillRect(80, 118, 70, 5); break;
    case 'cachecol':
      for (let i = 0; i < 6; i++) rr(60 + i * 38, 70 + Math.sin(i) * 20, 44, 110, 14, i % 2 ? 0xc0392b : 0xa93226);
      for (let i = 0; i < 8; i++) g.fillStyle(0xa93226).fillRect(270 + (i % 4) * 6, 180 + Math.floor(i / 4) * 12, 3, 30); break;
    case 'passagem':
      rr(50, 80, 260, 110, 8, 0xf9e79f); g.fillStyle(0xe67e22).fillRect(50, 80, 260, 26); g.fillStyle(ink).fillRect(70, 130, 90, 8).fillRect(200, 130, 80, 8);
      for (let i = 0; i < 6; i++) g.fillStyle(0xffffff).fillCircle(230, 92 + i * 18, 3); break;
    case 'caixa':
      rr(80, 70, 200, 150, 6, 0xc49a6c); g.fillStyle(0xa77b4f).fillRect(80, 70, 200, 30); g.fillStyle(0xe8d2a6).fillRect(170, 70, 20, 150); break;
    case 'chave':
      g.lineStyle(14, 0xd4ac0d).strokeCircle(130, 120, 36); g.fillStyle(0xd4ac0d).fillRect(160, 112, 140, 16).fillRect(260, 128, 14, 26).fillRect(284, 128, 14, 18); break;
    case 'celular':
      rr(120, 20, 120, 220, 18, 0x1c1a24); rr(128, 34, 104, 190, 10, 0x3a3d6b); rr(140, 60, 80, 22, 8, 0xffffff); rr(150, 96, 70, 22, 8, 0xff8fb8); break;
    case 'camera':
      rr(70, 70, 220, 130, 14, 0x2b2b2b); rr(70, 70, 220, 30, 10, 0x9a9a9a); g.fillStyle(0x111111).fillCircle(180, 140, 50); g.fillStyle(0x3a4a6a).fillCircle(180, 140, 34);
      g.fillStyle(0xffffff, 0.5).fillCircle(168, 128, 9); rr(230, 52, 40, 22, 4, 0x555555); g.fillStyle(0xc0392b).fillCircle(102, 86, 6); break;
    case 'envelope_fotos':
      rr(70, 60, 220, 150, 6, 0xf2e3c6); rr(90, 40, 120, 90, 3, 0xffffff); rr(98, 48, 104, 70, 2, 0xc8a27a); rr(150, 30, 120, 90, 3, 0xffffff); rr(158, 38, 104, 70, 2, 0x7fa7c8);
      g.fillStyle(0xd35400).fillRect(70, 170, 220, 14); break;
    case 'caneca':
      rr(120, 80, 110, 130, 12, 0xfdfefe); g.lineStyle(14, 0xfdfefe).strokeCircle(240, 140, 26); g.fillStyle(0x6e4b3a).fillEllipse(175, 88, 96, 18); break;
  }
}

export class Props {
  constructor(scene) { this.scene = scene; this.cur = null; }
  texture(name) {
    const key = `prop_${name}`;
    if (!this.scene.textures.exists(key)) { const g = this.scene.make.graphics({ x: 0, y: 0 }, false); draw(g, name); g.generateTexture(key, W, H); g.destroy(); }
    return key;
  }
  /** Mostra um objeto. by: personagem que segura (junto ao peito, acompanha o personagem);
   *  sem by: plano de detalhe no centro da tela, numa camada própria (não muda com o zoom da câmera). */
  show(name, { by = null, instant = false } = {}) {
    const sc = this.scene;
    this.hide(true);
    if (!name || !PROPS.includes(name)) return;
    const key = this.texture(name);
    const holder = by && sc.chars.get(by);
    this.name = name;
    if (holder) {
      const x = holder.img.x + (holder.at === 'left' ? 1 : -1) * holder.img.displayWidth * 0.12;
      const y = holder.img.y + holder.img.displayHeight * 0.5;
      const s = (holder.img.displayHeight * 0.16) / H;
      const img = sc.add.image(x, y, key).setDepth(13).setAngle(-8);
      this.cur = img;
      if (instant || sc.instant) { img.setScale(s); return; }
      img.setScale(s * 0.6).setAlpha(0).setY(y + 20);
      sc.tweens.add({ targets: img, scale: s, alpha: 1, y, angle: -4, duration: 420, ease: 'Back.easeOut' });
      return;
    }
    // plano de detalhe
    const host = document.getElementById('ui-root') || document.body;
    const el = document.createElement('div');
    el.className = 'prop-insert';
    el.dataset.prop = name;
    const img = document.createElement('img');
    img.alt = name; img.src = sc.textures.getBase64(key);
    el.appendChild(img);
    host.insertBefore(el, host.firstChild);
    this.cur = el;
    this.prevDim = sc.veil?.alpha || 0;
    sc.dim?.(Math.max(this.prevDim, 0.4), instant || sc.instant ? 0 : 400);
    if (instant || sc.instant) el.classList.add('on'); else requestAnimationFrame(() => el.classList.add('on'));
  }
  hide(instant = false) {
    const cur = this.cur; if (!cur) return;
    this.cur = null; this.name = null;
    if (cur instanceof HTMLElement) {
      this.scene.dim?.(this.prevDim || 0, instant ? 0 : 400);
      if (instant || this.scene.instant) return cur.remove();
      cur.classList.remove('on'); setTimeout(() => cur.remove(), 350);
      return;
    }
    if (instant || this.scene.instant) return cur.destroy();
    this.scene.tweens.add({ targets: cur, alpha: 0, y: cur.y + 20, duration: 300, onComplete: () => cur.destroy() });
  }
}
