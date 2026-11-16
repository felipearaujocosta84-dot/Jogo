// Teste sem gráficos: roda partidas inteiras só com bots e mostra o resultado.
import { readFileSync } from 'node:fs';
import { MatchSim } from '../src/sim/MatchSim';
import { MAPS } from '../src/maps/maps';
import { applyModelData } from '../src/maps/ModelMaps';
import type { Difficulty } from '../src/sim/types';

const mapId = process.argv[2] ?? 'dust_zone';
const diff = (process.argv[3] ?? 'normal') as Difficulty;
const mode = (process.argv[4] ?? 'competitive') as 'competitive' | 'casual' | 'tdm';
const def = MAPS[mapId];
if (def?.model) applyModelData(def, JSON.parse(readFileSync(new URL('../public/assets/' + def.model.data, import.meta.url), 'utf8')));
const m = new MatchSim({ mapId, mode, difficulty: diff, teamSize: 5, timeLimit: +(process.argv[5] ?? 10), killLimit: +(process.argv[6] ?? 50) });
m.fillBots();
m.start();
const counts: Record<string, number> = {};
const reasons: Record<string, number> = {};
const t0 = Date.now();
let steps = 0;
while (m.phase !== 'over' && steps < 60 * 60 * 60) {
  m.step();
  steps++;
  for (const e of m.takeEvents()) {
    counts[e.type] = (counts[e.type] ?? 0) + 1;
    if (e.type === 'round_end') {
      reasons[e.reason as string] = (reasons[e.reason as string] ?? 0) + 1;
      console.log(`R${m.roundNumber} ${e.winner} por ${e.reason}  placar T ${e.scoreT} x ${e.scoreCT} CT  (t=${(m.time / 60).toFixed(1)}min)`);
    }
  }
}
console.log('fim:', JSON.stringify(m.result?.winner), 'tempo de jogo', (m.time / 60).toFixed(1), 'min; cpu', ((Date.now() - t0) / 1000).toFixed(1), 's; ms/tick', ((Date.now() - t0) / steps).toFixed(3));
console.log('eventos', JSON.stringify(counts));
console.log('motivos', JSON.stringify(reasons));
for (const p of m.result?.players ?? []) console.log(p.team, p.name.padEnd(14), 'K', p.kills, 'D', p.deaths, 'A', p.assists, 'HS', p.headshots, 'MVP', p.mvps);
