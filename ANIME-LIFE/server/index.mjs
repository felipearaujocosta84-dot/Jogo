// Inicia o servidor de IA do ANIME LIFE.  Uso: ANTHROPIC_API_KEY=... npm start
import { createApp, configFromEnv } from './app.mjs';
import { createProvider } from './providers/index.mjs';

const cfg = configFromEnv();
if (cfg.provider === 'anthropic' && !process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
  console.warn('Aviso: ANTHROPIC_API_KEY não definida — as chamadas à IA vão falhar até configurar a chave no servidor.');
}
const provider = createProvider(cfg.provider, cfg);
const { server } = createApp({ provider, cfg });
server.listen(cfg.port, () => console.log(`ANIME LIFE · servidor de IA em :${cfg.port} (provedor ${provider.name}, modelo ${provider.model}, esforço ${cfg.effort})`));
