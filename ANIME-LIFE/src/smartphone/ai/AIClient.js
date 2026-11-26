// Cliente do servidor de IA. O app NUNCA tem a chave da API: só o endereço do servidor seguro
// (Ajustes → Celular e IA). Sem servidor configurado, o chat usa o modo local (LocalBrain).
import { settings } from '../../save/Settings.js';

const DEVICE_KEY = 'anime-life.deviceId';
export function deviceId() {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) { id = (crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^A-Za-z0-9-]/g, ''); localStorage.setItem(DEVICE_KEY, id); }
    return id;
  } catch { return 'aparelho-sem-armazenamento'; }
}

export class AIError extends Error {
  constructor(code, { retryAfter = 0, offline = false } = {}) { super(code); this.code = code; this.retryAfter = retryAfter; this.offline = offline; }
}

const MESSAGES = {
  ia_ocupada: 'A IA está ocupada agora. Tente de novo em alguns segundos.',
  muitas_mensagens: 'Muitas mensagens em pouco tempo. Espere um pouco.',
  limite_diario_aparelho: 'Você atingiu o limite de mensagens de hoje.',
  limite_diario_ip: 'Limite de mensagens de hoje atingido nesta rede.',
  limite_global_diario: 'O servidor atingiu o limite de hoje.',
  orcamento_diario_esgotado: 'O orçamento de IA de hoje acabou.',
  recusado: 'O personagem preferiu não responder isso.',
  sem_conexao: 'Sem conexão com o servidor de IA.',
  ia_demorou: 'A IA demorou demais para responder.',
  servidor_mal_configurado: 'O servidor de IA está mal configurado (chave da API).',
  token_invalido: 'O app não foi autorizado pelo servidor.',
};
export const errorText = (code) => MESSAGES[code] || 'Não foi possível enviar agora.';

export const AIClient = {
  get url() { return (settings.data.aiServer || '').trim().replace(/\/+$/, ''); },
  get configured() { return !!this.url; },

  async request(path, body, timeoutMs = 40000) {
    if (!this.configured) throw new AIError('sem_servidor');
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let res;
    try {
      res = await fetch(`${this.url}${path}`, {
        method: path === '/health' ? 'GET' : 'POST', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', ...(settings.data.aiToken ? { 'X-App-Token': settings.data.aiToken } : {}) },
        body: path === '/health' ? undefined : JSON.stringify({ deviceId: deviceId(), ...body }),
      });
    } catch (e) {
      throw new AIError(e.name === 'AbortError' ? 'ia_demorou' : 'sem_conexao', { offline: !navigator.onLine });
    } finally { clearTimeout(timer); }
    let data = null;
    try { data = await res.json(); } catch {}
    if (!res.ok) throw new AIError(data?.error || `http_${res.status}`, { retryAfter: data?.retryAfter || 0 });
    return data;
  },

  health() { return this.request('/health', null, 8000); },
  chat(ctx) { return this.request('/v1/chat', ctx); },
  spontaneous(ctx) { return this.request('/v1/spontaneous', ctx); },
  summarize(ctx) { return this.request('/v1/summarize', ctx, 45000); },
};
