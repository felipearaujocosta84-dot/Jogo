// Estado da partida (tudo o que é salvo). Nenhum sistema guarda progresso fora daqui.
export const SAVE_VERSION = 1;

export function createNewState(protagonist) {
  return {
    version: SAVE_VERSION,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    protagonist, // { name, displayName, pronouns, appearance }
    location: { scene: 'apartment', x: null, y: null, facing: 'down' },
    time: { day: 1, minutes: 9 * 60 + 30 }, // Dia 1, 09:30
    flags: {},
    decisions: [], // registro de escolhas de diálogo
    relationships: {}, // characterId -> { affinity, met, talks }
    inventory: [{ id: 'phone', qty: 1 }, { id: 'apartment_key', qty: 1 }],
    contacts: [],
  };
}

/** Estado vivo da partida atual. */
export const game = {
  state: null,
  set(s) { this.state = s; },
  get p() { return this.state?.protagonist; },
  flag(k) { return this.state?.flags[k]; },
  setFlag(k, v = true) { if (this.state) this.state.flags[k] = v; },
  clockText() {
    const m = this.state?.time.minutes ?? 0;
    return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  },
  period() {
    const h = Math.floor((this.state?.time.minutes ?? 600) / 60) % 24;
    if (h >= 5 && h < 12) return 'manhã';
    if (h >= 12 && h < 18) return 'tarde';
    return 'noite';
  },
  advance(minutes) {
    const t = this.state.time;
    t.minutes += minutes;
    while (t.minutes >= 24 * 60) { t.minutes -= 24 * 60; t.day += 1; }
  },
};
