// Percorre TODOS os caminhos dos roteiros de diálogo: nenhum nó faltando, nenhum laço sem fim,
// e todo caminho termina. Uso: node tools/dialogue-check.mjs
import rin, { rinIntro, rinAgain } from '../src/dialogue/scripts/rin.js';
import { objectScripts } from '../src/dialogue/scripts/objects.js';

let paths = 0, errors = 0;
function walk(script, ctx, id, seen = [], said = []) {
  if (seen.includes(id)) return; // volta a um menu já visitado (laço intencional, ex.: computador)
  const n = script.nodes[id];
  if (!n) { console.error(`❌ ${script.id}: nó "${id}" não existe (de ${seen.at(-1)})`); errors++; return; }
  if (typeof n.text !== 'string' || !n.text) { console.error(`❌ ${script.id}/${id}: sem texto`); errors++; }
  const choices = n.choices || [];
  if (choices.length) for (const c of choices) {
    if (c.end || !c.next) { paths++; continue; }
    walk(script, ctx, typeof c.next === 'function' ? c.next(ctx) : c.next, [...seen, id], [...said, c.text]);
  }
  else if (n.end || !n.next) { paths++; if (process.env.V) console.log(`  ${script.id}: ${[...seen, id].join(' > ')}  [${said.join(' / ')}]`); }
  else walk(script, ctx, typeof n.next === 'function' ? n.next(ctx) : n.next, [...seen, id], said);
}
const ctxs = [
  { flag: () => undefined, period: 'manhã', day: 1 },
  { flag: (k) => ({ 'rin.conheceu': true, 'rin.reacao': 'desconfiou' })[k], period: 'tarde', day: 1 },
  { flag: (k) => ({ 'rin.conheceu': true, 'rin.cha_pendente': true })[k], period: 'noite', day: 2 },
  { flag: (k) => ({ 'rin.conheceu': true, 'planta.regada_dia': 2 })[k], period: 'noite', day: 2 },
];
for (const ctx of ctxs) {
  for (const s of [rin(ctx), rinIntro, rinAgain]) walk(s, ctx, typeof s.start === 'function' ? s.start(ctx) : s.start);
  for (const [k, make] of Object.entries(objectScripts)) { const s = make(ctx); walk(s, ctx, s.start); }
}
console.log(errors ? `❌ ${errors} erro(s)` : `✅ Diálogos íntegros: ${paths} caminhos completos verificados`);
process.exit(errors ? 1 : 0);
