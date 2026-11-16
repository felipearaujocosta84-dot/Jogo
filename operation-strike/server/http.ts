// API HTTP (contas, perfil, ranking, status) e arquivos do jogo compilado. As rotas /matchmake/* são do Colyseus.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { config } from './config';
import { log, metrics } from './log';
import { levelFor, type ProfileData } from '../src/save/Profile';
import { sanitizeCosmetics } from '../src/cosmetics/Cosmetics';
import { presence } from './presence';
import type { Auth } from './auth';
import type { Store } from './db/Store';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.webmanifest': 'application/manifest+json',
  '.glb': 'model/gltf-binary', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.wasm': 'application/wasm'
};

/** Campos públicos de um perfil (sem dados internos). */
function publicProfile(p: ProfileData): Record<string, unknown> {
  const { history, ...rest } = p;
  return { ...rest, history: history.slice(0, 10) };
}

export function clientIp(req: IncomingMessage): string {
  if (config.trustProxy) {
    const f = req.headers['x-forwarded-for'];
    if (typeof f === 'string' && f) return f.split(',')[0].trim();
  }
  return req.socket.remoteAddress ?? '?';
}

async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > 64 * 1024) throw new Error('corpo grande demais');
    chunks.push(c as Buffer);
  }
  try {
    const v = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

function bearer(req: IncomingMessage): string {
  const h = req.headers.authorization ?? '';
  return h.startsWith('Bearer ') ? h.slice(7) : '';
}

export function makeHttpHandler(auth: Auth, store: Store, matchmake: (req: IncomingMessage, res: ServerResponse) => void, roomsStatus: () => Promise<unknown>) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const url = new URL(req.url ?? '/', 'http://x');
    const origin = req.headers.origin;
    if (origin && config.allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    }
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      return void res.end();
    }
    if (url.pathname.startsWith('/matchmake')) return matchmake(req, res);
    const json = (status: number, data: unknown) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store');
      res.end(JSON.stringify(data));
    };
    try {
      if (url.pathname === '/api/health') return json(200, { ok: true });
      if (url.pathname === '/api/status') {
        const mem = process.memoryUsage();
        return json(200, {
          uptime: Math.round((Date.now() - metrics.startedAt) / 1000), online: presence.online.size, db: store.kind,
          memoryMB: Math.round(mem.rss / 1048576), rooms: await roomsStatus(),
          counters: { logins: metrics.logins, loginFailures: metrics.loginFailures, registrations: metrics.registrations, rejectedMessages: metrics.rejectedMessages, rateLimited: metrics.rateLimited, reconnections: metrics.reconnections, matchesFinished: metrics.matchesFinished },
          tickMs: Object.fromEntries(metrics.tickMs)
        });
      }
      if (url.pathname === '/api/auth/register' && req.method === 'POST') {
        const b = await body(req);
        const r = await auth.register(clientIp(req), b.username, b.password);
        if ('error' in r) return json(r.status, { error: r.error });
        return json(200, { token: r.token, user: r.user, profile: await store.getProfile(r.user) });
      }
      if (url.pathname === '/api/auth/login' && req.method === 'POST') {
        const b = await body(req);
        const r = await auth.login(clientIp(req), b.username, b.password);
        if ('error' in r) return json(r.status, { error: r.error });
        return json(200, { token: r.token, user: r.user, profile: await store.getProfile(r.user) });
      }
      if (url.pathname === '/api/auth/logout' && req.method === 'POST') {
        const t = bearer(req);
        if (t) await auth.logout(t);
        return json(200, { ok: true });
      }
      if (url.pathname === '/api/me') {
        const user = await auth.userFromToken(bearer(req));
        if (!user) return json(401, { error: 'Sessão expirada' });
        if (req.method === 'PUT') {
          // cosméticos: o servidor decide o que o nível permite
          const b = await body(req);
          const profile = await store.getProfile(user);
          const clean = sanitizeCosmetics(b.cosmetics, levelFor(profile.xp).level);
          await store.saveCosmetics(user.id, clean);
          return json(200, { cosmetics: clean });
        }
        return json(200, { user, profile: await store.getProfile(user), cosmetics: await store.getCosmetics(user.id) });
      }
      if (url.pathname === '/api/ranking') return json(200, (await store.ranking(100)).map(publicProfile));
      if (url.pathname.startsWith('/api/profile/')) {
        const u = await store.userById(decodeURIComponent(url.pathname.slice(13)));
        if (!u) return json(404, {});
        return json(200, publicProfile(await store.getProfile(u)));
      }
      if (url.pathname.startsWith('/api/')) return json(404, { error: 'Rota não encontrada' });
    } catch (e) {
      log.error('erro na API', { path: url.pathname, err: String(e) });
      return json(500, { error: 'Erro no servidor' });
    }
    // arquivos estáticos (o jogo no navegador)
    let path = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
    if (!path) path = 'index.html';
    const file = join(config.staticDir, path);
    if (!file.startsWith(config.staticDir)) {
      res.statusCode = 403;
      return void res.end();
    }
    try {
      const st = await stat(file);
      const target = st.isDirectory() ? join(file, 'index.html') : file;
      const data = await readFile(target);
      res.setHeader('Content-Type', MIME[extname(target)] ?? 'application/octet-stream');
      if (target.includes('/assets/')) res.setHeader('Cache-Control', 'public, max-age=604800');
      res.end(data);
    } catch {
      res.statusCode = 404;
      res.end('Não encontrado. Rode "npm run build" antes de "npm start".');
    }
  };
}
