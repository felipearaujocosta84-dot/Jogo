// Teste do smartphone (chat livre): modo local, memória persistente, modo IA com o servidor real
// do projeto (IA SIMULADA, sem custo), falha de conexão + reenvio, mensagens espontâneas e notificações.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'test-results');
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const ok = (name, cond, extra = '') => { results.push({ name, pass: !!cond }); console.log(`${cond ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`); };

(async () => {
  // servidor de IA do projeto, com a API da Anthropic simulada
  const { createApp, configFromEnv } = await import(path.join(ROOT, 'server/app.mjs'));
  const { createProvider } = await import(path.join(ROOT, 'server/providers/index.mjs'));
  let lastPrompt = '';
  const fakeFetch = async (url, init) => {
    const body = JSON.parse(init.body); lastPrompt = body.messages[0].content;
    const isSpont = lastPrompt.includes('INICIAR');
    const out = isSpont ? { replies: ['ei, tá acordado?'], mood: 'neutro' }
      : { replies: [lastPrompt.includes('futebol') ? 'você comentou que gostava de futebol! tem jogado?' : 'oi. chegou bem em casa?'], mood: 'feliz', deltas: { amizade: 2, confianca: 1, carinho: 1, afinidade: 1, romance: 0 }, memories: [] };
    return new Response(JSON.stringify({ id: 'm', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [{ type: 'text', text: JSON.stringify(out) }], stop_reason: 'end_turn', stop_details: null, usage: { input_tokens: 500, output_tokens: 40 } }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const cfg = { ...configFromEnv({}), port: 0 };
  const { server: aiServer } = createApp({ provider: createProvider('anthropic', cfg, { fetchImpl: fakeFetch }), cfg, log: { info() {}, warn() {} } });
  await new Promise((r) => aiServer.listen(0, r));
  const AI_URL = `http://127.0.0.1:${aiServer.address().port}`;

  const PORT = 4185;
  const web = spawn(process.execPath, [path.join(ROOT, 'node_modules/vite/bin/vite.js'), 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'pipe' });
  await new Promise((r) => { web.stdout.on('data', (d) => { if (String(d).includes(String(PORT))) r(); }); setTimeout(r, 8000); });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_CONNECTION_REFUSED|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  const shot = (n) => page.screenshot({ path: path.join(OUT, `${n}.png`) });
  const G = (fn, arg) => page.evaluate(fn, arg);
  const tap = async (sel) => { const l = page.locator(sel).first(); await l.scrollIntoViewIfNeeded().catch(() => {}); const b = await l.boundingBox(); await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); };
  const npcCount = () => G(() => window.__ANIME_LIFE__.chat.mem('character_01').history.filter((m) => m.from === 'npc').length);
  const sendText = async (t) => { await page.fill('.ph-input input', t); await tap('.ph-input button'); };

  try {
    await page.goto(`http://localhost:${PORT}/`);
    await page.waitForSelector('#splash.show'); await tap('#splash'); await page.waitForSelector('#menu.show');
    await tap('[data-a=new]'); await page.waitForSelector('#newgame.show');
    await page.fill('#f-name', 'Aiko Tanaka'); await tap('#newgame [data-a=ok]');
    await page.waitForSelector('.dl-box.show', { timeout: 20000 });
    await G(() => { const s = window.__ANIME_LIFE__.game.state; s.phone.contacts.push('character_01', 'character_07'); s.rel.character_01 = { amizade: 4, confianca: 3, carinho: 0, afinidade: 4, romance: 0, met: true }; s.rel.character_07 = { amizade: 2, confianca: 0, carinho: 0, afinidade: 0, romance: 0, met: true }; });

    // ---- celular: tela inicial e apps ----
    await tap('[data-q=phone]'); await page.waitForSelector('#phone.show .apps'); await page.waitForTimeout(400);
    await shot('20-celular-inicio');
    const apps = await page.locator('#phone .app').allTextContents();
    ok('Celular com Mensagens, Contatos, Perfis, Histórico, Notificações', ['Mensagens', 'Contatos', 'Perfis', 'Histórico', 'Notificações'].every((a) => apps.some((x) => x.includes(a))), apps.join(' | '));
    ok('Modo local avisado (sem servidor)', (await page.locator('.ph-mode-note').textContent()).includes('Modo local'));

    // ---- Mensagens → chat livre (modo local) ----
    await tap('.app[data-a=msgs]'); await page.waitForSelector('.thread[data-id=character_01]'); await page.waitForTimeout(300);
    ok('Lista de contatos com foto e indicador online/offline', (await page.locator('.thread[data-id] .av img').count()) === 2 && (await page.locator('.thread[data-id] .av .dot').count()) === 2);
    await tap('.thread[data-id=character_01]'); await page.waitForSelector('.ph-input input');
    ok('Campo de texto livre + botão enviar', await page.locator('.ph-input button').isVisible());
    await sendText('Oi Rin! Tudo bem?');
    await page.waitForSelector('.chat.free .msg.typing', { timeout: 5000 }).catch(() => {});
    const typingSeen = await page.locator('.chat.free .msg.typing').count();
    await page.waitForFunction(() => window.__ANIME_LIFE__.chat.mem('character_01').history.some((m) => m.from === 'npc'), null, { timeout: 10000 });
    await page.waitForTimeout(400);
    ok('Animação "digitando…" antes da resposta', typingSeen === 1);
    const h1 = await G(() => window.__ANIME_LIFE__.chat.mem('character_01').history.map((m) => ({ f: m.from, t: m.text, s: m.status, l: !!m.local })));
    ok('Resposta do modo local, marcada como local', h1.some((m) => m.f === 'npc' && m.l), JSON.stringify(h1.at(-1)));
    ok('Mensagem do jogador marcada como lida (✓✓)', h1[0].s === 'read' && (await page.locator('.tk.read').count()) >= 1);
    ok('Horário nas mensagens', /\d\d:\d\d/.test(await page.locator('.chat.free .msg .meta').first().textContent()));
    await sendText('Eu gosto muito de futebol.');
    await page.waitForFunction(() => window.__ANIME_LIFE__.chat.mem('character_01').facts.length > 0, null, { timeout: 10000 });
    await page.waitForTimeout(1500);
    await shot('21-chat-local');
    const facts = await G(() => window.__ANIME_LIFE__.chat.mem('character_01').facts.map((f) => f.text));
    ok('Memória: lembra que o jogador gosta de futebol', facts.some((f) => f.includes('futebol')), facts.join(' | '));
    const rel = await G(() => window.__ANIME_LIFE__.game.state.rel.character_01);
    ok('Relacionamento mudou com a conversa', rel.amizade > 4 || rel.afinidade > 4, JSON.stringify(rel));

    // ---- perfil ----
    await tap('.chat-head'); await page.waitForSelector('.profile'); await page.waitForTimeout(300);
    await shot('22-perfil');
    ok('Perfil com 5 barras de relação, humor e memórias', (await page.locator('.profile .bar').count()) === 5 && (await page.locator('.p-facts li').count()) >= 1 && (await page.locator('.p-top').textContent()).includes('humor'));

    // ---- persistência: fecha e reabre o jogo ----
    await G(() => window.__ANIME_LIFE__.ui.autosave());
    await page.reload();
    await page.waitForSelector('#splash.show'); await tap('#splash'); await page.waitForSelector('#menu.show');
    await tap('[data-a=continue]'); await page.waitForSelector('.dl-box.show', { timeout: 20000 });
    const facts2 = await G(() => window.__ANIME_LIFE__.chat.mem('character_01').facts.length);
    const hist2 = await G(() => window.__ANIME_LIFE__.chat.mem('character_01').history.length);
    ok('Memória e conversa continuam após fechar e abrir o jogo', facts2 >= 1 && hist2 >= 4, `${facts2} memórias, ${hist2} mensagens`);

    // ---- modo IA (servidor do projeto + IA simulada) ----
    await G((url) => window.__ANIME_LIFE__.settings.set('aiServer', url), AI_URL);
    await tap('[data-q=phone]'); await page.waitForSelector('#phone.show .apps');
    ok('Celular indica IA conectada', (await page.locator('.ph-mode').textContent()).includes('IA'));
    await tap('.app[data-a=msgs]'); await tap('.thread[data-id=character_01]'); await page.waitForSelector('.ph-input input');
    const before = await npcCount();
    await sendText('Lembra do que eu te contei?');
    await page.waitForFunction((n) => window.__ANIME_LIFE__.chat.mem('character_01').history.filter((m) => m.from === 'npc').length > n, before, { timeout: 15000 });
    await page.waitForTimeout(500);
    const last = await G(() => window.__ANIME_LIFE__.chat.mem('character_01').history.at(-1));
    ok('Resposta da IA chega pelo servidor seguro', last.from === 'npc' && !last.local && last.text.includes('futebol'), last.text);
    ok('A IA recebeu a memória salva no contexto', /memórias sobre o jogador:\n- O jogador gosta de futebol/.test(lastPrompt));
    ok('A IA recebeu os fatos da história e o nome do jogador', lastPrompt.includes('Residencial Hoshizora') && lastPrompt.includes('Aiko'));
    await shot('23-chat-ia');

    // ---- falha de conexão + reenvio ----
    await G(() => window.__ANIME_LIFE__.settings.set('aiServer', 'http://127.0.0.1:9'));
    await sendText('Você ainda está aí?');
    await page.waitForSelector('.msg.failed', { timeout: 15000 });
    ok('Falha de conexão: mensagem marcada como não enviada (jogo não trava)', (await page.locator('.msg.failed').count()) === 1 && (await G(() => !window.__ANIME_LIFE__.chat.typing.size)));
    await G((url) => window.__ANIME_LIFE__.settings.set('aiServer', url), AI_URL);
    await tap('.msg.failed');
    await page.waitForFunction(() => window.__ANIME_LIFE__.chat.mem('character_01').history.at(-1).from === 'npc', null, { timeout: 15000 });
    ok('Tocar na mensagem reenvia e a resposta chega', (await page.locator('.msg.failed').count()) === 0);

    // ---- mensagem espontânea + notificação (fora da conversa) ----
    await tap('.ph-close'); await page.waitForTimeout(500);
    const sp = await G(() => window.__ANIME_LIFE__.chat.tick(true));
    await page.waitForSelector('#notif-banner.show', { timeout: 8000 });
    await shot('24-notificacao');
    ok('NPC manda mensagem espontânea com notificação', !!sp && (await page.locator('#notif-banner.show').textContent()).length > 3, JSON.stringify(sp));
    ok('Badge de nova mensagem no botão do celular', await page.locator('[data-q=phone] .badge:not(.hidden)').count() === 1);
    await tap('#notif-banner'); await page.waitForSelector('.ph-input input');
    ok('Tocar na notificação abre a conversa', (await page.locator('.chat-head b').textContent()).length > 0);
    await tap('.ph-back'); await page.waitForTimeout(300); await tap('.ph-back'); await page.waitForTimeout(300);
    await tap('.app[data-a=notifs]'); await page.waitForSelector('.notif'); await page.waitForTimeout(300);
    await shot('25-notificacoes');
    ok('App de notificações lista as mensagens', (await page.locator('.notif').count()) >= 1);
    await tap('.ph-back'); await page.waitForTimeout(300); await tap('.app[data-a=history]'); await page.waitForTimeout(300);
    ok('Histórico de conversas', (await page.locator('.thread').count()) >= 1);
    await tap('.ph-close'); await page.waitForTimeout(400);
    // ajustes
    await tap('[data-q=menu]'); await page.waitForSelector('.pause-grid'); await tap('.pause-grid [data-a=settings]'); await page.waitForSelector('.ai-url');
    await page.waitForTimeout(300);
    // rola o painel de ajustes até a seção do celular (como o dedo do jogador faria)
    await page.evaluate(() => document.querySelector('[data-a=test]').scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(300);
    const reach = await page.evaluate(() => { const b = document.querySelector('[data-a=test]').getBoundingClientRect(); return b.bottom <= innerHeight && b.top >= 0; });
    ok('Seção "Celular e IA" alcançável rolando os ajustes', reach);
    const tb = await page.locator('[data-a=test]').boundingBox(); 
    await page.touchscreen.tap(tb.x + tb.width / 2, tb.y + tb.height / 2);
    await page.waitForFunction(() => /Conectado|❌/.test(document.querySelector('.ai-status').textContent), null, { timeout: 10000 }).catch(async () => console.log('   status:', await page.locator('.ai-status').textContent(), '| url:', await page.inputValue('.ai-url')));
    await shot('26-ajustes-ia');
    ok('Ajustes: testar conexão com o servidor de IA', (await page.locator('.ai-status').textContent()).includes('Conectado'), await page.locator('.ai-status').textContent());
    ok('Ajustes: frequência das mensagens espontâneas', (await page.locator('.seg[data-k=spontaneous] button').count()) === 4);
  } catch (e) {
    ok('Execução sem exceções', false, String(e.stack || e).slice(0, 500));
    await shot('99-falha-celular').catch(() => {});
  }
  ok('Sem erros no console', errors.length === 0, errors.slice(0, 4).join(' || '));
  await browser.close(); web.kill(); aiServer.close();
  const bad = results.filter((r) => !r.pass);
  console.log(`\n${results.length - bad.length}/${results.length} verificações do celular passaram.`);
  process.exit(bad.length ? 1 : 0);
})();
