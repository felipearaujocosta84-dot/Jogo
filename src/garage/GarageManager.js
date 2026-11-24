// =============================================================
// EXTREME RACING — GarageManager
// Carros possuídos, compra, melhorias (motor, freios, câmbio,
// suspensão, aerofólio, pneus), pintura, acabamento, aros e
// créditos ganhos nas corridas.
// =============================================================
import { CARS, getCar, applyUpgrades, UPGRADES, SETUP_DEFAULT } from '../vehicles/VehicleCatalog.js';
import { Engine } from '../vehicles/Engine.js';

export const PAINT_COLORS = [
  '#c8102e', '#e85d04', '#f2b705', '#2d6a4f', '#1d4ed8', '#0ea5e9', '#7c3aed',
  '#111111', '#4b5563', '#e5e7eb', '#ffffff', '#9a3412', '#be185d', '#14532d',
];
export const RIM_COLORS = ['#2b2b2b', '#111111', '#c0c0c0', '#d4af37', '#9ca3af', '#b91c1c', '#1d4ed8'];
export const RIM_STYLES = ['5 raios', '10 raios', 'Malha'];
export const FINISHES = { metallic: 'Metálico', matte: 'Fosco' };

export class GarageManager {
  constructor(save) {
    this.save = save;
    this.data = save.data.garage;
    for (const c of CARS) this._ensure(c.id);
  }

  _ensure(id) {
    const base = getCar(id);
    this.data.cars[id] ||= {
      upgrades: { engine: 0, brakes: 0, transmission: 0, suspension: 0, aero: 0, tires: 0 },
      setup: { ...SETUP_DEFAULT },
      paint: base.colors.paint,
      rim: base.colors.rim,
      rimStyle: 0,
      finish: 'metallic',
    };
    this.data.cars[id].setup ||= { ...SETUP_DEFAULT }; // saves antigos
    return this.data.cars[id];
  }

  get credits() { return this.data.credits; }
  get selectedId() { return this.data.selectedCar; }
  isOwned(id) { return this.data.owned.includes(id); }
  config(id = this.selectedId) { return this._ensure(id); }

  select(id) {
    if (!this.isOwned(id)) return false;
    this.data.selectedCar = id;
    this.save.save();
    return true;
  }

  buy(id) {
    const car = getCar(id);
    if (this.isOwned(id)) return { ok: false, reason: 'Você já possui este carro.' };
    if (this.data.credits < car.price) return { ok: false, reason: 'Créditos insuficientes.' };
    this.data.credits -= car.price;
    this.data.owned.push(id);
    this.data.selectedCar = id;
    this.save.save();
    this.onChange?.();
    return { ok: true };
  }

  upgradeCost(id, key) {
    const lvl = this.config(id).upgrades[key];
    return lvl >= 3 ? null : UPGRADES[key].costs[lvl];
  }

  buyUpgrade(id, key) {
    const cfg = this.config(id);
    const cost = this.upgradeCost(id, key);
    if (cost == null) return { ok: false, reason: 'Nível máximo.' };
    if (!this.isOwned(id)) return { ok: false, reason: 'Compre o carro primeiro.' };
    if (this.data.credits < cost) return { ok: false, reason: 'Créditos insuficientes.' };
    this.data.credits -= cost;
    cfg.upgrades[key]++;
    this.save.save();
    this.onChange?.();
    return { ok: true };
  }

  setPaint(id, color) { this.config(id).paint = color; this.save.save(); }
  setFinish(id, finish) { this.config(id).finish = finish; this.save.save(); }
  setRim(id, color) { this.config(id).rim = color; this.save.save(); }
  setRimStyle(id, style) { this.config(id).rimStyle = style; this.save.save(); }

  addCredits(n) {
    this.data.credits += Math.max(0, Math.round(n));
    this.save.save();
  }

  /** Especificação física final do carro (com melhorias). */
  spec(id = this.selectedId) {
    return applyUpgrades(getCar(id), this.config(id).upgrades, this.config(id).setup);
  }

  setSetup(id, key, value) { this.config(id).setup[key] = value; this.save.save(); }
  resetSetup(id) { this.config(id).setup = { ...SETUP_DEFAULT }; this.save.save(); }

  /** Aparência do carro (para o modelo 3D). */
  look(id = this.selectedId) {
    const c = this.config(id);
    return { colors: { paint: c.paint, rim: c.rim }, finish: c.finish, rimStyle: c.rimStyle };
  }

  /** Números exibidos na garagem. */
  stats(id = this.selectedId) {
    const spec = this.spec(id);
    const eng = new Engine(spec.engine);
    const kw = eng.peakPowerKW();
    return {
      powerCv: Math.round(kw * 1.36),
      torque: Math.round(Math.max(...spec.engine.torqueCurve.map((p) => p[1])) * (spec.engine.torqueMultiplier ?? 1)),
      mass: spec.mass,
      drive: spec.drive,
      gears: spec.transmission.ratios.length,
      powerToWeight: (kw * 1.36) / (spec.mass / 1000),
      grip: spec.tireGrip,
      downforce: spec.aero.clA,
    };
  }

  static get cars() { return CARS; }
}
