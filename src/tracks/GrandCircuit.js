// =============================================================
// PISTA 1 — GRAND INTERNATIONAL CIRCUIT
// Circuito profissional (~5,1 km), largura de 14 m, retas longas,
// grampo, esses técnicos, curva final longa. Dados puros: o
// ambiente 3D é construído em environments/CircuitEnvironment.js.
// Coordenadas em metros: [x, y(elevação), z].
// =============================================================
export default {
  id: 'grand',
  name: 'GRAND INTERNATIONAL CIRCUIT',
  shortName: 'Grand Circuit',
  description: 'Circuito profissional com arquibancadas, boxes, retas longas e curvas técnicas.',
  environment: 'circuit',
  status: 'complete',
  width: 14,
  kerbWidth: 1.2,
  runoff: { width: 14, surface: 'GRASS' },
  barrier: { type: 'wall', height: 1.3 },
  defaultLaps: 3,
  checkpoints: 10,
  timeOfDay: 15.5,
  ambience: 'crowd',
  groundColor: [0.24, 0.36, 0.16],
  controlPoints: [
    [0, 0, 0], [400, 0, 0], [750, 0, 0], [860, 0, 25], [900, 0, 110],
    [905, 0, 300], [920, 0, 520], [880, 0, 700], [760, 0, 800], [560, 0, 830],
    [300, 0, 800], [40, 0, 780], [-150, 0, 800], [-300, 0, 870], [-420, 0, 900],
    [-560, 0, 860], [-610, 0, 760], [-560, 0, 680], [-420, 0, 640], [-300, 0, 560],
    [-330, 0, 450], [-230, 0, 380], [-260, 0, 280], [-420, 0, 230], [-600, 0, 200],
    [-700, 0, 120], [-680, 0, 30], [-560, 0, 0], [-300, 0, 0],
  ],
};
