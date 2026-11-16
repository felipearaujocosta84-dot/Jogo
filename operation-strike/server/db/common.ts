import { randomInt } from 'node:crypto';
export type { FriendState, Store, User } from './Store';

/** Código de amigo legível (sem letras/números parecidos). */
export function friendCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = 'OS-';
  for (let i = 0; i < 6; i++) s += chars[randomInt(chars.length)];
  return s;
}
