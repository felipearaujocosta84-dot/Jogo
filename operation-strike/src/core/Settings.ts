// Preferências do jogador (salvas no aparelho).
import { Storage } from '../save/Storage';

export type QualityMode = 'auto' | 'low' | 'medium' | 'high';

export interface SettingsData {
  quality: QualityMode;
  /** Distância de renderização em metros. */
  renderDistance: number;
  /** Campo de visão vertical (graus). */
  fov: number;
  mouseSensitivity: number;
  touchSensitivity: number;
  /** Multiplicador de sensibilidade ao mirar. */
  aimSensitivity: number;
  invertY: boolean;
  showFps: boolean;
  fpsCap: 0 | 30 | 60;
  volume: number;
  buttonOpacity: number;
  /** Agachar: segurar (false) ou alternar (true). No toque, alternar é mais confortável. */
  crouchToggle: boolean;
  crosshairColor: string;
  playerName: string;
  serverUrl: string;
  nameTags: boolean;
}

const DEFAULTS: SettingsData = {
  quality: 'auto',
  renderDistance: 140,
  fov: 72,
  mouseSensitivity: 1,
  touchSensitivity: 1,
  aimSensitivity: 0.6,
  invertY: false,
  showFps: false,
  fpsCap: 60,
  volume: 0.8,
  buttonOpacity: 0.55,
  crouchToggle: true,
  crosshairColor: '#5dff8a',
  playerName: 'Operador' + Math.floor(100 + Math.random() * 900),
  serverUrl: '',
  nameTags: true
};

type Listener = (s: SettingsData) => void;

export class Settings {
  data: SettingsData;
  private listeners: Listener[] = [];

  constructor() {
    this.data = { ...DEFAULTS, ...Storage.load<Partial<SettingsData>>('settings', {}) };
  }

  get<K extends keyof SettingsData>(key: K): SettingsData[K] {
    return this.data[key];
  }

  set<K extends keyof SettingsData>(key: K, value: SettingsData[K]): void {
    this.data[key] = value;
    Storage.save('settings', this.data);
    for (const l of this.listeners) l(this.data);
  }

  reset(): void {
    this.data = { ...DEFAULTS };
    Storage.save('settings', this.data);
    for (const l of this.listeners) l(this.data);
  }

  onChange(l: Listener): void {
    this.listeners.push(l);
  }
}
