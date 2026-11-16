// Quem está online, em que sala está e convites/ingressos de entrada (compartilhado entre as salas).
import { randomBytes } from 'node:crypto';
import type { Client } from '@colyseus/core';

export interface Online {
  userId: string;
  name: string;
  social: Client | null;
  /** Sala de jogo atual (código). */
  roomId: string | null;
  roomState: 'lobby' | 'playing' | null;
}

export interface Ticket {
  userId: string;
  roomId: string;
  from: string;
  expires: number;
}

class Presence {
  online = new Map<string, Online>();
  private tickets = new Map<string, Ticket>();
  /** Avisado quando o status de alguém muda (para avisar os amigos). */
  onChange: ((userId: string) => void) | null = null;

  get(userId: string): Online | undefined {
    return this.online.get(userId);
  }

  setSocial(userId: string, name: string, client: Client | null): void {
    let o = this.online.get(userId);
    if (!o) {
      o = { userId, name, social: null, roomId: null, roomState: null };
      this.online.set(userId, o);
    }
    o.social = client;
    o.name = name;
    if (!client && !o.roomId) this.online.delete(userId);
    this.onChange?.(userId);
  }

  setRoom(userId: string, name: string, roomId: string | null, state: 'lobby' | 'playing' | null): void {
    let o = this.online.get(userId);
    if (!o) {
      if (!roomId) return;
      o = { userId, name, social: null, roomId: null, roomState: null };
      this.online.set(userId, o);
    }
    o.roomId = roomId;
    o.roomState = roomId ? state : null;
    if (!o.social && !roomId) this.online.delete(userId);
    this.onChange?.(userId);
  }

  status(userId: string): 'offline' | 'online' | 'na sala' | 'em partida' {
    const o = this.online.get(userId);
    if (!o) return 'offline';
    if (o.roomId) return o.roomState === 'playing' ? 'em partida' : 'na sala';
    return o.social ? 'online' : 'offline';
  }

  /** Ingresso de uso único para entrar numa sala (convite de amigo ou grupo): dispensa a senha. */
  issueTicket(userId: string, roomId: string, from: string): string {
    const id = randomBytes(18).toString('base64url');
    this.tickets.set(id, { userId, roomId, from, expires: Date.now() + 5 * 60_000 });
    if (this.tickets.size > 20_000) for (const [k, t] of this.tickets) if (t.expires < Date.now()) this.tickets.delete(k);
    return id;
  }

  useTicket(id: unknown, userId: string, roomId: string): boolean {
    if (typeof id !== 'string') return false;
    const t = this.tickets.get(id);
    if (!t || t.userId !== userId || t.roomId !== roomId || t.expires < Date.now()) return false;
    this.tickets.delete(id);
    return true;
  }
}

export const presence = new Presence();
