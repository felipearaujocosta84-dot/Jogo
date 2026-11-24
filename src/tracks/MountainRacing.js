// =============================================================
// PISTA 2 — MOUNTAIN RACING
// Estrada de montanha (4,5 km) com ~100 m de desnível, curvas
// fechadas, dois túneis, ponte sobre ravina, viaduto sobre o vale
// e um desfiladeiro com paredões de rocha.
// =============================================================
export default {
  id: 'mountain',
  name: 'MOUNTAIN RACING',
  shortName: 'Mountain',
  description: 'Serra com 2 túneis, ponte, viaduto sobre o vale, desfiladeiro e curvas fechadas.',
  environment: 'mountain',
  status: 'complete',
  width: 12,
  kerbWidth: 0.8,
  runoff: { width: 6, surface: 'DIRT' },
  barrier: { type: 'guardrail', height: 1.0 },
  defaultLaps: 2,
  checkpoints: 12,
  timeOfDay: 9.5,
  ambience: 'forest',
  groundColor: [0.2, 0.3, 0.14],
  // Trechos especiais (s em metros a partir da linha de chegada)
  features: [
    { type: 'bridge', name: 'Ponte da Ravina', from: 500, to: 660, depth: 18, valleyWidth: 90, style: 'arch' },
    { type: 'tunnel', name: 'Túnel do Pico', from: 1180, to: 1520 },
    { type: 'bridge', name: 'Viaduto do Vale', from: 2240, to: 2700, depth: 46, valleyWidth: 170, style: 'viaduct' },
    { type: 'tunnel', name: 'Túnel da Serra', from: 3420, to: 3600 },
    { type: 'gorge', name: 'Desfiladeiro', from: 3690, to: 4020, height: 42 },
  ],
  controlPoints: [
    [0, 40, 0], [300, 42, 0], [500, 48, -30], [650, 60, -120], [700, 75, -280],
    [620, 90, -420], [480, 100, -460], [380, 108, -560], [420, 118, -700], [560, 128, -760],
    [720, 135, -720], [860, 138, -800], [900, 132, -950], [800, 122, -1080], [620, 110, -1100],
    [450, 96, -1040], [300, 86, -1100], [150, 78, -1060], [60, 70, -930], [120, 62, -800],
    [60, 56, -680], [-80, 50, -650], [-200, 46, -560], [-180, 44, -420], [-300, 42, -320],
    [-320, 40, -180], [-200, 40, -60], [-100, 40, -10],
  ],
};
