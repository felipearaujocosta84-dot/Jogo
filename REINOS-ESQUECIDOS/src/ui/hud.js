// HUD em HTML por cima do canvas: vida/estamina/XP, ouro, minimapa, rastreador de missão com
// seta, botões de ação (toque), rótulos no mundo (nomes, marcadores, barras de vida),
// números de dano, avisos e faixa de região.
import { Vector3, Matrix } from '../babylon.js';
import { QUESTS } from '../systems/quests.js';

const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
};

export class HUD {
  constructor(game) {
    this.game = game;
    this.root = document.getElementById('hud');
    this.labels = new Map();
    this.floatPool = [];
    this.toastTimer = 0;
    this.mmTimer = 0;
    this.build();
  }

  build() {
    const r = this.root;
    const g = this.game;

    // ---- painel do jogador ----
    const panel = el('div', 'panel-player');
    panel.innerHTML = `
      <div class="portrait"><span id="hudLevel">1</span></div>
      <div class="bars">
        <div class="bar hp"><i id="hpFill"></i><b id="hpText">100/100</b></div>
        <div class="bar st"><i id="stFill"></i></div>
        <div class="bar xp"><i id="xpFill"></i></div>
        <div class="gold">🪙 <span id="goldText">0</span></div>
      </div>`;
    r.appendChild(panel);

    // ---- minimapa + atalhos ----
    const mm = el('div', 'minimap-wrap');
    mm.innerHTML = `<canvas id="minimap" width="150" height="150"></canvas>
      <div class="mm-buttons">
        <button data-m="map" title="Mapa">🗺️</button>
        <button data-m="quests" title="Missões">📜</button>
        <button data-m="inventory" title="Inventário">🎒</button>
        <button data-m="pause" title="Menu">☰</button>
      </div>`;
    r.appendChild(mm);
    mm.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { g.audio.ui(); g.menus.open(b.dataset.m); }));
    this.mmCanvas = mm.querySelector('#minimap');
    this.mmCtx = this.mmCanvas.getContext('2d');

    // ---- rastreador de missão ----
    const qt = el('div', 'quest-tracker');
    qt.innerHTML = `<div class="qt-arrow" id="qtArrow">➤</div><div><div class="qt-title" id="qtTitle"></div><div class="qt-obj" id="qtObj"></div></div>`;
    qt.addEventListener('click', () => g.menus.open('quests'));
    r.appendChild(qt);
    this.qt = qt;

    // ---- faixa de região, avisos, chefe ----
    this.regionBanner = el('div', 'region-banner');
    r.appendChild(this.regionBanner);
    this.toastEl = el('div', 'toast');
    r.appendChild(this.toastEl);
    const boss = el('div', 'boss-bar hidden');
    boss.innerHTML = `<div class="boss-name" id="bossName">Rei Esquecido</div><div class="bar boss"><i id="bossFill"></i></div>`;
    r.appendChild(boss);
    this.bossEl = boss;
    this.vignette = el('div', 'vignette');
    r.appendChild(this.vignette);
    this.levelBanner = el('div', 'level-banner');
    r.appendChild(this.levelBanner);
    this.fpsEl = el('div', 'fps hidden');
    r.appendChild(this.fpsEl);

    // ---- botões de ação ----
    const act = el('div', 'actions');
    act.innerHTML = `
      <button class="btn-act interact hidden" id="btnInteract"><span>✋</span><small id="interactLabel">Interagir</small></button>
      <button class="btn-act attack" id="btnAttack"><span>⚔️</span></button>
      <button class="btn-act skill" id="btnSkill"><span>🌀</span><i class="cd" id="skillCd"></i></button>
      <button class="btn-act dodge" id="btnDodge"><span>💨</span></button>
      <button class="btn-act potion" id="btnPotion"><span>🧪</span><b id="potionCount">0</b></button>`;
    r.appendChild(act);
    const bindBtn = (id, name) => {
      const b = act.querySelector('#' + id);
      const fire = (e) => { e.preventDefault(); e.stopPropagation(); g.input.press(name); b.classList.add('pressed'); };
      const up = () => b.classList.remove('pressed');
      b.addEventListener('touchstart', fire, { passive: false });
      b.addEventListener('touchend', up);
      b.addEventListener('mousedown', fire);
      b.addEventListener('mouseup', up);
      b.addEventListener('mouseleave', up);
    };
    bindBtn('btnAttack', 'attack');
    bindBtn('btnSkill', 'skill');
    bindBtn('btnDodge', 'dodge');
    bindBtn('btnPotion', 'potion');
    bindBtn('btnInteract', 'interact');

    this.labelLayer = el('div', 'label-layer');
    r.appendChild(this.labelLayer);

    const $ = (id) => document.getElementById(id);
    this.$ = {
      level: $('hudLevel'), hpFill: $('hpFill'), hpText: $('hpText'), stFill: $('stFill'), xpFill: $('xpFill'),
      gold: $('goldText'), qtTitle: $('qtTitle'), qtObj: $('qtObj'), qtArrow: $('qtArrow'),
      bossFill: $('bossFill'), bossName: $('bossName'), interact: $('btnInteract'), interactLabel: $('interactLabel'),
      skillCd: $('skillCd'), potionCount: $('potionCount'), stBar: panel.querySelector('.bar.st')
    };
    this.cache = {};
  }

  show(on) { this.root.classList.toggle('hidden', !on); }

  setText(key, node, value) {
    if (this.cache[key] === value) return;
    this.cache[key] = value;
    node.textContent = value;
  }
  setWidth(key, node, pct) {
    const v = Math.round(pct * 1000) / 10;
    if (this.cache[key] === v) return;
    this.cache[key] = v;
    node.style.width = v + '%';
  }

  setInteract(label) {
    this.$.interact.classList.toggle('hidden', !label);
    if (label) this.$.interactLabel.textContent = label;
  }

  flashStamina() {
    const b = this.$.stBar;
    b.classList.remove('warn');
    void b.offsetWidth;
    b.classList.add('warn');
  }

  toast(text, dur = 2.4) {
    this.toastEl.textContent = text;
    this.toastEl.classList.add('show');
    this.toastTimer = dur;
  }

  showRegion(name, sub) {
    this.regionBanner.innerHTML = `<b>${name}</b><span>${sub || ''}</span>`;
    this.regionBanner.classList.remove('show');
    void this.regionBanner.offsetWidth;
    this.regionBanner.classList.add('show');
  }

  showLevelUp(level) {
    this.levelBanner.innerHTML = `<b>NÍVEL ${level}</b><span>Vida e força aumentaram!</span>`;
    this.levelBanner.classList.remove('show');
    void this.levelBanner.offsetWidth;
    this.levelBanner.classList.add('show');
  }

  damageVignette() {
    this.vignette.classList.remove('hit');
    void this.vignette.offsetWidth;
    this.vignette.classList.add('hit');
  }

  setBoss(enemy) {
    this.boss = enemy;
    this.bossEl.classList.toggle('hidden', !enemy);
    if (enemy) this.$.bossName.textContent = enemy.name;
  }

  // ---------- projeção mundo -> tela ----------
  project(pos) {
    const g = this.game;
    const eng = g.engine;
    const cam = g.cameraRig.cam;
    const w = eng.getRenderWidth(), h = eng.getRenderHeight();
    if (!this._vp || this._vpW !== w || this._vpH !== h) {
      this._vp = cam.viewport.toGlobal(w, h);
      this._vpW = w; this._vpH = h;
    }
    const p = Vector3.Project(pos, Matrix.IdentityReadOnly, g.scene.getTransformMatrix(), this._vp);
    const sx = g.canvas.clientWidth / w, sy = g.canvas.clientHeight / h;
    return { x: p.x * sx, y: p.y * sy, visible: p.z > 0 && p.z < 1 };
  }

  floatText(pos, text, kind = 'dmg') {
    const s = this.project(pos);
    if (!s.visible) return;
    let e = this.floatPool.pop();
    if (!e) e = el('div', '');
    e.className = 'float ' + kind;
    e.textContent = text;
    e.style.left = s.x + (Math.random() - 0.5) * 24 + 'px';
    e.style.top = s.y + 'px';
    this.labelLayer.appendChild(e);
    setTimeout(() => { e.remove(); this.floatPool.push(e); }, 1000);
  }

  /** Rótulo preso a algo do mundo (atualizado a cada quadro). */
  label(key, create) {
    let l = this.labels.get(key);
    if (!l) {
      l = create();
      this.labelLayer.appendChild(l.el);
      this.labels.set(key, l);
    }
    l.seen = true;
    return l;
  }

  updateLabels() {
    const g = this.game;
    const pp = g.player.position;
    for (const l of this.labels.values()) l.seen = false;

    // NPCs: nome + marcador de missão
    for (const n of g.interaction.npcs) {
      const d = Math.hypot(n.x - pp.x, n.z - pp.z);
      if (d > 22) continue;
      const l = this.label('npc_' + n.id, () => {
        const e = el('div', 'npc-label');
        e.innerHTML = `<i></i><span>${n.name}</span>`;
        return { el: e, mark: e.querySelector('i'), lastMark: undefined };
      });
      const mark = g.quests.npcMarker(n.dialogAs || n.id);
      if (mark !== l.lastMark) {
        l.lastMark = mark;
        l.mark.textContent = mark || '';
        l.mark.className = mark === '?' ? 'ready' : mark ? 'new' : '';
      }
      const s = this.project(new Vector3(n.x, g.world.groundAt(n.x, n.z) + 2.25, n.z));
      l.el.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -100%)`;
      l.el.style.opacity = s.visible ? Math.min(1, (22 - d) / 6) : 0;
    }

    // inimigos: barra de vida quando em combate
    for (const e of g.enemies.list) {
      if (!e.alive || !e.active || e.def.boss) continue;
      if (e.showBar <= 0 && !(e.state === 'chase' || e.state === 'attack' || e.state === 'recover')) continue;
      const l = this.label('en_' + e.id, () => {
        const d = el('div', 'enemy-bar');
        d.innerHTML = '<i></i>';
        return { el: d, fill: d.querySelector('i') };
      });
      const s = this.project(new Vector3(e.position.x, e.position.y + 1.9 * (e.def.scale || 1) * (e.def.rig === 'biped' ? 1 : 0.6), e.position.z));
      l.el.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -50%)`;
      l.el.style.opacity = s.visible ? 1 : 0;
      l.fill.style.width = Math.max(0, (e.hp / e.maxHp) * 100) + '%';
    }

    for (const [k, l] of this.labels) {
      if (!l.seen) { l.el.remove(); this.labels.delete(k); }
    }
  }

  // ---------- minimapa ----------
  buildMinimapImage() {
    const g = this.game;
    const t = g.world.terrain;
    const size = 180;
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(size, size);
    const w = g.world;
    for (let py = 0; py < size; py++) {
      for (let px = 0; px < size; px++) {
        const x = px - 90, z = 90 - py;
        const [r, gg, b] = t.colorAt(x, z);
        const h = t.heightAt(x, z);
        const shade = 0.75 + (h - t.minH) / (t.maxH - t.minH) * 0.45;
        let R = r * shade, G = gg * shade, B = b * shade;
        if (w.lake && h < w.waterLevel && Math.hypot(x - w.lake.x, z - w.lake.z) < w.lake.r + 3) { R = 0.2; G = 0.45; B = 0.6; }
        const k = (py * size + px) * 4;
        img.data[k] = Math.min(255, R * 255); img.data[k + 1] = Math.min(255, G * 255); img.data[k + 2] = Math.min(255, B * 255); img.data[k + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    // trilha
    ctx.strokeStyle = 'rgba(150,115,70,0.95)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    const tp = [...(w.trailPoints || [])].sort((a, b) => a.x - b.x);
    tp.forEach((p, i) => (i ? ctx.lineTo(p.x + 90, 90 - p.z) : ctx.moveTo(p.x + 90, 90 - p.z)));
    ctx.stroke();
    // árvores
    ctx.fillStyle = 'rgba(25,60,25,0.75)';
    for (const tr of w.trees) { ctx.beginPath(); ctx.arc(tr.x + 90, 90 - tr.z, 1.6, 0, 7); ctx.fill(); }
    // casas e construções
    ctx.fillStyle = '#8a5a3c';
    for (const b of w.houses) ctx.fillRect(b.minX + 90, 90 - b.maxZ, b.maxX - b.minX, b.maxZ - b.minZ);
    // ruínas
    const ru = w.regions.get('ruinas');
    ctx.strokeStyle = 'rgba(200,200,190,0.9)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(ru.x + 90, 90 - ru.z, 10, 0, 7); ctx.stroke();
    this.mapImage = c;
    return c;
  }

  drawMinimap() {
    const g = this.game;
    if (!this.mapImage) this.buildMinimapImage();
    const ctx = this.mmCtx;
    const W = this.mmCanvas.width, R = W / 2;
    const p = g.player.position;
    const f = g.cameraRig.forwardFlat();
    const camAng = Math.atan2(f.x, f.z);
    const scale = 2.1;
    ctx.save();
    ctx.clearRect(0, 0, W, W);
    ctx.beginPath(); ctx.arc(R, R, R - 2, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#1d2a1d'; ctx.fillRect(0, 0, W, W);
    ctx.translate(R, R);
    ctx.rotate(-camAng);
    ctx.scale(scale, scale);
    ctx.translate(-(p.x + 90), -(90 - p.z));
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.mapImage, 0, 0);
    // inimigos
    for (const e of g.enemies.list) {
      if (!e.alive || !e.active || e.dormant) continue;
      ctx.fillStyle = e.def.boss ? '#c070ff' : '#e04030';
      ctx.beginPath(); ctx.arc(e.position.x + 90, 90 - e.position.z, e.def.boss ? 2.2 : 1.3, 0, 7); ctx.fill();
    }
    // NPCs
    ctx.fillStyle = '#ffd34d';
    for (const n of g.interaction.npcs) { ctx.beginPath(); ctx.arc(n.x + 90, 90 - n.z, 1.4, 0, 7); ctx.fill(); }
    // baús
    ctx.fillStyle = '#ffb347';
    for (const c of g.interaction.chests) if (!c.opened) ctx.fillRect(c.x + 90 - 1, 90 - c.z - 1, 2, 2);
    ctx.restore();

    // alvo da missão (preso à borda)
    const q = g.quests.trackedQuest();
    const target = q ? g.quests.targetPos(q) : null;
    this.questTarget = target;
    if (target) {
      const dx = target.x - p.x, dz = target.z - p.z;
      const a = Math.atan2(dx, dz) - camAng;
      const dist = Math.min(R - 10, Math.hypot(dx, dz) * scale);
      const mx = R + Math.sin(a) * dist, my = R - Math.cos(a) * dist;
      ctx.fillStyle = '#ffe066';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.5;
      this.star(ctx, mx, my, 6);
    }
    // jogador
    ctx.save();
    ctx.translate(R, R);
    ctx.rotate(g.player.yaw - camAng);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#0a2a5a';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(6, 6); ctx.lineTo(0, 3); ctx.lineTo(-6, 6); ctx.closePath();
    ctx.stroke(); ctx.fill();
    ctx.restore();
    // N
    ctx.save();
    ctx.translate(R, R);
    ctx.rotate(-camAng);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', 0, -R + 14);
    ctx.restore();
  }

  star(ctx, x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const rr = i % 2 ? r * 0.45 : r;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.stroke(); ctx.fill();
  }

  // ---------- atualização ----------
  update(dt) {
    const g = this.game;
    const p = g.player;
    const $ = this.$;
    this.setText('lvl', $.level, String(p.level));
    this.setWidth('hp', $.hpFill, p.hp / p.maxHp);
    this.setText('hpt', $.hpText, `${Math.ceil(p.hp)}/${p.maxHp}`);
    this.setWidth('st', $.stFill, p.stamina / p.maxStamina);
    this.setWidth('xp', $.xpFill, p.xp / p.xpNext);
    this.setText('gold', $.gold, String(g.inventory.gold));
    this.setText('pot', $.potionCount, String(g.inventory.count('pocao')));
    const cd = p.combat.skillCooldown / 4;
    this.setWidth('cd', $.skillCd, cd);
    $.hpFill.parentElement.classList.toggle('low', p.hp / p.maxHp < 0.3);

    // missão acompanhada
    const q = g.quests.trackedQuest();
    this.qt.classList.toggle('hidden', !q);
    if (q) {
      this.setText('qtt', $.qtTitle, QUESTS[q].title);
      this.setText('qto', $.qtObj, g.quests.objectiveText(q));
      const t = this.questTarget;
      if (t) {
        const f = g.cameraRig.forwardFlat();
        const a = Math.atan2(t.x - p.position.x, t.z - p.position.z) - Math.atan2(f.x, f.z);
        const d = Math.hypot(t.x - p.position.x, t.z - p.position.z);
        $.qtArrow.style.transform = `rotate(${a - Math.PI / 2}rad)`;
        $.qtArrow.style.opacity = d < 4 ? 0.3 : 1;
      }
    }

    if (this.boss) {
      this.setWidth('boss', $.bossFill, Math.max(0, this.boss.hp / this.boss.maxHp));
      if (!this.boss.alive || this.boss.dormant) this.setBoss(null);
    }

    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toastEl.classList.remove('show');
    }

    this.mmTimer -= dt;
    if (this.mmTimer <= 0) {
      this.mmTimer = 0.08;
      this.drawMinimap();
    }
    this.updateLabels();

    if (g.settings.showFps) {
      this.fpsEl.classList.remove('hidden');
      this.fpsTimer = (this.fpsTimer || 0) - dt;
      if (this.fpsTimer <= 0) { this.fpsTimer = 0.5; this.fpsEl.textContent = Math.round(g.engine.getFps()) + ' FPS'; }
    } else this.fpsEl.classList.add('hidden');
  }
}
