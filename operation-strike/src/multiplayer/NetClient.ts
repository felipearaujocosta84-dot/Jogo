// Conexão com o servidor próprio (Colyseus sobre WebSocket/WSS + API HTTP):
//  - conta: cadastro/login pela API (o token fica salvo no aparelho; nenhuma senha é guardada);
//  - sala "social": amigos, convites, grupo, notificações, lista de salas e partida rápida;
//  - sala "game": lobby da sala e a partida (comandos em lote 30×/s, ping, reconexão automática).
// Para o resto do jogo expõe a mesma interface de antes: on(handler) com mensagens ServerMsg e send(ClientMsg).
import { Client, type Room } from '@colyseus/sdk';
import type { ClientMsg, RoomInfo, ServerMsg } from './Protocol';
import type { ProfileData } from '../save/Profile';
import type { Snapshot, UserCmd } from '../sim/types';
import { decodeDyn, mergeSnapshot, type NetSnapshot, type RosterEntry } from './NetCodec';
import { Storage } from '../save/Storage';
import { isNativeApp } from '../core/Platform';

type Handler = (msg: ServerMsg) => void;

export interface SocialFriend {
  id: string;
  name: string;
  code: string;
  state: 'accepted' | 'outgoing' | 'incoming';
  status: string;
  roomId: string | null;
}

export interface SocialState {
  me: { id: string; name: string; code: string; level: number };
  profile: ProfileData;
  friends: SocialFriend[];
  invites: { id: string; from: string; roomId: string }[];
  party: { leader: string; members: { id: string; name: string; status: string }[] } | null;
  cosmetics: Record<string, string>;
}

/** Eventos da parte social (além das mensagens da partida). */
export type SocialEvent =
  | { type: 'state'; state: SocialState }
  | { type: 'notify'; kind: string; text: string; from?: string }
  | { type: 'presence'; id: string; status: string; roomId: string | null }
  | { type: 'invite'; id: string; from: string; roomId: string; mode?: string; mapName?: string }
  | { type: 'party'; party: SocialState['party'] }
  | { type: 'party:invite'; id: string; from: string }
  | { type: 'rooms'; rooms: PublicRoom[] }
  | { type: 'closed'; reason: string }
  | { type: 'status'; text: string };

export interface PublicRoom {
  code: string;
  clients: number;
  max: number;
  mode: string;
  mapId: string;
  mapName: string;
  state: string;
  owner: string;
  hasPassword: boolean;
  auto?: boolean;
}

/** Converte o endereço salvo (ws://IP:8080/ws, http://IP:8080, https://dominio) em base HTTP. */
export function normalizeServer(url: string): string {
  let u = url.trim().replace(/\/+$/, '');
  if (!u) return '';
  if (!/^[a-z]+:\/\//i.test(u)) u = 'https://' + u;
  u = u.replace(/^ws:/i, 'http:').replace(/^wss:/i, 'https:').replace(/\/ws$/, '');
  return u;
}

export class NetClient {
  private handlers = new Set<Handler>();
  private socialHandlers = new Set<(e: SocialEvent) => void>();
  private pending: UserCmd[] = [];
  private client: Client;
  social: Room | null = null;
  game: Room | null = null;
  private pingTimer = 0;
  private roster = new Map<string, RosterEntry>();
  private lastSnap: Snapshot | null = null;
  token: string | null = Storage.load<string | null>('netSession', null);
  rtt = 0;
  clientId = '';
  connected = false;
  profile: ProfileData | null = null;
  state: SocialState | null = null;
  room: RoomInfo | null = null;
  you: string | null = null;
  status = 'desconectado';
  onStatus: ((s: string) => void) | null = null;
  readonly url: string;

  constructor(url: string) {
    this.url = normalizeServer(url);
    this.client = new Client(this.url);
  }

  static defaultUrl(): string {
    const saved = Storage.load<string>('serverUrl', '');
    if (saved) return normalizeServer(saved);
    // no app os arquivos são locais: o endereço do servidor precisa ser informado nas configurações
    if (isNativeApp()) return '';
    return location.origin;
  }

  get loggedIn(): boolean {
    return !!this.token;
  }

  on(h: Handler): () => void {
    this.handlers.add(h);
    return () => this.handlers.delete(h);
  }

  onSocial(h: (e: SocialEvent) => void): () => void {
    this.socialHandlers.add(h);
    return () => this.socialHandlers.delete(h);
  }

  private emit(msg: ServerMsg): void {
    for (const h of this.handlers) h(msg);
  }

  private emitSocial(e: SocialEvent): void {
    for (const h of this.socialHandlers) h(e);
  }

  private setStatus(s: string): void {
    this.status = s;
    this.onStatus?.(s);
    this.emitSocial({ type: 'status', text: s });
  }

  // ------------------------------------------------------------------ conta

  private async api(path: string, body?: unknown, method = body ? 'POST' : 'GET'): Promise<any> {
    let res: Response;
    try {
      res = await fetch(this.url + path, {
        method,
        headers: { 'Content-Type': 'application/json', ...(this.token ? { Authorization: 'Bearer ' + this.token } : {}) },
        body: body ? JSON.stringify(body) : undefined
      });
    } catch {
      throw new Error('Servidor indisponível (' + this.url + ')');
    }
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error ?? 'Erro ' + res.status);
    return j;
  }

  async register(username: string, password: string): Promise<void> {
    const j = await this.api('/api/auth/register', { username, password });
    this.saveSession(j.token, j.profile);
  }

  async login(username: string, password: string): Promise<void> {
    const j = await this.api('/api/auth/login', { username, password });
    this.saveSession(j.token, j.profile);
  }

  private saveSession(token: string, profile: ProfileData): void {
    this.token = token;
    this.profile = profile;
    Storage.save('netSession', token);
  }

  async logout(): Promise<void> {
    await this.api('/api/auth/logout', {}).catch(() => {});
    this.token = null;
    Storage.remove('netSession');
    Storage.remove('netReconnect');
    this.close();
  }

  /** Envia os cosméticos escolhidos (o servidor guarda só o que o nível permite). */
  async saveCosmetics(c: Record<string, string>): Promise<void> {
    if (this.social) this.social.send('cosmetics', c);
    else if (this.token) await this.api('/api/me', { cosmetics: c }, 'PUT').catch(() => {});
  }

  // ------------------------------------------------------------------ conexão social

  async connect(): Promise<void> {
    if (this.connected && this.social) return;
    if (!this.token) throw new Error('Faça login para jogar online');
    this.setStatus('conectando…');
    try {
      this.social = await this.client.joinOrCreate('social', { token: this.token });
    } catch (e) {
      this.setStatus('desconectado');
      const msg = (e as Error).message || '';
      if (/Sess|login/i.test(msg)) {
        this.token = null;
        Storage.remove('netSession');
      }
      throw new Error(msg || 'Não foi possível conectar ao servidor ' + this.url);
    }
    this.connected = true;
    this.setStatus('conectado');
    const s = this.social;
    s.onMessage('state', (st: SocialState) => {
      this.state = st;
      this.profile = st.profile;
      this.clientId = st.me.id;
      this.emitSocial({ type: 'state', state: st });
      this.emit({ t: 'welcome', clientId: st.me.id, token: '', profile: st.profile, resumed: false });
    });
    s.onMessage('notify', m => this.emitSocial({ type: 'notify', ...m }));
    s.onMessage('presence', m => {
      const f = this.state?.friends.find(x => x.id === m.id);
      if (f) {
        f.status = m.status;
        f.roomId = m.roomId;
      }
      this.emitSocial({ type: 'presence', ...m });
    });
    s.onMessage('invite', m => {
      this.state?.invites.push({ id: m.id, from: m.from, roomId: m.roomId });
      this.emitSocial({ type: 'invite', ...m });
    });
    s.onMessage('party', p => {
      if (this.state) this.state.party = p;
      this.emitSocial({ type: 'party', party: p });
    });
    s.onMessage('party:invite', m => this.emitSocial({ type: 'party:invite', ...m }));
    s.onMessage('rooms', rooms => this.emitSocial({ type: 'rooms', rooms }));
    s.onMessage('goto', m => void this.joinGame(m.roomId, { ticket: m.ticket }).catch(e => this.emit({ t: 'error', msg: (e as Error).message })));
    s.onMessage('error', m => this.emit({ t: 'error', msg: m.msg }));
    s.onMessage('cosmetics', () => {});
    s.onLeave(() => {
      this.connected = false;
      this.social = null;
      this.setStatus('desconectado');
    });
    // voltou ao app no meio de uma partida: tenta retomar a vaga
    const rec = Storage.load<string | null>('netReconnect', null);
    if (rec && !this.game) {
      try {
        this.wireGame(await this.client.reconnect(rec));
      } catch {
        Storage.remove('netReconnect');
      }
    }
  }

  sendSocial(type: string, msg: unknown = {}): void {
    this.social?.send(type, msg);
  }

  // ------------------------------------------------------------------ sala de jogo

  async createGame(settings: Record<string, unknown>, password = ''): Promise<void> {
    await this.leaveGame();
    this.wireGame(await this.client.create('game', { token: this.token, settings, password }));
  }

  async joinGame(code: string, extra: { password?: string; ticket?: string } = {}): Promise<void> {
    if (this.game?.roomId === code) return;
    await this.leaveGame();
    this.wireGame(await this.client.joinById(code.toUpperCase(), { token: this.token, ...extra }));
  }

  async leaveGame(): Promise<void> {
    const g = this.game;
    this.game = null;
    this.room = null;
    this.you = null;
    Storage.remove('netReconnect');
    clearInterval(this.pingTimer);
    if (g) await g.leave(true).catch(() => {});
  }

  private wireGame(room: Room): void {
    this.game = room;
    this.roster.clear();
    this.lastSnap = null;
    Storage.save('netReconnect', room.reconnectionToken);
    room.onMessage('room', m => {
      this.room = m.room;
      this.you = m.you;
      this.emit({ t: 'room', room: m.room, you: m.you });
    });
    room.onMessage('start', m => {
      this.you = m.you;
      this.lastSnap = null;
      this.emit({ t: 'start', mapId: m.mapId, mode: m.mode, you: m.you });
    });
    room.onMessage('roster', (list: RosterEntry[]) => {
      this.roster.clear();
      for (const r of list) this.roster.set(r.id, r);
    });
    room.onMessage('snap', (raw: NetSnapshot) => {
      if (!this.lastSnap && !raw.round) return; // primeira atualização ainda incompleta
      const players = raw.players.map(t => decodeDyn(t, this.roster.get(t[0])));
      const s = mergeSnapshot(this.lastSnap, raw, players);
      this.lastSnap = s;
      this.emit({ t: 'snap', s });
    });
    room.onMessage('end', m => {
      if (m.profile) this.profile = m.profile;
      this.emit({ t: 'end', result: m.result, profile: m.profile });
    });
    room.onMessage('error', m => this.emit({ t: 'error', msg: m.msg }));
    room.onMessage('chat', m => this.emit({ t: 'chat', from: m.from, text: m.text }));
    room.onMessage('pong', m => {
      const r = performance.now() - m.ts;
      this.rtt = this.rtt ? this.rtt * 0.7 + r * 0.3 : r;
    });
    room.onMessage('closed', m => this.emitSocial({ type: 'closed', reason: m.reason }));
    room.onLeave(() => {
      if (this.game === room) {
        this.game = null;
        this.room = null;
        Storage.remove('netReconnect');
        clearInterval(this.pingTimer);
        this.emit({ t: 'info', msg: 'left' });
      }
    });
    room.onDrop?.(() => this.setStatus('reconectando…'));
    room.onReconnect?.(() => this.setStatus('conectado'));
    clearInterval(this.pingTimer);
    this.pingTimer = window.setInterval(() => room.send('ping', { ts: performance.now(), rtt: Math.round(this.rtt) }), 2000);
    // grupo: o líder leva os membros junto
    if (this.state?.party?.leader === this.clientId) this.sendSocial('party:follow', { roomId: room.roomId });
  }

  /** Mensagens no formato antigo (o resto do jogo continua igual). */
  send(msg: ClientMsg): void {
    switch (msg.t) {
      case 'list':
        return this.sendSocial('rooms');
      case 'quick':
        return this.sendSocial('quick', { mode: msg.mode });
      case 'create':
        void this.createGame({ mode: msg.mode, mapId: msg.mapId, difficulty: msg.difficulty, isPublic: msg.isPublic }).catch(e => this.emit({ t: 'error', msg: (e as Error).message }));
        return;
      case 'join':
        void this.joinGame(msg.code).catch(e => this.emit({ t: 'error', msg: (e as Error).message }));
        return;
      case 'leave':
        void this.leaveGame();
        return;
      case 'skins':
        void this.saveCosmetics(msg.skins);
        return;
      case 'cmd':
        this.game?.send('cmd', { c: msg.c });
        return;
      case 'team':
        this.game?.send('team', { team: msg.team });
        return;
      case 'buy':
        this.game?.send('buy', { item: msg.item });
        return;
      case 'chat':
        this.game?.send('chat', { text: msg.text });
        return;
      case 'start':
        this.game?.send('start');
        return;
      default:
        return;
    }
  }

  /** Mensagens da sala de jogo que não existem no formato antigo (configurações, expulsar, revanche...). */
  gameSend(type: string, msg: unknown = {}): void {
    this.game?.send(type, msg);
  }

  /** Acumula comandos e envia em lotes (2 por mensagem = 30 mensagens/s). */
  queueCmd(cmd: UserCmd): void {
    this.pending.push(cmd);
    if (this.pending.length >= 2) this.flushCmds();
  }

  flushCmds(): void {
    if (!this.pending.length) return;
    this.game?.send('cmd', { c: this.pending });
    this.pending = [];
  }

  close(): void {
    clearInterval(this.pingTimer);
    void this.game?.leave(true).catch(() => {});
    void this.social?.leave(true).catch(() => {});
    this.game = null;
    this.social = null;
    this.connected = false;
    this.room = null;
    this.setStatus('desconectado');
  }
}
