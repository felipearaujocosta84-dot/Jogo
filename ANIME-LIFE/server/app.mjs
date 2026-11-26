// Servidor HTTP (sem framework) do chat dos NPCs: valida, limita, monta o prompt e chama a IA.
import http from 'node:http';
import crypto from 'node:crypto';
import * as z from 'zod/v4';
import { PERSONAS, MOODS } from './personas.mjs';
import { systemPrompt, contextBlock, transcript } from './prompt.mjs';
import { Limits } from './limits.mjs';

// ---------- formatos de saída da IA ----------
// Sem limites rígidos no esquema: se a IA passar um pouco da faixa, o servidor corrige (clamp/corte)
// em vez de descartar a resposta inteira.
const Delta = z.number();
const ChatOut = z.object({
  replies: z.array(z.string()),
  mood: z.enum(MOODS),
  deltas: z.object({ amizade: Delta, confianca: Delta, carinho: Delta, afinidade: Delta, romance: Delta }),
  memories: z.array(z.object({ kind: z.enum(['fato', 'preferencia', 'promessa', 'momento']), text: z.string() })),
});
const SpontOut = z.object({ replies: z.array(z.string()), mood: z.enum(MOODS) });
const SummaryOut = z.object({ summary: z.string(), memories: z.array(z.object({ kind: z.enum(['fato', 'preferencia', 'promessa', 'momento']), text: z.string() })) });

// ---------- validação da entrada (o app nunca é confiável) ----------
const str = (n) => z.string().max(n);
const Msg = z.object({ from: z.enum(['player', 'npc']), text: str(500) });
const Context = z.object({
  deviceId: z.string().regex(/^[A-Za-z0-9-]{8,64}$/),
  characterId: z.string().refine((id) => id in PERSONAS, 'personagem desconhecido'),
  player: z.object({ name: str(40), displayName: str(20), pronouns: z.enum(['ele', 'ela', 'elu']) }),
  relationship: z.object({ amizade: z.number(), confianca: z.number(), carinho: z.number(), afinidade: z.number(), romance: z.number() }).partial(),
  mood: str(20).optional(),
  romanceStage: z.enum(['nenhum', 'interesse', 'encontro', 'namoro']).optional(),
  memories: z.array(str(160)).max(25).default([]),
  storyFacts: z.array(str(200)).max(15).default([]),
  summary: str(1500).default(''),
  history: z.array(Msg).max(14).default([]),
  localTime: str(60).default(''),
});
const ChatIn = Context.extend({ message: z.string().min(1).max(500) });
const REASONS = {
  bom_dia: 'é de manhã e você quer dar bom dia',
  boa_noite: 'é tarde da noite e você quer dar boa noite ou puxar papo antes de dormir',
  sumiu: 'o jogador não fala com você há um tempo e você percebeu',
  saudade: 'você está com saudades do jogador (só se a relação for próxima)',
  convite: 'você quer convidar o jogador para fazer algo juntos (café, terraço, passeio)',
  curiosidade: 'você lembrou de algo que o jogador contou e quer saber como está',
};
const SpontIn = Context.extend({ reason: z.enum(Object.keys(REASONS)) });
const SummaryIn = Context.extend({ older: z.array(Msg).max(40) });

export function createApp({ provider, cfg, log = console }) {
  const limits = new Limits(cfg);

  const send = (res, status, body, headers = {}) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
    res.end(JSON.stringify(body));
  };
  const cors = (req, res) => {
    const origin = req.headers.origin || '';
    const ok = cfg.allowedOrigins.includes('*') || cfg.allowedOrigins.includes(origin);
    if (ok && origin) res.setHeader('Access-Control-Allow-Origin', origin);
    else if (cfg.allowedOrigins.includes('*')) res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-App-Token');
    res.setHeader('Vary', 'Origin');
  };
  const readJson = (req) => new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > 24 * 1024) { reject(Object.assign(new Error('grande demais'), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch { reject(Object.assign(new Error('JSON inválido'), { status: 400 })); } });
    req.on('error', reject);
  });
  const ipOf = (req) => (cfg.trustProxy && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress || '?';
  const hash = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 10);

  async function handleAI(req, res, kind) {
    const ip = ipOf(req);
    if (cfg.appToken && req.headers['x-app-token'] !== cfg.appToken) return send(res, 401, { error: 'token_invalido' });
    let body;
    try { body = await readJson(req); } catch (e) { return send(res, e.status || 400, { error: 'entrada_invalida' }); }
    const schema = kind === 'chat' ? ChatIn : kind === 'spontaneous' ? SpontIn : SummaryIn;
    const parsed = schema.safeParse(body);
    if (!parsed.success) return send(res, 400, { error: 'entrada_invalida', detail: parsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`) });
    const c = parsed.data;
    const blocked = limits.check(c.deviceId, ip);
    if (blocked) return send(res, blocked.status, { error: blocked.code, retryAfter: blocked.retryAfter }, { 'Retry-After': String(blocked.retryAfter) });

    const persona = PERSONAS[c.characterId];
    const ctx = contextBlock(c);
    const npc = persona.name.split(' ')[0];
    let user, outSchema, maxTokens = 4000;
    if (kind === 'chat') {
      user = `${ctx}\n\nConversa recente:\n${transcript(c.history, c.player.displayName, npc) || '(nenhuma ainda)'}\n\nNova mensagem do jogador:\n${c.message}`;
      outSchema = ChatOut;
    } else if (kind === 'spontaneous') {
      user = `${ctx}\n\nConversa recente:\n${transcript(c.history, c.player.displayName, npc) || '(nenhuma ainda)'}\n\nVocê vai INICIAR uma conversa agora, por conta própria, porque ${REASONS[c.reason]}. Escreva só a(s) mensagem(ns) que você enviaria, curtas e no seu estilo.`;
      outSchema = SpontOut;
    } else {
      user = `${ctx}\n\nMensagens antigas para resumir:\n${transcript(c.older, c.player.displayName, npc)}\n\nAtualize o resumo das conversas (no máximo 900 caracteres, em terceira pessoa, mantendo o que importa para a relação) e extraia até 5 memórias importantes que ainda não estejam na lista.`;
      outSchema = SummaryOut;
    }

    const t0 = Date.now();
    try {
      const r = await provider.generate({ system: systemPrompt(c.characterId), user, schema: outSchema, maxTokens });
      limits.record(c.deviceId, ip, r.usage);
      log.info?.(`[${kind}] ${c.characterId} dev=${hash(c.deviceId)} ${Date.now() - t0}ms in=${r.usage.input} out=${r.usage.output} cache=${r.usage.cacheRead}`);
      const out = { ...r.output, remainingToday: limits.remaining(c.deviceId) };
      if (out.replies) out.replies = out.replies.map((t) => t.slice(0, 400)).filter(Boolean).slice(0, kind === 'chat' ? 3 : 2);
      if (out.replies && !out.replies.length) out.replies = ['...'];
      if (out.deltas) {
        for (const k of Object.keys(out.deltas)) out.deltas[k] = Math.max(-3, Math.min(3, Math.round(out.deltas[k])));
        if (!persona.romance) out.deltas.romance = 0;
      }
      if (out.summary) out.summary = out.summary.slice(0, 900);
      if (out.memories) out.memories = out.memories.slice(0, kind === 'summarize' ? 5 : 3).map((m) => ({ kind: m.kind, text: m.text.slice(0, 160) }));
      return send(res, 200, out);
    } catch (err) {
      const e = provider.classify(err);
      if (e.code === 'erro_interno') log.error?.(err);
      log.warn?.(`[${kind}] erro ${e.code} (${err?.status || ''} ${err?.message?.slice(0, 160) || ''})`);
      return send(res, e.status, { error: e.code, retryAfter: e.retryAfter }, e.retryAfter ? { 'Retry-After': String(e.retryAfter) } : {});
    }
  }

  const server = http.createServer(async (req, res) => {
    cors(req, res);
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    const url = new URL(req.url, 'http://x');
    if (req.method === 'GET' && url.pathname === '/health') {
      return send(res, 200, { ok: true, provider: provider.name, model: provider.model, characters: Object.keys(PERSONAS), limits: { perMinute: cfg.perMinute, deviceDaily: cfg.deviceDaily } });
    }
    if (req.method === 'POST' && url.pathname === '/v1/chat') return handleAI(req, res, 'chat');
    if (req.method === 'POST' && url.pathname === '/v1/spontaneous') return handleAI(req, res, 'spontaneous');
    if (req.method === 'POST' && url.pathname === '/v1/summarize') return handleAI(req, res, 'summarize');
    send(res, 404, { error: 'nao_encontrado' });
  });
  return { server, limits };
}

export function configFromEnv(env = process.env) {
  const num = (k, d) => (env[k] ? Number(env[k]) : d);
  return {
    port: num('PORT', 8787),
    provider: env.AI_PROVIDER || 'anthropic',
    model: env.AI_MODEL || 'claude-opus-5-5',
    effort: env.AI_EFFORT || 'low', // conversa casual: esforço baixo = mais rápido e barato
    fallbacks: env.AI_FALLBACKS || 'default',
    timeoutMs: num('AI_TIMEOUT_MS', 30000),
    allowedOrigins: (env.ALLOWED_ORIGINS || '*').split(',').map((s) => s.trim()),
    appToken: env.APP_TOKEN || '',
    trustProxy: env.TRUST_PROXY === '1',
    perMinute: num('RATE_PER_MINUTE', 6),
    deviceDaily: num('DEVICE_DAILY_LIMIT', 120),
    ipDaily: num('IP_DAILY_LIMIT', 400),
    globalDaily: num('GLOBAL_DAILY_LIMIT', 5000),
    dailyTokenBudget: num('DAILY_TOKEN_BUDGET', 20000000),
  };
}
