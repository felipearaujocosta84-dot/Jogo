// Skins escolhidas pelo jogador (salvas no aparelho) e quais estão liberadas pelo nível.
import { Storage } from './Storage';
import { SKINS, skinById } from '../weapons/Skins';

type Listener = (skins: Record<string, string>) => void;

class SkinPrefsStore {
  private data: Record<string, string> = Storage.load<Record<string, string>>('skins', {});
  private listeners: Listener[] = [];
  level = 1;

  get all(): Record<string, string> {
    // só envia o que o nível atual libera
    const out: Record<string, string> = {};
    for (const [w, s] of Object.entries(this.data)) if (skinById(s).level <= this.level) out[w] = s;
    return out;
  }

  get(weapon: string): string {
    const s = this.data[weapon] ?? 'default';
    return skinById(s).level <= this.level ? s : 'default';
  }

  unlocked(skinId: string): boolean {
    return skinById(skinId).level <= this.level;
  }

  set(weapon: string, skin: string): boolean {
    if (!this.unlocked(skin)) return false;
    this.data[weapon] = skin;
    Storage.save('skins', this.data);
    for (const l of this.listeners) l(this.all);
    return true;
  }

  /** Próxima skin liberada (setas na loja). */
  cycle(weapon: string, dir: 1 | -1): string {
    const list = SKINS.filter(s => this.unlocked(s.id));
    const i = list.findIndex(s => s.id === this.get(weapon));
    const next = list[(i + dir + list.length) % list.length].id;
    this.set(weapon, next);
    return next;
  }

  onChange(l: Listener): void {
    this.listeners.push(l);
  }
}

export const SkinPrefs = new SkinPrefsStore();
