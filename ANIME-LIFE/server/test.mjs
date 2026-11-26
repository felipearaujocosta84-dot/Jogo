// Testes do servidor com a API de IA SIMULADA (nenhuma chamada real, nenhum custo).
import { createApp, configFromEnv } from './app.mjs';
import { createProvider } from './providers/index.mjs';

let mode = 'ok'; const sent = [];
const reply = (obj) => new Response(JSON.stringify({ id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [{ type: 'text', text: JSON.stringify(obj) }], stop_reason: 'end_turn', stop_details: null, usage: { input_tokens: 900, output_tokens: 80, cache_read_input_tokens: 0 } }), { status: 200, headers: { 'content-type': 'application/json' } });
async function fakeFetch(url, init) {
  sent.push({ url: String(url), headers: Object.fromEntries(new Headers(init.headers)), body: JSON.parse(init.body) });
  if (mode === 'refusal') return new Response(JSON.stringify({ id: 'm', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [], stop_reason: 'refusal', stop_details: { type: 'refusal', category: null, explanation: null }, usage: { input_tokens: 10, output_tokens: 0 } }), { status: 200, headers: { 'content-type': 'application/json' } });
  if (mode === 'busy') return new Response(JSON.stringify({ type: 'error', error: { type: 'rate_limit_error', message: 'x' } }), { status: 429, headers: { 'content-type': 'application/json', 'retry-after': '7', 'x-should-retry': 'false' } });
  if (mode === 'spont') return reply({ replies: ['bom dia', 'acordou cedo hoje?'], mood: 'neutro' });
  if (mode === 'summary') return reply({ summary: 'Conversaram sobre futebol.', memories: [{ kind: 'preferencia', text: 'Gosta de futebol.' }] });
  return reply({ replies: ['você gosta de futebol?', 'eu achava que você era do tipo que fica em casa'], mood: 'pensativo', deltas: { amizade: 2, confianca: 0, carinho: 1, afinidade: 1, romance: 9 }, memories: [{ kind: 'preferencia', text: 'O jogador gosta muito de futebol.' }] });
}

const cfg = { ...configFromEnv({}), perMinute: 3, port: 0 };
const provider = createProvider('anthropic', cfg, { fetchImpl: fakeFetch });
const { server } = createApp({ provider, cfg, log: { info() {}, warn() {}, error: (e) => console.log('ERRO:', String(e).slice(0, 300)) } });
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;
const post = (path, body, headers = {}) => fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
const ctx = (dev = 'aparelho-teste-01') => ({ deviceId: dev, characterId: 'character_01', player: { name: 'Aiko Tanaka', displayName: 'Aiko', pronouns: 'ela' }, relationship: { amizade: 10, confianca: 5, carinho: 2, afinidade: 6, romance: 0 }, mood: 'neutro', memories: [], storyFacts: ['Você e o jogador abriram juntos a caixa de Kamakura.'], summary: '', history: [{ from: 'npc', text: 'oi' }], localTime: 'sábado, 22:10' });

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`); };

let r = await fetch(base + '/health'); let j = await r.json();
ok('GET /health', r.status === 200 && j.model === 'claude-opus-5-5' && j.characters.length === 6);

r = await post('/v1/chat', { ...ctx(), message: 'Gosto muito de futebol.' }); j = await r.json();
ok('Chat responde com bolhas, humor e memória', r.status === 200 && j.replies.length === 2 && j.mood === 'pensativo' && j.memories[0].text.includes('futebol'), JSON.stringify(j).slice(0, 120));
ok('Deltas limitados a ±3 (romance 9 → 3)', j.deltas.romance === 3 && j.deltas.amizade === 2);
const req = sent.at(-1);
ok('SDK chamou /v1/messages', req.url.endsWith('/v1/messages'), req.url);
ok('Modelo padrão claude-opus-5-5', req.body.model === 'claude-opus-5-5');
ok('Saída JSON estruturada (output_config.format)', req.body.output_config?.format?.type === 'json_schema', JSON.stringify(req.body.output_config).slice(0, 80));
ok('Esforço baixo para conversa', req.body.output_config?.effort === 'low');
ok('Prompt fixo em cache (cache_control)', req.body.system?.[0]?.cache_control?.type === 'ephemeral');
ok('Fallback de recusa ativado', req.body.fallbacks === 'default' && String(req.headers['anthropic-beta']).includes('server-side-fallback-2026-07-01'), req.headers['anthropic-beta']);
ok('Contexto inclui memória/fatos/mensagem', req.body.messages[0].content.includes('caixa de Kamakura') && req.body.messages[0].content.includes('Gosto muito de futebol'));
ok('Personalidade vem do servidor', req.body.system[0].text.includes('Rin Kuroha') && req.body.system[0].text.includes('minúsculas'));

r = await post('/v1/chat', { ...ctx(), characterId: 'qualquer_um', message: 'oi' }); ok('Personagem desconhecido é rejeitado', r.status === 400);
r = await post('/v1/chat', { ...ctx(), message: 'x'.repeat(600) }); ok('Mensagem longa demais é rejeitada', r.status === 400);
r = await post('/v1/chat', { ...ctx(), deviceId: '../hack', message: 'oi' }); ok('deviceId inválido é rejeitado', r.status === 400);

mode = 'spont'; r = await post('/v1/spontaneous', { ...ctx('aparelho-teste-02'), reason: 'bom_dia' }); j = await r.json();
ok('Mensagem espontânea', r.status === 200 && j.replies[0] === 'bom dia', JSON.stringify(j));
mode = 'summary'; r = await post('/v1/summarize', { ...ctx('aparelho-teste-03'), older: [{ from: 'player', text: 'gosto de futebol' }] }); j = await r.json();
ok('Resumo de memória', r.status === 200 && j.summary.includes('futebol') && j.memories.length === 1);

mode = 'refusal'; r = await post('/v1/chat', { ...ctx('aparelho-teste-04'), message: 'oi' }); j = await r.json();
ok('Recusa da IA vira erro 422 tratável', r.status === 422 && j.error === 'recusado');
mode = 'busy'; r = await post('/v1/chat', { ...ctx('aparelho-teste-05'), message: 'oi' }); j = await r.json();
ok('IA sobrecarregada → 503 com retryAfter', r.status === 503 && j.error === 'ia_ocupada' && j.retryAfter === 7, JSON.stringify(j));

mode = 'ok';
const dev = 'aparelho-teste-06'; const codes = [];
for (let i = 0; i < 4; i++) codes.push((await post('/v1/chat', { ...ctx(dev), message: `oi ${i}` })).status);
ok('Limite por minuto por aparelho (3/min)', codes.join(',') === '200,200,200,429', codes.join(','));

const cfg2 = { ...cfg, appToken: 'segredo-do-app' };
const app2 = createApp({ provider, cfg: cfg2, log: { info() {}, warn() {} } });
await new Promise((res) => app2.server.listen(0, res));
const b2 = `http://127.0.0.1:${app2.server.address().port}`;
r = await fetch(b2 + '/v1/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...ctx('aparelho-teste-07'), message: 'oi' }) });
ok('APP_TOKEN exigido quando configurado', r.status === 401);
app2.server.close();

r = await fetch(base + '/v1/chat', { method: 'OPTIONS', headers: { Origin: 'capacitor://localhost' } });
ok('CORS liberado para o app', r.status === 204 && !!r.headers.get('access-control-allow-origin'));

server.close();
console.log(`\n${pass}/${pass + fail} testes do servidor passaram.`);
process.exit(fail ? 1 : 0);
