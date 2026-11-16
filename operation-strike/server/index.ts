// Servidor multiplayer do OPERATION STRIKE (independente do cliente):
//  - Colyseus (WebSocket; WSS quando atrás de HTTPS) com as salas "social" (amigos/convites/grupo) e "game" (partidas);
//  - PostgreSQL (DATABASE_URL) para contas, sessões, perfis, cosméticos e amizades;
//  - API HTTP: /api/auth/*, /api/me, /api/ranking, /api/profile/:id, /api/status, /api/health;
//  - serve o jogo compilado (pasta dist) para jogar pelo navegador.
// Uso: npm run build && npm start   (variáveis em .env — ver .env.example e deploy/LEIAME.md)
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Server, createNodeMatchmakingMiddleware, matchMaker } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { config } from './config';
import { log, metrics } from './log';
import { Auth } from './auth';
import { PgStore } from './db/PgStore';
import { MemoryStore } from './db/MemoryStore';
import type { Store } from './db/Store';
import { makeHttpHandler } from './http';
import { GameRoom } from './rooms/GameRoom';
import { SocialRoom } from './rooms/SocialRoom';
import { MAPS } from '../src/maps/maps';
import { applyModelData, type ModelMapData } from '../src/maps/ModelMaps';

// mapas de modelo 3D: colisão lida do disco (dist/assets ou public/assets)
for (const def of Object.values(MAPS)) {
  if (!def.model) continue;
  const file = [join(config.staticDir, 'assets', def.model.data), resolve(process.cwd(), 'public/assets', def.model.data)].find(f => existsSync(f));
  if (!file) {
    log.warn('colisão de mapa não encontrada; mapa desativado', { map: def.id });
    delete MAPS[def.id];
    continue;
  }
  applyModelData(def, JSON.parse(readFileSync(file, 'utf8')) as ModelMapData);
}

export async function startServer(port = config.port): Promise<{ close: () => Promise<void>; store: Store; port: number }> {
  const store: Store = config.databaseUrl ? new PgStore(config.databaseUrl) : new MemoryStore();
  if (!config.databaseUrl) log.warn('DATABASE_URL vazio: usando banco em MEMÓRIA (dados somem ao reiniciar; não use em produção)');
  await store.init();
  const auth = new Auth(store);
  GameRoom.deps = { auth, store };
  SocialRoom.deps = { auth, store };

  const http = createServer();
  const transport = new WebSocketTransport({ server: http, pingInterval: 5000, pingMaxRetries: 3 });
  const gameServer = new Server({ transport, greet: false, gracefullyShutdown: false });
  gameServer.define('game', GameRoom);
  gameServer.define('social', SocialRoom);
  await gameServer.serverless();
  const mm = createNodeMatchmakingMiddleware();
  const roomsStatus = async () =>
    (await matchMaker.query({})).map(r => ({ code: r.roomId, name: r.name, clients: r.clients, locked: r.locked, ...(r.name === 'game' ? r.metadata as object : {}) }));
  http.removeAllListeners('request');
  http.on('request', makeHttpHandler(auth, store, (req, res) => void mm(req, res, () => {
    res.statusCode = 404;
    res.end();
  }), roomsStatus));
  // a sala social existe desde o início (todos entram na mesma)
  await matchMaker.createRoom('social', {});

  await new Promise<void>(r => http.listen(port, config.host, () => r()));
  const addr = http.address();
  const realPort = typeof addr === 'object' && addr ? addr.port : port;
  log.info('servidor iniciado', { port: realPort, db: store.kind, static: config.staticDir });

  let closing = false;
  const close = async () => {
    if (closing) return;
    closing = true;
    log.info('desligando');
    await gameServer.gracefullyShutdown(false).catch(() => {});
    http.close();
    await store.close();
  };
  return { close, store, port: realPort };
}

// executado diretamente (npm start)
if (process.argv[1] && /server[/\\]index\.ts$/.test(process.argv[1])) {
  const srv = await startServer();
  for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, () => void srv.close().then(() => process.exit(0)));
  process.on('unhandledRejection', e => log.error('promessa rejeitada', { err: String(e) }));
  setInterval(() => log.info('status', { online: metricsSummary() }), 5 * 60_000).unref();
}

function metricsSummary(): Record<string, unknown> {
  return { rooms: metrics.tickMs.size, matches: metrics.matchesFinished, reconnections: metrics.reconnections };
}
