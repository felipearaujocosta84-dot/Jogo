// Armazenamento em memória: só para desenvolvimento/testes sem PostgreSQL (tudo se perde ao reiniciar).
import { randomUUID } from 'node:crypto';
import { newProfile, type ProfileData } from '../../src/save/Profile';
import { friendCode, type FriendState, type Store, type User } from './common';

export class MemoryStore implements Store {
  readonly kind = 'memory' as const;
  private users = new Map<string, User & { passHash: string }>();
  private sessions = new Map<string, { userId: string; expires: number }>();
  private profiles = new Map<string, ProfileData>();
  private cosmetics = new Map<string, Record<string, string>>();
  private links = new Map<string, 'pending' | 'accepted'>(); // "req|addr"

  async init(): Promise<void> {}
  async close(): Promise<void> {}

  async createUser(username: string, passHash: string): Promise<User | null> {
    if ([...this.users.values()].some(u => u.username.toLowerCase() === username.toLowerCase())) return null;
    const u = { id: randomUUID(), username, friendCode: friendCode(), createdAt: Date.now(), passHash };
    this.users.set(u.id, u);
    return { id: u.id, username, friendCode: u.friendCode, createdAt: u.createdAt };
  }
  async userByName(username: string) {
    return [...this.users.values()].find(u => u.username.toLowerCase() === username.toLowerCase()) ?? null;
  }
  private pub(u: (User & { passHash: string }) | undefined): User | null {
    return u ? { id: u.id, username: u.username, friendCode: u.friendCode, createdAt: u.createdAt } : null;
  }
  async userById(id: string) {
    return this.pub(this.users.get(id));
  }
  async userByCode(code: string) {
    return this.pub([...this.users.values()].find(u => u.friendCode === code.toUpperCase()));
  }
  async createSession(userId: string, tokenHash: string, expires: number) {
    this.sessions.set(tokenHash, { userId, expires });
  }
  async sessionUser(tokenHash: string) {
    const s = this.sessions.get(tokenHash);
    return s && s.expires > Date.now() ? this.pub(this.users.get(s.userId)) : null;
  }
  async deleteSession(tokenHash: string) {
    this.sessions.delete(tokenHash);
  }
  async getProfile(user: User) {
    let p = this.profiles.get(user.id);
    if (!p) {
      p = newProfile(user.id, user.username);
      this.profiles.set(user.id, p);
    }
    return JSON.parse(JSON.stringify(p)) as ProfileData;
  }
  async saveProfile(userId: string, p: ProfileData) {
    this.profiles.set(userId, JSON.parse(JSON.stringify(p)));
  }
  async getCosmetics(userId: string) {
    return { ...(this.cosmetics.get(userId) ?? {}) };
  }
  async saveCosmetics(userId: string, c: Record<string, string>) {
    this.cosmetics.set(userId, { ...c });
  }
  async ranking(limit: number) {
    return [...this.profiles.values()].sort((a, b) => b.mmr - a.mmr).slice(0, limit);
  }
  async friends(userId: string) {
    const out: { user: User; state: FriendState }[] = [];
    for (const [k, st] of this.links) {
      const [a, b] = k.split('|');
      if (a !== userId && b !== userId) continue;
      const other = this.pub(this.users.get(a === userId ? b : a));
      if (other) out.push({ user: other, state: st === 'accepted' ? 'accepted' : a === userId ? 'outgoing' : 'incoming' });
    }
    return out;
  }
  async requestFriend(from: string, to: string): Promise<FriendState> {
    if (this.links.has(to + '|' + from)) {
      this.links.set(to + '|' + from, 'accepted');
      return 'accepted';
    }
    if (!this.links.has(from + '|' + to)) this.links.set(from + '|' + to, 'pending');
    return this.links.get(from + '|' + to) === 'accepted' ? 'accepted' : 'outgoing';
  }
  async acceptFriend(userId: string, requesterId: string) {
    const k = requesterId + '|' + userId;
    if (this.links.get(k) !== 'pending') return false;
    this.links.set(k, 'accepted');
    return true;
  }
  async removeFriend(a: string, b: string) {
    this.links.delete(a + '|' + b);
    this.links.delete(b + '|' + a);
  }
  async areFriends(a: string, b: string) {
    return this.links.get(a + '|' + b) === 'accepted' || this.links.get(b + '|' + a) === 'accepted';
  }
}
