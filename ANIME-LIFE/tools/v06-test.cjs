// Teste da v0.6: capítulos (catálogo de 350), objetos de cena, novas expressões, lágrimas, poses (com e sem arte),
// voz (sintetizada) com legenda sincronizada, botão de repetir fala e boca acompanhando a voz.
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
  const PORT = 4187;
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
  const tap = async (sel) => { const l = page.locator(sel).first(); const b = await l.boundingBox(); await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); };
  const visible = (sel) => page.locator(sel).first().isVisible().catch(() => false);
  const playUntil = async (pred, max = 300) => {
    for (let i = 0; i < max; i++) {
      if (await pred()) return true;
      if (await page.locator('.choices button').count()) { await page.locator('.choices button:not([disabled])').first().click(); await page.waitForTimeout(200); continue; }
      const t0 = await page.locator('.dl-text').textContent().catch(() => '');
      if (!t0) { await page.waitForTimeout(150); continue; }
      if (await visible('.dl-box.show')) await page.locator('.dl-box').click({ force: true }).catch(() => {});
      await page.waitForFunction((t) => { const el = document.querySelector('.dl-text'); return (el && el.textContent !== t) || document.querySelector('.choices button'); }, t0, { timeout: 4000 }).catch(() => {});
    }
    return pred();
  };

  try {
    await page.goto(`http://localhost:${PORT}/`);
    await page.waitForSelector('#splash.show'); await tap('#splash'); await page.waitForSelector('#menu.show');
    await G(() => window.__ANIME_LIFE__.settings.set('textSpeed', 'normal'));
    // espiona a voz
    await G(() => { const v = window.__ANIME_LIFE__.voice; window.__says = []; const o = v.say.bind(v); v.say = (m, t, cb) => { window.__says.push({ id: m?.id, emotion: m?.emotion, t }); return o(m, t, cb); }; });
    const mode = await G(() => window.__ANIME_LIFE__.voice.mode);
    ok('Voz: motor detectado (web/nativo/nenhum)', ['web', 'native', 'none'].includes(mode), mode);

    // ---- Capítulos a partir do menu principal ----
    await tap('#menu [data-a=chapters]'); await page.waitForSelector('.modal.show .chap-list');
    const prog = await page.locator('.chap-progress').textContent();
    ok('Catálogo com 350 capítulos e status real', /6 escritos/.test(prog) && /344 roteirizados/.test(prog) && /350 no total/.test(prog), prog.trim());
    ok('Volume 1 lista 35 capítulos', (await page.locator('.chap').count()) === 35);
    ok('Capítulo 2 bloqueado sem concluir o 1', await page.locator('.chap').nth(1).evaluate((e) => e.classList.contains('locked')));
    await page.locator('.chap-vols [data-vol="10"]').click();
    const last = await page.locator('.chap .num').last().textContent();
    ok('Volume 10 termina no capítulo 350', last.trim() === '350');
    await shot('v06-01-capitulos');
    await page.locator('.modal.show .close').click(); await page.waitForTimeout(400);

    // ---- novo jogo ----
    await tap('[data-a=new]'); await page.waitForSelector('#newgame.show');
    await page.fill('#f-name', 'Aiko Tanaka'); await tap('#f-pron [data-v=ela]'); await tap('#newgame [data-a=ok]');
    await page.waitForSelector('.dl-box.show', { timeout: 20000 });

    // fala de personagem: voz + legenda + 🔁
    await playUntil(() => G(() => window.__says.length > 0), 60);
    const says = await G(() => window.__says.length);
    ok('Falas dos personagens chamam a voz com emoção', says > 0, JSON.stringify(await G(() => window.__says[0])));
    if (mode !== 'none') {
      ok('Aviso "voz sintetizada" na tela', (await page.locator('.dl-voice').textContent()).includes('sintetizada'));
      ok('Botão 🔁 visível na fala de personagem', await visible('.dl-replay'));
      const mouth = await G(async () => { const s = window.__ANIME_LIFE__.ui.engine.stage; let m = 0; for (let i = 0; i < 12; i++) { for (const c of s.chars.values()) m = Math.max(m, c.anim?.snapshot().mouth || 0); await new Promise((r) => setTimeout(r, 60)); } return m; });
      ok('Boca acompanha a voz (lip sync)', mouth > 0.05, `abertura ${mouth}`);
      const before = await G(() => window.__says.length);
      await page.locator('.dl-replay').dispatchEvent('pointerup');
      await page.waitForTimeout(200);
      ok('🔁 repete a fala', (await G(() => window.__says.length)) === before + 1);
    }
    // desligar a voz
    await G(() => window.__ANIME_LIFE__.settings.set('voice', false));
    await page.locator('.dl-box').click({ force: true }); await page.waitForTimeout(300);
    await G(() => window.__ANIME_LIFE__.settings.set('textSpeed', 'instantanea'));

    // ---- Capítulo 3, cena 1: objeto em cena (bilhete) ----
    G(() => window.__ANIME_LIFE__.ui.replayScene('c3s1', false)).catch(() => {});
    await page.waitForTimeout(1500);
    const got = await playUntil(() => G(() => !!window.__ANIME_LIFE__.ui.engine.stage.props.cur), 120);
    ok('Objeto em cena: bilhete mostrado em plano de detalhe', got && (await G(() => window.__ANIME_LIFE__.ui.engine.stage.props.name)) === 'bilhete');
    await shot('v06-02-bilhete');
    await playUntil(() => G(() => !window.__ANIME_LIFE__.ui.engine.stage.props.cur), 40);
    ok('Objeto some com { prop: null }', !(await G(() => window.__ANIME_LIFE__.ui.engine.stage.props.cur)));
    const poses = await G(() => window.__ANIME_LIFE__.cueLog.filter((c) => c.pose));
    ok('Poses escolhidas automaticamente pela fala/emoção', poses.length > 0, [...new Set(poses.map((p) => p.pose))].join(','));
    ok('Sem arte de pose: ilustração não é alterada', poses.every((p) => !p.drawn));

    // ---- Novas expressões ----
    const NEW = ['smile', 'laugh', 'very_sad', 'crying', 'scared', 'annoyed', 'jealous', 'nervous', 'confused', 'bravo', 'irritado'];
    const res = await G(async (list) => {
      const s = window.__ANIME_LIFE__.ui.engine.stage;
      const c = [...s.chars.values()][0]; if (!c) return null;
      const out = {};
      for (const e of list) { s.express(c.id, e); await new Promise((r) => setTimeout(r, 120)); out[e] = c.anim ? c.anim.snapshot().emotion : c.expr; }
      return { id: c.id, out };
    }, NEW);
    const expect = { bravo: 'angry', irritado: 'annoyed' };
    ok('Novas expressões aplicadas (incl. nomes em português)', res && NEW.every((e) => res.out[e] === (expect[e] || e)), JSON.stringify(res?.out));
    const tears = await G(async () => { const s = window.__ANIME_LIFE__.ui.engine.stage; const c = [...s.chars.values()][0]; s.express(c.id, 'crying'); let n = 0; for (let i = 0; i < 15; i++) { n = Math.max(n, s.tears.length); await new Promise((r) => setTimeout(r, 100)); } return n; });
    ok('Choro desenha lágrimas saindo dos olhos', tears > 0, `${tears} gotas`);
    await shot('v06-03-chorando');
    const laugh = await G(async () => { const s = window.__ANIME_LIFE__.ui.engine.stage; const c = [...s.chars.values()][0]; if (!c.anim) return 'sem-webgl'; s.express(c.id, 'laugh'); let m = 0; for (let i = 0; i < 15; i++) { m = Math.max(m, c.anim.snapshot().mouth); await new Promise((r) => setTimeout(r, 50)); } return m; });
    ok('Riso: boca abre no ritmo', laugh === 'sem-webgl' || laugh > 0.1, String(laugh));

    // ---- Pose COM arte (simulada com a própria ilustração original): mecanismo de troca ----
    const swapped = await G(async () => {
      const A = window.__ANIME_LIFE__; const s = A.ui.engine.stage; const c = [...s.chars.values()][0];
      const d = A.Characters.get(c.id); const old = d.poses; d.poses = { wave: 'full.webp' };
      const r = s.pose(c.id, 'wave'); await new Promise((res) => setTimeout(res, 800));
      const p = c.pose; s.pose(c.id, 'rest'); await new Promise((res) => setTimeout(res, 500)); d.poses = old;
      return { r, p, back: c.pose };
    });
    ok('Com arte registrada, a pose troca com transição e volta', swapped.r && swapped.p === 'wave' && swapped.back === 'rest', JSON.stringify(swapped));

    // ---- Celular → Cap. 3: kaito_reuniao existe; Cap. 3 cena 4 tem o cartão de Sora ----
    G(() => window.__ANIME_LIFE__.ui.replayScene('c3s4', false)).catch(() => {});
    await page.waitForTimeout(1500);
    const card = await playUntil(() => G(() => window.__ANIME_LIFE__.ui.engine.stage.props.name === 'cartao'), 80);
    ok('Cap. 3: cartão de visita de Sora Kirishima', card);
    await shot('v06-04-cartao');

    // ---- Cap. 4: fotos reveladas; Cap. 6: Sora Kirishima em cena (ilustração original, sem rig) ----
    G(() => window.__ANIME_LIFE__.ui.replayScene('c4s2', false)).catch(() => {});
    await page.waitForTimeout(1500);
    ok('Cap. 4: fotos reveladas em cena', await playUntil(() => G(() => window.__ANIME_LIFE__.ui.engine.stage.props.name === 'foto'), 80));
    await shot('v06-05-fotos');
    G(() => window.__ANIME_LIFE__.ui.replayScene('c6s2', false)).catch(() => {});
    await page.waitForTimeout(1500);
    const sora = await playUntil(() => G(() => window.__ANIME_LIFE__.ui.engine.stage.chars.has('character_09')), 40);
    ok('Cap. 6: Sora Kirishima aparece em cena', sora);
    await page.waitForTimeout(800);
    await shot('v06-06-sora');
    await playUntil(() => G(() => (window.__ANIME_LIFE__.cueLog || []).some((c) => c.prop === 'cartao' && c.scene === 'c6s2')), 120);

    // ---- Pausa → Capítulos ----
    await page.locator('[data-q=menu]').click(); await page.waitForSelector('.modal.show .pause-grid');
    await page.locator('.pause-grid [data-a=chapters]').click(); await page.waitForSelector('.modal.show .chap-list');
    ok('Capítulos também no menu de pausa', (await page.locator('.chap').count()) === 35);
    await G(() => window.__ANIME_LIFE__.ui.closeModals());
  } catch (e) { ok('Execução sem exceções', false, String(e).slice(0, 300)); }

  const bad = errors.filter((e) => !/favicon|speech|synthesis/i.test(e));
  ok('Sem erros no console', bad.length === 0, bad.slice(0, 3).join(' | '));
  await browser.close(); web.kill();
  const pass = results.filter((r) => r.pass).length;
  console.log(`\n${pass}/${results.length} verificações passaram.`);
  process.exit(pass === results.length ? 0 : 1);
})();
