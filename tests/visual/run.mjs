// Abre a página de verificação no Chrome sem tela e salva as fotos em visual-out/
import puppeteer from 'puppeteer-core';
import { writeFileSync, mkdirSync } from 'node:fs';
const url = process.argv[2] ?? 'http://localhost:4173/';
mkdirSync('visual-out', { recursive: true });
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/google-chrome',
  headless: 'new',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--window-size=1280,720'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
page.on('console', (m) => console.log('[page]', m.type(), m.text()));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction('window.__out && window.__out.done', { timeout: 240000 });
const out = await page.evaluate(() => window.__out);
console.log(out.log.join('\n'));
writeFileSync('visual-out/log.txt', out.log.join('\n'));
for (const [k, v] of Object.entries(out.shots ?? {})) writeFileSync(`visual-out/${k}.png`, Buffer.from(v.split(',')[1], 'base64'));
await browser.close();
