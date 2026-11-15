// Conexão WebSocket com o servidor: identificação, salas, matchmaking, envio de comandos em lote,
// medição de ping e reconexão automática (o servidor devolve o mesmo jogador dentro de 2 minutos).
import type { ClientMsg, RoomInfo, ServerMsg } from './Protocol';
import type { ProfileData } from '../save/Profile';
import type { UserCmd } from '../sim/types';
import { Storage } from '../save/Storage';
import { isNativeApp } from '../core/Platform';

type Handler = (msg: ServerMsg) => void;

export class NetClient {
  private ws: WebSocket | null = null;
  private handlers = new Set<Handler>();
  private pending: UserCmd[] = [];
  private token: string | null = Storage.load<string | null>('netToken', null);
  private pingTimer = 0;
  private reconnectTries = 0;
  private closedByUser = false;
  rtt = 0;
  clientId = '';
  connected = false;
  profile: ProfileData | null = null;
  room: RoomInfo | null = null;
  you: string | null = null;
  status = 'desconectado';
  onStatus: ((s: string) => void) | null = null;

  constructor(public url: string, private name: string, private profileId: string) {}

  static defaultUrl(): string {
    const saved = Storage.load<string>('serverUrl', '');
    if (saved) return saved;
    // no app os arquivos são locais: o endereço do servidor precisa ser informado nas configurações
    if (isNativeApp()) return '';
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${location.host}/ws`;
  }

  on(h: Handler): () => void {
    this.handlers.add(h);
    return () => this.handlers.delete(h);
  }

  private setStatus(s: string): void {
    this.status = s;
    this.onStatus?.(s);
  }

  connect(): Promise<void> {
    this.closedByUser = false;
    return new Promise((resolve, reject) => {
      let settled = false;
      try {
        this.ws = new WebSocket(this.url);
      } catch (e) {
        reject(e);
        return;
      }
      this.setStatus('conectando…');
      const ws = this.ws;
      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          ws.close();
          reject(new Error('Tempo esgotado ao conectar ao servidor'));
        }
      }, 6000);
      ws.onopen = () => {
        this.raw({ t: 'hello', name: this.name, profileId: this.profileId, token: this.token ?? undefined });
      };
      ws.onmessage = ev => {
        let msg: ServerMsg;
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }
        if (msg.t === 'welcome') {
          this.connected = true;
          this.reconnectTries = 0;
          this.token = msg.token;
          this.clientId = msg.clientId;
          Storage.save('netToken', msg.token);
          this.profile = msg.profile;
          this.setStatus('conectado');
          clearInterval(this.pingTimer);
          this.pingTimer = window.setInterval(() => this.raw({ t: 'ping', ts: performance.now(), rtt: Math.round(this.rtt) }), 2000);
          if (!settled) {
            settled = true;
            clearTimeout(timeout);
            resolve();
          }
        } else if (msg.t === 'pong') {
          const r = performance.now() - msg.ts;
          this.rtt = this.rtt ? this.rtt * 0.7 + r * 0.3 : r;
        } else if (msg.t === 'room') {
          this.room = msg.room;
          this.you = msg.you;
        } else if (msg.t === 'end' && msg.profile) {
          this.profile = msg.profile;
        }
        for (const h of this.handlers) h(msg);
      };
      ws.onerror = () => {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          reject(new Error('Não foi possível conectar ao servidor ' + this.url));
        }
      };
      ws.onclose = () => {
        const was = this.connected;
        this.connected = false;
        clearInterval(this.pingTimer);
        if (this.closedByUser) {
          this.setStatus('desconectado');
          return;
        }
        if (was || this.reconnectTries > 0) this.scheduleReconnect();
        else this.setStatus('desconectado');
      };
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTries > 10) {
      this.setStatus('conexão perdida');
      return;
    }
    const delay = Math.min(8000, 500 * Math.pow(1.6, this.reconnectTries++));
    this.setStatus(`reconectando… (${this.reconnectTries})`);
    setTimeout(() => {
      if (!this.closedByUser) this.connect().catch(() => this.scheduleReconnect());
    }, delay);
  }

  private raw(msg: ClientMsg): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  send(msg: ClientMsg): void {
    this.raw(msg);
  }

  /** Acumula comandos e envia em lotes (2 por mensagem = 30 mensagens/s). */
  queueCmd(cmd: UserCmd): void {
    this.pending.push(cmd);
    if (this.pending.length >= 2) this.flushCmds();
  }

  flushCmds(): void {
    if (!this.pending.length) return;
    this.raw({ t: 'cmd', c: this.pending });
    this.pending = [];
  }

  close(): void {
    this.closedByUser = true;
    clearInterval(this.pingTimer);
    this.ws?.close();
    this.ws = null;
    this.connected = false;
    this.room = null;
  }
}
