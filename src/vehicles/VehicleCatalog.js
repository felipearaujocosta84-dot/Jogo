// =============================================================
// EXTREME RACING — VehicleCatalog
// Especificações físicas dos carros (dados puros). Os nomes são
// fictícios. Todos os valores estão em unidades SI.
// Eixos locais: X direita, Y cima, Z frente. Origem do corpo na
// altura do centro das rodas.
// =============================================================

const common = {
  wheelRadius: 0.34,
  wheelWidth: 0.27,
  suspension: {
    mountY: 0.30, // topo do curso da suspensão (local)
    restLength: 0.38,
    maxCompression: 0.2,
    stiffnessFront: 50000,
    stiffnessRear: 46000,
    bumpDamping: 3000,
    reboundDamping: 4600,
    antiRollFront: 19000,
    antiRollRear: 9000,
  },
  wheelInertia: 1.6,
  brakeBias: 0.68,
  handbrakeTorque: 5200,
  steerMaxDeg: 34,
  steerSpeedFactor: 17, // reduz o ângulo máximo com a velocidade
  steerRate: 4.2, // rad/s
  tire: { longB: 12, longC: 1.65, latB: 15, latC: 1.38, rolling: 0.012, rearGrip: 1.05 },
  forceHeight: 0.12, // altura (acima do contato) de aplicação das forças do pneu
  collider: { width: 1.9, height: 0.72, length: 4.35, centerY: 0.2 },
  comOffset: { x: 0, y: 0.02, z: 0.05 },
};

export const CARS = [
  {
    id: 'vortex',
    name: 'VORTEX GT',
    class: 'Esportivo',
    price: 0,
    description: 'Esportivo de motor dianteiro e tração traseira. Equilibrado e previsível.',
    model: 'vortex.glb',
    style: 'gt',
    mass: 1380,
    dims: { width: 1.92, length: 4.45, height: 1.26 },
    wheelbase: 2.6,
    trackFront: 1.62,
    trackRear: 1.6,
    weightFront: 0.52, // distribuição de massa
    drive: 'RWD',
    frontTorqueSplit: 0,
    lsd: { preload: 60, factor: 180 },
    engine: {
      idleRpm: 900, maxRpm: 7800, redline: 7500,
      torqueCurve: [[800, 300], [2000, 420], [3500, 500], [5000, 530], [6500, 480], [7500, 420], [7800, 380]],
      engineBrake: 120, inertia: 0.22, cylinders: 8,
    },
    transmission: { ratios: [3.25, 2.25, 1.68, 1.32, 1.08, 0.88], reverse: 3.1, finalDrive: 3.42, shiftTime: 0.24, efficiency: 0.88 },
    brakeTorque: 7600,
    tireGrip: 1.14,
    aero: { cdA: 0.66, clA: 0.45, balance: 0.45 },
    colors: { paint: '#c8102e', rim: '#2b2b2b' },
  },
  {
    id: 'stratos',
    name: 'STRATOS R9',
    class: 'Supercarro',
    price: 85000,
    description: 'Supercarro de motor central V8 biturbo. Rápido e agressivo nas curvas.',
    model: 'stratos.glb',
    style: 'super',
    mass: 1450,
    dims: { width: 1.98, length: 4.55, height: 1.18 },
    wheelbase: 2.68,
    trackFront: 1.66,
    trackRear: 1.64,
    weightFront: 0.43,
    drive: 'RWD',
    frontTorqueSplit: 0,
    lsd: { preload: 80, factor: 240 },
    engine: {
      idleRpm: 1000, maxRpm: 8800, redline: 8500,
      torqueCurve: [[900, 380], [2500, 620], [4000, 720], [6000, 715], [7500, 640], [8500, 560], [8800, 520]],
      engineBrake: 140, inertia: 0.2, cylinders: 8,
    },
    transmission: { ratios: [3.1, 2.2, 1.7, 1.38, 1.15, 0.97, 0.82], reverse: 3.0, finalDrive: 3.5, shiftTime: 0.16, efficiency: 0.9 },
    brakeTorque: 9000,
    tireGrip: 1.22,
    aero: { cdA: 0.72, clA: 1.1, balance: 0.42 },
    colors: { paint: '#f2b705', rim: '#111111' },
  },
  {
    id: 'zenith',
    name: 'ZENITH HX',
    class: 'Hipercarro',
    price: 240000,
    description: 'Hipercarro híbrido de tração integral, 900 cv e alto downforce.',
    model: 'zenith.glb',
    style: 'hyper',
    mass: 1520,
    dims: { width: 2.04, length: 4.7, height: 1.12 },
    wheelbase: 2.74,
    trackFront: 1.7,
    trackRear: 1.68,
    weightFront: 0.44,
    drive: 'AWD',
    frontTorqueSplit: 0.35,
    lsd: { preload: 90, factor: 260 },
    engine: {
      idleRpm: 1000, maxRpm: 9000, redline: 8800,
      torqueCurve: [[900, 600], [2000, 860], [3500, 1000], [5500, 990], [7000, 900], [8500, 760], [9000, 700]],
      engineBrake: 160, inertia: 0.2, cylinders: 12,
    },
    transmission: { ratios: [3.0, 2.15, 1.68, 1.37, 1.15, 0.98, 0.84], reverse: 2.9, finalDrive: 3.3, shiftTime: 0.1, efficiency: 0.9 },
    brakeTorque: 10500,
    tireGrip: 1.3,
    aero: { cdA: 0.78, clA: 2.0, balance: 0.43 },
    colors: { paint: '#1d4ed8', rim: '#c0c0c0' },
  },
  {
    id: 'apex',
    name: 'APEX RS',
    class: 'Carro de pista',
    price: 160000,
    description: 'Leve, aerodinâmica agressiva e câmbio curto. Feito para curvas rápidas.',
    model: 'apex.glb',
    style: 'super',
    wing: 2,
    mass: 1180,
    dims: { width: 1.92, length: 4.3, height: 1.12 },
    wheelbase: 2.56,
    trackFront: 1.64,
    trackRear: 1.62,
    weightFront: 0.42,
    drive: 'RWD',
    frontTorqueSplit: 0,
    lsd: { preload: 90, factor: 260 },
    engine: {
      idleRpm: 1200, maxRpm: 9200, redline: 9000,
      torqueCurve: [[1000, 330], [3000, 470], [5000, 540], [6800, 560], [8000, 520], [9000, 470], [9200, 440]],
      engineBrake: 120, inertia: 0.16, cylinders: 6,
    },
    transmission: { ratios: [2.9, 2.15, 1.7, 1.4, 1.18, 1.0], reverse: 2.9, finalDrive: 3.9, shiftTime: 0.09, efficiency: 0.91 },
    brakeTorque: 8600,
    tireGrip: 1.32,
    aero: { cdA: 0.8, clA: 2.4, balance: 0.44 },
    colors: { paint: '#e85d04', rim: '#111111' },
  },
  {
    id: 'titan',
    name: 'TITAN GT12',
    class: 'Grã-turismo',
    price: 120000,
    description: 'Grã-turismo V12 de 780 cv. Pesado e estável, enorme velocidade final.',
    model: 'titan.glb',
    style: 'gt',
    mass: 1780,
    dims: { width: 2.0, length: 4.95, height: 1.3 },
    wheelbase: 2.86,
    trackFront: 1.68,
    trackRear: 1.66,
    weightFront: 0.51,
    drive: 'RWD',
    frontTorqueSplit: 0,
    lsd: { preload: 70, factor: 200 },
    engine: {
      idleRpm: 800, maxRpm: 7400, redline: 7200,
      torqueCurve: [[800, 520], [2000, 720], [3500, 800], [5500, 790], [6800, 740], [7200, 700], [7400, 660]],
      engineBrake: 180, inertia: 0.3, cylinders: 12,
    },
    transmission: { ratios: [4.7, 3.1, 2.1, 1.67, 1.29, 1.0, 0.84, 0.67], reverse: 3.8, finalDrive: 2.85, shiftTime: 0.14, efficiency: 0.9 },
    brakeTorque: 10200,
    tireGrip: 1.18,
    aero: { cdA: 0.7, clA: 0.6, balance: 0.46 },
    colors: { paint: '#14532d', rim: '#c0c0c0' },
  },
  {
    id: 'volt',
    name: 'VOLT E-X',
    class: 'Hipercarro elétrico',
    price: 300000,
    description: 'Elétrico de 1000 cv com tração integral e torque instantâneo. Uma marcha só.',
    model: 'volt.glb',
    style: 'hyper',
    mass: 1720,
    dims: { width: 2.02, length: 4.65, height: 1.14 },
    wheelbase: 2.75,
    trackFront: 1.7,
    trackRear: 1.68,
    weightFront: 0.46,
    drive: 'AWD',
    frontTorqueSplit: 0.45,
    lsd: { preload: 80, factor: 240 },
    engine: {
      electric: true,
      idleRpm: 0, maxRpm: 18000, redline: 17500,
      torqueCurve: [[0, 1100], [6400, 1100], [8000, 880], [10000, 700], [12000, 585], [15000, 470], [18000, 380]],
      engineBrake: 260, inertia: 0.1, cylinders: 0,
    },
    transmission: { ratios: [1.0], reverse: 1.0, finalDrive: 7.2, shiftTime: 0.05, efficiency: 0.95 },
    brakeTorque: 10800,
    tireGrip: 1.28,
    aero: { cdA: 0.7, clA: 1.4, balance: 0.44 },
    colors: { paint: '#e5e7eb', rim: '#1d4ed8' },
  },
].map((c) => ({
  ...common,
  ...c,
  suspension: { ...common.suspension, ...(c.suspension || {}) },
  tire: { ...common.tire },
  // Caixa de colisão proporcional às dimensões de cada carro
  collider: { ...common.collider, width: c.dims.width - 0.06, length: c.dims.length - 0.12 },
}));

export function getCar(id) {
  return CARS.find((c) => c.id === id) ?? CARS[0];
}

/** Níveis de melhoria (0..3) e seus efeitos. */
export const UPGRADES = {
  engine: { label: 'Motor', costs: [12000, 26000, 48000], torque: [1, 1.08, 1.16, 1.25] },
  brakes: { label: 'Freios', costs: [6000, 14000, 26000], torque: [1, 1.12, 1.24, 1.36] },
  transmission: { label: 'Transmissão', costs: [8000, 17000, 30000], shift: [1, 0.78, 0.6, 0.45] },
  suspension: { label: 'Suspensão', costs: [7000, 15000, 28000], stiffness: [1, 1.12, 1.25, 1.38], grip: [1, 1.02, 1.04, 1.06] },
  aero: { label: 'Aerofólio', costs: [5000, 12000, 22000], downforce: [1, 1.35, 1.75, 2.2], drag: [1, 1.04, 1.08, 1.13] },
  tires: { label: 'Pneus', costs: [6000, 13000, 24000], grip: [1, 1.04, 1.08, 1.12] },
};

/**
 * Ajustes de setup (garagem). Valores inteiros de −2 a +2, exceto
 * brakeBias (fração na dianteira) e cambagens (graus negativos).
 */
export const SETUP_DEFAULT = {
  finalDrive: 0, brakeBias: null, springs: 0, rideHeight: 0, camberFront: 2.5, camberRear: 2.0,
  aeroBalance: 0, lsd: 0, tirePressure: 0,
};

/** Fator de aderência lateral e longitudinal pela cambagem (graus negativos). */
export function camberGrip(deg) {
  return {
    lat: 1 + 0.035 - 0.012 * (deg - 2.5) ** 2,
    long: 1 - 0.008 * deg,
  };
}

/** Aplica melhorias e setup à especificação base e retorna uma cópia. */
export function applyUpgrades(base, upgrades = {}, setup = null) {
  const u = { engine: 0, brakes: 0, transmission: 0, suspension: 0, aero: 0, tires: 0, ...upgrades };
  const spec = JSON.parse(JSON.stringify(base));
  spec.engine.torqueMultiplier = UPGRADES.engine.torque[u.engine];
  spec.brakeTorque *= UPGRADES.brakes.torque[u.brakes];
  spec.transmission.shiftTime *= UPGRADES.transmission.shift[u.transmission];
  const st = UPGRADES.suspension.stiffness[u.suspension];
  spec.suspension.stiffnessFront *= st;
  spec.suspension.stiffnessRear *= st;
  spec.suspension.antiRollFront *= st;
  spec.suspension.antiRollRear *= st;
  spec.suspension.bumpDamping *= Math.sqrt(st);
  spec.suspension.reboundDamping *= Math.sqrt(st);
  spec.suspension.restLength -= 0.015 * u.suspension; // rebaixamento
  spec.tireGrip *= UPGRADES.suspension.grip[u.suspension] * UPGRADES.tires.grip[u.tires];
  spec.aero.clA *= UPGRADES.aero.downforce[u.aero];
  spec.aero.cdA *= UPGRADES.aero.drag[u.aero];
  spec.upgrades = u;
  if (setup) applySetup(spec, setup);
  return spec;
}

export function applySetup(spec, setupIn) {
  const st = { ...SETUP_DEFAULT, ...setupIn };
  spec.transmission.finalDrive *= 1 + 0.04 * st.finalDrive; // + = relação curta (aceleração)
  if (st.brakeBias != null) spec.brakeBias = st.brakeBias;
  const k = 1 + 0.08 * st.springs;
  const susp = spec.suspension;
  susp.stiffnessFront *= k; susp.stiffnessRear *= k;
  susp.antiRollFront *= k; susp.antiRollRear *= k;
  susp.bumpDamping *= Math.sqrt(k); susp.reboundDamping *= Math.sqrt(k);
  susp.restLength += 0.01 * st.rideHeight;
  const cf = camberGrip(st.camberFront), cr = camberGrip(st.camberRear);
  spec.tire.latFront = cf.lat; spec.tire.longFront = cf.long;
  spec.tire.latRear = cr.lat; spec.tire.longRear = cr.long;
  // Pressão: mais alta = resposta mais rápida, pico um pouco menor
  spec.tire.latB *= 1 + 0.06 * st.tirePressure;
  spec.tireGrip *= 1 - 0.012 * st.tirePressure - 0.004 * Math.abs(st.tirePressure);
  spec.aero.balance = Math.min(0.6, Math.max(0.3, spec.aero.balance + 0.02 * st.aeroBalance));
  spec.lsd.factor *= 1 + 0.25 * st.lsd;
  spec.lsd.preload *= 1 + 0.25 * st.lsd;
  spec.setup = st;
  return spec;
}
