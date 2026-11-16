// Gera public/assets/manifest.json com a lista dos recursos existentes (rodado antes do build).
// Assim o jogo sabe o que existe sem fazer dezenas de consultas que dariam "404" — carregamento mais rápido no celular.
import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('../public/assets/', import.meta.url).pathname;
const skip = new Set(['.gitkeep', 'README.md', 'CREDITS.md', 'manifest.json']);
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (!skip.has(name)) files.push(relative(root, p).split('\\').join('/'));
  }
})(root);
files.sort();
writeFileSync(join(root, 'manifest.json'), JSON.stringify({ generated: new Date().toISOString(), files }, null, 1));
console.log(`assets/manifest.json: ${files.length} arquivo(s)`);
