// Contas: cadastro e login com senha (scrypt com sal), sessões com token aleatório guardado só como hash
// no banco, limite de tentativas por IP e por nome. O token vai no cabeçalho Authorization (API) ou nas
// opções de entrada da sala (Colyseus) — nunca há senha ou segredo dentro do app.
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { config } from './config';
import { log, metrics } from './log';
import type { Store, User } from './db/Store';

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export const USERNAME_RE = /^[A-Za-z0-9_À-ÿ.-]{3,16}$/;

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(pw, salt, 64);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function checkPassword(pw: string, stored: string): Promise<boolean> {
  const [kind, s, k] = stored.split('$');
  if (kind !== 'scrypt' || !s || !k) return false;
  const want = Buffer.from(k, 'base64');
  const got = await scrypt(pw, Buffer.from(s, 'base64'), want.length);
  return got.length === want.length && timingSafeEqual(got, want);
}

export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');

/** Janela deslizante simples: no máximo `max` eventos por `ms` para cada chave. */
export class RateLimiter {
  private hits = new Map<string, number[]>();
  constructor(private max: number, private ms: number) {}
  allow(key: string): boolean {
    const now = Date.now();
    const list = (this.hits.get(key) ?? []).filter(t => now - t < this.ms);
    if (list.length >= this.max) {
      this.hits.set(key, list);
      return false;
    }
    list.push(now);
    this.hits.set(key, list);
    if (this.hits.size > 50_000) this.hits.clear();
    return true;
  }
}

const loginLimit = new RateLimiter(config.testMode ? 10_000 : 10, 60_000);
const registerLimit = new RateLimiter(config.testMode ? 10_000 : 5, 60 * 60_000);

export class Auth {
  constructor(private store: Store) {}

  private async issue(user: User): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    await this.store.createSession(user.id, tokenHash(token), Date.now() + config.sessionDays * 86_400_000);
    return token;
  }

  async register(ip: string, username: unknown, password: unknown): Promise<{ token: string; user: User } | { error: string; status: number }> {
    if (!registerLimit.allow(ip)) return { error: 'Muitos cadastros deste endereço. Tente mais tarde.', status: 429 };
    const name = String(username ?? '').trim();
    const pw = String(password ?? '');
    if (!USERNAME_RE.test(name)) return { error: 'Nome: 3 a 16 letras, números, ponto, hífen ou _', status: 400 };
    if (pw.length < 6 || pw.length > 128) return { error: 'A senha precisa ter de 6 a 128 caracteres', status: 400 };
    const user = await this.store.createUser(name, await hashPassword(pw));
    if (!user) return { error: 'Esse nome já está em uso', status: 409 };
    metrics.registrations++;
    log.info('cadastro', { user: user.id, name });
    return { token: await this.issue(user), user };
  }

  async login(ip: string, username: unknown, password: unknown): Promise<{ token: string; user: User } | { error: string; status: number }> {
    const name = String(username ?? '').trim();
    if (!loginLimit.allow(ip) || !loginLimit.allow('u:' + name.toLowerCase())) return { error: 'Muitas tentativas. Aguarde um minuto.', status: 429 };
    const u = await this.store.userByName(name);
    // compara mesmo sem usuário (tempo parecido nos dois casos)
    const ok = await checkPassword(String(password ?? ''), u?.passHash ?? 'scrypt$AAAA$AAAA');
    if (!u || !ok) {
      metrics.loginFailures++;
      log.warn('login falhou', { name, ip });
      return { error: 'Nome ou senha incorretos', status: 401 };
    }
    metrics.logins++;
    const { passHash: _drop, ...user } = u;
    void _drop;
    return { token: await this.issue(user), user };
  }

  async userFromToken(token: unknown): Promise<User | null> {
    if (typeof token !== 'string' || token.length < 20 || token.length > 200) return null;
    return this.store.sessionUser(tokenHash(token));
  }

  async logout(token: string): Promise<void> {
    await this.store.deleteSession(tokenHash(token));
  }
}
