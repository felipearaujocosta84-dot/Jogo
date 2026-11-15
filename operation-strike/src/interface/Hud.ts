// HUD de FPS competitivo: mira dinâmica, vida, colete, munição, cronômetro, local no mapa,
// radar, avisos de interação, mensagens e contador de FPS.
import type { MapInstance } from '../maps/MapBuilder';
import { Radar } from './Radar';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

export class Hud {
  private root = $('hud');
  private health = $('hudHealth');
  private armor = $('hudArmor');
  private ammo = $('hudAmmo');
  private reserve = $('hudReserve');
  private weapon = $('hudWeapon');
  private timer = $('hudTimer');
  private zone = $('hudZone');
  private fps = $('hudFps');
  private prompt = $('hudPrompt');
  private toast = $('hudToast');
  private cross = $('crosshair');
  private radar: Radar | null = null;
  private toastTimer = 0;
  private last: Record<string, string> = {};

  show(v: boolean): void {
    this.root.classList.toggle('hidden', !v);
  }

  setMap(map: MapInstance): void {
    this.radar = new Radar($('radar') as HTMLCanvasElement, map);
  }

  private text(el: HTMLElement, key: string, value: string): void {
    if (this.last[key] === value) return;
    this.last[key] = value;
    el.textContent = value;
  }

  setVitals(health: number, armor: number): void {
    this.text(this.health, 'hp', String(Math.ceil(health)));
    this.text(this.armor, 'ar', String(Math.ceil(armor)));
  }

  setAmmo(name: string, ammo: number, reserve: number, reloading: boolean): void {
    this.text(this.weapon, 'wn', name);
    this.text(this.ammo, 'am', reloading ? '··' : String(ammo));
    this.text(this.reserve, 'rs', '/ ' + reserve);
    this.ammo.classList.toggle('low', ammo <= 5);
  }

  setTimer(seconds: number): void {
    const m = Math.floor(seconds / 60), s = Math.floor(seconds % 60);
    this.text(this.timer, 'tm', `${m}:${s.toString().padStart(2, '0')}`);
  }

  setZone(name: string): void {
    this.text(this.zone, 'zn', name);
  }

  setFps(v: number | null): void {
    this.fps.classList.toggle('hidden', v === null);
    if (v !== null) this.text(this.fps, 'fps', Math.round(v) + ' FPS');
  }

  setPrompt(text: string | null): void {
    this.prompt.classList.toggle('hidden', !text);
    if (text) this.text(this.prompt, 'pr', text);
  }

  /** Mira dinâmica: abre com a dispersão da arma. */
  setCrosshair(gapPx: number, color: string, hidden: boolean): void {
    this.cross.style.setProperty('--gap', gapPx.toFixed(1) + 'px');
    this.cross.style.setProperty('--cross-color', color);
    this.cross.classList.toggle('hidden', hidden);
  }

  message(text: string, seconds = 2.5): void {
    this.toast.textContent = text;
    this.toast.classList.remove('hidden');
    this.toastTimer = seconds;
  }

  update(dt: number, x: number, z: number, yaw: number): void {
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toast.classList.add('hidden');
    }
    this.radar?.draw(x, z, yaw);
  }
}
