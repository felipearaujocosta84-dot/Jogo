// Teste automático do modo Wi-Fi local, sem celular: um "repetidor" WebSocket faz o papel do plugin nativo
// (o anfitrião conecta em /h e os convidados em /c). Duas abas do navegador: anfitrião e convidado.
// Uso: npm run dev (porta 5173) em outro terminal, depois: node scripts/net/lan-e2e.mjs
import { WebSocketServer } from 'ws';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');

const RELAY_PORT = 8799;
const APP = process.env.APP_URL || 'http://127.0.0.1:5173/';
let host = null;
const clients = new Map();
let nextId = 1;
const wss = new WebSocketServer({ port: RELAY_PORT });
wss.on('connection', (ws, req) => {
  if (req.url === '/h') {
    host = ws;
    ws.on('message', d => {
      const m = JSON.parse(String(d));
      if (m.send != null) clients.get(m.send)?.send(m.data);
      else if (m.kick != null) clients.get(m.kick)?.close();
    });
    ws.on('close', () => {
      host = null;
      for (const c of clients.values()) c.close();
    });
    return;
  }
  if (!host) return ws.close();
  const id = nextId++;
  clients.set(id, ws);
  host.send(JSON.stringify({ ev: 'open', id }));
  ws.on('message', d => host?.send(JSON.stringify({ ev: 'message', id, data: String(d) })));
  ws.on('close', () => {
    clients.delete(id);
    host?.send(JSON.stringify({ ev: 'close', id }));
  });
});

const results = [];
const check = (name, ok, info = '') => {
  results.push(ok);
  console.log(`${ok ? 'OK  ' : 'FALHA'} ${name}${info ? ' — ' + info : ''}`);
};

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
async function page(name) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(([relay, n]) => {
    localStorage.setItem('opstrike.lanRelay', JSON.stringify(relay));
    localStorage.setItem('opstrike.lanIp', JSON.stringify('127.0.0.1'));
    const s = JSON.parse(localStorage.getItem('opstrike.settings') || '{}');
    s.playerName = n;
    s.quality = 'low'; s.tutorialDone = true;
    localStorage.setItem('opstrike.settings', JSON.stringify(s));
  }, [`ws://127.0.0.1:${RELAY_PORT}`, name]);
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log(`[${name}] erro:`, e.message));
  await p.goto(APP);
  await p.waitForFunction(() => !document.getElementById('mainMenu')?.classList.contains('hidden'), null, { timeout: 120000 });
  await p.evaluate(() => document.querySelector('[data-action="lan-play"]').click());
  await p.waitForSelector('#lanScreen:not(.hidden)');
  return p;
}

try {
  const h = await page('Anfitriao');
  const g = await page('Convidado');
  await h.click('[data-lan="host"]');
  await h.waitForSelector('text=SALA ABERTA', { timeout: 10000 });
  check('anfitrião abre a sala', true);
  await g.click('[data-lan="join"]');
  await g.waitForSelector('text=CONECTADO AO ANFITRIÃO', { timeout: 10000 });
  await h.waitForFunction(() => document.querySelectorAll('#lanBody .lobby li:not(.empty)').length === 2, null, { timeout: 10000 });
  check('convidado entra e aparece na lista do anfitrião', true);
  const gList = await g.$$eval('#lanBody .lobby li:not(.empty)', els => els.map(e => e.textContent));
  check('convidado vê os 2 jogadores', gList.length === 2, gList.join(', '));

  await h.click('[data-lan="start"]');
  await Promise.all([
    h.waitForFunction(() => window.game?.session && document.getElementById('lanScreen').classList.contains('hidden'), null, { timeout: 60000 }),
    g.waitForFunction(() => window.game?.session?.latest, null, { timeout: 60000 })
  ]);
  check('os dois entram na partida X1', true);
  await h.waitForTimeout(4000);

  // posição de cada jogador no anfitrião (autoritativo) x o que o convidado recebeu
  const hs = await h.evaluate(() => window.game.session.sim.players.map(p => ({ id: p.id, x: p.ctrl.position.x, z: p.ctrl.position.z, hp: p.health, team: p.team })));
  const gs = await g.evaluate(() => ({ you: window.game.session.localId, ps: window.game.session.latest.players.map(p => ({ id: p.id, x: p.x, z: p.z, hp: p.hp, team: p.team })) }));
  check('anfitrião simula 2 jogadores, sem bots', hs.length === 2, JSON.stringify(hs.map(p => p.id + ':' + p.team)));
  check('convidado recebe os 2 jogadores', gs.ps.length === 2, JSON.stringify(gs.ps.map(p => p.id)));
  const hostP = hs.find(p => p.id === 'local');
  const seen = gs.ps.find(p => p.id === 'local');
  const d = hostP && seen ? Math.hypot(hostP.x - seen.x, hostP.z - seen.z) : 99;
  check('posição do anfitrião igual nos dois aparelhos', d < 0.5, `diferença ${d.toFixed(3)} m`);
  const guestOnHost = hs.find(p => p.id === gs.you);
  check('convidado existe na simulação do anfitrião', !!guestOnHost, gs.you);

  // convidado anda para frente: o anfitrião precisa ver o movimento
  const before = guestOnHost ? { x: guestOnHost.x, z: guestOnHost.z } : { x: 0, z: 0 };
  await g.bringToFront();
  await g.keyboard.down('KeyW');
  await g.waitForTimeout(1500);
  await g.keyboard.up('KeyW');
  await h.waitForTimeout(500);
  const after = await h.evaluate(id => {
    const p = window.game.session.sim.players.find(q => q.id === id);
    return p ? { x: p.ctrl.position.x, z: p.ctrl.position.z } : null;
  }, gs.you);
  const moved = after ? Math.hypot(after.x - before.x, after.z - before.z) : 0;
  check('comando do convidado move o boneco no anfitrião', moved > 0.5, `${moved.toFixed(2)} m`);
} catch (e) {
  check('execução', false, e.message);
} finally {
  await browser.close();
  wss.close();
  const ok = results.every(Boolean);
  console.log(ok ? `\n${results.length}/${results.length} verificações OK` : '\nHÁ FALHAS');
  process.exit(ok ? 0 : 1);
}
