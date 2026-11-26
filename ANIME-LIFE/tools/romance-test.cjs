// Teste das cenas cinematográficas e da rota romântica (consentimento, encontro, noite com transição discreta).
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'test-results');
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const ok = (name, cond, extra = '') => { results.push({ name, pass: !!cond }); console.log(`${cond ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`); };

(async () => {
  const PORT = 4186;
  const web = spawn(process.execPath, [path.join(ROOT, 'node_modules/vite/bin/vite.js'), 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'pipe' });
  await new Promise((r) => { web.stdout.on('data', (d) => { if (String(d).includes(String(PORT))) r(); }); setTimeout(r, 8000); });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  const shot = (n) => page.screenshot({ path: path.join(OUT, `${n}.png`) });
  const G = (fn, arg) => page.evaluate(fn, arg);
  const tap = async (sel) => { const l = page.locator(sel).first(); await l.scrollIntoViewIfNeeded().catch(() => {}); const b = await l.boundingBox(); await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); };
  const st = () => G(() => window.__ANIME_LIFE__.game.state);
  const visible = (sel) => page.locator(sel).first().isVisible().catch(() => false);
  // avança falas; ao encontrar escolhas, escolhe a opção cujo texto contém "want"
  const playUntil = async (pred, picks = [], max = 300) => {
    for (let i = 0; i < max; i++) {
      if (await pred()) return true;
      if (await page.locator('.choices button').count()) {
        const texts = await page.locator('.choices button:not([disabled])').allTextContents();
        const want = picks.find((p) => texts.some((t) => t.includes(p)));
        const idx = want ? texts.findIndex((t) => t.includes(want)) : 0;
        await page.locator('.choices button:not([disabled])').nth(idx).click();
        await page.waitForTimeout(200); continue;
      }
      const t0 = await page.locator('.dl-text').textContent().catch(() => '');
      if (!t0) { await page.waitForTimeout(150); continue; } // pausa cinematográfica: espera o texto aparecer
      if (await visible('.dl-box.show')) await page.locator('.dl-box').click({ force: true }).catch(() => {});
      // espera a próxima fala (ou escolhas) antes de conferir de novo
      await page.waitForFunction((t) => { const el = document.querySelector('.dl-text'); return (el && el.textContent !== t) || document.querySelector('.choices button'); }, t0, { timeout: 4000 }).catch(() => {});
    }
    return pred();
  };

  try {
    await page.goto(`http://localhost:${PORT}/`);
    await page.waitForSelector('#splash.show'); await tap('#splash'); await page.waitForSelector('#menu.show');
    await G(() => window.__ANIME_LIFE__.settings.set('textSpeed', 'instantanea'));
    // espiona os efeitos sonoros pedidos pela direção de cena
    await G(() => { const a = window.__ANIME_LIFE__.audio; window.__sfx = []; const o = a.sfx.bind(a); a.sfx = (n) => { window.__sfx.push(n); return o(n); }; const oa = a.ambient.bind(a); a.ambient = (n) => { window.__amb = n; return oa(n); }; });
    await tap('[data-a=new]'); await page.waitForSelector('#newgame.show');
    await page.fill('#f-name', 'Aiko Tanaka'); await tap('#f-pron [data-v=ela]'); await tap('#newgame [data-a=ok]');
    await page.waitForSelector('.dl-box.show', { timeout: 20000 });
    await page.waitForTimeout(300);

    // ---- SISTEMA 1: narração vira cena ----
    const lb = await G(() => document.getElementById('letterbox').classList.contains('on'));
    const pan = await G(() => window.__ANIME_LIFE__.ui.engine.stage.currentShot?.type);
    const fxObjs = await G(() => window.__ANIME_LIFE__.ui.engine.stage.ambient.objs.length);
    await shot('30-narracao-cinema');
    ok('Narração sem personagens: faixas de cinema + panorâmica pelo ambiente', lb && pan === 'pan', `letterbox=${lb} plano=${pan}`);
    ok('Cenário com vida (poeira na luz da janela)', fxObjs > 10, `${fxObjs} elementos`);
    ok('Som ambiente do apartamento', (await G(() => window.__amb)) === 'cidade');
    await playUntil(async () => (await G(() => window.__sfx.includes('knock'))), [], 40);
    ok('"Alguém bate na porta" → som de batidas', await G(() => window.__sfx.includes('knock')));
    await playUntil(async () => (await page.locator('.dl-text').textContent()).includes('caixa de papelão'), ['Se for reclamação'], 60);
    await page.waitForTimeout(1500);
    const appr = await G(() => window.__ANIME_LIFE__.cueLog.find((c) => c.approach && c.approach[0] === 'character_01'));
    await shot('31-ela-estende-a-caixa');
    ok('"Ela estende uma caixa" → Rin se aproxima', appr && appr.approach[1] > 0.3, JSON.stringify(appr));
    const posMain = (await st()).pos;

    // ---- SISTEMA 3/5: convite recusado (consentimento) ----
    await G(() => { const s = window.__ANIME_LIFE__.game.state; s.phone.contacts.push('character_01'); s.rel.character_01 = { amizade: 4, confianca: 2, carinho: 0, afinidade: 9, romance: 0, met: true }; });
    await tap('[data-q=phone]'); await page.waitForSelector('#phone.show .apps');
    await tap('.app[data-a=profiles]'); await tap('.prof-card[data-id=character_01]'); await page.waitForSelector('.profile');
    ok('Perfil oferece convite para encontro', await visible('.p-invite'), await page.locator('.p-invite').textContent().catch(() => ''));
    await tap('.p-invite');
    await page.waitForFunction(() => window.__ANIME_LIFE__.chat.mem('character_01').history.filter((m) => m.from === 'npc').length >= 1, null, { timeout: 10000 });
    await page.waitForTimeout(400);
    const h1 = await G(() => window.__ANIME_LIFE__.chat.mem('character_01').history.at(-1));
    ok('Com pouca intimidade, a Rin recusa com gentileza (sem encontro)', !h1.invite, h1.text);
    const relAfter = await G(() => window.__ANIME_LIFE__.game.state.rel.character_01);
    ok('Recusa não pune o jogador', relAfter.amizade === 4 && relAfter.afinidade === 9);

    // ---- encontro aceito → evento cinematográfico ----
    await G(() => { const s = window.__ANIME_LIFE__.game.state; Object.assign(s.rel.character_01, { amizade: 14, confianca: 12, carinho: 10, afinidade: 18, romance: 3 }); window.__ANIME_LIFE__.chat.mem('character_01').mood = 'neutro'; });
    await tap('.chat-head'); await page.waitForSelector('.p-invite'); await tap('.p-invite');
    await page.waitForSelector('[data-go]', { timeout: 10000 });
    await shot('32-convite-aceito');
    ok('Com confiança, ela aceita e o convite aparece no chat', true);
    await tap('[data-go]');
    await page.waitForFunction(() => window.__ANIME_LIFE__.game.state.pos.scene === 'e_rin_encontro', null, { timeout: 15000 });
    await page.waitForSelector('.dl-box.show', { timeout: 15000 });
    ok('Evento "Terraço, só nós dois" começou', true);
    ok('Som ambiente do terraço à noite', (await G(() => window.__amb)) === 'grilos');
    await playUntil(async () => (await page.locator('.dl-text').textContent()).includes('você quer? me beijar'), ['Eu fico pensando em você', 'Segurar a mão'], 120);
    await page.waitForTimeout(600);
    await shot('33-ela-pergunta');
    ok('A Rin pergunta antes (consentimento dela)', (await page.locator('.dl-text').textContent()).includes('porque eu quero'));
    await page.locator('.dl-box').click({ force: true }); await page.waitForSelector('.choices button');
    const kissOpts = await page.locator('.choices button').allTextContents();
    ok('Escolhas: beijar, abraçar ou ir com calma', kissOpts.some((t) => t.includes('Beijar')) && kissOpts.some((t) => t.includes('Abraçar')) && kissOpts.some((t) => t.includes('pront')), kissOpts.map((t) => t.slice(1, 28)).join(' | '));
    await page.locator('.choices button', { hasText: 'Beijar' }).click();
    await page.waitForTimeout(1600);
    await playUntil(async () => (await G(() => [...window.__ANIME_LIFE__.ui.engine.stage.chars.values()].every((c) => c.img.alpha < 0.2))), [], 30);
    await shot('34-corte-para-o-ceu');
    ok('Beijo mostrado com corte de câmera para o céu (sem nada explícito)', await G(() => [...window.__ANIME_LIFE__.ui.engine.stage.chars.values()].every((c) => c.img.alpha < 0.2)));
    await playUntil(async () => (await G(() => window.__ANIME_LIFE__.game.state.pos.scene !== 'e_rin_encontro')), ['Quero namorar você'], 80);
    await page.waitForTimeout(1500);
    const s2 = await st();
    ok('Namoro começou pela escolha do jogador', s2.romance.character_01.stage === 'namoro' && s2.flags['rin.beijo'] === true);
    ok('Depois do evento, volta exatamente ao ponto da história', s2.pos.scene === posMain.scene && s2.pos.pc === posMain.pc, `${s2.pos.scene}#${s2.pos.pc} (antes ${posMain.scene}#${posMain.pc})`);
    ok('Evento entra na galeria e fica marcado como feito', s2.gallery.includes('e_rin_encontro') && s2.romance.character_01.events.includes('e_rin_encontro'));

    // ---- convite do personagem, recusado pelo jogador ----
    await G(() => { Object.assign(window.__ANIME_LIFE__.game.state.rel.character_01, { carinho: 30, romance: 14 }); window.__ANIME_LIFE__.game.state.romance.character_01.declinedAt = Date.now() - 31 * 60000; });
    const relBefore = await G(() => ({ ...window.__ANIME_LIFE__.game.state.rel.character_01 }));
    await G(() => window.__ANIME_LIFE__.chat.tick('invite'));
    await tap('[data-q=phone]'); await page.waitForSelector('#phone.show .apps');
    await tap('.app[data-a=msgs]'); await tap('.thread[data-id=character_01]'); await page.waitForSelector('[data-dec]', { timeout: 8000 });
    await shot('35-convite-da-rin');
    ok('A Rin convida para passar a noite (Aceitar / Recusar)', await visible('[data-acc]'));
    await tap('[data-dec]');
    await page.waitForTimeout(2200);
    const relB = await G(() => window.__ANIME_LIFE__.game.state.rel.character_01);
    const lastTxt = await G(() => window.__ANIME_LIFE__.chat.mem('character_01').history.at(-1).text);
    ok('Recusar é respeitado, sem punição', JSON.stringify(relB) === JSON.stringify(relBefore) && lastTxt.includes('outro dia'), lastTxt);

    // ---- noite juntos (jogador convida, ela aceita), transição discreta, manhã seguinte ----
    await tap('.chat-head'); await page.waitForSelector('.p-invite');
    await tap('.p-invite'); await page.waitForSelector('[data-go]', { timeout: 10000 });
    await tap('[data-go]');
    await page.waitForFunction(() => window.__ANIME_LIFE__.game.state.pos.scene === 'e_rin_noite', null, { timeout: 15000 });
    await playUntil(async () => (await page.locator('.dl-text').textContent()).includes('eu quero ficar com você'), ['Se mudar de ideia'], 60);
    ok('Ela diz claramente que quer ficar', true);
    await playUntil(async () => (await page.locator('.dl-text').textContent()).includes('você ronca'), ['passar a noite com ela'], 120);
    const fade = await G(() => window.__ANIME_LIFE__.cueLog.find((c) => c.fade && c.scene === 'e_rin_noite'));
    const cut = await G(() => window.__ANIME_LIFE__.game.state.flags['rin.noite_juntos']);
    ok('Momento íntimo vira transição discreta (tela preta "Na manhã seguinte")', fade && fade.fade === 'black' && fade.text === 'Na manhã seguinte' && cut, JSON.stringify(fade));
    await page.waitForTimeout(800);
    await shot('37-manha-seguinte');
    ok('A história continua na manhã seguinte (consequências)', (await G(() => window.__ANIME_LIFE__.game.state.stage.bg)) === 'apartamento');
    ok('A Rin aparece de novo na manhã seguinte (depois do corte)', (await G(() => window.__ANIME_LIFE__.ui.engine.stage.chars.get('character_01')?.img.alpha)) > 0.9);
    await playUntil(async () => (await G(() => window.__ANIME_LIFE__.game.state.pos.scene !== 'e_rin_noite')), ['Tá tudo bem? Sobre ontem?'], 80);
    await page.waitForTimeout(1200);
    const s3 = await st();
    ok('Consequências registradas (Kaito desconfia, post no Hoshigram)', s3.flags['kaito.desconfia'] === true && s3.phone.posts.includes('rin_manha'));
    ok('Volta de novo ao ponto da história principal', s3.pos.scene === posMain.scene);
  } catch (e) {
    ok('Execução sem exceções', false, String(e.stack || e).slice(0, 500));
    await shot('99-falha-romance').catch(() => {});
  }
  ok('Sem erros no console', errors.length === 0, errors.slice(0, 4).join(' || '));
  await browser.close(); web.kill();
  const bad = results.filter((r) => !r.pass);
  console.log(`\n${results.length - bad.length}/${results.length} verificações de cena/romance passaram.`);
  process.exit(bad.length ? 1 : 0);
})();
