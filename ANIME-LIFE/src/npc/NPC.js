// Personagem oficial no mapa.
// Versão atual: ILUSTRAÇÃO ORIGINAL ESTÁTICA (world.webp, recortada da referência) com
// respiração sutil e sombra. Quando houver spritesheet fiel à referência (registrada em
// characters.json → "spriteSheet"), ela é usada no lugar, com animações reais.
import { Characters } from '../characters/CharacterRegistry.js';
import { characterAsset } from '../core/assets.js';

export const NPC_HEIGHT = 64; // altura no mundo (px) — próxima do protagonista

export class NPC {
  constructor(scene, def) {
    this.scene = scene; this.def = def; this.id = def.characterId;
    const key = `npc_${this.id}`;
    const sheet = Characters.spriteSheet(this.id);
    this.shadow = scene.add.ellipse(def.x, def.y, 26, 9, 0x2a1a30, 0.3).setDepth(def.y - 0.5);
    if (sheet && scene.textures.exists(`${key}_sheet`)) {
      // spritesheet animada (mesmo layout do protagonista: linhas baixo/esq/dir/cima, colunas parado×2 + andar×4)
      this.sprite = scene.add.sprite(def.x, def.y, `${key}_sheet`, 0).setOrigin(0.5, 1);
      ['down', 'left', 'right', 'up'].forEach((d, row) => {
        const k = `${key}-idle-${d}`;
        if (!scene.anims.exists(k)) scene.anims.create({ key: k, frames: scene.anims.generateFrameNumbers(`${key}_sheet`, { frames: [row * 6, row * 6 + 1] }), frameRate: 1.6, repeat: -1 });
        const w = `${key}-walk-${d}`;
        if (!scene.anims.exists(w)) scene.anims.create({ key: w, frames: scene.anims.generateFrameNumbers(`${key}_sheet`, { start: row * 6 + 2, end: row * 6 + 5 }), frameRate: 8, repeat: -1 });
      });
      this.sprite.play(`${key}-idle-${def.facing || 'down'}`);
      this.sprite.setScale(NPC_HEIGHT / this.sprite.height).setDepth(def.y);
      this.animated = true;
    } else {
      // ilustração original estática + respiração sutil (não finge uma caminhada que não existe)
      this.sprite = scene.add.image(def.x, def.y, key).setOrigin(0.5, 1);
      const scale = NPC_HEIGHT / this.sprite.height;
      this.sprite.setScale(scale).setDepth(def.y);
      scene.tweens.add({ targets: this.sprite, scaleY: scale * 1.012, duration: 1700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      this.animated = false;
    }
    // nome flutuante
    this.label = scene.add.text(def.x, def.y - NPC_HEIGHT - 6, Characters.name(this.id), {
      fontFamily: '"M PLUS Rounded 1c", sans-serif', fontSize: '20px', color: '#ffffff', stroke: '#3a2d3f', strokeThickness: 5,
    }).setOrigin(0.5, 1).setScale(0.5).setDepth(10000).setAlpha(0);
    this.body = scene.add.zone(def.x, def.y - 6, 26, 12);
    scene.physics.add.existing(this.body, true);
  }

  static preload(scene, def) {
    const key = `npc_${def.characterId}`;
    const sheet = Characters.spriteSheet(def.characterId);
    if (sheet && !scene.textures.exists(`${key}_sheet`)) {
      scene.load.spritesheet(`${key}_sheet`, characterAsset(def.characterId, sheet.file), { frameWidth: sheet.frameWidth, frameHeight: sheet.frameHeight });
    } else if (!sheet && !scene.textures.exists(key)) scene.load.image(key, Characters.worldImage(def.characterId));
  }

  get x() { return this.def.x; }
  get y() { return this.def.y; }

  setHighlight(on) {
    this.scene.tweens.add({ targets: this.label, alpha: on ? 1 : 0, duration: 160 });
  }
}
