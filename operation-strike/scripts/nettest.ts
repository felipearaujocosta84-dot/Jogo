// Teste de multiplayer: dois clientes WebSocket reais contra o servidor (npm start precisa estar rodando).
import WebSocket from 'ws';
import type { ServerMsg } from '../src/multiplayer/Protocol';
import type { Snapshot } from '../src/sim/types';

const URL = process.argv[2] ?? 'ws://localhost:8080/ws';
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

class Bot {
  ws: WebSocket;
  snap: Snapshot | null = null;
  you = '';
  code = '';
  events: { type: string; [k: string]: unknown }[] = [];
  seq = 0;
  constructor(public name: string) {
    this.ws = new WebSocket(URL);
    this.ws.on('message', d => {
      const m = JSON.parse(String(d)) as ServerMsg;
      if (m.t === 'room') this.code = m.room.code;
      if (m.t === 'start') this.you = m.you;
      if (m.t === 'snap') {
        this.snap = m.s;
        this.events.push(...(m.s.events as never[]));
      }
      if (m.t === 'error') console.log(this.name, 'erro:', m.msg);
    });
  }
  open() { return new Promise<void>(r => this.ws.on('open', () => r())); }
  send(m: unknown) { this.ws.send(JSON.stringify(m)); }
  me() { return this.snap?.players.find(p => p.id === this.you); }
  cmd(mx: number, my: number, yaw: number, pitch: number, buttons = 0) {
    this.send({ t: 'cmd', c: [{ seq: ++this.seq, mx, my, yaw, pitch, buttons, sel: 0, rt: this.snap?.tick }] });
  }
}

(async () => {
  const a = new Bot('Alfa'), b = new Bot('Bravo');
  await Promise.all([a.open(), b.open()]);
  a.send({ t: 'hello', name: 'Alfa', profileId: 'test-alfa' });
  b.send({ t: 'hello', name: 'Bravo', profileId: 'test-bravo' });
  await sleep(300);
  a.send({ t: 'create', mode: 'casual', mapId: 'dust_zone', difficulty: 'easy', isPublic: false });
  await sleep(300);
  console.log('sala criada:', a.code);
  b.send({ t: 'join', code: a.code });
  await sleep(300);
  b.send({ t: 'team', team: 'T' });
  a.send({ t: 'team', team: 'T' });
  await sleep(200);
  a.send({ t: 'start' });
  await sleep(1500);
  console.log('ids', a.you, b.you, 'jogadores no snapshot:', a.snap?.players.length, 'fase', a.snap?.round.phase);
  // espera o tempo de compra (casual = 8s)
  while (a.snap?.round.phase === 'freeze') { a.cmd(0, 0, 0, 0); b.cmd(0, 0, 0, 0); await sleep(50); }
  const startA = { ...a.me()! };
  // Alfa anda para frente 1,5 s a 60 comandos/s
  for (let i = 0; i < 90; i++) { a.cmd(0, 1, 0, 0); if (i % 2) b.cmd(0, 0, 0, 0); await sleep(16); }
  await sleep(300);
  const endA = a.me()!;
  const seenByB = b.snap!.players.find(p => p.id === a.you)!;
  console.log('Alfa andou (servidor):', (endA.z - startA.z).toFixed(2), 'm; Bravo vê Alfa em z =', seenByB.z.toFixed(2), '(ack', a.snap!.ack, ')');
  // Bravo mira em Alfa (fogo amigo no competitivo; no casual não há) -> troca: Bravo vai pro CT? usamos a faca/tiro só para ver evento de tiro
  const bm = b.me()!, am = b.snap!.players.find(p => p.id === a.you)!;
  const yaw = Math.atan2(am.x - bm.x, am.z - bm.z);
  for (let i = 0; i < 30; i++) { b.cmd(0, 0, yaw, 0, i % 2 ? 1 : 0); await sleep(16); }
  await sleep(400);
  const shots = b.events.filter(e => e.type === 'shot' && e.pid === b.you).length;
  console.log('tiros de Bravo confirmados pelo servidor:', shots, '| munição de Bravo:', b.snap!.you?.ammo, '| ping', b.snap!.players.find(p=>p.id===b.you)?.ping);
  // compra
  b.send({ t: 'buy', item: 'p250' });
  await sleep(400);
  console.log('Bravo comprou:', b.snap!.you?.slots.map(s => s.id).join(','), 'dinheiro', b.me()?.money);
  // reconexão: Bravo cai e volta com o token
  b.ws.close();
  await sleep(500);
  console.log('Bravo caiu; conectado no placar =', a.snap!.players.find(p => p.id === b.you)?.connected);
  a.ws.close();
  process.exit(0);
})();
