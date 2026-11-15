// Configurações centrais do jogo. Todas as medidas em metros / segundos.
// Eixo X = comprimento (gol a gol), eixo Z = largura, eixo Y = altura.

export const FIELD = {
  length: 32,          // distância entre as linhas de fundo
  width: 18,           // distância entre as muretas laterais
  goalWidth: 3.2,      // largura da boca do gol
  goalHeight: 2.1,     // altura do travessão
  goalDepth: 1.3,      // profundidade da rede
  postRadius: 0.06,
  boardHeight: 1.0,    // mureta de concreto/madeira
  fenceHeight: 5.0,    // grade acima da mureta (altura total)
  centerCircle: 3,
  goalAreaRadius: 4.5,
  penaltySpot: 6
};

export const PHYSICS = {
  fixedStep: 1 / 60,   // passo fixo da simulação
  maxSteps: 5,         // evita "espiral da morte" em quedas de FPS
  gravity: 13.5        // gravidade levemente arcade (bola mais "pesada")
};

export const BALL = {
  radius: 0.17,              // um pouco maior que o real para leitura na câmera
  groundRestitution: 0.55,
  wallRestitution: 0.72,
  postRestitution: 0.78,
  netRestitution: 0.06,
  rollingFriction: 2.6,      // desaceleração (m/s²) rolando
  airDrag: 0.12,             // arrasto proporcional à velocidade no ar
  maxSpeed: 34,
  restVelocity: 0.05
};

export const TEAMS = {
  home: { name: 'CASA', short: 'CAS', color: '#e8412c', attacksPositiveX: true },
  away: { name: 'VISITANTE', short: 'VIS', color: '#1f7ae0', attacksPositiveX: false }
};

export const QUALITY = {
  // nível: [escala de hardware mínima, tamanho do mapa de sombra, partículas]
  high: { minScaling: 1, shadowMap: 1024, particles: 60, crowdAnim: true },
  medium: { minScaling: 1.35, shadowMap: 1024, particles: 35, crowdAnim: true },
  low: { minScaling: 1.8, shadowMap: 512, particles: 15, crowdAnim: false }
};
