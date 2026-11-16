// Ferramentas dos testes de rede: sobe o servidor de verdade (com PostgreSQL se DATABASE_URL estiver definido)
// e cria clientes Colyseus reais (WebSocket), cada um com sua conta.
import { Client, type Room } from '@colyseus/sdk';
import { decodeDyn, mergeSnapshot, type NetSnapshot, type RosterEntry } from '../../src/multiplayer/NetCodec';
import type { PlayerView } from '../../src/sim/types';

/** Atualização já completada com os campos que só vêm quando mudam. */
export type FullSnap = NetSnapshot & Required<Pick<NetSnapshot, 'round' | 'bomb'>>;

export const results: { name: string; ok: boolean; detail: string }[] = [];
export function check(name: string, ok: boolean, detail = ''): void {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✔' : '✖'} ${name}${detail ? ' — ' + detail : ''}`);
}
export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function waitFor<T>(fn: () => T | undefined | null | false, ms = 8000, step = 25): Promise<T> {
  const t0 = Date.now();
  for (;;) {
    const v = fn();
    if (v) return v as T;
    if (Date.now() - t0 > ms) throw new Error('tempo esgotado esperando condição');
    await sleep(step);
  }
}

export class TestPlayer {
  token = '';
  userId = '';
  code = '';
  client: Client;
  social: Room | null = null;
  game: Room | null = null;
  snaps: FullSnap[] = [];
  roster = new Map<string, RosterEntry>();
  events: Record<string, unknown>[] = [];
  socialMsgs: { type: string; m: any }[] = [];
  room: any = null;
  you = '';
  started = 0;
  ended: any = null;
  errors: string[] = [];
  bytes = 0;
  seq = 0;
  constructor(public base: string, public name: string) {
    this.client = new Client(base);
  }

  async register(password = 'senha-forte-1'): Promise<void> {
    const r = await fetch(this.base + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: this.name, password }) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error);
    this.token = j.token;
    this.userId = j.user.id;
    this.code = j.user.friendCode;
  }

  async connectSocial(): Promise<void> {
    this.social = await this.client.joinOrCreate('social', { token: this.token });
    this.social.onMessage('*', (type, m) => this.socialMsgs.push({ type: String(type), m }));
    await waitFor(() => this.socialMsgs.some(x => x.type === 'state'));
  }

  lastSocial(type: string): any {
    return [...this.socialMsgs].reverse().find(x => x.type === type)?.m;
  }

  private wire(room: Room): void {
    this.game = room;
    room.onMessage('room', m => {
      this.room = m.room;
      this.you = m.you;
    });
    room.onMessage('start', m => {
      this.started++;
      this.you = m.you;
    });
    room.onMessage('snap', (raw: NetSnapshot) => {
      // completa os campos que só vêm quando mudam
      const prev = this.snaps[this.snaps.length - 1] ?? null;
      const s = { ...raw, round: raw.round ?? prev?.round, bomb: raw.bomb ?? prev?.bomb, doors: raw.doors ?? prev?.doors, you: 'you' in raw && raw.you !== undefined ? raw.you : prev?.you } as FullSnap;
      void mergeSnapshot;
      this.snaps.push(s);
      if (this.snaps.length > 600) this.snaps.shift();
      for (const e of s.events) this.events.push(e);
    });
    room.onMessage('roster', (r: RosterEntry[]) => {
      for (const e of r) this.roster.set(e.id, e);
    });
    room.onMessage('end', m => (this.ended = m));
    room.onMessage('error', m => this.errors.push(m.msg));
    room.onMessage('*', () => {});
  }

  async create(opts: Record<string, unknown>): Promise<Room> {
    const r = await this.client.create('game', { token: this.token, ...opts });
    this.wire(r);
    return r;
  }

  async join(code: string, opts: Record<string, unknown> = {}): Promise<Room> {
    const r = await this.client.joinById(code, { token: this.token, ...opts });
    this.wire(r);
    return r;
  }

  latest(): FullSnap | null {
    return this.snaps[this.snaps.length - 1] ?? null;
  }

  player(id: string, s = this.latest()): PlayerView | null {
    const t = s?.players.find(p => p[0] === id);
    return t ? decodeDyn(t, this.roster.get(id)) : null;
  }

  cmd(c: { mx?: number; my?: number; yaw?: number; pitch?: number; buttons?: number; sel?: number }, n = 2): void {
    const list = [];
    for (let i = 0; i < n; i++) list.push({ seq: ++this.seq, mx: c.mx ?? 0, my: c.my ?? 0, yaw: c.yaw ?? 0, pitch: c.pitch ?? 0, buttons: c.buttons ?? 0, sel: c.sel ?? 0, rt: this.latest()?.tick });
    this.game?.send('cmd', { c: list });
  }
}

export function summary(): number {
  const fail = results.filter(r => !r.ok);
  console.log(`\n${results.length - fail.length}/${results.length} verificações passaram`);
  return fail.length ? 1 : 0;
}
