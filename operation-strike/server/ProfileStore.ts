// Armazena perfis dos jogadores online em data/profiles.json (gravação com atraso para não travar o servidor).
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { dirname } from 'node:path';
import { newProfile, rankName, type ProfileData } from '../src/save/Profile';

export class ProfileStore {
  private profiles = new Map<string, ProfileData>();
  private dirty = false;

  constructor(private file: string) {
    try {
      if (existsSync(file)) {
        const list = JSON.parse(readFileSync(file, 'utf8')) as ProfileData[];
        for (const p of list) this.profiles.set(p.id, p);
      }
    } catch (e) {
      console.error('Falha ao ler perfis:', e);
    }
    setInterval(() => this.flush(), 5000).unref();
  }

  get(id: string, name: string): ProfileData {
    const safeId = String(id).slice(0, 64).replace(/[^a-zA-Z0-9_-]/g, '') || 'anon';
    let p = this.profiles.get(safeId);
    if (!p) {
      p = newProfile(safeId, name);
      this.profiles.set(safeId, p);
      this.dirty = true;
    }
    if (name && p.name !== name) {
      p.name = name;
      this.dirty = true;
    }
    return p;
  }

  find(id: string): ProfileData | undefined {
    return this.profiles.get(id);
  }

  touch(): void {
    this.dirty = true;
  }

  ranking(limit = 50): { id: string; name: string; mmr: number; rank: string; wins: number; matches: number; kd: number }[] {
    return [...this.profiles.values()]
      .filter(p => p.matches > 0)
      .sort((a, b) => b.mmr - a.mmr)
      .slice(0, limit)
      .map(p => ({ id: p.id, name: p.name, mmr: p.mmr, rank: rankName(p.mmr), wins: p.wins, matches: p.matches, kd: p.deaths ? Math.round((p.kills / p.deaths) * 100) / 100 : p.kills }));
  }

  flush(): void {
    if (!this.dirty) return;
    this.dirty = false;
    try {
      mkdirSync(dirname(this.file), { recursive: true });
      const tmp = this.file + '.tmp';
      writeFileSync(tmp, JSON.stringify([...this.profiles.values()]));
      renameSync(tmp, this.file);
    } catch (e) {
      console.error('Falha ao salvar perfis:', e);
    }
  }
}
