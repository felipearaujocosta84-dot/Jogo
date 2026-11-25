// Teste no navegador (Playwright + Chromium) simulando um celular Android em paisagem.
// Joga o Capítulo 1 inteiro tocando na tela, testa salvar/carregar/continuar, painéis e galeria.
// Uso: npm test   ·   capturas em test-results/
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'test-results');
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const PORT = 4179;
const results = [];
const ok = (name, cond, extra = '') => { results.push({ name, pass: !!cond, extra }); console.log(`${cond ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`); };

(async () => {
  const server = spawn(process.execPath, [path.join(ROOT, 'node_modules/vite/bin/vite.js'), 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'pipe' });
  await new Promise((r) => { server.stdout.on('data', (d) => { if (String(d).includes(String(PORT))) r(); }); setTimeout(r, 8000); });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [], failed = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
  const shot = (n) => page.screenshot({ path: path.join(OUT, `${n}.png`) });
  const G = (fn, arg) => page.evaluate(fn, arg);
  const tap = async (sel) => { const l = page.locator(sel).first(); await l.scrollIntoViewIfNeeded().catch(() => {}); const b = await l.boundingBox(); await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); };
  const text = () => page.locator('.dl-text').textContent();
  const visible = (sel) => page.locator(sel).first().isVisible().catch(() => false);
  const st = () => G(() => window.__ANIME_LIFE__.game.state);
  // avança até aparecer escolha / celular / fim de capítulo
  const until = async (pred, max = 80) => {
    for (let i = 0; i < max; i++) {
      if (await pred()) return true;
      if (await visible('.dl-box.show')) await tap('.dl-box'); else await page.waitForTimeout(150);
      await page.waitForTimeout(90);
    }
    return pred();
  };
  const hasChoices = () => page.locator('.choices button').count().then((n) => n > 0);

  try {
    await page.goto(`http://localhost:${PORT}/`);
    await page.waitForSelector('#splash.show');
    await tap('#splash');
    await page.waitForSelector('#menu.show'); await page.waitForTimeout(1300);
    await shot('01-menu');
    ok('Menu: Continuar escondido sem jogo salvo', !(await visible('[data-a=continue]')));
    ok('Menu: Novo jogo, Carregar, Galeria, Ajustes, Créditos', (await page.locator('#menu .mbtn:visible').count()) === 5);
    for (const a of ['settings', 'credits', 'gallery', 'load']) { await tap(`[data-a=${a}]`); await page.waitForSelector('.modal.show'); await page.waitForTimeout(250); await tap('.modal.show .close'); await page.waitForTimeout(300); }
    ok('Menu: ajustes, créditos, galeria e carregar abrem e fecham', (await page.locator('.modal').count()) === 0);

    // novo jogo
    await tap('[data-a=new]'); await page.waitForSelector('#newgame.show');
    await tap('#newgame [data-a=ok]');
    ok('Novo jogo: valida nome vazio', (await page.locator('#newgame .err').textContent()).length > 0);
    await page.fill('#f-name', 'Aiko Tanaka');
    await tap('#f-pron [data-v=ela]');
    await shot('02-novo-jogo');
    await tap('#newgame [data-a=ok]');
    await page.waitForSelector('#cover.on', { timeout: 15000 });
    await page.waitForTimeout(600); await shot('03-capitulo');
    await page.waitForSelector('.dl-box.show', { timeout: 15000 });
    await page.waitForTimeout(800);
    await shot('04-primeira-cena');
    const s0 = await st();
    ok('Capítulo 1 começou na primeira cena', s0.pos.chapter === 'ch1' && s0.pos.scene === 'c1s1');
    ok('Cenário desenhado', await G(() => window.__ANIME_LIFE__.ui.engine.stage.bgKey === 'apartamento'));
    // digitação: tocar completa o texto, tocar de novo avança
    await page.waitForTimeout(100);
    const partial = await text();
    await tap('.dl-box'); await page.waitForTimeout(80);
    const full = await text();
    ok('Texto digitando + toque completa', partial.length < full.length && full.startsWith('Hoshizora'), `${partial.length}→${full.length}`);
    await tap('.dl-box'); await page.waitForTimeout(300);
    ok('Toque avança para a próxima fala', (await text()) !== full);

    // até a Rin aparecer e a primeira escolha
    await until(hasChoices);
    const chars = await G(() => [...window.__ANIME_LIFE__.ui.engine.stage.chars.keys()]);
    ok('Personagem oficial em destaque (Rin, ilustração original)', chars.includes('character_01'));
    await shot('05-escolha');
    // ---- animação 2D da ilustração original ----
    const animInfo = await G(() => { const c = window.__ANIME_LIFE__.ui.engine.stage.chars.get('character_01'); return { type: c.img.type, anim: !!c.anim, key: c.img.sourceKey }; });
    ok('Rin animada pelo shader sobre a ilustração original', animInfo.type === 'Shader' && animInfo.anim && animInfo.key === 'char_character_01', JSON.stringify(animInfo));
    let blinked = false;
    for (let i = 0; i < 80 && !blinked; i++) { blinked = await G(() => window.__ANIME_LIFE__.ui.engine.stage.chars.get('character_01').anim.snapshot().blinking); await page.waitForTimeout(100); }
    ok('Piscar automático acontece sozinho', blinked);
    const opts = await page.locator('.choices button').allTextContents();
    ok('Três opções de resposta', opts.length === 3, opts.map((o) => o.slice(1, 30)).join(' | '));
    ok('Nome do protagonista no texto', opts[0].includes('Aiko'));
    await tap('.choices button:nth-child(3)');
    // boca abre enquanto a fala é digitada
    let maxMouth = 0;
    for (let i = 0; i < 12; i++) { maxMouth = Math.max(maxMouth, await G(() => window.__ANIME_LIFE__.ui.engine.stage.chars.get('character_01').anim.snapshot().mouth)); await page.waitForTimeout(60); }
    const emo = await G(() => window.__ANIME_LIFE__.ui.engine.stage.chars.get('character_01').anim.snapshot().emotion);
    ok('Boca se move durante a fala', maxMouth > 0.25, `abertura máx. ${maxMouth}`);
    ok('Expressão acompanha a fala (feliz)', emo === 'happy', emo);
    await tap('.dl-box'); await page.waitForTimeout(100);
    const reply = await text();
    await page.waitForTimeout(1200);
    ok('Boca fecha quando a fala termina', (await G(() => window.__ANIME_LIFE__.ui.engine.stage.chars.get('character_01').anim.snapshot().mouth)) < 0.05);
    ok('Reação coerente à escolha 3', reply.includes('sofá'), reply);
    const s1 = await st();
    ok('Afinidade com a Rin mudou (+3)', s1.rel.character_01.afinidade === 3 && s1.rel.character_01.amizade === 1, JSON.stringify(s1.rel.character_01));
    ok('Escolha registrada no histórico', s1.decisions.at(-1).id === 'c1_apresentacao' && s1.decisions.at(-1).value === 'brincalhao');
    await shot('06-reacao');

    // continuar exatamente de onde parou (recarregar no meio da cena)
    await G(() => window.__ANIME_LIFE__.settings.set('textSpeed', 'instantanea'));
    await tap('.dl-box'); await page.waitForTimeout(500);
    const before = await text(); const posBefore = (await st()).pos;
    await page.reload();
    await page.waitForSelector('#splash.show'); await tap('#splash'); await page.waitForSelector('#menu.show');
    ok('Menu mostra Continuar após salvamento automático', await visible('[data-a=continue]'), await page.locator('[data-a=continue] small').textContent());
    await tap('[data-a=continue]');
    await page.waitForSelector('.dl-box.show', { timeout: 15000 }); await page.waitForTimeout(1400);
    const after = await text();
    await G(() => window.__ANIME_LIFE__.settings.set('textSpeed', 'normal')); const posAfter = (await st()).pos;
    ok('Continua exatamente na mesma fala', after === before && posAfter.pc === posBefore.pc, `pc ${posBefore.pc}→${posAfter.pc}`);
    ok('Rin restaurada em cena após carregar', (await G(() => [...window.__ANIME_LIFE__.ui.engine.stage.chars.keys()])).includes('character_01'));

    // câmera cinematográfica: acompanha os planos até a pergunta da caixa
    let maxZoom = 1;
    await until(async () => { maxZoom = Math.max(maxZoom, await G(() => window.__ANIME_LIFE__.ui.engine.stage.camProxy.z)); return hasChoices(); });
    ok('Câmera aproxima nos momentos importantes (close-up)', maxZoom >= 1.5, `zoom máx. ${maxZoom.toFixed(2)}`);
    await shot('05b-close');
    // escolha do pacote: abrir junto
    await until(hasChoices);
    const q2 = await text();
    ok('Pergunta sobre a caixa', q2.includes('O que você quer fazer'), q2);
    await tap('.choices button:nth-child(2)');
    await until(async () => (await text()).includes('Para A.'), 20);
    ok('Abrir a caixa revela o envelope “Para A.”', (await text()).includes('Para A.'));

    // histórico, auto, ocultar
    await tap('[data-q=log]'); await page.waitForSelector('.modal.show .backlog'); await page.waitForTimeout(300);
    await shot('07-historico');
    ok('Histórico de conversas mostra falas e escolhas', (await page.locator('.bl-line').count()) > 8 && (await page.locator('.bl-choice').count()) === 2);
    await tap('.modal.show .close'); await page.waitForTimeout(300);
    await G(() => window.__ANIME_LIFE__.settings.set('textSpeed', 'rapida'));
    const pcA = (await st()).pos.pc;
    await tap('[data-q=auto]'); await page.waitForTimeout(4500); await tap('[data-q=auto]');
    ok('Modo automático avança sozinho', (await st()).pos.pc > pcA, `pc ${pcA}→${(await st()).pos.pc}`);
    await tap('[data-q=hide]'); await page.waitForTimeout(300);
    await shot('08-interface-oculta');
    const hidden = await G(() => document.getElementById('vn').classList.contains('ui-off'));
    await page.touchscreen.tap(400, 150); await page.waitForTimeout(300);
    ok('Ocultar interface e voltar com um toque', hidden && !(await G(() => document.getElementById('vn').classList.contains('ui-off'))));

    // ajuste: animação leve/desligada chega aos personagens
    await G(() => { window.__ANIME_LIFE__.settings.set('animations', 'off'); window.__ANIME_LIFE__.ui.engine.stage.setAnimationLevel('off'); });
    ok('Ajuste "Animação desligada" aplicado', await G(() => window.__ANIME_LIFE__.ui.engine.stage.chars.get('character_01').anim.level === 'off'));
    await G(() => { window.__ANIME_LIFE__.settings.set('animations', 'completa'); window.__ANIME_LIFE__.ui.engine.stage.setAnimationLevel('completa'); });
    // salvar manualmente
    await tap('[data-q=save]'); await page.waitForSelector('.modal.show .slots');
    await tap('.slot[data-slot=slot1]'); await page.waitForTimeout(600);
    const savedPc = (await st()).pos;
    await page.waitForTimeout(300);
    ok('Salvamento manual no espaço 1', (await page.locator('#toast.show').textContent()).includes('Espaço 1'));

    // jogar o resto do capítulo 1 automaticamente (sempre a primeira opção liberada)
    await G(() => window.__ANIME_LIFE__.settings.set('textSpeed', 'instantanea'));
    let phoneSeen = false, phoneShot = false, lockSeen = false, endSeen = false;
    for (let i = 0; i < 900 && !endSeen; i++) {
      if (await visible('.chapter-end .pbtn')) { endSeen = true; break; }
      if (await visible('#phone.show .ph-replies button:not(.ph-done)')) {
        phoneSeen = true;
        if (!phoneShot) { await page.waitForTimeout(300); await shot('09-celular'); phoneShot = true; }
        await tap('#phone.show .ph-replies button:not([disabled])'); await page.waitForTimeout(250); continue;
      }
      if (await visible('#phone.show .ph-done')) { await tap('#phone.show .ph-done'); await page.waitForTimeout(400); continue; }
      if (await visible('#phone.show')) { await page.waitForTimeout(250); continue; } // celular aberto: espera as mensagens
      if (await hasChoices()) {
        if (await page.locator('.choices button[disabled]').count()) lockSeen = true;
        const sc = (await st()).pos.scene;
        // na escolha final da noite, escolher a Rin (opção 1); no resto, a primeira liberada
        await tap('.choices button:not([disabled])'); await page.waitForTimeout(250);
        continue;
      }
      if (await visible('.dl-box.show')) { await tap('.dl-box'); await page.waitForTimeout(60); continue; }
      await page.waitForTimeout(200);
    }
    ok('Conversa no celular com respostas de escolha', phoneSeen);
    ok('Capítulo 1 jogado até o fim', endSeen);
    await page.waitForTimeout(500); await shot('10-fim-capitulo');
    const s2 = await st();
    const decIds = s2.decisions.map((d) => d.id);
    ok('Escolhas do capítulo registradas', ['c1_pacote', 'c1_akane', 'c1_grupo', 'c1_convite', 'c1_segredo_mei', 'c1_final'].every((d) => decIds.includes(d)), `${s2.decisions.length} escolhas`);
    ok('Variáveis de história definidas', s2.flags.pacote === 'aberto' && s2.flags.sabe_postais === true && !!s2.flags.segredo_mei);
    ok('Contatos no celular (Rin, Akane)', s2.phone.contacts.includes('character_01') && s2.phone.contacts.includes('character_06'), s2.phone.contacts.join(','));
    ok('Publicações no Hoshigram', s2.phone.posts.length >= 2, s2.phone.posts.join(','));
    ok('Cinco cenas desbloqueadas na galeria', s2.gallery.length === 5);
    ok('Final da noite com a Rin (primeira opção) registrado', s2.flags['escolha.c1_final'] === 'rin', s2.flags['escolha.c1_final']);

    // capítulo 2: abertura reage ao capítulo 1
    await tap('.chapter-end .pbtn');
    await page.waitForSelector('.dl-box.show', { timeout: 15000 });
    await until(hasChoices, 120);
    const s3 = await st();
    ok('Capítulo 2 começou', s3.pos.chapter === 'ch2');
    const log = s3.log.map((l) => l.t).join(' ');
    ok('Abertura do Cap. 2 depende do final do Cap. 1 (Rin + câmera)', log.includes('loja de revelação') || log.includes('dois cafés'), '');
    await shot('11-capitulo2');

    // painéis do jogo
    await tap('[data-q=menu]'); await page.waitForSelector('.modal.show .pause-grid');
    await tap('.pause-grid [data-a=rel]'); await page.waitForSelector('.rel-card'); await page.waitForTimeout(300);
    await shot('12-relacionamentos');
    ok('Relacionamentos: personagens conhecidos com 4 barras', (await page.locator('.rel-card').count()) >= 5 && (await page.locator('.rel-card').first().locator('.bar').count()) === 4);
    await tap('.modal.show:last-of-type .close'); await page.waitForTimeout(300);
    await tap('.pause-grid [data-a=choices]'); await page.waitForSelector('.decisions'); await page.waitForTimeout(200);
    ok('Histórico de escolhas', (await page.locator('.dec').count()) >= 8);
    await shot('13-escolhas');
    await tap('.modal.show:last-of-type .close'); await page.waitForTimeout(300);
    await tap('.pause-grid [data-a=gallery]'); await page.waitForSelector('.gallery'); await page.waitForTimeout(400);
    await shot('14-galeria');
    ok('Galeria com 5 cenas liberadas', (await page.locator('.g-item[data-id]').count()) === 5);
    // rever cena sem alterar o jogo
    const decBefore = (await st()).decisions.length;
    await tap('.g-item[data-id=c1s2]');
    await page.waitForFunction(() => window.__ANIME_LIFE__.game.replay, null, { timeout: 15000 });
    await page.waitForSelector('.dl-box.show', { timeout: 15000 });
    ok('Janelas fecham ao rever cena', (await page.locator('.modal').count()) === 0);
    await G(() => window.__ANIME_LIFE__.ui.dialogue.setSkip(true));
    for (let i = 0; i < 400; i++) {
      if (!(await G(() => window.__ANIME_LIFE__.game.replay))) break;
      if (await hasChoices()) await tap('.choices button:not([disabled])'); else if (await visible('.dl-box.show')) await tap('.dl-box');
      await page.waitForTimeout(80);
    }
    await page.waitForTimeout(1500);
    const sAfter = await st();
    ok('Rever cena da galeria não altera o jogo salvo', sAfter.decisions.length === decBefore && sAfter.pos.chapter === 'ch2', `${decBefore}→${sAfter.decisions.length}`);

    // carregar o espaço 1 (volta ao capítulo 1)
    await tap('[data-q=menu]'); await page.waitForSelector('.modal.show .pause-grid');
    await tap('.pause-grid [data-a=load]'); await page.waitForSelector('.slots'); await page.waitForTimeout(300);
    await shot('15-carregar');
    await tap('.slot[data-slot=slot1]');
    await page.waitForTimeout(1800);
    const sl = await st();
    ok('Carregar espaço 1 volta ao ponto salvo', sl.pos.scene === 'c1s1' && sl.pos.pc === savedPc.pc, `pc ${sl.pos.pc}`);
    // celular: apps
    await tap('[data-q=phone]'); await page.waitForSelector('#phone.show .apps');
    await tap('.app[data-a=contacts]'); await page.waitForTimeout(300);
    // nesse ponto a Rin ainda não deu o número (ela só dá no fim da cena)
    ok('Celular reflete o ponto carregado (ainda sem contatos)', (await page.locator('.contact').count()) === 0 && (await page.locator('.ph-empty').count()) === 1);
    await tap('.ph-back'); await tap('.app[data-a=feed]'); await page.waitForTimeout(300);
    ok('Celular: app Hoshigram abre', (await page.locator('.ph-title').textContent()) === 'Hoshigram');
    await tap('.ph-close'); await page.waitForTimeout(400);
  } catch (e) {
    ok('Execução sem exceções', false, String(e.stack || e).slice(0, 600));
    await shot('99-falha').catch(() => {});
  }
  ok('Sem erros no console', errors.length === 0, errors.slice(0, 5).join(' || '));
  ok('Sem arquivos faltando', failed.length === 0, failed.slice(0, 5).join(' || '));
  await browser.close(); server.kill();
  const bad = results.filter((r) => !r.pass);
  console.log(`\n${results.length - bad.length}/${results.length} verificações passaram.`);
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(results, null, 2));
  process.exit(bad.length ? 1 : 0);
})();
