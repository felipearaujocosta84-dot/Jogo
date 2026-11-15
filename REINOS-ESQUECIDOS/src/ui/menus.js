// Menus e janelas: inicial, pausa, inventário, missões, mapa, diálogo, loja, opções, morte e vitória.
import { ITEMS, SHOP } from '../systems/inventory.js';
import { QUESTS } from '../systems/quests.js';
import { REGION_DEFS } from '../world/regions.js';

const html = (s) => s;

export class Menus {
  constructor(game) {
    this.game = game;
    this.layer = document.getElementById('menus');
    this.current = null;
    this.stack = [];
  }

  get isOpen() { return !!this.current; }

  close() {
    this.layer.innerHTML = '';
    this.layer.className = '';
    const prev = this.current;
    this.current = null;
    if (prev === 'dialog' && this.dialogNpc) { this.dialogNpc.talking = false; this.dialogNpc = null; }
    this.game.onMenuChanged(null);
  }

  toggle(name) {
    if (this.current === name) this.close();
    else if (!this.current || this.current !== 'main') this.open(name);
  }

  frame(title, body, { cls = '', closable = true, back = null } = {}) {
    this.layer.className = 'open ' + cls;
    this.layer.innerHTML = html(`
      <div class="window">
        <div class="win-head"><h2>${title}</h2>${closable ? '<button class="win-close" data-close>✕</button>' : ''}</div>
        <div class="win-body">${body}</div>
      </div>`);
    const c = this.layer.querySelector('[data-close]');
    if (c) c.addEventListener('click', () => { this.game.audio.ui(); back ? back() : this.close(); });
    return this.layer.querySelector('.win-body');
  }

  on(sel, fn) {
    this.layer.querySelectorAll(sel).forEach((b) => b.addEventListener('click', (e) => { this.game.audio.ui(); fn(b, e); }));
  }

  open(name, arg) {
    const g = this.game;
    if (g.state !== 'playing' && !['main', 'options', 'howto', 'credits', 'death', 'victory'].includes(name)) return;
    if (this.dialogNpc && name !== 'dialog') { this.dialogNpc.talking = false; this.dialogNpc = null; }
    this.current = name;
    g.onMenuChanged(name);
    const fn = this['open_' + name];
    if (fn) fn.call(this, arg);
  }

  // ---------------- MENU INICIAL ----------------
  open_main() {
    const g = this.game;
    const hasSave = g.save.has();
    this.layer.className = 'open main';
    this.layer.innerHTML = `
      <div class="title-screen">
        <div class="logo"><small>— crônicas de —</small><h1>REINOS<br>ESQUECIDOS</h1><p>RPG de ação e aventura</p></div>
        <div class="menu-buttons">
          ${hasSave ? '<button class="btn primary" data-a="continue">Continuar</button>' : ''}
          <button class="btn ${hasSave ? '' : 'primary'}" data-a="new">Novo Jogo</button>
          <button class="btn" data-a="howto">Como Jogar</button>
          <button class="btn" data-a="options">Opções</button>
          <button class="btn" data-a="credits">Créditos</button>
        </div>
        <div class="version">v${g.version} · Babylon.js</div>
      </div>`;
    this.on('[data-a]', (b) => {
      const a = b.dataset.a;
      if (a === 'continue') g.startGame(false);
      if (a === 'new') {
        if (hasSave) this.confirm('Começar um novo jogo apaga o progresso salvo. Continuar?', () => g.startGame(true), () => this.open_main());
        else g.startGame(true);
      }
      if (a === 'howto') this.open_howto(() => this.open_main());
      if (a === 'options') this.open_options(() => this.open_main());
      if (a === 'credits') this.open_credits(() => this.open_main());
    });
    this.current = 'main';
  }

  confirm(text, yes, no) {
    const body = this.frame('Confirmar', `<p class="center">${text}</p><div class="row"><button class="btn primary" data-y>Sim</button><button class="btn" data-n>Não</button></div>`, { closable: false });
    body.querySelector('[data-y]').addEventListener('click', yes);
    body.querySelector('[data-n]').addEventListener('click', no);
  }

  open_howto(back) {
    this.current = this.current || 'howto';
    this.frame('Como Jogar', `
      <ul class="howto">
        <li><b>Mover:</b> toque e arraste no lado esquerdo da tela (joystick). Empurre até o fim para correr.</li>
        <li><b>Câmera:</b> arraste no lado direito para girar; pinça com dois dedos para zoom.</li>
        <li><b>⚔️ Ataque:</b> toque várias vezes para um combo de 3 golpes (o 3º é mais forte).</li>
        <li><b>🌀 Golpe Giratório:</b> acerta todos à sua volta. Gasta muita estamina.</li>
        <li><b>💨 Esquiva:</b> rolamento rápido — durante o rolamento você não sofre dano.</li>
        <li><b>🧪 Poção:</b> recupera vida. Compre mais com o Ferreiro Gunnar.</li>
        <li><b>✋ Interagir:</b> aparece perto de pessoas, baús e ervas.</li>
        <li><b>Poço da aldeia:</b> descanse para curar e salvar o jogo. O jogo também salva sozinho.</li>
        <li><b>Missões:</b> siga a estrela no minimapa e a seta ao lado da missão.</li>
        <li><b>PC:</b> WASD move, Espaço/clique ataca, K giratório, Shift esquiva, H poção, F interage, Q/E giram a câmera, I/U/M abrem inventário/missões/mapa.</li>
      </ul>`, { back: back || (() => this.close()) });
  }

  open_credits(back) {
    this.frame('Créditos', `
      <p class="center"><b>Reinos Esquecidos</b><br>RPG de ação e aventura em Babylon.js</p>
      <p class="center">Mapa do Vale Verde e modelo do herói: fornecidos pelo autor do projeto.<br>
      Esqueleto do herói, inimigos, NPCs, cenários extras, efeitos e trilha sonora: gerados por código.</p>`, { back: back || (() => this.close()) });
  }

  // ---------------- PAUSA ----------------
  open_pause() {
    const g = this.game;
    const body = this.frame('Pausado', `
      <div class="menu-buttons">
        <button class="btn primary" data-a="resume">Continuar</button>
        <button class="btn" data-a="save">Salvar jogo</button>
        <button class="btn" data-a="howto">Como Jogar</button>
        <button class="btn" data-a="options">Opções</button>
        <button class="btn" data-a="quit">Salvar e sair para o menu</button>
      </div>`);
    this.on('[data-a]', (b) => {
      const a = b.dataset.a;
      if (a === 'resume') this.close();
      if (a === 'save') { g.save.save(); this.close(); }
      if (a === 'howto') this.open_howto(() => this.open_pause());
      if (a === 'options') this.open_options(() => this.open_pause());
      if (a === 'quit') { g.save.save(true); this.close(); g.toMainMenu(); }
    });
    return body;
  }

  // ---------------- OPÇÕES ----------------
  open_options(back) {
    const g = this.game;
    const s = g.settings;
    this.frame('Opções', `
      <div class="opt"><label>Qualidade gráfica</label>
        <div class="seg" data-k="quality">
          ${['auto', 'high', 'medium', 'low'].map((q) => `<button data-v="${q}" class="${s.quality === q ? 'on' : ''}">${{ auto: 'Auto', high: 'Alta', medium: 'Média', low: 'Baixa' }[q]}</button>`).join('')}
        </div></div>
      <div class="opt"><label>Efeitos sonoros</label><input type="range" min="0" max="1" step="0.05" value="${s.sfx}" data-r="sfx"></div>
      <div class="opt"><label>Música</label><input type="range" min="0" max="1" step="0.05" value="${s.music}" data-r="music"></div>
      <div class="opt"><label>Limitar a 30 FPS (economiza bateria)</label><input type="checkbox" data-c="fps30" ${s.fps30 ? 'checked' : ''}></div>
      <div class="opt"><label>Mostrar FPS</label><input type="checkbox" data-c="showFps" ${s.showFps ? 'checked' : ''}></div>
      <div class="opt"><label>Tela cheia</label><button class="btn small" data-a="fs">Alternar</button></div>
      <div class="opt danger"><label>Progresso</label><button class="btn small" data-a="wipe">Apagar save</button></div>`, { back: back || (() => this.close()) });
    this.on('.seg button', (b) => {
      s.quality = b.dataset.v;
      g.applySettings();
      this.open_options(back);
    });
    this.layer.querySelectorAll('[data-r]').forEach((r) => r.addEventListener('input', () => { s[r.dataset.r] = parseFloat(r.value); g.applySettings(); }));
    this.layer.querySelectorAll('[data-c]').forEach((c) => c.addEventListener('change', () => { s[c.dataset.c] = c.checked; g.applySettings(); }));
    this.on('[data-a="fs"]', () => g.toggleFullscreen());
    this.on('[data-a="wipe"]', () => this.confirm('Apagar todo o progresso salvo?', () => { g.save.clear(); g.hud.toast('Save apagado'); this.open_options(back); }, () => this.open_options(back)));
  }

  // ---------------- INVENTÁRIO ----------------
  open_inventory(sel) {
    const g = this.game;
    const inv = g.inventory;
    const p = g.player;
    const items = inv.list();
    const chosen = sel && inv.has(sel) ? sel : (items[0] && items[0].id);
    const it = chosen ? ITEMS[chosen] : null;
    const equipped = (id) => id === inv.weapon || id === inv.armor;
    const body = this.frame('Inventário', `
      <div class="inv">
        <div class="stats">
          <div><span>Nível</span><b>${p.level}</b></div>
          <div><span>Vida</span><b>${Math.ceil(p.hp)}/${p.maxHp}</b></div>
          <div><span>Ataque</span><b>${Math.round(p.attack)}</b></div>
          <div><span>Defesa</span><b>${p.defense}</b></div>
          <div><span>Ouro</span><b>${inv.gold}</b></div>
          <div><span>XP</span><b>${p.xp}/${p.xpNext}</b></div>
        </div>
        <div class="grid">
          ${items.map((i) => `<button class="slot ${i.id === chosen ? 'sel' : ''} ${equipped(i.id) ? 'eq' : ''}" data-id="${i.id}"><span>${i.icon}</span>${i.n > 1 ? `<b>${i.n}</b>` : ''}</button>`).join('')}
        </div>
        <div class="detail">
          ${it ? `<h3>${it.icon} ${it.name}</h3><p>${it.desc}</p>
            <p class="meta">${it.atk ? `Ataque +${it.atk}` : ''}${it.def !== undefined && it.type === 'armadura' ? `Defesa +${it.def}` : ''}${it.sell ? ` · vale ${it.sell} ouro` : ''}</p>
            <div class="row">
              ${(it.type === 'arma' || it.type === 'armadura') && !equipped(chosen) ? '<button class="btn primary" data-a="equip">Equipar</button>' : ''}
              ${equipped(chosen) ? '<span class="tag">Equipado</span>' : ''}
              ${chosen === 'pocao' ? '<button class="btn primary" data-a="use">Beber</button>' : ''}
            </div>` : '<p>Inventário vazio.</p>'}
        </div>
      </div>`);
    this.on('.slot', (b) => this.open_inventory(b.dataset.id));
    this.on('[data-a="equip"]', () => { inv.equip(chosen); g.audio.pickup(); this.open_inventory(chosen); });
    this.on('[data-a="use"]', () => { this.close(); p.combat.drinkPotion(); });
    return body;
  }

  // ---------------- MISSÕES ----------------
  open_quests() {
    const g = this.game;
    const qs = g.quests;
    const ids = Object.keys(QUESTS).filter((id) => qs.status[id]);
    const active = ids.filter((id) => qs.isActive(id));
    const done = ids.filter((id) => qs.isDone(id));
    const row = (id) => {
      const q = QUESTS[id];
      const st = qs.status[id];
      return `<div class="quest ${st} ${qs.tracked === id ? 'tracked' : ''}" data-id="${id}">
        <h3>${q.main ? '👑 ' : ''}${q.title}</h3><p>${q.desc}</p>
        ${st !== 'done' ? `<p class="obj">${qs.objectiveText(id)}</p>` : '<p class="obj ok">Concluída ✔</p>'}
        ${st !== 'done' && qs.tracked !== id ? '<small>Toque para acompanhar</small>' : ''}
      </div>`;
    };
    this.frame('Missões', `
      ${active.length ? active.map(row).join('') : '<p class="center">Nenhuma missão ativa. Procure pessoas com <b class="mark">!</b> na aldeia.</p>'}
      ${done.length ? '<h4>Concluídas</h4>' + done.map(row).join('') : ''}`);
    this.on('.quest.active, .quest.ready', (b) => { qs.tracked = b.dataset.id; this.open_quests(); });
  }

  // ---------------- MAPA ----------------
  open_map() {
    const g = this.game;
    const body = this.frame('Mapa dos Reinos', `<div class="map-wrap"><canvas id="bigmap" width="540" height="540"></canvas></div>`, { cls: 'wide' });
    const c = body.querySelector('#bigmap');
    const ctx = c.getContext('2d');
    const img = g.hud.mapImage || g.hud.buildMinimapImage();
    const s = c.width / 180;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const P = (x, z) => [(x + 90) * s, (90 - z) * s];
    ctx.font = 'bold 15px Georgia, serif';
    ctx.textAlign = 'center';
    for (const r of REGION_DEFS) {
      const def = g.world.regions.get(r.id);
      const [x, y] = P(def.x, def.z);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillText(def.name, x + 1, y + 1);
      ctx.fillStyle = '#fff3d0';
      ctx.fillText(def.name, x, y);
    }
    for (const n of g.interaction.npcs) {
      const [x, y] = P(n.x, n.z);
      ctx.fillStyle = '#ffd34d';
      ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill();
    }
    const q = g.quests.trackedQuest();
    const t = q ? g.quests.targetPos(q) : null;
    if (t) {
      const [x, y] = P(t.x, t.z);
      ctx.fillStyle = '#ffe066'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
      g.hud.star(ctx, x, y, 10);
    }
    const p = g.player;
    const [px, py] = P(p.position.x, p.position.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(p.yaw);
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#0a2a5a'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(8, 8); ctx.lineTo(0, 4); ctx.lineTo(-8, 8); ctx.closePath();
    ctx.stroke(); ctx.fill();
    ctx.restore();
  }

  // ---------------- DIÁLOGO ----------------
  open_dialog(npc) {
    const g = this.game;
    this.dialogNpc = npc;
    npc.talking = true;
    const d = g.quests.dialogFor(npc.dialogAs || npc.id);
    let page = 0;
    const render = () => {
      const last = page >= d.lines.length - 1;
      let buttons = '';
      if (!last) buttons = '<button class="btn primary" data-a="next">Continuar ▸</button>';
      else {
        if (d.kind === 'offer') buttons += '<button class="btn primary" data-a="accept">Aceitar missão</button><button class="btn" data-a="bye">Agora não</button>';
        else if (d.kind === 'turnin') buttons += '<button class="btn primary" data-a="turnin">Receber recompensa</button>';
        else buttons += '<button class="btn" data-a="bye">Até logo</button>';
        if (npc.shop) buttons += '<button class="btn" data-a="shop">Comércio</button>';
      }
      this.layer.className = 'open dialog';
      this.layer.innerHTML = `
        <div class="dialog-box">
          <div class="speaker">${npc.name}${d.quest ? ` <small>· ${QUESTS[d.quest].title}</small>` : ''}</div>
          <p>${d.lines[page]}</p>
          ${last && d.kind === 'offer' ? `<p class="reward">Recompensa: ${this.rewardText(QUESTS[d.quest].reward)}</p>` : ''}
          <div class="row">${buttons}</div>
        </div>`;
      this.on('[data-a]', (b) => {
        const a = b.dataset.a;
        if (a === 'next') { page++; render(); }
        if (a === 'bye') this.close();
        if (a === 'accept') { g.quests.accept(d.quest); this.close(); }
        if (a === 'turnin') { g.quests.turnIn(d.quest); this.close(); }
        if (a === 'shop') this.open_shop(npc);
      });
    };
    render();
  }

  rewardText(r) {
    const parts = [];
    if (r.xp) parts.push(`${r.xp} XP`);
    if (r.gold) parts.push(`${r.gold} ouro`);
    for (const [id, n] of r.items || []) parts.push(`${n > 1 ? n + 'x ' : ''}${ITEMS[id].name}`);
    return parts.join(', ');
  }

  // ---------------- LOJA ----------------
  open_shop(npc, tab = 'buy') {
    const g = this.game;
    const inv = g.inventory;
    this.current = 'shop';
    const buyRows = SHOP.map((id) => {
      const it = ITEMS[id];
      const owned = (it.type === 'arma' || it.type === 'armadura') && inv.has(id);
      return `<div class="shop-row"><span class="ic">${it.icon}</span><div><b>${it.name}</b><small>${it.atk ? 'Ataque +' + it.atk : it.def ? 'Defesa +' + it.def : it.desc}</small></div>
        <button class="btn small ${inv.gold >= it.price && !owned ? 'primary' : ''}" data-buy="${id}" ${owned ? 'disabled' : ''}>${owned ? 'Possui' : '🪙 ' + it.price}</button></div>`;
    }).join('');
    const sellable = inv.list().filter((i) => i.sell && i.id !== inv.weapon && i.id !== inv.armor);
    const sellRows = sellable.length ? sellable.map((it) => `<div class="shop-row"><span class="ic">${it.icon}</span><div><b>${it.name} ${it.n > 1 ? '×' + it.n : ''}</b><small>${it.desc}</small></div>
        <button class="btn small" data-sell="${it.id}">+🪙 ${it.sell}</button></div>`).join('') : '<p class="center">Nada para vender.</p>';
    this.frame(`Ferraria de Gunnar <span class="gold-tag">🪙 ${inv.gold}</span>`, `
      <div class="tabs"><button class="${tab === 'buy' ? 'on' : ''}" data-tab="buy">Comprar</button><button class="${tab === 'sell' ? 'on' : ''}" data-tab="sell">Vender</button></div>
      <div class="shop">${tab === 'buy' ? buyRows : sellRows}</div>`, { back: () => { if (npc) npc.talking = false; this.close(); } });
    this.on('[data-tab]', (b) => this.open_shop(npc, b.dataset.tab));
    this.on('[data-buy]', (b) => {
      const err = inv.buy(b.dataset.buy);
      if (err) g.hud.toast(err);
      else { g.audio.coin(); g.hud.toast('Comprou ' + ITEMS[b.dataset.buy].name); }
      this.open_shop(npc, 'buy');
    });
    this.on('[data-sell]', (b) => { if (inv.sell(b.dataset.sell)) g.audio.coin(); this.open_shop(npc, 'sell'); });
  }

  // ---------------- MORTE / VITÓRIA ----------------
  open_death() {
    const g = this.game;
    this.layer.className = 'open death';
    this.layer.innerHTML = `
      <div class="big-msg">
        <h1>VOCÊ CAIU</h1>
        <p>Os aldeões o encontraram e o levaram de volta.<br>Você perdeu parte do ouro que carregava.</p>
        <button class="btn primary" data-a="respawn">Renascer na Aldeia</button>
      </div>`;
    this.on('[data-a]', () => { this.close(); g.respawn(); });
  }

  open_victory() {
    const g = this.game;
    this.layer.className = 'open victory';
    this.layer.innerHTML = `
      <div class="big-msg">
        <h1>O REI ESQUECIDO CAIU</h1>
        <p>O selo das Ruínas Antigas foi restaurado e a paz volta ao Vale Verde.<br>
        Volte à aldeia para receber sua recompensa — e continue explorando os reinos!</p>
        <button class="btn primary" data-a="ok">Continuar a aventura</button>
      </div>`;
    this.on('[data-a]', () => this.close());
  }
}
