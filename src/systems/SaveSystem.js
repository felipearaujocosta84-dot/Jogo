// =============================================================
// EXTREME RACING — SaveSystem
// Persistência local (localStorage) de configurações, garagem,
// recordes e progresso do campeonato. Tolera ausência de storage.
// =============================================================

const KEY = 'extreme-racing-save-v1';

export const DEFAULT_SETTINGS = {
  graphics: 'auto', // auto | low | medium | high | ultra
  steering: 'wheel', // wheel (volante virtual) | tilt (inclinação) | buttons (setas)
  steeringSensitivity: 1.0,
  tiltSensitivity: 1.0,
  tiltInvert: false,
  transmission: 'auto', // auto | manual
  abs: true,
  tc: true,
  stability: true,
  cameraDistance: 1.0,
  cameraShake: true,
  startCamera: 'chase', // chase | cockpit
  difficulty: 'medium',
  laps: 3,
  opponents: 3,
  dayNight: 'track', // track (horário da pista) | dynamic (ciclo acelerado) | day | sunset | night
  weather: 'clear', // clear | rain | random
  masterVolume: 0.8,
  engineVolume: 0.9,
  effectsVolume: 0.8,
  ambienceVolume: 0.6,
  showFps: false,
  adaptiveResolution: true,
};

const DEFAULT_DATA = () => ({
  version: 1,
  settings: { ...DEFAULT_SETTINGS },
  garage: {
    credits: 25000,
    selectedCar: 'vortex',
    owned: ['vortex'],
    cars: {},
  },
  records: {},
  championship: null,
  stats: { races: 0, wins: 0, podiums: 0, distanceKm: 0 },
});

export class SaveSystem {
  constructor() {
    this.available = this._test();
    this.data = this._load();
  }

  _test() {
    try {
      const k = '__er_test__';
      window.localStorage.setItem(k, '1');
      window.localStorage.removeItem(k);
      return true;
    } catch {
      return false;
    }
  }

  _load() {
    const base = DEFAULT_DATA();
    if (!this.available) return base;
    try {
      const raw = window.localStorage.getItem(KEY);
      if (!raw) return base;
      const parsed = JSON.parse(raw);
      return {
        ...base,
        ...parsed,
        settings: { ...base.settings, ...(parsed.settings || {}) },
        garage: { ...base.garage, ...(parsed.garage || {}) },
        stats: { ...base.stats, ...(parsed.stats || {}) },
      };
    } catch (e) {
      console.warn('[Save] dados corrompidos, usando padrão', e);
      return base;
    }
  }

  save() {
    if (!this.available) return false;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(this.data));
      return true;
    } catch (e) {
      console.warn('[Save] falha ao salvar', e);
      return false;
    }
  }

  get settings() { return this.data.settings; }

  setSetting(key, value) {
    this.data.settings[key] = value;
    this.save();
  }

  getRecord(trackId, carId) {
    return this.data.records?.[trackId]?.[carId] ?? null;
  }

  getTrackRecord(trackId) {
    const rec = this.data.records?.[trackId];
    if (!rec) return null;
    let best = null;
    for (const [carId, t] of Object.entries(rec)) if (best == null || t < best.time) best = { carId, time: t };
    return best;
  }

  /** Registra volta; retorna true se for novo recorde. */
  submitLap(trackId, carId, time) {
    this.data.records[trackId] ||= {};
    const prev = this.data.records[trackId][carId];
    if (prev == null || time < prev) {
      this.data.records[trackId][carId] = time;
      this.save();
      return true;
    }
    return false;
  }

  resetAll() {
    this.data = DEFAULT_DATA();
    this.save();
  }
}
