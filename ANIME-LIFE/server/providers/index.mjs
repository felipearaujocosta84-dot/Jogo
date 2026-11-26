// Registro de provedores de IA. Escolha com AI_PROVIDER (padrão: anthropic).
// Para adicionar outro provedor, crie providers/<nome>.mjs exportando uma fábrica com a mesma
// interface ({ name, model, generate({system,user,schema,maxTokens}), classify(err) }) e registre aqui.
import { createAnthropicProvider } from './anthropic.mjs';

const REGISTRY = { anthropic: createAnthropicProvider };

export function createProvider(name, cfg, opts) {
  const make = REGISTRY[name];
  if (!make) throw new Error(`Provedor de IA desconhecido: "${name}". Disponíveis: ${Object.keys(REGISTRY).join(', ')}`);
  return make(cfg, opts);
}
