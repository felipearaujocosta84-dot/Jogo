// Teste de fumaça automatizado (Playwright + Chromium) num celular Android em paisagem.
// Uso: npm test   (gera o build, sobe um servidor local e joga o fluxo principal)
// Capturas de tela vão para test-results/.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'test-results');
fs.mkdirSync(OUT, { recursive: true });
const PORT = 4179;
const results = [];
const ok = (name, cond, extra = '') => { results.push({ name, pass: !!cond, extra }); console.log(`${cond ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`); };

(async () => {
  const server = spawn(process.execPath, [require('path').join(ROOT, 'node_modules/vite/bin/vite.js'), 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'pipe' });
  await new Promise((r) => { server.stdout.on('data', (d) => { if (String(d).includes(String(PORT))) r(); }); setTimeout(r, 8000); });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [], failed = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('requestfailed', (r) => { if (!r.url().includes('fonts.g')) failed.push(r.url()); });
  page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
  const shot = (n) => page.screenshot({ path: path.join(OUT, `${n}.png`) });
  const G = (fn, arg) => page.evaluate(fn, arg);
  const player = () => G(() => { const s = window.__ANIME_LIFE__.ui.scene; return { x: s.player.x, y: s.player.y, facing: s.player.facing }; });
  const tap = async (sel) => { const l = page.locator(sel).first(); await l.scrollIntoViewIfNeeded().catch(() => {}); const b = await l.boundingBox(); await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); };

  try {
    await page.goto(`http://localhost:${PORT}/`);
    await page.waitForSelector('#splash.show');
    await shot('01-splash');
    await tap('#splash');
    await page.waitForSelector('#menu.show');
    await page.waitForTimeout(1500);
    await shot('02-menu');
    ok('Menu principal exibe 4 opções', (await page.locator('#menu .mbtn').count()) === 4);
    ok('Continuar desativado sem save', await page.locator('[data-a=continue]').isDisabled());
    const lineup = await G(() => [...document.querySelectorAll('#menu .lineup img')].map((i) => i.complete && i.naturalWidth > 0));
    ok('Imagens dos personagens no menu carregadas', lineup.length === 3 && lineup.every(Boolean));

    // configurações e créditos
    await tap('[data-a=settings]'); await page.waitForSelector('.modal.show'); await shot('03-settings');
    await tap('.modal.show .close'); await page.waitForTimeout(400);
    await tap('[data-a=credits]'); await page.waitForSelector('.modal.show'); await shot('04-credits');
    await tap('.modal.show .close'); await page.waitForTimeout(400);
    ok('Configurações e créditos abrem/fecham', (await page.locator('.modal').count()) === 0);

    // criação do protagonista
    await tap('[data-a=new]');
    await page.waitForSelector('#create.show');
    await tap('[data-a=ok]');
    ok('Validação de nome vazio', (await page.locator('#create .err').textContent()).length > 0);
    await page.fill('#f-name', 'Aiko Tanaka');
    await tap('.picker[data-k=hairStyle] [data-d="1"]');
    await tap('.swatches[data-k=hairColor] [data-v=azul]');
    await page.waitForTimeout(800);
    await shot('05-create');
    ok('Nome de exibição preenchido automaticamente', (await page.inputValue('#f-disp')) === 'Aiko');
    await tap('[data-a=ok]');
    await page.waitForFunction(() => window.__ANIME_LIFE__.ui.scene, null, { timeout: 15000 });
    await page.waitForTimeout(1200);
    await shot('06-apartment');
    const st = await G(() => window.__ANIME_LIFE__.game.state.protagonist);
    ok('Protagonista criado', st.name === 'Aiko Tanaka' && st.displayName === 'Aiko' && st.appearance.hairStyle === 'medio' && st.appearance.hairColor === 'azul');
    ok('HUD visível', await page.locator('#hud:not(.hidden)').count() === 1);

    // movimento pelo joystick (toque real, multitoque via CDP)
    const cdp = await ctx.newCDPSession(page);
    const joy = await page.locator('.joy-base').boundingBox();
    const jx = joy.x + joy.width / 2, jy = joy.y + joy.height / 2;
    const p0 = await player();
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: jx, y: jy, id: 1 }] });
    for (let i = 1; i <= 6; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: jx + i * 10, y: jy, id: 1 }] }); await page.waitForTimeout(16); }
    await page.waitForTimeout(500);
    const anim = await G(() => window.__ANIME_LIFE__.ui.scene.player.sprite.anims.currentAnim.key);
    await shot('07-walking');
    await page.waitForTimeout(300);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(200);
    const p1 = await player();
    ok('Joystick move o protagonista para a direita', p1.x - p0.x > 40, `Δx=${(p1.x - p0.x).toFixed(1)}`);
    ok('Animação de caminhada ativa durante o movimento', anim === 'walk-right', anim);
    const idle = await G(() => window.__ANIME_LIFE__.ui.scene.player.sprite.anims.currentAnim.key);
    ok('Animação de espera ao soltar', idle === 'idle-right', idle);

    // colisão com a parede de cima (teclado), numa área sem móveis
    await G(() => window.__ANIME_LIFE__.ui.scene.player.sprite.body.reset(190, 220));
    await page.keyboard.down('w'); await page.waitForTimeout(2500); await page.keyboard.up('w');
    const p2 = await player();
    ok('Colisão com parede (não atravessa o topo do quarto)', p2.y >= 64 && p2.y < 80, `y=${p2.y.toFixed(1)}`);
    // colisão com a cama
    await G(() => { const s = window.__ANIME_LIFE__.ui.scene; s.player.sprite.body.reset(150, 150); });
    await page.keyboard.down('a'); await page.waitForTimeout(1500); await page.keyboard.up('a');
    const p3 = await player();
    ok('Colisão com móvel (cama)', p3.x >= 94 + 8, `x=${p3.x.toFixed(1)} (borda da cama = 94)`);
    // câmera segue
    await G(() => window.__ANIME_LIFE__.ui.scene.player.sprite.body.reset(450, 200));
    await page.waitForTimeout(1200);
    const cam = await G(() => { const s = window.__ANIME_LIFE__.ui.scene; const c = s.cameras.main; const half = c.width / c.zoom / 2; const W = s.builder.W;
      return { mid: c.midPoint.x, expected: Math.max(half, Math.min(W - half, s.player.x)) }; });
    ok('Câmera acompanha o jogador (respeitando as bordas do mapa)', Math.abs(cam.mid - cam.expected) < 6, JSON.stringify(cam));

    // interação com objeto: computador
    await G(() => window.__ANIME_LIFE__.ui.scene.player.sprite.body.reset(268, 150));
    await page.waitForTimeout(300);
    ok('Botão contextual aparece perto do computador', (await page.locator('#btn-act.show').textContent()).includes('Usar PC'));
    await tap('#btn-act');
    await page.waitForSelector('.dl-box.show');
    await page.waitForSelector('.dl-choices button');
    await shot('08-computer');
    await tap('.dl-choices button:nth-child(1)');
    await page.waitForTimeout(200); await tap('.dl-box'); await page.waitForTimeout(150); await tap('.dl-box');
    await page.waitForSelector('.dl-choices button');
    await tap('.dl-choices button:nth-child(3)');
    await page.waitForTimeout(500);
    ok('Diálogo de objeto fecha e devolve o controle', await G(() => !window.__ANIME_LIFE__.ui.scene.frozen));

    // andar até a Rin de verdade (rota pelas portas) com teclado
    await G(() => window.__ANIME_LIFE__.ui.scene.player.sprite.body.reset(300, 224));
    const hold = async (k, ms) => { await page.keyboard.down(k); await page.waitForTimeout(ms); await page.keyboard.up(k); };
    await hold('d', 1500);  // atravessa a porta quarto→sala
    await hold('s', 700);   // passa por baixo do sofá
    await hold('d', 1250);
    await hold('s', 1300);  // desce pela passagem sala→entrada
    await hold('d', 300);
    const pr = await player();
    const near = await page.locator('#btn-act.show').count();
    await shot('09-near-rin');
    ok('Caminho até a Rin percorrido andando', pr.y > 384, `pos=${pr.x.toFixed(0)},${pr.y.toFixed(0)}`);
    if (!near || !(await page.locator('#btn-act').textContent()).includes('Conversar')) {
      await G(() => window.__ANIME_LIFE__.ui.scene.player.sprite.body.reset(650, 476)); await page.waitForTimeout(300);
    }
    ok('Botão "Conversar" perto da personagem oficial', (await page.locator('#btn-act.show').textContent()).includes('Conversar'));

    // diálogo com a Rin
    await tap('#btn-act');
    await page.waitForSelector('.dl-box.show');
    const advanceUntilChoices = async () => {
      for (let i = 0; i < 12; i++) {
        if (await page.locator('.dl-choices button').count()) return true;
        await tap('.dl-box'); await page.waitForTimeout(120);
        if (await page.locator('.dl-choices button').count()) return true;
        await tap('.dl-box'); await page.waitForTimeout(120);
      }
      return false;
    };
    await tap('.dl-box'); await page.waitForTimeout(100);
    await tap('.dl-box'); await page.waitForTimeout(100);
    await advanceUntilChoices();
    const portraitOk = await G(() => { const i = document.querySelector('.dl-portrait img'); return i.complete && i.naturalWidth > 0 && i.src.includes('character_01'); });
    await shot('10-dialogue-choices');
    const q = await page.locator('.dl-text').textContent();
    ok('Pergunta da Rin exibida', q.includes('Você acabou de se mudar para cá?'), q);
    ok('Retrato original da Rin carregado', portraitOk);
    const choices = await page.locator('.dl-choices button').allTextContents();
    ok('3 opções de resposta', choices.length === 3, choices.join(' | '));
    await tap('.dl-choices button:nth-child(1)');
    await page.waitForTimeout(150);
    await tap('.dl-box'); await page.waitForTimeout(200);
    const reply = await page.locator('.dl-text').textContent();
    await shot('11-dialogue-reply');
    ok('Resposta coerente à escolha 1', reply.includes('caminhão de mudança'), reply);
    await advanceUntilChoices();
    await tap('.dl-choices button:nth-child(1)');
    for (let i = 0; i < 12 && await G(() => !!window.__ANIME_LIFE__.ui.dialogue.runner); i++) { await tap('.dl-box'); await page.waitForTimeout(140); }
    await page.waitForTimeout(500);
    const s2 = await G(() => { const g = window.__ANIME_LIFE__.game.state; return { flags: g.flags, decisions: g.decisions, inv: g.inventory.map((i) => i.id), contacts: g.contacts, rel: g.relationships.character_01 }; });
    ok('Decisões registradas', s2.decisions.length === 2 && s2.flags['rin.mudanca'] === 'hoje' && s2.flags['rin.reacao'] === 'agradeceu', JSON.stringify(s2.decisions.map((d) => d.value)));
    ok('Item recebido + contato salvo', s2.inv.includes('package') && s2.contacts.includes('character_01'));
    ok('Afinidade com a Rin aumentou', s2.rel.affinity === 5 && s2.rel.met, JSON.stringify(s2.rel));
    await shot('12-after-dialogue');

    // celular e inventário
    await tap('#btn-phone'); await page.waitForSelector('.modal.show .phone'); await tap('[data-a=contacts]'); await page.waitForTimeout(400);
    await shot('13-phone');
    ok('Contato da Rin aparece no celular', (await page.locator('.contact').count()) === 1);
    await G(() => document.querySelector('.modal.show').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
    await page.waitForTimeout(400);
    await tap('#btn-bag'); await page.waitForSelector('.modal.show .inv-grid'); await page.waitForTimeout(300);
    await shot('14-inventory');
    ok('Inventário mostra 3 itens', (await page.locator('.slot').count()) === 3);
    await tap('.modal.show .close'); await page.waitForTimeout(400);

    // dormir → dia 2, Rin vai embora, salvamento
    await G(() => window.__ANIME_LIFE__.ui.scene.player.sprite.body.reset(130, 140));
    await page.waitForTimeout(300);
    ok('Botão "Dormir" perto da cama', (await page.locator('#btn-act.show').textContent()).includes('Dormir'));
    await tap('#btn-act'); await page.waitForSelector('.dl-choices button'); await tap('.dl-choices button:nth-child(1)');
    await page.waitForFunction(() => window.__ANIME_LIFE__.game.state.time.day === 2, null, { timeout: 8000 });
    await page.waitForTimeout(2600);
    const npcs = await G(() => window.__ANIME_LIFE__.ui.scene.npcs.length);
    ok('Dormir avança para o dia 2 e a Rin não está mais no apartamento', npcs === 0);
    await shot('15-day2');

    // recarregar → continuar
    await page.reload();
    await page.waitForSelector('#splash.show'); await tap('#splash'); await page.waitForSelector('#menu.show');
    await page.waitForTimeout(300);
    ok('Continuar ativo com save', !(await page.locator('[data-a=continue]').isDisabled()), await page.locator('[data-a=continue] small').textContent());
    await tap('[data-a=continue]');
    await page.waitForFunction(() => window.__ANIME_LIFE__.ui.scene, null, { timeout: 15000 });
    await page.waitForTimeout(800);
    const s3 = await G(() => { const g = window.__ANIME_LIFE__.game.state; return { day: g.time.day, contacts: g.contacts, name: g.protagonist.displayName }; });
    ok('Save carregado (IndexedDB)', s3.day === 2 && s3.contacts.length === 1 && s3.name === 'Aiko', JSON.stringify(s3));
    await shot('16-continue');

    // desempenho básico
    const fps = await G(() => window.__ANIME_LIFE__.ui.engine.loop.actualFps);
    ok('FPS no headless (referência)', fps > 30, fps.toFixed(1));
  } catch (e) {
    ok('Execução sem exceções', false, String(e.stack || e));
    await shot('99-failure').catch(() => {});
  }
  ok('Sem erros no console', errors.length === 0, errors.slice(0, 5).join(' || '));
  ok('Sem arquivos faltando', failed.length === 0, failed.slice(0, 5).join(' || '));
  await browser.close();
  server.kill();
  const bad = results.filter((r) => !r.pass);
  console.log(`\n${results.length - bad.length}/${results.length} verificações passaram.`);
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(results, null, 2));
  process.exit(bad.length ? 1 : 0);
})();
