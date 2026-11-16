// Convidado da partida em Wi-Fi local: conecta no celular anfitrião (ws://IP:8787), recebe a sala de espera e
// depois as atualizações da partida. Mesma interface que a sessão online usa (predição + interpolação).
import type { ClientMsg, ServerMsg } from '../Protocol';
import type { SessionNet } from '../../core/Session';
import type { ProfileData } from '../../save/Profile';
import type { Snapshot, UserCmd } from '../../sim/types';
import { decodeDyn, mergeSnapshot, type RosterEntry } from '../NetCodec';
import type { LanHostMsg, LanPlayer } from './LanHost';
import type { RoomSettings } from '../../../server/rooms/validate';

export class LanClient implements SessionNet {
  profile: ProfileData | null = null;
  rtt = 0;
  players: LanPlayer[] = [];
  settings: RoomSettings | null = null;
  you = '';
  connected = false;
  private ws: WebSocket | null = null;
  private handlers = new Set<(m: ServerMsg) => void>();
  private pending: UserCmd[] = [];
  private roster = new Map<string, RosterEntry>();
  private last: Snapshot | null = null;
  private pingTimer = 0;
  onLobby: () => void = () => {};
  onClosed: (reason: string) => void = () => {};

  constructor(private name: string, private skins: Record<string, string>) {}

  connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      let done = false;
      const ws = new WebSocket(url);
      this.ws = ws;
      const timer = setTimeout(() => {
        if (!done) {
          done = true;
          ws.close();
          reject(new Error('Sem resposta do anfitrião. Confira o IP e se estão na mesma rede Wi-Fi.'));
        }
      }, 6000);
      ws.onopen = () => {
        done = true;
        clearTimeout(timer);
        this.connected = true;
        ws.send(JSON.stringify({ t: 'hello', name: this.name, skins: this.skins }));
        clearInterval(this.pingTimer);
        this.pingTimer = window.setInterval(() => this.raw({ t: 'ping', ts: performance.now(), rtt: Math.round(this.rtt) }), 2000);
        resolve();
      };
      ws.onerror = () => {
        if (!done) {
          done = true;
          clearTimeout(timer);
          reject(new Error('Não foi possível conectar em ' + url));
        }
      };
      ws.onclose = () => {
        const was = this.connected;
        this.connected = false;
        clearInterval(this.pingTimer);
        if (was) this.onClosed('Conexão com o anfitrião perdida');
      };
      ws.onmessage = ev => this.onMessage(String(ev.data));
    });
  }

  private raw(m: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
  }

  private onMessage(data: string): void {
    let m: LanHostMsg;
    try {
      m = JSON.parse(data);
    } catch {
      return;
    }
    switch (m.t) {
      case 'lobby':
        this.players = m.players;
        this.settings = m.settings;
        this.you = m.you;
        this.onLobby();
        break;
      case 'start':
        this.you = m.you;
        this.last = null;
        this.emit({ t: 'start', mapId: m.mapId, mode: m.mode as import('../../sim/types').GameMode, you: m.you });
        break;
      case 'roster':
        this.roster.clear();
        for (const r of m.r) this.roster.set(r.id, r);
        break;
      case 'snap': {
        const raw = m.s;
        if (!this.last && !raw.round) return;
        const s = mergeSnapshot(this.last, raw, raw.players.map(t => decodeDyn(t, this.roster.get(t[0]))));
        this.last = s;
        this.emit({ t: 'snap', s });
        break;
      }
      case 'end':
        this.emit({ t: 'end', result: m.result as never, profile: null });
        break;
      case 'pong': {
        const r = performance.now() - m.ts;
        this.rtt = this.rtt ? this.rtt * 0.7 + r * 0.3 : r;
        break;
      }
      case 'chat':
        this.emit({ t: 'chat', from: m.from, text: m.text });
        break;
      case 'error':
        this.emit({ t: 'error', msg: m.msg });
        break;
      case 'closed':
        this.connected = false;
        this.onClosed(m.reason);
        this.ws?.close();
        break;
    }
  }

  private emit(m: ServerMsg): void {
    for (const h of this.handlers) h(m);
  }

  on(h: (msg: ServerMsg) => void): () => void {
    this.handlers.add(h);
    return () => this.handlers.delete(h);
  }

  send(msg: ClientMsg): void {
    if (msg.t === 'buy') this.raw({ t: 'buy', item: msg.item });
    else if (msg.t === 'team') this.raw({ t: 'team', team: msg.team });
    else if (msg.t === 'chat') this.raw({ t: 'chat', text: msg.text });
  }

  queueCmd(cmd: UserCmd): void {
    this.pending.push(cmd);
    if (this.pending.length >= 2) {
      this.raw({ t: 'cmd', c: this.pending });
      this.pending = [];
    }
  }

  close(): void {
    this.connected = false;
    clearInterval(this.pingTimer);
    this.ws?.close();
    this.ws = null;
  }
}
