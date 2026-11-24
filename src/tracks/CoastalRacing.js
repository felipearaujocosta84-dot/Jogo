// =============================================================
// PISTA 4 — COASTAL RACING
// Circuito costeiro (4,5 km): ponte estaiada sobre a baía, orla,
// subida pela encosta, trecho urbano com prédios e calçadas e
// ponte sobre o canal do rio.
// =============================================================
export default {
  id: 'coastal',
  name: 'COASTAL RACING',
  shortName: 'Coastal',
  description: 'Ponte estaiada sobre a baía, orla, centro urbano com prédios e ponte sobre o canal.',
  environment: 'coastal',
  status: 'complete',
  width: 12,
  kerbWidth: 1.0,
  runoff: { width: 7, surface: 'GRASS' },
  barrier: { type: 'wall', height: 1.2 },
  defaultLaps: 2,
  checkpoints: 10,
  timeOfDay: 17.6,
  ambience: 'ocean',
  groundColor: [0.3, 0.42, 0.2],
  features: [
    { type: 'bridge', name: 'Ponte da Baía', from: 540, to: 1060, depth: 14, valleyWidth: 220, style: 'cable', water: true },
    { type: 'city', name: 'Centro', from: 1780, to: 3260 },
    { type: 'bridge', name: 'Ponte do Canal', from: 3600, to: 3800, depth: 13, valleyWidth: 70, style: 'arch', water: true },
  ],
  controlPoints: [
    [0, 5, 0], [400, 5, -20], [700, 6, -60], [950, 8, -40], [1150, 12, 60],
    [1250, 18, 250], [1200, 24, 420], [1000, 30, 500], [800, 32, 450], [600, 30, 520],
    [600, 28, 700], [400, 26, 760], [200, 22, 700], [150, 18, 550], [-50, 15, 500],
    [-250, 12, 560], [-450, 10, 480], [-500, 8, 300], [-400, 6, 140], [-250, 5, 40],
  ],
};
