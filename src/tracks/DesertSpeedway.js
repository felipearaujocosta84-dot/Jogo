// =============================================================
// PISTA 3 — DESERT SPEEDWAY
// Speedway de 6,6 km com retas de altíssima velocidade, curvas
// amplas, cânion de arenito, ponte sobre leito seco, oásis,
// miragens no asfalto quente e tempestade de areia (clima).
// =============================================================
export default {
  id: 'desert',
  name: 'DESERT SPEEDWAY',
  shortName: 'Desert',
  description: 'Retas de 300 km/h, cânion de arenito, oásis, miragens e tempestades de areia.',
  environment: 'desert',
  status: 'complete',
  width: 16,
  kerbWidth: 1.2,
  runoff: { width: 16, surface: 'SAND' },
  barrier: { type: 'tirewall', height: 1.1 },
  defaultLaps: 2,
  checkpoints: 12,
  timeOfDay: 13,
  ambience: 'wind',
  groundColor: [0.76, 0.6, 0.38],
  weatherOptions: ['clear', 'sandstorm'],
  features: [
    { type: 'mirage', from: 60, to: 1250 },
    { type: 'oasis', name: 'Oásis', at: 2330, side: 1, distance: 190, radius: 60 },
    { type: 'gorge', name: 'Cânion Vermelho', from: 3250, to: 3850, height: 48, material: 'sandstone' },
    { type: 'mirage', from: 3890, to: 4480 },
    { type: 'bridge', name: 'Ponte do Leito Seco', from: 5180, to: 5340, depth: 11, valleyWidth: 80, style: 'arch' },
  ],
  controlPoints: [
    [0, 2, 0], [700, 2, 0], [1300, 3, 0], [1600, 5, 80], [1750, 8, 300],
    [1700, 10, 600], [1500, 12, 800], [1150, 10, 850], [900, 8, 1000], [800, 7, 1250],
    [550, 7, 1400], [150, 6, 1400], [-250, 6, 1350], [-500, 5, 1150], [-550, 5, 850],
    [-400, 4, 650], [-450, 3, 400], [-600, 3, 250], [-550, 2, 60], [-350, 2, 0],
  ],
};
