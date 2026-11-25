// Sistema de emoções: liga cada fala a uma expressão, postura, olhar e movimento.
// O roteiro pode definir a emoção (e: 'sad'); se não definir, ela é deduzida do texto.
// A mesma emoção é usada pelo palco 2D (ilustrações) e pelo 3D (modelos VRM).

export const EMOTIONS = {
  neutral:     { label: 'Neutra',            vrm: {},                                   pose: 'rest',      gaze: 'partner', emote: '' },
  happy:       { label: 'Sorrindo',          vrm: { happy: 0.85 },                      pose: 'open',      gaze: 'partner', emote: '♪' },
  shy:         { label: 'Sorriso tímido',    vrm: { happy: 0.45, relaxed: 0.35, blush: 0.8 }, pose: 'hands_front', gaze: 'down', emote: '' },
  embarrassed: { label: 'Envergonhada(o)',   vrm: { relaxed: 0.3, sad: 0.15, blush: 1 }, pose: 'hand_neck', gaze: 'away', emote: '///' },
  sad:         { label: 'Triste',            vrm: { sad: 0.85 },                        pose: 'hand_chest', gaze: 'down', emote: '💧' },
  hurt:        { label: 'Decepcionada(o)',   vrm: { sad: 0.7, angry: 0.2 },             pose: 'arms_low',  gaze: 'away', emote: '💧' },
  angry:       { label: 'Irritada(o)',       vrm: { angry: 0.85 },                      pose: 'arms_crossed', gaze: 'partner', emote: '💢' },
  surprised:   { label: 'Surpresa(o)',       vrm: { surprised: 0.9 },                   pose: 'hand_mouth', gaze: 'partner', emote: '!' },
  love:        { label: 'Apaixonada(o)',     vrm: { happy: 0.5, relaxed: 0.5, blush: 1 }, pose: 'hand_chest', gaze: 'partner_soft', emote: '♡' },
  lookaway:    { label: 'Desviando o olhar', vrm: { relaxed: 0.25, blush: 0.4 },        pose: 'hands_front', gaze: 'away', emote: '' },
  curious:     { label: 'Curiosa(o)',        vrm: { surprised: 0.25 },                  pose: 'hand_chin', gaze: 'partner', emote: '?' },
  serious:     { label: 'Séria(o)',          vrm: { angry: 0.2, sad: 0.15 },            pose: 'rest',      gaze: 'partner', emote: '…' },
};

/** Emoções "fortes": o diretor de câmera tende a usar close-up nelas. */
export const STRONG = new Set(['surprised', 'sad', 'hurt', 'angry', 'love', 'embarrassed', 'shy']);

const norm = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const RULES = [
  // [emoção, intensidade, padrões (texto já sem acento e em minúsculas)]
  ['shy', 0.9, [/saudade/, /senti sua falta/]],
  ['love', 1, [/gosto (muito )?de voce/, /te amo/, /meu coracao/, /estou apaixonad/]],
  ['hurt', 1, [/por que voce fez isso/, /como (voce )?pode/, /me decepcion/, /confiei em voce/, /mentiu pra mim/]],
  ['angry', 0.9, [/\bodeio\b/, /cala a boca/, /\bidiota\b/, /nunca mais/, /me deixa em paz/, /que absurdo/]],
  ['surprised', 0.9, [/^(o que|o que\?|como assim|serio\?|serio|nossa|agora\?)/, /voce esta falando serio/, /\?!|!\?/, /^\.\.\.\d*\s*\d+\?$/]],
  ['embarrassed', 0.8, [/^desculpa/, /que vergonha/, /^e-e/, /^o-o/, /isso foi\.\.\. uma/]],
  ['sad', 0.8, [/sinto muito/, /sozinh/, /foi embora/, /nao subiu mais/, /\bchorei\b/, /faz um ano/]],
  ['happy', 0.8, [/obrigad/, /\bhaha\b|\bha\.\s/, /que bom/, /adorei/, /isso!+/, /boas-vindas/]],
];

/** Deduz a emoção de uma fala. Retorna { emotion, intensity, inferred: true }. */
export function inferEmotion(text) {
  const t = norm(String(text).trim());
  for (const [emotion, intensity, pats] of RULES) if (pats.some((p) => p.test(t))) return { emotion, intensity, inferred: true };
  if (/\?$/.test(t)) return { emotion: 'curious', intensity: 0.6, inferred: true };
  if (/^\.\.\./.test(t)) return { emotion: 'serious', intensity: 0.5, inferred: true };
  if (/!$/.test(t)) return { emotion: 'happy', intensity: 0.5, inferred: true };
  return { emotion: 'neutral', intensity: 0.5, inferred: true };
}

/** Emoção final de uma fala: a do roteiro, se houver; senão, deduzida. */
export function emotionFor(explicit, text) {
  if (explicit && EMOTIONS[explicit]) return { emotion: explicit, intensity: 1, inferred: false };
  return inferEmotion(text);
}
