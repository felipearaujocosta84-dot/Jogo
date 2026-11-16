// Configuração do servidor pelas variáveis de ambiente (nada de senhas no código; ver .env.example).
import { resolve } from 'node:path';

function num(name: string, def: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && process.env[name] !== '' && process.env[name] !== undefined ? v : def;
}

export const config = {
  port: num('PORT', 8080),
  host: process.env.HOST ?? '0.0.0.0',
  /** postgres://usuario:senha@host:5432/banco — vazio = banco em memória (só para desenvolvimento). */
  databaseUrl: process.env.DATABASE_URL ?? '',
  /** Origens permitidas para a API (vírgula). O app Android usa https://localhost (Capacitor). */
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? 'https://localhost,capacitor://localhost,http://localhost,http://localhost:5173,http://localhost:4173')
    .split(',').map(s => s.trim()).filter(Boolean),
  /** Dias de validade da sessão de login. */
  sessionDays: num('SESSION_DAYS', 30),
  /** Pasta com o jogo compilado (npm run build). */
  staticDir: resolve(process.cwd(), process.env.STATIC_DIR ?? 'dist'),
  logLevel: (process.env.LOG_LEVEL ?? 'info') as 'debug' | 'info' | 'warn' | 'error',
  /** Atrás de um proxy (Caddy/nginx): usa X-Forwarded-For para o IP real. */
  trustProxy: process.env.TRUST_PROXY === '1',
  /** Segundos que uma vaga espera o jogador voltar após cair. */
  reconnectSeconds: num('RECONNECT_SECONDS', 60),
  /** Teste: aceita cadastro sem limites de taxa (nunca use em produção). */
  testMode: process.env.OS_TEST_MODE === '1'
};
