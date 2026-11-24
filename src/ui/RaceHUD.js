// =============================================================
// EXTREME RACING — RaceHUD
// Posição, voltas, cronômetro (atual / melhor / última / delta),
// velocímetro, marcha, conta-giros, ABS/TC, minimapa, tabela de
// classificação, contagem regressiva, avisos, pausa e resultados.
// =============================================================
import { h } from './dom.js';
import { formatTime } from '../race/RaceManager.js';

export class RaceHUD {
  constructor(root, track, opts = {}) {
    this.root = root;
    this.track = track;
    this.opts = opts;
    this.el = h('div', { class: 'hud' });
    this.pos = h('div', { class: 'hud-pos' });
    this.times = h('div', { class: 'hud-times' });
    this.speed = h('div', { class: 'hud-speed' });
    this.gear = h('div', { class: 'hud-gear' });
    this.rpm = h('div', { class: 'hud-rpm' }, h('i'));
    this.assist = h('div', { class: 'hud-assist' }, h('span', {}, 'ABS'), h('span', {}, 'TC'), h('span', {}, 'ESP'));
    this.mapCanvas = h('canvas', { class: 'hud-map', width: 220, height: 220 });
    this.board = h('div', { class: 'hud-board' });
    this.center = h('div', { class: 'hud-center' });
    this.msg = h('div', { class: 'hud-msg' });
    this.fps = h('div', { class: 'hud-fps' });
    this.el.append(this.pos, this.times, this.speed, this.gear, this.rpm, this.assist, this.mapCanvas, this.board, this.center, this.msg, this.fps);
    root.appendChild(this.el);
    this._textTimer = 0;
    this._buildMap();
    this.times.innerHTML = `
      <div><label>VOLTA</label><b data-k="lap">0:00.000</b></div>
      <div><label>MELHOR</label><b data-k="best">--:--.---</b></div>
      <div><label>ÚLTIMA</label><b data-k="last">--:--.---</b></div>
      <div><label>DELTA</label><b data-k="delta" class="hud-delta">—</b></div>`;
    this.t = Object.fromEntries([...this.times.querySelectorAll('[data-k]')].map((e) => [e.dataset.k, e]));
  }

  _buildMap() {
    const g = this.track;
    const b = g.bounds();
    const size = 220, pad = 18;
    const span = Math.max(b.maxX - b.minX, b.maxZ - b.minZ);
    this.mapScale = (size - pad * 2) / span;
    this.mapOff = { x: pad + ((size - pad * 2) - (b.maxX - b.minX) * this.mapScale) / 2 - b.minX * this.mapScale, z: pad + ((size - pad * 2) - (b.maxZ - b.minZ) * this.mapScale) / 2 };
    this.mapMinZ = b.minZ; this.mapMaxZ = b.maxZ;
    this.mapBase = document.createElement('canvas');
    this.mapBase.width = size; this.mapBase.height = size;
    const ctx = this.mapBase.getContext('2d');
    ctx.lineJoin = 'round';
    for (const [w, c] of [[9, 'rgba(0,0,0,0.6)'], [5, 'rgba(255,255,255,0.85)']]) {
      ctx.lineWidth = w; ctx.strokeStyle = c;
      ctx.beginPath();
      g.samples.forEach((s, i) => { const p = this._mp(s.p); if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
      ctx.closePath(); ctx.stroke();
    }
    const st = this._mp(g.samples[0].p);
    ctx.fillStyle = '#e3122e';
    ctx.fillRect(st.x - 3, st.y - 3, 6, 6);
  }

  _mp(p) {
    // z para cima no mapa
    return { x: this.mapOff.x + p.x * this.mapScale, y: 220 - (this.mapOff.z + (p.z - this.mapMinZ) * this.mapScale) };
  }

  /** Atualização por quadro. */
  update(dt, { player, telemetry, race, participants, fps, showFps, recordLap }) {
    // Velocímetro e marcha (todo quadro)
    this.speed.innerHTML = `<b>${Math.round(telemetry.speedKmh)}</b><span>KM/H</span>`;
    const g = telemetry.gear;
    this.gear.textContent = g === 0 ? 'N' : g < 0 ? 'R' : telemetry.electric ? 'D' : String(g);
    this.rpm.firstChild.style.width = `${Math.min(100, (telemetry.rpm / telemetry.maxRpm) * 100)}%`;
    const [abs, tc, esp] = this.assist.children;
    abs.classList.toggle('on', telemetry.abs);
    tc.classList.toggle('on', telemetry.tc);
    esp.classList.toggle('on', !!telemetry.esp);

    this._textTimer -= dt;
    if (this._textTimer > 0) return;
    this._textTimer = 0.1;

    const total = race.totalLaps;
    const lapNow = Math.min(player.lap + 1, Number.isFinite(total) ? total : player.lap + 1);
    const n = participants.length;
    this.pos.innerHTML = race.mode.ai
      ? `<b>${player.position}</b><span>/${n}</span><small>VOLTA ${lapNow}${Number.isFinite(total) ? '/' + total : ''}</small>`
      : `<small style="font-size:3vh">VOLTA ${lapNow}${Number.isFinite(total) ? '/' + total : ''}</small>`;
    const lapTime = race.state === 'racing' ? race.time - player.lapStart : 0;
    this.t.lap.textContent = formatTime(lapTime);
    this.t.best.textContent = formatTime(Number.isFinite(player.bestLap) ? player.bestLap : null);
    this.t.last.textContent = formatTime(player.lastLap);
    // Delta em relação ao recorde (ou melhor volta) pelo progresso da volta
    const ref = recordLap ?? (Number.isFinite(player.bestLap) ? player.bestLap : null);
    if (ref && race.state === 'racing' && player.distance > 0) {
      const frac = (player.distance - player.lap * this.track.length) / this.track.length;
      const delta = lapTime - ref * Math.max(0, Math.min(1, frac));
      this.t.delta.textContent = `${delta >= 0 ? '+' : '−'}${Math.abs(delta).toFixed(2)}`;
      this.t.delta.className = `hud-delta ${delta < 0 ? 'neg' : 'pos'}`;
    } else {
      this.t.delta.textContent = '—';
      this.t.delta.className = 'hud-delta';
    }

    // Classificação
    if (race.mode.ai) {
      this.board.classList.remove('hidden');
      this.board.innerHTML = race.ranking.map((p) => `<div class="${p.isPlayer ? 'me' : ''}"><span>${p.position}. ${p.name}</span><span>${p.finished ? '🏁' : ''}</span></div>`).join('');
    } else this.board.classList.add('hidden');

    // Minimapa
    const ctx = this.mapCanvas.getContext('2d');
    ctx.clearRect(0, 0, 220, 220);
    ctx.drawImage(this.mapBase, 0, 0);
    for (const p of participants) {
      const mp = this._mp(p.getPosition());
      ctx.fillStyle = p.isPlayer ? '#ffb020' : '#e3122e';
      ctx.beginPath(); ctx.arc(mp.x, mp.y, p.isPlayer ? 6 : 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.stroke();
    }
    this.fps.textContent = showFps ? `${Math.round(fps)} FPS` : '';
    if (player.wrongWay) this.message('CONTRAMÃO!', 600, true);
  }

  countdown(n) {
    this.center.textContent = n === 'go' ? 'VAI!' : String(n);
    this.center.classList.add('show');
    this.center.classList.toggle('go', n === 'go');
    clearTimeout(this._cdTimer);
    this._cdTimer = setTimeout(() => this.center.classList.remove('show'), n === 'go' ? 900 : 800);
  }

  message(text, ms = 1800, warn = false) {
    this.msg.textContent = text;
    this.msg.classList.add('show');
    this.msg.classList.toggle('warn', warn);
    clearTimeout(this._msgTimer);
    this._msgTimer = setTimeout(() => this.msg.classList.remove('show'), ms);
  }

  /** Menu de pausa. */
  showPause({ onResume, onRestart, onQuit, onCamera, onSettings, onReplay }) {
    this.hidePause();
    const box = h('div', { class: 'modal-box' },
      h('h2', {}, 'PAUSA'),
      h('button', { class: 'menu-btn primary', onclick: onResume }, 'CONTINUAR'),
      h('button', { class: 'menu-btn', onclick: onRestart }, 'REINICIAR CORRIDA'),
      h('button', { class: 'menu-btn', onclick: onCamera }, 'ALTERNAR CÂMERA'),
      onReplay ? h('button', { class: 'menu-btn', onclick: onReplay }, 'VER REPLAY') : null,
      h('button', { class: 'menu-btn', onclick: onSettings }, 'CONFIGURAÇÕES'),
      h('button', { class: 'menu-btn', onclick: onQuit }, 'SAIR PARA O MENU'));
    this.pauseEl = h('div', { class: 'modal' }, box);
    this.root.appendChild(this.pauseEl);
  }

  hidePause() {
    this.pauseEl?.remove();
    this.pauseEl = null;
  }

  /** Tela de resultados. */
  showResults({ title, results, earned, record, onContinue, onRestart, onReplay, extra }) {
    const rows = results.map((r) => `
      <tr class="${r.isPlayer ? 'me' : ''}">
        <td>${r.position}º</td><td>${r.name}</td>
        <td class="num">${r.time != null ? formatTime(r.time) + (r.estimated ? '*' : '') : '—'}</td>
        <td class="num">${formatTime(r.bestLap)}</td>
      </tr>`).join('');
    const box = h('div', { class: 'modal-box' },
      h('h2', {}, title),
      h('div', { html: `<table class="table"><thead><tr><th>POS</th><th>PILOTO</th><th class="num">TEMPO</th><th class="num">MELHOR VOLTA</th></tr></thead><tbody>${rows}</tbody></table>` }),
      results.some((r) => r.estimated) ? h('p', { class: 'label' }, '* tempo estimado pelo ritmo no momento da chegada do jogador') : null,
      record ? h('p', { style: { color: '#2bd46b', fontWeight: 800 } }, `NOVO RECORDE DE VOLTA: ${formatTime(record)}`) : null,
      earned != null ? h('p', { style: { fontWeight: 800 } }, `Créditos ganhos: ${earned.toLocaleString('pt-BR')} CR`) : null,
      extra ?? null,
      h('button', { class: 'menu-btn primary', onclick: onContinue }, 'CONTINUAR'),
      onReplay ? h('button', { class: 'menu-btn', onclick: onReplay }, 'VER REPLAY') : null,
      onRestart ? h('button', { class: 'menu-btn', onclick: onRestart }, 'CORRER NOVAMENTE') : null);
    this.resultsEl = h('div', { class: 'modal' }, box);
    this.root.appendChild(this.resultsEl);
  }

  /** Esconde/mostra o HUD e os resultados (durante o replay). */
  setReplayMode(on) {
    this.el.classList.toggle('hidden', on);
    this.resultsEl?.classList.toggle('hidden', on);
  }

  dispose() {
    this.hidePause();
    this.resultsEl?.remove();
    this.el.remove();
  }
}
