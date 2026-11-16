// Testes de rede com clientes reais (WebSocket + Colyseus) contra o servidor de verdade.
// Uso: DATABASE_URL=postgres://... OS_TEST_MODE=1 npx tsx scripts/net/run.ts [teste...]
// Testes: room, friends, x1, reconnect, latency, load
import { startServer } from '../../server/index';
import { MAPS } from '../../src/maps/maps';
import { MapRuntime } from '../../src/maps/MapRuntime';
import { pack } from 'msgpackr';
import { TestPlayer, check, sleep, summary, waitFor } from './harness';

const only = process.argv.slice(2);
const want = (n: string) => !only.length || only.includes(n);
const uniq = () => Math.random().toString(36).slice(2, 7);

const srv = await startServer(0);
const base = `http://127.0.0.1:${srv.port}`;
console.log(`servidor de teste em ${base} (banco: ${srv.store.kind})\n`);

async function players(n: number, prefix: string): Promise<TestPlayer[]> {
  const out: TestPlayer[] = [];
  for (let i = 0; i < n; i++) {
    const p = new TestPlayer(base, `${prefix}${i}_${uniq()}`.slice(0, 16));
    await p.register();
    out.push(p);
  }
  return out;
}

/** Lugar aberto no mapa: ponto de nascimento com linha de visão livre de `dist` metros em alguma direção. */
function openLine(mapId: string, from: { x: number; y: number; z: number }, dist: number): { yaw: number } | null {
  const map = new MapRuntime(MAPS[mapId]);
  for (let k = 0; k < 16; k++) {
    const yaw = (k / 16) * Math.PI * 2;
    const dir = { x: Math.sin(yaw), y: 0, z: Math.cos(yaw) };
    for (const h of [0.3, 1.0, 1.6]) {
      const hit = map.world.raycast({ x: from.x, y: from.y + h, z: from.z }, dir, dist + 1.5);
      if (hit) {
        k += 0;
        break;
      }
      if (h === 1.6) {
        // chão sob o alvo
        const ground = map.def.model ? map.groundAt(from.x + dir.x * dist, from.z + dir.z * dist) : { y: from.y, free: true };
        if (Math.abs(ground.y - from.y) < 0.3) return { yaw };
      }
    }
  }
  return null;
}

/** Coloca A e B frente a frente e faz A atirar até B morrer. Retorna o número de comandos de tiro. */
async function duelKill(a: TestPlayer, b: TestPlayer, mapId: string): Promise<number> {
  const pa = await waitFor(() => a.player(a.you));
  const line = openLine(mapId, pa, 6);
  if (!line) throw new Error('sem linha de visão livre');
  const bx = pa.x + Math.sin(line.yaw) * 6, bz = pa.z + Math.cos(line.yaw) * 6;
  a.game!.send('test:place', { x: pa.x, y: pa.y + 0.05, z: pa.z, yaw: line.yaw });
  b.game!.send('test:place', { x: bx, y: pa.y + 0.05, z: bz, yaw: line.yaw + Math.PI });
  await sleep(400);
  const pitch = Math.atan2(1.3 - 1.62, 6);
  let shots = 0;
  const deadBefore = b.events.filter(e => e.type === 'kill' && e.victim === b.you).length;
  for (let i = 0; i < 120; i++) {
    a.cmd({ yaw: line.yaw, pitch, buttons: i % 2 ? 1 : 0, sel: 1 }, 2);
    b.cmd({ yaw: line.yaw + Math.PI }, 2);
    shots++;
    await sleep(33);
    if (b.events.filter(e => e.type === 'kill' && e.victim === b.you).length > deadBefore) break;
  }
  return shots;
}

// ====================================================================== 1. dois jogadores na mesma sala
if (want('room')) {
  console.log('— Teste 1: dois jogadores na mesma sala');
  const [a, b] = await players(2, 'sala');
  const ra = await a.create({ settings: { mode: 'tdm', mapId: 'dust_zone', bots: false, maxPlayers: 4, isPublic: false } });
  await b.join(ra.roomId);
  await waitFor(() => a.room?.players.length === 2 && b.room?.players.length === 2);
  check('os dois aparecem no lobby da sala', true, `código ${ra.roomId}`);
  b.game!.send('start');
  await sleep(300);
  check('só o dono pode iniciar', b.errors.some(e => /dono/.test(e)), b.errors.join('; '));
  a.game!.send('start');
  await waitFor(() => a.started && b.started && a.snaps.length > 10 && b.snaps.length > 10);
  const sa = a.latest()!, sb = b.latest()!;
  check('ambos recebem atualizações com os 2 jogadores', sa.players.length === 2 && sb.players.length === 2, `A vê ${sa.players.length}, B vê ${sb.players.length}`);
  check('mesmo tick do servidor (±3)', Math.abs(sa.tick - sb.tick) <= 3, `A ${sa.tick} / B ${sb.tick}`);
  // movimento: B anda para frente e A vê a mudança
  const before = a.player(b.you)!;
  for (let i = 0; i < 30; i++) {
    b.cmd({ my: 1, yaw: before.yaw }, 2);
    await sleep(33);
  }
  await sleep(300);
  const after = a.player(b.you)!;
  const moved = Math.hypot(after.x - before.x, after.z - before.z);
  check('movimento de B chega ao cliente A', moved > 1, `${moved.toFixed(2)} m`);
  const rate = a.snaps.filter(s => s.tick > sa.tick).length / ((a.latest()!.tick - sa.tick) / 60);
  check('taxa de atualizações ~20/s', rate > 15 && rate < 25, `${rate.toFixed(1)}/s`);
  ra.leave();
  b.game!.leave();
  await sleep(200);
}

// ====================================================================== 2. amigos e convites
if (want('friends')) {
  console.log('\n— Teste 2: amigos, convite e entrada de amigos');
  const [a, b, c] = await players(3, 'amigo');
  await a.connectSocial();
  await b.connectSocial();
  await c.connectSocial();
  a.social!.send('friend:request', { query: b.code });
  await waitFor(() => b.socialMsgs.some(x => x.type === 'notify' && x.m.kind === 'friend-request'));
  check('B recebe a notificação do pedido de amizade', true);
  const st = await waitFor(() => b.lastSocial('state')?.friends?.find((f: any) => f.id === a.userId && f.state === 'incoming'));
  check('pedido aparece como "recebido" para B', !!st);
  b.social!.send('friend:accept', { userId: a.userId });
  const fa = await waitFor(() => a.lastSocial('state')?.friends?.find((f: any) => f.id === b.userId && f.state === 'accepted'));
  check('amizade aceita e B aparece online para A', fa.status === 'online', `status ${fa.status}`);
  // sala privada com senha
  const ra = await a.create({ settings: { mode: 'tdm', mapId: 'dust_zone', bots: false, maxPlayers: 4, isPublic: false }, password: 'segredo' });
  let blocked = '';
  try {
    await c.join(ra.roomId);
  } catch (e) {
    blocked = (e as Error).message;
  }
  check('sem senha não entra na sala privada', /Senha/.test(blocked), blocked);
  let wrong = '';
  try {
    await c.join(ra.roomId, { password: 'errada' });
  } catch (e) {
    wrong = (e as Error).message;
  }
  check('senha errada é recusada', /Senha/.test(wrong), wrong);
  await sleep(200);
  const pres = await waitFor(() => b.socialMsgs.find(x => x.type === 'presence' && x.m.id === a.userId && x.m.status === 'na sala'));
  check('B vê A "na sala" (status ao vivo)', !!pres);
  // convite de quem não é amigo é recusado
  c.social!.send('invite', { userId: b.userId });
  await sleep(300);
  check('convite de não-amigo é bloqueado', !!c.socialMsgs.find(x => x.type === 'error'));
  a.social!.send('invite', { userId: b.userId });
  const inv = await waitFor(() => b.lastSocial('invite'));
  check('B recebe o convite de partida', inv.roomId === ra.roomId, `sala ${inv.roomId}`);
  b.social!.send('invite:respond', { id: inv.id, accept: true });
  const go = await waitFor(() => b.lastSocial('goto'));
  await b.join(go.roomId, { ticket: go.ticket });
  await waitFor(() => a.room?.players.length === 2);
  check('B entra na sala privada pelo convite (sem digitar a senha)', true);
  let reuse = '';
  const d = new TestPlayer(base, 'reuso_' + uniq());
  await d.register();
  try {
    await d.join(go.roomId, { ticket: go.ticket });
  } catch (e) {
    reuse = (e as Error).message;
  }
  check('ingresso do convite não serve para outra conta', /Senha/.test(reuse), reuse);
  // grupo
  a.social!.send('party:invite', { userId: b.userId });
  const pinv = await waitFor(() => b.lastSocial('party:invite'));
  b.social!.send('party:accept', { id: pinv.id });
  const party = await waitFor(() => a.lastSocial('party'));
  check('grupo formado (A líder + B)', party.members.length === 2, party.members.map((m: any) => m.name).join(', '));
  ra.leave();
  b.game!.leave();
  for (const p of [a, b, c]) p.social!.leave();
  await sleep(200);
}

// ====================================================================== 3 e 5. X1 com tiro e dano sincronizados
let x1Pair: TestPlayer[] = [];
if (want('x1') || want('reconnect')) {
  console.log('\n— Teste 3/5: partida X1, tiro e dano');
  const [a, b] = await players(2, 'duelo');
  x1Pair = [a, b];
  const ra = await a.create({ settings: { mode: 'x1', mapId: 'dust_zone', rounds: 2, primary: 'ak47', secondary: 'deagle', isPublic: false } });
  await b.join(ra.roomId);
  await waitFor(() => a.room?.players.length === 2);
  check('X1: um jogador em cada lado', a.room.players[0].team !== a.room.players[1].team, a.room.players.map((p: any) => p.team).join(' x '));
  a.game!.send('start');
  await waitFor(() => a.latest()?.round.phase === 'freeze');
  check('X1: contagem regressiva antes da rodada', a.latest()!.round.timeLeft > 0, `${a.latest()!.round.timeLeft.toFixed(1)} s`);
  await waitFor(() => a.latest()?.round.phase === 'live', 10000);
  const shots = await duelKill(a, b, 'dust_zone');
  const dmgA = a.events.filter(e => e.type === 'damage' && e.pid === b.you).map(e => e.amount as number);
  const dmgB = b.events.filter(e => e.type === 'damage' && e.pid === b.you).map(e => e.amount as number);
  check('dano decidido pelo servidor chega igual aos dois', dmgA.length > 0 && JSON.stringify(dmgA) === JSON.stringify(dmgB), `A viu [${dmgA.join(',')}] / B viu [${dmgB.join(',')}] em ${shots} comandos`);
  check('abate registrado para os dois', a.events.some(e => e.type === 'kill' && e.victim === b.you) && b.events.some(e => e.type === 'kill' && e.victim === b.you));
  await waitFor(() => a.latest()!.round.scoreT + a.latest()!.round.scoreCT >= 1);
  const ta = a.latest()!.tick;
  await waitFor(() => b.latest()!.tick >= ta);
  const sb = b.snaps.find(s => s.tick >= ta)!;
  check('placar idêntico nos dois clientes', a.latest()!.round.scoreT === sb.round.scoreT && a.latest()!.round.scoreCT === sb.round.scoreCT, `T ${sb.round.scoreT} x ${sb.round.scoreCT} CT`);
  // munição: o servidor desconta os tiros
  const sa = a.latest()!;
  check('munição controlada pelo servidor', !!sa.you && sa.you.ammo < 30, `pente ${sa.you?.ammo}/${sa.you?.reserve}`);
  // segunda rodada
  if (want('x1')) {
    await waitFor(() => a.latest()?.round.phase === 'live' && a.latest()!.round.number >= 2, 15000);
    await duelKill(a, b, 'dust_zone');
    await waitFor(() => a.ended && b.ended, 15000);
    check('resultado final igual para os dois', a.ended.result.winner === b.ended.result.winner, `vencedor ${a.ended.result.winner}`);
    check('perfil atualizado e salvo (partida no histórico)', a.ended.profile.matches >= 1 && a.ended.profile.history[0]?.mode === 'x1', `partidas ${a.ended.profile.matches}`);
    const me = await (await fetch(base + '/api/me', { headers: { Authorization: 'Bearer ' + a.token } })).json();
    check('resultado gravado no banco', me.profile.matches >= 1, `${srv.store.kind}: ${me.profile.matches} partida(s), MMR ${me.profile.mmr}`);
    a.game!.send('rematch');
    b.game!.send('rematch');
    const s0 = a.started;
    await waitFor(() => a.started > s0 && b.started > s0, 8000);
    check('revanche inicia nova partida com os dois', true);
  }
}

// ====================================================================== 4. desconexão e reconexão
if (want('reconnect')) {
  console.log('\n— Teste 4: desconexão e reconexão');
  const [a, b] = x1Pair;
  const youBefore = b.you;
  const token = b.game!.reconnectionToken;
  // derruba a conexão sem avisar o servidor (como perda de sinal)
  (b.game as any).connection.transport.ws?.terminate?.() ?? (b.game as any).connection.close();
  await waitFor(() => a.room?.players.find((p: any) => p.userId === b.userId && !p.connected), 8000);
  check('servidor detecta a queda e mantém a vaga', true);
  const startedBefore = b.started;
  const r2 = await b.client.reconnect(token);
  (b as any).wire(r2);
  await waitFor(() => b.started > startedBefore || b.you, 8000);
  await waitFor(() => a.room?.players.find((p: any) => p.userId === b.userId && p.connected), 8000);
  await waitFor(() => b.snaps.length > 0 && b.latest()!.tick > a.latest()!.tick - 60, 8000);
  check('reconectou no mesmo jogador', b.you === youBefore, `${b.you}`);
  const st = await (await fetch(base + '/api/status')).json();
  check('reconexão contada no monitoramento', st.counters.reconnections >= 1, `reconexões ${st.counters.reconnections}`);
  a.game!.leave();
  b.game!.leave();
  await sleep(200);
}

// ====================================================================== 6. latência
if (want('latency')) {
  console.log('\n— Teste 6: latência');
  const [a, b] = await players(2, 'ping');
  const ra = await a.create({ settings: { mode: 'tdm', mapId: 'dust_zone', bots: false, maxPlayers: 2 } });
  await b.join(ra.roomId);
  const rtts: number[] = [];
  ra.onMessage('pong', m => rtts.push(performance.now() - m.ts));
  for (let i = 0; i < 40; i++) {
    ra.send('ping', { ts: performance.now(), rtt: rtts.at(-1) ?? 0 });
    await sleep(25);
  }
  await waitFor(() => rtts.length >= 40);
  rtts.sort((x, y) => x - y);
  check('ping/pong medido (rede local)', rtts.length === 40, `mediana ${rtts[20].toFixed(1)} ms, p95 ${rtts[37].toFixed(1)} ms`);
  // tiro com atraso artificial de 150 ms + compensação: A atira num alvo que anda de lado
  a.game!.send('start');
  await waitFor(() => a.latest()?.round.phase === 'live');
  const pa = await waitFor(() => a.player(a.you));
  const line = openLine('dust_zone', pa, 8);
  if (line) {
    a.game!.send('test:place', { x: pa.x, y: pa.y + 0.05, z: pa.z, yaw: line.yaw });
    const bx = pa.x + Math.sin(line.yaw) * 8, bz = pa.z + Math.cos(line.yaw) * 8;
    b.game!.send('test:place', { x: bx, y: pa.y + 0.05, z: bz, yaw: line.yaw + Math.PI });
    await sleep(400);
    let hits = 0, fired = 0;
    const delayed = (fn: () => void) => setTimeout(fn, 150);
    for (let i = 0; i < 90; i++) {
      // B anda de um lado para o outro
      b.cmd({ mx: Math.floor(i / 15) % 2 ? 1 : -1, yaw: line.yaw + Math.PI }, 2);
      // A mira onde VÊ o B (posição recebida) e o comando chega 150 ms depois
      const seen = a.player(b.you);
      if (seen && seen.alive) {
        const dx = seen.x - pa.x, dz = seen.z - pa.z;
        const yaw = Math.atan2(dx, dz), pitch = Math.atan2(1.3 - 1.62, Math.hypot(dx, dz));
        const rt = a.latest()!.tick;
        const seq0 = a.seq;
        a.seq += 2;
        delayed(() => a.game!.send('cmd', { c: [0, 1].map(k => ({ seq: seq0 + k + 1, mx: 0, my: 0, yaw, pitch, buttons: k ? 1 : 0, sel: 1, rt })) }));
        fired++;
      }
      await sleep(33);
    }
    await sleep(500);
    hits = a.events.filter(e => e.type === 'shot' && e.pid === a.you && e.hit === b.you).length;
    const shots = a.events.filter(e => e.type === 'shot' && e.pid === a.you).length;
    check('compensação de latência: acertos em alvo em movimento com 150 ms de atraso', hits > 0, `${hits} acertos em ${shots} disparos (${fired} comandos de tiro)`);
  } else check('compensação de latência', false, 'sem linha livre no mapa');
  ra.leave();
  b.game!.leave();
  await sleep(200);
}

// ====================================================================== 7. vários jogadores
if (want('load')) {
  const n = Number(process.env.LOAD_PLAYERS ?? 24);
  console.log(`\n— Teste 7: ${n} clientes reais numa sala de Battle Royale (com bots até 40)`);
  const list = await players(n, 'carga');
  const owner = list[0];
  const room = await owner.create({ settings: { mode: 'br', mapId: 'dust_zone', bots: true, maxPlayers: 40 } });
  for (const p of list.slice(1)) await p.join(room.roomId);
  await waitFor(() => owner.room?.players.length === n, 15000);
  // bytes recebidos por cliente (mensagens em msgpack)
  for (const p of list) p.game!.onMessage('snap', (s: unknown) => (p.bytes += pack(s).length));
  owner.game!.send('start');
  await waitFor(() => list.every(p => p.started), 15000);
  const t0 = Date.now();
  const dur = 15000;
  while (Date.now() - t0 < dur) {
    for (const p of list) p.cmd({ mx: Math.sin(Date.now() / 700 + p.seq) , my: 1, yaw: (Date.now() / 3000 + list.indexOf(p)) % 6.28 }, 2);
    await sleep(33);
  }
  const secs = (Date.now() - t0) / 1000;
  const st = await (await fetch(base + '/api/status')).json();
  const kbps = list.map(p => p.bytes / secs / 1024);
  const avg = kbps.reduce((a, b) => a + b, 0) / kbps.length;
  const tick = st.tickMs[room.roomId];
  check(`${n} clientes recebendo atualizações`, list.every(p => p.snaps.length > 100), `mín ${Math.min(...list.map(p => p.snaps.length))} atualizações em ${secs.toFixed(0)} s`);
  check('banda por cliente', avg < 40, `média ${avg.toFixed(1)} KB/s (máx ${Math.max(...kbps).toFixed(1)} KB/s)`);
  check('tempo do passo de simulação no servidor', tick < 8, `${tick} ms por passo (orçamento 16,7 ms)`);
  const full = list[0].latest()!;
  {
    const ss = list[0].snaps.slice(-100);
    const part = (k: string) => ss.reduce((a, x) => a + pack((x as any)[k] ?? null).length, 0) / ss.length;
    console.log('   bytes médios por atualização:', ['players', 'events', 'you', 'round', 'nades', 'bomb', 'doors'].map(k => `${k} ${part(k).toFixed(0)}`).join(', '), '| total', (ss.reduce((a, x) => a + pack(x).length, 0) / ss.length).toFixed(0));
    const evc: Record<string, number> = {};
    for (const x of ss) for (const e of x.events) evc[e.type as string] = (evc[e.type as string] ?? 0) + pack(e).length;
    console.log('   eventos (bytes em 100 atualizações):', JSON.stringify(evc));
  }
  check('interesse por distância reduz o que é enviado', full.players.length < 40, `cliente recebe ${full.players.length} de ${owner.room.players.length} participantes`);
  for (const p of list) p.game!.leave();
  await sleep(300);
}

// ====================================================================== segurança básica
if (want('security')) {
  console.log('\n— Segurança');
  const bad = await fetch(base + '/api/me', { headers: { Authorization: 'Bearer abc' } });
  check('API recusa token inválido', bad.status === 401);
  let e1 = '';
  try {
    const anon = new TestPlayer(base, 'anon');
    await anon.create({ settings: { mode: 'tdm' } });
  } catch (e) {
    e1 = (e as Error).message;
  }
  check('sala recusa quem não fez login', /login/i.test(e1), e1);
  const [a, b] = await players(2, 'seg');
  const ra = await a.create({ settings: { mode: 'tdm', mapId: 'dust_zone', bots: false, maxPlayers: 2 } });
  await b.join(ra.roomId);
  a.game!.send('start');
  await waitFor(() => b.snaps.length > 5);
  // comandos absurdos e rajada para "acelerar"
  const p0 = b.player(b.you)!;
  b.game!.send('cmd', { c: [{ seq: 'x' }, { seq: 1e12, mx: 99, my: 99, yaw: NaN }] });
  for (let i = 0; i < 20; i++) b.cmd({ my: 1, yaw: p0.yaw }, 8);
  await sleep(700);
  const p1 = b.player(b.you)!;
  const dist = Math.hypot(p1.x - p0.x, p1.z - p0.z);
  check('rajada de comandos não acelera o jogador', dist < 6, `${dist.toFixed(2)} m em 0,7 s (sem limite seriam ~${(160 / 60 * 5.6).toFixed(0)} m)`);
  // cosméticos acima do nível são descartados pelo servidor
  const put = await fetch(base + '/api/me', { method: 'PUT', headers: { Authorization: 'Bearer ' + a.token, 'Content-Type': 'application/json' }, body: JSON.stringify({ cosmetics: { ak47: 'plasma', m4a4: 'olive_drab', a_ak47: 'reddot.supp', lk_CT: 'helmet=helm_gold' } }) });
  const cj = await put.json();
  check('inventário: item acima do nível é recusado pelo servidor', !cj.cosmetics.ak47 && cj.cosmetics.m4a4 === 'olive_drab' && !cj.cosmetics.lk_CT, JSON.stringify(cj.cosmetics));
  const st = await (await fetch(base + '/api/status')).json();
  check('mensagens inválidas contadas', st.counters.rejectedMessages > 0 && st.counters.rateLimited > 0, `rejeitadas ${st.counters.rejectedMessages}, limitadas ${st.counters.rateLimited}`);
  ra.leave();
  b.game!.leave();
}

const code = summary();
await srv.close();
process.exit(code);
