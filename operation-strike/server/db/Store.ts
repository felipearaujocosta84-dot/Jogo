// Armazenamento: contas, sessões, perfis, cosméticos e amizades.
// PgStore (PostgreSQL) em produção; MemoryStore só para desenvolvimento e testes rápidos.
import type { ProfileData } from '../../src/save/Profile';

export interface User {
  id: string;
  username: string;
  /** Código público para adicionar como amigo (ex.: OS-7K2Q9). */
  friendCode: string;
  createdAt: number;
}

export type FriendState = 'accepted' | 'outgoing' | 'incoming';

export interface Store {
  readonly kind: 'postgres' | 'memory';
  init(): Promise<void>;
  close(): Promise<void>;
  createUser(username: string, passHash: string): Promise<User | null>;
  userByName(username: string): Promise<(User & { passHash: string }) | null>;
  userById(id: string): Promise<User | null>;
  userByCode(code: string): Promise<User | null>;
  createSession(userId: string, tokenHash: string, expires: number): Promise<void>;
  sessionUser(tokenHash: string): Promise<User | null>;
  deleteSession(tokenHash: string): Promise<void>;
  getProfile(user: User): Promise<ProfileData>;
  saveProfile(userId: string, p: ProfileData): Promise<void>;
  getCosmetics(userId: string): Promise<Record<string, string>>;
  saveCosmetics(userId: string, c: Record<string, string>): Promise<void>;
  ranking(limit: number): Promise<ProfileData[]>;
  friends(userId: string): Promise<{ user: User; state: FriendState }[]>;
  /** Pedido de amizade (ou aceita direto se o outro já tinha pedido). Retorna o estado final. */
  requestFriend(from: string, to: string): Promise<FriendState>;
  acceptFriend(userId: string, requesterId: string): Promise<boolean>;
  removeFriend(a: string, b: string): Promise<void>;
  areFriends(a: string, b: string): Promise<boolean>;
}
