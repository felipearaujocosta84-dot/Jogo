// Salvamento local (localStorage). Funciona no navegador e dentro de um APK (WebView/Capacitor).
import { SAVE_KEY, GAME_VERSION } from '../config.js';

export class SaveSystem {
  constructor(game) {
    this.game = game;
    this.autoTimer = 0;
  }

  has() {
    try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; }
  }

  read() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  save(silent = false) {
    const g = this.game;
    const p = g.player;
    if (!p || p.dead) return false;
    const data = {
      version: GAME_VERSION,
      savedAt: Date.now(),
      playTime: g.playTime,
      dayTime: g.dayTime,
      player: {
        x: p.position.x, z: p.position.z, yaw: p.yaw,
        level: p.level, xp: p.xp, hp: p.hp, maxHp: p.maxHp,
        maxStamina: p.maxStamina, baseAttack: p.baseAttack
      },
      inventory: g.inventory.serialize(),
      quests: g.quests.serialize(),
      world: g.interaction.serialize()
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      if (!silent) g.hud.toast('Jogo salvo');
      return true;
    } catch (e) {
      if (!silent) g.hud.toast('Não foi possível salvar');
      return false;
    }
  }

  /** Aplica um save no jogo. */
  apply(data) {
    const g = this.game;
    const p = g.player;
    const d = data.player;
    p.level = d.level; p.xp = d.xp; p.maxHp = d.maxHp; p.hp = Math.max(1, d.hp);
    p.maxStamina = d.maxStamina; p.stamina = p.maxStamina; p.baseAttack = d.baseAttack;
    g.playTime = data.playTime || 0;
    g.dayTime = data.dayTime ?? 0.3;
    g.inventory.deserialize(data.inventory);
    g.quests.deserialize(data.quests);
    g.interaction.deserialize(data.world);
    p.teleport(d.x, d.z, d.yaw);
  }

  clear() {
    try { localStorage.removeItem(SAVE_KEY); } catch { /* sem armazenamento */ }
  }

  update(dt) {
    this.autoTimer += dt;
    if (this.autoTimer > 45) {
      this.autoTimer = 0;
      this.save(true);
    }
  }
}
