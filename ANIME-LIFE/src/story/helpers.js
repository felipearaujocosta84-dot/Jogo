// Ajudantes para escrever roteiros sem repetição.
let n = 0;
/**
 * Ramifica por um valor (ex.: quem está acompanhando o protagonista).
 * map: { valor: [passos...], none: [passos se nenhum] }. Gera rótulos únicos automaticamente.
 */
export function compBranch(prefix, getter, map) {
  const id = `${prefix}_${++n}`;
  const steps = [];
  const keys = Object.keys(map).filter((k) => k !== 'none');
  for (const k of keys) steps.push({ if: (c) => getter(c) === k, go: `${id}_${k}` });
  steps.push({ go: `${id}_none` });
  for (const k of keys) steps.push({ label: `${id}_${k}` }, ...map[k], { go: `${id}_end` });
  steps.push({ label: `${id}_none` }, ...(map.none || []), { label: `${id}_end` });
  return steps;
}
