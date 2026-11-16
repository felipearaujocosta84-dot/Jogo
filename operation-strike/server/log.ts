// Logs em JSON (uma linha por evento: fácil de ler com journalctl / jq) e métricas simples do servidor.
import { config } from './config';

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 } as const;
type Level = keyof typeof LEVELS;

function out(level: Level, msg: string, data?: Record<string, unknown>): void {
  if (LEVELS[level] < LEVELS[config.logLevel]) return;
  const line = JSON.stringify({ t: new Date().toISOString(), level, msg, ...data });
  if (level === 'error' || level === 'warn') process.stderr.write(line + '\n');
  else process.stdout.write(line + '\n');
}

export const log = {
  debug: (m: string, d?: Record<string, unknown>) => out('debug', m, d),
  info: (m: string, d?: Record<string, unknown>) => out('info', m, d),
  warn: (m: string, d?: Record<string, unknown>) => out('warn', m, d),
  error: (m: string, d?: Record<string, unknown>) => out('error', m, d)
};

/** Contadores para /api/status. */
export const metrics = {
  startedAt: Date.now(),
  logins: 0,
  loginFailures: 0,
  registrations: 0,
  rejectedMessages: 0,
  rateLimited: 0,
  reconnections: 0,
  matchesFinished: 0,
  bytesSent: 0,
  /** Por sala: tempo médio do passo de simulação (ms). */
  tickMs: new Map<string, number>()
};
