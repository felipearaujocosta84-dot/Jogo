// Transporte do anfitrião no Wi-Fi local: no app Android usa o plugin nativo "LanServer" (servidor WebSocket
// no próprio celular). Para testes automáticos no navegador existe um "repetidor" WebSocket que imita o plugin.
import { registerPlugin, Capacitor } from '@capacitor/core';
import { Storage } from '../../save/Storage';

export interface HostTransport {
  start(port: number, maxClients: number): Promise<{ port: number; ips: string[] }>;
  send(id: number, data: string): void;
  kick(id: number): void;
  stop(): Promise<void>;
  onOpen: (id: number, addr: string) => void;
  onMessage: (id: number, data: string) => void;
  onClose: (id: number) => void;
}

interface LanServerPlugin {
  start(o: { port: number; maxClients: number }): Promise<{ port: number; ips: string[] }>;
  send(o: { id: number; data: string }): Promise<void>;
  kick(o: { id: number }): Promise<void>;
  stop(): Promise<void>;
  addListener(ev: 'open' | 'message' | 'close' | 'error', cb: (e: any) => void): Promise<{ remove: () => Promise<void> }>;
}

const LanServer = registerPlugin<LanServerPlugin>('LanServer');

/** Hospedar é possível? (app Android com o plugin, ou o repetidor de teste) */
export function canHost(): boolean {
  return Capacitor.isNativePlatform() || !!Storage.load<string>('lanRelay', '');
}

class NativeTransport implements HostTransport {
  onOpen: HostTransport['onOpen'] = () => {};
  onMessage: HostTransport['onMessage'] = () => {};
  onClose: HostTransport['onClose'] = () => {};
  private subs: { remove: () => Promise<void> }[] = [];

  async start(port: number, maxClients: number) {
    await this.stop();
    this.subs.push(await LanServer.addListener('open', e => this.onOpen(e.id, e.addr)));
    this.subs.push(await LanServer.addListener('message', e => this.onMessage(e.id, e.data)));
    this.subs.push(await LanServer.addListener('close', e => this.onClose(e.id)));
    return LanServer.start({ port, maxClients });
  }
  send(id: number, data: string) {
    void LanServer.send({ id, data });
  }
  kick(id: number) {
    void LanServer.kick({ id });
  }
  async stop() {
    for (const s of this.subs) await s.remove();
    this.subs = [];
    await LanServer.stop().catch(() => {});
  }
}

/** Repetidor de teste: um servidor WebSocket externo faz o papel do plugin (só para testes automáticos). */
class RelayTransport implements HostTransport {
  onOpen: HostTransport['onOpen'] = () => {};
  onMessage: HostTransport['onMessage'] = () => {};
  onClose: HostTransport['onClose'] = () => {};
  private ws: WebSocket | null = null;
  constructor(private url: string) {}
  start(port: number) {
    return new Promise<{ port: number; ips: string[] }>((res, rej) => {
      const ws = new WebSocket(this.url + '/h');
      this.ws = ws;
      ws.onopen = () => res({ port, ips: [new URL(this.url).host] });
      ws.onerror = () => rej(new Error('repetidor indisponível'));
      ws.onmessage = ev => {
        const m = JSON.parse(String(ev.data));
        if (m.ev === 'open') this.onOpen(m.id, '');
        else if (m.ev === 'message') this.onMessage(m.id, m.data);
        else if (m.ev === 'close') this.onClose(m.id);
      };
    });
  }
  send(id: number, data: string) {
    this.ws?.send(JSON.stringify({ send: id, data }));
  }
  kick(id: number) {
    this.ws?.send(JSON.stringify({ kick: id }));
  }
  async stop() {
    this.ws?.close();
    this.ws = null;
  }
}

export function makeHostTransport(): HostTransport {
  const relay = Storage.load<string>('lanRelay', '');
  return relay && !Capacitor.isNativePlatform() ? new RelayTransport(relay) : new NativeTransport();
}

/** Endereço que o convidado usa para entrar (no teste: o repetidor). */
export function clientUrl(ip: string, port: number): string {
  const relay = Storage.load<string>('lanRelay', '');
  if (relay && !Capacitor.isNativePlatform()) return relay + '/c';
  return `ws://${ip}:${port}`;
}
