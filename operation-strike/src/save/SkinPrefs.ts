// Personalização salva no aparelho: skins por arma, acessórios por arma e visual de cada personagem.
// Tudo fica num único mapa (o mesmo enviado ao servidor e à simulação, ver cosmetics/Cosmetics.ts):
//   arma → skin · 'a_' + arma → "acessório.acessório" · 'lk_CT' / 'lk_T' → visual do personagem.
// O que exige nível maior que o atual fica guardado, mas não é usado até ser liberado.
import { Storage } from './Storage';
import { SKINS, skinById } from '../weapons/Skins';
import {
  ATTACHMENTS,
  DEFAULT_LOOK,
  attachmentById,
  decodeLook,
  encodeLook,
  parseAttachments,
  sanitizeCosmetics,
  type AttachSlot,
  type CharSlot,
  type Look
} from '../cosmetics/Cosmetics';
import type { Team } from '../sim/types';

type Listener = (cosmetics: Record<string, string>) => void;

class SkinPrefsStore {
  private data: Record<string, string> = Storage.load<Record<string, string>>('skins', {});
  private listeners: Listener[] = [];
  level = 1;

  /** Tudo o que está liberado no nível atual (enviado ao servidor / simulação). */
  get all(): Record<string, string> {
    return sanitizeCosmetics(this.data, this.level);
  }

  private save(): void {
    Storage.save('skins', this.data);
    const all = this.all;
    for (const l of this.listeners) l(all);
  }

  // ---------------------------------------------------------------- skins

  get(weapon: string): string {
    const s = this.data[weapon] ?? 'default';
    return skinById(s).level <= this.level ? skinById(s).id : 'default';
  }

  unlocked(skinId: string): boolean {
    return skinById(skinId).level <= this.level;
  }

  set(weapon: string, skin: string): boolean {
    if (!this.unlocked(skin)) return false;
    if (skin === 'default') delete this.data[weapon];
    else this.data[weapon] = skin;
    this.save();
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

  // ---------------------------------------------------------------- acessórios das armas

  attachments(weapon: string): string[] {
    return parseAttachments(weapon, this.data['a_' + weapon], this.level);
  }

  attachmentUnlocked(id: string): boolean {
    return (attachmentById(id)?.level ?? 99) <= this.level;
  }

  /** Coloca (ou troca) o acessório no encaixe dele. */
  equipAttachment(weapon: string, id: string): boolean {
    const a = attachmentById(id);
    if (!a || !this.attachmentUnlocked(id)) return false;
    const list = parseAttachments(weapon, this.data['a_' + weapon], 99).filter(x => attachmentById(x)?.slot !== a.slot);
    list.push(id);
    const ok = parseAttachments(weapon, list.join('.'), 99);
    if (!ok.includes(id)) return false;
    this.data['a_' + weapon] = ok.join('.');
    this.save();
    return true;
  }

  removeAttachment(weapon: string, slot: AttachSlot): void {
    const list = parseAttachments(weapon, this.data['a_' + weapon], 99).filter(x => attachmentById(x)?.slot !== slot);
    if (list.length) this.data['a_' + weapon] = list.join('.');
    else delete this.data['a_' + weapon];
    this.save();
  }

  /** Quantas armas usam um acessório (inventário). */
  attachmentUse(id: string): string[] {
    return Object.keys(this.data).filter(k => k.startsWith('a_') && this.data[k].split('.').includes(id)).map(k => k.slice(2));
  }

  // ---------------------------------------------------------------- visual dos personagens

  look(team: Team): Look {
    return decodeLook(this.data['lk_' + team], this.level);
  }

  lookString(team: Team): string {
    return encodeLook(this.look(team));
  }

  setLookItem(team: Team, slot: CharSlot, id: string): boolean {
    const l = decodeLook(this.data['lk_' + team], 99);
    l[slot] = id;
    const enc = encodeLook(decodeLook(encodeLook(l), this.level));
    const check = decodeLook(enc, this.level);
    if (check[slot] !== id) return false;
    if (enc) this.data['lk_' + team] = enc;
    else delete this.data['lk_' + team];
    this.save();
    return true;
  }

  resetLook(team: Team): void {
    delete this.data['lk_' + team];
    this.save();
  }

  get defaultLook(): Look {
    return { ...DEFAULT_LOOK };
  }

  onChange(l: Listener): void {
    this.listeners.push(l);
  }
}

export const SkinPrefs = new SkinPrefsStore();
/** Mesmo objeto com nome mais descritivo. */
export const Loadout = SkinPrefs;
export { ATTACHMENTS };
