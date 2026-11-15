// Servidor do OPERATION STRIKE: arquivos do jogo (pasta dist), API de ranking/perfis e multiplayer por WebSocket.
// Uso: npm run build && npm start   (porta padrão 8080, ou a variável PORT)
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { WebSocketServer, type WebSocket } from 'ws';
import { ProfileStore } from './ProfileStore';
import { Room, type Client } from './Room';
import type { ClientMsg, ServerMsg } from '../src/multiplayer/Protocol';
import { MAPS } from '../src/maps/maps';
import type { Difficulty, GameMode } from '../src/sim/types';
import { sanitizeSkins } from '../src/weapons/Skins';
import { levelFor } from '../src/save/Profile';

const PORT = Number(process.env.PORT ?? 8080);
const ROOT = resolve(process.cwd(), 'dist');
const store = new ProfileStore(resolve(process.cwd(), 'data/profiles.json'));
const rooms = new Map<string, Room>();
const clients = new Map<string, Client>(); // por token
const RECONNECT_GRACE = 120_000;

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.glb': 'model/gltf-binary',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav'
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (url.pathname === '/api/ranking') {
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify(store.ranking(100)));
  }
  if (url.pathname.startsWith('/api/profile/')) {
    const p = store.find(decodeURIComponent(url.pathname.slice(13)));
    res.setHeader('Content-Type', 'application/json');
    if (!p) {
      res.statusCode = 404;
      return res.end('{}');
    }
    return res.end(JSON.stringify(p));
  }
  if (url.pathname === '/api/status') {
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ rooms: rooms.size, players: [...clients.values()].filter(c => c.connected).length }));
  }
  // arquivos estáticos
  let path = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
  if (!path) path = 'index.html';
  const file = join(ROOT, path);
  if (!file.startsWith(ROOT)) {
    res.statusCode = 403;
    return res.end();
  }
  try {
    const st = await stat(file);
    const target = st.isDirectory() ? join(file, 'index.html') : file;
    const data = await readFile(target);
    res.setHeader('Content-Type', MIME[extname(target)] ?? 'application/octet-stream');
    if (target.includes('/assets/')) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.end(data);
  } catch {
    res.statusCode = 404;
    res.end('Não encontrado. Rode "npm run build" antes de "npm start".');
  }
});

function roomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  do {
    code = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function createRoom(c: Client, mode: GameMode, mapId: string, difficulty: Difficulty, isPublic: boolean): Room {
  const room = new Room(roomCode(), mode, MAPS[mapId] ? mapId : 'dust_zone', difficulty, isPublic, c, store, r => rooms.delete(r.code));
  rooms.set(room.code, room);
  return room;
}

/** Matchmaking por habilidade: procura sala pública do modo com MMR médio próximo. */
function quickMatch(c: Client, mode: GameMode): void {
  const mmr = c.profile.mmr;
  let best: Room | null = null;
  let bestDiff = Infinity;
  for (const r of rooms.values()) {
    if (!r.isPublic || r.mode !== mode || !r.canJoin()) continue;
    if (r.state === 'playing' && mode === 'competitive') continue;
    const diff = Math.abs(r.avgMmr - mmr);
    const window = 250 + (r.state === 'lobby' ? 150 : 0);
    if (diff < window && diff < bestDiff) {
      best = r;
      bestDiff = diff;
    }
  }
  if (!best) {
    const maps = Object.keys(MAPS);
    const difficulty: Difficulty = mmr > 1250 ? 'hard' : mmr < 900 ? 'easy' : 'normal';
    best = createRoom(c, mode, maps[Math.floor(Math.random() * maps.length)], difficulty, true);
  }
  const err = best.join(c);
  if (err) c.send({ t: 'error', msg: err });
}

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 64 * 1024 });

wss.on('connection', (ws: WebSocket) => {
  let client: Client | null = null;
  const send = (msg: ServerMsg) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
  };
  let msgCount = 0;
  const rate = setInterval(() => (msgCount = 0), 1000);

  ws.on('message', raw => {
    if (++msgCount > 200) return; // proteção contra inundação
    let msg: ClientMsg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (!client && msg.t !== 'hello') return;
    switch (msg.t) {
      case 'hello': {
        const name = String(msg.name ?? 'Jogador').replace(/[<>]/g, '').slice(0, 16) || 'Jogador';
        const old = msg.token ? clients.get(msg.token) : undefined;
        if (old && !old.connected && Date.now() - old.disconnectedAt < RECONNECT_GRACE) {
          client = old;
          client.send = send;
          client.connected = true;
          send({ t: 'welcome', clientId: client.id, token: client.token, profile: client.profile, resumed: !!client.room });
          client.room?.resume(client);
        } else {
          const token = randomBytes(16).toString('hex');
          client = { id: randomUUID(), token, name, profile: store.get(String(msg.profileId ?? token), name), send, room: null, playerId: null, connected: true, disconnectedAt: 0, ping: 0, skins: {} };
          clients.set(token, client);
          send({ t: 'welcome', clientId: client.id, token, profile: client.profile, resumed: false });
        }
        break;
      }
      case 'list':
        send({ t: 'rooms', rooms: [...rooms.values()].filter(r => r.isPublic && r.state !== 'over').map(r => r.info()) });
        break;
      case 'create': {
        client!.room?.leave(client!);
        const mode: GameMode = msg.mode === 'casual' ? 'casual' : 'competitive';
        const diff: Difficulty = ['easy', 'normal', 'hard'].includes(msg.difficulty) ? msg.difficulty : 'normal';
        const r = createRoom(client!, mode, String(msg.mapId), diff, !!msg.isPublic);
        r.join(client!);
        break;
      }
      case 'join': {
        client!.room?.leave(client!);
        const r = rooms.get(String(msg.code).toUpperCase().trim());
        if (!r) send({ t: 'error', msg: 'Sala não encontrada' });
        else {
          const err = r.join(client!);
          if (err) send({ t: 'error', msg: err });
        }
        break;
      }
      case 'quick':
        client!.room?.leave(client!);
        quickMatch(client!, msg.mode === 'casual' ? 'casual' : 'competitive');
        break;
      case 'team':
        client!.room?.setTeam(client!, msg.team === 'CT' ? 'CT' : 'T');
        break;
      case 'start':
        client!.room?.start(client!);
        break;
      case 'cmd':
        if (Array.isArray(msg.c)) client!.room?.cmd(client!, msg.c);
        break;
      case 'buy':
        client!.room?.buy(client!, msg.item);
        break;
      case 'skins':
        client!.skins = sanitizeSkins(msg.skins, levelFor(client!.profile.xp).level);
        client!.room?.skins(client!);
        break;
      case 'chat':
        client!.room?.chat(client!.name, msg.text);
        break;
      case 'leave':
        client!.room?.leave(client!);
        break;
      case 'ping':
        if (typeof msg.rtt === 'number') client!.ping = Math.max(0, Math.min(999, Math.round(msg.rtt)));
        send({ t: 'pong', ts: msg.ts });
        break;
    }
  });

  ws.on('close', () => {
    clearInterval(rate);
    if (!client) return;
    client.connected = false;
    client.disconnectedAt = Date.now();
    client.room?.disconnected(client);
    const c = client;
    setTimeout(() => {
      if (!c.connected) {
        c.room?.leave(c);
        clients.delete(c.token);
      }
    }, RECONNECT_GRACE);
  });
});

// mede o ping de cada cliente pelo próprio cliente (mensagem 'ping'); o servidor só repassa o valor informado
server.listen(PORT, () => {
  console.log(`OPERATION STRIKE rodando em http://localhost:${PORT}  (WebSocket em /ws)`);
});

process.on('SIGINT', () => {
  store.flush();
  process.exit(0);
});
