// Abre a página de verificação no Chrome sem tela e salva as fotos em visual-out/
import puppeteer from 'puppeteer-core';
import { writeFileSync, mkdirSync } from 'node:fs';
const url = process.argv[2] ?? 'http://localhost:4173/';
mkdirSync('visual-out', { recursive: true });
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/google-chrome',
  headless: 'new',
  protocolTimeout: 900000,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--window-size=1280,720'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
page.on('console', (m) => console.log('[page]', m.type(), m.text()));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('response', (r) => { if (r.status() >= 400) console.log('[http]', r.status(), r.url()); });
await page.goto(url, { waitUntil: 'load' });
const t0 = Date.now();
let seen = 0;
for (;;) {
  const st = await page.evaluate(() => ({ done: !!window.__out?.done, log: window.__out?.log ?? [] }));
  for (; seen < st.log.length; seen++) console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s]`, st.log[seen]);
  if (st.done) break;
  if (Date.now() - t0 > 780000) { console.log('TEMPO ESGOTADO'); break; }
  await new Promise((r) => setTimeout(r, 3000));
}
const out = await page.evaluate(() => window.__out);
writeFileSync('visual-out/log.txt', out.log.join('\n'));
for (const [k, v] of Object.entries(out.shots ?? {})) writeFileSync(`visual-out/${k}.png`, Buffer.from(v.split(',')[1], 'base64'));
await browser.close();
