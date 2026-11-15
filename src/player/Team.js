// Equipe: 1 goleiro + 2 jogadores de linha, uniformes, posições de saída e formação.
import { FIELD } from '../config.js';
import { Player } from './Player.js';

const SKINS = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#5c3a1e', '#ffdbac'];
const HAIRS = ['#14100c', '#3b2414', '#6b4423', '#d9b36c', '#1d1d1d'];
const STYLES = ['short', 'short', 'afro', 'bald', 'short'];

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
  return '#' + [c(n >> 16), c((n >> 8) & 255), c(n & 255)].map((v) => v.toString(16).padStart(2, '0')).join('');
}

export class Team {
  /**
   * @param {'home'|'away'} id
   * @param {object} def { name, short, color, shorts, keeperColor, attacksPositiveX }
   */
  constructor(id, def, seed = 1) {
    this.id = id;
    this.def = def;
    this.name = def.name;
    this.color = def.color;
    this.attackDir = def.attacksPositiveX ? 1 : -1; // direção (em X) do gol adversário
    this.players = [];
    this.opponent = null;
    this.seed = seed;
  }

  get ownGoalX() {
    return -this.attackDir * FIELD.length / 2;
  }

  get targetGoalX() {
    return this.attackDir * FIELD.length / 2;
  }

  get keeper() {
    return this.players.find((p) => p.isKeeper);
  }

  get fieldPlayers() {
    return this.players.filter((p) => !p.isKeeper);
  }

  makeLook(i, keeper) {
    const r = (k) => {
      const x = Math.sin((this.seed * 31 + i * 17 + k * 7) * 12.9898) * 43758.5453;
      return x - Math.floor(x);
    };
    const jersey = keeper ? this.def.keeperColor : this.def.color;
    return {
      jersey,
      jerseyDark: shade(jersey, 0.6),
      shorts: keeper ? '#1a1a1a' : this.def.shorts,
      socks: keeper ? shade(jersey, 0.8) : this.def.socks || this.def.color,
      boots: ['#111111', '#f2f2f2', '#ff7b00', '#3df2ff'][Math.floor(r(1) * 4)],
      skin: SKINS[Math.floor(r(2) * SKINS.length)],
      hair: HAIRS[Math.floor(r(3) * HAIRS.length)],
      hairStyle: STYLES[Math.floor(r(4) * STYLES.length)],
      gloves: keeper ? '#f2f2f2' : null,
      height: 0.95 + r(5) * 0.1,
      build: 0.95 + r(6) * 0.15,
      number: keeper ? 1 : i + 6
    };
  }

  async createPlayers(scene, shadowGenerator, names = []) {
    const roles = ['gk', 'field', 'field'];
    for (let i = 0; i < 3; i++) {
      const p = new Player(this, roles[i], i, this.makeLook(i, roles[i] === 'gk'), names[i] || `${this.def.short} ${i + 1}`);
      await p.createVisual(scene, shadowGenerator);
      this.players.push(p);
    }
    return this.players;
  }

  /**
   * Posições de saída de bola. kickingOff = este time dá a saída (fica perto da bola).
   */
  kickoffPositions(kickingOff) {
    const d = this.attackDir;
    const own = this.ownGoalX;
    return [
      { x: own + d * 0.8, z: 0 },
      { x: kickingOff ? -d * 0.6 : -d * 4.5, z: kickingOff ? 0.4 : 2.5 },
      { x: -d * 7.5, z: -3.5 }
    ];
  }

  resetToKickoff(kickingOff) {
    const pos = this.kickoffPositions(kickingOff);
    this.players.forEach((p, i) => {
      p.placeAt(pos[i].x, pos[i].z, d2yaw(this.attackDir));
      if (p.ai) p.ai.reset();
    });
  }
}

function d2yaw(dir) {
  return dir > 0 ? Math.PI / 2 : -Math.PI / 2;
}
