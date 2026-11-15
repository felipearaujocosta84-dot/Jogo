// Perfil offline salvo no aparelho (partidas contra bots).
import { Storage } from './Storage';
import { newProfile, type ProfileData } from './Profile';

export function loadLocalProfile(name: string): ProfileData {
  let p = Storage.load<ProfileData | null>('profile', null);
  if (!p) {
    const id = (crypto.randomUUID?.() ?? 'p' + Math.random().toString(36).slice(2)) as string;
    p = newProfile(id, name);
    Storage.save('profile', p);
  }
  if (p.name !== name) {
    p.name = name;
    Storage.save('profile', p);
  }
  return p;
}

export function saveLocalProfile(p: ProfileData): void {
  Storage.save('profile', p);
}
