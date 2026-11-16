// Sala social (uma para todo o servidor): presença online, amigos (pedidos, aceitar, recusar, remover),
// convites de partida com ingresso de uso único, grupo de jogadores, notificações, lista de salas públicas,
// partida rápida e cosméticos (validados pelo nível guardado no servidor).
import { Room, matchMaker, type Client } from '@colyseus/core';
import { levelFor } from '../../src/save/Profile';
import { sanitizeCosmetics } from '../../src/cosmetics/Cosmetics';
import { presence } from '../presence';
import { log, metrics } from '../log';
import { cleanSettings } from './validate';
import type { Auth } from '../auth';
import type { Store, User } from '../db/Store';

export interface SocialDeps {
  auth: Auth;
  store: Store;
}

interface Invite {
  id: string;
  from: string;
  fromName: string;
  to: string;
  roomId: string;
  expires: number;
}

interface Party {
  leader: string;
  members: string[];
}

export class SocialRoom extends Room {
  static deps: SocialDeps;
  maxClients = 10_000;
  maxMessagesPerSecond = 20;
  autoDispose = false;
  private users = new Map<string, { client: Client; user: User }>(); // por sessionId
  private invites = new Map<string, Invite>();
  private partyInvites = new Map<string, { from: string; to: string; expires: number }>();
  private parties = new Map<string, Party>(); // por líder
  private memberParty = new Map<string, string>(); // membro → líder

  onCreate(): void {
    presence.onChange = userId => void this.pushPresence(userId);
    this.onMessage('friend:request', (c, m) => this.guard(c, () => this.friendRequest(c, m)));
    this.onMessage('friend:accept', (c, m) => this.guard(c, () => this.friendAccept(c, m)));
    this.onMessage('friend:decline', (c, m) => this.guard(c, () => this.friendRemove(c, m, 'recusado')));
    this.onMessage('friend:remove', (c, m) => this.guard(c, () => this.friendRemove(c, m, 'removido')));
    this.onMessage('invite', (c, m) => this.guard(c, () => this.invite(c, m)));
    this.onMessage('invite:respond', (c, m) => this.guard(c, () => this.inviteRespond(c, m)));
    this.onMessage('party:invite', (c, m) => this.guard(c, () => this.partyInvite(c, m)));
    this.onMessage('party:accept', (c, m) => this.guard(c, () => this.partyAccept(c, m)));
    this.onMessage('party:leave', c => this.guard(c, () => this.partyLeave(this.uid(c))));
    this.onMessage('party:follow', (c, m) => this.guard(c, () => this.partyFollow(c, m)));
    this.onMessage('rooms', c => this.guard(c, () => this.listRooms(c)));
    this.onMessage('quick', (c, m) => this.guard(c, () => this.quick(c, m)));
    this.onMessage('cosmetics', (c, m) => this.guard(c, () => this.cosmetics(c, m)));
    this.onMessage('refresh', c => this.guard(c, () => this.sendState(c)));
    this.onMessage('*', () => void metrics.rejectedMessages++);
    log.info('sala social pronta');
  }

  async onAuth(_c: Client, options: Record<string, unknown>): Promise<User> {
    const user = await SocialRoom.deps.auth.userFromToken(options?.token);
    if (!user) throw new Error('Sessão inválida: faça login de novo');
    return user;
  }

  async onJoin(client: Client, _o: unknown, user: User): Promise<void> {
    // a mesma conta conectada em outro aparelho: o antigo sai
    for (const [sid, u] of this.users) {
      if (u.user.id === user.id) {
        u.client.send('notify', { kind: 'session', text: 'Sua conta entrou em outro aparelho' });
        u.client.leave();
        this.users.delete(sid);
      }
    }
    this.users.set(client.sessionId, { client, user });
    presence.setSocial(user.id, user.username, client);
    await this.sendState(client);
    log.info('online', { user: user.id, name: user.username, online: this.users.size });
  }

  onLeave(client: Client): void {
    const u = this.users.get(client.sessionId);
    if (!u) return;
    this.users.delete(client.sessionId);
    if (![...this.users.values()].some(x => x.user.id === u.user.id)) {
      presence.setSocial(u.user.id, u.user.username, null);
      this.partyLeave(u.user.id);
    }
  }

  private async guard(c: Client, fn: () => unknown): Promise<void> {
    try {
      await fn();
    } catch (e) {
      log.error('erro na sala social', { err: String(e) });
      c.send('error', { msg: 'Erro no servidor' });
    }
  }

  private uid(c: Client): string {
    return this.users.get(c.sessionId)?.user.id ?? '';
  }

  private clientOf(userId: string): Client | null {
    return presence.get(userId)?.social ?? null;
  }

  private notify(userId: string, kind: string, text: string, extra: Record<string, unknown> = {}): void {
    this.clientOf(userId)?.send('notify', { kind, text, ...extra });
  }

  // ------------------------------------------------------------------ estado e presença

  private async sendState(c: Client): Promise<void> {
    const u = this.users.get(c.sessionId);
    if (!u) return;
    const { store } = SocialRoom.deps;
    const profile = await store.getProfile(u.user);
    const friends = (await store.friends(u.user.id)).map(f => ({
      id: f.user.id, name: f.user.username, code: f.user.friendCode, state: f.state,
      status: f.state === 'accepted' ? presence.status(f.user.id) : 'offline', roomId: f.state === 'accepted' ? presence.get(f.user.id)?.roomId ?? null : null
    }));
    const invites = [...this.invites.values()].filter(i => i.to === u.user.id && i.expires > Date.now()).map(i => ({ id: i.id, from: i.fromName, roomId: i.roomId }));
    c.send('state', {
      me: { id: u.user.id, name: u.user.username, code: u.user.friendCode, level: levelFor(profile.xp).level },
      profile, friends, invites, party: this.partyView(u.user.id), cosmetics: await store.getCosmetics(u.user.id)
    });
  }

  private async pushPresence(userId: string): Promise<void> {
    // avisa os amigos online que o status mudou
    const friends = await SocialRoom.deps.store.friends(userId).catch(() => []);
    const st = presence.status(userId);
    for (const f of friends) {
      if (f.state !== 'accepted') continue;
      this.clientOf(f.user.id)?.send('presence', { id: userId, status: st, roomId: presence.get(userId)?.roomId ?? null });
    }
  }

  // ------------------------------------------------------------------ amigos

  private async friendRequest(c: Client, raw: unknown): Promise<void> {
    const me = this.uid(c);
    const q = String((raw as { query?: unknown })?.query ?? '').trim().slice(0, 32);
    const { store } = SocialRoom.deps;
    const target = /^OS-/i.test(q) ? await store.userByCode(q) : await store.userByName(q);
    if (!target) return void c.send('error', { msg: 'Jogador não encontrado (use o nome ou o código OS-XXXXXX)' });
    if (target.id === me) return void c.send('error', { msg: 'Esse é você' });
    const st = await store.requestFriend(me, target.id);
    const meName = this.users.get(c.sessionId)!.user.username;
    if (st === 'accepted') {
      this.notify(target.id, 'friend', `${meName} agora é seu amigo`);
      c.send('notify', { kind: 'friend', text: `${target.username} agora é seu amigo` });
    } else {
      this.notify(target.id, 'friend-request', `${meName} quer ser seu amigo`, { from: me });
      c.send('notify', { kind: 'friend', text: `Pedido enviado para ${target.username}` });
    }
    await this.refresh(me);
    await this.refresh(target.id);
  }

  private async friendAccept(c: Client, raw: unknown): Promise<void> {
    const me = this.uid(c);
    const other = String((raw as { userId?: unknown })?.userId ?? '');
    if (!(await SocialRoom.deps.store.acceptFriend(me, other))) return void c.send('error', { msg: 'Pedido não encontrado' });
    this.notify(other, 'friend', `${this.users.get(c.sessionId)!.user.username} aceitou seu pedido de amizade`);
    await this.refresh(me);
    await this.refresh(other);
  }

  private async friendRemove(c: Client, raw: unknown, what: string): Promise<void> {
    const me = this.uid(c);
    const other = String((raw as { userId?: unknown })?.userId ?? '');
    await SocialRoom.deps.store.removeFriend(me, other);
    c.send('notify', { kind: 'friend', text: `Pedido/amizade ${what}` });
    await this.refresh(me);
    await this.refresh(other);
  }

  private async refresh(userId: string): Promise<void> {
    const c = this.clientOf(userId);
    if (c) await this.sendState(c);
  }

  // ------------------------------------------------------------------ convites de partida

  private async invite(c: Client, raw: unknown): Promise<void> {
    const me = this.users.get(c.sessionId)!.user;
    const to = String((raw as { userId?: unknown })?.userId ?? '');
    const where = presence.get(me.id)?.roomId;
    if (!where) return void c.send('error', { msg: 'Entre numa sala antes de convidar' });
    if (!(await SocialRoom.deps.store.areFriends(me.id, to))) return void c.send('error', { msg: 'Só é possível convidar amigos' });
    if (!this.clientOf(to)) return void c.send('error', { msg: 'Seu amigo está offline' });
    const rooms = await matchMaker.query({ roomId: where });
    if (!rooms.length) return void c.send('error', { msg: 'Sala não encontrada' });
    const id = Math.random().toString(36).slice(2, 10);
    const inv: Invite = { id, from: me.id, fromName: me.username, to, roomId: where, expires: Date.now() + 5 * 60_000 };
    this.invites.set(id, inv);
    const md = rooms[0].metadata as Record<string, unknown>;
    this.clientOf(to)!.send('invite', { id, from: me.username, roomId: where, mode: md?.mode, mapName: md?.mapName });
    c.send('notify', { kind: 'invite', text: 'Convite enviado' });
  }

  private inviteRespond(c: Client, raw: unknown): void {
    const me = this.uid(c);
    const r = raw as { id?: unknown; accept?: unknown };
    const inv = this.invites.get(String(r?.id ?? ''));
    if (!inv || inv.to !== me || inv.expires < Date.now()) return void c.send('error', { msg: 'Convite expirado' });
    this.invites.delete(inv.id);
    const name = this.users.get(c.sessionId)!.user.username;
    if (r.accept === true) {
      // ingresso de uso único: entra mesmo em sala com senha
      c.send('goto', { roomId: inv.roomId, ticket: presence.issueTicket(me, inv.roomId, inv.from) });
      this.notify(inv.from, 'invite', `${name} aceitou o convite`);
    } else this.notify(inv.from, 'invite', `${name} recusou o convite`);
  }

  // ------------------------------------------------------------------ grupo

  private partyView(userId: string): { leader: string; members: { id: string; name: string; status: string }[] } | null {
    const leader = this.memberParty.get(userId) ?? (this.parties.has(userId) ? userId : null);
    const p = leader ? this.parties.get(leader) : null;
    if (!p) return null;
    return { leader: p.leader, members: p.members.map(id => ({ id, name: presence.get(id)?.name ?? '?', status: presence.status(id) })) };
  }

  private pushParty(p: Party): void {
    for (const id of p.members) this.clientOf(id)?.send('party', this.partyView(id));
  }

  private async partyInvite(c: Client, raw: unknown): Promise<void> {
    const me = this.users.get(c.sessionId)!.user;
    const to = String((raw as { userId?: unknown })?.userId ?? '');
    if (!(await SocialRoom.deps.store.areFriends(me.id, to))) return void c.send('error', { msg: 'Só amigos entram no grupo' });
    if (!this.clientOf(to)) return void c.send('error', { msg: 'Seu amigo está offline' });
    const lead = this.memberParty.get(me.id) ?? me.id;
    if (lead !== me.id) return void c.send('error', { msg: 'Só o líder convida para o grupo' });
    if ((this.parties.get(me.id)?.members.length ?? 1) >= 5) return void c.send('error', { msg: 'Grupo cheio (5)' });
    const id = Math.random().toString(36).slice(2, 10);
    this.partyInvites.set(id, { from: me.id, to, expires: Date.now() + 2 * 60_000 });
    this.clientOf(to)!.send('party:invite', { id, from: me.username });
  }

  private partyAccept(c: Client, raw: unknown): void {
    const me = this.uid(c);
    const inv = this.partyInvites.get(String((raw as { id?: unknown })?.id ?? ''));
    if (!inv || inv.to !== me || inv.expires < Date.now()) return void c.send('error', { msg: 'Convite de grupo expirado' });
    this.partyInvites.delete(String((raw as { id?: unknown }).id));
    this.partyLeave(me);
    let p = this.parties.get(inv.from);
    if (!p) {
      p = { leader: inv.from, members: [inv.from] };
      this.parties.set(inv.from, p);
    }
    if (!p.members.includes(me)) p.members.push(me);
    this.memberParty.set(me, inv.from);
    this.pushParty(p);
  }

  private partyLeave(userId: string): void {
    if (!userId) return;
    const own = this.parties.get(userId);
    if (own) {
      // líder saiu: o grupo acaba
      this.parties.delete(userId);
      for (const id of own.members) {
        this.memberParty.delete(id);
        if (id !== userId) this.clientOf(id)?.send('party', null);
      }
      this.clientOf(userId)?.send('party', null);
      return;
    }
    const lead = this.memberParty.get(userId);
    if (!lead) return;
    this.memberParty.delete(userId);
    const p = this.parties.get(lead);
    if (p) {
      p.members = p.members.filter(x => x !== userId);
      if (p.members.length <= 1) {
        this.parties.delete(lead);
        this.clientOf(lead)?.send('party', null);
      } else this.pushParty(p);
    }
    this.clientOf(userId)?.send('party', null);
  }

  /** O líder entrou numa sala: leva o grupo junto (ingressos individuais). */
  private partyFollow(c: Client, raw: unknown): void {
    const me = this.uid(c);
    const p = this.parties.get(me);
    const roomId = String((raw as { roomId?: unknown })?.roomId ?? '');
    if (!p || presence.get(me)?.roomId !== roomId) return;
    for (const id of p.members) if (id !== me) this.clientOf(id)?.send('goto', { roomId, ticket: presence.issueTicket(id, roomId, me), party: true });
  }

  // ------------------------------------------------------------------ salas

  private async listRooms(c: Client): Promise<void> {
    const rooms = await matchMaker.query({ name: 'game' });
    c.send('rooms', rooms
      .filter(r => (r.metadata as Record<string, unknown>)?.isPublic)
      .slice(0, 60)
      .map(r => ({ code: r.roomId, clients: r.clients, max: r.maxClients, ...(r.metadata as Record<string, unknown>) })));
  }

  /** Partida rápida: sala pública aberta do modo (ou cria uma que começa sozinha). */
  private async quick(c: Client, raw: unknown): Promise<void> {
    const mode = String((raw as { mode?: unknown })?.mode ?? 'competitive');
    const settings = cleanSettings({ mode, isPublic: true, bots: true, maxPlayers: mode === 'br' ? 30 : 10 });
    const rooms = await matchMaker.query({ name: 'game' });
    const open = rooms.find(r => {
      const md = r.metadata as Record<string, unknown>;
      return md?.auto && md.mode === settings.mode && md.state === 'lobby' && !r.locked && r.clients < r.maxClients;
    });
    const roomId = open ? open.roomId : (await matchMaker.createRoom('game', { settings, auto: true })).roomId;
    c.send('goto', { roomId });
  }

  private async cosmetics(c: Client, raw: unknown): Promise<void> {
    const u = this.users.get(c.sessionId)!.user;
    const { store } = SocialRoom.deps;
    const profile = await store.getProfile(u);
    // o nível vem do servidor: itens acima do nível são descartados
    const clean = sanitizeCosmetics(raw, levelFor(profile.xp).level);
    await store.saveCosmetics(u.id, clean);
    c.send('cosmetics', clean);
  }
}
