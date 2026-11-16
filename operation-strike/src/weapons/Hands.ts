// Mãos em primeira pessoa com luvas táticas pretas.
// Procedural (sempre disponível): palma, quatro dedos com três falanges dobrados em volta da empunhadura,
// polegar, proteção rígida nos nós dos dedos e tira de velcro no punho.
// Se public/assets/hands/tactical_gloves.glb existir, o modelo do arquivo é usado no lugar.
import { GeoBuilder, type V3 } from '../core/GeoBuilder';
import { Color3, Mesh, StandardMaterial, type Scene } from '../core/babylon';

const GLOVE = '#141518';
const GLOVE2 = '#1d1f23';
const ARMOR = '#2a2c31';
const STRAP = '#0d0e10';

let mat: StandardMaterial | null = null;

function material(scene: Scene): StandardMaterial {
  if (mat && mat.getScene() === scene) return mat;
  mat = new StandardMaterial('gloveMat', scene);
  mat.diffuseColor = Color3.White();
  mat.specularColor = new Color3(0.12, 0.12, 0.12);
  mat.specularPower = 24;
  mat.fogEnabled = false;
  return mat;
}

/**
 * Mão no espaço do braço: +Y aponta para o cotovelo, a mão se estende para -Y,
 * os dedos dobram para +Z (fechando em volta da empunhadura). side = 1 direita, -1 esquerda.
 */
export function buildHand(scene: Scene, side: 1 | -1, grip = 0.85): Mesh {
  const g = new GeoBuilder();
  const s = side;
  // palma e dorso
  g.box(0.078, 0.085, 0.034, [0, 0.0, 0], GLOVE);
  g.box(0.07, 0.05, 0.012, [0, 0.005, -0.021], ARMOR); // placa rígida no dorso
  g.box(0.074, 0.018, 0.02, [0, -0.036, -0.02], ARMOR); // proteção dos nós dos dedos
  // dedos: indicador, médio, anelar, mínimo
  const widths = [0.017, 0.018, 0.017, 0.015];
  const lengths = [0.026, 0.028, 0.026, 0.021];
  for (let f = 0; f < 4; f++) {
    const x = (-0.027 + f * 0.018) * s;
    let y = -0.045, z = 0.0;
    let ang = 0;
    for (let ph = 0; ph < 3; ph++) {
      const len = lengths[f] * (1 - ph * 0.18);
      ang += grip * (ph === 0 ? 0.9 : 0.75); // cada falange dobra mais para dentro
      const cy = y - Math.cos(ang) * len * 0.5, cz = z + Math.sin(ang) * len * 0.5;
      const rot: V3 = [ang, 0, 0];
      g.box(widths[f], len, widths[f] * 1.05, [x, cy, cz], ph === 2 ? GLOVE2 : GLOVE, rot);
      y -= Math.cos(ang) * len;
      z += Math.sin(ang) * len;
    }
  }
  // polegar (lado de dentro), apontando para frente/baixo
  g.box(0.02, 0.034, 0.02, [0.036 * s, -0.012, 0.014], GLOVE, [0.5, 0, 0.55 * s]);
  g.box(0.018, 0.026, 0.018, [0.047 * s, -0.036, 0.03], GLOVE2, [0.9, 0, 0.5 * s]);
  // punho com tira de velcro
  g.cyl(0.074, 0.08, 0.04, [0, 0.06, 0], GLOVE);
  g.box(0.082, 0.016, 0.06, [0, 0.062, 0.0], STRAP);
  const m = g.build('glove_' + (s > 0 ? 'R' : 'L'), scene);
  m.material = material(scene);
  return m;
}
