// Provedor: Claude (Anthropic), pelo SDK oficial. A chave vem do ambiente do SERVIDOR
// (ANTHROPIC_API_KEY) — nunca do app.
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

// Modelos que aceitam o parâmetro server-side "fallbacks" (resgate automático em caso de recusa)
const FALLBACK_MODELS = new Set(['claude-opus-5-5', 'claude-opus-5', 'claude-sonnet-5-5', 'claude-fable-5-2', 'claude-fable-5-1']);

export class RefusalError extends Error {}
export class BadOutputError extends Error {}

export function createAnthropicProvider(cfg, { fetchImpl } = {}) {
  const client = new Anthropic({ timeout: cfg.timeoutMs, maxRetries: 2, ...(fetchImpl ? { fetch: fetchImpl, apiKey: 'teste' } : {}) });
  const useFallbacks = cfg.fallbacks === 'default' && FALLBACK_MODELS.has(cfg.model);

  return {
    name: 'anthropic',
    model: cfg.model,
    /** Gera uma resposta estruturada. schema = objeto zod. */
    async generate({ system, user, schema, maxTokens = 4000 }) {
      const params = {
        model: cfg.model,
        max_tokens: maxTokens,
        system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: user }],
        output_config: { effort: cfg.effort, format: zodOutputFormat(schema) },
      };
      if (useFallbacks) Object.assign(params, { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' });
      let msg;
      try { msg = await client.beta.messages.parse(params); } catch (e) {
        // erro do SDK que não veio da API (ex.: JSON fora do esquema) = resposta inválida
        if (e instanceof Anthropic.AnthropicError && !(e instanceof Anthropic.APIError)) throw new BadOutputError(e.message);
        throw e;
      }
      if (msg.stop_reason === 'refusal') throw new RefusalError(msg.stop_details?.category || 'refusal');
      if (msg.stop_reason === 'max_tokens' || !msg.parsed_output) throw new BadOutputError(`saída incompleta (${msg.stop_reason})`);
      const u = msg.usage || {};
      return {
        output: msg.parsed_output,
        usage: { input: (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0), output: u.output_tokens || 0, cacheRead: u.cache_read_input_tokens || 0 },
        model: msg.model,
      };
    },
    /** Classifica erros do SDK (dos mais específicos para os mais gerais). */
    classify(err) {
      if (err instanceof RefusalError) return { status: 422, code: 'recusado' };
      if (err instanceof BadOutputError) return { status: 502, code: 'resposta_invalida' };
      if (err instanceof Anthropic.RateLimitError) return { status: 503, code: 'ia_ocupada', retryAfter: Number(err.headers?.get?.('retry-after')) || 20 };
      if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) return { status: 500, code: 'servidor_mal_configurado' };
      if (err instanceof Anthropic.BadRequestError) return { status: 500, code: 'requisicao_rejeitada' };
      if (err instanceof Anthropic.APIConnectionTimeoutError) return { status: 504, code: 'ia_demorou' };
      if (err instanceof Anthropic.APIConnectionError) return { status: 502, code: 'sem_conexao_ia' };
      if (err instanceof Anthropic.APIError) return { status: 502, code: 'erro_ia' };
      return { status: 500, code: 'erro_interno' };
    },
  };
}
