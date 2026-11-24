// =============================================================
// EXTREME RACING — Achievements (conquistas)
// Definições, progresso salvo e recompensas em créditos.
// Lógica pura: a corrida e a garagem informam os eventos.
// =============================================================

export const ACHIEVEMENTS = [
  { id: 'first_race', title: 'Primeira largada', desc: 'Termine uma corrida.', reward: 1000 },
  { id: 'first_win', title: 'Primeira vitória', desc: 'Vença uma corrida contra a IA.', reward: 3000 },
  { id: 'podium5', title: 'Frequentador do pódio', desc: 'Termine entre os 3 primeiros 5 vezes.', reward: 5000, goal: 5 },
  { id: 'all_tracks', title: 'Rei das pistas', desc: 'Vença nas 4 pistas.', reward: 15000, goal: 4 },
  { id: 'expert_win', title: 'Lenda', desc: 'Vença uma corrida no nível Expert.', reward: 10000 },
  { id: 'storm_win', title: 'Herói da tempestade', desc: 'Vença com chuva ou tempestade de areia.', reward: 5000 },
  { id: 'champion', title: 'Campeão', desc: 'Vença um campeonato.', reward: 20000 },
  { id: 'speed300', title: 'Barreira dos 300', desc: 'Atinja 300 km/h.', reward: 4000 },
  { id: 'drift', title: 'Mestre do drift', desc: 'Derrape acima de 25° por 2,5 s seguidos (acima de 50 km/h).', reward: 4000 },
  { id: 'clean_lap', title: 'Volta limpa', desc: 'Complete uma volta sem bater em nada.', reward: 3000 },
  { id: 'ghost_beat', title: 'Mais rápido que você', desc: 'Vença o seu fantasma no Contra o Relógio.', reward: 3000 },
  { id: 'collector', title: 'Colecionador', desc: 'Tenha 3 carros na garagem.', reward: 5000, goal: 3 },
  { id: 'maxed', title: 'Preparação total', desc: 'Leve todas as melhorias de um carro ao nível 3.', reward: 8000 },
  { id: 'km500', title: 'Estradeiro', desc: 'Rode 500 km no total.', reward: 6000, goal: 500 },
];

export class Achievements {
  /**
   * @param {object} data save.data (usa data.achievements e data.stats)
   * @param {function} onUnlock (achievement) => void
   */
  constructor(data, onUnlock = () => {}) {
    this.data = data;
    data.achievements ||= { unlocked: {}, wonTracks: [] };
    this.state = data.achievements;
    this.onUnlock = onUnlock;
    this._drift = 0;
  }

  isUnlocked(id) { return !!this.state.unlocked[id]; }
  get count() { return Object.keys(this.state.unlocked).length; }
  get total() { return ACHIEVEMENTS.length; }

  unlock(id) {
    if (this.isUnlocked(id)) return false;
    const a = ACHIEVEMENTS.find((x) => x.id === id);
    if (!a) return false;
    this.state.unlocked[id] = Date.now();
    this.onUnlock(a);
    return true;
  }

  /** Progresso (para a tela de conquistas). */
  progress(id) {
    const st = this.data.stats || {};
    switch (id) {
      case 'podium5': return Math.min(5, st.podiums || 0);
      case 'all_tracks': return this.state.wonTracks.length;
      case 'km500': return Math.min(500, Math.floor(st.distanceKm || 0));
      case 'collector': return Math.min(3, this.data.garage?.owned?.length || 0);
      default: return this.isUnlocked(id) ? 1 : 0;
    }
  }

  /** Telemetria a cada passo da corrida (velocidade e drift). */
  tick(dt, tel) {
    if (tel.speedKmh >= 300) this.unlock('speed300');
    const drifting = tel.speedKmh > 50 && Math.abs(tel.drift) > (25 * Math.PI) / 180;
    this._drift = drifting ? this._drift + dt : 0;
    if (this._drift >= 2.5) this.unlock('drift');
  }

  lap({ clean }) {
    if (clean) this.unlock('clean_lap');
  }

  /**
   * Fim de corrida.
   * @param {object} r { position, ai, difficulty, trackId, stormy }
   */
  raceFinished(r) {
    this.unlock('first_race');
    const st = this.data.stats || {};
    if (r.ai && r.position === 1) {
      this.unlock('first_win');
      if (r.difficulty === 'expert') this.unlock('expert_win');
      if (r.stormy) this.unlock('storm_win');
      if (!this.state.wonTracks.includes(r.trackId)) this.state.wonTracks.push(r.trackId);
      if (this.state.wonTracks.length >= 4) this.unlock('all_tracks');
    }
    if ((st.podiums || 0) >= 5) this.unlock('podium5');
    if ((st.distanceKm || 0) >= 500) this.unlock('km500');
  }

  championshipWon() { this.unlock('champion'); }
  ghostBeaten() { this.unlock('ghost_beat'); }

  /** Garagem: carros possuídos e melhorias. */
  garageChanged(garage) {
    if ((garage.owned?.length || 0) >= 3) this.unlock('collector');
    for (const c of Object.values(garage.cars || {})) {
      const u = c.upgrades || {};
      if (Object.keys(u).length >= 6 && Object.values(u).every((v) => v >= 3)) this.unlock('maxed');
    }
  }
}
