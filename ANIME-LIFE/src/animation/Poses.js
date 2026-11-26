// Escolha automática da pose dos braços a partir da fala e da emoção.
// O roteiro pode forçar: { c: R, pose: 'wave', t: 'Oi!' }.
import { EMOTIONS } from '../cinematic/Emotions.js';
import { POSES } from './poseList.js';

const norm = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const RULES = [
  ['wave', [/^(oi|ola|ei|tchau|ate (amanha|mais|logo)|boa noite|bom dia|boa tarde)\b/]],
  ['point', [/\b(olha (ali|aquilo|isso)|ali[,.!]|aquele ali|la fora|esse aqui)\b/]],
  ['explain', [/\b(entao|ou seja|veja bem|primeiro|segundo|o plano|funciona assim|porque)\b/]],
  ['argue', [/!.*!|\b(nao e justo|voce sempre|voce nunca|chega)\b/]],
  ['hand_mouth', [/^(o que|nossa|meu deus)|\?!/]],
  ['romantic', [/\b(gosto de voce|te amo|fica comigo|meu coracao)\b/]],
];

/** Retorna a pose desejada (pode não ter arte; quem desenha decide). */
export function poseFor({ explicit, text = '', emotion = 'neutral', holding = false }) {
  if (explicit && POSES.includes(explicit)) return explicit;
  if (holding) return 'hold';
  const t = norm(text);
  for (const [pose, pats] of RULES) if (pats.some((p) => p.test(t))) return pose;
  return EMOTIONS[emotion]?.pose || 'rest';
}
