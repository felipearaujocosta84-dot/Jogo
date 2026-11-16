// Armazenamento em PostgreSQL (produção). Conexão por DATABASE_URL.
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { newProfile, type ProfileData } from '../../src/save/Profile';
import { SCHEMA_SQL } from './schema';
import { friendCode, type FriendState, type Store, type User } from './common';

type Row = Record<string, unknown>;
const toUser = (r: Row): User => ({ id: String(r.id), username: String(r.username), friendCode: String(r.friend_code), createdAt: new Date(r.created_at as string).getTime() });

export class PgStore implements Store {
  readonly kind = 'postgres' as const;
  private pool: pg.Pool;

  constructor(url: string) {
    this.pool = new pg.Pool({ connectionString: url, max: 10, idleTimeoutMillis: 30_000 });
  }

  async init(): Promise<void> {
    await this.pool.query(SCHEMA_SQL);
    // limpa sessões vencidas
    await this.pool.query('DELETE FROM os_sessions WHERE expires_at < now()');
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async createUser(username: string, passHash: string): Promise<User | null> {
    for (let k = 0; k < 5; k++) {
      try {
        const r = await this.pool.query(
          'INSERT INTO os_users (id, username, username_key, pass_hash, friend_code) VALUES ($1,$2,$3,$4,$5) RETURNING *',
          [randomUUID(), username, username.toLowerCase(), passHash, friendCode()]
        );
        return toUser(r.rows[0]);
      } catch (e) {
        const err = e as { code?: string; constraint?: string };
        if (err.code === '23505' && err.constraint?.includes('username')) return null; // nome já existe
        if (err.code === '23505') continue; // código de amigo repetido: tenta outro
        throw e;
      }
    }
    return null;
  }

  async userByName(username: string): Promise<(User & { passHash: string }) | null> {
    const r = await this.pool.query('SELECT * FROM os_users WHERE username_key = $1', [username.toLowerCase()]);
    return r.rows[0] ? { ...toUser(r.rows[0]), passHash: String(r.rows[0].pass_hash) } : null;
  }

  async userById(id: string): Promise<User | null> {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    const r = await this.pool.query('SELECT * FROM os_users WHERE id = $1', [id]);
    return r.rows[0] ? toUser(r.rows[0]) : null;
  }

  async userByCode(code: string): Promise<User | null> {
    const r = await this.pool.query('SELECT * FROM os_users WHERE friend_code = $1', [code.toUpperCase()]);
    return r.rows[0] ? toUser(r.rows[0]) : null;
  }

  async createSession(userId: string, tokenHash: string, expires: number): Promise<void> {
    await this.pool.query('INSERT INTO os_sessions (token_hash, user_id, expires_at) VALUES ($1,$2,$3)', [tokenHash, userId, new Date(expires)]);
  }

  async sessionUser(tokenHash: string): Promise<User | null> {
    const r = await this.pool.query('SELECT u.* FROM os_sessions s JOIN os_users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > now()', [tokenHash]);
    return r.rows[0] ? toUser(r.rows[0]) : null;
  }

  async deleteSession(tokenHash: string): Promise<void> {
    await this.pool.query('DELETE FROM os_sessions WHERE token_hash = $1', [tokenHash]);
  }

  async getProfile(user: User): Promise<ProfileData> {
    const r = await this.pool.query('SELECT data FROM os_profiles WHERE user_id = $1', [user.id]);
    if (r.rows[0]) return { ...(r.rows[0].data as ProfileData), id: user.id, name: user.username };
    const p = newProfile(user.id, user.username);
    await this.saveProfile(user.id, p);
    return p;
  }

  async saveProfile(userId: string, p: ProfileData): Promise<void> {
    await this.pool.query(
      'INSERT INTO os_profiles (user_id, data, mmr, updated_at) VALUES ($1,$2,$3,now()) ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, mmr = EXCLUDED.mmr, updated_at = now()',
      [userId, JSON.stringify(p), Math.round(p.mmr)]
    );
  }

  async getCosmetics(userId: string): Promise<Record<string, string>> {
    const r = await this.pool.query('SELECT data FROM os_cosmetics WHERE user_id = $1', [userId]);
    return (r.rows[0]?.data as Record<string, string>) ?? {};
  }

  async saveCosmetics(userId: string, c: Record<string, string>): Promise<void> {
    await this.pool.query(
      'INSERT INTO os_cosmetics (user_id, data, updated_at) VALUES ($1,$2,now()) ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()',
      [userId, JSON.stringify(c)]
    );
  }

  async ranking(limit: number): Promise<ProfileData[]> {
    const r = await this.pool.query('SELECT data FROM os_profiles ORDER BY mmr DESC LIMIT $1', [limit]);
    return r.rows.map(x => x.data as ProfileData);
  }

  async friends(userId: string): Promise<{ user: User; state: FriendState }[]> {
    const r = await this.pool.query(
      `SELECT u.*, f.status, f.requester FROM os_friends f JOIN os_users u ON u.id = CASE WHEN f.requester = $1 THEN f.addressee ELSE f.requester END
       WHERE f.requester = $1 OR f.addressee = $1 ORDER BY u.username_key`,
      [userId]
    );
    return r.rows.map(row => ({
      user: toUser(row),
      state: row.status === 'accepted' ? 'accepted' : String(row.requester) === userId ? 'outgoing' : 'incoming'
    }));
  }

  async requestFriend(from: string, to: string): Promise<FriendState> {
    const back = await this.pool.query('SELECT status FROM os_friends WHERE requester = $1 AND addressee = $2', [to, from]);
    if (back.rows[0]) {
      // o outro já tinha pedido: vira amizade
      await this.pool.query("UPDATE os_friends SET status = 'accepted' WHERE requester = $1 AND addressee = $2", [to, from]);
      return 'accepted';
    }
    const r = await this.pool.query(
      "INSERT INTO os_friends (requester, addressee, status) VALUES ($1,$2,'pending') ON CONFLICT (requester, addressee) DO UPDATE SET status = os_friends.status RETURNING status",
      [from, to]
    );
    return r.rows[0].status === 'accepted' ? 'accepted' : 'outgoing';
  }

  async acceptFriend(userId: string, requesterId: string): Promise<boolean> {
    const r = await this.pool.query("UPDATE os_friends SET status = 'accepted' WHERE requester = $1 AND addressee = $2 AND status = 'pending'", [requesterId, userId]);
    return (r.rowCount ?? 0) > 0;
  }

  async removeFriend(a: string, b: string): Promise<void> {
    await this.pool.query('DELETE FROM os_friends WHERE (requester = $1 AND addressee = $2) OR (requester = $2 AND addressee = $1)', [a, b]);
  }

  async areFriends(a: string, b: string): Promise<boolean> {
    const r = await this.pool.query(
      "SELECT 1 FROM os_friends WHERE status = 'accepted' AND ((requester = $1 AND addressee = $2) OR (requester = $2 AND addressee = $1))",
      [a, b]
    );
    return (r.rowCount ?? 0) > 0;
  }
}
