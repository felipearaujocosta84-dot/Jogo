// Protagonista no mapa: física arcade (corpo nos pés), 4 direções, animação parado/caminhada.
import Phaser from 'phaser';
import { buildSheetCanvas, FRAME_W, FRAME_H, DIRS, FRAMES_PER_DIR } from '../characters/ProtagonistArt.js';
import { audio } from '../audio/AudioManager.js';

const RES = 2;
export const PLAYER_SPEED = 118; // px/s

export function createProtagonistTexture(scene, appearance) {
  const key = 'protagonist';
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const canvas = buildSheetCanvas(appearance, RES);
  scene.textures.addSpriteSheet(key, canvas, { frameWidth: FRAME_W * RES, frameHeight: FRAME_H * RES });
  DIRS.forEach((d, row) => {
    const base = row * FRAMES_PER_DIR;
    for (const k of [`idle-${d}`, `walk-${d}`]) if (scene.anims.exists(k)) scene.anims.remove(k);
    scene.anims.create({ key: `idle-${d}`, frames: scene.anims.generateFrameNumbers(key, { frames: [base, base + 1] }), frameRate: 1.6, repeat: -1 });
    scene.anims.create({ key: `walk-${d}`, frames: scene.anims.generateFrameNumbers(key, { start: base + 2, end: base + 5 }), frameRate: 8, repeat: -1 });
  });
  return key;
}

export class Player {
  constructor(scene, x, y, facing = 'down') {
    this.scene = scene;
    this.shadow = scene.add.ellipse(x, y, 22, 8, 0x2a1a30, 0.28);
    this.sprite = scene.physics.add.sprite(x, y, 'protagonist', 0).setOrigin(0.5, 1);
    // tamanho final ≈ 60px de altura no mundo
    this.sprite.setScale(60 / (FRAME_H * RES));
    const sc = this.sprite.scaleX;
    // corpo de colisão: só os pés (permite a cabeça "passar na frente" das paredes, visão 3/4)
    this.sprite.body.setSize(18 / sc, 9 / sc);
    this.sprite.body.setOffset((FRAME_W * RES - 18 / sc) / 2, FRAME_H * RES - 9 / sc - 1 / sc);
    this.sprite.setCollideWorldBounds(true);
    this.facing = facing;
    this.stepTimer = 0;
    this.sprite.play(`idle-${facing}`);
  }

  get x() { return this.sprite.x; }
  get y() { return this.sprite.y; }

  update(vec, dt) {
    const body = this.sprite.body;
    const mag = Math.hypot(vec.x, vec.y);
    if (mag > 0.05) {
      body.setVelocity(vec.x * PLAYER_SPEED, vec.y * PLAYER_SPEED);
      // direção do sprite: eixo dominante
      this.facing = Math.abs(vec.x) > Math.abs(vec.y) ? (vec.x < 0 ? 'left' : 'right') : (vec.y < 0 ? 'up' : 'down');
      const moving = body.blocked.none || Math.hypot(body.deltaX(), body.deltaY()) > 0.2;
      const anim = moving ? `walk-${this.facing}` : `idle-${this.facing}`;
      if (this.sprite.anims.currentAnim?.key !== anim) this.sprite.play(anim, true);
      this.sprite.anims.timeScale = 0.6 + mag * 0.6;
      this.stepTimer -= dt;
      if (moving && this.stepTimer <= 0) { audio.sfx('step'); this.stepTimer = 0.34 / (0.6 + mag * 0.6); }
    } else {
      body.setVelocity(0, 0);
      this.idle();
    }
    this.sprite.setDepth(this.sprite.y);
    this.shadow.setPosition(this.sprite.x, this.sprite.y - 1).setDepth(this.sprite.y - 0.5);
  }

  idle() {
    const k = `idle-${this.facing}`;
    if (this.sprite.anims.currentAnim?.key !== k) { this.sprite.anims.timeScale = 1; this.sprite.play(k, true); }
  }

  face(dir) { this.facing = dir; this.idle(); }

  stop() { this.sprite.body.setVelocity(0, 0); this.idle(); }
}
