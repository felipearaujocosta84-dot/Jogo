// Procura mortes causadas por companheiros de time (não deve haver nenhuma).
import { MatchSim } from '../src/sim/MatchSim';
for (const mode of ['competitive', 'casual'] as const)
  for (const mapId of ['dust_zone', 'factory', 'skyscraper']) {
    const m = new MatchSim({ mapId, mode, difficulty: 'hard', teamSize: 5 });
    m.addPlayer('Humano', { team: 'CT', id: 'local' });
    m.fillBots();
    m.start();
    let tk = 0, dmg = 0, total = 0;
    const samples: string[] = [];
    while (m.phase !== 'over') {
      // humano parado (só para ter um alvo humano no time)
      m.pushCmd('local', { seq: m.tick + 1, mx: 0, my: 0, yaw: 0, pitch: 0, buttons: 0, sel: 0 });
      m.step();
      for (const e of m.takeEvents()) {
        if (e.type === 'kill') {
          total++;
          const k = m.byId(e.killer as string), v = m.byId(e.victim as string);
          if (k && v && k !== v && k.team === v.team) {
            tk++;
            if (samples.length < 5) samples.push(`${k.name}->${v.name} arma ${e.weapon}`);
          }
        }
        if (e.type === 'damage') {
          const a = m.byId(e.by as string), v = m.byId(e.pid as string);
          if (a && v && a !== v && a.team === v.team) dmg++;
        }
      }
    }
    console.log(mode, mapId, 'mortes', total, 'mortes por companheiro', tk, 'danos em companheiro', dmg, samples.join(' | '));
  }
