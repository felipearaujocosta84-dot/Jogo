// =============================================================
// EXTREME RACING — ReplayUI
// Controles do replay: reproduzir/pausar, velocidade, barra de
// tempo, câmera, carro acompanhado e sair.
// =============================================================
import { h } from './dom.js';
import { formatTime } from '../race/RaceManager.js';
import { REPLAY_CAMS } from '../race/ReplayPlayer.js';

export class ReplayUI {
  constructor(root, player, { onExit }) {
    this.player = player;
    this.el = h('div', { class: 'replay-ui' });
    this.label = h('div', { class: 'replay-tag' }, 'REPLAY');
    this.info = h('div', { class: 'replay-info' });
    const btn = (text, fn, cls = '') => h('button', { class: `replay-btn ${cls}`, onclick: (e) => { e.stopPropagation(); fn(e); } }, text);
    this.playBtn = btn('II', () => { player.playing = !player.playing; if (player.playing && player.t >= player.duration) player.seek(0); this.refresh(); });
    this.speedBtn = btn('1x', () => {
      const speeds = [0.25, 0.5, 1, 2, 4];
      player.speed = speeds[(speeds.indexOf(player.speed) + 1) % speeds.length];
      this.refresh();
    });
    this.camBtn = btn(`CÂM: ${REPLAY_CAMS[0][1]}`, () => { this.camBtn.textContent = `CÂM: ${player.nextCamera()}`; });
    this.carBtn = btn('CARRO', () => { this.carBtn.textContent = player.nextCar(); });
    this.seek = h('input', { type: 'range', min: 0, max: 1000, value: 0, class: 'replay-seek' });
    this.seek.addEventListener('input', () => { player.seek((this.seek.value / 1000) * player.duration); });
    this.time = h('span', { class: 'replay-time' });
    this.el.append(this.label, this.info,
      h('div', { class: 'replay-bar' },
        btn('⏮', () => player.seek(0)),
        btn('−10s', () => player.seek(player.t - 10)),
        this.playBtn,
        btn('+10s', () => player.seek(player.t + 10)),
        this.speedBtn, this.seek, this.time, this.camBtn, this.carBtn,
        btn('SAIR', () => onExit(), 'exit')));
    this.carBtn.textContent = player.vehicles[player.target].name;
    root.appendChild(this.el);
    this._timer = 0;
  }

  refresh() {
    this.playBtn.textContent = this.player.playing ? 'II' : '▶';
    this.speedBtn.textContent = `${this.player.speed}x`;
  }

  update(dt) {
    this._timer -= dt;
    if (this._timer > 0) return;
    this._timer = 0.1;
    const p = this.player;
    this.seek.value = String(Math.round((p.t / Math.max(0.01, p.duration)) * 1000));
    this.time.textContent = `${formatTime(p.t)} / ${formatTime(p.duration)}`;
    const v = p.vehicles[p.target];
    p.rec.sample(p.target, p.t, p.frame);
    this.info.textContent = `${v.name} • ${Math.round(p.frame[18])} km/h`;
    this.refresh();
  }

  dispose() { this.el.remove(); }
}
